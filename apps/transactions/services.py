import logging
import requests
import time
import hashlib
from decimal import Decimal
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from apps.core.stellar import (
    get_stellar_server,
    is_valid_stellar_public_key,
    verify_stellar_testnet_payment,
    get_stellar_expert_tx_url,
    fetch_stellar_account_balances,
)
from apps.core.exceptions import StellarVerificationError
from apps.payments.models import PaymentRequest, PaymentStatus
from apps.transactions.models import BlockchainTransaction, TransactionStatus
from stellar_sdk import TransactionBuilder, Asset, Account, TransactionEnvelope
from stellar_sdk.exceptions import BadRequestError, NotFoundError as StellarNotFoundError

logger = logging.getLogger(__name__)

def dispatch_merchant_webhook(transaction_obj: BlockchainTransaction):
    """Deliver webhook notification to merchant webhook_url if configured."""
    merchant = transaction_obj.merchant
    if not merchant.webhook_url:
        return

    payload = {
        'event': 'payment.succeeded',
        'timestamp': timezone.now().isoformat(),
        'data': {
            'reference_id': transaction_obj.payment_request.reference_id,
            'amount': str(transaction_obj.amount),
            'currency': transaction_obj.asset_code,
            'tx_hash': transaction_obj.tx_hash,
            'ledger': transaction_obj.ledger,
            'source_account': transaction_obj.source_account,
            'destination_account': transaction_obj.destination_account,
            'stellar_expert_url': transaction_obj.stellar_expert_url,
            'status': transaction_obj.status,
            'verified_at': transaction_obj.verified_at.isoformat() if transaction_obj.verified_at else None,
        }
    }

    try:
        requests.post(
            merchant.webhook_url,
            json=payload,
            headers={'Content-Type': 'application/json', 'User-Agent': 'SMEHUB-Webhook/1.0'},
            timeout=5
        )
    except Exception as e:
        logger.warning("Failed to dispatch webhook to %s: %s", merchant.webhook_url, e)

@transaction.atomic
def verify_and_record_transaction_service(reference_id: str, tx_hash: str) -> BlockchainTransaction:
    """
    Verifies that the provided tx_hash settled the payment on Stellar Testnet,
    marks PaymentRequest as COMPLETED, and records a BlockchainTransaction.
    """
    try:
        req = PaymentRequest.objects.select_for_update().get(reference_id=reference_id)
    except PaymentRequest.DoesNotExist:
        raise ValidationError({"reference_id": f"Payment request '{reference_id}' was not found."})

    # If already verified and completed with this or another transaction
    existing_tx = BlockchainTransaction.objects.filter(tx_hash=tx_hash).first()
    if existing_tx:
        return existing_tx

    if req.status == PaymentStatus.COMPLETED:
        latest = req.transactions.filter(status=TransactionStatus.SUCCESS).first()
        if latest:
            return latest

    if req.status == PaymentStatus.CANCELLED:
        raise ValidationError({"status": "Cannot verify payment for a cancelled payment request."})

    # Check on Stellar Testnet Horizon
    tx_meta = verify_stellar_testnet_payment(
        tx_hash=tx_hash,
        expected_destination=req.destination_address,
        expected_amount=req.amount,
        expected_asset_code=req.currency,
        expected_asset_issuer=req.asset_issuer,
        expected_memo=req.memo
    )

    # Record verified transaction
    safe_raw_response = {k: (str(v) if isinstance(v, Decimal) else v) for k, v in tx_meta.items()}
    blockchain_tx = BlockchainTransaction.objects.create(
        payment_request=req,
        merchant=req.merchant,
        tx_hash=tx_hash,
        source_account=tx_meta.get('source_account', ''),
        destination_account=req.destination_address,
        amount=tx_meta.get('paid_amount', req.amount),
        asset_code=req.currency,
        asset_issuer=req.asset_issuer,
        memo=req.memo,
        ledger=tx_meta.get('ledger'),
        fee_charged=tx_meta.get('fee_charged'),
        status=TransactionStatus.SUCCESS,
        stellar_expert_url=tx_meta.get('explorer_url', get_stellar_expert_tx_url(tx_hash)),
        raw_response=safe_raw_response,
    )

    # Mark request as COMPLETED
    req.status = PaymentStatus.COMPLETED
    req.paid_at = timezone.now()
    req.save(update_fields=['status', 'paid_at'])

    # Optional webhook notification
    dispatch_merchant_webhook(blockchain_tx)

    return blockchain_tx

def check_payment_status_service(reference_id: str) -> dict:
    """Check payment status and return summary for checkout polling."""
    try:
        req = PaymentRequest.objects.select_related('merchant').get(reference_id=reference_id)
    except PaymentRequest.DoesNotExist:
        raise ValidationError({"reference_id": f"Payment request '{reference_id}' not found."})

    if req.is_expired():
        req.status = PaymentStatus.EXPIRED
        req.save(update_fields=['status'])

    latest_tx = req.transactions.order_by('-created_at').first()

    return {
        'reference_id': req.reference_id,
        'status': req.status,
        'is_completed': (req.status == PaymentStatus.COMPLETED),
        'is_expired': (req.status == PaymentStatus.EXPIRED),
        'amount': req.amount,
        'currency': req.currency,
        'tx_hash': latest_tx.tx_hash if latest_tx else None,
        'stellar_expert_url': latest_tx.stellar_expert_url if latest_tx else None,
        'paid_at': req.paid_at,
    }


def prepare_checkout_transaction_service(reference_id: str, payer_address: str, preferred_currency: str = None) -> dict:
    """
    Constructs an unsigned Stellar transaction XDR for a payment request.
    Verifies payer on Stellar Testnet (auto-funds via Friendbot if fresh),
    determines payment asset (USDC if trustline exists and balance sufficient, otherwise native XLM),
    and sets memo to reference_id.
    """
    if not is_valid_stellar_public_key(payer_address):
        raise ValidationError({"payer_address": "Invalid Stellar public key format."})

    try:
        req = PaymentRequest.objects.select_related('merchant').get(reference_id=reference_id)
    except PaymentRequest.DoesNotExist:
        raise ValidationError({"reference_id": f"Payment request '{reference_id}' was not found."})

    if req.status == PaymentStatus.COMPLETED:
        raise ValidationError({"status": "Payment request is already completed."})

    server = get_stellar_server()

    # Ensure payer account exists on Horizon Testnet (auto-fund if new)
    account = None
    for attempt in range(3):
        try:
            account = server.load_account(payer_address)
            break
        except StellarNotFoundError:
            if getattr(settings, 'STELLAR_NETWORK', 'TESTNET') == 'TESTNET':
                try:
                    logger.info("Auto-funding new payer %s on Testnet via Friendbot...", payer_address)
                    requests.get(f"https://friendbot.stellar.org/?addr={payer_address}", timeout=10)
                    time.sleep(1.5)
                    account = server.load_account(payer_address)
                    break
                except Exception as fb_err:
                    logger.warning("Friendbot auto-fund failed: %s", fb_err)
            break
        except Exception as e:
            if attempt < 2:
                time.sleep(0.8)
                continue
            logger.error("Error loading account %s: %s", payer_address, e)

    if not account:
        raise ValidationError({
            "payer_address": f"Account {payer_address[:6]}...{payer_address[-4:]} is not active on Stellar Testnet. Please fund your wallet using the Top up button or Stellar Friendbot."
        })

    # Ensure destination account exists on Horizon (auto-fund if new on testnet)
    dest_info = fetch_stellar_account_balances(req.destination_address)
    if not dest_info.get('is_funded'):
        if getattr(settings, 'STELLAR_NETWORK', 'TESTNET') == 'TESTNET':
            try:
                requests.get(f"https://friendbot.stellar.org/?addr={req.destination_address}", timeout=3)
                dest_info = fetch_stellar_account_balances(req.destination_address)
            except Exception:
                pass

    # Inspect real on-chain balances from Horizon
    payer_info = fetch_stellar_account_balances(payer_address)
    payer_balances = payer_info.get('balances', []) or []
    dest_balances = dest_info.get('balances', []) or []

    usdc_code = getattr(settings, 'USDC_ASSET_CODE', 'USDC')
    usdc_issuer = req.asset_issuer or getattr(settings, 'USDC_ISSUER_ADDRESS', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')

    has_usdc_trustline = any(
        b.get('asset_code') == usdc_code and (not b.get('asset_issuer') or b.get('asset_issuer') == usdc_issuer)
        for b in payer_balances
    )
    dest_has_usdc = any(
        b.get('asset_code') == usdc_code and (not b.get('asset_issuer') or b.get('asset_issuer') == usdc_issuer)
        for b in dest_balances
    )
    payer_usdc_bal = payer_info.get('usdc_balance', Decimal('0.00'))
    payer_xlm_bal = payer_info.get('xlm_balance', Decimal('0.00'))

    # Determine payment asset based on payment request currency
    if req.currency == 'USDC':
        if not has_usdc_trustline:
            raise ValidationError({
                "payer_address": f"Your wallet ({payer_address[:6]}...{payer_address[-4:]}) does not have a USDC trustline on Stellar Testnet. Please add a USDC trustline in Freighter/Lobstr to pay with USDC."
            })
        if not dest_has_usdc:
            raise ValidationError({
                "destination_address": f"Merchant wallet ({req.destination_address[:6]}...{req.destination_address[-4:]}) does not have a USDC trustline."
            })
        if payer_usdc_bal < req.amount:
            raise ValidationError({
                "payer_address": f"Insufficient USDC balance. Your wallet has {payer_usdc_bal} USDC, but this invoice requires {req.amount} USDC."
            })

        asset_to_use = Asset(code=usdc_code, issuer=usdc_issuer)
        used_currency = 'USDC'
    elif req.currency == 'XLM':
        if payer_xlm_bal < req.amount:
            raise ValidationError({
                "payer_address": f"Insufficient XLM balance. Your wallet has {payer_xlm_bal} XLM, but this invoice requires {req.amount} XLM."
            })
        asset_to_use = Asset.native()
        used_currency = 'XLM'
    else:
        asset_to_use = Asset(code=usdc_code, issuer=usdc_issuer)
        used_currency = 'USDC'

    # Build Stellar Transaction
    network_passphrase = getattr(settings, 'STELLAR_NETWORK_PASSPHRASE', getattr(settings, 'STELLAR_PASSPHRASE', 'Test SDF Network ; September 2015'))
    memo_text = req.reference_id[:28]

    # Format amount up to 7 decimal places as required by Stellar
    amount_str = f"{req.amount:.7f}".rstrip('0').rstrip('.')
    if '.' not in amount_str:
        amount_str += '.0'

    # Dynamic base fee to guarantee immediate inclusion during Testnet traffic surges
    base_fee = 10000  # Default 10,000 stroops = 0.001 XLM
    try:
        fee_stats = server.fee_stats().call()
        p70_fee = int(fee_stats.get('fee_charged', {}).get('p70', 10000))
        base_fee = max(10000, p70_fee)
    except Exception:
        base_fee = 10000

    tx = (
        TransactionBuilder(
            source_account=account,
            network_passphrase=network_passphrase,
            base_fee=base_fee,
        )
        .append_payment_op(
            destination=req.destination_address,
            amount=amount_str,
            asset=asset_to_use,
        )
        .add_text_memo(memo_text)
        .set_timeout(300)
        .build()
    )

    unsigned_xdr = tx.to_xdr()

    return {
        'success': True,
        'xdr': unsigned_xdr,
        'network_passphrase': network_passphrase,
        'payer_address': payer_address,
        'destination_address': req.destination_address,
        'amount': str(req.amount),
        'currency': req.currency,
        'used_currency': used_currency,
        'memo': memo_text,
    }


def broadcast_checkout_transaction_service(reference_id: str, signed_xdr: str) -> dict:
    """
    Submits a signed transaction XDR to Stellar Horizon, debits the payer,
    credits the merchant, and immediately records & completes the payment request.
    Handles Horizon ingestion lag, network timeouts, duplicate submissions, and bad sequence errors gracefully.
    """
    if not signed_xdr or not isinstance(signed_xdr, str):
        raise ValidationError({"signed_xdr": "Signed transaction XDR is required."})

    try:
        req = PaymentRequest.objects.select_related('merchant').get(reference_id=reference_id)
    except PaymentRequest.DoesNotExist:
        raise ValidationError({"reference_id": f"Payment request '{reference_id}' was not found."})

    network_passphrase = getattr(
        settings,
        'STELLAR_NETWORK_PASSPHRASE',
        getattr(settings, 'STELLAR_PASSPHRASE', 'Test SDF Network ; September 2015')
    )

    # 1. Parse signed transaction envelope and compute deterministic transaction hash
    try:
        envelope = TransactionEnvelope.from_xdr(signed_xdr, network_passphrase)
        tx_hash = envelope.hash_hex()
    except Exception as e:
        logger.error("Failed to parse signed_xdr for %s: %s", reference_id, e)
        raise ValidationError({"signed_xdr": f"Invalid signed transaction XDR: {str(e)}"})

    # 2. Idempotency Check: Already recorded or completed?
    existing_tx = BlockchainTransaction.objects.filter(tx_hash=tx_hash).first()
    if existing_tx:
        if req.status != PaymentStatus.COMPLETED:
            req.status = PaymentStatus.COMPLETED
            if not req.paid_at:
                req.paid_at = timezone.now()
            req.save(update_fields=['status', 'paid_at'])
        return {
            'success': True,
            'message': 'Transaction already confirmed on Stellar Testnet and recorded in SMEHUB.',
            'tx_hash': existing_tx.tx_hash,
            'ledger': existing_tx.ledger,
            'data': existing_tx,
        }

    if req.status == PaymentStatus.COMPLETED:
        completed_tx = req.transactions.filter(status=TransactionStatus.SUCCESS).first()
        if completed_tx:
            return {
                'success': True,
                'message': 'Payment request has already been completed.',
                'tx_hash': completed_tx.tx_hash,
                'ledger': completed_tx.ledger,
                'data': completed_tx,
            }

    server = get_stellar_server()
    horizon_res = None
    submit_error = None

    # 3. Submit transaction to Horizon
    try:
        horizon_res = server.submit_transaction(signed_xdr)
    except BadRequestError as e:
        submit_error = e
        extras = getattr(e, 'extras', {}) or {}
        result_codes = extras.get('result_codes', {})
        tx_code = result_codes.get('transaction', '')

        # If tx_bad_seq or tx_already_exists, it often means the transaction was already
        # submitted and succeeded in a previous attempt (e.g., client retry or double-click).
        if tx_code in ('tx_bad_seq', 'tx_already_exists', 'tx_internal_error'):
            logger.info("Horizon returned %s for %s (%s). Checking if tx was already confirmed on-chain...", tx_code, reference_id, tx_hash)
            for _ in range(5):
                time.sleep(1.2)
                try:
                    onchain_tx = server.transactions().transaction(tx_hash).call()
                    if onchain_tx and onchain_tx.get('successful'):
                        horizon_res = {
                            'hash': tx_hash,
                            'ledger': onchain_tx.get('ledger'),
                            'successful': True,
                        }
                        submit_error = None
                        break
                except Exception:
                    pass

        if submit_error:
            logger.error("Horizon rejected transaction for %s: %s", reference_id, e)
            op_codes = result_codes.get('operations', [])
            err_msg = f"Stellar network rejected transaction: {tx_code or 'error'}"
            if op_codes:
                err_msg += f" (operation code: {', '.join(op_codes)})"
            raise ValidationError({"stellar_error": err_msg, "details": extras})

    except Exception as e:
        submit_error = e
        logger.warning("Horizon submission error for %s (%s): %s. Checking if ledger accepted it...", reference_id, tx_hash, e)
        # On gateway timeout (504) or connection error, the transaction may still have succeeded
        for _ in range(5):
            time.sleep(1.5)
            try:
                onchain_tx = server.transactions().transaction(tx_hash).call()
                if onchain_tx and onchain_tx.get('successful'):
                    horizon_res = {
                        'hash': tx_hash,
                        'ledger': onchain_tx.get('ledger'),
                        'successful': True,
                    }
                    submit_error = None
                    break
            except Exception:
                pass

        if submit_error:
            logger.error("Could not broadcast transaction to Horizon for %s: %s", reference_id, e)
            raise ValidationError({"stellar_error": f"Failed broadcasting transaction to Stellar Horizon: {str(e)}"})

    confirmed_tx_hash = horizon_res.get('hash') or tx_hash
    ledger = horizon_res.get('ledger')

    # 4. Immediate settlement recording without waiting for slow asynchronous Horizon ingestion!
    source_acc = getattr(envelope.transaction.source, 'account_id', str(envelope.transaction.source))
    fee_in_xlm = Decimal(str(envelope.transaction.fee or 100)) / Decimal('10000000')

    with transaction.atomic():
        req.refresh_from_db()
        req.status = PaymentStatus.COMPLETED
        req.paid_at = timezone.now()
        req.save(update_fields=['status', 'paid_at'])

        blockchain_tx, _ = BlockchainTransaction.objects.update_or_create(
            tx_hash=confirmed_tx_hash,
            defaults={
                'payment_request': req,
                'merchant': req.merchant,
                'source_account': source_acc,
                'destination_account': req.destination_address,
                'amount': req.amount,
                'asset_code': req.currency,
                'asset_issuer': req.asset_issuer,
                'memo': req.memo,
                'ledger': ledger,
                'fee_charged': fee_in_xlm,
                'status': TransactionStatus.SUCCESS,
                'stellar_expert_url': get_stellar_expert_tx_url(confirmed_tx_hash),
                'raw_response': {
                    'hash': confirmed_tx_hash,
                    'ledger': ledger,
                    'successful': True,
                    'source_account': source_acc,
                    'fee_charged': str(fee_in_xlm),
                },
            }
        )

    # 5. Dispatch optional merchant webhook
    dispatch_merchant_webhook(blockchain_tx)

    return {
        'success': True,
        'message': 'Transaction successfully broadcasted, settled on Stellar Testnet, and debited from wallet.',
        'tx_hash': confirmed_tx_hash,
        'ledger': ledger,
        'data': blockchain_tx,
    }


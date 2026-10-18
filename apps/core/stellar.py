import logging
from decimal import Decimal
import urllib.parse
from django.conf import settings
from stellar_sdk import Server, Keypair, TransactionEnvelope
from stellar_sdk.exceptions import BadRequestError, NotFoundError as StellarNotFoundError
from apps.core.exceptions import StellarVerificationError

logger = logging.getLogger(__name__)

def is_valid_stellar_public_key(public_key: str) -> bool:
    """Validate whether a string is a valid Stellar Ed25519 public key (starts with G, 56 chars)."""
    if not public_key or not isinstance(public_key, str):
        return False
    try:
        Keypair.from_public_key(public_key)
        return True
    except Exception:
        return False

def get_stellar_server() -> Server:
    """Return configured Stellar Horizon Server instance."""
    return Server(horizon_url=settings.STELLAR_HORIZON_URL)

def generate_sep0007_pay_uri(
    destination: str,
    amount: Decimal,
    asset_code: str = 'USDC',
    asset_issuer: str = None,
    memo: str = None,
    memo_type: str = 'MEMO_TEXT'
) -> str:
    """
    Generate standard Stellar SEP-0007 URI for wallets (Freighter, Lobstr, xBull).
    Format: web+stellar:pay?destination=G...&amount=...&asset_code=USDC&asset_issuer=...&memo=...
    """
    if not asset_issuer and asset_code != 'XLM':
        asset_issuer = settings.USDC_ISSUER_ADDRESS

    params = {
        'destination': destination,
        'amount': f"{amount:.2f}",
    }

    if asset_code != 'XLM' and asset_issuer:
        params['asset_code'] = asset_code
        params['asset_issuer'] = asset_issuer

    if memo:
        params['memo'] = memo
        params['memo_type'] = memo_type

    query_string = urllib.parse.urlencode(params)
    return f"web+stellar:pay?{query_string}"

def get_stellar_expert_tx_url(tx_hash: str) -> str:
    """Return public Stellar Expert explorer URL for a transaction hash."""
    base = settings.STELLAR_EXPERT_BASE_URL.rstrip('/')
    return f"{base}/{tx_hash}"

def fetch_stellar_account_balances(public_key: str) -> dict:
    """
    Fetch balances from Stellar Horizon for a given public key.
    Returns:
    {
        'account_id': public_key,
        'is_funded': bool,
        'xlm_balance': Decimal,
        'usdc_balance': Decimal,
        'balances': list
    }
    """
    server = get_stellar_server()
    try:
        account = server.accounts().account_id(public_key).call()
        balances_raw = account.get('balances', [])
        
        xlm_bal = Decimal('0.00')
        usdc_bal = Decimal('0.00')

        for b in balances_raw:
            asset_type = b.get('asset_type')
            balance = Decimal(str(b.get('balance', '0')))
            if asset_type == 'native':
                xlm_bal = balance
            elif b.get('asset_code') == settings.USDC_ASSET_CODE:
                usdc_bal = balance

        return {
            'account_id': public_key,
            'is_funded': True,
            'sequence': account.get('sequence'),
            'xlm_balance': xlm_bal,
            'usdc_balance': usdc_bal,
            'balances': balances_raw,
        }
    except StellarNotFoundError:
        return {
            'account_id': public_key,
            'is_funded': False,
            'sequence': None,
            'xlm_balance': Decimal('0.00'),
            'usdc_balance': Decimal('0.00'),
            'balances': [],
        }
    except Exception as e:
        logger.warning("Error fetching account %s from Stellar: %s", public_key, e)
        return {
            'account_id': public_key,
            'is_funded': False,
            'error': str(e),
            'xlm_balance': Decimal('0.00'),
            'usdc_balance': Decimal('0.00'),
            'balances': [],
        }

def verify_stellar_testnet_payment(
    tx_hash: str,
    expected_destination: str,
    expected_amount: Decimal,
    expected_asset_code: str = 'USDC',
    expected_asset_issuer: str = None,
    expected_memo: str = None
) -> dict:
    """
    Verifies that a Stellar Testnet transaction succeeded and delivered the expected payment.
    Returns dict with verified transaction metadata or raises StellarVerificationError.
    """
    if not tx_hash or len(tx_hash) != 64:
        raise StellarVerificationError("Invalid Stellar transaction hash format. Must be 64-char hex string.")

    if not expected_asset_issuer and expected_asset_code != 'XLM':
        expected_asset_issuer = settings.USDC_ISSUER_ADDRESS

    import time
    server = get_stellar_server()
    tx_data = None

    # Poll Horizon for up to 15 seconds (10 attempts) to account for asynchronous ledger ingestion lag
    for attempt in range(10):
        try:
            tx_data = server.transactions().transaction(tx_hash).call()
            if tx_data and tx_data.get('successful'):
                break
        except StellarNotFoundError:
            if attempt < 9:
                time.sleep(1.5)
                continue
            raise StellarVerificationError(
                f"Transaction {tx_hash} is still settling or indexing on Stellar Testnet Horizon. "
                "Please wait a moment and refresh."
            )
        except Exception as e:
            if attempt < 9:
                time.sleep(1.2)
                continue
            raise StellarVerificationError(f"Horizon API error while fetching transaction {tx_hash}: {str(e)}")

    if not tx_data or not tx_data.get('successful', False):
        raise StellarVerificationError(f"Transaction {tx_hash} failed on the Stellar ledger.")

    # Validate Memo if expected
    if expected_memo:
        actual_memo = tx_data.get('memo')
        if not actual_memo or str(actual_memo).strip() != str(expected_memo).strip():
            logger.warning("Memo mismatch: expected '%s', found '%s'", expected_memo, actual_memo)

    payment_found = False
    paid_amount = Decimal('0.00')
    paid_asset_code = expected_asset_code
    source_account = tx_data.get('source_account')

    # STEP 1: Direct Envelope parsing from tx_data (instant, zero ingestion lag)
    envelope_xdr = tx_data.get('envelope_xdr')
    if envelope_xdr:
        try:
            network_passphrase = getattr(
                settings,
                'STELLAR_NETWORK_PASSPHRASE',
                getattr(settings, 'STELLAR_PASSPHRASE', 'Test SDF Network ; September 2015')
            )
            env = TransactionEnvelope.from_xdr(envelope_xdr, network_passphrase)
            source_account = getattr(env.transaction.source, 'account_id', str(env.transaction.source))
            for op in env.transaction.operations:
                op_type = type(op).__name__
                if op_type == 'Payment':
                    op_dest = getattr(op.destination, 'account_id', str(op.destination))
                    op_amount = Decimal(str(op.amount))
                    op_asset_code = 'XLM' if op.asset.is_native() else op.asset.code
                    op_issuer = None if op.asset.is_native() else op.asset.issuer

                    destination_matches = (op_dest == expected_destination)
                    asset_matches = (op_asset_code == expected_asset_code)
                    if expected_asset_code != 'XLM' and expected_asset_issuer:
                        issuer_matches = (op_issuer == expected_asset_issuer)
                    else:
                        issuer_matches = True

                    if destination_matches and asset_matches and issuer_matches:
                        if op_amount >= expected_amount:
                            payment_found = True
                            paid_amount = op_amount
                            paid_asset_code = op_asset_code
                            break
                elif op_type == 'CreateAccount':
                    op_dest = getattr(op.destination, 'account_id', str(op.destination))
                    op_amount = Decimal(str(op.starting_balance))
                    if op_dest == expected_destination and expected_asset_code == 'XLM':
                        if op_amount >= expected_amount:
                            payment_found = True
                            paid_amount = op_amount
                            paid_asset_code = 'XLM'
                            break
        except Exception as env_err:
            logger.warning("Could not parse envelope_xdr directly in verify: %s", env_err)

    # STEP 2: Fallback to Horizon operations endpoint if not confirmed via envelope
    if not payment_found:
        records = []
        for op_attempt in range(4):
            try:
                ops_data = server.operations().for_transaction(tx_hash).call()
                records = ops_data.get('_embedded', {}).get('records', [])
                if records:
                    break
            except Exception:
                pass
            if op_attempt < 3:
                time.sleep(1.0)

        for op in records:
            op_type = op.get('type')
            if op_type in ('payment', 'create_account'):
                if op_type == 'payment':
                    to_addr = op.get('to')
                    amount = Decimal(str(op.get('amount', '0')))
                    asset_type = op.get('asset_type')
                    op_asset_code = 'XLM' if asset_type == 'native' else op.get('asset_code')
                    op_issuer = op.get('asset_issuer')

                    destination_matches = (to_addr == expected_destination)
                    asset_matches = (op_asset_code == expected_asset_code)
                    if expected_asset_code != 'XLM' and expected_asset_issuer:
                        issuer_matches = (op_issuer == expected_asset_issuer)
                    else:
                        issuer_matches = True

                    if destination_matches and asset_matches and issuer_matches:
                        if amount >= expected_amount:
                            payment_found = True
                            paid_amount = amount
                            paid_asset_code = op_asset_code
                            break
                elif op_type == 'create_account':
                    account_created = op.get('account')
                    starting_balance = Decimal(str(op.get('starting_balance', '0')))
                    if account_created == expected_destination and expected_asset_code == 'XLM':
                        if starting_balance >= expected_amount:
                            payment_found = True
                            paid_amount = starting_balance
                            paid_asset_code = 'XLM'
                            break

    if not payment_found:
        raise StellarVerificationError(
            f"No matching payment of >= {expected_amount} {expected_asset_code} to {expected_destination} "
            f"found inside transaction {tx_hash}."
        )

    fee_stroops = tx_data.get('fee_charged', 100)
    fee_in_xlm = Decimal(str(fee_stroops)) / Decimal('10000000')

    return {
        'tx_hash': tx_hash,
        'ledger': tx_data.get('ledger'),
        'source_account': source_account,
        'fee_charged': fee_in_xlm,
        'created_at': tx_data.get('created_at'),
        'paid_amount': paid_amount,
        'asset_code': paid_asset_code,
        'destination': expected_destination,
        'explorer_url': get_stellar_expert_tx_url(tx_hash),
    }

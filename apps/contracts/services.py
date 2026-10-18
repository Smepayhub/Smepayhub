import zlib
from django.conf import settings
from rest_framework.exceptions import ValidationError
from apps.payments.models import PaymentRequest, PaymentStatus

def get_contract_metadata() -> dict:
    """Return Soroban contract identifier, methods, and EVM configuration."""
    return {
        'contract_name': 'SmehubPaymentRouter',
        'network': settings.STELLAR_NETWORK,
        'contract_id': settings.SOROBAN_CONTRACT_ID,
        'usdc_token_id': settings.USDC_ISSUER_ADDRESS,
        'methods': [
            {
                'name': 'initialize',
                'description': 'Initializes contract with admin, fee collector, and fee basis points',
                'parameters': ['admin: Address', 'fee_collector: Address', 'fee_bps: u32']
            },
            {
                'name': 'register_merchant',
                'description': 'Registers merchant business profile on Soroban ledger',
                'parameters': ['merchant: Address', 'business_name: Symbol']
            },
            {
                'name': 'create_invoice',
                'description': 'Creates an on-chain invoice with token, amount, and expiry',
                'parameters': ['merchant: Address', 'invoice_id: u64', 'token: Address', 'amount: i128', 'expiry: u64']
            },
            {
                'name': 'pay_invoice',
                'description': 'Transfers USDC/token to merchant and settles invoice',
                'parameters': ['payer: Address', 'invoice_id: u64']
            },
            {
                'name': 'cancel_invoice',
                'description': 'Merchant cancels an unpaid invoice',
                'parameters': ['merchant: Address', 'invoice_id: u64']
            },
            {
                'name': 'get_invoice',
                'description': 'Read invoice status and settlement details',
                'parameters': ['invoice_id: u64']
            }
        ],
        'evm_contract_available': True,
        'evm_contract_name': 'SmehubPaymentVault',
    }

def build_soroban_pay_invocation(payer_address: str, reference_id: str) -> dict:
    """Construct Soroban invocation payload for wallet signing."""
    try:
        req = PaymentRequest.objects.get(reference_id=reference_id)
    except PaymentRequest.DoesNotExist:
        raise ValidationError({"reference_id": f"Invoice '{reference_id}' not found."})

    if req.status != PaymentStatus.PENDING:
        raise ValidationError({"status": f"Invoice is already {req.status}."})

    # Numeric invoice ID derived deterministically from reference ID
    invoice_id = zlib.crc32(reference_id.encode('utf-8'))

    return {
        'contract_id': settings.SOROBAN_CONTRACT_ID,
        'method': 'pay_invoice',
        'args': {
            'payer': payer_address,
            'invoice_id': invoice_id,
            'merchant': req.destination_address,
            'amount': str(req.amount),
            'currency': req.currency,
        },
        'network_passphrase': settings.STELLAR_PASSPHRASE,
        'memo': req.memo,
    }

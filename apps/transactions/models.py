from django.db import models
from django.core.serializers.json import DjangoJSONEncoder
from apps.core.models import BaseModel
from apps.merchants.models import Merchant
from apps.payments.models import PaymentRequest

class TransactionStatus(models.TextChoices):
    SUCCESS = 'SUCCESS', 'Confirmed on Ledger'
    FAILED = 'FAILED', 'Failed on Ledger'
    PENDING_CONFIRMATION = 'PENDING_CONFIRMATION', 'Awaiting Ledger Ingestion'

class BlockchainTransaction(BaseModel):
    """Verified on-chain Stellar Testnet payment transaction."""
    payment_request = models.ForeignKey(PaymentRequest, on_delete=models.CASCADE, related_name='transactions')
    merchant = models.ForeignKey(Merchant, on_delete=models.CASCADE, related_name='transactions')
    tx_hash = models.CharField(max_length=64, unique=True, db_index=True, help_text="64-character Stellar transaction hash")
    source_account = models.CharField(max_length=56, blank=True, default='', help_text="Payer's Stellar account")
    destination_account = models.CharField(max_length=56, help_text="Merchant's receiving account")
    amount = models.DecimalField(max_digits=18, decimal_places=4)
    asset_code = models.CharField(max_length=10, default='USDC')
    asset_issuer = models.CharField(max_length=56, blank=True, null=True)
    memo = models.CharField(max_length=28, blank=True, default='')
    ledger = models.BigIntegerField(null=True, blank=True, help_text="Stellar ledger sequence number")
    fee_charged = models.BigIntegerField(null=True, blank=True, help_text="Fee paid in stroops")
    status = models.CharField(max_length=25, choices=TransactionStatus.choices, default=TransactionStatus.SUCCESS, db_index=True)
    stellar_expert_url = models.URLField(max_length=500, blank=True, default='')
    raw_response = models.JSONField(default=dict, blank=True, encoder=DjangoJSONEncoder)
    verified_at = models.DateTimeField(auto_now_add=True)

    class Meta(BaseModel.Meta):
        verbose_name = 'Blockchain Transaction'
        verbose_name_plural = 'Blockchain Transactions'

    def __str__(self):
        return f"Tx: {self.tx_hash[:12]}... - {self.amount} {self.asset_code} ({self.status})"

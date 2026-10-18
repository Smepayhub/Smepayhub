import re
from rest_framework import serializers
from apps.transactions.models import BlockchainTransaction

class TransactionSubmitSerializer(serializers.Serializer):
    tx_hash = serializers.CharField(
        min_length=64,
        max_length=64,
        help_text="64-character hexadecimal Stellar Testnet transaction hash"
    )

    def validate_tx_hash(self, value):
        cleaned = value.strip().lower()
        if not re.match(r'^[0-9a-f]{64}$', cleaned):
            raise serializers.ValidationError("Transaction hash must be a valid 64-character lowercase hexadecimal string.")
        return cleaned

class TransactionSerializer(serializers.ModelSerializer):
    merchant_business_name = serializers.CharField(source='merchant.business_name', read_only=True)
    reference_id = serializers.CharField(source='payment_request.reference_id', read_only=True)

    class Meta:
        model = BlockchainTransaction
        fields = [
            'id', 'reference_id', 'merchant_business_name', 'tx_hash',
            'source_account', 'destination_account', 'amount',
            'asset_code', 'asset_issuer', 'memo', 'ledger',
            'fee_charged', 'status', 'stellar_expert_url',
            'verified_at', 'created_at'
        ]
        read_only_fields = fields

class PaymentStatusPollSerializer(serializers.Serializer):
    reference_id = serializers.CharField()
    status = serializers.CharField()
    is_completed = serializers.BooleanField()
    is_expired = serializers.BooleanField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=4)
    currency = serializers.CharField()
    tx_hash = serializers.CharField(allow_null=True)
    stellar_expert_url = serializers.CharField(allow_null=True)
    paid_at = serializers.DateTimeField(allow_null=True)


class TransactionPrepareSerializer(serializers.Serializer):
    payer_address = serializers.CharField(
        min_length=56,
        max_length=56,
        help_text="Stellar public key of payer account (starts with G, 56 chars)"
    )
    currency = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_payer_address(self, value):
        from apps.core.stellar import is_valid_stellar_public_key
        cleaned = value.strip()
        if not is_valid_stellar_public_key(cleaned):
            raise serializers.ValidationError("Invalid Stellar public key format. Must start with G and be 56 characters.")
        return cleaned


class TransactionBroadcastSerializer(serializers.Serializer):
    signed_xdr = serializers.CharField(
        min_length=10,
        help_text="Base64-encoded signed Stellar transaction envelope XDR"
    )


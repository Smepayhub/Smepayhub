from decimal import Decimal
from rest_framework import serializers
from apps.payments.models import PaymentRequest, PaymentStatus, PaymentAsset
from apps.merchants.serializers import MerchantProfileSerializer

class PaymentRequestCreateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=4,
        min_value=Decimal('0.01'),
        required=False,
        allow_null=True,
        help_text="Payment amount in selected currency (or calculated from orders)"
    )
    currency = serializers.ChoiceField(
        choices=PaymentAsset.choices,
        default=PaymentAsset.USDC,
        required=False,
        help_text="Payment currency: USDC (Stellar Testnet) or XLM (Native)"
    )
    order_reference = serializers.CharField(
        max_length=32,
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Merchant order reference (auto-generated if omitted)"
    )
    orders = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
        help_text="Itemized order choices with item name, unit price, quantity, and total"
    )
    title = serializers.CharField(
        max_length=255,
        default='Payment Request',
        required=False,
        allow_blank=True,
        help_text="Short title or invoice identifier"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        help_text="Optional description of goods or service"
    )
    customer_name = serializers.CharField(
        required=False,
        allow_blank=True,
        default='',
        help_text="Customer name (optional)"
    )
    customer_email = serializers.EmailField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Customer email for receipt (optional)"
    )
    destination_address = serializers.CharField(
        max_length=56,
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Stellar destination public key (optional, auto-links merchant wallet)"
    )
    expires_in_minutes = serializers.IntegerField(
        default=60,
        min_value=5,
        max_value=10080, # 7 days
        required=False,
        help_text="Expiration window in minutes (default 60 minutes)"
    )

    def validate(self, attrs):
        amount = attrs.get('amount')
        orders = attrs.get('orders', [])
        if not amount and not orders:
            raise serializers.ValidationError("Either a payment amount or at least one order choice must be provided.")
        if not attrs.get('customer_email'):
            attrs['customer_email'] = None
        if not attrs.get('title'):
            attrs['title'] = 'Payment Request'
        return attrs

class PaymentRequestUpdateSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=18,
        decimal_places=4,
        min_value=Decimal('0.01'),
        required=False,
        help_text="Updated payment amount"
    )
    currency = serializers.ChoiceField(
        choices=PaymentAsset.choices,
        required=False,
        help_text="Updated payment currency: USDC or XLM"
    )
    order_reference = serializers.CharField(
        max_length=32,
        required=False,
        allow_blank=True,
        help_text="Updated order reference"
    )
    orders = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        help_text="Updated list of order choices"
    )
    title = serializers.CharField(
        max_length=255,
        required=False,
        help_text="Updated title or invoice identifier"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Updated description"
    )
    customer_name = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Updated customer name"
    )
    customer_email = serializers.EmailField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Updated customer email"
    )
    status = serializers.ChoiceField(
        choices=PaymentStatus.choices,
        required=False,
        help_text="Updated status: PENDING, COMPLETED, EXPIRED, CANCELLED, FAILED"
    )
    expires_in_minutes = serializers.IntegerField(
        min_value=5,
        max_value=10080,
        required=False,
        help_text="Extend expiration by minutes from now"
    )

class PaymentRequestDetailSerializer(serializers.ModelSerializer):
    merchant_business_name = serializers.CharField(source='merchant.business_name', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = PaymentRequest
        fields = [
            'id', 'reference_id', 'order_reference', 'orders', 'memo', 'amount', 'currency',
            'asset_issuer', 'destination_address', 'status', 'title',
            'description', 'customer_name', 'customer_email',
            'sep0007_uri', 'checkout_url', 'qr_code_base64',
            'expires_at', 'paid_at', 'created_at', 'updated_at',
            'merchant_business_name', 'is_expired'
        ]
        read_only_fields = fields

class PublicCheckoutSerializer(serializers.ModelSerializer):
    """Public customer checkout view model: safe customer-facing details."""
    merchant_name = serializers.CharField(source='merchant.business_name', read_only=True)
    merchant_email = serializers.EmailField(source='merchant.business_email', read_only=True)
    merchant_support_email = serializers.EmailField(source='merchant.support_email', read_only=True)
    merchant_description = serializers.CharField(source='merchant.description', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = PaymentRequest
        fields = [
            'reference_id', 'order_reference', 'orders', 'memo', 'amount', 'currency',
            'asset_issuer', 'destination_address', 'status', 'title',
            'description', 'customer_name', 'sep0007_uri',
            'checkout_url', 'qr_code_base64', 'expires_at',
            'paid_at', 'merchant_name', 'merchant_email', 'merchant_support_email',
            'merchant_description', 'is_expired'
        ]
        read_only_fields = fields

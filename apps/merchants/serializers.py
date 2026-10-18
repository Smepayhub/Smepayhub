from rest_framework import serializers
from django.contrib.auth.models import User
from apps.core.stellar import is_valid_stellar_public_key, fetch_stellar_account_balances
from apps.merchants.models import Merchant, MerchantWallet, BusinessCategory, normalize_business_category

class FlexibleCategoryField(serializers.CharField):
    """Field that accepts category codes, labels, or aliases and normalizes to a valid BusinessCategory."""
    def __init__(self, **kwargs):
        kwargs.setdefault('default', BusinessCategory.OTHER)
        kwargs.setdefault('required', False)
        kwargs.setdefault('help_text', f"Business category choices: {', '.join(BusinessCategory.values)}")
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        return normalize_business_category(data)

class MerchantWalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = MerchantWallet
        fields = [
            'id', 'public_key', 'wallet_provider', 'network',
            'is_verified', 'verified_at', 'last_synced_at', 'created_at'
        ]
        read_only_fields = ['id', 'is_verified', 'verified_at', 'last_synced_at', 'created_at']

class MerchantWalletConnectSerializer(serializers.Serializer):
    public_key = serializers.CharField(
        max_length=56,
        help_text="Stellar Testnet 56-character public key (starts with 'G')"
    )
    wallet_provider = serializers.CharField(
        max_length=50,
        default='Freighter',
        required=False,
        help_text="Name of non-custodial wallet provider, e.g. Freighter, Lobstr, Albedo"
    )

    def validate_public_key(self, value):
        cleaned = value.strip()
        if not is_valid_stellar_public_key(cleaned):
            raise serializers.ValidationError("Invalid Stellar public key format. Must be an Ed25519 public key starting with 'G'.")
        return cleaned

class MerchantProfileSerializer(serializers.ModelSerializer):
    wallet = MerchantWalletSerializer(read_only=True)
    category = FlexibleCategoryField(required=False, default=BusinessCategory.OTHER)

    class Meta:
        model = Merchant
        fields = [
            'id', 'business_name', 'business_email', 'category',
            'description', 'support_email', 'phone_number',
            'website_url', 'webhook_url', 'api_key', 'is_active',
            'wallet', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'api_key', 'wallet', 'created_at', 'updated_at']

class MerchantRegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    business_name = serializers.CharField(max_length=255)
    category = FlexibleCategoryField(required=False, default=BusinessCategory.OTHER)
    description = serializers.CharField(required=False, allow_blank=True, default='')
    phone_number = serializers.CharField(required=False, allow_blank=True, default='')
    stellar_public_key = serializers.CharField(required=False, allow_blank=True, max_length=56)
    wallet_provider = serializers.CharField(required=False, default='Freighter')

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists() or Merchant.objects.filter(business_email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email address already exists.")
        return value.lower()

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_stellar_public_key(self, value):
        if value:
            cleaned = value.strip()
            if not is_valid_stellar_public_key(cleaned):
                raise serializers.ValidationError("Invalid Stellar public key format.")
            return cleaned
        return value

class MerchantLoginSerializer(serializers.Serializer):
    username = serializers.CharField(help_text="Username or registered email")
    password = serializers.CharField(write_only=True)

class MerchantWalletLiveInfoSerializer(serializers.Serializer):
    public_key = serializers.CharField()
    network = serializers.CharField()
    wallet_provider = serializers.CharField()
    is_funded = serializers.BooleanField()
    xlm_balance = serializers.DecimalField(max_digits=20, decimal_places=7)
    usdc_balance = serializers.DecimalField(max_digits=20, decimal_places=7)
    balances = serializers.ListField(child=serializers.DictField())

class MerchantWalletAuthSerializer(serializers.Serializer):
    public_key = serializers.CharField(
        max_length=56,
        help_text="Stellar Testnet 56-character Ed25519 public key (starts with 'G')"
    )
    wallet_provider = serializers.CharField(
        max_length=50,
        default='Freighter',
        required=False,
        help_text="Name of wallet provider (Freighter, Albedo, Lobstr, TestnetKeypair)"
    )
    auto_register = serializers.BooleanField(
        default=False,
        required=False,
        help_text="If true and no merchant profile exists, auto-registers a profile skipping form fields"
    )

    def validate_public_key(self, value):
        cleaned = value.strip()
        if not is_valid_stellar_public_key(cleaned):
            raise serializers.ValidationError("Invalid Stellar public key format. Must be an Ed25519 public key starting with 'G'.")
        return cleaned


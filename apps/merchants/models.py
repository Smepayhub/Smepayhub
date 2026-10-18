import secrets
from django.db import models
from django.contrib.auth.models import User
from apps.core.models import BaseModel

class BusinessCategory(models.TextChoices):
    RETAIL = 'RETAIL', 'Retail & E-commerce'
    SERVICES = 'SERVICES', 'Professional Services'
    DIGITAL = 'DIGITAL', 'Digital Goods & Software'
    FOOD_BEV = 'FOOD_BEV', 'Food & Beverage'
    TECH = 'TECH', 'Technology & SaaS'
    OTHER = 'OTHER', 'Other'

def normalize_business_category(value: str) -> str:
    """
    Normalizes any category input (choice key, human label, or common alias)
    to a valid BusinessCategory key.
    """
    if not value or not isinstance(value, str):
        return BusinessCategory.OTHER

    val = value.strip().upper()
    if val in BusinessCategory.values:
        return val

    normalized = value.strip().lower()
    mapping = {
        'retail': BusinessCategory.RETAIL,
        'retail & e-commerce': BusinessCategory.RETAIL,
        'retail and e-commerce': BusinessCategory.RETAIL,
        'ecommerce': BusinessCategory.RETAIL,
        'e-commerce': BusinessCategory.RETAIL,
        'shop': BusinessCategory.RETAIL,
        'store': BusinessCategory.RETAIL,

        'services': BusinessCategory.SERVICES,
        'professional services': BusinessCategory.SERVICES,
        'freelance & agency': BusinessCategory.SERVICES,
        'freelance and agency': BusinessCategory.SERVICES,
        'freelance': BusinessCategory.SERVICES,
        'agency': BusinessCategory.SERVICES,
        'consulting': BusinessCategory.SERVICES,

        'digital': BusinessCategory.DIGITAL,
        'digital goods & software': BusinessCategory.DIGITAL,
        'digital goods': BusinessCategory.DIGITAL,

        'food_bev': BusinessCategory.FOOD_BEV,
        'food & beverage': BusinessCategory.FOOD_BEV,
        'food and beverage': BusinessCategory.FOOD_BEV,
        'bakery & food': BusinessCategory.FOOD_BEV,
        'bakery and food': BusinessCategory.FOOD_BEV,
        'bakery': BusinessCategory.FOOD_BEV,
        'food': BusinessCategory.FOOD_BEV,
        'hospitality': BusinessCategory.FOOD_BEV,
        'restaurant': BusinessCategory.FOOD_BEV,
        'cafe': BusinessCategory.FOOD_BEV,

        'tech': BusinessCategory.TECH,
        'technology & saas': BusinessCategory.TECH,
        'technology & web3': BusinessCategory.TECH,
        'technology and saas': BusinessCategory.TECH,
        'technology and web3': BusinessCategory.TECH,
        'technology': BusinessCategory.TECH,
        'saas': BusinessCategory.TECH,
        'web3': BusinessCategory.TECH,

        'other': BusinessCategory.OTHER,
    }

    if normalized in mapping:
        return mapping[normalized]

    for key, mapped in mapping.items():
        if key in normalized or normalized in key:
            return mapped

    return BusinessCategory.OTHER

class Merchant(BaseModel):
    """Business profile representing an SME merchant on SMEHUB."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='merchant_profile')
    business_name = models.CharField(max_length=255, db_index=True)
    business_email = models.EmailField(unique=True, db_index=True)
    category = models.CharField(max_length=50, choices=BusinessCategory.choices, default=BusinessCategory.OTHER)
    description = models.TextField(blank=True, default='')
    support_email = models.EmailField(blank=True, null=True)
    phone_number = models.CharField(max_length=50, blank=True, default='')
    website_url = models.URLField(blank=True, null=True)
    webhook_url = models.URLField(blank=True, null=True, help_text="Webhook endpoint to receive transaction notifications")
    api_key = models.CharField(max_length=64, unique=True, db_index=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta(BaseModel.Meta):
        verbose_name = 'Merchant'
        verbose_name_plural = 'Merchants'

    def save(self, *args, **kwargs):
        if not self.api_key:
            self.api_key = f"sme_{secrets.token_hex(24)}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.business_name} ({self.business_email})"

class MerchantWallet(BaseModel):
    """Connected Stellar non-custodial wallet for a merchant."""
    merchant = models.OneToOneField(Merchant, on_delete=models.CASCADE, related_name='wallet')
    public_key = models.CharField(max_length=56, unique=True, db_index=True, help_text="Stellar G... public key")
    wallet_provider = models.CharField(max_length=50, default='Freighter', help_text="e.g. Freighter, Albedo, Lobstr, Custom")
    network = models.CharField(max_length=20, default='TESTNET')
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)

    class Meta(BaseModel.Meta):
        verbose_name = 'Merchant Wallet'
        verbose_name_plural = 'Merchant Wallets'

    def __str__(self):
        return f"{self.merchant.business_name} - {self.public_key[:8]}...{self.public_key[-6:]}"

import secrets
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token
from apps.core.stellar import fetch_stellar_account_balances
from apps.merchants.models import Merchant, MerchantWallet

@transaction.atomic
def register_merchant_service(data: dict) -> dict:
    """
    Service to register a new user, create a Merchant profile,
    provision an auth token, and optionally connect a Stellar wallet.
    """
    username = data['username']
    email = data['email']
    password = data['password']
    business_name = data['business_name']
    category = data.get('category', 'OTHER')
    description = data.get('description', '')
    phone_number = data.get('phone_number', '')
    stellar_public_key = data.get('stellar_public_key')
    wallet_provider = data.get('wallet_provider', 'Freighter')

    # Create Django User
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password
    )

    # Create Merchant Profile
    merchant = Merchant.objects.create(
        user=user,
        business_name=business_name,
        business_email=email,
        category=category,
        description=description,
        phone_number=phone_number,
    )

    # Auth Token
    token, _ = Token.objects.get_or_create(user=user)

    # Optional initial wallet connection
    wallet_data = None
    if stellar_public_key:
        wallet, _ = MerchantWallet.objects.update_or_create(
            merchant=merchant,
            defaults={
                'public_key': stellar_public_key,
                'wallet_provider': wallet_provider,
                'last_synced_at': timezone.now(),
            }
        )
        wallet_data = {
            'public_key': wallet.public_key,
            'wallet_provider': wallet.wallet_provider,
            'network': wallet.network,
        }

    return {
        'merchant': merchant,
        'user': user,
        'token': token.key,
        'wallet': wallet_data,
    }

def connect_or_update_wallet_service(merchant: Merchant, public_key: str, wallet_provider: str = 'Freighter') -> MerchantWallet:
    """Connect or update a merchant's non-custodial Stellar Testnet wallet."""
    # Check if another merchant has this wallet
    existing = MerchantWallet.objects.filter(public_key=public_key).exclude(merchant=merchant).first()
    if existing:
        raise ValueError(f"Wallet address {public_key} is already associated with another merchant profile.")

    # Check live Stellar network status
    balance_info = fetch_stellar_account_balances(public_key)
    is_funded = balance_info.get('is_funded', False)

    wallet, created = MerchantWallet.objects.update_or_create(
        merchant=merchant,
        defaults={
            'public_key': public_key,
            'wallet_provider': wallet_provider,
            'is_verified': is_funded,
            'verified_at': timezone.now() if is_funded else None,
            'last_synced_at': timezone.now(),
        }
    )
    return wallet

def get_merchant_wallet_live_info_service(merchant: Merchant) -> dict:
    """Fetch live wallet balances and on-chain status from Stellar Horizon."""
    wallet = getattr(merchant, 'wallet', None)
    if not wallet:
        return {
            'has_wallet': False,
            'message': 'No Stellar wallet connected. Please connect your Stellar Testnet wallet.',
            'public_key': None,
            'xlm_balance': Decimal('0.00'),
            'usdc_balance': Decimal('0.00'),
            'balances': [],
            'is_funded': False,
        }

    live_data = fetch_stellar_account_balances(wallet.public_key)

    # Update verification status if newly funded
    if live_data.get('is_funded') and not wallet.is_verified:
        wallet.is_verified = True
        wallet.verified_at = timezone.now()
        wallet.last_synced_at = timezone.now()
        wallet.save(update_fields=['is_verified', 'verified_at', 'last_synced_at'])

    return {
        'has_wallet': True,
        'public_key': wallet.public_key,
        'wallet_provider': wallet.wallet_provider,
        'network': wallet.network,
        'is_verified': wallet.is_verified,
        'is_funded': live_data.get('is_funded', False),
        'xlm_balance': live_data.get('xlm_balance', Decimal('0.00')),
        'usdc_balance': live_data.get('usdc_balance', Decimal('0.00')),
        'balances': live_data.get('balances', []),
        'last_synced_at': wallet.last_synced_at,
    }

def refresh_merchant_api_key_service(merchant: Merchant) -> str:
    """Regenerate API key for merchant integration."""
    merchant.api_key = f"sme_{secrets.token_hex(24)}"
    merchant.save(update_fields=['api_key'])
    return merchant.api_key

@transaction.atomic
def wallet_auth_service(public_key: str, wallet_provider: str = 'Freighter', auto_register: bool = False) -> dict:
    """
    Authenticate or register a merchant via their Stellar Testnet wallet.
    Skips form filling when auto_register is True or during wallet-based onboarding.
    """
    existing_wallet = MerchantWallet.objects.filter(public_key=public_key).select_related('merchant__user').first()
    if existing_wallet:
        merchant = existing_wallet.merchant
        user = merchant.user
        token, _ = Token.objects.get_or_create(user=user)
        return {
            'merchant': merchant,
            'token': token.key,
            'is_new': False,
        }

    if not auto_register:
        raise ValueError("No merchant account found for this Stellar wallet. Please sign up to create your account.")

    # Auto-register: create username, merchant profile, and connect wallet without requiring form filling
    short_key = f"{public_key[:4]}...{public_key[-4:]}"
    base_username = f"stellar_{public_key[:8].lower()}"
    username = base_username
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f"{base_username}_{counter}"
        counter += 1

    email = f"{username}@stellar.smehub.app"
    random_password = secrets.token_urlsafe(24)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=random_password
    )

    merchant = Merchant.objects.create(
        user=user,
        business_name=f"Merchant {short_key}",
        business_email=email,
        category='OTHER',
        description='Stellar merchant profile created via wallet connect.',
    )

    # Connect wallet
    balance_info = fetch_stellar_account_balances(public_key)
    is_funded = balance_info.get('is_funded', False)

    MerchantWallet.objects.create(
        merchant=merchant,
        public_key=public_key,
        wallet_provider=wallet_provider,
        is_verified=is_funded,
        verified_at=timezone.now() if is_funded else None,
        last_synced_at=timezone.now(),
    )

    token, _ = Token.objects.get_or_create(user=user)

    return {
        'merchant': merchant,
        'token': token.key,
        'is_new': True,
    }


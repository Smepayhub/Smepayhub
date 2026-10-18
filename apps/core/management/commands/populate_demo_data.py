from decimal import Decimal
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.authtoken.models import Token
from apps.core.stellar import generate_sep0007_pay_uri, get_stellar_expert_tx_url
from apps.core.qr import generate_qr_code_base64
from apps.merchants.models import Merchant, MerchantWallet, BusinessCategory
from apps.payments.models import PaymentRequest, PaymentStatus, PaymentAsset
from apps.transactions.models import BlockchainTransaction, TransactionStatus

DEMO_PUBKEY = "GARABOLJC3MOQSTH6TFDGMPPNT7A55UISXTC5LMHT7M5NICWDE3M2SWK"
USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

class Command(BaseCommand):
    help = "Populate the database with realistic demo merchant, payment requests, and verified Stellar transactions."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-requests",
            action="store_true",
            help="Generate sample payment requests (disabled by default).",
        )

    def handle(self, *args, **options):
        with_requests = options.get("with_requests", False)
        self.stdout.write(self.style.NOTICE("Populating SMEHUB database merchant profile..."))

        # 1. Create or get Demo User
        user, created = User.objects.get_or_create(
            username="adaeze",
            defaults={
                "email": "bakery@adaeze.com",
                "first_name": "Adaeze",
                "last_name": "Bakery",
            }
        )
        user.set_password("Password123!")
        user.save()

        # Auth Token - Deterministic demo token for instant frontend evaluation
        token = Token.objects.filter(user=user).first()
        if not token:
            token = Token.objects.create(user=user, key="fc00a86cbaad0bd826fe67c7be00f5f24508222e")

        # 2. Create or update Merchant profile
        merchant, _ = Merchant.objects.update_or_create(
            user=user,
            defaults={
                "business_name": "Adaeze Bakery",
                "business_email": "bakery@adaeze.com",
                "category": BusinessCategory.FOOD_BEV,
                "description": "Artisan sourdough, custom event cakes, and pastries in Tokyo.",
                "support_email": "support@adaeze.com",
                "phone_number": "+81-3-5555-0199",
                "website_url": "https://adaeze-bakery.example.com",
                "is_active": True,
            }
        )

        # 3. Connect Stellar Wallet
        wallet, _ = MerchantWallet.objects.update_or_create(
            merchant=merchant,
            defaults={
                "public_key": DEMO_PUBKEY,
                "wallet_provider": "Freighter",
                "network": "TESTNET",
                "is_verified": True,
                "verified_at": timezone.now(),
                "last_synced_at": timezone.now(),
            }
        )

        self.stdout.write(self.style.SUCCESS(f"Merchant '{merchant.business_name}' ready. Token: {token.key}"))

        if not with_requests:
            self.stdout.write(self.style.SUCCESS("Demo merchant setup complete. No payment requests generated (only generated on merchant submit)."))
            return

        # Helper to create request and transaction
        def create_entry(
            ref_id, memo, title, amount, currency, status, customer_name, customer_email,
            days_ago=1, tx_hash=None, ledger=None
        ):
            created_at = timezone.now() - timedelta(days=days_ago)
            expires_at = created_at + timedelta(hours=2)
            paid_at = created_at + timedelta(minutes=12) if status == PaymentStatus.COMPLETED else None

            sep0007 = generate_sep0007_pay_uri(
                destination=DEMO_PUBKEY,
                amount=Decimal(str(amount)),
                asset_code=currency,
                asset_issuer=USDC_ISSUER if currency == 'USDC' else None,
                memo=memo,
            )
            qr_base64 = generate_qr_code_base64(sep0007)
            checkout_url = f"http://localhost:3000/#/checkout/{ref_id}"
            order_ref = f"ORD-{ref_id.replace('SME-', '')}"

            # Create realistic multi-item order choices
            half_price = float(round(Decimal(str(amount)) / Decimal(2), 2))
            remainder = float(round(Decimal(str(amount)) - Decimal(str(half_price)), 2))
            demo_orders = [
                {
                    "id": f"item-1-{ref_id[-4:].lower()}",
                    "name": f"{title} Choice A",
                    "price": half_price,
                    "quantity": 1,
                    "total": half_price,
                },
                {
                    "id": f"item-2-{ref_id[-4:].lower()}",
                    "name": f"{title} Choice B",
                    "price": remainder,
                    "quantity": 1,
                    "total": remainder,
                }
            ]

            req, _ = PaymentRequest.objects.update_or_create(
                reference_id=ref_id,
                defaults={
                    "merchant": merchant,
                    "order_reference": order_ref,
                    "orders": demo_orders,
                    "memo": memo,
                    "amount": Decimal(str(amount)),
                    "currency": currency,
                    "asset_issuer": USDC_ISSUER if currency == 'USDC' else None,
                    "destination_address": DEMO_PUBKEY,
                    "status": status,
                    "title": title,
                    "description": f"Customer order: {title}",
                    "customer_name": customer_name,
                    "customer_email": customer_email,
                    "sep0007_uri": sep0007,
                    "checkout_url": checkout_url,
                    "qr_code_base64": qr_base64,
                    "expires_at": expires_at,
                    "paid_at": paid_at,
                }
            )
            PaymentRequest.objects.filter(id=req.id).update(created_at=created_at)

            if status == PaymentStatus.COMPLETED and tx_hash:
                BlockchainTransaction.objects.update_or_create(
                    tx_hash=tx_hash,
                    defaults={
                        "payment_request": req,
                        "merchant": merchant,
                        "source_account": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
                        "destination_account": DEMO_PUBKEY,
                        "amount": Decimal(str(amount)),
                        "asset_code": currency,
                        "asset_issuer": USDC_ISSUER if currency == 'USDC' else None,
                        "memo": memo,
                        "ledger": ledger or 1428570,
                        "fee_charged": 100,
                        "status": TransactionStatus.SUCCESS,
                        "stellar_expert_url": get_stellar_expert_tx_url(tx_hash),
                        "raw_response": {
                            "status": "success",
                            "ledger": ledger or 1428570,
                            "tx_hash": tx_hash,
                            "amount": str(amount),
                            "asset": currency,
                        },
                    }
                )

        # 4. Create populated payment requests & transactions
        create_entry(
            ref_id="SME-1024",
            memo="SME_1024_cake",
            title="Birthday Cake - Chocolate Ganache",
            amount="10.2400",
            currency="USDC",
            status=PaymentStatus.COMPLETED,
            customer_name="Chioma Adeyemi",
            customer_email="chioma@example.com",
            days_ago=4,
            tx_hash="8f3a7c0e2b9d41f6a5e0c83b7d12f94ce6a0b5d8c2e17f3a9b4c6d0e21c21d01",
            ledger=1428571,
        )

        create_entry(
            ref_id="SME-2024",
            memo="SME_2024_pastry",
            title="Custom Pastries Box (Catering)",
            amount="42.0000",
            currency="USDC",
            status=PaymentStatus.COMPLETED,
            customer_name="Emmanuel Okafor",
            customer_email="emmanuel@example.com",
            days_ago=3,
            tx_hash="3c1e9a7d2b8f40e5a6f1d72c8e31a95be7b0c6e9d3f28a4b0c5e1f2a34d56e02",
            ledger=1428585,
        )

        create_entry(
            ref_id="SME-3024",
            memo="SME_3024_bread",
            title="Assorted Sourdough Bread Box",
            amount="11.2400",
            currency="USDC",
            status=PaymentStatus.COMPLETED,
            customer_name="Emma Watson",
            customer_email="emma@example.com",
            days_ago=2,
            tx_hash="a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef",
            ledger=1428610,
        )

        create_entry(
            ref_id="SME-3025",
            memo="SME_3025_catering",
            title="Weekend Corporate Catering Deposit",
            amount="85.0000",
            currency="XLM",
            status=PaymentStatus.COMPLETED,
            customer_name="Tunde Bakare",
            customer_email="tunde@example.com",
            days_ago=1,
            tx_hash="f0e1d2c3b4a5968778695a4b3c2d1e0f0123456789abcdef0123456789abcdef",
            ledger=1428655,
        )

        # Pending Payment Request for Checkout Demonstration
        create_entry(
            ref_id="SME-1043",
            memo="SME_1043_tasting",
            title="Wedding Cake Tasting Set",
            amount="25.0000",
            currency="USDC",
            status=PaymentStatus.PENDING,
            customer_name="Emeka Eze",
            customer_email="emeka@example.com",
            days_ago=0,
        )

        create_entry(
            ref_id="SME-1044",
            memo="SME_1044_croissant",
            title="Morning Artisanal Croissant Bundle",
            amount="18.5000",
            currency="USDC",
            status=PaymentStatus.PENDING,
            customer_name="Sarah Jenkins",
            customer_email="sarah@example.com",
            days_ago=0,
        )

        create_entry(
            ref_id="SME-1010",
            memo="SME_1010_event",
            title="Bulk Bakery Order",
            amount="112.0000",
            currency="USDC",
            status=PaymentStatus.EXPIRED,
            customer_name="Klaus Schmidt",
            customer_email="klaus@example.com",
            days_ago=5,
        )

        create_entry(
            ref_id="SME-1015",
            memo="SME_1015_cancelled",
            title="Reserved Sourdough Batch",
            amount="35.0000",
            currency="USDC",
            status=PaymentStatus.CANCELLED,
            customer_name="Elena Rostova",
            customer_email="elena@example.com",
            days_ago=6,
        )

        create_entry(
            ref_id="SME-1020",
            memo="SME_1020_party",
            title="Birthday Party Cupcakes (Pack of 24)",
            amount="28.5000",
            currency="USDC",
            status=PaymentStatus.COMPLETED,
            customer_name="Kenji Sato",
            customer_email="kenji@example.com",
            days_ago=5,
            tx_hash="d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef123456",
            ledger=1428510,
        )

        create_entry(
            ref_id="SME-1021",
            memo="SME_1021_workshop",
            title="Baking Masterclass Registration",
            amount="65.0000",
            currency="USDC",
            status=PaymentStatus.COMPLETED,
            customer_name="Amara Diallo",
            customer_email="amara@example.com",
            days_ago=6,
            tx_hash="7890abcdef1234567890abcdef123456d4e5f60718293a4b5c6d7e8f90123456",
            ledger=1428480,
        )

        self.stdout.write(self.style.SUCCESS("Demo database successfully populated with 8 realistic orders and verified Stellar transactions!"))

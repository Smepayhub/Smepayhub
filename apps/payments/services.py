import secrets
from datetime import timedelta
from decimal import Decimal
from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from apps.core.stellar import generate_sep0007_pay_uri
from apps.core.qr import generate_qr_code_base64
from apps.merchants.models import Merchant
from apps.payments.models import PaymentRequest, PaymentStatus, PaymentAsset

def generate_unique_reference_id() -> str:
    """Generate a clean, collision-free customer reference ID."""
    token = secrets.token_hex(4).upper()
    return f"SME-{token}"

def generate_unique_order_reference() -> str:
    """Generate an auto-generated unique merchant order reference (e.g. ORD-XXXXXX)."""
    token = secrets.token_hex(4).upper()
    return f"ORD-{token}"

def normalize_order_items(items) -> list:
    """
    Validates and normalizes multiple order choices/items into a JSON-serializable list.
    Each item contains: id, name, price, quantity, total.
    """
    if not items or not isinstance(items, list):
        return []
    normalized = []
    for idx, it in enumerate(items):
        if not isinstance(it, dict):
            continue
        name = str(it.get('name') or it.get('title') or f"Item {idx + 1}").strip()
        try:
            qty = max(1, int(it.get('quantity') or 1))
        except (ValueError, TypeError):
            qty = 1
        try:
            price = Decimal(str(it.get('price') or 0.00))
        except Exception:
            price = Decimal('0.00')
        total = round(price * Decimal(qty), 2)
        item_id = str(it.get('id') or f"item-{idx + 1}-{secrets.token_hex(2)}")
        normalized.append({
            'id': item_id,
            'name': name,
            'price': float(price),
            'quantity': qty,
            'total': float(total)
        })
    return normalized

def generate_unique_memo() -> str:
    """Generate a Stellar-compliant unique text memo (<= 28 chars)."""
    # Stellar text memo limit is 28 bytes
    prefix = "SME"
    rand = secrets.token_hex(8) # 16 chars + 3 = 19 chars < 28 chars
    return f"{prefix}_{rand}"

def create_payment_request_service(merchant: Merchant, data: dict, request_obj=None) -> PaymentRequest:
    """
    Creates a new PaymentRequest for a merchant.
    Requires that the merchant has connected a Stellar wallet.
    Generates SEP-0007 URI and QR code base64 automatically.
    Supports auto-generated order_reference and itemized orders JSON field.
    """
    destination = None
    if hasattr(merchant, 'wallet') and merchant.wallet and merchant.wallet.public_key:
        destination = merchant.wallet.public_key
    elif data.get('destination_address'):
        dest_key = str(data['destination_address']).strip()
        from apps.merchants.models import MerchantWallet
        wallet, _ = MerchantWallet.objects.update_or_create(
            merchant=merchant,
            defaults={
                'public_key': dest_key,
                'wallet_provider': 'Freighter',
                'network': getattr(settings, 'STELLAR_NETWORK', 'TESTNET'),
                'is_verified': True,
                'verified_at': timezone.now(),
            }
        )
        destination = wallet.public_key

    if not destination:
        raise ValidationError({"wallet": "Please connect a Stellar Testnet wallet before generating payment requests."})

    # Process itemized orders if provided
    raw_orders = data.get('orders') or data.get('items') or []
    orders = normalize_order_items(raw_orders)

    # Determine amount: from items sum if provided, otherwise from amount field
    if orders:
        orders_sum = Decimal(str(round(sum(it['total'] for it in orders), 2)))
        amount = orders_sum if orders_sum > Decimal('0') else Decimal(str(data.get('amount', '0.01')))
    else:
        amount = Decimal(str(data['amount']))

    currency = data.get('currency', PaymentAsset.USDC)
    title = data.get('title', 'Payment Request')
    description = data.get('description', '')
    customer_name = data.get('customer_name', '')
    customer_email = data.get('customer_email')
    expires_in_minutes = data.get('expires_in_minutes', 60)

    # Auto-generate order reference if not provided
    order_reference = (data.get('order_reference') or data.get('orderRef') or '').strip()
    if not order_reference:
        order_reference = generate_unique_order_reference()

    asset_issuer = None
    if currency == PaymentAsset.USDC:
        asset_issuer = settings.USDC_ISSUER_ADDRESS

    reference_id = generate_unique_reference_id()
    while PaymentRequest.objects.filter(reference_id=reference_id).exists():
        reference_id = generate_unique_reference_id()

    memo = generate_unique_memo()
    while PaymentRequest.objects.filter(memo=memo).exists():
        memo = generate_unique_memo()

    expires_at = timezone.now() + timedelta(minutes=expires_in_minutes)

    # Generate SEP-0007 Stellar URI
    sep0007_uri = generate_sep0007_pay_uri(
        destination=destination,
        amount=amount,
        asset_code=currency,
        asset_issuer=asset_issuer,
        memo=memo,
        memo_type='MEMO_TEXT'
    )

    # Construct public customer checkout link (points to customer-facing checkout frontend)
    origin = None
    if request_obj:
        raw_origin = request_obj.META.get('HTTP_ORIGIN') or request_obj.META.get('HTTP_REFERER')
        if raw_origin:
            from urllib.parse import urlparse
            parsed = urlparse(raw_origin)
            if parsed.scheme and parsed.netloc:
                origin = f"{parsed.scheme}://{parsed.netloc}"

    if origin and not origin.endswith(':8000') and not origin.endswith(':8008'):
        checkout_url = f"{origin.rstrip('/')}/checkout/{reference_id}"
    else:
        base_checkout = getattr(settings, 'SMEHUB_BASE_CHECKOUT_URL', 'http://localhost:3000/checkout/').rstrip('/')
        checkout_url = f"{base_checkout}/{reference_id}"

    # Generate QR code for the SEP-0007 URI
    qr_code_base64 = generate_qr_code_base64(sep0007_uri)

    payment_request = PaymentRequest.objects.create(
        merchant=merchant,
        reference_id=reference_id,
        order_reference=order_reference,
        orders=orders,
        memo=memo,
        amount=amount,
        currency=currency,
        asset_issuer=asset_issuer,
        destination_address=destination,
        status=PaymentStatus.PENDING,
        title=title,
        description=description,
        customer_name=customer_name,
        customer_email=customer_email,
        sep0007_uri=sep0007_uri,
        checkout_url=checkout_url,
        qr_code_base64=qr_code_base64,
        expires_at=expires_at,
    )

    return payment_request

def get_payment_request_by_ref_service(reference_id: str) -> PaymentRequest:
    """Retrieve payment request by reference ID or order reference and check expiry."""
    from django.db.models import Q
    from rest_framework.exceptions import NotFound
    clean_ref = (reference_id or '').strip()
    req = PaymentRequest.objects.select_related('merchant', 'merchant__wallet').filter(
        Q(reference_id__iexact=clean_ref) | Q(order_reference__iexact=clean_ref)
    ).first()

    if not req:
        raise NotFound(f"Payment request with reference '{clean_ref}' was not found.")

    # Auto-expire if expired
    if req.is_expired():
        req.status = PaymentStatus.EXPIRED
        req.save(update_fields=['status'])

    return req

def cancel_payment_request_service(merchant: Merchant, reference_id: str) -> PaymentRequest:
    """Cancel a pending payment request."""
    try:
        req = PaymentRequest.objects.get(merchant=merchant, reference_id=reference_id)
    except PaymentRequest.DoesNotExist:
        raise ValidationError({"reference_id": f"Payment request '{reference_id}' not found for this merchant."})

    if req.status != PaymentStatus.PENDING:
        raise ValidationError({"status": f"Cannot cancel payment request in '{req.status}' state."})

    req.status = PaymentStatus.CANCELLED
    req.save(update_fields=['status'])
    return req

def update_payment_request_service(merchant: Merchant, reference_id: str, data: dict, request_obj=None) -> PaymentRequest:
    """Update editable fields of a payment request for the merchant."""
    try:
        req = PaymentRequest.objects.get(merchant=merchant, reference_id=reference_id)
    except PaymentRequest.DoesNotExist:
        raise ValidationError({"reference_id": f"Payment request '{reference_id}' not found for this merchant."})

    regenerate_qr = False

    if 'amount' in data and data['amount'] is not None:
        new_amount = Decimal(str(data['amount']))
        if new_amount != req.amount:
            req.amount = new_amount
            regenerate_qr = True

    if 'currency' in data and data['currency']:
        new_curr = data['currency']
        if new_curr != req.currency:
            req.currency = new_curr
            if new_curr == PaymentAsset.USDC:
                req.asset_issuer = settings.USDC_ISSUER_ADDRESS
            else:
                req.asset_issuer = None
            regenerate_qr = True

    if 'title' in data and data['title'] is not None:
        req.title = data['title']

    if 'description' in data and data['description'] is not None:
        req.description = data['description']

    if 'customer_name' in data and data['customer_name'] is not None:
        req.customer_name = data['customer_name']

    if 'customer_email' in data:
        req.customer_email = data['customer_email']

    if 'order_reference' in data and data['order_reference'] is not None:
        req.order_reference = data['order_reference'].strip()

    if 'orders' in data and data['orders'] is not None:
        req.orders = normalize_order_items(data['orders'])
        # If amount not explicitly overridden, sync amount with the items total
        if ('amount' not in data or data['amount'] is None) and req.orders:
            orders_sum = Decimal(str(round(sum(it['total'] for it in req.orders), 2)))
            if orders_sum > Decimal('0') and orders_sum != req.amount:
                req.amount = orders_sum
                regenerate_qr = True

    if 'status' in data and data['status']:
        req.status = data['status']

    if 'expires_in_minutes' in data and data['expires_in_minutes']:
        req.expires_at = timezone.now() + timedelta(minutes=int(data['expires_in_minutes']))

    if regenerate_qr and req.status == PaymentStatus.PENDING:
        req.sep0007_uri = generate_sep0007_pay_uri(
            destination=req.destination_address,
            amount=req.amount,
            asset_code=req.currency,
            asset_issuer=req.asset_issuer,
            memo=req.memo,
            memo_type='MEMO_TEXT'
        )
        req.qr_code_base64 = generate_qr_code_base64(req.sep0007_uri)

    req.save()
    return req

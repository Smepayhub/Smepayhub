from decimal import Decimal
from datetime import timedelta
from django.db.models import Sum, Count, Q
from django.utils import timezone
from apps.merchants.models import Merchant
from apps.payments.models import PaymentRequest, PaymentStatus, PaymentAsset
from apps.transactions.models import BlockchainTransaction

def get_merchant_dashboard_metrics(merchant: Merchant) -> dict:
    """Compute aggregated dashboard statistics and recent activity for merchant."""
    wallet = getattr(merchant, 'wallet', None)

    # Aggregations on PaymentRequest
    requests_qs = PaymentRequest.objects.filter(merchant=merchant)

    total_requests_count = requests_qs.count()
    completed_count = requests_qs.filter(status=PaymentStatus.COMPLETED).count()
    pending_count = requests_qs.filter(status=PaymentStatus.PENDING).count()
    expired_count = requests_qs.filter(status=PaymentStatus.EXPIRED).count()
    cancelled_count = requests_qs.filter(status=PaymentStatus.CANCELLED).count()

    # Volume by currency for completed payments
    completed_qs = requests_qs.filter(status=PaymentStatus.COMPLETED)
    usdc_vol = completed_qs.filter(currency=PaymentAsset.USDC).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    xlm_vol = completed_qs.filter(currency=PaymentAsset.XLM).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    conversion_rate = 0.0
    if total_requests_count > 0:
        conversion_rate = round((completed_count / total_requests_count) * 100, 2)

    # Recent 10 activity items
    recent_requests = requests_qs.order_by('-created_at')[:10]
    recent_activity = []
    for r in recent_requests:
        latest_tx = r.transactions.order_by('-created_at').first()
        recent_activity.append({
            'id': str(r.id),
            'reference_id': r.reference_id,
            'title': r.title,
            'amount': r.amount,
            'currency': r.currency,
            'status': r.status,
            'tx_hash': latest_tx.tx_hash if latest_tx else None,
            'stellar_expert_url': latest_tx.stellar_expert_url if latest_tx else None,
            'created_at': r.created_at,
            'paid_at': r.paid_at,
        })

    return {
        'business_name': merchant.business_name,
        'wallet_connected': bool(wallet and wallet.public_key),
        'wallet_public_key': wallet.public_key if wallet else None,
        'wallet_verified': wallet.is_verified if wallet else False,
        'total_volume_usdc': usdc_vol,
        'total_volume_xlm': xlm_vol,
        'completed_payments_count': completed_count,
        'pending_payments_count': pending_count,
        'expired_payments_count': expired_count,
        'cancelled_payments_count': cancelled_count,
        'total_requests_count': total_requests_count,
        'conversion_rate': conversion_rate,
        'recent_activity': recent_activity,
    }

def get_merchant_volume_chart(merchant: Merchant, days: int = 14) -> list:
    """Aggregate daily volume for chart display over the specified number of days."""
    end_date = timezone.now().date()
    start_date = end_date - timedelta(days=days - 1)

    chart_data = []
    for i in range(days):
        current_day = start_date + timedelta(days=i)
        day_qs = PaymentRequest.objects.filter(
            merchant=merchant,
            status=PaymentStatus.COMPLETED,
            paid_at__date=current_day
        )
        day_usdc = day_qs.filter(currency=PaymentAsset.USDC).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        day_xlm = day_qs.filter(currency=PaymentAsset.XLM).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        count = day_qs.count()

        chart_data.append({
            'date': current_day.strftime('%Y-%m-%d'),
            'usdc_volume': day_usdc,
            'xlm_volume': day_xlm,
            'count': count,
        })

    return chart_data

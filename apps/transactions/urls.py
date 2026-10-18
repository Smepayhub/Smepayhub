from django.urls import path
from apps.transactions.views import (
    submit_transaction_view,
    prepare_transaction_view,
    broadcast_transaction_view,
    check_payment_status_view,
    list_transactions_view,
    transaction_detail_view,
)

urlpatterns = [
    path('prepare/<str:reference_id>/', prepare_transaction_view, name='transaction-prepare'),
    path('broadcast/<str:reference_id>/', broadcast_transaction_view, name='transaction-broadcast'),
    path('verify/<str:reference_id>/', submit_transaction_view, name='transaction-verify'),
    path('status/<str:reference_id>/', check_payment_status_view, name='payment-status-poll'),
    path('', list_transactions_view, name='transaction-list'),
    path('<str:tx_hash>/', transaction_detail_view, name='transaction-detail'),
]

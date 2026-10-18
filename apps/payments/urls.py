from django.urls import path
from apps.payments.views import (
    create_payment_request_view,
    list_payment_requests_view,
    payment_request_detail_view,
    cancel_payment_request_view,
    public_checkout_view,
)

urlpatterns = [
    path('requests/', list_payment_requests_view, name='payment-request-list'),
    path('requests/create/', create_payment_request_view, name='payment-request-create'),
    path('requests/<str:reference_id>/', payment_request_detail_view, name='payment-request-detail'),
    path('requests/<str:reference_id>/cancel/', cancel_payment_request_view, name='payment-request-cancel'),
    path('checkout/<str:reference_id>/', public_checkout_view, name='public-checkout'),
]

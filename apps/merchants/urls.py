from django.urls import path
from apps.merchants.views import (
    merchant_register_view,
    merchant_login_view,
    merchant_wallet_register_view,
    merchant_wallet_login_view,
    merchant_profile_view,
    merchant_connect_wallet_view,
    merchant_wallet_info_view,
    merchant_refresh_api_key_view,
)

urlpatterns = [
    path('register/', merchant_register_view, name='merchant-register'),
    path('register/wallet/', merchant_wallet_register_view, name='merchant-wallet-register'),
    path('login/', merchant_login_view, name='merchant-login'),
    path('login/wallet/', merchant_wallet_login_view, name='merchant-wallet-login'),
    path('profile/', merchant_profile_view, name='merchant-profile'),
    path('wallet/connect/', merchant_connect_wallet_view, name='merchant-wallet-connect'),
    path('wallet/', merchant_wallet_info_view, name='merchant-wallet-info'),
    path('api-key/refresh/', merchant_refresh_api_key_view, name='merchant-refresh-api-key'),
]

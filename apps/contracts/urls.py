from django.urls import path
from apps.contracts.views import get_contract_info_view, build_soroban_invocation_view

urlpatterns = [
    path('info/', get_contract_info_view, name='contract-info'),
    path('soroban/build-pay/', build_soroban_invocation_view, name='soroban-build-pay'),
]

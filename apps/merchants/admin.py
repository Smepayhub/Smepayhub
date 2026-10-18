from django.contrib import admin
from apps.merchants.models import Merchant, MerchantWallet

@admin.register(Merchant)
class MerchantAdmin(admin.ModelAdmin):
    list_display = ['business_name', 'business_email', 'category', 'is_active', 'get_wallet_address', 'created_at']
    list_filter = ['category', 'is_active', 'created_at']
    search_fields = ['business_name', 'business_email', 'api_key', 'phone_number']
    readonly_fields = ['id', 'api_key', 'created_at', 'updated_at']
    ordering = ['-created_at']

    @admin.display(description='Connected Wallet')
    def get_wallet_address(self, obj):
        if hasattr(obj, 'wallet') and obj.wallet:
            return f"{obj.wallet.public_key[:8]}...{obj.wallet.public_key[-6:]}"
        return 'Not connected'

@admin.register(MerchantWallet)
class MerchantWalletAdmin(admin.ModelAdmin):
    list_display = ['merchant', 'public_key', 'wallet_provider', 'network', 'is_verified', 'verified_at', 'last_synced_at']
    list_filter = ['network', 'is_verified', 'wallet_provider']
    search_fields = ['public_key', 'merchant__business_name', 'merchant__business_email']
    readonly_fields = ['id', 'created_at', 'updated_at']
    ordering = ['-created_at']

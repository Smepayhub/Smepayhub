from django.contrib import admin
from django.utils.html import format_html
from apps.transactions.models import BlockchainTransaction

@admin.register(BlockchainTransaction)
class BlockchainTransactionAdmin(admin.ModelAdmin):
    list_display = [
        'tx_hash_short', 'merchant', 'amount', 'asset_code',
        'status', 'ledger', 'source_account_short', 'view_on_stellar_expert', 'created_at'
    ]
    list_filter = ['status', 'asset_code', 'created_at']
    search_fields = [
        'tx_hash', 'source_account', 'destination_account',
        'memo', 'merchant__business_name', 'merchant__business_email'
    ]
    readonly_fields = [
        'id', 'payment_request', 'merchant', 'tx_hash',
        'source_account', 'destination_account', 'amount',
        'asset_code', 'asset_issuer', 'memo', 'ledger',
        'fee_charged', 'status', 'stellar_expert_url',
        'raw_response', 'verified_at', 'created_at', 'updated_at'
    ]
    ordering = ['-created_at']

    @admin.display(description='Tx Hash')
    def tx_hash_short(self, obj):
        return f"{obj.tx_hash[:10]}...{obj.tx_hash[-8:]}"

    @admin.display(description='Source Account')
    def source_account_short(self, obj):
        if obj.source_account:
            return f"{obj.source_account[:6]}...{obj.source_account[-6:]}"
        return '-'

    @admin.display(description='Stellar Expert')
    def view_on_stellar_expert(self, obj):
        if obj.stellar_expert_url:
            return format_html('<a href="{}" target="_blank" rel="noopener noreferrer">View ↗</a>', obj.stellar_expert_url)
        return '-'

from django.contrib import admin
from django.utils import timezone
from apps.payments.models import PaymentRequest, PaymentStatus

@admin.register(PaymentRequest)
class PaymentRequestAdmin(admin.ModelAdmin):
    list_display = [
        'reference_id', 'order_reference', 'merchant', 'amount', 'currency',
        'items_count', 'status', 'memo', 'expires_at', 'paid_at', 'created_at'
    ]
    list_filter = ['status', 'currency', 'created_at']
    search_fields = [
        'reference_id', 'order_reference', 'memo', 'merchant__business_name',
        'merchant__business_email', 'destination_address', 'customer_name', 'customer_email'
    ]
    readonly_fields = [
        'id', 'reference_id', 'order_reference', 'memo', 'destination_address',
        'orders', 'sep0007_uri', 'checkout_url', 'qr_code_base64',
        'created_at', 'updated_at'
    ]
    ordering = ['-created_at']
    actions = ['mark_as_expired', 'mark_as_cancelled']

    @admin.display(description='Orders / Items')
    def items_count(self, obj):
        if obj.orders and isinstance(obj.orders, list):
            return f"{len(obj.orders)} choice(s)"
        return '-'

    @admin.action(description='Mark selected requests as Expired')
    def mark_as_expired(self, request, queryset):
        updated = queryset.filter(status=PaymentStatus.PENDING).update(status=PaymentStatus.EXPIRED)
        self.message_user(request, f"{updated} payment requests marked as Expired.")

    @admin.action(description='Mark selected requests as Cancelled')
    def mark_as_cancelled(self, request, queryset):
        updated = queryset.filter(status=PaymentStatus.PENDING).update(status=PaymentStatus.CANCELLED)
        self.message_user(request, f"{updated} payment requests marked as Cancelled.")

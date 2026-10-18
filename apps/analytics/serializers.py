from rest_framework import serializers

class RecentActivityItemSerializer(serializers.Serializer):
    id = serializers.CharField()
    reference_id = serializers.CharField()
    title = serializers.CharField()
    amount = serializers.DecimalField(max_digits=18, decimal_places=4)
    currency = serializers.CharField()
    status = serializers.CharField()
    tx_hash = serializers.CharField(allow_null=True)
    stellar_expert_url = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField()
    paid_at = serializers.DateTimeField(allow_null=True)

class DailyVolumeSerializer(serializers.Serializer):
    date = serializers.CharField()
    usdc_volume = serializers.DecimalField(max_digits=18, decimal_places=4)
    xlm_volume = serializers.DecimalField(max_digits=18, decimal_places=4)
    count = serializers.IntegerField()

class DashboardMetricsSerializer(serializers.Serializer):
    business_name = serializers.CharField()
    wallet_connected = serializers.BooleanField()
    wallet_public_key = serializers.CharField(allow_null=True)
    wallet_verified = serializers.BooleanField()
    total_volume_usdc = serializers.DecimalField(max_digits=18, decimal_places=4)
    total_volume_xlm = serializers.DecimalField(max_digits=18, decimal_places=4)
    completed_payments_count = serializers.IntegerField()
    pending_payments_count = serializers.IntegerField()
    expired_payments_count = serializers.IntegerField()
    cancelled_payments_count = serializers.IntegerField()
    total_requests_count = serializers.IntegerField()
    conversion_rate = serializers.FloatField()
    recent_activity = serializers.ListField(child=RecentActivityItemSerializer())

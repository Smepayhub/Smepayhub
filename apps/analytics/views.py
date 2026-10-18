from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiParameter, inline_serializer
from rest_framework import serializers

from apps.analytics.serializers import DashboardMetricsSerializer, DailyVolumeSerializer
from apps.analytics.services import get_merchant_dashboard_metrics, get_merchant_volume_chart
from apps.merchants.models import Merchant

@extend_schema(
    tags=['Analytics'],
    summary='Get merchant dashboard metrics',
    description='Returns complete merchant dashboard summary: total USDC and XLM volume, counts of completed/pending/expired payments, conversion rate, wallet status, and recent activity.',
    responses={
        200: inline_serializer(
            name='DashboardMetricsResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'data': DashboardMetricsSerializer(),
            }
        )
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def merchant_dashboard_metrics_view(request):
    """Function-based view for merchant dashboard metrics."""
    try:
        merchant = request.user.merchant_profile
    except Merchant.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Merchant profile not found.',
        }, status=status.HTTP_404_NOT_FOUND)

    metrics = get_merchant_dashboard_metrics(merchant)
    serializer = DashboardMetricsSerializer(metrics)
    return Response({
        'success': True,
        'data': serializer.data,
    }, status=status.HTTP_200_OK)

@extend_schema(
    tags=['Analytics'],
    summary='Get daily payment volume time-series chart data',
    description='Returns daily aggregated payment volume and count for the past 7, 14, or 30 days.',
    parameters=[
        OpenApiParameter(name='days', type=int, required=False, description='Number of days to look back (default 14, max 90)'),
    ],
    responses={
        200: inline_serializer(
            name='DailyVolumeChartResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'days': serializers.IntegerField(),
                'data': DailyVolumeSerializer(many=True),
            }
        )
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def merchant_volume_chart_view(request):
    """Function-based view for volume chart data."""
    merchant = request.user.merchant_profile
    days = int(request.query_params.get('days', 14))
    if days < 1 or days > 90:
        days = 14

    chart_data = get_merchant_volume_chart(merchant, days=days)
    serializer = DailyVolumeSerializer(chart_data, many=True)
    return Response({
        'success': True,
        'days': days,
        'data': serializer.data,
    }, status=status.HTTP_200_OK)

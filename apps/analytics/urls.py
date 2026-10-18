from django.urls import path
from apps.analytics.views import (
    merchant_dashboard_metrics_view,
    merchant_volume_chart_view,
)

urlpatterns = [
    path('dashboard/', merchant_dashboard_metrics_view, name='merchant-dashboard-metrics'),
    path('charts/volume/', merchant_volume_chart_view, name='merchant-volume-chart'),
]

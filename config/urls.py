from django.contrib import admin
from django.urls import path, include
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from drf_spectacular.utils import extend_schema, inline_serializer

from rest_framework import serializers

@extend_schema(
    tags=['System'],
    summary='API health and readiness check',
    description='Returns operational status of the SMEHUB Stellar backend API.',
    responses={
        200: inline_serializer(
            name='HealthCheckResponse',
            fields={
                'status': serializers.CharField(),
                'service': serializers.CharField(),
                'network': serializers.CharField(),
                'version': serializers.CharField(),
            }
        )
    }
)
@api_view(['GET'])
@permission_classes([AllowAny])
def health_check_view(request):

    """System health and readiness check."""
    return Response({
        'status': 'healthy',
        'service': 'SMEHUB Stellar Payment Platform',
        'network': 'Stellar Testnet',
        'version': '1.0.0',
    })

@extend_schema(
    tags=['System'],
    summary='OpenAI Function Calling / Tool Definitions',
    description='Returns OpenAI-compatible function calling tool schemas for AI assistant integration with SMEHUB.',
    responses={200: inline_serializer(name='OpenAIToolsResponse', fields={'tools': serializers.ListField(), 'system_prompt': serializers.CharField()})}
)
@api_view(['GET'])
@permission_classes([AllowAny])
def openai_tools_doc_view(request):
    """Exposes OpenAI function definitions for AI agent integrations."""
    from apps.core.ai_docs import OPENAI_SMEHUB_TOOLS, get_openai_system_prompt
    return Response({
        'success': True,
        'tools': OPENAI_SMEHUB_TOOLS,
        'system_prompt': get_openai_system_prompt(),
    })

admin.site.site_header = "SMEHUB SuperAdmin Portal"
admin.site.site_title = "SMEHUB Stellar Admin"
admin.site.index_title = "SMEHUB Blockchain Payment & Merchant Management"

urlpatterns = [
    # Django Admin Interface
    path('admin/', admin.site.urls),

    # System Health
    path('health/', health_check_view, name='health-check'),
    path('api/health/', health_check_view, name='api-health-check'),

    # OpenAPI 3.0 & OpenAI Tool Documentation Endpoints
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/docs/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    path('api/docs/openai-tools/', openai_tools_doc_view, name='openai-tools-doc'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='api-docs-default'),

    # Domain Endpoints
    path('api/merchants/', include('apps.merchants.urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/transactions/', include('apps.transactions.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/contracts/', include('apps.contracts.urls')),
]


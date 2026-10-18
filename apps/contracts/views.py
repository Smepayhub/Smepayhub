from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers

from apps.contracts.serializers import (
    SorobanContractInfoSerializer,
    SorobanPayInvocationRequestSerializer,
    SorobanPayInvocationResponseSerializer,
)
from apps.contracts.services import (
    get_contract_metadata,
    build_soroban_pay_invocation,
)

@extend_schema(
    tags=['Contracts'],
    summary='Get Smart Contract metadata and interface',
    description='Returns Stellar Soroban payment router contract ID, methods, and EVM contract details.',
    responses={
        200: inline_serializer(
            name='ContractInfoResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'data': SorobanContractInfoSerializer(),
            }
        )
    }
)
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def get_contract_info_view(request):
    """Function-based view to get smart contract metadata."""
    metadata = get_contract_metadata()
    return Response({
        'success': True,
        'data': metadata,
    }, status=status.HTTP_200_OK)

@extend_schema(
    tags=['Contracts'],
    summary='Build Soroban payment invocation arguments',
    description='Constructs the Soroban smart contract call parameters for client-side wallet signing.',
    request=SorobanPayInvocationRequestSerializer,
    responses={
        200: inline_serializer(
            name='ContractInvocationResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'data': SorobanPayInvocationResponseSerializer(),
            }
        )
    }
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def build_soroban_invocation_view(request):
    """Function-based view to build Soroban invoice payment invocation parameters."""
    serializer = SorobanPayInvocationRequestSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    payer = serializer.validated_data['payer_address']
    reference_id = serializer.validated_data['reference_id']

    payload = build_soroban_pay_invocation(payer, reference_id)
    return Response({
        'success': True,
        'data': payload,
    }, status=status.HTTP_200_OK)

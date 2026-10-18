from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema, OpenApiResponse, OpenApiParameter, inline_serializer
from rest_framework import serializers

from apps.transactions.serializers import (
    TransactionSubmitSerializer,
    TransactionSerializer,
    PaymentStatusPollSerializer,
    TransactionPrepareSerializer,
    TransactionBroadcastSerializer,
)
from apps.transactions.services import (
    verify_and_record_transaction_service,
    check_payment_status_service,
    prepare_checkout_transaction_service,
    broadcast_checkout_transaction_service,
)
from apps.transactions.models import BlockchainTransaction
from apps.merchants.models import Merchant

@extend_schema(
    tags=['Transactions'],
    summary='Submit and verify Stellar Testnet transaction',
    description='Submits a 64-character Stellar transaction hash for a payment request. Verifies on-chain execution via Stellar Horizon, matches destination, amount, and memo, and confirms payment.',
    request=TransactionSubmitSerializer,
    responses={
        200: inline_serializer(
            name='TransactionVerifyResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'message': serializers.CharField(),
                'data': TransactionSerializer(),
            }
        ),
        400: OpenApiResponse(description='Verification failed or invalid hash'),
    }
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def submit_transaction_view(request, reference_id):
    """Function-based view to submit and verify a Stellar transaction hash."""
    serializer = TransactionSubmitSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    tx_hash = serializer.validated_data['tx_hash']
    blockchain_tx = verify_and_record_transaction_service(reference_id, tx_hash)

    return Response({
        'success': True,
        'message': 'Stellar Testnet transaction verified and confirmed successfully.',
        'data': TransactionSerializer(blockchain_tx).data,
    }, status=status.HTTP_200_OK)

@extend_schema(
    tags=['Checkout'],
    summary='Prepare unsigned Stellar transaction XDR',
    description='Constructs an unsigned Stellar transaction XDR for client-side wallet signing.',
    request=TransactionPrepareSerializer,
    responses={
        200: inline_serializer(
            name='TransactionPrepareResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'xdr': serializers.CharField(),
                'network_passphrase': serializers.CharField(),
                'payer_address': serializers.CharField(),
                'destination_address': serializers.CharField(),
                'amount': serializers.CharField(),
                'currency': serializers.CharField(),
                'used_currency': serializers.CharField(),
                'memo': serializers.CharField(),
            }
        )
    }
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def prepare_transaction_view(request, reference_id):
    """Function-based view to build unsigned Stellar transaction XDR."""
    serializer = TransactionPrepareSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    res = prepare_checkout_transaction_service(
        reference_id=reference_id,
        payer_address=serializer.validated_data['payer_address'],
        preferred_currency=serializer.validated_data.get('currency')
    )
    return Response(res, status=status.HTTP_200_OK)

@extend_schema(
    tags=['Checkout'],
    summary='Broadcast signed Stellar transaction XDR',
    description='Submits a signed transaction XDR to Stellar Horizon, executing payment and recording settlement.',
    request=TransactionBroadcastSerializer,
    responses={
        200: inline_serializer(
            name='TransactionBroadcastResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'message': serializers.CharField(),
                'tx_hash': serializers.CharField(),
                'ledger': serializers.IntegerField(),
                'data': TransactionSerializer(),
            }
        )
    }
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def broadcast_transaction_view(request, reference_id):
    """Function-based view to submit signed transaction XDR to Horizon and settle payment."""
    serializer = TransactionBroadcastSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    res = broadcast_checkout_transaction_service(
        reference_id=reference_id,
        signed_xdr=serializer.validated_data['signed_xdr']
    )
    return Response({
        'success': True,
        'message': res['message'],
        'tx_hash': res['tx_hash'],
        'ledger': res['ledger'],
        'data': TransactionSerializer(res['data']).data,
    }, status=status.HTTP_200_OK)


@extend_schema(
    tags=['Checkout'],
    summary='Poll real-time payment status',
    description='Poll endpoint used by checkout screen and merchant dashboard to check whether a payment request has been confirmed on the Stellar ledger.',
    responses={
        200: inline_serializer(
            name='PaymentStatusResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'data': PaymentStatusPollSerializer(),
            }
        )
    }
)
@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def check_payment_status_view(request, reference_id):
    """Function-based view to poll payment request settlement status."""
    status_info = check_payment_status_service(reference_id)
    return Response({
        'success': True,
        'data': status_info,
    }, status=status.HTTP_200_OK)

@extend_schema(
    tags=['Transactions'],
    operation_id='merchant_list_transactions',
    summary='List merchant transaction history',
    description='Returns transaction history for the authenticated merchant with explorer links, ledger numbers, and settlement timestamps.',
    parameters=[
        OpenApiParameter(name='status', type=str, required=False, description='Filter by status: SUCCESS, FAILED'),
        OpenApiParameter(name='asset_code', type=str, required=False, description='Filter by asset code: USDC, XLM'),
    ],
    responses={
        200: inline_serializer(
            name='TransactionListResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'count': serializers.IntegerField(),
                'results': TransactionSerializer(many=True),
            }
        )
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_transactions_view(request):
    """Function-based view for merchant transaction history."""
    merchant = request.user.merchant_profile
    queryset = BlockchainTransaction.objects.filter(merchant=merchant).order_by('-created_at')

    status_filter = request.query_params.get('status')
    if status_filter:
        queryset = queryset.filter(status=status_filter.upper())

    asset_filter = request.query_params.get('asset_code')
    if asset_filter:
        queryset = queryset.filter(asset_code=asset_filter.upper())

    paginator = request.pagination_class() if hasattr(request, 'pagination_class') and request.pagination_class else None
    if paginator:
        page = paginator.paginate_queryset(queryset, request)
        serializer = TransactionSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    serializer = TransactionSerializer(queryset, many=True)
    return Response({
        'success': True,
        'count': queryset.count(),
        'results': serializer.data,
    })

@extend_schema(
    tags=['Transactions'],
    operation_id='merchant_get_transaction_detail',
    summary='Get transaction details by hash',
    description='Retrieve full on-chain transaction details, Stellar Expert explorer link, and ledger metadata.',
    responses={
        200: inline_serializer(
            name='TransactionDetailResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'data': TransactionSerializer(),
            }
        ),
        404: OpenApiResponse(description='Transaction not found'),
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def transaction_detail_view(request, tx_hash):
    """Function-based view to get a specific transaction detail."""
    merchant = request.user.merchant_profile
    try:
        tx = BlockchainTransaction.objects.get(merchant=merchant, tx_hash=tx_hash)
    except BlockchainTransaction.DoesNotExist:
        return Response({
            'success': False,
            'message': f"Transaction with hash '{tx_hash}' not found for this merchant.",
        }, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'success': True,
        'data': TransactionSerializer(tx).data,
    })

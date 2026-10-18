from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from drf_spectacular.utils import extend_schema, OpenApiResponse, inline_serializer
from rest_framework import serializers

from apps.merchants.serializers import (
    MerchantRegisterSerializer,
    MerchantProfileSerializer,
    MerchantWalletConnectSerializer,
    MerchantWalletSerializer,
    MerchantLoginSerializer,
    MerchantWalletLiveInfoSerializer,
    MerchantWalletAuthSerializer,
)
from apps.merchants.services import (
    register_merchant_service,
    connect_or_update_wallet_service,
    get_merchant_wallet_live_info_service,
    refresh_merchant_api_key_service,
    wallet_auth_service,
)
from apps.merchants.models import Merchant

@extend_schema(
    tags=['Merchants'],
    summary='Register a new merchant business profile',
    description='Creates a new SME merchant account, business profile, API key, and optionally connects a Stellar Testnet wallet.',
    request=MerchantRegisterSerializer,
    responses={
        201: inline_serializer(
            name='MerchantRegisterResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'message': serializers.CharField(),
                'data': MerchantProfileSerializer(),
                'token': serializers.CharField(),
            }
        ),
        400: OpenApiResponse(description='Validation error'),
    }
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def merchant_register_view(request):
    """Function-based view for merchant account registration."""
    serializer = MerchantRegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    result = register_merchant_service(serializer.validated_data)
    merchant = result['merchant']
    token = result['token']

    return Response({
        'success': True,
        'message': 'Merchant business profile registered successfully.',
        'data': MerchantProfileSerializer(merchant).data,
        'token': token,
    }, status=status.HTTP_201_CREATED)

@extend_schema(
    tags=['Merchants'],
    summary='Authenticate merchant and obtain auth token',
    description='Log in with merchant username or email and password to receive an authentication token.',
    request=MerchantLoginSerializer,
    responses={
        200: inline_serializer(
            name='MerchantLoginResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'token': serializers.CharField(),
                'merchant': MerchantProfileSerializer(),
            }
        ),
        401: OpenApiResponse(description='Invalid credentials'),
    }
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def merchant_login_view(request):
    """Function-based view for merchant login."""
    serializer = MerchantLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    identifier = serializer.validated_data['username']
    password = serializer.validated_data['password']

    # Try authentication directly with username
    user = authenticate(username=identifier, password=password)
    if not user:
        # Try authentication via email
        try:
            merchant = Merchant.objects.get(business_email__iexact=identifier)
            user = authenticate(username=merchant.user.username, password=password)
        except Merchant.DoesNotExist:
            user = None

    if not user:
        return Response({
            'success': False,
            'message': 'Invalid credentials provided.',
            'errors': {'credentials': ['Username/email or password is incorrect.']}
        }, status=status.HTTP_401_UNAUTHORIZED)

    try:
        merchant = user.merchant_profile
    except Merchant.DoesNotExist:
        return Response({
            'success': False,
            'message': 'User is not registered as a merchant profile.',
            'errors': {'merchant': ['Merchant profile not found.']}
        }, status=status.HTTP_404_NOT_FOUND)

    token, _ = Token.objects.get_or_create(user=user)

    return Response({
        'success': True,
        'message': 'Authentication successful.',
        'token': token.key,
        'merchant': MerchantProfileSerializer(merchant).data,
    }, status=status.HTTP_200_OK)

@extend_schema(
    tags=['Merchants'],
    summary='Get or update merchant profile',
    description='Retrieve or update the authenticated merchant business details, contact info, and payment settings.',
    request=MerchantProfileSerializer,
    responses={
        200: inline_serializer(
            name='MerchantProfileResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'data': MerchantProfileSerializer(),
            }
        )
    }
)
@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def merchant_profile_view(request):
    """Function-based view for retrieving and updating merchant profile."""
    try:
        merchant = request.user.merchant_profile
    except Merchant.DoesNotExist:
        return Response({
            'success': False,
            'message': 'No merchant profile associated with this account.',
        }, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response({
            'success': True,
            'data': MerchantProfileSerializer(merchant).data,
        })

    # PUT or PATCH
    partial = (request.method == 'PATCH')
    serializer = MerchantProfileSerializer(merchant, data=request.data, partial=partial)
    serializer.is_valid(raise_exception=True)
    serializer.save()

    return Response({
        'success': True,
        'message': 'Merchant profile updated successfully.',
        'data': serializer.data,
    })

@extend_schema(
    tags=['Merchants'],
    summary='Connect or update Stellar Testnet wallet',
    description='Connect a non-custodial Stellar wallet (Freighter, Albedo, Lobstr) to receive customer payments.',
    request=MerchantWalletConnectSerializer,
    responses={
        200: inline_serializer(
            name='WalletConnectResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'message': serializers.CharField(),
                'wallet': MerchantWalletSerializer(),
            }
        ),
        400: OpenApiResponse(description='Invalid public key or wallet already associated'),
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def merchant_connect_wallet_view(request):
    """Function-based view to connect or update merchant's Stellar wallet."""
    try:
        merchant = request.user.merchant_profile
    except Merchant.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Merchant profile not found.',
        }, status=status.HTTP_404_NOT_FOUND)

    serializer = MerchantWalletConnectSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    public_key = serializer.validated_data['public_key']
    provider = serializer.validated_data.get('wallet_provider', 'Freighter')

    try:
        wallet = connect_or_update_wallet_service(merchant, public_key, provider)
    except ValueError as e:
        return Response({
            'success': False,
            'message': str(e),
            'errors': {'public_key': [str(e)]}
        }, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'success': True,
        'message': 'Stellar Testnet wallet connected successfully.',
        'wallet': MerchantWalletSerializer(wallet).data,
    }, status=status.HTTP_200_OK)

@extend_schema(
    tags=['Merchants'],
    summary='View merchant wallet info and live Stellar balances',
    description='Fetches live Testnet XLM and USDC balances directly from the Stellar Horizon network for the merchant wallet.',
    responses={
        200: inline_serializer(
            name='WalletLiveInfoResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'data': MerchantWalletLiveInfoSerializer(),
            }
        )
    }
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def merchant_wallet_info_view(request):
    """Function-based view to view merchant wallet information and live Stellar balances."""
    try:
        merchant = request.user.merchant_profile
    except Merchant.DoesNotExist:
        return Response({
            'success': False,
            'message': 'Merchant profile not found.',
        }, status=status.HTTP_404_NOT_FOUND)

    info = get_merchant_wallet_live_info_service(merchant)
    return Response({
        'success': True,
        'data': info,
    }, status=status.HTTP_200_OK)

@extend_schema(
    tags=['Merchants'],
    operation_id='merchant_refresh_api_key',
    summary='Regenerate merchant API key',
    description='Revokes existing API key and issues a newly generated secure API key for the merchant.',
    request=None,
    responses={
        200: inline_serializer(
            name='ApiKeyRefreshResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'message': serializers.CharField(),
                'api_key': serializers.CharField(),
            }
        )
    }
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def merchant_refresh_api_key_view(request):
    """Function-based view to regenerate merchant API key."""
    merchant = request.user.merchant_profile
    new_key = refresh_merchant_api_key_service(merchant)

    return Response({
        'success': True,
        'message': 'API key refreshed successfully.',
        'api_key': new_key,
    }, status=status.HTTP_200_OK)

@extend_schema(
    tags=['Merchants'],
    summary='Register or quick-onboard via Stellar wallet',
    description='Instant merchant onboarding using Stellar Testnet wallet. Skips profile form filling, allowing merchants to configure business details later in Settings.',
    request=MerchantWalletAuthSerializer,
    responses={
        200: inline_serializer(
            name='MerchantWalletAuthResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'message': serializers.CharField(),
                'token': serializers.CharField(),
                'merchant': MerchantProfileSerializer(),
                'is_new': serializers.BooleanField(),
            }
        ),
        400: OpenApiResponse(description='Invalid public key format'),
    }
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def merchant_wallet_register_view(request):
    """Function-based view for wallet-based merchant onboarding (skips form filling)."""
    serializer = MerchantWalletAuthSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    public_key = serializer.validated_data['public_key']
    wallet_provider = serializer.validated_data.get('wallet_provider', 'Freighter')

    result = wallet_auth_service(public_key, wallet_provider=wallet_provider, auto_register=True)

    return Response({
        'success': True,
        'message': 'Merchant account provisioned via Stellar wallet.' if result['is_new'] else 'Welcome back! Signed in with Stellar wallet.',
        'token': result['token'],
        'merchant': MerchantProfileSerializer(result['merchant']).data,
        'is_new': result['is_new'],
    }, status=status.HTTP_201_CREATED if result['is_new'] else status.HTTP_200_OK)

@extend_schema(
    tags=['Merchants'],
    summary='Authenticate merchant via Stellar wallet',
    description='Log in using connected Stellar Testnet public key. Optionally auto-creates account if auto_register is True.',
    request=MerchantWalletAuthSerializer,
    responses={
        200: inline_serializer(
            name='MerchantWalletLoginResponse',
            fields={
                'success': serializers.BooleanField(default=True),
                'message': serializers.CharField(),
                'token': serializers.CharField(),
                'merchant': MerchantProfileSerializer(),
                'is_new': serializers.BooleanField(),
            }
        ),
        404: OpenApiResponse(description='Wallet not registered as a merchant'),
    }
)
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def merchant_wallet_login_view(request):
    """Function-based view for logging in with connected Stellar wallet."""
    serializer = MerchantWalletAuthSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    public_key = serializer.validated_data['public_key']
    wallet_provider = serializer.validated_data.get('wallet_provider', 'Freighter')
    auto_register = serializer.validated_data.get('auto_register', False)

    try:
        result = wallet_auth_service(public_key, wallet_provider=wallet_provider, auto_register=auto_register)
    except ValueError as e:
        return Response({
            'success': False,
            'message': str(e),
            'not_registered': True,
            'errors': {'public_key': [str(e)]}
        }, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'success': True,
        'message': 'Successfully authenticated with Stellar wallet.',
        'token': result['token'],
        'merchant': MerchantProfileSerializer(result['merchant']).data,
        'is_new': result['is_new'],
    }, status=status.HTTP_200_OK)


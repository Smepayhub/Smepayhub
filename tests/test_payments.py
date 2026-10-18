import pytest
from rest_framework.test import APIClient
from apps.payments.models import PaymentRequest, PaymentStatus

VALID_PUBKEY = "GARABOLJC3MOQSTH6TFDGMPPNT7A55UISXTC5LMHT7M5NICWDE3M2SWK"

@pytest.fixture
def auth_merchant_client(db):
    client = APIClient()
    reg_payload = {
        'username': 'paymentsmerchant',
        'email': 'merchant@pay.com',
        'password': 'StrongPassword123!',
        'business_name': 'Pay Merchant Co',
        'stellar_public_key': VALID_PUBKEY,
    }
    res = client.post('/api/merchants/register/', reg_payload, format='json')
    token = res.data['token']
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
    return client

@pytest.mark.django_db
def test_create_payment_request_success(auth_merchant_client):
    payload = {
        'amount': '75.5000',
        'currency': 'USDC',
        'title': 'Invoice #9001',
        'description': 'Consulting retainer fee',
        'customer_name': 'Alice Johnson',
        'customer_email': 'alice@example.com',
        'expires_in_minutes': 120,
    }
    response = auth_merchant_client.post('/api/payments/requests/create/', payload, format='json')
    assert response.status_code == 201
    assert response.data['success'] is True
    data = response.data['data']

    assert data['amount'] == '75.5000'
    assert data['currency'] == 'USDC'
    assert data['destination_address'] == VALID_PUBKEY
    assert data['status'] == PaymentStatus.PENDING
    assert data['reference_id'].startswith('SME-')
    assert data['memo'].startswith('SME_')
    assert data['sep0007_uri'].startswith('web+stellar:pay?')
    assert data['qr_code_base64'].startswith('data:image/png;base64,')

@pytest.mark.django_db
def test_create_payment_request_without_wallet():
    # Register merchant without wallet
    client = APIClient()
    reg_res = client.post('/api/merchants/register/', {
        'username': 'nowalletmerchant',
        'email': 'nowallet@test.com',
        'password': 'Password123!',
        'business_name': 'No Wallet Co',
    }, format='json')
    token = reg_res.data['token']
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

    res = client.post('/api/payments/requests/create/', {
        'amount': '10.00',
        'currency': 'USDC',
    }, format='json')
    assert res.status_code == 400
    assert 'wallet' in res.data['errors']

@pytest.mark.django_db
def test_list_and_detail_payment_requests(auth_merchant_client):
    # Create two requests
    auth_merchant_client.post('/api/payments/requests/create/', {'amount': '15.00', 'currency': 'USDC'}, format='json')
    r2 = auth_merchant_client.post('/api/payments/requests/create/', {'amount': '30.00', 'currency': 'XLM'}, format='json')
    ref_id = r2.data['data']['reference_id']

    # List requests
    list_res = auth_merchant_client.get('/api/payments/requests/')
    assert list_res.status_code == 200
    assert list_res.data['count'] == 2

    # Filter by currency
    xlm_list_res = auth_merchant_client.get('/api/payments/requests/?currency=XLM')
    assert xlm_list_res.status_code == 200
    assert xlm_list_res.data['count'] == 1

    # Detail request
    detail_res = auth_merchant_client.get(f'/api/payments/requests/{ref_id}/')
    assert detail_res.status_code == 200
    assert detail_res.data['data']['reference_id'] == ref_id

@pytest.mark.django_db
def test_cancel_payment_request(auth_merchant_client):
    create_res = auth_merchant_client.post('/api/payments/requests/create/', {'amount': '50.00', 'currency': 'USDC'}, format='json')
    ref_id = create_res.data['data']['reference_id']

    cancel_res = auth_merchant_client.post(f'/api/payments/requests/{ref_id}/cancel/')
    assert cancel_res.status_code == 200
    assert cancel_res.data['data']['status'] == PaymentStatus.CANCELLED

@pytest.mark.django_db
def test_public_customer_checkout_view(auth_merchant_client):
    create_res = auth_merchant_client.post('/api/payments/requests/create/', {
        'amount': '100.00',
        'currency': 'USDC',
        'title': 'E-commerce Purchase',
    }, format='json')
    ref_id = create_res.data['data']['reference_id']

    # Public client (unauthenticated customer)
    public_client = APIClient()
    checkout_res = public_client.get(f'/api/payments/checkout/{ref_id}/')
    assert checkout_res.status_code == 200
    assert checkout_res.data['success'] is True
    data = checkout_res.data['data']

    assert data['reference_id'] == ref_id
    assert data['merchant_name'] == 'Pay Merchant Co'
    assert data['amount'] == '100.0000'
    assert data['currency'] == 'USDC'
    assert data['destination_address'] == VALID_PUBKEY
    assert data['status'] == PaymentStatus.PENDING
    assert data['qr_code_base64'].startswith('data:image/png;base64,')

import pytest
from rest_framework.test import APIClient
from django.contrib.auth.models import User
from apps.merchants.models import Merchant, MerchantWallet

VALID_PUBKEY = "GARABOLJC3MOQSTH6TFDGMPPNT7A55UISXTC5LMHT7M5NICWDE3M2SWK"

@pytest.mark.django_db
def test_merchant_registration_success():
    client = APIClient()
    payload = {
        'username': 'techstore',
        'email': 'contact@techstore.com',
        'password': 'StrongPassword123!',
        'business_name': 'Tech Store Inc',
        'category': 'TECH',
        'description': 'Hardware and electronic accessories',
        'stellar_public_key': VALID_PUBKEY,
        'wallet_provider': 'Freighter',
    }

    response = client.post('/api/merchants/register/', payload, format='json')
    assert response.status_code == 201
    assert response.data['success'] is True
    assert 'token' in response.data
    assert response.data['data']['business_name'] == 'Tech Store Inc'
    assert response.data['data']['wallet']['public_key'] == VALID_PUBKEY

    merchant = Merchant.objects.get(business_email='contact@techstore.com')
    assert merchant.wallet.public_key == VALID_PUBKEY
    assert merchant.api_key.startswith('sme_')

@pytest.mark.django_db
def test_merchant_registration_duplicate_email():
    client = APIClient()
    payload = {
        'username': 'shop1',
        'email': 'shop@example.com',
        'password': 'Password123!',
        'business_name': 'Shop 1',
    }
    res1 = client.post('/api/merchants/register/', payload, format='json')
    assert res1.status_code == 201

    payload2 = {
        'username': 'shop2',
        'email': 'shop@example.com',
        'password': 'Password123!',
        'business_name': 'Shop 2',
    }
    res2 = client.post('/api/merchants/register/', payload2, format='json')
    assert res2.status_code == 400
    assert 'email' in res2.data['errors']

@pytest.mark.django_db
def test_merchant_login_and_profile():
    client = APIClient()
    # Register
    reg_payload = {
        'username': 'cafebar',
        'email': 'cafe@bar.com',
        'password': 'SecurePassword88!',
        'business_name': 'Artisan Cafe',
    }
    client.post('/api/merchants/register/', reg_payload, format='json')

    # Login
    login_res = client.post('/api/merchants/login/', {
        'username': 'cafebar',
        'password': 'SecurePassword88!',
    }, format='json')
    assert login_res.status_code == 200
    token = login_res.data['token']

    # Authenticated profile request
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')
    profile_res = client.get('/api/merchants/profile/')
    assert profile_res.status_code == 200
    assert profile_res.data['data']['business_name'] == 'Artisan Cafe'

    # Update profile
    patch_res = client.patch('/api/merchants/profile/', {
        'description': 'Serving fresh coffee and pastries',
        'phone_number': '+1-555-0199',
    }, format='json')
    assert patch_res.status_code == 200
    assert patch_res.data['data']['description'] == 'Serving fresh coffee and pastries'

@pytest.mark.django_db
def test_connect_wallet():
    client = APIClient()
    reg_payload = {
        'username': 'bookshop',
        'email': 'books@shop.com',
        'password': 'BookPassword123!',
        'business_name': 'Classic Books',
    }
    reg_res = client.post('/api/merchants/register/', reg_payload, format='json')
    token = reg_res.data['token']
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

    # Connect wallet with invalid key -> should fail
    bad_res = client.post('/api/merchants/wallet/connect/', {
        'public_key': 'invalid_address',
        'wallet_provider': 'Freighter',
    }, format='json')
    assert bad_res.status_code == 400

    # Connect with valid key
    good_res = client.post('/api/merchants/wallet/connect/', {
        'public_key': VALID_PUBKEY,
        'wallet_provider': 'Freighter',
    }, format='json')
    assert good_res.status_code == 200
    assert good_res.data['wallet']['public_key'] == VALID_PUBKEY

    # Check wallet info endpoint
    info_res = client.get('/api/merchants/wallet/')
    assert info_res.status_code == 200
    assert info_res.data['data']['has_wallet'] is True
    assert info_res.data['data']['public_key'] == VALID_PUBKEY

@pytest.mark.django_db
def test_merchant_wallet_register_and_login():
    client = APIClient()
    test_pubkey = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

    # 1. Unregistered wallet login without auto_register should return 404
    login_fail = client.post('/api/merchants/login/wallet/', {
        'public_key': test_pubkey,
        'wallet_provider': 'Albedo',
        'auto_register': False,
    }, format='json')
    assert login_fail.status_code == 404
    assert login_fail.data['not_registered'] is True

    # 2. Register via wallet connect (skips form filling)
    reg_res = client.post('/api/merchants/register/wallet/', {
        'public_key': test_pubkey,
        'wallet_provider': 'Albedo',
    }, format='json')
    assert reg_res.status_code == 201
    assert reg_res.data['success'] is True
    assert 'token' in reg_res.data
    assert reg_res.data['merchant']['wallet']['public_key'] == test_pubkey
    token = reg_res.data['token']

    # 3. Subsequent login with the same wallet should succeed
    login_success = client.post('/api/merchants/login/wallet/', {
        'public_key': test_pubkey,
        'wallet_provider': 'Albedo',
    }, format='json')
    assert login_success.status_code == 200
    assert login_success.data['success'] is True
    assert login_success.data['token'] == token
    assert login_success.data['merchant']['wallet']['public_key'] == test_pubkey


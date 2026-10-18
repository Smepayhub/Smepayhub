import pytest
from decimal import Decimal
from unittest.mock import patch
from rest_framework.test import APIClient
from apps.payments.models import PaymentStatus

VALID_PUBKEY = "GARABOLJC3MOQSTH6TFDGMPPNT7A55UISXTC5LMHT7M5NICWDE3M2SWK"
TX_1 = "11" * 32
TX_2 = "22" * 32

@pytest.fixture
def analytics_merchant(db):
    client = APIClient()
    reg_payload = {
        'username': 'analyticsmerchant',
        'email': 'analytics@merchant.com',
        'password': 'StrongPassword123!',
        'business_name': 'Analytics Merchant Ltd',
        'stellar_public_key': VALID_PUBKEY,
    }
    res = client.post('/api/merchants/register/', reg_payload, format='json')
    token = res.data['token']
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

    # Create 3 payment requests:
    # 1: 50.00 USDC -> completed
    # 2: 25.00 USDC -> completed
    # 3: 10.00 XLM  -> pending
    r1 = client.post('/api/payments/requests/create/', {'amount': '50.00', 'currency': 'USDC'}, format='json')
    r2 = client.post('/api/payments/requests/create/', {'amount': '25.00', 'currency': 'USDC'}, format='json')
    r3 = client.post('/api/payments/requests/create/', {'amount': '10.00', 'currency': 'XLM'}, format='json')

    ref1 = r1.data['data']['reference_id']
    ref2 = r2.data['data']['reference_id']

    mock_1 = {
        'tx_hash': TX_1,
        'ledger': 100,
        'source_account': 'G...',
        'fee_charged': 100,
        'created_at': '2026-10-17T03:00:00Z',
        'paid_amount': Decimal('50.00'),
        'asset_code': 'USDC',
        'destination': VALID_PUBKEY,
        'explorer_url': f'https://stellar.expert/explorer/testnet/tx/{TX_1}',
    }
    mock_2 = {
        'tx_hash': TX_2,
        'ledger': 101,
        'source_account': 'G...',
        'fee_charged': 100,
        'created_at': '2026-10-17T03:01:00Z',
        'paid_amount': Decimal('25.00'),
        'asset_code': 'USDC',
        'destination': VALID_PUBKEY,
        'explorer_url': f'https://stellar.expert/explorer/testnet/tx/{TX_2}',
    }

    with patch('apps.transactions.services.verify_stellar_testnet_payment', side_effect=[mock_1, mock_2]):
        client.post(f'/api/transactions/verify/{ref1}/', {'tx_hash': TX_1}, format='json')
        client.post(f'/api/transactions/verify/{ref2}/', {'tx_hash': TX_2}, format='json')

    return client

@pytest.mark.django_db
def test_dashboard_metrics(analytics_merchant):
    res = analytics_merchant.get('/api/analytics/dashboard/')
    assert res.status_code == 200
    assert res.data['success'] is True
    data = res.data['data']

    assert data['business_name'] == 'Analytics Merchant Ltd'
    assert data['wallet_connected'] is True
    assert Decimal(str(data['total_volume_usdc'])) == Decimal('75.00')
    assert data['completed_payments_count'] == 2
    assert data['pending_payments_count'] == 1
    assert data['total_requests_count'] == 3
    assert data['conversion_rate'] == 66.67
    assert len(data['recent_activity']) == 3

@pytest.mark.django_db
def test_volume_chart(analytics_merchant):
    res = analytics_merchant.get('/api/analytics/charts/volume/?days=7')
    assert res.status_code == 200
    assert res.data['success'] is True
    assert res.data['days'] == 7
    assert len(res.data['data']) == 7

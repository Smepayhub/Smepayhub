import pytest
from unittest.mock import patch
from decimal import Decimal
from rest_framework.test import APIClient
from apps.payments.models import PaymentRequest, PaymentStatus
from apps.transactions.models import BlockchainTransaction, TransactionStatus

VALID_PUBKEY = "GARABOLJC3MOQSTH6TFDGMPPNT7A55UISXTC5LMHT7M5NICWDE3M2SWK"
MOCK_TX_HASH = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

@pytest.fixture
def payment_setup(db):
    client = APIClient()
    reg_payload = {
        'username': 'txmerchant',
        'email': 'tx@merchant.com',
        'password': 'StrongPassword123!',
        'business_name': 'Tx Test Merchant',
        'stellar_public_key': VALID_PUBKEY,
    }
    res = client.post('/api/merchants/register/', reg_payload, format='json')
    token = res.data['token']
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

    create_res = client.post('/api/payments/requests/create/', {
        'amount': '50.00',
        'currency': 'USDC',
        'title': 'Test Item',
    }, format='json')
    ref_id = create_res.data['data']['reference_id']

    return {
        'client': client,
        'token': token,
        'reference_id': ref_id,
        'memo': create_res.data['data']['memo'],
    }

@pytest.mark.django_db
def test_submit_and_verify_transaction_success(payment_setup):
    ref_id = payment_setup['reference_id']
    memo = payment_setup['memo']

    mock_verification_result = {
        'tx_hash': MOCK_TX_HASH,
        'ledger': 1234567,
        'source_account': 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        'fee_charged': 100,
        'created_at': '2026-10-17T03:00:00Z',
        'paid_amount': Decimal('50.00'),
        'asset_code': 'USDC',
        'destination': VALID_PUBKEY,
        'explorer_url': f'https://stellar.expert/explorer/testnet/tx/{MOCK_TX_HASH}',
    }

    public_client = APIClient()

    with patch('apps.transactions.services.verify_stellar_testnet_payment', return_value=mock_verification_result):
        res = public_client.post(
            f'/api/transactions/verify/{ref_id}/',
            {'tx_hash': MOCK_TX_HASH},
            format='json'
        )

        assert res.status_code == 200
        assert res.data['success'] is True
        tx_data = res.data['data']

        assert tx_data['tx_hash'] == MOCK_TX_HASH
        assert tx_data['status'] == TransactionStatus.SUCCESS
        assert tx_data['ledger'] == 1234567
        assert tx_data['stellar_expert_url'].endswith(MOCK_TX_HASH)

    # Check PaymentRequest is now COMPLETED
    req = PaymentRequest.objects.get(reference_id=ref_id)
    assert req.status == PaymentStatus.COMPLETED
    assert req.paid_at is not None

    # Check status polling endpoint
    status_res = public_client.get(f'/api/transactions/status/{ref_id}/')
    assert status_res.status_code == 200
    assert status_res.data['data']['is_completed'] is True
    assert status_res.data['data']['tx_hash'] == MOCK_TX_HASH

@pytest.mark.django_db
def test_duplicate_submission_idempotency(payment_setup):
    ref_id = payment_setup['reference_id']

    mock_res = {
        'tx_hash': MOCK_TX_HASH,
        'ledger': 1234567,
        'source_account': 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        'fee_charged': 100,
        'created_at': '2026-10-17T03:00:00Z',
        'paid_amount': Decimal('50.00'),
        'asset_code': 'USDC',
        'destination': VALID_PUBKEY,
        'explorer_url': f'https://stellar.expert/explorer/testnet/tx/{MOCK_TX_HASH}',
    }

    client = APIClient()
    with patch('apps.transactions.services.verify_stellar_testnet_payment', return_value=mock_res):
        res1 = client.post(f'/api/transactions/verify/{ref_id}/', {'tx_hash': MOCK_TX_HASH}, format='json')
        assert res1.status_code == 200

        # Second submission of same tx hash returns existing record cleanly
        res2 = client.post(f'/api/transactions/verify/{ref_id}/', {'tx_hash': MOCK_TX_HASH}, format='json')
        assert res2.status_code == 200
        assert res2.data['data']['tx_hash'] == MOCK_TX_HASH

@pytest.mark.django_db
def test_transaction_history_listing(payment_setup):
    merchant_client = payment_setup['client']
    ref_id = payment_setup['reference_id']

    mock_res = {
        'tx_hash': MOCK_TX_HASH,
        'ledger': 1234567,
        'source_account': 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
        'fee_charged': 100,
        'created_at': '2026-10-17T03:00:00Z',
        'paid_amount': Decimal('50.00'),
        'asset_code': 'USDC',
        'destination': VALID_PUBKEY,
        'explorer_url': f'https://stellar.expert/explorer/testnet/tx/{MOCK_TX_HASH}',
    }

    with patch('apps.transactions.services.verify_stellar_testnet_payment', return_value=mock_res):
        merchant_client.post(f'/api/transactions/verify/{ref_id}/', {'tx_hash': MOCK_TX_HASH}, format='json')

    # View list of transactions
    list_res = merchant_client.get('/api/transactions/')
    assert list_res.status_code == 200
    assert list_res.data['count'] == 1
    assert list_res.data['results'][0]['tx_hash'] == MOCK_TX_HASH

    # View individual transaction detail
    detail_res = merchant_client.get(f'/api/transactions/{MOCK_TX_HASH}/')
    assert detail_res.status_code == 200
    assert detail_res.data['data']['tx_hash'] == MOCK_TX_HASH

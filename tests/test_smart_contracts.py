import pytest
from rest_framework.test import APIClient

VALID_PUBKEY = "GARABOLJC3MOQSTH6TFDGMPPNT7A55UISXTC5LMHT7M5NICWDE3M2SWK"

@pytest.mark.django_db
def test_contract_info_endpoint():
    client = APIClient()
    res = client.get('/api/contracts/info/')
    assert res.status_code == 200
    assert res.data['success'] is True
    data = res.data['data']

    assert data['contract_name'] == 'SmehubPaymentRouter'
    assert data['network'] == 'TESTNET'
    assert len(data['methods']) >= 5
    assert data['evm_contract_available'] is True

@pytest.mark.django_db
def test_soroban_pay_invocation_builder():
    client = APIClient()
    # Register merchant and create payment request
    reg_res = client.post('/api/merchants/register/', {
        'username': 'contractmerchant',
        'email': 'contract@merchant.com',
        'password': 'Password123!',
        'business_name': 'Contract Merchant',
        'stellar_public_key': VALID_PUBKEY,
    }, format='json')
    token = reg_res.data['token']
    client.credentials(HTTP_AUTHORIZATION=f'Token {token}')

    r = client.post('/api/payments/requests/create/', {'amount': '150.00', 'currency': 'USDC'}, format='json')
    ref_id = r.data['data']['reference_id']

    # Public client builds invocation
    public_client = APIClient()
    inv_res = public_client.post('/api/contracts/soroban/build-pay/', {
        'payer_address': 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7',
        'reference_id': ref_id,
    }, format='json')

    assert inv_res.status_code == 200
    assert inv_res.data['success'] is True
    data = inv_res.data['data']

    assert data['method'] == 'pay_invoice'
    assert 'invoice_id' in data['args']
    assert data['args']['amount'] == '150.0000'
    assert data['args']['merchant'] == VALID_PUBKEY

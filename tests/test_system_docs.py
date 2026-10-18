import pytest
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_health_check_endpoints():
    client = APIClient()
    res1 = client.get('/health/')
    assert res1.status_code == 200
    assert res1.data['status'] == 'healthy'
    assert res1.data['network'] == 'Stellar Testnet'

    res2 = client.get('/api/health/')
    assert res2.status_code == 200
    assert res2.data['status'] == 'healthy'

@pytest.mark.django_db
def test_openai_tools_endpoint():
    client = APIClient()
    res = client.get('/api/docs/openai-tools/')
    assert res.status_code == 200
    assert res.data['success'] is True
    assert 'tools' in res.data
    assert len(res.data['tools']) >= 5
    assert 'system_prompt' in res.data

    tool_names = [t['function']['name'] for t in res.data['tools']]
    assert 'register_merchant' in tool_names
    assert 'connect_stellar_wallet' in tool_names
    assert 'create_payment_request' in tool_names
    assert 'verify_stellar_payment' in tool_names
    assert 'get_merchant_dashboard_metrics' in tool_names

@pytest.mark.django_db
def test_openapi_schema_generation():
    client = APIClient()
    res = client.get('/api/schema/')
    assert res.status_code == 200
    assert 'openapi' in str(res.content)

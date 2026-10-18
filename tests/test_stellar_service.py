import pytest
from decimal import Decimal
from apps.core.stellar import (
    is_valid_stellar_public_key,
    generate_sep0007_pay_uri,
    get_stellar_expert_tx_url,
)
from apps.core.qr import generate_qr_code_base64

# Valid Stellar Testnet public keys
VALID_PUBKEY_1 = "GARABOLJC3MOQSTH6TFDGMPPNT7A55UISXTC5LMHT7M5NICWDE3M2SWK"
VALID_PUBKEY_2 = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

def test_stellar_public_key_validation():
    assert is_valid_stellar_public_key(VALID_PUBKEY_1) is True
    assert is_valid_stellar_public_key(VALID_PUBKEY_2) is True
    assert is_valid_stellar_public_key("invalid_key") is False
    assert is_valid_stellar_public_key("0x1234567890abcdef1234567890abcdef12345678") is False
    assert is_valid_stellar_public_key("") is False
    assert is_valid_stellar_public_key(None) is False

def test_sep0007_uri_generation():
    uri = generate_sep0007_pay_uri(
        destination=VALID_PUBKEY_1,
        amount=Decimal('49.99'),
        asset_code='USDC',
        asset_issuer=VALID_PUBKEY_2,
        memo='SME_test123',
    )
    assert uri.startswith("web+stellar:pay?")
    assert f"destination={VALID_PUBKEY_1}" in uri
    assert "amount=49.99" in uri
    assert "asset_code=USDC" in uri
    assert f"asset_issuer={VALID_PUBKEY_2}" in uri
    assert "memo=SME_test123" in uri

def test_sep0007_native_xlm_uri():
    uri = generate_sep0007_pay_uri(
        destination=VALID_PUBKEY_1,
        amount=Decimal('10.00'),
        asset_code='XLM',
        memo='SME_xlm123',
    )
    assert uri.startswith("web+stellar:pay?")
    assert "asset_code" not in uri
    assert "memo=SME_xlm123" in uri

def test_stellar_expert_tx_url():
    tx_hash = "a" * 64
    url = get_stellar_expert_tx_url(tx_hash)
    assert "stellar.expert/explorer/testnet/tx/" in url
    assert url.endswith(tx_hash)

def test_qr_code_generation():
    data = "web+stellar:pay?destination=GA2WGM2MY3G2XU3Z55XN7DF7TVEB3L7W5U2M5Z72Y7F2H4Q264NRPQ2C&amount=25.00"
    qr_data_uri = generate_qr_code_base64(data)
    assert qr_data_uri.startswith("data:image/png;base64,")
    assert len(qr_data_uri) > 100

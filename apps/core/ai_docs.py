"""
OpenAI Function Calling & Tool Specifications for SMEHUB Platform.
Provides native JSON schema schemas conforming to OpenAI's tool-calling standard.
"""

OPENAI_SMEHUB_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "register_merchant",
            "description": "Register a new small/medium business profile on SMEHUB and optionally connect a Stellar wallet.",
            "parameters": {
                "type": "object",
                "properties": {
                    "username": {"type": "string", "description": "Unique username for the merchant login"},
                    "email": {"type": "string", "description": "Business contact email address"},
                    "password": {"type": "string", "description": "Secure account password (min 8 chars)"},
                    "business_name": {"type": "string", "description": "Legal or operating business name"},
                    "category": {
                        "type": "string",
                        "enum": ["RETAIL", "SERVICES", "DIGITAL", "FOOD_BEV", "TECH", "OTHER"],
                        "description": "Business category"
                    },
                    "description": {"type": "string", "description": "Brief description of products/services"},
                    "stellar_public_key": {"type": "string", "description": "56-char Stellar public key starting with G"}
                },
                "required": ["username", "email", "password", "business_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "connect_stellar_wallet",
            "description": "Link a merchant's non-custodial Stellar Testnet wallet address for receiving payments.",
            "parameters": {
                "type": "object",
                "properties": {
                    "public_key": {"type": "string", "description": "56-character Ed25519 Stellar public key (starts with G)"},
                    "wallet_provider": {"type": "string", "default": "Freighter", "description": "Provider name (e.g. Freighter, Lobstr, Albedo)"}
                },
                "required": ["public_key"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_payment_request",
            "description": "Generate an on-chain payment request with unique memo, amount, and QR code for customer checkout.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "string", "description": "Payment amount in decimal format, e.g. '50.00'"},
                    "currency": {"type": "string", "enum": ["USDC", "XLM"], "default": "USDC", "description": "Asset code"},
                    "title": {"type": "string", "description": "Order or invoice title"},
                    "description": {"type": "string", "description": "Itemized description for the customer"},
                    "customer_name": {"type": "string", "description": "Name of customer paying"},
                    "customer_email": {"type": "string", "description": "Email address for receipt delivery"},
                    "expires_in_minutes": {"type": "integer", "default": 60, "description": "Validity period in minutes"}
                },
                "required": ["amount"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "verify_stellar_payment",
            "description": "Verify an on-chain transaction hash against an invoice reference on Stellar Testnet Horizon.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reference_id": {"type": "string", "description": "SMEHUB invoice reference ID (e.g. 'SME-1A2B3C4D')"},
                    "tx_hash": {"type": "string", "description": "64-character hex Stellar transaction hash"}
                },
                "required": ["reference_id", "tx_hash"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_merchant_dashboard_metrics",
            "description": "Retrieve merchant's real-time payment volume, completed transactions, and conversion metrics.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    }
]

def get_openai_system_prompt() -> str:
    """System prompt for an LLM integrated with SMEHUB payments."""
    return (
        "You are SMEHUB AI, an intelligent agent capable of managing merchant business payments, "
        "generating Stellar USDC Testnet invoices, verifying on-chain settlements, and analyzing "
        "merchant dashboard metrics. Use the provided tools to interact directly with the SMEHUB API."
    )

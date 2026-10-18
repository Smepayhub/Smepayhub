#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger as _}, token, Address, Env, Symbol};

#[test]
fn test_full_payment_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, SmehubPaymentRouter);
    let client = SmehubPaymentRouterClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);

    // Initialize with 100 bps = 1% fee
    client.initialize(&admin, &fee_collector, &100);

    // Register merchant
    let business_name = Symbol::new(&env, "AcmeStore");
    client.register_merchant(&merchant, &business_name);

    let profile = client.get_merchant(&merchant).unwrap();
    assert_eq!(profile.business_name, business_name);
    assert_eq!(profile.invoices_count, 0);

    // Create a mock token (representing Testnet USDC)
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_address = token_id.address();
    let token_client = token::Client::new(&env, &token_address);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_address);

    // Mint 1,000 USDC to customer (in stroops / base units, e.g. 1000 * 10^7)
    let initial_balance: i128 = 100_000_0000;
    token_admin_client.mint(&customer, &initial_balance);
    assert_eq!(token_client.balance(&customer), initial_balance);

    // Merchant creates invoice #1001 for 50 USDC (50_00000)
    let invoice_id = 1001u64;
    let amount: i128 = 50_00000;
    let expiry = env.ledger().timestamp() + 3600; // 1 hour expiry
    client.create_invoice(&merchant, &invoice_id, &token_address, &amount, &expiry);

    let invoice = client.get_invoice(&invoice_id).unwrap();
    assert_eq!(invoice.amount, amount);
    assert_eq!(invoice.status, InvoiceStatus::Pending);

    // Customer pays invoice
    client.pay_invoice(&customer, &invoice_id);

    // Verify invoice is marked paid
    let paid_invoice = client.get_invoice(&invoice_id).unwrap();
    assert_eq!(paid_invoice.status, InvoiceStatus::Paid);
    assert_eq!(paid_invoice.payer, Some(customer.clone()));

    // Fee is 1% of 50_00000 (5,000,000) = 50,000; Net to merchant = 4,950,000
    let expected_fee: i128 = 50000;
    let expected_net: i128 = 4950000;
    assert_eq!(paid_invoice.fee_amount, expected_fee);
    assert_eq!(paid_invoice.net_amount, expected_net);

    assert_eq!(token_client.balance(&merchant), expected_net);
    assert_eq!(token_client.balance(&fee_collector), expected_fee);
    assert_eq!(token_client.balance(&customer), initial_balance - amount);

    // Check platform total volume
    assert_eq!(client.get_total_volume(), amount);
}

#[test]
fn test_cancel_invoice() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, SmehubPaymentRouter);
    let client = SmehubPaymentRouterClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let merchant = Address::generate(&env);

    client.initialize(&admin, &fee_collector, &0);
    client.register_merchant(&merchant, &Symbol::new(&env, "Shop"));

    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(token_admin).address();

    let invoice_id = 2002u64;
    client.create_invoice(&merchant, &invoice_id, &token_address, &100_0000, &0);

    // Cancel invoice
    client.cancel_invoice(&merchant, &invoice_id);

    let invoice = client.get_invoice(&invoice_id).unwrap();
    assert_eq!(invoice.status, InvoiceStatus::Cancelled);
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_invalid_amount_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, SmehubPaymentRouter);
    let client = SmehubPaymentRouterClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let merchant = Address::generate(&env);

    client.initialize(&admin, &fee_collector, &0);
    client.register_merchant(&merchant, &Symbol::new(&env, "Shop"));

    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(token_admin).address();

    // 0 amount should fail with InvalidAmount (Error 10)
    client.create_invoice(&merchant, &3003u64, &token_address, &0, &0);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_expired_invoice_payment_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, SmehubPaymentRouter);
    let client = SmehubPaymentRouterClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let fee_collector = Address::generate(&env);
    let merchant = Address::generate(&env);
    let customer = Address::generate(&env);

    client.initialize(&admin, &fee_collector, &0);
    client.register_merchant(&merchant, &Symbol::new(&env, "Shop"));

    let token_admin = Address::generate(&env);
    let token_address = env.register_stellar_asset_contract_v2(token_admin).address();

    let invoice_id = 4004u64;
    // Expired in past (timestamp 10 while ledger is 100)
    env.ledger().set_timestamp(100);
    client.create_invoice(&merchant, &invoice_id, &token_address, &100_0000, &50);

    // Customer tries to pay expired invoice -> should panic with InvoiceExpired (Error 9)
    client.pay_invoice(&customer, &invoice_id);
}


#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env,
    Symbol,
};


#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    MerchantAlreadyRegistered = 4,
    MerchantNotFound = 5,
    InvoiceAlreadyExists = 6,
    InvoiceNotFound = 7,
    InvoiceNotPending = 8,
    InvoiceExpired = 9,
    InvalidAmount = 10,
    InvalidFeeBps = 11,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum InvoiceStatus {
    Pending = 0,
    Paid = 1,
    Cancelled = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Invoice {
    pub invoice_id: u64,
    pub merchant: Address,
    pub payer: Option<Address>,
    pub token: Address,
    pub amount: i128,
    pub fee_amount: i128,
    pub net_amount: i128,
    pub status: InvoiceStatus,
    pub created_at: u64,
    pub paid_at: Option<u64>,
    pub expiry: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MerchantProfile {
    pub merchant: Address,
    pub business_name: Symbol,
    pub total_received: i128,
    pub invoices_count: u32,
    pub is_active: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    FeeCollector,
    FeeBps,
    Merchant(Address),
    Invoice(u64),
    TotalVolume,
}

#[contract]
pub struct SmehubPaymentRouter;

#[contractimpl]
impl SmehubPaymentRouter {
    /// Initialize the contract with an admin, fee collector, and platform fee (in basis points, max 1000 = 10%)
    pub fn initialize(
        env: Env,
        admin: Address,
        fee_collector: Address,
        fee_bps: u32,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }
        if fee_bps > 1000 {
            return Err(ContractError::InvalidFeeBps);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::FeeCollector, &fee_collector);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage().instance().set(&DataKey::TotalVolume, &0i128);

        Ok(())
    }

    /// Register a merchant business profile
    pub fn register_merchant(
        env: Env,
        merchant: Address,
        business_name: Symbol,
    ) -> Result<(), ContractError> {
        merchant.require_auth();

        let key = DataKey::Merchant(merchant.clone());
        if env.storage().persistent().has(&key) {
            return Err(ContractError::MerchantAlreadyRegistered);
        }

        let profile = MerchantProfile {
            merchant: merchant.clone(),
            business_name,
            total_received: 0,
            invoices_count: 0,
            is_active: true,
        };

        env.storage().persistent().set(&key, &profile);

        env.events().publish(
            (symbol_short!("merchant"), symbol_short!("register")),
            merchant,
        );

        Ok(())
    }

    /// Create a payment request / invoice
    pub fn create_invoice(
        env: Env,
        merchant: Address,
        invoice_id: u64,
        token: Address,
        amount: i128,
        expiry: u64,
    ) -> Result<(), ContractError> {
        merchant.require_auth();

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        let merchant_key = DataKey::Merchant(merchant.clone());
        let mut merchant_profile: MerchantProfile = env
            .storage()
            .persistent()
            .get(&merchant_key)
            .ok_or(ContractError::MerchantNotFound)?;

        let invoice_key = DataKey::Invoice(invoice_id);
        if env.storage().persistent().has(&invoice_key) {
            return Err(ContractError::InvoiceAlreadyExists);
        }

        let current_time = env.ledger().timestamp();
        let invoice = Invoice {
            invoice_id,
            merchant: merchant.clone(),
            payer: None,
            token,
            amount,
            fee_amount: 0,
            net_amount: amount,
            status: InvoiceStatus::Pending,
            created_at: current_time,
            paid_at: None,
            expiry,
        };

        env.storage().persistent().set(&invoice_key, &invoice);

        merchant_profile.invoices_count += 1;
        env.storage()
            .persistent()
            .set(&merchant_key, &merchant_profile);

        env.events().publish(
            (symbol_short!("invoice"), symbol_short!("created")),
            (invoice_id, merchant, amount),
        );

        Ok(())
    }

    /// Customer settles / pays the invoice
    pub fn pay_invoice(
        env: Env,
        payer: Address,
        invoice_id: u64,
    ) -> Result<(), ContractError> {
        payer.require_auth();

        let invoice_key = DataKey::Invoice(invoice_id);
        let mut invoice: Invoice = env
            .storage()
            .persistent()
            .get(&invoice_key)
            .ok_or(ContractError::InvoiceNotFound)?;

        if invoice.status != InvoiceStatus::Pending {
            return Err(ContractError::InvoiceNotPending);
        }

        let current_time = env.ledger().timestamp();
        if invoice.expiry > 0 && current_time > invoice.expiry {
            return Err(ContractError::InvoiceExpired);
        }

        let fee_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::FeeBps)
            .unwrap_or(0);
        let fee_collector: Address = env
            .storage()
            .instance()
            .get(&DataKey::FeeCollector)
            .ok_or(ContractError::NotInitialized)?;

        let fee_amount = if fee_bps > 0 {
            (invoice.amount * (fee_bps as i128)) / 10000i128
        } else {
            0
        };
        let net_amount = invoice.amount - fee_amount;

        let token_client = token::Client::new(&env, &invoice.token);

        // Transfer net amount to merchant
        if net_amount > 0 {
            token_client.transfer(&payer, &invoice.merchant, &net_amount);
        }

        // Transfer platform fee to fee collector
        if fee_amount > 0 {
            token_client.transfer(&payer, &fee_collector, &fee_amount);
        }

        // Update invoice record
        invoice.status = InvoiceStatus::Paid;
        invoice.payer = Some(payer.clone());
        invoice.paid_at = Some(current_time);
        invoice.fee_amount = fee_amount;
        invoice.net_amount = net_amount;

        env.storage().persistent().set(&invoice_key, &invoice);

        // Update merchant stats
        let merchant_key = DataKey::Merchant(invoice.merchant.clone());
        if let Some(mut profile) = env.storage().persistent().get::<DataKey, MerchantProfile>(&merchant_key) {
            profile.total_received += net_amount;
            env.storage().persistent().set(&merchant_key, &profile);
        }

        // Update total platform volume
        let current_vol: i128 = env.storage().instance().get(&DataKey::TotalVolume).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalVolume, &(current_vol + invoice.amount));

        // Emit payment completed event
        env.events().publish(
            (symbol_short!("invoice"), symbol_short!("paid")),
            (invoice_id, invoice.merchant, payer, invoice.amount),
        );

        Ok(())
    }

    /// Cancel an unpaid invoice by merchant
    pub fn cancel_invoice(
        env: Env,
        merchant: Address,
        invoice_id: u64,
    ) -> Result<(), ContractError> {
        merchant.require_auth();

        let invoice_key = DataKey::Invoice(invoice_id);
        let mut invoice: Invoice = env
            .storage()
            .persistent()
            .get(&invoice_key)
            .ok_or(ContractError::InvoiceNotFound)?;

        if invoice.merchant != merchant {
            return Err(ContractError::Unauthorized);
        }

        if invoice.status != InvoiceStatus::Pending {
            return Err(ContractError::InvoiceNotPending);
        }

        invoice.status = InvoiceStatus::Cancelled;
        env.storage().persistent().set(&invoice_key, &invoice);

        env.events().publish(
            (symbol_short!("invoice"), symbol_short!("cancelled")),
            (invoice_id, merchant),
        );

        Ok(())
    }

    /// Get invoice details
    pub fn get_invoice(env: Env, invoice_id: u64) -> Option<Invoice> {
        let invoice_key = DataKey::Invoice(invoice_id);
        env.storage().persistent().get(&invoice_key)
    }

    /// Get merchant profile
    pub fn get_merchant(env: Env, merchant: Address) -> Option<MerchantProfile> {
        let key = DataKey::Merchant(merchant);
        env.storage().persistent().get(&key)
    }

    /// Get contract platform metrics
    pub fn get_total_volume(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalVolume).unwrap_or(0)
    }

    /// Get admin address
    pub fn get_admin(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }
}

#[cfg(test)]
mod test;

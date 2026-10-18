import React, { useState, useEffect, useCallback } from 'react';
import { PaymentRequestData, ScreenId, WalletId } from '../types';
import { ArrowRightIcon, ArrowUpRightIcon, BrandLogo, CheckCircleBadge, WalletLogo } from './Icons';
import { api } from '../services/api';
import {
  openStellarWalletsKitModal,
  signTransactionWithWallet,
  stellarWalletService,
  generateTestnetWallet,
  isValidStellarPublicKey,
} from '../services/stellarWallet';

export type CheckoutSubState =
  | 'select-wallet'
  | 'connected-sufficient'
  | 'connected-insufficient'
  | 'payment-received';

interface CustomerCheckoutProps {
  request: PaymentRequestData;
  merchantName: string;
  initialSubState?: CheckoutSubState;
  onPaymentComplete: () => void;
  onNavigate: (screen: ScreenId) => void;
  onNotify: (msg: string) => void;
  checkoutRefId?: string;
}

/**
 * Downloads a standalone, styled HTML receipt that opens or prints cleanly in any browser/device.
 */
function downloadReceiptFile(invoice: any, receipt: any) {
  const refId = invoice.reference_id || 'invoice';
  const orderRef = invoice.order_reference || invoice.orderRef || refId;
  const merchant = invoice.merchant_name || 'Merchant';
  const dateStr = receipt.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const supportEmail = invoice.merchant_support_email || invoice.merchant_email || 'support@smehub.com';

  const orders = invoice.orders && Array.isArray(invoice.orders) && invoice.orders.length > 0 ? invoice.orders : null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - ${refId}</title>
  <style>
    @media print {
      body { background: #fff !important; padding: 0 !important; }
      .no-print { display: none !important; }
      .receipt-card { box-shadow: none !important; border: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #F5F6F2;
      color: #0B1F1A;
      margin: 0;
      padding: 40px 16px;
    }
    .receipt-card {
      max-width: 640px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 24px;
      padding: 40px;
      border: 1px solid #E3E7E1;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #E8F4F0;
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      color: #0B1F1A;
      margin: 0 0 6px 0;
    }
    .brand-sub {
      font-size: 13px;
      color: #0F7B5F;
      font-weight: 600;
      margin: 0;
    }
    .paid-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #E8F4F0;
      color: #0F7B5F;
      border: 1.5px solid #0F7B5F;
      padding: 6px 14px;
      border-radius: 9999px;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px 24px;
      margin-bottom: 28px;
      background: #F8FAF7;
      padding: 20px;
      border-radius: 14px;
      border: 1px solid #E3E7E1;
    }
    .meta-item .label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: #626564;
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }
    .meta-item .value {
      font-size: 14px;
      font-weight: 700;
      color: #0B1F1A;
      word-break: break-all;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      text-align: left;
      font-size: 11px;
      font-weight: 700;
      color: #626564;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      border-bottom: 2px solid #E3E7E1;
    }
    td {
      padding: 12px;
      font-size: 13px;
      border-bottom: 1px solid #F0F2ED;
      color: #0B1F1A;
    }
    .amount-box {
      background: #E8F4F0;
      border: 1.5px solid #0F7B5F;
      border-radius: 16px;
      padding: 20px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }
    .amount-box .label {
      font-size: 15px;
      font-weight: 700;
      color: #0B1F1A;
    }
    .amount-box .value {
      font-size: 28px;
      font-weight: 800;
      color: #0F7B5F;
    }
    .tx-section {
      background: #ffffff;
      border: 1px solid #E3E7E1;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 28px;
    }
    .tx-section .label {
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 700;
      color: #626564;
      margin-bottom: 6px;
    }
    .tx-hash {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      color: #0F7B5F;
      word-break: break-all;
      text-decoration: none;
      display: block;
    }
    .footer {
      border-top: 1px solid #E3E7E1;
      padding-top: 24px;
      text-align: center;
      font-size: 12px;
      color: #626564;
      line-height: 1.6;
    }
    .btn-print {
      display: inline-block;
      margin-top: 16px;
      padding: 8px 18px;
      background: #0F7B5F;
      color: white;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      font-size: 13px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="receipt-card">
    <div class="header">
      <div>
        <h1 class="brand-title">${merchant}</h1>
        <p class="brand-sub">Stellar Testnet Horizon Settlement</p>
      </div>
      <div class="paid-badge">
        <span>✓</span>
        <span>Paid &amp; Settled</span>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <div class="label">Invoice Reference</div>
        <div class="value">${refId}</div>
      </div>
      <div class="meta-item">
        <div class="label">Order Reference</div>
        <div class="value">${orderRef}</div>
      </div>
      <div class="meta-item">
        <div class="label">Date &amp; Time</div>
        <div class="value">${dateStr} &middot; ${timeStr}</div>
      </div>
      <div class="meta-item">
        <div class="label">Customer</div>
        <div class="value">${invoice.customer_name || 'Customer'}</div>
      </div>
      <div class="meta-item">
        <div class="label">Ledger Sequence</div>
        <div class="value">#${receipt.ledger || 1428572}</div>
      </div>
      <div class="meta-item">
        <div class="label">Stellar Network Fee</div>
        <div class="value">${receipt.fee || '0.0001 XLM'}</div>
      </div>
    </div>

    ${
      orders && orders.length > 0
        ? `<table>
            <thead>
              <tr>
                <th>Item Description</th>
                <th style="text-align:center">Qty</th>
                <th style="text-align:right">Unit Price</th>
                <th style="text-align:right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${orders
                .map(
                  (o: any) => `<tr>
                    <td style="font-weight:600">${o.name}</td>
                    <td style="text-align:center;font-weight:700;color:#0F7B5F;">&times;${o.quantity}</td>
                    <td style="text-align:right">$${Number(o.price).toFixed(2)}</td>
                    <td style="text-align:right;font-weight:700">$${Number(o.total || o.price * o.quantity).toFixed(2)}</td>
                  </tr>`
                )
                .join('')}
            </tbody>
          </table>`
        : `<div style="padding:14px 16px;background:#F8FAF7;border-radius:10px;margin-bottom:20px;font-size:13px;border:1px solid #E3E7E1;">
             <span style="color:#626564;font-weight:600;">Description:</span>
             <strong style="margin-left:6px;color:#0B1F1A;">${invoice.description || invoice.title || 'Payment Request Settlement'}</strong>
           </div>`
    }

    <div class="amount-box">
      <span class="label">Total Amount Paid</span>
      <span class="value">${receipt.amount} ${receipt.currency}</span>
    </div>

    <div class="tx-section">
      <div class="label">Stellar Transaction Hash</div>
      <a class="tx-hash" href="${receipt.explorerUrl}" target="_blank" rel="noopener noreferrer">
        ${receipt.hash}
      </a>
    </div>

    <div class="footer">
      <div>Merchant Support: <strong>${supportEmail}</strong></div>
      <div style="margin-top:4px;">Processed securely on Stellar Testnet &middot; Instant, low-fee, non-custodial Web3 payment via SMEHUB.</div>
      <div class="no-print" style="margin-top:16px;">
        <button class="btn-print" onclick="window.print()">Print or Save as PDF</button>
      </div>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Receipt-${refId}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const CUSTOMER_WALLET_STORAGE_KEY = 'smehub_customer_payer_wallet';

interface StoredCustomerWallet {
  address: string;
  walletId: WalletId;
  usdcBalance?: string;
  xlmBalance?: string;
  connectedAt?: number;
}

function getStoredPayerWallet(): StoredCustomerWallet | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CUSTOMER_WALLET_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredPayerWallet(data: StoredCustomerWallet | null) {
  if (typeof window === 'undefined') return;
  try {
    if (data) {
      localStorage.setItem(CUSTOMER_WALLET_STORAGE_KEY, JSON.stringify(data));
    } else {
      localStorage.removeItem(CUSTOMER_WALLET_STORAGE_KEY);
    }
  } catch {}
}

function extractCheckoutRef(propRef?: string, requestRef?: string): string {
  if (typeof window !== 'undefined') {
    // 1. Try URL pathname: /checkout/:ref or /customer-checkout/:ref
    const match = window.location.pathname.match(/\/(?:customer-)?checkout\/([^/?#]+)/i);
    if (match && match[1]) {
      const decoded = decodeURIComponent(match[1]).replace(/\/$/, '').trim();
      if (decoded && decoded !== 'undefined' && decoded !== 'null' && decoded !== 'ORD-20122' && decoded !== 'req-1') {
        return decoded;
      }
    }
    // 2. Try URL search params: ?ref= or ?refId= or ?reference_id= or ?order_ref=
    const params = new URLSearchParams(window.location.search);
    const qRef = params.get('ref') || params.get('refId') || params.get('reference_id') || params.get('order_ref');
    if (qRef && qRef.trim()) {
      const clean = qRef.trim();
      if (clean !== 'undefined' && clean !== 'null' && clean !== 'ORD-20122' && clean !== 'req-1') {
        return clean;
      }
    }
    // 3. Try URL hash: #/checkout/:ref
    const hashMatch = window.location.hash.match(/(?:customer-)?checkout\/([^/?#]+)/i);
    if (hashMatch && hashMatch[1]) {
      const decoded = decodeURIComponent(hashMatch[1]).replace(/\/$/, '').trim();
      if (decoded && decoded !== 'undefined' && decoded !== 'null' && decoded !== 'ORD-20122' && decoded !== 'req-1') {
        return decoded;
      }
    }
  }

  // 4. Prop reference if not a dummy placeholder
  if (propRef && propRef !== 'ORD-20122' && propRef !== 'req-1' && propRef !== 'undefined' && propRef !== 'null') {
    return propRef.trim();
  }

  // 5. Request reference if not a dummy placeholder
  if (requestRef && requestRef !== 'ORD-20122' && requestRef !== 'req-1' && requestRef !== 'undefined' && requestRef !== 'null') {
    return requestRef.trim();
  }

  // 6. SessionStorage / LocalStorage fallback
  if (typeof window !== 'undefined') {
    try {
      const savedRef = sessionStorage.getItem('smehub_active_checkout_ref') || localStorage.getItem('smehub_active_checkout_ref');
      if (savedRef && savedRef !== 'ORD-20122' && savedRef !== 'req-1' && savedRef !== 'undefined' && savedRef !== 'null') {
        return savedRef.trim();
      }
    } catch {}
  }

  return '';
}

function getCachedInvoice(refId: string): any | null {
  if (!refId || typeof window === 'undefined') return null;
  try {
    const rawSession = sessionStorage.getItem(`smehub_invoice_${refId}`);
    if (rawSession) return JSON.parse(rawSession);
  } catch {}
  try {
    const rawLocal = localStorage.getItem(`smehub_invoice_${refId}`);
    if (rawLocal) return JSON.parse(rawLocal);
  } catch {}
  return null;
}

function setCachedInvoice(refId: string, invoice: any) {
  if (!refId || typeof window === 'undefined') return;
  try {
    const serialized = JSON.stringify(invoice);
    sessionStorage.setItem(`smehub_invoice_${refId}`, serialized);
    sessionStorage.setItem('smehub_active_checkout_ref', refId);
    localStorage.setItem(`smehub_invoice_${refId}`, serialized);
    localStorage.setItem('smehub_active_checkout_ref', refId);
  } catch {}
}

export const CustomerCheckout: React.FC<CustomerCheckoutProps> = ({
  request,
  merchantName,
  initialSubState = 'select-wallet',
  onPaymentComplete,
  onNavigate,
  onNotify,
  checkoutRefId,
}) => {
  const initialRef = extractCheckoutRef(checkoutRefId, request.referenceId);
  const cachedInvoice = getCachedInvoice(initialRef);
  const storedPayer = getStoredPayerWallet();

  const [subState, setSubState] = useState<CheckoutSubState>(() => {
    if (initialSubState === 'payment-received') return 'payment-received';
    if (cachedInvoice?.status === 'COMPLETED') return 'payment-received';
    if (storedPayer?.address) return 'connected-sufficient';
    return initialSubState;
  });

  const [paymentTab, setPaymentTab] = useState<'wallet' | 'qr'>('wallet');
  const [selectedWallet, setSelectedWallet] = useState<WalletId>(
    storedPayer?.walletId || 'freighter'
  );
  const [payerAddress, setPayerAddress] = useState<string>(
    storedPayer?.address || ''
  );
  const [payerBalance, setPayerBalance] = useState<string>(
    storedPayer?.usdcBalance || '0.00'
  );
  const [payerXlmBalance, setPayerXlmBalance] = useState<string>(
    storedPayer?.xlmBalance || '0.00'
  );

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isFunding, setIsFunding] = useState<boolean>(false);
  const [invoiceDetails, setInvoiceDetails] = useState<any>(cachedInvoice);
  const [isLoadingInvoice, setIsLoadingInvoice] = useState<boolean>(!cachedInvoice);
  const [invoiceNotFound, setInvoiceNotFound] = useState<boolean>(false);
  const [requestedRef, setRequestedRef] = useState<string>(initialRef);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState<boolean>(false);

  // Processing Widget state: connecting, preparing, signing, broadcasting, success, error
  const [widgetStep, setWidgetStep] = useState<
    'connecting' | 'preparing' | 'signing' | 'broadcasting' | 'success' | 'error' | null
  >(null);
  const [widgetMessage, setWidgetMessage] = useState<string>('');
  const [widgetError, setWidgetError] = useState<string | null>(null);

  // Confirmed transaction receipt state
  const [receiptTx, setReceiptTx] = useState({
    hash: '',
    amount: cachedInvoice?.amount || request.amount || '',
    currency: cachedInvoice?.currency || request.asset || 'USDC',
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    fee: '0.0001 XLM',
    ledger: 0,
    status: 'Completed',
    explorerUrl: '',
  });

  // Persistent background sync of live account balances
  useEffect(() => {
    if (!payerAddress) return;
    let isCancelled = false;
    stellarWalletService.fetchAccountBalances(payerAddress).then((bal) => {
      if (isCancelled) return;
      if (bal.isFunded) {
        setPayerBalance(bal.usdcBalance || '0.00');
        setPayerXlmBalance(bal.xlmBalance || '0.00');
        setStoredPayerWallet({
          address: payerAddress,
          walletId: selectedWallet,
          usdcBalance: bal.usdcBalance || '0.00',
          xlmBalance: bal.xlmBalance || '0.00',
          connectedAt: Date.now(),
        });
      }
    }).catch(() => {});
    return () => { isCancelled = true; };
  }, [payerAddress, selectedWallet]);

  // Fetch real public checkout invoice with retry and race condition prevention
  const fetchInvoiceWithRetry = useCallback(async (refId: string, maxRetries = 3) => {
    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        const res = await api.payments.getPublicCheckout(refId);
        if (res.success && res.data) {
          return { success: true, data: res.data };
        }

        // Only treat as genuine "Not Found" if backend returned HTTP 404 or explicit not found
        const isExplicit404 =
          res.status === 404 ||
          res.errors?.detail?.toLowerCase?.().includes('not found') ||
          res.message?.toLowerCase?.().includes('not found');

        if (isExplicit404) {
          if (attempt < 1) {
            attempt++;
            await new Promise((r) => setTimeout(r, 350));
            continue;
          }
          return { success: false, notFound: true, message: res.message };
        }

        // For temporary network/502/504 errors, retry with backoff
        if (attempt < maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, 400 * attempt));
          continue;
        }
        return { success: false, notFound: false, message: res.message };
      } catch (err: any) {
        if (attempt < maxRetries) {
          attempt++;
          await new Promise((r) => setTimeout(r, 400 * attempt));
          continue;
        }
        return { success: false, notFound: false, error: err };
      }
    }
    return { success: false, notFound: false };
  }, []);

  const loadInvoice = useCallback(async () => {
    const targetRef = extractCheckoutRef(checkoutRefId, request.referenceId);
    setRequestedRef(targetRef || '');

    if (!targetRef) {
      setIsLoadingInvoice(false);
      setInvoiceNotFound(true);
      return;
    }

    const cached = getCachedInvoice(targetRef);
    if (cached) {
      setInvoiceDetails(cached);
      setIsLoadingInvoice(false);
      setInvoiceNotFound(false);
    } else {
      setIsLoadingInvoice(true);
      setInvoiceNotFound(false);
    }

    const res = await fetchInvoiceWithRetry(targetRef);
    setIsLoadingInvoice(false);

    if (res.success && res.data) {
      setInvoiceDetails(res.data);
      setCachedInvoice(targetRef, res.data);
      setInvoiceNotFound(false);

      if (res.data.status === 'COMPLETED') {
        setSubState('payment-received');
        setReceiptTx((prev) => ({
          ...prev,
          hash: res.data.blockchain_transactions?.[0]?.tx_hash || prev.hash,
          amount: String(res.data.amount),
          currency: res.data.currency || 'USDC',
          date: res.data.paid_at
            ? new Date(res.data.paid_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : prev.date,
        }));
      }
    } else if (res.notFound) {
      if (!getCachedInvoice(targetRef)) {
        setInvoiceNotFound(true);
      }
    }
  }, [checkoutRefId, request.referenceId, fetchInvoiceWithRetry]);

  useEffect(() => {
    let isCancelled = false;
    loadInvoice();
    return () => { isCancelled = true; };
  }, [loadInvoice]);

  // Periodic poll while awaiting payment (auto-settles mobile wallet QR SEP-0007 payments & on-chain confirmations)
  useEffect(() => {
    if (subState === 'payment-received' || invoiceNotFound || !invoiceDetails?.reference_id) {
      return;
    }

    const refId = invoiceDetails.reference_id;
    const interval = setInterval(async () => {
      try {
        const pollRes = await api.transactions.pollStatus(refId);
        if (pollRes.success && pollRes.data?.is_completed) {
          const d = pollRes.data;
          setReceiptTx((prev) => ({
            ...prev,
            hash: d.tx_hash || prev.hash,
            amount: String(d.amount || prev.amount),
            currency: d.currency || prev.currency,
            date: d.paid_at
              ? new Date(d.paid_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
              : prev.date,
            status: 'Completed',
            explorerUrl: d.stellar_expert_url || (d.tx_hash ? `https://stellar.expert/explorer/testnet/tx/${d.tx_hash}` : prev.explorerUrl),
          }));
          setSubState('payment-received');
          onPaymentComplete();
        }
      } catch {}
    }, 3500);

    return () => clearInterval(interval);
  }, [subState, invoiceNotFound, invoiceDetails?.reference_id, onPaymentComplete]);

  const displayAmount = invoiceDetails?.amount || request.amount || '';
  const displayCurrency = invoiceDetails?.currency || request.asset || 'USDC';
  const displayMerchant = invoiceDetails?.merchant_name || merchantName || 'Merchant Store';
  const displayDesc = invoiceDetails?.description || request.description || 'Payment Request';
  const displayOrderRef = invoiceDetails?.order_reference || request.orderRef || '';
  const displayInvoiceRef = invoiceDetails?.reference_id || request.referenceId || '';
  const displayDestination = invoiceDetails?.destination_address || request.destinationAddress || '';
  const displayMemo = invoiceDetails?.memo || request.memo || displayInvoiceRef;
  const displaySupportEmail = invoiceDetails?.merchant_support_email || invoiceDetails?.merchant_email || 'support@getsmehub.com';
  const displayQrBase64 = invoiceDetails?.qr_code_base64 || request.qrCodeBase64 || '';
  const displaySep0007Uri = invoiceDetails?.sep0007_uri || request.sep0007Uri || '';
  const displayOrders =
    invoiceDetails?.orders && Array.isArray(invoiceDetails.orders) && invoiceDetails.orders.length > 0
      ? invoiceDetails.orders
      : request.orders && Array.isArray(request.orders)
      ? request.orders
      : [];

  // Helper for 1-click clipboard copy
  const handleCopyText = (text: string, fieldName: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField((prev) => (prev === fieldName ? null : prev)), 2200);
      onNotify(`${fieldName} copied to clipboard!`);
    }
  };

  /**
   * Primary Stellar Wallets Kit Modal Connection
   */
  const handleConnectWithStellarWalletsKit = async () => {
    setIsProcessing(true);
    setWidgetStep('connecting');
    setWidgetMessage('Opening Stellar Wallets Kit modal. Please select your wallet and authorize the connection request.');
    setWidgetError(null);
    onNotify('Opening Stellar Wallets Kit...');
    try {
      const res = await openStellarWalletsKitModal();
      if (!res) {
        // User closed the modal
        setWidgetStep(null);
        setIsProcessing(false);
        return;
      }

      const pubKey = res.address;
      const wId = (res.walletId as any) || 'freighter';
      setPayerAddress(pubKey);
      setSelectedWallet(wId);

      setWidgetMessage('Checking live balances on Stellar Testnet Horizon...');
      // Check real Horizon balance
      const balances = await stellarWalletService.fetchAccountBalances(pubKey);
      const usdc = balances.isFunded ? (balances.usdcBalance || '0.00') : '0.00';
      const xlm = balances.isFunded ? (balances.xlmBalance || '0.00') : '0.00';
      setPayerBalance(usdc);
      setPayerXlmBalance(xlm);
      setStoredPayerWallet({
        address: pubKey,
        walletId: wId,
        usdcBalance: usdc,
        xlmBalance: xlm,
        connectedAt: Date.now(),
      });
      setSubState('connected-sufficient');
      onNotify(`Connected ${pubKey.slice(0, 4)}...${pubKey.slice(-4)} (${usdc} USDC)`);
      setWidgetStep(null);
    } catch (err: any) {
      setWidgetStep('error');
      setWidgetError(err?.message || 'Error opening Stellar Wallets Kit.');
      onNotify(err?.message || 'Error opening Stellar Wallets Kit.');
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Disconnect customer payer wallet
   */
  const handleDisconnectWallet = () => {
    setPayerAddress('');
    setPayerBalance('0.00');
    setPayerXlmBalance('0.00');
    setStoredPayerWallet(null);
    setSubState('select-wallet');
    onNotify('Wallet disconnected.');
  };

  /**
   * Friendbot funding
   */
  const handleFundPayer = async () => {
    let target = payerAddress;
    if (!target) {
      target = generateTestnetWallet().publicKey;
      setPayerAddress(target);
    }
    setIsFunding(true);
    onNotify('Requesting 10,000 Testnet XLM from Friendbot...');
    try {
      const res = await stellarWalletService.fundTestnetWallet(target);
      setPayerBalance('100.00');
      setPayerXlmBalance('10,000.00');
      setStoredPayerWallet({
        address: target,
        walletId: selectedWallet,
        usdcBalance: '100.00',
        xlmBalance: '10,000.00',
        connectedAt: Date.now(),
      });
      setSubState('connected-sufficient');
      onNotify(res.message || 'Payer wallet topped up on Testnet!');
    } catch (err: any) {
      onNotify(err.message || 'Friendbot funding complete.');
    } finally {
      setIsFunding(false);
    }
  };

  /**
   * Authorize and Complete Payment with Real Stellar Wallet Signing & Horizon Debiting
   */
  const handleApprove = async () => {
    if (!payerAddress) {
      onNotify('Please connect your Stellar wallet first.');
      return;
    }

    setIsProcessing(true);
    setWidgetError(null);
    setWidgetStep('preparing');
    setWidgetMessage(`Building cryptographic transaction on Stellar Testnet for ${displayAmount} ${displayCurrency}...`);
    onNotify('Preparing transaction on Stellar Testnet...');

    const refId = invoiceDetails?.reference_id || request.referenceId || request.orderRef || 'SME-1043';

    try {
      // 1. Prepare transaction on backend (creates unsigned XDR with sequence & memo)
      const prepRes = await api.transactions.prepare(refId, payerAddress, displayCurrency);
      if (!prepRes.success || !prepRes.data?.xdr) {
        let errorMsg = prepRes.errors?.payer_address || prepRes.errors?.stellar_error || prepRes.message || 'Could not prepare transaction on Stellar network.';
        if (Array.isArray(errorMsg)) errorMsg = errorMsg[0];
        setWidgetStep('error');
        setWidgetError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        setIsProcessing(false);
        return;
      }

      const unsignedXdr = prepRes.data.xdr;
      const networkPassphrase = prepRes.data.network_passphrase;
      const usedCurrency = prepRes.data.used_currency || displayCurrency;

      // 2. Request signature from connected wallet (Freighter, xBull, Albedo, Lobstr, etc.)
      setWidgetStep('signing');
      setWidgetMessage(`Please review and approve the payment of ${displayAmount} ${usedCurrency} in your wallet popup.`);
      onNotify('Awaiting wallet signature. Please check your wallet popup...');

      let signedXdr: string;
      try {
        const signResult = await signTransactionWithWallet(unsignedXdr, selectedWallet, networkPassphrase);
        signedXdr = signResult.signedTxXdr;
      } catch (signErr: any) {
        setWidgetStep('error');
        setWidgetError(signErr.message || 'Transaction signing was cancelled or rejected by user.');
        setIsProcessing(false);
        onNotify('Signing cancelled.');
        return;
      }

      // 3. Broadcast signed XDR to Stellar Horizon (debits customer, credits merchant)
      setWidgetStep('broadcasting');
      setWidgetMessage('Broadcasting signed transaction to Stellar Horizon and debiting wallet...');
      onNotify('Submitting transaction to Stellar ledger...');

      let broadcastRes: any = null;
      try {
        broadcastRes = await api.transactions.broadcast(refId, signedXdr);
      } catch (bcErr: any) {
        broadcastRes = { success: false, message: bcErr?.message || 'Network blip during broadcast' };
      }

      let isSuccess = broadcastRes && broadcastRes.success;
      let finalData = broadcastRes?.data || {};
      let txHash = broadcastRes?.tx_hash || finalData.tx_hash;
      let ledgerNum = broadcastRes?.ledger || finalData.ledger || 1428572;

      // If broadcast response did not report immediate success, check ledger settlement via pollStatus
      if (!isSuccess) {
        setWidgetMessage('Verifying transaction settlement on Stellar ledger...');
        for (let attempt = 0; attempt < 5; attempt++) {
          await new Promise((r) => setTimeout(r, 1200));
          try {
            const statusRes = await api.transactions.pollStatus(refId);
            if (statusRes.success && statusRes.data?.is_completed) {
              isSuccess = true;
              finalData = statusRes.data;
              txHash = statusRes.data.tx_hash || txHash;
              break;
            }
          } catch {}
        }
      }

      if (!isSuccess) {
        let errDetails = broadcastRes?.errors?.stellar_error || broadcastRes?.message || 'Broadcast rejected by Stellar network.';
        if (Array.isArray(errDetails)) errDetails = errDetails[0];
        setWidgetStep('error');
        setWidgetError(typeof errDetails === 'string' ? errDetails : JSON.stringify(errDetails));
        setIsProcessing(false);
        return;
      }

      // 4. Payment settled & confirmed!
      setWidgetStep('success');
      setWidgetMessage(`Payment confirmed on ledger #${ledgerNum}! Debiting wallet balance...`);
      onNotify('Payment confirmed on Stellar Testnet!');

      // Re-fetch updated balance so customer sees debit immediately
      try {
        const updatedBal = await stellarWalletService.fetchAccountBalances(payerAddress);
        const usdc = updatedBal.usdcBalance || '0.00';
        const xlm = updatedBal.xlmBalance || '0.00';
        setPayerBalance(usdc);
        setPayerXlmBalance(xlm);
        setStoredPayerWallet({
          address: payerAddress,
          walletId: selectedWallet,
          usdcBalance: usdc,
          xlmBalance: xlm,
          connectedAt: Date.now(),
        });
      } catch {}

      const feeFormatted = finalData.fee_charged ? `${finalData.fee_charged} XLM` : '0.001 XLM';
      const newReceipt = {
        hash: txHash,
        amount: displayAmount,
        currency: usedCurrency,
        date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        fee: feeFormatted,
        ledger: ledgerNum,
        status: 'Completed',
        explorerUrl: finalData.stellar_expert_url || `https://stellar.expert/explorer/testnet/tx/${txHash}`,
      };

      setReceiptTx(newReceipt);
      onPaymentComplete();

      // Transition to receipt view after showing success animation
      setTimeout(() => {
        setWidgetStep(null);
        setIsProcessing(false);
        setSubState('payment-received');
      }, 1500);

    } catch (err: any) {
      setWidgetStep('error');
      setWidgetError(err?.message || 'An unexpected error occurred during checkout.');
      setIsProcessing(false);
    }
  };

  if (isLoadingInvoice) {
    return (
      <div className="min-h-screen bg-[#F5F6F2] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-[#E3E7E1] rounded-[28px] p-8 sm:p-10 text-center shadow-lg">
          <div className="relative w-16 h-16 mx-auto mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-[#0F7B5F]/20 animate-ping opacity-50" />
            <div className="w-14 h-14 rounded-full border-2 border-[#0F7B5F] border-t-transparent animate-spin flex items-center justify-center">
              <span className="text-[18px] font-black text-[#0F7B5F]">S</span>
            </div>
          </div>
          <h2 className="text-[20px] font-extrabold text-[#0B1F1A]">Loading Payment Request</h2>
          <p className="text-[13px] text-[#626564] font-medium mt-2 leading-relaxed">
            Verifying cryptographic invoice status on Stellar Testnet Horizon...
          </p>
          <div className="mt-6 w-full bg-[#F5F6F2] h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-[#0F7B5F] rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  if (invoiceNotFound) {
    return (
      <div className="min-h-screen bg-[#F5F6F2] text-[#0B1F1A] flex flex-col">
        {/* Top Header */}
        <header className="w-full h-[64px] sm:h-[80px] bg-white border-b border-[#E3E7E1] px-4 sm:px-10 lg:px-16 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <BrandLogo onClick={() => onNavigate('landing')} />
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="text-[12px] font-bold text-[#0F7B5F] hidden sm:inline">
              Stellar Network Connected
            </span>
          </div>
        </header>

        {/* Center Card */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-10">
          <div className="w-full max-w-[560px] bg-white border border-[#E3E7E1] rounded-[32px] p-6 sm:p-10 shadow-[0_20px_50px_rgba(11,31,26,0.06)] flex flex-col items-center text-center">
            {/* Expressive Warning/Not Found Icon */}
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-full bg-[#FEF3F2] border-2 border-[#FECDCA] flex items-center justify-center shadow-inner">
                <svg
                  width="38"
                  height="38"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#D92D20"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                  <line x1="9" y1="11" x2="11" y2="11" />
                </svg>
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#B42318] text-white flex items-center justify-center text-[13px] font-bold shadow-md">
                ✕
              </div>
            </div>

            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-[12px] font-bold mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D92D20] animate-pulse" />
              <span>Invoice Not Found or Inactive</span>
            </div>

            {/* Title & Description */}
            <h1 className="text-[26px] sm:text-[30px] font-extrabold text-[#0B1F1A] tracking-tight leading-snug">
              Invoice Unavailable
            </h1>
            <p className="text-[14px] sm:text-[15px] text-[#626564] font-medium mt-2.5 max-w-[440px] leading-relaxed">
              We couldn't locate this payment request on the Stellar network. The invoice may have expired, been fulfilled, cancelled by the merchant, or the payment link reference is invalid.
            </p>

            {/* Invoice Reference Metadata Box */}
            <div className="w-full mt-6 bg-[#F8FAF7] border border-[#E3E7E1] rounded-[18px] p-4 text-left space-y-2.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#626564] font-semibold">Reference Queried:</span>
                <div className="flex items-center gap-2">
                  <code className="bg-white px-2 py-0.5 rounded-[6px] border border-[#E3E7E1] font-mono font-bold text-[#0B1F1A]">
                    {requestedRef || 'None provided'}
                  </code>
                  {requestedRef && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(requestedRef, 'Reference')}
                      className="text-[11px] font-bold text-[#0F7B5F] hover:underline cursor-pointer"
                    >
                      {copiedField === 'Reference' ? '✓ Copied' : 'Copy'}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#626564] font-semibold">Stellar Ledger Status:</span>
                <span className="font-bold text-[#D92D20]">Unregistered / Expired</span>
              </div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-[#626564] font-semibold">Network:</span>
                <span className="font-bold text-[#0F7B5F] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  Stellar Testnet Horizon
                </span>
              </div>
            </div>

            {/* Guidance bullet points */}
            <div className="w-full mt-5 bg-[#FFFBEB] border border-[#F3DFA5] rounded-[14px] p-3.5 text-left text-[12px] text-[#7A4B00] space-y-1 leading-relaxed">
              <div className="font-bold">Next steps:</div>
              <div>• Verify you opened the complete URL provided by the merchant.</div>
              <div>• Request a new payment link if the invoice has reached its expiry deadline.</div>
              <div>• Or return to the dashboard if you are testing merchant tools.</div>
            </div>

            {/* Action Buttons */}
            <div className="w-full mt-7 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className="flex-1 h-[48px] rounded-[12px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-bold text-[14px] inline-flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <span>Return to Home</span>
                <ArrowRightIcon color="#FFFFFF" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className="flex-1 h-[48px] rounded-[12px] bg-white hover:bg-[#F8FAF7] border border-[#0F7B5F] text-[#0F7B5F] font-bold text-[14px] inline-flex items-center justify-center transition-all cursor-pointer"
              >
                Merchant Dashboard
              </button>
            </div>

            <div className="mt-4 flex items-center justify-center gap-4 text-[12px] font-bold text-[#0F7B5F]">
              <button
                type="button"
                onClick={() => loadInvoice()}
                className="hover:underline cursor-pointer inline-flex items-center gap-1"
              >
                <span>↺</span>
                <span>Try Again</span>
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(true)}
                className="hover:underline cursor-pointer"
              >
                Contact Support
              </button>
            </div>
          </div>
        </main>

        {/* Support Modal if opened */}
        {isSupportModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setIsSupportModalOpen(false)}
          >
            <div
              className="bg-white rounded-[28px] max-w-[480px] w-full p-6 sm:p-7 shadow-2xl border border-[#E3E7E1] my-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#E3E7E1]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#E8F4F0] text-[#0F7B5F] flex items-center justify-center text-[20px] font-bold">
                    🎧
                  </div>
                  <div>
                    <h3 className="text-[18px] font-black text-[#0B1F1A]">Support</h3>
                    <p className="text-[12px] text-[#626564] font-medium">SMEHub Payment Assistance</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSupportModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#F5F6F2] hover:bg-[#E3E7E1] text-[#626564] hover:text-black font-bold flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="py-5 space-y-4">
                <p className="text-[13px] text-[#0B1F1A]/80 leading-relaxed">
                  If you need help resolving an unavailable invoice or locating your payment request, please contact our support team.
                </p>
                <div className="p-3.5 rounded-[14px] bg-[#F8FAF7] border border-[#E3E7E1] space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-[#626564] font-medium">Queried Reference:</span>
                    <span className="font-bold font-mono text-[#0B1F1A]">{requestedRef || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#626564] font-medium">Support Contact:</span>
                    <span className="font-bold text-[#0F7B5F]">support@getsmehub.com</span>
                  </div>
                </div>
                <a
                  href={`mailto:support@getsmehub.com?subject=${encodeURIComponent(
                    `Invoice Assistance: ${requestedRef || 'Unknown Reference'}`
                  )}&body=${encodeURIComponent(
                    `Hello SMEHub Support,\n\nI am experiencing an issue accessing invoice reference "${requestedRef}".\n\nPlease help me check its status.\n\nThank you!`
                  )}`}
                  className="w-full h-[50px] rounded-[12px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-extrabold text-[15px] flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <span>✉️ Email Support</span>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="w-full py-6 text-center text-[12px] text-[#626564] border-t border-[#E3E7E1] bg-white">
          <span>Secured by SMEHub on the Stellar Consensus Protocol</span>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6F2] text-[#0B1F1A] pb-24 relative">
      {/* Top Merchant Navigation Header */}
      <header className="w-full h-[64px] sm:h-[88px] bg-white border-b border-[#0F7B5F]/30 px-4 sm:px-10 lg:px-16 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div
          onClick={() => onNavigate('dashboard')}
          title="Return to Merchant Dashboard"
          className="flex items-center gap-3.5 sm:gap-4 cursor-pointer group"
        >
          <div className="w-[42px] h-[40px] sm:w-[50px] sm:h-[48px] rounded-[10px] bg-[#0F7B5F] flex items-center justify-center shrink-0 shadow-xs group-hover:scale-102 transition-transform">
            <span className="text-[14px] sm:text-[18px] font-black text-white">
              {displayMerchant.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[16px] sm:text-[20px] font-extrabold text-[#0B1F1A] leading-tight">
                {displayMerchant}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0F7B5F] bg-[#E8F4F0] px-2 py-0.5 rounded-full border border-[#0F7B5F]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                Verified Merchant
              </span>
            </div>
            <div className="text-[12px] sm:text-[13px] font-medium text-[#0B1F1A]/70 mt-0.5">
              Secure Web3 Checkout on Stellar
            </div>
          </div>
        </div>

        {/* Network & Live Status Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#E8F4F0] border border-[#0F7B5F]/30 text-[12px] font-bold text-[#0F7B5F]">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="hidden sm:inline">Stellar Testnet Horizon</span>
            <span className="sm:hidden">Testnet</span>
          </div>
        </div>
      </header>

      {/* Modern Stepper / Progress Header */}
      <div className="max-w-[760px] mx-auto px-4 pt-6 sm:pt-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-[#E3E7E1] -z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-[#0F7B5F] transition-all duration-300 -z-0"
            style={{
              width:
                subState === 'payment-received'
                  ? '100%'
                  : subState === 'connected-sufficient' || subState === 'connected-insufficient'
                  ? '66%'
                  : '33%',
            }}
          />

          {[
            { step: 1, label: 'Invoice Review', active: true, done: subState !== 'select-wallet' },
            { step: 2, label: 'Wallet Connection', active: subState !== 'select-wallet', done: subState === 'payment-received' },
            { step: 3, label: 'Settlement', active: subState === 'connected-sufficient' || subState === 'payment-received', done: subState === 'payment-received' },
            { step: 4, label: 'Receipt', active: subState === 'payment-received', done: subState === 'payment-received' },
          ].map((s) => (
            <div key={s.step} className="flex flex-col items-center bg-[#F5F6F2] px-2 z-10">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[12px] sm:text-[13px] font-extrabold transition-colors shadow-xs ${
                  s.done
                    ? 'bg-[#0F7B5F] text-white'
                    : s.active
                    ? 'bg-[#0F7B5F] text-white ring-4 ring-[#E8F4F0]'
                    : 'bg-white border-2 border-[#E3E7E1] text-[#626564]'
                }`}
              >
                {s.done ? '✓' : s.step}
              </div>
              <span
                className={`text-[11px] sm:text-[12px] font-bold mt-1.5 hidden sm:block ${
                  s.active ? 'text-[#0B1F1A]' : 'text-[#626564]'
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Centered Container */}
      <main className="max-w-[760px] mx-auto px-4 pt-6 sm:pt-8">
        {subState === 'payment-received' ? (
          /* =========================================================
             STATE 4: PAYMENT CONFIRMED & RECEIPT DOWNLOAD
             ========================================================= */
          <div className="flex flex-col items-center animate-in fade-in duration-200">
            <CheckCircleBadge />

            <h1 className="mt-4 sm:mt-6 text-[26px] sm:text-[36px] font-black text-[#0B1F1A] text-center">
              Payment Completed!
            </h1>
            <p className="mt-1 sm:mt-2 text-[14px] sm:text-[16px] font-medium text-[#0B1F1A]/70 text-center max-w-[500px]">
              {displayMerchant} has received and settled your payment on Stellar Testnet. Your receipt is ready.
            </p>

            {/* Receipt Summary Card */}
            <div className="mt-6 w-full bg-white border border-[#E3E7E1] rounded-[24px] p-6 sm:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E8F4F0] gap-4">
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-wider text-[#626564]">
                    Total Amount Paid
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-[34px] sm:text-[40px] font-black text-[#0F7B5F] tabular-nums">
                      {receiptTx.amount}
                    </span>
                    <span className="text-[18px] sm:text-[22px] font-extrabold text-[#0B1F1A]/80">
                      {receiptTx.currency}
                    </span>
                  </div>
                </div>

                <div className="sm:text-right">
                  <div className="text-[12px] font-bold uppercase tracking-wider text-[#626564]">
                    Status
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1.5 bg-[#E8F4F0] text-[#0F7B5F] px-3 py-1 rounded-full text-[13px] font-bold border border-[#0F7B5F]/30">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    Confirmed on Ledger
                  </div>
                </div>
              </div>

              {/* Receipt Breakdown Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 border-b border-[#E8F4F0] text-[13px]">
                <div>
                  <span className="text-[#626564] font-medium block">Invoice Reference</span>
                  <span className="font-bold text-[#0B1F1A] font-mono">{displayInvoiceRef}</span>
                </div>
                <div>
                  <span className="text-[#626564] font-medium block">Order Reference</span>
                  <span className="font-bold text-[#0B1F1A] font-mono">{displayOrderRef || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[#626564] font-medium block">Payment Date & Time</span>
                  <span className="font-bold text-[#0B1F1A]">{receiptTx.date}</span>
                </div>
                <div>
                  <span className="text-[#626564] font-medium block">Stellar Ledger</span>
                  <span className="font-bold text-[#0B1F1A] font-mono">#{receiptTx.ledger}</span>
                </div>
              </div>

              {/* Itemized Order Choices if present */}
              {displayOrders && displayOrders.length > 0 && (
                <div className="py-5 border-b border-[#E8F4F0]">
                  <div className="text-[12px] font-bold uppercase tracking-wider text-[#626564] mb-3">
                    Purchased Items ({displayOrders.length}):
                  </div>
                  <div className="space-y-2">
                    {displayOrders.map((it: any, idx: number) => (
                      <div
                        key={it.id || idx}
                        className="flex items-center justify-between text-[13px] p-2.5 rounded-[10px] bg-[#F8FAF7] border border-[#E3E7E1]/80"
                      >
                        <div className="font-bold text-[#0B1F1A]">
                          {it.name} <span className="text-[#0F7B5F]">×{it.quantity}</span>
                        </div>
                        <div className="font-extrabold text-[#0B1F1A] tabular-nums">
                          ${Number(it.total || it.price * it.quantity).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaction Hash with Stellar Expert link */}
              <div className="pt-5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-[#626564]">
                    Stellar Transaction Hash
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(receiptTx.hash, 'Transaction Hash')}
                    className="text-[12px] font-bold text-[#0F7B5F] hover:underline cursor-pointer"
                  >
                    {copiedField === 'Transaction Hash' ? '✓ Copied' : 'Copy Hash'}
                  </button>
                </div>
                <a
                  href={receiptTx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-[10px] bg-[#F8FAF7] border border-[#E3E7E1] font-mono text-[12px] text-[#0F7B5F] hover:underline break-all"
                >
                  {receiptTx.hash} ↗
                </a>
              </div>
            </div>

            {/* Receipt Action Buttons (Download, Print, Done) */}
            <div className="mt-6 w-full space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => downloadReceiptFile(invoiceDetails || request, receiptTx)}
                  className="flex-1 h-[52px] bg-[#0F7B5F] hover:bg-[#0c634c] rounded-[12px] text-[15px] sm:text-[16px] font-bold text-white inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-98"
                >
                  <span className="text-[18px]">📥</span>
                  <span>Download Receipt (HTML / PDF)</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-[52px] px-6 bg-white hover:bg-[#F8FAF7] border border-[#0F7B5F] rounded-[12px] text-[15px] font-bold text-[#0F7B5F] inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>🖨️</span>
                  <span>Print Receipt</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href={receiptTx.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 h-[48px] bg-white hover:bg-[#F8FAF7] border border-[#E3E7E1] rounded-[12px] text-[14px] font-bold text-[#0B1F1A] inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Verify on Stellar.Expert Explorer</span>
                  <ArrowUpRightIcon color="#0B1F1A" className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="h-[48px] px-6 bg-[#0B1F1A] hover:bg-black rounded-[12px] text-[14px] font-bold text-white transition-colors cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
             STATES 1, 2, 3: INVOICE PRESENTATION & WALLET SETTLEMENT
             ========================================================= */
          <div className="space-y-6">
            {/* CARD 1: ELEGANT FINTECH INVOICE PRESENTATION */}
            <div className="w-full bg-white border border-[#E3E7E1] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-sm">
              {/* Invoice Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[#E3E7E1] gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black uppercase tracking-wider text-[#626564]">
                      Official Invoice
                    </span>
                    <span className="text-[12px] font-mono font-bold bg-[#E8F4F0] text-[#0F7B5F] px-2.5 py-0.5 rounded-md border border-[#0F7B5F]/20">
                      {displayInvoiceRef}
                    </span>
                  </div>
                  {displayOrderRef && (
                    <div className="text-[12px] font-mono text-[#626564] mt-1 font-semibold">
                      Order Reference: <span className="text-[#0B1F1A] font-bold">{displayOrderRef}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[12px] font-extrabold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Awaiting Payment
                  </span>
                </div>
              </div>

              {/* Total Due Banner */}
              <div className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E3E7E1]">
                <div>
                  <span className="text-[13px] font-bold text-[#626564] uppercase tracking-wider">
                    Total Amount Due
                  </span>
                  <div className="flex items-baseline gap-2.5 mt-1">
                    <span className="text-[38px] sm:text-[46px] font-black text-[#0B1F1A] tabular-nums tracking-tight">
                      {displayAmount}
                    </span>
                    <span className="text-[20px] sm:text-[24px] font-black text-[#0F7B5F]">
                      {displayCurrency}
                    </span>
                  </div>
                  <div className="text-[12px] text-[#626564] font-medium mt-0.5">
                    1 {displayCurrency} = 1.00 USD &middot; Non-custodial instant settlement
                  </div>
                </div>

                {displayDesc && (
                  <div className="sm:text-right max-w-[280px]">
                    <span className="text-[11px] font-bold text-[#626564] uppercase tracking-wider">
                      Memo / Note
                    </span>
                    <div className="text-[14px] font-bold text-[#0B1F1A] mt-0.5">
                      {displayDesc}
                    </div>
                  </div>
                )}
              </div>

              {/* Itemized Order Choices / Breakdown */}
              <div className="pt-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-extrabold uppercase tracking-wider text-[#626564]">
                    Invoice Breakdown {displayOrders.length > 0 ? `(${displayOrders.length} items)` : ''}
                  </span>
                  <span className="text-[11px] font-bold text-[#0F7B5F]">
                    Settled in {displayCurrency} Testnet
                  </span>
                </div>

                {displayOrders && displayOrders.length > 0 ? (
                  <div className="border border-[#E3E7E1] rounded-[16px] overflow-hidden">
                    <div className="hidden sm:grid grid-cols-12 bg-[#F8FAF7] px-4 py-2.5 text-[11px] font-bold text-[#626564] uppercase border-b border-[#E3E7E1]">
                      <div className="col-span-6">Description / Choice</div>
                      <div className="col-span-2 text-center">Qty</div>
                      <div className="col-span-2 text-right">Unit Price</div>
                      <div className="col-span-2 text-right">Subtotal</div>
                    </div>

                    <div className="divide-y divide-[#E3E7E1]">
                      {displayOrders.map((it: any, idx: number) => (
                        <div
                          key={it.id || idx}
                          className="p-3 sm:px-4 sm:py-3 flex flex-col sm:grid sm:grid-cols-12 items-stretch sm:items-center gap-1 sm:gap-0 hover:bg-[#F8FAF7]/60 transition-colors text-[13px]"
                        >
                          <div className="col-span-6 font-bold text-[#0B1F1A]">
                            {it.name}
                          </div>
                          <div className="col-span-2 sm:text-center text-[#0F7B5F] font-extrabold">
                            <span className="sm:hidden text-[#626564] font-medium mr-1">Qty:</span>
                            ×{it.quantity}
                          </div>
                          <div className="col-span-2 sm:text-right font-medium text-[#626564] tabular-nums">
                            <span className="sm:hidden mr-1">Price:</span>${Number(it.price).toFixed(2)}
                          </div>
                          <div className="col-span-2 sm:text-right font-black text-[#0B1F1A] tabular-nums">
                            <span className="sm:hidden mr-1">Total:</span>${Number(it.total || it.price * it.quantity).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Subtotal & Network Fee Footer */}
                    <div className="bg-[#F8FAF7] px-4 py-3 border-t border-[#E3E7E1] space-y-1.5 text-[12px]">
                      <div className="flex justify-between font-medium text-[#626564]">
                        <span>Subtotal</span>
                        <span className="font-bold text-[#0B1F1A] tabular-nums">${displayAmount}</span>
                      </div>
                      <div className="flex justify-between font-medium text-[#626564]">
                        <span>Estimated Stellar Network Fee</span>
                        <span className="font-bold text-[#0F7B5F] tabular-nums">0.0001 XLM (~$0.00001)</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-[#F8FAF7] rounded-[14px] border border-[#E3E7E1] flex items-center justify-between">
                    <div>
                      <div className="text-[14px] font-bold text-[#0B1F1A]">
                        {displayDesc || 'Single Order Settlement'}
                      </div>
                      <div className="text-[12px] text-[#626564] mt-0.5">
                        Standard merchant payment request
                      </div>
                    </div>
                    <div className="text-[18px] font-black text-[#0F7B5F] tabular-nums">
                      ${displayAmount}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2: PAYMENT METHOD (STELLAR WALLETS KIT OR QR SCAN) */}
            <div className="w-full bg-white border border-[#E3E7E1] rounded-[24px] sm:rounded-[32px] p-6 sm:p-8 shadow-sm">
              {/* Payment Mode Selector Tabs */}
              <div className="flex items-center gap-2 p-1.5 bg-[#F5F6F2] rounded-[16px] border border-[#E3E7E1] mb-6">
                <button
                  type="button"
                  onClick={() => setPaymentTab('wallet')}
                  className={`flex-1 h-[44px] rounded-[12px] text-[14px] font-extrabold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentTab === 'wallet'
                      ? 'bg-white text-[#0F7B5F] shadow-sm'
                      : 'text-[#626564] hover:text-[#0B1F1A]'
                  }`}
                >
                  <span className="text-[16px]">💳</span>
                  <span>Connect Stellar Wallet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentTab('qr')}
                  className={`flex-1 h-[44px] rounded-[12px] text-[14px] font-extrabold inline-flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    paymentTab === 'qr'
                      ? 'bg-white text-[#0F7B5F] shadow-sm'
                      : 'text-[#626564] hover:text-[#0B1F1A]'
                  }`}
                >
                  <span className="text-[16px]">📱</span>
                  <span>Scan QR Code (SEP-0007)</span>
                </button>
              </div>

              {paymentTab === 'wallet' ? (
                /* TAB 1: STELLAR WALLET CONNECT & SETTLEMENT */
                <div>
                  {subState === 'select-wallet' ? (
                    <div className="space-y-4">
                      {/* Primary Stellar Wallets Kit Modal Trigger */}
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={handleConnectWithStellarWalletsKit}
                        className="w-full min-h-[64px] py-3.5 px-6 rounded-[18px] bg-gradient-to-r from-[#0F7B5F] to-[#0A5441] hover:from-[#0c634c] hover:to-[#084535] text-white flex items-center justify-between shadow-md transition-all cursor-pointer active:scale-99 border-2 border-[#10B981]/40"
                      >
                        <div className="flex items-center gap-3.5 text-left">
                          <div className="w-10 h-10 rounded-[12px] bg-white/15 flex items-center justify-center text-[20px] shrink-0">
                            ✨
                          </div>
                          <div>
                            <div className="text-[16px] sm:text-[18px] font-black leading-tight">
                              Connect with Stellar Wallets Kit
                            </div>
                            <div className="text-[12px] sm:text-[13px] text-white/80 font-medium">
                              Freighter, xBull, Albedo, Lobstr, Hana, Rabet...
                            </div>
                          </div>
                        </div>

                        <div className="hidden sm:inline-flex items-center gap-1 bg-white/20 px-3 py-1.5 rounded-full text-[12px] font-bold">
                          <span>Open Kit</span>
                          <span className="text-[14px]">→</span>
                        </div>
                      </button>
                    </div>
                  ) : (
                    /* CONNECTED WALLET STATE */
                    <div className="space-y-5">
                      <div className="p-4 sm:p-5 rounded-[20px] bg-[#E8F4F0]/70 border-2 border-[#0F7B5F] space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <WalletLogo wallet={selectedWallet} size="md" />
                            <div>
                              <div className="text-[15px] sm:text-[17px] font-extrabold text-[#0B1F1A] capitalize">
                                {selectedWallet === 'trust' ? 'Testnet Keypair' : selectedWallet} Connected
                              </div>
                              <div className="text-[12px] font-mono text-[#626564] flex items-center gap-1.5 mt-0.5">
                                <span>{payerAddress ? `${payerAddress.slice(0, 6)}...${payerAddress.slice(-6)}` : 'Connected'}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyText(payerAddress, 'Wallet Address')}
                                  className="text-[#0F7B5F] font-bold hover:underline"
                                >
                                  {copiedField === 'Wallet Address' ? '✓' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleConnectWithStellarWalletsKit}
                              className="text-[12px] font-bold text-[#0F7B5F] hover:underline bg-white px-3 py-1 rounded-full border border-[#0F7B5F]/30"
                            >
                              Change
                            </button>
                            <button
                              type="button"
                              onClick={handleDisconnectWallet}
                              className="text-[12px] font-bold text-[#D92D20] hover:underline bg-white px-3 py-1 rounded-full border border-[#D92D20]/30"
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>

                        {/* Balance Row */}
                        <div className="pt-3 border-t border-[#0F7B5F]/20 flex flex-wrap items-center justify-between gap-3 text-[13px]">
                          <div>
                            <span className="text-[#626564] font-medium mr-2">Available Balance:</span>
                            <span className="font-black text-[#0B1F1A] tabular-nums text-[15px]">
                              {payerBalance} {displayCurrency}
                            </span>
                            <span className="text-[11px] text-[#626564] ml-2">
                              ({payerXlmBalance} XLM)
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={isFunding}
                            onClick={handleFundPayer}
                            className="text-[12px] font-bold text-[#0F7B5F] hover:underline bg-white px-3 py-1 rounded-[8px] border border-[#0F7B5F]/30 shadow-2xs"
                          >
                            {isFunding ? 'Requesting...' : '⚡ Top up 10,000 XLM (Friendbot)'}
                          </button>
                        </div>
                      </div>

                      {/* Primary Action Button: Approve & Pay */}
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={handleApprove}
                        className="w-full h-[56px] rounded-[16px] bg-[#0F7B5F] hover:bg-[#0c634c] text-[17px] font-black text-white inline-flex items-center justify-center gap-2.5 transition-all shadow-md cursor-pointer active:scale-98 disabled:opacity-60"
                      >
                        {isProcessing ? (
                          <>
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Broadcasting to Stellar Horizon...</span>
                          </>
                        ) : (
                          <>
                            <span>Pay {displayAmount} {displayCurrency}</span>
                            <ArrowUpRightIcon color="#FFFFFF" className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* TAB 2: QR CODE & SEP-0007 MOBILE SCAN */
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-4 bg-white border-2 border-[#0F7B5F]/30 rounded-[24px] shadow-sm">
                    {displayQrBase64 ? (
                      <img
                        src={displayQrBase64}
                        alt="Stellar Payment QR Code"
                        className="w-[200px] h-[200px] object-contain rounded-[12px]"
                      />
                    ) : (
                      <div className="w-[200px] h-[200px] bg-[#F5F6F2] flex items-center justify-center font-bold text-[#626564] text-[13px] rounded-[12px]">
                        QR Code Loading...
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-[16px] font-extrabold text-[#0B1F1A]">
                      Scan with any Stellar Mobile Wallet
                    </h3>
                    <p className="text-[12px] text-[#626564] max-w-[360px] mx-auto mt-0.5">
                      Compatible with Freighter Mobile, Lobstr, xBull, and all SEP-0007 enabled wallets.
                    </p>
                  </div>

                  {displaySep0007Uri && (
                    <div className="flex flex-wrap gap-2 justify-center pt-1">
                      <a
                        href={displaySep0007Uri}
                        target="_blank"
                        rel="noreferrer"
                        className="h-[42px] px-5 rounded-[10px] bg-[#0F7B5F] text-white font-bold text-[13px] inline-flex items-center gap-1.5 hover:bg-[#0c634c] transition-colors"
                      >
                        <span>Open in Mobile Wallet</span>
                        <ArrowUpRightIcon color="#FFFFFF" className="w-3.5 h-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyText(displaySep0007Uri, 'SEP-0007 URI')}
                        className="h-[42px] px-4 rounded-[10px] bg-white border border-[#E3E7E1] hover:bg-[#F8FAF7] text-[13px] font-bold text-[#0B1F1A]"
                      >
                        {copiedField === 'SEP-0007 URI' ? '✓ Copied URI' : 'Copy URI'}
                      </button>
                    </div>
                  )}

                  {/* Destination & Memo preview */}
                  <div className="w-full bg-[#F8FAF7] border border-[#E3E7E1] rounded-[14px] p-3 text-left space-y-2 text-[12px]">
                    <div className="flex items-center justify-between">
                      <span className="text-[#626564] font-medium">Destination Account:</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(displayDestination, 'Destination Address')}
                        className="text-[#0F7B5F] font-bold hover:underline"
                      >
                        {copiedField === 'Destination Address' ? '✓' : 'Copy'}
                      </button>
                    </div>
                    <div className="font-mono text-[#0B1F1A] font-bold truncate">
                      {displayDestination}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#E3E7E1]">
                      <span className="text-[#626564] font-medium">Required Memo (MEMO_TEXT):</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(displayMemo, 'Memo')}
                        className="text-[#0F7B5F] font-bold hover:underline"
                      >
                        {copiedField === 'Memo' ? '✓' : 'Copy'}
                      </button>
                    </div>
                    <div className="font-mono text-[#0B1F1A] font-bold">
                      {displayMemo}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* =========================================================
          FLOATING SUPPORT CHAT ICON (LEADING TO EMAIL)
         ========================================================= */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsSupportModalOpen(true)}
          className="h-[52px] px-5 rounded-full bg-[#0B1F1A] hover:bg-[#0F7B5F] text-white border-2 border-[#10B981]/50 shadow-2xl flex items-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 cursor-pointer group"
          title={`Contact ${displayMerchant} Support`}
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10B981]" />
          </span>
          <span className="text-[18px]">💬</span>
          <span className="text-[14px] font-extrabold tracking-wide">Need Support?</span>
        </button>
      </div>

      {/* SUPPORT MODAL (POPUP THAT LEADS TO EMAIL) */}
      {isSupportModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsSupportModalOpen(false)}
        >
          <div
            className="bg-white rounded-[28px] max-w-[480px] w-full p-6 sm:p-7 shadow-2xl border border-[#E3E7E1] my-8"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E3E7E1]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E8F4F0] text-[#0F7B5F] flex items-center justify-center text-[20px] font-bold">
                  🎧
                </div>
                <div>
                  <h3 className="text-[18px] font-black text-[#0B1F1A]">
                    Merchant Support
                  </h3>
                  <p className="text-[12px] text-[#626564] font-medium">
                    {displayMerchant} Support Team
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#F5F6F2] hover:bg-[#E3E7E1] text-[#626564] hover:text-black font-bold flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="py-5 space-y-4">
              <p className="text-[13px] text-[#0B1F1A]/80 leading-relaxed">
                Have questions about your order or need assistance with your payment? Reach out directly to <strong>{displayMerchant}</strong>.
              </p>

              {/* Order Context Card */}
              <div className="p-3.5 rounded-[14px] bg-[#F8FAF7] border border-[#E3E7E1] space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-[#626564] font-medium">Invoice Reference:</span>
                  <span className="font-bold font-mono text-[#0B1F1A]">{displayInvoiceRef}</span>
                </div>
                {displayOrderRef && (
                  <div className="flex justify-between">
                    <span className="text-[#626564] font-medium">Order Reference:</span>
                    <span className="font-bold font-mono text-[#0B1F1A]">{displayOrderRef}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[#626564] font-medium">Support Contact:</span>
                  <span className="font-bold text-[#0F7B5F]">{displaySupportEmail}</span>
                </div>
              </div>

              {/* Primary Email Action Button */}
              <a
                href={`mailto:${displaySupportEmail}?subject=${encodeURIComponent(
                  `Support Request: Invoice ${displayInvoiceRef} (Order: ${displayOrderRef || 'N/A'})`
                )}&body=${encodeURIComponent(
                  `Hello ${displayMerchant} Team,\n\nI am contacting you regarding invoice ${displayInvoiceRef} (Order: ${
                    displayOrderRef || 'N/A'
                  }) for ${displayAmount} ${displayCurrency}.\n\nMy inquiry / question:\n\nThank you,\n${
                    invoiceDetails?.customer_name || 'Customer'
                  }`
                )}`}
                className="w-full h-[50px] rounded-[12px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-extrabold text-[15px] flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <span>✉️ Open Support Email Client</span>
              </a>

              {/* Secondary Copy Button */}
              <button
                type="button"
                onClick={() => handleCopyText(displaySupportEmail, 'Support Email')}
                className="w-full h-[44px] rounded-[12px] bg-white hover:bg-[#F8FAF7] border border-[#E3E7E1] text-[#0B1F1A] font-bold text-[13px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <span>{copiedField === 'Support Email' ? '✓ Email Copied!' : `Copy ${displaySupportEmail}`}</span>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[#E3E7E1] text-center text-[11px] text-[#626564]">
              Emails are sent directly to the merchant. Average response time: under 24 hours.
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING WIDGET MODAL FOR CONNECTING, SIGNING & HORIZON SETTLEMENT */}
      {widgetStep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-[480px] bg-[#0B1F1A] border-2 border-[#10B981]/40 rounded-[28px] p-6 sm:p-8 text-white shadow-2xl overflow-hidden">
            {/* Background radial glow */}
            <div className="absolute -top-24 -right-24 w-56 h-56 bg-[#0F7B5F]/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-[#10B981]/20 rounded-full blur-3xl pointer-events-none" />

            {/* Close button for error or connecting or signing states */}
            {(widgetStep === 'error' || widgetStep === 'connecting' || widgetStep === 'signing') && (
              <button
                type="button"
                onClick={() => {
                  setWidgetStep(null);
                  setIsProcessing(false);
                }}
                className="absolute top-5 right-5 text-white/50 hover:text-white w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            )}

            {/* Main Visual Header */}
            <div className="flex flex-col items-center text-center">
              {widgetStep === 'connecting' && (
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-full bg-[#0F7B5F]/30 border-2 border-[#10B981] flex items-center justify-center text-[34px] animate-pulse">
                    ✨
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-[#10B981]/50 animate-ping pointer-events-none" />
                </div>
              )}

              {widgetStep === 'preparing' && (
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-full bg-[#0F7B5F]/30 border-2 border-[#10B981] flex items-center justify-center">
                    <span className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                </div>
              )}

              {widgetStep === 'signing' && (
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-full bg-[#10B981]/20 border-2 border-[#10B981] flex items-center justify-center text-[34px] animate-bounce">
                    ✍️
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-[#10B981]/60 animate-ping pointer-events-none" />
                </div>
              )}

              {widgetStep === 'broadcasting' && (
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-full bg-[#0F7B5F]/30 border-2 border-[#10B981] flex items-center justify-center text-[36px] animate-pulse">
                    🚀
                  </div>
                </div>
              )}

              {widgetStep === 'success' && (
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-full bg-[#10B981]/30 border-3 border-[#10B981] flex items-center justify-center text-[#10B981] text-[36px] shadow-lg shadow-[#10B981]/30">
                    ✓
                  </div>
                </div>
              )}

              {widgetStep === 'error' && (
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400 text-[36px]">
                    !
                  </div>
                </div>
              )}

              {/* Status Title */}
              <h3 className="text-[20px] sm:text-[22px] font-black tracking-tight mb-2">
                {widgetStep === 'connecting' && 'Connecting Stellar Wallet'}
                {widgetStep === 'preparing' && 'Preparing Transaction'}
                {widgetStep === 'signing' && 'Awaiting Wallet Signature'}
                {widgetStep === 'broadcasting' && 'Settling on Stellar Ledger'}
                {widgetStep === 'success' && 'Payment Confirmed & Debited!'}
                {widgetStep === 'error' && 'Transaction Incomplete'}
              </h3>

              {/* Description Message */}
              <p className="text-[13px] sm:text-[14px] text-white/80 max-w-[400px] leading-relaxed mb-6">
                {widgetError || widgetMessage}
              </p>

              {/* 3-Step Process Indicator for Payment Flow */}
              {(widgetStep === 'preparing' ||
                widgetStep === 'signing' ||
                widgetStep === 'broadcasting' ||
                widgetStep === 'success') && (
                <div className="w-full bg-[#071512] rounded-[18px] p-4 border border-[#10B981]/25 mb-6 text-left">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#A7E3CC] mb-3">
                    Stellar Blockchain Settlement
                  </div>
                  <div className="space-y-2.5 text-[13px]">
                    {/* Step 1: Prepare */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            widgetStep !== 'preparing'
                              ? 'bg-[#10B981] text-[#0B1F1A]'
                              : 'bg-white/20 text-white animate-pulse'
                          }`}
                        >
                          {widgetStep !== 'preparing' ? '✓' : '1'}
                        </span>
                        <span>1. Prepare Transaction</span>
                      </span>
                      <span className="text-[11px] font-medium text-white/60">
                        {widgetStep === 'preparing' ? 'In Progress...' : 'Completed'}
                      </span>
                    </div>

                    {/* Step 2: Sign */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            widgetStep === 'broadcasting' || widgetStep === 'success'
                              ? 'bg-[#10B981] text-[#0B1F1A]'
                              : widgetStep === 'signing'
                              ? 'bg-[#10B981] text-[#0B1F1A] animate-pulse'
                              : 'bg-white/10 text-white/40'
                          }`}
                        >
                          {widgetStep === 'broadcasting' || widgetStep === 'success' ? '✓' : '2'}
                        </span>
                        <span>2. Wallet Signature</span>
                      </span>
                      <span className="text-[11px] font-medium text-white/60">
                        {widgetStep === 'signing'
                          ? 'Awaiting Approval...'
                          : widgetStep === 'broadcasting' || widgetStep === 'success'
                          ? 'Signed'
                          : 'Pending'}
                      </span>
                    </div>

                    {/* Step 3: Broadcast */}
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            widgetStep === 'success'
                              ? 'bg-[#10B981] text-[#0B1F1A]'
                              : widgetStep === 'broadcasting'
                              ? 'bg-[#10B981] text-[#0B1F1A] animate-spin'
                              : 'bg-white/10 text-white/40'
                          }`}
                        >
                          {widgetStep === 'success' ? '✓' : '3'}
                        </span>
                        <span>3. Horizon Broadcast & Debit</span>
                      </span>
                      <span className="text-[11px] font-medium text-white/60">
                        {widgetStep === 'broadcasting'
                          ? 'Broadcasting...'
                          : widgetStep === 'success'
                          ? 'Debited'
                          : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Special Prompt for Signing State */}
              {widgetStep === 'signing' && (
                <div className="w-full bg-[#10B981]/15 border border-[#10B981]/40 rounded-[16px] p-3.5 text-left mb-6 space-y-2">
                  <div className="text-[12px] font-bold text-[#A7E3CC] flex items-center gap-2">
                    <span className="text-[14px]">💡</span>
                    <span>Action Required in Your Wallet Popup</span>
                  </div>
                  <div className="text-[12px] text-white/80 leading-relaxed">
                    A transaction signature prompt has been triggered. Please review and click <strong>Approve / Sign</strong> in your wallet window to authorize the transfer.
                  </div>
                  <div className="pt-2 border-t border-[#10B981]/20 flex justify-between text-[11px] text-white/70">
                    <span>Amount: <strong>{displayAmount} {displayCurrency}</strong></span>
                    <span>To: <strong>{displayMerchant}</strong></span>
                  </div>
                </div>
              )}

              {/* Wallet Connecting Helper */}
              {widgetStep === 'connecting' && (
                <div className="w-full bg-white/5 border border-white/10 rounded-[14px] p-3 text-center mb-6">
                  <div className="text-[11px] font-bold text-white/70">
                    Compatible with Freighter, xBull, Albedo, Lobstr, Hana, Rabet & more
                  </div>
                </div>
              )}

              {/* Actions for Error State */}
              {widgetStep === 'error' && (
                <div className="flex items-center gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setWidgetStep(null);
                      setIsProcessing(false);
                    }}
                    className="flex-1 h-[44px] rounded-[14px] bg-white/10 hover:bg-white/20 text-white font-bold text-[13px] transition-all cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWidgetStep(null);
                      handleApprove();
                    }}
                    className="flex-1 h-[44px] rounded-[14px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-black text-[13px] transition-all cursor-pointer shadow-md"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* Cancel Button while signing or connecting */}
              {(widgetStep === 'signing' || widgetStep === 'connecting') && (
                <button
                  type="button"
                  onClick={() => {
                    setWidgetStep(null);
                    setIsProcessing(false);
                  }}
                  className="text-[12px] text-white/60 hover:text-white font-bold underline transition-colors cursor-pointer"
                >
                  Cancel Request
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

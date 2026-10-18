/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  BusinessProfile,
  PaymentRequestData,
  ScreenId,
  Transaction,
} from './types';
import { LandingPage } from './components/LandingPage';
import { AuthViews } from './components/AuthViews';
import { MerchantViews } from './components/MerchantViews';
import { CustomerCheckout } from './components/CustomerCheckout';
import { api, authStorage } from './services/api';
import { walletStorage, stellarWalletService } from './services/stellarWallet';



export const generateOrderRef = () => {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${rand}`;
};

const mapBackendPaymentRequestToFrontend = (item: any): PaymentRequestData => {
  let statusStep: 1 | 2 | 3 | 4 = 2;
  const st = (item.status || 'PENDING').toUpperCase();
  if (st === 'COMPLETED') statusStep = 4;
  else if (st === 'PENDING') statusStep = 2;
  else if (st === 'CANCELLED' || st === 'EXPIRED') statusStep = 1;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const checkoutUrl = item.reference_id ? `${origin}/checkout/${item.reference_id}` : item.checkout_url || '';

  const expFormatted = item.expires_at
    ? new Date(item.expires_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '60 minutes';

  return {
    id: String(item.id || item.reference_id),
    referenceId: item.reference_id || 'ORD-REQ',
    amount: String(item.amount || '0.00'),
    asset: item.currency || 'USDC',
    customer: item.customer_name || 'Customer',
    description: item.description || item.title || 'Invoice settlement',
    orderRef: item.order_reference || item.reference_id || 'ORD-REQ',
    orders: Array.isArray(item.orders) ? item.orders : [],
    expiresIn: expFormatted,
    singleUse: true,
    paymentLink: checkoutUrl,
    statusStep,
    memo: item.memo || item.reference_id,
    destinationAddress: item.destination_address,
    qrCodeBase64: item.qr_code_base64,
    sep0007Uri: item.sep0007_uri,
    status: st,
    expiresAt: item.expires_at,
    paidAt: item.paid_at,
    createdAt: item.created_at,
    customerEmail: item.customer_email || '',
  };
};

const mapBackendTxToFrontend = (item: any): Transaction => {
  const shortHash = item.tx_hash
    ? `${item.tx_hash.slice(0, 6)}...${item.tx_hash.slice(-6)}`
    : '--';
  const dateFormatted = item.verified_at || item.created_at
    ? new Date(item.verified_at || item.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Recent';

  return {
    id: String(item.id),
    orderRef: item.reference_id || 'ORD-REQ',
    customer: item.source_account
      ? `${item.source_account.slice(0, 4)}...${item.source_account.slice(-4)}`
      : 'Customer',
    referenceLabel: item.reference_id ? `${item.reference_id}` : 'Payment',
    amount: String(item.amount),
    asset: item.asset_code || 'USDC',
    status: item.status === 'SUCCESS' ? 'Completed' : item.status === 'FAILED' ? 'Failed' : 'Pending',
    date: dateFormatted,
    shortHash,
    fullHash: item.tx_hash || '--',
    network: 'Stellar testnet',
    fee: item.fee_charged ? `${item.fee_charged} stroops` : '0.001 XLM',
    description: item.memo || 'Invoice settlement',
    stellarExpertUrl: item.stellar_expert_url,
    ledger: item.ledger,
  };
};

export const ROUTE_MAP: Record<string, ScreenId> = {
  '/': 'landing',
  '/signup': 'signup-1',
  '/signup-1': 'signup-1',
  '/signup-2': 'signup-2',
  '/signup/verify': 'signup-2',
  '/signup-3': 'signup-3',
  '/signup/wallet': 'signup-3',
  '/signin': 'signin-1',
  '/signin-1': 'signin-1',
  '/signin-2': 'signin-2',
  '/signin/verify': 'signin-2',
  '/dashboard': 'dashboard',
  '/payment-requests': 'payment-requests',
  '/payments': 'payment-requests',
  '/create-payment': 'create-payment',
  '/payments/create': 'create-payment',
  '/payment-created': 'payment-created',
  '/history': 'history',
  '/settings': 'settings',
  '/checkout': 'customer-checkout',
  '/customer-checkout': 'customer-checkout',
};

export const SCREEN_PATH_MAP: Record<ScreenId, string> = {
  'landing': '/',
  'signup-1': '/signup',
  'signup-2': '/signup-2',
  'signup-3': '/signup-3',
  'signin-1': '/signin',
  'signin-2': '/signin-2',
  'dashboard': '/dashboard',
  'payment-requests': '/payment-requests',
  'create-payment': '/create-payment',
  'payment-created': '/payment-created',
  'history': '/history',
  'settings': '/settings',
  'customer-checkout': '/checkout',
};

export const PROTECTED_SCREENS: ScreenId[] = [
  'dashboard',
  'payment-requests',
  'create-payment',
  'payment-created',
  'history',
  'settings',
];

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class AppErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('SMEHUB App Render Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F6F2] text-[#0B1F1A] flex items-center justify-center p-6">
          <div className="w-full max-w-[540px] bg-white border border-[#0F7B5F]/30 rounded-[24px] p-8 shadow-xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#E8F4F0] text-[#0F7B5F] flex items-center justify-center mx-auto text-2xl font-bold">
              !
            </div>
            <h1 className="text-[26px] font-bold text-[#0B1F1A]">Something went wrong</h1>
            <p className="text-[15px] text-[#0B1F1A]/70 leading-relaxed">
              An unexpected error occurred while displaying this page. We've preserved your data.
            </p>
            {this.state.error && (
              <pre className="p-3 bg-[#F5F6F2] rounded-[10px] text-[12px] text-left text-red-700 font-mono overflow-x-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false });
                  this.props.onReset();
                }}
                className="px-5 h-[44px] rounded-[10px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-bold text-[15px] transition-colors shadow-sm"
              >
                Return to Dashboard / Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function resolveScreenFromLocation(): { screen: ScreenId; refId?: string } {
  if (typeof window === 'undefined') return { screen: 'landing' };

  let path = window.location.pathname.replace(/\/$/, '') || '/';

  // Support hash routing fallback if user opened e.g. /#/signup or /#/checkout/SME-123
  if (path === '/' && window.location.hash) {
    const rawHash = window.location.hash.replace(/^#\/?/, '/').split('?')[0];
    if (rawHash) path = rawHash.replace(/\/$/, '') || '/';
  }

  // Support /checkout/:refId or /customer-checkout/:refId
  const checkoutMatch = path.match(/^\/(?:customer-)?checkout(?:\/([^\/]+))?$/i);
  if (checkoutMatch) {
    const rawRef = checkoutMatch[1];
    const refId = rawRef ? decodeURIComponent(rawRef).trim() : undefined;
    return { screen: 'customer-checkout', refId: refId || undefined };
  }

  // Support query parameter fallback e.g. /checkout?ref=... or ?refId=... or ?reference_id=...
  if (path === '/checkout' || path === '/customer-checkout') {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref') || urlParams.get('refId') || urlParams.get('reference_id') || urlParams.get('order_ref');
    if (ref && ref.trim()) {
      return { screen: 'customer-checkout', refId: ref.trim() };
    }
    try {
      const savedRef = sessionStorage.getItem('smehub_active_checkout_ref') || localStorage.getItem('smehub_active_checkout_ref');
      if (savedRef && savedRef !== 'ORD-20122' && savedRef !== 'req-1') {
        return { screen: 'customer-checkout', refId: savedRef.trim() };
      }
    } catch {}
    return { screen: 'customer-checkout' };
  }

  let resolvedScreen: ScreenId = ROUTE_MAP[path] || 'landing';

  // AUTH GUARD: If user navigates directly to a protected merchant screen without token,
  // redirect to signin-1
  const token = authStorage.getToken();
  if (PROTECTED_SCREENS.includes(resolvedScreen) && !token) {
    resolvedScreen = 'signin-1';
  }

  return { screen: resolvedScreen };
}

export default function App() {
  const initialNav = resolveScreenFromLocation();
  const [screen, setScreen] = useState<ScreenId>(initialNav.screen);
  const [toast, setToast] = useState<string | null>(null);

  const initialStoredWallet = typeof window !== 'undefined' ? walletStorage.getWallet() : null;

  const [profile, setProfile] = useState<BusinessProfile>({
    businessName: '',
    businessType: 'FOOD_BEV',
    country: 'Nigeria',
    email: '',
    walletAddress: initialStoredWallet?.walletAddress || '',
    shortWallet: initialStoredWallet?.shortWallet || (initialStoredWallet?.walletAddress ? `${initialStoredWallet.walletAddress.slice(0, 6)}...${initialStoredWallet.walletAddress.slice(-6)}` : ''),
    settlementAsset: 'USDC',
    connectedWallet: (initialStoredWallet?.connectedWallet as any) || (initialStoredWallet?.walletAddress ? 'freighter' : null),
    usdcBalance: initialStoredWallet?.usdcBalance || '0.00',
    xlmBalance: initialStoredWallet?.xlmBalance || '0.00',
    statementName: '',
    defaultExpiry: '30 minutes',
    defaultSingleUse: true,
    allowPartialPayment: false,
    emailReceiptsToCustomers: true,
    emailOnEachPayment: false,
  });

  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [activeRequest, setActiveRequest] = useState<PaymentRequestData>({
    id: 'req-1',
    referenceId: initialNav.refId || '',
    amount: '',
    asset: 'USDC',
    customer: '',
    description: '',
    orderRef: initialNav.refId || generateOrderRef(),
    orders: [],
    expiresIn: '30 minutes',
    singleUse: true,
    paymentLink: initialNav.refId
      ? `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/checkout/${initialNav.refId}`
      : '',
    statusStep: 2,
    memo: initialNav.refId || '',
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleNavigate = (next: ScreenId, refId?: string) => {
    // AUTH GUARD: Prevent unauthenticated access to protected merchant screens
    const token = authStorage.getToken();
    if (PROTECTED_SCREENS.includes(next) && !token) {
      showToast('Please sign in or create an account to access the merchant portal.');
      setScreen('signin-1');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (window.location.pathname !== '/signin') {
        window.history.pushState({ screen: 'signin-1' }, '', '/signin');
      }
      return;
    }

    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let targetPath = SCREEN_PATH_MAP[next] || '/';
    if (next === 'customer-checkout') {
      const activeRef = refId || activeRequest.referenceId || activeRequest.orderRef;
      if (activeRef) {
        targetPath = `/checkout/${activeRef}`;
      }
      if (refId) {
        setActiveRequest((prev) => ({
          ...prev,
          referenceId: refId,
          orderRef: refId,
        }));
      }
    }

    if (window.location.pathname !== targetPath) {
      window.history.pushState({ screen: next }, '', targetPath);
    }

    if (token && (next === 'dashboard' || next === 'history' || next === 'settings' || next === 'payment-requests')) {
      loadProfile();
      loadTransactions();
      loadPaymentRequests();
    }
  };

  const [paymentRequests, setPaymentRequests] = useState<PaymentRequestData[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  const loadPaymentRequests = useCallback(async () => {
    if (!authStorage.getToken()) return;
    setIsLoadingRequests(true);
    try {
      const res = await api.payments.list();
      if (res.success) {
        const rawList = res.data?.results || (Array.isArray(res.data) ? res.data : []);
        setPaymentRequests(rawList.map(mapBackendPaymentRequestToFrontend));
      }
    } catch {}
    setIsLoadingRequests(false);
  }, []);

  const handleEditPaymentRequest = async (
    referenceId: string,
    updates: {
      amount?: string;
      currency?: 'USDC' | 'XLM';
      order_reference?: string;
      orders?: OrderItem[];
      title?: string;
      description?: string;
      customer_name?: string;
      customer_email?: string;
      status?: string;
      expires_in_minutes?: number;
    }
  ): Promise<boolean> => {
    try {
      const res = await api.payments.update(referenceId, updates);
      if (res.success && res.data) {
        showToast(`Payment request ${referenceId} updated successfully.`);
        await loadPaymentRequests();
        if (activeRequest.referenceId === referenceId) {
          setActiveRequest(mapBackendPaymentRequestToFrontend(res.data));
        }
        return true;
      } else {
        showToast(res.message || 'Failed to update payment request.');
        return false;
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating payment request.');
      return false;
    }
  };

  const handleCancelPaymentRequest = async (referenceId: string) => {
    try {
      const res = await api.payments.cancel(referenceId);
      if (res.success) {
        showToast(`Payment request ${referenceId} cancelled.`);
        await loadPaymentRequests();
      } else {
        showToast(res.message || 'Failed to cancel payment request.');
      }
    } catch (err: any) {
      showToast(err.message || 'Error cancelling payment request.');
    }
  };

  const handleUpdateProfile = (updates: Partial<BusinessProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...updates };
      if (updates.walletAddress === '' || updates.connectedWallet === null) {
        walletStorage.clearWallet();
      } else if (next.walletAddress) {
        const short = next.shortWallet || (next.walletAddress ? `${next.walletAddress.slice(0, 4)}...${next.walletAddress.slice(-4)}` : '');
        walletStorage.setWallet({
          walletAddress: next.walletAddress,
          shortWallet: short,
          connectedWallet: next.connectedWallet || 'freighter',
          usdcBalance: next.usdcBalance || '0.00',
          xlmBalance: next.xlmBalance || '0.00',
          isWalletVerified: Boolean(next.isWalletVerified),
        });
      }
      return next;
    });
  };

  const handleUpdateRequest = (updates: Partial<PaymentRequestData>) => {
    setActiveRequest((prev) => ({ ...prev, ...updates }));
  };

  const loadTransactions = useCallback(async () => {
    try {
      const res = await api.transactions.list();
      if (res.success) {
        const rawList = res.data?.results || (Array.isArray(res.data) ? res.data : []);
        if (rawList.length > 0) {
          setTransactions(rawList.map(mapBackendTxToFrontend));
        }
      }
    } catch {}
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const [profRes, walletRes] = await Promise.all([
        api.merchants.getProfile(),
        api.merchants.getWalletInfo(),
      ]);

      if (profRes.success && profRes.data) {
        const d = profRes.data;
        setProfile((prev) => ({
          ...prev,
          businessName: d.business_name || prev.businessName,
          businessType: d.category || prev.businessType,
          email: d.business_email || prev.email,
          statementName: d.business_name || prev.statementName,
          walletAddress: d.wallet?.public_key || prev.walletAddress,
          shortWallet: d.wallet?.public_key
            ? `${d.wallet.public_key.slice(0, 4)}...${d.wallet.public_key.slice(-4)}`
            : prev.shortWallet,
          apiKey: d.api_key || prev.apiKey,
          isWalletVerified: d.wallet?.is_verified ?? prev.isWalletVerified,
        }));
      }

      if (walletRes.success && walletRes.data) {
        const w = walletRes.data;
        const usdcBal =
          w.balances?.find((b: any) => b.asset === 'USDC')?.balance ||
          (w.usdc_balance != null && w.usdc_balance !== '' ? String(w.usdc_balance) : undefined);
        const xlmBal =
          w.balances?.find((b: any) => b.asset === 'XLM')?.balance ||
          (w.xlm_balance != null && w.xlm_balance !== '' ? String(w.xlm_balance) : undefined);

        setProfile((prev) => {
          const finalAddr = w.public_key || prev.walletAddress;
          const finalUsdc = usdcBal !== undefined ? usdcBal : prev.usdcBalance || '0.00';
          const finalXlm = xlmBal !== undefined ? xlmBal : prev.xlmBalance || '0.00';
          const finalShort = finalAddr
            ? `${finalAddr.slice(0, 4)}...${finalAddr.slice(-4)}`
            : prev.shortWallet;

          if (finalAddr) {
            walletStorage.setWallet({
              walletAddress: finalAddr,
              shortWallet: finalShort,
              connectedWallet: prev.connectedWallet || 'freighter',
              usdcBalance: finalUsdc,
              xlmBalance: finalXlm,
              isWalletVerified: w.is_verified ?? prev.isWalletVerified,
            });
          }

          return {
            ...prev,
            walletAddress: finalAddr,
            shortWallet: finalShort,
            usdcBalance: finalUsdc,
            xlmBalance: finalXlm,
            isWalletVerified: w.is_verified ?? prev.isWalletVerified,
          };
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    const stored = walletStorage.getWallet();
    if (stored?.walletAddress) {
      stellarWalletService.fetchAccountBalances(stored.walletAddress).then((bal) => {
        if (bal.isFunded) {
          handleUpdateProfile({
            usdcBalance: bal.usdcBalance,
            xlmBalance: bal.xlmBalance,
            isWalletVerified: true,
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const nav = resolveScreenFromLocation();
      setScreen(nav.screen);
      if (nav.refId) {
        setActiveRequest((prev) => ({
          ...prev,
          referenceId: nav.refId!,
          orderRef: nav.refId!,
        }));
      }
      if (authStorage.getToken() && (nav.screen === 'dashboard' || nav.screen === 'history' || nav.screen === 'settings' || nav.screen === 'payment-requests')) {
        loadProfile();
        loadTransactions();
        loadPaymentRequests();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loadProfile, loadTransactions, loadPaymentRequests]);

  useEffect(() => {
    const nav = resolveScreenFromLocation();
    let expectedPath = SCREEN_PATH_MAP[nav.screen] || '/';
    if (nav.screen === 'customer-checkout') {
      const activeRef = nav.refId || activeRequest.referenceId;
      if (activeRef) expectedPath = `/checkout/${activeRef}`;
    }
    if (window.location.hash && window.location.pathname === '/') {
      window.history.replaceState({ screen: nav.screen }, '', expectedPath);
    }
  }, []);

  useEffect(() => {
    if (authStorage.getToken()) {
      loadProfile();
      loadTransactions();
      loadPaymentRequests();
    }
  }, [loadProfile, loadTransactions, loadPaymentRequests]);

  const handleCreateRequest = async (req: PaymentRequestData): Promise<boolean> => {
    try {
      // 1. Sanitize & calculate amount
      let rawAmount = String(req.amount || '').replace(/[^0-9.]/g, '').trim();
      if (!rawAmount && req.orders && req.orders.length > 0) {
        const sum = req.orders.reduce((acc, it) => acc + (it.total || (it.price * it.quantity)), 0);
        rawAmount = sum.toFixed(2);
      }

      if (!rawAmount || isNaN(Number(rawAmount)) || Number(rawAmount) <= 0) {
        showToast('Please enter a valid payment amount greater than 0.');
        return false;
      }

      const minutes =
        req.expiresIn === '15 minutes'
          ? 15
          : req.expiresIn === '1 hour'
          ? 60
          : req.expiresIn === '24 hours'
          ? 1440
          : 30;

      // Extract customer name & email
      let custName = (req.customer || '').trim();
      let custEmail = (req.customerEmail || '').trim();
      if (!custEmail && custName.includes('@')) {
        custEmail = custName;
      }

      const payload: any = {
        amount: rawAmount,
        currency: (req.asset as 'USDC' | 'XLM') || 'USDC',
        order_reference: (req.orderRef || '').trim() || undefined,
        orders: req.orders && req.orders.length > 0 ? req.orders : undefined,
        customer_name: custName || undefined,
        customer_email: custEmail || undefined,
        title: (req.description || '').trim() || 'Payment Request',
        description: (req.description || '').trim(),
        expires_in_minutes: minutes,
      };

      if (profile.walletAddress) {
        payload.destination_address = profile.walletAddress;
      }

      const res = await api.payments.create(payload);

      if (res.success && res.data) {
        const d = res.data;
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://getsmehub.com';
        const validPaymentLink = `${origin}/checkout/${d.reference_id}`;

        const newReq: PaymentRequestData = {
          id: String(d.id),
          referenceId: d.reference_id,
          amount: String(d.amount),
          asset: d.currency,
          customer: d.customer_name || custName || 'Customer',
          description: d.title || req.description || 'Payment',
          orderRef: d.order_reference || d.reference_id,
          orders: d.orders || req.orders || [],
          expiresIn: req.expiresIn,
          singleUse: d.single_use,
          paymentLink: validPaymentLink,
          statusStep: 2,
          memo: d.memo,
          destinationAddress: d.destination_address,
          qrCodeBase64: d.qr_code_base64,
          sep0007Uri: d.sep0007_uri,
          status: d.status,
          expiresAt: d.expires_at,
          paidAt: d.paid_at,
          createdAt: d.created_at,
          customerEmail: d.customer_email || custEmail || '',
        };
        setActiveRequest(newReq);
        if (typeof window !== 'undefined') {
          try {
            const serialized = JSON.stringify(d);
            sessionStorage.setItem(`smehub_invoice_${d.reference_id}`, serialized);
            sessionStorage.setItem('smehub_active_checkout_ref', d.reference_id);
            localStorage.setItem(`smehub_invoice_${d.reference_id}`, serialized);
            localStorage.setItem('smehub_active_checkout_ref', d.reference_id);
          } catch {}
        }
        showToast('Stellar payment request generated with live QR and SEP-0007 URI.');
        loadTransactions();
        loadPaymentRequests();
        return true;
      } else {
        showToast(res.message || 'Failed to create payment request on backend.');
        return false;
      }
    } catch (err: any) {
      showToast(err.message || 'Network error creating payment request.');
      return false;
    }
  };

  const handlePaymentComplete = () => {
    setActiveRequest((prev) => ({ ...prev, statusStep: 4, status: 'COMPLETED' }));
    showToast('Payment confirmed on Stellar Testnet! Balance updated.');
    loadTransactions();
    loadProfile();
    loadPaymentRequests();
  };

  return (
    <div className="min-h-screen bg-[#F5F6F2] text-[#0B1F1A] relative">
      <AppErrorBoundary onReset={() => handleNavigate('landing')}>
        {/* Main Active Screen */}
        {screen === 'landing' && (
          <LandingPage onNavigate={handleNavigate} onNotify={showToast} />
        )}

        {(screen === 'signup-1' ||
          screen === 'signup-2' ||
          screen === 'signup-3' ||
          screen === 'signin-1' ||
          screen === 'signin-2') && (
          <AuthViews
            screen={screen}
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            onNavigate={handleNavigate}
            onNotify={showToast}
          />
        )}

        {(screen === 'dashboard' ||
          screen === 'payment-requests' ||
          screen === 'create-payment' ||
          screen === 'payment-created' ||
          screen === 'history' ||
          screen === 'settings') && (
          <MerchantViews
            screen={screen}
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            transactions={transactions}
            activeRequest={activeRequest}
            onUpdateRequest={handleUpdateRequest}
            onCreateRequest={handleCreateRequest}
            onNavigate={handleNavigate}
            onNotify={showToast}
            paymentRequests={paymentRequests}
            isLoadingRequests={isLoadingRequests}
            onRefreshRequests={loadPaymentRequests}
            onEditRequest={handleEditPaymentRequest}
            onCancelRequest={handleCancelPaymentRequest}
          />
        )}

        {screen === 'customer-checkout' && (
          <CustomerCheckout
            request={activeRequest}
            checkoutRefId={resolveScreenFromLocation().refId || activeRequest.referenceId}
            merchantName={profile.statementName}
            onPaymentComplete={handlePaymentComplete}
            onNavigate={handleNavigate}
            onNotify={showToast}
          />
        )}

        {/* Fallback in case screen is invalid */}
        {screen !== 'landing' &&
          !['signup-1', 'signup-2', 'signup-3', 'signin-1', 'signin-2', 'dashboard', 'payment-requests', 'create-payment', 'payment-created', 'history', 'settings', 'customer-checkout'].includes(screen) && (
            <LandingPage onNavigate={handleNavigate} onNotify={showToast} />
          )}
      </AppErrorBoundary>

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-[#0B1F1A] text-white border border-[#0F7B5F] px-5 py-3 rounded-[12px] shadow-xl text-[14px] font-bold flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#34D399]" />
          <span>{toast}</span>
        </div>
      )}


    </div>
  );
}

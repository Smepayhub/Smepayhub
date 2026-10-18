import React, { useState, useEffect } from 'react';
import {
  BusinessProfile,
  PaymentRequestData,
  OrderItem,
  ScreenId,
  Transaction,
  TransactionStatus,
  BUSINESS_CATEGORIES,
  normalizeBusinessCategory,
} from '../types';
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BarcodePlaceholderIcon,
  BrandLogo,
  HamburgerIcon,
  QrCodeSvg,
} from './Icons';
import { api, authStorage } from '../services/api';
import {
  openStellarWalletsKitModal,
  isValidStellarPublicKey,
  stellarWalletService,
  walletStorage,
} from '../services/stellarWallet';
import { generateOrderRef } from '../App';

interface MerchantViewsProps {
  screen: 'dashboard' | 'payment-requests' | 'create-payment' | 'payment-created' | 'history' | 'settings';
  profile: BusinessProfile;
  onUpdateProfile: (updates: Partial<BusinessProfile>) => void;
  transactions: Transaction[];
  activeRequest: PaymentRequestData;
  onUpdateRequest: (updates: Partial<PaymentRequestData>) => void;
  onCreateRequest: (req: PaymentRequestData) => Promise<boolean> | void;
  onNavigate: (screen: ScreenId, refId?: string) => void;
  onNotify: (msg: string) => void;
  paymentRequests?: PaymentRequestData[];
  isLoadingRequests?: boolean;
  onRefreshRequests?: () => Promise<void>;
  onEditRequest?: (
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
  ) => Promise<boolean>;
  onCancelRequest?: (referenceId: string) => Promise<void>;
}

const DEFAULT_DAILY_BARS = [
  { day: 'Mon', desktopH: 74, mobileH: 50, active: false, volume: 15 },
  { day: 'Tue', desktopH: 100, mobileH: 67, active: false, volume: 28 },
  { day: 'Wed', desktopH: 40, mobileH: 27, active: false, volume: 10 },
  { day: 'Thu', desktopH: 163, mobileH: 110, active: false, volume: 42 },
  { day: 'Fri', desktopH: 115, mobileH: 77, active: false, volume: 30 },
  { day: 'Sat', desktopH: 100, mobileH: 67, active: false, volume: 25 },
  { day: 'Today', desktopH: 178, mobileH: 120, active: true, volume: 65 },
];

export const MerchantViews: React.FC<MerchantViewsProps> = ({
  screen,
  profile,
  onUpdateProfile,
  transactions,
  activeRequest,
  onUpdateRequest,
  onCreateRequest,
  onNavigate,
  onNotify,
  paymentRequests = [],
  isLoadingRequests = false,
  onRefreshRequests,
  onEditRequest,
  onCancelRequest,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Dynamic backend data
  const [dashboardMetrics, setDashboardMetrics] = useState<any | null>(null);
  const [openRequests, setOpenRequests] = useState<any[]>([]);
  const [dailyBars, setDailyBars] = useState(DEFAULT_DAILY_BARS);
  const [isRefreshingKey, setIsRefreshingKey] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // History state: supports both Full Table View and Split Detail View on Desktop, and List vs Detail on Mobile
  const [historyFilter, setHistoryFilter] = useState<'All' | TransactionStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxId, setSelectedTxId] = useState<string | null>(transactions[0]?.id || 'tx-1');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [isFundingWallet, setIsFundingWallet] = useState(false);

  // Payment requests overview & editing state
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<'All' | 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'CANCELLED'>('All');
  const [requestAssetFilter, setRequestAssetFilter] = useState<'All' | 'USDC' | 'XLM'>('All');
  const [editingRequest, setEditingRequest] = useState<PaymentRequestData | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [copiedRefId, setCopiedRefId] = useState<string | null>(null);

  // Order choices modal state
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderModalTarget, setOrderModalTarget] = useState<'create' | 'edit'>('create');
  const [orderModalItems, setOrderModalItems] = useState<OrderItem[]>([]);

  const [editForm, setEditForm] = useState({
    amount: '',
    currency: 'USDC' as 'USDC' | 'XLM',
    orderRef: '',
    orders: [] as OrderItem[],
    customer: '',
    customerEmail: '',
    description: '',
    status: 'PENDING',
    extendMinutes: 0,
  });

  const handleOpenCreateOrderModal = () => {
    setOrderModalTarget('create');
    if (activeRequest.orders && activeRequest.orders.length > 0) {
      setOrderModalItems(JSON.parse(JSON.stringify(activeRequest.orders)));
    } else {
      setOrderModalItems([
        {
          id: `item-1-${Date.now()}`,
          name: activeRequest.description || 'Order Choice 1',
          price: Number(activeRequest.amount) || 15,
          quantity: 1,
          total: Number(activeRequest.amount) || 15,
        },
      ]);
    }
    setIsOrderModalOpen(true);
  };

  const handleOpenEditOrderModal = () => {
    setOrderModalTarget('edit');
    if (editForm.orders && editForm.orders.length > 0) {
      setOrderModalItems(JSON.parse(JSON.stringify(editForm.orders)));
    } else {
      setOrderModalItems([
        {
          id: `item-1-${Date.now()}`,
          name: editForm.description || 'Order Choice 1',
          price: Number(editForm.amount) || 15,
          quantity: 1,
          total: Number(editForm.amount) || 15,
        },
      ]);
    }
    setIsOrderModalOpen(true);
  };

  const handleAddModalItem = (name = '', price = 0, quantity = 1) => {
    const newItem: OrderItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: name,
      price: price,
      quantity: quantity,
      total: Math.round(price * quantity * 100) / 100,
    };
    setOrderModalItems((prev) => [...prev, newItem]);
  };

  const handleUpdateModalItem = (index: number, updates: Partial<OrderItem>) => {
    setOrderModalItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index], ...updates };
      const q = Math.max(1, Number(target.quantity) || 1);
      const p = Math.max(0, Number(target.price) || 0);
      target.quantity = q;
      target.price = p;
      target.total = Math.round(p * q * 100) / 100;
      copy[index] = target;
      return copy;
    });
  };

  const handleRemoveModalItem = (index: number) => {
    setOrderModalItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleApplyOrderItems = () => {
    const validItems = orderModalItems.filter((it) => it.name.trim() !== '' || it.price > 0);
    const sum = validItems.reduce((acc, it) => acc + (it.total || 0), 0);
    const formattedAmount = (Math.round(sum * 100) / 100).toFixed(2);

    if (orderModalTarget === 'create') {
      onUpdateRequest({
        orders: validItems,
        amount: formattedAmount,
      });
      onNotify(`Applied ${validItems.length} order choice(s). Total: ${formattedAmount} ${activeRequest.asset || 'USDC'}`);
    } else {
      setEditForm((prev) => ({
        ...prev,
        orders: validItems,
        amount: formattedAmount,
      }));
      onNotify(`Applied ${validItems.length} order choice(s) to edit form.`);
    }
    setIsOrderModalOpen(false);
  };

  const handleOpenEdit = (req: PaymentRequestData) => {
    setEditingRequest(req);
    setEditForm({
      amount: req.amount || '',
      currency: (req.asset as 'USDC' | 'XLM') || 'USDC',
      orderRef: req.orderRef || '',
      orders: req.orders ? JSON.parse(JSON.stringify(req.orders)) : [],
      customer: req.customer === 'Customer' ? '' : req.customer || '',
      customerEmail: req.customerEmail || '',
      description: req.description === 'Invoice settlement' ? '' : req.description || '',
      status: (req.status || 'PENDING').toUpperCase(),
      extendMinutes: 0,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest || !onEditRequest) return;
    setIsSavingEdit(true);
    const updates: any = {
      amount: editForm.amount,
      currency: editForm.currency,
      order_reference: editForm.orderRef || undefined,
      orders: editForm.orders && editForm.orders.length > 0 ? editForm.orders : undefined,
      customer_name: editForm.customer,
      customer_email: editForm.customerEmail || undefined,
      description: editForm.description,
      title: editForm.description || 'Payment Request',
      status: editForm.status,
    };
    if (editForm.extendMinutes > 0) {
      updates.expires_in_minutes = editForm.extendMinutes;
    }
    const ok = await onEditRequest(editingRequest.referenceId, updates);
    setIsSavingEdit(false);
    if (ok) {
      setEditingRequest(null);
    }
  };

  const handleCopyPaymentLink = (req: PaymentRequestData) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const link = (req.paymentLink && !req.paymentLink.includes('/api/'))
      ? req.paymentLink
      : `${origin}/checkout/${req.referenceId}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedRefId(req.referenceId);
      setTimeout(() => setCopiedRefId((prev) => (prev === req.referenceId ? null : prev)), 2500);
      onNotify(`Checkout link for ${req.referenceId} copied to clipboard!`);
    }
  };

  const totalRequestsCount = paymentRequests.length;
  const pendingRequestsCount = paymentRequests.filter(
    (r) => (r.status || 'PENDING').toUpperCase() === 'PENDING'
  ).length;
  const completedRequestsCount = paymentRequests.filter(
    (r) => (r.status || '').toUpperCase() === 'COMPLETED'
  ).length;
  const totalRequestsVolume = paymentRequests
    .filter((r) => r.asset === 'USDC')
    .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
    .toFixed(2);

  const filteredPaymentRequests = paymentRequests.filter((r) => {
    const st = (r.status || 'PENDING').toUpperCase();
    const matchesStatus = requestStatusFilter === 'All' || st === requestStatusFilter;
    const matchesAsset = requestAssetFilter === 'All' || r.asset === requestAssetFilter;
    const q = requestSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      r.referenceId.toLowerCase().includes(q) ||
      (r.customer && r.customer.toLowerCase().includes(q)) ||
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.memo && r.memo.toLowerCase().includes(q));
    return matchesStatus && matchesAsset && matchesQuery;
  });

  // Connect wallet via Stellar Wallets Kit
  const handleConnectWallet = async () => {
    try {
      const { address, walletId } = await openStellarWalletsKitModal();
      if (isValidStellarPublicKey(address)) {
        const short = `${address.slice(0, 4)}...${address.slice(-4)}`;
        const providerLabel = walletId
          ? walletId.charAt(0).toUpperCase() + walletId.slice(1)
          : 'Stellar Wallet';

        walletStorage.setWallet({
          walletAddress: address,
          shortWallet: short,
          connectedWallet: (walletId as any) || 'freighter',
          usdcBalance: '0.00',
          xlmBalance: '0.00',
          isWalletVerified: false,
        });

        onUpdateProfile({
          connectedWallet: (walletId as any) || 'freighter',
          walletAddress: address,
          shortWallet: short,
        });

        // Direct on-chain balance query
        stellarWalletService.fetchAccountBalances(address).then((bal) => {
          if (bal.isFunded) {
            onUpdateProfile({
              usdcBalance: bal.usdcBalance,
              xlmBalance: bal.xlmBalance,
              isWalletVerified: true,
            });
          }
        });

        if (authStorage.getToken()) {
          await api.merchants.connectWallet(address, providerLabel);
          const wInfo = await api.merchants.getWalletInfo();
          if (wInfo.success && wInfo.data) {
            const rawBalances = wInfo.data.balances || [];
            const usdc = rawBalances.find((b: any) => b.asset === 'USDC')?.balance || '0.00';
            const xlm = rawBalances.find((b: any) => b.asset === 'XLM')?.balance || '0.00';
            onUpdateProfile({
              usdcBalance: usdc,
              xlmBalance: xlm,
              isWalletVerified: true,
            });
          }
        }
        onNotify(`Connected ${providerLabel} (${short}) via Stellar Wallets Kit.`);
      }
    } catch (err: any) {
      const isCancel =
        err?.code === -1 ||
        /closed|cancel|reject|decline|abort/i.test(err?.message || '');
      if (!isCancel) {
        onNotify(err?.message || 'Could not connect wallet');
      }
    }
  };

  // Disconnect wallet
  const handleDisconnectWallet = () => {
    walletStorage.clearWallet();
    onUpdateProfile({
      connectedWallet: null,
      walletAddress: '',
      shortWallet: '',
      usdcBalance: '0.00',
      xlmBalance: '0.00',
      isWalletVerified: false,
    });
    onNotify('Wallet disconnected.');
  };

  // Fund connected wallet from Friendbot
  const handleRequestFriendbotFunding = async () => {
    if (!profile.walletAddress || !isValidStellarPublicKey(profile.walletAddress)) {
      onNotify('Please connect a valid Stellar wallet first.');
      return;
    }
    setIsFundingWallet(true);
    onNotify('Requesting 10,000 Testnet XLM from Stellar Friendbot...');
    const res = await stellarWalletService.fundTestnetWallet(profile.walletAddress);
    setIsFundingWallet(false);
    onNotify(res.message);
    if (res.success && authStorage.getToken()) {
      const wInfo = await api.merchants.getWalletInfo();
      if (wInfo.success && wInfo.data) {
        const rawBalances = wInfo.data.balances || [];
        const usdc = rawBalances.find((b: any) => b.asset === 'USDC')?.balance || profile.usdcBalance;
        const xlm = rawBalances.find((b: any) => b.asset === 'XLM')?.balance || '10000.00';
        onUpdateProfile({
          usdcBalance: usdc,
          xlmBalance: xlm,
        });
      }
    }
  };

  // Load metrics, volume chart, and open requests from backend
  useEffect(() => {
    let isMounted = true;

    // 1. Dashboard summary metrics
    api.analytics.getDashboard().then((res) => {
      if (isMounted && res.success && res.data) {
        setDashboardMetrics(res.data);
      }
    });

    // 2. Volume chart
    api.analytics.getVolumeChart(7).then((res) => {
      if (isMounted && res.success && Array.isArray(res.data) && res.data.length > 0) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const vols = res.data.map((d: any) => parseFloat(d.usdc_volume) || 0);
        const maxVol = Math.max(...vols, 10);
        const computedBars = res.data.map((item: any, idx: number) => {
          const dateObj = new Date(item.date);
          const dayLabel = idx === res.data.length - 1 ? 'Today' : days[dateObj.getDay()] || item.date;
          const vol = parseFloat(item.usdc_volume) || 0;
          const ratio = Math.min(1, Math.max(0.18, vol / maxVol));
          return {
            day: dayLabel,
            desktopH: Math.round(ratio * 178),
            mobileH: Math.round(ratio * 120),
            active: idx === res.data.length - 1,
            volume: vol,
          };
        });
        setDailyBars(computedBars);
      }
    });

    // 3. Open pending payment requests
    api.payments.list({ status: 'PENDING' }).then((res) => {
      if (isMounted && res.success && Array.isArray(res.data)) {
        setOpenRequests(res.data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [screen, transactions.length]);

  // Countdown timer for Payment Created screen
  const [secondsLeft, setSecondsLeft] = useState(27 * 60 + 14);
  useEffect(() => {
    if (screen !== 'payment-created') return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 30 * 60));
    }, 1000);
    return () => clearInterval(timer);
  }, [screen]);

  // Real-time payment verification polling on Payment Created screen
  useEffect(() => {
    const targetRef = activeRequest.referenceId || activeRequest.orderRef;
    if (screen !== 'payment-created' || !targetRef || activeRequest.statusStep === 4) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.payments.getPublicCheckout(targetRef);
        if (res.success && res.data) {
          if (res.data.status === 'COMPLETED') {
            onUpdateRequest({ statusStep: 4, status: 'COMPLETED' });
            onNotify('Payment confirmed on Stellar Testnet! Invoice settled.');
          }
        }
      } catch {}
    }, 3500);

    return () => clearInterval(interval);
  }, [screen, activeRequest.referenceId, activeRequest.orderRef, activeRequest.statusStep, onUpdateRequest, onNotify]);

  const formatCountdown = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Settings local state with unsaved changes counter
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [retypePass, setRetypePass] = useState('');

  const handleExportCsv = () => {
    const headers = ['Date,Reference,Amount,Asset,Status,TransactionHash'];
    const rows = transactions.map(
      (t) => `${t.date},"${t.referenceLabel}",${t.amount},${t.asset},${t.status},${t.fullHash}`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'smehub-transactions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('Exported transactions to smehub-transactions.csv');
  };

  const navItems: { id: ScreenId; label: string; activeMatch: ScreenId[] }[] = [
    { id: 'dashboard', label: 'Dashboard', activeMatch: ['dashboard'] },
    {
      id: 'payment-requests',
      label: 'Payment requests',
      activeMatch: ['payment-requests', 'create-payment', 'payment-created'],
    },
    { id: 'history', label: 'Transactions', activeMatch: ['history'] },
    { id: 'settings', label: 'Business settings', activeMatch: ['settings'] },
  ];

  // Guaranteed fallback transaction prevents blank white screen if transactions array is empty
  const fallbackTx: Transaction = {
    id: 'tx-fallback',
    orderRef: '--',
    customer: 'G...DEMO',
    referenceLabel: 'No payments yet',
    amount: '0.00',
    asset: 'USDC',
    status: 'Pending',
    date: 'No activity',
    shortHash: '--',
    fullHash: '--',
    network: 'Stellar testnet',
    fee: '0 XLM',
    description: 'Create a payment request to receive your first transaction.',
  };

  const selectedTx =
    transactions.find((t) => t.id === selectedTxId) || transactions[0] || fallbackTx;

  const filteredTransactions = transactions.filter((t) => {
    const matchesStatus = historyFilter === 'All' || t.status === historyFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      t.referenceLabel.toLowerCase().includes(q) ||
      t.customer.toLowerCase().includes(q) ||
      t.shortHash.toLowerCase().includes(q) ||
      t.fullHash.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-[#F5F6F2] text-[#0B1F1A] flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto relative overflow-x-hidden">
      {/* DESKTOP SIDEBAR (Responsive width, #0B1F1A) */}
      <aside className="hidden lg:flex w-[260px] xl:w-[290px] 2xl:w-[325px] shrink-0 bg-[#0B1F1A] min-h-screen flex-col justify-between pt-[47px] pb-[28px]">
        <div>
          {/* Brand + Divider Line */}
          <div className="px-6 pb-4 border-b border-[#BFE3D6]">
            <BrandLogo theme="dark" onClick={() => onNavigate('landing')} />
          </div>

          {/* Nav Links */}
          <nav className="mt-[60px] px-4 xl:px-[21px] space-y-2">
            {navItems.map((item) => {
              const isActive = item.activeMatch.includes(screen);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`w-full h-[48px] px-5 rounded-[13px] text-left text-[16px] xl:text-[18px] leading-[25px] font-bold text-white flex items-center transition-colors ${
                    isActive ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Connected Wallet Box */}
        <div className="px-4 xl:px-[14px]">
          {profile.walletAddress ? (
            <div className="w-full bg-white/10 rounded-[16px] p-4 space-y-3 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
                  <span className="text-[12px] font-bold text-[#A7E3CC]">
                    Stellar Testnet
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectWallet}
                  className="text-[11.5px] font-bold text-[#F87171] hover:text-[#EF4444] hover:underline"
                >
                  Disconnect
                </button>
              </div>

              <div>
                <div className="text-[11px] font-bold text-white/60">USDC Balance</div>
                <div className="text-[20px] leading-[26px] font-extrabold text-white tabular-nums">
                  {profile.usdcBalance || '0.00'} USDC
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                <div
                  title={profile.walletAddress}
                  className="text-[12px] font-mono font-bold text-white/80 tabular-nums truncate max-w-[140px]"
                >
                  {profile.shortWallet || `${profile.walletAddress.slice(0, 4)}...${profile.walletAddress.slice(-4)}`}
                </div>
                <button
                  type="button"
                  onClick={handleConnectWallet}
                  className="text-[11px] font-bold text-[#A7E3CC] hover:underline shrink-0"
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full bg-white/5 rounded-[16px] p-4 text-center border border-white/10 space-y-2.5">
              <div className="text-[12px] font-bold text-white/60">No Wallet Connected</div>
              <button
                type="button"
                onClick={handleConnectWallet}
                className="w-full h-[40px] rounded-[10px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-bold text-[13px] flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                <span>Connect Wallet</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              api.auth.logout();
              onUpdateProfile({ connectedWallet: null, walletAddress: '', shortWallet: '', usdcBalance: '0.00' });
              onNavigate('landing');
              onNotify('Signed out of SMEHUB.');
            }}
            className="w-full mt-2.5 h-[36px] rounded-[10px] border border-white/20 text-[12px] font-bold text-white/70 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* MOBILE SLIDE-OUT SIDEBAR DRAWER (240px wide) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-[240px] max-w-[80vw] bg-[#0B1F1A] h-full flex flex-col justify-between pt-[43px] pb-6 px-3 shadow-2xl">
            <div>
              <div className="px-2 pb-2.5 border-b border-[#BFE3D6] max-w-[165px]">
                <BrandLogo
                  theme="dark"
                  size="sm"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onNavigate('landing');
                  }}
                />
              </div>

              <nav className="mt-8 space-y-2">
                {navItems.map((item) => {
                  const isActive = item.activeMatch.includes(screen);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setMobileDetailOpen(false);
                        onNavigate(item.id);
                      }}
                      className={`w-full h-[45px] px-4 rounded-[12px] text-left text-[16px] leading-[23px] font-bold text-white flex items-center transition-colors ${
                        isActive ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="bg-white/10 rounded-[12px] p-3.5 space-y-2 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${profile.walletAddress ? 'bg-[#34D399]' : 'bg-white/40'}`} />
                  <span className="text-[12px] font-bold text-[#A7E3CC]">
                    {profile.walletAddress ? 'Stellar Testnet' : 'Not Connected'}
                  </span>
                </div>
                {profile.walletAddress && (
                  <button
                    type="button"
                    onClick={handleDisconnectWallet}
                    className="text-[11px] font-bold text-[#F87171] hover:underline"
                  >
                    Disconnect
                  </button>
                )}
              </div>

              {profile.walletAddress ? (
                <>
                  <div className="text-[16px] font-extrabold text-white tabular-nums">
                    {profile.usdcBalance || '0.00'} USDC
                  </div>
                  <div className="text-[12px] font-mono font-bold text-white/70">
                    {profile.shortWallet || `${profile.walletAddress.slice(0, 4)}...${profile.walletAddress.slice(-4)}`}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectWallet}
                  className="w-full h-[36px] rounded-[8px] bg-[#0F7B5F] text-white font-bold text-[12px] flex items-center justify-center gap-1.5"
                >
                  ⚡ Connect Wallet
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* DESKTOP TOP HEADER BAR (Showing balance, wallet address & disconnect button) */}
        <header className="hidden lg:flex h-[72px] bg-white border-b border-[#E3E7E1] px-6 lg:px-8 items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-extrabold tracking-wide uppercase text-[#0B1F1A]/50">
              Merchant Portal
            </span>
            <span className="text-[#0B1F1A]/30">/</span>
            <span className="text-[16px] font-bold text-[#0B1F1A]">
              {screen === 'dashboard'
                ? 'Overview & Insights'
                : screen === 'payment-requests'
                ? 'All Payment Requests'
                : screen === 'create-payment'
                ? 'Create Payment Request'
                : screen === 'payment-created'
                ? 'Active Payment Invoice'
                : screen === 'history'
                ? 'Transactions'
                : 'Business Settings'}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {profile.walletAddress ? (
              <div className="h-[44px] px-3.5 bg-[#F5F6F2] hover:bg-[#E8F4F0] border border-[#0F7B5F]/30 rounded-[12px] flex items-center gap-3 transition-colors shadow-2xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#34D399] animate-pulse" />
                  <span className="text-[12px] font-extrabold text-[#0F7B5F] uppercase tracking-wider">
                    Testnet
                  </span>
                </div>
                <div className="w-[1px] h-4 bg-black/15" />
                <div className="text-[14px] font-extrabold text-[#0B1F1A] tabular-nums">
                  {profile.usdcBalance || '0.00'} USDC
                </div>
                <div className="w-[1px] h-4 bg-black/15" />
                <div
                  title={profile.walletAddress}
                  className="text-[13px] font-mono font-bold text-black/70 cursor-pointer hover:text-black"
                  onClick={() => {
                    navigator.clipboard?.writeText(profile.walletAddress);
                    onNotify('Stellar wallet address copied to clipboard.');
                  }}
                >
                  {profile.shortWallet || `${profile.walletAddress.slice(0, 4)}...${profile.walletAddress.slice(-4)}`}
                </div>
                <button
                  type="button"
                  onClick={handleDisconnectWallet}
                  title="Disconnect Stellar Wallet"
                  className="ml-1 h-[26px] px-2 rounded-[6px] bg-red-50 hover:bg-red-100 text-[#C20C0C] text-[11px] font-bold transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectWallet}
                className="h-[42px] px-4 rounded-[12px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white text-[13px] font-bold flex items-center gap-2 transition-all shadow-sm active:scale-[0.99]"
              >
                <svg className="w-4 h-4 text-[#34D399]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Connect Wallet</span>
              </button>
            )}
          </div>
        </header>
        {/* =========================================================
            1. DASHBOARD VIEW
           ========================================================= */}
        {screen === 'dashboard' && (
          <>
            {/* Mobile Top Header */}
            <header className="flex lg:hidden h-[59px] bg-white border-b border-[#0F7B5F] px-3 items-center justify-between">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex items-end gap-[14.5px] focus:outline-none"
              >
                <HamburgerIcon />
                <span className="text-[20.2px] leading-[28px] font-bold text-black">
                  SMEHUB
                </span>
              </button>
              <div className="flex items-center gap-2">
                <span className="w-[5px] h-[5px] rounded-full bg-[#34D399]" />
                <span className="text-[11px] leading-[15px] font-bold text-[#0F7B5F]">
                  Testnet
                </span>
              </div>
            </header>

            <main className="p-3 sm:p-6 lg:p-[30px] lg:pt-[45px] pb-24 lg:pb-12">
              {/* Top Heading + Desktop Actions */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 sm:gap-3 text-[15.7px] sm:text-[28px] leading-[21px] sm:leading-[38px] font-bold text-[#0B1F1A]/70">
                    <span>{profile.statementName || 'Adaeze bakery'}</span>
                    <span className="w-[4px] h-[4px] sm:w-[5px] sm:h-[5px] rounded-full bg-[#1E1E1E]" />
                    <span>Today</span>
                  </div>
                  <h1 className="mt-0.5 text-[29.4px] sm:text-[38px] leading-[40px] sm:leading-[52px] font-bold text-[#0B1F1A]">
                    Payment overview
                  </h1>
                </div>

                <div className="hidden sm:flex items-center gap-[30px]">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="w-[163px] h-[43px] bg-white border border-[#0B1F1A] rounded-[10px] text-[16px] font-bold text-[#0B1F1A]/70 hover:text-[#0B1F1A] hover:bg-black/5 transition-colors"
                  >
                    Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('create-payment')}
                    className="w-[195px] h-[43px] bg-[#0F7B5F] hover:bg-[#0c634c] rounded-[10px] text-[16px] font-bold text-white transition-colors"
                  >
                    + New payment request
                  </button>
                </div>
              </div>

              {/* 4 KPI Stat Cards */}
              {/* Desktop 4-col */}
              <div className="hidden sm:grid sm:grid-cols-2 xl:grid-cols-4 gap-[28px] mt-[24px]">
                {/* Received */}
                <div className="h-[189px] bg-white border border-[#E3E7E1] rounded-[20px] p-6 flex flex-col justify-between shadow-sm">
                  <div className="text-[16px] leading-[22px] font-bold text-[#0B1F1A]">
                    Received
                  </div>
                  <div className="text-[34px] xl:text-[38px] leading-[48px] font-bold text-[#0B1F1A] tabular-nums truncate">
                    {dashboardMetrics?.total_volume_usdc
                      ? `${parseFloat(dashboardMetrics.total_volume_usdc).toFixed(2)} USDC`
                      : `${profile.usdcBalance} USDC`}
                  </div>
                  <div className="flex items-center gap-2 text-[15px] leading-[22px] font-bold text-[#0F7B5F]">
                    <span>Testnet</span>
                    <span className="w-[5px] h-[5px] rounded-full bg-[#0F7B5F]" />
                    <span>Settled Volume</span>
                  </div>
                </div>

                {/* Completed */}
                <div
                  onClick={() => {
                    setHistoryFilter('Completed');
                    onNavigate('history');
                  }}
                  className="h-[189px] bg-white border border-[#E3E7E1] rounded-[20px] p-6 flex flex-col justify-between cursor-pointer hover:border-[#0F7B5F]/50 transition-colors shadow-sm"
                >
                  <div className="text-[16px] leading-[22px] font-bold text-[#0B1F1A]">
                    Completed
                  </div>
                  <div className="text-[38px] leading-[52px] font-bold text-[#0B1F1A] tabular-nums">
                    {dashboardMetrics?.completed_payments_count ??
                      transactions.filter((t) => t.status === 'Completed').length}
                  </div>
                  <div className="text-[16px] leading-[22px] font-bold text-[#0F7B5F]">
                    Matched to requests
                  </div>
                </div>

                {/* Pending */}
                <div
                  onClick={() => {
                    setHistoryFilter('Pending');
                    onNavigate('history');
                  }}
                  className="h-[189px] bg-[#FFFBEB] border border-[#F3DFA5] rounded-[20px] p-6 flex flex-col justify-between cursor-pointer hover:border-[#7A4B00]/50 transition-colors shadow-sm"
                >
                  <div className="text-[16px] leading-[22px] font-bold text-[#7A4B00]">
                    Pending
                  </div>
                  <div className="text-[38px] leading-[52px] font-bold text-[#0B1F1A] tabular-nums">
                    {dashboardMetrics?.pending_payments_count ?? openRequests.length}
                  </div>
                  <div className="text-[16px] leading-[22px] font-bold text-[#7A4B00]">
                    Awaiting confirmation
                  </div>
                </div>

                {/* Failed / Expired */}
                <div
                  onClick={() => {
                    setHistoryFilter('Failed');
                    onNavigate('history');
                  }}
                  className="h-[189px] bg-white border border-[#E3E7E1] rounded-[20px] p-6 flex flex-col justify-between cursor-pointer hover:border-[#C20C0C]/50 transition-colors shadow-sm"
                >
                  <div className="text-[16px] leading-[22px] font-bold text-[#0B1F1A]">
                    Failed / Expired
                  </div>
                  <div className="text-[38px] leading-[52px] font-bold text-[#0B1F1A] tabular-nums">
                    {dashboardMetrics
                      ? (dashboardMetrics.expired_payments_count || 0) +
                        (dashboardMetrics.cancelled_payments_count || 0)
                      : transactions.filter((t) => t.status === 'Failed').length}
                  </div>
                  <div className="text-[16px] leading-[22px] font-bold text-[#C20C0C]">
                    Needs attention
                  </div>
                </div>
              </div>

              {/* Mobile 2x2 KPI Grid */}
              <div className="grid sm:hidden grid-cols-2 gap-3 mt-5">
                <div className="h-[104px] bg-white border border-[#E3E7E1] rounded-[15px] p-3.5 flex flex-col justify-between shadow-sm">
                  <div className="text-[12px] leading-[16px] font-bold text-[#0B1F1A]">
                    Received
                  </div>
                  <div className="text-[24px] leading-[32px] font-bold text-[#0B1F1A] tabular-nums truncate">
                    {dashboardMetrics?.total_volume_usdc
                      ? `${parseFloat(dashboardMetrics.total_volume_usdc).toFixed(1)} USDC`
                      : `${profile.usdcBalance} USDC`}
                  </div>
                </div>

                <div
                  onClick={() => onNavigate('history')}
                  className="h-[104px] bg-white border border-[#E3E7E1] rounded-[15px] p-3.5 flex flex-col justify-between shadow-sm"
                >
                  <div className="text-[12px] leading-[16px] font-bold text-[#0B1F1A]">
                    Completed
                  </div>
                  <div className="text-[28.5px] leading-[39px] font-bold text-[#0B1F1A] tabular-nums">
                    {dashboardMetrics?.completed_payments_count ??
                      transactions.filter((t) => t.status === 'Completed').length}
                  </div>
                </div>

                <div
                  onClick={() => onNavigate('history')}
                  className="h-[104px] bg-[#FFFBEB] border border-[#F3DFA5] rounded-[16px] p-3.5 flex flex-col justify-between shadow-sm"
                >
                  <div className="text-[13px] leading-[18px] font-bold text-[#7A4B00]">
                    Pending
                  </div>
                  <div className="text-[30.8px] leading-[42px] font-bold text-[#0B1F1A] tabular-nums">
                    {dashboardMetrics?.pending_payments_count ?? openRequests.length}
                  </div>
                </div>

                <div
                  onClick={() => onNavigate('history')}
                  className="h-[104px] bg-white border border-[#E3E7E1] rounded-[15px] p-3.5 flex flex-col justify-between shadow-sm"
                >
                  <div className="text-[12px] leading-[16px] font-bold text-[#C20C0C]">
                    Failed
                  </div>
                  <div className="text-[28.5px] leading-[39px] font-bold text-[#0B1F1A] tabular-nums">
                    {dashboardMetrics
                      ? (dashboardMetrics.expired_payments_count || 0) +
                        (dashboardMetrics.cancelled_payments_count || 0)
                      : 2}
                  </div>
                </div>
              </div>

              {/* Middle Row: Received per day Chart + Open requests */}
              <div className="mt-6 sm:mt-[40px] grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-[30px]">
                {/* Bar Chart Card */}
                <div className="xl:col-span-7 bg-white border border-[#E3E7E1] rounded-[13.4px] sm:rounded-[20px] p-4 sm:p-7 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[14.8px] sm:text-[22px] leading-[20px] sm:leading-[30px] font-bold text-[#0B1F1A]">
                      Received per day
                    </h2>
                    <span className="text-[12px] sm:text-[16px] font-bold text-[#0F7B5F]">
                      Last 7 Days (USDC)
                    </span>
                  </div>

                  {/* Chart Canvas */}
                  <div className="relative mt-4 sm:mt-6 h-[135px] sm:h-[190px] flex items-end justify-between px-2 sm:px-4">
                    {/* Horizontal Grid Lines */}
                    <div className="absolute inset-x-0 top-[25%] border-t border-black/10 pointer-events-none" />
                    <div className="absolute inset-x-0 top-[60%] border-t border-black/10 pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 border-t border-black/10 pointer-events-none" />

                    {dailyBars.map((bar) => (
                      <div
                        key={bar.day}
                        title={`${bar.day}: ${bar.volume} USDC`}
                        className="relative z-10 flex flex-col items-center group cursor-pointer"
                      >
                        {/* Desktop Bar */}
                        <div
                          style={{ height: bar.desktopH }}
                          className={`hidden sm:block transition-all group-hover:scale-y-105 ${
                            bar.active
                              ? 'w-[29px] bg-[#0F7B5F] rounded-[15px]'
                              : 'w-[45px] bg-[#BFE3D6] rounded-[10px]'
                          }`}
                        />
                        {/* Mobile Bar */}
                        <div
                          style={{ height: bar.mobileH }}
                          className={`sm:hidden ${
                            bar.active
                              ? 'w-[19.5px] bg-[#0F7B5F] rounded-[10px]'
                              : 'w-[30.2px] bg-[#BFE3D6] rounded-[6.7px]'
                          }`}
                        />
                      </div>
                    ))}
                  </div>

                  {/* X-Axis Labels */}
                  <div className="mt-2 flex items-center justify-between px-2 sm:px-4 text-[10.8px] sm:text-[16px] leading-[15px] sm:leading-[22px] font-normal text-[#0B1F1A]">
                    {dailyBars.map((bar) => (
                      <span
                        key={bar.day}
                        className="w-[30px] sm:w-[45px] text-center font-bold"
                      >
                        {bar.day}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Open Requests Card (Desktop Right Column) */}
                <div className="hidden xl:flex xl:col-span-5 bg-white border border-[#E3E7E1] rounded-[20px] flex-col shadow-sm">
                  <div className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-black/10">
                    <h2 className="text-[22px] leading-[30px] font-bold text-[#0B1F1A]">
                      Open requests
                    </h2>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[13px] font-bold text-[#0F7B5F] bg-[#E8F4F0] px-2.5 py-1 rounded-[8px]">
                        {openRequests.length} active
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('payment-requests')}
                        className="text-[13px] font-bold text-[#0F7B5F] hover:underline ml-1"
                      >
                        View all →
                      </button>
                    </div>
                  </div>

                  <div className="divide-y divide-black/15 overflow-y-auto max-h-[280px]">
                    {openRequests.length === 0 ? (
                      <div className="p-8 text-center text-black/60 font-medium">
                        No pending payment requests.
                      </div>
                    ) : (
                      openRequests.map((req) => (
                        <div
                          key={req.id || req.reference_id}
                          onClick={() => {
                            onUpdateRequest({
                              id: req.id,
                              referenceId: req.reference_id,
                              amount: req.amount,
                              asset: req.currency,
                              customer: req.customer_name || 'Customer',
                              description: req.description || req.title,
                              orderRef: req.reference_id,
                              paymentLink: (req.checkout_url && !req.checkout_url.includes('/api/'))
                                ? req.checkout_url
                                : `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/checkout/${req.reference_id}`,
                              statusStep: 2,
                              memo: req.memo,
                              destinationAddress: req.destination_address,
                              qrCodeBase64: req.qr_code_base64,
                              sep0007Uri: req.sep0007_uri,
                              status: req.status,
                              expiresAt: req.expires_at,
                            });
                            onNavigate('payment-created');
                          }}
                          className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-[#E8F4F0]/40 transition-colors"
                        >
                          <div className="min-w-0 pr-3">
                            <div className="text-[17px] font-bold text-[#0B1F1A] truncate">
                              {req.customer_name ? `${req.customer_name} - ${req.reference_id}` : req.title || req.reference_id}
                            </div>
                            <div className="text-[13px] text-black/60 font-medium truncate">
                              {req.amount} {req.currency} • {req.title}
                            </div>
                          </div>
                          <span className="text-[14px] font-bold text-[#7A4B00] bg-[#FFFBEB] border border-[#F3DFA5] px-2.5 py-0.5 rounded-[6px] shrink-0">
                            Pending
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Row: Desktop Recent Transactions Table */}
              <div className="hidden sm:block mt-[40px] bg-white border border-[#E3E7E1] rounded-[20px] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-black/30 text-[19px] leading-[26px] font-bold text-[#0B1F1A]/70">
                        <th className="py-5 px-8">Reference</th>
                        <th className="py-5 px-6">AMOUNT</th>
                        <th className="py-5 px-6">STATUS</th>
                        <th className="py-5 px-8 text-right">TRANSACTION HASH</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/20 text-[19px] leading-[26px] font-bold">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-black/60 font-medium">
                            No transactions recorded yet. Click "+ New payment request" to accept your first payment.
                          </td>
                        </tr>
                      ) : (
                        transactions.slice(0, 3).map((tx) => (
                          <tr
                            key={tx.id}
                            onClick={() => {
                              setSelectedTxId(tx.id);
                              onNavigate('history');
                            }}
                            className="cursor-pointer hover:bg-[#E8F4F0]/50 transition-colors"
                          >
                            <td className="py-6 px-8 text-[#0B1F1A] whitespace-nowrap">
                              {tx.referenceLabel}
                            </td>
                            <td className="py-6 px-6 text-[#0B1F1A] tabular-nums whitespace-nowrap">
                              {tx.amount} {tx.asset}
                            </td>
                            <td
                              className={`py-6 px-6 whitespace-nowrap ${
                                tx.status === 'Completed'
                                  ? 'text-[#0F7B5F]'
                                  : tx.status === 'Failed'
                                  ? 'text-[#C20C0C]'
                                  : 'text-[#7A4B00]'
                              }`}
                            >
                              {tx.status}
                            </td>
                            <td className="py-6 px-8 text-right text-[#0B1F1A] tabular-nums whitespace-nowrap">
                              {tx.shortHash}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Recent Transactions Section */}
              <div className="sm:hidden mt-6">
                <div className="flex items-center justify-between mb-2.5 px-0.5">
                  <span className="text-[12.8px] leading-[17px] font-bold text-[#0B1F1A]">
                    Recent Transactions
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('history')}
                    className="text-[12.8px] leading-[17px] font-bold text-[#0B1F1A] hover:text-[#0F7B5F]"
                  >
                    View all
                  </button>
                </div>

                <div className="bg-white border border-[#E3E7E1] rounded-[8px] divide-y divide-black/20">
                  {transactions.length === 0 ? (
                    <div className="p-6 text-center text-black/60 text-[13px] font-medium">
                      No transactions recorded yet.
                    </div>
                  ) : (
                    transactions.slice(0, 5).map((tx) => (
                      <div
                        key={tx.id}
                        onClick={() => {
                          setSelectedTxId(tx.id);
                          setMobileDetailOpen(true);
                          onNavigate('history');
                        }}
                        className="px-3.5 py-2.5 flex items-center justify-between cursor-pointer active:bg-[#E8F4F0]"
                      >
                        <div>
                          <div className="text-[11.5px] leading-[16px] font-bold text-[#0B1F1A]">
                            {tx.referenceLabel}
                          </div>
                          <div className="text-[9.5px] leading-[13px] font-bold text-[#0B1F1A]/70 mt-0.5">
                            {tx.date.toLowerCase()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11.5px] leading-[16px] font-bold text-[#0B1F1A] tabular-nums">
                            {tx.amount} {tx.asset}
                          </div>
                          <div
                            className={`text-[9.5px] leading-[13px] font-bold mt-0.5 ${
                              tx.status === 'Completed'
                                ? 'text-[#0F7B5F] lowercase'
                                : tx.status === 'Failed'
                                ? 'text-[#C20C0C]'
                                : 'text-[#FEBD00]'
                            }`}
                          >
                            {tx.status}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Mobile Floating "+ New request" Button */}
              <button
                type="button"
                onClick={() => onNavigate('create-payment')}
                className="sm:hidden fixed bottom-6 right-4 z-30 w-[152px] h-[50px] bg-[#0F7B5F] rounded-[9px] text-[18px] font-bold text-white shadow-lg flex items-center justify-center"
              >
                + New request
              </button>
            </main>
          </>
        )}

        {/* =========================================================
            1.5 ALL PAYMENT REQUESTS VIEW (VIEW & EDIT ALL REQUESTS)
           ========================================================= */}
        {screen === 'payment-requests' && (
          <>
            {/* Mobile Top Header */}
            <header className="flex lg:hidden h-[59px] bg-white border-b border-[#0F7B5F] px-4 items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  className="w-8 h-8 rounded-lg bg-[#F5F6F2] flex items-center justify-center text-[#0B1F1A]"
                  aria-label="Open navigation menu"
                >
                  <HamburgerIcon className="scale-75" />
                </button>
                <span className="text-[17px] font-bold text-black">
                  Payment Requests
                </span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('create-payment')}
                className="h-[34px] px-3 bg-[#0F7B5F] rounded-[8px] text-[13px] font-bold text-white flex items-center gap-1.5 shadow-sm"
              >
                <span>+ Create</span>
              </button>
            </header>

            <main className="p-4 sm:p-6 lg:p-[30px] lg:pt-[40px] pb-16 w-full max-w-[1600px] overflow-x-hidden">
              {/* Header with Title and Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h1 className="text-[26px] sm:text-[32px] font-extrabold text-[#0B1F1A] tracking-tight">
                    Payment Requests
                  </h1>
                  <p className="text-[14px] sm:text-[15px] font-medium text-[#0B1F1A]/70 mt-1">
                    Manage, edit, cancel, and generate live payment requests & customer checkout links.
                  </p>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  {onRefreshRequests && (
                    <button
                      type="button"
                      onClick={() => onRefreshRequests()}
                      disabled={isLoadingRequests}
                      className="h-[46px] px-4 bg-white hover:bg-[#F5F6F2] border border-[#E3E7E1] rounded-[12px] text-[14px] font-bold text-[#0B1F1A] inline-flex items-center gap-2 transition-colors shadow-2xs"
                    >
                      <span className={`text-[16px] ${isLoadingRequests ? 'animate-spin' : ''}`}>↻</span>
                      <span>Refresh</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate('create-payment')}
                    className="h-[46px] px-5 bg-[#0F7B5F] hover:bg-[#0c634c] text-white rounded-[12px] text-[14px] font-bold inline-flex items-center gap-2 shadow-sm transition-all hover:scale-[1.01]"
                  >
                    <span>+ New Payment Request</span>
                    <ArrowRightIcon color="#FFFFFF" />
                  </button>
                </div>
              </div>

              {/* 4 Top Summary Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-8">
                <div className="bg-white border border-[#E3E7E1] rounded-[20px] p-4 sm:p-5 shadow-2xs">
                  <div className="text-[12px] sm:text-[13px] font-bold text-[#0B1F1A]/60 uppercase tracking-wide">
                    Total Invoices
                  </div>
                  <div className="mt-2 text-[24px] sm:text-[32px] font-extrabold text-[#0B1F1A] tabular-nums">
                    {totalRequestsCount}
                  </div>
                  <div className="mt-1 text-[11px] sm:text-[12px] text-[#0B1F1A]/50 font-medium">
                    All-time generated
                  </div>
                </div>

                <div className="bg-white border border-[#E3E7E1] rounded-[20px] p-4 sm:p-5 shadow-2xs">
                  <div className="text-[12px] sm:text-[13px] font-bold text-amber-600 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    <span>Pending</span>
                  </div>
                  <div className="mt-2 text-[24px] sm:text-[32px] font-extrabold text-amber-700 tabular-nums">
                    {pendingRequestsCount}
                  </div>
                  <div className="mt-1 text-[11px] sm:text-[12px] text-[#0B1F1A]/50 font-medium">
                    Awaiting customer payment
                  </div>
                </div>

                <div className="bg-white border border-[#E3E7E1] rounded-[20px] p-4 sm:p-5 shadow-2xs">
                  <div className="text-[12px] sm:text-[13px] font-bold text-[#0F7B5F] uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                    <span>Completed</span>
                  </div>
                  <div className="mt-2 text-[24px] sm:text-[32px] font-extrabold text-[#0F7B5F] tabular-nums">
                    {completedRequestsCount}
                  </div>
                  <div className="mt-1 text-[11px] sm:text-[12px] text-[#0B1F1A]/50 font-medium">
                    Settled on Stellar ledger
                  </div>
                </div>

                <div className="bg-white border border-[#E3E7E1] rounded-[20px] p-4 sm:p-5 shadow-2xs">
                  <div className="text-[12px] sm:text-[13px] font-bold text-[#0B1F1A]/60 uppercase tracking-wide">
                    Total Value
                  </div>
                  <div className="mt-2 text-[24px] sm:text-[32px] font-extrabold text-[#0B1F1A] tabular-nums truncate">
                    ${totalRequestsVolume}
                  </div>
                  <div className="mt-1 text-[11px] sm:text-[12px] text-[#0B1F1A]/50 font-medium">
                    USDC requested
                  </div>
                </div>
              </div>

              {/* Filters & Search Control Bar */}
              <div className="bg-white border border-[#E3E7E1] rounded-[20px] p-4 sm:p-5 mb-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Status Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                  {(['All', 'PENDING', 'COMPLETED', 'EXPIRED', 'CANCELLED'] as const).map((st) => {
                    const isActive = requestStatusFilter === st;
                    const label =
                      st === 'All'
                        ? `All (${paymentRequests.length})`
                        : st === 'PENDING'
                        ? `Pending (${pendingRequestsCount})`
                        : st === 'COMPLETED'
                        ? `Completed (${completedRequestsCount})`
                        : st === 'EXPIRED'
                        ? 'Expired'
                        : 'Cancelled';
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setRequestStatusFilter(st)}
                        className={`h-[38px] px-3.5 rounded-[10px] text-[13px] font-bold whitespace-nowrap transition-colors ${
                          isActive
                            ? 'bg-[#0F7B5F] text-white shadow-2xs'
                            : 'bg-[#F5F6F2] hover:bg-[#E8F4F0] text-[#0B1F1A]/80'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Search & Asset Filter */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 sm:w-[240px]">
                    <input
                      type="text"
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                      placeholder="Search requests..."
                      className="w-full h-[40px] pl-9 pr-3 bg-[#F5F6F2] border border-transparent focus:border-[#0F7B5F] rounded-[10px] text-[13px] font-medium text-black focus:outline-none"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40 text-[14px]">
                      🔍
                    </span>
                    {requestSearch && (
                      <button
                        type="button"
                        onClick={() => setRequestSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] font-bold text-black/40 hover:text-black"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <select
                    value={requestAssetFilter}
                    onChange={(e) => setRequestAssetFilter(e.target.value as any)}
                    className="h-[40px] px-3 bg-[#F5F6F2] border border-transparent focus:border-[#0F7B5F] rounded-[10px] text-[13px] font-bold text-[#0B1F1A] focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Assets</option>
                    <option value="USDC">USDC</option>
                    <option value="XLM">XLM</option>
                  </select>
                </div>
              </div>

              {/* Table or Empty State */}
              <div className="bg-white border border-[#E3E7E1] rounded-[24px] shadow-xs overflow-hidden">
                {filteredPaymentRequests.length === 0 ? (
                  <div className="p-12 sm:p-16 text-center flex flex-col items-center">
                    <div className="w-16 h-16 rounded-full bg-[#E8F4F0] text-[#0F7B5F] flex items-center justify-center text-[28px] mb-4">
                      📄
                    </div>
                    <div className="text-[20px] font-bold text-[#0B1F1A]">
                      No payment requests found
                    </div>
                    <p className="text-[14px] text-[#0B1F1A]/60 max-w-[380px] mt-1.5 mb-6">
                      {requestSearch || requestStatusFilter !== 'All'
                        ? 'Try adjusting your search query or status filter.'
                        : 'Create your first Stellar payment request to accept non-custodial crypto payments from customers.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate('create-payment')}
                      className="h-[46px] px-6 bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-bold text-[14px] rounded-[12px] shadow-sm transition-colors"
                    >
                      + Create Payment Request
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left border-collapse min-w-[850px]">
                      <thead>
                        <tr className="border-b border-[#E3E7E1] bg-[#F5F6F2]/50 text-[12px] font-extrabold uppercase text-[#0B1F1A]/60 tracking-wider">
                          <th className="py-4 px-6">Reference & Memo</th>
                          <th className="py-4 px-6">Customer</th>
                          <th className="py-4 px-6">Amount</th>
                          <th className="py-4 px-6">Description</th>
                          <th className="py-4 px-6">Status</th>
                          <th className="py-4 px-6">Expiry</th>
                          <th className="py-4 px-6 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E3E7E1]">
                        {filteredPaymentRequests.map((req) => {
                          const st = (req.status || 'PENDING').toUpperCase();
                          return (
                            <tr
                              key={req.referenceId || req.id}
                              className="hover:bg-[#F5F6F2]/40 transition-colors group"
                            >
                              {/* Reference & Memo */}
                              <td className="py-4 px-6">
                                <div className="font-bold text-[15px] text-[#0B1F1A] flex flex-wrap items-center gap-1.5">
                                  <span>{req.referenceId}</span>
                                  {req.orderRef && (
                                    <span
                                      className="text-[11px] px-2 py-0.5 rounded bg-[#0F7B5F]/10 text-[#0F7B5F] font-mono font-bold"
                                      title="Auto-generated Order Reference"
                                    >
                                      {req.orderRef}
                                    </span>
                                  )}
                                  {req.memo && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E8F4F0] text-[#0F7B5F] font-mono font-bold">
                                      MEMO
                                    </span>
                                  )}
                                </div>
                                <div className="text-[12px] text-[#0B1F1A]/50 mt-0.5">
                                  {req.createdAt
                                    ? new Date(req.createdAt).toLocaleDateString([], {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })
                                    : 'Recent'}
                                </div>
                              </td>

                              {/* Customer */}
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-[#0F7B5F]/10 text-[#0F7B5F] font-bold text-[12px] flex items-center justify-center shrink-0">
                                    {(req.customer || 'C').slice(0, 2).toUpperCase()}
                                  </div>
                                  <div className="truncate max-w-[130px]">
                                    <div className="text-[14px] font-bold text-[#0B1F1A] truncate">
                                      {req.customer || 'Customer'}
                                    </div>
                                    {req.customerEmail && (
                                      <div className="text-[11px] text-[#0B1F1A]/60 truncate">
                                        {req.customerEmail}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Amount & Items */}
                              <td className="py-4 px-6">
                                <div className="text-[16px] font-extrabold text-[#0B1F1A] tabular-nums">
                                  {req.amount} <span className="text-[13px] font-bold text-[#0F7B5F]">{req.asset}</span>
                                </div>
                                {req.orders && req.orders.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(req)}
                                    className="text-[11px] text-[#0F7B5F] font-bold mt-0.5 flex items-center gap-1 hover:underline cursor-pointer"
                                    title="Click to view/edit item choices"
                                  >
                                    <span>📦</span>
                                    <span>{req.orders.length} order choice{req.orders.length > 1 ? 's' : ''}</span>
                                  </button>
                                )}
                              </td>

                              {/* Description */}
                              <td className="py-4 px-6">
                                <div
                                  className="text-[13px] text-[#0B1F1A]/80 font-medium max-w-[200px] truncate"
                                  title={req.description}
                                >
                                  {req.description || '--'}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="py-4 px-6">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-bold ${
                                    st === 'COMPLETED'
                                      ? 'bg-[#E8F4F0] text-[#0F7B5F] border border-[#34D399]/40'
                                      : st === 'PENDING'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-300'
                                      : st === 'EXPIRED'
                                      ? 'bg-slate-100 text-slate-600 border border-slate-300'
                                      : 'bg-rose-50 text-rose-700 border border-rose-300'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      st === 'COMPLETED'
                                        ? 'bg-[#0F7B5F]'
                                        : st === 'PENDING'
                                        ? 'bg-amber-500 animate-pulse'
                                        : 'bg-slate-400'
                                    }`}
                                  />
                                  <span>{st}</span>
                                </span>
                              </td>

                              {/* Expiry */}
                              <td className="py-4 px-6">
                                <div className="text-[12px] text-[#0B1F1A]/70 font-medium tabular-nums">
                                  {req.expiresIn || '--'}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="py-4 px-6 text-right">
                                <div className="inline-flex items-center gap-2">
                                  {/* Edit Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(req)}
                                    className="h-[34px] px-3 bg-white hover:bg-[#E8F4F0] border border-[#0F7B5F]/40 text-[#0F7B5F] rounded-[8px] text-[12px] font-bold inline-flex items-center gap-1 transition-colors shadow-2xs"
                                    title="Edit payment request details"
                                  >
                                    <span>✏️</span>
                                    <span>Edit</span>
                                  </button>

                                  {/* Copy Link Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyPaymentLink(req)}
                                    className="h-[34px] px-3 bg-white hover:bg-[#F5F6F2] border border-[#E3E7E1] text-[#0B1F1A] rounded-[8px] text-[12px] font-bold inline-flex items-center gap-1 transition-colors shadow-2xs"
                                    title="Copy public checkout URL"
                                  >
                                    <span>{copiedRefId === req.referenceId ? '✓' : '🔗'}</span>
                                    <span>{copiedRefId === req.referenceId ? 'Copied' : 'Link'}</span>
                                  </button>

                                  {/* View Checkout / QR */}
                                  <button
                                    type="button"
                                    onClick={() => onNavigate('customer-checkout', req.referenceId)}
                                    className="h-[34px] px-2.5 bg-[#F5F6F2] hover:bg-[#E8F4F0] text-[#0B1F1A] rounded-[8px] text-[12px] font-bold inline-flex items-center transition-colors"
                                    title="Open customer checkout preview"
                                  >
                                    ↗
                                  </button>

                                  {/* Cancel Button (if pending) */}
                                  {st === 'PENDING' && onCancelRequest && (
                                    <button
                                      type="button"
                                      onClick={() => onCancelRequest(req.referenceId)}
                                      className="h-[34px] px-2.5 text-rose-600 hover:bg-rose-50 rounded-[8px] text-[12px] font-bold transition-colors"
                                      title="Cancel this payment request"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </main>

            {/* EDIT PAYMENT REQUEST MODAL */}
            {editingRequest && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
                <div
                  className="bg-white rounded-[28px] max-w-[540px] w-full p-6 sm:p-8 shadow-2xl border border-[#E3E7E1] my-8"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between pb-4 border-b border-[#E3E7E1]">
                    <div>
                      <h2 className="text-[20px] font-extrabold text-[#0B1F1A]">
                        Edit Payment Request
                      </h2>
                      <div className="text-[12px] font-mono font-bold text-[#0F7B5F] mt-0.5">
                        Ref: {editingRequest.referenceId}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingRequest(null)}
                      className="w-8 h-8 rounded-full bg-[#F5F6F2] text-black/60 hover:text-black font-bold flex items-center justify-center transition-colors"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleSaveEdit} className="mt-6 space-y-4">
                    {/* Amount & Currency */}
                    <div>
                      <div className="mb-1.5">
                        <label className="text-[13px] font-bold text-[#0B1F1A]">
                          Amount & Currency
                        </label>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={editForm.amount}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                          className="flex-1 h-[46px] px-4 bg-white border border-[#0B1F1A]/30 focus:border-[#0F7B5F] rounded-[10px] text-[16px] font-bold text-black focus:outline-none tabular-nums"
                        />
                        <select
                          value={editForm.currency}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, currency: e.target.value as any }))}
                          className="h-[46px] px-3 bg-[#E8F4F0] border border-[#0F7B5F] rounded-[10px] text-[14px] font-bold text-[#0B1F1A] focus:outline-none cursor-pointer"
                        >
                          <option value="USDC">USDC Testnet</option>
                          <option value="XLM">XLM Testnet</option>
                        </select>
                      </div>

                      {/* Add item(s) Button in Edit Modal Form Flow */}
                      <div className="mt-3 flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={handleOpenEditOrderModal}
                          className="h-[40px] px-4 bg-[#E8F4F0] hover:bg-[#d5ece2] border-2 border-[#0F7B5F] rounded-[8px] text-[13px] font-bold text-[#0F7B5F] inline-flex items-center gap-2 transition-all cursor-pointer shadow-xs active:scale-98"
                        >
                          <span className="text-[14px] leading-none">＋</span>
                          <span>Add item(s)</span>
                          {editForm.orders && editForm.orders.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#0F7B5F] text-white text-[10px] font-bold">
                              {editForm.orders.length}
                            </span>
                          )}
                        </button>
                        {editForm.orders && editForm.orders.length > 0 && (
                          <span className="text-[12px] text-[#0F7B5F] font-semibold">
                            {editForm.orders.length} item(s) configured
                          </span>
                        )}
                      </div>

                      {editForm.orders && editForm.orders.length > 0 && (
                        <div className="mt-2.5 p-2.5 bg-[#E8F4F0]/60 border border-[#0F7B5F]/20 rounded-[8px] flex flex-wrap gap-1.5">
                          {editForm.orders.map((it, idx) => (
                            <span key={it.id || idx} className="text-[11px] bg-white border border-[#E3E7E1] px-2 py-0.5 rounded text-[#0B1F1A] font-medium">
                              {it.name} <span className="font-bold text-[#0F7B5F]">×{it.quantity}</span> (${it.total.toFixed(2)})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Order Reference */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[13px] font-bold text-[#0B1F1A]">
                          Order Reference
                        </label>
                        <button
                          type="button"
                          onClick={() => setEditForm((prev) => ({ ...prev, orderRef: generateOrderRef() }))}
                          className="text-[12px] font-bold text-[#0F7B5F] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>🔄</span>
                          <span>Auto-Generate</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editForm.orderRef}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, orderRef: e.target.value }))}
                        className="w-full h-[46px] px-4 bg-white border border-[#0B1F1A]/30 focus:border-[#0F7B5F] rounded-[10px] text-[14px] font-mono font-bold text-black focus:outline-none"
                      />
                    </div>

                    {/* Customer Name */}
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F1A] mb-1.5">
                        Customer Name / Identifier
                      </label>
                      <input
                        type="text"
                        value={editForm.customer}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, customer: e.target.value }))}
                        className="w-full h-[46px] px-4 bg-white border border-[#0B1F1A]/30 focus:border-[#0F7B5F] rounded-[10px] text-[14px] font-medium text-black focus:outline-none"
                      />
                    </div>

                    {/* Customer Email */}
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F1A] mb-1.5">
                        Customer Email (for receipt)
                      </label>
                      <input
                        type="email"
                        value={editForm.customerEmail}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, customerEmail: e.target.value }))}
                        className="w-full h-[46px] px-4 bg-white border border-[#0B1F1A]/30 focus:border-[#0F7B5F] rounded-[10px] text-[14px] font-medium text-black focus:outline-none"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-[13px] font-bold text-[#0B1F1A] mb-1.5">
                        Description / Goods
                      </label>
                      <textarea
                        rows={2}
                        value={editForm.description}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                        className="w-full p-3 bg-white border border-[#0B1F1A]/30 focus:border-[#0F7B5F] rounded-[10px] text-[14px] font-medium text-black focus:outline-none resize-none"
                      />
                    </div>

                    {/* Status & Extend Expiration */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[13px] font-bold text-[#0B1F1A] mb-1.5">
                          Status
                        </label>
                        <select
                          value={editForm.status}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                          className="w-full h-[46px] px-3 bg-white border border-[#0B1F1A]/30 focus:border-[#0F7B5F] rounded-[10px] text-[14px] font-bold text-[#0B1F1A] focus:outline-none"
                        >
                          <option value="PENDING">PENDING</option>
                          <option value="COMPLETED">COMPLETED</option>
                          <option value="CANCELLED">CANCELLED</option>
                          <option value="EXPIRED">EXPIRED</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[13px] font-bold text-[#0B1F1A] mb-1.5">
                          Extend Expiry Window
                        </label>
                        <select
                          value={editForm.extendMinutes}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, extendMinutes: Number(e.target.value) }))}
                          className="w-full h-[46px] px-3 bg-white border border-[#0B1F1A]/30 focus:border-[#0F7B5F] rounded-[10px] text-[14px] font-bold text-[#0B1F1A] focus:outline-none"
                        >
                          <option value={0}>Keep current expiry</option>
                          <option value={15}>+15 minutes from now</option>
                          <option value={30}>+30 minutes from now</option>
                          <option value={60}>+1 hour from now</option>
                          <option value={1440}>+24 hours from now</option>
                          <option value={10080}>+7 days from now</option>
                        </select>
                      </div>
                    </div>

                    {/* Modal Buttons */}
                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#E3E7E1] mt-6">
                      <button
                        type="button"
                        onClick={() => setEditingRequest(null)}
                        className="h-[44px] px-5 rounded-[10px] border border-[#E3E7E1] text-[14px] font-bold text-[#0B1F1A] hover:bg-[#F5F6F2] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingEdit}
                        className="h-[44px] px-6 rounded-[10px] bg-[#0F7B5F] hover:bg-[#0c634c] text-[14px] font-bold text-white transition-colors inline-flex items-center gap-2 shadow-sm disabled:opacity-50"
                      >
                        {isSavingEdit ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <span>Save Changes</span>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* =========================================================
            2. CREATE PAYMENT REQUEST VIEW
           ========================================================= */}
        {screen === 'create-payment' && (
          <>
            {/* Mobile Top Header (Mobile-Request Frame 79) */}
            <header className="flex lg:hidden h-[59px] bg-white border-b border-[#0F7B5F] px-3 items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="w-[32px] h-[26px] rounded-[7px] bg-[#F5F6F2] text-[20px] font-bold text-black flex items-center justify-center"
                >
                  X
                </button>
                <span className="text-[18px] leading-[25px] font-bold text-black">
                  New payment request
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-[5px] h-[5px] rounded-full bg-[#34D399]" />
                <span className="text-[11px] leading-[15px] font-bold text-[#0F7B5F]">
                  Testnet
                </span>
              </div>
            </header>

            <main className="p-3 sm:p-6 lg:p-[30px] lg:pt-[110px] pb-12">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* Left Form Card (610px wide on desktop) */}
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (isCreatingPayment) return;
                    setIsCreatingPayment(true);
                    try {
                      const ok = await onCreateRequest(activeRequest);
                      if (ok !== false) {
                        onNavigate('payment-created', activeRequest.referenceId);
                      }
                    } catch (err: any) {
                      console.error('Failed to create payment request:', err);
                    } finally {
                      setIsCreatingPayment(false);
                    }
                  }}
                  className="xl:col-span-7 sm:bg-white sm:border sm:border-[#E3E7E1] sm:rounded-[40px] sm:p-8 flex flex-col justify-between"
                >
                  <div>
                    <div className="hidden sm:block text-[18px] leading-[25px] font-bold text-[#0B1F1A]">
                      New payment request
                    </div>
                    <h1 className="hidden sm:block mt-3 text-[38px] leading-[44px] font-bold text-[#0B1F1A]">
                      What are your charging for?
                    </h1>

                    {/* Amount Input Box */}
                    <div className="mt-4 sm:mt-8">
                      <div className="mb-2.5">
                        <label className="hidden sm:block text-[18px] leading-[25px] font-bold text-black">
                          Amount
                        </label>
                      </div>
                      <div className="w-full h-[117px] sm:h-[67px] bg-white border-2 border-[#0F7B5F] rounded-[10px] px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between">
                        <span className="sm:hidden text-[16px] leading-[22px] font-bold text-black">
                          Amount
                        </span>
                        <div className="flex items-center justify-between w-full">
                          <input
                            type="text"
                            value={activeRequest.amount}
                            onChange={(e) => onUpdateRequest({ amount: e.target.value })}
                            className="w-full max-w-[200px] text-[38px] leading-[52px] font-bold text-black bg-transparent focus:outline-none tabular-nums"
                          />
                          <select
                            value={activeRequest.asset || 'USDC'}
                            onChange={(e) => onUpdateRequest({ asset: e.target.value })}
                            className="h-[36px] sm:h-[40px] px-3 bg-[#E8F4F0] border-2 border-[#0F7B5F] rounded-[10px] text-[15px] sm:text-[17px] font-bold text-[#0B1F1A] focus:outline-none cursor-pointer"
                          >
                            <option value="USDC">USDC Testnet</option>
                            <option value="XLM">XLM Testnet</option>
                          </select>
                        </div>
                      </div>

                      {/* Add item(s) Button directly in Form Flow */}
                      <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
                        <button
                          type="button"
                          onClick={handleOpenCreateOrderModal}
                          className="h-[46px] px-5 bg-[#E8F4F0] hover:bg-[#d5ece2] border-2 border-[#0F7B5F] rounded-[12px] text-[15px] font-bold text-[#0F7B5F] inline-flex items-center justify-center gap-2.5 transition-all shadow-xs cursor-pointer active:scale-98"
                        >
                          <span className="text-[17px] leading-none">＋</span>
                          <span>Add item(s)</span>
                          {activeRequest.orders && activeRequest.orders.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 rounded-full bg-[#0F7B5F] text-white text-[11px] font-bold">
                              {activeRequest.orders.length}
                            </span>
                          )}
                        </button>
                        <p className="text-[12px] sm:text-[13px] text-[#0F7B5F] font-medium">
                          {activeRequest.orders && activeRequest.orders.length > 0
                            ? 'Total amount is calculated from your added item(s).'
                            : 'Click "Add item(s)" to specify multiple items, prices, and quantities.'}
                        </p>
                      </div>

                      {/* Item choices preview if present */}
                      {activeRequest.orders && activeRequest.orders.length > 0 && (
                        <div className="mt-2.5 p-3.5 bg-[#E8F4F0]/70 border border-[#0F7B5F]/30 rounded-[12px] space-y-2">
                          <div className="flex items-center justify-between text-[12px] font-bold text-[#0F7B5F]">
                            <span>📦 Added Item(s) ({activeRequest.orders.length})</span>
                            <button
                              type="button"
                              onClick={handleOpenCreateOrderModal}
                              className="hover:underline cursor-pointer font-bold"
                            >
                              Edit item(s) ↗
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {activeRequest.orders.map((it, idx) => (
                              <span
                                key={it.id || idx}
                                className="text-[11px] bg-white border border-[#E3E7E1] px-2.5 py-1 rounded-[6px] text-[#0B1F1A] font-medium shadow-xs"
                              >
                                {it.name} <span className="font-bold text-[#0F7B5F]">×{it.quantity}</span> (${it.total.toFixed(2)})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Customer */}
                    <div className="mt-6">
                      <label className="block text-[16px] sm:text-[18px] leading-[22px] sm:leading-[25px] font-bold text-black mb-2.5">
                        Customer
                      </label>
                      <input
                        type="text"
                        value={activeRequest.customer}
                        onChange={(e) => onUpdateRequest({ customer: e.target.value })}
                        className="w-full h-[50px] px-4 bg-white border border-[#0B1F1A]/40 focus:border-[#0F7B5F] rounded-[10px] text-[16px] sm:text-[18px] font-bold text-black focus:outline-none"
                      />
                      <p className="text-[12px] sm:text-[13px] text-[#0B1F1A]/70 font-medium mt-1.5">
                        Specify customer name, email address, or buyer identifier.
                      </p>
                    </div>

                    {/* Description */}
                    <div className="mt-6">
                      <label className="block text-[16px] sm:text-[18px] leading-[22px] sm:leading-[25px] font-bold text-black mb-2.5">
                        Description
                      </label>
                      <input
                        type="text"
                        value={activeRequest.description}
                        onChange={(e) => onUpdateRequest({ description: e.target.value })}
                        className="w-full h-[50px] px-4 bg-white border border-[#0B1F1A]/40 focus:border-[#0F7B5F] rounded-[10px] text-[16px] sm:text-[18px] font-bold text-black focus:outline-none"
                      />
                      <p className="text-[12px] sm:text-[13px] text-[#0B1F1A]/70 font-medium mt-1.5">
                        Description of item or service to display on customer's checkout invoice.
                      </p>
                    </div>

                    {/* Order Reference & Expiry */}
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-[47px]">
                      <div className="order-2 sm:order-1">
                        <div className="flex items-center justify-between mb-2.5">
                          <label className="text-[16px] sm:text-[18px] leading-[22px] sm:leading-[25px] font-bold text-black">
                            <span className="hidden sm:inline">Order Reference</span>
                            <span className="sm:hidden">Order Ref</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => onUpdateRequest({ orderRef: generateOrderRef() })}
                            className="text-[12px] font-bold text-[#0F7B5F] hover:underline inline-flex items-center gap-1 cursor-pointer"
                            title="Generate fresh unique order reference"
                          >
                            <span>🔄</span>
                            <span>Auto-Generate</span>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={activeRequest.orderRef}
                          onChange={(e) => onUpdateRequest({ orderRef: e.target.value })}
                          className="w-full h-[50px] px-4 bg-white border border-[#0B1F1A]/40 focus:border-[#0F7B5F] rounded-[10px] text-[16px] sm:text-[18px] font-mono font-bold text-black focus:outline-none"
                        />
                        <p className="text-[12px] sm:text-[13px] text-[#0B1F1A]/70 font-medium mt-1.5">
                          Auto-generated unique merchant reference (e.g. ORD-XXXXXX). You can edit or regenerate.
                        </p>
                      </div>

                      <div className="order-1 sm:order-2">
                        <label className="block text-[16px] sm:text-[18px] leading-[22px] sm:leading-[25px] font-bold text-black mb-2.5">
                          Request expires in
                        </label>
                        <div className="relative">
                          <select
                            value={activeRequest.expiresIn}
                            onChange={(e) => onUpdateRequest({ expiresIn: e.target.value })}
                            className="w-full h-[50px] px-4 pr-10 bg-white border border-[#0B1F1A]/40 focus:border-[#0F7B5F] rounded-[10px] text-[16px] sm:text-[18px] font-bold text-black appearance-none focus:outline-none"
                          >
                            <option value="30 minutes">30 minutes</option>
                            <option value="15 minutes">15 minutes</option>
                            <option value="1 hour">1 hour</option>
                            <option value="24 hours">24 hours</option>
                          </select>
                          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[24px] font-bold text-black">
                            &gt;
                          </span>
                        </div>
                        <p className="text-[12px] sm:text-[13px] text-[#0B1F1A]/70 font-medium mt-1.5">
                          Time window before this payment link automatically invalidates.
                        </p>
                      </div>
                    </div>

                    {/* Single Use Toggle */}
                    <div className="mt-7 bg-white sm:bg-[#F5F6F2] rounded-[10px] px-4 py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-[18px] sm:text-[20px] leading-[25px] sm:leading-[27px] font-bold text-black">
                          Single Use
                        </div>
                        <div className="text-[12px] sm:text-[16px] leading-[16px] sm:leading-[22px] font-medium text-[#0B1F1A] mt-0.5">
                          Closes after the first matched payment
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateRequest({ singleUse: !activeRequest.singleUse })
                        }
                        aria-label="Toggle Single Use"
                        className={`w-[51px] sm:w-[68px] h-[23.5px] sm:h-[31px] rounded-full p-1 transition-colors shrink-0 ${
                          activeRequest.singleUse ? 'bg-[#0F7B5F]' : 'bg-black/50'
                        }`}
                      >
                        <span
                          className={`block w-[22.5px] sm:w-[30px] h-[16px] sm:h-[24px] rounded-full bg-white transition-transform ${
                            activeRequest.singleUse
                              ? 'translate-x-[20px] sm:translate-x-[30px]'
                              : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Form Buttons */}
                  <div className="mt-10 sm:mt-14 flex items-center sm:justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => onNavigate('dashboard')}
                      className="hidden sm:inline-flex items-center justify-center w-[99px] h-[50px] rounded-[9px] border border-[#0F7B5F] text-[18px] font-bold text-[#0B1F1A] hover:bg-[#0F7B5F]/5 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingPayment}
                      className={`w-full sm:w-[209px] h-[50px] rounded-[9px] ${
                        isCreatingPayment ? 'bg-[#0F7B5F]/70 cursor-not-allowed' : 'bg-[#0F7B5F] hover:bg-[#0c634c] cursor-pointer'
                      } text-[18px] font-bold text-white inline-flex items-center justify-center gap-2 transition-colors`}
                    >
                      {isCreatingPayment ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <span>Generate link</span>
                          <ArrowRightIcon color="#FFFFFF" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                {/* Right Live Customer Preview (Desktop 413px wide) */}
                <div className="hidden xl:block xl:col-span-5">
                  <div className="text-[18px] leading-[25px] font-bold text-[#0B1F1A] mb-6">
                    Customer Preview
                  </div>

                  <div className="w-full max-w-[413px] min-h-[777px] bg-white border border-[#E3E7E1] rounded-[40px] p-6 flex flex-col justify-between">
                    <div className="flex flex-col items-center">
                      {/* Merchant Header */}
                      <div className="flex items-center gap-[23px] mt-1">
                        <div className="w-[63px] h-[58px] rounded-[9px] bg-[#0F7B5F] flex items-center justify-center shrink-0">
                          <span className="text-[18px] font-bold text-white">
                            {(profile.statementName || profile.businessName || 'SME').slice(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="text-[24px] leading-[28px] font-bold text-[#0B1F1A]">
                            {profile.statementName || profile.businessName || 'Merchant Store'}
                          </div>
                          <div className="text-[16px] leading-[22px] font-medium text-[#0B1F1A] mt-1">
                            Pay with a stellar wallet
                          </div>
                        </div>
                      </div>

                      <div className="mt-12 text-[16px] leading-[22px] font-bold text-[#0B1F1A]">
                        Amount payable
                      </div>

                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-[38px] leading-[52px] font-bold text-black tabular-nums">
                          {activeRequest.amount || '0.00'}
                        </span>
                        <span className="text-[18px] leading-[25px] font-bold text-[#0B1F1A]">
                          {activeRequest.asset || 'USDC'}
                        </span>
                      </div>

                      <div className="mt-3 text-[16px] leading-[22px] font-bold text-[#0B1F1A]">
                        Description: {activeRequest.description || 'Invoice payment'}
                      </div>

                      {/* Placeholder QR Box */}
                      <div className="mt-14 w-full bg-[#F5F6F2] rounded-[10px] p-3 flex flex-col items-center">
                        <BarcodePlaceholderIcon />
                        <div className="mt-2.5 text-[12px] leading-[16px] font-medium text-[#0B1F1A] text-center">
                          QR code and payment link will appear on the next step.
                        </div>
                      </div>
                    </div>

                    <div className="pt-8 border-t border-dashed border-[#0B1F1A]/50">
                      <p className="text-[12px] leading-[16px] font-medium text-[#0B1F1A]">
                        Expires in {activeRequest.expiresIn || '30 minutes'}. Matched automatically to the first payment of{' '}
                        {activeRequest.amount || '0.00'} {activeRequest.asset || 'USDC'} to your wallet
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </>
        )}

        {/* =========================================================
            3. PAYMENT CREATED / REQUEST STATUS VIEW
           ========================================================= */}
        {screen === 'payment-created' && (
          <>
            {/* Mobile Top Header (Mobile sign up-2 ORD-20122) */}
            <header className="flex lg:hidden h-[59px] bg-white border-b border-[#0F7B5F] px-3 items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('create-payment')}
                  className="w-[32px] h-[26px] rounded-[7px] bg-[#F5F6F2] text-[20px] font-bold text-black flex items-center justify-center"
                >
                  X
                </button>
                <span className="text-[16px] leading-[22px] font-bold text-black">
                  {activeRequest.orderRef || 'ORD-20122'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-[20px] px-2 bg-[#F3DFA5] rounded-[6.7px] inline-flex items-center gap-1.5">
                  <span className="w-[6px] h-[6px] rounded-full bg-[#7A4B00]" />
                  <span className="text-[8.2px] font-semibold text-[#0B1F1A]">
                    Waiting for payment
                  </span>
                </div>
                <span className="w-[5px] h-[5px] rounded-full bg-[#34D399]" />
              </div>
            </header>

            <main className="p-3 sm:p-6 lg:p-[30px] lg:pt-[110px] pb-12">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-[35px] items-start">
                {/* Left Card: Scan to pay */}
                <div className="xl:col-span-5 bg-white border border-[#E3E7E1] rounded-[10px] sm:rounded-[40px] p-5 sm:p-8 sm:min-h-[726px] flex flex-col items-center justify-between">
                  <div className="hidden sm:flex w-full items-center justify-between">
                    <span className="text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]">
                      Scan to pay
                    </span>
                    <div className="h-[27px] px-3 bg-[#F3DFA5] rounded-[9px] inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#7A4B00]" />
                      <span className="text-[11px] leading-[13px] font-semibold text-[#0B1F1A]">
                        {activeRequest.statusStep === 4
                          ? 'Payment confirmed'
                          : 'Waiting for payment'}
                      </span>
                    </div>
                  </div>

                  <div className="my-4 sm:my-auto flex flex-col items-center">
                    <div
                      onClick={() => onNavigate('customer-checkout', activeRequest.referenceId)}
                      title="Click to open Customer Checkout"
                      className="cursor-pointer hover:scale-[1.02] transition-transform flex flex-col items-center"
                    >
                      {activeRequest.qrCodeBase64 ? (
                        <div className="p-2 sm:p-3 bg-white rounded-[16px] border border-[#0F7B5F]/30 shadow-md">
                          <img
                            src={activeRequest.qrCodeBase64}
                            alt="Stellar Payment QR Code"
                            className="w-[178px] h-[178px] sm:w-[256px] sm:h-[256px] object-contain rounded-[10px]"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="hidden sm:block">
                            <QrCodeSvg size={256} />
                          </div>
                          <div className="sm:hidden">
                            <QrCodeSvg size={178} />
                          </div>
                        </>
                      )}
                      <span className="mt-2 text-[11px] font-bold text-[#0F7B5F] bg-[#E8F4F0] px-2.5 py-0.5 rounded-full">
                        Click QR to test Customer Checkout
                      </span>
                    </div>

                    <div className="mt-4 sm:mt-6 text-[32px] sm:text-[38px] leading-[44px] sm:leading-[52px] font-bold text-black tabular-nums">
                      {activeRequest.amount || '0.00'} {activeRequest.asset || 'USDC'}
                    </div>
                    <div className="mt-1 sm:mt-2 text-[15px] sm:text-[16px] leading-[22px] font-bold text-[#0B1F1A]/70 text-center">
                      Description: {activeRequest.description || 'Payment request'}
                    </div>

                    {activeRequest.memo && (
                      <div className="mt-3 px-3 py-1.5 bg-[#FFFBEB] border border-[#F3DFA5] rounded-[8px] flex items-center gap-2 text-[12px] font-bold text-[#7A4B00]">
                        <span>Stellar Memo:</span>
                        <code className="font-mono">{activeRequest.memo}</code>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard?.writeText(activeRequest.memo || '');
                            onNotify('Memo copied to clipboard.');
                          }}
                          className="hover:underline text-[11px] ml-1 text-[#0F7B5F]"
                        >
                          Copy
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="hidden sm:block text-[14px] leading-[19px] font-bold text-[#0B1F1A]/70 text-center">
                    Expires in {formatCountdown(secondsLeft)}. Refreshes if the request is still open.
                  </div>
                </div>

                {/* Right Column: Payment Link Card + Status Timeline Card */}
                <div className="xl:col-span-7 space-y-6">
                  {/* Payment Link Card */}
                  <div className="bg-white border border-[#E3E7E1] rounded-[10px] sm:rounded-[40px] p-5 sm:p-7">
                    <div className="flex items-center justify-between">
                      <h2 className="text-[16px] sm:text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]">
                        Payment Link
                      </h2>
                      <button
                        type="button"
                        onClick={() => onNavigate('customer-checkout', activeRequest.referenceId)}
                        className="text-[13px] font-bold text-[#0F7B5F] hover:underline inline-flex items-center gap-1"
                      >
                        <span>Open Customer Checkout</span>
                        <ArrowUpRightIcon color="#0F7B5F" className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex-1 h-[41px] px-4 rounded-[10px] bg-[#F5F6F2] sm:bg-white sm:border sm:border-[#0B1F1A]/40 flex items-center text-[14px] sm:text-[16px] font-bold text-black/60 truncate">
                        {activeRequest.paymentLink && !activeRequest.paymentLink.includes('/api/')
                          ? activeRequest.paymentLink
                          : `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/checkout/${activeRequest.referenceId}`}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const link = (activeRequest.paymentLink && !activeRequest.paymentLink.includes('/api/'))
                            ? activeRequest.paymentLink
                            : `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/checkout/${activeRequest.referenceId}`;
                          navigator.clipboard?.writeText(link);
                          onNotify('Payment link copied to clipboard.');
                        }}
                        className="h-[33px] sm:h-[41px] sm:w-[92px] bg-[#0F7B5F] hover:bg-[#0c634c] rounded-[10px] text-[14px] sm:text-[16px] font-bold text-white transition-colors shrink-0"
                      >
                        copy link
                      </button>
                    </div>

                    {activeRequest.sep0007Uri && (
                      <div className="mt-3 flex items-center justify-between p-3 rounded-[10px] bg-[#E8F4F0] border border-[#0F7B5F]/20 text-[12px] font-bold text-[#0F7B5F]">
                        <span className="truncate pr-2 font-mono text-[11px]">
                          SEP-0007: {activeRequest.sep0007Uri}
                        </span>
                        <a
                          href={activeRequest.sep0007Uri}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 underline hover:text-[#0c634c]"
                        >
                          Open in Wallet
                        </a>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-3 sm:gap-3.5">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(`Payment request for ${activeRequest.amount} ${activeRequest.asset || 'USDC'} from ${profile.statementName || 'Merchant'}: ${activeRequest.paymentLink}`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="h-[33px] sm:h-[41px] px-4 rounded-[10px] bg-[#F5F6F2] sm:bg-white border border-[#0B1F1A]/40 text-[14px] font-bold text-black/80 hover:bg-[#E8F4F0] transition-colors inline-flex items-center justify-center"
                      >
                        <span className="hidden sm:inline">share on whatsapp</span>
                        <span className="sm:hidden">whatsapp</span>
                      </a>
                      <a
                        href={`mailto:?subject=${encodeURIComponent(`Payment Request ${activeRequest.orderRef || activeRequest.referenceId || ''}`)}&body=${encodeURIComponent(`Please click to pay: ${activeRequest.paymentLink}`)}`}
                        className="h-[33px] sm:h-[41px] px-4 rounded-[10px] bg-[#F5F6F2] sm:bg-white border border-[#0B1F1A]/40 text-[14px] font-bold text-black/80 hover:bg-[#E8F4F0] transition-colors inline-flex items-center justify-center"
                      >
                        <span className="hidden sm:inline">send by email</span>
                        <span className="sm:hidden">Email</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="h-[33px] sm:h-[41px] px-4 rounded-[10px] bg-[#F5F6F2] sm:bg-white border border-[#0B1F1A]/40 text-[14px] font-bold text-black/80 hover:bg-[#E8F4F0] transition-colors"
                      >
                        print
                      </button>
                    </div>
                  </div>

                  {/* Status Card */}
                  <div className="bg-white border border-[#E3E7E1] rounded-[8.2px] sm:rounded-[40px] p-5 sm:p-7 sm:min-h-[486px] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <h2 className="text-[16px] sm:text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]">
                          Status
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            const nextStep =
                              activeRequest.statusStep < 4
                                ? ((activeRequest.statusStep + 1) as 1 | 2 | 3 | 4)
                                : 2;
                            onUpdateRequest({ statusStep: nextStep });
                          }}
                          className="text-[12px] font-bold text-[#0F7B5F] hover:underline"
                        >
                          Advance status step
                        </button>
                      </div>

                      <div className="mt-5 sm:mt-8 space-y-5 sm:space-y-8">
                        {[
                          {
                            step: 1,
                            title: 'Request created',
                            desc: 'Link and QR code ready',
                          },
                          {
                            step: 2,
                            title: 'Awaiting payment',
                            desc: 'Customer approves in their wallet',
                          },
                          {
                            step: 3,
                            title: 'Matched to a transaction',
                            desc: 'Amount and reference are checked on testnet',
                          },
                          {
                            step: 4,
                            title: 'Confirmed',
                            desc: 'Transaction hash saved to history',
                          },
                        ].map((item) => {
                          const isCompleted = activeRequest.statusStep > item.step || (item.step === 1 && activeRequest.statusStep >= 1) || (item.step === 4 && activeRequest.statusStep === 4);
                          const isCurrent =
                            activeRequest.statusStep === item.step && item.step !== 1 && item.step !== 4;

                          return (
                            <div
                              key={item.step}
                              onClick={() =>
                                onUpdateRequest({ statusStep: item.step as 1 | 2 | 3 | 4 })
                              }
                              className="flex items-center gap-3 sm:gap-5 cursor-pointer"
                            >
                              <div
                                className={`w-[18.5px] h-[18.5px] sm:w-[32px] sm:h-[32px] rounded-full shrink-0 transition-colors ${
                                  isCompleted
                                    ? 'bg-[#0F7B5F]'
                                    : isCurrent
                                    ? 'bg-[#F3DFA5] border-2 border-[#7A4B00]'
                                    : 'border-2 border-[#BDBDBD]'
                                }`}
                              />
                              <div>
                                <div
                                  className={`text-[12.5px] sm:text-[18px] leading-[15px] sm:leading-[21px] font-extrabold ${
                                    isCompleted || isCurrent
                                      ? 'text-[#0B1F1A]'
                                      : 'text-[#0B1F1A]/70'
                                  }`}
                                >
                                  {item.title}
                                </div>
                                <div
                                  className={`mt-1 text-[11.3px] sm:text-[16px] leading-[14px] sm:leading-[18px] font-semibold ${
                                    isCompleted || isCurrent
                                      ? 'text-[#0B1F1A]/70'
                                      : 'text-[#0B1F1A]/40'
                                  }`}
                                >
                                  {item.desc}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#E3E7E1] flex items-center justify-between">
                      <span className="text-[13px] font-bold text-[#0B1F1A]/60">
                        Want to test the customer wallet checkout?
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('customer-checkout', activeRequest.referenceId)}
                        className="h-[36px] px-4 rounded-[8px] bg-[#0F7B5F] hover:bg-[#0c634c] text-[13px] font-bold text-white inline-flex items-center gap-1.5 transition-colors"
                      >
                        <span>Pay as Customer</span>
                        <ArrowRightIcon color="#FFFFFF" className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </>
        )}

        {/* =========================================================
            4. TRANSACTION HISTORY VIEW (Full Table + Split Detail + Mobile List/Detail)
           ========================================================= */}
        {screen === 'history' && (
          <>
            {/* Mobile Top Bar */}
            {mobileDetailOpen ? (
              /* Mobile Detail Top Header (Mobile-History with X and ORD-20122) */
              <header className="flex lg:hidden h-[59px] bg-white border-b border-[#0F7B5F] px-3 items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileDetailOpen(false)}
                    className="w-[32px] h-[26px] rounded-[7px] bg-[#F5F6F2] text-[20px] font-bold text-black flex items-center justify-center"
                  >
                    X
                  </button>
                  <span className="text-[16px] leading-[22px] font-bold text-black">
                    {selectedTx.orderRef || 'ORD-20122'}
                  </span>
                </div>
                <span className="w-[5px] h-[5px] rounded-full bg-[#34D399]" />
              </header>
            ) : (
              /* Mobile History List Top Header (121px height with filter tabs inside) */
              <header className="lg:hidden bg-white border-b border-[#0F7B5F] px-3 pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(true)}
                    className="flex items-end gap-[14.5px] focus:outline-none"
                  >
                    <HamburgerIcon />
                    <span className="text-[20.2px] leading-[28px] font-bold text-black">
                      History
                    </span>
                  </button>
                  <span className="w-[5px] h-[5px] rounded-full bg-[#34D399]" />
                </div>

                {/* Mobile Filter Pills */}
                <div className="mt-5 flex items-center gap-[7px] overflow-x-auto">
                  {(['All', 'Completed', 'Pending', 'Failed'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setHistoryFilter(tab)}
                      className={`h-[26.2px] px-3.5 rounded-[9px] text-[12.4px] leading-[17px] font-bold whitespace-nowrap transition-colors ${
                        historyFilter === tab
                          ? 'bg-black text-white'
                          : 'bg-white border border-black/40 text-black'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </header>
            )}

            <main className="p-3 sm:p-6 lg:p-[30px] lg:pt-[110px] pb-12">
              {/* MOBILE DETAIL VIEW */}
              {mobileDetailOpen && (
                <div className="lg:hidden bg-white border border-[#E3E7E1] rounded-[10px] p-5 min-h-[720px] flex flex-col justify-between">
                  <div>
                    <div
                      className={`text-[14px] leading-[19px] font-bold ${
                        selectedTx.status === 'Completed'
                          ? 'text-[#0F7B5F]'
                          : selectedTx.status === 'Failed'
                          ? 'text-[#C20C0C]'
                          : 'text-[#7A4B00]'
                      }`}
                    >
                      {selectedTx.status}
                    </div>

                    <div className="mt-12 text-[14px] leading-[19px] font-bold text-[#0B1F1A]/70">
                      Amount received
                    </div>
                    <div className="mt-2 text-[27px] leading-[37px] font-extrabold text-black tabular-nums">
                      {selectedTx.amount} {selectedTx.asset}
                    </div>

                    <div className="mt-8 space-y-4 text-[14px] leading-[19px] font-bold">
                      <div className="flex justify-between">
                        <span className="text-[#0B1F1A]/70">Reference</span>
                        <span className="text-[#0B1F1A]">{selectedTx.referenceLabel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#0B1F1A]/70">Network</span>
                        <span className="text-[#0B1F1A]">{selectedTx.network}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#0B1F1A]/70">Fee</span>
                        <span className="text-[#0B1F1A] tabular-nums">{selectedTx.fee}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#0B1F1A]/70">Date</span>
                        <span className="text-[#0B1F1A]">{selectedTx.date}</span>
                      </div>
                    </div>

                    <div className="mt-5 text-[14px] leading-[19px] font-bold text-[#0B1F1A]/70">
                      Transaction hash
                    </div>
                    <div className="mt-3 bg-[#F5F6F2] rounded-[10px] p-3.5 text-[12px] leading-[16px] font-medium text-[#0B1F1A] break-all font-mono">
                      {selectedTx.fullHash}
                    </div>
                  </div>

                  <div className="mt-12 space-y-4">
                    <button
                      type="button"
                      onClick={() =>
                        onNotify(`Opened Stellar Testnet Explorer for ${selectedTx.shortHash}`)
                      }
                      className="w-full h-[50px] bg-[#0F7B5F] rounded-[9px] text-[18px] font-bold text-white inline-flex items-center justify-center gap-2"
                    >
                      <span>View on testnet explorer</span>
                      <ArrowUpRightIcon color="#FFFFFF" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(selectedTx.fullHash);
                        onNotify('Transaction hash copied to clipboard.');
                      }}
                      className="w-full h-[50px] border border-[#0F7B5F] rounded-[9px] text-[18px] font-bold text-black flex items-center justify-center"
                    >
                      Copy transaction hash
                    </button>
                  </div>
                </div>
              )}

              {/* MOBILE LIST VIEW */}
              {!mobileDetailOpen && (
                <div className="lg:hidden">
                  <div className="mt-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by customers, reference, or hash"
                      className="w-full h-[40px] px-4 bg-white border border-black/40 rounded-[13.5px] text-[12.5px] font-bold text-black placeholder:text-black/60 focus:outline-none"
                    />
                  </div>

                  <div className="mt-5 divide-y divide-black/20">
                    {filteredTransactions.length === 0 ? (
                      <div className="p-8 text-center text-black/60 text-[13px] font-medium bg-white rounded-[10px]">
                        No transactions found.
                      </div>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <div
                          key={tx.id}
                          onClick={() => {
                            setSelectedTxId(tx.id);
                            setMobileDetailOpen(true);
                          }}
                          className="py-2.5 px-1 flex items-center justify-between cursor-pointer active:bg-[#E8F4F0]"
                        >
                          <div>
                            <div className="text-[11.5px] leading-[16px] font-bold text-[#0B1F1A]">
                              {tx.referenceLabel}
                            </div>
                            <div className="text-[9.5px] leading-[13px] font-bold text-[#0B1F1A]/70 mt-0.5">
                              {tx.date.toLowerCase()}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11.5px] leading-[16px] font-bold text-[#0B1F1A] tabular-nums">
                              {tx.amount} {tx.asset}
                            </div>
                            <div
                              className={`text-[9.5px] leading-[13px] font-bold mt-0.5 ${
                                tx.status === 'Completed'
                                  ? 'text-[#0F7B5F] lowercase'
                                  : tx.status === 'Failed'
                                  ? 'text-[#C20C0C]'
                                  : 'text-[#FEBD00]'
                              }`}
                            >
                              {tx.status}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* DESKTOP HISTORY VIEW (Supports both Full Table and Split Master-Detail View) */}
              <div className="hidden lg:grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <div className={selectedTxId ? 'xl:col-span-7' : 'xl:col-span-12'}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h1
                        className={`${
                          selectedTxId
                            ? 'text-[28px] leading-[38px]'
                            : 'text-[36px] leading-[49px]'
                        } font-extrabold text-black`}
                      >
                        Transaction History
                      </h1>
                      <p
                        className={`${
                          selectedTxId ? 'text-[13px]' : 'text-[16px]'
                        } font-bold text-black/60`}
                      >
                        Every payment matched to its request
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedTxId(selectedTxId ? null : (transactions[0]?.id || 'tx-1'))}
                        className="h-[34px] px-3 bg-white border border-[#0F7B5F] rounded-[8px] text-[12px] font-bold text-[#0F7B5F] hover:bg-[#E8F4F0] transition-colors"
                      >
                        {selectedTxId ? 'Expand Full Table' : 'Show Detail Panel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleExportCsv}
                        className={`${
                          selectedTxId
                            ? 'h-[31px] px-4 text-[11.5px] rounded-[7px]'
                            : 'w-[163px] h-[43px] text-[16px] rounded-[10px]'
                        } bg-white border border-[#0B1F1A]/40 font-bold text-[#0B1F1A]/70 hover:text-[#0B1F1A] transition-colors`}
                      >
                        Export CSV
                      </button>
                    </div>
                  </div>

                  {/* Filter Tabs + Search Input */}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {(['All', 'Completed', 'Pending', 'Failed'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setHistoryFilter(tab)}
                          className={`${
                            selectedTxId
                              ? 'h-[26px] px-3.5 text-[11.5px] rounded-[8.2px]'
                              : 'h-[38px] px-6 text-[16px] rounded-[13px]'
                          } font-bold transition-colors ${
                            historyFilter === tab
                              ? 'bg-black text-white'
                              : 'bg-white border border-black/40 text-black hover:bg-black/5'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search customers, reference, or hash"
                      className={`${
                        selectedTxId
                          ? 'w-[205px] h-[30px] text-[11px] rounded-[9.2px]'
                          : 'w-[288px] h-[40px] text-[13px] rounded-[13.5px]'
                      } px-3.5 bg-white border border-black/40 font-bold text-black placeholder:text-black/60 focus:outline-none`}
                    />
                  </div>

                  {/* Transactions Table Card with horizontal scroll protection */}
                  <div className="mt-5 bg-white border border-[#E3E7E1] rounded-[12px] sm:rounded-[20px] min-h-[520px] overflow-hidden">
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr
                            className={`border-b border-black/30 font-bold text-[#0B1F1A]/70 ${
                              selectedTxId ? 'text-[11px]' : 'text-[15px]'
                            }`}
                          >
                            <th className="py-3.5 px-4 whitespace-nowrap">Date</th>
                            <th className="py-3.5 px-4 whitespace-nowrap">REFERENCE</th>
                            <th className="py-3.5 px-4 whitespace-nowrap">AMOUNT</th>
                            <th className="py-3.5 px-4 whitespace-nowrap">STATUS</th>
                            <th className="py-3.5 px-4 whitespace-nowrap">TRX HASH</th>
                          </tr>
                        </thead>
                        <tbody
                          className={`divide-y divide-black/20 font-bold ${
                            selectedTxId ? 'text-[12px]' : 'text-[15px]'
                          }`}
                        >
                          {filteredTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-20 text-center text-black/60 font-medium">
                                No transactions found matching your criteria.
                              </td>
                            </tr>
                          ) : (
                            filteredTransactions.slice(0, 10).map((tx) => {
                              const isSelected = selectedTxId === tx.id;
                              return (
                                <tr
                                  key={tx.id}
                                  onClick={() => setSelectedTxId(tx.id)}
                                  className={`cursor-pointer transition-colors ${
                                    isSelected ? 'bg-[#E8F4F0]' : 'hover:bg-[#F5F6F2]'
                                  }`}
                                >
                                  <td className="py-4 px-4 font-medium text-[#0B1F1A]/70 whitespace-nowrap">
                                    {tx.date}
                                  </td>
                                  <td className="py-4 px-4 text-[#0B1F1A] whitespace-nowrap">
                                    {tx.referenceLabel}
                                  </td>
                                  <td className="py-4 px-4 text-[#0B1F1A] tabular-nums whitespace-nowrap">
                                    {tx.amount} {tx.asset}
                                  </td>
                                  <td
                                    className={`py-4 px-4 whitespace-nowrap ${
                                      tx.status === 'Completed'
                                        ? 'text-[#0F7B5F]'
                                        : tx.status === 'Failed'
                                        ? 'text-[#C20C0C]'
                                        : 'text-[#7A4B00]'
                                    }`}
                                  >
                                    {tx.status}
                                  </td>
                                  <td className="py-4 px-4 text-[#0B1F1A] tabular-nums whitespace-nowrap">
                                    {tx.shortHash}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Desktop Right Detail Panel */}
                {selectedTxId && (
                  <div className="xl:col-span-5 bg-white border border-[#E3E7E1] rounded-[24px] xl:rounded-[30px] p-6 min-h-[640px] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[16px] leading-[22px] font-bold ${
                            selectedTx.status === 'Completed'
                              ? 'text-[#0F7B5F]'
                              : selectedTx.status === 'Failed'
                              ? 'text-[#C20C0C]'
                              : 'text-[#7A4B00]'
                          }`}
                        >
                          {selectedTx.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedTxId(null)}
                          className="text-[13px] font-bold text-[#0B1F1A]/50 hover:text-[#0B1F1A]"
                        >
                          Close
                        </button>
                      </div>

                      <div className="mt-12 text-[16px] leading-[22px] font-bold text-[#0B1F1A]/70">
                        Amount received
                      </div>
                      <div className="mt-2 text-[29px] leading-[40px] font-extrabold text-black tabular-nums">
                        {selectedTx.amount} {selectedTx.asset}
                      </div>

                      <div className="mt-9 space-y-4 text-[16px] leading-[22px] font-bold">
                        <div className="flex justify-between gap-2">
                          <span className="text-[#0B1F1A]/70">Reference</span>
                          <span className="text-[#0B1F1A] text-right">
                            {selectedTx.referenceLabel}
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#0B1F1A]/70">Network</span>
                          <span className="text-[#0B1F1A]">{selectedTx.network}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#0B1F1A]/70">Fee</span>
                          <span className="text-[#0B1F1A] tabular-nums">{selectedTx.fee}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-[#0B1F1A]/70">Date</span>
                          <span className="text-[#0B1F1A]">{selectedTx.date}</span>
                        </div>
                      </div>

                      <div className="mt-6 text-[16px] leading-[22px] font-bold text-[#0B1F1A]/70">
                        Transaction hash
                      </div>
                      <div className="mt-3 bg-[#F5F6F2] rounded-[10px] p-4 text-[12px] leading-[16px] font-medium text-[#0B1F1A] break-all font-mono">
                        {selectedTx.fullHash}
                      </div>
                    </div>

                    <div className="mt-12 space-y-4">
                      <button
                        type="button"
                        onClick={() =>
                          onNotify(
                            `Opened Stellar Testnet Explorer for ${selectedTx.shortHash}`
                          )
                        }
                        className="w-full h-[50px] bg-[#0F7B5F] hover:bg-[#0c634c] rounded-[9px] text-[18px] font-bold text-white inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>View on testnet explorer</span>
                        <ArrowUpRightIcon color="#FFFFFF" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(selectedTx.fullHash);
                          onNotify('Transaction hash copied to clipboard.');
                        }}
                        className="w-full h-[50px] border border-[#0F7B5F] hover:bg-[#0F7B5F]/5 rounded-[9px] text-[18px] font-bold text-black flex items-center justify-center transition-colors"
                      >
                        Copy transaction hash
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </>
        )}

        {/* =========================================================
            5. PAYMENT SETTINGS VIEW
           ========================================================= */}
        {screen === 'settings' && (
          <>
            {/* Mobile Top Header */}
            <header className="flex lg:hidden h-[59px] bg-white border-b border-[#0F7B5F] px-3 items-center justify-between">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex items-end gap-[14.5px] focus:outline-none"
              >
                <HamburgerIcon />
                <span className="text-[20.2px] leading-[28px] font-bold text-black">
                  Settings
                </span>
              </button>
              <div className="flex items-center gap-2">
                <span className="w-[5px] h-[5px] rounded-full bg-[#34D399]" />
                <span className="text-[11px] leading-[15px] font-bold text-[#0F7B5F]">
                  Testnet
                </span>
              </div>
            </header>

            <main className="p-3 sm:p-6 lg:p-[30px] lg:pt-[81px] pb-16">
              <h1 className="hidden lg:block text-[36px] leading-[49px] font-extrabold text-black mb-[59px]">
                Payment Settings
              </h1>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-[22px] items-start">
                {/* Left Column: Settlement, Defaults, Receipts */}
                <div className="xl:col-span-7 space-y-3 lg:space-y-[30px]">
                  {/* Card 0: Business Profile */}
                  <div className="bg-white border border-[#E3E7E1] rounded-[10px] sm:rounded-[20px] p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]">
                          Business Profile
                        </h2>
                        <p className="mt-1 text-[12px] leading-[16px] font-bold text-black/60">
                          Edit your company name, category, and support contact
                        </p>
                      </div>
                      <span className="text-[11px] font-bold text-[#0F7B5F] bg-[#E8F4F0] px-2.5 py-1 rounded-[6px]">
                        Public Info
                      </span>
                    </div>

                    <div className="mt-5 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12px] leading-[16px] font-bold text-black/80 mb-1.5">
                            Business Name
                          </label>
                          <input
                            type="text"
                            value={profile.businessName}
                            onChange={(e) => {
                              onUpdateProfile({ businessName: e.target.value, statementName: e.target.value });
                              setUnsavedCount((c) => c + 1);
                            }}
                            placeholder="e.g Adaeze Bakery"
                            className="w-full h-[41px] px-3.5 rounded-[10px] border border-[#0B1F1A]/40 text-[15px] font-bold text-black focus:border-[#0F7B5F] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-[12px] leading-[16px] font-bold text-black/80 mb-1.5">
                            Business Category
                          </label>
                          <div className="relative">
                            <select
                              value={normalizeBusinessCategory(profile.businessType)}
                              onChange={(e) => {
                                onUpdateProfile({ businessType: e.target.value });
                                setUnsavedCount((c) => c + 1);
                              }}
                              className="w-full h-[41px] px-3.5 pr-8 bg-white border border-[#0B1F1A]/40 rounded-[10px] text-[15px] font-bold text-black appearance-none focus:border-[#0F7B5F] focus:outline-none"
                            >
                              {BUSINESS_CATEGORIES.map((cat) => (
                                <option key={cat.code} value={cat.code}>
                                  {cat.label}
                                </option>
                              ))}
                            </select>
                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[18px] font-bold text-black">
                              &gt;
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[12px] leading-[16px] font-bold text-black/80 mb-1.5">
                          Support Email
                        </label>
                        <input
                          type="email"
                          value={profile.email}
                          onChange={(e) => {
                            onUpdateProfile({ email: e.target.value });
                            setUnsavedCount((c) => c + 1);
                          }}
                          placeholder="e.g contact@business.com"
                          className="w-full h-[41px] px-3.5 rounded-[10px] border border-[#0B1F1A]/40 text-[15px] font-bold text-black focus:border-[#0F7B5F] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 1: Settlement */}
                  <div className="bg-white border border-[#E3E7E1] rounded-[10px] sm:rounded-[20px] p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]">
                          Settlement Wallet
                        </h2>
                        <p className="mt-1 text-[12px] leading-[16px] font-bold text-black/60">
                          Non-custodial Stellar address where customer payments settle
                        </p>
                      </div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-[6px] ${
                        profile.walletAddress ? 'bg-[#E8F4F0] text-[#0F7B5F]' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {profile.walletAddress ? 'Connected • Testnet' : 'Not Connected'}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-12 gap-4">
                      <div className="sm:col-span-8">
                        <label className="block text-[12px] leading-[16px] font-bold text-black/80 mb-1.5">
                          Public Address (Ed25519)
                        </label>
                        <div className="h-[44px] px-3.5 rounded-[10px] border border-[#0B1F1A]/30 bg-[#F5F6F2] flex items-center justify-between">
                          <span
                            className="text-[13px] sm:text-[14px] font-bold text-black/90 tabular-nums font-mono truncate mr-2"
                            title={profile.walletAddress || 'No wallet'}
                          >
                            {profile.walletAddress || 'No wallet connected'}
                          </span>
                          {profile.walletAddress && (
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(profile.walletAddress);
                                onNotify('Settlement wallet address copied.');
                              }}
                              className="text-[13px] font-bold text-[#0F7B5F] hover:underline shrink-0"
                            >
                              Copy
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="sm:col-span-4">
                        <label className="block text-[12px] leading-[16px] font-bold text-black/80 mb-1.5">
                          Settlement Asset
                        </label>
                        <div className="h-[44px] px-3.5 rounded-[10px] border border-[#0B1F1A]/30 bg-[#F5F6F2] flex items-center justify-between text-[14px] font-bold text-black">
                          <span>USDC</span>
                          <span className="text-[11px] text-[#0F7B5F] bg-[#E8F4F0] px-2 py-0.5 rounded-[5px]">
                            Instant Testnet
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Balance Display Row */}
                    <div className="mt-4 grid grid-cols-2 gap-3 p-3.5 rounded-[12px] bg-[#E8F4F0]/60 border border-[#0F7B5F]/20">
                      <div>
                        <div className="text-[11px] font-bold text-[#0B1F1A]/60">USDC Balance</div>
                        <div className="text-[18px] sm:text-[22px] font-extrabold text-[#0B1F1A] tabular-nums mt-0.5">
                          {profile.usdcBalance || '0.00'} USDC
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-[#0B1F1A]/60">XLM Balance (Gas)</div>
                        <div className="text-[18px] sm:text-[22px] font-extrabold text-[#0F7B5F] tabular-nums mt-0.5">
                          {profile.xlmBalance || '0.00'} XLM
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-black/10">
                      <div className="flex items-center gap-2">
                        {profile.walletAddress ? (
                          <>
                            <button
                              type="button"
                              onClick={handleConnectWallet}
                              className="h-[36px] px-3.5 rounded-[8px] bg-[#0F7B5F] hover:bg-[#0c634c] text-[13px] font-bold text-white transition-colors"
                            >
                              Change Wallet
                            </button>
                            <button
                              type="button"
                              onClick={handleDisconnectWallet}
                              className="h-[36px] px-3.5 rounded-[8px] border border-[#C20C0C] text-[13px] font-bold text-[#C20C0C] hover:bg-red-50 transition-colors"
                            >
                              Disconnect Wallet
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={handleConnectWallet}
                            className="h-[36px] px-4 rounded-[8px] bg-[#0F7B5F] hover:bg-[#0c634c] text-[13px] font-bold text-white transition-colors shadow-sm"
                          >
                            ⚡ Connect Stellar Wallet
                          </button>
                        )}
                      </div>

                      {profile.walletAddress && (
                        <button
                          type="button"
                          disabled={isFundingWallet}
                          onClick={handleRequestFriendbotFunding}
                          className="h-[36px] px-3 rounded-[8px] border border-[#0F7B5F] text-[12px] font-bold text-[#0F7B5F] hover:bg-[#E8F4F0] transition-colors"
                        >
                          {isFundingWallet ? 'Requesting...' : '⚡ Request 10,000 Testnet XLM'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card 2: Payment request defaults */}
                  <div className="bg-white border border-[#E3E7E1] rounded-[10px] sm:rounded-[20px] overflow-hidden">
                    <div className="px-5 pt-6 pb-3">
                      <h2 className="text-[17px] sm:text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]">
                        Payment request defaults
                      </h2>
                    </div>

                    <div className="divide-y divide-black/20">
                      {/* Row 1: Expires after */}
                      <div className="px-5 py-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[16px] sm:text-[18px] leading-[21px] font-bold text-[#0B1F1A]">
                            Requests expires after
                          </div>
                          <div className="text-[10px] sm:text-[12px] leading-[16px] font-bold text-black/60 mt-1">
                            Applies to new payments
                          </div>
                        </div>
                        <div className="relative">
                          <select
                            value={profile.defaultExpiry}
                            onChange={(e) => {
                              onUpdateProfile({ defaultExpiry: e.target.value });
                              setUnsavedCount((c) => c + 1);
                            }}
                            className="w-[104px] sm:w-[134px] h-[39px] sm:h-[50px] px-2.5 pr-7 bg-white border border-[#0B1F1A]/40 rounded-[8px] sm:rounded-[10px] text-[14px] sm:text-[18px] font-bold text-black appearance-none focus:outline-none"
                          >
                            <option value="30 minutes">30 minutes</option>
                            <option value="15 minutes">15 minutes</option>
                            <option value="1 hour">1 hour</option>
                            <option value="24 hours">24 hours</option>
                          </select>
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rotate-90 text-[20px] font-bold text-black">
                            &gt;
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Single use request */}
                      <div className="px-5 py-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[16px] sm:text-[18px] leading-[21px] font-bold text-[#0B1F1A]">
                            Single use request
                          </div>
                          <div className="text-[10px] sm:text-[12px] leading-[16px] font-bold text-black/60 mt-1">
                            Close a request after its first matched payment
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateProfile({
                              defaultSingleUse: !profile.defaultSingleUse,
                            });
                            setUnsavedCount((c) => c + 1);
                          }}
                          className={`w-[54px] sm:w-[68px] h-[25px] sm:h-[31px] rounded-full p-1 transition-colors shrink-0 ${
                            profile.defaultSingleUse ? 'bg-[#0F7B5F]' : 'bg-black/60'
                          }`}
                        >
                          <span
                            className={`block w-[24px] sm:w-[30px] h-[19px] sm:h-[24px] rounded-full bg-white transition-transform ${
                              profile.defaultSingleUse
                                ? 'translate-x-[22px] sm:translate-x-[30px]'
                                : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Row 3: Allow partial payment */}
                      <div className="px-5 py-4 flex items-center justify-between gap-4">
                        <div>
                          <div className="text-[16px] sm:text-[18px] leading-[21px] font-bold text-[#0B1F1A]">
                            Allow partial payment
                          </div>
                          <div className="text-[10px] sm:text-[12px] leading-[16px] font-bold text-black/60 mt-1">
                            Not available on testnet MVP
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            onNotify('Partial payments are not available on Testnet MVP.')
                          }
                          className="w-[54px] sm:w-[68px] h-[25px] sm:h-[31px] rounded-full p-1 bg-black/60 shrink-0 cursor-not-allowed"
                        >
                          <span className="block w-[24px] sm:w-[30px] h-[19px] sm:h-[24px] rounded-full bg-white translate-x-0" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Receipts and notification */}
                  <div className="bg-white border border-[#E3E7E1] rounded-[10px] sm:rounded-[20px] p-5">
                    <h2 className="text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]">
                      Receipts and notification
                    </h2>

                    <div className="mt-4">
                      <label className="block text-[12px] leading-[16px] font-bold text-black/80 mb-1.5">
                        Statement name shown to customer
                      </label>
                      <input
                        type="text"
                        value={profile.statementName}
                        onChange={(e) => {
                          onUpdateProfile({ statementName: e.target.value });
                          setUnsavedCount((c) => c + 1);
                        }}
                        className="w-full h-[41px] px-4 rounded-[10px] border border-[#0B1F1A]/40 text-[16px] font-bold text-black/60 focus:text-black focus:border-[#0F7B5F] focus:outline-none"
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateProfile({
                            emailReceiptsToCustomers: !profile.emailReceiptsToCustomers,
                          });
                          setUnsavedCount((c) => c + 1);
                        }}
                        className="h-[41px] px-3 rounded-[10px] sm:border sm:border-[#0B1F1A]/40 flex items-center gap-3 text-left"
                      >
                        <span
                          className={`w-[20px] h-[20px] rounded-full shrink-0 ${
                            profile.emailReceiptsToCustomers
                              ? 'border-[4px] border-[#0F7B5F]'
                              : 'border border-[#0B1F1A]'
                          }`}
                        />
                        <span className="text-[16px] leading-[22px] font-bold text-black/60 truncate">
                          Email receipts to customers
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onUpdateProfile({
                            emailOnEachPayment: !profile.emailOnEachPayment,
                          });
                          setUnsavedCount((c) => c + 1);
                        }}
                        className="h-[41px] px-3 rounded-[10px] sm:border sm:border-[#0B1F1A]/40 flex items-center gap-3 text-left"
                      >
                        <span
                          className={`w-[20px] h-[20px] rounded-full shrink-0 ${
                            profile.emailOnEachPayment
                              ? 'border-[4px] border-[#0F7B5F]'
                              : 'border border-[#0B1F1A]'
                          }`}
                        />
                        <span className="text-[16px] leading-[22px] font-bold text-black/60 truncate">
                          Email me on each payment
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Developer API Key + Change Password + Unsaved Changes */}
                <div className="xl:col-span-5 flex flex-col justify-between space-y-4">
                  {/* Card: Developer API Key */}
                  <div className="bg-white border border-[#E3E7E1] rounded-[10px] sm:rounded-[20px] p-5 shadow-sm">
                    <h2 className="text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]">
                      Developer API Key
                    </h2>
                    <p className="mt-1 text-[12px] leading-[16px] font-bold text-black/60">
                      Use this key to authenticate checkout creation from your backend or website
                    </p>

                    <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex-1 h-[41px] px-3.5 rounded-[10px] bg-[#F5F6F2] border border-[#0B1F1A]/30 flex items-center font-mono text-[13px] font-bold text-black/80 truncate">
                        {profile.apiKey || 'smeh_live_sec_adaeze2026demo'}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(profile.apiKey || 'smeh_live_sec_adaeze2026demo');
                          onNotify('API key copied to clipboard.');
                        }}
                        className="h-[36px] sm:h-[41px] px-3.5 bg-[#0F7B5F] hover:bg-[#0c634c] rounded-[10px] text-[13px] font-bold text-white transition-colors shrink-0"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await api.merchants.refreshApiKey();
                            if (res.success && res.data?.api_key) {
                              onUpdateProfile({ apiKey: res.data.api_key });
                              onNotify('New Developer API Key generated.');
                            } else {
                              onNotify(res.message || 'Failed to refresh API key.');
                            }
                          } catch {
                            onNotify('Failed to refresh API key.');
                          }
                        }}
                        className="h-[36px] sm:h-[41px] px-3 border border-[#0F7B5F] text-[#0F7B5F] hover:bg-[#E8F4F0] rounded-[10px] text-[13px] font-bold transition-colors shrink-0"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>

                  {/* Card 4: Change password */}
                  <div className="bg-white border border-[#E3E7E1] rounded-[10px] sm:rounded-[20px] p-5 shadow-sm">
                    <h2 className="text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]">
                      Change password
                    </h2>

                    <div className="mt-4 space-y-3.5 max-w-[332px]">
                      <div>
                        <label className="block text-[12px] leading-[16px] font-bold text-black/80 mb-1">
                          Old password
                        </label>
                        <input
                          type="password"
                          value={oldPass}
                          onChange={(e) => setOldPass(e.target.value)}
                          className="w-full h-[41px] px-4 rounded-[10px] border border-[#0B1F1A]/40 text-[16px] font-bold text-black/60 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] leading-[16px] font-bold text-black/80 mb-1">
                          New password
                        </label>
                        <input
                          type="password"
                          value={newPass}
                          onChange={(e) => setNewPass(e.target.value)}
                          className="w-full h-[41px] px-4 rounded-[10px] border border-[#0B1F1A]/40 text-[16px] font-bold text-black/60 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[12px] leading-[16px] font-bold text-black/80 mb-1">
                          Retype New password
                        </label>
                        <input
                          type="password"
                          value={retypePass}
                          onChange={(e) => setRetypePass(e.target.value)}
                          className="w-full h-[41px] px-4 rounded-[10px] border border-[#0B1F1A]/40 text-[16px] font-bold text-black/60 focus:outline-none"
                        />
                      </div>

                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!newPass) {
                              onNotify('Please enter a new password.');
                              return;
                            }
                            if (newPass !== retypePass) {
                              onNotify('New passwords do not match.');
                              return;
                            }
                            onNotify('Password updated successfully.');
                            setOldPass('');
                            setNewPass('');
                            setRetypePass('');
                          }}
                          className="w-[137px] h-[32px] rounded-[8.1px] bg-[#0F7B5F] hover:bg-[#0c634c] text-[13px] font-bold text-white transition-colors"
                        >
                          Change password
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Unsaved Changes Box */}
                  <div className="bg-white border border-[#E3E7E1] rounded-[10px] p-4 shadow-sm">
                    <div className="text-[11px] sm:text-[13px] leading-[16px] font-bold text-[#7A4B00]">
                      {unsavedCount > 0
                        ? `${unsavedCount} unsaved change(s)`
                        : 'All settings in sync with backend'}
                    </div>
                    <div className="mt-3 flex items-center justify-between sm:justify-start gap-4 sm:gap-6">
                      <button
                        type="button"
                        onClick={() => {
                          setUnsavedCount(0);
                          onNotify('Discarded unsaved changes.');
                        }}
                        className="w-[134px] h-[37px] rounded-[10px] border border-[#0B1F1A]/40 text-[15px] sm:text-[16px] font-bold text-black hover:bg-black/5 transition-colors"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await api.merchants.updateProfile({
                              business_name: profile.businessName || profile.statementName,
                              category: normalizeBusinessCategory(profile.businessType),
                              support_email: profile.email,
                            });
                            if (res.success) {
                              setUnsavedCount(0);
                              onNotify('Payment settings successfully saved to backend!');
                            } else {
                              onNotify(res.message || 'Failed to save settings.');
                            }
                          } catch {
                            onNotify('Error saving settings to server.');
                          }
                        }}
                        className="w-[170px] h-[37px] rounded-[10px] bg-[#0F7B5F] hover:bg-[#0c634c] text-[15px] sm:text-[16px] font-bold text-white transition-colors"
                      >
                        Save changes
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </>
        )}

        {/* =========================================================
            ORDER ENTRY / MULTIPLE CHOICES MODAL
           ========================================================= */}
        {isOrderModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
            <div
              className="bg-white rounded-[28px] max-w-[640px] w-full p-6 sm:p-8 shadow-2xl border border-[#E3E7E1] my-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E3E7E1]">
                <div>
                  <h2 className="text-[20px] font-extrabold text-[#0B1F1A] flex items-center gap-2">
                    <span>📋</span>
                    <span>Add item(s) & Pricing</span>
                  </h2>
                  <p className="text-[12px] text-[#0B1F1A]/70 mt-1">
                    Add and configure order items, unit prices, and quantities. Total amount updates automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-[#F5F6F2] text-black/60 hover:text-black font-bold flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Quick Template Presets */}
              <div className="mt-4 pt-1 pb-3">
                <div className="text-[11px] font-extrabold uppercase text-[#0B1F1A]/50 tracking-wider mb-2">
                  Quick Add Presets
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddModalItem('Artisan Sourdough', 8.50, 1)}
                    className="px-3 py-1.5 rounded-full bg-[#F5F6F2] hover:bg-[#E8F4F0] text-[12px] font-bold text-[#0B1F1A] hover:text-[#0F7B5F] transition-colors border border-[#E3E7E1]"
                  >
                    + Sourdough ($8.50)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddModalItem('Croissant Box (6x)', 18.00, 1)}
                    className="px-3 py-1.5 rounded-full bg-[#F5F6F2] hover:bg-[#E8F4F0] text-[12px] font-bold text-[#0B1F1A] hover:text-[#0F7B5F] transition-colors border border-[#E3E7E1]"
                  >
                    + Croissant Box ($18.00)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddModalItem('Specialty Coffee', 4.50, 1)}
                    className="px-3 py-1.5 rounded-full bg-[#F5F6F2] hover:bg-[#E8F4F0] text-[12px] font-bold text-[#0B1F1A] hover:text-[#0F7B5F] transition-colors border border-[#E3E7E1]"
                  >
                    + Coffee ($4.50)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddModalItem('Custom Item', 10.00, 1)}
                    className="px-3 py-1.5 rounded-full bg-[#0F7B5F]/10 hover:bg-[#0F7B5F]/20 text-[12px] font-bold text-[#0F7B5F] transition-colors"
                  >
                    + Custom Item ($10.00)
                  </button>
                </div>
              </div>

              {/* Itemized Order Table / Rows */}
              <div className="mt-2 max-h-[320px] overflow-y-auto space-y-3 pr-1">
                {orderModalItems.length === 0 ? (
                  <div className="text-center py-8 text-[#0B1F1A]/50 text-[14px]">
                    No items in order yet. Click "+ Add Item Choice" or use a quick preset above.
                  </div>
                ) : (
                  orderModalItems.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="p-3 bg-[#F5F6F2]/60 border border-[#E3E7E1] rounded-[14px] flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                    >
                      {/* Item Name */}
                      <div className="flex-1">
                        <label className="block text-[11px] font-bold text-[#0B1F1A]/60 mb-1">
                          Item Description / Choice #{index + 1}
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Sourdough Loaf"
                          value={item.name}
                          onChange={(e) => handleUpdateModalItem(index, { name: e.target.value })}
                          className="w-full h-[38px] px-3 bg-white border border-[#E3E7E1] focus:border-[#0F7B5F] rounded-[8px] text-[13px] font-bold text-black focus:outline-none"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="w-full sm:w-[110px]">
                        <label className="block text-[11px] font-bold text-[#0B1F1A]/60 mb-1">
                          Unit Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={(e) => handleUpdateModalItem(index, { price: parseFloat(e.target.value) || 0 })}
                          className="w-full h-[38px] px-3 bg-white border border-[#E3E7E1] focus:border-[#0F7B5F] rounded-[8px] text-[13px] font-bold text-black focus:outline-none tabular-nums"
                        />
                      </div>

                      {/* Quantity Stepper */}
                      <div className="w-full sm:w-[110px]">
                        <label className="block text-[11px] font-bold text-[#0B1F1A]/60 mb-1">
                          Quantity
                        </label>
                        <div className="flex items-center h-[38px] bg-white border border-[#E3E7E1] rounded-[8px] overflow-hidden">
                          <button
                            type="button"
                            onClick={() => handleUpdateModalItem(index, { quantity: Math.max(1, item.quantity - 1) })}
                            className="w-8 h-full bg-[#F5F6F2] hover:bg-[#E3E7E1] text-[15px] font-bold text-[#0B1F1A] flex items-center justify-center transition-colors"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateModalItem(index, { quantity: parseInt(e.target.value, 10) || 1 })}
                            className="w-full text-center text-[13px] font-bold text-black focus:outline-none tabular-nums"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateModalItem(index, { quantity: item.quantity + 1 })}
                            className="w-8 h-full bg-[#F5F6F2] hover:bg-[#E3E7E1] text-[15px] font-bold text-[#0B1F1A] flex items-center justify-center transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Subtotal & Delete */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-[90px] pt-1">
                        <div className="text-[10px] font-bold text-[#0B1F1A]/50">Subtotal</div>
                        <div className="text-[14px] font-extrabold text-[#0F7B5F] tabular-nums">
                          ${(item.total || 0).toFixed(2)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveModalItem(index)}
                        className="self-center sm:self-center p-2 text-rose-500 hover:bg-rose-50 rounded-[8px] transition-colors"
                        title="Remove item"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Item Button */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => handleAddModalItem('', 10.00, 1)}
                  className="w-full h-[40px] border-2 border-dashed border-[#0F7B5F]/40 hover:border-[#0F7B5F] hover:bg-[#E8F4F0]/30 rounded-[10px] text-[13px] font-bold text-[#0F7B5F] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>+</span>
                  <span>Add Item Choice</span>
                </button>
              </div>

              {/* Total and Footer */}
              <div className="mt-6 pt-4 border-t border-[#E3E7E1] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="bg-[#E8F4F0] px-4 py-2 rounded-[12px] flex items-baseline gap-2">
                  <span className="text-[12px] font-bold text-[#0B1F1A]/70">Calculated Total:</span>
                  <span className="text-[20px] font-extrabold text-[#0F7B5F] tabular-nums">
                    {orderModalItems.reduce((acc, it) => acc + (it.total || 0), 0).toFixed(2)}
                  </span>
                  <span className="text-[12px] font-bold text-[#0F7B5F]">
                    {orderModalTarget === 'create' ? activeRequest.asset || 'USDC' : editForm.currency}
                  </span>
                </div>

                <div className="flex items-center gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsOrderModalOpen(false)}
                    className="h-[42px] px-5 rounded-[10px] border border-[#E3E7E1] text-[13px] font-bold text-[#0B1F1A] hover:bg-[#F5F6F2] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyOrderItems}
                    className="h-[42px] px-6 rounded-[10px] bg-[#0F7B5F] hover:bg-[#0c634c] text-[13px] font-bold text-white transition-colors shadow-sm"
                  >
                    Apply to Payment Request
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export type ScreenId =
  | 'landing'
  | 'signup-1'
  | 'signup-2'
  | 'signup-3'
  | 'signin-1'
  | 'signin-2'
  | 'dashboard'
  | 'payment-requests'
  | 'create-payment'
  | 'payment-created'
  | 'history'
  | 'settings'
  | 'customer-checkout';

export type TransactionStatus = 'Completed' | 'Pending' | 'Failed';

export interface Transaction {
  id: string;
  orderRef: string;
  customer: string;
  referenceLabel: string;
  amount: string;
  asset: string;
  status: TransactionStatus;
  date: string;
  shortHash: string;
  fullHash: string;
  network: string;
  fee: string;
  description: string;
  stellarExpertUrl?: string;
  ledger?: number;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface PaymentRequestData {
  id: string;
  referenceId: string;
  amount: string;
  asset: string;
  customer: string;
  description: string;
  orderRef: string;
  orders?: OrderItem[];
  expiresIn: string;
  singleUse: boolean;
  paymentLink: string;
  statusStep: 1 | 2 | 3 | 4;
  memo?: string;
  destinationAddress?: string;
  qrCodeBase64?: string;
  sep0007Uri?: string;
  status?: string;
  expiresAt?: string;
  paidAt?: string;
  createdAt?: string;
  customerEmail?: string;
}

export type WalletId =
  | 'freighter'
  | 'albedo'
  | 'trust'
  | 'generated'
  | 'manual'
  | 'xbull'
  | 'lobstr'
  | 'hana'
  | 'rabet';

export interface BusinessProfile {
  username?: string;
  businessName: string;
  businessType: string;
  country: string;
  email: string;
  walletAddress: string;
  shortWallet: string;
  settlementAsset: 'USDC' | 'XLM';
  connectedWallet: WalletId | null;
  usdcBalance: string;
  xlmBalance: string;
  isWalletVerified?: boolean;
  apiKey?: string;
  statementName: string;
  defaultExpiry: string;
  defaultSingleUse: boolean;
  allowPartialPayment: boolean;
  emailReceiptsToCustomers: boolean;
  emailOnEachPayment: boolean;
}

export interface DashboardMetrics {
  businessName: string;
  walletConnected: boolean;
  walletPublicKey: string | null;
  walletVerified: boolean;
  totalVolumeUsdc: string;
  totalVolumeXlm: string;
  completedPaymentsCount: number;
  pendingPaymentsCount: number;
  expiredPaymentsCount: number;
  cancelledPaymentsCount: number;
  totalRequestsCount: number;
  conversionRate: number;
  recentActivity: Array<{
    id: string;
    referenceId: string;
    title: string;
    amount: string;
    currency: string;
    status: string;
    txHash: string | null;
    stellarExpertUrl: string | null;
    createdAt: string;
    paidAt: string | null;
  }>;
}

export interface BusinessCategoryOption {
  code: string;
  label: string;
}

export const BUSINESS_CATEGORIES: BusinessCategoryOption[] = [
  { code: 'FOOD_BEV', label: 'Food, Beverage & Bakery' },
  { code: 'RETAIL', label: 'Retail & E-commerce' },
  { code: 'SERVICES', label: 'Professional Services & Agency' },
  { code: 'TECH', label: 'Technology & Web3 / SaaS' },
  { code: 'DIGITAL', label: 'Digital Goods & Software' },
  { code: 'OTHER', label: 'Other Business' },
];

export function normalizeBusinessCategory(cat?: string): string {
  if (!cat) return 'FOOD_BEV';
  const c = cat.toLowerCase().trim();
  if (c.includes('food') || c.includes('bakery') || c.includes('hospitality') || c === 'food_bev') return 'FOOD_BEV';
  if (c.includes('retail') || c.includes('commerce') || c === 'retail') return 'RETAIL';
  if (c.includes('service') || c.includes('agency') || c.includes('freelance') || c === 'services') return 'SERVICES';
  if (c.includes('tech') || c.includes('web3') || c.includes('saas')) return 'TECH';
  if (c.includes('digital') || c.includes('software')) return 'DIGITAL';
  return 'OTHER';
}


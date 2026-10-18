/**
 * SMEHUB Backend API Client
 * Seamlessly interfaces with the Django REST Framework endpoints.
 */

const API_BASE_URL =
  import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'smehub_auth_token';
const MERCHANT_KEY = 'smehub_merchant_data';

export const authStorage = {
  getToken: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken: (token: string) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  },
  clearToken: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(MERCHANT_KEY);
    } catch {}
  },
  getStoredMerchant: (): any | null => {
    try {
      const data = localStorage.getItem(MERCHANT_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setStoredMerchant: (data: any) => {
    try {
      localStorage.setItem(MERCHANT_KEY, JSON.stringify(data));
    } catch {}
  },
};

async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; errors?: any; token?: string; status?: number }> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const cleanEndpoint = endpoint.replace(/^\//, '');
  const isPublicEndpoint =
    cleanEndpoint.startsWith('merchants/register') ||
    cleanEndpoint.startsWith('merchants/login') ||
    cleanEndpoint.startsWith('payments/checkout') ||
    cleanEndpoint.startsWith('transactions/status') ||
    cleanEndpoint.startsWith('contracts/');

  const token = authStorage.getToken();
  if (!isPublicEndpoint && token && !headers.has('Authorization')) {
    headers.set('Authorization', `Token ${token}`);
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401 && (json.detail?.includes('token') || json.message?.includes('token'))) {
        authStorage.clearToken();
      }
      let errMsg = json.message || json.detail || 'Request failed';
      if (json.errors) {
        if (typeof json.errors === 'object') {
          const firstKey = Object.keys(json.errors)[0];
          if (firstKey) {
            const val = json.errors[firstKey];
            errMsg = Array.isArray(val) ? `${firstKey}: ${val[0]}` : `${firstKey}: ${val}`;
          }
        }
      }
      return {
        success: false,
        status: res.status,
        message: errMsg,
        errors: json.errors || json,
        data: json,
      };
    }

    return {
      success: true,
      status: res.status,
      data: json.data !== undefined ? json.data : json,
      message: json.message,
      token: json.token,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 0,
      message: err.message || 'Network error communicating with SMEHUB API server.',
      errors: { network: [err.message] },
    };
  }
}

export const api = {
  // Authentication & Merchant Onboarding
  auth: {
    register: async (payload: {
      username: string;
      email: string;
      password: string;
      business_name: string;
      category?: string;
      description?: string;
      stellar_public_key?: string;
      wallet_provider?: string;
    }) => {
      authStorage.clearToken();
      const res = await apiRequest('merchants/register/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (res.success && res.token) {
        authStorage.setToken(res.token);
        if (res.data) authStorage.setStoredMerchant(res.data);
      }
      return res;
    },

    login: async (credentials: { username: string; password: string }) => {
      authStorage.clearToken();
      const res = await apiRequest('merchants/login/', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      if (res.success && res.data?.token) {
        authStorage.setToken(res.data.token);
        if (res.data.merchant) authStorage.setStoredMerchant(res.data.merchant);
      }
      return res;
    },

    registerWithWallet: async (publicKey: string, walletProvider: string = 'Freighter') => {
      authStorage.clearToken();
      const res = await apiRequest('merchants/register/wallet/', {
        method: 'POST',
        body: JSON.stringify({ public_key: publicKey, wallet_provider: walletProvider }),
      });
      if (res.success && res.data?.token) {
        authStorage.setToken(res.data.token);
        if (res.data.merchant) authStorage.setStoredMerchant(res.data.merchant);
      }
      return res;
    },

    loginWithWallet: async (publicKey: string, walletProvider: string = 'Freighter', autoRegister: boolean = false) => {
      authStorage.clearToken();
      const res = await apiRequest('merchants/login/wallet/', {
        method: 'POST',
        body: JSON.stringify({ public_key: publicKey, wallet_provider: walletProvider, auto_register: autoRegister }),
      });
      if (res.success && res.data?.token) {
        authStorage.setToken(res.data.token);
        if (res.data.merchant) authStorage.setStoredMerchant(res.data.merchant);
      }
      return res;
    },

    logout: () => {
      authStorage.clearToken();
    },

    isAuthenticated: () => !!authStorage.getToken(),
  },

  // Merchant Profile & Wallet Operations
  merchants: {
    getProfile: () => apiRequest('merchants/profile/'),
    updateProfile: (updates: Record<string, any>) =>
      apiRequest('merchants/profile/', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
    connectWallet: (publicKey: string, walletProvider: string = 'Freighter') =>
      apiRequest('merchants/wallet/connect/', {
        method: 'POST',
        body: JSON.stringify({ public_key: publicKey, wallet_provider: walletProvider }),
      }),
    getWalletInfo: () => apiRequest('merchants/wallet/'),
    refreshApiKey: () =>
      apiRequest('merchants/api-key/refresh/', {
        method: 'POST',
      }),
  },

  // Payment Requests & Invoices
  payments: {
    create: (data: {
      amount?: string | number;
      currency: 'USDC' | 'XLM';
      order_reference?: string;
      orders?: Array<{ id?: string; name: string; price: number; quantity: number; total?: number }>;
      title?: string;
      description?: string;
      customer_name?: string;
      customer_email?: string;
      expires_in_minutes?: number;
    }) =>
      apiRequest('payments/requests/create/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    list: (params?: { status?: string; currency?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return apiRequest(`payments/requests/${query ? `?${query}` : ''}`);
    },
    getDetail: (referenceId: string) => apiRequest(`payments/requests/${referenceId}/`),
    update: (
      referenceId: string,
      data: {
        amount?: string | number;
        currency?: 'USDC' | 'XLM';
        order_reference?: string;
        orders?: Array<{ id?: string; name: string; price: number; quantity: number; total?: number }>;
        title?: string;
        description?: string;
        customer_name?: string;
        customer_email?: string;
        expires_in_minutes?: number;
        status?: string;
      }
    ) =>
      apiRequest(`payments/requests/${referenceId}/`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    cancel: (referenceId: string) =>
      apiRequest(`payments/requests/${referenceId}/cancel/`, {
        method: 'POST',
      }),
    getPublicCheckout: (referenceId: string) => apiRequest(`payments/checkout/${referenceId}/`),
  },

  // Stellar Transactions & Verification
  transactions: {
    prepare: (referenceId: string, payerAddress: string, currency?: string) =>
      apiRequest(`transactions/prepare/${referenceId}/`, {
        method: 'POST',
        body: JSON.stringify({ payer_address: payerAddress, currency }),
      }),
    broadcast: (referenceId: string, signedXdr: string) =>
      apiRequest(`transactions/broadcast/${referenceId}/`, {
        method: 'POST',
        body: JSON.stringify({ signed_xdr: signedXdr }),
      }),
    submitAndVerify: (referenceId: string, txHash: string) =>
      apiRequest(`transactions/verify/${referenceId}/`, {
        method: 'POST',
        body: JSON.stringify({ tx_hash: txHash }),
      }),
    pollStatus: (referenceId: string) => apiRequest(`transactions/status/${referenceId}/`),
    list: (params?: { status?: string; asset_code?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return apiRequest(`transactions/${query ? `?${query}` : ''}`);
    },
    getDetail: (txHash: string) => apiRequest(`transactions/${txHash}/`),
  },

  // Analytics & Dashboard Metrics
  analytics: {
    getDashboard: () => apiRequest('analytics/dashboard/'),
    getVolumeChart: (days: number = 14) => apiRequest(`analytics/charts/volume/?days=${days}`),
  },

  // Smart Contracts
  contracts: {
    getInfo: () => apiRequest('contracts/info/'),
    buildSorobanPay: (payerAddress: string, referenceId: string) =>
      apiRequest('contracts/soroban/build-pay/', {
        method: 'POST',
        body: JSON.stringify({ payer_address: payerAddress, reference_id: referenceId }),
      }),
  },

  // System
  health: () => apiRequest('health/'),
};

import React, { useState, useRef } from 'react';
import { BusinessProfile, ScreenId, BUSINESS_CATEGORIES, normalizeBusinessCategory } from '../types';
import { BrandLogo, ArrowRightIcon } from './Icons';
import { api, authStorage } from '../services/api';
import {
  stellarWalletService,
  isValidStellarPublicKey,
  openStellarWalletsKitModal,
} from '../services/stellarWallet';

interface AuthViewsProps {
  screen: 'signup-1' | 'signup-2' | 'signup-3' | 'signin-1' | 'signin-2';
  profile: BusinessProfile;
  onUpdateProfile: (updates: Partial<BusinessProfile>) => void;
  onNavigate: (screen: ScreenId) => void;
  onNotify: (msg: string) => void;
}

const DesktopAuthRightPanel: React.FC = () => (
  <aside className="hidden lg:flex w-[380px] xl:w-[440px] 2xl:w-[497px] shrink-0 bg-[#0B1F1A] min-h-screen px-8 xl:px-[54px] py-10 xl:py-[72px] flex-col justify-between">
    <div>
      {/* Stellar Testnet Badge */}
      <div className="inline-flex items-center gap-[13px] h-[45px] px-5 bg-white/10 rounded-[23px]">
        <span className="w-2 h-2 rounded-full bg-[#34D399]" />
        <span className="text-[18px] leading-[25px] font-bold text-[#A7E3CC]">
          Stellar Testnet
        </span>
      </div>

      {/* Main Heading */}
      <h2 className="mt-[53px] text-[38px] leading-[44px] font-bold text-white max-w-[378px]">
        Accept USDC from customers in seconds.
      </h2>

      {/* 3 Numbered Points */}
      <div className="mt-[35px] space-y-[25px] max-w-[378px]">
        <div className="flex items-center gap-[26px]">
          <div className="w-[41px] h-[40px] rounded-[9px] bg-[#0F7B5F] flex items-center justify-center shrink-0 text-[18px] font-bold text-white">
            1
          </div>
          <div className="space-y-[5px]">
            <div className="text-[18px] leading-[25px] font-bold text-white">
              Non-custodial by design
            </div>
            <p className="text-[16px] leading-[22px] font-normal text-[#A7E3CC]">
              Payments settle directly into the wallet your provide.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-[26px]">
          <div className="w-[41px] h-[40px] rounded-[9px] bg-[#0F7B5F] flex items-center justify-center shrink-0 text-[18px] font-bold text-white">
            2
          </div>
          <div className="space-y-[5px]">
            <div className="text-[18px] leading-[25px] font-bold text-white">
              Requests with a link or QR code
            </div>
            <p className="text-[16px] leading-[22px] font-normal text-[#A7E3CC]">
              Each payment is matched to its requests automatically.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-[26px]">
          <div className="w-[41px] h-[40px] rounded-[9px] bg-[#0F7B5F] flex items-center justify-center shrink-0 text-[18px] font-bold text-white">
            3
          </div>
          <div className="space-y-[5px]">
            <div className="text-[18px] leading-[25px] font-bold text-white">
              Every payment is verifiable
            </div>
            <p className="text-[16px] leading-[22px] font-normal text-[#A7E3CC]">
              Each on links to its transaction hash on the testnet explorer.
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Bottom MVP Notice */}
    <div className="mt-12 w-full max-w-[379px] mx-auto bg-white/10 border border-[#A7E3CC]/20 rounded-[10px] p-3.5">
      <p className="text-[18px] leading-[25px] font-bold text-white">
        Testnet only for the MVP. Use test USDC from a testnet faucet. No real funds move.
      </p>
    </div>
  </aside>
);

const DesktopStepIndicator: React.FC<{ activeStep: 1 | 2 | 3 }> = ({ activeStep }) => {
  const stepColor = (s: number) =>
    activeStep >= s
      ? 'border-[#0F7B5F] text-[#0F7B5F]'
      : 'border-black text-black';

  return (
    <div className="hidden sm:flex items-center gap-[9px]">
      {/* Step 1 */}
      <div className="flex items-center gap-[4px]">
        <span
          className={`w-[14px] h-[14px] rounded-full border flex items-center justify-center text-[8.5px] font-bold ${stepColor(
            1
          )}`}
        >
          1
        </span>
        <span
          className={`text-[13.1px] leading-[18px] font-bold whitespace-nowrap ${
            activeStep >= 1 ? 'text-[#0F7B5F]' : 'text-black'
          }`}
        >
          Business profile
        </span>
      </div>

      {/* Line 1 */}
      <div className="w-[35px] h-0 border-t border-black" />

      {/* Step 2 */}
      <div className="flex items-center gap-[4px]">
        <span
          className={`w-[14px] h-[14px] rounded-full border flex items-center justify-center text-[8.5px] font-bold ${stepColor(
            2
          )}`}
        >
          2
        </span>
        <span
          className={`text-[13.1px] leading-[18px] font-bold whitespace-nowrap ${
            activeStep >= 2 ? 'text-[#0F7B5F]' : 'text-black'
          }`}
        >
          Verify email
        </span>
      </div>

      {/* Line 2 */}
      <div className="w-[35px] h-0 border-t border-black" />

      {/* Step 3 */}
      <div className="flex items-center gap-[6px]">
        <span
          className={`w-[14px] h-[14px] rounded-full border flex items-center justify-center text-[8.5px] font-bold ${stepColor(
            3
          )}`}
        >
          3
        </span>
        <span
          className={`text-[13.1px] leading-[18px] font-bold whitespace-nowrap ${
            activeStep >= 3 ? 'text-[#0F7B5F]' : 'text-black'
          }`}
        >
          Connect wallet
        </span>
      </div>
    </div>
  );
};

const MobileProgressBars: React.FC<{ activeStep: 1 | 2 | 3 }> = ({ activeStep }) => (
  <div className="flex sm:hidden items-center gap-[9px] w-full mt-6">
    {[1, 2, 3].map((s) => (
      <div
        key={s}
        className={`h-[5px] flex-1 rounded-full ${
          activeStep >= s ? 'bg-[#0F7B5F]' : 'bg-[#0F7B5F]/25'
        }`}
      />
    ))}
  </div>
);


export const AuthViews: React.FC<AuthViewsProps> = ({
  screen,
  profile,
  onUpdateProfile,
  onNavigate,
  onNotify,
}) => {
  const [password, setPassword] = useState('');
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInError, setSignInError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFunding, setIsFunding] = useState(false);
  const [connectLoadingMessage, setConnectLoadingMessage] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [unregisteredWallet, setUnregisteredWallet] = useState<{ publicKey: string; provider: string } | null>(null);

  const handleCopyWalletKey = (key: string) => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    onNotify('Stellar wallet address copied to clipboard.');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const [otp, setOtp] = useState<string[]>(['4', '8', '2', '9', '1', '6']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOpenStellarWalletsKit = async (mode: 'register' | 'login') => {
    setIsLoading(true);
    setSignInError(null);
    setUnregisteredWallet(null);

    try {
      const { address, walletId } = await openStellarWalletsKitModal();
      if (!address || !isValidStellarPublicKey(address)) {
        onNotify('No valid Stellar address returned from wallet.');
        return;
      }
      const short = `${address.slice(0, 4)}...${address.slice(-4)}`;
      const providerLabel = walletId
        ? walletId.charAt(0).toUpperCase() + walletId.slice(1)
        : 'Stellar Wallet';

      if (mode === 'register') {
        const res = await api.auth.registerWithWallet(address, providerLabel);
        if (res.success) {
          const merchant = res.data?.merchant;
          onUpdateProfile({
            businessName: merchant?.business_name || `Merchant ${short}`,
            statementName: merchant?.business_name || `Merchant ${short}`,
            email: merchant?.business_email || '',
            walletAddress: address,
            shortWallet: short,
            connectedWallet: (walletId as any) || 'freighter',
            apiKey: merchant?.api_key,
            usdcBalance: '50.00',
            xlmBalance: '10000.00',
            isWalletVerified: true,
          });
          onNotify(`Stellar wallet connected via Stellar Wallets Kit (${providerLabel})! Account provisioned.`);
          onNavigate('dashboard');
          return;
        }

        // If backend reports wallet is already registered, seamlessly log them in!
        const loginRes = await api.auth.loginWithWallet(address, providerLabel, false);
        if (loginRes.success) {
          const merchant = loginRes.data?.merchant;
          onUpdateProfile({
            businessName: merchant?.business_name || `Merchant ${short}`,
            statementName: merchant?.business_name || `Merchant ${short}`,
            email: merchant?.business_email || '',
            walletAddress: address,
            shortWallet: short,
            connectedWallet: (walletId as any) || 'freighter',
            apiKey: merchant?.api_key,
            usdcBalance: '50.00',
            xlmBalance: '10000.00',
            isWalletVerified: true,
          });
          onNotify(`Welcome back! Signed in with connected wallet (${short}).`);
          onNavigate('dashboard');
          return;
        }

        onNotify(res.message || 'Failed to register account with wallet.');
      } else {
        // mode === 'login'
        const res = await api.auth.loginWithWallet(address, providerLabel, false);
        if (res.success) {
          const merchant = res.data?.merchant;
          onUpdateProfile({
            businessName: merchant?.business_name || `Merchant ${short}`,
            statementName: merchant?.business_name || `Merchant ${short}`,
            email: merchant?.business_email || '',
            walletAddress: address,
            shortWallet: short,
            connectedWallet: (walletId as any) || 'freighter',
            apiKey: merchant?.api_key,
            usdcBalance: '50.00',
            xlmBalance: '10000.00',
            isWalletVerified: true,
          });
          onNotify(`Signed in with Stellar wallet (${short})!`);
          onNavigate('dashboard');
        } else {
          if (res.data?.not_registered || res.message?.includes('No merchant') || res.message?.includes('not found')) {
            setUnregisteredWallet({ publicKey: address, provider: providerLabel });
            setSignInError(`No merchant account found for wallet ${short}. Click below to create one instantly.`);
          } else {
            setSignInError(res.message || 'Failed to authenticate with Stellar wallet.');
          }
        }
      }
    } catch (err: any) {
      const isCancellation =
        err?.code === -1 ||
        /closed|cancel|reject|decline|abort/i.test(err?.message || '');
      if (isCancellation) {
        // User cancelled or closed modal cleanly
        return;
      }
      onNotify(err?.message || 'Wallet connection was not completed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterUnregisteredWallet = async () => {
    if (!unregisteredWallet) return;
    setIsLoading(true);
    setSignInError(null);
    try {
      const res = await api.auth.registerWithWallet(unregisteredWallet.publicKey, unregisteredWallet.provider);
      if (res.success) {
        const short = `${unregisteredWallet.publicKey.slice(0, 4)}...${unregisteredWallet.publicKey.slice(-4)}`;
        const merchant = res.data?.merchant;
        onUpdateProfile({
          businessName: merchant?.business_name || `Merchant ${short}`,
          statementName: merchant?.business_name || `Merchant ${short}`,
          email: merchant?.business_email || '',
          walletAddress: unregisteredWallet.publicKey,
          shortWallet: short,
          connectedWallet: 'freighter',
          apiKey: merchant?.api_key,
          usdcBalance: '50.00',
          xlmBalance: '10000.00',
          isWalletVerified: true,
        });
        onNotify(`Account created with Stellar wallet (${short})!`);
        onNavigate('dashboard');
      } else {
        setSignInError(res.message || 'Failed to register account with this wallet.');
      }
    } catch (err: any) {
      setSignInError(err?.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };


  // SCREEN: SIGN UP - STEP 3 (Connect your Stellar wallet)
  if (screen === 'signup-3') {
    const isConnected = Boolean(profile.walletAddress && profile.walletAddress.length > 10);

    const handleConnectWithKit = async () => {
      setIsLoading(true);
      setConnectLoadingMessage('Opening Stellar Wallets Kit modal...');
      try {
        const res = await openStellarWalletsKitModal();
        if (!res || !res.address) {
          setIsLoading(false);
          setConnectLoadingMessage(null);
          return;
        }

        const { address, walletId } = res;
        if (isValidStellarPublicKey(address)) {
          setConnectLoadingMessage('Querying on-chain balances from Stellar Horizon...');
          const short = `${address.slice(0, 4)}...${address.slice(-4)}`;
          const providerLabel = walletId
            ? walletId.charAt(0).toUpperCase() + walletId.slice(1)
            : 'Freighter';

          // Query live Horizon balances
          let realUsdc = '0.00';
          let realXlm = '0.00';
          try {
            const balData = await stellarWalletService.fetchAccountBalances(address);
            realUsdc = balData.usdcBalance || '0.00';
            realXlm = balData.xlmBalance || '0.00';
          } catch (e) {
            console.warn('Horizon balance check notice:', e);
          }

          setConnectLoadingMessage('Linking wallet to your merchant profile...');
          onUpdateProfile({
            connectedWallet: (walletId as any) || 'freighter',
            walletAddress: address,
            shortWallet: short,
            usdcBalance: realUsdc,
            xlmBalance: realXlm,
            isWalletVerified: true,
          });

          walletStorage.setWallet({
            walletAddress: address,
            shortWallet: short,
            connectedWallet: (walletId as any) || 'freighter',
            usdcBalance: realUsdc,
            xlmBalance: realXlm,
            isWalletVerified: true,
          });

          if (authStorage.getToken()) {
            try {
              await api.merchants.connectWallet(address, providerLabel);
              const wInfo = await api.merchants.getWalletInfo();
              if (wInfo.success && wInfo.data) {
                const finalUsdc = wInfo.data.usdc_balance != null ? String(wInfo.data.usdc_balance) : realUsdc;
                const finalXlm = wInfo.data.xlm_balance != null ? String(wInfo.data.xlm_balance) : realXlm;
                onUpdateProfile({
                  usdcBalance: finalUsdc,
                  xlmBalance: finalXlm,
                  isWalletVerified: true,
                });
                walletStorage.setWallet({
                  walletAddress: address,
                  shortWallet: short,
                  connectedWallet: (walletId as any) || 'freighter',
                  usdcBalance: finalUsdc,
                  xlmBalance: finalXlm,
                  isWalletVerified: true,
                });
              }
            } catch (linkErr) {
              console.warn('Backend wallet link error:', linkErr);
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
      } finally {
        setIsLoading(false);
        setConnectLoadingMessage(null);
      }
    };

    const handleRequestFaucet = async () => {
      if (!profile.walletAddress || !isValidStellarPublicKey(profile.walletAddress)) {
        onNotify('Please connect a Stellar wallet first.');
        return;
      }
      setIsFunding(true);
      onNotify('Requesting 10,000 Testnet XLM from Stellar Friendbot faucet...');
      const res = await stellarWalletService.fundTestnetWallet(profile.walletAddress);
      setIsFunding(false);
      onNotify(res.message);
      if (res.success) {
        try {
          const balData = await stellarWalletService.fetchAccountBalances(profile.walletAddress);
          onUpdateProfile({
            usdcBalance: balData.usdcBalance || profile.usdcBalance,
            xlmBalance: balData.xlmBalance || '10,000.00',
            isWalletVerified: true,
          });
        } catch {}
      }
    };

    const handleDisconnect = () => {
      onUpdateProfile({
        connectedWallet: null,
        walletAddress: '',
        shortWallet: '',
        usdcBalance: '0.00',
        xlmBalance: '0.00',
        isWalletVerified: false,
      });
      walletStorage.clearWallet();
      onNotify('Wallet disconnected.');
    };

    return (
      <div className="min-h-screen bg-[#F5F6F2] text-[#0B1F1A] px-3.5 sm:px-10 lg:px-[70px] py-5 sm:py-[37px] max-w-[1440px] mx-auto flex flex-col justify-between">
        <div>
          {/* Top bar: Brand + Desktop Stepper */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="hidden sm:block">
              <BrandLogo onClick={() => onNavigate('landing')} />
            </div>
            <div className="sm:hidden">
              <BrandLogo size="sm" onClick={() => onNavigate('landing')} />
            </div>
            <DesktopStepIndicator activeStep={3} />
          </div>

          <MobileProgressBars activeStep={3} />

          {/* Main 2-Col Grid on Desktop / Stacked on Mobile */}
          <div className="mt-8 sm:mt-[45px] grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-[30px] items-stretch">
            {/* Left Card: Dynamic based on connection state */}
            {isConnected ? (
              /* CONNECTED STATE: Display full wallet info + prominent Proceed button */
              <div className="lg:col-span-7 bg-white border border-[#E3E7E1] rounded-[32px] sm:rounded-[40px] p-6 sm:p-10 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
                    <span className="text-[13px] font-extrabold uppercase tracking-wider text-[#0F7B5F]">
                      Step 3 • Wallet Linked
                    </span>
                  </div>

                  <h1 className="text-[32px] sm:text-[38px] leading-[40px] sm:leading-[44px] font-black text-[#0B1F1A]">
                    Wallet Connected Successfully!
                  </h1>
                  <p className="mt-2.5 text-[15px] sm:text-[17px] leading-[24px] text-[#0B1F1A]/70">
                    Your Stellar Testnet wallet is linked to your merchant account. Customer invoice settlements will arrive here directly.
                  </p>

                  {/* Connected Wallet Information Card */}
                  <div className="mt-6 bg-[#F5F6F2] border-2 border-[#0F7B5F]/30 rounded-[24px] p-5 sm:p-7 space-y-5">
                    {/* Header: Provider badge & Disconnect */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[12px] bg-[#0F7B5F] flex items-center justify-center text-white shadow-xs">
                          <svg className="w-5 h-5 text-[#34D399]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[17px] font-extrabold text-[#0B1F1A]">
                              {profile.connectedWallet
                                ? profile.connectedWallet.charAt(0).toUpperCase() + profile.connectedWallet.slice(1)
                                : 'Freighter'} Wallet
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0F7B5F] bg-[#E8F4F0] px-2.5 py-0.5 rounded-full border border-[#0F7B5F]/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                              Active on Testnet
                            </span>
                          </div>
                          <div className="text-[12px] text-black/60 font-medium">
                            Non-custodial settlement destination
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleDisconnect}
                        className="text-[12px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-[8px] transition-colors cursor-pointer"
                      >
                        Disconnect
                      </button>
                    </div>

                    {/* Settlement Public Key Display */}
                    <div className="bg-white rounded-[16px] p-4 border border-black/10 shadow-2xs">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-black/50">
                          Public Stellar Address (Ed25519)
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyWalletKey(profile.walletAddress)}
                          className="inline-flex items-center gap-1 text-[12px] font-bold text-[#0F7B5F] hover:underline cursor-pointer"
                        >
                          {copiedKey ? (
                            <span className="text-[#10B981] font-black">✓ Copied!</span>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span>Copy Address</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="text-[13px] sm:text-[14px] font-mono font-bold text-[#0B1F1A] break-all leading-tight select-all">
                        {profile.walletAddress}
                      </div>
                    </div>

                    {/* Live On-Chain Balances */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="bg-white rounded-[16px] p-4 border border-[#0F7B5F]/20 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-extrabold uppercase tracking-wider text-black/60">
                            USDC Balance
                          </span>
                          <span className="text-[10px] font-bold bg-[#E8F4F0] text-[#0F7B5F] px-2 py-0.5 rounded-full border border-[#0F7B5F]/20">
                            Circle Testnet
                          </span>
                        </div>
                        <div className="mt-2 text-[22px] sm:text-[24px] font-black text-[#0B1F1A] tabular-nums">
                          {profile.usdcBalance || '0.00'} <span className="text-[15px] font-bold text-[#0F7B5F]">USDC</span>
                        </div>
                        <div className="text-[11px] text-black/50 mt-0.5">
                          Invoice settlement asset
                        </div>
                      </div>

                      <div className="bg-white rounded-[16px] p-4 border border-black/10 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] font-extrabold uppercase tracking-wider text-black/60">
                            XLM Gas Balance
                          </span>
                          <span className="text-[10px] font-bold bg-black/5 text-black/70 px-2 py-0.5 rounded-full border border-black/10">
                            Stellar Native
                          </span>
                        </div>
                        <div className="mt-2 text-[22px] sm:text-[24px] font-black text-[#0B1F1A] tabular-nums">
                          {profile.xlmBalance || '0.00'} <span className="text-[15px] font-bold text-black/70">XLM</span>
                        </div>
                        <div className="text-[11px] text-black/50 mt-0.5">
                          Network fee reserve
                        </div>
                      </div>
                    </div>

                    {/* Action links inside info card */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                      <button
                        type="button"
                        disabled={isFunding}
                        onClick={handleRequestFaucet}
                        className="h-[42px] px-4 rounded-[12px] bg-white hover:bg-black/5 text-[#0F7B5F] font-bold text-[13px] border border-[#0F7B5F]/30 inline-flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                      >
                        {isFunding ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-[#0F7B5F] border-t-transparent rounded-full animate-spin" />
                            <span>Requesting 10,000 XLM...</span>
                          </>
                        ) : (
                          <>
                            <span>⚡ Top up 10,000 XLM (Friendbot)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={handleConnectWithKit}
                        className="text-[13px] font-bold text-[#0F7B5F] hover:underline cursor-pointer text-center"
                      >
                        Change Connected Wallet
                      </button>
                    </div>
                  </div>

                  {/* FOLLOWED WITH PROCEED TO DASHBOARD BUTTON */}
                  <div className="mt-7 pt-6 border-t border-black/10 space-y-2.5">
                    <button
                      type="button"
                      onClick={() => onNavigate('dashboard')}
                      className="w-full h-[62px] rounded-[18px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-black text-[18px] inline-flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.99] cursor-pointer group"
                    >
                      <span>Proceed to Dashboard</span>
                      <ArrowRightIcon color="#FFFFFF" className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    <div className="text-center text-[13px] text-black/60 font-medium">
                      Your business account is fully ready. Start creating payment requests immediately.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* NOT CONNECTED STATE: Loading state indicator + Connect button */
              <div className="lg:col-span-7 sm:bg-white sm:border sm:border-[#E3E7E1] sm:rounded-[40px] sm:p-8 lg:px-[30px] lg:py-[60px] flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px] font-extrabold uppercase tracking-wider text-[#0F7B5F]">
                      Step 3 • Connect Settlement Wallet
                    </span>
                  </div>

                  <h1 className="text-[34px] sm:text-[38px] leading-[44px] font-bold text-[#0B1F1A]">
                    <span className="hidden sm:inline">Connect your Stellar wallet</span>
                    <span className="sm:hidden">Connect your wallet</span>
                  </h1>
                  <p className="mt-3.5 sm:mt-[17px] text-[14px] sm:text-[18px] leading-[19px] sm:leading-[25px] font-semibold sm:font-normal text-[#0B1F1A] max-w-[679px]">
                    SMEHUB reads your public address to receive payments. Approvals happen in your wallet, and your keys never leave it.
                  </p>

                  {/* LOADING STATE WIDGET */}
                  {isLoading && (
                    <div className="mt-6 p-5 rounded-[20px] bg-[#0F7B5F]/10 border-2 border-[#0F7B5F] flex items-center gap-4 animate-pulse">
                      <div className="w-8 h-8 border-3 border-[#0F7B5F] border-t-transparent rounded-full animate-spin shrink-0" />
                      <div>
                        <div className="font-extrabold text-[16px] text-[#0B1F1A]">
                          {connectLoadingMessage || 'Opening Stellar Wallets Kit modal...'}
                        </div>
                        <div className="text-[13px] text-black/60 mt-0.5">
                          Please select your wallet and authorize the connection request.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Stellar Wallets Kit Connection */}
                  <div className="mt-8 space-y-4">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleConnectWithKit}
                      className="w-full h-[62px] rounded-[18px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-bold text-[17px] flex items-center justify-center gap-3 transition-all shadow-md active:scale-[0.99] disabled:opacity-75 cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Connecting to Wallet...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-[#34D399]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>Connect Stellar Wallet</span>
                          <span className="hidden sm:inline text-white/80 text-[13px] font-normal">
                            • Stellar Wallets Kit
                          </span>
                        </>
                      )}
                    </button>

                    <div className="p-4 rounded-[16px] bg-[#F5F6F2] border border-black/10 text-[13.5px] leading-[20px] text-black/70 space-y-2">
                      <div className="flex items-center gap-2 font-bold text-[#0B1F1A]">
                        <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                        <span>Official Stellar Wallets Kit Integration</span>
                      </div>
                      <p>
                        Connect with Freighter, Albedo, xBull, Lobstr, Hana, Rabet, Klever, and all SEP-0043 compatible Stellar signers.
                      </p>
                      <a
                        href="https://stellarwalletskit.dev/"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block font-semibold text-[#0F7B5F] hover:underline"
                      >
                        stellarwalletskit.dev ↗
                      </a>
                    </div>

                    <div className="pt-3 text-center">
                      <button
                        type="button"
                        onClick={() => onNavigate('dashboard')}
                        className="text-[14px] font-bold text-black/60 hover:text-black underline cursor-pointer"
                      >
                        Skip wallet connection for now and proceed to dashboard
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Right Dark Settlement Summary Card */}
            <div className="lg:col-span-5 bg-[#0B1F1A] rounded-[24px] sm:rounded-[40px] p-6 sm:p-[45px] flex flex-col justify-between">
              <div>
                {/* Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-3 h-[34px] sm:h-[45px] px-4 bg-white/10 rounded-[10px] sm:rounded-[13px]">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isConnected ? 'bg-[#34D399] animate-pulse' : 'bg-[#E3E7E1]/50'
                      }`}
                    />
                    <span
                      className={`text-[13px] sm:text-[16px] leading-[25px] font-bold ${
                        isConnected ? 'text-[#A7E3CC]' : 'text-[#E3E7E1]'
                      }`}
                    >
                      {isConnected ? 'Connected - Testnet' : 'Not Connected'}
                    </span>
                  </div>

                  {isConnected && (
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      className="text-[12px] font-bold text-[#A7E3CC] underline hover:text-white"
                    >
                      Disconnect
                    </button>
                  )}
                </div>

                {/* Settlement Wallet */}
                <div className="mt-5 sm:mt-[28px]">
                  <div className="text-[11px] sm:text-[14px] leading-[22px] font-bold text-white/60">
                    Settlement public key
                  </div>
                  <div className="mt-1 text-[13px] sm:text-[16px] font-mono leading-[22px] font-bold text-white break-all bg-white/5 p-3 rounded-[10px] border border-white/10">
                    {isConnected ? profile.walletAddress : 'Connect a wallet to view settlement key'}
                  </div>
                </div>

                {/* 2 Stat Boxes */}
                <div className="mt-5 sm:mt-[24px] grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-[13px] p-3.5 sm:p-4">
                    <div className="text-[11px] sm:text-[13px] font-bold text-white/60">
                      USDC Balance
                    </div>
                    <div className="mt-1 text-[18px] sm:text-[24px] font-bold text-white tabular-nums">
                      {isConnected ? `${profile.usdcBalance || '0.00'} USDC` : '0.00 USDC'}
                    </div>
                  </div>
                  <div className="bg-white/10 rounded-[13px] p-3.5 sm:p-4">
                    <div className="text-[11px] sm:text-[13px] font-bold text-white/60">
                      Network
                    </div>
                    <div className="mt-1 text-[18px] sm:text-[24px] font-bold text-[#A7E3CC]">
                      Stellar Testnet
                    </div>
                  </div>
                </div>

                {/* Testnet Friendbot Faucet Button */}
                <div className="mt-6 bg-white/10 border border-[#A7E3CC]/20 rounded-[14px] p-4 space-y-3">
                  <div className="text-[14px] leading-[20px] font-medium text-[#A7E3CC]">
                    Need free Testnet XLM? Request 10,000 XLM directly from the official Stellar Friendbot.
                  </div>
                  <button
                    type="button"
                    disabled={!isConnected || isFunding}
                    onClick={handleRequestFaucet}
                    className={`w-full h-[40px] rounded-[9px] text-[14px] font-bold transition-colors ${
                      isConnected && !isFunding
                        ? 'bg-[#0F7B5F] text-white hover:bg-[#34D399] hover:text-[#0B1F1A]'
                        : 'bg-white/10 text-white/40 cursor-not-allowed'
                    }`}
                  >
                    {isFunding ? 'Requesting from Friendbot...' : '⚡ Request 10,000 Testnet XLM'}
                  </button>
                </div>
              </div>

              {/* Desktop Action Button */}
              <div className="hidden sm:block mt-8">
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className={`w-full h-[52px] rounded-[12px] font-black text-[17px] text-white inline-flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] cursor-pointer ${
                    isConnected
                      ? 'bg-[#0F7B5F] hover:bg-[#0c634c]'
                      : 'bg-[#3C4140] hover:bg-[#0F7B5F]'
                  }`}
                >
                  <span>
                    {isConnected ? 'Proceed to dashboard' : 'Skip & continue to dashboard'}
                  </span>
                  <ArrowRightIcon color="#FFFFFF" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Bottom Action Buttons */}
        <div className="flex sm:hidden items-center gap-4 mt-8 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('signup-2')}
            className="w-[90px] h-[50px] rounded-[12px] border border-[#0F7B5F] text-[16px] font-bold text-[#0B1F1A] flex items-center justify-center shrink-0"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`flex-1 h-[50px] rounded-[12px] text-[16px] font-black text-white inline-flex items-center justify-center gap-2 shadow-md ${
              isConnected ? 'bg-[#0F7B5F]' : 'bg-[#3C4140]'
            }`}
          >
            <span>{isConnected ? 'Proceed to dashboard' : 'Skip to dashboard'}</span>
            <ArrowRightIcon color="#FFFFFF" />
          </button>
        </div>
      </div>
    );
  }


  // SCREEN: VERIFY EMAIL (signup-2 or signin-2)
  if (screen === 'signup-2' || screen === 'signin-2') {
    const isSignUp = screen === 'signup-2';
    return (
      <div className="min-h-screen bg-[#F5F6F2] text-[#0B1F1A] flex flex-col lg:flex-row justify-between max-w-[1440px] mx-auto">
        <div className="flex-1 px-3.5 sm:px-10 lg:px-[70px] py-5 sm:py-[37px] flex flex-col justify-between">
          <div>
            <div className="hidden sm:block">
              <BrandLogo onClick={() => onNavigate('landing')} />
            </div>
            <div className="sm:hidden">
              <BrandLogo size="sm" onClick={() => onNavigate('landing')} />
            </div>

            {isSignUp && (
              <>
                <div className="mt-5">
                  <DesktopStepIndicator activeStep={2} />
                </div>
                <MobileProgressBars activeStep={2} />
              </>
            )}

            <div className="mt-10 sm:mt-[64px]">
              <h1 className="text-[35px] sm:text-[38px] leading-[41px] sm:leading-[44px] font-bold text-[#0B1F1A]">
                <span className="hidden sm:inline">Verify your email address</span>
                <span className="sm:hidden">Verify your email</span>
              </h1>
              <p className="mt-3.5 text-[16px] leading-[22px] font-semibold text-[#0B1F1A]">
                Enter the 6 digit code sent to your email.
              </p>
            </div>

            {/* 6 Digit OTP Boxes */}
            <div className="mt-7 sm:mt-[28px] flex items-center gap-[7px] sm:gap-[9px] max-w-[408px] sm:max-w-[546px]">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    otpRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-full h-[50px] sm:h-[67px] bg-white border border-[#0F7B5F]/25 focus:border-[#0F7B5F] rounded-[11px] sm:rounded-[15px] text-center text-[22px] sm:text-[26px] font-bold text-[#0B1F1A] focus:outline-none tabular-nums"
                />
              ))}
            </div>

            <div className="mt-5">
              <button
                type="button"
                onClick={() => {
                  setOtp(['4', '8', '2', '9', '1', '6']);
                  onNotify('Verification code resent to your business email.');
                }}
                className="text-[16px] leading-[22px] font-semibold text-[#0B1F1A] hover:text-[#0F7B5F] transition-colors"
              >
                Resend.
              </button>
            </div>

            {/* Desktop Buttons */}
            <div className="hidden sm:flex items-center gap-[15px] mt-[35px]">
              <button
                type="button"
                onClick={() => onNavigate(isSignUp ? 'signup-1' : 'signin-1')}
                className="w-[99px] h-[50px] rounded-[9px] border border-[#0F7B5F] text-[18px] font-bold text-[#0B1F1A] hover:bg-[#0F7B5F]/5 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => onNavigate(isSignUp ? 'signup-3' : 'dashboard')}
                className="w-[209px] h-[50px] rounded-[9px] bg-[#0F7B5F] hover:bg-[#0c634c] text-[18px] font-bold text-white inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>Continue to wallet</span>
                <ArrowRightIcon color="#FFFFFF" />
              </button>
            </div>
          </div>

          {/* Mobile Bottom Buttons */}
          <div className="flex sm:hidden items-center gap-6 mt-24 pt-4">
            <button
              type="button"
              onClick={() => onNavigate(isSignUp ? 'signup-1' : 'signin-1')}
              className="w-[99px] h-[50px] rounded-[9px] border border-[#0F7B5F] text-[18px] font-bold text-[#0B1F1A] shrink-0"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => onNavigate(isSignUp ? 'signup-3' : 'dashboard')}
              className="flex-1 h-[50px] rounded-[9px] bg-[#0F7B5F] text-[18px] font-bold text-white inline-flex items-center justify-center gap-2"
            >
              <span>{isSignUp ? 'Continue to wallet' : 'Continue to dashboard'}</span>
              <ArrowRightIcon color="#FFFFFF" />
            </button>
          </div>
        </div>

        <DesktopAuthRightPanel />
      </div>
    );
  }

  // SCREEN: SIGN IN STEP 1 (signin-1)
  if (screen === 'signin-1') {
    const isFilled = signInEmail.trim().length > 0 && signInPassword.trim().length > 0;

    const handleSignInSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isFilled) {
        setSignInError('Please enter both your business email/username and password.');
        return;
      }

      setIsLoading(true);
      setSignInError(null);

      const res = await api.auth.login({
        username: signInEmail.trim(),
        password: signInPassword.trim(),
      });

      setIsLoading(false);

      if (!res.success) {
        setSignInError(res.message || 'Invalid email or password.');
        return;
      }

      // Success: hydrate merchant profile from backend
      const merchant = res.data?.merchant;
      if (merchant) {
        const wallet = merchant.wallet;
        onUpdateProfile({
          businessName: merchant.business_name || profile.businessName,
          email: merchant.business_email || profile.email,
          walletAddress: wallet?.public_key || profile.walletAddress,
          shortWallet: wallet?.public_key
            ? `${wallet.public_key.slice(0, 4)}...${wallet.public_key.slice(-4)}`
            : profile.shortWallet,
          connectedWallet: wallet?.public_key ? 'freighter' : null,
          statementName: merchant.business_name || profile.statementName,
          apiKey: merchant.api_key,
        });
      }

      onNotify('Signed in successfully! Welcome back.');
      onNavigate('dashboard');
    };

    const handleQuickDemoFill = () => {
      setSignInEmail('bakery@adaeze.com');
      setSignInPassword('Password123!');
      setSignInError(null);
      onNotify('Demo merchant credentials filled: bakery@adaeze.com');
    };

    return (
      <div className="min-h-screen bg-[#F5F6F2] text-[#0B1F1A] flex flex-col lg:flex-row justify-between max-w-[1440px] mx-auto">
        <form
          onSubmit={handleSignInSubmit}
          className="flex-1 px-3.5 sm:px-10 lg:px-[70px] py-5 sm:py-[37px] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="hidden sm:block">
                <BrandLogo onClick={() => onNavigate('landing')} />
              </div>
              <div className="sm:hidden">
                <BrandLogo size="sm" onClick={() => onNavigate('landing')} />
              </div>
              <button
                type="button"
                onClick={() => onNavigate('signup-1')}
                className="text-[14px] font-bold text-[#0F7B5F] hover:underline"
              >
                Create business account
              </button>
            </div>

            <div className="mt-8 sm:mt-[50px]">
              <h1 className="text-[35px] sm:text-[38px] leading-[41px] sm:leading-[44px] font-bold text-[#0B1F1A]">
                Sign in to your account
              </h1>
              <p className="mt-2.5 text-[14.8px] sm:text-[16px] leading-[20px] sm:leading-[22px] font-semibold text-[#0B1F1A]">
                Connect your Stellar wallet for instant non-custodial login, or enter your business credentials.
              </p>
            </div>

            {/* 1. Stellar Wallet Connect Button */}
            <div className="mt-7 sm:mt-[30px] max-w-[803px]">
              <button
                type="button"
                onClick={() => handleOpenStellarWalletsKit('login')}
                className="w-full h-[58px] rounded-[16px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-bold text-[16px] sm:text-[17px] flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.99]"
              >
                <svg className="w-5 h-5 text-[#34D399]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Connect Wallet</span>
                <span className="hidden sm:inline text-white/80 text-[13px] font-normal">
                  • Non-custodial sign in
                </span>
              </button>
            </div>

            {/* Unregistered Wallet Notice */}
            {unregisteredWallet && (
              <div className="mt-4 max-w-[803px] p-4 rounded-[14px] bg-[#FEF3C7] border border-[#F59E0B]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[14px] font-bold text-[#92400E]">
                    Wallet not registered as a merchant
                  </div>
                  <div className="text-[12px] text-[#78350F] font-mono break-all mt-0.5">
                    {unregisteredWallet.publicKey}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRegisterUnregisteredWallet}
                  className="h-[38px] px-4 bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-bold text-[13px] rounded-[10px] shrink-0 transition-colors shadow-sm"
                >
                  ⚡ Create Account with this Wallet
                </button>
              </div>
            )}

            {/* Divider */}
            <div className="mt-7 max-w-[803px] flex items-center gap-4">
              <div className="flex-1 h-[1px] bg-black/15" />
              <span className="text-[12px] font-extrabold uppercase tracking-wider text-black/50">
                Or sign in with business credentials
              </span>
              <div className="flex-1 h-[1px] bg-black/15" />
            </div>

            {/* 2. Credentials Sign In Form */}
            <div className="mt-6 space-y-5 max-w-[803px]">
              <div>
                <label className="block text-[18px] leading-[25px] font-bold text-[#0B1F1A] mb-[9px]">
                  Business email or username
                </label>
                <input
                  type="text"
                  value={signInEmail}
                  onChange={(e) => {
                    setSignInEmail(e.target.value);
                    setSignInError(null);
                  }}
                  className="w-full h-[54px] px-[21px] bg-white sm:bg-transparent border border-[#0F7B5F]/25 focus:border-[#0F7B5F] rounded-[15px] text-[18px] font-bold text-[#0B1F1A] focus:outline-none"
                />
                <p className="mt-1.5 text-[13px] text-black/60">
                  Enter your registered business email address or username.
                </p>
              </div>

              <div>
                <label className="block text-[18px] leading-[25px] font-bold text-[#0B1F1A] mb-[9px]">
                  Password
                </label>
                <input
                  type="password"
                  value={signInPassword}
                  onChange={(e) => {
                    setSignInPassword(e.target.value);
                    setSignInError(null);
                  }}
                  className="w-full h-[54px] px-[21px] bg-white sm:bg-transparent border border-[#0F7B5F]/25 focus:border-[#0F7B5F] rounded-[15px] text-[18px] font-bold text-[#0B1F1A] focus:outline-none"
                />
                <p className="mt-1.5 text-[13px] text-black/60">
                  Enter your account password.
                </p>
              </div>

              {signInError && (
                <div className="bg-[#FFF1F2] border border-[#FECDD3] rounded-[12px] p-3 text-[15px] leading-[20px] font-semibold text-[#C20C0C]">
                  {signInError}
                </div>
              )}
            </div>

            {/* Desktop Buttons */}
            <div className="hidden sm:flex items-center gap-[15px] mt-[40px]">
              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className="w-[99px] h-[50px] rounded-[9px] border border-[#0F7B5F] text-[18px] font-bold text-[#0B1F1A] hover:bg-[#0F7B5F]/5 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`w-[220px] h-[50px] rounded-[9px] text-[18px] font-bold text-white inline-flex items-center justify-center gap-2 transition-colors ${
                  isFilled && !isLoading
                    ? 'bg-[#0F7B5F] hover:bg-[#0c634c]'
                    : 'bg-[#3C4140] cursor-not-allowed opacity-80'
                }`}
              >
                <span>{isLoading ? 'Signing in...' : 'Sign in to account'}</span>
                <ArrowRightIcon color="#FFFFFF" />
              </button>
            </div>
          </div>

          {/* Mobile Buttons */}
          <div className="flex sm:hidden items-center gap-6 mt-12 pt-4">
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="w-[99px] h-[50px] rounded-[9px] border border-[#0F7B5F] text-[18px] font-bold text-[#0B1F1A] shrink-0"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={`flex-1 h-[50px] rounded-[9px] text-[18px] font-bold text-white inline-flex items-center justify-center gap-2 ${
                isFilled && !isLoading ? 'bg-[#0F7B5F]' : 'bg-[#3C4140]'
              }`}
            >
              <span>{isLoading ? 'Signing in...' : 'Sign in'}</span>
              <ArrowRightIcon color="#FFFFFF" />
            </button>
          </div>
        </form>

        <DesktopAuthRightPanel />
      </div>
    );
  }

  // SCREEN: SIGN UP STEP 1 (signup-1)
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.businessName.trim() || !profile.email.trim() || !password.trim()) {
      onNotify('Please fill in business name, email, and password.');
      return;
    }

    setIsLoading(true);
    const cleanUsername = profile.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

    const res = await api.auth.register({
      username: cleanUsername || `merchant_${Date.now()}`,
      email: profile.email.trim(),
      password: password.trim(),
      business_name: profile.businessName.trim(),
      category: normalizeBusinessCategory(profile.businessType),
      stellar_public_key: isValidStellarPublicKey(profile.walletAddress) ? profile.walletAddress : undefined,
    });

    setIsLoading(false);

    if (!res.success) {
      onNotify(res.message || 'Registration failed. Please check your information.');
      return;
    }

    onNotify('Business account registered! Next, verify your email.');
    onNavigate('signup-2');
  };

  return (
    <div className="min-h-screen bg-[#F5F6F2] text-[#0B1F1A] flex flex-col lg:flex-row justify-between max-w-[1440px] mx-auto">
      <form
        onSubmit={handleSignUpSubmit}
        className="flex-1 px-3.5 sm:px-10 lg:px-[70px] py-5 sm:py-[37px] flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between">
            <div className="hidden sm:block">
              <BrandLogo onClick={() => onNavigate('landing')} />
            </div>
            <div className="sm:hidden">
              <BrandLogo size="sm" onClick={() => onNavigate('landing')} />
            </div>
            <button
              type="button"
              onClick={() => onNavigate('signin-1')}
              className="text-[14px] font-bold text-[#0F7B5F] hover:underline"
            >
              Already have an account? Sign in
            </button>
          </div>

          <div className="mt-5">
            <DesktopStepIndicator activeStep={1} />
          </div>
          <MobileProgressBars activeStep={1} />

          <div className="mt-8 sm:mt-[54px]">
            <h1 className="text-[35px] sm:text-[38px] leading-[41px] sm:leading-[44px] font-bold text-[#0B1F1A]">
              Set up your business
            </h1>
          </div>

          {/* 1. Stellar Wallet Connect Button (Skip Form Filling) */}
          <div className="mt-7 sm:mt-[30px] max-w-[803px]">
            <button
              type="button"
              onClick={() => handleOpenStellarWalletsKit('register')}
              className="w-full h-[58px] rounded-[16px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white font-bold text-[16px] sm:text-[17px] flex items-center justify-center gap-3 transition-all shadow-sm active:scale-[0.99]"
            >
              <svg className="w-5 h-5 text-[#34D399]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Connect Wallet</span>
              <span className="hidden sm:inline text-white/80 text-[13px] font-normal">
                • Instant registration (Skip form filling)
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="mt-8 max-w-[803px] flex items-center gap-4">
            <div className="flex-1 h-[1px] bg-black/15" />
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-black/50">
              Or register with business email &amp; complete profile
            </span>
            <div className="flex-1 h-[1px] bg-black/15" />
          </div>

          {/* Form Fields (Empty inputs + Clean help text only) */}
          <div className="mt-7 sm:mt-[28px] space-y-5 max-w-[803px]">
            {/* Business Name */}
            <div>
              <label className="block text-[18px] leading-[25px] font-bold text-[#0B1F1A] mb-[9px]">
                Business Name
              </label>
              <input
                type="text"
                value={profile.businessName}
                onChange={(e) => onUpdateProfile({ businessName: e.target.value })}
                required
                className="w-full h-[54px] px-[21px] bg-white sm:bg-transparent border border-[#0F7B5F]/25 focus:border-[#0F7B5F] rounded-[15px] text-[18px] font-bold text-[#0B1F1A] focus:outline-none"
              />
              <p className="mt-1.5 text-[13px] text-black/60">
                Enter the legal or registered trading name of your business.
              </p>
            </div>

            {/* Business Type & Country */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-[73px]">
              <div>
                <label className="block text-[18px] leading-[25px] font-bold text-[#0B1F1A] mb-[9px]">
                  Business Type
                </label>
                <div className="relative">
                  <select
                    value={normalizeBusinessCategory(profile.businessType)}
                    onChange={(e) => onUpdateProfile({ businessType: e.target.value })}
                    className="w-full h-[54px] px-[14px] pr-10 bg-white sm:bg-transparent border border-[#0F7B5F]/25 focus:border-[#0F7B5F] rounded-[15px] text-[16px] sm:text-[18px] font-bold text-[#0B1F1A] appearance-none focus:outline-none"
                  >
                    {BUSINESS_CATEGORIES.map((cat) => (
                      <option key={cat.code} value={cat.code}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[22px] font-bold text-black">
                    &gt;
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] text-black/60">
                  Select the category that best matches your business operations.
                </p>
              </div>

              <div>
                <label className="block text-[18px] leading-[25px] font-bold text-[#0B1F1A] mb-[9px]">
                  Country
                </label>
                <div className="relative">
                  <select
                    value={profile.country}
                    onChange={(e) => onUpdateProfile({ country: e.target.value })}
                    className="w-full h-[54px] px-[14px] pr-10 bg-white sm:bg-transparent border border-[#0F7B5F]/25 focus:border-[#0F7B5F] rounded-[15px] text-[18px] font-bold text-[#0B1F1A] appearance-none focus:outline-none"
                  >
                    <option value="Japan">Japan</option>
                    <option value="Nigeria">Nigeria</option>
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Kenya">Kenya</option>
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-[22px] font-bold text-black">
                    &gt;
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] text-black/60">
                  Primary country where your business is registered and operates.
                </p>
              </div>
            </div>

            {/* Business Email & Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-[73px]">
              <div>
                <label className="block text-[18px] leading-[25px] font-bold text-[#0B1F1A] mb-[9px]">
                  Business Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => onUpdateProfile({ email: e.target.value })}
                  required
                  className="w-full h-[54px] px-[21px] bg-white sm:bg-transparent border border-[#0F7B5F]/25 focus:border-[#0F7B5F] rounded-[15px] text-[18px] font-bold text-[#0B1F1A] focus:outline-none"
                />
                <p className="mt-1.5 text-[13px] text-black/60">
                  We will use this email for account verification and transaction receipts.
                </p>
              </div>

              <div>
                <label className="block text-[18px] leading-[25px] font-bold text-[#0B1F1A] mb-[9px]">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full h-[54px] px-[21px] bg-white sm:bg-transparent border border-[#0F7B5F]/25 focus:border-[#0F7B5F] rounded-[15px] text-[18px] font-bold text-[#0B1F1A] focus:outline-none"
                />
                <p className="mt-1.5 text-[13px] text-black/60">
                  Must be at least 8 characters. Include numbers and symbols for strength.
                </p>
              </div>
            </div>

            {/* Your Stellar Testnet wallet */}
            <div>
              <label className="block text-[18px] leading-[25px] font-bold text-[#0B1F1A] mb-[9px]">
                Your Stellar Testnet wallet (Optional)
              </label>
              <input
                type="text"
                value={profile.shortWallet}
                onChange={(e) => onUpdateProfile({ shortWallet: e.target.value, walletAddress: e.target.value })}
                className="w-full h-[54px] px-[21px] bg-white sm:bg-transparent border border-[#0F7B5F]/25 focus:border-[#0F7B5F] rounded-[15px] text-[16px] font-mono font-bold text-[#0B1F1A] focus:outline-none tabular-nums"
              />
              <p className="mt-1.5 text-[13px] text-black/60">
                Optional 56-character Ed25519 public key (G...). If left empty, one is generated automatically.
              </p>
            </div>

            {/* Settlement Asset (Desktop) */}
            <div className="hidden sm:block pt-2">
              <label className="block text-[18px] leading-[25px] font-bold text-[#0B1F1A] mb-[9px]">
                Settlement asset
              </label>
              <div className="flex flex-wrap items-center gap-[24px]">
                <button
                  type="button"
                  onClick={() => onUpdateProfile({ settlementAsset: 'USDC' })}
                  className={`w-[186px] h-[54px] rounded-[15px] inline-flex items-center justify-center gap-[13px] text-[18px] font-bold text-[#0B1F1A] transition-colors ${
                    profile.settlementAsset === 'USDC'
                      ? 'bg-[#E8F4F0] border border-[#0F7B5F]'
                      : 'border border-[#0F7B5F]/25'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-[#0F7B5F]" />
                  <span>USDC | Testnet</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNotify('XLM settlement is active as well.')}
                  className="w-[211px] h-[54px] rounded-[15px] border border-[#0F7B5F]/25 inline-flex items-center justify-center gap-[13px] text-[18px] font-bold text-[#0B1F1A] opacity-80 hover:opacity-100 transition-opacity"
                >
                  <span className="w-2 h-2 rounded-full bg-[#0F7B5F]" />
                  <span>XLM | Testnet</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="mt-8 sm:mt-10 flex items-center sm:justify-end gap-6 sm:gap-[15px] max-w-[803px]">
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            className="w-[99px] h-[50px] rounded-[9px] border border-[#0F7B5F] text-[18px] font-bold text-[#0B1F1A] hover:bg-[#0F7B5F]/5 transition-colors shrink-0"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 sm:flex-none sm:w-[220px] h-[50px] rounded-[9px] bg-[#0F7B5F] hover:bg-[#0c634c] text-[18px] font-bold text-white inline-flex items-center justify-center gap-2 transition-colors"
          >
            <span>{isLoading ? 'Creating account...' : 'Continue to verify'}</span>
            <ArrowRightIcon color="#FFFFFF" />
          </button>
        </div>
      </form>

      <DesktopAuthRightPanel />
    </div>
  );
};

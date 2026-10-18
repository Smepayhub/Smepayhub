import React, { useState } from 'react';
import { ScreenId } from '../types';
import {
  BrandLogo,
  QrCodeSvg,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BarcodePlaceholderIcon,
} from './Icons';
import { authStorage } from '../services/api';

interface LandingPageProps {
  onNavigate: (screen: ScreenId) => void;
  onNotify: (msg: string) => void;
}

const FAQ_ITEMS = [
  {
    q: 'What is SMEHUB?',
    a: 'Keep payment reference and transaction status easy to find. SMEHUB is a non-custodial business platform for creating Stellar USDC payment requests and tracking every transaction.',
  },
  {
    q: 'How does a customer pay?',
    a: 'Customers scan your QR code or open your payment link, connect a Stellar wallet like Freighter, Albedo, or Trust Wallet, and approve the exact USDC amount.',
  },
  {
    q: 'What is Stellar?',
    a: 'Stellar is a fast, low-cost decentralized network built for digital payments and cross-border asset settlement within seconds.',
  },
  {
    q: 'What is USDC?',
    a: 'USDC is a fully reserved digital dollar stablecoin. On SMEHUB MVP, you use Stellar Testnet USDC from a testnet faucet.',
  },
  {
    q: 'Do I need a crypto wallet?',
    a: 'Yes. Because SMEHUB is non-custodial by design, payments settle directly into your own Stellar wallet and we never hold your funds or secret phrase.',
  },
  {
    q: 'Is SMEHUB currently on testnet?',
    a: 'Yes. SMEHUB is currently running on Stellar Testnet with test USDC. No real funds move during the MVP.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, onNotify }) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [previewFilter, setPreviewFilter] = useState<'All' | 'Completed' | 'Pending' | 'Failed'>('All');
  const [singleUseDemo, setSingleUseDemo] = useState(true);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F2] text-[#0B1F1A] overflow-x-hidden">
      {/* Top Bar */}
      <header className="max-w-[1512px] mx-auto px-5 sm:px-10 lg:px-[120px] pt-6 sm:pt-[36px] pb-4 flex items-center justify-between gap-4">
        <BrandLogo onClick={() => onNavigate('landing')} />

        <nav className="hidden md:flex items-center gap-[35px]">
          <button
            type="button"
            onClick={() => scrollToSection('how-it-works')}
            className="text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]/60 hover:text-[#0B1F1A] transition-colors whitespace-nowrap"
          >
            How it works
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('features')}
            className="text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]/60 hover:text-[#0B1F1A] transition-colors whitespace-nowrap"
          >
            Features
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('faqs')}
            className="text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]/60 hover:text-[#0B1F1A] transition-colors whitespace-nowrap"
          >
            FAQs
          </button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-[15px] shrink-0">
          {authStorage.getToken() ? (
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="h-[44px] sm:h-[50px] px-5 bg-[#0F7B5F] hover:bg-[#0c634c] text-white rounded-[9px] font-bold text-[15px] sm:text-[17px] inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shadow-sm"
            >
              <span>Go to Dashboard</span>
              <ArrowRightIcon color="#FFFFFF" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onNavigate('signin-1')}
                className="h-[44px] sm:h-[50px] px-4 sm:w-[99px] rounded-[9px] text-[16px] sm:text-[18px] font-bold text-[#0B1F1A]/60 hover:text-[#0B1F1A] hover:bg-black/5 transition-colors whitespace-nowrap"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => onNavigate('signup-1')}
                className="h-[44px] sm:h-[50px] px-4 sm:w-[151px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white rounded-[9px] font-bold text-[16px] sm:text-[18px] inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <span>Get started</span>
                <ArrowRightIcon color="#FFFFFF" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-[1512px] mx-auto px-5 sm:px-10 lg:px-[120px] pt-10 lg:pt-[104px] pb-16 lg:pb-[100px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-start">
          {/* Left Hero Copy */}
          <div className="lg:col-span-6 lg:pt-2">
            <h1 className="text-[40px] sm:text-[52px] lg:text-[62px] font-extrabold leading-[1.15] lg:leading-[72px] text-black max-w-[537px] tracking-tight">
              A simpler way to accept digital payments.
            </h1>
            <p className="mt-6 lg:mt-[42px] text-[18px] sm:text-[20px] leading-[27px] font-bold text-[#0B1F1A]/60 max-w-[537px]">
              Create payment requests, receive USDC on Stellar, and track every transaction from one simple business platform.
            </p>
            <div className="mt-8 lg:mt-[55px] flex flex-wrap items-center gap-[15px]">
              <button
                type="button"
                onClick={() => onNavigate('signup-1')}
                className="w-[151px] h-[50px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white rounded-[9px] font-bold text-[18px] inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <span>Get started</span>
                <ArrowRightIcon color="#FFFFFF" />
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="w-[137px] h-[50px] border border-[#0F7B5F] hover:bg-[#0F7B5F]/5 text-[#0B1F1A] rounded-[9px] font-bold text-[18px] inline-flex items-center justify-center transition-colors whitespace-nowrap"
              >
                How it works
              </button>
            </div>
          </div>

          {/* Right Floating Scan to Pay Card */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-[617px] bg-white border border-[#E3E7E1] rounded-[32px] sm:rounded-[40px] shadow-[-7px_7px_80.7px_23px_rgba(0,0,0,0.22)] p-6 sm:px-8 sm: pt-9 sm:pb-12 flex flex-col items-center relative">
              <div className="w-full flex items-center justify-between">
                <span className="text-[18px] leading-[21px] font-extrabold text-[#0B1F1A]">
                  Scan to pay
                </span>
                <div className="h-[27px] px-3 bg-[#F3DFA5] rounded-[9px] inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#7A4B00]" />
                  <span className="text-[11px] leading-[13px] font-semibold text-[#0B1F1A] whitespace-nowrap">
                    Waiting for payment
                  </span>
                </div>
              </div>

              <div
                onClick={() => onNavigate('customer-checkout')}
                title="Click to preview customer checkout"
                className="mt-10 sm:mt-[118px] cursor-pointer group transition-transform hover:scale-[1.02]"
              >
                <QrCodeSvg size={256} />
              </div>

              <div className="mt-8 sm:mt-[35px] text-[34px] sm:text-[38px] leading-[52px] font-bold text-black tabular-nums">
                25.00 USDC
              </div>
              <div className="mt-3 text-[16px] leading-[22px] font-bold text-[#0B1F1A]/70">
                Description: Birthday cake
              </div>
              <div className="mt-6 sm:mt-[31px] text-[14px] leading-[19px] font-bold text-[#0B1F1A]/70 text-center">
                Expires in 27:14. Refreshes if the request is still open.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: How It Works — 3 Steps */}
      <section
        id="how-it-works"
        className="max-w-[1512px] mx-auto px-5 sm:px-10 lg:px-[120px] pt-12 lg:pt-[80px] pb-20"
      >
        <h2 className="text-[34px] sm:text-[44px] lg:text-[48px] font-extrabold leading-[1.15] lg:leading-[55px] text-black max-w-[907px]">
          From request to confirmation in three steps.
        </h2>

        {/* 3 Stepper Pills + Lines on Desktop */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-[63px] mt-[56px]">
          <div className="flex items-center gap-[7px]">
            <div className="w-[59px] h-[44px] rounded-[50px] bg-[#0F7B5F] flex items-center justify-center shrink-0">
              <span className="text-[33px] leading-[38px] font-bold text-white tabular-nums">01</span>
            </div>
            <div className="h-0 flex-1 border-t-[4px] border-[#0F7B5F]" />
          </div>
          <div className="flex items-center gap-[7px]">
            <div className="w-[59px] h-[44px] rounded-[50px] bg-[#0F7B5F]/80 flex items-center justify-center shrink-0">
              <span className="text-[33px] leading-[38px] font-bold text-white tabular-nums">02</span>
            </div>
            <div className="h-0 flex-1 border-t-[4px] border-[#0F7B5F]/80" />
          </div>
          <div className="flex items-center gap-[7px]">
            <div className="w-[59px] h-[44px] rounded-[50px] bg-[#0F7B5F]/40 flex items-center justify-center shrink-0">
              <span className="text-[33px] leading-[38px] font-bold text-white tabular-nums">03</span>
            </div>
            <div className="h-0 flex-1 border-t-[4px] border-[#0F7B5F]/40" />
          </div>
        </div>

        {/* 3 Step Cards */}
        <div className="mt-10 lg:mt-[55px] grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-8 items-start">
          {/* Step 1 */}
          <div className="flex flex-col">
            <div className="flex lg:hidden items-center gap-3 mb-3">
              <div className="w-[52px] h-[38px] rounded-[50px] bg-[#0F7B5F] flex items-center justify-center">
                <span className="text-[24px] font-bold text-white tabular-nums">01</span>
              </div>
              <div className="h-0 flex-1 border-t-[3px] border-[#0F7B5F]" />
            </div>
            <h3 className="text-[26px] sm:text-[32px] leading-[44px] font-bold text-black">
              Create a payment request
            </h3>

            {/* Card 1 */}
            <div className="mt-6 bg-white border border-[#E3E7E1] rounded-[27px] shadow-[4px_4px_15.9px_rgba(0,0,0,0.25)] p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] leading-[17px] font-bold text-black mb-1.5 truncate">
                    Order of Reference(optional)
                  </label>
                  <div className="h-[34px] px-3 rounded-[6.8px] border border-[#0B1F1A]/40 flex items-center text-[12px] font-bold text-black">
                    ORD-20122
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] leading-[17px] font-bold text-black mb-1.5 truncate">
                    Request expires in
                  </label>
                  <div className="h-[34px] px-3 rounded-[6.8px] border border-[#0B1F1A]/40 flex items-center justify-between text-[12px] font-bold text-black">
                    <span>30 minutes</span>
                    <span className="rotate-90 text-[16px] leading-none select-none">&gt;</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 bg-[#F5F6F2] rounded-[6.8px] p-3 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[13.5px] leading-[18px] font-bold text-black">
                    Single Use
                  </div>
                  <div className="text-[10.8px] leading-[15px] font-medium text-[#0B1F1A] mt-0.5">
                    Closes after the first matched payment
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSingleUseDemo(!singleUseDemo)}
                  aria-label="Toggle Single Use"
                  className={`w-[46px] h-[21px] rounded-full p-0.5 transition-colors relative shrink-0 ${
                    singleUseDemo ? 'bg-[#0F7B5F]' : 'bg-black/40'
                  }`}
                >
                  <span
                    className={`block w-[20px] h-[16px] rounded-full bg-white transition-transform ${
                      singleUseDemo ? 'translate-x-[21px]' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="h-[34px] px-4 rounded-[6px] border border-[#0F7B5F] text-[12px] font-bold text-[#0B1F1A] hover:bg-[#0F7B5F]/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('create-payment')}
                  className="h-[34px] px-4 rounded-[6px] bg-[#0F7B5F] hover:bg-[#0c634c] text-[12px] font-bold text-white inline-flex items-center gap-1.5 transition-colors"
                >
                  <span>Generate link</span>
                  <ArrowRightIcon color="#FFFFFF" className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex flex-col">
            <div className="flex lg:hidden items-center gap-3 mb-3">
              <div className="w-[52px] h-[38px] rounded-[50px] bg-[#0F7B5F]/80 flex items-center justify-center">
                <span className="text-[24px] font-bold text-white tabular-nums">02</span>
              </div>
              <div className="h-0 flex-1 border-t-[3px] border-[#0F7B5F]/80" />
            </div>
            <h3 className="text-[26px] sm:text-[32px] leading-[44px] font-bold text-black">
              share with your customer
            </h3>

            {/* Card 2 */}
            <div
              onClick={() => onNavigate('payment-created')}
              className="mt-4 bg-white border border-[#E3E7E1] rounded-[36.9px] shadow-[3.7px_3.7px_14.4px_rgba(0,0,0,0.25)] p-6 flex flex-col items-center cursor-pointer hover:border-[#0F7B5F]/50 transition-colors"
            >
              <div className="flex items-center gap-5">
                <div className="w-[58px] h-[53.5px] rounded-[8.3px] bg-[#0F7B5F] flex items-center justify-center shrink-0">
                  <span className="text-[16.6px] font-bold text-white">AB</span>
                </div>
                <div>
                  <div className="text-[22px] leading-[26px] font-bold text-[#0B1F1A]">
                    Adaeze Bakery
                  </div>
                  <div className="text-[14.8px] leading-[20px] font-medium text-[#0B1F1A] mt-1">
                    Pay with a stellar wallet
                  </div>
                </div>
              </div>

              <div className="mt-7 text-[14.8px] leading-[20px] font-bold text-[#0B1F1A]">
                Amount payable
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-[35px] leading-[48px] font-bold text-black tabular-nums">
                  25.00
                </span>
                <span className="text-[16.6px] leading-[23px] font-bold text-[#0B1F1A]">
                  USDC
                </span>
              </div>
              <div className="mt-2 text-[14.8px] leading-[20px] font-bold text-[#0B1F1A]">
                Description: Birthday cake
              </div>

              <div className="mt-5 w-full bg-[#F5F6F2] rounded-[9.2px] p-3 flex flex-col items-center">
                <BarcodePlaceholderIcon />
                <div className="mt-2 text-[11px] leading-[15px] font-medium text-[#0B1F1A] text-center">
                  QR code and payment link will appear on the next step.
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex flex-col">
            <div className="flex lg:hidden items-center gap-3 mb-3">
              <div className="w-[52px] h-[38px] rounded-[50px] bg-[#0F7B5F]/40 flex items-center justify-center">
                <span className="text-[24px] font-bold text-white tabular-nums">03</span>
              </div>
              <div className="h-0 flex-1 border-t-[3px] border-[#0F7B5F]/40" />
            </div>
            <h3 className="text-[26px] sm:text-[32px] leading-[44px] font-bold text-black">
              Track your payment
            </h3>

            {/* Card 3 */}
            <div
              onClick={() => onNavigate('history')}
              className="mt-6 bg-white border border-[#E3E7E1] rounded-[27.9px] shadow-[4px_4px_16px_rgba(0,0,0,0.25)] p-5 cursor-pointer hover:border-[#0F7B5F]/50 transition-colors"
            >
              <div className="text-[14.9px] leading-[20px] font-bold text-[#0F7B5F]">
                Completed
              </div>
              <div className="mt-4 text-[14.9px] leading-[20px] font-bold text-[#0B1F1A]/70">
                Amount received
              </div>
              <div className="mt-1 text-[27px] leading-[37px] font-extrabold text-black tabular-nums">
                10.24 USDC
              </div>

              <div className="mt-4 space-y-2 text-[14px] leading-[20px] font-bold border-t border-[#E3E7E1] pt-3">
                <div className="flex justify-between">
                  <span className="text-[#0B1F1A]/70">Reference</span>
                  <span className="text-[#0B1F1A]">Chioma - Order #1024</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0B1F1A]/70">Network</span>
                  <span className="text-[#0B1F1A]">Stellar testnet</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0B1F1A]/70">Fee</span>
                  <span className="text-[#0B1F1A] tabular-nums">0.001 XLM</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#0B1F1A]/70">Date</span>
                  <span className="text-[#0B1F1A]">14 Oct 2026</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Know where every payment stands */}
      <section className="max-w-[1512px] mx-auto px-5 sm:px-10 lg:px-[120px] pt-10 lg:pt-[60px] pb-20">
        <h2 className="text-[34px] sm:text-[44px] lg:text-[48px] font-extrabold leading-[1.15] lg:leading-[55px] text-black max-w-[831px]">
          Know where every payment stands.
        </h2>
        <p className="mt-3 text-[18px] sm:text-[20px] leading-[27px] font-bold text-[#0B1F1A]/60 max-w-[537px]">
          Manage requests and follow transaction processes without unnecessary complexity
        </p>

        {/* Embedded History + Detail Preview */}
        <div className="mt-10 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          {/* Left Embedded App Frame (902.81px equivalent) */}
          <div className="xl:col-span-9 bg-white rounded-[20px] border border-[#E3E7E1] overflow-hidden flex flex-col md:flex-row min-h-[540px] shadow-xs">
            {/* Mini Sidebar */}
            <div className="w-full md:w-[204px] bg-[#0B1F1A] p-4 flex flex-col justify-between shrink-0">
              <div>
                <div className="pb-3 border-b border-[#BFE3D6] flex items-end gap-3">
                  <div className="w-[33px] h-[31px] rounded-[5.6px] bg-[#0F7B5F] flex items-center justify-center text-white font-bold text-[15.6px]">
                    S
                  </div>
                  <span className="text-white font-bold text-[22.5px] leading-none">
                    SMEHUB
                  </span>
                </div>

                <div className="mt-8 space-y-2 text-[11.3px] font-bold text-white">
                  <button
                    type="button"
                    onClick={() => onNavigate('dashboard')}
                    className="w-full text-left px-3 py-2 rounded-[8px] hover:bg-white/5 transition-colors"
                  >
                    Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('create-payment')}
                    className="w-full text-left px-3 py-2 rounded-[8px] hover:bg-white/5 transition-colors"
                  >
                    Payment requests
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('history')}
                    className="w-full text-left px-3 py-2 rounded-[8px] bg-white/10"
                  >
                    Transactions
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('settings')}
                    className="w-full text-left px-3 py-2 rounded-[8px] hover:bg-white/5 transition-colors"
                  >
                    Business settings
                  </button>
                </div>
              </div>

              <div className="mt-8 bg-white/10 rounded-[8.15px] p-3">
                <div className="flex items-center gap-2">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#34D399]" />
                  <span className="text-[11.3px] font-bold text-[#A7E3CC]">
                    Connected - Testnet
                  </span>
                </div>
                <div className="mt-1 text-[13.8px] font-bold text-white tabular-nums">
                  GBDK.........7QXa3
                </div>
              </div>
            </div>

            {/* Mini History Content */}
            <div className="flex-1 p-5 sm:p-6 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-4 mt-4">
                <div>
                  <h3 className="text-[22.5px] leading-[31px] font-extrabold text-black">
                    Transaction History
                  </h3>
                  <p className="text-[10px] leading-[14px] font-bold text-black/60">
                    Every payment matched to its request
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNotify('CSV exported for demonstration transactions.')}
                  className="h-[27px] px-4 rounded-[6.3px] bg-[#F5F6F2] border border-[#0B1F1A]/40 text-[10px] font-bold text-[#0B1F1A]/70 hover:bg-[#E8F4F0] transition-colors"
                >
                  Export CSV
                </button>
              </div>

              {/* Filter & Search Bar */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {(['All', 'Completed', 'Pending', 'Failed'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setPreviewFilter(tab)}
                      className={`h-[24px] px-3 rounded-[8.15px] text-[11.3px] font-bold transition-colors ${
                        previewFilter === tab
                          ? 'bg-black text-[#F5F6F2]'
                          : 'bg-[#F5F6F2] border border-black/40 text-black hover:bg-black/5'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="h-[25px] px-3 rounded-[8.5px] bg-[#F5F6F2] border border-black/40 flex items-center text-[8px] font-bold text-black/60 w-full sm:w-[181px]">
                  Search by customers, reference, or hash
                </div>
              </div>

              {/* Table */}
              <div className="mt-4 bg-[#F5F6F2] border border-[#E3E7E1] rounded-[12.5px] min-h-[340px] overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-black/30 text-[10px] font-bold text-[#0B1F1A]/70">
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">REFERENCE</th>
                      <th className="py-3 px-3">AMOUNT</th>
                      <th className="py-3 px-3">STATUS</th>
                      <th className="py-3 px-3">TRX HASH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/20 text-[10px] font-bold">
                    {[
                      {
                        date: '14 Oct 2026',
                        ref: 'Chioma - Order #1024',
                        amount: '10.24 USDC',
                        status: 'Completed',
                        hash: '8fa2...121daa',
                      },
                      {
                        date: '14 Oct 2026',
                        ref: 'Tunde - Order #22024',
                        amount: '112 USDC',
                        status: 'Failed',
                        hash: '--',
                      },
                      {
                        date: '14 Oct 2026',
                        ref: 'Emmanuel - Order #22024',
                        amount: '42 USDC',
                        status: 'Completed',
                        hash: '8fa2...121daa',
                      },
                    ]
                      .filter((r) => previewFilter === 'All' || r.status === previewFilter)
                      .map((row, idx) => (
                        <tr
                          key={idx}
                          onClick={() => onNavigate('history')}
                          className="cursor-pointer hover:bg-[#E8F4F0]/60 transition-colors"
                        >
                          <td className="py-3.5 px-3 font-medium text-[#0B1F1A]/70 whitespace-nowrap">
                            {row.date}
                          </td>
                          <td className="py-3.5 px-3 text-[#0B1F1A] whitespace-nowrap">
                            {row.ref}
                          </td>
                          <td className="py-3.5 px-3 text-[#0B1F1A] tabular-nums whitespace-nowrap">
                            {row.amount}
                          </td>
                          <td
                            className={`py-3.5 px-3 whitespace-nowrap ${
                              row.status === 'Completed'
                                ? 'text-[#0F7B5F]'
                                : row.status === 'Failed'
                                ? 'text-[#C20C0C]'
                                : 'text-[#7A4B00]'
                            }`}
                          >
                            {row.status}
                          </td>
                          <td className="py-3.5 px-3 text-[#0B1F1A] tabular-nums whitespace-nowrap">
                            {row.hash}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Detail Card Preview (276px x 517px in Figma) */}
          <div className="xl:col-span-3 flex justify-center xl:justify-end">
            <div className="w-full max-w-[320px] xl:w-[276px] bg-white border border-[#E3E7E1] rounded-[20px] p-4 flex flex-col justify-between min-h-[517px] shadow-xs">
              <div>
                <div className="text-[11px] font-bold text-[#0F7B5F]">Completed</div>
                <div className="mt-8 text-[11px] font-bold text-[#0B1F1A]/70">
                  Amount received
                </div>
                <div className="mt-1 text-[19.4px] leading-[27px] font-extrabold text-black tabular-nums">
                  10.24 USDC
                </div>

                <div className="mt-6 space-y-2.5 text-[10.7px] leading-[15px] font-bold">
                  <div className="flex justify-between gap-2">
                    <span className="text-[#0B1F1A]/70">Reference</span>
                    <span className="text-[#0B1F1A] text-right">Chioma - Order #1024</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#0B1F1A]/70">Network</span>
                    <span className="text-[#0B1F1A]">Stellar testnet</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#0B1F1A]/70">Fee</span>
                    <span className="text-[#0B1F1A] tabular-nums">0.001 XLM</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-[#0B1F1A]/70">Date</span>
                    <span className="text-[#0B1F1A]">14 Oct 2026</span>
                  </div>
                </div>

                <div className="mt-4 text-[10.7px] font-bold text-[#0B1F1A]/70">
                  Transaction hash
                </div>
                <div className="mt-2 bg-[#F5F6F2] rounded-[6.7px] p-2.5 text-[8.5px] leading-[12px] font-medium text-[#0B1F1A] break-all font-mono">
                  8f3a7c0e2b9d41f6a5e0c83b7d12f94ce6a0b5d8c2e17f3a9b4c6d0e21c21d
                </div>
              </div>

              <div className="mt-8 space-y-2.5">
                <button
                  type="button"
                  onClick={() =>
                    onNotify('Opened Stellar Testnet Explorer for transaction 8f3a7c...e21c21d')
                  }
                  className="w-full h-[33.5px] bg-[#0F7B5F] hover:bg-[#0c634c] text-white rounded-[6px] text-[12px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>View on testnet explorer</span>
                  <ArrowUpRightIcon color="#FFFFFF" className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      '8f3a7c0e2b9d41f6a5e0c83b7d12f94ce6a0b5d8c2e17f3a9b4c6d0e21c21d'
                    );
                    onNotify('Transaction hash copied to clipboard.');
                  }}
                  className="w-full h-[33.5px] border border-[#0F7B5F] hover:bg-[#0F7B5F]/5 text-black rounded-[6px] text-[12px] font-bold inline-flex items-center justify-center transition-colors"
                >
                  Copy transaction hash
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Built for everyday user (Full-width White Section) */}
      <section id="features" className="w-full bg-white py-16 lg:py-[92px]">
        <div className="max-w-[1512px] mx-auto px-5 sm:px-10 lg:px-[120px] grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          <div className="lg:col-span-5">
            <h2 className="text-[36px] sm:text-[44px] lg:text-[48px] font-extrabold leading-[1.15] lg:leading-[55px] text-black max-w-[459px]">
              Built for everyday user
            </h2>
          </div>

          <div className="lg:col-span-7 border-t border-black/60">
            <div className="py-10 lg:py-[54px] border-b border-black/60 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start">
              <div className="md:col-span-5 text-[28px] sm:text-[34px] lg:text-[38px] leading-[44px] font-bold text-black">
                Less friction
              </div>
              <div className="md:col-span-7 text-[18px] sm:text-[22px] lg:text-[24px] leading-[33px] font-bold text-[#0B1F1A]/80">
                Give customers a straightforward way to access a payment request and connect a compatible wallet.
              </div>
            </div>

            <div className="py-10 lg:py-[42px] border-b border-black/60 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start">
              <div className="md:col-span-5 text-[28px] sm:text-[34px] lg:text-[38px] leading-[44px] font-bold text-black">
                More clarity
              </div>
              <div className="md:col-span-7 text-[18px] sm:text-[22px] lg:text-[24px] leading-[33px] font-bold text-[#0B1F1A]/80">
                Keep payment reference and transaction status easy to find.
              </div>
            </div>

            <div className="py-10 lg:py-[42px] border-b border-black/60 grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 items-start">
              <div className="md:col-span-5 text-[28px] sm:text-[34px] lg:text-[38px] leading-[44px] font-bold text-black">
                Better visibility
              </div>
              <div className="md:col-span-7 text-[18px] sm:text-[22px] lg:text-[24px] leading-[33px] font-bold text-[#0B1F1A]/80">
                Keep payment reference and transaction status easy to find.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Frequently Asked Questions */}
      <section
        id="faqs"
        className="max-w-[1512px] mx-auto px-5 sm:px-10 lg:px-[120px] py-16 lg:py-[120px]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          <div className="lg:col-span-5">
            <h2 className="text-[36px] sm:text-[44px] lg:text-[48px] font-extrabold leading-[1.15] lg:leading-[55px] text-black max-w-[459px]">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="lg:col-span-7 space-y-8 sm:space-y-[45px]">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="border-b border-black/20 pb-6">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 text-left group"
                  >
                    <span className="text-[22px] sm:text-[28px] lg:text-[30px] leading-[36px] font-bold text-black group-hover:text-[#0F7B5F] transition-colors">
                      {item.q}
                    </span>
                    <span
                      className={`text-[26px] leading-[36px] font-bold text-black transition-transform select-none ${
                        isOpen ? '-rotate-90' : 'rotate-90'
                      }`}
                    >
                      &gt;
                    </span>
                  </button>
                  {isOpen && (
                    <p className="mt-5 text-[18px] sm:text-[22px] lg:text-[24px] leading-[33px] font-bold text-[#0B1F1A]/80 max-w-[540px]">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-[1512px] mx-auto px-5 sm:px-10 lg:px-[120px] pb-14">
        <div className="border-t border-black/60 pt-8">
          <p className="text-[16px] sm:text-[20px] lg:text-[22px] leading-[28px] font-semibold text-black max-w-[1266px]">
            SMEHUB is an MVP running on Stellar Testnet with USDC Testnet. Testnet assets are for testing and do not represent real funds. All names and figures shown on this site are fictional demonstration data.© 2026 SMEHUB
          </p>
        </div>
      </footer>
    </div>
  );
};

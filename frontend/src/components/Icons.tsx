import React from 'react';
import { WalletId } from '../types';

export const BrandLogo: React.FC<{
  theme?: 'light' | 'dark';
  size?: 'sm' | 'md';
  onClick?: () => void;
}> = ({ theme = 'light', size = 'md', onClick }) => {
  const isSmall = size === 'sm';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-end text-left focus:outline-none group ${
        isSmall ? 'gap-[14.5px]' : 'gap-[20px] sm:gap-[26px]'
      }`}
    >
      <div
        className={`bg-[#0F7B5F] flex items-center justify-center shrink-0 transition-transform group-hover:scale-[1.02] ${
          isSmall
            ? 'w-[30px] h-[28px] rounded-[5px]'
            : 'w-[42px] h-[40px] sm:w-[53px] sm:h-[50px] rounded-[9px]'
        }`}
      >
        <span
          className={`font-bold text-white leading-none select-none ${
            isSmall ? 'text-[14px]' : 'text-[20px] sm:text-[25px]'
          }`}
        >
          S
        </span>
      </div>
      <span
        className={`font-bold tracking-tight leading-none select-none ${
          isSmall
            ? 'text-[20px] leading-[28px]'
            : 'text-[28px] sm:text-[36px] sm:leading-[49px]'
        } ${theme === 'dark' ? 'text-white' : 'text-black'}`}
      >
        SMEHUB
      </span>
    </button>
  );
};

export const HamburgerIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="30"
    height="28"
    viewBox="0 0 30 28"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <line x1="0" y1="8" x2="30" y2="8" stroke="#0F7B5F" strokeWidth="3" strokeLinecap="round" />
    <line x1="0" y1="15" x2="24" y2="15" stroke="#0F7B5F" strokeWidth="3" strokeLinecap="round" />
    <line x1="0" y1="22" x2="19" y2="22" stroke="#0F7B5F" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const ArrowRightIcon: React.FC<{ color?: string; className?: string }> = ({
  color = 'currentColor',
  className = '',
}) => (
  <svg
    width="17"
    height="12"
    viewBox="0 0 17 12"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    <path
      d="M1 6H15.5M15.5 6L10.5 1M15.5 6L10.5 11"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ArrowUpRightIcon: React.FC<{ color?: string; className?: string }> = ({
  color = 'currentColor',
  className = '',
}) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    <path
      d="M3.5 11.5L11.5 3.5M11.5 3.5H5.5M11.5 3.5V9.5"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ChevronDownIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    <path
      d="M5 7.5L10 12.5L15 7.5"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const BarcodePlaceholderIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div
    className={`w-[58px] h-[54px] bg-black rounded-[9px] flex items-center justify-evenly px-1.5 overflow-hidden ${className}`}
  >
    <div className="w-[3px] h-full bg-white" />
    <div className="w-[3px] h-full bg-white" />
    <div className="w-[3px] h-full bg-white" />
    <div className="w-[3px] h-full bg-white" />
    <div className="w-[3px] h-full bg-white" />
  </div>
);

export const QrCodeSvg: React.FC<{ size?: number; value?: string; className?: string }> = ({
  size = 256,
  className = '',
}) => {
  // Deterministic 25x25 QR matrix with standard finder patterns
  const grid = 25;
  const isFinder = (r: number, c: number, topR: number, leftC: number) => {
    const dr = r - topR;
    const dc = c - leftC;
    if (dr < 0 || dr >= 7 || dc < 0 || dc >= 7) return null;
    if (dr === 0 || dr === 6 || dc === 0 || dc === 6) return true;
    if (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4) return true;
    return false;
  };

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      // Quiet zone border around finder patterns
      if (
        (r < 8 && c < 8) ||
        (r < 8 && c >= grid - 8) ||
        (r >= grid - 8 && c < 8)
      ) {
        const f1 = isFinder(r, c, 0, 0);
        const f2 = isFinder(r, c, 0, grid - 7);
        const f3 = isFinder(r, c, grid - 7, 0);
        if (f1 || f2 || f3) {
          cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} rx={0.15} fill="#0B1F1A" />);
        }
        continue;
      }

      // Alignment pattern near bottom-right
      if (r >= grid - 9 && r <= grid - 5 && c >= grid - 9 && c <= grid - 5) {
        const dr = r - (grid - 9);
        const dc = c - (grid - 9);
        if (dr === 0 || dr === 4 || dc === 0 || dc === 4 || (dr === 2 && dc === 2)) {
          cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} rx={0.15} fill="#0B1F1A" />);
        }
        continue;
      }

      // Timing lines
      if (r === 6 || c === 6) {
        if ((r + c) % 2 === 0) {
          cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} rx={0.15} fill="#0B1F1A" />);
        }
        continue;
      }

      // Center logo cutout
      if (r >= 10 && r <= 14 && c >= 10 && c <= 14) {
        continue;
      }

      // Deterministic pseudo-random pattern for data modules
      const seed = (r * 31 + c * 17 + r * c * 7) % 11;
      if (seed < 5) {
        cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} rx={0.15} fill="#0B1F1A" />);
      }
    }
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`bg-white p-3 rounded-[18px] border border-[#E3E7E1] flex items-center justify-center relative ${className}`}
    >
      <svg viewBox={`0 0 ${grid} ${grid}`} className="w-full h-full">
        {cells}
        {/* Center SMEHUB badge inside QR */}
        <rect x="10.2" y="10.2" width="4.6" height="4.6" rx="0.9" fill="#0F7B5F" />
        <text
          x="12.5"
          y="13.55"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="3.1"
          fontWeight="800"
          fontFamily="Manrope, sans-serif"
        >
          S
        </text>
      </svg>
    </div>
  );
};

export const WalletLogo: React.FC<{ wallet: WalletId; size?: 'sm' | 'md' }> = ({
  wallet,
  size = 'md',
}) => {
  const dim = size === 'sm' ? 'w-[40px] h-[38px]' : 'w-[54px] h-[50px]';

  if (wallet === 'freighter') {
    return (
      <div
        className={`${dim} rounded-[10px] bg-[#5B21B6] flex items-center justify-center shrink-0 shadow-xs overflow-hidden relative`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#7C3AED] to-[#4C1D95]" />
        <svg className="w-6 h-6 relative z-10" viewBox="0 0 32 32" fill="none">
          <path d="M8 9H24L20 15H12V17H21L18 22H12V26H8V9Z" fill="#FFFFFF" />
          <circle cx="23" cy="22" r="3" fill="#34D399" />
        </svg>
      </div>
    );
  }

  if (wallet === 'albedo') {
    return (
      <div
        className={`${dim} rounded-[10px] bg-[#0F172A] flex items-center justify-center shrink-0 shadow-xs overflow-hidden relative`}
      >
        <svg className="w-6 h-6" viewBox="0 0 32 32" fill="none">
          <polygon points="16,5 27,25 5,25" stroke="#F59E0B" strokeWidth="2.5" fill="none" />
          <polygon points="16,11 22,22 10,22" fill="#38BDF8" />
        </svg>
      </div>
    );
  }

  if (wallet === 'xbull') {
    return (
      <div
        className={`${dim} rounded-[10px] bg-[#DC2626] flex items-center justify-center shrink-0 shadow-xs overflow-hidden relative`}
      >
        <span className="text-white font-extrabold text-[16px] tracking-tight">xB</span>
      </div>
    );
  }

  if (wallet === 'lobstr') {
    return (
      <div
        className={`${dim} rounded-[10px] bg-[#0284C7] flex items-center justify-center shrink-0 shadow-xs overflow-hidden relative`}
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 7v10l8 5 8-5V7l-8-5z" stroke="#FFFFFF" strokeWidth="2" fill="none" />
          <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
        </svg>
      </div>
    );
  }

  if (wallet === 'hana' || wallet === 'rabet') {
    return (
      <div
        className={`${dim} rounded-[10px] bg-[#4338CA] flex items-center justify-center shrink-0 shadow-xs overflow-hidden relative`}
      >
        <span className="text-white font-extrabold text-[14px] uppercase">{wallet.slice(0, 2)}</span>
      </div>
    );
  }

  return (
    <div
      className={`${dim} rounded-[10px] bg-[#0F7B5F] flex items-center justify-center shrink-0 shadow-xs text-white font-extrabold text-[18px]`}
    >
      ⚡
    </div>
  );
};

export const CheckCircleBadge: React.FC<{ mobile?: boolean }> = ({ mobile = false }) => (
  <div
    className={`${
      mobile ? 'w-[112px] h-[103px]' : 'w-[160px] h-[147px]'
    } bg-[#0F7B5F] rounded-full flex items-center justify-center mx-auto shadow-md`}
  >
    <svg
      className={mobile ? 'w-[63px] h-[58px]' : 'w-[90px] h-[83px]'}
      viewBox="0 0 90 83"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="45"
        cy="41.5"
        r="33"
        stroke="#14F195"
        strokeWidth="3.5"
      />
      <path
        d="M31 42.5L40.5 51.5L60 31.5"
        stroke="#14F195"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

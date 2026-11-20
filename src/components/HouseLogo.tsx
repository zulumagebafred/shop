import React, { useState } from 'react';
import { siteConfig } from '../config/siteConfig';

interface HouseLogoProps {
  brand: string;
  className?: string;
}

/**
 * Renders the custom logo URL from `siteConfig.houseLogos` if configured,
 * or falls back instantaneously to crisp inline vector monogram & wordmark lockups.
 */
export const HouseLogo: React.FC<HouseLogoProps> = React.memo(({ brand, className = '' }) => {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const normalized = brand.trim().toLowerCase();
  const customLogoEntry = Object.entries(siteConfig.houseLogos).find(
    ([key, url]) =>
      url.trim() !== '' &&
      (key.trim().toLowerCase() === normalized ||
        normalized.includes(key.trim().toLowerCase()))
  );

  const logoUrl = customLogoEntry?.[1]?.trim() ?? '';

  if (customLogoEntry && failedUrl !== logoUrl) {
    return (
      <div className={`flex items-center justify-center w-full h-full p-2 select-none ${className}`}>
        <img
          src={logoUrl}
          alt={`${brand} logo`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(logoUrl)}
          className="max-w-full max-h-[72px] w-auto h-auto object-contain"
        />
      </div>
    );
  }

  if (normalized.includes('al haramain')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Minimalist Arabian Arch & Crescent Crest */}
          <path
            d="M90 6C79 14 74 22 74 33H106C106 22 101 14 90 6Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M90 12.5C83.5 18 81 23 81 30H99C99 23 96.5 18 90 12.5Z"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.65"
          />
          <circle cx="90" cy="22" r="2.2" fill="currentColor" />
          <line x1="58" y1="33" x2="122" y2="33" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
          <text
            x="90"
            y="53"
            textAnchor="middle"
            fill="currentColor"
            fontSize="14.5"
            fontWeight="700"
            letterSpacing="2.4"
            fontFamily="Poppins, sans-serif"
          >
            AL HARAMAIN
          </text>
          <text
            x="90"
            y="67"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="3.2"
            fontFamily="Poppins, sans-serif"
          >
            PERFUMES · EST. 1970
          </text>
        </svg>
      </div>
    );
  }

  if (normalized.includes('rasasi')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Interlocking Diamond & R Monogram */}
          <polygon
            points="90,5 104,19 90,33 76,19"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <polygon
            points="90,9.5 99.5,19 90,28.5 80.5,19"
            stroke="currentColor"
            strokeWidth="0.9"
            opacity="0.55"
          />
          <text
            x="90"
            y="22.5"
            textAnchor="middle"
            fill="currentColor"
            fontSize="10"
            fontWeight="700"
            fontFamily="Poppins, sans-serif"
          >
            R
          </text>
          <text
            x="90"
            y="52"
            textAnchor="middle"
            fill="currentColor"
            fontSize="18"
            fontWeight="700"
            letterSpacing="5.5"
            fontFamily="Poppins, sans-serif"
          >
            RASASI
          </text>
          <text
            x="90"
            y="66"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="2.8"
            fontFamily="Poppins, sans-serif"
          >
            DUBAI · EST. 1979
          </text>
        </svg>
      </div>
    );
  }

  if (normalized.includes('reef')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Desert Horizon Circular Seal */}
          <circle cx="90" cy="19" r="13" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M79 20C83 16 87 16 90 19C93 22 97 22 101 18"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M81 24C84.5 21.5 87.5 21.5 90 23.5C92.5 25.5 95.5 25.5 99 23"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.65"
          />
          <text
            x="90"
            y="52"
            textAnchor="middle"
            fill="currentColor"
            fontSize="19"
            fontWeight="700"
            letterSpacing="6"
            fontFamily="Poppins, sans-serif"
          >
            REEF
          </text>
          <text
            x="90"
            y="66"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="3"
            fontFamily="Poppins, sans-serif"
          >
            PERFUMES · RIYADH
          </text>
        </svg>
      </div>
    );
  }

  if (normalized.includes('lattafa')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Octagonal Arabian Medallion Crest */}
          <rect
            x="80"
            y="9"
            width="20"
            height="20"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="80"
            y="9"
            width="20"
            height="20"
            rx="3"
            transform="rotate(45 90 19)"
            stroke="currentColor"
            strokeWidth="1.3"
            opacity="0.7"
          />
          <text
            x="90"
            y="22.8"
            textAnchor="middle"
            fill="currentColor"
            fontSize="10.5"
            fontWeight="700"
            fontFamily="Poppins, sans-serif"
          >
            L
          </text>
          <text
            x="90"
            y="52"
            textAnchor="middle"
            fill="currentColor"
            fontSize="18"
            fontWeight="600"
            letterSpacing="3.5"
            fontFamily="Poppins, sans-serif"
          >
            LATTAFA
          </text>
          <text
            x="90"
            y="66"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="3"
            fontFamily="Poppins, sans-serif"
          >
            PERFUMES · DUBAI
          </text>
        </svg>
      </div>
    );
  }

  if (normalized.includes('armaf')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Minimalist Armored Crest */}
          <path
            d="M90 5L103 11V21C103 27.5 97 32 90 34C83 32 77 27.5 77 21V11L90 5Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M85.5 23L90 13.5L94.5 23M87 20H93"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x="90"
            y="53"
            textAnchor="middle"
            fill="currentColor"
            fontSize="18"
            fontWeight="700"
            letterSpacing="5"
            fontFamily="Poppins, sans-serif"
          >
            ARMAF
          </text>
          <text
            x="90"
            y="66"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="2.6"
            fontFamily="Poppins, sans-serif"
          >
            LUXURY FRAGRANCES
          </text>
        </svg>
      </div>
    );
  }

  if (normalized.includes('afnan')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Twin-Ring Lotus Emblem */}
          <circle cx="90" cy="19" r="12.5" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M90 10C93 15 93 23 90 28C87 23 87 15 90 10Z"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <path
            d="M81 19C86 16 94 16 99 19C94 22 86 22 81 19Z"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <text
            x="90"
            y="53"
            textAnchor="middle"
            fill="currentColor"
            fontSize="18"
            fontWeight="700"
            letterSpacing="5.5"
            fontFamily="Poppins, sans-serif"
          >
            AFNAN
          </text>
          <text
            x="90"
            y="66"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="2.8"
            fontFamily="Poppins, sans-serif"
          >
            PERFUMERY · EST. 2007
          </text>
        </svg>
      </div>
    );
  }

  if (normalized.includes('paris corner')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Architectural Corner Frame Monogram */}
          <rect x="76" y="7" width="28" height="24" rx="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M76 13H82V7" stroke="currentColor" strokeWidth="1.4" />
          <text
            x="90"
            y="22.5"
            textAnchor="middle"
            fill="currentColor"
            fontSize="10"
            fontWeight="700"
            letterSpacing="1.2"
            fontFamily="Poppins, sans-serif"
          >
            PC
          </text>
          <text
            x="90"
            y="52"
            textAnchor="middle"
            fill="currentColor"
            fontSize="14.5"
            fontWeight="700"
            letterSpacing="2.8"
            fontFamily="Poppins, sans-serif"
          >
            PARIS CORNER
          </text>
          <text
            x="90"
            y="66"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="2.8"
            fontFamily="Poppins, sans-serif"
          >
            MAISON DE PARFUM
          </text>
        </svg>
      </div>
    );
  }

  if (normalized.includes('fragrance world')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Meridian Globe Emblem */}
          <circle cx="90" cy="19" r="12.5" stroke="currentColor" strokeWidth="1.5" />
          <ellipse cx="90" cy="19" rx="6" ry="12.5" stroke="currentColor" strokeWidth="1.1" />
          <line x1="77.5" y1="19" x2="102.5" y2="19" stroke="currentColor" strokeWidth="1.1" />
          <text
            x="90"
            y="52"
            textAnchor="middle"
            fill="currentColor"
            fontSize="13.5"
            fontWeight="700"
            letterSpacing="2.2"
            fontFamily="Poppins, sans-serif"
          >
            FRAGRANCE WORLD
          </text>
          <text
            x="90"
            y="66"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="3"
            fontFamily="Poppins, sans-serif"
          >
            DUBAI · UNITED ARAB EMIRATES
          </text>
        </svg>
      </div>
    );
  }

  if (normalized.includes('emper')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Imperial Crown Crest */}
          <path
            d="M74 28L78 13L85 21L90 10L95 21L102 13L106 28H74Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <line x1="74" y1="32" x2="106" y2="32" stroke="currentColor" strokeWidth="1.4" />
          <text
            x="90"
            y="53"
            textAnchor="middle"
            fill="currentColor"
            fontSize="18.5"
            fontWeight="700"
            letterSpacing="5.5"
            fontFamily="Poppins, sans-serif"
          >
            EMPER
          </text>
          <text
            x="90"
            y="66"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="2.8"
            fontFamily="Poppins, sans-serif"
          >
            PERFUMES · DUBAI
          </text>
        </svg>
      </div>
    );
  }

  if (normalized.includes('french avenue')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Architectural Monogram Box */}
          <rect x="75" y="7" width="30" height="24" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <text
            x="90"
            y="22.8"
            textAnchor="middle"
            fill="currentColor"
            fontSize="10.5"
            fontWeight="700"
            letterSpacing="1.8"
            fontFamily="Poppins, sans-serif"
          >
            FA
          </text>
          <text
            x="90"
            y="52"
            textAnchor="middle"
            fill="currentColor"
            fontSize="14.5"
            fontWeight="700"
            letterSpacing="2.6"
            fontFamily="Poppins, sans-serif"
          >
            FRENCH AVENUE
          </text>
          <text
            x="90"
            y="66"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="2.8"
            fontFamily="Poppins, sans-serif"
          >
            BY FRAGRANCE WORLD
          </text>
        </svg>
      </div>
    );
  }

  if (normalized.includes('zaafaran')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Saffron Star & Seal Emblem */}
          <polygon
            points="90,6 94.5,15 104,19 94.5,23 90,32 85.5,23 76,19 85.5,15"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <circle cx="90" cy="19" r="2.2" fill="currentColor" />
          <text
            x="90"
            y="52"
            textAnchor="middle"
            fill="currentColor"
            fontSize="13.5"
            fontWeight="700"
            letterSpacing="2"
            fontFamily="Poppins, sans-serif"
          >
            ARD AL ZAAFARAN
          </text>
          <text
            x="90"
            y="66"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="2.8"
            fontFamily="Poppins, sans-serif"
          >
            TRADING · DUBAI
          </text>
        </svg>
      </div>
    );
  }

  if (normalized.includes('khadlaj')) {
    return (
      <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
        <svg
          viewBox="0 0 180 78"
          className="w-full max-w-[168px] h-[68px] text-[#0A0A0A]"
          fill="none"
          aria-hidden="true"
        >
          {/* Double Crest Oval & K Monogram */}
          <ellipse cx="90" cy="19" rx="14" ry="12" stroke="currentColor" strokeWidth="1.5" />
          <text
            x="90"
            y="22.8"
            textAnchor="middle"
            fill="currentColor"
            fontSize="10.5"
            fontWeight="700"
            fontFamily="Poppins, sans-serif"
          >
            K
          </text>
          <text
            x="90"
            y="52"
            textAnchor="middle"
            fill="currentColor"
            fontSize="17"
            fontWeight="700"
            letterSpacing="4.2"
            fontFamily="Poppins, sans-serif"
          >
            KHADLAJ
          </text>
          <text
            x="90"
            y="66"
            textAnchor="middle"
            fill="currentColor"
            opacity="0.6"
            fontSize="7.5"
            fontWeight="500"
            letterSpacing="2.8"
            fontFamily="Poppins, sans-serif"
          >
            PERFUMES · EST. 1997
          </text>
        </svg>
      </div>
    );
  }

  // Fallback Clean House Monogram for Custom Brands Added in Admin
  const initials = brand
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      <div className="w-11 h-11 rounded-full border border-[#0A0A0A] flex items-center justify-center mb-2 text-xs font-bold tracking-wider text-[#0A0A0A]">
        {initials || 'AH'}
      </div>
      <span className="text-sm font-bold tracking-[0.14em] uppercase text-[#0A0A0A]">
        {brand}
      </span>
      <span className="text-[10px] tracking-[0.2em] uppercase text-[#666666] mt-0.5">
        Curated House
      </span>
    </div>
  );
});

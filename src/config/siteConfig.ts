import { BranchId, StoreBranch } from '../types/fragrance';
import { sha256Hex } from '../utils/hash';

/**
 * CENTRAL CONFIGURATION FILE — AURAHUT CO.
 * -----------------------------------------------------------------------------
 * Edit WhatsApp ordering details, currency formatting, social handles, and
 * Manzini / Mbabane branch information in this single file.
 */
export const siteConfig = {
  brandName: 'AURAHUT CO.',
  tagline: 'Scents just for you',
  country: 'Eswatini',
  currency: {
    code: 'SZL',
    symbol: 'E',
    label: 'SZL (E)',
  },

  /**
   * WHATSAPP BUSINESS CONFIGURATION
   * Enter digits only with country code, no "+" or spaces (e.g. "26876123456").
   * Left intentionally blank until the confirmed AuraHut Co. business number is supplied.
   */
  whatsapp: {
    businessNumber: '76223903',
    displayLabel: 'Configure WhatsApp Number in src/config/siteConfig.ts',
    defaultGreeting: 'Hello AuraHut Co., I would like to place a fragrance order:',
  },

  social: {
    tiktokHandle: '@aurahut_co',
    tiktokUrl: 'https://www.tiktok.com/@aurahut_co?_r=1&_t=ZS-9BTQXyIoora',
    instagramHandle: '@aurahut_co',
    instagramUrl: 'https://www.instagram.com/aurahut_co?vrfl=MXJnYnZ4ZjRoNzM2bg==',
    facebookHandle: 'AuraHut Co.',
    facebookUrl: 'https://www.facebook.com/share/1XoxFJYsNh/',
  },

  defaultBranch: 'manzini' as BranchId,

  branches: [
    {
      id: 'manzini',
      name: 'AuraHut Co. Manzini',
      city: 'Manzini',
      address: 'Liqaga Center, by Select opposite Building Society next New Trends Technologies',
      landmarkNote: 'Manzini Central Commercial District, Eswatini',
      openingHours: {
        weekdays: 'Mon – Fri: 8am–5pm',
        saturday: 'Saturday: 8am–3pm',
        sunday: 'Closed',
      },
      phoneDisplay: '(+268) 78411335',
      email: 'concierge@aurahut.co',
      image: '/assets/aistudio/WhatsApp_Image_2026-11-18_at_11.26.24_AM_f359d9b2.jpeg',
      googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Manzini,+Eswatini',
      isPlaceholderDetails: true,
    },
    {
      id: 'mbabane',
      name: 'AuraHut Co. Mbabane',
      city: 'Mbabane',
      address: 'Opposite PeP, Swazi Centre & Piccadilly Complex one-way street next to Smile & Gama Fashion',
      landmarkNote: 'Mbabane City Centre, Eswatini',
      openingHours: {
        weekdays: 'Mon – Fri: 8am–5pm',
        saturday: 'Saturday: 8am–3pm',
        sunday: 'Closed',
      },
      phoneDisplay: '(+268) 79534936',
      email: 'mbabane@aurahut.co',
      image: '/assets/aistudio/image_29e39f08.png',
      googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=Mbabane,+Eswatini',
      isPlaceholderDetails: true,
    },
  ] satisfies StoreBranch[],

  /**
   * FRAGRANCE HOUSE LOGO URLS
   * Paste an HTTPS image URL (PNG, SVG, or WebP) or local /src/assets/ path
   * for any house below to override the built-in vector crest with your logo.
   */
  houseLogos: {
    'Al Haramain': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSTei37jrjT_4ZEPVQYiHVjlmJl2H6yREZhWX1GAcAc4w&s=10',
    Rasasi: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQawX83ud24PQ7oUwSepLZTMCLMyn-DcCqjJN49on_t2Q&s=10',
    'Inuka': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRwXhp7uh_L6Vyf5c84CXt4b1m19GisLo7mNVnpnHd4liaFinV92a7ZBIY&s=10',
    'Paris 2 Dubai': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTAVdBZnsgVRRAPXUlWFV2vq0n0m0fVC-hLSZugSyQBgg&s',
    'Lattafa Perfumes': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRTf5pOXtzZR91X9zwfwvHsBlR9JGsu5AHSrNgUOoAvRbzKOSANHgtc4XI&s=10',
    Armaf: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQWFyzU94mQpEYHT1pMrxgKYqTRaeos8BFYK_Qq4suv7Q&s=10',
    Afnan: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYS_Knxrx9mD2OkQ3MD02VynHUkLMBYRuBOIYMnXCD0w&s=10',
    'Paris Corner': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYeUvOE1je3JByJbMijd9RvAC2QdkQBjmRYHJ1Esakxw&s=10',
    'Fragrance World': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTG0y5xL7mXIL7k5iIPMwm7w4qcY1Ce8IR2NKrgKbZLYQ&s=10',
    'French Avenue': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQL0uu-7wfmGIhd7D9TTyWZBqeaDGu26GWy0qIacF76_w&s=10',
    'Khadlaj': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR19Z5ZJerFY6y8yZe-OtsQgRR64L2X8xkxeM3TGQVLTw&s',
  } as Record<string, string>,
};

const DEFAULT_PORTAL_SLUG_HASH =
  'ad3a80f095093d95db12bcbc9596315c5f0b105619222c3a9afd79964f5db782';

export function getConfiguredPortalSlug(): string | null {
  const envPath =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_ADMIN_PATH
      ? String(import.meta.env.VITE_ADMIN_PATH)
      : '';
  const cleaned = envPath.trim().replace(/^[#/]+|\/+$/g, '').toLowerCase();
  return cleaned || null;
}

export function matchesPrivatePortalSlug(candidate: string): boolean {
  const cleaned = candidate.trim().replace(/^[#/]+|\/+$/g, '').toLowerCase();
  if (!cleaned) return false;
  const configured = getConfiguredPortalSlug();
  if (configured) {
    return cleaned === configured;
  }
  return sha256Hex(cleaned) === DEFAULT_PORTAL_SLUG_HASH;
}

export function formatPrice(amount: number | null): string {
  if (amount === null || Number.isNaN(amount)) {
    return 'Price on WhatsApp';
  }
  return `${siteConfig.currency.symbol}${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const POST_OFFICE_TOWN_GROUPS: { region: string; towns: string[] }[] = [
  {
    region: 'Hhohho',
    towns: [
      'Mbabane',
      'Ezulwini',
      'The Gables',
      'Lobamba',
      'Piggs Peak',
      'Ntfonjeni',
      'Buhleni',
      'Swazi Plaza',
      'Corner Plaza',
      'Mahlanya',
      'Motshane',
      'Ngwenya',
    ],
  },
  {
    region: 'Manzini',
    towns: [
      'Manzini',
      'Bhunya',
      'Mahhala',
      'Luyengo',
      'Mankayane',
      'Malkerns',
      'Matsapha',
      'Velezizweni',
    ],
  },
  {
    region: 'Shiselweni',
    towns: [
      'Nhlangano',
      'Hlatikulu',
      'Lavumisa',
      'Hluti',
      'Sigwe',
    ],
  },
  {
    region: 'Lubombo',
    towns: [
      'Siteki',
      'Mpolonjeni',
      'Simunye',
      'Lomahasha',
      'Big Bend',
      'Matata',
      'Nsoko',
      'Siphofaneni',
      'Sithobelweni',
      'Tshaneni',
      'Mpaka',
      'Mhlume',
    ],
  },
];

export const POST_OFFICE_TOWNS: string[] = POST_OFFICE_TOWN_GROUPS.flatMap(
  (group) => group.towns
);


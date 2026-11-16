import { BranchId, StoreBranch } from '../types/fragrance';

/**
 * CENTRAL CONFIGURATION FILE — AURAHUT CO.
 * -----------------------------------------------------------------------------
 * Edit WhatsApp ordering details, currency formatting, social handles, and
 * Manzini / Mbabane branch information in this single file.
 */
export const siteConfig = {
  brandName: 'AURAHUT CO.',
  tagline: 'The Art of Fragrance.',
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
    businessNumber: '79774262',
    displayLabel: 'Configure WhatsApp Number in src/config/siteConfig.ts',
    defaultGreeting: 'Hello AuraHut Co., I would like to place a fragrance order:',
  },

  social: {
    tiktokHandle: '@aurahut.co',
    tiktokUrl: 'https://tiktok.com/',
    instagramHandle: '@aurahut.co',
    instagramUrl: 'https://instagram.com/',
    facebookHandle: 'AuraHut Co.',
    facebookUrl: 'https://facebook.com/',
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
        weekdays: 'Mon – Fri: 09:00 – 17:00',
        saturday: 'Saturday: 09:00 – 15:00',
        sunday: 'Closed',
      },
      phoneDisplay: '(+268) 78411335',
      email: 'concierge@aurahut.co',
      image: '/assets/images/boutique_interior_1794676715739.jpg',
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
        weekdays: 'Mon – Fri: 09:00 – 17:00',
        saturday: 'Saturday: 09:00 – 15:00',
        sunday: 'Closed',
      },
      phoneDisplay: '(+268) 79534936',
      email: 'mbabane@aurahut.co',
      image: '/assets/images/boutique_interior_1794676715739.jpg',
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
    'Reef Perfumes': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTF8VMpbmG4bs3m60I8fnoAwHejmQvg6MfxcGKO2lHxQg&s',
    'Lattafa Perfumes': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRTf5pOXtzZR91X9zwfwvHsBlR9JGsu5AHSrNgUOoAvRbzKOSANHgtc4XI&s=10',
    Armaf: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQWFyzU94mQpEYHT1pMrxgKYqTRaeos8BFYK_Qq4suv7Q&s=10',
    Afnan: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYS_Knxrx9mD2OkQ3MD02VynHUkLMBYRuBOIYMnXCD0w&s=10',
    'Paris Corner': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSYeUvOE1je3JByJbMijd9RvAC2QdkQBjmRYHJ1Esakxw&s=10',
    'Fragrance World': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTG0y5xL7mXIL7k5iIPMwm7w4qcY1Ce8IR2NKrgKbZLYQ&s=10',
  } as Record<string, string>,
};

export function formatPrice(amount: number | null): string {
  if (amount === null || Number.isNaN(amount)) {
    return 'Price on WhatsApp';
  }
  return `${siteConfig.currency.symbol}${amount.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

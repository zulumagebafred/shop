import { BottleSize, FragranceCategory } from '../types/fragrance';

export interface DecantTierInfo {
  size: BottleSize;
  title: string;
  spraysEstimate: string;
  summary: string;
  idealFor: string;
}

export interface OwnershipStep {
  step: string;
  title: string;
  detail: string;
}

export interface TrustGuarantee {
  title: string;
  detail: string;
}

export const siteContent = {
  announcementBar: {
    enabled: true,
    text: 'Manzini & Mbabane Stores · Authentic Arabian Fragrances · Same-Day Pickup & Local Delivery',
  },

  hero: {
    kicker: 'Manzini & Mbabane · Eswatini',
    headline: 'One Spray Before You Leave. A Trail That Stays Until Night.',
    supportingText:
      'Original Arabian extraits from Al Haramain, Rasasi, Lattafa & Armaf—available in travel-ready decants or full sealed bottles so you can live in your scent from morning to evening.',
    primaryCta: 'Find Your Scent',
    secondaryCta: 'Try Decants First',
    image: '/assets/images/hero_luxury_oud_1794676712385.jpg',
    slides: [
      {
        image: '/assets/images/hero_luxury_oud_1794676712385.jpg',
        alt: 'AuraHut Co. Luxury Arabian Fragrance Bottles',
        label: 'Signature Arabian Extraits',
      },
      {
        image: '/assets/images/house_al_haramain_1794685068564.jpg',
        alt: 'Al Haramain Arabian Amber & Oud Presentation',
        label: 'Al Haramain · Evening Oud',
      },
      {
        image: '/assets/images/house_lattafa_1794685069142.jpg',
        alt: 'Lattafa Perfumes Bottle Showcase',
        label: 'Lattafa · Spiced Vanilla & Amber',
      },
      {
        image: '/assets/images/house_rasasi_1794685069093.jpg',
        alt: 'Rasasi Luxury Fragrance Bottle',
        label: 'Rasasi · Crisp Cedar & Woods',
      },
      {
        image: '/assets/images/decant_collection_1794676715190.jpg',
        alt: '5ml, 10ml, 22ml Travel Decants and Full Bottle',
        label: 'Travel Decants · 5ml to Full Bottle',
      },
    ],
  },

  trustStrip: [
    {
      title: '100% Authentic Houses',
      detail: 'Sealed original bottles sourced directly from renowned Arabian perfume houses.',
    },
    {
      title: 'Wear Before Committing',
      detail: 'Start with a 5ml, 10ml, or 22ml glass atomizer or go straight for the full bottle.',
    },
    {
      title: 'Manzini & Mbabane Ready',
      detail: 'Reserve online in seconds for same-day store pickup or local delivery.',
    },
  ] satisfies TrustGuarantee[],

  categories: [
    {
      category: 'Men' as FragranceCategory,
      title: "Men's Fragrances",
      subtitle: 'Smoked agarwood, crisp bergamot, spiced cedar, and tailored leather.',
      image: '/assets/images/cat_mens_oud_1794676712301.jpg',
    },
    {
      category: 'Women' as FragranceCategory,
      title: "Women's Fragrances",
      subtitle: 'Velvet Taif rose, luminous white musk, spun vanilla, and warm amber.',
      image: '/assets/images/cat_womens_rose_1794676712431.jpg',
    },
    {
      category: 'Unisex' as FragranceCategory,
      title: 'Unisex Fragrances',
      subtitle: 'Boundary-free Arabian extraits rich in saffron, resin, and lingering oud.',
      image: '/assets/images/cat_unisex_amber_1794676712905.jpg',
    },
  ],

  decantsSection: {
    kicker: 'Try On Skin First',
    headline: 'Live With a Scent for Weeks Before Buying the Full Bottle',
    description:
      'True Arabian perfumery unfolds over eight to twelve hours on skin. Every AuraHut Co. decant is measured cleanly from original house bottles into thick glass atomizers—letting a scent become part of your real week before a full flacon sits on your dresser.',
    image: '/assets/images/decant_collection_1794676715190.jpg',
    tiers: [
      {
        size: '5ml',
        title: '5ml Decant',
        spraysEstimate: '~65 sprays',
        summary: 'Enough for 1–2 weeks of real wear—experience how the opening dries down at work and at night.',
        idealFor: 'Testing a new signature',
      },
      {
        size: '10ml',
        title: '10ml Decant',
        spraysEstimate: '~130 sprays',
        summary: 'Pocket-ready glass atomizer sized for daily commute, gym bags, and weekend travel.',
        idealFor: 'Daily carry & travel',
      },
      {
        size: '22ml',
        title: '22ml Decant',
        spraysEstimate: '~280 sprays',
        summary: 'Months of steady evening or occasion wear without committing to a full presentation.',
        idealFor: 'Extended rotation & gifting',
      },
      {
        size: '100ml',
        title: 'Full Bottle',
        spraysEstimate: '~1,300 sprays',
        summary: 'Factory-sealed original Arabian flacon—ready to take its permanent place on your vanity.',
        idealFor: 'Your everyday signature',
      },
    ] satisfies DecantTierInfo[],
  },

  featuredCollectionBanner: {
    kicker: 'Simple Ordering · Zero Guessing',
    headline: 'From Screen to Skin the Same Day',
    description:
      'Pick your bottle size, choose Manzini or Mbabane, and tap Buy Now. Our store team confirms stock immediately and sets your bottle aside or arranges local delivery.',
    ctaLabel: 'Browse All Fragrances',
  },

  howItWorks: [
    {
      step: '01',
      title: 'Choose Your Scent & Size',
      detail: 'Filter by mood, house, or bottle size—every card displays the full-bottle price and scent notes upfront.',
    },
    {
      step: '02',
      title: 'Pick Manzini or Mbabane',
      detail: 'Tap Buy Now or add to your cart, apply any promo code, and select your preferred store.',
    },
    {
      step: '03',
      title: 'Collect or Receive Same Day',
      detail: 'Your pre-filled order opens directly with our store team so you never wait on forms or guesswork.',
    },
  ] satisfies OwnershipStep[],

  aboutSection: {
    kicker: 'Our Heritage',
    headline: 'About AuraHut Co.',
    lead: 'Bringing genuine Arabian perfumery into everyday life across Eswatini.',
    paragraphs: [
      'Born from an appreciation for rare agarwood, sun-cured resins, and rich Middle Eastern extrait traditions, AuraHut Co. serves fragrance wearers across Manzini, Mbabane, and all corners of Eswatini.',
      'Choosing a signature scent should feel calm and certain. Through measured 5ml, 10ml, and 22ml glass decants alongside sealed full bottles, you know exactly how a fragrance wears on your skin before it lives on your shelf.',
    ],
    image: '/assets/images/craft_ingredients_1794676716101.jpg',
    pillars: [
      {
        title: 'Authentic Provenance',
        detail: 'Curated Arabian perfume houses sourced for genuine oil concentration and longevity.',
      },
      {
        title: 'Measured Glass Decants',
        detail: 'Cleanly transferred from authentic flacons so you can wear a scent across real days.',
      },
      {
        title: 'Two Eswatini Stores',
        detail: 'In-person scent testing and fast collection in both Manzini and Mbabane.',
      },
    ],
  },
};

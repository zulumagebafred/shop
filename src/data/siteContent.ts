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
        image: '/assets/aistudio/image_123e2ff5.png',
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
    image: '/assets/aistudio/image_123e2ff5.png',
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
    kicker: 'Woman-Owned · Founded in Eswatini',
    headline: 'About AuraHut Co.',
    lead: 'Scents, Just for You.',
    taglineMotto: 'Feel at home in yourself.',
    founderName: 'Nomfanelo Teyise Khumalo',
    founderKnownAs: 'Teyise',
    founderRole: 'Founder & Managing Director, AuraHut Co.',
    founderImage: '/assets/aistudio/teyise_image_9b43dbee.jpeg',
    intro:
      'AuraHut Co. is a woman-owned fragrance business founded in Eswatini. We specialise in Arabian perfumes and help you find a fragrance that feels like you. Whether you’re choosing an everyday scent, shopping for a gift, or exploring something new, we give you the space to try, ask questions, and choose with confidence.',
    storyParagraph:
      'AuraHut Co. began in 2021 when Nomfanelo Teyise Khumalo opened her first shop in Mhlaleni under the name Arabian Perfume Hut. The business grew to Manzini and Mbabane, and in February 2025, we became AuraHut Co. Today, we welcome customers at our Manzini and Mbabane stores and deliver across Eswatini through the Post Office.',
    milestones: [
      { year: '2021', label: 'First shop opened in Mhlaleni as Arabian Perfume Hut' },
      { year: '2022–24', label: 'Expanded into Manzini & Mbabane city centres' },
      { year: 'Feb 2025', label: 'Rebranded & relaunched as AuraHut Co.' },
      { year: 'Today', label: '2 stores + nationwide Eswatini Post Office delivery' },
    ],
    founderParagraphs: [
      'Nomfanelo Teyise Khumalo, known as Teyise, is an entrepreneur and mother of four. She studied cooperatives and spent nine years working in the cooperative sector. She was inspired by how early cooperatives pooled their resources to make everyday goods more affordable. That same idea shapes her plans for AuraHut Co. She wants to buy fragrances in bulk and work with local sellers to bring quality perfumes within reach of more people and create opportunities to earn extra income.',
      'Teyise joined a network marketing business to learn how to train sales teams, support independent sellers, and build lasting customer relationships. Along the way, she earned two trips to Cape Town and a six-day, all-expenses-paid trip to Bali, Indonesia. She applies those lessons at AuraHut Co. by working with sales agents and mentoring young people who want to start a business.',
    ],
    discoveryBarParagraphs: [
      'At our Discovery Scent Bar, you can try fragrances in-store and take home a 5 ml, 10 ml, or 22 ml decant filled from the original bottle. You get to wear the scent in your own time and see how it settles on your skin before choosing a full bottle.',
      'We stock fragrances from Lattafa, Armaf, Al Haramain, Ajmal, Rasasi, Fragrance World, Pendora Scents, Emper, Frank Olivier, and Motala. Our range also includes perfume oils, body mists, lotions, and fragrances for your home and car.',
    ],
    stockedHousesLine:
      'Lattafa · Armaf · Al Haramain · Ajmal · Rasasi · Fragrance World · Pendora Scents · Emper · Frank Olivier · Motala',
    futureParagraphs: [
      'Our long-term goal is to become one of Eswatini’s best-known fragrance brands and a recognised wholesaler and distributor across Africa. We plan to establish our own warehouse in Eswatini, buy stock in bulk, and supply independent resellers, retailers, and distribution partners across the continent.',
      'We also plan to open small Discovery Scent Bars in towns and shopping malls, starting in Eswatini and expanding into other African markets over time. As we grow, we want to give more sales agents and resellers access to stock, product training, and mentorship so they can serve customers in their own communities and earn extra income through fragrance sales.',
    ],
    image: '/assets/images/craft_ingredients_1794676716101.jpg',
    pillars: [
      {
        title: 'Our Vision',
        subtitle: 'Pan-African Recognition',
        detail:
          'To build a fragrance brand from Eswatini that is recognised across Africa for making quality perfumes easier to discover and creating opportunities for independent sellers to grow.',
      },
      {
        title: 'Our Mission',
        subtitle: 'Confidence & Opportunity',
        detail:
          'To help people find fragrances that express who they are and make them feel confident in their own skin, while giving aspiring entrepreneurs the practical support to start selling in their communities.',
      },
      {
        title: 'Our Motto',
        subtitle: 'Feel at home in yourself.',
        detail:
          'A fragrance can express your personality, match your mood, or give you a little more confidence as you go about your day. We want you to find the one that feels naturally yours.',
      },
    ],
  },
};

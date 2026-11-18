import { GiftHamper } from '../types/fragrance';

export const GIFT_HAMPER_OCCASIONS: string[] = [
  'For Her',
  'For Him',
  'Birthday',
  'Anniversary',
  'Eid & Celebrations',
  'Corporate & Appreciation',
  'Discovery Gift',
];

export const DEFAULT_HAMPER_IMAGE = '/assets/images/luxury_gift_hamper_1795005244668.jpg';

export const starterHampers: GiftHamper[] = [
  {
    id: 'hamper-her-signature-box',
    title: 'Her Signature Rose & Body Mist Gift Box',
    occasion: 'For Her',
    subtitle:
      'A ready-to-present satin gift box pairing a warm Arabian vanilla-rose bottle with a matching body mist and discovery decant.',
    itemsIncluded: [
      '100ml Full Arabian EDP Bottle (Warm Vanilla & Rose)',
      'Fine Fragrance Body Mist (200ml)',
      '10ml Handbag Travel Decant Atomiser',
      'AuraHut Signature Satin Ribbon Box & Personal Gift Card',
    ],
    regularPrice: 1250,
    hamperPrice: 990,
    image: '/assets/images/luxury_gift_hamper_1795005244668.jpg',
    giftWrapNote: 'Includes complimentary ribbon wrap & handwritten card',
    availability: 'In Stock',
    featured: true,
    active: true,
  },
  {
    id: 'hamper-him-oud-executive',
    title: 'His Oud & Amber Executive Gift Set',
    occasion: 'For Him',
    subtitle:
      'Bold smoky-leather and agarwood essentials boxed cleanly for birthdays, graduations, and Father’s Day gifting.',
    itemsIncluded: [
      '100ml Men’s Extrait / EDP Bottle',
      'Matching Scented Body Lotion or Shower Gel',
      '5ml Pocket Decant Atomiser',
      'Matte Black Gift Presentation Box & Ribbon',
    ],
    regularPrice: 1450,
    hamperPrice: 1150,
    image: '/assets/images/house_armaf_1794685069505.jpg',
    giftWrapNote: 'Complimentary obsidian box wrap & custom message tag',
    availability: 'In Stock',
    featured: true,
    active: true,
  },
  {
    id: 'hamper-couple-anniversary-duo',
    title: 'Anniversary His & Hers Fragrance Hamper',
    occasion: 'Anniversary',
    subtitle:
      'Two complementary Arabian bottles paired with home & car fragrance accents — curated for couples and milestone celebrations.',
    itemsIncluded: [
      '1 × 100ml Women’s Signature Fragrance Bottle',
      '1 × 100ml Men’s Signature Fragrance Bottle',
      '2 × 5ml Matching Date-Night Discovery Decants',
      'Car & Room Fragrance Mist + Keepsake Gift Box',
    ],
    regularPrice: 2350,
    hamperPrice: 1890,
    image: '/assets/images/house_al_haramain_1794685068564.jpg',
    giftWrapNote: 'Includes gold-seal ribbon hamper box & dual gift card',
    availability: 'In Stock',
    featured: true,
    active: true,
  },
  {
    id: 'hamper-discovery-tasting-box',
    title: 'Discovery Scent Bar Mini Gift Box',
    occasion: 'Birthday',
    subtitle:
      'An approachable fragrance tasting box featuring hand-poured glass decants so the recipient can explore four iconic Arabian scents.',
    itemsIncluded: [
      '4 × 10ml Hand-Poured Glass Discovery Decants',
      'Perfume Oil Roll-On Pocket Accent (6ml)',
      'Scent Notes Guide & Personalized Greeting Card',
      'Ribbon-Sealed Gift Box',
    ],
    regularPrice: 720,
    hamperPrice: 580,
    image: '/assets/images/house_paris_corner_1794685071664.jpg',
    giftWrapNote: 'Ready for same-day pickup or Post Office dispatch',
    availability: 'In Stock',
    featured: false,
    active: true,
  },
];

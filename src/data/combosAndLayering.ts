import { ComboDeal, FragranceProduct, LayeringIdea } from '../types/fragrance';

export const starterCombos: ComboDeal[] = [
  {
    id: 'combo-signature-duo-550',
    title: 'Signature Two-Bottle Duo',
    subtitle: 'Buy these 2 bestselling perfumes together for E550 instead of E600.',
    perfumeNames: ['Yara', "Bade'e Al Oud"],
    sizeLabel: '2 × 30ml / Duo Pack',
    regularPrice: 600,
    comboPrice: 550,
    tag: 'Save E50',
    featured: true,
    active: true,
  },
  {
    id: 'combo-oud-evening-duo',
    title: 'Spiced Oud & Amber Pair',
    subtitle: 'Couple or solo rotation deal — two bold evening scents bundled together.',
    perfumeNames: ['Asad', 'Khamrah'],
    sizeLabel: '2 × 30ml / Duo Pack',
    regularPrice: 600,
    comboPrice: 550,
    tag: 'Most Popular',
    featured: true,
    active: true,
  },
  {
    id: 'combo-discovery-trio-decants',
    title: 'Daily Rotation Decant Trio',
    subtitle: 'Three 10ml travel atomisers covering office mornings, gym fresh, and nights out.',
    perfumeNames: ['Club de Nuit', 'Fakhar', 'Oud Mood'],
    sizeLabel: '3 × 10ml Atomisers',
    regularPrice: 450,
    comboPrice: 380,
    tag: 'Save E70',
    featured: false,
    active: true,
  },
];

export const starterLayeringIdeas: LayeringIdea[] = [
  {
    id: 'layer-creamy-berry-oud',
    title: 'Velvet Oud & Whipped Vanilla',
    vibe: 'Sweet Smoked Oud',
    basePerfumeName: "Bade'e Al Oud",
    topPerfumeName: 'Yara',
    sprayRatio: '2 sprays base · 2 sprays top',
    occasion: 'Evening & Date Night',
    whyItWorks:
      'Saffron and dark agarwood anchor the scent for 10+ hours while creamy tropical orchid and vanilla soften every edge into an addictive trail.',
    active: true,
  },
  {
    id: 'layer-smoky-citrus-reserve',
    title: 'Spiced Pepper over Smoked Pineapple',
    vibe: 'Crisp & Commanding',
    basePerfumeName: 'Asad',
    topPerfumeName: 'Club de Nuit',
    sprayRatio: '2 sprays base · 3 sprays top',
    occasion: 'Daily Signature & Office',
    whyItWorks:
      'Black pepper, amber, and dry vanilla add warmth underneath bright bergamot, lemon, and smoky birch for an all-weather powerhouse.',
    active: true,
  },
  {
    id: 'layer-spiced-rose-ambergris',
    title: 'Royal Caramel Oud & Fresh Sage',
    vibe: 'Celebration Elegance',
    basePerfumeName: 'Oud Mood',
    topPerfumeName: 'Fakhar',
    sprayRatio: '1 spray base · 3 sprays top',
    occasion: 'Weddings & Events',
    whyItWorks:
      'Resinous saffron and sweet incense lock into clothing while crisp apple, bergamot, and white florals lift the sillage in warm weather.',
    active: true,
  },
  {
    id: 'layer-qahwa-praline-mist',
    title: 'Cinnamon Dates & Orchid Cream',
    vibe: 'Gourmand Comfort',
    basePerfumeName: 'Khamrah',
    topPerfumeName: 'Yara',
    sprayRatio: '2 sprays base · 2 sprays top',
    occasion: 'Cool Nights & Winter',
    whyItWorks:
      'Praline, cinnamon, and roasted dates melt into powdery vanilla musk for a rich dessert-like aura that turns heads across a room.',
    active: true,
  },
  {
    id: 'layer-aquatic-amber-lift',
    title: 'Iced Bergamot over Golden Amber',
    vibe: 'Fresh & Polished',
    basePerfumeName: 'Hawas',
    topPerfumeName: '9pm',
    sprayRatio: '3 sprays base · 1 spray top',
    occasion: 'Weekend & Brunch',
    whyItWorks:
      'Plum and sparkling aquatic citrus open clean and energetic while a light mist of spiced vanilla amber deepens the dry-down.',
    active: true,
  },
  {
    id: 'layer-saffron-leather-crown',
    title: 'Roasted Coffee & Smoked Suede',
    vibe: 'Rich Nightlife',
    basePerfumeName: 'La Yuqawam',
    topPerfumeName: 'Khamrah',
    sprayRatio: '1 spray base · 2 sprays top',
    occasion: 'Night Out & Cool Weather',
    whyItWorks:
      'Supple raspberry leather meets spiced cardamom and sweet tonka warmth, giving deep Arabian projection with smooth balance.',
    active: true,
  },
];

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findBestMatchingProduct(
  products: FragranceProduct[],
  queryName: string
): FragranceProduct | null {
  const cleanQuery = normalizeText(queryName);
  if (!cleanQuery || products.length === 0) return null;

  let best: FragranceProduct | null = null;
  let bestScore = 0;
  const tokens = cleanQuery.split(' ').filter((t) => t.length >= 2);

  for (const product of products) {
    const cleanName = normalizeText(product.name);
    const cleanBrand = normalizeText(product.brand);
    const combined = `${cleanName} ${cleanBrand}`;

    let score = 0;
    if (cleanName === cleanQuery) score += 100;
    else if (cleanName.includes(cleanQuery)) score += 60;
    else if (combined.includes(cleanQuery)) score += 45;
    else if (cleanQuery.includes(cleanName) && cleanName.length >= 4) score += 35;

    for (const token of tokens) {
      if (cleanName.includes(token)) score += 12;
      else if (cleanBrand.includes(token)) score += 6;
    }

    if (score > bestScore) {
      bestScore = score;
      best = product;
    }
  }

  return bestScore >= 12 ? best : null;
}

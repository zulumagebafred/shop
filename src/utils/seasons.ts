import { FragranceProduct, SeasonFilter } from '../types/fragrance';

export type FragranceSeason = Exclude<SeasonFilter, 'all'>;

export interface SeasonMeta {
  id: FragranceSeason;
  title: string;
  shortLabel: string;
  eyebrow: string;
  scentCue: string;
  keywords: string[];
}

export const SEASON_OPTIONS: SeasonMeta[] = [
  {
    id: 'winter',
    title: 'Winter Perfumes',
    shortLabel: 'Winter',
    eyebrow: 'Cool Nights & Bold Wear',
    scentCue: 'Oud · Amber · Leather · Spice',
    keywords: [
      'oud',
      'agarwood',
      'saffron',
      'amber',
      'ambergris',
      'leather',
      'suede',
      'cinnamon',
      'nutmeg',
      'clove',
      'vanilla',
      'praline',
      'dates',
      'caramel',
      'tonka',
      'incense',
      'myrrh',
      'smoke',
      'smoky',
      'tobacco',
      'honey',
      'cognac',
      'resin',
      'intense',
      'elixir',
    ],
  },
  {
    id: 'summer',
    title: 'Summer Perfumes',
    shortLabel: 'Summer',
    eyebrow: 'Sun & Warm Days',
    scentCue: 'Citrus · Bergamot · Fresh · Marine',
    keywords: [
      'bergamot',
      'lemon',
      'lime',
      'mandarin',
      'orange',
      'grapefruit',
      'citrus',
      'mint',
      'neroli',
      'marine',
      'aquatic',
      'ocean',
      'sea',
      'coconut',
      'pineapple',
      'apple',
      'pear',
      'fresh',
      'crisp',
      'airy',
      'green',
      'blue',
      'aqua',
    ],
  },
  {
    id: 'spring',
    title: 'Spring Perfumes',
    shortLabel: 'Spring',
    eyebrow: 'Daytime & Florals',
    scentCue: 'Rose · Jasmine · Soft Musk · Fruit',
    keywords: [
      'rose',
      'damask rose',
      'taif rose',
      'jasmine',
      'lavender',
      'peony',
      'blossom',
      'violet',
      'iris',
      'floral',
      'blackcurrant',
      'raspberry',
      'berry',
      'lychee',
      'white oud',
      'white musk',
      'musk',
      'mandarin',
    ],
  },
  {
    id: 'autumn',
    title: 'Autumn Perfumes',
    shortLabel: 'Autumn',
    eyebrow: 'Crisp Dusk & Woods',
    scentCue: 'Cedar · Cardamom · Patchouli · Oakmoss',
    keywords: [
      'cardamom',
      'patchouli',
      'cedar',
      'atlas cedar',
      'birch',
      'oakmoss',
      'moss',
      'vetiver',
      'sandalwood',
      'thyme',
      'wood',
      'woods',
      'woody',
      'metallic',
      'spiced',
      'tea',
      'fig',
      'dates',
      'praline',
    ],
  },
];

export function getProductSeasons(product: FragranceProduct): FragranceSeason[] {
  const haystack = [
    product.name,
    product.description,
    product.concentration,
    ...product.notes.top,
    ...product.notes.heart,
    ...product.notes.base,
  ]
    .join(' ')
    .toLowerCase();

  const scored = SEASON_OPTIONS.map((season) => {
    const score = season.keywords.reduce(
      (sum, kw) => (haystack.includes(kw) ? sum + 1 : sum),
      0
    );
    return { id: season.id, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return ['winter', 'autumn'];
  }

  const topScore = scored[0].score;
  const picks = scored
    .filter((entry, idx) => idx === 0 || (entry.score >= 2 && topScore - entry.score <= 1))
    .slice(0, 2)
    .map((entry) => entry.id);

  return picks;
}

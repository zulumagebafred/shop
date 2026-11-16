import { FragranceProduct } from '../types/fragrance';

/**
 * FEATURED ARABIAN PERFUME HOUSES CARRIED BY AURAHUT CO.
 */
export const featuredPerfumeHouses: string[] = [
  'Al Haramain Perfumes',
  'Rasasi',
  'Reef Perfumes',
  'Lattafa Perfumes',
  'Armaf',
  'Afnan',
  'Paris Corner',
  'Fragrance World',
];

export const houseImages: Record<string, string> = {
  'Al Haramain Perfumes': '/assets/images/house_al_haramain_1794685068564.jpg',
  Rasasi: '/assets/images/house_rasasi_1794685069093.jpg',
  'Reef Perfumes': '/assets/images/house_reef_1794685069325.jpg',
  'Lattafa Perfumes': '/assets/images/house_lattafa_1794685069142.jpg',
  Armaf: '/assets/images/house_armaf_1794685069505.jpg',
  Afnan: '/assets/images/house_afnan_1794685070293.jpg',
  'Paris Corner': '/assets/images/house_paris_corner_1794685071664.jpg',
  'Fragrance World': '/assets/images/house_fragrance_world_1794685071433.jpg',
};

/**
 * PRODUCT CATALOGUE — AURAHUT CO.
 * -----------------------------------------------------------------------------
 * IMPORTANT: The items below pair AuraHut Co.'s real perfume houses with
 * clearly labelled SAMPLE LISTINGS so you can preview the catalogue, filtering,
 * decant sizing (5ml, 10ml, 22ml, 100ml), and WhatsApp ordering experience.
 *
 * Replace these sample entries with your exact perfume names, verified prices
 * in Emalangeni (SZL), fragrance notes, and live stock status.
 */
export const fragranceCatalogue: FragranceProduct[] = [
  {
    id: 'sample-01',
    slug: 'sample-al-haramain-oud-saffron',
    isSampleListing: true,
    name: 'Sample Listing 01 — Oud & Saffron',
    brand: 'Al Haramain Perfumes',
    category: 'Unisex',
    concentration: 'Extrait de Parfum (Sample)',
    description:
      'Sample catalogue entry for Al Haramain Perfumes demonstrating an opulent agarwood and saffron profile. Replace with verified SKU details in src/data/catalogue.ts.',
    image: '/assets/images/house_al_haramain_1794685068564.jpg',
    notes: {
      top: ['Sample Note: Saffron', 'Sample Note: Bergamot'],
      heart: ['Sample Note: Aged Agarwood', 'Sample Note: Damask Rose'],
      base: ['Sample Note: Ambergris', 'Sample Note: Sandalwood'],
    },
    sizes: [
      { size: '5ml', price: 180, available: true },
      { size: '10ml', price: 320, available: true },
      { size: '22ml', price: 620, available: true },
      { size: '100ml', price: 1950, available: true },
    ],
    availability: 'In Stock',
    featured: true,
    bestseller: true,
  },
  {
    id: 'sample-02',
    slug: 'sample-lattafa-velvet-rose',
    isSampleListing: true,
    name: 'Sample Listing 02 — Spiced Cognac Amber',
    brand: 'Lattafa Perfumes',
    category: 'Women',
    concentration: 'Eau de Parfum (Sample)',
    description:
      'Sample catalogue entry for Lattafa Perfumes showcasing a warm spiced-amber fragrance available in discovery decants and full bottle presentation.',
    image: '/assets/images/house_lattafa_1794685069142.jpg',
    notes: {
      top: ['Sample Note: Cinnamon', 'Sample Note: Nutmeg'],
      heart: ['Sample Note: Dates', 'Sample Note: Praline'],
      base: ['Sample Note: Vanilla', 'Sample Note: Tonka Bean'],
    },
    sizes: [
      { size: '5ml', price: 150, available: true },
      { size: '10ml', price: 270, available: true },
      { size: '22ml', price: 540, available: true },
      { size: '100ml', price: 1650, available: true },
    ],
    availability: 'In Stock',
    featured: true,
    bestseller: true,
  },
  {
    id: 'sample-03',
    slug: 'sample-rasasi-spiced-amber',
    isSampleListing: true,
    name: 'Sample Listing 03 — Leather & Spice',
    brand: 'Rasasi',
    category: 'Men',
    concentration: 'Eau de Parfum Intense (Sample)',
    description:
      'Sample catalogue entry for Rasasi representing a bold men’s resinous amber, suede, and cedar fragrance. Edit availability, sizes, and pricing in src/data/catalogue.ts.',
    image: '/assets/images/house_rasasi_1794685069093.jpg',
    notes: {
      top: ['Sample Note: Cardamom', 'Sample Note: Raspberry'],
      heart: ['Sample Note: Suede Leather', 'Sample Note: Thyme'],
      base: ['Sample Note: Amber', 'Sample Note: Atlas Cedar'],
    },
    sizes: [
      { size: '5ml', price: 165, available: true },
      { size: '10ml', price: 295, available: true },
      { size: '22ml', price: 580, available: true },
      { size: '100ml', price: 1790, available: true },
    ],
    availability: 'In Stock',
    featured: true,
    bestseller: true,
  },
  {
    id: 'sample-04',
    slug: 'sample-reef-burgundy-oud',
    isSampleListing: true,
    name: 'Sample Listing 04 — Crimson Oud',
    brand: 'Reef Perfumes',
    category: 'Unisex',
    concentration: 'Parfum (Sample)',
    description:
      'Sample catalogue entry for Reef Perfumes demonstrating an opulent Saudi Arabian oud and floral signature with per-size availability configuration.',
    image: '/assets/images/house_reef_1794685069325.jpg',
    notes: {
      top: ['Sample Note: Saffron', 'Sample Note: Mandarin'],
      heart: ['Sample Note: Taif Rose', 'Sample Note: White Oud'],
      base: ['Sample Note: Musk', 'Sample Note: Ambergris'],
    },
    sizes: [
      { size: '5ml', price: 140, available: true },
      { size: '10ml', price: 250, available: true },
      { size: '22ml', price: 490, available: false },
      { size: '100ml', price: 1550, available: true },
    ],
    availability: 'In Stock',
    featured: true,
    bestseller: true,
  },
  {
    id: 'sample-05',
    slug: 'sample-armaf-obsidian-cedar',
    isSampleListing: true,
    name: 'Sample Listing 05 — Smoked Woods',
    brand: 'Armaf',
    category: 'Men',
    concentration: 'Extrait de Parfum (Sample)',
    description:
      'Sample catalogue entry for Armaf illustrating a crisp citrus-smoked woods composition offered in 10ml, 22ml, and 100ml sizes.',
    image: '/assets/images/house_armaf_1794685069505.jpg',
    notes: {
      top: ['Sample Note: Blackcurrant', 'Sample Note: Bergamot'],
      heart: ['Sample Note: Birch', 'Sample Note: Jasmine'],
      base: ['Sample Note: Patchouli', 'Sample Note: Ambergris'],
    },
    sizes: [
      { size: '10ml', price: 310, available: true },
      { size: '22ml', price: 610, available: true },
      { size: '100ml', price: 1890, available: true },
    ],
    availability: 'Low Stock',
    featured: false,
    bestseller: false,
  },
  {
    id: 'sample-06',
    slug: 'sample-afnan-supremacy-reserve',
    isSampleListing: true,
    name: 'Sample Listing 06 — Metallic Woods',
    brand: 'Afnan',
    category: 'Men',
    concentration: 'Extrait de Parfum (Sample)',
    description:
      'Sample catalogue entry for Afnan representing a refined smoky amber and aromatic oakmoss fragrance across all four decant and full-bottle tiers.',
    image: '/assets/images/house_afnan_1794685070293.jpg',
    notes: {
      top: ['Sample Note: Bergamot', 'Sample Note: Apple'],
      heart: ['Sample Note: Patchouli', 'Sample Note: Lavender'],
      base: ['Sample Note: Oakmoss', 'Sample Note: Saffron'],
    },
    sizes: [
      { size: '5ml', price: 170, available: true },
      { size: '10ml', price: 300, available: true },
      { size: '22ml', price: 590, available: true },
      { size: '100ml', price: 1820, available: true },
    ],
    availability: 'In Stock',
    featured: true,
    bestseller: false,
  },
  {
    id: 'sample-07',
    slug: 'sample-paris-corner-emerald-elixir',
    isSampleListing: true,
    name: 'Sample Listing 07 — Emerald Elixir',
    brand: 'Paris Corner',
    category: 'Women',
    concentration: 'Eau de Parfum (Sample)',
    description:
      'Sample catalogue entry for Paris Corner highlighting creamy pistachio, floral nectar, and warm vanilla accords, curated for discovery.',
    image: '/assets/images/house_paris_corner_1794685071664.jpg',
    notes: {
      top: ['Sample Note: Pistachio', 'Sample Note: Cardamom'],
      heart: ['Sample Note: Jasmine', 'Sample Note: White Peach'],
      base: ['Sample Note: Tonka Bean', 'Sample Note: Sandalwood'],
    },
    sizes: [
      { size: '5ml', price: 160, available: true },
      { size: '10ml', price: 285, available: true },
      { size: '100ml', price: 1740, available: true },
    ],
    availability: 'In Stock',
    featured: false,
    bestseller: false,
  },
  {
    id: 'sample-08',
    slug: 'sample-fragrance-world-ruby-extrait',
    isSampleListing: true,
    name: 'Sample Listing 08 — Ruby Amber',
    brand: 'Fragrance World',
    category: 'Unisex',
    concentration: 'Extrait de Parfum (Sample)',
    description:
      'Sample catalogue entry for Fragrance World demonstrating luminous saffron, ambergris, and cedarwood available in discovery decants.',
    image: '/assets/images/house_fragrance_world_1794685071433.jpg',
    notes: {
      top: ['Sample Note: Saffron', 'Sample Note: Bitter Almond'],
      heart: ['Sample Note: Cedarwood', 'Sample Note: Jasmine'],
      base: ['Sample Note: Ambergris', 'Sample Note: Woody Musk'],
    },
    sizes: [
      { size: '5ml', price: 145, available: true },
      { size: '10ml', price: 260, available: true },
      { size: '22ml', price: 510, available: true },
      { size: '100ml', price: 1590, available: true },
    ],
    availability: 'In Stock',
    featured: false,
    bestseller: false,
  },
];

export function getUniqueBrands(products: FragranceProduct[]): string[] {
  const fromCatalogue = Array.from(new Set(products.map((p) => p.brand)));
  const ordered = featuredPerfumeHouses.filter((house) =>
    fromCatalogue.includes(house)
  );
  const extras = fromCatalogue
    .filter((house) => !ordered.includes(house))
    .sort();
  return [...ordered, ...extras];
}

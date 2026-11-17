export type FragranceCategory = 'Men' | 'Women' | 'Unisex';

export type BottleSize = string;

export const STANDARD_BOTTLE_SIZES: string[] = [
  '5ml',
  '10ml',
  '22ml',
  '30ml',
  '50ml',
  '70ml',
  '80ml',
  '100ml',
  '120ml',
  '200ml',
];

export type AvailabilityStatus = 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Pre-Order';

export type BranchId = 'manzini' | 'mbabane';

export type DeliveryMethod = 'store-pickup' | 'post-office' | 'driver-delivery';

export type PriceRangeFilter =
  | 'all'
  | 'under-300'
  | 'under-500'
  | 'under-800'
  | '800-plus';

export type SeasonFilter = 'all' | 'winter' | 'summer' | 'spring' | 'autumn';

export const DRIVER_DELIVERY_FEE = 30;

export interface SizeOption {
  size: BottleSize;
  /** Catalogue price in configured store currency (e.g. SZL) */
  price: number | null;
  available: boolean;
}

export interface FragranceNotes {
  top: string[];
  heart: string[];
  base: string[];
}

export interface FragranceProduct {
  id: string;
  slug: string;
  /** Clearly indicates whether this entry is a sample listing awaiting final catalogue upload */
  isSampleListing: boolean;
  name: string;
  brand: string;
  category: FragranceCategory;
  description: string;
  image: string;
  notes: FragranceNotes;
  sizes: SizeOption[];
  availability: AvailabilityStatus;
  featured: boolean;
  bestseller: boolean;
  concentration: string;
  onSpecial?: boolean;
  specialLabel?: string;
  specialDiscountPercent?: number;
}

export type CouponDiscountType = 'percentage' | 'fixed';
export type CouponScope = 'all' | 'specials' | 'full-bottles';

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount: number;
  appliesTo: CouponScope;
  active: boolean;
}

export interface SpecialCampaign {
  title: string;
  badgeText: string;
  subtitle: string;
  announcementText: string;
  promoCodeHint: string;
  endsAt: string;
  enabled: boolean;
}

export interface StoreBranch {
  id: BranchId;
  name: string;
  city: string;
  address: string;
  landmarkNote: string;
  openingHours: {
    weekdays: string;
    saturday: string;
    sunday: string;
  };
  phoneDisplay: string;
  email: string;
  image: string;
  googleMapsUrl: string;
  isPlaceholderDetails: boolean;
}

export interface BasketItem {
  productId: string;
  productName: string;
  brand: string;
  image: string;
  size: BottleSize;
  unitPrice: number | null;
  originalUnitPrice?: number | null;
  onSpecial?: boolean;
  specialDiscountPercent?: number;
  quantity: number;
  isSampleListing: boolean;
}

export interface ComboDeal {
  id: string;
  title: string;
  subtitle: string;
  perfumeNames: string[];
  sizeLabel: string;
  regularPrice: number;
  comboPrice: number;
  tag: string;
  featured: boolean;
  active: boolean;
}

export interface LayeringIdea {
  id: string;
  title: string;
  vibe: string;
  basePerfumeName: string;
  topPerfumeName: string;
  sprayRatio: string;
  occasion: string;
  whyItWorks: string;
  active: boolean;
}

export type AppPage =
  | 'home'
  | 'shop'
  | 'product'
  | 'combos'
  | 'decants'
  | 'stores'
  | 'about'
  | 'admin';

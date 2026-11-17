import {
  BasketItem,
  Coupon,
  FragranceProduct,
  PriceRangeFilter,
  SizeOption,
} from '../types/fragrance';

export function getEffectiveUnitPrice(
  rawPrice: number | null,
  onSpecial?: boolean,
  specialDiscountPercent?: number
): number | null {
  if (rawPrice === null || Number.isNaN(rawPrice)) return null;
  if (!onSpecial || !specialDiscountPercent || specialDiscountPercent <= 0) {
    return rawPrice;
  }
  const clamped = Math.min(90, Math.max(0, specialDiscountPercent));
  return Math.max(0, Math.round(rawPrice * (1 - clamped / 100) * 100) / 100);
}

export function parseVolumeMl(sizeLabel: string): number {
  const match = sizeLabel.match(/\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : 0;
}

export function getHighestAvailableSize(product: FragranceProduct): SizeOption | null {
  const available = product.sizes.filter((s) => s.available);
  if (available.length === 0) return product.sizes[0] ?? null;

  return available.reduce((best, cur) => {
    const bestMl = parseVolumeMl(best.size);
    const curMl = parseVolumeMl(cur.size);
    if (curMl !== bestMl) return curMl > bestMl ? cur : best;
    return (cur.price ?? 0) > (best.price ?? 0) ? cur : best;
  }, available[0]);
}

export function getProductPriceSummary(product: FragranceProduct): {
  minOriginal: number | null;
  maxOriginal: number | null;
  minEffective: number | null;
  maxEffective: number | null;
  highestOriginal: number | null;
  highestEffective: number | null;
  highestSize: string | null;
  hasDiscount: boolean;
  pricedCount: number;
} {
  const availableSizes = product.sizes.filter((s) => s.available && s.price !== null);
  if (availableSizes.length === 0) {
    return {
      minOriginal: null,
      maxOriginal: null,
      minEffective: null,
      maxEffective: null,
      highestOriginal: null,
      highestEffective: null,
      highestSize: null,
      hasDiscount: false,
      pricedCount: 0,
    };
  }

  const originals = availableSizes.map((s) => s.price as number);
  const effectives = availableSizes.map(
    (s) =>
      getEffectiveUnitPrice(
        s.price,
        product.onSpecial,
        product.specialDiscountPercent
      ) as number
  );

  const highestOption = availableSizes.reduce((best, cur) => {
    const bestMl = parseVolumeMl(best.size);
    const curMl = parseVolumeMl(cur.size);
    if (curMl !== bestMl) return curMl > bestMl ? cur : best;
    return (cur.price as number) > (best.price as number) ? cur : best;
  }, availableSizes[0]);

  const highestOriginal = highestOption.price as number;
  const highestEffective = getEffectiveUnitPrice(
    highestOriginal,
    product.onSpecial,
    product.specialDiscountPercent
  ) as number;

  const minOriginal = Math.min(...originals);
  const maxOriginal = Math.max(...originals);
  const minEffective = Math.min(...effectives);
  const maxEffective = Math.max(...effectives);
  const hasDiscount =
    Boolean(product.onSpecial) &&
    Boolean(product.specialDiscountPercent && product.specialDiscountPercent > 0) &&
    highestEffective < highestOriginal;

  return {
    minOriginal,
    maxOriginal,
    minEffective,
    maxEffective,
    highestOriginal,
    highestEffective,
    highestSize: highestOption.size,
    hasDiscount,
    pricedCount: availableSizes.length,
  };
}

export function getBestPriceOptionForRange(
  product: FragranceProduct,
  priceRange: PriceRangeFilter
): {
  size: string;
  originalPrice: number;
  effectivePrice: number;
  hasDiscount: boolean;
} | null {
  if (priceRange === 'all') return null;

  const candidates = product.sizes
    .filter((s) => s.available && s.price !== null)
    .map((s) => {
      const originalPrice = s.price as number;
      const effectivePrice = getEffectiveUnitPrice(
        originalPrice,
        product.onSpecial,
        product.specialDiscountPercent
      ) as number;
      return {
        size: s.size,
        originalPrice,
        effectivePrice,
        hasDiscount: effectivePrice < originalPrice,
        ml: parseVolumeMl(s.size),
      };
    })
    .filter((entry) => {
      if (priceRange === 'under-300') return entry.effectivePrice <= 300;
      if (priceRange === 'under-500') return entry.effectivePrice <= 500;
      if (priceRange === 'under-800') return entry.effectivePrice <= 800;
      return entry.effectivePrice > 800;
    });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.ml !== a.ml) return b.ml - a.ml;
    return b.effectivePrice - a.effectivePrice;
  });

  const best = candidates[0];
  return {
    size: best.size,
    originalPrice: best.originalPrice,
    effectivePrice: best.effectivePrice,
    hasDiscount: best.hasDiscount,
  };
}

export function matchesPriceRange(
  product: FragranceProduct,
  priceRange: PriceRangeFilter
): boolean {
  if (priceRange === 'all') return true;
  return getBestPriceOptionForRange(product, priceRange) !== null;
}

export function getSizeEffectivePrice(
  product: FragranceProduct,
  sizeOption: SizeOption | null
): {
  originalPrice: number | null;
  effectivePrice: number | null;
  hasDiscount: boolean;
} {
  if (!sizeOption || sizeOption.price === null) {
    return { originalPrice: null, effectivePrice: null, hasDiscount: false };
  }
  const effectivePrice = getEffectiveUnitPrice(
    sizeOption.price,
    product.onSpecial,
    product.specialDiscountPercent
  );
  return {
    originalPrice: sizeOption.price,
    effectivePrice,
    hasDiscount: effectivePrice !== null && effectivePrice < sizeOption.price,
  };
}

export interface CouponCalculation {
  subtotal: number;
  eligibleSubtotal: number;
  discountAmount: number;
  finalTotal: number;
  valid: boolean;
  errorReason?: string;
}

export function calculateCouponDiscount(
  items: BasketItem[],
  coupon: Coupon | null
): CouponCalculation {
  const subtotal = items.reduce(
    (sum, item) => sum + (item.unitPrice ?? 0) * item.quantity,
    0
  );

  if (!coupon) {
    return {
      subtotal,
      eligibleSubtotal: subtotal,
      discountAmount: 0,
      finalTotal: subtotal,
      valid: false,
    };
  }

  if (!coupon.active) {
    return {
      subtotal,
      eligibleSubtotal: 0,
      discountAmount: 0,
      finalTotal: subtotal,
      valid: false,
      errorReason: `Coupon "${coupon.code}" is currently paused.`,
    };
  }

  const isFullBottleSize = (rawSize: string): boolean => {
    const match = rawSize.match(/\d+(?:\.\d+)?/);
    if (!match) return false;
    return Number(match[0]) >= 30;
  };

  const eligibleItems = items.filter((item) => {
    if (coupon.appliesTo === 'specials') return Boolean(item.onSpecial);
    if (coupon.appliesTo === 'full-bottles') return isFullBottleSize(item.size);
    return true;
  });

  const eligibleSubtotal = eligibleItems.reduce(
    (sum, item) => sum + (item.unitPrice ?? 0) * item.quantity,
    0
  );

  if (eligibleItems.length === 0 || eligibleSubtotal <= 0) {
    const scopeLabel =
      coupon.appliesTo === 'specials'
        ? 'items currently on Special'
        : 'full bottles (30ml+)';
    return {
      subtotal,
      eligibleSubtotal: 0,
      discountAmount: 0,
      finalTotal: subtotal,
      valid: false,
      errorReason: `Coupon "${coupon.code}" applies only to ${scopeLabel}.`,
    };
  }

  if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) {
    return {
      subtotal,
      eligibleSubtotal,
      discountAmount: 0,
      finalTotal: subtotal,
      valid: false,
      errorReason: `Minimum order of E${coupon.minOrderAmount.toFixed(2)} required for "${coupon.code}".`,
    };
  }

  let rawDiscount = 0;
  if (coupon.discountType === 'percentage') {
    rawDiscount = (eligibleSubtotal * coupon.discountValue) / 100;
  } else {
    rawDiscount = coupon.discountValue;
  }

  const discountAmount = Math.min(
    eligibleSubtotal,
    Math.round(rawDiscount * 100) / 100
  );
  const finalTotal = Math.max(
    0,
    Math.round((subtotal - discountAmount) * 100) / 100
  );

  return {
    subtotal,
    eligibleSubtotal,
    discountAmount,
    finalTotal,
    valid: true,
  };
}

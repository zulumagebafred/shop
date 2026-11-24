import {
  BasketItem,
  BasketPriceDelta,
  BasketRevalidationResult,
  ComboDeal,
  Coupon,
  FragranceProduct,
  GiftHamper,
  InfluencerReferral,
  PriceRangeFilter,
  PublicReferral,
  SizeOption,
  SpecialDiscountType,
  WeeklyFiveMlSpecial,
} from '../types/fragrance';

export function getEffectiveUnitPrice(
  rawPrice: number | null,
  onSpecial?: boolean,
  specialDiscountPercent?: number,
  specialDiscountType: SpecialDiscountType = 'percentage',
  specialDiscountAmount?: number
): number | null {
  if (rawPrice === null || Number.isNaN(rawPrice)) return null;
  if (!onSpecial) {
    return rawPrice;
  }
  if (specialDiscountType === 'fixed') {
    const amount = Number(specialDiscountAmount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return rawPrice;
    }
    if (rawPrice <= amount) {
      return rawPrice;
    }
    return Math.max(1, Math.round((rawPrice - amount) * 100) / 100);
  }
  if (!specialDiscountPercent || specialDiscountPercent <= 0) {
    return rawPrice;
  }
  const clamped = Math.min(90, Math.max(0, specialDiscountPercent));
  return Math.max(0, Math.round(rawPrice * (1 - clamped / 100) * 100) / 100);
}

export function formatSpecialDiscountTag(
  onSpecial?: boolean,
  specialDiscountPercent?: number,
  specialDiscountType: SpecialDiscountType = 'percentage',
  specialDiscountAmount?: number
): string {
  if (!onSpecial) return '';
  if (specialDiscountType === 'fixed') {
    const amount = Number(specialDiscountAmount ?? 0);
    if (Number.isFinite(amount) && amount > 0) {
      const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
      return `-E${formatted}`;
    }
    return '';
  }
  const pct = Number(specialDiscountPercent ?? 0);
  if (Number.isFinite(pct) && pct > 0) {
    return `-${pct}%`;
  }
  return '';
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
        product.specialDiscountPercent,
        product.specialDiscountType,
        product.specialDiscountAmount
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
    product.specialDiscountPercent,
    product.specialDiscountType,
    product.specialDiscountAmount
  ) as number;

  const minOriginal = Math.min(...originals);
  const maxOriginal = Math.max(...originals);
  const minEffective = Math.min(...effectives);
  const maxEffective = Math.max(...effectives);
  const hasDiscount =
    Boolean(product.onSpecial) &&
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
        product.specialDiscountPercent,
        product.specialDiscountType,
        product.specialDiscountAmount
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
    product.specialDiscountPercent,
    product.specialDiscountType,
    product.specialDiscountAmount
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

export interface ReferralBenefitCalculation {
  discountAmount: number;
  netOrderAmount: number;
  commissionAmount: number;
}

export function calculateReferralCommission(
  netOrderAmount: number,
  referral: Pick<InfluencerReferral, 'commissionType' | 'commissionValue'> | null
): number {
  if (!referral || netOrderAmount <= 0 || referral.commissionValue <= 0) return 0;
  if (referral.commissionType === 'percentage') {
    const pct = Math.min(90, Math.max(0, referral.commissionValue));
    return Math.round(((netOrderAmount * pct) / 100) * 100) / 100;
  }
  return Math.min(100000, Math.round(Math.max(0, referral.commissionValue) * 100) / 100);
}

export function calculateReferralBenefit(
  eligibleSubtotal: number,
  referral: PublicReferral | InfluencerReferral | null
): ReferralBenefitCalculation {
  const safeSubtotal = Math.max(0, eligibleSubtotal);
  if (!referral || !referral.active || safeSubtotal <= 0) {
    return {
      discountAmount: 0,
      netOrderAmount: safeSubtotal,
      commissionAmount: 0,
    };
  }

  let rawDiscount = 0;
  if (
    referral.followerDiscountType === 'percentage' &&
    referral.followerDiscountValue > 0
  ) {
    const pct = Math.min(95, Math.max(0, referral.followerDiscountValue));
    rawDiscount = (safeSubtotal * pct) / 100;
  } else if (
    referral.followerDiscountType === 'fixed' &&
    referral.followerDiscountValue > 0
  ) {
    rawDiscount = referral.followerDiscountValue;
  }

  const discountAmount = Math.min(
    safeSubtotal,
    Math.round(rawDiscount * 100) / 100
  );
  const netOrderAmount = Math.max(
    0,
    Math.round((safeSubtotal - discountAmount) * 100) / 100
  );
  const commissionAmount =
    'commissionType' in referral
      ? calculateReferralCommission(netOrderAmount, referral)
      : 0;

  return {
    discountAmount,
    netOrderAmount,
    commissionAmount,
  };
}

function pricesDiffer(a: number | null | undefined, b: number | null | undefined): boolean {
  if ((a === null || a === undefined) && (b === null || b === undefined)) return false;
  if (a === null || a === undefined || b === null || b === undefined) return true;
  return Math.abs(a - b) > 0.005;
}

/**
 * Revalidates persisted cart items against authoritative live catalogue, hamper,
 * combo, and weekly special pricing. Never trusts stored localStorage prices.
 */
export function revalidateBasketItems(
  items: BasketItem[],
  catalogue: FragranceProduct[],
  hampers: GiftHamper[] = [],
  combos: ComboDeal[] = [],
  weeklySpecial?: WeeklyFiveMlSpecial | null
): BasketRevalidationResult {
  const perfumeMap = new Map(catalogue.map((p) => [p.id, p]));
  const hamperMap = new Map(hampers.map((h) => [h.id, h]));
  const comboMap = new Map(combos.map((c) => [c.id, c]));

  const validatedItems: BasketItem[] = [];
  const staleChanges: BasketPriceDelta[] = [];
  let hasStalePrices = false;
  let hasUnavailableItems = false;
  let hasUnverifiedItems = catalogue.length === 0;

  for (const rawItem of items) {
    const safeQuantity = Math.min(50, Math.max(1, Math.floor(Number(rawItem.quantity) || 1)));

    if (rawItem.productId.startsWith('hamper-')) {
      const hamperId = rawItem.productId.slice('hamper-'.length);
      if (hampers.length === 0) {
        hasUnverifiedItems = true;
        validatedItems.push({ ...rawItem, quantity: safeQuantity });
        continue;
      }
      const liveHamper = hamperMap.get(hamperId);
      if (!liveHamper || !liveHamper.active || liveHamper.availability === 'Out of Stock') {
        hasUnavailableItems = true;
        staleChanges.push({
          productId: rawItem.productId,
          productName: rawItem.productName,
          size: rawItem.size,
          reason: 'unavailable',
          previousUnitPrice: rawItem.unitPrice,
          currentUnitPrice: null,
        });
        continue;
      }
      const nextOnSpecial = liveHamper.regularPrice > liveHamper.hamperPrice;
      const changed =
        pricesDiffer(rawItem.unitPrice, liveHamper.hamperPrice) ||
        pricesDiffer(rawItem.originalUnitPrice, liveHamper.regularPrice) ||
        Boolean(rawItem.onSpecial) !== nextOnSpecial;

      if (changed) {
        hasStalePrices = true;
        staleChanges.push({
          productId: rawItem.productId,
          productName: liveHamper.title,
          size: rawItem.size,
          reason: 'price-changed',
          previousUnitPrice: rawItem.unitPrice,
          currentUnitPrice: liveHamper.hamperPrice,
        });
      }

      validatedItems.push({
        ...rawItem,
        productName: liveHamper.title,
        image: liveHamper.image || rawItem.image,
        unitPrice: liveHamper.hamperPrice,
        originalUnitPrice: liveHamper.regularPrice,
        onSpecial: nextOnSpecial,
        quantity: safeQuantity,
      });
      continue;
    }

    if (rawItem.productId.startsWith('combo-')) {
      const comboId = rawItem.productId.slice('combo-'.length);
      if (combos.length === 0) {
        hasUnverifiedItems = true;
        validatedItems.push({ ...rawItem, quantity: safeQuantity });
        continue;
      }
      const liveCombo = comboMap.get(comboId);
      if (!liveCombo || !liveCombo.active) {
        hasUnavailableItems = true;
        staleChanges.push({
          productId: rawItem.productId,
          productName: rawItem.productName,
          size: rawItem.size,
          reason: 'unavailable',
          previousUnitPrice: rawItem.unitPrice,
          currentUnitPrice: null,
        });
        continue;
      }
      const nextOnSpecial = liveCombo.regularPrice > liveCombo.comboPrice;
      const changed =
        pricesDiffer(rawItem.unitPrice, liveCombo.comboPrice) ||
        pricesDiffer(rawItem.originalUnitPrice, liveCombo.regularPrice) ||
        Boolean(rawItem.onSpecial) !== nextOnSpecial;

      if (changed) {
        hasStalePrices = true;
        staleChanges.push({
          productId: rawItem.productId,
          productName: liveCombo.title,
          size: rawItem.size,
          reason: 'price-changed',
          previousUnitPrice: rawItem.unitPrice,
          currentUnitPrice: liveCombo.comboPrice,
        });
      }

      validatedItems.push({
        ...rawItem,
        productName: liveCombo.title,
        unitPrice: liveCombo.comboPrice,
        originalUnitPrice: liveCombo.regularPrice,
        onSpecial: nextOnSpecial,
        quantity: safeQuantity,
      });
      continue;
    }

    if (rawItem.productId.startsWith('weekly-5ml-')) {
      if (!weeklySpecial) {
        hasUnverifiedItems = true;
        validatedItems.push({ ...rawItem, quantity: safeQuantity });
        continue;
      }
      if (!weeklySpecial.enabled) {
        hasUnavailableItems = true;
        staleChanges.push({
          productId: rawItem.productId,
          productName: rawItem.productName,
          size: rawItem.size,
          reason: 'unavailable',
          previousUnitPrice: rawItem.unitPrice,
          currentUnitPrice: null,
        });
        continue;
      }
      const isFourPack = rawItem.productId.endsWith('-4-for-100');
      const livePrice = isFourPack
        ? Number(weeklySpecial.fourPackPrice || 100)
        : Number(weeklySpecial.twoPackPrice || 50);

      if (pricesDiffer(rawItem.unitPrice, livePrice)) {
        hasStalePrices = true;
        staleChanges.push({
          productId: rawItem.productId,
          productName: rawItem.productName,
          size: rawItem.size,
          reason: 'special-changed',
          previousUnitPrice: rawItem.unitPrice,
          currentUnitPrice: livePrice,
        });
      }

      validatedItems.push({
        ...rawItem,
        unitPrice: livePrice,
        onSpecial: true,
        quantity: safeQuantity,
      });
      continue;
    }

    if (rawItem.productId === 'exclusive-5ml-bundle') {
      if (!weeklySpecial) {
        hasUnverifiedItems = true;
        validatedItems.push({ ...rawItem, quantity: safeQuantity });
        continue;
      }
      const validBundle =
        Boolean(weeklySpecial.exclusiveEnabled) &&
        Boolean(weeklySpecial.exclusiveBundleEnabled) &&
        Array.isArray(weeklySpecial.exclusiveItems) &&
        weeklySpecial.exclusiveItems.length >= 2 &&
        Number(weeklySpecial.exclusiveBundlePrice) > 0;

      if (!validBundle) {
        hasUnavailableItems = true;
        staleChanges.push({
          productId: rawItem.productId,
          productName: rawItem.productName,
          size: rawItem.size,
          reason: 'unavailable',
          previousUnitPrice: rawItem.unitPrice,
          currentUnitPrice: null,
        });
        continue;
      }

      const livePrice = Number(weeklySpecial.exclusiveBundlePrice);
      if (pricesDiffer(rawItem.unitPrice, livePrice)) {
        hasStalePrices = true;
        staleChanges.push({
          productId: rawItem.productId,
          productName: rawItem.productName,
          size: rawItem.size,
          reason: 'special-changed',
          previousUnitPrice: rawItem.unitPrice,
          currentUnitPrice: livePrice,
        });
      }

      validatedItems.push({
        ...rawItem,
        unitPrice: livePrice,
        onSpecial: true,
        quantity: safeQuantity,
      });
      continue;
    }

    if (rawItem.productId.startsWith('exclusive-5ml-item-')) {
      if (!weeklySpecial) {
        hasUnverifiedItems = true;
        validatedItems.push({ ...rawItem, quantity: safeQuantity });
        continue;
      }
      const targetPerfumeId = rawItem.productId.slice('exclusive-5ml-item-'.length);
      const matchedEntry = Array.isArray(weeklySpecial.exclusiveItems)
        ? weeklySpecial.exclusiveItems.find((e) => e.perfumeId === targetPerfumeId)
        : undefined;
      const livePerfume = perfumeMap.get(targetPerfumeId);

      if (
        !weeklySpecial.exclusiveEnabled ||
        !matchedEntry ||
        (catalogue.length > 0 && (!livePerfume || livePerfume.availability === 'Out of Stock'))
      ) {
        hasUnavailableItems = true;
        staleChanges.push({
          productId: rawItem.productId,
          productName: rawItem.productName,
          size: rawItem.size,
          reason: 'unavailable',
          previousUnitPrice: rawItem.unitPrice,
          currentUnitPrice: null,
        });
        continue;
      }

      const livePrice = Number(matchedEntry.customPrice);
      if (pricesDiffer(rawItem.unitPrice, livePrice)) {
        hasStalePrices = true;
        staleChanges.push({
          productId: rawItem.productId,
          productName: livePerfume?.name ?? rawItem.productName,
          size: rawItem.size,
          reason: 'special-changed',
          previousUnitPrice: rawItem.unitPrice,
          currentUnitPrice: livePrice,
        });
      }

      validatedItems.push({
        ...rawItem,
        unitPrice: livePrice,
        onSpecial: true,
        quantity: safeQuantity,
      });
      continue;
    }

    if (catalogue.length === 0) {
      validatedItems.push({ ...rawItem, quantity: safeQuantity });
      continue;
    }

    const liveProduct = perfumeMap.get(rawItem.productId);
    if (!liveProduct || liveProduct.availability === 'Out of Stock') {
      hasUnavailableItems = true;
      staleChanges.push({
        productId: rawItem.productId,
        productName: rawItem.productName,
        size: rawItem.size,
        reason: 'unavailable',
        previousUnitPrice: rawItem.unitPrice,
        currentUnitPrice: null,
      });
      continue;
    }

    const normalizedSize = rawItem.size.trim().toLowerCase();
    const liveSizeOption = liveProduct.sizes.find(
      (s) => s.size.trim().toLowerCase() === normalizedSize
    );

    if (!liveSizeOption || !liveSizeOption.available) {
      hasUnavailableItems = true;
      staleChanges.push({
        productId: rawItem.productId,
        productName: liveProduct.name,
        size: rawItem.size,
        reason: 'unavailable',
        previousUnitPrice: rawItem.unitPrice,
        currentUnitPrice: null,
      });
      continue;
    }

    const pricing = getSizeEffectivePrice(liveProduct, liveSizeOption);
    const prevSpecialType = rawItem.specialDiscountType ?? 'percentage';
    const liveSpecialType = liveProduct.specialDiscountType ?? 'percentage';
    const prevSpecialPct = Number(rawItem.specialDiscountPercent ?? 0);
    const liveSpecialPct = Number(liveProduct.specialDiscountPercent ?? 0);
    const prevSpecialAmt = Number(rawItem.specialDiscountAmount ?? 0);
    const liveSpecialAmt = Number(liveProduct.specialDiscountAmount ?? 0);
    const priceChanged =
      pricesDiffer(rawItem.unitPrice, pricing.effectivePrice) ||
      pricesDiffer(rawItem.originalUnitPrice, pricing.originalPrice);
    const specialChanged =
      Boolean(rawItem.onSpecial) !== Boolean(liveProduct.onSpecial) ||
      prevSpecialType !== liveSpecialType ||
      (liveSpecialType === 'fixed'
        ? prevSpecialAmt !== liveSpecialAmt
        : prevSpecialPct !== liveSpecialPct);

    if (priceChanged || specialChanged) {
      hasStalePrices = true;
      staleChanges.push({
        productId: rawItem.productId,
        productName: liveProduct.name,
        size: liveSizeOption.size,
        reason: specialChanged && !priceChanged ? 'special-changed' : 'price-changed',
        previousUnitPrice: rawItem.unitPrice,
        currentUnitPrice: pricing.effectivePrice,
      });
    }

    validatedItems.push({
      productId: liveProduct.id,
      productName: liveProduct.name,
      brand: liveProduct.brand,
      image: liveProduct.image,
      size: liveSizeOption.size,
      unitPrice: pricing.effectivePrice,
      originalUnitPrice: pricing.originalPrice,
      onSpecial: liveProduct.onSpecial,
      specialDiscountType: liveSpecialType,
      specialDiscountPercent: liveProduct.specialDiscountPercent,
      specialDiscountAmount: liveProduct.specialDiscountAmount,
      isUnboxed: Boolean(liveProduct.isUnboxed),
      quantity: safeQuantity,
      isSampleListing: liveProduct.isSampleListing,
    });
  }

  return {
    validatedItems,
    hasStalePrices,
    hasUnavailableItems,
    hasUnverifiedItems,
    staleChanges,
  };
}

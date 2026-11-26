import { formatPrice, siteConfig } from '../config/siteConfig';
import {
  BasketItem,
  BottleSize,
  BranchId,
  Coupon,
  DeliveryMethod,
  DRIVER_DELIVERY_FEE,
  FragranceProduct,
  InfluencerReferral,
  PublicReferral,
} from '../types/fragrance';
import {
  calculateCouponDiscount,
  calculateReferralBenefit,
  doesSpecialApplyToSize,
  formatSpecialDiscountTag,
} from './pricing';
import { sanitizeText } from './sanitize';

export interface SingleOrderPayload {
  product: FragranceProduct;
  size: BottleSize;
  quantity: number;
  branchId: BranchId;
  unitPrice: number | null;
  originalUnitPrice?: number | null;
  appliedCoupon?: Coupon | null;
  appliedReferral?: PublicReferral | InfluencerReferral | null;
  deliveryMethod?: DeliveryMethod;
  postOfficeTown?: string;
  deliveryAddress?: string;
}

export function getBranchName(branchId: BranchId): string {
  const branch = siteConfig.branches.find((b) => b.id === branchId);
  return branch ? branch.name : branchId === 'manzini' ? 'AuraHut Co. Manzini' : 'AuraHut Co. Mbabane';
}

export function getDeliveryFee(deliveryMethod: DeliveryMethod = 'store-pickup'): number {
  return deliveryMethod === 'driver-delivery' ? DRIVER_DELIVERY_FEE : 0;
}

export function formatDeliverySummary(
  deliveryMethod: DeliveryMethod,
  branchName: string,
  postOfficeTown?: string,
  deliveryAddress?: string
): string[] {
  if (deliveryMethod === 'post-office') {
    const town = sanitizeText(postOfficeTown ?? '', 80) || 'To confirm';
    return [
      `• Delivery Method: Post Office`,
      `• Destination Town: ${town}`,
      `• Dispatch Store: ${branchName}`,
    ];
  }
  if (deliveryMethod === 'driver-delivery') {
    const cleanAddr = sanitizeText(deliveryAddress ?? '', 200);
    const lines = [
      `• Delivery Method: Driver Delivery (+${formatPrice(DRIVER_DELIVERY_FEE)})`,
      `• Dispatch Store: ${branchName}`,
    ];
    if (cleanAddr.length > 0) {
      lines.push(`• Delivery Area / Address: ${cleanAddr}`);
    }
    return lines;
  }
  return [`• Delivery Method: Collect at Store (${branchName})`];
}

export function buildSingleWhatsAppMessage(payload: SingleOrderPayload): string {
  const branchName = getBranchName(payload.branchId);
  const deliveryMethod: DeliveryMethod = payload.deliveryMethod ?? 'store-pickup';
  const deliveryFee = getDeliveryFee(deliveryMethod);
  const lineTotal = payload.unitPrice !== null ? payload.unitPrice * payload.quantity : null;

  const sizeOnSpecial = doesSpecialApplyToSize(
    payload.product.onSpecial,
    payload.product.sizes,
    payload.size
  );

  const syntheticItem: BasketItem = {
    productId: payload.product.id,
    productName: payload.product.name,
    brand: payload.product.brand,
    image: payload.product.image,
    size: payload.size,
    unitPrice: payload.unitPrice,
    originalUnitPrice: payload.originalUnitPrice,
    onSpecial: sizeOnSpecial,
    specialDiscountType: sizeOnSpecial ? payload.product.specialDiscountType : 'percentage',
    specialDiscountPercent: sizeOnSpecial ? payload.product.specialDiscountPercent : 0,
    specialDiscountAmount: sizeOnSpecial ? payload.product.specialDiscountAmount : 0,
    quantity: payload.quantity,
    isSampleListing: payload.product.isSampleListing,
  };

  const couponSummary =
    payload.appliedCoupon && lineTotal !== null
      ? calculateCouponDiscount([syntheticItem], payload.appliedCoupon)
      : null;

  const itemsAfterCoupon =
    couponSummary && couponSummary.valid ? couponSummary.finalTotal : lineTotal;
  const referralBenefit =
    payload.appliedReferral && itemsAfterCoupon !== null
      ? calculateReferralBenefit(itemsAfterCoupon, payload.appliedReferral)
      : null;
  const itemsAfterAllDiscounts =
    referralBenefit !== null ? referralBenefit.netOrderAmount : itemsAfterCoupon;
  const finalPayable =
    itemsAfterAllDiscounts !== null ? itemsAfterAllDiscounts + deliveryFee : null;

  const unboxedLabel = payload.product.isUnboxed ? ' (Unboxed · No Retail Box)' : '';
  const lines = [
    siteConfig.whatsapp.defaultGreeting,
    '',
    `• Perfume: ${payload.product.name}${unboxedLabel}`,
    `• Brand: ${payload.product.brand}`,
    `• Size: ${payload.size}`,
    `• Quantity: ${payload.quantity}`,
    `• Unit Price: ${formatPrice(payload.unitPrice)}${(() => {
      const tag = formatSpecialDiscountTag(
        sizeOnSpecial,
        payload.product.specialDiscountPercent,
        payload.product.specialDiscountType,
        payload.product.specialDiscountAmount
      );
      return tag ? ` (${payload.product.specialLabel || 'Special'}: ${tag})` : '';
    })()}`,
    `• Subtotal: ${formatPrice(lineTotal)}`,
  ];

  if (couponSummary && couponSummary.valid && payload.appliedCoupon) {
    lines.push(
      `• Coupon Applied (${payload.appliedCoupon.code}): -${formatPrice(couponSummary.discountAmount)}`
    );
  }

  if (payload.appliedReferral && payload.appliedReferral.active) {
    const handlePart = payload.appliedReferral.socialHandle
      ? ` · ${payload.appliedReferral.socialHandle}`
      : '';
    lines.push(
      `• Referral Code: ${payload.appliedReferral.code} (${payload.appliedReferral.influencerName}${handlePart})`
    );
    if (referralBenefit && referralBenefit.discountAmount > 0) {
      lines.push(
        `• Influencer Follower Perk (${payload.appliedReferral.code}): -${formatPrice(
          referralBenefit.discountAmount
        )}`
      );
    }
  }

  lines.push(
    ...formatDeliverySummary(
      deliveryMethod,
      branchName,
      payload.postOfficeTown,
      payload.deliveryAddress
    )
  );

  if (deliveryFee > 0) {
    lines.push(`• Driver Delivery Fee: +${formatPrice(deliveryFee)}`);
  }

  if (
    finalPayable !== null &&
    (deliveryFee > 0 ||
      (couponSummary && couponSummary.valid) ||
      (referralBenefit && referralBenefit.discountAmount > 0))
  ) {
    lines.push(`• Estimated Order Quote: ${formatPrice(finalPayable)}`);
  } else if (finalPayable === null && deliveryFee > 0) {
    lines.push(`• Driver Delivery Charge: +${formatPrice(deliveryFee)} (plus item price)`);
  }

  lines.push(
    '',
    'Note: Amounts above are unverified estimates — our store staff will confirm live prices, promo eligibility & stock in chat.'
  );

  return lines.join('\n');
}

export function buildBasketWhatsAppMessage(
  items: BasketItem[],
  branchId: BranchId,
  customerNote?: string,
  appliedCoupon?: Coupon | null,
  deliveryMethod: DeliveryMethod = 'store-pickup',
  postOfficeTown?: string,
  deliveryAddress?: string,
  appliedReferral?: PublicReferral | InfluencerReferral | null
): string {
  const branchName = getBranchName(branchId);
  const deliveryFee = getDeliveryFee(deliveryMethod);
  const hasUnpricedItem = items.some((i) => i.unitPrice === null);
  const couponCalc = calculateCouponDiscount(items, appliedCoupon ?? null);

  const itemBlocks = items.map((item, idx) => {
    const lineTotal = item.unitPrice !== null ? item.unitPrice * item.quantity : null;
    const unboxedTag = item.isUnboxed ? ' [Unboxed · No Box]' : '';
    const specialTag = formatSpecialDiscountTag(
      item.onSpecial,
      item.specialDiscountPercent,
      item.specialDiscountType,
      item.specialDiscountAmount
    );
    const specialNote = specialTag ? ` [${specialTag} Special]` : '';
    return [
      `${idx + 1}. ${item.productName}${unboxedTag}${specialNote}`,
      `   Brand: ${item.brand}`,
      `   Details: ${item.size} | Unit: ${formatPrice(item.unitPrice)} | Qty: ${item.quantity} | Est. Line: ${formatPrice(lineTotal)}`,
    ].join('\n');
  });

  const itemsAfterCoupon =
    appliedCoupon && couponCalc.valid ? couponCalc.finalTotal : couponCalc.subtotal;
  const referralBenefit = calculateReferralBenefit(itemsAfterCoupon, appliedReferral ?? null);
  const itemsAfterDiscounts =
    appliedReferral && appliedReferral.active
      ? referralBenefit.netOrderAmount
      : itemsAfterCoupon;
  const finalTotal = itemsAfterDiscounts + deliveryFee;

  const lines = [
    siteConfig.whatsapp.defaultGreeting,
    '',
    ...itemBlocks,
    '',
    ...formatDeliverySummary(deliveryMethod, branchName, postOfficeTown, deliveryAddress),
    `Subtotal: ${
      hasUnpricedItem
        ? `${formatPrice(couponCalc.subtotal)} + items priced on request`
        : formatPrice(couponCalc.subtotal)
    }`,
  ];

  if (appliedCoupon && couponCalc.valid) {
    lines.push(
      `Coupon Code (${appliedCoupon.code}): -${formatPrice(couponCalc.discountAmount)}`
    );
  }

  if (appliedReferral && appliedReferral.active) {
    const handlePart = appliedReferral.socialHandle
      ? ` · ${appliedReferral.socialHandle}`
      : '';
    lines.push(
      `Referral Code: ${appliedReferral.code} (${appliedReferral.influencerName}${handlePart})`
    );
    if (referralBenefit.discountAmount > 0) {
      lines.push(
        `Influencer Follower Perk (${appliedReferral.code}): -${formatPrice(
          referralBenefit.discountAmount
        )}`
      );
    }
  }

  if (deliveryFee > 0) {
    lines.push(`Driver Delivery Fee: +${formatPrice(deliveryFee)}`);
  }

  lines.push(
    `Estimated Order Quote: ${
      hasUnpricedItem
        ? `${formatPrice(finalTotal)} + items priced on request`
        : formatPrice(finalTotal)
    }`
  );

  const cleanNote = sanitizeText(customerNote ?? '', 240);
  if (cleanNote.length > 0) {
    lines.push(`Customer Note: ${cleanNote}`);
  }

  lines.push(
    '',
    'Unverified quote estimate — AuraHut Co. staff will verify live prices, promo eligibility & stock before payment.'
  );

  return lines.join('\n');
}

export function createWhatsAppUrl(message: string, overrideNumber?: string): string | null {
  let raw = (overrideNumber ?? siteConfig.whatsapp.businessNumber).replace(/[^\d]/g, '');
  if (!raw) {
    return null;
  }
  if (raw.length === 8) {
    raw = `268${raw}`;
  } else if (raw.startsWith('0') && raw.length === 9) {
    raw = `268${raw.slice(1)}`;
  }
  return `https://wa.me/${raw}?text=${encodeURIComponent(message)}`;
}

export function openExternalUrl(url: string): void {
  if (typeof document === 'undefined' || !url) return;
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

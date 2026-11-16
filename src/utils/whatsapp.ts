import { formatPrice, siteConfig } from '../config/siteConfig';
import {
  BasketItem,
  BottleSize,
  BranchId,
  Coupon,
  DeliveryMethod,
  DRIVER_DELIVERY_FEE,
  FragranceProduct,
} from '../types/fragrance';
import { calculateCouponDiscount } from './pricing';

export interface SingleOrderPayload {
  product: FragranceProduct;
  size: BottleSize;
  quantity: number;
  branchId: BranchId;
  unitPrice: number | null;
  originalUnitPrice?: number | null;
  appliedCoupon?: Coupon | null;
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
    const town = postOfficeTown?.trim() || 'To confirm';
    return [
      `• Delivery Method: Post Office`,
      `• Destination Town: ${town}`,
      `• Dispatch Store: ${branchName}`,
    ];
  }
  if (deliveryMethod === 'driver-delivery') {
    const lines = [
      `• Delivery Method: Driver Delivery (+${formatPrice(DRIVER_DELIVERY_FEE)})`,
      `• Dispatch Store: ${branchName}`,
    ];
    if (deliveryAddress && deliveryAddress.trim().length > 0) {
      lines.push(`• Delivery Area / Address: ${deliveryAddress.trim()}`);
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

  const syntheticItem: BasketItem = {
    productId: payload.product.id,
    productName: payload.product.name,
    brand: payload.product.brand,
    image: payload.product.image,
    size: payload.size,
    unitPrice: payload.unitPrice,
    originalUnitPrice: payload.originalUnitPrice,
    onSpecial: payload.product.onSpecial,
    specialDiscountPercent: payload.product.specialDiscountPercent,
    quantity: payload.quantity,
    isSampleListing: payload.product.isSampleListing,
  };

  const couponSummary =
    payload.appliedCoupon && lineTotal !== null
      ? calculateCouponDiscount([syntheticItem], payload.appliedCoupon)
      : null;

  const itemsAfterCoupon =
    couponSummary && couponSummary.valid ? couponSummary.finalTotal : lineTotal;
  const finalPayable =
    itemsAfterCoupon !== null ? itemsAfterCoupon + deliveryFee : null;

  const lines = [
    siteConfig.whatsapp.defaultGreeting,
    '',
    `• Perfume: ${payload.product.name}`,
    `• Brand: ${payload.product.brand}`,
    `• Size: ${payload.size}`,
    `• Quantity: ${payload.quantity}`,
    `• Unit Price: ${formatPrice(payload.unitPrice)}${
      payload.product.onSpecial && payload.product.specialDiscountPercent
        ? ` (${payload.product.specialLabel || 'Special'}: -${payload.product.specialDiscountPercent}%)`
        : ''
    }`,
    `• Subtotal: ${formatPrice(lineTotal)}`,
  ];

  if (couponSummary && couponSummary.valid && payload.appliedCoupon) {
    lines.push(
      `• Coupon Applied (${payload.appliedCoupon.code}): -${formatPrice(couponSummary.discountAmount)}`
    );
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

  if (finalPayable !== null && (deliveryFee > 0 || (couponSummary && couponSummary.valid))) {
    lines.push(`• Total Amount: ${formatPrice(finalPayable)}`);
  } else if (finalPayable === null && deliveryFee > 0) {
    lines.push(`• Driver Delivery Charge: +${formatPrice(deliveryFee)} (plus item price)`);
  }

  lines.push('', 'Please confirm stock availability and pickup/delivery arrangement.');

  return lines.join('\n');
}

export function buildBasketWhatsAppMessage(
  items: BasketItem[],
  branchId: BranchId,
  customerNote?: string,
  appliedCoupon?: Coupon | null,
  deliveryMethod: DeliveryMethod = 'store-pickup',
  postOfficeTown?: string,
  deliveryAddress?: string
): string {
  const branchName = getBranchName(branchId);
  const deliveryFee = getDeliveryFee(deliveryMethod);
  const hasUnpricedItem = items.some((i) => i.unitPrice === null);
  const couponCalc = calculateCouponDiscount(items, appliedCoupon ?? null);

  const itemBlocks = items.map((item, idx) => {
    const lineTotal = item.unitPrice !== null ? item.unitPrice * item.quantity : null;
    const specialNote =
      item.onSpecial && item.specialDiscountPercent
        ? ` [-${item.specialDiscountPercent}% Special]`
        : '';
    return [
      `${idx + 1}. ${item.productName}${specialNote}`,
      `   Brand: ${item.brand}`,
      `   Size: ${item.size} | Qty: ${item.quantity} | Price: ${formatPrice(lineTotal)}`,
    ].join('\n');
  });

  const itemsAfterCoupon =
    appliedCoupon && couponCalc.valid ? couponCalc.finalTotal : couponCalc.subtotal;
  const finalTotal = itemsAfterCoupon + deliveryFee;

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

  if (deliveryFee > 0) {
    lines.push(`Driver Delivery Fee: +${formatPrice(deliveryFee)}`);
  }

  lines.push(
    `Total: ${
      hasUnpricedItem
        ? `${formatPrice(finalTotal)} + items priced on request`
        : formatPrice(finalTotal)
    }`
  );

  if (customerNote && customerNote.trim().length > 0) {
    lines.push(`Customer Note: ${customerNote.trim()}`);
  }

  lines.push('', 'Please confirm availability for this order.');

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

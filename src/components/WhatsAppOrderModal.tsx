import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Copy,
  ExternalLink,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Tag,
  X,
} from 'lucide-react';
import { formatPrice, siteConfig } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
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
  formatBranchName,
  getAvailableBranches,
  getBranchAvailabilityLabel,
  isAvailableAtBranch,
} from '../utils/branches';
import {
  calculateCouponDiscount,
  calculateReferralBenefit,
  getEffectiveUnitPrice,
  getHighestAvailableSize,
  getSizeEffectivePrice,
} from '../utils/pricing';
import {
  buildSingleWhatsAppMessage,
  createWhatsAppUrl,
  getDeliveryFee,
  openExternalUrl,
} from '../utils/whatsapp';
import { DeliveryMethodSelector } from './DeliveryMethodSelector';
import { ResilientImage } from './ResilientImage';

interface WhatsAppOrderModalProps {
  product: FragranceProduct | null;
  selectedBranch: BranchId;
  deliveryMethod: DeliveryMethod;
  postOfficeTown: string;
  deliveryAddress: string;
  appliedReferral: PublicReferral | InfluencerReferral | null;
  onApplyReferral: (referral: PublicReferral | InfluencerReferral | null) => void;
  onSelectBranch: (branch: BranchId) => void;
  onSelectDeliveryMethod: (method: DeliveryMethod) => void;
  onPostOfficeTownChange: (town: string) => void;
  onDeliveryAddressChange: (address: string) => void;
  onAddToBasket: (
    product: FragranceProduct,
    size: BottleSize,
    quantity: number
  ) => void;
  onClose: () => void;
}

export const WhatsAppOrderModal: React.FC<WhatsAppOrderModalProps> = ({
  product,
  selectedBranch,
  deliveryMethod,
  postOfficeTown,
  deliveryAddress,
  appliedReferral,
  onApplyReferral,
  onSelectBranch,
  onSelectDeliveryMethod,
  onPostOfficeTownChange,
  onDeliveryAddressChange,
  onAddToBasket,
  onClose,
}) => {
  const { lookupCouponByCode, lookupReferralByCode, recordCheckoutReferralSale } = useStore();
  const availableSizes = useMemo(
    () => (product ? product.sizes.filter((s) => s.available) : []),
    [product]
  );

  const [chosenSize, setChosenSize] = useState<BottleSize>('10ml');
  const [quantity, setQuantity] = useState(1);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMessagePreview, setShowMessagePreview] = useState(false);
  const [showConfigHint, setShowConfigHint] = useState(false);
  const [postOfficeError, setPostOfficeError] = useState(false);
  const [deliveryAddressError, setDeliveryAddressError] = useState(false);
  const townInputRef = React.useRef<HTMLSelectElement | null>(null);
  const addressInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastWhatsAppLaunchRef = React.useRef<number>(0);

  const activeBranch = useMemo(
    () =>
      siteConfig.branches.find((b) => b.id === selectedBranch) ??
      siteConfig.branches[0],
    [selectedBranch]
  );

  React.useEffect(() => {
    if (product) {
      const firstAvail = getHighestAvailableSize(product)?.size ?? '100ml';
      setChosenSize(firstAvail);
      setQuantity(1);
      setCouponInput('');
      setAppliedCoupon(null);
      setCouponError(null);
      setShowMessagePreview(false);
      setShowConfigHint(false);
      setPostOfficeError(false);
      setDeliveryAddressError(false);
    }
  }, [product]);

  const activeSizeOption = useMemo(() => {
    if (!product) return null;
    return (
      availableSizes.find((s) => s.size === chosenSize) ??
      availableSizes[0] ??
      product.sizes[0] ??
      null
    );
  }, [product, availableSizes, chosenSize]);

  const effectiveSize: BottleSize = activeSizeOption?.size ?? '10ml';
  const sizePricing = product
    ? getSizeEffectivePrice(product, activeSizeOption)
    : { originalPrice: null, effectivePrice: null, hasDiscount: false };

  const couponCalc = useMemo(() => {
    if (!product || !appliedCoupon) return null;
    const syntheticItem: BasketItem = {
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      image: product.image,
      size: effectiveSize,
      unitPrice: sizePricing.effectivePrice,
      originalUnitPrice: sizePricing.originalPrice,
      onSpecial: product.onSpecial,
      specialDiscountPercent: product.specialDiscountPercent,
      quantity,
      isSampleListing: product.isSampleListing,
    };
    return calculateCouponDiscount([syntheticItem], appliedCoupon);
  }, [product, appliedCoupon, effectiveSize, sizePricing, quantity]);

  const validCoupon = couponCalc?.valid ? appliedCoupon : null;
  const activeReferral = appliedReferral?.active ? appliedReferral : null;
  const deliveryFee = getDeliveryFee(deliveryMethod);
  const rawLineTotal =
    sizePricing.effectivePrice !== null ? sizePricing.effectivePrice * quantity : null;
  const itemsAfterCoupon =
    validCoupon && couponCalc ? couponCalc.finalTotal : rawLineTotal;
  const referralBenefit = useMemo(
    () =>
      itemsAfterCoupon !== null
        ? calculateReferralBenefit(itemsAfterCoupon, activeReferral)
        : null,
    [itemsAfterCoupon, activeReferral]
  );
  const itemsSubtotal =
    referralBenefit !== null ? referralBenefit.netOrderAmount : itemsAfterCoupon;
  const finalPayable = itemsSubtotal !== null ? itemsSubtotal + deliveryFee : null;

  const message = useMemo(() => {
    if (!product) return '';
    return buildSingleWhatsAppMessage({
      product,
      size: effectiveSize,
      quantity,
      branchId: selectedBranch,
      unitPrice: sizePricing.effectivePrice,
      originalUnitPrice: sizePricing.originalPrice,
      appliedCoupon: validCoupon,
      appliedReferral: activeReferral,
      deliveryMethod,
      postOfficeTown,
      deliveryAddress,
    });
  }, [
    product,
    effectiveSize,
    quantity,
    selectedBranch,
    sizePricing,
    validCoupon,
    activeReferral,
    deliveryMethod,
    postOfficeTown,
    deliveryAddress,
  ]);

  const whatsappUrl = useMemo(() => createWhatsAppUrl(message), [message]);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !couponInput.trim()) return;
    setCouponError(null);
    setCheckingCoupon(true);
    try {
      const { coupon } = await lookupCouponByCode(couponInput);
      if (coupon) {
        const syntheticItem: BasketItem = {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          image: product.image,
          size: effectiveSize,
          unitPrice: sizePricing.effectivePrice,
          originalUnitPrice: sizePricing.originalPrice,
          onSpecial: product.onSpecial,
          specialDiscountPercent: product.specialDiscountPercent,
          quantity,
          isSampleListing: product.isSampleListing,
        };
        const check = calculateCouponDiscount([syntheticItem], coupon);
        if (!check.valid) {
          setCouponError(check.errorReason ?? 'Coupon does not apply to this selection.');
          return;
        }
        setAppliedCoupon(coupon);
        setCouponInput('');
        return;
      }

      const { referral, error: referralError } = await lookupReferralByCode(couponInput);
      if (referral) {
        onApplyReferral(referral);
        setCouponInput('');
        return;
      }

      setCouponError(
        referralError ?? `Code "${couponInput.trim().toUpperCase()}" was not found.`
      );
    } catch {
      setCouponError('Unable to verify code right now.');
    } finally {
      setCheckingCoupon(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard permission denial
    }
  };

  const handleWhatsAppLaunch = () => {
    const now = Date.now();
    if (now - lastWhatsAppLaunchRef.current < 2500) {
      return;
    }
    if (deliveryMethod === 'post-office' && !postOfficeTown.trim()) {
      setPostOfficeError(true);
      townInputRef.current?.focus();
      townInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (deliveryMethod === 'driver-delivery' && !deliveryAddress.trim()) {
      setDeliveryAddressError(true);
      addressInputRef.current?.focus();
      addressInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (product && activeReferral && itemsAfterCoupon !== null && referralBenefit) {
      const customerRef =
        deliveryMethod === 'post-office'
          ? `Post Office · ${postOfficeTown.trim()}`
          : deliveryMethod === 'driver-delivery'
          ? `Driver Delivery (${activeBranch?.city})`
          : `${activeBranch?.city} Store Pickup`;
      void recordCheckoutReferralSale({
        referral: activeReferral,
        orderSummary: `${product.name} (${effectiveSize} × ${quantity})`,
        reportedSubtotal: itemsAfterCoupon,
        reportedDiscount: referralBenefit.discountAmount,
        customerRef,
      });
    }

    if (whatsappUrl) {
      lastWhatsAppLaunchRef.current = now;
      openExternalUrl(whatsappUrl);
    } else {
      setShowConfigHint(true);
    }
  };

  return (
    <AnimatePresence>
      {product && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-modal="true"
              aria-label={`Buy ${product.name}`}
              className="pointer-events-auto w-full max-w-lg bg-[#F6F6F7] border border-[#E5E5E5] rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-4 bg-white border-b border-[#E5E5E5] flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#F5F5F5] shrink-0 overflow-hidden">
                    <ResilientImage
                      src={product.image}
                      alt={product.name}
                      fallbackTitle={product.name}
                      variant="thumb"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-[#525252] truncate">
                      {product.brand} · {getBranchAvailabilityLabel(product)}
                    </p>
                    <h3 className="text-base font-semibold text-[#0A0A0A] truncate">
                      {product.name}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close modal"
                  className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F4F4F5]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5 overflow-y-auto">
                {/* Size Selection */}
                <div className="space-y-2">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
                    Select Bottle Size
                  </span>
                  <div
                    className={`grid gap-2 ${
                      product.sizes.length === 1
                        ? 'grid-cols-1 max-w-[180px]'
                        : product.sizes.length === 2
                        ? 'grid-cols-2'
                        : product.sizes.length === 3
                        ? 'grid-cols-3'
                        : 'grid-cols-2 sm:grid-cols-4'
                    }`}
                  >
                    {product.sizes.map((opt, idx) => {
                      const active = opt.size === effectiveSize;
                      const effPrice = getEffectiveUnitPrice(
                        opt.price,
                        product.onSpecial,
                        product.specialDiscountPercent
                      );
                      return (
                        <button
                          key={`${opt.size}-${idx}`}
                          type="button"
                          disabled={!opt.available}
                          onClick={() => setChosenSize(opt.size)}
                          className={`py-2.5 px-2 border rounded-xl text-center transition-colors ${
                            !opt.available
                              ? 'opacity-40 cursor-not-allowed bg-[#F0F0F0] border-[#E5E5E5]'
                              : active
                              ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                              : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                          }`}
                        >
                          <div className="text-xs font-semibold tabular-nums">{opt.size}</div>
                          <div
                            className={`text-[11px] tabular-nums mt-0.5 ${
                              active ? 'text-white/75' : 'text-[#666666]'
                            }`}
                          >
                            {opt.available ? formatPrice(effPrice) : 'Unavailable'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Quantity */}
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
                    Quantity
                  </span>
                  <div className="inline-flex items-center border border-[#D4D4D4] bg-white rounded-full overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label="Decrease quantity"
                      className="w-9 h-9 flex items-center justify-center hover:bg-[#F5F5F5]"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-10 text-center text-sm font-semibold tabular-nums">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      aria-label="Increase quantity"
                      className="w-9 h-9 flex items-center justify-center hover:bg-[#F5F5F5]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 3-Way Collection / Delivery Options */}
                <DeliveryMethodSelector
                  compact
                  deliveryMethod={deliveryMethod}
                  selectedBranch={selectedBranch}
                  postOfficeTown={postOfficeTown}
                  deliveryAddress={deliveryAddress}
                  postOfficeError={postOfficeError}
                  deliveryAddressError={deliveryAddressError}
                  townInputRef={townInputRef}
                  addressInputRef={addressInputRef}
                  onSelectDeliveryMethod={(method) => {
                    onSelectDeliveryMethod(method);
                    if (method !== 'post-office') setPostOfficeError(false);
                    if (method !== 'driver-delivery') setDeliveryAddressError(false);
                  }}
                  onSelectBranch={onSelectBranch}
                  onPostOfficeTownChange={(town) => {
                    onPostOfficeTownChange(town);
                    if (town.trim()) setPostOfficeError(false);
                  }}
                  onDeliveryAddressChange={(address) => {
                    onDeliveryAddressChange(address);
                    if (address.trim()) setDeliveryAddressError(false);
                  }}
                />

                {(() => {
                  const stockedBranches = getAvailableBranches(product);
                  const branchHasStock = isAvailableAtBranch(product, selectedBranch);
                  if (
                    deliveryMethod !== 'store-pickup' ||
                    branchHasStock ||
                    stockedBranches.length === 0
                  ) {
                    return null;
                  }
                  const altBranch = stockedBranches[0];
                  return (
                    <div className="p-3 bg-[#FEF3C7] border border-[#F59E0B] rounded-xl text-xs text-[#92400E] flex items-center justify-between gap-2.5">
                      <p className="leading-snug">
                        Stocked at <strong>{formatBranchName(altBranch)}</strong> only.
                      </p>
                      <button
                        type="button"
                        onClick={() => onSelectBranch(altBranch)}
                        className="px-3 py-1.5 rounded-full bg-[#0A0A0A] text-white text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap shrink-0"
                      >
                        Switch to {formatBranchName(altBranch)}
                      </button>
                    </div>
                  );
                })()}

                {/* Promo or Influencer Referral Code Input */}
                <div className="space-y-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
                    <Tag className="w-3.5 h-3.5 text-[#0A0A0A]" />
                    <span>Promo or Influencer Code (Optional)</span>
                  </span>

                  {activeReferral && (
                    <div className="bg-white border border-[#0A0A0A] rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">
                        Referral <strong className="font-mono">{activeReferral.code}</strong> ({activeReferral.influencerName}
                        {referralBenefit && referralBenefit.discountAmount > 0
                          ? ` · -${formatPrice(referralBenefit.discountAmount)}`
                          : ''}
                        )
                      </span>
                      <button
                        type="button"
                        onClick={() => onApplyReferral(null)}
                        className="underline text-[#525252] hover:text-[#0A0A0A] shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {validCoupon && couponCalc ? (
                    <div className="bg-white border border-[#0A0A0A] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
                      <span>
                        <strong className="font-mono">{validCoupon.code}</strong> applied (-
                        {formatPrice(couponCalc.discountAmount)})
                      </span>
                      <button
                        type="button"
                        onClick={() => setAppliedCoupon(null)}
                        className="underline text-[#525252] hover:text-[#0A0A0A]"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleApplyCoupon} className="flex gap-2">
                      <input
                        type="text"
                        value={couponInput}
                        onChange={(e) => {
                          setCouponInput(e.target.value.toUpperCase());
                          setCouponError(null);
                        }}
                        placeholder="Enter coupon or influencer code..."
                        className="flex-1 px-3.5 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs font-mono uppercase focus:outline-none focus:border-[#0A0A0A]"
                      />
                      <button
                        type="submit"
                        disabled={checkingCoupon || !couponInput.trim()}
                        className="px-4 py-2 rounded-full bg-[#0A0A0A] text-white text-xs font-semibold uppercase tracking-wider disabled:opacity-40"
                      >
                        {checkingCoupon ? '...' : 'Apply'}
                      </button>
                    </form>
                  )}

                  {(couponError || (appliedCoupon && couponCalc && !couponCalc.valid)) && (
                    <p className="text-[11px] text-[#0A0A0A] bg-white border border-[#D4D4D4] rounded-xl px-3 py-2">
                      {couponError || couponCalc?.errorReason}
                    </p>
                  )}
                </div>

                {/* Clear Order Total & Next Step Summary */}
                <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-2">
                  {deliveryFee > 0 && sizePricing.effectivePrice !== null && (
                    <div className="space-y-1 text-xs pb-1.5 border-b border-[#F0F0F0]">
                      <div className="flex items-center justify-between text-[#525252]">
                        <span>Perfume ({effectiveSize} × {quantity})</span>
                        <span className="tabular-nums">{formatPrice(itemsSubtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[#DC2626] font-medium">
                        <span>Driver Delivery</span>
                        <span className="tabular-nums">+{formatPrice(DRIVER_DELIVERY_FEE)}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs uppercase tracking-wider text-[#525252]">
                      Total ({effectiveSize} × {quantity})
                    </span>
                    <span className="text-lg font-bold text-[#0A0A0A] tabular-nums">
                      {finalPayable !== null
                        ? formatPrice(finalPayable)
                        : deliveryFee > 0
                        ? `Price on Request + ${formatPrice(deliveryFee)}`
                        : 'Price on Request'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#525252] leading-relaxed">
                    {deliveryMethod === 'driver-delivery'
                      ? `Includes ${formatPrice(DRIVER_DELIVERY_FEE)} driver delivery dispatched from our ${activeBranch?.city} store.`
                      : deliveryMethod === 'post-office'
                      ? `Dispatched via Post Office to ${postOfficeTown.trim() || 'your town'} from our ${activeBranch?.city} store.`
                      : `Tap Buy Now to confirm collection at our ${activeBranch?.city} store—no forms or card entry required.`}
                  </p>
                  <div className="pt-1 flex items-center justify-between border-t border-[#F0F0F0]">
                    <button
                      type="button"
                      onClick={() => setShowMessagePreview((v) => !v)}
                      className="text-[11px] text-[#525252] hover:text-[#0A0A0A] underline underline-offset-4"
                    >
                      {showMessagePreview ? 'Hide order text' : 'View / copy order text'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0A0A0A] hover:opacity-70"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  {(showMessagePreview || showConfigHint) && (
                    <pre className="p-3 bg-[#F6F6F7] border border-[#E5E5E5] rounded-xl text-[11px] leading-relaxed text-[#404040] whitespace-pre-wrap font-sans max-h-32 overflow-y-auto">
                      {message}
                    </pre>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 bg-white border-t border-[#E5E5E5] flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    onAddToBasket(product, effectiveSize, quantity);
                    onClose();
                  }}
                  className="flex-1 py-3 px-4 rounded-full border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors flex items-center justify-center gap-2 text-xs font-semibold tracking-wider uppercase"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>Add to Cart</span>
                </button>
                <button
                  type="button"
                  onClick={handleWhatsAppLaunch}
                  className="flex-1 py-3 px-4 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors flex items-center justify-center gap-2 text-xs font-semibold tracking-wider uppercase"
                >
                  <ShoppingBag className="w-4 h-4 text-white" />
                  <span>Buy Now</span>
                  {whatsappUrl && <ExternalLink className="w-3.5 h-3.5 opacity-75" />}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

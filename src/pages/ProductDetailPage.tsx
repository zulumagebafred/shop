import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
} from 'lucide-react';
import { DeliveryMethodSelector } from '../components/DeliveryMethodSelector';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { formatPrice, siteConfig } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import {
  BottleSize,
  BranchId,
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
  calculateReferralBenefit,
  formatSpecialDiscountTag,
  getEffectiveUnitPrice,
  getHighestAvailableSize,
  getSizeEffectivePrice,
  parseVolumeMl,
} from '../utils/pricing';
import {
  buildSingleWhatsAppMessage,
  createWhatsAppUrl,
  getDeliveryFee,
  openExternalUrl,
} from '../utils/whatsapp';

interface ProductDetailPageProps {
  product: FragranceProduct;
  selectedBranch: BranchId;
  deliveryMethod: DeliveryMethod;
  postOfficeTown: string;
  deliveryAddress: string;
  appliedReferral?: PublicReferral | InfluencerReferral | null;
  onSelectBranch: (branch: BranchId) => void;
  onSelectDeliveryMethod: (method: DeliveryMethod) => void;
  onPostOfficeTownChange: (town: string) => void;
  onDeliveryAddressChange: (address: string) => void;
  onAddToBasket: (
    product: FragranceProduct,
    size: BottleSize,
    quantity: number
  ) => void;
  onBackToShop: () => void;
  onSelectProduct: (product: FragranceProduct) => void;
  onQuickWhatsApp: (product: FragranceProduct) => void;
}

function describeBottleWearLife(sizeLabel: string, isUnboxed = false): string {
  const ml = parseVolumeMl(sizeLabel);
  if (ml <= 5) return `${sizeLabel} · ~65 sprays (1–2 weeks of daily wear)`;
  if (ml <= 12) return `${sizeLabel} · ~130 sprays (~1 month of daily carry)`;
  if (ml <= 30) return `${sizeLabel} · ~280 sprays (2–3 months of steady wear)`;
  if (isUnboxed) {
    return `${sizeLabel} · Original authentic unboxed house bottle (no outer box, full volume)`;
  }
  return `${sizeLabel} · Original sealed house bottle (6+ months on your dresser)`;
}

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  product,
  selectedBranch,
  deliveryMethod,
  postOfficeTown,
  deliveryAddress,
  appliedReferral = null,
  onSelectBranch,
  onSelectDeliveryMethod,
  onPostOfficeTownChange,
  onDeliveryAddressChange,
  onAddToBasket,
  onBackToShop,
  onSelectProduct,
  onQuickWhatsApp,
}) => {
  const { perfumes, recordCheckoutReferralSale } = useStore();

  const firstAvailable =
    getHighestAvailableSize(product)?.size ?? product.sizes[0]?.size ?? '100ml';

  const [selectedSize, setSelectedSize] = useState<BottleSize>(firstAvailable);
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [showNumberNotice, setShowNumberNotice] = useState(false);
  const [postOfficeError, setPostOfficeError] = useState(false);
  const [deliveryAddressError, setDeliveryAddressError] = useState(false);
  const townInputRef = React.useRef<HTMLSelectElement | null>(null);
  const addressInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastWhatsAppSubmitRef = useRef<number>(0);

  const currentSizeObj = useMemo(
    () =>
      product.sizes.find((s) => s.size === selectedSize) ??
      product.sizes.find((s) => s.available) ??
      product.sizes[0],
    [product, selectedSize]
  );

  const sizePricing = useMemo(
    () => getSizeEffectivePrice(product, currentSizeObj ?? null),
    [product, currentSizeObj]
  );

  const unitPrice = sizePricing.effectivePrice;
  const originalUnitPrice = sizePricing.originalPrice;
  const lineTotal = unitPrice !== null ? unitPrice * quantity : null;
  const activeReferral = appliedReferral?.active ? appliedReferral : null;
  const referralBenefit = useMemo(
    () =>
      lineTotal !== null ? calculateReferralBenefit(lineTotal, activeReferral) : null,
    [lineTotal, activeReferral]
  );
  const netLineTotal =
    referralBenefit !== null ? referralBenefit.netOrderAmount : lineTotal;
  const originalLineTotal =
    originalUnitPrice !== null ? originalUnitPrice * quantity : null;
  const deliveryFee = getDeliveryFee(deliveryMethod);
  const finalPayable = netLineTotal !== null ? netLineTotal + deliveryFee : null;

  const activeBranch = useMemo(
    () =>
      siteConfig.branches.find((b) => b.id === selectedBranch) ??
      siteConfig.branches[0],
    [selectedBranch]
  );

  const whatsappMessage = useMemo(
    () =>
      buildSingleWhatsAppMessage({
        product,
        size: currentSizeObj?.size ?? selectedSize,
        quantity,
        branchId: selectedBranch,
        unitPrice,
        originalUnitPrice,
        appliedReferral: activeReferral,
        deliveryMethod,
        postOfficeTown,
        deliveryAddress,
      }),
    [
      product,
      currentSizeObj,
      selectedSize,
      quantity,
      selectedBranch,
      unitPrice,
      originalUnitPrice,
      activeReferral,
      deliveryMethod,
      postOfficeTown,
      deliveryAddress,
    ]
  );

  const whatsappUrl = useMemo(
    () => createWhatsAppUrl(whatsappMessage),
    [whatsappMessage]
  );

  const relatedProducts = useMemo(
    () =>
      perfumes
        .filter((p) => p.id !== product.id && p.availability !== 'Out of Stock')
        .slice(0, 3),
    [perfumes, product.id]
  );

  const handleAdd = () => {
    if (!currentSizeObj || !currentSizeObj.available) return;
    onAddToBasket(product, currentSizeObj.size, quantity);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  const handleOrderWhatsApp = () => {
    const now = Date.now();
    if (now - lastWhatsAppSubmitRef.current < 2500) {
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
    if (activeReferral && lineTotal !== null && referralBenefit) {
      const customerRef =
        deliveryMethod === 'post-office'
          ? `Post Office · ${postOfficeTown.trim()}`
          : deliveryMethod === 'driver-delivery'
          ? `Driver Delivery (${activeBranch?.city})`
          : `${activeBranch?.city} Store Pickup`;
      void recordCheckoutReferralSale({
        referral: activeReferral,
        orderSummary: `${product.name} (${currentSizeObj?.size ?? selectedSize} × ${quantity})`,
        reportedSubtotal: lineTotal,
        reportedDiscount: referralBenefit.discountAmount,
        customerRef,
      });
    }
    if (whatsappUrl) {
      lastWhatsAppSubmitRef.current = now;
      openExternalUrl(whatsappUrl);
    } else {
      setShowNumberNotice(true);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    } catch {
      // Ignore clipboard permission denial
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 pb-24 lg:pb-14 space-y-16">
      <div>
        <button
          type="button"
          onClick={onBackToShop}
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0A0A0A] hover:opacity-65 transition-opacity"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalogue</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
        <div className="lg:col-span-6 lg:sticky lg:top-28 space-y-5">
          <div className="relative aspect-[4/3] rounded-3xl bg-white border border-[#E5E5E5] overflow-hidden">
            <ResilientImage
              src={product.image}
              alt={`${product.name} by ${product.brand}`}
              fallbackTitle={product.name}
              loading="eager"
              fetchPriority="high"
              variant="detail"
              className="w-full h-full object-cover saturate-[1.1] contrast-[1.03]"
            />
            {product.onSpecial && (
              <span className="absolute top-4 left-4 bg-[#FACC15] text-[#0A0A0A] px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.14em] shadow-xs">
                {product.specialLabel || 'Special'}
                {(() => {
                  const tag = formatSpecialDiscountTag(
                    product.onSpecial,
                    product.specialDiscountPercent,
                    product.specialDiscountType,
                    product.specialDiscountAmount
                  );
                  return tag ? ` · ${tag}` : '';
                })()}
              </span>
            )}
          </div>

          {/* Sensory Wearing Timeline — See & Feel Wearing It Through Your Day */}
          <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A0A0A]">
                How It Wears Across Your Day
              </h2>
              <span className="text-[11px] text-[#525252]">
                {product.concentration}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <span className="block font-semibold text-[#0A0A0A]">
                  First 15 Mins · Morning Mist
                </span>
                <p className="text-[#404040] font-medium">
                  {product.notes.top.length > 0 ? product.notes.top.join(' · ') : 'Fresh opening'}
                </p>
                <p className="text-[11px] text-[#666666] leading-relaxed">
                  Your crisp first impression as you step out the door.
                </p>
              </div>
              <div className="space-y-1">
                <span className="block font-semibold text-[#0A0A0A]">
                  Hours 2–5 · The Room Trail
                </span>
                <p className="text-[#404040] font-medium">
                  {product.notes.heart.length > 0 ? product.notes.heart.join(' · ') : 'Warm heart'}
                </p>
                <p className="text-[11px] text-[#666666] leading-relaxed">
                  The signature people notice when you walk past.
                </p>
              </div>
              <div className="space-y-1">
                <span className="block font-semibold text-[#0A0A0A]">
                  Hours 6–12+ · Skin Dry-Down
                </span>
                <p className="text-[#404040] font-medium">
                  {product.notes.base.length > 0 ? product.notes.base.join(' · ') : 'Lasting base'}
                </p>
                <p className="text-[11px] text-[#666666] leading-relaxed">
                  Lingers softly on your collar and wrists into evening.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 lg:p-10 space-y-6">
          <div className="space-y-3 border-b border-[#E5E5E5] pb-5">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-[#525252] font-medium">
              <span className="text-[#0A0A0A] font-semibold">{product.brand}</span>
              <span aria-hidden="true">·</span>
              <span>{product.category}</span>
              <span aria-hidden="true">·</span>
              <span>{product.availability}</span>
              {product.availability !== 'Out of Stock' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#0A0A0A] font-semibold">
                    {getBranchAvailabilityLabel(product)}
                  </span>
                </>
              )}
              {product.isUnboxed && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#0A0A0A] font-semibold">Unboxed (No Box)</span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A] leading-tight">
              {product.name}
            </h1>

            <div className="pt-1 flex items-baseline gap-3 min-h-[2.25rem]">
              <AnimatePresence mode="wait">
                <motion.span
                  key={`${currentSizeObj?.size}-${quantity}-${lineTotal}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16 }}
                  className={`text-2xl sm:text-3xl font-bold tabular-nums inline-block ${
                    sizePricing.hasDiscount ? 'text-[#DC2626]' : 'text-[#0A0A0A]'
                  }`}
                >
                  {formatPrice(lineTotal)}
                </motion.span>
              </AnimatePresence>
              {sizePricing.hasDiscount && originalLineTotal !== null && (
                <span className="text-sm text-[#737373] line-through tabular-nums">
                  {formatPrice(originalLineTotal)}
                </span>
              )}
              {quantity > 1 && unitPrice !== null && (
                <span className="text-xs text-[#666666] tabular-nums">
                  ({formatPrice(unitPrice)} each)
                </span>
              )}
            </div>
          </div>

          <p className="text-sm sm:text-base text-[#404040] leading-relaxed">
            {product.description}
          </p>

          {product.isUnboxed && (
            <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-4 text-xs text-[#404040] leading-relaxed">
              <strong className="text-[#0A0A0A] font-semibold uppercase tracking-wider text-[11px] block mb-1">
                Unboxed Authentic Bottle
              </strong>
              100% genuine house fragrance bottle supplied without the outer cardboard retail box — offering better everyday value per millilitre with full juice volume.
            </div>
          )}

          {/* Bottle Size Picker + Real-Life Wear Duration */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
                Choose Your Bottle
              </span>
            </div>
            <div
              className={`grid gap-2.5 ${
                product.sizes.length === 1
                  ? 'grid-cols-1 max-w-[200px]'
                  : product.sizes.length === 2
                  ? 'grid-cols-2 max-w-sm'
                  : product.sizes.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-4'
              }`}
            >
              {product.sizes.map((opt, idx) => {
                const active = opt.size === currentSizeObj?.size;
                const eff = getEffectiveUnitPrice(
                  opt.price,
                  product.onSpecial,
                  product.specialDiscountPercent,
                  product.specialDiscountType,
                  product.specialDiscountAmount,
                  opt.size,
                  product.sizes
                );
                const optHasSpecial =
                  opt.available &&
                  Boolean(product.onSpecial) &&
                  opt.price !== null &&
                  eff !== null &&
                  eff < opt.price;
                return (
                  <button
                    key={`${opt.size}-${idx}`}
                    type="button"
                    disabled={!opt.available}
                    onClick={() => setSelectedSize(opt.size)}
                    className={`py-3 px-2.5 border rounded-xl text-center transition-colors ${
                      !opt.available
                        ? 'opacity-40 cursor-not-allowed bg-[#F5F5F5] border-[#E5E5E5]'
                        : active
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                        : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1 text-xs font-semibold tabular-nums">
                      <span>{opt.size}</span>
                      {optHasSpecial && (
                        <span className="px-1.5 py-0.2 rounded-full bg-[#FACC15] text-[#0A0A0A] text-[9px] font-bold uppercase tracking-wider">
                          Special
                        </span>
                      )}
                    </span>
                    <span
                      className={`block text-[11px] tabular-nums mt-0.5 ${
                        active ? 'text-white/75' : optHasSpecial ? 'text-[#DC2626] font-semibold' : 'text-[#666666]'
                      }`}
                    >
                      {opt.available ? formatPrice(eff) : 'Unavailable'}
                      {optHasSpecial && opt.price !== null && (
                        <span
                          className={`ml-1 line-through text-[10px] ${
                            active ? 'text-white/45' : 'text-[#888888]'
                          }`}
                        >
                          {formatPrice(opt.price)}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            {currentSizeObj && (
              <p className="text-xs text-[#525252]">
                {describeBottleWearLife(currentSizeObj.size, Boolean(product.isUnboxed))}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
              Quantity
            </span>
            <div className="inline-flex items-center border border-[#D4D4D4] rounded-full overflow-hidden">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="w-10 h-10 flex items-center justify-center hover:bg-[#F5F5F5]"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center text-sm font-semibold tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                aria-label="Increase quantity"
                className="w-10 h-10 flex items-center justify-center hover:bg-[#F5F5F5]"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <DeliveryMethodSelector
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
            const selectedBranchHasStock = isAvailableAtBranch(product, selectedBranch);
            if (
              deliveryMethod !== 'store-pickup' ||
              selectedBranchHasStock ||
              stockedBranches.length === 0
            ) {
              return null;
            }
            const alternativeBranch = stockedBranches[0];
            return (
              <div className="p-3.5 bg-[#FEF3C7] border border-[#F59E0B] rounded-xl text-xs text-[#92400E] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <p className="leading-relaxed">
                  <strong>{formatBranchName(alternativeBranch)} Stock Only:</strong>{' '}
                  This fragrance is currently available at our{' '}
                  <strong>{formatBranchName(alternativeBranch)}</strong> store, not in{' '}
                  {formatBranchName(selectedBranch)}.
                </p>
                <button
                  type="button"
                  onClick={() => onSelectBranch(alternativeBranch)}
                  className="px-3.5 py-1.5 rounded-full bg-[#0A0A0A] text-white text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap shrink-0 hover:bg-[#262626] transition-colors"
                >
                  Switch to {formatBranchName(alternativeBranch)}
                </button>
              </div>
            );
          })()}

          {activeReferral && (
            <div className="bg-[#F6F6F7] border border-[#0A0A0A] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
              <span>
                Influencer Referral <strong className="font-mono">{activeReferral.code}</strong> ({activeReferral.influencerName})
              </span>
              {referralBenefit && referralBenefit.discountAmount > 0 && (
                <span className="font-semibold text-[#0A0A0A] tabular-nums">
                  -{formatPrice(referralBenefit.discountAmount)}
                </span>
              )}
            </div>
          )}

          {deliveryFee > 0 && netLineTotal !== null && (
            <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
              <span className="text-[#525252]">
                Order Total (incl. {formatPrice(DRIVER_DELIVERY_FEE)} Driver Delivery)
              </span>
              <span className="font-bold text-[#0A0A0A] tabular-nums text-sm">
                {formatPrice(finalPayable)}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={!currentSizeObj?.available}
              onClick={handleAdd}
              className="py-3.5 px-5 rounded-full border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#F5F5F5] disabled:opacity-40 transition-colors flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider"
            >
              {addedFeedback ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Added to Cart</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4" />
                  <span>Add to Cart</span>
                </>
              )}
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              disabled={!currentSizeObj?.available}
              onClick={handleOrderWhatsApp}
              className="py-3.5 px-5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider"
            >
              <ShoppingBag className="w-4 h-4 text-white" />
              <span>Buy Now</span>
              {whatsappUrl && <ExternalLink className="w-3.5 h-3.5 opacity-75" />}
            </motion.button>
          </div>

          {/* Clear Next-Step Trust Line */}
          <div className="flex items-start gap-2.5 text-xs text-[#525252] pt-1">
            <ShieldCheck className="w-4 h-4 text-[#0A0A0A] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <strong className="text-[#0A0A0A] font-medium">What happens next:</strong>{' '}
              Tapping Buy Now sends this exact bottle and size to our {activeBranch?.city} team for immediate confirmation—collect at store, send via Post Office, or book driver delivery (+{formatPrice(DRIVER_DELIVERY_FEE)}).
            </p>
          </div>

          {showNumberNotice && !whatsappUrl && (
            <div className="p-4 bg-[#F6F6F7] border border-[#0A0A0A] rounded-2xl text-xs text-[#0A0A0A] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <strong>Copy Your Pre-Filled Order</strong>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 font-semibold hover:opacity-65"
                >
                  {copiedMessage ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedMessage ? 'Copied' : 'Copy Order'}</span>
                </button>
              </div>
              <pre className="p-3 bg-white border border-[#E5E5E5] rounded-xl text-[11px] whitespace-pre-wrap font-sans">
                {whatsappMessage}
              </pre>
            </div>
          )}
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="pt-8 border-t border-[#E5E5E5] space-y-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A]">
              More From the Catalogue
            </h2>
            <button
              type="button"
              onClick={onBackToShop}
              className="text-xs font-semibold uppercase tracking-wider text-[#0A0A0A] hover:opacity-65"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedProducts.map((rel, idx) => (
              <ProductCard
                key={rel.id}
                product={rel}
                index={idx}
                onViewDetails={onSelectProduct}
                onQuickWhatsApp={onQuickWhatsApp}
                onAddToBasket={onAddToBasket}
              />
            ))}
          </div>
        </section>
      )}

      {/* Mobile Sticky Quick Purchase Bar (Compact, within mobile sticky height cap) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E5E5E5] px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-[#525252] truncate">
            {currentSizeObj?.size} ·{' '}
            {deliveryMethod === 'driver-delivery'
              ? `Driver (+${formatPrice(DRIVER_DELIVERY_FEE)})`
              : deliveryMethod === 'post-office'
              ? `Post Office${postOfficeTown.trim() ? ` (${postOfficeTown.trim()})` : ''}`
              : `${activeBranch?.city} Pickup`}
          </p>
          <p className="text-sm font-semibold text-[#0A0A0A] tabular-nums">
            {formatPrice(finalPayable)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!currentSizeObj?.available}
            onClick={handleAdd}
            className="px-4 py-2.5 rounded-full border border-[#0A0A0A] text-[#0A0A0A] text-xs font-semibold whitespace-nowrap"
          >
            {addedFeedback ? 'Added' : 'Add to Cart'}
          </button>
          <button
            type="button"
            disabled={!currentSizeObj?.available}
            onClick={handleOrderWhatsApp}
            className="px-5 py-2.5 rounded-full bg-[#0A0A0A] text-white text-xs font-semibold whitespace-nowrap"
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
};

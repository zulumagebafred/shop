import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Banknote,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Minus,
  Plus,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { formatPrice, siteConfig } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import {
  BasketItem,
  BranchId,
  Coupon,
  DeliveryMethod,
  DRIVER_DELIVERY_FEE,
  InfluencerReferral,
  PaymentMethod,
  PublicReferral,
} from '../types/fragrance';
import {
  calculateCouponDiscount,
  calculateReferralBenefit,
  formatSpecialDiscountTag,
  revalidateBasketItems,
} from '../utils/pricing';
import {
  formatBranchName,
  getAvailableBranches,
  isAvailableAtBranch,
} from '../utils/branches';
import {
  buildBasketWhatsAppMessage,
  createWhatsAppUrl,
  getDeliveryFee,
  openExternalUrl,
} from '../utils/whatsapp';
import { DeliveryMethodSelector } from './DeliveryMethodSelector';
import { ResilientImage } from './ResilientImage';

interface BasketDrawerProps {
  isOpen: boolean;
  items: BasketItem[];
  selectedBranch: BranchId;
  deliveryMethod: DeliveryMethod;
  postOfficeTown: string;
  deliveryAddress: string;
  appliedCoupon: Coupon | null;
  appliedReferral: PublicReferral | InfluencerReferral | null;
  onApplyCoupon: (coupon: Coupon | null) => void;
  onApplyReferral: (referral: PublicReferral | InfluencerReferral | null) => void;
  onSelectBranch: (branch: BranchId) => void;
  onSelectDeliveryMethod: (method: DeliveryMethod) => void;
  onPostOfficeTownChange: (town: string) => void;
  onDeliveryAddressChange: (address: string) => void;
  onUpdateQuantity: (productId: string, size: BasketItem['size'], delta: number) => void;
  onRemoveItem: (productId: string, size: BasketItem['size']) => void;
  onReplaceBasket: (nextItems: BasketItem[]) => void;
  onClearBasket: () => void;
  onClose: () => void;
  onExploreShop: () => void;
}

export const BasketDrawer: React.FC<BasketDrawerProps> = ({
  isOpen,
  items,
  selectedBranch,
  deliveryMethod,
  postOfficeTown,
  deliveryAddress,
  appliedCoupon,
  appliedReferral,
  onApplyCoupon,
  onApplyReferral,
  onSelectBranch,
  onSelectDeliveryMethod,
  onPostOfficeTownChange,
  onDeliveryAddressChange,
  onUpdateQuantity,
  onRemoveItem,
  onReplaceBasket,
  onClearBasket,
  onClose,
  onExploreShop,
}) => {
  const {
    lookupCouponByCode,
    lookupReferralByCode,
    recordCheckoutReferralSale,
    perfumes,
    catalogueLoading,
    hampers,
    combos,
    weeklySpecial,
    ensureSecondaryLoaded,
  } = useStore();
  const [customerNote, setCustomerNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('whatsapp-cash-momo');
  const [couponInput, setCouponInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMessagePreview, setShowMessagePreview] = useState(false);
  const [showDispatchNotice, setShowDispatchNotice] = useState(false);
  const [postOfficeError, setPostOfficeError] = useState(false);
  const [deliveryAddressError, setDeliveryAddressError] = useState(false);
  const [pricesRefreshedNotice, setPricesRefreshedNotice] = useState(false);
  const townInputRef = React.useRef<HTMLSelectElement | null>(null);
  const addressInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastOrderSubmitRef = React.useRef<number>(0);

  useEffect(() => {
    if (!isOpen || items.length === 0) return;
    if (items.some((item) => item.productId.startsWith('hamper-'))) {
      void ensureSecondaryLoaded('hampers');
    }
    if (items.some((item) => item.productId.startsWith('combo-'))) {
      void ensureSecondaryLoaded('combos');
    }
  }, [isOpen, items, ensureSecondaryLoaded]);

  const revalidation = useMemo(
    () => revalidateBasketItems(items, perfumes, hampers, combos, weeklySpecial),
    [items, perfumes, hampers, combos, weeklySpecial]
  );

  const basketNeedsRefresh =
    revalidation.hasStalePrices || revalidation.hasUnavailableItems;
  const basketBlockedFromCheckout =
    basketNeedsRefresh || revalidation.hasUnverifiedItems || catalogueLoading;

  const authoritativeItems = revalidation.validatedItems;

  const activeBranch = useMemo(
    () =>
      siteConfig.branches.find((b) => b.id === selectedBranch) ??
      siteConfig.branches[0],
    [selectedBranch]
  );

  const couponCalc = useMemo(
    () => calculateCouponDiscount(authoritativeItems, appliedCoupon),
    [authoritativeItems, appliedCoupon]
  );

  const activeValidCoupon = couponCalc.valid ? appliedCoupon : null;
  const activeReferral = appliedReferral?.active ? appliedReferral : null;
  const deliveryFee = getDeliveryFee(deliveryMethod);
  const itemsAfterCoupon =
    activeValidCoupon && couponCalc.valid ? couponCalc.finalTotal : couponCalc.subtotal;
  const referralBenefit = useMemo(
    () => calculateReferralBenefit(itemsAfterCoupon, activeReferral),
    [itemsAfterCoupon, activeReferral]
  );
  const finalCartTotal = referralBenefit.netOrderAmount + deliveryFee;

  const whatsappMessage = useMemo(
    () =>
      buildBasketWhatsAppMessage(
        authoritativeItems,
        selectedBranch,
        customerNote,
        activeValidCoupon,
        deliveryMethod,
        postOfficeTown,
        deliveryAddress,
        activeReferral,
        paymentMethod
      ),
    [
      authoritativeItems,
      selectedBranch,
      customerNote,
      activeValidCoupon,
      deliveryMethod,
      postOfficeTown,
      deliveryAddress,
      activeReferral,
      paymentMethod,
    ]
  );

  const whatsappUrl = useMemo(
    () => createWhatsAppUrl(whatsappMessage),
    [whatsappMessage]
  );

  const handleRefreshBasketPrices = () => {
    onReplaceBasket(revalidation.validatedItems);
    setPricesRefreshedNotice(true);
    window.setTimeout(() => setPricesRefreshedNotice(false), 3000);
  };

  const handleApplyCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponFeedback(null);
    if (!couponInput.trim()) return;

    setApplyingCoupon(true);
    try {
      const { coupon } = await lookupCouponByCode(couponInput);
      if (coupon) {
        const check = calculateCouponDiscount(authoritativeItems, coupon);
        if (!check.valid) {
          setCouponFeedback(check.errorReason ?? 'Coupon does not apply to these items.');
          return;
        }
        onApplyCoupon(coupon);
        setCouponInput('');
        return;
      }

      const { referral, error: referralError } = await lookupReferralByCode(couponInput);
      if (referral) {
        onApplyReferral(referral);
        setCouponInput('');
        return;
      }

      setCouponFeedback(
        referralError ?? `Code "${couponInput.trim().toUpperCase()}" was not found.`
      );
    } catch {
      setCouponFeedback('Could not verify code right now. Please try again.');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleCopyMessage = async () => {
    if (basketBlockedFromCheckout) return;
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleOrderClick = () => {
    if (basketBlockedFromCheckout) return;
    const now = Date.now();
    if (now - lastOrderSubmitRef.current < 2500) {
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

    if (activeReferral) {
      const summary = authoritativeItems
        .map((i) => `${i.productName} (${i.size} × ${i.quantity})`)
        .join(', ');
      const customerRef =
        deliveryMethod === 'post-office'
          ? `Post Office · ${postOfficeTown.trim()}`
          : deliveryMethod === 'driver-delivery'
          ? `Driver Delivery (${activeBranch?.city})`
          : `${activeBranch?.city} Store Pickup`;
      void recordCheckoutReferralSale({
        referral: activeReferral,
        orderSummary: summary,
        reportedSubtotal: itemsAfterCoupon,
        reportedDiscount: referralBenefit.discountAmount,
        customerRef: customerNote.trim() ? `${customerRef} · ${customerNote.trim()}` : customerRef,
      });
    }

    if (whatsappUrl) {
      lastOrderSubmitRef.current = now;
      openExternalUrl(whatsappUrl);
    } else {
      setShowDispatchNotice(true);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Shopping Cart"
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#F6F6F7] text-[#0A0A0A] rounded-l-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#E5E5E5] flex items-center justify-between bg-white">
              <div>
                <h2 className="text-xl font-semibold text-[#0A0A0A]">
                  Your Cart
                </h2>
                <p className="text-xs text-[#666666] mt-0.5">
                  Review items, apply coupon codes &amp; complete your order
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close cart"
                className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F4F4F5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6 space-y-6">
              {items.length === 0 ? (
                <div className="py-14 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full border border-[#E5E5E5] flex items-center justify-center bg-white">
                    <ShoppingCart className="w-5 h-5 text-[#0A0A0A]" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-semibold text-[#0A0A0A]">
                      Your cart is empty
                    </h3>
                    <p className="text-sm text-[#525252] max-w-xs mx-auto">
                      Select decants or full-size bottles to add them to your cart.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onExploreShop();
                    }}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold tracking-wider uppercase"
                  >
                    Explore Fragrances
                  </button>
                </div>
              ) : (
                <>
                  {/* Stale Price / Availability Alert */}
                  {basketNeedsRefresh && (
                    <div
                      role="alert"
                      className="p-3.5 bg-[#FEF3C7] border border-[#F59E0B] rounded-2xl text-xs text-[#92400E] space-y-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#B45309]" />
                        <div className="space-y-1">
                          <p className="font-semibold text-[#78350F]">
                            Catalogue prices or availability changed
                          </p>
                          <p className="leading-snug">
                            Please refresh your basket to sync live store prices before placing your WhatsApp order:
                          </p>
                          <ul className="space-y-0.5 pt-0.5 text-[11px] font-medium">
                            {revalidation.staleChanges.map((chg) => (
                              <li key={`${chg.productId}-${chg.size}`}>
                                · {chg.productName} ({chg.size}):{' '}
                                {chg.reason === 'unavailable'
                                  ? 'Currently out of stock / removed'
                                  : `${formatPrice(chg.previousUnitPrice)} → ${formatPrice(
                                      chg.currentUnitPrice
                                    )}`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRefreshBasketPrices}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#0A0A0A] text-white text-[11px] font-semibold uppercase tracking-wider hover:bg-[#262626]"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Refresh Basket Prices</span>
                      </button>
                    </div>
                  )}

                  {pricesRefreshedNotice && !basketNeedsRefresh && (
                    <div className="p-3 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl text-xs text-[#166534] font-medium flex items-center gap-2">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>Basket prices updated to live catalogue rates.</span>
                    </div>
                  )}

                  {/* Line Items */}
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {items.map((item) => {
                        const delta = revalidation.staleChanges.find(
                          (c) =>
                            c.productId === item.productId &&
                            c.size.toLowerCase() === item.size.toLowerCase()
                        );
                        const liveItem = authoritativeItems.find(
                          (a) =>
                            a.productId === item.productId &&
                            a.size.toLowerCase() === item.size.toLowerCase()
                        );
                        const activeUnitPrice = liveItem ? liveItem.unitPrice : item.unitPrice;
                        const activeOrigPrice = liveItem
                          ? liveItem.originalUnitPrice
                          : item.originalUnitPrice;
                        const lineTotal =
                          activeUnitPrice !== null ? activeUnitPrice * item.quantity : null;
                        const origTotal =
                          activeOrigPrice !== undefined &&
                          activeOrigPrice !== null &&
                          activeUnitPrice !== null &&
                          activeOrigPrice > activeUnitPrice
                            ? activeOrigPrice * item.quantity
                            : null;

                        return (
                          <motion.div
                            key={`${item.productId}-${item.size}`}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="bg-white border border-[#E5E5E5] rounded-2xl p-3 flex gap-3.5"
                          >
                            <div className="w-20 h-20 shrink-0 rounded-xl bg-[#F5F5F5] overflow-hidden">
                              <ResilientImage
                                src={item.image}
                                alt={item.productName}
                                fallbackTitle={item.productName}
                                variant="thumb"
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[11px] uppercase tracking-wider text-[#525252]">
                                    {item.brand} · {item.size}
                                    {(() => {
                                      const tag = formatSpecialDiscountTag(
                                        item.onSpecial,
                                        item.specialDiscountPercent,
                                        item.specialDiscountType,
                                        item.specialDiscountAmount
                                      );
                                      return tag ? ` · ${tag}` : '';
                                    })()}
                                  </p>
                                  <h3 className="text-sm font-semibold text-[#0A0A0A] truncate">
                                    {item.productName}
                                  </h3>
                                  {delta && (
                                    <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FEF3C7] text-[#92400E]">
                                      {delta.reason === 'unavailable'
                                        ? 'Unavailable — tap refresh'
                                        : 'Price updated'}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onRemoveItem(item.productId, item.size)}
                                  aria-label={`Remove ${item.productName} (${item.size})`}
                                  className="text-[#737373] hover:text-[#0A0A0A] p-1 rounded-full"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="flex items-center justify-between mt-3">
                                <div className="inline-flex items-center border border-[#D4D4D4] rounded-full overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateQuantity(item.productId, item.size, -1)
                                    }
                                    aria-label="Decrease quantity"
                                    className="w-7 h-7 flex items-center justify-center hover:bg-[#F5F5F5] text-[#0A0A0A]"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="w-8 text-center text-xs font-medium tabular-nums">
                                    {item.quantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateQuantity(item.productId, item.size, 1)
                                    }
                                    aria-label="Increase quantity"
                                    className="w-7 h-7 flex items-center justify-center hover:bg-[#F5F5F5] text-[#0A0A0A]"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="text-right">
                                  {delta &&
                                    delta.reason !== 'unavailable' &&
                                    delta.previousUnitPrice !== null && (
                                      <span className="block text-[10px] text-[#B45309] line-through tabular-nums">
                                        {formatPrice(delta.previousUnitPrice * item.quantity)}
                                      </span>
                                    )}
                                  {origTotal !== null && (
                                    <span className="block text-[10px] text-[#737373] line-through tabular-nums">
                                      {formatPrice(origTotal)}
                                    </span>
                                  )}
                                  <span className="text-sm font-semibold text-[#0A0A0A] tabular-nums">
                                    {delta?.reason === 'unavailable'
                                      ? 'Unavailable'
                                      : formatPrice(lineTotal)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Promo / Coupon or Influencer Code Redemption */}
                  <div className="space-y-2.5 pt-2 border-t border-[#E5E5E5]">
                    <label
                      htmlFor="basket-coupon"
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                    >
                      <Tag className="w-3.5 h-3.5 text-[#0A0A0A]" />
                      <span>Promo or Influencer Code</span>
                    </label>

                    {activeReferral && (
                      <div className="bg-white border border-[#0A0A0A] rounded-xl p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#0A0A0A] font-mono uppercase">
                            Referral: {activeReferral.code}
                          </p>
                          <p className="text-[11px] text-[#525252] truncate">
                            Referred by {activeReferral.influencerName}
                            {activeReferral.socialHandle ? ` (${activeReferral.socialHandle})` : ''}
                            {referralBenefit.discountAmount > 0
                              ? ` · Saving ${formatPrice(referralBenefit.discountAmount)}`
                              : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onApplyReferral(null)}
                          className="text-xs underline text-[#525252] hover:text-[#0A0A0A] shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    {appliedCoupon && couponCalc.valid ? (
                      <div className="bg-white border border-[#0A0A0A] rounded-xl p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#0A0A0A] font-mono uppercase">
                            {appliedCoupon.code} Applied
                          </p>
                          <p className="text-[11px] text-[#525252]">
                            Saving {formatPrice(couponCalc.discountAmount)}
                            {appliedCoupon.description ? ` · ${appliedCoupon.description}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onApplyCoupon(null);
                            setCouponFeedback(null);
                          }}
                          className="text-xs underline text-[#525252] hover:text-[#0A0A0A] shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleApplyCouponSubmit} className="flex gap-2">
                        <input
                          id="basket-coupon"
                          type="text"
                          value={couponInput}
                          onChange={(e) => {
                            setCouponInput(e.target.value.toUpperCase());
                            setCouponFeedback(null);
                          }}
                          placeholder="Enter coupon or influencer referral code"
                          maxLength={32}
                          className="flex-1 px-3.5 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs font-mono uppercase text-[#0A0A0A] placeholder:text-[#737373] placeholder:normal-case placeholder:font-sans focus:outline-none focus:border-[#0A0A0A]"
                        />
                        <button
                          type="submit"
                          disabled={applyingCoupon || !couponInput.trim()}
                          className="px-4 py-2 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-40 text-xs font-semibold uppercase tracking-wider shrink-0"
                        >
                          {applyingCoupon ? '...' : 'Apply'}
                        </button>
                      </form>
                    )}

                    {(couponFeedback || (appliedCoupon && !couponCalc.valid && couponCalc.errorReason)) && (
                      <p className="text-[11px] text-[#0A0A0A] bg-white border border-[#D4D4D4] rounded-xl px-3 py-2">
                        {couponFeedback || couponCalc.errorReason}
                      </p>
                    )}
                  </div>

                  {/* Collection / Delivery Method */}
                  <div className="pt-2 border-t border-[#E5E5E5]">
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
                      if (deliveryMethod !== 'store-pickup') return null;
                      const mismatchedProducts = items
                        .map((item) => {
                          const match = perfumes.find((p) => p.id === item.productId);
                          if (!match) return null;
                          const stocked = getAvailableBranches(match);
                          if (stocked.length === 0 || isAvailableAtBranch(match, selectedBranch)) {
                            return null;
                          }
                          return { item, stocked };
                        })
                        .filter(
                          (entry): entry is { item: BasketItem; stocked: BranchId[] } =>
                            entry !== null
                        );

                      if (mismatchedProducts.length === 0) return null;

                      const otherBranch: BranchId =
                        selectedBranch === 'manzini' ? 'mbabane' : 'manzini';
                      const allItemsInOther = items.every((item) => {
                        const match = perfumes.find((p) => p.id === item.productId);
                        if (!match) return true;
                        const stocked = getAvailableBranches(match);
                        return stocked.length === 0 || stocked.includes(otherBranch);
                      });

                      return (
                        <div className="mt-3 p-3 bg-[#FEF3C7] border border-[#F59E0B] rounded-xl text-xs text-[#92400E] flex flex-col gap-2">
                          <p className="leading-snug">
                            <strong>Branch Stock Notice:</strong>{' '}
                            {mismatchedProducts.map((m) => m.item.productName).join(', ')}{' '}
                            {mismatchedProducts.length === 1 ? 'is' : 'are'} currently stocked at our{' '}
                            <strong>{formatBranchName(otherBranch)}</strong> branch rather than{' '}
                            {formatBranchName(selectedBranch)}.
                          </p>
                          {allItemsInOther ? (
                            <button
                              type="button"
                              onClick={() => onSelectBranch(otherBranch)}
                              className="self-start px-3 py-1.5 rounded-full bg-[#0A0A0A] text-white text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
                            >
                              Switch Pickup to {formatBranchName(otherBranch)}
                            </button>
                          ) : (
                            <p className="text-[11px] font-medium">
                              Tip: Choose Post Office or Driver Delivery so we can coordinate stock across both branches.
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Payment Method Selector */}
                  <div className="space-y-2.5 pt-2 border-t border-[#E5E5E5]">
                    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
                      <CreditCard className="w-3.5 h-3.5 text-[#0A0A0A]" />
                      <span>Payment Method</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('whatsapp-cash-momo')}
                        aria-pressed={paymentMethod === 'whatsapp-cash-momo'}
                        className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                          paymentMethod === 'whatsapp-cash-momo'
                            ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                            : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <Banknote className="w-3.5 h-3.5 shrink-0" />
                          <span>Cash / MoMo / EFT</span>
                        </div>
                        <span
                          className={`text-[10px] leading-snug ${
                            paymentMethod === 'whatsapp-cash-momo'
                              ? 'text-white/75'
                              : 'text-[#666666]'
                          }`}
                        >
                          Pay on pickup, delivery, or EFT
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('card')}
                        aria-pressed={paymentMethod === 'card'}
                        className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                          paymentMethod === 'card'
                            ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                            : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <CreditCard className="w-3.5 h-3.5 shrink-0" />
                          <span>Card Payment</span>
                        </div>
                        <span
                          className={`text-[10px] leading-snug ${
                            paymentMethod === 'card' ? 'text-[#FACC15]' : 'text-[#666666]'
                          }`}
                        >
                          Visa / Mastercard link or POS
                        </span>
                      </button>
                    </div>

                    {paymentMethod === 'card' && (
                      <div className="bg-white border border-[#0A0A0A]/20 rounded-xl p-3 text-[11px] text-[#303030] space-y-2 leading-relaxed">
                        <p>
                          <strong className="text-[#0A0A0A]">Card Payment Selected:</strong>{' '}
                          {siteConfig.cardPaymentUrl
                            ? 'Tap "Pay by Card" below or send your order on WhatsApp to confirm stock first.'
                            : 'Send your order below and our staff will reply with a secure card payment link (or have our card machine ready at pickup/delivery).'}
                        </p>
                        {siteConfig.cardPaymentUrl && (
                          <button
                            type="button"
                            onClick={() => openExternalUrl(siteConfig.cardPaymentUrl)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0A0A0A] text-white text-[11px] font-semibold uppercase tracking-wider hover:bg-[#262626] transition-colors"
                          >
                            <CreditCard className="w-3 h-3" />
                            <span>Open Card Payment Link</span>
                            <ExternalLink className="w-3 h-3 opacity-75" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Optional Note */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="basket-note"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                    >
                      Order Note (Optional)
                    </label>
                    <input
                      id="basket-note"
                      type="text"
                      value={customerNote}
                      onChange={(e) => setCustomerNote(e.target.value)}
                      placeholder="Your name, pickup time, or delivery area..."
                      className="w-full px-3.5 py-2.5 bg-white border border-[#D4D4D4] rounded-xl text-sm text-[#0A0A0A] placeholder:text-[#737373] focus:outline-none focus:border-[#0A0A0A]"
                    />
                  </div>

                  {/* Optional Collapsible Order Message Preview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setShowMessagePreview((v) => !v)}
                        className="text-xs font-medium text-[#525252] hover:text-[#0A0A0A] underline underline-offset-4"
                      >
                        {showMessagePreview ? 'Hide order text' : 'View / copy order text'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyMessage}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#0A0A0A] hover:opacity-70"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    {(showMessagePreview || showDispatchNotice) && (
                      <pre className="p-3.5 bg-white border border-[#E5E5E5] rounded-xl text-[11px] leading-relaxed text-[#404040] whitespace-pre-wrap font-sans max-h-40 overflow-y-auto">
                        {whatsappMessage}
                      </pre>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="p-6 border-t border-[#E5E5E5] bg-white space-y-3">
                {deliveryFee > 0 ||
                (couponCalc.valid && couponCalc.discountAmount > 0) ||
                referralBenefit.discountAmount > 0 ? (
                  <div className="space-y-1.5 pb-1">
                    <div className="flex items-baseline justify-between text-xs text-[#666666]">
                      <span>Items Subtotal</span>
                      <span className="tabular-nums">{formatPrice(couponCalc.subtotal)}</span>
                    </div>
                    {couponCalc.valid && couponCalc.discountAmount > 0 && (
                      <div className="flex items-baseline justify-between text-xs font-medium text-[#0A0A0A]">
                        <span>Coupon ({appliedCoupon?.code})</span>
                        <span className="tabular-nums">-{formatPrice(couponCalc.discountAmount)}</span>
                      </div>
                    )}
                    {activeReferral && referralBenefit.discountAmount > 0 && (
                      <div className="flex items-baseline justify-between text-xs font-medium text-[#0A0A0A]">
                        <span>Influencer Perk ({activeReferral.code})</span>
                        <span className="tabular-nums">-{formatPrice(referralBenefit.discountAmount)}</span>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex items-baseline justify-between text-xs font-medium text-[#DC2626]">
                        <span>Driver Delivery</span>
                        <span className="tabular-nums">+{formatPrice(DRIVER_DELIVERY_FEE)}</span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between pt-1.5 border-t border-[#E5E5E5]">
                      <span className="text-xs uppercase tracking-wider font-semibold text-[#0A0A0A]">
                        Order Total
                      </span>
                      <span className="text-lg font-bold text-[#0A0A0A] tabular-nums">
                        {formatPrice(finalCartTotal)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs uppercase tracking-wider text-[#525252]">
                      Order Total
                    </span>
                    <span className="text-lg font-bold text-[#0A0A0A] tabular-nums">
                      {formatPrice(finalCartTotal)}
                    </span>
                  </div>
                )}

                <p className="text-[11px] text-[#525252] leading-relaxed">
                  {basketNeedsRefresh
                    ? 'Tap Refresh Basket Prices above to confirm current pricing before placing your order.'
                    : revalidation.hasUnverifiedItems || catalogueLoading
                    ? 'Syncing live store catalogue prices...'
                    : paymentMethod === 'card'
                    ? `Card payment selected — staff will confirm stock and send a secure card payment link (or prepare the card machine at our ${activeBranch?.city} store).`
                    : deliveryMethod === 'driver-delivery'
                    ? `Estimated quote includes ${formatPrice(DRIVER_DELIVERY_FEE)} driver delivery dispatched from our ${activeBranch?.city} store—final total confirmed by staff on WhatsApp.`
                    : deliveryMethod === 'post-office'
                    ? `Dispatched via Post Office to ${postOfficeTown.trim() || 'your town'} from our ${activeBranch?.city} store—final quote confirmed by staff on WhatsApp.`
                    : `Estimated quote for collection at our ${activeBranch?.city} store—pay via Cash, MoMo, or EFT.`}
                </p>

                <button
                  type="button"
                  onClick={handleOrderClick}
                  disabled={basketBlockedFromCheckout}
                  className="w-full py-3.5 px-5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-45 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-xs font-semibold tracking-wider uppercase"
                >
                  {paymentMethod === 'card' ? (
                    <CreditCard className="w-4 h-4 text-[#FACC15]" />
                  ) : (
                    <ShoppingBag className="w-4 h-4 text-white" />
                  )}
                  <span>
                    {basketNeedsRefresh
                      ? 'Refresh Prices to Order'
                      : revalidation.hasUnverifiedItems || catalogueLoading
                      ? 'Verifying Prices...'
                      : paymentMethod === 'card'
                      ? `Order & Pay by Card · ${formatPrice(finalCartTotal)}`
                      : `Buy Now · ${formatPrice(finalCartTotal)}`}
                  </span>
                  {!basketBlockedFromCheckout && whatsappUrl && (
                    <ExternalLink className="w-3.5 h-3.5 opacity-75" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onClearBasket}
                  className="w-full py-2 rounded-full text-xs text-[#666666] hover:text-[#0A0A0A] transition-colors"
                >
                  Clear Cart
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

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
} from '../types/fragrance';
import { calculateCouponDiscount } from '../utils/pricing';
import { buildBasketWhatsAppMessage, createWhatsAppUrl, getDeliveryFee } from '../utils/whatsapp';
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
  onApplyCoupon: (coupon: Coupon | null) => void;
  onSelectBranch: (branch: BranchId) => void;
  onSelectDeliveryMethod: (method: DeliveryMethod) => void;
  onPostOfficeTownChange: (town: string) => void;
  onDeliveryAddressChange: (address: string) => void;
  onUpdateQuantity: (productId: string, size: BasketItem['size'], delta: number) => void;
  onRemoveItem: (productId: string, size: BasketItem['size']) => void;
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
  onApplyCoupon,
  onSelectBranch,
  onSelectDeliveryMethod,
  onPostOfficeTownChange,
  onDeliveryAddressChange,
  onUpdateQuantity,
  onRemoveItem,
  onClearBasket,
  onClose,
  onExploreShop,
}) => {
  const { lookupCouponByCode } = useStore();
  const [customerNote, setCustomerNote] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [couponFeedback, setCouponFeedback] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showMessagePreview, setShowMessagePreview] = useState(false);
  const [showDispatchNotice, setShowDispatchNotice] = useState(false);
  const [postOfficeError, setPostOfficeError] = useState(false);
  const [deliveryAddressError, setDeliveryAddressError] = useState(false);
  const townInputRef = React.useRef<HTMLInputElement | null>(null);
  const addressInputRef = React.useRef<HTMLInputElement | null>(null);

  const activeBranch = useMemo(
    () =>
      siteConfig.branches.find((b) => b.id === selectedBranch) ??
      siteConfig.branches[0],
    [selectedBranch]
  );

  const couponCalc = useMemo(
    () => calculateCouponDiscount(items, appliedCoupon),
    [items, appliedCoupon]
  );

  const activeValidCoupon = couponCalc.valid ? appliedCoupon : null;
  const deliveryFee = getDeliveryFee(deliveryMethod);
  const itemsAfterCoupon =
    activeValidCoupon && couponCalc.valid ? couponCalc.finalTotal : couponCalc.subtotal;
  const finalCartTotal = itemsAfterCoupon + deliveryFee;

  const whatsappMessage = useMemo(
    () =>
      buildBasketWhatsAppMessage(
        items,
        selectedBranch,
        customerNote,
        activeValidCoupon,
        deliveryMethod,
        postOfficeTown,
        deliveryAddress
      ),
    [
      items,
      selectedBranch,
      customerNote,
      activeValidCoupon,
      deliveryMethod,
      postOfficeTown,
      deliveryAddress,
    ]
  );

  const whatsappUrl = useMemo(
    () => createWhatsAppUrl(whatsappMessage),
    [whatsappMessage]
  );

  const handleApplyCouponSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponFeedback(null);
    if (!couponInput.trim()) return;

    setApplyingCoupon(true);
    try {
      const { coupon, error } = await lookupCouponByCode(couponInput);
      if (!coupon) {
        setCouponFeedback(error ?? 'Invalid coupon code.');
        return;
      }
      const check = calculateCouponDiscount(items, coupon);
      if (!check.valid) {
        setCouponFeedback(check.errorReason ?? 'Coupon does not apply to these items.');
        return;
      }
      onApplyCoupon(coupon);
      setCouponInput('');
    } catch {
      setCouponFeedback('Could not verify coupon right now. Please try again.');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleOrderClick = () => {
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
    if (whatsappUrl) {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
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
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
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
                  {/* Line Items */}
                  <div className="space-y-3">
                    <AnimatePresence initial={false}>
                      {items.map((item) => {
                        const lineTotal =
                          item.unitPrice !== null ? item.unitPrice * item.quantity : null;
                        const origTotal =
                          item.originalUnitPrice !== undefined &&
                          item.originalUnitPrice !== null &&
                          item.unitPrice !== null &&
                          item.originalUnitPrice > item.unitPrice
                            ? item.originalUnitPrice * item.quantity
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
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-[11px] uppercase tracking-wider text-[#525252]">
                                    {item.brand} · {item.size}
                                    {item.onSpecial && item.specialDiscountPercent
                                      ? ` · -${item.specialDiscountPercent}%`
                                      : ''}
                                  </p>
                                  <h3 className="text-sm font-semibold text-[#0A0A0A] truncate">
                                    {item.productName}
                                  </h3>
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
                                  {origTotal !== null && (
                                    <span className="block text-[10px] text-[#737373] line-through tabular-nums">
                                      {formatPrice(origTotal)}
                                    </span>
                                  )}
                                  <span className="text-sm font-semibold text-[#0A0A0A] tabular-nums">
                                    {formatPrice(lineTotal)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Coupon Code Redemption */}
                  <div className="space-y-2.5 pt-2 border-t border-[#E5E5E5]">
                    <label
                      htmlFor="basket-coupon"
                      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                    >
                      <Tag className="w-3.5 h-3.5 text-[#0A0A0A]" />
                      <span>Promo / Coupon Code</span>
                    </label>

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
                          placeholder="Enter code from social post or live stream"
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
                {deliveryFee > 0 || (couponCalc.valid && couponCalc.discountAmount > 0) ? (
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
                  {deliveryMethod === 'driver-delivery'
                    ? `Includes ${formatPrice(DRIVER_DELIVERY_FEE)} driver delivery dispatched from our ${activeBranch?.city} store—no card entry needed.`
                    : deliveryMethod === 'post-office'
                    ? `Dispatched via Post Office to ${postOfficeTown.trim() || 'your town'} from our ${activeBranch?.city} store.`
                    : `Ready for collection at our ${activeBranch?.city} store—no card entry or sign-up needed.`}
                </p>

                <button
                  type="button"
                  onClick={handleOrderClick}
                  className="w-full py-3.5 px-5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors flex items-center justify-center gap-2 text-xs font-semibold tracking-wider uppercase"
                >
                  <ShoppingBag className="w-4 h-4 text-white" />
                  <span>Buy Now · {formatPrice(finalCartTotal)}</span>
                  {whatsappUrl && <ExternalLink className="w-3.5 h-3.5 opacity-75" />}
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

import React from 'react';
import { motion } from 'motion/react';
import { ShoppingBag } from 'lucide-react';
import { formatPrice } from '../config/siteConfig';
import { FragranceProduct, PriceRangeFilter } from '../types/fragrance';
import { getBestPriceOptionForRange, getProductPriceSummary } from '../utils/pricing';
import { ResilientImage } from './ResilientImage';

interface ProductCardProps {
  product: FragranceProduct;
  onViewDetails: (product: FragranceProduct) => void;
  onQuickWhatsApp: (product: FragranceProduct) => void;
  index?: number;
  disableEntranceAnimation?: boolean;
  imageLoading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  priceRange?: PriceRangeFilter;
}

function getScentPreview(product: FragranceProduct): string {
  const picks = [
    product.notes.top[0],
    product.notes.heart[0],
    product.notes.base[0],
  ].filter(Boolean);

  if (picks.length > 0) {
    return picks.join(' · ');
  }
  return product.concentration || 'Eau de Parfum';
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onViewDetails,
  onQuickWhatsApp,
  index = 0,
  disableEntranceAnimation = false,
  imageLoading = 'lazy',
  fetchPriority = 'auto',
  priceRange = 'all',
}) => {
  const availableSizes = product.sizes.filter((s) => s.available);
  const summary = getProductPriceSummary(product);
  const rangedMatch =
    priceRange !== 'all' ? getBestPriceOptionForRange(product, priceRange) : null;

  const displayOriginal = rangedMatch
    ? rangedMatch.originalPrice
    : summary.highestOriginal;
  const displayEffective = rangedMatch
    ? rangedMatch.effectivePrice
    : summary.highestEffective;
  const displaySize = rangedMatch ? rangedMatch.size : summary.highestSize;
  const hasDiscount = rangedMatch ? rangedMatch.hasDiscount : summary.hasDiscount;

  const priceDisplay =
    displayEffective !== null ? formatPrice(displayEffective) : 'Price on Request';
  const originalDisplay =
    displayOriginal !== null ? formatPrice(displayOriginal) : 'Price on Request';
  const savedAmount =
    hasDiscount &&
    displayOriginal !== null &&
    displayEffective !== null &&
    displayOriginal > displayEffective
      ? displayOriginal - displayEffective
      : 0;

  const scentPreview = getScentPreview(product);

  return (
    <motion.article
      initial={disableEntranceAnimation ? false : { opacity: 0, y: 10 }}
      whileInView={disableEntranceAnimation ? undefined : { opacity: 1, y: 0 }}
      viewport={disableEntranceAnimation ? undefined : { once: true, amount: 0.04 }}
      whileHover={{ y: -2 }}
      transition={{
        duration: 0.2,
        delay: disableEntranceAnimation ? 0 : Math.min(index * 0.025, 0.1),
        ease: [0.16, 1, 0.3, 1],
      }}
      className="group bg-white border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-2xl p-3 flex flex-col h-full transition-colors duration-200 hover:shadow-[0_14px_32px_-14px_rgba(0,0,0,0.1)]"
    >
      <button
        type="button"
        onClick={() => onViewDetails(product)}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-white border border-[#F0F0F0] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]"
      >
        <ResilientImage
          src={product.image}
          alt={`${product.name} by ${product.brand}`}
          fallbackTitle={product.name}
          loading={imageLoading}
          fetchPriority={fetchPriority}
          className="w-full h-full object-cover saturate-[1.12] contrast-[1.03] transition-transform duration-400 ease-out group-hover:scale-[1.03]"
        />
        {(product.availability !== 'In Stock' || hasDiscount || product.onSpecial) && (
          <div className="absolute top-2.5 left-2.5">
            {product.availability === 'Out of Stock' ? (
              <span className="bg-white/95 text-[#991B1B] border border-[#FCA5A5] px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide">
                Out of Stock
              </span>
            ) : hasDiscount && savedAmount > 0 ? (
              <span className="inline-block bg-[#FACC15] text-[#0A0A0A] px-3 py-1 rounded-full text-[11px] font-bold tracking-tight shadow-xs tabular-nums">
                Save {formatPrice(savedAmount)}
              </span>
            ) : product.onSpecial ? (
              <span className="inline-block bg-[#FACC15] text-[#0A0A0A] px-3 py-1 rounded-full text-[11px] font-bold tracking-tight shadow-xs">
                {product.specialLabel || 'Special'}
                {product.specialDiscountPercent ? ` · -${product.specialDiscountPercent}%` : ''}
              </span>
            ) : (
              <span className="bg-white/95 text-[#0A0A0A] border border-[#E5E5E5] px-2.5 py-1 rounded-full text-[10px] font-medium tracking-wide">
                {product.availability}
              </span>
            )}
          </div>
        )}
      </button>

      <div className="px-2 pt-3.5 pb-1.5 flex-1 flex flex-col justify-between gap-3.5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] tracking-wide uppercase text-[#666666] font-medium">
            <span className="text-[#0A0A0A] font-semibold">{product.brand}</span>
            <span aria-hidden="true">·</span>
            <span>{product.category}</span>
            {product.isUnboxed && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#0A0A0A] font-semibold">Unboxed</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => onViewDetails(product)}
            className="block text-left w-full focus-visible:outline-none focus-visible:underline"
          >
            <h3 className="text-base sm:text-[17px] font-semibold text-[#0A0A0A] leading-snug group-hover:opacity-75 transition-opacity line-clamp-2">
              {product.name}
            </h3>
          </button>

          <p className="text-xs text-[#525252] truncate" title={scentPreview}>
            {scentPreview}
          </p>

          <p className="text-[11px] text-[#737373] tabular-nums">
            {availableSizes.length > 0
              ? `Sizes: ${availableSizes.map((s) => s.size).join(' · ')}`
              : 'Currently unavailable'}
          </p>
        </div>

        <div className="pt-3 border-t border-[#ECECEE] space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#737373]">
              {hasDiscount
                ? displaySize
                  ? `${displaySize} · Special`
                  : 'Special'
                : displaySize ?? 'Price'}
            </span>
            <div className="text-right">
              <span
                className={`block text-[15px] font-bold tabular-nums ${
                  hasDiscount ? 'text-[#DC2626]' : 'text-[#0A0A0A]'
                }`}
              >
                {priceDisplay}
              </span>
              {hasDiscount && (
                <span className="block text-[11px] text-[#737373] line-through tabular-nums">
                  {originalDisplay}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onViewDetails(product)}
              className="py-2 px-3 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] hover:bg-[#F5F5F6] transition-colors text-xs font-medium tracking-wide whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]"
            >
              Wear &amp; Notes
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onQuickWhatsApp(product)}
              className="py-2 px-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-medium tracking-wide flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-white" aria-hidden="true" />
              <span>Buy Now</span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

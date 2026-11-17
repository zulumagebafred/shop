import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  Layers,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { formatPrice } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import { findBestMatchingProduct } from '../data/combosAndLayering';
import {
  AppPage,
  BottleSize,
  ComboDeal,
  FragranceCategory,
  FragranceProduct,
  LayeringIdea,
  PriceRangeFilter,
  SeasonFilter,
} from '../types/fragrance';
import { getProductPriceSummary, getSizeEffectivePrice } from '../utils/pricing';

interface ComboLayeringPageProps {
  onSelectProduct: (product: FragranceProduct) => void;
  onAddToBasket: (
    product: FragranceProduct,
    size: BottleSize,
    quantity: number
  ) => void;
  onAddComboToBasket: (combo: ComboDeal, fallbackImage: string) => void;
  onQuickWhatsApp: (product: FragranceProduct) => void;
  onNavigate: (
    page: AppPage,
    options?: {
      category?: FragranceCategory | 'All';
      brand?: string;
      size?: BottleSize | 'All';
      priceRange?: PriceRangeFilter;
      season?: SeasonFilter;
      query?: string;
      onlySpecials?: boolean;
    }
  ) => void;
}

type ViewTab = 'all' | 'combos' | 'layering';

function pickPreferredSize(product: FragranceProduct): string {
  const available = product.sizes.filter((s) => s.available);
  if (available.length === 0) return product.sizes[0]?.size ?? '10ml';
  const priced = available.filter((s) => s.price !== null);
  const candidates = priced.length > 0 ? priced : available;
  const preferred10 = candidates.find((s) => s.size.toLowerCase() === '10ml');
  if (preferred10) return preferred10.size;
  const preferred5 = candidates.find((s) => s.size.toLowerCase() === '5ml');
  if (preferred5) return preferred5.size;
  return candidates[0].size;
}

export const ComboLayeringPage: React.FC<ComboLayeringPageProps> = ({
  onSelectProduct,
  onAddToBasket,
  onAddComboToBasket,
  onNavigate,
}) => {
  const { perfumes, combos, layeringIdeas } = useStore();
  const [activeView, setActiveView] = useState<ViewTab>('all');
  const [addedComboIds, setAddedComboIds] = useState<Record<string, boolean>>({});
  const [addedPairIds, setAddedPairIds] = useState<Record<string, boolean>>({});

  const visibleCombos = useMemo(
    () =>
      combos
        .filter((c) => c.active)
        .sort((a, b) => Number(b.featured) - Number(a.featured)),
    [combos]
  );

  const visibleLayering = useMemo(
    () => layeringIdeas.filter((l) => l.active),
    [layeringIdeas]
  );

  const handleComboAdd = (combo: ComboDeal, previewImage: string) => {
    onAddComboToBasket(combo, previewImage);
    setAddedComboIds((prev) => ({ ...prev, [combo.id]: true }));
    window.setTimeout(() => {
      setAddedComboIds((prev) => ({ ...prev, [combo.id]: false }));
    }, 1800);
  };

  const handleAddLayeringPair = (
    idea: LayeringIdea,
    baseMatch: FragranceProduct | null,
    topMatch: FragranceProduct | null
  ) => {
    if (baseMatch) {
      onAddToBasket(baseMatch, pickPreferredSize(baseMatch), 1);
    }
    if (topMatch && topMatch.id !== baseMatch?.id) {
      onAddToBasket(topMatch, pickPreferredSize(topMatch), 1);
    }
    if (baseMatch || topMatch) {
      setAddedPairIds((prev) => ({ ...prev, [idea.id]: true }));
      window.setTimeout(() => {
        setAddedPairIds((prev) => ({ ...prev, [idea.id]: false }));
      }, 1800);
    }
  };

  return (
    <div className="bg-white text-[#0A0A0A]">
      {/* Hero Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="bg-[#0A0A0A] text-white rounded-3xl px-6 sm:px-10 lg:px-14 py-10 sm:py-14 relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_82%_28%,rgba(250,204,21,0.16)_0%,rgba(10,10,10,0)_58%)]"
          />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="space-y-3.5 max-w-2xl">
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#FACC15] font-semibold">
                Bundles &amp; Scent Alchemy
              </p>
              <h1 className="text-3xl sm:text-5xl font-extrabold italic uppercase tracking-tight leading-[0.96] [text-wrap:balance]">
                Combo Deals &amp;{' '}
                <span className="text-[#FACC15]">Layering Ideas</span>
              </h1>
              <p className="text-sm sm:text-base text-white/75 leading-relaxed">
                Save more when you bundle two or more perfumes together, or build a custom signature aura by pairing our Arabian ouds, vanillas, and crisp citrus extraits.
              </p>
            </div>

            {/* Clean View Filter Tabs */}
            <div className="inline-flex items-center p-1 rounded-full bg-white/10 border border-white/15 self-start lg:self-auto">
              {(
                [
                  { id: 'all', label: 'All Deals & Ideas' },
                  { id: 'combos', label: `Combo Deals (${visibleCombos.length})` },
                  { id: 'layering', label: `Layering (${visibleLayering.length})` },
                ] as const
              ).map((tab) => {
                const active = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveView(tab.id)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#FACC15] text-[#0A0A0A]'
                        : 'text-white/80 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: COMBO DEALS */}
      {(activeView === 'all' || activeView === 'combos') && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#E5E5E5] pb-5 mb-8">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium inline-flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-[#0A0A0A]" />
                <span>Multi-Perfume Savings</span>
              </p>
              <h2 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A]">
                Curated Combo Deals
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-[#525252]">
              Fixed bundle pricing — add straight to your WhatsApp cart
            </p>
          </div>

          {visibleCombos.length === 0 ? (
            <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-10 text-center space-y-3">
              <p className="text-lg font-bold text-[#0A0A0A]">
                Combo Bundles Updating Soon
              </p>
              <p className="text-sm text-[#525252]">
                Browse the main catalogue or reach out via WhatsApp for custom two-bottle pricing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {visibleCombos.map((combo, idx) => {
                const matchedItems = combo.perfumeNames.map((name) => ({
                  name,
                  product: findBestMatchingProduct(perfumes, name),
                }));
                const previewImages = matchedItems
                  .map((m) => m.product?.image)
                  .filter((src): src is string => Boolean(src));
                const primaryImage =
                  previewImages[0] ??
                  perfumes[0]?.image ??
                  '/assets/images/house_lattafa_1794685069142.jpg';
                const savings = Math.max(0, combo.regularPrice - combo.comboPrice);
                const justAdded = Boolean(addedComboIds[combo.id]);

                return (
                  <motion.article
                    key={combo.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, delay: Math.min(idx * 0.05, 0.2) }}
                    className={`rounded-3xl border overflow-hidden flex flex-col justify-between transition-shadow hover:shadow-[0_18px_38px_-16px_rgba(0,0,0,0.14)] ${
                      combo.featured
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                        : 'bg-[#F6F6F7] text-[#0A0A0A] border-[#E5E5E5]'
                    }`}
                  >
                    <div className="p-6 sm:p-7 space-y-5 flex-1 flex flex-col">
                      {/* Header & Savings Callout */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p
                            className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                              combo.featured ? 'text-[#FACC15]' : 'text-[#525252]'
                            }`}
                          >
                            {combo.sizeLabel}
                          </p>
                          <h3 className="text-xl sm:text-2xl font-bold leading-tight">
                            {combo.title}
                          </h3>
                        </div>

                        {(savings > 0 || combo.tag) && (
                          <span
                            className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider tabular-nums ${
                              combo.featured
                                ? 'bg-[#FACC15] text-[#0A0A0A]'
                                : 'bg-[#0A0A0A] text-[#FACC15]'
                            }`}
                          >
                            {combo.tag || `Save ${formatPrice(savings)}`}
                          </span>
                        )}
                      </div>

                      {combo.subtitle && (
                        <p
                          className={`text-xs sm:text-sm leading-relaxed ${
                            combo.featured ? 'text-white/75' : 'text-[#525252]'
                          }`}
                        >
                          {combo.subtitle}
                        </p>
                      )}

                      {/* Included Fragrances */}
                      <div className="space-y-2.5 pt-1 flex-1">
                        <p
                          className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                            combo.featured ? 'text-white/60' : 'text-[#666666]'
                          }`}
                        >
                          What&apos;s Inside ({combo.perfumeNames.length} Scents)
                        </p>

                        <div className="space-y-2">
                          {matchedItems.map(({ name, product }, itemIdx) => {
                            const thumbSrc =
                              product?.image ??
                              '/assets/images/house_lattafa_1794685069142.jpg';

                            return (
                              <div
                                key={`${combo.id}-${name}-${itemIdx}`}
                                className={`flex items-center justify-between gap-3 p-2.5 rounded-2xl border ${
                                  combo.featured
                                    ? 'bg-white/[0.06] border-white/10'
                                    : 'bg-white border-[#E5E5E5]'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-white shrink-0 border border-black/10">
                                    <ResilientImage
                                      src={thumbSrc}
                                      alt={product?.name ?? name}
                                      fallbackTitle={name}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-semibold truncate">
                                      {product ? product.name : name}
                                    </p>
                                    <p
                                      className={`text-[11px] truncate ${
                                        combo.featured ? 'text-white/60' : 'text-[#666666]'
                                      }`}
                                    >
                                      {product
                                        ? `${product.brand} · ${product.category}`
                                        : 'Curated Pick'}
                                    </p>
                                  </div>
                                </div>

                                {product && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectProduct(product)}
                                    className={`text-[11px] font-semibold underline underline-offset-4 shrink-0 ${
                                      combo.featured
                                        ? 'text-[#FACC15] hover:text-white'
                                        : 'text-[#0A0A0A] hover:opacity-70'
                                    }`}
                                  >
                                    View
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Bundle Price & Add Button */}
                    <div
                      className={`px-6 sm:px-7 py-5 border-t space-y-4 ${
                        combo.featured
                          ? 'border-white/15 bg-white/[0.03]'
                          : 'border-[#E5E5E5] bg-white'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div>
                          <span
                            className={`block text-[10px] uppercase tracking-[0.18em] font-semibold ${
                              combo.featured ? 'text-white/60' : 'text-[#737373]'
                            }`}
                          >
                            Combo Bundle Price
                          </span>
                          <div className="flex items-baseline gap-2.5 mt-0.5 tabular-nums">
                            <span
                              className={`text-2xl sm:text-3xl font-extrabold italic ${
                                combo.featured ? 'text-[#FACC15]' : 'text-[#0A0A0A]'
                              }`}
                            >
                              {formatPrice(combo.comboPrice)}
                            </span>
                            {combo.regularPrice > combo.comboPrice && (
                              <span
                                className={`text-sm line-through ${
                                  combo.featured ? 'text-white/45' : 'text-[#737373]'
                                }`}
                              >
                                {formatPrice(combo.regularPrice)}
                              </span>
                            )}
                          </div>
                        </div>

                        {savings > 0 && (
                          <span
                            className={`text-xs font-semibold tabular-nums ${
                              combo.featured ? 'text-emerald-400' : 'text-emerald-700'
                            }`}
                          >
                            Save {formatPrice(savings)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleComboAdd(combo, primaryImage)}
                        className={`w-full py-3.5 px-5 rounded-full text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 transition-colors ${
                          combo.featured
                            ? 'bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047]'
                            : 'bg-[#0A0A0A] text-white hover:bg-[#262626]'
                        }`}
                      >
                        {justAdded ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Added Combo to Cart</span>
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-4 h-4" />
                            <span>Add Combo to Cart · {formatPrice(combo.comboPrice)}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* SECTION 2: LAYERING IDEAS */}
      {(activeView === 'all' || activeView === 'layering') && (
        <section className="bg-[#F6F6F7] border-t border-[#E5E5E5] py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[#E5E5E5] pb-5">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium inline-flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#0A0A0A]" />
                  <span>Master the Trail</span>
                </p>
                <h2 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A]">
                  Suggested Layering Ideas
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#525252]">
                Apply your heavy base first, let settle 30 seconds, then mist the topper overtop
              </p>
            </div>

            {visibleLayering.length === 0 ? (
              <div className="bg-white border border-[#E5E5E5] rounded-2xl p-10 text-center space-y-3">
                <p className="text-lg font-bold text-[#0A0A0A]">
                  Layering Guide Updating Soon
                </p>
                <p className="text-sm text-[#525252]">
                  Check back soon for new store-curated pairing recommendations.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {visibleLayering.map((idea, idx) => {
                  const baseMatch = findBestMatchingProduct(perfumes, idea.basePerfumeName);
                  const topMatch = findBestMatchingProduct(perfumes, idea.topPerfumeName);
                  const baseSize = baseMatch ? pickPreferredSize(baseMatch) : null;
                  const topSize = topMatch ? pickPreferredSize(topMatch) : null;
                  const basePrice =
                    baseMatch && baseSize
                      ? getSizeEffectivePrice(
                          baseMatch,
                          baseMatch.sizes.find((s) => s.size === baseSize) ?? null
                        ).effectivePrice
                      : null;
                  const topPrice =
                    topMatch && topSize
                      ? getSizeEffectivePrice(
                          topMatch,
                          topMatch.sizes.find((s) => s.size === topSize) ?? null
                        ).effectivePrice
                      : null;
                  const pairAdded = Boolean(addedPairIds[idea.id]);

                  const combinedSampleEstimate =
                    basePrice !== null && topPrice !== null
                      ? basePrice + topPrice
                      : baseMatch && topMatch
                      ? (getProductPriceSummary(baseMatch).minEffective ?? 0) +
                        (getProductPriceSummary(topMatch).minEffective ?? 0)
                      : null;

                  return (
                    <motion.article
                      key={idea.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: Math.min(idx * 0.04, 0.2) }}
                      className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-5"
                    >
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#525252]">
                              {idea.vibe}
                              {idea.occasion ? ` · ${idea.occasion}` : ''}
                            </p>
                            <h3 className="text-xl font-bold text-[#0A0A0A]">
                              {idea.title}
                            </h3>
                          </div>
                          <span className="text-[11px] font-semibold text-[#0A0A0A] bg-[#FACC15] px-3 py-1 rounded-full whitespace-nowrap">
                            {idea.sprayRatio}
                          </span>
                        </div>

                        {/* Base + Topper Visual Pairing Strip */}
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2.5 items-center">
                          {/* Layer 1: Base */}
                          <div className="p-3 rounded-2xl bg-[#F6F6F7] border border-[#E5E5E5] flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-[#E5E5E5] shrink-0">
                              <ResilientImage
                                src={
                                  baseMatch?.image ??
                                  '/assets/images/house_al_haramain_1794685068564.jpg'
                                }
                                alt={baseMatch?.name ?? idea.basePerfumeName}
                                fallbackTitle={idea.basePerfumeName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                                1. Base Layer
                              </span>
                              {baseMatch ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectProduct(baseMatch)}
                                  className="text-xs font-bold text-[#0A0A0A] hover:underline truncate block w-full text-left"
                                >
                                  {baseMatch.name}
                                </button>
                              ) : (
                                <p className="text-xs font-bold text-[#0A0A0A] truncate">
                                  {idea.basePerfumeName}
                                </p>
                              )}
                              {baseMatch && baseSize && (
                                <span className="text-[11px] text-[#525252] tabular-nums">
                                  {baseSize}
                                  {basePrice !== null ? ` · ${formatPrice(basePrice)}` : ''}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-center">
                            <span className="w-7 h-7 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center">
                              <Plus className="w-3.5 h-3.5" />
                            </span>
                          </div>

                          {/* Layer 2: Topper */}
                          <div className="p-3 rounded-2xl bg-[#F6F6F7] border border-[#E5E5E5] flex items-center gap-3 min-w-0">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-[#E5E5E5] shrink-0">
                              <ResilientImage
                                src={
                                  topMatch?.image ??
                                  '/assets/images/house_lattafa_1794685069142.jpg'
                                }
                                alt={topMatch?.name ?? idea.topPerfumeName}
                                fallbackTitle={idea.topPerfumeName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#666666]">
                                2. Top Layer
                              </span>
                              {topMatch ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectProduct(topMatch)}
                                  className="text-xs font-bold text-[#0A0A0A] hover:underline truncate block w-full text-left"
                                >
                                  {topMatch.name}
                                </button>
                              ) : (
                                <p className="text-xs font-bold text-[#0A0A0A] truncate">
                                  {idea.topPerfumeName}
                                </p>
                              )}
                              {topMatch && topSize && (
                                <span className="text-[11px] text-[#525252] tabular-nums">
                                  {topSize}
                                  {topPrice !== null ? ` · ${formatPrice(topPrice)}` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <p className="text-xs sm:text-sm text-[#404040] leading-relaxed">
                          {idea.whyItWorks}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-[#E5E5E5] flex flex-wrap items-center justify-between gap-3">
                        {baseMatch || topMatch ? (
                          <button
                            type="button"
                            onClick={() => handleAddLayeringPair(idea, baseMatch, topMatch)}
                            className="flex-1 min-w-[200px] py-3 px-5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                          >
                            {pairAdded ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>Added Layering Duo</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-[#FACC15]" />
                                <span>
                                  Add Both to Cart
                                  {combinedSampleEstimate && combinedSampleEstimate > 0
                                    ? ` · ${formatPrice(combinedSampleEstimate)}`
                                    : ''}
                                </span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigate('shop', {
                                category: 'All',
                                brand: 'All',
                                size: 'All',
                                query: idea.basePerfumeName,
                              })
                            }
                            className="flex-1 min-w-[200px] py-3 px-5 rounded-full border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                          >
                            <span>Browse Catalogue</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            )}

            {/* Quick 3-Step Arabian Layering Guide */}
            <div className="bg-[#0A0A0A] text-white rounded-3xl p-6 sm:p-8 lg:p-10 space-y-6">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#FACC15] font-semibold">
                  How to Layer Like a Pro
                </p>
                <h3 className="text-xl sm:text-2xl font-bold">
                  3 Golden Rules for All-Day Projection
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2 border-t border-white/15 pt-4">
                  <span className="text-xs font-bold text-[#FACC15] tabular-nums">
                    01.
                  </span>
                  <h4 className="text-base font-bold">Heaviest Base First</h4>
                  <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
                    Start with oud, leather, amber, or deep spices on warm pulse points. They anchor lighter notes so they last hours longer.
                  </p>
                </div>
                <div className="space-y-2 border-t border-white/15 pt-4">
                  <span className="text-xs font-bold text-[#FACC15] tabular-nums">
                    02.
                  </span>
                  <h4 className="text-base font-bold">Wait 30 Seconds</h4>
                  <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
                    Let your base settle on moisturized skin without rubbing your wrists together, then mist your second fragrance slightly wider.
                  </p>
                </div>
                <div className="space-y-2 border-t border-white/15 pt-4">
                  <span className="text-xs font-bold text-[#FACC15] tabular-nums">
                    03.
                  </span>
                  <h4 className="text-base font-bold">Balance With Decants</h4>
                  <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
                    Pair a full-size anchor bottle with 5ml or 10ml travel decants to customize fresh, floral, or sweet finishes every day.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

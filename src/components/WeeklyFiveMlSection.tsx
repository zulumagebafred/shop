import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Lock, ShoppingBag, Sparkles } from 'lucide-react';
import { formatPrice } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import {
  FragranceProduct,
  WeeklyFiveMlAudience,
  WeeklyFiveMlPackMode,
} from '../types/fragrance';
import { resolveWeeklyFiveMlSelection } from '../utils/weeklySpecial';
import { ResilientImage } from './ResilientImage';

interface WeeklyFiveMlSectionProps {
  onSelectProduct: (product: FragranceProduct) => void;
  onAddWeeklyPackToBasket: (payload: {
    audience: WeeklyFiveMlAudience;
    mode: WeeklyFiveMlPackMode;
    weekKey: string;
    products: FragranceProduct[];
    price: number;
    regularPrice: number | null;
  }) => void;
}

function formatWeeklyResetTimer(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, targetMs - nowMs);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
}

function formatCategoryBadge(category: FragranceProduct['category']): string {
  if (category === 'Women') return 'For Women';
  if (category === 'Men') return 'For Men';
  return 'Unisex';
}

export const WeeklyFiveMlSection: React.FC<WeeklyFiveMlSectionProps> = ({
  onSelectProduct,
  onAddWeeklyPackToBasket,
}) => {
  const { perfumes, weeklySpecial } = useStore();
  const [audience, setAudience] = useState<WeeklyFiveMlAudience>('Women');
  const [packMode, setPackMode] = useState<WeeklyFiveMlPackMode>('4-for-100');
  const [justAddedKey, setJustAddedKey] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const resolved = useMemo(
    () => resolveWeeklyFiveMlSelection(perfumes, weeklySpecial, nowMs),
    [perfumes, weeklySpecial, nowMs]
  );

  if (!resolved.enabled) {
    return null;
  }

  const hasWomen = resolved.women.under500Picks.length > 0;
  const hasMen = resolved.men.under500Picks.length > 0;
  if (!hasWomen && !hasMen) {
    return null;
  }

  const activeAudience: WeeklyFiveMlAudience =
    audience === 'Women' && !hasWomen ? 'Men' : audience === 'Men' && !hasMen ? 'Women' : audience;
  const activeLineup = activeAudience === 'Women' ? resolved.women : resolved.men;

  const canSelectFourPack = activeLineup.allFourPicks.length >= 4;
  const activeMode: WeeklyFiveMlPackMode =
    !canSelectFourPack && packMode === '4-for-100' ? '2-for-50' : packMode;

  const activeCandidates =
    activeMode === '4-for-100' ? activeLineup.allFourPicks : activeLineup.under500Picks;
  const activePrice =
    activeMode === '4-for-100' ? resolved.fourPackPrice : resolved.twoPackPrice;

  const summedFiveMlPrice = activeCandidates.reduce(
    (sum, item) => (item.fiveMlPrice !== null ? sum + item.fiveMlPrice : sum),
    0
  );
  const regularPrice =
    activeCandidates.every((c) => c.fiveMlPrice !== null) && summedFiveMlPrice > activePrice
      ? summedFiveMlPrice
      : null;

  const currentAddKey = `${activeAudience}:${activeMode}`;

  const handleAddPack = () => {
    const selectedProducts = activeCandidates.map((c) => c.product);
    if (selectedProducts.length === 0) return;

    onAddWeeklyPackToBasket({
      audience: activeAudience,
      mode: activeMode,
      weekKey: resolved.weekKey,
      products: selectedProducts,
      price: activePrice,
      regularPrice,
    });
    setJustAddedKey(currentAddKey);
    window.setTimeout(() => {
      setJustAddedKey((cur) => (cur === currentAddKey ? null : cur));
    }, 1800);
  };

  return (
    <section
      aria-labelledby="weekly-5ml-heading"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14"
    >
      <div className="rounded-3xl bg-[#0A0A0A] text-white border border-[#1E1E1E] overflow-hidden">
        {/* Top Bar & Headline */}
        <div className="p-6 sm:p-8 lg:p-10 border-b border-white/10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
            <div className="space-y-2.5 max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FACC15] inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Discovery Bar Weekly Pick · {resolved.weekLabel}</span>
              </p>
              <h2
                id="weekly-5ml-heading"
                className="text-2xl sm:text-4xl font-extrabold italic uppercase tracking-tight leading-none [text-wrap:balance]"
              >
                5ml Special <span className="text-[#FACC15]">of the Week</span>
              </h2>
              <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
                Separate weekly lineups <strong className="text-white">For Women</strong> and{' '}
                <strong className="text-white">For Men</strong> — each pairs 2 Under E500 scents with
                2 Under E800 scents. Take all 4 × 5ml for {formatPrice(resolved.fourPackPrice)}, or
                choose 2 × 5ml for {formatPrice(resolved.twoPackPrice)} from the Under E500 picks only.
              </p>
            </div>

            <div className="inline-flex items-center gap-2.5 self-start lg:self-auto px-4 py-2.5 rounded-2xl bg-white/[0.06] border border-white/15">
              <Clock className="w-4 h-4 text-[#FACC15] shrink-0" aria-hidden="true" />
              <div className="leading-tight">
                <span className="block text-[10px] uppercase tracking-[0.16em] text-white/60 font-medium">
                  Next Refresh
                </span>
                <span className="text-xs sm:text-sm font-bold tabular-nums text-white">
                  {formatWeeklyResetTimer(resolved.weekEndMs, nowMs)}
                </span>
              </div>
            </div>
          </div>

          {/* Gender Switcher: For Women / For Men */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Choose Women or Men Weekly 5ml lineup"
              className="inline-flex p-1 rounded-2xl bg-white/[0.06] border border-white/15 w-full sm:w-auto"
            >
              {(['Women', 'Men'] as const).map((tabAudience) => {
                const isSelected = activeAudience === tabAudience;
                const lineupCount =
                  tabAudience === 'Women'
                    ? resolved.women.allFourPicks.length
                    : resolved.men.allFourPicks.length;
                const disabled = lineupCount === 0;
                return (
                  <button
                    key={tabAudience}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    disabled={disabled}
                    onClick={() => setAudience(tabAudience)}
                    className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-[0.14em] transition-all whitespace-nowrap disabled:opacity-40 ${
                      isSelected
                        ? 'bg-[#FACC15] text-[#0A0A0A] shadow-sm'
                        : 'text-white/80 hover:text-white hover:bg-white/[0.06]'
                    }`}
                  >
                    For {tabAudience} ({lineupCount})
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-white/65">
              Showing <strong className="text-white">For {activeAudience}</strong> weekly decants · Switch tabs to shop both packs
            </p>
          </div>

          {/* Interactive Pack Choice Selector */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
            role="radiogroup"
            aria-label={`Choose your For ${activeAudience} 5ml Weekly Special pack`}
          >
            <button
              type="button"
              role="radio"
              aria-checked={activeMode === '4-for-100'}
              disabled={!canSelectFourPack}
              onClick={() => setPackMode('4-for-100')}
              className={`p-4 sm:p-5 rounded-2xl border text-left transition-all flex items-center justify-between gap-4 disabled:opacity-50 ${
                activeMode === '4-for-100'
                  ? 'bg-[#FACC15] text-[#0A0A0A] border-[#FACC15] shadow-[0_14px_30px_-14px_rgba(250,204,21,0.45)]'
                  : 'bg-white/[0.04] text-white border-white/15 hover:border-white/40'
              }`}
            >
              <div className="space-y-1">
                <span
                  className={`block text-[10px] font-bold uppercase tracking-[0.18em] ${
                    activeMode === '4-for-100' ? 'text-[#0A0A0A]/75' : 'text-[#FACC15]'
                  }`}
                >
                  For {activeAudience} · All 4 Weekly Picks
                </span>
                <p className="text-lg sm:text-xl font-extrabold italic uppercase tracking-tight">
                  4 × 5ml Decants
                </p>
                <p
                  className={`text-xs ${
                    activeMode === '4-for-100' ? 'text-[#0A0A0A]/80' : 'text-white/70'
                  }`}
                >
                  Includes 2 Under E500 + 2 Under E800 scents
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="block text-2xl sm:text-3xl font-extrabold italic tabular-nums">
                  {formatPrice(resolved.fourPackPrice)}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    activeMode === '4-for-100' ? 'text-[#0A0A0A]/70' : 'text-white/55'
                  }`}
                >
                  E{(resolved.fourPackPrice / 4).toFixed(0)} / 5ml
                </span>
              </div>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={activeMode === '2-for-50'}
              onClick={() => setPackMode('2-for-50')}
              className={`p-4 sm:p-5 rounded-2xl border text-left transition-all flex items-center justify-between gap-4 ${
                activeMode === '2-for-50'
                  ? 'bg-[#FACC15] text-[#0A0A0A] border-[#FACC15] shadow-[0_14px_30px_-14px_rgba(250,204,21,0.45)]'
                  : 'bg-white/[0.04] text-white border-white/15 hover:border-white/40'
              }`}
            >
              <div className="space-y-1">
                <span
                  className={`block text-[10px] font-bold uppercase tracking-[0.18em] ${
                    activeMode === '2-for-50' ? 'text-[#0A0A0A]/75' : 'text-white/65'
                  }`}
                >
                  For {activeAudience} · Under E500 Tier Only
                </span>
                <p className="text-lg sm:text-xl font-extrabold italic uppercase tracking-tight">
                  2 × 5ml Decants
                </p>
                <p
                  className={`text-xs ${
                    activeMode === '2-for-50' ? 'text-[#0A0A0A]/80' : 'text-white/70'
                  }`}
                >
                  Selects only from this week&apos;s 2 Under E500 picks
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="block text-2xl sm:text-3xl font-extrabold italic tabular-nums">
                  {formatPrice(resolved.twoPackPrice)}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    activeMode === '2-for-50' ? 'text-[#0A0A0A]/70' : 'text-white/55'
                  }`}
                >
                  E{(resolved.twoPackPrice / 2).toFixed(0)} / 5ml
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* Weekly 4-Card Lineup for Active Gender */}
        <div className="p-6 sm:p-8 lg:p-10 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Group 1: 2 Under E500 Picks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FACC15]">
                  01 · For {activeAudience} Under E500 ({activeLineup.under500Picks.length})
                </span>
                <span className="text-[11px] text-white/65">
                  Included in E{resolved.twoPackPrice.toFixed(0)} &amp; E
                  {resolved.fourPackPrice.toFixed(0)} packs
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {activeLineup.under500Picks.map((item) => {
                  const p = item.product;
                  return (
                    <article
                      key={p.id}
                      className="rounded-2xl bg-white text-[#0A0A0A] border-2 border-[#FACC15] overflow-hidden flex flex-col"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectProduct(p)}
                        className="group relative aspect-[4/3] w-full bg-[#F5F5F5] overflow-hidden text-left"
                      >
                        <ResilientImage
                          src={p.image}
                          alt={`${p.name} by ${p.brand}`}
                          fallbackTitle={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded bg-[#0A0A0A] text-[#FACC15] text-[10px] font-bold uppercase tracking-wider tabular-nums">
                          5ml · Under E500
                        </span>
                      </button>

                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                        <div>
                          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider font-semibold text-[#666666]">
                            <span className="truncate">{p.brand}</span>
                            <span className="shrink-0 text-[#0A0A0A]">
                              {formatCategoryBadge(p.category)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSelectProduct(p)}
                            className="text-sm font-bold text-[#0A0A0A] hover:underline truncate block w-full text-left mt-0.5"
                          >
                            {p.name}
                          </button>
                          {item.tierPrice !== null && (
                            <p className="text-[11px] text-[#525252] mt-0.5 tabular-nums">
                              {item.tierSizeLabel}: {formatPrice(item.tierPrice)}
                            </p>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[#ECECEC] flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                          <span className="inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {activeMode === '2-for-50'
                                ? `Included (2 for E${resolved.twoPackPrice.toFixed(0)})`
                                : `Included (4 for E${resolved.fourPackPrice.toFixed(0)})`}
                            </span>
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            {/* Group 2: 2 Under E800 Picks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                  02 · For {activeAudience} Under E800 ({activeLineup.under800Picks.length})
                </span>
                <span className="text-[11px] text-white/65">
                  4 × 5ml (E{resolved.fourPackPrice.toFixed(0)}) Pack Only
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {activeLineup.under800Picks.map((item) => {
                  const p = item.product;
                  const lockedOut = activeMode === '2-for-50';
                  return (
                    <article
                      key={p.id}
                      className={`rounded-2xl overflow-hidden flex flex-col transition-all ${
                        lockedOut
                          ? 'bg-white/10 text-white/75 border border-white/15'
                          : 'bg-white text-[#0A0A0A] border-2 border-[#FACC15]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectProduct(p)}
                        className="group relative aspect-[4/3] w-full bg-[#1C1C1C] overflow-hidden text-left"
                      >
                        <ResilientImage
                          src={p.image}
                          alt={`${p.name} by ${p.brand}`}
                          fallbackTitle={p.name}
                          className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                            lockedOut ? 'opacity-45 grayscale-[35%]' : ''
                          }`}
                        />
                        <span
                          className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider tabular-nums ${
                            lockedOut
                              ? 'bg-[#0A0A0A]/90 text-white/80'
                              : 'bg-[#0A0A0A] text-[#FACC15]'
                          }`}
                        >
                          5ml · Under E800
                        </span>
                      </button>

                      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                        <div>
                          <div
                            className={`flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider font-semibold ${
                              lockedOut ? 'text-white/55' : 'text-[#666666]'
                            }`}
                          >
                            <span className="truncate">{p.brand}</span>
                            <span
                              className={`shrink-0 ${
                                lockedOut ? 'text-white/80' : 'text-[#0A0A0A]'
                              }`}
                            >
                              {formatCategoryBadge(p.category)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => onSelectProduct(p)}
                            className={`text-sm font-bold hover:underline truncate block w-full text-left mt-0.5 ${
                              lockedOut ? 'text-white/90' : 'text-[#0A0A0A]'
                            }`}
                          >
                            {p.name}
                          </button>
                          {item.tierPrice !== null && (
                            <p
                              className={`text-[11px] mt-0.5 tabular-nums ${
                                lockedOut ? 'text-white/60' : 'text-[#525252]'
                              }`}
                            >
                              {item.tierSizeLabel}: {formatPrice(item.tierPrice)}
                            </p>
                          )}
                        </div>

                        <div
                          className={`pt-2 border-t flex items-center justify-between gap-2 text-[11px] font-semibold ${
                            lockedOut
                              ? 'border-white/10 text-white/75'
                              : 'border-[#ECECEC] text-emerald-700'
                          }`}
                        >
                          {lockedOut ? (
                            <>
                              <span className="inline-flex items-center gap-1 truncate">
                                <Lock className="w-3 h-3 shrink-0 text-[#FACC15]" />
                                <span className="truncate">
                                  E{resolved.fourPackPrice.toFixed(0)} Pack Only
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setPackMode('4-for-100')}
                                className="text-[10px] font-bold uppercase tracking-wider text-[#FACC15] hover:underline shrink-0"
                              >
                                Use 4 for E{resolved.fourPackPrice.toFixed(0)}
                              </button>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              <Check className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Included (4 for E{resolved.fourPackPrice.toFixed(0)})
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Summary & Single Primary CTA */}
          <div className="pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[#FACC15] font-semibold">
                {activeMode === '4-for-100'
                  ? `For ${activeAudience} · Your ${activeLineup.allFourPicks.length} × 5ml Selection`
                  : `For ${activeAudience} · Your ${activeLineup.under500Picks.length} × 5ml Under E500 Selection`}
              </p>
              <p className="text-xs sm:text-sm text-white/85 truncate">
                {activeCandidates.map((c) => c.product.name).join(' · ')}
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddPack}
              className="px-7 py-3.5 rounded-full bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047] transition-colors text-xs font-bold uppercase tracking-[0.14em] inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-[0_12px_30px_rgba(250,204,21,0.25)]"
            >
              {justAddedKey === currentAddKey ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Added to Cart</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>
                    Add {activeAudience} {activeMode === '4-for-100' ? '4 × 5ml' : '2 × 5ml'} ·{' '}
                    {formatPrice(activePrice)}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

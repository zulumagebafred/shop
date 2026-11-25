import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Crown, Lock, Plus, ShoppingBag, Sparkles } from 'lucide-react';
import { formatPrice } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import {
  ExclusiveFiveMlBasketPayload,
  FragranceProduct,
  WeeklyFiveMlAudience,
  WeeklyFiveMlPackMode,
} from '../types/fragrance';
import {
  resolveExclusiveFiveMlItems,
  resolveWeeklyFiveMlSelection,
} from '../utils/weeklySpecial';
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
  onAddExclusiveFiveMlToBasket?: (payload: ExclusiveFiveMlBasketPayload) => void;
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
  if (category === 'Kiddies') return 'Kiddies';
  return 'Unisex';
}

const WeeklyCountdownBadge: React.FC<{ weekEndMs: number }> = React.memo(({ weekEndMs }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="inline-flex items-center gap-2.5 self-start lg:self-auto px-4 py-2.5 rounded-2xl bg-white/[0.06] border border-white/15">
      <Clock className="w-4 h-4 text-[#FACC15] shrink-0" aria-hidden="true" />
      <div className="leading-tight">
        <span className="block text-[10px] uppercase tracking-[0.16em] text-white/60 font-medium">
          Next Refresh
        </span>
        <span className="text-xs sm:text-sm font-bold tabular-nums text-white">
          {formatWeeklyResetTimer(weekEndMs, nowMs)}
        </span>
      </div>
    </div>
  );
});

export const WeeklyFiveMlSection: React.FC<WeeklyFiveMlSectionProps> = React.memo(({
  onSelectProduct,
  onAddWeeklyPackToBasket,
  onAddExclusiveFiveMlToBasket,
}) => {
  const { perfumes, weeklySpecial } = useStore();
  const [audience, setAudience] = useState<WeeklyFiveMlAudience>('Women');
  const [packMode, setPackMode] = useState<WeeklyFiveMlPackMode>('4-for-100');
  const [selectedUnder500ByAudience, setSelectedUnder500ByAudience] = useState<
    Record<WeeklyFiveMlAudience, string[] | null>
  >({
    Women: null,
    Men: null,
  });
  const [selectedUnder800ByAudience, setSelectedUnder800ByAudience] = useState<
    Record<WeeklyFiveMlAudience, string[] | null>
  >({
    Women: null,
    Men: null,
  });
  const [justAddedKey, setJustAddedKey] = useState<string | null>(null);
  const [hourTick, setHourTick] = useState(() => Math.floor(Date.now() / 60000));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHourTick(Math.floor(Date.now() / 60000));
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const resolved = useMemo(() => {
    void hourTick;
    return resolveWeeklyFiveMlSelection(perfumes, weeklySpecial, Date.now());
  }, [perfumes, weeklySpecial, hourTick]);

  const exclusiveItems = useMemo(
    () => resolveExclusiveFiveMlItems(perfumes, weeklySpecial),
    [perfumes, weeklySpecial]
  );

  const showExclusiveSection =
    Boolean(weeklySpecial.exclusiveEnabled) && exclusiveItems.length > 0;

  const hasWomen = resolved.women.under500Picks.length > 0;
  const hasMen = resolved.men.under500Picks.length > 0;
  const showWeeklySection = resolved.enabled && (hasWomen || hasMen);

  if (!showWeeklySection && !showExclusiveSection) {
    return null;
  }

  const activeAudience: WeeklyFiveMlAudience =
    audience === 'Women' && !hasWomen ? 'Men' : audience === 'Men' && !hasMen ? 'Women' : audience;
  const activeLineup = activeAudience === 'Women' ? resolved.women : resolved.men;

  const validUnder500Ids = activeLineup.under500Picks.map((c) => c.product.id);
  const requiredUnder500Count = Math.min(2, validUnder500Ids.length);
  const rawSavedForAudience = selectedUnder500ByAudience[activeAudience];
  const effectiveSelectedUnder500Ids =
    rawSavedForAudience === null
      ? validUnder500Ids.slice(0, requiredUnder500Count)
      : rawSavedForAudience
          .filter((id) => validUnder500Ids.includes(id))
          .slice(0, 2);

  const chosenUnder500Picks = effectiveSelectedUnder500Ids
    .map((id) => activeLineup.under500Picks.find((c) => c.product.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const validUnder800Ids = activeLineup.under800Picks.map((c) => c.product.id);
  const requiredUnder800Count = Math.min(2, validUnder800Ids.length);
  const rawSavedUnder800 = selectedUnder800ByAudience[activeAudience];
  const effectiveSelectedUnder800Ids =
    rawSavedUnder800 === null
      ? validUnder800Ids.slice(0, requiredUnder800Count)
      : rawSavedUnder800
          .filter((id) => validUnder800Ids.includes(id))
          .slice(0, 2);

  const chosenUnder800Picks = effectiveSelectedUnder800Ids
    .map((id) => activeLineup.under800Picks.find((c) => c.product.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  const hasValidUnder500Choice =
    requiredUnder500Count > 0 && chosenUnder500Picks.length === requiredUnder500Count;
  const hasValidUnder800Choice =
    requiredUnder800Count > 0 && chosenUnder800Picks.length === requiredUnder800Count;

  const canSelectFourPack =
    activeLineup.under500Picks.length >= 2 && activeLineup.under800Picks.length >= 2;
  const activeMode: WeeklyFiveMlPackMode =
    !canSelectFourPack && packMode === '4-for-100' ? '2-for-50' : packMode;

  const hasValidPackChoice =
    activeMode === '4-for-100'
      ? hasValidUnder500Choice && hasValidUnder800Choice
      : hasValidUnder500Choice;

  const activeCandidates =
    activeMode === '4-for-100'
      ? [...chosenUnder500Picks, ...chosenUnder800Picks]
      : chosenUnder500Picks;
  const activePrice =
    activeMode === '4-for-100' ? resolved.fourPackPrice : resolved.twoPackPrice;

  const summedFiveMlPrice = activeCandidates.reduce(
    (sum, item) => (item.fiveMlPrice !== null ? sum + item.fiveMlPrice : sum),
    0
  );
  const regularPrice =
    activeCandidates.length > 0 &&
    activeCandidates.every((c) => c.fiveMlPrice !== null) &&
    summedFiveMlPrice > activePrice
      ? summedFiveMlPrice
      : null;

  const currentAddKey = `${activeAudience}:${activeMode}:${effectiveSelectedUnder500Ids.join('+')}:${
    activeMode === '4-for-100' ? effectiveSelectedUnder800Ids.join('+') : ''
  }`;

  const handleToggleUnder500Pick = (perfumeId: string) => {
    setSelectedUnder500ByAudience((prev) => {
      const currentRaw = prev[activeAudience];
      const base =
        currentRaw === null
          ? validUnder500Ids.slice(0, requiredUnder500Count)
          : currentRaw.filter((id) => validUnder500Ids.includes(id));

      let next: string[];
      if (base.includes(perfumeId)) {
        next = base.filter((id) => id !== perfumeId);
      } else if (base.length < 2) {
        next = [...base, perfumeId];
      } else {
        next = [base[1], perfumeId];
      }

      return {
        ...prev,
        [activeAudience]: next,
      };
    });
  };

  const handleToggleUnder800Pick = (perfumeId: string) => {
    setSelectedUnder800ByAudience((prev) => {
      const currentRaw = prev[activeAudience];
      const base =
        currentRaw === null
          ? validUnder800Ids.slice(0, requiredUnder800Count)
          : currentRaw.filter((id) => validUnder800Ids.includes(id));

      let next: string[];
      if (base.includes(perfumeId)) {
        next = base.filter((id) => id !== perfumeId);
      } else if (base.length < 2) {
        next = [...base, perfumeId];
      } else {
        next = [base[1], perfumeId];
      }

      return {
        ...prev,
        [activeAudience]: next,
      };
    });
  };

  const handleAddPack = () => {
    if (!hasValidPackChoice) return;
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

  const exclusiveSumPrice = exclusiveItems.reduce((sum, item) => sum + item.customPrice, 0);
  const exclusiveBundleAvailable =
    Boolean(weeklySpecial.exclusiveBundleEnabled) &&
    Number(weeklySpecial.exclusiveBundlePrice) > 0 &&
    exclusiveItems.length >= 2;
  const exclusiveBundlePrice = Number(weeklySpecial.exclusiveBundlePrice || 0);
  const exclusiveBundleSavings =
    exclusiveBundleAvailable && exclusiveSumPrice > exclusiveBundlePrice
      ? exclusiveSumPrice - exclusiveBundlePrice
      : 0;

  return (
    <section
      aria-labelledby={showWeeklySection ? 'weekly-5ml-heading' : 'exclusive-5ml-heading'}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 space-y-6"
    >
      {showWeeklySection && (
        <div className="rounded-3xl bg-[#0A0A0A] text-white border border-[#1E1E1E] overflow-hidden">
          {/* Top Bar & Headline */}
          <div className="p-5 sm:p-8 lg:p-10 border-b border-white/10 space-y-6">
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
                  <strong className="text-white">For Men</strong> —{' '}
                  <strong className="text-[#FACC15]">
                    {activeLineup.under500Picks.length + activeLineup.under800Picks.length} curated 5ml scents
                  </strong>{' '}
                  each. Choose 2 from Signature Picks + 2 from Prestige Picks for{' '}
                  <strong className="text-white">{formatPrice(resolved.fourPackPrice)}</strong>, or pick any{' '}
                  <strong className="text-white">2 × 5ml</strong> from Signature Picks for{' '}
                  <strong className="text-white">{formatPrice(resolved.twoPackPrice)}</strong>.
                </p>
              </div>

              <WeeklyCountdownBadge weekEndMs={resolved.weekEndMs} />
            </div>

            {/* Gender Switcher: For Women / For Men */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Choose Women or Men Weekly 5ml lineup"
                className="grid grid-cols-2 sm:inline-flex gap-1 p-1 rounded-2xl bg-white/[0.06] border border-white/15 w-full sm:w-auto"
              >
                {(['Women', 'Men'] as const).map((tabAudience) => {
                  const isSelected = activeAudience === tabAudience;
                  const lineupObj = tabAudience === 'Women' ? resolved.women : resolved.men;
                  const lineupTotal =
                    lineupObj.under500Picks.length + lineupObj.under800Picks.length;
                  const disabled = lineupObj.under500Picks.length === 0;
                  return (
                    <button
                      key={tabAudience}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      disabled={disabled}
                      onClick={() => setAudience(tabAudience)}
                      className={`min-w-0 px-2.5 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-[0.06em] sm:tracking-[0.14em] transition-all flex flex-col sm:flex-row items-center justify-center sm:gap-1.5 text-center leading-tight disabled:opacity-40 ${
                        isSelected
                          ? 'bg-[#FACC15] text-[#0A0A0A] shadow-sm'
                          : 'text-white/80 hover:text-white hover:bg-white/[0.06]'
                      }`}
                    >
                      <span>For {tabAudience}</span>
                      <span
                        className={`text-[10px] sm:text-xs font-semibold sm:font-bold tracking-normal sm:tracking-[0.14em] ${
                          isSelected ? 'text-[#0A0A0A]/80' : 'text-white/60'
                        }`}
                      >
                        ({lineupTotal} {lineupTotal === 1 ? 'option' : 'options'})
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-white/65">
                Showing <strong className="text-white">For {activeAudience}</strong> ·{' '}
                {activeMode === '4-for-100'
                  ? 'Choose 2 Signature + 2 Prestige scents'
                  : `Choose 2 of ${activeLineup.under500Picks.length} Signature scents`}
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
                    For {activeAudience} · 4 × 5ml Bundle
                  </span>
                  <p className="text-lg sm:text-xl font-extrabold italic uppercase tracking-tight">
                    4 × 5ml Decants
                  </p>
                  <p
                    className={`text-xs ${
                      activeMode === '4-for-100' ? 'text-[#0A0A0A]/80' : 'text-white/70'
                    }`}
                  >
                    Choose 2 Signature + 2 Prestige scents
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
                    For {activeAudience} · 2 × 5ml Duo
                  </span>
                  <p className="text-lg sm:text-xl font-extrabold italic uppercase tracking-tight">
                    2 × 5ml Decants
                  </p>
                  <p
                    className={`text-xs ${
                      activeMode === '2-for-50' ? 'text-[#0A0A0A]/80' : 'text-white/70'
                    }`}
                  >
                    Pick any 2 from this week&apos;s {activeLineup.under500Picks.length} Signature options
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

          {/* Weekly 3 + 3 (6 Options) Lineup */}
          <div className="p-5 sm:p-8 lg:p-10 space-y-6">
            <div className="space-y-6">
              {/* Group 1: 3 Signature Options (Choose 2) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FACC15]">
                    01 · For {activeAudience} Signature Picks ({chosenUnder500Picks.length}/{requiredUnder500Count} Chosen from {activeLineup.under500Picks.length})
                  </span>
                  <span className="text-[11px] text-white/65">
                    Tap cards to choose your {requiredUnder500Count} picks
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {activeLineup.under500Picks.map((item) => {
                    const p = item.product;
                    const isChosen = effectiveSelectedUnder500Ids.includes(p.id);
                    const choiceOrder = effectiveSelectedUnder500Ids.indexOf(p.id) + 1;
                    return (
                      <article
                        key={p.id}
                        onClick={() => handleToggleUnder500Pick(p.id)}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isChosen}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggleUnder500Pick(p.id);
                          }
                        }}
                        className={`cursor-pointer rounded-2xl overflow-hidden flex flex-col transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15] ${
                          isChosen
                            ? 'bg-white text-[#0A0A0A] border-2 border-[#FACC15] shadow-[0_12px_28px_-14px_rgba(250,204,21,0.5)]'
                            : 'bg-white/[0.06] text-white/85 border border-white/20 hover:border-white/50'
                        }`}
                      >
                        <div className="group relative aspect-[4/3] w-full bg-[#1C1C1C] overflow-hidden">
                          <ResilientImage
                            src={p.image}
                            alt={`${p.name} by ${p.brand}`}
                            fallbackTitle={p.name}
                            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                              isChosen ? '' : 'opacity-75'
                            }`}
                          />
                          <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded bg-[#0A0A0A] text-[#FACC15] text-[10px] font-bold uppercase tracking-wider tabular-nums">
                            5ml Decant
                          </span>
                          <span
                            className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                              isChosen
                                ? 'bg-[#FACC15] text-[#0A0A0A]'
                                : 'bg-black/70 text-white border border-white/30'
                            }`}
                          >
                            {isChosen ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Pick {choiceOrder}</span>
                              </>
                            ) : (
                              <span>Option</span>
                            )}
                          </span>
                        </div>

                        <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                          <div>
                            <div
                              className={`flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider font-semibold ${
                                isChosen ? 'text-[#666666]' : 'text-white/60'
                              }`}
                            >
                              <span className="truncate">{p.brand}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectProduct(p);
                                }}
                                className={`shrink-0 underline underline-offset-2 hover:opacity-80 ${
                                  isChosen ? 'text-[#0A0A0A]' : 'text-[#FACC15]'
                                }`}
                              >
                                Details
                              </button>
                            </div>
                            <p
                              className={`text-sm font-bold truncate mt-0.5 ${
                                isChosen ? 'text-[#0A0A0A]' : 'text-white'
                              }`}
                            >
                              {p.name}
                            </p>
                            {item.tierPrice !== null && (
                              <p
                                className={`text-[11px] mt-0.5 tabular-nums ${
                                  isChosen ? 'text-[#525252]' : 'text-white/65'
                                }`}
                              >
                                {item.tierSizeLabel}: {formatPrice(item.tierPrice)}
                              </p>
                            )}
                          </div>

                          <div
                            className={`pt-2 border-t flex items-center justify-between text-[11px] font-semibold ${
                              isChosen
                                ? 'border-[#ECECEC] text-emerald-700'
                                : 'border-white/15 text-white/80'
                            }`}
                          >
                            {isChosen ? (
                              <span className="inline-flex items-center gap-1">
                                <Check className="w-3.5 h-3.5 shrink-0" />
                                <span>Selected for Pack</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[#FACC15]">
                                <Plus className="w-3.5 h-3.5 shrink-0" />
                                <span>Tap to Choose</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: 3 Prestige Options (Choose 2 for 4 x 5ml Bundle) */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-white">
                    02 · For {activeAudience} Prestige Picks (
                    {activeMode === '4-for-100'
                      ? `${chosenUnder800Picks.length}/${requiredUnder800Count} Chosen from ${activeLineup.under800Picks.length}`
                      : activeLineup.under800Picks.length}
                    )
                  </span>
                  <span className="text-[11px] text-white/65">
                    {activeMode === '4-for-100'
                      ? `Tap cards to choose your ${requiredUnder800Count} picks`
                      : `4 × 5ml (E${resolved.fourPackPrice.toFixed(0)}) Pack Only`}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {activeLineup.under800Picks.map((item) => {
                    const p = item.product;
                    const lockedOut = activeMode === '2-for-50';
                    const isChosen = !lockedOut && effectiveSelectedUnder800Ids.includes(p.id);
                    const choiceOrder = effectiveSelectedUnder800Ids.indexOf(p.id) + 1;
                    return (
                      <article
                        key={p.id}
                        onClick={lockedOut ? undefined : () => handleToggleUnder800Pick(p.id)}
                        role={lockedOut ? undefined : 'button'}
                        tabIndex={lockedOut ? undefined : 0}
                        aria-pressed={lockedOut ? undefined : isChosen}
                        onKeyDown={
                          lockedOut
                            ? undefined
                            : (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleToggleUnder800Pick(p.id);
                                }
                              }
                        }
                        className={`rounded-2xl overflow-hidden flex flex-col transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15] ${
                          lockedOut
                            ? 'bg-white/10 text-white/75 border border-white/15'
                            : isChosen
                            ? 'cursor-pointer bg-white text-[#0A0A0A] border-2 border-[#FACC15] shadow-[0_12px_28px_-14px_rgba(250,204,21,0.5)]'
                            : 'cursor-pointer bg-white/[0.06] text-white/85 border border-white/20 hover:border-white/50'
                        }`}
                      >
                        <div
                          onClick={
                            lockedOut
                              ? () => onSelectProduct(p)
                              : undefined
                          }
                          className={`group relative aspect-[4/3] w-full bg-[#1C1C1C] overflow-hidden ${
                            lockedOut ? 'cursor-pointer' : ''
                          }`}
                        >
                          <ResilientImage
                            src={p.image}
                            alt={`${p.name} by ${p.brand}`}
                            fallbackTitle={p.name}
                            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
                              lockedOut
                                ? 'opacity-45 grayscale-[35%]'
                                : isChosen
                                ? ''
                                : 'opacity-75'
                            }`}
                          />
                          <span
                            className={`absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider tabular-nums ${
                              lockedOut
                                ? 'bg-[#0A0A0A]/90 text-white/80'
                                : 'bg-[#0A0A0A] text-[#FACC15]'
                            }`}
                          >
                            5ml Decant
                          </span>
                          {!lockedOut && (
                            <span
                              className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                                isChosen
                                  ? 'bg-[#FACC15] text-[#0A0A0A]'
                                  : 'bg-black/70 text-white border border-white/30'
                              }`}
                            >
                              {isChosen ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Pick {choiceOrder}</span>
                                </>
                              ) : (
                                <span>Option</span>
                              )}
                            </span>
                          )}
                        </div>

                        <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                          <div>
                            <div
                              className={`flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider font-semibold ${
                                lockedOut
                                  ? 'text-white/55'
                                  : isChosen
                                  ? 'text-[#666666]'
                                  : 'text-white/60'
                              }`}
                            >
                              <span className="truncate">{p.brand}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectProduct(p);
                                }}
                                className={`shrink-0 underline underline-offset-2 hover:opacity-80 ${
                                  lockedOut
                                    ? 'text-white/80'
                                    : isChosen
                                    ? 'text-[#0A0A0A]'
                                    : 'text-[#FACC15]'
                                }`}
                              >
                                Details
                              </button>
                            </div>
                            <p
                              className={`text-sm font-bold truncate mt-0.5 ${
                                lockedOut
                                  ? 'text-white/90'
                                  : isChosen
                                  ? 'text-[#0A0A0A]'
                                  : 'text-white'
                              }`}
                            >
                              {p.name}
                            </p>
                            {item.tierPrice !== null && (
                              <p
                                className={`text-[11px] mt-0.5 tabular-nums ${
                                  lockedOut
                                    ? 'text-white/60'
                                    : isChosen
                                    ? 'text-[#525252]'
                                    : 'text-white/65'
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
                                : isChosen
                                ? 'border-[#ECECEC] text-emerald-700'
                                : 'border-white/15 text-white/80'
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
                            ) : isChosen ? (
                              <span className="inline-flex items-center gap-1">
                                <Check className="w-3.5 h-3.5 shrink-0" />
                                <span>Selected for Pack</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[#FACC15]">
                                <Plus className="w-3.5 h-3.5 shrink-0" />
                                <span>Tap to Choose</span>
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
                  {!hasValidUnder500Choice
                    ? `Please select ${requiredUnder500Count - chosenUnder500Picks.length} more Signature scent above`
                    : activeMode === '4-for-100' && !hasValidUnder800Choice
                    ? `Please select ${requiredUnder800Count - chosenUnder800Picks.length} more Prestige scent above`
                    : activeMode === '4-for-100'
                    ? `For ${activeAudience} · Your ${activeCandidates.length} × 5ml Selection`
                    : `For ${activeAudience} · Your ${chosenUnder500Picks.length} × 5ml Selection`}
                </p>
                <p className="text-xs sm:text-sm text-white/85 truncate">
                  {activeCandidates.length > 0
                    ? activeCandidates.map((c) => c.product.name).join(' · ')
                    : 'Tap perfume cards above to build your pack'}
                </p>
              </div>

              <button
                type="button"
                disabled={!hasValidPackChoice}
                onClick={handleAddPack}
                className="w-full sm:w-auto px-5 sm:px-7 py-3.5 rounded-full bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047] disabled:opacity-45 disabled:cursor-not-allowed transition-colors text-xs font-bold uppercase tracking-[0.12em] sm:tracking-[0.14em] inline-flex items-center justify-center gap-2 sm:whitespace-nowrap text-center shrink-0 shadow-[0_12px_30px_rgba(250,204,21,0.25)]"
              >
                {justAddedKey === currentAddKey ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Cart</span>
                  </>
                ) : !hasValidPackChoice ? (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      {activeMode === '4-for-100'
                        ? `Choose 2 + 2 Scents (${chosenUnder500Picks.length + chosenUnder800Picks.length}/${requiredUnder500Count + requiredUnder800Count})`
                        : `Choose ${requiredUnder500Count} Picks (${chosenUnder500Picks.length}/${requiredUnder500Count})`}
                    </span>
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
      )}

      {/* EXCLUSIVE 5ML SPECIAL (Owner-Picked Fragrances & Custom Pricing) */}
      {showExclusiveSection && (
        <div
          id={!showWeeklySection ? 'exclusive-5ml-heading' : undefined}
          className="rounded-3xl bg-white border border-[#E5E5E5] overflow-hidden shadow-sm"
        >
          <div className="p-5 sm:p-8 lg:p-10 bg-gradient-to-br from-[#0A0A0A] via-[#141414] to-[#1E1E1E] text-white space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="space-y-2 max-w-2xl">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#FACC15] inline-flex items-center gap-1.5">
                  <Crown className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{weeklySpecial.exclusiveBadge || 'OWNER EXCLUSIVE'}</span>
                </p>
                <h2 className="text-2xl sm:text-3xl font-extrabold italic uppercase tracking-tight leading-none">
                  {weeklySpecial.exclusiveTitle || 'Exclusive 5ml Owner Reserve'}
                </h2>
                {weeklySpecial.exclusiveSubtitle && (
                  <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
                    {weeklySpecial.exclusiveSubtitle}
                  </p>
                )}
              </div>

              <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-semibold text-white/90 whitespace-nowrap">
                {exclusiveItems.length} Exclusive {exclusiveItems.length === 1 ? 'Scent' : 'Scents'}
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-8 lg:p-10 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {exclusiveItems.map((entry) => {
                const p = entry.product;
                const regularPriceForSize =
                  entry.catalogueFiveMlPrice !== null &&
                  entry.catalogueFiveMlPrice > entry.customPrice
                    ? entry.catalogueFiveMlPrice
                    : null;
                const itemAddKey = `exclusive-item:${p.id}:${entry.sizeLabel}`;

                return (
                  <article
                    key={p.id}
                    className="rounded-2xl border border-[#E5E5E5] bg-[#FAFAFB] hover:border-[#0A0A0A] transition-colors overflow-hidden flex flex-col"
                  >
                    <button
                      type="button"
                      onClick={() => onSelectProduct(p)}
                      className="group relative aspect-[4/3] w-full bg-white overflow-hidden text-left"
                    >
                      <ResilientImage
                        src={p.image}
                        alt={`${p.name} by ${p.brand}`}
                        fallbackTitle={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded bg-[#0A0A0A] text-[#FACC15] text-[10px] font-bold uppercase tracking-wider max-w-[70%] truncate">
                        {entry.sizeLabel} Exclusive
                      </span>
                      <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-white/95 text-[#0A0A0A] text-[10px] font-semibold border border-[#E5E5E5]">
                        {formatCategoryBadge(p.category)}
                      </span>
                    </button>

                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-[#666666] truncate">
                          {p.brand}
                        </p>
                        <button
                          type="button"
                          onClick={() => onSelectProduct(p)}
                          className="text-base font-bold text-[#0A0A0A] hover:underline text-left line-clamp-2 block w-full"
                        >
                          {p.name}
                        </button>
                      </div>

                      <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="block text-[10px] uppercase tracking-wider text-[#666666] font-semibold truncate">
                            {entry.sizeLabel} Special Price
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-extrabold text-[#0A0A0A] tabular-nums">
                              {formatPrice(entry.customPrice)}
                            </span>
                            {regularPriceForSize !== null && (
                              <span className="text-xs text-[#737373] line-through tabular-nums">
                                {formatPrice(regularPriceForSize)}
                              </span>
                            )}
                          </div>
                        </div>

                        {onAddExclusiveFiveMlToBasket && (
                          <button
                            type="button"
                            onClick={() => {
                              onAddExclusiveFiveMlToBasket({
                                type: 'item',
                                product: p,
                                sizeLabel: entry.sizeLabel,
                                price: entry.customPrice,
                                regularPrice: regularPriceForSize,
                              });
                              setJustAddedKey(itemAddKey);
                              window.setTimeout(() => {
                                setJustAddedKey((cur) => (cur === itemAddKey ? null : cur));
                              }, 1600);
                            }}
                            className="px-4 py-2 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            {justAddedKey === itemAddKey ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#FACC15]" />
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="w-3.5 h-3.5 text-[#FACC15]" />
                                <span className="max-w-[110px] truncate">Add {entry.sizeLabel}</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {exclusiveBundleAvailable && onAddExclusiveFiveMlToBasket && (() => {
              const uniqueSizes = Array.from(new Set(exclusiveItems.map((e) => e.sizeLabel)));
              const uniformSize = uniqueSizes.length === 1 ? uniqueSizes[0] : null;
              return (
                <div className="rounded-2xl bg-[#0A0A0A] text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[#1E1E1E]">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#FACC15]">
                        {uniformSize
                          ? `Exclusive All-${exclusiveItems.length} × ${uniformSize} Bundle`
                          : `Exclusive All-${exclusiveItems.length} Bundle`}
                      </span>
                      {exclusiveBundleSavings > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FACC15] text-[#0A0A0A] text-[10px] font-bold uppercase tracking-wider">
                          Save {formatPrice(exclusiveBundleSavings)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-white/80 truncate">
                      {exclusiveItems
                        .map((e) => `${e.product.name} (${e.sizeLabel})`)
                        .join(' · ')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onAddExclusiveFiveMlToBasket({
                        type: 'bundle',
                        title: weeklySpecial.exclusiveTitle || 'Exclusive Special Pack',
                        items: exclusiveItems.map((e) => ({
                          product: e.product,
                          sizeLabel: e.sizeLabel,
                        })),
                        products: exclusiveItems.map((e) => e.product),
                        price: exclusiveBundlePrice,
                        regularPrice:
                          exclusiveSumPrice > exclusiveBundlePrice ? exclusiveSumPrice : null,
                      });
                      setJustAddedKey('exclusive-bundle');
                      window.setTimeout(() => {
                        setJustAddedKey((cur) => (cur === 'exclusive-bundle' ? null : cur));
                      }, 1600);
                    }}
                    className="w-full sm:w-auto px-5 sm:px-6 py-3 rounded-full bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047] transition-colors text-xs font-bold uppercase tracking-[0.12em] sm:tracking-[0.14em] inline-flex items-center justify-center gap-2 sm:whitespace-nowrap text-center shrink-0"
                  >
                    {justAddedKey === 'exclusive-bundle' ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Bundle Added</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>
                          {uniformSize
                            ? `Take All ${exclusiveItems.length} × ${uniformSize}`
                            : `Take All ${exclusiveItems.length} Picks`}{' '}
                          · {formatPrice(exclusiveBundlePrice)}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </section>
  );
});

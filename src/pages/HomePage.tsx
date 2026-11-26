import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Facebook,
  Flower2,
  Gift,
  Instagram,
  Leaf,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Sun,
} from 'lucide-react';
import { DecantLineupViewer, DecantViewerSelection } from '../components/DecantLineupViewer';
import { HouseLogo } from '../components/HouseLogo';
import { ProductCard } from '../components/ProductCard';
import { ResilientImage } from '../components/ResilientImage';
import { RevealSection } from '../components/RevealSection';
import { WeeklyFiveMlSection } from '../components/WeeklyFiveMlSection';
import { formatPrice, siteConfig } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import { featuredPerfumeHouses, matchesHouseBrand } from '../data/catalogue';
import { HER_HAMPER_IMAGE, HIM_HAMPER_IMAGE } from '../data/hampers';
import { siteContent } from '../data/siteContent';
import { getBranchAvailabilityLabel } from '../utils/branches';
import {
  formatSpecialDiscountTag,
  getEffectiveUnitPrice,
  getProductPriceSummary,
  matchesPriceRange,
  parseVolumeMl,
} from '../utils/pricing';
import { SEASON_OPTIONS, getProductSeasons } from '../utils/seasons';
import {
  AppPage,
  BottleSize,
  BranchId,
  ExclusiveFiveMlBasketPayload,
  FragranceCategory,
  FragranceProduct,
  PriceRangeFilter,
  SeasonFilter,
  SpecialCampaign,
  WeeklyFiveMlAudience,
  WeeklyFiveMlPackMode,
} from '../types/fragrance';

interface HomePageProps {
  onNavigate: (
    page: AppPage,
    options?: {
      category?: FragranceCategory | 'All';
      brand?: string;
      size?: BottleSize | 'All';
      priceRange?: PriceRangeFilter;
      season?: SeasonFilter;
      onlySpecials?: boolean;
      onlyUnboxed?: boolean;
      onlyNewArrivals?: boolean;
    }
  ) => void;
  onSelectProduct: (product: FragranceProduct) => void;
  onQuickWhatsApp: (product: FragranceProduct) => void;
  onAddToBasket: (product: FragranceProduct, size: BottleSize, quantity: number) => void;
  onSelectBranchAndBasket: (branchId: BranchId) => void;
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

type ScentMood = 'all' | 'fresh' | 'warm' | 'oud' | 'sweet';

const MOOD_OPTIONS: { id: ScentMood; label: string; hint: string; keywords: string[] }[] = [
  {
    id: 'all',
    label: 'All Signatures',
    hint: 'Our most-worn scents across Manzini and Mbabane.',
    keywords: [],
  },
  {
    id: 'fresh',
    label: 'Fresh & Crisp',
    hint: 'Clean citrus, bergamot, mint, and airy musk for workdays and warm mornings.',
    keywords: ['bergamot', 'lemon', 'citrus', 'mint', 'apple', 'pineapple', 'marine', 'fresh', 'lavender', 'birch'],
  },
  {
    id: 'warm',
    label: 'Warm & Magnetic',
    hint: 'Spiced saffron, amber, and cinnamon built for evenings and close company.',
    keywords: ['amber', 'saffron', 'cinnamon', 'nutmeg', 'cardamom', 'rose', 'jasmine', 'patchouli', 'incense'],
  },
  {
    id: 'oud',
    label: 'Deep Oud & Woods',
    hint: 'Smoked agarwood, leather, and cedar that announce your presence effortlessly.',
    keywords: ['oud', 'agarwood', 'leather', 'cedar', 'sandalwood', 'smoke', 'tobacco', 'woods', 'vetiver'],
  },
  {
    id: 'sweet',
    label: 'Vanilla & Musk',
    hint: 'Smooth praline, bourbon vanilla, tonka bean, and soft skin-like musk.',
    keywords: ['vanilla', 'praline', 'tonka', 'caramel', 'honey', 'musk', 'sweet', 'gourmand', 'coconut'],
  },
];

function splitHeroHeadline(rawTitle: string): [string, string] {
  const words = rawTitle.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['SEASONAL', 'SPECIALS'];
  if (words.length === 1) return [words[0].toUpperCase(), 'SPECIALS'];
  const splitAt = Math.ceil(words.length / 2);
  return [
    words.slice(0, splitAt).join(' ').toUpperCase(),
    words.slice(splitAt).join(' ').toUpperCase(),
  ];
}

function getDefaultWeekEndMs(referenceNow: number): number {
  const d = new Date(referenceNow);
  const day = d.getDay();
  const daysUntilSunday = day === 0 ? 7 : 7 - day;
  d.setDate(d.getDate() + daysUntilSunday);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function getCountdownParts(targetMs: number, nowMs: number) {
  const diffMs = Math.max(0, targetMs - nowMs);
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  return {
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
    ended: diffMs === 0,
  };
}

const HeroCountdown: React.FC<{ endsAt?: string }> = React.memo(({ endsAt }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const targetMs = useMemo(() => {
    const raw = endsAt?.trim();
    if (raw) {
      const parsed = new Date(raw).getTime();
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return getDefaultWeekEndMs(Date.now());
  }, [endsAt]);

  const countdown = useMemo(
    () => getCountdownParts(targetMs, nowMs),
    [targetMs, nowMs]
  );

  return (
    <div className="w-full max-w-md space-y-2.5 pt-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
        {countdown.ended ? 'Special Window Ended' : 'Special Ending In'}
      </p>

      <div
        className="flex items-center justify-center lg:justify-start gap-1.5 sm:gap-2"
        aria-label={`Special ends in ${countdown.days} days, ${countdown.hours} hours, ${countdown.minutes} minutes, ${countdown.seconds} seconds`}
      >
        {[
          { value: countdown.days, label: 'Days' },
          { value: countdown.hours, label: 'Hours' },
          { value: countdown.minutes, label: 'Mins' },
          { value: countdown.seconds, label: 'Secs' },
        ].map((unit, unitIdx) => (
          <React.Fragment key={unit.label}>
            <div className="flex-1 min-w-[58px] max-w-[84px] rounded-xl border border-[#FACC15]/55 bg-white/[0.04] px-2 py-2.5 text-center">
              <span className="block text-xl sm:text-2xl font-bold text-white tabular-nums leading-none">
                {unit.value}
              </span>
              <span className="block text-[9px] uppercase tracking-[0.14em] text-white/70 mt-1.5">
                {unit.label}
              </span>
            </div>
            {unitIdx < 3 && (
              <span
                aria-hidden="true"
                className="text-base sm:text-xl font-bold text-[#FACC15] select-none pb-3"
              >
                :
              </span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
});

interface HeroSpecialsShowcaseProps {
  heroBooting: boolean;
  showingNewArrivals: boolean;
  campaign: SpecialCampaign;
  slideshowPerfumes: FragranceProduct[];
  explicitNewArrivalsCount: number;
  newArrivalsCount: number;
  fallbackProduct: FragranceProduct | null;
  onNavigate: HomePageProps['onNavigate'];
  onSelectProduct: HomePageProps['onSelectProduct'];
  onQuickWhatsApp: HomePageProps['onQuickWhatsApp'];
}

const HeroSpecialsShowcase: React.FC<HeroSpecialsShowcaseProps> = React.memo(({
  heroBooting,
  showingNewArrivals,
  campaign,
  slideshowPerfumes,
  explicitNewArrivalsCount,
  newArrivalsCount,
  fallbackProduct,
  onNavigate,
  onSelectProduct,
  onQuickWhatsApp,
}) => {
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [heroSlideDirection, setHeroSlideDirection] = useState<1 | -1>(1);
  const [heroPaused, setHeroPaused] = useState(false);
  const [heroTouchStartX, setHeroTouchStartX] = useState<number | null>(null);
  const [deckOffsetPx, setDeckOffsetPx] = useState(() => {
    if (typeof window === 'undefined') return 138;
    if (window.innerWidth < 400) return 72;
    if (window.innerWidth < 640) return 86;
    if (window.innerWidth < 1024) return 124;
    if (window.innerWidth < 1280) return 118;
    return 142;
  });

  useEffect(() => {
    const updateDeckSpacing = () => {
      if (window.innerWidth < 400) setDeckOffsetPx(72);
      else if (window.innerWidth < 640) setDeckOffsetPx(86);
      else if (window.innerWidth < 1024) setDeckOffsetPx(124);
      else if (window.innerWidth < 1280) setDeckOffsetPx(118);
      else setDeckOffsetPx(142);
    };
    updateDeckSpacing();
    window.addEventListener('resize', updateDeckSpacing);
    return () => window.removeEventListener('resize', updateDeckSpacing);
  }, []);

  const safeSlideIndex =
    slideshowPerfumes.length > 0 ? heroSlideIndex % slideshowPerfumes.length : 0;
  const activeSlideProduct = slideshowPerfumes[safeSlideIndex] ?? null;

  const stepHeroSlide = (delta: 1 | -1) => {
    if (slideshowPerfumes.length <= 1) return;
    setHeroSlideDirection(delta);
    setHeroSlideIndex(
      (prev) => (prev + delta + slideshowPerfumes.length) % slideshowPerfumes.length
    );
  };

  const goToHeroSlide = (targetIdx: number) => {
    if (targetIdx === safeSlideIndex || slideshowPerfumes.length <= 1) return;
    const forwardDist =
      (targetIdx - safeSlideIndex + slideshowPerfumes.length) % slideshowPerfumes.length;
    const backwardDist = slideshowPerfumes.length - forwardDist;
    setHeroSlideDirection(forwardDist <= backwardDist ? 1 : -1);
    setHeroSlideIndex(targetIdx);
  };

  useEffect(() => {
    if (heroPaused || slideshowPerfumes.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroSlideDirection(1);
      setHeroSlideIndex((prev) => (prev + 1) % slideshowPerfumes.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, [heroPaused, slideshowPerfumes.length]);

  const visibleDeckSlots = useMemo(() => {
    const count = slideshowPerfumes.length;
    if (count === 0) return [];
    if (count === 1) {
      return [{ pos: 0 as const, idx: 0, product: slideshowPerfumes[0] }];
    }
    if (count === 2) {
      const otherIdx = safeSlideIndex === 0 ? 1 : 0;
      return [
        { pos: 1 as const, idx: otherIdx, product: slideshowPerfumes[otherIdx] },
        { pos: 0 as const, idx: safeSlideIndex, product: slideshowPerfumes[safeSlideIndex] },
      ];
    }
    const leftIdx = (safeSlideIndex - 1 + count) % count;
    const rightIdx = (safeSlideIndex + 1) % count;
    return [
      { pos: -1 as const, idx: leftIdx, product: slideshowPerfumes[leftIdx] },
      { pos: 1 as const, idx: rightIdx, product: slideshowPerfumes[rightIdx] },
      { pos: 0 as const, idx: safeSlideIndex, product: slideshowPerfumes[safeSlideIndex] },
    ];
  }, [slideshowPerfumes, safeSlideIndex]);

  useEffect(() => {
    if (slideshowPerfumes.length <= 1) return;
    const nextIdx = (safeSlideIndex + 1) % slideshowPerfumes.length;
    const nextImg = slideshowPerfumes[nextIdx]?.image?.trim();
    if (!nextImg) return;
    const preloader = new Image();
    preloader.decoding = 'async';
    preloader.referrerPolicy = 'no-referrer';
    preloader.src = nextImg;
  }, [slideshowPerfumes, safeSlideIndex]);

  if (heroBooting) {
    return (
      <div
        aria-label="Loading featured collection"
        className="relative bg-[#0A0A0A] text-white rounded-3xl overflow-hidden px-5 sm:px-10 lg:px-14 pt-8 pb-14 sm:py-12 lg:py-14 min-h-[660px] sm:min-h-[720px] lg:min-h-[512px] flex items-center"
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
          <div className="lg:col-span-6 space-y-5 flex flex-col items-center lg:items-start">
            <div className="h-3.5 w-32 rounded bg-white/15 animate-pulse" />
            <div className="space-y-3 w-full max-w-md flex flex-col items-center lg:items-start">
              <div className="h-12 sm:h-14 w-3/4 rounded-xl bg-white/15 animate-pulse" />
              <div className="h-12 sm:h-14 w-2/3 rounded-xl bg-[#FACC15]/25 animate-pulse" />
            </div>
            <div className="flex gap-2 w-full max-w-md justify-center lg:justify-start pt-1">
              {[0, 1, 2, 3].map((slot) => (
                <div
                  key={slot}
                  className="flex-1 min-w-[58px] max-w-[84px] h-[64px] rounded-xl border border-white/10 bg-white/[0.05] animate-pulse"
                />
              ))}
            </div>
            <div className="h-11 w-44 rounded-full bg-[#FACC15]/30 animate-pulse mt-2" />
          </div>
          <div className="lg:col-span-6 h-[300px] sm:h-[360px] lg:h-[400px] flex items-center justify-center">
            <div className="w-[170px] sm:w-[205px] h-[270px] sm:h-[325px] rounded-2xl bg-white/10 border border-white/15 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!activeSlideProduct) {
    return (
      <div className="relative bg-[#0A0A0A] text-white rounded-3xl overflow-hidden px-5 sm:px-10 lg:px-14 py-12 lg:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_40%,rgba(250,204,21,0.14)_0%,rgba(10,10,10,0)_62%)]"
        />
        <div className="relative z-10 max-w-2xl space-y-5 text-center lg:text-left flex flex-col items-center lg:items-start">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#FACC15] font-semibold">
            AuraHut Co. Eswatini
          </p>
          <h1 className="text-[clamp(2.35rem,5vw,4.35rem)] font-extrabold italic uppercase leading-[0.9] tracking-tight text-white -skew-x-3 [text-wrap:balance]">
            <span className="block text-white">Signature</span>
            <span className="block text-[#FACC15]">Extraits</span>
          </h1>
          <p className="text-sm sm:text-base text-white/75 max-w-lg">
            New seasonal special offers are updating soon. Explore our in-stock Arabian bottles and travel decants across Manzini and Mbabane.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            {fallbackProduct && (
              <motion.button
                type="button"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onQuickWhatsApp(fallbackProduct)}
                className="px-7 py-3.5 rounded-full bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047] transition-colors text-xs font-bold uppercase tracking-[0.12em] inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-[0_12px_30px_rgba(250,204,21,0.28)]"
              >
                <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Buy Now</span>
              </motion.button>
            )}
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                onNavigate('shop', {
                  category: 'All',
                  brand: 'All',
                  size: 'All',
                  priceRange: 'all',
                  season: 'all',
                  onlySpecials: false,
                })
              }
              className={`px-7 py-3.5 rounded-full transition-colors text-xs font-bold uppercase tracking-[0.12em] inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
                fallbackProduct
                  ? 'border border-white/30 bg-white/10 text-white hover:bg-white hover:text-[#0A0A0A]'
                  : 'bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047] shadow-[0_12px_30px_rgba(250,204,21,0.28)]'
              }`}
            >
              <span>Browse Available Catalogue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>
      </div>
    );
  }

  const rawTitle = showingNewArrivals
    ? campaign.newArrivalsTitle || 'New Arrivals'
    : campaign.enabled && campaign.title
    ? campaign.title
    : 'Signature Extraits';
  const [lineOne, lineTwo] = splitHeroHeadline(rawTitle);
  const activeSpecialTag = formatSpecialDiscountTag(
    activeSlideProduct.onSpecial,
    activeSlideProduct.specialDiscountPercent,
    activeSlideProduct.specialDiscountType,
    activeSlideProduct.specialDiscountAmount
  );
  const activeSizes = [...activeSlideProduct.sizes]
    .filter((s) => s.available)
    .sort((a, b) => parseVolumeMl(a.size) - parseVolumeMl(b.size));
  const activeBranchLabel = getBranchAvailabilityLabel(activeSlideProduct);

  return (
    <div
      onMouseEnter={() => setHeroPaused(true)}
      onMouseLeave={() => setHeroPaused(false)}
      onTouchStart={(e) => setHeroTouchStartX(e.changedTouches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        if (heroTouchStartX === null) return;
        const deltaX = (e.changedTouches[0]?.clientX ?? heroTouchStartX) - heroTouchStartX;
        if (Math.abs(deltaX) > 40) {
          stepHeroSlide(deltaX < 0 ? 1 : -1);
        }
        setHeroTouchStartX(null);
      }}
      className="relative bg-[#0A0A0A] text-white rounded-3xl overflow-hidden px-5 sm:px-10 lg:px-14 pt-8 pb-14 sm:py-12 lg:py-14 min-h-[660px] sm:min-h-[720px] lg:min-h-[512px] flex items-center"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_45%,rgba(250,204,21,0.16)_0%,rgba(255,255,255,0.06)_38%,rgba(10,10,10,0)_64%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(250,204,21,0.08)_0%,transparent_48%)]"
      />

      {slideshowPerfumes.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => stepHeroSlide(-1)}
            aria-label="Previous featured perfume"
            className="hidden sm:flex absolute left-3 lg:left-4 top-1/2 -translate-y-1/2 z-40 w-9 h-9 rounded-full bg-white/12 hover:bg-white text-white hover:text-[#0A0A0A] border border-white/25 items-center justify-center transition-colors backdrop-blur-xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => stepHeroSlide(1)}
            aria-label="Next featured perfume"
            className="hidden sm:flex absolute right-3 lg:right-4 top-1/2 -translate-y-1/2 z-40 w-9 h-9 rounded-full bg-white/12 hover:bg-white text-white hover:text-[#0A0A0A] border border-white/25 items-center justify-center transition-colors backdrop-blur-xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </>
      )}

      <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 items-center">
        <div className="lg:col-span-6 space-y-5 text-center lg:text-left flex flex-col items-center lg:items-start min-w-0">
          <p className="text-[11px] uppercase tracking-[0.22em] text-[#FACC15] font-semibold">
            {showingNewArrivals
              ? campaign.newArrivalsBadge || 'JUST LANDED'
              : campaign.enabled && campaign.badgeText
              ? campaign.badgeText
              : 'Featured Specials'}
          </p>

          <h1 className="text-[clamp(2.35rem,5vw,4.35rem)] font-extrabold italic uppercase leading-[0.9] tracking-tight text-white -skew-x-3 [text-wrap:balance]">
            <span className="block text-white">{lineOne}</span>
            <span className="block text-[#FACC15]">{lineTwo}</span>
          </h1>

          {showingNewArrivals ? (
            <div className="w-full max-w-md space-y-2.5 pt-1">
              <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
                {campaign.newArrivalsSubtitle ||
                  'Freshly landed Arabian extraits & travel decants stocked in Manzini and Mbabane.'}
              </p>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#FACC15]/45 bg-white/[0.05] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FACC15]">
                <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {explicitNewArrivalsCount > 0
                    ? `${explicitNewArrivalsCount} Newly Landed ${
                        explicitNewArrivalsCount === 1 ? 'Scent' : 'Scents'
                      }`
                    : `Latest ${newArrivalsCount} Storefront Releases`}
                </span>
              </div>
            </div>
          ) : (
            <HeroCountdown endsAt={campaign.endsAt} />
          )}

          <div className="w-full max-w-md space-y-1.5 pt-0.5 text-center lg:text-left min-h-[46px]">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 min-w-0 min-h-[22px]">
              <p className="text-xs font-semibold text-white/90 truncate min-w-0">
                {activeSlideProduct.name}{' '}
                <span className="text-white/55 font-normal">
                  · {activeSlideProduct.brand}
                </span>
              </p>
              {activeSlideProduct.availability !== 'Out of Stock' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/12 border border-white/25 text-[10px] font-semibold text-white shrink-0 whitespace-nowrap">
                  <MapPin className="w-2.5 h-2.5 text-[#FACC15] shrink-0" aria-hidden="true" />
                  <span>{activeBranchLabel}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-white/75 tabular-nums truncate min-h-[18px]">
              {activeSizes.length > 0 ? (
                activeSizes.map((s, idx) => {
                  const eff = getEffectiveUnitPrice(
                    s.price,
                    activeSlideProduct.onSpecial,
                    activeSlideProduct.specialDiscountPercent,
                    activeSlideProduct.specialDiscountType,
                    activeSlideProduct.specialDiscountAmount,
                    s.size,
                    activeSlideProduct.sizes
                  );
                  const sizeOnSpecial =
                    Boolean(activeSlideProduct.onSpecial) &&
                    s.price !== null &&
                    eff !== null &&
                    eff < s.price;
                  return (
                    <React.Fragment key={`${activeSlideProduct.id}-hero-${s.size}`}>
                      <span className="text-white/60">{s.size}</span>{' '}
                      <span
                        className={`font-semibold ${
                          sizeOnSpecial ? 'text-[#FACC15]' : 'text-white/90'
                        }`}
                      >
                        {eff !== null ? formatPrice(eff) : 'Ask'}
                      </span>
                      {sizeOnSpecial && s.price !== null && (
                        <span className="ml-1 text-[10px] text-white/40 line-through">
                          {formatPrice(s.price)}
                        </span>
                      )}
                      {idx < activeSizes.length - 1 && (
                        <span className="mx-1.5 text-white/30">·</span>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <span className="text-white/55">Tap Buy Now for available bottle sizes</span>
              )}
            </p>
          </div>

          <div className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-3">
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickWhatsApp(activeSlideProduct)}
              className="px-7 py-3.5 rounded-full bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047] transition-colors text-xs font-bold uppercase tracking-[0.12em] inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-[0_12px_30px_rgba(250,204,21,0.28)]"
            >
              <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Buy Now</span>
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                showingNewArrivals
                  ? onNavigate('shop', {
                      category: 'All',
                      brand: 'All',
                      size: 'All',
                      priceRange: 'all',
                      season: 'all',
                      onlySpecials: false,
                      onlyUnboxed: false,
                      onlyNewArrivals: explicitNewArrivalsCount > 0,
                    })
                  : onNavigate('shop', {
                      category: 'All',
                      brand: 'All',
                      size: 'All',
                      priceRange: 'all',
                      season: 'all',
                      onlySpecials: true,
                      onlyUnboxed: false,
                      onlyNewArrivals: false,
                    })
              }
              className="px-6 py-3.5 rounded-full border border-white/30 bg-white/10 text-white hover:bg-white hover:text-[#0A0A0A] transition-colors text-xs font-bold uppercase tracking-[0.12em] inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <span>
                {showingNewArrivals ? 'Explore New Arrivals' : 'Explore Special'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </div>

        <div className="lg:col-span-6 relative h-[300px] sm:h-[360px] lg:h-[400px] flex items-center justify-center select-none">
          <div className="relative w-[158px] sm:w-[196px] xl:w-[224px] h-[255px] sm:h-[312px] xl:h-[350px]">
            <motion.div
              aria-hidden="true"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="pointer-events-none absolute -top-5 -left-5 sm:-top-6 sm:-left-7 z-40 w-[68px] h-[68px] sm:w-[82px] sm:h-[82px] rounded-full bg-[#FACC15] text-[#0A0A0A] border-2 border-[#0A0A0A] shadow-2xl flex items-center justify-center"
            >
              <motion.svg
                viewBox="0 0 100 100"
                className="w-full h-full will-change-transform"
                animate={{ rotate: 360 }}
                transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
              >
                <defs>
                  <path
                    id="aurahut-seal-ring"
                    d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
                  />
                </defs>
                <text
                  fill="#0A0A0A"
                  fontSize="7.8"
                  fontWeight="700"
                  letterSpacing="2"
                >
                  <textPath href="#aurahut-seal-ring">
                    AURAHUT CO. • AUTHENTIC •{' '}
                  </textPath>
                </text>
              </motion.svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
                <span className="text-xs sm:text-sm font-extrabold tabular-nums text-[#0A0A0A]">
                  {activeSpecialTag || (showingNewArrivals ? 'NEW' : '100%')}
                </span>
                <span className="text-[7px] sm:text-[8px] font-bold uppercase tracking-wider text-[#0A0A0A]/80 mt-0.5">
                  {activeSpecialTag
                    ? 'SPECIAL'
                    : showingNewArrivals
                    ? 'ARRIVAL'
                    : 'PURE'}
                </span>
              </div>
            </motion.div>

            <AnimatePresence initial={false} custom={heroSlideDirection}>
              {visibleDeckSlots.map(({ pos, idx, product }) => {
                const summary = getProductPriceSummary(product);
                const isCenter = pos === 0;
                const targetX = pos === 0 ? 0 : pos * deckOffsetPx;
                const targetRotate = pos === 0 ? 0 : pos * 7.5;
                const targetScale = pos === 0 ? 1 : 0.85;
                const targetY = pos === 0 ? 0 : 12;

                return (
                  <motion.div
                    key={product.id}
                    custom={heroSlideDirection}
                    initial={{
                      opacity: 0,
                      x: heroSlideDirection * (deckOffsetPx * 1.35),
                      scale: 0.78,
                      rotate: heroSlideDirection * 11,
                    }}
                    animate={{
                      opacity: isCenter ? 1 : 0.88,
                      x: targetX,
                      y: targetY,
                      scale: targetScale,
                      rotate: targetRotate,
                    }}
                    exit={{
                      opacity: 0,
                      x: -heroSlideDirection * (deckOffsetPx * 1.35),
                      scale: 0.78,
                      rotate: -heroSlideDirection * 11,
                    }}
                    transition={{
                      duration: 0.62,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{ zIndex: isCenter ? 30 : pos === 1 ? 20 : 10 }}
                    className="absolute inset-0 will-change-transform"
                  >
                    <motion.button
                      type="button"
                      animate={
                        isCenter ? { y: [0, -5, 0] } : { y: 0 }
                      }
                      transition={
                        isCenter
                          ? {
                              duration: 4.2,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }
                          : { duration: 0.2 }
                      }
                      onClick={() => {
                        if (isCenter) {
                          onSelectProduct(product);
                        } else {
                          goToHeroSlide(idx);
                        }
                      }}
                      aria-label={
                        isCenter
                          ? `View details for ${product.name}`
                          : `Bring ${product.name} to spotlight`
                      }
                      className={`group w-full h-full rounded-2xl overflow-hidden bg-white text-[#0A0A0A] flex flex-col text-left transition-shadow ${
                        isCenter
                          ? 'ring-2 ring-[#FACC15] shadow-[0_26px_60px_-12px_rgba(0,0,0,0.9)]'
                          : 'border border-white/70 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.75)] opacity-90 hover:opacity-100'
                      }`}
                    >
                      <div className="relative flex-1 w-full bg-white overflow-hidden">
                        <ResilientImage
                          src={product.image}
                          alt={`${product.name} by ${product.brand}`}
                          fallbackTitle={product.name}
                          loading={isCenter ? 'eager' : 'lazy'}
                          fetchPriority={isCenter ? 'high' : 'low'}
                          variant="card"
                          className="w-full h-full object-cover object-center saturate-[1.12] contrast-[1.03] transition-transform duration-500 ease-out group-hover:scale-105"
                        />
                        {(() => {
                          const tag = formatSpecialDiscountTag(
                            product.onSpecial,
                            product.specialDiscountPercent,
                            product.specialDiscountType,
                            product.specialDiscountAmount
                          );
                          if (tag) {
                            return (
                              <span className="absolute top-2.5 right-2.5 bg-[#FACC15] text-[#0A0A0A] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full tabular-nums shadow-xs">
                                {tag}
                              </span>
                            );
                          }
                          if (showingNewArrivals || product.isNewArrival) {
                            return (
                              <span className="absolute top-2.5 right-2.5 bg-[#0A0A0A]/90 text-[#FACC15] border border-[#FACC15]/50 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                                New Arrival
                              </span>
                            );
                          }
                          if (product.bestseller) {
                            return (
                              <span className="absolute top-2.5 right-2.5 bg-[#0A0A0A]/85 text-white text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full">
                                Bestseller
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      <div className="p-2.5 sm:p-3.5 bg-white border-t border-[#ECECEC] space-y-0.5 shrink-0">
                        <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.14em] text-[#737373] font-semibold truncate">
                          {product.brand}
                        </p>
                        <p className="text-xs sm:text-sm font-bold italic uppercase tracking-tight text-[#0A0A0A] truncate">
                          {product.name}
                        </p>
                        {(() => {
                          const targetOpt =
                            !summary.hasDiscount && summary.specialTargetOption
                              ? summary.specialTargetOption
                              : null;
                          const deckEffective = targetOpt
                            ? targetOpt.effectivePrice
                            : summary.highestEffective;
                          const deckOriginal = targetOpt
                            ? targetOpt.originalPrice
                            : summary.highestOriginal;
                          const deckSize = targetOpt
                            ? targetOpt.size
                            : summary.highestSize;
                          const deckHasDiscount =
                            Boolean(targetOpt) || summary.hasDiscount;
                          return (
                            <div className="pt-0.5 flex items-baseline gap-1.5 text-[11px] sm:text-xs">
                              <span
                                className={`font-bold tabular-nums ${
                                  deckHasDiscount ? 'text-[#DC2626]' : 'text-[#0A0A0A]'
                                }`}
                              >
                                {deckEffective !== null
                                  ? formatPrice(deckEffective)
                                  : 'Ask Price'}
                              </span>
                              {deckHasDiscount && deckOriginal !== null ? (
                                <>
                                  <span className="text-[10px] text-[#737373] line-through tabular-nums">
                                    {formatPrice(deckOriginal)}
                                  </span>
                                  {deckSize && (
                                    <span className="text-[9px] text-[#737373] font-semibold tabular-nums">
                                      ({deckSize})
                                    </span>
                                  )}
                                </>
                              ) : deckSize ? (
                                <span className="text-[10px] text-[#737373] font-medium tabular-nums">
                                  {deckSize}
                                </span>
                              ) : null}
                            </div>
                          );
                        })()}
                        {(() => {
                          const decant5 = product.sizes.find(
                            (s) => s.available && s.price !== null && parseVolumeMl(s.size) === 5
                          );
                          const decant10 = product.sizes.find(
                            (s) => s.available && s.price !== null && parseVolumeMl(s.size) === 10
                          );
                          if (!decant5 && !decant10) return null;
                          const p5 = decant5
                            ? getEffectiveUnitPrice(
                                decant5.price,
                                product.onSpecial,
                                product.specialDiscountPercent,
                                product.specialDiscountType,
                                product.specialDiscountAmount,
                                decant5.size,
                                product.sizes
                              )
                            : null;
                          const p10 = decant10
                            ? getEffectiveUnitPrice(
                                decant10.price,
                                product.onSpecial,
                                product.specialDiscountPercent,
                                product.specialDiscountType,
                                product.specialDiscountAmount,
                                decant10.size,
                                product.sizes
                              )
                            : null;
                          return (
                            <p className="text-[10px] text-[#525252] tabular-nums truncate">
                              {p5 !== null ? `5ml ${formatPrice(p5)}` : ''}
                              {p5 !== null && p10 !== null ? ' · ' : ''}
                              {p10 !== null ? `10ml ${formatPrice(p10)}` : ''}
                            </p>
                          );
                        })()}
                      </div>
                    </motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {slideshowPerfumes.length > 1 && (
        <div
          className="absolute bottom-4 sm:bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2"
          role="tablist"
          aria-label="Special fragrance slides"
        >
          {slideshowPerfumes.map((slide, idx) => {
            const active = idx === safeSlideIndex;
            return (
              <button
                key={slide.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={`View slide ${idx + 1}: ${slide.name}`}
                onClick={() => goToHeroSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  active
                    ? 'w-7 bg-[#FACC15]'
                    : 'w-2 bg-white/40 hover:bg-white/75'
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

interface MoodFragrancePickerProps {
  availablePerfumes: FragranceProduct[];
  onNavigate: HomePageProps['onNavigate'];
  onSelectProduct: HomePageProps['onSelectProduct'];
  onQuickWhatsApp: HomePageProps['onQuickWhatsApp'];
  onAddToBasket: HomePageProps['onAddToBasket'];
}

const MoodFragrancePicker: React.FC<MoodFragrancePickerProps> = React.memo(({
  availablePerfumes,
  onNavigate,
  onSelectProduct,
  onQuickWhatsApp,
  onAddToBasket,
}) => {
  const [activeMood, setActiveMood] = useState<ScentMood>('all');
  const [moodSlideIndex, setMoodSlideIndex] = useState(0);
  const [moodPaused, setMoodPaused] = useState(false);
  const [moodCardsPerView, setMoodCardsPerView] = useState(() => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 1024) return 2;
    return 4;
  });

  useEffect(() => {
    const updatePerView = () => {
      if (window.innerWidth < 640) setMoodCardsPerView(1);
      else if (window.innerWidth < 1024) setMoodCardsPerView(2);
      else setMoodCardsPerView(4);
    };
    updatePerView();
    window.addEventListener('resize', updatePerView);
    return () => window.removeEventListener('resize', updatePerView);
  }, []);

  useEffect(() => {
    setMoodSlideIndex(0);
  }, [activeMood]);

  const activeMoodObj = MOOD_OPTIONS.find((m) => m.id === activeMood) ?? MOOD_OPTIONS[0];

  const curatedProducts = useMemo(() => {
    if (activeMood === 'all') {
      const preferred = availablePerfumes.filter((p) => p.bestseller);
      const rest = availablePerfumes.filter((p) => !p.bestseller);
      return [...preferred, ...rest].slice(0, 12);
    }
    const keywords = activeMoodObj.keywords;
    const scored = availablePerfumes
      .map((product) => {
        const haystack = [
          product.name,
          product.description,
          ...product.notes.top,
          ...product.notes.heart,
          ...product.notes.base,
        ]
          .join(' ')
          .toLowerCase();
        const score = keywords.reduce(
          (acc, kw) => (haystack.includes(kw) ? acc + 1 : acc),
          0
        );
        return { product, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.product);

    return (scored.length > 0 ? scored : availablePerfumes).slice(0, 12);
  }, [availablePerfumes, activeMood, activeMoodObj]);

  const canSlideMood = curatedProducts.length > moodCardsPerView;
  const maxMoodSlideIndex = Math.max(0, curatedProducts.length - moodCardsPerView);
  const clampedMoodSlideIndex = Math.min(moodSlideIndex, maxMoodSlideIndex);

  useEffect(() => {
    if (moodPaused || !canSlideMood) return;
    const timer = window.setInterval(() => {
      setMoodSlideIndex((prev) => (prev >= maxMoodSlideIndex ? 0 : prev + 1));
    }, 4500);
    return () => window.clearInterval(timer);
  }, [moodPaused, canSlideMood, maxMoodSlideIndex]);

  return (
    <RevealSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="space-y-1.5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
            Choose by Feeling
          </p>
          <h2 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A]">
            How Do You Want to Feel Wearing It?
          </h2>
          <p className="text-xs sm:text-sm text-[#525252] max-w-2xl">
            {activeMoodObj.hint}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onNavigate('shop', {
              category: 'All',
              brand: 'All',
              size: 'All',
              priceRange: 'all',
              season: 'all',
              onlySpecials: false,
            })
          }
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] text-xs font-semibold uppercase tracking-[0.12em] text-[#0A0A0A] transition-colors self-start md:self-auto whitespace-nowrap shrink-0"
        >
          <span>Browse Full Catalogue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex flex-wrap items-center gap-2">
          {MOOD_OPTIONS.map((mood) => {
            const active = activeMood === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                onClick={() => setActiveMood(mood.id)}
                className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                    : 'bg-[#F6F6F7] text-[#404040] border-[#E5E5E5] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
                }`}
              >
                {mood.label}
              </button>
            );
          })}
        </div>

        {canSlideMood && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[11px] font-mono text-[#737373] tabular-nums mr-1">
              {String(clampedMoodSlideIndex + 1).padStart(2, '0')} /{' '}
              {String(maxMoodSlideIndex + 1).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={() =>
                setMoodSlideIndex((prev) =>
                  prev <= 0 ? maxMoodSlideIndex : prev - 1
                )
              }
              aria-label="Previous fragrance slide"
              className="w-9 h-9 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] flex items-center justify-center text-[#0A0A0A] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setMoodSlideIndex((prev) =>
                  prev >= maxMoodSlideIndex ? 0 : prev + 1
                )
              }
              aria-label="Next fragrance slide"
              className="w-9 h-9 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] flex items-center justify-center text-[#0A0A0A] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div
        onMouseEnter={() => setMoodPaused(true)}
        onMouseLeave={() => setMoodPaused(false)}
        className="space-y-5"
      >
        <div className="overflow-hidden -mx-2.5 py-2">
          <motion.div
            key={activeMood}
            initial={{ opacity: 0.4 }}
            animate={{
              opacity: 1,
              x: `-${(clampedMoodSlideIndex * 100) / moodCardsPerView}%`,
            }}
            transition={{
              x: { duration: 0.72, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.25 },
            }}
            className="flex items-stretch will-change-transform"
          >
            {curatedProducts.map((product, idx) => (
              <div
                key={product.id}
                style={{ width: `${100 / moodCardsPerView}%` }}
                className="shrink-0 px-2.5"
              >
                <ProductCard
                  product={product}
                  index={idx}
                  disableEntranceAnimation
                  imageLoading={idx < moodCardsPerView ? 'eager' : 'lazy'}
                  fetchPriority={idx < moodCardsPerView ? 'auto' : 'low'}
                  onViewDetails={onSelectProduct}
                  onQuickWhatsApp={onQuickWhatsApp}
                  onAddToBasket={onAddToBasket}
                />
              </div>
            ))}
          </motion.div>
        </div>

        {canSlideMood && (
          <div
            className="flex items-center justify-center gap-1.5"
            role="tablist"
            aria-label="Mood fragrance slides"
          >
            {Array.from({ length: maxMoodSlideIndex + 1 }).map((_, idx) => {
              const active = idx === clampedMoodSlideIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-label={`View slide ${idx + 1}`}
                  onClick={() => setMoodSlideIndex(idx)}
                  className={`h-[3px] rounded-full transition-all duration-300 ${
                    active
                      ? 'w-7 bg-[#0A0A0A]'
                      : 'w-3 bg-[#D4D4D4] hover:bg-[#737373]'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
    </RevealSection>
  );
});

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onSelectProduct,
  onQuickWhatsApp,
  onAddToBasket,
  onSelectBranchAndBasket,
  onAddWeeklyPackToBasket,
  onAddExclusiveFiveMlToBasket,
}) => {
  const {
    perfumes,
    campaign,
    campaignLoading,
    catalogueLoading,
    catalogueComplete,
    catalogueHasMore,
    ensureAllPerfumesLoaded,
    usingSampleHampers,
  } = useStore();
  const heroBooting = campaignLoading || catalogueLoading;

  useEffect(() => {
    if (!catalogueComplete && catalogueHasMore) {
      void ensureAllPerfumesLoaded();
    }
  }, [catalogueComplete, catalogueHasMore, ensureAllPerfumesLoaded]);

  const availablePerfumes = useMemo(
    () => perfumes.filter((p) => p.availability !== 'Out of Stock'),
    [perfumes]
  );
  const specialPerfumes = useMemo(
    () => availablePerfumes.filter((p) => Boolean(p.onSpecial)),
    [availablePerfumes]
  );
  const explicitNewArrivals = useMemo(
    () => availablePerfumes.filter((p) => Boolean(p.isNewArrival)),
    [availablePerfumes]
  );
  const autoLatestArrivals = useMemo(
    () =>
      [...availablePerfumes]
        .sort((a, b) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
        .slice(0, 8),
    [availablePerfumes]
  );
  const newArrivalsPerfumes =
    explicitNewArrivals.length > 0 ? explicitNewArrivals : autoLatestArrivals;
  const heroMode = campaign.heroMode ?? 'auto';
  const showingNewArrivals =
    heroMode === 'new-arrivals'
      ? newArrivalsPerfumes.length > 0
      : heroMode === 'auto'
      ? specialPerfumes.length === 0 && newArrivalsPerfumes.length > 0
      : false;
  const [activeDecantIndex, setActiveDecantIndex] = useState(1);
  const [showAllDecantLineup, setShowAllDecantLineup] = useState(false);

  const slideshowPerfumes = showingNewArrivals
    ? newArrivalsPerfumes
    : specialPerfumes;

  const activeDecant = siteContent.decantsSection.tiers[activeDecantIndex];

  const priceDeals: {
    id: Exclude<PriceRangeFilter, 'all'>;
    eyebrow: string;
    headline: string;
    description: string;
    highlight?: boolean;
  }[] = [
    {
      id: 'under-300',
      eyebrow: 'UNDER',
      headline: 'E300',
      description: 'Easy gifts and everyday finds',
    },
    {
      id: 'under-500',
      eyebrow: 'UNDER',
      headline: 'E500',
      description: 'Best sellers and 10ml–22ml sprays',
    },
    {
      id: 'under-800',
      eyebrow: 'UNDER',
      headline: 'E800',
      description: 'Fragrance favourites & mid-sizes',
    },
    {
      id: '800-plus',
      eyebrow: 'PREMIUM',
      headline: 'E800+',
      description: 'Signature houses & full bottles',
      highlight: true,
    },
  ];

  const priceDealCounts = useMemo(() => {
    const map: Record<Exclude<PriceRangeFilter, 'all'>, number> = {
      'under-300': 0,
      'under-500': 0,
      'under-800': 0,
      '800-plus': 0,
    };
    for (const p of availablePerfumes) {
      if (matchesPriceRange(p, 'under-300')) map['under-300'] += 1;
      if (matchesPriceRange(p, 'under-500')) map['under-500'] += 1;
      if (matchesPriceRange(p, 'under-800')) map['under-800'] += 1;
      if (matchesPriceRange(p, '800-plus')) map['800-plus'] += 1;
    }
    return map;
  }, [availablePerfumes]);

  const seasonCounts = useMemo(() => {
    const map: Record<Exclude<SeasonFilter, 'all'>, number> = {
      winter: 0,
      summer: 0,
      spring: 0,
      autumn: 0,
    };
    for (const p of availablePerfumes) {
      for (const s of getProductSeasons(p)) {
        map[s] += 1;
      }
    }
    return map;
  }, [availablePerfumes]);

  const houseCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const brand of featuredPerfumeHouses) {
      map[brand] = availablePerfumes.filter((p) => matchesHouseBrand(p, brand)).length;
    }
    return map;
  }, [availablePerfumes]);

  const getSeasonIcon = (seasonId: Exclude<SeasonFilter, 'all'>) => {
    if (seasonId === 'winter') return Snowflake;
    if (seasonId === 'summer') return Sun;
    if (seasonId === 'spring') return Flower2;
    return Leaf;
  };

  return (
    <div className="bg-white text-[#0A0A0A]">
      {/* HERO SPECIALS SHOWCASE — Animated Responsive Fan Deck */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <HeroSpecialsShowcase
          heroBooting={heroBooting}
          showingNewArrivals={showingNewArrivals}
          campaign={campaign}
          slideshowPerfumes={slideshowPerfumes}
          explicitNewArrivalsCount={explicitNewArrivals.length}
          newArrivalsCount={newArrivalsPerfumes.length}
          fallbackProduct={availablePerfumes[0] ?? null}
          onNavigate={onNavigate}
          onSelectProduct={onSelectProduct}
          onQuickWhatsApp={onQuickWhatsApp}
        />

        {/* Immediate Trust Strip — Zero Guesswork */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 border border-[#E5E5E5] rounded-2xl bg-[#F6F6F7] p-5 sm:px-7 sm:py-5">
          {siteContent.trustStrip.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-[#0A0A0A] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[#0A0A0A]">{item.title}</p>
                <p className="text-xs text-[#525252] leading-relaxed">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ACTIVE SPECIALS GRID — Ensures every in-stock perfume marked on special shows on the front page */}
      {specialPerfumes.length > 0 && (
        <RevealSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[#B45309] font-bold inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D97706]" aria-hidden="true" />
                <span>
                  {campaign.enabled && campaign.badgeText
                    ? campaign.badgeText
                    : 'Limited-Time Savings'}
                </span>
              </p>
              <h2 className="text-2xl sm:text-4xl font-extrabold italic uppercase tracking-tight text-[#0A0A0A]">
                On Special Now
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                onNavigate('shop', {
                  category: 'All',
                  brand: 'All',
                  size: 'All',
                  priceRange: 'all',
                  season: 'all',
                  onlySpecials: true,
                  onlyUnboxed: false,
                  onlyNewArrivals: false,
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] text-xs font-semibold uppercase tracking-[0.12em] text-[#0A0A0A] transition-colors self-start sm:self-auto whitespace-nowrap shrink-0"
            >
              <span>Shop All Specials</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
            {specialPerfumes.slice(0, 8).map((product, idx) => (
              <ProductCard
                key={product.id}
                product={product}
                index={idx}
                disableEntranceAnimation
                imageLoading={idx < 4 ? 'eager' : 'lazy'}
                fetchPriority={idx < 4 ? 'auto' : 'low'}
                onViewDetails={onSelectProduct}
                onQuickWhatsApp={onQuickWhatsApp}
                onAddToBasket={onAddToBasket}
              />
            ))}
          </div>
        </RevealSection>
      )}

      {/* WEEKLY 5ML SPECIAL (4 FOR E100 OR 2 UNDER-E500 FOR E50) */}
      <WeeklyFiveMlSection
        onSelectProduct={onSelectProduct}
        onAddWeeklyPackToBasket={onAddWeeklyPackToBasket}
        onAddExclusiveFiveMlToBasket={onAddExclusiveFiveMlToBasket}
      />

      {/* SHOP DEALS BY PRICE */}
      <RevealSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold italic uppercase tracking-tight text-[#0A0A0A]">
            Shop Deals by Price
          </h2>
          <p className="text-xs sm:text-sm text-[#525252]">
            {campaign.enabled && campaign.badgeText
              ? `Every price reflects active ${campaign.badgeText.toLowerCase()} savings`
              : 'Filter bottles & travel decants by budget'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {priceDeals.map((tier) => {
            const matchCount = priceDealCounts[tier.id] ?? 0;
            return (
              <motion.button
                key={tier.id}
                type="button"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                onClick={() =>
                  onNavigate('shop', {
                    category: 'All',
                    brand: 'All',
                    size: 'All',
                    priceRange: tier.id,
                    season: 'all',
                    onlySpecials: false,
                  })
                }
                className={`group rounded-2xl p-6 sm:p-7 flex flex-col justify-between min-h-[168px] text-left transition-shadow ${
                  tier.highlight
                    ? 'bg-[#FACC15] text-[#0A0A0A] hover:shadow-[0_18px_36px_-14px_rgba(250,204,21,0.55)]'
                    : 'bg-[#0A0A0A] text-white hover:shadow-[0_18px_36px_-14px_rgba(0,0,0,0.45)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-[0.2em] ${
                      tier.highlight ? 'text-[#0A0A0A]/80' : 'text-white/75'
                    }`}
                  >
                    {tier.eyebrow}
                  </span>
                  <span
                    className={`text-[11px] font-medium tabular-nums ${
                      tier.highlight ? 'text-[#0A0A0A]/75' : 'text-white/60'
                    }`}
                  >
                    {matchCount} {matchCount === 1 ? 'scent' : 'scents'}
                  </span>
                </div>

                <p
                  className={`text-4xl sm:text-[42px] font-extrabold italic tracking-tight tabular-nums leading-none my-4 ${
                    tier.highlight ? 'text-[#0A0A0A]' : 'text-[#FACC15]'
                  }`}
                >
                  {tier.headline}
                </p>

                <div className="flex items-end justify-between gap-3 w-full">
                  <span
                    className={`text-xs sm:text-sm font-semibold leading-snug ${
                      tier.highlight ? 'text-[#0A0A0A]' : 'text-white'
                    }`}
                  >
                    {tier.description}
                  </span>
                  <ArrowRight
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1 ${
                      tier.highlight ? 'text-[#0A0A0A]' : 'text-white'
                    }`}
                  />
                </div>
              </motion.button>
            );
          })}
        </div>
      </RevealSection>

      {/* SHOP BY SEASON */}
      <RevealSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
        <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-6">
          <h2 className="text-2xl sm:text-4xl font-extrabold italic uppercase tracking-tight text-[#0A0A0A]">
            Shop by Season
          </h2>
          <p className="text-xs sm:text-sm text-[#525252]">
            Curated by weather — from winter oud &amp; spice to summer citrus
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SEASON_OPTIONS.map((season) => {
            const Icon = getSeasonIcon(season.id);
            const seasonCount = seasonCounts[season.id] ?? 0;
            return (
              <motion.button
                key={season.id}
                type="button"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                onClick={() =>
                  onNavigate('shop', {
                    category: 'All',
                    brand: 'All',
                    size: 'All',
                    priceRange: 'all',
                    season: season.id,
                    onlySpecials: false,
                  })
                }
                className="group bg-[#F6F6F7] border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-2xl p-6 flex flex-col justify-between min-h-[168px] text-left transition-colors hover:shadow-[0_14px_30px_-14px_rgba(0,0,0,0.12)]"
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#525252]">
                    {season.eyebrow}
                  </span>
                  <Icon className="w-4 h-4 text-[#0A0A0A] shrink-0" aria-hidden="true" />
                </div>

                <div className="my-3.5 space-y-1">
                  <h3 className="text-2xl font-extrabold italic uppercase tracking-tight text-[#0A0A0A]">
                    {season.title}
                  </h3>
                  <p className="text-xs text-[#525252]">{season.scentCue}</p>
                </div>

                <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-between gap-2 w-full">
                  <span className="text-xs font-semibold text-[#0A0A0A] tabular-nums">
                    {seasonCount} {seasonCount === 1 ? 'perfume' : 'perfumes'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#0A0A0A] shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </motion.button>
            );
          })}
        </div>
      </RevealSection>

      {/* INSTANT MOOD & SIGNATURE PICKER (Isolated slideshow timer) */}
      <MoodFragrancePicker
        availablePerfumes={availablePerfumes}
        onNavigate={onNavigate}
        onSelectProduct={onSelectProduct}
        onQuickWhatsApp={onQuickWhatsApp}
        onAddToBasket={onAddToBasket}
      />

      {/* SHOP BY CATEGORY */}
      <RevealSection className="bg-[#F6F6F7] border-y border-[#E5E5E5] py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                Curated Collections
              </p>
              <h2 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A]">
                Shop by Collection
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                onNavigate('shop', {
                  category: 'All',
                  priceRange: 'all',
                  season: 'all',
                  onlySpecials: false,
                })
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] text-xs font-semibold uppercase tracking-[0.12em] text-[#0A0A0A] transition-colors self-start sm:self-auto"
            >
              <span>View All Fragrances</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {siteContent.categories.map((cat) => (
              <motion.button
                key={cat.category}
                type="button"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                onClick={() =>
                  onNavigate('shop', {
                    category: cat.category,
                    priceRange: 'all',
                    season: 'all',
                    onlySpecials: false,
                  })
                }
                className="group relative aspect-[3/4] w-full rounded-3xl overflow-hidden bg-[#0A0A0A] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]"
              >
                <ResilientImage
                  src={cat.image}
                  alt={cat.title}
                  fallbackTitle={cat.title}
                  className="w-full h-full object-cover object-top saturate-[1.06] contrast-[1.02] transition-transform duration-500 ease-out group-hover:scale-105"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8 space-y-2">
                  <span className="block text-[11px] uppercase tracking-[0.2em] text-white/75">
                    {cat.category} Collection
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-bold text-white">
                    {cat.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-white/80 leading-relaxed line-clamp-2">
                    {cat.subtitle}
                  </p>
                  <span className="pt-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white group-hover:translate-x-1 transition-transform">
                    <span>Explore {cat.category}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* DISCOVER OUR DECANTS */}
      <RevealSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5">
            <DecantLineupViewer
              selectedSize={showAllDecantLineup ? 'all' : activeDecant.size}
              onSelectSize={(size: DecantViewerSelection) => {
                if (size === 'all') {
                  setShowAllDecantLineup(true);
                  return;
                }
                const matchedIdx = siteContent.decantsSection.tiers.findIndex(
                  (t) => t.size === size
                );
                if (matchedIdx >= 0) {
                  setActiveDecantIndex(matchedIdx);
                }
                setShowAllDecantLineup(false);
              }}
            />
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                {siteContent.decantsSection.kicker}
              </p>
              <h2 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A] [text-wrap:balance]">
                {siteContent.decantsSection.headline}
              </h2>
              <p className="text-sm sm:text-base text-[#525252] leading-relaxed">
                {siteContent.decantsSection.description}
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {siteContent.decantsSection.tiers.map((tier, idx) => {
                  const active = !showAllDecantLineup && idx === activeDecantIndex;
                  return (
                    <motion.button
                      key={tier.size}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        setActiveDecantIndex(idx);
                        setShowAllDecantLineup(false);
                      }}
                      className={`relative py-3 px-3.5 border rounded-2xl text-left transition-colors ${
                        active
                          ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                          : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                      }`}
                    >
                      <span className="block text-xl font-bold tabular-nums">
                        {tier.size}
                      </span>
                      <span
                        className={`block text-[11px] tabular-nums mt-0.5 ${
                          active ? 'text-white/75' : 'text-[#666666]'
                        }`}
                      >
                        {tier.spraysEstimate}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-6 min-h-[172px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeDecant.size}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-3"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-xl font-bold text-[#0A0A0A]">
                        {activeDecant.title}
                      </h3>
                      <span className="text-xs font-medium text-[#525252]">
                        {activeDecant.idealFor} · {activeDecant.spraysEstimate}
                      </span>
                    </div>
                    <p className="text-sm text-[#404040] leading-relaxed">
                      {activeDecant.summary}
                    </p>
                    <div className="pt-2 flex flex-wrap gap-3">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onNavigate('shop', { size: activeDecant.size })}
                        className="px-5 py-2.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2"
                      >
                        <span>Browse {activeDecant.size} Options</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </motion.button>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => onNavigate('decants')}
                        className="px-5 py-2.5 rounded-full border border-[#0A0A0A] text-[#0A0A0A] hover:bg-white transition-colors text-xs font-semibold uppercase tracking-wider"
                      >
                        Full Decant Guide
                      </motion.button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </RevealSection>

      {/* FEATURED BRANDS — LOGOS */}
      <RevealSection className="bg-[#F6F6F7] border-y border-[#E5E5E5] py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                Perfume Houses We Carry
              </p>
              <h2 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A]">
                Featured Fragrance Houses
              </h2>
            </div>
            <p className="text-xs text-[#525252]">
              Select a house logo to explore its bottles &amp; decants
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
            {featuredPerfumeHouses.map((brand, idx) => {
              const count = houseCounts[brand] ?? 0;
              return (
                <motion.button
                  key={brand}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.05 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(idx * 0.025, 0.12),
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  onClick={() =>
                    onNavigate('shop', {
                      category: 'All',
                      brand,
                      size: 'All',
                      priceRange: 'all',
                      season: 'all',
                      onlySpecials: false,
                    })
                  }
                  aria-label={`Browse ${brand} fragrances`}
                  className="bg-white border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-2xl p-3.5 text-left transition-all duration-200 hover:shadow-[0_14px_30px_-12px_rgba(0,0,0,0.1)] group flex flex-col justify-between"
                >
                  <div className="w-full aspect-[16/10] rounded-xl bg-white border border-[#ECECEE] group-hover:bg-[#FAFAFA] transition-colors flex items-center justify-center p-3">
                    <HouseLogo brand={brand} />
                  </div>

                  <div className="px-1.5 pt-3 pb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#525252] tabular-nums">
                      {count} {count === 1 ? 'listing' : 'listings'}
                    </span>
                    <span className="w-7 h-7 rounded-full border border-[#E5E5E5] group-hover:bg-[#0A0A0A] group-hover:border-[#0A0A0A] group-hover:text-white flex items-center justify-center text-[#0A0A0A] transition-colors">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </RevealSection>

      {/* UNBOXED BOTTLES & LUXURY GIFT HAMPERS */}
      <RevealSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Card 1: Unboxed Perfumes */}
          <article className="group bg-[#F6F6F7] border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-3xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-12 gap-5 items-center transition-colors">
            <button
              type="button"
              onClick={() =>
                onNavigate('shop', {
                  category: 'All',
                  brand: 'All',
                  size: 'All',
                  priceRange: 'all',
                  season: 'all',
                  onlySpecials: false,
                  onlyUnboxed: true,
                })
              }
              aria-label="Shop Unboxed Original Perfumes"
              className="sm:col-span-5 aspect-[4/3] rounded-2xl overflow-hidden bg-white border border-[#E5E5E5] block w-full text-left cursor-pointer"
            >
              <ResilientImage
                src="/assets/aistudio/image_b0d367cb.png"
                alt="Authentic Unboxed Perfume Bottles at AuraHut Co."
                fallbackTitle="Unboxed Bottles"
                loading="lazy"
                variant="card"
                className="w-full h-full object-contain object-center p-2 group-hover:scale-[1.03] transition-transform duration-500"
              />
            </button>
            <div className="sm:col-span-7 space-y-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#525252]">
                <Package className="w-3.5 h-3.5 text-[#0A0A0A]" />
                <span>Personal Wear Value</span>
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                Unboxed Original Perfumes
              </h3>
              <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
                Authentic original Arabian bottles without outer retail boxes — same genuine scent inside at everyday savings.
              </p>
              <button
                type="button"
                onClick={() =>
                  onNavigate('shop', {
                    category: 'All',
                    brand: 'All',
                    size: 'All',
                    priceRange: 'all',
                    season: 'all',
                    onlySpecials: false,
                    onlyUnboxed: true,
                  })
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider"
              >
                <span>Shop Unboxed Bottles</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>

          {/* Card 2: Gift Hampers & Sets */}
          <article className="group bg-[#0A0A0A] text-white border border-[#0A0A0A] hover:border-[#FACC15]/50 rounded-3xl p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-12 gap-5 items-center transition-colors">
            <button
              type="button"
              onClick={() => onNavigate('gifts')}
              aria-label="Explore Luxury Perfume Gift Hampers"
              className="sm:col-span-5 aspect-[4/3] rounded-2xl overflow-hidden bg-[#141414] border border-white/15 grid grid-cols-2 gap-1.5 p-1.5 w-full text-left cursor-pointer"
            >
              <div className="relative w-full h-full rounded-xl overflow-hidden bg-white">
                <ResilientImage
                  src={HIM_HAMPER_IMAGE}
                  alt="AuraHut Co. Black & Gold Executive Men's Gift Hamper"
                  fallbackTitle="For Him Gift Box"
                  loading="lazy"
                  variant="card"
                  className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-500"
                />
              </div>
              <div className="relative w-full h-full rounded-xl overflow-hidden bg-white">
                <ResilientImage
                  src={HER_HAMPER_IMAGE}
                  alt="AuraHut Co. Blush Pink & Rose Gold Women's Gift Hamper"
                  fallbackTitle="For Her Gift Box"
                  loading="lazy"
                  variant="card"
                  className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-500"
                />
              </div>
            </button>
            <div className="sm:col-span-7 space-y-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FACC15]">
                <Gift className="w-3.5 h-3.5" />
                <span>
                  {usingSampleHampers ? 'Curated Gifting · Coming Soon' : 'Curated Gifting'}
                </span>
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Luxury Perfume Gift Hampers
              </h3>
              <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
                {usingSampleHampers
                  ? 'Preview our upcoming luxury satin boxes pairing bottles, body mists & personal cards — or request a custom box on WhatsApp.'
                  : 'Ready-to-gift satin boxes pairing bottles, body mists, decants & personal cards for birthdays, anniversaries & celebrations.'}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('gifts')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047] transition-colors text-xs font-bold uppercase tracking-wider"
              >
                <span>
                  {usingSampleHampers ? 'Preview Gift Hampers' : 'Explore Gift Hampers'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </article>
        </div>
      </RevealSection>

      {/* HOW ORDERING WORKS (ZERO GUESSING NEXT STEPS) */}
      <RevealSection className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#E5E5E5] pb-6">
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                No Forms · No Waiting
              </p>
              <h2 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A]">
                How Ordering Works
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                onNavigate('shop', {
                  category: 'All',
                  priceRange: 'all',
                  season: 'all',
                  onlySpecials: false,
                })
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] text-xs font-semibold uppercase tracking-[0.12em] transition-colors self-start sm:self-auto"
            >
              <span>{siteContent.featuredCollectionBanner.ctaLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {siteContent.howItWorks.map((item) => (
              <div
                key={item.step}
                className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-6 sm:p-7 space-y-3"
              >
                <span className="text-xs font-semibold tracking-wider text-[#525252] tabular-nums">
                  {item.step}.
                </span>
                <h3 className="text-lg font-bold text-[#0A0A0A]">{item.title}</h3>
                <p className="text-sm text-[#525252] leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* OUR STORES */}
      <RevealSection className="bg-[#F6F6F7] border-y border-[#E5E5E5] py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 sm:mb-10">
            <div className="space-y-1.5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                Eswatini Stores
              </p>
              <h2 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A]">
                Our Stores
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('stores')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] text-xs font-semibold uppercase tracking-[0.12em] text-[#0A0A0A] transition-colors self-start sm:self-auto"
            >
              <span>View Our Store</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {siteConfig.branches.map((branch) => (
              <article
                key={branch.id}
                className="bg-white border border-[#E5E5E5] rounded-3xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-12 gap-5 items-stretch"
              >
                <div className="sm:col-span-5 aspect-[9/16] max-w-[290px] sm:max-w-none w-full mx-auto bg-[#0A0A0A] rounded-2xl overflow-hidden">
                  <ResilientImage
                    src={branch.image}
                    alt={`${branch.name} Storefront & Visual Directions`}
                    fallbackTitle={branch.name}
                    className="w-full h-full object-cover object-center"
                  />
                </div>

                <div className="sm:col-span-7 px-1 py-1 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E5E5E5] pb-3">
                      <h3 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                        {branch.name}
                      </h3>
                      <span className="text-[11px] uppercase tracking-wider text-[#525252] font-medium">
                        {branch.city}, Eswatini
                      </span>
                    </div>

                    <div className="space-y-2.5 text-sm text-[#404040]">
                      <p className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-[#0A0A0A] shrink-0 mt-0.5" />
                        <span className="leading-snug">{branch.address}</span>
                      </p>
                      <div className="flex items-start gap-2.5">
                        <Clock className="w-4 h-4 text-[#0A0A0A] shrink-0 mt-0.5" />
                        <div className="text-xs sm:text-sm space-y-0.5">
                          <p>{branch.openingHours.weekdays}</p>
                          <p>{branch.openingHours.saturday}</p>
                          <p className="text-[#737373]">{branch.openingHours.sunday}</p>
                        </div>
                      </div>
                      <p className="flex items-center gap-2.5 text-xs sm:text-sm">
                        <Phone className="w-4 h-4 text-[#0A0A0A] shrink-0" />
                        <a
                          href={`tel:${branch.phoneDisplay.replace(/[^\d+]/g, '')}`}
                          className="hover:underline tabular-nums"
                        >
                          {branch.phoneDisplay}
                        </a>
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#E5E5E5] flex flex-wrap gap-2.5">
                    <a
                      href={branch.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 min-w-[130px] py-2.5 px-4 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] hover:bg-[#F6F6F7] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <span>Directions</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => onSelectBranchAndBasket(branch.id)}
                      className="flex-1 min-w-[130px] py-2.5 px-4 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-white" />
                      <span>Shop {branch.city}</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </RevealSection>

      {/* FRAGRANCE JOURNAL (TIKTOK, INSTAGRAM & FACEBOOK) */}
      <RevealSection className="bg-white py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center lg:text-left">
            <p className="text-xs uppercase tracking-[0.2em] text-[#525252] font-medium flex items-center justify-center lg:justify-start gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#0A0A0A]" />
              <span>Follow Our Fragrance Journal</span>
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A]">
              {siteConfig.social.tiktokHandle} on TikTok
            </h2>
            <p className="text-xs sm:text-sm text-[#525252]">
              Daily scent reviews, unboxings &amp; layering guides on TikTok — also connect with us on Instagram &amp; Facebook.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <a
              href={siteConfig.social.tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider"
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                className="w-4 h-4 text-white"
              >
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.34 0 .66.06.96.16V9.01a6.33 6.33 0 0 0-.96-.08A6.34 6.34 0 0 0 3 15.27 6.34 6.34 0 0 0 9.34 21.6a6.34 6.34 0 0 0 6.34-6.34V8.76a8.28 8.28 0 0 0 4.77 1.5V6.82a4.85 4.85 0 0 1-.86-.13Z" />
              </svg>
              <span>Follow on TikTok</span>
            </a>

            <a
              href={siteConfig.social.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[#D4D4D4] bg-white text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors text-xs font-semibold uppercase tracking-wider"
            >
              <Instagram className="w-4 h-4" />
              <span>Instagram</span>
            </a>

            <a
              href={siteConfig.social.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-[#D4D4D4] bg-white text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors text-xs font-semibold uppercase tracking-wider"
            >
              <Facebook className="w-4 h-4" />
              <span>Facebook</span>
            </a>
          </div>
        </div>
      </RevealSection>
    </div>
  );
};

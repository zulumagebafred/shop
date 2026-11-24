import {
  FragranceProduct,
  WeeklyFiveMlAudience,
  WeeklyFiveMlSpecial,
} from '../types/fragrance';
import {
  getEffectiveUnitPrice,
  getProductPriceSummary,
  matchesPriceRange,
  parseVolumeMl,
} from './pricing';

export interface WeeklyTierCandidate {
  product: FragranceProduct;
  tierPrice: number | null;
  tierSizeLabel: string;
  fiveMlPrice: number | null;
  hasAvailableFiveMl: boolean;
  isStrictTierMatch: boolean;
}

export interface ResolvedWeeklyAudienceLineup {
  audience: WeeklyFiveMlAudience;
  under500Picks: WeeklyTierCandidate[];
  under800Picks: WeeklyTierCandidate[];
  allFourPicks: WeeklyTierCandidate[];
  under500Pool: WeeklyTierCandidate[];
  under800Pool: WeeklyTierCandidate[];
  usingFallbackTiers: boolean;
  usingUnisexSupplement: boolean;
  isManualOverrideForWeek: boolean;
}

export interface ResolvedWeeklyFiveMl {
  enabled: boolean;
  weekKey: string;
  weekLabel: string;
  weekEndMs: number;
  fourPackPrice: number;
  twoPackPrice: number;
  women: ResolvedWeeklyAudienceLineup;
  men: ResolvedWeeklyAudienceLineup;
  under500Picks: WeeklyTierCandidate[];
  under800Picks: WeeklyTierCandidate[];
  allFourPicks: WeeklyTierCandidate[];
  under500Pool: WeeklyTierCandidate[];
  under800Pool: WeeklyTierCandidate[];
  usingFallbackTiers: boolean;
  isManualOverrideForWeek: boolean;
}

export interface ResolvedExclusiveFiveMlItem {
  product: FragranceProduct;
  customPrice: number;
  catalogueFiveMlPrice: number | null;
}

export const DEFAULT_WEEKLY_FIVE_ML_SPECIAL: WeeklyFiveMlSpecial = {
  enabled: true,
  autoRotateWeekly: true,
  weekKey: '',
  seedOffset: 0,
  under500Ids: [],
  under800Ids: [],
  womenUnder500Ids: [],
  womenUnder800Ids: [],
  menUnder500Ids: [],
  menUnder800Ids: [],
  fourPackPrice: 100,
  twoPackPrice: 50,
  exclusiveEnabled: false,
  exclusiveTitle: 'Exclusive 5ml Owner Reserve',
  exclusiveBadge: 'OWNER EXCLUSIVE',
  exclusiveSubtitle:
    'Special 5ml decants hand-picked and individually priced by AuraHut Co.',
  exclusiveBundleEnabled: false,
  exclusiveBundlePrice: 0,
  exclusiveItems: [],
};

/**
 * Returns the Monday–Sunday calendar bounds for the given timestamp.
 */
export function getWeekWindowBounds(referenceNow: number = Date.now()): {
  startMs: number;
  endMs: number;
  weekKey: string;
  label: string;
} {
  const start = new Date(referenceNow);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  // ISO week number calculation
  const utc = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const isoYear = utc.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const dayOfYear = Math.floor((utc.getTime() - yearStart.getTime()) / 86400000) + 1;
  const isoWeek = Math.ceil(dayOfYear / 7);
  const weekKey = `${isoYear}-W${String(isoWeek).padStart(2, '0')}`;

  const fmt = new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
  });
  const label = `Mon ${fmt.format(start)} – Sun ${fmt.format(end)}`;

  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    weekKey,
    label,
  };
}

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createMulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: T[], seedStr: string): T[] {
  const copy = [...items];
  const rand = createMulberry32(hashSeed(seedStr));
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function buildTierCandidate(
  product: FragranceProduct,
  isStrictTierMatch: boolean
): WeeklyTierCandidate {
  const availablePriced = product.sizes.filter((s) => s.available && s.price !== null);
  const fullBottles = availablePriced.filter((s) => parseVolumeMl(s.size) >= 30);
  const refPool = fullBottles.length > 0 ? fullBottles : availablePriced;

  let tierPrice: number | null = null;
  let tierSizeLabel = 'Bottle';

  if (refPool.length > 0) {
    const sortedRef = [...refPool].sort((a, b) => {
      const mlDiff = parseVolumeMl(b.size) - parseVolumeMl(a.size);
      if (mlDiff !== 0) return mlDiff;
      return (b.price ?? 0) - (a.price ?? 0);
    });
    const chosen = sortedRef[0];
    tierSizeLabel = chosen.size;
    tierPrice = getEffectiveUnitPrice(
      chosen.price,
      product.onSpecial,
      product.specialDiscountPercent,
      product.specialDiscountType,
      product.specialDiscountAmount
    );
  } else {
    const summary = getProductPriceSummary(product);
    tierPrice = summary.highestEffective;
    tierSizeLabel = summary.highestSize ?? '5ml';
  }

  const fiveMlOption = product.sizes.find(
    (s) => s.size.trim().toLowerCase() === '5ml' && s.available
  );
  const fiveMlPrice = fiveMlOption
    ? getEffectiveUnitPrice(
        fiveMlOption.price,
        product.onSpecial,
        product.specialDiscountPercent,
        product.specialDiscountType,
        product.specialDiscountAmount
      )
    : null;

  return {
    product,
    tierPrice,
    tierSizeLabel,
    fiveMlPrice,
    hasAvailableFiveMl: Boolean(fiveMlOption),
    isStrictTierMatch,
  };
}

function buildTierPoolsFromProducts(eligibleProducts: FragranceProduct[]): {
  under500Pool: WeeklyTierCandidate[];
  under800Pool: WeeklyTierCandidate[];
  usingFallbackTiers: boolean;
} {
  const fiveMlCapable = eligibleProducts.filter((p) =>
    p.sizes.some((s) => s.size.trim().toLowerCase() === '5ml' && s.available)
  );
  const baseEligible = fiveMlCapable.length >= 4 ? fiveMlCapable : eligibleProducts;
  const baseCandidates = baseEligible.map((p) => buildTierCandidate(p, true));

  const strictUnder500 = baseCandidates.filter(
    (c) => c.tierPrice !== null && c.tierPrice <= 500
  );
  const strictUnder500Ids = new Set(strictUnder500.map((c) => c.product.id));

  const strictUnder800 = baseCandidates.filter(
    (c) =>
      !strictUnder500Ids.has(c.product.id) &&
      c.tierPrice !== null &&
      c.tierPrice > 500 &&
      c.tierPrice <= 800
  );

  let under500Pool = [...strictUnder500];
  let under800Pool = [...strictUnder800];
  let usingFallbackTiers = false;

  if (under500Pool.length < 3) {
    usingFallbackTiers = true;
    const usedIds = new Set([
      ...under500Pool.map((c) => c.product.id),
      ...under800Pool.map((c) => c.product.id),
    ]);
    const budgetFallback = baseCandidates
      .filter(
        (c) =>
          !usedIds.has(c.product.id) && matchesPriceRange(c.product, 'under-500')
      )
      .sort((a, b) => (a.tierPrice ?? 99999) - (b.tierPrice ?? 99999))
      .map((c) => ({ ...c, isStrictTierMatch: false }));

    under500Pool = [...under500Pool, ...budgetFallback];

    if (under500Pool.length < 3) {
      const stillUsed = new Set([
        ...under500Pool.map((c) => c.product.id),
        ...under800Pool.map((c) => c.product.id),
      ]);
      const sortedRest = baseCandidates
        .filter((c) => !stillUsed.has(c.product.id))
        .sort((a, b) => (a.tierPrice ?? 99999) - (b.tierPrice ?? 99999))
        .map((c) => ({ ...c, isStrictTierMatch: false }));
      for (const candidate of sortedRest) {
        if (under500Pool.length >= Math.max(3, Math.floor(baseCandidates.length / 2))) {
          break;
        }
        under500Pool.push(candidate);
      }
    }
  }

  const assignedTo500Ids = new Set(under500Pool.map((c) => c.product.id));
  under800Pool = under800Pool.filter((c) => !assignedTo500Ids.has(c.product.id));

  if (under800Pool.length < 2) {
    usingFallbackTiers = true;
    const under800Fallback = baseCandidates
      .filter(
        (c) =>
          !assignedTo500Ids.has(c.product.id) &&
          !under800Pool.some((u) => u.product.id === c.product.id) &&
          matchesPriceRange(c.product, 'under-800')
      )
      .sort((a, b) => (a.tierPrice ?? 99999) - (b.tierPrice ?? 99999))
      .map((c) => ({ ...c, isStrictTierMatch: false }));

    under800Pool = [...under800Pool, ...under800Fallback];

    if (under800Pool.length < 2) {
      const usedSet = new Set([
        ...assignedTo500Ids,
        ...under800Pool.map((c) => c.product.id),
      ]);
      const rest = baseCandidates
        .filter((c) => !usedSet.has(c.product.id))
        .sort((a, b) => (a.tierPrice ?? 99999) - (b.tierPrice ?? 99999))
        .map((c) => ({ ...c, isStrictTierMatch: false }));
      under800Pool = [...under800Pool, ...rest];
    }
  }

  return { under500Pool, under800Pool, usingFallbackTiers };
}

/**
 * Separates in-stock fragrances into Under E500 and Under E800 pools across all categories.
 */
export function buildWeeklyTierPools(perfumes: FragranceProduct[]): {
  under500Pool: WeeklyTierCandidate[];
  under800Pool: WeeklyTierCandidate[];
  usingFallbackTiers: boolean;
} {
  const inStock = perfumes.filter((p) => p.availability !== 'Out of Stock');
  return buildTierPoolsFromProducts(inStock);
}

/**
 * Builds Under E500 and Under E800 pools specifically for 'Women' or 'Men'.
 * Strictly prioritizes `p.category === audience`, supplements with `Unisex` only when needed
 * to ensure both tiers have at least 2 picks, and excludes Out of Stock perfumes.
 */
export function buildWeeklyTierPoolsForAudience(
  perfumes: FragranceProduct[],
  audience: WeeklyFiveMlAudience
): {
  under500Pool: WeeklyTierCandidate[];
  under800Pool: WeeklyTierCandidate[];
  usingFallbackTiers: boolean;
  usingUnisexSupplement: boolean;
} {
  const inStock = perfumes.filter((p) => p.availability !== 'Out of Stock');
  const strictAudience = inStock.filter((p) => p.category === audience);
  const unisexProducts = inStock.filter((p) => p.category === 'Unisex');

  const strictAttempt = buildTierPoolsFromProducts(strictAudience);
  const strictHasEnough =
    strictAttempt.under500Pool.length >= 3 &&
    strictAttempt.under800Pool.length >= 2 &&
    strictAudience.length >= 5;

  // Include Unisex in the admin dropdown / supplemental pool when strict pool lacks depth,
  // while keeping strict audience picks prioritized in random selection.
  if (strictHasEnough && !strictAttempt.usingFallbackTiers) {
    // Still append Unisex options sorted after strict options so admin pickers can browse both if desired
    const unisexAttempt = buildTierPoolsFromProducts(unisexProducts);
    const seen500 = new Set(strictAttempt.under500Pool.map((c) => c.product.id));
    const seen800 = new Set(strictAttempt.under800Pool.map((c) => c.product.id));
    return {
      under500Pool: [
        ...strictAttempt.under500Pool,
        ...unisexAttempt.under500Pool.filter(
          (c) => !seen500.has(c.product.id) && !seen800.has(c.product.id)
        ),
      ],
      under800Pool: [
        ...strictAttempt.under800Pool,
        ...unisexAttempt.under800Pool.filter(
          (c) => !seen800.has(c.product.id) && !seen500.has(c.product.id)
        ),
      ],
      usingFallbackTiers: false,
      usingUnisexSupplement: false,
    };
  }

  const audiencePlusUnisex = [...strictAudience, ...unisexProducts];
  if (audiencePlusUnisex.length >= 4) {
    const combinedAttempt = buildTierPoolsFromProducts(audiencePlusUnisex);
    return {
      ...combinedAttempt,
      usingUnisexSupplement: true,
    };
  }

  const allInStockAttempt = buildTierPoolsFromProducts(inStock);
  return {
    ...allInStockAttempt,
    usingUnisexSupplement: true,
  };
}

/**
 * Deterministically picks 2 Under-E500 + 2 Under-E800 perfumes for a specific gender lineup.
 */
export function pickRandomWeeklyAudienceIds(
  perfumes: FragranceProduct[],
  audience: WeeklyFiveMlAudience,
  weekKey: string,
  seedOffset: number = 0
): { under500Ids: string[]; under800Ids: string[] } {
  const { under500Pool, under800Pool } = buildWeeklyTierPoolsForAudience(perfumes, audience);

  const sortBucketed = (pool: WeeklyTierCandidate[], salt: string) => {
    const strictFirst = pool.filter((c) => c.product.category === audience);
    const unisexNext = pool.filter((c) => c.product.category === 'Unisex');
    const restLast = pool.filter(
      (c) => c.product.category !== audience && c.product.category !== 'Unisex'
    );
    return [
      ...seededShuffle(strictFirst, `${salt}:strict`),
      ...seededShuffle(unisexNext, `${salt}:unisex`),
      ...seededShuffle(restLast, `${salt}:rest`),
    ];
  };

  const tag = audience.toLowerCase();
  const shuffled500 = sortBucketed(under500Pool, `${weekKey}:${tag}:u500:${seedOffset}`);
  const picked500 = shuffled500.slice(0, 3);
  const picked500Ids = new Set(picked500.map((c) => c.product.id));

  const distinct800Pool = under800Pool.filter((c) => !picked500Ids.has(c.product.id));
  const shuffled800 = sortBucketed(distinct800Pool, `${weekKey}:${tag}:u800:${seedOffset}`);
  const picked800 = shuffled800.slice(0, 2);

  return {
    under500Ids: picked500.map((c) => c.product.id),
    under800Ids: picked800.map((c) => c.product.id),
  };
}

/**
 * Legacy helper returning a general draw across both genders (kept for compatibility).
 */
export function pickRandomWeeklyIds(
  perfumes: FragranceProduct[],
  weekKey: string,
  seedOffset: number = 0
): { under500Ids: string[]; under800Ids: string[] } {
  return pickRandomWeeklyAudienceIds(perfumes, 'Women', weekKey, seedOffset);
}

function resolveAudienceLineup(
  perfumes: FragranceProduct[],
  audience: WeeklyFiveMlAudience,
  savedUnder500Ids: string[],
  savedUnder800Ids: string[],
  weekKey: string,
  seedOffset: number,
  shouldUseSavedOverrides: boolean
): ResolvedWeeklyAudienceLineup {
  const {
    under500Pool,
    under800Pool,
    usingFallbackTiers,
    usingUnisexSupplement,
  } = buildWeeklyTierPoolsForAudience(perfumes, audience);

  const randomFallback = pickRandomWeeklyAudienceIds(
    perfumes,
    audience,
    weekKey,
    seedOffset
  );

  const pool500ById = new Map(under500Pool.map((c) => [c.product.id, c]));
  const pool800ById = new Map(under800Pool.map((c) => [c.product.id, c]));
  const inStockMatchingById = new Map(
    perfumes
      .filter(
        (p) =>
          p.availability !== 'Out of Stock' &&
          (p.category === audience || p.category === 'Unisex')
      )
      .map((p) => [p.id, buildTierCandidate(p, false)])
  );
  const anyInStockById = new Map(
    perfumes
      .filter((p) => p.availability !== 'Out of Stock')
      .map((p) => [p.id, buildTierCandidate(p, false)])
  );

  const findCandidate = (
    id: string,
    primaryPool: Map<string, WeeklyTierCandidate>
  ): WeeklyTierCandidate | undefined => {
    return (
      primaryPool.get(id) ??
      inStockMatchingById.get(id) ??
      (under500Pool.length + under800Pool.length < 4 ? anyInStockById.get(id) : undefined)
    );
  };

  const resolved500: WeeklyTierCandidate[] = [];
  const chosenIds = new Set<string>();

  if (shouldUseSavedOverrides) {
    for (const id of savedUnder500Ids) {
      if (resolved500.length >= 3) break;
      if (chosenIds.has(id)) continue;
      const candidate = findCandidate(id, pool500ById);
      if (candidate) {
        resolved500.push(candidate);
        chosenIds.add(id);
      }
    }
  }

  for (const id of randomFallback.under500Ids) {
    if (resolved500.length >= 3) break;
    if (chosenIds.has(id)) continue;
    const candidate = pool500ById.get(id) ?? anyInStockById.get(id);
    if (candidate) {
      resolved500.push(candidate);
      chosenIds.add(id);
    }
  }

  const resolved800: WeeklyTierCandidate[] = [];

  if (shouldUseSavedOverrides) {
    for (const id of savedUnder800Ids) {
      if (resolved800.length >= 2) break;
      if (chosenIds.has(id)) continue;
      const candidate = findCandidate(id, pool800ById);
      if (candidate) {
        resolved800.push(candidate);
        chosenIds.add(id);
      }
    }
  }

  for (const id of randomFallback.under800Ids) {
    if (resolved800.length >= 2) break;
    if (chosenIds.has(id)) continue;
    const candidate = pool800ById.get(id) ?? anyInStockById.get(id);
    if (candidate) {
      resolved800.push(candidate);
      chosenIds.add(id);
    }
  }

  return {
    audience,
    under500Picks: resolved500,
    under800Picks: resolved800,
    allFourPicks: [...resolved500.slice(0, 2), ...resolved800],
    under500Pool,
    under800Pool,
    usingFallbackTiers,
    usingUnisexSupplement,
    isManualOverrideForWeek:
      shouldUseSavedOverrides &&
      (savedUnder500Ids.length > 0 || savedUnder800Ids.length > 0),
  };
}

/**
 * Resolves the active Weekly 5ml Special lineup for both Women and Men.
 * Automatically rotates picks on a new week when autoRotateWeekly is enabled,
 * and replaces any Out of Stock items cleanly with valid same-tier candidates.
 */
export function resolveWeeklyFiveMlSelection(
  perfumes: FragranceProduct[],
  config: WeeklyFiveMlSpecial = DEFAULT_WEEKLY_FIVE_ML_SPECIAL,
  nowMs: number = Date.now()
): ResolvedWeeklyFiveMl {
  const windowInfo = getWeekWindowBounds(nowMs);

  const isStaleWeek =
    Boolean(config.autoRotateWeekly) &&
    Boolean(config.weekKey) &&
    config.weekKey !== windowInfo.weekKey;

  const effectiveSeedOffset = isStaleWeek ? 0 : Math.max(0, Number(config.seedOffset ?? 0));
  const shouldUseSavedOverrides = !isStaleWeek;

  const womenLineup = resolveAudienceLineup(
    perfumes,
    'Women',
    config.womenUnder500Ids ?? [],
    config.womenUnder800Ids ?? [],
    windowInfo.weekKey,
    effectiveSeedOffset,
    shouldUseSavedOverrides
  );

  const menLineup = resolveAudienceLineup(
    perfumes,
    'Men',
    config.menUnder500Ids ?? [],
    config.menUnder800Ids ?? [],
    windowInfo.weekKey,
    effectiveSeedOffset,
    shouldUseSavedOverrides
  );

  const fourPackPrice =
    Number.isFinite(Number(config.fourPackPrice)) && config.fourPackPrice > 0
      ? config.fourPackPrice
      : 100;
  const twoPackPrice =
    Number.isFinite(Number(config.twoPackPrice)) && config.twoPackPrice > 0
      ? Math.min(fourPackPrice, config.twoPackPrice)
      : 50;

  return {
    enabled: Boolean(config.enabled),
    weekKey: windowInfo.weekKey,
    weekLabel: windowInfo.label,
    weekEndMs: windowInfo.endMs,
    fourPackPrice,
    twoPackPrice,
    women: womenLineup,
    men: menLineup,
    under500Picks: womenLineup.under500Picks,
    under800Picks: womenLineup.under800Picks,
    allFourPicks: womenLineup.allFourPicks,
    under500Pool: womenLineup.under500Pool,
    under800Pool: womenLineup.under800Pool,
    usingFallbackTiers:
      womenLineup.usingFallbackTiers || menLineup.usingFallbackTiers,
    isManualOverrideForWeek:
      womenLineup.isManualOverrideForWeek || menLineup.isManualOverrideForWeek,
  };
}

/**
 * Resolves owner-curated Exclusive 5ml Special items against live catalogue products,
 * preserving each owner-picked custom 5ml price and filtering out Out of Stock items.
 */
export function resolveExclusiveFiveMlItems(
  perfumes: FragranceProduct[],
  config: WeeklyFiveMlSpecial = DEFAULT_WEEKLY_FIVE_ML_SPECIAL
): ResolvedExclusiveFiveMlItem[] {
  const byId = new Map(perfumes.map((p) => [p.id, p]));
  const items = Array.isArray(config.exclusiveItems) ? config.exclusiveItems : [];
  const seen = new Set<string>();
  const resolved: ResolvedExclusiveFiveMlItem[] = [];

  for (const entry of items) {
    if (!entry || !entry.perfumeId || seen.has(entry.perfumeId)) continue;
    const product = byId.get(entry.perfumeId);
    if (!product || product.availability === 'Out of Stock') continue;
    const customPrice = Number(entry.customPrice);
    if (!Number.isFinite(customPrice) || customPrice <= 0) continue;

    seen.add(entry.perfumeId);
    const fiveMlOpt = product.sizes.find(
      (s) => s.size.trim().toLowerCase() === '5ml' && s.available && s.price !== null
    );
    const catalogueFiveMlPrice = fiveMlOpt
      ? getEffectiveUnitPrice(
          fiveMlOpt.price,
          product.onSpecial,
          product.specialDiscountPercent,
          product.specialDiscountType,
          product.specialDiscountAmount
        )
      : null;

    resolved.push({
      product,
      customPrice,
      catalogueFiveMlPrice,
    });
  }

  return resolved;
}

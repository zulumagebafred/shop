import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  EmailAuthProvider,
  User,
  createUserWithEmailAndPassword,
  linkWithCredential,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  DocumentData,
  QueryDocumentSnapshot,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  where,
  writeBatch,
} from 'firebase/firestore';
import { fragranceCatalogue } from '../data/catalogue';
import {
  starterCombos,
  starterLayeringIdeas,
} from '../data/combosAndLayering';
import {
  DEFAULT_HAMPER_IMAGE,
  HER_HAMPER_IMAGE,
  HIM_HAMPER_IMAGE,
  starterHampers,
} from '../data/hampers';
import {
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  isAuthorizedAdminEmail,
} from '../lib/firebase';
import {
  AuditAction,
  AuditLogEntry,
  AuditSection,
  ComboDeal,
  Coupon,
  ExclusiveFiveMlItem,
  FragranceProduct,
  GiftHamper,
  InfluencerReferral,
  LayeringIdea,
  PublicReferral,
  ReferralAttribution,
  ReferralAttributionStatus,
  ReferralPartnerProfile,
  ReferralPartnerStatus,
  ReferralPayoutMethod,
  ReferralSale,
  ReferralSaleStatus,
  SpecialCampaign,
  SpecialDiscountType,
  WeeklyFiveMlSpecial,
} from '../types/fragrance';
import {
  DEFAULT_WEEKLY_FIVE_ML_SPECIAL,
  getWeekWindowBounds,
} from '../utils/weeklySpecial';
import { calculateReferralCommission } from '../utils/pricing';
import { normalizeBranches } from '../utils/branches';
import {
  buildCampaignDiff,
  buildComboDiff,
  buildCouponDiff,
  buildHamperDiff,
  buildLayeringDiff,
  buildPerfumeDiff,
  buildReferralDiff,
  buildWeeklySpecialDiff,
  deriveAdminUsername,
  sanitizeAuditChanges,
} from '../utils/auditDiff';
import { sha256Hex } from '../utils/hash';
import { withRetry } from '../utils/retry';
import { recordFirestoreRead } from '../utils/perfMonitor';
import { sanitizePromoCode, sanitizeText } from '../utils/sanitize';

export const DEFAULT_CAMPAIGN: SpecialCampaign = {
  title: 'Black Friday Specials',
  badgeText: 'BLACK FRIDAY',
  subtitle:
    'Selected Arabian extraits and hand-poured discovery decants crafted for lasting daily wear.',
  announcementText:
    'Black Friday Specials — Limited savings on curated Arabian fragrances & decants.',
  promoCodeHint: '',
  endsAt: '',
  enabled: false,
  heroMode: 'auto',
  newArrivalsTitle: 'New Arrivals',
  newArrivalsBadge: 'JUST LANDED',
  newArrivalsSubtitle:
    'Freshly landed Arabian extraits & travel decants stocked in Manzini and Mbabane.',
};

export type PerfumeInput = Omit<FragranceProduct, 'id' | 'slug'> & {
  id?: string;
  slug?: string;
};

export type CouponInput = Omit<Coupon, 'id'>;
export type ReferralInput = Omit<InfluencerReferral, 'id'>;
export type ManualReferralSaleInput = {
  referralCode: string;
  orderSummary: string;
  orderSubtotal: number;
  discountAmount?: number;
  customerRef?: string;
  commissionStatus?: ReferralSaleStatus;
};
export type CheckoutReferralSaleInput = {
  referral: PublicReferral | InfluencerReferral;
  orderSummary: string;
  reportedSubtotal: number;
  reportedDiscount: number;
  customerRef: string;
};
export type ComboInput = Omit<ComboDeal, 'id'>;
export type LayeringIdeaInput = Omit<LayeringIdea, 'id'>;
export type GiftHamperInput = Omit<GiftHamper, 'id'>;

export interface SnapshotStatusInfo {
  count: number;
  updatedAtMs: number | null;
  bytes: number;
}

export type PartnerApplicationInput = {
  displayName: string;
  socialHandle: string;
  requestedCode: string;
  payoutMethod: ReferralPayoutMethod;
  payoutAccount: string;
};

export type ApprovePartnerInput = {
  code: string;
  commissionType: 'percentage' | 'fixed';
  commissionValue: number;
  followerDiscountType: 'none' | 'percentage' | 'fixed';
  followerDiscountValue: number;
  payoutNote: string;
  active: boolean;
};

interface StoreContextValue {
  // Auth
  user: User | null;
  authReady: boolean;
  isOwner: boolean;
  signInOwnerWithGoogle: () => Promise<void>;
  signInOwnerWithPassword: (loginInput: string, password: string) => Promise<void>;
  sendOwnerPasswordReset: (loginInput: string) => Promise<string>;
  resendOwnerVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<boolean>;
  setOwnerPasswordCredential: (newPassword: string) => Promise<void>;
  signOutOwner: () => Promise<void>;

  // Referral Partner Auth & Scoped Portal
  signUpPartnerWithPassword: (
    displayName: string,
    email: string,
    password: string
  ) => Promise<void>;
  signInPartnerWithPassword: (email: string, password: string) => Promise<void>;
  signInPartnerWithGoogle: () => Promise<void>;
  sendPartnerPasswordReset: (email: string) => Promise<string>;
  setPartnerPortalActive: (active: boolean) => void;
  partnerProfile: ReferralPartnerProfile | null;
  partnerProfileLoading: boolean;
  partnerReferral: InfluencerReferral | null;
  partnerSales: ReferralSale[];
  partnerSalesLoading: boolean;
  submitPartnerApplication: (input: PartnerApplicationInput) => Promise<void>;
  updatePartnerProfile: (input: PartnerApplicationInput) => Promise<void>;

  // Admin Partner Applications Queue
  partnerApplications: ReferralPartnerProfile[];
  partnerApplicationsLoading: boolean;
  approvePartnerApplication: (
    partner: ReferralPartnerProfile,
    config: ApprovePartnerInput
  ) => Promise<void>;
  updatePartnerApplicationStatus: (
    partnerUid: string,
    status: ReferralPartnerStatus
  ) => Promise<void>;

  // Live Catalogue & Specials
  perfumes: FragranceProduct[];
  livePerfumes: FragranceProduct[];
  usingSampleFallback: boolean;
  catalogueLoading: boolean;
  catalogueComplete: boolean;
  catalogueHasMore: boolean;
  catalogueError: string | null;
  campaign: SpecialCampaign;
  campaignLoading: boolean;
  coupons: Coupon[];
  couponsLoading: boolean;
  referrals: InfluencerReferral[];
  referralsLoading: boolean;
  referralAttributions: ReferralAttribution[];
  referralAttributionsLoading: boolean;
  referralSales: ReferralSale[];
  referralSalesLoading: boolean;
  auditLogs: AuditLogEntry[];
  auditLogsLoading: boolean;
  snapshotStatus: SnapshotStatusInfo | null;

  // Combos & Layering
  combos: ComboDeal[];
  liveCombos: ComboDeal[];
  usingSampleCombos: boolean;
  combosLoading: boolean;
  layeringIdeas: LayeringIdea[];
  liveLayeringIdeas: LayeringIdea[];
  usingSampleLayering: boolean;
  layeringLoading: boolean;

  // Gift Hampers & Gifts
  hampers: GiftHamper[];
  liveHampers: GiftHamper[];
  usingSampleHampers: boolean;
  hampersLoading: boolean;

  // Weekly 5ml Special
  weeklySpecial: WeeklyFiveMlSpecial;
  weeklySpecialLoading: boolean;

  // On-Demand Loading, Pagination & Portal Scoping
  loadMorePerfumes: () => Promise<void>;
  ensureAllPerfumesLoaded: () => Promise<void>;
  ensureSecondaryLoaded: (section: 'combos' | 'layering' | 'hampers') => Promise<void>;
  retryCatalogueSync: () => Promise<void>;
  setAdminConsoleActive: (active: boolean) => void;
  publishCatalogueSnapshot: (
    overrideList?: FragranceProduct[]
  ) => Promise<{ ok: boolean; count: number; bytes: number }>;

  // Storefront Coupon & Referral Validation
  lookupCouponByCode: (
    rawCode: string
  ) => Promise<{ coupon: Coupon | null; error?: string }>;
  lookupReferralByCode: (
    rawCode: string
  ) => Promise<{ referral: PublicReferral | null; error?: string }>;
  recordCheckoutReferralSale: (input: CheckoutReferralSaleInput) => Promise<void>;

  // Owner CRUD Actions
  savePerfume: (input: PerfumeInput, existingId?: string) => Promise<string>;
  deletePerfume: (perfumeId: string) => Promise<void>;
  togglePerfumeSpecial: (
    perfume: FragranceProduct,
    onSpecial: boolean,
    specialDiscountPercent?: number,
    specialLabel?: string,
    specialDiscountType?: SpecialDiscountType,
    specialDiscountAmount?: number,
    skipSnapshotPublish?: boolean
  ) => Promise<void>;
  togglePerfumeNewArrival: (
    perfume: FragranceProduct,
    isNewArrival: boolean
  ) => Promise<void>;
  importStarterCatalogue: () => Promise<number>;
  saveCoupon: (input: CouponInput, isEdit?: boolean) => Promise<void>;
  toggleCouponActive: (coupon: Coupon) => Promise<void>;
  deleteCoupon: (code: string) => Promise<void>;
  saveReferral: (input: ReferralInput, isEdit?: boolean) => Promise<void>;
  toggleReferralActive: (referral: InfluencerReferral) => Promise<void>;
  deleteReferral: (code: string) => Promise<void>;
  approveReferralAttribution: (
    attribution: ReferralAttribution,
    verifiedSubtotal: number,
    verifiedDiscount: number
  ) => Promise<string>;
  dismissReferralAttribution: (attributionId: string) => Promise<void>;
  logManualReferralSale: (input: ManualReferralSaleInput) => Promise<string>;
  updateReferralSaleStatus: (
    saleId: string,
    status: ReferralSaleStatus
  ) => Promise<void>;
  deleteReferralSale: (saleId: string) => Promise<void>;
  saveCampaign: (campaign: SpecialCampaign) => Promise<void>;
  saveWeeklySpecial: (next: WeeklyFiveMlSpecial) => Promise<void>;
  saveComboDeal: (input: ComboInput, existingId?: string) => Promise<string>;
  deleteComboDeal: (comboId: string) => Promise<void>;
  saveLayeringIdea: (input: LayeringIdeaInput, existingId?: string) => Promise<string>;
  deleteLayeringIdea: (ideaId: string) => Promise<void>;
  importStarterCombosAndLayering: () => Promise<number>;
  saveHamper: (input: GiftHamperInput, existingId?: string) => Promise<string>;
  deleteHamper: (hamperId: string) => Promise<void>;
  importStarterHampers: () => Promise<number>;
}

const StoreContext = createContext<StoreContextValue | undefined>(undefined);

function slugifyId(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || `perfume-${Date.now()}`;
}

function normalizeAdminEmailInput(loginInput: string): string {
  const cleaned = loginInput.trim().toLowerCase();
  if (!cleaned || !cleaned.includes('@')) {
    throw new Error('Enter your full admin email address.');
  }
  return cleaned;
}

function isPermissionDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: unknown }).code;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    code === 'permission-denied' ||
    msg.includes('permission-denied') ||
    msg.includes('Missing or insufficient permissions')
  );
}

// Cache Keys & TTLs engineered to stay comfortably under Spark 50k reads/day
const CAMPAIGN_CACHE_KEY = 'aurahut_campaign_cache_v1';
const PERFUMES_CACHE_KEY = 'aurahut_perfumes_cache_v1';
const PERFUMES_META_KEY = 'aurahut_perfumes_meta_v2';
const COMBOS_CACHE_KEY = 'aurahut_combos_cache_v1';
const LAYERING_CACHE_KEY = 'aurahut_layering_cache_v1';
const WEEKLY_5ML_CACHE_KEY = 'aurahut_weekly_5ml_cache_v1';
const HAMPERS_CACHE_KEY = 'aurahut_hampers_cache_v2';

function resolveHamperImage(rawImage: unknown, occasion: unknown): string {
  const raw = String(rawImage ?? '').trim();
  const occ = String(occasion ?? '').trim().toLowerCase();
  const fallback = occ === 'for her' || occ === 'anniversary' ? HER_HAMPER_IMAGE : HIM_HAMPER_IMAGE;
  if (
    !raw ||
    raw === '/assets/images/luxury_gift_hamper_1795005244668.jpg' ||
    raw === '/src/assets/images/luxury_gift_hamper_1795005244668.jpg'
  ) {
    return fallback;
  }
  return raw;
}
const CACHE_TS_KEY = 'aurahut_cache_timestamps_v1';
const COUPON_LOOKUP_CACHE_KEY = 'aurahut_coupon_lookup_v1';
const REFERRAL_LOOKUP_CACHE_KEY = 'aurahut_referral_lookup_v1';

const CATALOGUE_TTL_MS = 60 * 1000; // 1 minute stale-while-revalidate (1-read snapshot)
const PROMO_TTL_MS = 60 * 1000; // 1 minute stale-while-revalidate
const SECONDARY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const LOOKUP_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DUPLICATE_REFERRAL_WINDOW_MS = 12_000;
const INITIAL_PAGE_SIZE = 60;
const INCREMENTAL_PAGE_SIZE = 140;
const SNAPSHOT_DOC_ID = 'public';
const SNAPSHOT_VERSION = 1;
const SNAPSHOT_MAX_BYTES = 890_000;
const PUBLIC_AVAILABILITIES = ['In Stock', 'Low Stock', 'Out of Stock', 'Pre-Order'] as const;

type CompactPerfumeTuple = {
  i: string;
  sl: string;
  sm?: 1;
  n: string;
  b: string;
  c: 'M' | 'W' | 'U' | 'K';
  cn: string;
  d: string;
  im: string;
  nt: [string[], string[], string[]];
  sz: [string, number | null, 0 | 1][];
  av: FragranceProduct['availability'];
  ab?: ('mz' | 'mb')[];
  f?: 1;
  bs?: 1;
  ub?: 1;
  na?: 1;
  cm?: number;
  sp?: 1;
  spl?: string;
  spt?: 'f';
  spd?: number;
  spa?: number;
};

function getCacheTimestamp(section: string): number {
  try {
    const raw = localStorage.getItem(CACHE_TS_KEY);
    if (!raw) return 0;
    const map = JSON.parse(raw) as Record<string, number>;
    return typeof map[section] === 'number' ? map[section] : 0;
  } catch {
    return 0;
  }
}

function setCacheTimestamp(section: string, ts = Date.now()): void {
  try {
    const raw = localStorage.getItem(CACHE_TS_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    map[section] = ts;
    localStorage.setItem(CACHE_TS_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

function isCacheFresh(section: string, ttlMs: number): boolean {
  const ts = getCacheTimestamp(section);
  return ts > 0 && Date.now() - ts < ttlMs;
}

function encodeCompactPerfumes(items: FragranceProduct[]): string {
  const packed: CompactPerfumeTuple[] = items.map((p) => {
    const catChar: 'M' | 'W' | 'U' | 'K' =
      p.category === 'Men'
        ? 'M'
        : p.category === 'Women'
        ? 'W'
        : p.category === 'Kiddies'
        ? 'K'
        : 'U';
    const obj: CompactPerfumeTuple = {
      i: p.id,
      sl: p.slug,
      n: p.name,
      b: p.brand,
      c: catChar,
      cn: p.concentration,
      d: p.description,
      im: p.image,
      nt: [p.notes.top, p.notes.heart, p.notes.base],
      sz: p.sizes.map((s) => [s.size, s.price, s.available ? 1 : 0]),
      av: p.availability,
    };
    if (p.isSampleListing) obj.sm = 1;
    if (p.availableBranches && p.availableBranches.length > 0) {
      obj.ab = p.availableBranches.map((br) => (br === 'mbabane' ? 'mb' : 'mz'));
    }
    if (p.featured) obj.f = 1;
    if (p.bestseller) obj.bs = 1;
    if (p.isUnboxed) obj.ub = 1;
    if (p.isNewArrival) obj.na = 1;
    if (p.createdAtMs) obj.cm = p.createdAtMs;
    if (p.onSpecial) obj.sp = 1;
    if (p.specialLabel) obj.spl = p.specialLabel;
    if (p.specialDiscountType === 'fixed') obj.spt = 'f';
    if (p.specialDiscountPercent) obj.spd = p.specialDiscountPercent;
    if (p.specialDiscountAmount) obj.spa = p.specialDiscountAmount;
    return obj;
  });
  return JSON.stringify(packed);
}

function decodeCompactPerfumes(jsonStr: string): FragranceProduct[] {
  const rawList = JSON.parse(jsonStr) as CompactPerfumeTuple[];
  if (!Array.isArray(rawList)) return [];
  return rawList.map((row) => ({
    id: String(row.i ?? ''),
    slug: String(row.sl ?? row.i ?? ''),
    isSampleListing: Boolean(row.sm),
    name: String(row.n ?? ''),
    brand: String(row.b ?? ''),
    category:
      row.c === 'M'
        ? 'Men'
        : row.c === 'W'
        ? 'Women'
        : row.c === 'K'
        ? 'Kiddies'
        : 'Unisex',
    concentration: String(row.cn ?? 'Eau de Parfum'),
    description: String(row.d ?? ''),
    image: String(row.im ?? ''),
    notes: {
      top: Array.isArray(row.nt?.[0]) ? row.nt[0].map(String) : [],
      heart: Array.isArray(row.nt?.[1]) ? row.nt[1].map(String) : [],
      base: Array.isArray(row.nt?.[2]) ? row.nt[2].map(String) : [],
    },
    sizes: normalizeAndDedupeSizes(
      Array.isArray(row.sz)
        ? row.sz.map((tuple) => ({
            size: tuple[0],
            price: tuple[1],
            available: Boolean(tuple[2]),
          }))
        : []
    ),
    availability: row.av ?? 'In Stock',
    availableBranches: Array.isArray(row.ab)
      ? normalizeBranches(row.ab.map((b) => (b === 'mb' ? 'mbabane' : 'manzini')))
      : undefined,
    featured: Boolean(row.f),
    bestseller: Boolean(row.bs),
    isUnboxed: Boolean(row.ub),
    isNewArrival: Boolean(row.na),
    createdAtMs: typeof row.cm === 'number' ? row.cm : undefined,
    onSpecial: Boolean(row.sp),
    specialLabel: row.spl ? String(row.spl) : '',
    specialDiscountType: row.spt === 'f' ? 'fixed' : 'percentage',
    specialDiscountPercent:
      typeof row.spd === 'number' ? row.spd : 0,
    specialDiscountAmount:
      typeof row.spa === 'number' ? row.spa : 0,
  }));
}

function normalizeAndDedupeSizes(
  rawSizes: unknown
): { size: string; price: number | null; available: boolean }[] {
  if (!Array.isArray(rawSizes)) return [];
  const byKey = new Map<
    string,
    { size: string; price: number | null; available: boolean }
  >();

  for (const entry of rawSizes) {
    if (!entry || typeof entry !== 'object') continue;
    const s = entry as { size?: unknown; price?: unknown; available?: unknown };
    const cleanSize = String(s.size ?? '').trim().slice(0, 24);
    if (!cleanSize) continue;
    const parsedPrice =
      s.price !== null &&
      s.price !== undefined &&
      Number.isFinite(Number(s.price)) &&
      Number(s.price) >= 0
        ? Math.min(100000, Number(s.price))
        : null;
    const available = Boolean(s.available);
    const dedupeKey = cleanSize.toLowerCase();
    const existing = byKey.get(dedupeKey);

    if (!existing) {
      byKey.set(dedupeKey, { size: cleanSize, price: parsedPrice, available });
    } else {
      const nextAvailable = existing.available || available;
      const nextPrice =
        parsedPrice !== null && (available || existing.price === null)
          ? parsedPrice
          : existing.price;
      byKey.set(dedupeKey, {
        size: existing.size,
        price: nextPrice,
        available: nextAvailable,
      });
    }
  }

  return Array.from(byKey.values());
}

function mapPerfumeDoc(id: string, d: DocumentData): FragranceProduct {
  return {
    id,
    slug: typeof d.slug === 'string' ? d.slug : id,
    isSampleListing: Boolean(d.isSampleListing),
    name: String(d.name ?? ''),
    brand: String(d.brand ?? ''),
    category:
      d.category === 'Men' || d.category === 'Women' || d.category === 'Kiddies'
        ? d.category
        : 'Unisex',
    concentration: String(d.concentration ?? 'Eau de Parfum'),
    description: String(d.description ?? ''),
    image: String(d.image ?? ''),
    notes: {
      top: Array.isArray(d.notes?.top) ? d.notes.top.map(String) : [],
      heart: Array.isArray(d.notes?.heart) ? d.notes.heart.map(String) : [],
      base: Array.isArray(d.notes?.base) ? d.notes.base.map(String) : [],
    },
    sizes: normalizeAndDedupeSizes(d.sizes),
    availability: d.availability ?? 'In Stock',
    availableBranches: Array.isArray(d.availableBranches)
      ? normalizeBranches(d.availableBranches)
      : undefined,
    featured: Boolean(d.featured),
    bestseller: Boolean(d.bestseller),
    isUnboxed: Boolean(d.isUnboxed),
    isNewArrival: Boolean(d.isNewArrival),
    createdAtMs:
      d.createdAt && typeof (d.createdAt as { toMillis?: () => number }).toMillis === 'function'
        ? (d.createdAt as { toMillis: () => number }).toMillis()
        : undefined,
    onSpecial: Boolean(d.onSpecial),
    specialLabel: typeof d.specialLabel === 'string' ? d.specialLabel : '',
    specialDiscountType: d.specialDiscountType === 'fixed' ? 'fixed' : 'percentage',
    specialDiscountPercent:
      typeof d.specialDiscountPercent === 'number' ? d.specialDiscountPercent : 0,
    specialDiscountAmount:
      typeof d.specialDiscountAmount === 'number' ? d.specialDiscountAmount : 0,
  };
}

function sanitizeExclusiveItemsInput(raw: unknown): ExclusiveFiveMlItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ExclusiveFiveMlItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as { perfumeId?: unknown; customPrice?: unknown };
    const perfumeId = String(obj.perfumeId ?? '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 128);
    const price = Number(obj.customPrice);
    if (!perfumeId || seen.has(perfumeId) || !Number.isFinite(price) || price <= 0) {
      continue;
    }
    seen.add(perfumeId);
    out.push({
      perfumeId,
      customPrice: Math.min(50000, Math.max(1, Math.round(price * 100) / 100)),
    });
    if (out.length >= 6) break;
  }
  return out;
}

function readCachedWeeklySpecial(): WeeklyFiveMlSpecial | null {
  try {
    const raw = localStorage.getItem(WEEKLY_5ML_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WeeklyFiveMlSpecial>;
    if (typeof parsed.enabled !== 'boolean') return null;
    return {
      enabled: parsed.enabled,
      autoRotateWeekly: parsed.autoRotateWeekly !== false,
      weekKey: String(parsed.weekKey ?? ''),
      seedOffset: Math.max(0, Number(parsed.seedOffset ?? 0) || 0),
      under500Ids: Array.isArray(parsed.under500Ids)
        ? parsed.under500Ids.map(String).slice(0, 3)
        : [],
      under800Ids: Array.isArray(parsed.under800Ids)
        ? parsed.under800Ids.map(String).slice(0, 2)
        : [],
      womenUnder500Ids: Array.isArray(parsed.womenUnder500Ids)
        ? parsed.womenUnder500Ids.map(String).slice(0, 3)
        : [],
      womenUnder800Ids: Array.isArray(parsed.womenUnder800Ids)
        ? parsed.womenUnder800Ids.map(String).slice(0, 2)
        : [],
      menUnder500Ids: Array.isArray(parsed.menUnder500Ids)
        ? parsed.menUnder500Ids.map(String).slice(0, 3)
        : [],
      menUnder800Ids: Array.isArray(parsed.menUnder800Ids)
        ? parsed.menUnder800Ids.map(String).slice(0, 2)
        : [],
      fourPackPrice: Number(parsed.fourPackPrice ?? 100) || 100,
      twoPackPrice: Number(parsed.twoPackPrice ?? 50) || 50,
      exclusiveEnabled: Boolean(parsed.exclusiveEnabled),
      exclusiveTitle:
        typeof parsed.exclusiveTitle === 'string' && parsed.exclusiveTitle.trim()
          ? parsed.exclusiveTitle.slice(0, 100)
          : DEFAULT_WEEKLY_FIVE_ML_SPECIAL.exclusiveTitle,
      exclusiveBadge:
        typeof parsed.exclusiveBadge === 'string' && parsed.exclusiveBadge.trim()
          ? parsed.exclusiveBadge.slice(0, 40)
          : DEFAULT_WEEKLY_FIVE_ML_SPECIAL.exclusiveBadge,
      exclusiveSubtitle:
        typeof parsed.exclusiveSubtitle === 'string'
          ? parsed.exclusiveSubtitle.slice(0, 240)
          : DEFAULT_WEEKLY_FIVE_ML_SPECIAL.exclusiveSubtitle,
      exclusiveBundleEnabled: Boolean(parsed.exclusiveBundleEnabled),
      exclusiveBundlePrice: Math.max(
        0,
        Number(parsed.exclusiveBundlePrice ?? 0) || 0
      ),
      exclusiveItems: sanitizeExclusiveItemsInput(parsed.exclusiveItems),
    };
  } catch {
    return null;
  }
}

function readCachedCampaign(): SpecialCampaign | null {
  try {
    const raw = localStorage.getItem(CAMPAIGN_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SpecialCampaign>;
    if (typeof parsed.enabled !== 'boolean') return null;
    return {
      title: String(parsed.title ?? DEFAULT_CAMPAIGN.title),
      badgeText: String(parsed.badgeText ?? DEFAULT_CAMPAIGN.badgeText),
      subtitle: String(parsed.subtitle ?? DEFAULT_CAMPAIGN.subtitle),
      announcementText: String(parsed.announcementText ?? ''),
      promoCodeHint: String(parsed.promoCodeHint ?? ''),
      endsAt: String(parsed.endsAt ?? ''),
      enabled: parsed.enabled,
      heroMode:
        parsed.heroMode === 'new-arrivals' || parsed.heroMode === 'specials'
          ? parsed.heroMode
          : 'auto',
      newArrivalsTitle: String(
        parsed.newArrivalsTitle ?? DEFAULT_CAMPAIGN.newArrivalsTitle ?? 'New Arrivals'
      ),
      newArrivalsBadge: String(
        parsed.newArrivalsBadge ?? DEFAULT_CAMPAIGN.newArrivalsBadge ?? 'JUST LANDED'
      ),
      newArrivalsSubtitle: String(
        parsed.newArrivalsSubtitle ?? DEFAULT_CAMPAIGN.newArrivalsSubtitle ?? ''
      ),
    };
  } catch {
    return null;
  }
}

function readCachedPerfumes(): {
  items: FragranceProduct[];
  complete: boolean;
} {
  try {
    const raw = localStorage.getItem(PERFUMES_CACHE_KEY);
    if (!raw) return { items: [], complete: false };
    const parsed = JSON.parse(raw);
    const metaRaw = localStorage.getItem(PERFUMES_META_KEY);
    const meta = metaRaw ? (JSON.parse(metaRaw) as { complete?: boolean }) : {};
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Support both compact tuple format and legacy object format seamlessly
      const items =
        'i' in parsed[0]
          ? decodeCompactPerfumes(raw)
          : (parsed as FragranceProduct[]).map((item) => ({
              ...item,
              sizes: normalizeAndDedupeSizes(item.sizes),
            }));
      return { items, complete: Boolean(meta.complete ?? true) };
    }
  } catch {
    // Ignore cache parse errors
  }
  return { items: [], complete: false };
}

function writePerfumesCache(items: FragranceProduct[], complete: boolean): void {
  try {
    if (items.length > 0) {
      localStorage.setItem(PERFUMES_CACHE_KEY, encodeCompactPerfumes(items));
      localStorage.setItem(PERFUMES_META_KEY, JSON.stringify({ complete }));
      if (complete) {
        setCacheTimestamp('perfumes');
      }
    } else {
      localStorage.removeItem(PERFUMES_CACHE_KEY);
      localStorage.removeItem(PERFUMES_META_KEY);
    }
  } catch {
    // Ignore storage quota errors in restricted browsers
  }
}

function readCachedCombos(): ComboDeal[] {
  try {
    const raw = localStorage.getItem(COMBOS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ComboDeal[];
  } catch {
    // Ignore cache parse errors
  }
  return [];
}

function readCachedLayering(): LayeringIdea[] {
  try {
    const raw = localStorage.getItem(LAYERING_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as LayeringIdea[];
  } catch {
    // Ignore cache parse errors
  }
  return [];
}

function readCachedHampers(): GiftHamper[] {
  try {
    const raw = localStorage.getItem(HAMPERS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as GiftHamper[];
  } catch {
    // Ignore cache parse errors
  }
  return [];
}

function readSessionLookupCache<T>(storageKey: string, code: string): T | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, { ts: number; data: T }>;
    const entry = map[code];
    if (!entry) return null;
    if (Date.now() - entry.ts > LOOKUP_TTL_MS) return null;
    return entry.data;
  } catch {
    return null;
  }
}

function writeSessionLookupCache<T>(storageKey: string, code: string, data: T): void {
  try {
    const raw = sessionStorage.getItem(storageKey);
    const map = raw ? (JSON.parse(raw) as Record<string, { ts: number; data: T }>) : {};
    map[code] = { ts: Date.now(), data };
    sessionStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // Ignore session storage errors
  }
}

function clearSessionLookupCache(storageKey: string, code?: string): void {
  try {
    if (!code) {
      sessionStorage.removeItem(storageKey);
      return;
    }
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;
    const map = JSON.parse(raw) as Record<string, unknown>;
    delete map[code];
    sessionStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // Ignore session storage errors
  }
}

function mergePerfumeLists(
  existing: FragranceProduct[],
  incomingList: FragranceProduct[]
): FragranceProduct[] {
  const byId = new Map<string, FragranceProduct>();
  for (const item of existing) byId.set(item.id, item);
  for (const item of incomingList) byId.set(item.id, item);
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const initialPerfumeCache = useMemo(() => readCachedPerfumes(), []);
  const initialCachedCampaign = useMemo(() => readCachedCampaign(), []);
  const initialCachedCombos = useMemo(() => readCachedCombos(), []);
  const initialCachedLayering = useMemo(() => readCachedLayering(), []);
  const initialCachedWeeklySpecial = useMemo(() => readCachedWeeklySpecial(), []);
  const initialCachedHampers = useMemo(() => readCachedHampers(), []);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authRevision, setAuthRevision] = useState(0);
  const [adminConsoleActive, setAdminConsoleActive] = useState(false);
  const [partnerPortalActive, setPartnerPortalActive] = useState(false);

  const [partnerProfile, setPartnerProfile] = useState<ReferralPartnerProfile | null>(null);
  const [partnerProfileLoading, setPartnerProfileLoading] = useState(false);
  const [partnerReferral, setPartnerReferral] = useState<InfluencerReferral | null>(null);
  const [partnerSales, setPartnerSales] = useState<ReferralSale[]>([]);
  const [partnerSalesLoading, setPartnerSalesLoading] = useState(false);

  const [partnerApplications, setPartnerApplications] = useState<ReferralPartnerProfile[]>([]);
  const [partnerApplicationsLoading, setPartnerApplicationsLoading] = useState(false);

  const [livePerfumes, setLivePerfumes] = useState<FragranceProduct[]>(
    initialPerfumeCache.items
  );
  const [catalogueLoading, setCatalogueLoading] = useState(
    initialPerfumeCache.items.length === 0
  );
  const [catalogueComplete, setCatalogueComplete] = useState(
    initialPerfumeCache.items.length > 0 && initialPerfumeCache.complete
  );
  const [catalogueHasMore, setCatalogueHasMore] = useState(
    initialPerfumeCache.items.length > 0 && !initialPerfumeCache.complete
  );
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<SnapshotStatusInfo | null>(null);

  const [campaign, setCampaign] = useState<SpecialCampaign>(
    initialCachedCampaign ?? DEFAULT_CAMPAIGN
  );
  const [campaignLoading, setCampaignLoading] = useState(initialCachedCampaign === null);
  const [weeklySpecial, setWeeklySpecial] = useState<WeeklyFiveMlSpecial>(
    initialCachedWeeklySpecial ?? DEFAULT_WEEKLY_FIVE_ML_SPECIAL
  );
  const [weeklySpecialLoading, setWeeklySpecialLoading] = useState(
    initialCachedWeeklySpecial === null
  );

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [referrals, setReferrals] = useState<InfluencerReferral[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralAttributions, setReferralAttributions] = useState<ReferralAttribution[]>([]);
  const [referralAttributionsLoading, setReferralAttributionsLoading] = useState(false);
  const [referralSales, setReferralSales] = useState<ReferralSale[]>([]);
  const [referralSalesLoading, setReferralSalesLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);

  const [liveCombos, setLiveCombos] = useState<ComboDeal[]>(initialCachedCombos);
  const [combosLoading, setCombosLoading] = useState(false);
  const [liveLayeringIdeas, setLiveLayeringIdeas] = useState<LayeringIdea[]>(
    initialCachedLayering
  );
  const [layeringLoading, setLayeringLoading] = useState(false);
  const [liveHampers, setLiveHampers] = useState<GiftHamper[]>(initialCachedHampers);
  const [hampersLoading, setHampersLoading] = useState(false);

  const isOwner = useMemo(() => {
    void authRevision;
    return Boolean(user && user.emailVerified && isAuthorizedAdminEmail(user.email));
  }, [user, authRevision]);

  // Refs for deduplicating in-flight network requests, pagination cursor & referral double-submits
  const lastPerfumeCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const catalogueSyncPromiseRef = useRef<Promise<void> | null>(null);
  const loadMorePromiseRef = useRef<Promise<void> | null>(null);
  const loadAllPromiseRef = useRef<Promise<void> | null>(null);
  const promoFetchPromiseRef = useRef<Promise<void> | null>(null);
  const secondaryInFlightRef = useRef<Record<string, Promise<void> | undefined>>({});
  const promoLookupInFlightRef = useRef<Record<string, Promise<unknown> | undefined>>({});
  const recentReferralSalesRef = useRef<Map<string, number>>(new Map());
  const publicReferralsSyncedRef = useRef(false);
  const livePerfumesRef = useRef<FragranceProduct[]>(livePerfumes);
  livePerfumesRef.current = livePerfumes;

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      setAuthRevision((r) => r + 1);
    });
    return unsubscribe;
  }, []);

  // Helper: fetch first page (60 items) or next cursor pages (zero composite indexes!)
  const fetchCataloguePage = useCallback(
    async (cursor: QueryDocumentSnapshot<DocumentData> | null, pageSize: number) => {
      const started = performance.now();
      const q = cursor
        ? query(
            collection(db, 'perfumes'),
            where('availability', 'in', [...PUBLIC_AVAILABILITIES]),
            startAfter(cursor),
            limit(pageSize)
          )
        : query(
            collection(db, 'perfumes'),
            where('availability', 'in', [...PUBLIC_AVAILABILITIES]),
            limit(pageSize)
          );
      const snapshot = await withRetry(() => getDocs(q), { maxAttempts: 3 });
      recordFirestoreRead(
        cursor ? 'perfumes:page-next' : 'perfumes:page-init',
        snapshot.docs.length,
        performance.now() - started
      );
      const items = snapshot.docs.map((docSnap) => mapPerfumeDoc(docSnap.id, docSnap.data()));
      const nextCursor =
        snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
      const hasMore = snapshot.docs.length === pageSize;
      return { items, nextCursor, hasMore };
    },
    []
  );

  // 2. Cost-Engineered Public Catalogue Loader (1-Read Snapshot -> TTL Cache -> Paginated Fallback)
  const syncPublicCatalogue = useCallback(
    async (force = false) => {
      if (catalogueSyncPromiseRef.current && !force) {
        return catalogueSyncPromiseRef.current;
      }
      if (
        !force &&
        livePerfumesRef.current.length > 0 &&
        catalogueComplete &&
        isCacheFresh('perfumes', CATALOGUE_TTL_MS)
      ) {
        recordFirestoreRead('perfumes:cache-hit', 0, 0, true);
        setCatalogueLoading(false);
        return;
      }

      const task = (async () => {
        if (livePerfumesRef.current.length === 0) {
          setCatalogueLoading(true);
        }
        try {
          const started = performance.now();
          const snapDoc = await withRetry(
            () => getDoc(doc(db, 'catalogueSnapshots', SNAPSHOT_DOC_ID)),
            { maxAttempts: 2 }
          );
          if (snapDoc.exists()) {
            const data = snapDoc.data();
            const rawJson = typeof data.itemsJson === 'string' ? data.itemsJson : '';
            if (rawJson.length >= 2) {
              const decoded = decodeCompactPerfumes(rawJson);
              decoded.sort((a, b) => a.name.localeCompare(b.name));
              const updatedAtTs = data.updatedAt as { toMillis?: () => number } | undefined;
              const updatedAtMs =
                updatedAtTs && typeof updatedAtTs.toMillis === 'function'
                  ? updatedAtTs.toMillis()
                  : Date.now();
              setSnapshotStatus({
                count: decoded.length,
                updatedAtMs,
                bytes: rawJson.length,
              });
              recordFirestoreRead(
                'catalogueSnapshots/public',
                1,
                performance.now() - started
              );
              setLivePerfumes(decoded);
              setCatalogueComplete(true);
              setCatalogueHasMore(false);
              setCatalogueError(null);
              setCatalogueLoading(false);
              writePerfumesCache(decoded, true);
              return;
            }
          }

          // Snapshot doc doesn't exist yet -> paginated first batch (0 composite indexes)
          const page = await fetchCataloguePage(null, INITIAL_PAGE_SIZE);
          lastPerfumeCursorRef.current = page.nextCursor;
          const sorted = [...page.items].sort((a, b) => a.name.localeCompare(b.name));
          if (sorted.length > 0) {
            setLivePerfumes(sorted);
            writePerfumesCache(sorted, !page.hasMore);
          }
          setCatalogueComplete(!page.hasMore);
          setCatalogueHasMore(page.hasMore);
          setCatalogueError(null);
        } catch (error) {
          setCatalogueError(
            error instanceof Error ? error.message : 'Unable to sync live catalogue.'
          );
        } finally {
          setCatalogueLoading(false);
          catalogueSyncPromiseRef.current = null;
        }
      })();

      catalogueSyncPromiseRef.current = task;
      return task;
    },
    [catalogueComplete, fetchCataloguePage]
  );

  const wasAdminConsoleActiveRef = useRef(false);

  // Trigger initial storefront catalogue load when NOT in real-time admin mode,
  // and force-refresh whenever leaving Admin Console so storefront reflects latest edits immediately
  useEffect(() => {
    if (isOwner && adminConsoleActive) {
      wasAdminConsoleActiveRef.current = true;
      return;
    }
    const returningFromAdmin = wasAdminConsoleActiveRef.current;
    wasAdminConsoleActiveRef.current = false;
    void syncPublicCatalogue(returningFromAdmin);
  }, [isOwner, adminConsoleActive, syncPublicCatalogue]);

  const loadMorePerfumes = useCallback(async () => {
    if (catalogueComplete || !catalogueHasMore) return;
    if (loadMorePromiseRef.current) return loadMorePromiseRef.current;

    const task = (async () => {
      try {
        const page = await fetchCataloguePage(
          lastPerfumeCursorRef.current,
          INCREMENTAL_PAGE_SIZE
        );
        lastPerfumeCursorRef.current = page.nextCursor;
        const merged = mergePerfumeLists(livePerfumesRef.current, page.items);
        setLivePerfumes(merged);
        setCatalogueHasMore(page.hasMore);
        setCatalogueComplete(!page.hasMore);
        writePerfumesCache(merged, !page.hasMore);
      } catch (error) {
        setCatalogueError(
          error instanceof Error ? error.message : 'Unable to load additional fragrances.'
        );
      } finally {
        loadMorePromiseRef.current = null;
      }
    })();

    loadMorePromiseRef.current = task;
    return task;
  }, [catalogueComplete, catalogueHasMore, fetchCataloguePage]);

  const ensureAllPerfumesLoaded = useCallback(async () => {
    if (catalogueComplete || !catalogueHasMore) return;
    if (loadAllPromiseRef.current) return loadAllPromiseRef.current;

    const task = (async () => {
      try {
        let cursor = lastPerfumeCursorRef.current;
        let hasMore: boolean = catalogueHasMore;
        let accumulated = [...livePerfumesRef.current];
        let safetyPages = 0;

        while (hasMore && safetyPages < 12) {
          safetyPages += 1;
          const page = await fetchCataloguePage(cursor, INCREMENTAL_PAGE_SIZE);
          cursor = page.nextCursor;
          hasMore = page.hasMore;
          accumulated = mergePerfumeLists(accumulated, page.items);
          setLivePerfumes(accumulated);
          setCatalogueHasMore(hasMore);
          if (!hasMore) {
            setCatalogueComplete(true);
            writePerfumesCache(accumulated, true);
          }
        }
        lastPerfumeCursorRef.current = cursor;
      } catch (error) {
        setCatalogueError(
          error instanceof Error ? error.message : 'Unable to finish loading catalogue.'
        );
      } finally {
        loadAllPromiseRef.current = null;
      }
    })();

    loadAllPromiseRef.current = task;
    return task;
  }, [catalogueComplete, catalogueHasMore, fetchCataloguePage]);

  const retryCatalogueSync = useCallback(async () => {
    await syncPublicCatalogue(true);
  }, [syncPublicCatalogue]);

  // 2b. Admin-Only Live Perfumes Listener (only active inside Admin Dashboard!)
  useEffect(() => {
    if (!authReady || !isOwner || !adminConsoleActive) return;

    setCatalogueLoading(livePerfumesRef.current.length === 0);
    const q = query(collection(db, 'perfumes'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) =>
          mapPerfumeDoc(docSnap.id, docSnap.data())
        );
        items.sort((a, b) => a.name.localeCompare(b.name));
        recordFirestoreRead('admin:perfumes-snapshot', items.length, 0);
        setLivePerfumes(items);
        setCatalogueComplete(true);
        setCatalogueHasMore(false);
        setCatalogueError(null);
        setCatalogueLoading(false);
        writePerfumesCache(items, true);
      },
      (error) => {
        setCatalogueLoading(false);
        setCatalogueError(
          error instanceof Error ? error.message : 'Unable to sync admin catalogue.'
        );
        try {
          handleFirestoreError(error, OperationType.LIST, 'perfumes');
        } catch {
          // Diagnostic error already logged
        }
      }
    );

    return unsubscribe;
  }, [authReady, isOwner, adminConsoleActive]);

  // Helper: Publish Compact 1-Read Public Snapshot Document
  const publishCatalogueSnapshot = useCallback(
    async (
      overrideList?: FragranceProduct[]
    ): Promise<{ ok: boolean; count: number; bytes: number }> => {
      const uid = auth.currentUser?.uid;
      if (!uid || !isOwner) {
        return { ok: false, count: 0, bytes: 0 };
      }

      const sourceList = overrideList ?? livePerfumesRef.current;
      if (sourceList.length === 0) {
        return { ok: false, count: 0, bytes: 0 };
      }

      const sorted = [...sourceList].sort((a, b) => a.name.localeCompare(b.name));
      const itemsJson = encodeCompactPerfumes(sorted);
      const byteLength = new TextEncoder().encode(itemsJson).length;
      if (byteLength > SNAPSHOT_MAX_BYTES) {
        return { ok: false, count: sorted.length, bytes: byteLength };
      }

      try {
        await withRetry(
          () =>
            setDoc(doc(db, 'catalogueSnapshots', SNAPSHOT_DOC_ID), {
              version: SNAPSHOT_VERSION,
              totalCount: sorted.length,
              itemsJson,
              ownerUid: uid,
              updatedAt: serverTimestamp(),
            }),
          { maxAttempts: 2 }
        );
        setSnapshotStatus({
          count: sorted.length,
          updatedAtMs: Date.now(),
          bytes: byteLength,
        });
        writePerfumesCache(sorted, true);
        return { ok: true, count: sorted.length, bytes: byteLength };
      } catch {
        return { ok: false, count: sorted.length, bytes: byteLength };
      }
    },
    [isOwner]
  );

  // Auto-seed or refresh 1-read public snapshot when Admin opens Admin Console and count differs
  useEffect(() => {
    if (!authReady || !isOwner || !adminConsoleActive) return;
    if (!catalogueComplete || livePerfumes.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, 'catalogueSnapshots', SNAPSHOT_DOC_ID));
        if (cancelled) return;
        const sortedLive = [...livePerfumes].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        const expectedJson = encodeCompactPerfumes(sortedLive);
        const remoteCount = snap.exists() ? Number(snap.data().totalCount ?? -1) : -1;
        const remoteJson = snap.exists() ? String(snap.data().itemsJson ?? '') : '';
        if (
          !snap.exists() ||
          remoteCount !== sortedLive.length ||
          remoteJson !== expectedJson
        ) {
          await publishCatalogueSnapshot(sortedLive);
        } else {
          const ts = snap.data().updatedAt as { toMillis?: () => number } | undefined;
          setSnapshotStatus({
            count: remoteCount,
            updatedAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : null,
            bytes: remoteJson.length,
          });
        }
      } catch {
        // Non-blocking auto-sync
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, isOwner, adminConsoleActive, catalogueComplete, livePerfumes, publishCatalogueSnapshot]);

  // 3. Cached One-Shot Promos (Campaign & Weekly 5ml Special — Replaces 2 Continuous Listeners!)
  useEffect(() => {
    const campaignFresh = isCacheFresh('campaign', PROMO_TTL_MS) && initialCachedCampaign !== null;
    const weeklyFresh = isCacheFresh('weeklySpecial', PROMO_TTL_MS) && initialCachedWeeklySpecial !== null;

    if (campaignFresh && weeklyFresh && !adminConsoleActive) {
      recordFirestoreRead('promos:cache-hit', 0, 0, true);
      setCampaignLoading(false);
      setWeeklySpecialLoading(false);
      return;
    }

    if (promoFetchPromiseRef.current) return;

    const task = (async () => {
      const started = performance.now();
      try {
        const [campSnap, weeklySnap] = await Promise.all([
          campaignFresh && !adminConsoleActive
            ? Promise.resolve(null)
            : withRetry(() => getDoc(doc(db, 'campaigns', 'active-special')), { maxAttempts: 2 }),
          weeklyFresh && !adminConsoleActive
            ? Promise.resolve(null)
            : withRetry(() => getDoc(doc(db, 'weeklySpecials', 'active-5ml')), { maxAttempts: 2 }),
        ]);

        let reads = 0;
        if (campSnap) {
          reads += 1;
          const nextCampaign: SpecialCampaign = campSnap.exists()
            ? (() => {
                const d = campSnap.data();
                return {
                  title: String(d.title ?? DEFAULT_CAMPAIGN.title),
                  badgeText: String(d.badgeText ?? DEFAULT_CAMPAIGN.badgeText),
                  subtitle: String(d.subtitle ?? DEFAULT_CAMPAIGN.subtitle),
                  announcementText: String(d.announcementText ?? ''),
                  promoCodeHint: String(d.promoCodeHint ?? ''),
                  endsAt: String(d.endsAt ?? ''),
                  enabled: Boolean(d.enabled),
                  heroMode:
                    d.heroMode === 'new-arrivals' || d.heroMode === 'specials'
                      ? d.heroMode
                      : 'auto',
                  newArrivalsTitle: String(
                    d.newArrivalsTitle ?? DEFAULT_CAMPAIGN.newArrivalsTitle ?? 'New Arrivals'
                  ),
                  newArrivalsBadge: String(
                    d.newArrivalsBadge ?? DEFAULT_CAMPAIGN.newArrivalsBadge ?? 'JUST LANDED'
                  ),
                  newArrivalsSubtitle: String(
                    d.newArrivalsSubtitle ?? DEFAULT_CAMPAIGN.newArrivalsSubtitle ?? ''
                  ),
                };
              })()
            : DEFAULT_CAMPAIGN;
          setCampaign(nextCampaign);
          try {
            localStorage.setItem(CAMPAIGN_CACHE_KEY, JSON.stringify(nextCampaign));
            setCacheTimestamp('campaign');
          } catch {
            // Ignore storage errors
          }
        }

        if (weeklySnap) {
          reads += 1;
          const nextWeekly: WeeklyFiveMlSpecial = weeklySnap.exists()
            ? (() => {
                const d = weeklySnap.data();
                const fourPrice = Number(d.fourPackPrice ?? 100);
                const twoPrice = Number(d.twoPackPrice ?? 50);
                return {
                  enabled: Boolean(d.enabled),
                  autoRotateWeekly: d.autoRotateWeekly !== false,
                  weekKey: String(d.weekKey ?? ''),
                  seedOffset: Math.max(0, Number(d.seedOffset ?? 0) || 0),
                  under500Ids: Array.isArray(d.under500Ids)
                    ? d.under500Ids.map(String).slice(0, 3)
                    : [],
                  under800Ids: Array.isArray(d.under800Ids)
                    ? d.under800Ids.map(String).slice(0, 2)
                    : [],
                  womenUnder500Ids: Array.isArray(d.womenUnder500Ids)
                    ? d.womenUnder500Ids.map(String).slice(0, 3)
                    : [],
                  womenUnder800Ids: Array.isArray(d.womenUnder800Ids)
                    ? d.womenUnder800Ids.map(String).slice(0, 2)
                    : [],
                  menUnder500Ids: Array.isArray(d.menUnder500Ids)
                    ? d.menUnder500Ids.map(String).slice(0, 3)
                    : [],
                  menUnder800Ids: Array.isArray(d.menUnder800Ids)
                    ? d.menUnder800Ids.map(String).slice(0, 2)
                    : [],
                  fourPackPrice:
                    Number.isFinite(fourPrice) && fourPrice > 0 ? fourPrice : 100,
                  twoPackPrice:
                    Number.isFinite(twoPrice) && twoPrice > 0 ? twoPrice : 50,
                  exclusiveEnabled: Boolean(d.exclusiveEnabled),
                  exclusiveTitle:
                    typeof d.exclusiveTitle === 'string' && d.exclusiveTitle.trim()
                      ? d.exclusiveTitle.slice(0, 100)
                      : DEFAULT_WEEKLY_FIVE_ML_SPECIAL.exclusiveTitle,
                  exclusiveBadge:
                    typeof d.exclusiveBadge === 'string' && d.exclusiveBadge.trim()
                      ? d.exclusiveBadge.slice(0, 40)
                      : DEFAULT_WEEKLY_FIVE_ML_SPECIAL.exclusiveBadge,
                  exclusiveSubtitle:
                    typeof d.exclusiveSubtitle === 'string'
                      ? d.exclusiveSubtitle.slice(0, 240)
                      : DEFAULT_WEEKLY_FIVE_ML_SPECIAL.exclusiveSubtitle,
                  exclusiveBundleEnabled: Boolean(d.exclusiveBundleEnabled),
                  exclusiveBundlePrice: Math.max(
                    0,
                    Number(d.exclusiveBundlePrice ?? 0) || 0
                  ),
                  exclusiveItems: sanitizeExclusiveItemsInput(d.exclusiveItems),
                };
              })()
            : DEFAULT_WEEKLY_FIVE_ML_SPECIAL;
          setWeeklySpecial(nextWeekly);
          try {
            localStorage.setItem(WEEKLY_5ML_CACHE_KEY, JSON.stringify(nextWeekly));
            setCacheTimestamp('weeklySpecial');
          } catch {
            // Ignore storage errors
          }
        }

        if (reads > 0) {
          recordFirestoreRead('promos:getDoc', reads, performance.now() - started);
        }
      } catch {
        // Fallback gracefully to cached/default campaign values
      } finally {
        setCampaignLoading(false);
        setWeeklySpecialLoading(false);
        promoFetchPromiseRef.current = null;
      }
    })();

    promoFetchPromiseRef.current = task;
  }, [adminConsoleActive, initialCachedCampaign, initialCachedWeeklySpecial]);

  // 4. Owner-Only Admin Console Listeners (strictly gated on authReady + isOwner + adminConsoleActive!)
  useEffect(() => {
    if (!authReady || !isOwner || !adminConsoleActive) {
      setCoupons([]);
      setCouponsLoading(false);
      return;
    }

    setCouponsLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'coupons')),
      (snapshot) => {
        const items: Coupon[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            code: String(d.code ?? docSnap.id),
            description: String(d.description ?? ''),
            discountType: d.discountType === 'fixed' ? 'fixed' : 'percentage',
            discountValue: Number(d.discountValue ?? 0),
            minOrderAmount: Number(d.minOrderAmount ?? 0),
            appliesTo:
              d.appliesTo === 'specials' || d.appliesTo === 'full-bottles'
                ? d.appliesTo
                : 'all',
            active: Boolean(d.active),
          };
        });
        items.sort((a, b) => a.code.localeCompare(b.code));
        setCoupons(items);
        setCouponsLoading(false);
      },
      (error) => {
        setCouponsLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'coupons');
        } catch {
          // Diagnostic error logged
        }
      }
    );
    return unsub;
  }, [authReady, isOwner, adminConsoleActive]);

  useEffect(() => {
    if (!authReady || !isOwner || !adminConsoleActive) {
      setReferrals([]);
      setReferralsLoading(false);
      return;
    }

    setReferralsLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'referrals')),
      (snapshot) => {
        const items: InfluencerReferral[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            code: String(d.code ?? docSnap.id),
            influencerName: String(d.influencerName ?? ''),
            socialHandle: String(d.socialHandle ?? ''),
            commissionType: d.commissionType === 'fixed' ? 'fixed' : 'percentage',
            commissionValue: Number(d.commissionValue ?? 0),
            followerDiscountType:
              d.followerDiscountType === 'percentage' || d.followerDiscountType === 'fixed'
                ? d.followerDiscountType
                : 'none',
            followerDiscountValue: Number(d.followerDiscountValue ?? 0),
            payoutNote: String(d.payoutNote ?? ''),
            active: Boolean(d.active),
            partnerUid: typeof d.partnerUid === 'string' ? d.partnerUid : '',
          };
        });
        items.sort((a, b) => a.code.localeCompare(b.code));
        setReferrals(items);
        setReferralsLoading(false);

        // One-time per session sync: mirror legacy referrals into publicReferrals safely
        const currentUid = auth.currentUser?.uid;
        if (!publicReferralsSyncedRef.current && currentUid && items.length > 0) {
          publicReferralsSyncedRef.current = true;
          void (async () => {
            try {
              const pubSnap = await getDocs(collection(db, 'publicReferrals'));
              const existingMap = new Map(pubSnap.docs.map((p) => [p.id, p.data()]));
              const batch = writeBatch(db);
              let dirty = 0;
              for (const r of items) {
                const pub = existingMap.get(r.code);
                const needsSync =
                  !pub ||
                  String(pub.influencerName ?? '') !== r.influencerName ||
                  String(pub.socialHandle ?? '') !== r.socialHandle ||
                  String(pub.followerDiscountType ?? 'none') !== r.followerDiscountType ||
                  Number(pub.followerDiscountValue ?? 0) !== r.followerDiscountValue ||
                  Boolean(pub.active) !== r.active;
                if (needsSync) {
                  batch.set(doc(db, 'publicReferrals', r.code), {
                    code: r.code,
                    influencerName: r.influencerName,
                    socialHandle: r.socialHandle,
                    followerDiscountType: r.followerDiscountType,
                    followerDiscountValue: r.followerDiscountValue,
                    active: r.active,
                    ownerUid: currentUid,
                    updatedAt: serverTimestamp(),
                  });
                  dirty += 1;
                }
              }
              if (dirty > 0) {
                await batch.commit();
              }
            } catch {
              // Non-blocking sync retry on next admin open if offline
              publicReferralsSyncedRef.current = false;
            }
          })();
        }
      },
      (error) => {
        setReferralsLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'referrals');
        } catch {
          // Diagnostic error logged
        }
      }
    );
    return unsub;
  }, [authReady, isOwner, adminConsoleActive]);

  useEffect(() => {
    if (!authReady || !isOwner || !adminConsoleActive) {
      setReferralAttributions([]);
      setReferralAttributionsLoading(false);
      return;
    }

    setReferralAttributionsLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'referralAttributions')),
      (snapshot) => {
        const items: ReferralAttribution[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const rawCreated = d.createdAt as { toMillis?: () => number } | undefined;
          const createdAtMs =
            rawCreated && typeof rawCreated.toMillis === 'function'
              ? rawCreated.toMillis()
              : Date.now();
          const status: ReferralAttributionStatus =
            d.status === 'converted' || d.status === 'dismissed' ? d.status : 'pending';
          return {
            id: docSnap.id,
            referralCode: String(d.referralCode ?? ''),
            influencerName: String(d.influencerName ?? ''),
            orderSummary: String(d.orderSummary ?? ''),
            reportedSubtotal: Number(d.reportedSubtotal ?? 0),
            reportedDiscount: Number(d.reportedDiscount ?? 0),
            customerRef: String(d.customerRef ?? ''),
            status,
            convertedSaleId: String(d.convertedSaleId ?? ''),
            createdAtMs,
          };
        });
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setReferralAttributions(items);
        setReferralAttributionsLoading(false);
      },
      (error) => {
        setReferralAttributionsLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'referralAttributions');
        } catch {
          // Diagnostic error logged
        }
      }
    );
    return unsub;
  }, [authReady, isOwner, adminConsoleActive]);

  useEffect(() => {
    if (!authReady || !isOwner || !adminConsoleActive) {
      setReferralSales([]);
      setReferralSalesLoading(false);
      return;
    }

    setReferralSalesLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'referralSales')),
      (snapshot) => {
        const items: ReferralSale[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const rawCreated = d.createdAt as { toMillis?: () => number } | undefined;
          const createdAtMs =
            rawCreated && typeof rawCreated.toMillis === 'function'
              ? rawCreated.toMillis()
              : Date.now();
          const status: ReferralSaleStatus =
            d.commissionStatus === 'confirmed' ||
            d.commissionStatus === 'paid' ||
            d.commissionStatus === 'cancelled'
              ? d.commissionStatus
              : 'pending';
          return {
            id: docSnap.id,
            referralCode: String(d.referralCode ?? ''),
            influencerName: String(d.influencerName ?? ''),
            orderSummary: String(d.orderSummary ?? ''),
            orderSubtotal: Number(d.orderSubtotal ?? 0),
            discountAmount: Number(d.discountAmount ?? 0),
            netOrderAmount: Number(d.netOrderAmount ?? 0),
            commissionAmount: Number(d.commissionAmount ?? 0),
            commissionStatus: status,
            source: d.source === 'manual' ? 'manual' : 'checkout',
            customerRef: String(d.customerRef ?? ''),
            partnerUid: typeof d.partnerUid === 'string' ? d.partnerUid : '',
            createdAtMs,
          };
        });
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setReferralSales(items);
        setReferralSalesLoading(false);
      },
      (error) => {
        setReferralSalesLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'referralSales');
        } catch {
          // Diagnostic error logged
        }
      }
    );
    return unsub;
  }, [authReady, isOwner, adminConsoleActive]);

  useEffect(() => {
    if (!authReady || !isOwner || !adminConsoleActive) {
      setPartnerApplications([]);
      setPartnerApplicationsLoading(false);
      return;
    }

    setPartnerApplicationsLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'referralPartners')),
      (snapshot) => {
        const items: ReferralPartnerProfile[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const rawCreated = d.createdAt as { toMillis?: () => number } | undefined;
          const rawUpdated = d.updatedAt as { toMillis?: () => number } | undefined;
          const status: ReferralPartnerStatus =
            d.status === 'active' || d.status === 'paused' ? d.status : 'pending';
          const payoutMethod: ReferralPayoutMethod =
            d.payoutMethod === 'bank' || d.payoutMethod === 'store-credit'
              ? d.payoutMethod
              : 'momo';
          return {
            uid: String(d.uid ?? docSnap.id),
            email: String(d.email ?? ''),
            displayName: String(d.displayName ?? ''),
            socialHandle: String(d.socialHandle ?? ''),
            requestedCode: String(d.requestedCode ?? ''),
            assignedCode: String(d.assignedCode ?? ''),
            payoutMethod,
            payoutAccount: String(d.payoutAccount ?? ''),
            status,
            createdAtMs:
              rawCreated && typeof rawCreated.toMillis === 'function'
                ? rawCreated.toMillis()
                : Date.now(),
            updatedAtMs:
              rawUpdated && typeof rawUpdated.toMillis === 'function'
                ? rawUpdated.toMillis()
                : Date.now(),
          };
        });
        items.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (a.status !== 'pending' && b.status === 'pending') return 1;
          return b.createdAtMs - a.createdAtMs;
        });
        setPartnerApplications(items);
        setPartnerApplicationsLoading(false);
      },
      (error) => {
        setPartnerApplicationsLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'referralPartners');
        } catch {
          // Diagnostic error logged
        }
      }
    );
    return unsub;
  }, [authReady, isOwner, adminConsoleActive]);

  // 4b. Scoped Creator Referral Partner Listeners (only active when Partner Dashboard is open & email verified!)
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified || !partnerPortalActive) {
      setPartnerProfile(null);
      setPartnerProfileLoading(false);
      return;
    }

    setPartnerProfileLoading(true);
    const profilePath = `referralPartners/${user.uid}`;
    const unsub = onSnapshot(
      doc(db, 'referralPartners', user.uid),
      (docSnap) => {
        if (!docSnap.exists()) {
          setPartnerProfile(null);
          setPartnerProfileLoading(false);
          return;
        }
        const d = docSnap.data();
        const rawCreated = d.createdAt as { toMillis?: () => number } | undefined;
        const rawUpdated = d.updatedAt as { toMillis?: () => number } | undefined;
        const status: ReferralPartnerStatus =
          d.status === 'active' || d.status === 'paused' ? d.status : 'pending';
        const payoutMethod: ReferralPayoutMethod =
          d.payoutMethod === 'bank' || d.payoutMethod === 'store-credit'
            ? d.payoutMethod
            : 'momo';
        setPartnerProfile({
          uid: String(d.uid ?? docSnap.id),
          email: String(d.email ?? ''),
          displayName: String(d.displayName ?? ''),
          socialHandle: String(d.socialHandle ?? ''),
          requestedCode: String(d.requestedCode ?? ''),
          assignedCode: String(d.assignedCode ?? ''),
          payoutMethod,
          payoutAccount: String(d.payoutAccount ?? ''),
          status,
          createdAtMs:
            rawCreated && typeof rawCreated.toMillis === 'function'
              ? rawCreated.toMillis()
              : Date.now(),
          updatedAtMs:
            rawUpdated && typeof rawUpdated.toMillis === 'function'
              ? rawUpdated.toMillis()
              : Date.now(),
        });
        setPartnerProfileLoading(false);
      },
      (error) => {
        setPartnerProfileLoading(false);
        try {
          handleFirestoreError(error, OperationType.GET, profilePath);
        } catch {
          // Diagnostic error logged
        }
      }
    );
    return unsub;
  }, [authReady, user, partnerPortalActive]);

  useEffect(() => {
    const code = partnerProfile?.assignedCode?.trim() ?? '';
    if (!authReady || !user || !user.emailVerified || !partnerPortalActive || !code) {
      setPartnerReferral(null);
      setPartnerSales([]);
      setPartnerSalesLoading(false);
      return;
    }

    const unsubRef = onSnapshot(
      doc(db, 'referrals', code),
      (docSnap) => {
        if (!docSnap.exists()) {
          setPartnerReferral(null);
          return;
        }
        const d = docSnap.data();
        setPartnerReferral({
          id: docSnap.id,
          code: String(d.code ?? docSnap.id),
          influencerName: String(d.influencerName ?? ''),
          socialHandle: String(d.socialHandle ?? ''),
          commissionType: d.commissionType === 'fixed' ? 'fixed' : 'percentage',
          commissionValue: Number(d.commissionValue ?? 0),
          followerDiscountType:
            d.followerDiscountType === 'percentage' || d.followerDiscountType === 'fixed'
              ? d.followerDiscountType
              : 'none',
          followerDiscountValue: Number(d.followerDiscountValue ?? 0),
          payoutNote: String(d.payoutNote ?? ''),
          active: Boolean(d.active),
          partnerUid: typeof d.partnerUid === 'string' ? d.partnerUid : '',
        });
      },
      () => {
        setPartnerReferral(null);
      }
    );

    setPartnerSalesLoading(true);
    const salesQuery = query(
      collection(db, 'referralSales'),
      where('partnerUid', '==', user.uid)
    );
    const unsubSales = onSnapshot(
      salesQuery,
      (snapshot) => {
        const items: ReferralSale[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const rawCreated = d.createdAt as { toMillis?: () => number } | undefined;
          const createdAtMs =
            rawCreated && typeof rawCreated.toMillis === 'function'
              ? rawCreated.toMillis()
              : Date.now();
          const status: ReferralSaleStatus =
            d.commissionStatus === 'confirmed' ||
            d.commissionStatus === 'paid' ||
            d.commissionStatus === 'cancelled'
              ? d.commissionStatus
              : 'pending';
          return {
            id: docSnap.id,
            referralCode: String(d.referralCode ?? ''),
            influencerName: String(d.influencerName ?? ''),
            orderSummary: String(d.orderSummary ?? ''),
            orderSubtotal: Number(d.orderSubtotal ?? 0),
            discountAmount: Number(d.discountAmount ?? 0),
            netOrderAmount: Number(d.netOrderAmount ?? 0),
            commissionAmount: Number(d.commissionAmount ?? 0),
            commissionStatus: status,
            source: d.source === 'manual' ? 'manual' : 'checkout',
            customerRef: String(d.customerRef ?? ''),
            partnerUid: typeof d.partnerUid === 'string' ? d.partnerUid : '',
            createdAtMs,
          };
        });
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setPartnerSales(items);
        setPartnerSalesLoading(false);
      },
      (error) => {
        setPartnerSalesLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'referralSales');
        } catch {
          // Diagnostic error logged
        }
      }
    );

    return () => {
      unsubRef();
      unsubSales();
    };
  }, [authReady, user, partnerPortalActive, partnerProfile?.assignedCode]);

  useEffect(() => {
    if (!authReady || !isOwner || !adminConsoleActive) {
      setAuditLogs([]);
      setAuditLogsLoading(false);
      return;
    }

    setAuditLogsLoading(true);
    const unsub = onSnapshot(
      query(collection(db, 'auditLogs')),
      (snapshot) => {
        const items: AuditLogEntry[] = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const rawCreated = d.createdAt as { toMillis?: () => number } | undefined;
          const createdAtMs =
            rawCreated && typeof rawCreated.toMillis === 'function'
              ? rawCreated.toMillis()
              : Date.now();
          const action: AuditAction =
            d.action === 'create' ||
            d.action === 'update' ||
            d.action === 'delete' ||
            d.action === 'import'
              ? d.action
              : 'update';
          const section: AuditSection =
            d.section === 'perfume' ||
            d.section === 'specials' ||
            d.section === 'weekly-special' ||
            d.section === 'coupon' ||
            d.section === 'combo' ||
            d.section === 'layering' ||
            d.section === 'hamper' ||
            d.section === 'referral' ||
            d.section === 'referral-sale' ||
            d.section === 'referral-attribution' ||
            d.section === 'referral-partner'
              ? d.section
              : 'perfume';

          return {
            id: docSnap.id,
            actorEmail: String(d.actorEmail ?? ''),
            actorUsername: String(d.actorUsername ?? 'admin'),
            action,
            section,
            targetId: String(d.targetId ?? docSnap.id),
            targetLabel: String(d.targetLabel ?? ''),
            summary: String(d.summary ?? ''),
            changes: Array.isArray(d.changes) ? d.changes.map(String).filter(Boolean) : [],
            ownerUid: String(d.ownerUid ?? ''),
            createdAtMs,
          };
        });
        items.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setAuditLogs(items);
        setAuditLogsLoading(false);
      },
      (error) => {
        setAuditLogsLoading(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'auditLogs');
        } catch {
          // Diagnostic error logged
        }
      }
    );
    return unsub;
  }, [authReady, isOwner, adminConsoleActive]);

  // 5. Lazy On-Demand Loader for Secondary Collections (Combos, Layering Ideas, Hampers)
  const ensureSecondaryLoaded = useCallback(
    async (section: 'combos' | 'layering' | 'hampers') => {
      const existingPromise = secondaryInFlightRef.current[section];
      if (existingPromise) return existingPromise;

      if (!adminConsoleActive && isCacheFresh(section, SECONDARY_TTL_MS)) {
        const hasCached =
          (section === 'combos' && liveCombos.length > 0) ||
          (section === 'layering' && liveLayeringIdeas.length > 0) ||
          (section === 'hampers' && liveHampers.length > 0);
        if (hasCached) {
          recordFirestoreRead(`${section}:cache-hit`, 0, 0, true);
          return;
        }
      }

      const task = (async () => {
        const started = performance.now();
        try {
          if (section === 'combos') {
            setCombosLoading(true);
            const q = isOwner
              ? query(collection(db, 'combos'))
              : query(collection(db, 'combos'), where('active', '==', true));
            const snap = await withRetry(() => getDocs(q), { maxAttempts: 2 });
            recordFirestoreRead('combos:getDocs', snap.docs.length, performance.now() - started);
            const items: ComboDeal[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                title: String(d.title ?? ''),
                subtitle: String(d.subtitle ?? ''),
                perfumeNames: Array.isArray(d.perfumeNames)
                  ? d.perfumeNames.map(String)
                  : [],
                sizeLabel: String(d.sizeLabel ?? ''),
                regularPrice: Number(d.regularPrice ?? 0),
                comboPrice: Number(d.comboPrice ?? 0),
                tag: String(d.tag ?? ''),
                featured: Boolean(d.featured),
                active: Boolean(d.active),
              };
            });
            items.sort((a, b) => Number(b.featured) - Number(a.featured));
            setLiveCombos(items);
            try {
              if (items.length > 0) {
                localStorage.setItem(COMBOS_CACHE_KEY, JSON.stringify(items));
                setCacheTimestamp('combos');
              } else {
                localStorage.removeItem(COMBOS_CACHE_KEY);
              }
            } catch {
              // Ignore storage errors
            }
          } else if (section === 'layering') {
            setLayeringLoading(true);
            const q = isOwner
              ? query(collection(db, 'layeringIdeas'))
              : query(collection(db, 'layeringIdeas'), where('active', '==', true));
            const snap = await withRetry(() => getDocs(q), { maxAttempts: 2 });
            recordFirestoreRead(
              'layeringIdeas:getDocs',
              snap.docs.length,
              performance.now() - started
            );
            const items: LayeringIdea[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                title: String(d.title ?? ''),
                vibe: String(d.vibe ?? ''),
                basePerfumeName: String(d.basePerfumeName ?? ''),
                topPerfumeName: String(d.topPerfumeName ?? ''),
                sprayRatio: String(d.sprayRatio ?? ''),
                occasion: String(d.occasion ?? ''),
                whyItWorks: String(d.whyItWorks ?? ''),
                active: Boolean(d.active),
              };
            });
            items.sort((a, b) => a.title.localeCompare(b.title));
            setLiveLayeringIdeas(items);
            try {
              if (items.length > 0) {
                localStorage.setItem(LAYERING_CACHE_KEY, JSON.stringify(items));
                setCacheTimestamp('layering');
              } else {
                localStorage.removeItem(LAYERING_CACHE_KEY);
              }
            } catch {
              // Ignore storage errors
            }
          } else {
            setHampersLoading(true);
            const q = isOwner
              ? query(collection(db, 'hampers'))
              : query(collection(db, 'hampers'), where('active', '==', true));
            const snap = await withRetry(() => getDocs(q), { maxAttempts: 2 });
            recordFirestoreRead('hampers:getDocs', snap.docs.length, performance.now() - started);
            const items: GiftHamper[] = snap.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                title: String(d.title ?? ''),
                occasion: String(d.occasion ?? 'For Her'),
                subtitle: String(d.subtitle ?? ''),
                itemsIncluded: Array.isArray(d.itemsIncluded)
                  ? d.itemsIncluded.map(String).filter(Boolean)
                  : [],
                regularPrice: Number(d.regularPrice ?? 0),
                hamperPrice: Number(d.hamperPrice ?? 0),
                image: resolveHamperImage(d.image, d.occasion),
                giftWrapNote: String(d.giftWrapNote ?? ''),
                availability: d.availability ?? 'In Stock',
                featured: Boolean(d.featured),
                active: Boolean(d.active),
              };
            });
            items.sort(
              (a, b) =>
                Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title)
            );
            setLiveHampers(items);
            try {
              if (items.length > 0) {
                localStorage.setItem(HAMPERS_CACHE_KEY, JSON.stringify(items));
                setCacheTimestamp('hampers');
              } else {
                localStorage.removeItem(HAMPERS_CACHE_KEY);
              }
            } catch {
              // Ignore storage errors
            }
          }
        } catch {
          // Graceful fallback to starter items
        } finally {
          if (section === 'combos') setCombosLoading(false);
          else if (section === 'layering') setLayeringLoading(false);
          else setHampersLoading(false);
          secondaryInFlightRef.current[section] = undefined;
        }
      })();

      secondaryInFlightRef.current[section] = task;
      return task;
    },
    [
      adminConsoleActive,
      isOwner,
      liveCombos.length,
      liveLayeringIdeas.length,
      liveHampers.length,
    ]
  );

  // Admin-only real-time listeners for combos, layering, hampers when Admin Console is active
  useEffect(() => {
    if (!authReady || !isOwner || !adminConsoleActive) return;

    const unsubCombos = onSnapshot(query(collection(db, 'combos')), (snap) => {
      const items: ComboDeal[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          title: String(d.title ?? ''),
          subtitle: String(d.subtitle ?? ''),
          perfumeNames: Array.isArray(d.perfumeNames) ? d.perfumeNames.map(String) : [],
          sizeLabel: String(d.sizeLabel ?? ''),
          regularPrice: Number(d.regularPrice ?? 0),
          comboPrice: Number(d.comboPrice ?? 0),
          tag: String(d.tag ?? ''),
          featured: Boolean(d.featured),
          active: Boolean(d.active),
        };
      });
      items.sort((a, b) => Number(b.featured) - Number(a.featured));
      setLiveCombos(items);
      setCombosLoading(false);
    });

    const unsubLayer = onSnapshot(query(collection(db, 'layeringIdeas')), (snap) => {
      const items: LayeringIdea[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          title: String(d.title ?? ''),
          vibe: String(d.vibe ?? ''),
          basePerfumeName: String(d.basePerfumeName ?? ''),
          topPerfumeName: String(d.topPerfumeName ?? ''),
          sprayRatio: String(d.sprayRatio ?? ''),
          occasion: String(d.occasion ?? ''),
          whyItWorks: String(d.whyItWorks ?? ''),
          active: Boolean(d.active),
        };
      });
      items.sort((a, b) => a.title.localeCompare(b.title));
      setLiveLayeringIdeas(items);
      setLayeringLoading(false);
    });

    const unsubHampers = onSnapshot(query(collection(db, 'hampers')), (snap) => {
      const items: GiftHamper[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          title: String(d.title ?? ''),
          occasion: String(d.occasion ?? 'For Her'),
          subtitle: String(d.subtitle ?? ''),
          itemsIncluded: Array.isArray(d.itemsIncluded)
            ? d.itemsIncluded.map(String).filter(Boolean)
            : [],
          regularPrice: Number(d.regularPrice ?? 0),
          hamperPrice: Number(d.hamperPrice ?? 0),
          image: resolveHamperImage(d.image, d.occasion),
          giftWrapNote: String(d.giftWrapNote ?? ''),
          availability: d.availability ?? 'In Stock',
          featured: Boolean(d.featured),
          active: Boolean(d.active),
        };
      });
      items.sort(
        (a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title)
      );
      setLiveHampers(items);
      setHampersLoading(false);
    });

    return () => {
      unsubCombos();
      unsubLayer();
      unsubHampers();
    };
  }, [authReady, isOwner, adminConsoleActive]);

  const usingSampleFallback = !catalogueLoading && livePerfumes.length === 0;
  const perfumes = livePerfumes.length > 0 ? livePerfumes : fragranceCatalogue;
  const usingSampleCombos = !combosLoading && liveCombos.length === 0;
  const combos = liveCombos.length > 0 ? liveCombos : starterCombos;
  const usingSampleLayering = !layeringLoading && liveLayeringIdeas.length === 0;
  const layeringIdeas =
    liveLayeringIdeas.length > 0 ? liveLayeringIdeas : starterLayeringIdeas;
  const usingSampleHampers = !hampersLoading && liveHampers.length === 0;
  const hampers = liveHampers.length > 0 ? liveHampers : starterHampers;

  const signInOwnerWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const signInOwnerWithPassword = useCallback(
    async (loginInput: string, password: string) => {
      const email = normalizeAdminEmailInput(loginInput);
      if (!password) {
        throw new Error('Please enter your admin password.');
      }
      await signInWithEmailAndPassword(auth, email, password);
    },
    []
  );

  const sendOwnerPasswordReset = useCallback(async (loginInput: string): Promise<string> => {
    const email = normalizeAdminEmailInput(loginInput);
    await sendPasswordResetEmail(auth, email);
    return email;
  }, []);

  const resendOwnerVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) {
      throw new Error('Sign in first before sending verification email.');
    }
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshAuthUser = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    await auth.currentUser.getIdToken(true);
    setUser(auth.currentUser);
    setAuthRevision((r) => r + 1);
    return Boolean(auth.currentUser.emailVerified);
  }, []);

  const setOwnerPasswordCredential = useCallback(async (newPassword: string) => {
    const current = auth.currentUser;
    if (!current || !current.email) {
      throw new Error('You must be signed in as the store owner.');
    }
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    const hasPasswordProvider = current.providerData.some(
      (p) => p.providerId === 'password'
    );
    if (hasPasswordProvider) {
      await updatePassword(current, newPassword);
    } else {
      const cred = EmailAuthProvider.credential(current.email, newPassword);
      await linkWithCredential(current, cred);
    }
    setAuthRevision((r) => r + 1);
  }, []);

  const signOutOwner = useCallback(async () => {
    await signOut(auth);
  }, []);

  const signUpPartnerWithPassword = useCallback(
    async (displayName: string, email: string, password: string) => {
      const cleanName = sanitizeText(displayName, 120);
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanName) throw new Error('Enter your full name or creator name.');
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('Enter a valid email address.');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await updateProfile(cred.user, { displayName: cleanName });
      await sendEmailVerification(cred.user);
      setAuthRevision((r) => r + 1);
    },
    []
  );

  const signInPartnerWithPassword = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Enter your account email address.');
    }
    if (!password) {
      throw new Error('Enter your password.');
    }
    await signInWithEmailAndPassword(auth, cleanEmail, password);
  }, []);

  const signInPartnerWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleProvider);
  }, []);

  const sendPartnerPasswordReset = useCallback(async (email: string): Promise<string> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Enter your account email address first.');
    }
    await sendPasswordResetEmail(auth, cleanEmail);
    return cleanEmail;
  }, []);

  const submitPartnerApplication = useCallback(
    async (input: PartnerApplicationInput): Promise<void> => {
      const current = auth.currentUser;
      if (!current || !current.emailVerified || !current.email) {
        throw new Error('Please sign in and verify your email first.');
      }
      const cleanName = sanitizeText(input.displayName, 120);
      if (!cleanName) throw new Error('Your name is required.');
      const cleanCode = sanitizePromoCode(input.requestedCode);
      if (cleanCode.length < 2) {
        throw new Error('Preferred referral code must be at least 2 letters or numbers.');
      }
      const cleanHandle = sanitizeText(input.socialHandle, 100);
      const cleanAccount = sanitizeText(input.payoutAccount, 160);
      const path = `referralPartners/${current.uid}`;

      try {
        await setDoc(doc(db, 'referralPartners', current.uid), {
          uid: current.uid,
          email: current.email.toLowerCase(),
          displayName: cleanName,
          socialHandle: cleanHandle,
          requestedCode: cleanCode,
          assignedCode: '',
          payoutMethod: input.payoutMethod,
          payoutAccount: cleanAccount,
          status: 'pending',
          ownerUid: current.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    []
  );

  const updatePartnerProfile = useCallback(
    async (input: PartnerApplicationInput): Promise<void> => {
      const current = auth.currentUser;
      if (!current || !current.emailVerified) {
        throw new Error('Please sign in and verify your email first.');
      }
      const cleanName = sanitizeText(input.displayName, 120);
      if (!cleanName) throw new Error('Display name is required.');
      const cleanCode = sanitizePromoCode(input.requestedCode);
      if (cleanCode.length < 2) {
        throw new Error('Preferred referral code must be at least 2 letters or numbers.');
      }
      const path = `referralPartners/${current.uid}`;
      try {
        await setDoc(
          doc(db, 'referralPartners', current.uid),
          {
            displayName: cleanName,
            socialHandle: sanitizeText(input.socialHandle, 100),
            requestedCode: cleanCode,
            payoutMethod: input.payoutMethod,
            payoutAccount: sanitizeText(input.payoutAccount, 160),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    []
  );

  const lookupCouponByCode = useCallback(
    async (rawCode: string): Promise<{ coupon: Coupon | null; error?: string }> => {
      const code = sanitizePromoCode(rawCode);
      if (code.length < 2) {
        return { coupon: null, error: 'Enter a valid coupon code (letters/numbers).' };
      }

      const cached = readSessionLookupCache<{ coupon: Coupon | null; error?: string }>(
        COUPON_LOOKUP_CACHE_KEY,
        code
      );
      if (cached) {
        recordFirestoreRead(`coupon:${code}:cache`, 0, 0, true);
        return cached;
      }

      const flightKey = `coupon:${code}`;
      const inFlight = promoLookupInFlightRef.current[flightKey] as
        | Promise<{ coupon: Coupon | null; error?: string }>
        | undefined;
      if (inFlight) return inFlight;

      const task = (async () => {
        const started = performance.now();
        const path = `coupons/${code}`;
        try {
          const snap = await withRetry(() => getDoc(doc(db, 'coupons', code)), {
            maxAttempts: 2,
          });
          recordFirestoreRead(path, 1, performance.now() - started);
          if (!snap.exists()) {
            const res = { coupon: null, error: `Coupon code "${code}" was not found or is inactive.` };
            writeSessionLookupCache(COUPON_LOOKUP_CACHE_KEY, code, res);
            return res;
          }
          const d = snap.data();
          const coupon: Coupon = {
            id: snap.id,
            code: String(d.code ?? snap.id),
            description: String(d.description ?? ''),
            discountType: d.discountType === 'fixed' ? 'fixed' : 'percentage',
            discountValue: Number(d.discountValue ?? 0),
            minOrderAmount: Number(d.minOrderAmount ?? 0),
            appliesTo:
              d.appliesTo === 'specials' || d.appliesTo === 'full-bottles'
                ? d.appliesTo
                : 'all',
            active: Boolean(d.active),
          };
          const res = !coupon.active
            ? { coupon: null, error: `Coupon "${code}" is not active right now.` }
            : { coupon };
          writeSessionLookupCache(COUPON_LOOKUP_CACHE_KEY, code, res);
          return res;
        } catch (error) {
          if (isPermissionDeniedError(error)) {
            const res = { coupon: null, error: `Coupon "${code}" is invalid or currently paused.` };
            writeSessionLookupCache(COUPON_LOOKUP_CACHE_KEY, code, res);
            return res;
          }
          handleFirestoreError(error, OperationType.GET, path);
        } finally {
          promoLookupInFlightRef.current[flightKey] = undefined;
        }
      })();

      promoLookupInFlightRef.current[flightKey] = task;
      return task;
    },
    []
  );

  const lookupReferralByCode = useCallback(
    async (
      rawCode: string
    ): Promise<{ referral: PublicReferral | null; error?: string }> => {
      const code = sanitizePromoCode(rawCode);
      if (code.length < 2) {
        return {
          referral: null,
          error: 'Enter a valid referral code (letters/numbers).',
        };
      }

      const cached = readSessionLookupCache<{
        referral: PublicReferral | null;
        error?: string;
      }>(REFERRAL_LOOKUP_CACHE_KEY, code);
      if (cached) {
        recordFirestoreRead(`publicReferral:${code}:cache`, 0, 0, true);
        return cached;
      }

      const flightKey = `referral:${code}`;
      const inFlight = promoLookupInFlightRef.current[flightKey] as
        | Promise<{ referral: PublicReferral | null; error?: string }>
        | undefined;
      if (inFlight) return inFlight;

      const task = (async () => {
        const started = performance.now();
        const path = `publicReferrals/${code}`;
        try {
          const snap = await withRetry(() => getDoc(doc(db, 'publicReferrals', code)), {
            maxAttempts: 2,
          });
          recordFirestoreRead(path, 1, performance.now() - started);
          if (!snap.exists()) {
            const res = {
              referral: null,
              error: `Referral code "${code}" was not found or is inactive.`,
            };
            writeSessionLookupCache(REFERRAL_LOOKUP_CACHE_KEY, code, res);
            return res;
          }
          const d = snap.data();
          const referral: PublicReferral = {
            id: snap.id,
            code: String(d.code ?? snap.id),
            influencerName: String(d.influencerName ?? ''),
            socialHandle: String(d.socialHandle ?? ''),
            followerDiscountType:
              d.followerDiscountType === 'percentage' ||
              d.followerDiscountType === 'fixed'
                ? d.followerDiscountType
                : 'none',
            followerDiscountValue: Number(d.followerDiscountValue ?? 0),
            active: Boolean(d.active),
          };
          const res = !referral.active
            ? { referral: null, error: `Referral code "${code}" is currently paused.` }
            : { referral };
          writeSessionLookupCache(REFERRAL_LOOKUP_CACHE_KEY, code, res);
          return res;
        } catch (error) {
          if (isPermissionDeniedError(error)) {
            const res = {
              referral: null,
              error: `Referral code "${code}" is invalid or currently paused.`,
            };
            writeSessionLookupCache(REFERRAL_LOOKUP_CACHE_KEY, code, res);
            return res;
          }
          handleFirestoreError(error, OperationType.GET, path);
        } finally {
          promoLookupInFlightRef.current[flightKey] = undefined;
        }
      })();

      promoLookupInFlightRef.current[flightKey] = task;
      return task;
    },
    []
  );

  const recordCheckoutReferralSale = useCallback(
    async (input: CheckoutReferralSaleInput): Promise<void> => {
      const code = sanitizePromoCode(input.referral.code);
      if (code.length < 2 || !input.referral.active) return;

      const reportedSubtotal = Math.min(
        250000,
        Math.max(0, Math.round(input.reportedSubtotal * 100) / 100)
      );
      const reportedDiscount = Math.min(
        reportedSubtotal,
        Math.max(0, Math.round(input.reportedDiscount * 100) / 100)
      );

      const cleanSummary = sanitizeText(input.orderSummary || 'WhatsApp Order', 240);
      const cleanRef = sanitizeText(input.customerRef, 120);
      const fingerprint = `${code}|${reportedSubtotal}|${cleanRef}|${cleanSummary.slice(0, 80)}`;
      const now = Date.now();
      const lastLoggedAt = recentReferralSalesRef.current.get(fingerprint) ?? 0;
      if (now - lastLoggedAt < DUPLICATE_REFERRAL_WINDOW_MS) {
        return;
      }
      recentReferralSalesRef.current.set(fingerprint, now);

      // 5-minute deterministic attribution ID to mitigate accidental double-taps / replay duplicates
      const bucket5m = Math.floor(now / 300_000).toString(36);
      const fpHash = sha256Hex(fingerprint).slice(0, 10);
      const attrId = `ra-${code.toLowerCase().slice(0, 16)}-${bucket5m}-${fpHash}`;

      try {
        await withRetry(
          () =>
            setDoc(doc(db, 'referralAttributions', attrId), {
              referralCode: code,
              influencerName:
                sanitizeText(input.referral.influencerName, 120) || code,
              orderSummary: cleanSummary || 'WhatsApp Order',
              reportedSubtotal,
              reportedDiscount,
              customerRef: cleanRef,
              status: 'pending',
              convertedSaleId: '',
              ownerUid:
                auth.currentUser?.uid && isOwner ? auth.currentUser.uid : 'guest-checkout',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }),
          { maxAttempts: 2 }
        );
      } catch {
        // Non-blocking: duplicate bucket collisions (!exists guard) or offline state never break WhatsApp handoff
      }
    },
    [isOwner]
  );

  const requireOwnerUid = useCallback((): string => {
    const uid = auth.currentUser?.uid;
    if (!uid || !isOwner) {
      throw new Error('Owner authorization required.');
    }
    return uid;
  }, [isOwner]);

  const writeAuditLog = useCallback(
    async (entry: {
      action: AuditAction;
      section: AuditSection;
      targetId: string;
      targetLabel: string;
      summary: string;
      changes: string[];
    }): Promise<void> => {
      const currentUser = auth.currentUser;
      const actorEmail = (currentUser?.email ?? '').trim().slice(0, 160);
      if (!currentUser?.uid || !isOwner || actorEmail.length < 3) return;

      const actorUsername = deriveAdminUsername(actorEmail, currentUser.displayName);
      const auditId = `audit-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`;

      try {
        await withRetry(
          () =>
            setDoc(doc(db, 'auditLogs', auditId), {
              actorEmail,
              actorUsername: actorUsername.slice(0, 80) || 'admin',
              action: entry.action,
              section: entry.section,
              targetId: (entry.targetId.trim() || 'item').slice(0, 160),
              targetLabel: (entry.targetLabel.trim() || 'Store Item').slice(0, 160),
              summary: (entry.summary.trim() || 'Updated record').slice(0, 300),
              changes: sanitizeAuditChanges(entry.changes),
              ownerUid: currentUser.uid,
              createdAt: serverTimestamp(),
            }),
          { maxAttempts: 2 }
        );
      } catch {
        console.warn('Audit log write skipped due to network or permission failure.');
      }
    },
    [isOwner]
  );

  const savePerfume = useCallback(
    async (input: PerfumeInput, existingId?: string): Promise<string> => {
      const ownerUid = requireOwnerUid();
      const id = existingId || `${slugifyId(input.name)}-${Date.now().toString(36)}`;
      const slug = (input.slug?.trim() || slugifyId(`${input.brand}-${input.name}`)).slice(
        0,
        160
      );

      const cleanName = sanitizeText(input.name, 140);
      const cleanBrand = sanitizeText(input.brand, 100);
      if (!cleanName) throw new Error('Perfume name is required.');
      if (!cleanBrand) throw new Error('Perfume house / brand is required.');

      const sanitizedSizes = normalizeAndDedupeSizes(input.sizes.slice(0, 12));
      if (sanitizedSizes.length === 0) {
        throw new Error('At least one bottle size must be configured.');
      }

      const cleanNotes = (arr: string[]) =>
        arr.map((n) => sanitizeText(n, 60)).filter(Boolean).slice(0, 10);

      const specialDiscountType: SpecialDiscountType =
        input.specialDiscountType === 'fixed' ? 'fixed' : 'percentage';

      const parsedDiscount = Number(input.specialDiscountPercent ?? 0);
      const safeDiscount = Number.isFinite(parsedDiscount)
        ? Math.min(90, Math.max(0, parsedDiscount))
        : 0;

      const parsedAmount = Number(input.specialDiscountAmount ?? 0);
      const safeDiscountAmount = Number.isFinite(parsedAmount)
        ? Math.min(50000, Math.max(0, Math.round(parsedAmount * 100) / 100))
        : 0;

      const cleanDescription = (
        sanitizeText(input.description, 2000) ||
        `${cleanName} by ${cleanBrand} — curated Arabian fragrance.`
      ).slice(0, 2000);

      const ref = doc(db, 'perfumes', id);
      const path = `perfumes/${id}`;

      const cleanBranches =
        input.availability === 'Out of Stock'
          ? []
          : normalizeBranches(input.availableBranches ?? ['manzini', 'mbabane']);

      const cleanImage = input.image.trim().slice(0, 500);
      const basePayload = {
        slug,
        isSampleListing: Boolean(input.isSampleListing),
        name: cleanName,
        brand: cleanBrand,
        category: input.category,
        concentration: sanitizeText(input.concentration, 100) || 'Eau de Parfum',
        description: cleanDescription,
        image: cleanImage,
        notes: {
          top: cleanNotes(input.notes.top),
          heart: cleanNotes(input.notes.heart),
          base: cleanNotes(input.notes.base),
        },
        sizes: sanitizedSizes,
        availability: input.availability,
        availableBranches: cleanBranches,
        featured: Boolean(input.featured),
        bestseller: Boolean(input.bestseller),
        isUnboxed: Boolean(input.isUnboxed),
        isNewArrival: Boolean(input.isNewArrival),
        onSpecial: Boolean(input.onSpecial),
        specialLabel: sanitizeText(input.specialLabel ?? '', 60),
        specialDiscountType,
        specialDiscountPercent: safeDiscount,
        specialDiscountAmount: safeDiscountAmount,
        updatedAt: serverTimestamp(),
      };

      try {
        const prevPerfume = existingId
          ? livePerfumesRef.current.find((p) => p.id === existingId)
          : undefined;
        if (existingId) {
          await setDoc(ref, basePayload, { merge: true });
        } else {
          await setDoc(ref, {
            ...basePayload,
            ownerUid,
            createdAt: serverTimestamp(),
          });
        }
        await writeAuditLog({
          action: existingId ? 'update' : 'create',
          section: 'perfume',
          targetId: id,
          targetLabel: `${cleanName} (${cleanBrand})`,
          summary: existingId
            ? `Updated perfume "${cleanName}"`
            : `Added new perfume "${cleanName}"`,
          changes: buildPerfumeDiff(prevPerfume, basePayload),
        });

        const updatedProduct: FragranceProduct = {
          id,
          slug,
          isSampleListing: basePayload.isSampleListing,
          name: cleanName,
          brand: cleanBrand,
          category: input.category,
          concentration: basePayload.concentration,
          description: cleanDescription,
          image: cleanImage,
          notes: basePayload.notes,
          sizes: sanitizedSizes,
          availability: input.availability,
          availableBranches: cleanBranches,
          featured: basePayload.featured,
          bestseller: basePayload.bestseller,
          isUnboxed: basePayload.isUnboxed,
          isNewArrival: basePayload.isNewArrival,
          createdAtMs: prevPerfume?.createdAtMs ?? Date.now(),
          onSpecial: basePayload.onSpecial,
          specialLabel: basePayload.specialLabel,
          specialDiscountType,
          specialDiscountPercent: safeDiscount,
          specialDiscountAmount: safeDiscountAmount,
        };
        const nextList = mergePerfumeLists(livePerfumesRef.current, [updatedProduct]);
        livePerfumesRef.current = nextList;
        setLivePerfumes(nextList);
        writePerfumesCache(nextList, true);
        await publishCatalogueSnapshot(nextList);
        return id;
      } catch (error) {
        handleFirestoreError(
          error,
          existingId ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [publishCatalogueSnapshot, requireOwnerUid, writeAuditLog]
  );

  const togglePerfumeSpecial = useCallback(
    async (
      perfume: FragranceProduct,
      onSpecial: boolean,
      specialDiscountPercent?: number,
      specialLabel?: string,
      specialDiscountType?: SpecialDiscountType,
      specialDiscountAmount?: number,
      skipSnapshotPublish = false
    ): Promise<void> => {
      requireOwnerUid();
      const path = `perfumes/${perfume.id}`;
      const resolvedType: SpecialDiscountType =
        (specialDiscountType ?? perfume.specialDiscountType) === 'fixed'
          ? 'fixed'
          : 'percentage';
      const safeDiscount = Math.min(
        90,
        Math.max(0, specialDiscountPercent ?? perfume.specialDiscountPercent ?? 0)
      );
      const rawAmount = Number(
        specialDiscountAmount ?? perfume.specialDiscountAmount ?? 0
      );
      const safeDiscountAmount = Number.isFinite(rawAmount)
        ? Math.min(50000, Math.max(0, Math.round(rawAmount * 100) / 100))
        : 0;
      const cleanLabel = sanitizeText(
        specialLabel ?? perfume.specialLabel ?? campaign.badgeText ?? 'Special Offer',
        60
      );
      const offerSummary =
        resolvedType === 'fixed'
          ? `-E${safeDiscountAmount} Off`
          : `${safeDiscount}% Off`;

      try {
        await setDoc(
          doc(db, 'perfumes', perfume.id),
          {
            onSpecial,
            specialDiscountType: resolvedType,
            specialDiscountPercent: safeDiscount,
            specialDiscountAmount: safeDiscountAmount,
            specialLabel: cleanLabel,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        const nextList = livePerfumesRef.current.map((p) =>
          p.id === perfume.id
            ? {
                ...p,
                onSpecial,
                specialDiscountType: resolvedType,
                specialDiscountPercent: safeDiscount,
                specialDiscountAmount: safeDiscountAmount,
                specialLabel: cleanLabel,
              }
            : p
        );
        livePerfumesRef.current = nextList;
        setLivePerfumes(nextList);
        writePerfumesCache(nextList, true);

        await writeAuditLog({
          action: 'update',
          section: 'perfume',
          targetId: perfume.id,
          targetLabel: `${perfume.name} (${perfume.brand})`,
          summary: onSpecial
            ? `Marked "${perfume.name}" on special (${offerSummary})`
            : `Removed "${perfume.name}" from specials`,
          changes: [
            `On Special: ${perfume.onSpecial ? 'Yes' : 'No'} → ${onSpecial ? 'Yes' : 'No'}`,
            onSpecial
              ? `Special Discount: ${offerSummary} · Label: ${cleanLabel || 'None'}`
              : 'Special offer deactivated',
          ],
        });

        if (!skipSnapshotPublish) {
          await publishCatalogueSnapshot(livePerfumesRef.current);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [campaign.badgeText, publishCatalogueSnapshot, requireOwnerUid, writeAuditLog]
  );

  const togglePerfumeNewArrival = useCallback(
    async (perfume: FragranceProduct, isNewArrival: boolean): Promise<void> => {
      requireOwnerUid();
      const path = `perfumes/${perfume.id}`;
      try {
        await setDoc(
          doc(db, 'perfumes', perfume.id),
          {
            isNewArrival,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        await writeAuditLog({
          action: 'update',
          section: 'perfume',
          targetId: perfume.id,
          targetLabel: `${perfume.name} (${perfume.brand})`,
          summary: isNewArrival
            ? `Marked "${perfume.name}" as New Arrival`
            : `Removed "${perfume.name}" from New Arrivals`,
          changes: [
            `New Arrival: ${perfume.isNewArrival ? 'Yes' : 'No'} → ${isNewArrival ? 'Yes' : 'No'}`,
          ],
        });
        const nextList = livePerfumesRef.current.map((p) =>
          p.id === perfume.id ? { ...p, isNewArrival } : p
        );
        livePerfumesRef.current = nextList;
        setLivePerfumes(nextList);
        writePerfumesCache(nextList, true);
        await publishCatalogueSnapshot(nextList);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [publishCatalogueSnapshot, requireOwnerUid, writeAuditLog]
  );

  const deletePerfume = useCallback(
    async (perfumeId: string): Promise<void> => {
      requireOwnerUid();
      const path = `perfumes/${perfumeId}`;
      const existing = livePerfumesRef.current.find((p) => p.id === perfumeId);
      try {
        await deleteDoc(doc(db, 'perfumes', perfumeId));
        const nextList = livePerfumesRef.current.filter((p) => p.id !== perfumeId);
        livePerfumesRef.current = nextList;
        setLivePerfumes(nextList);
        writePerfumesCache(nextList, true);
        await writeAuditLog({
          action: 'delete',
          section: 'perfume',
          targetId: perfumeId,
          targetLabel: existing ? `${existing.name} (${existing.brand})` : perfumeId,
          summary: existing
            ? `Deleted perfume "${existing.name}"`
            : `Deleted perfume (${perfumeId})`,
          changes: existing
            ? [
                `Removed ${existing.name} by ${existing.brand} (${existing.category})`,
                `Previous availability: ${existing.availability}`,
              ]
            : [`Deleted perfume document ${perfumeId}`],
        });
        await publishCatalogueSnapshot(nextList);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [publishCatalogueSnapshot, requireOwnerUid, writeAuditLog]
  );

  const importStarterCatalogue = useCallback(async (): Promise<number> => {
    const ownerUid = requireOwnerUid();
    const batch = writeBatch(db);
    try {
      for (const item of fragranceCatalogue) {
        const ref = doc(db, 'perfumes', item.id);
        batch.set(ref, {
          slug: item.slug.slice(0, 160),
          isSampleListing: true,
          name: item.name.slice(0, 140),
          brand: item.brand.slice(0, 100),
          category: item.category,
          concentration: item.concentration.slice(0, 100),
          description: item.description.slice(0, 2000),
          image: item.image.slice(0, 500),
          notes: {
            top: item.notes.top.slice(0, 10),
            heart: item.notes.heart.slice(0, 10),
            base: item.notes.base.slice(0, 10),
          },
          sizes: item.sizes.slice(0, 12),
          availability: item.availability,
          availableBranches:
            item.availability === 'Out of Stock'
              ? []
              : normalizeBranches(item.availableBranches ?? ['manzini', 'mbabane']),
          featured: item.featured,
          bestseller: item.bestseller,
          isUnboxed: Boolean(item.isUnboxed),
          isNewArrival: false,
          onSpecial: false,
          specialLabel: '',
          specialDiscountType: 'percentage',
          specialDiscountPercent: 0,
          specialDiscountAmount: 0,
          ownerUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await writeAuditLog({
        action: 'import',
        section: 'perfume',
        targetId: 'starter-catalogue',
        targetLabel: `Starter Catalogue (${fragranceCatalogue.length} SKUs)`,
        summary: `Imported ${fragranceCatalogue.length} starter perfumes into Firestore`,
        changes: [`Published ${fragranceCatalogue.length} catalogue items`],
      });
      const merged = mergePerfumeLists(livePerfumesRef.current, fragranceCatalogue);
      livePerfumesRef.current = merged;
      setLivePerfumes(merged);
      writePerfumesCache(merged, true);
      await publishCatalogueSnapshot(merged);
      return fragranceCatalogue.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'perfumes');
    }
  }, [publishCatalogueSnapshot, requireOwnerUid, writeAuditLog]);

  const saveCoupon = useCallback(
    async (input: CouponInput, isEdit = false): Promise<void> => {
      const ownerUid = requireOwnerUid();
      const code = sanitizePromoCode(input.code);
      if (code.length < 2) {
        throw new Error('Coupon code must be at least 2 characters (A-Z, 0-9, -, _).');
      }
      const maxVal = input.discountType === 'percentage' ? 95 : 50000;
      const discountValue = Math.min(maxVal, Math.max(1, Number(input.discountValue)));
      const minOrderAmount = Math.min(
        100000,
        Math.max(0, Number(input.minOrderAmount || 0))
      );

      const ref = doc(db, 'coupons', code);
      const path = `coupons/${code}`;
      const existingSnap = isEdit ? await getDoc(ref) : null;
      const prevCoupon = coupons.find((c) => c.code === code);

      const cleanPayload: CouponInput = {
        code,
        description: sanitizeText(input.description, 200),
        discountType: input.discountType,
        discountValue,
        minOrderAmount,
        appliesTo: input.appliesTo,
        active: Boolean(input.active),
      };

      try {
        if (isEdit && existingSnap?.exists()) {
          await setDoc(
            ref,
            {
              description: cleanPayload.description,
              discountType: cleanPayload.discountType,
              discountValue,
              minOrderAmount,
              appliesTo: cleanPayload.appliesTo,
              active: cleanPayload.active,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          await setDoc(ref, {
            code,
            description: cleanPayload.description,
            discountType: cleanPayload.discountType,
            discountValue,
            minOrderAmount,
            appliesTo: cleanPayload.appliesTo,
            active: cleanPayload.active,
            ownerUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        clearSessionLookupCache(COUPON_LOOKUP_CACHE_KEY, code);
        await writeAuditLog({
          action: isEdit && prevCoupon ? 'update' : 'create',
          section: 'coupon',
          targetId: code,
          targetLabel: `Coupon ${code}`,
          summary:
            isEdit && prevCoupon
              ? `Updated coupon code ${code}`
              : `Created coupon code ${code}`,
          changes: buildCouponDiff(prevCoupon, cleanPayload),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          isEdit ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [coupons, requireOwnerUid, writeAuditLog]
  );

  const toggleCouponActive = useCallback(
    async (coupon: Coupon): Promise<void> => {
      requireOwnerUid();
      const path = `coupons/${coupon.code}`;
      const nextActive = !coupon.active;
      try {
        await setDoc(
          doc(db, 'coupons', coupon.code),
          { active: nextActive, updatedAt: serverTimestamp() },
          { merge: true }
        );
        clearSessionLookupCache(COUPON_LOOKUP_CACHE_KEY, coupon.code);
        await writeAuditLog({
          action: 'update',
          section: 'coupon',
          targetId: coupon.code,
          targetLabel: `Coupon ${coupon.code}`,
          summary: `${nextActive ? 'Activated' : 'Paused'} coupon ${coupon.code}`,
          changes: [
            `Status: ${coupon.active ? 'Active' : 'Paused'} → ${
              nextActive ? 'Active' : 'Paused'
            }`,
          ],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [requireOwnerUid, writeAuditLog]
  );

  const deleteCoupon = useCallback(
    async (code: string): Promise<void> => {
      requireOwnerUid();
      const clean = sanitizePromoCode(code);
      const path = `coupons/${clean}`;
      const existing = coupons.find((c) => c.code === clean);
      try {
        await deleteDoc(doc(db, 'coupons', clean));
        clearSessionLookupCache(COUPON_LOOKUP_CACHE_KEY, clean);
        await writeAuditLog({
          action: 'delete',
          section: 'coupon',
          targetId: clean,
          targetLabel: `Coupon ${clean}`,
          summary: `Deleted coupon code ${clean}`,
          changes: existing
            ? [
                `Removed ${existing.discountValue}${
                  existing.discountType === 'percentage' ? '%' : ' SZL'
                } coupon (${existing.appliesTo})`,
              ]
            : [`Deleted coupon ${clean}`],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [coupons, requireOwnerUid, writeAuditLog]
  );

  const saveReferral = useCallback(
    async (input: ReferralInput, isEdit = false): Promise<void> => {
      const ownerUid = requireOwnerUid();
      const code = sanitizePromoCode(input.code);
      if (code.length < 2) {
        throw new Error('Referral code must be at least 2 characters (A-Z, 0-9, -, _).');
      }
      const influencerName = sanitizeText(input.influencerName, 120);
      if (!influencerName) {
        throw new Error('Influencer name is required.');
      }
      const maxComm = input.commissionType === 'percentage' ? 90 : 50000;
      const commissionValue = Math.min(
        maxComm,
        Math.max(0, Math.round(Number(input.commissionValue || 0) * 100) / 100)
      );

      const followerDiscountType = input.followerDiscountType;
      const maxFollowerDisc = followerDiscountType === 'percentage' ? 95 : 50000;
      const followerDiscountValue =
        followerDiscountType === 'none'
          ? 0
          : Math.min(
              maxFollowerDisc,
              Math.max(0, Math.round(Number(input.followerDiscountValue || 0) * 100) / 100)
            );

      const ref = doc(db, 'referrals', code);
      const pubRef = doc(db, 'publicReferrals', code);
      const path = `referrals/${code}`;
      const existingSnap = isEdit ? await getDoc(ref) : null;
      const prevReferral = referrals.find((r) => r.code === code);

      const cleanReferral: ReferralInput = {
        code,
        influencerName,
        socialHandle: sanitizeText(input.socialHandle, 100),
        commissionType: input.commissionType,
        commissionValue,
        followerDiscountType,
        followerDiscountValue,
        payoutNote: sanitizeText(input.payoutNote, 200),
        active: Boolean(input.active),
        partnerUid:
          input.partnerUid !== undefined
            ? input.partnerUid.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128)
            : prevReferral?.partnerUid ?? '',
      };

      const mutablePayload = {
        influencerName: cleanReferral.influencerName,
        socialHandle: cleanReferral.socialHandle,
        commissionType: cleanReferral.commissionType,
        commissionValue,
        followerDiscountType,
        followerDiscountValue,
        payoutNote: cleanReferral.payoutNote,
        active: cleanReferral.active,
        partnerUid: cleanReferral.partnerUid ?? '',
        updatedAt: serverTimestamp(),
      };

      const publicPayload = {
        code,
        influencerName: cleanReferral.influencerName,
        socialHandle: cleanReferral.socialHandle,
        followerDiscountType,
        followerDiscountValue,
        active: cleanReferral.active,
        ownerUid,
        updatedAt: serverTimestamp(),
      };

      try {
        const batch = writeBatch(db);
        if (isEdit && existingSnap?.exists()) {
          batch.set(ref, mutablePayload, { merge: true });
        } else {
          batch.set(ref, {
            code,
            ...mutablePayload,
            ownerUid,
            createdAt: serverTimestamp(),
          });
        }
        batch.set(pubRef, publicPayload);
        await batch.commit();

        clearSessionLookupCache(REFERRAL_LOOKUP_CACHE_KEY, code);
        await writeAuditLog({
          action: isEdit && prevReferral ? 'update' : 'create',
          section: 'referral',
          targetId: code,
          targetLabel: `${code} · ${influencerName}`,
          summary:
            isEdit && prevReferral
              ? `Updated influencer partner ${code} (${influencerName})`
              : `Added influencer partner ${code} (${influencerName})`,
          changes: buildReferralDiff(prevReferral, cleanReferral),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          isEdit ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [referrals, requireOwnerUid, writeAuditLog]
  );

  const toggleReferralActive = useCallback(
    async (referral: InfluencerReferral): Promise<void> => {
      const ownerUid = requireOwnerUid();
      const path = `referrals/${referral.code}`;
      const nextActive = !referral.active;
      try {
        const batch = writeBatch(db);
        batch.set(
          doc(db, 'referrals', referral.code),
          { active: nextActive, updatedAt: serverTimestamp() },
          { merge: true }
        );
        batch.set(doc(db, 'publicReferrals', referral.code), {
          code: referral.code,
          influencerName: referral.influencerName,
          socialHandle: referral.socialHandle,
          followerDiscountType: referral.followerDiscountType,
          followerDiscountValue: referral.followerDiscountValue,
          active: nextActive,
          ownerUid,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        clearSessionLookupCache(REFERRAL_LOOKUP_CACHE_KEY, referral.code);
        await writeAuditLog({
          action: 'update',
          section: 'referral',
          targetId: referral.code,
          targetLabel: `${referral.code} · ${referral.influencerName}`,
          summary: `${nextActive ? 'Activated' : 'Paused'} influencer code ${referral.code}`,
          changes: [
            `Status: ${referral.active ? 'Active' : 'Paused'} → ${
              nextActive ? 'Active' : 'Paused'
            }`,
          ],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [requireOwnerUid, writeAuditLog]
  );

  const deleteReferral = useCallback(
    async (code: string): Promise<void> => {
      requireOwnerUid();
      const clean = sanitizePromoCode(code);
      const path = `referrals/${clean}`;
      const existing = referrals.find((r) => r.code === clean);
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'referrals', clean));
        batch.delete(doc(db, 'publicReferrals', clean));
        await batch.commit();
        clearSessionLookupCache(REFERRAL_LOOKUP_CACHE_KEY, clean);
        await writeAuditLog({
          action: 'delete',
          section: 'referral',
          targetId: clean,
          targetLabel: existing ? `${clean} · ${existing.influencerName}` : clean,
          summary: `Deleted influencer referral code ${clean}`,
          changes: existing
            ? [`Removed partner ${existing.influencerName} (${clean})`]
            : [`Deleted referral code ${clean}`],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [referrals, requireOwnerUid, writeAuditLog]
  );

  const approveReferralAttribution = useCallback(
    async (
      attribution: ReferralAttribution,
      verifiedSubtotal: number,
      verifiedDiscount: number
    ): Promise<string> => {
      const ownerUid = requireOwnerUid();
      const code = sanitizePromoCode(attribution.referralCode);
      let targetReferral = referrals.find((r) => r.code === code) ?? null;
      if (!targetReferral) {
        const snap = await getDoc(doc(db, 'referrals', code));
        if (!snap.exists()) {
          throw new Error(`Referral profile "${code}" does not exist.`);
        }
        const d = snap.data();
        targetReferral = {
          id: snap.id,
          code: String(d.code ?? snap.id),
          influencerName: String(d.influencerName ?? code),
          socialHandle: String(d.socialHandle ?? ''),
          commissionType: d.commissionType === 'fixed' ? 'fixed' : 'percentage',
          commissionValue: Number(d.commissionValue ?? 0),
          followerDiscountType:
            d.followerDiscountType === 'percentage' || d.followerDiscountType === 'fixed'
              ? d.followerDiscountType
              : 'none',
          followerDiscountValue: Number(d.followerDiscountValue ?? 0),
          payoutNote: String(d.payoutNote ?? ''),
          active: Boolean(d.active),
          partnerUid: typeof d.partnerUid === 'string' ? d.partnerUid : '',
        };
      }

      const orderSubtotal = Math.min(
        250000,
        Math.max(0, Math.round(Number(verifiedSubtotal || 0) * 100) / 100)
      );
      const discountAmount = Math.min(
        orderSubtotal,
        Math.max(0, Math.round(Number(verifiedDiscount || 0) * 100) / 100)
      );
      const netOrderAmount = Math.max(
        0,
        Math.round((orderSubtotal - discountAmount) * 100) / 100
      );
      const commissionAmount = calculateReferralCommission(netOrderAmount, targetReferral);

      const saleId = `rs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const path = `referralAttributions/${attribution.id}`;

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'referralSales', saleId), {
          referralCode: code,
          influencerName:
            sanitizeText(targetReferral.influencerName, 120) || code,
          orderSummary: sanitizeText(attribution.orderSummary, 240) || 'WhatsApp Order',
          orderSubtotal,
          discountAmount,
          netOrderAmount,
          commissionAmount,
          commissionStatus: 'confirmed',
          source: 'checkout',
          customerRef: sanitizeText(attribution.customerRef, 120),
          partnerUid: targetReferral.partnerUid ?? '',
          ownerUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(
          doc(db, 'referralAttributions', attribution.id),
          {
            status: 'converted',
            convertedSaleId: saleId,
            reportedSubtotal: orderSubtotal,
            reportedDiscount: discountAmount,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        await batch.commit();

        await writeAuditLog({
          action: 'create',
          section: 'referral-attribution',
          targetId: attribution.id,
          targetLabel: `${code} · ${attribution.orderSummary.slice(0, 60)}`,
          summary: `Verified attribution and created E${commissionAmount.toFixed(2)} commission for ${code}`,
          changes: [
            `Verified Order Net: E${netOrderAmount.toFixed(2)}`,
            `Commission: E${commissionAmount.toFixed(2)} (confirmed)`,
            `Sale Ledger ID: ${saleId}`,
          ],
        });
        return saleId;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [referrals, requireOwnerUid, writeAuditLog]
  );

  const dismissReferralAttribution = useCallback(
    async (attributionId: string): Promise<void> => {
      requireOwnerUid();
      const path = `referralAttributions/${attributionId}`;
      const target = referralAttributions.find((a) => a.id === attributionId);
      try {
        await setDoc(
          doc(db, 'referralAttributions', attributionId),
          {
            status: 'dismissed',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        await writeAuditLog({
          action: 'update',
          section: 'referral-attribution',
          targetId: attributionId,
          targetLabel: target
            ? `${target.referralCode} · ${target.orderSummary.slice(0, 60)}`
            : attributionId,
          summary: `Dismissed checkout attribution ${target?.referralCode ?? attributionId}`,
          changes: ['Attribution Status: pending → dismissed'],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [referralAttributions, requireOwnerUid, writeAuditLog]
  );

  const logManualReferralSale = useCallback(
    async (input: ManualReferralSaleInput): Promise<string> => {
      const ownerUid = requireOwnerUid();
      const code = sanitizePromoCode(input.referralCode);
      if (code.length < 2) {
        throw new Error('Select a valid influencer referral code.');
      }

      let targetReferral = referrals.find((r) => r.code === code) ?? null;
      if (!targetReferral) {
        const snap = await getDoc(doc(db, 'referrals', code));
        if (!snap.exists()) {
          throw new Error(`Referral code "${code}" does not exist.`);
        }
        const d = snap.data();
        targetReferral = {
          id: snap.id,
          code: String(d.code ?? snap.id),
          influencerName: String(d.influencerName ?? code),
          socialHandle: String(d.socialHandle ?? ''),
          commissionType: d.commissionType === 'fixed' ? 'fixed' : 'percentage',
          commissionValue: Number(d.commissionValue ?? 0),
          followerDiscountType: 'none',
          followerDiscountValue: 0,
          payoutNote: String(d.payoutNote ?? ''),
          active: Boolean(d.active),
          partnerUid: typeof d.partnerUid === 'string' ? d.partnerUid : '',
        };
      }

      const orderSummary = sanitizeText(input.orderSummary, 240);
      if (!orderSummary) {
        throw new Error('Enter a short summary of the perfume(s) sold.');
      }

      const orderSubtotal = Math.min(
        250000,
        Math.max(0, Math.round(Number(input.orderSubtotal || 0) * 100) / 100)
      );
      const discountAmount = Math.min(
        orderSubtotal,
        Math.max(0, Math.round(Number(input.discountAmount || 0) * 100) / 100)
      );
      const netOrderAmount = Math.max(
        0,
        Math.round((orderSubtotal - discountAmount) * 100) / 100
      );
      const commissionAmount = calculateReferralCommission(netOrderAmount, targetReferral);
      const status: ReferralSaleStatus = input.commissionStatus ?? 'confirmed';

      const saleId = `rs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const path = `referralSales/${saleId}`;

      try {
        await setDoc(doc(db, 'referralSales', saleId), {
          referralCode: code,
          influencerName: sanitizeText(targetReferral.influencerName, 120) || code,
          orderSummary,
          orderSubtotal,
          discountAmount,
          netOrderAmount,
          commissionAmount,
          commissionStatus: status,
          source: 'manual',
          customerRef: sanitizeText(input.customerRef ?? '', 120),
          partnerUid: targetReferral.partnerUid ?? '',
          ownerUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await writeAuditLog({
          action: 'create',
          section: 'referral-sale',
          targetId: saleId,
          targetLabel: `${code} · ${orderSummary.slice(0, 60)}`,
          summary: `Logged referral sale for ${code} (E${commissionAmount.toFixed(0)} commission)`,
          changes: [
            `Order: ${orderSummary}`,
            `Net Order: E${netOrderAmount.toFixed(2)} · Commission: E${commissionAmount.toFixed(2)} (${status})`,
          ],
        });
        return saleId;
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    [referrals, requireOwnerUid, writeAuditLog]
  );

  const updateReferralSaleStatus = useCallback(
    async (saleId: string, status: ReferralSaleStatus): Promise<void> => {
      requireOwnerUid();
      const path = `referralSales/${saleId}`;
      const prevSale = referralSales.find((s) => s.id === saleId);
      try {
        await setDoc(
          doc(db, 'referralSales', saleId),
          { commissionStatus: status, updatedAt: serverTimestamp() },
          { merge: true }
        );
        await writeAuditLog({
          action: 'update',
          section: 'referral-sale',
          targetId: saleId,
          targetLabel: prevSale
            ? `${prevSale.referralCode} · ${prevSale.orderSummary.slice(0, 60)}`
            : saleId,
          summary: prevSale
            ? `Changed referral payout status for ${prevSale.referralCode} to "${status}"`
            : `Updated referral sale status to "${status}"`,
          changes: [
            `Commission Status: ${prevSale?.commissionStatus ?? 'unknown'} → ${status}`,
            prevSale ? `Commission Amount: E${prevSale.commissionAmount.toFixed(2)}` : '',
          ],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [referralSales, requireOwnerUid, writeAuditLog]
  );

  const deleteReferralSale = useCallback(
    async (saleId: string): Promise<void> => {
      requireOwnerUid();
      const path = `referralSales/${saleId}`;
      const prevSale = referralSales.find((s) => s.id === saleId);
      try {
        await deleteDoc(doc(db, 'referralSales', saleId));
        await writeAuditLog({
          action: 'delete',
          section: 'referral-sale',
          targetId: saleId,
          targetLabel: prevSale
            ? `${prevSale.referralCode} · ${prevSale.orderSummary.slice(0, 60)}`
            : saleId,
          summary: prevSale
            ? `Deleted referral sale record for ${prevSale.referralCode}`
            : `Deleted referral sale (${saleId})`,
          changes: prevSale
            ? [
                `Order: ${prevSale.orderSummary}`,
                `Previous commission: E${prevSale.commissionAmount.toFixed(2)} (${prevSale.commissionStatus})`,
              ]
            : [`Deleted sale record ${saleId}`],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [referralSales, requireOwnerUid, writeAuditLog]
  );

  const approvePartnerApplication = useCallback(
    async (
      partner: ReferralPartnerProfile,
      config: ApprovePartnerInput
    ): Promise<void> => {
      const ownerUid = requireOwnerUid();
      const code = sanitizePromoCode(config.code);
      if (code.length < 2) {
        throw new Error('Assigned referral code must be at least 2 characters.');
      }
      const maxComm = config.commissionType === 'percentage' ? 90 : 50000;
      const commissionValue = Math.min(
        maxComm,
        Math.max(0, Math.round(Number(config.commissionValue || 0) * 100) / 100)
      );
      const followerDiscountType = config.followerDiscountType;
      const maxDisc = followerDiscountType === 'percentage' ? 95 : 50000;
      const followerDiscountValue =
        followerDiscountType === 'none'
          ? 0
          : Math.min(
              maxDisc,
              Math.max(0, Math.round(Number(config.followerDiscountValue || 0) * 100) / 100)
            );

      const refDoc = doc(db, 'referrals', code);
      const pubDoc = doc(db, 'publicReferrals', code);
      const partnerDoc = doc(db, 'referralPartners', partner.uid);
      const existingRefSnap = await getDoc(refDoc);

      const payoutSummary =
        sanitizeText(config.payoutNote, 200) ||
        `${partner.payoutMethod.toUpperCase()}${
          partner.payoutAccount ? ` · ${partner.payoutAccount}` : ''
        }`.slice(0, 200);

      try {
        const batch = writeBatch(db);
        if (existingRefSnap.exists()) {
          batch.set(
            refDoc,
            {
              influencerName: sanitizeText(partner.displayName, 120) || code,
              socialHandle: sanitizeText(partner.socialHandle, 100),
              commissionType: config.commissionType,
              commissionValue,
              followerDiscountType,
              followerDiscountValue,
              payoutNote: payoutSummary,
              active: Boolean(config.active),
              partnerUid: partner.uid,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else {
          batch.set(refDoc, {
            code,
            influencerName: sanitizeText(partner.displayName, 120) || code,
            socialHandle: sanitizeText(partner.socialHandle, 100),
            commissionType: config.commissionType,
            commissionValue,
            followerDiscountType,
            followerDiscountValue,
            payoutNote: payoutSummary,
            active: Boolean(config.active),
            partnerUid: partner.uid,
            ownerUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        batch.set(pubDoc, {
          code,
          influencerName: sanitizeText(partner.displayName, 120) || code,
          socialHandle: sanitizeText(partner.socialHandle, 100),
          followerDiscountType,
          followerDiscountValue,
          active: Boolean(config.active),
          ownerUid,
          updatedAt: serverTimestamp(),
        });

        batch.set(
          partnerDoc,
          {
            assignedCode: code,
            status: config.active ? 'active' : 'paused',
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        // Backfill partnerUid on any existing referralSales matching this code so historical earnings display on dashboard
        const matchingSales = referralSales
          .filter((s) => s.referralCode === code && s.partnerUid !== partner.uid)
          .slice(0, 120);
        for (const s of matchingSales) {
          batch.set(
            doc(db, 'referralSales', s.id),
            { partnerUid: partner.uid, updatedAt: serverTimestamp() },
            { merge: true }
          );
        }

        await batch.commit();
        clearSessionLookupCache(REFERRAL_LOOKUP_CACHE_KEY, code);

        await writeAuditLog({
          action: 'update',
          section: 'referral-partner',
          targetId: partner.uid,
          targetLabel: `${code} · ${partner.displayName}`,
          summary: `Approved creator partner "${partner.displayName}" and linked code ${code}`,
          changes: [
            `Assigned Code: ${code} (${config.active ? 'Active' : 'Paused'})`,
            `Commission: ${
              config.commissionType === 'percentage'
                ? `${commissionValue}%`
                : `E${commissionValue}`
            } · Backfilled ${matchingSales.length} existing sales`,
          ],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `referralPartners/${partner.uid}`);
      }
    },
    [referralSales, requireOwnerUid, writeAuditLog]
  );

  const updatePartnerApplicationStatus = useCallback(
    async (partnerUid: string, status: ReferralPartnerStatus): Promise<void> => {
      requireOwnerUid();
      const target = partnerApplications.find((p) => p.uid === partnerUid);
      const path = `referralPartners/${partnerUid}`;
      try {
        await setDoc(
          doc(db, 'referralPartners', partnerUid),
          { status, updatedAt: serverTimestamp() },
          { merge: true }
        );
        await writeAuditLog({
          action: 'update',
          section: 'referral-partner',
          targetId: partnerUid,
          targetLabel: target ? `${target.displayName} (${target.assignedCode || target.requestedCode})` : partnerUid,
          summary: `Updated partner portal access status to "${status}"`,
          changes: [
            `Partner Status: ${target?.status ?? 'unknown'} → ${status}`,
          ],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [partnerApplications, requireOwnerUid, writeAuditLog]
  );

  const saveCampaign = useCallback(
    async (next: SpecialCampaign): Promise<void> => {
      const ownerUid = requireOwnerUid();
      const ref = doc(db, 'campaigns', 'active-special');
      const path = 'campaigns/active-special';
      try {
        const existing = await getDoc(ref);
        const rawEndsAt = String(next.endsAt ?? '').trim();
        const parsedEnd = rawEndsAt ? new Date(rawEndsAt) : null;
        const cleanEndsAt =
          parsedEnd && !Number.isNaN(parsedEnd.getTime())
            ? parsedEnd.toISOString().slice(0, 64)
            : '';

        const cleanNextCampaign: SpecialCampaign = {
          title: sanitizeText(next.title, 100) || 'Special Offers',
          badgeText: sanitizeText(next.badgeText, 40) || 'SPECIAL',
          subtitle: sanitizeText(next.subtitle, 400),
          announcementText: sanitizeText(next.announcementText, 240),
          promoCodeHint: sanitizePromoCode(next.promoCodeHint).slice(0, 32),
          endsAt: cleanEndsAt,
          enabled: Boolean(next.enabled),
          heroMode:
            next.heroMode === 'new-arrivals' || next.heroMode === 'specials'
              ? next.heroMode
              : 'auto',
          newArrivalsTitle: sanitizeText(next.newArrivalsTitle ?? '', 100) || 'New Arrivals',
          newArrivalsBadge: sanitizeText(next.newArrivalsBadge ?? '', 40) || 'JUST LANDED',
          newArrivalsSubtitle: sanitizeText(next.newArrivalsSubtitle ?? '', 400),
        };

        const payload = { ...cleanNextCampaign, updatedAt: serverTimestamp() };
        if (existing.exists()) {
          await setDoc(ref, payload, { merge: true });
        } else {
          await setDoc(ref, { ...payload, ownerUid });
        }

        setCampaign(cleanNextCampaign);
        try {
          localStorage.setItem(CAMPAIGN_CACHE_KEY, JSON.stringify(cleanNextCampaign));
          setCacheTimestamp('campaign');
        } catch {
          // Ignore storage quota errors
        }

        await writeAuditLog({
          action: 'update',
          section: 'specials',
          targetId: 'active-special',
          targetLabel: cleanNextCampaign.title,
          summary: `Updated seasonal campaign "${cleanNextCampaign.title}" (${
            cleanNextCampaign.enabled ? 'Live' : 'Paused'
          })`,
          changes: buildCampaignDiff(campaign, cleanNextCampaign),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [campaign, requireOwnerUid, writeAuditLog]
  );

  const saveWeeklySpecial = useCallback(
    async (next: WeeklyFiveMlSpecial): Promise<void> => {
      const ownerUid = requireOwnerUid();
      const ref = doc(db, 'weeklySpecials', 'active-5ml');
      const path = 'weeklySpecials/active-5ml';
      try {
        const existingSnap = await getDoc(ref);
        const safeId = (val: string) =>
          val.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
        const fourPackPrice = Math.min(
          10000,
          Math.max(1, Number(next.fourPackPrice || 100))
        );
        const twoPackPrice = Math.min(
          fourPackPrice,
          Math.max(1, Number(next.twoPackPrice || 50))
        );
        const activeWeek = (next.weekKey.trim() || getWeekWindowBounds().weekKey).slice(
          0,
          24
        );
        const sanitizeList = (
          arr: string[],
          maxLen: number,
          exclude?: Set<string>
        ) =>
          arr
            .map(safeId)
            .filter((id) => Boolean(id) && (!exclude || !exclude.has(id)))
            .slice(0, maxLen);

        const womenUnder500Ids = sanitizeList(next.womenUnder500Ids ?? [], 3);
        const womenUnder800Ids = sanitizeList(
          next.womenUnder800Ids ?? [],
          2,
          new Set(womenUnder500Ids)
        );
        const menUnder500Ids = sanitizeList(next.menUnder500Ids ?? [], 3);
        const menUnder800Ids = sanitizeList(
          next.menUnder800Ids ?? [],
          2,
          new Set(menUnder500Ids)
        );

        const under500Ids = sanitizeList(
          next.under500Ids.length > 0 ? next.under500Ids : womenUnder500Ids,
          3
        );
        const under800Ids = sanitizeList(
          next.under800Ids.length > 0 ? next.under800Ids : womenUnder800Ids,
          2,
          new Set(under500Ids)
        );

        const cleanExclusiveItems = sanitizeExclusiveItemsInput(next.exclusiveItems);
        const cleanExclusiveTitle =
          sanitizeText(next.exclusiveTitle ?? '', 100) ||
          DEFAULT_WEEKLY_FIVE_ML_SPECIAL.exclusiveTitle;
        const cleanExclusiveBadge =
          sanitizeText(next.exclusiveBadge ?? '', 40) ||
          DEFAULT_WEEKLY_FIVE_ML_SPECIAL.exclusiveBadge;
        const cleanExclusiveSubtitle = sanitizeText(
          next.exclusiveSubtitle ?? '',
          240
        );
        const cleanBundlePrice = Math.min(
          50000,
          Math.max(0, Number(next.exclusiveBundlePrice ?? 0) || 0)
        );

        const cleanNextWeekly: WeeklyFiveMlSpecial = {
          enabled: Boolean(next.enabled),
          autoRotateWeekly: Boolean(next.autoRotateWeekly),
          weekKey: activeWeek,
          seedOffset: Math.min(
            1000000,
            Math.max(0, Math.floor(Number(next.seedOffset || 0)))
          ),
          under500Ids,
          under800Ids,
          womenUnder500Ids,
          womenUnder800Ids,
          menUnder500Ids,
          menUnder800Ids,
          fourPackPrice,
          twoPackPrice,
          exclusiveEnabled: Boolean(next.exclusiveEnabled),
          exclusiveTitle: cleanExclusiveTitle,
          exclusiveBadge: cleanExclusiveBadge,
          exclusiveSubtitle: cleanExclusiveSubtitle,
          exclusiveBundleEnabled:
            Boolean(next.exclusiveBundleEnabled) &&
            cleanExclusiveItems.length >= 2 &&
            cleanBundlePrice > 0,
          exclusiveBundlePrice: cleanBundlePrice,
          exclusiveItems: cleanExclusiveItems,
        };

        const payload = { ...cleanNextWeekly, updatedAt: serverTimestamp() };
        if (existingSnap.exists()) {
          await setDoc(ref, payload, { merge: true });
        } else {
          await setDoc(ref, { ...payload, ownerUid });
        }

        setWeeklySpecial(cleanNextWeekly);
        try {
          localStorage.setItem(WEEKLY_5ML_CACHE_KEY, JSON.stringify(cleanNextWeekly));
          setCacheTimestamp('weeklySpecial');
        } catch {
          // Ignore storage quota errors
        }

        await writeAuditLog({
          action: 'update',
          section: 'weekly-special',
          targetId: 'active-5ml',
          targetLabel: `Weekly 5ml Special (${activeWeek})`,
          summary: `Updated Weekly 5ml Decant Special (${
            cleanNextWeekly.enabled ? 'Active' : 'Paused'
          })`,
          changes: buildWeeklySpecialDiff(
            weeklySpecial,
            cleanNextWeekly,
            (id) => livePerfumesRef.current.find((p) => p.id === id)?.name ?? id
          ),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    },
    [requireOwnerUid, weeklySpecial, writeAuditLog]
  );

  const saveComboDeal = useCallback(
    async (input: ComboInput, existingId?: string): Promise<string> => {
      const ownerUid = requireOwnerUid();
      const cleanTitle = sanitizeText(input.title, 140);
      if (!cleanTitle) throw new Error('Combo title is required.');
      const cleanNames = input.perfumeNames
        .map((n) => sanitizeText(n, 140))
        .filter(Boolean)
        .slice(0, 6);
      if (cleanNames.length < 2) {
        throw new Error('Include at least 2 perfume names in a combo bundle.');
      }
      const cleanSize = sanitizeText(input.sizeLabel, 60) || '2 × Bottles';
      const regularPrice = Math.min(100000, Math.max(0, Number(input.regularPrice || 0)));
      const comboPrice = Math.min(regularPrice, Math.max(0, Number(input.comboPrice || 0)));

      const id = existingId || `combo-${slugifyId(cleanTitle)}-${Date.now().toString(36)}`;
      const ref = doc(db, 'combos', id);
      const path = `combos/${id}`;
      const prevCombo = existingId
        ? liveCombos.find((c) => c.id === existingId)
        : undefined;

      const cleanCombo: ComboInput = {
        title: cleanTitle,
        subtitle: sanitizeText(input.subtitle, 300),
        perfumeNames: cleanNames,
        sizeLabel: cleanSize,
        regularPrice,
        comboPrice,
        tag: sanitizeText(input.tag, 40),
        featured: Boolean(input.featured),
        active: Boolean(input.active),
      };

      const mutablePayload = { ...cleanCombo, updatedAt: serverTimestamp() };
      try {
        if (existingId) {
          await setDoc(ref, mutablePayload, { merge: true });
        } else {
          await setDoc(ref, {
            ...mutablePayload,
            ownerUid,
            createdAt: serverTimestamp(),
          });
        }
        await writeAuditLog({
          action: existingId ? 'update' : 'create',
          section: 'combo',
          targetId: id,
          targetLabel: cleanTitle,
          summary: existingId
            ? `Updated combo bundle "${cleanTitle}"`
            : `Created combo bundle "${cleanTitle}"`,
          changes: buildComboDiff(prevCombo, cleanCombo),
        });
        return id;
      } catch (error) {
        handleFirestoreError(
          error,
          existingId ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [liveCombos, requireOwnerUid, writeAuditLog]
  );

  const deleteComboDeal = useCallback(
    async (comboId: string): Promise<void> => {
      requireOwnerUid();
      const path = `combos/${comboId}`;
      const existing = liveCombos.find((c) => c.id === comboId);
      try {
        await deleteDoc(doc(db, 'combos', comboId));
        await writeAuditLog({
          action: 'delete',
          section: 'combo',
          targetId: comboId,
          targetLabel: existing?.title ?? comboId,
          summary: existing
            ? `Deleted combo bundle "${existing.title}"`
            : `Deleted combo bundle (${comboId})`,
          changes: existing
            ? [`Removed combo: ${existing.perfumeNames.join(' + ')} (E${existing.comboPrice})`]
            : [`Deleted combo ${comboId}`],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [liveCombos, requireOwnerUid, writeAuditLog]
  );

  const saveLayeringIdea = useCallback(
    async (input: LayeringIdeaInput, existingId?: string): Promise<string> => {
      const ownerUid = requireOwnerUid();
      const cleanTitle = sanitizeText(input.title, 140);
      const cleanBase = sanitizeText(input.basePerfumeName, 140);
      const cleanTop = sanitizeText(input.topPerfumeName, 140);
      if (!cleanTitle || !cleanBase || !cleanTop) {
        throw new Error('Title, Base Perfume, and Topper Perfume are required.');
      }

      const id = existingId || `layer-${slugifyId(cleanTitle)}-${Date.now().toString(36)}`;
      const ref = doc(db, 'layeringIdeas', id);
      const path = `layeringIdeas/${id}`;
      const prevIdea = existingId
        ? liveLayeringIdeas.find((i) => i.id === existingId)
        : undefined;

      const cleanIdea: LayeringIdeaInput = {
        title: cleanTitle,
        vibe: sanitizeText(input.vibe, 60) || 'Signature Blend',
        basePerfumeName: cleanBase,
        topPerfumeName: cleanTop,
        sprayRatio:
          sanitizeText(input.sprayRatio, 80) || '2 sprays base · 2 sprays top',
        occasion: sanitizeText(input.occasion, 120),
        whyItWorks:
          sanitizeText(input.whyItWorks, 500) ||
          `${cleanBase} anchors the skin while ${cleanTop} adds luminous projection.`,
        active: Boolean(input.active),
      };

      const mutablePayload = { ...cleanIdea, updatedAt: serverTimestamp() };
      try {
        if (existingId) {
          await setDoc(ref, mutablePayload, { merge: true });
        } else {
          await setDoc(ref, {
            ...mutablePayload,
            ownerUid,
            createdAt: serverTimestamp(),
          });
        }
        await writeAuditLog({
          action: existingId ? 'update' : 'create',
          section: 'layering',
          targetId: id,
          targetLabel: cleanTitle,
          summary: existingId
            ? `Updated layering ritual "${cleanTitle}"`
            : `Created layering ritual "${cleanTitle}"`,
          changes: buildLayeringDiff(prevIdea, cleanIdea),
        });
        return id;
      } catch (error) {
        handleFirestoreError(
          error,
          existingId ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [liveLayeringIdeas, requireOwnerUid, writeAuditLog]
  );

  const deleteLayeringIdea = useCallback(
    async (ideaId: string): Promise<void> => {
      requireOwnerUid();
      const path = `layeringIdeas/${ideaId}`;
      const existing = liveLayeringIdeas.find((i) => i.id === ideaId);
      try {
        await deleteDoc(doc(db, 'layeringIdeas', ideaId));
        await writeAuditLog({
          action: 'delete',
          section: 'layering',
          targetId: ideaId,
          targetLabel: existing?.title ?? ideaId,
          summary: existing
            ? `Deleted layering ritual "${existing.title}"`
            : `Deleted layering ritual (${ideaId})`,
          changes: existing
            ? [`Removed pairing: ${existing.basePerfumeName} + ${existing.topPerfumeName}`]
            : [`Deleted layering idea ${ideaId}`],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [liveLayeringIdeas, requireOwnerUid, writeAuditLog]
  );

  const importStarterCombosAndLayering = useCallback(async (): Promise<number> => {
    const ownerUid = requireOwnerUid();
    const batch = writeBatch(db);
    try {
      for (const item of starterCombos) {
        batch.set(doc(db, 'combos', item.id), {
          title: item.title.slice(0, 140),
          subtitle: item.subtitle.slice(0, 300),
          perfumeNames: item.perfumeNames.slice(0, 6),
          sizeLabel: item.sizeLabel.slice(0, 60),
          regularPrice: item.regularPrice,
          comboPrice: item.comboPrice,
          tag: item.tag.slice(0, 40),
          featured: item.featured,
          active: item.active,
          ownerUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const idea of starterLayeringIdeas) {
        batch.set(doc(db, 'layeringIdeas', idea.id), {
          title: idea.title.slice(0, 140),
          vibe: idea.vibe.slice(0, 60),
          basePerfumeName: idea.basePerfumeName.slice(0, 140),
          topPerfumeName: idea.topPerfumeName.slice(0, 140),
          sprayRatio: idea.sprayRatio.slice(0, 80),
          occasion: idea.occasion.slice(0, 120),
          whyItWorks: idea.whyItWorks.slice(0, 500),
          active: idea.active,
          ownerUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await writeAuditLog({
        action: 'import',
        section: 'combo',
        targetId: 'starter-combos-layering',
        targetLabel: `Starter Combos & Layering (${starterCombos.length + starterLayeringIdeas.length})`,
        summary: `Imported ${starterCombos.length} combos and ${starterLayeringIdeas.length} layering ideas`,
        changes: [
          `Imported ${starterCombos.length} starter combo bundles`,
          `Imported ${starterLayeringIdeas.length} starter layering rituals`,
        ],
      });
      return starterCombos.length + starterLayeringIdeas.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'combos');
    }
  }, [requireOwnerUid, writeAuditLog]);

  const saveHamper = useCallback(
    async (input: GiftHamperInput, existingId?: string): Promise<string> => {
      const ownerUid = requireOwnerUid();
      const cleanTitle = sanitizeText(input.title, 140);
      if (!cleanTitle) throw new Error('Gift hamper title is required.');
      const cleanOccasion = sanitizeText(input.occasion, 60) || 'For Her';
      const cleanItems = input.itemsIncluded
        .map((item) => sanitizeText(item, 140))
        .filter(Boolean)
        .slice(0, 8);
      if (cleanItems.length < 1) {
        throw new Error('Add at least 1 included item to this gift hamper.');
      }
      const regularPrice = Math.min(100000, Math.max(0, Number(input.regularPrice || 0)));
      const hamperPrice = Math.min(regularPrice, Math.max(0, Number(input.hamperPrice || 0)));
      const cleanImage = (input.image.trim() || DEFAULT_HAMPER_IMAGE).slice(0, 500);

      const id = existingId || `hamper-${slugifyId(cleanTitle)}-${Date.now().toString(36)}`;
      const ref = doc(db, 'hampers', id);
      const path = `hampers/${id}`;
      const prevHamper = existingId
        ? liveHampers.find((h) => h.id === existingId)
        : undefined;

      const cleanHamper: GiftHamperInput = {
        title: cleanTitle,
        occasion: cleanOccasion,
        subtitle: sanitizeText(input.subtitle, 300),
        itemsIncluded: cleanItems,
        regularPrice,
        hamperPrice,
        image: cleanImage,
        giftWrapNote: sanitizeText(input.giftWrapNote, 200),
        availability: input.availability,
        featured: Boolean(input.featured),
        active: Boolean(input.active),
      };

      const mutablePayload = { ...cleanHamper, updatedAt: serverTimestamp() };
      try {
        if (existingId) {
          await setDoc(ref, mutablePayload, { merge: true });
        } else {
          await setDoc(ref, {
            ...mutablePayload,
            ownerUid,
            createdAt: serverTimestamp(),
          });
        }
        await writeAuditLog({
          action: existingId ? 'update' : 'create',
          section: 'hamper',
          targetId: id,
          targetLabel: cleanTitle,
          summary: existingId
            ? `Updated gift hamper "${cleanTitle}"`
            : `Created gift hamper "${cleanTitle}"`,
          changes: buildHamperDiff(prevHamper, cleanHamper),
        });
        return id;
      } catch (error) {
        handleFirestoreError(
          error,
          existingId ? OperationType.UPDATE : OperationType.CREATE,
          path
        );
      }
    },
    [liveHampers, requireOwnerUid, writeAuditLog]
  );

  const deleteHamper = useCallback(
    async (hamperId: string): Promise<void> => {
      requireOwnerUid();
      const path = `hampers/${hamperId}`;
      const existing = liveHampers.find((h) => h.id === hamperId);
      try {
        await deleteDoc(doc(db, 'hampers', hamperId));
        await writeAuditLog({
          action: 'delete',
          section: 'hamper',
          targetId: hamperId,
          targetLabel: existing?.title ?? hamperId,
          summary: existing
            ? `Deleted gift hamper "${existing.title}"`
            : `Deleted gift hamper (${hamperId})`,
          changes: existing
            ? [`Removed gift hamper (${existing.occasion}, E${existing.hamperPrice})`]
            : [`Deleted gift hamper ${hamperId}`],
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    [liveHampers, requireOwnerUid, writeAuditLog]
  );

  const importStarterHampers = useCallback(async (): Promise<number> => {
    const ownerUid = requireOwnerUid();
    const batch = writeBatch(db);
    try {
      for (const item of starterHampers) {
        batch.set(doc(db, 'hampers', item.id), {
          title: item.title.slice(0, 140),
          occasion: item.occasion.slice(0, 60),
          subtitle: item.subtitle.slice(0, 300),
          itemsIncluded: item.itemsIncluded.slice(0, 8).map((x) => x.slice(0, 140)),
          regularPrice: item.regularPrice,
          hamperPrice: item.hamperPrice,
          image: (item.image || DEFAULT_HAMPER_IMAGE).slice(0, 500),
          giftWrapNote: item.giftWrapNote.slice(0, 200),
          availability: item.availability,
          featured: item.featured,
          active: item.active,
          ownerUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
      await writeAuditLog({
        action: 'import',
        section: 'hamper',
        targetId: 'starter-hampers',
        targetLabel: `Starter Gift Hampers (${starterHampers.length})`,
        summary: `Imported ${starterHampers.length} starter gift hampers`,
        changes: [`Published ${starterHampers.length} starter gift hampers`],
      });
      return starterHampers.length;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'hampers');
    }
  }, [requireOwnerUid, writeAuditLog]);

  const value = useMemo<StoreContextValue>(
    () => ({
      user,
      authReady,
      isOwner,
      signInOwnerWithGoogle,
      signInOwnerWithPassword,
      sendOwnerPasswordReset,
      resendOwnerVerificationEmail,
      refreshAuthUser,
      setOwnerPasswordCredential,
      signOutOwner,
      signUpPartnerWithPassword,
      signInPartnerWithPassword,
      signInPartnerWithGoogle,
      sendPartnerPasswordReset,
      setPartnerPortalActive,
      partnerProfile,
      partnerProfileLoading,
      partnerReferral,
      partnerSales,
      partnerSalesLoading,
      submitPartnerApplication,
      updatePartnerProfile,
      partnerApplications,
      partnerApplicationsLoading,
      approvePartnerApplication,
      updatePartnerApplicationStatus,
      perfumes,
      livePerfumes,
      usingSampleFallback,
      catalogueLoading,
      catalogueComplete,
      catalogueHasMore,
      catalogueError,
      campaign,
      campaignLoading,
      coupons,
      couponsLoading,
      referrals,
      referralsLoading,
      referralAttributions,
      referralAttributionsLoading,
      referralSales,
      referralSalesLoading,
      auditLogs,
      auditLogsLoading,
      snapshotStatus,
      combos,
      liveCombos,
      usingSampleCombos,
      combosLoading,
      layeringIdeas,
      liveLayeringIdeas,
      usingSampleLayering,
      layeringLoading,
      hampers,
      liveHampers,
      usingSampleHampers,
      hampersLoading,
      weeklySpecial,
      weeklySpecialLoading,
      loadMorePerfumes,
      ensureAllPerfumesLoaded,
      ensureSecondaryLoaded,
      retryCatalogueSync,
      setAdminConsoleActive,
      publishCatalogueSnapshot,
      lookupCouponByCode,
      lookupReferralByCode,
      recordCheckoutReferralSale,
      savePerfume,
      deletePerfume,
      togglePerfumeSpecial,
      togglePerfumeNewArrival,
      importStarterCatalogue,
      saveCoupon,
      toggleCouponActive,
      deleteCoupon,
      saveReferral,
      toggleReferralActive,
      deleteReferral,
      approveReferralAttribution,
      dismissReferralAttribution,
      logManualReferralSale,
      updateReferralSaleStatus,
      deleteReferralSale,
      saveCampaign,
      saveWeeklySpecial,
      saveComboDeal,
      deleteComboDeal,
      saveLayeringIdea,
      deleteLayeringIdea,
      importStarterCombosAndLayering,
      saveHamper,
      deleteHamper,
      importStarterHampers,
    }),
    [
      user,
      authReady,
      isOwner,
      signInOwnerWithGoogle,
      signInOwnerWithPassword,
      sendOwnerPasswordReset,
      resendOwnerVerificationEmail,
      refreshAuthUser,
      setOwnerPasswordCredential,
      signOutOwner,
      signUpPartnerWithPassword,
      signInPartnerWithPassword,
      signInPartnerWithGoogle,
      sendPartnerPasswordReset,
      partnerProfile,
      partnerProfileLoading,
      partnerReferral,
      partnerSales,
      partnerSalesLoading,
      submitPartnerApplication,
      updatePartnerProfile,
      partnerApplications,
      partnerApplicationsLoading,
      approvePartnerApplication,
      updatePartnerApplicationStatus,
      perfumes,
      livePerfumes,
      usingSampleFallback,
      catalogueLoading,
      catalogueComplete,
      catalogueHasMore,
      catalogueError,
      campaign,
      campaignLoading,
      coupons,
      couponsLoading,
      referrals,
      referralsLoading,
      referralAttributions,
      referralAttributionsLoading,
      referralSales,
      referralSalesLoading,
      auditLogs,
      auditLogsLoading,
      snapshotStatus,
      combos,
      liveCombos,
      usingSampleCombos,
      combosLoading,
      layeringIdeas,
      liveLayeringIdeas,
      usingSampleLayering,
      layeringLoading,
      hampers,
      liveHampers,
      usingSampleHampers,
      hampersLoading,
      weeklySpecial,
      weeklySpecialLoading,
      loadMorePerfumes,
      ensureAllPerfumesLoaded,
      ensureSecondaryLoaded,
      retryCatalogueSync,
      publishCatalogueSnapshot,
      lookupCouponByCode,
      lookupReferralByCode,
      recordCheckoutReferralSale,
      savePerfume,
      deletePerfume,
      togglePerfumeSpecial,
      togglePerfumeNewArrival,
      importStarterCatalogue,
      saveCoupon,
      toggleCouponActive,
      deleteCoupon,
      saveReferral,
      toggleReferralActive,
      deleteReferral,
      approveReferralAttribution,
      dismissReferralAttribution,
      logManualReferralSale,
      updateReferralSaleStatus,
      deleteReferralSale,
      saveCampaign,
      saveWeeklySpecial,
      saveComboDeal,
      deleteComboDeal,
      saveLayeringIdea,
      deleteLayeringIdea,
      importStarterCombosAndLayering,
      saveHamper,
      deleteHamper,
      importStarterHampers,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used inside a StoreProvider.');
  }
  return ctx;
}

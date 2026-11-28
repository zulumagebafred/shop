import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Crown,
  Edit3,
  Eye,
  EyeOff,
  Flame,
  Gift,
  History,
  KeyRound,
  Layers,
  Link2,
  Lock,
  LogOut,
  Mail,
  MailCheck,
  MoreVertical,
  Package,
  Percent,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { AdminOfflineIndicator, AdminPWAInstallButton } from '../components/AdminPWAControls';
import { ResilientImage } from '../components/ResilientImage';
import { SearchablePerfumeSelect } from '../components/SearchablePerfumeSelect';
import { formatPrice, getConfiguredPortalSlug, siteConfig } from '../config/siteConfig';
import { PerfumeInput, useStore } from '../context/StoreContext';
import { featuredPerfumeHouses, houseImages } from '../data/catalogue';
import {
  DEFAULT_HAMPER_IMAGE,
  GIFT_HAMPER_OCCASIONS,
  HER_HAMPER_IMAGE,
  HIM_HAMPER_IMAGE,
} from '../data/hampers';
import { isAuthorizedAdminEmail } from '../lib/firebase';
import { lockPWAInstall, unlockPWAInstallForAdmin } from '../hooks/usePWAInstall';
import {
  AuditAction,
  AuditLogEntry,
  AuditSection,
  AvailabilityStatus,
  BottleSize,
  BranchId,
  ComboDeal,
  Coupon,
  CouponDiscountType,
  CouponScope,
  FragranceCategory,
  FragranceProduct,
  GiftHamper,
  HeroDisplayMode,
  LayeringIdea,
  ReferralAttribution,
  ReferralCommissionType,
  ReferralFollowerDiscountType,
  ReferralPartnerProfile,
  ReferralPartnerStatus,
  ReferralSale,
  ReferralSaleStatus,
  InfluencerReferral,
  STANDARD_BOTTLE_SIZES,
  SizeOption,
  SpecialCampaign,
  SpecialDiscountType,
  WeeklyFiveMlAudience,
  WeeklyFiveMlSpecial,
} from '../types/fragrance';
import { deriveAdminUsername } from '../utils/auditDiff';
import {
  PartnerApprovalEmailContent,
  dispatchPartnerApprovalEmail,
  isAutoPartnerEmailConfigured,
} from '../utils/partnerEmail';
import { sanitizePromoCode } from '../utils/sanitize';
import {
  ALL_BRANCH_IDS,
  getAvailableBranches,
  getBranchAvailabilityLabel,
  isAvailableAtBranch,
  normalizeBranches,
} from '../utils/branches';
import {
  calculateReferralCommission,
  formatSpecialDiscountTag,
  getEffectiveUnitPrice,
  getProductPriceSummary,
  getSpecialTargetSizeOption,
} from '../utils/pricing';
import {
  getWeekWindowBounds,
  pickRandomWeeklyAudienceIds,
  resolveWeeklyFiveMlSelection,
} from '../utils/weeklySpecial';

interface AdminDashboardPageProps {
  onBackToStorefront: () => void;
  onNotify: (title: string, subtitle: string) => void;
}

type AdminTab =
  | 'perfumes'
  | 'specials'
  | 'combos'
  | 'hampers'
  | 'coupons'
  | 'referrals'
  | 'audit';
type InventoryFilter =
  | 'all'
  | 'Men'
  | 'Women'
  | 'Unisex'
  | 'Kiddies'
  | 'manzini'
  | 'mbabane'
  | 'unboxed'
  | 'specials'
  | 'new-arrivals'
  | 'low-stock';
type InventorySort = 'name-asc' | 'brand-asc' | 'price-desc' | 'price-asc';

const DEFAULT_EDITOR_SIZES: BottleSize[] = ['5ml', '10ml', '22ml', '100ml'];

function buildInitialSizes(existing?: SizeOption[]): SizeOption[] {
  if (existing && existing.length > 0) {
    return existing.map((s) => ({
      size: s.size,
      price: s.price,
      available: s.available,
    }));
  }
  return DEFAULT_EDITOR_SIZES.map((size) => ({
    size,
    price: null,
    available: true,
  }));
}

function extractReadableError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const raw = err.message.trim();
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed.error) return parsed.error;
    } catch {
      // Ignore JSON parse errors
    }
  }
  return raw || fallback;
}

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

function getCountdownParts(targetIso: string, nowMs: number) {
  if (!targetIso) {
    return { days: '--', hours: '--', minutes: '--', seconds: '--', hasTimer: false, ended: false };
  }
  const targetMs = new Date(targetIso).getTime();
  if (Number.isNaN(targetMs)) {
    return { days: '--', hours: '--', minutes: '--', seconds: '--', hasTimer: false, ended: false };
  }
  const diffMs = Math.max(0, targetMs - nowMs);
  return {
    days: String(Math.floor(diffMs / 86400000)).padStart(2, '0'),
    hours: String(Math.floor((diffMs % 86400000) / 3600000)).padStart(2, '0'),
    minutes: String(Math.floor((diffMs % 3600000) / 60000)).padStart(2, '0'),
    seconds: String(Math.floor((diffMs % 60000) / 1000)).padStart(2, '0'),
    hasTimer: true,
    ended: diffMs === 0,
  };
}

function toLocalDateTimeInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatRemainingSummary(iso: string, nowMs: number): string {
  if (!iso) return 'No timer set yet (storefront falls back to end of current week).';
  const ms = new Date(iso).getTime() - nowMs;
  if (Number.isNaN(ms)) return 'Invalid date';
  if (ms <= 0) return 'Countdown has ended — select a new duration below.';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${d}d ${h}h ${m}m left · Ends ${new Date(iso).toLocaleString()}`;
}

function getAvailabilityBadgeClass(status: AvailabilityStatus): string {
  if (status === 'Low Stock') return 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]';
  if (status === 'Out of Stock') return 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]';
  if (status === 'Pre-Order') return 'bg-[#F4F4F5] text-[#0A0A0A] border-[#D4D4D4]';
  return 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]';
}

const AdminCountdownCards: React.FC<{ endsAt: string }> = React.memo(({ endsAt }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const countdown = getCountdownParts(endsAt, nowMs);
  return (
    <div className="flex items-center gap-2">
      {[
        { label: 'Days', val: countdown.days },
        { label: 'Hours', val: countdown.hours },
        { label: 'Mins', val: countdown.minutes },
        { label: 'Secs', val: countdown.seconds },
      ].map((unit) => (
        <div
          key={unit.label}
          className="flex-1 py-2 rounded-xl bg-white/[0.06] border border-[#FACC15]/50 text-center"
        >
          <span className="block text-lg font-bold tabular-nums leading-none text-white">
            {unit.val}
          </span>
          <span className="mt-1 block text-[8px] uppercase tracking-widest text-white/65">
            {unit.label}
          </span>
        </div>
      ))}
    </div>
  );
});

const AdminCountdownBadge: React.FC<{ endsAt: string }> = React.memo(({ endsAt }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);
  const countdown = getCountdownParts(endsAt, nowMs);
  return (
    <span className="mt-0.5 block text-[11px] text-[#525252] truncate">
      {countdown.hasTimer && !countdown.ended
        ? `${countdown.days}d ${countdown.hours}h left`
        : 'Configure timer'}
    </span>
  );
});

const AdminCountdownHint: React.FC<{ endsAt: string }> = React.memo(({ endsAt }) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <p className="text-[11px] text-[#525252] leading-relaxed">
      {formatRemainingSummary(endsAt, nowMs)}
    </p>
  );
});

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onBackToStorefront,
  onNotify,
}) => {
  const {
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
    perfumes,
    livePerfumes,
    catalogueLoading,
    catalogueComplete,
    catalogueError,
    campaign,
    weeklySpecial,
    coupons,
    couponsLoading,
    referrals,
    referralsLoading,
    partnerApplications,
    partnerApplicationsLoading,
    referralAttributions,
    referralAttributionsLoading,
    referralSales,
    referralSalesLoading,
    auditLogs,
    auditLogsLoading,
    liveCombos,
    combosLoading,
    liveLayeringIdeas,
    layeringLoading,
    liveHampers,
    hampersLoading,
    snapshotStatus,
    setAdminConsoleActive,
    publishCatalogueSnapshot,
    ensureAllPerfumesLoaded,
    ensureSecondaryLoaded,
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
    approvePartnerApplication,
    updatePartnerApplicationStatus,
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
  } = useStore();

  const [publishingSnapshot, setPublishingSnapshot] = useState(false);
  const [mobileHeaderMenuOpen, setMobileHeaderMenuOpen] = useState(false);

  useEffect(() => {
    setAdminConsoleActive(true);
    void ensureAllPerfumesLoaded();
    void ensureSecondaryLoaded('combos');
    void ensureSecondaryLoaded('layering');
    void ensureSecondaryLoaded('hampers');
    return () => {
      setAdminConsoleActive(false);
    };
  }, [setAdminConsoleActive, ensureAllPerfumesLoaded, ensureSecondaryLoaded]);

  // Unlock PWA install only when the signed-in user is a verified admin
  useEffect(() => {
    if (isOwner) {
      unlockPWAInstallForAdmin();
    } else {
      lockPWAInstall();
    }
  }, [isOwner]);

  const handlePublishSnapshotClick = async () => {
    setPublishingSnapshot(true);
    try {
      const res = await publishCatalogueSnapshot();
      if (res.ok) {
        onNotify(
          '1-Read Storefront Cache Synced',
          `${res.count} perfumes packed into ${(res.bytes / 1024).toFixed(1)} KB.`
        );
      } else {
        onNotify('Cache Sync Skipped', 'Ensure catalogue is loaded and you are signed in.');
      }
    } catch {
      onNotify('Cache Sync Failed', 'Could not update the public catalogue snapshot.');
    } finally {
      setPublishingSnapshot(false);
    }
  };

  const [activeTab, setActiveTab] = useState<AdminTab>('perfumes');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActorFilter, setAuditActorFilter] = useState('ALL');
  const [auditSectionFilter, setAuditSectionFilter] = useState<'all' | AuditSection>('all');
  const [auditActionFilter, setAuditActionFilter] = useState<'all' | AuditAction>('all');

  const currentAdminUsername = useMemo(
    () => deriveAdminUsername(user?.email, user?.displayName),
    [user?.email, user?.displayName]
  );

  const auditActors = useMemo(() => {
    const counts = new Map<string, { username: string; email: string; count: number }>();
    for (const log of auditLogs) {
      const key = log.actorUsername || log.actorEmail || 'admin';
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          username: log.actorUsername || 'admin',
          email: log.actorEmail,
          count: 1,
        });
      }
    }
    return Array.from(counts.entries()).map(([key, info]) => ({ key, ...info }));
  }, [auditLogs]);

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      if (
        auditActorFilter !== 'ALL' &&
        (entry.actorUsername || entry.actorEmail || 'admin') !== auditActorFilter
      ) {
        return false;
      }
      if (auditSectionFilter !== 'all' && entry.section !== auditSectionFilter) {
        return false;
      }
      if (auditActionFilter !== 'all' && entry.action !== auditActionFilter) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        entry.actorUsername,
        entry.actorEmail,
        entry.targetLabel,
        entry.summary,
        entry.section,
        entry.action,
        ...entry.changes,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [auditLogs, auditSearch, auditActorFilter, auditSectionFilter, auditActionFilter]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signingInPassword, setSigningInPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [sendingVerification, setSendingVerification] = useState(false);
  const [refreshingAuth, setRefreshingAuth] = useState(false);

  // Set/Update Owner Password Modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [newOwnerPassword, setNewOwnerPassword] = useState('');
  const [confirmOwnerPassword, setConfirmOwnerPassword] = useState('');
  const [showNewOwnerPassword, setShowNewOwnerPassword] = useState(false);
  const [savingOwnerPassword, setSavingOwnerPassword] = useState(false);
  const [passwordModalError, setPasswordModalError] = useState<string | null>(null);
  const [copiedPortalLink, setCopiedPortalLink] = useState(false);

  const handleCopyPrivatePortalLink = async () => {
    try {
      const slug =
        getConfiguredPortalSlug() ?? window.location.hash.replace(/^#/, '').trim();
      const url = slug
        ? `${window.location.origin}/#${slug}`
        : `${window.location.origin}${window.location.pathname}${window.location.hash}`;
      await navigator.clipboard.writeText(url);
      setCopiedPortalLink(true);
      onNotify(
        'Private Link Copied',
        slug ? `Saved to clipboard: /#${slug}` : 'Current admin link saved to clipboard.'
      );
      window.setTimeout(() => setCopiedPortalLink(false), 2200);
    } catch {
      // Ignore clipboard permission denial
    }
  };

  // Stable mount timestamp for weekly 5ml window calculation (avoids 1-second full-page re-renders)
  const [mountNowMs] = useState(() => Date.now());

  // Inventory filters & inline actions
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('all');
  const [inventorySort, setInventorySort] = useState<InventorySort>('name-asc');
  const [inventoryVisibleCount, setInventoryVisibleCount] = useState(40);
  const [confirmDeletePerfumeId, setConfirmDeletePerfumeId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [importingStarter, setImportingStarter] = useState(false);

  // Perfume Editor Modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPerfumeId, setEditingPerfumeId] = useState<string | null>(null);
  const [savingPerfume, setSavingPerfume] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [pName, setPName] = useState('');
  const [pBrandSelect, setPBrandSelect] = useState(featuredPerfumeHouses[0]);
  const [pCustomBrand, setPCustomBrand] = useState('');
  const [pCategory, setPCategory] = useState<FragranceCategory>('Unisex');
  const [pConcentration, setPConcentration] = useState('Eau de Parfum');
  const [pAvailability, setPAvailability] = useState<AvailabilityStatus>('In Stock');
  const [pBranches, setPBranches] = useState<BranchId[]>(['manzini', 'mbabane']);
  const [pDescription, setPDescription] = useState('');
  const [pImage, setPImage] = useState(houseImages[featuredPerfumeHouses[0]]);
  const [pTopNotes, setPTopNotes] = useState('');
  const [pHeartNotes, setPHeartNotes] = useState('');
  const [pBaseNotes, setPBaseNotes] = useState('');
  const [pSizes, setPSizes] = useState<SizeOption[]>(buildInitialSizes());
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [pFeatured, setPFeatured] = useState(true);
  const [pBestseller, setPBestseller] = useState(false);
  const [pUnboxed, setPUnboxed] = useState(false);
  const [pIsNewArrival, setPIsNewArrival] = useState(false);
  const [pOnSpecial, setPOnSpecial] = useState(false);
  const [pSpecialLabel, setPSpecialLabel] = useState('Black Friday Special');
  const [pSpecialDiscountType, setPSpecialDiscountType] =
    useState<SpecialDiscountType>('percentage');
  const [pSpecialDiscount, setPSpecialDiscount] = useState('20');
  const [pSpecialDiscountAmount, setPSpecialDiscountAmount] = useState('100');

  // Campaign state
  const [campaignDraft, setCampaignDraft] = useState<SpecialCampaign>(campaign);
  const [campaignSyncedOnce, setCampaignSyncedOnce] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyFiveMlSpecial>(weeklySpecial);
  const [weeklyAudienceTab, setWeeklyAudienceTab] = useState<WeeklyFiveMlAudience>('Women');
  const [savingWeeklySpecial, setSavingWeeklySpecial] = useState(false);
  const [exclusivePickerId, setExclusivePickerId] = useState('');
  const [exclusivePickerSize, setExclusivePickerSize] = useState('5ml');
  const [exclusivePickerCustomMode, setExclusivePickerCustomMode] = useState(false);
  const [exclusivePickerPrice, setExclusivePickerPrice] = useState('35');
  const [exclusiveCustomRowIds, setExclusiveCustomRowIds] = useState<Record<string, boolean>>({});
  const [savingExclusiveSpecial, setSavingExclusiveSpecial] = useState(false);
  const [applyingBulkSpecial, setApplyingBulkSpecial] = useState(false);
  const [bulkSpecialType, setBulkSpecialType] =
    useState<SpecialDiscountType>('percentage');
  const [bulkSpecialDiscount, setBulkSpecialDiscount] = useState('20');
  const [customDurationDays, setCustomDurationDays] = useState('7');
  const [specialPickerSearch, setSpecialPickerSearch] = useState('');
  const [specialPickerVisibleCount, setSpecialPickerVisibleCount] = useState(24);
  const [newArrivalPickerSearch, setNewArrivalPickerSearch] = useState('');
  const deferredInventorySearch = useDeferredValue(inventorySearch);
  const deferredSpecialPickerSearch = useDeferredValue(specialPickerSearch);
  const deferredNewArrivalPickerSearch = useDeferredValue(newArrivalPickerSearch);
  const [discountEdits, setDiscountEdits] = useState<
    Record<string, { type: SpecialDiscountType; value: string }>
  >({});

  useEffect(() => {
    if (!campaignSyncedOnce) {
      setCampaignDraft(campaign);
      setCampaignSyncedOnce(true);
    }
  }, [campaign, campaignSyncedOnce]);

  useEffect(() => {
    setCampaignDraft(campaign);
  }, [campaign]);

  useEffect(() => {
    setWeeklyDraft(weeklySpecial);
  }, [weeklySpecial]);

  // Close editor modal cleanly with Escape
  useEffect(() => {
    if (!editorOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditorOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editorOpen]);

  // Coupon state
  const [editingCouponCode, setEditingCouponCode] = useState<string | null>(null);
  const [cCode, setCCode] = useState('');
  const [cDescription, setCDescription] = useState('');
  const [cType, setCType] = useState<CouponDiscountType>('percentage');
  const [cValue, setCValue] = useState('15');
  const [cMinSpend, setCMinSpend] = useState('0');
  const [cScope, setCScope] = useState<CouponScope>('all');
  const [cActive, setCActive] = useState(true);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [confirmDeleteCoupon, setConfirmDeleteCoupon] = useState<string | null>(null);
  const [copiedCouponCode, setCopiedCouponCode] = useState<string | null>(null);
  const [copiedCaptionCode, setCopiedCaptionCode] = useState<string | null>(null);

  // Influencer Referral & Commission state
  const [editingReferralCode, setEditingReferralCode] = useState<string | null>(null);
  const [rCode, setRCode] = useState('');
  const [rInfluencerName, setRInfluencerName] = useState('');
  const [rSocialHandle, setRSocialHandle] = useState('');
  const [rCommissionType, setRCommissionType] = useState<ReferralCommissionType>('percentage');
  const [rCommissionValue, setRCommissionValue] = useState('10');
  const [rFollowerDiscountType, setRFollowerDiscountType] =
    useState<ReferralFollowerDiscountType>('none');
  const [rFollowerDiscountValue, setRFollowerDiscountValue] = useState('0');
  const [rPayoutNote, setRPayoutNote] = useState('');
  const [rActive, setRActive] = useState(true);
  const [savingReferral, setSavingReferral] = useState(false);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [confirmDeleteReferralCode, setConfirmDeleteReferralCode] = useState<string | null>(null);
  const [copiedReferralLinkCode, setCopiedReferralLinkCode] = useState<string | null>(null);
  const [copiedReferralPostCode, setCopiedReferralPostCode] = useState<string | null>(null);

  // Partner Applications approval drafts
  const [partnerDrafts, setPartnerDrafts] = useState<
    Record<
      string,
      {
        code: string;
        commissionType: ReferralCommissionType;
        commissionValue: string;
        followerDiscountType: ReferralFollowerDiscountType;
        followerDiscountValue: string;
        active: boolean;
      }
    >
  >({});
  const [approvingPartnerUid, setApprovingPartnerUid] = useState<string | null>(null);
  const [updatingPartnerStatusUid, setUpdatingPartnerStatusUid] = useState<string | null>(null);
  const [sendingEmailPartnerUid, setSendingEmailPartnerUid] = useState<string | null>(null);
  const [partnerEmailNotices, setPartnerEmailNotices] = useState<
    Record<
      string,
      {
        status: 'sent' | 'manual-ready' | 'failed';
        error?: string;
        content: PartnerApprovalEmailContent;
        copied?: boolean;
      }
    >
  >({});

  const getPartnerDraft = (partner: ReferralPartnerProfile) => {
    const existing = partnerDrafts[partner.uid];
    if (existing) return existing;
    const defaultCode =
      sanitizePromoCode(partner.assignedCode || partner.requestedCode) ||
      sanitizePromoCode(partner.displayName.split(/\s+/)[0] || '').slice(0, 12);
    return {
      code: defaultCode,
      commissionType: 'percentage' as ReferralCommissionType,
      commissionValue: '10',
      followerDiscountType: 'none' as ReferralFollowerDiscountType,
      followerDiscountValue: '0',
      active: true,
    };
  };

  const updatePartnerDraft = (
    uid: string,
    partner: ReferralPartnerProfile,
    patch: Partial<{
      code: string;
      commissionType: ReferralCommissionType;
      commissionValue: string;
      followerDiscountType: ReferralFollowerDiscountType;
      followerDiscountValue: string;
      active: boolean;
    }>
  ) => {
    setPartnerDrafts((prev) => ({
      ...prev,
      [uid]: {
        ...(prev[uid] ?? getPartnerDraft(partner)),
        ...patch,
      },
    }));
  };

  // Manual Referral Sale logging & ledger filters
  const [saleReferralCode, setSaleReferralCode] = useState('');
  const [saleOrderSummary, setSaleOrderSummary] = useState('');
  const [saleSubtotal, setSaleSubtotal] = useState('');
  const [saleDiscount, setSaleDiscount] = useState('0');
  const [saleCustomerRef, setSaleCustomerRef] = useState('');
  const [saleStatus, setSaleStatus] = useState<ReferralSaleStatus>('confirmed');
  const [savingSale, setSavingSale] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [ledgerCodeFilter, setLedgerCodeFilter] = useState<string>('ALL');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState<'all' | ReferralSaleStatus>('all');
  const [confirmDeleteSaleId, setConfirmDeleteSaleId] = useState<string | null>(null);

  // Combo Deal & Layering Idea Editor state
  const [editingComboId, setEditingComboId] = useState<string | null>(null);
  const [comboTitle, setComboTitle] = useState('');
  const [comboSubtitle, setComboSubtitle] = useState('');
  const [comboPerfumesText, setComboPerfumesText] = useState('');
  const [comboSizeLabel, setComboSizeLabel] = useState('2 × 30ml / Duo Pack');
  const [comboRegularPrice, setComboRegularPrice] = useState('600');
  const [comboPrice, setComboPrice] = useState('550');
  const [comboTag, setComboTag] = useState('Save E50');
  const [comboFeatured, setComboFeatured] = useState(true);
  const [comboActive, setComboActive] = useState(true);
  const [savingCombo, setSavingCombo] = useState(false);
  const [comboError, setComboError] = useState<string | null>(null);
  const [confirmDeleteComboId, setConfirmDeleteComboId] = useState<string | null>(null);

  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [layerTitle, setLayerTitle] = useState('');
  const [layerVibe, setLayerVibe] = useState('');
  const [layerBasePerfume, setLayerBasePerfume] = useState('');
  const [layerTopPerfume, setLayerTopPerfume] = useState('');
  const [layerSprayRatio, setLayerSprayRatio] = useState('2 sprays base · 2 sprays top');
  const [layerOccasion, setLayerOccasion] = useState('Evening & Date Night');
  const [layerWhyItWorks, setLayerWhyItWorks] = useState('');
  const [layerActive, setLayerActive] = useState(true);
  const [savingLayer, setSavingLayer] = useState(false);
  const [layerError, setLayerError] = useState<string | null>(null);
  const [confirmDeleteLayerId, setConfirmDeleteLayerId] = useState<string | null>(null);
  const [importingCombosStarter, setImportingCombosStarter] = useState(false);

  // Gift Hamper Editor state
  const [editingHamperId, setEditingHamperId] = useState<string | null>(null);
  const [hTitle, setHTitle] = useState('');
  const [hOccasion, setHOccasion] = useState(GIFT_HAMPER_OCCASIONS[0]);
  const [hSubtitle, setHSubtitle] = useState('');
  const [hItemsText, setHItemsText] = useState(
    '100ml Arabian Fragrance Bottle\nMatching Body Mist\nRibbon Presentation Box & Gift Card'
  );
  const [hRegularPrice, setHRegularPrice] = useState('1250');
  const [hHamperPrice, setHHamperPrice] = useState('990');
  const [hImage, setHImage] = useState(DEFAULT_HAMPER_IMAGE);
  const [hGiftWrapNote, setHGiftWrapNote] = useState('Includes complimentary satin ribbon box & card');
  const [hAvailability, setHAvailability] = useState<AvailabilityStatus>('In Stock');
  const [hFeatured, setHFeatured] = useState(true);
  const [hActive, setHActive] = useState(true);
  const [savingHamper, setSavingHamper] = useState(false);
  const [hamperError, setHamperError] = useState<string | null>(null);
  const [confirmDeleteHamperId, setConfirmDeleteHamperId] = useState<string | null>(null);
  const [importingHampersStarter, setImportingHampersStarter] = useState(false);

  // Combo Catalogue Picker state
  const [comboPickerSearch, setComboPickerSearch] = useState('');
  const [selectedComboPicks, setSelectedComboPicks] = useState<
    { key: string; name: string; size: string; price: number | null }[]
  >([]);

  const catalogForBuilders = livePerfumes.length > 0 ? livePerfumes : perfumes;

  const comboPickerMatches = useMemo(() => {
    const q = comboPickerSearch.trim().toLowerCase();
    return catalogForBuilders
      .filter((p) => p.availability !== 'Out of Stock')
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      )
      .slice(0, 18);
  }, [catalogForBuilders, comboPickerSearch]);

  const specialPerfumes = useMemo(
    () => livePerfumes.filter((p) => Boolean(p.onSpecial)),
    [livePerfumes]
  );

  const unboxedPerfumes = useMemo(
    () => livePerfumes.filter((p) => Boolean(p.isUnboxed)),
    [livePerfumes]
  );

  const newArrivalPerfumes = useMemo(
    () => livePerfumes.filter((p) => Boolean(p.isNewArrival)),
    [livePerfumes]
  );

  const stockAlertPerfumes = useMemo(
    () =>
      livePerfumes.filter(
        (p) => p.availability === 'Low Stock' || p.availability === 'Out of Stock'
      ),
    [livePerfumes]
  );

  const nonSpecialPerfumes = useMemo(() => {
    const q = deferredSpecialPickerSearch.trim().toLowerCase();
    return livePerfumes.filter((p) => {
      if (p.onSpecial) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [livePerfumes, deferredSpecialPickerSearch]);

  useEffect(() => {
    setSpecialPickerVisibleCount(24);
  }, [deferredSpecialPickerSearch]);

  const visibleNonSpecialPerfumes = useMemo(
    () => nonSpecialPerfumes.slice(0, specialPickerVisibleCount),
    [nonSpecialPerfumes, specialPickerVisibleCount]
  );

  const nonNewArrivalPerfumes = useMemo(() => {
    const q = deferredNewArrivalPickerSearch.trim().toLowerCase();
    return livePerfumes.filter((p) => {
      if (p.isNewArrival) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [livePerfumes, deferredNewArrivalPickerSearch]);

  const filteredLivePerfumes = useMemo(() => {
    const q = deferredInventorySearch.trim().toLowerCase();
    const list = livePerfumes.filter((p) => {
      if (inventoryFilter === 'Men' && p.category !== 'Men') return false;
      if (inventoryFilter === 'Women' && p.category !== 'Women') return false;
      if (inventoryFilter === 'Unisex' && p.category !== 'Unisex') return false;
      if (inventoryFilter === 'Kiddies' && p.category !== 'Kiddies') return false;
      if (inventoryFilter === 'manzini' && !isAvailableAtBranch(p, 'manzini')) return false;
      if (inventoryFilter === 'mbabane' && !isAvailableAtBranch(p, 'mbabane')) return false;
      if (inventoryFilter === 'unboxed' && !p.isUnboxed) return false;
      if (inventoryFilter === 'specials' && !p.onSpecial) return false;
      if (inventoryFilter === 'new-arrivals' && !p.isNewArrival) return false;
      if (
        inventoryFilter === 'low-stock' &&
        p.availability !== 'Low Stock' &&
        p.availability !== 'Out of Stock'
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.availability.toLowerCase().includes(q) ||
        getBranchAvailabilityLabel(p).toLowerCase().includes(q) ||
        (p.isUnboxed && 'unboxed'.includes(q))
      );
    });

    const sorted = [...list];
    if (inventorySort === 'price-desc' || inventorySort === 'price-asc') {
      const priceMap = new Map<string, number>();
      for (const item of sorted) {
        priceMap.set(item.id, getProductPriceSummary(item).highestEffective ?? 0);
      }
      sorted.sort((a, b) => {
        const pa = priceMap.get(a.id) ?? 0;
        const pb = priceMap.get(b.id) ?? 0;
        return inventorySort === 'price-desc' ? pb - pa : pa - pb;
      });
    } else if (inventorySort === 'brand-asc') {
      sorted.sort(
        (a, b) => a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name)
      );
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [livePerfumes, deferredInventorySearch, inventoryFilter, inventorySort]);

  useEffect(() => {
    setInventoryVisibleCount(40);
  }, [deferredInventorySearch, inventoryFilter, inventorySort]);

  const visibleLivePerfumes = useMemo(
    () => filteredLivePerfumes.slice(0, inventoryVisibleCount),
    [filteredLivePerfumes, inventoryVisibleCount]
  );

  const mapFirebaseAuthError = (err: unknown, fallback: string): string => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('auth/operation-not-allowed')) {
      return 'Email/Password sign-in is disabled in Firebase Console. Enable it under Authentication → Sign-in method → Email/Password, then try signing in again.';
    }
    if (
      msg.includes('auth/invalid-credential') ||
      msg.includes('auth/wrong-password') ||
      msg.includes('auth/user-not-found')
    ) {
      return 'Incorrect email or password. Double-check your authorized admin email and password, or click "Reset / Set Password" to set a new password via email.';
    }
    if (msg.includes('auth/popup-blocked') || msg.includes('auth/popup-closed-by-user')) {
      return 'Google popup was blocked or closed. Use the email + password form above instead (works on any device without popups).';
    }
    if (msg.includes('auth/too-many-requests')) {
      return 'Too many sign-in attempts. Please wait a few minutes before trying again.';
    }
    if (msg.includes('auth/requires-recent-login')) {
      return 'For security, please sign out and sign back in right before updating your password.';
    }
    return msg || fallback;
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthNotice(null);
    setSigningIn(true);
    try {
      await signInOwnerWithGoogle();
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'Unable to complete Google sign-in.'));
    } finally {
      setSigningIn(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    if (!loginId.trim()) {
      setAuthError('Enter your authorized admin email.');
      return;
    }
    if (!loginPassword) {
      setAuthError('Enter your password.');
      return;
    }
    setSigningInPassword(true);
    try {
      await signInOwnerWithPassword(loginId, loginPassword);
      setLoginPassword('');
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'Unable to sign in with password.'));
    } finally {
      setSigningInPassword(false);
    }
  };

  const handleSendPasswordReset = async () => {
    setAuthError(null);
    setAuthNotice(null);
    if (!loginId.trim()) {
      setAuthError('Enter your authorized admin email first, then click Reset / Set Password.');
      return;
    }
    const targetLogin = loginId.trim();
    setSendingReset(true);
    try {
      const sentEmail = await sendOwnerPasswordReset(targetLogin);
      setAuthNotice(
        `Password setup/reset email sent to ${sentEmail}. Open the link in your email to set your password, then sign in on any device.`
      );
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'Could not send password reset email.'));
    } finally {
      setSendingReset(false);
    }
  };

  const handleSendVerificationEmail = async () => {
    setAuthError(null);
    setAuthNotice(null);
    setSendingVerification(true);
    try {
      await resendOwnerVerificationEmail();
      setAuthNotice(
        `Verification link sent to ${user?.email ?? 'your authorized admin email'}. Click the link in your email, then tap "I've Verified — Refresh".`
      );
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'Unable to send verification email.'));
    } finally {
      setSendingVerification(false);
    }
  };

  const handleRefreshVerification = async () => {
    setAuthError(null);
    setAuthNotice(null);
    setRefreshingAuth(true);
    try {
      const verified = await refreshAuthUser();
      if (!verified) {
        setAuthError('Email is still not marked verified yet. Click the verification link sent to your inbox first.');
      } else {
        onNotify('Owner Verified', 'Admin access unlocked.');
      }
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'Could not refresh verification status.'));
    } finally {
      setRefreshingAuth(false);
    }
  };

  const handleSaveOwnerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordModalError(null);
    if (newOwnerPassword.length < 6) {
      setPasswordModalError('Password must be at least 6 characters.');
      return;
    }
    if (newOwnerPassword !== confirmOwnerPassword) {
      setPasswordModalError('Passwords do not match.');
      return;
    }
    setSavingOwnerPassword(true);
    try {
      await setOwnerPasswordCredential(newOwnerPassword);
      setPasswordModalOpen(false);
      setNewOwnerPassword('');
      setConfirmOwnerPassword('');
      onNotify(
        'Admin Password Saved',
        'You can now log in manually from any device using your admin email and this password.'
      );
    } catch (err) {
      setPasswordModalError(
        mapFirebaseAuthError(err, 'Could not save password.')
      );
    } finally {
      setSavingOwnerPassword(false);
    }
  };

  const openCreatePerfume = () => {
    setEditingPerfumeId(null);
    setFormError(null);
    setPName('');
    setPBrandSelect(featuredPerfumeHouses[0]);
    setPCustomBrand('');
    setPCategory('Unisex');
    setPConcentration('Eau de Parfum');
    setPAvailability('In Stock');
    setPBranches(['manzini', 'mbabane']);
    setPDescription('');
    setPImage(houseImages[featuredPerfumeHouses[0]]);
    setPTopNotes('');
    setPHeartNotes('');
    setPBaseNotes('');
    setPSizes(buildInitialSizes());
    setCustomSizeInput('');
    setPFeatured(false);
    setPBestseller(false);
    setPUnboxed(false);
    setPIsNewArrival(false);
    setPOnSpecial(false);
    setPSpecialLabel(campaign.badgeText || 'Black Friday Special');
    setPSpecialDiscountType('percentage');
    setPSpecialDiscount('20');
    setPSpecialDiscountAmount('100');
    setEditorOpen(true);
  };

  const openEditPerfume = (p: FragranceProduct) => {
    setEditingPerfumeId(p.id);
    setFormError(null);
    setPName(p.name);
    const isKnownHouse = featuredPerfumeHouses.includes(p.brand);
    setPBrandSelect(isKnownHouse ? p.brand : 'Custom');
    setPCustomBrand(isKnownHouse ? '' : p.brand);
    setPCategory(p.category);
    setPConcentration(p.concentration);
    setPAvailability(p.availability);
    const activeBranches = getAvailableBranches(p);
    setPBranches(
      p.availability === 'Out of Stock'
        ? []
        : activeBranches.length > 0
        ? activeBranches
        : ['manzini', 'mbabane']
    );
    setPDescription(p.description);
    setPImage(p.image);
    setPTopNotes(p.notes.top.join(', '));
    setPHeartNotes(p.notes.heart.join(', '));
    setPBaseNotes(p.notes.base.join(', '));
    setPSizes(buildInitialSizes(p.sizes));
    setCustomSizeInput('');
    setPFeatured(p.featured);
    setPBestseller(p.bestseller);
    setPUnboxed(Boolean(p.isUnboxed));
    setPIsNewArrival(Boolean(p.isNewArrival));
    setPOnSpecial(Boolean(p.onSpecial));
    setPSpecialLabel(p.specialLabel || campaign.badgeText || 'Black Friday Special');
    setPSpecialDiscountType(p.specialDiscountType === 'fixed' ? 'fixed' : 'percentage');
    setPSpecialDiscount(String(p.specialDiscountPercent ?? 0));
    setPSpecialDiscountAmount(
      String(p.specialDiscountAmount && p.specialDiscountAmount > 0 ? p.specialDiscountAmount : 100)
    );
    setEditorOpen(true);
  };

  const openDuplicatePerfume = (p: FragranceProduct) => {
    setEditingPerfumeId(null);
    setFormError(null);
    setPName(`${p.name} (Copy)`);
    const isKnownHouse = featuredPerfumeHouses.includes(p.brand);
    setPBrandSelect(isKnownHouse ? p.brand : 'Custom');
    setPCustomBrand(isKnownHouse ? '' : p.brand);
    setPCategory(p.category);
    setPConcentration(p.concentration);
    setPAvailability(p.availability);
    const activeBranches = getAvailableBranches(p);
    setPBranches(
      p.availability === 'Out of Stock'
        ? []
        : activeBranches.length > 0
        ? activeBranches
        : ['manzini', 'mbabane']
    );
    setPDescription(p.description);
    setPImage(p.image);
    setPTopNotes(p.notes.top.join(', '));
    setPHeartNotes(p.notes.heart.join(', '));
    setPBaseNotes(p.notes.base.join(', '));
    setPSizes(buildInitialSizes(p.sizes));
    setCustomSizeInput('');
    setPFeatured(p.featured);
    setPBestseller(false);
    setPUnboxed(Boolean(p.isUnboxed));
    setPIsNewArrival(Boolean(p.isNewArrival));
    setPOnSpecial(Boolean(p.onSpecial));
    setPSpecialLabel(p.specialLabel || campaign.badgeText || 'Black Friday Special');
    setPSpecialDiscountType(p.specialDiscountType === 'fixed' ? 'fixed' : 'percentage');
    setPSpecialDiscount(String(p.specialDiscountPercent ?? 0));
    setPSpecialDiscountAmount(
      String(p.specialDiscountAmount && p.specialDiscountAmount > 0 ? p.specialDiscountAmount : 100)
    );
    setEditorOpen(true);
  };

  const handleQuickAvailabilityChange = (
    product: FragranceProduct,
    nextAvailability: AvailabilityStatus
  ) => {
    if (product.availability === nextAvailability) return;
    const existingBranches = getAvailableBranches(product);
    const nextBranches: BranchId[] =
      nextAvailability === 'Out of Stock'
        ? []
        : existingBranches.length > 0
        ? existingBranches
        : ['manzini', 'mbabane'];

    const promise = savePerfume(
      {
        slug: product.slug,
        isSampleListing: product.isSampleListing,
        name: product.name,
        brand: product.brand,
        category: product.category,
        concentration: product.concentration,
        description: product.description,
        image: product.image,
        notes: product.notes,
        sizes: product.sizes,
        availability: nextAvailability,
        availableBranches: nextBranches,
        featured: product.featured,
        bestseller: product.bestseller,
        isUnboxed: Boolean(product.isUnboxed),
        isNewArrival: Boolean(product.isNewArrival),
        onSpecial: product.onSpecial,
        specialLabel: product.specialLabel,
        specialDiscountType: product.specialDiscountType,
        specialDiscountPercent: product.specialDiscountPercent,
        specialDiscountAmount: product.specialDiscountAmount,
      },
      product.id
    );
    onNotify('Availability Updated', `${product.name} marked as ${nextAvailability}.`);
    void promise.catch((err) => {
      onNotify(
        'Status Update Failed',
        extractReadableError(err, 'Could not update availability.')
      );
    });
  };

  const handleAddSizeSlot = (rawLabel: string) => {
    const cleaned = rawLabel.trim().slice(0, 24);
    if (!cleaned) return;
    if (pSizes.length >= 12) {
      setFormError('Maximum of 12 bottle sizes per perfume.');
      return;
    }
    const exists = pSizes.some(
      (s) => s.size.trim().toLowerCase() === cleaned.toLowerCase()
    );
    if (exists) {
      setPSizes((prev) =>
        prev.map((s) =>
          s.size.trim().toLowerCase() === cleaned.toLowerCase()
            ? { ...s, available: true }
            : s
        )
      );
      setCustomSizeInput('');
      return;
    }
    setPSizes((prev) => [...prev, { size: cleaned, price: null, available: true }]);
    setCustomSizeInput('');
    setFormError(null);
  };

  const handleSavePerfume = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const resolvedBrand =
      pBrandSelect === 'Custom' ? pCustomBrand.trim() : pBrandSelect;
    if (!pName.trim()) {
      setFormError('Perfume name is required.');
      return;
    }
    if (!resolvedBrand) {
      setFormError('Perfume house / brand is required.');
      return;
    }
    const normalizedSizes = pSizes
      .map((s) => ({
        ...s,
        size: s.size.trim().slice(0, 24),
      }))
      .filter((s) => s.size.length > 0);

    const seen = new Set<string>();
    const uniqueSizes: SizeOption[] = [];
    for (const slot of normalizedSizes) {
      const key = slot.size.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueSizes.push(slot);
      }
    }

    const activeSizes = uniqueSizes.filter((s) => s.available);
    if (activeSizes.length === 0) {
      setFormError('Add and enable at least one bottle size (e.g. 50ml, 70ml, 80ml, or 100ml).');
      return;
    }

    const splitNotes = (raw: string) =>
      raw
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);

    const resolvedDescription =
      pDescription.trim() ||
      `${pName.trim()} by ${resolvedBrand} — curated Arabian fragrance available in Eswatini.`;

    const parsedDiscount = Number(pSpecialDiscount || 0);
    const safeDiscount = Number.isFinite(parsedDiscount)
      ? Math.min(90, Math.max(0, parsedDiscount))
      : 0;

    const parsedDiscountAmt = Number(pSpecialDiscountAmount || 0);
    const safeDiscountAmt = Number.isFinite(parsedDiscountAmt)
      ? Math.min(50000, Math.max(0, Math.round(parsedDiscountAmt * 100) / 100))
      : 0;

    const cleanBranches =
      pAvailability === 'Out of Stock' ? [] : normalizeBranches(pBranches);
    if (pAvailability !== 'Out of Stock' && cleanBranches.length === 0) {
      setFormError('Select at least one store branch (Manzini or Mbabane), or set availability to Out of Stock.');
      return;
    }

    const payload: PerfumeInput = {
      name: pName.trim(),
      brand: resolvedBrand,
      category: pCategory,
      concentration: pConcentration.trim() || 'Eau de Parfum',
      availability: pAvailability,
      availableBranches: cleanBranches,
      description: resolvedDescription,
      image: pImage.trim() || houseImages[featuredPerfumeHouses[0]],
      isSampleListing: false,
      notes: {
        top: splitNotes(pTopNotes),
        heart: splitNotes(pHeartNotes),
        base: splitNotes(pBaseNotes),
      },
      sizes: uniqueSizes,
      featured: pFeatured,
      bestseller: pBestseller,
      isUnboxed: pUnboxed,
      isNewArrival: pIsNewArrival,
      onSpecial: pOnSpecial,
      specialLabel: pOnSpecial ? pSpecialLabel.trim() : '',
      specialDiscountType: pOnSpecial ? pSpecialDiscountType : 'percentage',
      specialDiscountPercent:
        pOnSpecial && pSpecialDiscountType === 'percentage' ? safeDiscount : 0,
      specialDiscountAmount:
        pOnSpecial && pSpecialDiscountType === 'fixed' ? safeDiscountAmt : 0,
    };

    const targetEditingId = editingPerfumeId ?? undefined;
    const isEditing = Boolean(targetEditingId);

    // Apply optimistic state immediately and close modal without waiting on network round-trip
    const persistPromise = savePerfume(payload, targetEditingId);
    setEditorOpen(false);
    setSavingPerfume(false);
    onNotify(
      isEditing ? 'Perfume Updated' : 'Perfume Added',
      `${payload.name} (${payload.brand}) saved to your live catalogue.`
    );
    void persistPromise.catch((err) => {
      onNotify(
        'Save Failed',
        extractReadableError(err, `Could not save ${payload.name}. Changes were reverted.`)
      );
    });
  };

  const handleImportStarter = async () => {
    setImportingStarter(true);
    try {
      const count = await importStarterCatalogue();
      onNotify(
        'Starter Catalogue Imported',
        `${count} house listings synced to Firestore. You can now edit prices or add them to Specials.`
      );
    } catch (err) {
      onNotify(
        'Import Failed',
        extractReadableError(err, 'Unable to import starter listings.')
      );
    } finally {
      setImportingStarter(false);
    }
  };

  const handleSaveCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    const draftSnapshot = campaignDraft;
    const mode = draftSnapshot.heroMode ?? 'auto';
    const title =
      mode === 'new-arrivals'
        ? 'New Arrivals Hero Live'
        : draftSnapshot.enabled
        ? 'Special Campaign Live'
        : 'Hero Showcase Settings Saved';
    const persistPromise = saveCampaign(draftSnapshot);
    setSavingCampaign(false);
    onNotify(
      title,
      `${
        mode === 'new-arrivals'
          ? draftSnapshot.newArrivalsTitle || 'New Arrivals'
          : draftSnapshot.title
      } synced to storefront.`
    );
    void persistPromise.catch((err) => {
      onNotify(
        'Campaign Save Error',
        extractReadableError(err, 'Could not save campaign.')
      );
    });
  };

  const resolvedWeeklyDraft = useMemo(
    () => resolveWeeklyFiveMlSelection(catalogForBuilders, weeklyDraft, mountNowMs),
    [catalogForBuilders, weeklyDraft, mountNowMs]
  );

  const handleRandomizeWeeklyPicks = (target: WeeklyFiveMlAudience | 'Both' = 'Both') => {
    const activeWeek = getWeekWindowBounds(Date.now()).weekKey;
    const nextSeed = (weeklyDraft.seedOffset ?? 0) + 1;
    setWeeklyDraft((prev) => {
      const next = {
        ...prev,
        weekKey: activeWeek,
        seedOffset: nextSeed,
      };
      if (target === 'Women' || target === 'Both') {
        const freshWomen = pickRandomWeeklyAudienceIds(
          catalogForBuilders,
          'Women',
          activeWeek,
          nextSeed
        );
        next.womenUnder500Ids = freshWomen.under500Ids;
        next.womenUnder800Ids = freshWomen.under800Ids;
      }
      if (target === 'Men' || target === 'Both') {
        const freshMen = pickRandomWeeklyAudienceIds(
          catalogForBuilders,
          'Men',
          activeWeek,
          nextSeed
        );
        next.menUnder500Ids = freshMen.under500Ids;
        next.menUnder800Ids = freshMen.under800Ids;
      }
      return next;
    });
  };

  const handleSaveWeeklySpecial = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const currentWeekKey = resolvedWeeklyDraft.weekKey;
    const women500Ids = resolvedWeeklyDraft.women.under500Picks.map((c) => c.product.id);
    const women800Ids = resolvedWeeklyDraft.women.under800Picks.map((c) => c.product.id);
    const men500Ids = resolvedWeeklyDraft.men.under500Picks.map((c) => c.product.id);
    const men800Ids = resolvedWeeklyDraft.men.under800Picks.map((c) => c.product.id);
    const persistPromise = saveWeeklySpecial({
      ...weeklyDraft,
      weekKey: currentWeekKey,
      under500Ids: women500Ids,
      under800Ids: women800Ids,
      womenUnder500Ids: women500Ids,
      womenUnder800Ids: women800Ids,
      menUnder500Ids: men500Ids,
      menUnder800Ids: men800Ids,
    });
    setSavingWeeklySpecial(false);
    onNotify(
      weeklyDraft.enabled ? 'Weekly 5ml Special Saved' : 'Weekly 5ml Special Paused',
      `Updated For Women & For Men 5ml picks for ${resolvedWeeklyDraft.weekLabel}.`
    );
    void persistPromise.catch((err) => {
      onNotify(
        'Save Error',
        extractReadableError(err, 'Could not save Weekly 5ml Special.')
      );
    });
  };

  const handleSaveExclusiveSpecial = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (weeklyDraft.exclusiveEnabled && (weeklyDraft.exclusiveItems?.length ?? 0) === 0) {
      onNotify(
        'Add Exclusive Perfumes First',
        'Select at least 1 perfume and set its custom 5ml price before publishing Live.'
      );
      return;
    }
    const currentWeekKey = resolvedWeeklyDraft.weekKey;
    const women500Ids = resolvedWeeklyDraft.women.under500Picks.map((c) => c.product.id);
    const women800Ids = resolvedWeeklyDraft.women.under800Picks.map((c) => c.product.id);
    const men500Ids = resolvedWeeklyDraft.men.under500Picks.map((c) => c.product.id);
    const men800Ids = resolvedWeeklyDraft.men.under800Picks.map((c) => c.product.id);
    const persistPromise = saveWeeklySpecial({
      ...weeklyDraft,
      weekKey: currentWeekKey,
      under500Ids: women500Ids,
      under800Ids: women800Ids,
      womenUnder500Ids: women500Ids,
      womenUnder800Ids: women800Ids,
      menUnder500Ids: men500Ids,
      menUnder800Ids: men800Ids,
    });
    setSavingExclusiveSpecial(false);
    onNotify(
      weeklyDraft.exclusiveEnabled
        ? 'Exclusive Special Saved'
        : 'Exclusive Special Paused',
      `${weeklyDraft.exclusiveItems?.length ?? 0} custom-sized & custom-priced special picks saved.`
    );
    void persistPromise.catch((err) => {
      onNotify(
        'Save Error',
        extractReadableError(err, 'Could not save Exclusive 5ml Special.')
      );
    });
  };

  const handleApplyBulkSpecialDiscount = async () => {
    const rawNum = Number(bulkSpecialDiscount || 0);
    const safePct =
      bulkSpecialType === 'percentage'
        ? Math.min(90, Math.max(0, Number.isFinite(rawNum) ? rawNum : 0))
        : 0;
    const safeAmt =
      bulkSpecialType === 'fixed'
        ? Math.min(50000, Math.max(0, Number.isFinite(rawNum) ? Math.round(rawNum * 100) / 100 : 0))
        : 0;
    setApplyingBulkSpecial(true);
    try {
      await Promise.all(
        specialPerfumes.map((item) =>
          togglePerfumeSpecial(
            item,
            true,
            safePct,
            campaignDraft.badgeText || item.specialLabel || 'Black Friday Special',
            bulkSpecialType,
            safeAmt,
            true
          )
        )
      );
      await publishCatalogueSnapshot();
      setDiscountEdits({});
      onNotify(
        'Specials Updated',
        bulkSpecialType === 'fixed'
          ? `Reduced prices by E${safeAmt} across ${specialPerfumes.length} special perfume(s).`
          : `Applied -${safePct}% across ${specialPerfumes.length} special perfume(s).`
      );
    } catch (err) {
      onNotify(
        'Bulk Update Failed',
        extractReadableError(err, 'Could not update special discounts.')
      );
    } finally {
      setApplyingBulkSpecial(false);
    }
  };

  const handleCommitSingleSpecialDiscount = (
    product: FragranceProduct,
    draftType: SpecialDiscountType,
    rawValue: string | number
  ) => {
    const numericVal = Number(rawValue || 0);
    const safePct =
      draftType === 'percentage'
        ? Math.min(90, Math.max(0, Number.isFinite(numericVal) ? numericVal : 0))
        : 0;
    const safeAmt =
      draftType === 'fixed'
        ? Math.min(
            50000,
            Math.max(0, Number.isFinite(numericVal) ? Math.round(numericVal * 100) / 100 : 0)
          )
        : 0;
    const currentType: SpecialDiscountType =
      product.specialDiscountType === 'fixed' ? 'fixed' : 'percentage';
    const currentVal =
      currentType === 'fixed'
        ? product.specialDiscountAmount ?? 0
        : product.specialDiscountPercent ?? 0;
    const nextVal = draftType === 'fixed' ? safeAmt : safePct;

    if (
      draftType === currentType &&
      nextVal === currentVal &&
      product.onSpecial
    ) {
      setDiscountEdits((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      return;
    }

    setDiscountEdits((prev) => {
      const next = { ...prev };
      delete next[product.id];
      return next;
    });
    const persistPromise = togglePerfumeSpecial(
      product,
      true,
      safePct,
      product.specialLabel || campaignDraft.badgeText || 'Special Offer',
      draftType,
      safeAmt,
      false
    );
    onNotify(
      'Special Price Saved',
      draftType === 'fixed'
        ? `${product.name} updated to -E${safeAmt} off.`
        : `${product.name} updated to -${safePct}% off.`
    );
    void persistPromise.catch((err) => {
      onNotify(
        'Discount Save Error',
        extractReadableError(err, 'Could not update discount.')
      );
    });
  };

  const handleResetCouponForm = () => {
    setEditingCouponCode(null);
    setCCode('');
    setCDescription('');
    setCType('percentage');
    setCValue('15');
    setCMinSpend('0');
    setCScope('all');
    setCActive(true);
    setCouponError(null);
  };

  const handleEditCoupon = (c: Coupon) => {
    setEditingCouponCode(c.code);
    setCCode(c.code);
    setCDescription(c.description);
    setCType(c.discountType);
    setCValue(String(c.discountValue));
    setCMinSpend(String(c.minOrderAmount));
    setCScope(c.appliesTo);
    setCActive(c.active);
    setCouponError(null);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    const cleanedCode = cCode
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9_-]/g, '');
    if (cleanedCode.length < 2) {
      setCouponError('Coupon code must be at least 2 alphanumeric characters.');
      return;
    }
    const numVal = Number(cValue);
    if (Number.isNaN(numVal) || numVal <= 0) {
      setCouponError('Discount value must be greater than 0.');
      return;
    }
    if (cType === 'percentage' && numVal > 95) {
      setCouponError('Percentage discount cannot exceed 95%.');
      return;
    }

    setSavingCoupon(true);
    try {
      await saveCoupon(
        {
          code: cleanedCode,
          description: cDescription.trim() || `${cleanedCode} Store Promo`,
          discountType: cType,
          discountValue: numVal,
          minOrderAmount: Math.max(0, Number(cMinSpend || 0)),
          appliesTo: cScope,
          active: cActive,
        },
        Boolean(editingCouponCode)
      );
      onNotify(
        editingCouponCode ? 'Coupon Updated' : 'Coupon Created',
        `Code "${cleanedCode}" is ready to share in posts & live streams.`
      );
      handleResetCouponForm();
    } catch (err) {
      setCouponError(extractReadableError(err, 'Unable to save coupon.'));
    } finally {
      setSavingCoupon(false);
    }
  };

  const syncComboPicksToForm = (
    nextPicks: { key: string; name: string; size: string; price: number | null }[],
    currentComboPriceStr: string
  ) => {
    setSelectedComboPicks(nextPicks);
    setComboPerfumesText(nextPicks.map((p) => p.name).join(', '));
    if (nextPicks.length === 0) return;

    const sizes = nextPicks.map((p) => p.size).filter(Boolean);
    const allSameSize = sizes.length > 0 && sizes.every((s) => s === sizes[0]);
    if (allSameSize) {
      setComboSizeLabel(
        `${nextPicks.length} × ${sizes[0]}${nextPicks.length === 2 ? ' Duo' : ' Bundle'}`
      );
    } else if (sizes.length > 0) {
      setComboSizeLabel(sizes.join(' + '));
    }

    const pricedItems = nextPicks.filter((p) => p.price !== null && p.price > 0);
    if (pricedItems.length > 0) {
      const regSum = pricedItems.reduce((sum, p) => sum + Number(p.price ?? 0), 0);
      setComboRegularPrice(String(regSum));
      const bundleNum = Number(currentComboPriceStr);
      if (Number.isFinite(bundleNum) && bundleNum > 0 && regSum > bundleNum) {
        setComboTag(`Save ${formatPrice(regSum - bundleNum)}`);
      }
    }

    if (!comboTitle.trim() && nextPicks.length >= 2) {
      setComboTitle(`${nextPicks[0].name} + ${nextPicks[1].name} Combo`);
    }
  };

  const handleAddPerfumePickToCombo = (
    product: FragranceProduct,
    sizeOpt: SizeOption
  ) => {
    const effPrice =
      sizeOpt.price !== null
        ? getEffectiveUnitPrice(
            sizeOpt.price,
            product.onSpecial,
            product.specialDiscountPercent,
            product.specialDiscountType,
            product.specialDiscountAmount,
            sizeOpt.size,
            product.sizes
          )
        : null;
    const nextPicks = [
      ...selectedComboPicks,
      {
        key: `${product.id}-${sizeOpt.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: product.name,
        size: sizeOpt.size,
        price: effPrice,
      },
    ].slice(0, 6);
    syncComboPicksToForm(nextPicks, comboPrice);
  };

  const handleRemoveComboPick = (pickKey: string) => {
    const nextPicks = selectedComboPicks.filter((p) => p.key !== pickKey);
    syncComboPicksToForm(nextPicks, comboPrice);
  };

  const resetComboForm = () => {
    setEditingComboId(null);
    setComboTitle('');
    setComboSubtitle('');
    setComboPerfumesText('');
    setSelectedComboPicks([]);
    setComboPickerSearch('');
    setComboSizeLabel('2 × 30ml / Duo Pack');
    setComboRegularPrice('600');
    setComboPrice('550');
    setComboTag('Save E50');
    setComboFeatured(true);
    setComboActive(true);
    setComboError(null);
  };

  const handleEditCombo = (combo: ComboDeal) => {
    setEditingComboId(combo.id);
    setComboTitle(combo.title);
    setComboSubtitle(combo.subtitle);
    setComboPerfumesText(combo.perfumeNames.join(', '));
    setSelectedComboPicks([]);
    setComboSizeLabel(combo.sizeLabel);
    setComboRegularPrice(String(combo.regularPrice));
    setComboPrice(String(combo.comboPrice));
    setComboTag(combo.tag);
    setComboFeatured(combo.featured);
    setComboActive(combo.active);
    setComboError(null);
  };

  const handleSaveComboSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setComboError(null);
    const perfumeNames = comboPerfumesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!comboTitle.trim()) {
      setComboError('Please enter a combo bundle title.');
      return;
    }
    if (perfumeNames.length < 2) {
      setComboError('Pick or enter at least 2 perfumes for this combo bundle.');
      return;
    }
    const regNum = Number(comboRegularPrice);
    const bundleNum = Number(comboPrice);
    if (!Number.isFinite(regNum) || !Number.isFinite(bundleNum) || bundleNum <= 0) {
      setComboError('Enter valid Regular and Combo prices in Emalangeni.');
      return;
    }
    if (bundleNum > regNum) {
      setComboError('Combo bundle price cannot be higher than the regular combined price.');
      return;
    }

    setSavingCombo(true);
    try {
      await saveComboDeal(
        {
          title: comboTitle,
          subtitle: comboSubtitle,
          perfumeNames,
          sizeLabel: comboSizeLabel,
          regularPrice: regNum,
          comboPrice: bundleNum,
          tag: comboTag,
          featured: comboFeatured,
          active: comboActive,
        },
        editingComboId ?? undefined
      );
      onNotify(
        editingComboId ? 'Combo Updated' : 'Combo Published',
        `${comboTitle.trim()} is live on Combo / Layering.`
      );
      resetComboForm();
    } catch (err) {
      setComboError(extractReadableError(err, 'Could not save combo deal.'));
    } finally {
      setSavingCombo(false);
    }
  };

  const resetLayerForm = () => {
    setEditingLayerId(null);
    setLayerTitle('');
    setLayerVibe('');
    setLayerBasePerfume('');
    setLayerTopPerfume('');
    setLayerSprayRatio('2 sprays base · 2 sprays top');
    setLayerOccasion('Evening & Date Night');
    setLayerWhyItWorks('');
    setLayerActive(true);
    setLayerError(null);
  };

  const handleEditLayer = (idea: LayeringIdea) => {
    setEditingLayerId(idea.id);
    setLayerTitle(idea.title);
    setLayerVibe(idea.vibe);
    setLayerBasePerfume(idea.basePerfumeName);
    setLayerTopPerfume(idea.topPerfumeName);
    setLayerSprayRatio(idea.sprayRatio);
    setLayerOccasion(idea.occasion);
    setLayerWhyItWorks(idea.whyItWorks);
    setLayerActive(idea.active);
    setLayerError(null);
  };

  const handleSaveLayerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLayerError(null);
    if (!layerTitle.trim() || !layerBasePerfume.trim() || !layerTopPerfume.trim()) {
      setLayerError('Title, Base Perfume, and Top Layer Perfume are required.');
      return;
    }

    setSavingLayer(true);
    try {
      await saveLayeringIdea(
        {
          title: layerTitle,
          vibe: layerVibe || 'Signature Pairing',
          basePerfumeName: layerBasePerfume,
          topPerfumeName: layerTopPerfume,
          sprayRatio: layerSprayRatio || '2 sprays base · 2 sprays top',
          occasion: layerOccasion,
          whyItWorks:
            layerWhyItWorks ||
            `${layerBasePerfume.trim()} anchors the skin while ${layerTopPerfume.trim()} lifts the top notes.`,
          active: layerActive,
        },
        editingLayerId ?? undefined
      );
      onNotify(
        editingLayerId ? 'Layering Idea Updated' : 'Layering Idea Published',
        `${layerTitle.trim()} added to the Combo / Layering guide.`
      );
      resetLayerForm();
    } catch (err) {
      setLayerError(extractReadableError(err, 'Could not save layering idea.'));
    } finally {
      setSavingLayer(false);
    }
  };

  const handleImportStarterCombos = async () => {
    setImportingCombosStarter(true);
    try {
      const count = await importStarterCombosAndLayering();
      onNotify(
        'Starter Combos Imported',
        `Imported ${count} starter items into Firestore for editing.`
      );
    } catch (err) {
      onNotify(
        'Import Failed',
        extractReadableError(err, 'Could not import starter combos.')
      );
    } finally {
      setImportingCombosStarter(false);
    }
  };

  const resetHamperForm = () => {
    setEditingHamperId(null);
    setHTitle('');
    setHOccasion(GIFT_HAMPER_OCCASIONS[0]);
    setHSubtitle('');
    setHItemsText(
      '100ml Arabian Fragrance Bottle\nMatching Body Mist\nRibbon Presentation Box & Gift Card'
    );
    setHRegularPrice('1250');
    setHHamperPrice('990');
    setHImage(DEFAULT_HAMPER_IMAGE);
    setHGiftWrapNote('Includes complimentary satin ribbon box & card');
    setHAvailability('In Stock');
    setHFeatured(true);
    setHActive(true);
    setHamperError(null);
  };

  const handleEditHamper = (hamper: GiftHamper) => {
    setEditingHamperId(hamper.id);
    setHTitle(hamper.title);
    setHOccasion(hamper.occasion || GIFT_HAMPER_OCCASIONS[0]);
    setHSubtitle(hamper.subtitle);
    setHItemsText(hamper.itemsIncluded.join('\n'));
    setHRegularPrice(String(hamper.regularPrice));
    setHHamperPrice(String(hamper.hamperPrice));
    setHImage(hamper.image || DEFAULT_HAMPER_IMAGE);
    setHGiftWrapNote(hamper.giftWrapNote);
    setHAvailability(hamper.availability);
    setHFeatured(hamper.featured);
    setHActive(hamper.active);
    setHamperError(null);
  };

  const handleSaveHamperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setHamperError(null);
    const items = hItemsText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!hTitle.trim()) {
      setHamperError('Please enter a gift hamper title.');
      return;
    }
    if (items.length === 0) {
      setHamperError('List at least 1 included item (one item per line).');
      return;
    }
    const regNum = Number(hRegularPrice);
    const hamperNum = Number(hHamperPrice);
    if (!Number.isFinite(regNum) || !Number.isFinite(hamperNum) || hamperNum <= 0) {
      setHamperError('Enter valid Regular and Gift Hamper prices in Emalangeni.');
      return;
    }
    if (hamperNum > regNum) {
      setHamperError('Gift hamper price cannot be higher than regular price.');
      return;
    }

    setSavingHamper(true);
    try {
      await saveHamper(
        {
          title: hTitle,
          occasion: hOccasion,
          subtitle: hSubtitle,
          itemsIncluded: items,
          regularPrice: regNum,
          hamperPrice: hamperNum,
          image: hImage,
          giftWrapNote: hGiftWrapNote,
          availability: hAvailability,
          featured: hFeatured,
          active: hActive,
        },
        editingHamperId ?? undefined
      );
      onNotify(
        editingHamperId ? 'Hamper Updated' : 'Gift Hamper Published',
        `${hTitle.trim()} is live on Gifts & Hampers.`
      );
      resetHamperForm();
    } catch (err) {
      setHamperError(extractReadableError(err, 'Could not save gift hamper.'));
    } finally {
      setSavingHamper(false);
    }
  };

  const handleImportStarterHampers = async () => {
    setImportingHampersStarter(true);
    try {
      const count = await importStarterHampers();
      onNotify(
        'Starter Hampers Imported',
        `Imported ${count} starter gift hampers into Firestore for editing.`
      );
    } catch (err) {
      onNotify(
        'Import Failed',
        extractReadableError(err, 'Could not import starter hampers.')
      );
    } finally {
      setImportingHampersStarter(false);
    }
  };

  const handleCopyCoupon = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCouponCode(code);
      setTimeout(() => setCopiedCouponCode(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleCopySocialCaption = async (coupon: Coupon) => {
    const valueLabel =
      coupon.discountType === 'percentage'
        ? `${coupon.discountValue}% OFF`
        : `${formatPrice(coupon.discountValue)} OFF`;
    const minSpendNote =
      coupon.minOrderAmount > 0 ? ` on orders from ${formatPrice(coupon.minOrderAmount)}` : '';
    const text = `Use code ${coupon.code} at checkout on AuraHut Co. for ${valueLabel}${minSpendNote}!`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCaptionCode(coupon.code);
      onNotify('Social Caption Copied', `Ready to paste for "${coupon.code}".`);
      setTimeout(() => setCopiedCaptionCode(null), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  // Influencer Referrals & Commissions Handlers
  const handleResetReferralForm = () => {
    setEditingReferralCode(null);
    setRCode('');
    setRInfluencerName('');
    setRSocialHandle('');
    setRCommissionType('percentage');
    setRCommissionValue('10');
    setRFollowerDiscountType('none');
    setRFollowerDiscountValue('0');
    setRPayoutNote('');
    setRActive(true);
    setReferralError(null);
  };

  const handleEditReferral = (refItem: InfluencerReferral) => {
    setEditingReferralCode(refItem.code);
    setRCode(refItem.code);
    setRInfluencerName(refItem.influencerName);
    setRSocialHandle(refItem.socialHandle);
    setRCommissionType(refItem.commissionType);
    setRCommissionValue(String(refItem.commissionValue));
    setRFollowerDiscountType(refItem.followerDiscountType);
    setRFollowerDiscountValue(String(refItem.followerDiscountValue));
    setRPayoutNote(refItem.payoutNote);
    setRActive(refItem.active);
    setReferralError(null);
  };

  const handleSaveReferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReferralError(null);
    const cleanedCode = rCode
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9_-]/g, '');
    if (cleanedCode.length < 2) {
      setReferralError('Referral code must be at least 2 alphanumeric characters.');
      return;
    }
    if (!rInfluencerName.trim()) {
      setReferralError('Influencer name is required.');
      return;
    }
    const commVal = Number(rCommissionValue);
    if (Number.isNaN(commVal) || commVal < 0) {
      setReferralError('Commission rate must be 0 or greater.');
      return;
    }
    if (rCommissionType === 'percentage' && commVal > 90) {
      setReferralError('Percentage commission cannot exceed 90%.');
      return;
    }
    const discVal =
      rFollowerDiscountType === 'none' ? 0 : Math.max(0, Number(rFollowerDiscountValue || 0));
    if (rFollowerDiscountType === 'percentage' && discVal > 95) {
      setReferralError('Follower percentage discount cannot exceed 95%.');
      return;
    }

    setSavingReferral(true);
    try {
      await saveReferral(
        {
          code: cleanedCode,
          influencerName: rInfluencerName.trim(),
          socialHandle: rSocialHandle.trim(),
          commissionType: rCommissionType,
          commissionValue: commVal,
          followerDiscountType: rFollowerDiscountType,
          followerDiscountValue: discVal,
          payoutNote: rPayoutNote.trim(),
          active: rActive,
        },
        Boolean(editingReferralCode)
      );
      if (!saleReferralCode) {
        setSaleReferralCode(cleanedCode);
      }
      onNotify(
        editingReferralCode ? 'Influencer Updated' : 'Influencer Code Created',
        `Referral code "${cleanedCode}" is ready to share.`
      );
      handleResetReferralForm();
    } catch (err) {
      setReferralError(extractReadableError(err, 'Unable to save influencer referral.'));
    } finally {
      setSavingReferral(false);
    }
  };

  const handleCopyReferralLink = async (code: string) => {
    const link = `${window.location.origin}/?ref=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedReferralLinkCode(code);
      onNotify('Referral Link Copied', link);
      setTimeout(() => setCopiedReferralLinkCode(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleCopyReferralPost = async (refItem: InfluencerReferral) => {
    const link = `${window.location.origin}/?ref=${encodeURIComponent(refItem.code)}`;
    const perkLine =
      refItem.followerDiscountType === 'percentage' && refItem.followerDiscountValue > 0
        ? ` and enjoy ${refItem.followerDiscountValue}% OFF your fragrance order`
        : refItem.followerDiscountType === 'fixed' && refItem.followerDiscountValue > 0
        ? ` and enjoy ${formatPrice(refItem.followerDiscountValue)} OFF your fragrance order`
        : '';
    const text = `Shop authentic Arabian perfumes at AuraHut Co. (Manzini & Mbabane)! Use my code ${refItem.code} or tap my link to order${perkLine}: ${link}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReferralPostCode(refItem.code);
      onNotify('Influencer Share Caption Copied', `Ready for ${refItem.influencerName}.`);
      setTimeout(() => setCopiedReferralPostCode(null), 2000);
    } catch {
      // Ignore clipboard failures
    }
  };

  const selectedManualReferral = useMemo(
    () =>
      referrals.find((r) => r.code === (saleReferralCode || referrals[0]?.code)) ??
      null,
    [referrals, saleReferralCode]
  );

  const manualSalePreview = useMemo(() => {
    const sub = Math.max(0, Number(saleSubtotal || 0));
    const disc = Math.min(sub, Math.max(0, Number(saleDiscount || 0)));
    const net = Math.max(0, Math.round((sub - disc) * 100) / 100);
    const comm = calculateReferralCommission(net, selectedManualReferral);
    return { sub, disc, net, comm };
  }, [saleSubtotal, saleDiscount, selectedManualReferral]);

  const handleLogManualSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaleError(null);
    const targetCode = saleReferralCode || referrals[0]?.code || '';
    if (!targetCode) {
      setSaleError('Create an influencer referral profile first before logging sales.');
      return;
    }
    if (!saleOrderSummary.trim()) {
      setSaleError('Enter the fragrance(s) sold.');
      return;
    }
    const sub = Number(saleSubtotal);
    if (Number.isNaN(sub) || sub <= 0) {
      setSaleError('Order total must be greater than E0.');
      return;
    }

    setSavingSale(true);
    try {
      await logManualReferralSale({
        referralCode: targetCode,
        orderSummary: saleOrderSummary.trim(),
        orderSubtotal: sub,
        discountAmount: Math.max(0, Number(saleDiscount || 0)),
        customerRef: saleCustomerRef.trim(),
        commissionStatus: saleStatus,
      });
      onNotify(
        'Referral Sale Logged',
        `Commission recorded for ${targetCode} (${formatPrice(manualSalePreview.comm)}).`
      );
      setSaleOrderSummary('');
      setSaleSubtotal('');
      setSaleDiscount('0');
      setSaleCustomerRef('');
      setSaleStatus('confirmed');
    } catch (err) {
      setSaleError(extractReadableError(err, 'Unable to record referral sale.'));
    } finally {
      setSavingSale(false);
    }
  };

  const [attributionEdits, setAttributionEdits] = useState<
    Record<string, { subtotal: string; discount: string }>
  >({});
  const [processingAttributionId, setProcessingAttributionId] = useState<string | null>(
    null
  );

  const pendingAttributions = useMemo(
    () => referralAttributions.filter((a) => a.status === 'pending'),
    [referralAttributions]
  );

  const referralSummaryStats = useMemo(() => {
    let totalSalesVolume = 0;
    let pendingOwed = 0;
    let confirmedOwed = 0;
    let paidOut = 0;
    let pendingCount = pendingAttributions.length;
    const byCode = new Map<
      string,
      { orders: number; sales: number; owed: number; paid: number; pendingCount: number }
    >();

    for (const s of referralSales) {
      if (s.commissionStatus === 'cancelled') continue;
      totalSalesVolume += s.netOrderAmount;
      const cur = byCode.get(s.referralCode) ?? {
        orders: 0,
        sales: 0,
        owed: 0,
        paid: 0,
        pendingCount: 0,
      };
      cur.orders += 1;
      cur.sales += s.netOrderAmount;

      if (s.commissionStatus === 'pending') {
        pendingOwed += s.commissionAmount;
        pendingCount += 1;
        cur.owed += s.commissionAmount;
        cur.pendingCount += 1;
      } else if (s.commissionStatus === 'confirmed') {
        confirmedOwed += s.commissionAmount;
        cur.owed += s.commissionAmount;
      } else if (s.commissionStatus === 'paid') {
        paidOut += s.commissionAmount;
        cur.paid += s.commissionAmount;
      }
      byCode.set(s.referralCode, cur);
    }

    return {
      totalSalesVolume,
      totalOwed: pendingOwed + confirmedOwed,
      confirmedOwed,
      pendingOwed,
      paidOut,
      pendingCount,
      byCode,
    };
  }, [referralSales, pendingAttributions.length]);

  const filteredReferralSales = useMemo(() => {
    return referralSales.filter((sale) => {
      if (ledgerCodeFilter !== 'ALL' && sale.referralCode !== ledgerCodeFilter) {
        return false;
      }
      if (ledgerStatusFilter !== 'all' && sale.commissionStatus !== ledgerStatusFilter) {
        return false;
      }
      return true;
    });
  }, [referralSales, ledgerCodeFilter, ledgerStatusFilter]);

  const activeSpecialsCount = useMemo(
    () => specialPerfumes.filter((p) => p.availability !== 'Out of Stock').length,
    [specialPerfumes]
  );
  const previewMode: HeroDisplayMode = campaignDraft.heroMode ?? 'auto';
  const previewShowingNewArrivals =
    previewMode === 'new-arrivals' ||
    (previewMode === 'auto' && activeSpecialsCount === 0);
  const previewHeadline = splitHeroHeadline(
    previewShowingNewArrivals
      ? campaignDraft.newArrivalsTitle || 'New Arrivals'
      : campaignDraft.title
  );

  // Live highest full-bottle size sample in modal for instant Special preview
  const editorSamplePrice = useMemo(() => {
    const highest = getSpecialTargetSizeOption(pSizes);
    if (!highest || typeof highest.price !== 'number' || highest.price <= 0) {
      return null;
    }
    const pct = Math.min(90, Math.max(0, Number(pSpecialDiscount || 0)));
    const amt = Math.min(50000, Math.max(0, Number(pSpecialDiscountAmount || 0)));
    const effective =
      getEffectiveUnitPrice(
        highest.price,
        true,
        pct,
        pSpecialDiscountType,
        amt,
        highest.size,
        pSizes
      ) ?? highest.price;
    return {
      size: highest.size,
      original: highest.price,
      effective,
      saved: Math.max(0, highest.price - effective),
    };
  }, [pSizes, pSpecialDiscountType, pSpecialDiscount, pSpecialDiscountAmount]);

  return (
    <div className="min-h-screen bg-[#F6F6F7] text-[#0A0A0A] flex flex-col overflow-x-clip">
      {/* Separate Admin Portal Top Bar */}
      <header className="sticky top-0 z-40 bg-[#0A0A0A] text-white border-b border-white/15">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={onBackToStorefront}
              aria-label="View Storefront"
              className="inline-flex items-center justify-center gap-2 w-9 h-9 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-full border border-white/20 hover:border-white text-xs font-medium text-white/85 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">View Storefront</span>
            </button>

            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-black">
                <img
                  src="/assets/aistudio/aurahut_logo_a0bd1434.jpg"
                  alt={siteConfig.brandName}
                  className="w-full h-full object-contain scale-[1.7] mix-blend-screen"
                />
              </div>
              <div className="min-w-0 leading-tight">
                <span className="block text-sm sm:text-lg font-bold tracking-[0.06em] sm:tracking-[0.12em] truncate">
                  {siteConfig.brandName}
                </span>
                <span className="block sm:hidden text-[9px] font-bold uppercase tracking-[0.16em] text-[#FACC15]">
                  Owner Admin
                </span>
              </div>
              <span className="hidden md:inline-flex px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] bg-[#FACC15] text-[#0A0A0A] rounded-full shrink-0">
                Owner Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {isOwner && (
              <AdminPWAInstallButton
                variant="header"
                onInstalled={() =>
                  onNotify(
                    'Admin App Installed',
                    'AuraHut Co. Owner Admin is now ready on your device.'
                  )
                }
              />
            )}
            {user && (
              <>
                <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 max-w-[260px]">
                  <span className="text-[11px] font-bold text-[#FACC15] truncate">
                    @{currentAdminUsername}
                  </span>
                  <span className="text-[11px] text-white/65 truncate">
                    {user.email}
                  </span>
                </div>
                {isOwner && (
                  <>
                    <button
                      type="button"
                      onClick={handleCopyPrivatePortalLink}
                      title="Copy private owner portal link"
                      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/25 hover:border-[#FACC15] hover:text-[#FACC15] text-xs font-medium text-white rounded-full transition-colors whitespace-nowrap"
                    >
                      {copiedPortalLink ? (
                        <Check className="w-3.5 h-3.5 text-[#FACC15]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedPortalLink ? 'Copied' : 'Portal Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordModalError(null);
                        setNewOwnerPassword('');
                        setConfirmOwnerPassword('');
                        setPasswordModalOpen(true);
                      }}
                      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/25 hover:border-[#FACC15] hover:text-[#FACC15] text-xs font-medium text-white rounded-full transition-colors whitespace-nowrap"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Password</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={signOutOwner}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-white/30 hover:border-white text-xs font-medium text-white rounded-full transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileHeaderMenuOpen((open) => !open)}
                  aria-expanded={mobileHeaderMenuOpen}
                  aria-label="Open admin account and tools menu"
                  className="sm:hidden inline-flex items-center justify-center w-9 h-9 rounded-full border border-white/25 text-white hover:border-[#FACC15] transition-colors"
                >
                  {mobileHeaderMenuOpen ? (
                    <X className="w-4 h-4" />
                  ) : (
                    <MoreVertical className="w-4 h-4" />
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Header Utility Drawer (keeps phone top bar spacious) */}
        {user && mobileHeaderMenuOpen && (
          <div className="sm:hidden border-t border-white/15 bg-[#121212] px-3 py-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-xs font-bold text-[#FACC15] truncate">
                @{currentAdminUsername}
              </span>
              <span className="text-[11px] text-white/65 truncate">{user.email}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {isOwner && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      handleCopyPrivatePortalLink();
                      setMobileHeaderMenuOpen(false);
                    }}
                    className="min-h-[40px] px-3 py-2 rounded-xl border border-white/20 text-xs font-medium text-white inline-flex items-center justify-center gap-1.5"
                  >
                    {copiedPortalLink ? (
                      <Check className="w-3.5 h-3.5 text-[#FACC15]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedPortalLink ? 'Link Copied' : 'Portal Link'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileHeaderMenuOpen(false);
                      setPasswordModalError(null);
                      setNewOwnerPassword('');
                      setConfirmOwnerPassword('');
                      setPasswordModalOpen(true);
                    }}
                    className="min-h-[40px] px-3 py-2 rounded-xl border border-white/20 text-xs font-medium text-white inline-flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Password</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setMobileHeaderMenuOpen(false);
                  void signOutOwner();
                }}
                className={`min-h-[40px] px-3 py-2 rounded-xl bg-white/10 border border-white/25 text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 ${
                  isOwner ? 'col-span-2' : 'col-span-2'
                }`}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 lg:py-10">
        {!authReady ? (
          <div className="max-w-md mx-auto bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-center space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
              Verifying Owner Session
            </p>
            <p className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
              Loading AuraHut Co. Console...
            </p>
          </div>
        ) : !user ? (
          /* Gate 1: Sign In Required */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10 space-y-5 sm:space-y-6 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0A0A0A] text-white flex items-center justify-center overflow-hidden">
                <img
                  src="/assets/aistudio/aurahut_logo_a0bd1434.jpg"
                  alt={siteConfig.brandName}
                  className="w-full h-full object-contain scale-[1.6]"
                />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FACC15] text-[#0A0A0A] text-[10px] font-bold uppercase tracking-wider">
                <Lock className="w-3 h-3" />
                <span>Owner Access Only</span>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A] tracking-tight">
                Store Admin Login
              </h1>
              <p className="text-sm text-[#525252] leading-relaxed">
                Enter your authorized admin email and password to sign in.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium leading-relaxed">
                {authError}
              </div>
            )}

            {authNotice && (
              <div className="p-3.5 bg-[#F0FDF4] border border-[#16A34A] rounded-xl text-xs text-[#166534] font-medium leading-relaxed">
                {authNotice}
              </div>
            )}

            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-login-id"
                  className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                >
                  Admin Email
                </label>
                <input
                  id="admin-login-id"
                  type="email"
                  autoComplete="email"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="Enter authorized admin email"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F6F6F7] border border-[#D4D4D4] rounded-xl text-sm text-[#0A0A0A] placeholder:text-[#737373] focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="admin-login-password"
                    className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    disabled={sendingReset}
                    onClick={handleSendPasswordReset}
                    className="text-[11px] font-medium text-[#525252] hover:text-[#0A0A0A] underline underline-offset-4 disabled:opacity-50"
                  >
                    {sendingReset ? 'Sending...' : 'Reset / Set Password'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="admin-login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter admin password"
                    required
                    className="w-full pl-3.5 pr-11 py-2.5 bg-[#F6F6F7] border border-[#D4D4D4] rounded-xl text-sm text-[#0A0A0A] placeholder:text-[#737373] focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#525252] hover:text-[#0A0A0A]"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={signingInPassword}
                className="w-full py-3.5 px-5 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 transition-colors rounded-full text-xs font-semibold uppercase tracking-[0.14em]"
              >
                {signingInPassword ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <button
              type="button"
              onClick={onBackToStorefront}
              className="w-full py-3 px-5 border border-[#D4D4D4] text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors rounded-full text-xs font-semibold uppercase tracking-wider"
            >
              Return to Customer Storefront
            </button>
          </motion.div>
        ) : !isOwner ? (
          /* Gate 2: Email Verification Needed or Non-Admin Denied */
          isAuthorizedAdminEmail(user.email) && !user.emailVerified ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-lg mx-auto bg-white border border-[#0A0A0A] rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10 space-y-5 sm:space-y-6"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0A0A0A] text-[#FACC15] flex items-center justify-center">
                <MailCheck className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
                  Verification Required
                </p>
                <h1 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A] tracking-tight">
                  Verify Owner Email
                </h1>
                <p className="text-sm text-[#525252] leading-relaxed">
                  Signed in as <strong className="text-[#0A0A0A]">{user.email}</strong>. Firestore security requires email verification before editing products or specials.
                </p>
              </div>
              {authError && (
                <div className="p-3.5 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium">
                  {authError}
                </div>
              )}
              {authNotice && (
                <div className="p-3.5 bg-[#F0FDF4] border border-[#16A34A] rounded-xl text-xs text-[#166534] font-medium">
                  {authNotice}
                </div>
              )}
              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={refreshingAuth}
                  onClick={handleRefreshVerification}
                  className="w-full py-3.5 px-4 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 transition-colors rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshingAuth ? 'animate-spin' : ''}`} />
                  <span>{refreshingAuth ? 'Checking...' : "I've Verified — Refresh Access"}</span>
                </button>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    disabled={sendingVerification}
                    onClick={handleSendVerificationEmail}
                    className="flex-1 py-3 px-4 border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#F5F5F5] disabled:opacity-50 transition-colors rounded-full text-xs font-semibold uppercase tracking-wider"
                  >
                    {sendingVerification ? 'Sending...' : 'Send Verification Email'}
                  </button>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="flex-1 py-3 px-4 border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors rounded-full text-xs font-semibold uppercase tracking-wider"
                  >
                    Use Google Sign-In
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-lg mx-auto bg-white border border-[#0A0A0A] rounded-2xl sm:rounded-3xl p-5 sm:p-8 lg:p-10 space-y-5 sm:space-y-6"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0A0A0A] text-[#FACC15] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
                  Access Denied
                </p>
                <h1 className="text-3xl font-bold text-[#0A0A0A] tracking-tight">
                  Owner Authorization Required
                </h1>
                <p className="text-sm text-[#525252] leading-relaxed">
                  Signed in as <strong className="text-[#0A0A0A]">{user.email}</strong>. Only verified AuraHut Co. administrator accounts have permission to edit catalogue pricing, coupon codes, or special promotions.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={signOutOwner}
                  className="flex-1 py-3 px-4 bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors rounded-full text-xs font-semibold uppercase tracking-wider"
                >
                  Switch Account
                </button>
                <button
                  type="button"
                  onClick={onBackToStorefront}
                  className="flex-1 py-3 px-4 border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors rounded-full text-xs font-semibold uppercase tracking-wider"
                >
                  Back to Storefront
                </button>
              </div>
            </motion.div>
          )
        ) : (
          /* Authenticated Owner Workspace */
          <div className="space-y-5 sm:space-y-8">
            {/* Overview Header & Interactive KPIs */}
            <div className="space-y-4 sm:space-y-6 border-b border-[#E5E5E5] pb-5 sm:pb-8">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.14em] sm:tracking-[0.18em] text-[#525252]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span>Real-Time Storefront Sync</span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F4F4F5] border border-[#E5E5E5] text-[11px] font-medium text-[#404040]">
                      Signed in as <strong className="text-[#0A0A0A]">@{currentAdminUsername}</strong>
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A] tracking-tight">
                    Store Control Center
                  </h1>
                  <p className="text-xs sm:text-sm text-[#525252]">
                    Manage bottle inventory, seasonal countdown specials, referral partners, and audit history.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    onClick={handlePublishSnapshotClick}
                    disabled={publishingSnapshot || !catalogueComplete}
                    title={
                      snapshotStatus
                        ? `Public 1-read cache: ${snapshotStatus.count} perfumes (${(snapshotStatus.bytes / 1024).toFixed(0)} KB)`
                        : 'Publish 1-read storefront catalogue cache'
                    }
                    className="px-3 sm:px-4 py-2.5 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${publishingSnapshot ? 'animate-spin' : ''}`} />
                    <span className="truncate">
                      {publishingSnapshot
                        ? 'Syncing...'
                        : snapshotStatus
                        ? `Sync Cache (${snapshotStatus.count})`
                        : 'Sync 1-Read Cache'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('specials');
                    }}
                    className="px-3 sm:px-4 py-2.5 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Specials Timer</span>
                  </button>
                  <button
                    type="button"
                    onClick={openCreatePerfume}
                    className="col-span-2 sm:col-span-1 px-5 py-2.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>Add Perfume</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('perfumes');
                    setInventoryFilter('all');
                  }}
                  className="text-left bg-white border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-2xl p-3.5 sm:p-4 transition-colors min-w-0"
                >
                  <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#737373] font-medium truncate">
                    Live Perfumes
                  </span>
                  <span className="mt-1 block text-xl sm:text-3xl font-bold text-[#0A0A0A] tabular-nums">
                    {livePerfumes.length}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#525252] truncate">
                    Published SKUs
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('specials')}
                  className="text-left bg-white border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-2xl p-3.5 sm:p-4 transition-colors min-w-0"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#737373] font-medium truncate">
                      On Special
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase shrink-0 ${
                        campaign.enabled
                          ? 'bg-[#FACC15] text-[#0A0A0A]'
                          : 'bg-[#F4F4F5] text-[#525252]'
                      }`}
                    >
                      {campaign.enabled ? 'Live' : 'Paused'}
                    </span>
                  </div>
                  <span className="mt-1 block text-xl sm:text-3xl font-bold text-[#0A0A0A] tabular-nums">
                    {specialPerfumes.length}
                  </span>
                  <AdminCountdownBadge endsAt={campaignDraft.endsAt} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('perfumes');
                    setInventoryFilter('low-stock');
                  }}
                  className={`text-left bg-white border rounded-2xl p-3.5 sm:p-4 transition-colors min-w-0 ${
                    stockAlertPerfumes.length > 0
                      ? 'border-[#FCA5A5] hover:border-[#DC2626]'
                      : 'border-[#E5E5E5] hover:border-[#0A0A0A]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#737373] font-medium truncate">
                      Stock Alerts
                    </span>
                    {stockAlertPerfumes.length > 0 && (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />
                    )}
                  </div>
                  <span
                    className={`mt-1 block text-xl sm:text-3xl font-bold tabular-nums ${
                      stockAlertPerfumes.length > 0 ? 'text-[#DC2626]' : 'text-[#0A0A0A]'
                    }`}
                  >
                    {stockAlertPerfumes.length}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#525252] truncate">
                    Low or out of stock
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('coupons')}
                  className="text-left bg-white border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-2xl p-3.5 sm:p-4 transition-colors min-w-0"
                >
                  <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#737373] font-medium truncate">
                    Active Coupons
                  </span>
                  <span className="mt-1 block text-xl sm:text-3xl font-bold text-[#0A0A0A] tabular-nums">
                    {coupons.filter((c) => c.active).length}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#525252] truncate">
                    {coupons.length} total codes
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('referrals')}
                  className="col-span-2 lg:col-span-1 text-left bg-white border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-2xl p-3.5 sm:p-4 transition-colors min-w-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#737373] font-medium truncate">
                      Influencers
                    </span>
                    {referralSummaryStats.pendingCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#FEF3C7] text-[#92400E] shrink-0">
                        {referralSummaryStats.pendingCount} new
                      </span>
                    )}
                  </div>
                  <span className="mt-1 block text-xl sm:text-3xl font-bold text-[#0A0A0A] tabular-nums">
                    {referrals.filter((r) => r.active).length}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#525252] truncate">
                    Owed {formatPrice(referralSummaryStats.totalOwed)}
                  </span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs (single-row horizontal swipe on phones, wrapping bar on md+) */}
            <div className="flex md:flex-wrap items-center gap-2 overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0 pb-1">
              {(
                [
                  { id: 'perfumes', label: 'Perfumes & Pricing', icon: Package },
                  { id: 'specials', label: 'Specials & Countdown', icon: Flame },
                  { id: 'combos', label: 'Combos & Layering', icon: Layers },
                  { id: 'hampers', label: `Hampers & Gifts (${liveHampers.length})`, icon: Gift },
                  { id: 'coupons', label: 'Social Coupon Codes', icon: Tag },
                  { id: 'referrals', label: `Referrals & Commissions (${referrals.length})`, icon: Users },
                  { id: 'audit', label: `Audit Trail (${auditLogs.length})`, icon: History },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full text-[11px] sm:text-xs font-semibold uppercase tracking-wider border transition-colors inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 ${
                      active
                        ? 'text-white border-[#0A0A0A]'
                        : 'bg-white text-[#525252] border-[#D4D4D4] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="admin-active-tab"
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0 bg-[#0A0A0A] rounded-full"
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 relative z-10 shrink-0" />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: PERFUMES CRUD */}
            {activeTab === 'perfumes' && (
              <div className="space-y-4 sm:space-y-5">
                {/* Action & Filter Toolbar */}
                <div className="bg-white border border-[#E5E5E5] rounded-2xl p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        placeholder="Search perfumes, house, category, stock..."
                        className="w-full pl-10 pr-9 py-2.5 bg-[#F6F6F7] border border-[#E5E5E5] focus:bg-white rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                      {inventorySearch && (
                        <button
                          type="button"
                          onClick={() => setInventorySearch('')}
                          aria-label="Clear search"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#737373] hover:text-[#0A0A0A]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-2.5 shrink-0">
                      <select
                        value={inventorySort}
                        onChange={(e) => setInventorySort(e.target.value as InventorySort)}
                        aria-label="Sort inventory"
                        className="w-full sm:w-auto px-3.5 py-2.5 bg-white border border-[#D4D4D4] rounded-xl text-xs font-medium text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                      >
                        <option value="name-asc">Sort: Name (A–Z)</option>
                        <option value="brand-asc">Sort: House (A–Z)</option>
                        <option value="price-desc">Sort: Highest Price</option>
                        <option value="price-asc">Sort: Lowest Price</option>
                      </select>

                      {livePerfumes.length === 0 && (
                        <button
                          type="button"
                          disabled={importingStarter}
                          onClick={handleImportStarter}
                          className="w-full sm:w-auto px-4 py-2.5 border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#F5F5F5] rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>
                            {importingStarter ? 'Importing...' : 'Import 8 Starter Perfumes'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={openCreatePerfume}
                        className="w-full sm:w-auto px-5 py-2.5 bg-[#0A0A0A] text-white hover:bg-[#262626] rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add New Perfume</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Chips (single horizontal swipe row on phones, wraps on sm+) */}
                  <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-2 pt-2 border-t border-[#F0F0F0]">
                    <div className="flex sm:flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {(
                        [
                          { id: 'all', label: `All (${livePerfumes.length})` },
                          { id: 'Men', label: 'Men' },
                          { id: 'Women', label: 'Women' },
                          { id: 'Unisex', label: 'Unisex' },
                          { id: 'Kiddies', label: 'Kiddies' },
                          { id: 'manzini', label: 'Manzini' },
                          { id: 'mbabane', label: 'Mbabane' },
                          { id: 'unboxed', label: `Unboxed (${unboxedPerfumes.length})` },
                          { id: 'new-arrivals', label: `New Arrivals (${newArrivalPerfumes.length})` },
                          { id: 'specials', label: `On Special (${specialPerfumes.length})` },
                          { id: 'low-stock', label: `Stock Alerts (${stockAlertPerfumes.length})` },
                        ] as const
                      ).map((chip) => {
                        const selected = inventoryFilter === chip.id;
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => setInventoryFilter(chip.id)}
                            className={`px-3 py-1.5 sm:py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                              selected
                                ? 'bg-[#0A0A0A] text-white'
                                : 'bg-[#F6F6F7] text-[#525252] hover:text-[#0A0A0A] border border-transparent hover:border-[#D4D4D4]'
                            }`}
                          >
                            {chip.label}
                          </button>
                        );
                      })}
                    </div>

                    <span className="text-[11px] sm:text-xs text-[#737373] tabular-nums shrink-0">
                      Showing {filteredLivePerfumes.length} of {livePerfumes.length}
                    </span>
                  </div>
                </div>

                {catalogueError && (
                  <div className="p-4 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B]">
                    <strong>Database Sync Warning:</strong> {catalogueError}
                  </div>
                )}

                {!catalogueLoading && livePerfumes.length === 0 ? (
                  <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-center space-y-4">
                    <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                      No Live Perfumes Saved in Database Yet
                    </h2>
                    <p className="text-sm text-[#525252] max-w-xl mx-auto leading-relaxed">
                      Your public storefront is currently displaying built-in starter entries. Click{' '}
                      <strong>Add New Perfume</strong> to create your first real SKU, or import the 8 starter house listings to customize their names, notes, and SZL pricing.
                    </p>
                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={openCreatePerfume}
                        className="px-6 py-3 bg-[#0A0A0A] text-white hover:bg-[#262626] rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add New Perfume</span>
                      </button>
                      <button
                        type="button"
                        disabled={importingStarter}
                        onClick={handleImportStarter}
                        className="px-6 py-3 border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        <span>{importingStarter ? 'Importing...' : 'Import 8 Starter Entries'}</span>
                      </button>
                    </div>
                  </div>
                ) : filteredLivePerfumes.length === 0 ? (
                  <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-6 sm:p-10 text-center space-y-3">
                    <p className="text-lg font-bold text-[#0A0A0A]">
                      No matching fragrances found
                    </p>
                    <p className="text-xs text-[#525252]">
                      Try clearing the search query or switching your active inventory filter.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setInventorySearch('');
                        setInventoryFilter('all');
                      }}
                      className="px-4 py-2 rounded-full border border-[#0A0A0A] text-xs font-semibold hover:bg-[#0A0A0A] hover:text-white transition-colors"
                    >
                      Reset Filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleLivePerfumes.map((product, idx) => (
                      <div
                        key={product.id}
                        className="bg-white border border-[#E5E5E5] hover:border-[#0A0A0A]/40 rounded-2xl p-3.5 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 sm:gap-4 transition-colors"
                      >
                        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white border border-[#F0F0F0] rounded-xl shrink-0 overflow-hidden">
                            <ResilientImage
                              src={product.image}
                              alt={product.name}
                              fallbackTitle={product.name}
                              loading={idx < 8 ? 'eager' : 'lazy'}
                              className="w-full h-full object-cover saturate-[1.12] contrast-[1.03]"
                            />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] uppercase tracking-wider text-[#525252]">
                              <span className="font-bold text-[#0A0A0A]">
                                {product.brand}
                              </span>
                              <span>·</span>
                              <span>{product.category}</span>
                              <span className="px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#0A0A0A] border border-[#E5E5E5] text-[10px] font-semibold">
                                {getBranchAvailabilityLabel(product)}
                              </span>
                              {product.isUnboxed && (
                                <span className="px-2 py-0.5 rounded-full bg-[#0A0A0A] text-white text-[10px] font-semibold">
                                  Unboxed
                                </span>
                              )}
                              {product.isNewArrival && (
                                <span className="px-2 py-0.5 rounded-full bg-[#0A0A0A] text-[#FACC15] border border-[#FACC15]/50 text-[10px] font-bold">
                                  New Arrival
                                </span>
                              )}
                              {product.bestseller && (
                                <span className="px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#0A0A0A] text-[10px] font-semibold">
                                  Best Seller
                                </span>
                              )}
                              {product.onSpecial && (
                                <span className="px-2 py-0.5 bg-[#FACC15] text-[#0A0A0A] rounded-full text-[10px] font-bold">
                                  {product.specialLabel || 'SPECIAL'}
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

                            <h3 className="text-base sm:text-xl font-bold text-[#0A0A0A] leading-snug line-clamp-2 sm:truncate">
                              {product.name}
                            </h3>

                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {product.sizes.map((s, sizeIdx) => {
                                const eff = getEffectiveUnitPrice(
                                  s.price,
                                  product.onSpecial,
                                  product.specialDiscountPercent,
                                  product.specialDiscountType,
                                  product.specialDiscountAmount,
                                  s.size,
                                  product.sizes
                                );
                                const discounted =
                                  s.available &&
                                  Boolean(product.onSpecial) &&
                                  eff !== null &&
                                  s.price !== null &&
                                  eff < s.price;
                                return (
                                  <span
                                    key={`${product.id}-${s.size}-${sizeIdx}`}
                                    className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] border rounded-lg tabular-nums ${
                                      s.available
                                        ? 'bg-[#F8F8F9] border-[#E5E5E5] text-[#0A0A0A]'
                                        : 'opacity-45 border-[#E5E5E5] line-through'
                                    }`}
                                  >
                                    <strong>{s.size}:</strong>{' '}
                                    {!s.available ? (
                                      'Off'
                                    ) : discounted ? (
                                      <>
                                        <span className="text-[#DC2626] font-bold">
                                          {formatPrice(eff)}
                                        </span>{' '}
                                        <span className="text-[#737373] line-through text-[10px]">
                                          {formatPrice(s.price)}
                                        </span>
                                      </>
                                    ) : (
                                      formatPrice(eff)
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2.5 border-t border-[#F0F0F0] xl:border-t-0 xl:pt-0 shrink-0 w-full xl:w-auto">
                          {/* Inline Stock Status Picker */}
                          <select
                            value={product.availability}
                            disabled={updatingStatusId === product.id}
                            onChange={(e) =>
                              handleQuickAvailabilityChange(
                                product,
                                e.target.value as AvailabilityStatus
                              )
                            }
                            aria-label={`Stock status for ${product.name}`}
                            className={`flex-1 sm:flex-none min-w-[120px] px-3 py-2 text-xs font-semibold border rounded-full cursor-pointer focus:outline-none ${getAvailabilityBadgeClass(
                              product.availability
                            )}`}
                          >
                            <option value="In Stock">In Stock</option>
                            <option value="Low Stock">Low Stock</option>
                            <option value="Out of Stock">Out of Stock</option>
                            <option value="Pre-Order">Pre-Order</option>
                          </select>

                          <button
                            type="button"
                            onClick={() => {
                              const nextOnSpecial = !product.onSpecial;
                              const hasFixed =
                                product.specialDiscountType === 'fixed' &&
                                (product.specialDiscountAmount ?? 0) > 0;
                              const nextType: SpecialDiscountType =
                                product.specialDiscountType === 'fixed' ||
                                product.specialDiscountType === 'percentage'
                                  ? product.specialDiscountType
                                  : bulkSpecialType;
                              const nextPct =
                                nextType === 'percentage'
                                  ? product.specialDiscountPercent ||
                                    (bulkSpecialType === 'percentage'
                                      ? Number(bulkSpecialDiscount) || 20
                                      : 20)
                                  : 0;
                              const nextAmt =
                                nextType === 'fixed'
                                  ? product.specialDiscountAmount ||
                                    (bulkSpecialType === 'fixed'
                                      ? Number(bulkSpecialDiscount) || 100
                                      : 100)
                                  : hasFixed
                                  ? product.specialDiscountAmount
                                  : 0;
                              const persistPromise = togglePerfumeSpecial(
                                product,
                                nextOnSpecial,
                                nextPct,
                                campaign.badgeText || 'Black Friday Special',
                                nextType,
                                nextAmt
                              );
                              onNotify(
                                nextOnSpecial ? 'Added to Specials' : 'Removed from Specials',
                                `${product.name} updated.`
                              );
                              void persistPromise.catch((err) => {
                                onNotify(
                                  'Special Toggle Failed',
                                  extractReadableError(err, 'Could not update special status.')
                                );
                              });
                            }}
                            className={`px-3 py-2 text-xs font-semibold border rounded-full transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                              product.onSpecial
                                ? 'bg-[#FACC15] text-[#0A0A0A] border-[#FACC15]'
                                : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                            }`}
                          >
                            <Flame className="w-3.5 h-3.5" />
                            <span>{product.onSpecial ? 'On Special' : 'Add Special'}</span>
                          </button>

                          <div className="flex items-center gap-1.5 ml-auto sm:ml-0">
                            <button
                              type="button"
                              onClick={() => openDuplicatePerfume(product)}
                              title="Duplicate as new perfume"
                              aria-label={`Duplicate ${product.name}`}
                              className="p-2 border border-[#D4D4D4] text-[#525252] hover:text-[#0A0A0A] hover:border-[#0A0A0A] rounded-full transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => openEditPerfume(product)}
                              className="px-3.5 py-2 text-xs font-semibold border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] rounded-full inline-flex items-center gap-1.5"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            {confirmDeletePerfumeId === product.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await deletePerfume(product.id);
                                      setConfirmDeletePerfumeId(null);
                                      onNotify('Perfume Deleted', `${product.name} removed.`);
                                    } catch (err) {
                                      onNotify(
                                        'Delete Failed',
                                        extractReadableError(err, 'Could not remove perfume.')
                                      );
                                    }
                                  }}
                                  className="px-3 py-2 bg-[#DC2626] text-white rounded-full text-xs font-semibold"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeletePerfumeId(null)}
                                  className="px-3 py-2 border border-[#D4D4D4] rounded-full text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeletePerfumeId(product.id)}
                                aria-label={`Delete ${product.name}`}
                                className="p-2 border border-[#D4D4D4] rounded-full text-[#525252] hover:text-[#DC2626] hover:border-[#DC2626]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {visibleLivePerfumes.length < filteredLivePerfumes.length && (
                      <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            setInventoryVisibleCount((prev) =>
                              Math.min(prev + 40, filteredLivePerfumes.length)
                            )
                          }
                          className="px-5 py-2.5 rounded-full border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider tabular-nums"
                        >
                          Show 40 More Perfumes ({visibleLivePerfumes.length} / {filteredLivePerfumes.length} shown)
                        </button>
                        <button
                          type="button"
                          onClick={() => setInventoryVisibleCount(filteredLivePerfumes.length)}
                          className="px-4 py-2.5 rounded-full border border-[#D4D4D4] text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors text-xs font-medium"
                        >
                          Show All
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SPECIALS & COUNTDOWN */}
            {activeTab === 'specials' && (
              <div className="space-y-5 sm:space-y-8">
                {/* Weekly 5ml Special Manager (4 for E100 / 2 for E50) */}
                <form
                  onSubmit={handleSaveWeeklySpecial}
                  className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-5">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                        Discovery Scent Bar · {resolvedWeeklyDraft.weekLabel}
                      </p>
                      <h2 className="text-2xl font-bold text-[#0A0A0A]">
                        Weekly 5ml Special (4 for E100 / 2 for E50)
                      </h2>
                      <p className="text-xs text-[#525252]">
                        Draws separate <strong>For Women</strong> and <strong>For Men</strong> lineups (3 Under E500 options + 3 Under E800 options = 6 options each). Customers choose any 2 from the 3 Under E500 options for E50 (2 × 5ml), or 2 from each tier for E100 (4 × 5ml).
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E5E5E5] bg-[#F6F6F7] cursor-pointer text-xs font-medium">
                        <input
                          type="checkbox"
                          checked={weeklyDraft.autoRotateWeekly}
                          onChange={(e) =>
                            setWeeklyDraft((prev) => ({
                              ...prev,
                              autoRotateWeekly: e.target.checked,
                            }))
                          }
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <span>Auto-rotate weekly</span>
                      </label>

                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E5E5E5] bg-[#F6F6F7] cursor-pointer text-xs font-semibold">
                        <input
                          type="checkbox"
                          checked={weeklyDraft.enabled}
                          onChange={(e) =>
                            setWeeklyDraft((prev) => ({
                              ...prev,
                              enabled: e.target.checked,
                            }))
                          }
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                            weeklyDraft.enabled
                              ? 'bg-[#FACC15] text-[#0A0A0A]'
                              : 'bg-[#E5E5E5] text-[#525252]'
                          }`}
                        >
                          {weeklyDraft.enabled ? 'Live' : 'Off'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Gender Tabs (For Women / For Men) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div
                      role="tablist"
                      aria-label="Edit Women or Men weekly 5ml picks"
                      className="inline-flex p-1 rounded-2xl bg-[#F6F6F7] border border-[#E5E5E5]"
                    >
                      {(['Women', 'Men'] as const).map((tabAud) => {
                        const isSelected = weeklyAudienceTab === tabAud;
                        const lineup =
                          tabAud === 'Women'
                            ? resolvedWeeklyDraft.women
                            : resolvedWeeklyDraft.men;
                        const totalAudCount =
                          lineup.under500Picks.length + lineup.under800Picks.length;
                        return (
                          <button
                            key={tabAud}
                            type="button"
                            role="tab"
                            aria-selected={isSelected}
                            onClick={() => setWeeklyAudienceTab(tabAud)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-[0.12em] transition-all whitespace-nowrap ${
                              isSelected
                                ? 'bg-[#0A0A0A] text-[#FACC15]'
                                : 'text-[#525252] hover:text-[#0A0A0A]'
                            }`}
                          >
                            For {tabAud} ({totalAudCount}/6)
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-[11px] text-[#525252]">
                      Editing <strong>For {weeklyAudienceTab}</strong> weekly lineup (3 Under E500 + 3 Under E800 = 6 options)
                    </p>
                  </div>

                  {(() => {
                    const activeAudienceLineup =
                      weeklyAudienceTab === 'Women'
                        ? resolvedWeeklyDraft.women
                        : resolvedWeeklyDraft.men;
                    const key500: 'womenUnder500Ids' | 'menUnder500Ids' =
                      weeklyAudienceTab === 'Women' ? 'womenUnder500Ids' : 'menUnder500Ids';
                    const key800: 'womenUnder800Ids' | 'menUnder800Ids' =
                      weeklyAudienceTab === 'Women' ? 'womenUnder800Ids' : 'menUnder800Ids';

                    return (
                      <>
                        {(activeAudienceLineup.usingFallbackTiers ||
                          activeAudienceLineup.usingUnisexSupplement) && (
                          <div className="px-4 py-3 rounded-2xl bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]">
                            {activeAudienceLineup.usingUnisexSupplement
                              ? `Note: Fewer than 6 strict ${weeklyAudienceTab} fragrances matched both price tiers, so Unisex in-stock options were included to fill all 6 slots.`
                              : `Note: Fewer than 3 in-stock ${weeklyAudienceTab} full bottles were found under E500 or 3 under E501–E800, so lower-priced decant/mid-bottle fallbacks were included to keep all slots filled.`}
                          </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Under E500 Picks (3 Options -> Customer Picks 2) */}
                          <div className="p-4 sm:p-5 rounded-2xl bg-[#F6F6F7] border border-[#E5E5E5] space-y-4">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0A0A0A]">
                                  For {weeklyAudienceTab} · 3 Options Under E500 (Customers Choose 2)
                                </span>
                                <p className="text-[11px] text-[#525252]">
                                  Customers pick any 2 of these 3 for 2 × 5ml (E{weeklyDraft.twoPackPrice}) or 4 × 5ml (E{weeklyDraft.fourPackPrice})
                                </p>
                              </div>
                            </div>

                            {[0, 1, 2].map((slotIdx) => {
                              const chosenCandidate =
                                activeAudienceLineup.under500Picks[slotIdx];
                              const chosenId = chosenCandidate?.product.id ?? '';
                              const pickedElsewhereIds = new Set(
                                activeAudienceLineup.under500Picks
                                  .filter((_, idx) => idx !== slotIdx)
                                  .map((c) => c.product.id)
                              );
                              return (
                                <div
                                  key={`${weeklyAudienceTab}-u500-slot-${slotIdx}`}
                                  className="space-y-1.5"
                                >
                                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
                                    For {weeklyAudienceTab} Under E500 Option {slotIdx + 1}
                                  </label>
                                  <SearchablePerfumeSelect
                                    value={chosenId}
                                    ariaLabel={`Select For ${weeklyAudienceTab} Under E500 Option ${slotIdx + 1}`}
                                    searchPlaceholder="Search perfume name or house..."
                                    options={activeAudienceLineup.under500Pool.map((opt) => ({
                                      product: opt.product,
                                      detailLabel:
                                        opt.tierPrice !== null
                                          ? `${opt.tierSizeLabel} E${opt.tierPrice.toFixed(0)}`
                                          : undefined,
                                      badgeText: pickedElsewhereIds.has(opt.product.id)
                                        ? 'Another slot'
                                        : undefined,
                                    }))}
                                    onChange={(nextId) => {
                                      setWeeklyDraft((prev) => {
                                        const currentIds =
                                          activeAudienceLineup.under500Picks.map(
                                            (c) => c.product.id
                                          );
                                        currentIds[slotIdx] = nextId;
                                        const next500: string[] = [];
                                        const seen = new Set<string>();
                                        for (let i = 0; i < currentIds.length; i += 1) {
                                          const id = currentIds[i];
                                          if (!id) continue;
                                          if (i !== slotIdx && id === nextId) continue;
                                          if (!seen.has(id)) {
                                            seen.add(id);
                                            next500.push(id);
                                          }
                                        }
                                        const capped500 = next500.slice(0, 3);
                                        const next800 = activeAudienceLineup.under800Picks
                                          .map((c) => c.product.id)
                                          .filter((id) => !capped500.includes(id));
                                        return {
                                          ...prev,
                                          weekKey: resolvedWeeklyDraft.weekKey,
                                          [key500]: capped500,
                                          [key800]: next800,
                                        };
                                      });
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          {/* Under E800 Picks (3 Options -> Customer Picks 2 for 4 x 5ml) */}
                          <div className="p-4 sm:p-5 rounded-2xl bg-[#F6F6F7] border border-[#E5E5E5] space-y-4">
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0A0A0A]">
                                  For {weeklyAudienceTab} · 3 Options Under E800 (Customers Choose 2)
                                </span>
                                <p className="text-[11px] text-[#525252]">
                                  Customers pick any 2 of these 3 ONLY in 4 × 5ml (E{weeklyDraft.fourPackPrice}) — locked out of E{weeklyDraft.twoPackPrice} option
                                </p>
                              </div>
                            </div>

                            {[0, 1, 2].map((slotIdx) => {
                              const chosenCandidate =
                                activeAudienceLineup.under800Picks[slotIdx];
                              const chosenId = chosenCandidate?.product.id ?? '';
                              const pickedElsewhereIds = new Set(
                                activeAudienceLineup.under800Picks
                                  .filter((_, idx) => idx !== slotIdx)
                                  .map((c) => c.product.id)
                              );
                              return (
                                <div
                                  key={`${weeklyAudienceTab}-u800-slot-${slotIdx}`}
                                  className="space-y-1.5"
                                >
                                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
                                    For {weeklyAudienceTab} Under E800 Option {slotIdx + 1}
                                  </label>
                                  <SearchablePerfumeSelect
                                    value={chosenId}
                                    ariaLabel={`Select For ${weeklyAudienceTab} Under E800 Option ${slotIdx + 1}`}
                                    searchPlaceholder="Search perfume name or house..."
                                    options={activeAudienceLineup.under800Pool.map((opt) => ({
                                      product: opt.product,
                                      detailLabel:
                                        opt.tierPrice !== null
                                          ? `${opt.tierSizeLabel} E${opt.tierPrice.toFixed(0)}`
                                          : undefined,
                                      badgeText: pickedElsewhereIds.has(opt.product.id)
                                        ? 'Another slot'
                                        : undefined,
                                    }))}
                                    onChange={(nextId) => {
                                      setWeeklyDraft((prev) => {
                                        const currentIds =
                                          activeAudienceLineup.under800Picks.map(
                                            (c) => c.product.id
                                          );
                                        currentIds[slotIdx] = nextId;
                                        const fixed500 =
                                          activeAudienceLineup.under500Picks.map(
                                            (c) => c.product.id
                                          );
                                        const fixed500Set = new Set(fixed500);
                                        const next800: string[] = [];
                                        const seen = new Set<string>();
                                        for (let i = 0; i < currentIds.length; i += 1) {
                                          const id = currentIds[i];
                                          if (!id || fixed500Set.has(id)) continue;
                                          if (i !== slotIdx && id === nextId) continue;
                                          if (!seen.has(id)) {
                                            seen.add(id);
                                            next800.push(id);
                                          }
                                        }
                                        return {
                                          ...prev,
                                          weekKey: resolvedWeeklyDraft.weekKey,
                                          [key500]: fixed500,
                                          [key800]: next800.slice(0, 3),
                                        };
                                      });
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Pricing + Randomize + Save Row */}
                  <div className="pt-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 sm:gap-4">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
                          4 × 5ml Pack (E)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          value={weeklyDraft.fourPackPrice}
                          onChange={(e) =>
                            setWeeklyDraft((prev) => ({
                              ...prev,
                              fourPackPrice: Number(e.target.value || 100),
                            }))
                          }
                          className="w-full sm:w-32 px-3 py-2 border border-[#D4D4D4] rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
                          2 × 5ml Pack (E)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          value={weeklyDraft.twoPackPrice}
                          onChange={(e) =>
                            setWeeklyDraft((prev) => ({
                              ...prev,
                              twoPackPrice: Number(e.target.value || 50),
                            }))
                          }
                          className="w-full sm:w-32 px-3 py-2 border border-[#D4D4D4] rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => handleRandomizeWeeklyPicks(weeklyAudienceTab)}
                        className="px-3 sm:px-4 py-2.5 sm:py-3 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] hover:bg-[#F6F6F7] transition-colors text-[11px] sm:text-xs font-semibold uppercase tracking-[0.08em] sm:tracking-[0.12em] inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                        <span>Random {weeklyAudienceTab}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRandomizeWeeklyPicks('Both')}
                        className="px-3 sm:px-5 py-2.5 sm:py-3 rounded-full border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#F6F6F7] transition-colors text-[11px] sm:text-xs font-semibold uppercase tracking-[0.08em] sm:tracking-[0.12em] inline-flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                        <span>Random Both</span>
                      </button>

                      <button
                        type="submit"
                        disabled={savingWeeklySpecial}
                        className="col-span-2 sm:col-span-1 px-6 py-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-[0.12em] inline-flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <Check className="w-3.5 h-3.5 text-[#FACC15]" />
                        <span>
                          {savingWeeklySpecial ? 'Saving...' : 'Save Weekly 5ml Special'}
                        </span>
                      </button>
                    </div>
                  </div>
                </form>

                {/* Exclusive 5ml Special (Owner Custom Picks & Custom Prices) */}
                <form
                  onSubmit={handleSaveExclusiveSpecial}
                  className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-5">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium inline-flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-[#0A0A0A]" />
                        <span>Owner Custom Special Offer</span>
                      </p>
                      <h2 className="text-2xl font-bold text-[#0A0A0A]">
                        Exclusive Special (Pick Any Perfume, Size &amp; Price)
                      </h2>
                      <p className="text-xs text-[#525252]">
                        Curate up to 6 perfumes from any category (Men, Women, Unisex, or Kiddies), pick any size (5ml, 10ml, 30ml, 100ml, or custom), and set your own special price — plus an optional bundle price.
                      </p>
                    </div>

                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E5E5E5] bg-[#F6F6F7] cursor-pointer text-xs font-semibold shrink-0 self-start lg:self-auto">
                      <input
                        type="checkbox"
                        checked={Boolean(weeklyDraft.exclusiveEnabled)}
                        onChange={(e) =>
                          setWeeklyDraft((prev) => ({
                            ...prev,
                            exclusiveEnabled: e.target.checked,
                          }))
                        }
                        className="accent-[#0A0A0A] w-4 h-4"
                      />
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                          weeklyDraft.exclusiveEnabled
                            ? 'bg-[#FACC15] text-[#0A0A0A]'
                            : 'bg-[#E5E5E5] text-[#525252]'
                        }`}
                      >
                        {weeklyDraft.exclusiveEnabled ? 'Live' : 'Off'}
                      </span>
                    </label>
                  </div>

                  {/* Header Copy Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
                        Badge Text
                      </label>
                      <input
                        type="text"
                        maxLength={40}
                        value={weeklyDraft.exclusiveBadge ?? ''}
                        onChange={(e) =>
                          setWeeklyDraft((prev) => ({
                            ...prev,
                            exclusiveBadge: e.target.value,
                          }))
                        }
                        placeholder="OWNER EXCLUSIVE"
                        className="w-full px-3.5 py-2 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
                        Exclusive Special Headline
                      </label>
                      <input
                        type="text"
                        maxLength={100}
                        value={weeklyDraft.exclusiveTitle ?? ''}
                        onChange={(e) =>
                          setWeeklyDraft((prev) => ({
                            ...prev,
                            exclusiveTitle: e.target.value,
                          }))
                        }
                        placeholder="Exclusive Owner Reserve"
                        className="w-full px-3.5 py-2 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <div className="sm:col-span-3 space-y-1.5">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
                        Short Description
                      </label>
                      <input
                        type="text"
                        maxLength={240}
                        value={weeklyDraft.exclusiveSubtitle ?? ''}
                        onChange={(e) =>
                          setWeeklyDraft((prev) => ({
                            ...prev,
                            exclusiveSubtitle: e.target.value,
                          }))
                        }
                        placeholder="Hand-picked fragrances in 5ml, 10ml, or full bottles individually priced by AuraHut Co."
                        className="w-full px-3.5 py-2 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                  </div>

                  {/* Add Perfume + Flexible Size + Custom Price Row */}
                  {(() => {
                    const BASE_EXCLUSIVE_SIZES = [
                      '5ml',
                      '10ml',
                      '15ml',
                      '20ml',
                      '30ml',
                      '50ml',
                      '100ml',
                    ];
                    const currentExclusive = weeklyDraft.exclusiveItems ?? [];
                    const selectedIdsSet = new Set(currentExclusive.map((it) => it.perfumeId));
                    const availableToAdd = catalogForBuilders.filter(
                      (p) => p.availability !== 'Out of Stock' && !selectedIdsSet.has(p.id)
                    );
                    const effectivePickerId =
                      availableToAdd.some((p) => p.id === exclusivePickerId)
                        ? exclusivePickerId
                        : availableToAdd[0]?.id ?? '';
                    const selectedAddProduct = availableToAdd.find(
                      (p) => p.id === effectivePickerId
                    );
                    const normalizeSizeKey = (val: string) =>
                      val.trim().toLowerCase().replace(/\s+/g, '');
                    const buildSizeOptionsForProduct = (product?: typeof selectedAddProduct) => {
                      const opts = [...BASE_EXCLUSIVE_SIZES];
                      const seenKeys = new Set(opts.map(normalizeSizeKey));
                      if (product) {
                        for (const s of product.sizes) {
                          const label = s.size.trim();
                          const k = normalizeSizeKey(label);
                          if (label && !seenKeys.has(k)) {
                            seenKeys.add(k);
                            opts.push(label);
                          }
                        }
                      }
                      return opts;
                    };
                    const addSizeOptions = buildSizeOptionsForProduct(selectedAddProduct);
                    const addMatchesPreset = addSizeOptions.some(
                      (opt) => normalizeSizeKey(opt) === normalizeSizeKey(exclusivePickerSize)
                    );

                    return (
                      <div className="p-4 sm:p-5 rounded-2xl bg-[#F6F6F7] border border-[#E5E5E5] space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0A0A0A]">
                            Exclusive Perfumes, Sizes &amp; Prices ({currentExclusive.length}/6)
                          </span>
                          <span className="text-[11px] text-[#525252]">
                            Choose 5ml, 10ml, bottle size, or any custom label + price
                          </span>
                        </div>

                        {currentExclusive.length < 6 && availableToAdd.length > 0 && (
                          <div className="flex flex-col lg:flex-row lg:items-end gap-2.5">
                            <div className="flex-1 min-w-0 space-y-1">
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
                                Select Perfume
                              </label>
                              <SearchablePerfumeSelect
                                value={effectivePickerId}
                                ariaLabel="Select perfume for Exclusive Special"
                                searchPlaceholder="Search any perfume by name, house, or category..."
                                options={availableToAdd.map((p) => {
                                  const targetSizeKey = normalizeSizeKey(exclusivePickerSize || '5ml');
                                  const matchedSize =
                                    p.sizes.find(
                                      (s) =>
                                        s.available &&
                                        s.price !== null &&
                                        normalizeSizeKey(s.size) === targetSizeKey
                                    ) ??
                                    p.sizes.find((s) => s.available && s.price !== null);
                                  return {
                                    product: p,
                                    detailLabel: matchedSize?.price
                                      ? `Reg. ${matchedSize.size} ${formatPrice(matchedSize.price)}`
                                      : undefined,
                                  };
                                })}
                                onChange={(nextId) => setExclusivePickerId(nextId)}
                              />
                            </div>

                            <div className="w-full sm:w-44 space-y-1">
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
                                Size (5ml, 10ml, Custom)
                              </label>
                              {exclusivePickerCustomMode || !addMatchesPreset ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    maxLength={40}
                                    value={exclusivePickerSize}
                                    onChange={(e) => setExclusivePickerSize(e.target.value)}
                                    placeholder="e.g. 10ml or 100ml"
                                    className="w-full px-2.5 py-2 bg-white border border-[#0A0A0A] rounded-xl text-xs font-bold focus:outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExclusivePickerCustomMode(false);
                                      if (!addMatchesPreset) setExclusivePickerSize('5ml');
                                    }}
                                    className="px-2 py-2 rounded-xl border border-[#D4D4D4] bg-white text-[10px] font-semibold text-[#525252] hover:text-[#0A0A0A] shrink-0"
                                    title="Switch back to preset size list"
                                  >
                                    List
                                  </button>
                                </div>
                              ) : (
                                <select
                                  aria-label="Select size for Exclusive Special"
                                  value={
                                    addSizeOptions.find(
                                      (opt) =>
                                        normalizeSizeKey(opt) ===
                                        normalizeSizeKey(exclusivePickerSize)
                                    ) ?? '5ml'
                                  }
                                  onChange={(e) => {
                                    if (e.target.value === '__custom__') {
                                      setExclusivePickerCustomMode(true);
                                    } else {
                                      setExclusivePickerCustomMode(false);
                                      setExclusivePickerSize(e.target.value);
                                    }
                                  }}
                                  className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs font-bold focus:outline-none focus:border-[#0A0A0A]"
                                >
                                  {addSizeOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                  <option value="__custom__">Custom size...</option>
                                </select>
                              )}
                            </div>

                            <div className="w-full sm:w-32 space-y-1">
                              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
                                Special Price (E)
                              </label>
                              <input
                                type="number"
                                min={1}
                                max={50000}
                                step="any"
                                value={exclusivePickerPrice}
                                onChange={(e) => setExclusivePickerPrice(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs font-bold tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (!effectivePickerId) return;
                                const priceVal = Math.min(
                                  50000,
                                  Math.max(1, Number(exclusivePickerPrice || 35))
                                );
                                const cleanSize =
                                  exclusivePickerSize.trim().slice(0, 40) || '5ml';
                                setWeeklyDraft((prev) => ({
                                  ...prev,
                                  exclusiveItems: [
                                    ...(prev.exclusiveItems ?? []),
                                    {
                                      perfumeId: effectivePickerId,
                                      sizeLabel: cleanSize,
                                      customPrice: priceVal,
                                    },
                                  ].slice(0, 6),
                                }));
                              }}
                              className="px-4 py-2 rounded-xl bg-[#0A0A0A] text-white hover:bg-[#262626] text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5 text-[#FACC15]" />
                              <span>Add Perfume</span>
                            </button>
                          </div>
                        )}

                        {currentExclusive.length === 0 ? (
                          <div className="py-6 text-center rounded-xl border border-dashed border-[#D4D4D4] bg-white text-xs text-[#666666]">
                            No Exclusive Special perfumes selected yet. Pick a perfume, choose any size (5ml, 10ml, bottle, or custom), and set its special price.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {currentExclusive.map((entry, idx) => {
                              const product = catalogForBuilders.find(
                                (p) => p.id === entry.perfumeId
                              );
                              const currentSizeLabel = (entry.sizeLabel ?? '').trim() || '5ml';
                              const rowSizeOptions = buildSizeOptionsForProduct(product);
                              const rowMatchesPreset = rowSizeOptions.some(
                                (opt) =>
                                  normalizeSizeKey(opt) === normalizeSizeKey(currentSizeLabel)
                              );
                              const isCustomRow =
                                Boolean(exclusiveCustomRowIds[entry.perfumeId]) ||
                                !rowMatchesPreset;

                              return (
                                <div
                                  key={`${entry.perfumeId}-${idx}`}
                                  className="p-3 bg-white border border-[#E5E5E5] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {product && (
                                      <div className="w-10 h-10 rounded-lg bg-[#F6F6F7] border border-[#E5E5E5] overflow-hidden shrink-0">
                                        <ResilientImage
                                          src={product.image}
                                          alt={product.name}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold text-[#0A0A0A] truncate">
                                        {product?.name ?? entry.perfumeId}
                                      </p>
                                      <p className="text-[11px] text-[#525252] truncate">
                                        {product
                                          ? `${product.brand} · ${product.category}`
                                          : 'Perfume listing'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
                                      Size
                                    </label>
                                    {isCustomRow ? (
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="text"
                                          maxLength={40}
                                          value={entry.sizeLabel ?? '5ml'}
                                          onChange={(e) => {
                                            const val = e.target.value.slice(0, 40);
                                            setWeeklyDraft((prev) => ({
                                              ...prev,
                                              exclusiveItems: (prev.exclusiveItems ?? []).map(
                                                (it, i) =>
                                                  i === idx ? { ...it, sizeLabel: val } : it
                                              ),
                                            }));
                                          }}
                                          placeholder="Size"
                                          className="w-24 px-2 py-1.5 border border-[#0A0A0A] rounded-lg text-xs font-bold focus:outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setExclusiveCustomRowIds((prev) => ({
                                              ...prev,
                                              [entry.perfumeId]: false,
                                            }));
                                            if (!rowMatchesPreset) {
                                              setWeeklyDraft((prev) => ({
                                                ...prev,
                                                exclusiveItems: (prev.exclusiveItems ?? []).map(
                                                  (it, i) =>
                                                    i === idx ? { ...it, sizeLabel: '5ml' } : it
                                                ),
                                              }));
                                            }
                                          }}
                                          className="px-2 py-1.5 rounded-lg border border-[#D4D4D4] text-[10px] font-semibold text-[#525252] hover:text-[#0A0A0A]"
                                        >
                                          List
                                        </button>
                                      </div>
                                    ) : (
                                      <select
                                        aria-label={`Select size for ${product?.name ?? 'perfume'}`}
                                        value={
                                          rowSizeOptions.find(
                                            (opt) =>
                                              normalizeSizeKey(opt) ===
                                              normalizeSizeKey(currentSizeLabel)
                                          ) ?? '5ml'
                                        }
                                        onChange={(e) => {
                                          if (e.target.value === '__custom__') {
                                            setExclusiveCustomRowIds((prev) => ({
                                              ...prev,
                                              [entry.perfumeId]: true,
                                            }));
                                          } else {
                                            setExclusiveCustomRowIds((prev) => ({
                                              ...prev,
                                              [entry.perfumeId]: false,
                                            }));
                                            setWeeklyDraft((prev) => ({
                                              ...prev,
                                              exclusiveItems: (prev.exclusiveItems ?? []).map(
                                                (it, i) =>
                                                  i === idx
                                                    ? { ...it, sizeLabel: e.target.value }
                                                    : it
                                              ),
                                            }));
                                          }
                                        }}
                                        className="w-28 px-2 py-1.5 border border-[#D4D4D4] rounded-lg text-xs font-bold focus:outline-none focus:border-[#0A0A0A]"
                                      >
                                        {rowSizeOptions.map((opt) => (
                                          <option key={opt} value={opt}>
                                            {opt}
                                          </option>
                                        ))}
                                        <option value="__custom__">Custom size...</option>
                                      </select>
                                    )}

                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-[#525252] ml-1">
                                      Price (E)
                                    </label>
                                    <input
                                      type="number"
                                      min={1}
                                      max={50000}
                                      step="any"
                                      value={entry.customPrice}
                                      onChange={(e) => {
                                        const val = Math.max(
                                          1,
                                          Math.min(50000, Number(e.target.value || 1))
                                        );
                                        setWeeklyDraft((prev) => ({
                                          ...prev,
                                          exclusiveItems: (prev.exclusiveItems ?? []).map(
                                            (it, i) =>
                                              i === idx ? { ...it, customPrice: val } : it
                                          ),
                                        }));
                                      }}
                                      className="w-24 px-2.5 py-1.5 border border-[#D4D4D4] rounded-lg text-xs font-bold tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setWeeklyDraft((prev) => ({
                                          ...prev,
                                          exclusiveItems: (prev.exclusiveItems ?? []).filter(
                                            (_, i) => i !== idx
                                          ),
                                        }))
                                      }
                                      aria-label={`Remove ${product?.name ?? 'perfume'} from Exclusive Special`}
                                      className="p-1.5 rounded-lg border border-[#D4D4D4] text-[#525252] hover:text-[#DC2626] hover:border-[#DC2626]"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Optional Bundle Deal Row + Save CTA */}
                  <div className="pt-2 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-[#E5E5E5] bg-[#F6F6F7] cursor-pointer text-xs font-medium">
                        <input
                          type="checkbox"
                          checked={Boolean(weeklyDraft.exclusiveBundleEnabled)}
                          onChange={(e) =>
                            setWeeklyDraft((prev) => ({
                              ...prev,
                              exclusiveBundleEnabled: e.target.checked,
                            }))
                          }
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <span>Also offer All-in-One Bundle Price</span>
                      </label>

                      {weeklyDraft.exclusiveBundleEnabled && (
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
                            Bundle Price (E)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={50000}
                            value={weeklyDraft.exclusiveBundlePrice || ''}
                            onChange={(e) =>
                              setWeeklyDraft((prev) => ({
                                ...prev,
                                exclusiveBundlePrice: Math.max(0, Number(e.target.value || 0)),
                              }))
                            }
                            placeholder="120"
                            className="w-28 px-3 py-2 border border-[#D4D4D4] rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                          />
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={savingExclusiveSpecial}
                      className="px-6 py-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 transition-colors text-xs font-semibold uppercase tracking-[0.12em] inline-flex items-center justify-center gap-2 whitespace-nowrap self-start md:self-auto"
                    >
                      <Check className="w-3.5 h-3.5 text-[#FACC15]" />
                      <span>
                        {savingExclusiveSpecial ? 'Saving...' : 'Save Exclusive Special'}
                      </span>
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
                {/* Campaign Banner & Timer Configurator */}
                <div className="lg:col-span-5 space-y-5 sm:space-y-6">
                  {/* Live Storefront Hero Preview */}
                  <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#0A0A0A] text-white p-4 sm:p-6 space-y-4 border border-white/10">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-12 -right-10 w-56 h-56 rounded-full"
                      style={{
                        background:
                          'radial-gradient(circle, rgba(250,204,21,0.18) 0%, rgba(10,10,10,0) 72%)',
                      }}
                    />
                    <div className="relative z-10 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FACC15]">
                        Live Hero Card Preview
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-medium text-white/80">
                        {previewShowingNewArrivals
                          ? previewMode === 'auto'
                            ? 'Auto Fallback · New Arrivals'
                            : 'New Arrivals Mode'
                          : campaignDraft.enabled
                          ? 'Specials Live'
                          : 'Specials Preview'}
                      </span>
                    </div>

                    <div className="relative z-10 space-y-3">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FACC15]">
                        {previewShowingNewArrivals
                          ? campaignDraft.newArrivalsBadge || 'JUST LANDED'
                          : campaignDraft.badgeText || 'FEATURED SPECIALS'}
                      </p>
                      <h3 className="text-2xl font-bold italic leading-tight tracking-tight">
                        <span className="text-white block">{previewHeadline[0]}</span>
                        <span className="text-[#FACC15] block">{previewHeadline[1]}</span>
                      </h3>

                      {previewShowingNewArrivals ? (
                        <div className="space-y-2">
                          <p className="text-xs text-white/75 leading-relaxed line-clamp-2">
                            {campaignDraft.newArrivalsSubtitle ||
                              'Freshly landed Arabian extraits & travel decants stocked in Manzini and Mbabane.'}
                          </p>
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] border border-[#FACC15]/45 text-[10px] font-semibold uppercase tracking-wider text-[#FACC15]">
                            <Sparkles className="w-3 h-3" />
                            <span>
                              {newArrivalPerfumes.length > 0
                                ? `${newArrivalPerfumes.length} Marked New Arrivals`
                                : 'Auto-showing latest storefront releases'}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <AdminCountdownCards endsAt={campaignDraft.endsAt} />
                      )}
                    </div>
                  </div>

                  <form
                    onSubmit={handleSaveCampaign}
                    className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5"
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-[#E5E5E5] pb-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                          Hero Showcase &amp; Promo Event
                        </p>
                        <h2 className="text-2xl font-bold text-[#0A0A0A]">
                          Specials &amp; Hero Mode
                        </h2>
                      </div>
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={campaignDraft.enabled}
                          onChange={(e) =>
                            setCampaignDraft((d) => ({ ...d, enabled: e.target.checked }))
                          }
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            campaignDraft.enabled
                              ? 'bg-[#FACC15] text-[#0A0A0A]'
                              : 'bg-[#F4F4F5] text-[#525252]'
                          }`}
                        >
                          {campaignDraft.enabled ? 'Live' : 'Off'}
                        </span>
                      </label>
                    </div>

                    {/* Hero Showcase Display Mode */}
                    <div className="p-3.5 rounded-2xl bg-[#F6F6F7] border border-[#E5E5E5] space-y-2.5">
                      <span className="block text-[11px] uppercase tracking-wider text-[#0A0A0A] font-bold">
                        Hero Section Mode
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {(
                          [
                            {
                              id: 'auto' as const,
                              label: 'Auto (Recommended)',
                              hint: 'Specials when active, else New Arrivals',
                            },
                            {
                              id: 'new-arrivals' as const,
                              label: 'New Arrivals',
                              hint: 'Force New Arrivals on Hero',
                            },
                            {
                              id: 'specials' as const,
                              label: 'Specials Only',
                              hint: 'Keep Specials hero only',
                            },
                          ] as const
                        ).map((opt) => {
                          const selected = (campaignDraft.heroMode ?? 'auto') === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setCampaignDraft((d) => ({ ...d, heroMode: opt.id }))
                              }
                              className={`p-2.5 rounded-xl border text-left transition-colors ${
                                selected
                                  ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                                  : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                              }`}
                            >
                              <span
                                className={`block text-xs font-bold ${
                                  selected ? 'text-[#FACC15]' : 'text-[#0A0A0A]'
                                }`}
                              >
                                {opt.label}
                              </span>
                              <span
                                className={`block text-[10px] mt-0.5 leading-snug ${
                                  selected ? 'text-white/75' : 'text-[#666666]'
                                }`}
                              >
                                {opt.hint}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* New Arrivals Hero Copy Settings */}
                    <div className="p-4 rounded-2xl bg-[#FAFAFA] border border-[#E5E5E5] space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0A0A0A]">
                          <Sparkles className="w-3.5 h-3.5 text-[#0A0A0A]" />
                          <span>New Arrivals Hero Copy</span>
                        </span>
                        <span className="text-[10px] font-medium text-[#666666]">
                          Shown when Hero is in New Arrivals
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
                            New Arrivals Headline
                          </label>
                          <input
                            type="text"
                            maxLength={100}
                            value={campaignDraft.newArrivalsTitle ?? 'New Arrivals'}
                            onChange={(e) =>
                              setCampaignDraft((d) => ({
                                ...d,
                                newArrivalsTitle: e.target.value,
                              }))
                            }
                            placeholder="New Arrivals"
                            className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
                            New Arrivals Badge
                          </label>
                          <input
                            type="text"
                            maxLength={40}
                            value={campaignDraft.newArrivalsBadge ?? 'JUST LANDED'}
                            onChange={(e) =>
                              setCampaignDraft((d) => ({
                                ...d,
                                newArrivalsBadge: e.target.value,
                              }))
                            }
                            placeholder="JUST LANDED"
                            className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#525252]">
                          New Arrivals Subtitle
                        </label>
                        <input
                          type="text"
                          maxLength={200}
                          value={
                            campaignDraft.newArrivalsSubtitle ??
                            'Freshly landed Arabian extraits & travel decants stocked in Manzini and Mbabane.'
                          }
                          onChange={(e) =>
                            setCampaignDraft((d) => ({
                              ...d,
                              newArrivalsSubtitle: e.target.value,
                            }))
                          }
                          placeholder="Freshly landed Arabian extraits & travel decants..."
                          className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    </div>

                    {/* Quick Campaign Presets */}
                    <div className="space-y-1.5">
                      <span className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium">
                        Quick Event Templates
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          {
                            label: 'Black Friday',
                            title: 'Black Friday Specials',
                            badgeText: 'BLACK FRIDAY',
                            announcementText:
                              'Black Friday Specials Live Now — Limited-time pricing on selected Arabian extraits & decants.',
                          },
                          {
                            label: 'Festive Edit',
                            title: 'Festive Scent Specials',
                            badgeText: 'FESTIVE OFFER',
                            announcementText:
                              'Festive Scent Specials — Curated Arabian fragrance gifts across Manzini & Mbabane.',
                          },
                          {
                            label: 'Weekend Flash',
                            title: 'Weekend Private Special',
                            badgeText: 'LIMITED OFFER',
                            announcementText:
                              'Weekend Private Special — Selected Arabian houses reduced until Sunday.',
                          },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              setCampaignDraft((d) => ({
                                ...d,
                                title: preset.title,
                                badgeText: preset.badgeText,
                                announcementText: preset.announcementText,
                                enabled: true,
                              }))
                            }
                            className="px-3.5 py-1.5 border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Hero Headline (Splits Across 2 Lines)
                      </label>
                      <input
                        type="text"
                        value={campaignDraft.title}
                        onChange={(e) =>
                          setCampaignDraft((d) => ({ ...d, title: e.target.value }))
                        }
                        required
                        maxLength={100}
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Badge Label
                        </label>
                        <input
                          type="text"
                          value={campaignDraft.badgeText}
                          onChange={(e) =>
                            setCampaignDraft((d) => ({ ...d, badgeText: e.target.value }))
                          }
                          required
                          maxLength={40}
                          placeholder="BLACK FRIDAY"
                          className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Internal Social Code Note
                        </label>
                        <input
                          type="text"
                          value={campaignDraft.promoCodeHint}
                          onChange={(e) =>
                            setCampaignDraft((d) => ({
                              ...d,
                              promoCodeHint: e.target.value.toUpperCase(),
                            }))
                          }
                          maxLength={32}
                          placeholder="Not shown on site"
                          className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm font-mono uppercase focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    </div>

                    {/* How Long Specials Run */}
                    <div className="p-4 rounded-2xl bg-[#F6F6F7] border border-[#E5E5E5] space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
                          How Long Specials Run
                        </label>
                        {campaignDraft.endsAt && (
                          <button
                            type="button"
                            onClick={() =>
                              setCampaignDraft((d) => ({ ...d, endsAt: '' }))
                            }
                            className="text-[11px] font-medium underline text-[#525252] hover:text-[#0A0A0A]"
                          >
                            Clear Timer
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '24 Hours', hours: 24 },
                          { label: '3 Days', hours: 72 },
                          { label: '7 Days', hours: 168 },
                          { label: '14 Days', hours: 336 },
                          { label: '30 Days', hours: 720 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              setCampaignDraft((d) => ({
                                ...d,
                                endsAt: new Date(
                                  Date.now() + preset.hours * 3600000
                                ).toISOString(),
                              }))
                            }
                            className="px-3 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-[11px] font-semibold text-[#0A0A0A]"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <span className="block text-[10px] uppercase tracking-wider text-[#666666]">
                            Set Custom Days
                          </span>
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              min={1}
                              max={365}
                              value={customDurationDays}
                              onChange={(e) => setCustomDurationDays(e.target.value)}
                              className="w-20 px-2.5 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const days = Math.min(
                                  365,
                                  Math.max(1, Number.parseInt(customDurationDays || '7', 10) || 7)
                                );
                                setCampaignDraft((d) => ({
                                  ...d,
                                  endsAt: new Date(Date.now() + days * 86400000).toISOString(),
                                }));
                              }}
                              className="px-3 py-2 rounded-xl border border-[#0A0A0A] bg-white hover:bg-[#0A0A0A] hover:text-white text-[11px] font-semibold uppercase tracking-wider transition-colors"
                            >
                              Apply Days
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label
                            htmlFor="campaign-ends-at"
                            className="block text-[10px] uppercase tracking-wider text-[#666666]"
                          >
                            Exact End Date &amp; Time
                          </label>
                          <input
                            id="campaign-ends-at"
                            type="datetime-local"
                            value={toLocalDateTimeInput(campaignDraft.endsAt)}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) {
                                setCampaignDraft((d) => ({ ...d, endsAt: '' }));
                                return;
                              }
                              const parsed = new Date(val);
                              if (!Number.isNaN(parsed.getTime())) {
                                setCampaignDraft((d) => ({
                                  ...d,
                                  endsAt: parsed.toISOString(),
                                }));
                              }
                            }}
                            className="w-full px-2.5 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                          />
                        </div>
                      </div>

                      <AdminCountdownHint endsAt={campaignDraft.endsAt} />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Top Announcement Bar Text (When Live)
                      </label>
                      <input
                        type="text"
                        value={campaignDraft.announcementText}
                        onChange={(e) =>
                          setCampaignDraft((d) => ({
                            ...d,
                            announcementText: e.target.value,
                          }))
                        }
                        maxLength={240}
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingCampaign}
                      className="w-full py-3.5 px-5 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 rounded-full text-xs font-semibold uppercase tracking-[0.14em]"
                    >
                      {savingCampaign ? 'Saving Campaign...' : 'Save Campaign & Timer'}
                    </button>
                  </form>
                </div>

                {/* Specials Curated Perfume List */}
                <div className="lg:col-span-7 space-y-6">
                  {livePerfumes.length === 0 ? (
                    <div className="bg-white border border-[#E5E5E5] rounded-3xl p-8 text-center space-y-4">
                      <p className="text-2xl font-bold text-[#0A0A0A]">
                        Import or Add Perfumes First
                      </p>
                      <p className="text-sm text-[#525252]">
                        Once your perfumes are saved in the database, you can select which fragrances appear on your Specials list.
                      </p>
                      <button
                        type="button"
                        onClick={handleImportStarter}
                        disabled={importingStarter}
                        className="px-6 py-3 bg-[#0A0A0A] text-white rounded-full text-xs font-semibold uppercase tracking-wider"
                      >
                        {importingStarter ? 'Importing...' : 'Import 8 Starter Perfumes'}
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Active Specials List */}
                      <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5E5] pb-4">
                          <div>
                            <h3 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                              Perfumes on Special ({specialPerfumes.length})
                            </h3>
                            <p className="text-xs text-[#666666]">
                              Discounts apply automatically to each perfume&apos;s highest full-bottle size. Decant sizes remain at regular price.
                            </p>
                          </div>
                          {specialPerfumes.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                              <div
                                className="inline-flex rounded-full border border-[#D4D4D4] bg-[#F6F6F7] p-0.5 text-[11px] font-bold"
                                role="group"
                                aria-label="Bulk special reduction mode"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkSpecialType('percentage');
                                    if (bulkSpecialDiscount === '100') {
                                      setBulkSpecialDiscount('20');
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-full transition-colors ${
                                    bulkSpecialType === 'percentage'
                                      ? 'bg-[#0A0A0A] text-white'
                                      : 'text-[#525252] hover:text-[#0A0A0A]'
                                  }`}
                                >
                                  % Off
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkSpecialType('fixed');
                                    if (bulkSpecialDiscount === '20') {
                                      setBulkSpecialDiscount('100');
                                    }
                                  }}
                                  className={`px-2.5 py-1 rounded-full transition-colors ${
                                    bulkSpecialType === 'fixed'
                                      ? 'bg-[#0A0A0A] text-white'
                                      : 'text-[#525252] hover:text-[#0A0A0A]'
                                  }`}
                                >
                                  -E Off
                                </button>
                              </div>

                              <div className="relative flex items-center">
                                {bulkSpecialType === 'fixed' && (
                                  <span className="text-xs font-bold text-[#525252] mr-1">
                                    -E
                                  </span>
                                )}
                                <input
                                  type="number"
                                  min={0}
                                  max={bulkSpecialType === 'percentage' ? 90 : 50000}
                                  step={bulkSpecialType === 'fixed' ? '1' : '1'}
                                  value={bulkSpecialDiscount}
                                  onChange={(e) => setBulkSpecialDiscount(e.target.value)}
                                  className="w-20 px-2 py-1.5 border border-[#D4D4D4] rounded-xl text-xs text-center tabular-nums"
                                  aria-label={
                                    bulkSpecialType === 'fixed'
                                      ? 'Bulk special price reduction in Emalangeni'
                                      : 'Bulk special discount percentage'
                                  }
                                />
                                {bulkSpecialType === 'percentage' && (
                                  <span className="text-xs font-bold text-[#525252] ml-1">
                                    %
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                disabled={applyingBulkSpecial}
                                onClick={handleApplyBulkSpecialDiscount}
                                className="px-3.5 py-1.5 bg-[#0A0A0A] text-white disabled:opacity-50 rounded-full text-xs font-semibold whitespace-nowrap"
                              >
                                {applyingBulkSpecial
                                  ? 'Applying...'
                                  : bulkSpecialType === 'fixed'
                                  ? 'Apply -E to All'
                                  : 'Apply % to All'}
                              </button>
                            </div>
                          )}
                        </div>

                        {specialPerfumes.some((s) => s.availability === 'Out of Stock') && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                            <strong>Heads up:</strong>{' '}
                            {specialPerfumes.filter((s) => s.availability === 'Out of Stock').length}{' '}
                            special perfume(s) marked <strong>Out of Stock</strong> will stay hidden from the front page until availability is changed back to In Stock or Low Stock.
                          </div>
                        )}

                        {specialPerfumes.length === 0 ? (
                          <p className="text-sm text-[#525252] py-4">
                            No perfumes are marked on special yet. Select perfumes below to add them to your Specials list.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {specialPerfumes.map((p) => {
                              const savedType: SpecialDiscountType =
                                p.specialDiscountType === 'fixed' ? 'fixed' : 'percentage';
                              const savedValue =
                                savedType === 'fixed'
                                  ? p.specialDiscountAmount ?? 0
                                  : p.specialDiscountPercent ?? 0;
                              const editEntry = discountEdits[p.id];
                              const draftType: SpecialDiscountType =
                                editEntry?.type ?? savedType;
                              const draftValue =
                                editEntry?.value ?? String(savedValue);
                              const numDraft = Number(draftValue || 0);
                              const previewSummary = getProductPriceSummary({
                                ...p,
                                onSpecial: true,
                                specialDiscountType: draftType,
                                specialDiscountPercent:
                                  draftType === 'percentage'
                                    ? Math.min(90, Math.max(0, numDraft))
                                    : 0,
                                specialDiscountAmount:
                                  draftType === 'fixed'
                                    ? Math.min(50000, Math.max(0, numDraft))
                                    : 0,
                              });
                              const previewTarget =
                                !previewSummary.hasDiscount &&
                                previewSummary.specialTargetOption
                                  ? previewSummary.specialTargetOption
                                  : previewSummary.highestEffective !== null
                                  ? {
                                      size: previewSummary.highestSize ?? '',
                                      effectivePrice: previewSummary.highestEffective,
                                      originalPrice:
                                        previewSummary.highestOriginal ??
                                        previewSummary.highestEffective,
                                    }
                                  : null;
                              const isDirty =
                                editEntry !== undefined &&
                                (editEntry.type !== savedType ||
                                  Number(editEntry.value || 0) !== savedValue);

                              return (
                                <div
                                  key={p.id}
                                  data-special-row={p.id}
                                  className="p-3.5 bg-[#F7F7F8] border border-[#E5E5E5] rounded-2xl flex flex-col gap-3"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-14 h-14 bg-white border border-[#F0F0F0] rounded-xl shrink-0 overflow-hidden">
                                        <ResilientImage
                                          src={p.image}
                                          alt={p.name}
                                          loading="lazy"
                                          variant="thumb"
                                          className="w-full h-full object-cover saturate-[1.12] contrast-[1.03]"
                                        />
                                      </div>
                                      <div className="min-w-0 space-y-0.5">
                                        <p className="text-[11px] uppercase tracking-wider text-[#525252] font-semibold">
                                          {p.brand}
                                        </p>
                                        <p className="text-base font-bold text-[#0A0A0A] truncate">
                                          {p.name}
                                        </p>
                                        {p.availability === 'Out of Stock' && (
                                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                                            Out of Stock · Hidden on Front Page
                                          </span>
                                        )}
                                        {previewTarget && (
                                          <p className="text-xs tabular-nums flex flex-wrap items-center gap-1.5">
                                            {previewTarget.size && (
                                              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
                                                {previewTarget.size}:
                                              </span>
                                            )}
                                            <span className="text-[#DC2626] font-bold">
                                              {formatPrice(previewTarget.effectivePrice)}
                                            </span>
                                            {previewTarget.originalPrice >
                                              previewTarget.effectivePrice && (
                                              <>
                                                <span className="text-[#737373] line-through">
                                                  {formatPrice(previewTarget.originalPrice)}
                                                </span>
                                                <span className="text-[10px] font-semibold text-[#92400E] bg-[#FEF3C7] px-1.5 py-0.5 rounded-full">
                                                  Save{' '}
                                                  {formatPrice(
                                                    previewTarget.originalPrice -
                                                      previewTarget.effectivePrice
                                                  )}
                                                </span>
                                              </>
                                            )}
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <div
                                      className="inline-flex rounded-full border border-[#D4D4D4] bg-white p-0.5 text-[11px] font-bold"
                                      role="group"
                                      aria-label={`Discount mode for ${p.name}`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDiscountEdits((prev) => ({
                                            ...prev,
                                            [p.id]: {
                                              type: 'percentage',
                                              value:
                                                savedType === 'percentage'
                                                  ? String(savedValue)
                                                  : editEntry?.type === 'percentage'
                                                  ? editEntry.value
                                                  : '20',
                                            },
                                          }))
                                        }
                                        className={`px-2 py-1 rounded-full transition-colors ${
                                          draftType === 'percentage'
                                            ? 'bg-[#0A0A0A] text-white'
                                            : 'text-[#525252] hover:text-[#0A0A0A]'
                                        }`}
                                      >
                                        %
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDiscountEdits((prev) => ({
                                            ...prev,
                                            [p.id]: {
                                              type: 'fixed',
                                              value:
                                                savedType === 'fixed'
                                                  ? String(savedValue)
                                                  : editEntry?.type === 'fixed'
                                                  ? editEntry.value
                                                  : '100',
                                            },
                                          }))
                                        }
                                        className={`px-2 py-1 rounded-full transition-colors ${
                                          draftType === 'fixed'
                                            ? 'bg-[#0A0A0A] text-white'
                                            : 'text-[#525252] hover:text-[#0A0A0A]'
                                        }`}
                                      >
                                        E
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-1">
                                      {draftType === 'fixed' && (
                                        <span className="text-xs text-[#525252] font-bold">
                                          -E
                                        </span>
                                      )}
                                      <input
                                        type="number"
                                        min={0}
                                        max={draftType === 'percentage' ? 90 : 50000}
                                        step="1"
                                        value={draftValue}
                                        onChange={(e) =>
                                          setDiscountEdits((prev) => ({
                                            ...prev,
                                            [p.id]: {
                                              type: draftType,
                                              value: e.target.value,
                                            },
                                          }))
                                        }
                                        onBlur={(e) => {
                                          const nextTarget =
                                            e.relatedTarget as HTMLElement | null;
                                          if (
                                            nextTarget?.closest(
                                              `[data-special-row="${p.id}"]`
                                            )
                                          ) {
                                            return;
                                          }
                                          void handleCommitSingleSpecialDiscount(
                                            p,
                                            draftType,
                                            draftValue
                                          );
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void handleCommitSingleSpecialDiscount(
                                              p,
                                              draftType,
                                              draftValue
                                            );
                                          }
                                        }}
                                        aria-label={
                                          draftType === 'fixed'
                                            ? `Price reduction amount in Emalangeni for ${p.name}`
                                            : `Discount percent for ${p.name}`
                                        }
                                        className="w-20 px-2 py-1.5 bg-white border border-[#D4D4D4] rounded-lg text-xs font-bold text-center tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                                      />
                                      <span className="text-xs text-[#525252] font-medium">
                                        {draftType === 'fixed' ? 'off' : '%'}
                                      </span>
                                      {isDirty && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCommitSingleSpecialDiscount(
                                              p,
                                              draftType,
                                              draftValue
                                            )
                                          }
                                          className="px-2.5 py-1.5 bg-[#FACC15] text-[#0A0A0A] rounded-full text-[11px] font-bold"
                                        >
                                          Save
                                        </button>
                                      )}
                                    </div>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setDiscountEdits((prev) => {
                                            if (!(p.id in prev)) return prev;
                                            const next = { ...prev };
                                            delete next[p.id];
                                            return next;
                                          });
                                          const persistPromise = togglePerfumeSpecial(
                                            p,
                                            false,
                                            0,
                                            '',
                                            'percentage',
                                            0,
                                            false
                                          );
                                          onNotify('Removed', `${p.name} removed from specials.`);
                                          void persistPromise.catch((err) => {
                                            onNotify(
                                              'Update Failed',
                                              extractReadableError(err, 'Could not remove from specials.')
                                            );
                                          });
                                        }}
                                        className="px-3.5 py-1.5 border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Add More to Specials */}
                      <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <h3 className="text-xl font-bold text-[#0A0A0A]">
                            Add Perfumes to Specials ({nonSpecialPerfumes.length})
                          </h3>
                          <div className="relative w-full sm:w-56">
                            <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={specialPickerSearch}
                              onChange={(e) => setSpecialPickerSearch(e.target.value)}
                              placeholder="Search fragrances..."
                              className="w-full pl-8 pr-3 py-1.5 bg-[#F6F6F7] border border-[#E5E5E5] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                            />
                          </div>
                        </div>

                        {nonSpecialPerfumes.length === 0 ? (
                          <p className="text-xs text-[#666666]">
                            {specialPickerSearch
                              ? 'No matching fragrances found outside Specials.'
                              : 'Every perfume in your catalogue is currently in the Specials list.'}
                          </p>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                              {visibleNonSpecialPerfumes.map((p) => {
                                const highestBottle = getSpecialTargetSizeOption(p.sizes);
                                return (
                                  <div
                                    key={p.id}
                                    className="p-3.5 border border-[#E5E5E5] rounded-2xl flex items-center justify-between gap-3 bg-white hover:border-[#0A0A0A]/40 transition-colors"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-10 h-10 bg-white border border-[#F0F0F0] rounded-lg shrink-0 overflow-hidden">
                                        <ResilientImage
                                          src={p.image}
                                          alt={p.name}
                                          loading="lazy"
                                          variant="thumb"
                                          className="w-full h-full object-cover saturate-[1.12]"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-[10px] uppercase tracking-wider text-[#666666]">
                                          {p.brand}
                                        </p>
                                        <p className="text-sm font-bold text-[#0A0A0A] truncate">
                                          {p.name}
                                        </p>
                                        {highestBottle ? (
                                          <p className="text-[11px] text-[#525252] tabular-nums">
                                            {highestBottle.size}
                                            {highestBottle.price !== null
                                              ? ` · ${formatPrice(highestBottle.price)}`
                                              : ''}
                                          </p>
                                        ) : (
                                          <p className="text-[10px] text-[#737373]">
                                            No full bottle size
                                          </p>
                                        )}
                                        {p.availability === 'Out of Stock' && (
                                          <p className="text-[10px] font-semibold text-amber-700">
                                            Out of Stock (hidden on front page)
                                          </p>
                                        )}
                                      </div>
                                    </div>

                                    <button
                                      type="button"
                                      disabled={!highestBottle}
                                      onClick={() => {
                                        if (!highestBottle) return;
                                        const rawNum = Number(bulkSpecialDiscount || 0);
                                        const addPct =
                                          bulkSpecialType === 'percentage'
                                            ? Math.min(90, Math.max(0, rawNum || 20))
                                            : 0;
                                        const addAmt =
                                          bulkSpecialType === 'fixed'
                                            ? Math.min(50000, Math.max(0, rawNum || 100))
                                            : 0;
                                        const persistPromise = togglePerfumeSpecial(
                                          p,
                                          true,
                                          addPct,
                                          campaignDraft.badgeText || 'Special Offer',
                                          bulkSpecialType,
                                          addAmt,
                                          false
                                        );
                                        onNotify(
                                          'Added to Specials',
                                          `${p.name} (${highestBottle.size}) added to Specials.`
                                        );
                                        void persistPromise.catch((err) => {
                                          onNotify(
                                            'Special Failed',
                                            extractReadableError(err, 'Could not add special.')
                                          );
                                        });
                                      }}
                                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
                                    >
                                      {highestBottle ? '+ Add' : 'Decants Only'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                            {nonSpecialPerfumes.length > specialPickerVisibleCount && (
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-[11px] text-[#666666] tabular-nums">
                                  Showing {visibleNonSpecialPerfumes.length} of {nonSpecialPerfumes.length} perfumes
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSpecialPickerVisibleCount((prev) => prev + 24)
                                  }
                                  className="px-4 py-1.5 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] text-xs font-semibold text-[#0A0A0A] transition-colors"
                                >
                                  Show More (+24)
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Hero New Arrivals Showcase Lineup */}
                      <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5E5] pb-4">
                          <div>
                            <h3 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                              New Arrivals Hero Lineup ({newArrivalPerfumes.length})
                            </h3>
                            <p className="text-xs text-[#666666]">
                              Shown automatically when no specials are active (or when New Arrivals Hero is selected). If none are picked, the newest bottles appear automatically.
                            </p>
                          </div>
                        </div>

                        {newArrivalPerfumes.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {newArrivalPerfumes.map((p) => (
                              <div
                                key={`na-${p.id}`}
                                className="p-3 bg-[#F7F7F8] border border-[#E5E5E5] rounded-2xl flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-10 h-10 bg-white border border-[#F0F0F0] rounded-lg shrink-0 overflow-hidden">
                                    <ResilientImage
                                      src={p.image}
                                      alt={p.name}
                                      loading="lazy"
                                      variant="thumb"
                                      className="w-full h-full object-cover saturate-[1.12]"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-wider text-[#666666]">
                                      {p.brand}
                                    </p>
                                    <p className="text-sm font-bold text-[#0A0A0A] truncate">
                                      {p.name}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const persistPromise = togglePerfumeNewArrival(p, false);
                                    onNotify('Removed', `${p.name} removed from New Arrivals.`);
                                    void persistPromise.catch((err) => {
                                      onNotify(
                                        'Update Failed',
                                        extractReadableError(err, 'Could not update New Arrival status.')
                                      );
                                    });
                                  }}
                                  className="px-3 py-1.5 border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] rounded-full text-xs font-medium shrink-0"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="pt-2 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#525252]">
                              Add Perfumes to New Arrivals ({nonNewArrivalPerfumes.length})
                            </span>
                            <div className="relative w-full sm:w-56">
                              <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                value={newArrivalPickerSearch}
                                onChange={(e) => setNewArrivalPickerSearch(e.target.value)}
                                placeholder="Search fragrances..."
                                className="w-full pl-8 pr-3 py-1.5 bg-[#F6F6F7] border border-[#E5E5E5] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                              />
                            </div>
                          </div>

                          {nonNewArrivalPerfumes.length === 0 ? (
                            <p className="text-xs text-[#666666]">
                              {newArrivalPickerSearch
                                ? 'No matching fragrances found outside New Arrivals.'
                                : 'Every perfume in your catalogue is currently marked as a New Arrival.'}
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[320px] overflow-y-auto pr-1">
                              {nonNewArrivalPerfumes.slice(0, 30).map((p) => (
                                <div
                                  key={`add-na-${p.id}`}
                                  className="p-3 border border-[#E5E5E5] rounded-2xl flex items-center justify-between gap-3 hover:border-[#0A0A0A]/40 transition-colors"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-10 h-10 bg-white border border-[#F0F0F0] rounded-lg shrink-0 overflow-hidden">
                                      <ResilientImage
                                        src={p.image}
                                        alt={p.name}
                                        loading="lazy"
                                        variant="thumb"
                                        className="w-full h-full object-cover saturate-[1.12]"
                                      />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[10px] uppercase tracking-wider text-[#666666]">
                                        {p.brand}
                                      </p>
                                      <p className="text-sm font-bold text-[#0A0A0A] truncate">
                                        {p.name}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const persistPromise = togglePerfumeNewArrival(p, true);
                                      onNotify('Added', `${p.name} marked as New Arrival.`);
                                      void persistPromise.catch((err) => {
                                        onNotify(
                                          'Update Failed',
                                          extractReadableError(err, 'Could not mark New Arrival.')
                                        );
                                      });
                                    }}
                                    className="px-3 py-1.5 bg-[#0A0A0A] text-[#FACC15] rounded-full text-xs font-semibold shrink-0 hover:bg-[#262626]"
                                  >
                                    + New Arrival
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
                </div>
              </div>
            )}

            {/* TAB 3: COUPON CODES */}
            {activeTab === 'coupons' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
                {/* Create / Edit Coupon Form */}
                <form
                  onSubmit={handleSaveCoupon}
                  className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5"
                >
                  <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                        {editingCouponCode ? 'Edit Coupon' : 'Social & Live Stream Codes'}
                      </p>
                      <h2 className="text-2xl font-bold text-[#0A0A0A]">
                        {editingCouponCode ? `Editing ${editingCouponCode}` : 'Create Coupon Code'}
                      </h2>
                    </div>
                    {editingCouponCode && (
                      <button
                        type="button"
                        onClick={handleResetCouponForm}
                        className="text-xs underline text-[#525252] hover:text-[#0A0A0A]"
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {/* Quick Discount Presets */}
                  {!editingCouponCode && (
                    <div className="space-y-1.5">
                      <span className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium">
                        Quick Offer Presets
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: '10% Off', type: 'percentage' as const, val: '10' },
                          { label: '15% Off', type: 'percentage' as const, val: '15' },
                          { label: '20% Off', type: 'percentage' as const, val: '20' },
                          { label: 'E50 Off', type: 'fixed' as const, val: '50' },
                          { label: 'E100 Off', type: 'fixed' as const, val: '100' },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setCType(preset.type);
                              setCValue(preset.val);
                            }}
                            className="px-3 py-1 rounded-full border border-[#D4D4D4] hover:border-[#0A0A0A] text-[11px] font-medium text-[#0A0A0A]"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {couponError && (
                    <div className="p-3 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium">
                      {couponError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider">
                      Coupon Code
                    </label>
                    <input
                      type="text"
                      disabled={Boolean(editingCouponCode)}
                      value={cCode}
                      onChange={(e) => setCCode(e.target.value.toUpperCase())}
                      placeholder="e.g. AURALIVE20"
                      maxLength={32}
                      required
                      className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm font-mono uppercase disabled:bg-[#F5F5F5] focus:outline-none focus:border-[#0A0A0A]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Discount Type
                      </label>
                      <select
                        value={cType}
                        onChange={(e) => setCType(e.target.value as CouponDiscountType)}
                        className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                      >
                        <option value="percentage">Percentage (% Off)</option>
                        <option value="fixed">Fixed Amount (E SZL)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        {cType === 'percentage' ? 'Discount (%)' : 'Amount Off (E)'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={cType === 'percentage' ? 95 : 50000}
                        step="any"
                        value={cValue}
                        onChange={(e) => setCValue(e.target.value)}
                        required
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Minimum Spend (E)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100000}
                        value={cMinSpend}
                        onChange={(e) => setCMinSpend(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Applies To
                      </label>
                      <select
                        value={cScope}
                        onChange={(e) => setCScope(e.target.value as CouponScope)}
                        className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                      >
                        <option value="all">All Fragrances</option>
                        <option value="specials">Specials Only</option>
                        <option value="full-bottles">Full Bottles (30ml+)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider">
                      Internal Note / Stream Campaign
                    </label>
                    <input
                      type="text"
                      value={cDescription}
                      onChange={(e) => setCDescription(e.target.value)}
                      placeholder="e.g. Friday TikTok Live Drop — 20% Off"
                      maxLength={200}
                      className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                    />
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cActive}
                      onChange={(e) => setCActive(e.target.checked)}
                      className="accent-[#0A0A0A] w-4 h-4"
                    />
                    <span>Coupon is active for checkout entry</span>
                  </label>

                  <button
                    type="submit"
                    disabled={savingCoupon}
                    className="w-full py-3.5 px-5 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 rounded-full text-xs font-semibold uppercase tracking-[0.14em]"
                  >
                    {savingCoupon
                      ? 'Saving Coupon...'
                      : editingCouponCode
                      ? 'Update Coupon'
                      : 'Create Coupon Code'}
                  </button>
                </form>

                {/* Existing Coupons List */}
                <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5">
                  <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-[#0A0A0A]">
                        Private Coupon Vault ({coupons.length})
                      </h2>
                      <p className="text-xs text-[#666666]">
                        Codes stay private from public storefront pages until you share them on social posts or live streams.
                      </p>
                    </div>
                  </div>

                  {couponsLoading ? (
                    <p className="text-sm text-[#666666] py-6">Loading coupons...</p>
                  ) : coupons.length === 0 ? (
                    <div className="py-10 text-center space-y-2 border border-dashed border-[#D4D4D4] rounded-2xl">
                      <Percent className="w-6 h-6 mx-auto text-[#737373]" />
                      <p className="text-xl font-bold text-[#0A0A0A]">
                        No Coupon Codes Created Yet
                      </p>
                      <p className="text-xs text-[#666666] max-w-sm mx-auto">
                        Create your first coupon code for TikTok Live or Instagram followers using the form on the left.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {coupons.map((coupon) => (
                        <div
                          key={coupon.code}
                          className="p-4 border border-[#E5E5E5] bg-[#F7F7F8] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-bold tracking-wider px-3 py-1 bg-[#0A0A0A] text-white rounded-full">
                                {coupon.code}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyCoupon(coupon.code)}
                                aria-label={`Copy ${coupon.code}`}
                                title="Copy code"
                                className="text-xs text-[#525252] hover:text-[#0A0A0A] inline-flex items-center gap-1"
                              >
                                {copiedCouponCode === coupon.code ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <span
                                className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full ${
                                  coupon.active
                                    ? 'bg-[#FACC15] text-[#0A0A0A]'
                                    : 'bg-[#E5E5E5] text-[#737373]'
                                }`}
                              >
                                {coupon.active ? 'Active' : 'Paused'}
                              </span>
                            </div>

                            <p className="text-sm font-semibold text-[#0A0A0A]">
                              <span className="text-[#DC2626] font-bold">
                                {coupon.discountType === 'percentage'
                                  ? `${coupon.discountValue}% Off`
                                  : `${formatPrice(coupon.discountValue)} Off`}
                              </span>{' '}
                              ·{' '}
                              <span className="font-normal text-[#525252]">
                                {coupon.appliesTo === 'all'
                                  ? 'All fragrances'
                                  : coupon.appliesTo === 'specials'
                                  ? 'Specials only'
                                  : 'Full bottles (30ml+)'}
                              </span>
                              {coupon.minOrderAmount > 0 && (
                                <span className="font-normal text-[#525252]">
                                  {' '}
                                  · Min {formatPrice(coupon.minOrderAmount)}
                                </span>
                              )}
                            </p>
                            {coupon.description && (
                              <p className="text-xs text-[#666666]">{coupon.description}</p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopySocialCaption(coupon)}
                              className="px-3 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium inline-flex items-center gap-1.5"
                            >
                              {copiedCaptionCode === coupon.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Share2 className="w-3.5 h-3.5" />
                              )}
                              <span>Copy Post</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await toggleCouponActive(coupon);
                                  onNotify(
                                    coupon.active ? 'Coupon Paused' : 'Coupon Activated',
                                    `${coupon.code} updated.`
                                  );
                                } catch (err) {
                                  onNotify(
                                    'Coupon Update Failed',
                                    extractReadableError(err, 'Could not toggle coupon.')
                                  );
                                }
                              }}
                              className="px-3.5 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                            >
                              {coupon.active ? 'Pause' : 'Activate'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleEditCoupon(coupon)}
                              className="px-3.5 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                            >
                              Edit
                            </button>

                            {confirmDeleteCoupon === coupon.code ? (
                              <div className="inline-flex gap-1">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await deleteCoupon(coupon.code);
                                      setConfirmDeleteCoupon(null);
                                      onNotify('Coupon Deleted', `${coupon.code} removed.`);
                                    } catch (err) {
                                      onNotify(
                                        'Delete Failed',
                                        extractReadableError(err, 'Could not delete coupon.')
                                      );
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-[#DC2626] text-white rounded-full text-xs font-semibold"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteCoupon(null)}
                                  className="px-2.5 py-1.5 border border-[#D4D4D4] bg-white rounded-full text-xs"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteCoupon(coupon.code)}
                                aria-label={`Delete coupon ${coupon.code}`}
                                className="p-2 bg-white border border-[#D4D4D4] rounded-full text-[#525252] hover:text-[#DC2626] hover:border-[#DC2626]"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: COMBOS & LAYERING IDEAS */}
            {activeTab === 'combos' && (
              <div className="space-y-5 sm:space-y-8">
                <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                      Combo Deals &amp; Layering Ideas
                    </h2>
                    <p className="text-xs sm:text-sm text-[#525252] mt-1">
                      Set store-priced Combo Deals (e.g. buy 2 perfumes for E550 instead of E600) and manually curate layering suggestions from your live catalogue.
                    </p>
                  </div>
                  {(liveCombos.length === 0 || liveLayeringIdeas.length === 0) && (
                    <button
                      type="button"
                      disabled={importingCombosStarter}
                      onClick={handleImportStarterCombos}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-[#0A0A0A] bg-white hover:bg-[#0A0A0A] hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2 shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {importingCombosStarter
                          ? 'Importing...'
                          : 'Import Starter Deals & Ideas'}
                      </span>
                    </button>
                  )}
                </div>

                {/* SECTION A: COMBO DEALS CRUD */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
                  <form
                    onSubmit={handleSaveComboSubmit}
                    className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
                      <div>
                        <h3 className="text-xl font-bold text-[#0A0A0A]">
                          {editingComboId ? 'Edit Combo Deal' : 'Set Combo Deal'}
                        </h3>
                        <p className="text-xs text-[#666666]">
                          Pick perfumes from store stock &amp; set combo bundle price
                        </p>
                      </div>
                      {editingComboId && (
                        <button
                          type="button"
                          onClick={resetComboForm}
                          className="text-xs underline text-[#525252] hover:text-[#0A0A0A]"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    {comboError && (
                      <div className="p-3 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B]">
                        {comboError}
                      </div>
                    )}

                    {/* Catalogue Quick Picker for Combos */}
                    <div className="p-3.5 bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0A0A0A]">
                          Pick Perfumes From Store ({catalogForBuilders.length})
                        </span>
                        {selectedComboPicks.length > 0 && (
                          <button
                            type="button"
                            onClick={() => syncComboPicksToForm([], comboPrice)}
                            className="text-[11px] underline text-[#525252] hover:text-[#0A0A0A]"
                          >
                            Clear picks
                          </button>
                        )}
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-[#737373] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={comboPickerSearch}
                          onChange={(e) => setComboPickerSearch(e.target.value)}
                          placeholder="Search Yara, Asad, Khamrah, Lattafa..."
                          className="w-full pl-8 pr-3 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>

                      {selectedComboPicks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {selectedComboPicks.map((pick) => (
                            <span
                              key={pick.key}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#0A0A0A] text-white rounded-full text-[11px] font-medium"
                            >
                              <span>
                                {pick.name} ({pick.size}
                                {pick.price !== null ? ` · ${formatPrice(pick.price)}` : ''})
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveComboPick(pick.key)}
                                aria-label={`Remove ${pick.name}`}
                                className="hover:text-[#FACC15]"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                        {comboPickerMatches.map((item) => {
                          const pricedSizes = item.sizes.filter(
                            (s) => s.available && s.price !== null
                          );
                          const shownSizes =
                            pricedSizes.length > 0
                              ? pricedSizes.slice(0, 3)
                              : item.sizes.slice(0, 2);

                          return (
                            <div
                              key={item.id}
                              className="p-2 bg-white border border-[#E5E5E5] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-[#0A0A0A] truncate">
                                  {item.name}
                                </p>
                                <p className="text-[10px] text-[#737373] truncate">
                                  {item.brand} · {item.category}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-1 shrink-0">
                                {shownSizes.map((sz, szIdx) => {
                                  const eff =
                                    sz.price !== null
                                      ? getEffectiveUnitPrice(
                                          sz.price,
                                          item.onSpecial,
                                          item.specialDiscountPercent,
                                          item.specialDiscountType,
                                          item.specialDiscountAmount,
                                          sz.size,
                                          item.sizes
                                        )
                                      : null;
                                  return (
                                    <button
                                      key={`${item.id}-${sz.size}-${szIdx}`}
                                      type="button"
                                      onClick={() => handleAddPerfumePickToCombo(item, sz)}
                                      className="px-2 py-1 rounded-lg bg-[#F6F6F7] hover:bg-[#0A0A0A] hover:text-white border border-[#D4D4D4] text-[10px] font-semibold tabular-nums transition-colors"
                                    >
                                      + {sz.size}
                                      {eff !== null ? ` · ${formatPrice(eff)}` : ''}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Bundle Title *
                      </label>
                      <input
                        type="text"
                        maxLength={140}
                        value={comboTitle}
                        onChange={(e) => setComboTitle(e.target.value)}
                        placeholder="e.g. Signature Two-Bottle Duo"
                        required
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Included Perfumes (comma-separated) *
                      </label>
                      <input
                        type="text"
                        value={comboPerfumesText}
                        onChange={(e) => setComboPerfumesText(e.target.value)}
                        placeholder="e.g. Yara, Bade'e Al Oud"
                        required
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Size Label
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={comboSizeLabel}
                          onChange={(e) => setComboSizeLabel(e.target.value)}
                          placeholder="2 × 30ml / Duo Pack"
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Badge Tag
                        </label>
                        <input
                          type="text"
                          maxLength={40}
                          value={comboTag}
                          onChange={(e) => setComboTag(e.target.value)}
                          placeholder="Save E50"
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Regular Price (E) *
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          step="any"
                          value={comboRegularPrice}
                          onChange={(e) => setComboRegularPrice(e.target.value)}
                          required
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Combo Price (E) *
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          step="any"
                          value={comboPrice}
                          onChange={(e) => setComboPrice(e.target.value)}
                          required
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Description
                      </label>
                      <input
                        type="text"
                        maxLength={300}
                        value={comboSubtitle}
                        onChange={(e) => setComboSubtitle(e.target.value)}
                        placeholder="Buy these 2 perfumes together for E550 instead of E600."
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="flex flex-wrap gap-5 pt-1 text-xs font-medium">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={comboFeatured}
                          onChange={(e) => setComboFeatured(e.target.checked)}
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <span>Highlight Card (Dark Featured)</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={comboActive}
                          onChange={(e) => setComboActive(e.target.checked)}
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <span>Active on Storefront</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={savingCombo}
                      className="w-full py-3.5 px-5 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 rounded-full text-xs font-semibold uppercase tracking-[0.14em]"
                    >
                      {savingCombo
                        ? 'Saving Combo...'
                        : editingComboId
                        ? 'Update Combo Deal'
                        : 'Publish Combo Deal'}
                    </button>
                  </form>

                  {/* Live Combo Deals List */}
                  <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5">
                    <div className="border-b border-[#E5E5E5] pb-4">
                      <h3 className="text-xl font-bold text-[#0A0A0A]">
                        Live Combo Deals ({liveCombos.length})
                      </h3>
                      <p className="text-xs text-[#666666]">
                        Combos published here appear immediately in the Combo Deals section on /combos.
                      </p>
                    </div>

                    {combosLoading ? (
                      <p className="text-sm text-[#666666] py-6">Loading combos...</p>
                    ) : liveCombos.length === 0 ? (
                      <div className="py-10 text-center border border-dashed border-[#D4D4D4] rounded-2xl space-y-2">
                        <Package className="w-6 h-6 mx-auto text-[#737373]" />
                        <p className="text-base font-bold text-[#0A0A0A]">
                          No Live Combos in Database Yet
                        </p>
                        <p className="text-xs text-[#666666]">
                          Pick 2+ perfumes on the left or click &ldquo;Import Example Combos&rdquo; above.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {liveCombos.map((combo) => (
                          <div
                            key={combo.id}
                            className="p-4 border border-[#E5E5E5] bg-[#F7F7F8] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-[#0A0A0A]">
                                  {combo.title}
                                </span>
                                <span
                                  className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full ${
                                    combo.active
                                      ? 'bg-[#FACC15] text-[#0A0A0A]'
                                      : 'bg-[#E5E5E5] text-[#737373]'
                                  }`}
                                >
                                  {combo.active ? 'Active' : 'Paused'}
                                </span>
                              </div>
                              <p className="text-xs text-[#404040]">
                                {combo.perfumeNames.join(' + ')} · {combo.sizeLabel}
                              </p>
                              <p className="text-xs font-semibold tabular-nums text-[#0A0A0A]">
                                {formatPrice(combo.comboPrice)}{' '}
                                <span className="text-[#737373] line-through font-normal">
                                  {formatPrice(combo.regularPrice)}
                                </span>
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await saveComboDeal(
                                      { ...combo, active: !combo.active },
                                      combo.id
                                    );
                                    onNotify(
                                      combo.active ? 'Combo Paused' : 'Combo Activated',
                                      `${combo.title} updated.`
                                    );
                                  } catch (err) {
                                    onNotify(
                                      'Update Failed',
                                      extractReadableError(err, 'Could not toggle combo.')
                                    );
                                  }
                                }}
                                className="px-3.5 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                              >
                                {combo.active ? 'Pause' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditCombo(combo)}
                                className="px-3.5 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                              >
                                Edit
                              </button>
                              {confirmDeleteComboId === combo.id ? (
                                <div className="inline-flex gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await deleteComboDeal(combo.id);
                                        setConfirmDeleteComboId(null);
                                        onNotify('Combo Deleted', `${combo.title} removed.`);
                                      } catch (err) {
                                        onNotify(
                                          'Delete Failed',
                                          extractReadableError(err, 'Could not delete combo.')
                                        );
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-[#DC2626] text-white rounded-full text-xs font-semibold"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteComboId(null)}
                                    className="px-2.5 py-1.5 border border-[#D4D4D4] bg-white rounded-full text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteComboId(combo.id)}
                                  aria-label={`Delete combo ${combo.title}`}
                                  className="p-2 bg-white border border-[#D4D4D4] rounded-full text-[#525252] hover:text-[#DC2626] hover:border-[#DC2626]"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION B: LAYERING IDEAS CRUD */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
                  <form
                    onSubmit={handleSaveLayerSubmit}
                    className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-4"
                  >
                    <datalist id="layering-catalog-names">
                      {catalogForBuilders.map((item) => (
                        <option key={item.id} value={item.name}>
                          {item.brand}
                        </option>
                      ))}
                    </datalist>

                    <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
                      <div>
                        <h3 className="text-xl font-bold text-[#0A0A0A]">
                          {editingLayerId ? 'Edit Layering Idea' : 'New Layering Idea'}
                        </h3>
                        <p className="text-xs text-[#666666]">
                          Suggest a base + topper perfume combination
                        </p>
                      </div>
                      {editingLayerId && (
                        <button
                          type="button"
                          onClick={resetLayerForm}
                          className="text-xs underline text-[#525252] hover:text-[#0A0A0A]"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    {layerError && (
                      <div className="p-3 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B]">
                        {layerError}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Pairing Title *
                      </label>
                      <input
                        type="text"
                        maxLength={140}
                        value={layerTitle}
                        onChange={(e) => setLayerTitle(e.target.value)}
                        placeholder="e.g. Velvet Oud & Whipped Vanilla"
                        required
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          1. Base Perfume *
                        </label>
                        <input
                          type="text"
                          list="layering-catalog-names"
                          maxLength={140}
                          value={layerBasePerfume}
                          onChange={(e) => setLayerBasePerfume(e.target.value)}
                          placeholder="e.g. Bade'e Al Oud"
                          required
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          2. Top Layer *
                        </label>
                        <input
                          type="text"
                          list="layering-catalog-names"
                          maxLength={140}
                          value={layerTopPerfume}
                          onChange={(e) => setLayerTopPerfume(e.target.value)}
                          placeholder="e.g. Yara"
                          required
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Vibe / Profile
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={layerVibe}
                          onChange={(e) => setLayerVibe(e.target.value)}
                          placeholder="Sweet Smoked Oud"
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Spray Ratio
                        </label>
                        <input
                          type="text"
                          maxLength={80}
                          value={layerSprayRatio}
                          onChange={(e) => setLayerSprayRatio(e.target.value)}
                          placeholder="2 sprays base · 2 sprays top"
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Best Occasion
                      </label>
                      <input
                        type="text"
                        maxLength={120}
                        value={layerOccasion}
                        onChange={(e) => setLayerOccasion(e.target.value)}
                        placeholder="Evening & Date Night"
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Why This Pairing Works
                      </label>
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={layerWhyItWorks}
                        onChange={(e) => setLayerWhyItWorks(e.target.value)}
                        placeholder="Explain how the base and top notes complement each other..."
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={layerActive}
                        onChange={(e) => setLayerActive(e.target.checked)}
                        className="accent-[#0A0A0A] w-4 h-4"
                      />
                      <span>Active on Storefront</span>
                    </label>

                    <button
                      type="submit"
                      disabled={savingLayer}
                      className="w-full py-3.5 px-5 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 rounded-full text-xs font-semibold uppercase tracking-[0.14em]"
                    >
                      {savingLayer
                        ? 'Saving Idea...'
                        : editingLayerId
                        ? 'Update Layering Idea'
                        : 'Publish Layering Idea'}
                    </button>
                  </form>

                  {/* Live Layering Ideas List */}
                  <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5">
                    <div className="border-b border-[#E5E5E5] pb-4">
                      <h3 className="text-xl font-bold text-[#0A0A0A]">
                        Live Layering Ideas ({liveLayeringIdeas.length})
                      </h3>
                      <p className="text-xs text-[#666666]">
                        Curated pairings help customers buy two scents together with confidence.
                      </p>
                    </div>

                    {layeringLoading ? (
                      <p className="text-sm text-[#666666] py-6">Loading layering ideas...</p>
                    ) : liveLayeringIdeas.length === 0 ? (
                      <div className="py-10 text-center border border-dashed border-[#D4D4D4] rounded-2xl space-y-2">
                        <Layers className="w-6 h-6 mx-auto text-[#737373]" />
                        <p className="text-base font-bold text-[#0A0A0A]">
                          No Live Layering Ideas Saved Yet
                        </p>
                        <p className="text-xs text-[#666666]">
                          Add a pairing on the left or import starter ideas above.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {liveLayeringIdeas.map((idea) => (
                          <div
                            key={idea.id}
                            className="p-4 border border-[#E5E5E5] bg-[#F7F7F8] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-[#0A0A0A]">
                                  {idea.title}
                                </span>
                                <span
                                  className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full ${
                                    idea.active
                                      ? 'bg-[#FACC15] text-[#0A0A0A]'
                                      : 'bg-[#E5E5E5] text-[#737373]'
                                  }`}
                                >
                                  {idea.active ? 'Active' : 'Paused'}
                                </span>
                              </div>
                              <p className="text-xs font-medium text-[#0A0A0A]">
                                {idea.basePerfumeName} + {idea.topPerfumeName}
                              </p>
                              <p className="text-xs text-[#525252]">
                                {idea.vibe} · {idea.sprayRatio}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await saveLayeringIdea(
                                      { ...idea, active: !idea.active },
                                      idea.id
                                    );
                                    onNotify(
                                      idea.active ? 'Idea Paused' : 'Idea Activated',
                                      `${idea.title} updated.`
                                    );
                                  } catch (err) {
                                    onNotify(
                                      'Update Failed',
                                      extractReadableError(err, 'Could not toggle layering idea.')
                                    );
                                  }
                                }}
                                className="px-3.5 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                              >
                                {idea.active ? 'Pause' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditLayer(idea)}
                                className="px-3.5 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                              >
                                Edit
                              </button>
                              {confirmDeleteLayerId === idea.id ? (
                                <div className="inline-flex gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await deleteLayeringIdea(idea.id);
                                        setConfirmDeleteLayerId(null);
                                        onNotify('Idea Deleted', `${idea.title} removed.`);
                                      } catch (err) {
                                        onNotify(
                                          'Delete Failed',
                                          extractReadableError(err, 'Could not delete idea.')
                                        );
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-[#DC2626] text-white rounded-full text-xs font-semibold"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteLayerId(null)}
                                    className="px-2.5 py-1.5 border border-[#D4D4D4] bg-white rounded-full text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteLayerId(idea.id)}
                                  aria-label={`Delete idea ${idea.title}`}
                                  className="p-2 bg-white border border-[#D4D4D4] rounded-full text-[#525252] hover:text-[#DC2626] hover:border-[#DC2626]"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: GIFT HAMPERS & SETS */}
            {activeTab === 'hampers' && (
              <div className="space-y-5 sm:space-y-8">
                <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                      Gift Hampers &amp; Ready-to-Gift Sets
                    </h2>
                    <p className="text-xs sm:text-sm text-[#525252] mt-1">
                      Create and publish curated perfume hampers (bottles + mists + decants + ribbon box) for For Her, For Him, Birthdays, and Anniversaries.
                    </p>
                  </div>
                  {liveHampers.length === 0 && (
                    <button
                      type="button"
                      disabled={importingHampersStarter}
                      onClick={handleImportStarterHampers}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-[#0A0A0A] bg-white hover:bg-[#0A0A0A] hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2 shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {importingHampersStarter ? 'Importing...' : 'Import 4 Starter Hampers'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
                  {/* Left Form: Add / Edit Gift Hamper */}
                  <form
                    onSubmit={handleSaveHamperSubmit}
                    className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
                      <div>
                        <h3 className="text-xl font-bold text-[#0A0A0A]">
                          {editingHamperId ? 'Edit Gift Hamper' : 'Create Gift Hamper'}
                        </h3>
                        <p className="text-xs text-[#666666]">
                          Set bundle contents, occasion tag, and hamper pricing
                        </p>
                      </div>
                      {editingHamperId && (
                        <button
                          type="button"
                          onClick={resetHamperForm}
                          className="text-xs underline text-[#525252] hover:text-[#0A0A0A]"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    {hamperError && (
                      <div className="p-3 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B]">
                        {hamperError}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Hamper Title *
                      </label>
                      <input
                        type="text"
                        maxLength={140}
                        value={hTitle}
                        onChange={(e) => setHTitle(e.target.value)}
                        placeholder="e.g. Her Signature Rose & Body Mist Box"
                        required
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Occasion *
                        </label>
                        <select
                          value={hOccasion}
                          onChange={(e) => setHOccasion(e.target.value)}
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm bg-white focus:outline-none focus:border-[#0A0A0A]"
                        >
                          {GIFT_HAMPER_OCCASIONS.map((occ) => (
                            <option key={occ} value={occ}>
                              {occ}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Availability
                        </label>
                        <select
                          value={hAvailability}
                          onChange={(e) => setHAvailability(e.target.value as AvailabilityStatus)}
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm bg-white focus:outline-none focus:border-[#0A0A0A]"
                        >
                          <option value="In Stock">In Stock</option>
                          <option value="Low Stock">Low Stock</option>
                          <option value="Pre-Order">Pre-Order</option>
                          <option value="Out of Stock">Out of Stock</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Items Included (One Per Line, 1–8 items) *
                      </label>
                      <textarea
                        rows={4}
                        value={hItemsText}
                        onChange={(e) => setHItemsText(e.target.value)}
                        placeholder={'100ml Full Arabian Bottle\nFine Fragrance Body Mist\n10ml Handbag Decant\nRibbon Gift Box & Card'}
                        required
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-xs leading-relaxed focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Regular Value (E) *
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          step="any"
                          value={hRegularPrice}
                          onChange={(e) => setHRegularPrice(e.target.value)}
                          required
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Hamper Price (E) *
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          step="any"
                          value={hHamperPrice}
                          onChange={(e) => setHHamperPrice(e.target.value)}
                          required
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl text-sm tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Short Subtitle / Description
                      </label>
                      <input
                        type="text"
                        maxLength={300}
                        value={hSubtitle}
                        onChange={(e) => setHSubtitle(e.target.value)}
                        placeholder="A ready-to-present gift box pairing rose EDP, body mist, and discovery decant."
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Gift Wrap Note
                      </label>
                      <input
                        type="text"
                        maxLength={200}
                        value={hGiftWrapNote}
                        onChange={(e) => setHGiftWrapNote(e.target.value)}
                        placeholder="Includes complimentary ribbon wrap & handwritten card"
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Photo URL or Preset Image
                      </label>
                      <input
                        type="text"
                        maxLength={500}
                        value={hImage}
                        onChange={(e) => setHImage(e.target.value)}
                        placeholder={DEFAULT_HAMPER_IMAGE}
                        className="w-full px-3.5 py-2 border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setHImage(HIM_HAMPER_IMAGE)}
                          className="px-2.5 py-1 rounded-full bg-[#F6F6F7] border border-[#D4D4D4] text-[10px] font-medium hover:border-[#0A0A0A]"
                        >
                          For Him Box (Black &amp; Gold)
                        </button>
                        <button
                          type="button"
                          onClick={() => setHImage(HER_HAMPER_IMAGE)}
                          className="px-2.5 py-1 rounded-full bg-[#F6F6F7] border border-[#D4D4D4] text-[10px] font-medium hover:border-[#0A0A0A]"
                        >
                          For Her Box (Blush Pink)
                        </button>
                        <button
                          type="button"
                          onClick={() => setHImage('/assets/images/unboxed_perfume_flacon_1795005243926.jpg')}
                          className="px-2.5 py-1 rounded-full bg-[#F6F6F7] border border-[#D4D4D4] text-[10px] font-medium hover:border-[#0A0A0A]"
                        >
                          Obsidian Flacon Photo
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-5 pt-1 text-xs font-medium">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hFeatured}
                          onChange={(e) => setHFeatured(e.target.checked)}
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <span>Featured Hamper</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hActive}
                          onChange={(e) => setHActive(e.target.checked)}
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <span>Active on Storefront</span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={savingHamper}
                      className="w-full py-3.5 px-5 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 rounded-full text-xs font-semibold uppercase tracking-[0.14em]"
                    >
                      {savingHamper
                        ? 'Saving Gift Hamper...'
                        : editingHamperId
                        ? 'Update Gift Hamper'
                        : 'Publish Gift Hamper'}
                    </button>
                  </form>

                  {/* Right List: Live Hampers */}
                  <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5">
                    <div className="border-b border-[#E5E5E5] pb-4">
                      <h3 className="text-xl font-bold text-[#0A0A0A]">
                        Live Gift Hampers ({liveHampers.length})
                      </h3>
                      <p className="text-xs text-[#666666]">
                        Active hampers appear immediately on the public Gifts &amp; Hampers page (out-of-stock or paused hampers are hidden automatically).
                      </p>
                    </div>

                    {hampersLoading ? (
                      <p className="text-sm text-[#666666] py-6">Loading hampers...</p>
                    ) : liveHampers.length === 0 ? (
                      <div className="py-10 text-center border border-dashed border-[#D4D4D4] rounded-2xl space-y-2">
                        <Gift className="w-6 h-6 mx-auto text-[#737373]" />
                        <p className="text-base font-bold text-[#0A0A0A]">
                          No Live Gift Hampers in Database Yet
                        </p>
                        <p className="text-xs text-[#666666]">
                          Create a gift hamper on the left or click &ldquo;Import 4 Starter Hampers&rdquo; above.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {liveHampers.map((hamper) => (
                          <div
                            key={hamper.id}
                            className="p-4 border border-[#E5E5E5] bg-[#F7F7F8] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                          >
                            <div className="flex items-start gap-3.5 min-w-0">
                              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white border border-[#E5E5E5] shrink-0">
                                <ResilientImage
                                  src={hamper.image}
                                  alt={hamper.title}
                                  fallbackTitle={hamper.title}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-bold text-[#0A0A0A]">
                                    {hamper.title}
                                  </span>
                                  <span
                                    className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full ${
                                      hamper.active && hamper.availability !== 'Out of Stock'
                                        ? 'bg-[#FACC15] text-[#0A0A0A]'
                                        : 'bg-[#E5E5E5] text-[#525252]'
                                    }`}
                                  >
                                    {hamper.active ? hamper.availability : 'Paused'}
                                  </span>
                                </div>
                                <p className="text-xs text-[#525252]">
                                  {hamper.occasion} · {hamper.itemsIncluded.length} items ·{' '}
                                  <strong className="text-[#0A0A0A] tabular-nums">
                                    {formatPrice(hamper.hamperPrice)}
                                  </strong>{' '}
                                  {hamper.regularPrice > hamper.hamperPrice && (
                                    <span className="line-through text-[#737373] tabular-nums">
                                      {formatPrice(hamper.regularPrice)}
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E5E5]/70 sm:border-t-0 sm:pt-0 shrink-0">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await saveHamper({ ...hamper, active: !hamper.active }, hamper.id);
                                    onNotify(
                                      hamper.active ? 'Hamper Paused' : 'Hamper Activated',
                                      `${hamper.title} updated.`
                                    );
                                  } catch (err) {
                                    onNotify(
                                      'Update Failed',
                                      extractReadableError(err, 'Could not update hamper status.')
                                    );
                                  }
                                }}
                                className="px-3 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                              >
                                {hamper.active ? 'Pause' : 'Activate'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditHamper(hamper)}
                                className="px-3.5 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                              >
                                Edit
                              </button>
                              {confirmDeleteHamperId === hamper.id ? (
                                <div className="inline-flex gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await deleteHamper(hamper.id);
                                        setConfirmDeleteHamperId(null);
                                        onNotify('Hamper Deleted', `${hamper.title} removed.`);
                                      } catch (err) {
                                        onNotify(
                                          'Delete Failed',
                                          extractReadableError(err, 'Could not delete hamper.')
                                        );
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-[#DC2626] text-white rounded-full text-xs font-semibold"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteHamperId(null)}
                                    className="px-2.5 py-1.5 border border-[#D4D4D4] bg-white rounded-full text-xs"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteHamperId(hamper.id)}
                                  aria-label={`Delete hamper ${hamper.title}`}
                                  className="p-2 bg-white border border-[#D4D4D4] rounded-full text-[#525252] hover:text-[#DC2626] hover:border-[#DC2626]"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: INFLUENCER REFERRALS & COMMISSIONS */}
            {activeTab === 'referrals' && (
              <div className="space-y-5 sm:space-y-6">
                {/* Summary Stats Bar */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                  <div className="bg-white border border-[#E5E5E5] rounded-2xl p-3.5 sm:p-4 min-w-0">
                    <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#737373] font-medium truncate">
                      Referred Sales Volume
                    </span>
                    <span className="mt-1 block text-lg sm:text-2xl font-bold text-[#0A0A0A] tabular-nums truncate">
                      {formatPrice(referralSummaryStats.totalSalesVolume)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#525252] truncate">
                      Across {referrals.length} influencer{referrals.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="bg-white border border-[#E5E5E5] rounded-2xl p-3.5 sm:p-4 min-w-0">
                    <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#737373] font-medium truncate">
                      Commissions Owed
                    </span>
                    <span className="mt-1 block text-lg sm:text-2xl font-bold text-[#0A0A0A] tabular-nums truncate">
                      {formatPrice(referralSummaryStats.totalOwed)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#525252] truncate">
                      {formatPrice(referralSummaryStats.confirmedOwed)} confirmed ·{' '}
                      {formatPrice(referralSummaryStats.pendingOwed)} pending
                    </span>
                  </div>

                  <div className="bg-white border border-[#E5E5E5] rounded-2xl p-3.5 sm:p-4 min-w-0">
                    <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#737373] font-medium truncate">
                      Commissions Paid Out
                    </span>
                    <span className="mt-1 block text-lg sm:text-2xl font-bold text-[#166534] tabular-nums truncate">
                      {formatPrice(referralSummaryStats.paidOut)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#525252] truncate">
                      Settled creator payouts
                    </span>
                  </div>

                  <div className="bg-white border border-[#E5E5E5] rounded-2xl p-3.5 sm:p-4 min-w-0">
                    <span className="block text-[10px] sm:text-[11px] uppercase tracking-wider text-[#737373] font-medium truncate">
                      Awaiting Review
                    </span>
                    <span className="mt-1 block text-lg sm:text-2xl font-bold text-[#0A0A0A] tabular-nums">
                      {referralSummaryStats.pendingCount}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-[#525252] truncate">
                      WhatsApp attributions
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
                  {/* LEFT COLUMN: Influencer Setup + Log Referred Sale */}
                  <div className="lg:col-span-5 space-y-5 sm:space-y-6">
                    <form
                      onSubmit={handleSaveReferralSubmit}
                      className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 space-y-4"
                    >
                      <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                            {editingReferralCode ? 'Edit Influencer' : 'Creator Partner'}
                          </p>
                          <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                            {editingReferralCode
                              ? `Editing ${editingReferralCode}`
                              : 'Add Influencer Code'}
                          </h2>
                        </div>
                        {editingReferralCode && (
                          <button
                            type="button"
                            onClick={handleResetReferralForm}
                            className="text-xs underline text-[#525252] hover:text-[#0A0A0A]"
                          >
                            Cancel Edit
                          </button>
                        )}
                      </div>

                      {!editingReferralCode && (
                        <div className="space-y-1.5">
                          <span className="block text-[11px] uppercase tracking-wider text-[#666666] font-medium">
                            Quick Commission Presets
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: '10% Sale', type: 'percentage' as const, val: '10' },
                              { label: '15% Sale', type: 'percentage' as const, val: '15' },
                              { label: '20% Sale', type: 'percentage' as const, val: '20' },
                              { label: 'E30 / Order', type: 'fixed' as const, val: '30' },
                              { label: 'E50 / Order', type: 'fixed' as const, val: '50' },
                            ].map((preset) => (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  setRCommissionType(preset.type);
                                  setRCommissionValue(preset.val);
                                }}
                                className="px-3 py-1 rounded-full border border-[#D4D4D4] hover:border-[#0A0A0A] text-[11px] font-medium text-[#0A0A0A]"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {referralError && (
                        <div className="p-3 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium">
                          {referralError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider">
                            Influencer Name *
                          </label>
                          <input
                            type="text"
                            value={rInfluencerName}
                            onChange={(e) => setRInfluencerName(e.target.value)}
                            placeholder="e.g. Nomsa Dlamini"
                            maxLength={120}
                            required
                            className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider">
                            Social Handle
                          </label>
                          <input
                            type="text"
                            value={rSocialHandle}
                            onChange={(e) => setRSocialHandle(e.target.value)}
                            placeholder="@nomsaglow · TikTok"
                            maxLength={100}
                            className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Shareable Referral Code *
                        </label>
                        <input
                          type="text"
                          disabled={Boolean(editingReferralCode)}
                          value={rCode}
                          onChange={(e) => setRCode(e.target.value.toUpperCase())}
                          placeholder="e.g. NOMSA10"
                          maxLength={32}
                          required
                          className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm font-mono uppercase disabled:bg-[#F5F5F5] focus:outline-none focus:border-[#0A0A0A]"
                        />
                        <p className="text-[11px] text-[#666666]">
                          Followers can enter this code at checkout or tap their personal{' '}
                          <span className="font-mono">?ref=CODE</span> link.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider">
                            Commission Type
                          </label>
                          <select
                            value={rCommissionType}
                            onChange={(e) =>
                              setRCommissionType(e.target.value as ReferralCommissionType)
                            }
                            className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                          >
                            <option value="percentage">% of Order Sales</option>
                            <option value="fixed">Flat E per Sale</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider">
                            {rCommissionType === 'percentage'
                              ? 'Commission (%)'
                              : 'Commission (E)'}
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={rCommissionType === 'percentage' ? 90 : 50000}
                            step="any"
                            value={rCommissionValue}
                            onChange={(e) => setRCommissionValue(e.target.value)}
                            required
                            className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider">
                            Follower Perk
                          </label>
                          <select
                            value={rFollowerDiscountType}
                            onChange={(e) =>
                              setRFollowerDiscountType(
                                e.target.value as ReferralFollowerDiscountType
                              )
                            }
                            className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                          >
                            <option value="none">No Discount (Track Only)</option>
                            <option value="percentage">Followers % Off</option>
                            <option value="fixed">Followers E Off</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider">
                            {rFollowerDiscountType === 'percentage'
                              ? 'Follower % Off'
                              : rFollowerDiscountType === 'fixed'
                              ? 'Follower E Off'
                              : 'Follower Discount'}
                          </label>
                          <input
                            type="number"
                            disabled={rFollowerDiscountType === 'none'}
                            min={0}
                            max={rFollowerDiscountType === 'percentage' ? 95 : 50000}
                            step="any"
                            value={
                              rFollowerDiscountType === 'none'
                                ? '0'
                                : rFollowerDiscountValue
                            }
                            onChange={(e) => setRFollowerDiscountValue(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm tabular-nums disabled:bg-[#F5F5F5] focus:outline-none focus:border-[#0A0A0A]"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Payout Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={rPayoutNote}
                          onChange={(e) => setRPayoutNote(e.target.value)}
                          placeholder="e.g. MoMo 76xx xxxx · Settle every Friday"
                          maxLength={200}
                          className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>

                      <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rActive}
                          onChange={(e) => setRActive(e.target.checked)}
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <span>Referral link &amp; code active for storefront orders</span>
                      </label>

                      <button
                        type="submit"
                        disabled={savingReferral}
                        className="w-full py-3.5 px-5 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 rounded-full text-xs font-semibold uppercase tracking-[0.14em]"
                      >
                        {savingReferral
                          ? 'Saving...'
                          : editingReferralCode
                          ? 'Update Influencer'
                          : 'Create Influencer Code'}
                      </button>
                    </form>

                    {/* Manual Referred Sale Form */}
                    <form
                      onSubmit={handleLogManualSaleSubmit}
                      className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-7 space-y-4"
                    >
                      <div className="border-b border-[#E5E5E5] pb-3.5">
                        <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                          DM, Walk-In &amp; Manual Orders
                        </p>
                        <h3 className="text-lg font-bold text-[#0A0A0A]">
                          Log Referred Sale
                        </h3>
                      </div>

                      {saleError && (
                        <div className="p-3 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium">
                          {saleError}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Influencer Code
                        </label>
                        <select
                          value={saleReferralCode || referrals[0]?.code || ''}
                          onChange={(e) => setSaleReferralCode(e.target.value)}
                          disabled={referrals.length === 0}
                          className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A] disabled:bg-[#F5F5F5]"
                        >
                          {referrals.length === 0 ? (
                            <option value="">Create an influencer above first</option>
                          ) : (
                            referrals.map((r) => (
                              <option key={r.code} value={r.code}>
                                {r.code} — {r.influencerName} (
                                {r.commissionType === 'percentage'
                                  ? `${r.commissionValue}%`
                                  : formatPrice(r.commissionValue)}
                                )
                              </option>
                            ))
                          )}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold uppercase tracking-wider">
                          Perfume(s) Sold *
                        </label>
                        <input
                          type="text"
                          value={saleOrderSummary}
                          onChange={(e) => setSaleOrderSummary(e.target.value)}
                          placeholder="e.g. Lattafa Khamrah 100ml + Yara 10ml"
                          maxLength={240}
                          required
                          className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider">
                            Order Total (E) *
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={250000}
                            step="any"
                            value={saleSubtotal}
                            onChange={(e) => setSaleSubtotal(e.target.value)}
                            placeholder="550"
                            required
                            className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider">
                            Discount Given (E)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={250000}
                            step="any"
                            value={saleDiscount}
                            onChange={(e) => setSaleDiscount(e.target.value)}
                            className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider">
                            Status
                          </label>
                          <select
                            value={saleStatus}
                            onChange={(e) =>
                              setSaleStatus(e.target.value as ReferralSaleStatus)
                            }
                            className="w-full px-3 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                          >
                            <option value="confirmed">Confirmed (Owed)</option>
                            <option value="pending">Pending Verification</option>
                            <option value="paid">Already Paid Out</option>
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold uppercase tracking-wider">
                            Branch / Note
                          </label>
                          <input
                            type="text"
                            value={saleCustomerRef}
                            onChange={(e) => setSaleCustomerRef(e.target.value)}
                            placeholder="Manzini Pickup"
                            maxLength={120}
                            className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                          />
                        </div>
                      </div>

                      {selectedManualReferral && manualSalePreview.sub > 0 && (
                        <div className="p-3 bg-[#F6F6F7] border border-[#E5E5E5] rounded-xl flex items-center justify-between text-xs">
                          <span className="text-[#525252]">
                            Net {formatPrice(manualSalePreview.net)} ·{' '}
                            {selectedManualReferral.commissionType === 'percentage'
                              ? `${selectedManualReferral.commissionValue}% rate`
                              : 'Flat payout'}
                          </span>
                          <span className="font-bold text-[#0A0A0A] tabular-nums">
                            Commission: {formatPrice(manualSalePreview.comm)}
                          </span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={savingSale || referrals.length === 0}
                        className="w-full py-3 px-5 border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white disabled:opacity-40 transition-colors rounded-full text-xs font-semibold uppercase tracking-[0.14em]"
                      >
                        {savingSale ? 'Recording Sale...' : 'Log Referred Sale'}
                      </button>
                    </form>
                  </div>

                  {/* RIGHT COLUMN: Partner Applications, Influencers Directory & Commission Ledger */}
                  <div className="lg:col-span-7 space-y-5 sm:space-y-6">
                    {/* Creator Partner Portal Applications */}
                    <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E5E5] pb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                              Partner Portal Sign-Ups ({partnerApplications.length})
                            </h2>
                            {partnerApplications.some((p) => p.status === 'pending') && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D]">
                                {partnerApplications.filter((p) => p.status === 'pending').length} Pending
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#666666] mt-0.5">
                            Creators who signed up via the Referral Partner Portal. Assign or link a promo code to unlock their live sales &amp; commission dashboard.
                          </p>
                        </div>
                      </div>

                      {partnerApplicationsLoading ? (
                        <p className="text-sm text-[#666666] py-4">Loading partner applications...</p>
                      ) : partnerApplications.length === 0 ? (
                        <div className="py-7 text-center border border-dashed border-[#D4D4D4] rounded-2xl">
                          <p className="text-xs text-[#666666]">
                            No creator sign-ups via the Referral Portal yet. Share <span className="font-mono font-semibold text-[#0A0A0A]">/#referral-auth</span> to onboard partners.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {partnerApplications.map((app) => {
                            const draft = getPartnerDraft(app);
                            const isApproving = approvingPartnerUid === app.uid;
                            const isToggling = updatingPartnerStatusUid === app.uid;
                            const statusBadgeClass =
                              app.status === 'active'
                                ? 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]'
                                : app.status === 'paused'
                                ? 'bg-[#F4F4F5] text-[#525252] border-[#D4D4D4]'
                                : 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]';

                            return (
                              <div
                                key={app.uid}
                                className="p-3.5 sm:p-4 border border-[#E5E5E5] bg-[#FAFAFB] rounded-2xl space-y-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-sm font-bold text-[#0A0A0A]">
                                        {app.displayName}
                                      </span>
                                      {app.socialHandle && (
                                        <span className="text-xs text-[#525252]">
                                          {app.socialHandle}
                                        </span>
                                      )}
                                      <span
                                        className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border ${statusBadgeClass}`}
                                      >
                                        {app.status}
                                      </span>
                                      {app.assignedCode && (
                                        <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#0A0A0A] text-[#FACC15]">
                                          Code: {app.assignedCode}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-[#525252] break-words">
                                      {app.email}
                                      {app.requestedCode ? ` · Requested: ${app.requestedCode}` : ''}
                                      {` · Payout: ${app.payoutMethod.toUpperCase()}`}
                                      {app.payoutAccount ? ` (${app.payoutAccount})` : ''}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    {app.status === 'active' && app.assignedCode && (
                                      <button
                                        type="button"
                                        disabled={sendingEmailPartnerUid === app.uid}
                                        onClick={async () => {
                                          const linkedRef = referrals.find(
                                            (r) => r.code === app.assignedCode
                                          );
                                          setSendingEmailPartnerUid(app.uid);
                                          try {
                                            const result = await dispatchPartnerApprovalEmail({
                                              toEmail: app.email,
                                              displayName: app.displayName,
                                              assignedCode: app.assignedCode,
                                              commissionType:
                                                linkedRef?.commissionType ?? draft.commissionType,
                                              commissionValue:
                                                linkedRef?.commissionValue ??
                                                Number(draft.commissionValue || 0),
                                              followerDiscountType:
                                                linkedRef?.followerDiscountType ??
                                                draft.followerDiscountType,
                                              followerDiscountValue:
                                                linkedRef?.followerDiscountValue ??
                                                Number(draft.followerDiscountValue || 0),
                                            });
                                            if (result.status === 'sent') {
                                              setPartnerEmailNotices((prev) => ({
                                                ...prev,
                                                [app.uid]: {
                                                  status: 'sent',
                                                  content: result.content,
                                                },
                                              }));
                                              onNotify(
                                                'Confirmation Email Sent',
                                                `Approval email sent to ${app.email}.`
                                              );
                                            } else {
                                              setPartnerEmailNotices((prev) => ({
                                                ...prev,
                                                [app.uid]: {
                                                  status:
                                                    result.status === 'failed'
                                                      ? 'failed'
                                                      : 'manual-ready',
                                                  error:
                                                    result.status === 'failed'
                                                      ? result.error
                                                      : undefined,
                                                  content: result.content,
                                                },
                                              }));
                                            }
                                          } finally {
                                            setSendingEmailPartnerUid(null);
                                          }
                                        }}
                                        className="px-3 py-1.5 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] text-xs font-medium inline-flex items-center gap-1.5 shrink-0 disabled:opacity-60"
                                      >
                                        <Mail className="w-3.5 h-3.5" />
                                        <span>
                                          {sendingEmailPartnerUid === app.uid
                                            ? 'Sending...'
                                            : 'Email Confirmation'}
                                        </span>
                                      </button>
                                    )}

                                    {app.assignedCode && app.status !== 'pending' && (
                                      <button
                                        type="button"
                                        disabled={isToggling}
                                        onClick={async () => {
                                          const nextStatus: ReferralPartnerStatus =
                                            app.status === 'active' ? 'paused' : 'active';
                                          setUpdatingPartnerStatusUid(app.uid);
                                          try {
                                            await updatePartnerApplicationStatus(app.uid, nextStatus);
                                            onNotify(
                                              nextStatus === 'active'
                                                ? 'Partner Portal Activated'
                                                : 'Partner Portal Paused',
                                              `${app.displayName} portal access is now ${nextStatus}.`
                                            );
                                          } catch (err) {
                                            onNotify(
                                              'Status Update Failed',
                                              extractReadableError(
                                                err,
                                                'Could not update partner access status.'
                                              )
                                            );
                                          } finally {
                                            setUpdatingPartnerStatusUid(null);
                                          }
                                        }}
                                        className="px-3 py-1.5 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] text-xs font-medium shrink-0 disabled:opacity-60"
                                      >
                                        {isToggling
                                          ? 'Saving...'
                                          : app.status === 'active'
                                          ? 'Pause Portal'
                                          : 'Reactivate Portal'}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-2 border-t border-[#E5E5E5] items-end">
                                  <div className="sm:col-span-3 space-y-1">
                                    <label className="block text-[10px] uppercase tracking-wider text-[#666666] font-semibold">
                                      Assign Code
                                    </label>
                                    <input
                                      type="text"
                                      value={draft.code}
                                      onChange={(e) =>
                                        updatePartnerDraft(app.uid, app, {
                                          code: sanitizePromoCode(e.target.value),
                                        })
                                      }
                                      placeholder="e.g. LULU10"
                                      className="w-full px-2.5 py-1.5 bg-white border border-[#D4D4D4] rounded-lg text-xs font-mono uppercase text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                                    />
                                  </div>

                                  <div className="sm:col-span-3 space-y-1">
                                    <label className="block text-[10px] uppercase tracking-wider text-[#666666] font-semibold">
                                      Commission
                                    </label>
                                    <div className="flex gap-1">
                                      <select
                                        value={draft.commissionType}
                                        onChange={(e) =>
                                          updatePartnerDraft(app.uid, app, {
                                            commissionType: e.target
                                              .value as ReferralCommissionType,
                                          })
                                        }
                                        className="px-2 py-1.5 bg-white border border-[#D4D4D4] rounded-lg text-xs text-[#0A0A0A]"
                                      >
                                        <option value="percentage">%</option>
                                        <option value="fixed">E</option>
                                      </select>
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={draft.commissionValue}
                                        onChange={(e) =>
                                          updatePartnerDraft(app.uid, app, {
                                            commissionValue: e.target.value,
                                          })
                                        }
                                        className="w-full px-2 py-1.5 bg-white border border-[#D4D4D4] rounded-lg text-xs tabular-nums text-[#0A0A0A]"
                                      />
                                    </div>
                                  </div>

                                  <div className="sm:col-span-3 space-y-1">
                                    <label className="block text-[10px] uppercase tracking-wider text-[#666666] font-semibold">
                                      Follower Perk
                                    </label>
                                    <div className="flex gap-1">
                                      <select
                                        value={draft.followerDiscountType}
                                        onChange={(e) =>
                                          updatePartnerDraft(app.uid, app, {
                                            followerDiscountType: e.target
                                              .value as ReferralFollowerDiscountType,
                                          })
                                        }
                                        className="px-2 py-1.5 bg-white border border-[#D4D4D4] rounded-lg text-xs text-[#0A0A0A]"
                                      >
                                        <option value="none">None</option>
                                        <option value="percentage">% Off</option>
                                        <option value="fixed">E Off</option>
                                      </select>
                                      {draft.followerDiscountType !== 'none' && (
                                        <input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={draft.followerDiscountValue}
                                          onChange={(e) =>
                                            updatePartnerDraft(app.uid, app, {
                                              followerDiscountValue: e.target.value,
                                            })
                                          }
                                          className="w-full px-2 py-1.5 bg-white border border-[#D4D4D4] rounded-lg text-xs tabular-nums text-[#0A0A0A]"
                                        />
                                      )}
                                    </div>
                                  </div>

                                  <div className="sm:col-span-3 flex justify-end">
                                    <button
                                      type="button"
                                      disabled={isApproving || draft.code.trim().length < 2}
                                      onClick={async () => {
                                        setApprovingPartnerUid(app.uid);
                                        try {
                                          const commVal = Number(draft.commissionValue || 0);
                                          const discVal = Number(
                                            draft.followerDiscountValue || 0
                                          );
                                          await approvePartnerApplication(app, {
                                            code: draft.code,
                                            commissionType: draft.commissionType,
                                            commissionValue: commVal,
                                            followerDiscountType: draft.followerDiscountType,
                                            followerDiscountValue: discVal,
                                            payoutNote: `${app.payoutMethod.toUpperCase()}${
                                              app.payoutAccount ? ` · ${app.payoutAccount}` : ''
                                            }`,
                                            active: draft.active,
                                          });

                                          const emailResult = await dispatchPartnerApprovalEmail({
                                            toEmail: app.email,
                                            displayName: app.displayName,
                                            assignedCode: draft.code,
                                            commissionType: draft.commissionType,
                                            commissionValue: commVal,
                                            followerDiscountType: draft.followerDiscountType,
                                            followerDiscountValue: discVal,
                                          });

                                          if (emailResult.status === 'sent') {
                                            setPartnerEmailNotices((prev) => ({
                                              ...prev,
                                              [app.uid]: {
                                                status: 'sent',
                                                content: emailResult.content,
                                              },
                                            }));
                                            onNotify(
                                              'Partner Approved & Emailed',
                                              `Code ${draft.code} activated and confirmation sent to ${app.email}.`
                                            );
                                          } else {
                                            setPartnerEmailNotices((prev) => ({
                                              ...prev,
                                              [app.uid]: {
                                                status:
                                                  emailResult.status === 'failed'
                                                    ? 'failed'
                                                    : 'manual-ready',
                                                error:
                                                  emailResult.status === 'failed'
                                                    ? emailResult.error
                                                    : undefined,
                                                content: emailResult.content,
                                              },
                                            }));
                                            onNotify(
                                              'Partner Approved · Send Email',
                                              `${app.displayName} linked to ${draft.code}. Tap "Open Email App" below to confirm via ${app.email}.`
                                            );
                                          }
                                        } catch (err) {
                                          onNotify(
                                            'Approval Failed',
                                            extractReadableError(
                                              err,
                                              'Could not approve partner application.'
                                            )
                                          );
                                        } finally {
                                          setApprovingPartnerUid(null);
                                        }
                                      }}
                                      className="w-full px-3 py-2 rounded-xl bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 text-xs font-semibold whitespace-nowrap"
                                    >
                                      {isApproving
                                        ? 'Linking...'
                                        : app.assignedCode
                                        ? 'Update Link'
                                        : 'Approve & Link'}
                                    </button>
                                  </div>
                                </div>

                                {partnerEmailNotices[app.uid] && (() => {
                                  const notice = partnerEmailNotices[app.uid];
                                  return (
                                    <div
                                      className={`rounded-2xl p-3.5 border text-xs space-y-2.5 ${
                                        notice.status === 'sent'
                                          ? 'bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]'
                                          : 'bg-[#FFFBEB] border-[#FCD34D] text-[#78350F]'
                                      }`}
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                        <div className="flex items-start sm:items-center gap-2 font-semibold min-w-0">
                                          <MailCheck className="w-4 h-4 shrink-0 mt-0.5 sm:mt-0" />
                                          <span className="break-words min-w-0">
                                            {notice.status === 'sent'
                                              ? `Approval email automatically sent to ${notice.content.toEmail}`
                                              : notice.status === 'failed'
                                              ? `Auto-email failed (${notice.error}). Send manually to ${notice.content.toEmail}:`
                                              : `Ready to email confirmation to ${notice.content.toEmail}`}
                                          </span>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setPartnerEmailNotices((prev) => {
                                              const next = { ...prev };
                                              delete next[app.uid];
                                              return next;
                                            })
                                          }
                                          className="text-[11px] underline self-start sm:self-auto"
                                        >
                                          Dismiss
                                        </button>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2">
                                        <a
                                          href={notice.content.mailtoUrl}
                                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] font-semibold"
                                        >
                                          <Mail className="w-3.5 h-3.5 text-[#FACC15]" />
                                          <span>Open Email App</span>
                                        </a>

                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              await navigator.clipboard.writeText(
                                                `Subject: ${notice.content.subject}\n\n${notice.content.body}`
                                              );
                                              setPartnerEmailNotices((prev) => ({
                                                ...prev,
                                                [app.uid]: { ...notice, copied: true },
                                              }));
                                              onNotify(
                                                'Email Copied',
                                                `Approval email for ${notice.content.toEmail} copied to clipboard.`
                                              );
                                            } catch {
                                              // Ignore clipboard errors
                                            }
                                          }}
                                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] text-[#0A0A0A] font-medium"
                                        >
                                          {notice.copied ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                          <span>
                                            {notice.copied ? 'Email Copied' : 'Copy Email Text'}
                                          </span>
                                        </button>

                                        {!isAutoPartnerEmailConfigured() && notice.status !== 'sent' && (
                                          <span className="text-[11px] text-[#78350F]/85">
                                            Tip: Add EmailJS keys in <span className="font-mono">.env</span> for automatic inbox delivery.
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Influencer Codes Directory */}
                    <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5">
                      <div className="border-b border-[#E5E5E5] pb-4">
                        <h2 className="text-2xl font-bold text-[#0A0A0A]">
                          Influencer Partners ({referrals.length})
                        </h2>
                        <p className="text-xs text-[#666666] mt-0.5">
                          Copy any creator&apos;s <span className="font-mono">?ref=CODE</span> link or caption to track sales and commissions automatically.
                        </p>
                      </div>

                      {referralsLoading ? (
                        <p className="text-sm text-[#666666] py-6">Loading influencers...</p>
                      ) : referrals.length === 0 ? (
                        <div className="py-10 text-center space-y-2 border border-dashed border-[#D4D4D4] rounded-2xl">
                          <Users className="w-6 h-6 mx-auto text-[#737373]" />
                          <p className="text-xl font-bold text-[#0A0A0A]">
                            No Influencers Configured Yet
                          </p>
                          <p className="text-xs text-[#666666] max-w-sm mx-auto">
                            Create a referral code for your first brand ambassador on the left to generate their trackable link and commission rate.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {referrals.map((refItem) => {
                            const stats = referralSummaryStats.byCode.get(refItem.code) ?? {
                              orders: 0,
                              sales: 0,
                              owed: 0,
                              paid: 0,
                              pendingCount: 0,
                            };

                            return (
                              <div
                                key={refItem.code}
                                className="p-4 border border-[#E5E5E5] bg-[#F7F7F8] rounded-2xl space-y-3"
                              >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                  <div className="space-y-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-sm font-bold tracking-wider px-3 py-1 bg-[#0A0A0A] text-white rounded-full">
                                        {refItem.code}
                                      </span>
                                      <span className="text-sm font-bold text-[#0A0A0A]">
                                        {refItem.influencerName}
                                      </span>
                                      {refItem.socialHandle && (
                                        <span className="text-xs text-[#525252]">
                                          {refItem.socialHandle}
                                        </span>
                                      )}
                                      <span
                                        className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full ${
                                          refItem.active
                                            ? 'bg-[#FACC15] text-[#0A0A0A]'
                                            : 'bg-[#E5E5E5] text-[#737373]'
                                        }`}
                                      >
                                        {refItem.active ? 'Active' : 'Paused'}
                                      </span>
                                      {refItem.partnerUid && (
                                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#166534]">
                                          Portal Linked
                                        </span>
                                      )}
                                    </div>

                                    <p className="text-xs text-[#404040]">
                                      <strong className="text-[#0A0A0A]">
                                        Commission:{' '}
                                        {refItem.commissionType === 'percentage'
                                          ? `${refItem.commissionValue}% per sale`
                                          : `${formatPrice(refItem.commissionValue)} per sale`}
                                      </strong>{' '}
                                      ·{' '}
                                      <span>
                                        {refItem.followerDiscountType === 'percentage' &&
                                        refItem.followerDiscountValue > 0
                                          ? `Followers get ${refItem.followerDiscountValue}% Off`
                                          : refItem.followerDiscountType === 'fixed' &&
                                            refItem.followerDiscountValue > 0
                                          ? `Followers get ${formatPrice(
                                              refItem.followerDiscountValue
                                            )} Off`
                                          : 'No follower discount (track only)'}
                                      </span>
                                    </p>

                                    {refItem.payoutNote && (
                                      <p className="text-[11px] text-[#666666]">
                                        {refItem.payoutNote}
                                      </p>
                                    )}
                                  </div>

                                  {/* Quick per-influencer totals */}
                                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0 text-right">
                                    <span className="text-xs font-semibold text-[#0A0A0A] tabular-nums">
                                      {stats.orders} sale{stats.orders === 1 ? '' : 's'} ·{' '}
                                      {formatPrice(stats.sales)}
                                    </span>
                                    <span className="text-[11px] text-[#525252] tabular-nums">
                                      Owed{' '}
                                      <strong className="text-[#0A0A0A]">
                                        {formatPrice(stats.owed)}
                                      </strong>{' '}
                                      · Paid{' '}
                                      <strong className="text-[#166534]">
                                        {formatPrice(stats.paid)}
                                      </strong>
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E5E5E5]">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyReferralLink(refItem.code)}
                                    className="px-3 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium inline-flex items-center gap-1.5"
                                  >
                                    {copiedReferralLinkCode === refItem.code ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Link2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>
                                      {copiedReferralLinkCode === refItem.code
                                        ? 'Link Copied'
                                        : 'Copy Link'}
                                    </span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCopyReferralPost(refItem)}
                                    className="px-3 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium inline-flex items-center gap-1.5"
                                  >
                                    {copiedReferralPostCode === refItem.code ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Share2 className="w-3.5 h-3.5" />
                                    )}
                                    <span>Copy Post</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSaleReferralCode(refItem.code);
                                      setLedgerCodeFilter(refItem.code);
                                    }}
                                    className="px-3 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                                  >
                                    Filter / Log Sale
                                  </button>

                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        await toggleReferralActive(refItem);
                                        onNotify(
                                          refItem.active
                                            ? 'Influencer Paused'
                                            : 'Influencer Activated',
                                          `${refItem.code} updated.`
                                        );
                                      } catch (err) {
                                        onNotify(
                                          'Update Failed',
                                          extractReadableError(
                                            err,
                                            'Could not toggle referral status.'
                                          )
                                        );
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                                  >
                                    {refItem.active ? 'Pause' : 'Activate'}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleEditReferral(refItem)}
                                    className="px-3 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                                  >
                                    Edit
                                  </button>

                                  {confirmDeleteReferralCode === refItem.code ? (
                                    <div className="inline-flex gap-1 ml-auto">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await deleteReferral(refItem.code);
                                            setConfirmDeleteReferralCode(null);
                                            onNotify(
                                              'Influencer Removed',
                                              `${refItem.code} deleted.`
                                            );
                                          } catch (err) {
                                            onNotify(
                                              'Delete Failed',
                                              extractReadableError(
                                                err,
                                                'Could not delete referral.'
                                              )
                                            );
                                          }
                                        }}
                                        className="px-3 py-1.5 bg-[#DC2626] text-white rounded-full text-xs font-semibold"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteReferralCode(null)}
                                        className="px-2.5 py-1.5 border border-[#D4D4D4] bg-white rounded-full text-xs"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmDeleteReferralCode(refItem.code)
                                      }
                                      aria-label={`Delete referral ${refItem.code}`}
                                      className="p-2 ml-auto bg-white border border-[#D4D4D4] rounded-full text-[#525252] hover:text-[#DC2626] hover:border-[#DC2626]"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Pending WhatsApp Attributions Verification Queue */}
                    <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E5E5] pb-4">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                              Pending WhatsApp Attributions ({pendingAttributions.length})
                            </h2>
                            {pendingAttributions.length > 0 && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#FEF3C7] text-[#92400E] border border-[#FCD34D] whitespace-nowrap">
                                Needs Verification
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#666666] mt-0.5">
                            Verify payment on WhatsApp first, confirm or adjust the order amount, then approve to calculate authoritative creator commission.
                          </p>
                        </div>
                      </div>

                      {referralAttributionsLoading ? (
                        <p className="text-sm text-[#666666] py-4">
                          Loading pending WhatsApp referral attributions...
                        </p>
                      ) : pendingAttributions.length === 0 ? (
                        <div className="py-8 text-center space-y-1.5 border border-dashed border-[#D4D4D4] rounded-2xl">
                          <Clock className="w-5 h-5 mx-auto text-[#737373]" />
                          <p className="text-sm font-bold text-[#0A0A0A]">
                            No Pending WhatsApp Attributions
                          </p>
                          <p className="text-xs text-[#666666] max-w-sm mx-auto">
                            New customer WhatsApp checkouts with a referral code land here unconfirmed until verified by an admin.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {pendingAttributions.map((attr: ReferralAttribution) => {
                            const draft = attributionEdits[attr.id] ?? {
                              subtotal: String(attr.reportedSubtotal),
                              discount: String(attr.reportedDiscount),
                            };
                            const verifiedSub = Math.max(0, Number(draft.subtotal || 0));
                            const verifiedDisc = Math.min(
                              verifiedSub,
                              Math.max(0, Number(draft.discount || 0))
                            );
                            const verifiedNet = Math.max(
                              0,
                              Math.round((verifiedSub - verifiedDisc) * 100) / 100
                            );
                            const refObj =
                              referrals.find((r) => r.code === attr.referralCode) ?? null;
                            const estComm = calculateReferralCommission(verifiedNet, refObj);
                            const busy = processingAttributionId === attr.id;

                            return (
                              <div
                                key={attr.id}
                                className="p-3.5 sm:p-4 border border-[#FCD34D] bg-[#FFFBEB] rounded-2xl space-y-3"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-[#0A0A0A] text-white rounded-full">
                                      {attr.referralCode}
                                    </span>
                                    <span className="text-xs font-semibold text-[#92400E]">
                                      Unverified WhatsApp Quote
                                    </span>
                                    <span className="text-[11px] text-[#737373]">
                                      {new Date(attr.createdAtMs).toLocaleString()}
                                    </span>
                                  </div>
                                  {refObj ? (
                                    <span className="text-xs font-semibold text-[#0A0A0A] tabular-nums">
                                      Auth. Commission Preview: {formatPrice(estComm)}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-[#991B1B] font-medium">
                                      Code profile deleted
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <p className="text-sm font-semibold text-[#0A0A0A]">
                                    {attr.orderSummary}
                                  </p>
                                  <p className="text-xs text-[#525252]">
                                    Client Quote: {formatPrice(attr.reportedSubtotal)} · Disc:{' '}
                                    {formatPrice(attr.reportedDiscount)}
                                    {attr.customerRef ? ` · ${attr.customerRef}` : ''}
                                  </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end pt-1">
                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
                                      Verified Subtotal (E)
                                    </label>
                                    <input
                                      type="number"
                                      min={0.01}
                                      max={250000}
                                      step="any"
                                      value={draft.subtotal}
                                      onChange={(e) =>
                                        setAttributionEdits((prev) => ({
                                          ...prev,
                                          [attr.id]: {
                                            subtotal: e.target.value,
                                            discount: draft.discount,
                                          },
                                        }))
                                      }
                                      className="w-full px-3 py-1.5 bg-white border border-[#D4D4D4] rounded-xl text-xs tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#525252]">
                                      Verified Discount (E)
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={250000}
                                      step="any"
                                      value={draft.discount}
                                      onChange={(e) =>
                                        setAttributionEdits((prev) => ({
                                          ...prev,
                                          [attr.id]: {
                                            subtotal: draft.subtotal,
                                            discount: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full px-3 py-1.5 bg-white border border-[#D4D4D4] rounded-xl text-xs tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                                    />
                                  </div>

                                  <button
                                    type="button"
                                    disabled={busy || !refObj || verifiedSub <= 0}
                                    onClick={async () => {
                                      setProcessingAttributionId(attr.id);
                                      try {
                                        await approveReferralAttribution(
                                          attr,
                                          verifiedSub,
                                          verifiedDisc
                                        );
                                        onNotify(
                                          'Referral Sale Approved',
                                          `Confirmed ${formatPrice(estComm)} commission for ${attr.referralCode}.`
                                        );
                                      } catch (err) {
                                        onNotify(
                                          'Approval Failed',
                                          extractReadableError(
                                            err,
                                            'Could not approve referral attribution.'
                                          )
                                        );
                                      } finally {
                                        setProcessingAttributionId(null);
                                      }
                                    }}
                                    className="w-full px-3.5 py-2.5 sm:py-2 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-45 rounded-full text-xs font-semibold text-center whitespace-nowrap"
                                  >
                                    {busy ? 'Approving...' : 'Approve & Create Commission'}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={async () => {
                                      setProcessingAttributionId(attr.id);
                                      try {
                                        await dismissReferralAttribution(attr.id);
                                        onNotify(
                                          'Attribution Dismissed',
                                          `Marked ${attr.referralCode} quote dismissed.`
                                        );
                                      } catch (err) {
                                        onNotify(
                                          'Dismiss Failed',
                                          extractReadableError(
                                            err,
                                            'Could not dismiss attribution.'
                                          )
                                        );
                                      } finally {
                                        setProcessingAttributionId(null);
                                      }
                                    }}
                                    className="w-full px-3.5 py-2.5 sm:py-2 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] disabled:opacity-45 rounded-full text-xs font-medium text-center whitespace-nowrap"
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Commission Ledger & Payout Queue */}
                    <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5E5] pb-4">
                        <div>
                          <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                            Sales &amp; Payout Ledger ({filteredReferralSales.length})
                          </h2>
                          <p className="text-xs text-[#666666]">
                            Confirmed influencer commissions and settlement payouts verified by an admin.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
                          <select
                            value={ledgerCodeFilter}
                            onChange={(e) => setLedgerCodeFilter(e.target.value)}
                            aria-label="Filter sales by influencer"
                            className="w-full sm:w-auto min-w-0 px-3 py-2 sm:py-1.5 border border-[#D4D4D4] rounded-full bg-white text-xs font-medium focus:outline-none focus:border-[#0A0A0A]"
                          >
                            <option value="ALL">All Influencers</option>
                            {referrals.map((r) => (
                              <option key={r.code} value={r.code}>
                                {r.code}
                              </option>
                            ))}
                          </select>
                          <select
                            value={ledgerStatusFilter}
                            onChange={(e) =>
                              setLedgerStatusFilter(
                                e.target.value as 'all' | ReferralSaleStatus
                              )
                            }
                            aria-label="Filter sales by status"
                            className="w-full sm:w-auto min-w-0 px-3 py-2 sm:py-1.5 border border-[#D4D4D4] rounded-full bg-white text-xs font-medium focus:outline-none focus:border-[#0A0A0A]"
                          >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending Review</option>
                            <option value="confirmed">Confirmed (Owed)</option>
                            <option value="paid">Paid Out</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>

                      {referralSalesLoading ? (
                        <p className="text-sm text-[#666666] py-6">
                          Loading referral sales ledger...
                        </p>
                      ) : filteredReferralSales.length === 0 ? (
                        <div className="py-10 text-center space-y-2 border border-dashed border-[#D4D4D4] rounded-2xl">
                          <Receipt className="w-6 h-6 mx-auto text-[#737373]" />
                          <p className="text-lg font-bold text-[#0A0A0A]">
                            No Referral Sales Recorded Yet
                          </p>
                          <p className="text-xs text-[#666666] max-w-sm mx-auto">
                            Orders placed using a follower link or code appear here automatically, or you can log sales manually using the form on the left.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredReferralSales.map((sale: ReferralSale) => {
                            const statusBadge =
                              sale.commissionStatus === 'paid'
                                ? 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]'
                                : sale.commissionStatus === 'confirmed'
                                ? 'bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]'
                                : sale.commissionStatus === 'cancelled'
                                ? 'bg-[#F4F4F5] text-[#737373] border-[#E5E5E5]'
                                : 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]';

                            return (
                              <div
                                key={sale.id}
                                className="p-3.5 sm:p-4 border border-[#E5E5E5] bg-[#F7F7F8] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-[#0A0A0A] text-white rounded-full">
                                      {sale.referralCode}
                                    </span>
                                    <span
                                      className={`text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded-full border ${statusBadge}`}
                                    >
                                      {sale.commissionStatus === 'confirmed'
                                        ? 'Confirmed · Owed'
                                        : sale.commissionStatus}
                                    </span>
                                    <span className="text-[11px] text-[#737373]">
                                      {sale.source === 'checkout'
                                        ? 'Auto Checkout'
                                        : 'Manual Log'}{' '}
                                      ·{' '}
                                      {new Date(sale.createdAtMs).toLocaleDateString()}
                                    </span>
                                  </div>

                                  <p className="text-sm font-semibold text-[#0A0A0A] line-clamp-2 sm:truncate">
                                    {sale.orderSummary}
                                  </p>

                                  <p className="text-xs text-[#525252]">
                                    Order Net:{' '}
                                    <strong className="text-[#0A0A0A] tabular-nums">
                                      {formatPrice(sale.netOrderAmount)}
                                    </strong>{' '}
                                    · Commission:{' '}
                                    <strong className="text-[#0A0A0A] tabular-nums">
                                      {formatPrice(sale.commissionAmount)}
                                    </strong>
                                    {sale.customerRef ? ` · ${sale.customerRef}` : ''}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                  {sale.commissionStatus === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await updateReferralSaleStatus(
                                            sale.id,
                                            'confirmed'
                                          );
                                          onNotify(
                                            'Sale Confirmed',
                                            `Commission ${formatPrice(
                                              sale.commissionAmount
                                            )} confirmed for ${sale.referralCode}.`
                                          );
                                        } catch (err) {
                                          onNotify(
                                            'Update Failed',
                                            extractReadableError(
                                              err,
                                              'Could not confirm sale.'
                                            )
                                          );
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-[#0A0A0A] text-white hover:bg-[#262626] rounded-full text-xs font-semibold"
                                    >
                                      Confirm
                                    </button>
                                  )}

                                  {(sale.commissionStatus === 'pending' ||
                                    sale.commissionStatus === 'confirmed') && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await updateReferralSaleStatus(sale.id, 'paid');
                                          onNotify(
                                            'Commission Marked Paid',
                                            `Settled ${formatPrice(
                                              sale.commissionAmount
                                            )} for ${sale.referralCode}.`
                                          );
                                        } catch (err) {
                                          onNotify(
                                            'Update Failed',
                                            extractReadableError(
                                              err,
                                              'Could not mark commission paid.'
                                            )
                                          );
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-[#166534] text-white hover:opacity-90 rounded-full text-xs font-semibold"
                                    >
                                      Mark Paid
                                    </button>
                                  )}

                                  {sale.commissionStatus === 'paid' && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await updateReferralSaleStatus(
                                            sale.id,
                                            'confirmed'
                                          );
                                        } catch (err) {
                                          onNotify(
                                            'Update Failed',
                                            extractReadableError(
                                              err,
                                              'Could not revert status.'
                                            )
                                          );
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                                    >
                                      Reopen
                                    </button>
                                  )}

                                  {sale.commissionStatus !== 'cancelled' &&
                                    sale.commissionStatus !== 'paid' && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await updateReferralSaleStatus(
                                              sale.id,
                                              'cancelled'
                                            );
                                          } catch (err) {
                                            onNotify(
                                              'Update Failed',
                                              extractReadableError(
                                                err,
                                                'Could not cancel entry.'
                                              )
                                            );
                                          }
                                        }}
                                        className="px-3 py-1.5 bg-white border border-[#D4D4D4] hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                                      >
                                        Cancel
                                      </button>
                                    )}

                                  {confirmDeleteSaleId === sale.id ? (
                                    <div className="inline-flex gap-1">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            await deleteReferralSale(sale.id);
                                            setConfirmDeleteSaleId(null);
                                          } catch (err) {
                                            onNotify(
                                              'Delete Failed',
                                              extractReadableError(
                                                err,
                                                'Could not delete ledger entry.'
                                              )
                                            );
                                          }
                                        }}
                                        className="px-2.5 py-1.5 bg-[#DC2626] text-white rounded-full text-xs font-semibold"
                                      >
                                        Delete
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteSaleId(null)}
                                        className="px-2 py-1.5 bg-white border border-[#D4D4D4] rounded-full text-xs"
                                      >
                                        No
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteSaleId(sale.id)}
                                      aria-label={`Delete sale ${sale.orderSummary}`}
                                      className="p-1.5 bg-white border border-[#D4D4D4] rounded-full text-[#525252] hover:text-[#DC2626] hover:border-[#DC2626]"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 7: ADMIN AUDIT TRAIL */}
            {activeTab === 'audit' && (
              <div className="space-y-5 sm:space-y-6">
                <div className="bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#E5E5E5] pb-4 sm:pb-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#525252]">
                        <History className="w-3.5 h-3.5 text-[#0A0A0A]" />
                        <span>Immutable Change Log</span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                        Admin Audit Trail ({filteredAuditLogs.length})
                      </h2>
                      <p className="text-xs text-[#666666]">
                        Every create, edit, status toggle, import, or delete action is permanently recorded with the admin username and exact field changes.
                      </p>
                    </div>

                    {auditActors.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAuditActorFilter('ALL')}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                            auditActorFilter === 'ALL'
                              ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                              : 'bg-white text-[#525252] border-[#D4D4D4] hover:border-[#0A0A0A]'
                          }`}
                        >
                          All Admins ({auditLogs.length})
                        </button>
                        {auditActors.map((actor) => (
                          <button
                            key={actor.key}
                            type="button"
                            onClick={() =>
                              setAuditActorFilter(
                                auditActorFilter === actor.key ? 'ALL' : actor.key
                              )
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                              auditActorFilter === actor.key
                                ? 'bg-[#0A0A0A] text-[#FACC15] border-[#0A0A0A]'
                                : 'bg-[#F7F7F8] text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                            }`}
                          >
                            @{actor.username} ({actor.count})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Filter Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={auditSearch}
                        onChange={(e) => setAuditSearch(e.target.value)}
                        placeholder="Search user, perfume, price, or change..."
                        aria-label="Search audit trail"
                        className="w-full pl-10 pr-4 py-2.5 bg-[#F6F6F7] border border-[#D4D4D4] rounded-xl text-sm text-[#0A0A0A] focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
                      />
                    </div>

                    <select
                      value={auditActorFilter}
                      onChange={(e) => setAuditActorFilter(e.target.value)}
                      aria-label="Filter by admin username"
                      className="px-3.5 py-2.5 bg-white border border-[#D4D4D4] rounded-xl text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                    >
                      <option value="ALL">All Admin Usernames</option>
                      {auditActors.map((actor) => (
                        <option key={actor.key} value={actor.key}>
                          @{actor.username} ({actor.email})
                        </option>
                      ))}
                    </select>

                    <select
                      value={auditSectionFilter}
                      onChange={(e) =>
                        setAuditSectionFilter(e.target.value as 'all' | AuditSection)
                      }
                      aria-label="Filter by dashboard section"
                      className="px-3.5 py-2.5 bg-white border border-[#D4D4D4] rounded-xl text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                    >
                      <option value="all">All Sections</option>
                      <option value="perfume">Perfumes & Pricing</option>
                      <option value="specials">Seasonal Specials</option>
                      <option value="weekly-special">Weekly 5ml Special</option>
                      <option value="coupon">Social Coupons</option>
                      <option value="combo">Combo Deals</option>
                      <option value="layering">Layering Rituals</option>
                      <option value="hamper">Gift Hampers</option>
                      <option value="referral">Influencer Codes</option>
                      <option value="referral-attribution">Referral Attributions</option>
                      <option value="referral-sale">Referral Sales Ledger</option>
                      <option value="referral-partner">Partner Portal</option>
                    </select>

                    <select
                      value={auditActionFilter}
                      onChange={(e) =>
                        setAuditActionFilter(e.target.value as 'all' | AuditAction)
                      }
                      aria-label="Filter by action type"
                      className="px-3.5 py-2.5 bg-white border border-[#D4D4D4] rounded-xl text-sm text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                    >
                      <option value="all">All Actions</option>
                      <option value="create">Created</option>
                      <option value="update">Updated</option>
                      <option value="delete">Deleted</option>
                      <option value="import">Imported</option>
                    </select>
                  </div>

                  {/* Audit Timeline Feed */}
                  {auditLogsLoading ? (
                    <p className="text-sm text-[#666666] py-8">Loading audit history...</p>
                  ) : filteredAuditLogs.length === 0 ? (
                    <div className="py-12 text-center space-y-2 border border-dashed border-[#D4D4D4] rounded-2xl">
                      <History className="w-7 h-7 mx-auto text-[#737373]" />
                      <p className="text-xl font-bold text-[#0A0A0A]">
                        {auditLogs.length === 0
                          ? 'No Admin Changes Recorded Yet'
                          : 'No Matching Audit Entries'}
                      </p>
                      <p className="text-xs text-[#666666] max-w-md mx-auto">
                        {auditLogs.length === 0
                          ? 'Whenever an admin adds, updates, or deletes a perfume, price, special, coupon, hamper, or referral code, the change will appear here automatically.'
                          : 'Try clearing your search or changing the admin, section, or action filter.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredAuditLogs.map((entry: AuditLogEntry) => {
                        const actionBadgeClass =
                          entry.action === 'create'
                            ? 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]'
                            : entry.action === 'delete'
                            ? 'bg-[#FEE2E2] text-[#991B1B] border-[#FCA5A5]'
                            : entry.action === 'import'
                            ? 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]'
                            : 'bg-[#DBEAFE] text-[#1E40AF] border-[#BFDBFE]';

                        const actionLabel =
                          entry.action === 'create'
                            ? 'Created'
                            : entry.action === 'delete'
                            ? 'Deleted'
                            : entry.action === 'import'
                            ? 'Imported'
                            : 'Updated';

                        const sectionLabelMap: Record<AuditSection, string> = {
                          perfume: 'Perfume',
                          specials: 'Specials',
                          'weekly-special': 'Weekly 5ml',
                          coupon: 'Coupon',
                          combo: 'Combo Deal',
                          layering: 'Layering',
                          hamper: 'Gift Hamper',
                          referral: 'Referral Code',
                          'referral-attribution': 'Referral Attrib.',
                          'referral-sale': 'Referral Sale',
                          'referral-partner': 'Partner Portal',
                        };

                        return (
                          <div
                            key={entry.id}
                            className="p-3.5 sm:p-5 border border-[#E5E5E5] bg-[#FAFAFB] rounded-2xl space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                                <span className="px-2.5 py-0.5 rounded-full bg-[#0A0A0A] text-[#FACC15] text-xs font-bold font-mono">
                                  @{entry.actorUsername}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${actionBadgeClass}`}
                                >
                                  {actionLabel}
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white border border-[#D4D4D4] text-[#404040]">
                                  {sectionLabelMap[entry.section] ?? entry.section}
                                </span>
                                <span className="text-xs text-[#737373] break-all">
                                  {entry.actorEmail}
                                </span>
                              </div>

                              <span className="text-[11px] font-medium text-[#737373] tabular-nums shrink-0">
                                {new Date(entry.createdAtMs).toLocaleString()}
                              </span>
                            </div>

                            <div>
                              <p className="text-sm font-bold text-[#0A0A0A]">
                                {entry.summary}
                              </p>
                              <p className="text-xs text-[#525252]">
                                Target: <span className="font-medium text-[#0A0A0A]">{entry.targetLabel}</span>
                              </p>
                            </div>

                            {entry.changes.length > 0 && (
                              <ul className="bg-white border border-[#E5E5E5] rounded-xl p-3 space-y-1">
                                {entry.changes.map((line, idx) => (
                                  <li
                                    key={`${entry.id}-chg-${idx}`}
                                    className="text-xs text-[#262626] flex items-start gap-2 leading-relaxed"
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#0A0A0A] mt-1.5 shrink-0" />
                                    <span>{line}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* PERFUME CREATE / EDIT MODAL */}
      <AnimatePresence>
        {editorOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditorOpen(false)}
              className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                transition={{ duration: 0.2 }}
                role="dialog"
                aria-modal="true"
                aria-label={editingPerfumeId ? 'Edit Perfume' : 'Add New Perfume'}
                className="pointer-events-auto w-full max-w-3xl bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[92dvh] flex flex-col"
              >
                <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-b border-[#E5E5E5] flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#666666] font-medium">
                      Catalogue Editor
                    </p>
                    <h2 className="text-lg sm:text-2xl font-bold text-[#0A0A0A] truncate">
                      {editingPerfumeId ? 'Update Perfume & Pricing' : 'Add New Perfume'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    aria-label="Close editor"
                    className="p-2 rounded-full text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form
                  noValidate
                  onSubmit={handleSavePerfume}
                  className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6"
                >
                  {formError && (
                    <div className="p-3.5 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium">
                      {formError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Perfume Name *
                      </label>
                      <input
                        type="text"
                        maxLength={140}
                        value={pName}
                        onChange={(e) => setPName(e.target.value)}
                        placeholder="e.g. Khamrah Qahwa"
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Perfume House / Brand *
                      </label>
                      <select
                        value={pBrandSelect}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPBrandSelect(val);
                          if (val !== 'Custom' && houseImages[val] && !editingPerfumeId) {
                            setPImage(houseImages[val]);
                          }
                        }}
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                      >
                        {featuredPerfumeHouses.map((house) => (
                          <option key={house} value={house}>
                            {house}
                          </option>
                        ))}
                        <option value="Custom">Other / Custom House</option>
                      </select>
                      {pBrandSelect === 'Custom' && (
                        <input
                          type="text"
                          required
                          maxLength={100}
                          value={pCustomBrand}
                          onChange={(e) => setPCustomBrand(e.target.value)}
                          placeholder="Enter fragrance house name"
                          className="mt-2 w-full px-3.5 py-2 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Category
                      </label>
                      <select
                        value={pCategory}
                        onChange={(e) => setPCategory(e.target.value as FragranceCategory)}
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                      >
                        <option value="Men">Men</option>
                        <option value="Women">Women</option>
                        <option value="Unisex">Unisex</option>
                        <option value="Kiddies">Kiddies</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Concentration
                      </label>
                      <input
                        type="text"
                        maxLength={100}
                        value={pConcentration}
                        onChange={(e) => setPConcentration(e.target.value)}
                        placeholder="Extrait de Parfum"
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Availability
                      </label>
                      <select
                        value={pAvailability}
                        onChange={(e) => {
                          const next = e.target.value as AvailabilityStatus;
                          setPAvailability(next);
                          if (next === 'Out of Stock') {
                            setPBranches([]);
                          } else if (pBranches.length === 0) {
                            setPBranches(['manzini', 'mbabane']);
                          }
                        }}
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                      >
                        <option value="In Stock">In Stock</option>
                        <option value="Low Stock">Low Stock</option>
                        <option value="Out of Stock">Out of Stock</option>
                        <option value="Pre-Order">Pre-Order</option>
                      </select>
                    </div>
                  </div>

                  {/* Per-Branch Store Stock Toggles (Manzini & Mbabane) */}
                  <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
                        Store Branch Availability
                      </span>
                      <span className="block text-[11px] text-[#666666]">
                        Choose which AuraHut Co. branch currently stocks this fragrance.
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {ALL_BRANCH_IDS.map((branchId) => {
                        const branchMeta = siteConfig.branches.find((b) => b.id === branchId);
                        const checked = pBranches.includes(branchId);
                        return (
                          <label
                            key={branchId}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                              checked
                                ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                                : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                const next = isChecked
                                  ? normalizeBranches([...pBranches, branchId])
                                  : pBranches.filter((b) => b !== branchId);
                                setPBranches(next);
                                if (next.length === 0) {
                                  setPAvailability('Out of Stock');
                                } else if (pAvailability === 'Out of Stock') {
                                  setPAvailability('In Stock');
                                }
                              }}
                              className="sr-only"
                            />
                            <span
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] ${
                                checked
                                  ? 'bg-[#FACC15] text-[#0A0A0A] border-[#FACC15]'
                                  : 'bg-white border-[#D4D4D4]'
                              }`}
                            >
                              {checked ? '✓' : ''}
                            </span>
                            <span>{branchMeta?.city ?? branchId} Store</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Flexible Size & Price Matrix */}
                  <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-4 sm:p-5 space-y-4">
                    <div>
                      <span className="block text-xs font-semibold uppercase tracking-wider">
                        Bottle Sizes &amp; SZL Pricing
                      </span>
                      <span className="block text-[11px] text-[#666666]">
                        Edit any size label directly (e.g. 50ml, 70ml, 80ml), toggle availability, or add custom volumes.
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {pSizes.map((slot, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-[#E5E5E5] rounded-xl p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <input
                              type="text"
                              maxLength={24}
                              value={slot.size}
                              onChange={(e) => {
                                const next = [...pSizes];
                                next[idx] = { ...next[idx], size: e.target.value };
                                setPSizes(next);
                              }}
                              aria-label={`Size label ${idx + 1}`}
                              placeholder="e.g. 70ml"
                              className="w-full min-w-0 px-2 py-1 border border-[#E5E5E5] rounded-lg text-xs font-semibold text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                            />
                            <input
                              type="checkbox"
                              checked={slot.available}
                              onChange={(e) => {
                                const next = [...pSizes];
                                next[idx] = { ...next[idx], available: e.target.checked };
                                setPSizes(next);
                              }}
                              aria-label={`Enable ${slot.size}`}
                              className="accent-[#0A0A0A] w-3.5 h-3.5 shrink-0 cursor-pointer"
                            />
                            {pSizes.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPSizes((prev) => prev.filter((_, i) => i !== idx))
                                }
                                aria-label={`Remove ${slot.size}`}
                                className="p-1 text-[#737373] hover:text-[#DC2626] shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#737373]">
                              E
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100000}
                              step="any"
                              disabled={!slot.available}
                              value={slot.price === null ? '' : slot.price}
                              onChange={(e) => {
                                const val = e.target.value;
                                const next = [...pSizes];
                                next[idx] = {
                                  ...next[idx],
                                  price: val === '' ? null : Number(val),
                                };
                                setPSizes(next);
                              }}
                              placeholder="Price"
                              className="w-full pl-6 pr-2 py-1.5 border border-[#D4D4D4] rounded-lg text-xs tabular-nums disabled:bg-[#F5F5F5] focus:outline-none focus:border-[#0A0A0A]"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Quick-Add Presets & Custom Size */}
                    <div className="pt-2 border-t border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-[#666666] mr-1">
                          Quick Add:
                        </span>
                        {STANDARD_BOTTLE_SIZES.map((preset) => {
                          const alreadyAdded = pSizes.some(
                            (s) => s.size.trim().toLowerCase() === preset.toLowerCase()
                          );
                          return (
                            <button
                              key={preset}
                              type="button"
                              disabled={alreadyAdded}
                              onClick={() => handleAddSizeSlot(preset)}
                              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                alreadyAdded
                                  ? 'bg-[#E5E5E5]/60 text-[#999999] border-[#E5E5E5] cursor-default'
                                  : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                              }`}
                            >
                              + {preset}
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                        <input
                          type="text"
                          maxLength={24}
                          value={customSizeInput}
                          onChange={(e) => setCustomSizeInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSizeSlot(customSizeInput);
                            }
                          }}
                          placeholder="Custom (e.g. 75ml)"
                          className="flex-1 min-w-0 sm:w-32 px-3 py-2 sm:py-1.5 bg-white border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddSizeSlot(customSizeInput)}
                          disabled={!customSizeInput.trim()}
                          className="px-3.5 py-2 sm:py-1.5 rounded-full bg-[#0A0A0A] text-white text-xs font-medium disabled:opacity-40 whitespace-nowrap shrink-0"
                        >
                          Add Size
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* House Bottle Photo Picker + Live Preview */}
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wider">
                      Product Photograph (Select House Bottle or Paste Image URL)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <div className="w-24 h-24 rounded-2xl bg-white border border-[#E5E5E5] overflow-hidden shrink-0">
                        <ResilientImage
                          src={pImage}
                          alt={pName || 'Selected perfume preview'}
                          fallbackTitle={pName || 'Preview'}
                          className="w-full h-full object-cover saturate-[1.12] contrast-[1.03]"
                        />
                      </div>

                      <div className="flex-1 w-full space-y-2.5">
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                          {Object.entries(houseImages).map(([house, imgPath]) => {
                            const selected = pImage === imgPath;
                            return (
                              <button
                                key={house}
                                type="button"
                                onClick={() => setPImage(imgPath)}
                                title={house}
                                className={`aspect-square border rounded-xl overflow-hidden bg-white transition-all ${
                                  selected
                                    ? 'border-2 border-[#0A0A0A] ring-2 ring-[#FACC15]'
                                    : 'border-[#E5E5E5] opacity-75 hover:opacity-100'
                                }`}
                              >
                                <ResilientImage
                                  src={imgPath}
                                  alt={house}
                                  className="w-full h-full object-cover saturate-[1.12]"
                                />
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="text"
                          maxLength={500}
                          value={pImage}
                          onChange={(e) => setPImage(e.target.value)}
                          placeholder="/assets/images/... or https://..."
                          className="w-full px-3.5 py-2 border border-[#D4D4D4] rounded-xl text-xs font-mono focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description & Notes */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider">
                      Description (Optional — auto-generated if left blank)
                    </label>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={pDescription}
                      onChange={(e) => setPDescription(e.target.value)}
                      placeholder="Describe the scent profile, longevity, and occasion..."
                      className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl text-sm focus:outline-none focus:border-[#0A0A0A]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Top Notes (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={pTopNotes}
                        onChange={(e) => setPTopNotes(e.target.value)}
                        placeholder="Saffron, Bergamot"
                        className="w-full px-3 py-2 border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Heart Notes
                      </label>
                      <input
                        type="text"
                        value={pHeartNotes}
                        onChange={(e) => setPHeartNotes(e.target.value)}
                        placeholder="Rose, Praline"
                        className="w-full px-3 py-2 border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold uppercase tracking-wider">
                        Base Notes
                      </label>
                      <input
                        type="text"
                        value={pBaseNotes}
                        onChange={(e) => setPBaseNotes(e.target.value)}
                        placeholder="Oud, Vanilla, Musk"
                        className="w-full px-3 py-2 border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                  </div>

                  {/* Flags & Special Promotion */}
                  <div className="border-t border-[#E5E5E5] pt-4 space-y-4">
                    <div className="flex flex-wrap gap-6 text-xs font-medium">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pBestseller}
                          onChange={(e) => setPBestseller(e.target.checked)}
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <span>Show in Best Sellers</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pFeatured}
                          onChange={(e) => setPFeatured(e.target.checked)}
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <span>Featured Listing</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pUnboxed}
                          onChange={(e) => setPUnboxed(e.target.checked)}
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <Package className="w-3.5 h-3.5" />
                        <span>Unboxed Perfume (No Retail Box)</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="checkbox"
                          checked={pIsNewArrival}
                          onChange={(e) => setPIsNewArrival(e.target.checked)}
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Mark as New Arrival</span>
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
                        <input
                          type="checkbox"
                          checked={pOnSpecial}
                          onChange={(e) => setPOnSpecial(e.target.checked)}
                          className="accent-[#0A0A0A] w-4 h-4"
                        />
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Place on Special List</span>
                      </label>
                    </div>

                    {pOnSpecial && (
                      <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="block text-xs font-semibold uppercase tracking-wider">
                              Special Tag Label
                            </label>
                            <input
                              type="text"
                              maxLength={60}
                              value={pSpecialLabel}
                              onChange={(e) => setPSpecialLabel(e.target.value)}
                              placeholder="Black Friday Special"
                              className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <label className="block text-xs font-semibold uppercase tracking-wider">
                                {pSpecialDiscountType === 'fixed'
                                  ? 'Reduce Price By (E)'
                                  : 'Special Discount (%)'}
                              </label>
                              <div
                                className="inline-flex rounded-full border border-[#D4D4D4] bg-white p-0.5 text-[10px] font-bold"
                                role="group"
                                aria-label="Special discount type"
                              >
                                <button
                                  type="button"
                                  onClick={() => setPSpecialDiscountType('percentage')}
                                  className={`px-2.5 py-0.5 rounded-full transition-colors ${
                                    pSpecialDiscountType === 'percentage'
                                      ? 'bg-[#0A0A0A] text-white'
                                      : 'text-[#525252] hover:text-[#0A0A0A]'
                                  }`}
                                >
                                  % Off
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPSpecialDiscountType('fixed')}
                                  className={`px-2.5 py-0.5 rounded-full transition-colors ${
                                    pSpecialDiscountType === 'fixed'
                                      ? 'bg-[#0A0A0A] text-white'
                                      : 'text-[#525252] hover:text-[#0A0A0A]'
                                  }`}
                                >
                                  -E Amount
                                </button>
                              </div>
                            </div>
                            {pSpecialDiscountType === 'fixed' ? (
                              <div className="relative flex items-center">
                                <span className="absolute left-3 text-xs font-bold text-[#525252]">
                                  -E
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  max={50000}
                                  step="1"
                                  value={pSpecialDiscountAmount}
                                  onChange={(e) =>
                                    setPSpecialDiscountAmount(e.target.value)
                                  }
                                  placeholder="100"
                                  className="w-full pl-8 pr-3 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                                />
                              </div>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                max={90}
                                value={pSpecialDiscount}
                                onChange={(e) => setPSpecialDiscount(e.target.value)}
                                className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                              />
                            )}
                            {pSpecialDiscountType === 'fixed' && (
                              <p className="text-[11px] text-[#666666]">
                                Example: entering 100 reduces E550 to E450 on the highest full-bottle size.
                              </p>
                            )}
                          </div>
                        </div>

                        {editorSamplePrice && (
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5E5E5] text-xs">
                            <span className="text-[#525252]">
                              Storefront Display ({editorSamplePrice.size}):
                            </span>
                            <div className="flex items-center gap-2 tabular-nums">
                              {editorSamplePrice.saved > 0 && (
                                <span className="bg-[#FACC15] text-[#0A0A0A] px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                                  Save {formatPrice(editorSamplePrice.saved)}
                                </span>
                              )}
                              <span className="text-[#DC2626] font-bold">
                                {formatPrice(editorSamplePrice.effective)}
                              </span>
                              {editorSamplePrice.saved > 0 && (
                                <span className="text-[#737373] line-through">
                                  {formatPrice(editorSamplePrice.original)}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {formError && (
                    <div className="p-3.5 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium">
                      {formError}
                    </div>
                  )}

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 sm:gap-3 pt-3 border-t border-[#E5E5E5]">
                    <button
                      type="button"
                      onClick={() => setEditorOpen(false)}
                      className="w-full sm:w-auto px-5 py-3 border border-[#D4D4D4] rounded-full text-xs font-semibold uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingPerfume}
                      className="w-full sm:w-auto px-6 py-3 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 rounded-full text-xs font-semibold uppercase tracking-wider"
                    >
                      {savingPerfume
                        ? 'Saving...'
                        : editingPerfumeId
                        ? 'Update Perfume'
                        : 'Save Perfume'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* Owner Set / Update Password Modal */}
      <AnimatePresence>
        {passwordModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPasswordModalOpen(false)}
              className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
                transition={{ duration: 0.18 }}
                role="dialog"
                aria-modal="true"
                aria-label="Set Admin Password"
                className="pointer-events-auto w-full max-w-md bg-white border border-[#E5E5E5] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="px-4 py-3.5 sm:px-6 sm:py-4 bg-[#0A0A0A] text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-[#FACC15]" />
                    <h2 className="text-base font-bold">Set Admin Login Password</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPasswordModalOpen(false)}
                    aria-label="Close modal"
                    className="p-1.5 text-white/70 hover:text-white rounded-full"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveOwnerPassword} className="p-4 sm:p-6 space-y-4">
                  <p className="text-xs text-[#525252] leading-relaxed">
                    Set or update the manual login password for <strong className="text-[#0A0A0A]">{user?.email ?? 'your authorized admin email'}</strong> so you can sign in on any device.
                  </p>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="new-owner-password"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                    >
                      New Password (min 6 characters)
                    </label>
                    <div className="relative">
                      <input
                        id="new-owner-password"
                        type={showNewOwnerPassword ? 'text' : 'password'}
                        value={newOwnerPassword}
                        onChange={(e) => setNewOwnerPassword(e.target.value)}
                        placeholder="Enter password"
                        minLength={6}
                        required
                        className="w-full pl-3.5 pr-11 py-2.5 bg-[#F6F6F7] border border-[#D4D4D4] rounded-xl text-sm text-[#0A0A0A] focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewOwnerPassword((v) => !v)}
                        aria-label={showNewOwnerPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#525252] hover:text-[#0A0A0A]"
                      >
                        {showNewOwnerPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="confirm-owner-password"
                      className="block text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]"
                    >
                      Confirm Password
                    </label>
                    <input
                      id="confirm-owner-password"
                      type={showNewOwnerPassword ? 'text' : 'password'}
                      value={confirmOwnerPassword}
                      onChange={(e) => setConfirmOwnerPassword(e.target.value)}
                      placeholder="Re-enter password"
                      minLength={6}
                      required
                      className="w-full px-3.5 py-2.5 bg-[#F6F6F7] border border-[#D4D4D4] rounded-xl text-sm text-[#0A0A0A] focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
                    />
                  </div>

                  {passwordModalError && (
                    <div className="p-3 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium leading-relaxed">
                      {passwordModalError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2.5 pt-2 border-t border-[#E5E5E5]">
                    <button
                      type="button"
                      onClick={() => setPasswordModalOpen(false)}
                      className="px-4 py-2.5 border border-[#D4D4D4] rounded-full text-xs font-semibold uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingOwnerPassword}
                      className="px-5 py-2.5 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 rounded-full text-xs font-semibold uppercase tracking-wider"
                    >
                      {savingOwnerPassword ? 'Saving...' : 'Save Password'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
      <AdminOfflineIndicator />
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Edit3,
  Flame,
  Lock,
  LogOut,
  Package,
  Percent,
  Plus,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { formatPrice, siteConfig } from '../config/siteConfig';
import { PerfumeInput, useStore } from '../context/StoreContext';
import { featuredPerfumeHouses, houseImages } from '../data/catalogue';
import { OWNER_EMAIL } from '../lib/firebase';
import {
  AvailabilityStatus,
  BottleSize,
  Coupon,
  CouponDiscountType,
  CouponScope,
  FragranceCategory,
  FragranceProduct,
  STANDARD_BOTTLE_SIZES,
  SizeOption,
  SpecialCampaign,
} from '../types/fragrance';
import { getEffectiveUnitPrice, getProductPriceSummary } from '../utils/pricing';

interface AdminDashboardPageProps {
  onBackToStorefront: () => void;
  onNotify: (title: string, subtitle: string) => void;
}

type AdminTab = 'perfumes' | 'specials' | 'coupons';
type InventoryFilter = 'all' | 'Men' | 'Women' | 'Unisex' | 'specials' | 'low-stock';
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

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({
  onBackToStorefront,
  onNotify,
}) => {
  const {
    user,
    authReady,
    isOwner,
    signInOwnerWithGoogle,
    signOutOwner,
    livePerfumes,
    catalogueLoading,
    catalogueError,
    campaign,
    coupons,
    couponsLoading,
    savePerfume,
    deletePerfume,
    togglePerfumeSpecial,
    importStarterCatalogue,
    saveCoupon,
    toggleCouponActive,
    deleteCoupon,
    saveCampaign,
  } = useStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('perfumes');
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  // Live ticker for countdown preview
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Inventory filters & inline actions
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('all');
  const [inventorySort, setInventorySort] = useState<InventorySort>('name-asc');
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
  const [pDescription, setPDescription] = useState('');
  const [pImage, setPImage] = useState(houseImages[featuredPerfumeHouses[0]]);
  const [pTopNotes, setPTopNotes] = useState('');
  const [pHeartNotes, setPHeartNotes] = useState('');
  const [pBaseNotes, setPBaseNotes] = useState('');
  const [pSizes, setPSizes] = useState<SizeOption[]>(buildInitialSizes());
  const [customSizeInput, setCustomSizeInput] = useState('');
  const [pFeatured, setPFeatured] = useState(true);
  const [pBestseller, setPBestseller] = useState(false);
  const [pOnSpecial, setPOnSpecial] = useState(false);
  const [pSpecialLabel, setPSpecialLabel] = useState('Black Friday Special');
  const [pSpecialDiscount, setPSpecialDiscount] = useState('20');

  // Campaign state
  const [campaignDraft, setCampaignDraft] = useState<SpecialCampaign>(campaign);
  const [campaignSyncedOnce, setCampaignSyncedOnce] = useState(false);
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [applyingBulkSpecial, setApplyingBulkSpecial] = useState(false);
  const [bulkSpecialDiscount, setBulkSpecialDiscount] = useState('20');
  const [customDurationDays, setCustomDurationDays] = useState('7');
  const [specialPickerSearch, setSpecialPickerSearch] = useState('');
  const [discountEdits, setDiscountEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!campaignSyncedOnce) {
      setCampaignDraft(campaign);
      setCampaignSyncedOnce(true);
    }
  }, [campaign, campaignSyncedOnce]);

  useEffect(() => {
    setCampaignDraft(campaign);
  }, [campaign]);

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

  const specialPerfumes = useMemo(
    () => livePerfumes.filter((p) => Boolean(p.onSpecial)),
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
    const q = specialPickerSearch.trim().toLowerCase();
    return livePerfumes
      .filter((p) => !p.onSpecial)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
  }, [livePerfumes, specialPickerSearch]);

  const filteredLivePerfumes = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    const list = livePerfumes.filter((p) => {
      if (inventoryFilter === 'Men' && p.category !== 'Men') return false;
      if (inventoryFilter === 'Women' && p.category !== 'Women') return false;
      if (inventoryFilter === 'Unisex' && p.category !== 'Unisex') return false;
      if (inventoryFilter === 'specials' && !p.onSpecial) return false;
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
        p.availability.toLowerCase().includes(q)
      );
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (inventorySort === 'brand-asc') {
        return a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name);
      }
      if (inventorySort === 'price-desc' || inventorySort === 'price-asc') {
        const pa = getProductPriceSummary(a).highestEffective ?? 0;
        const pb = getProductPriceSummary(b).highestEffective ?? 0;
        return inventorySort === 'price-desc' ? pb - pa : pa - pb;
      }
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [livePerfumes, inventorySearch, inventoryFilter, inventorySort]);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setSigningIn(true);
    try {
      await signInOwnerWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Unable to complete Google sign-in.'
      );
    } finally {
      setSigningIn(false);
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
    setPDescription('');
    setPImage(houseImages[featuredPerfumeHouses[0]]);
    setPTopNotes('');
    setPHeartNotes('');
    setPBaseNotes('');
    setPSizes(buildInitialSizes());
    setCustomSizeInput('');
    setPFeatured(false);
    setPBestseller(false);
    setPOnSpecial(false);
    setPSpecialLabel(campaign.badgeText || 'Black Friday Special');
    setPSpecialDiscount('20');
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
    setPDescription(p.description);
    setPImage(p.image);
    setPTopNotes(p.notes.top.join(', '));
    setPHeartNotes(p.notes.heart.join(', '));
    setPBaseNotes(p.notes.base.join(', '));
    setPSizes(buildInitialSizes(p.sizes));
    setCustomSizeInput('');
    setPFeatured(p.featured);
    setPBestseller(p.bestseller);
    setPOnSpecial(Boolean(p.onSpecial));
    setPSpecialLabel(p.specialLabel || campaign.badgeText || 'Black Friday Special');
    setPSpecialDiscount(String(p.specialDiscountPercent ?? 0));
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
    setPDescription(p.description);
    setPImage(p.image);
    setPTopNotes(p.notes.top.join(', '));
    setPHeartNotes(p.notes.heart.join(', '));
    setPBaseNotes(p.notes.base.join(', '));
    setPSizes(buildInitialSizes(p.sizes));
    setCustomSizeInput('');
    setPFeatured(p.featured);
    setPBestseller(false);
    setPOnSpecial(Boolean(p.onSpecial));
    setPSpecialLabel(p.specialLabel || campaign.badgeText || 'Black Friday Special');
    setPSpecialDiscount(String(p.specialDiscountPercent ?? 0));
    setEditorOpen(true);
  };

  const handleQuickAvailabilityChange = async (
    product: FragranceProduct,
    nextAvailability: AvailabilityStatus
  ) => {
    if (product.availability === nextAvailability) return;
    setUpdatingStatusId(product.id);
    try {
      await savePerfume(
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
          featured: product.featured,
          bestseller: product.bestseller,
          onSpecial: product.onSpecial,
          specialLabel: product.specialLabel,
          specialDiscountPercent: product.specialDiscountPercent,
        },
        product.id
      );
      onNotify('Availability Updated', `${product.name} marked as ${nextAvailability}.`);
    } catch (err) {
      onNotify(
        'Status Update Failed',
        extractReadableError(err, 'Could not update availability.')
      );
    } finally {
      setUpdatingStatusId(null);
    }
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

    const payload: PerfumeInput = {
      name: pName.trim(),
      brand: resolvedBrand,
      category: pCategory,
      concentration: pConcentration.trim() || 'Eau de Parfum',
      availability: pAvailability,
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
      onSpecial: pOnSpecial,
      specialLabel: pOnSpecial ? pSpecialLabel.trim() : '',
      specialDiscountPercent: pOnSpecial ? safeDiscount : 0,
    };

    setSavingPerfume(true);
    try {
      await savePerfume(payload, editingPerfumeId ?? undefined);
      setEditorOpen(false);
      onNotify(
        editingPerfumeId ? 'Perfume Updated' : 'Perfume Added',
        `${payload.name} (${payload.brand}) saved to your live catalogue.`
      );
    } catch (err) {
      setFormError(extractReadableError(err, 'Could not save perfume.'));
    } finally {
      setSavingPerfume(false);
    }
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

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCampaign(true);
    try {
      await saveCampaign(campaignDraft);
      onNotify(
        campaignDraft.enabled ? 'Special Campaign Live' : 'Special Campaign Paused',
        `${campaignDraft.title} settings synced to storefront.`
      );
    } catch (err) {
      onNotify(
        'Campaign Save Error',
        extractReadableError(err, 'Could not save campaign.')
      );
    } finally {
      setSavingCampaign(false);
    }
  };

  const handleApplyBulkSpecialDiscount = async () => {
    const pct = Math.min(90, Math.max(0, Number(bulkSpecialDiscount || 0)));
    setApplyingBulkSpecial(true);
    try {
      await Promise.all(
        specialPerfumes.map((item) =>
          togglePerfumeSpecial(
            item,
            true,
            pct,
            campaignDraft.badgeText || item.specialLabel || 'Black Friday Special'
          )
        )
      );
      setDiscountEdits({});
      onNotify(
        'Specials Updated',
        `Applied -${pct}% across ${specialPerfumes.length} special perfume(s).`
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

  const handleCommitSingleSpecialDiscount = async (
    product: FragranceProduct,
    rawPercent: string | number
  ) => {
    const clamped = Math.min(90, Math.max(0, Number(rawPercent || 0)));
    if (clamped === (product.specialDiscountPercent ?? 0) && product.onSpecial) {
      setDiscountEdits((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      return;
    }
    try {
      await togglePerfumeSpecial(
        product,
        true,
        clamped,
        product.specialLabel || campaignDraft.badgeText || 'Special Offer'
      );
      setDiscountEdits((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      onNotify('Discount Saved', `${product.name} updated to -${clamped}% off.`);
    } catch (err) {
      onNotify(
        'Discount Save Error',
        extractReadableError(err, 'Could not update discount.')
      );
    }
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

  const previewHeadline = splitHeroHeadline(campaignDraft.title);
  const previewCountdown = getCountdownParts(campaignDraft.endsAt, nowMs);

  // Live highest priced sample in modal for instant Special preview
  const editorSamplePrice = useMemo(() => {
    const priced = pSizes
      .filter((s) => s.available && typeof s.price === 'number' && s.price > 0)
      .map((s) => ({ size: s.size, price: s.price as number }));
    if (priced.length === 0) return null;
    priced.sort((a, b) => b.price - a.price);
    const highest = priced[0];
    const pct = Math.min(90, Math.max(0, Number(pSpecialDiscount || 0)));
    const effective = Math.round(highest.price * (1 - pct / 100));
    return {
      size: highest.size,
      original: highest.price,
      effective,
      saved: Math.max(0, highest.price - effective),
    };
  }, [pSizes, pSpecialDiscount]);

  return (
    <div className="min-h-screen bg-[#F6F6F7] text-[#0A0A0A] flex flex-col">
      {/* Separate Admin Portal Top Bar */}
      <header className="sticky top-0 z-40 bg-[#0A0A0A] text-white border-b border-white/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={onBackToStorefront}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/20 hover:border-white text-xs font-medium text-white/85 hover:text-white transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View Storefront</span>
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-black">
                <img
                  src="/assets/aistudio/aurahut_logo_a0bd1434.jpg"
                  alt={siteConfig.brandName}
                  className="w-full h-full object-contain scale-[1.7] mix-blend-screen"
                />
              </div>
              <span className="text-base sm:text-lg font-bold tracking-[0.12em] truncate">
                {siteConfig.brandName}
              </span>
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] bg-[#FACC15] text-[#0A0A0A] rounded-full shrink-0">
                Owner Console
              </span>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden md:inline text-xs text-white/70 truncate max-w-[220px]">
                {user.email}
              </span>
              <button
                type="button"
                onClick={signOutOwner}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-white/30 hover:border-white text-xs font-medium text-white rounded-full transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {!authReady ? (
          <div className="max-w-md mx-auto bg-white border border-[#E5E5E5] rounded-3xl p-10 text-center space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
              Verifying Owner Session
            </p>
            <p className="text-2xl font-bold text-[#0A0A0A]">
              Loading AuraHut Co. Console...
            </p>
          </div>
        ) : !user ? (
          /* Gate 1: Sign In Required */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto bg-white border border-[#E5E5E5] rounded-3xl p-8 sm:p-10 space-y-6 shadow-sm"
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
              <h1 className="text-3xl font-bold text-[#0A0A0A] tracking-tight">
                Owner Admin Dashboard
              </h1>
              <p className="text-sm text-[#525252] leading-relaxed">
                Sign in with the verified store owner Google account to manage fragrances, bottle prices, seasonal specials countdown timers, and social stream coupon codes.
              </p>
            </div>

            {authError && (
              <div className="p-3.5 bg-[#FEE2E2] border border-[#DC2626] rounded-xl text-xs text-[#991B1B] font-medium">
                {authError}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={signingIn}
                onClick={handleGoogleSignIn}
                className="w-full py-3.5 px-5 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 transition-colors rounded-full text-xs font-semibold uppercase tracking-[0.14em]"
              >
                {signingIn ? 'Opening Google Sign-In...' : 'Sign In with Google (Owner)'}
              </button>
              <button
                type="button"
                onClick={onBackToStorefront}
                className="w-full py-3 px-5 border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors rounded-full text-xs font-semibold uppercase tracking-wider"
              >
                Return to Customer Storefront
              </button>
            </div>

            <p className="text-[11px] text-[#737373] border-t border-[#E5E5E5] pt-4">
              Authorized Owner Account: <span className="font-semibold text-[#0A0A0A]">{OWNER_EMAIL}</span>
            </p>
          </motion.div>
        ) : !isOwner ? (
          /* Gate 2: Authenticated Non-Owner Denied */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto bg-white border border-[#0A0A0A] rounded-3xl p-8 sm:p-10 space-y-6"
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
                Signed in as <strong className="text-[#0A0A0A]">{user.email}</strong>. Only the verified AuraHut Co. owner account ({OWNER_EMAIL}) has permission to edit catalogue pricing, coupon codes, or special promotions.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleGoogleSignIn}
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
        ) : (
          /* Authenticated Owner Workspace */
          <div className="space-y-8">
            {/* Overview Header & Interactive KPIs */}
            <div className="space-y-6 border-b border-[#E5E5E5] pb-8">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#525252]">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Real-Time Storefront Sync</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-bold text-[#0A0A0A] tracking-tight">
                    Store Control Center
                  </h1>
                  <p className="text-sm text-[#525252]">
                    Manage bottle inventory, seasonal countdown specials, and private social-stream coupon codes.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('specials');
                    }}
                    className="px-4 py-2.5 rounded-full border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Set Specials Timer</span>
                  </button>
                  <button
                    type="button"
                    onClick={openCreatePerfume}
                    className="px-5 py-2.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Perfume</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('perfumes');
                    setInventoryFilter('all');
                  }}
                  className="text-left bg-white border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-2xl p-4 transition-colors"
                >
                  <span className="block text-[11px] uppercase tracking-wider text-[#737373] font-medium">
                    Live Perfumes
                  </span>
                  <span className="mt-1 block text-2xl sm:text-3xl font-bold text-[#0A0A0A] tabular-nums">
                    {livePerfumes.length}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#525252]">
                    Published SKUs in Firestore
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('specials')}
                  className="text-left bg-white border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-2xl p-4 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="block text-[11px] uppercase tracking-wider text-[#737373] font-medium">
                      On Special
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        campaign.enabled
                          ? 'bg-[#FACC15] text-[#0A0A0A]'
                          : 'bg-[#F4F4F5] text-[#525252]'
                      }`}
                    >
                      {campaign.enabled ? 'Live' : 'Paused'}
                    </span>
                  </div>
                  <span className="mt-1 block text-2xl sm:text-3xl font-bold text-[#0A0A0A] tabular-nums">
                    {specialPerfumes.length}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#525252] truncate">
                    {previewCountdown.hasTimer && !previewCountdown.ended
                      ? `${previewCountdown.days}d ${previewCountdown.hours}h remaining`
                      : 'Configure specials & timer'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('perfumes');
                    setInventoryFilter('low-stock');
                  }}
                  className={`text-left bg-white border rounded-2xl p-4 transition-colors ${
                    stockAlertPerfumes.length > 0
                      ? 'border-[#FCA5A5] hover:border-[#DC2626]'
                      : 'border-[#E5E5E5] hover:border-[#0A0A0A]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="block text-[11px] uppercase tracking-wider text-[#737373] font-medium">
                      Stock Alerts
                    </span>
                    {stockAlertPerfumes.length > 0 && (
                      <AlertTriangle className="w-3.5 h-3.5 text-[#DC2626]" />
                    )}
                  </div>
                  <span
                    className={`mt-1 block text-2xl sm:text-3xl font-bold tabular-nums ${
                      stockAlertPerfumes.length > 0 ? 'text-[#DC2626]' : 'text-[#0A0A0A]'
                    }`}
                  >
                    {stockAlertPerfumes.length}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#525252]">
                    Low stock or out of stock
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('coupons')}
                  className="text-left bg-white border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-2xl p-4 transition-colors"
                >
                  <span className="block text-[11px] uppercase tracking-wider text-[#737373] font-medium">
                    Active Coupons
                  </span>
                  <span className="mt-1 block text-2xl sm:text-3xl font-bold text-[#0A0A0A] tabular-nums">
                    {coupons.filter((c) => c.active).length}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#525252]">
                    {coupons.length} total social codes
                  </span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'perfumes', label: 'Perfumes & Pricing', icon: Package },
                  { id: 'specials', label: 'Specials & Countdown', icon: Flame },
                  { id: 'coupons', label: 'Social Coupon Codes', icon: Tag },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-5 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors inline-flex items-center gap-2 ${
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
                    <Icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: PERFUMES CRUD */}
            {activeTab === 'perfumes' && (
              <div className="space-y-5">
                {/* Action & Filter Toolbar */}
                <div className="bg-white border border-[#E5E5E5] rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={inventorySearch}
                        onChange={(e) => setInventorySearch(e.target.value)}
                        placeholder="Search perfumes by name, house, category, or stock..."
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

                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                      <select
                        value={inventorySort}
                        onChange={(e) => setInventorySort(e.target.value as InventorySort)}
                        aria-label="Sort inventory"
                        className="px-3.5 py-2.5 bg-white border border-[#D4D4D4] rounded-xl text-xs font-medium text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
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
                          className="px-4 py-2.5 border border-[#0A0A0A] bg-white text-[#0A0A0A] hover:bg-[#F5F5F5] rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2"
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
                        className="px-5 py-2.5 bg-[#0A0A0A] text-white hover:bg-[#262626] rounded-full text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add New Perfume</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Chips */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#F0F0F0]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { id: 'all', label: `All (${livePerfumes.length})` },
                          { id: 'Men', label: 'Men' },
                          { id: 'Women', label: 'Women' },
                          { id: 'Unisex', label: 'Unisex' },
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
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
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

                    <span className="text-xs text-[#737373] tabular-nums">
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
                  <div className="bg-white border border-[#E5E5E5] rounded-3xl p-10 text-center space-y-4">
                    <h2 className="text-2xl font-bold text-[#0A0A0A]">
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
                  <div className="bg-white border border-[#E5E5E5] rounded-3xl p-10 text-center space-y-3">
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
                    {filteredLivePerfumes.map((product) => (
                      <div
                        key={product.id}
                        className="bg-white border border-[#E5E5E5] hover:border-[#0A0A0A]/40 rounded-2xl p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-colors"
                      >
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="w-20 h-20 bg-white border border-[#F0F0F0] rounded-xl shrink-0 overflow-hidden">
                            <ResilientImage
                              src={product.image}
                              alt={product.name}
                              fallbackTitle={product.name}
                              className="w-full h-full object-cover saturate-[1.12] contrast-[1.03]"
                            />
                          </div>
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-[#525252]">
                              <span className="font-bold text-[#0A0A0A]">
                                {product.brand}
                              </span>
                              <span>·</span>
                              <span>{product.category}</span>
                              {product.bestseller && (
                                <span className="px-2 py-0.5 rounded-full bg-[#F4F4F5] text-[#0A0A0A] text-[10px] font-semibold">
                                  Best Seller
                                </span>
                              )}
                              {product.onSpecial && (
                                <span className="px-2.5 py-0.5 bg-[#FACC15] text-[#0A0A0A] rounded-full text-[10px] font-bold">
                                  {product.specialLabel || 'SPECIAL'}
                                  {product.specialDiscountPercent
                                    ? ` · -${product.specialDiscountPercent}%`
                                    : ''}
                                </span>
                              )}
                            </div>

                            <h3 className="text-lg sm:text-xl font-bold text-[#0A0A0A] truncate">
                              {product.name}
                            </h3>

                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {product.sizes.map((s) => {
                                const eff = getEffectiveUnitPrice(
                                  s.price,
                                  product.onSpecial,
                                  product.specialDiscountPercent
                                );
                                const discounted =
                                  s.available &&
                                  Boolean(product.onSpecial) &&
                                  (product.specialDiscountPercent ?? 0) > 0 &&
                                  eff !== null &&
                                  s.price !== null &&
                                  eff < s.price;
                                return (
                                  <span
                                    key={s.size}
                                    className={`px-2.5 py-1 text-[11px] border rounded-lg tabular-nums ${
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

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                            className={`px-3 py-2 text-xs font-semibold border rounded-full cursor-pointer focus:outline-none ${getAvailabilityBadgeClass(
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
                            onClick={async () => {
                              try {
                                await togglePerfumeSpecial(
                                  product,
                                  !product.onSpecial,
                                  product.specialDiscountPercent || Number(bulkSpecialDiscount) || 20,
                                  campaign.badgeText || 'Black Friday Special'
                                );
                                onNotify(
                                  !product.onSpecial ? 'Added to Specials' : 'Removed from Specials',
                                  `${product.name} updated.`
                                );
                              } catch (err) {
                                onNotify(
                                  'Special Toggle Failed',
                                  extractReadableError(err, 'Could not update special status.')
                                );
                              }
                            }}
                            className={`px-3.5 py-2 text-xs font-semibold border rounded-full transition-colors inline-flex items-center gap-1.5 ${
                              product.onSpecial
                                ? 'bg-[#FACC15] text-[#0A0A0A] border-[#FACC15]'
                                : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                            }`}
                          >
                            <Flame className="w-3.5 h-3.5" />
                            <span>{product.onSpecial ? 'On Special' : 'Add Special'}</span>
                          </button>

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
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: SPECIALS & COUNTDOWN */}
            {activeTab === 'specials' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Campaign Banner & Timer Configurator */}
                <div className="lg:col-span-5 space-y-6">
                  {/* Live Storefront Hero Preview */}
                  <div className="relative overflow-hidden rounded-3xl bg-[#0A0A0A] text-white p-6 space-y-4 border border-white/10">
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
                        {campaignDraft.enabled ? 'Visible on Home' : 'Default Mode'}
                      </span>
                    </div>

                    <div className="relative z-10 space-y-3">
                      <h3 className="text-2xl font-bold italic leading-tight tracking-tight">
                        <span className="text-white block">{previewHeadline[0]}</span>
                        <span className="text-[#FACC15] block">{previewHeadline[1]}</span>
                      </h3>

                      <div className="flex items-center gap-2">
                        {[
                          { label: 'Days', val: previewCountdown.days },
                          { label: 'Hours', val: previewCountdown.hours },
                          { label: 'Mins', val: previewCountdown.minutes },
                          { label: 'Secs', val: previewCountdown.seconds },
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
                    </div>
                  </div>

                  <form
                    onSubmit={handleSaveCampaign}
                    className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 space-y-5"
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-[#E5E5E5] pb-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                          Promotional Event
                        </p>
                        <h2 className="text-2xl font-bold text-[#0A0A0A]">
                          Specials &amp; Duration
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

                      <p className="text-[11px] text-[#525252] leading-relaxed">
                        {formatRemainingSummary(campaignDraft.endsAt, nowMs)}
                      </p>
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
                      <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E5E5] pb-4">
                          <div>
                            <h3 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                              Perfumes on Special ({specialPerfumes.length})
                            </h3>
                            <p className="text-xs text-[#666666]">
                              These fragrances appear in the hero showcase &amp; Specials view.
                            </p>
                          </div>
                          {specialPerfumes.length > 0 && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                max={90}
                                value={bulkSpecialDiscount}
                                onChange={(e) => setBulkSpecialDiscount(e.target.value)}
                                className="w-16 px-2 py-1.5 border border-[#D4D4D4] rounded-xl text-xs text-center tabular-nums"
                                aria-label="Bulk special discount percentage"
                              />
                              <button
                                type="button"
                                disabled={applyingBulkSpecial}
                                onClick={handleApplyBulkSpecialDiscount}
                                className="px-3.5 py-1.5 bg-[#0A0A0A] text-white disabled:opacity-50 rounded-full text-xs font-semibold whitespace-nowrap"
                              >
                                {applyingBulkSpecial ? 'Applying...' : 'Apply % to All'}
                              </button>
                            </div>
                          )}
                        </div>

                        {specialPerfumes.length === 0 ? (
                          <p className="text-sm text-[#525252] py-4">
                            No perfumes are marked on special yet. Select perfumes below to add them to your Specials list.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {specialPerfumes.map((p) => {
                              const draftValue =
                                discountEdits[p.id] ?? String(p.specialDiscountPercent ?? 0);
                              const previewSummary = getProductPriceSummary({
                                ...p,
                                onSpecial: true,
                                specialDiscountPercent: Math.min(
                                  90,
                                  Math.max(0, Number(draftValue || 0))
                                ),
                              });
                              const isDirty =
                                discountEdits[p.id] !== undefined &&
                                Number(discountEdits[p.id]) !== (p.specialDiscountPercent ?? 0);

                              return (
                                <div
                                  key={p.id}
                                  className="p-3.5 bg-[#F7F7F8] border border-[#E5E5E5] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-14 h-14 bg-white border border-[#F0F0F0] rounded-xl shrink-0 overflow-hidden">
                                      <ResilientImage
                                        src={p.image}
                                        alt={p.name}
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
                                      {previewSummary.highestEffective !== null && (
                                        <p className="text-xs tabular-nums">
                                          <span className="text-[#DC2626] font-bold">
                                            {formatPrice(previewSummary.highestEffective)}
                                          </span>
                                          {previewSummary.highestOriginal !== null &&
                                            previewSummary.highestOriginal >
                                              previewSummary.highestEffective && (
                                              <span className="ml-1.5 text-[#737373] line-through">
                                                {formatPrice(previewSummary.highestOriginal)}
                                              </span>
                                            )}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min={0}
                                        max={90}
                                        value={draftValue}
                                        onChange={(e) =>
                                          setDiscountEdits((prev) => ({
                                            ...prev,
                                            [p.id]: e.target.value,
                                          }))
                                        }
                                        onBlur={() =>
                                          handleCommitSingleSpecialDiscount(p, draftValue)
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleCommitSingleSpecialDiscount(p, draftValue);
                                          }
                                        }}
                                        aria-label={`Discount percent for ${p.name}`}
                                        className="w-16 px-2 py-1.5 bg-white border border-[#D4D4D4] rounded-lg text-xs font-bold text-center tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                                      />
                                      <span className="text-xs text-[#525252] font-medium">%</span>
                                      {isDirty && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleCommitSingleSpecialDiscount(p, draftValue)
                                          }
                                          className="px-2.5 py-1.5 bg-[#FACC15] text-[#0A0A0A] rounded-full text-[11px] font-bold"
                                        >
                                          Save
                                        </button>
                                      )}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await togglePerfumeSpecial(p, false, 0, '');
                                          onNotify('Removed', `${p.name} removed from specials.`);
                                        } catch (err) {
                                          onNotify(
                                            'Update Failed',
                                            extractReadableError(err, 'Could not remove from specials.')
                                          );
                                        }
                                      }}
                                      className="px-3.5 py-1.5 border border-[#D4D4D4] bg-white hover:border-[#0A0A0A] rounded-full text-xs font-medium"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Add More to Specials */}
                      <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 space-y-4">
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {nonSpecialPerfumes.map((p) => (
                              <div
                                key={p.id}
                                className="p-3 border border-[#E5E5E5] rounded-2xl flex items-center justify-between gap-3 hover:border-[#0A0A0A]/40 transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-10 h-10 bg-white border border-[#F0F0F0] rounded-lg shrink-0 overflow-hidden">
                                    <ResilientImage
                                      src={p.image}
                                      alt={p.name}
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
                                  onClick={async () => {
                                    try {
                                      await togglePerfumeSpecial(
                                        p,
                                        true,
                                        Number(bulkSpecialDiscount) || 20,
                                        campaignDraft.badgeText || 'Black Friday Special'
                                      );
                                      onNotify('Added to Specials', `${p.name} is now on special.`);
                                    } catch (err) {
                                      onNotify(
                                        'Special Failed',
                                        extractReadableError(err, 'Could not add special.')
                                      );
                                    }
                                  }}
                                  className="px-3.5 py-1.5 bg-[#0A0A0A] text-white rounded-full text-xs font-semibold shrink-0 hover:bg-[#262626]"
                                >
                                  + Special
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: COUPON CODES */}
            {activeTab === 'coupons' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Create / Edit Coupon Form */}
                <form
                  onSubmit={handleSaveCoupon}
                  className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 space-y-5"
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

                  <div className="grid grid-cols-2 gap-4">
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

                  <div className="grid grid-cols-2 gap-4">
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
                <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 space-y-5">
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                transition={{ duration: 0.2 }}
                role="dialog"
                aria-modal="true"
                aria-label={editingPerfumeId ? 'Edit Perfume' : 'Add New Perfume'}
                className="pointer-events-auto w-full max-w-3xl bg-white border border-[#E5E5E5] rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
              >
                <div className="px-6 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[#666666] font-medium">
                      Catalogue Editor
                    </p>
                    <h2 className="text-2xl font-bold text-[#0A0A0A]">
                      {editingPerfumeId ? 'Update Perfume & Pricing' : 'Add New Perfume'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    aria-label="Close editor"
                    className="p-2 rounded-full text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form
                  noValidate
                  onSubmit={handleSavePerfume}
                  className="p-6 overflow-y-auto space-y-6"
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
                        onChange={(e) =>
                          setPAvailability(e.target.value as AvailabilityStatus)
                        }
                        className="w-full px-3.5 py-2.5 border border-[#D4D4D4] rounded-xl bg-white text-sm focus:outline-none focus:border-[#0A0A0A]"
                      >
                        <option value="In Stock">In Stock</option>
                        <option value="Low Stock">Low Stock</option>
                        <option value="Out of Stock">Out of Stock</option>
                        <option value="Pre-Order">Pre-Order</option>
                      </select>
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

                      <div className="flex items-center gap-1.5 shrink-0">
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
                          className="w-32 px-3 py-1.5 bg-white border border-[#D4D4D4] rounded-xl text-xs focus:outline-none focus:border-[#0A0A0A]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddSizeSlot(customSizeInput)}
                          disabled={!customSizeInput.trim()}
                          className="px-3 py-1.5 rounded-full bg-[#0A0A0A] text-white text-xs font-medium disabled:opacity-40 whitespace-nowrap"
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
                            <label className="block text-xs font-semibold uppercase tracking-wider">
                              Special Discount (%)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={90}
                              value={pSpecialDiscount}
                              onChange={(e) => setPSpecialDiscount(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                            />
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

                  <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E5E5]">
                    <button
                      type="button"
                      onClick={() => setEditorOpen(false)}
                      className="px-5 py-3 border border-[#D4D4D4] rounded-full text-xs font-semibold uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingPerfume}
                      className="px-6 py-3 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 rounded-full text-xs font-semibold uppercase tracking-wider"
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
    </div>
  );
};

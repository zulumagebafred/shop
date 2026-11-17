import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Layers,
  Lock,
  LogOut,
  MailCheck,
  Package,
  Percent,
  Plus,
  RefreshCw,
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
import { PerfumeInput, resolveAdminLoginEmail, useStore } from '../context/StoreContext';
import { featuredPerfumeHouses, houseImages } from '../data/catalogue';
import { OWNER_EMAIL } from '../lib/firebase';
import {
  AvailabilityStatus,
  BottleSize,
  ComboDeal,
  Coupon,
  CouponDiscountType,
  CouponScope,
  FragranceCategory,
  FragranceProduct,
  LayeringIdea,
  STANDARD_BOTTLE_SIZES,
  SizeOption,
  SpecialCampaign,
} from '../types/fragrance';
import { getEffectiveUnitPrice, getProductPriceSummary } from '../utils/pricing';

interface AdminDashboardPageProps {
  onBackToStorefront: () => void;
  onNotify: (title: string, subtitle: string) => void;
}

type AdminTab = 'perfumes' | 'specials' | 'combos' | 'coupons';
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
    signInOwnerWithPassword,
    sendOwnerPasswordReset,
    resendOwnerVerificationEmail,
    refreshAuthUser,
    setOwnerPasswordCredential,
    signOutOwner,
    perfumes,
    livePerfumes,
    catalogueLoading,
    catalogueError,
    campaign,
    coupons,
    couponsLoading,
    liveCombos,
    combosLoading,
    liveLayeringIdeas,
    layeringLoading,
    savePerfume,
    deletePerfume,
    togglePerfumeSpecial,
    importStarterCatalogue,
    saveCoupon,
    toggleCouponActive,
    deleteCoupon,
    saveCampaign,
    saveComboDeal,
    deleteComboDeal,
    saveLayeringIdea,
    deleteLayeringIdea,
    importStarterCombosAndLayering,
  } = useStore();

  const [activeTab, setActiveTab] = useState<AdminTab>('perfumes');
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

  useEffect(() => {
    setInventoryVisibleCount(40);
  }, [inventorySearch, inventoryFilter, inventorySort]);

  const visibleLivePerfumes = useMemo(
    () => filteredLivePerfumes.slice(0, inventoryVisibleCount),
    [filteredLivePerfumes, inventoryVisibleCount]
  );

  const mapFirebaseAuthError = (err: unknown, fallback: string): string => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('auth/operation-not-allowed')) {
      return 'Email/Password sign-in is disabled in Firebase Console. Enable it under Authentication → Sign-in method → Email/Password, then click "Reset / Set Password" to choose your password for zulumageba.';
    }
    if (
      msg.includes('auth/invalid-credential') ||
      msg.includes('auth/wrong-password') ||
      msg.includes('auth/user-not-found')
    ) {
      return 'Incorrect login or password. If you have not set a password for zulumageba yet, click "Reset / Set Password" to create one via email, or sign in with Google and click "Password" at the top.';
    }
    if (msg.includes('auth/popup-blocked') || msg.includes('auth/popup-closed-by-user')) {
      return 'Google popup was blocked or closed. Use the zulumageba + password form above instead (works on any device without popups).';
    }
    if (msg.includes('auth/too-many-requests')) {
      return 'Too many sign-in attempts. Please wait a few minutes or sign in with Google below.';
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
      setAuthError('Enter your admin login (zulumageba).');
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
    const targetLogin = loginId.trim() || 'zulumageba';
    setSendingReset(true);
    try {
      const sentEmail = await sendOwnerPasswordReset(targetLogin);
      setAuthNotice(
        `Password setup/reset email sent to ${sentEmail}. Open the link in your email to set your password, then log in with "zulumageba" on any device.`
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
        `Verification link sent to ${user?.email ?? OWNER_EMAIL}. Click the link in your email, then tap "I've Verified — Refresh".`
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
        'You can now log in manually from any device using "zulumageba" and this password.'
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
            product.specialDiscountPercent
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
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className="hidden md:inline text-xs text-white/70 truncate max-w-[220px]">
                {user.email}
              </span>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalError(null);
                    setNewOwnerPassword('');
                    setConfirmOwnerPassword('');
                    setPasswordModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-white/25 hover:border-[#FACC15] hover:text-[#FACC15] text-xs font-medium text-white rounded-full transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Password</span>
                </button>
              )}
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
            className="max-w-lg mx-auto bg-white border border-[#E5E5E5] rounded-3xl p-7 sm:p-10 space-y-6 shadow-sm"
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
                Owner Admin Login
              </h1>
              <p className="text-sm text-[#525252] leading-relaxed">
                Enter your owner login (<span className="font-semibold text-[#0A0A0A]">zulumageba</span>) and password to sign in on any device, or continue with Google.
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
                  Login / Username
                </label>
                <input
                  id="admin-login-id"
                  type="text"
                  autoComplete="username"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  placeholder="zulumageba"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F6F6F7] border border-[#D4D4D4] rounded-xl text-sm text-[#0A0A0A] placeholder:text-[#737373] focus:outline-none focus:bg-white focus:border-[#0A0A0A]"
                />
                {loginId.trim().length > 0 && !loginId.includes('@') && (
                  <p className="text-[11px] text-[#666666]">
                    Signing in as <span className="font-medium text-[#0A0A0A]">{resolveAdminLoginEmail(loginId)}</span>
                  </p>
                )}
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
                disabled={signingInPassword || signingIn}
                className="w-full py-3.5 px-5 bg-[#0A0A0A] text-white hover:bg-[#262626] disabled:opacity-50 transition-colors rounded-full text-xs font-semibold uppercase tracking-[0.14em]"
              >
                {signingInPassword ? 'Signing In...' : 'Sign In'}
              </button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-1 border-t border-[#E5E5E5]" />
              <span className="px-3 text-[11px] uppercase tracking-wider text-[#737373]">
                or
              </span>
              <div className="flex-1 border-t border-[#E5E5E5]" />
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={signingIn || signingInPassword}
                onClick={handleGoogleSignIn}
                className="w-full py-3 px-5 border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#F5F5F5] disabled:opacity-50 transition-colors rounded-full text-xs font-semibold uppercase tracking-[0.12em]"
              >
                {signingIn ? 'Opening Google Sign-In...' : 'Sign In with Google (Owner)'}
              </button>
              <button
                type="button"
                onClick={onBackToStorefront}
                className="w-full py-3 px-5 border border-[#D4D4D4] text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors rounded-full text-xs font-semibold uppercase tracking-wider"
              >
                Return to Customer Storefront
              </button>
            </div>

            <p className="text-[11px] text-[#737373] border-t border-[#E5E5E5] pt-4">
              Authorized Owner Account: <span className="font-semibold text-[#0A0A0A]">{OWNER_EMAIL}</span>
            </p>
          </motion.div>
        ) : !isOwner ? (
          /* Gate 2: Email Verification Needed or Non-Owner Denied */
          user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase() && !user.emailVerified ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-lg mx-auto bg-white border border-[#0A0A0A] rounded-3xl p-8 sm:p-10 space-y-6"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0A0A0A] text-[#FACC15] flex items-center justify-center">
                <MailCheck className="w-5 h-5" />
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[#DC2626] font-semibold">
                  Verification Required
                </p>
                <h1 className="text-3xl font-bold text-[#0A0A0A] tracking-tight">
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
                  { id: 'combos', label: 'Combos & Layering', icon: Layers },
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
                    {visibleLivePerfumes.map((product, idx) => (
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
                              loading={idx < 8 ? 'eager' : 'lazy'}
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
                              {product.sizes.map((s, sizeIdx) => {
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
                                    key={`${product.id}-${s.size}-${sizeIdx}`}
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

            {/* TAB 4: COMBOS & LAYERING IDEAS */}
            {activeTab === 'combos' && (
              <div className="space-y-8">
                <div className="bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#0A0A0A]">
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
                      className="px-5 py-2.5 rounded-full border border-[#0A0A0A] bg-white hover:bg-[#0A0A0A] hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 shrink-0"
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <form
                    onSubmit={handleSaveComboSubmit}
                    className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 space-y-4"
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
                              className="p-2 bg-white border border-[#E5E5E5] rounded-xl flex items-center justify-between gap-2"
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
                                          item.specialDiscountPercent
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

                    <div className="grid grid-cols-2 gap-3">
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

                    <div className="grid grid-cols-2 gap-3">
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
                  <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 space-y-5">
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  <form
                    onSubmit={handleSaveLayerSubmit}
                    className="lg:col-span-5 bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 space-y-4"
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

                    <div className="grid grid-cols-2 gap-3">
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

                    <div className="grid grid-cols-2 gap-3">
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
                  <div className="lg:col-span-7 bg-white border border-[#E5E5E5] rounded-3xl p-6 sm:p-8 space-y-5">
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
                transition={{ duration: 0.18 }}
                role="dialog"
                aria-modal="true"
                aria-label="Set Admin Password"
                className="pointer-events-auto w-full max-w-md bg-white border border-[#E5E5E5] rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="px-6 py-4 bg-[#0A0A0A] text-white flex items-center justify-between">
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

                <form onSubmit={handleSaveOwnerPassword} className="p-6 space-y-4">
                  <p className="text-xs text-[#525252] leading-relaxed">
                    Set or update the manual login password for <strong className="text-[#0A0A0A]">zulumageba</strong> ({OWNER_EMAIL}) so you can sign in on any device.
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
    </div>
  );
};

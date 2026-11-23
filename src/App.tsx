/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { ToastData, ToastNotification } from './components/ToastNotification';
import { getConfiguredPortalSlug, matchesPrivatePortalSlug, siteConfig } from './config/siteConfig';
import { StoreProvider, useStore } from './context/StoreContext';
import { HomePage } from './pages/HomePage';
import { sanitizeAddress, sanitizePromoCode, sanitizeText } from './utils/sanitize';

const ShopPage = lazy(() =>
  import('./pages/ShopPage').then((m) => ({ default: m.ShopPage }))
);
const ComboLayeringPage = lazy(() =>
  import('./pages/ComboLayeringPage').then((m) => ({ default: m.ComboLayeringPage }))
);
const ProductDetailPage = lazy(() =>
  import('./pages/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage }))
);
const DecantsPage = lazy(() =>
  import('./pages/DecantsPage').then((m) => ({ default: m.DecantsPage }))
);
const GiftsHampersPage = lazy(() =>
  import('./pages/GiftsHampersPage').then((m) => ({ default: m.GiftsHampersPage }))
);
const StoresPage = lazy(() =>
  import('./pages/StoresPage').then((m) => ({ default: m.StoresPage }))
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const ReferralAuthPage = lazy(() =>
  import('./pages/ReferralAuthPage').then((m) => ({ default: m.ReferralAuthPage }))
);
const ReferralDashboardPage = lazy(() =>
  import('./pages/ReferralDashboardPage').then((m) => ({ default: m.ReferralDashboardPage }))
);
const BasketDrawer = lazy(() =>
  import('./components/BasketDrawer').then((m) => ({ default: m.BasketDrawer }))
);
const SearchOverlay = lazy(() =>
  import('./components/SearchOverlay').then((m) => ({ default: m.SearchOverlay }))
);
const WhatsAppOrderModal = lazy(() =>
  import('./components/WhatsAppOrderModal').then((m) => ({
    default: m.WhatsAppOrderModal,
  }))
);
import {
  AppPage,
  BasketItem,
  BottleSize,
  BranchId,
  BranchStockFilter,
  ComboDeal,
  Coupon,
  DeliveryMethod,
  FragranceCategory,
  FragranceProduct,
  GiftHamper,
  InfluencerReferral,
  PriceRangeFilter,
  PublicReferral,
  SeasonFilter,
  WeeklyFiveMlAudience,
  WeeklyFiveMlPackMode,
} from './types/fragrance';
import { getEffectiveUnitPrice } from './utils/pricing';

const BASKET_STORAGE_KEY = 'aurahut_whatsapp_basket_v1';
const BRANCH_STORAGE_KEY = 'aurahut_preferred_branch_v1';
const DELIVERY_METHOD_STORAGE_KEY = 'aurahut_delivery_method_v1';
const POST_OFFICE_TOWN_STORAGE_KEY = 'aurahut_post_office_town_v1';
const REFERRAL_STORAGE_KEY = 'aurahut_referral_code_v1';
const CLIENT_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredTtlEnvelope<T> {
  v: 2;
  expiresAt: number;
  data: T;
}

function writeStorageWithTtl<T>(key: string, data: T): void {
  try {
    const payload: StoredTtlEnvelope<T> = {
      v: 2,
      expiresAt: Date.now() + CLIENT_STORAGE_TTL_MS,
      data,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore storage quota / private-browsing errors
  }
}

function readStorageWithTtl<T>(
  key: string,
  validate: (raw: unknown) => T | null
): T | null {
  try {
    const rawStr = localStorage.getItem(key);
    if (!rawStr) return null;

    let parsed: unknown = rawStr;
    if (rawStr.startsWith('{') || rawStr.startsWith('[') || rawStr.startsWith('"')) {
      try {
        parsed = JSON.parse(rawStr);
      } catch {
        parsed = rawStr;
      }
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      (parsed as Partial<StoredTtlEnvelope<unknown>>).v === 2 &&
      typeof (parsed as Partial<StoredTtlEnvelope<unknown>>).expiresAt === 'number'
    ) {
      const env = parsed as StoredTtlEnvelope<unknown>;
      if (Date.now() > env.expiresAt) {
        localStorage.removeItem(key);
        return null;
      }
      return validate(env.data);
    }

    // Legacy v1 un-wrapped value: validate and upgrade in-place with 24h TTL
    const validated = validate(parsed);
    if (validated !== null) {
      writeStorageWithTtl(key, validated);
      return validated;
    }
    localStorage.removeItem(key);
  } catch {
    // Ignore storage read/parse errors
  }
  return null;
}

function validateStoredBasket(raw: unknown): BasketItem[] | null {
  if (!Array.isArray(raw)) return null;
  const clean: BasketItem[] = [];
  for (const entry of raw.slice(0, 60)) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<BasketItem>;
    const productId = sanitizeText(String(item.productId ?? ''), 120);
    const productName = sanitizeText(String(item.productName ?? ''), 160);
    const size = sanitizeText(String(item.size ?? ''), 80);
    if (!productId || !productName || !size) continue;
    const qty = Math.min(50, Math.max(1, Math.floor(Number(item.quantity) || 1)));
    const unitPrice =
      item.unitPrice === null
        ? null
        : typeof item.unitPrice === 'number' &&
          Number.isFinite(item.unitPrice) &&
          item.unitPrice >= 0
        ? item.unitPrice
        : null;
    const originalUnitPrice =
      item.originalUnitPrice === null || item.originalUnitPrice === undefined
        ? null
        : typeof item.originalUnitPrice === 'number' &&
          Number.isFinite(item.originalUnitPrice) &&
          item.originalUnitPrice >= 0
        ? item.originalUnitPrice
        : null;
    clean.push({
      productId,
      productName,
      brand: sanitizeText(String(item.brand ?? ''), 80),
      image: sanitizeText(String(item.image ?? ''), 600),
      size,
      unitPrice,
      originalUnitPrice,
      onSpecial: Boolean(item.onSpecial),
      specialDiscountPercent:
        typeof item.specialDiscountPercent === 'number' &&
        Number.isFinite(item.specialDiscountPercent)
          ? Math.min(90, Math.max(0, item.specialDiscountPercent))
          : undefined,
      isUnboxed: Boolean(item.isUnboxed),
      quantity: qty,
      isSampleListing: Boolean(item.isSampleListing),
    });
  }
  return clean;
}

function isPrivatePortalLocation(pathname: string, hash: string): boolean {
  return matchesPrivatePortalSlug(hash) || matchesPrivatePortalSlug(pathname);
}

function isAdminPwaLaunchLocation(search: string, hash: string): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(search);
  if (params.get('app')?.toLowerCase() === 'admin') return true;
  const lowerHash = hash.toLowerCase();
  if (lowerHash === '#referral-dashboard' || lowerHash === '#referral-auth' || lowerHash === '#partners') {
    return false;
  }
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isStandalone && !params.get('ref');
}

function detectInitialPage(): AppPage {
  if (typeof window === 'undefined') return 'home';
  if (
    isPrivatePortalLocation(window.location.pathname, window.location.hash) ||
    isAdminPwaLaunchLocation(window.location.search, window.location.hash)
  ) {
    return 'admin';
  }
  const hash = window.location.hash.toLowerCase();
  if (hash === '#referral-dashboard') return 'referral-dashboard';
  if (hash === '#referral-auth' || hash === '#partners') return 'referral-auth';
  return 'home';
}

function AppContent() {
  const {
    perfumes,
    lookupReferralByCode,
    catalogueError,
    usingSampleFallback,
    retryCatalogueSync,
  } = useStore();
  const [syncBannerDismissed, setSyncBannerDismissed] = useState(false);

  const [currentPage, setCurrentPage] = useState<AppPage>(detectInitialPage);
  const [selectedProductId, setSelectedProductId] = useState<string>(
    perfumes[0]?.id ?? 'sample-01'
  );

  // Sync selectedProduct cleanly with latest live perfume data
  const selectedProduct =
    perfumes.find((p) => p.id === selectedProductId) ?? perfumes[0];

  // Shop Filters
  const [selectedCategory, setSelectedCategory] = useState<FragranceCategory | 'All'>('All');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedSize, setSelectedSize] = useState<BottleSize | 'All'>('All');
  const [selectedPriceRange, setSelectedPriceRange] = useState<PriceRangeFilter>('all');
  const [selectedSeason, setSelectedSeason] = useState<SeasonFilter>('all');
  const [selectedBranchFilter, setSelectedBranchFilter] =
    useState<BranchStockFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [onlySpecials, setOnlySpecials] = useState<boolean>(false);
  const [onlyUnboxed, setOnlyUnboxed] = useState<boolean>(false);

  // Overlays, Modals & UX Feedback
  const [searchOpen, setSearchOpen] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  const [quickOrderProduct, setQuickOrderProduct] = useState<FragranceProduct | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [appliedReferral, setAppliedReferral] = useState<
    PublicReferral | InfluencerReferral | null
  >(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  // Basket, Branch & Delivery State (24h TTL on shared devices)
  const [selectedBranch, setSelectedBranch] = useState<BranchId>(() => {
    return (
      readStorageWithTtl<BranchId>(BRANCH_STORAGE_KEY, (raw) =>
        raw === 'manzini' || raw === 'mbabane' ? raw : null
      ) ?? siteConfig.defaultBranch
    );
  });

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(() => {
    return (
      readStorageWithTtl<DeliveryMethod>(DELIVERY_METHOD_STORAGE_KEY, (raw) =>
        raw === 'store-pickup' || raw === 'post-office' || raw === 'driver-delivery'
          ? raw
          : null
      ) ?? 'store-pickup'
    );
  });

  const [postOfficeTown, setPostOfficeTown] = useState<string>(() => {
    return (
      readStorageWithTtl<string>(POST_OFFICE_TOWN_STORAGE_KEY, (raw) =>
        typeof raw === 'string' ? sanitizeText(raw, 80) : null
      ) ?? ''
    );
  });

  const [deliveryAddress, setDeliveryAddress] = useState<string>('');

  const [basketItems, setBasketItems] = useState<BasketItem[]>(() => {
    return readStorageWithTtl<BasketItem[]>(BASKET_STORAGE_KEY, validateStoredBasket) ?? [];
  });

  useEffect(() => {
    writeStorageWithTtl(BASKET_STORAGE_KEY, basketItems);
  }, [basketItems]);

  useEffect(() => {
    writeStorageWithTtl(BRANCH_STORAGE_KEY, selectedBranch);
  }, [selectedBranch]);

  useEffect(() => {
    writeStorageWithTtl(DELIVERY_METHOD_STORAGE_KEY, deliveryMethod);
  }, [deliveryMethod]);

  useEffect(() => {
    writeStorageWithTtl(POST_OFFICE_TOWN_STORAGE_KEY, postOfficeTown);
  }, [postOfficeTown]);

  const forceScrollTopInstant = useCallback(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    forceScrollTopInstant();

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        forceScrollTopInstant();
      }
    };
    window.addEventListener('pageshow', onPageShow);

    // Preload high-traffic views shortly after mount only on non-constrained connections
    const conn = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    const constrainedConnection = Boolean(
      conn?.saveData || conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g'
    );
    const preloadTimer = constrainedConnection
      ? 0
      : window.setTimeout(() => {
          void import('./pages/ShopPage');
          void import('./pages/ProductDetailPage');
        }, 800);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      if (preloadTimer) window.clearTimeout(preloadTimer);
    };
  }, [forceScrollTopInstant]);

  useLayoutEffect(() => {
    forceScrollTopInstant();
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      forceScrollTopInstant();
      raf2 = window.requestAnimationFrame(() => {
        forceScrollTopInstant();
      });
    });
    const settleTimer = window.setTimeout(() => {
      if (window.scrollY > 0) {
        forceScrollTopInstant();
      }
    }, 80);

    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
      window.clearTimeout(settleTimer);
    };
  }, [
    currentPage,
    selectedProductId,
    selectedCategory,
    selectedPriceRange,
    selectedSeason,
    selectedBranchFilter,
    onlySpecials,
    onlyUnboxed,
    forceScrollTopInstant,
  ]);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollTop(window.scrollY > 520);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const syncPortalFromLocation = () => {
      if (
        isPrivatePortalLocation(window.location.pathname, window.location.hash) ||
        new URLSearchParams(window.location.search).get('app')?.toLowerCase() === 'admin'
      ) {
        setCurrentPage('admin');
        return;
      }
      const hash = window.location.hash.toLowerCase();
      if (hash === '#referral-dashboard') {
        setCurrentPage('referral-dashboard');
      } else if (hash === '#referral-auth' || hash === '#partners') {
        setCurrentPage('referral-auth');
      }
    };
    window.addEventListener('hashchange', syncPortalFromLocation);
    window.addEventListener('popstate', syncPortalFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncPortalFromLocation);
      window.removeEventListener('popstate', syncPortalFromLocation);
    };
  }, []);

  useEffect(() => {
    document.title =
      currentPage === 'admin'
        ? 'AuraHut Co. Owner Admin'
        : 'AuraHut Co.- Scents Just For You';
    const metaId = 'aurahut-private-robots-meta';
    const existing = document.getElementById(metaId);
    if (currentPage === 'admin') {
      if (!existing) {
        const meta = document.createElement('meta');
        meta.id = metaId;
        meta.name = 'robots';
        meta.content = 'noindex, nofollow';
        document.head.appendChild(meta);
      }
    } else if (existing) {
      existing.remove();
    }
  }, [currentPage]);

  const showToast = useCallback((title: string, subtitle: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), title, subtitle });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3600);
  }, []);

  const handleApplyReferral = useCallback(
    (referral: PublicReferral | InfluencerReferral | null) => {
      setAppliedReferral(referral);
      try {
        if (referral) {
          writeStorageWithTtl(REFERRAL_STORAGE_KEY, referral.code);
        } else {
          localStorage.removeItem(REFERRAL_STORAGE_KEY);
        }
      } catch {
        // Ignore storage errors
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const urlRefCode = params.get('ref')?.trim() ?? '';
    const storedRefCode =
      readStorageWithTtl<string>(REFERRAL_STORAGE_KEY, (raw) =>
        typeof raw === 'string' ? sanitizePromoCode(raw, 32) || null : null
      ) ?? '';

    const candidateCode = urlRefCode || storedRefCode;
    if (!candidateCode) return;

    void (async () => {
      try {
        const { referral } = await lookupReferralByCode(candidateCode);
        if (!active) return;
        if (referral && referral.active) {
          handleApplyReferral(referral);
          if (urlRefCode) {
            const cleanedUrl = new URL(window.location.href);
            cleanedUrl.searchParams.delete('ref');
            window.history.replaceState(
              null,
              '',
              `${cleanedUrl.pathname}${cleanedUrl.search}${cleanedUrl.hash}`
            );
            showToast(
              'Influencer Code Applied',
              `${referral.code} · Referred by ${referral.influencerName}`
            );
          }
        } else if (!urlRefCode && storedRefCode) {
          localStorage.removeItem(REFERRAL_STORAGE_KEY);
        }
      } catch {
        // Ignore network errors while resolving optional referral code
      }
    })();

    return () => {
      active = false;
    };
  }, [lookupReferralByCode, handleApplyReferral, showToast]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = useCallback(
    (
      page: AppPage,
      options?: {
        category?: FragranceCategory | 'All';
        brand?: string;
        size?: BottleSize | 'All';
        priceRange?: PriceRangeFilter;
        season?: SeasonFilter;
        branchFilter?: BranchStockFilter;
        query?: string;
        onlySpecials?: boolean;
        onlyUnboxed?: boolean;
      }
    ) => {
      if (page === 'shop') {
        if (options?.category !== undefined) setSelectedCategory(options.category);
        if (options?.brand !== undefined) setSelectedBrand(options.brand);
        if (options?.size !== undefined) setSelectedSize(options.size);
        if (options?.priceRange !== undefined) setSelectedPriceRange(options.priceRange);
        if (options?.season !== undefined) setSelectedSeason(options.season);
        if (options?.branchFilter !== undefined) setSelectedBranchFilter(options.branchFilter);
        if (options?.query !== undefined) setSearchQuery(options.query);
        if (options?.onlySpecials !== undefined) setOnlySpecials(options.onlySpecials);
        if (options?.onlyUnboxed !== undefined) setOnlyUnboxed(options.onlyUnboxed);
      }
      if (page === 'admin') {
        const configured = getConfiguredPortalSlug();
        if (configured) {
          window.history.replaceState(null, '', `#${configured}`);
        }
      } else if (page === 'referral-auth') {
        window.history.replaceState(null, '', '#referral-auth');
      } else if (page === 'referral-dashboard') {
        window.history.replaceState(null, '', '#referral-dashboard');
      } else if (
        isPrivatePortalLocation(window.location.pathname, window.location.hash) ||
        new URLSearchParams(window.location.search).get('app')?.toLowerCase() === 'admin' ||
        ['#referral-auth', '#referral-dashboard', '#partners'].includes(
          window.location.hash.toLowerCase()
        )
      ) {
        window.history.replaceState(null, '', '/');
      }
      setCurrentPage(page);
      forceScrollTopInstant();
    },
    [forceScrollTopInstant]
  );

  const handleSelectProduct = useCallback(
    (product: FragranceProduct) => {
      setSelectedProductId(product.id);
      setCurrentPage('product');
      forceScrollTopInstant();
    },
    [forceScrollTopInstant]
  );

  const handleResetFilters = useCallback(() => {
    setSelectedCategory('All');
    setSelectedBrand('All');
    setSelectedSize('All');
    setSelectedPriceRange('all');
    setSelectedSeason('all');
    setSelectedBranchFilter('all');
    setSearchQuery('');
    setOnlyInStock(false);
    setOnlySpecials(false);
    setOnlyUnboxed(false);
  }, []);

  const handleQuickWhatsApp = useCallback((p: FragranceProduct) => {
    setQuickOrderProduct(p);
  }, []);

  const handleDeliveryAddressChange = useCallback((next: string) => {
    setDeliveryAddress(sanitizeAddress(next));
  }, []);

  const handleAddToBasketWrapped = useCallback(
    (product: FragranceProduct, size: BottleSize, quantity: number) => {
      const sizeOption = product.sizes.find((s) => s.size === size);
      const rawPrice = sizeOption?.price ?? null;
      const unitPrice = getEffectiveUnitPrice(
        rawPrice,
        product.onSpecial,
        product.specialDiscountPercent
      );

      setBasketItems((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.productId === product.id && item.size === size
        );
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            unitPrice,
            originalUnitPrice: rawPrice,
            onSpecial: product.onSpecial,
            specialDiscountPercent: product.specialDiscountPercent,
            isUnboxed: Boolean(product.isUnboxed),
            quantity: next[existingIndex].quantity + quantity,
          };
          return next;
        }
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            image: product.image,
            size,
            unitPrice,
            originalUnitPrice: rawPrice,
            onSpecial: product.onSpecial,
            specialDiscountPercent: product.specialDiscountPercent,
            isUnboxed: Boolean(product.isUnboxed),
            quantity,
            isSampleListing: product.isSampleListing,
          },
        ];
      });

      showToast(
        `Added ${product.name}`,
        `${size}${product.isUnboxed ? ' (Unboxed)' : ''} × ${quantity} added to your cart`
      );
    },
    [showToast]
  );

  const handleAddHamperToBasket = (hamper: GiftHamper, customGiftNote?: string) => {
    const hamperProductId = `hamper-${hamper.id}`;
    const noteSuffix = customGiftNote ? ` · Card: "${customGiftNote.slice(0, 48)}"` : '';
    const hamperDetails = `${hamper.occasion} · ${hamper.itemsIncluded.length} items${noteSuffix}`;

    setBasketItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.productId === hamperProductId && item.size === hamperDetails
      );
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          unitPrice: hamper.hamperPrice,
          originalUnitPrice: hamper.regularPrice,
          quantity: next[existingIndex].quantity + 1,
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: hamperProductId,
          productName: hamper.title,
          brand: 'Gift Hamper',
          image: hamper.image || '/assets/images/luxury_gift_hamper_1795005244668.jpg',
          size: hamperDetails,
          unitPrice: hamper.hamperPrice,
          originalUnitPrice: hamper.regularPrice,
          onSpecial: hamper.regularPrice > hamper.hamperPrice,
          quantity: 1,
          isSampleListing: false,
        },
      ];
    });

    showToast(
      `Added ${hamper.title}`,
      `Gift hamper added to your cart (E${hamper.hamperPrice.toFixed(0)})`
    );
  };

  const handleAddComboToBasket = (combo: ComboDeal, fallbackImage: string) => {
    const comboProductId = `combo-${combo.id}`;
    const comboSizeLabel = `${combo.sizeLabel} · ${combo.perfumeNames.join(' + ')}`.slice(0, 64);

    setBasketItems((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.productId === comboProductId && item.size === comboSizeLabel
      );
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          unitPrice: combo.comboPrice,
          originalUnitPrice: combo.regularPrice,
          quantity: next[existingIndex].quantity + 1,
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: comboProductId,
          productName: combo.title,
          brand: 'Combo Deal',
          image: fallbackImage,
          size: comboSizeLabel,
          unitPrice: combo.comboPrice,
          originalUnitPrice: combo.regularPrice,
          onSpecial: combo.regularPrice > combo.comboPrice,
          quantity: 1,
          isSampleListing: false,
        },
      ];
    });

    showToast(
      `Added ${combo.title}`,
      `Bundle added for E${combo.comboPrice.toFixed(0)} (was E${combo.regularPrice.toFixed(0)})`
    );
  };

  const handleAddWeeklyPackToBasket = useCallback(
    (payload: {
      audience: WeeklyFiveMlAudience;
      mode: WeeklyFiveMlPackMode;
      weekKey: string;
      products: FragranceProduct[];
      price: number;
      regularPrice: number | null;
    }) => {
      const productNames = payload.products.map((p) => p.name);
      const isFourPack = payload.mode === '4-for-100';
      const audienceTag = `For ${payload.audience}`;
      const itemId = `weekly-5ml-${payload.weekKey}-${payload.audience.toLowerCase()}-${payload.mode}`;
      const itemTitle = isFourPack
        ? `5ml Special · ${audienceTag} (4 × 5ml)`
        : `5ml Special · ${audienceTag} (2 × 5ml · Under E500)`;
      const packLabel = `${isFourPack ? '4 × 5ml' : '2 × 5ml (Under E500)'} (${audienceTag}): ${productNames.join(' + ')}`;
      const primaryImage =
        payload.products[0]?.image ?? '/assets/images/house_lattafa_1794685069142.jpg';

      setBasketItems((prev) => {
        const existingIndex = prev.findIndex(
          (item) => item.productId === itemId && item.size === packLabel
        );
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = {
            ...next[existingIndex],
            unitPrice: payload.price,
            originalUnitPrice: payload.regularPrice,
            quantity: next[existingIndex].quantity + 1,
          };
          return next;
        }
        return [
          ...prev,
          {
            productId: itemId,
            productName: itemTitle,
            brand: 'Weekly 5ml Special',
            image: primaryImage,
            size: packLabel,
            unitPrice: payload.price,
            originalUnitPrice: payload.regularPrice,
            onSpecial: true,
            quantity: 1,
            isSampleListing: false,
          },
        ];
      });

      showToast(
        `Added ${audienceTag} ${isFourPack ? '4 × 5ml Pack (E' + payload.price + ')' : '2 × 5ml Pack (E' + payload.price + ')'}`,
        productNames.join(' + ')
      );
    },
    [showToast]
  );

  const handleUpdateQuantity = (
    productId: string,
    size: BottleSize,
    delta: number
  ) => {
    setBasketItems((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId && item.size === size) {
            return { ...item, quantity: item.quantity + delta };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveItem = (productId: string, size: BottleSize) => {
    setBasketItems((prev) =>
      prev.filter((item) => !(item.productId === productId && item.size === size))
    );
  };

  const handleSelectBranchAndOpenBasket = useCallback((branchId: BranchId) => {
    setSelectedBranch(branchId);
    setBasketOpen(true);
  }, []);

  const totalBasketCount = basketItems.reduce((sum, i) => sum + i.quantity, 0);

  if (currentPage === 'admin') {
    return (
      <>
        <ErrorBoundary>
          <Suspense
            fallback={
              <div className="min-h-screen bg-[#F7F7F7] flex items-center justify-center text-xs uppercase tracking-[0.2em] text-[#666666]">
                Loading Owner Console...
              </div>
            }
          >
            <AdminDashboardPage
              onBackToStorefront={() => handleNavigate('home')}
              onNotify={showToast}
            />
          </Suspense>
        </ErrorBoundary>

        <ToastNotification
          toast={toast}
          onOpenBasket={() => handleNavigate('home')}
          onDismiss={() => setToast(null)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0A0A0A]">

      <Navbar
        currentPage={currentPage}
        activeCategory={selectedCategory}
        onlySpecials={onlySpecials}
        onlyUnboxed={onlyUnboxed}
        basketCount={totalBasketCount}
        onNavigate={handleNavigate}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenBasket={() => setBasketOpen(true)}
      />

      {catalogueError && usingSampleFallback && !syncBannerDismissed && (
        <div
          role="status"
          className="bg-[#FEF9C3] border-b border-[#FDE047] text-[#0A0A0A] px-4 py-2 text-xs flex flex-wrap items-center justify-center gap-3"
        >
          <span>
            Showing offline starter catalogue while reconnecting to live store inventory.
          </span>
          <button
            type="button"
            onClick={() => void retryCatalogueSync()}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#0A0A0A] text-white font-semibold text-[11px] hover:bg-[#262626]"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Retry Sync</span>
          </button>
          <button
            type="button"
            onClick={() => setSyncBannerDismissed(true)}
            className="text-[11px] underline text-[#525252] hover:text-[#0A0A0A]"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1 [overflow-anchor:none]">
        <motion.div
          key={
            currentPage === 'product' && selectedProduct
              ? `product-${selectedProduct.id}`
              : currentPage
          }
          initial={{ opacity: 0.94 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
        >
          <ErrorBoundary>
            <Suspense
              fallback={
                <div className="min-h-[85dvh] flex items-center justify-center text-xs uppercase tracking-[0.2em] text-[#666666]">
                  Loading...
                </div>
              }
            >
              {currentPage === 'home' && (
                <HomePage
                  onNavigate={handleNavigate}
                  onSelectProduct={handleSelectProduct}
                  onQuickWhatsApp={handleQuickWhatsApp}
                  onSelectBranchAndBasket={handleSelectBranchAndOpenBasket}
                  onAddWeeklyPackToBasket={handleAddWeeklyPackToBasket}
                />
              )}

              {currentPage === 'shop' && (
                <ShopPage
                  selectedCategory={selectedCategory}
                  selectedBrand={selectedBrand}
                  selectedSize={selectedSize}
                  selectedPriceRange={selectedPriceRange}
                  selectedSeason={selectedSeason}
                  selectedBranchFilter={selectedBranchFilter}
                  searchQuery={searchQuery}
                  onlyInStock={onlyInStock}
                  onlySpecials={onlySpecials}
                  onlyUnboxed={onlyUnboxed}
                  onCategoryChange={setSelectedCategory}
                  onBrandChange={setSelectedBrand}
                  onSizeChange={setSelectedSize}
                  onPriceRangeChange={setSelectedPriceRange}
                  onSeasonChange={setSelectedSeason}
                  onBranchFilterChange={setSelectedBranchFilter}
                  onSearchChange={setSearchQuery}
                  onOnlyInStockChange={setOnlyInStock}
                  onOnlySpecialsChange={setOnlySpecials}
                  onOnlyUnboxedChange={setOnlyUnboxed}
                  onResetFilters={handleResetFilters}
                  onSelectProduct={handleSelectProduct}
                  onQuickWhatsApp={handleQuickWhatsApp}
                />
              )}

              {currentPage === 'product' && selectedProduct && (
                <ProductDetailPage
                  product={selectedProduct}
                  selectedBranch={selectedBranch}
                  deliveryMethod={deliveryMethod}
                  postOfficeTown={postOfficeTown}
                  deliveryAddress={deliveryAddress}
                  appliedReferral={appliedReferral}
                  onSelectBranch={setSelectedBranch}
                  onSelectDeliveryMethod={setDeliveryMethod}
                  onPostOfficeTownChange={setPostOfficeTown}
                  onDeliveryAddressChange={handleDeliveryAddressChange}
                  onAddToBasket={handleAddToBasketWrapped}
                  onBackToShop={() => handleNavigate('shop')}
                  onSelectProduct={handleSelectProduct}
                  onQuickWhatsApp={handleQuickWhatsApp}
                />
              )}

              {currentPage === 'combos' && (
                <ComboLayeringPage
                  onSelectProduct={handleSelectProduct}
                  onAddToBasket={handleAddToBasketWrapped}
                  onAddComboToBasket={handleAddComboToBasket}
                  onAddWeeklyPackToBasket={handleAddWeeklyPackToBasket}
                  onQuickWhatsApp={handleQuickWhatsApp}
                  onNavigate={handleNavigate}
                />
              )}

              {currentPage === 'gifts' && (
                <GiftsHampersPage
                  onAddHamperToBasket={handleAddHamperToBasket}
                  onNavigate={handleNavigate}
                />
              )}

              {currentPage === 'decants' && (
                <DecantsPage
                  onBrowseSize={(size) =>
                    handleNavigate('shop', { category: 'All', brand: 'All', size })
                  }
                  onExploreShop={() =>
                    handleNavigate('shop', { category: 'All', brand: 'All', size: 'All' })
                  }
                  onSelectProduct={handleSelectProduct}
                  onAddWeeklyPackToBasket={handleAddWeeklyPackToBasket}
                />
              )}

              {currentPage === 'stores' && (
                <StoresPage
                  onSelectBranchAndBasket={handleSelectBranchAndOpenBasket}
                />
              )}

              {currentPage === 'about' && (
                <AboutPage onNavigate={(p) => handleNavigate(p)} />
              )}

              {currentPage === 'referral-auth' && (
                <ReferralAuthPage onNavigate={handleNavigate} onNotify={showToast} />
              )}

              {currentPage === 'referral-dashboard' && (
                <ReferralDashboardPage onNavigate={handleNavigate} onNotify={showToast} />
              )}
            </Suspense>
          </ErrorBoundary>
        </motion.div>
      </main>

      <Footer
        onNavigate={handleNavigate}
        onOpenBasket={() => setBasketOpen(true)}
      />

      <Suspense fallback={null}>
        <SearchOverlay
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelectProduct={handleSelectProduct}
          onViewAllResults={(q) =>
            handleNavigate('shop', {
              category: 'All',
              brand: 'All',
              size: 'All',
              query: q,
            })
          }
        />

        <BasketDrawer
          isOpen={basketOpen}
          items={basketItems}
          selectedBranch={selectedBranch}
          deliveryMethod={deliveryMethod}
          postOfficeTown={postOfficeTown}
          deliveryAddress={deliveryAddress}
          appliedCoupon={appliedCoupon}
          appliedReferral={appliedReferral}
          onApplyCoupon={setAppliedCoupon}
          onApplyReferral={handleApplyReferral}
          onSelectBranch={setSelectedBranch}
          onSelectDeliveryMethod={setDeliveryMethod}
          onPostOfficeTownChange={setPostOfficeTown}
          onDeliveryAddressChange={handleDeliveryAddressChange}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onReplaceBasket={setBasketItems}
          onClearBasket={() => {
            setBasketItems([]);
            setAppliedCoupon(null);
          }}
          onClose={() => setBasketOpen(false)}
          onExploreShop={() =>
            handleNavigate('shop', { category: 'All', brand: 'All', size: 'All' })
          }
        />

        <WhatsAppOrderModal
          product={quickOrderProduct}
          selectedBranch={selectedBranch}
          deliveryMethod={deliveryMethod}
          postOfficeTown={postOfficeTown}
          deliveryAddress={deliveryAddress}
          appliedReferral={appliedReferral}
          onApplyReferral={handleApplyReferral}
          onSelectBranch={setSelectedBranch}
          onSelectDeliveryMethod={setDeliveryMethod}
          onPostOfficeTownChange={setPostOfficeTown}
          onDeliveryAddressChange={handleDeliveryAddressChange}
          onAddToBasket={handleAddToBasketWrapped}
          onClose={() => setQuickOrderProduct(null)}
        />
      </Suspense>

      <ToastNotification
        toast={toast}
        onOpenBasket={() => setBasketOpen(true)}
        onDismiss={() => setToast(null)}
      />

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            onClick={scrollToTop}
            aria-label="Back to top"
            className="flex fixed bottom-20 right-4 lg:bottom-6 lg:right-auto lg:left-6 z-30 w-11 h-11 rounded-full bg-[#0A0A0A] text-white border border-white/25 hover:bg-[#262626] shadow-lg items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]"
          >
            <ArrowUp className="w-4 h-4" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <AppContent />
    </StoreProvider>
  );
}

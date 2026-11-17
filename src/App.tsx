/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp } from 'lucide-react';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { ToastData, ToastNotification } from './components/ToastNotification';
import { siteConfig } from './config/siteConfig';
import { StoreProvider, useStore } from './context/StoreContext';
import { HomePage } from './pages/HomePage';

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
const StoresPage = lazy(() =>
  import('./pages/StoresPage').then((m) => ({ default: m.StoresPage }))
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage').then((m) => ({ default: m.AboutPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
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
  ComboDeal,
  Coupon,
  DeliveryMethod,
  FragranceCategory,
  FragranceProduct,
  PriceRangeFilter,
  SeasonFilter,
} from './types/fragrance';
import { getEffectiveUnitPrice } from './utils/pricing';

const BASKET_STORAGE_KEY = 'aurahut_whatsapp_basket_v1';
const BRANCH_STORAGE_KEY = 'aurahut_preferred_branch_v1';
const DELIVERY_METHOD_STORAGE_KEY = 'aurahut_delivery_method_v1';
const POST_OFFICE_TOWN_STORAGE_KEY = 'aurahut_post_office_town_v1';

function detectInitialPage(): AppPage {
  if (typeof window === 'undefined') return 'home';
  const hash = window.location.hash.toLowerCase();
  const path = window.location.pathname.toLowerCase();
  if (hash === '#admin' || path === '/admin' || path === '/admin/') {
    return 'admin';
  }
  return 'home';
}

function AppContent() {
  const { perfumes } = useStore();

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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false);
  const [onlySpecials, setOnlySpecials] = useState<boolean>(false);

  // Overlays, Modals & UX Feedback
  const [searchOpen, setSearchOpen] = useState(false);
  const [basketOpen, setBasketOpen] = useState(false);
  const [quickOrderProduct, setQuickOrderProduct] = useState<FragranceProduct | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  // Basket, Branch & Delivery State
  const [selectedBranch, setSelectedBranch] = useState<BranchId>(() => {
    try {
      const saved = localStorage.getItem(BRANCH_STORAGE_KEY);
      if (saved === 'manzini' || saved === 'mbabane') return saved;
    } catch {
      // Ignore storage errors
    }
    return siteConfig.defaultBranch;
  });

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(() => {
    try {
      const saved = localStorage.getItem(DELIVERY_METHOD_STORAGE_KEY);
      if (saved === 'store-pickup' || saved === 'post-office' || saved === 'driver-delivery') {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return 'store-pickup';
  });

  const [postOfficeTown, setPostOfficeTown] = useState<string>(() => {
    try {
      return localStorage.getItem(POST_OFFICE_TOWN_STORAGE_KEY) ?? '';
    } catch {
      return '';
    }
  });

  const [deliveryAddress, setDeliveryAddress] = useState<string>('');

  const [basketItems, setBasketItems] = useState<BasketItem[]>(() => {
    try {
      const saved = localStorage.getItem(BASKET_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(BASKET_STORAGE_KEY, JSON.stringify(basketItems));
    } catch {
      // Ignore storage errors
    }
  }, [basketItems]);

  useEffect(() => {
    try {
      localStorage.setItem(BRANCH_STORAGE_KEY, selectedBranch);
    } catch {
      // Ignore storage errors
    }
  }, [selectedBranch]);

  useEffect(() => {
    try {
      localStorage.setItem(DELIVERY_METHOD_STORAGE_KEY, deliveryMethod);
    } catch {
      // Ignore storage errors
    }
  }, [deliveryMethod]);

  useEffect(() => {
    try {
      localStorage.setItem(POST_OFFICE_TOWN_STORAGE_KEY, postOfficeTown);
    } catch {
      // Ignore storage errors
    }
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

    // Preload high-traffic views shortly after mount so mobile route switches never flash fallback height
    const preloadTimer = window.setTimeout(() => {
      void import('./pages/ShopPage');
      void import('./pages/ProductDetailPage');
    }, 600);

    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.clearTimeout(preloadTimer);
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
    onlySpecials,
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
    const onHashChange = () => {
      if (window.location.hash.toLowerCase() === '#admin') {
        setCurrentPage('admin');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const showToast = (title: string, subtitle: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), title, subtitle });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3600);
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (
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
  ) => {
    if (page === 'shop') {
      if (options?.category !== undefined) setSelectedCategory(options.category);
      if (options?.brand !== undefined) setSelectedBrand(options.brand);
      if (options?.size !== undefined) setSelectedSize(options.size);
      if (options?.priceRange !== undefined) setSelectedPriceRange(options.priceRange);
      if (options?.season !== undefined) setSelectedSeason(options.season);
      if (options?.query !== undefined) setSearchQuery(options.query);
      if (options?.onlySpecials !== undefined) setOnlySpecials(options.onlySpecials);
    }
    if (page === 'admin') {
      window.history.replaceState(null, '', '#admin');
    } else if (window.location.hash === '#admin' || window.location.pathname === '/admin') {
      window.history.replaceState(null, '', '/');
    }
    setCurrentPage(page);
    forceScrollTopInstant();
  };

  const handleSelectProduct = (product: FragranceProduct) => {
    setSelectedProductId(product.id);
    setCurrentPage('product');
    forceScrollTopInstant();
  };

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSelectedBrand('All');
    setSelectedSize('All');
    setSelectedPriceRange('all');
    setSelectedSeason('all');
    setSearchQuery('');
    setOnlyInStock(false);
    setOnlySpecials(false);
  };

  const handleAddToBasket = (
    product: FragranceProduct,
    size: BottleSize,
    quantity: number
  ) => {
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
          quantity,
          isSampleListing: product.isSampleListing,
        },
      ];
    });

    showToast(
      `Added ${product.name}`,
      `${size} × ${quantity} added to your cart`
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

  const handleSelectBranchAndOpenBasket = (branchId: BranchId) => {
    setSelectedBranch(branchId);
    setBasketOpen(true);
  };

  const totalBasketCount = basketItems.reduce((sum, i) => sum + i.quantity, 0);

  if (currentPage === 'admin') {
    return (
      <>
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
        basketCount={totalBasketCount}
        onNavigate={handleNavigate}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenBasket={() => setBasketOpen(true)}
      />

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
                onQuickWhatsApp={(p) => setQuickOrderProduct(p)}
                onSelectBranchAndBasket={handleSelectBranchAndOpenBasket}
              />
            )}

            {currentPage === 'shop' && (
              <ShopPage
                selectedCategory={selectedCategory}
                selectedBrand={selectedBrand}
                selectedSize={selectedSize}
                selectedPriceRange={selectedPriceRange}
                selectedSeason={selectedSeason}
                searchQuery={searchQuery}
                onlyInStock={onlyInStock}
                onlySpecials={onlySpecials}
                onCategoryChange={setSelectedCategory}
                onBrandChange={setSelectedBrand}
                onSizeChange={setSelectedSize}
                onPriceRangeChange={setSelectedPriceRange}
                onSeasonChange={setSelectedSeason}
                onSearchChange={setSearchQuery}
                onOnlyInStockChange={setOnlyInStock}
                onOnlySpecialsChange={setOnlySpecials}
                onResetFilters={handleResetFilters}
                onSelectProduct={handleSelectProduct}
                onQuickWhatsApp={(p) => setQuickOrderProduct(p)}
              />
            )}

            {currentPage === 'product' && selectedProduct && (
              <ProductDetailPage
                product={selectedProduct}
                selectedBranch={selectedBranch}
                deliveryMethod={deliveryMethod}
                postOfficeTown={postOfficeTown}
                deliveryAddress={deliveryAddress}
                onSelectBranch={setSelectedBranch}
                onSelectDeliveryMethod={setDeliveryMethod}
                onPostOfficeTownChange={setPostOfficeTown}
                onDeliveryAddressChange={setDeliveryAddress}
                onAddToBasket={handleAddToBasket}
                onBackToShop={() => handleNavigate('shop')}
                onSelectProduct={handleSelectProduct}
                onQuickWhatsApp={(p) => setQuickOrderProduct(p)}
              />
            )}

            {currentPage === 'combos' && (
              <ComboLayeringPage
                onSelectProduct={handleSelectProduct}
                onAddToBasket={handleAddToBasket}
                onAddComboToBasket={handleAddComboToBasket}
                onQuickWhatsApp={(p) => setQuickOrderProduct(p)}
                onNavigate={(p, opts) => handleNavigate(p, opts)}
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
          </Suspense>
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
          onApplyCoupon={setAppliedCoupon}
          onSelectBranch={setSelectedBranch}
          onSelectDeliveryMethod={setDeliveryMethod}
          onPostOfficeTownChange={setPostOfficeTown}
          onDeliveryAddressChange={setDeliveryAddress}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
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
          onSelectBranch={setSelectedBranch}
          onSelectDeliveryMethod={setDeliveryMethod}
          onPostOfficeTownChange={setPostOfficeTown}
          onDeliveryAddressChange={setDeliveryAddress}
          onAddToBasket={handleAddToBasket}
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

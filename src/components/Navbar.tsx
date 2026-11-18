import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import {
  ChevronDown,
  Flame,
  Gift,
  Layers,
  Menu,
  Package,
  Search,
  ShoppingCart,
  Sparkles,
  X,
} from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import { siteContent } from '../data/siteContent';
import { AppPage, FragranceCategory, PriceRangeFilter, SeasonFilter } from '../types/fragrance';

interface NavbarProps {
  currentPage: AppPage;
  activeCategory: FragranceCategory | 'All';
  onlySpecials?: boolean;
  onlyUnboxed?: boolean;
  basketCount: number;
  onNavigate: (
    page: AppPage,
    options?: {
      category?: FragranceCategory | 'All';
      priceRange?: PriceRangeFilter;
      season?: SeasonFilter;
      onlySpecials?: boolean;
      onlyUnboxed?: boolean;
    }
  ) => void;
  onOpenSearch: () => void;
  onOpenBasket: () => void;
}

type DesktopDropdownId = 'shop' | 'explore' | null;

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  activeCategory,
  onlySpecials = false,
  onlyUnboxed = false,
  basketCount,
  onNavigate,
  onOpenSearch,
  onOpenBasket,
}) => {
  const { campaign, perfumes } = useStore();
  const [showAnnouncement, setShowAnnouncement] = useState(siteContent.announcementBar.enabled);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DesktopDropdownId>(null);
  const navContainerRef = useRef<HTMLDivElement | null>(null);
  const hoverCloseTimer = useRef<number | null>(null);

  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 240,
    damping: 32,
    restDelta: 0.001,
  });

  const hasSpecialItems = perfumes.some((p) => Boolean(p.onSpecial));
  const showSpecialsNav = campaign.enabled && hasSpecialItems;

  const announcementText =
    campaign.enabled && campaign.announcementText.trim().length > 0
      ? campaign.announcementText
      : siteContent.announcementBar.text;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const navigateClean = (
    page: AppPage,
    options?: {
      category?: FragranceCategory | 'All';
      onlySpecials?: boolean;
      onlyUnboxed?: boolean;
    }
  ) => {
    onNavigate(page, {
      category: options?.category,
      priceRange: 'all',
      season: 'all',
      onlySpecials: options?.onlySpecials ?? false,
      onlyUnboxed: options?.onlyUnboxed ?? false,
    });
    setOpenDropdown(null);
    setMobileMenuOpen(false);
  };

  const shopMenuItems: {
    label: string;
    subtitle: string;
    category: FragranceCategory | 'All';
    onlySpecials?: boolean;
    onlyUnboxed?: boolean;
    accent?: boolean;
  }[] = [
    {
      label: 'All Fragrances',
      subtitle: 'Complete Arabian bottles & decants collection',
      category: 'All',
    },
    {
      label: "Men's Collection",
      subtitle: 'Ouds, warm spices, leather & woods',
      category: 'Men',
    },
    {
      label: "Women's Collection",
      subtitle: 'Rose, vanilla, white musk & praline',
      category: 'Women',
    },
    {
      label: 'Unisex Signatures',
      subtitle: 'Rich saffron, amber & shared extraits',
      category: 'Unisex',
    },
    {
      label: 'Unboxed Original Bottles',
      subtitle: 'Authentic flacons · No outer box savings',
      category: 'All',
      onlyUnboxed: true,
    },
    ...(showSpecialsNav
      ? [
          {
            label: campaign.badgeText || 'Seasonal Specials',
            subtitle: 'Limited-time price reductions',
            category: 'All' as const,
            onlySpecials: true,
            accent: true,
          },
        ]
      : []),
  ];

  const experienceMenuItems: {
    label: string;
    subtitle: string;
    page: AppPage;
    icon: typeof Sparkles;
  }[] = [
    {
      label: 'Discover Decants & 5ml Weekly',
      subtitle: '5ml, 10ml & 22ml travel vials + Weekly E50/E100 Special',
      page: 'decants',
      icon: Sparkles,
    },
    {
      label: 'Combo Deals & Layering Ideas',
      subtitle: 'Multi-bottle bundle prices & scent pairing rituals',
      page: 'combos',
      icon: Layers,
    },
  ];

  const isShopMenuItemActive = (item: (typeof shopMenuItems)[number]) => {
    if (currentPage !== 'shop') return false;
    if (item.onlySpecials) return onlySpecials;
    if (item.onlyUnboxed) return onlyUnboxed;
    return !onlySpecials && !onlyUnboxed && activeCategory === item.category;
  };

  const handleDropdownEnter = (id: DesktopDropdownId) => {
    if (hoverCloseTimer.current) {
      window.clearTimeout(hoverCloseTimer.current);
      hoverCloseTimer.current = null;
    }
    setOpenDropdown(id);
  };

  const handleDropdownLeave = () => {
    hoverCloseTimer.current = window.setTimeout(() => {
      setOpenDropdown(null);
    }, 140);
  };

  const isShopActive = currentPage === 'shop';
  const isExploreActive = currentPage === 'combos' || currentPage === 'decants';

  return (
    <div className="sticky top-0 z-40 w-full" ref={navContainerRef}>
      <AnimatePresence initial={false}>
        {showAnnouncement && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#0A0A0A] text-white border-b border-white/15 overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between gap-4 text-[11px] sm:text-xs tracking-wide">
              <span className="hidden sm:inline-block text-white/70 whitespace-nowrap shrink-0 uppercase tracking-widest text-[10px]">
                {campaign.enabled ? campaign.badgeText : 'Eswatini'}
              </span>
              <p className="truncate text-center flex-1 text-white/90">
                {announcementText}
              </p>
              <button
                type="button"
                onClick={() => setShowAnnouncement(false)}
                aria-label="Dismiss announcement"
                className="text-white/60 hover:text-white transition-colors p-1 shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="relative bg-white/95 backdrop-blur-md border-b border-[#E5E5E5]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 lg:h-[72px] flex items-center justify-between gap-4 lg:gap-8">
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="p-2 -ml-2 rounded-full text-[#0A0A0A] hover:bg-[#F4F4F5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => navigateClean('home')}
            className="inline-flex items-center gap-2.5 text-lg sm:text-xl font-bold tracking-[0.14em] text-[#0A0A0A] hover:opacity-80 transition-opacity whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] rounded-lg px-1"
          >
            <span className="w-9 h-9 rounded-xl bg-black overflow-hidden shrink-0 inline-flex items-center justify-center border border-[#0A0A0A]">
              <img
                src="/assets/aistudio/aurahut_logo_a0bd1434.jpg"
                alt=""
                aria-hidden="true"
                className="w-full h-full object-cover scale-[1.68]"
              />
            </span>
            <span>{siteConfig.brandName}</span>
          </motion.button>

          {/* Clean 6-Item Primary Desktop Navigation with Dropdown Menus */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center justify-center gap-5 xl:gap-7"
          >
            {/* 1. Home */}
            <button
              type="button"
              onClick={() => navigateClean('home')}
              className={`relative py-1.5 text-[13px] tracking-wide whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] ${
                currentPage === 'home'
                  ? 'text-[#0A0A0A] font-semibold'
                  : 'text-[#525252] hover:text-[#0A0A0A] font-medium'
              }`}
            >
              Home
              {currentPage === 'home' && (
                <motion.span
                  layoutId="nav-underline"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 right-0 -bottom-0.5 h-[1.5px] bg-[#0A0A0A]"
                />
              )}
            </button>

            {/* 2. Shop Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => handleDropdownEnter('shop')}
              onMouseLeave={handleDropdownLeave}
            >
              <button
                type="button"
                aria-expanded={openDropdown === 'shop'}
                aria-haspopup="menu"
                onClick={() =>
                  setOpenDropdown((prev) => (prev === 'shop' ? null : 'shop'))
                }
                className={`relative py-1.5 text-[13px] tracking-wide whitespace-nowrap shrink-0 inline-flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] ${
                  isShopActive || openDropdown === 'shop'
                    ? 'text-[#0A0A0A] font-semibold'
                    : 'text-[#525252] hover:text-[#0A0A0A] font-medium'
                }`}
              >
                <span>Shop</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    openDropdown === 'shop' ? 'rotate-180' : ''
                  }`}
                />
                {isShopActive && (
                  <motion.span
                    layoutId="nav-underline"
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-0 right-0 -bottom-0.5 h-[1.5px] bg-[#0A0A0A]"
                  />
                )}
              </button>

              <AnimatePresence>
                {openDropdown === 'shop' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    role="menu"
                    className="absolute left-0 top-full pt-2.5 z-50 w-72"
                  >
                    <div className="bg-white border border-[#E5E5E5] rounded-2xl shadow-xl p-2 space-y-1">
                      {shopMenuItems.map((item) => {
                        const active = isShopMenuItemActive(item);
                        return (
                          <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            onClick={() =>
                              navigateClean('shop', {
                                category: item.category,
                                onlySpecials: Boolean(item.onlySpecials),
                                onlyUnboxed: Boolean(item.onlyUnboxed),
                              })
                            }
                            className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-colors flex items-start justify-between gap-2.5 ${
                              active
                                ? 'bg-[#0A0A0A] text-white'
                                : 'hover:bg-[#F6F6F7] text-[#0A0A0A]'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 text-xs font-semibold">
                                {item.onlyUnboxed && (
                                  <Package
                                    className={`w-3.5 h-3.5 shrink-0 ${
                                      active ? 'text-[#FACC15]' : 'text-[#0A0A0A]'
                                    }`}
                                  />
                                )}
                                {item.accent && (
                                  <Flame className="w-3.5 h-3.5 shrink-0 text-[#DC2626]" />
                                )}
                                <span>{item.label}</span>
                              </div>
                              <p
                                className={`text-[11px] mt-0.5 leading-snug ${
                                  active ? 'text-white/75' : 'text-[#666666]'
                                }`}
                              >
                                {item.subtitle}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 3. Gifts & Hampers */}
            <button
              type="button"
              onClick={() => navigateClean('gifts')}
              className={`relative py-1.5 text-[13px] tracking-wide whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] ${
                currentPage === 'gifts'
                  ? 'text-[#0A0A0A] font-semibold'
                  : 'text-[#525252] hover:text-[#0A0A0A] font-medium'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Gifts &amp; Hampers</span>
              {currentPage === 'gifts' && (
                <motion.span
                  layoutId="nav-underline"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 right-0 -bottom-0.5 h-[1.5px] bg-[#0A0A0A]"
                />
              )}
            </button>

            {/* 4. Decants & Combos Dropdown */}
            <div
              className="relative"
              onMouseEnter={() => handleDropdownEnter('explore')}
              onMouseLeave={handleDropdownLeave}
            >
              <button
                type="button"
                aria-expanded={openDropdown === 'explore'}
                aria-haspopup="menu"
                onClick={() =>
                  setOpenDropdown((prev) => (prev === 'explore' ? null : 'explore'))
                }
                className={`relative py-1.5 text-[13px] tracking-wide whitespace-nowrap shrink-0 inline-flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] ${
                  isExploreActive || openDropdown === 'explore'
                    ? 'text-[#0A0A0A] font-semibold'
                    : 'text-[#525252] hover:text-[#0A0A0A] font-medium'
                }`}
              >
                <span>Decants &amp; Combos</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    openDropdown === 'explore' ? 'rotate-180' : ''
                  }`}
                />
                {isExploreActive && (
                  <motion.span
                    layoutId="nav-underline"
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute left-0 right-0 -bottom-0.5 h-[1.5px] bg-[#0A0A0A]"
                  />
                )}
              </button>

              <AnimatePresence>
                {openDropdown === 'explore' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    role="menu"
                    className="absolute left-0 top-full pt-2.5 z-50 w-80"
                  >
                    <div className="bg-white border border-[#E5E5E5] rounded-2xl shadow-xl p-2 space-y-1">
                      {experienceMenuItems.map((item) => {
                        const Icon = item.icon;
                        const active = currentPage === item.page;
                        return (
                          <button
                            key={item.page}
                            type="button"
                            role="menuitem"
                            onClick={() => navigateClean(item.page)}
                            className={`w-full text-left px-3.5 py-3 rounded-xl transition-colors flex items-start gap-3 ${
                              active
                                ? 'bg-[#0A0A0A] text-white'
                                : 'hover:bg-[#F6F6F7] text-[#0A0A0A]'
                            }`}
                          >
                            <Icon
                              className={`w-4 h-4 shrink-0 mt-0.5 ${
                                active ? 'text-[#FACC15]' : 'text-[#0A0A0A]'
                              }`}
                            />
                            <div className="min-w-0">
                              <span className="block text-xs font-semibold">
                                {item.label}
                              </span>
                              <p
                                className={`text-[11px] mt-0.5 leading-snug ${
                                  active ? 'text-white/75' : 'text-[#666666]'
                                }`}
                              >
                                {item.subtitle}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 5. Our Stores */}
            <button
              type="button"
              onClick={() => navigateClean('stores')}
              className={`relative py-1.5 text-[13px] tracking-wide whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] ${
                currentPage === 'stores'
                  ? 'text-[#0A0A0A] font-semibold'
                  : 'text-[#525252] hover:text-[#0A0A0A] font-medium'
              }`}
            >
              Our Stores
              {currentPage === 'stores' && (
                <motion.span
                  layoutId="nav-underline"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 right-0 -bottom-0.5 h-[1.5px] bg-[#0A0A0A]"
                />
              )}
            </button>

            {/* 6. About Us */}
            <button
              type="button"
              onClick={() => navigateClean('about')}
              className={`relative py-1.5 text-[13px] tracking-wide whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] ${
                currentPage === 'about'
                  ? 'text-[#0A0A0A] font-semibold'
                  : 'text-[#525252] hover:text-[#0A0A0A] font-medium'
              }`}
            >
              About Us
              {currentPage === 'about' && (
                <motion.span
                  layoutId="nav-underline"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute left-0 right-0 -bottom-0.5 h-[1.5px] bg-[#0A0A0A]"
                />
              )}
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.93 }}
              onClick={onOpenSearch}
              aria-label="Search fragrances"
              className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#0A0A0A] hover:bg-[#F4F4F5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]"
            >
              <Search className="w-[18px] h-[18px]" />
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.93 }}
              onClick={onOpenBasket}
              aria-label={`Open shopping cart (${basketCount} items)`}
              className="relative min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#0A0A0A] hover:bg-[#F4F4F5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]"
            >
              <ShoppingCart className="w-[18px] h-[18px]" aria-hidden="true" />
              {basketCount > 0 && (
                <motion.span
                  key={basketCount}
                  initial={{ scale: 0.75 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-0.5 right-0.5 inline-flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-semibold tabular-nums bg-[#0A0A0A] text-white leading-none"
                >
                  {basketCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>

        <motion.div
          aria-hidden="true"
          style={{ scaleX: smoothProgress }}
          className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#0A0A0A] origin-left pointer-events-none"
        />
      </header>

      {/* Organized Sectioned Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              aria-label="Mobile Navigation"
              className="fixed inset-y-0 left-0 z-50 w-[84%] max-w-sm bg-white text-[#0A0A0A] rounded-r-2xl shadow-2xl flex flex-col overflow-hidden lg:hidden"
            >
              <div className="flex items-center justify-between px-6 h-16 border-b border-[#E5E5E5]">
                <span className="inline-flex items-center gap-2.5 text-lg font-bold tracking-[0.14em]">
                  <span className="w-8 h-8 rounded-lg bg-black overflow-hidden shrink-0 inline-flex items-center justify-center">
                    <img
                      src="/assets/aistudio/aurahut_logo_a0bd1434.jpg"
                      alt=""
                      aria-hidden="true"
                      className="w-full h-full object-cover scale-[1.68]"
                    />
                  </span>
                  <span>{siteConfig.brandName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[#0A0A0A] hover:bg-[#F4F4F5]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-6">
                {/* Group 1: Shop Collections */}
                <div className="space-y-1">
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#737373]">
                    Shop Fragrances
                  </p>
                  {shopMenuItems.map((item) => {
                    const active = isShopMenuItemActive(item);
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() =>
                          navigateClean('shop', {
                            category: item.category,
                            onlySpecials: Boolean(item.onlySpecials),
                            onlyUnboxed: Boolean(item.onlyUnboxed),
                          })
                        }
                        className={`w-full text-left py-2.5 px-3.5 rounded-xl flex items-center justify-between text-sm transition-colors ${
                          active
                            ? 'bg-[#0A0A0A] text-white font-semibold'
                            : 'text-[#404040] hover:bg-[#F4F4F5] hover:text-[#0A0A0A] font-medium'
                        }`}
                      >
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Group 2: Hampers, Decants & Combos */}
                <div className="space-y-1 border-t border-[#ECECEE] pt-4">
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#737373]">
                    Gifting &amp; Experiences
                  </p>
                  <button
                    type="button"
                    onClick={() => navigateClean('gifts')}
                    className={`w-full text-left py-2.5 px-3.5 rounded-xl flex items-center gap-2 text-sm transition-colors ${
                      currentPage === 'gifts'
                        ? 'bg-[#0A0A0A] text-white font-semibold'
                        : 'text-[#404040] hover:bg-[#F4F4F5] hover:text-[#0A0A0A] font-medium'
                    }`}
                  >
                    <Gift className="w-4 h-4 shrink-0" />
                    <span>Gifts &amp; Hampers</span>
                  </button>
                  {experienceMenuItems.map((item) => {
                    const Icon = item.icon;
                    const active = currentPage === item.page;
                    return (
                      <button
                        key={item.page}
                        type="button"
                        onClick={() => navigateClean(item.page)}
                        className={`w-full text-left py-2.5 px-3.5 rounded-xl flex items-center gap-2 text-sm transition-colors ${
                          active
                            ? 'bg-[#0A0A0A] text-white font-semibold'
                            : 'text-[#404040] hover:bg-[#F4F4F5] hover:text-[#0A0A0A] font-medium'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Group 3: The House */}
                <div className="space-y-1 border-t border-[#ECECEE] pt-4">
                  <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#737373]">
                    The House
                  </p>
                  {[
                    { label: 'Home', page: 'home' as AppPage },
                    { label: 'Our Stores (Manzini & Mbabane)', page: 'stores' as AppPage },
                    { label: 'About AuraHut Co.', page: 'about' as AppPage },
                  ].map((item) => {
                    const active = currentPage === item.page;
                    return (
                      <button
                        key={item.page}
                        type="button"
                        onClick={() => navigateClean(item.page)}
                        className={`w-full text-left py-2.5 px-3.5 rounded-xl text-sm transition-colors ${
                          active
                            ? 'bg-[#0A0A0A] text-white font-semibold'
                            : 'text-[#404040] hover:bg-[#F4F4F5] hover:text-[#0A0A0A] font-medium'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 border-t border-[#E5E5E5] bg-[#F6F6F7] space-y-3">
                <p className="text-xs text-[#525252] leading-relaxed">
                  {siteConfig.tagline} Serving Manzini &amp; Mbabane, Eswatini.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenBasket();
                  }}
                  className="w-full py-3 px-4 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors flex items-center justify-center gap-2 text-xs font-semibold tracking-wider uppercase"
                >
                  <ShoppingCart className="w-4 h-4 text-white" />
                  <span>View Cart ({basketCount})</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

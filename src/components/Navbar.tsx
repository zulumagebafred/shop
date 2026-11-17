import React, { useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { Menu, Search, ShoppingCart, X } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import { siteContent } from '../data/siteContent';
import { AppPage, FragranceCategory, PriceRangeFilter, SeasonFilter } from '../types/fragrance';

interface NavbarProps {
  currentPage: AppPage;
  activeCategory: FragranceCategory | 'All';
  onlySpecials?: boolean;
  basketCount: number;
  onNavigate: (
    page: AppPage,
    options?: {
      category?: FragranceCategory | 'All';
      priceRange?: PriceRangeFilter;
      season?: SeasonFilter;
      onlySpecials?: boolean;
    }
  ) => void;
  onOpenSearch: () => void;
  onOpenBasket: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  activeCategory,
  onlySpecials = false,
  basketCount,
  onNavigate,
  onOpenSearch,
  onOpenBasket,
}) => {
  const { campaign, perfumes } = useStore();
  const [showAnnouncement, setShowAnnouncement] = useState(siteContent.announcementBar.enabled);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const navItems: {
    label: string;
    page: AppPage;
    category?: FragranceCategory | 'All';
    onlySpecials?: boolean;
  }[] = [
    { label: 'Home', page: 'home' },
    { label: 'Shop', page: 'shop', category: 'All', onlySpecials: false },
    { label: 'Men', page: 'shop', category: 'Men', onlySpecials: false },
    { label: 'Women', page: 'shop', category: 'Women', onlySpecials: false },
    { label: 'Unisex', page: 'shop', category: 'Unisex', onlySpecials: false },
    ...(showSpecialsNav
      ? [
          {
            label: campaign.badgeText || 'Specials',
            page: 'shop' as AppPage,
            category: 'All' as const,
            onlySpecials: true,
          },
        ]
      : []),
    { label: 'Combo / Layering', page: 'combos' },
    { label: 'Discover Decants', page: 'decants' },
    { label: 'Our Stores', page: 'stores' },
    { label: 'About Us', page: 'about' },
  ];

  const isItemActive = (item: (typeof navItems)[number]) => {
    if (item.page === 'shop') {
      if (item.onlySpecials) {
        return currentPage === 'shop' && onlySpecials;
      }
      return (
        currentPage === 'shop' &&
        !onlySpecials &&
        activeCategory === (item.category ?? 'All')
      );
    }
    return currentPage === item.page;
  };

  const handleNavClick = (item: (typeof navItems)[number]) => {
    onNavigate(item.page, {
      category: item.category,
      priceRange: 'all',
      season: 'all',
      onlySpecials: item.onlySpecials ?? false,
    });
    setMobileMenuOpen(false);
  };

  return (
    <div className="sticky top-0 z-40 w-full">
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
            onClick={() => onNavigate('home')}
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

          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center justify-center gap-3.5 xl:gap-5"
          >
            {navItems.map((item) => {
              const active = isItemActive(item);
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNavClick(item)}
                  className={`relative py-1 text-[12.5px] xl:text-[13px] tracking-wide whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] ${
                    active
                      ? 'text-[#0A0A0A] font-semibold'
                      : 'text-[#525252] hover:text-[#0A0A0A] font-medium'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="nav-underline"
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute left-0 right-0 -bottom-0.5 h-[1.5px] bg-[#0A0A0A]"
                    />
                  )}
                </button>
              );
            })}
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

              <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-1">
                {navItems.map((item) => {
                  const active = isItemActive(item);
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleNavClick(item)}
                      className={`w-full text-left py-3 px-4 rounded-xl flex items-center justify-between text-sm transition-colors ${
                        active
                          ? 'bg-[#0A0A0A] text-white font-semibold'
                          : 'text-[#525252] hover:bg-[#F4F4F5] hover:text-[#0A0A0A] font-medium'
                      }`}
                    >
                      <span>{item.label}</span>
                    </button>
                  );
                })}
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

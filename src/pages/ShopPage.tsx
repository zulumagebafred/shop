import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Filter, Flame, Package, Search, X } from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { useStore } from '../context/StoreContext';
import {
  featuredPerfumeHouses,
  getExtraCatalogueBrands,
  matchesHouseBrand,
} from '../data/catalogue';
import {
  getProductPriceSummary,
  matchesPriceRange,
} from '../utils/pricing';
import { SEASON_OPTIONS, getProductSeasons } from '../utils/seasons';
import {
  BottleSize,
  FragranceCategory,
  FragranceProduct,
  PriceRangeFilter,
  SeasonFilter,
} from '../types/fragrance';

interface ShopPageProps {
  selectedCategory: FragranceCategory | 'All';
  selectedBrand: string;
  selectedSize: BottleSize | 'All';
  selectedPriceRange: PriceRangeFilter;
  selectedSeason: SeasonFilter;
  searchQuery: string;
  onlyInStock: boolean;
  onlySpecials: boolean;
  onlyUnboxed: boolean;
  onCategoryChange: (cat: FragranceCategory | 'All') => void;
  onBrandChange: (brand: string) => void;
  onSizeChange: (size: BottleSize | 'All') => void;
  onPriceRangeChange: (range: PriceRangeFilter) => void;
  onSeasonChange: (season: SeasonFilter) => void;
  onSearchChange: (q: string) => void;
  onOnlyInStockChange: (val: boolean) => void;
  onOnlySpecialsChange: (val: boolean) => void;
  onOnlyUnboxedChange: (val: boolean) => void;
  onResetFilters: () => void;
  onSelectProduct: (product: FragranceProduct) => void;
  onQuickWhatsApp: (product: FragranceProduct) => void;
}

const PRICE_RANGE_OPTIONS: { id: PriceRangeFilter; label: string }[] = [
  { id: 'all', label: 'All Prices' },
  { id: 'under-300', label: 'Under E300' },
  { id: 'under-500', label: 'Under E500' },
  { id: 'under-800', label: 'Under E800' },
  { id: '800-plus', label: 'E800+' },
];

const SHOP_PAGE_SIZE = 24;

export const ShopPage: React.FC<ShopPageProps> = ({
  selectedCategory,
  selectedBrand,
  selectedSize,
  selectedPriceRange,
  selectedSeason,
  searchQuery,
  onlyInStock,
  onlySpecials,
  onlyUnboxed,
  onCategoryChange,
  onBrandChange,
  onSizeChange,
  onPriceRangeChange,
  onSeasonChange,
  onSearchChange,
  onOnlyInStockChange,
  onOnlySpecialsChange,
  onOnlyUnboxedChange,
  onResetFilters,
  onSelectProduct,
  onQuickWhatsApp,
}) => {
  const { perfumes, campaign } = useStore();
  const [sortBy, setSortBy] = useState<'featured' | 'price-asc' | 'price-desc'>('featured');
  const [visibleCount, setVisibleCount] = useState<number>(SHOP_PAGE_SIZE);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const extraBrands = useMemo(() => getExtraCatalogueBrands(perfumes), [perfumes]);
  const categories: (FragranceCategory | 'All')[] = ['All', 'Men', 'Women', 'Unisex'];
  const sizes: (BottleSize | 'All')[] = useMemo(() => {
    const sizeSet = new Set<string>();
    perfumes.forEach((p) => {
      p.sizes.forEach((s) => {
        if (s.available && s.size.trim()) {
          sizeSet.add(s.size.trim());
        }
      });
    });
    const sorted = Array.from(sizeSet).sort((a, b) => {
      const numA = Number.parseFloat(a.match(/\d+(?:\.\d+)?/)?.[0] ?? '9999');
      const numB = Number.parseFloat(b.match(/\d+(?:\.\d+)?/)?.[0] ?? '9999');
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });
    return ['All', ...sorted];
  }, [perfumes]);
  const availableCatalogCount = useMemo(
    () => perfumes.filter((p) => p.availability !== 'Out of Stock').length,
    [perfumes]
  );

  const specialsCount = useMemo(
    () =>
      perfumes.filter(
        (p) => Boolean(p.onSpecial) && p.availability !== 'Out of Stock'
      ).length,
    [perfumes]
  );

  const unboxedCount = useMemo(
    () =>
      perfumes.filter(
        (p) => Boolean(p.isUnboxed) && p.availability !== 'Out of Stock'
      ).length,
    [perfumes]
  );

  const isSearching = searchQuery.trim().length > 0;

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = perfumes.filter((product) => {
      // Hide out-of-stock perfumes during normal browsing; only reveal them when actively searched
      if (product.availability === 'Out of Stock' && (!q || onlyInStock)) {
        return false;
      }
      if (selectedCategory !== 'All' && product.category !== selectedCategory) {
        return false;
      }
      if (selectedBrand !== 'All' && !matchesHouseBrand(product, selectedBrand)) {
        return false;
      }
      if (selectedSize !== 'All') {
        const hasSize = product.sizes.some(
          (s) => s.size === selectedSize && s.available
        );
        if (!hasSize) return false;
      }
      if (!matchesPriceRange(product, selectedPriceRange)) {
        return false;
      }
      if (
        selectedSeason !== 'all' &&
        !getProductSeasons(product).includes(selectedSeason)
      ) {
        return false;
      }
      if (onlySpecials && (!product.onSpecial || product.availability === 'Out of Stock')) {
        return false;
      }
      if (onlyUnboxed && !product.isUnboxed) {
        return false;
      }
      if (q) {
        const notes = [...product.notes.top, ...product.notes.heart, ...product.notes.base]
          .join(' ')
          .toLowerCase();
        const matchesQuery =
          product.name.toLowerCase().includes(q) ||
          product.brand.toLowerCase().includes(q) ||
          product.category.toLowerCase().includes(q) ||
          product.description.toLowerCase().includes(q) ||
          notes.includes(q);
        if (!matchesQuery) return false;
      }
      return true;
    });

    if (sortBy === 'price-asc' || sortBy === 'price-desc') {
      return [...list].sort((a, b) => {
        const priceA = getProductPriceSummary(a).highestEffective;
        const priceB = getProductPriceSummary(b).highestEffective;
        if (priceA === null && priceB === null) return 0;
        if (priceA === null) return 1;
        if (priceB === null) return -1;
        return sortBy === 'price-asc' ? priceA - priceB : priceB - priceA;
      });
    }

    return list;
  }, [
    perfumes,
    selectedCategory,
    selectedBrand,
    selectedSize,
    selectedPriceRange,
    selectedSeason,
    searchQuery,
    onlyInStock,
    onlySpecials,
    onlyUnboxed,
    sortBy,
  ]);

  useEffect(() => {
    setVisibleCount(SHOP_PAGE_SIZE);
  }, [
    selectedCategory,
    selectedBrand,
    selectedSize,
    selectedPriceRange,
    selectedSeason,
    searchQuery,
    onlyInStock,
    onlySpecials,
    onlyUnboxed,
    sortBy,
  ]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount]
  );

  const hasMoreProducts = visibleCount < filteredProducts.length;

  useEffect(() => {
    if (!hasMoreProducts) return;
    const node = loadMoreTriggerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((prev) => Math.min(prev + SHOP_PAGE_SIZE, filteredProducts.length));
        }
      },
      { rootMargin: '400px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreProducts, filteredProducts.length]);

  const activeSeasonMeta = SEASON_OPTIONS.find((s) => s.id === selectedSeason);
  const activePriceMeta = PRICE_RANGE_OPTIONS.find((p) => p.id === selectedPriceRange);

  const hasActiveFilters =
    selectedCategory !== 'All' ||
    selectedBrand !== 'All' ||
    selectedSize !== 'All' ||
    selectedPriceRange !== 'all' ||
    selectedSeason !== 'all' ||
    searchQuery.trim() !== '' ||
    onlyInStock ||
    onlySpecials ||
    onlyUnboxed;

  const headingTitle = onlySpecials
    ? campaign.title || 'Fragrance Specials'
    : onlyUnboxed
    ? 'Unboxed Perfume Bottles'
    : activeSeasonMeta && selectedPriceRange !== 'all' && activePriceMeta
    ? `${activeSeasonMeta.title} · ${activePriceMeta.label}`
    : activeSeasonMeta
    ? activeSeasonMeta.title
    : selectedPriceRange !== 'all' && activePriceMeta
    ? `Fragrances ${activePriceMeta.label}`
    : selectedCategory === 'All'
    ? 'All Fragrances'
    : `${selectedCategory}'s Fragrances`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-14 space-y-6 sm:space-y-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 sm:gap-4 border-b border-[#E5E5E5] pb-5 sm:pb-8">
        <div className="space-y-1.5 sm:space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
            {onlySpecials
              ? campaign.badgeText || 'Special Offers'
              : onlyUnboxed
              ? 'Authentic Bottles · No Outer Retail Box'
              : activeSeasonMeta
              ? activeSeasonMeta.eyebrow
              : 'AuraHut Co. Catalogue'}
          </p>
          <h1 className="text-2xl sm:text-5xl font-bold text-[#0A0A0A]">
            {headingTitle}
          </h1>
          <p className="text-xs sm:text-sm text-[#525252] max-w-2xl">
            {onlySpecials && campaign.subtitle
              ? campaign.subtitle
              : onlyUnboxed
              ? 'Original Arabian perfume bottles without outer retail cardboard packaging — same genuine fragrance inside at everyday value.'
              : activeSeasonMeta
              ? `${activeSeasonMeta.scentCue} — crafted for ${activeSeasonMeta.shortLabel.toLowerCase()} wear.`
              : selectedPriceRange !== 'all' && activePriceMeta
              ? `Showing perfumes with an available decant or bottle option ${activePriceMeta.label.toLowerCase()}.`
              : 'Each listing displays the full-bottle price upfront, with travel decants inside.'}
          </p>
        </div>

        <span className="text-xs font-medium text-[#525252] tabular-nums whitespace-nowrap shrink-0">
          Showing {filteredProducts.length} of{' '}
          {isSearching ? perfumes.length : availableCatalogCount} listings
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Search Input */}
          <div className="lg:col-span-5 relative">
            <Search
              className="w-4 h-4 text-[#737373] absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search name, house, or scent note..."
              className="w-full pl-10 pr-9 py-2.5 bg-white border border-[#D4D4D4] rounded-xl text-sm text-[#0A0A0A] placeholder:text-[#737373] focus:outline-none focus:border-[#0A0A0A]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#0A0A0A]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Gender Category Segmented Control */}
          <div className="lg:col-span-4 flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onCategoryChange(cat)}
                  className={`relative px-4 py-2 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 overflow-hidden ${
                    active
                      ? 'text-white border-[#0A0A0A]'
                      : 'bg-white text-[#525252] border-[#D4D4D4] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="shop-cat-pill"
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 bg-[#0A0A0A] rounded-full"
                    />
                  )}
                  <span className="relative z-10">{cat}</span>
                </button>
              );
            })}
          </div>

          {/* Brand Select */}
          <div className="lg:col-span-3">
            <label htmlFor="brand-filter" className="sr-only">
              Filter by brand
            </label>
            <select
              id="brand-filter"
              value={selectedBrand}
              onChange={(e) => onBrandChange(e.target.value)}
              className="w-full py-2.5 px-3.5 bg-white border border-[#D4D4D4] rounded-xl text-xs font-medium text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
            >
              <option value="All">All Perfume Houses</option>
              <optgroup label="Featured 12 Perfume Houses">
                {featuredPerfumeHouses.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </optgroup>
              {extraBrands.length > 0 && (
                <optgroup label="Individual Lines & Labels">
                  {extraBrands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
        </div>

        {/* Price Range & Season Filter Row */}
        <div className="pt-4 border-t border-[#E5E5E5] grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#525252] mr-1">
              Price:
            </span>
            {PRICE_RANGE_OPTIONS.map((opt) => {
              const active = selectedPriceRange === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onPriceRangeChange(opt.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium tabular-nums border transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#0A0A0A] text-[#FACC15] border-[#0A0A0A] font-semibold'
                      : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#525252] mr-1">
              Season:
            </span>
            <button
              type="button"
              onClick={() => onSeasonChange('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                selectedSeason === 'all'
                  ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                  : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
              }`}
            >
              All Seasons
            </button>
            {SEASON_OPTIONS.map((s) => {
              const active = selectedSeason === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSeasonChange(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                      : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                  }`}
                >
                  {s.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Size Filter Row */}
        <div className="pt-4 border-t border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#525252] mr-1">
              <Filter className="w-3.5 h-3.5 text-[#0A0A0A]" />
              <span>Available Size:</span>
            </span>
            {sizes.map((size) => {
              const active = selectedSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onSizeChange(size)}
                  className={`relative px-3.5 py-1.5 rounded-full text-xs font-medium tabular-nums border transition-colors overflow-hidden ${
                    active
                      ? 'text-white border-[#0A0A0A]'
                      : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="shop-size-pill"
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 bg-[#0A0A0A] rounded-full"
                    />
                  )}
                  <span className="relative z-10">{size === 'All' ? 'All Sizes' : size}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onOnlyUnboxedChange(!onlyUnboxed)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                onlyUnboxed
                  ? 'bg-[#0A0A0A] text-[#FACC15] border-[#0A0A0A]'
                  : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Unboxed ({unboxedCount})</span>
            </button>

            {specialsCount > 0 && (
              <button
                type="button"
                onClick={() => onOnlySpecialsChange(!onlySpecials)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
                  onlySpecials
                    ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                    : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>
                  {campaign.enabled && campaign.badgeText
                    ? `${campaign.badgeText} (${specialsCount})`
                    : `Specials (${specialsCount})`}
                </span>
              </button>
            )}

            <select
              aria-label="Sort fragrances"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'featured' | 'price-asc' | 'price-desc')
              }
              className="py-1.5 px-3 bg-white border border-[#D4D4D4] rounded-full text-xs font-medium text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>

            {isSearching && (
              <label className="inline-flex items-center gap-2 text-xs text-[#404040] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => onOnlyInStockChange(e.target.checked)}
                  className="accent-[#0A0A0A] w-3.5 h-3.5"
                />
                <span>Available Only</span>
              </label>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="text-xs font-semibold text-[#0A0A0A] hover:opacity-65 underline underline-offset-4"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Results Grid */}
      <AnimatePresence mode="wait">
        {filteredProducts.length === 0 ? (
          <motion.div
            key="empty-state"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl py-16 px-6 text-center space-y-4"
          >
            <h2 className="text-2xl font-bold text-[#0A0A0A]">
              No Matching Fragrances Found
            </h2>
            <p className="text-sm text-[#525252] max-w-md mx-auto">
              Try clearing your search term or selecting a different size or fragrance category.
            </p>
            <button
              type="button"
              onClick={onResetFilters}
              className="px-6 py-2.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider"
            >
              Clear All Filters
            </button>
          </motion.div>
        ) : (
          <motion.div key="results-grid" className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
              {visibleProducts.map((product, idx) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  index={idx}
                  disableEntranceAnimation={idx >= 8}
                  imageLoading={idx < 6 ? 'eager' : 'lazy'}
                  fetchPriority={idx < 3 ? 'high' : 'auto'}
                  priceRange={selectedPriceRange}
                  onViewDetails={onSelectProduct}
                  onQuickWhatsApp={onQuickWhatsApp}
                />
              ))}
            </div>

            {hasMoreProducts && (
              <div
                ref={loadMoreTriggerRef}
                className="flex flex-col items-center justify-center gap-3 pt-2"
              >
                <p className="text-xs text-[#525252] tabular-nums">
                  Showing {visibleProducts.length} of {filteredProducts.length} fragrances
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((prev) =>
                      Math.min(prev + SHOP_PAGE_SIZE, filteredProducts.length)
                    )
                  }
                  className="px-6 py-2.5 rounded-full border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors text-xs font-semibold uppercase tracking-wider"
                >
                  Load More Fragrances
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

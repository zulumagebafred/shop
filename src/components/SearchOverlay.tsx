import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Search, X } from 'lucide-react';
import { formatPrice } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import { FragranceProduct } from '../types/fragrance';
import {
  getProductPriceSummary,
  parseVolumeMl,
} from '../utils/pricing';
import { sanitizeSearchQuery } from '../utils/sanitize';
import { ResilientImage } from './ResilientImage';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: FragranceProduct) => void;
  onViewAllResults: (query: string) => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
  onViewAllResults,
}) => {
  const { perfumes, ensureAllPerfumesLoaded } = useStore();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      void ensureAllPerfumesLoaded();
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      setQuery('');
    }
  }, [isOpen, ensureAllPerfumesLoaded]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const matches = useMemo(() => {
    const q = sanitizeSearchQuery(deferredQuery).trim().toLowerCase();
    if (!q) {
      return perfumes
        .filter((item) => item.availability !== 'Out of Stock')
        .slice(0, 4);
    }
    return perfumes.filter((item) => {
      if (
        item.name.toLowerCase().includes(q) ||
        item.brand.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      ) {
        return true;
      }
      const notesText = [...item.notes.top, ...item.notes.heart, ...item.notes.base]
        .join(' ')
        .toLowerCase();
      return notesText.includes(q);
    });
  }, [deferredQuery, perfumes]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs"
          />
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Search Arabian Fragrances"
            className="fixed inset-x-0 top-0 z-50 bg-white border-b border-[#E5E5E5] rounded-b-3xl shadow-2xl"
          >
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
              <div className="flex items-center gap-3 border-b border-[#0A0A0A]/25 pb-3">
                <Search className="w-5 h-5 text-[#0A0A0A] shrink-0" aria-hidden="true" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(sanitizeSearchQuery(e.target.value))}
                  placeholder="Search by perfume name, house (e.g. Lattafa, Armaf), note, or category..."
                  className="w-full bg-transparent text-[#0A0A0A] placeholder:text-[#737373] text-base sm:text-lg focus:outline-none"
                />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close search"
                  className="min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F4F4F5]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs uppercase tracking-wider text-[#525252]">
                  <span>
                    {query.trim()
                      ? `Matching Fragrances (${matches.length})`
                      : 'Curated Fragrances'}
                  </span>
                  {query.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        onViewAllResults(query);
                        onClose();
                      }}
                      className="text-[#0A0A0A] hover:opacity-70 font-semibold flex items-center gap-1"
                    >
                      <span>Open in Shop</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {matches.length === 0 ? (
                  <p className="py-6 text-sm text-[#525252]">
                    No fragrances matched “{query}”. Try searching by house name, Men, Women, Unisex, Kiddies, or open the full catalogue.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
                    {matches.slice(0, 24).map((item) => {
                      const { highestEffective, highestSize } = getProductPriceSummary(item);
                      const availableSizes = [...item.sizes]
                        .filter((s) => s.available && s.size.trim())
                        .sort((a, b) => parseVolumeMl(a.size) - parseVolumeMl(b.size))
                        .map((s) => s.size.trim());

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onSelectProduct(item);
                            onClose();
                          }}
                          className="flex items-center gap-4 p-3 rounded-2xl bg-[#F6F6F7] border border-[#E5E5E5] hover:border-[#0A0A0A] text-left transition-colors"
                        >
                          <div className="w-16 h-16 shrink-0 rounded-xl bg-white overflow-hidden">
                            <ResilientImage
                              src={item.image}
                              alt={item.name}
                              fallbackTitle={item.name}
                              loading="lazy"
                              variant="thumb"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] uppercase tracking-wider text-[#525252]">
                              {item.brand} · {item.category}
                              {item.availability === 'Out of Stock'
                                ? ' · Out of Stock'
                                : item.onSpecial
                                ? ' · Special'
                                : ''}
                            </p>
                            <p className="text-sm font-semibold text-[#0A0A0A] truncate">
                              {item.name}
                            </p>
                            <p className="text-xs font-medium text-[#0A0A0A] tabular-nums mt-0.5">
                              {highestEffective === null
                                ? 'Price on Request'
                                : highestSize
                                ? `${highestSize} · ${formatPrice(highestEffective)}`
                                : formatPrice(highestEffective)}
                            </p>
                            {availableSizes.length > 0 && (
                              <p className="text-[11px] text-[#737373] tabular-nums mt-0.5">
                                {availableSizes.join(' · ')}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    {matches.length > 24 && (
                      <button
                        type="button"
                        onClick={() => {
                          onViewAllResults(query);
                          onClose();
                        }}
                        className="sm:col-span-2 py-3 px-4 rounded-2xl border border-[#0A0A0A] text-xs font-semibold uppercase tracking-wider text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors"
                      >
                        View all {matches.length} matching fragrances in Shop →
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

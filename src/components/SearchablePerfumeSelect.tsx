import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { FragranceProduct } from '../types/fragrance';
import { ResilientImage } from './ResilientImage';

export interface SearchablePerfumeOption {
  product: FragranceProduct;
  detailLabel?: string;
  badgeText?: string;
}

interface SearchablePerfumeSelectProps {
  value: string;
  options: SearchablePerfumeOption[];
  onChange: (perfumeId: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
}

export const SearchablePerfumeSelect: React.FC<SearchablePerfumeSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Search & select perfume...',
  searchPlaceholder = 'Search perfume name, house, or category...',
  ariaLabel = 'Select perfume',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.product.id === value) ?? null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    return options.filter((opt) => {
      const haystack = `${opt.product.name} ${opt.product.brand} ${opt.product.category} ${
        opt.detailLabel ?? ''
      }`.toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 20);
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative w-full min-w-0">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={`w-full px-2.5 py-2 bg-white border rounded-xl text-left flex items-center justify-between gap-2.5 transition-colors focus:outline-none ${
          open
            ? 'border-[#0A0A0A] ring-2 ring-[#0A0A0A]/10'
            : 'border-[#D4D4D4] hover:border-[#0A0A0A]'
        }`}
      >
        {selectedOption ? (
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg bg-[#F6F6F7] border border-[#E5E5E5] overflow-hidden shrink-0">
              <ResilientImage
                src={selectedOption.product.image}
                alt={selectedOption.product.name}
                variant="thumb"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[#0A0A0A] truncate">
                {selectedOption.product.name}
              </p>
              <p className="text-[11px] text-[#525252] truncate">
                {selectedOption.product.brand} · {selectedOption.product.category}
                {selectedOption.detailLabel ? ` · ${selectedOption.detailLabel}` : ''}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-xs text-[#737373] truncate pl-1">{placeholder}</span>
        )}

        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#F6F6F7] border border-[#E5E5E5] text-[10px] font-semibold uppercase tracking-wider text-[#0A0A0A] shrink-0">
          <Search className="w-3 h-3" aria-hidden="true" />
          <span className="hidden sm:inline">{open ? 'Close' : 'Search'}</span>
          <ChevronDown
            className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </span>
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl border border-[#0A0A0A] bg-white shadow-xl overflow-hidden">
          <div className="p-2 border-b border-[#E5E5E5] bg-[#FAFAFA] flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#737373] shrink-0 ml-1" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredOptions.length > 0) {
                  e.preventDefault();
                  onChange(filteredOptions[0].product.id);
                  setQuery('');
                  setOpen(false);
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full min-w-0 bg-transparent text-xs text-[#0A0A0A] placeholder:text-[#737373] focus:outline-none py-1"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear perfume search"
                onClick={() => {
                  setQuery('');
                  searchInputRef.current?.focus();
                }}
                className="p-1 rounded-md text-[#737373] hover:text-[#0A0A0A]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="px-3 py-1.5 bg-[#F6F6F7] border-b border-[#ECECEE] flex items-center justify-between text-[10px] font-medium text-[#525252]">
            <span>
              {filteredOptions.length}{' '}
              {filteredOptions.length === 1 ? 'perfume matches' : 'perfumes match'}
            </span>
            <span>Tap to select</span>
          </div>

          {filteredOptions.length === 0 ? (
            <div className="py-6 px-4 text-center space-y-1.5">
              <p className="text-xs font-semibold text-[#0A0A0A]">No matching perfumes</p>
              <p className="text-[11px] text-[#666666]">
                Try searching a different perfume name, house, or category.
              </p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto divide-y divide-[#F0F0F0]">
              {filteredOptions.map((opt) => {
                const isSelected = opt.product.id === value;
                return (
                  <button
                    key={opt.product.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.product.id);
                      setQuery('');
                      setOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2.5 transition-colors ${
                      isSelected
                        ? 'bg-[#FEF9C3]/60'
                        : 'hover:bg-[#F6F6F7]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg bg-white border border-[#E5E5E5] overflow-hidden shrink-0">
                        <ResilientImage
                          src={opt.product.image}
                          alt={opt.product.name}
                          variant="thumb"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#0A0A0A] truncate">
                          {opt.product.name}
                        </p>
                        <p className="text-[10px] text-[#525252] truncate">
                          {opt.product.brand} · {opt.product.category}
                          {opt.detailLabel ? ` · ${opt.detailLabel}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badgeText && !isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-[#F4F4F5] border border-[#E5E5E5] text-[9px] font-semibold text-[#525252]">
                          {opt.badgeText}
                        </span>
                      )}
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-[#0A0A0A] text-[#FACC15] flex items-center justify-center">
                          <Check className="w-3 h-3" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

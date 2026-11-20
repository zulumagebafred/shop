import React from 'react';
import { Facebook, Instagram, MapPin, ShoppingCart } from 'lucide-react';
import { siteConfig } from '../config/siteConfig';
import { AppPage, FragranceCategory } from '../types/fragrance';

interface FooterProps {
  onNavigate: (
    page: AppPage,
    options?: { category?: FragranceCategory | 'All'; onlyUnboxed?: boolean }
  ) => void;
  onOpenBasket: () => void;
}

const TikTokIcon: React.FC<{ className?: string }> = ({ className = 'w-3.5 h-3.5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.34 0 .66.06.96.16V9.01a6.33 6.33 0 0 0-.96-.08A6.34 6.34 0 0 0 3 15.27 6.34 6.34 0 0 0 9.34 21.6a6.34 6.34 0 0 0 6.34-6.34V8.76a8.28 8.28 0 0 0 4.77 1.5V6.82a4.85 4.85 0 0 1-.86-.13Z" />
  </svg>
);

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenBasket }) => {
  return (
    <footer className="bg-[#0A0A0A] text-white border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
          <div className="space-y-4">
            <div className="w-36 h-24 overflow-hidden flex items-center justify-start -ml-2">
              <picture className="w-full h-full">
                <source srcSet="/assets/aistudio/aurahut_logo_a0bd1434.webp" type="image/webp" />
                <img
                  src="/assets/aistudio/aurahut_logo_a0bd1434.jpg"
                  alt={siteConfig.brandName}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-contain scale-[1.75] mix-blend-screen select-none"
                />
              </picture>
            </div>
            <p className="text-white/75 text-sm font-medium">
              {siteConfig.tagline}
            </p>
            
            <div className="pt-2 flex flex-wrap items-center gap-2">
              <a
                href={siteConfig.social.tiktokUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="AuraHut Co. on TikTok"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/25 hover:border-white text-xs text-white transition-colors"
              >
                <TikTokIcon className="w-3.5 h-3.5" />
                <span>TikTok</span>
              </a>
              <a
                href={siteConfig.social.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="AuraHut Co. on Instagram"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/25 hover:border-white text-xs text-white transition-colors"
              >
                <Instagram className="w-3.5 h-3.5" />
                <span>Instagram</span>
              </a>
              <a
                href={siteConfig.social.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="AuraHut Co. on Facebook"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/25 hover:border-white text-xs text-white transition-colors"
              >
                <Facebook className="w-3.5 h-3.5" />
                <span>Facebook</span>
              </a>
              <button
                type="button"
                onClick={onOpenBasket}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#0A0A0A] hover:bg-[#E5E5E5] text-xs font-semibold transition-colors"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>View Cart</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
              Fragrance Catalogue
            </h3>
            <ul className="space-y-2.5 text-sm text-white/80">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('shop', { category: 'All' })}
                  className="hover:text-white transition-colors"
                >
                  All Fragrances
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('shop', { category: 'Men' })}
                  className="hover:text-white transition-colors"
                >
                  Men&apos;s Fragrances
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('shop', { category: 'Women' })}
                  className="hover:text-white transition-colors"
                >
                  Women&apos;s Fragrances
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('shop', { category: 'Unisex' })}
                  className="hover:text-white transition-colors"
                >
                  Unisex Fragrances
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('gifts')}
                  className="hover:text-white transition-colors"
                >
                  Gift Hampers &amp; Sets
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate('shop', { category: 'All', onlyUnboxed: true })
                  }
                  className="hover:text-white transition-colors"
                >
                  Unboxed Bottles
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('combos')}
                  className="hover:text-white transition-colors"
                >
                  Combo Deals &amp; Layering Ideas
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('decants')}
                  className="hover:text-white transition-colors"
                >
                  Discover Decants (5ml – 100ml)
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
              The House
            </h3>
            <ul className="space-y-2.5 text-sm text-white/80">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="hover:text-white transition-colors"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('about')}
                  className="hover:text-white transition-colors"
                >
                  About AuraHut Co.
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('stores')}
                  className="hover:text-white transition-colors"
                >
                  Our Stores
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenBasket}
                  className="hover:text-white transition-colors"
                >
                  Shopping Cart
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
              Eswatini Stores
            </h3>
            <div className="space-y-4 text-xs text-white/75">
              {siteConfig.branches.map((branch) => (
                <div key={branch.id} className="space-y-1">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>{branch.name}</span>
                  </p>
                  <p className="leading-relaxed">{branch.address}</p>
                  <p className="text-white/55">{branch.openingHours.weekdays}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col items-center justify-center text-center gap-1.5 text-xs text-white/60">
          <p>
            © {new Date().getFullYear()} {siteConfig.brandName} — Eswatini. All rights reserved.{' '}
            <span className="hidden sm:inline text-white/35 mx-1.5" aria-hidden="true">
              ·
            </span>
            <span className="block sm:inline text-white/85 font-medium mt-1 sm:mt-0">
              Designed by Yandzile
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
};

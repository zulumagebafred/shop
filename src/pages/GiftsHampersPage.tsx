import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Check,
  ExternalLink,
  Gift,
  MessageCircle,
  Package,
  ShoppingCart,
  Sparkles,
} from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { formatPrice, siteConfig } from '../config/siteConfig';
import { useStore } from '../context/StoreContext';
import { AppPage, FragranceCategory, GiftHamper } from '../types/fragrance';
import { createWhatsAppUrl } from '../utils/whatsapp';

interface GiftsHampersPageProps {
  onAddHamperToBasket: (hamper: GiftHamper, customGiftNote?: string) => void;
  onNavigate: (
    page: AppPage,
    options?: {
      category?: FragranceCategory | 'All';
      onlyUnboxed?: boolean;
      onlySpecials?: boolean;
    }
  ) => void;
}

export const GiftsHampersPage: React.FC<GiftsHampersPageProps> = ({
  onAddHamperToBasket,
  onNavigate,
}) => {
  const {
    hampers,
    perfumes,
    usingSampleHampers,
    hampersLoading,
    ensureSecondaryLoaded,
    ensureAllPerfumesLoaded,
  } = useStore();
  const [selectedOccasion, setSelectedOccasion] = useState<string>('All');
  const [giftNotes, setGiftNotes] = useState<Record<string, string>>({});
  const [addedId, setAddedId] = useState<string | null>(null);

  useEffect(() => {
    void ensureSecondaryLoaded('hampers');
    void ensureAllPerfumesLoaded();
  }, [ensureSecondaryLoaded, ensureAllPerfumesLoaded]);

  const isPreviewTemplate = usingSampleHampers;

  const activeAvailableHampers = useMemo(
    () => hampers.filter((h) => h.active && h.availability !== 'Out of Stock'),
    [hampers]
  );

  const occasions = useMemo(() => {
    const set = new Set<string>();
    activeAvailableHampers.forEach((h) => {
      if (h.occasion.trim()) set.add(h.occasion.trim());
    });
    return ['All', ...Array.from(set)];
  }, [activeAvailableHampers]);

  const visibleHampers = useMemo(() => {
    if (selectedOccasion === 'All') return activeAvailableHampers;
    return activeAvailableHampers.filter((h) => h.occasion === selectedOccasion);
  }, [activeAvailableHampers, selectedOccasion]);

  const unboxedAvailableCount = useMemo(
    () => perfumes.filter((p) => Boolean(p.isUnboxed) && p.availability !== 'Out of Stock').length,
    [perfumes]
  );

  const handleAddHamper = (hamper: GiftHamper) => {
    if (isPreviewTemplate) return;
    const note = giftNotes[hamper.id]?.trim();
    onAddHamperToBasket(hamper, note || undefined);
    setAddedId(hamper.id);
    window.setTimeout(() => {
      setAddedId((prev) => (prev === hamper.id ? null : prev));
    }, 1800);
  };

  const customInquiryUrl = createWhatsAppUrl(
    [
      siteConfig.whatsapp.defaultGreeting,
      '',
      'I would like to request a Custom Gift Hamper.',
      'Occasion / Recipient:',
      'Preferred Budget (SZL):',
      'Preferred Scent Style / Bottles:',
    ].join('\n')
  );

  return (
    <div className="bg-white">
      {/* Editorial Hero */}
      <section className="bg-[#0A0A0A] text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-5">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FACC15]">
              <Gift className="w-3.5 h-3.5" />
              <span>
                {isPreviewTemplate
                  ? 'Coming Soon · Gifting Preview Template'
                  : 'Ready-to-Present Gifting · Eswatini'}
              </span>
            </span>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold leading-[1.06] text-white [text-wrap:balance]">
              Curated Perfume Hampers &amp; Gift Sets.
            </h1>

            <p className="text-sm sm:text-base text-white/75 leading-relaxed max-w-2xl">
              {isPreviewTemplate
                ? 'Our curated ready-to-ship hamper collection is launching soon. Below is a live preview template of how our ribbon-wrapped boxes, scent pairings, and handwritten gift cards will look — and you can already request a bespoke box on WhatsApp.'
                : 'Thoughtfully boxed fragrance gifts combining authentic Arabian perfume bottles, matching body mists, pocket decants, and handwritten greeting cards — prepared fresh at our Manzini & Mbabane stores or delivered nationwide.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              {customInquiryUrl && (
                <a
                  href={customInquiryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#FACC15] text-[#0A0A0A] hover:bg-[#FDE047] transition-colors text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Request a Bespoke Budget Hamper</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>
              )}

              <button
                type="button"
                onClick={() => onNavigate('shop', { category: 'All', onlyUnboxed: true })}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-white/25 text-white hover:bg-white/10 transition-colors text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
              >
                <Package className="w-4 h-4 text-[#FACC15]" />
                <span>
                  Shop Unboxed Bottles{unboxedAvailableCount > 0 ? ` (${unboxedAvailableCount})` : ''}
                </span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden border border-white/15 bg-[#141414]">
              <ResilientImage
                src="/assets/images/luxury_gift_hamper_1795005244668.jpg"
                alt="AuraHut Co. Luxury Perfume Gift Hamper"
                fallbackTitle="AuraHut Co. Gift Hampers"
                loading="eager"
                fetchPriority="high"
                className="w-full h-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent"
              />
              <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between gap-2 text-xs text-white/90">
                <span className="font-medium">Ribbon-Wrapped &amp; Handwritten Card</span>
                <span className="text-[#FACC15] font-semibold uppercase tracking-wider text-[11px]">
                  {isPreviewTemplate ? 'Coming Soon · Preview' : 'Same-Day Ready'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Hampers Catalogue */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-8">
        {isPreviewTemplate && (
          <div className="bg-[#FEF9C3] border border-[#FDE047] rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0A0A0A]">
                Coming Soon · Box Layout Template
              </p>
              <p className="text-xs sm:text-sm text-[#404040] leading-relaxed">
                This showcase previews our upcoming hampers, item checklists, and gift-card personalization. Ready-made boxes will go live for instant cart checkout soon.
              </p>
            </div>
            {customInquiryUrl && (
              <a
                href={customInquiryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-3.5 h-3.5 text-[#FACC15]" />
                <span>Custom Box Inquiry</span>
              </a>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#E5E5E5] pb-6">
          <div className="space-y-1.5">
            <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
              {isPreviewTemplate ? 'Upcoming Collection Preview' : 'Occasion-Curated Boxes'}
            </p>
            <h2 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A]">
              {isPreviewTemplate
                ? 'Preview Upcoming Gift Hampers'
                : 'Explore Ready-to-Gift Hampers'}
            </h2>
          </div>

          {/* Occasion Filter Buttons */}
          {occasions.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {occasions.map((occ) => {
                const active = selectedOccasion === occ;
                return (
                  <button
                    key={occ}
                    type="button"
                    onClick={() => setSelectedOccasion(occ)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                        : 'bg-white text-[#525252] border-[#D4D4D4] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
                    }`}
                  >
                    {occ === 'All' ? 'All Occasions' : occ}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {hampersLoading && hampers.length === 0 ? (
          <div className="py-12 text-center text-xs uppercase tracking-[0.2em] text-[#666666]">
            Loading Gift Hampers...
          </div>
        ) : visibleHampers.length === 0 ? (
          <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-12 text-center space-y-4">
            <Gift className="w-8 h-8 text-[#0A0A0A] mx-auto" />
            <h3 className="text-xl font-bold text-[#0A0A0A]">
              Custom Gift Hampers Available to Order
            </h3>
            <p className="text-sm text-[#525252] max-w-md mx-auto">
              Our store team can box any bottle, decant flight, body mist, or unboxed gem to suit your recipient and budget.
            </p>
            {customInquiryUrl && (
              <a
                href={customInquiryUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Order Custom Hamper on WhatsApp</span>
              </a>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {visibleHampers.map((hamper, idx) => {
              const savings = Math.max(0, hamper.regularPrice - hamper.hamperPrice);
              const isAdded = addedId === hamper.id;
              const hamperDirectUrl = createWhatsAppUrl(
                [
                  siteConfig.whatsapp.defaultGreeting,
                  '',
                  isPreviewTemplate
                    ? `I saw the "${hamper.title}" hamper preview and would like to request a similar custom box.`
                    : `I'd like to order the Gift Hamper: ${hamper.title}`,
                  `• Occasion: ${hamper.occasion}`,
                  `• Estimated Guide Price: ${formatPrice(hamper.hamperPrice)}`,
                  giftNotes[hamper.id]?.trim()
                    ? `• Personal Gift Card Message: "${giftNotes[hamper.id].trim()}"`
                    : '• Gift Card: Standard AuraHut Co. card',
                  '',
                  'Please confirm availability and custom box options.',
                ].join('\n')
              );

              return (
                <motion.article
                  key={hamper.id}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.08 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.04, 0.14) }}
                  className="bg-white border border-[#E5E5E5] hover:border-[#0A0A0A] rounded-3xl p-5 sm:p-6 flex flex-col justify-between gap-5 transition-colors shadow-[0_6px_24px_-16px_rgba(0,0,0,0.08)]"
                >
                  <div className="space-y-5">
                    {/* Top Row: Image + Meta */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-start">
                      <div className="sm:col-span-5 relative aspect-[4/3] rounded-2xl overflow-hidden bg-[#F6F6F7] border border-[#EFEFEF]">
                        <ResilientImage
                          src={hamper.image}
                          alt={hamper.title}
                          fallbackTitle={hamper.title}
                          className="w-full h-full object-cover"
                        />
                        {isPreviewTemplate ? (
                          <span className="absolute top-2.5 left-2.5 bg-[#0A0A0A]/90 text-[#FACC15] px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xs">
                            Coming Soon
                          </span>
                        ) : (
                          savings > 0 && (
                            <span className="absolute top-2.5 left-2.5 bg-[#FACC15] text-[#0A0A0A] px-2.5 py-1 rounded-full text-[11px] font-bold tabular-nums shadow-xs">
                              Save {formatPrice(savings)}
                            </span>
                          )
                        )}
                      </div>

                      <div className="sm:col-span-7 space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-[#525252] font-medium">
                          <span className="text-[#0A0A0A] font-semibold">{hamper.occasion}</span>
                          <span aria-hidden="true">·</span>
                          <span>{hamper.itemsIncluded.length} items included</span>
                          {isPreviewTemplate ? (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#0A0A0A] font-semibold">Preview Template</span>
                            </>
                          ) : (
                            hamper.availability !== 'In Stock' && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#0A0A0A]">{hamper.availability}</span>
                              </>
                            )
                          )}
                        </div>

                        <h3 className="text-xl sm:text-2xl font-bold text-[#0A0A0A] leading-snug">
                          {hamper.title}
                        </h3>

                        {hamper.subtitle && (
                          <p className="text-xs sm:text-sm text-[#525252] leading-relaxed">
                            {hamper.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* What's Inside Checklist */}
                    <div className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#0A0A0A]">
                          What&apos;s Inside This Box
                        </span>
                        {hamper.giftWrapNote && (
                          <span className="text-[11px] text-[#525252]">
                            {hamper.giftWrapNote}
                          </span>
                        )}
                      </div>
                      <ul className="space-y-1.5">
                        {hamper.itemsIncluded.map((item, i) => (
                          <li
                            key={`${hamper.id}-item-${i}`}
                            className="flex items-start gap-2 text-xs text-[#262626]"
                          >
                            <Check className="w-3.5 h-3.5 text-[#0A0A0A] shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Optional Gift Card Note */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`gift-note-${hamper.id}`}
                        className="block text-[11px] font-semibold uppercase tracking-wider text-[#525252]"
                      >
                        {isPreviewTemplate
                          ? 'Preview Gift Card Message (Demo)'
                          : 'Optional Gift Card Message'}
                      </label>
                      <input
                        id={`gift-note-${hamper.id}`}
                        type="text"
                        maxLength={120}
                        value={giftNotes[hamper.id] ?? ''}
                        onChange={(e) =>
                          setGiftNotes((prev) => ({
                            ...prev,
                            [hamper.id]: e.target.value,
                          }))
                        }
                        placeholder="e.g. Happy Birthday Sis — Wishing you the sweetest year!"
                        className="w-full px-3.5 py-2 bg-white border border-[#D4D4D4] rounded-xl text-xs text-[#0A0A0A] placeholder:text-[#888888] focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                  </div>

                  {/* Price & CTAs */}
                  <div className="pt-4 border-t border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      {isPreviewTemplate && (
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
                          Estimated Box Guide
                        </span>
                      )}
                      <div className="flex items-baseline gap-2.5">
                        <span className="text-2xl font-bold text-[#0A0A0A] tabular-nums">
                          {formatPrice(hamper.hamperPrice)}
                        </span>
                        {savings > 0 && (
                          <span className="text-xs text-[#737373] line-through tabular-nums">
                            {formatPrice(hamper.regularPrice)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isPreviewTemplate ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-4 py-2.5 rounded-full bg-[#F4F4F5] border border-[#E5E5E5] text-[#525252] text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                          Coming Soon
                        </span>
                        {hamperDirectUrl && (
                          <a
                            href={hamperDirectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5 text-[#FACC15]" />
                            <span>Request Similar Box</span>
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleAddHamper(hamper)}
                          className="flex-1 sm:flex-none px-5 py-2.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added to Cart</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>Add Hamper</span>
                            </>
                          )}
                        </motion.button>

                        {hamperDirectUrl && (
                          <a
                            href={hamperDirectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none px-4 py-2.5 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] hover:bg-[#F6F6F7] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                          >
                            <span>WhatsApp</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}

        {/* Bottom Unboxed Perfumes Cross-Sell Banner */}
        <div className="bg-[#0A0A0A] text-white rounded-3xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-2.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#FACC15]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personal Wear Value</span>
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold text-white">
              Buying a Signature Scent for Yourself? Explore Unboxed Bottles.
            </h3>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed max-w-2xl">
              Save on everyday full bottles with our authentic unboxed original flacons (same genuine house juice and atomiser, simply without outer cardboard packaging).
            </p>
          </div>
          <div className="lg:col-span-4 flex lg:justify-end">
            <button
              type="button"
              onClick={() => onNavigate('shop', { category: 'All', onlyUnboxed: true })}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#0A0A0A] hover:bg-[#FACC15] transition-colors text-xs font-bold uppercase tracking-wider whitespace-nowrap"
            >
              <span>Browse Unboxed Bottles</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

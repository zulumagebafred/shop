import React, { useState } from 'react';
import { Clock, ExternalLink, Mail, MapPin, Maximize2, Phone, ShoppingBag, X } from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { siteConfig } from '../config/siteConfig';
import { BranchId } from '../types/fragrance';

interface StoresPageProps {
  onSelectBranchAndBasket: (branchId: BranchId) => void;
}

export const StoresPage: React.FC<StoresPageProps> = ({
  onSelectBranchAndBasket,
}) => {
  const [zoomedBranch, setZoomedBranch] = useState<{
    src: string;
    name: string;
  } | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
      <div className="space-y-3 border-b border-[#E5E5E5] pb-8">
        <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
          Eswatini Stores
        </p>
        <h1 className="text-3xl sm:text-5xl font-bold text-[#0A0A0A]">
          Our Stores
        </h1>
        <p className="text-sm sm:text-base text-[#525252] max-w-2xl leading-relaxed">
          Visit AuraHut Co. in Manzini or Mbabane for complimentary on-skin testing, decant sampling, or fast same-day collection of your online order.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 items-stretch">
        {siteConfig.branches.map((branch) => (
          <article
            key={branch.id}
            className="bg-white border border-[#E5E5E5] rounded-3xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-12 gap-5 items-stretch"
          >
            <button
              type="button"
              onClick={() =>
                setZoomedBranch({ src: branch.image, name: branch.name })
              }
              aria-label={`View larger directions guide for ${branch.name}`}
              className="group relative sm:col-span-5 aspect-[9/16] max-w-[300px] sm:max-w-none w-full mx-auto bg-[#0A0A0A] rounded-2xl overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A]"
            >
              <ResilientImage
                src={branch.image}
                alt={`${branch.name} Storefront & Visual Directions`}
                fallbackTitle={branch.name}
                loading="lazy"
                variant="detail"
                className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <span className="absolute bottom-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/75 text-white text-[10px] font-medium tracking-wide inline-flex items-center gap-1 opacity-90 group-hover:opacity-100">
                <Maximize2 className="w-3 h-3" aria-hidden="true" />
                <span>Zoom Guide</span>
              </span>
            </button>

              <div className="sm:col-span-7 px-1 py-1 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E5E5E5] pb-3.5">
                    <h2 className="text-xl sm:text-2xl font-bold text-[#0A0A0A]">
                      {branch.name}
                    </h2>
                    <span className="text-[11px] uppercase tracking-wider text-[#525252] font-medium">
                      {branch.city}, Eswatini
                    </span>
                  </div>

                  <div className="space-y-3 text-sm text-[#404040]">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-[#0A0A0A] shrink-0 mt-1" />
                      <div>
                        <p className="font-medium text-[#0A0A0A] leading-snug">
                          {branch.address}
                        </p>
                        <p className="text-xs text-[#666666] mt-0.5">
                          {branch.landmarkNote}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-[#0A0A0A] shrink-0 mt-1" />
                      <div className="space-y-0.5 text-xs sm:text-sm">
                        <p>{branch.openingHours.weekdays}</p>
                        <p>{branch.openingHours.saturday}</p>
                        <p className="text-[#737373]">{branch.openingHours.sunday}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Phone className="w-4 h-4 text-[#0A0A0A] shrink-0" />
                      <a
                        href={`tel:${branch.phoneDisplay.replace(/[^\d+]/g, '')}`}
                        className="hover:underline tabular-nums"
                      >
                        {branch.phoneDisplay}
                      </a>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-[#0A0A0A] shrink-0" />
                      <a href={`mailto:${branch.email}`} className="hover:underline truncate">
                        {branch.email}
                      </a>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#E5E5E5] flex flex-col sm:flex-row gap-2.5">
                  <a
                    href={branch.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] hover:bg-[#F6F6F7] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <span>Directions</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>

                  <button
                    type="button"
                    onClick={() => onSelectBranchAndBasket(branch.id)}
                    className="flex-1 py-2.5 px-4 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-white" />
                    <span>Shop {branch.city}</span>
                  </button>
                </div>
              </div>
            </article>
        ))}
      </div>

      {zoomedBranch && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${zoomedBranch.name} store photo`}
          onClick={() => setZoomedBranch(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full max-h-[90vh] flex flex-col items-center gap-3"
          >
            <button
              type="button"
              onClick={() => setZoomedBranch(null)}
              aria-label="Close full image"
              className="self-end w-10 h-10 rounded-full bg-white text-[#0A0A0A] hover:bg-[#FACC15] transition-colors flex items-center justify-center shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="max-h-[80vh] w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl border border-white/15 bg-black">
              <ResilientImage
                src={zoomedBranch.src}
                alt={`${zoomedBranch.name} directions and store view`}
                fallbackTitle={zoomedBranch.name}
                loading="eager"
                variant="detail"
                className="max-h-[80vh] w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

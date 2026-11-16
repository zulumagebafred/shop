import React from 'react';
import { Clock, ExternalLink, Mail, MapPin, Phone, ShoppingBag } from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { siteConfig } from '../config/siteConfig';
import { BranchId } from '../types/fragrance';

interface StoresPageProps {
  onSelectBranchAndBasket: (branchId: BranchId) => void;
}

export const StoresPage: React.FC<StoresPageProps> = ({
  onSelectBranchAndBasket,
}) => {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
        {siteConfig.branches.map((branch) => (
          <article
            key={branch.id}
            className="bg-white border border-[#E5E5E5] rounded-3xl p-4 sm:p-5 flex flex-col"
          >
            <div className="aspect-[16/10] rounded-2xl bg-[#F5F5F5] overflow-hidden">
              <ResilientImage
                src={branch.image}
                alt={`${branch.name} Store`}
                fallbackTitle={branch.name}
                loading="eager"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="px-2 pt-6 pb-2 flex-1 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#E5E5E5] pb-4">
                  <h2 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A]">
                    {branch.name}
                  </h2>
                  <span className="text-xs uppercase tracking-wider text-[#525252] font-medium">
                    {branch.city}, Eswatini
                  </span>
                </div>

                <div className="space-y-3.5 text-sm text-[#404040]">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-[#0A0A0A] shrink-0 mt-1" />
                    <div>
                      <p className="font-medium text-[#0A0A0A]">{branch.address}</p>
                      <p className="text-xs text-[#666666] mt-0.5">
                        {branch.landmarkNote}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-[#0A0A0A] shrink-0 mt-1" />
                    <div className="space-y-0.5 text-xs sm:text-sm">
                      <p>{branch.openingHours.weekdays}</p>
                      <p>{branch.openingHours.saturday}</p>
                      <p className="text-[#737373]">{branch.openingHours.sunday}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-[#0A0A0A] shrink-0" />
                    <a
                      href={`tel:${branch.phoneDisplay.replace(/[^\d+]/g, '')}`}
                      className="hover:underline"
                    >
                      {branch.phoneDisplay}
                    </a>
                  </div>

                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-[#0A0A0A] shrink-0" />
                    <a href={`mailto:${branch.email}`} className="hover:underline">
                      {branch.email}
                    </a>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E5E5E5] flex flex-col sm:flex-row gap-3">
                <a
                  href={branch.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] hover:bg-[#F6F6F7] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                >
                  <span>Directions</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => onSelectBranchAndBasket(branch.id)}
                  className="flex-1 py-3 px-4 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-white" />
                  <span>Shop {branch.city}</span>
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

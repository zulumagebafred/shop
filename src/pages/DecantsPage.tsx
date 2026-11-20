import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { DecantLineupViewer, DecantViewerSelection } from '../components/DecantLineupViewer';
import { WeeklyFiveMlSection } from '../components/WeeklyFiveMlSection';
import { siteContent } from '../data/siteContent';
import {
  BottleSize,
  FragranceProduct,
  WeeklyFiveMlAudience,
  WeeklyFiveMlPackMode,
} from '../types/fragrance';

interface DecantsPageProps {
  onBrowseSize: (size: BottleSize) => void;
  onExploreShop: () => void;
  onSelectProduct: (product: FragranceProduct) => void;
  onAddWeeklyPackToBasket: (payload: {
    audience: WeeklyFiveMlAudience;
    mode: WeeklyFiveMlPackMode;
    weekKey: string;
    products: FragranceProduct[];
    price: number;
    regularPrice: number | null;
  }) => void;
}

export const DecantsPage: React.FC<DecantsPageProps> = ({
  onBrowseSize,
  onExploreShop,
  onSelectProduct,
  onAddWeeklyPackToBasket,
}) => {
  const [selectedViewerSize, setSelectedViewerSize] =
    useState<DecantViewerSelection>('all');

  return (
    <div className="py-12 sm:py-16 space-y-12 sm:space-y-16">
      {/* Header split */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <div className="lg:col-span-6 space-y-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
            {siteContent.decantsSection.kicker}
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-[#0A0A0A] leading-tight [text-wrap:balance]">
            {siteContent.decantsSection.headline}
          </h1>
          <p className="text-base text-[#404040] leading-relaxed">
            {siteContent.decantsSection.description}
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-2">
            {siteContent.decantsSection.tiers.map((tier) => {
              const active = selectedViewerSize === tier.size;
              return (
                <button
                  key={tier.size}
                  type="button"
                  onClick={() => setSelectedViewerSize(tier.size)}
                  className={`px-4 py-2 rounded-full text-xs font-semibold tabular-nums border transition-colors ${
                    active
                      ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                      : 'bg-white text-[#0A0A0A] border-[#D4D4D4] hover:border-[#0A0A0A]'
                  }`}
                >
                  {tier.size}
                </button>
              );
            })}
            <button
              type="button"
              onClick={onExploreShop}
              className="px-6 py-2.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-2"
            >
              <span>Browse All Fragrances</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 max-w-md lg:max-w-none mx-auto w-full">
          <DecantLineupViewer
            selectedSize={selectedViewerSize}
            onSelectSize={setSelectedViewerSize}
          />
        </div>
      </div>

      {/* Weekly 5ml Special */}
      <WeeklyFiveMlSection
        onSelectProduct={onSelectProduct}
        onAddWeeklyPackToBasket={onAddWeeklyPackToBasket}
      />

      {/* 4 Size Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="border-b border-[#E5E5E5] pb-5">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0A0A0A]">
            Four Ways to Wear AuraHut Co.
          </h2>
          <p className="text-sm text-[#525252] mt-1">
            Select any size below to preview its bottle above or browse fragrances offered in that format.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {siteContent.decantsSection.tiers.map((tier) => {
            const active = selectedViewerSize === tier.size;
            return (
              <div
                key={tier.size}
                onClick={() => setSelectedViewerSize(tier.size)}
                className={`rounded-2xl p-6 sm:p-7 flex flex-col justify-between space-y-6 border transition-colors cursor-pointer ${
                  active
                    ? 'bg-white border-[#0A0A0A] shadow-sm'
                    : 'bg-[#F6F6F7] border-[#E5E5E5] hover:border-[#0A0A0A]/50'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-baseline justify-between border-b border-[#E5E5E5] pb-3">
                    <span className="text-3xl font-bold text-[#0A0A0A] tabular-nums">
                      {tier.size}
                    </span>
                    <span className="text-xs font-medium text-[#525252] tabular-nums">
                      {tier.spraysEstimate}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-[#0A0A0A]">
                    {tier.title}
                  </h3>

                  <p className="text-sm text-[#404040] leading-relaxed">
                    {tier.summary}
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <p className="text-xs text-[#0A0A0A] flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>{tier.idealFor}</span>
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBrowseSize(tier.size);
                    }}
                    className="w-full py-2.5 px-4 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
                  >
                    <span>Filter {tier.size}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

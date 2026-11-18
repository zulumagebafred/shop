import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
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
          <div className="pt-2">
            <button
              type="button"
              onClick={onExploreShop}
              className="px-7 py-3.5 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-[0.14em] inline-flex items-center gap-2"
            >
              <span>Browse All Fragrances</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 aspect-[4/3] rounded-3xl bg-[#F5F5F5] border border-[#E5E5E5] overflow-hidden">
          <ResilientImage
            src={siteContent.decantsSection.image}
            alt="5ml, 10ml, 22ml decants and 100ml Arabian perfume bottle"
            fallbackTitle="AuraHut Co. Decant Sizes"
            loading="eager"
            fetchPriority="high"
            className="w-full h-full object-cover"
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
            Select any size below to view fragrances currently offered in that format.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {siteContent.decantsSection.tiers.map((tier) => (
            <div
              key={tier.size}
              className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-6 sm:p-7 flex flex-col justify-between space-y-6"
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
                  onClick={() => onBrowseSize(tier.size)}
                  className="w-full py-2.5 px-4 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <span>Filter {tier.size}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

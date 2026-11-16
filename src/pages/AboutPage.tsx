import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { siteConfig } from '../config/siteConfig';
import { siteContent } from '../data/siteContent';
import { AppPage } from '../types/fragrance';

interface AboutPageProps {
  onNavigate: (page: AppPage) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
        <div className="lg:col-span-6 space-y-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
            {siteContent.aboutSection.kicker}
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-[#0A0A0A]">
            {siteContent.aboutSection.headline}
          </h1>
          <p className="text-lg font-medium text-[#525252]">
            {siteConfig.tagline} — {siteContent.aboutSection.lead}
          </p>
          <div className="space-y-4 text-sm sm:text-base text-[#404040] leading-relaxed">
            {siteContent.aboutSection.paragraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate('shop')}
              className="px-6 py-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2"
            >
              <span>Explore Catalogue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('stores')}
              className="px-6 py-3 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors text-xs font-semibold uppercase tracking-wider"
            >
              View Our Store
            </button>
          </div>
        </div>

        <div className="lg:col-span-6 aspect-[4/3] rounded-3xl bg-[#F5F5F5] border border-[#E5E5E5] overflow-hidden">
          <ResilientImage
            src={siteContent.aboutSection.image}
            alt="Raw Arabian perfumery ingredients: oud, saffron, rose, frankincense"
            fallbackTitle="AuraHut Co. Craft"
            loading="eager"
            fetchPriority="high"
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {siteContent.aboutSection.pillars.map((pillar, idx) => (
          <div
            key={pillar.title}
            className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-6 sm:p-8 space-y-3"
          >
            <span className="text-xs font-semibold tracking-wider text-[#0A0A0A] tabular-nums">
              0{idx + 1}.
            </span>
            <h2 className="text-xl font-bold text-[#0A0A0A]">
              {pillar.title}
            </h2>
            <p className="text-sm text-[#525252] leading-relaxed">
              {pillar.detail}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
};

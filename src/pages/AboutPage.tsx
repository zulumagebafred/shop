import React from 'react';
import { ArrowRight } from 'lucide-react';
import { ResilientImage } from '../components/ResilientImage';
import { siteContent } from '../data/siteContent';
import { AppPage } from '../types/fragrance';

interface AboutPageProps {
  onNavigate: (page: AppPage) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  const { aboutSection } = siteContent;

  return (
    <div className="bg-white text-[#0A0A0A]">
      {/* Intro & Founder Portrait Split */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2.5">
              <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                {aboutSection.kicker}
              </p>
              <h1 className="text-3xl sm:text-5xl font-bold text-[#0A0A0A] tracking-tight [text-wrap:balance]">
                {aboutSection.headline}
              </h1>
              <p className="text-lg sm:text-xl italic font-medium text-[#404040]">
                {aboutSection.lead}
              </p>
            </div>

            <p className="text-sm sm:text-base text-[#303030] leading-relaxed">
              {aboutSection.intro}
            </p>

            {/* Our Story */}
            <div className="pt-4 border-t border-[#E5E5E5] space-y-3">
              <h2 className="text-lg sm:text-xl font-bold text-[#0A0A0A]">
                Our Story
              </h2>
              <p className="text-sm sm:text-base text-[#404040] leading-relaxed">
                {aboutSection.storyParagraph}
              </p>
            </div>

            {/* Compact Timeline Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#E5E5E5]">
              {aboutSection.milestones.map((item) => (
                <div key={item.year} className="space-y-1">
                  <span className="block text-sm font-bold text-[#0A0A0A] tabular-nums">
                    {item.year}
                  </span>
                  <span className="block text-xs text-[#525252] leading-snug">
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onNavigate('shop')}
                className="px-6 py-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <span>Explore Catalogue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('stores')}
                className="px-6 py-3 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0"
              >
                Visit Manzini &amp; Mbabane
              </button>
            </div>
          </div>

          {/* Owner Portrait Column */}
          <div className="lg:col-span-5 flex flex-col">
            <figure className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-3xl overflow-hidden">
              <div className="aspect-[3/4] w-full bg-[#EFEFF1] overflow-hidden">
                <ResilientImage
                  src={aboutSection.founderImage}
                  alt={`${aboutSection.founderName}, Founder of AuraHut Co.`}
                  fallbackTitle={aboutSection.founderName}
                  loading="eager"
                  fetchPriority="high"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <figcaption className="px-6 py-4 border-t border-[#E5E5E5] bg-white flex flex-col gap-0.5">
                <span className="text-sm font-bold text-[#0A0A0A]">
                  {aboutSection.founderName} ({aboutSection.founderKnownAs})
                </span>
                <span className="text-xs text-[#525252]">
                  {aboutSection.founderRole}
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Meet Our Founder */}
      <section className="bg-[#F6F6F7] border-y border-[#E5E5E5] py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          <div className="lg:col-span-4 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
              Leadership &amp; Purpose
            </p>
            <h2 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A] [text-wrap:balance]">
              Meet Our Founder
            </h2>
            <p className="text-xs sm:text-sm text-[#525252] pt-1">
              Nomfanelo Teyise Khumalo · Mother of Four · Cooperative Strategist &amp; Mentor
            </p>
          </div>

          <div className="lg:col-span-8 space-y-5 text-sm sm:text-base text-[#303030] leading-relaxed">
            {aboutSection.founderParagraphs.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Our Discovery Scent Bar */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-5 aspect-[4/3] lg:aspect-auto lg:min-h-[380px] rounded-3xl bg-[#F5F5F5] border border-[#E5E5E5] overflow-hidden">
            <ResilientImage
              src={siteContent.decantsSection.image}
              alt="5ml, 10ml, and 22ml glass decants at the AuraHut Co. Discovery Scent Bar"
              fallbackTitle="Discovery Scent Bar"
              className="w-full h-full object-cover"
            />
          </div>

          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs uppercase tracking-[0.2em] text-[#666666] font-medium">
                  Try On Skin Before Committing
                </p>
                <h2 className="text-2xl sm:text-4xl font-bold text-[#0A0A0A] [text-wrap:balance]">
                  Our Discovery Scent Bar
                </h2>
              </div>

              <div className="space-y-4 text-sm sm:text-base text-[#404040] leading-relaxed">
                {aboutSection.discoveryBarParagraphs.map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
              </div>

              <div className="pt-3 border-t border-[#E5E5E5] space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#525252]">
                  Perfume Houses &amp; Range
                </p>
                <p className="text-xs sm:text-sm text-[#0A0A0A] font-medium leading-relaxed">
                  {aboutSection.stockedHousesLine}
                </p>
                <p className="text-xs text-[#666666]">
                  Available in 5ml, 10ml &amp; 22ml decants · Full bottles · Perfume oils · Body mists · Lotions · Home &amp; car scents
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('decants')}
                className="px-6 py-3 rounded-full bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-2 whitespace-nowrap shrink-0"
              >
                <span>Explore Discovery Decants</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('combos')}
                className="px-6 py-3 rounded-full border border-[#D4D4D4] text-[#0A0A0A] hover:border-[#0A0A0A] transition-colors text-xs font-semibold uppercase tracking-wider whitespace-nowrap shrink-0"
              >
                Combos &amp; Layering
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Where We're Going */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-16">
        <div className="bg-[#0A0A0A] text-white rounded-3xl px-6 sm:px-10 lg:px-14 py-10 sm:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_20%,rgba(250,204,21,0.14)_0%,rgba(10,10,10,0)_55%)]"
          />
          <div className="relative z-10 lg:col-span-5 space-y-2.5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#FACC15] font-semibold">
              Looking Ahead
            </p>
            <h2 className="text-2xl sm:text-4xl font-extrabold italic uppercase tracking-tight leading-tight text-white [text-wrap:balance]">
              Where We’re <span className="text-[#FACC15]">Going</span>
            </h2>
            <p className="text-xs sm:text-sm text-white/70">
              From Eswatini’s stores to towns, shopping malls, and distribution partners across Africa.
            </p>
          </div>

          <div className="relative z-10 lg:col-span-7 space-y-4 text-sm sm:text-base text-white/85 leading-relaxed">
            {aboutSection.futureParagraphs.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Vision, Mission & Motto */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {aboutSection.pillars.map((pillar, idx) => (
            <div
              key={pillar.title}
              className="bg-[#F6F6F7] border border-[#E5E5E5] rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2.5">
                <span className="block text-xs font-semibold tracking-wider text-[#525252] tabular-nums">
                  0{idx + 1}.
                </span>
                <h2 className="text-xl font-bold text-[#0A0A0A]">
                  {pillar.title}
                </h2>
                <p
                  className={`text-sm font-semibold ${
                    idx === 2 ? 'italic text-[#0A0A0A]' : 'text-[#525252]'
                  }`}
                >
                  {pillar.subtitle}
                </p>
              </div>
              <p className="text-sm text-[#404040] leading-relaxed pt-2 border-t border-[#E5E5E5]">
                {pillar.detail}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

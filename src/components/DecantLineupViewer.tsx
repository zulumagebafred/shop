import React from 'react';
import { motion } from 'motion/react';
import { BottleSize } from '../types/fragrance';

export type DecantViewerSelection = BottleSize | 'all';

interface BottleFocusSpec {
  size: BottleSize;
  label: string;
  itemBadge: string;
  scale: number;
  xPercent: number;
  yPercent: number;
  clipLeft: number;
  clipRight: number;
}

const DECANT_WEBP_SRC = '/assets/aistudio/image_123e2ff5.webp';
const DECANT_IMAGE_SRC = '/assets/aistudio/image_123e2ff5.png';

const BOTTLE_FOCUS_MAP: Record<string, BottleFocusSpec> = {
  '5ml': {
    size: '5ml',
    label: '5ml Decant',
    itemBadge: '5ml · 1st Bottle',
    scale: 1.72,
    xPercent: 59.8,
    yPercent: -29,
    clipLeft: 0,
    clipRight: 77.8,
  },
  '10ml': {
    size: '10ml',
    label: '10ml Decant',
    itemBadge: '10ml · 2nd Bottle',
    scale: 1.22,
    xPercent: 25.1,
    yPercent: -8,
    clipLeft: 22.2,
    clipRight: 63.2,
  },
  '22ml': {
    size: '22ml',
    label: '22ml Decant',
    itemBadge: '22ml · 3rd Bottle',
    scale: 1.06,
    xPercent: 2.8,
    yPercent: -3,
    clipLeft: 36.8,
    clipRight: 43.2,
  },
  '100ml': {
    size: '100ml',
    label: 'Full Bottle (100ml)',
    itemBadge: '100ml · 4th Bottle',
    scale: 1.46,
    xPercent: -36.1,
    yPercent: -20,
    clipLeft: 56.8,
    clipRight: 0,
  },
};

const SELECTION_OPTIONS: { id: DecantViewerSelection; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: '5ml', label: '5ml' },
  { id: '10ml', label: '10ml' },
  { id: '22ml', label: '22ml' },
  { id: '100ml', label: '100ml' },
];

interface DecantLineupViewerProps {
  selectedSize: DecantViewerSelection;
  onSelectSize: (size: DecantViewerSelection) => void;
  className?: string;
}

export const DecantLineupViewer: React.FC<DecantLineupViewerProps> = ({
  selectedSize,
  onSelectSize,
  className = '',
}) => {
  const focusSpec =
    selectedSize !== 'all' ? BOTTLE_FOCUS_MAP[selectedSize] ?? null : null;

  const targetScale = focusSpec ? focusSpec.scale : 1;
  const targetX = focusSpec ? `${focusSpec.xPercent}%` : '0%';
  const targetY = focusSpec ? `${focusSpec.yPercent}%` : '-2%';
  const targetClip = focusSpec
    ? `inset(0% ${focusSpec.clipRight}% 0% ${focusSpec.clipLeft}%)`
    : 'inset(0% 0% 0% 0%)';

  return (
    <div
      className={`relative aspect-square w-full rounded-3xl bg-[#DFD9D9] border border-[#E5E5E5] overflow-hidden select-none ${className}`}
    >
      {/* Animated studio bottle camera */}
      <motion.div
        animate={{
          scale: targetScale,
          x: targetX,
          y: targetY,
          clipPath: targetClip,
        }}
        initial={false}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full h-full will-change-transform"
        style={{ transformOrigin: '50% 50%' }}
      >
        <picture className="block w-full h-full">
          <source srcSet={DECANT_WEBP_SRC} type="image/webp" />
          <img
            src={DECANT_IMAGE_SRC}
            alt={
              focusSpec
                ? `${focusSpec.label} atomizer bottle from AuraHut Co. lineup`
                : '5ml, 10ml, 22ml travel decants and 100ml full bottle lineup'
            }
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain pointer-events-none"
          />
        </picture>

        {/* Soft edge feathering when cropped to a single bottle so backdrop blends seamlessly */}
        {focusSpec && focusSpec.clipLeft > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 w-6 bg-gradient-to-r from-[#DFD9D9] to-transparent pointer-events-none"
            style={{ left: `${focusSpec.clipLeft}%` }}
          />
        )}
        {focusSpec && focusSpec.clipRight > 0 && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 w-6 bg-gradient-to-l from-[#DFD9D9] to-transparent pointer-events-none"
            style={{ right: `${focusSpec.clipRight}%` }}
          />
        )}
      </motion.div>

      {/* Direct bottle click zones when viewing full lineup */}
      {!focusSpec && (
        <div
          className="absolute inset-x-0 top-[10%] bottom-[14%] grid grid-cols-12 z-10"
          aria-label="Click any bottle to inspect its size"
        >
          <button
            type="button"
            onClick={() => onSelectSize('5ml')}
            aria-label="Inspect 5ml decant bottle"
            title="Inspect 5ml Decant"
            className="col-span-3 h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0A0A0A]/40"
          />
          <button
            type="button"
            onClick={() => onSelectSize('10ml')}
            aria-label="Inspect 10ml decant bottle"
            title="Inspect 10ml Decant"
            className="col-span-2 h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0A0A0A]/40"
          />
          <button
            type="button"
            onClick={() => onSelectSize('22ml')}
            aria-label="Inspect 22ml decant bottle"
            title="Inspect 22ml Decant"
            className="col-span-2 h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0A0A0A]/40"
          />
          <button
            type="button"
            onClick={() => onSelectSize('100ml')}
            aria-label="Inspect 100ml full bottle"
            title="Inspect 100ml Full Bottle"
            className="col-span-5 h-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0A0A0A]/40"
          />
        </div>
      )}

      {/* Top status badge */}
      <div className="absolute top-3 left-3 z-20 pointer-events-none">
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/90 backdrop-blur-xs text-[#0A0A0A] border border-black/10 text-[11px] font-semibold tracking-wide tabular-nums shadow-xs">
          {focusSpec ? focusSpec.itemBadge : 'Full Lineup · 5ml to 100ml'}
        </span>
      </div>

      {/* Bottom quick selector bar */}
      <div className="absolute bottom-3 inset-x-3 z-20 flex justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white/90 backdrop-blur-md border border-black/10 shadow-sm max-w-full overflow-x-auto">
          {SELECTION_OPTIONS.map((opt) => {
            const active = selectedSize === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectSize(opt.id)}
                className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-semibold tabular-nums transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#0A0A0A] text-white'
                    : 'text-[#404040] hover:text-[#0A0A0A] hover:bg-black/5'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

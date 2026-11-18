import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
}

const KNOWN_WEBP_IMAGES = new Set<string>([
  'boutique_interior_1794676715739.webp',
  'cat_mens_oud_1794676712301.webp',
  'cat_unisex_amber_1794676712905.webp',
  'cat_womens_rose_1794676712431.webp',
  'craft_ingredients_1794676716101.webp',
  'decant_collection_1794676715190.webp',
  'hero_luxury_oud_1794676712385.webp',
  'house_afnan_1794685070293.webp',
  'house_al_haramain_1794685068564.webp',
  'house_armaf_1794685069505.webp',
  'house_fragrance_world_1794685071433.webp',
  'house_lattafa_1794685069142.webp',
  'house_paris_corner_1794685071664.webp',
  'house_rasasi_1794685069093.webp',
  'house_reef_1794685069325.webp',
  'prod_amber_elixir_1794676714034.webp',
  'prod_musk_imperial_1794676714707.webp',
  'prod_royal_oud_1794676713330.webp',
  'prod_velvet_rose_1794676713525.webp',
]);

function resolveOptimizedPaths(rawSrc: string): {
  webpSrc: string | null;
  fallbackSrc: string;
} {
  const trimmed = (rawSrc || '').trim();
  if (!trimmed) {
    return { webpSrc: null, fallbackSrc: '' };
  }

  // Remap legacy /src/assets/images/*.jpg paths (e.g. from saved Firestore entries)
  // to the public /assets/images/* assets bundled into production dist/.
  const normalized = trimmed.startsWith('/src/assets/images/')
    ? trimmed.replace('/src/assets/images/', '/assets/images/')
    : trimmed;

  if (
    normalized.startsWith('/assets/images/') &&
    /\.(jpe?g|png)$/i.test(normalized)
  ) {
    const webpCandidate = normalized.replace(/\.(jpe?g|png)$/i, '.webp');
    const fileName = webpCandidate.slice('/assets/images/'.length);
    return {
      webpSrc: KNOWN_WEBP_IMAGES.has(fileName) ? webpCandidate : null,
      fallbackSrc: normalized,
    };
  }

  if (
    normalized.startsWith('/assets/images/') &&
    normalized.toLowerCase().endsWith('.webp')
  ) {
    return {
      webpSrc: normalized,
      fallbackSrc: normalized.replace(/\.webp$/i, '.jpg'),
    };
  }

  return { webpSrc: null, fallbackSrc: normalized };
}

export const ResilientImage: React.FC<ResilientImageProps> = React.memo(({
  src,
  alt,
  className = '',
  fallbackTitle,
  loading = 'lazy',
  fetchPriority = 'auto',
}) => {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const hasError = failedSrc === src;
  const isLoaded = loadedSrc === src;

  useEffect(() => {
    if (failedSrc && failedSrc !== src) {
      setFailedSrc(null);
    }
  }, [src, failedSrc]);

  const handleImgRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (node && node.complete && node.naturalWidth > 0) {
        setLoadedSrc(src);
      }
    },
    [src]
  );

  const { webpSrc, fallbackSrc } = resolveOptimizedPaths(src);

  if (hasError || !fallbackSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0A0A0A] via-[#1C1C1C] to-[#2B2B2B] text-white p-6 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <div className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center mb-3">
          <Sparkles className="w-4 h-4 text-white" aria-hidden="true" />
        </div>
        <span className="text-sm font-semibold tracking-wide text-white">
          {fallbackTitle || 'AURAHUT CO.'}
        </span>
        <span className="text-[11px] text-white/65 mt-1">Arabian Fine Fragrance</span>
      </div>
    );
  }

  const imgElement = (
    <img
      ref={handleImgRef}
      src={fallbackSrc}
      alt={alt}
      loading={loading}
      decoding="async"
      fetchPriority={fetchPriority}
      referrerPolicy="no-referrer"
      onLoad={() => setLoadedSrc(src)}
      onError={() => setFailedSrc(src)}
      className={`${className} transition-opacity duration-200 ${
        isLoaded ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );

  return (
    <div className="relative w-full h-full overflow-hidden">
      {!isLoaded && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[#EFEFF1] animate-pulse"
        />
      )}
      {webpSrc ? (
        <picture className="block w-full h-full">
          <source srcSet={webpSrc} type="image/webp" />
          {imgElement}
        </picture>
      ) : (
        imgElement
      )}
    </div>
  );
});

import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

export type ImageVariant = 'thumb' | 'card' | 'detail' | 'hero';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  variant?: ImageVariant;
}

const KNOWN_LOCAL_BASE_PATHS = new Set<string>([
  '/assets/images/boutique_interior_1794676715739',
  '/assets/images/cat_mens_oud_1794676712301',
  '/assets/images/cat_unisex_amber_1794676712905',
  '/assets/images/cat_womens_rose_1794676712431',
  '/assets/images/craft_ingredients_1794676716101',
  '/assets/images/decant_collection_1794676715190',
  '/assets/images/hero_luxury_oud_1794676712385',
  '/assets/images/house_afnan_1794685070293',
  '/assets/images/house_al_haramain_1794685068564',
  '/assets/images/house_armaf_1794685069505',
  '/assets/images/house_fragrance_world_1794685071433',
  '/assets/images/house_lattafa_1794685069142',
  '/assets/images/house_paris_corner_1794685071664',
  '/assets/images/house_rasasi_1794685069093',
  '/assets/images/house_reef_1794685069325',
  '/assets/images/luxury_gift_hamper_1795005244668',
  '/assets/images/prod_amber_elixir_1794676714034',
  '/assets/images/prod_musk_imperial_1794676714707',
  '/assets/images/prod_royal_oud_1794676713330',
  '/assets/images/prod_velvet_rose_1794676713525',
  '/assets/images/unboxed_perfume_flacon_1795005243926',
  '/assets/aistudio/6f9dbb3a-c839-47b8-b2c7-a3285dcec62d_ae52bfb3',
  '/assets/aistudio/aurahut_logo_a0bd1434',
  '/assets/aistudio/image_123e2ff5',
  '/assets/aistudio/image_29e39f08',
  '/assets/aistudio/image_2c00823d',
  '/assets/aistudio/image_3c834679',
  '/assets/aistudio/image_4ec32308',
  '/assets/aistudio/image_54193abf',
  '/assets/aistudio/image_798893ad',
  '/assets/aistudio/image_cae64a2d',
  '/assets/aistudio/teyise_image_9b43dbee',
  '/assets/aistudio/WhatsApp_Image_2026-11-18_at_11.26.24_AM_f359d9b2',
]);

function isSafeImageUrl(url: string): boolean {
  if (!url) return false;
  if (url.startsWith('/')) return true;
  if (/^https?:\/\//i.test(url)) return true;
  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,/i.test(url)) return true;
  return false;
}

function resolveOptimizedPaths(
  rawSrc: string,
  variant: ImageVariant
): {
  webpSrc: string | null;
  fallbackSrc: string;
} {
  const trimmed = (rawSrc || '').trim();
  if (!isSafeImageUrl(trimmed)) {
    return { webpSrc: null, fallbackSrc: '' };
  }

  // Remap legacy /src/assets/images/*.jpg paths to /assets/images/*
  const normalized = trimmed.startsWith('/src/assets/images/')
    ? trimmed.replace('/src/assets/images/', '/assets/images/')
    : trimmed;

  const isLocalAsset =
    normalized.startsWith('/assets/images/') ||
    normalized.startsWith('/assets/aistudio/');

  if (isLocalAsset && /\.(jpe?g|png|webp)$/i.test(normalized)) {
    const baseNoExt = normalized
      .replace(/-thumb\.webp$/i, '')
      .replace(/\.(jpe?g|png|webp)$/i, '');

    if (KNOWN_LOCAL_BASE_PATHS.has(baseNoExt)) {
      const preferThumb = variant === 'thumb' || variant === 'card';
      const preferredWebp = preferThumb ? `${baseNoExt}-thumb.webp` : `${baseNoExt}.webp`;
      const fallbackUrl = normalized.toLowerCase().endsWith('.webp')
        ? `${baseNoExt}.webp`
        : normalized;
      return {
        webpSrc: preferredWebp,
        fallbackSrc: fallbackUrl,
      };
    }
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
  variant = 'card',
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

  const { webpSrc, fallbackSrc } = resolveOptimizedPaths(src, variant);

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

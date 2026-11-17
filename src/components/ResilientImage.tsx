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

function resolveOptimizedPaths(rawSrc: string): {
  webpSrc: string | null;
  fallbackSrc: string;
} {
  const trimmed = (rawSrc || '').trim();
  if (!trimmed) {
    return { webpSrc: null, fallbackSrc: '' };
  }

  // Remap legacy /src/assets/images/*.jpg paths (e.g. from saved Firestore entries)
  // to the compressed public /assets/images/* assets bundled into production dist/.
  const normalized = trimmed.startsWith('/src/assets/images/')
    ? trimmed.replace('/src/assets/images/', '/assets/images/')
    : trimmed;

  if (
    normalized.startsWith('/assets/images/') &&
    /\.(jpe?g|png)$/i.test(normalized)
  ) {
    return {
      webpSrc: normalized.replace(/\.(jpe?g|png)$/i, '.webp'),
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

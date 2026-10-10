"use client";

import { useState, type ReactNode } from "react";

/**
 * An <img> that can fail without showing a broken-image icon.
 *
 * Tenant artwork is data: a logo or a bottle photo may be missing, renamed or
 * still being produced the day of a demo. Every surface that shows one passes a
 * `fallback` (the brand's colour chip, the product's initial, the Supergana
 * wordmark) so a missing file degrades to a smaller design, never to a fault.
 *
 * Two traps this handles:
 *  - the failure is remembered per `src`, so swapping the URL gets a fresh try
 *    instead of staying on the fallback forever;
 *  - an image that already failed during server render never fires `onError`
 *    on the client (the event happened before React attached the listener), so
 *    the ref callback checks `complete && naturalWidth === 0` on mount.
 *
 * Plain <img> rather than next/image for the reason the header documents:
 * tenant hosts are data and would each need a remotePatterns entry.
 */
export function SafeImg({
  src,
  alt,
  className,
  fallback,
  onFail,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
  onFail?: () => void;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (failedSrc === src) return <>{fallback}</>;

  const fail = () => {
    setFailedSrc(src);
    onFail?.();
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={(node) => {
        if (node && node.complete && node.naturalWidth === 0) fail();
      }}
      src={src}
      alt={alt}
      className={className}
      decoding="async"
      draggable={false}
      onError={fail}
    />
  );
}

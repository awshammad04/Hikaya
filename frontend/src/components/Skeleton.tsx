import React from "react";

/**
 * Loading placeholders.
 *
 * Each skeleton mirrors the shape of the content that replaces it, so the page
 * does not jump when the data lands. `aria-hidden` keeps the shimmer out of the
 * accessibility tree - the live region on the page announces loading instead.
 */

export const SkeletonLine: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div
    aria-hidden="true"
    className={`animate-pulse rounded bg-brand-border-light ${className}`}
  />
);

export const SkeletonText: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div aria-hidden="true" className="space-y-2">
    {Array.from({ length: lines }, (_, index) => (
      <SkeletonLine
        key={index}
        // The last line runs short, the way a real paragraph does.
        className={`h-3 ${index === lines - 1 ? "w-2/3" : "w-full"}`}
      />
    ))}
  </div>
);

export const SkeletonCard: React.FC = () => (
  <div
    aria-hidden="true"
    className="bg-white rounded-3xl border border-brand-border overflow-hidden"
  >
    <SkeletonLine className="h-44 w-full rounded-none" />
    <div className="p-5 space-y-3">
      <SkeletonLine className="h-3 w-24" />
      <SkeletonText lines={3} />
      <div className="flex gap-1.5">
        <SkeletonLine className="h-4 w-20 rounded-full" />
        <SkeletonLine className="h-4 w-24 rounded-full" />
      </div>
    </div>
  </div>
);

export const SkeletonCardGrid: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    {Array.from({ length: count }, (_, index) => (
      <SkeletonCard key={index} />
    ))}
  </div>
);

/**
 * Announces loading to screen readers while the skeletons show visually.
 * Sighted users get the shimmer; everyone else gets the message.
 */
export const LoadingRegion: React.FC<{ label: string }> = ({ label }) => (
  <span role="status" aria-live="polite" className="sr-only">
    {label}
  </span>
);

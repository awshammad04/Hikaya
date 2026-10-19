import React, { useState } from "react";

interface CoverImageProps {
  src?: string;
  alt: string;
  className?: string;
}

/**
 * Cover photo that disappears instead of breaking.
 *
 * Location images are hotlinked from external hosts, so they can fail on a slow
 * connection, behind a restrictive network, or if the host goes away. Leaving
 * the browser's broken-image box on screen looks like a bug; hiding the image
 * leaves the olive panel underneath, which the title is already legible against.
 */
export const CoverImage: React.FC<CoverImageProps> = ({ src, alt, className }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) return null;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};

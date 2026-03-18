import { useState } from 'react';

/**
 * Affiche une image avec repli sur une URL de secours en cas d’erreur.
 * Équivalent du composant Figma protégé — à utiliser pour remplacer les assets Figma.
 */
export function ImageWithFallback({
  src,
  alt,
  className = '',
  fallback = 'https://via.placeholder.com/400x300?text=Image+Non+Disponible',
}) {
  const [imgSrc, setImgSrc] = useState(src);

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setImgSrc(fallback)}
    />
  );
}

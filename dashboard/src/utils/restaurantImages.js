/** Image par défaut si aucune image restaurant. */
export const DEFAULT_RESTAURANT_IMAGE =
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop';

/** URL d’image : si relative (/uploads/...), préfixe par l’origine (proxy Vite dashboard). */
export function getImageSrc(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return origin ? `${origin}${url.startsWith('/') ? '' : '/'}${url}` : url;
}

export function getRestaurantImageSrc(r) {
  const url = r?.image?.trim();
  return getImageSrc(url) || DEFAULT_RESTAURANT_IMAGE;
}

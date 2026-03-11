/**
 * Retourne l'URL absolue pour la prévisualisation / lecture vidéo.
 * - blob: inchangé
 * - http(s) vers /uploads/ : réécrit avec l'origine courante pour passer par le proxy Vite
 * - chemin relatif : préfixé par l'origine courante
 */
export function getVideoPreviewUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const u = url.trim();
  if (!u) return null;
  if (u.startsWith('blob:')) return u;
  if (u.startsWith('http://') || u.startsWith('https://')) {
    try {
      const pathname = new URL(u).pathname;
      if (pathname && pathname.startsWith('/uploads/')) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        return origin ? `${origin}${pathname}` : u;
      }
    } catch (_) {}
    return u;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return origin ? `${origin}${u.startsWith('/') ? '' : '/'}${u}` : u;
}

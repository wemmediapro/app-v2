/**
 * Hook Banners : chargement bannières d'accueil, rotation, largeur viewport, impression/click.
 * Extrait d'App.jsx pour alléger le composant racine.
 */
import { useState, useEffect, useCallback } from 'react';
import { apiService, BACKEND_ORIGIN } from '../services/apiService';

const CACHE_TTL_MS = 60_000;
const ROTATION_INTERVAL_MS = 5000;

function resolveBannerUrl(u, origin) {
  if (!u) return undefined;
  if (u.startsWith('data:') || u.startsWith('http')) return u;
  return `${origin || ''}${u.startsWith('/') ? '' : '/'}${u}`;
}

export function useBanners(page, language) {
  const bannerPageId = page === 'restaurant' ? 'restaurants' : page;
  const [homeBanners, setHomeBanners] = useState([]);
  const [bannerViewWidth, setBannerViewWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );
  const [bannerIndex, setBannerIndex] = useState(0);

  const getBannerImageUrl = useCallback((banner, w) => {
    const w2 = w ?? bannerViewWidth;
    if (w2 < 768) return resolveBannerUrl(banner.imageMobile, BACKEND_ORIGIN) || resolveBannerUrl(banner.image, BACKEND_ORIGIN);
    if (w2 < 1024) return resolveBannerUrl(banner.imageTablet, BACKEND_ORIGIN) || resolveBannerUrl(banner.image, BACKEND_ORIGIN);
    return resolveBannerUrl(banner.image, BACKEND_ORIGIN);
  }, [bannerViewWidth]);

  // Chargement bannières depuis l'API (cache 1 min)
  useEffect(() => {
    const cacheKey = `banners_${language}_${bannerPageId}`;
    const cache = globalThis.__BANNERS_CACHE__;
    const cached = cache?.[cacheKey];
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      setHomeBanners(cached.list);
      return;
    }
    let cancelled = false;
    apiService.getBanners(`lang=${language}&page=${bannerPageId}`)
      .then((res) => {
        if (cancelled || !res?.data) return;
        const list = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        const homePositions = ['home-top', 'home'];
        const active = list
          .filter((b) => {
            if (b.isActive === false) return false;
            const pos = String(b.position || '').toLowerCase().replace(/\s+/g, '-');
            return homePositions.includes(pos);
          })
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || new Date(b.startDate || 0) - new Date(a.startDate || 0));
        if (!globalThis.__BANNERS_CACHE__) globalThis.__BANNERS_CACHE__ = {};
        globalThis.__BANNERS_CACHE__[cacheKey] = { list: active, ts: Date.now() };
        setHomeBanners(active);
      })
      .catch(() => { setHomeBanners([]); });
    return () => { cancelled = true; };
  }, [language, bannerPageId]);

  // Mise à jour largeur viewport (resize)
  useEffect(() => {
    let ticking = false;
    const update = () => {
      setBannerViewWidth(window.innerWidth);
      ticking = false;
    };
    const onResize = () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };
    update();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Rotation automatique (toutes les 5 s)
  useEffect(() => {
    const n = homeBanners.length;
    if (n <= 1) return;
    const t = setInterval(() => {
      setBannerIndex((i) => (i + 1) % n);
    }, ROTATION_INTERVAL_MS);
    return () => clearInterval(t);
  }, [homeBanners.length]);

  // Réinitialiser l'index si la liste change
  useEffect(() => {
    if (homeBanners.length > 0 && bannerIndex >= homeBanners.length) setBannerIndex(0);
  }, [homeBanners.length, bannerIndex]);

  // Enregistrer une impression quand une bannière est affichée
  useEffect(() => {
    if (homeBanners.length === 0) return;
    const banner = homeBanners[bannerIndex];
    const id = banner != null ? (banner._id ?? banner.id) : null;
    if (id != null) apiService.recordBannerImpression(String(id));
  }, [bannerIndex, homeBanners]);

  const handleBannerClick = useCallback((id) => {
    apiService.recordBannerClick(id);
  }, []);

  return {
    homeBanners,
    bannerIndex,
    setBannerIndex,
    bannerViewWidth,
    getBannerImageUrl,
    handleBannerClick,
    backendOrigin: BACKEND_ORIGIN,
  };
}

/**
 * Magazine : articles (useMagazine) + favoris + dérivés pour la page Favoris.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMagazine } from './useMagazine';

function readMagazineFavoritesLocal(suffix) {
  try {
    const key = `magazineFavorites_${suffix}`;
    let raw = localStorage.getItem(key);
    if (suffix === 'guest' && (!raw || raw === '[]')) {
      const legacy = localStorage.getItem('magazineFavorites');
      if (legacy) raw = legacy;
    }
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

/**
 * @param {string} language
 * @param {Function} t - i18n
 * @param {string} [favoritesStorageSuffix]
 */
export function useMagazineLogic(language, t, favoritesStorageSuffix = 'guest') {
  const magazine = useMagazine(language, t);
  const [magazineFavoritesIds, setMagazineFavoritesIds] = useState([]);

  useEffect(() => {
    if (favoritesStorageSuffix !== 'guest') return;
    setMagazineFavoritesIds(readMagazineFavoritesLocal(favoritesStorageSuffix));
  }, [favoritesStorageSuffix]);

  const isMagazineFavorite = useCallback(
    (articleId) => magazineFavoritesIds.some((id) => String(id) === String(articleId)),
    [magazineFavoritesIds]
  );

  const toggleMagazineFavorite = useCallback(
    (article) => {
      const id = article?.id ?? article?._id;
      if (!id) return;
      const key = `magazineFavorites_${favoritesStorageSuffix}`;
      setMagazineFavoritesIds((prev) => {
        const next = prev.some((i) => String(i) === String(id))
          ? prev.filter((i) => String(i) !== String(id))
          : [...prev, id];
        if (favoritesStorageSuffix === 'guest') {
          try {
            localStorage.setItem(key, JSON.stringify(next));
          } catch (_) {}
        }
        return next;
      });
    },
    [favoritesStorageSuffix]
  );

  const magazineFavoritesArticles = useMemo(
    () =>
      magazine.magazineArticles.filter((a) => magazineFavoritesIds.some((id) => String(id) === String(a.id ?? a._id))),
    [magazine.magazineArticles, magazineFavoritesIds]
  );

  return {
    ...magazine,
    magazineFavoritesIds,
    setMagazineFavoritesIds,
    isMagazineFavorite,
    toggleMagazineFavorite,
    magazineFavoritesArticles,
  };
}

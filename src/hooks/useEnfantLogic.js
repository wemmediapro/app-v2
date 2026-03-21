/**
 * Espace enfant : activités (useEnfant) + favoris + liste pour la page Favoris.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useEnfant } from './useEnfant';

function readEnfantFavoritesLocal(suffix) {
  try {
    const key = `enfantFavorites_${suffix}`;
    let raw = localStorage.getItem(key);
    if (suffix === 'guest' && (!raw || raw === '[]')) {
      const legacy = localStorage.getItem('enfantFavorites');
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
export function useEnfantLogic(language, t, favoritesStorageSuffix = 'guest') {
  const [enfantFavoritesIds, setEnfantFavoritesIds] = useState([]);

  useEffect(() => {
    if (favoritesStorageSuffix !== 'guest') return;
    setEnfantFavoritesIds(readEnfantFavoritesLocal(favoritesStorageSuffix));
  }, [favoritesStorageSuffix]);

  const enfant = useEnfant(language, t, enfantFavoritesIds);

  const isEnfantFavorite = useCallback(
    (activityId) => enfantFavoritesIds.some((id) => String(id) === String(activityId)),
    [enfantFavoritesIds]
  );

  const toggleEnfantFavorite = useCallback(
    (activity) => {
      const id = activity?.id ?? activity?._id;
      if (!id) return;
      const key = `enfantFavorites_${favoritesStorageSuffix}`;
      setEnfantFavoritesIds((prev) => {
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

  const enfantFavoritesActivities = useMemo(
    () => enfant.enfantActivities.filter((a) => enfantFavoritesIds.some((id) => String(id) === String(a.id))),
    [enfant.enfantActivities, enfantFavoritesIds]
  );

  return {
    ...enfant,
    enfantFavoritesIds,
    setEnfantFavoritesIds,
    isEnfantFavorite,
    toggleEnfantFavorite,
    enfantFavoritesActivities,
  };
}

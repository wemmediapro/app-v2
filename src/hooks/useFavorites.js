/**
 * Hook générique pour gérer une liste d’IDs favoris avec persistance localStorage.
 * Réduit la duplication (magazine, enfant, etc.) — audit frontend.
 */
import { useState, useCallback } from 'react';

/**
 * @param {string} storageKey - Clé localStorage (ex. magazineFavorites_guest)
 * @param {string} [idField] - Champ id sur les items ('id' ou '_id')
 * @returns {{ ids: string[], setIds: Function, isFavorite: (item: object) => boolean, toggle: (item: object) => void }}
 */
export function useFavorites(storageKey, idField = 'id') {
  const [ids, setIds] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  });

  const getId = useCallback(
    (item) => {
      if (!item) return null;
      const v = item[idField] ?? item._id ?? item.id;
      return v != null ? String(v) : null;
    },
    [idField]
  );

  const isFavorite = useCallback(
    (item) => {
      const id = getId(item);
      return id != null && ids.some((i) => i === id);
    },
    [ids, getId]
  );

  const toggle = useCallback(
    (item) => {
      const id = getId(item);
      if (!id) return;
      setIds((prev) => {
        const next = prev.some((i) => i === id) ? prev.filter((i) => i !== id) : [...prev, id];
        try {
          localStorage.setItem(storageKey, JSON.stringify(next));
        } catch (_) {}
        return next;
      });
    },
    [storageKey, getId]
  );

  return { ids, setIds, isFavorite, toggle };
}

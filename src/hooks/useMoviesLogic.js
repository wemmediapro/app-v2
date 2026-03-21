/**
 * Films / séries : liste API (useMoviesState) + watchlist locale ou profil (sync côté App).
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useMoviesState } from './useMoviesState';

function readWatchlistLocal(suffix) {
  try {
    const key = `watchlist_${suffix}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

/**
 * @param {string} language
 * @param {string} [favoritesStorageSuffix]
 */
export function useMoviesLogic(language, favoritesStorageSuffix = 'guest') {
  const { moviesAndSeries, moviesLoading, movieToOpenFromFavorites, setMovieToOpenFromFavorites, refreshMovies } =
    useMoviesState(language);

  const [watchlist, setWatchlist] = useState([]);

  useEffect(() => {
    if (favoritesStorageSuffix !== 'guest') return;
    setWatchlist(readWatchlistLocal(favoritesStorageSuffix));
  }, [favoritesStorageSuffix]);

  const toggleWatchlist = useCallback(
    (movieId) => {
      const key = `watchlist_${favoritesStorageSuffix}`;
      setWatchlist((prev) => {
        const next = prev.includes(movieId) ? prev.filter((id) => id !== movieId) : [...prev, movieId];
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

  const myWatchlist = useMemo(
    () => moviesAndSeries.filter((item) => watchlist.includes(item.id)),
    [moviesAndSeries, watchlist]
  );

  return {
    moviesAndSeries,
    moviesLoading,
    movieToOpenFromFavorites,
    setMovieToOpenFromFavorites,
    refreshMovies,
    watchlist,
    setWatchlist,
    toggleWatchlist,
    myWatchlist,
  };
}

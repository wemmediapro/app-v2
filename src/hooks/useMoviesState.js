/**
 * État et chargement de la liste films/séries — extrait d'App.jsx (audit CTO, découpage).
 * Centralise le fetch API et le refresh au retour sur l'onglet.
 */
import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';

function transformMovie(movie) {
  const rawType = (movie.type || 'movie').toLowerCase();
  const type = rawType === 'series' ? 'serie' : rawType === 'movie' ? 'film' : rawType;
  let poster = movie.poster;
  if (!poster && movie.tmdbPosterPath) {
    const p = String(movie.tmdbPosterPath);
    poster = TMDB_POSTER_BASE + (p.startsWith('/') ? p : `/${p}`);
  }
  if (!poster) poster = '';
  return {
    id: movie.id || movie._id,
    title: movie.title,
    type,
    genre: (movie.genre && movie.genre.toLowerCase()) || 'drame',
    year: movie.year || 2024,
    duration: movie.duration || '2h',
    rating: movie.rating || 4.0,
    description: movie.description || '',
    thumbnail: '🎬',
    poster,
    banner: 'from-blue-600 to-cyan-500',
    isNew: movie.year >= 2024,
    isFeatured: movie.isPopular || false,
    videoUrl: movie.videoUrl || '',
    translations: movie.translations || undefined,
    episodes: Array.isArray(movie.episodes)
      ? movie.episodes
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((ep) => ({
            title: ep.title || '',
            duration: ep.duration || '',
            description: ep.description || '',
            videoUrl: ep.videoUrl || '',
            order: ep.order ?? 0,
          }))
      : [],
  };
}

/**
 * @param {string} language - Code langue (fr, en, ...)
 * @returns {{ moviesAndSeries, moviesLoading, movieToOpenFromFavorites, setMovieToOpenFromFavorites, refreshMovies }}
 */
export function useMoviesState(language) {
  const [moviesAndSeries, setMoviesAndSeries] = useState([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [movieToOpenFromFavorites, setMovieToOpenFromFavorites] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setMoviesLoading(true);
        const response = await apiService.getMovies(`lang=${language}&limit=20&page=1&_=${Date.now()}`);
        if (cancelled) return;
        const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        if (list.length > 0) {
          setMoviesAndSeries(list.map(transformMovie));
        } else {
          setMoviesAndSeries([]);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Erreur chargement films:', error);
          setMoviesAndSeries([]);
        }
      } finally {
        if (!cancelled) setMoviesLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [language, refreshKey]);

  useEffect(() => {
    let lastVisibleAt = 0;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastVisibleAt < 60000) return;
      lastVisibleAt = now;
      setRefreshKey((k) => k + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const refreshMovies = () => setRefreshKey((k) => k + 1);

  return {
    moviesAndSeries,
    moviesLoading,
    movieToOpenFromFavorites,
    setMovieToOpenFromFavorites,
    refreshMovies,
  };
}

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Clapperboard,
  Play,
  Heart,
  Star,
  ArrowLeft,
  ChevronDown,
} from 'lucide-react';
import { apiService, getStreamingVideoUrl, getPosterUrl } from '../services/apiService';
import MoviePlayer from './MoviePlayer';
import AdSlot from './AdSlot';
import {
  getMoviePlaybackKey,
  getMovieLastEpisodeKey,
  getPlaybackStorageKey,
  getSavedPlaybackPosition,
  saveMoviePlaybackPosition,
  saveMovieLastEpisode,
  runPlaybackMigrationIfNeeded,
} from '../hooks/useMoviePlayback';

// Clés de genre pour le filtre (valeurs telles que renvoyées par l’API)
const GENRE_IDS = [
  'all',
  'action',
  'drame',
  'aventure',
  'comédie',
  'romance',
];

function normalizeGenreKey(s) {
  if (!s || typeof s !== 'string') return '';
  return s
    .toLowerCase()
    .trim()
    .replace(/é|è|ê|ë/g, 'e')
    .replace(/à|â/g, 'a')
    .replace(/ù|û|ü/g, 'u')
    .replace(/î|ï/g, 'i')
    .replace(/ô/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, '');
}

function getTranslatedGenre(genreStr, t) {
  if (!genreStr || typeof genreStr !== 'string') return '';
  return genreStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const key = normalizeGenreKey(s);
      const translated = key ? t(`movies.genres.${key}`) : s;
      return translated !== `movies.genres.${key}` ? translated : s;
    })
    .join(', ');
}

export default function MoviesPage({ t, language, moviesAndSeries = [], moviesLoading = false, watchlist = [], toggleWatchlist, playbackStorageSuffix = 'guest', onSyncPlaybackToServer, initialSelectedMovie = null, initialAutoPlay = false, onClearInitialMovie, onVideoPlayStart, onVideoPlayEnd }) {
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState(0);
  const [isMoviePlaying, setIsMoviePlaying] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [movieProgress, setMovieProgress] = useState({});
  const [playbackPhase, setPlaybackPhase] = useState('content');
  const [currentAd, setCurrentAd] = useState(null);
  const midrollTriggeredRef = useRef(new Set());
  const midrollAlreadyTriggeredRef = useRef(false);
  const prerollConsumedRef = useRef(false);
  const midrollConfigRef = useRef({ seconds: [], percent: [50] });
  const playerContainerRef = useRef(null);
  const moviePlayerRef = useRef(null);
  const wasFullscreenBeforeAdRef = useRef(false);
  const fullscreenRequestedForAdRef = useRef(false);

  // Scroll vers le lecteur quand on sélectionne un film/série (clic sur une affiche)
  useEffect(() => {
    if (!selectedMovie) return;
    const el = playerContainerRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(id);
  }, [selectedMovie]);

  // Notifier le parent (App) quand la lecture vidéo démarre ou s'arrête → pause radio
  useEffect(() => {
    if (isMoviePlaying) onVideoPlayStart?.(); else onVideoPlayEnd?.();
    return () => { onVideoPlayEnd?.(); };
  }, [isMoviePlaying, onVideoPlayStart, onVideoPlayEnd]);

  // Charger la config des cue points mid-roll (uniquement % de la durée)
  useEffect(() => {
    apiService.getAdsConfig().then((res) => {
      const d = res?.data;
      if (d && Array.isArray(d.midrollCuePointsPercent)) {
        midrollConfigRef.current = {
          seconds: [],
          percent: d.midrollCuePointsPercent.length ? d.midrollCuePointsPercent : [50],
        };
      }
    }).catch(() => {});
  }, []);

  // Recharger le détail série pour avoir les épisodes à jour
  useEffect(() => {
    if (!selectedMovie?.id || selectedMovie?.type !== 'serie') return;
    let cancelled = false;
    apiService
      .get(`/movies/${selectedMovie.id}?lang=${language}`)
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data ?? res.data;
        if (!data?.episodes?.length) return;
        const episodes = data.episodes
          .slice()
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((ep) => ({
            title: ep.title || '',
            duration: ep.duration || '',
            videoUrl: ep.videoUrl || '',
            order: ep.order ?? 0,
          }));
        setSelectedMovie((prev) => (prev?.id === selectedMovie.id ? { ...prev, episodes } : prev));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedMovie?.id, selectedMovie?.type, language]);

  // Dernier épisode regardé pour les séries
  useEffect(() => {
    if (playbackStorageSuffix && playbackStorageSuffix !== 'guest') runPlaybackMigrationIfNeeded(playbackStorageSuffix);
  }, [playbackStorageSuffix]);

  useEffect(() => {
    if (!selectedMovie?.id || selectedMovie?.type !== 'serie' || !selectedMovie?.episodes?.length) return;
    const key = getMovieLastEpisodeKey(selectedMovie.id);
    try {
      const storageKey = getPlaybackStorageKey(playbackStorageSuffix);
      const raw = localStorage.getItem(storageKey);
      const data = raw ? JSON.parse(raw) : {};
      const idx = data[key];
      if (typeof idx === 'number' && idx >= 0 && idx < selectedMovie.episodes.length) {
        setSelectedEpisodeIndex(idx);
      }
    } catch {}
  }, [selectedMovie?.id, selectedMovie?.type, selectedMovie?.episodes, playbackStorageSuffix]);

  const currentEpisode =
    selectedMovie?.type === 'serie' &&
    Array.isArray(selectedMovie.episodes) &&
    selectedEpisodeIndex >= 0 &&
    selectedEpisodeIndex < selectedMovie.episodes.length
      ? selectedMovie.episodes[selectedEpisodeIndex]
      : null;

  const effectiveVideoUrl =
    selectedMovie?.type === 'serie' && currentEpisode?.videoUrl
      ? currentEpisode.videoUrl
      : selectedMovie?.videoUrl || '';

  const playbackKey = getMoviePlaybackKey(
    selectedMovie?.id,
    selectedMovie?.type === 'serie' ? selectedEpisodeIndex : null
  );
  const savedPosition = playbackKey ? getSavedPlaybackPosition(playbackKey, playbackStorageSuffix) : null;
  const startTime = savedPosition?.time > 0 ? savedPosition.time : 0;

  const streamUrl = effectiveVideoUrl ? getStreamingVideoUrl(effectiveVideoUrl) : '';
  const showPlayer = !!streamUrl && !String(effectiveVideoUrl || '').startsWith('blob:');

  // Réinitialiser les cue points mid-roll et le flag preroll à chaque changement de vidéo
  useEffect(() => {
    midrollTriggeredRef.current = new Set();
    midrollAlreadyTriggeredRef.current = false;
    prerollConsumedRef.current = false;
  }, [playbackKey]);

  // Ne plus déclencher le preroll à l'ouverture : il se déclenche au clic sur Play (voir handleVideoPlayOrLire)

  const handlePrerollComplete = useCallback(() => {
    setCurrentAd(null);
    setPlaybackPhase('content');
    setIsMoviePlaying(true);
    // Lancer la lecture directe une fois le MoviePlayer remonté (il n'est pas dans le DOM pendant le preroll)
    setTimeout(() => {
      moviePlayerRef.current?.play?.();
    }, 200);
  }, []);

  // Un seul handler pour le bouton « Lire » et le bouton play du lecteur vidéo — fonctionnalité à l’identique.
  const handleVideoPlayOrLire = useCallback(() => {
    if (isMoviePlaying) {
      setIsMoviePlaying(false);
      return;
    }
    if (!showPlayer) return;
    if (prerollConsumedRef.current) {
      setIsMoviePlaying(true);
      moviePlayerRef.current?.play?.(); // forcer la reprise immédiate après pause
      return;
    }
    // Pause radio dès le clic sur Lire (y compris pendant le preroll)
    onVideoPlayStart?.();
    // Capturer le plein écran avant de passer au preroll (sinon le navigateur le quitte au démontage du lecteur)
    wasFullscreenBeforeAdRef.current = !!(
      document.fullscreenElement || document.webkitFullscreenElement
    );
    prerollConsumedRef.current = true;
    setPlaybackPhase('preroll');
    setCurrentAd(null);
    apiService
      .getNextAd('preroll')
      .then((res) => {
        const data = res?.data;
        if (data?.videoUrl) {
          const adPayload = {
            id: data.id,
            videoUrl: data.videoUrl,
            skipAfterPercent: data.skipAfterPercent != null ? Math.min(100, Math.max(0, data.skipAfterPercent)) : 0,
          };
          setCurrentAd(adPayload);
          if (data.id) apiService.recordAdImpression(String(data.id));
        } else {
          setPlaybackPhase('content');
          setIsMoviePlaying(true);
          setTimeout(() => moviePlayerRef.current?.play?.(), 200);
        }
      })
      .catch(() => {
        setPlaybackPhase('content');
        setIsMoviePlaying(true);
        setTimeout(() => moviePlayerRef.current?.play?.(), 200);
      });
  }, [isMoviePlaying, showPlayer]);

  // Ouvrir un film depuis la page Favoris : appliquer la sélection et lancer la lecture si demandé
  useEffect(() => {
    if (!initialSelectedMovie) return;
    setSelectedMovie(initialSelectedMovie);
    onClearInitialMovie?.();
    if (!initialAutoPlay) return;
    const id = setTimeout(() => {
      handleVideoPlayOrLire();
    }, 500);
    return () => clearTimeout(id);
  }, [initialSelectedMovie, initialAutoPlay, onClearInitialMovie, handleVideoPlayOrLire]);

  const handleMidrollComplete = useCallback(() => {
    setCurrentAd(null);
    setPlaybackPhase('content');
    setIsMoviePlaying(true);
    // Lancer la lecture directe après le mid-roll
    setTimeout(() => {
      moviePlayerRef.current?.play?.();
    }, 200);
  }, []);

  const triggerMidroll = useCallback((atPercent) => {
    setIsMoviePlaying(false);
    setPlaybackPhase('midroll');
    apiService.getNextAd('midroll', atPercent).then((res) => {
      const data = res?.data;
      if (data?.videoUrl) {
        const adPayload = {
          id: data.id,
          videoUrl: data.videoUrl,
          skipAfterPercent: data.skipAfterPercent != null ? Math.min(100, Math.max(0, data.skipAfterPercent)) : 0,
        };
        setCurrentAd(adPayload);
        if (data.id) apiService.recordAdImpression(String(data.id));
      } else {
        setPlaybackPhase('content');
        setIsMoviePlaying(true);
      }
    }).catch(() => {
      setPlaybackPhase('content');
      setIsMoviePlaying(true);
    });
  }, []);

  const handleProgress = useCallback(
    (time, duration) => {
      if (!playbackKey) return;
      saveMoviePlaybackPosition(playbackKey, time, duration, playbackStorageSuffix);
      onSyncPlaybackToServer?.();
      if (selectedMovie?.type === 'serie' && selectedEpisodeIndex != null) {
        saveMovieLastEpisode(selectedMovie.id, selectedEpisodeIndex, playbackStorageSuffix);
      }
      // Mid-roll : cue points uniquement en % de la durée (MIDROLL_CUE_POINTS_PERCENT)
      // Une seule midroll par vidéo : une fois déclenchée, on ne redéclenche plus (évite double passage à 50% puis 50% du reste)
      if (playbackPhase === 'content' && typeof duration === 'number' && duration > 0 && !midrollAlreadyTriggeredRef.current) {
        const { percent: pctList } = midrollConfigRef.current;
        const cuePoints = [];
        for (const pct of pctList || []) {
          const t = Math.floor((duration * Math.min(100, Math.max(0, pct))) / 100);
          if (t > 0 && !cuePoints.includes(t)) cuePoints.push(t);
        }
        cuePoints.sort((a, b) => a - b);
        for (const threshold of cuePoints) {
          if (time >= threshold && !midrollTriggeredRef.current.has(threshold)) {
            midrollTriggeredRef.current.add(threshold);
            midrollAlreadyTriggeredRef.current = true;
            const atPercent = duration > 0 ? Math.min(100, Math.max(0, Math.round((threshold / duration) * 100))) : 50;
            // Capturer le plein écran avant de passer au mid-roll (sinon le navigateur le quitte au démontage du lecteur)
            wasFullscreenBeforeAdRef.current = !!(
              document.fullscreenElement ||
              document.webkitFullscreenElement
            );
            const inFullscreen = wasFullscreenBeforeAdRef.current;
            const container = playerContainerRef.current;

            if (inFullscreen && container) {
              // La vidéo est déjà en plein écran : garder le plein écran pour le mid-roll.
              // On transfère le plein écran sur le conteneur AVANT de lancer le mid-roll,
              // ainsi quand la vidéo est remplacée par la pub, le conteneur reste en plein écran.
              const exitFs = document.exitFullscreen || document.webkitExitFullscreen;
              const reqFs = container.requestFullscreen || container.webkitRequestFullscreen || container.mozRequestFullScreen || container.msRequestFullscreen;
              if (typeof exitFs === 'function' && typeof reqFs === 'function') {
                exitFs.call(document).then(() => {
                  // Un tick pour que le navigateur enregistre la sortie avant de repasser sur le conteneur
                  requestAnimationFrame(() => {
                    reqFs.call(container).then(() => {
                      fullscreenRequestedForAdRef.current = true;
                      triggerMidroll(atPercent);
                    }).catch(() => triggerMidroll(atPercent));
                  });
                }).catch(() => triggerMidroll(atPercent));
                return;
              }
            }
            triggerMidroll(atPercent);
            return;
          }
        }
      }
    },
    [playbackKey, selectedMovie?.id, selectedMovie?.type, selectedEpisodeIndex, playbackStorageSuffix, playbackPhase, triggerMidroll, onSyncPlaybackToServer]
  );

  // Réactiver le plein écran quand une pub (preroll ou mid-roll) s'affiche — le conteneur reste monté, on repasse en plein écran après rendu de l'ad
  useEffect(() => {
    const isAdPhase = (playbackPhase === 'preroll' || playbackPhase === 'midroll') && currentAd;
    if (!isAdPhase || !wasFullscreenBeforeAdRef.current) return;
    const el = playerContainerRef.current;
    if (!el) return;
    wasFullscreenBeforeAdRef.current = false;
    const req =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;
    if (typeof req !== 'function') return;
    // Délai court pour laisser le DOM (AdSlot) se monter avant de demander le plein écran
    const t = setTimeout(() => {
      req.call(el).catch(() => {});
      fullscreenRequestedForAdRef.current = true;
    }, 150);
    return () => clearTimeout(t);
  }, [playbackPhase, currentAd]);

  // Après la fin du preroll/mid-roll : réactiver le plein écran sur le conteneur (le passage à MoviePlayer peut le faire quitter)
  useEffect(() => {
    if (playbackPhase !== 'content' || !fullscreenRequestedForAdRef.current) return;
    const el = playerContainerRef.current;
    if (!el) return;
    fullscreenRequestedForAdRef.current = false;
    const req =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen;
    if (typeof req !== 'function') return;
    const t = setTimeout(() => {
      req.call(el).catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [playbackPhase]);

  const handlePauseWithProgress = useCallback(
    (time, duration) => {
      if (!playbackKey) return;
      saveMoviePlaybackPosition(playbackKey, time, duration, playbackStorageSuffix);
      onSyncPlaybackToServer?.();
      if (selectedMovie?.type === 'serie' && selectedEpisodeIndex != null) {
        saveMovieLastEpisode(selectedMovie.id, selectedEpisodeIndex, playbackStorageSuffix);
      }
      if (selectedMovie?.id && typeof duration === 'number' && duration > 0) {
        const percent = Math.min(100, Math.round((time / duration) * 100));
        setMovieProgress((p) => ({ ...p, [selectedMovie.id]: percent }));
      }
    },
    [playbackKey, selectedMovie?.id, selectedMovie?.type, selectedEpisodeIndex, playbackStorageSuffix, onSyncPlaybackToServer]
  );

  // Synchroniser les barres de progression depuis le storage
  useEffect(() => {
    if (!moviesAndSeries.length) return;
    const next = {};
    moviesAndSeries.forEach((item) => {
      let maxPercent = 0;
      if (item.type === 'film') {
        const pos = getSavedPlaybackPosition(getMoviePlaybackKey(item.id, null), playbackStorageSuffix);
        if (pos?.percent != null) maxPercent = pos.percent;
        else if (pos?.time > 0) maxPercent = 1;
      } else {
        (item.episodes || []).forEach((_, i) => {
          const pos = getSavedPlaybackPosition(getMoviePlaybackKey(item.id, i), playbackStorageSuffix);
          if (pos?.percent != null && pos.percent > maxPercent) maxPercent = pos.percent;
          else if (pos?.time > 0 && maxPercent < 1) maxPercent = 1;
        });
      }
      if (maxPercent > 0) next[item.id] = maxPercent;
    });
    setMovieProgress((p) => ({ ...p, ...next }));
  }, [moviesAndSeries, playbackStorageSuffix]);

  // Réactualiser les barres de progression quand on ferme le détail (retour à la liste)
  useEffect(() => {
    if (selectedMovie != null) return;
    if (!moviesAndSeries.length) return;
    const next = {};
    moviesAndSeries.forEach((item) => {
      let maxPercent = 0;
      if (item.type === 'film') {
        const pos = getSavedPlaybackPosition(getMoviePlaybackKey(item.id, null), playbackStorageSuffix);
        if (pos?.percent != null) maxPercent = pos.percent;
        else if (pos?.time > 0) maxPercent = 1;
      } else {
        (item.episodes || []).forEach((_, i) => {
          const pos = getSavedPlaybackPosition(getMoviePlaybackKey(item.id, i), playbackStorageSuffix);
          if (pos?.percent != null && pos.percent > maxPercent) maxPercent = pos.percent;
          else if (pos?.time > 0 && maxPercent < 1) maxPercent = 1;
        });
      }
      if (maxPercent > 0) next[item.id] = maxPercent;
    });
    setMovieProgress((p) => ({ ...p, ...next }));
  }, [selectedMovie, moviesAndSeries, playbackStorageSuffix]);

  const filteredContent = useMemo(
    () =>
      moviesAndSeries.filter((item) => {
        const genreOk = selectedGenre === 'all' || (item.genre && item.genre.toLowerCase() === selectedGenre);
        const typeOk = filterType === 'all' || item.type === filterType;
        return genreOk && typeOk;
      }),
    [moviesAndSeries, selectedGenre, filterType]
  );

  const featured = useMemo(() => moviesAndSeries.find((item) => item.isFeatured), [moviesAndSeries]);

  return (
    <motion.div
      key="movies"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-slate-100"
    >
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-5 py-4 sm:py-5 pb-8 space-y-4">
        <header className="rounded-2xl overflow-hidden shadow-lg bg-[#264FFF] px-5 py-4 sm:px-6 sm:py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30">
              <Clapperboard size={22} strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold truncate">{t('movies.title')}</h1>
              <p className="text-xs text-white/90 truncate">{t('movies.subtitle')}</p>
            </div>
          </div>
        </header>

        {/* Filtres */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <div className="flex flex-row flex-nowrap items-end gap-3">
            <div className="flex-1 min-w-0 sm:min-w-[140px] max-w-[200px]">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                {t('movies.typeLabel')}
              </label>
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#264FFF]/25 focus:border-[#264FFF] cursor-pointer"
                  aria-label={t('movies.typeFilter')}
                >
                  <option value="all">{t('movies.all')}</option>
                  <option value="film">{t('movies.films')}</option>
                  <option value="serie">{t('movies.series')}</option>
                </select>
                <ChevronDown size={18} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
            <div className="flex-1 min-w-0 sm:min-w-[160px] max-w-[200px]">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                {t('movies.genreLabel')}
              </label>
              <div className="relative">
                <select
                  value={selectedGenre}
                  onChange={(e) => setSelectedGenre(e.target.value)}
                  className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#264FFF]/25 focus:border-[#264FFF] cursor-pointer"
                  aria-label={t('movies.genreLabel')}
                >
                  {GENRE_IDS.map((gId) => (
                    <option key={gId} value={gId}>
                      {t(`movies.genres.${normalizeGenreKey(gId)}`)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Bloc détail ou à la une */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          {selectedMovie ? (
            <div className="flex flex-col">
              {/* Lecteur HLS / MP4 ou pub */}
              <div
                ref={playerContainerRef}
                className="relative w-full bg-black min-h-[200px] aspect-video max-h-[420px] flex items-center justify-center"
              >
                {!showPlayer ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500">
                    <Play size={32} className="text-slate-500 mb-3" />
                    <p className="text-slate-300 font-medium">
                      {selectedMovie.type === 'serie' ? t('movies.episodesAvailable') : t('movies.watch')}
                    </p>
                    <p className="text-sm mt-1">
                      {selectedMovie.type === 'serie'
                        ? 'Sélectionnez un épisode ci-dessous.'
                        : 'Aucune vidéo disponible.'}
                    </p>
                  </div>
                ) : (playbackPhase === 'preroll' || playbackPhase === 'midroll') && currentAd ? (
                  <AdSlot
                    adUrl={currentAd.videoUrl}
                    skipAfterPercent={playbackPhase === 'midroll' ? (currentAd.skipAfterPercent ?? 0) : 0}
                    onComplete={playbackPhase === 'midroll' ? handleMidrollComplete : handlePrerollComplete}
                  />
                ) : playbackPhase === 'preroll' && !currentAd ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-white/80">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/30 border-t-white mb-3" />
                    <p className="text-sm">Chargement…</p>
                  </div>
                ) : playbackPhase === 'content' ? (
                  <MoviePlayer
                    ref={moviePlayerRef}
                    key={`${selectedMovie.id}-${selectedEpisodeIndex}-${effectiveVideoUrl}`}
                    streamUrl={streamUrl}
                    startTime={startTime}
                    isPlaying={isMoviePlaying}
                    onPlay={handleVideoPlayOrLire}
                    onPause={() => setIsMoviePlaying(false)}
                    onProgress={handleProgress}
                    onPauseWithProgress={handlePauseWithProgress}
                    onError={() => setIsMoviePlaying(false)}
                    className="w-full h-full object-contain"
                  />
                ) : null}
              </div>

              {/* Retour + titre + métadonnées + Favoris */}
              <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-4">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMovie(null);
                      setIsMoviePlaying(false);
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    aria-label={t('common.back')}
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight">
                      {(selectedMovie.translations?.[language]?.title) ?? selectedMovie.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600">
                        {selectedMovie.type === 'film' ? t('movies.films') : t('movies.series')}
                      </span>
                      <span className="text-xs text-slate-500">{selectedMovie.year}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <Star size={12} className="fill-current" />
                        {selectedMovie.rating}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleWatchlist(selectedMovie.id)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                      watchlist.includes(selectedMovie.id)
                        ? 'border-[#264FFF] bg-[#264FFF]/10 text-[#264FFF]'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                    aria-label={t('common.favorites')}
                    title={t('common.favorites')}
                  >
                    <Heart size={20} className={watchlist.includes(selectedMovie.id) ? 'fill-current' : ''} />
                  </button>
                </div>
              </div>

              {/* Description */}
              {((selectedMovie.translations?.[language]?.description) ?? selectedMovie.description) && (
                <div className="px-4 sm:px-5 pb-4 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider pt-3 pb-1.5">
                    {t('movies.description')}
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {(selectedMovie.translations?.[language]?.description) ?? selectedMovie.description}
                  </p>
                </div>
              )}

              {/* Épisodes (séries) */}
              {selectedMovie.type === 'serie' && Array.isArray(selectedMovie.episodes) && selectedMovie.episodes.length > 0 && (
                <div className="px-4 sm:px-5 pb-4 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider pt-3 pb-2">
                    {t('movies.episodesAvailable')}
                  </p>
                  <ul className="space-y-2">
                    {selectedMovie.episodes.map((ep, index) => {
                      const hasVideo = !!(ep.videoUrl && String(ep.videoUrl).trim());
                      const isSelected = selectedEpisodeIndex === index;
                      return (
                        <li key={index}>
                          <button
                            type="button"
                            onClick={() => {
                              if (hasVideo) {
                                setSelectedEpisodeIndex(index);
                                setIsMoviePlaying(false);
                              }
                            }}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-colors ${
                              isSelected
                                ? 'border-[#264FFF] bg-[#264FFF]/5'
                                : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                            }`}
                          >
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                                isSelected ? 'bg-[#264FFF] text-white' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900">
                                {ep.title || `Episode ${index + 1}`}
                              </p>
                              {ep.duration && (
                                <p className="text-xs text-slate-500">{ep.duration}</p>
                              )}
                            </div>
                            {hasVideo && (
                              <div className="rounded-full bg-[#264FFF] p-2 text-white shrink-0">
                                <Play size={16} className="fill-current" />
                              </div>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

            </div>
          ) : featured ? (
            <button
              type="button"
              onClick={() => {
                setSelectedMovie(featured);
                setIsMoviePlaying(false);
              }}
              className="w-full text-left rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm group"
            >
              <div className="poster-netflix relative aspect-[2.4/1] min-h-[120px] bg-slate-800 overflow-hidden">
                {featured.poster ? (
                  <img
                    src={getPosterUrl(featured.poster)}
                    alt={(featured.translations?.[language]?.title) ?? featured.title}
                    className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`absolute inset-0 flex items-center justify-center text-3xl text-white bg-slate-700 ${featured.poster ? 'hidden' : ''}`}>
                  🎬
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                <div className="absolute inset-0 flex flex-col justify-end p-4 text-white">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-white/90">
                    {featured.type === 'film' ? t('movies.films') : t('movies.series')} · À la une
                  </span>
                  <h2 className="text-lg font-bold mt-1">
                    {(featured.translations?.[language]?.title) ?? featured.title}
                  </h2>
                  <span className="inline-flex items-center gap-1 mt-1 text-amber-300 text-xs">
                    <Star size={12} className="fill-current" />
                    {featured.rating}
                  </span>
                </div>
              </div>
            </button>
          ) : null}

          {/* Catalogue */}
          <section className="px-4 sm:px-5 pb-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">
              Catalogue
              {filteredContent.length > 0 && (
                <span className="text-slate-500 font-normal ml-1">({filteredContent.length})</span>
              )}
            </h3>
            {moviesLoading ? (
              <div className="rounded-xl bg-white border border-slate-200 py-10 text-center">
                <p className="text-slate-600 text-sm">Chargement…</p>
              </div>
            ) : filteredContent.length === 0 ? (
              <div className="rounded-xl bg-white border border-slate-200 py-10 text-center">
                <p className="text-slate-600 text-sm">{t('common.noResults')}</p>
                <p className="text-xs text-slate-500 mt-1">Modifiez les filtres.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-stretch">
                {filteredContent.map((item) => (
                  <motion.button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedMovie(item);
                      setIsMoviePlaying(false);
                    }}
                    whileHover={{ scale: 1.02 }}
                    className="text-left rounded-xl bg-white border border-slate-200 overflow-hidden group shadow-sm hover:shadow-md transition-shadow flex flex-col h-full min-w-0"
                  >
                    <div
                      className="poster-netflix relative w-full flex-shrink-0 overflow-hidden rounded-t-xl"
                      style={{ aspectRatio: '2/3' }}
                    >
                      {item.poster ? (
                        <img
                          src={getPosterUrl(item.poster)}
                          alt={(item.translations?.[language]?.title) ?? item.title}
                          className="absolute inset-0 w-full h-full object-cover object-center"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`absolute inset-0 flex items-center justify-center text-3xl text-white bg-slate-700 ${item.poster ? 'hidden' : ''}`}>
                        🎬
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="rounded-full bg-white/95 p-3 shadow-lg">
                          <Play size={24} className="text-slate-900 fill-slate-900" />
                        </div>
                      </div>
                      <span className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-semibold uppercase tracking-wide">
                        {item.type === 'film' ? t('movies.films') : t('movies.series')}
                      </span>
                      {movieProgress[item.id] > 0 && movieProgress[item.id] < 100 && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700/80">
                          <div
                            className="h-full bg-[#264FFF]"
                            style={{ width: `${movieProgress[item.id]}%` }}
                          />
                        </div>
                      )}
                      <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-xs text-amber-300">
                        <Star size={12} className="fill-current" />
                        {item.rating}
                      </span>
                    </div>
                    <div className="p-3 flex-1 flex flex-col min-h-0">
                      <h4 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight">
                        {(item.translations?.[language]?.title) ?? item.title}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 flex-shrink-0">
                        {item.year}
                        {item.genre ? ` · ${getTranslatedGenre(item.genre, t)}` : ''}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </motion.div>
  );
}

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Play, Pause, Volume2, Music2, SkipBack, SkipForward, Heart, ChevronRight } from 'lucide-react';

export default function RadioPage({
  t,
  radioStations,
  currentRadio,
  toggleRadio,
  isPlaying,
  volume,
  onVolumeChange,
  isFavorite,
  toggleFavorite,
  loading,
  getRadioLogoUrl,
  isDirectStream = false,
  getRadioStreamProgress = null,
}) {
  const filteredStations = radioStations;

  // Traduit le genre de la station si c'est une valeur connue (ex. Variétés)
  const getGenreLabel = (genre) => {
    if (!genre || typeof genre !== 'string') return '';
    const g = genre.trim().toLowerCase();
    if (
      g === 'variétés' ||
      g === 'varietes' ||
      g === 'variety' ||
      g === 'varietà' ||
      g === 'variedad' ||
      g === 'varieté'
    )
      return t('radio.genreVarieties');
    return genre;
  };

  // Progression streaming (programmation) : position/durée du créneau courant selon l'heure serveur
  const [streamProgress, setStreamProgress] = React.useState({ positionSeconds: 0, durationSeconds: 1 });
  React.useEffect(() => {
    if (!currentRadio || !isPlaying || isDirectStream || typeof getRadioStreamProgress !== 'function') return;
    const tick = () => {
      const p = getRadioStreamProgress();
      if (p && p.durationSeconds > 0)
        setStreamProgress({ positionSeconds: p.positionSeconds, durationSeconds: p.durationSeconds });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [currentRadio, isPlaying, isDirectStream, getRadioStreamProgress]);

  return (
    <motion.div
      key="radio"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-slate-50"
    >
      <div className="mx-auto w-full max-w-5xl px-3 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-6 sm:space-y-8 pb-32">
        {/* En-tête — même esprit que page Shop (bloc bleu) */}
        <header className="space-y-4">
          <div
            className="rounded-2xl p-4 sm:p-6 shadow-lg border border-blue-200/50"
            style={{ backgroundColor: '#264FFF' }}
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white/20 border border-white/30 flex-shrink-0 backdrop-blur-sm">
                <Radio size={24} className="text-white sm:w-6 sm:h-6" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t('radio.title')}</h1>
                <p className="text-sm text-blue-100 mt-1">{t('radio.curatedAmbiences')}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Bloc lecteur / état vide */}
        <section>
          <div
            className={`rounded-2xl overflow-hidden flex flex-col shadow-lg border ${
              currentRadio
                ? 'min-h-[280px] sm:min-h-[300px] bg-white border-slate-200/80 shadow-xl shadow-slate-200/50'
                : 'min-h-[180px] sm:min-h-[200px] bg-gradient-to-b from-slate-50 to-white border-slate-200/80'
            }`}
          >
            <div className="relative flex-1 flex flex-col p-6 sm:p-8">
              {currentRadio ? (
                <>
                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
                    <div className="flex justify-center sm:flex-shrink-0">
                      <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-xl overflow-hidden bg-slate-100 ring-1 ring-slate-200/60">
                        {getRadioLogoUrl(currentRadio.logo) ? (
                          <img
                            src={getRadioLogoUrl(currentRadio.logo)}
                            alt={currentRadio.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const next = e.target.nextElementSibling;
                              if (next) next.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <span
                          className={`absolute inset-0 flex items-center justify-center text-slate-400 ${getRadioLogoUrl(currentRadio.logo) ? 'hidden' : ''}`}
                          aria-hidden
                        >
                          <Music2 size={48} className="w-12 h-12 sm:w-14 sm:h-14" strokeWidth={1.5} />
                        </span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col items-center sm:items-start text-center sm:text-left">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
                        <span className="text-[11px] text-slate-400 uppercase tracking-widest">Live</span>
                        {isDirectStream && (
                          <span className="text-[10px] text-slate-400" title={t('radio.directNoSeek')}>
                            • Direct
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg sm:text-xl font-semibold text-slate-900 truncate w-full">
                        {currentRadio.currentlyPlaying || '—'}
                      </h2>
                      <p className="text-slate-500 text-sm mt-0.5 truncate w-full">
                        {currentRadio.name}
                        {currentRadio.bitrate ? ` · ${currentRadio.bitrate}` : ''}
                      </p>

                      <div className="flex items-center gap-3 mt-5">
                        <button
                          type="button"
                          aria-label={t('radio.previous')}
                          disabled={isDirectStream}
                          className={`p-2 transition-colors ${isDirectStream ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600'}`}
                          title={isDirectStream ? t('radio.directNoSeek') : t('radio.previous')}
                        >
                          <SkipBack size={18} />
                        </button>
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.96 }}
                          onClick={() => toggleRadio(currentRadio)}
                          aria-label={isPlaying ? t('common.pause') : t('radio.playLabel')}
                          className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-slate-900 text-white"
                        >
                          {isPlaying ? (
                            <Pause size={24} className="sm:w-6 sm:h-6" />
                          ) : (
                            <Play size={24} className="ml-0.5 sm:w-6 sm:h-6" fill="currentColor" />
                          )}
                        </motion.button>
                        <button
                          type="button"
                          aria-label={t('radio.next')}
                          disabled={isDirectStream}
                          className={`p-2 transition-colors ${isDirectStream ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600'}`}
                          title={isDirectStream ? t('radio.directNoSeek') : t('radio.next')}
                        >
                          <SkipForward size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="relative z-10 flex items-center gap-3 pt-5">
                    <div className="flex-1 h-0.5 bg-slate-200 rounded-full overflow-hidden">
                      {!isDirectStream && streamProgress.durationSeconds > 0 ? (
                        <motion.div
                          className="h-full rounded-full min-w-[2px] bg-slate-500"
                          initial={false}
                          animate={{
                            width: `${Math.min(100, (streamProgress.positionSeconds / streamProgress.durationSeconds) * 100)}%`,
                          }}
                          transition={{ duration: 0.3 }}
                        />
                      ) : (
                        <motion.div
                          className="h-full rounded-full min-w-[2px] bg-slate-400"
                          animate={{ width: isPlaying ? '30%' : '0%' }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="relative z-10 flex items-center gap-3 pt-3">
                    <button
                      type="button"
                      onClick={toggleFavorite}
                      aria-label={isFavorite ? t('radio.removeFromFavorites') : t('radio.addToFavorites')}
                      className={`p-2 transition-colors ${isFavorite ? 'text-rose-400' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <Heart size={18} className={isFavorite ? 'fill-current' : ''} />
                    </button>
                    <div className="flex items-center gap-2 flex-1 max-w-[140px]">
                      <Volume2 size={16} className="text-slate-400 shrink-0" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => onVolumeChange(e)}
                        aria-label={t('radio.volume')}
                        className="w-full h-0.5 bg-slate-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-500 [&::-webkit-slider-thumb]:cursor-pointer"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-center">
                  <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-sky-50 border border-sky-100 text-sky-500 mb-4">
                    <Music2 size={28} className="sm:w-8 sm:h-8" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold text-slate-800">{t('radio.chooseStation')}</h2>
                  <p className="text-sm text-slate-500 mt-1.5 max-w-xs">{t('radio.selectStationHint')}</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Liste des stations */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-base font-semibold text-slate-700 tracking-tight">{t('radio.allStations')}</h2>
              <p className="text-xs text-slate-500 mt-1">{t('radio.selectStationToListen')}</p>
            </div>
            <span className="shrink-0 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              {loading ? '…' : `${filteredStations.length} ${t('radio.stations')}`}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center min-h-[280px] rounded-2xl bg-white border border-slate-200/80">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-slate-500" />
                <p className="text-xs text-slate-500">{t('radio.loading')}</p>
              </div>
            </div>
          ) : filteredStations.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200/80 px-4 py-8 text-center">
              <p className="text-slate-800 font-medium text-sm">{t('radio.noStations')}</p>
              <p className="text-xs text-slate-500 mt-1.5">{t('radio.comeBackLater')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
              <AnimatePresence mode="popLayout">
                {filteredStations.map((station, index) => {
                  const isActive = currentRadio?.id === station.id;
                  return (
                    <motion.button
                      key={station.id}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => toggleRadio(station)}
                      whileTap={{ scale: 0.99 }}
                      className={`w-full text-left rounded-2xl border p-4 shadow-sm transition-all flex gap-4 items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 min-h-[100px] ${
                        isActive
                          ? 'bg-sky-50/90 border-sky-200 hover:shadow-md hover:border-sky-300/80'
                          : 'bg-white border-slate-200/80 hover:shadow-md hover:border-slate-300/80'
                      }`}
                    >
                      <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                        {getRadioLogoUrl(station.logo) ? (
                          <>
                            <img
                              src={getRadioLogoUrl(station.logo)}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                e.target.style.display = 'none';
                                const wrap = e.target.closest('div');
                                const fallback = wrap?.querySelector('[data-fallback]');
                                if (fallback) fallback.classList.remove('hidden');
                              }}
                            />
                            <div
                              data-fallback
                              className="absolute inset-0 hidden items-center justify-center bg-slate-200 text-slate-400"
                            >
                              <Music2 size={32} strokeWidth={1.5} />
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-slate-200 text-slate-400">
                            <Music2 size={32} strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          {station.genre && (
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                              {getGenreLabel(station.genre)}
                            </span>
                          )}
                          {isActive && (
                            <span className="text-[10px] font-semibold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                              {t('radio.listening')}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
                          {station.name || t('radio.stationFallback')}
                        </h3>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {station.description || t('radio.listenLive')}
                          {station.bitrate ? ` • ${station.bitrate}` : ''}
                          {station.listeners != null ? ` • ${station.listeners} ${t('radio.listeners')}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                        <div
                          className={`p-2 rounded-xl transition-colors ${
                            isActive
                              ? 'bg-sky-500 text-white'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-700'
                          }`}
                        >
                          {isActive && isPlaying ? (
                            <Pause size={18} className="fill-current" strokeWidth={1.75} />
                          ) : (
                            <Play size={18} className="fill-current ml-0.5" strokeWidth={1.75} />
                          )}
                        </div>
                        <ChevronRight
                          size={18}
                          className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all"
                        />
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>
      </div>
    </motion.div>
  );
}

/**
 * Contenu de la page WebTV — chaînes, lecteur, grille (audit CTO — découpage App.jsx).
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Tv, ArrowLeft, Play, ChevronRight } from 'lucide-react';

export default function WebtvPageContent({
  t,
  setPage,
  selectedChannelCategory,
  setSelectedChannelCategory,
  channelCategories,
  selectedChannel,
  setSelectedChannel,
  selectedWebtvProgram,
  webtvVideoRefRef,
  setWebtvVideoRef,
  handleWebtvVideoEnded,
  handleWebtvPlayByServerTime,
  webtvVideoError,
  setWebtvVideoError,
  webtvPlaySyncing,
  setIsWebtvVideoPlaying,
  webtvLoading,
  filteredChannels,
  getWebtvCategoryLabel,
}) {
  return (
    <motion.div
      key="webtv"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-slate-50"
    >
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8 pb-32">
        <header className="space-y-4">
          <div className="rounded-2xl p-3 sm:p-4 shadow-md border border-blue-200/50" style={{ backgroundColor: '#264FFF' }}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-white/20 border border-white/30 flex-shrink-0 backdrop-blur-sm">
                <Tv size={20} className="text-white sm:w-5 sm:h-5" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">{t('webtv.titlePage')}</h1>
                <p className="text-xs text-blue-100 mt-0.5 max-w-xl">{t('webtv.subtitle')}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="w-full max-w-xs">
          <select
            value={selectedChannelCategory}
            onChange={(e) => setSelectedChannelCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm font-semibold border border-slate-200/80 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300"
            aria-label={t('webtv.filterByCategory') || 'Filtrer par catégorie'}
          >
            {channelCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {t(category.nameKey)}
              </option>
            ))}
          </select>
        </div>

        {selectedChannel ? (
          <div className="rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-lg">
            <div className="flex flex-col">
              <div className="flex items-center gap-3 px-4 sm:px-6 py-4 sm:py-5 bg-[#264FFF]">
                <button
                  onClick={() => { setPage('webtv'); setSelectedChannel(null); }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/90 hover:bg-white/20 transition-colors"
                  aria-label={t('common.back')}
                >
                  <ArrowLeft size={22} strokeWidth={2} />
                </button>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg sm:text-xl font-bold text-white truncate">{selectedChannel.name}</h2>
                </div>
              </div>
              <div className="relative aspect-video max-h-52 sm:max-h-72 bg-slate-900">
                {selectedWebtvProgram ? (
                  <>
                    <video
                      key={selectedWebtvProgram.streamUrl || selectedWebtvProgram.videoFile || 'webtv'}
                      ref={(el) => {
                        webtvVideoRefRef.current = el;
                        setWebtvVideoRef(el);
                      }}
                      className="absolute inset-0 w-full h-full object-contain bg-black webtv-video-no-progress"
                      controls
                      playsInline
                      preload="auto"
                      crossOrigin="anonymous"
                      onPlay={() => setIsWebtvVideoPlaying(true)}
                      onPause={() => setIsWebtvVideoPlaying(false)}
                      onEnded={handleWebtvVideoEnded}
                      onError={() => setWebtvVideoError(true)}
                    />
                    {webtvVideoError && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white p-4 text-center">
                        <p className="text-sm font-medium mb-1">{t('webtv.loadError') || 'Impossible de charger la vidéo'}</p>
                        <p className="text-xs text-white/80">{t('webtv.loadErrorHint') || 'Vérifiez votre connexion ou réessayez.'}</p>
                        <button
                          type="button"
                          onClick={() => { setWebtvVideoError(false); handleWebtvPlayByServerTime(); }}
                          className="mt-3 px-4 py-2 rounded-lg bg-[#264FFF] text-white text-sm font-medium"
                        >
                          {t('webtv.retry') || 'Réessayer'}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <img
                      src={selectedChannel.image}
                      alt={selectedChannel.name}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <div className="absolute inset-0 hidden items-center justify-center text-4xl text-white bg-slate-700">{selectedChannel.logo}</div>
                  </>
                )}
              </div>
              {selectedChannel.programs?.some(p => (p.streamUrl && p.streamUrl.trim()) || (p.videoFile && String(p.videoFile).trim())) && (
                <div className="px-4 sm:px-6 py-3 bg-white border-b border-slate-200">
                  <button
                    type="button"
                    onClick={handleWebtvPlayByServerTime}
                    disabled={webtvPlaySyncing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#264FFF] text-white font-semibold text-sm hover:bg-[#1e3ed8] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                    aria-label={t('webtv.playNow')}
                  >
                    {webtvPlaySyncing ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden />
                        {t('webtv.syncing') || 'Synchronisation…'}
                      </>
                    ) : (
                      <>
                        <Play size={18} className="fill-current" strokeWidth={2} />
                        {t('webtv.playNow')}
                      </>
                    )}
                  </button>
                </div>
              )}
              {(() => {
                const dbSchedule = selectedChannel.schedule && Array.isArray(selectedChannel.schedule) ? selectedChannel.schedule : [];
                const hasPrograms = selectedChannel.programs && selectedChannel.programs.length > 0;
                const buildFromPrograms = dbSchedule.length === 0 && hasPrograms && selectedChannel.programs.some(p => (p.startTime || p.endTime) && (p.title || p.program));
                const toProgramLabel = (val) => {
                  if (val == null) return '';
                  if (typeof val === 'string') return val;
                  if (typeof val === 'object' && val !== null && typeof val.title === 'string') return val.title;
                  return '';
                };
                const displaySchedule = dbSchedule.length > 0
                  ? dbSchedule.map(s => ({ time: s.time || '', program: toProgramLabel(s.program) || toProgramLabel(s.title) || '' }))
                  : buildFromPrograms
                    ? selectedChannel.programs
                        .filter(p => p.startTime || p.endTime)
                        .map(p => ({
                            time: [p.startTime, p.endTime].filter(Boolean).join(' - ').trim() || '00:00',
                            program: toProgramLabel(p.title) || toProgramLabel(p.program) || ''
                          }))
                    : [];
                if (displaySchedule.length === 0) return null;
                const toMins = (str) => {
                  if (!str) return 0;
                  const [h, m] = str.split(':').map(n => parseInt(n, 10) || 0);
                  return h * 60 + m;
                };
                return (
                  <div className="border-t border-slate-200 bg-white px-4 sm:px-6 py-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">{t('webtv.daySchedule')}</p>
                    <div className="rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-200/80 mt-2">
                      {displaySchedule.map((item, index) => {
                        const timeStr = (item.time || '').trim();
                        const parts = timeStr.includes(' - ') ? timeStr.split(' - ').map(p => p.trim()) : [timeStr];
                        const startMins = toMins(parts[0]);
                        let endMins = parts[1] ? toMins(parts[1]) : startMins + 180;
                        if (endMins <= startMins) endMins += 24 * 60;
                        const now = new Date();
                        const nowMins = now.getHours() * 60 + now.getMinutes();
                        const isCurrent = nowMins >= startMins && nowMins < endMins;
                        const isStreaming = selectedWebtvProgram && (item.program === selectedWebtvProgram.title || item.program === (selectedWebtvProgram.program || ''));
                        return (
                          <div key={index} className={`flex items-center gap-4 px-4 sm:px-5 py-4 transition-colors ${isCurrent ? 'bg-sky-100/90 border-l-4 border-l-[#264FFF]' : 'bg-slate-50/70 hover:bg-slate-100/80'}`}>
                            <span className={`text-xs font-semibold tabular-nums shrink-0 flex items-center gap-2 min-w-[7rem] ${isCurrent ? 'text-[#264FFF]' : 'text-sky-600'}`}>
                              {isStreaming ? (
                                <span className="flex items-center gap-1.5 text-red-600">
                                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" aria-hidden />
                                  <span className="text-[10px] font-bold uppercase">{t('webtv.live')}</span>
                                </span>
                              ) : isCurrent ? (
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" aria-hidden />
                              ) : null}
                              {item.time}
                            </span>
                            <span className={`text-sm flex-1 font-medium ${isCurrent ? 'text-slate-900' : 'text-slate-700'}`}>{item.program}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ) : (
          <>
            {webtvLoading ? (
              <div className="flex items-center justify-center min-h-[300px] rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-slate-500" />
                  <p className="text-sm text-slate-500">Chargement…</p>
                </div>
              </div>
            ) : filteredChannels.length === 0 ? (
              <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-6 py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 mb-5">
                  <Tv size={32} strokeWidth={1.5} />
                </div>
                <p className="text-slate-800 font-semibold text-sm">{t('webtv.availableChannels')}</p>
                <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">{t('webtv.noChannelMatch')}</p>
              </div>
            ) : (
              <section className="space-y-4">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-500 tracking-widest uppercase">{t('webtv.availableChannels')}</h2>
                    <p className="text-xs text-slate-500 mt-1">{t('webtv.selectChannelToWatch')}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                    {filteredChannels.length} {filteredChannels.length !== 1 ? t('webtv.channels') : t('webtv.channel')}
                  </span>
                </div>
                <div className="space-y-3">
                  {filteredChannels.map((channel, chIndex) => (
                    <motion.button
                      key={`channel-${channel.id}-${chIndex}`}
                      type="button"
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelectedChannel(channel)}
                      className="w-full text-left rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm transition-all flex gap-4 sm:gap-5 items-center group bg-white hover:shadow-md hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2"
                    >
                      <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                        <img
                          src={channel.image}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          decoding="async"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const wrap = e.target.closest('div');
                            const fallback = wrap?.querySelector('[data-fallback]');
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                        <div data-fallback className="absolute inset-0 hidden items-center justify-center bg-slate-200 text-2xl">
                          {channel.logo || '📺'}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          {channel.category && (
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                              {getWebtvCategoryLabel(channel.category, t)}
                            </span>
                          )}
                          {channel.isLive && (
                            <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                              <span className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                              {t('webtv.live')}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">
                          {channel.name || t('webtv.channelFallback')}
                        </h3>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {channel.description || t('webtv.channelsOnDemand')}
                          {channel.quality ? ` • ${channel.quality}` : ''}
                          {channel.viewers != null ? ` • ${channel.viewers} ${t('webtv.viewers')}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-600 group-hover:bg-slate-200 group-hover:text-slate-700 transition-colors">
                          <Play size={18} className="fill-current ml-0.5" strokeWidth={1.75} />
                        </div>
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

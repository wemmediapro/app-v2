/**
 * Hook WebTV : chaînes, programme du jour, sync heure serveur, playback URL, ended/loop.
 * Conforme à docs/REFACTORING-APP.md.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { apiService, getStreamingVideoUrl } from '../services/apiService';
import { getMediaUrlForPlayback } from '../services/offlineMedia';
import { attachVideoSource } from '../utils/hlsVideo';

const WEBTV_TIMELINE_CACHE_TTL_MS = 5 * 60 * 1000;

function timeToMins(t) {
  if (!t) return 0;
  const [h, m] = String(t)
    .trim()
    .split(':')
    .map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

export function useWebtv(language, page, t, videoPositionOnFullscreenExitRef) {
  const [tvChannels, setTvChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedChannelCategory, setSelectedChannelCategory] = useState('all');
  const [webtvLoading, setWebtvLoading] = useState(true);
  const [selectedWebtvProgram, setSelectedWebtvProgram] = useState(null);
  const [webtvPlaybackUrl, setWebtvPlaybackUrl] = useState(null);
  const [webtvVideoRef, setWebtvVideoRef] = useState(null);
  const [isWebtvVideoPlaying, setIsWebtvVideoPlaying] = useState(false);
  const [webtvVideoError, setWebtvVideoError] = useState(false);
  const [webtvPlaySyncing, setWebtvPlaySyncing] = useState(false);

  const webtvVideoUrlLoadedRef = useRef(null);
  const webtvVideoRetryRef = useRef(0);
  const webtvVideoSourceCleanupRef = useRef(null);
  const webtvSeekToSecondsRef = useRef(null);
  const webtvPrevPageRef = useRef(null);
  const webtvTimelineCacheRef = useRef(Object.create(null));
  const webtvVideoRefRef = useRef(null);

  useEffect(() => {
    webtvVideoRefRef.current = webtvVideoRef;
  }, [webtvVideoRef]);

  // Load WebTV channels
  useEffect(() => {
    let cancelled = false;
    const loadWebTVChannels = async () => {
      try {
        setWebtvLoading(true);
        const response = await apiService.getWebTVChannels(`lang=${language}`);
        if (cancelled) return;
        const list = response.data?.data ?? (Array.isArray(response.data) ? response.data : []);
        const categoryMap = {
          entertainment: 'divertissement',
          music: 'musique',
          kids: 'enfants',
          documentary: 'documentaire',
          actualites: 'actualites',
          sport: 'sport',
        };
        const transformed = (list || []).map((ch) => ({
          id: ch._id || ch.id,
          name: ch.name || 'Chaîne',
          description: ch.description || '',
          category: categoryMap[ch.category] || ch.category || 'divertissement',
          image: ch.imageUrl || ch.logo || '',
          logo: ch.logo || '',
          streamUrl: ch.streamUrl || '',
          isLive: ch.isLive !== false,
          isActive: ch.isActive !== false,
          quality: ch.quality || 'HD',
          viewers: ch.viewers ?? 0,
          schedule: ch.schedule || [],
          programs: ch.programs || [],
        }));
        if (cancelled) return;
        setTvChannels(transformed);
      } catch (error) {
        if (!cancelled) setTvChannels([]);
      } finally {
        if (!cancelled) setWebtvLoading(false);
      }
    };
    loadWebTVChannels();
    return () => {
      cancelled = true;
    };
  }, [language]);

  // Channel schedule (cache)
  useEffect(() => {
    if (!selectedChannel?.id) return;
    const categoryMap = {
      entertainment: 'divertissement',
      music: 'musique',
      kids: 'enfants',
      documentary: 'documentaire',
      actualites: 'actualites',
      sport: 'sport',
    };
    const cacheKey = `${selectedChannel.id}-${language}`;
    const cached = webtvTimelineCacheRef.current[cacheKey];
    const now = Date.now();
    if (cached && now - cached.fetchedAt < WEBTV_TIMELINE_CACHE_TTL_MS) {
      setSelectedChannel((prev) =>
        prev && prev.id === selectedChannel.id
          ? {
              ...prev,
              schedule: Array.isArray(cached.schedule) ? cached.schedule : prev.schedule || [],
              programs: Array.isArray(cached.programs) ? cached.programs : prev.programs || [],
              name: cached.name ?? prev.name,
              description: cached.description ?? prev.description,
              category: categoryMap[cached.category] || cached.category || prev.category,
            }
          : prev
      );
      return;
    }
    let cancelled = false;
    apiService
      .getWebTVChannel(selectedChannel.id, `lang=${language}`)
      .then((response) => {
        if (cancelled) return;
        const ch = response.data;
        if (!ch) return;
        const schedule = Array.isArray(ch.schedule) ? ch.schedule : [];
        const programs = Array.isArray(ch.programs) ? ch.programs : [];
        webtvTimelineCacheRef.current[cacheKey] = {
          schedule,
          programs,
          name: ch.name,
          description: ch.description,
          category: ch.category,
          fetchedAt: Date.now(),
        };
        setSelectedChannel((prev) =>
          prev && prev.id === (ch._id || ch.id)
            ? {
                ...prev,
                schedule,
                programs,
                name: ch.name ?? prev.name,
                description: ch.description ?? prev.description,
                category: categoryMap[ch.category] || ch.category || prev.category,
              }
            : prev
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedChannel?.id, language]);

  useEffect(() => {
    if (!selectedChannel) {
      setSelectedWebtvProgram(null);
      setWebtvPlaybackUrl(null);
      setIsWebtvVideoPlaying(false);
      setWebtvVideoError(false);
    }
  }, [selectedChannel]);

  // Sync on page enter (webtv)
  useEffect(() => {
    const prevPage = webtvPrevPageRef.current;
    webtvPrevPageRef.current = page;
    const justEnteredWebtv = page === 'webtv' && prevPage !== 'webtv';
    if (!justEnteredWebtv || !selectedChannel?.programs?.length) return;
    const programsWithVideo = selectedChannel.programs.filter(
      (p) => (p.streamUrl && p.streamUrl.trim()) || (p.videoFile && String(p.videoFile).trim())
    );
    if (programsWithVideo.length === 0) return;
    let cancelled = false;
    setWebtvPlaySyncing(true);
    (async () => {
      try {
        let serverDate;
        try {
          serverDate = await apiService.getServerTime();
        } catch {
          serverDate = null;
        }
        if (cancelled) return;
        const d = serverDate || new Date();
        const nowSecs = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
        const nowMins = d.getHours() * 60 + d.getMinutes();
        const programsWithTimes = programsWithVideo.filter((p) => p.startTime || p.endTime);
        let current = null;
        let positionInSeconds = 0;
        if (programsWithTimes.length > 0) {
          for (const prog of programsWithTimes) {
            const startMins = timeToMins(prog.startTime);
            let endMins = timeToMins(prog.endTime);
            if (endMins <= startMins) endMins += 24 * 60;
            if (nowMins >= startMins && nowMins < endMins) {
              current = prog;
              const startSecs = startMins * 60;
              positionInSeconds = Math.max(0, nowSecs - startSecs);
              const maxSecs = prog.duration != null ? Number(prog.duration) : (endMins - startMins) * 60;
              positionInSeconds = Math.min(positionInSeconds, maxSecs);
              break;
            }
          }
        }
        if (!current && programsWithVideo.length > 0) current = programsWithVideo[0];
        if (!cancelled && current) {
          webtvSeekToSecondsRef.current = positionInSeconds;
          setSelectedWebtvProgram({ ...current });
          setIsWebtvVideoPlaying(true);
        }
      } finally {
        if (!cancelled) setWebtvPlaySyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, selectedChannel?.id, selectedChannel?.programs]);

  // Resolve playback URL
  useEffect(() => {
    const program = selectedWebtvProgram;
    setWebtvVideoError((prev) => (prev ? false : prev));
    webtvVideoUrlLoadedRef.current = null;
    const videoUrl = program?.streamUrl || program?.videoFile || '';
    if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
      setWebtvPlaybackUrl(null);
      return;
    }
    const streamUrl = getStreamingVideoUrl(videoUrl.trim());
    if (!streamUrl) {
      setWebtvPlaybackUrl(videoUrl.startsWith('http') ? videoUrl : null);
      return;
    }
    setWebtvPlaybackUrl(null);
    let revoked = false;
    getMediaUrlForPlayback(streamUrl).then((url) => {
      if (!revoked) setWebtvPlaybackUrl(url);
    });
    return () => {
      revoked = true;
    };
  }, [selectedWebtvProgram?.streamUrl, selectedWebtvProgram?.videoFile]);

  // Attach video source + play
  useEffect(() => {
    const el = webtvVideoRef;
    const url =
      webtvPlaybackUrl ||
      (selectedWebtvProgram
        ? getStreamingVideoUrl(selectedWebtvProgram.streamUrl || selectedWebtvProgram.videoFile || '')
        : null);
    if (!el) return;
    const shouldPlay = isWebtvVideoPlaying && url;
    const exitRef = videoPositionOnFullscreenExitRef;
    if (shouldPlay && url) {
      const alreadyLoaded = webtvVideoUrlLoadedRef.current === url && el.readyState >= 2;
      if (alreadyLoaded) {
        el.play().catch(() => {});
        return;
      }
      webtvVideoRetryRef.current = 0;
      webtvVideoSourceCleanupRef.current?.();
      webtvVideoSourceCleanupRef.current = attachVideoSource(el, url, {
        onCanPlay: () => {
          webtvVideoUrlLoadedRef.current = url;
          const seekTo = webtvSeekToSecondsRef.current;
          if (seekTo != null && seekTo > 0) {
            el.currentTime = Math.min(seekTo, el.duration || seekTo);
            webtvSeekToSecondsRef.current = null;
          }
          if (
            exitRef?.current &&
            exitRef.current.type === 'webtv' &&
            el.duration &&
            exitRef.current.time < el.duration
          ) {
            el.currentTime = exitRef.current.time;
            exitRef.current = null;
          }
          el.play().catch(() => {});
        },
        onError: () => {
          if (webtvVideoRetryRef.current < 1) {
            webtvVideoRetryRef.current += 1;
            webtvVideoSourceCleanupRef.current?.();
            webtvVideoSourceCleanupRef.current = attachVideoSource(el, url, {
              onCanPlay: () => {
                webtvVideoUrlLoadedRef.current = url;
                const seekTo = webtvSeekToSecondsRef.current;
                if (seekTo != null && seekTo > 0) {
                  el.currentTime = Math.min(seekTo, el.duration || seekTo);
                  webtvSeekToSecondsRef.current = null;
                }
                if (
                  exitRef?.current &&
                  exitRef.current.type === 'webtv' &&
                  el.duration &&
                  exitRef.current.time < el.duration
                ) {
                  el.currentTime = exitRef.current.time;
                  exitRef.current = null;
                }
                el.play().catch(() => {});
              },
              onError: () => {
                webtvVideoUrlLoadedRef.current = null;
                setWebtvVideoError(true);
              },
            });
            if (el.readyState >= 3) el.play().catch(() => {});
          } else {
            webtvVideoUrlLoadedRef.current = null;
            setWebtvVideoError(true);
          }
        },
      });
      return () => {
        webtvVideoSourceCleanupRef.current?.();
      };
    }
    el.pause();
  }, [selectedWebtvProgram, isWebtvVideoPlaying, webtvVideoRef, webtvPlaybackUrl, videoPositionOnFullscreenExitRef]);

  const channelCategories = useMemo(
    () => [
      { id: 'all', nameKey: 'webtv.categories.all' },
      { id: 'actualites', nameKey: 'webtv.categories.actualites' },
      { id: 'sport', nameKey: 'webtv.categories.sport' },
      { id: 'divertissement', nameKey: 'webtv.categories.divertissement' },
      { id: 'enfants', nameKey: 'webtv.categories.enfants' },
      { id: 'musique', nameKey: 'webtv.categories.musique' },
      { id: 'documentaire', nameKey: 'webtv.categories.documentaire' },
    ],
    []
  );

  const normalizeWebtvCategoryId = useCallback((raw) => {
    if (!raw || typeof raw !== 'string') return '';
    return (
      raw
        .toLowerCase()
        .trim()
        .replace(/é|è|ê|ë/g, 'e')
        .replace(/à|â/g, 'a')
        .replace(/ù|û|ü/g, 'u')
        .replace(/î|ï/g, 'i')
        .replace(/ô/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/\s+/g, '') || raw.toLowerCase()
    );
  }, []);

  const getWebtvCategoryLabel = useCallback(
    (raw, tFunc) => {
      const id = normalizeWebtvCategoryId(raw);
      if (!id) return raw || '';
      const key = `webtv.categories.${id}`;
      const translated = tFunc(key);
      return translated !== key ? translated : raw;
    },
    [normalizeWebtvCategoryId]
  );

  const filteredChannels = useMemo(() => {
    return tvChannels.filter((channel) => {
      const channelCategoryId = normalizeWebtvCategoryId(channel?.category);
      return selectedChannelCategory === 'all' || channelCategoryId === selectedChannelCategory;
    });
  }, [tvChannels, selectedChannelCategory, normalizeWebtvCategoryId]);

  const handleWebtvPlayByServerTime = useCallback(async () => {
    if (!selectedChannel?.programs?.length) return;
    const programsWithVideo = selectedChannel.programs.filter(
      (p) => (p.streamUrl && p.streamUrl.trim()) || (p.videoFile && String(p.videoFile).trim())
    );
    if (programsWithVideo.length === 0) return;
    if (!isWebtvVideoPlaying && selectedWebtvProgram && webtvVideoRef?.readyState >= 2) {
      setIsWebtvVideoPlaying(true);
      return;
    }
    setWebtvPlaySyncing(true);
    setWebtvVideoError(false);
    try {
      let serverDate;
      try {
        serverDate = await apiService.getServerTime();
      } catch {
        serverDate = null;
      }
      const d = serverDate || new Date();
      const nowSecs = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
      const nowMins = d.getHours() * 60 + d.getMinutes();
      const programsWithTimes = programsWithVideo.filter((p) => p.startTime || p.endTime);
      let current = null;
      let positionInSeconds = 0;
      if (programsWithTimes.length > 0) {
        for (const prog of programsWithTimes) {
          const startMins = timeToMins(prog.startTime);
          let endMins = timeToMins(prog.endTime);
          if (endMins <= startMins) endMins += 24 * 60;
          if (nowMins >= startMins && nowMins < endMins) {
            current = prog;
            const startSecs = startMins * 60;
            positionInSeconds = Math.max(0, nowSecs - startSecs);
            const maxSecs = prog.duration != null ? Number(prog.duration) : (endMins - startMins) * 60;
            positionInSeconds = Math.min(positionInSeconds, maxSecs);
            break;
          }
        }
      }
      if (!current && programsWithVideo.length > 0) current = programsWithVideo[0];
      if (current) {
        webtvSeekToSecondsRef.current = positionInSeconds;
        setSelectedWebtvProgram({ ...current });
        setIsWebtvVideoPlaying(true);
      }
    } finally {
      setWebtvPlaySyncing(false);
    }
  }, [selectedChannel, isWebtvVideoPlaying, selectedWebtvProgram, webtvVideoRef]);

  const handleWebtvVideoEnded = useCallback(() => {
    if (!selectedChannel?.programs?.length) {
      setIsWebtvVideoPlaying(false);
      return;
    }
    const programsWithVideo = selectedChannel.programs.filter(
      (p) => (p.streamUrl && p.streamUrl.trim()) || (p.videoFile && String(p.videoFile).trim())
    );
    if (programsWithVideo.length === 0) {
      setIsWebtvVideoPlaying(false);
      return;
    }
    webtvVideoUrlLoadedRef.current = null;
    webtvVideoRetryRef.current = 0;
    const currentUrl = selectedWebtvProgram?.streamUrl || selectedWebtvProgram?.videoFile || '';
    const currentId = selectedWebtvProgram?.id || selectedWebtvProgram?._id;
    const findIndex = () => {
      for (let i = 0; i < programsWithVideo.length; i++) {
        const p = programsWithVideo[i];
        if (currentId && (p.id === currentId || p._id === currentId)) return i;
        const u = p.streamUrl || p.videoFile || '';
        if (u && currentUrl && String(u).trim() === String(currentUrl).trim()) return i;
      }
      return -1;
    };
    const idx = findIndex();
    const nextIdx = idx < 0 ? 0 : (idx + 1) % programsWithVideo.length;
    const next = programsWithVideo[nextIdx];
    setSelectedWebtvProgram({ ...next });
    setIsWebtvVideoPlaying(true);
  }, [selectedChannel, selectedWebtvProgram]);

  return {
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
    isWebtvVideoPlaying,
    setIsWebtvVideoPlaying,
    webtvLoading,
    filteredChannels,
    getWebtvCategoryLabel: (raw) => getWebtvCategoryLabel(raw, t),
  };
}

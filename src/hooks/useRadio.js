import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService, getRadioLogoUrl, getRadioStreamUrl } from '../services/apiService';

/**
 * Hook radio : état, refs, effets et helpers pour la page Radio.
 * @param {string} language - Langue pour l'API (stations)
 * @param {string} page - Page courante (pour auto-start quand page === 'radio')
 * @param {boolean} isAnyVideoPlaying - Si une vidéo (WebTV/Films) joue → arrêter la radio
 */
export function useRadio(language, page, isAnyVideoPlaying) {
  // === State ===
  const [radioStations, setRadioStations] = useState([]);
  const [currentRadio, setCurrentRadio] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off', 'one', 'all'
  const [isFavorite, setIsFavorite] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [radioLoading, setRadioLoading] = useState(true);
  const [radioPlaylistTracks, setRadioPlaylistTracks] = useState([]);
  const [radioPlaylistIndex, setRadioPlaylistIndex] = useState(0);

  // === Refs ===
  const audioRef = useRef(null);
  const radioSeekToRef = useRef(null);
  const radioSeekHandledInClickRef = useRef(false);
  const radioRetryCountRef = useRef(0);
  const radioRetryTimeoutRef = useRef(null);
  const radioListenersStationIdRef = useRef(null);
  const radioServerTimeOffsetRef = useRef(null);
  const radioAutoStartedRef = useRef(false);

  // --- Helpers (time/program) ---
  const getCurrentTimeSecondsFromMidnight = useCallback((date = null) => {
    const d = date != null ? date : (radioServerTimeOffsetRef.current != null
      ? new Date(Date.now() + radioServerTimeOffsetRef.current)
      : new Date());
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }, []);

  const parseTimeToSecondsFromMidnight = useCallback((timeStr) => {
    if (timeStr == null) return null;
    const s = typeof timeStr === 'string' ? timeStr.trim() : String(timeStr);
    if (!s) return null;
    let timePart = s;
    const tIndex = s.indexOf('T');
    if (tIndex >= 0) {
      timePart = s.slice(tIndex + 1).replace(/\.\d+Z?$/i, '').split('Z')[0];
    }
    const parts = timePart.split(':').map(Number);
    if (parts.length < 2) return null;
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const sec = parts[2] || 0;
    return h * 3600 + m * 60 + sec;
  }, []);

  const segmentEndSeconds = useCallback((startSec, endSec, durationFallback) => {
    if (endSec != null) {
      if (endSec === 0 && startSec != null && startSec >= 12 * 3600) return 86400;
      return endSec;
    }
    return startSec != null && durationFallback != null ? startSec + durationFallback : null;
  }, []);

  const getServerDayName = useCallback(() => {
    const d = radioServerTimeOffsetRef.current != null
      ? new Date(Date.now() + radioServerTimeOffsetRef.current)
      : new Date();
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][d.getDay()];
  }, []);

  const programAppliesToDay = useCallback((prog, dayName) => {
    const days = prog.daysOfWeek;
    if (!days || !Array.isArray(days) || days.length === 0) return true;
    const normalized = dayName.toLowerCase();
    const longNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const shortNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayIndex = longNames.indexOf(normalized);
    return days.some((d) => {
      const v = String(d).toLowerCase().trim();
      if (v === normalized) return true;
      if (dayIndex >= 0 && (v === String(dayIndex) || v === shortNames[dayIndex])) return true;
      const num = parseInt(v, 10);
      if (!isNaN(num) && num >= 0 && num <= 6) return num === dayIndex;
      return false;
    });
  }, []);

  const getCurrentRadioProgramAndPosition = useCallback((programsWithTimes) => {
    const now = getCurrentTimeSecondsFromMidnight();
    const dayName = getServerDayName();
    const withOriginalIndex = programsWithTimes.map((prog, i) => ({ prog, originalIndex: i }));
    let forToday = withOriginalIndex.filter(({ prog }) => programAppliesToDay(prog, dayName));
    if (forToday.length === 0) forToday = withOriginalIndex;
    const hasAnyStartTime = forToday.some(({ prog }) => parseTimeToSecondsFromMidnight(prog.startTime) != null);
    if (hasAnyStartTime) {
      const sortedByStart = [...forToday].sort((a, b) => {
        const sa = parseTimeToSecondsFromMidnight(a.prog.startTime);
        const sb = parseTimeToSecondsFromMidnight(b.prog.startTime);
        return (sa ?? 0) - (sb ?? 0);
      });
      const firstStart = parseTimeToSecondsFromMidnight(sortedByStart[0]?.prog?.startTime);
      const lastProg = sortedByStart[sortedByStart.length - 1];
      const lastStartParsed = parseTimeToSecondsFromMidnight(lastProg?.prog?.startTime);
      const lastEndParsed = parseTimeToSecondsFromMidnight(lastProg?.prog?.endTime);
      const lastEndSec = segmentEndSeconds(lastStartParsed, lastEndParsed, lastProg?.prog?.duration) ?? (firstStart != null && lastProg?.prog?.duration != null ? lastStartParsed + lastProg.prog.duration : null);

      for (let j = 0; j < forToday.length; j++) {
        const { prog, originalIndex: i } = forToday[j];
        const start = parseTimeToSecondsFromMidnight(prog.startTime);
        const end = parseTimeToSecondsFromMidnight(prog.endTime);
        if (start == null) continue;
        const endSec = segmentEndSeconds(start, end, prog.duration || 0);
        if (endSec == null) continue;
        if (now >= start && now < endSec) {
          const positionInSeconds = Math.min(Math.max(0, now - start), prog.duration || 0);
          return { index: i, positionInSeconds, matched: true };
        }
      }
      if (firstStart != null && now < firstStart) {
        const idx = lastProg?.originalIndex ?? 0;
        const dur = Math.max(0, Number(lastProg?.prog?.duration) || 0) || (lastEndSec != null && lastStartParsed != null ? lastEndSec - lastStartParsed : 60);
        return { index: idx, positionInSeconds: Math.max(1, dur - 1), matched: true };
      }
      if (lastEndSec != null && now >= lastEndSec && firstStart != null) {
        const totalDuration = lastEndSec - firstStart;
        if (totalDuration > 0) {
          const nowInGrid = (now - firstStart) % totalDuration;
          let acc = 0;
          for (let j = 0; j < sortedByStart.length; j++) {
            const { prog, originalIndex: i } = sortedByStart[j];
            const start = parseTimeToSecondsFromMidnight(prog.startTime);
            const end = parseTimeToSecondsFromMidnight(prog.endTime);
            const endSec = segmentEndSeconds(start, end, prog.duration || 0);
            if (start == null || endSec == null) continue;
            const segLen = endSec - start;
            if (segLen <= 0) continue;
            if (nowInGrid >= acc && nowInGrid < acc + segLen) {
              const positionInSeconds = Math.min(nowInGrid - acc, prog.duration || segLen);
              return { index: i, positionInSeconds, matched: true };
            }
            acc += segLen;
          }
        }
      }
      let best = { index: 0, positionInSeconds: 0 };
      for (let j = 0; j < forToday.length; j++) {
        const { prog, originalIndex: i } = forToday[j];
        const start = parseTimeToSecondsFromMidnight(prog.startTime);
        if (start != null && start <= now) best = { index: i, positionInSeconds: 0 };
      }
      return { ...best, matched: true };
    }
    const daySeconds = 24 * 3600;
    const n = forToday.length;
    if (n === 0) return { index: 0, positionInSeconds: 0, matched: false };
    const segmentLength = daySeconds / n;
    const programIndexInDay = Math.min(Math.floor(now / segmentLength), n - 1);
    const { prog, originalIndex: i } = forToday[programIndexInDay];
    const dur = Math.max(0, Number(prog.duration) || 60);
    const positionInSegment = now - programIndexInDay * segmentLength;
    const positionInSeconds = Math.min(
      Math.floor((positionInSegment / segmentLength) * dur),
      Math.max(0, dur - 1)
    );
    return { index: i, positionInSeconds, matched: true };
  }, [getCurrentTimeSecondsFromMidnight, getServerDayName, programAppliesToDay, parseTimeToSecondsFromMidnight, segmentEndSeconds]);

  const getRadioStreamProgress = useCallback(() => {
    if (!currentRadio?.programs?.length || radioPlaylistTracks.length === 0) return null;
    const sorted = [...currentRadio.programs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const { index, positionInSeconds, matched } = getCurrentRadioProgramAndPosition(sorted);
    if (!matched) return null;
    const prog = sorted[index];
    const start = parseTimeToSecondsFromMidnight(prog?.startTime);
    const endParsed = parseTimeToSecondsFromMidnight(prog?.endTime);
    const endSec = segmentEndSeconds(start, endParsed, prog?.duration);
    let durationSeconds = Math.max(0, Number(prog?.duration) || 0);
    if (durationSeconds <= 0 && start != null && endSec != null && endSec > start) durationSeconds = endSec - start;
    if (durationSeconds <= 0) durationSeconds = 60;
    return { positionSeconds: Math.min(positionInSeconds, durationSeconds), durationSeconds };
  }, [currentRadio, radioPlaylistTracks, getCurrentRadioProgramAndPosition, parseTimeToSecondsFromMidnight, segmentEndSeconds]);

  const startRadioPlayInClickContext = useCallback((streamUrl, seekToSeconds = null) => {
    if (!streamUrl || !audioRef.current) return;
    const audio = audioRef.current;
    try {
      audio.src = streamUrl;
      const seekPos = typeof seekToSeconds === 'number' && seekToSeconds > 0 ? seekToSeconds : null;
      if (seekPos != null) {
        const doSeekAndPlay = () => {
          try {
            const dur = audio.duration;
            const hasValidDuration = typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0;
            const pos = hasValidDuration ? Math.min(seekPos, dur) : seekPos;
            audio.currentTime = pos;
            audio.play().catch(() => setIsPlaying(false));
            if (pos > 1 && (!hasValidDuration || pos < dur)) {
              const check = () => {
                if (audio.currentTime < 0.5 && audio.readyState >= 2) {
                  try {
                    const d = audio.duration;
                    if (typeof d === 'number' && !isNaN(d) && d > 0) audio.currentTime = Math.min(pos, d);
                  } catch (_) {}
                }
              };
              setTimeout(check, 250);
            }
          } catch (_) {
            audio.play().catch(() => setIsPlaying(false));
          }
          audio.removeEventListener('canplay', onReady);
          audio.removeEventListener('loadedmetadata', onReady);
        };
        const onReady = () => {
          radioRetryCountRef.current = 0;
          radioSeekHandledInClickRef.current = false;
          doSeekAndPlay();
        };
        audio.addEventListener('canplay', onReady, { once: true });
        audio.addEventListener('loadedmetadata', onReady, { once: true });
        if (audio.readyState >= 2) {
          setTimeout(() => {
            audio.removeEventListener('canplay', onReady);
            audio.removeEventListener('loadedmetadata', onReady);
            radioSeekHandledInClickRef.current = false;
            doSeekAndPlay();
          }, 0);
        } else {
          audio.load();
        }
      } else {
        audio.play().catch(() => setIsPlaying(false));
      }
    } catch (_) {
      setIsPlaying(false);
    }
  }, []);

  const toggleRadio = useCallback((station) => {
    if (currentRadio && currentRadio.id === station.id) {
      if (isPlaying) {
        setIsPlaying(false);
        return;
      }
      if (station.programs && station.programs.length > 0) {
        (async () => {
          const setOffsetFromServer = async () => {
            try {
              const d = await apiService.getServerTime();
              if (d) radioServerTimeOffsetRef.current = d.getTime() - Date.now();
            } catch (_) {}
          };
          await setOffsetFromServer();
          if (radioServerTimeOffsetRef.current === null) await setOffsetFromServer();
          const sorted = [...station.programs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const resolveTracks = sorted.map((prog) => {
            if (prog.streamUrl) return { streamUrl: getRadioStreamUrl(prog.streamUrl), title: prog.title, artist: prog.artist || '', duration: prog.duration };
            if (prog.libraryId) {
              try {
                const lib = JSON.parse(localStorage.getItem('mp3Library') || '[]');
                const file = lib.find((f) => f.id === prog.libraryId);
                if (file && file.streamUrl) return { streamUrl: getRadioStreamUrl(file.streamUrl), title: prog.title || file.title, artist: prog.artist || file.artist || '', duration: prog.duration || file.duration };
              } catch (_) {}
            }
            return null;
          });
          const firstPlayableIndex = resolveTracks.findIndex((t) => t != null);
          if (firstPlayableIndex >= 0) {
            const { index: programIndex, positionInSeconds, matched } = getCurrentRadioProgramAndPosition(sorted);
            let track;
            let playIndex;
            if (matched) {
              track = resolveTracks[programIndex];
              playIndex = programIndex;
            }
            if (!matched || !track) {
              if (matched && !track) {
                for (let k = 1; k < resolveTracks.length; k++) {
                  const nextIdx = (programIndex + k) % resolveTracks.length;
                  if (resolveTracks[nextIdx]) {
                    playIndex = nextIdx;
                    track = resolveTracks[nextIdx];
                    break;
                  }
                }
              }
              if (!track) {
                playIndex = Math.min(radioPlaylistIndex, resolveTracks.length - 1);
                if (playIndex < firstPlayableIndex) playIndex = firstPlayableIndex;
                track = resolveTracks[playIndex];
              }
            }
            if (!track) {
              playIndex = firstPlayableIndex;
              track = resolveTracks[playIndex];
            }
            const urlToPlay = (track && track.streamUrl) ? track.streamUrl : getRadioStreamUrl(station.streamUrl || '');
            const seekPos = (matched && track && playIndex === programIndex && positionInSeconds > 0) ? positionInSeconds : null;
            radioSeekToRef.current = seekPos;
            setRadioPlaylistTracks(resolveTracks);
            setRadioPlaylistIndex(playIndex);
            setCurrentRadio(prev => prev ? {
              ...prev,
              streamUrl: urlToPlay || (track && track.streamUrl) || prev.streamUrl,
              currentlyPlaying: (track && track.title) || prev.currentlyPlaying,
              artist: (track && track.artist) || prev.artist || ''
            } : null);
            if (urlToPlay) {
              if (seekPos != null) radioSeekHandledInClickRef.current = true;
              startRadioPlayInClickContext(urlToPlay, seekPos);
            }
            if (seekPos != null) radioSeekToRef.current = null;
            setIsPlaying(true);
          }
        })();
        return;
      }
      setIsPlaying(true);
      return;
    }
    setIsFavorite(false);
    if (station.programs && station.programs.length > 0) {
      (async () => {
        const setOffsetFromServer = async () => {
          try {
            const d = await apiService.getServerTime();
            if (d) radioServerTimeOffsetRef.current = d.getTime() - Date.now();
          } catch (_) {}
        };
        await setOffsetFromServer();
        if (radioServerTimeOffsetRef.current === null) await setOffsetFromServer();
        const sorted = [...station.programs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const resolveTracks = sorted.map((prog) => {
          if (prog.streamUrl) return { streamUrl: getRadioStreamUrl(prog.streamUrl), title: prog.title, artist: prog.artist || '', duration: prog.duration };
          if (prog.libraryId) {
            try {
              const lib = JSON.parse(localStorage.getItem('mp3Library') || '[]');
              const file = lib.find((f) => f.id === prog.libraryId);
              if (file && file.streamUrl) return { streamUrl: getRadioStreamUrl(file.streamUrl), title: prog.title || file.title, artist: prog.artist || file.artist || '', duration: prog.duration || file.duration };
            } catch (_) {}
          }
          return null;
        });
        const firstPlayableIndex = resolveTracks.findIndex((t) => t != null);
        if (firstPlayableIndex < 0) {
          setCurrentRadio({ ...station, currentlyPlaying: '—', artist: 'Aucune piste lisible' });
          setRadioPlaylistTracks([]);
          setRadioPlaylistIndex(0);
          setIsPlaying(false);
          return;
        }
        const { index: programIndex, positionInSeconds, matched } = getCurrentRadioProgramAndPosition(sorted);
        let track = resolveTracks[programIndex];
        let playIndex = programIndex;
        if (!matched || !track) {
          if (matched && !track) {
            for (let k = 1; k < resolveTracks.length; k++) {
              const nextIdx = (programIndex + k) % resolveTracks.length;
              if (resolveTracks[nextIdx]) {
                playIndex = nextIdx;
                track = resolveTracks[nextIdx];
                break;
              }
            }
          }
          if (!track) {
            playIndex = firstPlayableIndex;
            track = resolveTracks[playIndex];
          }
        }
        if (!track) {
          playIndex = firstPlayableIndex;
          track = resolveTracks[playIndex];
        }
        const seekPos = (matched && track && playIndex === programIndex && positionInSeconds > 0) ? positionInSeconds : null;
        const urlToPlay = (track && track.streamUrl) ? track.streamUrl : getRadioStreamUrl(station.streamUrl || '');
        radioSeekToRef.current = seekPos;
        setRadioPlaylistTracks(resolveTracks);
        setRadioPlaylistIndex(playIndex);
        setCurrentRadio({
          ...station,
          streamUrl: urlToPlay || (track && track.streamUrl) || station.streamUrl || '',
          currentlyPlaying: (track && track.title) || station.currentlyPlaying || '—',
          artist: (track && track.artist) || station.artist || ''
        });
        setIsPlaying(true);
        if (urlToPlay) {
          if (seekPos != null) radioSeekHandledInClickRef.current = true;
          startRadioPlayInClickContext(urlToPlay, seekPos);
        }
        if (seekPos != null) radioSeekToRef.current = null;
      })();
      return;
    }
    if (station.playlistId) {
      try {
        const raw = localStorage.getItem('playlists');
        const playlists = raw ? JSON.parse(raw) : [];
        const playlist = playlists.find(p => p.id === station.playlistId);
        const files = playlist?.files || [];
        if (files.length === 0) {
          setCurrentRadio({ ...station, currentlyPlaying: '—', artist: 'Playlist vide' });
          setRadioPlaylistTracks([]);
          setRadioPlaylistIndex(0);
          setIsPlaying(false);
          return;
        }
        const first = files[0];
        setRadioPlaylistTracks(files);
        setRadioPlaylistIndex(0);
        setCurrentRadio({
          ...station,
          streamUrl: first.streamUrl,
          currentlyPlaying: first.title || first.name,
          artist: first.artist || ''
        });
        setIsPlaying(true);
        const urlToPlay = getRadioStreamUrl(first.streamUrl);
        if (urlToPlay) startRadioPlayInClickContext(urlToPlay);
      } catch (e) {
        setCurrentRadio(station);
        setRadioPlaylistTracks([]);
        setRadioPlaylistIndex(0);
        setIsPlaying(false);
      }
      return;
    }
    setRadioPlaylistTracks([]);
    setRadioPlaylistIndex(0);
    let effectiveStation = station;
    let streamUrlToPlay = getRadioStreamUrl(station.streamUrl || '');
    if (!streamUrlToPlay && station.programs?.length > 0) {
      const sorted = [...station.programs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      for (const prog of sorted) {
        if (prog.streamUrl) {
          streamUrlToPlay = getRadioStreamUrl(prog.streamUrl);
          effectiveStation = { ...station, streamUrl: prog.streamUrl, currentlyPlaying: prog.title || 'En direct', artist: prog.artist || '' };
          break;
        }
        if (prog.libraryId) {
          try {
            const lib = JSON.parse(localStorage.getItem('mp3Library') || '[]');
            const file = lib.find((f) => f.id === prog.libraryId);
            if (file?.streamUrl) {
              streamUrlToPlay = getRadioStreamUrl(file.streamUrl);
              effectiveStation = { ...station, streamUrl: file.streamUrl, currentlyPlaying: prog.title || file.title || 'En direct', artist: prog.artist || file.artist || '' };
              break;
            }
          } catch (_) {}
        }
      }
    }
    if (!effectiveStation.programs?.length && !station.playlistId) {
      effectiveStation = { ...effectiveStation, id: station.id || station._id, name: station.name, currentlyPlaying: 'En direct', artist: '' };
    }
    setCurrentRadio(effectiveStation);
    setIsPlaying(true);
    if (streamUrlToPlay) startRadioPlayInClickContext(streamUrlToPlay);
  }, [currentRadio, isPlaying, radioPlaylistIndex, getCurrentRadioProgramAndPosition, startRadioPlayInClickContext]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle(prev => !prev);
  }, []);

  const toggleFavorite = useCallback(() => {
    setIsFavorite(prev => !prev);
  }, []);

  const handleVolumeChange = useCallback((e) => {
    setVolume(parseInt(e.target.value, 10));
  }, []);

  // --- Load stations effect ---
  useEffect(() => {
    let cancelled = false;
    const loadRadioStations = async () => {
      try {
        setRadioLoading(true);
        const response = await apiService.getRadioStations(`lang=${language}`);
        if (cancelled) return;
        const raw = response?.data;
        const data = Array.isArray(raw) ? raw : (raw?.stations || []);
        if (data && data.length > 0) {
          const transformed = data.map(station => ({
            id: station._id || station.id,
            name: station.name,
            artist: station.genre || 'Live',
            genre: station.genre || 'Variétés',
            description: station.description || '',
            streamUrl: station.streamUrl || '',
            programs: station.programs || [],
            playlistId: station.playlistId || '',
            logo: station.logo ?? station.logoUrl ?? station.image ?? '',
            color: station.color || 'from-blue-500 to-cyan-500',
            currentlyPlaying: station.currentSong || 'En direct',
            listeners: station.listeners?.toString() || '0',
            bitrate: station.bitrate || '128k'
          }));
          if (cancelled) return;
          setRadioStations(transformed);
        } else {
          if (cancelled) return;
          setRadioStations([]);
        }
        const dateHeader = response?.headers?.date;
        if (dateHeader) {
          const serverDate = new Date(dateHeader);
          if (!isNaN(serverDate.getTime())) radioServerTimeOffsetRef.current = serverDate.getTime() - Date.now();
        }
        if (radioServerTimeOffsetRef.current === null) {
          apiService.getServerTime().then((serverDate) => {
            if (serverDate) radioServerTimeOffsetRef.current = serverDate.getTime() - Date.now();
          }).catch(() => {});
        }
      } catch (error) {
        console.warn('Erreur chargement stations radio:', error);
        if (!cancelled) setRadioStations([]);
      } finally {
        if (!cancelled) setRadioLoading(false);
      }
    };
    loadRadioStations();
    return () => { cancelled = true; };
  }, [language]);

  // --- Page === radio auto-start effect ---
  useEffect(() => {
    if (page !== 'radio') {
      radioAutoStartedRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const d = await apiService.getServerTime();
        if (cancelled) return;
        if (d) radioServerTimeOffsetRef.current = d.getTime() - Date.now();
      } catch (_) {}
      if (cancelled) return;
      if (radioStations.length === 1 && !currentRadio && !radioAutoStartedRef.current) {
        const station = radioStations[0];
        if (station.programs && station.programs.length > 0) {
          if (radioServerTimeOffsetRef.current === null) {
            try {
              const d2 = await apiService.getServerTime();
              if (d2) radioServerTimeOffsetRef.current = d2.getTime() - Date.now();
            } catch (_) {}
          }
          if (cancelled) return;
          radioAutoStartedRef.current = true;
          toggleRadio(station);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [page, radioStations, currentRadio, toggleRadio]);

  // --- Init Audio element effect ---
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;
    setAudioElement(audio);
    return () => {
      audioRef.current = null;
      if (audio) {
        audio.pause();
        audio.src = '';
      }
    };
  }, []);

  // --- Play/pause effect (currentRadio, isPlaying, audioElement) ---
  useEffect(() => {
    if (!audioElement) return;

    const normalizeStreamUrlForCompare = (url) => {
      if (!url || typeof url !== 'string') return '';
      try {
        const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        return (u.pathname || '').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      } catch (_) {
        return (url.split('?')[0] || '').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      }
    };

    if (currentRadio && isPlaying && currentRadio.streamUrl) {
      const streamUrl = getRadioStreamUrl(currentRadio.streamUrl);
      if (!streamUrl) return;
      const stationId = currentRadio.id || currentRadio._id;
      if (stationId) {
        radioListenersStationIdRef.current = stationId;
        apiService.updateRadioListeners(stationId, 'join').catch(() => {});
      }
      const currentPath = normalizeStreamUrlForCompare(audioElement.src);
      const newPath = normalizeStreamUrlForCompare(streamUrl);
      const isSameResource = currentPath === newPath && currentPath.length > 0;
      if (!isSameResource) {
        audioElement.src = streamUrl;
      }
      const seekTo = radioSeekToRef.current;
      const doSeek = () => {
        if (seekTo == null || seekTo <= 0) return;
        const dur = audioElement.duration;
        const hasValidDuration = typeof dur === 'number' && !isNaN(dur) && isFinite(dur);
        const pos = hasValidDuration ? Math.min(seekTo, dur) : seekTo;
        try {
          audioElement.currentTime = pos;
          radioSeekToRef.current = null;
        } catch (_) {}
      };
      const onCanPlay = () => {
        radioRetryCountRef.current = 0;
        doSeek();
        audioElement.removeEventListener('canplay', onCanPlay);
        audioElement.removeEventListener('loadedmetadata', onCanPlay);
      };
      audioElement.addEventListener('canplay', onCanPlay);
      audioElement.addEventListener('loadedmetadata', onCanPlay);
      if (audioElement.readyState >= 2) setTimeout(() => { doSeek(); audioElement.removeEventListener('canplay', onCanPlay); audioElement.removeEventListener('loadedmetadata', onCanPlay); }, 0);

      const maxRetries = 2;
      const retryDelayMs = 1500;
      const handleError = () => {
        if (radioRetryCountRef.current >= maxRetries) {
          console.error('Stream radio: échec après', maxRetries, 'tentatives');
          setIsPlaying(false);
          return;
        }
        radioRetryCountRef.current += 1;
        audioElement.removeEventListener('error', handleError);
        radioRetryTimeoutRef.current = setTimeout(() => {
          radioRetryTimeoutRef.current = null;
          audioElement.src = streamUrl;
          audioElement.load();
          audioElement.addEventListener('error', handleError, { once: true });
          audioElement.play().catch(() => setIsPlaying(false));
        }, retryDelayMs);
      };
      audioElement.addEventListener('error', handleError, { once: true });

      if (!radioSeekHandledInClickRef.current && (!isSameResource || audioElement.paused)) {
        audioElement.play().catch(error => {
          if (error?.name === 'AbortError') return;
          console.error('Erreur de lecture audio:', error);
          setIsPlaying(false);
        });
      }
      return () => {
        const prevId = radioListenersStationIdRef.current;
        if (prevId) {
          radioListenersStationIdRef.current = null;
          apiService.updateRadioListeners(prevId, 'leave').catch(() => {});
        }
        if (radioRetryTimeoutRef.current) {
          clearTimeout(radioRetryTimeoutRef.current);
          radioRetryTimeoutRef.current = null;
        }
        audioElement.removeEventListener('canplay', onCanPlay);
        audioElement.removeEventListener('loadedmetadata', onCanPlay);
        audioElement.removeEventListener('error', handleError);
      };
    } else {
      if (radioListenersStationIdRef.current) {
        const prevId = radioListenersStationIdRef.current;
        radioListenersStationIdRef.current = null;
        apiService.updateRadioListeners(prevId, 'leave').catch(() => {});
      }
      radioSeekHandledInClickRef.current = false;
      radioRetryCountRef.current = 0;
      if (radioRetryTimeoutRef.current) {
        clearTimeout(radioRetryTimeoutRef.current);
        radioRetryTimeoutRef.current = null;
      }
      audioElement.pause();
      return () => {};
    }
  }, [currentRadio, isPlaying, audioElement]);

  // --- Playlist ended effect ---
  useEffect(() => {
    if (!audioElement || !currentRadio || radioPlaylistTracks.length === 0) return;
    const normalizeUrl = (url) => {
      if (!url || typeof url !== 'string') return '';
      try {
        const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
        return (u.pathname || '').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      } catch (_) {
        return (url.split('?')[0] || '').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
      }
    };
    const uniqueUrls = [...new Set(radioPlaylistTracks.filter((t) => t?.streamUrl).map((t) => normalizeUrl(t.streamUrl)))];
    const isSingleStreamPlaylist = uniqueUrls.length <= 1;

    const onEnded = () => {
      if (isSingleStreamPlaylist) return;
      const dur = audioElement.duration;
      const pos = audioElement.currentTime;
      const hasValidDuration = typeof dur === 'number' && !isNaN(dur) && isFinite(dur) && dur > 0;
      const isShortSegment = hasValidDuration && dur < 60;
      const reallyEnded = hasValidDuration && !isShortSegment && (pos >= dur - 2);
      if (!reallyEnded) return;

      const currentNorm = normalizeUrl(currentRadio?.streamUrl);
      let nextIndex = radioPlaylistIndex + 1;
      while (nextIndex < radioPlaylistTracks.length && !radioPlaylistTracks[nextIndex]) nextIndex++;
      if (nextIndex < radioPlaylistTracks.length) {
        const nextTrack = radioPlaylistTracks[nextIndex];
        if (nextTrack) {
          if (normalizeUrl(nextTrack.streamUrl) === currentNorm) return;
          setRadioPlaylistIndex(nextIndex);
          setCurrentRadio(prev => prev ? {
            ...prev,
            streamUrl: nextTrack.streamUrl,
            currentlyPlaying: nextTrack.title || nextTrack.name,
            artist: nextTrack.artist || ''
          } : null);
        }
      } else if (repeatMode === 'all') {
        const firstIndex = radioPlaylistTracks.findIndex((t) => t != null);
        if (firstIndex >= 0) {
          const first = radioPlaylistTracks[firstIndex];
          if (first && normalizeUrl(first.streamUrl) === currentNorm) return;
          setRadioPlaylistIndex(firstIndex);
          setCurrentRadio(prev => prev ? {
            ...prev,
            streamUrl: first.streamUrl,
            currentlyPlaying: first.title || first.name,
            artist: first.artist || ''
          } : null);
        } else {
          setIsPlaying(false);
        }
      } else {
        setIsPlaying(false);
      }
    };
    audioElement.addEventListener('ended', onEnded);
    return () => audioElement.removeEventListener('ended', onEnded);
  }, [audioElement, currentRadio, radioPlaylistTracks, radioPlaylistIndex, repeatMode]);

  // --- Volume effect ---
  useEffect(() => {
    if (audioElement) {
      audioElement.volume = volume / 100;
    }
  }, [volume, audioElement]);

  // --- MediaSession effect ---
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaSession) return;
    if (currentRadio && isPlaying) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentRadio.name || 'GNV Radio',
        artist: currentRadio.currentlyPlaying && currentRadio.currentlyPlaying !== 'En direct' ? currentRadio.currentlyPlaying : 'En direct',
        album: 'GNV OnBoard'
      });
      navigator.mediaSession.playbackState = 'playing';
    } else {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    }
  }, [currentRadio, isPlaying]);

  // --- isAnyVideoPlaying stop effect ---
  useEffect(() => {
    if (!isAnyVideoPlaying) return;
    setIsPlaying(false);
    if (audioElement) {
      audioElement.pause();
    }
  }, [isAnyVideoPlaying, audioElement]);

  return {
    radioStations,
    currentRadio,
    setCurrentRadio,
    toggleRadio,
    isPlaying,
    volume,
    handleVolumeChange,
    isFavorite,
    toggleFavorite,
    radioLoading,
    getRadioLogoUrl,
    radioPlaylistTracks,
    getRadioStreamProgress,
    setAudioElement,
    audioRef,
    repeatMode,
    toggleRepeat,
    isShuffle,
    toggleShuffle
  };
}

import { useRef, useEffect, memo, forwardRef, useImperativeHandle } from 'react';
import { attachVideoSource } from '../utils/hlsVideo';

/**
 * Lecteur vidéo HLS/MP4 avec reprise de position.
 * Expose play() / pause() via ref pour que le bouton « Lire » puisse forcer la reprise après pause.
 */
const MoviePlayer = memo(forwardRef(function MoviePlayer({
  streamUrl,
  startTime = 0,
  isPlaying,
  onPlay,
  onPause,
  onProgress,
  onPauseWithProgress,
  onError,
  className = '',
  ...videoProps
}, ref) {
  const videoRef = useRef(null);
  const cleanupRef = useRef(null);
  const loadedUrlRef = useRef(null);
  const throttleRef = useRef(0);
  const THROTTLE_MS = 3000; // Éviter tout re-render parent pendant la lecture
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onPauseWithProgressRef = useRef(onPauseWithProgress);
  onPauseWithProgressRef.current = onPauseWithProgress;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  useImperativeHandle(ref, () => ({
    play() {
      const el = videoRef.current;
      if (el && loadedUrlRef.current) el.play().catch(() => {});
    },
    pause() {
      videoRef.current?.pause();
    },
  }), []);

  // 1) Attacher la source uniquement quand streamUrl change (jamais sur play/pause ni sur changement de startTime après pause)
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !streamUrl) return;

    cleanupRef.current?.();
    loadedUrlRef.current = null;
    loadedUrlRef.current = streamUrl;
    const initialStartTime = startTime > 0 ? startTime : undefined;
    cleanupRef.current = attachVideoSource(el, streamUrl, {
      startTime: initialStartTime,
      onCanPlay: () => {
        if (videoRef.current !== el) return;
        loadedUrlRef.current = streamUrl;
        if (isPlayingRef.current) {
          el.play().catch((err) => { if (err?.name !== 'AbortError') onError?.(err); onPause?.(); });
        }
      },
      onError: () => {
        loadedUrlRef.current = null;
        onError?.();
        onPause?.();
      },
    });

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      loadedUrlRef.current = null;
    };
  }, [streamUrl]); // Pas startTime : éviter de recharger la vidéo au pause (sauvegarde position → startTime changeait → effect relançait load())

  // 2) Play / Pause sans toucher à la source
  useEffect(() => {
    const el = videoRef.current;
    if (!el || loadedUrlRef.current !== streamUrl) return;
    if (isPlaying) {
      el.play().catch((err) => { if (err?.name !== 'AbortError') onError?.(err); onPause?.(); });
    } else {
      el.pause();
    }
  }, [isPlaying, streamUrl]);

  // Sauvegarder la position (throttled) — utilise une ref pour éviter de re-créer les listeners à chaque render parent
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onTimeUpdate = () => {
      const now = Date.now();
      if (now - throttleRef.current < THROTTLE_MS) return;
      throttleRef.current = now;
      const time = el.currentTime;
      const dur = el.duration;
      if (typeof time === 'number' && !isNaN(time)) {
        onProgressRef.current?.(time, typeof dur === 'number' && !isNaN(dur) ? dur : undefined);
      }
    };

    const onPauseEvt = () => {
      const time = el.currentTime;
      const dur = el.duration;
      if (typeof time === 'number' && !isNaN(time)) {
        onPauseWithProgressRef.current?.(time, typeof dur === 'number' && !isNaN(dur) ? dur : undefined);
      }
    };

    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('pause', onPauseEvt);
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('pause', onPauseEvt);
    };
  }, []); // Pas de deps : on utilise la ref pour onProgress

  return (
    <video
      ref={videoRef}
      className={`movie-player-video ${className}`.trim()}
      style={{ contain: 'strict', background: '#000' }}
      controls
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      disableRemotePlayback
      preload="auto"
      playsInline
      {...(streamUrl?.startsWith('/') ? {} : { crossOrigin: 'anonymous' })}
      onPlay={() => onPlay?.()}
      onPause={(e) => {
        if (videoRef.current === e.target) onPause?.();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onError={(e) => {
        if (videoRef.current === e.target) {
          onError?.(e.target?.error);
          onPause?.();
        }
      }}
      {...videoProps}
    />
  );
}));

export default MoviePlayer;

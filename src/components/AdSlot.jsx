import { useRef, useEffect, useState, useCallback } from 'react';
import { SkipForward } from 'lucide-react';
import { attachVideoSource } from '../utils/hlsVideo';
import { getStreamingVideoUrl, getHlsUrlFromVideoUrl } from '../services/apiService';

/**
 * Slot publicitaire : affiche un clip vidéo (MP4/HLS).
 * Passer par flèche (clavier ou bouton) et bouton "Ignorer".
 * skipAfterPercent : % de la durée après lequel le bouton "Ignorer" est actif (0 = dès le début, 100 = à la fin).
 */
function AdSlot({ adUrl, skipAfterPercent = 0, onComplete, onError }) {
  const videoRef = useRef(null);
  const cleanupRef = useRef(null);
  const [canSkip, setCanSkip] = useState(skipAfterPercent <= 0);
  const skipTriggeredRef = useRef(false);

  const resolvedUrl = adUrl
    ? (getStreamingVideoUrl(adUrl) || (adUrl.startsWith('http') ? adUrl : null))
    : null;
  const hlsUrl = resolvedUrl ? getHlsUrlFromVideoUrl(resolvedUrl) : null;
  const isHls = !!hlsUrl;

  useEffect(() => {
    if (!resolvedUrl || !videoRef.current) return;
    const el = videoRef.current;
    cleanupRef.current?.();

    const handleEnded = () => onComplete?.();
    const handleError = () => {
      onError?.();
      onComplete?.();
    };

    if (isHls) {
      cleanupRef.current = attachVideoSource(el, resolvedUrl, {
        onCanPlay: () => {},
        onError: handleError,
      });
    } else {
      el.src = resolvedUrl;
      el.load();
    }
    el.addEventListener('ended', handleEnded, { once: true });
    el.addEventListener('error', handleError, { once: true });

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('error', handleError);
    };
  }, [resolvedUrl, isHls]);

  useEffect(() => {
    setCanSkip(skipAfterPercent <= 0);
  }, [resolvedUrl, skipAfterPercent]);

  useEffect(() => {
    if (skipAfterPercent <= 0) return;
    const el = videoRef.current;
    if (!el) return;
    const checkSkip = () => {
      const duration = el.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const threshold = (duration * skipAfterPercent) / 100;
      if (el.currentTime >= threshold) setCanSkip(true);
    };
    el.addEventListener('timeupdate', checkSkip);
    el.addEventListener('loadedmetadata', checkSkip);
    return () => {
      el.removeEventListener('timeupdate', checkSkip);
      el.removeEventListener('loadedmetadata', checkSkip);
    };
  }, [resolvedUrl, skipAfterPercent]);

  const handleSkip = useCallback(() => {
    if (!canSkip || skipTriggeredRef.current) return;
    skipTriggeredRef.current = true;
    const el = videoRef.current;
    if (el) {
      el.pause();
      try {
        cleanupRef.current?.();
        cleanupRef.current = null;
        el.removeAttribute('src');
        el.load();
      } catch (_) {}
    }
    const callback = onComplete;
    requestAnimationFrame(() => {
      callback?.();
    });
  }, [canSkip, onComplete]);

  // Passer la publicité par flèche clavier (flèche droite ou gauche)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleSkip]);

  if (!resolvedUrl) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        controls
        controlsList="nodownload"
        crossOrigin="anonymous"
        style={{ background: '#000' }}
      />
      <button
        type="button"
        onClick={handleSkip}
        disabled={!canSkip}
        className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-2 bg-black/70 text-white text-sm font-medium rounded-lg hover:bg-black/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Ignorer la publicité"
      >
        <SkipForward size={18} aria-hidden />
        Ignorer
      </button>
    </div>
  );
}

export default AdSlot;

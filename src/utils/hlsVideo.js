/**
 * Attache une source vidéo à un élément <video> : tente HLS en premier (si disponible), sinon MP4 natif.
 * Convention : /uploads/videos/foo.mp4 → /uploads/videos_hls/foo/playlist.m3u8
 */

import Hls from 'hls.js';
import { getHlsUrlFromVideoUrl } from '../services/apiService';

export function isHlsSupported() {
  return Hls.isSupported();
}

/** Configuration HLS optimisée pour VOD : lecture fluide, bon buffering, résilience aux erreurs. */
const HLS_VOD_CONFIG = {
  // Worker décode les segments dans un thread séparé (moins de blocage UI)
  enableWorker: true,
  // Buffer devant le curseur : 30 s cible, 60 s max → lecture fluide même sur réseau instable
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  maxBufferSize: 60 * 1000 * 1000, // 60 Mo
  maxBufferHole: 0.5,
  // Réduire le buffer derrière le curseur pour limiter l’usage mémoire (évite dépassement 150 Mo Chrome)
  backBufferLength: 30,
  // Réessayer en cas d’erreur d’append (réseau / segment corrompu)
  appendErrorMaxRetry: 3,
  // Désactiver le mode basse latence (contenu VOD, pas live)
  lowLatencyMode: false,
  // Délais max avant de considérer un chargement en échec
  maxLoadingDelay: 4,
  maxStarvationDelay: 4,
};

/**
 * Attache la source (HLS ou MP4) au lecteur vidéo.
 * @param {HTMLVideoElement} videoElement
 * @param {string} url - URL MP4 (ou vidéo)
 * @param {{ onCanPlay?: () => void, onError?: () => void, startTime?: number }} options
 * @returns {() => void} - Cleanup (à appeler au démontage ou avant changement de source)
 */
export function attachVideoSource(videoElement, url, { onCanPlay, onError, startTime } = {}) {
  if (!videoElement || !url) return () => {};

  const hlsUrl = getHlsUrlFromVideoUrl(url);
  const seekTo = typeof startTime === 'number' && startTime > 0 ? startTime : null;

  const applyStartTime = () => {
    if (seekTo == null) return;
    try {
      const dur = videoElement.duration;
      if (typeof dur === 'number' && !isNaN(dur) && seekTo >= dur - 2) return;
      if (videoElement.currentTime !== seekTo) {
        videoElement.currentTime = seekTo;
      }
    } catch (_) {}
  };

  const cleanup = () => {
    if (videoElement._hlsInstance) {
      videoElement._hlsInstance.destroy();
      videoElement._hlsInstance = null;
    }
    videoElement.removeAttribute('src');
    videoElement.load();
  };

  const tryNative = () => {
    if (videoElement._hlsInstance) {
      videoElement._hlsInstance.destroy();
      videoElement._hlsInstance = null;
    }
    videoElement.src = url;
    videoElement.load();
    if (seekTo != null) {
      videoElement.addEventListener('loadedmetadata', applyStartTime, { once: true });
      videoElement.addEventListener('canplay', applyStartTime, { once: true });
    }
    if (onCanPlay) videoElement.addEventListener('canplay', onCanPlay, { once: true });
    if (onError) videoElement.addEventListener('error', onError, { once: true });
  };

  if (hlsUrl && isHlsSupported()) {
    const hlsConfig = { ...HLS_VOD_CONFIG };
    if (typeof seekTo === 'number' && seekTo > 0) {
      hlsConfig.startPosition = seekTo;
    }
    const hls = new Hls(hlsConfig);
    videoElement._hlsInstance = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, () => {});
    hls.on(Hls.Events.ERROR, (event, data) => {
      if (!data.fatal) return;
      hls.destroy();
      videoElement._hlsInstance = null;
      tryNative();
    });

    hls.loadSource(hlsUrl);
    hls.attachMedia(videoElement);

    if (seekTo != null) {
      videoElement.addEventListener('loadedmetadata', applyStartTime, { once: true });
      videoElement.addEventListener('canplay', applyStartTime, { once: true });
    }
    if (onCanPlay) videoElement.addEventListener('canplay', onCanPlay, { once: true });
    if (onError) videoElement.addEventListener('error', onError, { once: true });
  } else {
    tryNative();
  }

  return cleanup;
}

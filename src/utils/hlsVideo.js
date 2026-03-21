/**
 * Attache une source vidéo à un élément <video> : tente HLS en premier (si disponible), sinon MP4 natif.
 * hls.js est importé dynamiquement pour ne pas alourdir le bundle initial (~520 ko minifié).
 * Convention : /uploads/videos/foo.mp4 → /uploads/videos_hls/foo/playlist.m3u8
 */

import { getHlsUrlFromVideoUrl } from '../services/apiService';

/** Configuration HLS optimisée pour VOD. */
const HLS_VOD_CONFIG = {
  enableWorker: true,
  maxBufferLength: 30,
  maxMaxBufferLength: 60,
  maxBufferSize: 60 * 1000 * 1000,
  maxBufferHole: 0.5,
  backBufferLength: 30,
  appendErrorMaxRetry: 3,
  lowLatencyMode: false,
  maxLoadingDelay: 4,
  maxStarvationDelay: 4,
};

/**
 * Attache la source (HLS ou MP4) au lecteur vidéo.
 * @param {HTMLVideoElement} videoElement
 * @param {string} url - URL MP4 (ou vidéo)
 * @param {{ onCanPlay?: () => void, onError?: () => void, startTime?: number }} options
 * @returns {() => void} - Cleanup à appeler au démontage
 */
export function attachVideoSource(videoElement, url, { onCanPlay, onError, startTime } = {}) {
  if (!videoElement || !url) return () => {};

  const hlsUrl = getHlsUrlFromVideoUrl(url);
  const seekTo = typeof startTime === 'number' && startTime > 0 ? startTime : null;

  let cancelled = false;

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

  const tryNative = () => {
    if (cancelled) return;
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

  const doCleanup = () => {
    cancelled = true;
    if (videoElement._hlsInstance) {
      videoElement._hlsInstance.destroy();
      videoElement._hlsInstance = null;
    }
    videoElement.removeAttribute('src');
    videoElement.load();
  };

  if (!hlsUrl) {
    tryNative();
    return doCleanup;
  }

  import('hls.js')
    .then((mod) => {
      if (cancelled) return;
      const Hls = mod.default;
      if (!Hls.isSupported()) {
        tryNative();
        return;
      }
      const hlsConfig = { ...HLS_VOD_CONFIG };
      if (typeof seekTo === 'number' && seekTo > 0) {
        hlsConfig.startPosition = seekTo;
      }
      const hls = new Hls(hlsConfig);
      videoElement._hlsInstance = hls;

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
    })
    .catch(() => {
      if (!cancelled) tryNative();
    });

  return doCleanup;
}

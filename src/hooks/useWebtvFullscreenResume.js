/**
 * Restaure la position WebTV après sortie du plein écran.
 */
import { useEffect } from 'react';

export function useWebtvFullscreenResume(webtvVideoRefRef, videoPositionOnFullscreenExitRef) {
  useEffect(() => {
    const onFullscreenChange = () => {
      const fullscreenEl = document.fullscreenElement || document.webkitFullscreenElement;
      if (fullscreenEl) {
        const el = fullscreenEl.nodeName === 'VIDEO' ? fullscreenEl : null;
        const webtvEl = webtvVideoRefRef?.current;
        const videoEl = el || webtvEl;
        if (videoEl && typeof videoEl.currentTime === 'number' && !isNaN(videoEl.currentTime)) {
          videoPositionOnFullscreenExitRef.current = { time: videoEl.currentTime, type: 'webtv' };
        }
        return;
      }
      const saved = videoPositionOnFullscreenExitRef.current;
      if (!saved) return;
      setTimeout(() => {
        const current = videoPositionOnFullscreenExitRef.current;
        if (!current) return;
        const wEl = webtvVideoRefRef?.current;
        if (current?.type === 'webtv' && wEl) {
          try {
            if (current.time < (wEl.duration || 0)) wEl.currentTime = current.time;
          } catch (_) {}
          videoPositionOnFullscreenExitRef.current = null;
        }
      }, 200);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, [webtvVideoRefRef, videoPositionOnFullscreenExitRef]);
}

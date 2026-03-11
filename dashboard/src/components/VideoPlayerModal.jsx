import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { getVideoPreviewUrl } from '../utils/videoPreviewUrl';

/**
 * Lecteur vidéo modal partagé pour tous les aperçus (Films, Épisodes, Publicités, WebTV, Bibliothèque).
 * Même UI partout : fond sombre, barre de titre, vidéo avec contrôles.
 */
export default function VideoPlayerModal({ open, onClose, src, title = 'Vidéo' }) {
  const resolvedSrc = src ? getVideoPreviewUrl(src) : null;

  useEffect(() => {
    if (!open) return;
    const onEscape = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-black rounded-xl shadow-2xl max-w-4xl w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900/90 border-b border-gray-700">
          <h3 className="text-white font-semibold truncate pr-2">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 text-white transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X size={22} />
          </button>
        </div>
        <div className="aspect-video bg-black">
          {resolvedSrc ? (
            <video
              key={resolvedSrc}
              src={resolvedSrc}
              className="w-full h-full"
              controls
              autoPlay
              playsInline
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              Aucune vidéo à lire
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

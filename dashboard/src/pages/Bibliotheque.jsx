import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen,
  FileVideo,
  Image as ImageIcon,
  Music,
  Trash2,
  Search,
  RefreshCw,
  ExternalLink,
  Play,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import VideoPlayerModal from '../components/VideoPlayerModal';

const Bibliotheque = () => {
  const { t } = useLanguage();
  const typeConfig = {
    video: { icon: FileVideo, label: t('bibliotheque.video'), color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    image: { icon: ImageIcon, label: t('bibliotheque.image'), color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    audio: { icon: Music, label: t('bibliotheque.audio'), color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  };
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deletingPath, setDeletingPath] = useState(null);
  const [videoPlayerModal, setVideoPlayerModal] = useState({ open: false, src: '', title: '' });

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await apiService.getMediaLibrary();
      const data = res.data;
      if (data?.success && Array.isArray(data.media)) {
        setMedia(data.media);
      } else {
        setMedia([]);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || t('bibliotheque.errorLoad');
      const isNetwork = !err.response;
      const hint = isNetwork
        ? ' Vérifiez que le backend tourne (npm run dev dans backend/, port 3000).'
        : (msg === 'Route not found' ? ' Redémarrez le backend.' : '');
      toast.error(msg + hint);
      setMedia([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleDelete = async (item) => {
    if (!window.confirm(`${t('common.delete')} "${item.name}" ? ${t('bibliotheque.deleteConfirm')}`)) return;
    setDeletingPath(item.path);
    try {
      await apiService.deleteMediaFile(item.path);
      toast.success(t('bibliotheque.fileDeleted'));
      setMedia((prev) => prev.filter((m) => m.path !== item.path));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.errorUpdate'));
    } finally {
      setDeletingPath(null);
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    if (seconds == null || seconds < 0) return null;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const previewUrl = (item) => item.path?.startsWith('/') ? item.path : `/${item.path || ''}`;

  const filtered = media.filter((m) => {
    const matchSearch = !searchQuery.trim() || m.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    const matchType = typeFilter === 'all' || m.type === typeFilter;
    return matchSearch && matchType;
  });

  const typeFilters = [
    { value: 'all', label: t('bibliotheque.filterAll'), icon: FolderOpen },
    { value: 'video', label: t('bibliotheque.video'), icon: FileVideo },
    { value: 'image', label: t('bibliotheque.image'), icon: ImageIcon },
    { value: 'audio', label: t('bibliotheque.audio'), icon: Music },
  ];

  return (
    <div className="space-y-6 pb-8 max-w-[1400px]">
      {/* En-tête */}
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight flex items-center gap-2.5">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600">
            <FolderOpen size={20} strokeWidth={2} />
          </span>
          {t('bibliotheque.title')}
        </h1>
        <p className="text-gray-500 text-sm pl-11">
          {t('bibliotheque.subtitle')}
        </p>
      </header>

      {/* Barre de recherche et filtres */}
      <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative flex-1 min-w-0">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={t('bibliotheque.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50/50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white transition-colors"
                  aria-label="Rechercher"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                {typeFilters.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTypeFilter(value)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      typeFilter === value
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                    }`}
                  >
                    <Icon size={15} strokeWidth={2} />
                    {label}
                  </button>
                ))}
                <div className="hidden sm:block w-px h-6 bg-gray-200 mx-0.5" aria-hidden />
                <motion.button
                  type="button"
                  onClick={fetchMedia}
                  disabled={loading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-50 transition-colors"
                  title={t('bibliotheque.refresh')}
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                  {t('bibliotheque.refresh')}
                </motion.button>
                <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium tabular-nums">
                  {filtered.length} {filtered.length !== 1 ? t('bibliotheque.fileMany') : t('bibliotheque.fileOne')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contenu */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="w-12 h-12 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin mb-4" />
          <p className="text-sm font-medium text-gray-600">{t('bibliotheque.loadingLibrary')}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 sm:py-28 text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <FolderOpen size={28} className="text-gray-400" />
          </div>
          <p className="font-medium text-gray-700 text-center">
            {media.length === 0 ? t('bibliotheque.noMediaOnServer') : t('bibliotheque.noResultsForSearch')}
          </p>
          <p className="text-sm mt-1.5 text-center max-w-sm text-gray-500">
            {media.length === 0
              ? t('bibliotheque.noMediaHint')
              : t('bibliotheque.noResultsHint')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((item, index) => {
            const config = typeConfig[item.type] || typeConfig.video;
            const Icon = config.icon;
            const url = previewUrl(item);
            return (
              <motion.article
                key={item.path}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.25) }}
                className="group bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200"
              >
                {/* Zone lecteur / aperçu */}
                <div className="aspect-video bg-gray-100 flex items-center justify-center relative">
                  {item.type === 'image' && (
                    <img
                      src={url}
                      alt={item.name}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  )}
                  {item.type === 'video' && (
                    <button
                      type="button"
                      onClick={() => setVideoPlayerModal({ open: true, src: item.path || item.url, title: item.name })}
                      className="w-full h-full flex items-center justify-center bg-black relative group cursor-pointer"
                    >
                      <video
                        src={url}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-contain pointer-events-none group-hover:opacity-90"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <Play size={28} className="text-gray-800 ml-1" fill="currentColor" />
                        </div>
                      </div>
                    </button>
                  )}
                  {item.type === 'audio' && (
                    <div className="w-full p-4 flex items-center justify-center bg-gradient-to-b from-gray-100 to-gray-50">
                      <audio
                        src={url}
                        controls
                        preload="metadata"
                        className="w-full max-w-full"
                      />
                    </div>
                  )}
                  {!['image', 'video', 'audio'].includes(item.type) && (
                    <Icon size={40} className="text-gray-400" />
                  )}
                  <span
                    className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color} ${config.border} border`}
                  >
                    <Icon size={11} />
                    {config.label}
                  </span>
                  {(item.duration != null && item.duration > 0) && (
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs font-mono">
                      {formatDuration(item.duration)}
                    </span>
                  )}
                </div>

                {/* Infos et actions */}
                <div className="p-3.5 border-t border-gray-50">
                  <p className="text-sm font-medium text-gray-900 truncate pr-2" title={item.name}>
                    {item.name}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    <span>{formatSize(item.size)}</span>
                    <span>
                      {item.mtime
                        ? new Date(item.mtime).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                    <a
                      href={item.path || item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 hover:text-gray-800 transition-colors"
                      title={t('bibliotheque.open')}
                    >
                      <ExternalLink size={14} />
                      {t('bibliotheque.open')}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={deletingPath === item.path}
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                      title="Supprimer du serveur"
                    >
                      <Trash2 size={14} />
                      {deletingPath === item.path ? '…' : t('common.delete')}
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}

      <VideoPlayerModal
        open={videoPlayerModal.open}
        onClose={() => setVideoPlayerModal((prev) => ({ ...prev, open: false }))}
        src={videoPlayerModal.src}
        title={videoPlayerModal.title}
      />
    </div>
  );
};

export default Bibliotheque;

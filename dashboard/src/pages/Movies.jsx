import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  Clapperboard,
  Plus,
  Edit,
  Trash2,
  Search,
  Film,
  Tv,
  X,
  Save,
  MapPin,
  Upload,
  Video,
  FileVideo,
  Clock,
  Play,
  Languages,
  ChevronDown,
  SlidersHorizontal,
  Eye,
} from 'lucide-react';
import FilterBar from '../components/FilterBar';
import { apiService } from '../services/apiService';
import { LANG_LIST, emptyTranslations } from '../utils/i18n';
import { getVideoPreviewUrl } from '../utils/videoPreviewUrl';
import VideoPlayerModal from '../components/VideoPlayerModal';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

/** URL d’image : chemins relatifs préfixés par l’origine pour le proxy */
function getImageSrc(url) {
  if (!url || typeof url !== 'string') return null;
  const t = url.trim().replace(/\\/g, '/');
  if (!t) return null;
  if (t.startsWith('data:')) return t;
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return origin ? `${origin}${t.startsWith('/') ? '' : '/'}${t}` : t;
}

/** Calcule la durée d'un fichier vidéo (en secondes) via un élément vidéo temporaire */
function getVideoDurationFromFile(file) {
  return new Promise((resolve, _reject) => {
    if (!file || !file.type.startsWith('video/')) {
      resolve(0);
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Math.floor(video.duration) || 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

/** Calcule la durée d'une vidéo à partir de son URL (bibliothèque ou blob) */
function getVideoDurationFromUrl(url) {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string') {
      resolve(0);
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve(Math.floor(video.duration) || 0);
    video.onerror = () => resolve(0);
    video.src = url;
  });
}

/** Formate des secondes en "Xh Ymin" ou "Zmin" pour affichage durée film/série */
function formatDurationFromSeconds(seconds) {
  if (!seconds || seconds <= 0) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

const Movies = () => {
  const { t } = useLanguage();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, movie, series
  const [countryFilter, setCountryFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [posterFile, setPosterFile] = useState(null);
  const [posterPreview, setPosterPreview] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploading, setVideoUploading] = useState(false);
  const [episodes, setEpisodes] = useState([]);
  const [newEpisode, setNewEpisode] = useState({
    title: '',
    duration: '',
    description: '',
    videoFile: null,
    videoPreview: null,
    translations: emptyTranslations(),
    autoDuration: true,
  });
  const [showEpisodeModal, setShowEpisodeModal] = useState(false);
  const [editingEpisodeIndex, setEditingEpisodeIndex] = useState(null);
  const [videoPlayerModal, setVideoPlayerModal] = useState({ open: false, src: '', title: '' });
  const [activeLangEpisode, setActiveLangEpisode] = useState('fr');
  const [episodeDurationLoading, setEpisodeDurationLoading] = useState(false);
  const [editingMovie, setEditingMovie] = useState(null); // film/série en cours de modification
  const [showVideoLibraryPicker, setShowVideoLibraryPicker] = useState(null); // 'movie' | 'episode' | null
  const [mediaLibraryVideos, setMediaLibraryVideos] = useState([]);
  const [mediaLibraryLoading, setMediaLibraryLoading] = useState(false);
  const [activeLang, setActiveLang] = useState('fr');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [newMovie, setNewMovie] = useState({
    title: '',
    type: 'movie',
    genre: '',
    year: new Date().getFullYear(),
    duration: '',
    rating: 0,
    description: '',
    poster: '',
    videoUrl: '',
    isPopular: false,
    countries: [],
    episodes: [],
    translations: emptyTranslations(),
  });

  // Pays disponibles
  const availableCountries = [
    { name: 'Maroc', code: 'MA' },
    { name: 'Tunisie', code: 'TN' },
    { name: 'Algérie', code: 'DZ' },
    { name: 'Italie', code: 'IT' },
    { name: 'Espagne', code: 'ES' },
  ];

  useEffect(() => {
    fetchMovies();
  }, []);

  useEffect(() => {
    if (!showVideoLibraryPicker) return;
    setMediaLibraryLoading(true);
    apiService
      .getMediaLibrary()
      .then((res) => {
        const list = res.data?.media && Array.isArray(res.data.media) ? res.data.media : [];
        setMediaLibraryVideos(list.filter((m) => m.type === 'video'));
      })
      .catch(() => setMediaLibraryVideos([]))
      .finally(() => setMediaLibraryLoading(false));
  }, [showVideoLibraryPicker]);

  const fetchMovies = async () => {
    try {
      setLoading(true);
      const response = await apiService.getMovies('limit=100&page=1');
      const data = Array.isArray(response.data) ? response.data : response.data?.data || [];
      setMovies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching movies:', error);
      const msg = error.response?.data?.message || error.message || 'Erreur lors du chargement des films';
      toast.error(msg);
      setMovies([]);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (movie) => {
    setEditingMovie(movie);
    setNewMovie({
      title: movie.title || '',
      type: movie.type || 'movie',
      genre: movie.genre || '',
      year: movie.year || new Date().getFullYear(),
      duration: movie.duration || '',
      rating: movie.rating ?? 0,
      description: movie.description || '',
      poster: movie.poster || '',
      videoUrl: movie.videoUrl || '',
      isPopular: movie.isPopular || false,
      countries: Array.isArray(movie.countries) ? [...movie.countries] : [],
      shipId: movie.shipId,
      destination: movie.destination || '',
      episodes: [],
      translations:
        movie.translations && typeof movie.translations === 'object'
          ? { ...emptyTranslations(), ...movie.translations }
          : emptyTranslations(),
    });
    setActiveLang('fr');
    setPosterPreview(movie.poster || null);
    setPosterFile(null);
    setVideoPreview(null);
    setVideoFile(null);
    setEpisodes(
      Array.isArray(movie.episodes)
        ? movie.episodes.map((ep, i) => ({
            ...ep,
            id: ep.id || `episode_${i}`,
            videoUrl: ep.videoUrl || '',
            translations:
              ep.translations && typeof ep.translations === 'object'
                ? { ...emptyTranslations(), ...ep.translations }
                : emptyTranslations(),
          }))
        : []
    );
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingMovie(null);
    setPosterFile(null);
    setPosterPreview(null);
    setVideoFile(null);
    setVideoPreview(null);
    setEpisodes([]);
    setNewEpisode({
      title: '',
      duration: '',
      description: '',
      videoFile: null,
      videoPreview: null,
      translations: emptyTranslations(),
      autoDuration: true,
    });
    setActiveLang('fr');
    setNewMovie({
      title: '',
      type: 'movie',
      genre: '',
      year: new Date().getFullYear(),
      duration: '',
      rating: 0,
      description: '',
      poster: '',
      videoUrl: '',
      isPopular: false,
      countries: [],
      episodes: [],
      translations: emptyTranslations(),
    });
  };

  const handleDeleteMovie = async (movie) => {
    if (!window.confirm(t('movies.confirmDeleteContent', { title: movie.title }))) return;
    const id = movie._id || movie.id;
    try {
      await apiService.deleteMovie(id);
      setMovies(movies.filter((m) => (m._id || m.id) !== id));
      toast.success(t('movies.contentDeleted'));
    } catch (error) {
      console.error('Suppression:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  const filteredMovies = movies.filter((movie) => {
    const matchesSearch =
      !searchQuery ||
      movie.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      movie.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'movie' && movie.type === 'movie') ||
      (filter === 'series' && movie.type === 'series');
    const matchesCountry =
      countryFilter === 'all' ||
      (movie.countries &&
        movie.countries.some((country) => country.toLowerCase().includes(countryFilter.toLowerCase())));
    const matchesDestination =
      destinationFilter === 'all' ||
      (movie.destination && movie.destination.toLowerCase().includes(destinationFilter.toLowerCase()));
    const matchesShip = true;
    return matchesSearch && matchesFilter && matchesCountry && matchesDestination && matchesShip;
  });

  const handleAddMovie = async () => {
    if (!newMovie.title || !newMovie.genre || !newMovie.duration) {
      toast.error(t('movies.fillRequired'));
      return;
    }
    if (newMovie.countries.length === 0) {
      toast.error(t('movies.selectCountries'));
      return;
    }

    try {
      // Si une nouvelle affiche (fichier) a été sélectionnée, l’uploader pour obtenir une URL et que la carte l’affiche
      let posterUrl = newMovie.poster || '';
      if (posterFile) {
        try {
          const up = await apiService.uploadImage(posterFile);
          posterUrl = up?.image?.path || up?.image?.url || posterUrl;
        } catch (err) {
          console.error('Upload affiche:', err);
          toast.error(err.response?.data?.message || "Erreur lors de l'upload de l'affiche.");
          return;
        }
      } else if (posterPreview && (posterPreview.startsWith('http') || posterPreview.startsWith('/'))) {
        posterUrl = posterPreview;
      } else if (posterPreview) {
        posterUrl = posterPreview;
      }

      const translations = { fr: { title: newMovie.title, description: newMovie.description || '' } };
      LANG_LIST.forEach(({ code }) => {
        if (code === 'fr') return;
        const t = newMovie.translations?.[code];
        if (t && (t.title || t.description)) {
          translations[code] = { title: t.title || '', description: t.description || '' };
        }
      });
      const payload = {
        title: newMovie.title,
        type: newMovie.type,
        genre: newMovie.genre,
        year: newMovie.year,
        duration: newMovie.duration,
        rating: newMovie.rating || 0,
        description: newMovie.description || '',
        translations,
        poster: posterUrl,
        videoUrl: newMovie.videoUrl || '',
        isPopular: newMovie.isPopular || false,
        countries: newMovie.countries,
        shipId: newMovie.shipId,
        destination: newMovie.destination,
        episodes:
          newMovie.type === 'series'
            ? episodes.map((ep, i) => ({
                title: ep.title,
                duration: ep.duration || '',
                description: ep.description || '',
                videoUrl: String(ep.videoUrl ?? ep.videoPreview ?? '').trim(),
                order: i,
                translations: ep.translations && typeof ep.translations === 'object' ? ep.translations : undefined,
              }))
            : [],
      };

      if (editingMovie) {
        const id = editingMovie._id || editingMovie.id;
        const response = await apiService.updateMovie(id, payload);
        const updated = response.data;
        setMovies(movies.map((m) => ((m._id || m.id) === id ? { ...updated, id: updated._id || updated.id } : m)));
        closeModal();
        toast.success(t('movies.contentUpdated'));
        if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));
      } else {
        const response = await apiService.createMovie(payload);
        const created = response.data;
        setMovies([{ ...created, id: created._id || created.id }, ...movies]);
        closeModal();
        toast.success(t('movies.contentAdded'));
        if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));
      }
    } catch (error) {
      console.error(editingMovie ? 'Erreur modification' : 'Erreur ajout:', error);
      toast.error(
        error.response?.data?.message ||
          (editingMovie ? 'Erreur lors de la modification' : "Erreur lors de l'ajout du contenu")
      );
    }
  };

  const toggleCountry = (countryName) => {
    setNewMovie({
      ...newMovie,
      countries: newMovie.countries.includes(countryName)
        ? newMovie.countries.filter((name) => name !== countryName)
        : [...newMovie.countries, countryName],
    });
  };

  const handlePosterUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Vérifier le type de fichier
      if (!file.type.startsWith('image/')) {
        toast.error(t('movies.selectImage'));
        return;
      }

      // Vérifier la taille (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('movies.fileTooLarge5MB'));
        return;
      }

      setPosterFile(file);

      // Créer une preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPosterPreview(reader.result);
        setNewMovie({ ...newMovie, poster: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const removePoster = () => {
    setPosterFile(null);
    setPosterPreview(null);
    setNewMovie({ ...newMovie, poster: '' });
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast.error(t('movies.selectVideo'));
      return;
    }
    if (file.size > 1000 * 1024 * 1024) {
      toast.error(t('movies.fileTooLarge1000MB'));
      return;
    }

    setVideoFile(file);
    const objectUrl = URL.createObjectURL(file);
    setVideoPreview(objectUrl);

    // Calcul automatique de la durée à partir du fichier
    getVideoDurationFromFile(file)
      .then((seconds) => {
        if (seconds > 0) {
          setNewMovie((prev) => ({ ...prev, duration: formatDurationFromSeconds(seconds) }));
          toast.success(`Durée détectée : ${formatDurationFromSeconds(seconds)}`);
        }
      })
      .catch(() => {});

    try {
      setVideoUploading(true);
      setVideoUploadProgress(0);
      const result = await apiService.uploadVideo(file, (pct) => setVideoUploadProgress(pct));
      if (result?.success && result?.video?.url) {
        setNewMovie((prev) => ({ ...prev, videoUrl: result.video.url }));
        toast.success(t('movies.videoCompressedSuccess'));
      } else {
        throw new Error(result?.message || "Échec de l'upload");
      }
    } catch (err) {
      console.error('Upload vidéo:', err);
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Erreur lors de l'upload. Saisissez un lien direct ci-dessous ou réessayez.";
      toast.error(msg);
      setNewMovie((prev) => ({ ...prev, videoUrl: '' }));
    } finally {
      setVideoUploading(false);
      setVideoUploadProgress(0);
    }
  };

  const removeVideo = () => {
    setVideoFile(null);
    setVideoPreview(null);
    setNewMovie({ ...newMovie, videoUrl: '' });
  };

  const handleEpisodeVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error(t('movies.selectVideo'));
      return;
    }
    if (file.size > 1000 * 1024 * 1024) {
      toast.error(t('movies.fileTooLarge1000MB'));
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setNewEpisode((prev) => ({ ...prev, videoFile: file, videoPreview: objectUrl }));

    // Calcul automatique de la durée pour l'épisode (si option activée)
    getVideoDurationFromFile(file)
      .then((seconds) => {
        if (seconds > 0) {
          setNewEpisode((prev) => {
            const newDuration = prev.autoDuration !== false ? formatDurationFromSeconds(seconds) : prev.duration;
            if (prev.autoDuration !== false)
              toast.success(`Durée épisode : ${formatDurationFromSeconds(seconds)}`, { id: 'ep-duration' });
            return { ...prev, duration: newDuration };
          });
        }
      })
      .catch(() => {});

    try {
      toast.loading('Compression et upload en cours (480p)...', { id: 'ep-video' });
      const result = await apiService.uploadVideo(file);
      if (result?.success && result?.video?.url) {
        setNewEpisode((prev) => ({ ...prev, videoFile: file, videoPreview: result.video.url }));
        toast.success(t('movies.videoCompressedShort'), { id: 'ep-video' });
      } else {
        toast.dismiss('ep-video');
        setNewEpisode((prev) => ({ ...prev, videoFile: file }));
      }
    } catch (err) {
      setNewEpisode((prev) => ({ ...prev, videoFile: file, videoPreview: objectUrl }));
      const msg = err.response?.data?.message || err.message || 'Upload échoué. Réessayez ou ajoutez un lien direct.';
      toast.error(msg, { id: 'ep-video' });
    }
  };

  const removeEpisodeVideo = () => {
    setNewEpisode({
      ...newEpisode,
      videoFile: null,
      videoPreview: null,
    });
  };

  const getVideoLibraryList = () => mediaLibraryVideos;

  /** Affiche la durée sans doubler "min" (ex: "45min" → "45min", "45" → "45 min") */
  const formatDurationDisplay = (duration) => {
    if (!duration) return null;
    const d = String(duration).trim();
    if (/min|h\s|h$/.test(d)) return d;
    return `${d} min`;
  };

  const selectVideoFromLibrary = (video) => {
    // Stocker le chemin relatif pour que l’URL soit valide côté backend et app (ex: /uploads/videos/xxx.mp4)
    const urlToStore = video.path || (typeof video.url === 'string' ? video.url : '');
    if (showVideoLibraryPicker === 'movie') {
      setVideoFile(null);
      setVideoPreview(urlToStore);
      setNewMovie((prev) => ({ ...prev, videoUrl: urlToStore }));
    } else if (showVideoLibraryPicker === 'episode') {
      setNewEpisode((prev) => {
        const next = { ...prev, videoFile: null, videoPreview: urlToStore };
        if (prev.autoDuration !== false && urlToStore) {
          const fullUrl = urlToStore.startsWith('http')
            ? urlToStore
            : `${window.location.origin}${urlToStore.startsWith('/') ? '' : '/'}${urlToStore}`;
          getVideoDurationFromUrl(fullUrl).then((seconds) => {
            if (seconds > 0) {
              setNewEpisode((p) => ({ ...p, duration: formatDurationFromSeconds(seconds) }));
              toast.success(`Durée : ${formatDurationFromSeconds(seconds)}`, { id: 'ep-duration-lib' });
            }
          });
        }
        return next;
      });
    }
    setShowVideoLibraryPicker(null);
    toast.success(t('movies.videoFromLibrary'));
  };

  const addEpisode = () => {
    if (!newEpisode.title || !newEpisode.duration) {
      toast.error(t('movies.fillEpisodeTitleDuration'));
      return;
    }
    const videoUrl =
      newEpisode.videoPreview && !String(newEpisode.videoPreview).startsWith('blob:')
        ? String(newEpisode.videoPreview).trim()
        : '';
    const episode = {
      ...newEpisode,
      id: editingEpisodeIndex !== null ? episodes[editingEpisodeIndex].id : `episode_${Date.now()}`,
      videoUrl,
      translations:
        newEpisode.translations && typeof newEpisode.translations === 'object'
          ? newEpisode.translations
          : emptyTranslations(),
    };

    if (editingEpisodeIndex !== null) {
      const updatedEpisodes = [...episodes];
      updatedEpisodes[editingEpisodeIndex] = episode;
      setEpisodes(updatedEpisodes);
      setEditingEpisodeIndex(null);
    } else {
      setEpisodes([...episodes, episode]);
    }

    setNewEpisode({
      title: '',
      duration: '',
      description: '',
      videoFile: null,
      videoPreview: null,
      translations: emptyTranslations(),
      autoDuration: true,
    });
    setActiveLangEpisode('fr');
    setShowEpisodeModal(false);
    toast.success(editingEpisodeIndex !== null ? 'Épisode modifié' : 'Épisode ajouté');
  };

  const editEpisode = (index) => {
    const episode = episodes[index];
    setNewEpisode({
      title: episode.title || '',
      duration: episode.duration || '',
      description: episode.description || '',
      videoFile: null,
      videoPreview: episode.videoUrl || null,
      translations:
        episode.translations && typeof episode.translations === 'object'
          ? { ...emptyTranslations(), ...episode.translations }
          : emptyTranslations(),
      autoDuration: newEpisode.autoDuration !== false,
    });
    setActiveLangEpisode('fr');
    setEditingEpisodeIndex(index);
    setShowEpisodeModal(true);
  };

  const deleteEpisode = (index) => {
    setEpisodes(episodes.filter((_, i) => i !== index));
    toast.success(t('movies.episodeDeleted'));
  };

  const openEpisodeModal = () => {
    setNewEpisode({
      title: '',
      duration: '',
      description: '',
      videoFile: null,
      videoPreview: null,
      translations: emptyTranslations(),
      autoDuration: true,
    });
    setActiveLangEpisode('fr');
    setEditingEpisodeIndex(null);
    setShowEpisodeModal(true);
  };

  const handleEpisodeCalculateDuration = () => {
    const url =
      newEpisode.videoPreview && !String(newEpisode.videoPreview).startsWith('blob:') ? newEpisode.videoPreview : null;
    if (!url) {
      toast.error(t('movies.selectVideoFirst'));
      return;
    }
    setEpisodeDurationLoading(true);
    getVideoDurationFromUrl(url)
      .then((seconds) => {
        setEpisodeDurationLoading(false);
        if (seconds > 0) {
          setNewEpisode((prev) => ({ ...prev, duration: formatDurationFromSeconds(seconds) }));
          toast.success(`Durée : ${formatDurationFromSeconds(seconds)}`);
        } else {
          toast.error(t('movies.cannotReadDuration'));
        }
      })
      .catch(() => {
        setEpisodeDurationLoading(false);
        toast.error(t('movies.errorDuration'));
      });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Chargement du catalogue...</p>
        </div>
      </div>
    );
  }

  const hasActiveFilters = countryFilter !== 'all' || destinationFilter !== 'all';

  return (
    <div className="space-y-7 pb-8 w-full">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('movies.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('movies.subtitle')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors shrink-0"
        >
          <Plus size={18} />
          {t('movies.addMovie')}
        </motion.button>
      </div>

      {/* Barre recherche + filtres type */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1 min-w-0">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors"
            />
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-1 gap-0.5 shrink-0">
            <button
              onClick={() => setFilter('all')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filter === 'all'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('movies.all')}
            </button>
            <button
              onClick={() => setFilter('movie')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filter === 'movie'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Film size={16} />
              {t('movies.films')}
            </button>
            <button
              onClick={() => setFilter('series')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                filter === 'series'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tv size={16} />
              {t('movies.series')}
            </button>
          </div>
        </div>

        {/* Filtres avancés repliables */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setFiltersExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-slate-500 shrink-0" />
              {t('common.advancedFilters')}
              {hasActiveFilters && (
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-xs font-medium">
                  actifs
                </span>
              )}
            </span>
            <ChevronDown
              size={18}
              className={`text-slate-400 shrink-0 transition-transform ${filtersExpanded ? 'rotate-180' : ''}`}
            />
          </button>
          {filtersExpanded && (
            <div className="px-4 pb-4 pt-3 border-t border-slate-100">
              <FilterBar
                countryFilter={countryFilter}
                setCountryFilter={setCountryFilter}
                destinationFilter={destinationFilter}
                setDestinationFilter={setDestinationFilter}
              />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
            <Clapperboard size={20} className="text-slate-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('movies.total')}</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">{movies.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
            <Film size={20} className="text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('movies.films')}</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
              {movies.filter((m) => m.type === 'movie').length}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 px-5 py-4 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50">
            <Tv size={20} className="text-violet-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{t('movies.series')}</p>
            <p className="text-xl font-bold text-slate-900 tabular-nums mt-0.5">
              {movies.filter((m) => m.type === 'series').length}
            </p>
          </div>
        </div>
      </div>

      {/* Grille de cartes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-5">
        {filteredMovies.map((movie) => (
          <motion.div
            key={movie._id || movie.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 hover:shadow-lg transition-all duration-200 flex flex-col"
          >
            <div className="poster-netflix aspect-[2/3] max-h-44 sm:max-h-48 bg-gradient-to-br from-slate-200 to-slate-300 relative overflow-hidden shrink-0">
              {movie.poster ? (
                <img
                  src={getImageSrc(movie.poster)}
                  alt={movie.title}
                  className="w-full h-full object-cover object-center"
                  loading="lazy"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    const placeholder = e.target.nextElementSibling;
                    if (placeholder) placeholder.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`absolute inset-0 ${movie.poster ? 'hidden' : 'flex'} items-center justify-center`}>
                <Clapperboard size={32} className="text-slate-400" />
              </div>
              {movie.rating ? (
                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md flex items-center gap-0.5 z-10">
                  <span className="text-xs text-amber-400">★</span>
                  <span className="text-xs font-medium text-white">{movie.rating}</span>
                </div>
              ) : null}
              {movie.year ? (
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md z-10">
                  <span className="text-xs font-medium text-white">{movie.year}</span>
                </div>
              ) : null}
            </div>
            <div className="p-4 flex-1 flex flex-col min-h-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 flex-1 min-w-0">
                  {movie.title}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-md shrink-0 font-medium ${
                    movie.type === 'movie' ? 'bg-indigo-50 text-indigo-700' : 'bg-violet-50 text-violet-700'
                  }`}
                >
                  {movie.type === 'movie' ? t('movies.filmLabel') : t('movies.seriesLabel')}
                </span>
              </div>
              {movie.description ? (
                <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">{movie.description}</p>
              ) : (
                <div className="mb-3 min-h-[2rem]" />
              )}
              {movie.countries && movie.countries.length > 0 ? (
                <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                  <MapPin size={12} className="text-slate-400 shrink-0" />
                  {movie.countries.slice(0, 3).map((countryName) => {
                    const country = availableCountries.find((c) => c.name === countryName);
                    return country ? (
                      <span key={countryName} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                        {country.name}
                      </span>
                    ) : null;
                  })}
                  {movie.countries.length > 3 ? (
                    <span className="text-xs text-slate-400">+{movie.countries.length - 3}</span>
                  ) : null}
                </div>
              ) : null}
              <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-400 mt-auto">
                <span className="flex items-center gap-1">
                  <Eye size={12} className="text-slate-400 shrink-0" aria-hidden />
                  {(movie.viewCount ?? 0).toLocaleString()} {t('movies.views')}
                </span>
                {movie.genre ? <span>· {movie.genre}</span> : null}
                {formatDurationDisplay(movie.duration) ? <span>· {formatDurationDisplay(movie.duration)}</span> : null}
                {movie.episodes != null ? (
                  <span>· {Array.isArray(movie.episodes) ? movie.episodes.length : movie.episodes} ép.</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => openEditModal(movie)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs font-medium"
                  title={t('common.edit')}
                >
                  <Edit size={14} />
                  {t('common.edit')}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteMovie(movie)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium"
                  title={t('common.delete')}
                >
                  <Trash2 size={14} />
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {filteredMovies.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-2xl bg-slate-100 p-6 mb-4">
              <Clapperboard size={40} className="text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">{t('movies.noContent')}</p>
            <p className="text-sm text-slate-500 mt-1">{t('movies.noContentHint')}</p>
          </div>
        )}
      </div>

      {/* Modal Ajouter / Modifier film ou série — interface moderne */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200/80"
          >
            <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600">
                  <Clapperboard size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editingMovie ? t('movies.editContent') : t('movies.addFilmOrSeries')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingMovie ? 'Mettez à jour les informations' : 'Remplissez les champs ci-dessous'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label={t('common.close')}
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type *</label>
                  <select
                    value={newMovie.type}
                    onChange={(e) => setNewMovie({ ...newMovie, type: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  >
                    <option value="movie">Film</option>
                    <option value="series">Série</option>
                  </select>
                </div>
              </div>

              {/* Contenu par langue */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contenu par langue</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {LANG_LIST.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setActiveLang(code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeLang === code ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {activeLang === 'fr' ? (
                  <>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                      <input
                        type="text"
                        value={newMovie.title}
                        onChange={(e) => setNewMovie({ ...newMovie, title: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        placeholder="Ex: Inception"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={newMovie.description}
                        onChange={(e) => setNewMovie({ ...newMovie, description: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        rows={4}
                        placeholder="Description du film ou de la série..."
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                      <input
                        type="text"
                        value={newMovie.translations?.[activeLang]?.title || ''}
                        onChange={(e) =>
                          setNewMovie({
                            ...newMovie,
                            translations: {
                              ...newMovie.translations,
                              [activeLang]: { ...newMovie.translations?.[activeLang], title: e.target.value },
                            },
                          })
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        placeholder="Title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={newMovie.translations?.[activeLang]?.description || ''}
                        onChange={(e) =>
                          setNewMovie({
                            ...newMovie,
                            translations: {
                              ...newMovie.translations,
                              [activeLang]: { ...newMovie.translations?.[activeLang], description: e.target.value },
                            },
                          })
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        rows={4}
                        placeholder="Description"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Genre et Année */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Genre *</label>
                  <select
                    value={newMovie.genre}
                    onChange={(e) => setNewMovie({ ...newMovie, genre: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  >
                    <option value="">Sélectionner un genre</option>
                    <option value="Action">Action</option>
                    <option value="Comédie">Comédie</option>
                    <option value="Drame">Drame</option>
                    <option value="Thriller">Thriller</option>
                    <option value="Science-fiction">Science-fiction</option>
                    <option value="Horreur">Horreur</option>
                    <option value="Romance">Romance</option>
                    <option value="Aventure">Aventure</option>
                    <option value="Animation">Animation</option>
                    <option value="Documentaire">Documentaire</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Année</label>
                  <input
                    type="number"
                    value={newMovie.year}
                    onChange={(e) =>
                      setNewMovie({ ...newMovie, year: parseInt(e.target.value) || new Date().getFullYear() })
                    }
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    placeholder="2024"
                    min="1900"
                    max={new Date().getFullYear() + 1}
                  />
                </div>
              </div>

              {/* Durée et Note */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    Durée *<span className="text-xs font-normal text-gray-500">(calculée auto. à l’upload vidéo)</span>
                  </label>
                  <input
                    type="text"
                    value={newMovie.duration}
                    onChange={(e) => setNewMovie({ ...newMovie, duration: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    placeholder={newMovie.type === 'movie' ? 'Ex: 2h 30min' : 'Ex: 10 épisodes'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Note (0-5)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={newMovie.rating}
                    onChange={(e) => setNewMovie({ ...newMovie, rating: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    placeholder="4.5"
                  />
                </div>
              </div>

              {/* Upload Poster */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Affiche (Poster)</label>
                {posterPreview ? (
                  <div className="relative">
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="relative w-24 h-32 rounded-lg overflow-hidden bg-white border border-gray-200">
                          <img src={posterPreview} alt="Poster preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {posterFile?.name || 'Affiche sélectionnée'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {posterFile ? `${(posterFile.size / 1024).toFixed(2)} KB` : 'Image enregistrée'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removePoster}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload size={32} className="text-gray-400 mb-2" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Cliquez pour uploader</span> ou glissez-déposez
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF jusqu'à 5MB</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handlePosterUpload} className="hidden" />
                  </label>
                )}
              </div>

              {/* Upload Vidéo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vidéo (optionnel)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowVideoLibraryPicker('movie')}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2 text-sm"
                  >
                    <Video size={18} />
                    Choisir depuis la bibliothèque vidéo
                  </motion.button>
                </div>
                {videoPreview || newMovie.videoUrl ? (
                  <div className="relative">
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      {videoUploading && (
                        <div className="mb-3">
                          <p className="text-xs text-blue-600 mb-1 flex items-center gap-1.5">
                            <Upload size={14} className="shrink-0 animate-pulse" />
                            Compression à 480p en cours...
                          </p>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full transition-all"
                              style={{ width: `${videoUploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <div
                          className="relative w-40 h-24 rounded-lg overflow-hidden bg-black border border-gray-200 flex items-center justify-center shrink-0 cursor-pointer group"
                          onClick={() =>
                            (videoPreview || newMovie.videoUrl) &&
                            getVideoPreviewUrl(videoPreview || newMovie.videoUrl) &&
                            setVideoPlayerModal({
                              open: true,
                              src: videoPreview || newMovie.videoUrl,
                              title: videoFile?.name || 'Vidéo sélectionnée',
                            })
                          }
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) =>
                            (e.key === 'Enter' || e.key === ' ') &&
                            (videoPreview || newMovie.videoUrl) &&
                            getVideoPreviewUrl(videoPreview || newMovie.videoUrl) &&
                            (e.preventDefault(),
                            setVideoPlayerModal({
                              open: true,
                              src: videoPreview || newMovie.videoUrl,
                              title: videoFile?.name || 'Vidéo sélectionnée',
                            }))
                          }
                          aria-label={t('common.playVideo')}
                        >
                          {videoUploading ? (
                            <Upload size={28} className="text-blue-400 animate-pulse" />
                          ) : (videoPreview || newMovie.videoUrl) &&
                            getVideoPreviewUrl(videoPreview || newMovie.videoUrl) ? (
                            <>
                              <video
                                src={getVideoPreviewUrl(videoPreview || newMovie.videoUrl)}
                                className="w-full h-full object-cover pointer-events-none group-hover:opacity-90"
                                muted
                                playsInline
                                preload="metadata"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow">
                                  <Play size={20} className="text-gray-800 ml-0.5" fill="currentColor" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <Video size={24} className="text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{videoFile?.name || 'Vidéo sélectionnée'}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {videoFile ? `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB` : ''}{' '}
                            {!videoUploading && videoFile && '• Compressé 480p'}
                          </p>
                          <p className="text-xs text-gray-500 truncate" title={videoPreview || newMovie.videoUrl}>
                            {videoPreview?.startsWith('blob:') ? 'Fichier local' : videoPreview || newMovie.videoUrl}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removeVideo}
                          disabled={videoUploading}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Video size={32} className="text-gray-400 mb-2" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Cliquez pour uploader</span> ou glissez-déposez
                      </p>
                      <p className="text-xs text-gray-500">MP4, AVI, MOV jusqu'à 1000 Mo (compression 480p)</p>
                    </div>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      disabled={videoUploading}
                      className="hidden"
                    />
                  </label>
                )}
                <p className="text-xs text-gray-500 mt-2 mb-1">Ou lien direct (URL) :</p>
                <input
                  type="url"
                  placeholder="https://... (si l'upload échoue)"
                  value={newMovie.videoUrl || ''}
                  onChange={(e) => setNewMovie({ ...newMovie, videoUrl: e.target.value.trim() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              {/* Épisodes (pour les séries) */}
              {newMovie.type === 'series' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700">Épisodes</label>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={openEpisodeModal}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                      <Plus size={16} />
                      {t('movies.addEpisode')}
                    </motion.button>
                  </div>
                  {episodes.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg p-4 space-y-3 max-h-80 overflow-y-auto">
                      {episodes.map((episode, index) => (
                        <div key={episode.id || index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                          {/* Aperçu vidéo de l'épisode (agrandi) + icône play → clic ouvre le player */}
                          <div
                            className="flex-shrink-0 w-52 h-28 rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center relative group cursor-pointer"
                            onClick={() =>
                              episode.videoUrl &&
                              setVideoPlayerModal({
                                open: true,
                                src: episode.videoUrl,
                                title: episode.title || `Épisode ${index + 1}`,
                              })
                            }
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) =>
                              episode.videoUrl &&
                              (e.key === 'Enter' || e.key === ' ') &&
                              (e.preventDefault(),
                              setVideoPlayerModal({
                                open: true,
                                src: episode.videoUrl,
                                title: episode.title || `Épisode ${index + 1}`,
                              }))
                            }
                            aria-label={`Lire ${episode.title || `Épisode ${index + 1}`}`}
                          >
                            {episode.videoUrl ? (
                              <>
                                <video
                                  src={getVideoPreviewUrl(episode.videoUrl)}
                                  className="w-full h-full object-cover pointer-events-none"
                                  muted
                                  playsInline
                                  preload="metadata"
                                  onMouseEnter={(e) => e.target.play()}
                                  onMouseLeave={(e) => {
                                    e.target.pause();
                                    e.target.currentTime = 0;
                                  }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-80 group-hover:opacity-0 transition-opacity pointer-events-none">
                                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                                    <Play size={24} className="text-gray-800 ml-0.5" fill="currentColor" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <Film size={32} className="text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-blue-600">Épisode {index + 1}</span>
                              <span className="font-medium text-gray-900 text-sm truncate">{episode.title}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {episode.duration} {episode.description && `• ${episode.description}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => editEpisode(index)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => deleteEpisode(index)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border border-gray-200 border-dashed rounded-lg p-6 text-center">
                      <Tv size={32} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Aucun épisode ajouté</p>
                      <p className="text-xs text-gray-400 mt-1">{t('movies.addEpisodeHint')}</p>
                    </div>
                  )}
                  {episodes.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2">{episodes.length} épisode(s) ajouté(s)</p>
                  )}
                </div>
              )}

              {/* Pays */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Affecter aux pays *</label>
                <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {availableCountries.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Aucun pays disponible</p>
                  ) : (
                    <div className="space-y-2">
                      {availableCountries.map((country) => (
                        <label
                          key={country.code}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={newMovie.countries.includes(country.name)}
                            onChange={() => toggleCountry(country.name)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1 flex items-center gap-2">
                            <span className="font-medium text-gray-900">{country.name}</span>
                            <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">
                              {country.code}
                            </span>
                          </div>
                          {newMovie.countries.includes(country.name) && <MapPin size={16} className="text-blue-600" />}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {newMovie.countries.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">{newMovie.countries.length} pays sélectionné(s)</p>
                )}
                {newMovie.countries.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Veuillez sélectionner au moins un pays</p>
                )}
              </div>

              {/* Popular */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isPopular"
                  checked={newMovie.isPopular}
                  onChange={(e) => setNewMovie({ ...newMovie, isPopular: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="isPopular" className="text-sm font-medium text-gray-700">
                  Contenu populaire
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-white hover:border-slate-300 transition-colors"
              >
                Annuler
              </button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddMovie}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
              >
                <Save size={18} />
                {editingMovie ? t('movies.saveChanges') : t('common.save')}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Ajouter/Modifier Épisode */}
      {showEpisodeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">
                {editingEpisodeIndex !== null ? t('movies.editEpisode') : t('movies.addEpisode')}
              </h2>
              <button
                onClick={() => {
                  setShowEpisodeModal(false);
                  setEditingEpisodeIndex(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {/* Titre et Durée */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Titre de l'épisode *</label>
                  <input
                    type="text"
                    value={newEpisode.title}
                    onChange={(e) => setNewEpisode({ ...newEpisode, title: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    placeholder="Ex: Épisode 1 - Le début"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    Durée *
                  </label>
                  <div className="flex gap-2 flex-wrap items-center">
                    <input
                      type="text"
                      value={newEpisode.duration}
                      onChange={(e) => setNewEpisode({ ...newEpisode, duration: e.target.value })}
                      className="flex-1 min-w-[100px] px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                      placeholder="Ex: 45min"
                    />
                    <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={newEpisode.autoDuration !== false}
                        onChange={(e) => setNewEpisode({ ...newEpisode, autoDuration: e.target.checked })}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Calcul auto
                    </label>
                    {newEpisode.videoPreview && (
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleEpisodeCalculateDuration}
                        disabled={episodeDurationLoading}
                        className="px-3 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Clock size={16} />
                        {episodeDurationLoading ? '…' : 'Calculer durée'}
                      </motion.button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Remplie à l'upload ou via « Calculer durée » si vidéo depuis la bibliothèque
                  </p>
                </div>
              </div>

              {/* Description (français) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (français)</label>
                <textarea
                  value={newEpisode.description}
                  onChange={(e) => setNewEpisode({ ...newEpisode, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  rows={3}
                  placeholder="Description de l'épisode..."
                />
              </div>

              {/* Contenu par langue (épisode) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Languages size={18} />
                  Contenu par langue
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {LANG_LIST.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setActiveLangEpisode(code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${activeLangEpisode === code ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {activeLangEpisode === 'fr' ? (
                  <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-600">
                      Le titre et la description ci-dessus sont utilisés pour le français.
                    </p>
                    <p className="text-xs text-slate-500">
                      Utilisez les onglets pour les autres langues (EN, ES, IT, DE, AR).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Titre ({LANG_LIST.find((l) => l.code === activeLangEpisode)?.label})
                      </label>
                      <input
                        type="text"
                        value={newEpisode.translations?.[activeLangEpisode]?.title || ''}
                        onChange={(e) =>
                          setNewEpisode({
                            ...newEpisode,
                            translations: {
                              ...newEpisode.translations,
                              [activeLangEpisode]: {
                                ...newEpisode.translations?.[activeLangEpisode],
                                title: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        placeholder="Title"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={newEpisode.translations?.[activeLangEpisode]?.description || ''}
                        onChange={(e) =>
                          setNewEpisode({
                            ...newEpisode,
                            translations: {
                              ...newEpisode.translations,
                              [activeLangEpisode]: {
                                ...newEpisode.translations?.[activeLangEpisode],
                                description: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                        rows={2}
                        placeholder="Description"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Vidéo Épisode */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vidéo de l'épisode</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowVideoLibraryPicker('episode')}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2 text-sm"
                  >
                    <Video size={18} />
                    Choisir depuis la bibliothèque vidéo
                  </motion.button>
                </div>
                {newEpisode.videoPreview ? (
                  <div className="relative">
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div
                          className="relative w-40 h-24 rounded-lg overflow-hidden bg-black border border-gray-200 flex items-center justify-center shrink-0 cursor-pointer group"
                          onClick={() =>
                            getVideoPreviewUrl(newEpisode.videoPreview) &&
                            setVideoPlayerModal({
                              open: true,
                              src: newEpisode.videoPreview,
                              title: newEpisode.videoFile?.name || 'Vidéo épisode',
                            })
                          }
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) =>
                            (e.key === 'Enter' || e.key === ' ') &&
                            getVideoPreviewUrl(newEpisode.videoPreview) &&
                            (e.preventDefault(),
                            setVideoPlayerModal({
                              open: true,
                              src: newEpisode.videoPreview,
                              title: newEpisode.videoFile?.name || 'Vidéo épisode',
                            }))
                          }
                          aria-label={t('common.playVideo')}
                        >
                          {getVideoPreviewUrl(newEpisode.videoPreview) ? (
                            <>
                              <video
                                src={getVideoPreviewUrl(newEpisode.videoPreview)}
                                className="w-full h-full object-cover pointer-events-none group-hover:opacity-90"
                                muted
                                playsInline
                                preload="metadata"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow">
                                  <Play size={20} className="text-gray-800 ml-0.5" fill="currentColor" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <Video size={24} className="text-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {newEpisode.videoFile?.name || 'Vidéo sélectionnée'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {newEpisode.videoFile
                              ? `${(newEpisode.videoFile.size / (1024 * 1024)).toFixed(2)} MB`
                              : 'Vidéo existante'}
                          </p>
                          <p className="text-xs text-gray-600 mt-1 truncate" title={newEpisode.videoPreview}>
                            URL :{' '}
                            {newEpisode.videoPreview.startsWith('blob:')
                              ? 'Fichier local (sera remplacé à l’enregistrement)'
                              : newEpisode.videoPreview}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removeEpisodeVideo}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Video size={32} className="text-gray-400 mb-2" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Cliquez pour uploader</span> ou glissez-déposez
                      </p>
                      <p className="text-xs text-gray-500">MP4, AVI, MOV jusqu'à 100MB</p>
                    </div>
                    <input type="file" accept="video/*" onChange={handleEpisodeVideoUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowEpisodeModal(false);
                  setEditingEpisodeIndex(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={addEpisode}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save size={18} />
                {editingEpisodeIndex !== null ? t('common.save') : t('common.add')}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Lecteur vidéo partagé (film, épisode liste, épisode formulaire) */}
      <VideoPlayerModal
        open={videoPlayerModal.open}
        onClose={() => setVideoPlayerModal((prev) => ({ ...prev, open: false }))}
        src={videoPlayerModal.src}
        title={videoPlayerModal.title}
      />

      {/* Modal Bibliothèque vidéo (film ou épisode) */}
      {showVideoLibraryPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                Choisir une vidéo — {showVideoLibraryPicker === 'movie' ? 'Film' : 'Épisode'}
              </h3>
              <button
                type="button"
                onClick={() => setShowVideoLibraryPicker(null)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {mediaLibraryLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent mb-3" />
                  <p>Chargement de la bibliothèque média...</p>
                </div>
              ) : getVideoLibraryList().length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Aucune vidéo. Allez dans{' '}
                  <Link
                    to="/bibliotheque"
                    onClick={() => setShowVideoLibraryPicker(null)}
                    className="font-semibold text-purple-600 hover:text-purple-700 underline"
                  >
                    Bibliothèque média
                  </Link>{' '}
                  pour en ajouter.
                </p>
              ) : (
                <div className="space-y-2">
                  {getVideoLibraryList().map((v) => (
                    <button
                      key={v.path}
                      type="button"
                      onClick={() => selectVideoFromLibrary(v)}
                      className="w-full text-left p-4 rounded-lg border border-gray-200 hover:bg-purple-50 hover:border-purple-200 transition-colors flex items-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <FileVideo size={24} className="text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{v.name || 'Sans titre'}</p>
                        <p className="text-sm text-gray-500 flex items-center gap-2">
                          {v.size != null && <span>{Math.round((v.size / 1024 / 1024) * 100) / 100} Mo</span>}
                        </p>
                      </div>
                      <Play size={18} className="text-purple-600 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Movies;

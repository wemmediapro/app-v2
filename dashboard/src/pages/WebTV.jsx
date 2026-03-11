import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Tv, Plus, Edit, Trash2, Search, Play, Pause, Radio, Users, X, Save, MapPin, Upload, Video, FileVideo, Clock, Calendar as CalendarIcon, Repeat, List, BarChart3, Volume2, VolumeX, ArrowUp, ArrowDown, Copy, CheckCircle, AlertCircle, Calendar, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import FilterBar from '../components/FilterBar';
import { apiService } from '../services/apiService';
import { useLanguage } from '../contexts/LanguageContext';
import { LANG_LIST, emptyTranslations } from '../utils/i18n';
import toast from 'react-hot-toast';
import VideoPlayerModal from '../components/VideoPlayerModal';

const WebTV = () => {
  const { t } = useLanguage();
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, live, ondemand
  const [countryFilter, setCountryFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('all');
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [editingChannel, setEditingChannel] = useState(null); // copie pour modifier nom, description, etc.
  const [showModal, setShowModal] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [selectedChannelForProgram, setSelectedChannelForProgram] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [playingProgram, setPlayingProgram] = useState(null);
  const [programStats, setProgramStats] = useState({});
  const [videoElement, setVideoElement] = useState(null);
  const [newProgram, setNewProgram] = useState({
    title: '',
    description: '',
    videoFile: null,
    videoPreview: null,
    streamUrl: '',
    duration: 0,
    uploadDate: '',
    category: '',
    startTime: '',
    endTime: '',
    daysOfWeek: [],
    isRepeating: false,
    isActive: true,
    order: 0,
    tags: []
  });
  const [editingProgram, setEditingProgram] = useState(null);
  const [newTag, setNewTag] = useState('');
  const [webTVAutoCalcEndTime, setWebTVAutoCalcEndTime] = useState(true); // calculer heure fin = début + durée (comme Radio)
  const [showVideoLibraryPicker, setShowVideoLibraryPicker] = useState(false);
  const [mediaLibraryVideos, setMediaLibraryVideos] = useState([]);
  const [mediaLibraryLoading, setMediaLibraryLoading] = useState(false);
  const [videoPlayerModal, setVideoPlayerModal] = useState({ open: false, src: '', title: '' });
  const [webtvDragOverIndex, setWebtvDragOverIndex] = useState(null);
  const webtvDragSourceIndexRef = useRef(null);
  const [activeLang, setActiveLang] = useState('fr');
  const [newChannel, setNewChannel] = useState({
    name: '',
    category: '',
    description: '',
    streamUrl: '',
    logo: '',
    imageUrl: '',
    isLive: true,
    isActive: true,
    quality: 'HD',
    viewers: 0,
    schedule: [],
    countries: [],
    translations: emptyTranslations()
  });

  // Pays disponibles
  const availableCountries = [
    { name: 'Maroc', code: 'MA' },
    { name: 'Tunisie', code: 'TN' },
    { name: 'Algérie', code: 'DZ' },
    { name: 'Italie', code: 'IT' },
    { name: 'Espagne', code: 'ES' }
  ];

  const [dbConnected, setDbConnected] = useState(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    apiService.healthCheck()
      .then((res) => setDbConnected(res.data?.mongodb === 'connected'))
      .catch(() => setDbConnected(false));
  }, []);

  useEffect(() => {
    if (!showVideoLibraryPicker) return;
    setMediaLibraryLoading(true);
    apiService.getMediaLibrary()
      .then((res) => {
        const list = res.data?.media && Array.isArray(res.data.media) ? res.data.media : [];
        setMediaLibraryVideos(list.filter((m) => m.type === 'video'));
      })
      .catch(() => setMediaLibraryVideos([]))
      .finally(() => setMediaLibraryLoading(false));
  }, [showVideoLibraryPicker]);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await apiService.getWebTVChannels();
      const raw = response.data;
      const list = Array.isArray(raw) ? raw : (raw?.data || raw?.channels || []);
      const channelsData = (Array.isArray(list) ? list : []).map(channel => ({
        ...channel,
        _id: channel._id || channel.id,
        programs: channel.programs || []
      }));
      setChannels(channelsData);
    } catch (error) {
      console.error('Error fetching channels:', error);
      const msg = error.response?.data?.message || error.message || 'Erreur lors du chargement des chaînes';
      toast.error(msg);
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredChannels = channels.filter(channel => {
    const matchesSearch = !searchQuery || 
      (channel.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       channel.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       channel.category?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = filter === 'all' || 
                         (filter === 'live' && channel.isLive) ||
                         (filter === 'ondemand' && !channel.isLive);
    const matchesCountry = countryFilter === 'all' || 
      (channel.countries && channel.countries.some(country => country.toLowerCase().includes(countryFilter.toLowerCase())));
    const matchesDestination = destinationFilter === 'all' || 
      (channel.destination && channel.destination.toLowerCase().includes(destinationFilter.toLowerCase()));
    const matchesShip = true;
    return matchesSearch && matchesFilter && matchesCountry && matchesDestination && matchesShip;
  });

  const handleToggleStatus = async (channel) => {
    try {
      await apiService.updateWebTVChannel(channel._id, { isActive: !channel.isActive });
      toast.success(channel.isActive ? t('webtv.channelDeactivated') : t('webtv.channelActivated'));
      fetchChannels();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de la modification');
    }
  };

  const handleDelete = async (channel) => {
    if (window.confirm(t('webtv.confirmDeleteChannel', { name: channel.name }))) {
      try {
        await apiService.deleteWebTVChannel(channel._id);
        toast.success(t('webtv.channelDeleted'));
        fetchChannels();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Erreur lors de la suppression');
      }
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('webtv.selectImageFile'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('movies.fileTooLarge5MB'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
        setLogoFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setNewChannel({ ...newChannel, logo: '', imageUrl: '' });
  };

  const toggleCountry = (countryName) => {
    setNewChannel({
      ...newChannel,
      countries: newChannel.countries.includes(countryName)
        ? newChannel.countries.filter(c => c !== countryName)
        : [...newChannel.countries, countryName]
    });
  };

  const handleAddChannel = async () => {
    if (!newChannel.name || !newChannel.category || !newChannel.streamUrl) {
      toast.error(t('webtv.fillRequired'));
      return;
    }

    if (newChannel.countries.length === 0) {
      toast.error(t('webtv.selectOneCountry'));
      return;
    }

    try {
      const translations = { fr: { name: newChannel.name, description: newChannel.description || '' } };
      LANG_LIST.forEach(({ code }) => {
        if (code === 'fr') return;
        const t = newChannel.translations?.[code];
        if (t && (t.name || t.description)) {
          translations[code] = { name: t.name || '', description: t.description || '' };
        }
      });
      const channelData = {
        ...newChannel,
        translations,
        imageUrl: logoPreview || newChannel.imageUrl || newChannel.logo,
        logo: logoPreview || newChannel.logo
      };

      await apiService.createWebTVChannel(channelData);
      setShowModal(false);
      toast.success(t('webtv.channelAddedSuccess'));
      fetchChannels();
      
      // Réinitialiser le formulaire
      setLogoFile(null);
      setLogoPreview(null);
      setActiveLang('fr');
      setNewChannel({
        name: '',
        category: '',
        description: '',
        streamUrl: '',
        logo: '',
        imageUrl: '',
        isLive: true,
        isActive: true,
        quality: 'HD',
        viewers: 0,
        schedule: [],
        countries: [],
        translations: emptyTranslations()
      });
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la chaîne:', error);
      const msg = error.response?.data?.message || error.message || 'Erreur lors de l\'ajout de la chaîne';
      toast.error(msg);
    }
  };

  const getCategoryLabel = (category) => {
    const labels = {
      actualites: 'Actualités',
      sport: 'Sport',
      divertissement: 'Divertissement',
      enfants: 'Enfants',
      musique: 'Musique',
      documentaire: 'Documentaire'
    };
    return labels[category] || category;
  };

  // Fonctions pour le calendrier et la programmation
  const daysOfWeek = [
    { value: 0, label: 'Lundi', short: 'Lun' },
    { value: 1, label: 'Mardi', short: 'Mar' },
    { value: 2, label: 'Mercredi', short: 'Mer' },
    { value: 3, label: 'Jeudi', short: 'Jeu' },
    { value: 4, label: 'Vendredi', short: 'Ven' },
    { value: 5, label: 'Samedi', short: 'Sam' },
    { value: 6, label: 'Dimanche', short: 'Dim' }
  ];

  const programCategories = ['Actualités', 'Sport', 'Divertissement', 'Enfants', 'Musique', 'Documentaire', 'Autre'];

  /** Identifiant unique d'un programme (API renvoie _id, création locale utilise id) */
  const getProgramId = (p) => (p && (p._id != null ? String(p._id) : p.id != null ? String(p.id) : '')) || '';

  // Grille calendrier : semaine début Lundi (alignée avec l'en-tête Lun, Mar, ..., Dim)
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    const paddingCount = (startingDayOfWeek + 6) % 7;

    const days = [];
    for (let i = 0; i < paddingCount; i++) {
      days.push({
        date: new Date(year, month, 1 - paddingCount + i),
        isCurrentMonth: false,
        isToday: false
      });
    }

    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const dayDate = new Date(year, month, i);
      days.push({
        date: dayDate,
        isCurrentMonth: true,
        isToday: dayDate.toDateString() === today.toDateString()
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
        isToday: false
      });
    }

    return days;
  };

  const getProgramsForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    const jsDay = date.getDay();
    const formDay = (jsDay + 6) % 7;

    return programs.filter(program => {
      if (!program.isActive) return false;

      if (program.isRepeating && program.daysOfWeek && program.daysOfWeek.length > 0) {
        const normalizedDays = program.daysOfWeek.map(d => Number(d));
        if (normalizedDays.includes(formDay)) return true;
      }

      if (program.uploadDate) {
        const uploadDateStr = new Date(program.uploadDate).toISOString().split('T')[0];
        if (uploadDateStr === dateStr) {
          return true;
        }
      }

      return false;
    });
  };

  const getProgramsForTimeSlot = (date, hour) => {
    const dayPrograms = getProgramsForDate(date);
    const slotStartSec = hour * 3600;
    const slotEndSec = (hour + 1) * 3600;
    const dayEndSec = 24 * 3600;
    return dayPrograms.filter((program) => {
      if (!program.startTime || !program.endTime) return false;
      const startParts = program.startTime.split(':').map(Number);
      const endParts = program.endTime.split(':').map(Number);
      const startSec = (startParts[0] || 0) * 3600 + (startParts[1] || 0) * 60 + (startParts[2] || 0);
      let endSec = (endParts[0] || 0) * 3600 + (endParts[1] || 0) * 60 + (endParts[2] || 0);
      if (endSec === 0) endSec = dayEndSec;
      return startSec < slotEndSec && endSec > slotStartSec;
    });
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const formatMonthYear = (date) => {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /** Calcule l'heure de fin à partir de l'heure de début (HH:MM ou HH:MM:SS) et de la durée en secondes. */
  const computeEndTimeFromStartAndDuration = (startTime, durationSeconds) => {
    if (!startTime || durationSeconds == null || durationSeconds <= 0) return '';
    const parts = startTime.trim().split(':').map(Number);
    const startSeconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    const totalSeconds = (startSeconds + Math.round(durationSeconds)) % (24 * 3600);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  /** Heure de fin d'un programme (endTime ou début + durée). Si seulement la durée est renseignée, on suppose début à 00:00. */
  const getProgramEndTime = (prog) => {
    if (!prog) return '';
    if (prog.endTime && prog.endTime.trim()) return prog.endTime.trim();
    const dur = prog.duration || 0;
    if (dur <= 0) return '';
    const start = prog.startTime && prog.startTime.trim() ? prog.startTime.trim() : '00:00';
    return computeEndTimeFromStartAndDuration(start, dur);
  };

  /** Heure de début pour le programme à l'ordre N : = heure de fin du programme précédent (ordre 0 = manuel, ordre ≥ 1 = auto). */
  const getStartTimeFromPreviousProgram = (order) => {
    if (order < 1) return '';
    const sorted = [...programs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (sorted.length === 0) return '';
    const prevIndex = Math.min(order - 1, sorted.length - 1);
    return getProgramEndTime(sorted[prevIndex]);
  };

  /** Version prenant la liste en argument (pour initialisation à l'ouverture du modal). */
  const getStartTimeFromPreviousProgramFromList = (programList, order) => {
    if (order < 1 || !programList?.length) return '';
    const sorted = [...programList].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const prevIndex = Math.min(order - 1, sorted.length - 1);
    return getProgramEndTime(sorted[prevIndex]);
  };

  /** Réindexe les ordres (0, 1, 2, ...) et recalcule toutes les heures : premier à 00:00, les suivants enchaînent. */
  const recalcProgramTimes = (programList) => {
    if (!programList?.length) return [];
    const sorted = [...programList].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    let currentStart = '00:00';
    return sorted.map((p, index) => {
      const duration = p.duration ?? 0;
      const endTime = duration > 0
        ? computeEndTimeFromStartAndDuration(currentStart, duration)
        : (p.endTime || currentStart);
      const program = {
        ...p,
        order: index,
        startTime: currentStart,
        endTime: endTime || p.endTime
      };
      currentStart = program.endTime || currentStart;
      return program;
    });
  };
  useEffect(() => {
    if (!showProgramModal) return;
    if (!webTVAutoCalcEndTime) return;
    const start = (newProgram.startTime || '').trim();
    const dur = newProgram.duration || 0;
    if (!start || dur <= 0) return;
    const computed = computeEndTimeFromStartAndDuration(start, dur);
    if (!computed) return;
    setNewProgram(prev => (prev.endTime === computed ? prev : { ...prev, endTime: computed }));
  }, [showProgramModal, webTVAutoCalcEndTime, newProgram.startTime, newProgram.duration, newProgram.endTime]);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('video/') && !file.name.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/)) {
      toast.error('Veuillez sélectionner un fichier vidéo (MP4, WebM, OGG, MOV)');
      return;
    }
    if (file.size > 1000 * 1024 * 1024) {
      toast.error('Le fichier est trop volumineux (max 1000 Mo)');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setNewProgram(prev => ({
      ...prev,
      videoFile: file,
      videoPreview: previewUrl,
      uploadDate: new Date().toISOString()
    }));

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(previewUrl);
      const dur = Math.round(video.duration);
      setNewProgram(prev => ({
        ...prev,
        duration: dur,
        endTime: computeEndTimeFromStartAndDuration(prev.startTime, dur) || prev.endTime
      }));
    };
    video.src = previewUrl;

    try {
      toast.loading('Compression à 480p en cours (1 à 2 min selon la taille)…', { id: 'webtv-video', duration: 120000 });
      const result = await apiService.uploadVideo(file);
      if (result?.success && result?.video?.url) {
        setNewProgram(prev => ({
          ...prev,
          streamUrl: result.video.url,
          videoPreview: result.video.url,
          endTime: computeEndTimeFromStartAndDuration(prev.startTime, prev.duration) || prev.endTime
        }));
        toast.success('Vidéo compressée à 480p', { id: 'webtv-video' });
      } else {
        toast.dismiss('webtv-video');
      }
    } catch (err) {
      toast.error('Compression échouée, fichier local utilisé', { id: 'webtv-video' });
    }
  };

  const removeVideo = () => {
    if (newProgram.videoPreview && newProgram.videoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(newProgram.videoPreview);
    }
    setNewProgram({
      ...newProgram,
      videoFile: null,
      videoPreview: null,
      streamUrl: '',
      duration: 0
    });
  };

  const getVideoLibraryList = () => mediaLibraryVideos;

  const selectVideoFromLibrary = (video) => {
    const url = video.url || video.path;
    if (!url) {
      toast.error('Vidéo sans URL');
      return;
    }
    // Durée fournie par l'API (backend lit les métadonnées avec ffprobe)
    const durFromApi = video.duration != null ? Math.round(Number(video.duration)) : 0;
    setNewProgram(prev => ({
      ...prev,
      videoFile: null,
      videoPreview: url,
      streamUrl: url,
      duration: durFromApi,
      endTime: computeEndTimeFromStartAndDuration(prev.startTime, durFromApi) || prev.endTime
    }));
    setShowVideoLibraryPicker(false);
    toast.success(durFromApi > 0 ? 'Vidéo sélectionnée depuis la bibliothèque' : 'Vidéo sélectionnée (durée non disponible)');
  };

  const generateStreamUrl = (videoFile) => {
    if (videoFile) {
      const blobUrl = URL.createObjectURL(videoFile);
      return blobUrl;
    }
    return '';
  };

  /** URL utilisable pour la lecture sur l'app (pas de blob). Les blob: ne fonctionnent pas en base ni sur l'app passagers. */
  const isPlayableStreamUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const t = url.trim();
    if (t.startsWith('blob:')) return false;
    return t.startsWith('http') || t.startsWith('/') || t.startsWith('uploads/');
  };

  const handleAddProgram = async () => {
    if (!newProgram.title || (!newProgram.videoFile && !newProgram.streamUrl)) {
      toast.error('Veuillez remplir le titre et ajouter une vidéo (fichier ou URL)');
      return;
    }

    // Ne jamais enregistrer une URL blob: — elle ne fonctionne pas sur l'app passagers (autre origine/session)
    const candidateUrl = newProgram.streamUrl || (newProgram.videoFile ? generateStreamUrl(newProgram.videoFile) : '');
    if (!isPlayableStreamUrl(candidateUrl)) {
      toast.error('La vidéo doit être sur le serveur pour être lue sur l\'app. Attendez la fin de l\'upload (compression 480p) ou choisissez une vidéo depuis la bibliothèque.');
      return;
    }
    const streamUrl = candidateUrl;
    const endTime = webTVAutoCalcEndTime && newProgram.startTime && newProgram.duration
      ? computeEndTimeFromStartAndDuration(newProgram.startTime, newProgram.duration)
      : (newProgram.endTime || '');
    const program = {
      id: `program_${Date.now()}`,
      title: newProgram.title,
      description: newProgram.description || '',
      streamUrl: streamUrl,
      duration: newProgram.duration,
      uploadDate: newProgram.uploadDate || new Date().toISOString(),
      fileName: newProgram.videoFile?.name || '',
      fileSize: newProgram.videoFile?.size || 0,
      category: newProgram.category,
      startTime: newProgram.startTime || '',
      endTime: endTime || newProgram.endTime || '',
      daysOfWeek: newProgram.daysOfWeek,
      isRepeating: newProgram.isRepeating,
      isActive: newProgram.isActive,
      order: newProgram.order,
      tags: newProgram.tags,
      playCount: 0,
      lastPlayed: null
    };

    const rawList = [...programs, program];
    const updatedPrograms = recalcProgramTimes(rawList);
    setPrograms(updatedPrograms);

    if (selectedChannelForProgram) {
      const updatedChannels = channels.map(c => 
        c._id === selectedChannelForProgram._id 
          ? { ...c, programs: updatedPrograms }
          : c
      );
      setChannels(updatedChannels);
      try {
        await apiService.updateWebTVChannel(selectedChannelForProgram._id, { ...selectedChannelForProgram, programs: updatedPrograms });
      } catch (err) {
        console.error('Erreur sauvegarde programmes:', err);
        toast.error(err.response?.data?.message || 'Les programmes n\'ont pas été enregistrés sur le serveur.');
      }
    }

    setNewProgram({
      title: '',
      description: '',
      videoFile: null,
      videoPreview: null,
      streamUrl: '',
      duration: 0,
      uploadDate: '',
      category: '',
      startTime: '',
      endTime: '',
      daysOfWeek: [],
      isRepeating: false,
      isActive: true,
      order: 0,
      tags: []
    });
    setNewTag('');

    toast.success('Programme ajouté avec succès');
  };

  const handleEditProgram = (program) => {
    setEditingProgram(program);
    setNewProgram({
      title: program.title,
      description: program.description || '',
      videoFile: null,
      videoPreview: program.streamUrl || null,
      streamUrl: program.streamUrl || '',
      duration: program.duration || 0,
      uploadDate: program.uploadDate || '',
      category: program.category || '',
      startTime: program.startTime || '',
      endTime: program.endTime || '',
      daysOfWeek: program.daysOfWeek || [],
      isRepeating: program.isRepeating || false,
      isActive: program.isActive !== undefined ? program.isActive : true,
      order: program.order || 0,
      tags: program.tags || []
    });
    setNewTag('');
  };

  const handleUpdateProgram = async () => {
    if (!newProgram.title) {
      toast.error('Veuillez remplir le titre');
      return;
    }

    const endTime = webTVAutoCalcEndTime && newProgram.startTime && (newProgram.duration || editingProgram?.duration)
      ? computeEndTimeFromStartAndDuration(newProgram.startTime, newProgram.duration || editingProgram?.duration || 0)
      : (newProgram.endTime || '');
    const mapped = programs.map(p =>
      p.id === editingProgram.id
        ? {
            ...p,
            title: newProgram.title,
            description: newProgram.description || '',
            streamUrl: isPlayableStreamUrl(newProgram.streamUrl) ? newProgram.streamUrl : (p.streamUrl || ''),
            duration: newProgram.duration ?? p.duration,
            fileName: newProgram.videoFile ? newProgram.videoFile.name : p.fileName,
            fileSize: newProgram.videoFile ? newProgram.videoFile.size : p.fileSize,
            category: newProgram.category || '',
            startTime: newProgram.startTime || '',
            endTime: endTime || newProgram.endTime || '',
            daysOfWeek: newProgram.daysOfWeek || [],
            isRepeating: newProgram.isRepeating || false,
            isActive: newProgram.isActive !== undefined ? newProgram.isActive : true,
            order: newProgram.order !== undefined ? newProgram.order : p.order,
            tags: newProgram.tags || []
          }
        : p
    );
    const updatedPrograms = recalcProgramTimes(mapped);
    setPrograms(updatedPrograms);

    if (selectedChannelForProgram) {
      const updatedChannels = channels.map(c => 
        c._id === selectedChannelForProgram._id 
          ? { ...c, programs: updatedPrograms }
          : c
      );
      setChannels(updatedChannels);
      try {
        await apiService.updateWebTVChannel(selectedChannelForProgram._id, { ...selectedChannelForProgram, programs: updatedPrograms });
      } catch (err) {
        console.error('Erreur sauvegarde programmes:', err);
        toast.error(err.response?.data?.message || 'Les modifications n\'ont pas été enregistrées.');
      }
    }

    setEditingProgram(null);
    setNewProgram({
      title: '',
      description: '',
      videoFile: null,
      videoPreview: null,
      streamUrl: '',
      duration: 0,
      uploadDate: '',
      category: '',
      startTime: '',
      endTime: '',
      daysOfWeek: [],
      isRepeating: false,
      isActive: true,
      order: 0,
      tags: []
    });
    setNewTag('');

    toast.success('Programme modifié avec succès');
  };

  const handleDeleteProgram = async (programId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce programme ?')) {
      return;
    }

    const idToRemove = programId != null ? String(programId) : '';
    const afterFilter = programs.filter(p => getProgramId(p) !== idToRemove);
    const updatedPrograms = recalcProgramTimes(afterFilter);

    setPrograms(updatedPrograms);

    if (selectedChannelForProgram) {
      const updatedChannels = channels.map(c =>
        c._id === selectedChannelForProgram._id
          ? { ...c, programs: updatedPrograms }
          : c
      );
      setChannels(updatedChannels);
      try {
        await apiService.updateWebTVChannel(selectedChannelForProgram._id, { ...selectedChannelForProgram, programs: updatedPrograms });
      } catch (err) {
        console.error('Erreur sauvegarde programmes:', err);
        toast.error(err.response?.data?.message || 'La suppression n\'a pas été enregistrée.');
      }
    }

    toast.success('Programme supprimé avec succès');
  };

  const toggleDayOfWeek = (day) => {
    const updatedDays = newProgram.daysOfWeek.includes(day)
      ? newProgram.daysOfWeek.filter(d => d !== day)
      : [...newProgram.daysOfWeek, day];
    setNewProgram({ ...newProgram, daysOfWeek: updatedDays });
  };

  const handleRecalcProgramTimes = async () => {
    if (programs.length === 0) return;
    const updatedPrograms = recalcProgramTimes(programs);
    setPrograms(updatedPrograms);
    if (selectedChannelForProgram) {
      const updatedChannels = channels.map(c =>
        c._id === selectedChannelForProgram._id ? { ...c, programs: updatedPrograms } : c
      );
      setChannels(updatedChannels);
      try {
        await apiService.updateWebTVChannel(selectedChannelForProgram._id, { ...selectedChannelForProgram, programs: updatedPrograms });
        toast.success('Heures recalculées : premier programme à 00:00, les suivants enchaînent.');
      } catch (err) {
        console.error('Erreur recalc heures WebTV:', err);
        toast.error(err.response?.data?.message || 'Recalcul non enregistré.');
      }
    }
  };

  const addTag = () => {
    if (newTag.trim() && !newProgram.tags.includes(newTag.trim())) {
      setNewProgram({
        ...newProgram,
        tags: [...newProgram.tags, newTag.trim()]
      });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    setNewProgram({
      ...newProgram,
      tags: newProgram.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const playProgram = (program) => {
    if (getProgramId(playingProgram) === getProgramId(program)) {
      if (videoElement) {
        videoElement.pause();
        videoElement.currentTime = 0;
        setVideoElement(null);
      }
      setPlayingProgram(null);
    } else {
      if (videoElement) {
        videoElement.pause();
        videoElement.currentTime = 0;
      }
      
      if (program.streamUrl) {
        const video = document.createElement('video');
        video.src = program.streamUrl;
        video.preload = 'metadata';
        video.playsInline = true;
        video.controls = true;
        video.play().catch(err => {
          console.error('Erreur de lecture:', err);
          toast.error('Impossible de lire le fichier vidéo');
        });
        setVideoElement(video);
        
        video.addEventListener('ended', () => {
          setPlayingProgram(null);
          setVideoElement(null);
        });
      }
      
      setPlayingProgram(program);
      setProgramStats(prev => {
        const pid = getProgramId(program);
        return {
          ...prev,
          [pid]: {
            playCount: (prev[pid]?.playCount || program.playCount || 0) + 1,
            lastPlayed: new Date().toISOString()
          }
        };
      });
    }
  };

  useEffect(() => {
    return () => {
      if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
      }
    };
  }, [videoElement]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {dbConnected === false && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
          <AlertCircle className="shrink-0 text-amber-600" size={24} />
          <div>
            <p className="font-medium text-amber-900">Base de données indisponible</p>
            <p className="text-sm text-amber-800 mt-1">
              Impossible de créer ou modifier les chaînes WebTV. Démarrez MongoDB (ex: <code className="bg-amber-100 px-1 rounded">docker run -d -p 27017:27017 mongo</code>) puis redémarrez le backend. Vérifiez <code className="bg-amber-100 px-1 rounded">MONGODB_URI</code> dans <code className="bg-amber-100 px-1 rounded">backend/config.env</code>.
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('webtv.title')}</h1>
          <p className="text-gray-600 mt-2">{t('webtv.subtitle')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setSelectedChannel(null);
            setLogoFile(null);
            setLogoPreview(null);
            setActiveLang('fr');
            setNewChannel({
              name: '',
              category: '',
              description: '',
              streamUrl: '',
              logo: '',
              imageUrl: '',
              isLive: true,
              isActive: true,
              quality: 'HD',
              viewers: 0,
              schedule: [],
              countries: [],
              translations: emptyTranslations()
            });
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} />
          {t('webtv.addChannel')}
        </motion.button>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t('webtv.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {t('webtv.filterAll')}
          </button>
          <button
            onClick={() => setFilter('live')}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              filter === 'live' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            <Radio size={18} />
            {t('webtv.filterLive')}
          </button>
          <button
            onClick={() => setFilter('ondemand')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === 'ondemand' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {t('webtv.filterOnDemand')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('webtv.totalChannels')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{channels.length}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <Tv size={24} className="text-blue-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('webtv.activeChannels')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {channels.filter(c => c.isActive).length}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <Play size={24} className="text-green-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('webtv.liveCount')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {channels.filter(c => c.isLive).length}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100">
              <Radio size={24} className="text-red-600" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('webtv.totalViewers')}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {channels.reduce((sum, c) => sum + (c.viewers || 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <Users size={24} className="text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Channels List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('webtv.channelListTitle')}</h2>
          <div className="space-y-3">
            {filteredChannels.map((channel) => (
              <motion.div
                key={channel._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative">
                    <div className={`flex h-16 w-16 items-center justify-center rounded-xl overflow-hidden ${
                      channel.isActive ? 'bg-blue-100' : 'bg-gray-200'
                    }`}>
                      {channel.imageUrl ? (
                        <img 
                          src={channel.imageUrl} 
                          alt={channel.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Tv size={24} className={channel.isActive ? 'text-blue-600' : 'text-gray-400'} />
                      )}
                    </div>
                    {channel.isLive && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{channel.name}</h3>
                      {channel.isLive && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                          LIVE
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{channel.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-500">{getCategoryLabel(channel.category)}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">{channel.quality}</span>
                      <span className="text-xs text-gray-500">•</span>
                      <span className="text-xs text-gray-500">{channel.viewers?.toLocaleString()} {t('webtv.viewersLabel')}</span>
                      {channel.countries && channel.countries.length > 0 && (
                        <>
                          <span className="text-xs text-gray-500">•</span>
                          <div className="flex items-center gap-1">
                            {channel.countries.slice(0, 3).map((country, idx) => (
                              <span key={idx} className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                {country}
                              </span>
                            ))}
                            {channel.countries.length > 3 && (
                              <span className="text-xs text-gray-500">+{channel.countries.length - 3}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    channel.isActive 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {channel.isActive ? t('webtv.channelActive') : t('webtv.channelInactive')}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggleStatus(channel)}
                    className={`p-2 rounded-lg transition-colors ${
                      channel.isActive 
                        ? 'text-gray-600 hover:bg-gray-200' 
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                    title={channel.isActive ? t('webtv.deactivateChannel') : t('webtv.activateChannel')}
                  >
                    {channel.isActive ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <motion.button
                    onClick={() => {
                      setSelectedChannelForProgram(channel);
                      const progs = channel.programs || [];
                      setPrograms(progs);
                      const nextOrder = progs.length;
                      const nextStart = getStartTimeFromPreviousProgramFromList(progs, nextOrder) || '00:00';
                      setNewProgram({
                        title: '', description: '', videoFile: null, videoPreview: null, streamUrl: '', duration: 0,
                        uploadDate: '', category: '', startTime: nextStart, endTime: '', daysOfWeek: [], isRepeating: false,
                        isActive: true, order: nextOrder, tags: []
                      });
                      setEditingProgram(null);
                      setShowProgramModal(true);
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Programmation"
                  >
                    <Video size={18} />
                  </motion.button>
                  <button
                    onClick={() => {
                      setSelectedChannel(channel);
                      setEditingChannel({ ...channel, translations: channel.translations && typeof channel.translations === 'object' ? { ...emptyTranslations(), ...channel.translations } : emptyTranslations() });
                      setShowModal(true);
                    }}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(channel)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
            {filteredChannels.length === 0 && (
              <div className="text-center py-12">
                <Tv size={48} className="text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Aucune chaîne trouvée</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Ajouter / Modifier une chaîne — interface moderne */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200/80"
          >
            {/* En-tête */}
            <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600">
                  <Tv size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedChannel ? t('webtv.editChannel') : t('webtv.addChannel')}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedChannel ? t('webtv.modalSubtitleEdit') : t('webtv.modalSubtitleNew')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedChannel(null);
                  setEditingChannel(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Fermer"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Bloc Identité — modifiable en création et en édition */}
              <div className="rounded-xl bg-slate-50/80 p-4 space-y-4 border border-slate-100">
                <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-indigo-500" /> {t('webtv.channelIdentity')}
                </h3>
                {selectedChannel && editingChannel ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">{t('webtv.contentByLanguage')}</label>
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
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('webtv.channelNameRequired')}</label>
                          <input
                            type="text"
                            value={activeLang === 'fr' ? (editingChannel.name ?? '') : (editingChannel.translations?.[activeLang]?.name ?? '')}
                            onChange={(e) => activeLang === 'fr'
                              ? setEditingChannel({ ...editingChannel, name: e.target.value })
                              : setEditingChannel({
                                  ...editingChannel,
                                  translations: {
                                    ...editingChannel.translations,
                                    [activeLang]: { ...editingChannel.translations?.[activeLang], name: e.target.value }
                                  }
                                })}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                            placeholder="Ex. GNV News"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('webtv.description')}</label>
                          <textarea
                            value={activeLang === 'fr' ? (editingChannel.description ?? '') : (editingChannel.translations?.[activeLang]?.description ?? '')}
                            onChange={(e) => activeLang === 'fr'
                              ? setEditingChannel({ ...editingChannel, description: e.target.value })
                              : setEditingChannel({
                                  ...editingChannel,
                                  translations: {
                                    ...editingChannel.translations,
                                    [activeLang]: { ...editingChannel.translations?.[activeLang], description: e.target.value }
                                  }
                                })}
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none"
                            placeholder={t('webtv.descriptionPlaceholderShort')}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">{t('webtv.contentByLanguage')}</label>
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
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('webtv.channelNameRequired')}</label>
                          <input
                            type="text"
                            value={activeLang === 'fr' ? newChannel.name : (newChannel.translations?.[activeLang]?.name ?? '')}
                            onChange={(e) => activeLang === 'fr'
                              ? setNewChannel({ ...newChannel, name: e.target.value })
                              : setNewChannel({
                                  ...newChannel,
                                  translations: {
                                    ...newChannel.translations,
                                    [activeLang]: { ...newChannel.translations?.[activeLang], name: e.target.value }
                                  }
                                })}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                            placeholder="Ex. GNV News"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('webtv.description')}</label>
                          <textarea
                            value={activeLang === 'fr' ? newChannel.description : (newChannel.translations?.[activeLang]?.description ?? '')}
                            onChange={(e) => activeLang === 'fr'
                              ? setNewChannel({ ...newChannel, description: e.target.value })
                              : setNewChannel({
                                  ...newChannel,
                                  translations: {
                                    ...newChannel.translations,
                                    [activeLang]: { ...newChannel.translations?.[activeLang], description: e.target.value }
                                  }
                                })}
                            rows={3}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none"
                            placeholder={t('webtv.descriptionPlaceholderShort')}
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Bloc Technique */}
              <div className="rounded-xl bg-slate-50/80 p-4 space-y-4 border border-slate-100">
                <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-indigo-500" /> {t('webtv.broadcastSection')}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('webtv.categoryRequired')}</label>
                    <select
                      value={selectedChannel && editingChannel ? editingChannel.category : newChannel.category}
                      onChange={(e) => selectedChannel && editingChannel
                        ? setEditingChannel({ ...editingChannel, category: e.target.value })
                        : setNewChannel({ ...newChannel, category: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    >
                      <option value="">{t('webtv.selectPlaceholder')}</option>
                      <option value="actualites">Actualités</option>
                      <option value="sport">Sport</option>
                      <option value="divertissement">Divertissement</option>
                      <option value="enfants">Enfants</option>
                      <option value="musique">Musique</option>
                      <option value="documentaire">Documentaire</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('webtv.quality')}</label>
                    <select
                      value={selectedChannel && editingChannel ? editingChannel.quality : newChannel.quality}
                      onChange={(e) => selectedChannel && editingChannel
                        ? setEditingChannel({ ...editingChannel, quality: e.target.value })
                        : setNewChannel({ ...newChannel, quality: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    >
                      <option value="SD">SD</option>
                      <option value="HD">HD</option>
                      <option value="FHD">FHD</option>
                      <option value="4K">4K</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('webtv.streamUrlRequired')}</label>
                  <input
                    type="url"
                    value={selectedChannel && editingChannel ? editingChannel.streamUrl : newChannel.streamUrl}
                    onChange={(e) => selectedChannel && editingChannel
                      ? setEditingChannel({ ...editingChannel, streamUrl: e.target.value })
                      : setNewChannel({ ...newChannel, streamUrl: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 font-mono text-sm"
                    placeholder="https://example.com/stream.m3u8"
                  />
                </div>
              </div>

              {/* Logo (création uniquement) */}
              {!selectedChannel && (
                <div className="rounded-xl bg-slate-50/80 p-4 space-y-4 border border-slate-100">
                  <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <span className="w-1 h-4 rounded-full bg-indigo-500" /> {t('webtv.logoSection')}
                  </h3>
                  {logoPreview ? (
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-200">
                      <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{logoFile?.name || 'Logo'}</p>
                        <p className="text-xs text-slate-500">{logoFile ? `${(logoFile.size / 1024).toFixed(1)} KB` : '—'}</p>
                      </div>
                      <button type="button" onClick={removeLogo} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30 cursor-pointer transition-colors">
                      <Upload size={28} className="text-slate-400 mb-2" />
                      <span className="text-sm font-medium text-slate-600">{t('webtv.dragImageOrClick')}</span>
                      <span className="text-xs text-slate-400 mt-0.5">PNG, JPG, GIF · max 5 Mo</span>
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  )}
                </div>
              )}

              {/* Pays (création uniquement) */}
              {!selectedChannel && (
                <div className="rounded-xl bg-slate-50/80 p-4 space-y-3 border border-slate-100">
                  <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <MapPin size={16} className="text-indigo-500" /> Affecter aux pays *
                  </h3>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 max-h-44 overflow-y-auto">
                    {availableCountries.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-4">Aucun pays disponible</p>
                    ) : (
                      <div className="space-y-1">
                        {availableCountries.map((country) => (
                          <label
                            key={country.code}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={newChannel.countries.includes(country.name)}
                              onChange={() => toggleCountry(country.name)}
                              className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                            />
                            <span className="font-medium text-slate-800">{country.name}</span>
                            <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{country.code}</span>
                            {newChannel.countries.includes(country.name) && <CheckCircle size={16} className="text-indigo-500 ml-auto" />}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {newChannel.countries.length > 0 && (
                    <p className="text-xs text-slate-500">{newChannel.countries.length} pays sélectionné(s)</p>
                  )}
                </div>
              )}

              {/* Options */}
              <div className="rounded-xl bg-slate-50/80 p-4 border border-slate-100">
                <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-indigo-500" /> Options
                </h3>
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      id="isLive"
                      checked={selectedChannel && editingChannel ? editingChannel.isLive : newChannel.isLive}
                      onChange={(e) => selectedChannel && editingChannel
                        ? setEditingChannel({ ...editingChannel, isLive: e.target.checked })
                        : setNewChannel({ ...newChannel, isLive: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <Radio size={18} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">En direct</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={selectedChannel && editingChannel ? (editingChannel.isActive !== false) : newChannel.isActive}
                      onChange={(e) => selectedChannel && editingChannel
                        ? setEditingChannel({ ...editingChannel, isActive: e.target.checked })
                        : setNewChannel({ ...newChannel, isActive: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                    />
                    <CheckCircle size={18} className="text-slate-500" />
                    <span className="text-sm font-medium text-slate-700">{t('webtv.channelActiveLabel')}</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Pied de modal */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedChannel(null);
                  setEditingChannel(null);
                  setLogoFile(null);
                  setLogoPreview(null);
                }}
                className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-white hover:border-slate-300 transition-colors"
              >
                {t('common.cancel')}
              </button>
              {selectedChannel ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    if (!editingChannel) return;
                    try {
                      const { _id, ...payload } = editingChannel;
                      // Synchroniser translations.fr avec name/description et envoyer toutes les langues
                      const translations = { ...(payload.translations && typeof payload.translations === 'object' ? payload.translations : {}), fr: { name: payload.name ?? '', description: payload.description ?? '' } };
                      payload.translations = translations;
                      await apiService.updateWebTVChannel(selectedChannel._id, payload);
                      toast.success('Chaîne modifiée');
                      setShowModal(false);
                      setSelectedChannel(null);
                      setEditingChannel(null);
                      fetchChannels();
                    } catch (err) {
                      toast.error(err.response?.data?.message || 'Erreur lors de la modification');
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                >
                  <Save size={18} />
                  {t('common.save')}
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddChannel}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                >
                  <Save size={18} />
                  {t('webtv.addChannelButton')}
                </motion.button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Programmation */}
      {showProgramModal && selectedChannelForProgram && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
                    <Video size={24} className="text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{t('webtv.programming')} - {selectedChannelForProgram.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">{t('webtv.programmingSubtitle')}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {programs.length > 0 && (
                  <motion.button
                    type="button"
                    onClick={handleRecalcProgramTimes}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors flex items-center gap-2"
                    title="Réindexer les ordres et recalculer toutes les heures (1er à 00:00, puis enchaînement)"
                  >
                    <Clock size={18} />
                    {t('webtv.recalcHours')}
                  </motion.button>
                )}
                <button
                onClick={() => {
                  setShowProgramModal(false);
                  setSelectedChannelForProgram(null);
                  setEditingProgram(null);
                  setNewProgram({
                    title: '',
                    description: '',
                    videoFile: null,
                    videoPreview: null,
                    streamUrl: '',
                    duration: 0,
                    uploadDate: '',
                    category: '',
                    startTime: '',
                    endTime: '',
                    daysOfWeek: [],
                    isRepeating: false,
                    isActive: true,
                    order: 0,
                    tags: []
                  });
                  setNewTag('');
                  setPlayingProgram(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
              </div>
            </div>

            {/* Form Ajouter/Modifier Programme */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-br from-gray-50 to-purple-50">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {editingProgram ? (
                    <>
                      <Edit size={20} className="text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">Modifier le programme</h3>
                    </>
                  ) : (
                    <>
                      <Plus size={20} className="text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">{t('webtv.addProgramTitle')}</h3>
                    </>
                  )}
                </div>
                {editingProgram && (
                  <button
                    onClick={() => {
                      setEditingProgram(null);
                      setNewProgram({
                        title: '',
                        description: '',
                        videoFile: null,
                        videoPreview: null,
                        streamUrl: '',
                        duration: 0,
                        uploadDate: '',
                        category: '',
                        startTime: '',
                        endTime: '',
                        daysOfWeek: [],
                        isRepeating: false,
                        isActive: true,
                        order: 0,
                        tags: []
                      });
                      setNewTag('');
                    }}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                  >
                    <X size={16} />
                    {t('webtv.cancelEditLabel')}
                  </button>
                )}
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('webtv.programTitle')} *
                    </label>
                    <input
                      type="text"
                      value={newProgram.title}
                      onChange={(e) => setNewProgram({ ...newProgram, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('webtv.programTitlePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('webtv.category')}
                    </label>
                    <select
                      value={newProgram.category}
                      onChange={(e) => setNewProgram({ ...newProgram, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t('webtv.selectCategoryPlaceholder')}</option>
                      {programCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Durée
                    </label>
                    <input
                      type="text"
                      value={formatDuration(newProgram.duration)}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newProgram.description}
                    onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder={t('webtv.descriptionPlaceholder')}
                  />
                </div>
                {/* Planification horaire (même logique que Radio) */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={18} className="text-gray-600" />
                    <h4 className="font-semibold text-gray-900">{t('webtv.scheduleSection')}</h4>
                  </div>
                  <p className="text-xs text-gray-600 mb-3 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    {t('webtv.orderInstructionsLong')}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('webtv.startTimeAuto')} {newProgram.order >= 1 && <span className="text-gray-500 font-normal">(auto)</span>}
                      </label>
                      <input
                        type="time"
                        value={newProgram.startTime}
                        readOnly={newProgram.order >= 1}
                        onChange={(e) => {
                          if (newProgram.order >= 1) return;
                          const start = e.target.value;
                          setNewProgram(prev => {
                            const end = (webTVAutoCalcEndTime && prev.duration && start) ? computeEndTimeFromStartAndDuration(start, prev.duration) : prev.endTime;
                            return { ...prev, startTime: start, endTime: end };
                          });
                        }}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${newProgram.order >= 1 ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                        title={newProgram.order >= 1 ? t('radio.startTimeTitleAuto') : ''}
                      />
                      {newProgram.order >= 1 && (
                        <p className="text-xs text-gray-500 mt-0.5">{t('webtv.startTimeHintPrev')}</p>
                      )}
                      {newProgram.order === 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">{t('webtv.startTimeHintManual')}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('webtv.endTimeAuto')}</label>
                      <input
                        type="time"
                        value={newProgram.endTime}
                        onChange={(e) => !webTVAutoCalcEndTime && setNewProgram(prev => ({ ...prev, endTime: e.target.value }))}
                        readOnly={webTVAutoCalcEndTime}
                        className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${webTVAutoCalcEndTime ? 'bg-gray-100 text-gray-600' : ''}`}
                        title={webTVAutoCalcEndTime ? t('radio.endTimeTitleAuto') : ''}
                      />
                      <p className="text-xs text-gray-500 mt-0.5">{t('webtv.endTimeHint')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('webtv.orderLabel')}</label>
                      <input
                        type="number"
                        min={0}
                        value={newProgram.order}
                        onChange={(e) => {
                          const newOrder = Math.max(0, parseInt(e.target.value, 10) || 0);
                          const startFromPrev = newOrder >= 1 ? getStartTimeFromPreviousProgram(newOrder) : '';
                          setNewProgram(prev => {
                            const start = newOrder >= 1 ? startFromPrev : prev.startTime;
                            const end = (webTVAutoCalcEndTime && prev.duration && start) ? computeEndTimeFromStartAndDuration(start, prev.duration) : prev.endTime;
                            return { ...prev, order: newOrder, startTime: start, endTime: end };
                          });
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        title={t('radio.orderTitleHint')}
                      />
                      <p className="text-xs text-gray-500 mt-0.5">{t('webtv.orderHintFirst')}</p>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newProgram.isRepeating}
                          onChange={(e) => setNewProgram({ ...newProgram, isRepeating: e.target.checked })}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700 flex items-center gap-1">
                          <Repeat size={14} />
                          {t('webtv.repeatLabel')}
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-wrap mt-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={webTVAutoCalcEndTime}
                        onChange={(e) => setWebTVAutoCalcEndTime(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">{t('webtv.calcEndTimeLabel')}</span>
                    </label>
                  </div>
                  {newProgram.isRepeating && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t('radio.daysOfWeek')}
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map((day) => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleDayOfWeek(day.value)}
                            className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                              newProgram.daysOfWeek.includes(day.value)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {/* Tags */}
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('webtv.tagsSection')}
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('webtv.addTagPlaceholder')}
                    />
                    <button
                      type="button"
                      onClick={addTag}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  {newProgram.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {newProgram.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                        >
                          {tag}
                          <button
                            onClick={() => removeTag(tag)}
                            className="hover:text-blue-900"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {/* Statut */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="programActive"
                    checked={newProgram.isActive}
                    onChange={(e) => setNewProgram({ ...newProgram, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="programActive" className="text-sm font-medium text-gray-700">
                    {t('webtv.programActiveLabel')}
                  </label>
                </div>
                {/* Upload Vidéo */}
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center gap-2">
                      <FileVideo size={18} className="text-purple-600" />
                      {editingProgram ? t('webtv.videoFileOptional') : t('webtv.videoFileLabel')}
                    </span>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowVideoLibraryPicker(true)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2 text-sm"
                    >
                      <Video size={18} />
                      {t('webtv.chooseFromVideoLibrary')}
                    </motion.button>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 cursor-pointer">
                      <div className={`flex items-center gap-3 px-4 py-4 border-2 border-dashed rounded-lg transition-all ${
                        newProgram.videoFile 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-gray-300 bg-white hover:border-purple-500 hover:bg-purple-50'
                      }`}>
                        <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                          newProgram.videoFile ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          <FileVideo size={24} className={newProgram.videoFile ? 'text-green-600' : 'text-gray-400'} />
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${
                            newProgram.videoFile ? 'text-green-900' : 'text-gray-700'
                          }`}>
                            {newProgram.videoFile ? newProgram.videoFile.name : 'Cliquez pour sélectionner un fichier vidéo'}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {newProgram.videoFile ? (
                              <span className="flex items-center gap-2">
                                <span>{formatFileSize(newProgram.videoFile.size)}</span>
                                {newProgram.duration > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>{formatDuration(newProgram.duration)}</span>
                                  </>
                                )}
                              </span>
                            ) : (
                              'Formats acceptés: MP4, WebM, OGG, MOV • Taille max: 1000 Mo'
                            )}
                          </p>
                        </div>
                        <Upload size={20} className={newProgram.videoFile ? 'text-green-600' : 'text-gray-400'} />
                      </div>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        className="hidden"
                      />
                    </label>
                    {newProgram.videoPreview && (
                      <motion.button
                        onClick={removeVideo}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Supprimer le fichier"
                      >
                        <X size={20} />
                      </motion.button>
                    )}
                  </div>
                  {newProgram.videoPreview && (
                    <div className="mt-3 flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setVideoPlayerModal({ open: true, src: newProgram.videoPreview || newProgram.streamUrl, title: newProgram.title || 'Aperçu vidéo' })}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                      >
                        <Play size={18} />
                        Lire la vidéo
                      </button>
                      <span className="text-xs text-gray-500">
                        {newProgram.duration > 0 && `${Math.floor(newProgram.duration / 60)} min`}
                      </span>
                    </div>
                  )}
                  {newProgram.streamUrl && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-xs font-medium text-blue-900 mb-1 flex items-center gap-1">
                            <CheckCircle size={14} />
                            Lien de streaming généré
                          </p>
                          <p className="text-xs font-mono text-blue-700 break-all bg-white p-2 rounded border border-blue-200">
                            {newProgram.streamUrl}
                          </p>
                        </div>
                        <motion.button
                          onClick={() => {
                            navigator.clipboard.writeText(newProgram.streamUrl);
                            toast.success('Lien copié dans le presse-papiers');
                          }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="p-1 text-blue-600 hover:bg-blue-100 rounded ml-2"
                          title="Copier le lien"
                        >
                          <Copy size={16} />
                        </motion.button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  {editingProgram ? (
                    <>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setEditingProgram(null);
                          setNewProgram({
                            title: '',
                            description: '',
                            videoFile: null,
                            videoPreview: null,
                            streamUrl: '',
                            duration: 0,
                            uploadDate: '',
                            category: '',
                            startTime: '',
                            endTime: '',
                            daysOfWeek: [],
                            isRepeating: false,
                            isActive: true,
                            order: 0,
                            tags: []
                          });
                          setNewTag('');
                        }}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                      >
                        {t('common.cancel')}
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleUpdateProgram}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Save size={18} className="inline mr-2" />
                        Modifier
                      </motion.button>
                    </>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={handleAddProgram}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus size={18} className="inline mr-2" />
                      Ajouter le programme
                    </motion.button>
                  )}
                </div>
              </div>
            </div>

            {/* Statistiques de programmation */}
            <div className="px-6 py-4 bg-gradient-to-r from-purple-50 via-blue-50 to-purple-50 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <BarChart3 size={20} className="text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-900">Statistiques de programmation</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 border border-gray-200 text-center shadow-sm">
                  <p className="text-3xl font-bold text-gray-900">{programs.length}</p>
                  <p className="text-xs text-gray-600 mt-1 flex items-center justify-center gap-1">
                    <List size={12} />
                    Total programmes
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-200 text-center shadow-sm">
                  <p className="text-3xl font-bold text-green-600">{programs.filter(p => p.isActive).length}</p>
                  <p className="text-xs text-gray-600 mt-1 flex items-center justify-center gap-1">
                    <CheckCircle size={12} />
                    Actifs
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-blue-200 text-center shadow-sm">
                  <p className="text-3xl font-bold text-blue-600">
                    {formatDuration(programs.reduce((sum, p) => sum + (p.duration || 0), 0))}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 flex items-center justify-center gap-1">
                    <Clock size={12} />
                    Durée totale
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-purple-200 text-center shadow-sm">
                  <p className="text-3xl font-bold text-purple-600">
                    {Object.values(programStats).reduce((sum, stat) => sum + (stat.playCount || 0), 0) + 
                     programs.reduce((sum, p) => sum + (p.playCount || 0), 0)}
                  </p>
                  <p className="text-xs text-gray-600 mt-1 flex items-center justify-center gap-1">
                    <BarChart3 size={12} />
                    Vues totales
                  </p>
                </div>
              </div>
            </div>

            {/* Toggle Vue Liste/Calendrier */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      viewMode === 'list'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <List size={18} />
                    Liste
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                      viewMode === 'calendar'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Calendar size={18} />
                    Calendrier
                  </button>
                </div>
                {viewMode === 'calendar' && (
                  <button
                    onClick={goToToday}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Aujourd'hui
                  </button>
                )}
              </div>
            </div>

            {/* Vue Calendrier */}
            {viewMode === 'calendar' && (
              <div className="p-6">
                {/* Navigation du calendrier */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <motion.button
                      onClick={() => navigateMonth(-1)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronLeft size={20} className="text-gray-600" />
                    </motion.button>
                    <h3 className="text-xl font-bold text-gray-900 capitalize">
                      {formatMonthYear(currentDate)}
                    </h3>
                    <motion.button
                      onClick={() => navigateMonth(1)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronRight size={20} className="text-gray-600" />
                    </motion.button>
                  </div>
                  <div className="text-sm text-gray-600">
                    {programs.filter(p => p.isActive).length} {t('webtv.programsActiveCountLabel')}
                  </div>
                </div>

                {/* Grille du calendrier */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  {/* En-têtes des jours */}
                  <div className="grid grid-cols-7 border-b border-gray-200">
                    {daysOfWeek.map((day) => (
                      <div
                        key={day.value}
                        className="p-3 text-center text-sm font-semibold text-gray-700 bg-gray-50 border-r border-gray-200 last:border-r-0"
                      >
                        {day.short}
                      </div>
                    ))}
                  </div>

                  {/* Jours du mois */}
                  <div className="grid grid-cols-7">
                    {getDaysInMonth(currentDate).map((day, index) => {
                      const dayPrograms = getProgramsForDate(day.date);
                      const isSelected = selectedDate.toDateString() === day.date.toDateString();
                      
                      return (
                        <div
                          key={index}
                          onClick={() => setSelectedDate(day.date)}
                          className={`min-h-[120px] border-r border-b border-gray-200 p-2 cursor-pointer transition-colors ${
                            day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                          } ${
                            isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                          } ${
                            day.isToday ? 'bg-blue-50' : ''
                          } hover:bg-gray-50`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-sm font-medium ${
                              day.isCurrentMonth
                                ? day.isToday
                                  ? 'text-blue-600 font-bold'
                                  : 'text-gray-900'
                                : 'text-gray-400'
                            }`}>
                              {day.date.getDate()}
                            </span>
                            {dayPrograms.length > 0 && (
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                                {dayPrograms.length}
                              </span>
                            )}
                          </div>
                          <div className="space-y-1 max-h-[80px] overflow-y-auto">
                            {dayPrograms.slice(0, 3).map((program) => {
                              return (
                                <div
                                  key={getProgramId(program)}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditProgram(program);
                                  }}
                                  className="px-2 py-1 bg-purple-100 hover:bg-purple-200 rounded text-xs text-purple-900 font-medium cursor-pointer transition-colors"
                                  title={`${program.title} - ${program.startTime || ''} ${program.endTime ? `- ${program.endTime}` : ''}`}
                                >
                                  <div className="flex items-center gap-1">
                                    <Clock size={10} />
                                    <span className="truncate">{program.startTime || '00:00'}</span>
                                  </div>
                                  <div className="truncate font-semibold">{program.title}</div>
                                </div>
                              );
                            })}
                            {dayPrograms.length > 3 && (
                              <div className="text-xs text-gray-500 text-center py-1">
                                +{dayPrograms.length - 3} autre(s)
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vue détaillée du jour sélectionné */}
                {selectedDate && (
                  <div className="mt-6 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <CalendarIcon size={20} className="text-purple-600" />
                        <h3 className="text-lg font-semibold text-gray-900">
                          {t('webtv.programmingOf')} {selectedDate.toLocaleDateString('fr-FR', { 
                            weekday: 'long', 
                            day: 'numeric', 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </h3>
                      </div>
                      <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                        {getProgramsForDate(selectedDate).length} programme(s)
                      </span>
                    </div>

                    {/* Grille horaire */}
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {Array.from({ length: 24 }, (_, hour) => {
                        const timeSlotPrograms = getProgramsForTimeSlot(selectedDate, hour);
                        return (
                          <div key={hour} className="flex items-start gap-4 border-b border-gray-100 pb-2">
                            <div className="w-20 text-sm font-medium text-gray-600 flex-shrink-0">
                              {hour.toString().padStart(2, '0')}:00
                            </div>
                            <div className="flex-1 grid grid-cols-1 gap-2">
                              {timeSlotPrograms.length > 0 ? (
                                timeSlotPrograms.map((program) => {
                                  return (
                                    <motion.div
                                      key={getProgramId(program)}
                                      initial={{ opacity: 0, x: -10 }}
                                      animate={{ opacity: 1, x: 0 }}
                                      onClick={() => handleEditProgram(program)}
                                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                                        program.isActive
                                          ? 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-300'
                                          : 'bg-gray-50 border-gray-200 opacity-60'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold text-gray-900">{program.title}</h4>
                                            {program.category && (
                                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                                                {program.category}
                                              </span>
                                            )}
                                            {!program.isActive && (
                                              <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs">
                                                Inactif
                                              </span>
                                            )}
                                          </div>
                                          {program.description && (
                                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{program.description}</p>
                                          )}
                                          <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                              <Clock size={12} />
                                              {program.startTime || '00:00'} - {program.endTime || '00:00'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                              <FileVideo size={12} />
                                              {formatDuration(program.duration)}
                                            </span>
                                            {program.isRepeating && program.daysOfWeek && program.daysOfWeek.length > 0 && (
                                              <span className="flex items-center gap-1">
                                                <Repeat size={12} />
                                                Répété
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-4">
                                          <motion.button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              playProgram(program);
                                            }}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            className={`p-2 rounded-lg transition-colors ${
                                              playingProgram && getProgramId(playingProgram) === getProgramId(program)
                                                ? 'text-green-600 bg-green-50'
                                                : 'text-gray-600 hover:bg-gray-200'
                                            }`}
                                            title={playingProgram && getProgramId(playingProgram) === getProgramId(program) ? 'Arrêter' : 'Lire'}
                                          >
                                            {playingProgram && getProgramId(playingProgram) === getProgramId(program) ? <VolumeX size={16} /> : <Play size={16} />}
                                          </motion.button>
                                          <motion.button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEditProgram(program);
                                            }}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="Modifier"
                                          >
                                            <Edit size={16} />
                                          </motion.button>
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                })
                              ) : (
                                <div className="text-xs text-gray-400 py-2">Aucun programme programmé</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Vue Liste */}
            {viewMode === 'list' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <List size={20} className="text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                      Liste des programmes ({programs.length})
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <BarChart3 size={16} />
                    <span>{programs.filter(p => p.isActive).length} {t('webtv.activeCountShort')}</span>
                  </div>
                </div>
                {programs.length > 0 && (
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    <GripVertical size={14} /> {t('webtv.dragToReorder')}
                  </p>
                )}
                {programs.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Video size={48} className="text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Aucun programme ajouté</p>
                    <p className="text-sm text-gray-400 mt-1">Ajoutez votre premier programme vidéo ci-dessus</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...programs].sort((a, b) => (a.order || 0) - (b.order || 0)).map((program, index) => (
                      <motion.div
                        key={getProgramId(program)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setWebtvDragOverIndex(index);
                        }}
                        onDragLeave={() => setWebtvDragOverIndex(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setWebtvDragOverIndex(null);
                          const from = webtvDragSourceIndexRef.current;
                          const to = index;
                          if (from == null || from === to) return;
                          const sorted = [...programs].sort((a, b) => (a.order || 0) - (b.order || 0));
                          const [removed] = sorted.splice(from, 1);
                          sorted.splice(to, 0, removed);
                          const withOrder = sorted.map((p, i) => ({ ...p, order: i }));
                          const updatedPrograms = recalcProgramTimes(withOrder);
                          setPrograms(updatedPrograms);
                          if (selectedChannelForProgram) {
                            const updatedChannels = channels.map(c =>
                              c._id === selectedChannelForProgram._id ? { ...c, programs: updatedPrograms } : c
                            );
                            setChannels(updatedChannels);
                            apiService.updateWebTVChannel(selectedChannelForProgram._id, { ...selectedChannelForProgram, programs: updatedPrograms })
                              .catch((err) => {
                                console.error('Erreur sauvegarde ordre WebTV:', err);
                                toast.error(err.response?.data?.message || 'Ordre non enregistré.');
                              });
                          }
                          webtvDragSourceIndexRef.current = null;
                        }}
                        className={`p-4 rounded-lg transition-colors ${
                          webtvDragOverIndex === index
                            ? 'bg-purple-50 border-2 border-purple-300'
                            : program.isActive ? 'bg-gray-50 hover:bg-gray-100 border border-transparent' : 'bg-gray-100 opacity-60 border border-transparent'
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            draggable
                            onDragStart={(e) => {
                              webtvDragSourceIndexRef.current = index;
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', String(index));
                            }}
                            onDragEnd={() => {
                              setWebtvDragOverIndex(null);
                              webtvDragSourceIndexRef.current = null;
                            }}
                            className="flex flex-col items-center gap-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
                            title={t('webtv.dragToReorder')}
                          >
                            <div className="flex items-center gap-1">
                              <span className="text-sm font-medium text-gray-500 w-5">{index + 1}</span>
                              <GripVertical size={16} className="text-gray-400" />
                            </div>
                            <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                              program.isActive ? 'bg-purple-100' : 'bg-gray-200'
                            }`}>
                              {playingProgram && getProgramId(playingProgram) === getProgramId(program) ? (
                                <Volume2 size={24} className="text-purple-600 animate-pulse" />
                              ) : (
                                <FileVideo size={24} className={program.isActive ? 'text-purple-600' : 'text-gray-400'} />
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-gray-900">{program.title}</h4>
                                  {program.category && (
                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                                      {program.category}
                                    </span>
                                  )}
                                  {!program.isActive && (
                                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full text-xs">
                                      Inactif
                                    </span>
                                  )}
                                </div>
                                {program.description && (
                                  <p className="text-sm text-gray-600 mt-1">{program.description}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Clock size={14} />
                                    {formatDuration(program.duration)}
                                  </span>
                                  {(program.startTime || program.endTime) && (
                                    <span className="flex items-center gap-1">
                                      <Clock size={14} />
                                      {program.startTime || '—'} - {program.endTime || '—'}
                                    </span>
                                  )}
                                  {program.isRepeating && program.daysOfWeek && program.daysOfWeek.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Repeat size={14} />
                                      {program.daysOfWeek.map(d => daysOfWeek.find(dw => dw.value === Number(d) || dw.value === d)?.label).filter(Boolean).join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-4">
                                <motion.button
                                  onClick={() => playProgram(program)}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className={`p-2 rounded-lg transition-colors ${
                                    playingProgram && getProgramId(playingProgram) === getProgramId(program)
                                      ? 'text-green-600 bg-green-50'
                                      : 'text-gray-600 hover:bg-gray-200'
                                  }`}
                                  title={playingProgram && getProgramId(playingProgram) === getProgramId(program) ? 'Arrêter' : 'Lire'}
                                >
                                  {playingProgram && getProgramId(playingProgram) === getProgramId(program) ? <VolumeX size={18} /> : <Play size={18} />}
                                </motion.button>
                                <motion.button
                                  onClick={() => handleEditProgram(program)}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Modifier"
                                >
                                  <Edit size={18} />
                                </motion.button>
                                <motion.button
                                  onClick={() => handleDeleteProgram(getProgramId(program))}
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 size={18} />
                                </motion.button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Modal Choisir depuis la bibliothèque vidéo */}
      {showVideoLibraryPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Choisir une vidéo dans la bibliothèque média</h3>
              <button type="button" onClick={() => setShowVideoLibraryPicker(false)} className="p-2 hover:bg-gray-100 rounded-lg">
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
                    onClick={() => setShowVideoLibraryPicker(false)}
                    className="font-semibold text-purple-600 hover:text-purple-700 underline"
                  >
                    Bibliothèque média
                  </Link>
                  {' '}pour en ajouter.
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
                          {v.size != null && <span>{Math.round(v.size / 1024 / 1024 * 100) / 100} Mo</span>}
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

      <VideoPlayerModal
        open={videoPlayerModal.open}
        onClose={() => setVideoPlayerModal((prev) => ({ ...prev, open: false }))}
        src={videoPlayerModal.src}
        title={videoPlayerModal.title}
      />
    </div>
  );
};

export default WebTV;


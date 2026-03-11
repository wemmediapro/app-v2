import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FolderOpen, Plus, Edit, Trash2, 
  Search, Play, Pause, X, Save, Clock, List, BarChart3, Volume2, VolumeX, 
  Copy, CheckCircle, AlertCircle, GripVertical, Trash, Music, FileAudio,
  Calendar as CalendarIcon, Repeat, ArrowUp, ArrowDown, Clock as ClockIcon,
  History, Zap, Settings, MoreVertical, Image as ImageIcon, Upload
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { useLanguage } from '../contexts/LanguageContext';
import { LANG_LIST, emptyTranslations } from '../utils/i18n';
import toast from 'react-hot-toast';

const Radio = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  // Navigation
  const [showProgrammingView, setShowProgrammingView] = useState(false); // Afficher la vue programmation ou la liste des stations
  const [activeSection, setActiveSection] = useState('programs'); // 'programs', 'planning', 'breaks', 'daily-generation', 'history'
  const [schedulingExpanded, setSchedulingExpanded] = useState(true);
  
  // Stations
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState(null);
  const [showStationModal, setShowStationModal] = useState(false);
  const [editingStation, setEditingStation] = useState(null);
  const [activeLang, setActiveLang] = useState('fr');
  const [newStation, setNewStation] = useState({
    name: '',
    description: '',
    genre: '',
    streamUrl: '',
    logo: '',
    isActive: true,
    sourceType: 'playlist',
    playlistId: '',
    translations: emptyTranslations()
  });
  // Playlists locales (Bibliothèque MP3) pour diffusion 100% offline
  const [localPlaylists, setLocalPlaylists] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('playlists') || '[]');
    } catch {
      return [];
    }
  });
  
  // Programs
  const [programs, setPrograms] = useState([]);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [newProgram, setNewProgram] = useState({
    title: '',
    description: '',
    type: 'program',
    mp3File: null,
    streamUrl: '',
    duration: 0,
    startTime: '',
    endTime: '',
    daysOfWeek: [],
    isRepeating: false,
    isActive: true,
    tags: []
  });
  
  // Planning
  const [planningView, setPlanningView] = useState('week'); // 'day', 'week', 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.getFullYear(), today.getMonth(), diff);
    return monday;
  });
  const [timeSlots, setTimeSlots] = useState([]);
  const [showTimeSlotModal, setShowTimeSlotModal] = useState(false);
  const [newTimeSlot, setNewTimeSlot] = useState({
    title: '',
    date: '',
    startTime: '',
    duration: 15
  });
  
  // Breaks
  const [breaks, setBreaks] = useState([]);
  
  // Daily Generation
  const [dailyGeneration, setDailyGeneration] = useState({
    enabled: false,
    time: '00:00',
    template: null
  });
  
  // History
  const [history, setHistory] = useState([]);
  
  // Upload logo
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);

  // Programmation radio = même principe que WebTV (nom, heure début/fin, ordre, description, upload MP3 direct)
  const [showRadioProgramModal, setShowRadioProgramModal] = useState(false);
  const [stationForPrograms, setStationForPrograms] = useState(null);
  const [radioPrograms, setRadioPrograms] = useState([]);
  const [showLibraryPickerRadio, setShowLibraryPickerRadio] = useState(false);
  const [mediaLibraryAudio, setMediaLibraryAudio] = useState([]);
  const [mediaLibraryLoading, setMediaLibraryLoading] = useState(false);
  const [libraryPickLoadingPath, setLibraryPickLoadingPath] = useState(null); // path de l'item en cours de chargement durée
  const [libraryForRadio, setLibraryForRadio] = useState([]);
  const [radioNewProgram, setRadioNewProgram] = useState({
    title: '',
    description: '',
    artist: '',
    startTime: '',
    endTime: '',
    order: 0,
    type: 'music',
    mp3File: null,
    streamUrl: '',
    duration: 0,
    daysOfWeek: [],
    isRepeating: false,
    isActive: true
  });
  const [radioUploading, setRadioUploading] = useState(false);
  const [radioUploadProgress, setRadioUploadProgress] = useState(null); // 0-100 pendant l'upload, null sinon
  const [radioProgramViewMode, setRadioProgramViewMode] = useState('list'); // 'list' | 'calendar'
  const [radioCalendarDate, setRadioCalendarDate] = useState(() => new Date());
  const [radioSelectedDate, setRadioSelectedDate] = useState(() => new Date());
  const [radioAutoCalcEndTime, setRadioAutoCalcEndTime] = useState(true); // calculer heure fin = début + durée
  const [editingRadioProgramIndex, setEditingRadioProgramIndex] = useState(null); // index du programme en cours d'édition
  const [playingRadioProgramIndex, setPlayingRadioProgramIndex] = useState(null); // index du programme en lecture
  const [radioDragOverIndex, setRadioDragOverIndex] = useState(null); // index de la ligne survolée pendant un drag
  const radioPreviewAudioRef = useRef(null);
  const radioDragSourceIndexRef = useRef(null); // index de l'élément en cours de déplacement (souris)
  const daysOfWeekRadio = [
    { value: '0', label: 'Dim' }, { value: '1', label: 'Lun' }, { value: '2', label: 'Mar' },
    { value: '3', label: 'Mer' }, { value: '4', label: 'Jeu' }, { value: '5', label: 'Ven' }, { value: '6', label: 'Sam' }
  ];

  // Bibliothèque MP3
  const [mp3Library, setMp3Library] = useState(() => {
    const saved = localStorage.getItem('mp3Library');
    return saved ? JSON.parse(saved) : [];
  });

  const apiBaseUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
    : (import.meta.env.DEV ? 'http://localhost:3000' : (typeof window !== 'undefined' ? '' : ''));
  /** URL affichable pour le logo (toujours passer par l'origine API). Normalise les URLs complètes vers le path pour utiliser la base actuelle. */
  const logoUrl = (logo) => {
    if (!logo || typeof logo !== 'string') return null;
    let t = logo.trim();
    if (!t) return null;
    if (t.startsWith('file://')) {
      t = t.replace(/^file:\/\//, '');
      if (!t.startsWith('/')) t = `/${t}`;
    }
    if (t.startsWith('http://') || t.startsWith('https://')) {
      try {
        const u = new URL(t);
        const pathPart = u.pathname || '/';
        const base = apiBaseUrl.replace(/\/$/, '');
        return pathPart.startsWith('/') ? `${base}${pathPart}` : `${base}/${pathPart}`;
      } catch {
        return t;
      }
    }
    const path = t.startsWith('/') ? t : `/${t}`;
    const base = apiBaseUrl.replace(/\/$/, '');
    return `${base}${path}`;
  };

  useEffect(() => {
    localStorage.setItem('mp3Library', JSON.stringify(mp3Library));
  }, [mp3Library]);

  // Charger la bibliothèque média (audio) quand on ouvre le picker radio
  useEffect(() => {
    if (!showLibraryPickerRadio) return;
    setMediaLibraryLoading(true);
    apiService.getMediaLibrary()
      .then((res) => {
        const data = res?.data;
        if (data?.success && Array.isArray(data.media)) {
          const audioOnly = data.media.filter((m) => m.type === 'audio');
          setMediaLibraryAudio(audioOnly);
        } else {
          setMediaLibraryAudio([]);
        }
      })
      .catch(() => setMediaLibraryAudio([]))
      .finally(() => setMediaLibraryLoading(false));
  }, [showLibraryPickerRadio]);

  // Réinitialiser l'erreur d'affichage du logo quand le logo du formulaire change (nouveau logo ou ouverture du modal)
  useEffect(() => {
    if (!newStation.logo || !showStationModal) setLogoLoadError(false);
  }, [showStationModal, newStation.logo]);

  const [dbConnected, setDbConnected] = useState(null);

  useEffect(() => {
    fetchStations();
  }, []);

  useEffect(() => {
    apiService.healthCheck()
      .then((res) => setDbConnected(res.data?.mongodb === 'connected'))
      .catch(() => setDbConnected(false));
  }, []);

  // Rafraîchir les playlists locales à l'ouverture du modal station (au cas où elles viennent d'être créées dans Bibliothèque)
  useEffect(() => {
    if (showStationModal) {
      try {
        setLocalPlaylists(JSON.parse(localStorage.getItem('playlists') || '[]'));
      } catch {}
    }
  }, [showStationModal]);

  // Créer la playlist de démo au chargement si elle n'existe pas
  useEffect(() => {
    try {
      const raw = localStorage.getItem('playlists');
      const list = raw ? JSON.parse(raw) : [];
      if (list.some(p => p.id === 'playlist_demo')) return;
      const demo = {
        id: 'playlist_demo',
        name: 'Démo Radio',
        description: 'Playlist de démo pour diffusion 100% offline. Assignez-la à une station et ajoutez des programmes (upload MP3 direct).',
        files: [],
        color: '#7ED321',
        type: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const next = [...list, demo];
      localStorage.setItem('playlists', JSON.stringify(next));
      setLocalPlaylists(next);
    } catch {}
  }, []);

  const fetchStations = async () => {
    try {
      setLoading(true);
      const response = await apiService.getRadioStations('all=1');
      const data = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setStations(Array.isArray(data) ? data : []);
      if (data && data.length > 0) {
        setSelectedStation(data[0]);
      }
    } catch (error) {
      console.error('Error fetching radio stations:', error);
      const msg = error.response?.data?.message || error.message || t('radio.errorLoadStations');
      toast.error(msg);
      setStations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRadioStatus = async (station) => {
    const id = station.id || station._id;
    try {
      await apiService.updateRadioStation(id, { isActive: !station.isActive });
      toast.success(station.isActive ? t('radio.stationDeactivated') : t('radio.stationActivated'));
      setStations(prev => prev.map(s => (s.id || s._id) === id ? { ...s, isActive: !s.isActive } : s));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.errorUpdate'));
    }
  };

  const handleDeleteRadioStation = async (station) => {
    if (!window.confirm(t('radio.confirmDeleteStation', { name: station.name }))) return;
    const id = station.id || station._id;
    try {
      await apiService.deleteRadioStation(id);
      setStations(prev => prev.filter(s => (s.id || s._id) !== id));
      toast.success(t('radio.stationDeleted'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('common.errorUpdate'));
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetRadioNewProgram = () => {
    setRadioNewProgram({
      title: '', description: '', artist: '', startTime: '', endTime: '',
      order: radioPrograms.length,
      type: 'music', mp3File: null, streamUrl: '', duration: 0, fileName: '', daysOfWeek: [], isRepeating: false, isActive: true
    });
  };

  const getFullAudioUrl = (streamUrl) => {
    if (!streamUrl) return null;
    // URLs absolues : en dev réécrire /uploads vers l'origine pour passer par le proxy
    if (streamUrl.startsWith('http://') || streamUrl.startsWith('https://')) {
      if (import.meta.env.DEV && typeof window !== 'undefined') {
        try {
          const u = new URL(streamUrl);
          const pathname = u.pathname.replace(/\/+/g, '/');
          if (/^\/uploads\/audio\/.+/.test(pathname)) return `${window.location.origin}${pathname}`;
          if (/^\/audio\/.+/.test(pathname)) return `${window.location.origin}/uploads${pathname}`;
        } catch (_) {}
      }
      return streamUrl;
    }
    // Chemins relatifs : en production toujours utiliser l'origine de la page (évite lecture impossible sur la version hébergée)
    const path = streamUrl.startsWith('/') ? streamUrl : `/${streamUrl}`;
    const origin = (typeof window !== 'undefined' && window.location?.origin)
      ? window.location.origin
      : (apiBaseUrl ? apiBaseUrl.replace(/\/api\/?$/, '') : '');
    return `${origin.replace(/\/$/, '')}${path}`;
  };

  const togglePlayRadioProgram = (index) => {
    const prog = radioPrograms[index];
    const url = getFullAudioUrl(prog?.streamUrl);
    if (!url) {
      toast.error(t('radio.noAudioFile'));
      return;
    }
    const audio = radioPreviewAudioRef.current;
    if (!audio) return;
    if (playingRadioProgramIndex === index) {
      audio.pause();
      setPlayingRadioProgramIndex(null);
      return;
    }
    audio.src = url;
    audio.play().then(() => setPlayingRadioProgramIndex(index)).catch(() => {
      toast.error(t('radio.cannotPlayAudio'));
      setPlayingRadioProgramIndex(null);
    });
  };

  const stopRadioPreview = () => {
    if (radioPreviewAudioRef.current) {
      radioPreviewAudioRef.current.pause();
      radioPreviewAudioRef.current.src = '';
    }
    setPlayingRadioProgramIndex(null);
  };

  const toggleDayOfWeekRadio = (dayValue) => {
    setRadioNewProgram(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(dayValue)
        ? prev.daysOfWeek.filter(d => d !== dayValue)
        : [...prev.daysOfWeek, dayValue]
    }));
  };

  const handleAudioUploadRadio = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = /audio\/(mpeg|mp3|wav|ogg|webm|x-wav)/;
    if (!allowed.test(file.type) && !/\.(mp3|wav|ogg|m4a)$/i.test(file.name)) {
      toast.error(t('radio.selectAudioFile'));
      return;
    }
    if (file.size > 250 * 1024 * 1024) {
      toast.error(t('radio.fileTooLarge'));
      return;
    }
    setRadioNewProgram(prev => ({ ...prev, mp3File: file }));
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const dur = Math.round(audio.duration);
      setRadioNewProgram(prev => ({
        ...prev,
        duration: dur,
        endTime: (radioAutoCalcEndTime && prev.startTime && dur) ? computeEndTimeFromStartAndDuration(prev.startTime, dur) : prev.endTime
      }));
    };
    audio.src = URL.createObjectURL(file);
    setRadioUploading(true);
    setRadioUploadProgress(0);
    try {
      const result = await apiService.uploadAudio(file, (percent) => setRadioUploadProgress(percent));
      if (result?.success && result?.audio?.url) {
        setRadioNewProgram(prev => ({ ...prev, streamUrl: result.audio.url }));
        toast.success(t('radio.audioFileSaved'));
      }
    } catch (err) {
      toast.error(err.response?.data?.message || t('radio.uploadAudioError'));
      setRadioNewProgram(prev => ({ ...prev, mp3File: null }));
    } finally {
      setRadioUploading(false);
      setRadioUploadProgress(null);
    }
  };

  const removeAudioRadio = () => {
    setRadioNewProgram(prev => ({
      ...prev, mp3File: null, streamUrl: '', duration: 0, fileName: ''
    }));
  };

  /** Sélection d'un fichier depuis la bibliothèque média : récupère la durée (metadata ou API) pour activer le calcul auto de l'heure de fin. */
  const handleSelectFromLibraryRadio = (item) => {
    const streamUrlToUse = item.path || item.url || '';
    const applySelection = (durationSeconds) => {
      setRadioNewProgram(prev => ({
        ...prev,
        mp3File: null,
        streamUrl: streamUrlToUse,
        duration: durationSeconds || 0,
        fileName: item.name || '',
        endTime: radioAutoCalcEndTime && prev.startTime && durationSeconds
          ? computeEndTimeFromStartAndDuration(prev.startTime, durationSeconds)
          : prev.endTime
      }));
      setShowLibraryPickerRadio(false);
      setLibraryPickLoadingPath(null);
      toast.success(t('radio.audioFileSaved'));
    };

    if (item.duration != null && item.duration > 0) {
      applySelection(item.duration);
      return;
    }

    setLibraryPickLoadingPath(item.path || item.url);
    const audioUrl = item.url || (streamUrlToUse.startsWith('http') ? streamUrlToUse : `${apiBaseUrl}${streamUrlToUse.startsWith('/') ? '' : '/'}${streamUrlToUse}`);
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const dur = Math.round(audio.duration);
      applySelection(dur);
    };
    audio.onerror = () => {
      applySelection(0);
      toast(t('radio.durationNotAvailable'), { icon: 'ℹ️' });
    };
    audio.src = audioUrl;
  };

  const handleAddRadioProgram = async () => {
    if (!radioNewProgram.title?.trim()) {
      toast.error(t('radio.enterProgramTitle'));
      return;
    }
    if (!radioNewProgram.mp3File && !radioNewProgram.streamUrl) {
      toast.error(t('radio.addMp3OrLibrary'));
      return;
    }
    let streamUrl = radioNewProgram.streamUrl;
    let duration = radioNewProgram.duration;
    if (radioNewProgram.mp3File && !streamUrl) {
      if (radioUploading) {
        toast.error(t('radio.waitForUpload'));
      } else {
        toast.error(t('radio.uploadFailed'));
      }
      return;
    }
    const program = {
      id: `prog_${Date.now()}`,
      title: radioNewProgram.title.trim(),
      description: '',
      artist: radioNewProgram.artist || '',
      streamUrl: streamUrl || '',
      duration: duration || 0,
      order: radioPrograms.length,
      type: radioNewProgram.type || 'music',
      isActive: radioNewProgram.isActive !== false,
      startTime: radioNewProgram.startTime || '',
      endTime: radioAutoCalcEndTime && radioNewProgram.startTime && radioNewProgram.duration
        ? computeEndTimeFromStartAndDuration(radioNewProgram.startTime, radioNewProgram.duration)
        : (radioNewProgram.endTime || ''),
      daysOfWeek: radioNewProgram.daysOfWeek || [],
      isRepeating: radioNewProgram.isRepeating || false,
      fileName: radioNewProgram.fileName || radioNewProgram.mp3File?.name || ''
    };
    setRadioPrograms(prev => {
      const next = [...prev, program].map((p, i) => ({ ...p, order: i }));
      const nextStart = next.length >= 1 ? getProgramEndTime(next[next.length - 1]) : '';
      setRadioNewProgram({
        title: '', description: '', artist: '', startTime: nextStart, endTime: '', order: next.length,
        type: 'music', mp3File: null, streamUrl: '', duration: 0, fileName: '', daysOfWeek: [], isRepeating: false, isActive: true
      });
      return next;
    });
    setEditingRadioProgramIndex(null);
    toast.success(t('radio.programAdded'));
  };

  const handleEditRadioProgram = (index) => {
    const prog = radioPrograms[index];
    if (!prog) return;
    setEditingRadioProgramIndex(index);
    setRadioNewProgram({
      title: prog.title || '',
      description: prog.description || '',
      artist: prog.artist || '',
      startTime: prog.startTime || '',
      endTime: prog.endTime || '',
      order: index,
      type: prog.type || 'music',
      mp3File: null,
      streamUrl: prog.streamUrl || '',
      duration: prog.duration || 0,
      daysOfWeek: prog.daysOfWeek || [],
      isRepeating: prog.isRepeating || false,
      isActive: prog.isActive !== false,
      fileName: prog.fileName || ''
    });
  };

  const handleSaveEditRadioProgram = () => {
    if (editingRadioProgramIndex == null || editingRadioProgramIndex < 0 || editingRadioProgramIndex >= radioPrograms.length) return;
    if (!radioNewProgram.title?.trim()) {
      toast.error(t('radio.enterProgramTitle'));
      return;
    }
    const streamUrl = radioNewProgram.streamUrl || radioPrograms[editingRadioProgramIndex].streamUrl || '';
    if (!streamUrl) {
      toast.error(t('radio.programMustHaveAudio'));
      return;
    }
    const updated = {
      ...radioPrograms[editingRadioProgramIndex],
      title: radioNewProgram.title.trim(),
      description: radioNewProgram.description || '',
      artist: radioNewProgram.artist || '',
      streamUrl,
      duration: radioNewProgram.duration || 0,
      type: radioNewProgram.type || 'music',
      isActive: radioNewProgram.isActive !== false,
      startTime: radioNewProgram.startTime || '',
      endTime: radioAutoCalcEndTime && radioNewProgram.startTime && radioNewProgram.duration
        ? computeEndTimeFromStartAndDuration(radioNewProgram.startTime, radioNewProgram.duration)
        : (radioNewProgram.endTime || ''),
      daysOfWeek: radioNewProgram.daysOfWeek || [],
      isRepeating: radioNewProgram.isRepeating || false,
      fileName: radioNewProgram.fileName || ''
    };
    setRadioPrograms(prev => prev.map((p, i) => (i === editingRadioProgramIndex ? updated : p)).map((p, i) => ({ ...p, order: i })));
    resetRadioNewProgram();
    setEditingRadioProgramIndex(null);
    toast.success(t('radio.programUpdated'));
  };

  const formatTime = (time) => {
    if (!time) return '';
    return time;
  };

  const computeEndTimeFromStartAndDuration = (startTime, durationSeconds) => {
    if (!startTime || durationSeconds == null || durationSeconds <= 0) return '';
    const parts = startTime.trim().split(':').map(Number);
    const h = parts[0] || 0, m = parts[1] || 0, s = parts[2] || 0;
    let total = h * 3600 + m * 60 + s + Math.round(durationSeconds);
    const outH = Math.floor(total / 3600) % 24;
    const outM = Math.floor((total % 3600) / 60);
    return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}`;
  };

  /** Heure de fin d'un programme (endTime ou début + durée). Si seulement la durée est renseignée, on suppose début à 00:00. */
  const getProgramEndTime = (prog) => {
    if (!prog) return '';
    if (prog.endTime) return prog.endTime;
    const dur = prog.duration || 0;
    if (dur <= 0) return '';
    const start = prog.startTime && prog.startTime.trim() ? prog.startTime.trim() : '00:00';
    return computeEndTimeFromStartAndDuration(start, dur);
  };

  /** Heure de début pour le programme à l'ordre N : = heure de fin du programme précédent (ordre 0 = manuel, ordre ≥ 1 = auto). */
  const getStartTimeFromPreviousProgram = (order) => {
    if (order < 1) return '';
    const sorted = [...radioPrograms].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (sorted.length === 0) return '';
    const prevIndex = Math.min(order - 1, sorted.length - 1);
    return getProgramEndTime(sorted[prevIndex]);
  };

  // Calendrier programmation radio : programmes répétés par jour de la semaine
  const getProgramsForRadioDate = (date) => {
    const dayOfWeek = String(date.getDay());
    return radioPrograms.filter(p => {
      if (p.isActive === false) return false;
      if (!p.isRepeating || !Array.isArray(p.daysOfWeek) || p.daysOfWeek.length === 0) return false;
      // Accepter daysOfWeek en string ou number (API peut renvoyer l'un ou l'autre)
      const normalized = p.daysOfWeek.map(d => String(d));
      return normalized.includes(dayOfWeek);
    });
  };

  const getRadioCalendarDays = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Semaine début Lundi (0 = Lun, 6 = Dim) pour cohérence avec l'en-tête
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days = [];
    for (let i = 0; i < startOffset; i++) {
      const d = new Date(year, month, 1 - startOffset + i);
      days.push({ date: d, isCurrentMonth: false, isToday: false });
    }
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, isToday: d.toDateString() === today.toDateString() });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false, isToday: false });
    }
    return days;
  };

  const formatRadioMonthYear = (date) => {
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const radioCalendarDaysOfWeek = [{ short: 'Lun' }, { short: 'Mar' }, { short: 'Mer' }, { short: 'Jeu' }, { short: 'Ven' }, { short: 'Sam' }, { short: 'Dim' }];

  // Recalculer l'heure de fin dès que début ou durée change (sécurité en plus des onChange)
  useEffect(() => {
    if (!showRadioProgramModal) return;
    if (!radioAutoCalcEndTime) return;
    const start = (radioNewProgram.startTime || '').trim();
    const dur = radioNewProgram.duration || 0;
    if (!start || dur <= 0) return;
    const computed = computeEndTimeFromStartAndDuration(start, dur);
    if (!computed) return;
    setRadioNewProgram(prev => (prev.endTime === computed ? prev : { ...prev, endTime: computed }));
  }, [showRadioProgramModal, radioAutoCalcEndTime, radioNewProgram.startTime, radioNewProgram.duration, radioNewProgram.endTime]);

  const renderPrograms = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('radio.programsSection')}</h2>
            <p className="text-gray-600 mt-1">{t('radio.manageProgramsSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedStation && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={async () => {
                  const id = selectedStation.id || selectedStation._id;
                  // Vue "Programs" (sidebar) : envoi schedule pour cohérence. La source principale reste le modal Programmation (programs + schedule).
                  const schedule = programs.map((p, i) => ({
                    title: p.title || '',
                    description: p.description || '',
                    startTime: p.startTime || '',
                    endTime: p.endTime || '',
                    duration: p.duration || 0,
                    type: p.type || 'program',
                    streamUrl: p.streamUrl || '',
                    isActive: p.isActive !== false,
                    daysOfWeek: Array.isArray(p.daysOfWeek) ? p.daysOfWeek : [],
                    order: i
                  }));
                  try {
                    await apiService.updateRadioStation(id, { schedule });
                    setSelectedStation(prev => prev ? { ...prev, schedule } : null);
                    toast.success(t('radio.programmingSaved'));
                  } catch (err) {
                    toast.error(err.response?.data?.message || t('radio.errorSaving'));
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Save size={18} />
                Enregistrer la programmation
              </motion.button>
            )}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setEditingProgram(null);
                setNewProgram({
                  title: '',
                  description: '',
                  type: 'program',
                  mp3File: null,
                  streamUrl: '',
                  duration: 0,
                  startTime: '',
                  endTime: '',
                  daysOfWeek: [],
                  isRepeating: false,
                  isActive: true,
                  tags: []
                });
              setShowProgramModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Add Program
            </motion.button>
          </div>
        </div>

        {programs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Music size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-900 mb-2">{t('radio.noProgramsYet')}</p>
            <p className="text-gray-600 mb-4">{t('radio.createFirstProgram')}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowProgramModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Program
            </motion.button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Days</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {programs.map((program) => (
                    <tr key={program.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{program.title}</div>
                        {program.description && (
                          <div className="text-sm text-gray-500">{program.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          program.type === 'music' ? 'bg-green-100 text-green-800' :
                          program.type === 'ad' ? 'bg-amber-100 text-amber-800' :
                          program.type === 'jingle' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {program.type === 'music' ? 'Musique' : program.type === 'ad' ? 'Pub' : program.type === 'jingle' ? 'Jingle' : 'Programme'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {program.startTime} - {program.endTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {program.isRepeating && program.daysOfWeek.length > 0
                          ? program.daysOfWeek.join(', ')
                          : 'One-time'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDuration(program.duration)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          program.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {program.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingProgram(program);
                              setNewProgram(program);
                              setShowProgramModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setPrograms(prev => prev.filter(p => p.id !== program.id));
                              toast.success('Program deleted');
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const getWeekDays = () => {
    const days = [];
    const start = new Date(currentWeekStart);
    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
        slots.push({ time, displayTime });
      }
    }
    return slots;
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.getFullYear(), today.getMonth(), diff);
    setCurrentWeekStart(monday);
  };

  const formatWeekRange = () => {
    const start = new Date(currentWeekStart);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' });
    const startDay = start.getDate();
    const endDay = end.getDate();
    const year = start.getFullYear();
    
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  };

  const getTimeSlotsForDay = (date) => {
    return timeSlots.filter(slot => {
      if (!slot.date) return false;
      const slotDate = new Date(slot.date);
      return slotDate.toDateString() === date.toDateString();
    });
  };

  const getSlotPosition = (slot) => {
    const [hours, minutes] = slot.startTime.split(':').map(Number);
    const startMinutes = hours * 60 + minutes;
    const duration = slot.duration || 15; // en minutes
    const startPosition = ((startMinutes - 8 * 60) / 15) * 60; // 60px par créneau de 15min
    const height = (duration / 15) * 60;
    return { top: startPosition, height };
  };

  const getEndTime = (startTime, duration) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + duration;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const renderPlanning = () => {
    const weekDays = getWeekDays();
    const timeSlotsList = getTimeSlots();
    const today = new Date();
    const selectedDay = weekDays.find(day => 
      day.toDateString() === today.toDateString()
    ) || weekDays[3]; // Par défaut jeudi

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Planning</h2>
            <p className="text-gray-600 mt-1">Schedule the broadcast of your programs and playlists.</p>
          </div>
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowTimeSlotModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              <Plus size={18} />
              Add a time slot
            </motion.button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <MoreVertical size={20} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Week Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigateWeek('prev')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft size={20} className="text-gray-600" />
              </button>
              <div className="flex items-center gap-2">
                <CalendarIcon size={18} className="text-gray-600" />
                <span className="font-medium text-gray-900">{formatWeekRange()}</span>
              </div>
              <button
                onClick={() => navigateWeek('next')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight size={20} className="text-gray-600" />
              </button>
              <button
                onClick={goToToday}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                Today
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Days Header */}
              <div className="grid grid-cols-8 border-b border-gray-200">
                <div className="p-3 border-r border-gray-200 bg-gray-50"></div>
                {weekDays.map((day, index) => {
                  const isSelected = day.toDateString() === selectedDay.toDateString();
                  const dayName = day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                  const dayNumber = day.getDate();
                  const monthNumber = day.getMonth() + 1;
                  return (
                    <div
                      key={index}
                      className={`p-3 text-center border-r border-gray-200 last:border-r-0 ${
                        isSelected ? 'bg-red-600 text-white' : 'bg-white'
                      }`}
                    >
                      <div className={`text-xs font-medium ${isSelected ? 'text-white' : 'text-gray-500'}`}>
                        {dayName}
                      </div>
                      <div className={`text-sm font-semibold mt-1 ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {monthNumber}/{dayNumber}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time Slots Grid */}
              <div className="relative" style={{ height: '600px', overflowY: 'auto' }}>
                <div className="grid grid-cols-8">
                  {/* Time Column */}
                  <div className="border-r border-gray-200 bg-gray-50">
                    {timeSlotsList.map((slot, index) => (
                      <div
                        key={index}
                        className="h-[60px] border-b border-gray-100 flex items-start justify-end pr-2 pt-1"
                      >
                        <span className="text-xs text-gray-500">{slot.displayTime}</span>
                      </div>
                    ))}
                  </div>

                  {/* Days Columns */}
                  {weekDays.map((day, dayIndex) => {
                    const daySlots = getTimeSlotsForDay(day);
                    return (
                      <div
                        key={dayIndex}
                        className="border-r border-gray-200 last:border-r-0 relative"
                      >
                        {timeSlotsList.map((slot, slotIndex) => (
                          <div
                            key={slotIndex}
                            className="h-[60px] border-b border-gray-100 relative"
                          >
                            {daySlots.map((programSlot, programIndex) => {
                              const endTime = programSlot.endTime || getEndTime(programSlot.startTime, programSlot.duration || 15);
                              if (
                                slot.time >= programSlot.startTime &&
                                slot.time < endTime &&
                                slot.time === programSlot.startTime
                              ) {
                                const position = getSlotPosition(programSlot);
                                return (
                                  <div
                                    key={programIndex}
                                    className="absolute left-0 right-0 bg-red-600 rounded-r z-10"
                                    style={{
                                      top: `${position.top}px`,
                                      height: `${position.height}px`,
                                      minHeight: '30px'
                                    }}
                                  >
                                    <div className="w-2 h-2 bg-red-600 rounded-full absolute -left-1 top-1/2 -translate-y-1/2"></div>
                                    <div className="px-2 py-1 text-white text-xs font-medium truncate">
                                      {programSlot.title || 'Program'}
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            })}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tip/Guide */}
        <div className="fixed bottom-6 right-6 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg shadow-lg p-4 max-w-xs">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Let's get started together!</p>
            </div>
            <button className="text-white/80 hover:text-white">
              <ChevronUp size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderBreaks = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Breaks</h2>
            <p className="text-gray-600 mt-1">Gérez les pauses publicitaires</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {}}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Add Break
          </motion.button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center py-12">
            <ClockIcon size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-900 mb-2">No breaks configured</p>
            <p className="text-gray-600">Add breaks to schedule commercial slots</p>
          </div>
        </div>
      </div>
    );
  };

  const renderDailyGeneration = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Daily Generation</h2>
          <p className="text-gray-600 mt-1">Générez automatiquement la programmation quotidienne</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Automatic Daily Generation</h3>
                <p className="text-sm text-gray-600 mt-1">Enable automatic generation of daily programming</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={dailyGeneration.enabled}
                  onChange={(e) => setDailyGeneration({ ...dailyGeneration, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {dailyGeneration.enabled && (
              <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Generation Time</label>
                  <input
                    type="time"
                    value={dailyGeneration.time}
                    onChange={(e) => setDailyGeneration({ ...dailyGeneration, time: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                  <select
                    value={dailyGeneration.template || ''}
                    onChange={(e) => setDailyGeneration({ ...dailyGeneration, template: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select template...</option>
                    <option value="morning">Morning Template</option>
                    <option value="afternoon">Afternoon Template</option>
                    <option value="evening">Evening Template</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHistory = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">History</h2>
          <p className="text-gray-600 mt-1">Historique des programmations</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="text-center py-12">
            <History size={48} className="mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-900 mb-2">No history available</p>
            <p className="text-gray-600">Program history will appear here</p>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'programs':
        return renderPrograms();
      case 'planning':
        return renderPlanning();
      case 'breaks':
        return renderBreaks();
      case 'daily-generation':
        return renderDailyGeneration();
      case 'history':
        return renderHistory();
      default:
        return renderPrograms();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const renderStationsList = () => {
    return (
      <div className="space-y-6">
        {/* Alerte MongoDB déconnecté */}
        {dbConnected === false && (
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
            <AlertCircle className="shrink-0 text-blue-600" size={24} />
            <div>
              <p className="font-medium text-blue-900">Mode fichier (sans MongoDB)</p>
              <p className="text-sm text-blue-800 mt-1">
                Les stations sont enregistrées dans <code className="bg-blue-100 px-1 rounded">backend/data/radio.json</code>. Vous pouvez créer et modifier les stations normalement. Pour utiliser MongoDB (recommandé en production), démarrez MongoDB puis redémarrez le backend.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('radio.title')}</h1>
            <p className="text-gray-600 mt-2">{t('radio.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setEditingStation(null);
                setActiveLang('fr');
                setNewStation({
                  name: '',
                  description: '',
                  genre: '',
                  streamUrl: '',
                  logo: '',
                  isActive: true,
                  sourceType: 'playlist',
                  playlistId: '',
                  translations: emptyTranslations()
                });
                setShowStationModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              {t('radio.addStation')}
            </motion.button>
          </div>
        </div>

        {/* Stations List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('radio.columnStation')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('radio.columnGenre')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('radio.columnStatus')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('radio.columnListeners')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      {t('radio.noStations')}
                    </td>
                  </tr>
                ) : (
                  stations.map((station) => (
                    <tr key={station.id || station._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {logoUrl(station.logo) ? (
                            <>
                              <img
                                src={logoUrl(station.logo)}
                                alt={station.name}
                                className="w-12 h-12 rounded-xl object-cover border border-gray-200"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                  const fallback = e.target.nextElementSibling;
                                  if (fallback) fallback.classList.remove('hidden');
                                }}
                              />
                              <div className="hidden w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                                <Music size={22} className="text-white" />
                              </div>
                            </>
                          ) : station.logo ? (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl text-white">
                              {station.logo}
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                              <Music size={22} className="text-white" />
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{station.name}</div>
                            {station.description && (
                              <div className="text-sm text-gray-500">{station.description}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                          {station.genre || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            station.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {station.isActive ? t('common.active') : t('common.inactive')}
                          </span>
                          {station.playlistId && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                              {t('radio.playlistLocale')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {station.listeners ?? station.currentListeners ?? 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleToggleRadioStatus(station)}
                            className={`p-2 rounded-lg transition-colors ${
                              station.isActive ? 'text-gray-600 hover:bg-gray-200' : 'text-green-600 hover:bg-green-50'
                            }`}
                            title={station.isActive ? t('radio.deactivate') : t('radio.activate')}
                          >
                            {station.isActive ? <Pause size={16} /> : <Play size={16} />}
                          </button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setStationForPrograms(station);
                              const progs = (station.programs || []).map((p, i) => ({ ...p, id: p.id || `prog_${i}`, order: i }));
                              setRadioPrograms(progs);
                              setLibraryForRadio(mp3Library);
                              const newOrder = progs.length;
                              const startFromPrev = newOrder >= 1 ? getProgramEndTime(progs[newOrder - 1]) : '';
                              setRadioNewProgram({
                                title: '', description: '', artist: '', startTime: startFromPrev, endTime: '',
                                order: newOrder,
                                type: 'music', mp3File: null, streamUrl: '', duration: 0, fileName: '', daysOfWeek: [], isRepeating: false, isActive: true
                              });
                              setShowLibraryPickerRadio(false);
                              setShowRadioProgramModal(true);
                            }}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 text-sm font-medium"
                            title={t('radio.programming')}
                          >
                            <CalendarIcon size={16} />
                            {t('radio.programming')}
                          </motion.button>
                          <button
                            onClick={() => {
                              setEditingStation(station);
                              setActiveLang('fr');
                              setLogoLoadError(false);
                              setNewStation({
                                name: station.name || '',
                                description: station.description || '',
                                genre: station.genre || '',
                                streamUrl: '',
                                logo: station.logo || '',
                                isActive: station.isActive !== undefined ? station.isActive : true,
                                sourceType: 'playlist',
                                playlistId: station.playlistId || '',
                                translations: station.translations && typeof station.translations === 'object' ? { ...emptyTranslations(), ...station.translations } : emptyTranslations()
                              });
                              setShowStationModal(true);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t('common.edit')}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteRadioStation(station)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title={t('common.delete')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  if (!showProgrammingView) {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }
    return (
      <>
        <div className="space-y-6 p-6">
          {renderStationsList()}
        </div>
        
        {/* Modal Nouvelle station / Modifier — interface moderne */}
        {showStationModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200/80"
            >
              <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600">
                    <Music size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {editingStation ? t('radio.editStation') : t('radio.newStation')}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {editingStation ? t('radio.updateStationSubtitle') : t('radio.fillStationSubtitle')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowStationModal(false);
                    setEditingStation(null);
                    setLogoUploading(false);
                    setLogoLoadError(false);
                    setActiveLang('fr');
                    setNewStation({
                      name: '',
                      description: '',
                      genre: '',
                      streamUrl: '',
                      logo: '',
                      isActive: true,
                      sourceType: 'playlist',
                      playlistId: '',
                      translations: emptyTranslations()
                    });
                  }}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                  aria-label={t('common.close')}
                >
                  <X size={22} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.contentAddedByLanguage')}</label>
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
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('radio.stationName')} *</label>
                      <input
                        type="text"
                        value={activeLang === 'fr' ? newStation.name : (newStation.translations?.[activeLang]?.name ?? '')}
                        onChange={(e) => activeLang === 'fr'
                          ? setNewStation({ ...newStation, name: e.target.value })
                          : setNewStation({
                              ...newStation,
                              translations: {
                                ...newStation.translations,
                                [activeLang]: { ...newStation.translations?.[activeLang], name: e.target.value }
                              }
                            })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nom de la station..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('radio.description')}</label>
                      <textarea
                        value={activeLang === 'fr' ? newStation.description : (newStation.translations?.[activeLang]?.description ?? '')}
                        onChange={(e) => activeLang === 'fr'
                          ? setNewStation({ ...newStation, description: e.target.value })
                          : setNewStation({
                              ...newStation,
                              translations: {
                                ...newStation.translations,
                                [activeLang]: { ...newStation.translations?.[activeLang], description: e.target.value }
                              }
                            })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                        placeholder="Description de la station..."
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('radio.genre')}</label>
                  <input
                    type="text"
                    value={newStation.genre}
                    onChange={(e) => setNewStation({ ...newStation, genre: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Pop, Rock, Jazz..."
                  />
                </div>

                {/* Logo : aperçu + upload image uniquement */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Logo de la station</label>
                  <div className="flex flex-col sm:flex-row gap-4 items-start">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex-shrink-0 w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                        {newStation.logo && logoUrl(newStation.logo) ? (
                          <img
                            key={newStation.logo}
                            src={logoUrl(newStation.logo)}
                            alt="Logo"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              const fallback = e.target.nextElementSibling;
                              if (fallback) fallback.classList.remove('hidden');
                              setLogoLoadError(true);
                            }}
                            onLoad={() => setLogoLoadError(false)}
                          />
                        ) : null}
                        <div className={`flex flex-col items-center gap-1 text-gray-400 ${newStation.logo && logoUrl(newStation.logo) && !logoLoadError ? 'hidden w-0 h-0 overflow-hidden' : 'w-full h-full justify-center'}`}>
                          <ImageIcon size={28} />
                          <span className="text-xs">{logoLoadError ? 'Image introuvable' : 'Logo'}</span>
                        </div>
                      </div>
                      {newStation.logo && (
                        <button
                          type="button"
                          onClick={() => { setNewStation(prev => ({ ...prev, logo: '' })); setLogoLoadError(false); }}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Supprimer le logo
                        </button>
                      )}
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      <label className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer text-sm font-medium disabled:opacity-50 w-fit">
                        <Upload size={18} />
                        {logoUploading ? 'Envoi...' : 'Choisir une image'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          className="sr-only"
                          disabled={logoUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const MAX_SIZE = 5 * 1024 * 1024;
                            const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                            if (file.size > MAX_SIZE) {
                              toast.error('Fichier trop volumineux (max 5 Mo).');
                              e.target.value = '';
                              return;
                            }
                            if (!ALLOWED_TYPES.includes(file.type)) {
                              toast.error('Type non autorisé. Utilisez JPEG, PNG, GIF ou WebP.');
                              e.target.value = '';
                              return;
                            }
                            setLogoUploading(true);
                            try {
                              const data = await apiService.uploadImage(file);
                              let path = data?.image?.path;
                              const url = data?.image?.url || data?.image?.path || data?.url;
                              if (path || url) {
                                if (typeof path !== 'string' || !path.trim()) {
                                  if (typeof url === 'string' && url.startsWith('http')) {
                                    try {
                                      path = new URL(url).pathname || '';
                                    } catch {
                                      path = '';
                                    }
                                  } else if (typeof url === 'string' && url.startsWith('/')) {
                                    path = url;
                                  }
                                }
                                const toStore = (typeof path === 'string' && path.trim())
                                  ? path.trim()
                                  : (typeof url === 'string' && url.startsWith('http')
                                    ? url
                                    : `${apiBaseUrl}${(url || '').toString().startsWith('/') ? url : `/${url || ''}`}`);
                                setNewStation(prev => ({ ...prev, logo: toStore }));
                                setLogoLoadError(false);
                                toast.success('Logo enregistré');
                              } else {
                                toast.error('Réponse serveur invalide');
                              }
                            } catch (err) {
                              const msg = err.response?.data?.message || 'Erreur lors de l\'upload de l\'image.';
                              toast.error(msg);
                            } finally {
                              setLogoUploading(false);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                      <p className="text-xs text-gray-500">JPEG, PNG, GIF ou WebP — max 5 Mo</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="stationActive"
                    checked={newStation.isActive}
                    onChange={(e) => setNewStation({ ...newStation, isActive: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="stationActive" className="text-sm text-gray-700">
                    {t('radio.stationActive')}
                  </label>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    setShowStationModal(false);
                    setEditingStation(null);
                    setLogoUploading(false);
                    setLogoLoadError(false);
                    setActiveLang('fr');
                    setNewStation({
                      name: '',
                      description: '',
                      genre: '',
                      streamUrl: '',
                      logo: '',
                      isActive: true,
                      sourceType: 'playlist',
                      playlistId: '',
                      translations: emptyTranslations()
                    });
                  }}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-white hover:border-slate-300 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                    if (!newStation.name.trim()) {
                      toast.error(t('radio.enterStationName'));
                      return;
                    }
                    const translations = { fr: { name: newStation.name, description: newStation.description || '' } };
                    LANG_LIST.forEach(({ code }) => {
                      if (code === 'fr') return;
                      const tr = newStation.translations?.[code];
                      if (tr && (tr.name || tr.description)) {
                        translations[code] = { name: tr.name || '', description: tr.description || '' };
                      }
                    });
                    const payload = {
                      name: newStation.name,
                      description: newStation.description,
                      genre: newStation.genre,
                      logo: newStation.logo,
                      isActive: newStation.isActive,
                      streamUrl: '',
                      playlistId: newStation.playlistId,
                      translations
                    };
                    try {
                      if (editingStation) {
                        const id = editingStation.id || editingStation._id;
                        const { data } = await apiService.updateRadioStation(id, payload);
                        setStations(prev => prev.map(s => (s.id || s._id) === id ? { ...data, id: data.id || data._id } : s));
                        toast.success(t('radio.stationUpdated'));
                      } else {
                        const { data } = await apiService.createRadioStation(payload);
                        setStations(prev => [...prev, { ...data, id: data.id || data._id, listeners: 0 }]);
                        toast.success(t('radio.stationCreated'));
                      }
                      setShowStationModal(false);
                      setEditingStation(null);
                      setLogoUploading(false);
                      setLogoLoadError(false);
                      setActiveLang('fr');
                      setNewStation({ name: '', description: '', genre: '', streamUrl: '', logo: '', isActive: true, sourceType: 'playlist', playlistId: '', translations: emptyTranslations() });
                    } catch (err) {
                      toast.error(err.response?.data?.message || t('radio.errorSaveStation'));
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
                >
                  <Save size={18} />
                  {editingStation ? t('common.save') : t('radio.createStation')}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Programmation (même principe que WebTV : programmes en ordre, sauvegardés en base) */}
        {showRadioProgramModal && stationForPrograms && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <audio
              ref={radioPreviewAudioRef}
              onEnded={() => setPlayingRadioProgramIndex(null)}
              onPause={() => setPlayingRadioProgramIndex(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
                <h3 className="text-xl font-bold text-gray-900">{t('radio.programming')} — {stationForPrograms.name}</h3>
                <button onClick={() => { setShowRadioProgramModal(false); setStationForPrograms(null); setRadioPrograms([]); setShowLibraryPickerRadio(false); resetRadioNewProgram(); setEditingRadioProgramIndex(null); stopRadioPreview(); }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              {/* Overlay Choisir depuis la bibliothèque */}
              {showLibraryPickerRadio && (
                <div className="absolute inset-0 z-10 bg-white flex flex-col">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
                    <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                      <FolderOpen size={20} className="text-purple-600" />
                      {t('radio.chooseFromLibraryMedia')}
                    </h4>
                    <button type="button" onClick={() => setShowLibraryPickerRadio(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    {mediaLibraryLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent" />
                        <p className="text-gray-500">{t('radio.loadingMediaLibrary')}</p>
                      </div>
                    ) : mediaLibraryAudio.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500 mb-4">Aucun fichier audio dans la bibliothèque média.</p>
                        <p className="text-sm text-gray-600 mb-4">Uploadez des MP3 depuis la page Bibliothèque média (uploads/audio sur le serveur).</p>
                        <button
                          type="button"
                          onClick={() => { setShowLibraryPickerRadio(false); navigate('/bibliotheque'); }}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                        >
                          Ouvrir la bibliothèque média
                        </button>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {mediaLibraryAudio.map((item) => (
                          <li key={item.path || item.url} className="flex items-center justify-between gap-3 p-3 bg-gray-50 hover:bg-purple-50 rounded-lg border border-gray-200">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 truncate">{item.name || 'Sans titre'}</p>
                              <p className="text-xs text-gray-500">
                                {item.duration != null && item.duration > 0 ? formatDuration(item.duration) : ''}
                                {item.size != null && (item.duration == null || item.duration <= 0) ? `${(item.size / 1024).toFixed(1)} Ko` : ''}
                                {item.size != null && item.duration != null && item.duration > 0 ? ` · ${(item.size / 1024).toFixed(1)} Ko` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSelectFromLibraryRadio(item)}
                              disabled={!!libraryPickLoadingPath}
                              className="shrink-0 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-70 disabled:cursor-wait flex items-center gap-2"
                            >
                              {libraryPickLoadingPath === (item.path || item.url) ? (
                                <>
                                  <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                  Calcul durée…
                                </>
                              ) : (
                                'Sélectionner'
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              {/* Zone scrollable : formulaire + stats + liste/calendrier */}
              <div className="flex-1 min-h-0 overflow-y-auto flex flex-col relative">
              {/* Formulaire ajout programme (même logique que WebTV : nom, heure début/fin, ordre, description, upload MP3 direct) */}
              <div className="p-4 border-b border-gray-200 bg-gradient-to-br from-gray-50 to-purple-50 space-y-4 shrink-0">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Music size={18} className="text-purple-600" />
                  {t('radio.addProgramUploadLibrary')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('radio.titleRequired')}</label>
                    <input
                      type="text"
                      value={radioNewProgram.title}
                      onChange={(e) => setRadioNewProgram(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder={t('radio.placeholderTitle')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('radio.artist')}</label>
                    <input
                      type="text"
                      value={radioNewProgram.artist}
                      onChange={(e) => setRadioNewProgram(prev => ({ ...prev, artist: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder={t('radio.placeholderArtist')}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-600 mb-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  {t('radio.orderInstructions')}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {radioNewProgram.order >= 1 ? t('radio.startTimeAuto') : t('radio.startTime')}
                    </label>
                    <input
                      type="time"
                      value={radioNewProgram.startTime}
                      readOnly={radioNewProgram.order >= 1}
                      onChange={(e) => {
                        if (radioNewProgram.order >= 1) return;
                        const start = e.target.value;
                        setRadioNewProgram(prev => {
                          const end = (radioAutoCalcEndTime && prev.duration && start) ? computeEndTimeFromStartAndDuration(start, prev.duration) : prev.endTime;
                          return { ...prev, startTime: start, endTime: end };
                        });
                      }}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 ${radioNewProgram.order >= 1 ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''}`}
                      title={radioNewProgram.order >= 1 ? t('radio.startTimeTitleAuto') : ''}
                    />
                    {radioNewProgram.order >= 1 && (
                      <p className="text-xs text-gray-500 mt-0.5">{t('radio.startTimeHintPrev')}</p>
                    )}
                    {radioNewProgram.order === 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">{t('radio.startTimeHintManual')}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('radio.endTimeAuto')}</label>
                    <input
                      type="time"
                      value={radioNewProgram.endTime}
                      onChange={(e) => !radioAutoCalcEndTime && setRadioNewProgram(prev => ({ ...prev, endTime: e.target.value }))}
                      readOnly={radioAutoCalcEndTime}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 ${radioAutoCalcEndTime ? 'bg-gray-100 text-gray-600' : ''}`}
                      title={radioAutoCalcEndTime ? t('radio.endTimeTitleAuto') : ''}
                    />
                    <p className="text-xs text-gray-500 mt-0.5">{t('radio.endTimeHint')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('radio.orderLabel')}</label>
                    <input
                      type="number"
                      min={0}
                      value={radioNewProgram.order}
                      onChange={(e) => {
                        const newOrder = Math.max(0, parseInt(e.target.value, 10) || 0);
                        const startFromPrev = newOrder >= 1 ? getStartTimeFromPreviousProgram(newOrder) : '';
                        setRadioNewProgram(prev => {
                          const start = newOrder >= 1 ? startFromPrev : prev.startTime;
                          const end = (radioAutoCalcEndTime && prev.duration && start) ? computeEndTimeFromStartAndDuration(start, prev.duration) : prev.endTime;
                          return { ...prev, order: newOrder, startTime: start, endTime: end };
                        });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      title={t('radio.orderTitleHint')}
                    />
                    <p className="text-xs text-gray-500 mt-0.5">{t('radio.orderHint')}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('radio.typeLabel')}</label>
                    <select
                      value={radioNewProgram.type}
                      onChange={(e) => setRadioNewProgram(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="music">{t('radio.typeMusic')}</option>
                      <option value="ad">{t('radio.typeAd')}</option>
                      <option value="jingle">{t('radio.typeJingle')}</option>
                      <option value="program">{t('radio.typeProgram')}</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={radioAutoCalcEndTime}
                      onChange={(e) => setRadioAutoCalcEndTime(e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded"
                    />
                    <span className="text-sm text-gray-700">{t('radio.calcEndTime')}</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="radioProgRepeating"
                    checked={radioNewProgram.isRepeating}
                    onChange={(e) => setRadioNewProgram(prev => ({ ...prev, isRepeating: e.target.checked }))}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <label htmlFor="radioProgRepeating" className="text-sm text-gray-700">{t('radio.repeatDays')}</label>
                </div>
                {radioNewProgram.isRepeating && (
                  <div className="flex flex-wrap gap-2">
                    {daysOfWeekRadio.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDayOfWeekRadio(d.value)}
                        className={`px-2 py-1 rounded text-sm ${radioNewProgram.daysOfWeek.includes(d.value) ? 'bg-purple-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <span className="flex items-center gap-2"><FileAudio size={18} className="text-purple-600" /> {t('radio.mp3UploadOrLibrary')}</span>
                  </label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex-1 min-w-[200px] cursor-pointer">
                      <div className={`flex items-center gap-3 px-4 py-3 border-2 border-dashed rounded-lg ${radioNewProgram.mp3File || radioNewProgram.streamUrl ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-white hover:border-purple-400'}`}>
                        <FileAudio size={24} className={radioNewProgram.mp3File || radioNewProgram.streamUrl ? 'text-green-600' : 'text-gray-400'} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {radioNewProgram.mp3File?.name || radioNewProgram.fileName || (radioNewProgram.streamUrl ? t('radio.fileSaved') : t('radio.clickToChooseMp3'))}
                          </p>
                          {radioNewProgram.duration > 0 && <p className="text-xs text-gray-500">{formatDuration(radioNewProgram.duration)}</p>}
                        </div>
                        <Upload size={18} className="text-gray-500" />
                      </div>
                      <input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" onChange={handleAudioUploadRadio} className="hidden" disabled={radioUploading} />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowLibraryPickerRadio(true)}
                      className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-purple-300 rounded-lg bg-purple-50 hover:bg-purple-100 hover:border-purple-400 text-purple-700 font-medium text-sm transition-colors"
                    >
                      <FolderOpen size={20} />
                      {t('radio.chooseFromLibrary')}
                    </button>
                    {(radioNewProgram.mp3File || radioNewProgram.streamUrl) && (
                      <button type="button" onClick={removeAudioRadio} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title={t('radio.removeFile')}>
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                  {radioUploading && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs text-amber-700">
                        <span>{t('radio.uploadInProgress')}</span>
                        <span>{radioUploadProgress != null ? `${radioUploadProgress} %` : '…'}</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all duration-300 ease-out"
                          style={{ width: `${radioUploadProgress ?? 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <motion.button
                  type="button"
                  disabled={radioUploading || !radioNewProgram.title?.trim() || (editingRadioProgramIndex == null && !radioNewProgram.streamUrl && !radioNewProgram.mp3File)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={editingRadioProgramIndex != null ? handleSaveEditRadioProgram : handleAddRadioProgram}
                  className={`w-full py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${editingRadioProgramIndex != null ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-purple-600 text-white hover:bg-purple-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {editingRadioProgramIndex != null ? (
                    <>
                      <Save size={18} />
                      {t('common.saveChanges')}
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      {t('radio.addProgramButton')}
                    </>
                  )}
                </motion.button>
                {editingRadioProgramIndex != null && (
                  <button
                    type="button"
                    onClick={() => { setEditingRadioProgramIndex(null); resetRadioNewProgram(); }}
                    className="w-full py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    {t('radio.cancelEdit')}
                  </button>
                )}
              </div>
              {/* Statistiques de programmation */}
              <div className="px-4 py-3 bg-gradient-to-r from-purple-50 via-blue-50 to-purple-50 border-b border-gray-200">
                <div className="flex items-center gap-3 mb-3">
                  <BarChart3 size={18} className="text-purple-600" />
                  <h3 className="text-base font-semibold text-gray-900">{t('radio.programmingStats')}</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg p-3 border border-gray-200 text-center shadow-sm">
                    <p className="text-2xl font-bold text-gray-900">{radioPrograms.length}</p>
                    <p className="text-xs text-gray-600 mt-0.5 flex items-center justify-center gap-1">
                      <List size={12} />
                      {t('radio.statsTotal')}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-green-200 text-center shadow-sm">
                    <p className="text-2xl font-bold text-green-600">{radioPrograms.filter(p => p.isActive !== false).length}</p>
                    <p className="text-xs text-gray-600 mt-0.5 flex items-center justify-center gap-1">
                      <CheckCircle size={12} />
                      {t('radio.activePrograms')}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-blue-200 text-center shadow-sm">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatDuration(radioPrograms.reduce((sum, p) => sum + (p.duration || 0), 0))}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5 flex items-center justify-center gap-1">
                      <Clock size={12} />
                      {t('radio.totalDuration')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Toggle Liste / Calendrier */}
              <div className="px-4 py-2 border-b border-gray-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRadioProgramViewMode('list')}
                    className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
                      radioProgramViewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <List size={16} />
                    {t('radio.listView')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRadioProgramViewMode('calendar')}
                    className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
                      radioProgramViewMode === 'calendar' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Calendar size={16} />
                    {t('radio.calendarView')}
                  </button>
                </div>
                {radioProgramViewMode === 'calendar' && (
                  <button
                    type="button"
                    onClick={() => { const now = new Date(); setRadioCalendarDate(now); setRadioSelectedDate(now); }}
                    className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  >
                    {t('radio.today')}
                  </button>
                )}
              </div>

              {/* Vue Calendrier */}
              {radioProgramViewMode === 'calendar' && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setRadioCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ChevronLeft size={18} />
                      </button>
                      <span className="font-semibold text-gray-900 capitalize">{formatRadioMonthYear(radioCalendarDate)}</span>
                      <button type="button" onClick={() => setRadioCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1))} className="p-2 hover:bg-gray-100 rounded-lg">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                    <span className="text-sm text-gray-500">{radioPrograms.filter(p => p.isActive !== false).length} {t('radio.programsActiveCount')}</span>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm pt-1">
                    <div className="grid grid-cols-7 border-b border-gray-200 min-h-[2.5rem] shrink-0">
                      {radioCalendarDaysOfWeek.map((d) => (
                        <div key={d.short} className="min-h-[2.5rem] flex items-center justify-center py-2.5 text-xs font-semibold text-gray-600 bg-gray-50 border-r border-gray-200 last:border-r-0">{d.short}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {getRadioCalendarDays(radioCalendarDate).map((day, idx) => {
                        const dayProgs = getProgramsForRadioDate(day.date);
                        const isSelected = radioSelectedDate.toDateString() === day.date.toDateString();
                        return (
                          <div
                            key={day.date.toISOString()}
                            onClick={() => setRadioSelectedDate(day.date)}
                            className={`min-h-[80px] border-r border-b border-gray-200 p-1.5 cursor-pointer text-sm ${
                              day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                            } ${isSelected ? 'ring-2 ring-purple-500 bg-purple-50' : ''} ${day.isToday ? 'bg-blue-50' : ''} hover:bg-gray-50`}
                          >
                            <span className={day.isCurrentMonth ? (day.isToday ? 'text-blue-600 font-bold' : 'text-gray-900') : 'text-gray-400'}>{day.date.getDate()}</span>
                            {dayProgs.length > 0 && (
                              <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-semibold">{dayProgs.length}</span>
                            )}
                            <div className="mt-1 space-y-0.5 max-h-[52px] overflow-y-auto">
                              {dayProgs.slice(0, 2).map((p) => (
                                <div key={p.id} className="px-1 py-0.5 bg-purple-100 rounded text-xs truncate" title={p.title}>{p.title}</div>
                              ))}
                              {dayProgs.length > 2 && <div className="text-xs text-gray-500">+{dayProgs.length - 2}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {radioSelectedDate && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">
                        Programmes le {radioSelectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} (répétés)
                      </h4>
                      {getProgramsForRadioDate(radioSelectedDate).length === 0 ? (
                        <p className="text-sm text-gray-500">Aucun programme répété ce jour.</p>
                      ) : (
                        <ul className="space-y-2">
                          {getProgramsForRadioDate(radioSelectedDate).map((p) => (
                            <li key={p.id} className="flex items-center justify-between text-sm">
                              <span className="font-medium">{p.title}</span>
                              <span className="text-gray-500">{p.startTime || '—'} → {p.endTime || '—'}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Vue Liste + Liste des programmes (N) */}
              {radioProgramViewMode === 'list' && (
              <div className="flex flex-col">
                <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <List size={18} className="text-gray-600" />
                    <h3 className="text-base font-semibold text-gray-900">{t('radio.programList')} ({radioPrograms.length})</h3>
                  </div>
                  {radioPrograms.length > 0 && (
                    <span className="text-xs text-gray-500">{radioPrograms.filter(p => p.isActive !== false).length} {t('radio.activeCount')}</span>
                  )}
                </div>
                {radioPrograms.length > 0 && (
                  <p className="px-4 pt-2 text-xs text-gray-500 flex items-center gap-1">
                    <GripVertical size={14} /> {t('radio.dragToReorder')}
                  </p>
                )}
                <div className="p-4">
                {radioPrograms.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Music size={48} className="text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">Aucun programme</p>
                    <p className="text-sm text-gray-400 mt-1">Ajoutez des programmes via le formulaire (upload MP3 direct).</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {radioPrograms.map((prog, index) => (
                      <li
                        key={prog.id || index}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setRadioDragOverIndex(index);
                        }}
                        onDragLeave={() => setRadioDragOverIndex(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setRadioDragOverIndex(null);
                          const from = radioDragSourceIndexRef.current;
                          const to = index;
                          if (from == null || from === to) return;
                          const next = [...radioPrograms];
                          const [removed] = next.splice(from, 1);
                          next.splice(to, 0, removed);
                          setRadioPrograms(next.map((p, i) => ({ ...p, order: i })));
                          radioDragSourceIndexRef.current = null;
                        }}
                        className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                          radioDragOverIndex === index
                            ? 'bg-purple-50 border-purple-300 border-2'
                            : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div
                          draggable
                          onDragStart={(e) => {
                            radioDragSourceIndexRef.current = index;
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', String(index));
                          }}
                          onDragEnd={() => {
                            setRadioDragOverIndex(null);
                            radioDragSourceIndexRef.current = null;
                          }}
                          className="flex items-center gap-1 shrink-0 cursor-grab active:cursor-grabbing touch-none"
                          title={t('radio.dragToReorder')}
                        >
                          <span className="text-sm font-medium text-gray-500 w-6">{index + 1}</span>
                          <GripVertical size={16} className="text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{prog.title}</p>
                          {prog.artist && (
                            <p className="text-sm text-gray-500 truncate">{prog.artist}</p>
                          )}
                          {(prog.startTime || prog.endTime) && (
                            <p className="text-xs text-gray-400">{prog.startTime || '—'} → {prog.endTime || '—'}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{formatDuration(prog.duration)}</span>
                        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                          <button
                            type="button"
                            onClick={() => togglePlayRadioProgram(index)}
                            className="flex items-center gap-1 px-2 py-1.5 text-green-600 hover:bg-green-50 rounded text-sm font-medium"
                            title={playingRadioProgramIndex === index ? 'Pause' : 'Play'}
                          >
                            {playingRadioProgramIndex === index ? <Pause size={16} /> : <Play size={16} />}
                            <span className="hidden sm:inline">{playingRadioProgramIndex === index ? 'Pause' : 'Play'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditRadioProgram(index)}
                            className="flex items-center gap-1 px-2 py-1.5 text-blue-600 hover:bg-blue-50 rounded text-sm font-medium"
                            title={t('common.edit')}
                          >
                            <Edit size={16} />
                            <span className="hidden sm:inline">{t('common.edit')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRadioPrograms(prev => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, order: i })))}
                            className="flex items-center gap-1 px-2 py-1.5 text-red-500 hover:bg-red-50 rounded text-sm font-medium"
                            title={t('common.delete')}
                          >
                            <Trash2 size={16} />
                            <span className="hidden sm:inline">Supprimer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (index <= 0) return;
                              const next = [...radioPrograms];
                              [next[index - 1], next[index]] = [next[index], next[index - 1]];
                              setRadioPrograms(next.map((p, i) => ({ ...p, order: i })));
                            }}
                            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                            title={t('radio.moveUp')}
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (index >= radioPrograms.length - 1) return;
                              const next = [...radioPrograms];
                              [next[index], next[index + 1]] = [next[index + 1], next[index]];
                              setRadioPrograms(next.map((p, i) => ({ ...p, order: i })));
                            }}
                            className="p-1.5 text-gray-500 hover:bg-gray-200 rounded"
                            title={t('radio.moveDown')}
                          >
                            <ArrowDown size={16} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                </div>
              </div>
              )}
              </div>
              <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-3 shrink-0">
                <button
                  onClick={() => { setShowRadioProgramModal(false); setStationForPrograms(null); setRadioPrograms([]); setShowLibraryPickerRadio(false); setEditingRadioProgramIndex(null); stopRadioPreview(); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  {t('common.close')}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    const id = stationForPrograms.id || stationForPrograms._id;
                    // Validation minimale : chaque programme doit avoir un titre et une source audio
                    const withoutTitle = radioPrograms.find((p) => !(p.title || '').trim());
                    const withoutAudio = radioPrograms.find((p) => !(p.streamUrl || '').trim());
                    if (withoutTitle) {
                      toast.error(t('radio.enterProgramTitle'));
                      return;
                    }
                    if (withoutAudio) {
                      toast.error(t('radio.programMustHaveAudio'));
                      return;
                    }
                    const programsToSave = radioPrograms.map((p, i) => ({
                      id: p.id || `prog_${Date.now()}_${i}`,
                      title: (p.title || '').trim(),
                      description: p.description || '',
                      artist: p.artist || '',
                      streamUrl: p.streamUrl || '',
                      duration: p.duration || 0,
                      order: i,
                      type: p.type || 'music',
                      isActive: p.isActive !== false,
                      libraryId: p.libraryId || undefined,
                      startTime: p.startTime || '',
                      endTime: p.endTime || '',
                      daysOfWeek: Array.isArray(p.daysOfWeek) ? p.daysOfWeek : [],
                      isRepeating: p.isRepeating || false,
                      fileName: p.fileName || ''
                    }));
                    // Garder schedule synchronisé avec programs (format attendu par l'API / anciens consommateurs)
                    const schedule = programsToSave.map((p, i) => ({
                      title: p.title,
                      description: p.description,
                      startTime: p.startTime,
                      endTime: p.endTime,
                      duration: p.duration || 0,
                      type: p.type,
                      streamUrl: p.streamUrl,
                      isActive: p.isActive,
                      daysOfWeek: p.daysOfWeek,
                      order: i
                    }));
                    try {
                      await apiService.updateRadioStation(id, { programs: programsToSave, schedule });
                      setStations(prev => prev.map(s => (s.id || s._id) === id ? { ...s, programs: programsToSave, schedule } : s));
                      setShowRadioProgramModal(false);
                      setStationForPrograms(null);
                      setRadioPrograms([]);
                      setShowLibraryPickerRadio(false);
                      toast.success(t('radio.programmingSaved'));
                    } catch (err) {
                      toast.error(err.response?.data?.message || t('radio.errorSaveStation'));
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  <Save size={18} className="inline mr-2" />
                  {t('common.save')}
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={20} className="text-gray-600" />
              <h3 className="font-semibold text-gray-900">Scheduling</h3>
            </div>
            <button
              onClick={() => setSchedulingExpanded(!schedulingExpanded)}
              className="text-gray-400 hover:text-gray-600"
            >
              {schedulingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto">
          {schedulingExpanded && (
            <nav className="p-2 space-y-1">
              <button
                onClick={() => setActiveSection('programs')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === 'programs'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <List size={16} />
                <span>Programs</span>
              </button>
              <button
                onClick={() => setActiveSection('planning')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === 'planning'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <CalendarIcon size={16} />
                <span>Planning</span>
              </button>
              <button
                onClick={() => setActiveSection('breaks')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === 'breaks'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <ClockIcon size={16} />
                <span>Breaks</span>
              </button>
              <button
                onClick={() => setActiveSection('daily-generation')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === 'daily-generation'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Zap size={16} />
                <span>Daily generation</span>
              </button>
              <button
                onClick={() => setActiveSection('history')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSection === 'history'
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <History size={16} />
                <span>History</span>
              </button>
            </nav>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/library')}
            className="w-full flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            <FolderOpen size={16} />
            <span>Bibliothèque MP3</span>
          </motion.button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => setShowProgrammingView(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title={t('radio.backToList')}
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>
                <h1 className="text-3xl font-bold text-gray-900">{t('radio.programming')}</h1>
                {selectedStation && (
                  <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                    {logoUrl(selectedStation.logo) ? (
                      <img src={logoUrl(selectedStation.logo)} alt={selectedStation.name} className="w-12 h-12 rounded-xl object-cover border border-gray-200" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <Music size={24} className="text-white" />
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-gray-900">{selectedStation.name}</p>
                      <p className="text-sm text-gray-500">{selectedStation.genre || 'Web radio'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content based on active section */}
          {renderContent()}
        </div>
      </div>

      {/* Program Modal */}
      {showProgramModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingProgram ? t('radio.editProgram') : t('radio.addProgram')}
                </h3>
                <button
                  onClick={() => {
                    setShowProgramModal(false);
                    setEditingProgram(null);
                    setNewProgram({
                      title: '',
                      description: '',
                      type: 'program',
                      mp3File: null,
                      streamUrl: '',
                      duration: 0,
                      startTime: '',
                      endTime: '',
                      daysOfWeek: [],
                      isRepeating: false,
                      isActive: true,
                      tags: []
                    });
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                <input
                  type="text"
                  value={newProgram.title}
                  onChange={(e) => setNewProgram({ ...newProgram, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Program title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={newProgram.description}
                  onChange={(e) => setNewProgram({ ...newProgram, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Program description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={newProgram.type || 'program'}
                  onChange={(e) => setNewProgram({ ...newProgram, type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="program">Programme</option>
                  <option value="music">Musique</option>
                  <option value="ad">Pub / Publicité</option>
                  <option value="jingle">Jingle</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={newProgram.startTime}
                    onChange={(e) => setNewProgram({ ...newProgram, startTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Time</label>
                  <input
                    type="time"
                    value={newProgram.endTime}
                    onChange={(e) => setNewProgram({ ...newProgram, endTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="repeating"
                  checked={newProgram.isRepeating}
                  onChange={(e) => setNewProgram({ ...newProgram, isRepeating: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="repeating" className="text-sm text-gray-700">
                  Repeating program
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={newProgram.isActive}
                  onChange={(e) => setNewProgram({ ...newProgram, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="active" className="text-sm text-gray-700">
                  Active
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowProgramModal(false);
                  setEditingProgram(null);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (!newProgram.title.trim()) {
                    toast.error('Please enter a title');
                    return;
                  }
                  if (editingProgram) {
                    setPrograms(prev => prev.map(p => 
                      p.id === editingProgram.id ? { ...newProgram, id: editingProgram.id } : p
                    ));
                    toast.success('Program updated');
                  } else {
                    setPrograms(prev => [...prev, { ...newProgram, id: `program_${Date.now()}` }]);
                    toast.success('Program created');
                  }
                  setShowProgramModal(false);
                  setEditingProgram(null);
                  setNewProgram({
                    title: '',
                    description: '',
                    type: 'program',
                    mp3File: null,
                    streamUrl: '',
                    duration: 0,
                    startTime: '',
                    endTime: '',
                    daysOfWeek: [],
                    isRepeating: false,
                    isActive: true,
                    tags: []
                  });
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {editingProgram ? 'Update' : 'Create'}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Time Slot Modal */}
      {showTimeSlotModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-md w-full"
          >
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">Add a time slot</h3>
                <button
                  onClick={() => {
                    setShowTimeSlotModal(false);
                    setNewTimeSlot({
                      title: '',
                      date: '',
                      startTime: '',
                      duration: 15
                    });
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={newTimeSlot.title}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Program or playlist name..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={newTimeSlot.date}
                    onChange={(e) => setNewTimeSlot({ ...newTimeSlot, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Time</label>
                  <input
                    type="time"
                    value={newTimeSlot.startTime}
                    onChange={(e) => setNewTimeSlot({ ...newTimeSlot, startTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes)</label>
                <input
                  type="number"
                  value={newTimeSlot.duration}
                  onChange={(e) => setNewTimeSlot({ ...newTimeSlot, duration: parseInt(e.target.value) || 15 })}
                  min={15}
                  step={15}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowTimeSlotModal(false);
                  setNewTimeSlot({
                    title: '',
                    date: '',
                    startTime: '',
                    duration: 15
                  });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (!newTimeSlot.title.trim() || !newTimeSlot.date || !newTimeSlot.startTime) {
                    toast.error('Please fill all required fields');
                    return;
                  }
                  const endTime = getEndTime(newTimeSlot.startTime, newTimeSlot.duration);
                  const newSlot = {
                    id: `slot_${Date.now()}`,
                    title: newTimeSlot.title,
                    date: newTimeSlot.date,
                    startTime: newTimeSlot.startTime,
                    endTime: endTime,
                    duration: newTimeSlot.duration
                  };
                  setTimeSlots(prev => [...prev, newSlot]);
                  setShowTimeSlotModal(false);
                  setNewTimeSlot({
                    title: '',
                    date: '',
                    startTime: '',
                    duration: 15
                  });
                  toast.success('Time slot added');
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Add
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
};

export default Radio;

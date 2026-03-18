import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Video, Plus, Edit, Trash2, Search, Filter, Eye, EyeOff, Calendar, X, Upload, Library, FileVideo, Play, BarChart2 } from 'lucide-react';
import { apiService } from '../services/apiService';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { getVideoPreviewUrl } from '../utils/videoPreviewUrl';
import VideoPlayerModal from '../components/VideoPlayerModal';

const Ads = () => {
  const { t } = useLanguage();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAd, setSelectedAd] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showVideoLibraryPicker, setShowVideoLibraryPicker] = useState(false);
  const [mediaLibraryVideos, setMediaLibraryVideos] = useState([]);
  const [mediaLibraryLoading, setMediaLibraryLoading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoPlayerModal, setVideoPlayerModal] = useState({ open: false, src: '', title: '' });
  const [form, setForm] = useState({
    name: '',
    videoUrl: '',
    type: 'preroll',
    startDate: '',
    endDate: '',
    skipAfterPercent: 0,
    order: 0,
    active: true,
  });

  useEffect(() => {
    fetchAds();
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

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error(t('ads.selectVideo') || 'Sélectionnez un fichier vidéo');
      return;
    }
    if (file.size > 1000 * 1024 * 1024) {
      toast.error(t('ads.fileTooLarge') || 'Fichier trop volumineux (max 1000 Mo)');
      return;
    }
    e.target.value = '';
    try {
      setVideoUploading(true);
      setVideoUploadProgress(0);
      const result = await apiService.uploadVideo(file, (pct) => setVideoUploadProgress(pct));
      if (result?.success && result?.video?.url) {
        setForm((prev) => ({ ...prev, videoUrl: result.video.url }));
        toast.success(t('ads.videoUploadSuccess') || 'Vidéo envoyée avec succès');
      } else {
        throw new Error(result?.message || 'Échec de l\'upload');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || (t('ads.uploadError') || 'Erreur lors de l\'upload.');
      toast.error(msg);
    } finally {
      setVideoUploading(false);
      setVideoUploadProgress(0);
    }
  };

  const selectVideoFromLibrary = (video) => {
    const urlToStore = video.path || (typeof video.url === 'string' ? video.url : '');
    setForm((prev) => ({ ...prev, videoUrl: urlToStore }));
    setShowVideoLibraryPicker(false);
    toast.success(t('ads.videoFromLibrary') || 'Vidéo sélectionnée depuis la bibliothèque');
  };

  const clearVideo = () => setForm((prev) => ({ ...prev, videoUrl: '' }));

  const fetchAds = async () => {
    try {
      setLoading(true);
      const response = await apiService.getAds();
      setAds(response.data || []);
    } catch (error) {
      console.error('Error fetching ads:', error);
      toast.error(t('ads.errorLoad') || 'Erreur lors du chargement des pubs');
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (adId) => {
    try {
      const ad = ads.find((a) => a._id === adId);
      const newStatus = !ad.active;
      await apiService.put(`/ads/${adId}`, { active: newStatus });
      setAds(ads.map((a) => (a._id === adId ? { ...a, active: newStatus } : a)));
      toast.success(newStatus ? (t('ads.activated') || 'Pub activée') : (t('ads.deactivated') || 'Pub désactivée'));
    } catch (error) {
      toast.error(t('ads.errorUpdate') || 'Erreur lors de la mise à jour');
    }
  };

  const handleDelete = async (adId) => {
    if (!window.confirm(t('ads.confirmDelete') || 'Supprimer cette pub ?')) return;
    try {
      await apiService.delete(`/ads/${adId}`);
      setAds(ads.filter((a) => a._id !== adId));
      toast.success(t('ads.deleted') || 'Pub supprimée');
    } catch (error) {
      toast.error(t('ads.errorDelete') || 'Erreur lors de la suppression');
    }
  };

  const openCreate = () => {
    setSelectedAd(null);
    const now = new Date();
    const start = now.toISOString().slice(0, 16);
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
    setForm({
      name: '',
      videoUrl: '',
      type: 'preroll',
      startDate: start,
      endDate: end,
      skipAfterPercent: 0,
      triggerAtPercent: 50,
      order: 0,
      active: true,
    });
    setShowModal(true);
  };

  const openEdit = async (ad) => {
    setSelectedAd(ad);
    const startList = ad.startDate ? new Date(ad.startDate).toISOString().slice(0, 16) : '';
    const endList = ad.endDate ? new Date(ad.endDate).toISOString().slice(0, 16) : '';
    const rawSkipList = ad.skipAfterPercent;
    const skipValueList =
      (typeof rawSkipList === 'number' || (typeof rawSkipList === 'string' && rawSkipList !== ''))
        ? Math.min(100, Math.max(0, Number(rawSkipList)))
        : 0;
    const rawTrigger = ad.triggerAtPercent;
    const triggerValueList =
      rawTrigger !== undefined && rawTrigger !== null && !Number.isNaN(Number(rawTrigger))
        ? Math.min(100, Math.max(0, Number(rawTrigger)))
        : 50;
    setForm({
      name: ad.name || '',
      videoUrl: ad.videoUrl || '',
      type: ad.type || 'preroll',
      startDate: startList,
      endDate: endList,
      skipAfterPercent: skipValueList,
      triggerAtPercent: triggerValueList,
      order: ad.order ?? 0,
      active: ad.active !== false,
    });
    setShowModal(true);
    // Recharger la pub depuis l'API pour avoir skipAfterPercent et tous les champs à jour
    try {
      const response = await apiService.getAd(ad._id);
      const doc = response?.data ?? response;
      if (!doc) return;
      const start = doc.startDate ? new Date(doc.startDate).toISOString().slice(0, 16) : '';
      const end = doc.endDate ? new Date(doc.endDate).toISOString().slice(0, 16) : '';
      const rawSkip = doc.skipAfterPercent;
      const skipValue =
        (typeof rawSkip === 'number' || (typeof rawSkip === 'string' && String(rawSkip).trim() !== ''))
          ? Math.min(100, Math.max(0, Number(rawSkip)))
          : 0;
      const rawTrigger = doc.triggerAtPercent;
      const triggerValue =
        rawTrigger !== undefined && rawTrigger !== null && !Number.isNaN(Number(rawTrigger))
          ? Math.min(100, Math.max(0, Number(rawTrigger)))
          : (ad.triggerAtPercent !== undefined && ad.triggerAtPercent !== null && !Number.isNaN(Number(ad.triggerAtPercent))
            ? Math.min(100, Math.max(0, Number(ad.triggerAtPercent)))
            : 50);
      setForm({
        name: doc.name || '',
        videoUrl: doc.videoUrl || '',
        type: doc.type || 'preroll',
        startDate: start,
        endDate: end,
        skipAfterPercent: skipValue,
        triggerAtPercent: triggerValue,
        order: doc.order ?? 0,
        active: doc.active !== false,
      });
    } catch (err) {
      console.error('Error loading ad for edit:', err);
      toast.error(t('ads.errorLoad') || 'Erreur lors du chargement de la pub');
    }
  };

  const handleSubmit = async () => {
    if (!form.videoUrl?.trim()) {
      toast.error(t('ads.videoUrlRequired') || 'URL vidéo requise');
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error(t('ads.datesRequired') || 'Dates de début et fin requises');
      return;
    }
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      toast.error(t('ads.endAfterStart') || 'La date de fin doit être après la date de début');
      return;
    }
    try {
      const triggerNum = Number(form.triggerAtPercent);
      const payload = {
        name: form.name.trim(),
        videoUrl: form.videoUrl.trim(),
        type: form.type,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        skipAfterPercent: form.type === 'midroll' ? Math.min(100, Math.max(0, Number(form.skipAfterPercent) || 0)) : 0,
        triggerAtPercent:
          form.type === 'midroll'
            ? (Number.isNaN(triggerNum) ? 50 : Math.min(100, Math.max(0, triggerNum)))
            : 50,
        order: Number(form.order) || 0,
        active: form.active,
      };
      if (selectedAd) {
        await apiService.put(`/ads/${selectedAd._id}`, payload);
        toast.success(t('ads.updated') || 'Pub mise à jour');
      } else {
        await apiService.post('/ads', payload);
        toast.success(t('ads.created') || 'Pub créée');
      }
      fetchAds();
      setShowModal(false);
    } catch (error) {
      toast.error(error.response?.data?.message || (t('ads.errorSave') || 'Erreur lors de l\'enregistrement'));
    }
  };

  const filteredAds = useMemo(() => {
    return ads.filter((ad) => {
      const matchesSearch =
        !searchQuery ||
        (ad.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ad.videoUrl || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'all' || ad.type === typeFilter;
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' && ad.active) || (statusFilter === 'inactive' && !ad.active);
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [ads, searchQuery, typeFilter, statusFilter]);

  const activeCount = ads.filter((a) => a.active).length;
  const totalAdImpressions = useMemo(() => ads.reduce((acc, a) => acc + (Number(a.impressions) || 0), 0), [ads]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8 w-full">
      {/* En-tête compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">{t('ads.title') || 'Gestion des publicités'}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('ads.subtitle') || 'Pre-roll et mid-roll. Calendrier par date.'}</p>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={openCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors shrink-0"
        >
          <Plus size={18} />
          {t('ads.add') || 'Ajouter une pub'}
        </motion.button>
      </div>

      {/* Stats compactes */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Video size={18} className="text-slate-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">Total</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{ads.length}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50"><Eye size={18} className="text-emerald-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">Actives</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{activeCount}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><EyeOff size={18} className="text-slate-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">Inactives</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{ads.length - activeCount}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50"><Video size={18} className="text-amber-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">Impressions</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{totalAdImpressions.toLocaleString()}</p></div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('ads.search') || 'Rechercher...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-colors"
          />
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-1 gap-0.5 shrink-0">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3.5 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">{t('ads.allTypes') || 'Tous les types'}</option>
            <option value="preroll">Pre-roll</option>
            <option value="midroll">Mid-roll</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">{t('ads.allStatus') || 'Tous'}</option>
            <option value="active">Actives</option>
            <option value="inactive">Inactives</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredAds.map((ad) => (
          <motion.div
            key={ad._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-video bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <Video size={48} className="text-slate-400" />
              <div className="absolute top-2 left-2 flex gap-1">
                <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-semibold">
                  {ad.type === 'preroll' ? 'Pre-roll' : 'Mid-roll'}
                </span>
                {!ad.active && (
                  <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-semibold">Inactive</span>
                )}
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">{ad.name || 'Sans nom'}</h3>
              <p className="text-xs text-gray-500 truncate mb-2" title={ad.videoUrl}>
                {ad.videoUrl}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                <Calendar size={14} />
                <span>
                  {ad.startDate && new Date(ad.startDate).toLocaleDateString('fr-FR')} →{' '}
                  {ad.endDate && new Date(ad.endDate).toLocaleDateString('fr-FR')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-amber-600 mb-2">
                <BarChart2 size={14} />
                <span>{(ad.impressions ?? 0).toLocaleString()} affichages</span>
              </div>
              {(ad.type === 'midroll' && (ad.triggerAtPercent != null || (ad.skipAfterPercent != null && ad.skipAfterPercent > 0))) && (
                <p className="text-xs text-gray-500 mb-2">
                  {ad.triggerAtPercent != null && (
                    <span>{t('ads.triggerAtPercentLabel') || 'Afficher à'} : {Number(ad.triggerAtPercent)} %</span>
                  )}
                  {ad.triggerAtPercent != null && ad.skipAfterPercent != null && ad.skipAfterPercent > 0 && ' · '}
                  {ad.skipAfterPercent != null && ad.skipAfterPercent > 0 && (
                    <span>{t('ads.skipAfterPercentLabel') || 'Passer après'} : {Number(ad.skipAfterPercent)} %</span>
                  )}
                </p>
              )}
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button
                  onClick={() => handleToggleStatus(ad._id)}
                  className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg text-xs ${
                    ad.active ? 'text-orange-600 hover:bg-orange-50' : 'text-green-600 hover:bg-green-50'
                  }`}
                >
                  {ad.active ? <EyeOff size={16} /> : <Eye size={16} />}
                  {ad.active ? 'Désactiver' : 'Activer'}
                </button>
                <button
                  onClick={() => openEdit(ad)}
                  className="flex-1 flex items-center justify-center gap-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg text-xs"
                >
                  <Edit size={16} />
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(ad._id)}
                  className="flex-1 flex items-center justify-center gap-2 p-2 text-red-600 hover:bg-red-50 rounded-lg text-xs"
                >
                  <Trash2 size={16} />
                  Supprimer
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {filteredAds.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Video size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('ads.noAds') || 'Aucune pub'}</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedAd ? (t('ads.edit') || 'Modifier la pub') : (t('ads.add') || 'Ajouter une pub')}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label={t('common.close')}
              >
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom (optionnel)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  placeholder="Ex: Pub partenaire mars"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('ads.videoLabel') || 'Vidéo (MP4 ou HLS)'} *
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowVideoLibraryPicker(true)}
                    disabled={videoUploading}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center gap-2 text-sm disabled:opacity-60"
                  >
                    <Video size={18} />
                    {t('ads.chooseFromLibrary') || 'Choisir depuis la bibliothèque vidéo'}
                  </motion.button>
                </div>
                {form.videoUrl ? (
                  <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                    {videoUploading && (
                      <div className="mb-3">
                        <p className="text-xs text-blue-600 mb-1 flex items-center gap-1.5">
                          <Upload size={14} className="shrink-0 animate-pulse" />
                          {t('ads.compressionInProgress') || 'Compression à 480p en cours...'}
                        </p>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${videoUploadProgress}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div
                        className="relative w-32 h-20 rounded-lg overflow-hidden bg-black border border-gray-200 flex items-center justify-center flex-shrink-0 cursor-pointer group"
                        onClick={() => form.videoUrl && getVideoPreviewUrl(form.videoUrl) && setVideoPlayerModal({ open: true, src: form.videoUrl, title: t('ads.videoSelected') || 'Vidéo sélectionnée' })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => form.videoUrl && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setVideoPlayerModal({ open: true, src: form.videoUrl, title: t('ads.videoSelected') || 'Vidéo sélectionnée' }))}
                        aria-label={t('common.playVideo')}
                      >
                        {videoUploading ? (
                          <Upload size={28} className="text-blue-400 animate-pulse" />
                        ) : (
                          getVideoPreviewUrl(form.videoUrl) ? (
                            <>
                              <video
                                key={form.videoUrl}
                                src={getVideoPreviewUrl(form.videoUrl)}
                                className="w-full h-full object-cover pointer-events-none group-hover:opacity-90"
                                muted
                                playsInline
                                preload="metadata"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow">
                                  <Play size={16} className="text-gray-800 ml-0.5" fill="currentColor" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <Video size={24} className="text-white" />
                          )
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {t('ads.videoSelected') || 'Vidéo sélectionnée'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 truncate" title={form.videoUrl}>
                          {form.videoUrl}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={clearVideo}
                        disabled={videoUploading}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Video size={32} className="text-gray-400 mb-2" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">{t('ads.clickToUpload') || 'Cliquez pour uploader'}</span> {t('ads.orDragDrop') || 'ou glissez-déposez'}
                      </p>
                      <p className="text-xs text-gray-500">
                        MP4, AVI, MOV {t('ads.upTo1000Mo') || 'jusqu\'à 1000 Mo'} (compression 480p)
                      </p>
                    </div>
                    <input
                      id="ads-video-upload"
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      disabled={videoUploading}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={form.type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setForm({
                      ...form,
                      type: newType,
                      skipAfterPercent: newType === 'preroll' ? 0 : form.skipAfterPercent,
                      triggerAtPercent: newType === 'preroll' ? 50 : form.triggerAtPercent,
                    });
                  }}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="preroll">Pre-roll (avant la vidéo)</option>
                  <option value="midroll">Mid-roll (pendant la vidéo)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de début *</label>
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin *</label>
                  <input
                    type="datetime-local"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {form.type === 'midroll' && (
                  <div className="hidden col-span-2 grid-cols-2 gap-4" aria-hidden="true">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('ads.triggerAtPercentLabel') || 'Afficher à (% de la durée)'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form.triggerAtPercent}
                        onChange={(e) => {
                          const v = e.target.value;
                          const num = v === '' ? NaN : parseInt(v, 10);
                          const final = Number.isNaN(num) ? 50 : Math.min(100, Math.max(0, num));
                          setForm({ ...form, triggerAtPercent: final });
                        }}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                      <p className="text-xs text-gray-500 mt-1">Moment où cette pub s&apos;affiche pendant la vidéo (ex: 50 = à la moitié)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t('ads.skipAfterPercentLabel') || 'Passer après (% de la durée)'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={form.skipAfterPercent}
                        onChange={(e) => setForm({ ...form, skipAfterPercent: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0)) })}
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                      />
                      <p className="text-xs text-gray-500 mt-1">0 = dès le début, 100 = à la fin</p>
                    </div>
                  </div>
                )}
                <div className={form.type === 'midroll' ? 'col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ordre</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Pub active</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-white"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {selectedAd ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Bibliothèque vidéo */}
      {showVideoLibraryPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">
                {t('ads.chooseVideo') || 'Choisir une vidéo'}
              </h3>
              <button type="button" onClick={() => setShowVideoLibraryPicker(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {mediaLibraryLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-500 border-t-transparent mb-3" />
                  <p>{t('ads.loadingLibraryMedia') || 'Chargement de la bibliothèque média...'}</p>
                </div>
              ) : mediaLibraryVideos.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {t('ads.noVideoInLibraryBefore') || 'Aucune vidéo. Allez dans'}{' '}
                  <Link
                    to="/bibliotheque"
                    onClick={() => setShowVideoLibraryPicker(false)}
                    className="font-semibold text-purple-600 hover:text-purple-700 underline"
                  >
                    {t('navigation.mediaLibrary') || 'Bibliothèque média'}
                  </Link>
                  {' '}{t('ads.noVideoInLibraryAfter') || 'pour en ajouter.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {mediaLibraryVideos.map((v) => (
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
            <div className="p-4 border-t border-gray-200 flex justify-end shrink-0 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setShowVideoLibraryPicker(false)}
                className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-white bg-white"
              >
                {t('common.cancel') || 'Annuler'}
              </button>
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

export default Ads;

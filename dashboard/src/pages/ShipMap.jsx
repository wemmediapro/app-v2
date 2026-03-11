import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Map, Plus, Edit, Trash2, Search, Layers, Ship, X, RefreshCw, Upload, Image, Globe } from 'lucide-react';
import { apiService } from '../services/apiService';
import { availableShips } from '../data/ships';
import { LANG_LIST } from '../utils/i18n';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

const DECK_TYPES = [
  { value: 'passenger', labelKey: 'shipmap.deckType_pont_cabines' },
  { value: 'vehicle', labelKey: 'shipmap.deckType_garage' },
  { value: 'cabin', labelKey: 'shipmap.deckType_pont_cabines' },
  { value: 'service', labelKey: 'shipmap.deckType_pont_services' },
  { value: 'public', labelKey: 'shipmap.deckType_pont_panoramique' },
];

const ShipMap = () => {
  const { t } = useLanguage();
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [shipFilter, setShipFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingDeck, setEditingDeck] = useState(null);
  const [newService, setNewService] = useState('');
  const [uploadingServiceIcon, setUploadingServiceIcon] = useState(null);

  const emptyNameByLocale = () => ({ fr: '', en: '', es: '', it: '', de: '', ar: '' });
  const normalizeServiceItem = (s) => {
    if (typeof s === 'string') return { name: s, icon: '', openingHours: '', nameByLocale: { ...emptyNameByLocale(), fr: s } };
    const nbl = (s?.nameByLocale && typeof s.nameByLocale === 'object') ? { ...emptyNameByLocale(), ...s.nameByLocale } : { ...emptyNameByLocale(), fr: s?.name ?? '' };
    return { name: s?.name ?? '', icon: s?.icon ?? '', openingHours: s?.openingHours ?? '', nameByLocale: nbl };
  };
  const [activeLang, setActiveLang] = useState('fr');
  const [form, setForm] = useState({
    name: '',
    type: 'passenger',
    description: '',
    area: '',
    capacity: 0,
    shipId: '',
    shipName: '',
    services: [],
    isActive: true,
    nameByLocale: { fr: '', en: '', es: '', it: '', de: '', ar: '' },
    descriptionByLocale: { fr: '', en: '', es: '', it: '', de: '', ar: '' },
  });

  useEffect(() => {
    fetchDecks();
  }, [shipFilter]);

  const fetchDecks = async () => {
    try {
      setLoading(true);
      const params = shipFilter !== 'all' ? `shipId=${shipFilter}` : '';
      const response = await apiService.getShipmapDecks(params);
      setDecks(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching decks:', error);
      toast.error(t('shipmap.errorLoadDecks'));
      setDecks([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredDecks = useMemo(() => {
    return decks.filter((deck) => {
      const matchesSearch =
        !searchQuery ||
        deck.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deck.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deck.shipName?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [decks, searchQuery]);

  const totalCapacity = useMemo(
    () => filteredDecks.reduce((acc, d) => acc + (Number(d.capacity) || 0), 0),
    [filteredDecks]
  );

  const openAddModal = () => {
    setEditingDeck(null);
    setActiveLang('fr');
    setForm({
      name: '',
      type: 'passenger',
      description: '',
      area: '',
      capacity: 0,
      shipId: '',
      shipName: '',
      services: [],
      isActive: true,
      nameByLocale: { fr: '', en: '', es: '', it: '', de: '', ar: '' },
      descriptionByLocale: { fr: '', en: '', es: '', it: '', de: '', ar: '' },
    });
    setNewService('');
    setShowModal(true);
  };

  const openEditModal = (deck) => {
    setEditingDeck(deck);
    setActiveLang('fr');
    const nbl = deck.nameByLocale || {};
    const dbl = deck.descriptionByLocale || {};
    const services = Array.isArray(deck.services) ? deck.services.map((s) => normalizeServiceItem(s)) : [];
    setForm({
      name: nbl.fr || deck.name || '',
      type: deck.type || 'passenger',
      description: dbl.fr || deck.description || '',
      area: deck.area || '',
      capacity: deck.capacity ?? 0,
      shipId: deck.shipId ?? '',
      shipName: deck.shipName || '',
      services,
      isActive: deck.isActive !== false,
      nameByLocale: {
        fr: nbl.fr || deck.name || '',
        en: nbl.en || '',
        es: nbl.es || '',
        it: nbl.it || '',
        de: nbl.de || '',
        ar: nbl.ar || '',
      },
      descriptionByLocale: {
        fr: dbl.fr || deck.description || '',
        en: dbl.en || '',
        es: dbl.es || '',
        it: dbl.it || '',
        de: dbl.de || '',
        ar: dbl.ar || '',
      },
    });
    setNewService('');
    setShowModal(true);
  };

  const handleShipSelect = (e) => {
    const id = e.target.value;
    const ship = availableShips.find((s) => String(s.id) === id);
    setForm((prev) => ({
      ...prev,
      shipId: id ? Number(id) : '',
      shipName: ship ? ship.name : '',
    }));
  };

  const addService = () => {
    const s = newService.trim();
    if (!s) return;
    setForm((prev) => ({
      ...prev,
      services: [...(prev.services || []), { name: s, icon: '', openingHours: '', nameByLocale: { ...emptyNameByLocale(), fr: s } }],
    }));
    setNewService('');
  };

  const removeService = (index) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index),
    }));
  };

  const updateServiceField = (index, field, value) => {
    setForm((prev) => {
      const services = (prev.services || []).map((svc, i) => {
        if (i !== index) return normalizeServiceItem(svc);
        const next = { ...normalizeServiceItem(svc), [field]: value };
        if (field === 'name') next.nameByLocale = { ...(svc.nameByLocale || emptyNameByLocale()), fr: value };
        return next;
      });
      return { ...prev, services };
    });
  };

  const updateServiceNameByLocale = (index, lang, value) => {
    setForm((prev) => ({
      ...prev,
      services: (prev.services || []).map((svc, i) =>
        i === index ? { ...normalizeServiceItem(svc), nameByLocale: { ...(svc.nameByLocale || emptyNameByLocale()), [lang]: value } } : normalizeServiceItem(svc)
      ),
    }));
  };

  const handleServiceIconUpload = async (index, file) => {
    if (!file || !file.type?.startsWith('image/')) {
      toast.error(t('shipmap.invalidImage'));
      return;
    }
    setUploadingServiceIcon(index);
    try {
      const res = await apiService.uploadImage(file);
      const path = res?.image?.path || res?.image?.url || '';
      if (path) updateServiceField(index, 'icon', path);
      else toast.error(t('shipmap.uploadError'));
    } catch (err) {
      toast.error(err.response?.data?.message || t('shipmap.uploadError'));
    } finally {
      setUploadingServiceIcon(null);
    }
  };

  const handleSubmit = async () => {
    const frName = (form.nameByLocale?.fr ?? form.name)?.trim();
    if (!frName) {
      toast.error(t('shipmap.fillRequired'));
      return;
    }
    const shipId = form.shipId ? Number(form.shipId) : null;
    const shipName = form.shipName || availableShips.find((s) => s.id === shipId)?.name || '';
    if (!shipId || !shipName) {
      toast.error(t('shipmap.selectShipRequired'));
      return;
    }

    const nameByLocale = { ...(form.nameByLocale || {}), fr: frName };
    const descriptionByLocale = { ...(form.descriptionByLocale || {}), fr: (form.descriptionByLocale?.fr ?? form.description)?.trim() || '' };
    const payload = {
      name: frName,
      type: form.type,
      description: (form.descriptionByLocale?.fr ?? form.description)?.trim() || undefined,
      area: form.area?.trim() || undefined,
      capacity: Number(form.capacity) || 0,
      shipId,
      shipName,
      services: (form.services || []).map(normalizeServiceItem),
      isActive: form.isActive,
      nameByLocale,
      descriptionByLocale,
    };

    try {
      if (editingDeck?._id) {
        await apiService.updateShipmapDeck(editingDeck._id, payload);
        toast.success(t('shipmap.planUpdated'));
      } else {
        await apiService.createShipmapDeck(payload);
        toast.success(t('shipmap.planAdded'));
      }
      fetchDecks();
      setShowModal(false);
    } catch (err) {
      const msg = editingDeck ? t('shipmap.errorUpdatePlan') : t('shipmap.errorAddPlan');
      toast.error(msg);
    }
  };

  const handleDelete = async (deck) => {
    if (!window.confirm(t('shipmap.deletePlanConfirm'))) return;
    try {
      await apiService.deleteShipmapDeck(deck._id);
      toast.success(t('shipmap.planDeleted'));
      fetchDecks();
    } catch (err) {
      toast.error(t('shipmap.errorDeletePlan'));
    }
  };

  if (loading && decks.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-500">Chargement des plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* En-tête compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">{t('shipmap.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('shipmap.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={fetchDecks}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 text-gray-700 text-sm font-medium shrink-0"
          >
            <RefreshCw size={18} />
            {t('shipmap.refresh')}
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors shrink-0"
          >
            <Plus size={18} />
            {t('shipmap.addPlan')}
          </motion.button>
        </div>
      </div>

      {/* Stats compactes */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><Layers size={18} className="text-slate-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('shipmap.totalDecks')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{filteredDecks.length}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50"><Ship size={18} className="text-emerald-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('shipmap.totalCapacity')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{totalCapacity}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50"><Map size={18} className="text-violet-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('shipmap.deckTypesCount')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{new Set(filteredDecks.map((d) => d.type)).size}</p></div>
        </div>
      </div>

      {/* Barre recherche + filtre navire */}
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="relative flex-1 min-w-0">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t('shipmap.searchDeckPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-colors"
          />
        </div>
        <select
          value={shipFilter}
          onChange={(e) => setShipFilter(e.target.value)}
          className="h-10 px-4 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 shrink-0"
        >
          <option value="all">{t('shipmap.selectShip')}</option>
          {availableShips.map((ship) => (<option key={ship.id} value={ship.id}>{ship.name}</option>))}
        </select>
      </div>

      {/* Liste des ponts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDecks.map((deck) => (
          <motion.div
            key={deck._id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-slate-200/80 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all duration-200"
          >
            <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-slate-800 truncate flex-1 text-sm">{deck.name}</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 shrink-0">{deck.type}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Ship size={12} />{deck.shipName}</p>
            </div>
            <div className="p-3">
              {deck.description && <p className="text-xs text-slate-600 line-clamp-2 mb-2">{deck.description}</p>}
              <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-500 mb-2">
                {deck.area && <span className="px-2 py-0.5 bg-slate-100 rounded">{deck.area}</span>}
                {deck.capacity != null && deck.capacity > 0 && <span className="px-2 py-0.5 bg-slate-100 rounded">{deck.capacity} {t('shipmap.capacityPersons')}</span>}
              </div>
              {deck.services?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {deck.services.slice(0, 3).map((s, i) => {
                    const name = typeof s === 'string' ? s : s?.name;
                    const hours = typeof s === 'object' && s?.openingHours ? ` · ${s.openingHours}` : '';
                    return <span key={i} className="text-[11px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded">{name}{hours}</span>;
                  })}
                  {deck.services.length > 3 && <span className="text-[11px] text-slate-400">+{deck.services.length - 3}</span>}
                </div>
              )}
              <div className="flex gap-1 pt-2 border-t border-slate-100">
                <button onClick={() => openEditModal(deck)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-xs font-medium"><Edit size={14} /><span className="hidden sm:inline">{t('common.edit')}</span></button>
                <button onClick={() => handleDelete(deck)} className="flex-1 flex items-center justify-center gap-1 py-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-medium"><Trash2 size={14} /><span className="hidden sm:inline">{t('common.delete')}</span></button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredDecks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-slate-200/80 bg-white">
          <div className="rounded-2xl bg-slate-100 p-6 mb-4"><Map size={40} className="text-slate-400" /></div>
          <p className="text-slate-600 font-medium">{shipFilter !== 'all' ? t('shipmap.noDecksForShip') : t('shipmap.searchDeckPlaceholder')}</p>
          <button onClick={openAddModal} className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium text-sm">{t('shipmap.addPlan')}</button>
        </div>
      )}

      {/* Modal Ajout / Édition — même structure que Nouveau restaurant */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-plan-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200"
          >
            {/* Header — comme Nouveau restaurant */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700">
                  <Map size={24} />
                </div>
                <div>
                  <h2 id="modal-plan-title" className="text-xl font-bold text-gray-900">
                    {editingDeck ? t('shipmap.editPlan') : t('shipmap.newPlan')}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {editingDeck ? t('shipmap.modalSubtitleEdit') : t('shipmap.modalSubtitleNew')}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="p-2.5 hover:bg-white/80 rounded-xl transition-colors text-gray-500 hover:text-gray-700" aria-label={t('common.close')}>
                <X size={22} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Section : Contenu par langue — onglets comme Nouveau restaurant */}
              <section className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide flex items-center gap-2">
                  <Globe size={16} className="text-blue-600" />
                  {t('shipmap.contentByLanguage')}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {LANG_LIST.map(({ code, label }) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setActiveLang(code)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeLang === code ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} ${code === 'fr' ? 'ring-1 ring-blue-200' : ''}`}
                    >
                      {label}
                      {code === 'fr' && <span className="ml-1 text-xs opacity-80">*</span>}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 p-4 bg-gray-50/80 rounded-xl border border-gray-100">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('shipmap.deckNameRequired')}
                      <span className="text-gray-400 font-normal ml-1">({activeLang})</span>
                    </label>
                    <input
                      type="text"
                      value={activeLang === 'fr' ? form.name : (form.nameByLocale?.[activeLang] ?? '')}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (activeLang === 'fr') {
                          setForm((p) => ({ ...p, name: v, nameByLocale: { ...(p.nameByLocale || {}), fr: v } }));
                        } else {
                          setForm((p) => ({ ...p, nameByLocale: { ...(p.nameByLocale || {}), [activeLang]: v } }));
                        }
                      }}
                      placeholder={t('shipmap.deckNamePlaceholder')}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('shipmap.description')}
                      <span className="text-gray-400 font-normal ml-1">({activeLang})</span>
                    </label>
                    <textarea
                      value={activeLang === 'fr' ? form.description : (form.descriptionByLocale?.[activeLang] ?? '')}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (activeLang === 'fr') {
                          setForm((p) => ({ ...p, description: v, descriptionByLocale: { ...(p.descriptionByLocale || {}), fr: v } }));
                        } else {
                          setForm((p) => ({ ...p, descriptionByLocale: { ...(p.descriptionByLocale || {}), [activeLang]: v } }));
                        }
                      }}
                      placeholder={t('shipmap.descriptionPlaceholder')}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    />
                  </div>
                  {/* Servizi disponibili — dans Contenuto per lingua, comme la description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('shipmap.services')}
                      <span className="text-gray-400 font-normal ml-1">({activeLang})</span>
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newService}
                        onChange={(e) => setNewService(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
                        placeholder={t('shipmap.addService')}
                        className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={addService}
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium"
                      >
                        {t('shipmap.addButton')}
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(form.services || []).map((s, i) => {
                        const svc = normalizeServiceItem(s);
                        const apiBase = import.meta.env?.VITE_API_BASE_URL || '';
                        const iconSrc = svc.icon && (svc.icon.startsWith('http') ? svc.icon : `${apiBase.replace(/\/$/, '')}${svc.icon.startsWith('/') ? '' : '/'}${svc.icon}`);
                        const serviceNameForLang = svc.nameByLocale?.[activeLang] ?? (activeLang === 'fr' ? (svc.name ?? '') : '');
                        return (
                          <div
                            key={i}
                            className="flex flex-col gap-2 p-3 bg-white border border-gray-200 rounded-xl"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {svc.icon ? (
                                  <img src={iconSrc} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                                ) : (
                                  <div className="h-8 w-8 rounded bg-gray-200 flex items-center justify-center shrink-0">
                                    <Image size={16} className="text-gray-500" />
                                  </div>
                                )}
                                <input
                                  type="text"
                                  value={serviceNameForLang}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    if (activeLang === 'fr') {
                                      updateServiceField(i, 'name', v);
                                    } else {
                                      updateServiceNameByLocale(i, activeLang, v);
                                    }
                                  }}
                                  placeholder={t('shipmap.serviceNamePlaceholder')}
                                  className="flex-1 min-w-0 px-2 py-1.5 text-sm font-medium text-gray-800 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                              <input
                                type="text"
                                value={svc.openingHours}
                                onChange={(e) => updateServiceField(i, 'openingHours', e.target.value)}
                                placeholder={t('shipmap.openingHoursPlaceholder')}
                                className="w-32 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <label className="cursor-pointer flex items-center gap-1 px-2 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm text-gray-700">
                                <Upload size={14} />
                                {uploadingServiceIcon === i ? t('shipmap.uploading') : t('shipmap.uploadIcon')}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingServiceIcon !== null}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleServiceIconUpload(i, f);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => removeService(i)}
                                className="p-1.5 text-gray-500 hover:text-red-600 rounded-lg hover:bg-red-50"
                                aria-label={t('common.delete')}
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
              {/* Suite du formulaire */}
              <section className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('shipmap.deckTypeRequired')}
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {DECK_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('shipmap.assignShip')}
                </label>
                <select
                  value={form.shipId || ''}
                  onChange={handleShipSelect}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">{t('shipmap.selectShipOption')}</option>
                  {availableShips.map((ship) => (
                    <option key={ship.id} value={ship.id}>
                      {ship.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('shipmap.area')}
                  </label>
                  <input
                    type="text"
                    value={form.area}
                    onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
                    placeholder={t('shipmap.areaPlaceholder')}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('shipmap.capacity')}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.capacity}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, capacity: parseInt(e.target.value, 10) || 0 }))
                    }
                    placeholder={t('shipmap.capacityPlaceholder')}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{t('common.active')}</span>
              </label>
              </section>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-gray-700 hover:bg-white"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                {editingDeck ? t('shipmap.updatePlanButton') : t('shipmap.addPlanButton')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ShipMap;

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Send,
  Plus,
  AlertCircle,
  Info,
  Utensils,
  Ship,
  Megaphone,
  RefreshCw,
  CalendarClock,
  X,
  Globe,
  Trash2,
  Copy
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { LANG_LIST } from '../utils/i18n';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

const initialTranslations = () =>
  LANG_LIST.reduce((acc, { code }) => ({ ...acc, [code]: { title: '', message: '' } }), {});

const Notifications = () => {
  const { t, language } = useLanguage();
  const TYPE_OPTIONS = [
    { value: 'info', label: t('notifications.info'), icon: Info },
    { value: 'alert', label: t('notifications.alert'), icon: AlertCircle },
    { value: 'restaurant', label: t('notifications.restaurant'), icon: Utensils },
    { value: 'boarding', label: t('notifications.boarding'), icon: Ship },
    { value: 'other', label: t('notifications.other'), icon: Megaphone },
  ];
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [translations, setTranslations] = useState(initialTranslations);
  const [type, setType] = useState('info');
  const [sendMode, setSendMode] = useState('now'); // 'now' | 'scheduled'
  const [scheduledAt, setScheduledAt] = useState('');
  const [activeLangTab, setActiveLangTab] = useState(LANG_LIST[0]?.code ?? 'fr');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await apiService.getNotificationsAll();
      setNotifications(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erreur chargement notifications:', error);
      toast.error(t('common.errorLoad'));
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const hasAtLeastOneContent = () => {
    return Object.values(translations).some(
      (tr) => (tr.title && tr.title.trim()) || (tr.message && tr.message.trim())
    );
  };

  const getPayload = () => {
    const tr = {};
    LANG_LIST.forEach(({ code }) => {
      const t = translations[code] || {};
      const title = String(t.title || '').trim();
      const message = String(t.message || '').trim();
      if (title || message) tr[code] = { title, message };
    });
    const payload = {
      translations: tr,
      type,
      scheduledAt: sendMode === 'scheduled' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined
    };
    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasAtLeastOneContent()) {
      toast.error(t('notifications.fillOneLanguage'));
      return;
    }
    if (sendMode === 'scheduled' && !scheduledAt) {
      toast.error(t('notifications.chooseScheduleDate'));
      return;
    }
    if (sendMode === 'scheduled' && new Date(scheduledAt) <= new Date()) {
      toast.error(t('notifications.scheduleFuture'));
      return;
    }
    try {
      setSending(true);
      await apiService.createNotification(getPayload());
      toast.success(
        sendMode === 'scheduled'
          ? t('notifications.scheduleSuccess')
          : t('notifications.sendSuccess')
      );
      setModalOpen(false);
      resetForm();
      fetchNotifications();
    } catch (error) {
      console.error('Erreur envoi notification:', error);
      toast.error(error.response?.data?.message || t('notifications.errorSend'));
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setTranslations(initialTranslations());
    setType('info');
    setSendMode('now');
    setScheduledAt('');
    setActiveLangTab(LANG_LIST[0]?.code ?? 'fr');
  };

  const openModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const openModalForDuplicate = (notif) => {
    const tr = initialTranslations();
    if (notif.translations && typeof notif.translations === 'object') {
      LANG_LIST.forEach(({ code }) => {
        const t = notif.translations[code];
        if (t) tr[code] = { title: t.title ?? '', message: t.message ?? '' };
      });
    } else if (notif.title != null || notif.message != null) {
      tr.fr = { title: notif.title ?? '', message: notif.message ?? '' };
    }
    const isFutureScheduled = notif.scheduledAt && new Date(notif.scheduledAt) > new Date();
    setTranslations(tr);
    setType(notif.type || 'info');
    setSendMode(isFutureScheduled ? 'scheduled' : 'now');
    setScheduledAt(
      isFutureScheduled && notif.scheduledAt
        ? new Date(notif.scheduledAt).toISOString().slice(0, 16)
        : ''
    );
    setModalOpen(true);
  };

  const getNotificationId = (notif) => {
    const raw = notif?.id ?? notif?._id;
    if (raw == null) return null;
    if (typeof raw === 'string') return raw.trim() || null;
    if (typeof raw.toString === 'function') return raw.toString().trim() || null;
    return null;
  };

  const handleDelete = async (notif) => {
    if (!window.confirm(t('notifications.confirmDelete'))) return;
    const id = getNotificationId(notif);
    if (!id || id === 'undefined' || id === '[object Object]') {
      toast.error(t('notifications.invalidId'));
      return;
    }
    try {
      setDeletingId(id);
      await apiService.deleteNotification(id);
      toast.success(t('notifications.deleteSuccess'));
      // Retirer immédiatement de la liste
      setNotifications((prev) => prev.filter((n) => getNotificationId(n) !== id));
      // Rafraîchir la liste depuis le serveur pour confirmer
      const response = await apiService.getNotificationsAll();
      setNotifications(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erreur suppression notification:', error);
      const status = error.response?.status;
      const msg = error.response?.data?.message || error.message;
      if (status === 401) {
        toast.error(t('notifications.sessionExpired'));
      } else if (status === 403) {
        toast.error(t('notifications.insufficientRights'));
      } else {
        toast.error(msg || t('notifications.errorDelete'));
      }
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date) => {
    const locale = { fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE', ar: 'ar-EG' }[language] || 'fr-FR';
    return new Date(date).toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTypeIcon = (t) => {
    const opt = TYPE_OPTIONS.find((o) => o.value === t);
    return opt ? opt.icon : Info;
  };

  const displayTitle = (notif) => {
    const tr = notif.translations;
    if (tr && tr[language]?.title) return tr[language].title;
    if (notif.title) return notif.title;
    if (tr && tr.fr?.title) return tr.fr.title;
    const first = tr && Object.values(tr)[0];
    return (first && first.title) || '—';
  };

  const displayMessage = (notif) => {
    const tr = notif.translations;
    if (tr && tr[language]?.message) return tr[language].message;
    if (notif.message) return notif.message;
    if (tr && tr.fr?.message) return tr.fr.message;
    const first = tr && Object.values(tr)[0];
    return (first && first.message) || '—';
  };

  return (
    <div className="space-y-6 pb-8 w-full">
      {/* Header + Bouton Ajouter notification */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('navigation.notifications')}</h1>
          <p className="text-gray-600 mt-2">
            {t('notifications.subtitle')}
          </p>
        </div>
        <motion.button
          type="button"
          onClick={openModal}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
{t('notifications.addNotification')}
          </motion.button>
      </div>

      {/* Modal Ajouter notification — multilingue + envoi / programmation */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => !sending && setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* En-tête du modal */}
              <div className="flex-shrink-0 px-5 py-4 border-b border-gray-200 bg-gray-50/70">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                    <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-100 text-blue-600">
                      <Plus size={20} />
                    </span>
                    {t('notifications.newNotification')}
                  </h2>
                  <button
                    type="button"
                    onClick={() => !sending && setModalOpen(false)}
                    className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label={t('common.close')}
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto">
                  {/* Bloc Options : Type + Envoi */}
                  <div className="p-5 pb-2">
                    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('notifications.typeLabel')}
                          </label>
                          <select
                            value={type}
                            onChange={(e) => setType(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-shadow"
                          >
                            {TYPE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            {t('notifications.sendLabel')}
                          </label>
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-2.5 cursor-pointer py-2 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50 has-[:checked]:text-blue-700 transition-colors min-h-[44px]">
                              <input
                                type="radio"
                                name="sendMode"
                                checked={sendMode === 'now'}
                                onChange={() => setSendMode('now')}
                                className="w-4 h-4 text-blue-600"
                              />
                              <Send size={18} className="text-gray-600 shrink-0" />
                              <span className="text-sm font-medium">{t('notifications.sendNow')}</span>
                            </label>
                            <label className="flex items-center gap-2.5 cursor-pointer py-2 px-3 rounded-lg border border-gray-200 hover:bg-gray-50 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50/50 has-[:checked]:text-blue-700 transition-colors min-h-[44px]">
                              <input
                                type="radio"
                                name="sendMode"
                                checked={sendMode === 'scheduled'}
                                onChange={() => setSendMode('scheduled')}
                                className="w-4 h-4 text-blue-600"
                              />
                              <CalendarClock size={18} className="text-gray-600 shrink-0" />
                              <span className="text-sm font-medium">{t('notifications.scheduleSend')}</span>
                            </label>
                          </div>
                          {sendMode === 'scheduled' && (
                            <div className="mt-3">
                              <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={(e) => setScheduledAt(e.target.value)}
                                min={new Date().toISOString().slice(0, 16)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contenu par langue — onglets */}
                  <div className="px-5 pb-5">
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                          <Globe size={18} className="text-gray-600 shrink-0" />
                          <span className="text-sm font-semibold text-gray-700">
                            {t('notifications.contentByLanguage')}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                          {t('notifications.contentByLanguageHint')}
                        </p>
                        <div className="flex flex-wrap gap-1" role="tablist">
                          {LANG_LIST.map(({ code, label }) => {
                            const hasContent = (translations[code]?.title?.trim() || translations[code]?.message?.trim());
                            const isActive = activeLangTab === code;
                            return (
                              <button
                                key={code}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                aria-controls={`panel-${code}`}
                                id={`tab-${code}`}
                                onClick={() => setActiveLangTab(code)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors min-h-[40px] flex items-center gap-1.5 ${
                                  isActive
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                              >
                                {label}
                                {hasContent && (
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-white/80' : 'bg-green-500'}`} title={t('notifications.contentByLanguageHint')} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="p-4">
                        {LANG_LIST.map(({ code, label }) => (
                          <div
                            key={code}
                            id={`panel-${code}`}
                            role="tabpanel"
                            aria-labelledby={`tab-${code}`}
                            hidden={activeLangTab !== code}
                            className="space-y-4"
                          >
                            <div className="space-y-3">
                              <label htmlFor={`title-${code}`} className="block text-sm font-medium text-gray-700">
                                {t('notifications.titlePlaceholder', { code: label })}
                              </label>
                              <input
                                id={`title-${code}`}
                                type="text"
                                placeholder={t('notifications.titlePlaceholder', { code: label })}
                                value={translations[code]?.title ?? ''}
                                onChange={(e) =>
                                  setTranslations((prev) => ({
                                    ...prev,
                                    [code]: { ...prev[code], title: e.target.value }
                                  }))
                                }
                                maxLength={120}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400"
                              />
                              <label htmlFor={`message-${code}`} className="block text-sm font-medium text-gray-700">
                                {t('notifications.messagePlaceholder', { code: label })}
                              </label>
                              <textarea
                                id={`message-${code}`}
                                placeholder={t('notifications.messagePlaceholder', { code: label })}
                                value={translations[code]?.message ?? ''}
                                onChange={(e) =>
                                  setTranslations((prev) => ({
                                    ...prev,
                                    [code]: { ...prev[code], message: e.target.value }
                                  }))
                                }
                                rows={4}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-400 resize-y min-h-[100px]"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pied de formulaire fixe */}
                <div className="flex-shrink-0 p-5 border-t border-gray-200 bg-gray-50/70 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={sending}
                    className="px-5 py-3 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50 font-medium min-h-[44px]"
                  >
                    {t('common.cancel')}
                  </button>
                  <motion.button
                    type="submit"
                    disabled={sending || !hasAtLeastOneContent()}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] shadow-sm"
                  >
                    <Send size={18} />
                    {sending
                      ? t('notifications.sending')
                      : sendMode === 'scheduled'
                        ? t('notifications.scheduleSendButton')
                        : t('notifications.send')}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Liste des notifications */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Bell size={20} />
            {t('notifications.listTitle')}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{t('notifications.countNotifications', { count: notifications.length })}</span>
            <button
              type="button"
              onClick={fetchNotifications}
              disabled={loading}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              title={t('notifications.refresh')}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto max-h-[400px]">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('notifications.noNotifications')}</p>
              <p className="text-sm text-gray-400 mt-1">
                {t('notifications.noNotificationsHint')}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((notif, index) => {
                const Icon = getTypeIcon(notif.type);
                const isScheduled = notif.status === 'scheduled';
                const notifId = getNotificationId(notif) || `idx-${index}`;
                return (
                  <motion.li
                    key={notifId}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="p-4 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Icon size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{displayTitle(notif)}</p>
                        <p className="text-sm text-gray-600 mt-0.5">{displayMessage(notif)}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-xs text-gray-400">
                            {isScheduled && notif.scheduledAt
                              ? t('notifications.scheduledOn', { date: formatDate(notif.scheduledAt) })
                              : t('notifications.sentOn', { date: formatDate(notif.createdAt) })}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {TYPE_OPTIONS.find((o) => o.value === notif.type)?.label || notif.type}
                          </span>
                          {isScheduled ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              {t('notifications.scheduled')}
                            </span>
                          ) : (
                            notif.isActive !== false && (
                              <span className="text-xs text-green-600">• {t('notifications.active')}</span>
                            )
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openModalForDuplicate(notif)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={t('common.duplicate')}
                          aria-label={t('common.duplicate')}
                        >
                          <Copy size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(notif)}
                          disabled={deletingId === notifId}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 size={18} className={deletingId === notifId ? 'animate-pulse' : ''} />
                        </button>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notifications;

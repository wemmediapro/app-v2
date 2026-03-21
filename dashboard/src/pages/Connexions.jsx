import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, RefreshCw, Save, Server, Users } from 'lucide-react';
import { apiService } from '../services/apiService';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Page Connexions : formulaire pour la limite de connexions du serveur local.
 * Le dashboard ne gère que le serveur sur lequel il tourne ; la limite s'applique à toutes les connexions Socket.io de ce serveur.
 */
const Connexions = () => {
  const { t } = useLanguage();
  const [currentConnections, setCurrentConnections] = useState(0);
  const [maxConnections, setMaxConnections] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchLimit = async () => {
    try {
      setLoading(true);
      const res = await apiService.getConnectionLimit();
      const data = res?.data?.data ?? res?.data ?? {};
      setCurrentConnections(data.currentConnections ?? 0);
      setMaxConnections(data.maxConnections ?? null);
      setEditValue(data.maxConnections != null ? String(data.maxConnections) : '');
    } catch (err) {
      console.error('Erreur chargement limite:', err);
      toast.error(t('connexionsPage.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLimit();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const raw = editValue.trim();
    const unlimitedWord = t('connexionsPage.unlimitedPlaceholder').toLowerCase();
    const value = raw === '' || raw.toLowerCase() === unlimitedWord ? null : parseInt(raw, 10);
    if (raw !== '' && (Number.isNaN(value) || value < 0)) {
      toast.error(t('connexionsPage.invalidNumber'));
      return;
    }
    try {
      setSaving(true);
      await apiService.updateConnectionLimit({ maxConnections: value });
      setMaxConnections(value);
      toast.success(t('connexionsPage.saveSuccess'));
      fetchLimit();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('connexionsPage.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const atLimit = maxConnections != null && maxConnections >= 0 && currentConnections >= maxConnections;

  return (
    <div className="space-y-6 pb-8 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Wifi className="text-blue-600" />
            {t('connexionsPage.title')}
          </h1>
          <p className="text-gray-600 mt-2">{t('connexionsPage.description')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={fetchLimit}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw size={18} />
          {t('connexionsPage.refresh')}
        </motion.button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Server size={24} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('connexionsPage.localServer')}</h2>
              <p className="text-sm text-gray-500">{t('connexionsPage.socketSubtitle')}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <Users size={24} className="text-gray-400" />
            <div>
              <span className="text-sm text-gray-500">{t('connexionsPage.currentConnections')}</span>
              <p className={`text-2xl font-bold ${atLimit ? 'text-amber-600' : 'text-gray-900'}`}>
                {currentConnections}
              </p>
              {atLimit && maxConnections != null && (
                <span className="text-sm text-amber-600">{t('connexionsPage.limitReached')}</span>
              )}
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t('connexionsPage.maxLimitLabel')}</span>
              <input
                type="number"
                min={0}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={t('connexionsPage.unlimitedPlaceholder')}
                className="mt-2 block w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </label>
            <p className="text-sm text-gray-500">{t('connexionsPage.unlimitedHelp')}</p>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save size={18} />
              {saving ? t('connexionsPage.saving') : t('connexionsPage.save')}
            </button>
          </form>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
        {t('connexionsPage.infoNote')}
      </div>
    </div>
  );
};

export default Connexions;

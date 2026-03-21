import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Fragment } from 'react';
import { motion } from 'framer-motion';
import { Shield, UserCog, Lock, Users, Save, RotateCcw, ChevronRight, Ship, Wifi } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { useBoatConfig } from '../contexts/BoatConfigContext';
import { apiService } from '../services/apiService';

const STORAGE_KEY = 'dashboardAccessByRole';

// Liste des modules du dashboard (ids comme dans la Sidebar) — exportée pour la page Users
export const DASHBOARD_MODULES = [
  { id: 'dashboard', labelKey: 'navigation.dashboard', groupKey: 'navigation.overview' },
  { id: 'statistics', labelKey: 'navigation.statistics', groupKey: 'navigation.overview' },
  { id: 'radio', labelKey: 'navigation.radio', groupKey: 'navigation.media' },
  { id: 'movies', labelKey: 'navigation.movies', groupKey: 'navigation.media' },
  { id: 'webtv', labelKey: 'navigation.webtv', groupKey: 'navigation.media' },
  { id: 'bibliotheque', labelKey: 'navigation.mediaLibrary', groupKey: 'navigation.media' },
  { id: 'magazine', labelKey: 'navigation.magazine', groupKey: 'navigation.media' },
  { id: 'restaurants', labelKey: 'navigation.restaurants', groupKey: 'navigation.services' },
  { id: 'shop', labelKey: 'navigation.shop', groupKey: 'navigation.services' },
  { id: 'shipmap', labelKey: 'navigation.shipmap', groupKey: 'navigation.services' },
  { id: 'enfant', labelKey: 'navigation.enfant', groupKey: 'navigation.services' },
  { id: 'banners', labelKey: 'navigation.banners', groupKey: 'navigation.services' },
  { id: 'ads', labelKey: 'navigation.ads', groupKey: 'navigation.services' },
  { id: 'users', labelKey: 'navigation.users', groupKey: 'navigation.community' },
  { id: 'messages', labelKey: 'navigation.notifications', groupKey: 'navigation.community' },
  { id: 'settings', labelKey: 'navigation.settings', groupKey: 'navigation.community' },
  { id: 'settings-connection', labelKey: 'settings.goToConnections', groupKey: 'navigation.community' },
];

const ROLES = [
  {
    id: 'admin',
    labelKey: 'settings.roles.admin',
    descKey: 'settings.roles.adminDesc',
    icon: Shield,
    color: 'from-red-500 to-rose-600',
  },
  {
    id: 'crew',
    labelKey: 'settings.roles.crew',
    descKey: 'settings.roles.crewDesc',
    icon: UserCog,
    color: 'from-blue-500 to-cyan-600',
  },
  {
    id: 'passenger',
    labelKey: 'settings.roles.passenger',
    descKey: 'settings.roles.passengerDesc',
    icon: Users,
    color: 'from-slate-500 to-slate-600',
  },
];

function getDefaultAccess() {
  const modules = DASHBOARD_MODULES.map((m) => m.id);
  const all = Object.fromEntries(modules.map((id) => [id, true]));
  const crew = Object.fromEntries(
    modules.map((id) => [
      id,
      [
        'dashboard',
        'statistics',
        'radio',
        'movies',
        'webtv',
        'bibliotheque',
        'magazine',
        'restaurants',
        'shop',
        'shipmap',
        'enfant',
        'banners',
        'messages',
        'settings-connection',
      ].includes(id),
    ])
  );
  const passenger = Object.fromEntries(modules.map((id) => [id, false]));
  return { admin: all, crew, passenger };
}

export { getDefaultAccess };

// Fallback localStorage si l'API n'a pas encore de données
function loadAccessFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const defaultAccess = getDefaultAccess();
      return {
        admin: { ...defaultAccess.admin, ...parsed.admin },
        crew: { ...defaultAccess.crew, ...parsed.crew },
        passenger: { ...defaultAccess.passenger, ...parsed.passenger },
      };
    }
  } catch (_) {}
  return getDefaultAccess();
}

function saveAccessToStorage(access) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
  } catch (_) {}
}

export function getAccessByRole() {
  return loadAccessFromStorage();
}

const Settings = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { boatConfig, loading: loadingBoat, refreshBoatConfig } = useBoatConfig();
  const [access, setAccess] = useState(() => getDefaultAccess());
  const [_accessLoading, setAccessLoading] = useState(true);
  const [saved, setSaved] = useState(true);

  // Formulaire unique du bateau (nom, capacité, informations)
  const [boatForm, setBoatForm] = useState({
    shipName: '',
    shipCapacity: '',
    shipInfo: '',
  });
  const [savingBoat, setSavingBoat] = useState(false);

  useEffect(() => {
    if (!loadingBoat) {
      setBoatForm({
        shipName: boatConfig.shipName ?? '',
        shipCapacity: boatConfig.shipCapacity != null ? String(boatConfig.shipCapacity) : '',
        shipInfo: boatConfig.shipInfo ?? '',
      });
    }
  }, [loadingBoat, boatConfig.shipName, boatConfig.shipCapacity, boatConfig.shipInfo]);

  const handleSaveBoat = async (e) => {
    e.preventDefault();
    const shipName = (boatForm.shipName || '').trim();
    const capacityNum = boatForm.shipCapacity === '' ? null : parseInt(boatForm.shipCapacity, 10);
    if (capacityNum !== null && (Number.isNaN(capacityNum) || capacityNum < 0)) {
      toast.error(t('settings.capacityInvalid'));
      return;
    }
    setSavingBoat(true);
    try {
      await apiService.updateBoatConfig({
        shipName: shipName || '',
        shipCapacity: capacityNum,
        shipInfo: (boatForm.shipInfo || '').trim(),
      });
      toast.success(t('settings.boatConfigSaved'));
      refreshBoatConfig();
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.boatConfigSaveError'));
    } finally {
      setSavingBoat(false);
    }
  };

  // Charger les droits depuis l'API (MongoDB), fallback localStorage si vide ou erreur
  useEffect(() => {
    let cancelled = false;
    setAccessLoading(true);
    apiService
      .getAccessSettings()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.data ?? res?.data;
        const defaultAccess = getDefaultAccess();
        if (data && typeof data === 'object' && (data.admin || data.crew || data.passenger)) {
          const merged = {
            admin: { ...defaultAccess.admin, ...(data.admin || {}) },
            crew: { ...defaultAccess.crew, ...(data.crew || {}) },
            passenger: { ...defaultAccess.passenger, ...(data.passenger || {}) },
          };
          setAccess(merged);
          saveAccessToStorage(merged);
        } else {
          const stored = loadAccessFromStorage();
          setAccess(stored);
        }
      })
      .catch(() => {
        if (!cancelled) setAccess(loadAccessFromStorage());
      })
      .finally(() => {
        if (!cancelled) setAccessLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = (role, moduleId) => {
    setAccess((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [moduleId]: !prev[role][moduleId],
      },
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      await apiService.updateAccessSettings(access);
      saveAccessToStorage(access);
      setSaved(true);
      toast.success(t('settings.accessSaved'));
    } catch (err) {
      toast.error(err?.response?.data?.message || t('settings.accessSaveError'));
    }
  };

  const handleReset = () => {
    const defaultAccess = getDefaultAccess();
    setAccess(defaultAccess);
    setSaved(false);
    toast.success(t('settings.accessReset'));
  };

  const handleGoToUsers = (role) => {
    navigate(`/users?role=${role}`);
  };

  const groups = [...new Set(DASHBOARD_MODULES.map((m) => m.groupKey))];

  return (
    <div className="space-y-6 pb-8 w-full">
      {/* En-tête compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">{t('settings.pageTitle')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('settings.pageSubtitle')}</p>
        </div>
      </div>

      {/* Section Informations du bateau (utilisées dans restaurant, shop, plan du bateau) */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Ship size={20} />
            {t('settings.boatConfigTitle')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{t('settings.boatConfigSubtitle')}</p>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3">
            <Wifi className="text-blue-600 shrink-0" size={20} />
            <p className="text-sm text-blue-800">
              {t('settings.connectionLimitServerLocal')}{' '}
              <Link to="/settings/connection" className="font-medium underline hover:no-underline">
                {t('settings.goToConnections')}
              </Link>
            </p>
          </div>
        </div>

        <div className="p-6">
          <form onSubmit={handleSaveBoat} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.shipName')}</label>
              <input
                type="text"
                value={boatForm.shipName}
                onChange={(e) => setBoatForm((s) => ({ ...s, shipName: e.target.value }))}
                placeholder="Ex: GNV Excellent"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.capacity')}</label>
              <input
                type="number"
                min={0}
                value={boatForm.shipCapacity}
                onChange={(e) => setBoatForm((s) => ({ ...s, shipCapacity: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="lg:col-span-1 flex items-end">
              <button
                type="submit"
                disabled={savingBoat}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save size={18} />
                {savingBoat ? t('common.saving') : t('common.save')}
              </button>
            </div>
            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.boatInfoLabel')}</label>
              <textarea
                value={boatForm.shipInfo}
                onChange={(e) => setBoatForm((s) => ({ ...s, shipInfo: e.target.value }))}
                placeholder={t('settings.boatInfoPlaceholder')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </form>
        </div>
      </motion.section>

      {/* Section Rôles */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Lock size={20} />
            {t('settings.rolesTitle')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{t('settings.rolesSubtitle')}</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          {ROLES.map((role) => {
            const Icon = role.icon;
            return (
              <motion.div
                key={role.id}
                whileHover={{ y: -2 }}
                className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 flex flex-col"
              >
                <div
                  className={`flex h-12 w-12 rounded-lg bg-gradient-to-br ${role.color} items-center justify-center mb-4`}
                >
                  <Icon size={24} className="text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">{t(role.labelKey)}</h3>
                <p className="text-sm text-gray-600 mt-1 flex-1">{t(role.descKey)}</p>
                <button
                  type="button"
                  onClick={() => handleGoToUsers(role.id)}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  {t('settings.manageUsersWithRole')}
                  <ChevronRight size={16} />
                </button>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* Section Accès par rôle */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Lock size={20} />
              {t('settings.accessTitle')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{t('settings.accessSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 shrink-0"
            >
              <RotateCcw size={16} />
              {t('settings.resetAccess')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saved}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
            >
              <Save size={16} />
              {t('common.save')}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {t('settings.module')}
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-28">Admin</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-28">Équipage</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-28">Passager</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groups.map((groupKey) => {
                const modules = DASHBOARD_MODULES.filter((m) => m.groupKey === groupKey);
                return (
                  <Fragment key={groupKey}>
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-2 bg-gray-100/80 text-xs font-semibold text-gray-600 uppercase tracking-wider"
                      >
                        {t(groupKey)}
                      </td>
                    </tr>
                    {modules.map((mod) => (
                      <tr key={mod.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{t(mod.labelKey)}</td>
                        {['admin', 'crew', 'passenger'].map((role) => (
                          <td key={role} className="px-4 py-3 text-center">
                            <label className="inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!access[role]?.[mod.id]}
                                onChange={() => handleToggle(role, mod.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </label>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.section>

      {/* Section Accès par rôle */}
    </div>
  );
};

export default Settings;

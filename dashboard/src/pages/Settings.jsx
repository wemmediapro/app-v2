import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fragment } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  UserCog,
  Lock,
  Users,
  Save,
  RotateCcw,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';

const STORAGE_KEY = 'dashboardAccessByRole';

// Liste des modules du dashboard (ids comme dans la Sidebar) — exportée pour la page Users
export const DASHBOARD_MODULES = [
  { id: 'dashboard', labelKey: 'navigation.dashboard', groupKey: 'navigation.overview' },
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
      ['dashboard', 'radio', 'movies', 'webtv', 'bibliotheque', 'magazine', 'restaurants', 'shop', 'shipmap', 'enfant', 'banners', 'messages'].includes(id),
    ])
  );
  const passenger = Object.fromEntries(modules.map((id) => [id, false]));
  return { admin: all, crew, passenger };
}

export { getDefaultAccess };

function loadAccess() {
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

function saveAccess(access) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(access));
}

export function getAccessByRole() {
  return loadAccess();
}

const Settings = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [access, setAccess] = useState(() => loadAccess());
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    const stored = loadAccess();
    setAccess(stored);
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

  const handleSave = () => {
    saveAccess(access);
    setSaved(true);
    toast.success(t('settings.accessSaved'));
  };

  const handleReset = () => {
    const defaultAccess = getDefaultAccess();
    setAccess(defaultAccess);
    saveAccess(defaultAccess);
    setSaved(true);
    toast.success(t('settings.accessReset'));
  };

  const handleGoToUsers = (role) => {
    navigate(`/users?role=${role}`);
  };

  const groups = [...new Set(DASHBOARD_MODULES.map((m) => m.groupKey))];

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* En-tête compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">{t('settings.pageTitle')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{t('settings.pageSubtitle')}</p>
        </div>
      </div>

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
                <div className={`flex h-12 w-12 rounded-lg bg-gradient-to-br ${role.color} items-center justify-center mb-4`}>
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
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-28">
                  Admin
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-28">
                  Équipage
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase w-28">
                  Passager
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groups.map((groupKey) => {
                const modules = DASHBOARD_MODULES.filter((m) => m.groupKey === groupKey);
                return (
                  <Fragment key={groupKey}>
                    <tr>
                      <td colSpan={4} className="px-4 py-2 bg-gray-100/80 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {t(groupKey)}
                      </td>
                    </tr>
                    {modules.map((mod) => (
                      <tr key={mod.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {t(mod.labelKey)}
                        </td>
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
    </div>
  );
};

export default Settings;

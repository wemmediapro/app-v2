import { useLocation, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const pathToLabel = {
  dashboard: 'navigation.dashboard',
  statistics: 'navigation.statistics',
  users: 'navigation.users',
  radio: 'navigation.radio',
  library: 'navigation.library',
  movies: 'navigation.movies',
  magazine: 'navigation.magazine',
  webtv: 'navigation.webtv',
  bibliotheque: 'navigation.mediaLibrary',
  restaurants: 'navigation.restaurants',
  enfant: 'navigation.enfant',
  shipmap: 'navigation.shipmap',
  shop: 'navigation.shop',
  banners: 'navigation.banners',
  ads: 'navigation.ads',
  messages: 'navigation.notifications',
  connexions: 'navigation.connexions',
  settings: 'navigation.settings',
  connection: 'settings.connectionTitle',
  login: 'navigation.login',
};

export default function Breadcrumb() {
  const location = useLocation();
  const { t } = useLanguage();
  const rawSegments = location.pathname.split('/').filter(Boolean);
  // Éviter les segments consécutifs dupliqués (ex: /dashboard/dashboard → un seul "Dashboard")
  const segments = rawSegments.filter((seg, i) => i === 0 || seg !== rawSegments[i - 1]);
  if (segments.length === 0) return null;

  // Sur la page d'accueil du dashboard, n'afficher qu'un seul libellé
  const isDashboardHome = segments.length === 1 && segments[0] === 'dashboard';
  const displayItems = isDashboardHome ? [] : segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const labelKey = pathToLabel[segment];
    const label = labelKey ? t(labelKey) : segment.charAt(0).toUpperCase() + segment.slice(1);
    const isLast = index === segments.length - 1;
    return { path, label, isLast };
  });

  return (
    <nav aria-label={t('common.breadcrumb')} className="mb-6 min-w-0 overflow-hidden">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-600">
        {isDashboardHome ? (
          <li>
            <span className="font-medium text-gray-900" aria-current="page">
              {t('navigation.dashboard')}
            </span>
          </li>
        ) : (
          <>
            <li>
              <Link to="/dashboard" className="hover:text-blue-600 transition-colors">
                {t('navigation.dashboard')}
              </Link>
            </li>
            {displayItems.map((item) => (
              <li key={item.path} className="flex items-center gap-1">
                <ChevronRight size={14} className="text-gray-400 flex-shrink-0" aria-hidden />
                {item.isLast ? (
                  <span className="font-medium text-gray-900" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <Link to={item.path} className="hover:text-blue-600 transition-colors">
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </>
        )}
      </ol>
    </nav>
  );
}

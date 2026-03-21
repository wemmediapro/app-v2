import { useState, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import Breadcrumb from '../components/Breadcrumb';
import { useIsMobileView } from '../hooks/useIsMobileView';

const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const Statistics = lazy(() => import('../pages/Statistics'));
const Users = lazy(() => import('../pages/Users'));
const Radio = lazy(() => import('../pages/Radio'));
const Library = lazy(() => import('../pages/Library'));
const Movies = lazy(() => import('../pages/Movies'));
const Magazine = lazy(() => import('../pages/Magazine'));
const WebTV = lazy(() => import('../pages/WebTV'));
const Bibliotheque = lazy(() => import('../pages/Bibliotheque'));
const Restaurants = lazy(() => import('../pages/Restaurants'));
const Enfant = lazy(() => import('../pages/Enfant'));
const ShipMap = lazy(() => import('../pages/ShipMap'));
const Shop = lazy(() => import('../pages/Shop'));
const Banners = lazy(() => import('../pages/Banners'));
const Ads = lazy(() => import('../pages/Ads'));
const MessagesPage = lazy(() => import('../pages/MessagesPage'));
const Connexions = lazy(() => import('../pages/Connexions'));
const Settings = lazy(() => import('../pages/Settings'));

function RouteFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
        <p className="mt-3 text-gray-600 text-sm">Chargement…</p>
      </div>
    </div>
  );
}

/**
 * Shell authentifié : sidebar, header, routes lazy-loadées (code splitting).
 */
export default function MainLayout({ user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobileView = useIsMobileView();

  return (
    <div className="min-h-screen bg-gray-50 min-w-0">
      <Sidebar user={user} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isMobileView={isMobileView} />
      <div className={isMobileView ? 'min-w-0' : 'pl-64 min-w-0'}>
        <Header user={user} onLogout={onLogout} onMenuClick={() => setSidebarOpen(true)} showHamburger={isMobileView} />
        <main className="p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-auto">
          <div className="max-w-[1440px] mx-auto w-full">
            <Breadcrumb />
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/statistics" element={<Statistics />} />
                <Route path="/users" element={<Users />} />
                <Route path="/radio" element={<Radio />} />
                <Route path="/library" element={<Library />} />
                <Route path="/movies" element={<Movies />} />
                <Route path="/magazine" element={<Magazine />} />
                <Route path="/webtv" element={<WebTV />} />
                <Route path="/bibliotheque" element={<Bibliotheque />} />
                <Route path="/restaurants" element={<Restaurants />} />
                <Route path="/enfant" element={<Enfant />} />
                <Route path="/shipmap" element={<ShipMap />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/banners" element={<Banners />} />
                <Route path="/ads" element={<Ads />} />
                <Route path="/messages" element={<MessagesPage />} />
                <Route path="/connexions" element={<Connexions />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/connection" element={<Connexions />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}

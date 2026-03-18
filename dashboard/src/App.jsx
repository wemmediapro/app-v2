import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';

// Contexts
import { LanguageProvider } from './contexts/LanguageContext';
import { BoatConfigProvider } from './contexts/BoatConfigContext';

// Components
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Breadcrumb from './components/Breadcrumb';
import Login from './pages/Login';

// Pages
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Restaurants from './pages/Restaurants';
import Notifications from './pages/Notifications';
import Radio from './pages/Radio';
import Library from './pages/Library';
import Movies from './pages/Movies';
import Magazine from './pages/Magazine';
import WebTV from './pages/WebTV';
import Enfant from './pages/Enfant';
import Shop from './pages/Shop';
import Banners from './pages/Banners';
import Ads from './pages/Ads';
import Bibliotheque from './pages/Bibliotheque';
import ShipMap from './pages/ShipMap';
import Settings from './pages/Settings';
import Connexions from './pages/Connexions';
import Statistics from './pages/Statistics';
// Services
import { authService } from './services/authService';
import { useIsMobileView } from './hooks/useIsMobileView';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Auth par cookie httpOnly : vérifier la session au chargement (pas de lecture du token en JS)
  useEffect(() => {
    authService.getProfile()
      .then((res) => {
        if (res.data?.role === 'admin') {
          setUser(res.data);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      })
      .catch(() => {
        setUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = (_token, userData) => {
    setUser(userData || null);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await authService.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <LanguageProvider>
      <BoatConfigProvider>
        <Router basename="/dashboard" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AppRoutes user={user} onLogout={handleLogout} onLogin={handleLogin} isAuthenticated={isAuthenticated} />
        <Toaster position="top-right" />
      </Router>
      </BoatConfigProvider>
    </LanguageProvider>
  );
}

function AppRoutes({ user, onLogout, onLogin, isAuthenticated }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobileView = useIsMobileView();
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={onLogin} />} />
      <Route path="/*" element={!isAuthenticated ? (
        <Navigate to="/login" replace />
      ) : (
        <div className="min-h-screen bg-gray-50 min-w-0">
          <Sidebar user={user} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isMobileView={isMobileView} />
          <div className={isMobileView ? 'min-w-0' : 'pl-64 min-w-0'}>
            <Header user={user} onLogout={onLogout} onMenuClick={() => setSidebarOpen(true)} showHamburger={isMobileView} />
            <main className="p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-auto">
              <div className="max-w-[1440px] mx-auto w-full">
                <Breadcrumb />
                <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
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
                <Route path="/messages" element={<Notifications />} />
                <Route path="/connexions" element={<Connexions />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/settings/connection" element={<Connexions />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      )} />
    </Routes>
  );
}

export default App;
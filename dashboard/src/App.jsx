import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LanguageProvider } from './contexts/LanguageContext';
import { BoatConfigProvider } from './contexts/BoatConfigContext';
import LoadingScreen from './components/LoadingScreen';
import Login from './pages/Login';
import MainLayout from './layout/MainLayout';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { user, isAuthenticated, loading, login: handleLogin, logout: handleLogout } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <LanguageProvider>
      <BoatConfigProvider>
        <Router basename="/dashboard" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />}
            />
            <Route
              path="/*"
              element={
                !isAuthenticated ? <Navigate to="/login" replace /> : <MainLayout user={user} onLogout={handleLogout} />
              }
            />
          </Routes>
          <Toaster position="top-right" />
        </Router>
      </BoatConfigProvider>
    </LanguageProvider>
  );
}

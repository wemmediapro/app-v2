import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';
import { LanguageProvider } from './contexts/LanguageContext';
import { BoatConfigProvider } from './contexts/BoatConfigContext';
import LoadingScreen from './components/LoadingScreen';
import Login from './pages/Login';
import MainLayout from './layout/MainLayout';
import { authService } from './services/authService';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService
      .getProfile()
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

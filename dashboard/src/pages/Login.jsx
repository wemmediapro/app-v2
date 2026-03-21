import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Ship, Eye, EyeOff, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';
import { useLanguage } from '../contexts/LanguageContext';

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configRequired, setConfigRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    if (errorMessage) setErrorMessage('');
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      const response = await authService.login(formData);

      if (response.data.user.role === 'admin') {
        onLogin(response.data.token, response.data.user);
        toast.success('Connexion réussie !');
        navigate('/dashboard', { replace: true });
      } else {
        const msg = 'Accès refusé. Privilèges administrateur requis.';
        setErrorMessage(msg);
        toast.error(msg);
      }
    } catch (error) {
      const isNetworkError =
        !error.response &&
        (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED' || error.message?.includes('Network Error'));
      if (isNetworkError) {
        const displayMsg = 'Serveur inaccessible. Démarrez le backend (dans backend/ : npm run dev).';
        setErrorMessage(displayMsg);
        toast.error(displayMsg);
        setConfigRequired(false);
        return;
      }
      const is503 = error.response?.status === 503;
      const msg = error.response?.data?.message || error.response?.data?.error || '';
      setConfigRequired(!!(import.meta.env.DEV && is503 && msg.includes('ADMIN_EMAIL')));
      const displayMsg = msg.trim() || "Erreur de connexion. Vérifiez l'email et le mot de passe.";
      setErrorMessage(displayMsg);
      toast.error(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-teal-50 flex items-center justify-center p-4 sm:p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 shadow-lg ring-4 ring-blue-100">
              <Ship size={32} className="text-white" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">GNV Dashboard</h1>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">Connexion administrateur</p>
        </div>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-xl p-6 sm:p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-5" aria-label={t('common.loginForm')}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800" role="alert">
                {errorMessage}
              </div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              aria-label={loading ? t('common.connecting') : t('common.signIn')}
              whileHover={loading ? undefined : { scale: 1.01 }}
              whileTap={loading ? undefined : { scale: 0.98 }}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-medium py-3.5 px-4 rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : (
                <>
                  <LogIn size={18} />
                  Se connecter
                </>
              )}
            </motion.button>
          </form>

          {/* Avertissement affiché seulement si le backend renvoie 503 (config manquante) */}
          {import.meta.env.DEV && configRequired && (
            <div className="mt-6 p-4 bg-amber-50/80 rounded-xl border border-amber-200">
              <h3 className="text-sm font-medium text-amber-900 mb-2">Configuration requise</h3>
              <p className="text-xs text-amber-800">
                Définissez ADMIN_EMAIL et ADMIN_PASSWORD dans backend/config.env, puis redémarrez le backend.
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default Login;

import { motion } from 'framer-motion';
import { Bell, ArrowLeft, Clock, RefreshCw } from 'lucide-react';

/**
 * Page Notifications de l'app passagers (extrait de App.jsx pour refactorisation).
 * Affiche la liste des notifications push avec chargement et état vide.
 */
export default function NotificationsPage({ notificationsList, notificationsLoading, t, language, onBack }) {
  return (
    <motion.div
      key="notifications"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-slate-50"
    >
      <div className="mx-auto w-full max-w-3xl px-3 sm:px-6 py-4 sm:py-8 space-y-6">
        <header className="space-y-4">
          <div
            className="rounded-2xl p-4 sm:p-5 shadow-md border border-blue-200/50"
            style={{ backgroundColor: '#264FFF' }}
          >
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white/20 border border-white/30 flex-shrink-0 backdrop-blur-sm">
                <Bell size={24} className="text-white sm:w-6 sm:h-6" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">{t('notifications.title')}</h1>
                <p className="text-sm text-blue-100 mt-0.5">{t('notifications.subtitle')}</p>
              </div>
              <button
                type="button"
                onClick={onBack}
                className="p-2 rounded-xl border border-white/30 text-white hover:bg-white/20 transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t('common.back')}
              >
                <ArrowLeft size={20} />
              </button>
            </div>
          </div>
        </header>

        <section className="space-y-3">
          {notificationsLoading ? (
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col items-center justify-center min-h-[240px] gap-3">
              <RefreshCw size={28} className="animate-spin text-slate-500" />
              <p className="text-sm text-slate-500">{t('notifications.loading')}</p>
            </div>
          ) : notificationsList.length === 0 ? (
            <div className="rounded-2xl bg-white border border-slate-200/80 px-4 py-12 text-center shadow-sm">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 mb-4">
                <Bell size={28} strokeWidth={1.5} />
              </div>
              <p className="text-slate-800 font-medium text-sm">{t('notifications.noNotifications')}</p>
              <p className="text-xs text-slate-500 mt-1.5">{t('notifications.pushFromAdmin')}</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {notificationsList.map((n, index) => (
                <motion.li
                  key={n._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-2xl bg-white border border-slate-200/80 p-4 sm:p-4 shadow-sm hover:shadow hover:border-slate-300/80 transition-all"
                >
                  <p className="font-semibold text-slate-900">{n.title || 'Sans titre'}</p>
                  {n.message ? <p className="text-sm text-slate-600 mt-1.5 leading-snug">{n.message}</p> : null}
                  {n.createdAt ? (
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                      <Clock size={12} />
                      {new Date(n.createdAt).toLocaleString(language === 'en' ? 'en-GB' : 'fr-FR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </p>
                  ) : null}
                </motion.li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </motion.div>
  );
}

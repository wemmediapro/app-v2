import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Utensils, 
  MessageSquare, 
  AlertCircle, 
  TrendingUp,
  TrendingDown,
  Activity,
  Radio,
  Clapperboard,
  BookOpen,
  Baby,
  ShoppingBag,
  Map,
  Eye,
  BarChart3,
  Wifi,
  Play,
  Server
} from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { apiService } from '../services/apiService';
import { useLanguage } from '../contexts/LanguageContext';

function formatTrend(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  if (num === 0) return '0%';
  return num > 0 ? `+${num}%` : `${num}%`;
}

const Dashboard = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState('overview');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [connectionsData, setConnectionsData] = useState(null);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [contentData, setContentData] = useState(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (loading) return;
    const fetchOverview = async () => {
      setAnalyticsLoading(true);
      try {
        const res = await apiService.getAnalyticsOverview();
        setAnalyticsData(res?.data ?? null);
      } catch {
        setAnalyticsData(null);
      } finally {
        setAnalyticsLoading(false);
      }
    };
    fetchOverview();
  }, [loading]);

  useEffect(() => {
    if (activeAnalyticsTab !== 'connections') return;
    const fetchConnections = async () => {
      setConnectionsLoading(true);
      try {
        const res = await apiService.getAnalyticsConnections();
        setConnectionsData(res?.data ?? null);
      } catch {
        setConnectionsData(null);
      } finally {
        setConnectionsLoading(false);
      }
    };
    fetchConnections();
  }, [activeAnalyticsTab]);

  useEffect(() => {
    if (activeAnalyticsTab !== 'content') return;
    const fetchContent = async () => {
      setContentLoading(true);
      try {
        const res = await apiService.getAnalyticsContent();
        setContentData(res?.data ?? null);
      } catch {
        setContentData(null);
      } finally {
        setContentLoading(false);
      }
    };
    fetchContent();
  }, [activeAnalyticsTab]);

  useEffect(() => {
    if (activeAnalyticsTab !== 'performance') return;
    const fetchPerformance = async () => {
      setPerformanceLoading(true);
      try {
        const res = await apiService.getAnalyticsPerformance();
        setPerformanceData(res?.data ?? null);
      } catch {
        setPerformanceData(null);
      } finally {
        setPerformanceLoading(false);
      }
    };
    fetchPerformance();
  }, [activeAnalyticsTab]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await apiService.getDashboardStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      setStats({
        statistics: { totalUsers: 0, activeUsers: 0, totalRestaurants: 0, totalMessages: 0, totalFeedback: 0, totalRadioStations: 0, totalViewers: 0, totalMovies: 0, totalArticles: 0, totalActivities: 0, totalProducts: 0 },
        charts: { feedbackByStatus: [], usersByRole: [] },
        recent: { users: [], feedback: [] }
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status" aria-live="polite" aria-label={t('common.loading') || 'Chargement'}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    { title: t('dashboard.users'), value: stats?.statistics?.totalUsers ?? 0, change: '—', changeType: 'neutral', icon: Users, color: 'blue' },
    { title: t('dashboard.viewers'), value: stats?.statistics?.totalViewers ?? 0, change: '—', changeType: 'neutral', icon: Eye, color: 'violet' },
    { title: t('dashboard.restaurants'), value: stats?.statistics?.totalRestaurants ?? 0, change: '—', changeType: 'neutral', icon: Utensils, color: 'green' },
    { title: t('dashboard.radioStations'), value: stats?.statistics?.totalRadioStations ?? 0, change: '—', changeType: 'neutral', icon: Radio, color: 'cyan' },
    { title: t('dashboard.moviesSeries'), value: stats?.statistics?.totalMovies ?? 0, change: '—', changeType: 'neutral', icon: Clapperboard, color: 'purple' },
    { title: t('dashboard.magazineArticles'), value: stats?.statistics?.totalArticles ?? 0, change: '—', changeType: 'neutral', icon: BookOpen, color: 'indigo' },
    { title: t('dashboard.kidsActivities'), value: stats?.statistics?.totalActivities ?? 0, change: '—', changeType: 'neutral', icon: Baby, color: 'pink' },
    { title: t('dashboard.shopProducts'), value: stats?.statistics?.totalProducts ?? 0, change: '—', changeType: 'neutral', icon: ShoppingBag, color: 'amber' },
    { title: t('dashboard.messages'), value: stats?.statistics?.totalMessages ?? 0, change: '—', changeType: 'neutral', icon: MessageSquare, color: 'emerald' },
    { title: t('navigation.feedback'), value: stats?.statistics?.totalFeedback ?? 0, change: '—', changeType: 'neutral', icon: AlertCircle, color: 'orange' }
  ];

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];

  const iconBg = {
    blue: 'bg-blue-50',
    violet: 'bg-violet-50',
    green: 'bg-emerald-50',
    cyan: 'bg-cyan-50',
    purple: 'bg-purple-50',
    indigo: 'bg-indigo-50',
    pink: 'bg-pink-50',
    amber: 'bg-amber-50',
    emerald: 'bg-emerald-50',
    orange: 'bg-orange-50'
  };
  const iconColor = {
    blue: 'text-blue-600',
    violet: 'text-violet-600',
    green: 'text-emerald-600',
    cyan: 'text-cyan-600',
    purple: 'text-purple-600',
    indigo: 'text-indigo-600',
    pink: 'text-pink-600',
    amber: 'text-amber-600',
    emerald: 'text-emerald-600',
    orange: 'text-orange-600'
  };

  return (
    <div className="min-w-0 w-full space-y-8 pb-8">
      {/* En-tête de page */}
      <header className="pt-1">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('dashboard.title')}</h1>
        <p className="mt-1.5 text-sm text-gray-500 max-w-xl">{t('dashboard.overviewSubtitle')}</p>
      </header>

      {/* Bloc indicateurs — grille responsive */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="text-sm font-semibold text-gray-700 mb-4">
          {t('dashboard.title')} — indicateurs
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {statCards.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.3) }}
                className="bg-white rounded-xl border border-gray-200/80 p-4 shadow-sm hover:shadow-md hover:border-gray-300/80 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{stat.title}</p>
                    <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {stat.changeType === 'positive' && <TrendingUp size={14} className="text-emerald-500 flex-shrink-0" aria-hidden />}
                      {stat.changeType === 'negative' && <TrendingDown size={14} className="text-red-500 flex-shrink-0" aria-hidden />}
                      <span className={`text-xs font-medium ${stat.changeType === 'positive' ? 'text-emerald-600' : stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-500'}`}>
                        {stat.change}
                      </span>
                      <span className="text-xs text-gray-400">{t('common.vsLastMonth')}</span>
                    </div>
                  </div>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg[stat.color]}`}>
                    <Icon size={20} className={iconColor[stat.color]} aria-hidden />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Vue d’ensemble : graphique + utilisateurs récents */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6" aria-labelledby="overview-heading">
        <h2 id="overview-heading" className="sr-only">
          Vue d’ensemble
        </h2>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.1 }}
          className="xl:col-span-2 bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm"
        >
          <h3 className="text-base font-semibold text-gray-900 mb-4">{t('dashboard.usersByRole')}</h3>
          <div className="h-[280px]">
            {(stats?.charts?.usersByRole || []).length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.charts?.usersByRole || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ _id, percent }) => `${_id} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {(stats?.charts?.usersByRole || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500 text-center py-6">Aucune donnée disponible.</p>
            )}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: 0.15 }}
          className="bg-white rounded-xl border border-gray-200/80 p-6 shadow-sm flex flex-col"
        >
          <h3 className="text-base font-semibold text-gray-900 mb-4">{t('dashboard.recentUsers')}</h3>
          <ul className="space-y-2 flex-1 min-h-0 overflow-y-auto">
            {(stats?.recent?.users || []).length > 0 ? (
              (stats?.recent?.users || []).map((user, index) => (
                <li
                  key={user._id || index}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-gray-50/90 hover:bg-gray-100/90 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100">
                    <Users size={16} className="text-blue-600" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{new Date(user.createdAt).toLocaleDateString()}</span>
                </li>
              ))
            ) : (
              <li className="py-8 text-center text-sm text-gray-500">Aucun utilisateur récent.</li>
            )}
          </ul>
        </motion.div>
      </section>

      {/* Section Analytics */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, delay: 0.2 }}
        className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden"
        aria-labelledby="analytics-heading"
      >
        <div className="border-b border-gray-100">
          <div className="px-6 pt-5 pb-1">
            <h2 id="analytics-heading" className="text-lg font-semibold text-gray-900">{t('analytics.title') || 'Analytics'}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('analytics.subtitle') || 'Statistiques détaillées sur les connexions et le contenu'}</p>
          </div>
          <nav className="flex flex-wrap gap-1 px-6 pt-2" aria-label="Onglets Analytics">
            {[
              { id: 'overview', label: t('analytics.overview') || 'Vue d\'ensemble', icon: BarChart3 },
              { id: 'connections', label: t('analytics.connections') || 'Connexions', icon: Wifi },
              { id: 'content', label: t('analytics.content') || 'Contenu', icon: Play },
              { id: 'performance', label: t('analytics.performance') || 'Performance', icon: Activity }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeAnalyticsTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveAnalyticsTab(tab.id)}
                  className={`inline-flex items-center gap-2 py-3 px-4 rounded-t-lg text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50/80'
                  }`}
                  aria-selected={isActive}
                  aria-controls="analytics-panel"
                  id={`tab-${tab.id}`}
                >
                  <Icon size={18} aria-hidden />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div id="analytics-panel" className="p-6 bg-gray-50/30" role="tabpanel" aria-labelledby={`tab-${activeAnalyticsTab}`}>
          {activeAnalyticsTab === 'overview' && (
            <>
              {analyticsLoading ? (
                <div className="flex items-center justify-center min-h-[240px]" aria-label={t('common.loading') || 'Chargement'}>
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600" />
                </div>
              ) : analyticsData?.summary ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { key: 'totalUsers', label: t('analytics.totalUsers') || 'Utilisateurs totaux', value: (analyticsData.summary.totalUsers ?? 0).toLocaleString(), Icon: Users, bg: 'bg-blue-50', color: 'text-blue-600' },
                      { key: 'activeUsers', label: t('analytics.activeUsers') || 'Utilisateurs actifs', value: analyticsData.summary.activeUsers ?? 0, Icon: Activity, bg: 'bg-green-50', color: 'text-green-600' },
                      { key: 'totalContent', label: t('analytics.totalContent') || 'Contenu total', value: (analyticsData.summary.totalContent ?? 0).toLocaleString(), Icon: Play, bg: 'bg-purple-50', color: 'text-purple-600' },
                      { key: 'systemUptime', label: t('analytics.systemUptime') || 'Uptime système', value: `${analyticsData.summary.systemUptime ?? 0}%`, Icon: Server, bg: 'bg-orange-50', color: 'text-orange-600' }
                    ].map(({ key, label, value, Icon, bg, color }) => (
                      <div key={key} className="bg-white rounded-xl border border-gray-200/80 p-5 flex items-center justify-between shadow-sm">
                        <div>
                          <p className="text-sm font-medium text-gray-600">{label}</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
                        </div>
                        <div className={`p-3 rounded-xl ${bg}`}>
                          <Icon size={24} className={color} aria-hidden />
                        </div>
                      </div>
                    ))}
                  </div>

                  {analyticsData.trends && (
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-sm">
                      <h3 className="text-base font-semibold text-gray-900 mb-4">{t('analytics.trends') || 'Tendances'}</h3>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="text-center p-3 rounded-lg bg-gray-50/80">
                          <p className="text-sm text-gray-600">{t('analytics.userGrowth') || 'Croissance utilisateurs'}</p>
                          <p className="mt-1 text-xl font-bold text-green-600">{formatTrend(analyticsData.trends.userGrowth)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-gray-50/80">
                          <p className="text-sm text-gray-600">{t('analytics.contentGrowth') || 'Croissance contenu'}</p>
                          <p className="mt-1 text-xl font-bold text-blue-600">{formatTrend(analyticsData.trends.contentGrowth)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-gray-50/80">
                          <p className="text-sm text-gray-600">{t('analytics.engagement') || 'Engagement'}</p>
                          <p className="mt-1 text-xl font-bold text-purple-600">{formatTrend(analyticsData.trends.engagementGrowth)}</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-gray-50/80">
                          <p className="text-sm text-gray-600">{t('analytics.performanceLabel') || 'Performance'}</p>
                          <p className="mt-1 text-xl font-bold text-orange-600">{formatTrend(analyticsData.trends.performanceImprovement)}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {analyticsData.alerts && analyticsData.alerts.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-semibold text-gray-900">{t('analytics.recentAlerts') || 'Alertes récentes'}</h3>
                        <button
                          type="button"
                          onClick={() => setAnalyticsData((prev) => (prev ? { ...prev, alerts: [] } : null))}
                          className="text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {t('analytics.clearAlerts') || 'Vider'}
                        </button>
                      </div>
                      <div className="space-y-3">
                        {analyticsData.alerts.map((alert, index) => (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border-l-4 ${
                              alert.type === 'warning' ? 'bg-amber-50/90 border-amber-500' :
                              alert.type === 'error' ? 'bg-red-50/90 border-red-500' :
                              alert.type === 'success' ? 'bg-green-50/90 border-green-500' :
                              'bg-blue-50/90 border-blue-500'
                            }`}
                          >
                            <p className="text-sm font-medium text-gray-800">{alert.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {alert.timestamp ? new Date(alert.timestamp).toLocaleString('fr-FR') : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-12 text-center">{t('analytics.noOverviewData') || 'Aucune donnée d\'aperçu disponible.'}</p>
              )}
            </>
          )}
          {activeAnalyticsTab === 'connections' && (
            <>
              {connectionsLoading ? (
                <div className="flex items-center justify-center min-h-[240px]" aria-label={t('common.loading') || 'Chargement'}>
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600" />
                </div>
              ) : connectionsData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t('analytics.totalConnections') || 'Connexions totales'}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{(connectionsData.totalConnections ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50"><Wifi size={24} className="text-blue-600" aria-hidden /></div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t('analytics.activeConnections') || 'Connexions actives'}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{(connectionsData.activeConnections ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-green-50"><Activity size={24} className="text-green-600" aria-hidden /></div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t('analytics.peakConnections') || 'Pic de connexions'}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{(connectionsData.peakConnections ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50"><BarChart3 size={24} className="text-amber-600" aria-hidden /></div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t('analytics.averageSessionDuration') || 'Durée moyenne session'}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{connectionsData.averageSessionDuration != null ? `${connectionsData.averageSessionDuration} min` : '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-purple-50"><Activity size={24} className="text-purple-600" aria-hidden /></div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    {t('analytics.connectionsHelp') || 'Les connexions actives correspondent aux clients Socket.io connectés à cette instance du serveur.'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-12 text-center">{t('analytics.noConnectionsData') || 'Aucune donnée de connexions disponible.'}</p>
              )}
            </>
          )}

          {activeAnalyticsTab === 'content' && (
            <>
              {contentLoading ? (
                <div className="flex items-center justify-center min-h-[240px]" aria-label={t('common.loading') || 'Chargement'}>
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600" />
                </div>
              ) : contentData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t('analytics.totalContent') || 'Contenu total'}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{(contentData.totalContent ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-purple-50"><Play size={24} className="text-purple-600" aria-hidden /></div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t('dashboard.viewers') || 'Spectateurs WebTV'}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{(contentData.totalViewers ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-violet-50"><Eye size={24} className="text-violet-600" aria-hidden /></div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-sm">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">{t('analytics.contentByType') || 'Contenu par type'}</h3>
                    {(contentData.contentTypes && contentData.contentTypes.length > 0) ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-200 text-left text-gray-600">
                              <th className="py-3 px-2 font-medium">{t('analytics.type') || 'Type'}</th>
                              <th className="py-3 px-2 font-medium text-right">{t('analytics.count') || 'Nombre'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contentData.contentTypes.map((row, idx) => (
                              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                                <td className="py-3 px-2 text-gray-900">{row.type}</td>
                                <td className="py-3 px-2 text-right font-medium tabular-nums">{row.count.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 py-4">{t('analytics.noContentByType') || 'Aucun contenu pour le moment.'}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-12 text-center">{t('analytics.noContentData') || 'Aucune donnée de contenu disponible.'}</p>
              )}
            </>
          )}

          {activeAnalyticsTab === 'performance' && (
            <>
              {performanceLoading ? (
                <div className="flex items-center justify-center min-h-[240px]" aria-label={t('common.loading') || 'Chargement'}>
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600" />
                </div>
              ) : performanceData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t('analytics.systemUptime') || 'Uptime système'}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{performanceData.uptime != null ? `${performanceData.uptime}%` : '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-green-50"><Server size={24} className="text-green-600" aria-hidden /></div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t('analytics.serverResponseTime') || 'Temps de réponse serveur'}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{performanceData.serverResponseTime != null ? `${performanceData.serverResponseTime} ms` : '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-blue-50"><Activity size={24} className="text-blue-600" aria-hidden /></div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t('analytics.errorRate') || 'Taux d\'erreur'}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{performanceData.errorRate != null ? `${performanceData.errorRate}%` : '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-amber-50"><AlertCircle size={24} className="text-amber-600" aria-hidden /></div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200/80 p-5 flex items-center justify-between shadow-sm">
                      <div>
                        <p className="text-sm font-medium text-gray-600">{t('analytics.cacheHitRate') || 'Taux de cache'}</p>
                        <p className="mt-1 text-2xl font-bold text-gray-900">{performanceData.cacheHitRate != null ? `${performanceData.cacheHitRate}%` : '—'}</p>
                      </div>
                      <div className="p-3 rounded-xl bg-indigo-50"><BarChart3 size={24} className="text-indigo-600" aria-hidden /></div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    {t('analytics.performanceHelp') || 'L\'uptime est calculé depuis le dernier redémarrage du serveur. Les autres métriques seront disponibles lorsque le monitoring sera configuré.'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-12 text-center">{t('analytics.noPerformanceData') || 'Aucune donnée de performance disponible.'}</p>
              )}
            </>
          )}
        </div>
      </motion.section>
    </div>
  );
};

export default Dashboard;



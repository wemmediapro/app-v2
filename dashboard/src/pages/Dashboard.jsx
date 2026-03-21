import { useDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useLanguage } from '../contexts/LanguageContext';
import { buildDashboardStatCards } from '../components/dashboard/buildDashboardStatCards';
import DashboardStatGrid from '../components/dashboard/DashboardStatGrid';
import DashboardHomeOverview from '../components/dashboard/DashboardHomeOverview';
import DashboardAnalyticsSection from '../components/dashboard/DashboardAnalyticsSection';

const Dashboard = () => {
  const { t } = useLanguage();
  const { stats, loading } = useDashboardStats();
  const {
    activeAnalyticsTab,
    setActiveAnalyticsTab,
    analyticsData,
    setAnalyticsData,
    analyticsLoading,
    connectionsData,
    connectionsLoading,
    contentData,
    contentLoading,
    performanceData,
    performanceLoading,
  } = useDashboardAnalytics(loading);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-64"
        role="status"
        aria-live="polite"
        aria-label={t('common.loading') || 'Chargement'}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = buildDashboardStatCards(t, stats);

  return (
    <div className="min-w-0 w-full space-y-8 pb-8">
      <header className="pt-1">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('dashboard.title')}</h1>
        <p className="mt-1.5 text-sm text-gray-500 max-w-xl">{t('dashboard.overviewSubtitle')}</p>
      </header>

      <DashboardStatGrid
        statCards={statCards}
        sectionHeading={`${t('dashboard.title')} — indicateurs`}
        vsLastMonthLabel={t('common.vsLastMonth')}
      />

      <DashboardHomeOverview
        stats={stats}
        usersByRoleTitle={t('dashboard.usersByRole')}
        recentUsersTitle={t('dashboard.recentUsers')}
      />

      <DashboardAnalyticsSection
        t={t}
        activeAnalyticsTab={activeAnalyticsTab}
        setActiveAnalyticsTab={setActiveAnalyticsTab}
        analyticsData={analyticsData}
        setAnalyticsData={setAnalyticsData}
        analyticsLoading={analyticsLoading}
        connectionsData={connectionsData}
        connectionsLoading={connectionsLoading}
        contentData={contentData}
        contentLoading={contentLoading}
        performanceData={performanceData}
        performanceLoading={performanceLoading}
      />
    </div>
  );
};

export default Dashboard;

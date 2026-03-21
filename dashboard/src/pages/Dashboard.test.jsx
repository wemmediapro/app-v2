import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageProvider } from '../contexts/LanguageContext';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { useDashboardAnalytics } from '../hooks/useDashboardAnalytics';
import Dashboard from './Dashboard';

vi.mock('../hooks/useDashboardStats');
vi.mock('../hooks/useDashboardAnalytics');

function sampleStats() {
  return {
    statistics: {
      totalUsers: 3,
      activeUsers: 2,
      totalRestaurants: 1,
      totalMessages: 0,
      totalFeedback: 0,
      totalRadioStations: 0,
      totalViewers: 10,
      totalMovies: 0,
      totalArticles: 0,
      totalActivities: 0,
      totalProducts: 0,
    },
    charts: { feedbackByStatus: [], usersByRole: [] },
    recent: { users: [], feedback: [] },
  };
}

function analyticsMock(overrides = {}) {
  return {
    activeAnalyticsTab: 'overview',
    setActiveAnalyticsTab: vi.fn(),
    analyticsData: null,
    setAnalyticsData: vi.fn(),
    analyticsLoading: false,
    connectionsData: null,
    connectionsLoading: false,
    contentData: null,
    contentLoading: false,
    performanceData: null,
    performanceLoading: false,
    ...overrides,
  };
}

function renderDashboard() {
  return render(
    <LanguageProvider>
      <Dashboard />
    </LanguageProvider>
  );
}

describe('Dashboard (page)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le chargement tant que les stats ne sont pas prêtes', () => {
    vi.mocked(useDashboardStats).mockReturnValue({
      stats: null,
      loading: true,
      refetch: vi.fn(),
    });
    vi.mocked(useDashboardAnalytics).mockReturnValue(analyticsMock());

    renderDashboard();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('affiche le titre, les indicateurs et la section Analytics', () => {
    vi.mocked(useDashboardStats).mockReturnValue({
      stats: sampleStats(),
      loading: false,
      refetch: vi.fn(),
    });
    vi.mocked(useDashboardAnalytics).mockReturnValue(analyticsMock());

    renderDashboard();

    expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeInTheDocument();
    expect(screen.getByText("Vue d'ensemble de l'activité GNV Excelsior")).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tableau de bord — indicateurs' })).toBeInTheDocument();
    expect(screen.getByText('Utilisateurs', { exact: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
  });

  it('change d’onglet analytics via setActiveAnalyticsTab', () => {
    const setActiveAnalyticsTab = vi.fn();
    vi.mocked(useDashboardStats).mockReturnValue({
      stats: sampleStats(),
      loading: false,
      refetch: vi.fn(),
    });
    vi.mocked(useDashboardAnalytics).mockReturnValue(analyticsMock({ setActiveAnalyticsTab }));

    renderDashboard();
    fireEvent.click(screen.getByRole('tab', { name: /Connexions/i }));
    expect(setActiveAnalyticsTab).toHaveBeenLastCalledWith('connections');

    fireEvent.click(screen.getByRole('tab', { name: /^Contenu$/i }));
    expect(setActiveAnalyticsTab).toHaveBeenLastCalledWith('content');

    fireEvent.click(screen.getByRole('tab', { name: /^Performance$/i }));
    expect(setActiveAnalyticsTab).toHaveBeenLastCalledWith('performance');
  });
});

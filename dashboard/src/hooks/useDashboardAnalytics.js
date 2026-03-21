import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

/**
 * Données des onglets analytics (aperçu, connexions, contenu, performance) après chargement des stats principales.
 * @param {boolean} mainStatsLoading - tant que true, l’aperçu analytics n’est pas chargé
 */
export function useDashboardAnalytics(mainStatsLoading) {
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
    if (mainStatsLoading) return;
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
    void fetchOverview();
  }, [mainStatsLoading]);

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
    void fetchConnections();
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
    void fetchContent();
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
    void fetchPerformance();
  }, [activeAnalyticsTab]);

  return {
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
  };
}

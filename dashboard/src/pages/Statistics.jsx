import { useState, useMemo, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Radio,
  Clapperboard,
  Tv,
  BookOpen,
  Image,
  Megaphone,
  Calendar,
  TrendingUp,
  BarChart3,
  Clock,
  SlidersHorizontal,
  LayoutGrid,
  Users,
  Activity,
  Server,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { apiService } from '../services/apiService';

const PERIODS = [
  { value: 1, labelKey: 'statisticsPage.period24h' },
  { value: 7, labelKey: 'statisticsPage.period7' },
  { value: 14, labelKey: 'statisticsPage.period14' },
  { value: 30, labelKey: 'statisticsPage.period30' },
  { value: 'custom', labelKey: 'statisticsPage.periodCustom' },
];

const VIEW_MODES = [
  { value: 'full', labelKey: 'statisticsPage.viewFull', showDaily: true, showHourly: true },
  { value: 'daily', labelKey: 'statisticsPage.viewDailyOnly', showDaily: true, showHourly: false },
  { value: 'hourly', labelKey: 'statisticsPage.viewHourlyOnly', showDaily: false, showHourly: true },
];

const MODULE_IDS = ['radio', 'videos', 'webtv', 'magazine', 'banners', 'ads'];
const DEFAULT_MODULES = Object.fromEntries(MODULE_IDS.map((id) => [id, true]));

/** Génère des données cohérentes pour un nombre de jours donné (seed pour reproductibilité) */
function buildDailyData(days) {
  const data = [];
  const seed = 42;
  const mul = (a, b) => ((a * b) % 997) + 1;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayLabel = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    const j = days - 1 - i;
    data.push({
      date: d.toISOString().slice(0, 10),
      dayLabel,
      radio: 18 + (mul(seed, j + 1) % 50) + Math.floor((j / Math.max(days, 1)) * 25),
      videos: 12 + (mul(seed + 1, j + 2) % 60) + Math.floor((j / Math.max(days, 1)) * 20),
      webtv: 8 + (mul(seed + 2, j + 3) % 40) + Math.floor((j / Math.max(days, 1)) * 15),
      magazine: 5 + (mul(seed + 3, j + 4) % 35) + Math.floor((j / Math.max(days, 1)) * 12),
      banners: 120 + (mul(seed + 4, j + 5) % 180) + Math.floor((j / Math.max(days, 1)) * 50),
      ads: 80 + (mul(seed + 5, j + 6) % 120) + Math.floor((j / Math.max(days, 1)) * 40),
      bannersClicks: 4 + (mul(seed + 6, j + 7) % 18) + Math.floor((j / Math.max(days, 1)) * 5),
      adsClicks: 6 + (mul(seed + 7, j + 8) % 22) + Math.floor((j / Math.max(days, 1)) * 6),
    });
  }
  return data;
}

/** Données par jour entre date début et date fin (inclus) */
function buildDailyDataFromRange(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return buildDailyData(7);
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return buildDailyData(7);
  const data = [];
  const seed = 42;
  const mul = (a, b) => ((a * b) % 997) + 1;
  const totalDays = Math.ceil((end - start) / (24 * 60 * 60 * 1000)) + 1;
  const maxDays = 365;
  const days = Math.min(totalDays, maxDays);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    if (d > end) break;
    const dayLabel = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    const j = i;
    data.push({
      date: d.toISOString().slice(0, 10),
      dayLabel,
      radio: 18 + (mul(seed, j + 1) % 50) + Math.floor((j / Math.max(days, 1)) * 25),
      videos: 12 + (mul(seed + 1, j + 2) % 60) + Math.floor((j / Math.max(days, 1)) * 20),
      webtv: 8 + (mul(seed + 2, j + 3) % 40) + Math.floor((j / Math.max(days, 1)) * 15),
      magazine: 5 + (mul(seed + 3, j + 4) % 35) + Math.floor((j / Math.max(days, 1)) * 12),
      banners: 120 + (mul(seed + 4, j + 5) % 180) + Math.floor((j / Math.max(days, 1)) * 50),
      ads: 80 + (mul(seed + 5, j + 6) % 120) + Math.floor((j / Math.max(days, 1)) * 40),
      bannersClicks: 4 + (mul(seed + 6, j + 7) % 18) + Math.floor((j / Math.max(days, 1)) * 5),
      adsClicks: 6 + (mul(seed + 7, j + 8) % 22) + Math.floor((j / Math.max(days, 1)) * 6),
    });
  }
  return data.length ? data : buildDailyData(7);
}

/** Courbe type journée : creux nuit (0-5h), montée (6-11h), plateau (12-17h), pic soir (18-21h), baisse (22-23h) */
function hourlyCurve(hour, peakAt = 21, base = 5, peakVal = 100) {
  if (hour <= 5) return base + Math.floor(hour * 0.8);
  if (hour <= 11) return Math.round(base + 4 + ((hour - 5) / 6) * (peakVal * 0.5 - base - 4));
  if (hour <= 17) return Math.round(base + (peakVal - base) * (0.5 + ((hour - 11) / 18) * 0.35));
  if (hour <= 21) {
    const distFromPeak = Math.abs(hour - peakAt);
    return Math.round(base + (peakVal - base) * (0.85 + 0.15 * (1 - distFromPeak / 3)));
  }
  return Math.round(base + (peakVal - base) * (0.6 - (hour - 21) * 0.15));
}

/** Données statiques par heure (0–23) pour analyse du pic dans la journée */
function buildHourlyData() {
  const data = [];
  for (let h = 0; h < 24; h++) {
    const hourLabel = `${String(h).padStart(2, '0')}h`;
    data.push({
      hour: h,
      hourLabel,
      radio: hourlyCurve(h, 20, 3, 72),
      videos: hourlyCurve(h, 21, 2, 95),
      webtv: hourlyCurve(h, 21, 1, 58),
      magazine: hourlyCurve(h, 19, 0, 42),
      banners: hourlyCurve(h, 20, 20, 180),
      ads: hourlyCurve(h, 21, 15, 120),
    });
  }
  return data;
}

const HOURLY_DATA = buildHourlyData();

/** Pic d'utilisation dans la journée (heure + valeur) */
function computeHourlyPeak(dataKey) {
  const row = HOURLY_DATA.reduce((best, r) => ((r[dataKey] || 0) > (best[dataKey] || 0) ? r : best), HOURLY_DATA[0]);
  return { peakHour: row.hour, peakHourLabel: row.hourLabel, peakHourValue: row[dataKey] || 0 };
}

/** Calcule totaux et KPIs à partir des données quotidiennes */
function computeKPIs(dailyData, dataKey, clicksKey = null) {
  if (!dailyData || dailyData.length === 0) {
    return { total: 0, avgPerDay: 0, peak: 0, peakDate: null, growth: 0, totalClicks: 0, ctr: 0 };
  }
  const total = dailyData.reduce((s, r) => s + (r[dataKey] || 0), 0);
  const avgPerDay = Math.round(total / dailyData.length);
  const peakRow = dailyData.reduce((best, r) => ((r[dataKey] || 0) > (best[dataKey] || 0) ? r : best), dailyData[0]);
  const peak = peakRow[dataKey] || 0;
  const peakDate = peakRow.date;
  const half = Math.floor(dailyData.length / 2);
  const firstHalf = dailyData.slice(0, half).reduce((s, r) => s + (r[dataKey] || 0), 0);
  const secondHalf = dailyData.slice(half).reduce((s, r) => s + (r[dataKey] || 0), 0);
  const growth =
    firstHalf === 0 ? (secondHalf > 0 ? 100 : 0) : Math.round(((secondHalf - firstHalf) / firstHalf) * 1000) / 10;
  let totalClicks = 0;
  if (clicksKey && dailyData[0][clicksKey] != null) {
    totalClicks = dailyData.reduce((s, r) => s + (r[clicksKey] || 0), 0);
  }
  const ctr = total > 0 && totalClicks > 0 ? Math.round((totalClicks / total) * 10000) / 100 : 0;
  return { total, avgPerDay, peak, peakDate, growth, totalClicks, ctr };
}

const COLORS = {
  radio: { stroke: '#3B82F6', fill: 'rgba(59, 130, 246, 0.2)' },
  videos: { stroke: '#8B5CF6', fill: 'rgba(139, 92, 246, 0.2)' },
  webtv: { stroke: '#059669', fill: 'rgba(5, 150, 105, 0.2)' },
  magazine: { stroke: '#D97706', fill: 'rgba(217, 119, 6, 0.2)' },
  banners: { stroke: '#0EA5E9', fill: 'rgba(14, 165, 233, 0.2)' },
  ads: { stroke: '#EC4899', fill: 'rgba(236, 72, 153, 0.2)' },
};

function KpiCard({ label, value, subValue, icon: Icon, iconBg, iconColor }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200/80 p-4 flex items-center justify-between shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{value}</p>
        {subValue != null && <p className="text-xs text-gray-500 mt-0.5">{subValue}</p>}
      </div>
      {Icon && (
        <div className={`p-2.5 rounded-lg ${iconBg || 'bg-gray-100'}`}>
          <Icon size={20} className={iconColor || 'text-gray-600'} aria-hidden />
        </div>
      )}
    </div>
  );
}

function SectionChart({ data, dataKey, color, t }) {
  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} stroke="#6b7280" />
          <YAxis tick={{ fontSize: 11 }} stroke="#6b7280" />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            labelFormatter={(_, payload) =>
              payload?.[0]?.payload?.date && new Date(payload[0].payload.date).toLocaleDateString('fr-FR')
            }
            formatter={(value) => [t('statisticsPage.usersPerDay') || 'Utilisateurs/jour', value]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color.stroke}
            fill={color.fill}
            strokeWidth={2}
            name={t('statisticsPage.users') || 'Utilisateurs'}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Couleur de remplissage des barres (non-pic) : version plus visible que l'area fill */
function barFillFromStroke(stroke) {
  const hex = stroke.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},0.45)`;
}

/** Graphique par heure : pic d'utilisation dans la journée (24 barres, heure de pic mise en avant) */
function HourlyChart({ dataKey, color, peakHour, t }) {
  const barFill = barFillFromStroke(color.stroke);
  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={HOURLY_DATA} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="hourLabel" tick={{ fontSize: 10 }} stroke="#6b7280" interval={1} />
          <YAxis tick={{ fontSize: 10 }} stroke="#6b7280" />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value) => [t('statisticsPage.usage') || 'Utilisation', value]}
            labelFormatter={(label) => `${t('statisticsPage.hour') || 'Heure'} ${label}`}
          />
          <Bar dataKey={dataKey} radius={[2, 2, 0, 0]} name={t('statisticsPage.usage') || 'Utilisation'}>
            {HOURLY_DATA.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.hour === peakHour ? color.stroke : barFill}
                stroke={entry.hour === peakHour ? color.stroke : 'transparent'}
                strokeWidth={entry.hour === peakHour ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDateInput(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const defaultRangeEnd = new Date();
const defaultRangeStart = new Date();
defaultRangeStart.setDate(defaultRangeStart.getDate() - 6);

const Statistics = () => {
  const { t } = useLanguage();
  const [period, setPeriod] = useState(14);
  const [dateRangeStart, setDateRangeStart] = useState(() => formatDateInput(defaultRangeStart));
  const [dateRangeEnd, setDateRangeEnd] = useState(() => formatDateInput(defaultRangeEnd));
  const [viewMode, setViewMode] = useState('full');
  const [selectedModules, setSelectedModules] = useState(() => ({ ...DEFAULT_MODULES }));
  const [realOverview, setRealOverview] = useState(null);
  const [realContent, setRealContent] = useState(null);
  const [realConnections, setRealConnections] = useState(null);
  const [realLoading, setRealLoading] = useState(true);
  const [realError, setRealError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRealLoading(true);
      setRealError(null);
      try {
        const [overview, content, connections] = await Promise.all([
          apiService.getAnalyticsOverview(),
          apiService.getAnalyticsContent(),
          apiService.getAnalyticsConnections(),
        ]);
        if (!cancelled) {
          setRealOverview(overview?.data ?? overview);
          setRealContent(content?.data ?? content);
          setRealConnections(connections?.data ?? connections);
        }
      } catch (e) {
        if (!cancelled) setRealError(e?.message || 'Erreur chargement analytics');
      } finally {
        if (!cancelled) setRealLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const viewModeConfig = useMemo(() => VIEW_MODES.find((m) => m.value === viewMode) || VIEW_MODES[0], [viewMode]);

  const toggleModule = (id) => {
    setSelectedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };
  const selectAllModules = () => {
    setSelectedModules({ ...DEFAULT_MODULES });
  };
  const hasModuleFilter = !MODULE_IDS.every((id) => selectedModules[id]);

  const dailyData = useMemo(() => {
    if (period === 'custom') return buildDailyDataFromRange(dateRangeStart, dateRangeEnd);
    return buildDailyData(period);
  }, [period, dateRangeStart, dateRangeEnd]);

  const kpis = useMemo(
    () => ({
      radio: computeKPIs(dailyData, 'radio'),
      videos: computeKPIs(dailyData, 'videos'),
      webtv: computeKPIs(dailyData, 'webtv'),
      magazine: computeKPIs(dailyData, 'magazine'),
      banners: computeKPIs(dailyData, 'banners', 'bannersClicks'),
      ads: computeKPIs(dailyData, 'ads', 'adsClicks'),
    }),
    [dailyData]
  );

  const hourlyPeaks = useMemo(
    () => ({
      radio: computeHourlyPeak('radio'),
      videos: computeHourlyPeak('videos'),
      webtv: computeHourlyPeak('webtv'),
      magazine: computeHourlyPeak('magazine'),
      banners: computeHourlyPeak('banners'),
      ads: computeHourlyPeak('ads'),
    }),
    []
  );

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—');

  const realCounts = useMemo(() => {
    const c = realContent?.contentTypes || [];
    const byType = (type) => c.find((x) => x.type === type)?.count ?? 0;
    return {
      radio: byType('Stations radio'),
      videos: byType('Films & séries'),
      webtv: Number(realContent?.totalViewers) || 0,
      magazine: byType('Articles magazine'),
      banners: null,
      ads: null,
    };
  }, [realContent]);

  const moduleLabels = {
    radio: t('statisticsPage.radio') || 'Radio',
    videos: t('statisticsPage.videos') || 'Vidéos',
    webtv: t('statisticsPage.webtv') || 'WebTV',
    magazine: t('statisticsPage.magazine') || 'Magazine',
    banners: t('statisticsPage.banners') || 'Bannières',
    ads: t('statisticsPage.ads') || 'Publicités',
  };

  return (
    <div className="min-w-0 w-full space-y-6 pb-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          {t('statisticsPage.title') || "Statistiques d'usage"}
        </h1>
        <p className="mt-1 text-sm text-gray-500 max-w-xl">
          {t('statisticsPage.subtitle') || 'Chiffres et courbes par module avec filtres de période.'}
        </p>
      </header>

      {/* Vue d'ensemble (données réelles API) */}
      <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Activity size={16} aria-hidden />
          {t('statisticsPage.realOverview') || "Vue d'ensemble (données réelles)"}
        </h2>
        {realLoading && <p className="text-sm text-gray-500 py-4">{t('statisticsPage.loading') || 'Chargement…'}</p>}
        {realError && <p className="text-sm text-amber-600 py-2">{realError}</p>}
        {!realLoading && !realError && (realOverview || realConnections) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {realOverview?.summary && (
              <>
                <KpiCard
                  label={t('statisticsPage.totalUsers') || 'Utilisateurs'}
                  value={realOverview.summary.totalUsers ?? '—'}
                  icon={Users}
                  iconBg="bg-blue-50"
                  iconColor="text-blue-600"
                />
                <KpiCard
                  label={t('statisticsPage.activeUsers') || 'Utilisateurs actifs'}
                  value={realOverview.summary.activeUsers ?? '—'}
                  icon={Activity}
                  iconBg="bg-emerald-50"
                  iconColor="text-emerald-600"
                />
                <KpiCard
                  label={t('statisticsPage.totalContent') || 'Contenu total'}
                  value={realOverview.summary.totalContent ?? '—'}
                  subValue={t('statisticsPage.items') || 'éléments'}
                  icon={LayoutGrid}
                  iconBg="bg-violet-50"
                  iconColor="text-violet-600"
                />
              </>
            )}
            {realConnections && (
              <KpiCard
                label={t('statisticsPage.activeConnections') || 'Connexions actives'}
                value={realConnections.activeConnections ?? realConnections.totalConnections ?? '—'}
                icon={Activity}
                iconBg="bg-cyan-50"
                iconColor="text-cyan-600"
              />
            )}
            {realOverview?.summary?.systemUptime != null && (
              <KpiCard
                label={t('statisticsPage.uptime') || 'Disponibilité'}
                value={`${Math.round(realOverview.summary.systemUptime)}%`}
                icon={Server}
                iconBg="bg-gray-100"
                iconColor="text-gray-600"
              />
            )}
          </div>
        )}
      </section>

      {/* Barre de filtres */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <SlidersHorizontal size={18} className="text-gray-500 shrink-0" aria-hidden />
          {t('statisticsPage.filters') || 'Filtres'}
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <Calendar size={14} aria-hidden />
              {t('statisticsPage.period') || 'Période'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-gray-200 bg-gray-50/80 p-0.5">
                {PERIODS.map((p) => (
                  <button
                    key={String(p.value)}
                    type="button"
                    onClick={() => setPeriod(p.value)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      period === p.value ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {p.value === 1
                      ? t('statisticsPage.period24h')
                      : p.value === 'custom'
                        ? t(p.labelKey)
                        : `${p.value} ${t('statisticsPage.days') || 'j'}`}
                  </button>
                ))}
              </div>
              {period === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 pl-2 border-l border-gray-200">
                  <label className="flex items-center gap-1.5 text-sm text-gray-600">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {t('statisticsPage.dateStart') || 'Début'}
                    </span>
                    <input
                      type="date"
                      value={dateRangeStart}
                      onChange={(e) => setDateRangeStart(e.target.value)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-600">
                    <span className="text-xs font-medium text-gray-500 uppercase">
                      {t('statisticsPage.dateEnd') || 'Fin'}
                    </span>
                    <input
                      type="date"
                      value={dateRangeEnd}
                      onChange={(e) => setDateRangeEnd(e.target.value)}
                      className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <LayoutGrid size={14} aria-hidden />
              {t('statisticsPage.viewMode') || 'Affichage'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {VIEW_MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setViewMode(m.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                    viewMode === m.value
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {t(m.labelKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide shrink-0">
              {t('statisticsPage.modules') || 'Modules'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={selectAllModules}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  !hasModuleFilter
                    ? 'bg-slate-100 border-slate-300 text-slate-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {t('statisticsPage.allModules') || 'Tous'}
              </button>
              {MODULE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleModule(id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors ${
                    selectedModules[id]
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}
                >
                  {moduleLabels[id]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {!MODULE_IDS.some((id) => selectedModules[id]) && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          {t('statisticsPage.selectAtLeastOneModule') ||
            'Sélectionnez au moins un module pour afficher les statistiques.'}
        </p>
      )}

      {/* Radio */}
      {selectedModules.radio && (
        <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Radio size={24} className="text-blue-600" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('statisticsPage.radio') || 'Radio'}</h2>
              <p className="text-sm text-gray-500">
                {t('statisticsPage.radioDescription') || 'Écoutes et utilisateurs par jour'}
              </p>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <KpiCard
                label={t('statisticsPage.stationsCount') || 'Stations'}
                value={(realCounts.radio ?? kpis.radio.total).toLocaleString()}
                subValue={realCounts.radio != null ? t('statisticsPage.realData') : null}
                icon={BarChart3}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
              />
              <KpiCard
                label={t('statisticsPage.avgPerDay') || 'Moyenne/jour'}
                value={kpis.radio.avgPerDay.toLocaleString()}
                icon={BarChart3}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
              />
              <KpiCard
                label={t('statisticsPage.peakDay') || 'Pic jour'}
                value={kpis.radio.peak}
                subValue={formatDate(kpis.radio.peakDate)}
                icon={TrendingUp}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
              />
              <KpiCard
                label={t('statisticsPage.peakHour') || 'Pic horaire'}
                value={hourlyPeaks.radio.peakHourLabel}
                subValue={`${t('statisticsPage.usage') || 'Utilisation'}: ${hourlyPeaks.radio.peakHourValue}`}
                icon={Clock}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
              />
              <KpiCard
                label={t('statisticsPage.growth') || 'Évolution'}
                value={`${kpis.radio.growth >= 0 ? '+' : ''}${kpis.radio.growth}%`}
                icon={TrendingUp}
                iconBg="bg-blue-50"
                iconColor="text-blue-600"
              />
            </div>
            {viewModeConfig.showDaily && <SectionChart data={dailyData} dataKey="radio" color={COLORS.radio} t={t} />}
            {viewModeConfig.showHourly && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {t('statisticsPage.peakUsageByHour') || "Pic d'utilisation dans la journée (par heure)"}
                </h3>
                <HourlyChart dataKey="radio" color={COLORS.radio} peakHour={hourlyPeaks.radio.peakHour} t={t} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Vidéos */}
      {selectedModules.videos && (
        <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <Clapperboard size={24} className="text-purple-600" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t('statisticsPage.videos') || 'Vidéos (Films & Séries)'}
              </h2>
              <p className="text-sm text-gray-500">
                {t('statisticsPage.videosDescription') || 'Utilisateurs par jour'}
              </p>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <KpiCard
                label={t('statisticsPage.moviesCount') || 'Films & séries'}
                value={(realCounts.videos ?? kpis.videos.total).toLocaleString()}
                subValue={realCounts.videos != null ? t('statisticsPage.realData') : null}
                icon={BarChart3}
                iconBg="bg-purple-50"
                iconColor="text-purple-600"
              />
              <KpiCard
                label={t('statisticsPage.avgPerDay') || 'Moyenne/jour'}
                value={kpis.videos.avgPerDay.toLocaleString()}
                icon={BarChart3}
                iconBg="bg-purple-50"
                iconColor="text-purple-600"
              />
              <KpiCard
                label={t('statisticsPage.peakDay') || 'Pic jour'}
                value={kpis.videos.peak}
                subValue={formatDate(kpis.videos.peakDate)}
                icon={TrendingUp}
                iconBg="bg-purple-50"
                iconColor="text-purple-600"
              />
              <KpiCard
                label={t('statisticsPage.peakHour') || 'Pic horaire'}
                value={hourlyPeaks.videos.peakHourLabel}
                subValue={`${t('statisticsPage.usage') || 'Utilisation'}: ${hourlyPeaks.videos.peakHourValue}`}
                icon={Clock}
                iconBg="bg-purple-50"
                iconColor="text-purple-600"
              />
              <KpiCard
                label={t('statisticsPage.growth') || 'Évolution'}
                value={`${kpis.videos.growth >= 0 ? '+' : ''}${kpis.videos.growth}%`}
                icon={TrendingUp}
                iconBg="bg-purple-50"
                iconColor="text-purple-600"
              />
            </div>
            {viewModeConfig.showDaily && <SectionChart data={dailyData} dataKey="videos" color={COLORS.videos} t={t} />}
            {viewModeConfig.showHourly && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {t('statisticsPage.peakUsageByHour') || "Pic d'utilisation dans la journée (par heure)"}
                </h3>
                <HourlyChart dataKey="videos" color={COLORS.videos} peakHour={hourlyPeaks.videos.peakHour} t={t} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* WebTV */}
      {selectedModules.webtv && (
        <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <Tv size={24} className="text-emerald-600" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('statisticsPage.webtv') || 'WebTV'}</h2>
              <p className="text-sm text-gray-500">{t('statisticsPage.webtvDescription') || 'Utilisateurs par jour'}</p>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <KpiCard
                label={t('statisticsPage.viewersCount') || 'Spectateurs'}
                value={(realCounts.webtv ?? kpis.webtv.total).toLocaleString()}
                subValue={realCounts.webtv != null ? t('statisticsPage.realData') : null}
                icon={BarChart3}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
              />
              <KpiCard
                label={t('statisticsPage.avgPerDay') || 'Moyenne/jour'}
                value={kpis.webtv.avgPerDay.toLocaleString()}
                icon={BarChart3}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
              />
              <KpiCard
                label={t('statisticsPage.peakDay') || 'Pic jour'}
                value={kpis.webtv.peak}
                subValue={formatDate(kpis.webtv.peakDate)}
                icon={TrendingUp}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
              />
              <KpiCard
                label={t('statisticsPage.peakHour') || 'Pic horaire'}
                value={hourlyPeaks.webtv.peakHourLabel}
                subValue={`${t('statisticsPage.usage') || 'Utilisation'}: ${hourlyPeaks.webtv.peakHourValue}`}
                icon={Clock}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
              />
              <KpiCard
                label={t('statisticsPage.growth') || 'Évolution'}
                value={`${kpis.webtv.growth >= 0 ? '+' : ''}${kpis.webtv.growth}%`}
                icon={TrendingUp}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-600"
              />
            </div>
            {viewModeConfig.showDaily && <SectionChart data={dailyData} dataKey="webtv" color={COLORS.webtv} t={t} />}
            {viewModeConfig.showHourly && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {t('statisticsPage.peakUsageByHour') || "Pic d'utilisation dans la journée (par heure)"}
                </h3>
                <HourlyChart dataKey="webtv" color={COLORS.webtv} peakHour={hourlyPeaks.webtv.peakHour} t={t} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Magazine */}
      {selectedModules.magazine && (
        <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <BookOpen size={24} className="text-amber-600" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('statisticsPage.magazine') || 'Magazine'}</h2>
              <p className="text-sm text-gray-500">
                {t('statisticsPage.magazineDescription') || 'Lectures et utilisateurs par jour'}
              </p>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <KpiCard
                label={t('statisticsPage.articlesCount') || 'Articles'}
                value={(realCounts.magazine ?? kpis.magazine.total).toLocaleString()}
                subValue={realCounts.magazine != null ? t('statisticsPage.realData') : null}
                icon={BarChart3}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
              />
              <KpiCard
                label={t('statisticsPage.avgPerDay') || 'Moyenne/jour'}
                value={kpis.magazine.avgPerDay.toLocaleString()}
                icon={BarChart3}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
              />
              <KpiCard
                label={t('statisticsPage.peakDay') || 'Pic jour'}
                value={kpis.magazine.peak}
                subValue={formatDate(kpis.magazine.peakDate)}
                icon={TrendingUp}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
              />
              <KpiCard
                label={t('statisticsPage.peakHour') || 'Pic horaire'}
                value={hourlyPeaks.magazine.peakHourLabel}
                subValue={`${t('statisticsPage.usage') || 'Utilisation'}: ${hourlyPeaks.magazine.peakHourValue}`}
                icon={Clock}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
              />
              <KpiCard
                label={t('statisticsPage.growth') || 'Évolution'}
                value={`${kpis.magazine.growth >= 0 ? '+' : ''}${kpis.magazine.growth}%`}
                icon={TrendingUp}
                iconBg="bg-amber-50"
                iconColor="text-amber-600"
              />
            </div>
            {viewModeConfig.showDaily && (
              <SectionChart data={dailyData} dataKey="magazine" color={COLORS.magazine} t={t} />
            )}
            {viewModeConfig.showHourly && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {t('statisticsPage.peakUsageByHour') || "Pic d'utilisation dans la journée (par heure)"}
                </h3>
                <HourlyChart
                  dataKey="magazine"
                  color={COLORS.magazine}
                  peakHour={hourlyPeaks.magazine.peakHour}
                  t={t}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Bannières */}
      {selectedModules.banners && (
        <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-50">
              <Image size={24} className="text-sky-600" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('statisticsPage.banners') || 'Bannières'}</h2>
              <p className="text-sm text-gray-500">
                {t('statisticsPage.bannersDescription') || 'Affichages et clics par jour'}
              </p>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <KpiCard
                label={t('statisticsPage.impressions') || 'Impressions'}
                value={kpis.banners.total.toLocaleString()}
                icon={BarChart3}
                iconBg="bg-sky-50"
                iconColor="text-sky-600"
              />
              <KpiCard
                label={t('statisticsPage.clicks') || 'Clics'}
                value={kpis.banners.totalClicks.toLocaleString()}
                icon={BarChart3}
                iconBg="bg-sky-50"
                iconColor="text-sky-600"
              />
              <KpiCard
                label={t('statisticsPage.peakHour') || 'Pic horaire'}
                value={hourlyPeaks.banners.peakHourLabel}
                subValue={`${t('statisticsPage.usage') || 'Utilisation'}: ${hourlyPeaks.banners.peakHourValue}`}
                icon={Clock}
                iconBg="bg-sky-50"
                iconColor="text-sky-600"
              />
              <KpiCard
                label={t('statisticsPage.ctr') || 'CTR'}
                value={`${kpis.banners.ctr}%`}
                icon={TrendingUp}
                iconBg="bg-sky-50"
                iconColor="text-sky-600"
              />
              <KpiCard
                label={t('statisticsPage.growth') || 'Évolution'}
                value={`${kpis.banners.growth >= 0 ? '+' : ''}${kpis.banners.growth}%`}
                icon={TrendingUp}
                iconBg="bg-sky-50"
                iconColor="text-sky-600"
              />
            </div>
            {viewModeConfig.showDaily && (
              <SectionChart data={dailyData} dataKey="banners" color={COLORS.banners} t={t} />
            )}
            {viewModeConfig.showHourly && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {t('statisticsPage.peakUsageByHour') || "Pic d'utilisation dans la journée (par heure)"}
                </h3>
                <HourlyChart dataKey="banners" color={COLORS.banners} peakHour={hourlyPeaks.banners.peakHour} t={t} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Publicités */}
      {selectedModules.ads && (
        <section className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-50">
              <Megaphone size={24} className="text-pink-600" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('statisticsPage.ads') || 'Publicités'}</h2>
              <p className="text-sm text-gray-500">
                {t('statisticsPage.adsDescription') || 'Vues et clics (pre-roll, mid-roll)'}
              </p>
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <KpiCard
                label={t('statisticsPage.views') || 'Vues'}
                value={kpis.ads.total.toLocaleString()}
                icon={BarChart3}
                iconBg="bg-pink-50"
                iconColor="text-pink-600"
              />
              <KpiCard
                label={t('statisticsPage.clicks') || 'Clics'}
                value={kpis.ads.totalClicks.toLocaleString()}
                icon={BarChart3}
                iconBg="bg-pink-50"
                iconColor="text-pink-600"
              />
              <KpiCard
                label={t('statisticsPage.peakHour') || 'Pic horaire'}
                value={hourlyPeaks.ads.peakHourLabel}
                subValue={`${t('statisticsPage.usage') || 'Utilisation'}: ${hourlyPeaks.ads.peakHourValue}`}
                icon={Clock}
                iconBg="bg-pink-50"
                iconColor="text-pink-600"
              />
              <KpiCard
                label={t('statisticsPage.ctr') || 'CTR'}
                value={`${kpis.ads.ctr}%`}
                icon={TrendingUp}
                iconBg="bg-pink-50"
                iconColor="text-pink-600"
              />
              <KpiCard
                label={t('statisticsPage.growth') || 'Évolution'}
                value={`${kpis.ads.growth >= 0 ? '+' : ''}${kpis.ads.growth}%`}
                icon={TrendingUp}
                iconBg="bg-pink-50"
                iconColor="text-pink-600"
              />
            </div>
            {viewModeConfig.showDaily && <SectionChart data={dailyData} dataKey="ads" color={COLORS.ads} t={t} />}
            {viewModeConfig.showHourly && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  {t('statisticsPage.peakUsageByHour') || "Pic d'utilisation dans la journée (par heure)"}
                </h3>
                <HourlyChart dataKey="ads" color={COLORS.ads} peakHour={hourlyPeaks.ads.peakHour} t={t} />
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default Statistics;

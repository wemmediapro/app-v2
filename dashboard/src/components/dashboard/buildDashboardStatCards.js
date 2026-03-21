import {
  Users,
  Utensils,
  MessageSquare,
  AlertCircle,
  Radio,
  Clapperboard,
  BookOpen,
  Baby,
  ShoppingBag,
  Eye,
} from 'lucide-react';

/**
 * @param {(key: string) => string} t
 * @param {object} stats — réponse getDashboardStats (data)
 */
export function buildDashboardStatCards(t, stats) {
  return [
    {
      title: t('dashboard.users'),
      value: stats?.statistics?.totalUsers ?? 0,
      change: '—',
      changeType: 'neutral',
      icon: Users,
      color: 'blue',
    },
    {
      title: t('dashboard.viewers'),
      value: stats?.statistics?.totalViewers ?? 0,
      change: '—',
      changeType: 'neutral',
      icon: Eye,
      color: 'violet',
    },
    {
      title: t('dashboard.restaurants'),
      value: stats?.statistics?.totalRestaurants ?? 0,
      change: '—',
      changeType: 'neutral',
      icon: Utensils,
      color: 'green',
    },
    {
      title: t('dashboard.radioStations'),
      value: stats?.statistics?.totalRadioStations ?? 0,
      change: '—',
      changeType: 'neutral',
      icon: Radio,
      color: 'cyan',
    },
    {
      title: t('dashboard.moviesSeries'),
      value: stats?.statistics?.totalMovies ?? 0,
      change: '—',
      changeType: 'neutral',
      icon: Clapperboard,
      color: 'purple',
    },
    {
      title: t('dashboard.magazineArticles'),
      value: stats?.statistics?.totalArticles ?? 0,
      change: '—',
      changeType: 'neutral',
      icon: BookOpen,
      color: 'indigo',
    },
    {
      title: t('dashboard.kidsActivities'),
      value: stats?.statistics?.totalActivities ?? 0,
      change: '—',
      changeType: 'neutral',
      icon: Baby,
      color: 'pink',
    },
    {
      title: t('dashboard.shopProducts'),
      value: stats?.statistics?.totalProducts ?? 0,
      change: '—',
      changeType: 'neutral',
      icon: ShoppingBag,
      color: 'amber',
    },
    {
      title: t('dashboard.messages'),
      value: stats?.statistics?.totalMessages ?? 0,
      change: '—',
      changeType: 'neutral',
      icon: MessageSquare,
      color: 'emerald',
    },
    {
      title: t('navigation.feedback'),
      value: stats?.statistics?.totalFeedback ?? 0,
      change: '—',
      changeType: 'neutral',
      icon: AlertCircle,
      color: 'orange',
    },
  ];
}

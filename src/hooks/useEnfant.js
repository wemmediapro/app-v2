/**
 * Hook Espace Enfant : chargement activités, catégories, filtres (audit CTO — découpage App.jsx).
 */
import { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/apiService';

export function useEnfant(language, t, enfantFavoritesIds = []) {
  const [enfantActivities, setEnfantActivities] = useState([]);
  const [enfantLoading, setEnfantLoading] = useState(true);
  const [enfantSearchQuery, setEnfantSearchQuery] = useState('');
  const [selectedEnfantCategory, setSelectedEnfantCategory] = useState('all');
  const [selectedActivity, setSelectedActivity] = useState(null);

  const enfantCategories = useMemo(() => [
    { id: 'all', name: t('enfant.categories.all'), icon: '🎯' },
    { id: 'favoris', name: t('enfant.favoris'), icon: '❤️' },
    { id: 'games', name: t('enfant.categories.games'), icon: '🎮' },
    { id: 'activities', name: t('enfant.categories.activities'), icon: '🎨' },
    { id: 'education', name: t('enfant.categories.education'), icon: '📚' },
    { id: 'entertainment', name: t('enfant.categories.entertainment'), icon: '🎪' },
  ], [t]);

  const filteredEnfantActivities = useMemo(() => enfantActivities.filter(activity => {
    const matchesCategory = selectedEnfantCategory === 'all'
      ? true
      : selectedEnfantCategory === 'favoris'
        ? enfantFavoritesIds.some(id => String(id) === String(activity.id))
        : activity.category === selectedEnfantCategory;
    const features = Array.isArray(activity.features) ? activity.features : [];
    const matchesSearch = !enfantSearchQuery.trim() ||
      (activity.name || '').toLowerCase().includes(enfantSearchQuery.toLowerCase()) ||
      (activity.description || '').toLowerCase().includes(enfantSearchQuery.toLowerCase()) ||
      features.some(f => String(f).toLowerCase().includes(enfantSearchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  }), [enfantActivities, selectedEnfantCategory, enfantSearchQuery, enfantFavoritesIds]);

  const enfantHighlights = useMemo(
    () => (enfantActivities.filter(a => a.isHighlight) || enfantActivities).slice(0, 3),
    [enfantActivities],
  );

  useEffect(() => {
    let cancelled = false;
    const loadEnfantActivities = async () => {
      try {
        setEnfantLoading(true);
        const response = await apiService.getEnfantActivities(`lang=${language}`);
        if (cancelled) return;
        const list = Array.isArray(response.data) ? response.data : (response.data?.data || []);
        const categoryMap = {
          'Jeux': 'games',
          'Arts & Créativité': 'activities',
          'Sport': 'activities',
          'Créatif': 'activities',
          'Éducation': 'education',
          'Divertissement': 'entertainment',
          'Musique': 'entertainment',
          'Danse': 'entertainment',
          'Lecture': 'entertainment',
        };
        const transformed = (list || []).map(a => {
          const rawCat = (a.category || 'Jeux').trim();
          const frontendCategory = categoryMap[rawCat] || rawCat.toLowerCase().replace(/\s+/g, '-').replace(/&/g, '-');
          return {
            id: a._id || a.id,
            name: a.name,
            type: a.type || '',
            category: frontendCategory,
            isHighlight: a.isHighlight || a.isFeatured || false,
            location: a.location || '',
            ageRange: a.ageRange || '',
            image: a.imageUrl || a.image || '',
            description: a.description || '',
            isOpen: a.isOpen !== false,
            openingHours: a.schedule || a.openingHours || '',
            features: Array.isArray(a.features) ? a.features : [],
            activities: Array.isArray(a.activities) ? a.activities : [],
          };
        });
        if (!cancelled) setEnfantActivities(transformed);
      } catch (error) {
        console.warn('Erreur chargement activités enfant:', error);
        if (!cancelled) setEnfantActivities([]);
      } finally {
        if (!cancelled) setEnfantLoading(false);
      }
    };
    loadEnfantActivities();
    return () => { cancelled = true; };
  }, [language]);

  return {
    enfantActivities,
    setEnfantActivities,
    enfantLoading,
    enfantSearchQuery,
    setEnfantSearchQuery,
    selectedEnfantCategory,
    setSelectedEnfantCategory,
    enfantCategories,
    filteredEnfantActivities,
    enfantHighlights,
    selectedActivity,
    setSelectedActivity,
  };
}

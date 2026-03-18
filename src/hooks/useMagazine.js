/**
 * Hook Magazine : chargement articles, catégories, filtres (audit CTO — découpage App.jsx).
 */
import { useState, useEffect, useMemo } from 'react';
import { apiService } from '../services/apiService';

const MAGAZINE_CATEGORY_IDS = [
  { id: 'all', icon: '📰' },
  { id: 'actualites', icon: '📢' },
  { id: 'voyage', icon: '✈️' },
  { id: 'gastronomie', icon: '🍽️' },
  { id: 'culture', icon: '🎭' },
  { id: 'divertissement', icon: '🎬' },
  { id: 'sport', icon: '⚽' },
  { id: 'lifestyle', icon: '✨' },
  { id: 'technologie', icon: '💻' },
];

const MAGAZINE_CATEGORY_BACKEND_TO_ID = {
  'Actualités': 'actualites', 'Voyage': 'voyage', 'Culture': 'culture', 'Gastronomie': 'gastronomie',
  'Divertissement': 'divertissement', 'Sport': 'sport', 'Lifestyle': 'lifestyle',
};

function normalizeCategory(cat) {
  if (!cat) return 'actualites';
  const s = String(cat).toLowerCase().normalize('NFD').replace(/\u0300/g, '').replace(/\s+/g, '');
  return MAGAZINE_CATEGORY_BACKEND_TO_ID[cat] || s || 'actualites';
}

export function useMagazine(language, t) {
  const [magazineArticles, setMagazineArticles] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [magazineSearchQuery, setMagazineSearchQuery] = useState('');
  const [magazineLoading, setMagazineLoading] = useState(true);
  const [magazineError, setMagazineError] = useState(null);
  const [magazineRetryTrigger, setMagazineRetryTrigger] = useState(0);

  const magazineCategories = useMemo(
    () => MAGAZINE_CATEGORY_IDS.map(({ id, icon }) => ({ id, name: t('magazine.categories.' + id), icon })),
    [t]
  );

  const categoryMap = useMemo(() => ({
    'actualites': ['actualités', 'actualites', 'news'],
    'voyage': ['voyage', 'travel', 'destination'],
    'gastronomie': ['gastronomie', 'cuisine', 'food'],
    'culture': ['culture', 'arts', 'festival'],
    'technologie': ['technologie', 'tech', 'innovation'],
  }), []);

  const filteredArticles = useMemo(() => magazineArticles.filter(article => {
    const articleCategory = article.category?.toLowerCase() || '';
    const selectedCat = selectedCategory?.toLowerCase() || 'all';
    const matchesCategory = selectedCat === 'all' ||
      articleCategory === selectedCat ||
      (categoryMap[selectedCat] && categoryMap[selectedCat].some(cat => articleCategory.includes(cat)));
    const matchesSearch = magazineSearchQuery === '' ||
      (article.title || '').toLowerCase().includes(magazineSearchQuery.toLowerCase()) ||
      (article.excerpt || '').toLowerCase().includes(magazineSearchQuery.toLowerCase()) ||
      (article.tags && article.tags.some(tag => String(tag).toLowerCase().includes(magazineSearchQuery.toLowerCase())));
    return matchesCategory && matchesSearch;
  }), [magazineArticles, selectedCategory, magazineSearchQuery, categoryMap]);

  const featuredArticles = useMemo(() => magazineArticles.filter(a => a.isFeatured), [magazineArticles]);
  const breakingNews = useMemo(() => magazineArticles.filter(a => a.isBreaking), [magazineArticles]);

  useEffect(() => {
    let cancelled = false;
    const locale = ({ fr: 'fr-FR', en: 'en-GB', es: 'es-ES', it: 'it-IT', de: 'de-DE', ar: 'ar-EG' }[language] || 'fr-FR');
    const loadMagazineArticles = async () => {
      try {
        setMagazineLoading(true);
        setMagazineError(null);
        const response = await apiService.getArticles(`lang=${language}&limit=50&page=1`);
        if (cancelled) return;
        const list = response.data?.data ?? (Array.isArray(response.data) ? response.data : []);
        if (list.length > 0) {
          const transformed = list.map(article => {
            try {
              const cat = normalizeCategory(article.category);
              const publishDate = article.createdAt ? new Date(article.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '';
              return {
                id: article._id || article.id,
                title: article.title || '',
                category: cat,
                author: article.author || 'Auteur',
                publishDate,
                readTime: article.readTime ? `${article.readTime} min` : (article.readingTime ? `${article.readingTime} min` : '5 min'),
                image: article.imageUrl || '',
                excerpt: article.excerpt || '',
                content: article.content || article.excerpt || '',
                isFeatured: article.isFeatured || article.featured || false,
                isBreaking: article.isBreaking || false,
                tags: article.tags || [],
                views: article.views || 0,
                likes: article.likes || 0,
              };
            } catch (e) {
              console.warn('Article ignoré (transformation):', article._id, e);
              return null;
            }
          }).filter(Boolean);
          if (cancelled) return;
          setMagazineArticles(transformed);
          setSelectedArticle(prev => {
            if (!prev?.id && !prev?._id) return prev;
            const prevId = String(prev.id || prev._id);
            const updated = transformed.find(a => String(a.id || a._id) === prevId);
            return updated ? { ...updated } : prev;
          });
        } else {
          if (!cancelled) {
            setMagazineArticles([]);
            setSelectedArticle(null);
          }
        }
      } catch (error) {
        console.warn('Erreur chargement articles magazine:', error);
        if (!cancelled) {
          setMagazineArticles([]);
          const status = error?.response?.status;
          if (status === 429) {
            setMagazineError('Trop de requêtes. Veuillez réessayer dans un moment.');
          } else if (status === 404 || error?.code === 'ERR_NETWORK') {
            setMagazineError('Serveur inaccessible. Démarrez le backend (npm run dev dans backend/, port 3000).');
          } else {
            setMagazineError(error?.response?.data?.message || error?.message || 'Erreur de chargement');
          }
        }
      } finally {
        if (!cancelled) setMagazineLoading(false);
      }
    };
    loadMagazineArticles();
    return () => { cancelled = true; };
  }, [language, magazineRetryTrigger]);

  return {
    magazineArticles,
    setMagazineArticles,
    selectedArticle,
    setSelectedArticle,
    selectedCategory,
    setSelectedCategory,
    magazineSearchQuery,
    setMagazineSearchQuery,
    magazineLoading,
    magazineError,
    magazineRetryTrigger,
    setMagazineRetryTrigger,
    magazineCategories,
    filteredArticles,
    featuredArticles,
    breakingNews,
  };
}

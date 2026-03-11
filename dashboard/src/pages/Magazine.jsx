import { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Plus, Edit, Trash2, Calendar, Eye, Heart, Filter, X, Save, MapPin, Upload, Image as ImageIcon, Video, Link, Bold, Italic, List, AlignLeft, AlignCenter, AlignRight, Eye as EyeIcon, Clock, Tag, Globe, FileText, Heading2, Heading3, ChevronDown, SlidersHorizontal } from 'lucide-react';
import FilterBar from '../components/FilterBar';
import { apiService } from '../services/apiService';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { LANG_LIST, emptyTranslations } from '../utils/i18n';

/** URL d’image : chemins relatifs préfixés par l’origine pour le proxy. Optionnellement ajoute un cache-bust pour forcer le rechargement. */
function getImageSrc(url, cacheBust) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const u = cacheBust ? `${url}${url.includes('?') ? '&' : '?'}t=${cacheBust}` : url;
    return u;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const base = origin ? `${origin}${url.startsWith('/') ? '' : '/'}${url}` : url;
  return cacheBust ? `${base}${base.includes('?') ? '&' : '?'}t=${cacheBust}` : base;
}

const Magazine = () => {
  const { t, language } = useLanguage();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('all');
  const [shipFilter, setShipFilter] = useState('all');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [galleryImages, setGalleryImages] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [publishDate, setPublishDate] = useState('');
  const [publishTime, setPublishTime] = useState('');
  const [activeLang, setActiveLang] = useState('fr');
  const [newArticle, setNewArticle] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: '',
    author: '',
    imageUrl: '',
    isPublished: false,
    status: 'draft',
    countries: [],
    tags: [],
    metaDescription: '',
    metaKeywords: '',
    featured: false,
    allowComments: true,
    readingTime: 0,
    translations: emptyTranslations()
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editActiveLang, setEditActiveLang] = useState('fr');
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);
  const editCoverInputRef = useRef(null);
  const contentTextareaRef = useRef(null);
  const [showInsertImageModal, setShowInsertImageModal] = useState(false);
  const [showInsertVideoModal, setShowInsertVideoModal] = useState(false);
  const [insertImageUrl, setInsertImageUrl] = useState('');
  const [insertImageFile, setInsertImageFile] = useState(null);
  const [insertVideoUrl, setInsertVideoUrl] = useState('');
  const [uploadingInlineImage, setUploadingInlineImage] = useState(false);
  const [mediaLibraryVideos, setMediaLibraryVideos] = useState([]);
  const [loadingMediaLibrary, setLoadingMediaLibrary] = useState(false);
  const [insertTargetMode, setInsertTargetMode] = useState('new'); // 'new' | 'edit'
  const [showEditPreview, setShowEditPreview] = useState(false);
  const [loadingEditArticle, setLoadingEditArticle] = useState(false);
  const [editPublishDate, setEditPublishDate] = useState('');
  const [editPublishTime, setEditPublishTime] = useState('');
  const [editGalleryImages, setEditGalleryImages] = useState([]);
  const editContentTextareaRef = useRef(null);

  // Pays disponibles
  const availableCountries = [
    { name: 'Maroc', code: 'MA' },
    { name: 'Tunisie', code: 'TN' },
    { name: 'Algérie', code: 'DZ' },
    { name: 'Italie', code: 'IT' },
    { name: 'Espagne', code: 'ES' }
  ];

  // Catégories disponibles
  const availableCategories = [
    'Actualités',
    'Voyage',
    'Culture',
    'Gastronomie',
    'Divertissement',
    'Sport',
    'Lifestyle'
  ];

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const response = await apiService.getArticles('all=1&withTranslations=1');
      const articlesArray = Array.isArray(response.data) ? response.data : (response.data?.data || []);
      setArticles(articlesArray);
    } catch (error) {
      console.error('Error fetching articles:', error);
      const serverMessage = error.response?.data?.message;
      toast.error(serverMessage || t('magazine.errorLoadArticles'));
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteArticle = async (article, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!window.confirm(t('magazine.confirmDeleteArticle', { title: article.title }))) return;
    const id = (article._id || article.id || '').toString().trim();
    if (!id) {
      toast.error(t('magazine.articleIdMissing'));
      return;
    }
    try {
      await apiService.deleteArticle(id);
      toast.success(t('magazine.articleDeleted'));
      fetchArticles();
    } catch (error) {
      console.error('Delete article error:', error);
      const msg = error.response?.data?.message || 'Erreur lors de la suppression';
      toast.error(msg);
    }
  };

  const handleEditArticle = async (article) => {
    const id = article._id || article.id;
    if (!id) {
      toast.error(t('magazine.articleIdMissing'));
      return;
    }
    setLoadingEditArticle(true);
    const loadingToast = toast.loading('Chargement de l\'article…');
    try {
      const res = await apiService.getArticle(id, 'withTranslations=1');
      toast.dismiss(loadingToast);
      const full = res.data?.data ?? res.data;
      if (!full) {
        toast.error(t('magazine.articleNotFound'));
        return;
      }
      const articleData = {
        ...full,
        countries: full.countries && Array.isArray(full.countries) ? [...full.countries] : [],
        tags: full.tags && Array.isArray(full.tags) ? [...full.tags] : [],
        translations: full.translations && typeof full.translations === 'object'
          ? { ...emptyTranslations(), ...full.translations }
          : emptyTranslations()
      };
      setEditingArticle(articleData);
      setEditActiveLang('fr');
      setEditImageFile(null);
      setEditImagePreview(full.imageUrl || null);
      setShowEditPreview(false);
      const pubAt = full.publishedAt ? new Date(full.publishedAt) : null;
      setEditPublishDate(pubAt ? pubAt.toISOString().split('T')[0] : '');
      setEditPublishTime(pubAt && pubAt.toTimeString ? pubAt.toTimeString().slice(0, 5) : '');
      setEditGalleryImages(full.gallery && full.gallery.length
        ? full.gallery.map((g, i) => ({ id: `edit-g-${i}`, preview: g.url || g, caption: g.caption || '' }))
        : []);
      setInsertTargetMode('new');
    } catch (err) {
      toast.dismiss(loadingToast);
      console.error('Error loading article for edit:', err);
      toast.error(err.response?.data?.message || 'Erreur lors du chargement de l\'article');
    } finally {
      setLoadingEditArticle(false);
    }
  };

  const handleEditImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('magazine.selectImage'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('magazine.fileTooLarge5MB'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImagePreview(reader.result);
        setEditImageFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeEditImage = () => {
    setEditImageFile(null);
    setEditImagePreview(null);
    setEditingArticle(prev => ({ ...prev, imageUrl: '' }));
  };

  const toggleEditCountry = (countryName) => {
    if (!editingArticle) return;
    setEditingArticle({
      ...editingArticle,
      countries: editingArticle.countries?.includes(countryName)
        ? (editingArticle.countries || []).filter(c => c !== countryName)
        : [...(editingArticle.countries || []), countryName]
    });
  };

  const handleEditAddTag = (tag) => {
    if (!editingArticle || !tag.trim()) return;
    const tags = editingArticle.tags || [];
    if (tags.includes(tag.trim())) return;
    setEditingArticle({ ...editingArticle, tags: [...tags, tag.trim()] });
  };

  const removeEditTag = (tagToRemove) => {
    if (!editingArticle) return;
    setEditingArticle({
      ...editingArticle,
      tags: (editingArticle.tags || []).filter(t => t !== tagToRemove)
    });
  };

  const handleEditGalleryUpload = (e) => {
    const files = e.target.files;
    if (!files?.length || !editingArticle) return;
    Array.from(files).forEach((file, i) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditGalleryImages(prev => [...prev, { id: `edit-g-${Date.now()}-${i}`, preview: reader.result, file }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeEditGalleryImage = (id) => {
    setEditGalleryImages(prev => prev.filter(img => img.id !== id));
  };

  const handleSaveEdit = async () => {
    if (!editingArticle?.title?.trim() || !editingArticle?.category || !editingArticle?.content?.trim()) {
      toast.error(t('magazine.fillTitleCategoryContent'));
      return;
    }
    const id = editingArticle._id || editingArticle.id;
    if (!id) {
      toast.error(t('magazine.articleIdMissing'));
      return;
    }
    try {
      let imageUrl = editingArticle.imageUrl || '';
      if (editImageFile) {
        setUploadingImage(true);
        const up = await apiService.uploadImage(editImageFile);
        imageUrl = up?.image?.path || up?.data?.image?.path || up?.data?.image?.url || up?.image?.url || imageUrl;
        setUploadingImage(false);
      }
      const translations = { fr: { title: editingArticle.title, excerpt: editingArticle.excerpt || '', content: editingArticle.content || '' } };
      LANG_LIST.forEach(({ code }) => {
        if (code === 'fr') return;
        const t = editingArticle.translations?.[code];
        if (t && (t.title || t.excerpt || t.content)) {
          translations[code] = { title: t.title || '', excerpt: t.excerpt || '', content: t.content || '' };
        }
      });
      const publishedAt = editingArticle.status === 'scheduled' && editPublishDate && editPublishTime
        ? new Date(`${editPublishDate}T${editPublishTime}`).toISOString()
        : (editingArticle.status === 'published' ? (editingArticle.publishedAt || new Date().toISOString()) : (editingArticle.publishedAt || null));
      const payload = {
        title: editingArticle.title,
        excerpt: editingArticle.excerpt || '',
        content: editingArticle.content,
        category: editingArticle.category,
        author: editingArticle.author || '',
        imageUrl,
        isPublished: editingArticle.status === 'published',
        status: editingArticle.status || 'draft',
        featured: !!editingArticle.featured,
        allowComments: editingArticle.allowComments !== false,
        readingTime: editingArticle.readingTime || editingArticle.readTime || 0,
        tags: editingArticle.tags || [],
        countries: editingArticle.countries || [],
        publishedAt,
        metaDescription: editingArticle.metaDescription || '',
        metaKeywords: Array.isArray(editingArticle.metaKeywords) ? editingArticle.metaKeywords : (editingArticle.metaKeywords ? [String(editingArticle.metaKeywords)] : []),
        gallery: editGalleryImages.map(img => ({ url: img.preview, caption: img.caption || '' })),
        translations
      };
      const res = await apiService.updateArticle(id, payload);
      const updatedFromApi = res?.data?.data;
      if (updatedFromApi) {
        const sid = updatedFromApi._id || updatedFromApi.id || id;
        setArticles(prev => prev.map(a => (a._id === id || a.id === id) ? { ...updatedFromApi, _id: sid, id: sid, updatedAt: Date.now() } : a));
      }
      toast.success(t('magazine.articleUpdated'));
      if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));
      setEditingArticle(null);
      setEditImageFile(null);
      setEditImagePreview(null);
      setEditGalleryImages([]);
      fetchArticles();
    } catch (error) {
      setUploadingImage(false);
      console.error('Update article error:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(articles.map(article => article.category));
    return Array.from(cats).sort();
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      const matchesSearch = !searchQuery || 
        (article.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           article.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         article.excerpt?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || article.category === categoryFilter;
      const matchesCountry = countryFilter === 'all' || 
        (article.countries && article.countries.some(country => country.toLowerCase().includes(countryFilter.toLowerCase())));
      const matchesDestination = destinationFilter === 'all' || 
        (article.destination && article.destination.toLowerCase().includes(destinationFilter.toLowerCase()));
      const matchesShip = shipFilter === 'all' || 
        (article.shipId && article.shipId.toString() === shipFilter.toString());
      return matchesSearch && matchesCategory && matchesCountry && matchesDestination && matchesShip;
    });
  }, [articles, searchQuery, categoryFilter, countryFilter, destinationFilter, shipFilter]);

  /** Titre affiché selon la langue sélectionnée pour la liste */
  const getDisplayTitle = (article, lang) => {
    if (!article) return '';
    if (lang && lang !== 'fr' && article.translations?.[lang]?.title) return article.translations[lang].title;
    return article.title || '';
  };
  /** Aperçu affiché selon la langue sélectionnée pour la liste */
  const getDisplayExcerpt = (article, lang) => {
    if (!article) return '';
    if (lang && lang !== 'fr' && article.translations?.[lang]?.excerpt) return article.translations[lang].excerpt;
    return article.excerpt || '';
  };
  /** Clé de traduction pour une catégorie (valeur stockée en base) */
  const getCategoryLabel = (category) => {
    if (!category) return '';
    const key = category === 'Actualités' ? 'Actualites' : category;
    return t(`magazine.categories.${key}`) || category;
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('magazine.selectImage'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t('magazine.fileTooLarge5MB'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setImageFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setNewArticle({ ...newArticle, imageUrl: '' });
  };

  const toggleCountry = (countryName) => {
    setNewArticle({
      ...newArticle,
      countries: newArticle.countries.includes(countryName)
        ? newArticle.countries.filter(c => c !== countryName)
        : [...newArticle.countries, countryName]
    });
  };

  const handleAddTag = (tag) => {
    if (tag.trim() && !newArticle.tags.includes(tag.trim())) {
      setNewArticle({
        ...newArticle,
        tags: [...newArticle.tags, tag.trim()]
      });
    }
  };

  const removeTag = (tagToRemove) => {
    setNewArticle({
      ...newArticle,
      tags: newArticle.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleGalleryUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if (file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setGalleryImages(prev => [...prev, {
            id: Date.now() + Math.random(),
            file: file,
            preview: reader.result
          }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeGalleryImage = (id) => {
    setGalleryImages(galleryImages.filter(img => img.id !== id));
  };

  const calculateReadingTime = (content) => {
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  };

  // Récupère le contenu et le setter pour la langue active (formulaire nouvel article)
  const getCurrentContent = () =>
    activeLang === 'fr'
      ? newArticle.content
      : (newArticle.translations?.[activeLang]?.content ?? '');
  const setCurrentContent = (value) => {
    const frContent = activeLang === 'fr' ? value : (newArticle.translations?.fr?.content ?? newArticle.content);
    const rt = calculateReadingTime(frContent);
    if (activeLang === 'fr') {
      setNewArticle(prev => ({ ...prev, content: value, readingTime: rt }));
    } else {
      setNewArticle(prev => ({
        ...prev,
        translations: {
          ...prev.translations,
          [activeLang]: { ...prev.translations?.[activeLang], content: value }
        },
        readingTime: rt
      }));
    }
  };

  const insertHtmlAtCursor = (html) => {
    const ta = contentTextareaRef.current;
    const content = getCurrentContent();
    if (!ta) {
      setCurrentContent(content + html);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newContent = content.substring(0, start) + html + content.substring(end);
    setCurrentContent(newContent);
    setTimeout(() => {
      ta.focus();
      const pos = start + html.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const formatContent = (format) => {
    const ta = contentTextareaRef.current;
    const content = getCurrentContent();
    const start = ta ? ta.selectionStart : content.length;
    const end = ta ? ta.selectionEnd : content.length;
    const selectedText = content.substring(start, end);
    let html = '';
    switch (format) {
      case 'h2':
        html = selectedText ? `<h2>${selectedText}</h2>` : '<h2>Titre de section</h2>';
        break;
      case 'h3':
        html = selectedText ? `<h3>${selectedText}</h3>` : '<h3>Sous-titre</h3>';
        break;
      case 'bold':
        html = selectedText ? `<strong>${selectedText}</strong>` : '<strong>texte en gras</strong>';
        break;
      case 'italic':
        html = selectedText ? `<em>${selectedText}</em>` : '<em>texte en italique</em>';
        break;
      case 'list':
        html = selectedText
          ? '<ul>' + selectedText.split('\n').filter(Boolean).map(l => `<li>${l}</li>`).join('') + '</ul>'
          : '<ul>\n<li>Élément 1</li>\n<li>Élément 2</li>\n</ul>';
        break;
      case 'listOrdered':
        html = selectedText
          ? '<ol>' + selectedText.split('\n').filter(Boolean).map(l => `<li>${l}</li>`).join('') + '</ol>'
          : '<ol>\n<li>Premier</li>\n<li>Deuxième</li>\n</ol>';
        break;
      case 'alignLeft':
        html = selectedText ? `<p style="text-align:left">${selectedText}</p>` : '<p style="text-align:left">Paragraphe</p>';
        break;
      case 'alignCenter':
        html = selectedText ? `<p style="text-align:center">${selectedText}</p>` : '<p style="text-align:center">Paragraphe centré</p>';
        break;
      case 'alignRight':
        html = selectedText ? `<p style="text-align:right">${selectedText}</p>` : '<p style="text-align:right">Paragraphe à droite</p>';
        break;
      case 'paragraph':
        html = selectedText ? `<p>${selectedText}</p>` : '<p>Nouveau paragraphe.</p>';
        break;
      default:
        return;
    }
    insertHtmlAtCursor(html);
  };

  // Édition : contenu et formatage (même principe que nouvel article)
  const getEditCurrentContent = () => {
    if (!editingArticle) return '';
    return editActiveLang === 'fr'
      ? (editingArticle.content ?? '')
      : (editingArticle.translations?.[editActiveLang]?.content ?? '');
  };
  const setEditCurrentContent = (value) => {
    if (!editingArticle) return;
    const rt = calculateReadingTime(editActiveLang === 'fr' ? value : (editingArticle.translations?.fr?.content ?? editingArticle.content ?? ''));
    if (editActiveLang === 'fr') {
      setEditingArticle(prev => ({ ...prev, content: value, readingTime: rt }));
    } else {
      setEditingArticle(prev => ({
        ...prev,
        translations: {
          ...prev.translations,
          [editActiveLang]: { ...prev.translations?.[editActiveLang], content: value }
        },
        readingTime: rt
      }));
    }
  };
  const insertHtmlAtCursorEdit = (html) => {
    const ta = editContentTextareaRef.current;
    const content = getEditCurrentContent();
    if (!ta) {
      setEditCurrentContent(content + html);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newContent = content.substring(0, start) + html + content.substring(end);
    setEditCurrentContent(newContent);
    setTimeout(() => {
      ta.focus();
      const pos = start + html.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };
  const formatContentEdit = (format) => {
    const ta = editContentTextareaRef.current;
    const content = getEditCurrentContent();
    const start = ta ? ta.selectionStart : content.length;
    const end = ta ? ta.selectionEnd : content.length;
    const selectedText = content.substring(start, end);
    let html = '';
    switch (format) {
      case 'h2':
        html = selectedText ? `<h2>${selectedText}</h2>` : '<h2>Titre de section</h2>';
        break;
      case 'h3':
        html = selectedText ? `<h3>${selectedText}</h3>` : '<h3>Sous-titre</h3>';
        break;
      case 'bold':
        html = selectedText ? `<strong>${selectedText}</strong>` : '<strong>texte en gras</strong>';
        break;
      case 'italic':
        html = selectedText ? `<em>${selectedText}</em>` : '<em>texte en italique</em>';
        break;
      case 'list':
        html = selectedText
          ? '<ul>' + selectedText.split('\n').filter(Boolean).map(l => `<li>${l}</li>`).join('') + '</ul>'
          : '<ul>\n<li>Élément 1</li>\n<li>Élément 2</li>\n</ul>';
        break;
      case 'listOrdered':
        html = selectedText
          ? '<ol>' + selectedText.split('\n').filter(Boolean).map(l => `<li>${l}</li>`).join('') + '</ol>'
          : '<ol>\n<li>Premier</li>\n<li>Deuxième</li>\n</ol>';
        break;
      case 'alignLeft':
        html = selectedText ? `<p style="text-align:left">${selectedText}</p>` : '<p style="text-align:left">Paragraphe</p>';
        break;
      case 'alignCenter':
        html = selectedText ? `<p style="text-align:center">${selectedText}</p>` : '<p style="text-align:center">Paragraphe centré</p>';
        break;
      case 'alignRight':
        html = selectedText ? `<p style="text-align:right">${selectedText}</p>` : '<p style="text-align:right">Paragraphe à droite</p>';
        break;
      case 'paragraph':
        html = selectedText ? `<p>${selectedText}</p>` : '<p>Nouveau paragraphe.</p>';
        break;
      default:
        return;
    }
    insertHtmlAtCursorEdit(html);
  };

  const handleInsertImageConfirm = async () => {
    let url = insertImageUrl.trim();
    if (insertImageFile) {
      try {
        setUploadingInlineImage(true);
        const res = await apiService.uploadImage(insertImageFile);
        url = res?.data?.image?.url || res?.image?.url;
        if (!url) throw new Error('URL manquante');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Échec de l\'upload');
        setUploadingInlineImage(false);
        return;
      }
      setUploadingInlineImage(false);
    }
    if (!url) {
      toast.error(t('magazine.indicateUrlOrUpload'));
      return;
    }
    const isEdit = insertTargetMode === 'edit';
    const title = isEdit ? (editingArticle?.title || '') : newArticle.title;
    const alt = title ? `Image - ${title}` : 'Image article';
    const html = `<figure class="article-inline-image"><img src="${url}" alt="${alt}" class="max-w-full h-auto rounded-lg" /><figcaption>Légende (optionnelle)</figcaption></figure>`;
    if (isEdit) {
      insertHtmlAtCursorEdit(html);
    } else {
      insertHtmlAtCursor(html);
    }
    setShowInsertImageModal(false);
    setInsertImageUrl('');
    setInsertImageFile(null);
    setInsertTargetMode('new');
    toast.success(t('magazine.imageInserted'));
  };

  const getVideoEmbedHtml = (url) => {
    const u = url.trim();
    let embedUrl = '';
    if (u.includes('youtube.com/watch?v=')) {
      const m = u.match(/v=([^&]+)/);
      embedUrl = m ? `https://www.youtube.com/embed/${m[1]}` : '';
    } else if (u.includes('youtu.be/')) {
      const m = u.match(/youtu\.be\/([^?]+)/);
      embedUrl = m ? `https://www.youtube.com/embed/${m[1]}` : '';
    } else if (u.includes('vimeo.com/')) {
      const m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
      embedUrl = m ? `https://player.vimeo.com/video/${m[1]}` : '';
    }
    if (embedUrl) {
      return `<figure class="article-inline-video"><div class="aspect-video rounded-lg overflow-hidden"><iframe src="${embedUrl}" title="Vidéo" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full"></iframe></div><figcaption>Légende (optionnelle)</figcaption></figure>`;
    }
    // Vidéo directe (bibliothèque média : .mp4, .webm, etc.)
    if (u.startsWith('http://') || u.startsWith('https://') || u.startsWith('/')) {
      return `<figure class="article-inline-video"><div class="aspect-video rounded-lg overflow-hidden"><video src="${u}" controls class="w-full h-full" playsinline></video></div><figcaption>Légende (optionnelle)</figcaption></figure>`;
    }
    return null;
  };

  const handleInsertVideoConfirm = () => {
    const html = getVideoEmbedHtml(insertVideoUrl);
    if (!html) {
      toast.error(t('magazine.urlNotRecognized'));
      return;
    }
    if (insertTargetMode === 'edit') {
      insertHtmlAtCursorEdit(html);
    } else {
      insertHtmlAtCursor(html);
    }
    setShowInsertVideoModal(false);
    setInsertVideoUrl('');
    setInsertTargetMode('new');
    toast.success(t('magazine.videoInserted'));
  };

  // Charger la bibliothèque média (vidéos) à l'ouverture de la modale vidéo
  useEffect(() => {
    if (!showInsertVideoModal) return;
    let cancelled = false;
    setLoadingMediaLibrary(true);
    setMediaLibraryVideos([]);
    apiService.getMediaLibrary()
      .then((res) => {
        if (cancelled) return;
        const data = res?.data?.media ?? res?.media ?? [];
        const videos = Array.isArray(data) ? data.filter((m) => m.type === 'video') : [];
        setMediaLibraryVideos(videos);
      })
      .catch(() => {
        if (!cancelled) setMediaLibraryVideos([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingMediaLibrary(false);
      });
    return () => { cancelled = true; };
  }, [showInsertVideoModal]);

  useEffect(() => {
    const content = newArticle.translations?.fr?.content || newArticle.content;
    if (!content) return;
    const readingTime = calculateReadingTime(content);
    setNewArticle(prev => (prev.readingTime === readingTime ? prev : { ...prev, readingTime }));
  }, [newArticle.translations?.fr?.content, newArticle.content]);

  const handleAddArticle = async () => {
    const frTitle = (newArticle.translations?.fr?.title ?? newArticle.title)?.trim();
    const frExcerpt = (newArticle.translations?.fr?.excerpt ?? newArticle.excerpt)?.trim() ?? '';
    const frContent = (newArticle.translations?.fr?.content ?? newArticle.content)?.trim();
    if (!frTitle || !newArticle.category || !frContent) {
      toast.error(t('magazine.fillTitleCategoryContent'));
      return;
    }
    if (newArticle.countries.length === 0) {
      toast.error(t('magazine.selectCountries'));
      return;
    }
    let imageUrl = newArticle.imageUrl;
    if (imageFile) {
      try {
        setUploadingImage(true);
        const res = await apiService.uploadImage(imageFile);
        imageUrl = res?.image?.path || res?.data?.image?.path || res?.image?.url || res?.data?.image?.url;
        if (!imageUrl) throw new Error('URL image manquante');
      } catch (err) {
        toast.error(err.response?.data?.message || 'Échec de l\'upload de l\'image');
        setUploadingImage(false);
        return;
      }
      setUploadingImage(false);
    }
    if (!imageUrl) {
      toast.error(t('magazine.addImage'));
      return;
    }
    try {
      // Multilingue 100 % en base : pas de traduction en ligne. On enregistre toutes les langues renseignées (fr + en, es, it, de, ar).
      const translations = {
        fr: { title: frTitle, excerpt: frExcerpt, content: frContent }
      };
      LANG_LIST.forEach(({ code }) => {
        if (code === 'fr') return;
        const t = newArticle.translations?.[code] || {};
        if (t.title?.trim() || t.excerpt?.trim() || t.content?.trim()) {
          translations[code] = { title: t.title || '', excerpt: t.excerpt || '', content: t.content || '' };
        }
      });
      const payload = {
        title: frTitle,
        excerpt: frExcerpt,
        content: frContent,
        category: newArticle.category,
        author: newArticle.author?.trim() || 'Rédaction GNV',
        imageUrl,
        status: newArticle.status,
        publishedAt: newArticle.status === 'published' ? new Date().toISOString() :
          (newArticle.status === 'scheduled' && publishDate && publishTime ? new Date(`${publishDate}T${publishTime}`).toISOString() : null),
        featured: !!newArticle.featured,
        allowComments: newArticle.allowComments !== false,
        readingTime: newArticle.readingTime || 0,
        countries: newArticle.countries,
        tags: newArticle.tags,
        metaDescription: newArticle.metaDescription || '',
        metaKeywords: newArticle.metaKeywords || '',
        gallery: galleryImages.map(img => ({ url: img.preview, caption: '' }))
      };
      payload.translations = translations;
      const createRes = await apiService.createArticle(payload);
      const createdArticle = createRes?.data?.data ?? createRes?.data;
      if (createdArticle) {
        const withId = { ...createdArticle, _id: createdArticle._id || createdArticle.id, id: createdArticle.id || createdArticle._id, updatedAt: Date.now() };
        setArticles(prev => [withId, ...prev]);
      }
      toast.success(t('magazine.articleCreated'));
      if (Object.keys(translations).length > 1) toast.success(t('common.contentAddedByLanguage'));
      setShowAddModal(false);
      setImageFile(null);
      setImagePreview(null);
      setGalleryImages([]);
      setPublishDate('');
      setPublishTime('');
      setShowPreview(false);
      setNewArticle({
        title: '',
        excerpt: '',
        content: '',
        category: '',
        author: '',
        imageUrl: '',
        isPublished: false,
        status: 'draft',
        countries: [],
        tags: [],
        metaDescription: '',
        metaKeywords: '',
        featured: false,
        allowComments: true,
        readingTime: 0,
        translations: emptyTranslations()
      });
      fetchArticles();
    } catch (error) {
      console.error('Erreur création article:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de l\'ajout de l\'article');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const publishedArticles = articles.filter(a => a.isPublished);
  const totalViews = articles.reduce((sum, a) => sum + (a.views || 0), 0);
  const totalLikes = articles.reduce((sum, a) => sum + (a.likes || 0), 0);

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* En-tête compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">{t('magazine.title')}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? t('common.loading') : t('magazine.articlesCount', { count: articles.length }) || `${articles.length} article(s)`}
          </p>
        </div>
        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            setImageFile(null);
            setImagePreview(null);
            setGalleryImages([]);
            setPublishDate('');
            setPublishTime('');
            setShowPreview(false);
            setActiveLang('fr');
            setShowInsertImageModal(false);
            setShowInsertVideoModal(false);
            setInsertTargetMode('new');
            setNewArticle({
              title: '',
              excerpt: '',
              content: '',
              category: '',
              author: '',
              imageUrl: '',
              isPublished: false,
              status: 'draft',
              countries: [],
              tags: [],
              metaDescription: '',
              metaKeywords: '',
              featured: false,
              allowComments: true,
              readingTime: 0,
              translations: emptyTranslations()
            });
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-indigo-700 transition-colors shrink-0"
          title={t('magazine.addArticle')}
        >
          <Plus size={18} />
          {t('magazine.addArticle')}
        </motion.button>
      </div>

      {/* Stats compactes */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100"><BookOpen size={18} className="text-slate-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('magazine.totalArticles')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{articles.length}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50"><BookOpen size={18} className="text-emerald-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('magazine.published')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{publishedArticles.length}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50"><Eye size={18} className="text-violet-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('magazine.totalViews')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{totalViews.toLocaleString()}</p></div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-50"><Heart size={18} className="text-pink-600" /></div>
          <div><p className="text-xs font-medium text-slate-500">{t('magazine.totalLikes')}</p><p className="text-lg font-semibold text-slate-800 tabular-nums">{totalLikes.toLocaleString()}</p></div>
        </div>
      </div>

      {/* Recherche + catégorie + Filtres avancés repliables */}
      <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center p-3 sm:p-4">
          <div className="relative flex-1 min-w-0">
            <Filter size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={t('magazine.search') || 'Rechercher...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50/80 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex rounded-xl border border-slate-200 bg-slate-50/80 p-1 gap-0.5 shrink-0">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3.5 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">{t('magazine.allCategories')}</option>
              {categories.map(category => (
                <option key={category} value={category}>{getCategoryLabel(category)}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200/80 bg-slate-50/80 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <SlidersHorizontal size={18} />
            {t('common.advancedFilters') || 'Filtres avancés'}
            {(countryFilter !== 'all' || destinationFilter !== 'all' || shipFilter !== 'all') && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-100 px-1.5 text-xs font-semibold text-indigo-700">
                {[countryFilter, destinationFilter, shipFilter].filter(v => v !== 'all').length}
              </span>
            )}
            <ChevronDown size={16} className={`transition-transform ${filtersExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {filtersExpanded && (
          <div className="border-t border-slate-200/80 p-4 bg-slate-50/30">
            <FilterBar
              countryFilter={countryFilter}
              setCountryFilter={setCountryFilter}
              destinationFilter={destinationFilter}
              setDestinationFilter={setDestinationFilter}
              shipFilter={shipFilter}
              setShipFilter={setShipFilter}
            />
          </div>
        )}
      </div>

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredArticles.map((article) => (
          <motion.div
            key={article._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-slate-200/80 overflow-hidden hover:border-slate-300 hover:shadow-md transition-all"
          >
            <div className="aspect-video bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center relative overflow-hidden">
              {(article.imageUrl || article.image) ? (
                <>
                  <img
                    src={getImageSrc(article.imageUrl || article.image, article.updatedAt)}
                    alt={getDisplayTitle(article, language)}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      const placeholder = e.target.nextElementSibling;
                      if (placeholder) placeholder.style.display = 'flex';
                    }}
                  />
                  <div className="absolute inset-0 hidden flex items-center justify-center bg-gray-200" style={{ display: 'none' }}>
                    <BookOpen size={48} className="text-gray-400" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                </>
              ) : (
                <BookOpen size={48} className="text-gray-400" />
              )}
              {article.isPublished && (
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                  {t('magazine.publishedBadge')}
                </div>
              )}
              {article.isFeatured && (
                <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full text-xs font-semibold">
                  ⭐ {t('magazine.featuredBadge')}
                </div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">
                  {getCategoryLabel(article.category)}
                </span>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Eye size={14} />
                    {article.views || 0}
                  </div>
                  <div className="flex items-center gap-1">
                    <Heart size={14} />
                    {article.likes || 0}
                  </div>
                </div>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{getDisplayTitle(article, language)}</h3>
              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{getDisplayExcerpt(article, language) || t('magazine.noExcerpt')}</p>
              {article.tags && article.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {article.tags.slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Calendar size={14} />
                  {new Date(article.createdAt).toLocaleDateString(
                  ({ fr: 'fr-FR', en: 'en-US', ar: 'ar-EG', es: 'es-ES', it: 'it-IT' })[language] || 'fr-FR',
                  { day: 'numeric', month: 'short', year: 'numeric' }
                )}
                </div>
                <div className="text-xs text-gray-500 font-medium">
                  {article.author || t('magazine.unknownAuthor')}
                </div>
              </div>
              {article.readTime && (
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                  <Clock size={12} />
                  <span>{article.readTime} {t('magazine.minRead')}</span>
                </div>
              )}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => handleEditArticle(article)}
                  className="flex-1 flex items-center justify-center gap-2 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Edit size={16} />
                  <span className="text-xs">{t('magazine.modify')}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDeleteArticle(article, e)}
                  className="flex-1 flex items-center justify-center gap-2 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                  <span className="text-xs">{t('magazine.delete')}</span>
                </button>
              </div>
            </div>
          </motion.div>
        ))}
        {filteredArticles.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center min-h-[280px] py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 mb-4">
              <BookOpen size={32} className="text-slate-400" />
            </div>
            <p className="text-slate-500 text-sm">{t('magazine.noArticleFound')}</p>
          </div>
        )}
      </div>

      {/* Modal Ajouter Article */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">{t('magazine.addArticle')}</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setImageFile(null);
                  setImagePreview(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6 space-y-6">
              {!showPreview ? (
                <>
              {/* Onglets langues (contenu multilingue) */}
              <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
                {LANG_LIST.map(({ code, label }) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setActiveLang(code)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeLang === code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Titre / Extrait / Contenu selon langue active */}
              {activeLang === 'fr' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('magazine.titleFrench')}</label>
                    <input
                      type="text"
                      value={newArticle.title}
                      onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('magazine.articleTitlePlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('magazine.excerptFrench')}</label>
                    <textarea
                      value={newArticle.excerpt}
                      onChange={(e) => setNewArticle({ ...newArticle, excerpt: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder={t('magazine.summaryPlaceholder')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('magazine.contentFrench')}</label>
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-300">
                        <span className="text-xs font-medium text-gray-500 mr-2">{t('magazine.layoutToolbar')}</span>
                        <button type="button" onClick={() => formatContent('h2')} className="p-2 rounded hover:bg-gray-200" title="Titre 2"><Heading2 size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('h3')} className="p-2 rounded hover:bg-gray-200" title="Titre 3"><Heading3 size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('paragraph')} className="p-2 rounded hover:bg-gray-200" title="Paragraphe"><FileText size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('bold')} className="p-2 rounded hover:bg-gray-200" title="Gras"><Bold size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('italic')} className="p-2 rounded hover:bg-gray-200" title="Italique"><Italic size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('list')} className="p-2 rounded hover:bg-gray-200" title="Liste à puces"><List size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('listOrdered')} className="p-2 rounded hover:bg-gray-200 text-sm font-bold" title="Liste numérotée">1.</button>
                        <button type="button" onClick={() => formatContent('alignLeft')} className="p-2 rounded hover:bg-gray-200" title="Aligner à gauche"><AlignLeft size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('alignCenter')} className="p-2 rounded hover:bg-gray-200" title="Centrer"><AlignCenter size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('alignRight')} className="p-2 rounded hover:bg-gray-200" title="Aligner à droite"><AlignRight size={18} className="text-gray-700" /></button>
                        <span className="border-l border-gray-300 h-5 mx-1" />
                        <button type="button" onClick={() => setShowInsertImageModal(true)} className="flex items-center gap-1 px-2 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm" title="Insérer une image"><ImageIcon size={18} /> Image</button>
                        <button type="button" onClick={() => setShowInsertVideoModal(true)} className="flex items-center gap-1 px-2 py-1.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 text-sm" title="Insérer une vidéo"><Video size={18} /> Vidéo</button>
                      </div>
                      <textarea
                        ref={contentTextareaRef}
                        value={newArticle.content}
                        onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
                        className="w-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={8}
                        placeholder={t('magazine.contentPlaceholder')}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Titre ({LANG_LIST.find(l => l.code === activeLang)?.label})</label>
                    <input
                      type="text"
                      value={newArticle.translations?.[activeLang]?.title || ''}
                      onChange={(e) => setNewArticle({
                        ...newArticle,
                        translations: {
                          ...newArticle.translations,
                          [activeLang]: { ...newArticle.translations?.[activeLang], title: e.target.value }
                        }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Title"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('magazine.excerptLabel')}</label>
                    <textarea
                      value={newArticle.translations?.[activeLang]?.excerpt || ''}
                      onChange={(e) => setNewArticle({
                        ...newArticle,
                        translations: {
                          ...newArticle.translations,
                          [activeLang]: { ...newArticle.translations?.[activeLang], excerpt: e.target.value }
                        }
                      })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="Excerpt"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('magazine.contentLabel')}</label>
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-300">
                        <span className="text-xs font-medium text-gray-500 mr-2">{t('magazine.layoutToolbar')}</span>
                        <button type="button" onClick={() => formatContent('h2')} className="p-2 rounded hover:bg-gray-200" title="Titre 2"><Heading2 size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('h3')} className="p-2 rounded hover:bg-gray-200" title="Titre 3"><Heading3 size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('paragraph')} className="p-2 rounded hover:bg-gray-200" title="Paragraphe"><FileText size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('bold')} className="p-2 rounded hover:bg-gray-200" title="Gras"><Bold size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('italic')} className="p-2 rounded hover:bg-gray-200" title="Italique"><Italic size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('list')} className="p-2 rounded hover:bg-gray-200" title="Liste à puces"><List size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('listOrdered')} className="p-2 rounded hover:bg-gray-200 text-sm font-bold" title="Liste numérotée">1.</button>
                        <button type="button" onClick={() => formatContent('alignLeft')} className="p-2 rounded hover:bg-gray-200" title="Aligner à gauche"><AlignLeft size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('alignCenter')} className="p-2 rounded hover:bg-gray-200" title="Centrer"><AlignCenter size={18} className="text-gray-700" /></button>
                        <button type="button" onClick={() => formatContent('alignRight')} className="p-2 rounded hover:bg-gray-200" title="Aligner à droite"><AlignRight size={18} className="text-gray-700" /></button>
                        <span className="border-l border-gray-300 h-5 mx-1" />
                        <button type="button" onClick={() => setShowInsertImageModal(true)} className="flex items-center gap-1 px-2 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm"><ImageIcon size={18} /> Image</button>
                        <button type="button" onClick={() => setShowInsertVideoModal(true)} className="flex items-center gap-1 px-2 py-1.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 text-sm"><Video size={18} /> Vidéo</button>
                      </div>
                      <textarea
                        ref={contentTextareaRef}
                        value={newArticle.translations?.[activeLang]?.content || ''}
                        onChange={(e) => setNewArticle({
                          ...newArticle,
                          translations: {
                            ...newArticle.translations,
                            [activeLang]: { ...newArticle.translations?.[activeLang], content: e.target.value }
                          }
                        })}
                        className="w-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={8}
                        placeholder={t('magazine.contentPlaceholderOther')}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Catégorie et Auteur */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('magazine.categoryLabel')}
                  </label>
                  <select
                    value={newArticle.category}
                    onChange={(e) => setNewArticle({ ...newArticle, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('magazine.selectCategory')}</option>
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('magazine.authorLabel')}
                  </label>
                  <input
                    type="text"
                    value={newArticle.author}
                    onChange={(e) => setNewArticle({ ...newArticle, author: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={t('magazine.authorPlaceholder')}
                  />
                </div>
              </div>

              {/* Upload image (obligatoire — enregistrée sur le serveur) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('magazine.coverImageLabel')}
                </label>
                {imagePreview ? (
                  <div className="relative">
                    <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-white border border-gray-200">
                          <img
                            src={imagePreview}
                            alt="Image preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {imageFile?.name || t('magazine.imageSelected')}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {imageFile ? `${(imageFile.size / 1024).toFixed(2)} KB` : 'Image existante'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removeImage}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload size={32} className="text-gray-400 mb-2" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">{t('magazine.clickToUpload')}</span> {t('magazine.orDragDrop')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('magazine.imageFormatMax')}
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Pays */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('magazine.countriesLabel')}
                </label>
                <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                  {availableCountries.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">{t('magazine.noCountriesAvailable')}</p>
                  ) : (
                    <div className="space-y-2">
                      {availableCountries.map((country) => (
                        <label
                          key={country.code}
                          className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={newArticle.countries.includes(country.name)}
                            onChange={() => toggleCountry(country.name)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1 flex items-center gap-2">
                            <span className="font-medium text-gray-900">{country.name}</span>
                            <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">
                              {country.code}
                            </span>
                          </div>
                          {newArticle.countries.includes(country.name) && (
                            <MapPin size={16} className="text-blue-600" />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {newArticle.countries.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {t('magazine.countriesSelectedCount', { count: newArticle.countries.length })}
                  </p>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('magazine.tagsLabel')}
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {newArticle.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-blue-900"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('magazine.tagsPlaceholder')}
                />
              </div>

              {/* Galerie d'images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('magazine.galleryLabel')}
                </label>
                {galleryImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {galleryImages.map((img) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.preview}
                          alt="Gallery"
                          className="w-full h-24 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => removeGalleryImage(img.id)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col items-center justify-center">
                    <ImageIcon size={20} className="text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">{t('magazine.addImagesLabel')}</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleGalleryUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Métadonnées SEO */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Globe size={16} />
                  {t('magazine.seoMetadata')}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('magazine.metaDescriptionLabel')}
                    </label>
                    <textarea
                      value={newArticle.metaDescription}
                      onChange={(e) => setNewArticle({ ...newArticle, metaDescription: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder={t('magazine.metaDescriptionPlaceholder')}
                      maxLength={160}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {newArticle.metaDescription.length}/160 caractères
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('magazine.metaKeywordsLabel')}
                    </label>
                    <input
                      type="text"
                      value={newArticle.metaKeywords}
                      onChange={(e) => setNewArticle({ ...newArticle, metaKeywords: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('magazine.metaKeywordsPlaceholder')}
                    />
                  </div>
                </div>
              </div>

              {/* Statut de publication */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">{t('magazine.publicationLabel')}</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('magazine.statusLabel')}
                    </label>
                    <select
                      value={newArticle.status}
                      onChange={(e) => {
                        setNewArticle({ ...newArticle, status: e.target.value, isPublished: e.target.value === 'published' });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="draft">Brouillon</option>
                      <option value="published">Publié</option>
                      <option value="scheduled">Planifié</option>
                    </select>
                  </div>

                  {newArticle.status === 'scheduled' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Date de publication
                        </label>
                        <input
                          type="date"
                          value={publishDate}
                          onChange={(e) => setPublishDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Heure de publication
                        </label>
                        <input
                          type="time"
                          value={publishTime}
                          onChange={(e) => setPublishTime(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newArticle.featured}
                        onChange={(e) => setNewArticle({ ...newArticle, featured: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Article mis en avant</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newArticle.allowComments}
                        onChange={(e) => setNewArticle({ ...newArticle, allowComments: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">Autoriser les commentaires</span>
                    </label>
                  </div>
                </div>
              </div>
                </>
              ) : (
                /* Aperçu */
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <article>
                    {imagePreview && (
                      <div className="mb-4">
                        <img
                          src={imagePreview}
                          alt={newArticle.title}
                          className="w-full h-64 object-cover rounded-lg"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                        {newArticle.category || 'Non catégorisé'}
                      </span>
                      {newArticle.featured && (
                        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                          ⭐ Mis en avant
                        </span>
                      )}
                      <span className="text-sm text-gray-500">
                        {newArticle.readingTime} min de lecture
                      </span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">{newArticle.title || 'Titre de l\'article'}</h1>
                    {newArticle.excerpt && (
                      <p className="text-lg text-gray-600 mb-6 italic">{newArticle.excerpt}</p>
                    )}
                    {newArticle.author && (
                      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
                        <span>Par {newArticle.author}</span>
                        <span>•</span>
                        <span>{new Date().toLocaleDateString('fr-FR')}</span>
                      </div>
                    )}
                    <div className="prose max-w-none text-gray-700 leading-relaxed">
                      {newArticle.content ? (
                        <div
                          className="article-preview-content"
                          dangerouslySetInnerHTML={{ __html: newArticle.content }}
                        />
                      ) : (
                        <p className="text-gray-500">Le contenu de l'article apparaîtra ici...</p>
                      )}
                    </div>
                    {newArticle.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-gray-200">
                        {newArticle.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setImageFile(null);
                  setImagePreview(null);
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleAddArticle}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save size={18} />
                {t('magazine.addButton')}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Modifier article (même principe que {t('magazine.addArticle')}) */}
      {editingArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">{t('magazine.editArticle')}</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditPreview(!showEditPreview)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <EyeIcon size={18} />
                  {showEditPreview ? t('magazine.formTab') : t('magazine.previewTab')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingArticle(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={20} className="text-gray-600" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {!showEditPreview ? (
                <>
                  <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
                    {LANG_LIST.map(({ code, label }) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setEditActiveLang(code)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${editActiveLang === code ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {editActiveLang === 'fr' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Titre (français) *</label>
                        <input
                          type="text"
                          value={editingArticle.title || ''}
                          onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Titre de l'article"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Extrait / Résumé (français)</label>
                        <textarea
                          value={editingArticle.excerpt || ''}
                          onChange={(e) => setEditingArticle({ ...editingArticle, excerpt: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder="Résumé court..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Contenu (français) *</label>
                        <div className="border border-gray-300 rounded-lg overflow-hidden">
                          <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-300">
                            <span className="text-xs font-medium text-gray-500 mr-2">{t('magazine.layoutToolbar')}</span>
                            <button type="button" onClick={() => formatContentEdit('h2')} className="p-2 rounded hover:bg-gray-200" title="Titre 2"><Heading2 size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('h3')} className="p-2 rounded hover:bg-gray-200" title="Titre 3"><Heading3 size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('paragraph')} className="p-2 rounded hover:bg-gray-200" title="Paragraphe"><FileText size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('bold')} className="p-2 rounded hover:bg-gray-200" title="Gras"><Bold size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('italic')} className="p-2 rounded hover:bg-gray-200" title="Italique"><Italic size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('list')} className="p-2 rounded hover:bg-gray-200" title="Liste à puces"><List size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('listOrdered')} className="p-2 rounded hover:bg-gray-200 text-sm font-bold" title="Liste numérotée">1.</button>
                            <button type="button" onClick={() => formatContentEdit('alignLeft')} className="p-2 rounded hover:bg-gray-200" title="Aligner à gauche"><AlignLeft size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('alignCenter')} className="p-2 rounded hover:bg-gray-200" title="Centrer"><AlignCenter size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('alignRight')} className="p-2 rounded hover:bg-gray-200" title="Aligner à droite"><AlignRight size={18} className="text-gray-700" /></button>
                            <span className="border-l border-gray-300 h-5 mx-1" />
                            <button type="button" onClick={() => { setInsertTargetMode('edit'); setShowInsertImageModal(true); }} className="flex items-center gap-1 px-2 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm"><ImageIcon size={18} /> Image</button>
                            <button type="button" onClick={() => { setInsertTargetMode('edit'); setShowInsertVideoModal(true); }} className="flex items-center gap-1 px-2 py-1.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 text-sm"><Video size={18} /> Vidéo</button>
                          </div>
                          <textarea
                            ref={editContentTextareaRef}
                            value={editingArticle.content || ''}
                            onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                            className="w-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={8}
                            placeholder={t('magazine.contentPlaceholder')}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('magazine.titleField')} ({LANG_LIST.find(l => l.code === editActiveLang)?.label})</label>
                        <input
                          type="text"
                          value={editingArticle.translations?.[editActiveLang]?.title || ''}
                          onChange={(e) => setEditingArticle({
                            ...editingArticle,
                            translations: {
                              ...editingArticle.translations,
                              [editActiveLang]: { ...editingArticle.translations?.[editActiveLang], title: e.target.value }
                            }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Title"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('magazine.excerptLabel')}</label>
                        <textarea
                          value={editingArticle.translations?.[editActiveLang]?.excerpt || ''}
                          onChange={(e) => setEditingArticle({
                            ...editingArticle,
                            translations: {
                              ...editingArticle.translations,
                              [editActiveLang]: { ...editingArticle.translations?.[editActiveLang], excerpt: e.target.value }
                            }
                          })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder="Excerpt"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('magazine.contentLabel')}</label>
                        <div className="border border-gray-300 rounded-lg overflow-hidden">
                          <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-300">
                            <span className="text-xs font-medium text-gray-500 mr-2">{t('magazine.layoutToolbar')}</span>
                            <button type="button" onClick={() => formatContentEdit('h2')} className="p-2 rounded hover:bg-gray-200"><Heading2 size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('h3')} className="p-2 rounded hover:bg-gray-200"><Heading3 size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('paragraph')} className="p-2 rounded hover:bg-gray-200"><FileText size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('bold')} className="p-2 rounded hover:bg-gray-200"><Bold size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('italic')} className="p-2 rounded hover:bg-gray-200"><Italic size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('list')} className="p-2 rounded hover:bg-gray-200"><List size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('listOrdered')} className="p-2 rounded hover:bg-gray-200 text-sm font-bold">1.</button>
                            <button type="button" onClick={() => formatContentEdit('alignLeft')} className="p-2 rounded hover:bg-gray-200"><AlignLeft size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('alignCenter')} className="p-2 rounded hover:bg-gray-200"><AlignCenter size={18} className="text-gray-700" /></button>
                            <button type="button" onClick={() => formatContentEdit('alignRight')} className="p-2 rounded hover:bg-gray-200"><AlignRight size={18} className="text-gray-700" /></button>
                            <span className="border-l border-gray-300 h-5 mx-1" />
                            <button type="button" onClick={() => { setInsertTargetMode('edit'); setShowInsertImageModal(true); }} className="flex items-center gap-1 px-2 py-1.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm"><ImageIcon size={18} /> Image</button>
                            <button type="button" onClick={() => { setInsertTargetMode('edit'); setShowInsertVideoModal(true); }} className="flex items-center gap-1 px-2 py-1.5 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 text-sm"><Video size={18} /> Vidéo</button>
                          </div>
                          <textarea
                            ref={editContentTextareaRef}
                            value={editingArticle.translations?.[editActiveLang]?.content || ''}
                            onChange={(e) => setEditingArticle({
                              ...editingArticle,
                              translations: {
                                ...editingArticle.translations,
                                [editActiveLang]: { ...editingArticle.translations?.[editActiveLang], content: e.target.value }
                              }
                            })}
                            className="w-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows={8}
                            placeholder={t('magazine.contentPlaceholderOther')}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('magazine.categoryLabel')}</label>
                      <select
                        value={editingArticle.category || ''}
                        onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">{t('magazine.selectCategory')}</option>
                        {availableCategories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('magazine.authorLabel')}</label>
                      <input
                        type="text"
                        value={editingArticle.author || ''}
                        onChange={(e) => setEditingArticle({ ...editingArticle, author: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('magazine.authorPlaceholder')}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('magazine.coverImageLabel').replace(' *', '')}</label>
                    {(editImagePreview || editingArticle.imageUrl) ? (
                      <div className="relative">
                        <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
                          <div className="flex items-center gap-4">
                            <div className="relative w-32 h-24 rounded-lg overflow-hidden bg-white border border-gray-200">
                              <img
                                src={
                                  typeof editImagePreview === 'string' && editImagePreview.startsWith('data:')
                                    ? editImagePreview
                                    : getImageSrc(editImagePreview || editingArticle.imageUrl) || editImagePreview || editingArticle.imageUrl
                                }
                                alt="Couverture"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-gray-900 w-full">{editImageFile?.name || t('magazine.currentImage')}</p>
                              <button
                                type="button"
                                onClick={() => editCoverInputRef.current?.click()}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg"
                              >
                                <Upload size={16} />
                                {t('magazine.changeImage')}
                              </button>
                              <button type="button" onClick={removeEditImage} className="inline-flex items-center gap-2 p-2 text-red-600 hover:bg-red-50 rounded-lg" title={t('magazine.removeImageLabel')}>
                                <X size={18} />
                                <span className="text-sm">{t('magazine.removeImageLabel')}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                        <input ref={editCoverInputRef} type="file" accept="image/*" onChange={handleEditImageUpload} className="hidden" />
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                        <Upload size={32} className="text-gray-400 mb-2" />
                        <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">{t('magazine.clickToUpload')}</span> {t('magazine.orDragDrop')}</p>
                        <p className="text-xs text-gray-500">{t('magazine.imageFormatMax')}</p>
                        <input type="file" accept="image/*" onChange={handleEditImageUpload} className="hidden" />
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Affecter aux pays</label>
                    <div className="border border-gray-200 rounded-lg p-4 max-h-48 overflow-y-auto">
                      <div className="space-y-2">
                        {availableCountries.map((country) => (
                          <label key={country.code} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                            <input
                              type="checkbox"
                              checked={(editingArticle.countries || []).includes(country.name)}
                              onChange={() => toggleEditCountry(country.name)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="font-medium text-gray-900">{country.name}</span>
                            <span className="text-xs text-gray-500 px-2 py-0.5 bg-gray-100 rounded">{country.code}</span>
                            {(editingArticle.countries || []).includes(country.name) && <MapPin size={16} className="text-blue-600" />}
                          </label>
                        ))}
                      </div>
                    </div>
                    {(editingArticle.countries || []).length > 0 && (
                      <p className="text-xs text-gray-500 mt-2">{(editingArticle.countries || []).length} pays sélectionné(s)</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tags / Mots-clés</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {(editingArticle.tags || []).map((tag, index) => (
                        <span key={index} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {tag}
                          <button type="button" onClick={() => removeEditTag(tag)} className="hover:text-blue-900"><X size={14} /></button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEditAddTag(e.target.value); e.target.value = ''; } }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Appuyez sur Entrée pour ajouter un tag"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Galerie d'images</label>
                    {editGalleryImages.length > 0 && (
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        {editGalleryImages.map((img) => (
                          <div key={img.id} className="relative group">
                            <img src={img.preview} alt="Galerie" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                            <button type="button" onClick={() => removeEditGalleryImage(img.id)} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                      <div className="flex flex-col items-center justify-center"><ImageIcon size={20} className="text-gray-400 mb-1" /><p className="text-xs text-gray-500">Ajouter des images</p></div>
                      <input type="file" accept="image/*" multiple onChange={handleEditGalleryUpload} className="hidden" />
                    </label>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2"><Globe size={16} /> Métadonnées SEO</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Meta Description</label>
                        <textarea
                          value={editingArticle.metaDescription || ''}
                          onChange={(e) => setEditingArticle({ ...editingArticle, metaDescription: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={2}
                          placeholder="Description pour les moteurs de recherche (150-160 caractères)"
                          maxLength={160}
                        />
                        <p className="text-xs text-gray-500 mt-1">{(editingArticle.metaDescription || '').length}/160 caractères</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Meta Keywords</label>
                        <input
                          type="text"
                          value={editingArticle.metaKeywords || ''}
                          onChange={(e) => setEditingArticle({ ...editingArticle, metaKeywords: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Mots-clés séparés par des virgules"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Publication</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
                        <select
                          value={editingArticle.status || 'draft'}
                          onChange={(e) => setEditingArticle({ ...editingArticle, status: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="draft">Brouillon</option>
                          <option value="published">Publié</option>
                          <option value="scheduled">Planifié</option>
                        </select>
                      </div>
                      {editingArticle.status === 'scheduled' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Date de publication</label>
                            <input type="date" value={editPublishDate} onChange={(e) => setEditPublishDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Heure de publication</label>
                            <input type="time" value={editPublishTime} onChange={(e) => setEditPublishTime(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={!!editingArticle.featured} onChange={(e) => setEditingArticle({ ...editingArticle, featured: e.target.checked })} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                          <span className="text-sm font-medium text-gray-700">Article mis en avant</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" checked={editingArticle.allowComments !== false} onChange={(e) => setEditingArticle({ ...editingArticle, allowComments: e.target.checked })} className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
                          <span className="text-sm font-medium text-gray-700">Autoriser les commentaires</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <article>
                    {(editImagePreview || editingArticle.imageUrl) && (
                      <div className="mb-4">
                        <img src={editImagePreview || editingArticle.imageUrl} alt={editingArticle.title} className="w-full h-64 object-cover rounded-lg" />
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">{editingArticle.category || 'Non catégorisé'}</span>
                      {editingArticle.featured && <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">⭐ Mis en avant</span>}
                      <span className="text-sm text-gray-500">{editingArticle.readingTime || editingArticle.readTime || 0} min de lecture</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-4">{editingArticle.title || 'Titre'}</h1>
                    {editingArticle.excerpt && <p className="text-lg text-gray-600 mb-6 italic">{editingArticle.excerpt}</p>}
                    {editingArticle.author && <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">Par {editingArticle.author}</div>}
                    <div className="prose max-w-none text-gray-700 leading-relaxed">
                      {editingArticle.content ? <div className="article-preview-content" dangerouslySetInnerHTML={{ __html: editingArticle.content }} /> : <p className="text-gray-500">Le contenu apparaîtra ici...</p>}
                    </div>
                    {(editingArticle.tags || []).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-gray-200">
                        {(editingArticle.tags || []).map((tag, index) => <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">#{tag}</span>)}
                      </div>
                    )}
                  </article>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-4 p-6 border-t border-gray-200">
              <button type="button" onClick={() => setEditingArticle(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
              <button type="button" onClick={handleSaveEdit} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                <Save size={18} />
                Enregistrer
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modales Insérer image / vidéo (partagées entre {t('magazine.addArticle')} et Modifier article) */}
      {showInsertImageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => !uploadingInlineImage && setShowInsertImageModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><ImageIcon size={22} className="text-blue-600" /> Insérer une image dans l'article</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL de l'image (optionnel)</label>
                <input type="url" value={insertImageUrl} onChange={(e) => setInsertImageUrl(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ou uploader un fichier</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                  <Upload size={24} className="text-gray-400 mb-1" />
                  <span className="text-sm text-gray-500">Cliquez ou glissez une image</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setInsertImageFile(f); }} />
                </label>
                {insertImageFile && <p className="text-xs text-gray-600 mt-1 truncate">{insertImageFile.name}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" onClick={() => setShowInsertImageModal(false)} className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
              <button type="button" onClick={handleInsertImageConfirm} disabled={uploadingInlineImage || (!insertImageUrl.trim() && !insertImageFile)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{uploadingInlineImage ? 'Upload...' : 'Insérer'}</button>
            </div>
          </motion.div>
        </div>
      )}
      {showInsertVideoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowInsertVideoModal(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Video size={22} className="text-purple-600" /> Insérer une vidéo dans l'article</h3>

            {/* Bibliothèque média */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Choisir depuis la bibliothèque média</label>
              {loadingMediaLibrary ? (
                <p className="text-sm text-gray-500 py-2">Chargement des vidéos...</p>
              ) : mediaLibraryVideos.length > 0 ? (
                <ul className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 bg-gray-50">
                  {mediaLibraryVideos.map((v) => (
                    <li key={v.path || v.url} className="flex items-center justify-between gap-2 py-2 px-2 rounded hover:bg-gray-100">
                      <span className="text-sm text-gray-800 truncate flex-1" title={v.name}>{v.name}</span>
                      {v.duration != null && <span className="text-xs text-gray-500 shrink-0">{Math.floor(v.duration / 60)}:{(v.duration % 60).toString().padStart(2, '0')}</span>}
                      <button type="button" onClick={() => setInsertVideoUrl(v.path || v.url || '')} className="shrink-0 px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">Choisir</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 py-2">Aucune vidéo dans la bibliothèque. Uploadez des vidéos dans la section appropriée.</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ou coller une URL (YouTube, Vimeo ou lien direct)</label>
              <input type="url" value={insertVideoUrl} onChange={(e) => setInsertVideoUrl(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="https://www.youtube.com/... ou URL d'une vidéo" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowInsertVideoModal(false)} className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Annuler</button>
              <button type="button" onClick={handleInsertVideoConfirm} disabled={!insertVideoUrl.trim()} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">Insérer</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Magazine;




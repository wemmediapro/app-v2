/**
 * Hook boutique : chargement produits/promos, filtres, catégories (audit CTO — découpage App.jsx).
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { apiService } from '../services/apiService';

export function useShop(language, t) {
  const [shopProducts, setShopProducts] = useState([]);
  const [shopPromotions, setShopPromotions] = useState([]);
  const [shopSearchQuery, setShopSearchQuery] = useState('');
  const [selectedShopCategory, setSelectedShopCategory] = useState('all');
  const [shopLoading, setShopLoading] = useState(true);
  const [shopError, setShopError] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedProductImageIndex, setSelectedProductImageIndex] = useState(0);

  const shopCategories = useMemo(
    () => [
      { id: 'all', name: t('shop.categories.all'), icon: '🛍️' },
      { id: 'souvenirs', name: t('shop.categories.souvenirs'), icon: '🎁' },
      { id: 'dutyfree', name: t('shop.categories.dutyfree'), icon: '🍷' },
      { id: 'fashion', name: t('shop.categories.fashion'), icon: '👕' },
      { id: 'electronics', name: t('shop.categories.electronics'), icon: '📱' },
      { id: 'food', name: t('shop.categories.food'), icon: '🍯' },
    ],
    [t]
  );

  const getProductTypeLabel = useCallback(
    (type) => {
      if (!type) return '';
      const v = String(type).trim().toLowerCase();
      if (v === 'catégorie' || v === 'category') return t('shop.typeCategory');
      if (v === 'produit' || v === 'product') return t('shop.typeProduct');
      const catIds = ['all', 'souvenirs', 'dutyfree', 'fashion', 'electronics', 'food'];
      if (catIds.includes(v)) return t('shop.categories.' + v);
      return type;
    },
    [t]
  );

  const filteredShopProducts = useMemo(
    () =>
      shopProducts.filter((product) => {
        const matchesCategory = selectedShopCategory === 'all' || product.category === selectedShopCategory;
        const matchesSearch =
          shopSearchQuery === '' ||
          (product.name && product.name.toLowerCase().includes(shopSearchQuery.toLowerCase())) ||
          (product.description && product.description.toLowerCase().includes(shopSearchQuery.toLowerCase())) ||
          (product.features &&
            Array.isArray(product.features) &&
            product.features.some((f) => String(f).toLowerCase().includes(shopSearchQuery.toLowerCase())));
        return matchesCategory && matchesSearch;
      }),
    [shopProducts, selectedShopCategory, shopSearchQuery]
  );

  useEffect(() => {
    let cancelled = false;
    const loadShopProducts = async () => {
      try {
        setShopLoading(true);
        setShopError(null);
        const response = await apiService.getProducts(`lang=${language}`);
        if (cancelled) return;
        const productsData = Array.isArray(response.data)
          ? response.data
          : response.data?.products || response.data?.data || [];
        if (productsData.length > 0) {
          const transformed = productsData.map((product) => ({
            id:
              product.id ||
              (product._id && typeof product._id === 'object' && product._id.toString
                ? product._id.toString()
                : product._id),
            name: product.name,
            type: product.type || 'Produit',
            category: product.category || 'souvenirs',
            price: product.price || 0,
            originalPrice: product.originalPrice || product.price || 0,
            discount: product.discount || 0,
            image: product.image || product.imageUrl || '',
            description: product.description || '',
            gallery: product.gallery || [],
            isAvailable: product.isAvailable !== false,
            stock: product.stock || 0,
            isFeatured: product.isFeatured || false,
            tag: product.tag || '',
            features: product.features || [],
            specifications: product.specifications || {},
          }));
          if (cancelled) return;
          setShopProducts(transformed);
          setSelectedProduct((prev) => {
            if (!prev?.id) return prev;
            const updated = transformed.find((p) => (p.id || p._id) === (prev.id || prev._id));
            return updated ? { ...updated } : prev;
          });
        } else {
          if (cancelled) return;
          setShopProducts([]);
          setSelectedProduct(null);
        }
      } catch (error) {
        console.warn('Erreur chargement boutique:', error);
        if (!cancelled) setShopProducts([]);
        if (!cancelled) {
          const msg = error?.response?.data?.message || error?.message || '';
          const hint =
            error?.response?.status === 503
              ? 'Démarrez MongoDB puis redémarrez le backend.'
              : error?.response?.status === 404 || error?.code === 'ERR_NETWORK'
                ? 'Démarrez le backend (port 3000).'
                : '';
          setShopError(msg + (hint ? ` ${hint}` : ''));
        }
      } finally {
        if (!cancelled) setShopLoading(false);
      }
    };
    const loadShopPromotions = async () => {
      try {
        const response = await apiService.getPromotions();
        const data = response?.data;
        const list = Array.isArray(data) ? data : data?.promotions || data?.data || [];
        if (!cancelled) setShopPromotions((list || []).filter((p) => p.isActive !== false));
      } catch (_) {
        if (!cancelled) setShopPromotions([]);
      }
    };
    loadShopProducts();
    loadShopPromotions();
    return () => {
      cancelled = true;
    };
  }, [language]);

  return {
    shopProducts,
    shopPromotions,
    shopLoading,
    shopError,
    shopSearchQuery,
    setShopSearchQuery,
    selectedShopCategory,
    setSelectedShopCategory,
    shopCategories,
    filteredShopProducts,
    getProductTypeLabel,
    selectedProduct,
    setSelectedProduct,
    selectedProductImageIndex,
    setSelectedProductImageIndex,
  };
}

import { useState } from 'react';
import toast from 'react-hot-toast';
import { apiService } from '../services/apiService';
import { LANG_LIST, emptyMenuTranslations, emptyPromotionTranslations } from '../utils/i18n';
import { DEFAULT_RESTAURANT_IMAGE } from '../utils/restaurantImages';
import { restaurantToFormState } from '../utils/restaurantFormState';
import {
  createEmptyRestaurantForm,
  emptyNewMenuItemState,
  emptyNewPromotionState,
} from '../utils/restaurantModalDefaults';

/**
 * État et actions du formulaire restaurant (modal création / édition).
 */
export function useRestaurantForm({ boatConfig, restaurants, setRestaurants }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [activeLang, setActiveLang] = useState('fr');
  const [newRestaurant, setNewRestaurant] = useState(() => createEmptyRestaurantForm({ shipName: '' }));

  const [newSpecialty, setNewSpecialty] = useState('');
  const [newMenuItem, setNewMenuItem] = useState(() => emptyNewMenuItemState());
  const [menuItemImageFile, setMenuItemImageFile] = useState(null);
  const [menuItemImagePreview, setMenuItemImagePreview] = useState(null);
  const [uploadingMenuItemImage, setUploadingMenuItemImage] = useState(false);
  const [editingMenuItemId, setEditingMenuItemId] = useState(null);

  const [newPromotion, setNewPromotion] = useState(() => emptyNewPromotionState());

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Veuillez sélectionner un fichier image');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Le fichier est trop volumineux (max 5MB)');
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
  };

  const handleMenuItemImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Veuillez sélectionner un fichier image');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Le fichier est trop volumineux (max 5MB)');
        return;
      }
      setMenuItemImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMenuItemImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeMenuItemImage = () => {
    setMenuItemImageFile(null);
    setMenuItemImagePreview(null);
  };

  const addSpecialty = () => {
    if (!newSpecialty.trim()) return;
    const list = newRestaurant.translations?.[activeLang]?.specialties ?? newRestaurant.specialties ?? [];
    if (list.includes(newSpecialty.trim())) return;
    setNewRestaurant({
      ...newRestaurant,
      translations: {
        ...newRestaurant.translations,
        [activeLang]: {
          ...newRestaurant.translations?.[activeLang],
          specialties: [...list, newSpecialty.trim()],
        },
      },
    });
    setNewSpecialty('');
  };

  const removeSpecialty = (specialty) => {
    const list = newRestaurant.translations?.[activeLang]?.specialties ?? newRestaurant.specialties ?? [];
    setNewRestaurant({
      ...newRestaurant,
      translations: {
        ...newRestaurant.translations,
        [activeLang]: {
          ...newRestaurant.translations?.[activeLang],
          specialties: list.filter((s) => s !== specialty),
        },
      },
    });
  };

  const addMenuItem = async () => {
    const name = newMenuItem.translations?.fr?.name || newMenuItem.name || '';
    if (!name.trim() || !newMenuItem.price) {
      toast.error('Veuillez remplir le nom (au moins en français) et le prix');
      return;
    }
    let imageUrl = newMenuItem.image || '';
    if (menuItemImageFile) {
      try {
        setUploadingMenuItemImage(true);
        const up = await apiService.uploadImage(menuItemImageFile);
        imageUrl = up?.image?.path || up?.image?.url || up?.data?.image?.path || up?.data?.image?.url || imageUrl;
      } catch (err) {
        toast.error("Erreur lors de l'upload de l'image du plat");
        setUploadingMenuItemImage(false);
        return;
      } finally {
        setUploadingMenuItemImage(false);
      }
    }
    const menuItem = {
      ...newMenuItem,
      id: editingMenuItemId ?? Date.now(),
      price: parseFloat(newMenuItem.price),
      category: newMenuItem.category || 'main',
      image: imageUrl || undefined,
      name: newMenuItem.translations?.fr?.name || newMenuItem.name || '',
      description: newMenuItem.translations?.fr?.description ?? newMenuItem.description ?? '',
      translations: newMenuItem.translations || emptyMenuTranslations(),
    };
    if (editingMenuItemId) {
      setNewRestaurant({
        ...newRestaurant,
        menu: newRestaurant.menu.map((item) => (item.id === editingMenuItemId ? menuItem : item)),
      });
      toast.success('Plat modifié');
    } else {
      setNewRestaurant({
        ...newRestaurant,
        menu: [...newRestaurant.menu, menuItem],
      });
      toast.success('Plat ajouté au menu');
    }
    setNewMenuItem(emptyNewMenuItemState());
    setMenuItemImageFile(null);
    setMenuItemImagePreview(null);
    setEditingMenuItemId(null);
  };

  const openEditMenuItem = (item) => {
    setEditingMenuItemId(item.id);
    const trans = item.translations || emptyMenuTranslations();
    LANG_LIST.forEach(({ code }) => {
      if (!trans[code]) trans[code] = { name: '', description: '' };
      if (!trans[code].name && item.name) trans[code].name = item.name;
      if (!trans[code].description && item.description) trans[code].description = item.description;
    });
    setNewMenuItem({
      name: trans.fr?.name ?? item.name ?? '',
      description: trans.fr?.description ?? item.description ?? '',
      price: item.price ?? '',
      image: item.image ?? '',
      category: item.category ?? 'main',
      isPopular: item.isPopular ?? false,
      translations: trans,
    });
    setMenuItemImagePreview(item.image || null);
    setMenuItemImageFile(null);
  };

  const cancelEditMenuItem = () => {
    setEditingMenuItemId(null);
    setNewMenuItem(emptyNewMenuItemState());
    setMenuItemImageFile(null);
    setMenuItemImagePreview(null);
  };

  const removeMenuItem = (id) => {
    setNewRestaurant({
      ...newRestaurant,
      menu: newRestaurant.menu.filter((item) => item.id !== id),
    });
  };

  const nextPromoId = () => {
    const ids = (newRestaurant.promotions || []).map((p) => p.id).filter((n) => typeof n === 'number');
    return ids.length ? Math.max(...ids) + 1 : 1;
  };

  const addPromotion = () => {
    const title = (newPromotion.translations?.fr?.title ?? newPromotion.title ?? '').trim();
    const description = (newPromotion.translations?.fr?.description ?? newPromotion.description ?? '').trim();
    const price = parseFloat(newPromotion.price);
    let originalPrice = parseFloat(newPromotion.originalPrice);
    let discount = parseFloat(newPromotion.discount);
    const validUntil = newPromotion.validUntil
      ? new Date(newPromotion.validUntil)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (!title || !description || isNaN(price) || price < 0) {
      toast.error('Veuillez remplir au moins le titre, la description et le prix de la promotion');
      return;
    }
    if (isNaN(originalPrice) || originalPrice < 0) originalPrice = price;
    if (isNaN(discount) || discount < 0)
      discount = originalPrice > 0 ? Math.round((1 - price / originalPrice) * 100) : 0;
    const promo = {
      id: nextPromoId(),
      title,
      description,
      price,
      originalPrice: isNaN(originalPrice) ? price : originalPrice,
      discount: isNaN(discount) ? 0 : discount,
      validUntil: validUntil.toISOString ? validUntil.toISOString() : validUntil,
      translations: newPromotion.translations || emptyPromotionTranslations(),
    };
    setNewRestaurant({
      ...newRestaurant,
      promotions: [...(newRestaurant.promotions || []), promo],
    });
    setNewPromotion(emptyNewPromotionState());
    toast.success('Promotion ajoutée');
  };

  const removePromotion = (id) => {
    setNewRestaurant({
      ...newRestaurant,
      promotions: (newRestaurant.promotions || []).filter((p) => p.id !== id),
    });
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingId(null);
    setEditingMenuItemId(null);
    setImageFile(null);
    setImagePreview(null);
    setNewSpecialty('');
    setNewMenuItem(emptyNewMenuItemState());
    setMenuItemImageFile(null);
    setMenuItemImagePreview(null);
    setNewPromotion(emptyNewPromotionState());
    setActiveLang('fr');
    setNewRestaurant(createEmptyRestaurantForm(boatConfig));
  };

  const openNewRestaurantModal = () => {
    setEditingId(null);
    setImageFile(null);
    setImagePreview(null);
    setNewSpecialty('');
    setNewMenuItem(emptyNewMenuItemState());
    setMenuItemImageFile(null);
    setMenuItemImagePreview(null);
    setEditingMenuItemId(null);
    setNewPromotion(emptyNewPromotionState());
    setActiveLang('fr');
    setNewRestaurant(createEmptyRestaurantForm(boatConfig));
    setShowAddModal(true);
  };

  const openEditRestaurantModal = async (r) => {
    try {
      const res = await apiService.getRestaurant(r._id);
      const data = res.data ?? res;
      setNewRestaurant(restaurantToFormState(data));
      setImagePreview(data.image || null);
      setImageFile(null);
      setNewSpecialty('');
      setMenuItemImageFile(null);
      setMenuItemImagePreview(null);
      setActiveLang('fr');
      setEditingId(r._id);
      setShowAddModal(true);
    } catch (err) {
      console.error('Erreur chargement restaurant:', err);
      toast.error('Impossible de charger le restaurant');
    }
  };

  const handleAddRestaurant = async () => {
    const frName = (newRestaurant.translations?.fr?.name ?? newRestaurant.name)?.trim();
    const frDesc = (newRestaurant.translations?.fr?.description ?? newRestaurant.description)?.trim() ?? '';
    if (!frName || !(newRestaurant.translations?.fr?.type ?? newRestaurant.type)?.trim() || !frDesc) {
      toast.error('Veuillez remplir au moins le nom, le type de restaurant et la description (français)');
      return;
    }

    if (!newRestaurant.shipName && !boatConfig.shipName) {
      toast.error('Veuillez sélectionner un bateau');
      return;
    }

    try {
      let imageUrl = imagePreview || '';
      if (imageFile) {
        const up = await apiService.uploadImage(imageFile);
        imageUrl = up?.image?.url || up?.image?.path || up?.data?.image?.url || up?.data?.image?.path || imageUrl;
      }
      if (!imageUrl) {
        imageUrl = DEFAULT_RESTAURANT_IMAGE;
      }

      const translations = {};
      LANG_LIST.forEach(({ code }) => {
        const tr = newRestaurant.translations?.[code];
        if (code === 'fr') {
          translations.fr = { name: frName, description: frDesc };
        } else if (tr && (tr.name?.trim() || tr.description?.trim())) {
          translations[code] = { name: tr.name || '', description: tr.description || '' };
        } else {
          translations[code] = { name: frName, description: frDesc };
        }
        translations[code].specialties =
          newRestaurant.translations?.[code]?.specialties ??
          newRestaurant.translations?.fr?.specialties ??
          newRestaurant.specialties ??
          [];
        translations[code].type =
          (
            newRestaurant.translations?.[code]?.type ??
            newRestaurant.translations?.fr?.type ??
            newRestaurant.type ??
            ''
          ).trim() ||
          (newRestaurant.translations?.fr?.type ?? newRestaurant.type ?? '');
        translations[code].category =
          (
            newRestaurant.translations?.[code]?.category ??
            newRestaurant.translations?.fr?.category ??
            newRestaurant.category ??
            ''
          ).trim() ||
          (newRestaurant.translations?.fr?.category ?? newRestaurant.category ?? '');
        translations[code].menu = newRestaurant.menu.map((item) => ({
          name: item.translations?.[code]?.name ?? item.translations?.fr?.name ?? item.name ?? '',
          description:
            item.translations?.[code]?.description ?? item.translations?.fr?.description ?? item.description ?? '',
        }));
        translations[code].promotions = (newRestaurant.promotions || []).map((p) => ({
          title: p.translations?.[code]?.title ?? p.translations?.fr?.title ?? p.title ?? '',
          description: p.translations?.[code]?.description ?? p.translations?.fr?.description ?? p.description ?? '',
        }));
      });

      const payload = {
        name: frName,
        type: (newRestaurant.translations?.fr?.type ?? newRestaurant.type ?? '').trim() || newRestaurant.type,
        category:
          (newRestaurant.translations?.fr?.category ?? newRestaurant.category ?? '').trim() ||
          newRestaurant.category ||
          'french',
        description: frDesc,
        location: newRestaurant.location || '',
        priceRange: newRestaurant.priceRange || '€€',
        openingHours: newRestaurant.openingHours || '',
        rating: newRestaurant.rating ?? 4.5,
        specialties: newRestaurant.translations?.fr?.specialties ?? newRestaurant.specialties ?? [],
        menu: newRestaurant.menu.map((item, idx) => ({
          id: idx + 1,
          name: item.translations?.fr?.name ?? item.name,
          description: item.translations?.fr?.description ?? item.description ?? '',
          price: item.price,
          category: item.category || 'main',
          isPopular: item.isPopular || false,
          allergens: item.allergens || [],
          image: item.image || undefined,
        })),
        promotions: newRestaurant.promotions || [],
        isOpen: newRestaurant.isOpen !== false,
        shipId: newRestaurant.shipId || '1',
        shipName: newRestaurant.shipName || boatConfig.shipName || undefined,
        image: imageUrl,
        translations: Object.keys(translations).length ? translations : undefined,
      };

      const res = await apiService.createRestaurant(payload);
      const created = res.data?.restaurant || { ...payload, _id: res.data?._id };
      setRestaurants((prev) => [...(Array.isArray(prev) ? prev : []), created]);
      toast.success('Restaurant ajouté avec succès');
      closeModal();
    } catch (error) {
      console.error("Erreur lors de l'ajout du restaurant:", error);
      toast.error(error.response?.data?.message || "Erreur lors de l'ajout du restaurant");
    }
  };

  const handleUpdateRestaurant = async () => {
    if (!editingId) return;
    const frName = (newRestaurant.translations?.fr?.name ?? newRestaurant.name)?.trim();
    const frDesc = (newRestaurant.translations?.fr?.description ?? newRestaurant.description)?.trim() ?? '';
    if (!frName || !(newRestaurant.translations?.fr?.type ?? newRestaurant.type)?.trim() || !frDesc) {
      toast.error('Veuillez remplir au moins le nom, le type de restaurant et la description (français)');
      return;
    }
    if (!newRestaurant.shipName && !boatConfig.shipName) {
      toast.error('Veuillez sélectionner un bateau');
      return;
    }
    try {
      let imageUrl = imagePreview || '';
      if (imageFile) {
        const up = await apiService.uploadImage(imageFile);
        imageUrl = up?.image?.url || up?.image?.path || up?.data?.image?.url || up?.data?.image?.path || imageUrl;
      }
      if (!imageUrl && editingId) {
        const current = restaurants.find((r) => r._id === editingId);
        if (current?.image) imageUrl = current.image;
      }
      if (!imageUrl) {
        imageUrl = DEFAULT_RESTAURANT_IMAGE;
      }
      const translations = {};
      LANG_LIST.forEach(({ code }) => {
        const tr = newRestaurant.translations?.[code];
        if (code === 'fr') {
          translations.fr = { name: frName, description: frDesc };
        } else if (tr && (tr.name?.trim() || tr.description?.trim())) {
          translations[code] = { name: tr.name || '', description: tr.description || '' };
        } else {
          translations[code] = { name: frName, description: frDesc };
        }
        translations[code].specialties =
          newRestaurant.translations?.[code]?.specialties ??
          newRestaurant.translations?.fr?.specialties ??
          newRestaurant.specialties ??
          [];
        translations[code].type =
          (
            newRestaurant.translations?.[code]?.type ??
            newRestaurant.translations?.fr?.type ??
            newRestaurant.type ??
            ''
          ).trim() ||
          (newRestaurant.translations?.fr?.type ?? newRestaurant.type ?? '');
        translations[code].category =
          (
            newRestaurant.translations?.[code]?.category ??
            newRestaurant.translations?.fr?.category ??
            newRestaurant.category ??
            ''
          ).trim() ||
          (newRestaurant.translations?.fr?.category ?? newRestaurant.category ?? '');
        translations[code].menu = newRestaurant.menu.map((item) => ({
          name: item.translations?.[code]?.name ?? item.translations?.fr?.name ?? item.name ?? '',
          description:
            item.translations?.[code]?.description ?? item.translations?.fr?.description ?? item.description ?? '',
        }));
        translations[code].promotions = (newRestaurant.promotions || []).map((p) => ({
          title: p.translations?.[code]?.title ?? p.translations?.fr?.title ?? p.title ?? '',
          description: p.translations?.[code]?.description ?? p.translations?.fr?.description ?? p.description ?? '',
        }));
      });
      const payload = {
        name: frName,
        type: (newRestaurant.translations?.fr?.type ?? newRestaurant.type ?? '').trim() || newRestaurant.type,
        category:
          (newRestaurant.translations?.fr?.category ?? newRestaurant.category ?? '').trim() ||
          newRestaurant.category ||
          'french',
        description: frDesc,
        location: newRestaurant.location || '',
        priceRange: newRestaurant.priceRange || '€€',
        openingHours: newRestaurant.openingHours || '',
        rating: newRestaurant.rating ?? 4.5,
        specialties: newRestaurant.translations?.fr?.specialties ?? newRestaurant.specialties ?? [],
        menu: newRestaurant.menu.map((item, idx) => ({
          id: idx + 1,
          name: item.translations?.fr?.name ?? item.name,
          description: item.translations?.fr?.description ?? item.description ?? '',
          price: item.price,
          category: item.category || 'main',
          isPopular: item.isPopular || false,
          allergens: item.allergens || [],
          image: item.image || undefined,
        })),
        promotions: newRestaurant.promotions || [],
        isOpen: newRestaurant.isOpen !== false,
        shipId: newRestaurant.shipId || '1',
        shipName: newRestaurant.shipName || boatConfig.shipName || undefined,
        image: imageUrl || undefined,
        translations: Object.keys(translations).length ? translations : undefined,
      };
      const res = await apiService.updateRestaurant(editingId, payload);
      const updated = res.data?.restaurant ?? { ...payload, _id: editingId };
      setRestaurants((prev) => prev.map((r) => (r._id === editingId ? updated : r)));
      setShowAddModal(false);
      setEditingId(null);
      setImageFile(null);
      setImagePreview(null);
      toast.success('Restaurant mis à jour');
    } catch (error) {
      console.error('Erreur mise à jour restaurant:', error);
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const saveRestaurant = () => (editingId ? handleUpdateRestaurant() : handleAddRestaurant());

  const form = {
    newRestaurant,
    setNewRestaurant,
    activeLang,
    setActiveLang,
    imageFile,
    imagePreview,
    handleImageUpload,
    removeImage,
    newSpecialty,
    setNewSpecialty,
    addSpecialty,
    removeSpecialty,
    newMenuItem,
    setNewMenuItem,
    menuItemImagePreview,
    handleMenuItemImageUpload,
    removeMenuItemImage,
    uploadingMenuItemImage,
    editingMenuItemId,
    addMenuItem,
    openEditMenuItem,
    cancelEditMenuItem,
    removeMenuItem,
    newPromotion,
    setNewPromotion,
    addPromotion,
    removePromotion,
  };

  return {
    showAddModal,
    editingId,
    closeModal,
    openNewRestaurantModal,
    openEditRestaurantModal,
    saveRestaurant,
    form,
  };
}

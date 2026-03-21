import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { apiService } from '../services/apiService';
import { emptyMenuTranslations, emptyPromotionTranslations } from '../utils/i18n';
import { createEmptyRestaurantForm } from '../utils/restaurantModalDefaults';
import { useRestaurantForm } from './useRestaurantForm';

vi.mock('../services/apiService', () => ({
  apiService: {
    uploadImage: vi.fn(),
    createRestaurant: vi.fn(),
    updateRestaurant: vi.fn(),
    getRestaurant: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const boatConfig = { shipName: 'MS Test' };

describe('useRestaurantForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mount(restaurants = [], cfg = boatConfig) {
    const setRestaurants = vi.fn();
    const hook = renderHook(() => useRestaurantForm({ boatConfig: cfg, restaurants, setRestaurants }));
    return { ...hook, setRestaurants };
  }

  it('openNewRestaurantModal ouvre le modal et applique le bateau', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    expect(result.current.showAddModal).toBe(true);
    expect(result.current.editingId).toBeNull();
    expect(result.current.form.newRestaurant.shipName).toBe('MS Test');
  });

  it('closeModal ferme et réinitialise', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    act(() => {
      result.current.closeModal();
    });
    expect(result.current.showAddModal).toBe(false);
    expect(result.current.editingId).toBeNull();
  });

  it('addSpecialty ajoute une spécialité pour la langue active', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    act(() => {
      result.current.form.setNewSpecialty('  Pizza  ');
    });
    act(() => {
      result.current.form.addSpecialty();
    });
    const frSpecs = result.current.form.newRestaurant.translations?.fr?.specialties ?? [];
    expect(frSpecs).toContain('Pizza');
    expect(result.current.form.newSpecialty).toBe('');
  });

  it('removeSpecialty retire la spécialité', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    act(() => {
      result.current.form.setNewSpecialty('A');
    });
    act(() => {
      result.current.form.addSpecialty();
    });
    act(() => {
      result.current.form.removeSpecialty('A');
    });
    const frSpecs = result.current.form.newRestaurant.translations?.fr?.specialties ?? [];
    expect(frSpecs).not.toContain('A');
  });

  it('saveRestaurant sans champs FR requis appelle toast.error et ne crée pas', async () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    await act(async () => {
      await result.current.saveRestaurant();
    });
    expect(toast.error).toHaveBeenCalled();
    expect(apiService.createRestaurant).not.toHaveBeenCalled();
  });

  it('removeMenuItem retire un plat du menu', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
      result.current.form.setNewRestaurant({
        ...result.current.form.newRestaurant,
        menu: [
          {
            id: 42,
            name: 'Plat',
            price: 5,
            category: 'main',
            translations: emptyMenuTranslations(),
          },
        ],
      });
    });
    act(() => {
      result.current.form.removeMenuItem(42);
    });
    expect(result.current.form.newRestaurant.menu).toHaveLength(0);
  });

  it('openEditRestaurantModal charge le restaurant et passe en édition', async () => {
    apiService.getRestaurant.mockResolvedValue({
      data: {
        _id: 'rid',
        name: 'Nom',
        description: 'Desc',
        type: 'Brasserie',
        category: 'french',
        menu: [],
        promotions: [],
        specialties: [],
        image: 'https://example.com/img.jpg',
      },
    });
    const { result } = mount();
    await act(async () => {
      await result.current.openEditRestaurantModal({ _id: 'rid' });
    });
    expect(apiService.getRestaurant).toHaveBeenCalledWith('rid');
    expect(result.current.showAddModal).toBe(true);
    expect(result.current.editingId).toBe('rid');
    expect(result.current.form.newRestaurant.name).toBe('Nom');
  });

  it('openEditRestaurantModal en erreur appelle toast.error', async () => {
    apiService.getRestaurant.mockRejectedValue(new Error('network'));
    const { result } = mount();
    await act(async () => {
      await result.current.openEditRestaurantModal({ _id: 'bad' });
    });
    expect(toast.error).toHaveBeenCalledWith('Impossible de charger le restaurant');
    expect(result.current.showAddModal).toBe(false);
  });

  it('addPromotion ajoute une promotion valide', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    act(() => {
      result.current.form.setNewPromotion({
        title: '',
        description: '',
        price: '8',
        originalPrice: '10',
        discount: '',
        validUntil: '',
        translations: {
          ...emptyPromotionTranslations(),
          fr: { title: 'Offre', description: 'Détail' },
        },
      });
    });
    act(() => {
      result.current.form.addPromotion();
    });
    expect(toast.success).toHaveBeenCalled();
    expect(result.current.form.newRestaurant.promotions?.length).toBe(1);
    expect(result.current.form.newRestaurant.promotions[0].title).toBe('Offre');
  });

  it('saveRestaurant crée un restaurant et ferme le modal en cas de succès', async () => {
    apiService.createRestaurant.mockResolvedValue({
      data: { restaurant: { _id: 'new-r', name: 'Chez Jean' } },
    });
    const { result, setRestaurants } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const base = createEmptyRestaurantForm(boatConfig);
    act(() => {
      result.current.form.setNewRestaurant({
        ...base,
        translations: {
          ...base.translations,
          fr: {
            ...base.translations.fr,
            name: 'Chez Jean',
            description: 'Cuisine maison',
            type: 'Brasserie',
            category: 'french',
          },
        },
      });
    });
    await act(async () => {
      await result.current.saveRestaurant();
    });
    expect(apiService.createRestaurant).toHaveBeenCalledTimes(1);
    const payload = apiService.createRestaurant.mock.calls[0][0];
    expect(payload.name).toBe('Chez Jean');
    expect(payload.description).toBe('Cuisine maison');
    expect(payload.shipName).toBe('MS Test');
    expect(toast.success).toHaveBeenCalledWith('Restaurant ajouté avec succès');
    expect(setRestaurants).toHaveBeenCalled();
    expect(result.current.showAddModal).toBe(false);
  });

  it('saveRestaurant envoie une nouvelle image via uploadImage à la création', async () => {
    apiService.uploadImage.mockResolvedValue({
      image: { url: 'https://cdn.example/new-cover.jpg' },
    });
    apiService.createRestaurant.mockResolvedValue({
      data: { restaurant: { _id: 'with-img' } },
    });
    const { result, setRestaurants } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const base = createEmptyRestaurantForm(boatConfig);
    act(() => {
      result.current.form.setNewRestaurant({
        ...base,
        translations: {
          ...base.translations,
          fr: {
            ...base.translations.fr,
            name: 'Avec Photo',
            description: 'Desc',
            type: 'Café',
            category: 'french',
          },
        },
      });
    });
    const file = new File(['x'], 'cover.png', { type: 'image/png' });
    act(() => {
      result.current.form.handleImageUpload({ target: { files: [file] } });
    });
    await waitFor(() => {
      expect(result.current.form.imageFile).toBe(file);
    });
    await act(async () => {
      await result.current.saveRestaurant();
    });
    expect(apiService.uploadImage).toHaveBeenCalledWith(file);
    expect(apiService.createRestaurant).toHaveBeenCalledWith(
      expect.objectContaining({ image: 'https://cdn.example/new-cover.jpg' })
    );
    expect(setRestaurants).toHaveBeenCalled();
    expect(result.current.showAddModal).toBe(false);
  });

  it('saveRestaurant met à jour un restaurant existant', async () => {
    apiService.getRestaurant.mockResolvedValue({
      data: {
        _id: 'e1',
        name: 'Le Resto',
        description: 'Desc',
        type: 'Steakhouse',
        category: 'french',
        menu: [],
        promotions: [],
        specialties: [],
      },
    });
    apiService.updateRestaurant.mockResolvedValue({ data: { restaurant: { _id: 'e1' } } });
    const row = { _id: 'e1', image: 'https://example.com/keep.png' };
    const { result, setRestaurants } = mount([row]);
    await act(async () => {
      await result.current.openEditRestaurantModal({ _id: 'e1' });
    });
    await act(async () => {
      await result.current.saveRestaurant();
    });
    expect(apiService.updateRestaurant).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ name: 'Le Resto', image: 'https://example.com/keep.png' })
    );
    expect(toast.success).toHaveBeenCalledWith('Restaurant mis à jour');
    expect(setRestaurants).toHaveBeenCalled();
    expect(result.current.showAddModal).toBe(false);
  });

  it('saveRestaurant à l’édition envoie une nouvelle image via uploadImage', async () => {
    apiService.getRestaurant.mockResolvedValue({
      data: {
        _id: 'e3',
        name: 'R',
        description: 'D',
        type: 'Steakhouse',
        category: 'french',
        menu: [],
        promotions: [],
        specialties: [],
        image: 'https://old.jpg',
      },
    });
    apiService.uploadImage.mockResolvedValue({ image: { path: '/uploads/new-banner.jpg' } });
    apiService.updateRestaurant.mockResolvedValue({ data: { restaurant: { _id: 'e3' } } });
    const { result } = mount([{ _id: 'e3', image: 'https://old.jpg' }]);
    await act(async () => {
      await result.current.openEditRestaurantModal({ _id: 'e3' });
    });
    const file = new File(['x'], 'banner.png', { type: 'image/png' });
    act(() => {
      result.current.form.handleImageUpload({ target: { files: [file] } });
    });
    await waitFor(() => {
      expect(result.current.form.imageFile).toBe(file);
    });
    await act(async () => {
      await result.current.saveRestaurant();
    });
    expect(apiService.uploadImage).toHaveBeenCalledWith(file);
    expect(apiService.updateRestaurant).toHaveBeenCalledWith(
      'e3',
      expect.objectContaining({ image: '/uploads/new-banner.jpg' })
    );
  });

  it('saveRestaurant refuse si aucun bateau (config et formulaire vides)', async () => {
    const { result } = mount([], { shipName: '' });
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const base = createEmptyRestaurantForm({ shipName: '' });
    act(() => {
      result.current.form.setNewRestaurant({
        ...base,
        shipName: '',
        translations: {
          ...base.translations,
          fr: {
            ...base.translations.fr,
            name: 'R',
            description: 'D',
            type: 'Café',
            category: 'french',
          },
        },
      });
    });
    await act(async () => {
      await result.current.saveRestaurant();
    });
    expect(toast.error).toHaveBeenCalledWith('Veuillez sélectionner un bateau');
    expect(apiService.createRestaurant).not.toHaveBeenCalled();
  });

  it('saveRestaurant propage une erreur API à la création', async () => {
    apiService.createRestaurant.mockRejectedValue({ response: { data: { message: 'Quota dépassé' } } });
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const base = createEmptyRestaurantForm(boatConfig);
    act(() => {
      result.current.form.setNewRestaurant({
        ...base,
        translations: {
          ...base.translations,
          fr: {
            ...base.translations.fr,
            name: 'X',
            description: 'Y',
            type: 'Z',
            category: 'french',
          },
        },
      });
    });
    await act(async () => {
      await result.current.saveRestaurant();
    });
    expect(toast.error).toHaveBeenCalledWith('Quota dépassé');
    expect(result.current.showAddModal).toBe(true);
  });

  it('saveRestaurant propage une erreur API à la mise à jour', async () => {
    apiService.getRestaurant.mockResolvedValue({
      data: {
        _id: 'e2',
        name: 'R',
        description: 'D',
        type: 'Steakhouse',
        category: 'french',
        menu: [],
        promotions: [],
        specialties: [],
      },
    });
    apiService.updateRestaurant.mockRejectedValue({ response: { data: { message: 'Version conflict' } } });
    const { result } = mount([{ _id: 'e2', image: 'https://x' }]);
    await act(async () => {
      await result.current.openEditRestaurantModal({ _id: 'e2' });
    });
    await act(async () => {
      await result.current.saveRestaurant();
    });
    expect(toast.error).toHaveBeenCalledWith('Version conflict');
    expect(result.current.showAddModal).toBe(true);
  });

  it('handleImageUpload accepte une image et remplit la prévisualisation', async () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const file = new File(['x'], 'pic.png', { type: 'image/png' });
    act(() => {
      result.current.form.handleImageUpload({ target: { files: [file] } });
    });
    await waitFor(() => {
      expect(result.current.form.imagePreview).toMatch(/^data:image\/png;base64,/);
    });
    expect(result.current.form.imageFile).toBe(file);
  });

  it('removeImage efface fichier et prévisualisation', async () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const file = new File(['x'], 'pic.png', { type: 'image/png' });
    act(() => {
      result.current.form.handleImageUpload({ target: { files: [file] } });
    });
    await waitFor(() => {
      expect(result.current.form.imagePreview).toBeTruthy();
    });
    act(() => {
      result.current.form.removeImage();
    });
    expect(result.current.form.imagePreview).toBeNull();
    expect(result.current.form.imageFile).toBeNull();
  });

  it('addMenuItem avec fichier image appelle uploadImage et enregistre le chemin', async () => {
    apiService.uploadImage.mockResolvedValue({ image: { path: '/uploads/plat.png' } });
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    act(() => {
      result.current.form.setNewMenuItem({
        name: '',
        description: '',
        price: '11',
        image: '',
        category: 'main',
        isPopular: false,
        translations: {
          ...emptyMenuTranslations(),
          fr: { name: 'Tiramisu', description: 'Mascarpone' },
        },
      });
    });
    const img = new File(['xx'], 'dish.png', { type: 'image/png' });
    act(() => {
      result.current.form.handleMenuItemImageUpload({ target: { files: [img] } });
    });
    await waitFor(() => {
      expect(result.current.form.menuItemImagePreview).toBeTruthy();
    });
    await act(async () => {
      await result.current.form.addMenuItem();
    });
    expect(apiService.uploadImage).toHaveBeenCalledWith(img);
    expect(result.current.form.newRestaurant.menu[0].image).toBe('/uploads/plat.png');
  });

  it('addMenuItem échoue si uploadImage rejette', async () => {
    apiService.uploadImage.mockRejectedValue(new Error('network'));
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    act(() => {
      result.current.form.setNewMenuItem({
        name: '',
        description: '',
        price: '3',
        image: '',
        category: 'main',
        isPopular: false,
        translations: {
          ...emptyMenuTranslations(),
          fr: { name: 'Salade', description: 'Verte' },
        },
      });
    });
    const img = new File(['x'], 's.png', { type: 'image/png' });
    act(() => {
      result.current.form.handleMenuItemImageUpload({ target: { files: [img] } });
    });
    await waitFor(() => {
      expect(result.current.form.menuItemImagePreview).toBeTruthy();
    });
    await act(async () => {
      await result.current.form.addMenuItem();
    });
    expect(toast.error).toHaveBeenCalledWith("Erreur lors de l'upload de l'image du plat");
    expect(result.current.form.newRestaurant.menu).toHaveLength(0);
  });

  it('addMenuItem sans nom FR ni prix appelle toast.error', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    act(() => {
      result.current.form.addMenuItem();
    });
    expect(toast.error).toHaveBeenCalledWith('Veuillez remplir le nom (au moins en français) et le prix');
  });

  it('addMenuItem ajoute un plat sans upload', async () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    act(() => {
      result.current.form.setNewMenuItem({
        name: '',
        description: '',
        price: '9.5',
        image: '',
        category: 'main',
        isPopular: true,
        translations: {
          ...emptyMenuTranslations(),
          fr: { name: 'Risotto', description: 'Crémeux' },
        },
      });
    });
    await act(async () => {
      await result.current.form.addMenuItem();
    });
    expect(toast.success).toHaveBeenCalledWith('Plat ajouté au menu');
    expect(result.current.form.newRestaurant.menu).toHaveLength(1);
    expect(result.current.form.newRestaurant.menu[0].name).toBe('Risotto');
    expect(result.current.form.newRestaurant.menu[0].price).toBe(9.5);
    expect(result.current.form.newRestaurant.menu[0].isPopular).toBe(true);
  });

  it('openEditMenuItem puis addMenuItem met à jour le plat', async () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
      result.current.form.setNewRestaurant({
        ...result.current.form.newRestaurant,
        menu: [
          {
            id: 77,
            name: 'Ancien',
            description: 'X',
            price: 5,
            category: 'main',
            translations: emptyMenuTranslations(),
          },
        ],
      });
    });
    act(() => {
      result.current.form.openEditMenuItem(result.current.form.newRestaurant.menu[0]);
    });
    act(() => {
      result.current.form.setNewMenuItem({
        ...result.current.form.newMenuItem,
        price: '6',
        translations: {
          ...result.current.form.newMenuItem.translations,
          fr: { name: 'Nouveau nom', description: 'X' },
        },
      });
    });
    await act(async () => {
      await result.current.form.addMenuItem();
    });
    expect(toast.success).toHaveBeenCalledWith('Plat modifié');
    expect(result.current.form.newRestaurant.menu).toHaveLength(1);
    expect(result.current.form.newRestaurant.menu[0].name).toBe('Nouveau nom');
    expect(result.current.form.newRestaurant.menu[0].price).toBe(6);
  });

  it('cancelEditMenuItem réinitialise le formulaire plat', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
      result.current.form.setNewRestaurant({
        ...result.current.form.newRestaurant,
        menu: [{ id: 1, name: 'X', price: 1, category: 'main', translations: emptyMenuTranslations() }],
      });
    });
    act(() => {
      result.current.form.openEditMenuItem(result.current.form.newRestaurant.menu[0]);
    });
    expect(result.current.form.editingMenuItemId).toBe(1);
    act(() => {
      result.current.form.cancelEditMenuItem();
    });
    expect(result.current.form.editingMenuItemId).toBeNull();
    expect(result.current.form.newMenuItem.price).toBe('');
  });

  it('handleImageUpload refuse un fichier non image', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const file = new File(['x'], 'doc.txt', { type: 'text/plain' });
    act(() => {
      result.current.form.handleImageUpload({ target: { files: [file] } });
    });
    expect(toast.error).toHaveBeenCalledWith('Veuillez sélectionner un fichier image');
  });

  it('handleImageUpload refuse un fichier trop volumineux', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });
    act(() => {
      result.current.form.handleImageUpload({ target: { files: [big] } });
    });
    expect(toast.error).toHaveBeenCalledWith('Le fichier est trop volumineux (max 5MB)');
  });

  it('handleMenuItemImageUpload refuse un non-image', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const file = new File(['x'], 'x.bin', { type: 'application/octet-stream' });
    act(() => {
      result.current.form.handleMenuItemImageUpload({ target: { files: [file] } });
    });
    expect(toast.error).toHaveBeenCalledWith('Veuillez sélectionner un fichier image');
  });

  it('handleMenuItemImageUpload refuse un fichier trop volumineux', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'plat.jpg', { type: 'image/jpeg' });
    act(() => {
      result.current.form.handleMenuItemImageUpload({ target: { files: [big] } });
    });
    expect(toast.error).toHaveBeenCalledWith('Le fichier est trop volumineux (max 5MB)');
  });

  it('removeMenuItemImage efface la prévisualisation après upload plat', async () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const img = new File(['x'], 'dish.png', { type: 'image/png' });
    act(() => {
      result.current.form.handleMenuItemImageUpload({ target: { files: [img] } });
    });
    await waitFor(() => {
      expect(result.current.form.menuItemImagePreview).toBeTruthy();
    });
    act(() => {
      result.current.form.removeMenuItemImage();
    });
    expect(result.current.form.menuItemImagePreview).toBeNull();
  });

  it('addSpecialty ignore les doublons', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    act(() => {
      result.current.form.setNewSpecialty('Bio');
    });
    act(() => {
      result.current.form.addSpecialty();
    });
    act(() => {
      result.current.form.setNewSpecialty('Bio');
    });
    act(() => {
      result.current.form.addSpecialty();
    });
    const frSpecs = result.current.form.newRestaurant.translations?.fr?.specialties ?? [];
    expect(frSpecs.filter((s) => s === 'Bio')).toHaveLength(1);
  });

  it('addPromotion sans titre, description ou prix valide affiche une erreur', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    act(() => {
      result.current.form.setNewPromotion({
        title: '',
        description: '',
        price: '',
        originalPrice: '',
        discount: '',
        validUntil: '',
        translations: {
          ...emptyPromotionTranslations(),
          fr: { title: '', description: '' },
        },
      });
    });
    act(() => {
      result.current.form.addPromotion();
    });
    expect(toast.error).toHaveBeenCalledWith(
      'Veuillez remplir au moins le titre, la description et le prix de la promotion'
    );
    expect(result.current.form.newRestaurant.promotions ?? []).toHaveLength(0);
  });

  it('removePromotion retire une promotion par id', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
      result.current.form.setNewRestaurant({
        ...result.current.form.newRestaurant,
        promotions: [
          {
            id: 42,
            title: 'P',
            description: 'D',
            price: 5,
            originalPrice: 6,
            discount: 10,
            validUntil: new Date().toISOString(),
            translations: emptyPromotionTranslations(),
          },
        ],
      });
    });
    act(() => {
      result.current.form.removePromotion(42);
    });
    expect(result.current.form.newRestaurant.promotions).toHaveLength(0);
  });

  it('deux addPromotion successifs incrémentent les id', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
    });
    const promoPayload = (title) => ({
      title: '',
      description: '',
      price: '5',
      originalPrice: '6',
      discount: '',
      validUntil: '',
      translations: {
        ...emptyPromotionTranslations(),
        fr: { title, description: 'Desc' },
      },
    });
    act(() => {
      result.current.form.setNewPromotion(promoPayload('Une'));
    });
    act(() => {
      result.current.form.addPromotion();
    });
    act(() => {
      result.current.form.setNewPromotion(promoPayload('Deux'));
    });
    act(() => {
      result.current.form.addPromotion();
    });
    const promos = result.current.form.newRestaurant.promotions ?? [];
    expect(promos).toHaveLength(2);
    expect(promos[0].id).toBe(1);
    expect(promos[1].id).toBe(2);
  });

  it('addPromotion attribue id 1 si les promos existantes n’ont pas d’id numérique', () => {
    const { result } = mount();
    act(() => {
      result.current.openNewRestaurantModal();
      result.current.form.setNewRestaurant({
        ...result.current.form.newRestaurant,
        promotions: [
          {
            id: 'legacy-string',
            title: 'Ancienne',
            description: 'D',
            price: 3,
            originalPrice: 4,
            discount: 0,
            validUntil: new Date().toISOString(),
            translations: emptyPromotionTranslations(),
          },
        ],
      });
    });
    act(() => {
      result.current.form.setNewPromotion({
        title: '',
        description: '',
        price: '4',
        originalPrice: '',
        discount: '',
        validUntil: '',
        translations: {
          ...emptyPromotionTranslations(),
          fr: { title: 'Nouvelle', description: 'OK' },
        },
      });
    });
    act(() => {
      result.current.form.addPromotion();
    });
    const promos = result.current.form.newRestaurant.promotions ?? [];
    expect(promos).toHaveLength(2);
    expect(promos[1].id).toBe(1);
    expect(promos[1].title).toBe('Nouvelle');
  });
});

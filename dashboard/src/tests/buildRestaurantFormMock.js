import { vi } from 'vitest';
import {
  createEmptyRestaurantForm,
  emptyNewMenuItemState,
  emptyNewPromotionState,
} from '../utils/restaurantModalDefaults';

/**
 * Objet `form` aligné sur useRestaurantForm (tests RTL / intégration).
 */
export function buildRestaurantFormMock(boatConfig = { shipName: 'MS' }, overrides = {}) {
  return {
    newRestaurant: createEmptyRestaurantForm(boatConfig),
    setNewRestaurant: vi.fn(),
    activeLang: 'fr',
    setActiveLang: vi.fn(),
    imageFile: null,
    imagePreview: null,
    handleImageUpload: vi.fn(),
    removeImage: vi.fn(),
    newSpecialty: '',
    setNewSpecialty: vi.fn(),
    addSpecialty: vi.fn(),
    removeSpecialty: vi.fn(),
    newMenuItem: emptyNewMenuItemState(),
    setNewMenuItem: vi.fn(),
    menuItemImagePreview: null,
    handleMenuItemImageUpload: vi.fn(),
    removeMenuItemImage: vi.fn(),
    uploadingMenuItemImage: false,
    editingMenuItemId: null,
    addMenuItem: vi.fn(),
    openEditMenuItem: vi.fn(),
    cancelEditMenuItem: vi.fn(),
    removeMenuItem: vi.fn(),
    newPromotion: emptyNewPromotionState(),
    setNewPromotion: vi.fn(),
    addPromotion: vi.fn(),
    removePromotion: vi.fn(),
    ...overrides,
  };
}

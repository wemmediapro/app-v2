import { emptyTranslationsAll, emptyMenuTranslations, emptyPromotionTranslations } from './i18n';

/** État formulaire restaurant vide (modal création / après fermeture). */
export function createEmptyRestaurantForm(boatConfig) {
  return {
    name: '',
    type: '',
    category: 'french',
    description: '',
    location: '',
    priceRange: '€€',
    openingHours: '',
    rating: 4.5,
    specialties: [],
    menu: [],
    promotions: [],
    isOpen: true,
    shipId: '1',
    shipName: boatConfig?.shipName || '',
    translations: emptyTranslationsAll(),
  };
}

export function emptyNewMenuItemState() {
  return {
    name: '',
    description: '',
    price: '',
    image: '',
    category: 'main',
    isPopular: false,
    translations: emptyMenuTranslations(),
  };
}

export function emptyNewPromotionState() {
  return {
    title: '',
    description: '',
    price: '',
    originalPrice: '',
    discount: '',
    validUntil: '',
    translations: emptyPromotionTranslations(),
  };
}

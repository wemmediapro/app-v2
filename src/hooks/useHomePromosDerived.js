/**
 * Promos combinées accueil + libellés i18n.
 */
import { useMemo, useCallback } from 'react';

export function useHomePromosDerived({ allPromotions, homeShopPromotions, language }) {
  const homePromosCombined = useMemo(() => {
    const restAll = (allPromotions || []).map((p) => ({
      ...p,
      _promoType: 'restaurant',
      _promoKey: `rest-${p.restaurant?.id ?? ''}-${p.id ?? ''}`,
    }));
    const shopAll = (homeShopPromotions || []).map((p) => ({
      ...p,
      _promoType: 'shop',
      _promoKey: `shop-${p.id ?? p._id ?? ''}`,
    }));
    const oneRest = restAll.length > 0 ? [restAll[0]] : [];
    const oneShop = shopAll.length > 0 ? [shopAll[0]] : [];
    return [...oneRest, ...oneShop];
  }, [allPromotions, homeShopPromotions]);

  const getPromoTitle = useCallback(
    (promo) =>
      promo.translations && promo.translations[language] && promo.translations[language].title
        ? promo.translations[language].title
        : promo.title || '',
    [language]
  );

  const getPromoDescription = useCallback(
    (promo) =>
      promo.translations && promo.translations[language] && promo.translations[language].description
        ? promo.translations[language].description
        : promo.description || '',
    [language]
  );

  return { homePromosCombined, getPromoTitle, getPromoDescription };
}

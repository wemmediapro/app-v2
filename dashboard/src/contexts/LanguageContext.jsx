import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import frTranslations from '../locales/fr.json';
import enTranslations from '../locales/en.json';
import arTranslations from '../locales/ar.json';
import esTranslations from '../locales/es.json';
import itTranslations from '../locales/it.json';
import deTranslations from '../locales/de.json';

const LanguageContext = createContext();

const translations = {
  fr: frTranslations,
  en: enTranslations,
  ar: arTranslations,
  es: esTranslations,
  it: itTranslations,
  de: deTranslations,
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const stored = localStorage.getItem('language') || 'fr';
    // Arabe retiré du dashboard : basculer sur français si ancienne préférence
    if (stored === 'ar') return 'fr';
    return stored;
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.setAttribute('lang', language);
    document.documentElement.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  }, [language]);

  const t = useCallback(
    (key, params = {}) => {
      const keys = key.split('.');
      let value = translations[language];

      for (const k of keys) {
        value = value?.[k];
      }

      if (value === undefined) {
        console.warn(`Translation missing for key: ${key} in language: ${language}`);
        return key;
      }

      // Replace parameters in translation
      if (typeof value === 'string' && Object.keys(params).length > 0) {
        return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
          return params[paramKey] !== undefined ? params[paramKey] : match;
        });
      }

      return value;
    },
    [language]
  );

  const changeLanguage = useCallback((lang) => {
    setLanguage(lang);
  }, []);

  const contextValue = useMemo(() => ({ language, changeLanguage, t }), [language, t, changeLanguage]);

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  de: deTranslations
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Récupérer la langue depuis localStorage ou utiliser français par défaut
    const savedLanguage = localStorage.getItem('language');
    const defaultLanguage = savedLanguage && translations[savedLanguage] ? savedLanguage : 'fr';
    if (!savedLanguage) {
      localStorage.setItem('language', defaultLanguage);
    }
    return defaultLanguage;
  });

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.setAttribute('lang', language);
    document.documentElement.setAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  }, [language]);

  // Mémoriser la fonction t pour qu'elle se mette à jour quand la langue change
  const t = useCallback((key, params = {}) => {
    const keys = key.split('.');
    let value = translations[language];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    if (value === undefined) {
      if (import.meta.env.DEV) {
        console.warn(`Translation missing for key: ${key} in language: ${language}`);
      }
      return key;
    }
    
    // Replace parameters in translation
    if (typeof value === 'string' && Object.keys(params).length > 0) {
      return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
        return params[paramKey] !== undefined ? params[paramKey] : match;
      });
    }
    
    return value;
  }, [language]);

  const changeLanguage = useCallback((lang) => {
    if (translations[lang]) {
      setLanguage(lang);
      localStorage.setItem('language', lang);
      if (import.meta.env.DEV) console.log('Language changed to:', lang);
    } else if (import.meta.env.DEV) {
      console.error('Language not found:', lang);
    }
  }, []);

  // Mémoriser la valeur du contexte pour éviter les re-renders inutiles
  const contextValue = useMemo(() => ({
    language,
    changeLanguage,
    t
  }), [language, t, changeLanguage]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};





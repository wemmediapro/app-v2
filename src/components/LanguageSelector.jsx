import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const languages = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', name: 'العربية', flag: '🇲🇦' },
];

const LanguageSelector = ({ variant = 'dark' }) => {
  const { language, changeLanguage, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0, width: 208 });
  const isLight = variant === 'light' || variant === 'web';

  // Close menu when language changes
  useEffect(() => {
    setIsOpen(false);
  }, [language]);

  // Position du menu (pour le portail, en fixed viewport) — ne mettre à jour que si la position change vraiment pour éviter une boucle de rendu
  const prevPositionRef = useRef(dropdownPosition);
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const next = {
      top: rect.bottom + 8,
      right: window.innerWidth - rect.right,
      width: 208,
    };
    const prev = prevPositionRef.current;
    if (prev.top === next.top && prev.right === next.right && prev.width === next.width) return;
    prevPositionRef.current = next;
    setDropdownPosition(next);
  }, [isOpen]);

  // Clic extérieur : mousedown (capture) avec court délai pour laisser le clic sur une option s'exécuter en premier
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      const target = event.target;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('touchend', handleClickOutside, true);
    }, 150);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchend', handleClickOutside, true);
    };
  }, [isOpen]);

  const handleSelectLanguage = (langCode, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (langCode === language) {
      setIsOpen(false);
      return;
    }

    console.log('Selecting language:', langCode);
    // Close menu immediately before changing language
    setIsOpen(false);
    changeLanguage(langCode);
  };

  const currentLanguage = languages.find((lang) => lang.code === language) || languages[0];

  const dropdownMenu = isOpen && (
    <AnimatePresence key="lang-dropdown">
      <motion.div
        key="lang-menu"
        ref={dropdownRef}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        className="fixed bg-white rounded-2xl shadow-xl border border-slate-200/80 py-2 z-[99999] w-52 overflow-hidden"
        style={{
          top: dropdownPosition.top,
          right: dropdownPosition.right,
          width: dropdownPosition.width,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-3 py-2 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {language === 'fr'
              ? 'Langue'
              : language === 'en'
                ? 'Language'
                : language === 'es'
                  ? 'Idioma'
                  : language === 'it'
                    ? 'Lingua'
                    : language === 'de'
                      ? 'Sprache'
                      : language === 'ar'
                        ? 'اللغة'
                        : 'Langue'}
          </p>
        </div>
        <div className="py-1">
          {languages.map((lang) => (
            <motion.button
              key={lang.code}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelectLanguage(lang.code, e);
              }}
              whileHover={{ backgroundColor: 'rgba(240, 248, 255, 0.9)' }}
              whileTap={{ scale: 0.99 }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer select-none touch-manipulation rounded-xl mx-1 ${
                language === lang.code ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
              }`}
            >
              <span className="text-xl flex-shrink-0" aria-hidden>
                {lang.flag}
              </span>
              <span className="flex-1 text-sm font-medium">{lang.name}</span>
              {language === lang.code && <Check size={18} className="text-blue-600 flex-shrink-0" strokeWidth={2.5} />}
            </motion.button>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <>
      <div className="relative z-[100]" ref={containerRef}>
        <motion.div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsOpen((prev) => !prev);
            }
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center justify-center gap-1.5 sm:gap-2 h-9 min-h-[36px] min-w-[36px] sm:h-10 sm:min-h-[44px] sm:min-w-[44px] sm:min-w-0 pl-2.5 pr-2.5 sm:pl-4 sm:pr-4 rounded-xl sm:rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 touch-manipulation ${
            isLight
              ? 'bg-[#F0F8FF] text-[#264FFF] font-bold shadow-sm hover:bg-[#E8F0FF] border-0'
              : 'bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/20'
          }`}
          style={isLight ? { boxShadow: '0 2px 6px rgba(0,0,0,0.06)' } : undefined}
          title={
            t('common.changeLanguage') ||
            (language === 'fr'
              ? 'Changer la langue'
              : language === 'en'
                ? 'Change language'
                : language === 'es'
                  ? 'Cambiar idioma'
                  : language === 'it'
                    ? 'Cambia lingua'
                    : language === 'de'
                      ? 'Sprache ändern'
                      : language === 'ar'
                        ? 'تغيير اللغة'
                        : 'Changer la langue')
          }
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          {isLight ? (
            <>
              <span className="text-[10px] sm:text-sm font-bold uppercase text-[#264FFF]">
                {currentLanguage.code.toUpperCase()}
              </span>
              <ChevronDown
                size={16}
                className={`text-[#264FFF] flex-shrink-0 transition-transform duration-200 sm:w-[18px] sm:h-[18px] ${isOpen ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
              />
            </>
          ) : (
            <>
              <span className="text-base sm:text-sm font-bold tracking-wide uppercase text-white">
                {currentLanguage.code.toUpperCase()}
              </span>
              <ChevronDown
                size={20}
                className={`text-white flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                strokeWidth={2.5}
              />
            </>
          )}
        </motion.div>
      </div>
      {typeof document !== 'undefined' && document.body && createPortal(isOpen ? dropdownMenu : null, document.body)}
    </>
  );
};

export default LanguageSelector;

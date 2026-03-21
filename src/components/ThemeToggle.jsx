/**
 * Bouton cycle : clair → sombre → système (icône + infobulle selon la préférence active).
 */
import React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

/** @param {{ variant?: 'light' | 'dark' }} props */
export default function ThemeToggle({ variant = 'light' }) {
  const { preference, cycleTheme } = useTheme();
  const { t } = useLanguage();

  const label =
    preference === 'light'
      ? t('common.themeLight')
      : preference === 'dark'
        ? t('common.themeDark')
        : t('common.themeSystem');

  const Icon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor;
  const isOnLightChrome = variant === 'light';

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={`flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-full transition-all active:scale-95 touch-manipulation flex-shrink-0 ${
        isOnLightChrome
          ? 'text-white hover:bg-white/20'
          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-slate-600/50'
      }`}
      aria-label={`${t('common.themeSwitch')}: ${label}`}
      title={`${t('common.themeSwitch')} — ${label}`}
    >
      <Icon size={20} className="sm:w-[22px] sm:h-[22px]" aria-hidden />
    </button>
  );
}

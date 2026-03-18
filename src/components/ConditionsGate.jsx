/**
 * Écran de consentement CGU — affiché tant que l'utilisateur n'a pas accepté (audit CTO — découpage App.jsx).
 */
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import LanguageSelector from './LanguageSelector';

export const CONDITIONS_ACCEPTED_KEY = 'gnv_conditions_accepted';

export default function ConditionsGate({ t, onAccept }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!e.target.querySelector('#accept-conditions')?.checked) return;
    try {
      localStorage.setItem(CONDITIONS_ACCEPTED_KEY, 'true');
    } catch (_) {}
    onAccept();
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-6 py-3 md:py-4 safe-area-top">
        <div className="flex items-center gap-2 text-white">
          <img src="/logo-gnv.png" alt="GNV" className="h-6 md:h-7 w-auto object-contain" />
          <span className="font-bold text-lg md:text-xl">GNV OnBoard</span>
        </div>
        <LanguageSelector variant="light" />
      </header>
      <div className="relative z-10 min-h-screen w-full flex flex-col items-center overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 pt-20 md:pt-24 pb-[max(2.5rem,calc(2.5rem+env(safe-area-inset-bottom,0px)))] md:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md md:max-w-lg lg:max-w-xl rounded-2xl md:rounded-3xl bg-white/95 md:bg-white p-5 sm:p-6 md:p-8 shadow-xl md:shadow-2xl backdrop-blur-md border border-slate-100/50 md:my-auto shrink-0"
        >
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{t('conditions.title')}</h1>
          <p className="text-sm md:text-base text-slate-600 mt-1 md:mt-2">{t('conditions.subtitle')}</p>
          <div className="mt-5 md:mt-6 max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5 text-sm md:text-base text-slate-700 space-y-3">
            <p>{t('conditions.paragraph1')}</p>
            <p>{t('conditions.paragraph2')}</p>
            <p>{t('conditions.paragraph3')}</p>
          </div>
          <form onSubmit={handleSubmit} className="mt-5 md:mt-6 space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 cursor-pointer has-[:checked]:border-[#264FFF] has-[:checked]:bg-blue-50/30 transition-all">
              <input
                type="checkbox"
                id="accept-conditions"
                name="accept-conditions"
                required
                className="mt-1 rounded border-slate-300 text-[#264FFF] focus:ring-[#264FFF]"
              />
              <span className="text-sm md:text-base text-slate-700">{t('conditions.acceptLabel')}</span>
            </label>
            <motion.button
              type="submit"
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-xl md:rounded-2xl bg-[#264FFF] px-4 py-3 md:py-4 text-sm md:text-base font-medium text-white hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[#264FFF] focus:ring-offset-2"
            >
              {t('conditions.acceptButton')} <ArrowRight size={18} className="inline-block ml-1 md:w-5 md:h-5" />
            </motion.button>
          </form>
        </motion.div>
      </div>
    </>
  );
}

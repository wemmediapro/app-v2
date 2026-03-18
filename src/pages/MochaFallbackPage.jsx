/**
 * Page de fallback « démo » pour les sections non implémentées (audit CTO — découpage App.jsx).
 */
import React from 'react';
import { motion } from 'framer-motion';

export default function MochaFallbackPage({ page, pageTitle, setPage, t }) {
  return (
    <motion.div
      key={page}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
    >
      <div className="mocha-bg">
        <div className="mocha-logo">MOCHA</div>
      </div>
      <div className="relative z-10 mx-auto max-w-full rounded-2xl bg-white/95 backdrop-blur-md p-4 shadow-xl ring-1 ring-black/5 mt-4 mb-20">
        <h1 className="text-xl font-bold text-slate-900">{pageTitle}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Contenu de démo pour la section <span className="font-medium">{page}</span>.
        </p>
        <div className="mt-6 flex gap-2">
          <button
            onClick={() => setPage('home')}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 transition-colors"
          >
            {t('common.back')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

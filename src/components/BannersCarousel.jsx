/**
 * Carousel de bannières (accueil) — extrait d’App.jsx (audit CTO).
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function BannersCarousel({
  banners,
  bannerIndex,
  setBannerIndex,
  getBannerImageUrl,
  bannerViewWidth,
  backendOrigin,
  t,
  onBannerClick,
}) {
  if (!banners || banners.length === 0) return null;

  const banner = banners[bannerIndex];
  if (!banner) return null;

  const src = getBannerImageUrl(banner, bannerViewWidth) || banner.image;
  const url =
    src && (src.startsWith('data:') || src.startsWith('http'))
      ? src
      : src
        ? `${backendOrigin || ''}${src.startsWith('/') ? '' : '/'}${src}`
        : null;

  return (
    <section className="px-1 sm:px-3 md:px-4 mt-3 sm:mt-6 md:mt-6">
      <div className="relative">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={banner._id || banner.id || banner.title || bannerIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="relative rounded-xl sm:rounded-2xl overflow-hidden shadow-lg sm:shadow-xl"
          >
            <div
              className="relative min-h-[160px] sm:min-h-[140px] sm:h-52 md:min-h-[200px] md:h-72 w-full bg-gradient-to-br from-blue-400 via-cyan-500 to-blue-600 bg-cover bg-center"
              style={{ backgroundImage: url ? `url(${url})` : undefined }}
            >
              <div className="absolute inset-0 p-3 sm:p-4 md:p-5 flex flex-col justify-start">
                <div className="max-w-md w-full">
                  {banner.description ? (
                    <div className="bg-orange-400/90 backdrop-blur-sm rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 mb-2 sm:mb-3 inline-block max-w-full">
                      <p className="text-[10px] sm:text-xs font-semibold text-white leading-snug">
                        {banner.description}
                      </p>
                    </div>
                  ) : null}
                  {banner.link ? (
                    <a
                      href={banner.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        const id = banner._id || banner.id;
                        if (id && onBannerClick) onBannerClick(id);
                      }}
                      className="text-[10px] sm:text-xs text-white/90 underline cursor-pointer hover:text-white"
                    >
                      {t('common.seeDetails')}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {banners.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setBannerIndex((i) => (i - 1 + banners.length) % banners.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors z-10"
              aria-label={t('common.bannerPrevious')}
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              onClick={() => setBannerIndex((i) => (i + 1) % banners.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors z-10"
              aria-label={t('common.bannerNext')}
            >
              <ChevronRight size={24} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {banners.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setBannerIndex(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${i === bannerIndex ? 'bg-white scale-110' : 'bg-white/50 hover:bg-white/80'}`}
                  aria-label={t('common.bannerIndex', { index: i + 1 })}
                  aria-current={i === bannerIndex ? 'true' : undefined}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

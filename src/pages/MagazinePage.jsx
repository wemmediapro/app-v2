/**
 * Page Magazine — extraite d’App.jsx (audit CTO, lazy load).
 */
import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, Clock, Star, Heart, ArrowLeft, Eye } from 'lucide-react';
import { getPosterUrl } from '../services/apiService';
import { sanitizeArticleContent } from '../utils/sanitize';

export default function MagazinePage({
  t,
  setPage,
  magazineLoading,
  magazineError,
  setMagazineRetryTrigger,
  selectedCategory,
  setSelectedCategory,
  magazineCategories,
  filteredArticles,
  featuredArticles,
  breakingNews,
  selectedArticle,
  setSelectedArticle,
  isMagazineFavorite,
  toggleMagazineFavorite,
}) {
  return (
    <motion.div
      key="magazine"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100/80"
    >
      <div className="mx-auto w-full max-w-4xl px-4 sm:px-5 lg:px-6 py-5 sm:py-6 space-y-6 sm:space-y-7">
        <header className="rounded-2xl overflow-hidden shadow-lg bg-[#264FFF] px-5 py-4 sm:px-6 sm:py-5 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/30 flex-shrink-0">
              <BookOpen size={24} className="text-white sm:w-7 sm:h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">{t('magazine.title')}</h1>
              <p className="text-xs sm:text-sm text-white/90 mt-0.5 line-clamp-2">{t('magazine.description')}</p>
            </div>
          </div>
        </header>

        {magazineLoading && (
          <div className="rounded-2xl bg-white/80 backdrop-blur border border-slate-100 shadow-sm overflow-hidden" role="status" aria-live="polite" aria-label={t('magazine.loading')}>
            <div className="p-5 sm:p-6 space-y-4">
              <div className="flex gap-3">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                  <div className="h-3 bg-slate-100 rounded animate-pulse w-2/3" />
                </div>
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-200 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 rounded animate-pulse w-4/5" />
                    <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center py-8 border-t border-slate-100">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#264FFF]/20 border-t-[#264FFF]" />
              <p className="ml-3 text-slate-600 text-sm">{t('magazine.loading')}</p>
            </div>
          </div>
        )}

        {!magazineLoading && magazineError && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-6 sm:py-8 text-center shadow-sm" role="alert">
            <p className="text-amber-800 font-semibold">{t('magazine.unableToLoad')}</p>
            <p className="text-sm text-amber-700 mt-2">{magazineError}</p>
            {!magazineError.includes('Trop de requêtes') && (
              <p className="text-xs text-amber-600 mt-3 max-w-md mx-auto">{t('magazine.checkBackend')}</p>
            )}
            <button
              type="button"
              onClick={() => setMagazineRetryTrigger(prev => prev + 1)}
              className="mt-4 px-5 py-2.5 rounded-xl bg-amber-200 text-amber-900 font-medium text-sm hover:bg-amber-300 transition-colors min-h-[44px]"
            >
              {t('magazine.retry')}
            </button>
          </div>
        )}

        {breakingNews.length > 0 && (
          <button
            type="button"
            onClick={() => setSelectedArticle(breakingNews[0])}
            className="w-full rounded-2xl bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.01] active:scale-[0.99] transition-all px-5 py-4 text-left min-h-[80px] flex flex-col justify-center"
          >
            <p className="text-xs font-semibold uppercase tracking-widest opacity-95">{t('magazine.urgent')}</p>
            <p className="mt-1.5 text-sm font-bold leading-snug line-clamp-2">{breakingNews[0].title}</p>
            <p className="mt-1 text-xs text-white/85">{breakingNews[0].publishDate} · {breakingNews[0].readTime}</p>
          </button>
        )}

        <div className="w-full max-w-xs">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white border border-slate-200/80 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#264FFF]/25 focus:border-[#264FFF]"
          >
            {magazineCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>
        </div>

        {!selectedArticle && featuredArticles[0] && (
          <article className="rounded-2xl bg-white shadow-md border border-slate-100 overflow-hidden">
            <div className="flex flex-col">
              <div className="relative aspect-[16/9] sm:aspect-[2/1] bg-slate-200 overflow-hidden">
                <img
                  src={getPosterUrl(featuredArticles[0].image) || featuredArticles[0].image}
                  alt={featuredArticles[0].title}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <div className="absolute inset-0 hidden items-center justify-center text-4xl text-white bg-slate-300">
                  <BookOpen size={32} />
                </div>
              </div>
              <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="px-2.5 py-1 rounded-full bg-[#264FFF]/10 text-[#264FFF] font-semibold uppercase tracking-wide">
                    {magazineCategories.find(cat => cat.id === featuredArticles[0].category)?.name || featuredArticles[0].category}
                  </span>
                  <span>{featuredArticles[0].publishDate}</span>
                  <span>·</span>
                  <span>{featuredArticles[0].readTime}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">{featuredArticles[0].title}</h2>
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{featuredArticles[0].excerpt}</p>
                <div className="flex items-center justify-between pt-1 gap-3">
                  <span className="text-xs font-medium text-slate-500 truncate">{t('magazine.by')} {featuredArticles[0].author}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedArticle(featuredArticles[0])}
                    className="shrink-0 text-sm font-semibold text-[#264FFF] hover:text-[#264FFF] hover:underline transition-colors py-1"
                  >
                    {t('magazine.readArticle')}
                  </button>
                </div>
              </div>
            </div>
          </article>
        )}

        {!selectedArticle && !magazineLoading && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h2 className="text-base font-bold text-slate-800">
                {filteredArticles.length > 0 ? `${t('magazine.articles')} (${filteredArticles.length})` : t('magazine.noArticles')}
              </h2>
              {filteredArticles.length > 0 && featuredArticles.length > 0 && (
                <span className="text-xs text-slate-500">{featuredArticles.length} {t('magazine.featuredCount')}</span>
              )}
            </div>
            {filteredArticles.length === 0 ? (
              <div className="text-center py-14 sm:py-16 bg-white rounded-2xl border border-slate-100 shadow-sm px-4">
                <BookOpen size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">{magazineError ? t('magazine.loadFailed') : t('magazine.noArticles')}</p>
                <p className="text-sm text-slate-500 mt-1">{magazineError ? t('magazine.checkBackend') : t('magazine.modifySearch')}</p>
              </div>
            ) : (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.05 } }, hidden: {} }}
              >
                {filteredArticles.map((article) => (
                  <motion.button
                    key={article.id ?? article._id}
                    type="button"
                    variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
                    whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(15,23,42,0.12)' }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedArticle(article)}
                    className="w-full text-left rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm hover:border-slate-200 transition-all duration-200"
                  >
                    <div className="relative aspect-[16/10] w-full bg-slate-100 overflow-hidden">
                      <img
                        src={getPosterUrl(article.image) || article.image}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover object-center"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                        }}
                      />
                      <div className="absolute inset-0 hidden items-center justify-center text-slate-500 bg-slate-50">
                        <BookOpen size={32} strokeWidth={1.5} />
                      </div>
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/95 text-slate-700 text-xs font-medium shadow-sm backdrop-blur-sm">
                        <BookOpen size={12} className="text-slate-500" strokeWidth={2} />
                        {magazineCategories.find(cat => cat.id === article.category)?.name || article.category}
                      </span>
                    </div>
                    <div className="p-4">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 line-clamp-2 leading-snug">{article.title}</h3>
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2">{article.excerpt}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} strokeWidth={2} />
                          {article.publishDate}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock size={12} strokeWidth={2} />
                          {article.readTime}
                        </span>
                        {article.isFeatured && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                            <Star size={12} className="text-amber-600" strokeWidth={2} />
                            {t('magazine.featuredBadge')}
                          </span>
                        )}
                        {article.isBreaking && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                            {t('magazine.urgent')}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </section>
        )}

        {selectedArticle && (
          <article className="rounded-2xl bg-white shadow-xl border border-slate-100 overflow-hidden" role="article" aria-label={selectedArticle.title}>
            <div className="relative aspect-[16/9] sm:aspect-[2/1] bg-slate-200 overflow-hidden">
              <img
                src={getPosterUrl(selectedArticle.image) || selectedArticle.image}
                alt={selectedArticle.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 w-full h-full object-cover object-center"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling?.style && (e.target.nextElementSibling.style.display = 'flex');
                }}
              />
              <div className="absolute inset-0 hidden items-center justify-center bg-slate-300 text-slate-500">
                <BookOpen size={48} />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />
              <button
                type="button"
                onClick={() => { setPage('magazine'); setSelectedArticle(null); }}
                className="absolute top-4 left-4 z-10 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-white text-slate-800 shadow-lg ring-2 ring-black/10 hover:bg-slate-50 hover:shadow-xl transition-all duration-200 active:scale-95"
                aria-label={t('magazine.backToList')}
              >
                <ArrowLeft size={24} className="sm:w-7 sm:h-7" strokeWidth={2.5} />
              </button>
            </div>
            <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-3">
                <span className="px-2.5 py-1 rounded-full bg-[#264FFF]/10 text-[#264FFF] font-semibold uppercase tracking-wide">
                  {magazineCategories.find(cat => cat.id === selectedArticle.category)?.name || selectedArticle.category}
                </span>
                {selectedArticle.isFeatured && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">⭐ {t('magazine.featuredBadge')}</span>
                )}
                {selectedArticle.isBreaking && (
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">{t('magazine.urgent')}</span>
                )}
                <span>{selectedArticle.publishDate}</span>
                <span>·</span>
                <span>{selectedArticle.readTime}</span>
                {selectedArticle.views > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye size={14} />
                    {selectedArticle.views}
                  </span>
                )}
                {selectedArticle.likes > 0 && (
                  <span className="flex items-center gap-1">
                    <Heart size={14} />
                    {selectedArticle.likes}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight tracking-tight">
                {selectedArticle.title}
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-500">
                {t('magazine.by')} {selectedArticle.author}
              </p>
              {selectedArticle.excerpt && (
                <p className="mt-2 text-sm text-slate-600 italic border-l-2 border-slate-200 pl-4">
                  {selectedArticle.excerpt}
                </p>
              )}
            </div>
            <div className="px-4 sm:px-6 lg:px-8 pb-6">
              <div className="max-w-[65ch] article-content text-[15px] sm:text-base text-slate-600 leading-[1.7]">
                {selectedArticle.content && /<(?:\w+|figure|video|iframe)/i.test(selectedArticle.content) ? (
                  <div className="whitespace-pre-line [&_.article-inline-image]:my-4 [&_.article-inline-video]:my-4 [&_video]:max-w-full [&_iframe]:max-w-full [&_img]:rounded-lg" dangerouslySetInnerHTML={{ __html: sanitizeArticleContent(selectedArticle.content) }} />
                ) : (
                  <p className="whitespace-pre-line">{selectedArticle.content}</p>
                )}
              </div>
            </div>
            <div className="px-4 sm:px-6 lg:px-8 pb-6 space-y-4 border-t border-slate-100 pt-5">
              {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-500 mr-1">{t('magazine.tagsLabel')}</span>
                  {selectedArticle.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-[#264FFF]/10 text-[#264FFF] text-xs font-medium"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => toggleMagazineFavorite(selectedArticle)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition-colors min-h-[48px] ${isMagazineFavorite(selectedArticle?.id ?? selectedArticle?._id) ? 'border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <Heart size={20} className={isMagazineFavorite(selectedArticle?.id ?? selectedArticle?._id) ? 'fill-current' : ''} />
                  {isMagazineFavorite(selectedArticle?.id ?? selectedArticle?._id) ? t('magazine.removeFromFavorites') : t('magazine.addToFavorites')}
                </button>
              </div>
            </div>
          </article>
        )}
      </div>
    </motion.div>
  );
}

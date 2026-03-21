/**
 * Zone centrale : affiche **une** page à la fois selon `page` (state passager).
 *
 * Pages lazy-loadées : home, radio, films/séries, WebTV, magazine, restaurants, enfants, boutique,
 * plan du navire, notifications, favoris, etc. (voir imports `lazy` ci-dessous).
 *
 * Données :
 * - **Production** : lues depuis `PassengerMainContentContext` (rempli par `AppPassengerLayout`).
 * - **Tests / storybook** : props directes ; si le contexte est absent et que `props` est vide, `{}`.
 *
 * `AnimatePresence` + `PageTransition` gèrent les entrées/sorties entre pages.
 */
import React, { Suspense, lazy, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { usePassengerMainContentOptional } from '../contexts/PassengerMainContentContext';
import PageTransition from './PageTransition';
import LoadingFallback from './LoadingFallback';

const HomePage = lazy(() => import('../pages/HomePage'));
const MagazinePage = lazy(() => import('../pages/MagazinePage'));
const RestaurantPage = lazy(() => import('../pages/RestaurantPage'));
const EnfantPage = lazy(() => import('../pages/EnfantPage'));
const ShopPage = lazy(() => import('../pages/ShopPage'));
const RadioPage = lazy(() => import('./RadioPage'));
const MoviesPage = lazy(() => import('./MoviesPage'));
const WebtvPageContent = lazy(() => import('../pages/WebtvPageContent'));
const ShipmapSection = lazy(() => import('./ShipmapSection'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage'));
const FavoritesPageContent = lazy(() => import('../pages/FavoritesPageContent'));
const MochaFallbackPage = lazy(() => import('../pages/MochaFallbackPage'));

function MainContent(props) {
  const fromContext = usePassengerMainContentOptional();
  /** Sans props de test/storybook : réutiliser la ref du contexte (évite un spread + nouvel objet à chaque render parent). */
  const merged = useMemo(() => {
    if (fromContext == null) {
      return props ?? {};
    }
    if (props == null || (typeof props === 'object' && Object.keys(props).length === 0)) {
      return fromContext;
    }
    return { ...fromContext, ...props };
  }, [fromContext, props]);
  const {
    page,
    setPage,
    t,
    language,
    pageTitles,
    // home
    homePromosCombined,
    getPromoTitle,
    getPromoDescription,
    setSelectedRestaurant,
    // radio
    radioStations,
    currentRadio,
    toggleRadio,
    isPlaying,
    volume,
    handleVolumeChange,
    isFavorite,
    toggleFavorite,
    radioLoading,
    getRadioLogoUrl,
    radioPlaylistTracks,
    getRadioStreamProgress,
    // movies
    moviesAndSeries,
    moviesLoading,
    watchlist,
    toggleWatchlist,
    favoritesStorageSuffix,
    syncPlaybackToServer,
    movieToOpenFromFavorites,
    setMovieToOpenFromFavorites,
    setIsMoviesVideoPlaying,
    // webtv
    selectedChannelCategory,
    setSelectedChannelCategory,
    channelCategories,
    selectedChannel,
    setSelectedChannel,
    selectedWebtvProgram,
    webtvVideoRefRef,
    setWebtvVideoRef,
    handleWebtvVideoEnded,
    handleWebtvPlayByServerTime,
    webtvVideoError,
    setWebtvVideoError,
    webtvPlaySyncing,
    setIsWebtvVideoPlaying,
    webtvLoading,
    filteredChannels,
    getWebtvCategoryLabel,
    // magazine
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
    // restaurant
    currentShipName,
    restaurants,
    restaurantSearchQuery,
    setRestaurantSearchQuery,
    selectedRestaurantCategory,
    setSelectedRestaurantCategory,
    restaurantCategories,
    allPromotions,
    filteredRestaurants,
    restaurantsLoading,
    selectedRestaurant,
    DEFAULT_RESTAURANT_IMAGE,
    getPosterUrl,
    isRestaurantFavorite,
    toggleRestaurantFavorite,
    cart,
    addToCart,
    // enfant
    enfantActivities,
    enfantLoading,
    selectedEnfantCategory,
    setSelectedEnfantCategory,
    enfantCategories,
    enfantHighlights,
    filteredEnfantActivities,
    selectedActivity,
    setSelectedActivity,
    isEnfantFavorite,
    toggleEnfantFavorite,
    // shipmap
    shipmapShip,
    shipmapLoading,
    refetchShipmap,
    shipDecks,
    shipDecksFiltered,
    selectedDeck,
    setSelectedDeck,
    shipmapDeckTypeFilter,
    setShipmapDeckTypeFilter,
    shipSearchQuery,
    setShipSearchQuery,
    deckServices,
    selectedDeckInfo,
    filteredDeckServices,
    deckRooms,
    showShipmapAddPlanModal,
    setShowShipmapAddPlanModal,
    // notifications
    notificationsList,
    notificationsLoading,
    // favorites
    shopFavorites,
    myWatchlist,
    magazineFavoritesArticles,
    enfantFavoritesActivities,
    restaurantFavoritesList,
    shopCategories,
    setShopFavorites,
    removeFromShopFavorites,
  } = merged;

  return (
    <>
      {page === 'home' ? (
        <Suspense fallback={<LoadingFallback t={t} minHeight="short" />}>
          <HomePage
            t={t}
            setPage={setPage}
            homePromosCombined={homePromosCombined}
            getPromoTitle={getPromoTitle}
            getPromoDescription={getPromoDescription}
            setSelectedRestaurant={setSelectedRestaurant}
            language={language}
          />
        </Suspense>
      ) : (
        <AnimatePresence mode="wait">
          {page === 'radio' ? (
            <PageTransition keyProp="radio">
              <Suspense fallback={<LoadingFallback t={t} minHeight="short" />}>
                <RadioPage
                  t={t}
                  radioStations={radioStations}
                  currentRadio={currentRadio}
                  toggleRadio={toggleRadio}
                  isPlaying={isPlaying}
                  volume={volume}
                  onVolumeChange={handleVolumeChange}
                  isFavorite={isFavorite}
                  toggleFavorite={toggleFavorite}
                  loading={radioLoading}
                  getRadioLogoUrl={getRadioLogoUrl}
                  isDirectStream={!!(currentRadio && radioPlaylistTracks.length === 0)}
                  getRadioStreamProgress={getRadioStreamProgress}
                />
              </Suspense>
            </PageTransition>
          ) : page === 'movies' ? (
            <PageTransition keyProp="movies">
              <Suspense fallback={<LoadingFallback t={t} minHeight="short" />}>
                <MoviesPage
                  t={t}
                  language={language}
                  moviesAndSeries={moviesAndSeries}
                  moviesLoading={moviesLoading}
                  watchlist={watchlist}
                  toggleWatchlist={toggleWatchlist}
                  playbackStorageSuffix={favoritesStorageSuffix}
                  onSyncPlaybackToServer={syncPlaybackToServer}
                  initialSelectedMovie={movieToOpenFromFavorites}
                  initialAutoPlay={!!movieToOpenFromFavorites}
                  onClearInitialMovie={() => setMovieToOpenFromFavorites(null)}
                  onVideoPlayStart={() => setIsMoviesVideoPlaying(true)}
                  onVideoPlayEnd={() => setIsMoviesVideoPlaying(false)}
                />
              </Suspense>
            </PageTransition>
          ) : page === 'webtv' ? (
            <Suspense fallback={<LoadingFallback t={t} minHeight="short" />}>
              <WebtvPageContent
                t={t}
                setPage={setPage}
                selectedChannelCategory={selectedChannelCategory}
                setSelectedChannelCategory={setSelectedChannelCategory}
                channelCategories={channelCategories}
                selectedChannel={selectedChannel}
                setSelectedChannel={setSelectedChannel}
                selectedWebtvProgram={selectedWebtvProgram}
                webtvVideoRefRef={webtvVideoRefRef}
                setWebtvVideoRef={setWebtvVideoRef}
                handleWebtvVideoEnded={handleWebtvVideoEnded}
                handleWebtvPlayByServerTime={handleWebtvPlayByServerTime}
                webtvVideoError={webtvVideoError}
                setWebtvVideoError={setWebtvVideoError}
                webtvPlaySyncing={webtvPlaySyncing}
                setIsWebtvVideoPlaying={setIsWebtvVideoPlaying}
                webtvLoading={webtvLoading}
                filteredChannels={filteredChannels}
                getWebtvCategoryLabel={getWebtvCategoryLabel}
              />
            </Suspense>
          ) : page === 'magazine' ? (
            <Suspense fallback={<LoadingFallback t={t} />}>
              <MagazinePage
                t={t}
                setPage={setPage}
                magazineLoading={magazineLoading}
                magazineError={magazineError}
                setMagazineRetryTrigger={setMagazineRetryTrigger}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                magazineCategories={magazineCategories}
                filteredArticles={filteredArticles}
                featuredArticles={featuredArticles}
                breakingNews={breakingNews}
                selectedArticle={selectedArticle}
                setSelectedArticle={setSelectedArticle}
                isMagazineFavorite={isMagazineFavorite}
                toggleMagazineFavorite={toggleMagazineFavorite}
              />
            </Suspense>
          ) : page === 'restaurant' ? (
            <Suspense fallback={<LoadingFallback t={t} />}>
              <RestaurantPage
                currentShipName={currentShipName}
                t={t}
                restaurants={restaurants}
                restaurantSearchQuery={restaurantSearchQuery}
                setRestaurantSearchQuery={setRestaurantSearchQuery}
                selectedRestaurantCategory={selectedRestaurantCategory}
                setSelectedRestaurantCategory={setSelectedRestaurantCategory}
                restaurantCategories={restaurantCategories}
                allPromotions={allPromotions}
                getPromoTitle={getPromoTitle}
                getPromoDescription={getPromoDescription}
                filteredRestaurants={filteredRestaurants}
                restaurantsLoading={restaurantsLoading}
                setSelectedRestaurant={setSelectedRestaurant}
                selectedRestaurant={selectedRestaurant}
                DEFAULT_RESTAURANT_IMAGE={DEFAULT_RESTAURANT_IMAGE}
                getRadioLogoUrl={getRadioLogoUrl}
                isRestaurantFavorite={isRestaurantFavorite}
                toggleRestaurantFavorite={toggleRestaurantFavorite}
                getPosterUrl={getPosterUrl}
                setPage={setPage}
                cart={cart}
                addToCart={addToCart}
              />
            </Suspense>
          ) : page === 'enfant' ? (
            <Suspense fallback={<LoadingFallback t={t} />}>
              <EnfantPage
                t={t}
                enfantActivities={enfantActivities}
                enfantLoading={enfantLoading}
                selectedEnfantCategory={selectedEnfantCategory}
                setSelectedEnfantCategory={setSelectedEnfantCategory}
                enfantCategories={enfantCategories}
                enfantHighlights={enfantHighlights}
                filteredEnfantActivities={filteredEnfantActivities}
                selectedActivity={selectedActivity}
                setSelectedActivity={setSelectedActivity}
                isEnfantFavorite={isEnfantFavorite}
                toggleEnfantFavorite={toggleEnfantFavorite}
              />
            </Suspense>
          ) : page === 'shipmap' ? (
            <Suspense fallback={<LoadingFallback t={t} minHeight="short" />}>
              <ShipmapSection
                t={t}
                shipmapShip={shipmapShip}
                shipmapLoading={shipmapLoading}
                refetchShipmap={refetchShipmap}
                shipDecks={shipDecks}
                shipDecksFiltered={shipDecksFiltered}
                selectedDeck={selectedDeck}
                setSelectedDeck={setSelectedDeck}
                shipmapDeckTypeFilter={shipmapDeckTypeFilter}
                setShipmapDeckTypeFilter={setShipmapDeckTypeFilter}
                shipSearchQuery={shipSearchQuery}
                setShipSearchQuery={setShipSearchQuery}
                deckServices={deckServices}
                selectedDeckInfo={selectedDeckInfo}
                filteredDeckServices={filteredDeckServices}
                deckRooms={deckRooms}
                showShipmapAddPlanModal={showShipmapAddPlanModal}
                setShowShipmapAddPlanModal={setShowShipmapAddPlanModal}
              />
            </Suspense>
          ) : page === 'notifications' ? (
            <Suspense fallback={<LoadingFallback t={t} minHeight="short" />}>
              <NotificationsPage
                notificationsList={notificationsList}
                notificationsLoading={notificationsLoading}
                t={t}
                language={language}
                onBack={() => setPage('home')}
              />
            </Suspense>
          ) : page === 'favorites' ? (
            <Suspense fallback={<LoadingFallback t={t} minHeight="short" />}>
              <FavoritesPageContent
                pageTitleFavorites={pageTitles.favorites}
                shopFavorites={shopFavorites}
                myWatchlist={myWatchlist}
                magazineFavoritesArticles={magazineFavoritesArticles}
                enfantFavoritesActivities={enfantFavoritesActivities}
                restaurantFavoritesList={restaurantFavoritesList}
                shopCategories={shopCategories}
                magazineCategories={magazineCategories}
                t={t}
                language={language}
                setPage={setPage}
                setMovieToOpenFromFavorites={setMovieToOpenFromFavorites}
                setSelectedArticle={setSelectedArticle}
                setSelectedActivity={setSelectedActivity}
                setSelectedRestaurant={setSelectedRestaurant}
                removeFromShopFavorites={removeFromShopFavorites}
                getPosterUrl={getPosterUrl}
                getRadioLogoUrl={getRadioLogoUrl}
                defaultRestaurantImage={DEFAULT_RESTAURANT_IMAGE}
              />
            </Suspense>
          ) : page === 'shop' ? (
            <Suspense fallback={<LoadingFallback t={t} />}>
              <ShopPage
                t={t}
                language={language}
                setPage={setPage}
                shopFavorites={shopFavorites}
                setShopFavorites={setShopFavorites}
                favoritesStorageSuffix={favoritesStorageSuffix}
              />
            </Suspense>
          ) : (
            <Suspense fallback={<LoadingFallback t={t} minHeight="short" />}>
              <MochaFallbackPage page={page} pageTitle={pageTitles[page]} setPage={setPage} t={t} />
            </Suspense>
          )}
        </AnimatePresence>
      )}
    </>
  );
}

export default React.memo(MainContent);

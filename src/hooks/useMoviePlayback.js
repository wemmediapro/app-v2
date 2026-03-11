/**
 * Persistance des positions de lecture films/séries (localStorage).
 * Clé par profil : moviePlaybackPositions (invité) ou moviePlaybackPositions_<userId> (connecté).
 */
const STORAGE_KEY_BASE = 'moviePlaybackPositions';

export function getPlaybackStorageKey(storageSuffix) {
  const suffix = storageSuffix ?? 'guest';
  if (suffix === 'guest') return STORAGE_KEY_BASE;
  return `${STORAGE_KEY_BASE}_${suffix}`;
}

export function getMoviePlaybackKey(movieId, episodeIndex) {
  const id = movieId != null ? String(movieId) : null;
  if (!id) return null;
  return episodeIndex != null && episodeIndex >= 0 ? `movie-${id}-ep-${episodeIndex}` : `movie-${id}`;
}

export function getMovieLastEpisodeKey(movieId) {
  return movieId != null ? `movie-${String(movieId)}-lastEpisode` : null;
}

/** Migre les données de la clé legacy (invité) vers la clé du profil connecté (une seule fois, si la clé user est vide). */
function migrateLegacyPlaybackToUser(storageSuffix) {
  const suffix = storageSuffix ?? 'guest';
  if (suffix === 'guest') return;
  try {
    const userKey = getPlaybackStorageKey(suffix);
    const rawUser = localStorage.getItem(userKey);
    const userData = rawUser ? JSON.parse(rawUser) : {};
    if (Object.keys(userData).length > 0) return;
    const legacyRaw = localStorage.getItem(STORAGE_KEY_BASE);
    if (!legacyRaw) return;
    const legacyData = JSON.parse(legacyRaw);
    if (typeof legacyData !== 'object' || Object.keys(legacyData).length === 0) return;
    localStorage.setItem(userKey, legacyRaw);
  } catch {}
}

/** À appeler au chargement de la page Films quand l'utilisateur est connecté, pour migrer l'historique legacy avant toute lecture. */
export function runPlaybackMigrationIfNeeded(storageSuffix) {
  migrateLegacyPlaybackToUser(storageSuffix);
}

export function getSavedPlaybackPosition(key, storageSuffix = 'guest') {
  try {
    const suffix = storageSuffix ?? 'guest';
    if (suffix !== 'guest') migrateLegacyPlaybackToUser(suffix);
    const storageKey = getPlaybackStorageKey(suffix);
    const raw = localStorage.getItem(storageKey);
    const data = raw ? JSON.parse(raw) : {};
    const v = data[key];
    if (v == null) return null;
    if (typeof v === 'number') return { time: v, duration: null, percent: null };
    if (typeof v === 'object' && typeof v.time === 'number') {
      const duration = typeof v.duration === 'number' && v.duration > 0 ? v.duration : null;
      const percent = duration ? Math.min(100, Math.round((v.time / duration) * 100)) : null;
      return { time: v.time, duration, percent };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveMoviePlaybackPosition(key, time, duration, storageSuffix = 'guest') {
  try {
    const storageKey = getPlaybackStorageKey(storageSuffix);
    const raw = localStorage.getItem(storageKey);
    const data = raw ? JSON.parse(raw) : {};
    data[key] = typeof duration === 'number' && duration > 0 ? { time, duration } : { time };
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {}
}

export function saveMovieLastEpisode(movieId, episodeIndex, storageSuffix = 'guest') {
  if (movieId == null || episodeIndex == null) return;
  try {
    const storageKey = getPlaybackStorageKey(storageSuffix);
    const raw = localStorage.getItem(storageKey);
    const data = raw ? JSON.parse(raw) : {};
    data[getMovieLastEpisodeKey(movieId)] = episodeIndex;
    localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {}
}

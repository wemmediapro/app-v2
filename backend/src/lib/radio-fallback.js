/**
 * Données de secours pour la radio quand MongoDB est indisponible.
 * Utilise backend/data/radio.json pour lecture et écriture (création/modification des stations).
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data');
const RADIO_FILE = path.join(DATA_DIR, 'radio.json');

const DEFAULT_STATIONS = [
  {
    _id: '1',
    id: '1',
    name: 'FIP',
    genre: 'Variétés',
    description: 'Radio France - Musique et découverte',
    streamUrl: 'https://icecast.radiofrance.fr/fip-midfi.mp3',
    isActive: true,
    schedule: [],
    programs: [],
  },
  {
    _id: '2',
    id: '2',
    name: 'France Inter',
    genre: 'Actualités',
    description: 'Radio France - Info et divertissement',
    streamUrl: 'https://icecast.radiofrance.fr/franceinter-midfi.mp3',
    isActive: true,
    schedule: [],
    programs: [],
  },
  {
    _id: '3',
    id: '3',
    name: 'Radio Paradise',
    genre: 'Eclectique',
    description: 'Webradio internationale',
    streamUrl: 'https://stream.radioparadise.com/mp3-128',
    isActive: true,
    schedule: [],
    programs: [],
  },
];

/**
 *
 */
function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 *
 */
function readStations() {
  ensureDir();
  if (!fs.existsSync(RADIO_FILE)) {
    return [...DEFAULT_STATIONS];
  }
  try {
    const raw = fs.readFileSync(RADIO_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) && data.length > 0 ? data : [...DEFAULT_STATIONS];
  } catch (e) {
    logger.warn({ event: 'radio_fallback_read_failed', err: e.message });
    return [...DEFAULT_STATIONS];
  }
}

/**
 *
 */
function writeStations(stations) {
  ensureDir();
  fs.writeFileSync(RADIO_FILE, JSON.stringify(stations, null, 2), 'utf8');
}

/**
 *
 */
function nextId(stations) {
  let max = 0;
  stations.forEach((s) => {
    const id = typeof s._id === 'string' && s._id.match(/^\d+$/) ? parseInt(s._id, 10) : 0;
    if (id > max) {
      max = id;
    }
  });
  return String(max + 1);
}

/**
 *
 */
function toDoc(body) {
  return {
    name: (body.name || '').trim(),
    description: body.description || '',
    genre: body.genre || '',
    streamUrl: body.streamUrl && body.streamUrl.trim() ? body.streamUrl.trim() : '',
    logo: body.logo || '',
    isActive: body.isActive !== false,
    schedule: Array.isArray(body.schedule) ? body.schedule : [],
    programs: Array.isArray(body.programs) ? body.programs : [],
    playlistId: body.playlistId && body.playlistId.trim() ? body.playlistId.trim() : '',
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  /** Stations actives uniquement (pour l’app publique) */
  getAll() {
    return readStations().filter((s) => s.isActive !== false);
  },
  /** Toutes les stations (pour le dashboard / API) */
  getStationsForApi() {
    return readStations();
  },
  getById(id) {
    const stations = readStations();
    return stations.find((s) => String(s._id) === String(id));
  },
  create(body) {
    if (!body.name || !body.name.trim()) {
      return null;
    }
    const stations = readStations();
    const _id = nextId(stations);
    const station = {
      _id,
      id: _id,
      ...toDoc(body),
      createdAt: new Date().toISOString(),
    };
    stations.push(station);
    writeStations(stations);
    return station;
  },
  update(id, body) {
    const stations = readStations();
    const idx = stations.findIndex((s) => String(s._id) === String(id));
    if (idx === -1) {
      return null;
    }
    const updates = toDoc(body);
    stations[idx] = { ...stations[idx], ...updates };
    writeStations(stations);
    return stations[idx];
  },
  /** Désactive une station (soft delete, comme l’API MongoDB) */
  remove(id) {
    const stations = readStations();
    const idx = stations.findIndex((s) => String(s._id) === String(id));
    if (idx === -1) {
      return null;
    }
    const removed = stations.splice(idx, 1)[0];
    writeStations(stations);
    return removed;
  },
  /** Incrémente ou décrémente le nombre d'auditeurs (action: 'join' | 'leave') */
  updateListeners(id, action) {
    const stations = readStations();
    const idx = stations.findIndex((s) => String(s._id) === String(id));
    if (idx === -1) {
      return null;
    }
    const current = Number(stations[idx].listeners) || 0;
    const next = action === 'join' ? current + 1 : Math.max(0, current - 1);
    stations[idx].listeners = next;
    stations[idx].updatedAt = new Date().toISOString();
    writeStations(stations);
    return stations[idx];
  },
};

/**
 * Stockage de secours pour les chaînes WebTV quand MongoDB est indisponible.
 * Utilise backend/data/webtv.json
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const BACKEND_ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(BACKEND_ROOT, 'data');
const WEBTV_FILE = path.join(DATA_DIR, 'webtv.json');

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
function readChannels() {
  ensureDir();
  if (!fs.existsSync(WEBTV_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(WEBTV_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.warn({ event: 'webtv_fallback_read_failed', err: e.message });
    return [];
  }
}

/**
 *
 */
function writeChannels(channels) {
  ensureDir();
  fs.writeFileSync(WEBTV_FILE, JSON.stringify(channels, null, 2), 'utf8');
}

/**
 *
 */
function nextId(channels) {
  let max = 0;
  channels.forEach((c) => {
    const id = typeof c._id === 'string' && c._id.match(/^\d+$/) ? parseInt(c._id, 10) : 0;
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
    name: body.name || '',
    category: body.category || 'entertainment',
    description: body.description || '',
    streamUrl: body.streamUrl || '',
    logo: body.logo || '',
    imageUrl: body.imageUrl || body.logo || '',
    isLive: body.isLive !== false,
    isActive: body.isActive !== false,
    quality: body.quality || 'HD',
    viewers: body.viewers || 0,
    schedule: Array.isArray(body.schedule) ? body.schedule : [],
    programs: Array.isArray(body.programs) ? body.programs : [],
    countries: Array.isArray(body.countries) ? body.countries : [],
    shipId: body.shipId,
    destination: body.destination || '',
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getAll() {
    return readChannels().filter((c) => c.isActive !== false);
  },
  getById(id) {
    const channels = readChannels();
    return channels.find((c) => String(c._id) === String(id));
  },
  create(body) {
    const channels = readChannels();
    const _id = nextId(channels);
    const channel = {
      _id,
      ...toDoc(body),
      createdAt: new Date().toISOString(),
    };
    channels.push(channel);
    writeChannels(channels);
    return channel;
  },
  update(id, body) {
    const channels = readChannels();
    const idx = channels.findIndex((c) => String(c._id) === String(id));
    if (idx === -1) {
      return null;
    }
    const updates = toDoc(body);
    channels[idx] = { ...channels[idx], ...updates };
    writeChannels(channels);
    return channels[idx];
  },
  remove(id) {
    const channels = readChannels();
    const idx = channels.findIndex((c) => String(c._id) === String(id));
    if (idx === -1) {
      return null;
    }
    channels[idx].isActive = false;
    channels[idx].updatedAt = new Date().toISOString();
    writeChannels(channels);
    return channels[idx];
  },
};

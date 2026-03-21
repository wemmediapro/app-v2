/**
 * Compteurs de connexions Socket.io partagés entre workers (Redis).
 * Clés : gnv:connections:* — TTL 24h (rafraîchi à chaque écriture).
 *
 * - addConnectionGlobal / removeConnectionGlobal : atomique (script Lua pour l’ajout)
 * - Limite par IP globale (tous workers confondus)
 * - getStatsGlobal : total cumulé, actifs, top 20 IP
 */

const TTL_SEC = parseInt(process.env.GNV_CONNECTIONS_REDIS_TTL_SEC, 10) || 86400; // 24h
const PREFIX = 'gnv:connections:';
const KEY_ACTIVE = `${PREFIX}active`;
const KEY_TOTAL = `${PREFIX}total`; // connexions acceptées (cumul, ne décroit pas au disconnect)
const IP_PREFIX = `${PREFIX}ip:`;
const SKT_PREFIX = `${PREFIX}skt:`;

const MAX_PER_IP_DEFAULT = parseInt(process.env.MAX_CONNECTIONS_PER_IP, 10) || 50;

/** Suffixe clé Redis sûr pour une IP (évite : et caractères spéciaux). */
function ipKeySuffix(ip) {
  if (!ip || typeof ip !== 'string') {
    return 'unknown';
  }
  return Buffer.from(ip, 'utf8').toString('base64url');
}

/**
 * Ajout atomique : INCR IP, si > max rollback ; sinon INCR active/total, SET socket→ip avec EXPIRE.
 * KEYS[1]=ipKey KEYS[2]=active KEYS[3]=total KEYS[4]=sktKey
 * ARGV[1]=maxPerIp ARGV[2]=ttl ARGV[3]=ipPlain
 */
const LUA_ADD = `
local after = redis.call('INCR', KEYS[1])
if after > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  local v = redis.call('GET', KEYS[1])
  if (not v) or tonumber(v) <= 0 then redis.call('DEL', KEYS[1]) end
  return 0
end
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[2]))
redis.call('INCR', KEYS[3])
redis.call('EXPIRE', KEYS[3], tonumber(ARGV[2]))
redis.call('SET', KEYS[4], ARGV[3])
redis.call('EXPIRE', KEYS[4], tonumber(ARGV[2]))
return 1
`;

let client = null;
let enabled = false;

/**
 * @param {{ client: import('redis').RedisClientType | null, isConnected?: boolean } | import('redis').RedisClientType | null} cacheManagerOrClient
 */
async function init(cacheManagerOrClient) {
  let c = null;
  if (cacheManagerOrClient && typeof cacheManagerOrClient === 'object' && cacheManagerOrClient.client) {
    if (cacheManagerOrClient.isConnected) {
      c = cacheManagerOrClient.client;
    }
  } else if (cacheManagerOrClient && typeof cacheManagerOrClient.eval === 'function') {
    c = cacheManagerOrClient;
  }

  client = c && typeof c.eval === 'function' ? c : null;
  enabled = !!(client && typeof client.isOpen === 'function' && client.isOpen);
  if (enabled) {
    console.log('✅ redis-connection-manager : suivi cross-worker gnv:connections:*');
  } else {
    console.log('⚠️  redis-connection-manager : inactif (pas de client Redis)');
  }
}

function isEnabled() {
  return enabled && client && client.isOpen;
}

/**
 * Vérifie si l’IP a déjà atteint la limite (lecture rapide pour io.use — évite un round-trip inutile si plein).
 */
async function isIpAtOrOverLimit(ip, maxPerIp = MAX_PER_IP_DEFAULT) {
  if (!isEnabled() || !ip) {
    return false;
  }
  const ipKey = `${IP_PREFIX}${ipKeySuffix(ip)}`;
  try {
    const v = await client.get(ipKey);
    const n = v == null ? 0 : parseInt(v, 10);
    return !Number.isNaN(n) && n >= maxPerIp;
  } catch (e) {
    console.warn('[redis-connection-manager] isIpAtOrOverLimit:', e.message);
    return false;
  }
}

/**
 * @returns {Promise<boolean>}
 */
async function addConnectionGlobal(socketId, ip, maxPerIp = MAX_PER_IP_DEFAULT) {
  if (!isEnabled()) {
    return true;
  }
  const ipPlain = ip || 'unknown';
  const ipKey = `${IP_PREFIX}${ipKeySuffix(ipPlain)}`;
  const sktKey = `${SKT_PREFIX}${socketId}`;
  const keys = [ipKey, KEY_ACTIVE, KEY_TOTAL, sktKey];
  const args = [String(maxPerIp), String(TTL_SEC), ipPlain];
  try {
    const res = await client.eval(LUA_ADD, { keys, arguments: args });
    return Number(res) === 1;
  } catch (e) {
    console.warn('[redis-connection-manager] addConnectionGlobal:', e.message);
    return false;
  }
}

async function removeConnectionGlobal(socketId) {
  if (!isEnabled() || !socketId) {
    return;
  }
  const sktKey = `${SKT_PREFIX}${socketId}`;
  try {
    const ipPlain = await client.get(sktKey);
    await client.del(sktKey);
    if (!ipPlain) {
      return;
    }
    const ipKey = `${IP_PREFIX}${ipKeySuffix(ipPlain)}`;
    const newIp = await client.decr(ipKey);
    if (newIp <= 0) {
      await client.del(ipKey);
    } else {
      await client.expire(ipKey, TTL_SEC);
    }
    const act = await client.decr(KEY_ACTIVE);
    if (act < 0) {
      await client.set(KEY_ACTIVE, '0');
    }
    await client.expire(KEY_ACTIVE, TTL_SEC);
    // total (cumul) ne décroit pas
  } catch (e) {
    console.warn('[redis-connection-manager] removeConnectionGlobal:', e.message);
  }
}

/**
 * Remet les entrées `failed` en pending — ici : rescann des clés orphelines non utilisée ;
 * exposé pour conformité API (réessai manuel / ops).
 */
async function retry() {
  /* Pas d’état failed côté Redis pour une socket ; réservé pour extensions. */
  return { ok: true };
}

async function getStatsGlobal() {
  const out = {
    redis: isEnabled(),
    ttlSeconds: TTL_SEC,
    maxConnectionsPerIP: MAX_PER_IP_DEFAULT,
    active: 0,
    /** Cumul des connexions acceptées (clé Redis total, ne décroit pas au disconnect). */
    total: 0,
    totalAccepted: 0,
    byIP: [],
  };
  if (!isEnabled()) {
    out.total = 0;
    out.totalAccepted = 0;
    return out;
  }
  try {
    const [a, t] = await Promise.all([client.get(KEY_ACTIVE), client.get(KEY_TOTAL)]);
    out.active = Math.max(0, parseInt(a || '0', 10) || 0);
    out.totalAccepted = Math.max(0, parseInt(t || '0', 10) || 0);
    out.total = out.totalAccepted;

    const byIP = [];
    for await (const key of client.scanIterator({ MATCH: `${IP_PREFIX}*`, COUNT: 200 })) {
      if (key === KEY_ACTIVE || key === KEY_TOTAL) {
        continue;
      }
      const cnt = await client.get(key);
      const n = parseInt(cnt || '0', 10);
      if (Number.isNaN(n) || n <= 0) {
        continue;
      }
      const b64 = key.slice(IP_PREFIX.length);
      let ipLabel = b64;
      try {
        ipLabel = Buffer.from(b64, 'base64url').toString('utf8');
      } catch (_) {
        /* garder suffixe */
      }
      byIP.push({ ip: ipLabel, count: n });
    }

    byIP.sort((x, y) => y.count - x.count);
    out.byIP = byIP.slice(0, 20);
  } catch (e) {
    console.warn('[redis-connection-manager] getStatsGlobal:', e.message);
  }
  return out;
}

/** Au démarrage : lecture des agrégats Redis (logs / amorçage UI). */
async function loadGlobalStatsOnStartup() {
  const stats = await getStatsGlobal();
  if (stats.redis) {
    console.log(
      `[redis-connection-manager] Stats Redis au démarrage — actives: ${stats.active}, total acceptées: ${stats.totalAccepted}`
    );
  }
  return stats;
}

module.exports = {
  init,
  isEnabled,
  isIpAtOrOverLimit,
  addConnectionGlobal,
  removeConnectionGlobal,
  getStatsGlobal,
  retry,
  loadGlobalStatsOnStartup,
  TTL_SEC,
  MAX_PER_IP_DEFAULT,
};

/**
 * Détecte le format compact fil (clés courtes r,c,u,ts), avec ou sans drapeau __compact.
 * @param {Record<string, unknown>} m
 */
function isCompactWireMessage(m) {
  return m && typeof m === 'object' && !m.__batch && 'r' in m && 'c' in m && 'u' in m && 'ts' in m && !('content' in m);
}

/**
 * Réhydrate un message compact serveur.
 * @param {Record<string, unknown>} m
 */
function expandCompactWire(m) {
  if (!m || typeof m !== 'object' || m.__batch === true) {
    return m;
  }
  if (m.__compact !== true && !isCompactWireMessage(m)) {
    return m;
  }
  const content = String(m.c ?? '');
  const ts = typeof m.ts === 'number' ? m.ts : Date.parse(String(m.ts));
  const normalized = {
    room: m.r,
    content,
    text: content,
    senderId: m.u,
    sender: m.u,
    timestamp: Number.isFinite(ts) ? new Date(ts) : new Date(),
  };
  if (m.a != null && String(m.a).length > 0) {
    normalized.attachment = m.a;
  }
  if (m.cs != null && String(m.cs).trim() !== '') {
    normalized.clientSyncId = String(m.cs).trim();
  }
  return normalized;
}

/**
 * Fusionne les événements `new-message` Socket.io (simple ou batch) en évitant
 * les doublons lorsque le même `clientSyncId` est renvoyé après un retry.
 */
export function appendIncomingSocketMessages(prev, incoming) {
  let list;
  if (incoming && incoming.__batch === true && Array.isArray(incoming.messages)) {
    list = incoming.messages.map((m) => expandCompactWire(m));
  } else if (incoming != null) {
    list = [expandCompactWire(incoming)];
  } else {
    list = [];
  }
  if (!list.length) return prev;
  const seenSync = new Set(prev.map((m) => m.clientSyncId).filter(Boolean));
  const toAdd = [];
  for (const msg of list) {
    const cs = msg && msg.clientSyncId;
    if (cs) {
      if (seenSync.has(cs)) continue;
      seenSync.add(cs);
    }
    toAdd.push(msg);
  }
  if (!toAdd.length) return prev;
  return [...prev, ...toAdd];
}

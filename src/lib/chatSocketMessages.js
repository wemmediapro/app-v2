/**
 * Fusionne les événements `new-message` Socket.io (simple ou batch) en évitant
 * les doublons lorsque le même `clientSyncId` est renvoyé après un retry.
 */
export function appendIncomingSocketMessages(prev, incoming) {
  const list =
    incoming && incoming.__batch === true && Array.isArray(incoming.messages)
      ? incoming.messages
      : incoming != null
        ? [incoming]
        : [];
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

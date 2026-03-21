/**
 * File de jobs asynchrone minimaliste (MVP) — évite de bloquer les handlers HTTP sur du travail long.
 * Les seeds/lourds restent en npm scripts ; ce module sert aux tâches différées depuis l’API (emails, exports, etc.).
 *
 * Pour scaler : remplacer l’implémentation par BullMQ + Redis (même REDIS_URI que le cache).
 */

const logger = require('./logger');

/** @type {Array<{ run: () => Promise<void>, label: string }>} */
const queue = [];
let running = false;

/**
 *
 */
async function drain() {
  if (running || queue.length === 0) {
    return;
  }
  running = true;
  while (queue.length > 0) {
    const job = queue.shift();
    if (!job) {
      break;
    }
    try {
      await job.run();
    } catch (err) {
      logger.error({ event: 'job_failed', label: job.label, err: err?.message || String(err) });
    }
  }
  running = false;
}

/**
 * Enfile une tâche async (exécutée après le cycle HTTP courant).
 * @param {string} label
 * @param {() => Promise<void>} fn
 */
function enqueueJob(label, fn) {
  queue.push({
    label,
    async run() {
      await fn();
    },
  });
  setImmediate(() => {
    drain().catch((e) => logger.error({ event: 'job_queue_drain', err: e?.message }));
  });
}

/**
 *
 */
function queueLength() {
  return queue.length;
}

module.exports = { enqueueJob, queueLength };

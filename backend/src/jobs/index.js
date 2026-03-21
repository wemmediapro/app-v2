/**
 * Files Bull (Redis) pour tâches admin asynchrones.
 *
 * Activation : BULL_JOBS_ENABLED=1 et REDIS_URI (même Redis que rate limit / cache).
 *
 * Files :
 * - audit : persistance auditService.logAction
 * - email : envoi SMTP (emailService)
 * - upload : post-traitement vidéo / image après écriture disque (multer)
 * - export : export audit CSV/JSON → fichier temporaire + téléchargement
 */
const fs = require('fs');
const Bull = require('bull');
const logger = require('../lib/logger');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const NAMES = require('./queue-names');
const { registerProcessors } = require('./register-processors');

/** @type {Record<string, import('bull').Queue>|null} */
let queues = null;
let processorsBound = false;

function getRedisUrl() {
  try {
    const config = require('../config');
    return config.redis?.uri || process.env.REDIS_URI || process.env.REDIS_URL || '';
  } catch {
    return process.env.REDIS_URI || process.env.REDIS_URL || '';
  }
}

function isJobsEnabled() {
  if (process.env.BULL_JOBS_ENABLED !== '1') {
    return false;
  }
  const url = getRedisUrl();
  if (!url || typeof url !== 'string' || !url.startsWith('redis')) {
    logger.warn({
      event: 'bull_disabled_no_redis',
      message: 'BULL_JOBS_ENABLED=1 mais REDIS_URI manquant ou invalide — files désactivées.',
    });
    return false;
  }
  return true;
}

function defaultJobOptions() {
  return {
    attempts: Math.max(1, parseInt(process.env.BULL_JOB_ATTEMPTS, 10) || 5),
    backoff: {
      type: 'exponential',
      delay: Math.max(500, parseInt(process.env.BULL_JOB_BACKOFF_MS, 10) || 2000),
    },
    removeOnComplete: Math.max(10, parseInt(process.env.BULL_REMOVE_ON_COMPLETE, 10) || 200),
    removeOnFail: Math.max(10, parseInt(process.env.BULL_REMOVE_ON_FAIL, 10) || 500),
  };
}

function ensureQueues() {
  if (queues) {
    return queues;
  }
  if (!isJobsEnabled()) {
    return null;
  }
  const redisUrl = getRedisUrl();
  const opts = { defaultJobOptions: defaultJobOptions() };
  queues = {
    audit: new Bull(NAMES.AUDIT, redisUrl, opts),
    email: new Bull(NAMES.EMAIL, redisUrl, opts),
    upload: new Bull(NAMES.UPLOAD, redisUrl, opts),
    export: new Bull(NAMES.EXPORT, redisUrl, opts),
  };
  if (!processorsBound) {
    registerProcessors(queues);
    processorsBound = true;
  }
  logger.info({ event: 'bull_queues_ready', queues: Object.keys(queues) });
  return queues;
}

/**
 * Initialise les files (appeler après chargement de la config, idéalement quand Redis est joignable).
 */
function init() {
  try {
    ensureQueues();
  } catch (err) {
    logger.error({
      event: 'bull_init_failed',
      err: err.message,
      stack: err.stack,
    });
  }
}

const SLUG_TO_KEY = {
  audit: 'audit',
  email: 'email',
  upload: 'upload',
  export: 'export',
};

function getQueueBySlug(slug) {
  const q = ensureQueues();
  if (!q) {
    return null;
  }
  const key = SLUG_TO_KEY[String(slug).toLowerCase()];
  return key ? q[key] : null;
}

/**
 * Sérialise le payload audit pour Redis (ObjectId → string).
 */
function serializeAuditPayload(opts) {
  if (!opts || typeof opts !== 'object') {
    return {};
  }
  let metadata = opts.metadata;
  if (metadata != null && typeof metadata === 'object') {
    try {
      metadata = JSON.parse(JSON.stringify(metadata));
    } catch {
      metadata = null;
    }
  }
  return {
    userId: opts.userId != null ? String(opts.userId) : null,
    action: opts.action,
    resource: opts.resource,
    resourceId: opts.resourceId != null ? String(opts.resourceId) : null,
    changes: opts.changes && typeof opts.changes === 'object' ? opts.changes : {},
    ipAddress: opts.ipAddress || null,
    userAgent: opts.userAgent || null,
    status: opts.status || 'success',
    errorMessage: opts.errorMessage || null,
    metadata,
  };
}

/**
 * @returns {Promise<import('bull').Job|any>}
 */
async function submitAuditLog(opts) {
  if (!isJobsEnabled()) {
    return auditService.logAction(opts);
  }
  const q = ensureQueues();
  if (!q) {
    return auditService.logAction(opts);
  }
  return q.audit.add('write', serializeAuditPayload(opts));
}

async function submitEmailJob(payload) {
  const q = ensureQueues();
  if (!q) {
    return emailService.sendMail(payload);
  }
  return q.email.add('send', payload);
}

async function submitUploadJob(payload) {
  const q = ensureQueues();
  if (!q) {
    throw new Error('bull_upload_requires_redis');
  }
  return q.upload.add('process', payload);
}

async function submitExportJob(payload) {
  const q = ensureQueues();
  if (!q) {
    throw new Error('bull_export_requires_redis');
  }
  return q.export.add('audit-logs', payload);
}

async function getJobStatus(slug, jobId) {
  const queue = getQueueBySlug(slug);
  if (!queue) {
    return { state: 'unavailable', message: 'Bull désactivé ou file inconnue' };
  }
  const id = isNaN(Number(jobId)) ? jobId : Number(jobId);
  const job = await queue.getJob(id);
  if (!job) {
    return { state: 'missing', jobId: id };
  }
  const state = await job.getState();
  return {
    state,
    jobId: job.id,
    progress: job.progress(),
    result: job.returnvalue,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
  };
}

/**
 * Chemin fichier export terminé (admin uniquement).
 */
async function getExportJobFileMeta(slug, jobId) {
  if (String(slug).toLowerCase() !== 'export') {
    return null;
  }
  const status = await getJobStatus('export', jobId);
  if (status.state !== 'completed' || !status.result?.filePath) {
    return null;
  }
  const fp = status.result.filePath;
  if (!fp || !fs.existsSync(fp)) {
    return null;
  }
  return {
    filePath: fp,
    contentType: status.result.contentType || 'application/octet-stream',
    filename: status.result.filename || 'export.bin',
  };
}

async function closeQueues() {
  if (!queues) {
    return;
  }
  const list = Object.values(queues);
  queues = null;
  processorsBound = false;
  await Promise.all(
    list.map((q) => q.close().catch((e) => logger.warn({ event: 'bull_queue_close_warn', err: e.message })))
  );
  logger.info({ event: 'bull_queues_closed' });
}

module.exports = {
  NAMES,
  init,
  isJobsEnabled,
  ensureQueues,
  submitAuditLog,
  submitEmailJob,
  submitUploadJob,
  submitExportJob,
  getJobStatus,
  getExportJobFileMeta,
  getQueueBySlug,
  closeQueues,
  serializeAuditPayload,
};

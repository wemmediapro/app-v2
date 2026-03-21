/**
 * Processeurs Bull — exécutés dans le même process que l’API (ou worker dédié si vous extrayez ce module).
 */
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('../lib/logger');
const auditService = require('../services/auditService');
const emailService = require('../services/emailService');
const { processVideo } = require('../services/videoCompression');
const { encodeToHls } = require('../services/hlsEncode');
const { optimizeImage, writeWebpSibling } = require('../services/imageOptimization');

/**
 * @param {object} queues
 * @param {import('bull').Queue} queues.auditQueue
 * @param {import('bull').Queue} queues.emailQueue
 * @param {import('bull').Queue} queues.uploadQueue
 * @param {import('bull').Queue} queues.exportQueue
 */
function registerProcessors({ auditQueue, emailQueue, uploadQueue, exportQueue }) {
  auditQueue.process('write', 8, async (job) => {
    const data = job.data || {};
    await auditService.logAction({
      userId: data.userId || null,
      action: data.action,
      resource: data.resource,
      resourceId: data.resourceId || null,
      changes: data.changes || {},
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
      status: data.status || 'success',
      errorMessage: data.errorMessage || null,
      metadata: data.metadata || null,
    });
  });

  emailQueue.process('send', 3, async (job) => {
    const { to, subject, text, html, from } = job.data || {};
    return emailService.sendMail({ to, subject, text, html, from });
  });

  uploadQueue.process('process', 2, async (job) => {
    const { kind, inputPath, baseUrl, enableHls } = job.data || {};
    if (!inputPath || !fs.existsSync(inputPath)) {
      throw new Error('upload_job_missing_file');
    }
    if (kind === 'video') {
      const { url, path: outputPath } = await processVideo(inputPath);
      if (enableHls && outputPath && fs.existsSync(outputPath)) {
        encodeToHls(outputPath)
          .then((hls) => {
            if (hls) {
              logger.info({ event: 'upload_hls_generated_job', hlsUrl: hls.hlsUrl });
            }
          })
          .catch((e) => logger.warn({ event: 'upload_hls_encode_job_failed', err: e.message }));
      }
      const fullUrl = url.startsWith('http') ? url : `${String(baseUrl || '').replace(/\/$/, '')}${url}`;
      return { url: fullUrl, path: url, quality: '480p' };
    }
    if (kind === 'image') {
      let filePath = inputPath;
      let filename = path.basename(inputPath);
      try {
        const result = await optimizeImage(inputPath);
        filePath = result.path;
        filename = result.filename;
      } catch (optErr) {
        logger.warn({ event: 'upload_image_optimize_job_fallback', err: optErr.message });
      }
      const webpFilename = await writeWebpSibling(filePath);
      const relativePath = `/uploads/images/${filename}`;
      const fullUrl = `${String(baseUrl || '').replace(/\/$/, '')}${relativePath}`;
      const webpRelative = webpFilename ? `/uploads/images/${webpFilename}` : undefined;
      return {
        url: fullUrl,
        path: relativePath,
        ...(webpRelative && {
          webpPath: webpRelative,
          webpUrl: `${String(baseUrl || '').replace(/\/$/, '')}${webpRelative}`,
        }),
      };
    }
    throw new Error(`upload_job_unknown_kind:${kind}`);
  });

  exportQueue.process('audit-logs', 1, async (job) => {
    const { format, filters } = job.data || {};
    const fmt = format === 'csv' ? 'csv' : 'json';
    const { content, contentType } = await auditService.exportLogs(fmt, filters || {});
    const ext = fmt === 'csv' ? 'csv' : 'json';
    const tmp = path.join(os.tmpdir(), `audit-export-${job.id}-${Date.now()}.${ext}`);
    await fsp.writeFile(tmp, content, 'utf8');
    return {
      filePath: tmp,
      contentType,
      filename: `audit-logs.${ext}`,
    };
  });

  const onFailed = (queueName) => (job, err) => {
    logger.error({
      event: 'bull_job_failed',
      queue: queueName,
      jobId: job?.id,
      err: err?.message,
    });
  };
  auditQueue.on('failed', onFailed('audit'));
  emailQueue.on('failed', onFailed('email'));
  uploadQueue.on('failed', onFailed('upload'));
  exportQueue.on('failed', onFailed('export'));
}

module.exports = { registerProcessors };

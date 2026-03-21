/**
 * Surveillance heap Node.js (intervalle 30s) — alertes 80 % / warning 85 % / critique 90 %.
 * forceGC() : nécessite --expose-gc dans NODE_OPTIONS (voir ecosystem.production.cjs).
 */

const EventEmitter = require('events');
const v8 = require('v8');
const logger = require('./logger');

const DEFAULT_INTERVAL_MS = parseInt(process.env.MEMORY_MONITOR_INTERVAL_MS, 10) || 30_000;
const THRESHOLD_ALERT = parseFloat(process.env.MEMORY_HEAP_ALERT_PERCENT, 10) || 80;
const THRESHOLD_WARNING = parseFloat(process.env.MEMORY_HEAP_WARNING_PERCENT, 10) || 85;
const THRESHOLD_CRITICAL = parseFloat(process.env.MEMORY_HEAP_CRITICAL_PERCENT, 10) || 90;

class MemoryMonitor extends EventEmitter {
  constructor() {
    super();
    this.intervalMs = DEFAULT_INTERVAL_MS;
    this.timer = null;
    this.lastSnapshot = null;
  }

  /**
   * Mesure actuelle : heapUsed vs heap_size_limit (V8) pour un % cohérent avec OOM.
   */
  getSnapshot() {
    const mu = process.memoryUsage();
    const vs = v8.getHeapStatistics();
    const heapLimit = vs.heap_size_limit || mu.heapTotal || 1;
    const percent = Math.min(100, (mu.heapUsed / heapLimit) * 100);
    const snap = {
      timestamp: new Date().toISOString(),
      heapUsed: mu.heapUsed,
      heapTotal: mu.heapTotal,
      external: mu.external,
      arrayBuffers: mu.arrayBuffers,
      rss: mu.rss,
      heapSizeLimit: heapLimit,
      percent: Math.round(percent * 100) / 100,
    };
    this.lastSnapshot = snap;
    return snap;
  }

  /**
   * Indication GC globale si V8 exposé (--expose-gc).
   */
  forceGC() {
    if (typeof global.gc === 'function') {
      try {
        global.gc();
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  _tick() {
    const snap = this.getSnapshot();
    const { percent } = snap;

    // Log structuré à chaque passage (observabilité)
    const logLine = {
      timestamp: snap.timestamp,
      heapUsed: snap.heapUsed,
      heapTotal: snap.heapTotal,
      external: snap.external,
      rss: snap.rss,
      percent: snap.percent,
    };

    if (percent > THRESHOLD_ALERT) {
      logger.warn({ event: 'memory_monitor_heap', ...logLine });
    } else {
      logger.info({ event: 'memory_monitor_heap', ...logLine });
    }

    if (percent >= THRESHOLD_CRITICAL) {
      this.emit('memory-critical', snap);
    } else if (percent >= THRESHOLD_WARNING) {
      this.emit('memory-warning', snap);
    }
  }

  start(options = {}) {
    if (this.timer) {return this;}
    if (options.intervalMs) {this.intervalMs = options.intervalMs;}
    this.timer = setInterval(() => this._tick(), this.intervalMs);
    if (typeof this.timer.unref === 'function') {this.timer.unref();}
    // Premier échantillon rapide au démarrage
    setImmediate(() => {
      try {
        this._tick();
      } catch (_) {}
    });
    return this;
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    return this;
  }

  getThresholds() {
    return {
      alertPercent: THRESHOLD_ALERT,
      warningPercent: THRESHOLD_WARNING,
      criticalPercent: THRESHOLD_CRITICAL,
    };
  }
}

const memoryMonitor = new MemoryMonitor();

module.exports = memoryMonitor;
module.exports.MemoryMonitor = MemoryMonitor;

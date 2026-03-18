/**
 * Point d'entrée cluster (module cluster Node.js).
 * Usage : NODE_ENV=production node cluster.js (ou npm run start:cluster).
 * En prod avec PM2 : ecosystem utilise server.js + exec_mode: 'cluster' → ce fichier n'est pas utilisé.
 * En dev : node server.js ou npm run dev (un seul processus).
 * Anti crash-loop : max 5 redémarrages en 60s par worker, puis backoff exponentiel.
 */
const cluster = require('cluster');
const os = require('os');

const numCPUs = process.env.WORKERS ? parseInt(process.env.WORKERS, 10) : os.cpus().length;
const MAX_RESTARTS_IN_WINDOW = 5;
const RESTART_WINDOW_MS = 60 * 1000;
const RESTART_BASE_DELAY_MS = 1000;
const RESTART_MAX_DELAY_MS = 30 * 1000;

/** Exits dans la fenêtre glissante 60s — au-delà de 5, backoff exponentiel avant prochain fork */
const restartTimestamps = [];

function pruneOldRestarts(now) {
  const cutoff = now - RESTART_WINDOW_MS;
  while (restartTimestamps.length > 0 && restartTimestamps[0] < cutoff) {
    restartTimestamps.shift();
  }
}

function scheduleFork() {
  const now = Date.now();
  restartTimestamps.push(now);
  pruneOldRestarts(now);
  if (restartTimestamps.length >= MAX_RESTARTS_IN_WINDOW) {
    const excess = restartTimestamps.length - MAX_RESTARTS_IN_WINDOW;
    const delayMs = Math.min(RESTART_MAX_DELAY_MS, RESTART_BASE_DELAY_MS * Math.pow(2, excess));
    console.warn(`⚠️  Anti crash-loop : ${restartTimestamps.length} redémarrages en 60s — attente ${delayMs / 1000}s avant prochain fork`);
    setTimeout(() => cluster.fork(), delayMs);
  } else {
    cluster.fork();
  }
}

if (cluster.isPrimary) {
  console.log(`🔄 Primary ${process.pid} : démarrage de ${numCPUs} worker(s)`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️  Worker ${worker.process.pid} arrêté (${code || signal}). Relance...`);
    scheduleFork();
  });
} else {
  require('./server');
}

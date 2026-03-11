/**
 * Point d'entrée cluster pour scaler le backend sur tous les cœurs CPU.
 * Usage : NODE_ENV=production node cluster.js
 * En dev : node server.js ou npm run dev (un seul processus)
 */
const cluster = require('cluster');
const os = require('os');

const numCPUs = process.env.WORKERS ? parseInt(process.env.WORKERS, 10) : os.cpus().length;

if (cluster.isPrimary) {
  console.log(`🔄 Primary ${process.pid} : démarrage de ${numCPUs} worker(s)`);
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  cluster.on('exit', (worker, code, signal) => {
    console.log(`⚠️  Worker ${worker.process.pid} arrêté (${code || signal}). Relance...`);
    cluster.fork();
  });
} else {
  require('./server');
}

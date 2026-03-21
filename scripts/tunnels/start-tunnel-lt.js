// Script pour démarrer le frontend avec localtunnel (sans authentification)
import { spawn } from 'child_process';

const PORT = 5173;

console.log('🚀 Démarrage du frontend avec localtunnel...\n');

// Démarrer Vite
console.log(`🌐 Démarrage du serveur Vite sur le port ${PORT}...`);
const vite = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd(),
});

// Attendre que le serveur démarre
setTimeout(() => {
  console.log('\n🔗 Création du tunnel localtunnel...');
  const tunnel = spawn('npx', ['localtunnel', '--port', PORT.toString()], {
    stdio: 'inherit',
    shell: true,
  });

  console.log('\n✅ Tunnel créé!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌐 URL locale:    http://localhost:${PORT}`);
  console.log('🔗 URL publique:  (sera affichée ci-dessus)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⚠️  Appuyez sur Ctrl+C pour arrêter\n');

  // Gérer l'arrêt propre
  const cleanup = () => {
    console.log('\n\n🛑 Arrêt en cours...');
    tunnel.kill();
    vite.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}, 3000);

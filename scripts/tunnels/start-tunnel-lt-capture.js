// Script pour démarrer localtunnel et capturer l'URL
import { spawn } from 'child_process';

const PORT = 5173;

console.log('🚀 Démarrage du tunnel localtunnel...\n');
console.log(`🌐 Frontend local: http://localhost:${PORT}\n`);

const tunnel = spawn('npx', ['localtunnel', '--port', PORT.toString()], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true,
});

let urlCaptured = false;

tunnel.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);

  // Capturer l'URL du tunnel
  const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.loca\.lt/);
  if (urlMatch && !urlCaptured) {
    urlCaptured = true;
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Tunnel créé avec succès!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🌐 URL locale:    http://localhost:${PORT}`);
    console.log(`🔗 URL publique:  ${urlMatch[0]}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  Appuyez sur Ctrl+C pour arrêter le tunnel\n');
  }
});

tunnel.stderr.on('data', (data) => {
  process.stderr.write(data);
});

tunnel.on('close', (code) => {
  console.log(`\n🛑 Tunnel arrêté (code: ${code})`);
  process.exit(code);
});

// Gérer l'arrêt propre
process.on('SIGINT', () => {
  console.log('\n\n🛑 Arrêt du tunnel...');
  tunnel.kill();
  process.exit(0);
});

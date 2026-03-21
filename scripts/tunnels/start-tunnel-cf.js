/**
 * Tunnel public via Cloudflare Quick Tunnel (cloudflared)
 * Expose le frontend (ou le backend) sur une URL publique *.trycloudflare.com
 *
 * Prérequis : installer cloudflared
 *   macOS:   brew install cloudflared
 *   Windows: winget install Cloudflare.cloudflared  ou  scoop install cloudflared
 *   Linux:   https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
 *
 * Usage:
 *   npm run tunnel:cf           → frontend (port 5173)
 *   TUNNEL_PORT=3000 npm run tunnel:cf   → backend (port 3000)
 *   TUNNEL_APP=0 npm run tunnel:cf       → ne pas lancer Vite, tunnel seul vers PORT
 */

import { spawn } from 'child_process';
import { platform } from 'os';

const DEFAULT_PORT = 5173;
const PORT = parseInt(process.env.TUNNEL_PORT || String(DEFAULT_PORT), 10);
// Lancer Vite uniquement si on expose le frontend (port 5173)
const START_APP = process.env.TUNNEL_APP !== '0' && PORT === DEFAULT_PORT;

const TRYCLOUDFLARE_REGEX = /https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/g;

function run() {
  console.log('🚀 Tunnel public Cloudflare (cloudflared)\n');

  let appProcess = null;

  const startCloudflared = () => {
    const cloudflaredCmd = platform() === 'win32' ? 'cloudflared.exe' : 'cloudflared';
    const child = spawn(cloudflaredCmd, ['tunnel', '--url', `http://127.0.0.1:${PORT}`], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    });

    let resolved = false;
    const onOutput = (data) => {
      const str = data.toString();
      process.stdout.write(str);
      const urls = str.match(TRYCLOUDFLARE_REGEX);
      if (urls && urls[0] && !resolved) {
        resolved = true;
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🔗 URL publique:  ${urls[0]}`);
        console.log(`🌐 URL locale:    http://localhost:${PORT}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('⚠️  Ctrl+C pour arrêter le tunnel.\n');
      }
    };

    child.stdout.on('data', onOutput);
    child.stderr.on('data', onOutput);

    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        console.error('\n❌ cloudflared introuvable.');
        console.error(
          '   Installez-le : https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/'
        );
        console.error('   macOS: brew install cloudflared\n');
      } else {
        console.error('\n❌ Erreur cloudflared:', err.message);
      }
      if (appProcess) appProcess.kill();
      process.exit(1);
    });

    child.on('close', (code) => {
      if (code !== 0 && code !== null) {
        if (!resolved) {
          console.error(
            "\n❌ Le tunnel Cloudflare s'est fermé. Vérifiez que le port",
            PORT,
            'est bien utilisé par votre app.'
          );
        }
        if (appProcess) appProcess.kill();
        process.exit(code);
      }
    });

    return child;
  };

  const cleanup = () => {
    console.log('\n\n🛑 Arrêt du tunnel...');
    if (appProcess) appProcess.kill();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  if (START_APP) {
    console.log(`🌐 Démarrage du frontend (Vite) sur le port ${PORT}...\n`);
    appProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'inherit',
      shell: true,
      cwd: process.cwd(),
    });

    appProcess.on('error', (err) => {
      console.error('Erreur démarrage app:', err.message);
      process.exit(1);
    });

    setTimeout(() => {
      startCloudflared();
    }, 4000);
  } else {
    console.log(`🔗 Tunnel seul vers http://127.0.0.1:${PORT}`);
    console.log("   (lancez l'app vous-même sur ce port)\n");
    startCloudflared();
  }
}

run();

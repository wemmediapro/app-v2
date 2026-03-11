// Script pour démarrer le frontend avec un tunnel ngrok
import { spawn } from 'child_process';
import ngrok from 'ngrok';

const PORT = 5173;

console.log('🚀 Démarrage du frontend avec tunnel ngrok...\n');

// Démarrer Vite en arrière-plan
console.log(`🌐 Démarrage du serveur Vite sur le port ${PORT}...`);
const vite = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
  cwd: process.cwd()
});

// Attendre que le serveur démarre
setTimeout(async () => {
  try {
    console.log('\n🔗 Création du tunnel ngrok...');
    
    // Configuration du tunnel avec authentification optionnelle
    const tunnelConfig = {
      addr: PORT,
      authtoken: process.env.NGROK_AUTH_TOKEN || undefined
    };
    
    // Ajouter l'authentification HTTP de base si configurée
    if (process.env.NGROK_USERNAME && process.env.NGROK_PASSWORD) {
      tunnelConfig.basic_auth = `${process.env.NGROK_USERNAME}:${process.env.NGROK_PASSWORD}`;
      console.log('🔐 Authentification HTTP activée');
    }
    
    // Essayer de se connecter avec ou sans token
    const url = await ngrok.connect(tunnelConfig);
    
    console.log('\n✅ Tunnel créé avec succès!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🌐 URL locale:    http://localhost:${PORT}`);
    console.log(`🔗 URL publique:  ${url}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Interface ngrok: http://localhost:4040');
    console.log('⚠️  Appuyez sur Ctrl+C pour arrêter\n');
    
    // Gérer l'arrêt propre
    const cleanup = async () => {
      console.log('\n\n🛑 Arrêt en cours...');
      try {
        await ngrok.disconnect();
        await ngrok.kill();
      } catch (e) {
        // Ignorer les erreurs de nettoyage
      }
      vite.kill();
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
  } catch (error) {
    console.error('\n❌ Erreur lors de la création du tunnel:', error.message);
    console.log('\n💡 Solutions possibles:');
    console.log('   1. Obtenez un token gratuit sur https://dashboard.ngrok.com/get-started/your-authtoken');
    console.log('   2. Définissez-le avec: export NGROK_AUTH_TOKEN=votre_token');
    console.log('   3. Ou utilisez localtunnel: npx localtunnel --port 5173\n');
    vite.kill();
    process.exit(1);
  }
}, 4000);

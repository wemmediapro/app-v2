#!/usr/bin/env node

// Script simple pour démarrer le frontend avec ngrok
import { spawn } from 'child_process';
import ngrok from 'ngrok';

const PORT = 5173;

console.log('🚀 Démarrage du frontend avec tunnel ngrok...\n');

// Démarrer Vite
console.log('🌐 Démarrage du serveur Vite sur le port', PORT);
const vite = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

// Attendre que le serveur démarre
setTimeout(async () => {
  try {
    console.log('\n🔗 Création du tunnel ngrok...');
    const url = await ngrok.connect({
      addr: PORT,
      authtoken: process.env.NGROK_AUTH_TOKEN || undefined
    });
    
    console.log('\n✅ Tunnel créé avec succès!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🌐 URL locale:    http://localhost:' + PORT);
    console.log('🔗 URL publique:  ' + url);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Interface ngrok: http://localhost:4040');
    console.log('⚠️  Appuyez sur Ctrl+C pour arrêter\n');
    
    // Gérer l'arrêt propre
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Arrêt en cours...');
      await ngrok.disconnect();
      await ngrok.kill();
      vite.kill();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de la création du tunnel:', error.message);
    console.log('\n💡 Astuce: Vous pouvez obtenir un token gratuit sur https://dashboard.ngrok.com/get-started/your-authtoken');
    console.log('   Puis définissez-le avec: export NGROK_AUTH_TOKEN=votre_token\n');
    vite.kill();
    process.exit(1);
  }
}, 3000);

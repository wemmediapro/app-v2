// Script pour démarrer le frontend avec un tunnel ngrok sécurisé (avec mot de passe)
import { spawn } from 'child_process';
import ngrok from 'ngrok';
import readline from 'readline';

const PORT = 5173;

// Fonction pour demander un mot de passe de manière sécurisée
function askPassword(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

console.log('🚀 Démarrage du frontend avec tunnel ngrok sécurisé...\n');

// Demander les identifiants si non définis dans les variables d'environnement
async function getCredentials() {
  let username = process.env.NGROK_USERNAME;
  let password = process.env.NGROK_PASSWORD;
  
  if (!username) {
    username = await askPassword('👤 Nom d\'utilisateur pour le tunnel: ');
  }
  
  if (!password) {
    password = await askPassword('🔐 Mot de passe pour le tunnel: ');
  }
  
  return { username, password };
}

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
    console.log('\n🔗 Création du tunnel ngrok sécurisé...');
    
    // Obtenir les identifiants
    const { username, password } = await getCredentials();
    
    // Configuration du tunnel avec authentification HTTP de base
    const tunnelConfig = {
      addr: PORT,
      authtoken: process.env.NGROK_AUTH_TOKEN || undefined,
      basic_auth: `${username}:${password}`
    };
    
    const url = await ngrok.connect(tunnelConfig);
    
    console.log('\n✅ Tunnel sécurisé créé avec succès!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🌐 URL locale:    http://localhost:${PORT}`);
    console.log(`🔗 URL publique:  ${url}`);
    console.log(`👤 Utilisateur:   ${username}`);
    console.log(`🔐 Mot de passe:   ${'*'.repeat(password.length)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Interface ngrok: http://localhost:4040');
    console.log('⚠️  Appuyez sur Ctrl+C pour arrêter\n');
    console.log('💡 Pour éviter de saisir le mot de passe à chaque fois:');
    console.log(`   export NGROK_USERNAME="${username}"`);
    console.log(`   export NGROK_PASSWORD="${password}"\n`);
    
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

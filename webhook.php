<?php
/**
 * Webhook GitHub pour déploiement automatique sur Hostinger
 * Placez ce fichier dans: public_html/webhook.php
 * Configurez-le dans GitHub: Settings > Webhooks > Add webhook
 * URL: https://votre-domaine.com/webhook.php
 * Content type: application/json
 * Secret: (optionnel, mais recommandé)
 */

// Configuration de sécurité
$secret = 'VOTRE_SECRET_KEY_ICI'; // Changez cette clé
$log_file = __DIR__ . '/deploy.log';

// Fonction de logging
function log_message($message) {
    global $log_file;
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($log_file, "[$timestamp] $message\n", FILE_APPEND);
}

// Vérifier que c'est une requête POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    die('Method not allowed');
}

// Récupérer les données
$payload = file_get_contents('php://input');
$headers = getallheaders();

// Vérifier le secret (optionnel mais recommandé)
if (!empty($secret)) {
    $signature = isset($headers['X-Hub-Signature-256']) ? $headers['X-Hub-Signature-256'] : '';
    $hash = 'sha256=' . hash_hmac('sha256', $payload, $secret);
    
    if (!hash_equals($signature, $hash)) {
        log_message('ERROR: Signature invalide');
        http_response_code(403);
        die('Invalid signature');
    }
}

// Décoder le payload
$data = json_decode($payload, true);

// Vérifier que c'est un push sur la branche main
if (isset($data['ref']) && $data['ref'] === 'refs/heads/main') {
    log_message('Déploiement déclenché pour la branche main');
    
    // Exécuter le script de déploiement
    $deploy_script = __DIR__ . '/deploy.sh';
    
    if (file_exists($deploy_script)) {
        // Exécuter en arrière-plan
        $output = [];
        $return_var = 0;
        exec("bash $deploy_script >> " . __DIR__ . "/deploy.log 2>&1 &", $output, $return_var);
        
        log_message('Script de déploiement lancé');
        http_response_code(200);
        echo json_encode(['status' => 'success', 'message' => 'Deployment started']);
    } else {
        log_message('ERROR: Script de déploiement non trouvé');
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Deploy script not found']);
    }
} else {
    log_message('Push ignoré (pas sur la branche main)');
    http_response_code(200);
    echo json_encode(['status' => 'ignored', 'message' => 'Not main branch']);
}



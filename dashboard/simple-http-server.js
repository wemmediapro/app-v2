// Serveur HTTP simple qui accepte TOUS les hosts sans restriction
import { createServer } from 'http';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({
  target: 'http://localhost:5173',
  changeOrigin: true,
  ws: true
});

const server = createServer((req, res) => {
  // Accepter TOUTES les requêtes sans aucune vérification
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Host: ${req.headers.host || 'unknown'}`);
  
  proxy.web(req, res, {
    target: 'http://localhost:5173',
    changeOrigin: true
  });
});

// Support WebSocket
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (!res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Proxy error: ' + err.message);
  }
});

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur HTTP simple démarré sur le port ${PORT}`);
  console.log(`🌐 Accepte TOUS les hosts sans restriction`);
  console.log(`📱 URL locale: http://localhost:${PORT}`);
  console.log(`🔄 Proxy vers Vite: http://localhost:5173`);
});


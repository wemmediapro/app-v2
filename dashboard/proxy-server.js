// Serveur proxy simple pour contourner la vérification du host de Vite
import { createServer } from 'http';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({
  target: 'http://localhost:5173',
  changeOrigin: true,
  ws: true
});

const server = createServer((req, res) => {
  // Accepter toutes les requêtes sans vérification du host
  proxy.web(req, res, {
    target: 'http://localhost:5173',
    changeOrigin: true
  });
});

// Support WebSocket pour HMR
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

proxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err);
  if (!res.headersSent) {
    res.writeHead(500, {
      'Content-Type': 'text/plain'
    });
    res.end('Proxy error');
  }
});

const PORT = 5174;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur proxy démarré sur le port ${PORT}`);
  console.log(`🌐 Le tunnel doit pointer vers le port ${PORT}`);
  console.log(`📱 URL locale: http://localhost:${PORT}`);
});


// Serveur Express simple qui accepte tous les hosts
import express from 'express';
import { createServer } from 'http';
import { createProxyServer } from 'http-proxy';

const app = express();
const server = createServer(app);

// Proxy vers Vite
const viteProxy = createProxyServer({
  target: 'http://localhost:5173',
  changeOrigin: true,
  ws: true
});

// Accepter toutes les requêtes sans vérification du host
app.use((req, res, next) => {
  // Logger pour debug
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Host: ${req.headers.host}`);
  next();
});

// Proxy toutes les requêtes vers Vite
app.use((req, res) => {
  viteProxy.web(req, res, {
    target: 'http://localhost:5173',
    changeOrigin: true
  });
});

// Support WebSocket
server.on('upgrade', (req, socket, head) => {
  viteProxy.ws(req, socket, head);
});

viteProxy.on('error', (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (!res.headersSent) {
    res.writeHead(502, {
      'Content-Type': 'text/plain'
    });
    res.end('Proxy error: ' + err.message);
  }
});

const PORT = 5175;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Serveur Express démarré sur le port ${PORT}`);
  console.log(`🌐 Accepte TOUS les hosts sans vérification`);
  console.log(`📱 URL locale: http://localhost:${PORT}`);
  console.log(`🔄 Proxy vers Vite: http://localhost:5173`);
});







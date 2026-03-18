// Serveur Express simple pour le dashboard (dev) — n'accepte que des hosts autorisés
import express from 'express';
import { createServer } from 'http';
import { createProxyServer } from 'http-proxy';

const app = express();
const server = createServer(app);

// Hosts autorisés (whitelist). Extensible via ALLOWED_HOSTS (ex. "localhost:5175,127.0.0.1:5175,dev.example.com")
const DEFAULT_ALLOWED = ['localhost', '127.0.0.1', '::1', '::ffff:127.0.0.1'];
const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(',').map((h) => h.trim().toLowerCase())
  : DEFAULT_ALLOWED;

function normalizeHost(host) {
  if (!host) return '';
  let h = host.trim();
  if (h.startsWith('[')) {
    const end = h.indexOf(']');
    h = end >= 0 ? h.slice(1, end) : h;
  } else {
    const lastColon = h.lastIndexOf(':');
    if (lastColon > 0 && /^\d+$/.test(h.slice(lastColon + 1))) {
      h = h.slice(0, lastColon);
    }
  }
  return h.toLowerCase();
}

function isHostAllowed(host) {
  if (!host) return false;
  const normalized = normalizeHost(host);
  return allowedHosts.some((allowed) => {
    const a = normalizeHost(allowed);
    return normalized === a;
  });
}

// Proxy vers Vite
const viteProxy = createProxyServer({
  target: 'http://localhost:5173',
  changeOrigin: true,
  ws: true
});

// Vérification du Host : rejeter les requêtes dont le host n'est pas dans la whitelist
app.use((req, res, next) => {
  const host = req.headers.host;
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - Host: ${host || '(absent)'}`);
  if (!isHostAllowed(host)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden: host not allowed');
    return;
  }
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
  console.log(`🔒 Hosts autorisés: ${allowedHosts.join(', ')}`);
  console.log(`📱 URL locale: http://localhost:${PORT}`);
  console.log(`🔄 Proxy vers Vite: http://localhost:5173`);
});







import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const BACKEND_URL = process.env.BACKEND_URL || 'http://web:8000';
const DIST_DIR = path.resolve(__dirname, 'dist');
const INDEX_HTML = path.join(DIST_DIR, 'index.html');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

function proxyToBackend(req, res) {
  try {
    const target = new URL(BACKEND_URL);
    const headers = { ...req.headers, host: target.host };

    // Ensure X-Forwarded headers from Dokploy / Traefik are passed along
    if (!headers['x-forwarded-proto']) {
      headers['x-forwarded-proto'] = 'https';
    }

    const proxyReq = http.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: req.url,
        method: req.method,
        headers: headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error(`[Dokploy Proxy Error] ${req.method} ${req.url} -> ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
    });

    req.pipe(proxyReq);
  } catch (err) {
    console.error(`[Proxy Exception] ${err.message}`);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy Configuration Error', message: err.message }));
  }
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. Health check for Dokploy / Docker healthchecks
  if (pathname === '/healthz' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'smehub-frontend-node' }));
    return;
  }

  // 2. Reverse proxy backend routes to Django Gunicorn container
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/static/') ||
    pathname.startsWith('/media/')
  ) {
    proxyToBackend(req, res);
    return;
  }

  // 3. Serve Frontend Static Assets with Single Page Application (SPA) fallback
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(DIST_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const isHtml = ext === '.html';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': isHtml ? 'no-cache' : 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      });
      fs.createReadStream(filePath).pipe(res);
    } else {
      // SPA Fallback: serve index.html for all client-side routes (e.g. /checkout/SME-1024)
      fs.stat(INDEX_HTML, (indexErr, indexStats) => {
        if (!indexErr && indexStats.isFile()) {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=UTF-8',
            'Cache-Control': 'no-cache',
            'X-Content-Type-Options': 'nosniff',
          });
          fs.createReadStream(INDEX_HTML).pipe(res);
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found - Build artifacts missing. Please run build.');
        }
      });
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[PayarMove Frontend] Pure Node.js server running on http://${HOST}:${PORT}`);
  console.log(`[Dokploy Mode] Proxying /api, /admin, /static, /media -> ${BACKEND_URL}`);
});

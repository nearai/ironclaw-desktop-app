#!/usr/bin/env node
// Dev harness: serve the desktop app's generated webui_v2_static frontend AND
// proxy /api/* (+ same-origin auth) to a locally-running route-enabled
// ironclaw-reborn sidecar, so the Workbench can be exercised against REAL
// Composio data through the new /connectors/* route during development.
//
//   SIDECAR_PORT=<p> SIDECAR_TOKEN=<bearer> PORT=1474 node scripts/workbench-live-proxy.mjs
//
// The browser opens http://127.0.0.1:PORT/v2/workbench?token=<SIDECAR_TOKEN>.
// /api/* is reverse-proxied to the sidecar with the Bearer token injected, so
// the API key never touches the browser and same-origin holds for the static app.
import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = '/Users/abhishekvaidyanathan/Documents/Playground/ironclaw-desktop-app-main';
const STATIC_ROOT = path.join(REPO, 'crates/ironclaw_webui_v2_static/static');
const PORT = Number(process.env.PORT || 1474);
const SIDECAR_PORT = Number(process.env.SIDECAR_PORT || 0);
const SIDECAR_TOKEN = process.env.SIDECAR_TOKEN || '';
const SIDECAR = `http://127.0.0.1:${SIDECAR_PORT}`;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.map': 'application/json'
};

async function proxyApi(req, res) {
  const target = SIDECAR + req.url;
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', async () => {
    const body = Buffer.concat(chunks);
    try {
      const headers = { 'content-type': req.headers['content-type'] || 'application/json' };
      if (SIDECAR_TOKEN) headers.authorization = `Bearer ${SIDECAR_TOKEN}`;
      const r = await fetch(target, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : body
      });
      const text = await r.text();
      res.writeHead(r.status, {
        'content-type': r.headers.get('content-type') || 'application/json',
        'access-control-allow-origin': '*'
      });
      res.end(text);
    } catch (e) {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'proxy_failed', detail: String(e.message), target }));
    }
  });
}

function serveStatic(req, res) {
  // The app is served under /v2/* but files live at STATIC_ROOT root (js/, assets/…).
  // Strip a leading /v2, serve the real file with correct MIME, else SPA index.html.
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath.replace(/^\/v2(?=\/|$)/, '') || '/';
  let filePath = path.join(STATIC_ROOT, rel);
  if (!(existsSync(filePath) && statSync(filePath).isFile())) {
    filePath = path.join(STATIC_ROOT, 'index.html'); // SPA fallback
  }
  if (!existsSync(filePath)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

http.createServer((req, res) => {
  const u = req.url || '';
  if (u.startsWith('/api/')) return proxyApi(req, res);
  // Land the preview/browser straight on the Workbench from the port root.
  if (u === '/' || u === '' || u.split('?')[0] === '/index.html') {
    res.writeHead(302, { location: `/v2/workbench?token=${SIDECAR_TOKEN}` });
    res.end();
    return;
  }
  return serveStatic(req, res);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`workbench-live-proxy: http://127.0.0.1:${PORT}  (static=${STATIC_ROOT})`);
  console.log(`  /api/* -> ${SIDECAR}  (bearer ${SIDECAR_TOKEN ? 'set' : 'MISSING'})`);
  console.log(`  open:  http://127.0.0.1:${PORT}/v2/workbench?token=${SIDECAR_TOKEN || '<token>'}`);
});

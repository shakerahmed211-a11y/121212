// Local test server: serves www/ and imitates the parts of the Firebase Realtime Database REST API the game uses
// (GET with event-stream, PUT, POST, PATCH, DELETE). Run: npm run build && npm run serve   then open http://localhost:8099
// Online rooms in the page are pointed at this server automatically.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'www');
const PORT = Number(process.env.PORT || 8099);
let tree = {};
let counter = 0;
const streams = new Set(); // { res, parts }

const split = (p) => p.split('/').filter(Boolean);
const get = (parts) => { let o = tree; for (const k of parts) { if (o == null || typeof o !== 'object') return null; o = o[k]; } return o === undefined ? null : o; };
function set(parts, val) {
  if (!parts.length) { tree = val && typeof val === 'object' ? val : {}; return; }
  let o = tree;
  for (let i = 0; i < parts.length - 1; i++) { if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {}; o = o[parts[i]]; }
  const k = parts[parts.length - 1];
  if (val === null) delete o[k]; else o[k] = val;
}
const send = (s, ev, data) => s.res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
function notify(parts) {
  for (const s of streams) {
    const n = Math.min(parts.length, s.parts.length);
    const related = parts.slice(0, n).every((k, i) => k === s.parts[i]);
    if (!related) continue;
    if (parts.length >= s.parts.length) send(s, 'put', { path: '/' + parts.slice(s.parts.length).join('/'), data: get(parts) });
    else send(s, 'put', { path: '/', data: get(s.parts) });
  }
}
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PUT,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': '*' };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (url.pathname.endsWith('.json') && url.pathname !== '/data.json') {
    const parts = split(url.pathname.replace(/\.json$/, ''));
    if (req.method === 'GET') {
      if ((req.headers.accept || '').includes('text/event-stream')) {
        res.writeHead(200, { ...cors, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
        const s = { res, parts }; streams.add(s); req.on('close', () => streams.delete(s));
        send(s, 'put', { path: '/', data: get(parts) });
      } else { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(get(parts))); }
      return;
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let val = null; try { val = body ? JSON.parse(body) : null; } catch { /* ignore */ }
      let reply = val;
      if (req.method === 'PUT') set(parts, val);
      else if (req.method === 'DELETE') { set(parts, null); reply = null; }
      else if (req.method === 'POST') { const key = '-N' + String(++counter).padStart(8, '0'); parts.push(key); set(parts, val); reply = { name: key }; }
      else if (req.method === 'PATCH') { for (const k in val) set([...parts, k], val[k]); }
      notify(parts);
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(reply));
    });
    return;
  }
  let f = path.join(root, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  if (path.basename(f) === 'config.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    res.end(`window.QM_STANDALONE=true;window.QM_FB_URL=location.origin;`); return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT, () => console.log(`dev server on http://localhost:${PORT}`));

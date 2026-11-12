// Assembles www/index.html (single file, data inlined) and copies the PWA files. No dependencies: node scripts/build.mjs
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });

const bank = read('data/bank.json').trim();
const geo = read('data/geo.json').trim();
const js = fs.readdirSync(path.join(root, 'src/js')).filter((f) => f.endsWith('.js')).sort()
  .map((f) => read('src/js/' + f)).join('\n')
  .replace('__BANK__', () => bank).replace('__GEO__', () => geo);

let app = read('src/app.html').replace(/<meta name="claude:viewport-fit-sides"[^>]*>\s*/, '');
const cut = app.indexOf('</style>') + '</style>'.length;
const head = app.slice(0, cut), body = app.slice(cut);

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a1a27">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/icon-192.png">
${head}
<style>html{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style>
</head>
<body>
${body}
<script src="config.js"></script>
<script>
${js}
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.Capacitor) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(out, 'index.html'), html);
for (const f of ['src/config.js', 'src/manifest.webmanifest', 'src/sw.js', 'src/privacy.html']) fs.copyFileSync(path.join(root, f), path.join(out, path.basename(f)));
for (const f of fs.readdirSync(path.join(root, 'src/icons'))) fs.copyFileSync(path.join(root, 'src/icons', f), path.join(out, 'icons', f));
console.log('built www/index.html', (html.length / 1024).toFixed(0) + ' KB');

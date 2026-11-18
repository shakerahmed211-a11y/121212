'use strict';
const $ = (s) => document.querySelector(s);
const GL = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' }, VS = '︎';
const COL = ['#37d08a', '#4aa3ff', '#f0a43a'];
let B = new Int8Array(64), side = 1, view = 1, tool = 'move', selSq = -1, low = new Set(), lines = [], TPL = null;
const FILES = 'abcdefgh';

/* ---------- board model / rendering ---------- */
const sqIdx = (r, f) => r * 8 + f;
function fenPlacement() {
  let s = '';
  for (let r = 7; r >= 0; r--) { let e = 0; for (let f = 0; f < 8; f++) { const p = B[sqIdx(r, f)]; if (!p) { e++; continue; } if (e) { s += e; e = 0; } const l = ' pnbrqk'[Math.abs(p)]; s += p > 0 ? l.toUpperCase() : l; } if (e) s += e; if (r) s += '/'; }
  return s;
}
function castStr() { return ($('#cK').checked ? 'K' : '') + ($('#cQ').checked ? 'Q' : '') + ($('#ck').checked ? 'k' : '') + ($('#cq').checked ? 'q' : '') || '-'; }
const getFEN = () => `${fenPlacement()} ${side > 0 ? 'w' : 'b'} ${castStr()} - 0 1`;
function possibleCastle() { return { K: B[4] === 6 && B[7] === 4, Q: B[4] === 6 && B[0] === 4, k: B[60] === -6 && B[63] === -4, q: B[60] === -6 && B[56] === -4 }; }
function fixCastle(enable) { const p = possibleCastle(); for (const k of ['K', 'Q', 'k', 'q']) { const el = $('#c' + k); if (enable) el.checked = p[k]; else if (!p[k]) el.checked = false; } }
function setPlacement(str) { B.fill(0); let r = 7, f = 0; for (const ch of str.split(' ')[0]) { if (ch === '/') { r--; f = 0; } else if (/[1-8]/.test(ch)) f += +ch; else { const t = ' pnbrqk'.indexOf(ch.toLowerCase()); if (t > 0 && r >= 0 && f < 8) B[sqIdx(r, f)] = ch === ch.toLowerCase() ? -t : t; f++; } } }
function sync(fromEdit) { if (fromEdit) fixCastle(false); $('#fen').value = getFEN(); }
function render() {
  const bd = $('#board'); bd.textContent = '';
  for (let i = 0; i < 64; i++) {
    const r = view > 0 ? 7 - (i >> 3) : (i >> 3), f = view > 0 ? (i & 7) : 7 - (i & 7), s = sqIdx(r, f), d = document.createElement('div');
    d.className = 'sq ' + ((r + f) % 2 === 0 ? 'd' : 'l') + (s === selSq ? ' sel' : '') + (low.has(s) ? ' low' : ''); d.dataset.s = s; d.setAttribute('role', 'gridcell');
    const p = B[s]; if (p) { const sp = document.createElement('span'); sp.className = p > 0 ? 'pw' : 'pb'; sp.textContent = GL[Math.abs(p)] + VS; d.append(sp); d.setAttribute('aria-label', (p > 0 ? 'أبيض ' : 'أسود ') + FILES[f] + (r + 1)); } else d.setAttribute('aria-label', FILES[f] + (r + 1));
    if ((i >> 3) === 7) { const c = document.createElement('span'); c.className = 'co'; c.textContent = FILES[f]; d.append(c); }
    bd.append(d);
  }
  drawArrows();
}
function center(s) { const r = s >> 3, f = s & 7; return view > 0 ? [f + 0.5, 7 - r + 0.5] : [7 - f + 0.5, r + 0.5]; }
function arrowSVG(a, b, col, w) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, hl = 0.34, x2 = b[0] - ux * 0.12, y2 = b[1] - uy * 0.12;
  const bx = x2 - ux * hl, by = y2 - uy * hl, px = -uy * 0.17, py = ux * 0.17;
  return `<line x1="${a[0] + ux * 0.2}" y1="${a[1] + uy * 0.2}" x2="${bx}" y2="${by}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" opacity=".88"/><polygon points="${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}" fill="${col}" opacity=".9"/>`;
}
function drawArrows() {
  let h = ''; lines.slice().reverse().forEach((l, i) => { const k = lines.length - 1 - i; if (!l.uci) return; const f = CE.parseSq(l.uci.slice(0, 2)), t = CE.parseSq(l.uci.slice(2, 4)); h += arrowSVG(center((f >> 4) * 8 + (f & 7)), center((t >> 4) * 8 + (t & 7)), COL[k] || COL[2], k === 0 ? 0.2 : 0.13); });
  $('#arrows').innerHTML = h;
}
$('#board').addEventListener('click', (e) => {
  const d = e.target.closest('.sq'); if (!d) return; const s = +d.dataset.s;
  if (tool !== 'move') { B[s] = tool; lines = []; low.delete(s); sync(true); render(); return; }
  if (selSq < 0) { if (B[s]) selSq = s; } else if (selSq === s) selSq = -1; else { B[s] = B[selSq]; B[selSq] = 0; selSq = -1; lines = []; low.clear(); sync(true); }
  render();
});
(function pal() {
  const p = $('#pal'); const items = [[6, 5, 4, 3, 2, 1].map((t) => t), [-6, -5, -4, -3, -2, -1]];
  const mk = (val, label, cls) => { const b = document.createElement('button'); b.dataset.v = val; b.setAttribute('aria-pressed', val === 'move'); b.setAttribute('aria-label', label); if (cls) b.innerHTML = `<span class="${cls}">${GL[Math.abs(val)]}${VS}</span>`; else b.textContent = label; b.onclick = () => { tool = val === 'move' ? 'move' : +val; selSq = -1; p.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); render(); }; return b; };
  const nm = { 6: 'ملك', 5: 'وزير', 4: 'رخ', 3: 'فيل', 2: 'حصان', 1: 'بيدق' };
  for (const row of items) { for (const v of row) p.append(mk(v, (v > 0 ? 'أبيض ' : 'أسود ') + nm[Math.abs(v)], v > 0 ? 'pw' : 'pb')); p.append(row === items[0] ? mk(0, '🗑') : mk('move', '✋')); }
})();
$('#sideW').onclick = () => setSide(1); $('#sideB').onclick = () => setSide(-1);
function setSide(s) { side = s; $('#sideW').setAttribute('aria-pressed', s > 0); $('#sideB').setAttribute('aria-pressed', s < 0); lines = []; sync(); render(); }
$('#flip').onclick = () => { view = -view; render(); };
$('#clear').onclick = () => { B.fill(0); lines = []; low.clear(); fixCastle(true); sync(); render(); };
$('#btnStart').onclick = () => { loadFEN(CE.START); msg('#srcMsg', ''); };
for (const k of ['K', 'Q', 'k', 'q']) $('#c' + k).onchange = () => sync();
function loadFEN(fen) {
  const p = new CE.Pos().setFEN(fen); B.fill(0);
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) B[sqIdx(r, f)] = p.b[r * 16 + f];
  $('#cK').checked = !!(p.cast & 1); $('#cQ').checked = !!(p.cast & 2); $('#ck').checked = !!(p.cast & 4); $('#cq').checked = !!(p.cast & 8);
  lines = []; low.clear(); selSq = -1; setSide(p.side); render();
}
$('#fenGo').onclick = () => { try { loadFEN($('#fen').value); } catch (e) { msg('#res', e.message, true); } };
$('#fenCopy').onclick = async () => { try { await navigator.clipboard.writeText(getFEN()); msg('#res', 'تم نسخ FEN.'); } catch (e) { $('#fen').select(); } };
function msg(sel, t, err) { const el = $(sel); el.textContent = t; el.classList.toggle('err', !!err); }

/* ---------- analysis ---------- */
const fmtScore = (l) => l.mate != null ? (l.mate > 0 ? '#' : '-#') + Math.abs(l.mate) : (l.cp >= 0 ? '+' : '') + (l.cp / 100).toFixed(2);
function pvSAN(fen, uci, n) { const p = new CE.Pos().setFEN(fen), out = []; for (const u of uci.slice(0, n || 6)) { const m = p.fromUCI(u); if (!m) break; out.push(p.san(m)); p.make(m); } return out; }
function whitePersp(pos, kind, v) { const sg = pos.side > 0 ? 1 : -1; return kind === 'mate' ? { mate: sg * v } : { cp: sg * v }; }
let sfP = null, sfFail = false;
function loadSF() {
  if (sfFail) return Promise.reject(new Error('sf'));
  if (sfP) return sfP;
  sfP = (async () => {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
    const res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js', { signal: ctl.signal }); clearTimeout(to);
    if (!res.ok) throw new Error('sf'); const txt = await res.text();
    const w = new Worker(URL.createObjectURL(new Blob([txt], { type: 'text/javascript' })));
    await new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), 9000); w.onmessage = (e) => { if (String(e.data).includes('uciok')) { clearTimeout(t); ok(); } }; w.onerror = no; w.postMessage('uci'); });
    w.postMessage('setoption name MultiPV value 3'); return w;
  })();
  sfP.catch(() => { sfFail = true; });
  return sfP;
}
function sfRun(w, fen, ms) {
  return new Promise((res) => {
    const got = {}; const done = () => { w.onmessage = null; clearTimeout(t); res(got); }; const t = setTimeout(done, ms + 5000);
    w.onmessage = (e) => { const l = String(e.data); if (l.startsWith('info') && l.includes(' pv ')) { const m = /depth (\d+).* multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/.exec(l); if (m) got[m[2]] = { depth: +m[1], kind: m[3], v: +m[4], pv: m[5].trim().split(' ') }; } else if (l.startsWith('bestmove')) done(); };
    w.postMessage('position fen ' + fen); w.postMessage('go movetime ' + ms);
  });
}
function builtin(pos, ms) {
  const out = [], ex = [];
  for (let k = 0; k < 3; k++) {
    const r = CE.search(pos, k ? Math.round(ms / 4) : ms, 9, ex); if (!r.move) break; ex.push(r.move);
    const sc = pos.side > 0 ? r.score : -r.score, mate = Math.abs(r.score) > CE.MATE - 100 ? Math.ceil((CE.MATE - Math.abs(r.score)) / 2) * (sc > 0 ? 1 : -1) : null;
    out.push({ uci: pos.uci(r.move), san: pos.san(r.move), cp: sc, mate, depth: r.depth, engine: 'builtin' });
  }
  return out;
}
async function analyze(fen, o) {
  o = o || {}; const pos = new CE.Pos().setFEN(fen);
  pos.side = -pos.side; const bad = pos.inCheck(); pos.side = -pos.side;
  if (bad) throw new Error('الدور مش مظبوط: ملك الطرف التاني في كش. غيّر «الدور على».');
  if (!pos.legal().length) return { over: pos.inCheck() ? 'كش مات: مفيش نقلات.' : 'تعادل (ستالميت): مفيش نقلات.', lines: [] };
  if (o.sf) {
    try {
      const w = await loadSF(), got = await sfRun(w, fen, o.ms || 2000);
      const ls = Object.keys(got).sort().map((k) => { const g = got[k], m = pos.fromUCI(g.pv[0]); return m ? Object.assign({ uci: g.pv[0], san: pos.san(m), depth: g.depth, pv: pvSAN(fen, g.pv, 6), engine: 'Stockfish' }, whitePersp(pos, g.kind, g.v)) : null; }).filter(Boolean);
      if (ls.length) return { lines: ls, engine: 'Stockfish' };
    } catch (e) { /* offline or blocked: fall back to the built-in engine */ }
  }
  await new Promise((r) => setTimeout(r, 30));
  return { lines: builtin(pos, o.bms || 1200), engine: 'builtin' };
}
$('#go').onclick = async () => {
  const b = $('#go'); b.disabled = true; msg('#res', 'بيحلل…'); lines = []; drawArrows();
  try {
    const r = await analyze(getFEN(), { sf: $('#useSF').checked, ms: 2200 });
    if (r.over) { msg('#res', r.over); return; }
    lines = r.lines; drawArrows(); const el = $('#res'); el.classList.remove('err', 'mut'); el.textContent = '';
    r.lines.forEach((l, i) => { const d = document.createElement('div'); d.className = 'mv'; d.innerHTML = `<span class="dot" style="background:${COL[i] || COL[2]}"></span><span class="san">${l.san}</span><span dir="ltr">${fmtScore(l)}</span><span class="mut" dir="ltr">${(l.pv || []).slice(1).join(' ')}</span>`; el.append(d); });
    const n = document.createElement('div'); n.className = 'mut'; n.style.marginTop = '6px'; n.textContent = r.engine === 'Stockfish' ? 'المحرك: Stockfish (التقييم من ناحية الأبيض).' : 'المحرك: مدمج في الصفحة (تقديري، مش بقوة Stockfish). التقييم من ناحية الأبيض.'; el.append(n);
  } catch (e) { msg('#res', e.message, true); } finally { b.disabled = false; }
};

/* ---------- image / camera / video ---------- */
let src = null; // {cv, ctx, box}
const prevCv = $('#prevCv');
function frameOf(source, w, h, maxDim) { const f = Math.min(1, maxDim / Math.max(w, h)), cv = document.createElement('canvas'); cv.width = Math.round(w * f); cv.height = Math.round(h * f); const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(source, 0, 0, cv.width, cv.height); return { cv, ctx, img: ctx.getImageData(0, 0, cv.width, cv.height) }; }
function drawPrev() {
  if (!src) return; prevCv.width = src.cv.width; prevCv.height = src.cv.height; const c = prevCv.getContext('2d'); c.drawImage(src.cv, 0, 0);
  const b = src.box; if (b) { c.strokeStyle = '#37d08a'; c.lineWidth = Math.max(3, prevCv.width / 200); c.strokeRect(b.x, b.y, b.s, b.s); c.globalAlpha = 0.5; c.lineWidth = 1; for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(b.x + i * b.s / 8, b.y); c.lineTo(b.x + i * b.s / 8, b.y + b.s); c.moveTo(b.x, b.y + i * b.s / 8); c.lineTo(b.x + b.s, b.y + i * b.s / 8); c.stroke(); } c.globalAlpha = 1; }
}
function cellsToBoard(cells, flipped) {
  const nb = new Int8Array(64), lw = new Set();
  for (let rank = 0; rank < 8; rank++) for (let file = 0; file < 8; file++) { const row = flipped ? rank : 7 - rank, col = flipped ? 7 - file : file, c = cells[row * 8 + col]; if (c.t) nb[sqIdx(rank, file)] = c.t * c.c; if (c.occ && (c.conf < 0.05 || c.sim < 0.4)) lw.add(sqIdx(rank, file)); }
  return { nb, lw };
}
function readInto(box, img) {
  const cells = CV.readBoard(img, box, TPL), fl = CV.guessFlipped(cells), r = cellsToBoard(cells, fl);
  B = r.nb; low = r.lw; view = fl ? -1 : 1; lines = []; selSq = -1; fixCastle(true); setSide(side); render();
  return { n: cells.filter((c) => c.occ).length, fl };
}
function tick() { return new Promise((r) => setTimeout(r, 20)); }
async function useFrame(fr, label) {
  src = { cv: fr.cv, ctx: fr.ctx, img: fr.img, box: null }; $('#prevBox').classList.remove('hide'); msg('#srcMsg', 'بدوّر على الرقعة…'); drawPrev(); await tick();
  const box = CV.findBoard(fr.img);
  if (box) { src.box = box; drawPrev(); const r = readInto(box, fr.img); msg('#srcMsg', `لقيت الرقعة وقريت ${r.n} قطعة${r.fl ? ' (الأسود تحت)' : ''}. راجع القطع (اللي حواليها خط برتقالي مش متأكد منها) وبعدين حلّل.`); }
  else { const s = Math.min(fr.cv.width, fr.cv.height) * 0.8; src.box = { x: (fr.cv.width - s) / 2, y: (fr.cv.height - s) / 2, s }; drawPrev(); msg('#srcMsg', 'ملقيتش الرقعة تلقائي. اسحب الإطار الأخضر على الرقعة واضغط «اقرأ القطع»، أو رتّب القطع بإيدك.', true); }
  $('#board').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
async function loadImageFile(file) {
  if (!file) return; $('#vidCard').classList.add('hide'); stopLive();
  try { const bm = await createImageBitmap(file, { imageOrientation: 'from-image' }); await useFrame(frameOf(bm, bm.width, bm.height, 1400)); }
  catch (e) { msg('#srcMsg', 'معرفتش أفتح الصورة دي.', true); }
}
$('#inCam').onchange = (e) => loadImageFile(e.target.files[0]); $('#inImg').onchange = (e) => loadImageFile(e.target.files[0]);
$('#bAuto').onclick = async () => { if (!src) return; msg('#srcMsg', 'بدوّر…'); await tick(); const b = CV.findBoard(src.img); if (b) { src.box = b; drawPrev(); msg('#srcMsg', 'لقيت الرقعة. اضغط «اقرأ القطع».'); } else msg('#srcMsg', 'ملقيتهاش. اسحب الإطار يدويًا.', true); };
$('#bRead').onclick = () => { if (!src || !src.box) return; const r = readInto(src.box, src.img); msg('#srcMsg', `قريت ${r.n} قطعة. راجعها وبعدين حلّل.`); };
$('#bPlus').onclick = () => resizeBox(1.03); $('#bMinus').onclick = () => resizeBox(1 / 1.03);
function resizeBox(k) { if (!src || !src.box) return; const b = src.box, cx = b.x + b.s / 2, cy = b.y + b.s / 2; b.s = Math.min(Math.min(src.cv.width, src.cv.height), b.s * k); b.x = cx - b.s / 2; b.y = cy - b.s / 2; drawPrev(); }
let drag = null;
prevCv.addEventListener('pointerdown', (e) => { if (!src || !src.box) return; const r = prevCv.getBoundingClientRect(), k = prevCv.width / r.width; drag = { x: e.clientX, y: e.clientY, bx: src.box.x, by: src.box.y, k }; prevCv.setPointerCapture(e.pointerId); });
prevCv.addEventListener('pointermove', (e) => { if (!drag) return; src.box.x = drag.bx + (e.clientX - drag.x) * drag.k; src.box.y = drag.by + (e.clientY - drag.y) * drag.k; drawPrev(); });
prevCv.addEventListener('pointerup', () => { drag = null; });

/* ----- video & live camera ----- */
const vid = $('#vid'), vov = $('#vov'); let live = null, scanning = false, entries = [], vFrameW = 1;
function stopLive() { if (live) { live.on = false; if (live.stream) live.stream.getTracks().forEach((t) => t.stop()); live = null; } vid.srcObject = null; $('#vStop').classList.add('hide'); }
$('#inVid').onchange = (e) => {
  const f = e.target.files[0]; if (!f) return; stopLive(); entries = []; $('#tl').textContent = ''; vid.removeAttribute('src'); vid.src = URL.createObjectURL(f); vid.controls = true; $('#vidCard').classList.remove('hide'); $('#vScan').classList.remove('hide'); msg('#vMsg', 'شغّل الفيديو أو حرّك الشريط. «حلّل الفيديو كله» بيمشي على لقطات ويحط الأسهم فوق الفيديو.'); clearOv();
};
$('#btnLive').onclick = async () => {
  try {
    stopLive(); entries = []; $('#tl').textContent = ''; vid.removeAttribute('src'); const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    vid.srcObject = stream; vid.controls = false; await vid.play(); $('#vidCard').classList.remove('hide'); $('#vScan').classList.add('hide'); $('#vStop').classList.remove('hide');
    live = { on: true, stream, box: null, last: '', miss: 0, entry: null, prevFen: null }; msg('#vMsg', 'وجّه الكاميرا على الرقعة من فوق قدر الإمكان. هيحلل لما القطع تتغير.'); liveTick();
  } catch (e) { msg('#srcMsg', 'مقدرتش أفتح الكاميرا (لازم تسمح بالإذن، والصفحة لازم تكون https).', true); }
};
$('#vStop').onclick = () => { scanning = false; stopLive(); msg('#vMsg', 'اتوقف.'); };
function validBoard(cells) { let wk = 0, bk = 0, n = 0; cells.forEach((c) => { if (c.occ) { n++; if (c.t === 6) { if (c.c > 0) wk++; else bk++; } } }); return n >= 3 && n <= 32 && wk === 1 && bk === 1; }
function inferSide(prev, cur) { // who just moved = colour of the piece that appeared on a changed square
  if (!prev) return 1; let mover = 0; for (let i = 0; i < 64; i++) if (cur[i] && cur[i] !== prev[i]) mover = cur[i] > 0 ? 1 : -1; return mover ? -mover : 1;
}
function posToB(p) { const o = new Int8Array(64); for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) o[sqIdx(r, f)] = p.b[r * 16 + f]; return o; }
const mism = (a, b) => { let n = 0; for (let i = 0; i < 64; i++) if (a[i] !== b[i]) n++; return n; };
/* snap the (noisy) reading to a legal continuation of the previous position: pick the legal move(s) whose result matches the picture best */
function track(prevFen, obs) {
  if (!prevFen) { const p = new CE.Pos().setFEN(CE.START); return mism(posToB(p), obs) <= 8 ? p.toFEN() : null; }
  const p0 = new CE.Pos().setFEN(prevFen); let best = { n: mism(posToB(p0), obs), fen: prevFen }; // "nothing changed"
  if (best.n <= 1) return best.fen;
  const l1 = p0.legal();
  for (const m1 of l1) {
    p0.make(m1); const n1 = mism(posToB(p0), obs); if (n1 < best.n) best = { n: n1, fen: p0.toFEN() };
    p0.unmake();
  }
  if (best.n <= 4) return best.fen;
  for (const m1 of l1) { // the sampling may have skipped a move: try two plies
    p0.make(m1); for (const m2 of p0.legal()) { p0.make(m2); const n2 = mism(posToB(p0), obs); if (n2 < best.n) best = { n: n2, fen: p0.toFEN() }; p0.unmake(); } p0.unmake();
  }
  return best.n <= 5 ? best.fen : null;
}
async function entryFor(frame, box, fl, prevFen, o) {
  const cells = CV.readBoard(frame.img, box, TPL), { nb } = cellsToBoard(cells, fl);
  let fen = track(prevFen, nb);
  if (!fen && !prevFen && validBoard(cells)) fen = `${fenOf(nb)} w ${castOf(nb)} - 0 1`;
  if (!fen) return null;
  let r; try { r = await analyze(fen, { sf: false, bms: o.ms || 500 }); } catch (e) { return null; }
  if (!r.lines || !r.lines.length) return null;
  return { fen, pl: fen.split(' ')[0], box, fl, fw: frame.cv.width, line: r.lines[0], t: 0 };
}
function fenOf(b) { let s = ''; for (let r = 7; r >= 0; r--) { let e = 0; for (let f = 0; f < 8; f++) { const p = b[sqIdx(r, f)]; if (!p) { e++; continue; } if (e) { s += e; e = 0; } const l = ' pnbrqk'[Math.abs(p)]; s += p > 0 ? l.toUpperCase() : l; } if (e) s += e; if (r) s += '/'; } return s; }
function castOf(b) { return (b[4] === 6 && b[7] === 4 ? 'K' : '') + (b[4] === 6 && b[0] === 4 ? 'Q' : '') + (b[60] === -6 && b[63] === -4 ? 'k' : '') + (b[60] === -6 && b[56] === -4 ? 'q' : '') || '-'; }
function clearOv() { vov.width = vov.width; }
function drawOv(en) {
  const w = vid.clientWidth, h = vid.clientHeight; if (!w) return; const dpr = window.devicePixelRatio || 1; vov.width = w * dpr; vov.height = h * dpr; const c = vov.getContext('2d'); c.scale(dpr, dpr);
  if (!en) return; const k = w / en.fw, cs = en.box.s / 8 * k, u = en.line.uci;
  const pt = (sq) => { const r = sq >> 4, f = sq & 7, row = en.fl ? r : 7 - r, col = en.fl ? 7 - f : f; return [en.box.x * k + (col + 0.5) * cs, en.box.y * k + (row + 0.5) * cs]; };
  const a = pt(CE.parseSq(u.slice(0, 2))), b = pt(CE.parseSq(u.slice(2, 4))), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, hl = cs * 0.45;
  c.strokeStyle = '#37d08a'; c.fillStyle = '#37d08a'; c.globalAlpha = 0.9; c.lineWidth = cs * 0.2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(a[0] + ux * cs * 0.2, a[1] + uy * cs * 0.2); c.lineTo(b[0] - ux * hl, b[1] - uy * hl); c.stroke();
  c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(b[0] - ux * hl + -uy * cs * 0.25, b[1] - uy * hl + ux * cs * 0.25); c.lineTo(b[0] - ux * hl - -uy * cs * 0.25, b[1] - uy * hl - ux * cs * 0.25); c.fill();
  c.globalAlpha = 1; c.font = `700 ${Math.max(14, cs * 0.5)}px system-ui`; c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 4; const tx = en.box.x * k + 6, ty = Math.max(20, en.box.y * k - 8); c.strokeText(en.line.san, tx, ty); c.fillText(en.line.san, tx, ty);
}
function ovForTime() { if (live) { drawOv(live.entry); return; } if (!entries.length) return clearOv(); const t = vid.currentTime + 0.25; let en = null; for (const e of entries) if (e.t <= t) en = e; drawOv(en); }
['timeupdate', 'seeked', 'pause', 'play', 'loadedmetadata', 'resize'].forEach((ev) => vid.addEventListener(ev, ovForTime)); addEventListener('resize', ovForTime);
async function liveTick() {
  if (!live || !live.on) return;
  try {
    if (vid.videoWidth) {
      const fr = frameOf(vid, vid.videoWidth, vid.videoHeight, 800);
      if (!live.box || live.miss > 3) { live.box = CV.findBoard(fr.img); live.miss = 0; live.fl = undefined; }
      if (live.box) {
        if (live.fl === undefined) live.fl = CV.guessFlipped(CV.readBoard(fr.img, live.box, TPL));
        const en = await entryFor(fr, live.box, live.fl, live.prevFen, { ms: 400 });
        if (!en) live.miss++;
        else if (en.pl !== live.last) { live.entry = en; live.last = en.pl; live.prevFen = en.fen; msg('#vMsg', `أفضل نقلة: ${en.line.san}`); ovForTime(); }
      } else msg('#vMsg', 'مش شايف الرقعة… قرّب أو ثبّت الكاميرا فوقها.');
    }
  } catch (e) { /* keep looping */ }
  if (live && live.on) setTimeout(liveTick, 700);
}
$('#vGrab').onclick = async () => {
  if (!vid.videoWidth) { msg('#vMsg', 'مفيش فيديو شغّال.', true); return; }
  vid.pause(); await useFrame(frameOf(vid, vid.videoWidth, vid.videoHeight, 1400));
};
const seek = (t) => new Promise((res) => { const h = () => { vid.removeEventListener('seeked', h); res(); }; vid.addEventListener('seeked', h); vid.currentTime = t; setTimeout(res, 2500); });
$('#vScan').onclick = async () => {
  try { await scanVideo(); } catch (e) { scanning = false; $('#vScan').disabled = false; msg('#vMsg', 'حصلت مشكلة أثناء التحليل: ' + e.message, true); }
};
async function scanVideo() {
  if (scanning || !vid.duration || !isFinite(vid.duration)) return; scanning = true; entries = []; $('#tl').textContent = ''; vid.pause(); $('#vStop').classList.remove('hide'); $('#vScan').disabled = true;
  const D = vid.duration, step = Math.max(1, D / 90); let box = null, fl, prevFen = null, lastPl = '', miss = 0;
  for (let t = 0; t < D && scanning; t += step) {
    msg('#vMsg', `بحلل… ${Math.round(t / D * 100)}%  (لقيت ${entries.length} وضع)`); await seek(t); await tick();
    const fr = frameOf(vid, vid.videoWidth, vid.videoHeight, 960);
    if (!box || miss > 2) { box = CV.findBoard(fr.img); miss = 0; if (!box) continue; }
    if (fl === undefined) fl = CV.guessFlipped(CV.readBoard(fr.img, box, TPL));
    const en = await entryFor(fr, box, fl, prevFen, { ms: 450 }); if (!en) { miss++; continue; } miss = 0; if (en.pl === lastPl) continue;
    en.t = t; entries.push(en); lastPl = en.pl; prevFen = en.fen;
    const b = document.createElement('button'); b.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}  —  ${en.line.san}  ${fmtScore(en.line)}`; b.onclick = async () => { vid.pause(); await seek(en.t); try { loadFEN(en.fen); } catch (e) { /* ignore */ } };
    $('#tl').append(b); ovForTime();
  }
  scanning = false; $('#vScan').disabled = false; $('#vStop').classList.add('hide'); msg('#vMsg', entries.length ? `خلصت: ${entries.length} وضع. شغّل الفيديو وهتشوف سهم أفضل نقلة فوقه. اضغط على أي سطر عشان تفتحه في المحرر.` : 'ملقيتش رقعة واضحة في الفيديو. جرّب فيديو من فوق الرقعة بإضاءة كويسة.', !entries.length);
}

/* ---------- init ---------- */
(async function init() {
  loadFEN(CE.START);
  try { await document.fonts.ready; } catch (e) { /* ignore */ }
  TPL = CV.makeTemplates(document);
  if (!TPL.length) msg('#srcMsg', 'جهازك مفيهوش خط بقطع الشطرنج، فقراءة الصور مش هتشتغل. تقدر ترتب الرقعة بإيدك.', true);
  window.__ready = true;
})();

/* ---------- tabs ---------- */
function showTab(t) { const play = t === 'play'; $('#viewAn').classList.toggle('hide', play); $('#viewPlay').classList.toggle('hide', !play); $('#tabAn').setAttribute('aria-pressed', !play); $('#tabPlay').setAttribute('aria-pressed', play); if (play) renderG(); }
$('#tabAn').onclick = () => showTab('an'); $('#tabPlay').onclick = () => showTab('play');

/* ---------- play against the computer ---------- */
const LEVELS = [null,
  { n: 'مبتدئ', d: 1, noise: 300, rnd: 0.2, note: 'بيغلط كتير ومبيشوفش أكتر من نقلة.' },
  { n: 'سهل', d: 2, noise: 150, note: 'بيشوف نقلتين وبيغلط أحيانًا.' },
  { n: 'متوسط', d: 3, noise: 70, note: 'بيحسب 3 نقلات ولسه بيغلط أحيانًا.' },
  { n: 'كويس', d: 4, noise: 25, note: 'لاعب منظم، بيصعب عليك الغلط.' },
  { n: 'قوي', ms: 1200, d: 7, note: 'بيفكر حوالي ثانية في كل نقلة.' },
  { n: 'خبير', ms: 3000, d: 12, note: 'أقوى مستوى في المحرك المدمج (بيفكر 3 ثواني).' },
  { n: 'ماستر', sf: 1, ms: 1500, note: 'Stockfish لو في نت، وإلا بيلعب بمستوى «خبير».' }];
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
let gLevel = Math.min(7, Math.max(1, +store.get('qc_lvl', 3) || 3)), gColorPref = store.get('qc_col', 'w'), G = null, gView = 1, gSel = -1, gHint = null;
(function lvInit() {
  const box = $('#lvBtns');
  for (let i = 1; i < LEVELS.length; i++) { const b = document.createElement('button'); b.textContent = `${i}. ${LEVELS[i].n}`; b.setAttribute('aria-pressed', i === gLevel); b.onclick = () => { gLevel = i; store.set('qc_lvl', i); box.querySelectorAll('button').forEach((x, k) => x.setAttribute('aria-pressed', k + 1 === i)); $('#lvNote').textContent = LEVELS[i].note; }; box.append(b); }
  $('#lvNote').textContent = LEVELS[gLevel].note;
  const cols = { w: '#colW', b: '#colB', r: '#colR' };
  const setc = (c) => { gColorPref = c; store.set('qc_col', c); for (const k in cols) $(cols[k]).setAttribute('aria-pressed', k === c); };
  for (const k in cols) $(cols[k]).onclick = () => setc(k); setc(gColorPref);
})();
const gKey = (p) => p.toFEN().split(' ').slice(0, 4).join(' ');
function gStatusSet(t, err) { const el = $('#gStatus'); el.textContent = t; el.classList.toggle('err', !!err); }
function newGame(fen) {
  let pos; try { pos = new CE.Pos().setFEN(fen || CE.START); } catch (e) { gStatusSet(e.message, true); return; }
  const hp = gColorPref === 'r' ? (Math.random() < 0.5 ? 1 : -1) : gColorPref === 'b' ? -1 : 1;
  G = { pos, human: hp, hist: [], keys: [gKey(pos)], over: null, thinking: false, last: null, start: pos.toFEN(), id: Date.now() };
  gView = hp; gSel = -1; gHint = null; $('#promo').classList.add('hide'); renderG(); afterMove();
}
function endCheck() {
  const p = G.pos, legal = p.legal();
  if (!legal.length) return p.inCheck() ? { res: p.side > 0 ? '0-1' : '1-0', why: 'كش مات' } : { res: '1/2-1/2', why: 'ستالميت (تعادل)' };
  if (p.hm >= 100) return { res: '1/2-1/2', why: 'تعادل بقاعدة الخمسين نقلة' };
  if (G.keys.filter((k) => k === G.keys[G.keys.length - 1]).length >= 3) return { res: '1/2-1/2', why: 'تعادل بتكرار الوضع 3 مرات' };
  const others = []; for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const v = Math.abs(p.b[s]); if (v && v !== 6) others.push(v); }
  if (!others.length || (others.length === 1 && (others[0] === 2 || others[0] === 3))) return { res: '1/2-1/2', why: 'تعادل: مفيش مواد كفاية للكش مات' };
  return null;
}
function afterMove() {
  const o = endCheck(); if (o) { G.over = o; const w = o.res === '1-0' ? 1 : o.res === '0-1' ? -1 : 0; gStatusSet(w === 0 ? `انتهت: ${o.why}.` : (w === G.human ? `مبروك! كسبت — ${o.why}.` : `الكمبيوتر كسب — ${o.why}.`)); renderG(); return; }
  if (G.pos.side === G.human) { gStatusSet(G.pos.inCheck() ? 'دورك — إنت في كش!' : 'دورك.'); renderG(); } else { renderG(); computerMove(); }
}
function applyMove(m) {
  const p = G.pos, san = p.san(m), uci = p.uci(m); p.make(m); G.hist.push({ san, uci }); G.keys.push(gKey(p)); G.last = [m & 127, (m >> 7) & 127]; gSel = -1; gHint = null;
}
async function pickMove(pos, L) {
  const legal = pos.legal();
  if (L.sf) { try { const w = await loadSF(), got = await sfRun(w, pos.toFEN(), L.ms); if (got['1']) { const m = pos.fromUCI(got['1'].pv[0]); if (m) return m; } } catch (e) { /* offline: fall through to the built-in engine */ } return CE.search(pos, 2500, 12).move; }
  if (L.rnd && Math.random() < L.rnd) return legal[Math.floor(Math.random() * legal.length)];
  if (L.noise) { const r = CE.search(pos, 500, L.d, null, true); let b = null, bv = -1e9; for (const x of r.all || []) { const v = x.v + (Math.random() * 2 - 1) * L.noise; if (v > bv) { bv = v; b = x.m; } } return b || r.move; }
  return CE.search(pos, L.ms, L.d).move;
}
async function computerMove() {
  if (!G || G.over || G.thinking) return; const id = G.id; G.thinking = true; gStatusSet('الكمبيوتر بيفكر…');
  await new Promise((r) => setTimeout(r, 80));
  let m = 0; try { m = await pickMove(G.pos, LEVELS[gLevelAtStart(G)]); } catch (e) { m = G.pos.legal()[0]; }
  if (!G || G.id !== id || !G.thinking) return; G.thinking = false; if (m) applyMove(m); afterMove();
}
const gLevelAtStart = () => gLevel;
function renderG() {
  const bd = $('#gboard'); if (!bd) return; bd.textContent = ''; if (!G) { bd.textContent = ''; }
  const pos = G ? G.pos : new CE.Pos().setFEN(CE.START), legal = G && gSel >= 0 ? pos.legal().filter((m) => (m & 127) === gSel) : [], dests = new Map(legal.map((m) => [(m >> 7) & 127, m]));
  const ksq = pos.inCheck() ? pos.k[pos.side > 0 ? 0 : 1] : -1;
  for (let i = 0; i < 64; i++) {
    const r = gView > 0 ? 7 - (i >> 3) : (i >> 3), f = gView > 0 ? (i & 7) : 7 - (i & 7), s = r * 16 + f, d = document.createElement('div'), p = pos.b[s];
    d.className = 'sq ' + ((r + f) % 2 === 0 ? 'd' : 'l') + (s === gSel ? ' sel' : '') + (G && G.last && (G.last[0] === s || G.last[1] === s) ? ' last' : '') + (dests.has(s) ? (p ? ' cp' : ' mv') : '') + (s === ksq ? ' chk' : '');
    d.dataset.s = s; d.setAttribute('role', 'gridcell');
    if (p) { const sp = document.createElement('span'); sp.className = p > 0 ? 'pw' : 'pb'; sp.textContent = GL[Math.abs(p)] + VS; d.append(sp); d.setAttribute('aria-label', (p > 0 ? 'أبيض ' : 'أسود ') + FILES[f] + (r + 1)); } else d.setAttribute('aria-label', FILES[f] + (r + 1));
    if ((i >> 3) === 7) { const c = document.createElement('span'); c.className = 'co'; c.textContent = FILES[f]; d.append(c); }
    bd.append(d);
  }
  let mv = ''; if (G) G.hist.forEach((h, i) => { if (i % 2 === 0) mv += `${Math.floor(i / 2) + 1}. `; mv += h.san + ' '; }); $('#gMoves').textContent = mv || '';
  let ar = ''; if (gHint) { const cen = (s) => gView > 0 ? [(s & 7) + 0.5, 7 - (s >> 4) + 0.5] : [7 - (s & 7) + 0.5, (s >> 4) + 0.5]; ar = arrowSVG(cen(CE.parseSq(gHint.slice(0, 2))), cen(CE.parseSq(gHint.slice(2, 4))), COL[0], 0.2); } $('#garrows').innerHTML = ar;
}
$('#gboard').addEventListener('click', (e) => {
  const d = e.target.closest('.sq'); if (!d || !G || G.over || G.thinking || G.pos.side !== G.human) return; const s = +d.dataset.s, p = G.pos;
  if (gSel >= 0) { const ms = p.legal().filter((m) => (m & 127) === gSel && ((m >> 7) & 127) === s); if (ms.length) { if (ms.length > 1) { showPromo(ms); return; } humanMove(ms[0]); return; } }
  gSel = p.b[s] * p.side > 0 ? (s === gSel ? -1 : s) : -1; renderG();
});
function showPromo(ms) {
  const box = $('#promo'); box.textContent = ''; box.classList.remove('hide'); const nm = { 5: 'وزير', 4: 'رخ', 3: 'فيل', 2: 'حصان' };
  for (const m of ms.sort((a, b) => ((b >> 14) & 7) - ((a >> 14) & 7))) { const t = (m >> 14) & 7, b = document.createElement('button'), sp = document.createElement('span'); sp.className = G.human > 0 ? 'pw' : 'pb'; sp.textContent = GL[t] + VS; b.append(sp); b.setAttribute('aria-label', 'رقّي إلى ' + nm[t]); b.onclick = () => { box.classList.add('hide'); humanMove(m); }; box.append(b); }
}
function humanMove(m) { applyMove(m); afterMove(); }
$('#gNew').onclick = () => newGame();
$('#gFromEd').onclick = () => { try { const f = getFEN(); new CE.Pos().setFEN(f); newGame(f); } catch (e) { gStatusSet(e.message, true); } };
$('#gUndo').onclick = () => {
  if (!G || G.thinking || !G.hist.length) return; G.over = null; $('#promo').classList.add('hide');
  do { G.pos.unmake(); G.hist.pop(); G.keys.pop(); } while (G.hist.length && G.pos.side !== G.human);
  G.last = null; gSel = -1; gHint = null; afterMove();
};
$('#gHint').onclick = async () => {
  if (!G || G.over || G.thinking || G.pos.side !== G.human) return; gStatusSet('بدوّر على أحسن نقلة…'); await new Promise((r) => setTimeout(r, 30));
  try { const r = await analyze(G.pos.toFEN(), { sf: false, bms: 900 }); if (r.lines && r.lines[0]) { gHint = r.lines[0].uci; gStatusSet('تلميح: ' + r.lines[0].san + ' (السهم الأخضر).'); } } catch (e) { gStatusSet(e.message, true); } renderG();
};
$('#gFlip').onclick = () => { gView = -gView; renderG(); };
$('#gRes').onclick = () => { if (!G || G.over) return; G.thinking = false; G.over = { res: G.human > 0 ? '0-1' : '1-0', why: 'استسلام' }; gStatusSet('استسلمت. الكمبيوتر كسب.'); renderG(); };
$('#gAn').onclick = () => { if (!G) return; loadFEN(G.pos.toFEN()); showTab('an'); $('#board').scrollIntoView({ behavior: 'smooth', block: 'center' }); };
$('#gPgn').onclick = async () => {
  if (!G) return; let s = ''; G.hist.forEach((h, i) => { if (i % 2 === 0) s += `${Math.floor(i / 2) + 1}. `; s += h.san + ' '; }); const t = `[Event "ضد الكمبيوتر (مستوى ${gLevel})"]\n[FEN "${G.start}"]\n[Result "${G.over ? G.over.res : '*'}"]\n\n${s.trim()} ${G.over ? G.over.res : '*'}`;
  try { await navigator.clipboard.writeText(t); gStatusSet('تم نسخ النقلات.'); } catch (e) { gStatusSet('مقدرتش أنسخ، حدد النقلات يدويًا.', true); }
};

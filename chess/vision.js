/* Board recognition from a screenshot/photo, classical image processing (no ML model, no network).
   Works on {data,width,height} (ImageData-like). Best on clean screenshots of digital boards. */
'use strict';
(function (root) {
  const N = 32, TN = 24, REL = [0, 0.66, 0.88, 0.94, 0.8, 0.98, 1.0]; // typical piece height relative to the tallest pieces
  function integral(g, w, h) {
    const W = w + 1, I = new Float64Array(W * (h + 1));
    for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * W + x + 1] = I[y * W + x + 1] + row; } }
    return I;
  }
  function rmean(I, w, h, x0, y0, x1, y1) {
    x0 = Math.max(0, Math.min(w, Math.round(x0))); x1 = Math.max(x0 + 1, Math.min(w, Math.round(x1)));
    y0 = Math.max(0, Math.min(h, Math.round(y0))); y1 = Math.max(y0 + 1, Math.min(h, Math.round(y1)));
    const W = w + 1; return (I[y1 * W + x1] - I[y0 * W + x1] - I[y1 * W + x0] + I[y0 * W + x0]) / ((x1 - x0) * (y1 - y0));
  }
  function grayOf(img) {
    const { data, width: w, height: h } = img, g = new Float32Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = 0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2];
    return g;
  }
  function downscale(img, maxDim) {
    const f = Math.max(1, Math.max(img.width, img.height) / maxDim);
    if (f <= 1) return { g: grayOf(img), w: img.width, h: img.height, f: 1 };
    const w = Math.floor(img.width / f), h = Math.floor(img.height / f), g = new Float32Array(w * h), full = grayOf(img);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * f), x1 = Math.max(x0 + 1, Math.floor((x + 1) * f)), y0 = Math.floor(y * f), y1 = Math.max(y0 + 1, Math.floor((y + 1) * f)); let s = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { s += full[yy * img.width + xx]; n++; }
      g[y * w + x] = s / n;
    }
    return { g, w, h, f };
  }
  /* how well does an 8x8 checker lattice at (x,y,s) match? corners of each cell are rarely covered by pieces */
  function boardScore(I, W, H, x, y, s) {
    if (x < 0 || y < 0 || x + s > W || y + s > H) return 0;
    const c = s / 8, p = Math.max(1, Math.round(c * 0.14)), ins = Math.max(1, c * 0.06), sum = [0, 0], sq = [0, 0], n = [0, 0];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const cls = (i + j) & 1, cx = x + j * c, cy = y + i * c;
      for (const [ox, oy] of [[ins, ins], [c - ins - p, ins], [ins, c - ins - p], [c - ins - p, c - ins - p]]) {
        const m = rmean(I, W, H, cx + ox, cy + oy, cx + ox + p, cy + oy + p); sum[cls] += m; sq[cls] += m * m; n[cls]++;
      }
    }
    const mA = sum[0] / n[0], mB = sum[1] / n[1], sd = (k) => Math.sqrt(Math.max(0, sq[k] / n[k] - (sum[k] / n[k]) ** 2));
    const diff = Math.abs(mA - mB); if (diff < 12) return 0;
    return diff / (sd(0) + sd(1) + 6);
  }
  function findBoard(img) {
    const ds = downscale(img, 240), I = integral(ds.g, ds.w, ds.h); let best = { score: 0 }, stepMax = 1;
    const mn = Math.min(ds.w, ds.h);
    for (let S = Math.floor(mn * 0.25); S <= mn; S = Math.max(S + 2, Math.round(S * 1.035))) {
      const step = Math.max(1, Math.round(S / 26)); stepMax = Math.max(stepMax, step);
      for (let y = 0; y + S <= ds.h; y += step) for (let x = 0; x + S <= ds.w; x += step) {
        const sc = boardScore(I, ds.w, ds.h, x, y, S);
        if (sc > best.score * 1.04 || (sc > best.score * 0.97 && S > (best.s || 0) && sc > 0 && Math.abs(S - (best.s || 0)) > S * 0.04)) best = { score: sc, x, y, s: S };
      }
    }
    if (!best.s) return null;
    // refine at full resolution
    const g = grayOf(img), IF = integral(g, img.width, img.height), f = ds.f, r = Math.ceil(f) + 2;
    let b2 = { score: -1 }; const X = Math.round(best.x * f), Y = Math.round(best.y * f), S0 = Math.round(best.s * f);
    const search = (cx, cy, cs, r, st) => { for (let k = -r; k <= r; k += st) for (let dy = -r; dy <= r; dy += st) for (let dx = -r; dx <= r; dx += st) {
      const sc = boardScore(IF, img.width, img.height, cx + dx, cy + dy, cs + k); if (sc > b2.score) b2 = { score: sc, x: cx + dx, y: cy + dy, s: cs + k }; } };
    const r1 = Math.ceil(stepMax * f) + 2; search(X, Y, S0, r1, Math.max(1, Math.round(r1 / 4)));
    search(b2.x, b2.y, b2.s, Math.max(2, Math.round(r1 / 4)), 1);
    return b2.score > 1.2 ? b2 : null;
  }

  function median(a) { a = a.slice().sort((x, y) => x - y); return a[a.length >> 1]; }
  function largest(mask, w, h, conn8) {
    const lab = new Int16Array(w * h), sizes = [0]; let k = 0;
    for (let i = 0; i < w * h; i++) {
      if (!mask[i] || lab[i]) continue; k++; let n = 0; const st = [i]; lab[i] = k;
      while (st.length) {
        const p = st.pop(); n++; const x = p % w, y = (p / w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue; if (!conn8 && dx && dy) continue; const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const q = yy * w + xx; if (mask[q] && !lab[q]) { lab[q] = k; st.push(q); }
        }
      }
      sizes[k] = n;
    }
    let bk = 0, bn = 0; for (let j = 1; j <= k; j++) if (sizes[j] > bn) { bn = sizes[j]; bk = j; }
    const out = new Uint8Array(w * h); if (bk) for (let i = 0; i < w * h; i++) if (lab[i] === bk) out[i] = 1;
    return { mask: out, area: bn };
  }
  /* resize a binary mask's bounding box to TN x TN (area average) */
  function normBits(m, w, h) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, bits = new Uint8Array(TN * TN);
    for (let ty = 0; ty < TN; ty++) for (let tx = 0; tx < TN; tx++) {
      const sx0 = x0 + tx * bw / TN, sx1 = x0 + (tx + 1) * bw / TN, sy0 = y0 + ty * bh / TN, sy1 = y0 + (ty + 1) * bh / TN; let s = 0, n = 0;
      for (let yy = Math.floor(sy0); yy < Math.max(Math.floor(sy0) + 1, Math.ceil(sy1)); yy++) for (let xx = Math.floor(sx0); xx < Math.max(Math.floor(sx0) + 1, Math.ceil(sx1)); xx++) { s += m[Math.min(h - 1, yy) * w + Math.min(w - 1, xx)]; n++; }
      bits[ty * TN + tx] = s / n >= 0.5 ? 1 : 0;
    }
    return { bits, asp: bw / bh, bw, bh };
  }
  function similarity(a, b) {
    let inter = 0, uni = 0; for (let i = 0; i < a.bits.length; i++) { const x = a.bits[i], y = b.bits[i]; if (x & y) inter++; if (x | y) uni++; }
    return inter / uni - 0.35 * Math.abs(Math.log(a.asp / b.asp));
  }
  /* templates: [{t:1..6, bits, asp}], built from font glyphs by the page (see makeTemplates in app) */
  function readBoard(img, box, tpl, keep) {
    const { data, width: W, height: H } = img, cs = box.s / 8, cells = [], k = Math.max(1, Math.min(3, Math.floor(cs / N)));
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      const cx = box.x + col * cs, cy = box.y + row * cs, R = new Float32Array(N * N), G = new Float32Array(N * N), B = new Float32Array(N * N);
      for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
        let r = 0, g = 0, b = 0, n = 0; const px = cx + (gx + 0.5) * cs / N, py = cy + (gy + 0.5) * cs / N;
        for (let a = 0; a < k; a++) for (let c = 0; c < k; c++) {
          const xx = Math.min(W - 1, Math.max(0, Math.round(px + (c - (k - 1) / 2)))), yy = Math.min(H - 1, Math.max(0, Math.round(py + (a - (k - 1) / 2)))), j = (yy * W + xx) * 4;
          r += data[j]; g += data[j + 1]; b += data[j + 2]; n++;
        }
        const i = gy * N + gx; R[i] = r / n; G[i] = g / n; B[i] = b / n;
      }
      // background colour of this cell = median of its four corners (works with highlighted squares)
      const bg = [[], [], []];
      for (const [x0, y0] of [[1, 1], [N - 4, 1], [1, N - 4], [N - 4, N - 4]]) for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 3; x++) { const i = y * N + x; bg[0].push(R[i]); bg[1].push(G[i]); bg[2].push(B[i]); }
      const br = median(bg[0]), bgc = median(bg[1]), bb = median(bg[2]);
      const mask = new Uint8Array(N * N), m = 2;
      for (let y = m; y < N - m; y++) for (let x = m; x < N - m; x++) { const i = y * N + x; if (Math.max(Math.abs(R[i] - br), Math.abs(G[i] - bgc), Math.abs(B[i] - bb)) > 34) mask[i] = 1; }
      // fill holes: anything not reachable from the border through non-mask pixels is part of the piece
      const reach = new Uint8Array(N * N), st = [];
      for (let i = 0; i < N; i++) for (const p of [i, (N - 1) * N + i, i * N, i * N + N - 1]) if (!mask[p] && !reach[p]) { reach[p] = 1; st.push(p); }
      while (st.length) { const p = st.pop(), x = p % N, y = (p / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue; const q = yy * N + xx; if (!mask[q] && !reach[q]) { reach[q] = 1; st.push(q); } } }
      const sil0 = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) sil0[i] = reach[i] ? 0 : 1;
      const { mask: sil, area } = largest(sil0, N, N, true);
      if (area < 0.045 * N * N) { cells.push({ t: 0, c: 0, conf: 1, occ: 0 }); continue; }
      // piece colour from its interior
      const lum = []; for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) { const i = y * N + x; if (sil[i] && sil[i - 1] && sil[i + 1] && sil[i - N] && sil[i + N]) lum.push(0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i]); }
      const L = lum.length ? median(lum) : 128, white = L >= 150;
      cells.push({ t: 0, c: white ? 1 : -1, L, nb: normBits(sil, N, N), occ: 1 });
    }
    // piece height relative to the tallest pieces on this board (pawns are short, kings/queens tall)
    const hs = cells.filter((c) => c.occ && c.nb).map((c) => c.nb.bh).sort((a, b) => a - b), ref = hs.length ? hs[Math.min(hs.length - 1, Math.floor(hs.length * 0.9))] : 1;
    // two template families (real chess.com silhouettes vs. generic font glyphs): use whichever one fits this board better overall
    const fam = (c, real) => {
      const per = {}, rh = c.nb.bh / ref;
      for (const T of tpl) { if (!!T.real !== real) continue; const sc = similarity(c.nb, T) - 0.25 * Math.abs(Math.min(1.1, rh) - REL[T.t]); if (per[T.t] === undefined || sc > per[T.t]) per[T.t] = sc; }
      const arr = Object.entries(per).map(([t, v]) => [+t, v]).sort((a, b) => b[1] - a[1]); return arr.length ? { t: arr[0][0], s: arr[0][1], conf: arr[0][1] - (arr[1] ? arr[1][1] : -9) } : null;
    };
    const occ = cells.filter((c) => c.occ && c.nb), res = { f: [], r: [] };
    occ.forEach((c) => { c.fr = fam(c, false); c.rr = fam(c, true); if (c.fr) res.f.push(c.fr.s); if (c.rr) res.r.push(c.rr.s); });
    const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : -9, useReal = mean(res.r) > mean(res.f) + 0.03;
    cells.forEach((c) => {
      if (!c.occ) return;
      const p = c.nb && tpl ? (useReal ? c.rr : c.fr) || c.fr || c.rr : null;
      c.t = p ? p.t : 0; c.conf = p ? p.conf : 0; c.sim = p ? p.s : -9; if (!keep) { delete c.nb; } delete c.fr; delete c.rr;
    });
    return cells;
  }
  /* image row/col -> FEN placement. flipped = black at the bottom */
  function cellsToFEN(cells, flipped) {
    const CHs = ' pnbrqk'; let s = '';
    for (let rank = 7; rank >= 0; rank--) {
      let e = 0;
      for (let file = 0; file < 8; file++) {
        const row = flipped ? rank : 7 - rank, col = flipped ? 7 - file : file, c = cells[row * 8 + col];
        if (!c || !c.t) { e++; continue; } if (e) { s += e; e = 0; } const ch = CHs[c.t]; s += c.c > 0 ? ch.toUpperCase() : ch;
      }
      if (e) s += e; if (rank) s += '/';
    }
    return s;
  }
  function guessFlipped(cells) { let top = 0, bot = 0; cells.forEach((c, i) => { if (c.t && c.c > 0) { if (i < 32) top++; else bot++; } }); return top > bot; }
  /* silhouettes of the six piece types from whatever chess glyph fonts the device has */
  /* silhouettes sampled from a real chess.com board screenshot (24x24, bounding-box normalised): [type, aspect, hex bits] */
  const REAL = [[4, 0.76, "007f003ffff87ffffc7ffffc3ffffc1ffffc3ffffc1ffffc0fffe01fffe01ffff01ffff81ffff81ffff80ffff80ffff81ffff81ffffc1ffffcffffffffffffffffffffffffffffff"], [5, 0.963, "01e78003ffc007ffc007fe0003fc8013ff8f7bff9f2fefbfffffff67ffff3ffffc3bfffc39fff818fff819fff009fff00ffff00fffe00fffe01ffff03ffff83ffff83ffffc3ffffc"], [4, 0.76, "1cfe703e7ffc7e3ffe7ffffc7ffffc3ffffc1ffffc3ffffc1ffff81ffff01ffff81ffff81ffff81ffff81ffff81ffff83ffff83ffff8fffffcfffffeffffffffffffffffffffffff"], [6, 0.926, "00780000fc0001ff8001ff8001ff8000ff003ffffc7ffffefffffffffffffffffffffffffffffffffffefffffcfffffc3ffff01ffff01ffff03ffff83ffff83ffff83ffff83ffff8"], [1, 0.739, "007e00007f0000ffc001ffe003ffe007ffe007ffe003ffe001ffc007ffe00ffff007fff003ffe001ff8001ff8003ffc01ffff83ffffcfffffeffffffffffffffffffffffffffffff"], [1, 0.739, "007e00007e0000ff0003ff0007ffc007ffe007ffe003ffc001ff8007ff800ffff007ffe003ffc001ff8001ff0003ffc017ffe03ffff8fffffcfffffeffffffffffffffffff000003"], [1, 0.739, "00780000fe0003ff0007ff8007ffc00fffe007ffe007ffe003ffc007ffe01ffff01fffe007ffc001ff0003ff001fff803fffe03ffff8fffffcfffffefffffe3ffffcffffffffffff"], [1, 0.739, "001800003800007f0003ffc007ffe00fffe007ffe007ffe003ffc007ffc007ffe007ffe000ffe000ffe007ffc007ffc01fffe03ffff87ffffcffffffffffffffffffffffffcf001f"], [1, 0.783, "007e0000ff0001ff8003ffc007ffe007ffe007ffe003ffc003ffc003ffe000fec003ffc003ffe001ffc003ffc003ffc00ffff81ffffc3ffffc7ffffeffffffffffffffffffffffff"], [1, 0.739, "000e0000ff0001ffc001ffe003ff4007ff0007fe0003fec001ffe007ffe00ffff00ffff007ffe003ffe000ffe001ffe007fff81ffffc3fffff7ffffffffffffffffcffffffffffff"], [3, 0.731, "007e0000ff0000ff0000fe0001fc8003ffc003fff007fff80ffff81ffff83ffffc3ffffe3ffffe3ffffe3ffffe3ffffc1ffffc0ffff807fff83ffffc7fffffffffffffffffffffff"], [2, 0.88, "01f00001ff0003ff8007ffe00ffff00ffff807fffc0ffffc1ffffc3fffff3ffffffffffefffffefffffefe7ffe1cffff01ffff03fffc03fffc07ffff0fffff0fffff1bffff1bffff"], [5, 1.04, "03f7c003ffe007ffe003ffe031fffe7dffffffffffffffffffffff7fffff3ffffe3ffffc1ffff81ffff81ffff80ffff80ffff00fffe007ffe00ffff01ffff81ffff81ffff81ffffc"], [1, 0.81, "00ff8000ff8000ffc003ffe007ffe007ffe003ffe001ffe001ff8003ffc007ffe00ffff007fff003ffe001ff8001ff8007ffe007ffe01ffffc3ffffeffffffffffffffffffffffff"], [1, 0.818, "00e00000ff8000ffc001ffc003ffe003ffe003fff003fff003ffe003ffe803fff807fff007fff007fff003ffc000ffc007ffe00ffff01ffff8bffffcfffffeffffffffffff7fffff"], [1, 0.762, "01ff8001ffc003ffc003ffc003ffe003ffe007ffc00fffc003ffc007ffe00ffff80ffff80ffff007ffe001ffc001ffc00ffff01ffff83ffffcffffffffffffffffffffffffffffff"], [4, 0.87, "007f300f7f381ffffc3ffffe3ffffc3ffffc3ffffc1ffffc0ffffc0ffff80ffff00ffff00ffff80ffff80ffff80ffff80ffff80ffffc1ffffc1ffffcffffffffffff7fffff7fffff"], [4, 0.826, "06fc001efe383efffc7efffc6ffffc1ffffc1ffffc3ffffc3ffff81ffff00ffff01ffff81ffff81ffff81ffff81ffff83ffff83ffff83ffff83ffffcffffffffffffffffffffffff"], [6, 1.08, "003e0000ff0000ff8000ff8000ff8007fff81ffffe3fffff3fffff7fffff7fffffffffffffffff7fffff7fffff3ffffe1ffffe0ffffc0ffff80ffff00ffff00ffff80ffff80ffff8"]];
  function makeTemplates(doc) {
    const fonts = ['"DejaVu Sans"', '"Segoe UI Symbol"', '"Apple Symbols"', '"Noto Sans Symbols 2"', '"FreeSerif"', '"Arial Unicode MS"', 'serif', 'sans-serif'];
    const glyph = { 1: '\u265F', 2: '\u265E', 3: '\u265D', 4: '\u265C', 5: '\u265B', 6: '\u265A' };
    const cv = doc.createElement('canvas'); cv.width = cv.height = 120; const ctx = cv.getContext('2d', { willReadFrequently: true });
    const out = [], seen = new Set();
    for (const f of fonts) {
      const set = [];
      for (let t = 1; t <= 6; t++) {
        ctx.clearRect(0, 0, 120, 120); ctx.font = '96px ' + f; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#000'; ctx.fillText(glyph[t] + '\uFE0E', 12, 96);
        const d = ctx.getImageData(0, 0, 120, 120).data, m = new Uint8Array(14400); for (let i = 0; i < 14400; i++) m[i] = d[i * 4 + 3] > 110 ? 1 : 0;
        const nb = normBits(m, 120, 120); if (!nb) { set.length = 0; break; } set.push({ t, bits: nb.bits, asp: nb.asp, bh: nb.bh });
      }
      if (set.length !== 6) continue;
      const mh = Math.max(...set.map((x) => x.bh)); set.forEach((x) => { x.rel = x.bh / mh; });
      const keys = set.map((x) => x.bits.join('')); if (new Set(keys).size < 6) continue; // missing glyphs draw identical boxes
      const fk = keys[0] + keys[5]; if (seen.has(fk)) continue; seen.add(fk); out.push(...set);
    }
    for (const [t, asp, hx] of REAL) { const bits = new Uint8Array(TN * TN), big = BigInt('0x' + hx); for (let i = 0; i < TN * TN; i++) bits[i] = Number((big >> BigInt(TN * TN - 1 - i)) & 1n); out.push({ t, bits, asp, real: true }); }
    return out;
  }
  const V = { makeTemplates, findBoard, readBoard, cellsToFEN, guessFlipped, normBits, TN };
  if (typeof module !== 'undefined' && module.exports) module.exports = V; else root.CV = V;
})(typeof self !== 'undefined' ? self : this);

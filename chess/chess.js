/* Minimal chess rules + alpha-beta engine (no dependencies). Works in the browser and in node (for tests). */
'use strict';
(function (root) {
  const KN = [-33, -31, -18, -14, 14, 18, 31, 33], KG = [-17, -16, -15, -1, 1, 15, 16, 17], BD = [-17, -15, 15, 17], RD = [-16, -1, 1, 16];
  const FILES = 'abcdefgh', CH = ' PNBRQK', LET = { p: 1, n: 2, b: 3, r: 4, q: 5, k: 6 };
  const sqName = (s) => FILES[s & 7] + ((s >> 4) + 1);
  const parseSq = (n) => (n.charCodeAt(0) - 97) + 16 * (n.charCodeAt(1) - 49);
  const CR = new Uint8Array(128).fill(15); CR[0] = 13; CR[7] = 14; CR[4] = 12; CR[112] = 7; CR[119] = 11; CR[116] = 3; // rights kept after a move touching the square
  const mv = (f, t, p, fl) => f | (t << 7) | (p << 14) | (fl << 17);

  function Pos() { this.b = new Int8Array(128); this.side = 1; this.cast = 0; this.ep = -1; this.hm = 0; this.fm = 1; this.k = [0, 0]; this.st = []; }
  Pos.prototype.setFEN = function (fen) {
    const f = String(fen).trim().split(/\s+/); this.b.fill(0); this.k = [-1, -1]; this.st = [];
    let r = 7, c = 0, kc = [0, 0];
    for (const ch of f[0]) {
      if (ch === '/') { r--; c = 0; continue; }
      if (/[1-8]/.test(ch)) { c += +ch; continue; }
      const t = LET[ch.toLowerCase()]; if (!t || r < 0 || c > 7) throw new Error('FEN غير صالح');
      const black = ch !== ch.toUpperCase(), s = r * 16 + c; this.b[s] = black ? -t : t;
      if (t === 6) { this.k[black ? 1 : 0] = s; kc[black ? 1 : 0]++; } c++;
    }
    if (kc[0] !== 1 || kc[1] !== 1) throw new Error('لازم يكون فيه ملك أبيض واحد وملك أسود واحد');
    this.side = (f[1] || 'w') === 'b' ? -1 : 1;
    const cs = f[2] || '-'; this.cast = (cs.includes('K') ? 1 : 0) | (cs.includes('Q') ? 2 : 0) | (cs.includes('k') ? 4 : 0) | (cs.includes('q') ? 8 : 0);
    this.ep = f[3] && f[3] !== '-' ? parseSq(f[3]) : -1; this.hm = +f[4] || 0; this.fm = +f[5] || 1;
    return this;
  };
  Pos.prototype.toFEN = function () {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let e = 0;
      for (let c = 0; c < 8; c++) { const p = this.b[r * 16 + c]; if (!p) { e++; continue; } if (e) { s += e; e = 0; } const l = CH[Math.abs(p)]; s += p > 0 ? l : l.toLowerCase(); }
      if (e) s += e; if (r) s += '/';
    }
    const cs = (this.cast & 1 ? 'K' : '') + (this.cast & 2 ? 'Q' : '') + (this.cast & 4 ? 'k' : '') + (this.cast & 8 ? 'q' : '');
    return `${s} ${this.side > 0 ? 'w' : 'b'} ${cs || '-'} ${this.ep >= 0 ? sqName(this.ep) : '-'} ${this.hm} ${this.fm}`;
  };
  Pos.prototype.attacked = function (sq, by) {
    const b = this.b; let s;
    if (by > 0) { s = sq - 15; if (!(s & 0x88) && b[s] === 1) return true; s = sq - 17; if (!(s & 0x88) && b[s] === 1) return true; }
    else { s = sq + 15; if (!(s & 0x88) && b[s] === -1) return true; s = sq + 17; if (!(s & 0x88) && b[s] === -1) return true; }
    for (let i = 0; i < 8; i++) { s = sq + KN[i]; if (!(s & 0x88) && b[s] === 2 * by) return true; s = sq + KG[i]; if (!(s & 0x88) && b[s] === 6 * by) return true; }
    for (let i = 0; i < 4; i++) {
      let d = BD[i]; s = sq + d; while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === 3 * by || p === 5 * by) return true; break; } s += d; }
      d = RD[i]; s = sq + d; while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === 4 * by || p === 5 * by) return true; break; } s += d; }
    }
    return false;
  };
  Pos.prototype.inCheck = function () { return this.attacked(this.k[this.side > 0 ? 0 : 1], -this.side); };
  Pos.prototype.gen = function (caps) {
    const b = this.b, side = this.side, out = [];
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = b[s]; if (!p || p * side < 0) continue; const t = Math.abs(p);
      if (t === 1) {
        const dir = side > 0 ? 16 : -16, start = side > 0 ? 1 : 6, pr = side > 0 ? 6 : 1, f = s + dir;
        if (!(f & 0x88) && !b[f]) {
          if ((s >> 4) === pr) { for (const x of [5, 4, 3, 2]) out.push(mv(s, f, x, 0)); }
          else if (!caps) { out.push(mv(s, f, 0, 0)); if ((s >> 4) === start && !b[f + dir]) out.push(mv(s, f + dir, 0, 0)); }
        }
        for (const dx of [-1, 1]) {
          const c = s + dir + dx; if (c & 0x88) continue; const q = b[c];
          if (q && q * side < 0) { if ((s >> 4) === pr) { for (const x of [5, 4, 3, 2]) out.push(mv(s, c, x, 0)); } else out.push(mv(s, c, 0, 0)); }
          else if (c === this.ep && !q) out.push(mv(s, c, 0, 1));
        }
      } else if (t === 2 || t === 6) {
        const D = t === 2 ? KN : KG;
        for (let i = 0; i < 8; i++) { const c = s + D[i]; if (c & 0x88) continue; const q = b[c]; if (!q) { if (!caps) out.push(mv(s, c, 0, 0)); } else if (q * side < 0) out.push(mv(s, c, 0, 0)); }
        if (t === 6 && !caps) {
          const base = side > 0 ? 0 : 112, kb = side > 0 ? 1 : 4, qb = side > 0 ? 2 : 8;
          if (s === base + 4 && !this.attacked(s, -side)) {
            if ((this.cast & kb) && !b[base + 5] && !b[base + 6] && b[base + 7] === 4 * side && !this.attacked(base + 5, -side) && !this.attacked(base + 6, -side)) out.push(mv(s, base + 6, 0, 2));
            if ((this.cast & qb) && !b[base + 1] && !b[base + 2] && !b[base + 3] && b[base] === 4 * side && !this.attacked(base + 3, -side) && !this.attacked(base + 2, -side)) out.push(mv(s, base + 2, 0, 4));
          }
        }
      } else {
        const D = t === 3 ? BD : t === 4 ? RD : BD.concat(RD);
        for (let i = 0; i < D.length; i++) { let c = s + D[i]; while (!(c & 0x88)) { const q = b[c]; if (!q) { if (!caps) out.push(mv(s, c, 0, 0)); } else { if (q * side < 0) out.push(mv(s, c, 0, 0)); break; } c += D[i]; } }
      }
    }
    return out;
  };
  Pos.prototype.make = function (m) {
    const b = this.b, f = m & 127, t = (m >> 7) & 127, pr = (m >> 14) & 7, fl = (m >> 17) & 7, p = b[f], side = this.side;
    const cap = (fl & 1) ? b[t + (side > 0 ? -16 : 16)] : b[t];
    this.st.push([m, cap, this.cast, this.ep, this.hm, this.k[0], this.k[1], p, this.fm]);
    b[t] = pr ? pr * side : p; b[f] = 0;
    if (fl & 1) b[t + (side > 0 ? -16 : 16)] = 0;
    if (fl & 2) { b[t - 1] = b[t + 1]; b[t + 1] = 0; }
    if (fl & 4) { b[t + 1] = b[t - 2]; b[t - 2] = 0; }
    if (Math.abs(p) === 6) this.k[side > 0 ? 0 : 1] = t;
    this.cast &= CR[f] & CR[t];
    this.ep = (Math.abs(p) === 1 && Math.abs(t - f) === 32) ? (f + t) >> 1 : -1;
    this.hm = (Math.abs(p) === 1 || cap) ? 0 : this.hm + 1;
    if (side < 0) this.fm++;
    this.side = -side;
  };
  Pos.prototype.unmake = function () {
    const [m, cap, cast, ep, hm, k0, k1, p, fm] = this.st.pop(), b = this.b, f = m & 127, t = (m >> 7) & 127, fl = (m >> 17) & 7;
    this.side = -this.side; const side = this.side;
    b[f] = p; b[t] = 0;
    if (fl & 1) b[t + (side > 0 ? -16 : 16)] = cap; else b[t] = cap;
    if (fl & 2) { b[t + 1] = b[t - 1]; b[t - 1] = 0; }
    if (fl & 4) { b[t - 2] = b[t + 1]; b[t + 1] = 0; }
    this.cast = cast; this.ep = ep; this.hm = hm; this.k[0] = k0; this.k[1] = k1; this.fm = fm;
  };
  Pos.prototype.legal = function (caps) {
    const mvs = this.gen(caps), out = [], me = this.side, ki = me > 0 ? 0 : 1;
    for (const m of mvs) { this.make(m); if (!this.attacked(this.k[ki], -me)) out.push(m); this.unmake(); }
    return out;
  };
  Pos.prototype.uci = (m) => sqName(m & 127) + sqName((m >> 7) & 127) + (((m >> 14) & 7) ? CH[(m >> 14) & 7].toLowerCase() : '');
  Pos.prototype.fromUCI = function (u) {
    const f = parseSq(u.slice(0, 2)), t = parseSq(u.slice(2, 4)), pr = u[4] ? LET[u[4]] : 0;
    return this.legal().find((m) => (m & 127) === f && ((m >> 7) & 127) === t && ((m >> 14) & 7) === pr) || 0;
  };
  Pos.prototype.san = function (m) {
    const b = this.b, f = m & 127, t = (m >> 7) & 127, pr = (m >> 14) & 7, fl = (m >> 17) & 7, p = Math.abs(b[f]);
    const legal = this.legal(); let s;
    if (fl & 2) s = 'O-O'; else if (fl & 4) s = 'O-O-O';
    else {
      const cap = b[t] || (fl & 1);
      if (p === 1) { s = (cap ? FILES[f & 7] + 'x' : '') + sqName(t) + (pr ? '=' + CH[pr] : ''); }
      else {
        s = CH[p];
        const oth = legal.filter((o) => o !== m && ((o >> 7) & 127) === t && Math.abs(b[o & 127]) === p);
        if (oth.length) { const sf = oth.some((o) => (o & 7) === (f & 7)), sr = oth.some((o) => ((o & 127) >> 4) === (f >> 4)); if (!sf) s += FILES[f & 7]; else if (!sr) s += (f >> 4) + 1; else s += sqName(f); }
        if (cap) s += 'x'; s += sqName(t);
      }
    }
    this.make(m); const chk = this.inCheck(), has = this.legal().length > 0; this.unmake();
    return s + (chk ? (has ? '+' : '#') : '');
  };
  function perft(pos, d) { if (!d) return 1; let n = 0; for (const m of pos.legal()) { pos.make(m); n += perft(pos, d - 1); pos.unmake(); } return n; }

  /* ---------- evaluation (simplified PST evaluation) ---------- */
  const VAL = [0, 100, 320, 330, 500, 900, 0];
  const PST = [null,
    [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5, 0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30, -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10, -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5, 0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20]];
  const KEND = [-50,-40,-30,-20,-20,-30,-40,-50, -30,-20,-10,0,0,-10,-20,-30, -30,-10,20,30,30,20,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,30,40,40,30,-10,-30, -30,-10,20,30,30,20,-10,-30, -30,-30,0,0,0,0,-30,-30, -50,-30,-30,-30,-30,-30,-30,-50];
  function evaluate(pos) {
    const b = pos.b; let np = 0, sc = 0; const pcs = [];
    for (let s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } const p = b[s]; if (!p) continue; const t = Math.abs(p); if (t > 1 && t < 6) np += VAL[t]; pcs.push(s); }
    const end = np <= 2600;
    for (const s of pcs) {
      const p = b[s], t = Math.abs(p), w = p > 0, r = s >> 4, c = s & 7, i = w ? (7 - r) * 8 + c : r * 8 + c;
      const v = VAL[t] + (t === 6 ? (end ? KEND[i] : PST[6][i]) : PST[t][i]);
      sc += w ? v : -v;
    }
    return pos.side > 0 ? sc : -sc;
  }

  /* ---------- search ---------- */
  const MATE = 30000;
  function search(pos, ms, maxDepth, exclude, all) {
    const t0 = Date.now(), dl = t0 + ms; let nodes = 0; const STOP = {};
    const killers = []; const hist = new Int32Array(128 * 128);
    const mvv = (m) => { const v = Math.abs(pos.b[(m >> 7) & 127]) || (((m >> 17) & 1) ? 1 : 0); return v ? v * 16 - Math.abs(pos.b[m & 127]) + 1000 : 0; };
    function order(ms, ply, pv) {
      const sc = ms.map((m) => m === pv ? 1e6 : (mvv(m) || (((m >> 14) & 7) ? 900 : (killers[ply] && (killers[ply][0] === m || killers[ply][1] === m) ? 500 : hist[(m & 127) * 128 + ((m >> 7) & 127)] / 1000))));
      const idx = ms.map((_, i) => i).sort((a, b) => sc[b] - sc[a]); return idx.map((i) => ms[i]);
    }
    function qs(alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && Date.now() > dl) throw STOP;
      const st = evaluate(pos); if (st >= beta) return beta; if (st > alpha) alpha = st;
      for (const m of order(pos.legal(true), ply, 0)) { pos.make(m); const v = -qs(-beta, -alpha, ply + 1); pos.unmake(); if (v >= beta) return beta; if (v > alpha) alpha = v; }
      return alpha;
    }
    function nm(d, alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && Date.now() > dl) throw STOP;
      const chk = pos.inCheck(); if (chk) d++;
      if (d <= 0) return qs(alpha, beta, ply);
      if (pos.hm >= 100) return 0;
      const ms = pos.legal(); if (!ms.length) return chk ? -MATE + ply : 0;
      let best = -Infinity;
      for (const m of order(ms, ply, 0)) {
        pos.make(m); const v = -nm(d - 1, -beta, -alpha, ply + 1); pos.unmake();
        if (v > best) best = v; if (v > alpha) alpha = v;
        if (alpha >= beta) { if (!pos.b[(m >> 7) & 127] && !(m >> 14 & 7)) { const k = killers[ply] || (killers[ply] = [0, 0]); if (k[0] !== m) { k[1] = k[0]; k[0] = m; } hist[(m & 127) * 128 + ((m >> 7) & 127)] += d * d * 100; } break; }
      }
      return best;
    }
    const root = pos.legal().filter((m) => !(exclude && exclude.includes(m))); if (!root.length) return { move: 0, score: pos.inCheck() ? -MATE : 0, depth: 0, nodes: 0, none: true };
    let best = root[0], bs = 0, depth = 0, pvm = 0, allSc = null; const base = pos.st.length;
    try {
      for (let d = 1; d <= (maxDepth || 9); d++) {
        let alpha = -Infinity, cb = 0, cs = -Infinity; const scs = [];
        for (const m of order(root, 0, pvm)) {
          pos.make(m); const v = -nm(d - 1, -Infinity, all ? Infinity : -alpha, 1); pos.unmake(); scs.push({ m, v });
          if (v > cs) { cs = v; cb = m; } if (v > alpha && !all) alpha = v;
        }
        best = cb; bs = cs; depth = d; pvm = cb; if (all) allSc = scs;
        if (Math.abs(bs) > MATE - 100) break;
        if (Date.now() > dl) break;
      }
    } catch (e) { if (e !== STOP) throw e; while (pos.st.length > base) pos.unmake(); }
    return { move: best, score: bs, depth, nodes, ms: Date.now() - t0, all: allSc };
  }
  const E = { Pos, perft, search, evaluate, sqName, parseSq, CH, MATE, START: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' };
  if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.CE = E;
})(typeof self !== 'undefined' ? self : this);

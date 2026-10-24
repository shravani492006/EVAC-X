import { CELL, CELL_SIZE as CS, GRID_W as W, GRID_H as H, WORLD_W, WORLD_H, STATUS, STATUS_COLOR } from '../game/constants.js';
import { Mat3, transformPoints } from '../algorithms/transform.js';
import { liangBarsky, ClipStats } from '../algorithms/clipping.js';
import { hasLineOfSight } from '../algorithms/geometry.js';

const SS = 2; // static layer supersampling
const EXIT_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#fbbf24', '#60a5fa'];
const REFLECT_Y = Mat3.reflectY();
const COL = { room: '#12213d', roomAlt: '#142545', corridor: '#192c4c', corridorAlt: '#1b3050', door: '#2b4766', outdoor: '#0f2a27', outdoorAlt: '#112f2b', wall: '#04070d', wallEdge: '#4b6aa3' };

/**
 * Custom Canvas renderer. Layers: cached static building → danger heat → debris → exits → fire → smoke →
 * A* paths (Liang–Barsky clipped) → people → selection / tool preview / toasts.
 * World coordinates (960×600) are mapped to the screen by a 3×3 camera matrix (translate · scale).
 */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d');
    this.cam = { zoom: 1, panX: 0, panY: 0 };
    this.cssW = 960; this.cssH = 600; this.dpr = 1;
    this.clip = new ClipStats();
    this.staticLayer = null; this.staticFor = null; this.staticVersion = -1;
    this.embers = []; this.lastNow = 0;
    this._pts = [];
    this._makeSprites();
    this.resize();
  }

  /* ───────────── camera ───────────── */
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    this.cssW = Math.max(1, r.width); this.cssH = Math.max(1, r.height);
    this.canvas.width = Math.round(this.cssW * this.dpr); this.canvas.height = Math.round(this.cssH * this.dpr);
    this.clampPan();
  }
  get fit() { return Math.min(this.cssW / WORLD_W, this.cssH / WORLD_H); }
  get scale() { return this.fit * this.cam.zoom; }
  clampPan() {
    const s = this.scale, mx = Math.max(0, (WORLD_W * s - this.cssW) / 2), my = Math.max(0, (WORLD_H * s - this.cssH) / 2);
    this.cam.panX = Math.min(mx, Math.max(-mx, this.cam.panX)); this.cam.panY = Math.min(my, Math.max(-my, this.cam.panY));
  }
  /** World → CSS-pixel matrix: M = T(offset + pan) · S(fit · zoom). */
  matrix() {
    const s = this.scale;
    return Mat3.compose(Mat3.translation((this.cssW - WORLD_W * s) / 2 + this.cam.panX, (this.cssH - WORLD_H * s) / 2 + this.cam.panY), Mat3.scaling(s, s));
  }
  screenToWorld(px, py) { return this.matrix().inverse().apply(px, py); }
  zoomAt(factor, px, py) {
    const before = this.screenToWorld(px, py);
    this.cam.zoom = Math.min(4, Math.max(1, this.cam.zoom * factor));
    const s = this.scale;
    this.cam.panX = px - before.x * s - (this.cssW - WORLD_W * s) / 2;
    this.cam.panY = py - before.y * s - (this.cssH - WORLD_H * s) / 2;
    this.clampPan();
  }
  resetView() { this.cam = { zoom: 1, panX: 0, panY: 0 }; }
  panBy(dx, dy) { this.cam.panX += dx; this.cam.panY += dy; this.clampPan(); }
  visibleRect() {
    const inv = this.matrix().inverse(), a = inv.apply(0, 0), b = inv.apply(this.cssW, this.cssH);
    return { xmin: a.x, ymin: a.y, xmax: b.x, ymax: b.y };
  }

  /* ───────────── sprites ───────────── */
  _makeSprites() {
    const mk = (size, stops) => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
    };
    this.smokeSprite = mk(64, [[0, 'rgba(120,128,150,0.85)'], [0.55, 'rgba(90,98,120,0.4)'], [1, 'rgba(70,78,100,0)']]);
    this.glowSprite = mk(64, [[0, 'rgba(255,170,60,0.9)'], [0.4, 'rgba(255,90,20,0.35)'], [1, 'rgba(255,60,0,0)']]);
    const p = document.createElement('canvas'); p.width = p.height = 12;
    const g = p.getContext('2d'); g.fillStyle = '#1a1405'; g.fillRect(0, 0, 12, 12); g.fillStyle = '#f5b800';
    g.beginPath(); g.moveTo(0, 6); g.lineTo(6, 0); g.lineTo(12, 0); g.lineTo(0, 12); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(12, 6); g.lineTo(6, 12); g.lineTo(12, 12); g.closePath(); g.fill();
    this.hazardPattern = this.ctx.createPattern(p, 'repeat');
  }

  /* ───────────── static layer (cached) ───────────── */
  _paintStatic(sim) {
    const b = sim.building;
    if (!this.staticLayer) { this.staticLayer = document.createElement('canvas'); this.staticLayer.width = WORLD_W * SS; this.staticLayer.height = WORLD_H * SS; }
    const g = this.staticLayer.getContext('2d');
    g.setTransform(SS, 0, 0, SS, 0, 0);
    g.fillStyle = COL.wall; g.fillRect(0, 0, WORLD_W, WORLD_H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, t = b.grid[i], alt = (x + y) % 2 === 0;
      if (t === CELL.WALL) continue;
      let col = alt ? COL.room : COL.roomAlt;
      if (t === CELL.CORRIDOR) col = alt ? COL.corridor : COL.corridorAlt;
      else if (t === CELL.DOOR || t === CELL.EXIT) col = COL.door;
      else if (t === CELL.OUTDOOR || (t === CELL.OBSTACLE && b.trees.has(i))) col = alt ? COL.outdoor : COL.outdoorAlt;
      else if (t === CELL.OBSTACLE) {
        const nb = [b.typeAt(x + 1, y), b.typeAt(x - 1, y), b.typeAt(x, y + 1), b.typeAt(x, y - 1)];
        col = nb.includes(CELL.CORRIDOR) ? (alt ? COL.corridor : COL.corridorAlt) : (alt ? COL.room : COL.roomAlt);
      }
      g.fillStyle = col; g.fillRect(x * CS, y * CS, CS, CS);
    }
    // walls: lit edges
    g.strokeStyle = COL.wallEdge; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath();
    for (const s of b.wallSegments) { g.moveTo(s.a.x, s.a.y); g.lineTo(s.b.x, s.b.y); }
    g.stroke();
    // doors
    for (const d of b.doors) {
      const horiz = b.typeAt(d.x - 1, d.y) === CELL.WALL;  // door sits in a vertical wall run?
      g.fillStyle = '#35597d'; g.fillRect(d.x * CS, d.y * CS, CS, CS);
      g.strokeStyle = 'rgba(251,191,36,0.75)'; g.lineWidth = 1.4;
      g.beginPath();
      if (horiz) { g.moveTo(d.x * CS + CS / 2, d.y * CS + 1); g.lineTo(d.x * CS + CS / 2, d.y * CS + CS - 1); }
      else { g.moveTo(d.x * CS + 1, d.y * CS + CS / 2); g.lineTo(d.x * CS + CS - 1, d.y * CS + CS / 2); }
      g.stroke();
    }
    // furniture + trees
    for (const o of b.obstacles) {
      const x = o.x * CS, y = o.y * CS;
      if (b.trees.has(o.i)) {
        g.fillStyle = '#17482f'; g.beginPath(); g.arc(x + CS / 2, y + CS / 2, 8.5, 0, 7); g.fill();
        g.fillStyle = '#2a8a58'; g.beginPath(); g.arc(x + CS / 2 - 1.5, y + CS / 2 - 2, 5.5, 0, 7); g.fill();
      } else {
        g.fillStyle = '#2c4068'; g.beginPath(); g.roundRect(x + 2, y + 2, CS - 4, CS - 4, 3); g.fill();
        g.fillStyle = '#3f5a8f'; g.beginPath(); g.roundRect(x + 3, y + 3, CS - 6, 5, 2); g.fill();
      }
    }
    // room labels
    g.font = '600 9px "Chakra Petch", system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(150,185,255,0.28)';
    for (const r of [...b.rooms, ...b.corridors]) if (r.w * r.h > 40) g.fillText(r.name.toUpperCase(), (r.x + r.w / 2) * CS, (r.y + r.h / 2) * CS);
    this.staticFor = sim.building;
  }

  /* ───────────── helpers ───────────── */
  _smoothPoly(ctx, pts) {
    const n = pts.length; if (n < 3) return;
    ctx.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
    for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2); }
  }
  /** Flame outline: right half-profile + its mirror (Mat3.reflectY), then scaled/translated with a matrix. */
  _flame(ctx, cx, cy, size, phase, k, color) {
    const h = size * (0.85 + 0.3 * Math.sin(phase)) * k, w = size * 0.34 * (0.9 + 0.2 * Math.sin(phase * 1.3 + 1)), sway = Math.sin(phase * 0.7) * size * 0.12;
    const half = [[0, 0], [w * 0.8, -h * 0.08], [w, -h * 0.35], [w * 0.6, -h * 0.65], [sway * 0.5, -h]];
    const mirrored = transformPoints(REFLECT_Y, half.slice(1, -1)).reverse();
    const M = Mat3.compose(Mat3.translation(cx + sway * 0.3, cy + size * 0.45));
    const pts = transformPoints(M, [...half, ...mirrored]);
    ctx.fillStyle = color; ctx.beginPath(); this._smoothPoly(ctx, pts); ctx.fill();
  }
  _chevron(ctx, x, y, ang, s, fill) {
    const M = Mat3.compose(Mat3.translation(x, y), Mat3.rotation(ang), Mat3.scaling(s, s));
    const p = transformPoints(M, [[6.5, 0], [-3.5, 4.2], [-1, 0], [-3.5, -4.2]]);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y); for (let i = 1; i < 4; i++) ctx.lineTo(p[i].x, p[i].y); ctx.closePath(); ctx.fill();
  }
  _pathPoints(sim, p) {
    const pts = [{ x: p.position.x, y: p.position.y }];
    for (let k = p.pathIndex; k < p.path.length; k++) { const i = p.path[k]; pts.push({ x: (i % W) * CS + CS / 2 + p.offset.x, y: ((i / W) | 0) * CS + CS / 2 + p.offset.y }); }
    return pts;
  }

  /* ───────────── main render ───────────── */
  render(sim, ui = {}) {
    const ctx = this.ctx, dpr = this.dpr, t = sim.visualTime;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = Math.min(0.1, (now - (this.lastNow || now)) / 1000); this.lastNow = now;
    const b = sim.building;
    if (this.staticFor !== b) this._paintStatic(sim);

    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#04070e'; ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const [a, bb, c, d, e, f] = this.matrix().toCanvas();
    ctx.setTransform(a * dpr, bb * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
    ctx.drawImage(this.staticLayer, 0, 0, WORLD_W, WORLD_H);

    if (ui.showGrid) {
      ctx.strokeStyle = 'rgba(120,170,255,0.07)'; ctx.lineWidth = 0.5; ctx.beginPath();
      for (let x = 0; x <= W; x++) { ctx.moveTo(x * CS, 0); ctx.lineTo(x * CS, WORLD_H); }
      for (let y = 0; y <= H; y++) { ctx.moveTo(0, y * CS); ctx.lineTo(WORLD_W, y * CS); }
      ctx.stroke();
    }

    const fireList = [];
    // heat halo + debris -------------------------------------------------
    for (let i = 0; i < sim.N; i++) {
      const x = (i % W) * CS, y = ((i / W) | 0) * CS;
      if (sim.fireId[i] >= 0) { fireList.push(i); continue; }
      if (ui.showHeat !== false) {
        const fd = sim.fireDist[i];
        if (fd === 1 || fd === 2) { ctx.fillStyle = `rgba(255,70,20,${fd === 1 ? 0.13 : 0.06})`; ctx.fillRect(x, y, CS, CS); }
      }
      if (sim.blocked[i]) {
        ctx.fillStyle = this.hazardPattern; ctx.globalAlpha = 0.9; ctx.fillRect(x + 1, y + 1, CS - 2, CS - 2); ctx.globalAlpha = 1;
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1; ctx.strokeRect(x + 1.5, y + 1.5, CS - 3, CS - 3);
      }
    }

    this._drawExits(ctx, sim, t);

    // fire ----------------------------------------------------------------
    for (const i of fireList) { ctx.fillStyle = 'rgba(30,8,4,0.7)'; ctx.fillRect((i % W) * CS, ((i / W) | 0) * CS, CS, CS); }
    ctx.globalCompositeOperation = 'lighter';
    for (const i of fireList) {
      const k = Math.min(1, Math.max(0.15, (t - sim.fireBorn[i]) / 1.2)), cx = (i % W) * CS + CS / 2, cy = ((i / W) | 0) * CS + CS / 2;
      ctx.globalAlpha = 0.55 * k * (0.8 + 0.2 * Math.sin(t * 8 + i)); ctx.drawImage(this.glowSprite, cx - 30, cy - 30, 60, 60);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const cheap = fireList.length > 140;
    for (const i of fireList) {
      const k = Math.min(1, Math.max(0.2, (t - sim.fireBorn[i]) / 1.2)), cx = (i % W) * CS + CS / 2, cy = ((i / W) | 0) * CS + CS / 2, ph = t * 9 + i * 1.7;
      this._flame(ctx, cx, cy, CS * 1.05, ph, k, '#ff4d17');
      this._flame(ctx, cx, cy, CS * 1.05, ph + 1.1, k * 0.68, '#ff9d1a');
      if (!cheap) this._flame(ctx, cx, cy, CS * 1.05, ph + 2.3, k * 0.36, '#ffe27a');
    }
    // embers --------------------------------------------------------------
    if (fireList.length && this.embers.length < 120 && dt > 0) {
      for (let n = 0; n < 2; n++) { const i = fireList[(Math.random() * fireList.length) | 0]; this.embers.push({ x: (i % W) * CS + Math.random() * CS, y: ((i / W) | 0) * CS + CS * 0.5, vx: (Math.random() - 0.5) * 14, vy: -14 - Math.random() * 22, life: 0.8 + Math.random() * 0.8 }); }
    }
    ctx.globalCompositeOperation = 'lighter';
    this.embers = this.embers.filter((em) => {
      em.life -= dt; em.x += em.vx * dt; em.y += em.vy * dt; em.vx += (Math.random() - 0.5) * 20 * dt;
      if (em.life <= 0) return false;
      ctx.fillStyle = `rgba(255,${150 + (em.life * 80) | 0},60,${Math.min(1, em.life)})`; ctx.fillRect(em.x, em.y, 1.6, 1.6); return true;
    });
    ctx.globalCompositeOperation = 'source-over';

    // smoke ---------------------------------------------------------------
    for (let i = 0; i < sim.N; i++) {
      const s = sim.smoke[i]; if (s < 0.08) continue;
      const cx = (i % W) * CS + CS / 2, cy = ((i / W) | 0) * CS + CS / 2, ph = t * 0.6 + i * 0.37, size = 34 + s * 30;
      ctx.globalAlpha = Math.min(0.62, s * 0.75);
      ctx.drawImage(this.smokeSprite, cx - size / 2 + Math.sin(ph) * 5, cy - size / 2 - ((t * 4 + i * 3) % 9), size, size);
      ctx.globalAlpha *= 0.7;
      ctx.drawImage(this.smokeSprite, cx - size * 0.35 + Math.cos(ph * 1.3) * 6, cy - size * 0.35 + Math.sin(ph) * 4, size * 0.7, size * 0.7);
    }
    ctx.globalAlpha = 1;

    // clipping window + paths ----------------------------------------------
    this.clip.reset();
    const vis = this.visibleRect();
    let win = vis;
    if (ui.showClip) {
      const mx = (vis.xmax - vis.xmin) * 0.16, my = (vis.ymax - vis.ymin) * 0.16;
      win = { xmin: vis.xmin + mx, ymin: vis.ymin + my, xmax: vis.xmax - mx, ymax: vis.ymax - my };
    }
    this._drawPaths(ctx, sim, ui, win, t);
    if (ui.showClip) {
      ctx.save(); ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.4 / this.scale; ctx.setLineDash([8 / this.scale, 5 / this.scale]);
      ctx.strokeRect(win.xmin, win.ymin, win.xmax - win.xmin, win.ymax - win.ymin);
      ctx.setLineDash([]); ctx.fillStyle = '#22d3ee'; ctx.font = `700 ${10 / this.scale}px "Chakra Petch", sans-serif`; ctx.textAlign = 'left';
      ctx.fillText('LIANG-BARSKY CLIP WINDOW', win.xmin + 4 / this.scale, win.ymin - 4 / this.scale); ctx.restore();
    }
    sim.clipView = { tested: this.clip.tested, clipped: this.clip.clipped, rejected: this.clip.rejected, visible: this.clip.visible };
    if (sim.status === 'RUNNING') { const tt = sim.clipTotals; tt.tested += this.clip.tested; tt.clipped += this.clip.clipped; tt.rejected += this.clip.rejected; tt.visible += this.clip.visible; }

    this._drawPeople(ctx, sim, ui, t);
    this._drawOverlays(ctx, sim, ui, t, now);
  }

  _drawExits(ctx, sim, t) {
    for (const e of sim.building.exits) {
      const { x, y } = e.position, open = e.isOpen;
      const col = e.burning ? '#ff7a2f' : open ? '#34d399' : '#fb4b6a';
      const out = x < CS ? Math.PI : x > WORLD_W - CS ? 0 : y < CS ? -Math.PI / 2 : Math.PI / 2;
      ctx.fillStyle = open ? 'rgba(20,90,60,0.9)' : 'rgba(90,20,35,0.9)'; ctx.fillRect(x - CS / 2, y - CS / 2, CS, CS);
      if (open) {
        const pulse = 14 + 3 * Math.sin(t * 3 + e.id);
        ctx.globalCompositeOperation = 'lighter'; const gr = ctx.createRadialGradient(x, y, 2, x, y, pulse * 1.8);
        gr.addColorStop(0, 'rgba(52,211,153,0.55)'); gr.addColorStop(1, 'rgba(52,211,153,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 40, y - 40, 80, 80);
        ctx.globalCompositeOperation = 'source-over';
        // rotating beacon: spokes rotated by a 2D rotation matrix
        const R = Mat3.compose(Mat3.translation(x, y), Mat3.rotation(t * 2.2 + e.id));
        ctx.strokeStyle = 'rgba(167,243,208,0.8)'; ctx.lineWidth = 1.2; ctx.beginPath();
        for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2, p0 = R.apply(Math.cos(a) * 5, Math.sin(a) * 5), p1 = R.apply(Math.cos(a) * pulse * 0.62, Math.sin(a) * pulse * 0.62); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); }
        ctx.stroke();
      } else {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke();
      }
      this._chevron(ctx, x + Math.cos(out) * 11, y + Math.sin(out) * 11, out, 0.9, col);
      ctx.font = '700 8px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = col;
      ctx.fillText(`EXIT ${e.id + 1}`, x - Math.cos(out) * 20, y - Math.sin(out) * 17 + 3);
    }
  }

  _drawPaths(ctx, sim, ui, win, t) {
    const sel = ui.selectedId;
    const segs = [];
    const drawFor = (p, strong) => {
      if (p.done || !p.path.length || p.pathIndex > p.path.length) return;
      segs.length = 0;
      const pts = this._pathPoints(sim, p);
      for (let i = 0; i < pts.length - 1; i++) {
        const r = liangBarsky(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, win.xmin, win.ymin, win.xmax, win.ymax);
        this.clip.record(r); if (r.accepted) segs.push([r.x0, r.y0, r.x1, r.y1]);
      }
      const col = EXIT_COLORS[(p.targetExit ? p.targetExit.id : 0) % EXIT_COLORS.length];
      ctx.strokeStyle = col; ctx.globalAlpha = strong ? 1 : 0.22; ctx.lineWidth = strong ? 2.2 : 1;
      ctx.setLineDash(strong ? [6, 4] : []); ctx.lineDashOffset = strong ? -t * 24 : 0;
      ctx.beginPath(); for (const s of segs) { ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); } ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      if (strong) { // direction indicators: chevrons rotated along each path run
        for (let i = 3; i < pts.length - 1; i += 4) {
          const a = pts[i], b2 = pts[i + 1];
          if (a.x < win.xmin || a.x > win.xmax || a.y < win.ymin || a.y > win.ymax) continue;
          this._chevron(ctx, a.x, a.y, Math.atan2(b2.y - a.y, b2.x - a.x), 0.75, col);
        }
      }
    };
    if (ui.showPaths !== false) for (const p of sim.persons) if (p.id !== sel) drawFor(p, false);
    const sp = sim.persons.find((p) => p.id === sel); if (sp) drawFor(sp, true);
  }

  _drawPeople(ctx, sim, ui, t) {
    for (const p of sim.persons) {
      const { x, y } = p.position;
      if (p.dead) { ctx.strokeStyle = 'rgba(251,75,106,0.8)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 4, y - 4); ctx.lineTo(x + 4, y + 4); ctx.moveTo(x + 4, y - 4); ctx.lineTo(x - 4, y + 4); ctx.stroke(); continue; }
      if (p.done) continue;
      const col = STATUS_COLOR[p.status] || '#fff';
      const s = 1 + 0.25 * p.riskLevel + (p.status === STATUS.AT_RISK ? 0.12 * Math.sin(t * 10 + p.id) : 0);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x + 1, y + 1.5, 5.4 * s, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 5 * s, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(4,8,16,0.8)'; ctx.lineWidth = 1; ctx.stroke();
      this._chevron(ctx, x, y, p.heading, s * 0.72, '#04101e');
      if (p.health < 100) { ctx.strokeStyle = p.health > 50 ? '#34d399' : '#fb4b6a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 8 * s, -Math.PI / 2, -Math.PI / 2 + (p.health / 100) * Math.PI * 2); ctx.stroke(); }
      if (p.noRoute) { ctx.fillStyle = '#fb4b6a'; ctx.font = '700 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', x, y - 10); }
    }
  }

  _drawOverlays(ctx, sim, ui, t, now) {
    // selection + line-of-sight to exits (line-segment intersection against wall segments)
    const sp = sim.persons.find((p) => p.id === ui.selectedId);
    if (sp && !sp.done) {
      const { x, y } = sp.position;
      ctx.save(); ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.4; ctx.setLineDash([3, 3]); ctx.lineDashOffset = -t * 14;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, 7); ctx.stroke(); ctx.restore();
      for (const e of sim.building.exits) {
        if (!e.isOpen) continue;
        if (hasLineOfSight({ x, y }, e.position, sim.building.wallSegments)) {
          ctx.strokeStyle = 'rgba(52,211,153,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(e.position.x, e.position.y); ctx.stroke(); ctx.setLineDash([]);
        }
      }
      ctx.fillStyle = '#e8f1ff'; ctx.font = '700 9px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`P${sp.id}`, x, y - 16);
    }
    // tool preview
    const h = ui.hover;
    if (h && h.cx >= 0 && h.cy >= 0 && h.cx < W && h.cy < H && ui.toolColor) {
      ctx.strokeStyle = ui.toolColor; ctx.fillStyle = ui.toolColor + '33'; ctx.lineWidth = 1.5;
      if (ui.tool === 'extinguish') { ctx.fillRect((h.cx - 1) * CS, (h.cy - 1) * CS, CS * 3, CS * 3); ctx.strokeRect((h.cx - 1) * CS, (h.cy - 1) * CS, CS * 3, CS * 3); }
      else if (ui.tool === 'openExit' || ui.tool === 'closeExit') { ctx.beginPath(); ctx.arc(h.cx * CS + CS / 2, h.cy * CS + CS / 2, 90, 0, 7); ctx.stroke(); }
      else if (ui.tool !== 'select' && ui.tool !== 'pan') { ctx.fillRect(h.cx * CS, h.cy * CS, CS, CS); ctx.strokeRect(h.cx * CS, h.cy * CS, CS, CS); }
    }
    // floating toasts
    for (const ts of sim.toasts) {
      const age = (now - ts.born) / 1600; if (age >= 1) continue;
      const y = ts.y - 22 - age * 16, w = 98;
      ctx.globalAlpha = Math.min(1, (1 - age) * 1.6);
      ctx.fillStyle = 'rgba(40,10,16,0.92)'; ctx.strokeStyle = '#fb4b6a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(ts.x - w / 2, y - 12, w, 22, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff8a9b'; ctx.font = '700 8px "Chakra Petch", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(ts.text, ts.x, y - 2);
      ctx.fillStyle = '#ffd1d8'; ctx.font = '600 6.5px "Chakra Petch", sans-serif'; ctx.fillText(ts.sub, ts.x, y + 7);
      ctx.globalAlpha = 1;
    }
  }

  /** Nearest living person to a world point (for the SELECT tool). */
  pick(sim, wx, wy, radius = 14) {
    let best = null, bd = radius;
    for (const p of sim.persons) { if (p.done) continue; const d = Math.hypot(p.position.x - wx, p.position.y - wy); if (d < bd) { bd = d; best = p; } }
    return best;
  }
}

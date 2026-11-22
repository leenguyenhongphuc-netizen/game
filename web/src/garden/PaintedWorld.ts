// Vườn kiểu tranh vẽ nhìn chéo (2,5D): vẽ bằng Canvas 2D với các hình cắt sẵn ở /art/garden.
// Dùng cùng hệ toạ độ và cùng các phương thức công khai như World 3D để App không phải đổi gì.
import { CROPS, SPECIALTIES, processOf } from '../../../shared/catalog.ts';
import { PLOT_COLS, PLOT_ROWS, allowedTiles } from '../../../shared/rules.ts';
import { DECOR_ITEMS } from '../../../shared/custom.ts';
import type { Avatar } from '../../../shared/custom.ts';
import type { Context, LotData, WorldOptions, WorldState } from '../scene/World.ts';

const TILE = 2, PITCH = 24, ROAD_Z = 15.5, ROAD_HALF = 3;
const FENCE = { x: 9.6, back: -13.5, front: 8.5, gate: 1.8 };
const STALL = { x: 6.2, z: 10.6 };
const SLOTS: { k: number; s: 1 | -1 }[] = [
  { k: 0, s: 1 }, { k: -1, s: 1 }, { k: 1, s: 1 }, { k: 0, s: -1 }, { k: -1, s: -1 },
  { k: 1, s: -1 }, { k: -2, s: 1 }, { k: 2, s: 1 }, { k: -2, s: -1 }, { k: 2, s: -1 },
];
const MACHINE_SPOTS = [{ x: -5.5, z: 0.7 }, { x: -2.1, z: 0.7 }, { x: 2.1, z: 0.7 }, { x: 5.5, z: 0.7 }, { x: -5.5, z: 4.6 }, { x: 5.5, z: 4.6 }];
const BOUND = { x: 60, zMin: -20, zMax: 50 };
const S = 18; // điểm ảnh cho mỗi mét ở mức phóng 1
const FONT = '"Baloo 2", "Be Vietnam Pro", system-ui, sans-serif';

/** Bề ngang hình (mét trên mặt đất, đo theo cạnh ô vuông chân đế) và tỉ lệ neo đáy. */
const SIZE: Record<string, [number, number]> = {
  mai_ngoi: [6.6, 0.2], ba_gian: [6.8, 0.2], nha_san: [6.6, 0.16], mai_ton: [6.4, 0.2], sap: [3.8, 0.2], cong: [3.6, 0.1], xuong: [7.4, 0.2], kho: [4.6, 0.2],
  gieng: [2.3, 0.3], cay_rom: [2.8, 0.25], ao_sen: [4, 0.5], chuoi: [2.6, 0.12], dua: [3.2, 0.1], tre: [2.8, 0.1], xoai: [3.6, 0.12], chum: [1.5, 0.3], choi: [3.2, 0.2], thung: [1.9, 0.25],
  ga: [1.1, 0.2], cho: [0.9, 0.12], trau: [2.3, 0.15], vit: [1.2, 0.2], xe_tai: [3.8, 0.22], xe_may: [1.7, 0.15], nong_dan: [1.05, 0.04],
};
const HOUSE: Record<string, string> = { mai_ngoi: 'mai_ngoi', nha_san: 'nha_san', nha_ba_gian: 'ba_gian' };

function flip(slot: number, x: number, z: number) { const { k, s } = SLOTS[slot]; return s === 1 ? { x: x + k * PITCH, z } : { x: k * PITCH - x, z: 2 * ROAD_Z - z }; }
function toLocal(slot: number, X: number, Z: number) { const { k, s } = SLOTS[slot]; return s === 1 ? { x: X - k * PITCH, z: Z } : { x: k * PITCH - X, z: 2 * ROAD_Z - Z }; }
function tileLocal(tile: number) { const c = tile % PLOT_COLS, r = Math.floor(tile / PLOT_COLS); return { x: (c - (PLOT_COLS - 1) / 2) * TILE, z: (r - (PLOT_ROWS - 1) / 2) * TILE }; }
function isFactory(d: LotData | null) { return !!d && d.ownerRole === 'xuong' && d.kind !== 'rooftop'; }
function lotTiles(d: LotData) { return isFactory(d) ? [] : allowedTiles(d.kind ?? 'ground', d.ownerRole === undefined ? 'nong_dan' : d.ownerRole); }

class Vec {
  x = 0; y = 0; z = 0;
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v: { x: number; y?: number; z: number }) { this.x = v.x; this.y = v.y ?? 0; this.z = v.z; return this; }
  distanceTo(v: { x: number; z: number }) { return Math.hypot(this.x - v.x, this.z - v.z); }
}
interface Sprite { img: string; x: number; z: number; w?: number; flipX?: boolean; bob?: number; label?: string; labelBg?: string; alpha?: number; tile?: boolean; sign?: string; depth?: number }
interface Animal { img: string; x: number; z: number; tx: number; tz: number; wait: number; home: { x: number; z: number; r: number }; face: boolean }
type Preview = { item: string; x: number; z: number; rot: number; tone: 'ok' | 'bad' | 'pending' | 'select' };

export class PaintedWorld {
  paused = false;
  driving = false;
  readonly painted = true;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private imgs = new Map<string, HTMLImageElement>();
  private grass: CanvasPattern | null = null;
  private state: WorldState | null = null;
  private pos = new Vec(-7, 0, ROAD_Z + 0.5);
  private truckPos = new Vec(-5.5, 0, ROAD_Z - 1.7);
  private hasTruck = false;
  private walkTo: { x: number; z: number } | null = null;
  private face = false; private step = 0;
  private cam = { x: 0, z: 6 }; private pan = { x: 0, y: 0 }; private zoom = 1; private zoomBase = 1; private focus = false;
  private w = 1; private h = 1; private dpr = 1;
  private dirty = true; private raf = 0; private last = 0; private disposed = false;
  private ctxKey = ''; private ctx: Context = { kind: 'none' };
  private readyAt = new Map<number, number>();
  private sparks: { x: number; z: number; y: number; vx: number; vz: number; vy: number; life: number; color: string }[] = [];
  private floats: { x: number; z: number; text: string; bg: string; life: number }[] = [];
  private animals: Animal[] = [];
  private preview: Preview[] | null = null; private grid = false;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; moved: boolean }>();
  private pinch = 0;
  private keys = new Set<string>();
  private ro: ResizeObserver;
  private cleanup: (() => void)[] = [];
  private rain: { x: number; y: number; l: number }[] = [];
  /** Thời gian vẽ khung gần nhất (ms) — để đo. */
  drawMs = 0; frames = 0;

  constructor(private container: HTMLElement, private opts: WorldOptions) {
    this.canvas = document.createElement('canvas'); this.canvas.className = 'painted-canvas'; this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;display:block';
    container.appendChild(this.canvas);
    this.g = this.canvas.getContext('2d', { alpha: false })!;
    const co = new Image(); co.onload = () => { this.grass = this.g.createPattern(co, 'repeat'); this.dirty = true; }; co.src = '/art/garden/co.jpg';
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    this.bind();
    for (let i = 0; i < 70; i++) this.rain.push({ x: Math.random(), y: Math.random(), l: 10 + Math.random() * 14 });
    this.animals = [
      { img: 'ga', x: -7.5, z: 2, tx: -7.5, tz: 2, wait: 2, home: { x: -7.4, z: 1.5, r: 1.6 }, face: false },
      { img: 'vit', x: 8, z: 5.6, tx: 8, tz: 5.6, wait: 4, home: { x: 7.9, z: 5.4, r: 1.1 }, face: true },
      { img: 'cho', x: 2.6, z: 7.3, tx: 2.6, tz: 7.3, wait: 3, home: { x: 2.8, z: 7, r: 1.2 }, face: false },
    ];
    const loop = (t: number) => { if (this.disposed) return; this.raf = requestAnimationFrame(loop); this.tick(t); };
    this.raf = requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ hình
  private img(name: string): HTMLImageElement | null {
    let im = this.imgs.get(name);
    if (!im) { im = new Image(); im.decoding = 'async'; im.onload = () => { this.dirty = true; }; im.src = `/art/garden/${name}.webp`; this.imgs.set(name, im); }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }

  // ------------------------------------------------------------ giao diện công khai (giống World)
  setState(state: WorldState) { this.state = state; this.dirty = true; }
  setAvatar(_avatar: Avatar | null | undefined) { /* hình nhân vật vẽ sẵn, chưa đổi màu áo */ }
  setTruck(color: string | null) { this.hasTruck = color !== null; if (!this.hasTruck && this.driving) this.exitTruck(); this.dirty = true; }
  enterTruck() { if (!this.hasTruck || this.driving) return; this.driving = true; this.pos.copy(this.truckPos); this.walkTo = null; this.dirty = true; }
  exitTruck() { if (!this.driving) return; this.driving = false; this.truckPos.copy(this.pos); this.pos.set(this.pos.x, 0, ROAD_Z - ROAD_HALF - 0.6); this.walkTo = null; this.dirty = true; }
  private worldOfTile(lot: number, tile: number) { const l = tileLocal(tile); return flip(lot, l.x, l.z); }
  burst(lot: number, tile: number, kind: 'water' | 'soil' | 'leaf' | 'harvest') {
    const color = { water: '#6ecbff', soil: '#b5773f', leaf: '#7fe06a', harvest: '#ffd84a' }[kind], p = this.worldOfTile(lot, tile);
    for (let i = 0; i < 16; i++) this.sparks.push({ x: p.x + (Math.random() - 0.5) * 1.2, z: p.z + (Math.random() - 0.5) * 1.2, y: 0.4 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 3, life: 0.8 + Math.random() * 0.4, color });
    this.dirty = true;
  }
  floatText(lot: number, tile: number, text: string, bg = '#ffcf3a') { const p = this.worldOfTile(lot, tile); this.floats.push({ x: p.x, z: p.z, text, bg, life: 1.7 }); this.dirty = true; }
  goToTile(lot: number, tile: number) { this.walkTo = this.worldOfTile(lot, tile); }
  teleportToTile(lot: number, tile: number) { this.pos.copy(this.worldOfTile(lot, tile)); this.walkTo = null; this.recentre(); }
  teleportToMachine(lot: number, index: number) { const sp = MACHINE_SPOTS[Math.max(0, Math.min(MACHINE_SPOTS.length - 1, index))], w = flip(lot, sp.x, sp.z + 1.5); this.pos.set(w.x, 0, w.z); this.walkTo = null; this.recentre(); }
  goHome() { if (this.driving) this.exitTruck(); this.pos.set(0, 0, FENCE.front + 2.5); this.walkTo = null; this.recentre(); }
  position() { return { x: this.pos.x, z: this.pos.z }; }
  /** Đưa khung nhìn về lại nhân vật. */
  recentre() { this.pan.x = 0; this.pan.y = 0; this.cam.x = this.pos.x; this.cam.z = this.pos.z; this.dirty = true; }
  setZoom(k: number) { this.zoom = Math.min(1.6, Math.max(0.45, k)); this.dirty = true; }
  getZoom() { return this.zoom; }

  // chế độ xây dựng
  buildCanvas(): HTMLCanvasElement { return this.canvas; }
  screenToGround(clientX: number, clientY: number): { x: number; z: number } | null {
    const r = this.canvas.getBoundingClientRect(), k = S * this.scale(), o = this.origin();
    const u = (clientX - r.left - o.x) / k, v = (clientY - r.top - o.y) / (k / 2);
    return { x: (u + v) / 2, z: (v - u) / 2 };
  }
  cancelWalk() { this.walkTo = null; }
  buildFocus(on: boolean) { this.focus = on; if (on) { this.walkTo = null; this.pan.x = 0; this.pan.y = 0; } this.dirty = true; }
  buildPreview(items: Preview[] | null, grid = false) { this.preview = items; this.grid = grid; this.dirty = true; }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect(); for (const f of this.cleanup) f(); this.canvas.remove();
  }

  // ------------------------------------------------------------ khung nhìn
  private scale() { return (this.focus ? Math.min(this.zoomBase, Math.min(this.w / 44, this.h / 30) / S) : this.zoomBase * this.zoom); }
  private origin() {
    const k = S * this.scale(), c = this.focus ? { x: 0, z: -1.5 } : this.cam;
    return { x: this.w / 2 - (c.x - c.z) * k + this.pan.x, y: this.h * 0.56 - (c.x + c.z) * k / 2 + this.pan.y };
  }
  private resize() {
    this.w = this.container.clientWidth || 1; this.h = this.container.clientHeight || 1;
    let d = Math.min(window.devicePixelRatio || 1, 2); if (this.w * this.h * d * d > 2_400_000) d = Math.sqrt(2_400_000 / (this.w * this.h));
    this.dpr = d; this.canvas.width = Math.round(this.w * d); this.canvas.height = Math.round(this.h * d);
    this.zoomBase = Math.min(2.1, Math.max(1.25, Math.min(this.w, this.h) / 300)); this.dirty = true;
  }

  // ------------------------------------------------------------ điều khiển
  private bind() {
    const el = this.canvas;
    const on = (t: EventTarget, type: string, fn: (e: never) => void, o?: AddEventListenerOptions) => { t.addEventListener(type, fn as EventListener, o); this.cleanup.push(() => t.removeEventListener(type, fn as EventListener, o)); };
    on(el, 'pointerdown', (e: PointerEvent) => { try { el.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false }); if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    on(el, 'pointermove', (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 8) p.moved = true;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch > 0 && !this.focus) this.setZoom(this.zoom * d / this.pinch); this.pinch = d; a.moved = b.moved = true;
      } else if (p.moved && !this.focus) { this.pan.x += dx; this.pan.y += dy; this.dirty = true; }
    });
    const up = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId); this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinch = 0;
      if (!p || p.moved || performance.now() - p.t > 500 || this.focus || e.type === 'pointercancel') return;
      const gp = this.screenToGround(e.clientX, e.clientY); if (gp) this.tap(gp.x, gp.z);
    };
    on(el, 'pointerup', up); on(el, 'pointercancel', up);
    on(el, 'wheel', (e: WheelEvent) => { e.preventDefault(); this.setZoom(this.zoom * (e.deltaY > 0 ? 0.92 : 1.08)); }, { passive: false });
    on(window, 'keydown', (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return; this.keys.add(e.key.toLowerCase()); });
    on(window, 'keyup', (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); });
    on(window, 'blur', () => this.keys.clear());
  }
  /** Chạm một điểm trên mặt đất: bắt dính vào ô đất, sạp, máy, xe rồi đi tới đó. */
  private tap(x: number, z: number) {
    const st = this.state; let target = { x: Math.max(-BOUND.x, Math.min(BOUND.x, x)), z: Math.max(BOUND.zMin, Math.min(BOUND.zMax, z)) };
    if (st) for (let i = 0; i < SLOTS.length; i++) {
      const d = st.lots[i]; if (!d) continue; const l = toLocal(i, x, z);
      if (isFactory(d)) { let best = -1, bd = 1.9; MACHINE_SPOTS.forEach((m, k) => { const dd = Math.hypot(l.x - m.x, l.z - m.z + 0.5); if (dd < bd) { bd = dd; best = k; } }); if (best >= 0) { target = flip(i, MACHINE_SPOTS[best].x, MACHINE_SPOTS[best].z + 1.5); break; } }
      if (Math.abs(l.x) < PLOT_COLS && Math.abs(l.z) < PLOT_ROWS) {
        const tile = Math.floor((l.z + PLOT_ROWS) / TILE) * PLOT_COLS + Math.floor((l.x + PLOT_COLS) / TILE);
        if (lotTiles(d).includes(tile) || d.plantings.some((p) => p.tile === tile)) { target = this.worldOfTile(i, tile); break; }
      }
      if (Math.hypot(l.x - STALL.x, l.z - STALL.z) < 2.6) { target = flip(i, STALL.x, STALL.z + 1.6); break; }
    }
    if (this.hasTruck && !this.driving && Math.hypot(x - this.truckPos.x, z - this.truckPos.z) < 2.4) target = { x: this.truckPos.x + 1.2, z: this.truckPos.z + 1.2 };
    this.walkTo = target; this.pan.x = 0; this.pan.y = 0; this.dirty = true;
  }

  // ------------------------------------------------------------ vòng lặp
  private tick(t: number) {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016); this.last = t;
    if (this.paused) return;
    const now = Date.now() + (this.state?.clockOffset ?? 0);
    // di chuyển
    let mx = 0, mz = 0; const k = this.keys;
    if (k.has('w') || k.has('arrowup')) { mx -= 1; mz -= 1; } if (k.has('s') || k.has('arrowdown')) { mx += 1; mz += 1; }
    if (k.has('a') || k.has('arrowleft')) { mx -= 1; mz += 1; } if (k.has('d') || k.has('arrowright')) { mx += 1; mz -= 1; }
    const speed = this.driving ? 9 : 6.5;
    if (mx || mz) { const n = Math.hypot(mx, mz); this.walkTo = null; this.move(mx / n * speed * dt, mz / n * speed * dt); }
    else if (this.walkTo) {
      const dx = this.walkTo.x - this.pos.x, dz = this.walkTo.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.12) { this.pos.set(this.walkTo.x, 0, this.walkTo.z); this.walkTo = null; this.dirty = true; } else { const s = Math.min(d, speed * dt); this.move(dx / d * s, dz / d * s); }
    }
    // khung nhìn bám theo nhân vật
    const cx = this.cam.x + (this.pos.x - this.cam.x) * Math.min(1, dt * 5), cz = this.cam.z + (this.pos.z - this.cam.z) * Math.min(1, dt * 5);
    if (Math.abs(cx - this.cam.x) + Math.abs(cz - this.cam.z) > 0.002) { this.cam.x = cx; this.cam.z = cz; this.dirty = true; }
    // vật nuôi đi lại từng đợt
    for (const a of this.animals) {
      if (a.wait > 0) { a.wait -= dt; if (a.wait <= 0) { const an = Math.random() * 6.28, r = Math.random() * a.home.r; a.tx = a.home.x + Math.cos(an) * r; a.tz = a.home.z + Math.sin(an) * r; } continue; }
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
      if (d < 0.05) { a.wait = 3 + Math.random() * 6; continue; }
      const s = Math.min(d, 0.9 * dt); a.x += dx / d * s; a.z += dz / d * s; a.face = dx - dz < 0; this.dirty = true;
    }
    // hiệu ứng
    if (this.sparks.length) { for (const s of this.sparks) { s.life -= dt; s.vy -= 9 * dt; s.x += s.vx * dt; s.z += s.vz * dt; s.y = Math.max(0, s.y + s.vy * dt); } this.sparks = this.sparks.filter((s) => s.life > 0); this.dirty = true; }
    if (this.floats.length) { for (const f of this.floats) f.life -= dt; this.floats = this.floats.filter((f) => f.life > 0); this.dirty = true; }
    const wet = this.state?.weather === 'mua' || this.state?.weather === 'bao';
    if (wet) { for (const r of this.rain) { r.y += dt * 1.6; r.x -= dt * 0.25; if (r.y > 1) { r.y = 0; r.x = Math.random() * 1.2; } } this.dirty = true; }
    this.updateContext(now, t / 1000);
    if (Math.floor(now / 1000) !== Math.floor((now - dt * 1000) / 1000)) this.dirty = true; // mỗi giây vẽ lại một lần để cây kịp đổi trạng thái
    if (!this.dirty) return;
    this.dirty = false;
    const t0 = performance.now(); this.draw(now); this.drawMs = performance.now() - t0; this.frames++;
  }
  private move(dx: number, dz: number) {
    this.pos.x = Math.max(-BOUND.x, Math.min(BOUND.x, this.pos.x + dx)); this.pos.z = Math.max(BOUND.zMin, Math.min(BOUND.zMax, this.pos.z + dz));
    if (Math.abs(dx - dz) > 0.001) this.face = dx - dz < 0; this.step += Math.hypot(dx, dz); this.dirty = true;
  }
  private updateContext(now: number, t: number) {
    let ctx: Context = { kind: 'none' }; const st = this.state;
    if (st) for (let i = 0; i < SLOTS.length; i++) {
      const d = st.lots[i], l = toLocal(i, this.pos.x, this.pos.z), inside = Math.abs(l.x) < FENCE.x && l.z > FENCE.back && l.z < FENCE.front;
      if (!d) { if (i !== 0 && Math.abs(l.x) < FENCE.x && l.z > FENCE.back && l.z < FENCE.front + 3) ctx = { kind: 'empty-lot', lot: i }; continue; }
      if (isFactory(d) && inside) {
        const ms = d.factory?.machines ?? []; let best = -1, bd = 2.3;
        for (let k = 0; k <= Math.max(1, ms.length) && k < MACHINE_SPOTS.length; k++) { const dd = Math.hypot(l.x - MACHINE_SPOTS[k].x, l.z - MACHINE_SPOTS[k].z); if (dd < bd) { bd = dd; best = k; } }
        if (best >= 0) { ctx = { kind: 'machine', lot: i, index: best, machineId: ms[best]?.id ?? (ms.length === 0 && best === 0 ? 'co_ban' : null) }; continue; }
      }
      if (Math.abs(l.x) < PLOT_COLS && Math.abs(l.z) < PLOT_ROWS) {
        const tile = Math.floor((l.z + PLOT_ROWS) / TILE) * PLOT_COLS + Math.floor((l.x + PLOT_COLS) / TILE);
        if (!lotTiles(d).includes(tile) && !d.plantings.some((p) => p.tile === tile)) continue;
        ctx = { kind: 'tile', lot: i, tile };
        const planting = d.plantings.find((p) => p.tile === tile);
        if (planting && now >= planting.stepReadyAt && !this.opts.demo && (this.readyAt.get(planting.id) ?? 0) < t) { this.readyAt.set(planting.id, t + 1.5); this.opts.onReady?.(i, planting); }
      } else if (Math.hypot(l.x - STALL.x, l.z - (STALL.z + 1.6)) < 2.4) ctx = { kind: 'stall', lot: i };
    }
    if (ctx.kind === 'none' && this.hasTruck && !this.driving && this.pos.distanceTo(this.truckPos) < 3) ctx = { kind: 'truck' };
    const key = JSON.stringify(ctx);
    if (key !== this.ctxKey) { this.ctxKey = key; this.ctx = ctx; this.dirty = true; this.opts.onContext?.(ctx); }
  }

  // ------------------------------------------------------------ vẽ
  private draw(now: number) {
    const g = this.g, k = S * this.scale(), o = this.origin(), d = this.dpr, st = this.state;
    g.setTransform(d, 0, 0, d, 0, 0); g.imageSmoothingQuality = 'high';
    g.fillStyle = '#7dbb4e'; g.fillRect(0, 0, this.w, this.h);
    const P = (x: number, z: number) => ({ x: o.x + (x - z) * k, y: o.y + (x + z) * k / 2 });
    // ---- mặt đất: vẽ trong hệ toạ độ mặt đất (mét)
    g.save(); g.transform(k, k / 2, -k, k / 2, o.x, o.y);
    if (this.grass) { g.save(); const sc = 14 / 1024; g.scale(sc, sc); g.fillStyle = this.grass; g.fillRect(-90 / sc, -60 / sc, 180 / sc, 150 / sc); g.restore(); }
    const city = false;
    // đường làng và lối vào từng lô
    const road = (w: number, color: string) => { g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-70, ROAD_Z); g.lineTo(70, ROAD_Z); g.stroke(); };
    road(ROAD_HALF * 2 + 0.7, '#b98f55'); road(ROAD_HALF * 2, city ? '#b9bec6' : '#dcbf8a');
    g.strokeStyle = '#e9d2a2'; g.lineWidth = 0.18; g.setLineDash([1.2, 1.6]); g.beginPath(); g.moveTo(-70, ROAD_Z); g.lineTo(70, ROAD_Z); g.stroke(); g.setLineDash([]);
    for (let i = 0; i < SLOTS.length; i++) {
      const data = st?.lots[i] ?? null, L = (x: number, z: number) => flip(i, x, z);
      const line = (pts: [number, number][], w: number, color: string) => { g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], j) => { const p = L(x, z); if (j) g.lineTo(p.x, p.z); else g.moveTo(p.x, p.z); }); g.stroke(); };
      const poly = (pts: [number, number][], fill: string) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, z], j) => { const p = L(x, z); if (j) g.lineTo(p.x, p.z); else g.moveTo(p.x, p.z); }); g.closePath(); g.fill(); };
      const path: [number, number][] = [[0, ROAD_Z - ROAD_HALF], [0, FENCE.front - 2.2]];
      line(path, 2.9, '#b98f55'); line(path, 2.3, '#dcbf8a');
      if (data) {
        const yard: [number, number][] = [[-7.4, 6.3], [7.4, 6.3], [7.4, -6.2], [0, -6.2], [0, -8.2]];
        line(yard, 2.1, '#c9a468'); line(yard, 1.6, '#e3c995');
        line([[-7.4, 6.3], [-7.4, -6.2], [0, -6.2]], 2.1, '#c9a468'); line([[-7.4, 6.3], [-7.4, -6.2], [0, -6.2]], 1.6, '#e3c995');
        if (isFactory(data)) { poly([[-8.2, -1.6], [8.2, -1.6], [8.2, 6.6], [-8.2, 6.6]], '#cfd2d4'); g.strokeStyle = '#f2c230'; g.lineWidth = 0.14; const a = L(-8.2, -1.6), b = L(8.2, 6.6); g.strokeRect(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.abs(a.x - b.x), Math.abs(a.z - b.z)); }
        else if (lotTiles(data).length > 0) poly([[-6.5, -5.5], [6.5, -5.5], [6.5, 5.5], [-6.5, 5.5]], 'rgba(120,84,52,0.35)');
      }
      // hàng rào: bóng dưới đất
      line([[-FENCE.gate, FENCE.front], [-FENCE.x, FENCE.front], [-FENCE.x, FENCE.back], [FENCE.x, FENCE.back], [FENCE.x, FENCE.front], [FENCE.gate, FENCE.front]], 0.28, 'rgba(60,40,20,0.28)');
    }
    // ô đang đứng
    if (this.ctx.kind === 'tile') { const p = this.worldOfTile(this.ctx.lot, this.ctx.tile); g.strokeStyle = '#fff'; g.lineWidth = 0.16; g.strokeRect(p.x - 0.95, p.z - 0.95, 1.9, 1.9); g.strokeStyle = '#ffd23f'; g.lineWidth = 0.08; g.strokeRect(p.x - 1.05, p.z - 1.05, 2.1, 2.1); }
    if (this.walkTo) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(this.walkTo.x, this.walkTo.z, 0.35, 0, 6.3); g.fill(); }
    // lưới và bóng xem trước của chế độ xây dựng
    if (this.grid) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.03; g.beginPath(); for (let x = -FENCE.x; x <= FENCE.x + 0.01; x += 0.5) { g.moveTo(x, FENCE.back); g.lineTo(x, FENCE.front); } for (let z = FENCE.back; z <= FENCE.front + 0.01; z += 0.5) { g.moveTo(-FENCE.x, z); g.lineTo(FENCE.x, z); } g.stroke(); }
    if (this.preview) for (const p of this.preview) { g.fillStyle = { ok: 'rgba(90,220,110,0.5)', bad: 'rgba(240,70,60,0.55)', pending: 'rgba(255,255,255,0.45)', select: 'rgba(255,210,63,0.6)' }[p.tone]; g.beginPath(); g.arc(p.x, p.z, 0.7, 0, 6.3); g.fill(); }
    g.restore();

    // ---- hàng rào (thanh ngang nổi lên) và các hình, sắp theo chiều sâu
    const list: Sprite[] = [];
    const add = (i: number, img: string, x: number, z: number, extra: Partial<Sprite> = {}) => { const w = flip(i, x, z); list.push({ img, x: w.x, z: w.z, ...extra }); };
    const bubbles: { x: number; z: number; icon: string; bg: string }[] = [];
    if (st) for (let i = 0; i < SLOTS.length; i++) {
      const data = st.lots[i];
      if (!data) { if (i !== 0) { const w = flip(i, 0, FENCE.front + 1.6); list.push({ img: '', x: w.x, z: w.z, sign: 'Đất trống · mời bạn' }); } continue; }
      const fac = isFactory(data), style = data.style;
      add(i, fac ? 'xuong' : HOUSE[style?.house ?? 'mai_ngoi'] ?? 'mai_ngoi', fac ? -2.5 : 0, -10.4);
      if (!fac) add(i, 'kho', 6.4, -10.6);
      add(i, 'cong', 0, FENCE.front + 0.2, { label: style?.gateName || (data.mine ? 'Vườn nhà' : `Vườn ${data.ownerName}`) });
      add(i, 'sap', STALL.x, STALL.z, { label: style?.stallName || undefined, labelBg: '#fff' });
      add(i, 'gieng', -8, -9.8); add(i, 'cay_rom', 8.2, -4); add(i, 'ao_sen', 8, 5.6, { depth: -3 }); add(i, 'chum', -8.4, -6.4);
      add(i, 'xoai', -8.6, 7); add(i, 'chuoi', -11.2, -11.5); add(i, 'dua', 11.2, -11.8); add(i, 'tre', -11.4, 2); add(i, 'dua', 11.4, 3.5); add(i, 'xoai', 4.6, -14.6); add(i, 'chuoi', -5, -14.8);
      if (fac) {
        const ms = data.factory?.machines?.length ? data.factory.machines : [{ id: 'co_ban', kind: 'may_say', name: 'Máy sấy' }];
        MACHINE_SPOTS.forEach((m, kx) => { const mc = ms[kx]; if (mc) add(i, 'thung', m.x, m.z, { label: mc.name, labelBg: '#fff' }); else if (kx === ms.length) { const w = flip(i, m.x, m.z); bubbles.push({ x: w.x, z: w.z, icon: '＋', bg: '#ffffffcc' }); } });
        add(i, 'thung', 7.4, -5.2); add(i, 'thung', -7.6, -3.4);
      } else {
        const tiles = new Set(lotTiles(data)); for (const p of data.plantings) tiles.add(p.tile);
        const byTile = new Map(data.plantings.map((p) => [p.tile, p]));
        for (const tile of tiles) {
          const l = tileLocal(tile), p = byTile.get(tile); let img = 'cu_0';
          if (p) {
            const sp = SPECIALTIES[p.specialtyId], crop = sp ? CROPS[sp.crop] : undefined, n = crop ? processOf(crop).length : 6, ready = now >= p.stepReadyAt, last = p.stepIndex >= n - 1;
            const stage = last && ready ? 4 : p.stepIndex <= 0 ? (ready ? 0 : 1) : Math.min(3, 1 + Math.round(p.stepIndex / Math.max(1, n - 1) * 2));
            img = `${crop?.kind ?? 'ngan'}_${stage}`;
            if (ready && (data.mine || data.friend)) { const w = flip(i, l.x, l.z); bubbles.push({ x: w.x, z: w.z, icon: last ? '🧺' : '⭐', bg: last ? '#fff7d6' : '#fff' }); }
          }
          add(i, img, l.x, l.z, { tile: true });
        }
      }
      for (const dcr of data.decor ?? []) { const it = DECOR_ITEMS.find((x) => x.id === dcr.item); add(i, dcr.item === 'chum_nuoc' ? 'chum' : '', dcr.x, dcr.z, { sign: dcr.item === 'chum_nuoc' ? undefined : it?.emoji ?? '🪴', depth: 0.01 }); }
      if (i === 0) for (const a of this.animals) add(0, a.img, a.x, a.z, { flipX: a.face });
    }
    if (this.preview) for (const p of this.preview) { const it = DECOR_ITEMS.find((x) => x.id === p.item); list.push({ img: p.item === 'chum_nuoc' ? 'chum' : '', x: p.x, z: p.z, sign: p.item === 'chum_nuoc' ? undefined : it?.emoji ?? '🪴', alpha: p.tone === 'bad' ? 0.6 : 0.9 }); }
    if (this.hasTruck) { const tp = this.driving ? this.pos : this.truckPos; list.push({ img: 'xe_tai', x: tp.x, z: tp.z, flipX: this.driving && this.face }); }
    if (!this.driving) list.push({ img: 'nong_dan', x: this.pos.x, z: this.pos.z, flipX: this.face, bob: this.walkTo || this.keys.size ? Math.abs(Math.sin(this.step * 2.4)) * 0.18 : 0, depth: 0.2 });
    list.sort((a, b) => (a.x + a.z + (a.depth ?? 0)) - (b.x + b.z + (b.depth ?? 0)));

    // thanh rào phía sau vẽ trước các hình, phía trước vẽ sau
    const rail = (i: number, pts: [number, number][]) => {
      const hgt = 0.55 * k;
      for (const [off, color, lw] of [[hgt, '#fbf7ee', 0.13], [hgt * 0.5, '#efe7d6', 0.11]] as [number, string, number][]) { g.strokeStyle = color; g.lineWidth = Math.max(1.5, lw * k); g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, z], j) => { const w = flip(i, x, z), p = P(w.x, w.z); if (j) g.lineTo(p.x, p.y - off); else g.moveTo(p.x, p.y - off); }); g.stroke(); }
      g.strokeStyle = '#e4d9c3'; g.lineWidth = Math.max(1.5, 0.12 * k);
      for (let j = 0; j < pts.length - 1; j++) { const [x0, z0] = pts[j], [x1, z1] = pts[j + 1], n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.6)); for (let q = 0; q <= n; q++) { const w = flip(i, x0 + (x1 - x0) * q / n, z0 + (z1 - z0) * q / n), p = P(w.x, w.z); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y - hgt * 1.25); g.stroke(); } }
    };
    for (let i = 0; i < SLOTS.length; i++) { const sgn = SLOTS[i].s; rail(i, sgn === 1 ? [[-FENCE.x, FENCE.front], [-FENCE.x, FENCE.back], [FENCE.x, FENCE.back]] : [[FENCE.x, FENCE.back], [FENCE.x, FENCE.front], [FENCE.gate, FENCE.front]]); if (sgn !== 1) rail(i, [[-FENCE.gate, FENCE.front], [-FENCE.x, FENCE.front]]); }
    for (const s of list) this.sprite(s, P, k);
    for (let i = 0; i < SLOTS.length; i++) { const sgn = SLOTS[i].s; if (sgn === 1) { rail(i, [[FENCE.x, FENCE.back], [FENCE.x, FENCE.front], [FENCE.gate, FENCE.front]]); rail(i, [[-FENCE.gate, FENCE.front], [-FENCE.x, FENCE.front]]); } else rail(i, [[-FENCE.x, FENCE.front], [-FENCE.x, FENCE.back], [FENCE.x, FENCE.back]]); }

    // bong bóng trạng thái trên ô
    for (const b of bubbles) { const p = P(b.x, b.z), r = Math.max(10, 0.5 * k), y = p.y - 2.5 * k; g.fillStyle = 'rgba(40,25,10,0.25)'; g.beginPath(); g.arc(p.x, y + 2, r, 0, 6.3); g.fill(); g.fillStyle = b.bg; g.strokeStyle = '#7a4a1e'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, y, r, 0, 6.3); g.fill(); g.stroke(); g.font = `${Math.round(r * 1.15)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#7a4a1e'; g.fillText(b.icon, p.x, y + 1); }
    // hạt và chữ bay
    for (const s of this.sparks) { const p = P(s.x, s.z); g.globalAlpha = Math.min(1, s.life * 2); g.fillStyle = s.color; g.beginPath(); g.arc(p.x, p.y - s.y * k, Math.max(2, 0.12 * k), 0, 6.3); g.fill(); } g.globalAlpha = 1;
    for (const f of this.floats) { const p = P(f.x, f.z), y = p.y - (2.2 + (1.7 - f.life) * 1.3) * k; g.globalAlpha = Math.min(1, f.life * 1.5); this.pill(f.text, p.x, y, f.bg, 13); } g.globalAlpha = 1;

    // ---- ngày đêm và thời tiết
    const hour = this.opts.hour ?? ((new Date(now).getHours()) + new Date(now).getMinutes() / 60);
    const night = !(hour >= 5.3 && hour < 18.6), dusk = (hour >= 5.3 && hour < 7) || (hour >= 16.5 && hour < 18.6), w = st?.weather;
    if (night) { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#6f83c9'; g.fillRect(0, 0, this.w, this.h); g.globalCompositeOperation = 'lighter';
      if (st) for (let i = 0; i < SLOTS.length; i++) if (st.lots[i]) { const wp = flip(i, 0, -9.2), p = P(wp.x, wp.z), r = 3.2 * k, grd = g.createRadialGradient(p.x, p.y - 1.4 * k, 0, p.x, p.y - 1.4 * k, r); grd.addColorStop(0, 'rgba(255,214,120,0.55)'); grd.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = grd; g.fillRect(p.x - r, p.y - 1.4 * k - r, r * 2, r * 2); }
      g.globalCompositeOperation = 'source-over'; }
    else if (dusk) { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#ffd9b0'; g.fillRect(0, 0, this.w, this.h); g.globalCompositeOperation = 'source-over'; }
    if (w === 'mua' || w === 'bao' || w === 'may') { g.fillStyle = w === 'may' ? 'rgba(120,135,150,0.14)' : w === 'bao' ? 'rgba(70,85,105,0.34)' : 'rgba(95,115,140,0.24)'; g.fillRect(0, 0, this.w, this.h); }
    if (w === 'mua' || w === 'bao') { g.strokeStyle = 'rgba(225,240,255,0.6)'; g.lineWidth = 1.4; g.beginPath(); const n = w === 'bao' ? this.rain.length : Math.round(this.rain.length * 0.6); for (let i = 0; i < n; i++) { const r = this.rain[i], x = r.x * this.w * 1.2 - this.w * 0.1, y = r.y * this.h; g.moveTo(x, y); g.lineTo(x - r.l * 0.3, y + r.l); } g.stroke(); }
    if (w === 'nang_gat') { g.fillStyle = 'rgba(255,225,140,0.12)'; g.fillRect(0, 0, this.w, this.h); }
  }

  private pill(text: string, x: number, y: number, bg: string, size: number) {
    const g = this.g; g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(text).width + size * 1.1, h = size * 1.7;
    g.fillStyle = bg; g.strokeStyle = '#7a4a1e'; g.lineWidth = 2; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fill(); g.stroke();
    g.fillStyle = '#4b2c0f'; g.fillText(text, x, y + 1);
  }
  private sprite(s: Sprite, P: (x: number, z: number) => { x: number; y: number }, k: number) {
    const g = this.g, p = P(s.x, s.z);
    if (p.x < -260 * this.scale() || p.x > this.w + 260 * this.scale() || p.y < -60 || p.y > this.h + 320 * this.scale()) return;
    if (s.alpha !== undefined) g.globalAlpha = s.alpha;
    if (!s.img) { // biển gỗ hoặc món chỉ có biểu tượng
      if (s.sign && s.sign.length <= 3) { g.font = `${Math.round(1.5 * k)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(40,25,10,0.25)'; g.beginPath(); g.ellipse(p.x, p.y, 0.6 * k, 0.3 * k, 0, 0, 6.3); g.fill(); g.fillStyle = '#000'; g.fillText(s.sign, p.x, p.y + 0.1 * k); }
      else if (s.sign) { g.strokeStyle = '#7a4a1e'; g.lineWidth = Math.max(2, 0.16 * k); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y - 1.5 * k); g.stroke(); this.pill(s.sign, p.x, p.y - 1.7 * k, '#f6e3b4', Math.max(10, Math.round(0.62 * k))); }
      g.globalAlpha = 1; return;
    }
    const im = this.img(s.img); if (!im) { g.globalAlpha = 1; return; }
    let w: number, x: number, y: number, h: number;
    if (s.tile) { w = TILE * 2 * k * 1.05; h = w * im.naturalHeight / im.naturalWidth; x = p.x - w / 2; y = p.y - h + 0.35 * w; }
    else { const [m, an] = SIZE[s.img] ?? [2, 0.15]; w = m * 2 * k * 0.8; h = w * im.naturalHeight / im.naturalWidth; x = p.x - w / 2; y = p.y - h + h * an - (s.bob ?? 0) * k; }
    if (s.img === 'nong_dan') { g.fillStyle = 'rgba(40,25,10,0.28)'; g.beginPath(); g.ellipse(p.x, p.y, 0.45 * k, 0.22 * k, 0, 0, 6.3); g.fill(); }
    if (s.flipX) { g.save(); g.translate(p.x * 2, 0); g.scale(-1, 1); g.drawImage(im, x, y, w, h); g.restore(); } else g.drawImage(im, x, y, w, h);
    g.globalAlpha = 1;
    if (s.label) {
      if (s.img === 'cong') { // viết tên vườn lên tấm bảng trống của cổng
        const size = Math.max(8, Math.min(w * 0.085, w * 0.62 / Math.max(4, s.label.length) * 1.7)); g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#5a3412'; g.fillText(s.label, x + w * 0.5, y + h * 0.335, w * 0.4);
      } else this.pill(s.label, p.x, y - 4, s.labelBg ?? '#f6e3b4', Math.max(10, Math.round(0.6 * k)));
    }
  }
}

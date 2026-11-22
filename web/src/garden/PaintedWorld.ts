// Vườn kiểu tranh vẽ nhìn chéo (2,5D): vẽ bằng Canvas 2D với các hình cắt sẵn ở /art/garden.
// Dùng cùng hệ toạ độ và cùng các phương thức công khai như World 3D để App không phải đổi gì.
import { CROPS, REGIONS, SPECIALTIES, processOf } from '../../../shared/catalog.ts';
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
  ga: [1.1, 0.2], cho: [0.9, 0.12], trau: [2.3, 0.15], vit: [1.2, 0.2], xe_tai: [3.8, 0.22], xe_tai_t: [3.8, 0.2], xe_tai_p: [3.8, 0.2], xe_may: [1.7, 0.15], nong_dan: [1.05, 0.04],
  may_say: [1.9, 0.12], may_ep: [1.7, 0.12], may_rang_xay: [1.8, 0.1], day_chuyen_mut: [2.3, 0.12], kho_lanh: [2.1, 0.12], may_dong_goi: [2.1, 0.1], may_rua: [2.4, 0.12], pallet: [1.6, 0.2],
  chau_hoa: [1.2, 0.12], den_long: [1.1, 0.06], bu_nhin: [1.5, 0.1], cot_co: [1.3, 0.06], ban_ghe: [2, 0.2], xich_du: [2.2, 0.12], cay_mai: [1.9, 0.08], cay_dao: [1.9, 0.08], ao_ca: [2.6, 0.5],
  bon_nuoc: [1.5, 0.06], gian_phoi: [2.6, 0.25],
};
const DECOR_IMG: Record<string, string> = { chum_nuoc: 'chum' };
const TALL = new Set(['chuoi', 'dua', 'tre', 'xoai', 'cay_mai', 'cay_dao']);
const CHARS = new Set(['dung_tt', 'dung_tp', 'dung_st', 'dung_sp', 'di_tt', 'di_tp', 'di_st', 'di_sp', 'nong_dan']);
/** Hình máy theo `kind` của máy chủ; tên lạ thì đoán theo từ khoá, không ra thì dùng chồng thùng. */
function machineImg(m: { kind: string; name: string }): string {
  if (SIZE[m.kind] && m.kind.startsWith('may') || m.kind === 'day_chuyen_mut' || m.kind === 'kho_lanh') return m.kind;
  const t = `${m.kind} ${m.name}`.toLowerCase();
  if (/sấy|say/.test(t)) return 'may_say'; if (/ép|ep/.test(t)) return 'may_ep'; if (/rang|xay/.test(t)) return 'may_rang_xay'; if (/hộp|hũ|mứt|mut|hop/.test(t)) return 'day_chuyen_mut';
  if (/lạnh|lanh/.test(t)) return 'kho_lanh'; if (/gói|goi|chân không/.test(t)) return 'may_dong_goi'; if (/rửa|rua|phân loại/.test(t)) return 'may_rua';
  return 'thung';
}
function machineState(m: { jobs?: { doneAt?: number; done?: boolean }[] }, now: number): 'idle' | 'run' | 'done' {
  const jobs = m.jobs ?? []; if (jobs.some((j) => j.done || (j.doneAt !== undefined && j.doneAt <= now))) return 'done'; return jobs.length ? 'run' : 'idle';
}
// lưới va chạm: ô 0,5 m phủ cả xóm
const CELL = 0.5, GX0 = -62, GZ0 = -22, GW = 248, GH = 150;
type Act = { type: 'tile'; lot: number; tile: number } | { type: 'stall'; lot: number } | { type: 'machine'; lot: number; index: number } | { type: 'truck' };
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
interface Sprite { img: string; x: number; z: number; sc?: number; flipX?: boolean; bob?: number; label?: string; labelBg?: string; alpha?: number; tile?: boolean; sign?: string; depth?: number; act?: Act; sway?: boolean; shake?: boolean; lift?: number; char?: boolean }
interface Animal { img: string; x: number; z: number; tx: number; tz: number; wait: number; home: { x: number; z: number; r: number }; face: boolean }
type Preview = { item: string; x: number; z: number; rot: number; tone: 'ok' | 'bad' | 'pending' | 'select' };

export class PaintedWorld {
  paused = false;
  driving = false;
  readonly painted = true;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private imgs = new Map<string, HTMLCanvasElement | null>();
  private tints = new Map<string, HTMLCanvasElement>();
  private shirt: string | null = null;
  private blocked = new Uint8Array(GW * GH);
  private path: { x: number; z: number }[] = [];
  private hits: { x: number; y: number; w: number; h: number; flip: boolean; c: HTMLCanvasElement; act: Act }[] = [];
  private labels: { text: string; x: number; y: number; bg: string; size: number }[] = [];
  private time = 0; private ambientAt = 0; private movedAt = -9; private faceRight = false; private faceFront = true;
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
  private img(name: string): HTMLCanvasElement | null {
    if (this.imgs.has(name)) return this.imgs.get(name) ?? null;
    this.imgs.set(name, null);
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { this.imgs.set(name, this.clean(im, CHARS.has(name))); this.dirty = true; };
    im.src = `/art/garden/${name}.webp`;
    return null;
  }
  /** Gột viền trắng còn sót quanh hình: loang từ vùng trong suốt vào các điểm gần trắng (nhân vật: loang hết để mất mảng bóng trắng dưới chân; hình khác: chỉ 2 điểm ảnh). */
  private clean(im: HTMLImageElement, deep: boolean): HTMLCanvasElement {
    const c = document.createElement('canvas'), W = c.width = im.naturalWidth, H = c.height = im.naturalHeight, g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(im, 0, 0);
    try {
      const d = g.getImageData(0, 0, W, H), px = d.data, seen = new Uint8Array(W * H); let front: number[] = [];
      for (let i = 0; i < W * H; i++) if (px[i * 4 + 3] < 24) { px[i * 4 + 3] = 0; seen[i] = 1; front.push(i); }
      const white = (i: number) => { const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2], mn = Math.min(r, gg, b); return mn > (deep ? 205 : 225) && Math.max(r, gg, b) - mn < 26; };
      for (let depth = 0; front.length && depth < (deep ? 400 : 2); depth++) {
        const next: number[] = [];
        for (const i of front) { const x = i % W; for (const j of [i - 1, i + 1, i - W, i + W]) { if (j < 0 || j >= W * H || seen[j] || (j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue; if (white(j)) { seen[j] = 1; px[j * 4 + 3] = 0; next.push(j); } } }
        front = next;
      }
      g.putImageData(d, 0, 0);
    } catch { /* không đọc được điểm ảnh thì dùng hình gốc */ }
    return c;
  }
  /** Hình nhân vật đã đổi màu áo theo lựa chọn của người chơi. */
  private charImg(name: string): HTMLCanvasElement | null {
    const base = this.img(name); if (!base || !this.shirt) return base;
    const key = `${name}|${this.shirt}`, hit = this.tints.get(key); if (hit) return hit;
    const m = /^#?([0-9a-f]{6})$/i.exec(this.shirt); if (!m) return base;
    const tr = parseInt(m[1].slice(0, 2), 16), tg = parseInt(m[1].slice(2, 4), 16), tb = parseInt(m[1].slice(4, 6), 16);
    const c = document.createElement('canvas'); c.width = base.width; c.height = base.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(base, 0, 0);
    try {
      const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
      for (let i = 0; i < px.length; i += 4) { const r = px[i], gg = px[i + 1], b = px[i + 2]; if (px[i + 3] > 0 && b > 70 && b > r * 1.35 && b > gg * 1.12) { const l = Math.max(0.35, Math.min(1.45, (0.3 * r + 0.59 * gg + 0.11 * b) / 96)); px[i] = Math.min(255, tr * l); px[i + 1] = Math.min(255, tg * l); px[i + 2] = Math.min(255, tb * l); } }
      g.putImageData(d, 0, 0);
    } catch { return base; }
    this.tints.set(key, c); return c;
  }

  // ------------------------------------------------------------ giao diện công khai (giống World)
  setState(state: WorldState) { this.state = state; this.rebuildGrid(); this.dirty = true; }
  setAvatar(avatar: Avatar | null | undefined) { this.shirt = avatar?.shirt ?? null; this.dirty = true; }
  setTruck(color: string | null) { this.hasTruck = color !== null; if (!this.hasTruck && this.driving) this.exitTruck(); this.dirty = true; }
  enterTruck() { if (!this.hasTruck || this.driving) return; this.driving = true; this.pos.copy(this.truckPos); this.walkTo = null; this.path = []; this.dirty = true; }
  exitTruck() { if (!this.driving) return; this.driving = false; this.truckPos.copy(this.pos); this.pos.set(this.pos.x, 0, ROAD_Z - ROAD_HALF - 0.6); this.walkTo = null; this.dirty = true; }
  private worldOfTile(lot: number, tile: number) { const l = tileLocal(tile); return flip(lot, l.x, l.z); }
  burst(lot: number, tile: number, kind: 'water' | 'soil' | 'leaf' | 'harvest') {
    const color = { water: '#6ecbff', soil: '#b5773f', leaf: '#7fe06a', harvest: '#ffd84a' }[kind], p = this.worldOfTile(lot, tile);
    for (let i = 0; i < 16; i++) this.sparks.push({ x: p.x + (Math.random() - 0.5) * 1.2, z: p.z + (Math.random() - 0.5) * 1.2, y: 0.4 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 3, vz: (Math.random() - 0.5) * 3, vy: 3 + Math.random() * 3, life: 0.8 + Math.random() * 0.4, color });
    this.dirty = true;
  }
  floatText(lot: number, tile: number, text: string, bg = '#ffcf3a') { const p = this.worldOfTile(lot, tile); this.floats.push({ x: p.x, z: p.z, text, bg, life: 1.7 }); this.dirty = true; }
  goToTile(lot: number, tile: number) { const w = this.worldOfTile(lot, tile); this.go(w.x + 0.6, w.z + 0.6); }
  teleportToTile(lot: number, tile: number) { this.pos.copy(this.worldOfTile(lot, tile)); this.walkTo = null; this.path = []; this.recentre(); }
  teleportToMachine(lot: number, index: number) { const sp = MACHINE_SPOTS[Math.max(0, Math.min(MACHINE_SPOTS.length - 1, index))], w = flip(lot, sp.x, sp.z + 1.5); this.pos.set(w.x, 0, w.z); this.walkTo = null; this.path = []; this.recentre(); }
  goHome() { if (this.driving) this.exitTruck(); this.pos.set(0, 0, FENCE.front + 2.5); this.walkTo = null; this.path = []; this.recentre(); }
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
  cancelWalk() { this.walkTo = null; this.path = []; }
  buildFocus(on: boolean) { this.focus = on; if (on) { this.walkTo = null; this.path = []; this.pan.x = 0; this.pan.y = 0; } this.dirty = true; }
  buildPreview(items: Preview[] | null, grid = false) { this.preview = items; this.grid = grid; this.dirty = true; }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect(); for (const f of this.cleanup) f(); this.canvas.remove();
  }

  // ------------------------------------------------------------ va chạm và tìm đường
  private cellOf(x: number, z: number) { const cx = Math.floor((x - GX0) / CELL), cz = Math.floor((z - GZ0) / CELL); return cx < 0 || cz < 0 || cx >= GW || cz >= GH ? -1 : cz * GW + cx; }
  private isBlocked(x: number, z: number) { const c = this.cellOf(x, z); return c < 0 || this.blocked[c] === 1; }
  /** Dựng lại lưới vật cản từ bố cục các lô: rào, nhà, kho, sạp, giếng, ao, máy, đồ trang trí. */
  private rebuildGrid() {
    const b = this.blocked; b.fill(0); const st = this.state, pad = 0.3;
    const rect = (lot: number, x0: number, z0: number, x1: number, z1: number) => {
      const a = flip(lot, x0, z0), c = flip(lot, x1, z1), ax = Math.min(a.x, c.x) - pad, bx = Math.max(a.x, c.x) + pad, az = Math.min(a.z, c.z) - pad, bz = Math.max(a.z, c.z) + pad;
      for (let cz = Math.max(0, Math.floor((az - GZ0) / CELL)); cz <= Math.min(GH - 1, Math.floor((bz - GZ0) / CELL)); cz++) for (let cx = Math.max(0, Math.floor((ax - GX0) / CELL)); cx <= Math.min(GW - 1, Math.floor((bx - GX0) / CELL)); cx++) b[cz * GW + cx] = 1;
    };
    const disc = (lot: number, x: number, z: number, r: number) => rect(lot, x - r * 0.75, z - r * 0.75, x + r * 0.75, z + r * 0.75);
    for (let i = 0; i < SLOTS.length; i++) {
      const F = FENCE, t = 0.05;
      rect(i, -F.x - t, F.back, -F.x + t, F.front); rect(i, F.x - t, F.back, F.x + t, F.front); rect(i, -F.x, F.back - t, F.x, F.back + t);
      rect(i, -F.x, F.front - t, -F.gate, F.front + t); rect(i, F.gate, F.front - t, F.x, F.front + t);
      const d = st?.lots[i]; if (!d) continue;
      const fac = isFactory(d), roof = d.kind === 'rooftop';
      if (fac) rect(i, -6, -12.6, 1, -8.8); else rect(i, roof ? -2.2 : -3.1, -12.6, roof ? 2.2 : 3.1, -8.8);
      if (!fac && !roof) rect(i, 4.6, -12.3, 8.2, -9.2);
      rect(i, STALL.x - 1.5, STALL.z - 1.1, STALL.x + 1.5, STALL.z + 0.7);
      disc(i, -8, -9.8, 0.9); disc(i, 8.2, -4, 1);
      if (!roof) { disc(i, 8, 5.6, 1.5); disc(i, -8.4, -6.4, 0.5); }
      if (fac) { const n = Math.max(1, d.factory?.machines?.length ?? 0); MACHINE_SPOTS.forEach((m, k) => { if (k < n) disc(i, m.x, m.z - 0.1, 0.9); }); }
      for (const it of d.decor ?? []) disc(i, it.x, it.z, it.item === 'ao_ca' || it.item === 'xich_du' || it.item === 'ban_ghe' ? 0.9 : 0.45);
    }
  }
  /** Đi tới một điểm, vòng qua vật cản. */
  private go(x: number, z: number) {
    const p = this.findPath(this.pos.x, this.pos.z, x, z);
    this.path = p ?? [{ x, z }]; this.walkTo = this.path.shift() ?? null; this.pan.x = 0; this.pan.y = 0; this.dirty = true;
  }
  private clear(ax: number, az: number, bx: number, bz: number) { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2); for (let i = 1; i <= n; i++) if (this.isBlocked(ax + (bx - ax) * i / n, az + (bz - az) * i / n)) return false; return true; }
  private findPath(sx: number, sz: number, tx: number, tz: number): { x: number; z: number }[] | null {
    const b = this.blocked; let goal = this.cellOf(tx, tz); const start = this.cellOf(sx, sz); if (start < 0 || goal < 0) return null;
    let exact = true;
    if (b[goal]) { // đích bị chắn: lấy ô trống gần nhất
      exact = false; let best = -1, bd = 1e9; const gx = goal % GW, gz = Math.floor(goal / GW);
      for (let r = 1; r <= 10 && best < 0; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const cx = gx + dx, cz = gz + dz; if (cx < 0 || cz < 0 || cx >= GW || cz >= GH) continue; const c = cz * GW + cx; if (!b[c]) { const dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = c; } } }
      if (best < 0) return null; goal = best;
    }
    if (exact && this.clear(sx, sz, tx, tz)) return [{ x: tx, z: tz }];
    const N = GW * GH, gs = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N), heap: number[] = [], fs = new Float32Array(N);
    const gx = goal % GW, gz = Math.floor(goal / GW), hh = (c: number) => { const dx = Math.abs(c % GW - gx), dz = Math.abs(Math.floor(c / GW) - gz); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    const push = (c: number) => { heap.push(c); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (fs[heap[p]] <= fs[heap[i]]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && fs[heap[l]] < fs[heap[m]]) m = l; if (r < heap.length && fs[heap[r]] < fs[heap[m]]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    gs[start] = 0; fs[start] = hh(start); push(start); let found = false, guard = 0;
    while (heap.length && guard++ < 40000) {
      const c = pop(); if (closed[c]) continue; closed[c] = 1; if (c === goal) { found = true; break; }
      const cx = c % GW, cz = Math.floor(c / GW);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= GW || nz >= GH) continue; const n = nz * GW + nx;
        if (closed[n] || (b[n] && n !== goal)) continue; if (dx && dz && (b[cz * GW + nx] || b[nz * GW + cx])) continue;
        const ng = gs[c] + (dx && dz ? 1.414 : 1); if (ng < gs[n]) { gs[n] = ng; from[n] = c; fs[n] = ng + hh(n); push(n); }
      }
    }
    if (!found) return null;
    const pts: { x: number; z: number }[] = []; for (let c = goal; c !== -1 && c !== start; c = from[c]) pts.push({ x: GX0 + (c % GW + 0.5) * CELL, z: GZ0 + (Math.floor(c / GW) + 0.5) * CELL });
    pts.reverse(); if (exact && pts.length) pts[pts.length - 1] = { x: tx, z: tz };
    // kéo thẳng: bỏ các điểm giữa khi nhìn thông nhau
    const out: { x: number; z: number }[] = []; let ax = sx, az = sz, i = 0;
    while (i < pts.length) { let j = pts.length - 1; while (j > i && !this.clear(ax, az, pts[j].x, pts[j].z)) j--; out.push(pts[j]); ax = pts[j].x; az = pts[j].z; i = j + 1; }
    return out;
  }

  // ------------------------------------------------------------ khung nhìn
  private scale() { return (this.focus ? Math.min(this.zoomBase, Math.min(this.w / 37, this.h / 27) / S) : this.zoomBase * this.zoom); }
  private origin() {
    const k = S * this.scale(), c = this.focus ? { x: 0, z: -2.5 } : this.cam;
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
      const r = el.getBoundingClientRect(), act = this.hitAt(e.clientX - r.left, e.clientY - r.top);
      if (act) { this.doAct(act); return; }
      const gp = this.screenToGround(e.clientX, e.clientY); if (gp) this.tap(gp.x, gp.z);
    };
    on(el, 'pointerup', up); on(el, 'pointercancel', up);
    on(el, 'wheel', (e: WheelEvent) => { e.preventDefault(); this.setZoom(this.zoom * (e.deltaY > 0 ? 0.92 : 1.08)); }, { passive: false });
    on(window, 'keydown', (e: KeyboardEvent) => { const t = e.target as HTMLElement | null; if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return; this.keys.add(e.key.toLowerCase()); });
    on(window, 'keyup', (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); });
    on(window, 'blur', () => this.keys.clear());
  }
  /** Hình nào (ô trồng, sạp, máy, xe) nằm dưới điểm chạm — xét từ hình vẽ sau cùng, bỏ qua vùng trong suốt. */
  private hitAt(sx: number, sy: number): Act | null {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i]; if (sx < h.x || sy < h.y || sx > h.x + h.w || sy > h.y + h.h) continue;
      let u = (sx - h.x) / h.w; const v = (sy - h.y) / h.h; if (h.flip) u = 1 - u;
      try { const a = h.c.getContext('2d', { willReadFrequently: true })!.getImageData(Math.min(h.c.width - 1, Math.floor(u * h.c.width)), Math.min(h.c.height - 1, Math.floor(v * h.c.height)), 1, 1).data[3]; if (a > 40) return h.act; } catch { return h.act; }
    }
    return null;
  }
  private doAct(a: Act) {
    if (a.type === 'tile') { const w = this.worldOfTile(a.lot, a.tile); this.go(w.x + 0.6, w.z + 0.6); }
    else if (a.type === 'stall') { const w = flip(a.lot, STALL.x, STALL.z + 1.6); this.go(w.x, w.z); }
    else if (a.type === 'machine') { const m = MACHINE_SPOTS[a.index], w = flip(a.lot, m.x, m.z + 1.5); this.go(w.x, w.z); }
    else this.go(this.truckPos.x + 1.2, this.truckPos.z + 1.2);
  }
  /** Chạm một điểm trên mặt đất: bắt dính vào ô đất, sạp, máy, xe rồi đi tới đó. */
  private tap(x: number, z: number) {
    const st = this.state; let target = { x: Math.max(-BOUND.x, Math.min(BOUND.x, x)), z: Math.max(BOUND.zMin, Math.min(BOUND.zMax, z)) };
    if (st) for (let i = 0; i < SLOTS.length; i++) {
      const d = st.lots[i]; if (!d) continue; const l = toLocal(i, x, z);
      if (isFactory(d)) { let best = -1, bd = 1.9; MACHINE_SPOTS.forEach((m, k) => { const dd = Math.hypot(l.x - m.x, l.z - m.z + 0.5); if (dd < bd) { bd = dd; best = k; } }); if (best >= 0) { target = flip(i, MACHINE_SPOTS[best].x, MACHINE_SPOTS[best].z + 1.5); break; } }
      if (Math.abs(l.x) < PLOT_COLS && Math.abs(l.z) < PLOT_ROWS) {
        const tile = Math.floor((l.z + PLOT_ROWS) / TILE) * PLOT_COLS + Math.floor((l.x + PLOT_COLS) / TILE);
        if (lotTiles(d).includes(tile) || d.plantings.some((p) => p.tile === tile)) { const w = this.worldOfTile(i, tile); target = { x: w.x + 0.6, z: w.z + 0.6 }; break; }
      }
      if (Math.hypot(l.x - STALL.x, l.z - STALL.z) < 2.6) { target = flip(i, STALL.x, STALL.z + 1.6); break; }
    }
    if (this.hasTruck && !this.driving && Math.hypot(x - this.truckPos.x, z - this.truckPos.z) < 2.4) target = { x: this.truckPos.x + 1.2, z: this.truckPos.z + 1.2 };
    this.go(target.x, target.z);
  }

  // ------------------------------------------------------------ vòng lặp
  private tick(t: number) {
    const dt = Math.min(0.05, (t - this.last) / 1000 || 0.016); this.last = t;
    if (this.paused) return;
    this.time = t / 1000;
    const now = Date.now() + (this.state?.clockOffset ?? 0);
    // di chuyển
    let mx = 0, mz = 0; const k = this.keys;
    if (k.has('w') || k.has('arrowup')) { mx -= 1; mz -= 1; } if (k.has('s') || k.has('arrowdown')) { mx += 1; mz += 1; }
    if (k.has('a') || k.has('arrowleft')) { mx -= 1; mz += 1; } if (k.has('d') || k.has('arrowright')) { mx += 1; mz -= 1; }
    const speed = this.driving ? 9 : 6.5;
    if (mx || mz) { const n = Math.hypot(mx, mz); this.walkTo = null; this.path = []; this.move(mx / n * speed * dt, mz / n * speed * dt, true); }
    else if (this.walkTo) {
      const dx = this.walkTo.x - this.pos.x, dz = this.walkTo.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.12) { this.pos.set(this.walkTo.x, 0, this.walkTo.z); this.walkTo = this.path.shift() ?? null; this.dirty = true; } else { const s = Math.min(d, speed * dt); this.move(dx / d * s, dz / d * s); }
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
    if (t - this.ambientAt > 95) { this.ambientAt = t; this.dirty = true; } // hoạt ảnh nền (lá đung đưa, khói, bong bóng) khoảng 10 khung/giây
    if (!this.dirty) return;
    this.dirty = false;
    const t0 = performance.now(); this.draw(now); this.drawMs = performance.now() - t0; this.frames++;
  }
  private move(dx: number, dz: number, collide = false) {
    let nx = Math.max(-BOUND.x, Math.min(BOUND.x, this.pos.x + dx)), nz = Math.max(BOUND.zMin, Math.min(BOUND.zMax, this.pos.z + dz));
    if (collide && !this.driving && !this.isBlocked(this.pos.x, this.pos.z) && this.isBlocked(nx, nz)) { // trượt dọc vật cản
      if (!this.isBlocked(nx, this.pos.z)) nz = this.pos.z; else if (!this.isBlocked(this.pos.x, nz)) nx = this.pos.x; else return;
    }
    const ddx = nx - this.pos.x, ddz = nz - this.pos.z; this.pos.x = nx; this.pos.z = nz;
    if (Math.abs(ddx - ddz) > 0.001) { this.faceRight = ddx - ddz > 0; this.face = !this.faceRight; }
    if (Math.abs(ddx + ddz) > 0.001) this.faceFront = ddx + ddz > 0;
    this.step += Math.hypot(ddx, ddz); this.movedAt = this.time; this.dirty = true;
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
    const g = this.g, k = S * this.scale(), o = this.origin(), d = this.dpr, st = this.state, T = this.time;
    const urban = st?.lots[0]?.kind === 'rooftop', zone = (st && REGIONS[st.regionId]?.zone) || 'nam';
    g.setTransform(d, 0, 0, d, 0, 0); g.imageSmoothingQuality = 'high';
    g.fillStyle = urban ? '#aab1b8' : '#7dbb4e'; g.fillRect(0, 0, this.w, this.h);
    const P = (x: number, z: number) => ({ x: o.x + (x - z) * k, y: o.y + (x + z) * k / 2 });
    // ---- mặt đất: vẽ trong hệ toạ độ mặt đất (mét)
    g.save(); g.transform(k, k / 2, -k, k / 2, o.x, o.y);
    if (this.grass && !urban) { g.save(); const sc = 14 / 1024; g.scale(sc, sc); g.fillStyle = this.grass; g.fillRect(-90 / sc, -60 / sc, 180 / sc, 150 / sc); g.restore(); }
    if (urban) { g.strokeStyle = 'rgba(255,255,255,0.16)'; g.lineWidth = 0.06; g.beginPath(); for (let x = -72; x <= 72; x += 3) { g.moveTo(x, -30); g.lineTo(x, 60); } for (let z = -30; z <= 60; z += 3) { g.moveTo(-72, z); g.lineTo(72, z); } g.stroke(); }
    // đường làng và lối vào từng lô
    const road = (w: number, color: string) => { g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-70, ROAD_Z); g.lineTo(70, ROAD_Z); g.stroke(); };
    road(ROAD_HALF * 2 + 0.7, urban ? '#5d636b' : '#b98f55'); road(ROAD_HALF * 2, urban ? '#7c838b' : '#dcbf8a');
    g.strokeStyle = urban ? '#f1f1ee' : '#e9d2a2'; g.lineWidth = 0.18; g.setLineDash([1.2, 1.6]); g.beginPath(); g.moveTo(-70, ROAD_Z); g.lineTo(70, ROAD_Z); g.stroke(); g.setLineDash([]);
    for (let i = 0; i < SLOTS.length; i++) {
      const data = st?.lots[i] ?? null, L = (x: number, z: number) => flip(i, x, z);
      const line = (pts: [number, number][], w: number, color: string) => { g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, z], j) => { const p = L(x, z); if (j) g.lineTo(p.x, p.z); else g.moveTo(p.x, p.z); }); g.stroke(); };
      const poly = (pts: [number, number][], fill: string) => { g.fillStyle = fill; g.beginPath(); pts.forEach(([x, z], j) => { const p = L(x, z); if (j) g.lineTo(p.x, p.z); else g.moveTo(p.x, p.z); }); g.closePath(); g.fill(); };
      const path: [number, number][] = [[0, ROAD_Z - ROAD_HALF], [0, FENCE.front - 2.2]];
      if (data?.kind === 'rooftop') { // sân thượng lát gạch
        poly([[-10.3, -14.2], [10.3, -14.2], [10.3, 9.2], [-10.3, 9.2]], '#8a5a3c'); poly([[-10, -13.9], [10, -13.9], [10, 8.9], [-10, 8.9]], '#cf9a78');
        g.strokeStyle = 'rgba(120,70,44,0.32)'; g.lineWidth = 0.05; g.beginPath();
        for (let x = -9; x <= 9; x += 1.5) { const a = L(x, -13.9), b = L(x, 8.9); g.moveTo(a.x, a.z); g.lineTo(b.x, b.z); } for (let z = -12.4; z <= 8; z += 1.5) { const a = L(-10, z), b = L(10, z); g.moveTo(a.x, a.z); g.lineTo(b.x, b.z); } g.stroke();
        poly([[-6.5, -5.5], [6.5, -5.5], [6.5, 5.5], [-6.5, 5.5]], 'rgba(90,60,40,0.16)');
        line(path, 2.3, '#9aa0a6');
      } else {
        line(path, 2.9, urban ? '#5d636b' : '#b98f55'); line(path, 2.3, urban ? '#8f959c' : '#dcbf8a');
        if (data) {
          const yard: [number, number][] = [[-7.4, 6.3], [7.4, 6.3], [7.4, -6.2], [0, -6.2], [0, -8.2]];
          line(yard, 2.1, '#c9a468'); line(yard, 1.6, '#e3c995');
          line([[-7.4, 6.3], [-7.4, -6.2], [0, -6.2]], 2.1, '#c9a468'); line([[-7.4, 6.3], [-7.4, -6.2], [0, -6.2]], 1.6, '#e3c995');
          if (isFactory(data)) { poly([[-8.2, -1.6], [8.2, -1.6], [8.2, 6.6], [-8.2, 6.6]], '#cfd2d4'); g.strokeStyle = '#f2c230'; g.lineWidth = 0.14; const a = L(-8.2, -1.6), b = L(8.2, 6.6); g.strokeRect(Math.min(a.x, b.x), Math.min(a.z, b.z), Math.abs(a.x - b.x), Math.abs(a.z - b.z)); }
          else if (lotTiles(data).length > 0) poly([[-6.5, -5.5], [6.5, -5.5], [6.5, 5.5], [-6.5, 5.5]], 'rgba(120,84,52,0.35)');
        }
      }
      // hàng rào: bóng dưới đất
      line([[-FENCE.gate, FENCE.front], [-FENCE.x, FENCE.front], [-FENCE.x, FENCE.back], [FENCE.x, FENCE.back], [FENCE.x, FENCE.front], [FENCE.gate, FENCE.front]], 0.28, 'rgba(60,40,20,0.28)');
    }
    // ô đang đứng
    if (this.ctx.kind === 'tile') { const p = this.worldOfTile(this.ctx.lot, this.ctx.tile); g.strokeStyle = '#fff'; g.lineWidth = 0.16; g.strokeRect(p.x - 0.95, p.z - 0.95, 1.9, 1.9); g.strokeStyle = '#ffd23f'; g.lineWidth = 0.08; g.strokeRect(p.x - 1.05, p.z - 1.05, 2.1, 2.1); }
    const dest = this.path.length ? this.path[this.path.length - 1] : this.walkTo;
    if (dest) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(dest.x, dest.z, 0.35, 0, 6.3); g.fill(); }
    // lưới và bóng xem trước của chế độ xây dựng
    if (this.grid) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 0.03; g.beginPath(); for (let x = -FENCE.x; x <= FENCE.x + 0.01; x += 0.5) { g.moveTo(x, FENCE.back); g.lineTo(x, FENCE.front); } for (let z = FENCE.back; z <= FENCE.front + 0.01; z += 0.5) { g.moveTo(-FENCE.x, z); g.lineTo(FENCE.x, z); } g.stroke(); }
    if (this.preview) for (const p of this.preview) { g.fillStyle = { ok: 'rgba(90,220,110,0.5)', bad: 'rgba(240,70,60,0.6)', pending: 'rgba(255,255,255,0.45)', select: 'rgba(255,210,63,0.6)' }[p.tone]; g.beginPath(); g.arc(p.x, p.z, 0.8, 0, 6.3); g.fill(); }
    g.restore();

    // ---- các hình, sắp theo chiều sâu
    const list: Sprite[] = []; this.hits = []; this.labels = [];
    const add = (i: number, img: string, x: number, z: number, extra: Partial<Sprite> = {}) => { const w = flip(i, x, z); list.push({ img, x: w.x, z: w.z, flipX: SLOTS[i].s === -1 && !extra.tile, ...extra }); };
    const bubbles: { x: number; z: number; icon: string; bg: string }[] = [], smokes: { x: number; z: number; h: number; dx: number }[] = [], lamps: { x: number; z: number; h: number; color: string }[] = [];
    const near = (x: number, z: number, r: number) => Math.abs(x - this.pos.x) + Math.abs(z - this.pos.z) < r;
    const TREES: Record<string, string[]> = { bac: ['tre', 'chuoi', 'xoai', 'tre', 'xoai', 'chuoi', 'tre'], trung: ['xoai', 'chuoi', 'dua', 'tre', 'dua', 'xoai', 'chuoi'], taynguyen: ['xoai', 'tre', 'xoai', 'tre', 'chuoi', 'xoai', 'tre'], nam: ['xoai', 'chuoi', 'dua', 'dua', 'dua', 'xoai', 'chuoi'], dao: ['dua', 'chuoi', 'dua', 'dua', 'dua', 'dua', 'chuoi'] };
    const ZHOUSE: Record<string, string> = { bac: 'ba_gian', trung: 'mai_ngoi', taynguyen: 'nha_san', nam: 'mai_ton', dao: 'mai_ton' };
    if (st) for (let i = 0; i < SLOTS.length; i++) {
      const data = st.lots[i];
      if (!data) { if (i !== 0) { const w = flip(i, 0, FENCE.front + 1.6); list.push({ img: '', x: w.x, z: w.z, sign: 'Đất trống · mời bạn' }); } continue; }
      const fac = isFactory(data), roof = data.kind === 'rooftop', model = data.plotId === -1, style = data.style;
      if (roof) add(i, 'mai_ton', 0, -10.6, { sc: 0.62 }); else add(i, fac ? 'xuong' : model ? ZHOUSE[zone] ?? 'mai_ngoi' : HOUSE[style?.house ?? 'mai_ngoi'] ?? 'mai_ngoi', fac ? -2.5 : 0, -10.4);
      if (!fac && !roof) add(i, 'kho', 6.4, -10.6);
      add(i, 'cong', 0, FENCE.front + 0.2, { label: style?.gateName || (data.mine ? (roof ? 'Sân thượng nhà' : fac ? 'Xưởng nhà' : 'Vườn nhà') : `Vườn ${data.ownerName}`) });
      add(i, 'sap', STALL.x, STALL.z, { label: style?.stallName || undefined, labelBg: '#fff', act: { type: 'stall', lot: i } });
      if (roof) { add(i, 'bon_nuoc', -8, -9.8); add(i, 'gian_phoi', 8.2, -4); }
      else {
        add(i, 'gieng', -8, -9.8); add(i, 'cay_rom', 8.2, -4); add(i, 'ao_sen', 8, 5.6, { depth: -3 }); add(i, 'chum', -8.4, -6.4);
        const tr = TREES[zone] ?? TREES.nam, at: [number, number][] = [[-8.6, 7], [-11.2, -11.5], [11.2, -11.8], [-11.4, 2], [11.4, 3.5], [4.6, -14.6], [-5, -14.8]];
        at.forEach(([x, z], q) => add(i, tr[q], x, z, { sway: true }));
        if (!fac && near(flip(i, 0, -10).x, flip(i, 0, -10).z, 46)) { const w = flip(i, SLOTS[i].s === 1 ? 1.4 : -1.4, -10.6); smokes.push({ x: w.x, z: w.z, h: 4.3, dx: 0 }); }
      }
      if (model) { const w = flip(i, -4.8, FENCE.front + 1.5); list.push({ img: '', x: w.x, z: w.z, sign: `Vườn mẫu ${REGIONS[st.regionId]?.name ?? ''}`.trim() }); }
      if (fac) {
        const ms = data.factory?.machines?.length ? data.factory.machines : [{ id: 'co_ban', kind: 'may_say', name: 'Máy sấy' }];
        MACHINE_SPOTS.forEach((m, kx) => {
          const mc = ms[kx], w = flip(i, m.x, m.z);
          if (mc) {
            const state = machineState(mc, now);
            add(i, machineImg(mc), m.x, m.z, { label: mc.name, labelBg: state === 'done' ? '#fff3b0' : '#fff', act: { type: 'machine', lot: i, index: kx }, shake: state === 'run' });
            if (state === 'run') { smokes.push({ x: w.x, z: w.z, h: 2.4, dx: 0.2 }); lamps.push({ x: w.x, z: w.z, h: 2.1, color: Math.floor(T * 2.5) % 2 ? '#52e06a' : '#1f8f3a' }); }
            if (state === 'done') { add(i, 'pallet', m.x + 1.25, m.z + 0.7, { sc: 0.8 }); bubbles.push({ x: w.x, z: w.z, icon: '📦', bg: '#fff7d6' }); lamps.push({ x: w.x, z: w.z, h: 2.1, color: '#ffc928' }); }
          } else if (kx === ms.length) bubbles.push({ x: w.x, z: w.z, icon: '＋', bg: '#ffffffcc' });
        });
        add(i, 'thung', 7.4, -5.2); add(i, 'pallet', -7.6, -3.4);
      } else {
        const tiles = new Set(lotTiles(data)); for (const p of data.plantings) tiles.add(p.tile);
        const byTile = new Map(data.plantings.map((p) => [p.tile, p]));
        for (const tile of tiles) {
          const l = tileLocal(tile), p = byTile.get(tile), act: Act = { type: 'tile', lot: i, tile }; let img = 'cu_0', stage = 0, kind = 'cu';
          if (p) {
            const sp = SPECIALTIES[p.specialtyId], crop = sp ? CROPS[sp.crop] : undefined, n = crop ? processOf(crop).length : 6, ready = now >= p.stepReadyAt, last = p.stepIndex >= n - 1;
            stage = last && ready ? 4 : p.stepIndex <= 0 ? (ready ? 0 : 1) : Math.min(3, 1 + Math.round(p.stepIndex / Math.max(1, n - 1) * 2));
            kind = crop?.kind ?? 'ngan'; img = `${kind}_${stage}`;
            if (ready && (data.mine || data.friend)) { const w = flip(i, l.x, l.z); bubbles.push({ x: w.x, z: w.z, icon: last ? '🧺' : '⭐', bg: last ? '#fff7d6' : '#fff' }); }
          }
          if (roof) { // khay gỗ trên sân thượng, cây đặt trong khay
            const veg = p && kind === 'ngan' && stage >= 2 && stage < 4;
            add(i, veg ? 'khay_rau' : 'khay_trong', l.x, l.z, { tile: true, act, sc: 0.86 });
            if (p && !veg && stage >= 1) add(i, img, l.x, l.z, { tile: true, sc: 0.6, lift: 0.5, depth: 0.05, sway: stage >= 2 });
          } else add(i, img, l.x, l.z, { tile: true, act, sway: !!p && stage >= 2 && (kind === 'trai' || kind === 'leo' || kind === 'lua' || kind === 'cn') });
        }
      }
      for (const dcr of data.decor ?? []) add(i, DECOR_IMG[dcr.item] ?? dcr.item, dcr.x, dcr.z, { depth: 0.01, sway: TALL.has(dcr.item), flipX: (Math.round(dcr.rot / (Math.PI / 2)) % 2 === 1) !== (SLOTS[i].s === -1) });
      if (i === 0 && !roof) for (const a of this.animals) add(0, a.img, a.x, a.z, { flipX: a.face });
    }
    if (urban) for (let q = 0; q < 14; q++) list.push({ img: q % 3 === 0 ? 'mai_ngoi' : 'mai_ton', x: -58 + q * 9 + (q % 2) * 2, z: -22 - (q % 2) * 5, flipX: q % 4 === 1, alpha: 0.92 });
    if (this.preview) for (const p of this.preview) list.push({ img: DECOR_IMG[p.item] ?? p.item, x: p.x, z: p.z, alpha: p.tone === 'bad' ? 0.45 : p.tone === 'select' ? 1 : 0.65, depth: 0.02, flipX: Math.round(p.rot / (Math.PI / 2)) % 2 === 1 });
    if (this.hasTruck) { const tp = this.driving ? this.pos : this.truckPos; list.push({ img: 'xe_tai_t', x: tp.x, z: tp.z, flipX: this.driving && this.faceRight, act: this.driving ? undefined : { type: 'truck' } }); }
    if (!this.driving) list.push({ img: '@', char: true, x: this.pos.x, z: this.pos.z, depth: 0.2 });
    list.sort((a, b) => (a.x + a.z + (a.depth ?? 0)) - (b.x + b.z + (b.depth ?? 0)));

    // thanh rào phía sau vẽ trước các hình, phía trước vẽ sau; sân thượng dùng lan can xây
    const rail = (i: number, pts: [number, number][]) => {
      const wall = st?.lots[i]?.kind === 'rooftop', hgt = (wall ? 0.8 : 0.55) * k;
      if (wall) { g.fillStyle = '#d9cdb8'; g.strokeStyle = '#a8977c'; g.lineWidth = 1; for (let j = 0; j < pts.length - 1; j++) { const a = flip(i, pts[j][0], pts[j][1]), b = flip(i, pts[j + 1][0], pts[j + 1][1]), pa = P(a.x, a.z), pb = P(b.x, b.z); g.beginPath(); g.moveTo(pa.x, pa.y); g.lineTo(pb.x, pb.y); g.lineTo(pb.x, pb.y - hgt); g.lineTo(pa.x, pa.y - hgt); g.closePath(); g.fill(); g.stroke(); } return; }
      for (const [off, color, lw] of [[hgt, '#fbf7ee', 0.13], [hgt * 0.5, '#efe7d6', 0.11]] as [number, string, number][]) { g.strokeStyle = color; g.lineWidth = Math.max(1.5, lw * k); g.lineCap = 'round'; g.beginPath(); pts.forEach(([x, z], j) => { const w = flip(i, x, z), p = P(w.x, w.z); if (j) g.lineTo(p.x, p.y - off); else g.moveTo(p.x, p.y - off); }); g.stroke(); }
      g.strokeStyle = '#e4d9c3'; g.lineWidth = Math.max(1.5, 0.12 * k);
      for (let j = 0; j < pts.length - 1; j++) { const [x0, z0] = pts[j], [x1, z1] = pts[j + 1], n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / 1.6)); for (let q = 0; q <= n; q++) { const w = flip(i, x0 + (x1 - x0) * q / n, z0 + (z1 - z0) * q / n), p = P(w.x, w.z); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y - hgt * 1.25); g.stroke(); } }
    };
    for (let i = 0; i < SLOTS.length; i++) { const sgn = SLOTS[i].s; rail(i, sgn === 1 ? [[-FENCE.x, FENCE.front], [-FENCE.x, FENCE.back], [FENCE.x, FENCE.back]] : [[FENCE.x, FENCE.back], [FENCE.x, FENCE.front], [FENCE.gate, FENCE.front]]); if (sgn !== 1) rail(i, [[-FENCE.gate, FENCE.front], [-FENCE.x, FENCE.front]]); }
    for (const s of list) this.sprite(s, P, k, near(s.x, s.z, 34));
    for (let i = 0; i < SLOTS.length; i++) { const sgn = SLOTS[i].s; if (sgn === 1) { rail(i, [[FENCE.x, FENCE.back], [FENCE.x, FENCE.front], [FENCE.gate, FENCE.front]]); rail(i, [[-FENCE.gate, FENCE.front], [-FENCE.x, FENCE.front]]); } else rail(i, [[-FENCE.x, FENCE.front], [-FENCE.x, FENCE.back], [FENCE.x, FENCE.back]]); }

    // khói bếp, hơi máy, đèn máy
    for (const sm of smokes) { const p = P(sm.x, sm.z); for (let j = 0; j < 4; j++) { const ph = (T * 0.22 + j / 4 + (sm.x * 0.13) % 1) % 1, r = (0.22 + ph * 0.42) * k; g.globalAlpha = (1 - ph) * 0.42; g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(p.x + (sm.dx + Math.sin(ph * 5 + j) * 0.3 + ph * 0.5) * k, p.y - (sm.h + ph * 2) * k, r, 0, 6.3); g.fill(); } } g.globalAlpha = 1;
    for (const l of lamps) { const p = P(l.x, l.z); g.fillStyle = l.color; g.strokeStyle = '#2b2118'; g.lineWidth = 1; g.beginPath(); g.arc(p.x + 0.7 * k, p.y - l.h * k, Math.max(2.5, 0.13 * k), 0, 6.3); g.fill(); g.stroke(); }
    // nhãn nổi trên mọi hình
    for (const l of this.labels) this.pill(l.text, l.x, l.y, l.bg, l.size);
    // bong bóng trạng thái trên ô (nảy nhẹ)
    bubbles.forEach((b, q) => { const p = P(b.x, b.z), r = Math.max(10, 0.5 * k), y = p.y - 2.5 * k - Math.abs(Math.sin(T * 2.6 + q * 0.9)) * 0.16 * k; g.fillStyle = 'rgba(40,25,10,0.25)'; g.beginPath(); g.arc(p.x, y + 2, r, 0, 6.3); g.fill(); g.fillStyle = b.bg; g.strokeStyle = '#7a4a1e'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, y, r, 0, 6.3); g.fill(); g.stroke(); g.font = `${Math.round(r * 1.15)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#7a4a1e'; g.fillText(b.icon, p.x, y + 1); });
    // ---- ngày đêm và thời tiết
    const hour = this.opts.hour ?? ((new Date(now).getHours()) + new Date(now).getMinutes() / 60);
    const night = !(hour >= 5.3 && hour < 18.6), dusk = (hour >= 5.3 && hour < 7) || (hour >= 16.5 && hour < 18.6), w = st?.weather, wet = w === 'mua' || w === 'bao';
    // bướm quanh vườn và chim bay ngang (ngày tạnh ráo)
    if (!night && !wet && !urban) {
      for (let q = 0; q < 3; q++) { const bx = Math.sin(T * 0.5 + q * 2.1) * 5 + (q - 1) * 3, bz = Math.cos(T * 0.37 + q * 1.3) * 4, p = P(bx, bz), y = p.y - (1.3 + Math.sin(T * 2 + q) * 0.3) * k, fl = Math.abs(Math.sin(T * 9 + q)) * 0.22 * k + 1.5; g.fillStyle = ['#ffd84a', '#ff9ec4', '#ffffff'][q]; g.beginPath(); g.ellipse(p.x - fl * 0.6, y, fl, 0.14 * k, -0.5, 0, 6.3); g.ellipse(p.x + fl * 0.6, y, fl, 0.14 * k, 0.5, 0, 6.3); g.fill(); }
      const ph = (T % 26) / 7; if (ph < 1) { g.strokeStyle = '#3b3f46'; g.lineWidth = 2; g.lineCap = 'round'; for (let q = 0; q < 3; q++) { const x = -40 + (this.w + 80) * ph - q * 26, y = this.h * 0.2 + Math.sin(ph * 6 + q) * 12 + q * 9, fl = Math.sin(T * 8 + q) * 5; g.beginPath(); g.moveTo(x - 8, y - fl); g.lineTo(x, y); g.lineTo(x + 8, y - fl); g.stroke(); } }
    }
    // hạt và chữ bay
    for (const s of this.sparks) { const p = P(s.x, s.z); g.globalAlpha = Math.min(1, s.life * 2); g.fillStyle = s.color; g.beginPath(); g.arc(p.x, p.y - s.y * k, Math.max(2, 0.12 * k), 0, 6.3); g.fill(); } g.globalAlpha = 1;
    for (const f of this.floats) { const p = P(f.x, f.z), y = p.y - (2.2 + (1.7 - f.life) * 1.3) * k; g.globalAlpha = Math.min(1, f.life * 1.5); this.pill(f.text, p.x, y, f.bg, 13); } g.globalAlpha = 1;

    if (night) { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#6f83c9'; g.fillRect(0, 0, this.w, this.h); g.globalCompositeOperation = 'lighter';
      if (st) for (let i = 0; i < SLOTS.length; i++) if (st.lots[i]) { const wp = flip(i, 0, -9.2), p = P(wp.x, wp.z), r = 3.2 * k, grd = g.createRadialGradient(p.x, p.y - 1.4 * k, 0, p.x, p.y - 1.4 * k, r); grd.addColorStop(0, 'rgba(255,214,120,0.55)'); grd.addColorStop(1, 'rgba(255,214,120,0)'); g.fillStyle = grd; g.fillRect(p.x - r, p.y - 1.4 * k - r, r * 2, r * 2); }
      g.globalCompositeOperation = 'source-over'; }
    else if (dusk) { g.globalCompositeOperation = 'multiply'; g.fillStyle = '#ffd9b0'; g.fillRect(0, 0, this.w, this.h); g.globalCompositeOperation = 'source-over'; }
    if (w === 'mua' || w === 'bao' || w === 'may') { g.fillStyle = w === 'may' ? 'rgba(120,135,150,0.14)' : w === 'bao' ? 'rgba(70,85,105,0.34)' : 'rgba(95,115,140,0.24)'; g.fillRect(0, 0, this.w, this.h); }
    if (wet) { g.strokeStyle = 'rgba(225,240,255,0.6)'; g.lineWidth = 1.4; g.beginPath(); const n = w === 'bao' ? this.rain.length : Math.round(this.rain.length * 0.6); for (let i = 0; i < n; i++) { const r = this.rain[i], x = r.x * this.w * 1.2 - this.w * 0.1, y = r.y * this.h; g.moveTo(x, y); g.lineTo(x - r.l * 0.3, y + r.l); } g.stroke(); }
    if (w === 'nang_gat') { g.fillStyle = 'rgba(255,225,140,0.12)'; g.fillRect(0, 0, this.w, this.h); }
  }

  private pill(text: string, x: number, y: number, bg: string, size: number) {
    const g = this.g; g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(text).width + size * 1.1, h = size * 1.7;
    g.fillStyle = bg; g.strokeStyle = '#7a4a1e'; g.lineWidth = 2; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fill(); g.stroke();
    g.fillStyle = '#4b2c0f'; g.fillText(text, x, y + 1);
  }
  private sprite(s: Sprite, P: (x: number, z: number) => { x: number; y: number }, k: number, lively: boolean) {
    const g = this.g, p = P(s.x, s.z), T = this.time;
    if (p.x < -260 * this.scale() || p.x > this.w + 260 * this.scale() || p.y < -60 || p.y > this.h + 320 * this.scale()) return;
    if (s.char) { // nhân vật: bốn hướng, đứng và bước
      const moving = T - this.movedAt < 0.14, set = this.faceFront ? ['di_tt', 'dung_tt', 'di_tp', 'dung_tt'] : ['di_st', 'dung_st', 'di_sp', 'dung_st'];
      const name = moving ? set[Math.floor(this.step * 1.5) % 4] : set[1], im = this.charImg(name) ?? this.charImg(set[1]); if (!im) return;
      const flipX = this.faceFront ? this.faceRight : !this.faceRight, h = 3.5 * k, w = h * im.width / im.height, y = p.y - h + h * 0.035 - (moving ? Math.abs(Math.sin(this.step * 4.7)) * 0.1 * k : 0);
      g.fillStyle = 'rgba(40,25,10,0.28)'; g.beginPath(); g.ellipse(p.x, p.y, 0.5 * k, 0.24 * k, 0, 0, 6.3); g.fill();
      if (flipX) { g.save(); g.translate(p.x * 2, 0); g.scale(-1, 1); g.drawImage(im, p.x - w / 2, y, w, h); g.restore(); } else g.drawImage(im, p.x - w / 2, y, w, h);
      return;
    }
    if (s.alpha !== undefined) g.globalAlpha = s.alpha;
    if (!s.img) { // biển gỗ
      if (s.sign) { g.strokeStyle = '#7a4a1e'; g.lineWidth = Math.max(2, 0.16 * k); g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y - 1.5 * k); g.stroke(); this.pill(s.sign, p.x, p.y - 1.7 * k, '#f6e3b4', Math.max(10, Math.round(0.62 * k))); }
      g.globalAlpha = 1; return;
    }
    const im = this.img(s.img);
    if (!im) { // chưa có hình: tạm vẽ biểu tượng của món trang trí
      const it = DECOR_ITEMS.find((x) => x.id === s.img); if (it) { g.font = `${Math.round(1.4 * k)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = '#000'; g.fillText(it.emoji, p.x, p.y); }
      g.globalAlpha = 1; return;
    }
    const sc = s.sc ?? 1; let w: number, x: number, y: number, h: number;
    if (s.tile) { w = TILE * 2 * k * 1.05 * sc; h = w * im.height / im.width; x = p.x - w / 2; y = p.y - h + 0.35 * w - (s.lift ?? 0) * k; }
    else { const [m, an] = SIZE[s.img] ?? [2, 0.15]; w = m * 2 * k * 0.8 * sc; h = w * im.height / im.width; x = p.x - w / 2; y = p.y - h + h * an - (s.bob ?? 0) * k; }
    if (s.shake) x += Math.sin(T * 31) * 0.02 * k;
    const sway = s.sway && lively ? Math.sin(T * 1.25 + s.x * 0.7 + s.z * 0.4) * 0.022 : 0;
    g.save();
    if (s.flipX) { g.translate(p.x * 2, 0); g.scale(-1, 1); }
    if (sway) g.transform(1, 0, sway, 1, -sway * (y + h), 0); // nghiêng ngọn, giữ gốc
    g.drawImage(im, x, y, w, h); g.restore();
    g.globalAlpha = 1;
    if (s.act) this.hits.push({ x, y, w, h, flip: !!s.flipX, c: im, act: s.act });
    if (s.label) {
      if (s.img === 'cong') { // viết tên vườn lên tấm bảng trống của cổng
        const size = Math.max(7, Math.min(w * 0.075, w * 0.34 / Math.max(4, s.label.length) * 1.75)), fx = s.flipX ? 1 - 0.475 : 0.475; g.save(); g.translate(x + w * fx, y + h * 0.505); g.rotate(s.flipX ? -0.13 : 0.13); g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#5a3412'; g.fillText(s.label, 0, 0, w * 0.33); g.restore();
      } else this.labels.push({ text: s.label, x: p.x, y: y - 6, bg: s.labelBg ?? '#f6e3b4', size: Math.max(10, Math.round(0.6 * k)) });
    }
  }
}

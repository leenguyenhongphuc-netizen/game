// Địa lý biển mở cho cảnh lái tàu và mô tô nước: chiếu bờ biển thật (vn-outline.ts) ra mặt phẳng cảnh, tô lưới đất/nước,
// trường khoảng cách tới bờ (va chạm, màu nước nông, bọt sóng), luồng gợi ý (A*), phao luồng IALA vùng A, đảo đá vôi,
// đá ngầm và các tuyến tàu bè chạy theo đồng hồ (mọi máy cùng thấy). Hoàn toàn tất định theo mã tuyến.
// Trục cảnh: x = đông, z = nam (bắc là -z), đơn vị cảnh; upk = số đơn vị cảnh cho 1 km thật.
import { NEIGHBOR_LAND, VN_ISLANDS, VN_MAIN } from '../map/vn-outline.ts';
import type { Ring } from '../map/vn-outline.ts';
import { region } from '../../../shared/rules.ts';
import { hash32 } from '../../../shared/social.ts';
import type { JetSkiBeach, SeaRoute } from '../../../shared/sea.ts';
import { JETSKI_ZONE } from '../../../shared/sea.ts';

export type Pt = [number, number];
export type LaneKind = 'container' | 'hang_roi' | 'pha' | 'tau_khach' | 'tau_ca' | 'thung' | 'cano';
export interface Lane {
  kind: LaneKind; pts: Pt[]; loop: boolean; speed: number; phase: number;
  /** độ dài từng đoạn cộng dồn */
  cum: number[]; len: number;
}
export interface Karst { x: number; z: number; r: number; h: number; seed: number }
export interface Buoy { x: number; z: number; red: boolean; n: number }
export interface Zone { cx: number; cz: number; ax: number; az: number; halfAlong: number; halfOut: number }
export interface SeaWorld {
  kind: 'ferry' | 'jetski'; id: string;
  lat0: number; lng0: number; upk: number;
  toXZ(lat: number, lng: number): Pt;
  bounds: { x0: number; x1: number; z0: number; z1: number };
  cell: number; nx: number; nz: number; gx0: number; gz0: number;
  /** 0 nước, 1 đất, 2 đá vôi, 3 đá ngầm */
  land: Uint8Array; dist: Float32Array;
  rings: Pt[][];
  start: { x: number; z: number; yaw: number; name: string };
  goal: { x: number; z: number; name: string };
  /** điểm trên bờ cạnh hai bến (dựng cầu cảng, nhà chờ) */
  piers: { x: number; z: number; ox: number; oz: number; name: string }[];
  path: Pt[]; buoys: Buoy[]; lanes: Lane[]; karsts: Karst[]; rocks: Karst[];
  zone: Zone | null;
  isLand(x: number, z: number): boolean;
  distAt(x: number, z: number): number;
  /** hướng xa bờ (đơn vị) tại điểm */
  away(x: number, z: number): Pt;
}

// ------------------------------------------------------------------ tiện ích
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
function chaikin(r: Pt[], it: number): Pt[] {
  let p = r;
  for (let k = 0; k < it; k++) {
    const out: Pt[] = [];
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    p = out;
  }
  return p;
}
function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371, dLat = ((bLat - aLat) * Math.PI) / 180, dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function laneOf(kind: LaneKind, pts: Pt[], loop: boolean, speed: number, phase: number): Lane {
  const cum = [0]; const n = loop ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
  return { kind, pts, loop, speed, phase, cum, len: cum[cum.length - 1] };
}
/** Vị trí và hướng (yaw, 0 = bắc… theo quy ước cảnh: hướng tiến = (sin yaw, -cos yaw)) của tàu trên tuyến lúc t giây. */
export function lanePos(l: Lane, t: number): { x: number; z: number; yaw: number } {
  if (l.len < 1) return { x: l.pts[0][0], z: l.pts[0][1], yaw: 0 };
  let d = (t * l.speed + l.phase * l.len) % (l.loop ? l.len : 2 * l.len); if (d < 0) d += l.loop ? l.len : 2 * l.len;
  let back = false;
  if (!l.loop && d > l.len) { d = 2 * l.len - d; back = true; }
  let i = 0; while (i < l.cum.length - 2 && l.cum[i + 1] < d) i++;
  const a = l.pts[i], b = l.pts[(i + 1) % l.pts.length], seg = Math.max(1e-6, l.cum[i + 1] - l.cum[i]), u = clamp((d - l.cum[i]) / seg, 0, 1);
  let dx = b[0] - a[0], dz = b[1] - a[1]; if (back) { dx = -dx; dz = -dz; }
  return { x: a[0] + (b[0] - a[0]) * u, z: a[1] + (b[1] - a[1]) * u, yaw: Math.atan2(dx, -dz) };
}

// ------------------------------------------------------------------ dựng
interface Frame { lat0: number; lng0: number; upk: number; x0: number; x1: number; z0: number; z1: number; cell: number }
function project(f: Frame) {
  const kx = Math.cos((f.lat0 * Math.PI) / 180) * 111.32, ky = 110.57;
  return (lat: number, lng: number): Pt => [(lng - f.lng0) * kx * f.upk, -(lat - f.lat0) * ky * f.upk];
}

function rasterize(rings: Pt[][], f: Frame, nx: number, nz: number): Uint8Array {
  const land = new Uint8Array(nx * nz), xs: number[] = [];
  for (const r of rings) {
    let minZ = Infinity, maxZ = -Infinity; for (const p of r) { if (p[1] < minZ) minZ = p[1]; if (p[1] > maxZ) maxZ = p[1]; }
    const j0 = Math.max(0, Math.floor((minZ - f.z0) / f.cell)), j1 = Math.min(nz - 1, Math.ceil((maxZ - f.z0) / f.cell));
    for (let j = j0; j <= j1; j++) {
      const z = f.z0 + (j + 0.5) * f.cell; xs.length = 0;
      for (let i = 0, k = r.length - 1; i < r.length; k = i++) {
        const a = r[i], b = r[k];
        if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + ((z - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((p, q) => p - q);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        const i0 = Math.max(0, Math.ceil((xs[q] - f.x0) / f.cell - 0.5)), i1 = Math.min(nx - 1, Math.floor((xs[q + 1] - f.x0) / f.cell - 0.5));
        for (let i = i0; i <= i1; i++) land[j * nx + i] = 1;
      }
    }
  }
  return land;
}
/** khoảng cách (đơn vị cảnh) từ mỗi ô nước tới ô đất gần nhất — chamfer 3-4, đủ mượt cho màu và va chạm */
function distanceField(land: Uint8Array, nx: number, nz: number, cell: number): Float32Array {
  const INF = 1e9, d = new Float32Array(nx * nz);
  for (let i = 0; i < d.length; i++) d[i] = land[i] ? 0 : INF;
  const a = 3, b = 4;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; let v = d[k]; if (v === 0) continue;
    if (i > 0) v = Math.min(v, d[k - 1] + a); if (j > 0) { v = Math.min(v, d[k - nx] + a); if (i > 0) v = Math.min(v, d[k - nx - 1] + b); if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + b); }
    d[k] = v;
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; let v = d[k]; if (v === 0) continue;
    if (i < nx - 1) v = Math.min(v, d[k + 1] + a); if (j < nz - 1) { v = Math.min(v, d[k + nx] + a); if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + b); if (i > 0) v = Math.min(v, d[k + nx - 1] + b); }
    d[k] = v;
  }
  for (let i = 0; i < d.length; i++) d[i] = d[i] >= INF ? 9999 : (d[i] / 3) * cell;
  return d;
}

function makeWorld(kind: 'ferry' | 'jetski', id: string, f: Frame, rawRings: Ring[], extraRings: Pt[][]): SeaWorld {
  const toXZ = project(f);
  const pad = 2500 * (f.upk / 30);
  const inBox = (r: Pt[]) => { let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const p of r) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); } return x1 > f.x0 - pad && x0 < f.x1 + pad && z1 > f.z0 - pad && z0 < f.z1 + pad; };
  const rings: Pt[][] = [];
  for (const r of rawRings) { const p = r.map(([lng, lat]) => toXZ(lat, lng)); if (p.length > 2 && inBox(p)) rings.push(chaikin(p, kind === 'jetski' ? 1 : 2)); }
  rings.push(...extraRings);
  const nx = Math.ceil((f.x1 - f.x0) / f.cell), nz = Math.ceil((f.z1 - f.z0) / f.cell);
  const land = rasterize(rings, f, nx, nz);
  let dist = distanceField(land, nx, nz, f.cell);
  const idx = (x: number, z: number) => { const i = Math.floor((x - f.x0) / f.cell), j = Math.floor((z - f.z0) / f.cell); return i < 0 || j < 0 || i >= nx || j >= nz ? -1 : j * nx + i; };
  const w: SeaWorld = {
    kind, id, lat0: f.lat0, lng0: f.lng0, upk: f.upk, toXZ, bounds: { x0: f.x0, x1: f.x1, z0: f.z0, z1: f.z1 },
    cell: f.cell, nx, nz, gx0: f.x0, gz0: f.z0, land, dist, rings,
    start: { x: 0, z: 0, yaw: 0, name: '' }, goal: { x: 0, z: 0, name: '' }, piers: [], path: [], buoys: [], lanes: [], karsts: [], rocks: [], zone: null,
    isLand: (x, z) => { const k = idx(x, z); return k < 0 ? false : land[k] > 0; },
    distAt: (x, z) => {
      // nội suy song tuyến cho mượt
      const fx = (x - f.x0) / f.cell - 0.5, fz = (z - f.z0) / f.cell - 0.5, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      const g = (ii: number, jj: number) => (ii < 0 || jj < 0 || ii >= nx || jj >= nz ? 400 : dist[jj * nx + ii]);
      return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
    },
    away: (x, z) => { const e = f.cell; const dx = w.distAt(x + e, z) - w.distAt(x - e, z), dz = w.distAt(x, z + e) - w.distAt(x, z - e), l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; },
  };
  // đặt lại trường khoảng cách sau khi đóng dấu đá vôi / đá ngầm
  (w as SeaWorld & { refresh: () => void }).refresh = () => { dist = distanceField(land, nx, nz, f.cell); w.dist = dist; };
  return w;
}

/** Ô nước gần nhất (cách bờ ít nhất minD) quanh một điểm. */
function snapWater(w: SeaWorld, x: number, z: number, minD: number): Pt {
  if (!w.isLand(x, z) && w.distAt(x, z) >= minD) return [x, z];
  const step = w.cell;
  for (let r = step; r < 1500; r += step) {
    let best: Pt | null = null, bd = Infinity;
    const n = Math.max(12, Math.round((2 * Math.PI * r) / step));
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (!w.isLand(px, pz) && w.distAt(px, pz) >= minD) { const d = Math.hypot(px - x, pz - z); if (d < bd) { bd = d; best = [px, pz]; } } }
    if (best) return best;
  }
  return [x, z];
}
/** Điểm bờ gần nhất từ một điểm nước (theo ngược hướng xa bờ). */
function shoreFrom(w: SeaWorld, x: number, z: number): Pt {
  let px = x, pz = z;
  for (let i = 0; i < 400 && !w.isLand(px, pz); i++) { const a = w.away(px, pz); px -= a[0] * w.cell * 0.5; pz -= a[1] * w.cell * 0.5; }
  return [px, pz];
}

/** Luồng gợi ý: A* trên lưới thô, tránh sát bờ, rồi nắn thẳng theo tầm nhìn. */
function findPath(w: SeaWorld, a: Pt, b: Pt, clear: number): Pt[] {
  const s = 3, cx = Math.ceil(w.nx / s), cz = Math.ceil(w.nz / s), c = w.cell * s;
  const node = (p: Pt) => [clamp(Math.floor((p[0] - w.gx0) / c), 0, cx - 1), clamp(Math.floor((p[1] - w.gz0) / c), 0, cz - 1)];
  const center = (i: number, j: number): Pt => [w.gx0 + (i + 0.5) * c, w.gz0 + (j + 0.5) * c];
  const pen = new Float32Array(cx * cz);
  for (let j = 0; j < cz; j++) for (let i = 0; i < cx; i++) { const [x, z] = center(i, j), d = w.distAt(x, z); pen[j * cx + i] = w.isLand(x, z) || d < w.cell ? -1 : 1 + 60 / (d + 10) + (d < clear ? 6 : 0); }
  const [si, sj] = node(a), [ti, tj] = node(b), N = cx * cz;
  pen[sj * cx + si] = Math.max(pen[sj * cx + si], 1); pen[tj * cx + ti] = Math.max(pen[tj * cx + ti], 1);
  const g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N);
  const heap: [number, number][] = []; const push = (k: number, f: number) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const s0 = sj * cx + si, t0 = tj * cx + ti; g[s0] = 0; push(s0, 0);
  const H = (k: number) => Math.hypot((k % cx) - ti, Math.floor(k / cx) - tj);
  while (heap.length) {
    const [, k] = pop(); if (done[k]) continue; done[k] = 1; if (k === t0) break;
    const i = k % cx, j = Math.floor(k / cx);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= cx || jj >= cz) continue;
      const q = jj * cx + ii; if (pen[q] < 0 || done[q]) continue;
      const ng = g[k] + Math.hypot(di, dj) * (pen[k] + pen[q]) * 0.5;
      if (ng < g[q]) { g[q] = ng; from[q] = k; push(q, ng + H(q)); }
    }
  }
  if (from[t0] < 0 && t0 !== s0) return [a, b];
  const raw: Pt[] = []; for (let k = t0; k >= 0; k = from[k]) { raw.push(center(k % cx, Math.floor(k / cx))); if (k === s0) break; }
  raw.reverse(); raw[0] = a; raw[raw.length - 1] = b;
  // nắn thẳng: nối thẳng khi đoạn thẳng đi toàn nước, cách bờ đủ xa
  const ok = (p: Pt, q: Pt) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.ceil(L / w.cell); for (let i = 1; i < n; i++) { const t = i / n, x = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t; if (w.isLand(x, z) || w.distAt(x, z) < Math.min(clear, 24)) return false; } return true; };
  const out: Pt[] = [raw[0]]; let i = 0;
  while (i < raw.length - 1) { let j = raw.length - 1; while (j > i + 1 && !ok(raw[i], raw[j])) j--; out.push(raw[j]); i = j; }
  return out;
}
function along(path: Pt[], d: number): { p: Pt; dir: Pt } {
  let acc = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (acc + L >= d || i === path.length - 2) { const u = clamp((d - acc) / Math.max(1e-6, L), 0, 1); return { p: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], dir: [(b[0] - a[0]) / (L || 1), (b[1] - a[1]) / (L || 1)] }; }
    acc += L;
  }
  return { p: path[path.length - 1], dir: [0, -1] };
}
export function pathLength(path: Pt[]) { let L = 0; for (let i = 1; i < path.length; i++) L += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); return L; }

function stamp(w: SeaWorld, list: Karst[], v: number) {
  for (const k of list) {
    const r = k.r * 0.85, i0 = Math.floor((k.x - r - w.gx0) / w.cell), i1 = Math.ceil((k.x + r - w.gx0) / w.cell), j0 = Math.floor((k.z - r - w.gz0) / w.cell), j1 = Math.ceil((k.z + r - w.gz0) / w.cell);
    for (let j = Math.max(0, j0); j <= Math.min(w.nz - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(w.nx - 1, i1); i++) {
      const x = w.gx0 + (i + 0.5) * w.cell, z = w.gz0 + (j + 0.5) * w.cell; if (Math.hypot(x - k.x, z - k.z) <= r && !w.land[j * w.nx + i]) w.land[j * w.nx + i] = v;
    }
  }
  (w as SeaWorld & { refresh: () => void }).refresh();
}
const distToPath = (path: Pt[], x: number, z: number) => {
  let m = Infinity;
  for (let i = 0; i < path.length - 1; i++) { const a = path[i], b = path[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1, t = clamp(((x - a[0]) * dx + (z - a[1]) * dz) / L2, 0, 1); m = Math.min(m, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); }
  return m;
};
function randomWater(w: SeaWorld, r: () => number, minD: number, ok: (x: number, z: number) => boolean, tries = 400): Pt | null {
  for (let i = 0; i < tries; i++) { const x = w.bounds.x0 + r() * (w.bounds.x1 - w.bounds.x0), z = w.bounds.z0 + r() * (w.bounds.z1 - w.bounds.z0); if (!w.isLand(x, z) && w.distAt(x, z) >= minD && ok(x, z)) return [x, z]; }
  return null;
}
function circle(cx: number, cz: number, rad: number, n: number, wob: number, r: () => number): Pt[] { const p: Pt[] = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = rad * (1 + (r() - 0.5) * wob); p.push([cx + Math.cos(a) * k, cz + Math.sin(a) * k]); } return p; }
function lineWater(w: SeaWorld, a: Pt, b: Pt, minD: number) { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / (w.cell * 2)); for (let i = 0; i <= n; i++) { const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; if (w.isLand(x, z) || w.distAt(x, z) < minD) return false; } return true; }

/** Tuyến tàu ra đảo: đầu đất liền → bến đảo (toIsland) hoặc ngược lại. */
export function buildFerryWorld(route: SeaRoute, toIsland: boolean): SeaWorld {
  const A = route.mainland, B = route.island, D = kmBetween(A.lat, A.lng, B.lat, B.lng);
  const Lg = clamp(700 + D * 13, 900, 2100), upk = Lg / D;
  const lat0 = (A.lat + B.lat) / 2, lng0 = (A.lng + B.lng) / 2;
  const pre = project({ lat0, lng0, upk, x0: 0, x1: 0, z0: 0, z1: 0, cell: 1 });
  const a = pre(A.lat, A.lng), b = pre(B.lat, B.lng), padX = Math.max(380, Lg * 0.42);
  const f: Frame = { lat0, lng0, upk, cell: 6, x0: Math.max(-1950, Math.min(a[0], b[0]) - padX), x1: Math.min(1950, Math.max(a[0], b[0]) + padX), z0: Math.max(-1950, Math.min(a[1], b[1]) - padX), z1: Math.min(1950, Math.max(a[1], b[1]) + padX) };
  const extra: Pt[][] = [];
  const r = rng(hash32(`sea:${route.id}`));
  if (route.synthIslandKm) {
    const c = region(route.id), cc = c ? pre(c.lat, c.lng) : b, rad = route.synthIslandKm * upk;
    extra.push(chaikin(circle(cc[0], cc[1], rad, 16, 0.45, r), 2));
    // hòn Bé cạnh đảo lớn (Lý Sơn có đảo Bé ở phía bắc)
    extra.push(chaikin(circle(cc[0] + rad * 0.4, cc[1] - rad * 2.1, rad * 0.32, 10, 0.4, r), 2));
  }
  const w = makeWorld('ferry', route.id, f, [VN_MAIN, ...VN_ISLANDS, ...NEIGHBOR_LAND], extra);
  const pa = snapWater(w, a[0], a[1], 14), pb = snapWater(w, b[0], b[1], 14);
  const mk = (p: Pt, name: string) => { const s = shoreFrom(w, p[0], p[1]), o = w.away(p[0], p[1]); return { x: s[0], z: s[1], ox: o[0], oz: o[1], name }; };
  w.piers = [mk(pa, A.name), mk(pb, B.name)];
  // luồng luôn dựng theo chiều đất liền → đảo (chiều quy ước của hệ phao); người chơi đi chiều nào cũng dùng chung
  w.path = findPath(w, pa, pb, 40);
  const from = toIsland ? pa : pb, to = toIsland ? pb : pa, first = toIsland ? w.path[1] ?? to : w.path[w.path.length - 2] ?? to;
  w.start = { x: from[0], z: from[1], yaw: Math.atan2(first[0] - from[0], -(first[1] - from[1])), name: toIsland ? A.name : B.name };
  w.goal = { x: to[0], z: to[1], name: toIsland ? B.name : A.name };
  // Phao luồng IALA vùng A: theo chiều quy ước (đi vào cảng đảo) phao đỏ bên trái, phao xanh bên phải
  const L = pathLength(w.path);
  let n = 1;
  for (let d = 70; d < L - 70; d += 150, n++) {
    const { p, dir } = along(w.path, d), left: Pt = [dir[1], -dir[0]];
    for (const side of [1, -1]) { const x = p[0] + left[0] * 22 * side, z = p[1] + left[1] * 22 * side; if (!w.isLand(x, z)) w.buoys.push({ x, z, red: side === 1, n }); }
  }
  // đảo đá vôi (vịnh Hạ Long – Lan Hạ) và đá ngầm sát bờ, tránh luồng
  if (route.karst) {
    for (let i = 0; i < 110; i++) { const p = randomWater(w, r, 16, (x, z) => distToPath(w.path, x, z) > 55 && Math.hypot(x - b[0], z - b[1]) < Lg * 0.7 && Math.hypot(x - pa[0], z - pa[1]) > 140); if (p) w.karsts.push({ x: p[0], z: p[1], r: 7 + r() * 16, h: 18 + r() * 40, seed: Math.floor(r() * 1e9) }); }
    stamp(w, w.karsts, 2);
  }
  for (let i = 0; i < 26; i++) { const p = randomWater(w, r, 4, (x, z) => w.distAt(x, z) < 30 && distToPath(w.path, x, z) > 45 && Math.hypot(x - pa[0], z - pa[1]) > 90 && Math.hypot(x - pb[0], z - pb[1]) > 90); if (p) w.rocks.push({ x: p[0], z: p[1], r: 3 + r() * 4, h: 1 + r() * 2, seed: Math.floor(r() * 1e9) }); }
  stamp(w, w.rocks, 3);
  // ---- tàu bè chạy theo đồng hồ
  // tàu chạy tuyến đi bên phải luồng theo chiều mình đi (quy tắc tránh va: đi bên phải, gặp nhau thì qua mạn trái nhau)
  const keepRight = (pts: Pt[], off: number): Pt[] => pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    const q: Pt = [p[0] - (dz / L) * off, p[1] + (dx / L) * off];
    return w.isLand(q[0], q[1]) || w.distAt(q[0], q[1]) < 10 ? p : q;
  });
  const path = w.path, rev = [...path].reverse();
  w.lanes.push(laneOf('tau_khach', keepRight(path, 16), false, 22, 0.1), laneOf('tau_khach', keepRight(rev, 16), false, 22, 0.55), laneOf('pha', keepRight(path, 30), false, 9, 0.35));
  for (let i = 0, made = 0; i < 40 && made < 3; i++) {
    const p = randomWater(w, r, 70, () => true), q = randomWater(w, r, 70, () => true); if (!p || !q) continue;
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) < Lg * 0.55 || !lineWater(w, p, q, 35)) continue;
    w.lanes.push(laneOf(made === 1 ? 'hang_roi' : 'container', [p, q], false, 11 + r() * 4, r())); made++;
  }
  for (let i = 0; i < 7; i++) { const p = randomWater(w, r, 45, (x, z) => distToPath(w.path, x, z) > 50); if (p) w.lanes.push(laneOf('tau_ca', circle(p[0], p[1], 30 + r() * 50, 10, 0.5, r).filter((q) => !w.isLand(q[0], q[1])), true, 3 + r() * 2, r())); }
  for (const pp of [pa, pb]) for (let i = 0; i < 4; i++) { const p = randomWater(w, r, 8, (x, z) => w.distAt(x, z) < 40 && Math.hypot(x - pp[0], z - pp[1]) < 260 && distToPath(w.path, x, z) > 20); if (p) w.lanes.push(laneOf('thung', circle(p[0], p[1], 5 + r() * 6, 8, 0.4, r), true, 0.8, r())); }
  w.lanes = w.lanes.filter((l) => l.pts.length >= 2 && l.len > 4);
  return w;
}

/** Bãi biển cho thuê mô tô nước: 1 đơn vị = 1 m thật, vùng phao an toàn trước bãi. Dữ liệu bờ 1:10m quá thô ở tỉ lệ mét
 *  (một cạnh dài vài km), nên bãi được dựng thành một đường bờ cong nhẹ theo đúng hướng ra biển của bãi thật. */
export function buildJetSkiWorld(beach: JetSkiBeach): SeaWorld {
  const upk = 1000, f: Frame = { lat0: beach.lat, lng0: beach.lng, upk, cell: 3, x0: -950, x1: 950, z0: -950, z1: 950 };
  const r = rng(hash32(`jet:${beach.id}`));
  const o: Pt = [Math.sin(beach.seaward), -Math.cos(beach.seaward)], along: Pt = [-o[1], o[0]];
  const P = (u: number, v: number): Pt => [along[0] * u + o[0] * v, along[1] * u + o[1] * v];
  // đất liền: mép nước uốn nhẹ, lùi sâu 2 km vào bờ; mũi đá ở một đầu bãi
  const shoreV = (u: number) => -260 + 18 * Math.sin(u / 230) + 10 * Math.sin(u / 97 + 1);
  const landRing: Pt[] = [];
  for (let u = -1500; u <= 1500; u += 30) landRing.push(P(u, shoreV(u) + (u < -850 ? Math.min(320, (-850 - u) * 0.9) : 0)));
  landRing.push(P(1500, -2500), P(-1500, -2500));
  const islets: Pt[][] = [chaikin(circle(...P(780, 240), 38, 9, 0.5, r), 2), chaikin(circle(...P(-640, 420), 26, 8, 0.5, r), 2)];
  const w = makeWorld('jetski', beach.id, f, [], [landRing, ...islets]);
  const shore = P(0, shoreV(0));
  const cx = shore[0] + o[0] * (JETSKI_ZONE.gap + JETSKI_ZONE.out / 2), cz = shore[1] + o[1] * (JETSKI_ZONE.gap + JETSKI_ZONE.out / 2);
  w.zone = { cx, cz, ax: along[0], az: along[1], halfAlong: JETSKI_ZONE.along / 2, halfOut: JETSKI_ZONE.out / 2 };
  w.piers = [{ x: shore[0], z: shore[1], ox: o[0], oz: o[1], name: beach.name }];
  const st: Pt = [shore[0] + o[0] * (JETSKI_ZONE.gap + 14), shore[1] + o[1] * (JETSKI_ZONE.gap + 14)];
  w.start = { x: st[0], z: st[1], yaw: Math.atan2(o[0], -o[1]), name: beach.name };
  w.goal = { x: st[0], z: st[1], name: 'Bến cho thuê' };
  w.path = [];
  // phao vàng quanh vùng an toàn
  const Z = w.zone, corner = (u: number, v: number): Pt => [Z.cx + Z.ax * u * Z.halfAlong + o[0] * v * Z.halfOut, Z.cz + Z.az * u * Z.halfAlong + o[1] * v * Z.halfOut];
  const ring: Pt[] = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
  for (let i = 0; i < 4; i++) { const a = ring[i], b = ring[(i + 1) % 4], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(2, Math.round(L / 40)); for (let k = 0; k < n; k++) { const t = k / n; w.buoys.push({ x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, red: false, n: 0 }); } }
  // ca nô kéo phao chuối chạy ngoài vùng, tàu cá xa bờ, thuyền thúng sát bờ
  for (let i = 0; i < 2; i++) { const c = P((i ? 1 : -1) * (Z.halfAlong + 170), shoreV(0) + 200); w.lanes.push(laneOf('cano', circle(c[0], c[1], 90, 10, 0.3, r).filter((p) => !w.isLand(p[0], p[1])), true, 9, r())); }
  for (let i = 0; i < 3; i++) { const c = P((r() - 0.5) * 1100, 300 + r() * 300); if (!w.isLand(c[0], c[1])) w.lanes.push(laneOf('tau_ca', circle(c[0], c[1], 40 + r() * 40, 10, 0.5, r), true, 2.5, r())); }
  for (let i = 0; i < 4; i++) { const u = (Z.halfAlong + 60 + r() * 220) * (i % 2 ? 1 : -1), c = P(u, shoreV(u) + 22 + r() * 25); if (!w.isLand(c[0], c[1])) w.lanes.push(laneOf('thung', circle(c[0], c[1], 6, 8, 0.4, r), true, 0.7, r())); }
  w.lanes = w.lanes.filter((l) => l.pts.length >= 2 && l.len > 4);
  return w;
}

/** Điểm (u theo dọc bờ, v theo hướng ra biển) trong vùng an toàn, giá trị ngoài [-1, 1] là đã ra ngoài phao. */
export function zoneUV(z: Zone, x: number, zz: number): Pt {
  // dọc bờ = (ax, az); hướng ra biển = (az, −ax) (along = (−o_z, o_x) nên o = (a_z, −a_x))
  const dx = x - z.cx, dz = zz - z.cz;
  return [(dx * z.ax + dz * z.az) / z.halfAlong, (dx * z.az - dz * z.ax) / z.halfOut];
}

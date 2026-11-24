// Lưới đi bộ tự do cho cảnh tham quan: "rải" mọi tam giác của cảnh tĩnh xuống một lưới 0,5 m nhiều tầng.
// Mặt ngửa lên (sàn, bãi cát, bậc thang, mặt cầu) thành tầng đứng được; mọi vật chen vào khoảng 0,4–1,75 m trên một tầng
// (tường, thân cây, quầy, gầm mái thấp) làm tầng đó không đi được. Từ lối đi mẫu loang ra bốn phía với bước cao tối đa
// STEP_UP: tới mép nước thì đáy biển thấp hẳn nên dừng tự nhiên, tới chân núi dốc thì dừng — không có tường vô hình giữa đường.
import * as THREE from 'three';

export const CELL = 0.5, LAYERS = 3, STEP_UP = 0.55;
/** Khoảng trống phải có trên một tầng để đứng được (tính từ mặt sàn). */
const CLEAR_LO = 0.4, CLEAR_HI = 1.75, MERGE = 0.45;
/** Mặt có pháp tuyến hướng lên quá mức này coi là sàn (dốc ≤ ~44°). */
const FLOOR_NY = 0.72;

export interface Bounds { x0: number; z0: number; x1: number; z1: number }

export class WalkGrid {
  readonly x0: number; readonly z0: number; readonly nx: number; readonly nz: number;
  /** Cao độ từng tầng, NaN là trống; sắp tăng dần trong một ô. */
  private floors: Float32Array;
  private blocked: Uint8Array;
  /** 1 = loang tới được từ lối đi. */
  private reach: Uint8Array;

  constructor(b: Bounds) {
    this.x0 = b.x0; this.z0 = b.z0;
    this.nx = Math.max(1, Math.ceil((b.x1 - b.x0) / CELL)); this.nz = Math.max(1, Math.ceil((b.z1 - b.z0) / CELL));
    const n = this.nx * this.nz;
    this.floors = new Float32Array(n * LAYERS).fill(NaN); this.blocked = new Uint8Array(n * LAYERS); this.reach = new Uint8Array(n * LAYERS);
  }
  get width() { return this.nx * CELL; } get depth() { return this.nz * CELL; }
  private ix(x: number) { return Math.floor((x - this.x0) / CELL); }
  private iz(z: number) { return Math.floor((z - this.z0) / CELL); }
  private inside(ix: number, iz: number) { return ix >= 0 && iz >= 0 && ix < this.nx && iz < this.nz; }

  /** Cao độ tham chiếu (lối đi gần nhất) để chọn tầng giữ lại khi một ô có quá nhiều tầng. */
  private ref: ((x: number, z: number) => number) | null = null;
  private addFloor(c: number, y: number) {
    const f = this.floors, o = c * LAYERS;
    for (let k = 0; k < LAYERS; k++) { const v = f[o + k]; if (!Number.isNaN(v) && Math.abs(v - y) < MERGE) { if (y > v) f[o + k] = y; return; } }
    let k = 0; while (k < LAYERS && !Number.isNaN(f[o + k]) && f[o + k] < y) k++;
    if (!Number.isNaN(f[o + LAYERS - 1])) {
      // đầy: bỏ tầng xa cao độ lối đi nhất (đáy biển dưới cầu cảng, nóc mái trên phố) — kể cả tầng mới
      const gx = c % this.nx, gz = Math.floor(c / this.nx), r = this.ref ? this.ref(this.x0 + (gx + 0.5) * CELL, this.z0 + (gz + 0.5) * CELL) : 0;
      let far = -1, fd = Math.abs(y - r); for (let j = 0; j < LAYERS; j++) { const d = Math.abs(f[o + j] - r); if (d > fd) { fd = d; far = j; } }
      if (far < 0) return;
      for (let j = far; j < LAYERS - 1; j++) f[o + j] = f[o + j + 1]; f[o + LAYERS - 1] = NaN;
      k = 0; while (k < LAYERS && !Number.isNaN(f[o + k]) && f[o + k] < y) k++;
    }
    for (let j = LAYERS - 1; j > k; j--) f[o + j] = f[o + j - 1];
    f[o + k] = y;
  }
  /** Một điểm hình học ở độ cao y nằm trong ô c: chặn mọi tầng mà điểm đó chen vào khoảng trống trên đầu. */
  private obstacle(c: number, y: number) {
    const f = this.floors, o = c * LAYERS;
    for (let k = 0; k < LAYERS; k++) { const v = f[o + k]; if (!Number.isNaN(v) && y > v + CLEAR_LO && y < v + CLEAR_HI) this.blocked[o + k] = 1; }
  }

  /** Dựng lưới từ các lưới tam giác tĩnh (toạ độ thế giới lấy theo matrixWorld). */
  build(meshes: THREE.Mesh[], ref?: (x: number, z: number) => number) {
    this.ref = ref ?? null;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), n = new THREE.Vector3();
    const tris: number[] = []; // gom tam giác (9 số mỗi cái) để chạy hai lượt
    const X0 = this.x0, Z0 = this.z0, X1 = this.x0 + this.width, Z1 = this.z0 + this.depth;
    for (const m of meshes) {
      const g = m.geometry as THREE.BufferGeometry, pos = g.attributes.position as THREE.BufferAttribute | undefined; if (!pos) continue;
      if (!g.boundingBox) g.computeBoundingBox();
      const bb = g.boundingBox!.clone().applyMatrix4(m.matrixWorld); if (bb.max.x < X0 || bb.min.x > X1 || bb.max.z < Z0 || bb.min.z > Z1) continue;
      const idx = g.index, cnt = idx ? idx.count : pos.count;
      for (let i = 0; i + 2 < cnt; i += 3) {
        const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1, i2 = idx ? idx.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, i0).applyMatrix4(m.matrixWorld); b.fromBufferAttribute(pos, i1).applyMatrix4(m.matrixWorld); c.fromBufferAttribute(pos, i2).applyMatrix4(m.matrixWorld);
        if (Math.max(a.x, b.x, c.x) < X0 || Math.min(a.x, b.x, c.x) > X1 || Math.max(a.z, b.z, c.z) < Z0 || Math.min(a.z, b.z, c.z) > Z1) continue;
        tris.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      }
    }
    const T = tris.length / 9, isFloor = new Uint8Array(T);
    // lượt 1: sàn
    for (let t = 0; t < T; t++) {
      const p = t * 9; a.set(tris[p], tris[p + 1], tris[p + 2]); b.set(tris[p + 3], tris[p + 4], tris[p + 5]); c.set(tris[p + 6], tris[p + 7], tris[p + 8]);
      n.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a)); const l = n.length(); if (l < 1e-9) continue; n.divideScalar(l);
      if (Math.abs(n.y) < FLOOR_NY) continue; isFloor[t] = 1;
      this.rasterTop(a, b, c);
    }
    // lượt 2: vật cản — rải điểm trên mọi tam giác không phải sàn (tường, mặt dưới, sườn dốc)
    for (let t = 0; t < T; t++) {
      if (isFloor[t]) continue;
      const p = t * 9; a.set(tris[p], tris[p + 1], tris[p + 2]); b.set(tris[p + 3], tris[p + 4], tris[p + 5]); c.set(tris[p + 6], tris[p + 7], tris[p + 8]);
      const area = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() / 2, span = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a));
      const steps = Math.min(90, Math.max(2, Math.ceil(span / (CELL * 0.7)))); if (area < 1e-6 && span < 1e-3) continue;
      for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps - i; j++) {
        const u = i / steps, v = j / steps, w = 1 - u - v;
        const x = a.x * w + b.x * u + c.x * v, y = a.y * w + b.y * u + c.y * v, z = a.z * w + b.z * u + c.z * v;
        const gx = this.ix(x), gz = this.iz(z); if (this.inside(gx, gz)) this.obstacle(gz * this.nx + gx, y);
      }
    }
    // sàn chồng sàn quá thấp (gầm bàn, gầm cầu thấp): tầng dưới không đứng được
    for (let cI = 0; cI < this.nx * this.nz; cI++) {
      const o = cI * LAYERS;
      for (let k = 0; k < LAYERS - 1; k++) { const lo = this.floors[o + k], hi = this.floors[o + k + 1]; if (!Number.isNaN(lo) && !Number.isNaN(hi) && hi - lo < CLEAR_HI) this.blocked[o + k] = 1; }
    }
  }
  /** Rải một tam giác ngửa lên vào các ô mà tâm ô nằm trong tam giác (tam giác nhỏ hơn ô: lấy ô chứa trọng tâm). */
  private rasterTop(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) {
    const minX = Math.max(0, this.ix(Math.min(a.x, b.x, c.x))), maxX = Math.min(this.nx - 1, this.ix(Math.max(a.x, b.x, c.x)));
    const minZ = Math.max(0, this.iz(Math.min(a.z, b.z, c.z))), maxZ = Math.min(this.nz - 1, this.iz(Math.max(a.z, b.z, c.z)));
    if (minX > maxX || minZ > maxZ) return;
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z); if (Math.abs(d) < 1e-9) return;
    let any = false;
    for (let gz = minZ; gz <= maxZ; gz++) for (let gx = minX; gx <= maxX; gx++) {
      const px = this.x0 + (gx + 0.5) * CELL, pz = this.z0 + (gz + 0.5) * CELL;
      const w0 = ((b.z - c.z) * (px - c.x) + (c.x - b.x) * (pz - c.z)) / d, w1 = ((c.z - a.z) * (px - c.x) + (a.x - c.x) * (pz - c.z)) / d, w2 = 1 - w0 - w1;
      if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
      this.addFloor(gz * this.nx + gx, a.y * w0 + b.y * w1 + c.y * w2); any = true;
    }
    if (!any) { const gx = this.ix((a.x + b.x + c.x) / 3), gz = this.iz((a.z + b.z + c.z) / 3); if (this.inside(gx, gz)) this.addFloor(gz * this.nx + gx, (a.y + b.y + c.y) / 3); }
  }

  /** Lối đi mẫu luôn đi được (giữ nguyên mọi chỗ trước đây đi được), rồi loang từ đó ra mọi phía. */
  seedPath(path: THREE.Vector3[], half: number) {
    const seeds: number[] = [];
    for (let i = 0; i < path.length - 1; i++) {
      const p = path[i], q = path[i + 1], len = Math.hypot(q.x - p.x, q.z - p.z), n = Math.max(1, Math.ceil(len / (CELL * 0.5)));
      const nx = -(q.z - p.z) / (len || 1), nz = (q.x - p.x) / (len || 1);
      for (let s = 0; s <= n; s++) {
        const t = s / n, x = p.x + (q.x - p.x) * t, z = p.z + (q.z - p.z) * t, y = p.y + (q.y - p.y) * t;
        for (let o = -half; o <= half + 1e-6; o += CELL * 0.5) {
          const gx = this.ix(x + nx * o), gz = this.iz(z + nz * o); if (!this.inside(gx, gz)) continue;
          const cI = gz * this.nx + gx; let k = this.layerNear(cI, y, 0.6);
          if (k < 0) { this.addFloor(cI, y); k = this.layerNear(cI, y, 0.6); }
          if (k < 0) continue;
          this.blocked[cI * LAYERS + k] = 0; seeds.push(cI * LAYERS + k);
        }
      }
    }
    this.flood(seeds);
  }
  private layerNear(c: number, y: number, tol: number): number {
    let best = -1, bd = tol; const o = c * LAYERS;
    for (let k = 0; k < LAYERS; k++) { const v = this.floors[o + k]; if (Number.isNaN(v)) continue; const d = Math.abs(v - y); if (d <= bd) { bd = d; best = k; } }
    return best;
  }
  private flood(seeds: number[]) {
    const R = this.reach, q = new Int32Array(this.nx * this.nz * LAYERS); let h = 0, t = 0;
    for (const s of seeds) if (!R[s]) { R[s] = 1; q[t++] = s; }
    while (h < t) {
      const id = q[h++], cI = Math.floor(id / LAYERS), y = this.floors[id], gx = cI % this.nx, gz = Math.floor(cI / this.nx);
      for (let d = 0; d < 4; d++) {
        const ax = gx + (d === 0 ? 1 : d === 1 ? -1 : 0), az = gz + (d === 2 ? 1 : d === 3 ? -1 : 0); if (!this.inside(ax, az)) continue;
        const nc = az * this.nx + ax, k = this.layerNear(nc, y, STEP_UP); if (k < 0) continue;
        const nid = nc * LAYERS + k; if (R[nid] || this.blocked[nid]) continue;
        R[nid] = 1; q[t++] = nid;
      }
    }
  }
  /** Tầng đi được của ô chứa (x, z) gần cao độ y nhất (trong tol); -1 nếu không có. */
  private cellLayer(x: number, z: number, y: number, tol = 1.2): number {
    const gx = this.ix(x), gz = this.iz(z); if (!this.inside(gx, gz)) return -1;
    const c = gz * this.nx + gx, o = c * LAYERS; let best = -1, bd = tol;
    for (let k = 0; k < LAYERS; k++) { if (!this.reach[o + k]) continue; const d = Math.abs(this.floors[o + k] - y); if (d <= bd) { bd = d; best = o + k; } }
    return best;
  }
  /** Cao độ mặt đứng tại (x, z) gần y; null nếu không đứng được. */
  height(x: number, z: number, y: number, tol = 1.2): number | null { const id = this.cellLayer(x, z, y, tol); return id < 0 ? null : this.floors[id]; }
  /** Bước từ cao độ y sang (x, z) có đi được không (đúng bước cao, ô loang tới được). */
  canStep(x: number, z: number, y: number): number | null { return this.height(x, z, y, STEP_UP + 0.05); }
  /** Ô đi được gần (x, z) nhất (tìm xoắn ốc tới r mét). */
  nearest(x: number, z: number, y: number, r = 12): THREE.Vector3 | null {
    const cx = this.ix(x), cz = this.iz(z), R = Math.ceil(r / CELL); let best: THREE.Vector3 | null = null, bd = Infinity;
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const gx = cx + dx, gz = cz + dz; if (!this.inside(gx, gz)) continue; const o = (gz * this.nx + gx) * LAYERS;
      for (let k = 0; k < LAYERS; k++) { if (!this.reach[o + k]) continue; const d = dx * dx + dz * dz + Math.abs(this.floors[o + k] - y) * 2; if (d < bd) { bd = d; best = new THREE.Vector3(this.x0 + (gx + 0.5) * CELL, this.floors[o + k], this.z0 + (gz + 0.5) * CELL); } }
    }
    return best;
  }
  /** Đường đi ngắn nhất (A* 8 hướng trên các tầng đi được), đã nắn thẳng. null nếu không tới được. */
  route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] | null {
    const s = this.cellLayer(from.x, from.z, from.y, 2), g0 = this.nearest(to.x, to.z, to.y, 10); if (s < 0 || !g0) return null;
    const goal = this.cellLayer(g0.x, g0.z, g0.y, 0.1); if (goal < 0) return null;
    // bộ đệm dùng lại giữa các lần tìm (đánh dấu theo lượt) — không cấp phát vài MB mỗi lần, tránh dọn rác gây giật
    const N = this.nx * this.nz * LAYERS;
    if (!this.aG || this.aG.length !== N) { this.aG = new Float32Array(N); this.aC = new Int32Array(N); this.aStamp = new Uint32Array(N); this.aClosed = new Uint32Array(N); this.aGen = 0; }
    const gen = ++this.aGen, gS = this.aG, came = this.aC!, stamp = this.aStamp!, closedS = this.aClosed!;
    const gScore = { get: (i: number) => (stamp[i] === gen ? gS[i] : Infinity), set: (i: number, v: number, from: number) => { stamp[i] = gen; gS[i] = v; came[i] = from; } };
    const closed = { has: (i: number) => closedS[i] === gen, add: (i: number) => { closedS[i] = gen; } };
    const gx1 = Math.floor(goal / LAYERS) % this.nx, gz1 = Math.floor(Math.floor(goal / LAYERS) / this.nx);
    const heur = (id: number) => { const c = Math.floor(id / LAYERS), x = c % this.nx, z = Math.floor(c / this.nx), dx = Math.abs(x - gx1), dz = Math.abs(z - gz1); return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)); };
    const heap = new MinHeap(); gScore.set(s, 0, -1); heap.push(s, heur(s)); let it = 0;
    while (heap.size && it++ < 400000) {
      const id = heap.pop(); if (closed.has(id)) continue; closed.add(id); if (id === goal) break;
      const c = Math.floor(id / LAYERS), x = c % this.nx, z = Math.floor(c / this.nx), y = this.floors[id];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue; const ax = x + dx, az = z + dz; if (!this.inside(ax, az)) continue;
        const nc = az * this.nx + ax, k = this.layerNear(nc, y, STEP_UP); if (k < 0) continue; const nid = nc * LAYERS + k; if (!this.reach[nid] || this.blocked[nid] || closed.has(nid)) continue;
        if (dx && dz) { // không cắt góc qua ô chặn
          if (this.layerNear(z * this.nx + ax, y, STEP_UP) < 0 || this.layerNear(az * this.nx + x, y, STEP_UP) < 0) continue;
          const k1 = this.layerNear(z * this.nx + ax, y, STEP_UP), k2 = this.layerNear(az * this.nx + x, y, STEP_UP);
          if (!this.reach[(z * this.nx + ax) * LAYERS + k1] || !this.reach[(az * this.nx + x) * LAYERS + k2]) continue;
        }
        const cost = gScore.get(id) + (dx && dz ? 1.414 : 1) + Math.abs(this.floors[nid] - y) * 2;
        if (cost < gScore.get(nid)) { gScore.set(nid, cost, id); heap.push(nid, cost + heur(nid)); }
      }
    }
    if (!closed.has(goal)) return null;
    const cells: THREE.Vector3[] = []; for (let id = goal; id >= 0; id = stamp[id] === gen ? came[id] : -1) { const c = Math.floor(id / LAYERS); cells.push(new THREE.Vector3(this.x0 + ((c % this.nx) + 0.5) * CELL, this.floors[id], this.z0 + (Math.floor(c / this.nx) + 0.5) * CELL)); if (id === s) break; }
    cells.reverse();
    // nắn thẳng: bỏ điểm giữa khi đoạn thẳng nối hai đầu đi được hết
    const out = [cells[0]]; let i = 0;
    while (i < cells.length - 1) { let j = cells.length - 1; while (j > i + 1 && !this.clearLine(cells[i], cells[j])) j--; out.push(cells[j]); i = j; }
    out[out.length - 1] = to.clone().setY(out[out.length - 1].y); if (this.height(to.x, to.z, out[out.length - 1].y, 0.6) === null) out[out.length - 1] = cells[cells.length - 1];
    return out;
  }
  /** Đoạn thẳng a→b đi được hết (từng bước nửa ô, đúng bước cao). */
  clearLine(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const len = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(len / (CELL * 0.5))); let y = a.y;
    for (let i = 1; i <= n; i++) { const t = i / n, h = this.canStep(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, y); if (h === null) return false; y = h; }
    return true;
  }
  /** Ảnh mặt nạ ô đi được (cho bản đồ): mỗi điểm ảnh một ô, alpha 255 nếu đi được. */
  mask(): ImageData {
    const img = new ImageData(this.nx, this.nz);
    for (let z = 0; z < this.nz; z++) for (let x = 0; x < this.nx; x++) { const o = (z * this.nx + x) * LAYERS; let ok = false; for (let k = 0; k < LAYERS; k++) if (this.reach[o + k]) ok = true; if (ok) img.data[(z * this.nx + x) * 4 + 3] = 255; }
    return img;
  }
  private aG: Float32Array | null = null; private aC: Int32Array | null = null; private aStamp: Uint32Array | null = null; private aClosed: Uint32Array | null = null; private aGen = 0;
  /** Số ô đi được (để soát). */
  count(): number { let n = 0; for (let i = 0; i < this.reach.length; i++) n += this.reach[i]; return n; }
}

class MinHeap {
  private ids: number[] = []; private keys: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, k: number) { const a = this.ids, b = this.keys; a.push(id); b.push(k); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (b[p] <= k) break; a[i] = a[p]; b[i] = b[p]; i = p; } a[i] = id; b[i] = k; }
  pop(): number {
    const a = this.ids, b = this.keys, top = a[0], lid = a.pop()!, lk = b.pop()!; if (!a.length) return top;
    let i = 0; const n = a.length;
    for (;;) { const l = i * 2 + 1, r = l + 1; let m = i, mk = lk; if (l < n && b[l] < mk) { m = l; mk = b[l]; } if (r < n && b[r] < mk) { m = r; mk = b[r]; } if (m === i) break; a[i] = a[m]; b[i] = b[m]; i = m; }
    a[i] = lid; b[i] = lk; return top;
  }
}

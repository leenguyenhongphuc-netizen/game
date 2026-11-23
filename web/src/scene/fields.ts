// Cánh đồng lớn của nhà nông: đất thật nằm NGOÀI lô vườn đã cấp — sau lưng xóm, đi bộ theo đường đất ở đầu xóm phía đông
// (qua cầu ván nếu vùng có kênh) ra con đường bờ ruộng, rồi xuống từng khối. Mỗi khối 100 ô (10 × 10 ô, 20 × 20 m) là một thửa đất
// nông nghiệp trong sổ địa chính: có bờ, mương giữa các hàng khối, cột mốc ghi số sổ.
//
// Vẽ ít lần: đất mọi khối là MỘT lưới (màu đỉnh theo từng ô → tô lại được từng ô khi máy chạy qua), bờ + mương + đường + cột mốc gộp
// vài lưới, chữ trên cột mốc là MỘT tấm ảnh ghép; cây là InstancedMesh thưa theo khoảng cách (gần dày, xa thưa); người làm thuê và
// robot là InstancedMesh dùng chung (fieldWorkers.ts). 4.000 ô vẫn khoảng 15 lần vẽ.
//
// Hoạt cảnh làm hàng loạt KHÔNG bung từng ô: một máy chạy theo luống (giàn 2 ô, drone 3 ô), cây mọc/được gặt theo vệt máy đi qua;
// thuê người hoặc robot thì chia vùng cho từng tổ làm song song. Xem tua nhanh tối đa 25 s (shared/farm.ts bulkSceneSeconds), có nút
// bỏ qua; sau đó cảnh trở về tiến độ thật của lượt làm (máy vẫn chạy tới khi máy chủ báo xong).
import * as THREE from 'three';
import { bakeColored } from './batch.ts';
import { FieldCrews } from './fieldWorkers.ts';
import type { CrewPose } from './fieldWorkers.ts';
import { CROPS } from '../../../shared/catalog.ts';
import {
  DRIVE_MACHINES, DRIVE_MAX_SPEED, FARM_MACHINES, FIELD_BLOCK_TILES, METHOD_NAMES, WORK_NAMES, bulkSceneSeconds, crewSize, crewSpans, workSeq,
} from '../../../shared/farm.ts';
import type { FarmMachineKind, FieldPhase, WorkKind, WorkMethod } from '../../../shared/farm.ts';
import { fieldZone } from '../fieldZone.ts';
import type { FieldReq } from '../fieldZone.ts';

export interface FieldLite {
  id: number; regionId?: string; blocks: number; cropId: string | null; progress: number; color: string;
  phase?: FieldPhase; stepIndex?: number; ready?: boolean; name?: string | null;
  step?: { kind: WorkKind; name?: string } | null;
  certNos?: string[];
  drive?: { done: number; tiles: number[] } | null;
  job: { kind?: WorkKind; method: WorkMethod; machine: string | null; startedAt: number; endsAt: number } | null;
}

// ------------------------------------------------------------------ bố cục (m, toạ độ thế giới của World)
const N = 10, TILE = 2, BLOCK = N * TILE;
const DIKE = 1.2;            // bờ giữa hai khối cạnh nhau
const CANAL = 3;             // mương giữa hai hàng khối
const COLS = 8;              // số khối mỗi hàng
const STEP_X = BLOCK + DIKE, STEP_Z = BLOCK + CANAL;
const X0 = -(COLS * STEP_X - DIKE) / 2;        // mép tây cột khối đầu
const FRONT_Z = -34;                           // mép gần xóm của hàng khối đầu tiên
const ROAD_Z = -31.4, ROAD_W = 3.2;            // đường bờ ruộng chạy dọc mặt trước cánh đồng
const PATH_X = 66, PATH_W = 3.2;               // đường đất từ đường làng ra đồng (đầu xóm phía đông, ngoài dãy lô)
const VILLAGE_ROAD_Z = 15.5;                   // tim đường làng (World.ts ROAD_Z)
const MAX_BLOCKS = 40;
const LOD_DIST = 95;
const YARD_X1 = 86;                            // bãi đậu máy ở cuối đường bờ ruộng, phía đông lối ra đồng (không chắn đường)
const PARK: Record<string, { x: number; z: number }> = { may_cay: { x: 72, z: ROAD_Z }, may_gieo: { x: 77.5, z: ROAD_Z }, may_thu: { x: 83, z: ROAD_Z } };

export interface Rect { x0: number; x1: number; z0: number; z1: number }
/** Các vùng đi lại được của khu cánh đồng có `rows` hàng khối: đường đất ra đồng, đường bờ ruộng, mặt ruộng. */
export function fieldZoneRects(rows: number): Rect[] {
  if (rows <= 0) return [];
  const far = FRONT_Z - rows * STEP_Z + CANAL;
  return [
    { x0: PATH_X - PATH_W / 2, x1: PATH_X + PATH_W / 2, z0: ROAD_Z - ROAD_W / 2, z1: VILLAGE_ROAD_Z + 2 },
    { x0: X0 - 2, x1: YARD_X1, z0: ROAD_Z - ROAD_W / 2, z1: ROAD_Z + ROAD_W / 2 },
    { x0: X0 - 1, x1: -X0 + 1, z0: far - 1, z1: ROAD_Z },
  ];
}
/** Kéo điểm (x, z) vào vùng gần nhất trong `rects` nếu đang ở ngoài tất cả. */
export function clampToRects(x: number, z: number, rects: Rect[]): { x: number; z: number } {
  let best = { x, z }, bd = Infinity;
  for (const r of rects) {
    const cx = Math.min(r.x1, Math.max(r.x0, x)), cz = Math.min(r.z1, Math.max(r.z0, z)), d = (cx - x) ** 2 + (cz - z) ** 2;
    if (d === 0) return { x, z };
    if (d < bd) { bd = d; best = { x: cx, z: cz }; }
  }
  return best;
}
/** Hộp bao cả khu cánh đồng (để World làm phẳng địa hình và không trồng cây rừng lên ruộng). */
export function fieldZoneBox(rows: number): Rect | null {
  const rs = fieldZoneRects(rows); if (!rs.length) return null;
  return { x0: Math.min(...rs.map((r) => r.x0)), x1: Math.max(...rs.map((r) => r.x1)), z0: Math.min(...rs.map((r) => r.z0)), z1: ROAD_Z + ROAD_W };
}
/** Toạ độ tâm khối thứ k (đếm từ tây sang đông, gần xóm ra xa). */
export function blockCenter(k: number): { x: number; z: number } {
  const c = k % COLS, r = Math.floor(k / COLS);
  return { x: X0 + c * STEP_X + BLOCK / 2, z: FRONT_Z - r * STEP_Z - BLOCK / 2 };
}
/** Tâm ô `tile` (đánh số trong một khối: hàng × 10 + cột, hàng 0 ở mép gần xóm) của khối k. */
function tileCenter(k: number, tile: number): { x: number; z: number } {
  const c = k % COLS, r = Math.floor(k / COLS), tr = Math.floor(tile / N), tc = tile % N;
  return { x: X0 + c * STEP_X + (tc + 0.5) * TILE, z: FRONT_Z - r * STEP_Z - (tr + 0.5) * TILE };
}
/** Khối và ô dưới toạ độ (x, z); null nếu đứng trên bờ, mương hoặc ngoài ruộng. */
function tileAt(x: number, z: number): { k: number; tile: number } | null {
  const c = Math.floor((x - X0) / STEP_X), r = Math.floor((FRONT_Z - z) / STEP_Z);
  if (c < 0 || c >= COLS || r < 0) return null;
  const lx = x - (X0 + c * STEP_X), lz = FRONT_Z - r * STEP_Z - z;
  if (lx < 0 || lx >= BLOCK || lz < 0 || lz >= BLOCK) return null;
  return { k: r * COLS + c, tile: Math.floor(lz / TILE) * N + Math.floor(lx / TILE) };
}

// ------------------------------------------------------------------ máy móc
const M = (c: number) => new THREE.MeshLambertMaterial({ color: c });
function box(g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, c: number) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)); m.position.set(x, y, z); g.add(m); return m; }
function wheel(g: THREE.Group, r: number, w: number, x: number, z: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14).rotateZ(Math.PI / 2), M(0x2b2b2b)); m.position.set(x, r, z); g.add(m);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, w + 0.04, 10).rotateZ(Math.PI / 2), M(0xf2c14e)); hub.position.set(x, r, z); g.add(hub);
}
/** Máy kéo đầu hướng +z: bánh sau to, ca-bin kính, giàn phía sau (cày: răng bừa; gieo: thùng hạt; gặt: đầu cắt phía trước). */
function machineModel(kind: FarmMachineKind): THREE.Group {
  const g = new THREE.Group();
  const body = kind === 'may_thu' ? 0x3a9d3a : kind === 'may_gieo' ? 0x2f78c4 : 0xd9472b;
  if (kind === 'may_thu') {
    box(g, 2.2, 1.6, 3.6, 0, 1.6, -0.2, body); box(g, 1.5, 1.2, 1.3, 0, 3.0, 0.8, 0xdfeff7); box(g, 1.7, 0.12, 1.5, 0, 3.66, 0.8, body);
    box(g, 3.8, 0.5, 1.0, 0, 0.7, 2.4, 0xf2c14e); for (let i = -3; i <= 3; i++) box(g, 0.08, 0.08, 0.7, i * 0.55, 0.5, 3.0, 0x6b6b6b);
    box(g, 0.4, 0.4, 2.2, 1.3, 2.4, -0.6, 0xbfbfbf);
    wheel(g, 0.8, 0.5, -1.15, 0.9); wheel(g, 0.8, 0.5, 1.15, 0.9); wheel(g, 0.5, 0.4, -1.05, -1.6); wheel(g, 0.5, 0.4, 1.05, -1.6);
  } else {
    box(g, 1.1, 0.8, 2.0, 0, 1.05, 0.9, body); box(g, 1.0, 0.15, 0.4, 0, 1.0, 2.0, 0x333333);             // mũi xe, lưới tản nhiệt
    box(g, 1.4, 0.7, 1.3, 0, 1.15, -0.6, body); box(g, 1.25, 1.15, 1.1, 0, 2.05, -0.6, 0xdfeff7); box(g, 1.45, 0.12, 1.35, 0, 2.7, -0.6, body);
    box(g, 0.1, 0.6, 0.1, 0.35, 1.7, 0.9, 0x555555);                                                  // ống xả
    wheel(g, 0.75, 0.45, -0.95, -0.7); wheel(g, 0.75, 0.45, 0.95, -0.7); wheel(g, 0.42, 0.3, -0.7, 1.35); wheel(g, 0.42, 0.3, 0.7, 1.35);
    if (kind === 'may_gieo') { box(g, 3.6, 0.7, 0.9, 0, 1.0, -2.4, 0x2f78c4); box(g, 3.4, 0.2, 0.8, 0, 1.45, -2.4, 0xf2c14e); for (let i = -3; i <= 3; i++) box(g, 0.1, 0.5, 0.1, i * 0.5, 0.35, -2.4, 0x444444); }
    else { box(g, 3.6, 0.25, 0.4, 0, 0.75, -2.3, 0x6b6b6b); for (let i = -3; i <= 3; i++) box(g, 0.1, 0.6, 0.12, i * 0.55, 0.35, -2.4, 0x8a8a8a); }
  }
  return bakeColored(g, false, false);
}
function droneModel(): THREE.Group {
  const g = new THREE.Group();
  box(g, 0.9, 0.35, 0.9, 0, 0, 0, 0xf2f2f2);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 10), M(0x3a8fd8)); tank.position.y = -0.4; g.add(tank);
  for (const a of [0.785, 2.356, 3.927, 5.498]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.12), M(0x333333)); arm.rotation.y = a; arm.position.set(Math.cos(a) * 0.7, 0.1, -Math.sin(a) * 0.7); g.add(arm);
    const rot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 12), M(0x9aa3ad)); rot.position.set(Math.cos(a) * 1.35, 0.22, -Math.sin(a) * 1.35); g.add(rot);
  }
  return bakeColored(g, false, false);
}

// ------------------------------------------------------------------ màu đất từng ô
const C = (h: string) => new THREE.Color(h);
const SOIL = { trong: C('#a4744a'), cay: C('#6e4426'), cay2: C('#5a361d'), lon: C('#6a5232'), lua: C('#5f8f3a'), gat: C('#c8b06e') };

type Active = { kind: WorkKind; method: WorkMethod; machine: FarmMachineKind | null; progress: number; lane: number; crews: number; scene: boolean };
interface Slot {
  f: FieldLite; ks: number[];             // các khối (chỉ số toàn cục) của cánh đồng
  done: Uint8Array;                       // ô đã làm của việc đang làm (lượt máy chủ, xem tua, tự lái)
  doneKey: string;
  active: Active | null;
  local: Set<number>;                     // ô vừa tự lái, chưa thấy trong dữ liệu máy chủ
}

export class FieldsLayer {
  readonly group = new THREE.Group();
  private ground: THREE.Mesh | null = null;
  private groundCol: THREE.BufferAttribute | null = null;
  private fixed = new THREE.Group();      // bờ, mương, đường, cột mốc, bảng tên (dựng lại khi đổi số khối)
  private labelTex: THREE.CanvasTexture | null = null;
  private stems: THREE.InstancedMesh; private crowns: THREE.InstancedMesh; private bushes: THREE.InstancedMesh; private tufts: THREE.InstancedMesh;
  private models: Record<'may_cay' | 'may_gieo' | 'may_thu', THREE.Group> = { may_cay: machineModel('may_cay'), may_gieo: machineModel('may_gieo'), may_thu: machineModel('may_thu') };
  private drone = droneModel();
  private spray: THREE.Points;
  private crews = new FieldCrews();
  private slots: Slot[] = [];
  private blockOwner: (Slot | null)[] = [];   // khối toàn cục → cánh đồng
  private blockIdx: number[] = [];            // khối toàn cục → thứ tự khối trong cánh đồng của nó
  private lodAt = -1; private plantsDirty = true;
  private tmp = new THREE.Object3D(); private col = new THREE.Color();
  private rowsBuilt = -1; private zone = ''; private fixedKey = '';
  private parked = new Map<FarmMachineKind, { x: number; z: number; yaw: number }>();
  private seqCache = new Map<string, number[]>();
  // tự lái
  private drv: { machine: FarmMachineKind; yaw: number; speed: number; down: boolean; note: string | null; noteUntil: number } | null = null;
  // xem tua nhanh
  private scene: { fieldId: number; work: WorkKind; method: WorkMethod; machine: FarmMachineKind | null; t0: number; dur: number; title: string; sub: string; focus: { x: number; z: number }; zoom: number } | null = null;
  private route: { x: number; z: number }[] = [];
  private patchAt = 0; private focusT = 0;
  private hereKey = '';

  /** hud = true: lớp cánh đồng của World — nhận yêu cầu và báo trạng thái qua fieldZone. Trực thăng, trang thử: false. */
  private hud: boolean;
  constructor(opts: { hud?: boolean } = {}) {
    this.hud = !!opts.hud;
    const cap = MAX_BLOCKS * 64;
    const im = (g: THREE.BufferGeometry, c: number) => { const m = new THREE.InstancedMesh(g, new THREE.MeshLambertMaterial({ color: c }), cap); m.count = 0; m.frustumCulled = false; this.group.add(m); return m; };
    this.stems = im(new THREE.CylinderGeometry(0.08, 0.12, 1, 5).translate(0, 0.5, 0), 0x6b4a2b);
    this.crowns = im(new THREE.IcosahedronGeometry(0.9, 0).translate(0, 1.2, 0), 0xffffff);
    this.bushes = im(new THREE.SphereGeometry(0.55, 7, 5).scale(1, 0.7, 1).translate(0, 0.35, 0), 0xffffff);
    const tuft = new THREE.Group(); for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 4)); c.position.set(Math.cos(i * 1.26) * 0.22, 0.45, Math.sin(i * 1.26) * 0.22); c.rotation.z = Math.cos(i * 1.26) * 0.25; c.rotation.x = Math.sin(i * 1.26) * 0.25; c.updateMatrix(); tuft.add(c); }
    const tg = (() => { const gs: THREE.BufferGeometry[] = []; tuft.children.forEach((o) => { const m = o as THREE.Mesh; gs.push(m.geometry.clone().applyMatrix4(m.matrix)); }); const merged = mergeAll(gs); return merged; })();
    this.tufts = im(tg, 0xffffff);
    for (const m of Object.values(this.models)) { m.visible = false; this.group.add(m); }
    this.drone.visible = false; this.group.add(this.drone);
    const n = 140, pos = new Float32Array(n * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.spray = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfe6ff, size: 0.25, transparent: true, opacity: 0.7, depthWrite: false }));
    this.spray.visible = false; this.spray.frustumCulled = false;
    this.group.add(this.spray, this.crews.group, this.fixed);
    this.group.name = 'canh-dong';
  }

  /** Số hàng khối đang dựng (World dùng để làm phẳng đất, mở đường đi). */
  rows(): number { return this.blockOwner.length ? Math.ceil(this.blockOwner.length / COLS) : 0; }
  get driving(): boolean { return !!this.drv; }
  get routing(): boolean { return this.route.length > 0; }
  get sceneActive(): boolean { return !!this.scene; }

  /** Nhận danh sách cánh đồng (GET /api/fields, chỉ vùng đang xem) và dựng lại. Gọi bao nhiêu lần cũng được. */
  set(fields: FieldLite[], opts: { zone?: string } = {}) {
    const old = new Map(this.slots.map((s) => [s.f.id, s]));
    this.slots = []; this.blockOwner = []; this.blockIdx = [];
    let k = 0;
    for (const f of fields) {
      if (k >= MAX_BLOCKS) break;
      const ks: number[] = [];
      for (let i = 0; i < f.blocks && k < MAX_BLOCKS; i++) ks.push(k++);
      const prev = old.get(f.id);
      // ô tự lái đã có trong dữ liệu máy chủ thì thôi giữ ở máy này; bước đã đổi thì bỏ hết
      const local = new Set<number>();
      if (prev && prev.f.stepIndex === f.stepIndex) for (const t of prev.local) if (!f.drive?.tiles.includes(t)) local.add(t);
      const s: Slot = { f, ks, done: new Uint8Array(ks.length * FIELD_BLOCK_TILES), doneKey: '', active: null, local };
      this.slots.push(s);
      ks.forEach((g, i) => { this.blockOwner[g] = s; this.blockIdx[g] = i; });
    }
    if (opts.zone !== undefined) this.zone = opts.zone;
    const fixedKey = `${this.blockOwner.length}|${this.zone}|${this.slots.map((s) => `${s.f.id}:${s.f.blocks}:${s.f.name ?? ''}:${(s.f.certNos ?? []).join(',')}`).join(';')}`;
    if (fixedKey !== this.fixedKey) { this.fixedKey = fixedKey; this.buildFixed(); }
    if (this.rowsBuilt !== this.blockOwner.length) this.buildGround();
    for (const s of this.slots) s.doneKey = '';
    this.plantsDirty = true;
    if (this.hud) fieldZone.patch({ present: this.slots.length > 0 });
  }

  // ---------------------------------------------------------------- dựng phần tĩnh
  private buildFixed() {
    for (const o of [...this.fixed.children]) { this.fixed.remove(o); o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); }
    this.labelTex?.dispose(); this.labelTex = null;
    const n = this.blockOwner.length; if (!n) return;
    const rows = Math.ceil(n / COLS), g = new THREE.Group();
    const dike = M(0x7cae55), dikeTop = M(0x8fbf63), dirt = M(0xc49a6c), dirt2 = M(0xb08758), water = M(0x5fb2cc), post = M(0xe8e4da), postTop = M(0xd8463b), plank = M(0x9a6a3c), rail = M(0x6e4a2a);
    const add = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); };
    const usedCols = Math.min(COLS, n), xa = X0 - DIKE, xb = X0 + usedCols * STEP_X;
    for (let r = 0; r < rows; r++) {
      const zNear = FRONT_Z - r * STEP_Z, inRow = Math.min(COLS, n - r * COLS);
      // bờ quanh từng khối (cao 25 cm) — bờ dọc giữa các khối, bờ ngang trước/sau mỗi hàng
      for (let c = 0; c <= inRow; c++) add(DIKE, 0.25, BLOCK + 0.6, X0 + c * STEP_X - DIKE / 2, 0.12, zNear - BLOCK / 2, dike);
      const w = inRow * STEP_X + DIKE;
      add(w, 0.26, 0.7, X0 - DIKE + w / 2, 0.13, zNear + 0.35, dikeTop); add(w, 0.26, 0.7, X0 - DIKE + w / 2, 0.13, zNear - BLOCK - 0.35, dikeTop);
      // mương nước giữa hàng này và hàng sau (hàng cuối: mương thoát nước)
      add(w, 0.05, CANAL - 1.4, X0 - DIKE + w / 2, 0.0, zNear - BLOCK - CANAL / 2, water);
    }
    // đường bờ ruộng dọc mặt trước + đường đất từ đường làng ra đồng
    const roadX0 = Math.min(xa - 1, X0 - 2), roadX1 = YARD_X1;
    add(roadX1 - roadX0, 0.06, ROAD_W, (roadX0 + roadX1) / 2, 0.03, ROAD_Z, dirt);
    const pathZ1 = VILLAGE_ROAD_Z - 2, pathZ0 = ROAD_Z + ROAD_W / 2;
    add(PATH_W, 0.06, pathZ1 - pathZ0, PATH_X, 0.035, (pathZ0 + pathZ1) / 2, dirt2);
    for (let z = pathZ0 + 2; z < pathZ1 - 1; z += 3.1) add(0.5, 0.07, 0.5, PATH_X + (z % 2 > 1 ? 0.7 : -0.8), 0.07, z, dirt); // vết bánh, đá lát
    add(YARD_X1 - PATH_X - 3, 0.07, ROAD_W + 1.6, (PATH_X + 3 + YARD_X1) / 2, 0.04, ROAD_Z, dirt2);   // bãi đậu máy
    if (this.zone === 'nam') { // vùng có kênh sau xóm: cầu ván qua kênh
      for (let z = -28.4; z <= -21.6; z += 0.55) add(PATH_W + 0.6, 0.12, 0.45, PATH_X, 0.32, z, plank);
      for (const s of [-1, 1]) { add(0.12, 0.7, 7.4, PATH_X + s * (PATH_W / 2 + 0.25), 0.7, -25, rail); for (let z = -28.4; z <= -21.6; z += 1.7) add(0.14, 0.9, 0.14, PATH_X + s * (PATH_W / 2 + 0.25), 0.45, z, rail); }
    }
    // cột mốc mỗi khối (góc gần đường, trên bờ) + bảng số sổ
    const boards: THREE.BufferGeometry[] = [];
    const cols = 4, cellW = 256, cellH = 72, rowsAt = Math.ceil(n / cols);
    const canvas = document.createElement('canvas'); canvas.width = cols * cellW; canvas.height = rowsAt * cellH;
    const ctx = canvas.getContext('2d')!;
    for (let k = 0; k < n; k++) {
      const s = this.blockOwner[k]!, i = this.blockIdx[k], c = blockCenter(k);
      const px = c.x - BLOCK / 2 - DIKE / 2, pz = c.z + BLOCK / 2 + 0.35;
      add(0.22, 1.2, 0.22, px, 0.6, pz, post); add(0.26, 0.18, 0.26, px, 1.25, pz, postTop);
      const cert = s.f.certNos?.[i] ?? null, crop = s.f.name ?? 'Đất trống';
      const cx = (k % cols) * cellW, cy = Math.floor(k / cols) * cellH;
      drawBoard(ctx, cx, cy, cellW, cellH, cert ?? `Khối ${i + 1}`, `${cert ? `Khối ${i + 1}/${s.f.blocks} · ` : ''}${crop}`);
      const bg = new THREE.PlaneGeometry(3.4, 0.95);
      const uv = bg.attributes.uv as THREE.BufferAttribute;
      for (let v = 0; v < uv.count; v++) uv.setXY(v, (cx + uv.getX(v) * cellW) / canvas.width, 1 - (cy + (1 - uv.getY(v)) * cellH) / canvas.height);
      bg.rotateX(-0.45); bg.translate(px + 1.8, 1.65, pz + 0.05); boards.push(bg);
      add(0.1, 1.2, 0.1, px + 3.4, 0.95, pz, post);
    }
    const baked = bakeColored(g, false, true); for (const m of baked.children) (m as THREE.Mesh).name = 'canh-dong-tinh';
    this.fixed.add(baked);
    this.labelTex = new THREE.CanvasTexture(canvas); this.labelTex.colorSpace = THREE.SRGBColorSpace; this.labelTex.anisotropy = 4;
    const bm = new THREE.Mesh(mergeAll(boards), new THREE.MeshBasicMaterial({ map: this.labelTex, transparent: true, depthWrite: false }));
    bm.name = 'canh-dong-cot-moc'; bm.renderOrder = 2; this.fixed.add(bm);
    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
  }

  /** Một lưới cho mặt đất mọi khối: mỗi ô 2 tam giác, màu đỉnh riêng → tô lại từng ô được. */
  private buildGround() {
    if (this.ground) { this.group.remove(this.ground); this.ground.geometry.dispose(); (this.ground.material as THREE.Material).dispose(); }
    this.ground = null; this.groundCol = null; this.rowsBuilt = this.blockOwner.length;
    const n = this.blockOwner.length; if (!n) return;
    const pos = new Float32Array(n * 100 * 18), col = new Float32Array(n * 100 * 18);
    let p = 0;
    for (let k = 0; k < n; k++) for (let t = 0; t < 100; t++) {
      const c = tileCenter(k, t), h = TILE / 2, xa = c.x - h, xb = c.x + h, za = c.z - h, zb = c.z + h;
      const v = [xa, za, xa, zb, xb, za, xb, za, xa, zb, xb, zb];
      for (let j = 0; j < 6; j++) { pos[p * 3] = v[j * 2]; pos[p * 3 + 1] = 0.02; pos[p * 3 + 2] = v[j * 2 + 1]; p++; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.groundCol = new THREE.BufferAttribute(col, 3); this.groundCol.setUsage(THREE.DynamicDrawUsage); g.setAttribute('color', this.groundCol);
    g.computeVertexNormals();
    this.ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.ground.receiveShadow = true; this.ground.name = 'canh-dong-dat';
    this.group.add(this.ground);
    for (const s of this.slots) s.doneKey = '';
  }

  private seq(blocks: number, lane: number): number[] {
    const key = `${blocks}|${lane}`; let s = this.seqCache.get(key);
    if (!s) { s = workSeq(blocks, lane); this.seqCache.set(key, s); }
    return s;
  }

  /** Việc đang làm trên cánh đồng (ưu tiên đang xem tua, rồi lượt của máy chủ, rồi tự lái). */
  private activeOf(s: Slot, now: number, t: number): Active | null {
    const tiles = s.ks.length * 100;
    if (this.scene?.fieldId === s.f.id) {
      const sc = this.scene, m = sc.method, k = Math.min(1, Math.max(0, (t - sc.t0) / sc.dur));
      return { kind: sc.work, method: m, machine: sc.machine, progress: k * k * (3 - 2 * k), lane: m === 'drone' ? 3 : m === 'may' ? 2 : 1, crews: m === 'thue' || m === 'robot' ? crewSize(tiles) : 1, scene: true };
    }
    const j = s.f.job;
    if (j) {
      const span = Math.max(1, j.endsAt - j.startedAt), p = Math.min(1, Math.max(0, (now - j.startedAt) / span));
      const kind = j.kind ?? s.f.step?.kind ?? 'khac', m = j.method;
      return { kind, method: m, machine: (j.machine as FarmMachineKind | null) ?? null, progress: p, lane: m === 'drone' ? 3 : m === 'may' ? 2 : 1, crews: m === 'thue' || m === 'robot' ? crewSize(tiles) : 1, scene: false };
    }
    if ((s.f.drive?.tiles.length || s.local.size) && s.f.step) return { kind: s.f.step.kind, method: 'may', machine: null, progress: 0, lane: 2, crews: 1, scene: false };
    return null;
  }

  /** Cập nhật cờ "đã làm" của từng ô theo việc đang làm; tô lại màu đất khi có thay đổi. */
  private refreshDone(s: Slot, a: Active | null) {
    const tiles = s.ks.length * 100;
    const q = a ? Math.round(a.progress * 400) : -1, driveN = (s.f.drive?.tiles.length ?? 0) + s.local.size;
    const key = a ? `${a.kind}|${a.method}|${a.crews}|${a.lane}|${q}|${driveN}|${s.f.phase}` : `none|${s.f.phase}|${s.f.cropId}`;
    if (key === s.doneKey) return false;
    s.doneKey = key; s.done.fill(0);
    if (a) {
      if (a.progress > 0) {
        const seq = this.seq(s.ks.length, a.lane);
        for (const [x, y] of crewSpans(seq.length, a.crews)) { const upto = x + Math.floor((y - x) * a.progress); for (let i = x; i < upto; i++) s.done[seq[i]] = 1; }
      }
      if (!a.scene) { for (const t of s.f.drive?.tiles ?? []) if (t < tiles) s.done[t] = 1; for (const t of s.local) s.done[t] = 1; }
    }
    s.active = a;
    this.paint(s);
    return true;
  }

  private paint(s: Slot) {
    const col = this.groundCol; if (!col) return;
    const arr = col.array as Float32Array, f = s.f, a = s.active, phase = f.phase ?? (f.cropId ? 'lon' : 'trong');
    const lua = f.cropId ? CROPS[f.cropId]?.kind === 'lua' : false, c = this.col;
    s.ks.forEach((g, bi) => {
      for (let t = 0; t < 100; t++) {
        const idx = bi * 100 + t, done = s.done[idx] === 1, row = Math.floor(t / 10), stripe = row % 2 === 0 ? 1 : 0.9;
        let st: FieldPhase | 'gat' = phase;
        if (a && done) st = a.kind === 'dat' ? 'cay' : a.kind === 'gieo' ? 'lon' : a.kind === 'thu' ? 'gat' : phase;
        if (st === 'trong') c.copy(SOIL.trong); else if (st === 'cay') c.copy(row % 2 ? SOIL.cay2 : SOIL.cay); else if (st === 'gat') c.copy(SOIL.gat);
        else c.copy(lua ? SOIL.lua : SOIL.lon);
        c.multiplyScalar(stripe);
        if (a && done && a.kind === 'tuoi') c.multiplyScalar(0.78);
        if (a && done && a.kind === 'bon') c.lerp(SOIL.cay2, 0.25);
        const tc = t % 10; if (row === 0 || tc === 0 || row === 9 || tc === 9) c.multiplyScalar(0.93);
        const base = (g * 100 + t) * 18;
        for (let v = 0; v < 6; v++) { arr[base + v * 3] = c.r; arr[base + v * 3 + 1] = c.g; arr[base + v * 3 + 2] = c.b; }
      }
    });
    col.needsUpdate = true;
    this.plantsDirty = true;
  }

  /** Cây thưa theo khoảng cách tới máy quay, ẩn/hiện theo ô đã gieo, đã gặt. */
  private buildPlants(cam: THREE.Vector3) {
    let ns = 0, nb = 0, nt = 0;
    for (let k = 0; k < this.blockOwner.length; k++) {
      const s = this.blockOwner[k]!, f = s.f, bi = this.blockIdx[k];
      if (!f.cropId) continue;
      const phase = f.phase ?? 'lon', a = s.active, kind = CROPS[f.cropId]?.kind ?? 'trai';
      const shown = (tile: number) => {
        const done = s.done[bi * 100 + tile] === 1;
        if (a?.kind === 'gieo') return done || phase === 'lon' || phase === 'chin';
        if (a?.kind === 'thu') return !done;
        return phase === 'lon' || phase === 'chin';
      };
      const ctr = blockCenter(k), near = Math.hypot(cam.x - ctr.x, cam.z - ctr.z) < LOD_DIST;
      const tree = kind === 'trai' || kind === 'cn' || kind === 'leo', rice = kind === 'lua';
      const m = rice ? (near ? 8 : 3) : tree ? (near ? 5 : 2) : (near ? 6 : 3), cell = BLOCK / m;
      const grow = a?.kind === 'gieo' ? 0.25 : 0;
      const h = Math.max(0.3, 0.35 + f.progress * 1.1 + grow);
      this.col.set(f.color);
      for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
        const tile = Math.min(9, Math.floor(((i + 0.5) * N) / m)) * N + Math.min(9, Math.floor(((j + 0.5) * N) / m));
        if (!shown(tile)) continue;
        const jitter = ((i * 7 + j * 13 + k * 5) % 10) / 10 - 0.5;
        this.tmp.position.set(ctr.x - BLOCK / 2 + (j + 0.5) * cell + jitter * 0.6, 0, ctr.z + BLOCK / 2 - (i + 0.5) * cell - jitter * 0.6);
        this.tmp.rotation.set(0, jitter * 3, 0);
        if (rice) {
          const sc = near ? 1.25 : 2.6; this.tmp.scale.set(sc, Math.max(0.4, h * 0.8) * (near ? 1 : 1.2), sc); this.tmp.updateMatrix();
          this.tufts.setMatrixAt(nt, this.tmp.matrix); this.tufts.setColorAt(nt, this.col); nt++;
        } else if (tree) {
          const sc = near ? 1 : 2.2; this.tmp.scale.set(sc, h * (near ? 1 : 1.3), sc); this.tmp.updateMatrix();
          this.stems.setMatrixAt(ns, this.tmp.matrix); this.crowns.setMatrixAt(ns, this.tmp.matrix); this.crowns.setColorAt(ns, this.col); ns++;
        } else {
          const sc = (near ? 1 : 2) * (0.7 + f.progress * 0.6); this.tmp.scale.set(sc, sc, sc); this.tmp.updateMatrix();
          this.bushes.setMatrixAt(nb, this.tmp.matrix); this.bushes.setColorAt(nb, this.col); nb++;
        }
      }
    }
    this.stems.count = ns; this.crowns.count = ns; this.bushes.count = nb; this.tufts.count = nt;
    for (const im of [this.stems, this.crowns, this.bushes, this.tufts]) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }

  // ---------------------------------------------------------------- đi lại, máy quay, tự lái (World gọi)
  /** Vùng đi lại được (cộng thêm vùng xóm của World). */
  walkRects(): Rect[] { return fieldZoneRects(this.rows()); }

  /** Điểm kế tiếp của chuyến "Ra đồng"; null khi không có chuyến. World gán làm đích chạy tới. */
  nextWaypoint(pos: { x: number; z: number }): { x: number; z: number } | null {
    while (this.route.length && Math.hypot(this.route[0].x - pos.x, this.route[0].z - pos.z) < 0.8) this.route.shift();
    if (!this.route.length) { if (fieldZone.get().routing) fieldZone.patch({ routing: false }); return null; }
    return this.route[0];
  }
  cancelRoute() { if (this.route.length) { this.route = []; fieldZone.patch({ routing: false }); } }

  private planRoute(from: { x: number; z: number }, fieldId: number | null) {
    const s = this.slots.find((x) => x.f.id === fieldId) ?? this.slots[0]; if (!s) return;
    const k = s.ks[0], c = blockCenter(k), pts: { x: number; z: number }[] = [];
    const inZone = from.z < ROAD_Z + ROAD_W || (Math.abs(from.x - PATH_X) < PATH_W && from.z < VILLAGE_ROAD_Z);
    if (!inZone) {
      if (Math.abs(from.x) < 9.6 && from.z < 8.5) pts.push({ x: 0, z: 10.5 });   // trong vườn nhà: ra cổng trước
      pts.push({ x: pts.length ? 0 : from.x, z: VILLAGE_ROAD_Z }, { x: PATH_X, z: VILLAGE_ROAD_Z }, { x: PATH_X, z: ROAD_Z });
    } else if (from.z > ROAD_Z + ROAD_W / 2) pts.push({ x: PATH_X, z: ROAD_Z });
    pts.push({ x: c.x - BLOCK / 2 + 1.5, z: ROAD_Z }, { x: c.x - BLOCK / 2 + 1.5, z: c.z + BLOCK / 2 - 1.5 });
    this.route = pts; fieldZone.patch({ routing: true });
  }

  /** Máy quay: đang xem tua thì bám máy dẫn đầu (lùi xa theo cỡ ruộng); đang lái thì lùi xa một chút. */
  camFocus(): { x: number; z: number; zoom: number } | null {
    if (this.scene) return { x: this.scene.focus.x, z: this.scene.focus.z, zoom: this.scene.zoom };
    if (this.drv) return null;
    return null;
  }
  camZoom(): number { return this.drv ? 1.3 : 1; }

  /** Đang lái máy: cần điều khiển (x phải, z xuống màn hình) → hướng và tốc độ; cập nhật `pos` (vị trí người chơi = vị trí máy). */
  driveStep(dt: number, input: { x: number; z: number }, pos: THREE.Vector3, t: number) {
    const d = this.drv; if (!d) return;
    const mag = Math.min(1, Math.hypot(input.x, input.z));
    if (mag > 0.15) {
      const want = Math.atan2(input.x, input.z); let diff = want - d.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      d.yaw += Math.sign(diff) * Math.min(Math.abs(diff), dt * 1.9);
      const align = Math.max(0.15, Math.cos(Math.min(Math.PI / 2, Math.abs(diff))));
      d.speed += (mag * DRIVE_MAX_SPEED * 0.92 * align - d.speed) * Math.min(1, dt * 2.2);
    } else d.speed += (0 - d.speed) * Math.min(1, dt * 3);
    const fx = Math.sin(d.yaw), fz = Math.cos(d.yaw), step = d.speed * dt;
    let nx = pos.x + fx * step, nz = pos.z + fz * step;
    for (const [mk, q] of this.parkedSpots()) { // không lái xuyên qua máy khác đang đậu
      if (mk === d.machine) continue;
      if (Math.hypot(nx - q.x, nz - q.z) < 3.2 && Math.hypot(nx - q.x, nz - q.z) < Math.hypot(pos.x - q.x, pos.z - q.z)) { nx = pos.x; nz = pos.z; d.speed *= 0.3; }
    }
    const cl = clampToRects(nx, nz, this.walkRects());
    const moved = Math.hypot(cl.x - pos.x, cl.z - pos.z);
    pos.set(cl.x, 0, cl.z);
    const model = this.models[d.machine as 'may_cay'] ?? this.models.may_cay;
    model.visible = true; model.position.set(pos.x, Math.abs(Math.sin(t * 12)) * 0.03 * Math.min(1, d.speed / 3), pos.z); model.rotation.y = d.yaw;
    this.parked.set(d.machine, { x: pos.x, z: pos.z, yaw: d.yaw });
    fieldZone.addTravel(moved, dt);
    if (!d.down || d.speed < 0.3) return;
    // giàn phía sau máy (gặt: đầu cắt phía trước), rộng 2 ô: lấy 4 điểm ngang giàn
    const back = d.machine === 'may_thu' ? 2.4 : -2.4, rx = Math.cos(d.yaw), rz = -Math.sin(d.yaw);
    const fresh = new Map<Slot, number[]>();
    for (const off of [-1.6, -0.55, 0.55, 1.6]) {
      const x = pos.x + fx * back + rx * off, z = pos.z + fz * back + rz * off, hit = tileAt(x, z);
      if (!hit || hit.k >= this.blockOwner.length) continue;
      const s = this.blockOwner[hit.k]!, idx = this.blockIdx[hit.k] * 100 + hit.tile;
      if (!this.drivable(s, d.machine)) continue;
      if (s.local.has(idx) || s.f.drive?.tiles.includes(idx)) continue;
      s.local.add(idx); (fresh.get(s) ?? fresh.set(s, []).get(s)!).push(idx);
    }
    for (const [s, tiles] of fresh) { fieldZone.addDriven(s.f.id, tiles, 0, 0); s.doneKey = ''; }
  }

  private parkedSpots(): [FarmMachineKind, { x: number; z: number }][] {
    return fieldZone.machines().filter((mk) => mk in this.models).map((mk) => [mk, this.parked.get(mk) ?? PARK[mk]]);
  }
  /** Cánh đồng này có việc cho máy `m` lúc này không (đúng việc, tới giờ, không có lượt khác đang chạy). */
  private drivable(s: Slot, m: FarmMachineKind): boolean {
    const st = s.f.step; return !!st && !!s.f.ready && !s.f.job && FARM_MACHINES[m].works.includes(st.kind);
  }

  // ---------------------------------------------------------------- mỗi khung
  /** Mỗi khung: xử lý yêu cầu từ giao diện, tiến độ từng cánh đồng, máy/người/robot, xem tua; báo trạng thái cho giao diện. */
  update(t: number, now: number, cam: THREE.Vector3, player?: THREE.Vector3) {
    if (this.hud) for (const r of fieldZone.take()) this.handle(r, t, player);
    if (!this.slots.length) return;
    // tiến độ và tô đất
    let changed = false;
    for (const s of this.slots) changed = this.refreshDone(s, this.activeOf(s, now, t)) || changed;
    if (changed || t - this.lodAt > 1 || this.plantsDirty) { this.lodAt = t; this.plantsDirty = false; this.buildPlants(cam); }
    // máy, drone, tổ làm thuê
    for (const [k, m] of Object.entries(this.models)) m.visible = this.drv?.machine === k;
    this.drone.visible = false; this.spray.visible = false;
    const people: CrewPose[] = [], robots: CrewPose[] = [];
    const used = new Set<string>(this.drv ? [this.drv.machine] : []);
    let lead: { x: number; z: number } | null = null;
    for (const s of this.slots) {
      const a = s.active; if (!a || (a.progress <= 0 && !a.scene) || a.progress >= 1) continue;
      if (!a.scene && !s.f.job) continue;
      const seq = this.seq(s.ks.length, a.lane), spans = crewSpans(seq.length, a.crews);
      const poses = spans.map(([x, y]) => this.poseAt(s, seq, x + (y - x) * a.progress, a.lane));
      if (a.method === 'may' || a.method === 'drone') {
        const p = poses[0];
        if (a.method === 'drone') {
          this.drone.visible = true; this.drone.position.set(p.x, 3.4 + Math.sin(t * 3) * 0.15, p.z); this.drone.rotation.y = p.yaw;
          const at = this.spray.geometry.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < at.count; i++) { const ph = (i / at.count + t * 1.3) % 1; at.setXYZ(i, p.x + Math.sin(i * 12.9) * 2.4 * ph, 3.0 - ph * 2.9, p.z + Math.cos(i * 7.3) * 2.4 * ph); }
          at.needsUpdate = true; this.spray.visible = true;
        } else {
          const mk = (a.machine && a.machine in this.models ? a.machine : a.kind === 'thu' ? 'may_thu' : a.kind === 'gieo' ? 'may_gieo' : 'may_cay') as keyof typeof this.models;
          const m = this.models[mk]; m.visible = true; m.position.set(p.x, Math.abs(Math.sin(t * 12)) * 0.03, p.z); m.rotation.y = p.yaw; used.add(mk);
          if (a.kind === 'tuoi' || a.kind === 'phun' || a.kind === 'bon') { // máy kéo bình phun: vệt sương phía sau
            const at = this.spray.geometry.attributes.position as THREE.BufferAttribute;
            for (let i = 0; i < at.count; i++) { const ph = (i / at.count + t * 1.6) % 1; at.setXYZ(i, p.x - Math.sin(p.yaw) * 2.5 + Math.sin(i * 12.9) * 2 * ph, 1.2 - ph * 1.1, p.z - Math.cos(p.yaw) * 2.5 + Math.cos(i * 7.3) * 0.8 * ph); }
            at.needsUpdate = true; this.spray.visible = true;
          }
        }
        if (this.scene?.fieldId === s.f.id) lead = p;
      } else {
        const list = a.method === 'robot' ? robots : people;
        for (const p of poses) list.push({ ...p, working: true });
        if (this.scene?.fieldId === s.f.id) lead = { x: poses.reduce((q, p) => q + p.x, 0) / poses.length, z: poses.reduce((q, p) => q + p.z, 0) / poses.length };
      }
    }
    this.crews.set(people, robots, t);
    // máy đang có mà không làm việc: đậu bên đường bờ ruộng
    for (const mk of this.hud ? fieldZone.machines() : []) {
      if (!(mk in this.models) || used.has(mk)) continue;
      const m = this.models[mk as keyof typeof this.models], p = this.parked.get(mk) ?? { ...PARK[mk], yaw: -Math.PI / 2 };
      m.visible = true; m.position.set(p.x, 0, p.z); m.rotation.y = p.yaw;
    }
    // xem tua nhanh
    if (this.scene) {
      const sc = this.scene, k = (t - sc.t0) / sc.dur;
      // máy quay bám KHỐI đang làm của máy/tổ dẫn đầu (không bám từng vòng quay đầu) → khung hình đứng yên, thấy cả khối đổi màu dần
      if (lead) { const hit = tileAt(lead.x, lead.z), c0 = hit ? blockCenter(hit.k) : lead, c = { x: c0.x, z: c0.z - 10 }, w = 1 - Math.exp(-(t - this.focusT) * 2.5); sc.focus.x += (c.x - sc.focus.x) * w; sc.focus.z += (c.z - sc.focus.z) * w; }
      this.focusT = t;
      if (k >= 1.06) { this.scene = null; const sl = this.slots.find((x) => x.f.id === sc.fieldId); if (sl) sl.doneKey = ''; }
    }
    if (this.hud && t - this.patchAt > 0.2) { this.patchAt = t; this.report(t, now, player); }
  }

  /** Vị trí và hướng của máy/tổ khi đã đi được `at` ô trên đường chạy (nội suy giữa hai ô cho mượt). */
  private poseAt(s: Slot, seq: number[], at: number, lane: number): { x: number; z: number; yaw: number } {
    const i = Math.max(0, Math.min(seq.length - 1, Math.floor(at))), j = Math.min(seq.length - 1, i + 1), fr = Math.max(0, Math.min(1, at - i));
    const ta = seq[i], tb = seq[j];
    const pa = this.laneCenter(s, ta, lane), pb = this.laneCenter(s, tb, lane);
    const x = pa.x + (pb.x - pa.x) * fr, z = pa.z + (pb.z - pa.z) * fr;
    let yaw = Math.atan2(pb.x - pa.x, pb.z - pa.z); if (!Number.isFinite(yaw) || (pa.x === pb.x && pa.z === pb.z)) yaw = Math.PI / 2;
    return { x, z, yaw };
  }
  /** Tâm dải luống chứa ô (máy giàn 2 ô chạy giữa hai hàng). */
  private laneCenter(s: Slot, idx: number, lane: number): { x: number; z: number } {
    const bi = Math.floor(idx / 100), t = idx % 100, row = Math.floor(t / 10), r0 = Math.floor(row / lane) * lane;
    const mid = Math.min(9, r0 + (lane - 1) / 2), c = tileCenter(s.ks[bi], (t % 10));
    return { x: c.x, z: c.z - mid * TILE };
  }

  private handle(r: FieldReq, t: number, player?: THREE.Vector3) {
    if (r.kind === 'goto') { if (r.fieldId === null) this.cancelRoute(); else if (player) this.planRoute(player, r.fieldId); return; }
    if (r.kind === 'skip') { if (this.scene) { const id = this.scene.fieldId; this.scene = null; const sl = this.slots.find((x) => x.f.id === id); if (sl) sl.doneKey = ''; } return; }
    if (r.kind === 'scene') {
      const s = this.slots.find((x) => x.f.id === r.fieldId); if (!s) return;
      const tiles = s.ks.length * 100, c = blockCenter(s.ks[0]), crews = r.method === 'thue' || r.method === 'robot' ? crewSize(tiles) : 1;
      const who = r.method === 'may' ? (r.machine ? FARM_MACHINES[r.machine].name : 'máy') : r.method === 'drone' ? 'drone' : r.method === 'tay' ? 'bạn tự làm' : `${crews} ${r.method === 'robot' ? 'robot' : 'tổ thợ'}`;
      this.scene = { fieldId: s.f.id, work: r.work, method: r.method, machine: r.machine, t0: t, dur: bulkSceneSeconds(tiles),
        title: `⏩ ${WORK_NAMES[r.work]} ${tiles.toLocaleString('vi-VN')} ô · ${who}`, sub: r.label || METHOD_NAMES[r.method],
        focus: { x: c.x, z: c.z - 10 }, zoom: Math.min(3.4, 2.5 + s.ks.length * 0.1) };
      s.doneKey = '';
      return;
    }
    if (r.kind === 'drive') {
      if (r.on && !this.drv && player) {
        const near = this.nearMachine(player); if (!near) return;
        const p = this.parked.get(near) ?? { ...PARK[near], yaw: -Math.PI / 2 };
        player.set(p.x, 0, p.z);
        this.drv = { machine: near, yaw: p.yaw, speed: 0, down: false, note: null, noteUntil: 0 };
        this.cancelRoute();
      } else if (!r.on && this.drv && player) {
        const d = this.drv; this.parked.set(d.machine, { x: player.x, z: player.z, yaw: d.yaw });
        const side = clampToRects(player.x + Math.cos(d.yaw) * 2.2, player.z - Math.sin(d.yaw) * 2.2, this.walkRects());
        player.set(side.x, 0, side.z); this.drv = null;
      }
      return;
    }
    if (r.kind === 'implement') { if (this.drv) this.drv.down = r.down ?? !this.drv.down; return; }
    if (r.kind === 'synced') {
      const s = this.slots.find((x) => x.f.id === r.fieldId); if (!s) return;
      if (!r.ok) { for (const t2 of r.tiles) s.local.delete(t2); s.doneKey = ''; if (this.drv) { this.drv.note = r.note ?? 'Máy chủ không nhận đoạn vừa lái.'; this.drv.noteUntil = t + 4; } }
    }
  }

  private nearMachine(p: { x: number; z: number }): FarmMachineKind | null {
    let best: FarmMachineKind | null = null, bd = 3.4;
    for (const mk of fieldZone.machines()) {
      if (!DRIVE_MACHINES.includes(mk)) continue;
      const q = this.parked.get(mk) ?? PARK[mk]; if (!q) continue;
      const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = mk; }
    }
    return best;
  }

  private report(t: number, now: number, player?: THREE.Vector3) {
    const p = player ?? new THREE.Vector3(0, 0, 99);
    const inZone = p.z < ROAD_Z + ROAD_W || (Math.abs(p.x - PATH_X) < PATH_W && p.z < VILLAGE_ROAD_Z - 2);
    const hit = tileAt(p.x, p.z), s = hit && hit.k < this.blockOwner.length ? this.blockOwner[hit.k] : null;
    const here = s && hit ? { fieldId: s.f.id, cert: s.f.certNos?.[this.blockIdx[hit.k]] ?? null, block: this.blockIdx[hit.k] + 1 } : null;
    const near = !this.drv && player ? this.nearMachine(player) : null;
    const jobs = this.slots.filter((x) => x.f.job).map((x) => {
      const j = x.f.job!, span = Math.max(1, j.endsAt - j.startedAt);
      return { fieldId: x.f.id, label: `${x.f.name ?? 'Cánh đồng'} · ${WORK_NAMES[j.kind ?? x.f.step?.kind ?? 'khac']}`, method: j.method, progress: Math.min(1, Math.max(0, (now - j.startedAt) / span)), endsAt: j.endsAt };
    });
    let driving = null;
    if (this.drv) {
      const d = this.drv, ds = here ? this.slots.find((x) => x.f.id === here.fieldId) ?? null : null, total = ds ? ds.ks.length * 100 : 0;
      const doneN = ds ? (ds.f.drive?.tiles.length ?? 0) + ds.local.size : 0;
      const can = ds ? this.drivable(ds, d.machine) : false;
      const note = d.note && t < d.noteUntil ? d.note : ds && !can ? (ds.f.job ? 'Ruộng này đang có lượt làm khác.' : ds.f.step ? `Ruộng này đang cần "${ds.f.step.name ?? WORK_NAMES[ds.f.step.kind]}", không phải việc của máy này.` : 'Ruộng chưa trồng gì.') : null;
      driving = { machine: d.machine, implementDown: d.down, fieldId: ds?.f.id ?? null, done: doneN, total, kind: ds?.f.step?.kind ?? null, speed: Math.round(d.speed * 3.6), note };
    }
    const key = JSON.stringify([inZone, here, near, driving, !!this.scene, jobs.map((j) => [j.fieldId, Math.round(j.progress * 100)])]);
    if (key === this.hereKey && !this.scene) return;
    this.hereKey = key;
    fieldZone.patch({
      inZone, here, jobs, driving,
      canDrive: near ? { machine: near, label: `Lên ${FARM_MACHINES[near].name.toLowerCase()}` } : null,
      scene: this.scene ? { fieldId: this.scene.fieldId, title: this.scene.title, sub: this.scene.sub, t: Math.min(this.scene.dur, t - this.scene.t0), dur: this.scene.dur } : null,
    });
  }

  dispose() {
    this.ground?.geometry.dispose();
    for (const o of this.fixed.children) o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    this.labelTex?.dispose();
    for (const im of [this.stems, this.crowns, this.bushes, this.tufts]) im.dispose();
    this.spray.geometry.dispose(); this.crews.dispose();
    if (this.hud) fieldZone.patch({ present: false, inZone: false, here: null, canDrive: null, driving: null, scene: null, jobs: [] });
  }
}

function mergeAll(gs: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // gộp nhanh các hình không có chỉ số (hoặc đổi sang không chỉ số) giữ position/normal/uv
  const flat = gs.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = flat.reduce((s, g) => s + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv'] as const) {
    if (!flat.every((g) => g.attributes[name])) continue;
    const size = flat[0].attributes[name].itemSize, arr = new Float32Array(total * size);
    let o = 0; for (const g of flat) { arr.set(g.attributes[name].array as Float32Array, o); o += g.attributes[name].count * size; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  for (const g of flat) g.dispose();
  for (const g of gs) g.dispose();
  return out;
}

/** Bảng cột mốc: nền giấy kem viền nâu, dòng trên số sổ đỏ (đậm), dòng dưới khối và cây trồng. */
function drawBoard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, top: string, bottom: string) {
  ctx.save();
  ctx.fillStyle = '#fff7e2'; ctx.strokeStyle = '#7a4b2a'; ctx.lineWidth = 5;
  const r = 12; ctx.beginPath(); ctx.moveTo(x + r + 3, y + 3); ctx.arcTo(x + w - 3, y + 3, x + w - 3, y + h - 3, r); ctx.arcTo(x + w - 3, y + h - 3, x + 3, y + h - 3, r);
  ctx.arcTo(x + 3, y + h - 3, x + 3, y + 3, r); ctx.arcTo(x + 3, y + 3, x + w - 3, y + 3, r); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c0392b'; ctx.fillRect(x + 10, y + 12, 8, h - 24);
  ctx.textBaseline = 'middle'; ctx.fillStyle = '#3d2614';
  fit(ctx, top, '700', 26, x + 26, y + h * 0.36, w - 36);
  ctx.fillStyle = '#6b4a2b';
  fit(ctx, bottom, '600', 19, x + 26, y + h * 0.72, w - 36);
  ctx.restore();
}
function fit(ctx: CanvasRenderingContext2D, text: string, weight: string, size: number, x: number, y: number, max: number) {
  let s = size; ctx.font = `${weight} ${s}px "Baloo 2", system-ui, sans-serif`;
  while (ctx.measureText(text).width > max && s > 12) { s -= 1; ctx.font = `${weight} ${s}px "Baloo 2", system-ui, sans-serif`; }
  let t = text; while (ctx.measureText(t).width > max && t.length > 2) t = `${t.slice(0, -2)}…`;
  ctx.fillText(t, x, y);
}

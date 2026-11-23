// Cánh đồng lớn phía sau xóm: mỗi khối 100 ô (10 × 10 ô, 20 × 20 m trong cảnh) là một mảnh đất phẳng tô màu theo đỉnh
// (luống, bờ, độ chín). Mọi khối gộp chung MỘT lưới; cây là hai InstancedMesh thưa (gần nhiều cây, xa ít cây — LOD);
// máy cày và drone mỗi thứ một lưới đã gộp. Tổng cộng vài lần vẽ dù có hàng nghìn ô.
import * as THREE from 'three';
import { bakeColored } from './batch.ts';

export interface FieldLite {
  id: number; blocks: number; cropId: string | null; progress: number; color: string;
  job: { method: 'tay' | 'thue' | 'may' | 'drone'; machine: string | null; startedAt: number; endsAt: number } | null;
}

const BLOCK = 20;          // cạnh một khối (m): 10 ô × 2 m
const GAP = 1.6;           // bờ ruộng giữa hai khối
const COLS = 8;            // số khối mỗi hàng
const ORIGIN = { x: -((COLS * (BLOCK + GAP)) / 2), z: -30 };   // góc gần xóm nhất (phía bắc, sau hàng rào)
const NEAR = 5, FAR = 2;   // số cây mỗi cạnh khối: gần máy quay / xa máy quay
const LOD_DIST = 90;
const MAX_BLOCKS = 40;

/** Toạ độ tâm khối thứ k (đếm từ trái sang phải, gần ra xa). */
export function blockCenter(k: number): { x: number; z: number } {
  const c = k % COLS, r = Math.floor(k / COLS);
  return { x: ORIGIN.x + c * (BLOCK + GAP) + BLOCK / 2, z: ORIGIN.z - r * (BLOCK + GAP) - BLOCK / 2 };
}

function tractor(color: number): THREE.Group {
  const g = new THREE.Group(), M = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, c: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c)); m.position.set(x, y, z); g.add(m); };
  box(1.6, 0.9, 2.6, 0, 1.1, 0, color); box(1.3, 1.1, 1.1, 0, 2.1, 0.5, 0xdfeff7); box(1.4, 0.12, 1.3, 0, 2.7, 0.5, color);
  box(2.4, 0.35, 0.5, 0, 0.5, -1.9, 0x6b6b6b);   // giàn cày/khung cắt phía sau
  for (const [x, z, r] of [[-0.95, 0.8, 0.75], [0.95, 0.8, 0.75], [-0.85, -0.9, 0.45], [0.85, -0.9, 0.45]] as const) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.4, 14).rotateZ(Math.PI / 2), M(0x2b2b2b)); w.position.set(x, r, z); g.add(w);
  }
  return bakeColored(g, false, false);
}
function drone(): THREE.Group {
  const g = new THREE.Group(), M = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), M(0xf2f2f2)); g.add(body);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 10), M(0x3a8fd8)); tank.position.y = -0.4; g.add(tank);
  for (const a of [0.785, 2.356, 3.927, 5.498]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.12), M(0x333333)); arm.rotation.y = a; arm.position.set(Math.cos(a) * 0.7, 0.1, -Math.sin(a) * 0.7); g.add(arm);
    const rot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 12), M(0x9aa3ad)); rot.position.set(Math.cos(a) * 1.35, 0.22, -Math.sin(a) * 1.35); g.add(rot);
  }
  return bakeColored(g, false, false);
}

export class FieldsLayer {
  readonly group = new THREE.Group();
  private ground: THREE.Mesh | null = null;
  private stems: THREE.InstancedMesh;
  private crowns: THREE.InstancedMesh;
  private tractorObj = tractor(0xd9472b);
  private harvester = tractor(0x3a9d3a);
  private droneObj = drone();
  private spray: THREE.Points;
  private blocks: { field: FieldLite; k: number }[] = [];
  private lodAt = -1;
  private tmp = new THREE.Object3D();
  private col = new THREE.Color();

  constructor() {
    const cap = MAX_BLOCKS * NEAR * NEAR;
    this.stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 1, 5).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0x6b4a2b }), cap);
    this.crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.9, 0).translate(0, 1.2, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), cap);
    for (const m of [this.stems, this.crowns]) { m.count = 0; m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; this.group.add(m); }
    for (const o of [this.tractorObj, this.harvester, this.droneObj]) { o.visible = false; this.group.add(o); }
    const n = 120, pos = new Float32Array(n * 3);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.spray = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xbfe6ff, size: 0.25, transparent: true, opacity: 0.7, depthWrite: false }));
    this.spray.visible = false; this.spray.frustumCulled = false; this.group.add(this.spray);
    this.group.name = 'canh-dong';
  }

  /** Nhận danh sách cánh đồng (từ GET /api/fields) và dựng lại đất + cây. Gọi bao nhiêu lần cũng được. */
  set(fields: FieldLite[]) {
    this.blocks = [];
    let k = 0;
    for (const f of fields) for (let i = 0; i < f.blocks && k < MAX_BLOCKS; i++) this.blocks.push({ field: f, k: k++ });
    this.buildGround();
    this.lodAt = -1;
  }

  private buildGround() {
    if (this.ground) { this.group.remove(this.ground); this.ground.geometry.dispose(); }
    if (!this.blocks.length) { this.ground = null; return; }
    // mỗi khối: một lưới 10 × 10 ô, mỗi ô 2 tam giác; màu đỉnh tạo luống sáng/tối và bờ ruộng sẫm ở mép
    const N = 10, quads = this.blocks.length * N * N, pos = new Float32Array(quads * 18), col = new Float32Array(quads * 18);
    const base = new THREE.Color(), dirt = new THREE.Color('#7a5230'), edge = new THREE.Color('#5c7a2e'), c = new THREE.Color();
    let p = 0;
    for (const { field, k } of this.blocks) {
      const ctr = blockCenter(k), x0 = ctr.x - BLOCK / 2, z0 = ctr.z - BLOCK / 2, s = BLOCK / N;
      base.set(field.color);
      for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) {
        const furrow = r % 2 === 0 ? 1 : 0.86, rim = r === 0 || q === 0 || r === N - 1 || q === N - 1;
        c.copy(field.cropId ? base : dirt).multiplyScalar(furrow);
        if (rim) c.lerp(edge, 0.35);
        const xa = x0 + q * s, xb = xa + s, za = z0 + r * s, zb = za + s;
        const v = [xa, za, xa, zb, xb, za, xb, za, xa, zb, xb, zb];
        for (let j = 0; j < 6; j++) { pos[p * 3] = v[j * 2]; pos[p * 3 + 1] = 0.02; pos[p * 3 + 2] = v[j * 2 + 1]; col[p * 3] = c.r; col[p * 3 + 1] = c.g; col[p * 3 + 2] = c.b; p++; }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    this.ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.ground.receiveShadow = true; this.ground.name = 'canh-dong-dat';
    this.group.add(this.ground);
  }

  /** Cây thưa theo khoảng cách tới máy quay: khối gần NEAR² cây, khối xa FAR² cây. */
  private buildPlants(cam: THREE.Vector3) {
    let n = 0;
    for (const { field, k } of this.blocks) {
      if (!field.cropId) continue;
      const ctr = blockCenter(k), near = Math.hypot(cam.x - ctr.x, cam.z - ctr.z) < LOD_DIST, m = near ? NEAR : FAR, s = BLOCK / m;
      const h = 0.35 + field.progress * 1.1;
      this.col.set(field.color);
      for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) {
        const jitter = ((i * 7 + j * 13 + k * 5) % 10) / 10 - 0.5;
        this.tmp.position.set(ctr.x - BLOCK / 2 + (j + 0.5) * s + jitter, 0, ctr.z - BLOCK / 2 + (i + 0.5) * s - jitter);
        this.tmp.scale.set(near ? 1 : 2.2, h * (near ? 1 : 1.3), near ? 1 : 2.2); this.tmp.rotation.y = jitter * 3; this.tmp.updateMatrix();
        this.stems.setMatrixAt(n, this.tmp.matrix); this.crowns.setMatrixAt(n, this.tmp.matrix); this.crowns.setColorAt(n, this.col); n++;
      }
    }
    this.stems.count = n; this.crowns.count = n;
    this.stems.instanceMatrix.needsUpdate = true; this.crowns.instanceMatrix.needsUpdate = true;
    if (this.crowns.instanceColor) this.crowns.instanceColor.needsUpdate = true;
  }

  /** Mỗi khung: LOD cây (mỗi giây một lần) và máy chạy trên khối đang làm. */
  update(t: number, now: number, cam: THREE.Vector3) {
    if (!this.blocks.length) return;
    if (t - this.lodAt > 1) { this.lodAt = t; this.buildPlants(cam); }
    const work = this.blocks.find((b) => b.field.job && (b.field.job.method === 'may' || b.field.job.method === 'drone'));
    this.tractorObj.visible = this.harvester.visible = this.droneObj.visible = this.spray.visible = false;
    if (!work) return;
    const j = work.field.job!, ctr = blockCenter(work.k);
    // chạy theo luống kiểu luống cày (đi rồi quay đầu), 10 luống trong suốt thời gian làm; thời gian dài thì lặp lại cho sinh động
    const span = Math.max(1, j.endsAt - j.startedAt), f = Math.min(1, Math.max(0, (now - j.startedAt) / span));
    const lanes = 10, loop = (f * lanes + t * 0.08) % lanes, lane = Math.floor(loop), along = loop - lane, dir = lane % 2 ? -1 : 1;
    const x = ctr.x - BLOCK / 2 + 1 + (dir > 0 ? along : 1 - along) * (BLOCK - 2), z = ctr.z - BLOCK / 2 + 1 + lane * ((BLOCK - 2) / (lanes - 1));
    if (j.method === 'drone') {
      const d = this.droneObj; d.visible = true; d.position.set(x, 3.2 + Math.sin(t * 3) * 0.15, z); d.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
      const a = this.spray.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) { const ph = (i / a.count + t * 1.3) % 1; a.setXYZ(i, x + Math.sin(i * 12.9) * 1.6 * ph, 2.8 - ph * 2.7, z + Math.cos(i * 7.3) * 1.6 * ph); }
      a.needsUpdate = true; this.spray.visible = true;
    } else {
      const tr = j.machine === 'may_thu' ? this.harvester : this.tractorObj; tr.visible = true;
      tr.position.set(x, Math.sin(t * 9) * 0.03, z); tr.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }

  dispose() {
    this.ground?.geometry.dispose();
    this.stems.dispose(); this.crowns.dispose(); this.spray.geometry.dispose();
  }
}

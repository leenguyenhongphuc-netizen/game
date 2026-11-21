// Hoạt cảnh hành trình du lịch: người chơi xem xe khách, tàu hoả, máy bay hoặc tàu thuỷ đi qua cảnh quan tới nơi đến.
// Phương tiện đứng yên ở gốc toạ độ (đầu hướng -z); cả thế giới được dựng sẵn dọc tuyến rồi trôi ngược lại.
import * as THREE from 'three';
import { REGIONS } from '../../../shared/catalog.ts';
import type { Zone } from '../../../shared/catalog.ts';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { SCENERY, THEMES, bake, gradient, makeSign } from './DriveScene.ts';

export type RideMode = 'xe_khach' | 'tau_hoa' | 'may_bay' | 'tau_thuy';
export interface RideOptions {
  mode: RideMode; fromRegionId: string; toRegionId: string; seconds: number;
  onTick?: (progress: number) => void;
  onArrive?: () => void;
}

interface Spec { speed: number; half: number; radius: number; height: number; look: number; wide: number }
const SPECS: Record<RideMode, Spec> = {
  xe_khach: { speed: 30, half: 5.2, radius: 15, height: 6, look: 1.6, wide: 1.4 },
  tau_hoa: { speed: 34, half: 19, radius: 31, height: 10, look: 2, wide: 1.4 },
  may_bay: { speed: 95, half: 9, radius: 22, height: 5, look: 1, wide: 8.4 },
  tau_thuy: { speed: 22, half: 8.5, radius: 24, height: 9, look: 2.2, wide: 2.6 },
};
const CRUISE = 46; // độ cao bay bằng

function wheel(x: number, z: number, r = 0.5): THREE.Mesh { const w = mesh(GEO.cyl, mat(0x3a3f4a), x, r, z, r, 0.34, r); w.rotation.z = Math.PI / 2; return w; }

function buildBus(): THREE.Group {
  const g = new THREE.Group(), body = mat(0xf08a6c), white = mat(0xfffaf0), glass = mat(0x7fb9d9, { rough: 0.25 });
  g.add(mesh(GEO.box, body, 0, 2.0, 0, 2.6, 2.7, 10), mesh(GEO.box, white, 0, 1.15, 0, 2.66, 0.5, 10.06), mesh(GEO.box, white, 0, 3.42, 0, 2.3, 0.2, 9.4));
  g.add(mesh(GEO.box, glass, 0, 2.5, 0.2, 2.68, 0.9, 8.6), mesh(GEO.box, glass, 0, 2.35, -5.02, 2.3, 1.3, 0.06));
  for (let i = 0; i < 5; i++) g.add(mesh(GEO.box, body, 0, 2.5, -3.2 + i * 1.75, 2.72, 0.95, 0.16));
  g.add(mesh(GEO.box, mat(0x6fb7d9), 0, 3.62, 1.2, 1.4, 0.24, 2.2), mesh(GEO.box, mat(0x4a5160), 0, 0.72, 0, 2.5, 0.3, 9.8));
  for (const z of [-3.4, 2.6, 3.8]) g.add(wheel(-1.25, z, 0.6), wheel(1.25, z, 0.6));
  for (const x of [-0.85, 0.85]) g.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), x, 1.15, -5.04, 0.18), mesh(GEO.box, mat(0xe0342b), x, 1.2, 5.03, 0.4, 0.2, 0.06));
  return g;
}

function buildTrain(): THREE.Group {
  const g = new THREE.Group(), dark = mat(0x4a5160), glass = mat(0xa9dcf2, { rough: 0.25 });
  const loco = new THREE.Group(), lc = mat(0x4fa3a5);
  loco.add(mesh(GEO.box, lc, 0, 2.0, 0.3, 2.7, 2.2, 6.2), mesh(GEO.box, mat(0xf2c65c), 0, 1.2, 0.3, 2.76, 0.4, 6.26), mesh(GEO.box, lc, 0, 3.5, 1.9, 2.6, 0.9, 2.6));
  loco.add(mesh(GEO.box, glass, 0, 3.5, 0.57, 2.2, 0.6, 0.06), mesh(GEO.box, glass, 0, 3.5, 1.9, 2.66, 0.6, 1.8), mesh(GEO.cyl, dark, 0, 3.6, -1.6, 0.36, 1.1, 0.36));
  loco.add(mesh(GEO.box, mat(0xe0342b), 0, 0.9, -3.0, 2.4, 0.6, 0.5), mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), 0, 2.4, -2.84, 0.3));
  loco.position.z = -15.2; g.add(loco);
  const cols = [0xf08a6c, 0xfdf6e6, 0x6fb7d9, 0xf2b25c];
  for (let i = 0; i < 4; i++) {
    const car = new THREE.Group(), z = -7.3 + i * 7.6;
    car.add(mesh(GEO.box, mat(cols[i]), 0, 2.2, 0, 2.6, 2.5, 7), mesh(GEO.box, mat(0xfffaf0), 0, 3.52, 0, 2.3, 0.2, 6.7), mesh(GEO.box, glass, 0, 2.6, 0, 2.66, 0.85, 5.8));
    for (let k = 0; k < 4; k++) car.add(mesh(GEO.box, mat(cols[i]), 0, 2.6, -2.2 + k * 1.46, 2.7, 0.9, 0.14));
    car.add(mesh(GEO.box, dark, 0, 0.9, 3.65, 0.5, 0.3, 0.7));
    car.position.z = z; g.add(car);
  }
  g.add(mesh(GEO.box, dark, 0, 0.72, 0.6, 2.4, 0.34, 36));
  for (let z = -17; z <= 18; z += 2.6) g.add(wheel(-1.15, z, 0.52), wheel(1.15, z, 0.52));
  return g;
}

function buildPlane(): THREE.Group {
  const g = new THREE.Group(), white = mat(0xfffdf6, { rough: 0.5 }), accent = mat(0x6fb7d9), dark = mat(0x4a5160);
  const fus = mesh(GEO.cyl, white, 0, 0, 0, 1.25, 14, 1.25); fus.rotation.x = Math.PI / 2; g.add(fus);
  g.add(mesh(GEO.ball, white, 0, 0, -7, 1.25, 1.25, 2.2), mesh(GEO.ball, mat(0x7fb9d9, { rough: 0.25 }), 0, 0.45, -7.5, 0.95, 0.6, 1.2));
  const tail = mesh(GEO.cone, white, 0, 0.25, 8.4, 1.2, 3.4, 1.0); tail.rotation.x = Math.PI / 2; g.add(tail);
  g.add(mesh(GEO.box, accent, 0, 2.1, 8.6, 0.24, 3.4, 2.4), mesh(GEO.box, mat(0xf2c65c), 0, 3.3, 9.0, 0.26, 1.0, 1.5), mesh(GEO.box, white, 0, 0.5, 8.9, 6, 0.18, 1.5));
  const wing = mesh(GEO.box, white, 0, -0.35, 0.6, 16.4, 0.24, 3.0); g.add(wing);
  for (const x of [-8.0, 8.0]) g.add(mesh(GEO.box, accent, x, 0.25, 1.2, 0.2, 1.2, 1.6));
  for (const x of [-3.8, 3.8]) { const e = mesh(GEO.cyl, accent, x, -1.1, -0.2, 0.62, 2.4, 0.62); e.rotation.x = Math.PI / 2; g.add(e, mesh(GEO.cyl, dark, x, -1.1, -1.42, 0.5, 0.06, 0.5)); (g.children[g.children.length - 1] as THREE.Mesh).rotation.x = Math.PI / 2; }
  for (let i = 0; i < 9; i++) for (const x of [-1.24, 1.24]) g.add(mesh(GEO.box, mat(0x7fb9d9, { rough: 0.25 }), x, 0.3, -4.6 + i * 1.15, 0.06, 0.4, 0.5));
  g.add(mesh(GEO.box, accent, 0, -0.2, 0, 2.54, 0.2, 13.6));
  return g;
}

function buildFerry(): THREE.Group {
  const g = new THREE.Group(), white = mat(0xfffdf6), blue = mat(0x5aa9e6), glass = mat(0x7fb9d9, { rough: 0.25 });
  g.add(mesh(GEO.box, white, 0, 0.9, 0.6, 5, 1.9, 14), mesh(GEO.box, blue, 0, 0.25, 0.6, 5.06, 0.6, 14.06));
  const bow = mesh(GEO.cone, white, 0, 0.9, -8.0, 2.5, 3.6, 0.95); bow.rotation.x = -Math.PI / 2; g.add(bow);
  g.add(mesh(GEO.box, white, 0, 2.7, 1.2, 4.2, 1.7, 9.6), mesh(GEO.box, glass, 0, 2.8, 1.2, 4.26, 0.7, 8.8), mesh(GEO.box, white, 0, 4.2, 0.2, 3.4, 1.3, 4.6), mesh(GEO.box, glass, 0, 4.4, -2.12, 3.0, 0.7, 0.06));
  g.add(mesh(GEO.box, mat(0xf2c65c), 0, 3.62, 1.2, 4.5, 0.14, 9.9), mesh(GEO.cyl, mat(0xf08a6c), 0, 5.6, 2.2, 0.6, 1.6, 0.6), mesh(GEO.cyl, mat(0x4a5160), 0, 6.45, 2.2, 0.62, 0.2, 0.62));
  g.add(mesh(GEO.cyl, mat(0x9a7150), 0, 3.0, -5.6, 0.06, 2.6, 0.06), mesh(GEO.box, mat(0xe0342b), 0.5, 4.0, -5.6, 0.95, 0.6, 0.05), mesh(GEO.ball, mat(0xffd23f), 0.5, 4.0, -5.56, 0.15));
  for (const x of [-2.56, 2.56]) for (let i = 0; i < 4; i++) g.add(mesh(GEO.cyl, mat(0xf08a6c), x, 1.5, -2.8 + i * 2.6, 0.38, 0.14, 0.38));
  return g;
}

/** Cổng chào ở nơi đến: hai trụ, xà ngang và biển chữ. */
function arch(text: string, width: number, color: number): THREE.Group {
  const g = new THREE.Group(), post = mat(color);
  g.add(bake((() => { const b = new THREE.Group(); for (const x of [-width / 2, width / 2]) b.add(mesh(GEO.box, post, x, 3.6, 0, 0.7, 7.2, 0.7), mesh(GEO.ball, mat(0xf2c65c), x, 7.5, 0, 0.55)); b.add(mesh(GEO.box, post, 0, 6.6, 0, width + 1.2, 0.8, 0.8)); return b; })(), true));
  const s = makeSign(text, '#d9482b'); s.scale.set(Math.min(width + 3, 13), Math.min(width + 3, 13) / 4, 1); s.position.set(0, 8.6, 0); g.add(s);
  return g;
}

export class RideScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.5, 900);
  private clock = new THREE.Clock();
  private world = new THREE.Group();
  private vehicle: THREE.Group;
  private sun: THREE.DirectionalLight;
  private spec: Spec;
  private total: number;
  private seconds: number;
  private t = 0;
  private dist = 0;
  private alt = 0;
  private arrived = false;
  private disposed = false;
  private puffs: { m: THREE.Mesh; life: number }[] = [];
  private gulls: THREE.Group[] = [];
  private ro: ResizeObserver;
  private container: HTMLElement;
  private opts: RideOptions;

  constructor(container: HTMLElement, opts: RideOptions) {
    this.container = container; this.opts = opts;
    this.spec = SPECS[opts.mode];
    this.seconds = Math.min(30, Math.max(6, opts.seconds || 10));
    this.total = this.spec.speed * this.seconds * 0.82; // quãng đường khi có tăng tốc đầu và giảm tốc cuối

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    container.appendChild(this.renderer.domElement);
    this.scene.background = gradient(0x8fd0f5, 0xdff3fb);
    this.scene.fog = new THREE.Fog(0xdff3fb, opts.mode === 'may_bay' ? 220 : 110, opts.mode === 'may_bay' ? 620 : 330);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.1);
    this.sun.position.set(18, 30, 12); this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 110 });
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.05; this.sun.shadow.radius = 5;
    this.scene.add(new THREE.HemisphereLight(0xfafcff, 0xd6e6b0, 1.35), this.sun, this.sun.target, this.world);

    const raw = opts.mode === 'xe_khach' ? buildBus() : opts.mode === 'tau_hoa' ? buildTrain() : opts.mode === 'may_bay' ? buildPlane() : buildFerry();
    this.vehicle = bake(raw, true); this.scene.add(this.vehicle);
    this.buildWorld();
    if (opts.mode === 'tau_hoa') for (let i = 0; i < 10; i++) { const m = mesh(GEO.ball, mat(0xffffff, { transparent: 0.75 }), 0, -50, 0, 0.5); m.castShadow = false; this.scene.add(m); this.puffs.push({ m, life: i * 0.12 }); }
    if (opts.mode === 'tau_thuy') for (let i = 0; i < 5; i++) {
      const gull = new THREE.Group();
      for (const s of [-1, 1]) { const w = mesh(GEO.box, mat(0xffffff), s * 0.55, 0, 0, 1.1, 0.05, 0.34); w.castShadow = false; gull.add(w); }
      gull.add(mesh(GEO.ball, mat(0xffffff), 0, 0, 0, 0.2, 0.16, 0.4)); this.gulls.push(gull); this.scene.add(gull);
    }
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    (window as unknown as { __ride?: unknown }).__ride = { debug: () => ({ t: this.t, dist: this.dist, total: this.total, alt: this.alt, arrived: this.arrived }) };
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------ dựng tuyến đường
  private buildWorld() {
    const { mode, fromRegionId, toRegionId } = this.opts, L = this.total, half = this.spec.half;
    const from = REGIONS[fromRegionId], to = REGIONS[toRegionId];
    const zA: Zone = from?.zone ?? 'nam', zB: Zone = to?.zone ?? 'nam';
    const r = rng([...(fromRegionId + toRegionId + mode)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    const W = this.world, put = (o: THREE.Object3D, x: number, y: number, s: number) => { o.position.set(x, y, -s); W.add(o); return o; };
    const zoneAt = (s: number): Zone => (s / L < 0.42 + r() * 0.16 ? zA : zB);
    const sea = mode === 'tau_thuy';

    // Mặt đất (hoặc mặt biển) chuyển màu dần từ miền đi sang miền đến
    const strip = 24, n = Math.ceil((L + 320) / strip);
    const ground = new THREE.InstancedMesh(new THREE.BoxGeometry(700, 0.2, strip + 0.05), new THREE.MeshStandardMaterial({ roughness: sea ? 0.25 : 1 }), n);
    const m4 = new THREE.Matrix4(), cA = new THREE.Color(sea ? 0x7fd3e8 : THEMES[zA].ground), cB = new THREE.Color(sea ? 0x6cc6e0 : THEMES[zB].ground), c = new THREE.Color();
    for (let i = 0; i < n; i++) { const s = -160 + i * strip; m4.makeTranslation(0, -0.12, -s); ground.setMatrixAt(i, m4); ground.setColorAt(i, c.copy(cA).lerp(cB, THREE.MathUtils.smoothstep(s / L, 0.3, 0.7))); }
    ground.receiveShadow = true; W.add(ground);

    const scatter = (s0: number, s1: number, every: number, near: number, far: number, kinds?: string[]) => {
      for (let s = s0; s < s1; s += every * (0.6 + r() * 0.8)) for (const side of [-1, 1]) {
        if (r() < 0.25) continue;
        const list = kinds ?? THEMES[zoneAt(s)].kinds, kind = list[Math.floor(r() * list.length)];
        const o = bake(SCENERY[kind](), true), x = side * (near + r() * (far - near)) * (kind === 'rice' || kind === 'dune' ? 1.6 : 1);
        o.rotation.y = kind === 'house' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : r() * 6.28; o.scale.setScalar(kind === 'pole' ? 1 : 0.9 + r() * 0.5);
        put(o, x, 0, s);
      }
    };
    const mountains = (s0: number, s1: number, zone: Zone) => {
      const col = THEMES[zone].mountains; if (col === null) return;
      for (let s = s0; s < s1; s += 46 + r() * 30) for (const side of [-1, 1]) { const h = 26 + r() * 30; const mt = mesh(new THREE.ConeGeometry(22 + r() * 16, h, 7), mat(col, { rough: 1 }), 0, 0, 0); mt.castShadow = false; mt.rotation.y = r() * 3; put(mt, side * (95 + r() * 60), h / 2 - 2, s); }
    };
    const depart = (label: string, x: number) => { const sg = makeSign(label, '#2a7fd6'); sg.scale.set(9, 2.25, 1); put(sg, x, 5.2, half + 9); put(bake((() => { const b = new THREE.Group(); b.add(mesh(GEO.cyl, mat(0x8f97a3), 0, 2, 0, 0.14, 4, 0.14)); return b; })(), true), x, 0, half + 9); };
    const fromName = from?.name ?? 'Nơi đi', toName = to?.name ?? 'Nơi đến';

    if (mode === 'xe_khach') {
      put(mesh(GEO.box, mat(0x9aa1ab), 0, 0, 0, 9, 0.12, L + 300), 0, 0.0, L / 2);
      for (const x of [-4.3, 4.3]) put(mesh(GEO.box, mat(0xfbf3df), 0, 0, 0, 0.3, 0.14, L + 300), x, 0.01, L / 2);
      const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 0.14, 2.6), mat(0xffffff), Math.ceil((L + 300) / 7));
      for (let i = 0; i < dashes.count; i++) { m4.makeTranslation(0, 0.03, -(-150 + i * 7)); dashes.setMatrixAt(i, m4); } W.add(dashes);
      // Bến xe nơi đi
      put(bake((() => { const b = new THREE.Group(); b.add(mesh(GEO.box, mat(0xfff6e2), 0, 2.2, 0, 14, 4.4, 6), mesh(GEO.box, mat(0x6fb7d9), 0, 4.7, 1.5, 15, 0.4, 9)); for (const x of [-6, -2, 2, 6]) b.add(mesh(GEO.cyl, mat(0xf2c65c), x, 2.2, 5.2, 0.2, 4.4, 0.2)); return b; })(), true), -15, 0, -4).rotation.y = Math.PI / 2;
      depart(`Bến xe ${fromName}`, 8);
      scatter(24, L - 16, 9, 9, 40); mountains(0, L * 0.5, zA); mountains(L * 0.5, L + 80, zB);
      put(arch(`Chào mừng đến ${toName}`, 13, 0xf08a6c), 0, 0, L + half + 12);
      scatter(L + 14, L + 90, 10, 10, 36);
    } else if (mode === 'tau_hoa') {
      put(mesh(GEO.box, mat(0xc9bfae), 0, 0, 0, 5.2, 0.3, L + 300), 0, 0.02, L / 2);
      for (const x of [-1.15, 1.15]) put(mesh(GEO.box, mat(0x6b7280, { rough: 0.4 }), 0, 0, 0, 0.18, 0.22, L + 300), x, 0.24, L / 2);
      const ties = new THREE.InstancedMesh(new THREE.BoxGeometry(3.4, 0.16, 0.5), mat(0x8a6a4a), Math.ceil((L + 300) / 1.7));
      for (let i = 0; i < ties.count; i++) { m4.makeTranslation(0, 0.16, -(-150 + i * 1.7)); ties.setMatrixAt(i, m4); } W.add(ties);
      // Nhà ga nơi đi và sân ga
      put(bake((() => { const b = new THREE.Group(); b.add(mesh(GEO.box, mat(0xd9d2c4), 0, 0.35, 0, 5, 0.7, 46), mesh(GEO.box, mat(0xfff0cf), -5, 2.6, 0, 6, 5.2, 16), mesh(GEO.box, mat(0xd9482b), -4, 5.6, 0, 11, 0.5, 20), mesh(GEO.ball, mat(0xfffaf0), -1.9, 4.2, 0, 0.9, 0.9, 0.2)); for (let z = -18; z <= 18; z += 9) b.add(mesh(GEO.cyl, mat(0x4fa3a5), 1.2, 2.8, z, 0.14, 4.2, 0.14)); return b; })(), true), -6.6, 0, 6);
      depart(`Ga ${fromName}`, 7);
      // Cầu sắt qua sông ở giữa hành trình
      const b0 = L * 0.44, b1 = L * 0.58, bm = (b0 + b1) / 2, bl = b1 - b0;
      const river = mesh(GEO.box, mat(0x7fd3e8, { rough: 0.2 }), 0, 0, 0, 700, 0.3, bl - 6); river.castShadow = false; put(river, 0, 0.0, bm);
      put(bake((() => {
        const b = new THREE.Group(), steel = mat(0xd9482b);
        b.add(mesh(GEO.box, mat(0x8f97a3), 0, 0.12, 0, 6.4, 0.3, bl + 4));
        for (const x of [-3.1, 3.1]) { b.add(mesh(GEO.box, steel, x, 6.2, 0, 0.36, 0.36, bl), mesh(GEO.box, steel, x, 0.7, 0, 0.36, 0.5, bl)); for (let z = -bl / 2; z <= bl / 2 + 0.1; z += 6) b.add(mesh(GEO.box, steel, x, 3.4, z, 0.3, 5.6, 0.3)); for (let z = -bl / 2; z < bl / 2 - 0.1; z += 6) { const d = mesh(GEO.box, steel, x, 3.4, z + 3, 0.22, 8.1, 0.22); d.rotation.x = (Math.floor(z) % 12 === 0 ? 1 : -1) * 0.82; b.add(d); } }
        for (let z = -bl / 2; z <= bl / 2 + 0.1; z += 6) b.add(mesh(GEO.box, steel, 0, 6.2, z, 6.4, 0.3, 0.3));
        for (const z of [-bl / 2 + 2, 0, bl / 2 - 2]) b.add(mesh(GEO.box, mat(0xd9d2c4), 0, -1.6, z, 5, 3.2, 2.4));
        return b;
      })(), true), 0, 0, bm);
      for (let i = 0; i < 4; i++) { const boat = bake(SCENERY.ghe(), true); boat.rotation.y = Math.PI / 2; put(boat, (i % 2 ? 1 : -1) * (22 + i * 14), 0.1, b0 + 6 + r() * (bl - 12)); }
      scatter(30, b0 - 8, 9, 8, 42); scatter(b1 + 8, L - 18, 9, 8, 42); mountains(0, L * 0.4, zA); mountains(L * 0.62, L + 80, zB);
      put(bake((() => { const b = new THREE.Group(); b.add(mesh(GEO.box, mat(0xd9d2c4), 0, 0.35, 0, 5, 0.7, 60), mesh(GEO.box, mat(0xfff0cf), -5, 2.6, 0, 6, 5.2, 16), mesh(GEO.box, mat(0x6fb7d9), -4, 5.6, 0, 11, 0.5, 20)); for (let z = -24; z <= 24; z += 8) b.add(mesh(GEO.cyl, mat(0xf2c65c), 1.2, 2.8, z, 0.14, 4.2, 0.14)); return b; })(), true), -6.6, 0, L - 2);
      put(arch(`Chào mừng đến ${toName}`, 9, 0x4fa3a5), 0, 0, L + half + 8);
      scatter(L + 26, L + 90, 10, 12, 36);
    } else if (mode === 'may_bay') {
      const runway = (s: number, len: number) => {
        put(mesh(GEO.box, mat(0x8f97a3), 0, 0, 0, 22, 0.12, len), 0, 0.02, s);
        const marks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.12, 6), mat(0xffffff), Math.floor(len / 14));
        for (let i = 0; i < marks.count; i++) { m4.makeTranslation(0, 0.06, -(s - len / 2 + 7 + i * 14)); marks.setMatrixAt(i, m4); } W.add(marks);
        for (const x of [-10.4, 10.4]) put(mesh(GEO.box, mat(0xfbf3df), 0, 0, 0, 0.5, 0.14, len), x, 0.04, s);
      };
      const terminal = (s: number, side: number, label: string, col: number) => {
        put(bake((() => { const b = new THREE.Group(); b.add(mesh(GEO.box, mat(0xfffaf0), 0, 4, 0, 16, 8, 44), mesh(GEO.box, mat(0x7fb9d9, { rough: 0.25 }), -8.05, 4.4, 0, 0.1, 5, 40), mesh(GEO.box, mat(col), 0, 8.4, 0, 18, 0.8, 46), mesh(GEO.cyl, mat(0xfffaf0), 4, 12, -26, 2.2, 24, 2.2), mesh(GEO.cyl, mat(0x7fb9d9, { rough: 0.25 }), 4, 24.6, -26, 3.4, 2.4, 3.4), mesh(GEO.cyl, mat(col), 4, 26.2, -26, 3.7, 0.6, 3.7)); return b; })(), true), side * 34, 0, s).rotation.y = side > 0 ? 0 : Math.PI;
        const sg = makeSign(label, '#2a7fd6'); sg.scale.set(17, 4.25, 1); put(sg, side * 27, 11.4, s);
      };
      runway(L * 0.06, L * 0.2 + 120); terminal(30, 1, `Sân bay ${fromName}`, 0x6fb7d9);
      runway(L - L * 0.06, L * 0.2 + 120); terminal(L - 10, -1, `Chào mừng đến ${toName}`, 0xf08a6c);
      scatter(0, L * 0.2, 14, 26, 90); scatter(L * 0.8, L + 60, 14, 26, 90);
      mountains(0, L * 0.3, zA); mountains(L * 0.7, L + 80, zB);
      // Nhìn từ trên cao: ruộng đồng thành mảng màu, sông và bờ biển
      const patches = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.3, 1), new THREE.MeshStandardMaterial({ roughness: 1 }), 150);
      const pal = [0xe6cf6a, 0x8fd67c, 0xb7e69a, 0xd9bd4e, 0x79c96d, 0xc9d77a, 0xdc9a78];
      const q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
      for (let i = 0; i < 150; i++) { ps.set((r() - 0.5) * 520, 0.05 + i * 0.006, -(L * 0.14 + r() * L * 0.72)); sc.set(26 + r() * 44, 1, 26 + r() * 44); q.setFromEuler(new THREE.Euler(0, (r() - 0.5) * 0.5, 0)); m4.compose(ps, q, sc); patches.setMatrixAt(i, m4); patches.setColorAt(i, c.setHex(pal[Math.floor(r() * pal.length)])); }
      W.add(patches);
      const riv = mesh(GEO.box, mat(0x7fd3e8, { rough: 0.2 }), 0, 0, 0, 760, 0.34, 30); riv.castShadow = false; riv.rotation.y = 0.35; put(riv, 0, 0.12, L * 0.5);
      if (zA === 'trung' || zB === 'trung' || zA === 'dao' || zB === 'dao') { const coast = mesh(GEO.box, mat(0x7fd3e8, { rough: 0.2 }), 0, 0, 0, 300, 0.36, L * 0.5); coast.castShadow = false; put(coast, 300, 0.14, L * 0.5); put(mesh(GEO.box, mat(0xf6ecc6), 0, 0, 0, 16, 0.38, L * 0.5), 148, 0.12, L * 0.5); }
      // Mây ở tầng bay
      for (let i = 0; i < 46; i++) {
        const cl = new THREE.Group(); for (let k = 0; k < 4; k++) cl.add(mesh(GEO.ball, mat(0xffffff, { rough: 1 }), k * 4.4 - 6 + r() * 2, r() * 1.6, r() * 3, 4 + r() * 2.6, 2.2 + r(), 3.6));
        const b = bake(cl); const x = (r() - 0.5) * 150; put(b, Math.abs(x) < 14 ? x + Math.sign(x || 1) * 16 : x, CRUISE - 9 + r() * 14, L * 0.12 + r() * L * 0.76);
      }
    } else { // tàu thuỷ
      const island = (s: number, isTo: boolean) => {
        put(bake((() => { const b = new THREE.Group(); b.add(mesh(GEO.ball, mat(0xf6ecc6), 0, -1.2, 0, 64, 3.2, 46), mesh(GEO.ball, mat(0xb1dc7c), 2, 0.2, -8, 52, 3.6, 34), mesh(GEO.ball, mat(0x9cc79a, { rough: 1 }), -10, 6, -16, 22, 16, 18), mesh(GEO.ball, mat(0xa9cbbd, { rough: 1 }), 20, 4, -20, 16, 11, 14)); return b; })()), 0, 0, s + (isTo ? 52 : -52));
        for (let i = 0; i < 14; i++) { const p = bake(SCENERY[i % 4 === 0 ? 'house' : 'palm'](), true); const a = r() * 6.28; put(p, Math.cos(a) * (10 + r() * 30), 2.6, s + (isTo ? 44 : -44) + Math.sin(a) * 12); }
      };
      const mainland = (s: number, isTo: boolean, zone: Zone) => {
        const land = mesh(GEO.box, mat(THEMES[zone].ground), 0, 0, 0, 700, 1.6, 150); put(land, 0, 0.2, s + (isTo ? 96 : -96));
        put(mesh(GEO.box, mat(0xf6ecc6), 0, 0, 0, 700, 1.2, 12), 0, 0.2, s + (isTo ? 17 : -17));
        for (let i = 0; i < 22; i++) { const kinds = THEMES[zone].kinds.filter((k) => k !== 'rice' && k !== 'pond'); const o = bake(SCENERY[kinds[Math.floor(r() * kinds.length)]](), true); put(o, (r() - 0.5) * 150, 1.0, s + (isTo ? 1 : -1) * (26 + r() * 50)); }
      };
      const pier = (s: number, isTo: boolean, label: string) => {
        put(bake((() => { const b = new THREE.Group(); b.add(mesh(GEO.box, mat(0xc99a68), 0, 1.0, 0, 5, 0.4, 30)); for (let z = -13; z <= 13; z += 6.5) for (const x of [-2.2, 2.2]) b.add(mesh(GEO.cyl, mat(0x8a6a4a), x, 0.2, z, 0.3, 2.6, 0.3)); for (const z of [-12, 12]) b.add(mesh(GEO.cyl, mat(0xe0342b), -2.2, 1.8, z, 0.34, 0.5, 0.34)); return b; })(), true), -6.4, 0, s + (isTo ? 12 : -12));
        if (!isTo) { const sg = makeSign(label, '#2a7fd6'); sg.scale.set(10, 2.5, 1); put(sg, -8, 6.2, s - 2); }
      };
      const fromIsland = !!from?.island && !to?.island;
      if (fromIsland) { island(-half, false); mainland(L + half, true, zB); }
      else { mainland(-half, false, zA); if (to?.island) island(L + half, true); else mainland(L + half, true, zB); }
      pier(-half + 6, false, `Bến tàu ${fromName}`); pier(L + half - 6, true, '');
      put(arch(`Chào mừng đến ${toName}`, 4.4, 0x5aa9e6), -6.4, 1.2, L + half + 2);
      for (let s = 40; s < L - 30; s += 30 + r() * 26) { const kind = ['islet', 'ghe', 'seastone', 'ghe'][Math.floor(r() * 4)], o = bake(SCENERY[kind](), true); o.rotation.y = r() * 6.28; o.scale.setScalar(1 + r() * 0.8); put(o, (r() < 0.5 ? -1 : 1) * (20 + r() * 50), 0, s); }
      const caps = new THREE.InstancedMesh(GEO.ball, mat(0xffffff, { rough: 0.3 }), 260);
      for (let i = 0; i < 260; i++) { m4.compose(new THREE.Vector3((r() - 0.5) * 260, 0.0, -(r() * (L + 60) - 20)), new THREE.Quaternion(), new THREE.Vector3(1.4 + r() * 1.6, 0.16, 0.45)); caps.setMatrixAt(i, m4); }
      W.add(caps);
    }
  }

  private resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < 0.9 ? 52 : 42; this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------ vòng lặp
  private frame() {
    if (this.disposed) return;
    const dt = Math.min(this.clock.getDelta(), 0.05), seconds = this.seconds, { mode } = this.opts;
    if (!this.arrived) this.t += dt;
    const p = Math.min(1, this.t / seconds), time = this.clock.elapsedTime;
    // Tăng tốc lúc khởi hành, đều tốc giữa đường, giảm tốc khi tới nơi
    const A = 0.18, tail = p - (1 - A);
    const travelled = p < A ? (p * p) / (2 * A) : p <= 1 - A ? A / 2 + (p - A) : A / 2 + (1 - 2 * A) + tail - (tail * tail) / (2 * A);
    this.dist = (travelled / (1 - A)) * this.total;
    const speed = p < 0.18 ? p / 0.18 : p > 0.82 ? (1 - p) / 0.18 : 1;
    this.alt = mode === 'may_bay' ? CRUISE * THREE.MathUtils.smoothstep(p, 0.13, 0.36) * (1 - THREE.MathUtils.smoothstep(p, 0.64, 0.88)) : 0;
    this.world.position.set(0, -this.alt, this.dist);

    const v = this.vehicle;
    if (mode === 'may_bay') {
      const climb = THREE.MathUtils.smoothstep(p, 0.11, 0.2) * (1 - THREE.MathUtils.smoothstep(p, 0.3, 0.38)), descend = THREE.MathUtils.smoothstep(p, 0.62, 0.7) * (1 - THREE.MathUtils.smoothstep(p, 0.84, 0.9));
      v.position.y = 2.1; v.rotation.x = climb * 0.22 - descend * 0.1 + (p > 0.86 && p < 0.92 ? 0.06 : 0); v.rotation.z = Math.sin(time * 0.7) * 0.04 * (this.alt / CRUISE);
    } else if (mode === 'tau_thuy') { v.position.y = 0.25 + Math.sin(time * 1.6) * 0.16; v.rotation.x = Math.sin(time * 1.3) * 0.02; v.rotation.z = Math.sin(time * 1.1) * 0.025; }
    else { v.position.y = (mode === 'tau_hoa' ? 0.3 : 0) + Math.abs(Math.sin(time * 18)) * 0.03 * speed; }

    // Máy quay: màn ngang lia từ sau ra ngang rồi lên trước; màn dọc giữ góc chéo để phương tiện nằm trọn khung, đổi cảnh giữa chừng
    const portrait = this.camera.aspect < 0.9, sp = this.spec, sm = THREE.MathUtils.smoothstep(p, 0.08, 0.92);
    let a: number, R = sp.radius, H = sp.height;
    if (portrait) { // nhìn từ sau, trên cao: thân phương tiện chạy dọc màn hình; nửa sau đổi sang bên kia
      a = p < 0.5 ? THREE.MathUtils.lerp(0.26, 0.42, p * 2) : THREE.MathUtils.lerp(-0.44, -0.26, (p - 0.5) * 2);
      R = Math.max(sp.half * 2.3 + 13, sp.wide / 0.21); H = R * 0.8;
    } else { a = THREE.MathUtils.lerp(0.62, 1.95, sm); R = sp.radius * (this.camera.aspect < 1.3 ? 1.25 : 1); }
    if (mode === 'may_bay') H += 3 * Math.sin(sm * Math.PI);
    // Cuối hành trình, màn ngang lia về phía trước để thấy cổng chào
    const lookZ = portrait ? -sp.half * 0.35 : -(sp.half * 0.5 + 5) * THREE.MathUtils.smoothstep(p, 0.76, 0.96);
    this.camera.position.set(Math.sin(a) * R, v.position.y + H, Math.cos(a) * R + lookZ);
    this.camera.lookAt(0, v.position.y + sp.look, lookZ);
    this.sun.target.position.set(0, 0, 0); this.sun.position.set(18, 30, 12);

    for (const f of this.puffs) {
      f.life += dt * (0.5 + speed * 0.8); const k = f.life % 1.2;
      f.m.position.set(Math.sin(f.life * 3) * 0.3, 4.6 + k * 4.2, -16.8 + k * (6 + speed * 12)); f.m.scale.setScalar(0.35 + k * 0.95); f.m.visible = true;
    }
    this.gulls.forEach((g, i) => {
      const ang = time * 0.5 + i * 1.3; g.position.set(Math.cos(ang) * (7 + i * 1.6), 8.5 + Math.sin(time * 1.4 + i) * 0.8 + i * 0.4, -3 + Math.sin(ang) * (6 + i)); g.rotation.y = -ang;
      const flap = Math.sin(time * 9 + i) * 0.55; g.children[0].rotation.z = flap; g.children[1].rotation.z = -flap;
    });

    this.opts.onTick?.(p);
    if (p >= 1 && !this.arrived) { this.arrived = true; this.opts.onArrive?.(); }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.renderer.setAnimationLoop(null); this.ro.disconnect();
    this.scene.traverse((o) => { const sp = o as THREE.Sprite; if (sp.isSprite) { sp.material.map?.dispose(); sp.material.dispose(); } });
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}

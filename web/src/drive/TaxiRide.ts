// Taxi: cảnh "trên đường" nhìn từ hàng ghế sau bên phải (kéo để nhìn qua lại), và cảnh xuống xe ở nơi đến.
// Xe đứng yên ở gốc toạ độ (đầu hướng -z); con đường uốn lượn được chia thành từng khúc, trôi ngược lại và tái dùng.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Zone } from '../../../shared/catalog.ts';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { roadsideProp } from '../scene/zones.ts';
import { SCENERY, THEMES, bake } from './RideKit.ts';
import { V3, Walker, buildBus, buildMinibus, buildTaxi, chamTower, karst, lampPost, person, seg, sign } from './RideParts.ts';
import { backdrop, bob, box, crowd, hash, post, prop, roadAlongZ, slab } from './RideSets.ts';
import type { Act, Ctx } from './RideSets.ts';

export type SideHint = 'bien' | 'song' | 'nui' | 'pho';
export interface TaxiInfo {
  host: HTMLElement; zone: Zone; toName: string; km: number; seconds: number; fare: number; side?: SideHint; seed: number;
  caption: string; onTick?: (p: number) => void; onMeter?: (dong: number) => void;
}

const WATER = 0x6fcbe6, L = 9, N = 30, SPEED = 15.5;
const DEG = Math.PI / 180, YAW_MAX = 100 * DEG, PITCH_MAX = 20 * DEG;
/** Độ lệch ngang của tim đường theo quãng đường s: hai khúc cua rõ rồi thẳng dần. */
const C = (s: number) => 15 * Math.sin(s / 82) + 5 * Math.sin(s / 41 + 1.3);
const dC = (s: number) => (15 / 82) * Math.cos(s / 82) + (5 / 41) * Math.cos(s / 41 + 1.3);

/** Gộp mọi khối thành MỘT lưới tô màu theo đỉnh: mỗi khúc đường chỉ tốn một lệnh vẽ. */
const VC = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
function bakeVC(root: THREE.Object3D): THREE.Mesh {
  root.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    const c = (m.material as THREE.MeshStandardMaterial).color, n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); geos.push(g);
  });
  const out = new THREE.Mesh(mergeGeometries(geos, false), VC); out.castShadow = false; out.receiveShadow = false;
  for (const g of geos) g.dispose();
  return out;
}

function stall(r: () => number): THREE.Group {
  const g = new THREE.Group(), c = [0xe2573c, 0x3f8fd6, 0x2f9a4a, 0xf2a03c][Math.floor(r() * 4)];
  box(g, 0xfff6e2, 0, 1.3, -1.4, 4.4, 2.6, 2.6); box(g, 0x8a8f99, 0, 2.7, -1.4, 4.7, 0.16, 2.9);
  box(g, c, 0, 2.5, 0.7, 4.6, 0.12, 2.0); box(g, 0xfffaf0, 0, 2.3, 1.66, 4.6, 0.36, 0.06);
  for (const x of [-2.1, 2.1]) post(g, 0x8f97a3, x, 0, 1.6, 2.5, 0.05);
  box(g, 0xc99a68, -0.9, 0.8, 0.5, 1.9, 0.1, 0.9); for (let i = 0; i < 4; i++) g.add(mesh(GEO.ball, mat([0xf08a24, 0xdc342b, 0x9bd64a, 0xffd23f][i]), -1.6 + i * 0.45, 1.0, 0.5, 0.17));
  for (const x of [1.0, 1.9]) { box(g, [0xe2573c, 0x3f8fd6][x > 1.5 ? 1 : 0], x, 0.45, 0.9, 0.42, 0.06, 0.42); post(g, 0xd9d2c4, x, 0, 0.9, 0.44, 0.04); }
  return g;
}
function townHouse(r: () => number): THREE.Group {
  const g = new THREE.Group(), w = 4.2, floors = 2 + Math.floor(r() * 3), h = floors * 3;
  const wall = [0xfff1c9, 0xffe0c2, 0xdff0e6, 0xe3ecfa, 0xfbe3ea, 0xf5f0e2][Math.floor(r() * 6)];
  box(g, wall, 0, h / 2, -3, w, h, 6); box(g, 0xc9bfae, 0, h + 0.2, -3, w + 0.2, 0.4, 6.2);
  for (let f = 1; f < floors; f++) { box(g, 0xfffaf0, 0, f * 3 + 0.05, 0.4, w, 0.14, 0.9); box(g, 0x8f97a3, 0, f * 3 + 0.55, 0.82, w, 0.06, 0.06); for (const x of [-1.1, 1.1]) box(g, 0x7fb9d9, x, f * 3 + 1.6, 0.02, 1.2, 1.5, 0.08); }
  box(g, [0xe2573c, 0x2f9a4a, 0x3f8fd6, 0xf2a03c][Math.floor(r() * 4)], 0, 2.9, 0.5, w, 0.7, 1.0); box(g, 0x4a5160, 0, 1.25, 0.03, w - 0.6, 2.5, 0.08);
  if (r() < 0.6) { const m = motorbike(false); m.position.set(-1 + r() * 2, 0, 1.6); m.rotation.y = Math.PI / 2; g.add(m); }
  return g;
}
function motorbike(rider: boolean): THREE.Group {
  const g = new THREE.Group(), c = [0xe2573c, 0x3f8fd6, 0x4a5160, 0xfffaf0][Math.floor(Math.random() * 4)];
  for (const z of [-0.6, 0.6]) { const w = mesh(GEO.cyl, mat(0x2e3138), 0, 0.28, z, 0.28, 0.1, 0.28); w.rotation.z = Math.PI / 2; g.add(w); }
  box(g, c, 0, 0.55, 0.1, 0.3, 0.3, 1.1); box(g, 0x2e3138, 0, 0.78, 0.25, 0.32, 0.1, 0.7); box(g, c, 0, 0.7, -0.5, 0.36, 0.5, 0.14); box(g, 0x4a5160, 0, 1.0, -0.5, 0.62, 0.05, 0.05);
  if (rider) { const p = person(Math.floor(Math.random() * 7), 0.92); p.position.set(0, 0.05, 0.15); p.rotation.y = Math.PI; g.add(p); g.add(mesh(GEO.ball, mat([0xe2573c, 0xffd23f, 0x3f8fd6][Math.floor(Math.random() * 3)]), 0, 1.74, 0.15, 0.27, 0.22, 0.27)); }
  return g;
}

/** Nội thất taxi nhìn từ ghế sau. Toạ độ theo xe: +x là bên phải, -z là đầu xe, sàn ở y = 0,32. */
function buildCabin(): { shell: THREE.Group; wheel: THREE.Group; meter: THREE.Mesh; draw: (dong: number) => void } {
  const S = new THREE.Group(), trim = 0x3a3f4a, lining = 0xe9e4d8, seat = 0x6b5140, seatHi = 0x8a6a4a, yellow = 0xf7d14a;
  // sàn, trần, ca-pô vàng thấy qua kính lái
  box(S, 0x2e3138, 0, 0.3, 0.2, 1.7, 0.06, 3.2); box(S, lining, 0, 1.62, 0.25, 1.62, 0.06, 2.3);
  box(S, yellow, 0, 0.9, -1.85, 1.7, 0.12, 1.1); box(S, 0x4fa86a, 0, 0.84, -2.4, 1.72, 0.1, 0.06);
  // táp-lô, cụm đồng hồ, cần số
  box(S, trim, 0, 0.92, -1.12, 1.66, 0.28, 0.5); box(S, 0x2e3138, 0, 1.07, -1.3, 1.66, 0.06, 0.2);
  box(S, 0x2e3138, -0.38, 1.1, -1.0, 0.44, 0.12, 0.2); box(S, 0x2e3138, 0, 0.62, -0.35, 0.22, 0.34, 1.3); post(S, 0x8f97a3, 0, 0.78, -0.62, 0.2, 0.025); S.add(mesh(GEO.ball, mat(0x2e3138), 0, 1.0, -0.62, 0.05));
  // cửa và bệ cửa sổ hai bên, các trụ A/B/C, viền trên cửa
  for (const s of [-1, 1]) {
    box(S, trim, s * 0.86, 0.63, 0.15, 0.06, 0.66, 2.9); box(S, 0x565c69, s * 0.82, 0.93, 0.15, 0.1, 0.06, 2.9); box(S, 0x8f97a3, s * 0.8, 0.8, 0.55, 0.05, 0.05, 0.3);
    box(S, lining, s * 0.84, 1.56, 0.25, 0.08, 0.1, 2.4);
    box(S, trim, s * 0.84, 1.26, 0.02, 0.08, 0.66, 0.14); box(S, trim, s * 0.84, 1.26, 1.3, 0.08, 0.66, 0.2);
    const a = mesh(GEO.box, mat(trim), s * 0.82, 1.27, -1.08, 0.09, 0.78, 0.1); a.rotation.x = 0.5; S.add(a);
  }
  box(S, lining, 0, 1.58, -0.86, 1.7, 0.08, 0.14); box(S, trim, 0, 1.3, 1.52, 1.7, 0.7, 0.08); box(S, seat, 0, 0.95, 1.42, 1.56, 0.1, 0.24);
  // ghế trước (tài xế bên trái), tựa đầu, ghế sau
  for (const s of [-1, 1]) {
    box(S, seat, s * 0.4, 0.52, -0.42, 0.52, 0.16, 0.56); const b = mesh(GEO.box, mat(seat), s * 0.42, 0.87, -0.12, 0.48, 0.62, 0.14); b.rotation.x = 0.1; S.add(b);
    box(S, seatHi, s * 0.42, 0.87, -0.045, 0.38, 0.46, 0.02); box(S, seat, s * 0.42, 1.31, -0.08, 0.24, 0.16, 0.1); post(S, 0x8f97a3, s * 0.42, 1.18, -0.08, 0.08, 0.02);
    box(S, 0x4a5160, s * 0.4, 0.7, -0.03, 0.3, 0.18, 0.03);
  }
  box(S, seat, 0, 0.5, 0.95, 1.6, 0.18, 0.62); box(S, seatHi, -0.4, 0.6, 0.93, 0.62, 0.03, 0.5);
  // tài xế: vai, gáy, mũ lưỡi trai, hai tay đặt lên vô-lăng
  const shirt = 0x5aa0d8, skin = 0xf0c49a;
  box(S, shirt, -0.4, 1.0, -0.3, 0.46, 0.5, 0.24); S.add(mesh(GEO.ball, mat(shirt), -0.4, 1.24, -0.3, 0.27, 0.1, 0.15));
  post(S, skin, -0.4, 1.24, -0.31, 0.1, 0.065); S.add(mesh(GEO.ball, mat(skin), -0.4, 1.44, -0.33, 0.125, 0.135, 0.13), mesh(GEO.ball, mat(0x2e2014), -0.4, 1.47, -0.3, 0.13, 0.12, 0.13));
  box(S, 0x2e3138, -0.4, 1.56, -0.35, 0.25, 0.05, 0.25); box(S, 0x2e3138, -0.4, 1.535, -0.5, 0.22, 0.02, 0.12);
  for (const s of [-1, 1]) { const arm = mesh(GEO.cyl, mat(shirt), -0.4 + s * 0.21, 1.06, -0.52, 0.05, 0.46, 0.05); arm.rotation.x = -1.15; S.add(arm, mesh(GEO.ball, mat(skin), -0.4 + s * 0.17, 1.16, -0.76, 0.05)); }
  // gương chiếu hậu, thẻ tài xế, dây bùa treo gương
  box(S, 0x2e3138, 0, 1.47, -0.98, 0.3, 0.1, 0.04); box(S, 0xb9d8ee, 0, 1.47, -0.955, 0.26, 0.075, 0.01); post(S, 0x2e3138, 0, 1.5, -0.98, 0.08, 0.012);
  post(S, 0xe2573c, 0, 1.3, -0.98, 0.12, 0.006); S.add(mesh(GEO.ball, mat(0xffd23f), 0, 1.28, -0.98, 0.03));
  box(S, 0xfffaf0, 0.42, 1.1, -1.02, 0.2, 0.13, 0.02); box(S, 0x3f8fd6, 0.37, 1.1, -1.008, 0.07, 0.09, 0.01);
  const shell = new THREE.Group(); shell.add(bakeVC(S));
  // kính: phủ một lớp ám nhẹ để thấy mình đang ở trong xe
  const glass = new THREE.MeshBasicMaterial({ color: 0xbfe6f7, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
  for (const s of [-1, 1]) for (const [z, len] of [[-0.5, 0.9], [0.66, 1.1]]) { const p = new THREE.Mesh(GEO.box, glass); p.position.set(s * 0.87, 1.26, z); p.scale.set(0.01, 0.6, len); shell.add(p); }
  // vô-lăng
  const wheel = new THREE.Group(); wheel.position.set(-0.4, 1.08, -0.84); wheel.rotation.x = -0.42;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 24), mat(0x2e3138)); wheel.add(ring, mesh(GEO.box, mat(0x2e3138), 0, 0, 0, 0.32, 0.035, 0.02), mesh(GEO.cyl, mat(0x565c69), 0, 0, 0, 0.05, 0.03, 0.05));
  wheel.children[2].rotation.x = Math.PI / 2; shell.add(wheel);
  // đồng hồ tính tiền: hộp đen trên táp-lô, mặt số là ảnh vẽ lại mỗi khi giá nhảy
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (dong: number) => {
    const g = cv.getContext('2d')!; g.fillStyle = '#12161c'; g.fillRect(0, 0, 256, 128);
    g.fillStyle = '#ffd23f'; g.font = '800 26px "Baloo 2", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('TAXI', 12, 8);
    g.fillStyle = '#7fe08a'; g.font = '700 20px "Be Vietnam Pro", sans-serif'; g.textAlign = 'right'; g.fillText('đồng', 244, 12);
    g.fillStyle = '#ff5a3c'; g.font = '800 62px "Baloo 2", monospace'; g.textBaseline = 'alphabetic'; g.fillText(dong.toLocaleString('vi-VN'), 244, 112);
    tex.needsUpdate = true;
  };
  const meter = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshBasicMaterial({ map: tex })); meter.userData.own = true;
  meter.position.set(0.02, 1.2, -1.02); meter.rotation.x = -0.12;
  const back = mesh(GEO.box, mat(0x12161c), 0.02, 1.2, -1.05, 0.33, 0.18, 0.05); back.rotation.x = -0.12; back.castShadow = false;
  shell.add(back, meter);
  return { shell, wheel, meter, draw };
}

// ================================================================ cảnh 4: ngồi ghế sau nhìn đường
export class TaxiCabin implements Act {
  readonly stage = 4 as const;
  readonly caption: string;
  readonly duration: number;
  readonly root = new THREE.Group();
  readonly fog: [number, number] = [60, 250];
  dist = 0; progress = 0; alt = 0;
  readonly total: number;
  private world = new THREE.Group();
  private slots: { g: THREE.Group; k: number }[] = [];
  private cars: { g: THREE.Group; s: number; v: number; lane: number; back: boolean }[] = [];
  private boards: { sp: THREE.Sprite; pole: THREE.Mesh; s: number }[] = [];
  private light: THREE.Group; private lamps: THREE.Mesh[] = []; private lightS: number;
  private cabin: ReturnType<typeof buildCabin>;
  private info: TaxiInfo;
  private yaw = 0; private pitch = 0; private yawT = 0; private pitchT = 0;
  private drag: { id: number; x: number; y: number; yaw: number; pitch: number } | null = null;
  private speed = 0; private wait = 0; private passed = false; private shown = -1;
  private hold = 0;
  private off: (() => void)[] = [];

  constructor(info: TaxiInfo) {
    this.info = info; this.caption = info.caption; this.duration = info.seconds;
    this.total = SPEED * Math.max(1, info.seconds - 2.6);
    this.lightS = this.total * 0.44;
    const side: SideHint = info.side ?? (info.zone === 'dao' || info.zone === 'trung' ? 'bien' : info.zone === 'nam' ? 'song' : 'nui');
    const th = THEMES[info.zone], r = rng(info.seed);
    // nền: bên phải là biển thì cả nền là nước, đất liền nằm trong từng khúc đường
    const base = slab(side === 'bien' ? WATER : th.ground, side === 'bien' ? 0.3 : 1); base.receiveShadow = false; this.root.add(base);
    for (let i = 0; i < N; i++) { const g = this.slot(i, side, info.zone, r); this.slots.push({ g, k: i - 4 }); this.world.add(g); }
    // xe ngược chiều ở làn trái, xe máy cùng chiều sát lề phải
    const mk = (raw: THREE.Group, s: number, v: number, lane: number, back: boolean) => { const g = new THREE.Group(); g.add(bakeVC(raw)); this.world.add(g); this.cars.push({ g, s, v, lane, back }); };
    mk(buildMinibus(), 90, -13, -1.95, false); mk(buildBus(), 230, -12, -1.95, false); mk(buildTaxi(), 330, -14, -1.95, false); mk(motorbike(true), 150, -9, -3.0, false);
    mk(motorbike(true), 40, 8.5, 3.25, true); mk(motorbike(true), 120, 7.5, 3.3, true); mk(motorbike(true), 200, 9, 3.2, true);
    // biển chỉ đường: tên nơi đến và số km còn lại
    for (const f of [0.1, 0.33, 0.62, 0.86]) {
      const left = Math.max(1, Math.round(info.km * (1 - f)));
      const sp = sign(`${info.toName} · ${left.toLocaleString('vi-VN')} km`, '#1f7a3a', 5.6, 0, 4.3, 0), pole = mesh(GEO.cyl, mat(0x8f97a3), 0, 2, 0, 0.07, 4, 0.07); pole.castShadow = false;
      this.world.add(sp, pole); this.boards.push({ sp, pole, s: this.total * f });
    }
    // đèn giao thông cho một lần dừng đỏ
    const T = new THREE.Group(); post(T, 0x4a5160, 0, 0, 0, 5.2, 0.09); box(T, 0x4a5160, -1.5, 5.1, 0, 3.2, 0.12, 0.12); box(T, 0x2e3138, -2.8, 4.7, 0, 0.42, 1.1, 0.3);
    const tl = new THREE.Group(); tl.add(bakeVC(T));
    [0xe0342b, 0xf2c65c, 0x4fd66a].forEach((c, i) => { const m = new THREE.Mesh(GEO.ball, new THREE.MeshBasicMaterial({ color: c })); m.userData.own = true; m.position.set(-2.8, 5.05 - i * 0.35, 0.17); m.scale.setScalar(0.13); tl.add(m); this.lamps.push(m); });
    for (let i = 0; i < 5; i++) { const z = mesh(GEO.box, mat(0xffffff), -3.3 + i * 1.6, 0.09, 2.5, 0.8, 0.02, 2.2); z.castShadow = false; z.position.x -= 4; tl.add(z); }
    this.light = tl; this.world.add(tl);
    this.cabin = buildCabin(); this.cabin.draw(0);
    this.root.add(this.world, this.cabin.shell);
    this.bind(info.host);
    (window as unknown as { __taxi?: unknown }).__taxi = { look: (d: number) => this.look(d), state: () => ({ yaw: this.yaw / DEG, pitch: this.pitch / DEG, dist: this.dist, speed: this.speed }) };
  }

  /** Một khúc đường dài L: mặt đường, vạch, lề, và cảnh hai bên (trái theo miền, phải theo gợi ý). */
  private slot(i: number, side: SideHint, zone: Zone, r: () => number): THREE.Group {
    const S = new THREE.Group(), th = THEMES[zone], y = (i % 2) * 0.004, O = L + 1.2;
    box(S, th.road, 0, 0.02 + y, 0, 8, 0.1, O); for (const x of [-3.8, 3.8]) box(S, 0xfbf3df, x, 0.035 + y, 0, 0.2, 0.1, O);
    box(S, 0xffe36b, 0, 0.04, 0, 0.18, 0.1, 3.4);
    box(S, 0xcfc6ae, -4.9, 0.03 + y, 0, 1.8, 0.1, O); box(S, 0xcfc6ae, 4.9, 0.03 + y, 0, 1.8, 0.1, O);
    const P = (o: THREE.Group, x: number, z: number, sc = 1, ry = 0) => prop(S, o, x, 0, z, sc, ry);
    // ---- bên trái: làng quê theo miền
    box(S, th.ground, -108, -0.02 + y, 0, 204, 0.1, O + 6);
    if (i % 3 === 0) P(SCENERY.pole(), -5.6, 0);
    const kind = i % 5;
    if (kind === 0) P(stall(r), -10.5, 0, 1, Math.PI / 2);
    else if (kind === 1 || kind === 3) { P(SCENERY.house(), -11 - r() * 3, (r() - 0.5) * 2, 1.25 + r() * 0.3, Math.PI / 2); if (r() < 0.6) P(person(Math.floor(r() * 7), 1.2), -6.4, r() * 3 - 1.5, 1, Math.PI / 2); P(roadsideProp(zone, i, r), -6.8, 2.6, 1.3); }
    else if (kind === 2) { const f = SCENERY.rice(); P(f, -13, 0, 1.3, Math.PI / 2); P(SCENERY.rice(), -24, 0.5, 1.5, Math.PI / 2); }
    else P(SCENERY[th.kinds[Math.floor(r() * 3)]](), -8 - r() * 4, (r() - 0.5) * 4, 1.2 + r() * 0.5, r() * 6);
    for (let j = 0; j < 2; j++) { const k = th.kinds[Math.floor(r() * th.kinds.length)]; if (k !== 'pole') P(SCENERY[k](), -22 - r() * 46, (r() - 0.5) * L, 1.2 + r() * 0.8, r() * 6); }
    if (th.mountains !== null && i % 4 === 1) { const h = 26 + r() * 22; S.add(mesh(new THREE.ConeGeometry(20 + r() * 12, h, 7), mat(th.mountains), -120 - r() * 50, h / 2 - 2, 0)); }
    // ---- bên phải
    if (side === 'bien') {
      box(S, 0xb9d88a, 9.4, -0.02 + y, 0, 7.4, 0.1, O + 3); box(S, 0xf6ecc6, 20, -0.03 + y, 0, 14, 0.08, O + 5); box(S, 0xffffff, 27.3, -0.035, 0, 1.0, 0.06, O + 5);
      if (i % 2 === 0) P(SCENERY.palm(), 7.6 + r() * 1.5, (r() - 0.5) * 3, 1.25 + r() * 0.4, r() * 6);
      if (i % 6 === 2) { for (const dz of [-1.2, 1.4]) { post(S, 0xfffaf0, 17, 0, dz, 2.1, 0.04); S.add(mesh(GEO.cone, mat([0xe2573c, 0x3f8fd6, 0xffd23f][i % 3]), 17, 2.3, dz, 1.4, 0.5, 1.4)); box(S, 0xfffaf0, 17.9, 0.35, dz, 1.7, 0.1, 0.6); } }
      if (i % 6 === 4) { const t = new THREE.Group(); t.add(mesh(GEO.sphere, mat(0x3f8fd6), 0, 0.3, 0, 1.2, 0.5, 1.2), mesh(GEO.sphere, mat(0x2e3138), 0, 0.42, 0, 1.05, 0.4, 1.05)); P(t, 22, 1); }
      if (i % 7 === 3) P(SCENERY.ghe(), 40 + r() * 30, 0, 1.5, r() * 6);
      if (i % 10 === 5) P(SCENERY.islet(), 90 + r() * 60, 0, 3 + r() * 2);
      if (i % 15 === 9) { const k = karst(r); P(k, 170, 0, 1.4); }
    } else if (side === 'song') {
      box(S, th.ground, 9.6, -0.02 + y, 0, 7.6, 0.1, O + 3); box(S, WATER, 26, -0.04, 0, 26, 0.08, O + 6); box(S, th.ground, 139, -0.02 + y, 0, 200, 0.1, O + 8);
      if (i % 2 === 0) P(SCENERY.palm(), 8 + r() * 3, (r() - 0.5) * 3, 1.2 + r() * 0.4, r() * 6); else P(SCENERY.bush(), 9 + r() * 2, 0, 0.8);
      if (i % 4 === 1) P(SCENERY.ghe(), 20 + r() * 12, 0, 1.3, r() * 0.4);
      if (i % 6 === 3) { box(S, 0x9a7150, 14.5, 0.25, 0, 4, 0.1, 1.2); for (const x of [13, 16]) post(S, 0x7a5a3c, x, -0.3, 0.5, 0.8, 0.07); }
      for (let j = 0; j < 2; j++) P(SCENERY[j ? 'house' : 'palm'](), 44 + r() * 30, (r() - 0.5) * L, 1.3 + r() * 0.5, j ? -Math.PI / 2 : r() * 6);
    } else if (side === 'nui') {
      box(S, th.ground, 108, -0.02 + y, 0, 204, 0.1, O + 6);
      const h = 9 + r() * 9; S.add(mesh(new THREE.ConeGeometry(9 + r() * 4, h, 6), mat(i % 2 ? 0x7fb26a : 0x93c47a), 18 + r() * 6, h / 2 - 1, (r() - 0.5) * 3));
      const H = 34 + r() * 30; if (i % 2) S.add(mesh(new THREE.ConeGeometry(26 + r() * 14, H, 7), mat(th.mountains ?? 0xa9cbbd), 70 + r() * 50, H / 2 - 2, 0));
      P(SCENERY[zone === 'trung' || zone === 'nam' ? 'leaf' : 'pine'](), 7.5 + r() * 2.5, (r() - 0.5) * 4, 1.2 + r() * 0.6, r() * 6); if (i % 3 === 1) P(SCENERY.rock(), 7 + r() * 2, 2.5, 1.1 + r());
      if (i % 4 === 0) for (let x = -3; x <= 3; x += 1.5) { post(S, 0xfffaf0, 5.9, 0, x, 0.8, 0.07); box(S, 0xe0342b, 5.9, 0.7, x, 0.16, 0.14, 0.16); }
      if (i % 11 === 6 && zone === 'trung') P(chamTower(), 30, 0, 1.2, 0.4);
    } else {
      box(S, 0xd9d2c4, 108, -0.02 + y, 0, 204, 0.1, O + 6); box(S, 0xe9dfc8, 7.2, 0.08, 0, 2.8, 0.12, O);
      P(townHouse(r), 11.2, -2.3, 1, -Math.PI / 2); P(townHouse(r), 11.2, 2.3, 1, -Math.PI / 2);
      if (i % 2 === 0) P(lampPost(5), 6.2, 0, 1, Math.PI); else P(SCENERY.leaf(), 6.6, 0, 0.8);
      if (i % 3 === 1) P(person(i, 1.2), 7.4, 1.5, 1, r() * 6); if (i % 4 === 2) P(motorbike(false), 6.4, -2, 1, 0.2);
      for (let j = 0; j < 2; j++) { const h = 9 + r() * 14; box(S, [0xe3ecfa, 0xfff1c9, 0xdff0e6][Math.floor(r() * 3)], 24 + j * 14 + r() * 4, h / 2, (r() - 0.5) * 3, 7, h, 7); }
    }
    const g = new THREE.Group(); g.add(bakeVC(S)); return g;
  }

  // ------------------------------------------------------------ nhìn qua lại
  /** dir: -1 nhìn trái, 0 nhìn thẳng, 1 nhìn phải. Bấm lần nữa cùng hướng thì ngoái thêm. */
  look(dir: number) {
    const side = 72 * DEG;
    if (dir === 0) { this.yawT = 0; this.pitchT = 0; } else if (dir < 0) this.yawT = this.yawT > side * 0.5 ? YAW_MAX : side; else this.yawT = this.yawT < -side * 0.5 ? -YAW_MAX : -side;
    this.hold = 1e9;
  }
  private bind(host: HTMLElement) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const on = (el: EventTarget, ev: string, fn: (e: any) => void) => { el.addEventListener(ev, fn, { passive: false }); this.off.push(() => el.removeEventListener(ev, fn)); };
    on(host, 'pointerdown', (e: PointerEvent) => { this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: this.yawT, pitch: this.pitchT }; try { host.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } });
    on(host, 'pointermove', (e: PointerEvent) => {
      const d = this.drag; if (!d || d.id !== e.pointerId) return;
      const k = (150 * DEG) / Math.max(280, host.clientWidth);
      this.yawT = THREE.MathUtils.clamp(d.yaw + (e.clientX - d.x) * k, -YAW_MAX, YAW_MAX); this.pitchT = THREE.MathUtils.clamp(d.pitch + (e.clientY - d.y) * k * 0.6, -PITCH_MAX, PITCH_MAX);
      this.yaw = this.yawT; this.pitch = this.pitchT; this.hold = 1e9; e.preventDefault();
    });
    const up = (e: PointerEvent) => { if (this.drag?.id === e.pointerId) this.drag = null; };
    on(host, 'pointerup', up); on(host, 'pointercancel', up);
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') this.yawT = Math.min(YAW_MAX, this.yawT + 25 * DEG); else if (e.key === 'ArrowRight') this.yawT = Math.max(-YAW_MAX, this.yawT - 25 * DEG); else if (e.key === 'ArrowUp' || e.key === ' ') { this.yawT = 0; this.pitchT = 0; } else return;
      this.hold = 1e9; e.preventDefault();
    });
  }
  dispose() { for (const f of this.off) f(); this.off = []; const w = window as unknown as { __taxi?: unknown }; delete w.__taxi; }

  private place(o: THREE.Object3D, s: number, lateral: number) {
    const sl = dC(s), a = Math.atan(sl), n = 1 / Math.hypot(1, sl);
    o.position.set(C(s) - C(this.dist) + lateral * n, o.position.y, -(s - this.dist) + lateral * sl * n); o.rotation.y = -a;
  }

  update(t: number, dt: number, c: Ctx) {
    const D = this.duration, end = seg(t, D - 1.6, D - 0.1);
    // tốc độ: lăn bánh, chạy đều, dừng đèn đỏ một lần, về cuối thì chậm lại
    let want = SPEED * (1 - end * 0.75);
    const toLight = this.lightS - 5 - this.dist;
    if (!this.passed) {
      if (toLight < 34) want = Math.min(want, Math.max(0, toLight) * 0.62);
      if (toLight < 0.6) { this.wait += dt; want = 0; if (this.wait > 1.5) this.passed = true; }
    }
    this.speed += THREE.MathUtils.clamp(want - this.speed, -16 * dt, 7 * dt);
    this.dist += this.speed * dt; this.progress = Math.min(1, t / D); this.info.onTick?.(this.progress);
    const red = !this.passed && this.wait < 1.5, amber = !this.passed && toLight < 60 && toLight > 30;
    this.lamps.forEach((m, i) => { const onL = i === 0 ? red && !amber : i === 1 ? amber : !red; (m.material as THREE.MeshBasicMaterial).color.setHex(onL ? [0xff3b2f, 0xffc93c, 0x4fe06e][i] : 0x30353d); });

    // đồng hồ tính tiền nhảy theo quãng đường, cuối chặng về đúng giá vé
    const fare = this.info.fare, open = Math.min(fare, Math.max(5000, Math.round(fare * 0.12 / 1000) * 1000));
    const now = this.progress >= 0.985 ? fare : Math.floor((open + (fare - open) * this.progress) / 500) * 500;
    if (now !== this.shown) { this.shown = now; this.cabin.draw(now); this.info.onMeter?.(now); }

    // đường trôi ngược: khúc nào tụt lại sau thì đem lên đầu
    const head = Math.atan(dC(this.dist));
    this.world.rotation.y = head;
    for (const sl of this.slots) { while ((sl.k + 0.5) * L - this.dist < -4 * L) sl.k += N; this.place(sl.g, (sl.k + 0.5) * L, 0); }
    for (const car of this.cars) {
      car.s += car.v * dt;
      if (car.back ? car.s < this.dist - 30 : car.s < this.dist - 24) car.s = this.dist + 170 + Math.random() * 110;
      if (car.back && car.s > this.dist + 300) car.s = this.dist + 60;
      // xe ngược chiều cũng chờ đèn; xe máy cùng chiều dừng sau vạch
      if (red && Math.abs(car.s - this.lightS) < 8) car.s -= car.v * dt;
      car.g.position.y = bob(c.time + car.s, 1); this.place(car.g, car.s, car.lane); if (!car.back) car.g.rotation.y += Math.PI;
    }
    for (const b of this.boards) { this.place(b.pole, b.s, 5.6); this.place(b.sp, b.s, 5.6); b.sp.position.y = 4.3; b.sp.visible = b.pole.visible = b.s - this.dist > -6 && b.s - this.dist < 230; }
    this.place(this.light, this.lightS, 5.2); this.light.position.y = 0;

    // nhìn quanh: bám theo đích, xe rung và nghiêng khi vào cua
    const k = 1 - Math.exp(-dt * 9); this.yaw += (this.yawT - this.yaw) * k; this.pitch += (this.pitchT - this.pitch) * k;
    const curve = dC(this.dist + 6) - dC(this.dist - 6), mv = this.speed / SPEED, cam = c.camera;
    const fov = c.portrait ? 82 : 64; if (cam.fov !== fov || cam.near !== 0.06) { cam.fov = fov; cam.near = 0.06; cam.updateProjectionMatrix(); }
    cam.position.set(0.17 - curve * 0.25 * mv, 1.36 + Math.sin(c.time * 23) * 0.004 * mv + Math.sin(c.time * 7.3) * 0.006 * mv, 0.86);
    cam.rotation.order = 'YXZ'; cam.rotation.set(-this.pitch - 0.1, this.yaw + 0.04, -curve * 1.6 * mv + Math.sin(c.time * 5.1) * 0.004 * mv);
    this.cabin.wheel.rotation.z = curve * 7 * mv;
  }
}

// ================================================================ cảnh 5: taxi trả khách trước cổng nơi đến
export class TaxiStop {
  readonly root = new THREE.Group();
  private w = new Walker();
  private car: THREE.Group;
  private pts: THREE.Vector3[]; private signs: THREE.Sprite[];
  private name: string;

  constructor(zone: Zone, name: string) {
    this.name = name;
    const r = rng(hash(name + 'taxi')), S = new THREE.Group(), th = THEMES[zone];
    this.root.add(slab(th.ground)); roadAlongZ(S, th.road);
    // vỉa hè, quảng trường nhỏ và cổng chào bên +x
    box(S, 0xe9dfc8, 6.4, 0.06, 0, 4.8, 0.16, 60); box(S, 0xf3e6c2, 13.5, 0.05, -3, 9.6, 0.12, 15);
    for (const z of [-7.2, 1.2]) { box(S, 0xc2452f, 10.2, 2.3, z, 0.9, 4.6, 0.9); box(S, 0xfff1c9, 10.2, 4.75, z, 1.2, 0.3, 1.2); }
    box(S, 0xc2452f, 10.2, 5.2, -3, 1.0, 0.7, 10.2); box(S, 0x8a3324, 10.2, 5.75, -3, 1.5, 0.3, 11.2); box(S, 0xf2c65c, 10.2, 6.0, -3, 0.9, 0.16, 9.6);
    for (const z of [-9.4, 3.4]) { post(S, 0x8f97a3, 9.2, 0, z, 3.4, 0.05); S.add(mesh(GEO.ball, mat(0xe2573c, { emissive: 0xff6a4a }), 9.2, 3.0, z, 0.36, 0.44, 0.36)); }
    for (const z of [-11.5, 5.6]) prop(S, SCENERY[zone === 'taynguyen' ? 'pine' : zone === 'bac' ? 'leaf' : 'palm'](), 12.4, 0, z, 1.2 + r() * 0.3, r() * 6);
    prop(S, stall(r), 16.5, 0, 6.5, 1, -Math.PI / 2 - 0.3); prop(S, lampPost(4.6), 4.6, 0, -10, 1, Math.PI);
    crowd(S, [[13.4, 0.1, -5.4, -1.2], [14.2, 0.1, -1.2, -2.2], [8.4, 0.16, 5, -1.6], [15.6, 0.1, -7.4, 1.4]], hash(name) & 7);
    const parked = buildTaxi(); prop(S, parked, 3.0, 0, 15.5, 1, 0);
    const label = sign(`Chào mừng đến ${name}`, '#d9482b', 13, 10.2, 7.9, -3); this.root.add(label);
    backdrop(S, this.root, zone, r, 14);
    this.root.add(bake(S, true));
    this.car = bake(buildTaxi(), true); const top = sign('TAXI', '#1f7a3a', 1.5, 0, 2.25, 0.1); this.car.add(top); this.car.position.set(1.9, 0, 90); this.root.add(this.car, this.w.g);
    this.pts = [V3(0.6, 0, -3.4), V3(3.2, 2.3, 3.4), V3(10.6, 0, -8.4), V3(10.6, 6.2, 2.4), V3(13, 0, 1)]; this.signs = [label];
  }

  arrive(): Act {
    const D = 5.4, P = [V3(3.2, 0, 0.3), V3(5.4, 0.16, -0.6), V3(9.2, 0.16, -3)];
    this.w.hide(1);
    return {
      stage: 5, caption: `Taxi trả khách trước cổng ${this.name}`, duration: D, root: this.root, fog: [100, 320],
      update: (t, _dt, c) => {
        const k = seg(t, 0, 2.3);
        this.car.position.z = 62 * (1 - k) ** 2; this.car.position.y = bob(c.time, k < 1 ? 1 : 0);
        const u = seg(t, 2.8, 4.8);
        if (t >= 2.8) { this.w.walk(P, u, c.time); this.w.hide(1 - seg(u, 0, 0.1)); if (u >= 1) this.w.face(1, -0.2); }
        c.shoot(this.pts, c.portrait ? 2.5 : 2.1, c.portrait ? 0.46 : 0.22, this.signs);
      },
    };
  }
}

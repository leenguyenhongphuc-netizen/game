// Khu trạm dừng nghỉ / cây xăng / trạm sạc khi rẽ khỏi cao tốc: nhánh rẽ vào, bãi đỗ có ô kẻ vạch, mái che cây xăng với trụ bơm có số,
// trụ sạc, toà nhà cửa hàng + quán ăn + nhà vệ sinh, lối nhập lại cao tốc. Người chơi tự lái vào ô (vào gần rồi thả tay là xe tự căn),
// xuống xe đi bộ vào cửa hàng, nhà vệ sinh; cầm vòi bơm (hoặc súng sạc) cắm vào xe, đồng hồ trụ nhảy số, treo vòi trả tiền rồi đi tiếp.
import * as THREE from 'three';
import { bakeColored } from '../scene/batch.ts';
import { Quality, ease, rendererParams, stepDt } from '../perf.ts';
import { GEO, mat, mesh } from '../scene/plants.ts';
import { makeFarmer } from '../scene/World.ts';
import { playerVehicle } from './DriveExtras.ts';
import type { VehGroup } from './DriveExtras.ts';
import { makeSign } from './DriveScene.ts';

export type StopKind = 'rest' | 'fuel' | 'charger';
export interface StopAreaInfo {
  kind: StopKind; name: string; electric: boolean;
  /** Năng lượng đang có, dung tích bình/pin, đơn vị ('lít' | 'kWh'), giá mỗi đơn vị. */
  energy: number; tank: number; unit: string; price: number;
  group?: VehGroup; color?: number; cold?: boolean; shirt?: number; hat?: string;
}
export type BayKind = 'pump' | 'charger' | 'lot';
export type Spot = 'shop' | 'food' | 'wc' | 'pump' | 'charger' | 'car';
export type StopPhase = 'drive' | 'parked' | 'walk' | 'leave' | 'done';
export interface StopHud {
  phase: StopPhase; bay: BayKind | null; pump: number | null; near: Spot | null; holding: 'nozzle' | 'cable' | null; plugged: boolean; pumping: boolean;
  added: number; cost: number; paid: boolean; energy: number; tank: number; unit: string; electric: boolean; wc: boolean; inWc: boolean;
  snapHint: boolean; autoMoving: boolean; msg: string | null;
}
export interface StopResult { added: number; cost: number; wc: boolean; minutes: number }

interface Bay { kind: BayKind; x: number; z: number; yaw: number; path: [number, number][]; pump?: number; taken?: boolean }
interface Box2 { x0: number; z0: number; x1: number; z1: number }

const Y_S = Math.PI; // xe hướng nam (+z): ô trụ bơm, trụ sạc chạy thẳng vào, chạy thẳng ra; ô bãi đỗ thì lùi ra
const LOT: Box2 = { x0: -30, z0: -26, x1: 34, z1: 12.4 };
const BUILDING: Box2 = { x0: -27, z0: 14, x1: 23, z1: 25 };
const ISLANDS: Box2[] = [{ x0: -16.8, z0: -15.5, x1: -15.2, z1: -8.5 }, { x0: -6.8, z0: -15.5, x1: -5.2, z1: -8.5 }];
const CHARGER_X = [8, 14, 20];
const DOORS: Record<'shop' | 'food' | 'wc', [number, number]> = { shop: [-14, 13.4], food: [-1, 13.4], wc: [13, 13.4] };
const ENTRY: [number, number] = [-37, -24];
const EXIT: [number, number] = [41, -24];

function makeBays(): Bay[] {
  const out: Bay[] = [];
  [-19, -13, -9, -3].forEach((x, i) => out.push({ kind: 'pump', x, z: -12, yaw: Y_S, path: [[x, -22]], pump: i + 1 }));
  for (const x of CHARGER_X) out.push({ kind: 'charger', x, z: -11, yaw: Y_S, path: [[x, -22]] });
  for (let i = 0; i < 10; i++) { const x = -24 + i * 4.2; out.push({ kind: 'lot', x, z: 8.4, yaw: Y_S, path: [[-27, -2], [x - 3.5, -1.5]] }); }
  return out;
}
const pumpPos = (b: Bay): [number, number] => [b.x < -11 ? -16 : -6, b.pump && b.pump % 2 === 1 ? -14 : -10];
const chargerPos = (b: Bay): [number, number] => [b.x + 2.6, -11];

function label(text: string, bg: string, w: number, fg = '#ffffff'): THREE.Sprite { const s = makeSign(text, bg, fg); s.scale.set(w, w / 4, 1); return s; }
function boxM(color: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, o: { emissive?: number; rough?: number } = {}) { return mesh(GEO.box, mat(color, o), x, y, z, sx, sy, sz); }
function stripe(g: THREE.Group, x: number, z: number, w: number, l: number, color = 0xffffff) { g.add(boxM(color, x, 0.035, z, w, 0.02, l, { rough: 1 })); }
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class StopArea {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(48, 1, 0.3, 400);
  private quality: Quality; private raf = 0; private last = 0; private disposed = false; private own: { dispose(): void }[] = [];
  private car: THREE.Group; private carLen = 5; private carHalfW = 1;
  private person: ReturnType<typeof makeFarmer>;
  private hose: THREE.Group; private hoseSegs: THREE.Mesh[] = []; private nozzle: THREE.Mesh;
  private screens: { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D; x: number; z: number }[] = [];
  private bays = makeBays();
  // xe
  private phase: StopPhase = 'drive'; private cx = ENTRY[0]; private cz = ENTRY[1]; private yaw = -2.0; private v = 0;
  private path: [number, number][] = []; private target: Bay | null = null; private revZ: number | null = null; private stuckT = 0;
  private bay: Bay | null = null; private joy = { x: 0, y: 0 }; private keys = new Set<string>();
  // người
  private px = 0; private pz = 0; private pyaw = 0; private walkT = 0; private walkPath: [number, number][] = [];
  private holding: 'nozzle' | 'cable' | null = null; private plugged = false; private pumping = false; private paid = true; private fuelName = '';
  private hosePump: [number, number] | null = null;
  private added = 0; private cost = 0; private energy: number; private wc = false; private wcT = 0; private minutes = 0;
  private msg: string | null = null; private msgT = 0; private camX = ENTRY[0]; private camZ = ENTRY[1]; private hudT = 0;
  private auto = false; private autoStep = 0; private autoT = 0;
  /** Mái che cây xăng: mờ đi khi xe/người ở dưới để máy quay nhìn thấy trụ bơm. */
  private roof: THREE.Group | null = null; private roofMats: THREE.Material[] = []; private roofSign: THREE.Sprite | null = null; private roofA = 1;

  constructor(private host: HTMLElement, private info: StopAreaInfo, private cb: { onHud(h: StopHud): void; onDone(r: StopResult): void; onSpot?(s: 'shop' | 'food'): void }) {
    this.energy = info.energy;
    this.renderer = new THREE.WebGLRenderer(rendererParams(host)); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.quality = new Quality(this.renderer, { name: 'trạm dừng' });
    host.appendChild(this.renderer.domElement); this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    const veh = playerVehicle(info.group ?? 'tai_nhe', info.color ?? 0xf08a24, { electric: info.electric, cold: !!info.cold });
    this.car = bakeColored(veh.root, false); this.carLen = Math.max(4, Math.min(14, veh.rearZ * 2)); this.carHalfW = veh.halfW;
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(veh.halfW * 2 + 0.8, this.carLen + 1.2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = 0.05; this.car.add(sh); this.own.push(sh.geometry, sh.material as THREE.Material);
    this.person = makeFarmer(info.shirt ?? 0x3b7dd8, info.hat ?? 'non_la'); this.person.root.scale.setScalar(1.35); this.person.root.visible = false;
    this.hose = new THREE.Group(); this.hose.visible = false;
    const hm = new THREE.MeshStandardMaterial({ color: info.electric ? 0x14532d : 0x1b1d22, roughness: 0.6 }); this.own.push(hm);
    for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(GEO.cyl, hm); m.frustumCulled = false; this.hoseSegs.push(m); this.hose.add(m); }
    this.nozzle = boxM(info.electric ? 0x22a35a : 0x2b2f36, 0, 0, 0, 0.2, 0.2, 0.5); this.nozzle.visible = false;
    this.build();
    this.scene.add(this.car, this.person.root, this.hose, this.nozzle);
    this.car.position.set(this.cx, 0, this.cz); this.car.rotation.y = this.yaw;
    window.addEventListener('resize', this.resize); window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey); this.resize();
    this.path = [[-28, -20]]; // xe tự lăn hết nhánh rẽ vào tới đầu bãi
    const w = window as unknown as { __stop?: unknown; __stopAuto?: boolean };
    this.auto = !!w.__stopAuto;
    w.__stop = { state: () => this.hudNow(), park: (k: BayKind) => this.parkAt(k), getOut: () => this.getOut(), walkTo: (s: Spot) => this.walkTo(s), act: (s?: Spot) => this.act(s), pump: (on: boolean) => this.setPump(on), leave: () => this.leave(), auto: () => { this.auto = true; this.autoStep = 0; }, pos: () => ({ car: [this.cx, this.cz], person: [this.px, this.pz] }) };
    this.raf = requestAnimationFrame(this.frame);
  }

  // ---------------------------------------------------------------- dựng cảnh
  private build() {
    const sc = this.scene, info = this.info, pumps = !(info.electric && info.kind === 'charger');
    sc.background = new THREE.Color(0xbfe4f5); sc.fog = new THREE.Fog(0xbfe4f5, 90, 220);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x88a27a, 1.25)); const sun = new THREE.DirectionalLight(0xfff2d6, 1.4); sun.position.set(30, 60, 20); sc.add(sun);
    const g = new THREE.Group();
    // nền cỏ, cao tốc phía bắc, nhánh rẽ vào và lối nhập lại
    g.add(boxM(0x8fc46a, 0, -0.06, 0, 260, 0.1, 200, { rough: 1 }));
    g.add(boxM(0x4b525c, 0, 0, -50, 260, 0.04, 16, { rough: 1 }));
    for (let x = -120; x < 130; x += 9) stripe(g, x, -50, 4, 0.22);
    stripe(g, 0, -57.6, 260, 0.25); stripe(g, 0, -42.4, 260, 0.25); g.add(boxM(0xd8dde3, 0, 0.45, -41.6, 120, 0.9, 0.35));
    const ramp = (x0: number, z0: number, x1: number, z1: number) => { const l = Math.hypot(x1 - x0, z1 - z0), m = boxM(0x555c66, (x0 + x1) / 2, 0.012, (z0 + z1) / 2, 7, 0.04, l, { rough: 1 }); m.rotation.y = Math.atan2(x1 - x0, z1 - z0); g.add(m); };
    ramp(-82, -46, -32, -24); ramp(36, -24, 84, -46);
    // bãi đỗ, vỉa hè trước nhà, ô kẻ vạch
    g.add(boxM(0x5b626c, (LOT.x0 + LOT.x1) / 2, 0.006, (LOT.z0 + LOT.z1) / 2, LOT.x1 - LOT.x0 + 4, 0.03, LOT.z1 - LOT.z0, { rough: 1 }));
    g.add(boxM(0xc9ccd1, (LOT.x0 + LOT.x1) / 2, 0.12, 13.2, LOT.x1 - LOT.x0, 0.24, 1.6, { rough: 1 }));
    for (const b of this.bays.filter((b) => b.kind === 'lot')) { stripe(g, b.x - 2.1, b.z, 0.14, 5.6); stripe(g, b.x + 2.1, b.z, 0.14, 5.6); }
    stripe(g, -24 + 4.5 * 4.2, 5.6, 46, 0.14);
    for (const b of this.bays.filter((b) => b.kind === 'charger')) { g.add(boxM(0x2f9e5a, b.x, 0.03, b.z, 3.4, 0.02, 6, { rough: 1 })); stripe(g, b.x - 2, b.z, 0.14, 6.4); stripe(g, b.x + 2, b.z, 0.14, 6.4); }
    for (const [x, z, r] of [[-27, -21, 1.9], [26, -10, Math.PI], [0, -1.5, Math.PI / 2], [30, -16, 0]] as [number, number, number][]) { const a = boxM(0xffffff, x, 0.04, z, 0.4, 0.02, 2.6, { rough: 1 }); a.rotation.y = r; g.add(a); }
    // cây xăng: mái che, hai đảo bơm, trụ bơm
    if (pumps) {
      const roof = new THREE.Group(); roof.add(boxM(0xf08a24, -11, 6.1, -12, 22, 0.5, 13), boxM(0xffffff, -11, 5.8, -12, 22.4, 0.2, 13.4));
      this.roof = bakeColored(roof, false); this.roof.traverse((o) => { const me = o as THREE.Mesh; if (!me.isMesh) return; const m = (me.material as THREE.Material).clone(); m.transparent = true; me.material = m; this.roofMats.push(m); this.own.push(m); }); sc.add(this.roof);
      for (const [x, z] of [[-22, -17.8], [-22, -6.2], [0, -17.8], [0, -6.2]]) g.add(mesh(GEO.cyl, mat(0xeef0f3), x, 3, z, 0.28, 6, 0.28));
      for (const isl of ISLANDS) {
        const x = (isl.x0 + isl.x1) / 2; g.add(boxM(0xd7dbe0, x, 0.15, -12, 1.6, 0.3, 7));
        for (const z of [-14, -10]) g.add(boxM(0xe0342b, x, 1.15, z, 0.9, 1.9, 0.9), boxM(0x2b2f36, x, 1.8, z, 0.95, 0.5, 0.6), boxM(0x9aa1ab, x - 0.5, 1.1, z, 0.1, 0.5, 0.3), boxM(0x9aa1ab, x + 0.5, 1.1, z, 0.1, 0.5, 0.3));
      }
    }
    // trụ sạc nằm bên phải mỗi ô sạc
    for (const b of this.bays.filter((b) => b.kind === 'charger')) { const [x, z] = chargerPos(b); g.add(boxM(0x1f9d5a, x, 1.0, z, 0.6, 2.0, 0.9), boxM(0xffffff, x - 0.31, 1.55, z, 0.04, 0.5, 0.6), boxM(0x2b2f36, x - 0.3, 1.0, z + 0.3, 0.2, 0.5, 0.12)); }
    g.add(boxM(0x1f9d5a, 17, 3.6, -11, 0.3, 0.3, 7), mesh(GEO.cyl, mat(0xeef0f3), 24, 1.8, -11, 0.15, 3.6, 0.15));
    // toà nhà: cửa hàng tiện lợi, quán ăn, nhà vệ sinh
    const bw = BUILDING.x1 - BUILDING.x0, bx = (BUILDING.x0 + BUILDING.x1) / 2, bz = (BUILDING.z0 + BUILDING.z1) / 2;
    g.add(boxM(0xfff6e2, bx, 2.2, bz, bw, 4.4, BUILDING.z1 - BUILDING.z0), boxM(0x2f6fd0, bx, 4.6, bz, bw + 1, 0.5, BUILDING.z1 - BUILDING.z0 + 1));
    g.add(boxM(0x8ec9dc, bx, 2.0, BUILDING.z0 - 0.02, bw - 2, 2.4, 0.05));
    for (const [k, [x]] of Object.entries(DOORS)) g.add(boxM(k === 'wc' ? 0x3c6e9e : 0x6a4a2f, x, 1.3, BUILDING.z0 - 0.06, 2.2, 2.6, 0.08));
    g.add(boxM(0xf3f4f6, bx, 3.4, BUILDING.z0 - 1.4, bw, 0.12, 2.8));
    for (const [x, z] of [[-31, 18], [27, 18], [-33, -4], [37, 4], [31, 30], [-31, 32]]) g.add(mesh(GEO.cyl, mat(0x7a5232), x, 1, z, 0.25, 2, 0.25), mesh(GEO.ball, mat(0x4f9f45), x, 2.8, z, 1.8));
    for (const x of [-20, 6, 19]) g.add(boxM(0x8a8f96, x, 0.45, 11.9, 1.8, 0.16, 0.6), boxM(0x2f8f4e, x + 1.4, 0.45, 11.9, 0.5, 0.9, 0.5));
    sc.add(bakeColored(g, false));
    // biển hiệu
    const nm = label(`☕ ${info.name}`, '#2f6fd0', 15); nm.position.set(bx, 6.6, BUILDING.z0); sc.add(nm);
    for (const [txt, bg, x] of [['🛒 Cửa hàng tiện lợi', '#e0342b', DOORS.shop[0]], ['🍜 Quán ăn', '#f08a24', DOORS.food[0]], ['🚻 Nhà vệ sinh', '#2f6fd0', DOORS.wc[0]]] as [string, string, number][]) { const s = label(txt, bg, 6); s.position.set(x, 3.0, BUILDING.z0 - 0.3); sc.add(s); }
    if (pumps) { const s = label(`⛽ ${Math.round(info.electric ? 25_000 : info.price).toLocaleString('vi-VN')}đ/lít`, '#f08a24', 9); s.position.set(-11, 7.3, -12); sc.add(s); this.roofSign = s; }
    { const s = label(`⚡ Sạc nhanh${info.electric ? ` ${Math.round(info.price).toLocaleString('vi-VN')}đ/kWh` : ''}`, '#1f9d5a', 7); s.position.set(14, 4.6, -11); sc.add(s); }
    { const s = label('LỐI VÀO →', '#2f6fd0', 6); s.position.set(-42, 3.2, -30); sc.add(s); const t = label('RA CAO TỐC →', '#1f9d5a', 7); t.position.set(42, 3.2, -31); sc.add(t); }
    if (pumps) {
      for (const b of this.bays.filter((b) => b.kind === 'pump')) { const n = label(`Trụ ${b.pump}`, '#2b2f36', 2.6); const p = pumpPos(b); n.position.set(p[0] + (b.x < p[0] ? -0.9 : 0.9), 3.0, p[1]); sc.add(n); }
      for (const isl of ISLANDS) for (const z of [-14, -10]) {
        const c = document.createElement('canvas'); c.width = 128; c.height = 64; const ctx = c.getContext('2d')!; const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
        const x = (isl.x0 + isl.x1) / 2, m = new THREE.MeshBasicMaterial({ map: tex });
        for (const side of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), m); p.position.set(x + side * 0.48, 1.62, z); p.rotation.y = side * Math.PI / 2; sc.add(p); this.own.push(p.geometry); }
        this.own.push(tex, m); const s = { tex, ctx, x, z }; this.screens.push(s); this.drawScreen(s, 0, 0);
      }
    }
    // vài xe đỗ sẵn cho có không khí
    const lots = this.bays.filter((b) => b.kind === 'lot');
    for (const i of [1, 7]) { const b = lots[i]; const o = bakeColored(playerVehicle('ban_tai', i === 1 ? 0xc9302c : 0x9aa6b2).root); o.position.set(b.x, 0, b.z); o.rotation.y = b.yaw; sc.add(o); b.taken = true; }
  }
  private drawScreen(s: { tex: THREE.CanvasTexture; ctx: CanvasRenderingContext2D }, l: number, money: number) {
    const g = s.ctx; g.fillStyle = '#0f1a12'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#7dff8a'; g.font = 'bold 22px monospace'; g.textAlign = 'right';
    g.fillText(money.toLocaleString('vi-VN'), 122, 26); g.font = 'bold 18px monospace'; g.fillText(`${l.toFixed(2)} L`, 122, 54); s.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- điều khiển từ giao diện
  setJoy(x: number, y: number) { this.joy.x = Math.max(-1, Math.min(1, x)); this.joy.y = Math.max(-1, Math.min(1, y)); if (Math.hypot(x, y) > 0.2) { if (this.phase === 'drive') { this.path = []; this.target = null; } this.walkPath = []; } }
  /** Tự lái tới ô trống gần nhất của loại `k` (nút trợ lái "Vào trụ bơm", "Vào ô đỗ"…). */
  parkAt(k: BayKind): boolean {
    if (this.phase !== 'drive' || (k === 'pump' && (this.info.electric))) return false;
    const b = this.bays.filter((b) => b.kind === k && !b.taken).sort((a, c) => Math.hypot(a.x - this.cx, a.z - this.cz) - Math.hypot(c.x - this.cx, c.z - this.cz))[0];
    if (!b) return false;
    this.target = b; this.path = [...b.path, [b.x, b.z]]; return true;
  }
  getOut(): boolean {
    if (this.phase !== 'parked') return false;
    const s = this.side(), f = this.fwd(this.yaw), d = this.carHalfW + 0.9, e = this.carLen / 2 + 1;
    const cands: [number, number][] = [[this.cx + s[0] * d, this.cz + s[1] * d], [this.cx - s[0] * d, this.cz - s[1] * d], [this.cx - f[0] * e, this.cz - f[1] * e], [this.cx + f[0] * e, this.cz + f[1] * e]];
    const p = cands.find(([x, z]) => this.walkable(x, z)) ?? cands[0];
    this.px = p[0]; this.pz = p[1]; this.pyaw = this.yaw; this.person.root.visible = true; this.person.root.position.set(this.px, 0, this.pz); this.phase = 'walk'; return true;
  }
  private getIn(): boolean {
    if (this.phase !== 'walk' || this.near() !== 'car') return false;
    if (this.holding) { this.say(this.holding === 'nozzle' ? 'Treo vòi bơm lại trụ trước đã' : 'Treo súng sạc lại trụ trước đã'); return false; }
    if (this.plugged) { this.say('Rút vòi/súng sạc ra khỏi xe trước đã'); return false; }
    if (!this.paid) { this.say('Chưa trả tiền ở trụ'); return false; }
    this.person.root.visible = false; this.phase = 'parked'; return true;
  }
  /** Lên xe (nếu đang đi bộ) rồi tự chạy theo lối nhập lại cao tốc. */
  leave(): boolean {
    if (this.phase === 'walk' && !this.getIn()) return false;
    if (this.phase !== 'parked' && this.phase !== 'drive') return false;
    if (this.plugged || !this.paid || this.holding) { this.say(this.plugged || this.holding ? 'Treo vòi bơm/súng sạc trước khi chạy' : 'Chưa trả tiền'); return false; }
    const lot = this.bay?.kind === 'lot', first: [number, number][] = lot ? [[this.cx + 7, -1]] : this.bay ? [[this.cx, -1]] : [];
    this.phase = 'leave'; this.target = null; this.revZ = lot ? -1 : null; this.stuckT = 0;
    this.path = [...first, [27, -1], [31, -18], EXIT];
    if (this.bay) this.bay.taken = false; this.bay = null; return true;
  }
  /** Nút hành động tại chỗ đang đứng (hoặc chỗ `s` khi bộ kiểm gọi). */
  act(s?: Spot): boolean {
    const n = s ?? this.near(); if (!n || this.phase !== 'walk' || this.wcT > 0) return false;
    if (n === 'wc') { if (this.wc) { this.say('Bạn vừa đi vệ sinh rồi'); return false; } this.wcT = 2.4; this.person.root.visible = false; this.minutes += 5; return true; }
    if (n === 'shop' || n === 'food') { this.cb.onSpot?.(n); this.minutes += 5; return true; }
    if (n === 'pump' || n === 'charger') {
      if (this.holding) { // treo vòi lại trụ và trả tiền
        if (this.plugged) { this.say('Rút vòi khỏi xe trước đã'); return false; }
        this.holding = null; this.hosePump = null;
        if (this.added > 0 && !this.paid) { this.paid = true; this.say(`💳 Đã trả ${Math.round(this.cost).toLocaleString('vi-VN')}đ cho ${this.added.toFixed(1)} ${this.info.unit}`); }
        return true;
      }
      const want: BayKind = n === 'pump' ? 'pump' : 'charger';
      if (!this.bay || this.bay.kind !== want) { this.say(n === 'pump' ? 'Đỗ xe vào làn trụ bơm trước' : 'Đỗ xe vào ô trụ sạc trước'); return false; }
      if (this.energy >= this.info.tank - 0.4) { this.say(this.info.electric ? 'Pin còn đầy' : 'Bình còn đầy'); return false; }
      this.holding = n === 'pump' ? 'nozzle' : 'cable'; this.hosePump = n === 'pump' ? pumpPos(this.bay) : chargerPos(this.bay);
      this.say(n === 'pump' ? `Đã cầm vòi ${this.fuelName || 'bơm'} — tới nắp bình của xe` : 'Đã cầm súng sạc — tới cổng sạc của xe'); return true;
    }
    if (n === 'car') {
      if (this.holding && !this.plugged) { this.plugged = true; this.paid = false; if (this.info.electric) { this.pumping = true; this.say('🔌 Đã cắm súng sạc — đang sạc'); } else this.say('Đã cắm vòi — giữ nút Bơm hoặc bấm Đổ đầy'); return true; }
      if (this.plugged) { this.plugged = false; this.pumping = false; this.say('Đã rút — mang về treo ở trụ để trả tiền'); return true; }
      return this.getIn();
    }
    return false;
  }
  setPump(on: boolean) { this.pumping = on && this.plugged; }
  setFuelName(n: string) { this.fuelName = n; }
  walkTo(s: Spot) { if (this.phase === 'walk') this.walkPath = this.route(this.spotPos(s)); }
  private done() { if (this.phase !== 'done') { this.phase = 'done'; this.cb.onDone({ added: Math.round(this.added * 10) / 10, cost: Math.round(this.cost), wc: this.wc, minutes: this.minutes + 10 }); } }

  // ---------------------------------------------------------------- tiện ích
  /** Bên trái xe (phía cửa lái). */
  private side(): [number, number] { return [-Math.cos(this.yaw), Math.sin(this.yaw)]; }
  private fwd(yaw: number): [number, number] { return [-Math.sin(yaw), -Math.cos(yaw)]; }
  private pumpSide(): number { const s = this.side(); return this.hosePump ? Math.sign((this.hosePump[0] - this.cx) * s[0] + (this.hosePump[1] - this.cz) * s[1]) || 1 : 1; }
  /** Nắp bình / cổng sạc: phía sau thân xe, bên phía trụ. */
  private capPos(): [number, number] {
    const f = this.fwd(this.yaw), s = this.side(), r = this.carLen * 0.2, k = this.pumpSide();
    return [this.cx - f[0] * r + s[0] * (this.carHalfW + 0.05) * k, this.cz - f[1] * r + s[1] * (this.carHalfW + 0.05) * k];
  }
  private spotPos(s: Spot): [number, number] {
    if (s === 'shop' || s === 'food' || s === 'wc') { const d = DOORS[s]; return [d[0], d[1] - 0.9]; }
    if (s === 'pump') { const b = this.bay?.kind === 'pump' ? this.bay : this.bays[0], p = pumpPos(b); return [p[0] + (b.x < p[0] ? -1.35 : 1.35), p[1]]; }
    if (s === 'charger') { const b = this.bay?.kind === 'charger' ? this.bay : this.bays.find((x) => x.kind === 'charger')!, p = chargerPos(b); return [p[0] - 0.2, p[1] - 1.4]; }
    const c = this.capPos(), sd = this.side(), k = this.pumpSide();
    return [c[0] + sd[0] * 0.55 * k, c[1] + sd[1] * 0.55 * k];
  }
  private near(): Spot | null {
    if (this.phase !== 'walk' || this.wcT > 0) return null;
    const d = (s: Spot) => { const p = this.spotPos(s); return Math.hypot(p[0] - this.px, p[1] - this.pz); };
    const order: Spot[] = this.holding ? (this.added > 0 && !this.plugged ? ['pump', 'charger', 'car'] : ['car', 'pump', 'charger']) : ['pump', 'charger', 'shop', 'food', 'wc', 'car'];
    let best: Spot | null = null, bestD = 1e9;
    for (const s of order) {
      if (s === 'food' && this.info.kind !== 'rest') continue;
      if (s === 'pump' && (this.info.electric || this.bay?.kind !== 'pump')) continue;
      if (s === 'charger' && (!this.info.electric || this.bay?.kind !== 'charger')) continue;
      const dd = d(s); if (dd < (s === 'car' ? 1.6 : 1.8)) { if (this.holding) return s; if (dd < bestD) { bestD = dd; best = s; } }
    }
    if (best) return best;
    if (!this.holding && Math.hypot(this.px - this.cx, this.pz - this.cz) < this.carLen / 2 + 1.7) return 'car';
    return null;
  }
  private say(t: string) { this.msg = t; this.msgT = 2.8; }
  private carHit(x: number, z: number, m: number) {
    const dx = x - this.cx, dz = z - this.cz, c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    return Math.abs(dx * c - dz * s) < this.carHalfW + m && Math.abs(dx * s + dz * c) < this.carLen / 2 + m;
  }
  private walkable(x: number, z: number) {
    if (x < LOT.x0 - 2 || x > LOT.x1 + 2 || z < LOT.z0 - 2 || z > BUILDING.z0 - 0.2) return false;
    for (const b of ISLANDS) if (x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3) return false;
    return !this.carHit(x, z, 0.2);
  }
  private carFree(x: number, z: number) {
    const r = this.carHalfW;
    if (z + r > BUILDING.z0 - 0.6 && x > BUILDING.x0 - 1 && x < BUILDING.x1 + 1) return false;
    for (const b of ISLANDS) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false;
    return this.phase === 'leave' || (x > LOT.x0 - 10 && x < LOT.x1 + 10 && z > LOT.z0 - 5 && z < LOT.z1);
  }
  /** Tìm đường đi bộ trên lưới 0,5 m (né xe và đảo bơm). */
  private route(goal: [number, number]): [number, number][] {
    const S = 0.5, X0 = LOT.x0 - 2, Z0 = LOT.z0 - 2, W = Math.ceil((LOT.x1 + 2 - X0) / S), H = Math.ceil((BUILDING.z0 - Z0) / S);
    const ix = (x: number) => Math.max(0, Math.min(W - 1, Math.round((x - X0) / S))), iz = (z: number) => Math.max(0, Math.min(H - 1, Math.round((z - Z0) / S)));
    const ok = new Uint8Array(W * H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) ok[j * W + i] = this.walkable(X0 + i * S, Z0 + j * S) ? 1 : 0;
    const start = iz(this.pz) * W + ix(this.px); let end = iz(goal[1]) * W + ix(goal[0]);
    ok[start] = 1;
    if (!ok[end]) { let best = -1, bd = 1e9; for (let k = 0; k < ok.length; k++) if (ok[k]) { const d = ((k % W) * S + X0 - goal[0]) ** 2 + (Math.floor(k / W) * S + Z0 - goal[1]) ** 2; if (d < bd) { bd = d; best = k; } } if (best < 0) return [goal]; end = best; }
    const prev = new Int32Array(W * H).fill(-1); prev[start] = start; const q = [start];
    for (let h = 0; h < q.length && prev[end] < 0; h++) { const k = q[h], i = k % W, j = (k - i) / W; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const ni = i + a, nj = j + b; if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue; const nk = nj * W + ni; if (prev[nk] >= 0 || !ok[nk]) continue; prev[nk] = k; q.push(nk); } }
    if (prev[end] < 0) return [goal];
    const pts: [number, number][] = []; for (let k = end; k !== start; k = prev[k]) pts.push([(k % W) * S + X0, Math.floor(k / W) * S + Z0]);
    pts.reverse(); const out = pts.filter((_, i) => i % 3 === 2 || i === pts.length - 1); if (this.walkable(goal[0], goal[1])) out.push(goal); return out;
  }
  private hudNow(): StopHud {
    return { phase: this.phase, bay: this.bay?.kind ?? null, pump: this.bay?.pump ?? null, near: this.near(), holding: this.holding, plugged: this.plugged, pumping: this.pumping,
      added: Math.round(this.added * 10) / 10, cost: Math.round(this.cost), paid: this.paid, energy: Math.round(this.energy * 10) / 10, tank: this.info.tank, unit: this.info.unit, electric: this.info.electric,
      wc: this.wc, inWc: this.wcT > 0, snapHint: this.phase === 'drive' && !this.path.length && !!this.nearBay(4.5), autoMoving: this.path.length > 0 || this.walkPath.length > 0, msg: this.msgT > 0 ? this.msg : null };
  }
  private nearBay(r: number): Bay | null { let best: Bay | null = null, bd = r; for (const b of this.bays) { if (b.taken || (b.kind === 'pump' && this.info.electric)) continue; const d = Math.hypot(b.x - this.cx, b.z - this.cz); if (d < bd) { bd = d; best = b; } } return best; }

  // ---------------------------------------------------------------- vòng lặp
  private onKey = (e: KeyboardEvent) => { if (e.type === 'keydown') this.keys.add(e.code); else this.keys.delete(e.code); };
  private frame = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.frame);
    if (!this.quality.tick(now)) { if (!this.quality.throttled) this.last = now; return; }
    const fast = (window as unknown as { __rideStep?: number }).__rideStep ? 5 : 1;
    const real = stepDt((now - (this.last || now)) / 1000); this.last = now;
    for (let k = 0; k < fast && this.phase !== 'done'; k++) this.step(real);
    // máy quay theo người hoặc xe, mượt theo thời gian
    const walk = this.phase === 'walk', tx = walk ? this.px : this.cx, tz = walk ? this.pz : this.cz, a = ease(0.1, real);
    this.camX += (tx - this.camX) * a; this.camZ += (tz - this.camZ) * a;
    const portrait = this.camera.aspect < 0.9, h = walk ? (portrait ? 17 : 12) : portrait ? 30 : 21, back = walk ? (portrait ? 12 : 10) : portrait ? 20 : 15;
    this.camera.position.set(this.camX, h, this.camZ + back); this.camera.lookAt(this.camX, 0, this.camZ - 1);
    this.quality.busy = Math.abs(this.v) > 0.1 || walk;
    if (this.roof) {
      const under = (x: number, z: number) => x > -25 && x < 3 && z > -22 && z < 2;
      const want = under(tx, tz) || under(this.camX, this.camZ - 4) ? 0.15 : 1; this.roofA += (want - this.roofA) * ease(0.15, real);
      for (const m of this.roofMats) { m.opacity = this.roofA; m.depthWrite = this.roofA > 0.9; }
      if (this.roofSign) this.roofSign.visible = this.roofA > 0.6;
    }
    this.renderer.render(this.scene, this.camera);
    this.hudT -= real; if (this.hudT <= 0) { this.hudT = 0.1; this.cb.onHud(this.hudNow()); }
  };
  private step(dt: number) {
    if (this.auto) this.autoplay(dt);
    let jx = this.joy.x, jy = this.joy.y;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) jx -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) jx += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) jy -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) jy += 1;
    if (this.phase === 'drive' || this.phase === 'leave') this.driveStep(dt, jx, jy);
    if (this.phase === 'walk') this.walkStep(dt, jx, jy);
    if (this.wcT > 0) { this.wcT -= dt; if (this.wcT <= 0) { this.wc = true; this.person.root.visible = true; this.say('🚻 Đi vệ sinh, rửa mặt xong — tỉnh táo hơn'); } }
    // bơm xăng (giữ nút) / sạc (tự chạy khi đã cắm)
    if (this.plugged && this.pumping && this.energy < this.info.tank) {
      const rate = this.info.electric ? Math.max(4, this.info.tank / 8) : 8, add = Math.min(this.info.tank - this.energy, rate * dt);
      this.energy += add; this.added += add; this.cost = Math.round(this.added * this.info.price);
      if (this.energy >= this.info.tank - 0.01) { this.pumping = false; this.say(this.info.electric ? '🔋 Pin đã đầy — rút súng sạc' : '⛽ Bình đã đầy — vòi tự ngắt'); }
      if (!this.info.electric && this.hosePump) { const hp = this.hosePump, s = this.screens.find((p) => Math.abs(p.x - hp[0]) < 0.6 && Math.abs(p.z - hp[1]) < 0.6); if (s) this.drawScreen(s, this.added, this.cost); }
    }
    this.updateHose();
    if (this.msgT > 0) this.msgT -= dt;
    if (this.phase === 'leave' && !this.path.length && this.revZ === null) this.done();
  }
  private driveStep(dt: number, jx: number, jy: number) {
    let want: number | null = null, speed = 0;
    if (this.revZ !== null) { // lùi thẳng ra khỏi ô đỗ
      speed = -3; if (this.cz <= this.revZ + 0.3) { this.revZ = null; speed = 0; }
    } else if (this.path.length) {
      const [x, z] = this.path[0], dx = x - this.cx, dz = z - this.cz, d = Math.hypot(dx, dz), last = this.path.length === 1 && !!this.target;
      want = Math.atan2(-dx, -dz); speed = last ? Math.min(4.5, 0.8 + d) : 7;
      if (d < (last ? 0.3 : 1.8)) { this.path.shift(); if (last && this.target) { this.park(this.target); return; } }
    } else if (Math.hypot(jx, jy) > 0.15) {
      want = Math.atan2(-jx, -jy); speed = 6 * Math.min(1, Math.hypot(jx, jy));
      if (Math.abs(wrap(want - this.yaw)) > 2.4) { speed = -2.5; want = null; } // kéo ngược hướng xe: lùi
    } else if (this.phase === 'drive') {
      // thả tay gần một ô trống: xe tự căn vào ô
      const b = this.nearBay(3.5);
      if (b && Math.abs(this.v) < 3.5) { const f = this.fwd(b.yaw); this.target = b; this.path = [[b.x - f[0] * 2.5, b.z - f[1] * 2.5], [b.x, b.z]]; if (Math.hypot(b.x - this.cx, b.z - this.cz) < 2.6) this.path.shift(); }
    }
    if (want !== null && speed > 0) { const diff = wrap(want - this.yaw), turn = Math.min(Math.abs(diff), dt * (0.6 + Math.abs(this.v) * 0.35)); this.yaw += Math.sign(diff) * turn; }
    if (this.target && this.path.length === 1 && Math.hypot(this.path[0][0] - this.cx, this.path[0][1] - this.cz) < 3) this.yaw += wrap(this.target.yaw - this.yaw) * Math.min(1, dt * 5);
    this.v += (speed - this.v) * Math.min(1, dt * 3);
    const f = this.fwd(this.yaw), nx = this.cx + f[0] * this.v * dt, nz = this.cz + f[1] * this.v * dt;
    if (this.carFree(nx, nz)) { this.cx = nx; this.cz = nz; this.stuckT = 0; }
    else {
      this.v = 0;
      if (this.path.length || this.revZ !== null) { this.stuckT += dt; if (this.stuckT > 1.2) { this.stuckT = 0; if (this.revZ !== null) this.revZ = null; else { const [x, z] = this.path[0]; this.cx = x; this.cz = z; } } }
    }
    this.car.position.set(this.cx, 0, this.cz); this.car.rotation.y = this.yaw;
  }
  private park(b: Bay) {
    this.cx = b.x; this.cz = b.z; this.yaw = b.yaw; this.v = 0; this.bay = b; b.taken = true; this.target = null; this.path = []; this.phase = 'parked';
    this.car.position.set(this.cx, 0, this.cz); this.car.rotation.y = this.yaw;
    this.say(b.kind === 'pump' ? `🅿️ Đã dừng ở trụ bơm số ${b.pump}` : b.kind === 'charger' ? '🅿️ Đã dừng ở ô sạc' : '🅿️ Đã đỗ ngay ngắn trong ô');
  }
  private walkStep(dt: number, jx: number, jy: number) {
    let mx = jx, mz = jy;
    if (Math.hypot(jx, jy) < 0.15 && this.walkPath.length) { const [gx, gz] = this.walkPath[0], dx = gx - this.px, dz = gz - this.pz, d = Math.hypot(dx, dz); if (d < 0.25) this.walkPath.shift(); else { mx = dx / d; mz = dz / d; } }
    const m = Math.min(1, Math.hypot(mx, mz)), b = this.person;
    if (m > 0.1 && this.wcT <= 0) {
      const sp = 3.6 * m, l = Math.hypot(mx, mz), sx = (mx / l) * sp * dt, sz = (mz / l) * sp * dt;
      if (this.walkable(this.px + sx, this.pz + sz)) { this.px += sx; this.pz += sz; } else if (this.walkable(this.px + sx, this.pz)) this.px += sx; else if (this.walkable(this.px, this.pz + sz)) this.pz += sz; else if (this.walkPath.length) { this.px += sx; this.pz += sz; }
      this.pyaw = Math.atan2(mx, mz); this.walkT += dt * 9 * m;
    }
    b.root.position.set(this.px, 0, this.pz); b.root.rotation.y = this.pyaw;
    const sw = m > 0.1 ? Math.sin(this.walkT) * 0.6 : 0; b.legL.rotation.x = sw; b.legR.rotation.x = -sw; b.armL.rotation.x = -sw * 0.8; b.armR.rotation.x = this.holding && !this.plugged ? -1.2 : sw * 0.8;
  }
  private updateHose() {
    const on = !!this.hosePump && (this.holding !== null || this.plugged);
    this.hose.visible = on; this.nozzle.visible = on;
    if (!on || !this.hosePump) return;
    const a = [this.hosePump[0], this.info.electric ? 1.3 : 1.15, this.hosePump[1]];
    let e: number[];
    if (this.plugged) { const c = this.capPos(); e = [c[0], 1.0, c[1]]; }
    else { const s = 1.35, y = this.pyaw; e = [this.px + Math.sin(y) * 0.32 * s - Math.cos(y) * 0.28 * s, 0.85 * s, this.pz + Math.cos(y) * 0.32 * s + Math.sin(y) * 0.28 * s]; }
    const n = this.hoseSegs.length + 1, len = Math.hypot(e[0] - a[0], e[2] - a[2]), pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) { const t = i / (n - 1); pts.push(new THREE.Vector3(a[0] + (e[0] - a[0]) * t, a[1] + (e[1] - a[1]) * t - Math.sin(t * Math.PI) * Math.min(0.9, 0.2 + len * 0.15), a[2] + (e[2] - a[2]) * t)); }
    const up = new THREE.Vector3(0, 1, 0), d = new THREE.Vector3();
    this.hoseSegs.forEach((m, i) => { d.subVectors(pts[i + 1], pts[i]); const l = d.length(); m.position.copy(pts[i]).addScaledVector(d, 0.5); m.scale.set(0.06, l + 0.02, 0.06); if (l > 1e-4) m.quaternion.setFromUnitVectors(up, d.multiplyScalar(1 / l)); }); this.nozzle.position.set(e[0], e[1], e[2]); this.nozzle.rotation.y = this.plugged ? this.yaw + Math.PI / 2 : this.pyaw;
  }
  /** Tự chạy hết một lượt (cho bộ kiểm): đỗ, xuống xe, (đổ xăng/sạc), vệ sinh, lên xe, đi. */
  private autoplay(dt: number) {
    this.autoT -= dt; if (this.autoT > 0) return;
    const fk: BayKind = this.info.electric ? 'charger' : 'pump', spot: Spot = fk;
    const needFuel = this.info.kind !== 'rest' || this.energy < this.info.tank * 0.7 || this.added > 0;
    const goto = (s: Spot) => { if (this.near() === s) return true; if (!this.walkPath.length) this.walkTo(s); return false; };
    const steps: (() => boolean)[] = [
      () => { if (this.phase === 'parked') return true; if (!this.path.length && !this.target && this.phase === 'drive') this.parkAt(needFuel ? fk : 'lot'); return false; },
      () => this.getOut(),
      () => !needFuel || goto(spot), () => !needFuel || this.act(spot),
      () => !needFuel || goto('car'), () => !needFuel || this.act('car'),
      () => { if (!needFuel) return true; this.pumping = true; return this.energy >= this.info.tank - 0.05; },
      () => !needFuel || this.act('car'),
      () => !needFuel || goto(spot), () => !needFuel || this.act(spot),
      () => this.info.kind !== 'rest' || goto('wc'), () => this.info.kind !== 'rest' || this.act('wc'), () => this.wcT <= 0,
      () => goto('car'), () => this.leave(),
    ];
    if (this.autoStep < steps.length) { if (steps[this.autoStep]()) { this.autoStep++; this.autoT = 0.3; } else this.autoT = 0.15; }
  }
  private resize = () => { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.quality.resize(w, h); this.camera.aspect = w / h; this.camera.fov = w < h ? 58 : 46; this.camera.updateProjectionMatrix(); };
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.quality.dispose();
    window.removeEventListener('resize', this.resize); window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
    delete (window as unknown as { __stop?: unknown }).__stop;
    const shared = new Set<unknown>(Object.values(GEO));
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !shared.has(m.geometry)) m.geometry.dispose(); const sp = o as THREE.Sprite; if (sp.isSprite) { sp.material.map?.dispose(); sp.material.dispose(); } });
    for (const o of this.own) o.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}

// Hoạt cảnh khi lên một trò ở khu vui chơi. Trò được dựng bằng CHÍNH mô hình trong khu (ParkKit: đu quay, tàu lượn, tháp rơi,
// cáp treo, máng trượt, nhà ma, xe đụng, hồ sóng, sông lười), đặt giữa một quảng trường có các trò khác, quầy quà, người chơi,
// núi hoặc biển theo địa điểm. Người chơi ngồi trong đúng cabin/toa/phao đang chạy của mô hình; máy ảnh có bốn góc:
//   trong   — ngồi trong cabin, kéo để nhìn quanh (có giới hạn, thả tay tự về hướng nhìn của ghế)
//   theo    — ngoài cabin, bám theo sau lưng
//   toan    — toàn cảnh từ xa, quay chậm quanh trò; kéo để xoay quanh
//   dien_anh — chuỗi góc máy điện ảnh đổi mỗi vài giây
// Mọi chuyển động tính theo dt trong vòng vẽ (requestAnimationFrame); tiến độ báo ra ngoài qua callback mỗi khung.
import * as THREE from 'three';
import type { ParkEnv } from './parkSet.ts';
import type { RideKind } from '../../../shared/parks.ts';
import { IS_MOBILE, rendererParams } from '../perf.ts';
import { gradient } from '../drive/RideKit.ts';
import { bake } from '../scene/World.ts';
import { Kit, V, ball, box, cone, cyl, forestMountain, glow, grp, label, lampPost, mountain, palm, person, tree } from '../sight/SightKit.ts';
import type { PlayerState } from '../sight/SightKit.ts';
import { balloonCart, bumperArena, cableCar, coaster, dropTower, ferrisWheel, flowerBed, hauntedHouse, kiosk, lazyRiver, slideTower, wavePool } from './ParkKit.ts';
import { CamBlend, LookDrag } from '../cameraFeel.ts';

export type ViewMode = 'trong' | 'theo' | 'toan' | 'dien_anh';
export const VIEW_NAMES: Record<ViewMode, string> = { trong: 'Trong cabin', theo: 'Bám theo', toan: 'Toàn cảnh', dien_anh: 'Điện ảnh' };
/** Tên góc "trong" theo từng trò (ghế, toa, phao…). */
export const INSIDE_NAME: Record<RideKind, string> = { du_quay: 'Trong cabin', cap_treo: 'Trong cabin', tau_luon: 'Ghế đầu toa', thap_roi: 'Trên ghế', mang_truot: 'Góc người trượt', nha_ma: 'Trên xe goòng', xe_dung: 'Sau tay lái', ho_song: 'Trên phao', song_luoi: 'Trên phao' };
export const DEFAULT_VIEW: Record<RideKind, ViewMode> = { du_quay: 'trong', cap_treo: 'trong', tau_luon: 'trong', thap_roi: 'trong', mang_truot: 'theo', nha_ma: 'trong', xe_dung: 'theo', ho_song: 'trong', song_luoi: 'theo' };

export interface RideCutOpts { kind: RideKind; env: ParkEnv; main: number; accent: number; /** Tua nhanh (chế độ tự chạy của bộ kiểm): cả lượt gói trong ~6 giây. */ fast?: boolean; view?: ViewMode; onProgress?: (p: number, phase: number) => void }
/** Tư thế người chơi trên trò ở một thời điểm: vị trí đầu, hướng mặt ghế (có thể dốc). */
interface Pose { head: THREE.Vector3; fwd: THREE.Vector3 }
interface Rig {
  /** Các giai đoạn của một lượt (tên hiện trên màn hình, số giây). */
  phases: Timeline;
  /** Gọi trước khi mô hình cập nhật mỗi khung (đặt góc đu quay, vị trí đoàn tàu, độ cao ghế). */
  pre?: (t: number) => void;
  pose: (t: number, dt: number) => Pose;
  /** Tâm và bán kính để máy ảnh toàn cảnh quay quanh. */
  center: () => THREE.Vector3; radius: number; height: number;
  /** Máy ảnh bám theo: lùi sau lưng bao xa, cao bao nhiêu. */
  chase: [number, number];
  /** Máy ảnh bám theo đặt phía trước mặt người chơi nhìn ngược lại (khi phía sau lưng bị trò che: tâm đu quay, thân tháp). */
  chaseFront?: boolean;
  /** Bán kính toàn cảnh đổi theo thời điểm (nhà ma: ngoài sân rộng, trong hành lang hẹp). */
  radiusAt?: () => number;
  /** Toa/xe của chính người chơi trong mô hình (InstancedMesh có `count` bản, bản thứ `index`): ẩn khi ngồi trong để không che mắt. */
  own?: { count: number; index: number };
  /** Cúi/ngẩng thêm khi nhìn từ ghế (rad, âm là cúi). */
  pitch?: (t: number) => number;
  /** Khung cửa kính cabin trước mặt khi ngồi trong (chỉ lúc đã vào cabin). */
  frame?: (t: number) => boolean;
  /** Rung máy ảnh khi ngồi trong. */
  shake?: (t: number) => number;
  /** Cảnh phụ (bên trong nhà ma): trả về cảnh cần vẽ ở thời điểm t, null = cảnh chính. */
  alt?: (t: number) => THREE.Scene | null;
  /** Giờ riêng của mô hình trò (để trọn một lượt trong thời lượng hoạt cảnh) và hệ số dt cho trò chạy theo dt. */
  time?: (t: number) => number; dtScale?: number;
}


const easeIO = (k: number) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };
const easeOut = (k: number) => { const x = Math.min(1, Math.max(0, k)); return 1 - (1 - x) * (1 - x); };
/** Đi bộ từ a tới b (đầu người cao ~1,6 m), mặt hướng `fwd`. */
function walk(a: THREE.Vector3, b: THREE.Vector3, k: number, fwd: THREE.Vector3): Pose { const p = a.clone().lerp(b, easeIO(k)); p.y += Math.abs(Math.sin(k * 14)) * 0.04; return { head: p, fwd: fwd.clone().normalize() }; }
/** Quay mặt từ hướng a sang hướng b (quanh trục đứng). */
function turn(a: THREE.Vector3, b: THREE.Vector3, k: number): THREE.Vector3 { const ya = Math.atan2(a.x, a.z), yb = Math.atan2(b.x, b.z); let d = yb - ya; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(Math.abs(d) - Math.PI) < 1e-3) d = Math.PI; const y = ya + d * easeIO(k); return V(Math.sin(y), 0, Math.cos(y)); }
export interface Timeline { total: number; names: string[]; at(t: number): { i: number; k: number }; start(i: number): number; end(i: number): number }
function timeline(ph: [string, number][]): Timeline {
  const ends: number[] = []; let s = 0; for (const [, d] of ph) { s += d; ends.push(s); }
  return {
    total: s, names: ph.map(([n]) => n),
    at(t) { for (let i = 0; i < ph.length; i++) if (t < ends[i]) return { i, k: (t - (ends[i] - ph[i][1])) / ph[i][1] }; return { i: ph.length - 1, k: 1 }; },
    start: (i) => ends[i] - ph[i][1], end: (i) => ends[i],
  };
}
/** Mô phỏng một vòng tàu lượn: xích kéo lên đỉnh đầu ở 3,2 m/s, sau đó trôi theo bảo toàn năng lượng (có ma sát), phanh về ga.
 *  Trả về thời lượng từng đoạn và hàm u(t) (vị trí 0..1 theo đường ray, cộng dồn qua vòng) đo từ lúc rời ga. */
function simulateCoaster(curve: THREE.CatmullRomCurve3) {
  const L = curve.getLength(), u0 = 0.02, N = 400; let uTop = u0, yTop = -1;
  for (let i = 0; i <= N; i++) { const u = u0 + (i / N) * 0.45, y = curve.getPointAt(u % 1).y; if (y > yTop) { yTop = y; uTop = u; } else if (y < yTop - 2) break; }
  const ts: number[] = [0], us: number[] = [u0]; let u = u0, t = 0, lift = 0, run = 0; const dt = 1 / 60;
  while (u < u0 + 1 && t < 300) {
    const y = curve.getPointAt(u % 1).y; let v: number;
    if (u < uTop) v = 3.2; else v = Math.max(3, Math.sqrt(Math.max(0, 2 ** 2 + 2 * 9.8 * (yTop - y) * 0.82)));
    const left = u0 + 1 - u; if (left < 0.07) v = Math.min(v, 1.2 + (left / 0.07) * 10);
    u = Math.min(u0 + 1, u + (v * dt) / L); t += dt; ts.push(t); us.push(u);
    if (!lift && u >= uTop) lift = t; if (!run && left < 0.07) run = t;
  }
  const uAt = (x: number) => { if (x <= 0) return u0; if (x >= t) return u0 + 1; let lo = 0, hi = ts.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ts[m] < x) lo = m; else hi = m; } const k = (x - ts[lo]) / (ts[hi] - ts[lo] || 1); return us[lo] + (us[hi] - us[lo]) * k; };
  return { u0, lift, run: run - lift, brake: t - run, uAt, length: L };
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();

export class RideCutScene {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 2200);
  private raf = 0; private t0 = 0; private last = 0; private dead = false;
  private bgTicks: ((t: number, dt: number) => void)[] = []; private rideTicks: ((t: number, dt: number) => void)[] = [];
  private rig!: Rig; private drag: LookDrag; private blend = new CamBlend(); private view: ViewMode; private shot = -1;
  private camSmooth = new THREE.Vector3(); private hasSmooth = false; private marker: THREE.Sprite; private frameGrp: THREE.Group;
  private time = 0;
  /** 0..1 tiến độ. */
  progress = 0;
  constructor(private host: HTMLElement, private o: RideCutOpts, private onEnd: () => void) {
    this.renderer = new THREE.WebGLRenderer(rendererParams(host)); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(IS_MOBILE ? 2 : 1.5, devicePixelRatio || 1));
    host.appendChild(this.renderer.domElement); this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    this.view = o.view ?? DEFAULT_VIEW[o.kind];
    this.drag = new LookDrag(this.renderer.domElement, this.view !== 'toan');
    let s = 1234567; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    this.sky();
    // cảnh nền (trò khác, quảng trường, núi/biển) chạy theo giờ thật; trò mình đi chạy theo giờ của hoạt cảnh
    const bg = new Kit(91); this.surroundings(bg, r); this.mount(bg, this.bgTicks);
    const rk = new Kit(17); this.rig = this.buildRide(rk, r);
    { const rig = this.rig, k = rig.dtScale ?? 1; this.scene.add(bake(rk.stat), rk.dyn); this.rideDyn = rk.dyn; for (const f of rk.ticks) this.rideTicks.unshift((t, dt) => f(rig.time ? rig.time(t) : t, dt * k, null as unknown as PlayerState)); }
    this.marker = label('Bạn', 0, 0, 0, '#d2301e', 0.7); this.scene.add(this.marker);
    // khung cửa kính cabin: bậu dưới, mép mái, hai cột — gắn theo máy ảnh
    this.frameGrp = grp(0, 0, 0, 0, box(o.accent, 0, 0, -1.4, 6, 0.03, 0.03), box(o.main, 0, 0, -1.4, 6, 0.04, 0.03), box(o.accent, 0, 0, -1.4, 0.022, 6, 0.03), box(o.accent, 0, 0, -1.4, 0.022, 6, 0.03));
    this.scene.add(this.camera); this.camera.add(this.frameGrp);
    this.resize(); addEventListener('resize', this.resize);
    (window as unknown as { __rideCut?: unknown }).__rideCut = { setView: (v: ViewMode) => this.setView(v), seek: (t: number) => { this.t0 = performance.now() - t * 1000; this.hasSmooth = false; }, phases: () => this.rig.phases.names.map((n, i) => ({ n, a: this.rig.phases.start(i), b: this.rig.phases.end(i) })), info: () => ({ calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles, view: this.view, t: this.time, total: this.rig.phases.total, phase: this.rig.phases.names[this.rig.phases.at(this.time).i] }) };
    this.t0 = this.last = performance.now(); this.raf = requestAnimationFrame(this.frame);
  }
  get currentView(): ViewMode { return this.view; }
  /** Tên các giai đoạn của lượt chơi và tổng số giây (để giao diện hiện câu thoại theo đúng lộ trình). */
  get phaseNames(): string[] { return this.rig.phases.names; }
  get duration(): number { return this.rig.phases.total; }
  setView(v: ViewMode) { if (v === this.view) return; this.blend.start(this.camera, 0.55); this.view = v; this.shot = -1; this.hasSmooth = false; this.drag.limited = v !== 'toan'; this.drag.reset(); }

  private mount(kit: Kit, ticks: ((t: number, dt: number) => void)[]) {
    this.scene.add(bake(kit.stat), kit.dyn);
    for (const f of kit.ticks) ticks.push((t, dt) => f(t, dt, null as unknown as PlayerState));
  }
  private sky() {
    const { env } = this.o, sc = this.scene;
    sc.background = gradient(env === 'vinh' ? 0x6fa8d8 : 0x2f94ee, env === 'vinh' ? 0xe6f0f4 : 0xdff3fb);
    sc.fog = new THREE.Fog(env === 'vinh' ? 0xdfe8ec : 0xd6eef8, 220, 1500);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.5));
    const sun = new THREE.DirectionalLight(0xfff6dc, 1.9); sun.position.set(0.4, 1, 0.3); sc.add(sun);
  }
  private resize = () => {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  };

  // ------------------------------------------------------------------ cảnh xung quanh: quảng trường, trò khác, núi/biển
  private surroundings(kit: Kit, r: () => number) {
    const { env, main, accent, kind } = this.o;
    kit.ground(env === 'dao' ? 0x9ccf7a : 0x86c26a, 2400);
    if (env === 'nui') {
      for (let i = 0; i < 10; i++) { const a = -Math.PI * 0.95 + i * 0.3; kit.add(forestMountain(0x3f7a4e, Math.cos(a) * 520, Math.sin(a) * 460 - 160, 150 + r() * 70, 130 + r() * 130, r)); }
      kit.add(mountain(0x4d8c58, 260, -520, 230, 150, r), mountain(0x3f7a4e, -420, -380, 240, 210, r));
    } else {
      // biển phía đông (đảo) hoặc phía tây (vịnh), bờ cát, đảo đá vôi trên vịnh
      const sx = env === 'dao' ? 1 : -1;
      kit.add(box(0xf4e6c0, sx * 150, -0.45, 0, 40, 1, 1600)); kit.water(0x1f8fd0, sx * 620, 0, 900, 2200, -0.3, 0.92);
      if (env === 'vinh') for (let i = 0; i < 30; i++) { const x = -260 - r() * 700, z = -800 + r() * 1500, h = 40 + r() * 100; kit.add(cone(0x5f7a5a, x, h / 2 - 2, z, 16 + r() * 20, h), cone(0x4d6a4a, x + 6, h * 0.35, z + 5, 10 + r() * 9, h * 0.7)); }
      else for (let i = 0; i < 7; i++) kit.add(mountain(0x4d8c58, 420 + r() * 500, -700 + i * 230, 130 + r() * 90, 70 + r() * 90, r));
      kit.add(mountain(0x3f7a4e, -sx * 480, -560, 280, 210, r));
    }
    // quảng trường lát gạch quanh trò chính, lối dạo toả ra bốn hướng
    kit.add(cyl(0xd98a5a, 0, 0.02, 0, 44, 0.06), cyl(0xe8c9a0, 0, 0.05, 0, 41, 0.04));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + 0.4; kit.add(box(0xd98a5a, Math.sin(a) * 80, 0.03, Math.cos(a) * 80, 6.4, 0.06, 80, a), box(0xe8c9a0, Math.sin(a) * 80, 0.06, Math.cos(a) * 80, 4.8, 0.04, 80, a)); }
    // vòng đèn, cây, quầy, xe bóng bay, bồn hoa ở mép quảng trường
    const KIOSKS = ['Kem · nước mía', 'Bắp rang', 'Bánh mì', 'Nước dừa', 'Trà sữa'];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, x = Math.sin(a) * 46, z = Math.cos(a) * 46;
      kit.add(lampPost(x, 0, z, 4.2, 0xfff3c4));
      const t2 = env === 'nui' ? tree(r, 0.9) : palm(r, 6.5); t2.position.set(Math.sin(a + 0.07) * 50, 0, Math.cos(a + 0.07) * 50); kit.add(t2);
      if (i % 6 === 1) kiosk(kit, Math.sin(a + 0.13) * 53, Math.cos(a + 0.13) * 53, a + Math.PI, [0xe2573c, 0x2ec4b6, 0xffd23f][i % 3], KIOSKS[(i / 6) | 0]);
      else if (i % 6 === 3) balloonCart(kit, Math.sin(a) * 42, Math.cos(a) * 42);
      else if (i % 6 === 5) flowerBed(kit, Math.sin(a) * 40, Math.cos(a) * 40, 3, 2);
    }
    // khách đi chơi đứng, đi rải rác quanh quảng trường
    for (let i = 0; i < 46; i++) { const a = r() * Math.PI * 2, d = 30 + r() * 30, p = person(i, i % 4 === 0 ? 1 : 0, [0xff8a3d, 0x4aa3d8, 0xffd23f, 0xe85aa0, 0x7ccf4f][i % 5]); p.position.set(Math.sin(a) * d, 0, Math.cos(a) * d); p.rotation.y = r() * 6.28; kit.add(p); }
    // các trò khác của khu trên một vòng xa, chừa trò đang đi
    const others: [RideKind, (x: number, z: number, face: number) => void][] = [
      ['du_quay', (x, z, f) => { ferrisWheel(kit, x, z, f, 15, main, accent); }],
      ['tau_luon', (x, z, f) => { coaster(kit, x, z, f, 46, 26, 22, accent, main); }],
      ['thap_roi', (x, z) => dropTower(kit, x, z, 44, main, accent, env === 'dao')],
      ['mang_truot', (x, z, f) => { slideTower(kit, x, z, f, [0xff8a3d, 0x2ec4b6, 0xffd23f, 0xe04a7a], 2); }],
      ['xe_dung', (x, z, f) => bumperArena(kit, x, z, f, main, accent, 'Xe đụng')],
    ];
    const ring = others.filter(([k]) => k !== kind).slice(0, 4);
    ring.forEach(([, make], i) => { const a = 0.9 + i * 1.35, d = 92 + (i % 2) * 18; make(Math.sin(a) * d, Math.cos(a) * d, a + Math.PI); });
    for (let i = 0; i < 60; i++) { const a = r() * Math.PI * 2, d = 120 + r() * 160, t2 = env === 'nui' ? tree(r, 1 + r() * 0.6) : palm(r, 6 + r() * 3); t2.position.set(Math.sin(a) * d, 0, Math.cos(a) * d); kit.add(t2); }
  }

  // ------------------------------------------------------------------ trò chính: trọn một lượt thật, từ lúc vào ga tới lúc bước ra
  // Mỗi trò là một chuỗi giai đoạn (tên, số giây). Thời lượng theo độ dài thật của trò, nén tỉ lệ nhưng không cắt bớt đoạn nào.
  private buildRide(kit: Kit, r: () => number): Rig {
    const { kind, main, accent, env } = this.o;
    const add = (f: (t: number, dt: number) => void) => this.rideTicks.push(f);
    switch (kind) {
      case 'du_quay': {
        // vòng quay đứng cho khách lên ở cabin dưới cùng, quay trọn một vòng (360°) rồi dừng đúng cabin đó cho khách xuống
        const R = 16, hubY = R + 3, n = 16, seat = 12, fw = ferrisWheel(kit, 0, 0, 0, R, main, accent);
        const T = timeline([['Xếp hàng ở nhà ga', 4], ['Bước vào cabin, đóng cửa', 3], ['Lên cao dần…', 16], [env === 'nui' ? 'Lên tới đỉnh: nhìn trọn cả khu!' : 'Lên tới đỉnh: thấy cả biển!', 10], ['Từ từ xuống', 16], ['Cabin về ga, dừng hẳn', 3], ['Mở cửa, bước ra', 4]]);
        const rot = (t: number) => { const a = T.start(2), b = T.end(4); return t <= a ? 0 : t >= b ? Math.PI * 2 : Math.PI * 2 * easeIO((t - a) / (b - a)); };
        const cab = (t: number) => { const a = (seat / n) * Math.PI * 2 + rot(t); return V(Math.cos(a) * R, hubY + Math.sin(a) * R - 0.55, 0); };
        // nhà ga lên cabin nằm phía +z, nên khách lên từ phía sau (−z) và nhìn ra phía khoáng đãng (−z)
        const gate = V(0, 2.4, -9);
        return {
          phases: T, pre: (t) => { fw.ctl.rot = rot(t); },
          pose: (t) => {
            const ph = T.at(t), seatP = cab(t);
            if (ph.i === 0) return walk(gate.clone().setZ(-16), gate, ph.k, V(0, 0, 1));
            if (ph.i === 1) return { head: gate.clone().lerp(seatP, easeIO(Math.min(1, ph.k * 1.6))), fwd: turn(V(0, 0, 1), V(0, 0, -1), Math.max(0, ph.k * 1.6 - 0.6)) };
            if (ph.i === 6) return walk(seatP, gate, ph.k, V(0, 0, -1));
            return { head: seatP, fwd: V(0, 0, -1) };
          },
          center: () => V(0, hubY, 0), radius: 62, height: 18, chase: [8, 1.2], chaseFront: true, pitch: () => -0.14, frame: (t) => { const i = T.at(t).i; return i >= 2 && i <= 5; },
        };
      }
      case 'tau_luon': {
        // đoàn tàu đứng ở ga, xích kéo lên dốc đầu, thả trôi theo trọng lực qua mọi dốc, cua, về ga phanh dừng
        const c = coaster(kit, 0, 0, 0, 58, 34, 26, accent, main), lap = simulateCoaster(c.curve);
        const T = timeline([['Vào ga, xếp hàng', 4], ['Ngồi ghế đầu, hạ thanh chắn', 3], ['Lên dốc… tách tách tách', lap.lift], ['Lao dốc, qua từng khúc cua!', lap.run], ['Về ga, phanh', lap.brake], ['Mở thanh chắn', 2], ['Bước ra ga', 3]]);
        const uAt = (t: number) => { const a = T.start(2), b = T.end(4); return t <= a ? lap.u0 : t >= b ? lap.u0 + 1 : lap.uAt(t - a); };
        const st = c.curve.getPointAt(lap.u0), stT = c.curve.getTangentAt(lap.u0), side = V(stT.z, 0, -stT.x).normalize();
        const plat = st.clone().addScaledVector(side, 3.2).setY(3.4), tg = new THREE.Vector3();
        const seatAt = (u: number): Pose => { const w = ((u % 1) + 1) % 1, q = c.curve.getPointAt(w); c.curve.getTangentAt(w, tg); return { head: V(q.x + tg.x * 0.9, q.y + 1.3 + tg.y * 0.9, q.z + tg.z * 0.9), fwd: tg.clone() }; };
        return {
          phases: T, pre: (t) => { c.ctl.u = uAt(t); },
          pose: (t) => {
            const ph = T.at(t), s0 = seatAt(uAt(t));
            if (ph.i === 0) return walk(plat.clone().addScaledVector(stT, -10), plat, ph.k, stT.clone());
            if (ph.i === 1) return { head: plat.clone().lerp(s0.head, easeIO(Math.min(1, ph.k * 1.5))), fwd: s0.fwd };
            if (ph.i === 6) return walk(s0.head, plat.clone().addScaledVector(stT, 8), ph.k, stT.clone());
            return s0;
          },
          center: () => V(0, 11, 0), radius: 64, height: 22, chase: [11, 5], pitch: () => -0.05, own: { count: 4, index: 0 },
          shake: (t) => { const ph = T.at(t).i; if (ph !== 3) return ph === 2 ? 0.012 : 0; const w = ((uAt(t) % 1) + 1) % 1; c.curve.getTangentAt(w, tg); return 0.03 + Math.max(0, -tg.y) * 0.08; },
        };
      }
      case 'thap_roi': {
        // khách ngồi vào vòng ghế ở chân tháp, kéo lên đỉnh, dừng, rơi tự do, hãm từ từ về bệ, mở thanh chắn
        const H = 46, top = H - 3, dr = dropTower(kit, 0, 0, H, main, accent, env === 'dao');
        const fall = Math.sqrt((2 * (top - 16)) / 9.8);
        const T = timeline([['Ngồi vào ghế, hạ thanh chắn', 4], ['Đang kéo lên 50 mét…', 12], ['Dừng… ba… hai…', 3], ['RƠI!!!', fall], ['Hãm phanh, hạ xuống bệ', 3.5], ['Mở thanh chắn, bước ra', 3.5]]);
        const yAt = (t: number) => { const ph = T.at(t); switch (ph.i) { case 0: return 3; case 1: return 3 + (top - 3) * easeIO(ph.k); case 2: return top; case 3: { const tau = ph.k * fall; return top - 4.9 * tau * tau; } case 4: return 3 + 13 * (1 - easeOut(ph.k)); default: return 3; } };
        const rotAt = (t: number) => 0.15 * Math.min(T.end(1) - T.start(1), Math.max(0, t - T.start(1)));
        const seatOf = (t: number): Pose => { const rot = rotAt(t), out = V(Math.cos(rot), 0, -Math.sin(rot)); return { head: V(out.x * 3.1, yAt(t) - 0.2, out.z * 3.1), fwd: out }; };
        return {
          phases: T, pre: (t) => { dr.ctl.y = yAt(t); dr.ctl.rot = rotAt(t); },
          pose: (t) => { const ph = T.at(t), s0 = seatOf(t), out = s0.fwd, ground = V(out.x * 9, 1.6, out.z * 9); if (ph.i === 0) return { head: ground.clone().lerp(s0.head, easeIO(Math.min(1, ph.k * 1.4))), fwd: turn(out.clone().multiplyScalar(-1), out, Math.min(1, ph.k * 2)) }; if (ph.i === 5) return walk(s0.head, ground, ph.k, out); return s0; },
          center: () => V(0, H / 2, 0), radius: 58, height: 14, chase: [7, 0.8], chaseFront: true,
          pitch: (t) => { const i = T.at(t).i; return i === 2 ? -0.55 : i === 3 ? -0.7 : -0.18; },
          shake: (t) => { const ph = T.at(t); return ph.i === 3 ? 0.06 : ph.i === 4 && ph.k < 0.3 ? 0.08 : 0; },
        };
      }
      case 'cap_treo': {
        // từ ga dưới lên ga trên: lên cabin, cabin rời ga, lướt qua rừng, vào ga trên, bước ra sân ga
        const to = env === 'nui' ? V(170, 150, -430) : V(env === 'dao' ? 470 : -470, 60, -240);
        const cc = cableCar(kit, 0, 0, to, main, accent), len = cc.up.getLength();
        for (let i = 0; i < 150; i++) { const f = 0.08 + r() * 0.9, p = cc.curve.getPointAt(f), t2 = env === 'nui' ? tree(r, 1.3 + r() * 0.8) : palm(r, 7); t2.position.set(p.x + (r() - 0.5) * 150, 0, p.z + (r() - 0.5) * 90); kit.add(t2); }
        // sườn núi dưới đường cáp: các đỉnh luôn thấp hơn dây cáp ~35 m, đỉnh cuối đỡ nhà ga trên
        for (const f of [0.55, 0.72, 0.86]) { const p = cc.curve.getPointAt(f); if (p.y > 45) kit.add(mountain(f > 0.8 ? 0x3f7a4e : 0x4d8c58, p.x + 10, p.z, 55 + f * 30, p.y - 36, r)); }
        kit.add(mountain(0x3f7a4e, to.x, to.z, 85, Math.max(10, to.y - 9), r));
        const travel = len / 12; // cabin thật ~6 m/s; nén gấp đôi
        const T = timeline([['Vào nhà ga dưới', 4], ['Bước lên cabin, đóng cửa', 3], ['Cabin rời ga', travel * 0.15], ['Lướt qua rừng, nhìn xuống', travel * 0.7], ['Sắp tới ga trên', travel * 0.15], ['Vào ga trên, mở cửa, bước ra', 5]]);
        const uAt = (t: number) => { const a = T.start(2), b = T.end(4); return t <= a ? 0.002 : t >= b ? 0.998 : 0.002 + 0.996 * easeIO((t - a) / (b - a)); };
        const cab = (u: number): Pose => { const q = cc.up.getPointAt(u), tg = cc.up.getTangentAt(u); return { head: V(q.x, q.y - 2.0, q.z), fwd: V(tg.x, 0, tg.z).normalize() }; };
        const s0 = cab(0.002), gate = s0.head.clone().addScaledVector(s0.fwd, -12).setY(1.7), s1 = cab(0.998), out = s1.head.clone().addScaledVector(s1.fwd, 8).setY(to.y - 7.4);
        return {
          phases: T, time: (t) => uAt(t) / 0.02,
          pose: (t) => { const ph = T.at(t); if (ph.i === 0) return walk(gate.clone().addScaledVector(s0.fwd, -8), gate, ph.k, s0.fwd); if (ph.i === 1) return { head: gate.clone().lerp(s0.head, easeIO(ph.k)), fwd: s0.fwd }; if (ph.i === 5) return walk(s1.head, out, ph.k, s1.fwd); return cab(uAt(t)); },
          center: () => { const q = cc.up.getPointAt(uAt(this.time)); return V(q.x, q.y - 6, q.z); }, radius: 46, height: 10, chase: [9, 2.4],
          pitch: (t) => (T.at(t).i === 3 ? -0.38 : -0.12), frame: (t) => { const i = T.at(t).i; return i >= 2 && i <= 4; },
        };
      }
      case 'mang_truot': {
        // leo cầu thang lên đỉnh tháp, ngồi phao, trượt hết ống xoắn, đổ xuống bể, bơi vào bờ
        const sl = slideTower(kit, 0, 0, 0, [0xff8a3d, 0x2ec4b6, 0xffd23f, 0xe04a7a], 3), H = 16, slideT = sl.lane.getLength() / 7;
        const ring = grp(0, 0, 0, 0, new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.3, 8, 18).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xff8a3d })), ball(0xf2c69c, 0, 0.75, 0, 0.26), cyl(0xffd23f, 0, 0.35, 0, 0.3, 0.5));
        ring.visible = false; kit.live(ring);
        const splash = new THREE.Group(); for (let i = 0; i < 26; i++) splash.add(ball(0xffffff, Math.cos(i) * (0.6 + (i % 4) * 0.5), 0, Math.sin(i * 1.7) * (0.6 + (i % 3) * 0.5), 0.35)); splash.visible = false; kit.live(splash);
        const T = timeline([['Xếp hàng dưới chân tháp', 3], ['Leo cầu thang lên đỉnh tháp', 9], ['Ngồi vào phao…', 2], ['Xoáy xoáy xoáy!', slideT], ['Ùm!', 2], ['Bơi vào bờ', 4]]);
        const stairs = [V(0, 1.6, -12), ...Array.from({ length: 8 }, (_, k) => V(k % 2 ? 4.2 : -4.2, (k + 1) * 2 + 1.6, -3.6)), V(0, H + 1.6, 0)];
        const top = sl.lane.getPointAt(0).add(V(0, 1.7, 0)), pool = sl.pool, shore = V(pool.x + 9, 1.6, pool.z);
        const uAt = (t: number) => { const ph = T.at(t); return ph.i < 3 ? -1 : ph.i === 3 ? Math.min(0.999, ph.k ** 1.15) : 2; };
        add((t) => { const ph = T.at(t), after = ph.i >= 4, k = ph.i === 4 ? ph.k : 1; ring.visible = after; splash.visible = ph.i === 4; if (after) { ring.position.set(pool.x + (ph.i === 5 ? ph.k * 6 : 0), 0.75 + Math.sin(t * 3) * 0.05, pool.z); splash.position.set(pool.x, 0.8 + k * 2, pool.z); splash.scale.setScalar(1 + k * 3); } });
        return {
          phases: T, time: (t) => { const u = uAt(t); return u < 0 || u > 1 ? 1.2 / 0.22 : u / 0.22; },
          pose: (t) => {
            const ph = T.at(t);
            if (ph.i === 0) return walk(V(0, 1.6, -20), stairs[0], ph.k, V(0, 0, 1));
            if (ph.i === 1) { const f = Math.min(stairs.length - 1.001, ph.k * (stairs.length - 1)), a = stairs[Math.floor(f)], b = stairs[Math.floor(f) + 1], d = b.clone().sub(a).setY(0); return { head: a.clone().lerp(b, f % 1), fwd: d.lengthSq() > 1e-4 ? d.normalize() : V(0, 0, 1) }; }
            if (ph.i === 2) return { head: stairs[stairs.length - 1].clone().lerp(top, ph.k), fwd: sl.lane.getTangentAt(0).setY(0).normalize() };
            if (ph.i === 3) { const u = uAt(t), p = sl.lane.getPointAt(Math.min(0.999, u + 0.02)); return { head: V(p.x, p.y + 2.4, p.z), fwd: sl.lane.getTangentAt(u) }; }
            if (ph.i === 4) return { head: V(pool.x, 2.1, pool.z + 1.6), fwd: V(0, 0, -1) };
            return walk(V(pool.x + ph.k * 6, 2.1, pool.z + 1.6), shore, ph.k, V(1, 0, 0));
          },
          center: () => V(0, 8, 10), radius: 42, height: 12, chase: [8.5, 4], pitch: (t) => (T.at(t).i === 3 ? -0.2 : -0.08),
          shake: (t) => (T.at(t).i === 3 ? 0.03 : 0),
        };
      }
      case 'xe_dung': {
        // vào sàn, chọn xe, cài dây; còi chạy, đụng nhau một lượt; còi hết giờ, xe dừng; bước ra
        bumperArena(kit, 0, 0, 0, main, accent, 'Xe điện đụng');
        const T = timeline([['Chọn xe, cài dây', 4], ['Đạp ga!', 8], ['Rầm!', 8], ['Tránh ra nào!', 8], ['Còi hết giờ, xe dừng', 2], ['Bước ra khỏi sàn', 3]]);
        const W = 18, D = 12, run = (t: number) => Math.min(T.start(4), Math.max(T.start(1), t)) - T.start(1) + 3;
        const drive = (t: number) => { const ph = T.at(t); return ph.i === 4 ? run(t) + 0.6 * easeOut(ph.k) : ph.i === 5 ? run(t) + 0.6 : run(t); };
        const at = (s: number) => { const a = s * 0.5, lx = Math.cos(a) * (W / 2 - 2.2) * (0.6 + 0.4 * Math.sin(s * 0.3)), lz = Math.sin(a * 1.3) * (D / 2 - 1.8); return V(lx, 0.3, lz); };
        const rail = V(0, 1.6, D / 2 + 3);
        return {
          phases: T, time: drive,
          pose: (t) => { const ph = T.at(t), s1 = drive(t), p = at(s1), q = at(s1 + 0.08), seat: Pose = { head: V(p.x, p.y + 1.15, p.z), fwd: q.sub(p).setY(0).normalize() }; if (ph.i === 0) return { head: rail.clone().lerp(seat.head, easeIO(ph.k)), fwd: seat.head.clone().sub(rail).setY(0).normalize() }; if (ph.i === 5) return walk(seat.head, rail, ph.k, rail.clone().sub(seat.head).setY(0).normalize()); return seat; },
          center: () => V(0, 1, 0), radius: 24, height: 12, chase: [5, 2.6], pitch: () => -0.12, own: { count: 6, index: 0 },
          shake: (t) => { const ph = T.at(t).i; if (ph < 1 || ph > 3) return 0; const s1 = drive(t), me = at(s1); for (let i = 1; i < 6; i++) { const a = s1 * (0.5 + i * 0.07) + i * 1.3, lx = Math.cos(a) * (W / 2 - 2.2) * (0.6 + 0.4 * Math.sin(s1 * 0.3 + i)), lz = Math.sin(a * 1.3) * (D / 2 - 1.8); if (me.distanceTo(V(lx, 0.3, lz)) < 2.3) return 0.12; } return 0; },
        };
      }
      case 'ho_song': {
        // lấy phao xuống hồ, chờ máy tạo sóng, ba đợt sóng, lên bờ
        const Wp = 34, Dp = 24, speed = 1.4; wavePool(kit, 0, 0, 0, Wp, Dp);
        const ring = grp(0, 0, 0, 0, new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.32, 8, 18).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xff8a3d })), ball(0xf2c69c, 0, 0.75, 0, 0.26), cyl(0x4aa3d8, 0, 0.35, 0, 0.32, 0.5)); kit.live(ring);
        const T = timeline([['Lấy phao, xuống hồ', 4], ['Chờ sóng…', 4], ['Sóng tới rồi!', 8], ['Nhấp nhô nhấp nhô', 8], ['Thêm đợt nữa', 8], ['Lên bờ', 4]]);
        const yAt = (t: number, lz: number) => { let y = 0.45; for (let i = 0; i < 3; i++) { const k = (t * speed * 0.12 + i / 3) % 1, lzc = -Dp / 2 + 1 + k * (Dp - 2); y += Math.sin(k * Math.PI) * 0.55 * Math.exp(-(((lz - lzc) / 1.8) ** 2)); } return y; };
        const beach = V(3, 1.7, Dp / 2 + 3), spot = (t: number) => { const lz = 4 + Math.sin(t * 0.3) * 0.6; return V(3, yAt(t, lz), lz); };
        add((t) => { const ph = T.at(t), p = spot(t); ring.visible = ph.i > 0 && ph.i < 5; ring.position.copy(p); ring.rotation.y = t * 0.2; });
        return {
          phases: T, time: (t) => t * speed, dtScale: speed,
          pose: (t) => { const ph = T.at(t), p = spot(t).add(V(0, 0.95, 0)); if (ph.i === 0) return walk(beach, p, ph.k, V(0, 0, -1)); if (ph.i === 5) return walk(p, beach, ph.k, V(0, 0, 1)); return { head: p, fwd: V(-0.15, 0, -1).normalize() }; },
          center: () => V(0, 1, 0), radius: 32, height: 12, chase: [5, 2], pitch: () => -0.1,
        };
      }
      case 'song_luoi': {
        // lấy phao ở bến, trôi trọn một vòng quanh đảo (qua thác, hang đá), về bến lên bờ
        const R = 14; lazyRiver(kit, 0, 0, R);
        const T = timeline([['Lấy phao, xuống nước', 4], ['Thả trôi thôi', 14], ['Qua màn nước mát lạnh', 14], ['Vòng qua đảo đá', 14], ['Về bến, lên bờ', 4]]);
        const aAt = (t: number) => { const a = T.start(1), b = T.end(3); return t <= a ? 0 : t >= b ? Math.PI * 2 : (Math.PI * 2 * (t - a)) / (b - a); };
        const ringAt = (a: number): Pose => ({ head: V(Math.cos(a) * R, 1.45, Math.sin(a) * R), fwd: V(-Math.sin(a), 0, Math.cos(a)) }), dock = V(R + 4.5, 1.7, 0);
        return {
          phases: T, time: (t) => aAt(t) / 0.08,
          pose: (t) => { const ph = T.at(t), s0 = ringAt(aAt(t)); if (ph.i === 0) return walk(dock, s0.head, ph.k, V(-1, 0, 0)); if (ph.i === 4) return walk(s0.head, dock, ph.k, V(1, 0, 0)); return s0; },
          center: () => V(0, 1, 0), radius: 34, height: 14, chase: [5, 2.2], pitch: () => -0.12,
        };
      }
      case 'nha_ma': {
        // lên xe goòng trước cửa, xe chạy vào, đi hết hành lang tối, ra cửa sau ra ánh sáng
        const variant = env === 'dao' ? 'tau' : env === 'vinh' ? 'hang' : 'lau_dai';
        hauntedHouse(kit, 0, 0, 0, 0x4a3a5a, 0x2a1f3a, variant);
        kit.add(box(0x6a5a4a, -0.6, 0.06, 18, 0.12, 0.12, 26), box(0x6a5a4a, 0.6, 0.06, 18, 0.12, 0.12, 26));
        for (let z = 6; z < 31; z += 1.4) kit.add(box(0x4a3a2a, 0, 0.03, z, 1.8, 0.06, 0.25));
        const cart = grp(0, 0, 0, 0, box(0x3a2a1c, 0, 0.45, 0, 1.6, 0.7, 2.2), box(accent, 0, 0.85, 0.9, 1.6, 0.3, 0.3), person(5, 0, 0xffd23f).translateY(0.3).translateZ(-0.2)); kit.live(cart);
        const inside = this.hauntedInterior(variant), L = 110;
        const T = timeline([['Lên xe goòng', 4], ['Xe chạy vào cửa…', 6], ['Tối quá…', 12], ['Có gì đó vừa bay qua!', 12], ['Thấy ánh sáng rồi', 10], ['Ra cửa sau, bước xuống', 4]]);
        const cartZ = (t: number) => { const ph = T.at(t); return ph.i === 0 ? 30 : ph.i === 1 ? 30 - 24 * easeIO(ph.k) : 6; };
        const inZ = (t: number) => { const a = T.start(2), b = T.end(4); return -1 - Math.min(1, Math.max(0, (t - a) / (b - a))) * (L - 8); };
        add((t) => { cart.position.set(0, 0, cartZ(t)); cart.rotation.y = Math.PI; });
        const out = V(8, 1.7, -4), outdoor = (t: number) => { const i = T.at(t).i; return i < 2 || i === 5; };
        return {
          phases: T,
          pose: (t) => {
            const ph = T.at(t);
            if (ph.i === 0) return walk(V(3, 1.7, 33), V(0, 1.75, 29.8), ph.k, V(-0.5, 0, -1));
            if (ph.i === 1) return { head: V(0, 1.75, cartZ(t) - 0.2), fwd: V(0, 0, -1) };
            if (ph.i === 5) return walk(V(6, 1.7, 0), out, ph.k, V(1, 0, -0.3));
            const z = inZ(t); inside.cart.position.set(0, 0, z + 0.2); return { head: V(Math.sin(t * 0.8) * 0.15, 1.7, z), fwd: V(Math.sin(t * 0.6) * 0.15, -0.02, -1).normalize() };
          },
          center: () => (outdoor(this.time) ? V(0, 6, 2) : V(0, 1.6, inside.cart.position.z)), radius: 34, radiusAt: () => (outdoor(this.time) ? 34 : 3.4), height: 9, chase: [4.5, 1.6], pitch: () => 0,
          alt: (t) => { if (outdoor(t)) return null; inside.update(t); return inside.scene; },
        };
      }
    }
  }

  /** Bên trong nhà ma: hành lang tối, đèn chập chờn, ma bay ra hai bên, một chiếc xe goòng chở người chơi. */
  private hauntedInterior(variant: 'lau_dai' | 'tau' | 'hang') {
    const sc = new THREE.Scene(), L = 120;
    sc.background = new THREE.Color(0x06060a); sc.fog = new THREE.Fog(0x06060a, 4, 32);
    sc.add(new THREE.AmbientLight(0x6a6a90, 1.4));
    const lamp = new THREE.PointLight(0xffb070, 60, 18, 1.2); sc.add(lamp);
    const wall = variant === 'hang' ? 0x4a4640 : variant === 'tau' ? 0x3a2a1c : 0x1a1420, floor = variant === 'tau' ? 0x5a3d22 : 0x2a2230;
    const hall = new THREE.Group();
    hall.add(box(floor, 0, -0.1, -L / 2, 6, 0.2, L), box(wall, -3, 2, -L / 2, 0.2, 4.4, L), box(wall, 3, 2, -L / 2, 0.2, 4.4, L), box(0x120e16, 0, 4.2, -L / 2, 6, 0.2, L));
    hall.add(box(0x6a5a4a, -0.6, 0.02, -L / 2, 0.1, 0.1, L), box(0x6a5a4a, 0.6, 0.02, -L / 2, 0.1, 0.1, L));
    for (let z = -6; z > -L; z -= 9) {
      if (variant === 'hang') hall.add(cone(0xd9e6ee, -1.6, 3.6, z, 0.3, 1.4).rotateX(Math.PI), cone(0xd9e6ee, 1.4, 3.8, z - 3, 0.25, 1).rotateX(Math.PI), ball(0x5f5a53, -2.6, 0.6, z - 5, 0.9, 0.7, 0.9));
      else hall.add(box(0x3a2a1c, -2.85, 2, z, 0.1, 3, 1.6), cyl(0x3a2e26, -2, 0.5, z - 2, 0.3, 1));
      hall.add(box(glow(variant === 'hang' ? 0x7fe0ff : 0xffd27a), 2.85, 2.6, z - 4, 0.1, 0.5, 0.3));
    }
    sc.add(bake(hall));
    const ghosts: THREE.Group[] = [];
    for (let i = 0; i < 7; i++) { const g = grp(i % 2 ? 1.6 : -1.6, 1.6, -14 - i * 15, 0, ball(glow(0xd8f0ff), 0, 0, 0, 0.6, 0.9, 0.5), ball(0x101018, -0.2, 0.25, 0.42, 0.1), ball(0x101018, 0.2, 0.25, 0.42, 0.1), cone(glow(0xd8f0ff), 0, -1, 0, 0.6, 1.2)); g.rotation.x = Math.PI; g.scale.y = -1; ghosts.push(g); sc.add(g); }
    const skel = person(1, 0, 0xe8e8e8); skel.position.set(2.2, 0, -60); skel.rotation.y = -1.2; sc.add(skel);
    const cart = grp(0, 0, 0, 0, box(0x3a2a1c, 0, 0.45, 0, 1.6, 0.7, 2.2), box(0xd2301e, 0, 0.85, -0.9, 1.6, 0.3, 0.3), person(5, 0, 0xffd23f).translateY(0.3)); sc.add(cart);
    const mk = label('Bạn', 0, 0, 0, '#d2301e', 0.7); sc.add(mk);
    return {
      scene: sc, cart,
      update: (t: number) => {
        const z = cart.position.z; lamp.position.set(0, 3, z - 2); lamp.intensity = 55 + Math.sin(t * 23) * 10 + (Math.sin(t * 3.1) > 0.9 ? -45 : 0);
        mk.position.set(0, 2.9, z); mk.visible = this.view !== 'trong';
        for (const g of ghosts) { const d = g.position.z - z; g.visible = d < 2 && d > -12; g.position.x = Math.sign(g.position.x) * (2.4 - Math.max(0, 8 + d) * 0.25); g.position.y = 1.6 + Math.sin(t * 4 + g.position.z) * 0.3; }
      },
    };
  }

  // ------------------------------------------------------------------ máy ảnh theo góc đang chọn
  private placeCamera(pose: Pose, t: number, dt: number) {
    const cam = this.camera, rig = this.rig, portrait = cam.aspect < 1;
    const baseYaw = Math.atan2(pose.fwd.x, pose.fwd.z), basePitch = Math.asin(THREE.MathUtils.clamp(pose.fwd.y, -1, 1));
    const fov = (f: number) => { if (Math.abs(cam.fov - f) > 0.05) { cam.fov += (f - cam.fov) * (1 - Math.exp(-dt * 6)); cam.updateProjectionMatrix(); } };
    const look = (p: THREE.Vector3, yaw: number, pitch: number) => { cam.position.copy(p); tmpA.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).add(p); cam.up.copy(UP); cam.lookAt(tmpA); };
    const smoothTo = (p: THREE.Vector3, rate: number) => { if (!this.hasSmooth) { this.camSmooth.copy(p); this.hasSmooth = true; } else this.camSmooth.lerp(p, 1 - Math.exp(-dt * rate)); return this.camSmooth; };
    this.frameGrp.visible = false; this.marker.visible = this.view !== 'trong';
    this.marker.position.copy(pose.head).y += 1.3;
    switch (this.view as ViewMode | 'toan_ngoai' | 'dien_anh_ngoai') {
      case 'trong': {
        fov(portrait ? 76 : 62);
        look(pose.head, baseYaw + this.drag.yaw, THREE.MathUtils.clamp(basePitch * 0.85 + (rig.pitch?.(t) ?? 0) + this.drag.pitch, -1.2, 1.0));
        const k = rig.shake?.(t) ?? 0; if (k) { cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; }
        this.frameGrp.visible = !!rig.frame?.(t);
        if (this.frameGrp.visible) { // khung kính bám sát mép màn hình: bậu dưới mảnh, mép mái trên, hai cột ở hai rìa (dọc hay ngang đều thấy đủ)
          const hh = 1.4 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), hw = hh * cam.aspect, [sill, roof, l, rr] = this.frameGrp.children;
          sill.position.y = -hh * 0.93; roof.position.y = hh * 0.97; l.position.x = -hw * 0.97; rr.position.x = hw * 0.97;
        }
        break;
      }
      case 'theo': {
        fov(portrait ? 70 : 58);
        const [dist, h] = rig.chase, yaw = baseYaw + this.drag.yaw + (rig.chaseFront ? Math.PI : 0), pitch = 0.18 + this.drag.pitch * 0.6;
        tmpB.set(pose.head.x - Math.sin(yaw) * dist * Math.cos(pitch), pose.head.y + h + Math.sin(pitch) * dist, pose.head.z - Math.cos(yaw) * dist * Math.cos(pitch));
        tmpB.y = Math.max(0.8, tmpB.y);
        cam.position.copy(smoothTo(tmpB, 9)); cam.up.copy(UP); tmpA.copy(pose.head).addScaledVector(pose.fwd, rig.chaseFront ? 0 : 2); cam.lookAt(tmpA);
        break;
      }
      case 'toan': if (rig.alt?.(t)) { // trong hành lang hẹp: máy đặt cao phía sau xe goòng, không ra ngoài tường
        fov(portrait ? 70 : 58); tmpB.set(Math.sin(t * 0.2 + this.drag.yaw) * 1.8, 3.7, pose.head.z + 6.5); cam.position.copy(smoothTo(tmpB, 6)); cam.up.copy(UP); cam.lookAt(0, 1.2, pose.head.z - 2); break;
      } // falls through
      case 'toan_ngoai': {
        fov(portrait ? 62 : 50);
        const c = rig.center(), ang = 0.7 + t * 0.05 + this.drag.yaw, el = THREE.MathUtils.clamp(0.28 + this.drag.pitch * 0.8, 0.05, 1.2), R = (rig.radiusAt?.() ?? rig.radius) * (portrait ? 1.15 : 1);
        tmpB.set(c.x + Math.sin(ang) * R * Math.cos(el), Math.max(2, c.y + rig.height * 0.2 + R * Math.sin(el)), c.z + Math.cos(ang) * R * Math.cos(el));
        cam.position.copy(smoothTo(tmpB, 5)); cam.up.copy(UP); cam.lookAt(c.x * 0.6 + pose.head.x * 0.4, c.y * 0.6 + pose.head.y * 0.4, c.z * 0.6 + pose.head.z * 0.4);
        break;
      }
      case 'dien_anh': if (rig.alt?.(t)) {
        fov(portrait ? 66 : 54); const n = Math.floor(t / 3.6) % 3, z = pose.head.z;
        if (n !== this.shot) { if (this.shot >= 0) this.blend.start(cam, 0.7); this.shot = n; this.hasSmooth = false; }
        if (n === 0) tmpB.set(0, 1.6, z - 5); else if (n === 1) tmpB.set(2.3, 0.9, z + 1.5); else tmpB.set(-1.6, 3.8, z + 3);
        cam.position.copy(smoothTo(tmpB, 5)); cam.up.copy(UP); cam.lookAt(0, 1.2, z); break;
      } // falls through
      case 'dien_anh_ngoai': {
        fov(portrait ? 66 : 52);
        const n = Math.floor(t / 3.6) % 4;
        if (n !== this.shot) { if (this.shot >= 0) this.blend.start(cam, 0.9); this.shot = n; this.hasSmooth = false; }
        const side = V(pose.fwd.z, 0, -pose.fwd.x).normalize(), c = rig.center();
        if (n === 0) tmpB.copy(pose.head).addScaledVector(side, 7).addScaledVector(pose.fwd, 5).setY(Math.max(0.6, pose.head.y - 2.5));      // góc thấp phía trước, hếch lên
        else if (n === 1) tmpB.copy(pose.head).addScaledVector(side, -14).setY(pose.head.y + 2);                                              // máy chạy song song
        else if (n === 2) tmpB.set(c.x + rig.radius * 0.45, c.y + rig.height + rig.radius * 0.35, c.z + rig.radius * 0.45);               // cần cẩu cao
        else tmpB.copy(pose.head).addScaledVector(pose.fwd, 9).addScaledVector(side, 2).setY(pose.head.y + 0.8);                              // đón đầu
        cam.position.copy(smoothTo(tmpB, 4)); cam.up.copy(UP); cam.lookAt(pose.head);
        break;
      }
    }
    this.blend.apply(cam, dt);
  }

  private rideDyn: THREE.Object3D | null = null;
  /** Ngồi trong: thu nhỏ về 0 bản sao toa/xe của chính mình trong mô hình (đã đặt lại mỗi khung bởi mô hình). */
  private hideOwn() {
    const own = this.rig.own; if (!own || this.view !== 'trong' || !this.rideDyn) return;
    const z = new THREE.Matrix4().makeScale(0, 0, 0);
    this.rideDyn.traverse((o) => { const im = o as THREE.InstancedMesh; if (im.isInstancedMesh && im.count === own.count) { im.setMatrixAt(own.index, z); im.instanceMatrix.needsUpdate = true; } });
  }
  private frame = (now: number) => {
    if (this.dead) return; this.raf = requestAnimationFrame(this.frame);
    const T = this.rig.phases, sp = this.o.fast ? T.total / 6 : 1;
    const real = Math.max(0, (now - this.t0) / 1000), dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000)); this.last = now;
    const t = Math.min(T.total, real * sp); this.time = t;
    this.progress = t / T.total; this.o.onProgress?.(this.progress, T.at(t).i);
    for (const f of this.bgTicks) f(real, dt);
    this.rig.pre?.(t);
    for (const f of this.rideTicks) f(t, dt * sp);
    this.hideOwn();
    const pose = this.rig.pose(t, dt);
    this.drag.update(dt);
    this.placeCamera(pose, t, dt);
    const alt = this.rig.alt?.(t) ?? null;
    if (alt) { if (this.camera.parent !== alt) alt.add(this.camera); } else if (this.camera.parent !== this.scene) this.scene.add(this.camera);
    this.renderer.render(alt ?? this.scene, this.camera);
    if (t >= T.total) { this.dispose(); this.onEnd(); }
  };
  dispose() {
    if (this.dead) return; this.dead = true; cancelAnimationFrame(this.raf); removeEventListener('resize', this.resize); this.drag.dispose();
    // không giải phóng từng hình khối: nhiều khối dùng chung hình gốc với cảnh khác; mất ngữ cảnh WebGL là đủ trả bộ nhớ GPU
    (this.scene.background as THREE.Texture | null)?.dispose?.(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}

// Sân sát hạch xe máy hạng A1/A: 4 bài liên hoàn — hình số 8, vạch đường thẳng, đường có vạch cản, đường gồ ghề.
// Xe tự bám đường mẫu (có trợ lái như sân ô tô); người thi giữ ga, phanh cho đúng tốc độ từng bài, ◀ ▶ chỉnh nhẹ.
// Chạy quá nhanh ở cua thì xe văng ra chạm vạch; quá chậm thì loạng choạng phải chống chân; lệch quá xa khỏi hình là truất quyền.
import * as THREE from 'three';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { bakeColored } from '../scene/batch.ts';
import { Quality, rendererParams, stepDt } from '../perf.ts';
import { makeSign } from './RideKit.ts';
import { buildMoto } from './MotoParts.ts';
import type { MotoModel, MotoStyle } from './MotoParts.ts';
import { MOTO_TESTS, MOTO_YARD, motoStraightLen } from '../../../shared/moto.ts';
import type { MotoTest } from '../../../shared/moto.ts';

interface Pt { x: number; z: number; hx: number; hz: number; k: number; test: MotoTest | null; half: number }
export interface YardPenalty { test: MotoTest | null; points: number; text: string }
export interface YardHud { kmh: number; test: MotoTest | null; testName: string; hint: string; score: number; seconds: number; progress: number; out: string | null; done: boolean; speedOk: 'cham' | 'vua' | 'nhanh'; lat: number; half: number }
export interface MotoYardOpts { cls: 'A1' | 'A'; style: MotoStyle; color: number; shirt: number; guide: boolean; onTick?: (h: YardHud) => void; onPenalty?: (p: YardPenalty) => void; onDone?: (r: { score: number; out: string | null; seconds: number; log: YardPenalty[] }) => void }

/** Tốc độ (km/h) hợp lý từng bài. */
const SPEED: Record<MotoTest, { min: number; max: number }> = { so_8: { min: 3, max: 12 }, duong_thang: { min: 5, max: 16 }, vach_can: { min: 3, max: 11 }, go_ghe: { min: 3, max: 10 } };
const STEP = 0.25;

export class MotoYard {
  private renderer: THREE.WebGLRenderer; private quality: Quality;
  private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);
  private ro: ResizeObserver;
  private pts: Pt[] = []; private L = 1;
  private s = 0; private v = 0; private lat = 0; private steer = 0; private gas = 0; private brake = 0;
  private bike: MotoModel; private t = 0; private done = false; private disposed = false;
  private log: YardPenalty[] = []; private out: string | null = null; private lastTouch = -9; private lastFoot = -9; private lowT = 0;
  private wobble = 0; private acc = 0; private camP = new THREE.Vector3(); private camL = new THREE.Vector3(); private camInit = false;
  private bumps: number[] = []; private wheelSpin = 0; private lastT = 0;
  auto = false;

  constructor(private host: HTMLElement, private opts: MotoYardOpts) {
    this.renderer = new THREE.WebGLRenderer(rendererParams(host));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement); this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.quality = new Quality(this.renderer, { name: 'Sân sát hạch xe máy' });
    this.scene.background = new THREE.Color(0xa9dcf3); this.scene.fog = new THREE.Fog(0xc9e9f6, 70, 200);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6f8f3e, 1.5));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.6); sun.position.set(-20, 40, 10); this.scene.add(sun);
    this.buildPath(); this.buildYard();
    this.bike = buildMoto({ style: opts.style, color: opts.color, shirt: opts.shirt, helmet: 0xf4c430 }, true);
    this.scene.add(this.bike.root);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
    (window as unknown as { __motoYard?: MotoYard }).__motoYard = this;
  }
  setGas(v: number) { this.gas = Math.max(0, Math.min(1, v)); }
  setBrake(v: number) { this.brake = Math.max(0, Math.min(1, v)); }
  setSteer(v: number) { this.steer = Math.max(-1, Math.min(1, v)); }
  get drawCalls() { return this.renderer.info.render.calls; }

  // ---------------------------------------------------------------- đường mẫu
  private buildPath() {
    const push = (x: number, z: number, test: MotoTest | null, half: number) => {
      const prev = this.pts[this.pts.length - 1];
      let hx = 0, hz = -1; if (prev) { const d = Math.hypot(x - prev.x, z - prev.z) || 1; hx = (x - prev.x) / d; hz = (z - prev.z) / d; }
      this.pts.push({ x, z, hx, hz, k: 0, test, half });
    };
    const line = (x0: number, z0: number, x1: number, z1: number, test: MotoTest | null, half: number) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / STEP)); for (let i = 1; i <= n; i++) push(x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n, test, half); };
    // xuất phát
    push(0, 4, null, 1.2); line(0, 4, 0, -8, null, 1.2);
    // bài 1: hình số 8 — hai vòng tròn bán kính 3 m tiếp xúc tại (0, -11)
    line(0, -8, 0, -11, 'so_8', 0.6);
    const R = 3, cz = -11;
    for (const side of [1, -1]) { // vòng phải rồi vòng trái
      const cx = side * R, a0 = side > 0 ? Math.PI : 0;
      const n = Math.round((2 * Math.PI * R) / STEP);
      for (let i = 1; i <= n; i++) { const a = a0 - side * (i / n) * Math.PI * 2; push(cx + Math.cos(a) * R, cz - Math.sin(a) * R, 'so_8', 0.6); }
    }
    line(0, -11, 0, -17, 'so_8', 0.6);
    // bài 2: vạch đường thẳng
    const len = motoStraightLen(this.opts.cls);
    line(0, -17, 0, -20, null, 1.0); line(0, -20, 0, -20 - len, 'duong_thang', 0.3);
    // bài 3: đường có vạch cản (lượn sóng)
    const z3 = -20 - len - 3; line(0, -20 - len, 0, z3, null, 1.0);
    const n3 = Math.round(16 / STEP); for (let i = 1; i <= n3; i++) { const f = i / n3; push(Math.sin(f * Math.PI * 4) * 0.9, z3 - f * 16, 'vach_can', 0.45); }
    // bài 4: đường gồ ghề, 15 m, gờ cách 1,5 m
    const z4 = z3 - 16 - 3; line(0, z3 - 16, 0, z4, null, 1.0); line(0, z4, 0, z4 - 15, 'go_ghe', 0.5);
    for (let k = 1; k < 10; k++) this.bumps.push(z4 - k * 1.5);
    line(0, z4 - 15, 0, z4 - 21, null, 1.2);
    // độ cong
    for (let i = 1; i < this.pts.length - 1; i++) {
      const a = this.pts[i - 1], b = this.pts[i + 1], h0 = Math.atan2(this.pts[i].hx, -this.pts[i].hz), h1 = Math.atan2(b.hx, -b.hz);
      let d = h1 - h0; d = Math.atan2(Math.sin(d), Math.cos(d)); this.pts[i].k = d / Math.max(1e-3, Math.hypot(b.x - a.x, b.z - a.z) / 2);
    }
    this.L = (this.pts.length - 1) * STEP;
  }
  private at(s: number): Pt {
    const f = Math.max(0, Math.min(this.pts.length - 1.001, s / STEP)), i = Math.floor(f), t = f - i, a = this.pts[i], b = this.pts[i + 1];
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, hx: a.hx + (b.hx - a.hx) * t, hz: a.hz + (b.hz - a.hz) * t, k: a.k + (b.k - a.k) * t, test: a.test, half: a.half };
  }

  // ---------------------------------------------------------------- sân
  private buildYard() {
    const g = new THREE.Group(), white = mat(0xf7f7f2), yellow = mat(0xf2c94c), r = rng(9);
    const zEnd = this.pts[this.pts.length - 1].z, zMid = (4 + zEnd) / 2, padL = 4 - zEnd + 16;
    // nền: cỏ cắt sọc, sân bê tông nhựa có viền vỉa đỏ trắng
    for (let i = 0; i < 14; i++) g.add(mesh(GEO.box, mat(i % 2 ? 0x8cbd52 : 0x7fb048), -70 + i * 10 + 5, -0.13, zMid, 10, 0.1, padL + 120));
    g.add(mesh(GEO.box, mat(0x6f767f), 0, -0.05, zMid, 30, 0.1, padL));
    for (let i = 0; i < 26; i++) g.add(mesh(GEO.box, mat(r() < 0.5 ? 0x737a83 : 0x6a7179), (r() - 0.5) * 26, -0.045, zMid + (r() - 0.5) * (padL - 6), 2 + r() * 4, 0.1, 2 + r() * 5));
    for (const sx of [-1, 1]) for (let z = 4 + 7; z > zEnd - 8; z -= 1.2) g.add(mesh(GEO.box, mat(Math.round(z / 1.2) % 2 ? 0xd6453a : 0xf4f1ea), sx * 15.1, 0.06, z, 0.3, 0.22, 1.18));
    // vùng bài thi sơn nền xanh đậm cho nổi vạch
    g.add(mesh(GEO.box, mat(0x5b6b78), 0, -0.04, -11, 14.5, 0.1, 9));
    // vạch xuất phát, vạch kết thúc (sọc caro)
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) g.add(mesh(GEO.box, (i + j) % 2 ? white : mat(0x2b2f38), -1.3 + i * 0.37 + 0.18, 0.013, 2 - j * 0.2, 0.37, 0.02, 0.2));
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) g.add(mesh(GEO.box, (i + j) % 2 ? white : mat(0x2b2f38), -1.3 + i * 0.37 + 0.18, 0.013, zEnd + 2 - j * 0.2, 0.37, 0.02, 0.2));
    // vạch cản xen kẽ hai bên (bài 3)
    for (let i = 0; i < 8; i++) { const z = -20 - motoStraightLen(this.opts.cls) - 3 - 1 - i * 2, x = (i % 2 ? -1 : 1) * 1.0; g.add(mesh(GEO.box, yellow, x, 0.03, z, 0.9, 0.04, 0.12)); }
    // gờ gồ ghề (bài 4): sọc vàng đen
    for (const [k, z] of this.bumps.entries()) g.add(mesh(GEO.box, k % 2 ? yellow : mat(0x2b2f38), 0, 0.03, z, 1.4, 0.06, 0.2));
    // nhà điều hành hai tầng, mái ngói, ban công, biển tên; khán đài có mái che và người ngồi chờ
    const hx = 10.5, hz = -6;
    g.add(mesh(GEO.box, mat(0xf3e5c6), hx, 1.7, hz, 6, 3.4, 4.6), mesh(GEO.box, mat(0xf6ecd6), hx, 4.6, hz, 5.4, 2.4, 4.2));
    g.add(mesh(GEO.box, mat(0xc0563a), hx, 3.5, hz, 6.6, 0.25, 5.2), mesh(GEO.cone, mat(0xb04a32), hx, 6.6, hz, 4.6, 1.8, 3.8));
    for (const y of [1.6, 4.6]) for (const dz of [-1.4, 0, 1.4]) g.add(mesh(GEO.box, mat(0x8fd0ee), hx - 3.02, y, hz + dz, 0.05, 1.1, 1.0));
    g.add(mesh(GEO.box, mat(0x7a5232), hx - 3.04, 1.1, hz + 2.6, 0.06, 2.2, 1.1));
    g.add(mesh(GEO.box, mat(0xf2efe6), hx - 3.4, 3.55, hz, 0.8, 0.12, 4.4)); for (let k = 0; k < 6; k++) g.add(mesh(GEO.box, mat(0xd9d2c0), hx - 3.75, 3.9, hz - 2 + k * 0.8, 0.06, 0.6, 0.06));
    // khán đài
    const sz = -16, sxx = 9.5;
    for (let row = 0; row < 3; row++) g.add(mesh(GEO.box, mat(0xd8d2c2), sxx + row * 0.8, 0.25 + row * 0.35, sz, 0.8, 0.5 + row * 0.7, 8));
    g.add(mesh(GEO.box, mat(0x2f7fd8), sxx + 1, 3.2, sz, 3.4, 0.12, 8.6)); for (const dz of [-4, 4]) g.add(mesh(GEO.cyl, mat(0xdedede), sxx + 2.4, 1.6, sz + dz, 0.08, 3.2, 0.08));
    for (let k = 0; k < 9; k++) { const row = k % 3, z = sz - 3.4 + Math.floor(k / 3) * 2.6 + r() * 0.6, x = sxx + row * 0.8, c = [0x2f7fd8, 0xe8457f, 0x4caf3f, 0xf2c94c, 0xffffff][k % 5];
      g.add(mesh(GEO.box, mat(c), x, 0.95 + row * 0.7, z, 0.34, 0.5, 0.3), mesh(GEO.ball, mat(0xe6b48a), x, 1.36 + row * 0.7, z, 0.15)); }
    // cột cờ
    g.add(mesh(GEO.cyl, mat(0xdcdcdc), 6.5, 4, 1, 0.06, 8, 0.06), mesh(GEO.box, mat(0xda251d), 7.15, 7.4, 1, 1.2, 0.8, 0.03), mesh(GEO.box, mat(0xffd500), 7.15, 7.4, 1.02, 0.28, 0.28, 0.01));
    // bãi xe máy chờ thi
    for (let k = 0; k < 6; k++) { const z = 3 - k * 1.1, c = [0xc0392b, 0x2f2f33, 0x2f7fd8, 0xe8e8e8][k % 4]; g.add(mesh(GEO.box, mat(c), -10, 0.55, z, 0.35, 0.4, 1.4), mesh(GEO.cyl, mat(0x222222), -10, 0.3, z - 0.55, 0.3, 0.1, 0.3).rotateZ(Math.PI / 2), mesh(GEO.cyl, mat(0x222222), -10, 0.3, z + 0.55, 0.3, 0.1, 0.3).rotateZ(Math.PI / 2)); }
    // hàng rào lưới quanh sân, đèn chiếu sáng
    for (const sx of [-1, 1]) for (let z = 10; z > zEnd - 10; z -= 3) g.add(mesh(GEO.cyl, mat(0x9aa3ab), sx * 18, 0.9, z, 0.05, 1.8, 0.05), mesh(GEO.box, mat(0xb9c2c9), sx * 18, 1.2, z - 1.5, 0.02, 1.2, 3));
    for (const [x, z] of [[-16, -4], [16, -26], [-16, -48], [16, -70]] as [number, number][]) g.add(mesh(GEO.cyl, mat(0x8f97a3), x, 4, z, 0.1, 8, 0.1), mesh(GEO.box, mat(0xfff3c4), x - Math.sign(x) * 0.5, 8, z, 1.2, 0.25, 0.6));
    // cây xanh, bụi hoa quanh sân
    for (let i = 0; i < 46; i++) { const x = (r() < 0.5 ? -1 : 1) * (20 + r() * 16), z = 12 - r() * (padL + 10), s2 = 0.8 + r() * 0.7;
      g.add(mesh(GEO.cyl, mat(0x6a4a2a), x, 1.1 * s2, z, 0.16 * s2, 2.2 * s2, 0.16 * s2), mesh(GEO.ball, mat([0x4f8f45, 0x5fa04e, 0x3f7d3a][i % 3]), x, 2.9 * s2, z, 1.5 * s2, 1.3 * s2, 1.5 * s2)); }
    for (let i = 0; i < 18; i++) { const x = (r() < 0.5 ? -1 : 1) * (16.2 + r() * 1.4), z = 8 - r() * (padL - 4); g.add(mesh(GEO.ball, mat([0xe8457f, 0xf2c94c, 0xffffff][i % 3]), x, 0.3, z, 0.45, 0.35, 0.45)); }
    // cọc tiêu dẫn vào bài
    for (const [x, z] of [[-1.6, -8], [1.6, -8], [-1.4, -20], [1.4, -20]]) g.add(mesh(GEO.cone, mat(0xf08a24), x, 0.3, z, 0.22, 0.6, 0.22));
    this.scene.add(bakeColored(g));
    // vạch mép đường bài thi: dải sơn liền (không còn chấm rời), trắng; bài vạch cản sơn vàng
    for (const yel of [false, true]) {
      const pos: number[] = [];
      for (let i = 1; i < this.pts.length; i++) {
        const a0 = this.pts[i - 1], a1 = this.pts[i]; if (!a1.test || !a0.test || (a1.test === 'vach_can') !== yel || a1.test === 'so_8') continue;
        for (const sd of [-1, 1]) {
          const q = (p: Pt, w: number) => { const off = p.half + 0.05 + w; return [p.x - p.hz * off * sd, 0.014, p.z + p.hx * off * sd]; };
          const p0 = q(a0, -0.05), p1 = q(a0, 0.05), p2 = q(a1, -0.05), p3 = q(a1, 0.05);
          pos.push(...p0, ...p2, ...p1, ...p1, ...p2, ...p3);
        }
      }
      if (!pos.length) continue;
      const geo2 = new THREE.BufferGeometry(); geo2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const m2 = new THREE.Mesh(geo2, new THREE.MeshBasicMaterial({ color: yel ? 0xf2c94c : 0xf7f7f2, side: THREE.DoubleSide })); m2.userData.own = true; this.scene.add(m2);
    }
    // vòng tròn hình số 8 (vạch trong, vạch ngoài)
    const ringM = new THREE.MeshBasicMaterial({ color: 0xf7f7f2 });
    for (const cx of [-3, 3]) for (const rr of [2.4, 3.6]) { const ring = new THREE.Mesh(new THREE.RingGeometry(rr - 0.05, rr + 0.05, 64).rotateX(-Math.PI / 2), ringM); ring.position.set(cx, 0.015, -11); ring.userData.own = true; this.scene.add(ring); }
    // vệt dẫn đường khi tập
    if (this.opts.guide) {
      const pts = this.pts.map((p) => new THREE.Vector3(p.x, 0.03, p.z));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0x35d07f, dashSize: 0.5, gapSize: 0.3 })); line.computeLineDistances(); line.userData.own = true; this.scene.add(line);
    }
    // biển tên bài
    const tests: [MotoTest, number][] = [['so_8', -7], ['duong_thang', -19], ['vach_can', -20 - motoStraightLen(this.opts.cls) - 2], ['go_ghe', -20 - motoStraightLen(this.opts.cls) - 3 - 16 - 2]];
    tests.forEach(([t, z], i) => { const sp = makeSign(`Bài ${i + 1}: ${MOTO_TESTS[t].name}`, '#1f6fb8'); sp.scale.set(4.6, 1.15, 1); sp.position.set(-3.4, 2.6, z - 1.5); this.scene.add(sp); });
  }

  private resize() { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.quality.resize(w, h); this.camera.aspect = w / h; this.camera.fov = w < h ? 66 : 52; this.camera.updateProjectionMatrix(); }
  private frame() {
    if (this.disposed || !this.quality.tick()) return;
    const fast = (window as unknown as { __rideStep?: number }).__rideStep ?? 1;
    // bước thời gian theo đồng hồ thật (máy 120 Hz không chạy nhanh gấp đôi, máy chậm không chậm theo)
    const now = performance.now(), real = this.lastT ? (now - this.lastT) / 1000 : 1 / 60; this.lastT = now;
    const dt = Math.min(0.05, stepDt(real)) * fast; this.update(dt); this.renderer.render(this.scene, this.camera);
  }
  private penalty(test: MotoTest | null, points: number, text: string) { const p = { test, points, text }; this.log.push(p); this.opts.onPenalty?.(p); }

  private update(dt: number) {
    if (this.done) return;
    this.t += dt;
    const here = this.at(this.s), test = here.test, spd = test ? SPEED[test] : { min: 0, max: 15 }, kmh = this.v * 3.6;
    // tự lái (kiểm thử): giữ giữa khoảng tốc độ
    if (this.auto) { const want = (spd.min + spd.max) / 2 / 3.6; this.gas = this.v < want - 0.3 ? 1 : 0; this.brake = this.v > want + 0.5 ? 1 : 0; this.steer = -this.lat * 2; }
    this.acc = this.gas * 1.6 - this.brake * 3.5 - 0.25;
    this.v = Math.max(0, Math.min(6, this.v + this.acc * dt));
    this.s = Math.min(this.L, this.s + this.v * dt);
    // lệch ngang: chỉnh bằng ◀ ▶, tự trả về giữa, cua quá nhanh bị văng ra ngoài, đi quá chậm thì lắc
    const over = test ? Math.max(0, kmh - spd.max) : 0;
    const drift = (here.k > 0 ? -1 : 1) * Math.min(1.5, Math.abs(here.k) * over * 0.09);
    this.wobble = test && kmh < spd.min && this.v > 0.05 ? Math.sin(this.t * 7) * 0.25 : 0;
    this.lat += (this.steer * 0.9 + drift + this.wobble - this.lat * (this.steer === 0 ? 1.2 : 0.3)) * dt;
    if (test === 'go_ghe' && kmh > spd.max) this.lat += Math.sin(this.t * 23) * 0.6 * dt;
    // chạm vạch / chống chân / ra ngoài
    if (test) {
      const edge = Math.abs(this.lat) - here.half;
      if (edge > 0.55 && !this.out) { this.out = MOTO_YARD.outOfCourse; this.penalty(test, 0, `${MOTO_YARD.outOfCourse} (${MOTO_TESTS[test].name})`); this.finish(); return; }
      if (edge > 0 && this.t - this.lastTouch > 1.2) { this.lastTouch = this.t; this.penalty(test, MOTO_YARD.touchLine, `Bánh xe chạm vạch ở bài ${MOTO_TESTS[test].name}`); }
      if (kmh < spd.min && this.s > 1) this.lowT += dt; else this.lowT = 0;
      if (this.lowT > 1.6 && this.t - this.lastFoot > 2.5) { this.lastFoot = this.t; this.lowT = 0; this.penalty(test, MOTO_YARD.footDown, 'Đi quá chậm, mất thăng bằng phải chống chân'); }
      if (test === 'go_ghe' && kmh > spd.max + 3 && this.t - this.lastFoot > 2.5) { this.lastFoot = this.t; this.penalty(test, MOTO_YARD.footDown, 'Qua gờ quá nhanh, xe nảy mất thăng bằng'); }
    }
    if (this.t > MOTO_YARD.timeLimitSec && !this.out) { this.out = 'Quá thời gian thi'; this.finish(); return; }
    // đặt xe
    const p = this.at(this.s), x = p.x - p.hz * this.lat, z = p.z + p.hx * this.lat;
    let y = 0; if (test === 'go_ghe') for (const bz of this.bumps) if (Math.abs(z - bz) < 0.35) y = Math.max(y, 0.06 * (1 - Math.abs(z - bz) / 0.35));
    this.bike.root.position.set(x, y, z); this.bike.root.rotation.set(0, Math.atan2(-p.hx, -p.hz), 0);
    this.bike.lean.rotation.z = Math.max(-0.5, Math.min(0.5, -Math.atan((this.v * this.v * p.k) / 9.8))) + this.wobble * 0.3;
    this.wheelSpin -= (this.v * dt) / 0.3; for (const w of this.bike.wheels) w.rotation.x = this.wheelSpin;
    // máy quay chéo trên cao sau lưng để thấy vạch
    const cp = new THREE.Vector3(x + p.hx * -5.2, 3.1, z + p.hz * -5.2), cl = new THREE.Vector3(x + p.hx * 6, 0.7, z + p.hz * 6);
    if (!this.camInit) { this.camP.copy(cp); this.camL.copy(cl); this.camInit = true; }
    const k = 1 - Math.pow(0.002, dt); this.camP.lerp(cp, k); this.camL.lerp(cl, k); this.camera.position.copy(this.camP); this.camera.lookAt(this.camL);
    if (this.s >= this.L - 0.05) { this.finish(); return; }
    this.opts.onTick?.(this.hud());
  }
  private score() { return Math.max(0, 100 - this.log.reduce((a, b) => a + b.points, 0)); }
  hud(): YardHud {
    const p = this.at(this.s), test = p.test, kmh = this.v * 3.6, spd = test ? SPEED[test] : null;
    return { kmh: Math.round(kmh), test, testName: test ? MOTO_TESTS[test].name : this.s < 2 ? 'Xuất phát' : 'Đi tới bài kế tiếp',
      hint: test ? `${MOTO_TESTS[test].how} Giữ ${spd!.min}–${spd!.max} km/h.` : 'Đi thẳng tới bài kế tiếp.',
      score: this.score(), seconds: Math.round(this.t), progress: this.s / this.L, out: this.out, done: this.done,
      speedOk: !spd ? 'vua' : kmh < spd.min ? 'cham' : kmh > spd.max ? 'nhanh' : 'vua', lat: this.lat, half: p.half };
  }
  private finish() { if (this.done) return; this.done = true; this.v = 0; this.opts.onTick?.(this.hud()); this.opts.onDone?.({ score: this.out ? 0 : this.score(), out: this.out, seconds: Math.round(this.t), log: this.log }); }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.renderer.setAnimationLoop(null); this.ro.disconnect(); this.quality.dispose();
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.own) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}

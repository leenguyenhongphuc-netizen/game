// Cảnh 3D của sân sát hạch: vẽ hình sân từ ExamCourse, xe sát hạch, đèn tín hiệu, biển số bài; chạy mô phỏng theo thời gian thật.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Quality, IS_MOBILE, rendererParams, stepDt, ease } from '../perf.ts';
import { bakeColored } from '../scene/batch.ts';
import { ExamSim, heightAt, pieceAt, idleInput } from './ExamCourse.ts';
import type { ExamClass, Input, ItemId, Prim, SimEvent } from './ExamCourse.ts';

export type ExamView = 'tren' | 'bac' | 'sau';
export interface YardHud { item: ItemId; score: number; t: number; kmh: number; light: 'do' | 'vang' | 'xanh'; lightNear: boolean; hint: string | null; danger: boolean; done: boolean; gear: string; steer: number }
export interface YardCallbacks { onEvent(e: SimEvent): void; onHud(h: YardHud): void }

const std = (color: number, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
const M = { asphalt: std(0x4a4f57), line: std(0xf4f4ee, 0.8), yellow: std(0xf2c230, 0.8), grass: std(0x79b356), kerb: std(0xc9c4b6), red: std(0xd8402c), dark: std(0x2a2d33), pole: std(0x8b9099, 0.6), body: std(0xf4f6f8, 0.5), glass: std(0x9fd3ee, 0.3), tyre: std(0x1d1f23), wood: std(0x7a5a34), leaf: std(0x3f8f45), wall: std(0xf1e6c8), roof: std(0xc65a3c), skin: std(0xf1c9a0), blue: std(0x1f6fd0, 0.7), rail: std(0x6e7178, 0.5) };

/** Hình phẳng của một mảng sân trong mặt XY (nới ra `grow` mét), sau đó xoay nằm xuống mặt đất. */
function flat(p: Prim, grow: number): THREE.BufferGeometry {
  if (p.t === 'rect') { const g = new THREE.PlaneGeometry((p.hl + grow) * 2, (p.hw + grow) * 2); g.rotateZ(p.ang); g.translate(p.cx, p.cy, 0); return g; }
  const pad = grow / Math.max(1, p.r0), g = new THREE.RingGeometry(Math.max(0.01, p.r0 - grow), p.r1 + grow, Math.max(8, Math.ceil((p.a1 - p.a0) * 14)), 1, p.a0 - pad, p.a1 - p.a0 + 2 * pad); g.translate(p.cx, p.cy, 0); return g;
}
function layer(prims: Prim[], grow: number, y: number, mat: THREE.Material): THREE.Mesh { const g = mergeGeometries(prims.map((p) => flat(p, grow)), false)!; g.rotateX(-Math.PI / 2); g.translate(0, y, 0); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; }
/** Vạch sơn: hình chữ nhật tâm (x, y) trên sân, dài l theo hướng h, rộng w. */
function stripe(x: number, y: number, h: number, l: number, w: number, mat: THREE.Material, up = 0.035): THREE.Mesh { const g = new THREE.PlaneGeometry(l, w); g.rotateZ(h); g.translate(x, y, 0); g.rotateX(-Math.PI / 2); g.translate(0, up, 0); return new THREE.Mesh(g, mat); }
function label(text: string, bg: string, fg = '#fff', round = true): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = bg; if (round) { g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.lineWidth = 8; g.strokeStyle = bg === '#f4f4f4' ? '#16181c' : '#fff'; g.stroke(); } else g.fillRect(0, 0, 128, 128);
  g.fillStyle = fg; g.font = `800 ${text.length > 1 ? 62 : 80}px "Baloo 2", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 70);
  if (bg === '#f4f4f4') { g.strokeStyle = '#16181c'; g.lineWidth = 7; g.beginPath(); g.moveTo(24, 104); g.lineTo(104, 24); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class ExamYard {
  sim: ExamSim; input: Input = idleInput(); auto = false; view: ExamView = 'tren';
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(50, 1, 0.5, 900);
  private quality: Quality; private raf = 0; private last = 0; private disposed = false; private time = 0;
  private car = new THREE.Group(); private fw: THREE.Group[] = []; private wheels: THREE.Mesh[] = [];
  private blinkL: THREE.MeshStandardMaterial; private blinkR: THREE.MeshStandardMaterial; private brakeM: THREE.MeshStandardMaterial;
  private lamps: THREE.MeshStandardMaterial[] = []; private hintGroup = new THREE.Group(); private camYaw = 0; private camPos = new THREE.Vector3(); private camAt = new THREE.Vector3(); private camInit = false;
  private hudT = 0; private own: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  private keys = new Set<string>();

  constructor(private host: HTMLElement, cls: ExamClass, private cb: YardCallbacks, opts: { practice?: boolean; from?: ItemId } = {}) {
    this.sim = new ExamSim(cls, { practice: opts.practice, from: opts.from, danger: !opts.practice });
    this.renderer = new THREE.WebGLRenderer(rendererParams(host)); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.blinkL = new THREE.MeshStandardMaterial({ color: 0x664400, emissive: 0xffa200, emissiveIntensity: 0 }); this.blinkR = this.blinkL.clone(); this.brakeM = new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0xff2200, emissiveIntensity: 0 });
    this.quality = new Quality(this.renderer, { name: 'sân thi', onLevel: (l) => { this.renderer.shadowMap.enabled = !IS_MOBILE && l === 0; } });
    host.appendChild(this.renderer.domElement); this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    this.build(); this.showHints(!!opts.practice);
    window.addEventListener('resize', this.resize); window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey); this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  private build() {
    const c = this.sim.c, s = c.spec, u = s.scale, sc = this.scene, b = c.bounds;
    sc.background = new THREE.Color(0xbfe4f5); sc.fog = new THREE.Fog(0xbfe4f5, 140 * u, 420 * u);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8aa27a, 1.15)); const sun = new THREE.DirectionalLight(0xfff2d6, 1.5); sun.position.set(40, 80, 30); sc.add(sun);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(b.x1 - b.x0 + 200, b.y1 - b.y0 + 200), M.grass); ground.rotation.x = -Math.PI / 2; ground.position.set((b.x0 + b.x1) / 2, 0, -(b.y0 + b.y1) / 2); sc.add(ground);
    sc.add(layer(c.road, 0.42, 0.012, M.kerb), layer(c.road, 0.16, 0.02, M.line), layer(c.road, 0, 0.028, M.asphalt));
    const st = new THREE.Group(), deco = new THREE.Group(); const mk = c.marks;
    const cross = (name: string, w: number, mat = M.line, len?: number) => { const m = mk[name]; st.add(stripe(m.x, m.y, m.h + Math.PI / 2, len ?? 3.5 * u, w, mat)); };
    cross('start', 0.25); cross('finish', 0.25); cross('stop2', 0.3); cross('stop5', 0.3); cross('stop8', 0.3);
    for (let i = 0; i < 6; i++) st.add(stripe(c.zebra.x, c.zebra.y - 3.5 * u / 2 + (i + 0.5) * 3.5 * u / 6, 0, c.zebra.w, 3.5 * u / 12, M.line)); // vạch người đi bộ
    { const t = c.track; st.add(stripe((t.x0 + t.x1) / 2, t.yc, 0, t.x1 - t.x0, t.hw * 2, M.yellow), stripe((t.x0 + t.x1) / 2, t.yc + t.hw, 0, t.x1 - t.x0, 0.07, M.line, 0.04), stripe((t.x0 + t.x1) / 2, t.yc - t.hw, 0, t.x1 - t.x0, 0.07, M.line, 0.04)); }
    for (const bay of c.bays) if (bay.rect.t === 'rect') { const r = bay.rect; if (bay.item === 7) st.add(stripe(r.cx, bay.check - (s.len - s.rear) * 0 + 0, 0, r.hl * 2, 0.12, M.yellow)); else st.add(stripe(r.cx, r.cy + r.hw - 0.05, 0, r.hl * 2, 0.1, M.yellow)); }
    // đường ray
    { const r = c.rail, nx = -Math.sin(r.h), ny = Math.cos(r.h); for (const o of [-0.72, 0.72]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 3.5 * u + 6), M.rail); m.position.set(r.x + Math.cos(r.h) * o, 0.08, -(r.y + Math.sin(r.h) * o)); m.rotation.y = r.h; deco.add(m); }
      for (let i = -5; i <= 5; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 0.24), M.wood); m.position.set(r.x + nx * i * (3.5 * u + 5) / 11, 0.04, -(r.y + ny * i * (3.5 * u + 5) / 11)); m.rotation.y = r.h; deco.add(m); } }
    // dốc: nêm lên, mặt phẳng, nêm xuống (mặt trên là mặt đường)
    { const r = c.ramp, hw = 3.5 * u / 2, shape = new THREE.Shape(); shape.moveTo(r.x0, 0); shape.lineTo(r.x1, r.top); shape.lineTo(r.x2, r.top); shape.lineTo(r.x3, 0); shape.closePath();
      const g = new THREE.ExtrudeGeometry(shape, { depth: hw * 2 + 0.5, bevelEnabled: false }); g.translate(0, 0, -hw - 0.25); const m = new THREE.Mesh(g, M.asphalt); deco.add(m);
      const edge = (z: number) => { for (const [xa, ya, xb, yb] of [[r.x0, 0, r.x1, r.top], [r.x1, r.top, r.x2, r.top], [r.x2, r.top, r.x3, 0]]) { const len = Math.hypot(xb - xa, yb - ya), e = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.14), M.line); e.position.set((xa + xb) / 2, (ya + yb) / 2 + 0.02, z); e.rotation.z = Math.atan2(yb - ya, xb - xa); deco.add(e); } };
      edge(-hw + 0.05); edge(hw - 0.05);
      const sx = mk.stop3.x, sy = heightAt(c, sx, 0), sl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, hw * 2), M.line); sl.position.set(sx, sy + 0.025, 0); sl.rotation.z = Math.atan(0.1); deco.add(sl); }
    // cọc ở góc chuồng, biển số bài, đèn tín hiệu, người đi bộ, nhà điều hành, cây
    for (const k of c.cones) { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 8), M.red); cone.position.set(k.x, 0.3, -k.y); deco.add(cone); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.12, 8), M.line); band.position.set(k.x, 0.34, -k.y); deco.add(band); }
    for (const g of c.signs) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), M.pole); pole.position.set(g.x, 1.1, -g.y); deco.add(pole);
      const tex = label(g.text, g.color, g.color === '#f4f4f4' ? '#16181c' : '#fff'); this.own.push(tex);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); sp.scale.setScalar(1.25 * Math.min(1.4, u)); sp.position.set(g.x, 2.5, -g.y); sc.add(sp); this.own.push(sp.material);
    }
    { const l = c.light, pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4, 8), M.pole); pole.position.set(l.x, 2, -l.y); deco.add(pole); const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.5, 0.4), M.dark); box.position.set(l.x, 3.6, -l.y); deco.add(box);
      [0xff3020, 0xffc21a, 0x25d045].forEach((col, i) => { const m = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: col, emissiveIntensity: 0 }); this.lamps.push(m); this.own.push(m); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), m); lamp.position.set(l.x - 0.26, 4.05 - i * 0.45, -l.y); sc.add(lamp); this.own.push(lamp.geometry); }); }
    { const z = c.zebra, ped = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.9, 8), M.blue); body.position.y = 0.95; const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M.skin); head.position.y = 1.6; const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 6), M.dark); legs.position.y = 0.25; ped.add(body, head, legs); ped.position.set(z.x, 0, -(z.y - 3.5 * u / 2 - 1)); deco.add(ped); }
    { const hx = b.x0 + 16, hy = -11, house = new THREE.Mesh(new THREE.BoxGeometry(9, 3.4, 5), M.wall); house.position.set(hx, 1.7, -hy); deco.add(house); const roof = new THREE.Mesh(new THREE.BoxGeometry(10, 0.4, 6), M.roof); roof.position.set(hx, 3.6, -hy); deco.add(roof); }
    { let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }; let n = 0;
      for (let i = 0; i < 400 && n < 46; i++) { const x = b.x0 + rnd() * (b.x1 - b.x0), y = b.y0 + rnd() * (b.y1 - b.y0); if (c.road.some((p) => (p.t === 'rect' ? Math.hypot(x - p.cx, y - p.cy) < Math.hypot(p.hl, p.hw) + 4 : Math.abs(Math.hypot(x - p.cx, y - p.cy) - (p.r0 + p.r1) / 2) < (p.r1 - p.r0) / 2 + 4))) continue; n++;
        const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1.6, 6), M.wood); tr.position.set(x, 0.8, -y); deco.add(tr); const lf = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + rnd() * 0.6, 0), M.leaf); lf.position.set(x, 2.5, -y); deco.add(lf); } }
    sc.add(bakeColored(st), bakeColored(deco)); sc.add(this.hintGroup);
    // xe sát hạch
    const car = this.car, L = s.len, Wd = s.wid, mid = L / 2 - s.rear, truck = s.cls !== 'B';
    const base = new THREE.Mesh(new THREE.BoxGeometry(L, truck ? 0.5 : 0.55, Wd), M.body); base.position.set(mid, truck ? 0.75 : 0.58, 0); car.add(base);
    if (truck) { const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.5, Wd * 0.96), M.body); cab.position.set(mid + L / 2 - 0.9, 1.7, 0); const gl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, Wd * 0.8), M.glass); gl.position.set(mid + L / 2 - 0.03, 1.95, 0); const box = new THREE.Mesh(new THREE.BoxGeometry(L - 2.0, 1.5, Wd), M.blue); box.position.set(mid - 0.95, 1.75, 0); car.add(cab, gl, box); }
    else { const cab = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, 0.52, Wd * 0.9), M.glass); cab.position.set(mid - 0.2, 1.1, 0); const top = new THREE.Mesh(new THREE.BoxGeometry(L * 0.42, 0.08, Wd * 0.88), M.body); top.position.set(mid - 0.2, 1.4, 0); const plate = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.5), M.blue); plate.position.set(mid - 0.2, 1.6, 0); car.add(cab, top, plate); }
    const wr = truck ? 0.45 : 0.32, wg = new THREE.CylinderGeometry(wr, wr, 0.24, 14); wg.rotateX(Math.PI / 2); this.own.push(wg);
    for (const [ax, front] of [[s.wb, true], [0, false]] as [number, boolean][]) for (const side of [1, -1]) { const g = new THREE.Group(); g.position.set(ax, wr, -side * (Wd / 2 - 0.11)); const w = new THREE.Mesh(wg, M.tyre); g.add(w); car.add(g); this.wheels.push(w); if (front) this.fw.push(g); }
    const lampG = new THREE.BoxGeometry(0.12, 0.16, 0.3); this.own.push(lampG, this.blinkL, this.blinkR, this.brakeM);
    for (const [ax, zs, mat] of [[mid + L / 2, 1, this.blinkL], [mid - L / 2, 1, this.blinkL], [mid + L / 2, -1, this.blinkR], [mid - L / 2, -1, this.blinkR]] as [number, number, THREE.Material][]) { const m = new THREE.Mesh(lampG, mat); m.position.set(ax, truck ? 0.85 : 0.68, -zs * (Wd / 2 - 0.18)); car.add(m); }
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, Wd * 0.5), this.brakeM); bl.position.set(mid - L / 2 - 0.02, truck ? 1.0 : 0.82, 0); car.add(bl); this.own.push(bl.geometry);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.6, Wd + 0.6), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.set(mid, 0.05, 0); car.add(shadow); this.own.push(shadow.geometry, shadow.material as THREE.Material);
    sc.add(car);
  }

  /** Vệt mũi tên gợi ý theo đường chạy mẫu (chế độ tập). */
  showHints(on: boolean) {
    for (const o of this.hintGroup.children.splice(0)) { const m = o as THREE.Mesh; m.geometry.dispose(); }
    if (!on) return; const geos: THREE.BufferGeometry[] = [], rev: THREE.BufferGeometry[] = [];
    for (const p of this.sim.c.pieces) for (let d = 0.8; d < p.len; d += 1.6) { const q = pieceAt(p, d), g = new THREE.CircleGeometry(0.34, 3); g.rotateZ(q.h + (p.dir < 0 ? Math.PI : 0)); g.translate(q.x, q.y, 0); g.rotateX(-Math.PI / 2); g.translate(0, heightAt(this.sim.c, q.x, q.y) + 0.06, 0); (p.dir > 0 ? geos : rev).push(g); }
    const m1 = new THREE.MeshBasicMaterial({ color: 0x35d07f, transparent: true, opacity: 0.75, depthWrite: false }), m2 = new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.85, depthWrite: false }); this.own.push(m1, m2);
    if (geos.length) this.hintGroup.add(new THREE.Mesh(mergeGeometries(geos, false)!, m1)); if (rev.length) this.hintGroup.add(new THREE.Mesh(mergeGeometries(rev, false)!, m2));
  }
  setView(v: ExamView) { this.view = v; }
  restart(opts: { practice?: boolean; from?: ItemId } = {}) { const cls = this.sim.c.spec.cls; this.sim = new ExamSim(cls, { practice: opts.practice, from: opts.from, danger: !opts.practice }); this.input = idleInput(); this.auto = false; this.camInit = false; this.showHints(!!opts.practice); }

  private onKey = (e: KeyboardEvent) => { if (e.type === 'keydown') this.keys.add(e.code); else this.keys.delete(e.code); };
  private keyInput() {
    const k = this.keys, i = this.input; if (!k.size) return;
    if (k.has('ArrowLeft') || k.has('KeyA')) i.steer = Math.min(1, i.steer + 0.045); else if (k.has('ArrowRight') || k.has('KeyD')) i.steer = Math.max(-1, i.steer - 0.045);
    i.gas = k.has('ArrowUp') || k.has('KeyW') ? 1 : 0; i.brake = k.has('ArrowDown') || k.has('KeyS') || k.has('Space') ? 1 : 0;
  }

  private frame = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.frame);
    if (!this.quality.tick(now)) { if (!this.quality.throttled) this.last = now; return; }
    const real = stepDt((now - (this.last || now)) / 1000); this.last = now; this.time += real;
    const sim = this.sim, fast = (window as unknown as { __rideStep?: number }).__rideStep ? 8 : 1, sub = Math.max(1, Math.ceil(real * fast / 0.02)), dt = real * fast / sub;
    this.keyInput();
    for (let n = 0; n < sub && !sim.done; n++) sim.step(dt, this.auto ? (this.input = sim.autoInput(dt)) : this.input);
    if (!this.auto && sim.practice) sim.autoInput(0); // chỉ để biết đoạn mẫu gần xe (hiện gợi ý)
    for (const e of sim.events.splice(0)) this.cb.onEvent(e);
    this.quality.busy = Math.abs(sim.v) > 0.05;
    // xe
    const c = sim.c, s = c.spec, hr = heightAt(c, sim.x, sim.y), hf = heightAt(c, sim.x + Math.cos(sim.th) * s.wb, sim.y + Math.sin(sim.th) * s.wb);
    this.car.position.set(sim.x, hr, -sim.y); this.car.rotation.set(0, sim.th, 0); this.car.rotateZ(Math.atan2(hf - hr, s.wb));
    for (const g of this.fw) g.rotation.y = sim.delta; for (const w of this.wheels) w.rotation.z -= sim.v * real * fast / 0.35;
    const blink = Math.floor(this.time * 2.6) % 2 === 0, inp = sim.input; this.blinkL.emissiveIntensity = (inp.left || inp.hazard) && blink ? 2.2 : 0; this.blinkR.emissiveIntensity = (inp.right || inp.hazard) && blink ? 2.2 : 0; this.brakeM.emissiveIntensity = inp.brake > 0.05 ? 1.8 : 0;
    const col = sim.lightColor(); this.lamps.forEach((m, i) => { m.emissiveIntensity = ['do', 'vang', 'xanh'][i] === col ? 2.4 : 0; });
    // máy quay
    const u = s.scale, portrait = this.camera.aspect < 1, k = ease(0.1, real), kY = ease(0.06, real);
    let dy = sim.th - this.camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.camYaw = this.camInit ? this.camYaw + dy * kY : sim.th;
    const cx = Math.cos(this.camYaw), cy = Math.sin(this.camYaw), want = new THREE.Vector3(), at = new THREE.Vector3(sim.x + Math.cos(sim.th) * s.wb / 2, hr, -(sim.y + Math.sin(sim.th) * s.wb / 2));
    if (this.view === 'sau') { want.set(sim.x - cx * 8.5 * u, hr + 4.2 * u, -(sim.y - cy * 8.5 * u)); at.set(sim.x + cx * 5 * u, hr + 0.6, -(sim.y + cy * 5 * u)); }
    else if (this.view === 'bac') { const hgt = (portrait ? 30 : 22) * u; want.set(at.x, hr + hgt, at.z + 0.01 + hgt * 0.12); }
    else { const hgt = (portrait ? 21 : 15) * u, backD = (portrait ? 9 : 7) * u; want.set(sim.x - cx * backD, hr + hgt, -(sim.y - cy * backD)); at.set(sim.x + cx * 3.2 * u, hr, -(sim.y + cy * 3.2 * u)); }
    if (!this.camInit) { this.camPos.copy(want); this.camAt.copy(at); this.camInit = true; } else { this.camPos.lerp(want, k); this.camAt.lerp(at, k); }
    this.camera.position.copy(this.camPos); this.camera.up.set(0, 1, 0); this.camera.lookAt(this.camAt);
    this.renderer.render(this.scene, this.camera);
    this.hudT += real; if (this.hudT > 0.12 || sim.done) { this.hudT = 0; const l = c.light; this.cb.onHud({ item: sim.item, score: sim.score, t: sim.t, kmh: sim.kmh, light: col, lightNear: sim.item === 5 && Math.hypot(sim.x - l.x, sim.y - l.y) < 40 * u, hint: sim.practice ? sim.hint() : null, danger: !!sim.danger, done: sim.done, gear: inp.gear, steer: sim.delta / s.maxSteer }); }
  };
  info() { return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }; }
  private resize = () => { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.quality.resize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); };
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.quality.dispose();
    window.removeEventListener('resize', this.resize); window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) m.geometry.dispose(); });
    for (const o of this.own) o.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}

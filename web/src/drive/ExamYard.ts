// Cảnh 3D của sân sát hạch: vẽ hình sân từ ExamCourse, xe sát hạch, đèn tín hiệu, biển số bài; chạy mô phỏng theo thời gian thật.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Quality, IS_MOBILE, rendererParams, stepDt, ease } from '../perf.ts';
import { bakeColored } from '../scene/batch.ts';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { person } from './RideParts.ts';
import { inPrim } from './ExamCourse.ts';
import { ExamSim, heightAt, pieceAt, idleInput } from './ExamCourse.ts';
import type { ExamClass, Input, ItemId, Prim, SimEvent } from './ExamCourse.ts';
import { ExamAssist } from './ExamAssist.ts';
import type { AssistLevel, AssistNeed } from './ExamAssist.ts';

export type ExamView = 'tren' | 'bac' | 'sau';
export interface YardHud { item: ItemId; score: number; t: number; kmh: number; light: 'do' | 'vang' | 'xanh'; lightNear: boolean; hint: string | null; danger: boolean; done: boolean; gear: string; steer: number;
  /** Trợ lái: mức, việc cần làm ngay (để nút nhấp nháy), có đang tự chạy tới đích chạm không, góc vô-lăng người chơi. */
  assist: AssistLevel; need: AssistNeed; goal: boolean; wheel: number; shifted: number }
export interface YardCallbacks { onEvent(e: SimEvent): void; onHud(h: YardHud): void }

const std = (color: number, rough = 0.9) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
const M = { asphalt: std(0x51565e), line: std(0xffffff, 0.6), yellow: std(0xffc928, 0.6), grass: std(0x79b356), kerb: std(0xd9d5ca, 0.95), red: std(0xd8402c), dark: std(0x2a2d33), pole: std(0x8b9099, 0.6), body: std(0xf4f6f8, 0.5), glass: std(0x9fd3ee, 0.3), tyre: std(0x1d1f23), wood: std(0x7a5a34), leaf: std(0x3f8f45), wall: std(0xf1e6c8), roof: std(0xc65a3c), skin: std(0xf1c9a0), blue: std(0x1f6fd0, 0.7), rail: std(0x6e7178, 0.5) };

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

/** Cỏ cắt sọc (sân thi được chăm kỹ). */
function grassTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = '#7dbb58'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#86c561'; g.fillRect(0, 0, 64, 128);
  let seed = 3; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 380; i++) { g.fillStyle = r() < 0.5 ? '#6fae4c' : '#92cf6b'; g.fillRect(r() * 128, r() * 128, 1.5, 3); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** Bóng mờ tròn dưới xe. */
function blobTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!, gr = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
/** Mặt chữ (biển hộp trên nóc xe, biển toà nhà). */
function textTex(text: string, bg: string, fg: string, w = 256, h = 64, font = 40): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = `800 ${font}px "Be Vietnam Pro", "Baloo 2", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
/** Mặt tiền có cửa sổ cho nhà điều hành. */
function facadeTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = '#f4ead2'; g.fillRect(0, 0, 256, 128);
  for (let f = 0; f < 2; f++) for (let i = 0; i < 6; i++) { g.fillStyle = '#5d8fb8'; g.fillRect(14 + i * 40, 14 + f * 58, 26, 34); g.fillStyle = '#9cc8e6'; g.fillRect(16 + i * 40, 16 + f * 58, 10, 30); g.fillStyle = '#e8dcc0'; g.fillRect(12 + i * 40, 48 + f * 58, 30, 4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Thân sedan trắng dựng từ mặt cắt dọc (đùn theo bề ngang): ca-pô, kính chắn gió, mui, kính hậu, cốp; kính tối, cột B, gương, đèn. Mũi xe hướng +x, tâm ở giữa thân. */
function sedanBody(L: number, W: number, color: number): THREE.Group {
  const g = new THREE.Group(), prof = (pts: [number, number][]) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]); sh.closePath(); return sh; };
  const h = L / 2, body: [number, number][] = [[-h, 0.3], [-h, 0.7], [-h + 0.12, 0.86], [-L * 0.3, 0.92], [L * 0.25, 0.94], [h - 0.15, 0.8], [h, 0.66], [h, 0.3]];
  const bg = new THREE.ExtrudeGeometry(prof(body), { depth: W - 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 1 }); bg.translate(0, 0, -(W - 0.12) / 2);
  g.add(mesh(bg, mat(color, { rough: 0.45 })));
  const glass: [number, number][] = [[-L * 0.3, 0.9], [-L * 0.135, 1.33], [L * 0.1, 1.33], [L * 0.25, 0.92]]; // khoang kính hẹp hơn thân một chút
  const gg = new THREE.ExtrudeGeometry(prof(glass), { depth: W - 0.24, bevelEnabled: false }); gg.translate(0, 0, -(W - 0.24) / 2);
  g.add(mesh(gg, mat(0x2c3e50, { rough: 0.2 })));
  g.add(mesh(GEO.box, mat(color, { rough: 0.45 }), -L * 0.02, 1.12, 0, 0.12, 0.44, W - 0.2)); // cột B
  g.add(mesh(GEO.box, mat(color, { rough: 0.45 }), -L * 0.018, 1.355, 0, L * 0.25, 0.06, W - 0.26)); // mui
  for (const s of [-1, 1]) { g.add(mesh(GEO.box, mat(color), L * 0.22, 0.98, s * (W / 2 + 0.1), 0.14, 0.1, 0.16), mesh(GEO.box, mat(0x2b2f36), L * 0.22, 0.98, s * (W / 2 + 0.17), 0.12, 0.09, 0.02)); // gương
    g.add(mesh(GEO.box, mat(0xfff6d8), h + 0.01, 0.62, s * (W / 2 - 0.3), 0.04, 0.12, 0.34), mesh(GEO.box, mat(0x2b2f36), 0, 0.46, s * (W / 2 + 0.005), L * 0.9, 0.05, 0.02)); }
  g.add(mesh(GEO.box, mat(0x2b2f36), h + 0.02, 0.42, 0, 0.06, 0.18, W * 0.6), mesh(GEO.box, mat(0x2b2f36), -h - 0.02, 0.4, 0, 0.06, 0.16, W * 0.9)); // lưới tản nhiệt, cản sau
  g.add(mesh(GEO.box, mat(0x1f6fd0), 0, 0.62, W / 2, L * 0.6, 0.06, 0.04), mesh(GEO.box, mat(0x1f6fd0), 0, 0.62, -W / 2, L * 0.6, 0.06, 0.04)); // sọc xanh hông
  return g;
}
function tree(g: THREE.Group, x: number, y: number, s: number, r: () => number) {
  const k = r(), z = -y;
  if (k < 0.2) { g.add(mesh(GEO.cyl, mat(0x9b8366), x, 2.5 * s, z, 0.13 * s, 5 * s, 0.13 * s)); for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, f = mesh(GEO.box, mat(i % 2 ? 0x6cb95a : 0x4f9f45), x + Math.cos(a) * 1.05 * s, 4.75 * s, z + Math.sin(a) * 1.05 * s, 2.4 * s, 0.06, 0.5 * s); f.rotation.order = 'YXZ'; f.rotation.y = -a; f.rotation.z = -0.45; g.add(f); } return; }
  g.add(mesh(GEO.cyl, mat(0x7a5232), x, 1.1 * s, z, 0.18 * s, 2.2 * s, 0.18 * s));
  const col = k < 0.55 ? 0x4f9f45 : k < 0.85 ? 0x3d8340 : 0xe58fb5; // thỉnh thoảng cây hoa
  g.add(mesh(GEO.sphere, mat(col), x, 3.0 * s, z, 1.6 * s, 1.35 * s, 1.6 * s), mesh(GEO.sphere, mat(col === 0xe58fb5 ? 0xf0a8c6 : 0x6cb95a), x + 0.5 * s, 3.6 * s, z - 0.4 * s, 1.0 * s));
}
function lamp(g: THREE.Group, x: number, y: number) { g.add(mesh(GEO.cyl, mat(0x9aa1ab), x, 3.5, -y, 0.09, 7, 0.09), mesh(GEO.box, mat(0x9aa1ab), x, 7.0, -y + 0.6, 0.08, 0.08, 1.3), mesh(GEO.box, mat(0xfffbe6), x, 6.92, -y + 1.2, 0.3, 0.1, 0.6)); }

export class ExamYard {
  sim: ExamSim; input: Input = idleInput(); auto = false; view: ExamView = 'tren';
  assist: ExamAssist; nudge = 0; dragging = false; private guide = true; private keyNudge = false;
  private goalMark = new THREE.Group(); private keyPts = new THREE.Group(); private down: { x: number; y: number; t: number } | null = null; private ray = new THREE.Raycaster();
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(50, 1, 0.5, 900);
  private quality: Quality; private raf = 0; private last = 0; private disposed = false; private time = 0;
  private car = new THREE.Group(); private fw: THREE.Group[] = []; private wheels: THREE.Mesh[] = [];
  private blinkL: THREE.MeshStandardMaterial; private blinkR: THREE.MeshStandardMaterial; private brakeM: THREE.MeshStandardMaterial;
  private lamps: THREE.MeshStandardMaterial[] = []; private hintGroup = new THREE.Group(); private camYaw = 0; private camPos = new THREE.Vector3(); private camAt = new THREE.Vector3(); private camInit = false;
  private hudT = 0; private own: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  private keys = new Set<string>(); private sun = new THREE.DirectionalLight(0xfff2d6, 1.5); private sky: THREE.Mesh | null = null;

  constructor(private host: HTMLElement, cls: ExamClass, private cb: YardCallbacks, opts: { practice?: boolean; from?: ItemId; assist?: AssistLevel; guide?: boolean } = {}) {
    this.sim = new ExamSim(cls, { practice: opts.practice, from: opts.from, danger: !opts.practice });
    this.assist = new ExamAssist(opts.assist ?? 'de'); this.guide = opts.guide ?? true;
    this.renderer = new THREE.WebGLRenderer(rendererParams(host)); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.blinkL = new THREE.MeshStandardMaterial({ color: 0x664400, emissive: 0xffa200, emissiveIntensity: 0 }); this.blinkR = this.blinkL.clone(); this.brakeM = new THREE.MeshStandardMaterial({ color: 0x551111, emissive: 0xff2200, emissiveIntensity: 0 });
    this.quality = new Quality(this.renderer, { name: 'sân thi', onLevel: (l) => { this.renderer.shadowMap.enabled = !IS_MOBILE && l === 0; } });
    host.appendChild(this.renderer.domElement); this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    this.build(); this.showHints(!!opts.practice || this.guide, !opts.practice);
    const el = this.renderer.domElement; el.addEventListener('pointerdown', this.onDown); el.addEventListener('pointerup', this.onUp);
    window.addEventListener('resize', this.resize); window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey); this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  private build() {
    const c = this.sim.c, s = c.spec, u = s.scale, sc = this.scene, b = c.bounds;
    sc.background = new THREE.Color(0xbfe4f5); sc.fog = new THREE.Fog(0xbfe4f5, 140 * u, 420 * u);
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8aa27a, 1.1)); const sun = this.sun; sun.position.set(40, 80, 30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 10, far: 220 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05; sc.add(sun, sun.target);
    { // vòm trời chuyển màu (xanh đậm trên đỉnh, nhạt dần xuống chân trời)
      const g = new THREE.SphereGeometry(700, 24, 12), col = new Float32Array(g.attributes.position.count * 3), top = new THREE.Color(0x6fb3e8), hor = new THREE.Color(0xd8eef8), tmp = new THREE.Color();
      for (let i = 0; i < g.attributes.position.count; i++) { const k = Math.max(0, g.attributes.position.getY(i) / 700); tmp.copy(hor).lerp(top, Math.pow(k, 0.6)); col.set([tmp.r, tmp.g, tmp.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3)); const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }); this.sky = new THREE.Mesh(g, m); this.sky.renderOrder = -1; sc.add(this.sky); this.own.push(g, m);
    }
    const gt = grassTex(), gw = b.x1 - b.x0 + 200, gh = b.y1 - b.y0 + 200; gt.repeat.set(gw / 8, gh / 8); const gm = new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }); this.own.push(gt, gm);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(gw, gh), gm); ground.rotation.x = -Math.PI / 2; ground.position.set((b.x0 + b.x1) / 2, 0, -(b.y0 + b.y1) / 2); ground.receiveShadow = true; sc.add(ground);
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
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex })); sp.scale.setScalar(0.95 * Math.min(1.4, u)); sp.position.set(g.x, 2.55, -g.y); sc.add(sp); this.own.push(sp.material);
    }
    { const l = c.light, pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.4, 10), M.pole); pole.position.set(l.x, 2.2, -l.y); deco.add(pole);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.25, 10), M.kerb); foot.position.set(l.x, 0.12, -l.y); deco.add(foot);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.95, 0.78), M.yellow); back.position.set(l.x + 0.02, 3.75, -l.y); deco.add(back);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.6, 0.52), M.dark); box.position.set(l.x - 0.2, 3.75, -l.y); deco.add(box);
      for (let i = 0; i < 3; i++) { const hood = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.44), M.dark); hood.position.set(l.x - 0.5, 4.33 - i * 0.5, -l.y); deco.add(hood); }
      const lg = new THREE.CircleGeometry(0.19, 18); lg.rotateY(-Math.PI / 2); this.own.push(lg);
      [0xff3020, 0xffc21a, 0x25d045].forEach((col, i) => { const m = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: col, emissiveIntensity: 0 }); this.lamps.push(m); this.own.push(m); const lamp = new THREE.Mesh(lg, m); lamp.position.set(l.x - 0.42, 4.25 - i * 0.5, -l.y); sc.add(lamp); }); }
    { const z = c.zebra, ped = person(4, 1.0); ped.position.set(z.x, 0, -(z.y - 3.5 * u / 2 - 1)); ped.rotation.y = Math.PI / 2; deco.add(ped); }
    { // nhà điều hành sát hạch: hai tầng, mái ngói bốn dốc, sảnh có mái đón, biển tên, cột cờ; khán đài chờ thi; bãi xe
      const hx = b.x0 + 16, hy = -13, ft = facadeTex(), fm = new THREE.MeshStandardMaterial({ map: ft, roughness: 0.9 }), house = new THREE.Mesh(new THREE.BoxGeometry(14, 6, 6), [M.wall, M.wall, M.roof, M.wall, fm, M.wall]); house.position.set(hx, 3, -hy); house.castShadow = house.receiveShadow = true; sc.add(house);
      const tt = textTex('TRUNG TÂM SÁT HẠCH LÁI XE', '#1f4fa8', '#ffffff', 512, 64, 34), tm = new THREE.MeshBasicMaterial({ map: tt }), board = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.25), tm); board.position.set(hx, 6.45, -hy + 3.25); sc.add(board);
      this.own.push(ft, fm, tt, tm, board.geometry, house.geometry);
      const roofG = new THREE.CylinderGeometry(0.32 * Math.SQRT1_2, Math.SQRT1_2, 1, 4, 1); roofG.rotateY(Math.PI / 4); this.own.push(roofG);
      const hipM = (x: number, y: number, z: number, w: number, h: number, d: number, m: THREE.Material) => { const r = new THREE.Mesh(roofG, m); r.scale.set(w, h, d); r.position.set(x, y + h / 2, z); deco.add(r); };
      deco.add(mesh(GEO.box, mat(0xfdf6e6), hx, 6.05, -hy, 15, 0.22, 7)); hipM(hx, 6.15, -hy, 15.6, 2.6, 7.6, M.roof);
      deco.add(mesh(GEO.box, mat(0xcfc6b4), hx, 0.12, -hy + 1.5, 16, 0.24, 10)); // nền, sân trước
      for (let k = 0; k < 3; k++) deco.add(mesh(GEO.box, mat(0xd9d2c2), hx, 0.08 + k * 0.08, -hy + 4.8 - k * 0.3, 4.4, 0.16, 0.6)); // bậc tam cấp
      deco.add(mesh(GEO.box, mat(0xfdf6e6), hx, 3.1, -hy + 4.4, 4.6, 0.2, 2.6)); for (const sx of [-2, 2]) deco.add(mesh(GEO.cyl, mat(0xfdf6e6), hx + sx, 1.55, -hy + 5.5, 0.14, 3.1, 0.14)); // mái đón sảnh
      const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 9, 6), M.pole); fp.position.set(hx + 9, 4.5, -hy + 4); deco.add(fp); const flag = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 0.03), M.red); flag.position.set(hx + 9.95, 8.2, -hy + 4); deco.add(flag); const star = new THREE.Mesh(new THREE.CircleGeometry(0.3, 5), M.yellow); star.position.set(hx + 9.95, 8.2, -hy + 4.02); deco.add(star);
      // khán đài chờ thi: mái tôn xanh trên cột, ba dãy ghế, vài thí sinh ngồi đứng
      const kx = hx - 14, kz = -hy + 1;
      deco.add(mesh(GEO.box, mat(0xcfc6b4), kx, 0.1, kz, 9, 0.2, 5)); for (const [x, z] of [[-4.2, -2.2], [4.2, -2.2], [-4.2, 2.2], [4.2, 2.2]]) deco.add(mesh(GEO.cyl, mat(0x8f97a3), kx + x, 1.7, kz + z, 0.08, 3.4, 0.08));
      const tin = mesh(GEO.box, mat(0x3f7fc0), kx, 3.5, kz, 9.6, 0.12, 5.6); tin.rotation.x = 0.12; deco.add(tin);
      for (let r = 0; r < 3; r++) { deco.add(mesh(GEO.box, mat(0x2f6fd0), kx, 0.45 + r * 0.35, kz - 1.2 + r * 1.1, 8, 0.12, 0.5), mesh(GEO.box, mat(0x8f97a3), kx, 0.25 + r * 0.35, kz - 1.2 + r * 1.1, 8, 0.4 + r * 0.7, 0.12)); }
      { const rr = rng(5); for (let i = 0; i < 7; i++) { const p = person(i, 1.0); p.position.set(kx - 3.5 + rr() * 7, i < 4 ? Math.max(0, 0.45 + (i % 3) * 0.35 - 0.6) : 0, kz - 1.2 + (i % 3) * 1.1 + (i < 4 ? 0 : 3.4)); p.rotation.y = Math.PI + (rr() - 0.5) * 0.6; deco.add(p); } }
      // bãi xe sát hạch chờ: ba xe trắng đỗ hàng, vạch ô
      for (let i = 0; i < 4; i++) { const px = hx + 12 + i * 3, pz = -hy - 2; deco.add(mesh(GEO.box, mat(0xffffff), px - 1.5, 0.03, pz, 0.1, 0.02, 5)); if (i < 3) { const car = sedanBody(4.4, 1.7, 0xf4f6f8); car.rotation.y = Math.PI / 2; car.position.set(px, 0, pz); deco.add(car); } }
    }
    { // hàng rào bao sân (tường thấp + song sắt), đèn chiếu sáng, cây, khối nhà phố phía xa
      const pad = 8, X0 = b.x0 - pad, X1 = b.x1 + pad, Y0 = b.y0 - pad, Y1 = b.y1 + pad, rr = rng(11);
      const wall = (xa: number, ya: number, xb: number, yb: number) => { const l = Math.hypot(xb - xa, yb - ya), w = mesh(GEO.box, mat(0xe8dcc0), (xa + xb) / 2, 0.45, -(ya + yb) / 2, l, 0.9, 0.3); w.rotation.y = Math.atan2(yb - ya, xb - xa); deco.add(w); const t = mesh(GEO.box, mat(0x4a5160), (xa + xb) / 2, 1.5, -(ya + yb) / 2, l, 0.06, 0.06); t.rotation.y = w.rotation.y; deco.add(t);
        for (let d = 0; d <= l; d += 3) { const x = xa + (xb - xa) * d / l, y = ya + (yb - ya) * d / l; deco.add(mesh(GEO.box, mat(0xd8c9a6), x, 0.8, -y, 0.42, 1.6, 0.42)); } };
      wall(X0, Y0, X1, Y0); wall(X1, Y0, X1, Y1); wall(X1, Y1, X0, Y1); wall(X0, Y1, X0, Y0);
      const clear = (x: number, y: number, m: number) => !c.road.some((p) => inPrim(p, x, y, m));
      for (let x = X0 + 10; x < X1; x += 26) for (const y of [Y0 + 2, Y1 - 2]) if (clear(x, y, 2)) lamp(deco, x, y);
      let n = 0; for (let i = 0; i < 900 && n < 70; i++) { const x = X0 + 2 + rr() * (X1 - X0 - 4), y = Y0 + 2 + rr() * (Y1 - Y0 - 4); if (!clear(x, y, 4.5) || (Math.abs(x - (b.x0 + 16)) < 12 && Math.abs(y + 13) < 9) || (Math.abs(x - (b.x0 + 2)) < 8 && Math.abs(y + 12) < 6)) continue; n++; tree(deco, x, y, 0.8 + rr() * 0.6, rr); }
      for (let i = 0; i < 40; i++) { const side = i % 4, t = rr(); const x = side < 2 ? X0 + t * (X1 - X0) : side === 2 ? X0 - 6 - rr() * 6 : X1 + 6 + rr() * 6, y = side === 0 ? Y0 - 6 - rr() * 8 : side === 1 ? Y1 + 6 + rr() * 8 : Y0 + t * (Y1 - Y0); if (rr() < 0.45) tree(deco, x, y, 1 + rr() * 0.5, rr); else { const h = 4 + rr() * 9, w = 5 + rr() * 4; deco.add(mesh(GEO.box, mat([0xf1e4c8, 0xe6eef2, 0xf4d9c6, 0xdfe8d4][i % 4]), x, h / 2, -y, w, h, w * 0.8), mesh(GEO.box, mat(0xb8543a), x, h + 0.2, -y, w + 0.4, 0.4, w * 0.8 + 0.4)); } }
    }
    sc.add(bakeColored(st, false, true), bakeColored(deco, true, true)); sc.add(this.hintGroup);
    // xe sát hạch
    const car = this.car, L = s.len, Wd = s.wid, mid = L / 2 - s.rear, truck = s.cls !== 'B';
    const body = new THREE.Group();
    const bx = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); body.add(o); return o; };
    if (truck) {
      bx(L, 0.45, Wd, M.dark, mid, 0.72); bx(1.8, 1.55, Wd * 0.96, M.body, mid + L / 2 - 0.95, 1.65); bx(0.06, 0.7, Wd * 0.8, M.glass, mid + L / 2 - 0.02, 1.95); bx(L - 2.05, 1.6, Wd, M.blue, mid - 0.95, 1.75);
      bx(0.05, 0.25, Wd * 0.98, M.yellow, mid - 0.95 + (L - 2.05) / 2, 1.0);
    } else { const sb = sedanBody(L, Wd, 0xf4f6f8); sb.position.x = mid; body.add(sb); }
    car.add(bakeColored(body, true));
    { // hộp biển "SÁT HẠCH" trên nóc
      const tex = textTex('SÁT HẠCH', '#ffffff', '#c62828', 256, 64, 44), sm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), rim = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, Wd * 0.5), [rim, rim, M.body, rim, sm, sm]); sign.rotation.y = Math.PI / 2; sign.position.set(truck ? mid + L / 2 - 0.95 : mid - 0.18, truck ? 2.62 : 1.5, 0); car.add(sign); this.own.push(tex, sm, rim, sign.geometry);
    }
    const wr = truck ? 0.45 : 0.32, wg = new THREE.CylinderGeometry(wr, wr, 0.24, 14); wg.rotateX(Math.PI / 2); this.own.push(wg);
    for (const [ax, front] of [[s.wb, true], [0, false]] as [number, boolean][]) for (const side of [1, -1]) { const g = new THREE.Group(); g.position.set(ax, wr, -side * (Wd / 2 - 0.11)); const w = new THREE.Mesh(wg, M.tyre); g.add(w); car.add(g); this.wheels.push(w); if (front) this.fw.push(g); }
    const lampG = new THREE.BoxGeometry(0.12, 0.16, 0.3); this.own.push(lampG, this.blinkL, this.blinkR, this.brakeM);
    for (const [ax, zs, mat] of [[mid + L / 2, 1, this.blinkL], [mid - L / 2, 1, this.blinkL], [mid + L / 2, -1, this.blinkR], [mid - L / 2, -1, this.blinkR]] as [number, number, THREE.Material][]) { const m = new THREE.Mesh(lampG, mat); m.position.set(ax, truck ? 0.85 : 0.68, -zs * (Wd / 2 - 0.18)); car.add(m); }
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, Wd * 0.5), this.brakeM); bl.position.set(mid - L / 2 - 0.02, truck ? 1.0 : 0.82, 0); car.add(bl); this.own.push(bl.geometry);
    const bt = blobTex(); this.own.push(bt); const shadow = new THREE.Mesh(new THREE.PlaneGeometry(L + 1.4, Wd + 1.2), new THREE.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.set(mid, 0.05, 0); car.add(shadow); this.own.push(shadow.geometry, shadow.material as THREE.Material);
    sc.add(car);
    // vòng đích khi chạm lên sân, các điểm canh lái ở bài ghép xe
    { const rg = new THREE.RingGeometry(0.55, 0.8, 28); rg.rotateX(-Math.PI / 2); const rm = new THREE.MeshBasicMaterial({ color: 0x2fd2ff, transparent: true, opacity: 0.85, depthWrite: false }); this.goalMark.add(new THREE.Mesh(rg, rm)); this.goalMark.visible = false; sc.add(this.goalMark); this.own.push(rg, rm);
      const kg = new THREE.RingGeometry(0.35, 0.6, 24); kg.rotateX(-Math.PI / 2); const km = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.9, depthWrite: false }); this.own.push(kg, km);
      const P = c.pieces; P.forEach((p, i) => { const n = P[i + 1]; if (!n || n.dir === p.dir && Math.abs(n.k - p.k) < 0.02) return; if (p.dir > 0 && n.dir > 0) return; const e = pieceAt(p, p.len), m = new THREE.Mesh(kg, km); m.position.set(e.x, 0.07, -e.y); this.keyPts.add(m); });
      sc.add(this.keyPts); }
  }

  /** Vệt mũi tên gợi ý theo đường chạy mẫu (chế độ tập). */
  showHints(on: boolean, faint = false) {
    for (const o of this.hintGroup.children.splice(0)) { const m = o as THREE.Mesh; m.geometry.dispose(); }
    this.keyPts.visible = on;
    if (!on) return; const geos: THREE.BufferGeometry[] = [], rev: THREE.BufferGeometry[] = [];
    for (const p of this.sim.c.pieces) for (let d = 0.8; d < p.len; d += 1.6) { const q = pieceAt(p, d), g = new THREE.CircleGeometry(0.34, 3); g.rotateZ(q.h + (p.dir < 0 ? Math.PI : 0)); g.translate(q.x, q.y, 0); g.rotateX(-Math.PI / 2); g.translate(0, heightAt(this.sim.c, q.x, q.y) + 0.06, 0); (p.dir > 0 ? geos : rev).push(g); }
    const m1 = new THREE.MeshBasicMaterial({ color: 0x35d07f, transparent: true, opacity: faint ? 0.32 : 0.75, depthWrite: false }), m2 = new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: faint ? 0.45 : 0.85, depthWrite: false }); this.own.push(m1, m2);
    if (geos.length) this.hintGroup.add(new THREE.Mesh(mergeGeometries(geos, false)!, m1)); if (rev.length) this.hintGroup.add(new THREE.Mesh(mergeGeometries(rev, false)!, m2));
  }
  setView(v: ExamView) { this.view = v; }
  setGuide(on: boolean) { this.guide = on; this.showHints(on || this.sim.practice, !this.sim.practice); }
  setAssist(l: AssistLevel) { this.assist.level = l; this.assist.goal = null; }
  /** Chạm (không kéo) lên sân: chọn điểm tới cho trợ lái. */
  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  private onUp = (e: PointerEvent) => {
    const d = this.down; this.down = null; if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 600 || this.auto) return;
    const r = this.renderer.domElement.getBoundingClientRect(), ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera); const o = this.ray.ray.origin, dir = this.ray.ray.direction; if (dir.y > -0.01) return;
    const t = -o.y / dir.y, x = o.x + dir.x * t, y = -(o.z + dir.z * t);
    if (this.assist.setGoal(this.sim, x, y)) { this.input.gas = 0; this.input.brake = 0; }
  };
  /** Thử tự động: chạm đích bằng toạ độ sân. */
  tapAt(x: number, y: number) { return this.assist.setGoal(this.sim, x, y); }
  restart(opts: { practice?: boolean; from?: ItemId } = {}) { const cls = this.sim.c.spec.cls; this.sim = new ExamSim(cls, { practice: opts.practice, from: opts.from, danger: !opts.practice }); this.input = idleInput(); this.auto = false; this.camInit = false; this.assist.goal = null; this.showHints(!!opts.practice || this.guide, !opts.practice); }

  private onKey = (e: KeyboardEvent) => { if (e.type === 'keydown') this.keys.add(e.code); else this.keys.delete(e.code); };
  private keyInput() {
    const k = this.keys, i = this.input; if (!k.size) { if (this.keyNudge) { this.keyNudge = false; this.nudge = 0; } return; }
    const n = k.has('ArrowLeft') || k.has('KeyA') ? 1 : k.has('ArrowRight') || k.has('KeyD') ? -1 : 0; if (n || this.keyNudge) { this.nudge = n; this.keyNudge = !!n; }
    i.gas = k.has('ArrowUp') || k.has('KeyW') ? 1 : 0; i.brake = k.has('ArrowDown') || k.has('KeyS') || k.has('Space') ? 1 : 0;
  }

  private frame = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.frame);
    if (!this.quality.tick(now)) { if (!this.quality.throttled) this.last = now; return; }
    const real = stepDt((now - (this.last || now)) / 1000); this.last = now; this.time += real;
    const sim = this.sim, fast = (window as unknown as { __rideStep?: number }).__rideStep ? 8 : 1, sub = Math.max(1, Math.ceil(real * fast / 0.02)), dt = real * fast / sub;
    this.keyInput();
    for (let n = 0; n < sub && !sim.done; n++) sim.step(dt, this.auto ? (this.input = sim.autoInput(dt)) : this.assist.apply(sim, this.input, this.nudge, this.dragging, dt));
    if (!this.auto && sim.practice && this.assist.level === 'that') sim.autoInput(0); // chỉ để biết đoạn mẫu gần xe (hiện gợi ý)
    { const g = this.assist.goal; this.goalMark.visible = !!g; if (g) { this.goalMark.position.set(g.x, heightAt(sim.c, g.x, g.y) + 0.06, -g.y); this.goalMark.scale.setScalar(1 + Math.sin(this.time * 6) * 0.12); } }
    for (const m of this.keyPts.children) (m as THREE.Mesh).scale.setScalar(1 + Math.sin(this.time * 4) * 0.15);
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
    this.sun.target.position.set(sim.x, 0, -sim.y); this.sun.position.set(sim.x + 40, 80, -sim.y + 30); if (this.sky) this.sky.position.copy(this.camPos);
    this.renderer.render(this.scene, this.camera);
    this.hudT += real; if (this.hudT > 0.12 || sim.done) { this.hudT = 0; const l = c.light; this.cb.onHud({ item: sim.item, score: sim.score, t: sim.t, kmh: sim.kmh, light: col, lightNear: sim.item === 5 && Math.hypot(sim.x - l.x, sim.y - l.y) < 40 * u, hint: sim.practice ? sim.hint() : null, danger: !!sim.danger, done: sim.done, gear: inp.gear, steer: sim.delta / s.maxSteer, assist: this.assist.level, need: this.assist.need, goal: !!this.assist.goal, wheel: this.input.steer, shifted: this.assist.shifted }); }
  };
  info() { return { calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }; }
  private resize = () => { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.quality.resize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); };
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.quality.dispose();
    window.removeEventListener('resize', this.resize); window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
    this.renderer.domElement.removeEventListener('pointerdown', this.onDown); this.renderer.domElement.removeEventListener('pointerup', this.onUp);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) m.geometry.dispose(); });
    for (const o of this.own) o.dispose(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}

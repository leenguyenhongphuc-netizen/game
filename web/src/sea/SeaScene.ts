// Biển mở: lái tàu tự do trên vùng biển dựng theo bờ biển thật (seaWorld.ts). Không còn luồng hẹp hay phạt lệch luồng:
// phao luồng IALA vùng A chỉ là gợi ý, chỉ bờ, đảo đá vôi, đá ngầm và tàu khác mới chặn (va thì dội lại, trừ độ bền vỏ).
// Tàu bè chạy theo đồng hồ (mọi máy thấy giống nhau), tàu người chơi khác qua presence (cảnh 'sea'), gió và sóng đẩy
// hướng tàu nhẹ, đuôi sóng sau tàu, hải âu. Cũng dùng cho mô tô nước ở bãi biển (vùng phao an toàn).
// Mọi chuyển động chạy theo dt trong vòng vẽ (không setInterval).
import * as THREE from 'three';
import { Quality, debugScene, ease, rendererParams, stepDt, IS_MOBILE } from '../perf.ts';
import { bakeColored } from '../scene/batch.ts';
import { GEO, mat, mesh } from '../scene/plants.ts';
import { bird, playerVehicle, skyDecor, wake } from '../drive/DriveExtras.ts';
import type { VehGroup } from '../drive/DriveExtras.ts';
import { LookDrag } from '../cameraFeel.ts';
import { PresenceLink, disposeTag, dropSay, hexOf, nameTag, syncSay, turnTo } from '../presence.ts';
import type { PresenceIn, PresenceOther } from '../../../shared/social.ts';
import type { Lane, LaneKind, Pt, SeaWorld } from './seaWorld.ts';
import { lanePos, zoneUV } from './seaWorld.ts';
import { SHIP_NAME, SHIP_R, buoyGeometry, carFerry, jetSki, karstGeometry, shipFor } from './SeaParts.ts';

const clamp = THREE.MathUtils.clamp;
export type SeaView = 'chase' | 'bridge' | 'far';
export interface SeaShip { x: number; z: number; yaw: number; kind: LaneKind }
export interface SeaHud {
  speed: number; unit: 'hl' | 'kmh'; heading: number; x: number; z: number; yaw: number;
  dist: number; bearing: number; targetName: string; hull: number; throttle: number; rudder: number;
  wind: { dir: number; spd: number }; view: SeaView; auto: boolean;
  zoneOut: boolean; docking: boolean; elapsed: number; hits: number; km: number;
}
export interface SeaSummary { seconds: number; hits: number; hull: number; km: number }
export interface SeaOptions {
  world: SeaWorld; mode: 'ferry' | 'jetski';
  /** Xe của người chơi trên boong phà (chuyến buôn). */
  cargo?: { group: VehGroup; color: number; electric?: boolean } | null;
  jetColor?: number;
  presenceKey: string;
  autopilot?: boolean;
  onHud?: (h: SeaHud) => void;
  onBump?: (text: string, kind: 'bad' | 'good' | 'info') => void;
  onArrive?: (s: SeaSummary) => void;
}

// Thông số lái: tàu khách/phà ì, chậm quay; mô tô nước nhanh nhạy.
const SPEC = {
  ferry: { vmax: 24, rev: 5, acc: 0.42, turn: 0.6, vref: 10, len: 6.2, half: 2.4, drift: 0.55, camD: 30, camH: 12, knots: 0.58 },
  jetski: { vmax: 21, rev: 4, acc: 1.3, turn: 1.55, vref: 6, len: 1.8, half: 0.6, drift: 0.25, camD: 11, camH: 4.4, knots: 3.6 },
};

/** Mặt biển: sóng tính theo toạ độ thế giới (không trượt theo máy quay), nước nông và bọt sóng sát bờ đọc từ trường khoảng cách. */
function seaMat(fog: THREE.Fog, distTex: THREE.Texture, w: SeaWorld): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uT: { value: 0 }, uDist: { value: distTex }, uGrid: { value: new THREE.Vector4(w.gx0, w.gz0, w.nx * w.cell, w.nz * w.cell) }, uScale: { value: w.kind === 'jetski' ? 0.25 : 1 },
      uDeep: { value: new THREE.Color(0x0d5f95) }, uShallow: { value: new THREE.Color(0x35b8c9) }, uSky: { value: new THREE.Color(0xbfe6fa) },
      uFog: { value: fog.color }, uNear: { value: fog.near }, uFar: { value: fog.far }, uSun: { value: new THREE.Vector3(0.35, 0.55, -0.75).normalize() },
    },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `
      uniform float uT, uNear, uFar, uScale; uniform vec4 uGrid; uniform sampler2D uDist; uniform vec3 uDeep, uShallow, uSky, uFog, uSun; varying vec3 vW;
      float h(vec2 p){ return sin(p.x*0.33+uT*1.1)*0.5 + sin(p.y*0.47-uT*1.5+p.x*0.11)*0.35 + sin((p.x-p.y)*0.95+uT*2.1)*0.15; }
      void main(){
        vec2 p = vW.xz * uScale * vec2(1.0, -1.0) + vec2(0.0, 0.0);
        vec2 uv = (vW.xz - uGrid.xy) / uGrid.zw;
        float d = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? 1.0 : texture2D(uDist, uv).r; // 0 = sát bờ, 1 = xa bờ
        float e = 0.4, hx = h(p+vec2(e,0.))-h(p-vec2(e,0.)), hz = h(p+vec2(0.,e))-h(p-vec2(0.,e));
        vec3 n = normalize(vec3(-hx*0.8, 1.0, hz*0.8));
        vec3 v = normalize(cameraPosition - vW);
        float fr = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 col = mix(uDeep, uShallow, 0.35 + 0.35*h(p*0.45));
        col = mix(uShallow*1.08 + vec3(0.04,0.06,0.02), col, smoothstep(0.02, 0.35, d));
        col = mix(col, uSky, clamp(fr*0.55 + 0.04, 0.0, 0.8));
        float sp = pow(max(dot(reflect(-uSun, n), v), 0.0), 48.0); col += vec3(1.0, 0.96, 0.82) * sp * 0.45;
        float foam = smoothstep(0.86, 1.0, h(p*1.9) + 0.3*sin(p.x*2.7+uT*1.3)); col = mix(col, vec3(1.0), foam*0.18);
        float shore = (1.0 - smoothstep(0.0, 0.07, d)) * (0.55 + 0.45*sin(d*90.0 - uT*2.2));
        col = mix(col, vec3(1.0), clamp(shore, 0.0, 1.0)*0.75);
        col = mix(col, uFog, smoothstep(uNear, uFar, length(cameraPosition - vW)));
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

interface Ship { lane: Lane; obj: THREE.Object3D; r: number; x: number; z: number; yaw: number; hornAt: number; slow: number; off: number }
interface Other { o: PresenceOther; obj: THREE.Group; tag: THREE.Sprite; x: number; z: number; yaw: number; vx: number; vz: number; t0: number; px: number; pz: number }

export class SeaScene {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(55, 1, 0.5, 2600);
  private quality: Quality; private ro: ResizeObserver; private disposed = false; private last = 0;
  private w: SeaWorld; private o: SeaOptions; private spec: (typeof SPEC)['ferry'];
  private boat!: THREE.Group; private wakeM: THREE.Mesh | null = null; private sea!: THREE.Mesh; private seaM!: THREE.ShaderMaterial;
  private fleet: Ship[] = []; private others = new Map<number, Other>(); private link: PresenceLink | null = null;
  private birds: { b: ReturnType<typeof bird>; a: number; r: number; h: number; w: number }[] = [];
  private look: LookDrag; private keys = new Set<string>();
  // trạng thái tàu
  x = 0; z = 0; yaw = 0; v = 0; private rudder = 0; private rudderIn = 0; private lever = 0; private gas = 0; private brake = 0;
  private hull = 100; private hits = 0; private elapsed = 0; private odo = 0; private bumpCd = 0; private hornCd = 0;
  private wind = { dir: 0, spd: 0 }; private view: SeaView = 'chase'; private auto = false; private wp: Pt | null = null;
  private docking = 0; private done = false; private running = false; private zoneOut = false; private hudT = 0;
  private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3(); private camInit = false;
  private audio: AudioContext | null = null; private t = 0;
  private cleanup: (() => void)[] = [];

  constructor(private host: HTMLElement, opts: SeaOptions) {
    this.o = opts; this.w = opts.world; this.spec = SPEC[opts.mode];
    this.auto = !!opts.autopilot || (globalThis as { __seaAuto?: boolean }).__seaAuto === true;
    this.renderer = new THREE.WebGLRenderer(rendererParams(host));
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.shadowMap.enabled = false;
    const el = this.renderer.domElement; el.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;user-select:none;-webkit-user-select:none'; host.appendChild(el);
    this.look = new LookDrag(el, true);
    const jet = opts.mode === 'jetski';
    const fogFar = jet ? 700 : 900;
    this.scene.background = new THREE.Color(0xcdeefa); this.scene.fog = new THREE.Fog(0xd9f1fb, jet ? 160 : 260, fogFar);
    this.camera.far = fogFar + 200;
    const sun = new THREE.DirectionalLight(0xfff2d8, 2.0); sun.position.set(120, 200, -80);
    this.scene.add(new THREE.HemisphereLight(0xfafcff, 0x9ec4d0, 1.4), sun, this.camera);
    const decor = skyDecor(); decor.scale.setScalar(jet ? 1.4 : 2.2); this.scene.add(decor); this.cleanup.push(() => decor.removeFromParent());
    this.decor = decor;
    this.build();
    this.x = this.w.start.x; this.z = this.w.start.z; this.yaw = this.w.start.yaw;
    this.windAt(0);
    // điều khiển bằng bàn phím (máy tính)
    const kd = (e: KeyboardEvent) => { this.keys.add(e.code); if (e.code === 'KeyW' || e.code === 'ArrowUp') this.leverStep(1, true); if (e.code === 'KeyS' || e.code === 'ArrowDown') this.leverStep(-1, true); };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.code);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    this.cleanup.push(() => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host);
    this.quality = new Quality(this.renderer, { name: jet ? 'mô tô nước' : 'biển' });
    this.resize(); debugScene(this.scene);
    // tàu người chơi khác cùng vùng biển
    this.link = new PresenceLink(() => this.state(), (list, at) => this.setOthers(list, at.local));
    (window as unknown as { __sea?: SeaScene }).__sea = this;
    this.renderer.setAnimationLoop(() => this.frame());
  }
  private decor: THREE.Group;

  // ------------------------------------------------------------------ dựng cảnh
  private build() {
    const w = this.w, jet = this.o.mode === 'jetski';
    // trường khoảng cách → kết cấu cho mặt biển (0 sát bờ … 1 xa bờ)
    const span = jet ? 70 : 160, data = new Uint8Array(w.nx * w.nz * 4);
    for (let i = 0; i < w.nx * w.nz; i++) { const v = w.land[i] ? 0 : Math.round(clamp(w.dist[i] / span, 0, 1) * 255); data[i * 4] = v; data[i * 4 + 3] = 255; }
    const tex = new THREE.DataTexture(data, w.nx, w.nz, THREE.RGBAFormat); tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    this.seaM = seaMat(this.scene.fog as THREE.Fog, tex, w);
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(4200, 4200).rotateX(-Math.PI / 2), this.seaM); this.sea.position.y = 0; this.scene.add(this.sea);
    this.cleanup.push(() => tex.dispose());
    // đất: mặt trên xanh, mép cát, một lưới chung
    const geoms: THREE.BufferGeometry[] = [];
    for (const r of w.rings) {
      if (r.length < 3) continue;
      const shape = new THREE.Shape(r.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(shape, { depth: jet ? 2.2 : 3.2, bevelEnabled: false, steps: 1 });
      g.rotateX(-Math.PI / 2); g.translate(0, -0.6, 0); geoms.push(g.index ? g.toNonIndexed() : g);
    }
    if (geoms.length) {
      // tô màu theo đỉnh: mặt trên xanh cỏ, vách cát
      const merged = merge(geoms), pos = merged.attributes.position as THREE.BufferAttribute, nor = merged.attributes.normal as THREE.BufferAttribute, col = new Float32Array(pos.count * 3);
      const green = new THREE.Color(jet ? 0x9fcf72 : 0x6fae5b), sand = new THREE.Color(0xeedcab);
      for (let i = 0; i < pos.count; i++) { const c = nor.getY(i) > 0.5 ? green : sand; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      merged.setAttribute('color', new THREE.BufferAttribute(col, 3));
      this.scene.add(new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
    }
    // đồi, cây, nhà trên đất gần vùng chơi (instanced, mỗi loại một lần vẽ)
    const rnd = mulberry(7 + w.nx * 31 + w.nz), hills: THREE.Matrix4[] = [], trees: THREE.Matrix4[] = [], houses: { m: THREE.Matrix4; c: number }[] = [];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const landDepth = (x: number, z: number) => { // độ sâu vào đất liền (ô đất xung quanh)
      let n = 0; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; if (w.isLand(x + Math.cos(a) * 26 * (jet ? 0.5 : 1), z + Math.sin(a) * 26 * (jet ? 0.5 : 1))) n++; } return n;
    };
    for (let i = 0; i < (jet ? 260 : 700) && hills.length < (jet ? 40 : 90); i++) {
      const x = w.bounds.x0 + rnd() * (w.bounds.x1 - w.bounds.x0), z = w.bounds.z0 + rnd() * (w.bounds.z1 - w.bounds.z0);
      if (w.land[gi(w, x, z)] !== 1 || landDepth(x, z) < 8) continue;
      const hgt = (jet ? 25 : 18) + rnd() * (jet ? 60 : 45), rad = hgt * (1.3 + rnd() * 0.8);
      hills.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 1.8, z), q.setFromAxisAngle(up, rnd() * 6), new THREE.Vector3(rad, hgt, rad)));
    }
    for (let i = 0; i < 2500 && trees.length < (jet ? 260 : 320); i++) {
      const x = w.bounds.x0 + rnd() * (w.bounds.x1 - w.bounds.x0), z = w.bounds.z0 + rnd() * (w.bounds.z1 - w.bounds.z0);
      if (w.land[gi(w, x, z)] !== 1) continue;
      const s = jet ? 2 + rnd() * 2 : 3 + rnd() * 4;
      trees.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 2.5, z), q.setFromAxisAngle(up, rnd() * 6), new THREE.Vector3(s, s * 2.2, s)));
    }
    for (const p of w.piers) {
      // dãy nhà, khách sạn ven bến/bãi
      const along: Pt = [-p.oz, p.ox];
      for (let k = 0; k < (jet ? 22 : 12); k++) {
        const u = (k - (jet ? 11 : 6)) * (jet ? 26 : 16) + (rnd() - 0.5) * 6, back = (jet ? 50 : 14) + rnd() * (jet ? 40 : 18);
        const x = p.x + along[0] * u - p.ox * back, z = p.z + along[1] * u - p.oz * back; if (w.land[gi(w, x, z)] !== 1) continue;
        const hgt = jet ? 10 + rnd() * 40 : 4 + rnd() * 8, sx = jet ? 14 + rnd() * 8 : 5 + rnd() * 4;
        houses.push({ m: new THREE.Matrix4().compose(new THREE.Vector3(x, 1.6 + hgt / 2, z), q.setFromAxisAngle(up, Math.atan2(p.ox, -p.oz)), new THREE.Vector3(sx, hgt, sx * 0.8)), c: [0xf7efe0, 0xffd8c2, 0xd9ecf5, 0xfff3c4, 0xe8f0d8][k % 5] });
      }
    }
    const inst = (geo: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[], colors?: number[]) => {
      if (!list.length) return; const im = new THREE.InstancedMesh(geo, m, list.length); list.forEach((mm, i) => im.setMatrixAt(i, mm));
      if (colors) { const c = new THREE.Color(); colors.forEach((h, i) => im.setColorAt(i, c.setHex(h))); }
      im.instanceMatrix.needsUpdate = true; this.scene.add(im); return im;
    };
    const hillGeo = new THREE.ConeGeometry(1, 1, 9, 2); hillGeo.translate(0, 0.5, 0);
    { const p = hillGeo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.05 && y < 0.95) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.15 * Math.sin(a * 3); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } } hillGeo.computeVertexNormals(); }
    inst(hillGeo, new THREE.MeshStandardMaterial({ color: jet ? 0x86b86a : 0x5f9a58, roughness: 1, flatShading: true }), hills);
    const treeGeo = new THREE.ConeGeometry(0.5, 1, 6); treeGeo.translate(0, 0.5, 0);
    inst(treeGeo, new THREE.MeshStandardMaterial({ color: 0x3f8a4a, roughness: 1, flatShading: true }), trees);
    inst(GEO.box, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), houses.map((h) => h.m), houses.map((h) => h.c));
    // cầu cảng: bến nhô ra mặt nước
    const pierG = new THREE.Group();
    w.piers.forEach((p, i) => {
      if (jet && i > 0) return;
      const ang = Math.atan2(p.ox, -p.oz), L = jet ? 34 : 26, pg = new THREE.Group();
      pg.add(mesh(GEO.box, mat(0xbfb3a0), 0, 1.0, -L / 2, jet ? 3 : 7, 0.6, L));
      for (let k = 0; k < 6; k++) for (const s of [-1, 1]) pg.add(mesh(GEO.cyl, mat(0x6b5a48), s * (jet ? 1.4 : 3.3), 0.2, -k * (L / 6) - 2, 0.25, 2, 0.25));
      if (!jet) { pg.add(mesh(GEO.box, mat(0xf5efe2), 0, 3.2, 4, 12, 4.4, 7), mesh(GEO.box, mat(0x2f6fb5), 0, 5.6, 4, 13, 0.5, 8)); }
      else { for (let k = 0; k < 4; k++) { const js = jetSki([0xe63946, 0x2a9d8f, 0xf4a261, 0x457b9d][k]); js.position.set(-4 + k * 2.6, 0.1, -L - 2); pg.add(js); } }
      pg.position.set(p.x, 0, p.z); pg.rotation.y = -ang; pierG.add(pg);
    });
    this.scene.add(bakeColored(pierG));
    // phao luồng: đỏ/xanh (tàu) hoặc vàng (vùng an toàn mô tô nước) — một lần vẽ
    if (w.buoys.length) {
      const bg = buoyGeometry(), im = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), w.buoys.length), c = new THREE.Color();
      w.buoys.forEach((b, i) => { im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(b.x, 0, b.z), q.identity(), new THREE.Vector3(1, 1, 1).multiplyScalar(jet ? 0.7 : 1.5))); im.setColorAt(i, c.setHex(jet ? 0xffd23f : b.red ? 0xe0342b : 0x2faa5a)); });
      im.instanceMatrix.needsUpdate = true; this.buoys = im; this.scene.add(im);
    }
    // đảo đá vôi + chỏm cây; đá ngầm
    if (w.karsts.length) {
      const k = karstGeometry(), rocks = new THREE.InstancedMesh(k.rock, new THREE.MeshStandardMaterial({ color: 0x9aa29a, roughness: 1, flatShading: true }), w.karsts.length), tops = new THREE.InstancedMesh(k.top, new THREE.MeshStandardMaterial({ color: 0x4f8f4a, roughness: 1, flatShading: true }), w.karsts.length);
      w.karsts.forEach((s, i) => { const mm = new THREE.Matrix4().compose(new THREE.Vector3(s.x, -2, s.z), q.setFromAxisAngle(up, (s.seed % 628) / 100), new THREE.Vector3(s.r, s.h, s.r)); rocks.setMatrixAt(i, mm); tops.setMatrixAt(i, mm); });
      this.scene.add(rocks, tops);
    }
    if (w.rocks.length) {
      const rg = new THREE.DodecahedronGeometry(1, 0); const im = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0x5d5a55, roughness: 1, flatShading: true }), w.rocks.length);
      w.rocks.forEach((s, i) => im.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(s.x, -0.2, s.z), q.setFromAxisAngle(up, s.seed % 6), new THREE.Vector3(s.r, s.h, s.r * 0.8))));
      this.scene.add(im);
    }
    // tàu bè theo tuyến
    for (const lane of w.lanes) {
      const g = bakeColored(shipFor(lane.kind));
      if (lane.kind === 'tau_khach' || lane.kind === 'cano') { const wk = wake(); wk.scale.setScalar(lane.kind === 'cano' ? 0.5 : 0.8); g.add(wk); }
      this.scene.add(g); this.fleet.push({ lane, obj: g, r: SHIP_R[lane.kind], x: 0, z: 0, yaw: 0, hornAt: 0, slow: 1, off: 0 });
    }
    // tàu của mình
    if (jet) { this.boat = bakeColored(jetSki(this.o.jetColor ?? 0xe63946)); const wk = wake(); wk.scale.set(0.28, 1, 0.42); wk.position.set(0, 0.05, 7.6); this.wakeM = wk; this.boat.add(wk); }
    else {
      const extra: THREE.Object3D[] = [];
      if (this.o.cargo) { const v = playerVehicle(this.o.cargo.group, this.o.cargo.color, { electric: this.o.cargo.electric }); v.root.scale.setScalar(0.9); v.root.position.set(-0.7, 1.27, -0.6); extra.push(v.root); }
      const f = carFerry(this.o.cargo ? 0 : 4); for (const e of extra) f.add(e);
      this.boat = bakeColored(f); const wk = wake(); this.wakeM = wk; this.boat.add(wk);
    }
    this.scene.add(this.boat);
    for (let i = 0; i < 4; i++) { const b = bird(); this.scene.add(b.root); this.birds.push({ b, a: i * 1.6, r: (jet ? 14 : 30) + i * 6, h: (jet ? 10 : 18) + i * 3, w: 0.35 + i * 0.07 }); }
  }
  private buoys: THREE.InstancedMesh | null = null;

  // ------------------------------------------------------------------ điều khiển (gọi từ giao diện)
  start() { this.running = true; }
  /** -1…1: lái sang trái/phải (giữ nút) */
  setRudder(v: number) { this.rudderIn = clamp(v, -1, 1); }
  /** Cần ga tàu: -1 lùi, 0 dừng máy, 1…4 = 1/4…hết máy. Mô tô nước dùng setGas/setBrake. */
  leverStep(d: number, fromKey = false) { if (this.o.mode === 'jetski') { if (fromKey) return; } this.lever = clamp(this.lever + d, -1, 4); this.auto = false; }
  setLever(n: number) { this.lever = clamp(Math.round(n), -1, 4); }
  setGas(v: number) { this.gas = clamp(v, 0, 1); if (v) this.auto = false; }
  setBrake(v: number) { this.brake = clamp(v, 0, 1); }
  setView(v: SeaView) { this.view = v; this.look.reset(); }
  setAuto(on: boolean) { this.auto = on; if (on && this.lever < 3) this.lever = 3; }
  /** Điểm đến tự đặt trên bản đồ (null = về bến đích / bến cho thuê). */
  setWaypoint(p: Pt | null) { this.wp = p; }
  get waypoint() { return this.wp; }
  horn() { this.beep(330, 0.55, 0.16); this.hornCd = 0.6; }
  ships(): SeaShip[] { return this.fleet.map((s) => ({ x: s.x, z: s.z, yaw: s.yaw, kind: s.lane.kind })); }
  othersList(): { x: number; z: number; name: string }[] { return [...this.others.values()].map((o) => ({ x: o.x, z: o.z, name: o.o.name })); }

  // ------------------------------------------------------------------ hiện diện
  private state(): PresenceIn | null {
    if (this.disposed) return null;
    return { scene: 'sea', key: this.o.presenceKey, x: Math.round(this.x * 10) / 10, z: Math.round(this.z * 10) / 10, yaw: Math.round(this.yaw * 100) / 100, speed: Math.round(Math.abs(this.v) * 10) / 10 };
  }
  private setOthers(list: PresenceOther[], local: number) {
    const keep = new Set<number>();
    for (const o of list) {
      if (o.x === undefined || o.z === undefined) continue; keep.add(o.id);
      let it = this.others.get(o.id);
      if (!it) {
        const g = new THREE.Group(), body = bakeColored(this.o.mode === 'jetski' ? jetSki(hexOf(o.vehicle?.color, 0x2a9d8f)) : carFerry()); g.add(body);
        const tag = nameTag(o, this.o.mode === 'jetski' ? 0.7 : 1.6); tag.position.set(0, this.o.mode === 'jetski' ? 3.2 : 8, 0); g.add(tag);
        this.scene.add(g); it = { o, obj: g, tag, x: o.x, z: o.z, yaw: o.yaw ?? 0, vx: 0, vz: 0, t0: local, px: o.x, pz: o.z };
        this.others.set(o.id, it);
      }
      const yaw = o.yaw ?? 0, sp = o.speed ?? 0, age = (o.ageMs ?? 0) / 1000;
      it.vx = Math.sin(yaw) * sp; it.vz = -Math.cos(yaw) * sp;
      it.px = o.x + it.vx * Math.min(2, age); it.pz = o.z + it.vz * Math.min(2, age); it.t0 = local; it.o = o; it.yaw = turnTo(it.yaw, yaw, 0.5);
      syncSay(it.obj, o, this.o.mode === 'jetski' ? 4.2 : 10, 1, this.o.mode === 'jetski' ? 0.9 : 1.6);
    }
    for (const [id, it] of this.others) if (!keep.has(id)) { it.obj.removeFromParent(); disposeTag(it.tag); dropSay(it.obj); this.others.delete(id); }
  }

  // ------------------------------------------------------------------ vòng lặp
  private windAt(t: number) { const a = 0.6 + Math.sin(t * 0.021) * 0.9 + Math.sin(t * 0.007 + 2) * 0.6, s = 0.7 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.033 + 1)); this.wind.dir = a; this.wind.spd = s; }
  private target(): { x: number; z: number; name: string } { return this.wp ? { x: this.wp[0], z: this.wp[1], name: 'Điểm đã chọn' } : this.w.goal; }
  private bumpLog: string[] = [];
  private bump(text: string, kind: 'bad' | 'good' | 'info') { this.bumpLog.push(`${Math.round(this.elapsed)}s ${text} @${Math.round(this.x)},${Math.round(this.z)}`); if (this.bumpLog.length > 20) this.bumpLog.shift(); this.o.onBump?.(text, kind); }
  private beep(freq: number, dur: number, vol: number) {
    try {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return; this.audio ??= new AC(); const a = this.audio; if (a.state === 'suspended') void a.resume();
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime; o.type = 'sawtooth'; o.frequency.value = freq;
      const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 3;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.05); g.gain.setValueAtTime(vol, t + dur - 0.08); g.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(f); f.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
    } catch { /* không có âm thanh */ }
  }

  private step(dt: number) {
    const sp = this.spec, w = this.w, jet = this.o.mode === 'jetski';
    this.elapsed += dt; this.bumpCd = Math.max(0, this.bumpCd - dt); this.hornCd = Math.max(0, this.hornCd - dt);
    this.windAt(this.elapsed + 37);
    let rud = this.rudderIn;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) rud -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) rud += 1;
    let want: number;
    const tg = this.target(), dx = tg.x - this.x, dz = tg.z - this.z, dist = Math.hypot(dx, dz);
    if (this.auto && !this.docking) {
      // tự lái: bám luồng gợi ý (điểm kế tiếp), tránh bờ; gần đích thì giảm máy
      const aim = this.autoAim(), bearing = angDiff(Math.atan2(aim[0] - this.x, -(aim[1] - this.z)), this.yaw);
      rud = clamp(bearing * 2.2, -1, 1);
      // né bờ phía trước: so khoảng cách tới bờ ở hai bên mũi
      const look = (a: number, d: number) => w.distAt(this.x + Math.sin(this.yaw + a) * d, this.z - Math.cos(this.yaw + a) * d);
      const ahead = Math.min(look(0, 25), look(0, 50));
      if (ahead < 18) rud = look(-0.6, 40) > look(0.6, 40) ? -1 : 1;
      // tàu khác chắn trước mũi: bẻ sang phải (quy tắc tránh va), giảm máy
      let shipAhead = false;
      for (const sh of this.fleet) { const rx = sh.x - this.x, rz = sh.z - this.z, fwd = rx * Math.sin(this.yaw) - rz * Math.cos(this.yaw), side = rx * Math.cos(this.yaw) + rz * Math.sin(this.yaw); if (fwd > 0 && fwd < 45 + sh.r * 2 && Math.abs(side) < sh.r + 8) { shipAhead = true; rud = Math.max(rud, side > 0 ? -0.3 : 0.8); } }
      const near = Math.hypot(this.w.goal.x - this.x, this.w.goal.z - this.z);
      want = (jet ? 0.7 * sp.vmax : sp.vmax * (near < 90 ? clamp(near / 140, 0.18, 1) : 0.9)) * clamp(1 - Math.abs(bearing) / 1.4, 0.3, 1) * (ahead < 18 ? 0.45 : 1) * (shipAhead ? 0.5 : 1);
    } else if (jet) { const g = Math.max(this.gas, this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0), b = Math.max(this.brake, this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0); want = g * sp.vmax - b * sp.rev; }
    else want = this.lever >= 0 ? (this.lever / 4) * sp.vmax : -sp.rev;
    if (this.docking) { want = 0; rud = 0; }
    if (this.hull < 35) want *= 0.6;
    // vùng phao mô tô nước: ra ngoài thì máy giảm và bị kéo về
    if (jet && w.zone) {
      const [u, v] = zoneUV(w.zone, this.x, this.z), out = Math.abs(u) > 1 || Math.abs(v) > 1;
      if (out && !this.zoneOut) this.bump('Ra ngoài vùng phao an toàn! Quay vào trong', 'bad');
      this.zoneOut = out;
      if (out) { want = Math.min(want, 6); const back: Pt = [w.zone.cx - this.x, w.zone.cz - this.z], L = Math.hypot(back[0], back[1]) || 1; this.x += (back[0] / L) * 3 * dt; this.z += (back[1] / L) * 3 * dt; }
    }
    this.rudder += (rud - this.rudder) * Math.min(1, dt * (jet ? 6 : 2.2));
    const a = (want - this.v) * sp.acc; this.v += a * dt; if (Math.abs(want) < 0.01 && Math.abs(this.v) < 0.05) this.v = 0;
    const grip = clamp(Math.abs(this.v) / sp.vref, 0.12, 1) * Math.sign(this.v || 1);
    this.yaw += this.rudder * sp.turn * grip * dt;
    // gió và dòng chảy đẩy tàu trôi nhẹ theo hướng gió
    const wx = Math.sin(this.wind.dir) * this.wind.spd * sp.drift, wz = -Math.cos(this.wind.dir) * this.wind.spd * sp.drift;
    const fx = Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    let nx = this.x + (fx * this.v + wx) * dt, nz = this.z + (fz * this.v + wz) * dt;
    // va chạm bờ / đá: lấy mẫu mũi, đuôi, hai mạn
    const pts: Pt[] = [[nx + fx * sp.len, nz + fz * sp.len], [nx - fx * sp.len * 0.8, nz - fz * sp.len * 0.8], [nx - fz * sp.half, nz + fx * sp.half], [nx + fz * sp.half, nz - fx * sp.half]];
    let hit = 0;
    for (const p of pts) { const k = gi(w, p[0], p[1]); if (k >= 0 && w.land[k]) { hit = w.land[k]; break; } }
    if (hit) {
      const aw = w.away(nx, nz); nx = this.x + aw[0] * 1.5; nz = this.z + aw[1] * 1.5;
      if (Math.abs(this.v) > 2.5 && this.bumpCd <= 0) { const dmg = Math.min(12, Math.round(Math.abs(this.v) * (jet ? 0.5 : 0.4))); this.hull = Math.max(10, this.hull - dmg); this.hits++; this.bumpCd = 1.2; this.bump(hit === 2 ? `Va vào đảo đá! Vỏ tàu −${dmg}%` : hit === 3 ? `Cạ đá ngầm! Vỏ tàu −${dmg}%` : `Chạm bờ! Vỏ tàu −${dmg}%`, 'bad'); }
      this.v *= -0.25;
    }
    // va chạm tàu khác
    for (const s of this.fleet) {
      const d = Math.hypot(s.x - nx, s.z - nz), rr = s.r + sp.half + 0.5;
      if (d < rr) {
        const ux = (nx - s.x) / (d || 1), uz = (nz - s.z) / (d || 1); nx = s.x + ux * rr; nz = s.z + uz * rr;
        if (Math.abs(this.v) > 2 && this.bumpCd <= 0) { const dmg = Math.min(10, Math.round(Math.abs(this.v) * 0.35)); this.hull = Math.max(10, this.hull - dmg); this.hits++; this.bumpCd = 1.2; this.bump(`Va phải ${SHIP_NAME[s.lane.kind].toLowerCase()}! Vỏ tàu −${dmg}%`, 'bad'); this.shipHorn(s, true); }
        this.v *= -0.3;
      }
    }
    this.odo += Math.hypot(nx - this.x, nz - this.z) / w.upk;
    this.x = clamp(nx, w.bounds.x0 + 20, w.bounds.x1 - 20); this.z = clamp(nz, w.bounds.z0 + 20, w.bounds.z1 - 20);
    // cập bến (tàu) / về bến cho thuê không cần — mô tô nước kết thúc bằng nút trả xe hoặc hết giờ
    if (!jet && !this.done) {
      const gd = Math.hypot(this.w.goal.x - this.x, this.w.goal.z - this.z);
      if (!this.docking && gd < 42 && Math.abs(this.v) < 9) { this.docking = 0.001; this.bump(`⚓ Cập ${this.w.goal.name}`, 'good'); }
      if (this.docking) {
        this.docking += dt; const k = Math.min(1, dt * 1.5); this.x += (this.w.goal.x - this.x) * k; this.z += (this.w.goal.z - this.z) * k; this.v *= 0.9;
        if (this.docking > 2.4) { this.done = true; this.o.onArrive?.({ seconds: Math.round(this.elapsed), hits: this.hits, hull: this.hull, km: Math.round(this.odo * 10) / 10 }); }
      }
    }
    void dist;
  }
  /** Tự lái: điểm ngắm trên luồng cách chỗ chiếu của tàu ~lookahead về phía đích (bám theo đường gấp khúc, không theo đỉnh). */
  private autoAim(): Pt {
    const g: Pt = [this.w.goal.x, this.w.goal.z];
    if (this.wp) return this.wp;
    const path = this.w.path; if (path.length < 2) return g;
    const toward = Math.hypot(path[path.length - 1][0] - g[0], path[path.length - 1][1] - g[1]) < 5 ? path : [...path].reverse();
    // chiếu vị trí tàu lên luồng
    let bestD = Infinity, bestS = 0, acc = 0;
    const segs: { a: Pt; b: Pt; L: number; s0: number }[] = [];
    for (let i = 0; i < toward.length - 1; i++) { const A = toward[i], B = toward[i + 1], L = Math.hypot(B[0] - A[0], B[1] - A[1]); segs.push({ a: A, b: B, L, s0: acc }); acc += L; }
    for (const sg of segs) { const dx = sg.b[0] - sg.a[0], dz = sg.b[1] - sg.a[1], t = clamp(((this.x - sg.a[0]) * dx + (this.z - sg.a[1]) * dz) / (sg.L * sg.L || 1), 0, 1), d = Math.hypot(sg.a[0] + dx * t - this.x, sg.a[1] + dz * t - this.z); if (d < bestD) { bestD = d; bestS = sg.s0 + t * sg.L; } }
    const s = Math.min(acc, bestS + 55 + Math.min(40, bestD));
    for (const sg of segs) if (s <= sg.s0 + sg.L) { const t = (s - sg.s0) / (sg.L || 1); return [sg.a[0] + (sg.b[0] - sg.a[0]) * t, sg.a[1] + (sg.b[1] - sg.a[1]) * t]; }
    return g;
  }
  private shipHorn(s: Ship, now = false) {
    const t = this.elapsed; if (!now && t - s.hornAt < 9) return; s.hornAt = t;
    const big = s.lane.kind === 'container' || s.lane.kind === 'hang_roi';
    if (s.lane.kind !== 'thung') this.beep(big ? 110 : s.lane.kind === 'tau_ca' ? 260 : 196, big ? 1.4 : 0.7, big ? 0.14 : 0.1);
  }

  private frame() {
    if (this.disposed) return;
    if (!this.quality.tick()) { if (!this.quality.throttled) this.last = 0; return; }
    const now = performance.now(), dt = stepDt(this.last ? (now - this.last) / 1000 : 0.016); this.last = now; this.t += dt;
    const fast = (globalThis as { __seaFast?: number }).__seaFast ?? 1;
    if (this.running && !this.done) for (let i = 0; i < Math.max(1, Math.round(fast)); i++) this.step(dt);
    const t = this.t, jet = this.o.mode === 'jetski';
    this.quality.busy = Math.abs(this.v) > 0.5;
    // tàu bè AI: vị trí theo đồng hồ chung, chỉ chậm lại tại máy mình khi mình chắn trước mũi
    const clock = Date.now() / 1000;
    for (const s of this.fleet) {
      const p = lanePos(s.lane, clock); const ahead = Math.hypot(p.x + Math.sin(p.yaw) * s.r * 2 - this.x, p.z - Math.cos(p.yaw) * s.r * 2 - this.z) < s.r * 2.2 + 6;
      s.slow += ((ahead ? 0 : 1) - s.slow) * Math.min(1, dt * 1.5); s.off = s.slow < 0.99 ? s.off + (1 - s.slow) * dt * s.lane.speed : Math.max(0, s.off - dt * s.lane.speed * 0.2);
      const q = s.off > 0.01 ? lanePos(s.lane, clock - s.off / Math.max(0.1, s.lane.speed)) : p;
      s.x = q.x; s.z = q.z; s.yaw = turnTo(s.yaw, q.yaw, Math.min(1, dt * 2));
      const far = Math.hypot(s.x - this.x, s.z - this.z); s.obj.visible = far < 1100;
      if (!s.obj.visible) continue;
      s.obj.position.set(s.x, s.lane.kind === 'thung' ? 0.1 + Math.sin(t * 2 + s.r) * 0.08 : Math.sin(t * 1.3 + s.x) * 0.15, s.z);
      s.obj.rotation.set(Math.sin(t * 1.1 + s.z) * 0.02, -s.yaw, Math.sin(t * 0.9 + s.x) * 0.03);
      if (s.lane.kind === 'thung') s.obj.rotation.y = t * 0.4 + s.r;
      if (ahead && far < 80) this.shipHorn(s);
    }
    // tàu người khác: ngoại suy rồi kéo mượt về vị trí tính được
    for (const it of this.others.values()) {
      const age = Math.min(3, (now - it.t0) / 1000), tx = it.px + it.vx * age, tz = it.pz + it.vz * age, k = Math.min(1, dt * 4);
      it.x += (tx - it.x) * k; it.z += (tz - it.z) * k;
      it.obj.position.set(it.x, Math.sin(t * 1.6 + it.x) * 0.12, it.z); it.obj.rotation.y = -it.yaw;
    }
    // tàu mình: nhấp nhô theo sóng, nghiêng khi bẻ lái
    const fx = Math.sin(this.yaw), fz = -Math.cos(this.yaw), spd = Math.abs(this.v) / this.spec.vmax;
    this.boat.position.set(this.x, jet ? 0.05 + Math.abs(Math.sin(t * 5.2)) * 0.18 * spd : Math.sin(t * 1.7) * 0.18 - 0.1, this.z);
    this.boat.rotation.set((jet ? -0.08 * spd : 0) + Math.sin(t * 1.9 + 1) * (jet ? 0.04 : 0.025), -this.yaw, -this.rudder * (jet ? 0.32 : 0.05) * Math.min(1, spd * 2) + Math.sin(t * 1.3) * (jet ? 0.03 : 0.04));
    if (this.wakeM) { (this.wakeM.material as THREE.MeshBasicMaterial).opacity = clamp(spd * 1.4, 0, 0.9); this.wakeM.visible = spd > 0.05; }
    for (const b of this.birds) { b.a += dt * b.w; b.b.root.position.set(this.x + Math.cos(b.a) * b.r, b.h + Math.sin(t * 0.7 + b.r) * 2, this.z + Math.sin(b.a) * b.r); b.b.root.rotation.y = -b.a; for (const wg of b.b.wings) wg.rotation.z = Math.sin(t * 7 + b.r) * 0.5 * (wg.position.x < 0 ? 1 : -1); }
    // phao nhấp nhô nhẹ (một lần vẽ, cập nhật thưa)
    if (this.buoys && Math.floor(t * 10) !== Math.floor((t - dt) * 10)) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3().setScalar(jet ? 0.7 : 1.5), p = new THREE.Vector3();
      this.w.buoys.forEach((b, i) => { e.set(Math.sin(t * 1.4 + i) * 0.1, 0, Math.cos(t * 1.2 + i) * 0.1); m.compose(p.set(b.x, Math.sin(t * 2 + i) * 0.15 - 0.2, b.z), q.setFromEuler(e), s); this.buoys!.setMatrixAt(i, m); });
      this.buoys.instanceMatrix.needsUpdate = true;
    }
    // máy quay
    this.look.update(dt);
    const sp = this.spec, yaw = this.yaw + this.look.yaw, pitch = this.look.pitch;
    let cd = sp.camD, ch = sp.camH, la = 2;
    if (this.view === 'far') { cd = sp.camD * 2.6; ch = sp.camH * 4.2; }
    const want = new THREE.Vector3(), look = new THREE.Vector3();
    if (this.view === 'bridge') {
      want.set(this.x + fx * (jet ? 0.2 : -2.5), jet ? 2.3 : 6.2, this.z + fz * (jet ? 0.2 : -2.5));
      look.set(want.x + Math.sin(yaw) * 40, want.y - 3 + pitch * -30, want.z - Math.cos(yaw) * 40);
    } else {
      const cy = Math.max(1.5, ch * (1 - pitch * 1.4));
      want.set(this.x - Math.sin(yaw) * cd, cy, this.z + Math.cos(yaw) * cd);
      look.set(this.x + fx * sp.len * la, jet ? 1.4 : 3, this.z + fz * sp.len * la);
    }
    if (!this.camInit) { this.camPos.copy(want); this.camLook.copy(look); this.camInit = true; }
    const kp = this.view === 'bridge' ? 1 : ease(jet ? 0.2 : 0.1, dt);
    this.camPos.lerp(want, kp); this.camLook.lerp(look, this.view === 'bridge' ? 1 : ease(0.25, dt));
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    this.sea.position.set(Math.round(this.x / 100) * 100, 0, Math.round(this.z / 100) * 100);
    this.decor.position.set(this.camPos.x, 0, this.camPos.z);
    this.seaM.uniforms.uT.value = t;
    this.renderer.render(this.scene, this.camera);
    // giao diện: 10 lần mỗi giây
    this.hudT -= dt;
    if (this.hudT <= 0 && this.o.onHud) {
      this.hudT = 0.1;
      const tg = this.target(), d = Math.hypot(tg.x - this.x, tg.z - this.z), brg = angDiff(Math.atan2(tg.x - this.x, -(tg.z - this.z)), this.yaw);
      this.o.onHud({ speed: Math.round(Math.abs(this.v) * sp.knots * 10) / 10, unit: jet ? 'kmh' : 'hl', heading: (((this.yaw * 180) / Math.PI) % 360 + 360) % 360, x: this.x, z: this.z, yaw: this.yaw,
        dist: Math.round(d), bearing: brg, targetName: tg.name, hull: this.hull, throttle: jet ? Math.round(this.gas * 4) : this.lever, rudder: this.rudder, wind: { ...this.wind }, view: this.view, auto: this.auto,
        zoneOut: this.zoneOut, docking: !!this.docking, elapsed: this.elapsed, hits: this.hits, km: Math.round(this.odo * 10) / 10 });
    }
  }
  private resize() { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.quality.resize(w, h); this.camera.aspect = w / h; this.camera.fov = w / h < 0.9 ? 62 : 50; this.camera.updateProjectionMatrix(); }
  /** Thông tin cho bộ kiểm tự động. */
  debug() { return { x: this.x, z: this.z, yaw: this.yaw, v: this.v, hull: this.hull, hits: this.hits, done: this.done, docking: this.docking, ships: this.fleet.length, others: this.others.size, draws: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles, bumps: [...this.bumpLog] }; }
  /** Bộ kiểm: dịch tới điểm (x, z). */
  teleport(x: number, z: number, yaw?: number) { this.x = x; this.z = z; if (yaw !== undefined) this.yaw = yaw; this.camInit = false; }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.link?.stop(); this.look.dispose(); this.renderer.setAnimationLoop(null); this.quality.dispose(); this.ro.disconnect();
    for (const f of this.cleanup) f();
    for (const it of this.others.values()) { disposeTag(it.tag); dropSay(it.obj); }
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry && !Object.values(GEO).includes(m.geometry as never)) m.geometry.dispose(); });
    void this.audio?.close().catch(() => {});
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
    if ((window as unknown as { __sea?: SeaScene }).__sea === this) delete (window as unknown as { __sea?: SeaScene }).__sea;
  }
}

function gi(w: SeaWorld, x: number, z: number) { const i = Math.floor((x - w.gx0) / w.cell), j = Math.floor((z - w.gz0) / w.cell); return i < 0 || j < 0 || i >= w.nx || j >= w.nz ? -1 : j * w.nx + i; }
function angDiff(a: number, b: number) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
function mulberry(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of list) { if (!g.attributes.normal) g.computeVertexNormals(); pos.set(g.attributes.position.array as Float32Array, o * 3); nor.set(g.attributes.normal.array as Float32Array, o * 3); o += g.attributes.position.count; g.dispose(); }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out;
}
export { IS_MOBILE };

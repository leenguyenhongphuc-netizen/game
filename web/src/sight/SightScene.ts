// Máy chạy cảnh đi bộ tham quan: dựng cảnh từ một bộ (set), nhân vật ĐI TỰ DO trên mọi mặt đất của cảnh (lưới đi bộ walkGrid.ts:
// tới mép nước, chân núi dốc, tường nhà thì dừng tự nhiên), máy quay cần lò xo + làm mờ vật chen giữa (camRig.ts),
// cột mốc điểm dừng xem theo thứ tự tuỳ ý, dẫn đường theo đường tìm được trên lưới, khách tham quan đi lại.
import * as THREE from 'three';
import { IS_MOBILE, Quality, debugScene, rendererParams, ease, stepDt, trace } from '../perf.ts';
import { bake } from '../scene/World.ts';
import { bakeColored } from '../scene/batch.ts';
/** Địa danh đã rà: vật sống chỉ chuyển động theo cả cụm nên gộp được. */
const COLLAPSE_LIVE = new Set(['dn_hoi_an']);
import { gradient } from '../drive/RideKit.ts';
import { Kit, V, ball, box, cyl, cone, glow, dot, walker, shopModel, cloud, label, infoBoard, bench, potPlant } from './SightKit.ts';
import type { PlayerState, SightSet, ShopSpot } from './SightKit.ts';
import { SETS } from './sets/index.ts';
import { WalkGrid } from './walkGrid.ts';
import { CamRig, applyCut, bvhOf, cutU, cutAmount, releaseCutCache } from './camRig.ts';
import { guide } from './guide.ts';
import type { Sight } from '../../../shared/sights.ts';

export interface SightHud { near: number | null; next: number; dist: number; bearing: number; yaw: number; /** Đang dẫn tới điểm chọn trên bản đồ. */ wp: boolean }
/** Điểm hiện trên bản đồ. */
export interface MapMarks { me: { x: number; z: number; heading: number }; stops: { x: number; z: number; name: string; seen: boolean }[]; shops: { x: number; z: number }[]; extras: { x: number; z: number; kind: string }[]; exit: { x: number; z: number }; wp: { x: number; z: number } | null; route: { x: number; z: number }[] }
export interface SightCallbacks { onNear: (index: number | null) => void; onHud: (h: SightHud) => void; onShop?: (index: number | null) => void }
export interface SightShop { id: string; name: string; kind: string; emoji: string }

const SPEED = 4.6, RADIUS = 4.2, BRIDGE = 1.5;

export class SightScene {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera: THREE.PerspectiveCamera;
  private set: SightSet; private kit: Kit; private raf = 0; private last = 0; private time = 0;
  private player = new THREE.Group(); private legs: THREE.Object3D[] = []; private arms: THREE.Object3D[] = []; private blob: THREE.Mesh;
  private state: PlayerState; private heading = 0; private yaw = 0; private pitch = 0.2; private moving = 0;
  private move = new THREE.Vector2(); private keys = new Set<string>();
  private cum: number[] = []; private total = 0;
  private markers: { ring: THREE.Mesh; beam: THREE.Mesh; num: THREE.Sprite; s: number }[] = [];
  private npcs: { g: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[]; s: number; dir: number; off: number; want: number; a: number; b: number; sp: number; ph: number }[] = [];
  private grid!: WalkGrid; private rig!: CamRig; private camY = 0; private armLen = 8; private camDist = 8; private shopAt: THREE.Vector3[] = []; private shopSolid: THREE.Vector3[] = []; private shopIdx: number | null = null;
  private postcard: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null; private userLook = 0; private skyTicks: ((t: number, dt: number) => void)[] = [];
  private nearIdx: number | null = null; private dismissed: number | null = null; private lookAt: THREE.Vector3 | null = null;
  private seen: Set<string>; private autoWait = 0; private hudT = 0; private disposed = false;
  auto = false; speedMul = 1;
  /** Bán kính kích hoạt của từng điểm dừng (m): tối thiểu 4,2; nới thêm khi có nhánh đường khác chạy sát bên để đứng ở nhánh đó vẫn mở được. */
  private trig: number[] = [];
  private goal: { p: THREE.Vector3; stop: number | null; route: THREE.Vector3[]; ri: number } | null = null; private vmag = 0; private lastHud = '';
  private tapStart: { x: number; y: number; t: number } | null = null;

  constructor(private host: HTMLElement, private sight: Sight, seen: string[], private cb: SightCallbacks, private shops?: SightShop[]) {
    this.seen = new Set(seen);
    this.renderer = new THREE.WebGLRenderer(rendererParams(host));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.quality = new Quality(this.renderer, { name: 'tham quan', onLevel: (l) => this.applyQuality(l) }); debugScene(this.scene);
    host.appendChild(this.renderer.domElement); this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.3, 900);
    this.kit = new Kit(hash(sight.id));
    this.set = (SETS[sight.id] ?? SETS[`kind:${sight.kind}`] ?? SETS['kind:pho_co'])(this.kit, sight);
    const s = this.set;
    this.scene.background = gradient(s.sky[0], s.sky[1]); this.scene.fog = new THREE.Fog(s.fog[0], s.fog[1], s.fog[2]); this.applyQuality(this.quality.level);
    this.scene.add(new THREE.HemisphereLight(s.light.ambientColor ?? 0xffffff, 0x8a7a66, s.light.ambient));
    const sun = new THREE.DirectionalLight(s.light.sunColor ?? 0xfff2d6, s.light.sun); sun.position.set(...(s.light.sunDir ?? [0.5, 1, 0.35])); this.scene.add(sun);
    const sd = s.light.sunDir ?? [0.5, 1, 0.35];
    const fill = new THREE.DirectionalLight(s.light.ambientColor ?? 0xffffff, s.fill ?? 0.45); fill.position.set(-sd[0], 0.5, -sd[2]); this.scene.add(fill);
    this.cum = [0]; for (let i = 1; i < s.path.length; i++) this.cum.push(this.cum[i - 1] + s.path[i].distanceTo(s.path[i - 1])); this.total = this.cum[this.cum.length - 1];
    this.trig = s.stops.map((st) => { const o = this.otherLeg(st.at); return o < 8 ? Math.min(9, Math.max(RADIUS, o + s.half + 0.6)) : RADIUS; });
    (window as unknown as { __sightScene?: SightScene }).__sightScene = this;
    host.addEventListener('pointerdown', this.onTapDown, true); host.addEventListener('pointerup', this.onTapUp, true);
    this.furnish();
    // Vật "sống" chỉ chuyển động theo cả cụm (thuyền dập dềnh…): gộp các khối màu trơn bên trong từng cụm để mỗi cụm còn vài lần vẽ.
    if (COLLAPSE_LIVE.has(this.sight.id)) for (const child of [...this.kit.dyn.children]) {
      if (!(child as THREE.Group).isGroup || child.userData.keepParts) continue;
      const parts: THREE.Mesh[] = []; child.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !Array.isArray(m.material) && !(m.material as THREE.MeshStandardMaterial).map && !(m.material as THREE.Material).transparent) parts.push(m); });
      if (parts.length < 4) continue;
      child.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(child.matrixWorld).invert(), tmp = new THREE.Group();
      for (const m of parts) { const c = new THREE.Mesh(m.geometry, m.material); c.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); tmp.add(c); m.removeFromParent(); }
      for (const m of [...bakeColored(tmp, false).children]) child.add(m);
    }
    this.buildWalk();
    this.buildSky();
    // chiều dài cộng dồn của lối đi
    this.cum = [0]; for (let i = 1; i < s.path.length; i++) this.cum.push(this.cum[i - 1] + s.path[i].distanceTo(s.path[i - 1])); this.total = this.cum[this.cum.length - 1];
    this.buildPlayer(); this.buildMarkers(); this.buildNpcs(Math.round((s.npcs ?? 8) * (IS_MOBILE ? 0.6 : 1))); this.buildShops();
    const p0 = s.path[0].clone();
    this.state = { pos: p0, s: 0, seg: 0, near: null }; this.camY = p0.y; this.gy = p0.y;
    const d0 = s.path[1].clone().sub(s.path[0]); this.heading = Math.atan2(d0.x, -d0.z); this.yaw = s.startYaw ?? this.heading;
    this.blob = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })); this.scene.add(this.blob);
    this.scene.add(this.player);
    this.resize(); this.placeCamera(true);
    window.addEventListener('resize', this.resize); window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey);
    this.last = performance.now(); this.raf = requestAnimationFrame(this.frame);
  }

  private buildPlayer() {
    const body = new THREE.Group();
    body.add(cyl(0x3f7fbf, 0, 1.06, 0, 0.3, 0.7, 0.23), ball(0x3f7fbf, 0, 1.4, 0, 0.31, 0.16, 0.24), ball(0xf2c69c, 0, 1.7, 0, 0.3), cone(0xf3e2ae, 0, 2.02, 0, 0.66, 0.36), cyl(0xe9d28f, 0, 1.86, 0, 0.66, 0.03), box(0xc0281e, 0, 1.2, 0.26, 0.4, 0.46, 0.2));
    this.player.add(bake(body));
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(sx * 0.14, 0.78, 0); leg.add(bake(new THREE.Group().add(cyl(0x4a5160, 0, -0.38, 0, 0.11, 0.78), box(0x6b4a2c, 0, -0.76, -0.06, 0.2, 0.1, 0.34)))); this.legs.push(leg);
      const arm = new THREE.Group(); arm.position.set(sx * 0.38, 1.36, 0); arm.add(bake(new THREE.Group().add(cyl(0x3f7fbf, 0, -0.24, 0, 0.085, 0.5), ball(0xf2c69c, 0, -0.52, 0, 0.1)))); this.arms.push(arm);
      this.player.add(leg, arm);
    }
  }
  private buildMarkers() {
    const ringG = new THREE.RingGeometry(0.9, 1.25, 28).rotateX(-Math.PI / 2), beamG = new THREE.CylinderGeometry(0.5, 0.9, 5, 14, 1, true);
    this.set.stops.forEach((st, i) => {
      const done = this.seen.has(st.id);
      const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: done ? 0x7ccf4f : 0xffd23f, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide })); ring.position.copy(st.at).y += 0.12;
      const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: done ? 0x9be07a : 0xffe680, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); beam.position.copy(st.at).y += 2.5;
      const num = numberSprite(i + 1, done); num.position.copy(st.at).y += 3.4;
      const zone = new THREE.Mesh(new THREE.RingGeometry(RADIUS - 0.12, RADIUS, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); zone.position.copy(st.at).y += 0.1; this.scene.add(zone);
      this.scene.add(ring, beam, num); this.markers.push({ ring, beam, num, s: this.project(st.at).s });
    });
  }
  private buildNpcs(n: number) {
    const r = this.kit.r;
    for (let i = 0; i < n; i++) {
      const w = walker(i + 1), g = new THREE.Group(), body = w.g.children[0]; g.add(bake(body));
      const legs = w.legs.map((l) => { const h = new THREE.Group(); h.position.copy(l.position); l.position.set(0, 0, 0); h.add(bake(l)); g.add(h); return h; });
      const arms = w.arms.map((l) => { const h = new THREE.Group(); h.position.copy(l.position); l.position.set(0, 0, 0); h.add(bake(l)); g.add(h); return h; });
      const a = r() * this.total * 0.9, b = Math.min(this.total, a + 14 + r() * 30), off = (r() - 0.5) * 2 * (this.set.half - 0.6);
      this.npcs.push({ g, legs, arms, s: a + r() * (b - a), dir: r() < 0.5 ? 1 : -1, off, want: off, a, b, sp: 0.9 + r() * 0.8, ph: r() * 6 }); this.scene.add(g);
    }
  }
  /** Mỗi điểm dừng có bảng thuyết minh ở mép lối đi, đối diện là ghế nghỉ hoặc chậu hoa — như ở các khu di tích thật. */
  private furnish() {
    const s = this.set;
    s.stops.forEach((st, i) => {
      const pr = this.project(st.at), a = this.at(Math.min(this.total, pr.s + 1.4)), nx = -a.dir.z, nz = a.dir.x;
      // bảng đặt ở phía đối diện với công trình cần nhìn để không che tầm mắt
      const side = st.look ? ((st.look.x - a.p.x) * nx + (st.look.z - a.p.z) * nz > 0 ? -1 : 1) : (i % 2 ? 1 : -1), off = s.half + 0.7;
      const b = infoBoard(); b.position.set(a.p.x + nx * off * side, a.p.y, a.p.z + nz * off * side); b.rotation.y = Math.atan2(-nx * side, -nz * side); this.kit.add(b);
      const o = i % 2 ? bench(0x8d8478) : potPlant([0xe85aa0, 0xffd23f, 0xf3ead2][i % 3], 1.3), c = this.at(Math.max(0, pr.s - 3.4));
      o.position.set(c.p.x + (-c.dir.z) * off * side, c.p.y, c.p.z + c.dir.x * off * side); o.rotation.y = Math.atan2(c.dir.x, c.dir.z); this.kit.add(o);
    });
  }
  /** Lưới đi bộ tự do, phân lớp vật cứng / vật làm mờ cho máy quay, rồi gộp lưới để vẽ. */
  private buildWalk() {
    const s = this.set, st = this.kit.stat; st.updateMatrixWorld(true);
    // vùng khám phá: bao lối đi, điểm dừng, quầy, nới thêm 60 m mỗi phía (tối đa 440 m mỗi chiều quanh tâm)
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of [...s.path, ...s.stops.map((x) => x.at)]) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const M = 60, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hw = Math.min(220, (x1 - x0) / 2 + M), hd = Math.min(220, (z1 - z0) / 2 + M);
    const meshes: THREE.Mesh[] = []; st.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !(o as THREE.InstancedMesh).isInstancedMesh) meshes.push(m); });
    const t0 = performance.now();
    this.grid = new WalkGrid({ x0: cx - hw, z0: cz - hd, x1: cx + hw, z1: cz + hd }); this.grid.build(meshes, (x, z) => this.project(this.tmp2.set(x, 0, z)).q.y); this.grid.seedPath(s.path, s.half);
    // phân lớp: vật ở trên cao (mái, tán, biển treo) → làm mờ khi đứng dưới; vật mảnh (cột, thân cây) → làm mờ khi chen giữa;
    // còn lại (tường, nhà, vách, đồi, nền) là vật cứng để cần lò xo co lại
    const over: THREE.Mesh[] = [], solid: THREE.Mesh[] = [], b = new THREE.Box3(), sz = new THREE.Vector3(), c = new THREE.Vector3();
    for (const m of meshes) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      b.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld); b.getSize(sz); b.getCenter(c);
      const g = this.grid.height(c.x, c.z, b.min.y, 4) ?? this.project(c).q.y;
      if (b.min.y > g + 1.4 && sz.y < 7) over.push(m);
      else if (!(Math.max(sz.x, sz.z) < 0.8 && sz.y > 0.9) && Math.max(sz.x, sz.y, sz.z) >= 0.9) solid.push(m);
    }
    this.rig = new CamRig(bvhOf(solid), bvhOf(over));
    const top = new THREE.Group(); for (const m of over) top.attach(m);
    const main = bake(st), roof = bake(top); applyCut(main, false); applyCut(roof, true); this.roofGroup = roof;
    this.scene.add(main, roof, this.kit.dyn);
    (window as unknown as { __walkInfo?: unknown }).__walkInfo = { ms: Math.round(performance.now() - t0), cells: this.grid.count(), w: this.grid.width, d: this.grid.depth, solid: solid.length, over: over.length };
  }
  /** Tỉ lệ (0..1) của đoạn từ a tới b còn thông trước khi chạm vật cứng. */
  private clear(a: THREE.Vector3, b: THREE.Vector3): number {
    const d = b.clone().sub(a), l = d.length(); if (l < 1e-6) return 1; d.divideScalar(l);
    return Math.min(1, this.rig.hit(a, d, l) / l);
  }
  private buildSky() {
    const s = this.set; if (s.skyDecor === 'none') return;
    const c = new THREE.Color(s.sky[0]), lum = c.r * 0.3 + c.g * 0.6 + c.b * 0.1, r = this.kit.r, mid = s.path[Math.floor(s.path.length / 2)];
    if (lum < 0.3) {
      // trời tối: sao và trăng
      const n = 260, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const a = r() * 6.283, e = 0.12 + r() * 1.3, R = 620; pos.set([mid.x + Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, mid.z + Math.sin(a) * Math.cos(e) * R], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff6d8, size: 2.2, sizeAttenuation: false, map: dot(), transparent: true, depthWrite: false, fog: false })); stars.frustumCulled = false; this.scene.add(stars);
      const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot(), color: 0xfff3c4, transparent: true, depthWrite: false, fog: false })); moon.scale.setScalar(70); moon.position.set(mid.x - 260, 330, mid.z - 420); this.scene.add(moon);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(15, 20), new THREE.MeshBasicMaterial({ color: 0xfffbe6, fog: false })); disc.position.copy(moon.position); disc.lookAt(mid.x, 0, mid.z); this.scene.add(disc);
    }
    if (lum >= 0.18) {
      // trời còn sáng: mây trôi chậm và vài cánh chim
      const hz = new THREE.Color(s.sky[1]), tint = hz.r > hz.b * 1.15 ? 0xf6b8a0 : 0xffffff, clouds: THREE.Object3D[] = [], holder = new THREE.Group();
      for (let i = 0; i < 9; i++) { const cl = cloud(2.2 + r() * 2.6, tint); cl.position.set(mid.x + (r() - 0.5) * 760, 95 + r() * 70, mid.z + (r() - 0.5) * 760); holder.add(cl); }
      const baked = bake(holder); baked.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = new THREE.MeshBasicMaterial({ color: tint, fog: false, transparent: true, opacity: 0.86 }); } }); this.scene.add(baked); clouds.push(baked);
      const birds: THREE.Group[] = [];
      for (let i = 0; i < 5; i++) { const b = new THREE.Group(), wl = box(0x2a2a2a, -0.5, 0, 0, 1, 0.05, 0.3), wr = box(0x2a2a2a, 0.5, 0, 0, 1, 0.05, 0.3); b.add(wl, wr); b.userData = { a: r() * 6.28, R: 30 + r() * 50, h: 22 + r() * 16, sp: 0.12 + r() * 0.1, wl, wr }; birds.push(b); this.scene.add(b); }
      this.skyTicks.push((t) => { baked.position.x = Math.sin(t * 0.01) * 40; for (const b of birds) { const u = b.userData as { a: number; R: number; h: number; sp: number; wl: THREE.Mesh; wr: THREE.Mesh }, a = u.a + t * u.sp; b.position.set(mid.x + Math.cos(a) * u.R, mid.y + u.h, mid.z + Math.sin(a) * u.R); b.rotation.y = -a; const f = Math.sin(t * 7 + u.a) * 0.6; u.wl.rotation.z = -f; u.wr.rotation.z = f; } });
    }
  }
  /** Quầy chỉ khai báo vị trí: tự quay mặt về phía lối đi. */
  private faceLane(at: THREE.Vector3): ShopSpot { const q = this.project(at).q; return { at, ry: Math.atan2(q.x - at.x, q.z - at.z) }; }
  /** Đặt quầy hàng: theo chỗ bộ cảnh khai báo, thiếu thì rải ở mép lối đi. */
  private buildShops() {
    const s = this.set, list: SightShop[] = this.shops && this.shops.length ? this.shops : [{ id: '', name: 'Nước mía', kind: 'nuoc_mia', emoji: '🥤' }, { id: '', name: 'Hàng rong', kind: 'hang_rong', emoji: '🧺' }];
    const spots: ShopSpot[] = (s.shopSpots ?? []).map((q) => (q as THREE.Vector3).isVector3 ? this.faceLane(q as THREE.Vector3) : q as ShopSpot);
    for (let i = spots.length; i < list.length; i++) {
      // tự rải: tránh sát điểm dừng, đặt ở mép lối đi, quay mặt vào lối
      let sAt = this.total * ((i + 0.5) / list.length) * 0.86 + 6; for (let k = 0; k < 8 && this.markers.some((m) => Math.abs(m.s - sAt) < 7); k++) sAt += 5;
      for (let k = 0; k < 12 && Math.abs(this.at(sAt).dir.y) > 0.12; k++) sAt = Math.min(this.total - 4, sAt + 4); // không đặt quầy trên bậc thang, dốc
      const a = this.at(sAt), side = i % 2 ? 1 : -1, nx = -a.dir.z, nz = a.dir.x, off = s.half + 0.9;
      spots.push({ at: new THREE.Vector3(a.p.x + nx * off * side, a.p.y, a.p.z + nz * off * side), ry: Math.atan2(-nx * side, -nz * side) });
    }
    list.forEach((sh, i) => {
      const sp = spots[i]; if (!sp) return;
      const g = bake(shopModel(sh.kind, this.kit.r)); g.position.copy(sp.at); g.rotation.y = sp.ry ?? 0; this.scene.add(g);
      const lb = label(`${sh.name}`, sp.at.x, sp.at.y + 3.3, sp.at.z, '#2f7d26', 0.42); this.scene.add(lb);
      this.shopAt.push(sp.at.clone()); this.shopSolid.push(sp.at.clone());
    });
    if (!(this.shops && this.shops.length)) this.shopAt = [];
  }
  /** Điểm trên lối đi ứng với quãng s. */
  private at(s: number, out = new THREE.Vector3()): { p: THREE.Vector3; dir: THREE.Vector3; seg: number } {
    const path = this.set.path; s = Math.min(this.total, Math.max(0, s)); let i = 0; while (i < this.cum.length - 2 && this.cum[i + 1] < s) i++;
    const len = this.cum[i + 1] - this.cum[i] || 1; out.copy(path[i]).lerp(path[i + 1], (s - this.cum[i]) / len);
    return { p: out, dir: path[i + 1].clone().sub(path[i]).normalize(), seg: i };
  }
  /** Chiếu một điểm lên lối đi (theo mặt bằng); ưu tiên đoạn gần đoạn đang đứng để không nhảy tầng. */
  private project(p: THREE.Vector3, prefer = -1): { s: number; q: THREE.Vector3; d: number; seg: number } {
    const path = this.set.path; let best = { s: 0, q: path[0].clone(), d: 1e9, seg: 0 };
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-6;
      const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)), qx = a.x + dx * t, qz = a.z + dz * t, qy = a.y + (b.y - a.y) * t;
      let d = Math.hypot(p.x - qx, p.z - qz); if (prefer >= 0) d += Math.abs(i - prefer) > 1 ? Math.abs(qy - p.y) * 1.5 + (Math.abs(i - prefer) > 2 ? 0.6 : 0) : 0;
      if (d < best.d) best = { s: this.cum[i] + (this.cum[i + 1] - this.cum[i]) * t, q: new THREE.Vector3(qx, qy, qz), d, seg: i };
    }
    return best;
  }

  /** Khoảng cách từ p tới nhánh đường KHÁC (cách xa theo quãng đường) gần nhất; không có thì vô cực. */
  private otherLeg(p: THREE.Vector3): number {
    const path = this.set.path, own = this.project(p).s; let best = 1e9;
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i], b = path[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-6;
      const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / l2)), sAt = this.cum[i] + (this.cum[i + 1] - this.cum[i]) * t;
      if (Math.abs(sAt - own) < 14 || Math.abs(a.y + (b.y - a.y) * t - p.y) > 2.5) continue;
      best = Math.min(best, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
    }
    return best;
  }
  /** Điểm (x, z) có đứng được ở gần cao độ y không (lưới đi bộ tự do). */
  private walkable(x: number, y: number, z: number): boolean { return this.grid.height(x, z, y, 1.0) !== null; }
  /** Tự đi tới một điểm trên mặt đất: tìm đường trên lưới đi bộ (vòng qua nhà, tường, mép nước). */
  walkTo(point: { x: number; y?: number; z: number }) {
    const t = this.grid.nearest(point.x, point.z, point.y ?? this.state.pos.y, 8); if (!t) return;
    const r = this.grid.route(this.state.pos, t); this.goal = { p: t, stop: null, route: r ?? [t], ri: 0 };
  }
  /** Tự đi tới điểm dừng thứ i (bỏ trống: điểm kế tiếp chưa xem). */
  walkToStop(i?: number) {
    const stops = this.set.stops; let k = i ?? stops.findIndex((x) => !this.seen.has(x.id)); if (k < 0) k = stops.length - 1; k = Math.max(0, Math.min(stops.length - 1, k));
    if (this.dismissed === k) this.dismissed = null; const at = stops[k].at.clone(), r = this.grid.route(this.state.pos, at); this.goal = { p: at, stop: k, route: r ?? [at], ri: 0 };
  }
  cancelWalk() { this.goal = null; }
  private onTapDown = (e: PointerEvent) => { this.tapStart = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  private onTapUp = (e: PointerEvent) => {
    const t = this.tapStart; this.tapStart = null; if (!t || performance.now() - t.t > 320 || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 9) return;
    if ((e.target as HTMLElement | null)?.closest?.('button, a, input, [role="dialog"]')) return;
    const r = this.renderer.domElement.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    // chạm trúng cột mốc (tính theo màn hình) thì đi tới điểm dừng đó
    const v = new THREE.Vector3(); let hit = -1, hd = 56;
    this.markers.forEach((m, i) => { for (const y of [0.2, 2.2, 3.4]) { v.copy(this.set.stops[i].at); v.y += y; if (v.distanceTo(this.camera.position) > 70) return; v.project(this.camera); if (v.z > 1) return; const d = Math.hypot((v.x * 0.5 + 0.5) * r.width + r.left - e.clientX, (-v.y * 0.5 + 0.5) * r.height + r.top - e.clientY); if (d < hd) { hd = d; hit = i; } } });
    if (hit >= 0) { this.walkToStop(hit); return; }
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const g = new THREE.Vector3(); if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.state.pos.y), g) && g.distanceTo(this.state.pos) < 60) this.walkTo(g);
  };
  /** Soát bộ cảnh: mỗi điểm dừng phải nằm trong lối đi và mở được khi đứng trên lối. Trả danh sách lỗi (rỗng là đạt). */
  audit(): string[] {
    const out: string[] = [], s = this.set;
    s.stops.forEach((st) => { if (this.grid.height(st.at.x, st.at.z, st.at.y, 1.5) === null) out.push(`${st.id}: cột mốc không nằm trên đất đi được`); });
    return out;
  }
  triggers() { return this.trig.slice(); }

  setMove(x: number, y: number) { this.move.set(x, y); if (x * x + y * y > 0.01) this.goal = null; }
  private spinLeft = 0; private spinRate = 0; private spinDone: (() => void) | null = null;
  /** Lia máy quay trọn một vòng trong `seconds` giây, mượt theo khung hình; 0 = dừng. */
  spin(seconds: number, done?: () => void) { this.spinLeft = seconds > 0 ? Math.PI * 2 : 0; this.spinRate = seconds > 0 ? (Math.PI * 2) / seconds : 0; this.spinDone = done ?? null; this.lookAt = null; this.postcard = null; }
  /** Kéo xoay máy quay: góc dồn vào hàng chờ rồi nhả dần theo khung (quán tính nhẹ, không giật theo nhịp sự kiện chạm). */
  look(dx: number, dy: number) { this.lookYaw += dx; this.lookPitch += dy; this.lookIdle = 0; this.lookCount++; this.lookAt = null; this.postcard = null; }
  private lookYaw = 0; private lookPitch = 0; private lookIdle = 99; private gy = 0;
  /** Số lần người chơi tự kéo xoay (camera-qa đọc để phân biệt xoay do người chơi). */
  lookCount = 0;
  private onKey = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (e.type === 'keydown') this.keys.add(k); else this.keys.delete(k); };
  private keyMove(): THREE.Vector2 {
    const k = this.keys, v = new THREE.Vector2((k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0), (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0));
    return v.lengthSq() > 1 ? v.normalize() : v;
  }
  markSeen(index: number) {
    const st = this.set.stops[index]; if (!st) return; this.seen.add(st.id);
    const m = this.markers[index]; (m.ring.material as THREE.MeshBasicMaterial).color.set(0x7ccf4f); (m.beam.material as THREE.MeshBasicMaterial).color.set(0x9be07a);
  }
  /** Đóng thẻ thuyết minh: không mở lại cho tới khi đi ra xa rồi quay lại. */
  dismiss() { this.dismissed = this.nearIdx; this.lookAt = null; this.postcard = null; }
  /** Đưa nhân vật tới sát một điểm dừng (dùng cho thử nghiệm). */
  goto(index: number) {
    const st = this.set.stops[Math.max(0, Math.min(this.set.stops.length - 1, index))]; const pr = this.project(st.at), back = this.at(Math.max(0, pr.s - 1.6));
    this.state.pos.copy(back.p); this.gy = back.p.y; this.camY = back.p.y; this.state.seg = back.seg; this.state.s = pr.s - 1.6; this.heading = Math.atan2(back.dir.x, -back.dir.z); this.yaw = this.heading; this.dismissed = null; this.nearIdx = null;
    this.step(0.016); if (this.lookAt) { this.yaw = Math.atan2(this.lookAt.x - this.state.pos.x, -(this.lookAt.z - this.state.pos.z)); for (let i = 0; i < 40; i++) this.step(0.05); } this.placeCamera(true); this.renderer.render(this.scene, this.camera);
  }
  pos() { return { x: this.state.pos.x, y: this.state.pos.y, z: this.state.pos.z, s: this.state.s, total: this.total }; }
  // ---- dùng cho người chơi khác cùng cảnh (SightOthers.ts) và khu vui chơi (park/)
  /** Cảnh three.js để gắn thêm người chơi khác. */
  get world(): THREE.Scene { return this.scene; }
  /** Hàm gọi mỗi khung trước khi vẽ (cập nhật người chơi khác…). */
  readonly extraTicks: ((t: number, dt: number) => void)[] = [];
  /** Tư thế nhân vật mình để gửi cho người khác: yaw = atan2(dx, dz) của hướng mặt (cùng quy ước với người làng, makeFarmer). */
  pose() { return { x: this.state.pos.x, z: this.state.pos.z, yaw: Math.PI - this.heading, walk: this.moving > 0.3 }; }
  /** Điểm trên lối đi ở quãng s (m) và hướng đi tại đó. */
  pathAt(s: number) { const a = this.at(Math.max(0, Math.min(this.total, s))); return { x: a.p.x, y: a.p.y, z: a.p.z, dx: a.dir.x, dz: a.dir.z }; }
  get pathLength() { return this.total; }
  get halfWidth() { return this.set.half; }
  /** Quãng s của từng điểm dừng trên lối đi. */
  stopS(): number[] { return this.markers.map((m) => m.s); }
  /** Cao độ mặt đường gần (x, z) nhất. */
  groundY(x: number, z: number): number { return this.grid.height(x, z, this.state.pos.y, 3) ?? this.project(this.tmp2.set(x, this.state.pos.y, z), this.state.seg).q.y; }
  private tmp2 = new THREE.Vector3();
  /** Tạm dừng vẽ (khi đang chơi hoạt cảnh trò chơi ở lớp trên) để đỡ tốn pin. */
  paused = false;
  /** Chụp màn hình cảnh hiện tại (ảnh chung với người chơi khác). */
  capture(): string { this.renderer.render(this.scene, this.camera); return this.renderer.domElement.toDataURL('image/jpeg', 0.82); }
  info() { const i = this.renderer.info.render; return { calls: i.calls, triangles: i.triangles }; }
  /** Ảnh lưu niệm thật của khung hiện tại: vẽ vào render target (sRGB) rồi đọc điểm ảnh — không phụ thuộc bộ đệm canvas
   *  (iOS Safari xoá bộ đệm sau mỗi khung nên toDataURL hay ra ảnh trắng). Trả JPEG nhỏ (~20–40 KB). */
  photo(w = 360): string {
    const asp = this.camera.aspect, h = Math.round(w * (asp < 1 ? 4 / 3 : 3 / 4)), cam = this.camera.clone();
    cam.aspect = w / h; cam.updateProjectionMatrix();
    const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
    const r = this.renderer; r.setRenderTarget(rt); r.render(this.scene, cam); const px = new Uint8Array(w * h * 4); r.readRenderTargetPixels(rt, 0, 0, w, h, px); r.setRenderTarget(null); rt.dispose();
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!, img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); // lật dọc
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
    g.putImageData(img, 0, 0); return c.toDataURL('image/jpeg', 0.72);
  }

  private step(dt: number) {
    const st = this.state, s = this.set; let mv = this.move.clone().add(this.keyMove()); if (mv.lengthSq() > 1) mv.normalize();
    if (mv.lengthSq() > 0.0025) this.goal = null;
    let wantYaw: number | null = null;
    if (this.auto && this.nearIdx === null && !this.goal) {
      // tự đi dọc tuyến: hướng tới điểm phía trước trên lối đi
      const target = this.at(st.s + 2.5).p, dx = target.x - st.pos.x, dz = target.z - st.pos.z, l = Math.hypot(dx, dz);
      if (l > 0.05 && st.s < this.total - 0.3) { const ang = Math.atan2(dx, -dz) - this.yaw; mv = new THREE.Vector2(Math.sin(ang), Math.cos(ang)); }
    } else if (this.goal) {
      // tự đi tới chỗ đã chọn theo đường tìm trên lưới đi bộ
      const g = this.goal, gd = Math.hypot(g.p.x - st.pos.x, g.p.z - st.pos.z);
      if (gd < 0.45 || (g.stop !== null && (this.nearIdx === g.stop || this.seen.has(s.stops[g.stop].id) && gd < 1.2))) this.goal = null;
      else {
        while (g.ri < g.route.length - 1 && Math.hypot(g.route[g.ri].x - st.pos.x, g.route[g.ri].z - st.pos.z) < 0.7) g.ri++;
        const tg = g.route[g.ri], ang = Math.atan2(tg.x - st.pos.x, -(tg.z - st.pos.z)) - this.yaw, k = Math.min(1, gd / 1.4 + 0.3);
        mv = new THREE.Vector2(Math.sin(ang) * k, Math.cos(ang) * k); wantYaw = ang + this.yaw;
      }
    }
    const sp = Math.min(1, mv.length()), blocked = this.nearIdxBlocking();
    // tốc độ có gia tốc, giảm tốc: không giật khi cần gạt nhảy bậc
    this.vmag += ((sp > 0.05 && !blocked ? sp : 0) - this.vmag) * (1 - Math.exp(-dt * 9));
    this.moving += ((sp > 0.05 ? 1 : 0) - this.moving) * (1 - Math.exp(-dt * 10));
    if (sp > 0.05 && !blocked) this.moveAng = this.yaw + Math.atan2(mv.x, mv.y);
    if (this.vmag > 0.02 && !blocked) {
      // đi tự do: chia bước nhỏ, mỗi bước thử thẳng rồi trượt theo trục x hoặc z khi vướng (men theo tường, bờ nước)
      const ang = this.moveAng, v = SPEED * this.vmag * this.speedMul * dt, n = Math.max(1, Math.ceil(v / 0.2)), dx = Math.sin(ang) * v / n, dz = -Math.cos(ang) * v / n;
      // quầy hàng dựng sau lưới đi bộ: chặn riêng bằng vòng tròn quanh quầy (không đi xuyên quầy)
      const canStep = (x: number, z: number, y: number) => { for (const q of this.shopSolid) if ((x - q.x) ** 2 + (z - q.z) ** 2 < 1.35 * 1.35 && Math.abs(q.y - y) < 2.5) return null; return this.grid.canStep(x, z, y); };
      for (let i = 0; i < n; i++) {
        let h = canStep(st.pos.x + dx, st.pos.z + dz, this.gy);
        if (h !== null) { st.pos.x += dx; st.pos.z += dz; this.gy = h; continue; }
        h = Math.abs(dx) > 1e-5 ? canStep(st.pos.x + dx, st.pos.z, this.gy) : null; if (h !== null) { st.pos.x += dx; this.gy = h; continue; }
        h = Math.abs(dz) > 1e-5 ? canStep(st.pos.x, st.pos.z + dz, this.gy) : null; if (h !== null) { st.pos.z += dz; this.gy = h; continue; }
        break;
      }
      const pr = this.project(st.pos, st.seg); st.s = pr.s; st.seg = pr.seg;
      let dh = ang - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); this.heading += dh * (1 - Math.exp(-dt * 12));
      // máy quay chỉ tự về sau lưng khi người chơi thôi kéo xoay một lúc; quay chậm, tối đa ~3°/khung (60 hình/giây) — không quay ngoắt
      if (!this.lookAt && this.lookIdle > 2.5 && this.vmag > 0.3) {
        let dy = (wantYaw ?? this.heading) - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        if (Math.abs(dy) < 2.6) { const lim = 0.05 * dt * 60, a = Math.max(-lim, Math.min(lim, dy * (1 - Math.exp(-dt * (this.auto || this.goal ? 1.6 : 0.9))))); this.yaw += a; }
        this.pitch += (0.18 - this.pitch) * (1 - Math.exp(-dt * 0.8));
      }
    }
    st.pos.y += (this.gy - st.pos.y) * (1 - Math.exp(-dt * 14));
    // điểm dừng gần nhất
    let near: number | null = null;
    let nd = 1e9; for (let i = 0; i < s.stops.length; i++) { const a = s.stops[i].at, d = Math.hypot(a.x - st.pos.x, a.z - st.pos.z); if (d < this.trig[i] && Math.abs(a.y - st.pos.y) < 3 && d < nd) { nd = d; near = i; } }
    if (near === null) this.dismissed = null;
    const open = near !== null && near !== this.dismissed ? near : null;
    if (open !== this.nearIdx) {
      this.nearIdx = open; st.near = open === null ? null : s.stops[open].id; this.cb.onNear(open);
      if (open !== null) { this.lookAt = s.stops[open].look ?? null; this.postcard = this.postcardOf(open); s.onStop?.(s.stops[open].id); this.autoWait = 0; } else { this.lookAt = null; this.postcard = null; }
    }
    if (this.lookAt) { const want = Math.atan2(this.lookAt.x - st.pos.x, -(this.lookAt.z - st.pos.z)); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * (1 - Math.exp(-dt * 3)); const wp = Math.max(-0.45, Math.min(0.55, 0.16 - Math.atan2(this.lookAt.y - st.pos.y - 2, Math.hypot(this.lookAt.x - st.pos.x, this.lookAt.z - st.pos.z)) * 0.9)); this.pitch += (wp - this.pitch) * (1 - Math.exp(-dt * 3)); }
  }
  /** Góc máy "bưu thiếp" của một điểm dừng: chỗ bộ cảnh khai báo, hoặc lùi sau lưng nhân vật theo hướng nhìn công trình. */
  private postcardOf(i: number): { pos: THREE.Vector3; look: THREE.Vector3 } | null {
    const st = this.set.stops[i]; if (!st.look) return null;
    if (st.cam) return { pos: st.cam.clone(), look: st.look.clone() };
    const p = st.at, dx = p.x - st.look.x, dz = p.z - st.look.z, l = Math.hypot(dx, dz) || 1, back = Math.min(9, Math.max(4, l * 0.45));
    const head = new THREE.Vector3(p.x, p.y + 1.9, p.z), want = new THREE.Vector3(p.x + dx / l * back + (-dz / l) * 1.2, p.y + 3.2, p.z + dz / l * back + (dx / l) * 1.2);
    const k = this.clear(head, want); if (k < 1) want.lerpVectors(head, want, Math.max(0.25, k - 0.08));
    return { pos: want, look: st.look.clone() };
  }
  /** Khi thẻ thuyết minh đang mở ở chế độ tự đi thì đứng yên chờ chụp. */
  private nearIdxBlocking(): boolean { return this.auto && this.nearIdx !== null; }
  private moveAng = 0; private tmp = new THREE.Vector3(); private dtNow = 1 / 60;

  private placeCamera(snap = false) {
    const p = this.state.pos, portrait = this.camera.aspect < 1;
    if (this.postcard) {
      this.wasPostcard = true;
      // đang xem thuyết minh: máy ảnh lướt tới góc ngắm đẹp, đẩy công trình lên phần màn không bị thẻ che
      if (snap) this.camera.position.copy(this.postcard.pos); else this.camera.position.lerp(this.postcard.pos, ease(0.07, this.dtNow));
      this.camLook.lerp(this.postcard.look, snap ? 1 : ease(0.09, this.dtNow)); this.camera.lookAt(this.camLook); this.camera.rotateX(-(portrait ? 0.07 : 0.02));
      this.zoom(portrait ? 74 : 54, snap); this.updateCut(new THREE.Vector3(p.x, p.y + 1.75, p.z)); return;
    }
    this.zoom(portrait ? 62 : 52, snap);
    // độ cao máy quay lọc thấp riêng: lên xuống bậc thang, mép sân không làm khung hình nảy theo từng bậc
    if (snap) this.camY = p.y; else this.camY += (p.y - this.camY) * (1 - Math.exp(-this.dtNow * 5));
    const distMax = portrait ? 11 : 9, h = Math.max(1.3, 3.7 + this.pitch * 5.5);
    const head = new THREE.Vector3(p.x, this.camY + 1.75, p.z);
    const arm = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch * 0.6) * distMax, h - 1.75, Math.cos(this.yaw) * Math.cos(this.pitch * 0.6) * distMax), L = arm.length(); arm.divideScalar(L);
    // cần lò xo: chùm tia từ đầu ra sau chạm vật cứng thì co lại (nhanh), hết vướng thì duỗi ra (chậm ~0,4 s); KHÔNG đổi góc quay
    const free = this.rig.cast(head, arm, L + 0.5), want = Math.max(1.1, Math.min(L, free - 0.45));
    if (snap) this.armLen = want; else this.armLen += (want - this.armLen) * (1 - Math.exp(-this.dtNow * (want < this.armLen ? 22 : 5)));
    const cam = head.clone().addScaledVector(arm, this.armLen);
    // không để mặt cắt gần của ống kính chạm hình học cứng: đẩy dần về phía đầu nhân vật
    for (let i = 0; i < 6 && this.rig.clearance(cam, 0.6) < 0.45; i++) cam.lerp(head, 0.22);
    if (this.wasPostcard) { this.blendFrom.copy(this.camera.position); this.blendT = 0.6; }
    this.wasPostcard = false;
    if (this.blendT > 0 && !snap) { this.blendT = Math.max(0, this.blendT - this.dtNow); const k = 1 - this.blendT / 0.6; cam.lerpVectors(this.blendFrom, cam, k * k * (3 - 2 * k)); }
    this.camera.position.copy(cam);
    const ahead = 9, ly = this.camY + 2.6 - this.pitch * (this.pitch < 0 ? 14 : 3.2) + (portrait ? 1.6 : 0.7);
    this.camLook.set(p.x + Math.sin(this.yaw) * ahead, ly, p.z - Math.cos(this.yaw) * ahead);
    this.camera.lookAt(this.camLook);
    this.updateCut(head);
  }
  private blendFrom = new THREE.Vector3(); private blendT = 0; private roofK = 0;
  /** Cập nhật vùng nhìn xuyên của shader: đoạn máy quay → đầu, mái trên đầu khi đứng dưới mái. */
  private updateCut(head: THREE.Vector3) {
    cutU.uCam.value.copy(this.camera.position); cutU.uHead.value.copy(head);
    const under = this.rig.underRoof(head) || this.rig.underRoof(this.camera.position);
    this.roofK += ((under ? 1 : 0) - this.roofK) * (1 - Math.exp(-this.dtNow * 6)); cutU.uRoof.value = this.roofK; cutU.uRoofC.value.set(this.state.pos.x, this.camY, this.state.pos.z);
  }
  /** Điểm p có đang bị làm mờ không (cho bài kiểm camera-qa). */
  isCut(p: THREE.Vector3, obj?: THREE.Object3D): boolean { let top = false; for (let o: THREE.Object3D | null = obj ?? null; o; o = o.parent) if (o === this.roofGroup) top = true; return cutAmount(p, top) > 0.5; }
  private roofGroup: THREE.Object3D | null = null;
  private camLook = new THREE.Vector3(); private camOff = new THREE.Vector3(); private wasPostcard = false;
  private zoom(fov: number, snap: boolean) { const f = snap ? fov : this.camera.fov + (fov - this.camera.fov) * ease(0.08, this.dtNow); if (Math.abs(f - this.camera.fov) > 0.01) { this.camera.fov = f; this.camera.updateProjectionMatrix(); } }
  private frame = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.frame);
    if (this.paused) { this.last = now; return; }
    if (!this.quality.tick(now)) { if (!this.quality.throttled) this.last = now; return; }
    const dt = stepDt((now - this.last) / 1000); this.last = now; this.time += dt; this.dtNow = dt;
    if (this.spinLeft > 0) { const a = Math.min(this.spinLeft, this.spinRate * dt * (0.5 - 0.5 * Math.cos(Math.min(1, (Math.PI * 2 - this.spinLeft + 0.05) / 0.6) * Math.PI)) + 1e-4); this.yaw += a; this.spinLeft -= a; if (this.spinLeft <= 1e-4) { this.spinLeft = 0; const d = this.spinDone; this.spinDone = null; d?.(); } }
    if (Math.abs(this.lookYaw) > 1e-5 || Math.abs(this.lookPitch) > 1e-5) { const k = 1 - Math.exp(-dt * 16), ay = this.lookYaw * k, ap = this.lookPitch * k; this.yaw += ay; this.pitch = Math.min(0.6, Math.max(-0.3, this.pitch + ap)); this.lookYaw -= ay; this.lookPitch -= ap; }
    this.lookIdle += dt;
    this.step(dt); this.updateRoute(dt); this.quality.busy = this.vmag > 0.05 || this.spinLeft > 0 || Math.abs(this.lookYaw) > 1e-3;
    const st = this.state, sw = Math.sin(this.time * 9) * 0.7 * this.moving;
    this.player.position.copy(st.pos); this.player.position.y += Math.abs(Math.sin(this.time * 9)) * 0.05 * this.moving; this.player.rotation.y = -this.heading;
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw; this.arms[0].rotation.x = -sw * 0.8; this.arms[1].rotation.x = sw * 0.8;
    this.blob.position.set(st.pos.x, st.pos.y + 0.06, st.pos.z);
    // máy ảnh áp sát thì ẩn nhân vật để không che công trình
    this.player.visible = this.blob.visible = Math.hypot(this.camera.position.x - st.pos.x, this.camera.position.z - st.pos.z) > (this.postcard ? 4.2 : 2.4);
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      n.s += n.dir * n.sp * dt; if (n.s > n.b) { n.s = n.b; n.dir = -1; } if (n.s < n.a) { n.s = n.a; n.dir = 1; }
      // tránh nhau và tránh người chơi: lệch sang bên khi sắp chạm
      let want = n.want; const lim = this.set.half - 0.5;
      for (let j = 0; j < this.npcs.length; j++) { const m = this.npcs[j]; if (j !== i && Math.abs(m.s - n.s) < 1.6 && Math.abs(m.off - n.off) < 0.9) want = n.off + (n.off >= m.off && i > j || n.off > m.off ? 0.9 : -0.9); }
      const a = this.at(n.s, n.g.position), nx = -a.dir.z, nz = a.dir.x;
      const pd = (st.pos.x - a.p.x) * nx + (st.pos.z - a.p.z) * nz; if (Math.abs(st.s - n.s) < 2.2 && Math.abs(pd - n.off) < 1.1) want = n.off + (n.off >= pd ? 1.1 : -1.1);
      n.off += (Math.max(-lim, Math.min(lim, want)) - n.off) * Math.min(1, dt * 2.5);
      n.g.position.x += nx * n.off; n.g.position.z += nz * n.off; n.g.position.y += Math.abs(Math.sin(this.time * n.sp * 5.2 + n.ph)) * 0.04;
      n.g.rotation.y = -Math.atan2(a.dir.x * n.dir, -a.dir.z * n.dir);
      const swing = Math.sin(this.time * n.sp * 5.2 + n.ph) * 0.6; n.legs[0].rotation.x = swing; n.legs[1].rotation.x = -swing; n.arms[0].rotation.x = -swing * 0.7; n.arms[1].rotation.x = swing * 0.7;
    }
    for (const f of this.skyTicks) f(this.time, dt);
    // quầy hàng gần nhất
    if (this.shopAt.length) { let near: number | null = null; this.shopAt.forEach((q, i) => { if (Math.hypot(q.x - st.pos.x, q.z - st.pos.z) < 4.2 && Math.abs(q.y - st.pos.y) < 3) near = i; }); if (near !== this.shopIdx) { this.shopIdx = near; this.cb.onShop?.(near); } }
    this.markers.forEach((m, i) => { m.beam.visible = false; m.num.visible = this.nearIdx !== i && !this.seen.has(this.set.stops[i].id) && this.camera.position.distanceToSquared(m.num.position) > 30; const k = 1 + Math.sin(this.time * 3 + i) * 0.08; m.ring.scale.set(k, 1, k); m.beam.rotation.y = this.time * 0.6; });
    for (const t of this.kit.ticks) t(this.time, dt, st);
    for (const t of this.extraTicks) t(this.time, dt);
    this.placeCamera();
    this.renderer.render(this.scene, this.camera);
    trace({ t: now, dt, x: st.pos.x, z: st.pos.z, cx: this.camera.position.x, cy: this.camera.position.y, cz: this.camera.position.z, yaw: this.yaw, level: this.quality.level, ratio: this.quality.pixelRatio });
    // Thanh chỉ đường chỉ báo cho giao diện khi con số thật sự đổi (mỗi lần báo là một lần React vẽ lại): tối đa 4 lần/giây
    this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.25; const h = this.hud(), key = `${h.near}|${h.next}|${Math.round(h.dist)}|${Math.round(h.bearing * 4)}`; if (key !== this.lastHud) { this.lastHud = key; this.cb.onHud(h); } }
  };
  private hud(): SightHud {
    const s = this.set, st = this.state; let next = s.stops.findIndex((x) => !this.seen.has(x.id)); if (next < 0) next = s.stops.length - 1;
    const r = this.route, t = r && r.length > 1 ? r[1] : (this.waypoint ?? s.stops[next].at), bearing = Math.atan2(t.x - st.pos.x, -(t.z - st.pos.z)) - this.yaw;
    let dist = 0; if (r && r.length > 1) for (let i = 0; i < r.length - 1; i++) dist += Math.hypot(r[i + 1].x - r[i].x, r[i + 1].z - r[i].z); else dist = Math.hypot(t.x - st.pos.x, t.z - st.pos.z);
    return { near: this.nearIdx, next, dist, bearing, yaw: this.yaw, wp: !!this.waypoint };
  }
  // ---- dẫn đường: điểm đặt trên bản đồ (hoặc điểm dừng kế) → đường tìm trên lưới, vẽ mũi tên dọc đường
  waypoint: THREE.Vector3 | null = null;
  private route: THREE.Vector3[] | null = null; private routeKey = ''; private routeAt = new THREE.Vector3(); private routeT = 0;
  /** Đặt điểm đến (kéo về chỗ đứng được gần nhất); null để huỷ — tự khám phá. */
  setWaypoint(x: number | null, z = 0): { x: number; z: number } | null {
    if (x === null) { this.waypoint = null; this.routeKey = ''; return null; }
    const t = this.grid.nearest(x, z, this.state.pos.y, 14) ?? this.grid.nearest(x, z, 0, 30); this.waypoint = t; this.routeKey = ''; return t ? { x: t.x, z: t.z } : null;
  }
  /** Tự đi theo đường tới điểm đến đang đặt. */
  followWaypoint() { if (this.waypoint) this.walkTo(this.waypoint); }
  private updateRoute(dt: number) {
    const st = this.state, target = this.goal?.p ?? this.waypoint ?? this.set.stops[Math.max(0, Math.min(this.set.stops.length - 1, guide.next))]?.at;
    this.routeT -= dt; if (!target) { this.route = null; guide.route = null; return; }
    const key = `${target.x.toFixed(1)},${target.z.toFixed(1)}`;
    if (key !== this.routeKey || (this.routeT <= 0 && this.routeAt.distanceTo(st.pos) > 4)) {
      this.routeKey = key; this.routeAt.copy(st.pos); this.routeT = 1.5;
      this.route = this.goal ? this.goal.route.slice(this.goal.ri) : this.grid.route(st.pos, target);
      if (this.route) this.route.unshift(st.pos.clone());
    } else if (this.route && this.route.length > 1) {
      // bám đầu đường theo nhân vật, bỏ điểm đã đi qua
      while (this.route.length > 2 && Math.hypot(this.route[1].x - st.pos.x, this.route[1].z - st.pos.z) < 0.8) this.route.splice(1, 1);
      this.route[0].copy(st.pos);
    }
    if (this.waypoint && Math.hypot(this.waypoint.x - st.pos.x, this.waypoint.z - st.pos.z) < 2) { this.waypoint = null; this.routeKey = ''; }
    guide.route = this.route;
  }
  /** Ảnh bản đồ nhìn từ trên xuống của cả vùng đi được (chụp một lần, lưu lại). Bắc ở trên (−z). */
  mapImage(): { url: string; x0: number; z0: number; w: number; d: number } {
    if (this.mapCache) return this.mapCache;
    const g = this.grid, W = g.width, D = g.depth, k = 1024 / Math.max(W, D), pw = Math.max(64, Math.round(W * k)), ph = Math.max(64, Math.round(D * k));
    const cx = g.x0 + W / 2, cz = g.z0 + D / 2, cam = new THREE.OrthographicCamera(-W / 2, W / 2, D / 2, -D / 2, 1, 3000);
    cam.position.set(cx, 900, cz); cam.up.set(0, 0, -1); cam.lookAt(cx, 0, cz); cam.updateProjectionMatrix();
    const fog = this.scene.fog, hidden: THREE.Object3D[] = [];
    this.scene.traverse((o) => { if (o.visible && ((o as THREE.Sprite).isSprite || o === this.player || o === this.blob)) { o.visible = false; hidden.push(o); } });
    this.scene.fog = null; cutU.uHead.value.copy(cam.position); cutU.uCam.value.copy(cam.position); const roof = cutU.uRoof.value; cutU.uRoof.value = 0;
    const r = this.renderer, size = new THREE.Vector2(); r.getSize(size); const pr = r.getPixelRatio();
    r.setPixelRatio(1); r.setSize(pw, ph, false); r.render(this.scene, cam);
    const c = document.createElement('canvas'); c.width = pw; c.height = ph; const cx2 = c.getContext('2d')!; cx2.drawImage(r.domElement, 0, 0, pw, ph);
    // vùng không đi được tối đi một chút để thấy rõ chỗ đi được
    const m = document.createElement('canvas'); m.width = g.nx; m.height = g.nz; m.getContext('2d')!.putImageData(g.mask(), 0, 0);
    const o = document.createElement('canvas'); o.width = pw; o.height = ph; const og = o.getContext('2d')!;
    og.fillStyle = 'rgba(16,22,30,0.45)'; og.fillRect(0, 0, pw, ph); og.globalCompositeOperation = 'destination-out'; og.drawImage(m, 0, 0, pw, ph); cx2.drawImage(o, 0, 0);
    r.setPixelRatio(pr); r.setSize(size.x, size.y, false); this.resize();
    this.scene.fog = fog; for (const o of hidden) o.visible = true; cutU.uRoof.value = roof; this.placeCamera(true);
    this.mapCache = { url: c.toDataURL('image/jpeg', 0.82), x0: g.x0, z0: g.z0, w: W, d: D }; return this.mapCache;
  }
  private mapCache: { url: string; x0: number; z0: number; w: number; d: number } | null = null;
  /** Các điểm cần hiện trên bản đồ. */
  mapMarks(): MapMarks {
    const st = this.state, s = this.set;
    return {
      me: { x: st.pos.x, z: st.pos.z, heading: this.heading }, exit: { x: s.path[0].x, z: s.path[0].z },
      stops: s.stops.map((x, i) => ({ x: x.at.x, z: x.at.z, name: this.sight.stops[i]?.name ?? x.id, seen: this.seen.has(x.id) })),
      shops: this.shopAt.map((q) => ({ x: q.x, z: q.z })), extras: guide.extras.map((x) => ({ x: x.at.x, z: x.at.z, kind: x.kind })),
      wp: this.waypoint ? { x: this.waypoint.x, z: this.waypoint.z } : null, route: (this.route ?? []).map((p) => ({ x: p.x, z: p.z })),
    };
  }
  private quality: Quality; private fog0: [number, number] | null = null;
  /** Bậc thấp: kéo sương và tầm nhìn gần lại để bớt vật phải vẽ. */
  private applyQuality(l: number) {
    const fog = this.scene?.fog as THREE.Fog | null; if (!fog || !this.camera) return;
    if (!this.fog0) this.fog0 = [fog.near, fog.far];
    const k = [1, 1, 0.8, 0.65][l]; fog.near = this.fog0[0] * k; fog.far = this.fog0[1] * k;
    this.camera.far = l >= 2 ? Math.min(900, fog.far + 60) : 900; this.camera.updateProjectionMatrix();
  }
  private resize = () => { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.quality.resize(w, h); this.camera.aspect = w / h; this.camera.fov = w < h ? 62 : 52; this.camera.updateProjectionMatrix(); };
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.quality.dispose();
    window.removeEventListener('resize', this.resize); window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey); this.host.removeEventListener('pointerdown', this.onTapDown, true); this.host.removeEventListener('pointerup', this.onTapUp, true);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry && !SHARED.has(m.geometry)) m.geometry.dispose(); const mm = m.material as THREE.MeshStandardMaterial | undefined; if (m.isMesh && mm && mm.map && (mm.map as THREE.Texture).image && !(mm.map instanceof THREE.CanvasTexture)) { mm.map.dispose(); mm.dispose(); } else if (m.isMesh && mm?.map && mm.map.userData?.own) { mm.map.dispose(); mm.dispose(); } const sp = o as THREE.Sprite; if (sp.isSprite) { sp.material.map?.dispose(); sp.material.dispose(); } });
    releaseCutCache(); (this.scene.background as THREE.Texture | null)?.dispose?.(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}
const SHARED = new WeakSet<THREE.BufferGeometry>();
function hash(s: string): number { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) + 1; }
function numberSprite(n: number, done: boolean): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d')!;
  g.fillStyle = '#56310f'; g.beginPath(); g.arc(48, 48, 46, 0, 7); g.fill(); g.fillStyle = done ? '#7ccf4f' : '#ffd23f'; g.beginPath(); g.arc(48, 48, 39, 0, 7); g.fill();
  g.fillStyle = '#3b2a17'; g.font = '800 52px "Baloo 2", "Be Vietnam Pro", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 48, 52);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); sp.scale.setScalar(1.1); return sp;
}
void glow; void V; void ball; void cyl; void cone;

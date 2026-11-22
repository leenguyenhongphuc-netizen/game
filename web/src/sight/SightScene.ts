// Máy chạy cảnh đi bộ tham quan: dựng cảnh từ một bộ (set), cho nhân vật đi trong hành lang quanh lối đi,
// camera sau lưng tầm thấp, cột mốc điểm dừng, khách tham quan đi lại.
import * as THREE from 'three';
import { IS_MOBILE, Quality, debugScene, rendererParams } from '../perf.ts';
import { bake } from '../scene/World.ts';
import { bakeColored } from '../scene/batch.ts';
/** Địa danh đã rà: vật sống chỉ chuyển động theo cả cụm nên gộp được. */
const COLLAPSE_LIVE = new Set(['dn_hoi_an']);
import { gradient } from '../drive/RideKit.ts';
import { Kit, V, ball, box, cyl, cone, glow, dot, walker, shopModel, cloud, label, infoBoard, bench, potPlant } from './SightKit.ts';
import type { PlayerState, SightSet, ShopSpot } from './SightKit.ts';
import { SETS } from './sets/index.ts';
import type { Sight } from '../../../shared/sights.ts';

export interface SightHud { near: number | null; next: number; dist: number; bearing: number; yaw: number }
export interface SightCallbacks { onNear: (index: number | null) => void; onHud: (h: SightHud) => void; onShop?: (index: number | null) => void }
export interface SightShop { id: string; name: string; kind: string; emoji: string }
/** Hộp chắn máy ảnh: [minX, minY, minZ, maxX, maxY, maxZ]. */
type Blocker = [number, number, number, number, number, number];

const SPEED = 4.6, RADIUS = 3.4;

export class SightScene {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera: THREE.PerspectiveCamera;
  private set: SightSet; private kit: Kit; private raf = 0; private last = 0; private time = 0;
  private player = new THREE.Group(); private legs: THREE.Object3D[] = []; private arms: THREE.Object3D[] = []; private blob: THREE.Mesh;
  private state: PlayerState; private heading = 0; private yaw = 0; private pitch = 0.2; private moving = 0;
  private move = new THREE.Vector2(); private keys = new Set<string>();
  private cum: number[] = []; private total = 0;
  private markers: { ring: THREE.Mesh; beam: THREE.Mesh; num: THREE.Sprite; s: number }[] = [];
  private npcs: { g: THREE.Group; legs: THREE.Object3D[]; arms: THREE.Object3D[]; s: number; dir: number; off: number; want: number; a: number; b: number; sp: number; ph: number }[] = [];
  private blockers: Blocker[] = []; private camDist = 8; private shopAt: THREE.Vector3[] = []; private shopIdx: number | null = null;
  private postcard: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null; private userLook = 0; private skyTicks: ((t: number, dt: number) => void)[] = [];
  private nearIdx: number | null = null; private dismissed: number | null = null; private lookAt: THREE.Vector3 | null = null;
  private seen: Set<string>; private autoWait = 0; private hudT = 0; private disposed = false;
  auto = false; speedMul = 1;

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
    this.furnish();
    this.collectBlockers();
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
    this.scene.add(bake(this.kit.stat), this.kit.dyn);
    this.buildSky();
    // chiều dài cộng dồn của lối đi
    this.cum = [0]; for (let i = 1; i < s.path.length; i++) this.cum.push(this.cum[i - 1] + s.path[i].distanceTo(s.path[i - 1])); this.total = this.cum[this.cum.length - 1];
    this.buildPlayer(); this.buildMarkers(); this.buildNpcs(Math.round((s.npcs ?? 8) * (IS_MOBILE ? 0.6 : 1))); this.buildShops();
    const p0 = s.path[0].clone();
    this.state = { pos: p0, s: 0, seg: 0, near: null };
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
      const side = st.look ? ((st.look.x - a.p.x) * nx + (st.look.z - a.p.z) * nz > 0 ? -1 : 1) : (i % 2 ? 1 : -1), off = s.half - 0.2;
      const b = infoBoard(); b.position.set(a.p.x + nx * off * side, a.p.y, a.p.z + nz * off * side); b.rotation.y = Math.atan2(-nx * side, -nz * side); this.kit.add(b);
      const o = i % 2 ? bench(0x8d8478) : potPlant([0xe85aa0, 0xffd23f, 0xf3ead2][i % 3], 1.3), c = this.at(Math.max(0, pr.s - 2.6));
      o.position.set(c.p.x + (-c.dir.z) * off * side, c.p.y, c.p.z + c.dir.x * off * side); o.rotation.y = Math.atan2(c.dir.x, c.dir.z); this.kit.add(o);
    });
  }
  /** Gom hộp bao của các khối tĩnh cao, đủ dày và nằm gần lối đi để chặn máy ảnh chui vào. */
  private collectBlockers() {
    const path = this.set.path, b = new THREE.Box3(), sz = new THREE.Vector3(), c = new THREE.Vector3();
    this.kit.stat.updateMatrixWorld(true);
    this.kit.stat.traverse((o) => {
      const m = o as THREE.Mesh; if (!m.isMesh) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      b.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld); b.getSize(sz); b.getCenter(c);
      if (sz.y < 1.4 || Math.min(sz.x, sz.z) < 0.45 || Math.max(sz.x, sz.z) > 70) return;
      let near = false; for (let i = 0; i < path.length && !near; i++) { const p = path[i]; if (Math.abs(p.x - c.x) < sz.x / 2 + 16 && Math.abs(p.z - c.z) < sz.z / 2 + 16 && b.max.y > p.y + 1.2 && b.min.y < p.y + 9) near = true; }
      if (!near) { for (let i = 0; i < path.length - 1 && !near; i++) { const mx = (path[i].x + path[i + 1].x) / 2, mz = (path[i].z + path[i + 1].z) / 2, my = (path[i].y + path[i + 1].y) / 2; if (Math.abs(mx - c.x) < sz.x / 2 + 16 && Math.abs(mz - c.z) < sz.z / 2 + 16 && b.max.y > my + 1.2 && b.min.y < my + 9) near = true; } }
      if (near) this.blockers.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]);
    });
  }
  /** Tỉ lệ (0..1) của đoạn từ a tới b còn thông trước khi chạm hộp chắn đầu tiên; bỏ qua hộp đang chứa a. */
  private clear(a: THREE.Vector3, b: THREE.Vector3): number {
    let best = 1; const d = [b.x - a.x, b.y - a.y, b.z - a.z], o = [a.x, a.y, a.z];
    for (const k of this.blockers) {
      let t0 = 0, t1 = best, hit = true;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-6) { if (o[i] < k[i] || o[i] > k[i + 3]) { hit = false; break; } continue; }
        let u = (k[i] - o[i]) / d[i], v = (k[i + 3] - o[i]) / d[i]; if (u > v) { const w = u; u = v; v = w; }
        if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) { hit = false; break; }
      }
      if (hit && t0 > 0.001 && t0 < best) best = t0;
    }
    return best;
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
      this.shopAt.push(sp.at.clone());
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

  setMove(x: number, y: number) { this.move.set(x, y); }
  look(dx: number, dy: number) { this.yaw += dx; this.pitch = Math.min(0.75, Math.max(-0.45, this.pitch + dy)); this.lookAt = null; this.postcard = null; }
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
    this.state.pos.copy(back.p); this.state.seg = back.seg; this.state.s = pr.s - 1.6; this.heading = Math.atan2(back.dir.x, -back.dir.z); this.yaw = this.heading; this.dismissed = null; this.nearIdx = null;
    this.step(0.016); if (this.lookAt) { this.yaw = Math.atan2(this.lookAt.x - this.state.pos.x, -(this.lookAt.z - this.state.pos.z)); for (let i = 0; i < 40; i++) this.step(0.05); } this.placeCamera(true); this.renderer.render(this.scene, this.camera);
  }
  pos() { return { x: this.state.pos.x, y: this.state.pos.y, z: this.state.pos.z, s: this.state.s, total: this.total }; }
  info() { const i = this.renderer.info.render; return { calls: i.calls, triangles: i.triangles }; }

  private step(dt: number) {
    const st = this.state, s = this.set; let mv = this.move.clone().add(this.keyMove()); if (mv.lengthSq() > 1) mv.normalize();
    if (this.auto && this.nearIdx === null) {
      // tự đi dọc tuyến: hướng tới điểm phía trước trên lối đi
      const target = this.at(st.s + 2.5).p, dx = target.x - st.pos.x, dz = target.z - st.pos.z, l = Math.hypot(dx, dz);
      if (l > 0.05 && st.s < this.total - 0.3) { const ang = Math.atan2(dx, -dz) - this.yaw; mv = new THREE.Vector2(Math.sin(ang), Math.cos(ang)); }
    }
    const sp = mv.length(); this.moving += ((sp > 0.05 ? 1 : 0) - this.moving) * Math.min(1, dt * 10);
    if (sp > 0.05 && this.nearIdxBlocking() === false) {
      const ang = this.yaw + Math.atan2(mv.x, mv.y), v = SPEED * Math.min(1, sp) * this.speedMul * dt;
      const nx = st.pos.x + Math.sin(ang) * v, nz = st.pos.z - Math.cos(ang) * v;
      const pr = this.project(new THREE.Vector3(nx, st.pos.y, nz), st.seg); let px = nx, pz = nz;
      if (pr.d > s.half) { const k = s.half / pr.d; px = pr.q.x + (nx - pr.q.x) * k; pz = pr.q.z + (nz - pr.q.z) * k; }
      st.pos.set(px, st.pos.y + (pr.q.y - st.pos.y) * Math.min(1, dt * 14), pz); st.s = pr.s; st.seg = pr.seg;
      let dh = ang - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); this.heading += dh * Math.min(1, dt * 12);
      // camera tự xoay theo hướng đi khi người chơi không tự xoay
      if (!this.lookAt) { let dy = this.heading - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); if (Math.abs(dy) < 2.6) this.yaw += dy * Math.min(1, dt * (this.auto ? 3.2 : 1.5)); }
    }
    // điểm dừng gần nhất
    let near: number | null = null;
    s.stops.forEach((sp2, i) => { if (Math.hypot(sp2.at.x - st.pos.x, sp2.at.z - st.pos.z) < RADIUS && Math.abs(sp2.at.y - st.pos.y) < 3) near = i; });
    if (near === null) this.dismissed = null;
    const open = near !== null && near !== this.dismissed ? near : null;
    if (open !== this.nearIdx) {
      this.nearIdx = open; st.near = open === null ? null : s.stops[open].id; this.cb.onNear(open);
      if (open !== null) { this.lookAt = s.stops[open].look ?? null; this.postcard = this.postcardOf(open); s.onStop?.(s.stops[open].id); this.autoWait = 0; } else { this.lookAt = null; this.postcard = null; }
    }
    if (this.lookAt) { const want = Math.atan2(this.lookAt.x - st.pos.x, -(this.lookAt.z - st.pos.z)); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 3); const wp = Math.max(-0.45, Math.min(0.55, 0.16 - Math.atan2(this.lookAt.y - st.pos.y - 2, Math.hypot(this.lookAt.x - st.pos.x, this.lookAt.z - st.pos.z)) * 0.9)); this.pitch += (wp - this.pitch) * Math.min(1, dt * 3); }
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

  private placeCamera(snap = false) {
    const p = this.state.pos, portrait = this.camera.aspect < 1;
    if (this.postcard) {
      // đang xem thuyết minh: máy ảnh lướt tới góc ngắm đẹp, đẩy công trình lên phần màn không bị thẻ che
      if (snap) this.camera.position.copy(this.postcard.pos); else this.camera.position.lerp(this.postcard.pos, 0.07);
      this.camLook.lerp(this.postcard.look, snap ? 1 : 0.09); this.camera.lookAt(this.camLook); this.camera.rotateX(-(portrait ? 0.07 : 0.02));
      this.zoom(portrait ? 74 : 54, snap); return;
    }
    this.zoom(portrait ? 62 : 52, snap);
    const distMax = portrait ? 8.6 : 7.4, h = Math.max(1.3, 3.1 + this.pitch * 5.5);
    const head = new THREE.Vector3(p.x, p.y + 1.75, p.z);
    const dirx = -Math.sin(this.yaw) * Math.cos(this.pitch * 0.6), dirz = Math.cos(this.yaw) * Math.cos(this.pitch * 0.6);
    const far = new THREE.Vector3(p.x + dirx * distMax, p.y + h, p.z + dirz * distMax);
    // hành lang rộng quanh lối đi + hộp chắn: không chui vào nhà, cột, vách
    const pr = this.project(far, this.state.seg), lim = this.set.half + 4.5;
    if (pr.d > lim) { const k = lim / pr.d; far.x = pr.q.x + (far.x - pr.q.x) * k; far.z = pr.q.z + (far.z - pr.q.z) * k; }
    const k = this.clear(head, far), wantDist = Math.max(1.6, distMax * Math.max(0.2, k - 0.06));
    this.camDist += (wantDist - this.camDist) * (wantDist < this.camDist ? 0.5 : 0.06); if (snap) this.camDist = wantDist;
    const t = this.camDist / distMax, want = new THREE.Vector3().lerpVectors(head, far, t); want.y += (1 - t) * 1.1;
    if (snap) this.camera.position.copy(want); else this.camera.position.lerp(want, 0.22);
    const ahead = 9, ly = p.y + 2.6 - this.pitch * (this.pitch < 0 ? 14 : 3.2) + (portrait ? 1.6 : 0.7);
    this.camLook.set(p.x + Math.sin(this.yaw) * ahead, ly, p.z - Math.cos(this.yaw) * ahead);
    this.camera.lookAt(this.camLook);
  }
  private camLook = new THREE.Vector3();
  private zoom(fov: number, snap: boolean) { const f = snap ? fov : this.camera.fov + (fov - this.camera.fov) * 0.08; if (Math.abs(f - this.camera.fov) > 0.01) { this.camera.fov = f; this.camera.updateProjectionMatrix(); } }
  private frame = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.frame);
    if (!this.quality.tick(now)) { if (!this.quality.throttled) this.last = now; return; }
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.time += dt;
    this.step(dt);
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
    this.markers.forEach((m, i) => { m.beam.visible = m.num.visible = this.nearIdx !== i && !this.seen.has(this.set.stops[i].id) && this.camera.position.distanceToSquared(m.num.position) > 30; const k = 1 + Math.sin(this.time * 3 + i) * 0.08; m.ring.scale.set(k, 1, k); m.beam.rotation.y = this.time * 0.6; });
    for (const t of this.kit.ticks) t(this.time, dt, st);
    this.placeCamera();
    this.renderer.render(this.scene, this.camera);
    this.hudT -= dt; if (this.hudT <= 0) { this.hudT = 0.12; this.cb.onHud(this.hud()); }
  };
  private hud(): SightHud {
    const s = this.set, st = this.state; let next = s.stops.findIndex((x) => !this.seen.has(x.id)); if (next < 0) next = s.stops.length - 1;
    const t = s.stops[next].at, bearing = Math.atan2(t.x - st.pos.x, -(t.z - st.pos.z)) - this.yaw;
    return { near: this.nearIdx, next, dist: Math.max(0, Math.abs(this.markers[next].s - st.s)), bearing, yaw: this.yaw };
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
    window.removeEventListener('resize', this.resize); window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry && !SHARED.has(m.geometry)) m.geometry.dispose(); const mm = m.material as THREE.MeshStandardMaterial | undefined; if (m.isMesh && mm && mm.map && (mm.map as THREE.Texture).image && !(mm.map instanceof THREE.CanvasTexture)) { mm.map.dispose(); mm.dispose(); } else if (m.isMesh && mm?.map && mm.map.userData?.own) { mm.map.dispose(); mm.dispose(); } const sp = o as THREE.Sprite; if (sp.isSprite) { sp.material.map?.dispose(); sp.material.dispose(); } });
    (this.scene.background as THREE.Texture | null)?.dispose?.(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
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

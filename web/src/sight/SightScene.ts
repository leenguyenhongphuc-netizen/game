// Máy chạy cảnh đi bộ tham quan: dựng cảnh từ một bộ (set), cho nhân vật đi trong hành lang quanh lối đi,
// camera sau lưng tầm thấp, cột mốc điểm dừng, khách tham quan đi lại.
import * as THREE from 'three';
import { bake } from '../scene/World.ts';
import { gradient } from '../drive/RideKit.ts';
import { Kit, V, ball, box, cyl, cone, person, glow, dot } from './SightKit.ts';
import type { PlayerState, SightSet } from './SightKit.ts';
import { SETS } from './sets/index.ts';
import type { Sight } from '../../../shared/sights.ts';

export interface SightHud { near: number | null; next: number; dist: number; bearing: number; yaw: number }
export interface SightCallbacks { onNear: (index: number | null) => void; onHud: (h: SightHud) => void }

const SPEED = 4.6, RADIUS = 3.4;

export class SightScene {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera: THREE.PerspectiveCamera;
  private set: SightSet; private kit: Kit; private raf = 0; private last = 0; private time = 0;
  private player = new THREE.Group(); private legs: THREE.Object3D[] = []; private arms: THREE.Object3D[] = []; private blob: THREE.Mesh;
  private state: PlayerState; private heading = 0; private yaw = 0; private pitch = 0.2; private moving = 0;
  private move = new THREE.Vector2(); private keys = new Set<string>();
  private cum: number[] = []; private total = 0;
  private markers: { ring: THREE.Mesh; beam: THREE.Mesh; num: THREE.Sprite; s: number }[] = [];
  private npcs: { g: THREE.Group; s: number; dir: number; off: number; a: number; b: number; sp: number }[] = [];
  private nearIdx: number | null = null; private dismissed: number | null = null; private lookAt: THREE.Vector3 | null = null;
  private seen: Set<string>; private autoWait = 0; private hudT = 0; private disposed = false;
  auto = false; speedMul = 1;

  constructor(private host: HTMLElement, private sight: Sight, seen: string[], private cb: SightCallbacks) {
    this.seen = new Set(seen);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement); this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.3, 900);
    this.kit = new Kit(hash(sight.id));
    this.set = (SETS[sight.id] ?? SETS[`kind:${sight.kind}`] ?? SETS['kind:pho_co'])(this.kit, sight);
    const s = this.set;
    this.scene.background = gradient(s.sky[0], s.sky[1]); this.scene.fog = new THREE.Fog(s.fog[0], s.fog[1], s.fog[2]);
    this.scene.add(new THREE.HemisphereLight(s.light.ambientColor ?? 0xffffff, 0x8a7a66, s.light.ambient));
    const sun = new THREE.DirectionalLight(s.light.sunColor ?? 0xfff2d6, s.light.sun); sun.position.set(...(s.light.sunDir ?? [0.5, 1, 0.35])); this.scene.add(sun);
    this.scene.add(bake(this.kit.stat), this.kit.dyn);
    // chiều dài cộng dồn của lối đi
    this.cum = [0]; for (let i = 1; i < s.path.length; i++) this.cum.push(this.cum[i - 1] + s.path[i].distanceTo(s.path[i - 1])); this.total = this.cum[this.cum.length - 1];
    this.buildPlayer(); this.buildMarkers(); this.buildNpcs(s.npcs ?? 8);
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
      const g = bake(person(i + 1)); const a = r() * this.total * 0.9, b = Math.min(this.total, a + 14 + r() * 30);
      this.npcs.push({ g, s: a + r() * (b - a), dir: r() < 0.5 ? 1 : -1, off: (r() - 0.5) * 2 * (this.set.half - 0.6), a, b, sp: 0.9 + r() * 0.8 }); this.scene.add(g);
    }
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
  look(dx: number, dy: number) { this.yaw += dx; this.pitch = Math.min(0.75, Math.max(-0.25, this.pitch + dy)); this.lookAt = null; }
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
  dismiss() { this.dismissed = this.nearIdx; this.lookAt = null; }
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
      if (open !== null) { this.lookAt = s.stops[open].look ?? null; s.onStop?.(s.stops[open].id); this.autoWait = 0; } else this.lookAt = null;
    }
    if (this.lookAt) { const want = Math.atan2(this.lookAt.x - st.pos.x, -(this.lookAt.z - st.pos.z)); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 3); const wp = Math.max(-0.2, Math.min(0.55, 0.16 - Math.atan2(this.lookAt.y - st.pos.y - 2, Math.hypot(this.lookAt.x - st.pos.x, this.lookAt.z - st.pos.z)) * 0.55)); this.pitch += (wp - this.pitch) * Math.min(1, dt * 3); }
  }
  /** Khi thẻ thuyết minh đang mở ở chế độ tự đi thì đứng yên chờ chụp. */
  private nearIdxBlocking(): boolean { return this.auto && this.nearIdx !== null; }

  private placeCamera(snap = false) {
    const p = this.state.pos, portrait = this.camera.aspect < 1, dist = portrait ? 6.4 : 5.6, h = 2.3 + this.pitch * 5;
    const cx = p.x - Math.sin(this.yaw) * dist * Math.cos(this.pitch * 0.6), cz = p.z + Math.cos(this.yaw) * dist * Math.cos(this.pitch * 0.6);
    const want = new THREE.Vector3(cx, p.y + h, cz);
    // giữ camera trong hành lang lối đi để không chui vào nhà hai bên; bị ép lại gần thì nâng cao lên
    const pr = this.project(want, this.state.seg), lim = this.set.half + 0.7;
    if (pr.d > lim) { const k = lim / pr.d; want.x = pr.q.x + (want.x - pr.q.x) * k; want.z = pr.q.z + (want.z - pr.q.z) * k; want.y += (dist - Math.hypot(want.x - p.x, want.z - p.z)) * 0.3; }
    if (snap) this.camera.position.copy(want); else this.camera.position.lerp(want, 0.18);
    const ahead = 9, ly = p.y + 2.5 - this.pitch * 3.2 + (portrait ? 1.3 : 0.5);
    this.camera.lookAt(p.x + Math.sin(this.yaw) * ahead, ly, p.z - Math.cos(this.yaw) * ahead);
  }
  private frame = (now: number) => {
    if (this.disposed) return; this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.time += dt;
    this.step(dt);
    const st = this.state, sw = Math.sin(this.time * 9) * 0.7 * this.moving;
    this.player.position.copy(st.pos); this.player.position.y += Math.abs(Math.sin(this.time * 9)) * 0.05 * this.moving; this.player.rotation.y = -this.heading;
    this.legs[0].rotation.x = sw; this.legs[1].rotation.x = -sw; this.arms[0].rotation.x = -sw * 0.8; this.arms[1].rotation.x = sw * 0.8;
    this.blob.position.set(st.pos.x, st.pos.y + 0.06, st.pos.z);
    for (const n of this.npcs) {
      n.s += n.dir * n.sp * dt; if (n.s > n.b) { n.s = n.b; n.dir = -1; } if (n.s < n.a) { n.s = n.a; n.dir = 1; }
      const a = this.at(n.s, n.g.position); n.g.position.x += -a.dir.z * n.off; n.g.position.z += a.dir.x * n.off; n.g.position.y += Math.abs(Math.sin(this.time * 6 + n.off * 9)) * 0.04;
      n.g.rotation.y = -Math.atan2(a.dir.x * n.dir, -a.dir.z * n.dir);
    }
    this.markers.forEach((m, i) => { m.beam.visible = m.num.visible = this.nearIdx !== i; const k = 1 + Math.sin(this.time * 3 + i) * 0.08; m.ring.scale.set(k, 1, k); m.beam.rotation.y = this.time * 0.6; });
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
  private resize = () => { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w < h ? 62 : 52; this.camera.updateProjectionMatrix(); };
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize); window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry && !SHARED.has(m.geometry)) m.geometry.dispose(); const sp = o as THREE.Sprite; if (sp.isSprite) { sp.material.map?.dispose(); sp.material.dispose(); } });
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
void glow; void dot; void V; void box;

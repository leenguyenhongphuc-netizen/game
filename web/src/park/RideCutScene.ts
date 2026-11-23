// Hoạt cảnh khi lên một trò: góc nhìn thứ nhất (đu quay, tàu lượn, tháp rơi, cáp treo, máng trượt, nhà ma, phao) hoặc thứ ba (xe đụng).
// Mỗi trò một cảnh nhỏ riêng dựng nhanh, vẽ bằng renderer riêng trong lớp phủ; cảnh tham quan phía dưới tạm dừng vẽ trong lúc này.
import * as THREE from 'three';
import type { ParkEnv } from './parkSet.ts';
import type { RideKind } from '../../../shared/parks.ts';
import { rendererParams } from '../perf.ts';
import { gradient } from '../drive/RideKit.ts';
import { bakeColored } from '../scene/batch.ts';
import { ball, box, cone, cyl, glow, grp, person } from '../sight/SightKit.ts';
import { coasterCurve, instanced, tube } from './ParkKit.ts';

const up = new THREE.Vector3(0, 1, 0);
/** Cảnh nền chung: trời, đất hoặc biển, núi xa, một khu vui chơi thu nhỏ bên dưới (khối màu). */
function backdrop(scene: THREE.Scene, env: ParkEnv, main: number, accent: number, r: () => number, clear = 0) {
  scene.background = gradient(env === 'vinh' ? 0x6fa8d8 : 0x2f94ee, 0xe6f4fb);
  scene.fog = new THREE.Fog(0xdceef8, 160, 900);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.8); sun.position.set(0.5, 1, 0.3); scene.add(sun);
  const g = new THREE.Group();
  g.add(box(env === 'dao' ? 0x9ccf7a : 0x86c26a, 0, -0.5, 0, 2000, 1, 2000));
  if (env !== 'nui') { g.add(box(0x1f8fd0, env === 'dao' ? 560 : -560, -0.3, 0, 900, 0.4, 2000)); for (let i = 0; i < 18; i++) { const x = (env === 'dao' ? 1 : -1) * (200 + r() * 600), z = -600 + r() * 1200, h = env === 'vinh' ? 40 + r() * 80 : 30 + r() * 50; g.add(cone(env === 'vinh' ? 0x5f7a5a : 0x4d8c58, x, h / 2, z, 16 + r() * 20, h)); } }
  for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = 500 + r() * 300, h = 80 + r() * 160; g.add(cone(0x3f7a4e, Math.cos(a) * d, h / 2, Math.sin(a) * d, 120 + r() * 80, h)); }
  // khu vui chơi tí hon bên dưới: mái màu, cây, hồ
  for (let i = 0; i < 70; i++) { const x = (r() - 0.5) * 220, z = (r() - 0.5) * 220, c = [main, accent, 0xf4f4f8, 0xe2573c, 0x2ec4b6][i % 5]; if (Math.hypot(x, z) < clear) continue; if (i % 3) g.add(box(c, x, 2, z, 4 + r() * 8, 4 + r() * 4, 4 + r() * 8)); else g.add(ball(0x4c9f55, x, 3, z, 3 + r() * 2)); }
  if (!clear) g.add(box(0x37b6e8, 40, 0.1, -30, 40, 0.2, 24));
  scene.add(bakeColored(g, false));
}

export interface RideCutOpts { kind: RideKind; env: ParkEnv; main: number; accent: number; seconds: number }
export class RideCutScene {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(70, 1, 0.1, 1500);
  private raf = 0; private t0 = 0; private dead = false; private tick: (t: number, dt: number) => void = () => {};
  private last = 0;
  /** 0..1 tiến độ (để thanh tiến độ trên giao diện đọc). */
  progress = 0;
  constructor(private host: HTMLElement, private o: RideCutOpts, private onEnd: () => void) {
    this.renderer = new THREE.WebGLRenderer(rendererParams(host)); this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
    host.appendChild(this.renderer.domElement); this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    let s = 1234567; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    if (o.kind !== 'nha_ma' && o.kind !== 'mang_truot') backdrop(this.scene, o.env, o.main, o.accent, r, o.kind === 'ho_song' || o.kind === 'song_luoi' || o.kind === 'xe_dung' ? 75 : 0);
    this.build(r);
    this.resize(); addEventListener('resize', this.resize);
    this.t0 = this.last = performance.now(); this.raf = requestAnimationFrame(this.frame);
  }
  private resize = () => { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w < h ? 78 : 64; this.camera.updateProjectionMatrix(); };
  private frame = (now: number) => {
    if (this.dead) return; this.raf = requestAnimationFrame(this.frame);
    // mốc thời gian của khung đầu có thể sớm hơn lúc dựng cảnh (âm): kẹp về 0 để đường cong không nhận số âm
    const t = Math.max(0, (now - this.t0) / 1000), dt = Math.max(0, Math.min(0.1, (now - this.last) / 1000)); this.last = now;
    this.progress = Math.min(1, t / this.o.seconds);
    this.tick(t, dt); this.renderer.render(this.scene, this.camera);
    if (t >= this.o.seconds) { this.dispose(); this.onEnd(); }
  };
  /** Rung máy ảnh nhẹ (tàu lượn, xe đụng). */
  private shake(k: number) { this.camera.position.x += (Math.random() - 0.5) * k; this.camera.position.y += (Math.random() - 0.5) * k; }

  private build(r: () => number) {
    const { kind, main, accent, seconds } = this.o, sc = this.scene, cam = this.camera, look = new THREE.Vector3();
    switch (kind) {
      case 'du_quay': {
        const R = 30, hub = new THREE.Vector3(0, R + 4, 0);
        const wheel = new THREE.Group(); wheel.add(new THREE.Mesh(new THREE.TorusGeometry(R, 0.5, 6, 64), new THREE.MeshLambertMaterial({ color: main })));
        for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2, sp = cyl(0xf4f4f8, Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0, 0.12, R); sp.rotation.z = a - Math.PI / 2; wheel.add(sp); }
        wheel.position.copy(hub); sc.add(wheel);
        const cab = grp(0, 0, 0, 0, box(accent, 0, -1.2, 0, 3, 0.2, 3), box(main, 0, 1.4, 0, 3.2, 0.2, 3.2), cyl(0xc0c6d0, -1.4, 0, 1.4, 0.06, 2.6), cyl(0xc0c6d0, 1.4, 0, 1.4, 0.06, 2.6));
        sc.add(cab);
        this.tick = (t) => {
          const a = -Math.PI / 2 + (t / seconds) * Math.PI * 2 * 0.85, p = new THREE.Vector3(Math.cos(a) * R, hub.y + Math.sin(a) * R - 1.2, 0.0);
          wheel.rotation.z = a + Math.PI / 2; cab.position.copy(p).y += 0.2;
          cam.position.set(p.x, p.y + 0.4, p.z + 0.4); look.set(p.x * 0.4 + Math.sin(t * 0.25) * 80, p.y * 0.5 - 6, 140); cam.lookAt(look);
        };
        break;
      }
      case 'tau_luon': {
        const curve = coasterCurve(0, 0, 0, 120, 70, 42);
        const railM = new THREE.MeshLambertMaterial({ color: accent });
        const off = (k: number) => new THREE.CatmullRomCurve3(Array.from({ length: 200 }, (_, i) => { const u = i / 200, p = curve.getPointAt(u), tg = curve.getTangentAt(u); return new THREE.Vector3(p.x - tg.z * k, p.y, p.z + tg.x * k); }), true);
        sc.add(tube(railM, off(0.6), 0.1, 240, 5, true), tube(railM, off(-0.6), 0.1, 240, 5, true));
        for (let i = 0; i < 60; i++) { const p = curve.getPointAt(i / 60); if (p.y > 3) sc.add(cyl(main, p.x, p.y / 2, p.z, 0.25, p.y)); }
        // mũi toa đầu: thanh mảnh ở mép dưới tầm nhìn
        const front = box(main, 0, 0, 0, 1.4, 0.16, 0.24); sc.add(front);
        let u = 0.02;
        this.tick = (_t, dt) => {
          const tg = curve.getTangentAt(u); u = (u + dt * (0.035 + Math.max(0, -tg.y) * 0.09)) % 1;
          const p = curve.getPointAt(u), ahead = curve.getPointAt((u + 0.02) % 1);
          cam.position.set(p.x, p.y + 1.3, p.z); cam.lookAt(ahead.x, ahead.y + 1.1, ahead.z); cam.up.copy(up);
          front.position.copy(p).addScaledVector(curve.getTangentAt(u), 2.4).y += 0.55; front.lookAt(ahead.x, ahead.y + 0.7, ahead.z);
          this.shake(0.04 + Math.max(0, -tg.y) * 0.08);
        };
        break;
      }
      case 'thap_roi': {
        const H = 60; sc.add(cyl(0xf4f4f8, 0, H / 2, -2.4, 1.4, H), cone(accent, 0, H + 2, -2.4, 2, 3));
        const bar = box(main, 0, 0, -0.6, 3, 0.3, 0.3); sc.add(bar);
        this.tick = (t) => {
          const f = t / seconds; let y: number;
          if (f < 0.55) y = 3 + (H - 6) * (f / 0.55); else if (f < 0.75) y = H - 3; else if (f < 0.82) y = H - 3 - (H - 8) * ((f - 0.75) / 0.07) ** 2; else y = 5 - Math.min(1, (f - 0.82) * 5) * 2;
          cam.position.set(0, y, 0.6); bar.position.set(0, y - 0.6, 0.2);
          const down = f > 0.72 && f < 0.86 ? 0.6 : 0;
          cam.lookAt(Math.sin(t * 0.3) * 30, y - 8 - down * 40, 60);
          if (f > 0.75 && f < 0.82) this.shake(0.1);
        };
        break;
      }
      case 'cap_treo': {
        const pts = [new THREE.Vector3(0, 8, 0), new THREE.Vector3(30, 40, -160), new THREE.Vector3(80, 90, -340), new THREE.Vector3(120, 130, -520)];
        const curve = new THREE.CatmullRomCurve3(pts);
        sc.add(tube(0x3a3f48, curve, 0.08, 80, 4));
        for (const p of pts.slice(1, 3)) sc.add(cyl(0xd9dde6, p.x, p.y / 2, p.z, 1.2, p.y + 2));
        // rừng thông bên dưới đường cáp (khu trên núi) hoặc mặt vịnh
        const trees = instanced(grp(0, 0, 0, 0, cone(0x2f6b45, 0, 6, 0, 3, 9), cyl(0x6a4a2a, 0, 1, 0, 0.4, 2)), 260), m = new THREE.Matrix4();
        for (let i = 0; i < 260; i++) { const f = r(), p = curve.getPointAt(f); m.makeTranslation(p.x + (r() - 0.5) * 140, Math.max(0, p.y - 38 - r() * 20), p.z + (r() - 0.5) * 60); trees.set(i, m); }
        trees.done(); for (const im of trees.meshes) sc.add(im);
        // khung cửa kính cabin gắn theo máy ảnh: bậu cửa phía dưới, hai cột hai bên, mép mái phía trên
        const frame = grp(0, 0, 0, 0, box(main, 0, -0.95, -1.4, 3.2, 0.16, 0.12), box(main, 0, 1.25, -1.4, 3.2, 0.2, 0.12), box(accent, -1.45, 0.15, -1.4, 0.1, 2.3, 0.1), box(accent, 1.45, 0.15, -1.4, 0.1, 2.3, 0.1));
        sc.add(cam); cam.add(frame);
        this.tick = (t) => {
          const u = Math.min(0.999, t / seconds), p = curve.getPointAt(u), a = curve.getPointAt(Math.min(1, u + 0.01));
          cam.position.set(p.x, p.y - 2.2, p.z);
          cam.lookAt(a.x + Math.sin(t * 0.4) * 30, a.y - 10, a.z - 20);
        };
        break;
      }
      case 'mang_truot': {
        // bên trong ống trượt xoắn: thành ống trong suốt màu, cuối ống đổ ra hồ
        sc.background = gradient(0x2f94ee, 0xe6f4fb); sc.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 2));
        const pts: THREE.Vector3[] = []; for (let i = 0; i <= 60; i++) { const f = i / 60, a = f * Math.PI * 6; pts.push(new THREE.Vector3(Math.cos(a) * 9, 30 - f * 28, Math.sin(a) * 9 - f * 40)); }
        const curve = new THREE.CatmullRomCurve3(pts);
        const tm = new THREE.MeshLambertMaterial({ color: accent, side: THREE.BackSide, transparent: true, opacity: 0.55 });
        sc.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 300, 1.6, 14, false), tm));
        const hoop = new THREE.TorusGeometry(1.62, 0.08, 4, 18), hoopM = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for (let i = 0; i < 40; i++) { const p = curve.getPointAt(i / 40), h = new THREE.Mesh(hoop, hoopM); h.position.copy(p); h.lookAt(curve.getPointAt(Math.min(1, i / 40 + 0.01))); sc.add(h); }
        sc.add(box(0x86c26a, 0, -0.6, -40, 400, 1, 400), box(0x37b6e8, 0, 0.2, -52, 30, 0.2, 30));
        const splash = new THREE.Group(); for (let i = 0; i < 24; i++) splash.add(ball(0xffffff, Math.cos(i) * (1 + (i % 4)), 0, Math.sin(i * 1.7) * (1 + (i % 3)), 0.4)); splash.visible = false; sc.add(splash);
        this.tick = (t) => {
          const f = t / seconds;
          if (f < 0.8) { const u = Math.min(0.999, (f / 0.8) ** 1.3), p = curve.getPointAt(u), a = curve.getPointAt(Math.min(1, u + 0.015)); cam.position.copy(p).y -= 0.8; cam.lookAt(a.x, a.y - 0.8, a.z); this.shake(0.05); }
          else { const k = (f - 0.8) / 0.2; cam.position.set(0, 1.2 - k * 1.8, -46 - k * 6); cam.lookAt(0, 0.5, -60); splash.visible = true; splash.position.set(0, 0.6 + k * 2, -48); splash.scale.setScalar(1 + k * 2); }
        };
        break;
      }
      case 'nha_ma': {
        sc.background = new THREE.Color(0x06060a); sc.fog = new THREE.Fog(0x06060a, 4, 30);
        sc.add(new THREE.AmbientLight(0x6a6a90, 1.4));
        const lamp = new THREE.PointLight(0xffb070, 60, 18, 1.2); sc.add(lamp);
        const L = 120, hall = new THREE.Group();
        hall.add(box(0x2a2230, 0, -0.1, -L / 2, 6, 0.2, L), box(0x1a1420, -3, 2, -L / 2, 0.2, 4.4, L), box(0x1a1420, 3, 2, -L / 2, 0.2, 4.4, L), box(0x120e16, 0, 4.2, -L / 2, 6, 0.2, L));
        for (let z = -6; z > -L; z -= 9) hall.add(box(0x3a2a1c, -2.85, 2, z, 0.1, 3, 1.6), box(glow(0xffd27a), 2.85, 2.6, z - 4, 0.1, 0.5, 0.3), cyl(0x3a2e26, -2, 0.5, z - 2, 0.3, 1));
        sc.add(hall);
        const ghosts: THREE.Group[] = [];
        for (let i = 0; i < 6; i++) { const g = grp(i % 2 ? 1.6 : -1.6, 1.6, -14 - i * 17, 0, ball(glow(0xd8f0ff), 0, 0, 0, 0.6, 0.9, 0.5), ball(0x101018, -0.2, 0.25, 0.42, 0.1), ball(0x101018, 0.2, 0.25, 0.42, 0.1), cone(glow(0xd8f0ff), 0, -1, 0, 0.6, 1.2)); g.rotation.x = Math.PI; g.scale.y = -1; ghosts.push(g); sc.add(g); }
        const skel = person(1, 0, 0xe8e8e8); skel.position.set(2.2, 0, -60); skel.rotation.y = -1.2; sc.add(skel);
        this.tick = (t) => {
          const z = -1 - (t / seconds) * (L - 8); cam.position.set(Math.sin(t * 0.8) * 0.3, 1.7, z); cam.lookAt(Math.sin(t * 0.6) * 1.2, 1.6, z - 6);
          lamp.position.set(0, 3, z - 2); lamp.intensity = 55 + Math.sin(t * 23) * 10 + (Math.sin(t * 3.1) > 0.9 ? -45 : 0);
          for (const g of ghosts) { const d = g.position.z - z; g.visible = d < 0 && d > -12; g.position.x = Math.sign(g.position.x) * (2.4 - Math.max(0, 8 + d) * 0.25); g.position.y = 1.6 + Math.sin(t * 4 + g.position.z) * 0.3; }
        };
        break;
      }
      case 'xe_dung': {
        const W = 30, D = 20; sc.add(box(0x5a6270, 0, 0, 0, W, 0.2, D), box(accent, 0, 0.5, D / 2, W, 0.8, 0.4), box(accent, 0, 0.5, -D / 2, W, 0.8, 0.4), box(accent, W / 2, 0.5, 0, 0.4, 0.8, D), box(accent, -W / 2, 0.5, 0, 0.4, 0.8, D), box(main, 0, 8, 0, W, 0.4, D));
        const mk = (c: number) => { const g = grp(0, 0, 0, 0, box(0x2a2a30, 0, 0.35, 0, 1.8, 0.3, 2.4), box(c, 0, 0.75, 0, 1.6, 0.6, 2), cyl(0x9aa3ad, 0, 4, -0.7, 0.04, 6.4), person(2, 0, 0xffd23f)); g.children[3].position.set(0, 0.4, 0.2); g.children[3].scale.setScalar(0.6); sc.add(g); return g; };
        const me = mk(0xffd23f); me.children[2].visible = false; // cần điện xe mình che tầm nhìn
        const others = [0xe2573c, 0x2ec4b6, 0x7ccf4f, 0x9b7fd6, 0xff8fc8].map(mk);
        const bump = { t: -9 };
        this.tick = (t) => {
          const a = t * 0.9; me.position.set(Math.cos(a) * 8, 0, Math.sin(a * 1.4) * 5); me.rotation.y = -a + Math.PI / 2;
          others.forEach((o, i) => { const b = t * (0.6 + i * 0.13) + i * 1.3; o.position.set(Math.cos(b) * (11 - i), 0, Math.sin(b * 1.2) * (7 - i * 0.5)); o.rotation.y = -b + i; if (o.position.distanceTo(me.position) < 2.3 && t - bump.t > 0.6) bump.t = t; });
          cam.position.set(me.position.x - Math.sin(me.rotation.y) * 6, 4.2, me.position.z - Math.cos(me.rotation.y) * 6); cam.lookAt(me.position.x, 1, me.position.z);
          if (t - bump.t < 0.3) this.shake(0.25);
        };
        break;
      }
      case 'ho_song': case 'song_luoi': {
        const lazy = kind === 'song_luoi', R = 26;
        sc.add(box(0xe8e4d8, 0, -0.2, 0, 140, 0.2, 140));
        const water = new THREE.Mesh(new THREE.PlaneGeometry(lazy ? 400 : 80, lazy ? 400 : 60, 40, 30).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x37b6e8, transparent: true, opacity: 0.88 }));
        water.position.y = 0.35; sc.add(water); // trên mặt đất nền (đỉnh ở y = 0) để không nhấp nháy chồng mặt
        if (lazy) { sc.add(cyl(0x8bc97a, 0, 0.6, 0, R - 4, 1.2), ball(0x8d8478, 0, 3, 0, 6, 4, 5), box(0xbfe6ff, -4, 4, R - 6, 4, 6, 0.3)); }
        else {
          // đầu hồ: bức tường tạo sóng thấp sơn màu, hai bên bãi cát có dù, dừa
          sc.add(box(accent, 0, 1.4, -31, 80, 2.8, 2), box(main, 0, 3, -31, 82, 0.4, 2.4), box(0xf4e6c0, -46, 0, 0, 12, 0.3, 70), box(0xf4e6c0, 46, 0, 0, 12, 0.3, 70));
          for (let i = 0; i < 12; i++) { const sx = i % 2 ? 1 : -1, z = -26 + Math.floor(i / 2) * 10; sc.add(cyl(0x9a8160, sx * 46, 3.5, z, 0.2, 7), ball(0x4c9f55, sx * 46, 7.2, z, 2.4, 0.6, 2.4)); if (i % 3 === 0) sc.add(cone([0xe2573c, 0xffd23f, 0x2ec4b6][i % 3], sx * 43, 2.6, z + 4, 1.8, 0.8), cyl(0xf4f4f8, sx * 43, 1.2, z + 4, 0.05, 2.4)); }
          for (let i = 0; i < 14; i++) sc.add(ball(0xf2c69c, -24 + (i * 7.3) % 48, 0.5, -20 + (i * 5.1) % 26, 0.28));
        }
        const pos = water.geometry.attributes.position as THREE.BufferAttribute, base = Float32Array.from(pos.array as Float32Array);
        const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.35, 8, 20).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xff8a3d })); sc.add(ringM);
        this.tick = (t) => {
          for (let i = 0; i < pos.count; i++) { const x = base[i * 3], z = base[i * 3 + 2]; pos.setY(i, lazy ? Math.sin(x * 0.3 + t * 1.5) * 0.08 : Math.max(0, Math.sin(z * 0.18 + t * 2.2)) * 0.9 * Math.max(0, Math.sin(t * 0.6))); }
          pos.needsUpdate = true;
          let x: number, z: number, y: number, a: number;
          if (lazy) { a = t * 0.12; x = Math.cos(a) * R; z = Math.sin(a) * R; y = 0.4; cam.position.set(x, 1.6, z); cam.lookAt(Math.cos(a + 0.4) * R + Math.sin(t * 0.3) * 6, 1.2, Math.sin(a + 0.4) * R); }
          else { x = Math.sin(t * 0.2) * 3; z = 8; y = Math.max(0, Math.sin(z * 0.18 + t * 2.2)) * 0.9 * Math.max(0, Math.sin(t * 0.6)) + 0.3; cam.position.set(x, y + 1.3, z); cam.lookAt(x * 0.5, 1 + Math.sin(t) * 0.3, -20); a = 0; }
          ringM.position.set(x, y, z); void a;
        };
        break;
      }
    }
    void r;
  }
  dispose() {
    if (this.dead) return; this.dead = true; cancelAnimationFrame(this.raf); removeEventListener('resize', this.resize);
    // không giải phóng từng hình khối: nhiều khối dùng chung hình gốc với cảnh khác; mất ngữ cảnh WebGL là đủ trả bộ nhớ GPU
    (this.scene.background as THREE.Texture | null)?.dispose?.(); this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}

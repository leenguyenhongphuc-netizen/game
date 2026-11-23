// Cảnh 3D bay trực thăng tham quan cánh đồng: dùng lại lớp cánh đồng của xóm (FieldsLayer) trên một nền đồng quê,
// trực thăng bay vòng quanh các khối ruộng của người chơi. Hai góc nhìn: trong cabin (thấy khung kính, bảng đồng hồ) và bên ngoài.
import * as THREE from 'three';
import { FieldsLayer, blockCenter } from '../scene/fields.ts';
import type { FieldLite } from '../scene/fields.ts';
import { bakeColored } from '../scene/batch.ts';
import { rendererParams, stepDt } from '../perf.ts';

export type HeliView = 'cabin' | 'ngoai';
export interface HeliTourOpts { fields: FieldLite[]; seconds?: number; onStep?: (frac: number) => void; onDone?: () => void }

function heli(): { root: THREE.Group; rotor: THREE.Mesh; tail: THREE.Mesh } {
  const g = new THREE.Group(), M = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 12).scale(1, 0.85, 1.6), M(0xd23b2f)); g.add(body);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1.0, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.8, 1.1).rotateX(-0.6), M(0xa9dcf2)); glass.position.set(0, 0.25, 1.1); g.add(glass);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 4.2, 8).rotateX(Math.PI / 2), M(0xd23b2f)); boom.position.set(0, 0.3, -3.2); g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.7), M(0xf2f2f2)); fin.position.set(0, 0.9, -5.1); g.add(fin);
  for (const x of [-0.8, 0.8]) { const sk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 3.2), M(0x333333)); sk.position.set(x, -1.25, 0.1); g.add(sk); }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8), M(0x333333)); mast.position.y = 1.25; g.add(mast);
  const root = bakeColored(g, false, false);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.05, 0.35), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.75 }));
  rotor.position.y = 1.5; root.add(rotor);
  const r2 = rotor.clone(); r2.rotation.y = Math.PI / 2; rotor.add(r2);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4, 0.18), new THREE.MeshBasicMaterial({ color: 0x222222 })); tail.position.set(0.15, 0.9, -5.1); root.add(tail);
  return { root, rotor, tail };
}

/** Khung cabin gắn vào máy quay: hai cột kính, mép trên, bảng đồng hồ — vài khối gộp thành một lưới. */
function cockpit(): THREE.Group {
  const g = new THREE.Group(), M = (c: number) => new THREE.MeshLambertMaterial({ color: c });
  const dash = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.6), M(0x2b2f36)); dash.position.set(0, -0.78, -1.1); g.add(dash);
  for (const x of [-0.9, 0.9]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 0.08), M(0x3a3f47)); p.position.set(x, 0, -1.25); p.rotation.z = x > 0 ? -0.25 : 0.25; g.add(p); }
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.6), M(0x3a3f47)); top.position.set(0, 0.85, -1.1); g.add(top);
  for (const x of [-0.5, 0, 0.5]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 14).rotateX(Math.PI / 2 - 0.5), M(0xeaf6ff)); d.position.set(x, -0.6, -0.85); g.add(d); }
  const out = bakeColored(g, false, false);
  out.traverse((o) => { (o as THREE.Mesh).renderOrder = 10; const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) m.depthTest = false; });
  return out;
}

export class HeliTourScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);
  private layer = new FieldsLayer();
  private heli = heli();
  private cockpit = cockpit();
  private center = new THREE.Vector3();
  private radius = 40;
  private elapsed = 0;
  private total: number;
  private done = false;
  private ro: ResizeObserver;
  view: HeliView = 'ngoai';

  constructor(private host: HTMLElement, private opts: HeliTourOpts) {
    this.renderer = new THREE.WebGLRenderer(rendererParams(host));
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    host.appendChild(this.renderer.domElement);
    this.total = opts.seconds ?? 26;
    this.scene.background = new THREE.Color(0xa9dcf5);
    this.scene.fog = new THREE.Fog(0xa9dcf5, 160, 520);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6f8f3e, 1.6));
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.6); sun.position.set(40, 80, 30); this.scene.add(sun);
    // nền đồng quê: đất xanh, kênh nước, hàng dừa ở xa
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x86b04a }));
    ground.position.y = -0.05; this.scene.add(ground);
    const canal = new THREE.Mesh(new THREE.PlaneGeometry(6, 1200).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5fb3d6 }));
    canal.position.set(-110, -0.02, 0); this.scene.add(canal);
    const palms = new THREE.Group(), trunkM = new THREE.MeshLambertMaterial({ color: 0x7a5a3a }), leafM = new THREE.MeshLambertMaterial({ color: 0x3f8a3a });
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, r = 150 + (i % 5) * 14, tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 9, 6), trunkM);
      tr.position.set(Math.cos(a) * r, 4.5, Math.sin(a) * r - 60); palms.add(tr);
      const lf = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2.2, 7), leafM); lf.position.set(tr.position.x, 9.5, tr.position.z); palms.add(lf);
    }
    this.scene.add(bakeColored(palms, false, false));
    this.layer.set(opts.fields);
    this.scene.add(this.layer.group);
    // tâm và bán kính vòng bay theo các khối của người chơi
    const n = Math.max(1, opts.fields.reduce((s, f) => s + f.blocks, 0));
    const pts = Array.from({ length: Math.min(40, n) }, (_, k) => blockCenter(k));
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x)), minZ = Math.min(...pts.map((p) => p.z)), maxZ = Math.max(...pts.map((p) => p.z));
    this.center.set((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    this.radius = Math.max(36, Math.hypot(maxX - minX, maxZ - minZ) / 2 + 26);
    this.scene.add(this.heli.root);
    this.camera.add(this.cockpit); this.scene.add(this.camera);
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(host); this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  setView(v: HeliView) { this.view = v; }

  private resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  /** Số lần vẽ của khung vừa rồi (để đo hiệu năng). */
  get drawCalls(): number { return this.renderer.info.render.calls; }

  private frame() {
    const fast = (window as unknown as { __rideStep?: number }).__rideStep ? 6 : 1;
    const dt = stepDt(1 / 60) * fast; // nhịp theo khung đều đặn (giống các hoạt cảnh khác); __rideStep: tua nhanh khi tự kiểm
    this.elapsed += dt;
    const f = Math.min(1, this.elapsed / this.total);
    // cất cánh từ mép ruộng → bay một vòng rưỡi quanh tâm, hạ dần độ cao → hạ cánh
    const climb = Math.min(1, f / 0.12), land = f > 0.9 ? (f - 0.9) / 0.1 : 0;
    const ang = -Math.PI / 2 + f * Math.PI * 3, r = this.radius * (0.85 + 0.15 * Math.sin(f * Math.PI * 2));
    const alt = 4 + 36 * climb * (1 - land) - 6 * Math.sin(f * Math.PI * 4) * climb * (1 - land);
    const hx = this.center.x + Math.cos(ang) * r, hz = this.center.z + Math.sin(ang) * r;
    const nx = this.center.x + Math.cos(ang + 0.05) * r, nz = this.center.z + Math.sin(ang + 0.05) * r;
    const h = this.heli.root;
    h.position.set(hx, alt, hz); h.lookAt(nx, alt, nz); h.rotateZ(-0.18 * climb * (1 - land)); h.rotateX(0.06);
    this.heli.rotor.rotation.y += dt * 40; this.heli.tail.rotation.x += dt * 50;
    const now = Date.now();
    this.layer.update(this.elapsed, now, this.camera.position);
    if (this.view === 'cabin') {
      h.visible = false; this.cockpit.visible = true;
      this.camera.position.set(hx, alt + 0.3, hz);
      // nhìn chếch xuống về phía tâm ruộng, hơi lệch theo hướng bay
      this.camera.lookAt(THREE.MathUtils.lerp(nx, this.center.x, 0.55), 0, THREE.MathUtils.lerp(nz, this.center.z, 0.55));
    } else {
      h.visible = true; this.cockpit.visible = false;
      const back = new THREE.Vector3(hx - this.center.x, 0, hz - this.center.z).normalize();
      this.camera.position.set(hx + back.x * 14 - Math.sin(ang) * 10, alt + 7, hz + back.z * 14 + Math.cos(ang) * 10);
      this.camera.lookAt(hx, alt - 2, hz);
    }
    this.renderer.render(this.scene, this.camera);
    this.opts.onStep?.(f);
    if (f >= 1 && !this.done) { this.done = true; this.opts.onDone?.(); }
  }

  dispose() {
    this.renderer.setAnimationLoop(null); this.ro.disconnect(); this.layer.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}

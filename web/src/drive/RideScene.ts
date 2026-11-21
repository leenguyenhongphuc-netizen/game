// Đạo diễn hoạt cảnh du lịch: chuỗi cảnh nối nhau bằng chuyển mờ, mỗi lúc chỉ dựng một cảnh và huỷ cảnh trước.
// 1 ra bến xe trước xóm → 2 xe đưa đón → 3 lên tàu/máy bay ở ga, sân bay, bến cảng (xe khách bỏ qua) → 4 trên đường → 5 tới nơi.
import * as THREE from 'three';
import { REGIONS } from '../../../shared/catalog.ts';
import type { Zone } from '../../../shared/catalog.ts';
import { GEO } from '../scene/plants.ts';
import { gradient } from './DriveScene.ts';
import { Journey } from './RideJourney.ts';
import { Airport, BusStation, Port, TrainStation, Village } from './RideSets.ts';
import type { Act, Ctx, RideMode } from './RideSets.ts';

export type { RideMode };
export interface RideOptions {
  mode: RideMode; fromRegionId: string; toRegionId: string;
  /** Thời lượng riêng của chặng "trên đường" (giây). */
  seconds: number;
  /** Tiến độ chặng trên đường, 0..1. */
  onTick?: (progress: number) => void;
  /** Gọi mỗi khi sang cảnh mới. */
  onStage?: (stage: number, caption: string) => void;
  /** Gọi một lần khi cảnh cuối diễn xong. */
  onArrive?: () => void;
}

const FADE = 0.38;
const SHARED = new Set<THREE.BufferGeometry>(Object.values(GEO));

function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const sp = o as THREE.Sprite, m = o as THREE.Mesh;
    if (sp.isSprite) { sp.material.map?.dispose(); sp.material.dispose(); }
    else if (m.isMesh) {
      if (!SHARED.has(m.geometry)) m.geometry.dispose();
      if (m.userData.own) (m.material as THREE.Material).dispose(); // vật liệu dùng chung (mat) thì giữ lại
      if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
    }
  });
}

export class RideScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.5, 1100);
  private clock = new THREE.Clock();
  private sun: THREE.DirectionalLight;
  private fog = new THREE.Fog(0xdff3fb, 110, 330);
  private veil: HTMLDivElement;
  private plan: (() => Act)[] = [];
  private index = -1;
  private act: Act | null = null;
  private journey: Journey | null = null;
  private actT = 0;
  private time = 0;
  private arrived = false;
  private disposed = false;
  private ro: ResizeObserver;
  private container: HTMLElement;
  private opts: RideOptions;
  private ctx: Ctx;
  private box = new THREE.Box3();
  private target = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private tmp = new THREE.Vector3();

  constructor(container: HTMLElement, opts: RideOptions) {
    this.container = container; this.opts = opts;
    const seconds = Math.min(30, Math.max(6, opts.seconds || 10)), mode = opts.mode;
    const from = REGIONS[opts.fromRegionId], to = REGIONS[opts.toRegionId];
    const zA: Zone = from?.zone ?? 'nam', zB: Zone = to?.zone ?? 'nam', fromName = from?.name ?? 'Nơi đi', toName = to?.name ?? 'Nơi đến';

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    container.appendChild(this.renderer.domElement);
    this.veil = document.createElement('div');
    this.veil.style.cssText = 'position:absolute;inset:0;background:#fdf6e3;opacity:1;pointer-events:none';
    container.appendChild(this.veil);

    this.scene.background = gradient(0x8fd0f5, 0xdff3fb);
    this.scene.fog = this.fog;
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.1);
    this.sun.position.set(18, 30, 12); this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 120 });
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.05; this.sun.shadow.radius = 5;
    this.scene.add(new THREE.HemisphereLight(0xfafcff, 0xd6e6b0, 1.35), this.sun, this.sun.target);

    this.ctx = { camera: this.camera, portrait: false, time: 0, shoot: (pts, yaw, pitch) => this.shoot(pts, yaw, pitch) };

    // Kịch bản: mỗi mục dựng cảnh của mình khi tới lượt
    let village: Village | null = null;
    const vehicleName = mode === 'xe_khach' ? 'Xe khách' : mode === 'tau_hoa' ? 'Tàu hoả' : mode === 'may_bay' ? 'Máy bay' : 'Tàu thuỷ';
    const seed = [...(opts.fromRegionId + opts.toRegionId + mode)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
    this.plan.push(() => (village = new Village(mode, zA, fromName)).first(), () => village!.second());
    if (mode === 'tau_hoa') this.plan.push(() => new TrainStation(zA, fromName, false).depart());
    if (mode === 'may_bay') this.plan.push(() => new Airport(zA, fromName, false).depart());
    if (mode === 'tau_thuy') this.plan.push(() => new Port(zA, fromName, false).depart());
    this.plan.push(() => (this.journey = new Journey({
      mode, zoneA: zA, zoneB: zB, fromIsland: !!from?.island, toIsland: !!to?.island, seconds, seed,
      caption: `${vehicleName} đang trên đường tới ${toName}`, onTick: (p) => this.opts.onTick?.(p),
    })));
    this.plan.push(() => mode === 'xe_khach' ? new BusStation(zB, toName).arrive() : mode === 'tau_hoa' ? new TrainStation(zB, toName, true).arrive() : mode === 'may_bay' ? new Airport(zB, toName, true).arrive() : new Port(zB, toName, true).arrive());

    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    (window as unknown as { __ride?: unknown }).__ride = {
      debug: () => ({
        stage: this.act?.stage ?? 0, scene: this.act?.stage ?? 0, caption: this.act?.caption ?? '', t: this.actT, duration: this.act?.duration ?? 0,
        progress: this.journey?.progress ?? 0, dist: this.journey?.dist ?? 0, total: this.journey?.total ?? 0, alt: this.journey?.alt ?? 0,
        elapsed: this.time, arrived: this.arrived, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      }),
    };
    this.next();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Sang cảnh kế: dựng cảnh mới, huỷ cảnh cũ (trừ khi hai cảnh dùng chung một bối cảnh). */
  private next() {
    const prev = this.act;
    this.index++;
    const act = this.plan[this.index]();
    if (prev && prev.root !== act.root) { this.scene.remove(prev.root); disposeTree(prev.root); }
    if (!act.root.parent) this.scene.add(act.root);
    this.act = act; this.actT = 0;
    this.fog.near = act.fog[0]; this.fog.far = act.fog[1];
    this.opts.onStage?.(act.stage, act.caption);
    this.clock.getDelta(); // thời gian dựng cảnh không tính vào hoạt cảnh
  }

  private resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.fov = w / h < 0.9 ? 52 : 42; this.camera.updateProjectionMatrix();
  }

  /** Lùi máy quay theo hướng (yaw, pitch) tới khi mọi điểm lọt vào vùng an toàn: chừa chỗ cho bảng tiến độ ở trên và phụ đề ở dưới. */
  private shoot(pts: THREE.Vector3[], yaw: number, pitch: number) {
    const cam = this.camera, h = this.container.clientHeight || 1, portrait = this.ctx.portrait;
    const top = 1 - 2 * Math.min(0.3, (portrait ? 128 : 64) / h), bottom = -1 + 2 * Math.min(0.26, 74 / h), side = portrait ? 0.9 : 0.86;
    this.box.setFromPoints(pts).getCenter(this.target);
    this.dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    // Dịch tâm ngắm lên trên một chút để bù phần trên bị bảng che nhiều hơn phần dưới
    const fits = (d: number, lift: number) => {
      cam.position.copy(this.target).addScaledVector(this.dir, d); cam.position.y += lift;
      cam.lookAt(this.target.x, this.target.y + lift, this.target.z); cam.updateMatrixWorld();
      let lo = 1, hi = -1, ok = true;
      for (const p of pts) { this.tmp.copy(p).project(cam); if (Math.abs(this.tmp.x) > side || this.tmp.z > 1) ok = false; lo = Math.min(lo, this.tmp.y); hi = Math.max(hi, this.tmp.y); }
      return { ok, lo, hi };
    };
    let a = 6, b = 420, lift = 0;
    for (let i = 0; i < 16; i++) {
      const d = (a + b) / 2, f = fits(d, lift);
      // căn giữa theo chiều dọc trong vùng an toàn rồi mới xét vừa khung
      const mid = (f.hi + f.lo) / 2, want = (top + bottom) / 2;
      lift += (mid - want) * d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      const g = fits(d, lift);
      if (g.ok && g.hi <= top && g.lo >= bottom) b = d; else a = d;
    }
    fits(b, lift);
  }

  private frame() {
    if (this.disposed || !this.act) return;
    // __rideStep: chỉ dùng khi tự kiểm trên máy không có GPU, cho phép mỗi khung hình nhảy bước dài hơn
    const cap = (window as unknown as { __rideStep?: number }).__rideStep ?? 0.05;
    const dt = Math.min(this.clock.getDelta(), cap), last = this.index === this.plan.length - 1;
    this.time += dt; this.actT += dt;
    if (!last && this.actT >= this.act.duration) this.next();
    const act = this.act;
    this.ctx.portrait = this.camera.aspect < 0.9; this.ctx.time = this.time;
    act.update(Math.min(this.actT, act.duration), dt, this.ctx);

    let fade = 1 - this.actT / FADE;
    if (!last) fade = Math.max(fade, (this.actT - (act.duration - FADE)) / FADE);
    this.veil.style.opacity = String(Math.min(1, Math.max(0, fade)));
    if (last && this.actT >= act.duration && !this.arrived) { this.arrived = true; this.opts.onArrive?.(); }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.renderer.setAnimationLoop(null); this.ro.disconnect();
    if (this.act) disposeTree(this.act.root);
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.renderer.dispose(); this.renderer.domElement.remove(); this.veil.remove();
    const w = window as unknown as { __ride?: unknown }; delete w.__ride;
  }
}

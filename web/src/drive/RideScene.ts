// Đạo diễn hoạt cảnh du lịch: chuỗi cảnh nối nhau bằng chuyển mờ, mỗi lúc chỉ dựng một cảnh và huỷ cảnh trước.
// 1 ra bến xe trước xóm → 2 xe đưa đón → 3 lên tàu/máy bay ở ga, sân bay, bến cảng (xe khách bỏ qua) → 4 trên đường → 5 tới nơi.
import * as THREE from 'three';
import { IS_MOBILE, Quality, debugScene, rendererParams } from '../perf.ts';
import { REGIONS } from '../../../shared/catalog.ts';
import type { Zone } from '../../../shared/catalog.ts';
import { GEO } from '../scene/plants.ts';
import { rng } from '../scene/plants.ts';
import { bake, gradient } from './RideKit.ts';
import { cloud } from './RideParts.ts';
import { Journey } from './RideJourney.ts';
import { Airport, BusStation, Port, TrainStation, Village } from './RideSets.ts';
import type { Act, Ctx, RideMode } from './RideSets.ts';
import { TaxiCabin, TaxiStop } from './TaxiRide.ts';
import type { SideHint } from './TaxiRide.ts';

export type { RideMode };
export interface RideOptions {
  mode: RideMode; fromRegionId: string; toRegionId: string;
  /** Thời lượng riêng của chặng "trên đường" (giây). */
  seconds: number;
  /** Ghi đè tên nơi đến (đi tới điểm tham quan chứ không phải vùng trồng). */
  toName?: string;
  /** Taxi: quãng đường, giá cước cho đồng hồ tính tiền, cảnh bên phải đường. */
  km?: number; fare?: number; sideHint?: SideHint;
  onMeter?: (dong: number) => void;
  /** Tiến độ chặng trên đường, 0..1. */
  onTick?: (progress: number) => void;
  /** Gọi mỗi khi sang cảnh mới: số hiệu cảnh, phụ đề, thứ tự trong kịch bản (từ 0) và tổng số cảnh. */
  onStage?: (stage: number, caption: string, index: number, total: number) => void;
  /** Tiến độ 0..1 của cảnh đang diễn. */
  onStep?: (frac: number) => void;
  /** Kịch bản riêng (hoạt cảnh xuất khẩu): nếu có thì bỏ qua kịch bản du lịch. */
  plan?: (() => Act)[];
  /** Màu trời (trên, dưới) cho kịch bản riêng. */
  sky?: [number, number];
  /** Gọi một lần khi cảnh cuối diễn xong. */
  onArrive?: () => void;
}

const FADE = 0.38;
const seedOf = (o: RideOptions) => [...(o.fromRegionId + o.toRegionId + o.mode)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 11);
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
  private journey: Journey | TaxiCabin | null = null;
  private actT = 0;
  private time = 0;
  private arrived = false;
  private disposed = false;
  private paused = false;
  private clouds = new THREE.Group();
  private lastFrac = -1;
  private ro: ResizeObserver;
  private container: HTMLElement;
  private opts: RideOptions;
  private ctx: Ctx;
  private box = new THREE.Box3();
  private target = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private corner = new THREE.Vector3();
  /** Mức tràn ngang cho phép ở màn dọc (1 = vừa khít mép). */
  private loose = 1.45;

  constructor(container: HTMLElement, opts: RideOptions) {
    this.container = container; this.opts = opts;
    const seconds = Math.min(30, Math.max(6, opts.seconds || 10)), mode = opts.mode;
    const from = REGIONS[opts.fromRegionId], to = REGIONS[opts.toRegionId];
    const zA: Zone = from?.zone ?? 'nam', zB: Zone = to?.zone ?? 'nam', fromName = from?.name ?? 'Nơi đi', toName = opts.toName ?? to?.name ?? 'Nơi đến';

    this.renderer = new THREE.WebGLRenderer(rendererParams(container));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = IS_MOBILE ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    container.appendChild(this.renderer.domElement);
    this.veil = document.createElement('div');
    this.veil.style.cssText = 'position:absolute;inset:0;background:#fdf6e3;opacity:1;pointer-events:none';
    container.appendChild(this.veil);

    const sky = opts.sky ?? [0x6fbdf0, 0xe4f5fb];
    this.scene.background = gradient(sky[0], sky[1]); this.fog.color.setHex(sky[1]);
    this.scene.fog = this.fog;
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.1);
    this.sun.position.set(18, 30, 12); this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 1, far: 120 });
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.05; this.sun.shadow.radius = 5;
    // Đèn viền xanh nhạt từ phía đối diện mặt trời để khối không bị bẹt
    const rim = new THREE.DirectionalLight(0xbfe3ff, 0.55); rim.position.set(-14, 12, -18);
    this.scene.add(new THREE.HemisphereLight(0xf4fbff, 0xcfe0a8, 1.25), this.sun, this.sun.target, rim);
    // Mây bông lơ lửng xa xa, dùng chung cho mọi cảnh
    const cr = rng(seedOf(opts)), C = new THREE.Group();
    for (let i = 0; i < 16; i++) { const c = cloud(cr), a = (i / 16) * Math.PI * 2 + cr(); c.position.set(Math.cos(a) * (190 + cr() * 120), 64 + cr() * 46, Math.sin(a) * (190 + cr() * 120)); c.rotation.y = cr() * 3; c.scale.setScalar(1.3 + cr() * 1.4); C.add(c); }
    this.clouds = bake(C); this.scene.add(this.clouds);

    this.ctx = { camera: this.camera, portrait: false, time: 0, shoot: (pts, yaw, pitch, signs) => this.shoot(pts, yaw, pitch, signs) };

    // Kịch bản: mỗi mục dựng cảnh của mình khi tới lượt
    let village: Village | null = null;
    const vehicleName = mode === 'taxi' ? 'Taxi' : mode === 'xe_khach' ? 'Xe khách' : mode === 'tau_hoa' ? 'Tàu hoả' : mode === 'may_bay' ? 'Máy bay' : 'Tàu thuỷ';
    const seed = [...(opts.fromRegionId + opts.toRegionId + mode)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
    if (opts.plan) this.plan = opts.plan;
    else {
    this.plan.push(() => (village = new Village(mode, zA, fromName)).first(), () => village!.second());
    if (mode === 'tau_hoa') this.plan.push(() => new TrainStation(zA, fromName, false).depart());
    if (mode === 'may_bay') this.plan.push(() => new Airport(zA, fromName, false).depart());
    if (mode === 'tau_thuy') this.plan.push(() => new Port(zA, fromName, false).depart());
    if (mode === 'taxi') {
      const km = opts.km ?? 20;
      this.plan.push(() => (this.journey = new TaxiCabin({
        host: container, zone: zB, toName, km, seconds: Math.max(9, seconds), fare: opts.fare ?? Math.round((12_000 + km * 2500) / 1000) * 1000, side: opts.sideHint, seed,
        caption: `Ngồi ghế sau taxi tới ${toName} · kéo màn hình để nhìn hai bên đường`, onTick: (p) => this.opts.onTick?.(p), onMeter: (d) => this.opts.onMeter?.(d),
      })), () => new TaxiStop(zB, toName).arrive());
    } else {
    this.plan.push(() => (this.journey = new Journey({
      mode, zoneA: zA, zoneB: zB, fromIsland: !!from?.island, toIsland: !!to?.island, seconds, seed,
      caption: `${vehicleName} đang trên đường tới ${toName}`, onTick: (p) => this.opts.onTick?.(p),
    })));
    this.plan.push(() => mode === 'xe_khach' ? new BusStation(zB, toName).arrive() : mode === 'tau_hoa' ? new TrainStation(zB, toName, true).arrive() : mode === 'may_bay' ? new Airport(zB, toName, true).arrive() : new Port(zB, toName, true).arrive());
    }
    }

    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container); this.resize();
    (window as unknown as { __ride?: unknown }).__ride = {
      pause: (v: boolean) => { this.paused = v; }, // đứng hình để chụp ảnh tự kiểm
      debug: () => ({
        stage: this.act?.stage ?? 0, scene: this.act?.stage ?? 0, index: this.index, acts: this.plan.length, caption: this.act?.caption ?? '', t: this.actT, duration: this.act?.duration ?? 0,
        progress: this.journey?.progress ?? 0, dist: this.journey?.dist ?? 0, total: this.journey?.total ?? 0, alt: this.journey?.alt ?? 0,
        elapsed: this.time, arrived: this.arrived, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      }),
    };
    this.next();
    this.quality = new Quality(this.renderer, { name: 'hoạt cảnh', onLevel: (l) => { this.sun.castShadow = l < (IS_MOBILE ? 1 : 2); } }); debugScene(this.scene); this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Sang cảnh kế: dựng cảnh mới, huỷ cảnh cũ (trừ khi hai cảnh dùng chung một bối cảnh). */
  private next() {
    const prev = this.act;
    this.index++;
    const act = this.plan[this.index]();
    prev?.dispose?.();
    if (this.camera.near !== 0.5) { this.camera.near = 0.5; this.camera.rotation.order = 'XYZ'; this.resize(); } // cảnh trong xe đổi ống kính, trả lại cho cảnh sau
    if (prev && prev.root !== act.root) { this.scene.remove(prev.root); disposeTree(prev.root); }
    if (!act.root.parent) this.scene.add(act.root);
    this.act = act; this.actT = 0;
    this.fog.near = act.fog[0]; this.fog.far = act.fog[1];
    this.opts.onStage?.(act.stage, act.caption, this.index, this.plan.length); this.lastFrac = -1;
    this.clock.getDelta(); // thời gian dựng cảnh không tính vào hoạt cảnh
  }

  private resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    if (this.quality) this.quality.resize(w, h); else this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.fov = w / h < 0.9 ? 52 : 42; this.camera.updateProjectionMatrix();
  }

  /** Lùi máy quay theo hướng (yaw, pitch) tới khi mọi điểm và mọi biển chữ lọt vào vùng an toàn: chừa chỗ cho bảng tiến độ ở trên và phụ đề ở dưới. */
  private shoot(pts: THREE.Vector3[], yaw: number, pitch: number, signs: THREE.Sprite[] = []) {
    const cam = this.camera, h = this.container.clientHeight || 1, portrait = this.ctx.portrait;
    const top = 1 - 2 * Math.min(0.3, (portrait ? 168 : 62) / h), bottom = -1 + 2 * Math.min(0.26, (portrait ? 96 : 62) / h);
    // Màn dọc: cho phép hai mép cảnh tràn ra ngoài khung để nhân vật và phương tiện to hơn; biển chữ thì luôn nằm trọn trong khung
    const side = portrait ? this.loose : 0.86, signSide = portrait ? 0.93 : 0.86;
    // Màn dọc hẹp nên biển chữ thu nhỏ lại để không ép máy quay lùi quá xa
    for (const s of signs) { const w = (s.userData.w ??= s.scale.x) * (portrait ? 0.66 : 1); s.scale.set(w, w / 4, 1); }
    this.box.setFromPoints(pts); for (const s of signs) this.box.expandByPoint(s.position);
    this.box.getCenter(this.target);
    this.dir.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const tmp = this.tmp, right = this.right, up = this.up;
    let lo = 1, hi = -1, ok = true;
    const see = (p: THREE.Vector3, lim = side) => { tmp.copy(p).project(cam); if (Math.abs(tmp.x) > lim || tmp.z > 1) ok = false; lo = Math.min(lo, tmp.y); hi = Math.max(hi, tmp.y); };
    const fits = (d: number, lift: number) => {
      cam.position.copy(this.target).addScaledVector(this.dir, d); cam.position.y += lift;
      cam.lookAt(this.target.x, this.target.y + lift, this.target.z); cam.updateMatrixWorld();
      right.setFromMatrixColumn(cam.matrixWorld, 0); up.setFromMatrixColumn(cam.matrixWorld, 1);
      lo = 1; hi = -1; ok = true;
      for (const p of pts) see(p);
      // Biển chữ luôn quay mặt về máy quay nên bốn góc tính theo trục ngang và trục dọc của máy quay
      for (const s of signs) for (const kx of [-0.5, 0.5]) for (const ky of [-0.5, 0.5]) see(this.corner.copy(s.position).addScaledVector(right, kx * s.scale.x).addScaledVector(up, ky * s.scale.y), signSide);
    };
    let a = 6, b = 420, lift = 0;
    for (let i = 0; i < 16; i++) {
      const d = (a + b) / 2, k = d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
      fits(d, lift);
      lift += ((hi + lo) / 2 - (top + bottom) / 2) * k; // căn giữa theo chiều dọc trong vùng an toàn rồi mới xét vừa khung
      fits(d, lift);
      if (ok && hi <= top && lo >= bottom) b = d; else a = d;
    }
    fits(b, lift);
    // Mặt trời đi theo điểm ngắm để bóng đổ luôn phủ vùng đang quay
    this.sun.target.position.copy(this.target); this.sun.position.set(this.target.x + 18, this.target.y + 30, this.target.z + 12);
  }

  private quality?: Quality;
  private frame() {
    if (this.disposed || !this.act) return;
    if (this.quality && !this.quality.tick()) { this.clock.getDelta(); return; }
    // __rideStep: chỉ dùng khi tự kiểm trên máy không có GPU, cho phép mỗi khung hình nhảy bước dài hơn
    const cap = (window as unknown as { __rideStep?: number }).__rideStep ?? 0.05;
    const dt = this.paused ? (this.clock.getDelta(), 0) : Math.min(this.clock.getDelta(), cap), last = this.index === this.plan.length - 1;
    this.time += dt; this.actT += dt;
    if (!last && this.actT >= this.act.duration) this.next();
    const act = this.act;
    this.ctx.portrait = this.camera.aspect < 0.9; this.ctx.time = this.time;
    act.update(Math.min(this.actT, act.duration), dt, this.ctx);
    const frac = Math.round(Math.min(1, this.actT / act.duration) * 50) / 50;
    if (frac !== this.lastFrac) { this.lastFrac = frac; this.opts.onStep?.(frac); }
    this.clouds.position.copy(this.camera.position).setY(0); this.clouds.rotation.y = this.time * 0.004;

    let fade = 1 - this.actT / FADE;
    if (!last) fade = Math.max(fade, (this.actT - (act.duration - FADE)) / FADE);
    this.veil.style.opacity = String(Math.min(1, Math.max(0, fade)));
    if (last && this.actT >= act.duration && !this.arrived) { this.arrived = true; this.opts.onArrive?.(); }
    this.renderer.render(this.scene, this.camera);
  }

  /** Taxi: -1 nhìn trái, 0 nhìn thẳng, 1 nhìn phải. */
  look(dir: number) { if (this.journey instanceof TaxiCabin && this.act === this.journey) this.journey.look(dir); }

  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.renderer.setAnimationLoop(null); this.ro.disconnect(); this.quality?.dispose();
    this.act?.dispose?.();
    if (this.act) disposeTree(this.act.root);
    disposeTree(this.clouds);
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove(); this.veil.remove();
    const w = window as unknown as { __ride?: unknown }; delete w.__ride;
  }
}

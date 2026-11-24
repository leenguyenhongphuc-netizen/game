// Cảnh 3D Trung tâm phục vụ hành chính công: sân trước có cột cờ, bãi xe máy; sảnh một cửa có máy lấy số, ghế chờ,
// bảng gọi số, sáu quầy có cán bộ ngồi. Người chơi đi bằng chạm (tự tìm lối qua lối đi giữa các dãy ghế) hoặc phím.
// Ai đang ở cùng trung tâm (cùng tỉnh) hiện ra qua presence (scene 'admin', key = tên tỉnh).
import * as THREE from 'three';
import { Quality, debugScene, rendererParams, stepDt } from '../perf.ts';
import { bakeColored } from '../scene/batch.ts';
import { makeFarmer } from '../scene/World.ts';
import { OthersLayer } from '../scene/others.ts';
import { PresenceLink } from '../presence.ts';
import { blobTex } from '../scene/tex.ts';
import { gradient } from '../drive/RideKit.ts';
import { V, ball, box, cyl, flag, glow, grp, lampPost, potPlant, tree } from '../sight/SightKit.ts';
import { COUNTERS } from '../../../shared/admin.ts';
import { CAMERA_FEEL } from '../cameraFeel.ts';
import type { CounterId } from '../../../shared/admin.ts';

export type Spot = CounterId | 'kiosk';
export interface AdminCallbacks { onNear: (spot: Spot | null) => void }
type Aabb = [number, number, number, number]; // minX, minZ, maxX, maxZ

// ---------------------------------------------------------------- bố cục (m)
const HALL = { x0: -19, x1: 19, z0: -12.5, z1: 8 };
const WALL_H = 4.6, DOOR = 3.2;
const COUNTER_X = [-13.5, -8.1, -2.7, 2.7, 8.1, 13.5], DESK_Z = -8.6;
/** Chỗ đứng trước từng quầy và máy lấy số. */
export const SPOTS: Record<Spot, THREE.Vector3> = {
  kiosk: V(-6.5, 0, 5.2),
  ...Object.fromEntries(COUNTERS.map((c, i) => [c.id, V(COUNTER_X[i], 0, DESK_Z + 1.6)])) as Record<CounterId, THREE.Vector3>,
};
const CHAIRS: Aabb[] = [[-11.4, -4.2, -1.6, 2.6], [1.6, -4.2, 11.4, 2.6]];
const START = V(0, 0, 28);
/** Bồn hoa cột cờ giữa sân: đi vòng hai bên. */
const FLAG_AT = V(-14, 0, 24);
const PLANTER: Aabb = [FLAG_AT.x - 2.3, FLAG_AT.z - 2.3, FLAG_AT.x + 2.3, FLAG_AT.z + 2.3];

function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Tấm biển chữ vẽ bằng canvas (chữ sắc, nhiều dòng). */
function textPlane(lines: string[], w: number, h: number, bg: string, fg: string, opts: { font?: number; bold?: boolean; border?: string } = {}): THREE.Mesh {
  const px = 128, cw = Math.round(w * px), ch = Math.round(h * px), c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const g = c.getContext('2d')!;
  g.fillStyle = bg; g.fillRect(0, 0, cw, ch);
  if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = Math.max(4, ch * 0.05); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, cw - g.lineWidth, ch - g.lineWidth); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  const size = (opts.font ?? 0.5) * px;
  lines.forEach((t, i) => {
    let s = i === 0 ? size : size * 0.72;
    g.font = `${opts.bold === false || i > 0 ? 600 : 800} ${s}px "Baloo 2", system-ui, sans-serif`;
    while (g.measureText(t).width > cw * 0.92 && s > 10) { s -= 2; g.font = `${i > 0 ? 600 : 800} ${s}px "Baloo 2", system-ui, sans-serif`; }
    g.fillText(t, cw / 2, ch * ((i + 0.5) / lines.length));
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  m.userData.own = true;
  return m;
}
function tileTex(a: string, b: string, n = 8): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!; g.fillStyle = a; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = b; g.lineWidth = 2; const s = 256 / n;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(256, i * s); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export class AdminScene {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera: THREE.PerspectiveCamera;
  private quality: Quality; private raf = 0; private last = 0; private time = 0; private disposed = false;
  private player = makeFarmer(0x5aa9e6); private blob: THREE.Mesh; private yaw = Math.PI; private walkK = 0;
  private pos = START.clone().add(V(Math.random() * 8 - 4, 0, Math.random() * 3)); private path: THREE.Vector3[] = []; private keys = new Set<string>();
  private blockers: Aabb[] = []; private cutaway = new THREE.Group(); private others: OthersLayer; private link: PresenceLink;
  private board: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture } | null = null; private boardText = '';
  private near: Spot | null = null; private camPos = new THREE.Vector3(); private camLook = new THREE.Vector3();
  private staff: { body: ReturnType<typeof makeFarmer>; ph: number }[] = [];
  private tap: { x: number; y: number; t: number } | null = null; private ray = new THREE.Raycaster(); private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private rnd = seeded(7);
  /** Góc máy quay quanh nhân vật (0 = đứng phía cổng nhìn vào toà nhà), kéo để xoay; cần điều khiển đi bộ. */
  private camYaw = 0; private camYawV = 0; private stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  private look: { id: number; x: number; on: boolean } | null = null; private stickEl: HTMLDivElement; private knobEl: HTMLDivElement;

  constructor(private host: HTMLElement, private province: string, private cb: AdminCallbacks) {
    this.renderer = new THREE.WebGLRenderer(rendererParams(host));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.quality = new Quality(this.renderer, { name: 'hành chính' }); debugScene(this.scene);
    host.appendChild(this.renderer.domElement); this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    this.stickEl = document.createElement('div'); this.stickEl.className = 'admin-stick'; this.knobEl = document.createElement('div'); this.knobEl.className = 'admin-knob';
    this.stickEl.appendChild(this.knobEl); host.appendChild(this.stickEl);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.3, 400);
    this.scene.background = gradient(0x9fd3f2, 0xe9f4fb); this.scene.fog = new THREE.Fog(0xe4eff6, 60, 150);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8f80, 1.15));
    const sun = new THREE.DirectionalLight(0xfff2d6, 1.5); sun.position.set(12, 30, 18); this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xdfeaff, 0.5); fill.position.set(-14, 10, -12); this.scene.add(fill);

    this.buildGround(); this.buildBuilding(); this.buildInterior(); this.buildPlaza();
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.45 }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.03; this.scene.add(this.blob);
    this.scene.add(this.player.root);
    this.others = new OthersLayer((shirt, hat, outfit) => makeFarmer(shirt, hat, outfit), { z: 3.6, halfX: 12 });
    this.scene.add(this.others.group);
    this.link = new PresenceLink(() => this.disposed ? null : { scene: 'admin', key: province, x: Math.round(this.pos.x * 100) / 100, z: Math.round(this.pos.z * 100) / 100, yaw: Math.round(this.yaw * 100) / 100, speed: this.path.length ? 4 : 0, walk: true },
      (list, at) => this.others.set(list, at));

    host.addEventListener('pointerdown', this.onDown); host.addEventListener('pointermove', this.onMove); host.addEventListener('pointerup', this.onUp); host.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey); window.addEventListener('keyup', this.onKey);
    window.addEventListener('resize', this.resize); this.resize();
    this.camPos.copy(this.pos).add(V(0, 6.2, 12)); this.camLook.copy(this.pos).add(V(0, 2.6, -3.5));
    (window as unknown as { __admin?: AdminScene }).__admin = this;
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------ dựng cảnh
  private buildGround() {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshLambertMaterial({ color: 0x86b86a }));
    grass.rotation.x = -Math.PI / 2; grass.position.y = -0.02; this.scene.add(grass);
    // sân lát gạch trước toà nhà và nền sảnh
    const plazaT = tileTex('#d9d2c4', '#c4bba9', 6); plazaT.repeat.set(10, 7);
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(46, 26), new THREE.MeshLambertMaterial({ map: plazaT }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.set(0, 0.005, 21); this.scene.add(plaza);
    const floorT = tileTex('#f1eee8', '#d8d3ca', 4); floorT.repeat.set(19, 10);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(HALL.x1 - HALL.x0, HALL.z1 - HALL.z0), new THREE.MeshLambertMaterial({ map: floorT }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.02, (HALL.z0 + HALL.z1) / 2); this.scene.add(floor);
    // đường phố phía trước
    const road = new THREE.Mesh(new THREE.PlaneGeometry(260, 9), new THREE.MeshLambertMaterial({ color: 0x5b5f66 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, 39); this.scene.add(road);
    const marks = new THREE.Group();
    for (let x = -120; x < 120; x += 6) marks.add(box(0xf4f1e6, x, 0.02, 39, 3, 0.02, 0.18));
    marks.add(box(0xbdb8ae, 0, 0.08, 34.3, 260, 0.16, 0.5), box(0xbdb8ae, 0, 0.08, 43.7, 260, 0.16, 0.5));
    this.scene.add(bakeColored(marks));
  }

  private buildBuilding() {
    const stat = new THREE.Group(), cut = this.cutaway;
    const wallIn = 0xf6efe2, wallOut = 0xf4f1ea, trim = 0xc9b48a, glass = 0x6fa3c7, blue = 0x2457a6;
    const { x0, x1, z0, z1 } = HALL;
    // tường sau, hai bên (luôn hiện) — phía trong màu kem, chân tường ốp gạch
    stat.add(box(wallIn, 0, WALL_H / 2, z0 - 0.2, x1 - x0 + 0.8, WALL_H, 0.4));
    for (const x of [x0 - 0.2, x1 + 0.2]) stat.add(box(wallIn, x, WALL_H / 2, (z0 + z1) / 2, 0.4, WALL_H, z1 - z0 + 0.4));
    stat.add(box(0xb9a98a, 0, 0.35, z0 + 0.02, x1 - x0, 0.7, 0.06));
    for (const x of [x0 + 0.02, x1 - 0.02]) stat.add(box(0xb9a98a, x, 0.35, (z0 + z1) / 2, 0.06, 0.7, z1 - z0));
    // cửa sổ hai bên hông
    for (const x of [x0 - 0.42, x1 + 0.42]) for (let z = z0 + 3; z < z1 - 1; z += 4.2) stat.add(box(glass, x, 2.4, z, 0.05, 1.8, 2.6));
    this.blockers.push([x0 - 0.6, z0 - 0.6, x1 + 0.6, z0 + 0.1], [x0 - 0.6, z0, x0 + 0.1, z1], [x1 - 0.1, z0, x1 + 0.6, z1]);
    // tường trước có cửa kính lớn (ẩn khi vào trong để nhìn thấy sảnh)
    const seg = (xa: number, xb: number) => cut.add(box(wallOut, (xa + xb) / 2, WALL_H / 2, z1 + 0.2, xb - xa, WALL_H, 0.4));
    seg(x0 - 0.4, -DOOR); seg(DOOR, x1 + 0.4);
    cut.add(box(wallOut, 0, WALL_H - 0.6, z1 + 0.2, DOOR * 2, 1.2, 0.4));
    for (let x = x0 + 2.4; x < x1 - 1; x += 4.4) if (Math.abs(x) > DOOR + 1.4) cut.add(box(glass, x, 2.3, z1 + 0.42, 2.6, 2.2, 0.05));
    this.blockers.push([x0 - 0.6, z1, -DOOR, z1 + 0.5], [DOOR, z1, x1 + 0.6, z1 + 0.5]);
    // tầng trên, mái bằng có lan can, dải cửa kính xanh
    const up = new THREE.Group();
    up.add(box(wallOut, 0, WALL_H + 2.3, (z0 + z1) / 2 - 0.2, x1 - x0 + 1.2, 4.6, z1 - z0 + 1.2));
    for (let x = x0 + 1.5; x < x1 - 1; x += 3.1) up.add(box(glass, x, WALL_H + 2.4, z1 + 0.42, 2.2, 2.6, 0.06), box(0xdcd6c8, x + 1.55, WALL_H + 2.3, z1 + 0.45, 0.4, 4.4, 0.1));
    up.add(box(trim, 0, WALL_H + 0.08, z1 + 0.5, x1 - x0 + 1.6, 0.25, 0.3), box(0xe8e2d4, 0, WALL_H + 4.75, (z0 + z1) / 2 - 0.2, x1 - x0 + 1.8, 0.35, z1 - z0 + 1.8));
    up.add(box(0xd8d2c2, 0, WALL_H + 5.2, z1 + 0.8, x1 - x0 + 1.8, 0.6, 0.15));
    // khối giữa cao hơn: mặt tiền có quốc huy giản lược (vòng tròn đỏ – sao vàng) và chữ tên trung tâm
    up.add(box(wallOut, 0, WALL_H + 5.6, z1 - 1.2, 12, 2.4, 3.6), box(trim, 0, WALL_H + 6.9, z1 - 1.2, 12.4, 0.3, 4));
    up.add(cyl(0xc8281e, 0, WALL_H + 5.6, z1 + 0.62, 0.8, 0.08), ball(glow(0xffd23f), 0, WALL_H + 5.6, z1 + 0.7, 0.32, 0.32, 0.05));
    cut.add(up);
    // sảnh cửa chính: mái đón, bốn cột, bậc tam cấp
    const port = new THREE.Group();
    port.add(box(0xe9e4d8, 0, WALL_H + 0.1, z1 + 2.3, DOOR * 2 + 4.6, 0.4, 4.4), box(blue, 0, WALL_H - 0.2, z1 + 4.45, DOOR * 2 + 4.6, 0.3, 0.12));
    for (const x of [-DOOR - 1.6, -DOOR + 0.4, DOOR - 0.4, DOOR + 1.6]) port.add(cyl(0xf7f4ee, x, WALL_H / 2, z1 + 4, 0.28, WALL_H));
    for (let i = 0; i < 3; i++) port.add(box(0xd9d2c4, 0, 0.06 + i * 0.06, z1 + 1.4 + i * -0.4 + 1.2, DOOR * 2 + 4 - i * 0.6, 0.12 + i * 0.06, 1.4));
    stat.add(port);
    // khung cửa kính trượt (mở sẵn)
    for (const x of [-DOOR - 0.15, DOOR + 0.15]) stat.add(box(0x8f9aa6, x, (WALL_H - 1.2) / 2, z1 + 0.2, 0.3, WALL_H - 1.2, 0.45));
    this.scene.add(bakeColored(stat));
    const cutBaked = bakeColored(cut); this.cutaway = cutBaked; this.scene.add(cutBaked);
    // biển tên trên mái đón
    const sign = textPlane(['TRUNG TÂM PHỤC VỤ HÀNH CHÍNH CÔNG', `TỈNH, THÀNH PHỐ ${this.province.toUpperCase()}`], 11, 1.3, '#b3261e', '#ffe27a', { font: 0.55 });
    sign.position.set(0, WALL_H + 0.85, z1 + 4.52); this.cutaway.add(sign);
    const top = textPlane([this.province.toUpperCase()], 9, 1.1, '#f4f1ea', '#b3261e', { font: 0.7 });
    top.position.set(0, WALL_H + 4.1, z1 + 0.62); this.cutaway.add(top);
  }

  private buildInterior() {
    const g = new THREE.Group(), blue = 0x2457a6, wood = 0xa8743f;
    const { x0, x1, z0 } = HALL;
    // dãy quầy một cửa
    g.add(box(0xf4f1ea, 0, 0.55, DESK_Z, x1 - x0 - 4, 1.1, 0.9), box(wood, 0, 1.14, DESK_Z + 0.05, x1 - x0 - 3.8, 0.08, 1.05), box(blue, 0, 0.8, DESK_Z + 0.46, x1 - x0 - 4, 0.22, 0.03));
    this.blockers.push([x0 + 2, DESK_Z - 0.5, x1 - 2, DESK_Z + 0.55]);
    COUNTER_X.forEach((x, i) => {
      // vách kính ngăn quầy, máy tính, ghế cán bộ, số quầy
      if (i > 0) g.add(box(0xb8d4e6, x - 2.7, 1.75, DESK_Z, 0.05, 1.2, 0.9));
      g.add(box(0x2b2f36, x - 0.5, 1.45, DESK_Z - 0.2, 0.75, 0.5, 0.05), box(0x2b2f36, x - 0.5, 1.22, DESK_Z - 0.2, 0.1, 0.18, 0.1), box(0x9aa3ad, x + 0.5, 1.2, DESK_Z + 0.1, 0.5, 0.06, 0.35));
      g.add(box(0x31343a, x, 0.5, DESK_Z - 1.4, 0.7, 0.12, 0.7), box(0x31343a, x, 0.95, DESK_Z - 1.75, 0.7, 0.9, 0.1), cyl(0x6b6f76, x, 0.25, DESK_Z - 1.4, 0.05, 0.5));
      const no = textPlane([`QUẦY ${COUNTERS[i].no}`, COUNTERS[i].short], 2.6, 1.05, '#2457a6', '#ffffff', { font: 0.48 });
      no.position.set(x, 3.1, DESK_Z + 0.2); this.scene.add(no);
      const staff = makeFarmer([0xf7f7f2, 0xdfe8f5, 0xf7f7f2][i % 3], 'none'); staff.root.position.set(x, 0.18, DESK_Z - 1.25); staff.root.scale.setScalar(1.05);
      staff.legL.visible = staff.legR.visible = false; this.scene.add(staff.root); this.staff.push({ body: staff, ph: i * 1.3 });
      g.add(box(0xe2dccf, x + 0.9, 1.2, DESK_Z + 0.3, 0.35, 0.03, 0.25)); // phiếu hồ sơ
    });
    // tủ hồ sơ phía sau cán bộ
    for (let x = x0 + 3; x < x1 - 2; x += 3.2) g.add(box(0xcfc6b5, x, 1.1, z0 + 0.7, 2.6, 2.2, 0.7), box(0xb8ae9a, x, 1.1, z0 + 1.06, 0.04, 2.0, 0.02));
    // băng rôn và bảng gọi số trên tường sau
    const banner = textPlane(['MỘT CỬA – MỘT LẦN – TẬN TÌNH – ĐÚNG HẸN'], 20, 0.9, '#b3261e', '#ffe27a', { font: 0.55 });
    banner.position.set(0, 4.05, z0 + 0.02); this.scene.add(banner);
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const led = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    led.position.set(0, 3.05, z0 + 0.08); this.scene.add(led); this.board = { canvas: c, tex }; this.drawBoard({});
    g.add(box(0x1c1f24, 0, 3.05, z0 + 0.01, 8.3, 2.25, 0.05));
    // ghế chờ: dãy ghế liền khung thép, mặt xanh
    for (const [ax, az, bx, bz] of CHAIRS) {
      for (let z = az + 0.6; z < bz; z += 1.6) {
        g.add(box(0x8a9099, (ax + bx) / 2, 0.42, z, bx - ax, 0.06, 0.12));
        for (let x = ax + 0.35; x < bx; x += 0.62) g.add(box(0x2f6fb8, x, 0.5, z, 0.5, 0.08, 0.48), box(0x2f6fb8, x, 0.82, z + 0.24, 0.5, 0.55, 0.06));
        for (const x of [ax + 0.1, bx - 0.1]) g.add(box(0x6b6f76, x, 0.22, z, 0.06, 0.44, 0.45));
      }
      this.blockers.push([ax, az, bx, bz]);
    }
    // người dân ngồi chờ
    for (let i = 0; i < 9; i++) {
      const p = makeFarmer([0xe86f5a, 0x7cc48a, 0xf2c14e, 0x9b7fd1, 0x5aa9e6][i % 5], i % 3 === 0 ? 'non_la' : 'none');
      const block = CHAIRS[i % 2], row = Math.floor(this.rnd() * 4), seat = Math.floor(this.rnd() * 14);
      p.root.position.set(block[0] + 0.35 + seat * 0.62, 0.32, block[1] + 0.6 + row * 1.6 + 0.05); p.root.rotation.y = Math.PI; p.root.scale.setScalar(0.95);
      p.legL.rotation.x = p.legR.rotation.x = -1.3; this.scene.add(p.root);
    }
    // máy lấy số, quầy hướng dẫn, cây cảnh, bình nước
    const k = SPOTS.kiosk;
    g.add(box(0xe9edf2, k.x, 0.75, k.z - 0.9, 0.9, 1.5, 0.6), box(0x2457a6, k.x, 1.75, k.z - 0.9, 0.9, 0.5, 0.6), box(0x0f2a4a, k.x, 1.2, k.z - 0.58, 0.6, 0.45, 0.03));
    this.blockers.push([k.x - 0.55, k.z - 1.3, k.x + 0.55, k.z - 0.5]);
    const ks = textPlane(['LẤY SỐ', 'THỨ TỰ'], 0.9, 0.5, '#2457a6', '#ffffff', { font: 0.22 }); ks.position.set(k.x, 1.75, k.z - 0.59); this.scene.add(ks);
    g.add(box(0xf4f1ea, 7, 0.55, 5.4, 3.2, 1.1, 0.8), box(wood, 7, 1.14, 5.4, 3.4, 0.08, 1));
    this.blockers.push([5.2, 4.9, 8.8, 5.9]);
    const info = makeFarmer(0xdfe8f5, 'none'); info.root.position.set(7, 0.18, 4.4); info.legL.visible = info.legR.visible = false; this.scene.add(info.root);
    const isg = textPlane(['HƯỚNG DẪN'], 2.4, 0.5, '#2f7d26', '#ffffff', { font: 0.32 }); isg.position.set(7, 1.6, 5.82); this.scene.add(isg);
    for (const [x, z] of [[x0 + 1, 7], [x1 - 1, 7], [x0 + 1, -4], [x1 - 1, -4], [-3.8, 7.2], [3.8, 7.2]] as [number, number][]) { const pp = potPlant(0x4c9f55, 1.4); pp.position.set(x, 0, z); g.add(pp); }
    g.add(cyl(0xdfe6ee, x1 - 1.2, 0.6, 1.5, 0.3, 1.2), cyl(0x9ad0f5, x1 - 1.2, 1.45, 1.5, 0.25, 0.5));
    this.scene.add(bakeColored(g));
  }

  private buildPlaza() {
    const g = new THREE.Group(), r = this.rnd;
    // cột cờ giữa sân, bồn hoa tròn
    // cột cờ đặt lệch về bên trái sân (không chắn biển tên và lối vào khi nhìn từ cổng)
    const fx = FLAG_AT.x, fz = FLAG_AT.z;
    const f = flag(11); f.position.set(fx, 0, fz); g.add(f);
    g.add(cyl(0xd9d2c4, fx, 0.25, fz, 2.2, 0.5), cyl(0x5a9a4a, fx, 0.52, fz, 2.0, 0.08));
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; g.add(ball([0xe85aa0, 0xffd23f, 0xff7a45][i % 3], fx + Math.cos(a) * 1.6, 0.68, fz + Math.sin(a) * 1.6, 0.22)); }
    this.blockers.push(PLANTER);
    // hàng cây hai bên, đèn sân, ghế đá
    for (let z = 12; z <= 31; z += 4.6) for (const x of [-21, 21]) { const t = tree(r, 1.25); t.position.set(x, 0, z); g.add(t); }
    for (const x of [-9, 9]) for (const z of [14, 28]) { g.add(lampPost(x, 0, z, 4.2)); }
    for (const x of [-12.5, 12.5]) for (const z of [19, 24]) g.add(box(0x9a8f80, x, 0.45, z, 2.2, 0.12, 0.6), box(0x8a8070, x - 0.8, 0.22, z, 0.2, 0.44, 0.5), box(0x8a8070, x + 0.8, 0.22, z, 0.2, 0.44, 0.5));
    // bãi xe máy có mái che
    g.add(box(0xb7c3cc, 16.5, 2.6, 15, 6, 0.12, 7), ...[13.8, 19.2].flatMap((x) => [11.8, 18.2].map((z) => cyl(0x8a9099, x, 1.3, z, 0.08, 2.6))));
    for (let i = 0; i < 9; i++) {
      const z = 12.3 + i * 0.75, c = [0xd0312d, 0x2b2f36, 0xf2f2f2, 0x2457a6, 0x7cc48a][i % 5];
      g.add(box(c, 16.5, 0.55, z, 1.7, 0.35, 0.35), box(0x1d1f22, 15.7, 0.3, z, 0.12, 0.6, 0.6), box(0x1d1f22, 17.3, 0.3, z, 0.12, 0.6, 0.6), box(0x3a3a3a, 15.9, 0.95, z, 0.06, 0.5, 0.06));
    }
    this.blockers.push([13.5, 11.5, 19.5, 18.5]);
    // hàng rào thấp và cổng
    for (const x of [-23, 23]) g.add(box(0xe6e0d2, x, 0.4, 21, 0.3, 0.8, 26));
    for (const [a, b] of [[-23, -4], [4, 23]]) g.add(box(0xe6e0d2, (a + b) / 2, 0.45, 33.6, b - a, 0.9, 0.3));
    for (const x of [-4, 4]) g.add(box(0xd8d0bf, x, 1.2, 33.6, 0.7, 2.4, 0.7));
    this.blockers.push([-24, 33.3, -3.6, 34], [3.6, 33.3, 24, 34], [-24, 8, -22.6, 34], [22.6, 8, 24, 34]);
    // nhà phố hai bên đường, đối diện
    for (let i = 0; i < 12; i++) {
      const x = -62 + i * 11 + r() * 2, h = 5 + r() * 7, c = [0xf2d7a6, 0xe9b9a0, 0xcfe0c3, 0xf4ecd8, 0xbfd6e8][i % 5];
      g.add(box(c, x, h / 2, 48 + r() * 2, 9, h, 7), box(0x6fa3c7, x, h * 0.6, 44.4, 6, 1.2, 0.05), box(0xb3261e, x, 1.8, 44.2, 8, 0.3, 0.6));
    }
    for (const x of [-40, -32, 32, 40]) { const t = tree(r, 1.4, true); t.position.set(x, 0, 6 + r() * 20); g.add(t); }
    this.scene.add(bakeColored(g));
  }

  // ------------------------------------------------ bảng gọi số
  /** Cập nhật bảng LED: số đang được mời tới từng quầy. */
  setCalled(called: Record<string, { no: string } | undefined>) { this.drawBoard(called); }
  private drawBoard(called: Record<string, { no: string } | undefined>) {
    if (!this.board) return;
    const key = JSON.stringify(called); if (key === this.boardText) return; this.boardText = key;
    const { canvas: c, tex } = this.board, g = c.getContext('2d')!;
    g.fillStyle = '#0b0d10'; g.fillRect(0, 0, c.width, c.height);
    g.font = '800 40px system-ui, sans-serif'; g.textBaseline = 'middle';
    g.fillStyle = '#ff5a3c'; g.textAlign = 'center'; g.fillText('MỜI CÔNG DÂN CÓ SỐ THỨ TỰ', c.width / 2, 36);
    COUNTERS.forEach((ct, i) => {
      const col = i % 3, row = Math.floor(i / 3), x = 30 + col * 330, y = 112 + row * 80;
      g.textAlign = 'left'; g.fillStyle = '#ffd23f'; g.font = '700 34px system-ui, sans-serif'; g.fillText(`Q${ct.no}`, x, y);
      g.fillStyle = '#5cff7a'; g.font = '800 52px ui-monospace, monospace'; g.fillText(called[ct.id]?.no ?? '----', x + 70, y);
    });
    tex.needsUpdate = true;
  }

  // ------------------------------------------------ điều khiển
  /** Đi tới một điểm (tự đi vòng qua lối đi). */
  walkTo(target: THREE.Vector3) {
    const p = this.pos, t = target.clone(), inside = (v: THREE.Vector3) => v.z < HALL.z1 + 0.2, pts: THREE.Vector3[] = [];
    const DOOR_IN = V(0, 0, HALL.z1 - 1.6), DOOR_OUT = V(0, 0, HALL.z1 + 2.2);
    const routeInside = (a: THREE.Vector3, b: THREE.Vector3) => {
      const crosses = (u: THREE.Vector3, v: THREE.Vector3) => CHAIRS.some(([ax, az, bx, bz]) => { for (let k = 0; k <= 20; k++) { const x = u.x + (v.x - u.x) * k / 20, z = u.z + (v.z - u.z) * k / 20; if (x > ax - 0.5 && x < bx + 0.5 && z > az - 0.5 && z < bz + 0.5) return true; } return false; });
      if (!crosses(a, b)) return [b];
      let best: THREE.Vector3[] = [b], bestLen = Infinity;
      for (const ax of [-14.6, 0, 14.6]) {
        const route = [V(ax, 0, Math.min(Math.max(a.z, -6.2), 5.4)), V(ax, 0, Math.min(Math.max(b.z, -6.2), 5.4)), b];
        const len = a.distanceTo(route[0]) + route[0].distanceTo(route[1]) + route[1].distanceTo(b);
        if (len < bestLen && !crosses(a, route[0]) && !crosses(route[1], b)) { best = route; bestLen = len; }
      }
      return best;
    };
    // ngoài sân: nếu đường thẳng cắt bồn hoa cột cờ thì vòng qua bên gần hơn
    const routeOutside = (a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] => {
      const [ax, az, bx, bz] = PLANTER;
      let hit = false; for (let k = 0; k <= 20 && !hit; k++) { const x = a.x + (b.x - a.x) * k / 20, z = a.z + (b.z - a.z) * k / 20; hit = x > ax - 0.6 && x < bx + 0.6 && z > az - 0.6 && z < bz + 0.6; }
      if (!hit) return [b];
      const side = (a.x + b.x) / 2 >= (ax + bx) / 2 ? bx + 1.4 : ax - 1.4;
      const south = a.z > (az + bz) / 2; // a ở phía cổng (z lớn)
      return [V(side, 0, south ? bz + 0.8 : az - 0.8), V(side, 0, south ? az - 0.8 : bz + 0.8), b];
    };
    if (inside(p) && inside(t)) pts.push(...routeInside(p, t));
    else if (!inside(p) && inside(t)) pts.push(...routeOutside(p, DOOR_OUT), DOOR_IN, ...routeInside(DOOR_IN, t));
    else if (inside(p) && !inside(t)) pts.push(...routeInside(p, DOOR_IN), DOOR_OUT, ...routeOutside(DOOR_OUT, t));
    else pts.push(...routeOutside(p, t));
    this.path = pts;
  }
  goToSpot(s: Spot) { this.walkTo(SPOTS[s]); }
  // Chạm nửa trái phía dưới = cần điều khiển đi bộ (gốc đặt tại chỗ chạm); chỗ khác: kéo ngang để xoay máy quay,
  // chạm nhanh xuống sàn = tự đi tới đó.
  private onDown = (e: PointerEvent) => {
    const r = this.host.getBoundingClientRect(), lx = e.clientX - r.left, ly = e.clientY - r.top;
    this.tap = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (!this.stick && lx < r.width * 0.5 && ly > r.height * 0.42) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }; this.path = [];
      this.stickEl.style.left = `${lx}px`; this.stickEl.style.top = `${ly}px`; this.stickEl.classList.add('on'); this.knobEl.style.transform = 'translate(-50%,-50%)';
    } else if (!this.look) this.look = { id: e.pointerId, x: e.clientX, on: false };
    try { this.host.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
  };
  private onMove = (e: PointerEvent) => {
    const st = this.stick;
    if (st && st.id === e.pointerId) {
      st.x = e.clientX; st.y = e.clientY;
      let dx = st.x - st.ox, dy = st.y - st.oy; const d = Math.hypot(dx, dy), m = CAMERA_FEEL.stickFullPx;
      if (d > m) { dx *= m / d; dy *= m / d; }
      this.knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      return;
    }
    const lk = this.look;
    if (lk && lk.id === e.pointerId) {
      const dx = e.clientX - lk.x;
      if (!lk.on) { if (Math.abs(dx) < CAMERA_FEEL.deadzonePx) return; lk.on = true; lk.x = e.clientX; return; }
      lk.x = e.clientX; const a = -dx * CAMERA_FEEL.yawPerPx; this.camYaw += a; this.camYawV = a * 60;
    }
  };
  private onUp = (e: PointerEvent) => {
    if (this.stick?.id === e.pointerId) { this.stick = null; this.stickEl.classList.remove('on'); }
    const wasLook = this.look?.id === e.pointerId ? this.look : null; if (wasLook) this.look = null;
    const t = this.tap; this.tap = null;
    if (e.type !== 'pointerup' || !t || wasLook?.on || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 12 || performance.now() - t.t > 600) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = new THREE.Vector3();
    if (this.ray.ray.intersectPlane(this.ground, hit)) this.walkTo(hit);
  };
  private onKey = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase(); if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return;
    if (e.type === 'keydown') { this.keys.add(k); this.path = []; } else this.keys.delete(k);
  };
  private collide(v: THREE.Vector3) {
    const R = 0.45;
    v.x = Math.min(HALL.x1 + 4, Math.max(HALL.x0 - 4, v.x)); v.z = Math.min(33, Math.max(HALL.z0 + 0.6, v.z));
    for (const [ax, az, bx, bz] of this.blockers) {
      if (v.x > ax - R && v.x < bx + R && v.z > az - R && v.z < bz + R) {
        const dl = v.x - (ax - R), dr = bx + R - v.x, dt = v.z - (az - R), db = bz + R - v.z, m = Math.min(dl, dr, dt, db);
        if (m === dl) v.x = ax - R; else if (m === dr) v.x = bx + R; else if (m === dt) v.z = az - R; else v.z = bz + R;
      }
    }
  }

  // ------------------------------------------------ vòng vẽ
  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.quality.tick(now)) { if (!this.quality.throttled) this.last = now; return; }
    const dt = stepDt(this.last ? (now - this.last) / 1000 : 0.016); this.last = now; this.time += dt;
    // di chuyển: phím hoặc theo lộ trình
    const SPEED = 4.2; let mx = 0, mz = 0;
    let sx = 0, sy = 0, sp = 1;
    if (this.keys.size) {
      if (this.keys.has('w') || this.keys.has('arrowup')) sy -= 1; if (this.keys.has('s') || this.keys.has('arrowdown')) sy += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) sx -= 1; if (this.keys.has('d') || this.keys.has('arrowright')) sx += 1;
    } else if (this.stick) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy, d = Math.hypot(dx, dy);
      if (d > CAMERA_FEEL.stickDeadPx) { const k = Math.min(1, (d - CAMERA_FEEL.stickDeadPx) / (CAMERA_FEEL.stickFullPx - CAMERA_FEEL.stickDeadPx)); sp = Math.pow(k, CAMERA_FEEL.stickCurve); sx = dx / d; sy = dy / d; }
    }
    if (sx || sy) { // hướng theo máy quay: đẩy lên = đi xa khỏi máy quay
      const c = Math.cos(this.camYaw), s2 = Math.sin(this.camYaw);
      mx = (sx * c + sy * s2) * sp; mz = (-sx * s2 + sy * c) * sp;
    } else if (this.path.length) {
      const goal = this.path[0], dx = goal.x - this.pos.x, dz = goal.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.25) this.path.shift(); else { mx = dx / d; mz = dz / d; }
    }
    const moving = mx !== 0 || mz !== 0;
    if (moving) {
      const l = Math.hypot(mx, mz), step = Math.min(SPEED * dt * Math.min(1, l), this.path.length ? Math.hypot(this.path[0].x - this.pos.x, this.path[0].z - this.pos.z) : 99);
      const before = this.pos.clone(); this.pos.x += (mx / l) * step; this.pos.z += (mz / l) * step; this.collide(this.pos);
      if (this.path.length && before.distanceTo(this.pos) < step * 0.2) this.path.shift(); // bị chặn: bỏ điểm này
      const want = Math.atan2(mx, mz), d = Math.atan2(Math.sin(want - this.yaw), Math.cos(want - this.yaw)); this.yaw += d * Math.min(1, dt * 12);
    }
    this.walkK += ((moving ? 1 : 0) - this.walkK) * Math.min(1, dt * 10);
    const b = this.player, sw = Math.sin(this.time * 12) * 0.8 * this.walkK;
    b.root.position.set(this.pos.x, Math.abs(Math.sin(this.time * 12)) * 0.06 * this.walkK, this.pos.z); b.root.rotation.y = this.yaw;
    b.legL.rotation.x = sw; b.legR.rotation.x = -sw; b.armL.rotation.x = -sw; b.armR.rotation.x = sw;
    this.blob.position.set(this.pos.x, 0.03, this.pos.z);
    for (const s of this.staff) { s.body.armR.rotation.x = -0.9 + Math.sin(this.time * 6 + s.ph) * 0.25; s.body.armL.rotation.x = -0.8; }
    this.others.update(dt, this.time);
    // trong sảnh: ẩn tường trước, tầng trên để nhìn thấy quầy; máy quay cao hơn
    const inside = this.pos.z < HALL.z1 + 0.6;
    this.cutaway.visible = !inside;
    // máy quay xoay quanh nhân vật theo camYaw (kéo để xoay, có quán tính); trong sảnh chỉ cho xoay về phía tường trước đã ẩn
    if (!this.look?.on && Math.abs(this.camYawV) > 1e-3) { this.camYaw += this.camYawV * dt; this.camYawV *= Math.exp(-dt / CAMERA_FEEL.inertiaTau); }
    if (inside) { const lim = 1.05; this.camYaw = Math.max(-lim, Math.min(lim, this.camYaw)); }
    const dist = inside ? 10.5 : 12, h = inside ? 9.5 : 6.2;
    const want = V(this.pos.x + Math.sin(this.camYaw) * dist, h, this.pos.z + Math.cos(this.camYaw) * dist);
    // không để máy quay chui vào toà nhà khi ở ngoài: tường trước là mặt z = HALL.z1
    if (!inside && want.z < HALL.z1 + 1.2 && want.x > HALL.x0 - 1 && want.x < HALL.x1 + 1) want.z = HALL.z1 + 1.2;
    if (inside) { want.x = Math.max(HALL.x0 + 1, Math.min(HALL.x1 - 1, want.x)); }
    want.x = Math.max(-40, Math.min(40, want.x)); want.z = Math.max(HALL.z0 + 1, Math.min(50, want.z));
    // ngoài sân nhìn hơi về phía trước nhân vật và cao hơn để thấy cả biển tên toà nhà
    const ahead = inside ? 0 : 3.5, look = V(this.pos.x - Math.sin(this.camYaw) * ahead, inside ? 1.4 : 2.6, this.pos.z - Math.cos(this.camYaw) * ahead);
    const k = 1 - Math.exp(-dt * 6); this.camPos.lerp(want, k); this.camLook.lerp(look, 1 - Math.exp(-dt * 10));
    this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook);
    // nhãn tên người khác chỉ hiện khi ở gần (không chồng lên biển tên toà nhà); bong bóng chat vẫn hiện
    for (const root of this.others.group.children) {
      const nearMe = Math.hypot(root.position.x - this.pos.x, root.position.z - this.pos.z) < 8;
      for (const ch of root.children) if ((ch as THREE.Sprite).isSprite && ch !== root.userData.saySp) ch.visible = nearMe;
    }
    // đứng trước quầy nào
    let near: Spot | null = null;
    for (const [id, p] of Object.entries(SPOTS) as [Spot, THREE.Vector3][]) if (Math.hypot(p.x - this.pos.x, p.z - this.pos.z) < 1.5) near = id;
    if (near !== this.near) { this.near = near; this.cb.onNear(near); }
    this.renderer.render(this.scene, this.camera);
  };
  private resize = () => { const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1; this.quality.resize(w, h); this.camera.aspect = w / h; this.camera.fov = w < h ? 62 : 48; this.camera.updateProjectionMatrix(); };
  state() { return { x: Math.round(this.pos.x * 10) / 10, z: Math.round(this.pos.z * 10) / 10, near: this.near, walking: this.path.length > 0, camYaw: Math.round(this.camYaw * 100) / 100, others: this.others.list() }; }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.quality.dispose(); this.link.stop(); this.others.dispose();
    this.host.removeEventListener('pointerdown', this.onDown); this.host.removeEventListener('pointermove', this.onMove); this.host.removeEventListener('pointerup', this.onUp); this.host.removeEventListener('pointercancel', this.onUp); this.stickEl.remove();
    window.removeEventListener('keydown', this.onKey); window.removeEventListener('keyup', this.onKey); window.removeEventListener('resize', this.resize);
    this.scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.own) { m.geometry.dispose(); const mm = m.material as THREE.MeshBasicMaterial; mm.map?.dispose(); mm.dispose(); } });
    this.board?.tex.dispose();
    this.renderer.dispose(); this.renderer.forceContextLoss(); this.renderer.domElement.remove();
  }
}

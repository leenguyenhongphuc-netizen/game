// Các cảnh tĩnh của hoạt cảnh du lịch: bến xe trước xóm, nhà ga, sân bay, bến cảng, bến xe nơi đến.
// Quy ước: phương tiện chạy dọc trục z về phía -z, máy quay luôn đứng bên +x (phía cửa lên xuống), hậu cảnh ở bên -x.
import * as THREE from 'three';
import type { Zone } from '../../../shared/catalog.ts';
import { GEO, mat, mesh, rng } from '../scene/plants.ts';
import { SCENERY, THEMES, bake } from './RideKit.ts';
import {
  FERRY_DECK, FERRY_PLANK_Z, PLANE_DOOR_Z, PLANE_Y, TRAIN_DOOR_Z, V3, Walker, buildBus, buildFerry, buildMinibus, buildPlane, buildTaxi, buildTrain,
  Gulls, Smoke, Wake, chamTower, clockPost, coffeeHill, crateStack, ease, fishRaft, harbourCrane, karst, lampPost, lighthouse, nhaRong, person, seaSurface, seg, sign, terraces, timeBoard, warehouse,
} from './RideParts.ts';
import type { Sea } from './RideParts.ts';

export type RideMode = 'xe_khach' | 'tau_hoa' | 'may_bay' | 'tau_thuy' | 'taxi';

export interface Ctx {
  camera: THREE.PerspectiveCamera;
  portrait: boolean;
  /** Thời gian chạy từ đầu hoạt cảnh (giây). */
  time: number;
  /** Đặt máy quay theo hướng (yaw, pitch) sao cho mọi điểm nằm trong vùng an toàn của khung hình. */
  shoot(points: THREE.Vector3[], yaw: number, pitch: number, signs?: THREE.Sprite[]): void;
}
export interface Act {
  stage: number;
  caption: string;
  duration: number;
  root: THREE.Group;
  fog: [number, number];
  update(t: number, dt: number, c: Ctx): void;
  /** Gỡ phần nghe sự kiện riêng của cảnh (nếu có) khi cảnh kết thúc. */
  dispose?(): void;
}

export const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
const WATER = 0x7fd3e8;

export function slab(color: number, rough = 1): THREE.Mesh {
  const m = mesh(GEO.box, mat(color, { rough }), 0, -0.1, 0, 900, 0.2, 900); m.castShadow = false; return m;
}
export function box(S: THREE.Group, color: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, opts?: { rough?: number; transparent?: number; emissive?: number }) {
  S.add(mesh(GEO.box, mat(color, opts), x, y, z, sx, sy, sz));
}
export function post(S: THREE.Group, color: number, x: number, y0: number, z: number, h: number, r = 0.12) { S.add(mesh(GEO.cyl, mat(color), x, y0 + h / 2, z, r, h, r)); }
export function prop(S: THREE.Group, o: THREE.Group, x: number, y: number, z: number, scale = 1, rotY = 0) { o.position.set(x, y, z); o.scale.setScalar(scale); o.rotation.y = rotY; S.add(o); }

/** Hậu cảnh phía -x theo miền: cây cối, nhà cửa và công trình điểm nhấn; núi xa. */
export function backdrop(S: THREE.Group, root: THREE.Group, zone: Zone, r: () => number, near = 13) {
  const th = THEMES[zone];
  if (zone === 'dao') { box(S, WATER, -260, 0.02, 0, 400, 0.1, 700, { rough: 0.25 }); box(S, 0xf6ecc6, -58, 0.04, 0, 8, 0.12, 700); }
  const edge = zone === 'dao' ? -52 : -74;
  for (let i = 0; i < 44; i++) {
    const kind = th.kinds[Math.floor(r() * th.kinds.length)], x = -(near + r() * (-edge - near)), z = (r() - 0.5) * 170;
    const flat = kind === 'rice' || kind === 'dune' || kind === 'pond';
    prop(S, SCENERY[kind](), flat ? Math.min(x, -near - 6) : x, 0, z, kind === 'pole' ? 1 : 0.9 + r() * 0.5, kind === 'house' ? Math.PI / 2 : r() * 6.28);
  }
  if (zone === 'bac') { prop(S, karst(r), -86, 0, -30); prop(S, karst(r), -92, 0, 34); prop(S, terraces(), -44, 0, 12, 1, Math.PI / 2); }
  else if (zone === 'trung') { prop(S, chamTower(), -40, 0, -14, 1.1, 0.4); for (let i = 0; i < 4; i++) prop(S, SCENERY.dune(), -30 - r() * 30, 0, (r() - 0.5) * 80, 1.6, r() * 6); }
  else if (zone === 'taynguyen') { prop(S, nhaRong(), -34, 0, 14, 1.1, 0.3); prop(S, coffeeHill(r), -58, 0, -20, 1.2); prop(S, coffeeHill(r), -66, 0, 36, 1.1, 0.5); }
  else if (zone === 'nam') { box(S, WATER, -34, 0.03, 0, 9, 0.1, 400, { rough: 0.25 }); for (let i = 0; i < 4; i++) prop(S, SCENERY.ghe(), -34 + (r() - 0.5) * 3, 0.05, -50 + i * 30 + r() * 8, 1.2); for (let i = 0; i < 12; i++) prop(S, SCENERY.palm(), -27 - (i % 2) * 14 + r() * 2, 0, (r() - 0.5) * 120, 1 + r() * 0.4, r() * 6); }
  else { prop(S, fishRaft(), -74, 0, 14, 1, 0.3); prop(S, lighthouse(), -110, 0, -40); for (let i = 0; i < 5; i++) prop(S, SCENERY[i % 2 ? 'ghe' : 'islet'](), -70 - r() * 60, 0, (r() - 0.5) * 160, 1.2, r() * 6); }
  if (th.mountains !== null) for (let i = 0; i < 9; i++) {
    const h = 28 + r() * 30, m = mesh(new THREE.ConeGeometry(24 + r() * 16, h, 7), mat(th.mountains, { rough: 1 }), -(130 + r() * 60), h / 2 - 2, -200 + i * 50 + r() * 20);
    m.castShadow = false; m.rotation.y = r() * 3; root.add(m);
  }
}

export function roadAlongZ(S: THREE.Group, color: number) {
  box(S, color, 0, 0.02, 0, 8, 0.12, 500);
  for (const x of [-3.85, 3.85]) box(S, 0xfbf3df, x, 0.04, 0, 0.26, 0.12, 500);
  for (let z = -140; z <= 140; z += 7) box(S, 0xffffff, 0, 0.05, z, 0.26, 0.12, 2.6);
}

/** Rải vài người đứng chờ: mỗi mục là [x, y, z, hướng quay]. */
export function crowd(S: THREE.Group, list: [number, number, number, number][], seed = 0) {
  list.forEach(([x, y, z, rot], i) => prop(S, person(i + seed), x, y, z, 1.25, rot));
}

/** Lắc nhẹ theo bánh xe khi đang chạy. */
export const bob = (time: number, moving: number) => Math.abs(Math.sin(time * 18)) * 0.03 * moving;

// ================================================================ cảnh 1 + 2: bến xe trước xóm
export class Village {
  readonly root = new THREE.Group();
  private w = new Walker();
  private car: THREE.Group;
  private door: number; private sideX: number; private half: number; private high: number;
  private pts1: THREE.Vector3[]; private pts2: THREE.Vector3[]; private signs: THREE.Sprite[] = [];
  private path = [V3(10.2, 0, 6.5), V3(6.5, 0, 6.4), V3(5.0, 0, 1.4)];
  private mode: RideMode; private from: string;

  constructor(mode: RideMode, zone: Zone, from: string) {
    this.mode = mode; this.from = from;
    const r = rng(hash(from + mode + 'xom')), S = new THREE.Group(), th = THEMES[zone];
    this.root.add(slab(th.ground));
    roadAlongZ(S, th.road);
    // Vỉa hè, nhà chờ, cột biển dừng xe
    box(S, 0xe9dfc8, 5.5, 0.06, -2.2, 3.2, 0.16, 15);
    const stop = mode !== 'taxi'; // taxi đón ngay trước cổng vườn nên không có nhà chờ, biển bến xe
    if (stop) {
    box(S, 0x6fb7d9, 6.4, 2.98, -5.0, 2.7, 0.2, 5.2); box(S, 0xfffaf0, 6.4, 3.12, -5.0, 2.3, 0.1, 4.8);
    for (const z of [-7.3, -2.7]) { post(S, 0xf2c65c, 7.5, 0, z, 2.9, 0.09); post(S, 0xf2c65c, 5.4, 0, z, 2.9, 0.09); }
    box(S, 0xbfe6f7, 7.55, 1.6, -5.0, 0.06, 1.9, 4.4, { transparent: 0.45 });
    box(S, 0xc99a68, 7.0, 0.62, -5.0, 0.55, 0.12, 3.4); for (const z of [-6.4, -3.6]) box(S, 0x8a6a4a, 7.0, 0.3, z, 0.4, 0.6, 0.12);
    post(S, 0x8f97a3, 4.5, 0, -0.6, 2.6, 0.07);
    const disc = mesh(GEO.cyl, mat(0x2a7fd6), 4.5, 2.9, -0.6, 0.48, 0.1, 0.48); disc.rotation.z = Math.PI / 2; S.add(disc);
    }
    const label = sign(stop ? `Bến xe ${from}` : `Cổng vườn · ${from}`, stop ? '#2a7fd6' : '#2f9a4a', 6.6, 7.3, 4.7, 3.7); this.root.add(label); post(S, 0x8f97a3, 7.3, 0, 3.7, 3.9, 0.08);
    if (stop) prop(S, timeBoard(1.6, 1.0), 7.46, 2.0, -6.4, 1, Math.PI); prop(S, lampPost(4.6), 4.6, 0, -9.4, 1, Math.PI);
    if (stop) crowd(S, [[6.9, 0.16, -6.2, -1.6], [6.2, 0.16, -3.4, -1.9], [5.3, 0.16, -8.6, -1.2]], hash(from) & 7);
    else { crowd(S, [[6.6, 0.16, -7.4, -1.4]], hash(from) & 7); prop(S, SCENERY.bush(), 6.9, 0, -4.4, 0.7); prop(S, SCENERY.leaf(), 7.2, 0, -9.6, 0.9); }
    box(S, 0x4fa86a, 4.7, 0.5, -10.6, 0.6, 0.9, 0.6); box(S, 0x3f8f52, 4.7, 0.98, -10.6, 0.66, 0.08, 0.66);
    // Vườn nhà: hàng rào, cổng, nhà, lối đi
    box(S, 0xb7e69a, 14.6, 0.03, 9.2, 12, 0.08, 13.6); box(S, 0xe9dfc8, 7.4, 0.05, 6.5, 3.4, 0.1, 1.5);
    for (let z = 2.6; z <= 16; z += 1.1) if (z < 5.4 || z > 7.6) post(S, 0xfff6e2, 8.6, 0, z, 1.05, 0.08);
    box(S, 0xfff6e2, 8.6, 0.75, 4.0, 0.08, 0.1, 3.0); box(S, 0xfff6e2, 8.6, 0.75, 11.8, 0.08, 0.1, 8.6);
    for (const z of [2.6, 16]) { box(S, 0xfff6e2, 14.6, 0.75, z, 12, 0.1, 0.08); for (let x = 9.7; x <= 20.6; x += 1.1) post(S, 0xfff6e2, x, 0, z, 1.05, 0.08); }
    for (const z of [5.5, 7.5]) box(S, 0xc98a52, 8.6, 1.25, z, 0.36, 2.5, 0.36);
    box(S, 0xf08a6c, 8.6, 2.62, 6.5, 0.7, 0.22, 2.9); box(S, 0xfffaf0, 8.6, 2.36, 6.5, 0.2, 0.3, 1.5);
    prop(S, SCENERY.house(), 15.4, 0, 10.6, 1.5, -Math.PI / 2); prop(S, SCENERY.leaf(), 17.5, 0, 13.6, 0.9); prop(S, SCENERY.bush(), 11.5, 0, 13.4, 0.7); prop(S, SCENERY.bush(), 12, 0, 4.2, 0.6);
    for (let i = 0; i < 7; i++) S.add(mesh(GEO.ball, mat([0xf29bc0, 0xffd23f, 0xfffaf0][i % 3]), 9.2 + r() * 0.5, 0.25, 3 + i * 1.9 + (i > 1 ? 1.4 : 0), 0.16));
    // Cây ven đường, cột điện và hậu cảnh
    for (const [x, z] of [[7.5, -17], [9.5, -27], [8, -41], [7.5, 23], [10.5, 33], [8, 46]]) prop(S, SCENERY[zone === 'taynguyen' ? 'pine' : zone === 'nam' || zone === 'dao' ? 'palm' : 'leaf'](), x, 0, z, 1 + r() * 0.3, r() * 6);
    for (let z = -70; z <= 70; z += 28) prop(S, SCENERY.pole(), -5.4, 0, z);
    backdrop(S, this.root, zone, r);
    this.root.add(bake(S, true));

    const cab = mode === 'may_bay' || mode === 'taxi';
    const raw = mode === 'xe_khach' ? buildBus() : cab ? buildTaxi() : buildMinibus();
    [this.door, this.sideX, this.half, this.high] = mode === 'xe_khach' ? [-4.1, 1.3, 5.1, 3.8] : cab ? [0.3, 0.9, 2.2, 2.0] : [-1.5, 1.07, 2.9, 2.9];
    this.car = bake(raw, true); if (mode === 'taxi') this.car.add(sign('TAXI', '#1f7a3a', 1.5, 0, 2.25, 0.1));
    this.car.position.set(1.9, 0, 120); this.root.add(this.car, this.w.g);
    this.w.g.position.copy(this.path[0]); this.w.g.rotation.y = -Math.PI / 2;
    this.pts1 = [V3(10.4, 0, 8.4), V3(8.6, 3.2, 8.2), V3(4, 0, -8.2), V3(0, 0, 0)]; this.signs = [label];
    const z0 = 1.4 - this.door;
    this.pts2 = [V3(0.4, 0, z0 - this.half), V3(3.4, this.high, z0 + this.half), V3(3.4, 0, z0 + this.half), V3(0.4, this.high, z0 - this.half), V3(9, 0, 8.2), V3(4, 0, -8.2)]; this.signs = [label];
  }

  first(): Act {
    const D = 4.6;
    return {
      stage: 1, caption: this.mode === 'taxi' ? `Ra đầu ngõ ${this.from} gọi taxi` : `Ra bến xe ${this.from}`, duration: D, root: this.root, fog: [90, 300],
      update: (t, _dt, c) => {
        const u = seg(t, 0.25, D - 0.55);
        this.w.walk(this.path, u, c.time);
        if (u >= 1) this.w.face(-1, 0.25);
        c.shoot(this.pts1, c.portrait ? 2.86 : 1.98, c.portrait ? 0.52 : 0.3, this.signs);
      },
    };
  }

  second(): Act {
    const D = 5, stop = 1.4 - this.door, m = this.mode;
    const where = m === 'tau_hoa' ? 'ga' : m === 'may_bay' ? 'sân bay' : 'bến cảng';
    return {
      stage: 2, caption: m === 'taxi' ? `Taxi tới đón, lên xe ngồi hàng ghế sau` : m === 'xe_khach' ? `Xe khách giường nằm tới đón ở bến xe ${this.from}` : `Xe đưa ra ${where} ${this.from}`, duration: D, root: this.root, fog: [90, 300],
      update: (t, _dt, c) => {
        const arrive = seg(t, 0, 1.8), leave = Math.max(0, t - 3.4);
        this.car.position.z = stop + 52 * (1 - arrive) ** 2 - 6.5 * leave * leave;
        this.car.position.y = bob(c.time, arrive < 1 || leave > 0 ? 1 : 0);
        const b = seg(t, 2.0, 3.0), end = this.path[2];
        this.w.g.position.set(THREE.MathUtils.lerp(end.x, 1.9 + this.sideX + 0.3, b), 0, end.z);
        this.w.face(-1, b > 0 ? 0 : 0.25); this.w.pose(c.time * 11, b > 0 && b < 1); this.w.hide(seg(b, 0.72, 1));
        c.shoot(this.pts2, c.portrait ? 2.86 : 2.2, c.portrait ? 0.5 : 0.27, this.signs);
      },
    };
  }
}

// ================================================================ nhà ga xe lửa (cảnh 3 và 5 của tàu hoả)
export class TrainStation {
  readonly root = new THREE.Group();
  private w = new Walker();
  private train = new THREE.Group();
  private door: THREE.Mesh;
  private puffs: THREE.Mesh[] = [];
  private toot: THREE.Sprite;
  private pts: THREE.Vector3[]; private signs: THREE.Sprite[] = [];
  private name: string;

  constructor(zone: Zone, name: string, arrival: boolean) {
    this.name = name;
    const r = rng(hash(name + 'ga' + arrival)), S = new THREE.Group(), th = THEMES[zone];
    this.root.add(slab(th.ground));
    box(S, 0xc9bfae, 0, 0.02, 0, 5.2, 0.3, 500);
    for (const x of [-1.15, 1.15]) box(S, 0x6b7280, x, 0.24, 0, 0.18, 0.22, 500, { rough: 0.4 });
    for (let z = -110; z <= 110; z += 1.7) box(S, 0x8a6a4a, 0, 0.16, z, 3.4, 0.16, 0.5);
    // Sân ga bên +x, mái che một đoạn, ghế chờ, đèn
    box(S, 0xd9d2c4, 5.6, 0.45, 0, 7.8, 0.9, 110); box(S, 0xf2c65c, 2.05, 0.91, 0, 0.26, 0.04, 110);
    box(S, arrival ? 0x6fb7d9 : 0xd9482b, 6.2, 5.3, 28, 5.6, 0.3, 28); box(S, 0xfffaf0, 6.2, 5.05, 28, 5.0, 0.2, 27.4);
    for (let z = 15; z <= 41; z += 6.5) { post(S, 0x4fa3a5, 8.4, 0.9, z, 4.3, 0.14); box(S, 0x4fa3a5, 7.2, 4.9, z, 2.6, 0.16, 0.16); }
    for (const z of [-9, 20, 30]) { box(S, 0xc99a68, 8.2, 1.42, z, 0.6, 0.12, 2.6); box(S, 0x8a6a4a, 8.2, 1.15, z - 1, 0.4, 0.5, 0.12); box(S, 0x8a6a4a, 8.2, 1.15, z + 1, 0.4, 0.5, 0.12); }
    for (const z of [-16, -3, 9]) { post(S, 0x4a5160, 8.9, 0.9, z, 3.6, 0.07); S.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), 8.9, 4.6, z, 0.22)); }
    prop(S, clockPost(3.6), 8.6, 0.9, 13.5); prop(S, timeBoard(3.6, 2), 9.3, 3.2, 25, 1, Math.PI);
    crowd(S, [[7.6, 0.9, 6.5, -1.7], [8.0, 0.9, -5.5, -1.5], [6.8, 0.9, 17, -2.0], [7.9, 0.9, 22.5, -1.4], [5.2, 0.9, -13, -1.8]], hash(name) & 7);
    prop(S, crateStack(3), 8.3, 0.9, -19, 1, 0.3);
    // Nhà ga phía sau đường ray
    box(S, 0xfff0cf, -11, 3.1, 0, 8.4, 6.2, 26); box(S, arrival ? 0x6fb7d9 : 0xd9482b, -11, 6.5, 0, 10, 0.6, 27.6); box(S, 0xfffaf0, -11, 7.4, 0, 4, 1.4, 6);
    for (const z of [-9.5, -5.2, 5.2, 9.5]) box(S, 0xa9dcf2, -6.78, 3.5, z, 0.08, 2.2, 2.2, { rough: 0.25 });
    box(S, 0x9a7150, -6.78, 1.6, 0, 0.08, 3.0, 2.6); S.add(mesh(GEO.ball, mat(0xfffaf0), -6.7, 5.3, 0, 0.2, 0.7, 0.7));
    box(S, 0xd9d2c4, -5.4, 0.25, 0, 2.6, 0.5, 30);
    const label = sign(arrival ? `Chào mừng đến ${name}` : `Ga ${name}`, arrival ? '#d9482b' : '#2a7fd6', arrival ? 15 : 11, -6.6, 9.9, 0); this.root.add(label);
    backdrop(S, this.root, zone, r, 20);
    this.root.add(bake(S, true));

    const body = bake(buildTrain(), true);
    this.train.add(body, mesh(GEO.box, mat(0x3f5566), 1.32, 2.15, TRAIN_DOOR_Z, 0.05, 2.2, 1.1));
    this.door = mesh(GEO.box, mat(0x4fa3a5), 1.36, 2.15, TRAIN_DOOR_Z, 0.06, 2.2, 1.1); this.train.add(this.door);
    this.train.position.y = 0.3; this.root.add(this.train, this.w.g);
    for (let i = 0; i < 7; i++) { const m = mesh(GEO.ball, mat(0xffffff, { transparent: 0.8 }), 0, -50, 0, 0.5); m.castShadow = false; this.puffs.push(m); this.root.add(m); }
    this.toot = sign('Tu tu… tu!', '#f08a6c', 4.4, 3, 8.4, -14); this.toot.visible = false; this.root.add(this.toot);
    this.pts = [V3(-1.4, 0, -18.7), V3(1.4, 0, 12), V3(0, 4.9, -18.7), V3(0, 4.9, 12), V3(9.2, 0.9, 6), V3(9.2, 0.9, -12)]; this.signs = [label];
  }

  private steam(time: number, power: number) {
    this.puffs.forEach((m, i) => {
      const k = (time * (0.5 + power) + i / this.puffs.length) % 1;
      m.position.set(Math.sin(k * 5 + i) * 0.5, 4.9 + k * (3 + power * 3), this.train.position.z - 16.8 + k * power * 4); m.scale.setScalar(0.3 + k * (0.6 + power * 0.45));
    });
  }
  private cam(c: Ctx) { c.shoot(this.pts, c.portrait ? 2.84 : 2.3, c.portrait ? 0.46 : 0.17, this.signs); }

  depart(): Act {
    const D = 6, P = [V3(5.6, 0.9, 3.4), V3(3.6, 0.9, TRAIN_DOOR_Z + 0.4), V3(1.9, 0.9, TRAIN_DOOR_Z)];
    this.w.g.position.copy(P[0]); this.w.g.rotation.y = Math.PI;
    return {
      stage: 3, caption: `Lên tàu ở ga ${this.name}`, duration: D, root: this.root, fog: [110, 330],
      update: (t, _dt, c) => {
        const u = seg(t, 0.2, 2.9);
        this.w.walk(P, u, c.time); this.w.hide(seg(u, 0.93, 1));
        this.door.position.z = TRAIN_DOOR_Z - 1.15 * (1 - ease(seg(t, 3.0, 3.6)));
        const whistle = seg(t, 3.5, 4.6), go = Math.max(0, t - 4.3);
        this.toot.visible = whistle > 0 && t < 5.2; this.toot.scale.setScalar(1).multiply(V3(4.4, 1.1, 1)).multiplyScalar(0.7 + 0.3 * Math.sin(Math.min(1, whistle * 2) * Math.PI / 2));
        this.train.position.z = -3.4 * go * go; this.train.position.y = 0.3 + bob(c.time, go > 0 ? 0.6 : 0);
        this.toot.position.z = this.train.position.z - 14;
        this.steam(c.time, whistle > 0 ? 1 : 0.25); this.cam(c);
      },
    };
  }

  arrive(): Act {
    const D = 5.2, P = [V3(1.9, 0.9, TRAIN_DOOR_Z), V3(4.2, 0.9, TRAIN_DOOR_Z - 0.4), V3(6.4, 0.9, TRAIN_DOOR_Z - 4.4)];
    this.w.hide(1);
    return {
      stage: 5, caption: `Tàu vào ga ${this.name}`, duration: D, root: this.root, fog: [110, 330],
      update: (t, _dt, c) => {
        const k = seg(t, 0, 2.5);
        this.train.position.z = 70 * (1 - k) ** 2; this.train.position.y = 0.3 + bob(c.time, k < 1 ? 0.6 : 0);
        this.door.position.z = TRAIN_DOOR_Z - 1.15 * ease(seg(t, 2.6, 3.0));
        const u = seg(t, 3.0, 4.7);
        if (t >= 3.0) { this.w.walk(P, u, c.time); this.w.hide(1 - seg(u, 0, 0.1)); if (u >= 1) this.w.face(1, -0.4); }
        this.steam(c.time, k < 1 ? 0.7 : 0.2); this.cam(c);
      },
    };
  }
}

// ================================================================ sân bay (cảnh 3 và 5 của máy bay)
export class Airport {
  readonly root = new THREE.Group();
  private w = new Walker();
  private plane = new THREE.Group();
  private stairs = new THREE.Group();
  private door: THREE.Mesh;
  private pts: THREE.Vector3[]; private signs: THREE.Sprite[] = [];
  private name: string;
  private static readonly STAIR_X = 6.3;

  constructor(zone: Zone, name: string, arrival: boolean) {
    this.name = name;
    const r = rng(hash(name + 'sanbay' + arrival)), S = new THREE.Group(), th = THEMES[zone], col = arrival ? 0xf08a6c : 0x6fb7d9;
    this.root.add(slab(th.ground));
    box(S, 0xb9bfc9, 2, 0.03, 0, 44, 0.12, 260); box(S, 0xf2c65c, 0, 0.1, 0, 0.3, 0.04, 260);
    for (const z of [-12, 12]) box(S, 0xfffaf0, 8, 0.1, z, 14, 0.04, 0.3);
    box(S, 0x8f97a3, 0, 0.05, -150, 400, 0.14, 30); for (let x = -180; x <= 180; x += 14) box(S, 0xffffff, x, 0.14, -150, 6, 0.04, 0.7);
    // Nhà ga hành khách và đài kiểm soát phía -x
    box(S, 0xfffaf0, -27, 4.5, 0, 14, 9, 64); box(S, 0x7fb9d9, -19.94, 4.7, 0, 0.1, 5.8, 58, { rough: 0.25 }); box(S, col, -27, 9.35, 0, 16, 0.7, 66);
    for (let z = -27; z <= 27; z += 9) box(S, 0xfffaf0, -19.9, 4.7, z, 0.2, 5.8, 0.5);
    box(S, col, -18.4, 2.2, 10, 3.4, 0.3, 8); for (const z of [7, 13]) post(S, 0xfffaf0, -17, 0, z, 2.2, 0.12);
    S.add(mesh(GEO.cyl, mat(0xfffaf0), -29, 12, -42, 2.2, 24, 2.2), mesh(GEO.cyl, mat(0x7fb9d9, { rough: 0.25 }), -29, 24.8, -42, 3.4, 2.4, 3.4), mesh(GEO.cyl, mat(col), -29, 26.4, -42, 3.7, 0.6, 3.7));
    const label = sign(arrival ? `Chào mừng đến ${name}` : `Sân bay ${name}`, arrival ? '#d9482b' : '#2a7fd6', arrival ? 17 : 14, -19.6, 12.2, 0); this.root.add(label);
    for (let x = -180; x <= 180; x += 12) for (const dz of [-16, 16]) S.add(mesh(GEO.ball, mat(dz < 0 ? 0xfff3b0 : 0x9fe0ff, { emissive: dz < 0 ? 0xffe08a : 0x6fc8ff }), x, 0.22, -150 + dz, 0.22));
    for (let z = -100; z <= 100; z += 10) S.add(mesh(GEO.ball, mat(0x9fe0ff, { emissive: 0x6fc8ff }), 23.6, 0.2, z, 0.2));
    // Ống lồng kính từ nhà ga vươn ra sân đỗ, mái che lối đi bộ
    box(S, 0xe9edf2, -14.5, 3.4, -24, 11, 2.4, 2.8); box(S, 0x7fb9d9, -14.5, 3.6, -22.58, 10.4, 1.2, 0.06, { rough: 0.25 }); box(S, 0x7fb9d9, -14.5, 3.6, -25.42, 10.4, 1.2, 0.06, { rough: 0.25 });
    for (const x of [-18, -11]) post(S, 0xb9bfc9, x, 0, -24, 2.3, 0.22);
    box(S, col, -8.6, 3.4, -24, 1.4, 2.8, 3.2);
    crowd(S, [[12.4, 0, 2.0, -1.8], [13.2, 0, 4.2, -1.5], [-16.4, 0, 8.6, 1.4], [-16.2, 0, 11.8, 1.7]], hash(name) & 7);
    for (const z of [-34, 32]) prop(S, lampPost(7), -18.6, 0, z, 1, Math.PI);
    // Xe hành lý, cọc tiêu
    box(S, 0xf2c65c, 11, 0.75, 7, 1.5, 0.9, 2.4); box(S, 0x4a5160, 11, 0.3, 7, 1.3, 0.2, 2.2);
    for (let i = 0; i < 2; i++) { box(S, 0xe9edf2, 11, 0.45, 10 + i * 2.4, 1.5, 0.2, 2.0); box(S, [0xf08a6c, 0x6fb7d9][i], 11, 0.85, 10 + i * 2.4, 1.1, 0.6, 1.4); }
    for (const [x, z] of [[9, -9], [9, 3.5], [-9.5, -9], [-9.5, 9]]) S.add(mesh(GEO.cone, mat(0xf08a24), x, 0.4, z, 0.25, 0.7, 0.25));
    for (let i = 0; i < 10; i++) prop(S, SCENERY[th.kinds[i % th.kinds.length] === 'rice' ? 'leaf' : th.kinds[i % th.kinds.length]](), -40 - r() * 26, 0, (r() - 0.5) * 150, 1.1, r() * 6);
    backdrop(S, this.root, zone, r, 44);
    this.root.add(bake(S, true));

    this.plane.add(bake(buildPlane(), true), mesh(GEO.box, mat(0x3f5566), 1.0, 0.45, PLANE_DOOR_Z, 0.5, 1.5, 0.9));
    this.door = mesh(GEO.box, mat(0xfffdf6, { rough: 0.5 }), 1.04, 0.45, PLANE_DOOR_Z, 0.5, 1.5, 0.92); this.plane.add(this.door);
    this.plane.position.y = PLANE_Y;
    // Thang lên máy bay: gốc ở chân thang, bậc dâng dần về phía -x
    const st = new THREE.Group(), top = 2.16;
    for (let i = 0; i < 8; i++) st.add(mesh(GEO.box, mat(0xe9edf2), -0.25 - i * 0.5, (i + 1) * 0.135, 0, 0.52, (i + 1) * 0.27, 1.3));
    st.add(mesh(GEO.box, mat(0xe9edf2), -4.5, top / 2, 0, 1.0, top, 1.3));
    for (const z of [-0.68, 0.68]) { const rail = mesh(GEO.box, mat(0xf2c65c), -2.0, 2.0, z, 4.6, 0.1, 0.08); rail.rotation.z = -0.49; st.add(rail, mesh(GEO.box, mat(0xf2c65c), -4.5, 3.0, z, 1.0, 0.1, 0.08), mesh(GEO.cyl, mat(0xf2c65c), -4.05, 2.6, z, 0.04, 0.9, 0.04), mesh(GEO.cyl, mat(0xf2c65c), -0.1, 0.6, z, 0.04, 0.9, 0.04)); }
    this.stairs.add(bake(st, true)); this.stairs.position.set(Airport.STAIR_X, 0, PLANE_DOOR_Z);
    this.root.add(this.plane, this.stairs, this.w.g);
    this.pts = [V3(-8.3, 0, -9.4), V3(8.3, 0, 10.6), V3(8.3, 0, -9.4), V3(-8.3, 0, 10.6), V3(0, 6, 9.8), V3(0, 3.6, -9.2), V3(11, 0, -2)]; this.signs = [label];
  }

  private cam(c: Ctx) { c.shoot(this.pts, c.portrait ? 2.25 : 2.05, c.portrait ? 0.5 : 0.2, this.signs); }

  depart(): Act {
    const D = 6.2, X = Airport.STAIR_X, P = [V3(10.6, 0, -1.6), V3(X + 0.4, 0, PLANE_DOOR_Z), V3(X - 4.1, 2.16, PLANE_DOOR_Z), V3(1.5, 2.16, PLANE_DOOR_Z)];
    this.w.g.position.copy(P[0]); this.w.g.rotation.y = -2;
    return {
      stage: 3, caption: `Lên máy bay ở sân bay ${this.name}`, duration: D, root: this.root, fog: [160, 420],
      update: (t, _dt, c) => {
        const u = seg(t, 0.2, 3.3);
        this.w.walk(P, u, c.time); this.w.hide(seg(u, 0.95, 1));
        this.door.visible = t > 3.5;
        this.stairs.position.x = X + 9 * ease(seg(t, 3.5, 4.5));
        const go = Math.max(0, t - 4.3);
        this.plane.position.z = -2.6 * go * go; this.plane.position.y = PLANE_Y + bob(c.time, go > 0 ? 0.5 : 0);
        this.cam(c);
      },
    };
  }

  arrive(): Act {
    const D = 5.6, X = Airport.STAIR_X, P = [V3(1.5, 2.16, PLANE_DOOR_Z), V3(X - 4.1, 2.16, PLANE_DOOR_Z), V3(X + 0.4, 0, PLANE_DOOR_Z), V3(10.2, 0, -2.4)];
    this.w.hide(1); this.stairs.position.x = X + 9;
    return {
      stage: 5, caption: `Hạ cánh xuống sân bay ${this.name}`, duration: D, root: this.root, fog: [160, 420],
      update: (t, _dt, c) => {
        const k = seg(t, 0, 2.5), air = 1 - seg(t, 0, 1.0);
        this.plane.position.set(0, PLANE_Y + air * air * 7 + bob(c.time, k < 1 && air === 0 ? 0.5 : 0), 95 * (1 - k) ** 2);
        this.plane.rotation.x = air * 0.1;
        this.stairs.position.x = X + 9 * (1 - ease(seg(t, 2.3, 3.1)));
        this.door.visible = t < 3.0;
        const u = seg(t, 3.2, 5.2);
        if (t >= 3.2) { this.w.walk(P, u, c.time); this.w.hide(1 - seg(u, 0, 0.06)); if (u >= 1) this.w.face(1, -0.3); }
        this.cam(c);
      },
    };
  }
}

// ================================================================ bến cảng (cảnh 3 và 5 của tàu thuỷ)
export class Port {
  readonly root = new THREE.Group();
  private w = new Walker();
  private ferry: THREE.Group;
  private plank: THREE.Mesh;
  private sea: Sea = seaSurface(1300, 130);
  private wake = new Wake(2.5, 30);
  private smoke = new Smoke(8);
  private gulls = new Gulls(5);
  private pts: THREE.Vector3[]; private signs: THREE.Sprite[] = [];
  private name: string; private s: number;

  /** s = +1: đất liền ở phía +z (tàu rời bến đi về -z); s = -1: đất liền ở phía -z (tàu cập bến). */
  constructor(zone: Zone, name: string, arrival: boolean) {
    this.name = name; const s = this.s = arrival ? -1 : 1;
    const r = rng(hash(name + 'cang' + arrival)), S = new THREE.Group(), th = THEMES[zone], col = arrival ? 0xf08a6c : 0x6fb7d9;
    this.root.add(this.sea.mesh);
    // Bờ: kè đá, bãi cát, đất liền
    box(S, 0xf6ecc6, 0, 0.5, s * 132, 700, 1.4, 232); box(S, th.ground, 0, 0.56, s * 152, 700, 1.4, 180);
    box(S, 0xcfc8ba, 0, 0.55, s * 16.6, 700, 1.5, 1.6);
    for (let x = -80; x <= 90; x += 3.2) S.add(mesh(GEO.sphere, mat(x % 2 ? 0x9aa1ab : 0xb4bac4), x + r(), 0.5, s * (15.4 + r() * 0.6), 1.1 + r() * 0.5, 0.8, 1.0));
    // Sân cảng lát bê tông, nhà ga hành khách có mái hiên, kho hàng, cần cẩu
    box(S, 0xd9d2c4, 10, 0.75, s * 24, 46, 1.3, 16);
    box(S, 0xfff6e2, 16.5, 3.4, s * 24.5, 9, 4.2, 9); box(S, col, 16.5, 5.7, s * 24.5, 10.4, 0.4, 10.6); box(S, 0xa9dcf2, 11.96, 3.5, s * 24.5, 0.08, 1.8, 6, { rough: 0.25 });
    for (const dz of [-4, 0, 4]) post(S, 0xf2c65c, 10.2, 1.4, s * 24.5 + dz, 4.0, 0.1);
    box(S, col, 11, 5.4, s * 24.5, 2.4, 0.2, 10.6); box(S, 0xfffaf0, 16.5, 6.6, s * 24.5, 3.4, 1.3, 4);
    prop(S, timeBoard(3, 1.7), 11.9, 3.3, s * 24.5 - 3.6, 1, Math.PI); prop(S, clockPost(3.4), 9.4, 1.4, s * 19.5);
    prop(S, warehouse(13, 9, 4.6, arrival ? 0xf2b25c : 0x4fa3a5), -9, 1.4, s * 27, 1, s > 0 ? Math.PI : 0);
    prop(S, harbourCrane(12), -1.5, 1.4, s * 19.6, 1, s > 0 ? Math.PI / 2 : -Math.PI / 2);
    prop(S, crateStack(6), -4.6, 1.4, s * 20.4, 1.2, 0.4); prop(S, crateStack(4, 0x6fb7d9), 24, 1.4, s * 20, 1.2, -0.3);
    for (const x of [26, -16]) prop(S, lampPost(6), x, 1.4, s * 18.6, 1, Math.PI / 2 * s);
    crowd(S, [[9.2, 1.4, s * 21, 3.14], [10.4, 1.4, s * 22.4, 2.6], [8.0, 1.36, s * 12.5, 0.4], [7.0, 1.36, s * 6.5, -1.4]], hash(name) & 7);
    for (let i = 0; i < 18; i++) { const kinds = th.kinds.filter((k) => k !== 'rice' && k !== 'pond'), kd = kinds[Math.floor(r() * kinds.length)]; prop(S, SCENERY[kd](), -70 + r() * 170, 1.2, s * (36 + r() * 60), 1 + r() * 0.4, kd === 'house' ? (s > 0 ? Math.PI : 0) : r() * 6); }
    for (const x of [30, 34, -20, -24]) prop(S, SCENERY.palm(), x, 1.2, s * (22 + Math.abs(x) * 0.1), 1.1, r() * 6);
    // Núi đảo phía sau bến khi cập đảo; đất liền thì theo màu núi của miền
    const mc = zone === 'dao' ? 0x6fae78 : th.mountains;
    if (mc !== null) for (let i = 0; i < 7; i++) {
      const h = (zone === 'dao' ? 34 : 24) + r() * 26, x = -150 + i * 52 + r() * 20, m = mesh(GEO.sphere, mat(i % 2 ? mc : 0x86c08a, { rough: 1 }), x, 0, s * (120 + r() * 50), 38 + r() * 22, h, 30 + r() * 14);
      m.castShadow = false; this.root.add(m);
    }
    // Cầu tàu gỗ dọc mạn tàu: cọc, cột bích buộc dây, tay vịn, đèn
    box(S, 0xc99a68, 6.4, 1.2, 0, 4.6, 0.3, 30); box(S, 0xb8875a, 6.4, 1.36, 0, 4.2, 0.04, 30);
    for (let z = -14; z <= 14; z += 2) box(S, 0xa97a4c, 6.4, 1.37, z, 4.5, 0.03, 0.08);
    for (let z = -13; z <= 13; z += 6.5) for (const x of [4.4, 8.4]) post(S, 0x8a6a4a, x, -0.8, z, 2.4, 0.26);
    for (let z = -13; z <= 13; z += 6.5) { post(S, 0x2e3440, 4.5, 1.3, z, 0.5, 0.22); S.add(mesh(GEO.cyl, mat(0x2e3440), 4.5, 1.84, z, 0.3, 0.1, 0.3)); post(S, 0x8a6a4a, 8.5, 1.3, z, 1.2, 0.07); }
    box(S, 0x8a6a4a, 8.5, 2.4, 0, 0.08, 0.08, 26); box(S, 0x8a6a4a, 8.5, 1.9, 0, 0.06, 0.06, 26);
    for (const z of [-9, 9]) { box(S, 0xf08a6c, 7.6, 1.7, z, 0.9, 0.7, 0.9); box(S, 0x6fb7d9, 7.6, 1.6, z + 1.2, 0.8, 0.5, 0.8); }
    for (const z of [-4, 6]) { const t = mesh(new THREE.TorusGeometry(0.42, 0.16, 6, 12), mat(0x2e3440), 4.1, 1.0, z); t.rotation.y = Math.PI / 2; S.add(t); }
    const label = sign(arrival ? `Chào mừng đến ${name}` : `Bến cảng ${name}`, arrival ? '#d9482b' : '#2a7fd6', arrival ? 14 : 12, 10, 9.6, s * 17); this.root.add(label);
    // Ngoài khơi: đảo nhỏ, thuyền chài, bè cá, hải đăng, phao luồng
    for (let i = 0; i < 9; i++) prop(S, SCENERY[['islet', 'ghe', 'seastone', 'ghe'][i % 4]](), -22 - r() * 80, 0, -s * (r() * 110) + s * 6, 1.1 + r() * 0.7, r() * 6);
    for (let i = 0; i < 4; i++) prop(S, SCENERY.ghe(), 16 + i * 4.2, 0.05, s * (11.5 + (i % 2) * 1.6), 1.3, Math.PI / 2 + (r() - 0.5) * 0.3);
    prop(S, fishRaft(), -30, 0, -s * 14, 1, 0.4); prop(S, lighthouse(), -70, 0, -s * 52);
    for (let k = 1; k <= 4; k++) { box(S, 0xe0342b, -9, 0.5, -s * k * 22, 0.9, 1.4, 0.9); box(S, 0x4fa86a, 14, 0.5, -s * (k * 22 + 11), 0.9, 1.4, 0.9); }
    this.root.add(bake(S, true));

    this.ferry = bake(buildFerry(), true); this.root.add(this.ferry, this.w.g, this.wake.g, this.smoke.g, this.gulls.g);
    this.plank = mesh(GEO.box, mat(0xc99a68), 3.5, 1.72, FERRY_PLANK_Z, 2.6, 0.12, 1.2); this.plank.rotation.z = -0.24; this.root.add(this.plank);
    this.pts = [V3(-2.7, 0, -9.6), V3(2.7, 0, 8), V3(0, 8.4, 2), V3(0, 4, -9), V3(9, 1.3, 11), V3(9, 1.3, -11)]; this.signs = [label];
  }

  private common(c: Ctx, power: number) {
    const f = this.ferry, time = c.time, moving = power > 0;
    f.position.y = 0.25 + Math.sin(time * 1.6) * (moving ? 0.12 : 0.05); f.rotation.x = Math.sin(time * 1.3) * 0.012; f.rotation.z = Math.sin(time * 1.1) * (moving ? 0.018 : 0.008);
    this.sea.tick(time); this.wake.update(time, 0, f.position.z, 9.4, 7.6, Math.min(1, power));
    this.smoke.update(time, 0, 7.8, f.position.z + 3.4, 3 + power * 9, 0.5 + power * 0.25);
    this.gulls.update(time, 2, 10.5, f.position.z - 2);
    const yaw = this.s > 0 ? (c.portrait ? 2.8 : 1.98) : (c.portrait ? 0.36 : 1.2);
    c.shoot(this.pts, yaw, c.portrait ? 0.46 : 0.24, this.signs);
  }
  private deckPath(): THREE.Vector3[] {
    const d = FERRY_DECK + 0.25;
    return [V3(6.4, 1.38, this.s * 9), V3(6.2, 1.38, FERRY_PLANK_Z), V3(4.7, 1.42, FERRY_PLANK_Z), V3(2.3, d + 0.1, FERRY_PLANK_Z), V3(0.7, d, FERRY_PLANK_Z + 0.2), V3(0.6, d, -3.9)];
  }

  depart(): Act {
    const D = 6.6, P = this.deckPath();
    this.w.g.position.copy(P[0]); this.w.g.rotation.y = Math.PI;
    return {
      stage: 3, caption: `Lên tàu ở bến cảng ${this.name}`, duration: D, root: this.root, fog: [150, 420],
      update: (t, _dt, c) => {
        const u = seg(t, 0.2, 3.9);
        this.w.walk(P, u, c.time); this.w.hide(seg(u, 0.95, 1));
        const lift = ease(seg(t, 4.0, 4.6)); this.plank.rotation.z = -0.24 - lift * 1.2; this.plank.position.set(3.5 + lift * 1.0, 1.72 + lift * 0.9, FERRY_PLANK_Z); this.plank.visible = lift < 1;
        const go = Math.max(0, t - 4.5);
        this.ferry.position.z = -2.2 * go * go; this.common(c, Math.min(1, go * 0.7));
      },
    };
  }

  arrive(): Act {
    const D = 6, P = this.deckPath().reverse(); P[P.length - 1] = V3(6.6, 1.38, -11.5);
    this.w.hide(1); this.plank.visible = false;
    return {
      stage: 5, caption: `Cập bến cảng ${this.name}`, duration: D, root: this.root, fog: [150, 420],
      update: (t, _dt, c) => {
        const k = seg(t, 0, 2.7);
        this.ferry.position.z = 60 * (1 - k) ** 2;
        const drop = ease(seg(t, 2.6, 3.1)); this.plank.visible = drop > 0; this.plank.rotation.z = -0.24 - (1 - drop) * 1.2; this.plank.position.set(3.5 + (1 - drop) * 1.0, 1.72 + (1 - drop) * 0.9, FERRY_PLANK_Z);
        const u = seg(t, 3.2, 5.7);
        if (t >= 3.2) { this.w.walk(P, u, c.time); this.w.hide(1 - seg(u, 0, 0.06)); }
        this.common(c, (1 - k) * 0.9);
      },
    };
  }
}

// ================================================================ bến xe nơi đến (cảnh 5 của xe khách)
export class BusStation {
  readonly root = new THREE.Group();
  private w = new Walker();
  private bus: THREE.Group;
  private pts: THREE.Vector3[]; private signs: THREE.Sprite[] = [];
  private name: string;

  constructor(zone: Zone, name: string) {
    this.name = name;
    const r = rng(hash(name + 'benxe')), S = new THREE.Group(), th = THEMES[zone];
    this.root.add(slab(th.ground));
    roadAlongZ(S, 0x9aa1ab);
    box(S, 0xe9dfc8, 6.6, 0.06, 0, 5.2, 0.16, 60); box(S, 0xb9bfc9, -12, 0.03, 0, 16, 0.1, 70);
    // Nhà bến phía -x: sảnh có mái hiên, quầy vé, xe đỗ
    box(S, 0xfff6e2, -18, 2.8, 0, 9, 5.6, 30); box(S, 0x6fb7d9, -17, 5.9, 0, 12, 0.5, 32); box(S, 0x6fb7d9, -11.4, 4.3, 0, 4.4, 0.3, 26);
    for (let z = -12; z <= 12; z += 6) post(S, 0xf2c65c, -9.6, 0, z, 4.3, 0.16);
    for (const z of [-9, -3, 3, 9]) box(S, 0xa9dcf2, -13.46, 2.6, z, 0.08, 2.0, 3.2, { rough: 0.25 });
    box(S, 0xfffaf0, -17, 7.0, 0, 5, 1.6, 8);
    prop(S, clockPost(3.8), -9.8, 0, -15.5); prop(S, timeBoard(4.2, 2.2), -13.3, 4.4, 0);
    crowd(S, [[-10.6, 0, -4, 1.6], [-10.9, 0, 2.4, 1.3], [-11.2, 0, 7.6, 1.9], [7.9, 0.16, 5.6, -1.6], [8.3, 0.16, 3.3, -1.3]], hash(name) & 7);
    const parked = buildMinibus(); prop(S, parked, -7.6, 0, 22, 1, 0.5); const parked2 = buildBus(); prop(S, parked2, -8, 0, -26, 1, -0.4);
    const label = sign(`Chào mừng đến ${name}`, '#d9482b', 15, -12.4, 9.8, 0); this.root.add(label);
    box(S, 0x6fb7d9, 7.8, 2.9, 4.5, 2.4, 0.2, 4.4); for (const z of [2.5, 6.5]) post(S, 0xf2c65c, 8.8, 0, z, 2.9, 0.09); box(S, 0xc99a68, 8.4, 0.62, 4.5, 0.5, 0.12, 3);
    for (const [x, z] of [[9.2, 16], [10.4, 28], [9.6, 40]]) prop(S, SCENERY[zone === 'taynguyen' ? 'pine' : zone === 'nam' || zone === 'dao' ? 'palm' : 'leaf'](), x, 0, z, 1 + r() * 0.3, r() * 6);
    backdrop(S, this.root, zone, r, 26);
    this.root.add(bake(S, true));
    this.bus = bake(buildBus(), true); this.bus.position.set(1.9, 0, 90); this.root.add(this.bus, this.w.g);
    this.pts = [V3(0.5, 0, -5.2), V3(3.3, 0, 5.2), V3(0.5, 3.8, 5.2), V3(3.3, 3.8, -5.2), V3(7.4, 0, -6.6)]; this.signs = [label];
  }

  arrive(): Act {
    const D = 5.2, P = [V3(3.5, 0, -4.1), V3(5.6, 0.16, -4.4), V3(6.8, 0.16, -6.2)];
    this.w.hide(1);
    return {
      stage: 5, caption: `Tới bến xe ${this.name}`, duration: D, root: this.root, fog: [100, 320],
      update: (t, _dt, c) => {
        const k = seg(t, 0, 2.5);
        this.bus.position.z = 70 * (1 - k) ** 2; this.bus.position.y = bob(c.time, k < 1 ? 1 : 0);
        const u = seg(t, 3.0, 4.7);
        if (t >= 3.0) { this.w.walk(P, u, c.time); this.w.hide(1 - seg(u, 0, 0.1)); if (u >= 1) this.w.face(1, -0.5); }
        c.shoot(this.pts, c.portrait ? 2.4 : 2.02, c.portrait ? 0.48 : 0.2, this.signs);
      },
    };
  }
}

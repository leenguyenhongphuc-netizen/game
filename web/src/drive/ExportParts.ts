// Mô hình cho hoạt cảnh xuất khẩu: xe tải thùng, đầu kéo container, xe nâng, tàu hàng, máy bay chở hàng,
// tàu hàng nhỏ, tàu container khổng lồ, cẩu giàn, cổng cửa khẩu. Mọi phương tiện quay đầu về -z.
import * as THREE from 'three';
import { GEO, mat, mesh } from '../scene/plants.ts';
import { bake } from './RideKit.ts';
import { hullGeo, railing, sign } from './RideParts.ts';

const DARK = 0x3a3f4a, STEEL = 0x8f97a3, LAMP = () => mat(0xfff3b0, { emissive: 0xffe08a }), GLASS = () => mat(0x7fb9d9, { rough: 0.25 });
const bx = (c: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, o?: { rough?: number; emissive?: number; transparent?: number }) => mesh(GEO.box, mat(c, o), x, y, z, sx, sy, sz);
export const CONTAINER_COLORS = [0xd9482b, 0x2f6fd0, 0x2e9a6b, 0xf2a53a, 0x7a4fb5, 0xe9edf2, 0x1f8fa8, 0xc0392b];

/** Bánh xe quay thấy được: lốp và hai thanh nan hoa. */
export class Rolling {
  private ws: { o: THREE.Object3D; r: number }[] = [];
  wheel(parent: THREE.Object3D, x: number, z: number, r = 0.5, w = 0.34, y = r): void {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const tire = mesh(GEO.cyl, mat(DARK), 0, 0, 0, r, w, r); tire.rotation.z = Math.PI / 2;
    const hub = mesh(GEO.cyl, mat(0xc9cdd3), 0, 0, 0, r * 0.5, w + 0.04, r * 0.5); hub.rotation.z = Math.PI / 2;
    g.add(tire, hub, bx(0x5b6470, 0, 0, 0, w + 0.06, r * 1.5, 0.1), bx(0x5b6470, 0, 0, 0, w + 0.06, 0.1, r * 1.5));
    parent.add(g); this.ws.push({ o: g, r });
  }
  /** d = quãng đường đã lăn (đi về -z thì d tăng). */
  turn(d: number): void { for (const w of this.ws) w.o.rotation.x = -d / w.r; }
}
export interface Vehicle { g: THREE.Group; roll: Rolling; half: number; high: number }

/** Sọt trái cây: thùng gỗ có trái nhô lên. */
export function crate(i = 0): THREE.Group {
  const g = new THREE.Group(), cols = [0xf08a24, 0xdc342b, 0x9bd64a, 0xf4c430, 0xe8457f];
  g.add(bx(0xc99a68, 0, 0.3, 0, 0.8, 0.6, 0.8), bx(0x8a6a4a, 0, 0.3, 0, 0.84, 0.08, 0.84));
  for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) g.add(mesh(GEO.ball, mat(cols[(i + (x > 0 ? 1 : 0) + (z > 0 ? 2 : 0)) % cols.length], { rough: 0.5 }), x, 0.64, z, 0.19));
  return g;
}
/** Pa-lét chất thùng các-tông. */
export function pallet(): THREE.Group {
  const g = new THREE.Group();
  g.add(bx(0xb8875a, 0, 0.08, 0, 1.3, 0.16, 1.3));
  for (let k = 0; k < 2; k++) for (const [x, z] of [[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]]) g.add(bx(k ? 0xe2c08c : 0xd9b27c, x, 0.46 + k * 0.58, z, 0.6, 0.56, 0.6), bx(0x2e9a6b, x, 0.5 + k * 0.58, z, 0.62, 0.1, 0.62));
  return g;
}

/** Xe tải thùng hở: thấy được sọt hàng xếp trong thùng. Đuôi xe ở +z. */
export function boxTruck(color = 0x3f8fd6): Vehicle {
  const b = new THREE.Group(), g = new THREE.Group(), roll = new Rolling();
  b.add(bx(DARK, 0, 0.78, 0.2, 2.1, 0.3, 7.0));
  b.add(bx(color, 0, 1.75, -2.5, 2.3, 1.7, 1.9), bx(color, 0, 1.25, -3.6, 2.3, 0.75, 0.5), mesh(GEO.box, GLASS(), 0, 2.05, -3.47, 2.0, 0.8, 0.06), mesh(GEO.box, GLASS(), 1.16, 2.05, -2.6, 0.04, 0.7, 1.1), mesh(GEO.box, GLASS(), -1.16, 2.05, -2.6, 0.04, 0.7, 1.1));
  b.add(bx(0xfffaf0, 0, 2.66, -2.5, 2.1, 0.14, 1.7), bx(0xf2c65c, 0, 0.95, -3.86, 2.3, 0.26, 0.1));
  // Thùng: sàn, thành thấp, khung mui
  b.add(bx(0xc9a877, 0, 1.0, 1.25, 2.4, 0.14, 5.0), bx(0xe9d2a6, -1.17, 1.5, 1.25, 0.08, 0.9, 5.0), bx(0xe9d2a6, 1.17, 1.5, 1.25, 0.08, 0.9, 5.0), bx(0xe9d2a6, 0, 1.5, -1.22, 2.4, 0.9, 0.08));
  for (const z of [-1.2, 1.25, 3.7]) for (const x of [-1.17, 1.17]) b.add(bx(STEEL, x, 2.3, z, 0.07, 1.6, 0.07));
  for (const z of [-1.2, 1.25, 3.7]) b.add(bx(STEEL, 0, 3.1, z, 2.4, 0.07, 0.07));
  for (const x of [-0.8, 0.8]) b.add(mesh(GEO.ball, LAMP(), x, 1.25, -3.87, 0.16), bx(0xe0342b, x, 1.0, 3.72, 0.34, 0.2, 0.06));
  g.add(bake(b, true));
  for (const z of [-2.5, 2.0, 3.0]) for (const x of [-1.05, 1.05]) roll.wheel(g, x, z, 0.52, 0.36);
  return { g, roll, half: 3.9, high: 3.2 };
}

/** Container lạnh: thân gân, cửa ở +z, máy lạnh ở -z. Gốc ở đáy giữa. */
export function container(color: number, len = 12, reefer = true): THREE.Group {
  const g = new THREE.Group();
  g.add(bx(color, 0, 1.35, 0, 2.5, 2.7, len));
  for (let z = -len / 2 + 0.5; z < len / 2; z += 0.6) for (const x of [-1.27, 1.27]) g.add(bx(color, x, 1.35, z, 0.06, 2.5, 0.16));
  g.add(bx(0xfffdf6, 0, 1.4, len / 2 + 0.02, 0.08, 2.5, 0.05), bx(STEEL, -0.6, 1.4, len / 2 + 0.04, 0.05, 2.3, 0.05), bx(STEEL, 0.6, 1.4, len / 2 + 0.04, 0.05, 2.3, 0.05));
  if (reefer) g.add(bx(0xe9edf2, 0, 1.35, -len / 2 - 0.12, 2.3, 2.3, 0.24), bx(DARK, 0, 1.9, -len / 2 - 0.26, 1.4, 0.9, 0.05), mesh(GEO.cyl, mat(DARK), 0, 0.8, -len / 2 - 0.26, 0.4, 0.05, 0.4));
  g.add(bx(0xfffdf6, 1.29, 1.9, -len * 0.2, 0.03, 0.6, len * 0.3));
  return g;
}

/** Đầu kéo + sơ-mi rơ-moóc chở một container 12 m. Trả thêm hai cánh cửa container để đóng mở. */
export function containerTruck(color = 0x2e9a6b): Vehicle & { doors: THREE.Group[]; box: THREE.Group } {
  const b = new THREE.Group(), g = new THREE.Group(), roll = new Rolling();
  // Đầu kéo
  b.add(bx(DARK, 0, 0.8, -6.6, 2.2, 0.34, 5.2), bx(0xd9482b, 0, 2.2, -8.0, 2.5, 2.5, 2.3), bx(0xd9482b, 0, 1.3, -9.3, 2.5, 0.9, 0.5), mesh(GEO.box, GLASS(), 0, 2.7, -9.17, 2.2, 1.1, 0.06), bx(0xfffaf0, 0, 3.6, -7.8, 2.3, 0.3, 1.8), bx(0xb9bfc9, 0, 0.9, -9.58, 2.5, 0.34, 0.1));
  for (const x of [-1.05, 1.05]) b.add(mesh(GEO.cyl, mat(0xb9bfc9), x * 1.1, 2.6, -6.7, 0.1, 2.6, 0.1), mesh(GEO.ball, LAMP(), x * 0.8, 1.3, -9.57, 0.16));
  // Rơ-moóc
  b.add(bx(DARK, 0, 1.12, 0.6, 2.4, 0.24, 12.6), bx(STEEL, 0, 0.6, -3.4, 0.2, 0.9, 0.2));
  for (const x of [-0.8, 0.8]) b.add(bx(0xe0342b, x, 1.1, 6.92, 0.4, 0.2, 0.06));
  g.add(bake(b, true));
  const cont = container(color, 12); cont.position.set(0, 1.24, 0.5);
  const box = bake(cont, true); g.add(box);
  const doors: THREE.Group[] = [];
  for (const s of [-1, 1]) { const d = new THREE.Group(); d.position.set(s * 1.25, 1.24, 6.52); d.add(bx(color, -s * 0.62, 1.35, 0, 1.24, 2.66, 0.08), bx(STEEL, -s * 0.9, 1.35, 0.06, 0.05, 2.3, 0.05)); g.add(d); doors.push(d); }
  for (const z of [-8.3, -5.4, -4.2, 4.3, 5.5, 6.7]) for (const x of [-1.08, 1.08]) roll.wheel(g, x, z, 0.56, 0.4);
  return { g, roll, half: 9.7, high: 4.1, doors, box };
}

/** Xe nâng: càng nâng là nhóm riêng để nâng hạ. Mũi càng hướng -z. */
export function forklift(): { g: THREE.Group; fork: THREE.Group; roll: Rolling } {
  const b = new THREE.Group(), g = new THREE.Group(), fork = new THREE.Group(), roll = new Rolling();
  b.add(bx(0xf2a53a, 0, 0.75, 0.5, 1.3, 0.8, 1.9), bx(DARK, 0, 0.95, 1.5, 1.3, 0.9, 0.5), bx(DARK, 0, 1.3, 0.5, 0.7, 0.3, 0.7));
  for (const x of [-0.6, 0.6]) for (const z of [-0.3, 1.2]) b.add(bx(DARK, x, 1.75, z, 0.07, 1.4, 0.07));
  b.add(bx(0xf2a53a, 0, 2.48, 0.45, 1.36, 0.08, 1.7));
  for (const x of [-0.45, 0.45]) b.add(bx(STEEL, x, 1.6, -0.62, 0.1, 3.2, 0.12));
  g.add(bake(b, true));
  fork.add(bx(STEEL, 0, 0.3, -0.72, 1.1, 0.6, 0.08)); for (const x of [-0.36, 0.36]) fork.add(bx(STEEL, x, 0.04, -1.4, 0.12, 0.06, 1.4));
  g.add(fork);
  for (const x of [-0.62, 0.62]) { roll.wheel(g, x, -0.2, 0.36, 0.26); roll.wheel(g, x, 1.3, 0.3, 0.24); }
  return { g, fork, roll };
}

/** Đoàn tàu hàng: đầu máy diesel + toa kín (cửa trượt) + toa chở container. Cửa toa đầu ở z = BOXCAR_Z. */
export const BOXCAR_Z = -2.0;
export function freightTrain(): Vehicle & { door: THREE.Mesh; hold: THREE.Group } {
  const b = new THREE.Group(), g = new THREE.Group(), roll = new Rolling();
  const loco = new THREE.Group();
  loco.add(bx(0xd9482b, 0, 2.1, 0, 2.7, 2.3, 8.4), bx(0xf2c65c, 0, 1.25, 0, 2.76, 0.4, 8.46), bx(0xd9482b, 0, 3.55, 2.4, 2.6, 0.9, 2.6), mesh(GEO.box, GLASS(), 0, 3.55, 1.07, 2.2, 0.6, 0.06), mesh(GEO.box, GLASS(), 0, 3.55, 2.4, 2.66, 0.6, 1.6));
  loco.add(bx(DARK, 0, 3.4, -1.8, 1.4, 0.3, 3.4), bx(0x2e3440, 0, 0.95, -4.3, 2.4, 0.6, 0.4), mesh(GEO.ball, LAMP(), 0, 2.6, -4.22, 0.3), mesh(GEO.cyl, mat(DARK), 0.5, 3.6, -3.2, 0.2, 0.5, 0.2));
  loco.position.z = -12.6; b.add(loco);
  const cols = [0x8a5a3c, 0x4fa3a5];
  for (let i = 0; i < 2; i++) { const z = -2.0 + i * 8.6; b.add(bx(cols[i], 0, 2.35, z, 2.6, 2.8, 8.0), bx(0xfffaf0, 0, 3.82, z, 2.4, 0.16, 7.8)); for (let k = -3.6; k <= 3.6; k += 0.9) b.add(bx(cols[i], -1.32, 2.35, z + k, 0.05, 2.6, 0.14)); if (i) for (let k = -3.6; k <= 3.6; k += 0.9) b.add(bx(cols[i], 1.32, 2.35, z + k, 0.05, 2.6, 0.14)); }
  for (let i = 0; i < 2; i++) { const z = 15.2 + i * 8.6; b.add(bx(DARK, 0, 1.0, z, 2.5, 0.2, 8.0)); const c = container(CONTAINER_COLORS[i * 3 + 1], 7.4, false); c.position.set(0, 1.1, z); b.add(c); }
  b.add(bx(DARK, 0, 0.74, 5.6, 2.3, 0.34, 46));
  g.add(bake(b, true));
  // Khoang toa đầu: lòng toa tối, sọt hàng hiện dần, cửa trượt
  g.add(bx(0x2e2014, 1.3, 2.3, BOXCAR_Z, 0.06, 2.4, 2.4));
  const hold = new THREE.Group(); for (let i = 0; i < 6; i++) { const c = crate(i); c.position.set(1.0, 1.0 + Math.floor(i / 3) * 0.84, BOXCAR_Z - 0.8 + (i % 3) * 0.8); c.visible = false; hold.add(c); } g.add(hold);
  const door = bx(0x9a6a48, 1.37, 2.3, BOXCAR_Z - 2.5, 0.08, 2.5, 2.5); door.castShadow = true; g.add(door);
  for (let z = -15.6; z <= 27.6; z += 2.4) for (const x of [-1.15, 1.15]) roll.wheel(g, x, z, 0.5, 0.3);
  return { g, roll, half: 28, high: 4.2, door, hold };
}

/** Máy bay chở hàng thân rộng: không cửa sổ, cửa hàng hoá bên phải (+x) mở lật lên. */
export const FREIGHTER_Y = 2.6, FREIGHTER_DOOR_Z = -3.6;
export function freighter(): { g: THREE.Group; door: THREE.Group } {
  const b = new THREE.Group(), g = new THREE.Group(), white = mat(0xfffdf6, { rough: 0.5 }), acc = mat(0xf2a53a), dark = mat(0x4a5160);
  const fus = mesh(GEO.cyl, white, 0, 0, 0, 1.6, 17, 1.6); fus.rotation.x = Math.PI / 2; b.add(fus);
  b.add(mesh(GEO.ball, white, 0, 0, -8.5, 1.6, 1.6, 2.6), mesh(GEO.ball, GLASS(), 0, 0.62, -9.2, 1.15, 0.7, 1.3));
  const tail = mesh(GEO.cone, white, 0, 0.35, 10.2, 1.55, 4.0, 1.3); tail.rotation.x = Math.PI / 2; b.add(tail);
  b.add(mesh(GEO.box, acc, 0, 2.7, 10.6, 0.26, 4.2, 2.8), mesh(GEO.box, mat(0x2e9a6b), 0, 4.2, 11.0, 0.28, 1.2, 1.7), mesh(GEO.box, white, 0, 0.7, 10.9, 7.2, 0.2, 1.8));
  b.add(mesh(GEO.box, white, 0, -0.45, 0.8, 20.5, 0.28, 3.6), mesh(GEO.box, acc, 0, -0.26, 0, 3.24, 0.2, 16.6));
  for (const x of [-10.0, 10.0]) b.add(mesh(GEO.box, acc, x, 0.3, 1.5, 0.22, 1.5, 1.9));
  for (const x of [-4.6, 4.6]) { const e = mesh(GEO.cyl, mat(0xe9edf2), x, -1.35, -0.2, 0.8, 2.8, 0.8), cap = mesh(GEO.cyl, dark, x, -1.35, -1.62, 0.64, 0.06, 0.64); e.rotation.x = Math.PI / 2; cap.rotation.x = Math.PI / 2; b.add(e, cap); }
  for (const [x, z] of [[0, -6.4], [-2.0, 1.2], [2.0, 1.2]]) { b.add(mesh(GEO.cyl, dark, x, -1.8, z, 0.1, 0.9, 0.1)); const w = mesh(GEO.cyl, mat(DARK), x, -2.2, z, 0.4, 0.5, 0.4); w.rotation.z = Math.PI / 2; b.add(w); }
  b.add(mesh(GEO.box, mat(0x2e2014), 1.52, 0.3, FREIGHTER_DOOR_Z, 0.3, 1.9, 2.6));
  g.add(bake(b, true));
  const door = new THREE.Group(); door.position.set(1.62, 1.25, FREIGHTER_DOOR_Z); door.add(mesh(GEO.box, white, 0.03, -0.95, 0, 0.1, 1.9, 2.6)); g.add(door);
  return { g, door };
}
/** Xe băng chuyền đưa hàng lên cửa máy bay: chân thấp ở +x, đầu cao ở -x. */
export function beltLoader(len = 5.4, rise = 2.3): THREE.Group {
  const g = new THREE.Group(), ang = Math.atan2(rise, len);
  g.add(bx(0xf2c65c, 0.9, 0.6, 0, 3.4, 0.6, 1.5), bx(DARK, 2.2, 1.1, 0.4, 0.8, 0.5, 0.6));
  const belt = bx(0x3f4652, -len / 2 + 2.2, 0.9 + rise / 2, 0, Math.hypot(len, rise), 0.16, 1.1); belt.rotation.z = -ang; g.add(belt);
  for (const z of [-0.6, 0.6]) { const r = bx(0xf2c65c, -len / 2 + 2.2, 1.05 + rise / 2, z, Math.hypot(len, rise), 0.12, 0.06); r.rotation.z = -ang; g.add(r); }
  g.add(bx(STEEL, -1.4, 1.2, 0, 0.14, 1.6, 0.9));
  for (const x of [0, 2]) for (const z of [-0.75, 0.75]) { const w = mesh(GEO.cyl, mat(DARK), x, 0.3, z, 0.3, 0.22, 0.3); w.rotation.x = Math.PI / 2; g.add(w); }
  return g;
}

/** Tàu hàng nhỏ ven biển: khoang hở chở sọt, cần trục, buồng lái phía đuôi. Mặt boong cao COASTER_DECK. */
export const COASTER_DECK = 1.5;
export function coaster(): { g: THREE.Group; hold: THREE.Group } {
  const b = new THREE.Group(), g = new THREE.Group();
  b.add(mesh(hullGeo(2.6, 9.8, 8.4, 1.5, 0.84), mat(0x2e6f5e)), mesh(hullGeo(2.64, 9.84, 8.44, 0.5, 0.88), mat(0xa9382b), 0, -0.02, 0), mesh(hullGeo(2.5, 9.6, 8.3, 0.06, 1), mat(0xc9a877), 0, 1.48, 0));
  b.add(bx(0x3f4652, 0, 1.75, -1.4, 4.0, 0.5, 8.4), bx(0x2e2014, 0, 1.9, -1.4, 3.6, 0.3, 8.0));
  b.add(bx(0xfffdf6, 0, 2.7, 5.6, 4.2, 2.4, 3.6), mesh(GEO.box, mat(0x2f5f86, { rough: 0.2 }), 0, 3.2, 3.78, 3.6, 0.8, 0.05), bx(0xfffdf6, 0, 4.6, 5.8, 3.4, 1.4, 2.6), mesh(GEO.box, mat(0x2f5f86, { rough: 0.2 }), 0, 4.8, 4.48, 3.0, 0.7, 0.05), bx(0xf6ead0, 0, 5.36, 5.8, 3.8, 0.12, 3.0));
  b.add(mesh(GEO.cyl, mat(0xf2a53a), 0, 6.3, 6.6, 0.45, 1.6, 0.45), mesh(GEO.cyl, mat(0x2e3440), 0, 7.15, 6.6, 0.47, 0.2, 0.47));
  b.add(mesh(GEO.cyl, mat(0xf2c65c), 0, 4.3, -6.0, 0.16, 5.6, 0.16)); const jib = bx(0xf2c65c, 0, 5.8, -3.6, 0.16, 0.16, 5.6); jib.rotation.x = 0.36; b.add(jib);
  railing(b, [[2.4, 3.6], [2.4, 7.6], [-2.4, 7.6], [-2.4, 3.6]], 1.5, 0.6); railing(b, [[1.6, -6.4], [0, -9.2], [-1.6, -6.4]], 1.5, 0.6);
  b.add(mesh(GEO.cyl, mat(0x9a7150), 0, 3.0, 7.9, 0.05, 2.8, 0.05), bx(0xe0342b, 0.5, 4.0, 7.9, 0.95, 0.6, 0.05), mesh(GEO.ball, mat(0xffd23f), 0.5, 4.0, 7.94, 0.15));
  g.add(bake(b, true));
  const hold = new THREE.Group(); for (let i = 0; i < 12; i++) { const c = crate(i); c.visible = false; hold.add(c); }
  hold.children.forEach((c, i) => c.position.set(-1.2 + (i % 3) * 1.2, 2.0 + Math.floor(i / 9) * 0.74, -4.4 + Math.floor((i % 9) / 3) * 1.5));
  g.add(hold);
  return { g, hold };
}

/** Tàu container khổng lồ dài ~110, rộng 16: các chồng container dựng bằng lưới lặp. */
export const GIANT = { half: 8, bow: 58, stern: 52, deck: 7.2 };
export function containerShip(fill = 1): { g: THREE.Group; stacks: THREE.InstancedMesh } {
  const b = new THREE.Group(), g = new THREE.Group(), G = GIANT;
  b.add(mesh(hullGeo(G.half, G.bow, G.stern, G.deck, 0.8), mat(0x1f3f66)), mesh(hullGeo(G.half + 0.06, G.bow + 0.1, G.stern + 0.06, 2.4, 0.86), mat(0xa9382b), 0, -0.05, 0), mesh(hullGeo(G.half - 0.3, G.bow - 1, G.stern - 0.6, 0.1, 1), mat(0x5b6470), 0, G.deck - 0.02, 0));
  b.add(bx(0xfffdf6, G.half - 0.1, 5.4, -30, 0.14, 1.3, 14));
  // Tháp lái phía đuôi, ống khói, cột ra-đa
  b.add(bx(0xfffdf6, 0, G.deck + 7, 36, 14.4, 14, 5.4), bx(0xfffdf6, 0, G.deck + 15.2, 36, 17.6, 2.4, 5.8), mesh(GEO.box, mat(0x2f5f86, { rough: 0.2 }), 0, G.deck + 15.4, 33.06, 16.8, 1.2, 0.08));
  for (let k = 0; k < 4; k++) b.add(mesh(GEO.box, mat(0x2f5f86, { rough: 0.2 }), 0, G.deck + 2.4 + k * 3, 33.26, 12.6, 0.9, 0.08));
  b.add(bx(0xf6ead0, 0, G.deck + 16.5, 36, 18, 0.2, 6.2), mesh(GEO.cyl, mat(0xd9482b), 0, G.deck + 13, 43, 2.0, 9, 2.6), mesh(GEO.cyl, mat(0x2e3440), 0, G.deck + 17.7, 43, 2.05, 0.5, 2.65), mesh(GEO.cyl, mat(STEEL), 0, G.deck + 19.5, 35, 0.14, 5.6, 0.14), bx(STEEL, 0, G.deck + 21.4, 35, 4, 0.14, 0.3));
  b.add(mesh(GEO.cyl, mat(STEEL), 0, G.deck + 4, -54, 0.14, 8, 0.14));
  railing(b, [[5, -44], [0, -56.5], [-5, -44]], G.deck, 1.0, 0xe9edf2); railing(b, [[7.6, 46], [7.6, 51], [-7.6, 51], [-7.6, 46]], G.deck, 1.0, 0xe9edf2);
  g.add(bake(b, true));
  const bays = 12, rows = 5, tiers = 5, count = bays * rows * tiers;
  const stacks = new THREE.InstancedMesh(new THREE.BoxGeometry(2.4, 2.5, 5.9), new THREE.MeshStandardMaterial({ roughness: 0.8 }), count); stacks.userData.own = true; stacks.castShadow = true;
  const m4 = new THREE.Matrix4(), c = new THREE.Color(); let n = 0;
  for (let bay = 0; bay < bays; bay++) for (let row = 0; row < rows; row++) {
    const h = bay < 1 || bay > 10 ? tiers - 2 : tiers - ((bay * 7 + row * 3) % 3 === 0 ? 1 : 0);
    for (let t = 0; t < h; t++) { m4.makeTranslation(-5.4 + row * 2.7, GIANT.deck + 1.3 + t * 2.55, -44 + bay * 6.3); stacks.setMatrixAt(n, m4); stacks.setColorAt(n, c.setHex(CONTAINER_COLORS[(bay * 5 + row * 3 + t * 7) % CONTAINER_COLORS.length])); n++; }
  }
  stacks.count = Math.round(n * fill); g.add(stacks);
  return { g, stacks };
}

/** Cẩu giàn bờ (STS): chân đứng trên cầu cảng (x từ 0 tới 14), cần vươn ra biển về -x. Xe tời và ngáng cẩu điều khiển riêng. */
export function shipCrane(): { g: THREE.Group; trolley: THREE.Group; spreader: THREE.Group; cable: THREE.Mesh; top: number } {
  const b = new THREE.Group(), g = new THREE.Group(), top = 34, c = 0xf2a53a;
  for (const x of [0, 14]) for (const z of [-7, 7]) b.add(bx(c, x, top / 2, z, 1.0, top, 1.0), bx(DARK, x, 0.6, z, 2.2, 1.2, 3.4));
  for (const x of [0, 14]) b.add(bx(c, x, 13, 0, 0.8, 0.8, 14), bx(c, x, top - 0.5, 0, 0.8, 0.8, 14));
  for (const z of [-7, 7]) { b.add(bx(c, 7, 13, z, 14, 0.8, 0.8)); const d = bx(c, 7, 23.5, z, 0.6, 25, 0.6); d.rotation.z = 0.58; b.add(d); }
  b.add(bx(c, -8, top + 0.6, 0, 60, 1.4, 2.6), bx(c, -8, top + 2.2, -1.2, 60, 0.3, 0.3), bx(c, -8, top + 2.2, 1.2, 60, 0.3, 0.3));
  b.add(bx(c, 3, top + 9, 0, 1.0, 16, 1.0)); for (const [x, l, a] of [[-12, 34, 0.5], [12, 22, -0.72]] as [number, number, number][]) { const t = bx(DARK, x, top + 9.4, 0, l, 0.24, 0.24); t.rotation.z = a; b.add(t); }
  b.add(bx(0xfffdf6, 16, top + 3.6, 0, 6, 4, 5), bx(DARK, 18, top - 3, 0, 0.3, 9, 0.3));
  g.add(bake(b, true));
  const trolley = new THREE.Group(); trolley.position.set(8, top - 0.6, 0);
  trolley.add(bx(DARK, 0, 0, 0, 3.4, 1.0, 3.6), bx(0xfffdf6, 1.2, -1.4, 0, 2.0, 1.8, 2.4), mesh(GEO.box, GLASS(), 0.18, -1.3, 0, 0.06, 1.0, 2.0));
  const cable = bx(DARK, 0, -5, 0, 0.14, 10, 0.14); cable.castShadow = false; trolley.add(cable);
  const spreader = new THREE.Group(); spreader.add(bx(0xf2c65c, 0, 0.2, 0, 2.6, 0.4, 6.2)); trolley.add(spreader);
  g.add(trolley);
  return { g, trolley, spreader, cable, top };
}

/** Cổng cửa khẩu bắc ngang đường: hai trụ, mái, biển tên, barie nâng hạ (pivot ở +x). */
export function borderGate(title: string, half = 6, face: 1 | -1 = 1): { g: THREE.Group; arm: THREE.Group; signs: THREE.Sprite[] } {
  const b = new THREE.Group(), g = new THREE.Group();
  for (const x of [-half, half]) b.add(bx(0xf3ead2, x, 4, 0, 2.2, 8, 2.6), bx(0xd9482b, x, 0.5, 0, 2.5, 1.0, 2.9), bx(0xf2c65c, x, 8.2, 0, 2.6, 0.4, 3.0));
  b.add(bx(0xf3ead2, 0, 9.6, 0, half * 2 + 4.6, 2.4, 2.4), bx(0xd9482b, 0, 11.1, 0, half * 2 + 6.4, 0.5, 3.6), bx(0xd9482b, 0, 11.7, 0, half * 2 + 3, 0.5, 2.6), bx(0xf2c65c, 0, 12.2, 0, half * 2, 0.4, 1.6));
  // Cột cờ trên nóc
  b.add(mesh(GEO.cyl, mat(0xb9bfc9), 0, 15.2, 0, 0.09, 5.6, 0.09), bx(0xe0342b, 1.0, 17.2, 0, 2.0, 1.3, 0.06), mesh(GEO.ball, mat(0xffd23f), 1.0, 17.2, 0.05, 0.3, 0.3, 0.04));
  // Chốt gác bên phải, trụ barie
  b.add(bx(0xfffdf6, half + 4.6, 1.7, 3.4, 3.4, 3.4, 3.6), bx(0x2f6fd0, half + 4.6, 3.6, 3.4, 4.0, 0.4, 4.2), mesh(GEO.box, GLASS(), half + 2.88, 2.0, 3.4, 0.06, 1.3, 2.6), bx(0xe0342b, half - 1.5, 0.7, 4.4, 0.5, 1.4, 0.5));
  for (let i = 0; i < 5; i++) b.add(mesh(GEO.cone, mat(0xf08a24), -half + 1.6, 0.4, 6 + i * 2.4, 0.26, 0.8, 0.26));
  g.add(bake(b, true));
  const arm = new THREE.Group(); arm.position.set(half - 1.5, 1.5, 4.4);
  for (let i = 0; i < 6; i++) arm.add(bx(i % 2 ? 0xffffff : 0xe0342b, -0.75 - i * 1.5, 0, 0, 1.5, 0.22, 0.16));
  g.add(arm);
  const s1 = sign(title, '#d9482b', Math.min(15, half * 2 - 1), 0, 9.5, 2.8 * face); // biển tên do cảnh tự gắn vào gốc để máy quay tính đúng vị trí
  return { g, arm, signs: [s1] };
}

// Mô hình tàu bè cho biển mở: tàu khách cao tốc, phà, tàu hàng rời, tàu cá vỏ gỗ, thuyền thúng, ca nô kéo phao chuối,
// mô tô nước, cùng phao luồng, đảo đá vôi, đá ngầm. Mũi tàu hướng -z. Đèn hành trình: đỏ mạn trái, xanh mạn phải, trắng cột.
import * as THREE from 'three';
import { GEO, mat, mesh } from '../scene/plants.ts';
import { cargoShip, ferry } from '../drive/DriveExtras.ts';
import type { LaneKind } from './seaWorld.ts';

const box = (g: THREE.Group, c: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, o?: { emissive?: number; rough?: number }) => { const m = mesh(GEO.box, mat(c, o), x, y, z, sx, sy, sz); g.add(m); return m; };
const cyl = (g: THREE.Group, c: number, x: number, y: number, z: number, r: number, h: number) => { const m = mesh(GEO.cyl, mat(c), x, y, z, r, h, r); g.add(m); return m; };
const ball = (g: THREE.Group, c: number, x: number, y: number, z: number, r: number, o?: { emissive?: number }) => { const m = mesh(GEO.ball, mat(c, o), x, y, z, r); g.add(m); return m; };
function bow(g: THREE.Group, c: number, y: number, z: number, w: number, h: number, l: number) { const m = mesh(GEO.cone, mat(c), 0, y, z, w / 2, l, h / 2); m.rotation.x = -Math.PI / 2; g.add(m); return m; }
/** Đèn hành trình (đỏ trái, xanh phải, trắng cột) — sáng nhẹ để thấy cả ban ngày. */
export function navLights(g: THREE.Group, halfW: number, y: number, z: number, mastY: number, mastZ = z) {
  ball(g, 0xff3b30, -halfW, y, z, 0.22, { emissive: 0xff2a1a }); ball(g, 0x34d058, halfW, y, z, 0.22, { emissive: 0x22c55e }); ball(g, 0xffffff, 0, mastY, mastZ, 0.24, { emissive: 0xfff6d0 });
}
function flagVN(g: THREE.Group, x: number, y: number, z: number, s = 1) { cyl(g, 0x9aa1a8, x, y, z, 0.05 * s, 2.2 * s); box(g, 0xda251d, x + 0.45 * s, y + 0.8 * s, z, 0.9 * s, 0.6 * s, 0.03); ball(g, 0xffdd00, x + 0.45 * s, y + 0.8 * s, z + 0.02, 0.12 * s); }

export function speedBoat(): THREE.Group {
  // tàu khách cao tốc vỏ nhôm hai thân: trắng, kính xanh đậm, sọc xanh
  const g = new THREE.Group();
  for (const s of [-1, 1]) { box(g, 0xf4f6f8, s * 1.4, 0.4, 0.5, 1.1, 1.0, 13); bow(g, 0xf4f6f8, 0.4, -6.6, 1.1, 1.0, 2.2).position.x = s * 1.4; }
  box(g, 0xffffff, 0, 1.25, 0.8, 4.0, 1.2, 11); box(g, 0x1f3b63, 0, 1.45, 0.6, 4.05, 0.55, 9.6, { rough: 0.25 });
  box(g, 0xffffff, 0, 2.2, 1.4, 3.4, 0.8, 7); box(g, 0x1f3b63, 0, 2.3, -1.6, 3.2, 0.5, 1.2, { rough: 0.25 }); box(g, 0x2a7fd4, 0, 0.92, 0.6, 4.1, 0.15, 12.6);
  cyl(g, 0xd9dde2, 0, 3.1, 2.4, 0.08, 1.4); navLights(g, 2.0, 1.9, -2.2, 3.9, 2.4); flagVN(g, 0, 2.6, 6.4, 0.8);
  return g;
}
export function bulkCarrier(): THREE.Group {
  const g = new THREE.Group();
  box(g, 0x2b3a4a, 0, 1.4, 0, 7.5, 3.6, 36); box(g, 0x9c2f24, 0, -0.4, 0, 7.4, 0.8, 35.8); bow(g, 0x2b3a4a, 1.4, -19.6, 7.5, 3.6, 3.4);
  for (let i = 0; i < 4; i++) { box(g, 0x7a5232, 0, 3.4, -12 + i * 6.4, 5.6, 0.6, 4.6); if (i < 3) { cyl(g, 0xf2c94c, 2.6, 5.2, -9 + i * 6.4, 0.25, 3.6); box(g, 0xf2c94c, 1.2, 6.9, -9 + i * 6.4, 3.2, 0.25, 0.25); } }
  box(g, 0xf2f2ee, 0, 5.4, 14.2, 7.2, 4.4, 5.6); box(g, 0x24425e, 0, 6.4, 11.35, 6.8, 0.8, 0.1, { rough: 0.3 }); box(g, 0xf2f2ee, 0, 8, 14.2, 7.8, 0.4, 4.6);
  cyl(g, 0xc0392b, 0, 9.4, 16, 0.9, 2.6); cyl(g, 0x222222, 0, 10.8, 16, 0.92, 0.4); navLights(g, 4, 8.2, 12.2, 11.5, 14);
  return g;
}
export function containerShip(): THREE.Group { const g = cargoShip(); navLights(g, 3.6, 5.5, 14, 10.5, 16); return g; }
export function carFerry(): THREE.Group {
  const cars: THREE.Object3D[] = [];
  for (let i = 0; i < 4; i++) { const c = new THREE.Group(); box(c, [0xe8e3d6, 0xd9534f, 0x3b82c4, 0x7cbf5a][i], 0, 0.45, 0, 1.6, 0.8, 3.2); box(c, 0xbfe6f7, 0, 1.0, 0.2, 1.4, 0.5, 1.8, { rough: 0.3 }); c.position.set(i % 2 ? 1.05 : -1.05, 1.02, -3 + Math.floor(i / 2) * 4); cars.push(c); }
  const g = ferry(cars); navLights(g, 2.4, 2.4, -2, 4.6, 3); return g;
}
export function fishingBoat(): THREE.Group {
  // tàu cá vỏ gỗ sơn xanh, mạn đỏ vàng, cabin trắng phía đuôi, cột đèn câu
  const g = new THREE.Group();
  box(g, 0x2f6fb5, 0, 0.45, 0.4, 3.0, 1.1, 8.2); box(g, 0xd94b3a, 0, 1.05, 0.4, 3.08, 0.22, 8.3); box(g, 0xf3c43b, 0, 0.85, 0.4, 3.1, 0.12, 8.3);
  bow(g, 0x2f6fb5, 0.55, -4.4, 3.0, 1.3, 1.8); box(g, 0xa06a3e, 0, 1.0, 0.2, 2.7, 0.1, 7.6);
  box(g, 0xf7f3ea, 0, 1.8, 2.6, 2.2, 1.5, 2.2); box(g, 0x2b5a8c, 0, 2.7, 2.6, 2.5, 0.25, 2.5); box(g, 0x7fb6d1, 0, 1.9, 1.48, 1.6, 0.6, 0.05, { rough: 0.3 });
  cyl(g, 0xb08a5b, 0, 3.0, -0.8, 0.08, 4); for (let i = 0; i < 4; i++) ball(g, 0xfff3c4, (i % 2 ? 0.7 : -0.7), 2.6 + Math.floor(i / 2) * 0.8, -0.8, 0.16, { emissive: 0xffe9a8 });
  flagVN(g, 0.6, 3.2, 3.6, 0.7); navLights(g, 1.55, 1.3, -1.2, 5.0, -0.8);
  return g;
}
export function basketBoat(shirt = 0x3b7dd8): THREE.Group {
  const g = new THREE.Group();
  const m = mesh(new THREE.CylinderGeometry(1.0, 0.8, 0.5, 14, 1, true), mat(0x8a6a3c), 0, 0.25, 0); m.material = new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 1, side: THREE.DoubleSide }); g.add(m);
  cyl(g, 0x6b5030, 0, 0.05, 0, 0.82, 0.1); box(g, shirt, 0, 0.75, 0, 0.42, 0.6, 0.3); ball(g, 0xf0c8a0, 0, 1.2, 0, 0.2);
  const hat = mesh(GEO.cone, mat(0xf2dc9a), 0, 1.42, 0, 0.42, 0.22, 0.42); g.add(hat);
  const oar = box(g, 0x8a5a3c, 0.5, 0.7, 0.4, 0.06, 0.06, 1.8); oar.rotation.x = 0.6;
  return g;
}
export function bananaCano(): THREE.Group {
  const g = new THREE.Group();
  box(g, 0xffffff, 0, 0.45, 0, 2.0, 0.8, 5.5); bow(g, 0xffffff, 0.45, -3.2, 2.0, 0.8, 1.4); box(g, 0xe74c3c, 0, 0.7, 0, 2.05, 0.18, 5.6);
  box(g, 0x1f3b63, 0, 1.1, 0.5, 1.4, 0.5, 1.2, { rough: 0.3 }); box(g, 0x3b7dd8, 0, 1.0, 1.6, 0.4, 0.6, 0.3);
  // phao chuối kéo sau 9 m
  const b = mesh(GEO.cyl, mat(0xffd23f), 0, 0.35, 11, 0.45, 4.2, 0.45); b.rotation.x = Math.PI / 2; g.add(b);
  for (let i = 0; i < 3; i++) { box(g, [0xff7a00, 0x2ecc71, 0x9b59b6][i], 0, 0.95, 9.8 + i * 1.2, 0.36, 0.5, 0.3); ball(g, 0xf0c8a0, 0, 1.35, 9.8 + i * 1.2, 0.17); }
  return g;
}
/** Mô tô nước: thân trắng sọc màu, yên đen, tay lái; người lái mặc áo phao cam. */
export function jetSki(color = 0xe63946): THREE.Group {
  const g = new THREE.Group();
  box(g, 0xf7f7f2, 0, 0.32, 0.1, 1.15, 0.55, 3.0); bow(g, 0xf7f7f2, 0.32, -1.85, 1.15, 0.55, 0.8); box(g, color, 0, 0.5, 0, 1.18, 0.14, 2.9);
  box(g, 0x1d1d22, 0, 0.72, 0.5, 0.5, 0.22, 1.3); box(g, color, 0, 0.78, -0.55, 0.7, 0.35, 0.5); cyl(g, 0x333333, 0, 1.05, -0.55, 0.04, 0.35);
  const bar = box(g, 0x333333, 0, 1.22, -0.5, 0.9, 0.06, 0.06); bar.rotation.z = 0;
  // người lái
  box(g, 0x2c3e50, 0, 1.05, 0.55, 0.42, 0.45, 0.35); box(g, 0xff7a1a, 0, 1.45, 0.4, 0.55, 0.55, 0.42); ball(g, 0xf0c8a0, 0, 1.92, 0.36, 0.2); box(g, 0x2c3e50, 0, 2.06, 0.36, 0.38, 0.12, 0.38);
  for (const s of [-1, 1]) { const a = box(g, 0xff7a1a, s * 0.33, 1.35, 0.05, 0.13, 0.13, 0.65); a.rotation.x = 0.5; }
  return g;
}

export function shipFor(kind: LaneKind): THREE.Group {
  switch (kind) {
    case 'container': return containerShip();
    case 'hang_roi': return bulkCarrier();
    case 'pha': return carFerry();
    case 'tau_khach': return speedBoat();
    case 'tau_ca': return fishingBoat();
    case 'thung': return basketBoat([0x3b7dd8, 0xd94b3a, 0x2e9e6a][Math.floor(Math.random() * 3)]);
    case 'cano': return bananaCano();
  }
}
/** Bán kính va chạm (đơn vị cảnh) của từng loại tàu. */
export const SHIP_R: Record<LaneKind, number> = { container: 19, hang_roi: 17, pha: 6.5, tau_khach: 6.5, tau_ca: 4.2, thung: 1.3, cano: 3.2 };
export const SHIP_NAME: Record<LaneKind, string> = { container: 'Tàu container', hang_roi: 'Tàu hàng rời', pha: 'Phà', tau_khach: 'Tàu khách cao tốc', tau_ca: 'Tàu cá', thung: 'Thuyền thúng', cano: 'Ca nô kéo phao chuối' };

/** Hình phao luồng (thân trụ + chóp), dựng một lần, tô màu theo từng cá thể. */
export function buoyGeometry(): THREE.BufferGeometry {
  const a = new THREE.CylinderGeometry(0.9, 1.1, 1.6, 10); a.translate(0, 0.6, 0);
  const b = new THREE.CylinderGeometry(0.75, 0.75, 0.35, 10); b.translate(0, 1.55, 0);
  const c = new THREE.ConeGeometry(0.55, 1.2, 10); c.translate(0, 2.3, 0);
  const pole = new THREE.CylinderGeometry(0.06, 0.06, 1.0, 5); pole.translate(0, 3.2, 0);
  const lamp = new THREE.IcosahedronGeometry(0.22, 0); lamp.translate(0, 3.75, 0);
  return mergeAll([a, b, c, pole, lamp]);
}
/** Đảo đá vôi dựng đứng: thân trụ nhiều cạnh lồi lõm, chân loe, đỉnh tròn phủ cây. */
export function karstGeometry(): { rock: THREE.BufferGeometry; top: THREE.BufferGeometry } {
  const rock = new THREE.CylinderGeometry(0.75, 1.0, 1, 9, 6); const p = rock.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.18 * Math.sin(a * 3 + y * 5) + 0.1 * Math.sin(a * 7 - y * 9) + (y < -0.35 ? 0.2 : 0) - (y > 0.3 ? 0.15 : 0); p.setXYZ(i, x * k, y, z * k); }
  rock.translate(0, 0.5, 0); rock.computeVertexNormals();
  const top = new THREE.IcosahedronGeometry(0.8, 1); const q = top.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < q.count; i++) q.setY(i, Math.max(-0.05, q.getY(i)) * 0.45);
  top.translate(0, 1.0, 0); top.computeVertexNormals();
  return { rock, top };
}
function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = list.map((g) => (g.index ? g.toNonIndexed() : g));
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of parts) { g.computeVertexNormals(); pos.set(g.attributes.position.array as Float32Array, o * 3); nor.set(g.attributes.normal.array as Float32Array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out;
}

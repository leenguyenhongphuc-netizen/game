// Mô hình tàu bè cho biển mở: tàu khách cao tốc, phà, tàu hàng rời, tàu cá vỏ gỗ, thuyền thúng, ca nô kéo phao chuối,
// mô tô nước, cùng phao luồng, đảo đá vôi, đá ngầm. Mũi tàu hướng -z. Đèn hành trình: đỏ mạn trái, xanh mạn phải, trắng cột.
import * as THREE from 'three';
import { GEO, mat, mesh } from '../scene/plants.ts';
import { cargoShip } from '../drive/DriveExtras.ts';
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
/** Vỏ tàu nhìn từ trên: mũi nhọn thuôn, đuôi vuông bo góc; đùn theo chiều cao, vát mép cho đường nét mềm. Mũi hướng -z, đáy y = 0. */
export function hullGeometry(len: number, width: number, depth: number, bowLen: number, sternRound = 0.25, bevel = 0.12): THREE.BufferGeometry {
  const w = width / 2, h = len / 2, sh = new THREE.Shape();
  sh.moveTo(-w + sternRound, h); sh.lineTo(w - sternRound, h); sh.quadraticCurveTo(w, h, w, h - sternRound);
  sh.lineTo(w, -h + bowLen); sh.bezierCurveTo(w, -h + bowLen * 0.35, w * 0.35, -h + 0.05, 0, -h);
  sh.bezierCurveTo(-w * 0.35, -h + 0.05, -w, -h + bowLen * 0.35, -w, -h + bowLen); sh.lineTo(-w, h - sternRound); sh.quadraticCurveTo(-w, h, -w + sternRound, h);
  const b = Math.min(bevel, depth / 3, w / 3);
  const g = new THREE.ExtrudeGeometry(sh, { depth: depth - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 10 });
  g.rotateX(Math.PI / 2); g.translate(0, depth - b, 0); g.computeVertexNormals();
  return g;
}
const hull = (g: THREE.Group, c: number, y: number, z: number, len: number, width: number, depth: number, bowLen: number, o?: { rough?: number }) => {
  const m = new THREE.Mesh(hullGeometry(len, width, depth, bowLen), mat(c, o)); m.position.set(0, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
};

/** Phà chở ô tô hai đầu: vỏ thép xanh than, sọc đỏ mớn nước, boong xám có vạch đỗ, cầu dẫn hai đầu, lan can, cabin lái đặt lệch mạn,
 *  phao cứu sinh, ống khói, cột đèn; chở 4 ô tô và vài người đứng. */
export function carFerry(cars = 4): THREE.Group {
  const g = new THREE.Group(), navy = 0x2b4766, white = 0xf6f3ea;
  hull(g, navy, -0.3, 0, 15, 5.6, 1.45, 2.2); hull(g, 0xb8362b, -0.5, 0, 15.05, 5.65, 0.42, 2.2);
  box(g, 0xffffff, 0, 1.18, 0.8, 5.5, 0.08, 10.6); box(g, 0x8c949e, 0, 1.24, 0.8, 5.0, 0.06, 10.2, { rough: 0.9 });
  for (const x of [-1.3, 1.3]) box(g, 0xf2c94c, x, 1.29, 0.6, 0.08, 0.02, 8.4);
  for (const z of [-5.6, 6.6]) { const r = box(g, 0x6f7882, 0, 1.45, z, 3.6, 0.1, 1.7); r.rotation.x = z < 0 ? 0.35 : -0.35; for (const x of [-1.85, 1.85]) box(g, 0x4b5563, x, 1.5, z, 0.08, 0.5, 1.6); }
  for (const sx of [-1, 1]) {
    box(g, white, sx * 2.72, 2.15, 0.8, 0.07, 0.07, 10); box(g, white, sx * 2.72, 1.75, 0.8, 0.05, 0.05, 10);
    for (let z = -4.2; z <= 5.8; z += 1.0) box(g, white, sx * 2.72, 1.7, z, 0.06, 0.95, 0.06);
    for (const z of [-2.5, 3]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.09, 8, 16), mat(0xf0682a)); ring.position.set(sx * 2.8, 1.75, z); ring.rotation.y = Math.PI / 2; g.add(ring); }
  }
  // cabin lái lệch mạn phải, hai tầng, kính bao quanh
  box(g, white, 1.9, 2.4, 2.2, 1.6, 2.2, 3.4); box(g, 0x24425e, 1.9, 2.9, 2.2, 1.66, 0.55, 3.0, { rough: 0.25 });
  box(g, white, 1.9, 4.0, 2.2, 1.9, 1.1, 3.0); box(g, 0x9fd3ea, 1.9, 4.05, 2.2, 1.96, 0.55, 2.6, { rough: 0.2 }); box(g, 0xd9dde2, 1.9, 4.65, 2.2, 2.2, 0.12, 3.4);
  cyl(g, 0xe0342b, 1.9, 5.4, 3.3, 0.32, 1.2); cyl(g, 0x1c1c1c, 1.9, 6.05, 3.3, 0.34, 0.16);
  cyl(g, 0x8f97a3, 1.9, 5.6, 1.2, 0.05, 1.8); box(g, 0x8f97a3, 1.9, 6.3, 1.2, 0.7, 0.05, 0.05);
  flagVN(g, -2.5, 2.2, 6.2, 0.8);
  const carCols = [0xe8e3d6, 0xd9534f, 0x3b82c4, 0x7cbf5a];
  for (let i = 0; i < cars; i++) {
    const c = new THREE.Group(), x = i % 2 ? 0.1 : -1.5, z = -3 + Math.floor(i / 2) * 4.4;
    box(c, carCols[i], 0, 0.42, 0, 1.6, 0.62, 3.4); box(c, carCols[i], 0, 0.92, 0.25, 1.4, 0.5, 1.9); box(c, 0x9fc9e0, 0, 0.95, 0.25, 1.44, 0.34, 1.7, { rough: 0.2 });
    for (const [wx, wz] of [[-0.78, -1.1], [0.78, -1.1], [-0.78, 1.1], [0.78, 1.1]]) { const t = mesh(GEO.cyl, mat(0x1d1d22), wx, 0.28, wz, 0.3, 0.2, 0.3); t.rotation.z = Math.PI / 2; c.add(t); }
    c.position.set(x, 1.27, z); g.add(c);
  }
  for (const [x, z, col] of [[-2.2, 4.4, 0xf2a03d], [-2.0, 5.2, 0x3b7dd8], [0.9, 5.6, 0xd94b6a]] as const) { box(g, col, x, 1.75, z, 0.4, 0.6, 0.3); ball(g, 0xf0c8a0, x, 2.2, z, 0.17); }
  navLights(g, 2.9, 2.3, -1, 6.4, 1.2);
  return g;
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
/** Mô tô nước: vỏ trắng thuôn có sọc màu, mũi vát, yên dài bọc đen, tay lái có tay nắm và gương, nắp máy màu,
 *  vòi phản lực phía đuôi; người lái mặc áo phao cam, ngồi ôm tay lái, chân đặt trên bậc. */
export function jetSki(color = 0xe63946): THREE.Group {
  const g = new THREE.Group();
  hull(g, 0xf7f7f2, 0, 0, 3.2, 1.2, 0.62, 1.2, { rough: 0.35 });
  hull(g, color, 0.42, -0.05, 3.0, 1.22, 0.16, 1.15, { rough: 0.4 });
  // nắp máy phía trước, kính chắn gió nhỏ
  const hood = mesh(GEO.ball, mat(color, { rough: 0.35 }), 0, 0.72, -0.75, 0.48, 0.24, 0.7); g.add(hood);
  box(g, 0x2b3440, 0, 0.98, -0.42, 0.5, 0.22, 0.05, { rough: 0.2 });
  // yên dài bo tròn
  const seat = mesh(GEO.cyl, mat(0x1d1d22, { rough: 0.7 }), 0, 0.84, 0.45, 0.24, 1.4, 0.24); seat.rotation.x = Math.PI / 2; seat.scale.z *= 0.75; g.add(seat);
  for (const s of [-1, 1]) box(g, 0x3a3f47, s * 0.5, 0.5, 0.45, 0.14, 0.05, 1.3); // bậc để chân
  // tay lái: cổ, ghi đông, tay nắm, gương
  cyl(g, 0x2d2f33, 0, 0.98, -0.5, 0.05, 0.4);
  box(g, 0x2d2f33, 0, 1.18, -0.48, 0.86, 0.05, 0.05);
  for (const s of [-1, 1]) { cyl(g, 0x111111, s * 0.44, 1.18, -0.48, 0.045, 0.14).rotation.z = Math.PI / 2; box(g, 0xc9d1d9, s * 0.38, 1.38, -0.55, 0.14, 0.09, 0.02, { rough: 0.2 }); }
  // vòi phản lực đuôi
  const noz = mesh(GEO.cyl, mat(0x4b5563), 0, 0.22, 1.62, 0.12, 0.18, 0.12); noz.rotation.x = Math.PI / 2; g.add(noz);
  // người lái: hông trên yên, đùi, ống chân trên bậc, thân nghiêng tới, tay ra ghi đông, áo phao cam, mũ bảo hiểm
  box(g, 0x23384d, 0, 1.05, 0.55, 0.44, 0.24, 0.42);
  for (const s of [-1, 1]) { const th = box(g, 0x23384d, s * 0.2, 1.0, 0.15, 0.17, 0.17, 0.6); th.rotation.x = 0.15; const sh = box(g, 0x23384d, s * 0.3, 0.72, -0.08, 0.15, 0.5, 0.15); sh.rotation.x = 0.25; }
  const torso = box(g, 0xff7a1a, 0, 1.48, 0.38, 0.56, 0.62, 0.38); torso.rotation.x = -0.32;
  box(g, 0x1f2933, 0, 1.36, 0.38, 0.58, 0.08, 0.4); // đai áo phao
  ball(g, 0xf0c8a0, 0, 1.92, 0.2, 0.19); const helm = mesh(GEO.ball, mat(0xf5f5f5, { rough: 0.3 }), 0, 2.0, 0.22, 0.22, 0.17, 0.24); g.add(helm);
  box(g, 0x111111, 0, 1.93, 0.02, 0.26, 0.06, 0.05, { rough: 0.2 }); // kính râm
  for (const s of [-1, 1]) { const arm = box(g, 0xff7a1a, s * 0.34, 1.42, 0.0, 0.13, 0.13, 0.62); arm.rotation.x = 0.55; arm.rotation.z = s * -0.18; ball(g, 0xf0c8a0, s * 0.42, 1.2, -0.42, 0.06); }
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

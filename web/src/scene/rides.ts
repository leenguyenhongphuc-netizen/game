// Xe cộ của người chơi: năm xe cá nhân (shared/shop.ts) và các nhóm xe tải (shared/vehicles.ts). Đầu xe hướng +z.
import * as THREE from 'three';
import { GEO, mat, mesh } from './plants.ts';
import { makeTruck } from './custom3d.ts';
import { bakeColored } from './batch.ts';

export interface RideModel { root: THREE.Group; wheels: THREE.Mesh[] }
const TYRE = 0x23262d, CHROME = () => mat(0xdfe6ee, { rough: 0.3 }), GLASS = () => mat(0xa9dcf2, { rough: 0.25 });
/** Bánh xe nằm ngang trục x; trả về lưới để cảnh quay bánh khi xe chạy. */
function wheel(root: THREE.Group, wheels: THREE.Mesh[], x: number, z: number, r: number, w = 0.26, hub = true) {
  const m = mesh(GEO.cyl, mat(TYRE), x, r, z, r, w, r); m.rotation.z = Math.PI / 2;
  if (hub) m.add(mesh(GEO.cyl, CHROME(), 0, x > 0 ? -0.52 : 0.52, 0, 0.55, 0.06, 0.55));
  wheels.push(m); root.add(m);
}
const lamp = (root: THREE.Group, x: number, y: number, z: number, s = 0.11) => root.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), x, y, z, s));
const tail = (root: THREE.Group, x: number, y: number, z: number) => root.add(mesh(GEO.box, mat(0xe8412f, { emissive: 0xb02a1e }), x, y, z, 0.26, 0.14, 0.05));

export const PERSONAL_RIDE_IDS = ['xe_dap', 'xe_may', 'xe_may_dien', 'o_to', 'o_to_dien'];

/** Xe cá nhân đỗ trong sân. */
export function buildPersonalRide(id: string): RideModel | null {
  const root = new THREE.Group(), wheels: THREE.Mesh[] = [];
  const spoke = (x: number, z: number, r: number) => { for (let i = 0; i < 3; i++) root.add(mesh(GEO.box, CHROME(), x, r, z, 0.02, r * 1.8, 0.02).rotateX((i * Math.PI) / 3)); };
  if (id === 'xe_dap') { // xe đạp khung ngang, giỏ trước, gác-ba-ga, chuông
    const c = mat(0x3d8fd1), dark = mat(0x2b2f38);
    for (const z of [0.72, -0.72]) { const t = mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 16), mat(TYRE), 0, 0.46, z); t.rotation.y = Math.PI / 2; wheels.push(t); root.add(t); spoke(0, z, 0.42); }
    root.add(mesh(GEO.cyl, c, 0, 0.78, 0.36, 0.035, 0.9, 0.035).rotateX(1.0), mesh(GEO.cyl, c, 0, 0.98, 0, 0.035, 1.0, 0.035).rotateX(Math.PI / 2), mesh(GEO.cyl, c, 0, 0.75, -0.36, 0.035, 0.75, 0.035).rotateX(-0.5), mesh(GEO.cyl, c, 0, 0.6, -0.16, 0.03, 0.75, 0.03).rotateX(0.9));
    root.add(mesh(GEO.cyl, dark, 0, 1.12, -0.42, 0.03, 0.34, 0.03), mesh(GEO.box, mat(0x5a3a22), 0, 1.3, -0.44, 0.2, 0.06, 0.34)); // cọc yên, yên
    root.add(mesh(GEO.cyl, dark, 0, 1.15, 0.52, 0.03, 0.5, 0.03).rotateX(-0.25), mesh(GEO.cyl, CHROME(), 0, 1.4, 0.48, 0.03, 0.62, 0.03).rotateZ(Math.PI / 2)); for (const sx of [-1, 1]) root.add(mesh(GEO.cyl, dark, sx * 0.3, 1.4, 0.48, 0.04, 0.12, 0.04).rotateZ(Math.PI / 2));
    root.add(mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.24, 8, 1, true), mat(0xc9a35a), 0, 1.18, 0.86), mesh(GEO.cyl, mat(0xa9884e), 0, 1.06, 0.86, 0.17, 0.02, 0.17), mesh(GEO.ball, mat(0xe2573c), 0.05, 1.2, 0.86, 0.09), mesh(GEO.ball, mat(0xffd23f), -0.06, 1.18, 0.9, 0.08));
    root.add(mesh(GEO.box, CHROME(), 0, 0.92, -0.78, 0.2, 0.03, 0.44), mesh(GEO.ball, CHROME(), 0.2, 1.46, 0.48, 0.05), mesh(GEO.box, dark, 0.14, 0.3, -0.5, 0.03, 0.5, 0.03).rotateZ(-0.35)); // gác-ba-ga, chuông, chân chống
    root.add(mesh(GEO.cyl, dark, 0, 0.46, 0, 0.1, 0.05, 0.1).rotateZ(Math.PI / 2), mesh(GEO.box, dark, 0.12, 0.36, 0.08, 0.08, 0.03, 0.16));
    return { root, wheels };
  }
  if (id === 'xe_may' || id === 'xe_may_dien') { // xe số (yếm, ống xả, yên dài) hoặc xe ga điện (sàn để chân, không ống xả, sọc xanh)
    const ev = id === 'xe_may_dien', c = mat(ev ? 0x27ae60 : 0xc0392b), dark = mat(0x2b2f38), seat = mat(0x1d1d22);
    for (const z of [0.85, -0.8]) { wheel(root, wheels, 0, z, ev ? 0.3 : 0.36, 0.14, false); root.add(mesh(GEO.cyl, CHROME(), 0, ev ? 0.3 : 0.36, z, 0.16, 0.16, 0.16).rotateZ(Math.PI / 2)); }
    root.add(mesh(GEO.box, c, 0, ev ? 0.62 : 0.72, -0.25, 0.34, 0.36, 1.25), mesh(GEO.box, seat, 0, ev ? 0.86 : 0.96, -0.35, 0.36, 0.1, 1.05)); // thân, yên
    root.add(mesh(GEO.box, c, 0, 0.9, 0.48, 0.5, ev ? 0.9 : 0.7, 0.1).rotateX(-0.28), mesh(GEO.box, c, 0, 0.74, 0.86, 0.2, 0.12, 0.5)); // yếm trước, chắn bùn
    if (ev) root.add(mesh(GEO.box, dark, 0, 0.36, 0.1, 0.44, 0.06, 0.7), mesh(GEO.box, mat(0xd7ff4a), 0.18, 0.62, -0.3, 0.01, 0.06, 0.9), mesh(GEO.box, mat(0xd7ff4a), -0.18, 0.62, -0.3, 0.01, 0.06, 0.9));
    else root.add(mesh(GEO.box, dark, 0, 0.44, 0.05, 0.3, 0.3, 0.5), mesh(GEO.cyl, CHROME(), 0.2, 0.42, -0.62, 0.06, 0.8, 0.06).rotateX(Math.PI / 2 - 0.12), mesh(GEO.box, dark, -0.2, 0.34, 0.1, 0.1, 0.03, 0.2));
    root.add(mesh(GEO.cyl, dark, 0, 1.02, 0.7, 0.04, 0.8, 0.04).rotateX(-0.3), mesh(GEO.cyl, dark, 0, 1.36, 0.6, 0.03, 0.74, 0.03).rotateZ(Math.PI / 2), mesh(GEO.box, c, 0, 1.3, 0.66, 0.3, 0.2, 0.16));
    lamp(root, 0, 1.3, 0.76, 0.09); tail(root, 0, 0.92, -0.92);
    for (const sx of [-1, 1]) root.add(mesh(GEO.ball, CHROME(), sx * 0.34, 1.52, 0.56, 0.06, 0.08, 0.02), mesh(GEO.box, dark, sx * 0.34, 1.44, 0.58, 0.015, 0.14, 0.015)); // gương
    root.add(mesh(GEO.box, CHROME(), 0, 1.0, -0.98, 0.3, 0.03, 0.3), mesh(GEO.box, mat(0xfdf6e6), 0, 0.72, -1.0, 0.24, 0.16, 0.02)); // baga, biển số
    return { root, wheels };
  }
  if (id === 'o_to' || id === 'o_to_dien') { // sedan gầm thấp hoặc xe điện gầm cao (nóc cao, lưới tản nhiệt kín, cổng sạc)
    const ev = id === 'o_to_dien', c = mat(ev ? 0x4aa3d8 : 0xf2f2f2), dark = mat(0x2b2f38), trim = mat(ev ? 0x2f7fb0 : 0xc9cdd3);
    const y0 = ev ? 0.52 : 0.4, hh = ev ? 0.62 : 0.5, r = ev ? 0.42 : 0.36;
    for (const sx of [-1, 1]) for (const z of [1.25, -1.2]) wheel(root, wheels, sx * 0.85, z, r, 0.26);
    root.add(mesh(GEO.box, c, 0, y0 + hh / 2, 0, 1.8, hh, 4.3), mesh(GEO.ball, c, 0, y0 + hh / 2, 2.05, 0.9, hh / 2, 0.35), mesh(GEO.ball, c, 0, y0 + hh / 2, -2.05, 0.9, hh / 2, 0.3));
    const cab = mesh(new THREE.CylinderGeometry(0.62, 0.92, ev ? 0.62 : 0.52, 4, 1), c, 0, y0 + hh + (ev ? 0.31 : 0.26), ev ? -0.25 : -0.2, 1.24, 1, ev ? 1.75 : 1.5); cab.rotation.y = Math.PI / 4; root.add(cab);
    const gy = y0 + hh + (ev ? 0.3 : 0.25);
    root.add(mesh(GEO.box, GLASS(), 0, gy, (ev ? 0.72 : 0.66), 1.3, 0.36, 0.05).rotateX(-0.6), mesh(GEO.box, GLASS(), 0, gy, (ev ? -1.28 : -1.08), 1.3, 0.34, 0.05).rotateX(0.62));
    for (const sx of [-1, 1]) root.add(mesh(GEO.box, GLASS(), sx * 0.74, gy, ev ? -0.25 : -0.2, 0.04, 0.3, ev ? 1.5 : 1.3).rotateZ(sx * -0.3), mesh(GEO.box, c, sx * 0.76, gy, ev ? -0.25 : -0.2, 0.05, 0.36, 0.07), mesh(GEO.box, dark, sx * 0.92, y0 + hh * 0.72, 0.1, 0.02, 0.04, 0.2), mesh(GEO.box, dark, sx * 0.92, y0 + hh * 0.72, -0.9, 0.02, 0.04, 0.2), mesh(GEO.box, c, sx * 0.98, y0 + hh + 0.06, 0.62, 0.14, 0.1, 0.18));
    root.add(mesh(GEO.box, ev ? c : dark, 0, y0 + 0.2, 2.34, 1.0, 0.2, 0.04), mesh(GEO.box, trim, 0, y0 + 0.02, 2.3, 1.84, 0.14, 0.2), mesh(GEO.box, trim, 0, y0 + 0.02, -2.28, 1.84, 0.14, 0.2), mesh(GEO.box, mat(0xfdf6e6), 0, y0 + 0.14, -2.34, 0.5, 0.16, 0.03));
    for (const sx of [-1, 1]) { lamp(root, sx * 0.62, y0 + hh * 0.62, 2.3, 0.12); tail(root, sx * 0.62, y0 + hh * 0.62, -2.3); }
    if (ev) root.add(mesh(GEO.cyl, mat(0xd7ff4a), 0.905, y0 + hh * 0.6, -1.5, 0.09, 0.02, 0.09).rotateZ(Math.PI / 2), mesh(GEO.box, mat(0xd7ff4a), 0, y0 + 0.06, 0, 1.82, 0.05, 3.0), mesh(GEO.box, dark, 0, y0 + hh + 0.66, -0.25, 1.0, 0.04, 1.2)); // cổng sạc, viền xanh, nóc kính
    else root.add(mesh(GEO.cyl, CHROME(), 0.5, y0 - 0.05, -2.2, 0.05, 0.3, 0.05).rotateX(Math.PI / 2));
    return { root, wheels };
  }
  return null;
}

export type TruckGroup = 'ba_gac' | 'ban_tai' | 'tai_nhe' | 'tai_trung' | 'tai_nang' | 'dau_keo';
export function truckGroup(kind: string | null | undefined): TruckGroup {
  const k = kind ?? '';
  if (k.startsWith('ba_gac')) return 'ba_gac';
  if (k.startsWith('ban_tai')) return 'ban_tai';
  if (k.startsWith('dau_keo')) return 'dau_keo';
  if (k.startsWith('tai_15t') || k.startsWith('tai_8t')) return 'tai_nang';
  if (k.startsWith('tai_3t5') || k.startsWith('tai_1t9')) return 'tai_trung';
  return 'tai_nhe';
}

/** Thùng hàng: thùng lạnh trắng có dàn lạnh, hoặc thùng mui bạt/thùng lửng chở trái cây. */
function cargoBox(root: THREE.Group, w: number, h: number, len: number, y: number, zc: number, cold: boolean, open: boolean) {
  if (cold) {
    root.add(mesh(GEO.box, mat(0xf4f7fa), 0, y + h / 2, zc, w, h, len), mesh(GEO.box, mat(0xc9d2da), 0, y + 0.04, zc, w + 0.04, 0.08, len + 0.04), mesh(GEO.box, mat(0xc9d2da), 0, y + h, zc, w + 0.04, 0.06, len + 0.04));
    root.add(mesh(GEO.box, mat(0xdfe6ee), 0, y + h * 0.72, zc + len / 2 + 0.16, w * 0.7, h * 0.34, 0.3), mesh(GEO.cyl, mat(0x4a4f5a), 0, y + h * 0.72, zc + len / 2 + 0.32, 0.2, 0.02, 0.2).rotateX(Math.PI / 2)); // dàn lạnh trước thùng
    for (const sx of [-1, 1]) root.add(mesh(GEO.box, mat(0x4aa3d8), sx * (w / 2 + 0.005), y + h * 0.55, zc, 0.01, h * 0.16, len * 0.8), mesh(GEO.ball, mat(0xffffff), sx * (w / 2 + 0.012), y + h * 0.55, zc + len * 0.25, 0.01, 0.14, 0.14)); // sọc xanh + bông tuyết
    root.add(mesh(GEO.box, mat(0xb8c2cc), 0, y + h / 2, zc - len / 2 - 0.01, 0.03, h * 0.9, 0.02), mesh(GEO.box, mat(0x8f97a3), 0.2, y + h * 0.45, zc - len / 2 - 0.03, 0.04, h * 0.5, 0.03));
  } else if (open) {
    root.add(mesh(GEO.box, mat(0xd9a877), 0, y + 0.35, zc, w, 0.7, len), mesh(GEO.box, mat(0xb9855a), 0, y + 0.72, zc, w + 0.1, 0.08, len + 0.1));
    const cols = Math.max(1, Math.round(len / 1.1)), fr = [0xf4c430, 0xe8457f, 0x9bd64a, 0xf08a24, 0xe2573c, 0x7ccf4f];
    for (let i = 0; i < cols; i++) for (const sx of [-1, 1]) { const z = zc - len / 2 + (i + 0.5) * (len / cols); root.add(mesh(GEO.box, mat(0xc9975a), sx * w * 0.24, y + 0.98, z, w * 0.4, 0.42, Math.min(0.8, len / cols - 0.1)), mesh(GEO.ball, mat(fr[(i * 2 + (sx > 0 ? 1 : 0)) % 6]), sx * w * 0.24, y + 1.26, z, 0.2)); }
  } else {
    root.add(mesh(GEO.box, mat(0xd9a877), 0, y + 0.3, zc, w, 0.6, len), mesh(GEO.box, mat(0x3f7d5a), 0, y + 0.6 + (h - 0.6) / 2, zc, w - 0.04, h - 0.6, len - 0.04)); // thành thùng + mui bạt
    const n = Math.max(2, Math.round(len / 1.2)); for (let i = 0; i <= n; i++) root.add(mesh(GEO.box, mat(0x2f5f44), 0, y + 0.6 + (h - 0.6) / 2, zc - len / 2 + (i * len) / n, w, h - 0.58, 0.05));
    root.add(mesh(GEO.box, mat(0x2f5f44), 0, y + h + 0.02, zc, w + 0.02, 0.05, len + 0.02), mesh(GEO.box, mat(0xb9855a), 0, y + 0.62, zc, w + 0.08, 0.06, len + 0.08));
  }
}

/** Xe tải đúng loại đang dùng. `color` là màu ca-bin người chơi chọn. Thùng lạnh màu trắng có dàn lạnh; bản điện có sọc xanh và biển EV. */
export function makeTruckKind(kind: string | null | undefined, color: number): RideModel {
  if (!kind) return makeTruck(color);
  const grp = truckGroup(kind), cold = kind.endsWith('_lanh'), ev = kind.endsWith('_dien');
  const root = new THREE.Group(), wheels: THREE.Mesh[] = [];
  const body = mat(color), dark = mat(0x3a3f4a), lite = mat(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35).getHex());
  const cab = (w: number, h: number, len: number, y: number, z: number, flat = true) => { // ca-bin: đầu bằng (xe tải) hoặc có nắp ca-pô
    root.add(mesh(GEO.box, body, 0, y + h / 2, z, w, h, len), mesh(GEO.box, lite, 0, y + h + 0.05, z - 0.05, w - 0.2, 0.1, len - 0.2));
    root.add(mesh(GEO.box, GLASS(), 0, y + h * 0.66, z + len / 2 + 0.01, w - 0.3, h * 0.42, 0.05)); for (const sx of [-1, 1]) root.add(mesh(GEO.box, GLASS(), sx * (w / 2 + 0.005), y + h * 0.66, z + 0.05, 0.03, h * 0.36, len * 0.5), mesh(GEO.box, dark, sx * (w / 2 + 0.12), y + h * 0.7, z + len / 2 - 0.1, 0.08, 0.3, 0.14), mesh(GEO.box, dark, sx * (w / 2 + 0.01), y + h * 0.3, z, 0.02, 0.05, 0.22));
    const fz = z + len / 2 + (flat ? 0.03 : 0); root.add(mesh(GEO.box, ev ? lite : dark, 0, y + h * 0.26, fz, w * 0.5, h * 0.2, 0.04), mesh(GEO.box, CHROME(), 0, y + 0.02, fz + 0.05, w + 0.06, 0.2, 0.16));
    for (const sx of [-1, 1]) lamp(root, sx * (w / 2 - 0.22), y + h * 0.24, fz + 0.02, 0.12);
    if (ev) { root.add(mesh(GEO.box, mat(0x27ae60), 0, y + h * 0.1, z, w + 0.02, 0.12, len + 0.02), mesh(GEO.box, mat(0xfdf6e6), 0, y + h * 0.44, fz + 0.01, 0.5, 0.2, 0.03), mesh(GEO.box, mat(0x27ae60), -0.12, y + h * 0.44, fz + 0.03, 0.05, 0.14, 0.01), mesh(GEO.box, mat(0x27ae60), 0.06, y + h * 0.44, fz + 0.03, 0.05, 0.14, 0.01), mesh(GEO.box, mat(0xd7ff4a), 0, y + h + 0.12, z, 0.5, 0.06, 0.3)); }
  };
  const rear = (w: number, y: number, z: number) => { for (const sx of [-1, 1]) tail(root, sx * (w / 2 - 0.25), y, z); root.add(mesh(GEO.box, mat(0xfdf6e6), 0, y - 0.22, z, 0.6, 0.2, 0.04)); };
  if (grp === 'ba_gac') { // xe ba gác máy: đầu xe máy một bánh trước, thùng lửng hai bánh sau
    wheel(root, wheels, 0, 1.55, 0.34, 0.16, false); for (const sx of [-1, 1]) wheel(root, wheels, sx * 0.72, -0.7, 0.36, 0.2);
    root.add(mesh(GEO.box, body, 0, 0.72, 0.9, 0.34, 0.36, 1.0), mesh(GEO.box, mat(0x1d1d22), 0, 0.96, 0.7, 0.4, 0.1, 0.7), mesh(GEO.box, body, 0, 0.95, 1.38, 0.5, 0.7, 0.1).rotateX(-0.25));
    root.add(mesh(GEO.cyl, dark, 0, 1.1, 1.45, 0.04, 0.8, 0.04).rotateX(-0.3), mesh(GEO.cyl, dark, 0, 1.44, 1.36, 0.03, 0.8, 0.03).rotateZ(Math.PI / 2)); lamp(root, 0, 1.34, 1.5, 0.1);
    root.add(mesh(GEO.box, dark, 0, 0.5, -0.4, 1.3, 0.12, 2.0)); cargoBox(root, 1.5, 0.9, 1.9, 0.56, -0.55, false, true); rear(1.5, 0.75, -1.52);
    if (ev) root.add(mesh(GEO.box, mat(0x27ae60), 0, 0.6, -0.55, 1.52, 0.1, 1.92));
    return { root, wheels };
  }
  if (grp === 'ban_tai') { // bán tải: ca-bin kép có nắp ca-pô, thùng lửng ngắn, gầm cao, thanh thể thao
    for (const sx of [-1, 1]) for (const z of [1.45, -1.35]) wheel(root, wheels, sx * 0.9, z, 0.44, 0.3);
    root.add(mesh(GEO.box, dark, 0, 0.56, 0, 1.7, 0.2, 4.6), mesh(GEO.box, body, 0, 0.95, 1.85, 1.86, 0.6, 1.3), mesh(GEO.box, body, 0, 1.05, -1.35, 1.86, 0.8, 1.9));
    const top = mesh(new THREE.CylinderGeometry(0.66, 0.92, 0.66, 4, 1), body, 0, 1.6, 0.3, 1.28, 1, 1.55); top.rotation.y = Math.PI / 4; root.add(top);
    root.add(mesh(GEO.box, GLASS(), 0, 1.6, 1.3, 1.4, 0.44, 0.05).rotateX(-0.55), mesh(GEO.box, GLASS(), 0, 1.6, -0.72, 1.4, 0.4, 0.05).rotateX(0.5)); for (const sx of [-1, 1]) root.add(mesh(GEO.box, GLASS(), sx * 0.78, 1.6, 0.3, 0.04, 0.36, 1.5).rotateZ(sx * -0.28), mesh(GEO.box, body, sx * 0.8, 1.6, 0.3, 0.05, 0.42, 0.08), mesh(GEO.box, dark, sx * 1.02, 1.36, 1.05, 0.14, 0.12, 0.18));
    root.add(mesh(GEO.box, mat(0x2b2f38), 0, 1.32, -1.35, 1.66, 0.3, 1.7), mesh(GEO.box, dark, 0, 1.75, -0.55, 1.7, 0.08, 0.1), mesh(GEO.box, dark, -0.82, 1.6, -0.55, 0.08, 0.36, 0.1), mesh(GEO.box, dark, 0.82, 1.6, -0.55, 0.08, 0.36, 0.1)); // lòng thùng, thanh thể thao
    for (const [x, z, c] of [[-0.4, -1.1, 0xf4c430], [0.4, -1.5, 0x9bd64a], [0, -1.8, 0xe2573c]] as const) root.add(mesh(GEO.box, mat(0xc9975a), x, 1.56, z, 0.6, 0.36, 0.5), mesh(GEO.ball, mat(c), x, 1.8, z, 0.17));
    root.add(mesh(GEO.box, ev ? lite : dark, 0, 0.98, 2.52, 1.1, 0.3, 0.04), mesh(GEO.box, CHROME(), 0, 0.62, 2.52, 1.9, 0.2, 0.16)); for (const sx of [-1, 1]) lamp(root, sx * 0.7, 1.04, 2.5, 0.12);
    if (ev) root.add(mesh(GEO.box, mat(0x27ae60), 0, 0.72, 0, 1.88, 0.1, 4.5), mesh(GEO.box, mat(0xfdf6e6), 0, 0.78, 2.54, 0.5, 0.18, 0.03), mesh(GEO.box, mat(0x27ae60), -0.1, 0.78, 2.56, 0.05, 0.12, 0.01), mesh(GEO.box, mat(0x27ae60), 0.08, 0.78, 2.56, 0.05, 0.12, 0.01));
    rear(1.86, 1.0, -2.32);
    return { root, wheels };
  }
  if (grp === 'dau_keo') { // đầu kéo ba trục + sơ mi rơ moóc ba trục chở container
    for (const sx of [-1, 1]) { wheel(root, wheels, sx * 1.0, 4.1, 0.5, 0.34); for (const z of [1.9, 0.85]) wheel(root, wheels, sx * 0.95, z, 0.5, 0.5); for (const z of [-3.0, -4.05, -5.1]) wheel(root, wheels, sx * 0.95, z, 0.5, 0.5); }
    root.add(mesh(GEO.box, dark, 0, 0.75, 2.4, 1.3, 0.24, 4.6)); cab(2.3, 2.3, 1.9, 0.86, 3.9);
    root.add(mesh(GEO.box, lite, 0, 3.35, 3.7, 2.1, 0.5, 1.4).rotateX(0.2)); for (const sx of [-1, 1]) root.add(mesh(GEO.cyl, CHROME(), sx * 1.05, 2.3, 2.85, 0.09, 2.6, 0.09), mesh(GEO.cyl, mat(0x8f97a3), sx * 0.95, 0.8, 2.5, 0.3, 1.0, 0.3).rotateX(Math.PI / 2)); // chụp gió, ống xả đứng, bình dầu
    root.add(mesh(GEO.cyl, dark, 0, 0.98, 1.3, 0.5, 0.1, 0.5)); // mâm kéo
    root.add(mesh(GEO.box, dark, 0, 1.05, -1.8, 1.2, 0.2, 7.6), mesh(GEO.box, dark, -0.6, 0.5, -0.4, 0.1, 0.9, 0.1), mesh(GEO.box, dark, 0.6, 0.5, -0.4, 0.1, 0.9, 0.1)); // khung rơ moóc, chân chống
    const cw = 2.3, ch = 2.5, cl = 7.4, cy = 1.16, cz = -1.75, cc = cold ? 0xf4f7fa : 0xc0503a, rib = mat(cold ? 0xd9e0e6 : 0x9c3f2e);
    root.add(mesh(GEO.box, mat(cc), 0, cy + ch / 2, cz, cw, ch, cl)); for (let z = cz - cl / 2 + 0.3; z < cz + cl / 2; z += 0.37) for (const sx of [-1, 1]) root.add(mesh(GEO.box, rib, sx * (cw / 2 + 0.01), cy + ch / 2, z, 0.03, ch - 0.3, 0.12));
    root.add(mesh(GEO.box, rib, 0, cy + ch / 2, cz - cl / 2 - 0.01, 0.04, ch - 0.2, 0.03), mesh(GEO.box, mat(0x8f97a3), -0.3, cy + ch / 2, cz - cl / 2 - 0.03, 0.04, ch - 0.5, 0.03), mesh(GEO.box, mat(0x8f97a3), 0.3, cy + ch / 2, cz - cl / 2 - 0.03, 0.04, ch - 0.5, 0.03));
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) root.add(mesh(GEO.box, mat(0x2b2f38), x * (cw / 2 - 0.08), cy + ch - 0.06, cz + z * (cl / 2 - 0.1), 0.2, 0.14, 0.24));
    if (cold) root.add(mesh(GEO.box, mat(0xdfe6ee), 0, cy + ch * 0.7, cz + cl / 2 + 0.16, 1.6, 0.9, 0.3), mesh(GEO.box, mat(0x4aa3d8), 1.165, cy + ch * 0.55, cz, 0.01, 0.4, 6.0), mesh(GEO.box, mat(0x4aa3d8), -1.165, cy + ch * 0.55, cz, 0.01, 0.4, 6.0));
    rear(2.3, 0.95, cz - cl / 2 - 0.12);
    return { root, wheels };
  }
  // xe tải thùng: nhẹ (2 trục bánh nhỏ), trung (2 trục, bánh đôi sau), nặng (3 trục)
  const P = grp === 'tai_nhe' ? { w: 1.8, cabH: 1.4, cabL: 1.4, boxL: 2.7, boxH: 1.5, r: 0.4, y: 0.62, axles: [-0.6] }
    : grp === 'tai_trung' ? { w: 2.05, cabH: 1.7, cabL: 1.6, boxL: kind.startsWith('tai_3t5') ? 4.2 : 3.5, boxH: 1.9, r: 0.46, y: 0.78, axles: [-1.0] }
    : { w: 2.3, cabH: 2.0, cabL: 1.8, boxL: kind.startsWith('tai_15t') ? 6.4 : 5.2, boxH: 2.3, r: 0.5, y: 0.9, axles: kind.startsWith('tai_15t') ? [-1.6, -2.7] : [-1.6] };
  const total = P.cabL + 0.15 + P.boxL, front = total / 2, cabZ = front - P.cabL / 2, boxZ = front - P.cabL - 0.15 - P.boxL / 2;
  for (const sx of [-1, 1]) { wheel(root, wheels, sx * (P.w / 2 - 0.12), cabZ - 0.1, P.r, 0.3); for (const a of P.axles) wheel(root, wheels, sx * (P.w / 2 - (grp === 'tai_nhe' ? 0.12 : 0.2)), boxZ + a + P.boxL * 0.12, P.r, grp === 'tai_nhe' ? 0.3 : 0.5); }
  root.add(mesh(GEO.box, dark, 0, P.y - 0.08, 0, P.w - 0.5, 0.2, total - 0.2)); cab(P.w, P.cabH, P.cabL, P.y, cabZ);
  cargoBox(root, P.w, P.boxH, P.boxL, P.y + 0.06, boxZ, cold, false);
  if (grp !== 'tai_nhe') for (const sx of [-1, 1]) root.add(mesh(GEO.box, mat(0x8f97a3), sx * (P.w / 2 - 0.1), P.y - 0.2, boxZ + P.boxL * 0.3, 0.06, 0.4, P.boxL * 0.36), mesh(GEO.cyl, mat(0x8f97a3), sx * (P.w / 2 - 0.3), P.y - 0.2, cabZ - P.cabL / 2 - 0.5, 0.26, 0.7, 0.26).rotateX(Math.PI / 2)); // chắn gầm, bình dầu
  if (ev) for (const sx of [-1, 1]) root.add(mesh(GEO.box, mat(0x27ae60), sx * (P.w / 2 + 0.006), P.y + 0.5, boxZ, 0.01, 0.24, P.boxL * 0.9), mesh(GEO.box, mat(0x3a3f4a), sx * (P.w / 2 - 0.25), P.y - 0.22, boxZ + P.boxL * 0.25, 0.4, 0.4, P.boxL * 0.4)); // sọc xanh, khối pin gầm
  rear(P.w, P.y + 0.2, boxZ - P.boxL / 2 - 0.06);
  return { root, wheels };
}

/** Gộp lưới một chiếc xe: thân thành vài lưới, mỗi bánh thành một cụm quay quanh trục x. Dùng trước khi đưa xe vào cảnh. */
export function packRide(model: RideModel, shadow = true): { root: THREE.Group; wheels: THREE.Object3D[] } {
  const wheels: THREE.Object3D[] = [];
  for (const w of model.wheels) {
    model.root.remove(w);
    const pos = w.position.clone(); w.position.set(0, 0, 0);
    const holder = new THREE.Group(); holder.add(w);
    const packed = bakeColored(holder, shadow); packed.position.copy(pos); wheels.push(packed);
  }
  const root = bakeColored(model.root, shadow);
  for (const w of wheels) root.add(w);
  return { root, wheels };
}

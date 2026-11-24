// Cảnh đặc trưng từng miền, đặt ở khe giữa các lô vườn và ven đường — nơi máy quay nhìn thấy —
// để tới vùng khác là thấy khác ngay: ruộng bậc thang và trâu ở miền Bắc, đồi cát và ruộng muối miền Trung,
// rẫy cà phê và nhà rông Tây Nguyên, ao sen và xuồng miền Nam, thuyền thúng và hải đăng ở đảo.
import * as THREE from 'three';
import type { Zone } from '../../../shared/catalog.ts';
import { GEO, mat, mesh } from './plants.ts';

/** Hình ít mặt cho chi tiết nhỏ lặp nhiều (ngọn lúa, cọc, trụ): giữ số tam giác thấp. */
const TUFT = new THREE.ConeGeometry(1, 1, 5), POLE = new THREE.CylinderGeometry(1, 1, 1, 7);

type R = () => number;
let waterMat: THREE.MeshStandardMaterial | null = null;
const water = () => (waterMat ??= new THREE.MeshStandardMaterial({ color: 0x7fd3e8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9 }));
const cyl = (m: THREE.Material, x: number, y: number, z: number, r: number, h: number, r2 = r) => mesh(r > 0.3 ? GEO.cyl : POLE, m, x, y, z, r, h, r2);

function riceTufts(g: THREE.Group, r: R, x0: number, x1: number, z0: number, z1: number, y: number, color: number, n: number) {
  for (let i = 0; i < n; i++) g.add(mesh(TUFT, mat(color), x0 + r() * (x1 - x0), y + 0.18, z0 + r() * (z1 - z0), 0.09, 0.36, 0.09));
}
function palm(g: THREE.Group, r: R, x: number, z: number, h = 3.4, nipa = false) {
  if (!nipa) { const t = cyl(mat(0x9a7a50), x, h / 2, z, 0.14, h); t.rotation.z = (r() - 0.5) * 0.2; g.add(t); }
  const top = nipa ? 0.2 : h;
  for (let i = 0; i < (nipa ? 6 : 7); i++) {
    const p = new THREE.Group(); p.position.set(x, top, z); p.rotation.y = (i / 7) * 6.28 + r(); p.rotation.z = nipa ? 0.95 + r() * 0.3 : -0.45;
    p.add(mesh(GEO.sphere, mat(i % 2 ? 0x4fae58 : 0x7fcc6c), nipa ? 0.9 : 1.0, 0, 0, nipa ? 0.95 : 1.15, 0.06, 0.26)); g.add(p);
  }
  if (!nipa) g.add(mesh(GEO.sphere, mat(0x8aa83a), x + 0.16, h - 0.22, z + 0.12, 0.18), mesh(GEO.sphere, mat(0x7a9a34), x - 0.14, h - 0.26, z - 0.08, 0.17));
}
function buffalo(g: THREE.Group, x: number, z: number, rot: number) {
  const b = new THREE.Group(), body = mat(0x4b4750), horn = mat(0xd9d2c4);
  b.add(mesh(GEO.sphere, body, 0, 0.78, 0, 0.5, 0.48, 0.86), mesh(GEO.sphere, body, 0, 0.98, 0.86, 0.3, 0.3, 0.38), mesh(GEO.sphere, mat(0x6a6570), 0, 0.9, 1.14, 0.2, 0.16, 0.14));
  for (const sx of [-1, 1]) { const h = mesh(GEO.cone, horn, sx * 0.34, 1.26, 0.8, 0.06, 0.42, 0.06); h.rotation.z = -sx * 1.0; b.add(h); for (const sz of [-0.5, 0.5]) b.add(cyl(body, sx * 0.3, 0.26, sz, 0.11, 0.52)); }
  b.add(mesh(GEO.sphere, mat(0xf8d3ae), 0, 1.72, -0.1, 0.2), mesh(new THREE.ConeGeometry(0.34, 0.2, 10), mat(0xf2dc9a), 0, 1.95, -0.1), mesh(GEO.sphere, mat(0x8a6a4a), 0, 1.4, -0.1, 0.2, 0.26, 0.16)); // chú bé chăn trâu
  b.position.set(x, 0, z); b.rotation.y = rot; g.add(b);
}
function rocks(g: THREE.Group, r: R, x: number, z: number, n: number, color = 0x9aa79a, moss = true) {
  for (let i = 0; i < n; i++) {
    const s = 0.5 + r() * 0.9, px = x + (r() - 0.5) * 2.2, pz = z + (r() - 0.5) * 2.4, h = s * (1.2 + r() * 1.6);
    const m = mesh(GEO.sphere, mat(color, { rough: 1 }), px, h * 0.42, pz, s, h, s * (0.8 + r() * 0.4)); m.rotation.y = r() * 3; g.add(m);
    if (moss) g.add(mesh(GEO.sphere, mat(0x6fae5c), px, h * 0.86, pz, s * 0.72, h * 0.18, s * 0.66));
  }
}
function boat(g: THREE.Group, x: number, y: number, z: number, rot: number, color: number, len = 3.2) {
  const b = new THREE.Group();
  b.add(mesh(GEO.sphere, mat(color), 0, 0.1, 0, len / 2, 0.3, 0.5), mesh(GEO.sphere, mat(0x6e4424), 0, 0.24, 0, len / 2 - 0.2, 0.1, 0.36), mesh(GEO.box, mat(0xc9975a), -0.3, 0.34, 0, 0.12, 0.05, 0.7), mesh(GEO.box, mat(0xc9975a), 0.5, 0.34, 0, 0.12, 0.05, 0.62));
  b.position.set(x, y, z); b.rotation.y = rot; g.add(b);
}

const SCENES: Record<Zone, ((g: THREE.Group, r: R) => void)[]> = {
  bac: [
    (g, r) => { // ruộng bậc thang
      const cols = [0x8fd06a, 0xb9dc6a, 0xd9d86a, 0x9bd27a];
      for (let i = 0; i < 4; i++) {
        const z = -9 + i * 4.2, y = 0.9 - i * 0.26;
        g.add(mesh(GEO.box, mat(0x9a7652), 0, y / 2, z, 4.0, y, 3.9), mesh(GEO.box, i % 2 ? water() : mat(cols[i]), 0, y + 0.03, z, 3.6, 0.06, 3.5));
        riceTufts(g, r, -1.6, 1.6, z - 1.5, z + 1.5, y + 0.03, i % 2 ? 0x6fc15a : 0xcfc24a, 26);
      }
    },
    (g, r) => { rocks(g, r, 0, -6, 5); rocks(g, r, 0.3, 0.5, 3); buffalo(g, 0.2, 5.2, 0.6 + r()); g.add(mesh(GEO.cone, mat(0xf0cf6a), -0.9, 0.7, 2.6, 0.9, 1.4, 0.9)); },
    (g, r) => { // đồi chè
      for (let row = 0; row < 7; row++) for (let i = 0; i < 5; i++) g.add(mesh(GEO.sphere, mat(row % 2 ? 0x3f8f52 : 0x4fa35e), -1.6 + i * 0.8 + (r() - 0.5) * 0.1, 0.34 + (6 - row) * 0.08, -9 + row * 2.5, 0.46, 0.4, 0.5));
      g.add(mesh(GEO.cyl, mat(0xb9855a), 1.3, 0.3, 7.2, 0.34, 0.5, 0.3), mesh(GEO.sphere, mat(0x5cb85f), 1.3, 0.6, 7.2, 0.3, 0.14, 0.26)); // gùi chè
    },
    (g, r) => { // rặng cau và đống rơm
      for (let i = 0; i < 4; i++) { const z = -8 + i * 4.6, x = (i % 2 ? 0.9 : -0.9); g.add(cyl(mat(0xb9b0a0), x, 2.3, z, 0.09, 4.6)); for (let k = 0; k < 6; k++) { const p = new THREE.Group(); p.position.set(x, 4.6, z); p.rotation.y = k * 1.05 + r(); p.rotation.z = -0.7; p.add(mesh(GEO.sphere, mat(0x4fae58), 0.7, 0, 0, 0.8, 0.05, 0.2)); g.add(p); } g.add(mesh(GEO.sphere, mat(0xf08a24), x, 4.3, z, 0.16)); }
      g.add(mesh(GEO.cone, mat(0xf0cf6a), 0, 0.9, 6.4, 1.1, 1.8, 1.1), cyl(mat(0x9a7150), 0, 1.5, 6.4, 0.06, 3));
    },
  ],
  trung: [
    (g, r) => { // ruộng muối
      g.add(mesh(GEO.box, mat(0xd9cfb4), 0, 0.05, -1, 4.2, 0.1, 17));
      for (let i = 0; i < 4; i++) { const z = -7.4 + i * 4.2; g.add(mesh(GEO.box, water(), 0, 0.11, z, 3.7, 0.04, 3.7)); for (let k = 0; k < 3; k++) g.add(mesh(GEO.cone, mat(0xffffff), -1.1 + k * 1.1 + (r() - 0.5) * 0.3, 0.4, z + (r() - 0.5) * 2, 0.42, 0.6, 0.42)); }
    },
    (g, r) => { // trụ thanh long trên cát
      g.add(mesh(GEO.sphere, mat(0xf0e2b0, { rough: 1 }), 0, 0, -1, 2.3, 0.22, 9));
      for (let i = 0; i < 5; i++) { const z = -8 + i * 3.6, x = i % 2 ? 0.8 : -0.8; g.add(mesh(GEO.box, mat(0xbdb5a6), x, 0.8, z, 0.2, 1.6, 0.2)); for (let k = 0; k < 6; k++) { const p = new THREE.Group(); p.position.set(x, 1.6, z); p.rotation.y = k * 1.05; p.rotation.z = 0.9; p.add(mesh(GEO.box, mat(0x5fae5a), 0.5, 0, 0, 1.0, 0.1, 0.12)); g.add(p); } g.add(mesh(GEO.sphere, mat(0xe8457f), x + 0.6, 1.2, z + 0.2, 0.14), mesh(GEO.sphere, mat(0xe8457f), x - 0.5, 1.1, z - 0.3, 0.14)); }
      void r;
    },
    (g, r) => { // phi lao chắn cát, thuyền thúng phơi lưới
      for (let i = 0; i < 5; i++) { const x = (r() - 0.5) * 2.6, z = -9 + i * 2.6; g.add(cyl(mat(0x7a5a3a), x, 1.5, z, 0.1, 3)); for (let k = 0; k < 3; k++) g.add(mesh(GEO.cone, mat(k % 2 ? 0x5f9a6a : 0x4f8a5c), x, 2 + k * 0.9, z, 0.7 - k * 0.15, 1.5, 0.7 - k * 0.15)); }
      g.add(mesh(GEO.sphere, mat(0x6fb7d9), 0.2, 0.3, 5.6, 1.0, 0.4, 1.0), mesh(GEO.sphere, mat(0x3a4a5a), 0.2, 0.42, 5.6, 0.86, 0.3, 0.86));
      for (const x of [-1.5, 1.5]) g.add(cyl(mat(0x9a7150), x, 0.9, 7.6, 0.06, 1.8)); g.add(mesh(GEO.box, mat(0x8fd3c0, { transparent: 0.6 }), 0, 1.25, 7.6, 3, 0.9, 0.04));
    },
    (g, r) => { rocks(g, r, 0, -5.5, 4, 0xc9b79a, false); palm(g, r, -0.6, 1.5, 3.8); palm(g, r, 0.9, 5.5, 3.2); g.add(mesh(GEO.sphere, mat(0xf0e2b0, { rough: 1 }), 0.2, 0, 3.4, 2.2, 0.18, 4.5)); },
  ],
  taynguyen: [
    (g, r) => { // rẫy cà phê
      g.add(mesh(GEO.box, mat(0xb86f4a), 0, 0.04, -1, 4.2, 0.08, 17));
      for (let row = 0; row < 6; row++) for (const x of [-1.2, 0, 1.2]) { const z = -8.4 + row * 3; g.add(cyl(mat(0x7a5233), x, 0.4, z, 0.06, 0.8), mesh(GEO.sphere, mat(row % 2 ? 0x3f8f52 : 0x357f48), x, 1.0, z, 0.56, 0.6, 0.56)); for (let k = 0; k < 4; k++) g.add(mesh(GEO.sphere, mat(0xc0281e), x + (r() - 0.5) * 0.8, 0.8 + r() * 0.5, z + 0.45 + r() * 0.1, 0.07)); }
    },
    (g, r) => { // nhà rông
      for (const x of [-1.2, 1.2]) for (const z of [-5.4, -2.6]) g.add(cyl(mat(0x7a5233), x, 0.6, z, 0.12, 1.2));
      g.add(mesh(GEO.box, mat(0xb9855a), 0, 1.28, -4, 3.2, 0.16, 3.6), mesh(GEO.box, mat(0xd9a877), 0, 1.9, -4, 2.8, 1.1, 3.2));
      const roof = mesh(new THREE.CylinderGeometry(0.05, 2.2, 5.2, 4, 1), mat(0xc9a25a), 0, 5.0, -4, 0.9, 1, 1.1); roof.rotation.y = Math.PI / 4; g.add(roof);
      for (let i = 0; i < 4; i++) g.add(mesh(GEO.box, mat(0xb9855a), 0, 0.2 + i * 0.3, -1.9 + i * -0.02 + (3 - i) * 0.25, 0.9, 0.08, 0.26));
      for (let i = 0; i < 5; i++) g.add(cyl(mat(0x8a5f3c), -1.2 + i * 0.6, 0.25, 3.6 + (i % 2) * 0.5, 0.25, 0.5)); // khúc gỗ
      for (let i = 0; i < 3; i++) g.add(mesh(GEO.cone, mat(0x4f9f6a), (r() - 0.5) * 2.6, 1.6, 6 + i, 0.8, 3.2, 0.8));
    },
    (g, r) => { // trụ tiêu
      for (let row = 0; row < 5; row++) for (const x of [-1, 1]) { const z = -8 + row * 3.8; g.add(cyl(mat(0x8a6a4a), x, 1.6, z, 0.1, 3.2), cyl(mat(row % 2 ? 0x3f8f52 : 0x4fa35e), x, 1.7, z, 0.36, 3.0), mesh(GEO.sphere, mat(0x4fa35e), x, 3.3, z, 0.42)); for (let k = 0; k < 3; k++) g.add(mesh(GEO.sphere, mat(0xc0392b), x + 0.34, 1 + r() * 1.8, z + (r() - 0.5) * 0.3, 0.06)); }
    },
    (g, r) => { // đồi thông, đất đỏ
      g.add(mesh(GEO.sphere, mat(0xc98058, { rough: 1 }), 0, 0, -3, 2.3, 0.5, 6));
      for (let i = 0; i < 7; i++) { const x = (r() - 0.5) * 3.2, z = -9 + r() * 16, s = 0.8 + r() * 0.6; g.add(cyl(mat(0x7a5233), x, 0.6 * s, z, 0.14 * s, 1.2 * s)); for (let k = 0; k < 3; k++) g.add(mesh(GEO.cone, mat(k % 2 ? 0x4f9f6a : 0x66b47c), x, (1.5 + k * 0.9) * s, z, (1.15 - k * 0.3) * s, 1.5 * s, (1.15 - k * 0.3) * s)); }
    },
  ],
  nam: [
    (g, r) => { // ao sen
      g.add(mesh(GEO.sphere, mat(0xa8744a, { rough: 1 }), 0, 0, -1, 2.4, 0.16, 8.6), mesh(GEO.sphere, water(), 0, 0.07, -1, 2.1, 0.12, 8.2));
      for (let i = 0; i < 16; i++) { const x = (r() - 0.5) * 3, z = -8 + r() * 14; g.add(cyl(mat(i % 2 ? 0x5cb85f : 0x79c96d), x, 0.22, z, 0.42 + r() * 0.2, 0.03)); if (i % 3 === 0) g.add(cyl(mat(0x5cb85f), x + 0.2, 0.55, z, 0.03, 0.7), mesh(GEO.sphere, mat(i % 2 ? 0xf29bc0 : 0xffd0e0), x + 0.2, 0.95, z, 0.19, 0.22, 0.19)); }
    },
    (g, r) => { // mương nước, xuồng ba lá, cầu khỉ, dừa nước
      g.add(mesh(GEO.box, mat(0x9a7652), 0, 0.02, -1, 3.6, 0.04, 17.4), mesh(GEO.box, water(), 0, 0.06, -1, 2.8, 0.04, 17.4));
      boat(g, 0.2, 0.08, 3.4, Math.PI / 2 + 0.15, 0x8a5f3c, 3.4); boat(g, -0.3, 0.08, -5.5, Math.PI / 2 - 0.2, 0x6fb7d9, 2.8);
      for (const x of [-1.9, 1.9]) for (const dz of [-0.25, 0.25]) { const p = cyl(mat(0x8a6a4a), x, 0.9, -1 + dz, 0.05, 2); p.rotation.z = x > 0 ? -0.2 : 0.2; g.add(p); }
      g.add(cyl(mat(0x9a7a50), 0, 1.15, -1, 0.07, 4.2)); (g.children[g.children.length - 1] as THREE.Mesh).rotation.z = Math.PI / 2;
      for (const [x, z] of [[-1.7, 6.5], [1.8, -8.2], [-1.8, -3.4], [1.7, 1.2]]) palm(g, r, x, z, 0, true);
    },
    (g, r) => { // vườn chuối, dừa
      palm(g, r, -0.8, -7, 4.4); palm(g, r, 0.9, 5, 3.8);
      for (let i = 0; i < 5; i++) { const x = (r() - 0.5) * 2.6, z = -4.5 + i * 1.9; g.add(cyl(mat(0x9cc46a), x, 0.8, z, 0.14, 1.6)); for (let k = 0; k < 5; k++) { const p = new THREE.Group(); p.position.set(x, 1.6, z); p.rotation.y = k * 1.26 + r(); p.rotation.z = -0.5 - r() * 0.3; p.add(mesh(GEO.sphere, mat(k % 2 ? 0x5cb85f : 0x8fd67c), 0.7, 0, 0, 0.8, 0.05, 0.3)); g.add(p); } if (i % 2) g.add(mesh(GEO.sphere, mat(0xf2d544), x + 0.2, 1.25, z + 0.15, 0.16, 0.26, 0.16)); }
    },
    (g, r) => { // ruộng lúa nước
      g.add(mesh(GEO.box, mat(0x9a7652), 0, 0.06, -1, 4.2, 0.12, 17.2), mesh(GEO.box, water(), 0, 0.13, -1, 3.8, 0.03, 16.8));
      for (let row = 0; row < 20; row++) for (let i = 0; i < 6; i++) g.add(mesh(TUFT, mat((row + i) % 3 ? 0x6fc15a : 0x9ad466), -1.6 + i * 0.64 + (r() - 0.5) * 0.1, 0.34, -9 + row * 0.84, 0.1, 0.44, 0.1));
      g.add(cyl(mat(0x9a7150), 1.2, 0.9, 2, 0.05, 1.8), mesh(GEO.box, mat(0x9a7150), 1.2, 1.35, 2, 1.3, 0.06, 0.06), mesh(GEO.box, mat(0xf08a6c), 1.2, 1.1, 2, 0.6, 0.6, 0.2), mesh(GEO.sphere, mat(0xf6e3b0), 1.2, 1.7, 2, 0.24), mesh(new THREE.ConeGeometry(0.4, 0.24, 10), mat(0xf2dc9a), 1.2, 1.96, 2));
    },
  ],
  dao: [
    (g, r) => { // ghe kéo lên bãi, lưới phơi
      g.add(mesh(GEO.sphere, mat(0xf3e6b8, { rough: 1 }), 0, 0, -1, 2.4, 0.2, 9));
      boat(g, 0.1, 0.2, -5, 0.5, 0x3f7fc0, 3.8); boat(g, -0.2, 0.2, 4.6, -0.4, 0xe0563a, 3.2);
      for (const z of [-0.8, 1.6]) g.add(cyl(mat(0x9a7150), -1.5, 0.9, z, 0.06, 1.8), cyl(mat(0x9a7150), 1.5, 0.9, z, 0.06, 1.8), mesh(GEO.box, mat(0x8fd3c0, { transparent: 0.6 }), 0, 1.3, z, 3, 0.8, 0.04));
      for (let i = 0; i < 5; i++) g.add(mesh(GEO.sphere, mat([0xf08a6c, 0xffffff, 0xf2c65c][i % 3]), -1.2 + i * 0.6, 1.72, -0.8, 0.12));
      void r;
    },
    (g, r) => { // hải đăng trên mỏm đá
      rocks(g, r, 0, -5, 6, 0x8f9aa0, false);
      g.add(cyl(mat(0xfdf6e6), 0, 3.4, -5, 0.75, 5.2, 0.75), cyl(mat(0xe0563a), 0, 2.4, -5, 0.8, 0.9, 0.8), cyl(mat(0xe0563a), 0, 4.6, -5, 0.72, 0.9, 0.72), cyl(mat(0x3a3f4a), 0, 6.1, -5, 0.95, 0.14, 0.95), cyl(mat(0xfff3b0, { emissive: 0xffd05a }), 0, 6.55, -5, 0.5, 0.8, 0.5), mesh(GEO.cone, mat(0xe0563a), 0, 7.25, -5, 0.7, 0.7, 0.7));
      palm(g, r, 0.6, 3.5, 3.6); g.add(mesh(GEO.sphere, mat(0xf3e6b8, { rough: 1 }), 0, 0, 4, 2.2, 0.18, 4));
    },
    (g, r) => { // giàn phơi cá mực, dừa
      g.add(mesh(GEO.sphere, mat(0xf3e6b8, { rough: 1 }), 0, 0, -1, 2.3, 0.18, 9));
      for (const z of [-6, -3, 0]) { for (const x of [-1.5, 1.5]) g.add(cyl(mat(0x9a7150), x, 0.5, z, 0.06, 1)); g.add(mesh(GEO.box, mat(0xc9a25a), 0, 1.02, z, 3.3, 0.06, 1.4)); for (let i = 0; i < 6; i++) g.add(mesh(GEO.box, mat(i % 2 ? 0xf2c9b0 : 0xe9a98a), -1.3 + i * 0.52, 1.08, z + (r() - 0.5) * 0.6, 0.3, 0.04, 0.5)); }
      palm(g, r, -0.7, 4, 4.2); palm(g, r, 1.0, 7, 3.4);
      g.add(mesh(GEO.sphere, mat(0x6fb7d9), 0.9, 0.3, 2.6, 0.9, 0.36, 0.9), mesh(GEO.sphere, mat(0x3a4a5a), 0.9, 0.4, 2.6, 0.76, 0.28, 0.76));
    },
    (g, r) => { rocks(g, r, 0.2, -6, 4, 0x8f9aa0, false); palm(g, r, -0.8, -1, 4); palm(g, r, 0.8, 2.6, 3.4); palm(g, r, -0.3, 6.4, 4.4); g.add(mesh(GEO.sphere, mat(0xf3e6b8, { rough: 1 }), 0, 0, 2, 2.3, 0.18, 7)); },
  ],
};

/** Một tiểu cảnh cho khe giữa hai lô (rộng ~4,4 m, sâu từ z = −10 tới z = 8, mặt đường ở phía +z). */
export function zoneScene(zone: Zone, index: number, r: R): THREE.Group {
  const g = new THREE.Group(), list = SCENES[zone];
  list[((index % list.length) + list.length) % list.length](g, r);
  return g;
}

/** Nhà mặc định theo miền khi chủ vườn chưa chọn kiểu. */
export function zoneHouse(zone: Zone): string { return zone === 'taynguyen' ? 'nha_san' : zone === 'bac' ? 'nha_ba_gian' : 'mai_ngoi'; }

/** Đồ ven đường theo miền (đặt trên dải cỏ trước hàng rào): gom rơm, chum, giỏ cá, bao cà phê… */
export function roadsideProp(zone: Zone, index: number, r: R): THREE.Group {
  const g = new THREE.Group(), k = ((index % 3) + 3) % 3;
  if (zone === 'bac') { if (k === 0) { g.add(mesh(GEO.cone, mat(0xf0cf6a), 0, 0.6, 0, 0.8, 1.2, 0.8)); } else if (k === 1) { for (let i = 0; i < 3; i++) g.add(cyl(mat(0xb9855a), -0.5 + i * 0.5, 0.3, (r() - 0.5) * 0.3, 0.26, 0.5, 0.22), mesh(GEO.sphere, mat(0x5cb85f), -0.5 + i * 0.5, 0.56, 0, 0.22, 0.1, 0.2)); } else g.add(mesh(GEO.sphere, mat(0x9aa79a, { rough: 1 }), 0, 0.3, 0, 0.7, 0.6, 0.6), mesh(GEO.sphere, mat(0x6fae5c), 0, 0.6, 0, 0.5, 0.14, 0.44)); }
  else if (zone === 'trung') { if (k === 0) g.add(mesh(GEO.sphere, mat(0x6fb7d9), 0, 0.3, 0, 0.8, 0.34, 0.8), mesh(GEO.sphere, mat(0x3a4a5a), 0, 0.4, 0, 0.68, 0.26, 0.68)); else if (k === 1) for (let i = 0; i < 3; i++) g.add(mesh(GEO.cone, mat(0xffffff), -0.6 + i * 0.6, 0.3, (r() - 0.5) * 0.4, 0.34, 0.6, 0.34)); else g.add(mesh(GEO.sphere, mat(0xc9b79a, { rough: 1 }), 0, 0.25, 0, 0.7, 0.5, 0.5)); }
  else if (zone === 'taynguyen') { if (k === 0) for (let i = 0; i < 3; i++) g.add(mesh(GEO.sphere, mat(0xc9a66b), -0.5 + i * 0.5, 0.3 + (i === 1 ? 0.42 : 0), 0, 0.34, 0.3, 0.26)); else if (k === 1) { for (let i = 0; i < 4; i++) { const l = cyl(mat(0x8a5f3c), 0, 0.2 + (i > 1 ? 0.36 : 0), -0.3 + (i % 2) * 0.5 + (i > 1 ? 0.05 : 0), 0.2, 1.6); l.rotation.z = Math.PI / 2; g.add(l); } } else g.add(cyl(mat(0xb9855a), 0, 0.4, 0, 0.34, 0.7, 0.24), mesh(GEO.sphere, mat(0xc0281e), 0, 0.76, 0, 0.3, 0.1, 0.3)); }
  else if (zone === 'nam') { if (k === 0) for (let i = 0; i < 2; i++) g.add(mesh(GEO.sphere, mat(0xb5613c), -0.5 + i, 0.5, 0, 0.5, 0.55, 0.5), cyl(water(), -0.5 + i, 0.98, 0, 0.3, 0.03)); else if (k === 1) for (let i = 0; i < 5; i++) g.add(mesh(GEO.sphere, mat(i % 2 ? 0x7a9a3a : 0x8aa83a), -0.5 + (i % 3) * 0.5, 0.24 + (i > 2 ? 0.36 : 0), (i > 2 ? 0 : (r() - 0.5) * 0.3), 0.26)); else g.add(mesh(GEO.cone, mat(0xf0cf6a), 0, 0.5, 0, 0.7, 1.0, 0.7)); }
  else { if (k === 0) g.add(cyl(mat(0xb9855a), 0, 0.3, 0, 0.4, 0.5, 0.34), mesh(GEO.sphere, mat(0xc9d6e0), 0, 0.56, 0, 0.34, 0.1, 0.34)); else if (k === 1) g.add(mesh(GEO.sphere, mat(0xe0563a), 0, 0.3, 0, 0.3), mesh(GEO.sphere, mat(0xffffff), 0.5, 0.26, 0.2, 0.26), cyl(mat(0x9a7150), -0.5, 0.2, 0, 0.3, 0.14)); else g.add(mesh(GEO.sphere, mat(0x8f9aa0, { rough: 1 }), 0, 0.25, 0, 0.6, 0.5, 0.5)); }
  return g;
}

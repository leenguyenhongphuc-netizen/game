// Khối dựng dùng chung cho các địa danh Nam Trung Bộ và Tây Nguyên: tháp Chăm, nhà rông Ba Na, nhà dài Ê Đê, thông ba lá,
// cột đá bazan lục giác, thác nước, đồi cát, cầu treo dây văng, xương rồng.
import * as THREE from 'three';
import { mat, mesh } from '../../scene/plants.ts';
import { Kit, V, ball, bead, box, cone, cyl, gable, glow, grp, strip } from '../SightKit.ts';
import { kalan } from './dn_my_son.ts';

export { kalan };
export const BRICK = 0xb4593c, BRICK2 = 0x9c4a32, BRICK3 = 0xc46a48, SAND_STONE = 0xbcae90, DARK = 0x3a2420;

/** Tháp mái thuyền (tháp Bia, tháp Lửa): thân chữ nhật dài theo x, mái cong hình yên ngựa hai đầu vểnh. */
export function saddleTower(len: number, w: number, h: number): THREE.Group {
  const g = new THREE.Group();
  g.add(box(BRICK2, 0, 0.25, 0, len + 0.8, 0.5, w + 0.8), box(BRICK, 0, 0.5 + h / 2, 0, len, h, w));
  for (const k of [-0.36, -0.12, 0.12, 0.36]) for (const sz of [-1, 1]) g.add(box(BRICK3, k * len, 0.5 + h / 2, sz * (w / 2 + 0.05), len * 0.07, h * 0.96, 0.14));
  for (const sz of [-1, 1]) g.add(box(DARK, 0, 0.5 + h * 0.4, sz * (w / 2 + 0.08), len * 0.14, h * 0.5, 0.1), gable(BRICK2, 0, 0.5 + h * 0.66, sz * (w / 2 + 0.1), len * 0.24, 0.5, 0.12, Math.PI / 2));
  g.add(box(BRICK2, 0, 0.5 + h + 0.15, 0, len + 0.3, 0.3, w + 0.3));
  for (let i = 0; i < 9; i++) {
    const t = (i - 4) / 4, y = 0.5 + h + 0.6 + t * t * h * 0.32, ww = w * (0.95 - Math.abs(t) * 0.22);
    g.add(box(i % 2 ? BRICK : BRICK3, t * len * 0.46, y, 0, len * 0.12, 0.9, ww), cyl(BRICK2, t * len * 0.46, y + 0.45, 0, ww * 0.5, len * 0.12).rotateZ(Math.PI / 2));
  }
  return g;
}

/** Nhà rông Ba Na: nhà sàn cột gỗ, mái lá dựng đứng như lưỡi rìu (hai mặt tam giác xoè ra ở đỉnh), nóc có sừng trang trí. Dài theo x. */
export function rongHouse(len: number, w: number, roofH: number): THREE.Group {
  const g = new THREE.Group(), FLOOR = 2.4, THATCH = 0x8a6a3a, THATCH2 = 0x9c7a44, WOOD = 0x5a3d26, BAMBOO = 0xb8955a;
  for (let i = 0; i <= 6; i++) for (const sz of [-1, 1]) g.add(cyl(WOOD, -len / 2 + (i * len) / 6, FLOOR / 2, sz * w * 0.42, 0.22, FLOOR));
  g.add(box(0x7a5a3c, 0, FLOOR, 0, len + 0.4, 0.28, w + 0.4));
  // vách tre đan thấp, mái lá trùm gần sát sàn
  for (const sz of [-1, 1]) g.add(box(BAMBOO, 0, FLOOR + 0.9, sz * w / 2, len, 1.6, 0.14));
  for (const sx of [-1, 1]) g.add(box(BAMBOO, sx * len / 2, FLOOR + 0.9, 0, 0.14, 1.6, w));
  // mái: lăng trụ cao, hai đầu hồi phình ra ở đỉnh như lưỡi rìu (mỗi lớp mái cao hơn thì dài hơn)
  const layers = 6;
  for (let k = 0; k < layers; k++) {
    const t = k / (layers - 1), y = FLOOR + 1.4 + t * roofH * 0.82, lw = w * (1.15 - t * 0.95), ll = len * (0.98 + t * 0.32);
    g.add(gable(k % 2 ? THATCH : THATCH2, 0, y, 0, lw, roofH * 0.2, ll, Math.PI / 2));
  }
  g.add(box(0x4a3420, 0, FLOOR + 1.4 + roofH, 0, len * 1.34, 0.3, 0.3));
  for (const sx of [-1, 1]) { const h = cone(0x3a2a1a, sx * len * 0.67, FLOOR + 1.9 + roofH, 0, 0.18, 1.4); h.rotation.z = -sx * 0.5; g.add(h); }
  // đầu hồi trang trí hoạ tiết đỏ đen trắng
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) g.add(box([0xb8322a, 0xf4ead0, 0x2a1a12, 0xb8322a][k], sx * len * (0.5 + k * 0.03), FLOOR + 2.4 + k * roofH * 0.18, 0, 0.06, roofH * 0.1, w * (0.5 - k * 0.1)));
  // cầu thang gỗ lên sàn (mặt +z)
  const st = new THREE.Group(); for (let i = 0; i < 8; i++) st.add(box(0x7a5a3c, 0, 0.2 + i * 0.3, w / 2 + 2.2 - i * 0.28, 1.6, 0.1, 0.32)); for (const sx of [-0.85, 0.85]) st.add(box(WOOD, sx, 1.3, w / 2 + 1.2, 0.12, 0.12, 2.6).rotateX(0.78)); g.add(st);
  return g;
}

/** Nhà sàn thấp (nhà ở Ba Na, nhà dài Ê Đê): dài theo x, mái hai dốc. */
export function stiltHouse(len: number, w: number, roof = 0x8a6a3a, wall = 0xb8955a, floor = 1.6): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i <= Math.max(2, Math.round(len / 3)); i++) for (const sz of [-1, 1]) g.add(cyl(0x5a3d26, -len / 2 + (i * len) / Math.max(2, Math.round(len / 3)), floor / 2, sz * w * 0.42, 0.16, floor));
  g.add(box(0x7a5a3c, 0, floor, 0, len, 0.22, w), box(wall, 0, floor + 1.1, 0, len - 0.3, 2, w - 0.3), gable(roof, 0, floor + 2.1, 0, w + 1.6, 2.2, len + 1.2, Math.PI / 2));
  for (let i = 0; i < Math.floor(len / 3); i++) g.add(box(0x3a2a1a, -len / 2 + 1.5 + i * 3, floor + 1.2, w / 2 - 0.12, 0.7, 0.7, 0.06));
  g.add(box(0x7a5a3c, 0, floor / 2, w / 2 + 0.9, 1.0, 0.1, 2).rotateX(0.65));
  return g;
}

/** Thông ba lá Đà Lạt / Tây Nguyên: thân thẳng cao, tán nhiều tầng thưa. */
export function pine(r: () => number, h = 12): THREE.Group {
  const g = new THREE.Group(); g.add(cyl(0x6a4a32, 0, h * 0.45, 0, 0.22 + h * 0.012, h * 0.9));
  const n = 5;
  for (let i = 0; i < n; i++) { const t = i / (n - 1), y = h * (0.42 + t * 0.52), rr = (1 - t * 0.7) * h * 0.2; g.add(cone(i % 2 ? 0x2f5d3a : 0x3a6e45, (r() - 0.5) * 0.6, y, (r() - 0.5) * 0.6, rr, h * 0.2)); }
  g.rotation.y = r() * 6; return g;
}

const HEX = new THREE.CylinderGeometry(1, 1, 1, 6);
/** Cột đá bazan lục giác: một cột, mặt trên nghiêng nhẹ; xếp sát nhau thành bãi tổ ong. */
export function hexColumn(c: number, x: number, z: number, r: number, h: number, tilt = 0): THREE.Mesh { const o = mesh(HEX, mat(c), x, h / 2, z, r, h, r); o.rotation.set(tilt, 0, tilt * 0.6); return o; }
/** Rải cột lục giác theo lưới tổ ong trong vùng elip; cao độ do hàm h(x, z) quyết định. */
export function basaltField(kit: Kit, cx: number, cz: number, rx: number, rz: number, h: (x: number, z: number) => number, cell = 0.95, tones = [0x3d3a3a, 0x4a4644, 0x34302f, 0x524c48]): void {
  const r = kit.r, dz = cell * 0.866;
  for (let j = 0; j * dz < rz * 2; j++) for (let i = 0; i * cell < rx * 2; i++) {
    const x = cx - rx + i * cell + (j % 2) * cell * 0.5, z = cz - rz + j * dz;
    if (((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 > 1) continue;
    const hh = h(x, z); if (hh <= 0.05) continue;
    kit.add(hexColumn(tones[(i * 7 + j * 3) % tones.length], x, z, cell * 0.55, hh + r() * 0.15, (r() - 0.5) * 0.12));
  }
}

/** Thác nước: màn nước sáng chảy xuống (vân trôi), bọt trắng ở chân thác, hạt bụi nước bay. Mặt thác quay về +z. */
export function waterfall(kit: Kit, x: number, y: number, z: number, w: number, h: number): void {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d')!;
  g.fillStyle = '#cfe9f2'; g.fillRect(0, 0, 64, 128);
  for (let i = 0; i < 70; i++) { g.fillStyle = i % 3 ? 'rgba(255,255,255,0.7)' : 'rgba(150,200,220,0.6)'; g.fillRect(Math.random() * 64, Math.random() * 128, 1 + Math.random() * 2, 8 + Math.random() * 30); }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(Math.max(1, w / 6), Math.max(1, h / 10)); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.92, fog: true });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); sheet.position.set(x, y + h / 2, z); kit.live(sheet);
  // mép trên cong ra một chút cho có dòng chảy tràn
  const lip = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.2).rotateX(-1.1), m); lip.position.set(x, y + h + 0.4, z - 0.9); kit.live(lip);
  const foam = Array.from({ length: 6 }, (_, i) => { const f = ball(glow(0xffffff), x + (i - 2.5) * (w / 6), y + 0.3, z + 1.2, w / 9, 0.6, 1.8); kit.live(f); return f; });
  kit.onTick((t) => { tex.offset.y = t * 0.9; foam.forEach((f, i) => { const k = 0.85 + Math.sin(t * 3 + i * 1.7) * 0.15; f.scale.set((w / 9) * k, 0.6 * k, 1.8 * k); }); });
  const r = kit.r;
  kit.motes(70, 0xffffff, 0.7, () => V(x + (r() - 0.5) * w, y + r() * 6, z + 2 + r() * 8), (p, i, t) => { p.y += 0.02 + Math.sin(t + i) * 0.004; if (p.y > y + 9) p.y = y; p.x += Math.sin(t * 0.7 + i) * 0.01; });
}

/** Cao độ mặt một đồi cát (elip tâm chìm 1,5h dưới đất, bán trục đứng 2,5h) tại (x, z) theo toạ độ cục bộ đã xoay. */
export function duneHeight(dx: number, dz: number, rx: number, h: number, rz: number): number { const d2 = (dx / rx) ** 2 + (dz / rz) ** 2; return d2 >= 1 ? 0 : Math.max(0, -h * 1.5 + h * 2.5 * Math.sqrt(1 - d2)); }
/** Đồi cát: elip chìm sâu để chân đồi thoải (đi bộ lên được khi h ≤ ~0,22 bán kính); gợn cát sẫm hơn. */
export function dune(c: number, x: number, z: number, rx: number, h: number, rz: number, ry = 0): THREE.Group {
  const g = grp(x, 0, z, ry, ball(c, 0, -h * 1.5, 0, rx, h * 2.5, rz));
  // gợn cát: các vệt sẫm nằm trên mặt đồi theo đường đồng mức
  for (let k = 1; k <= 3; k++) { const t = k / 4, y = duneHeight(rx * t, 0, rx, h, rz); g.add(cyl(new THREE.Color(c).multiplyScalar(0.93).getHex(), 0, y - 0.15, 0, rx * t * 1.01, 0.32, rz * t * 1.01)); }
  return g;
}

/** Cầu treo dây văng giữa hai mố: mặt cầu dọc x từ a tới b, hai tháp chữ A, dây chủ võng, dây treo đứng. */
export function suspensionBridge(kit: Kit, a: THREE.Vector3, b: THREE.Vector3, width: number, towerH: number, deck = 0xc9c2b4, tower = 0xe8e2d4): void {
  kit.add(strip(deck, a, b, width, 0.5));
  const len = a.distanceTo(b), dir = b.clone().sub(a).normalize(), side = new THREE.Vector3(-dir.z, 0, dir.x);
  for (const sz of [-1, 1]) kit.add(strip(0x8a8a8a, a.clone().addScaledVector(side, sz * (width / 2 - 0.1)).setY(a.y + 1.1), b.clone().addScaledVector(side, sz * (width / 2 - 0.1)).setY(b.y + 1.1), 0.08, 0.08));
  const towers = [0.22, 0.78].map((t) => a.clone().lerp(b, t));
  for (const p of towers) for (const sz of [-1, 1]) { const q = p.clone().addScaledVector(side, sz * (width / 2 + 0.3)); kit.add(box(tower, q.x, a.y + towerH / 2, q.z, 0.8, towerH, 0.8)); }
  for (const p of towers) kit.add(box(tower, p.x, a.y + towerH - 0.4, p.z, 0.6, 0.6, width + 1.6, Math.atan2(dir.x, dir.z) + Math.PI / 2));
  // dây chủ: đường võng giữa hai tháp, xuống neo ở hai đầu
  const n = 24;
  for (const sz of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= n; i++) { const t = i / n, p = a.clone().lerp(b, t).addScaledVector(side, sz * (width / 2 + 0.3)); const u = t < 0.22 ? t / 0.22 : t > 0.78 ? (1 - t) / 0.22 : 1; const mid = (t - 0.5) / 0.28; p.y = a.y + (t < 0.22 || t > 0.78 ? 1.2 + u * (towerH - 1.6) : 2 + (towerH - 2.4) * mid * mid); pts.push(p); }
    for (let i = 0; i < n; i++) kit.add(strip(0x6a6a6a, pts[i], pts[i + 1], 0.12, 0.12));
    for (let i = 2; i < n - 1; i++) { const p = pts[i]; if (p.y - a.y > 1.6) kit.add(box(0x7a7a7a, p.x, (a.y + 0.3 + p.y) / 2, p.z, 0.05, p.y - a.y - 0.3, 0.05)); }
  }
  void len; void bead;
}

/** Xương rồng (vùng khô Ninh Thuận, Bình Thuận). */
export function cactus(s = 1): THREE.Group { const c = 0x5f8a4a; return grp(0, 0, 0, 0, cyl(c, 0, 1 * s, 0, 0.28 * s, 2 * s), cyl(c, 0.5 * s, 1.2 * s, 0, 0.18 * s, 0.9 * s), cyl(c, 0.6 * s, 1.6 * s, 0, 0.16 * s, 0.6 * s), cyl(c, -0.45 * s, 0.9 * s, 0, 0.16 * s, 0.6 * s), cyl(c, -0.5 * s, 1.25 * s, 0, 0.14 * s, 0.5 * s), bead(0xf2c14e, 0, 2.05 * s, 0, 0.12 * s)); }

/** Đá granite tròn nhẵn chồng lên nhau (Kỳ Co, Vĩnh Hy, Eo Gió). */
export function boulders(kit: Kit, cx: number, cz: number, n: number, spread: number, size: number, tones = [0x9a9288, 0xa89f94, 0x8a8278, 0xb0a698]): void {
  const r = kit.r;
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = r() * spread, s = size * (0.5 + r()); kit.add(ball(tones[i % tones.length], cx + Math.cos(a) * d, s * 0.55, cz + Math.sin(a) * d, s * (1 + r() * 0.4), s * (0.7 + r() * 0.3), s)); }
}

/** Tượng trắng đứng (tượng Phật, tượng Đức Mẹ) trên bệ. */
export function whiteStatue(h = 5, robe = 0xf4f1ea): THREE.Group {
  return grp(0, 0, 0, 0, box(0xcfc8b8, 0, 0.6, 0, 2.2, 1.2, 2.2), cone(robe, 0, 1.2 + h * 0.38, 0, h * 0.2, h * 0.76), ball(robe, 0, 1.2 + h * 0.8, 0, h * 0.11), ball(0xffffff, 0, 1.2 + h * 0.9, 0, h * 0.1));
}

// Hình khối dùng chung cho các cảnh biển, làng chài, làng nghề: thuyền thúng, dừa nước, phi lao, cờ, sóng, tranh tường…
import * as THREE from 'three';
import { bake } from '../../scene/World.ts';
import { Kit, V, ball, bead, box, cone, cyl, glow, grp, person, strip } from '../SightKit.ts';

export { bake };
export type Spots = { shopSpots: THREE.Vector3[] };

/** Thuyền thúng đặc (để bày trên bãi, neo ở bến): đường kính khoảng 2 m. */
export function coracle(s = 1, rim = 0xe2c58a, body = 0x7a5a3c, inside = 0x4f3a26): THREE.Group {
  return grp(0, 0, 0, 0, cyl(body, 0, 0.3 * s, 0, 1.0 * s, 0.6 * s), cyl(inside, 0, 0.56 * s, 0, 0.9 * s, 0.1 * s), cyl(rim, 0, 0.62 * s, 0, 1.06 * s, 0.07 * s), cyl(inside, 0, 0.6 * s, 0, 0.9 * s, 0.08 * s));
}
/** Thuyền thúng rỗng lòng (người đứng được bên trong), đáy ở y = 0. */
export function hollowCoracle(radius = 1.2, depth = 0.75, body = 0x7a5a3c, rim = 0xe2c58a): THREE.Group {
  const g = new THREE.Group();
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.86, depth, 22, 1, true), new THREE.MeshLambertMaterial({ color: body, side: THREE.DoubleSide })); wall.position.y = depth / 2 - 0.08;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.87, 22).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x5a4330 })); floor.position.y = -0.04;
  const edge = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.06, 6, 24).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: rim })); edge.position.y = depth - 0.08;
  g.add(wall, floor, edge); return g;
}
/** Bụi dừa nước: tàu lá dài vươn thẳng từ mặt nước rồi rủ ra. */
export function nipa(r: () => number, h = 6): THREE.Group {
  const g = new THREE.Group(), n = 6 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + r() * 0.5, tilt = 0.18 + r() * 0.42, hh = h * (0.7 + r() * 0.5);
    const f = grp(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3, -a); f.rotation.z = -tilt;
    f.add(box(0x6f8a3a, 0, hh / 2, 0, 0.1, hh, 0.1), bead([0x2f7d3a, 0x3f9548, 0x57a84a][i % 3], 0, hh * 0.62, 0, 0.16, hh * 0.44, 0.8));
    g.add(f);
  }
  g.add(bead(0x4a3a26, 0, 0.1, 0, 0.9, 0.35, 0.9)); return g;
}
/** Cây phi lao: thân mảnh, tán thưa hình tháp. */
export function casuarina(r: () => number, h = 8): THREE.Group {
  const g = new THREE.Group(); g.add(cyl(0x6b5a48, 0, h * 0.3, 0, 0.14, h * 0.6));
  for (let i = 0; i < 4; i++) g.add(cone([0x3f6f52, 0x4f8262][i % 2], (r() - 0.5) * 0.4, h * (0.42 + i * 0.16), (r() - 0.5) * 0.4, 1.5 - i * 0.28, h * 0.3));
  return g;
}
/** Cột cờ có lá cờ đỏ sao vàng (cờ là vật riêng để phất). */
export function flagPole(h: number, flagW = 2.4): { pole: THREE.Group; flag: THREE.Group } {
  const pole = grp(0, 0, 0, 0, cyl(0xd8d8d8, 0, h / 2, 0, 0.09 * Math.max(1, h / 8), h), ball(0xffd23f, 0, h + 0.1, 0, 0.16 * Math.max(1, h / 8)));
  const flag = grp(0, h - flagW * 0.36, 0, 0, box(0xd61f26, flagW / 2 + 0.1, 0, 0, flagW, flagW * 0.66, 0.05));
  const star = new THREE.Mesh(new THREE.CircleGeometry(flagW * 0.17, 5), new THREE.MeshBasicMaterial({ color: 0xffe14a, side: THREE.DoubleSide })); star.position.set(flagW / 2 + 0.1, 0, 0.04); star.rotation.z = Math.PI / 10;
  const star2 = star.clone(); star2.position.z = -0.04; flag.add(star, star2);
  return { pole, flag };
}
/** Cờ phất nhẹ theo gió. */
export function wave(kit: Kit, flag: THREE.Object3D, speed = 2.2): void { kit.onTick((t) => { flag.rotation.y = Math.sin(t * speed) * 0.28 - 0.2; flag.scale.x = 0.94 + Math.sin(t * speed * 1.7) * 0.06; }); }
/** Ghe gỗ đánh cá sơn màu, có mắt thuyền và ca-bin nhỏ. */
export function fishingBoat(hull: number, trim: number, len = 9): THREE.Group {
  const g = new THREE.Group();
  g.add(ball(hull, 0, 0.35, 0, 1.5, 0.9, len / 2), box(trim, 0, 0.95, 0, 2.5, 0.14, len * 0.74), box(0xf4f1ea, 0, 1.6, len * 0.16, 1.9, 1.3, len * 0.26), box(trim, 0, 2.3, len * 0.16, 2.2, 0.12, len * 0.3), cyl(0x5a4330, 0, 2.4, -len * 0.12, 0.06, 3), box(0xd61f26, 0.4, 3.6, -len * 0.12, 0.8, 0.5, 0.04));
  for (const s of [-1, 1]) g.add(ball(0xffffff, s * 1.05, 0.9, -len * 0.4, 0.2, 0.2, 0.3), ball(0x111111, s * 1.16, 0.9, -len * 0.4, 0.1, 0.1, 0.14));
  return g;
}
/** Sườn núi/đường đèo: tấm dốc dày bám theo một đoạn lối đi. */
export function slab(c: number, a: THREE.Vector3, b: THREE.Vector3, width: number, thick: number, lift = 0): THREE.Mesh { return strip(c, a, b, width, thick, lift); }
/** Mây thấp: vài khối cầu dẹt trắng. */
export function cloud(x: number, y: number, z: number, s: number): THREE.Group { const w = glow(0xffffff), w2 = glow(0xeef4f8); return grp(x, y, z, 0, ball(w, 0, 0, 0, s * 2.2, s * 0.7, s * 1.3), ball(w2, s * 1.6, s * 0.2, s * 0.3, s * 1.5, s * 0.6, s), ball(w2, -s * 1.5, -s * 0.1, -s * 0.2, s * 1.4, s * 0.5, s * 0.9)); }
/** Con cò trắng đứng. */
export function egret(): THREE.Group { return grp(0, 0, 0, 0, cyl(0x3a3a3a, -0.08, 0.35, 0, 0.02, 0.7), cyl(0x3a3a3a, 0.08, 0.35, 0, 0.02, 0.7), ball(0xffffff, 0, 0.9, 0, 0.2, 0.26, 0.42), cyl(0xffffff, 0, 1.3, -0.3, 0.05, 0.6), ball(0xffffff, 0, 1.62, -0.34, 0.1), cone(0xf2b020, 0, 1.6, -0.56, 0.035, 0.3).rotateX(-Math.PI / 2)); }
/** Dù bãi biển và hai ghế nằm. */
export function umbrella(c: number, c2 = 0xffffff): THREE.Group {
  const g = grp(0, 0, 0, 0, cyl(0xe8e4d8, 0, 1.3, 0, 0.05, 2.6), cone(c, 0, 2.6, 0, 1.9, 0.7), cone(c2, 0, 2.86, 0, 0.9, 0.36));
  for (const s of [-1, 1]) g.add(box(0xf4f1ea, s * 0.9, 0.34, 0.5, 0.7, 0.1, 1.9), box(c, s * 0.9, 0.42, 0.5, 0.6, 0.06, 1.7), box(0xf4f1ea, s * 0.9, 0.6, -0.5, 0.7, 0.1, 0.7).rotateX(0.7));
  return g;
}
/** Toà khách sạn cao tầng có dải cửa kính. */
export function tower(c: number, w: number, h: number, d: number, glass = 0x8fc4e8): THREE.Group {
  const g = grp(0, 0, 0, 0, box(c, 0, h / 2, 0, w, h, d), box(0xe8e4d8, 0, h + 0.4, 0, w * 0.6, 0.8, d * 0.6));
  for (let y = 3; y < h - 1.5; y += 3.2) g.add(box(glass, 0, y, 0, w + 0.12, 1.5, d + 0.12));
  return g;
}
/** Người ngồi xổm/đứng làm việc: người thường kèm vật trên tay. */
export function worker(i: number, shirt: number, hat = 1): THREE.Group { return person(i, hat, shirt); }
/** Tấm tranh vẽ bằng canvas (bích hoạ): trả về chất liệu dùng lại được. */
export function painted(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.MeshBasicMaterial {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!; draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return new THREE.MeshBasicMaterial({ map: t });
}
const PLANE = new THREE.PlaneGeometry(1, 1);
/** Mặt phẳng dán tranh, mặt hướng +z khi ry = 0. */
export function panel(m: THREE.Material, x: number, y: number, z: number, w: number, h: number, ry = 0): THREE.Mesh { const o = new THREE.Mesh(PLANE, m); o.position.set(x, y, z); o.scale.set(w, h, 1); o.rotation.y = ry; return o; }
/** Chùm vật nhỏ rải ngẫu nhiên trong hình chữ nhật. */
export function scatter(kit: Kit, n: number, x0: number, z0: number, w: number, d: number, make: (i: number) => THREE.Object3D, y = 0): void {
  for (let i = 0; i < n; i++) { const o = make(i); o.position.set(x0 + kit.r() * w, y + o.position.y, z0 + kit.r() * d); kit.add(o); }
}
/** Sọt/rổ tre đựng hàng. */
export function basket(fill: number, s = 1): THREE.Group { return grp(0, 0, 0, 0, cyl(0xc9a36a, 0, 0.22 * s, 0, 0.45 * s, 0.44 * s), cyl(fill, 0, 0.45 * s, 0, 0.4 * s, 0.06 * s)); }
/** Chim bồ câu trắng. */
export function pigeon(c = 0xffffff): THREE.Group { return grp(0, 0, 0, 0, ball(c, 0, 0.16, 0, 0.12, 0.12, 0.2), bead(c, 0, 0.3, -0.14, 0.08), cone(0xf2a020, 0, 0.3, -0.24, 0.02, 0.07).rotateX(-Math.PI / 2)); }
export { V, bead, cone };
/** Gộp một nhóm động thành ít lần vẽ nhưng vẫn giữ vị trí để di chuyển cả nhóm. */
export function baked(g: THREE.Group): THREE.Object3D { const p = g.position.clone(), ry = g.rotation.y; g.position.set(0, 0, 0); g.rotation.y = 0; const b = bake(g); b.position.copy(p); b.rotation.y = ry; return b; }

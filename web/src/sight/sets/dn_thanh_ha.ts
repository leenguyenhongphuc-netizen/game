// Làng gốm Thanh Hà. Trục x: tây → đông; trục z: bắc → nam. Sông Thu Bồn ở phía NAM làng.
// Vào cổng làng phía tây, đi dọc ngõ gạch: sân bàn xoay → sân phơi gốm → lò nung → quầy con thổi → công viên đất nung ở cuối ngõ phía đông.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, boat, box, cone, cyl, gable, grp, label, palm, person, signPost, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { baked, basket } from './_extra.ts';
import type { Spots } from './_extra.ts';

const LANE = 0xe6d3a6, BRICK = 0xb8553a, BRICK2 = 0x9c4630, TILE = 0x8f4a36, RAW = 0xa89078, FIRED = 0xd0623c, RIVER = 0x3f8fae, GRASS = 0x7dbb5e;
/** Đồ gốm: 0 bình cao, 1 chum bụng, 2 chậu, 3 lọ nhỏ, 4 ấm. */
function pot(kind: number, c: number, s = 1): THREE.Group {
  const g = new THREE.Group();
  if (kind === 0) g.add(ball(c, 0, 0.5 * s, 0, 0.36 * s, 0.5 * s, 0.36 * s), cyl(c, 0, 1.05 * s, 0, 0.16 * s, 0.4 * s), cyl(c, 0, 1.26 * s, 0, 0.22 * s, 0.06 * s));
  else if (kind === 1) g.add(ball(c, 0, 0.5 * s, 0, 0.56 * s, 0.52 * s, 0.56 * s), cyl(c, 0, 0.98 * s, 0, 0.34 * s, 0.12 * s), cyl(0x3a2a20, 0, 1.04 * s, 0, 0.28 * s, 0.02 * s));
  else if (kind === 2) g.add(cone(c, 0, 0.25 * s, 0, 0.5 * s, 0.5 * s).rotateX(Math.PI), cyl(c, 0, 0.5 * s, 0, 0.52 * s, 0.06 * s));
  else if (kind === 3) g.add(ball(c, 0, 0.22 * s, 0, 0.2 * s, 0.22 * s, 0.2 * s), cyl(c, 0, 0.46 * s, 0, 0.09 * s, 0.14 * s));
  else g.add(ball(c, 0, 0.24 * s, 0, 0.26 * s, 0.24 * s, 0.26 * s), cyl(c, 0.3 * s, 0.3 * s, 0, 0.04 * s, 0.3 * s).rotateZ(-0.9), bead(c, 0, 0.5 * s, 0, 0.07 * s));
  return g;
}
export function thanhHa(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  kit.ground(GRASS);
  // sông Thu Bồn phía nam: bờ kè đá, ghe chở gốm, bãi bồi lấy đất sét
  kit.add(box(0x2f7896, 0, -1.6, 190, 900, 1, 300)); kit.water(RIVER, 0, 192, 900, 300, -0.5, 0.9);
  kit.add(box(0x9a958a, 0, -0.3, 41, 900, 1, 2.4), box(0xc9a877, -60, -0.42, 47, 70, 0.3, 12), box(GRASS, 0, -0.5, 420, 900, 1.2, 160));
  for (let i = 0; i < 5; i++) { const b = boat([0x6a5038, 0x2a5f8a][i % 2], 9); b.scale.setScalar(1.3); b.position.set(-90 + i * 46 + r() * 10, -0.5, 52 + r() * 30); b.rotation.y = 1.4 + r() * 0.4; for (let k = 0; k < 5; k++) { const p = pot(k % 3, FIRED, 0.8); p.position.set((r() - 0.5) * 0.7, 0.5, -2.4 + k * 1.2); b.add(p); } kit.add(b); }
  for (let i = 0; i < 6; i++) kit.add(ball(0x9a7c5a, -84 + i * 9 + r() * 3, -0.2, 46 + r() * 4, 1.6, 0.7, 1.4));
  const digger = person(5, 1, 0x6f8a9a); digger.position.set(-64, -0.2, 46); kit.add(digger, box(0x7a5a3c, -63.4, 0.7, 46, 0.06, 1.6, 0.06), basket(0x9a7c5a).translateX(-66).translateZ(45).translateY(-0.2));
  for (let i = 0; i < 18; i++) { const t = r() < 0.5 ? palm(r, 6 + r() * 2) : tree(r, 1 + r(), false); t.position.set(-150 + i * 18 + r() * 8, 0, 36 + r() * 3); kit.add(t); }
  // ---- ngõ làng lát gạch nung, hai bên tường gạch thấp và nhà mái ngói
  kit.add(box(LANE, 0, 0.02, 0, 240, 0.08, 6.4), box(0xd08a62, 0, 0.05, 0, 240, 0.06, 2.4));
  for (let x = -118; x < 118; x += 1.6) kit.add(box(0xc37850, x, 0.085, (Math.round(x * 10) % 3 - 1) * 0.6, 0.06, 0.02, 2.4));
  const wall = (x0: number, x1: number, z: number) => { kit.add(box(BRICK, (x0 + x1) / 2, 0.6, z, x1 - x0, 1.2, 0.5), box(BRICK2, (x0 + x1) / 2, 1.26, z, x1 - x0 + 0.2, 0.14, 0.7)); for (let x = x0 + 1; x < x1; x += 2.6) { const p = pot(Math.floor(r() * 5), r() < 0.7 ? FIRED : 0xb86a48, 0.6 + r() * 0.3); p.position.set(x, 1.33, z); kit.add(p); } };
  const house = (x: number, z: number, face: number, w = 9) => { const c = [0xf1dfb0, 0xe9c9a0, 0xf4e6c8][Math.floor(r() * 3)], g = grp(x, 0, z, face > 0 ? 0 : Math.PI); g.add(box(c, 0, 1.7, 0, w, 3.4, 6.4), box(BRICK, 0, 0.5, 3.24, w, 1.0, 0.1), gable(TILE, 0, 3.4, 0, 7.6, 1.9, w + 1, Math.PI / 2), box(0x4a2c1c, -w / 4, 1.3, 3.24, 1.5, 2.6, 0.1), box(0x5a7a6a, w / 4, 2, 3.24, 1.6, 1.3, 0.1), box(TILE, 0, 2.9, 4.4, w, 0.12, 2.4), cyl(0x7a5a3c, -w / 2 + 0.4, 1.45, 5.4, 0.1, 2.9), cyl(0x7a5a3c, w / 2 - 0.4, 1.45, 5.4, 0.1, 2.9)); kit.add(g); };
  wall(-112, -84, -3.6); wall(-112, -80, 3.6); wall(-58, -46, 3.6); wall(-22, 4, 3.6); wall(26, 44, 3.6); wall(52, 70, -3.6); wall(-8, 12, -3.6);
  for (const [x, z, f] of [[-104, -11, 1], [-92, 11, -1], [-78, 11, -1], [-60, -24, 1], [-24, 12, -1], [-10, 12, -1], [6, -13, 1], [36, 12, -1], [50, 12, -1], [60, -12, 1], [70, 12, -1]] as const) house(x, z, f);
  for (let i = 0; i < 16; i++) { const t = r() < 0.4 ? palm(r, 6 + r() * 3) : tree(r, 1.1 + r() * 0.8, r() < 0.4); t.position.set(-116 + r() * 232, 0, (r() < 0.5 ? -1 : 1) * (18 + r() * 12)); if (t.position.z > 0 && t.position.z < 34) t.position.z = 22 + r() * 8; kit.add(t); }
  for (let i = 0; i < 8; i++) kit.add(ball([0xf29bc0, 0xe2573c, 0xffd23f][i % 3], -110 + i * 30 + r() * 6, 1.9, (i % 2 ? -1 : 1) * 3.9, 1.1, 0.6, 0.6)); // giàn hoa giấy trên tường
  // ---- cổng làng: hai trụ gạch, mái ngói, bảng tên, chum lớn hai bên
  kit.add(box(BRICK, -116, 2.6, -3.6, 1.6, 5.2, 1.6), box(BRICK, -116, 2.6, 3.6, 1.6, 5.2, 1.6), box(BRICK2, -116, 5.5, 0, 2, 0.8, 9.6), gable(TILE, -116, 5.9, 0, 3.4, 1.3, 11, 0));
  for (const s of [-1, 1]) { const p = pot(1, FIRED, 2.2); p.position.set(-113.6, 0, s * 5.4); kit.add(p); const q = pot(0, 0xb86a48, 1.6); q.position.set(-113, 0, s * 7.4); kit.add(q); }
  kit.live(label('Làng gốm Thanh Hà', -116, 9, 0, '#9c4630', 1.2));
  // ---- sân bàn xoay: mái lá trên cột tre, người đạp bàn xoay và người chuốt đất, đống đất sét
  const WX = -68, WZ = -9;
  kit.add(box(0xcdb891, WX, 0.03, WZ - 3, 22, 0.06, 14), gable(0xb59a5a, WX, 3.3, WZ - 5, 9, 1.6, 20, Math.PI / 2)); for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) kit.add(cyl(0xb89a5a, WX + sx * 9, 1.65, WZ - 5 + sz * 3.6, 0.12, 3.3));
  const wheel = (x: number, z: number, i: number) => {
    kit.add(cyl(0x6a5038, x, 0.25, z, 0.16, 0.5), box(0x7a5a3c, x + 1.6, 0.45, z, 0.7, 0.16, 0.5));
    const disc = baked(grp(x, 0.55, z, 0, cyl(0x8a6a48, 0, 0, 0, 0.75, 0.1), ball(RAW, 0, 0.45, 0, 0.34, 0.42, 0.34), cyl(RAW, 0, 0.86, 0, 0.3, 0.1), cyl(0x6f5a48, 0, 0.9, 0, 0.24, 0.04))); kit.live(disc); kit.onTick((t) => { disc.rotation.y = t * 3; });
    const shaper = person(i, 1, [0x9b7fd6, 0x6f8a9a][i % 2]); shaper.position.set(x + 1.2, -0.5, z); shaper.rotation.y = -1.57; shaper.rotation.x = 0; kit.add(shaper);
    const kicker = person(i + 1, 1, [0x4aa3d8, 0xc98a5a][i % 2]); kicker.position.set(x - 0.2, 0, z - 1.2); kicker.rotation.y = Math.PI; kit.add(kicker, box(0x7a5a3c, x, 2.5, z - 0.9, 1.6, 0.08, 0.08), cyl(0x7a5a3c, x - 0.75, 1.25, z - 0.9, 0.05, 2.5), cyl(0x7a5a3c, x + 0.75, 1.25, z - 0.9, 0.05, 2.5));
  };
  wheel(WX - 3, WZ - 2.4, 2); wheel(WX + 4.4, WZ - 2.8, 5);
  kit.add(ball(0x9a7c5a, WX - 8, 0.5, WZ - 6, 1.8, 0.9, 1.4), ball(0x8a6c4a, WX - 6.4, 0.3, WZ - 7.4, 1, 0.5, 1), cyl(0x4a6a7a, WX + 8.6, 0.4, WZ - 6.4, 0.6, 0.8), cyl(0x9fd0e0, WX + 8.6, 0.8, WZ - 6.4, 0.52, 0.04));
  for (let i = 0; i < 10; i++) { const p = pot(i % 4, RAW, 0.7); p.position.set(WX - 4 + i * 0.9, 0.82, WZ - 8.4); kit.add(p); } kit.add(box(0x8a6a48, WX, 0.78, WZ - 8.4, 10, 0.08, 0.8), box(0x8a6a48, WX - 4.6, 0.39, WZ - 8.4, 0.2, 0.78, 0.7), box(0x8a6a48, WX + 4.6, 0.39, WZ - 8.4, 0.2, 0.78, 0.7));
  kit.live(label('Sân bàn xoay', WX, 6.6, WZ - 4, '#8a6a48', 0.8));
  // ---- sân phơi gốm: dãy ván dài xếp kín gốm mộc màu đất xám, chưa nung
  const DX = -36, DZ = -12;
  kit.add(box(0xd9c8a0, DX, 0.03, DZ, 26, 0.06, 18));
  for (let row = 0; row < 6; row++) { kit.add(box(0x9a7c5a, DX, 0.36, DZ - 7 + row * 2.6, 22, 0.08, 1.1), box(0x7a5a3c, DX - 10, 0.18, DZ - 7 + row * 2.6, 0.3, 0.36, 1), box(0x7a5a3c, DX + 10, 0.18, DZ - 7 + row * 2.6, 0.3, 0.36, 1), box(0x7a5a3c, DX, 0.18, DZ - 7 + row * 2.6, 0.3, 0.36, 1)); for (let i = 0; i < 20; i++) { const p = pot((row + (i % 2)) % 5, [RAW, 0xb39a80, 0x9a8470][(i + row) % 3], 0.62); p.position.set(DX - 10.2 + i * 1.08, 0.4, DZ - 7 + row * 2.6); kit.add(p); } }
  const carrier = person(7, 1, 0xc98a5a); carrier.position.set(DX + 13.6, 0, DZ + 2); carrier.rotation.y = 1.57; kit.add(carrier, box(0x9a7c5a, DX + 13.6, 1.3, DZ + 1.3, 2.4, 0.06, 0.5)); for (let i = 0; i < 4; i++) { const p = pot(3, RAW, 0.6); p.position.set(DX + 12.7 + i * 0.6, 1.33, DZ + 1.3); kit.add(p); }
  kit.live(label('Sân phơi gốm mộc', DX, 4.6, DZ, '#8a7a5a', 0.8));
  // ---- lò nung: lò gạch vòm cuốn nằm ngang, ống khói, cửa lò rực lửa, đống củi, gốm chín đỏ xếp chồng
  const KX = 18, KZ = -14;
  const kiln = grp(KX, 0, KZ); kiln.add(box(BRICK, 0, 1.5, 0, 9, 3, 14), cyl(BRICK, 0, 3, 0, 4.5, 14, 2.6).rotateX(Math.PI / 2), box(BRICK2, 0, 2.2, 7.1, 9.6, 4.6, 0.6), cyl(0x1f1410, 0, 1.3, 7.42, 1.1, 0.1, 1.5).rotateX(Math.PI / 2), box(BRICK2, 0, 4.4, -6, 2, 5.6, 2), box(0x6a3324, 0, 7.3, -6, 2.4, 0.4, 2.4));
  for (let i = 0; i < 26; i++) kiln.add(box(r() < 0.5 ? 0x8a3f2c : 0xc96a4a, -4.52, 0.4 + r() * 2.4, -6.4 + r() * 12.8, 0.06, 0.34, 0.9), box(r() < 0.5 ? 0x8a3f2c : 0xc96a4a, -4 + r() * 8, 0.6 + r() * 3.6, 7.42, 0.9, 0.34, 0.06));
  kit.add(kiln);
  const fire = new THREE.Mesh(new THREE.CircleGeometry(0.95, 14), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); fire.position.set(KX, 1.25, KZ + 7.5); fire.scale.y = 1.3; kit.live(fire); kit.onTick((t) => { (fire.material as THREE.MeshBasicMaterial).color.setHSL(0.06 + Math.sin(t * 9) * 0.02, 1, 0.52 + Math.sin(t * 13) * 0.08); });
  kit.motes(26, 0xd8d0c8, 2.6, () => V(KX + (r() - 0.5), 7.6 + r() * 14, KZ - 6 + (r() - 0.5)), (p, i, _t, dt) => { p.y += dt * (1.2 + (i % 5) * 0.2); p.x += dt * 0.5; if (p.y > 24) { p.y = 7.6; p.x = KX; } });
  for (let i = 0; i < 30; i++) kit.add(cyl(0x8a6a48, KX + 7 + (i % 6) * 0.5, 0.2 + Math.floor(i / 6) * 0.36, KZ + 3, 0.17, 2.2).rotateX(Math.PI / 2));
  for (let i = 0; i < 26; i++) { const p = pot(i % 3, [FIRED, 0xc0563a, 0xdc7448, 0x8a4a34][i % 4], 0.9 + r() * 0.5); p.position.set(KX - 14 + (i % 13) * 0.8, 0, KZ + 7.4 + Math.floor(i / 13) * 1.2); kit.add(p); }
  const stoker = person(9, 1, 0x6f8a9a); stoker.position.set(KX + 1.8, 0, KZ + 9.4); stoker.rotation.y = Math.PI; kit.add(stoker);
  kit.live(label('Lò nung', KX, 9.6, KZ + 4, '#9c4630', 0.9));
  // ---- quầy con thổi 12 con giáp: sạp gỗ bày tò he đất nhiều màu, trẻ con đứng thổi
  const TX = 46, TZ = -8;
  kit.add(box(0x8a6a48, TX, 0.5, TZ, 7, 1, 2.2), box(0x9a7c5a, TX, 1.3, TZ - 0.5, 7, 0.08, 1), box(0x9a7c5a, TX, 1.9, TZ - 0.8, 7, 0.08, 0.6), box(0xd2301e, TX, 3.2, TZ + 0.4, 8, 0.1, 3.6), cyl(0x7a5a3c, TX - 3.6, 1.6, TZ + 1.8, 0.07, 3.2), cyl(0x7a5a3c, TX + 3.6, 1.6, TZ + 1.8, 0.07, 3.2));
  const AN = [0xd0623c, 0xffd23f, 0x4aa3d8, 0x7ccf4f, 0xf29bc0, 0x9b7fd6];
  for (let i = 0; i < 36; i++) { const c = i % 3 === 0 ? FIRED : AN[i % 6], y = [1.04, 1.38, 1.98][i % 3], z = [TZ + 0.5, TZ - 0.5, TZ - 0.8][i % 3], x = TX - 3.2 + Math.floor(i / 3) * 0.56; kit.add(ball(c, x, y + 0.12, z, 0.15, 0.12, 0.2), bead(c, x, y + 0.3, z + 0.14, 0.1), cone(c, x - 0.06, y + 0.42, z + 0.14, 0.03, 0.1), cone(c, x + 0.06, y + 0.42, z + 0.14, 0.03, 0.1)); }
  const seller = person(11, 1, 0x9b7fd6); seller.position.set(TX, 0, TZ - 2); kit.add(seller);
  for (let i = 0; i < 3; i++) { const k = person(i + 2, i === 1 ? 2 : 0, AN[i + 1]); k.scale.setScalar(0.68); k.position.set(TX - 1.6 + i * 1.5, 0, TZ + 2.6); k.rotation.y = Math.PI; kit.add(k, bead(FIRED, TX - 1.6 + i * 1.5, 1.05, TZ + 2.34, 0.09)); }
  kit.live(label('Con thổi 12 con giáp', TX, 5.2, TZ, '#d2301e', 0.8));
  // ---- công viên đất nung: hai khối nhà hình lò gốm bằng gạch đỏ (một úp, một ngửa), sân trưng bày mô hình thu nhỏ
  const PX = 96, PZ = -6;
  kit.add(box(0xd9c8a0, PX, 0.03, PZ, 46, 0.06, 44));
  kit.add(cyl(BRICK, PX + 6, 5, PZ - 12, 9, 10), cone(BRICK2, PX + 6, 13, PZ - 12, 9, 6), cyl(0x6a3324, PX + 6, 16.4, PZ - 12, 1.6, 1.6), cyl(0x241a14, PX + 6, 2, PZ - 3.2, 1.6, 0.4, 2.4).rotateX(Math.PI / 2));
  const up = cone(BRICK, PX + 15, 6, PZ + 10, 8.4, 12).rotateX(Math.PI); kit.add(up, cyl(BRICK2, PX + 15, 12.2, PZ + 10, 8.6, 0.5), cyl(0xbfe6ff, PX + 15, 12.3, PZ + 10, 7.6, 0.36));
  for (let i = 0; i < 40; i++) { const a = r() * 6.28; kit.add(box(0x8a3f2c, PX + 6 + Math.cos(a) * 9.04, 0.6 + r() * 8.6, PZ - 12 + Math.sin(a) * 9.04, 1.1, 0.36, 0.2, -a + Math.PI / 2)); }
  // mô hình thu nhỏ bằng đất nung: kim tự tháp, tháp nghiêng, tháp Chăm, Chùa Cầu, nhà hát con sò
  const TC = 0xc9653f;
  kit.add(cone(TC, PX - 12, 1.6, PZ + 6, 2.4, 3.2), box(0x9a958a, PX - 12, 0.1, PZ + 6, 5.4, 0.2, 5.4));
  kit.add(grp(PX - 4, 0, PZ + 12, 0, box(0x9a958a, 0, 0.1, 0, 4, 0.2, 4), ...[0, 1, 2, 3, 4].map((i) => cyl(TC, i * 0.09, 0.5 + i * 0.7, 0, 0.8, 0.66)), cone(TC, 0.45, 4.2, 0, 0.6, 0.7)));
  kit.add(grp(PX - 14, 0, PZ - 6, 0, box(0x9a958a, 0, 0.1, 0, 5, 0.2, 5), box(TC, 0, 1.3, 0, 2, 2.4, 2), box(TC, 0, 2.9, 0, 1.5, 0.9, 1.5), box(TC, 0, 3.7, 0, 1, 0.8, 1), cone(TC, 0, 4.5, 0, 0.5, 0.9), box(0x3a2a20, 0, 1, 1.02, 0.6, 1.4, 0.06)));
  kit.add(grp(PX - 3, 0, PZ + 2, 0.4, box(0x9a958a, 0, 0.1, 0, 5.4, 0.2, 3), box(TC, 0, 0.7, 0, 4.4, 0.5, 1.2), gable(0x8a3f2c, 0, 1.6, 0, 1.6, 0.6, 4.8, Math.PI / 2), ...[-1.6, -0.8, 0, 0.8, 1.6].map((x) => box(TC, x, 1.2, 0.5, 0.12, 0.9, 0.12))));
  kit.add(grp(PX - 10, 0, PZ + 16, 0, box(0x9a958a, 0, 0.1, 0, 5, 0.2, 4), ...[0, 1, 2].map((i) => ball(0xe8d8c0, -1.2 + i * 1.1, 0.9, 0, 0.9 - i * 0.1, 1.2 - i * 0.2, 0.4).rotateZ(0.5))));
  for (let i = 0; i < 6; i++) { const p = pot(i % 2, [FIRED, 0xb86a48][i % 2], 1.8 + r()); p.position.set(PX - 20 + i * 2.6, 0, PZ + 21); kit.add(p); }
  const tour = [person(3, 2), person(6, 0), person(8, 1)]; tour.forEach((p, i) => { p.position.set(PX - 8 + i * 1.6, 0, PZ + 9 - i); p.rotation.y = 2 + i; kit.add(p); });
  kit.live(label('Công viên đất nung', PX + 8, 20.4, PZ - 6, '#9c4630', 1.3), signPost('Sông Thu Bồn →', -40, 0, 5.4, '#2f7896', 0.9));
  void THREE;

  const path = [V(-128, 0, 0), V(-112, 0, 0), V(-84, 0, 0), V(-72, 0, -2.4), V(-66, 0, -5.6), V(-56, 0, -3), V(-46, 0, 0), V(-38, 0, -2.2), V(-22, 0, -3), V(-8, 0, 0), V(8, 0, 0), V(16, 0, -2.6), V(21, 0, -2.2), V(30, 0, 0), V(42, 0, -2), V(46, 0, -4.4), V(56, 0, 0), V(72, 0, 0), V(84, 0, 2), V(88, 0, 8)];
  return {
    path, half: 2.3, npcs: 9,
    stops: [
      { id: 'cong_lang', at: V(-124, 0, 0), look: V(-116, 4.6, 0) },
      { id: 'ban_xoay', at: V(-66.4, 0, -5.4), look: V(WX + 1, 1, WZ - 3.4) },
      { id: 'san_phoi', at: V(-37, 0, -2.6), look: V(DX, 0.6, DZ) },
      { id: 'lo_nung', at: V(18.6, 0, -2.6), look: V(KX, 2.6, KZ + 6) },
      { id: 'con_thoi', at: V(46, 0, -4.2), look: V(TX, 1.5, TZ) },
      { id: 'cong_vien', at: V(88, 0, 8), look: V(PX + 9, 7, PZ - 4) },
    ],
    sky: [0x5fb0ee, 0xf3ecd8], fog: [0xf0e6d0, 110, 700],
    light: { ambient: 1.6, sun: 1.8, sunColor: 0xfff0d0, sunDir: [-0.5, 0.9, 0.5] },
    shopSpots: [V(-96, 0, -4.6), V(-2, 0, 4.4), V(64, 0, 4.4)],
  };
}

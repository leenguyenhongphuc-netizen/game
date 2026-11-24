// Trung tâm Sài Gòn. Trục x: tây → đông; trục z: bắc → nam (gần đúng theo bản đồ: nhà thờ ở bắc quảng trường Công xã Paris,
// bưu điện ở phía đông quảng trường, đường sách chạy dọc hông bưu điện, đại lộ Lê Duẩn phía sau dẫn tây tới Dinh Độc Lập,
// chợ Bến Thành ở phía nam dinh).
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bench, box, cone, cyl, flag, gable, grp, label, lampPost, person, stall, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { bigTree, brickChurch, land, railing } from './nb__kit.ts';

const ROAD = 0x5a5e63, WALK = 0xd8cdb8, LAWN = 0x6fb04f, CREAM = 0xf1dca0, WHITE = 0xf2f0ea;

export function hcmTrungTam(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  land(kit, -300, -300, 300, 300, LAWN, 0, false);
  // đường nhựa và vỉa hè
  kit.add(box(ROAD, 0, 0.01, 2, 300, 0.02, 10), box(ROAD, 62, 0.01, -60, 8, 0.02, 140), box(ROAD, -60, 0.01, -82, 260, 0.02, 12), box(ROAD, -110, 0.01, -10, 10, 0.02, 160));
  for (const z of [-4.5, 8.5]) kit.add(box(WALK, 0, 0.06, z, 300, 0.12, 3));
  kit.add(box(WALK, -60, 0.06, -74, 260, 0.12, 4), box(WALK, -60, 0.06, -90, 260, 0.12, 4), box(WALK, 56, 0.06, -60, 4, 0.12, 140), box(WALK, -104, 0.06, -10, 4, 0.12, 160));
  for (let x = -140; x < 140; x += 6) kit.add(box(0xffffff, x, 0.03, 2, 2.6, 0.01, 0.18));
  // ---- quảng trường + Nhà thờ Đức Bà (gạch đỏ, hai tháp chuông) và tượng Đức Mẹ Hoà Bình
  kit.add(box(0xcfc4ae, 0, 0.04, -14, 40, 0.08, 24));
  const church = brickChurch(0.8); church.position.set(0, 0, -44); kit.add(church);
  kit.add(cyl(0xd9d2c4, 0, 0.6, -14, 3.2, 1.2), cyl(0xd9d2c4, 0, 2.2, -14, 0.9, 2.4), ball(WHITE, 0, 4.1, -14, 0.55, 1.4, 0.5), ball(WHITE, 0, 5.6, -14, 0.38));
  for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; kit.add(ball(0x5f9a4a, Math.cos(a) * 5, 0.5, -14 + Math.sin(a) * 5, 0.8, 0.5, 0.8)); }
  kit.live(label('Nhà thờ Đức Bà', 0, 46, -32, '#9a4430', 1.4));
  // ---- Bưu điện Trung tâm: mặt tiền vàng kem, cửa vòm, mái ngói xám, đồng hồ trên trán hồi giữa
  const PX = 48, PZ = -26;
  const po = grp(PX, 0, PZ);
  po.add(box(CREAM, 0, 6, 0, 44, 12, 16), gable(0x6a6a6a, 0, 12, 0, 16.6, 3.4, 44.6), box(CREAM, 0, 8, 8.4, 12, 16, 1.2), gable(CREAM, 0, 16, 8.4, 12, 3.2, 1.2, Math.PI / 2));
  po.add(cyl(0xffffff, 0, 13.6, 9.1, 1.5, 0.12).rotateX(Math.PI / 2), cyl(0x2a2a2a, 0, 13.6, 9.18, 1.3, 0.04).rotateX(Math.PI / 2), box(0x2a2a2a, 0.3, 13.9, 9.22, 0.08, 0.8, 0.02));
  for (let i = 0; i < 11; i++) { const x = -20 + i * 4; if (Math.abs(x) < 6) continue; po.add(box(0x3e5a4a, x, 3.2, 8.06, 1.8, 4, 0.1), ball(0x3e5a4a, x, 5.2, 8.06, 0.9, 0.9, 0.05), box(0x3e5a4a, x, 9, 8.06, 1.4, 2.4, 0.1), box(0xffffff, x, 7.1, 8.08, 3.2, 0.3, 0.06)); }
  po.add(box(0x3e5a4a, 0, 4, 9.06, 4, 6, 0.1), ball(0x3e5a4a, 0, 7, 9.06, 2, 1.6, 0.05));
  for (let i = 0; i < 6; i++) po.add(cyl(0xffffff, -5 + i * 2, 6, 9.2, 0.25, 10));
  kit.add(po); kit.live(label('Bưu điện Trung tâm', PX, 20, PZ + 8, '#3e5a4a', 1.2));
  // ---- Đường sách Nguyễn Văn Bình: hàng me cổ thụ, sạp sách, ghế đá
  const SX = 62;
  for (let i = 0; i < 7; i++) { const t = bigTree(r, 13); t.scale.setScalar(0.6); t.position.set(SX + (i % 2 ? 7.5 : -7.5), 0, -44 - i * 6); kit.add(t); }
  for (let i = 0; i < 6; i++) { const st = stall([0x2f6f8f, 0xc94a3a, 0x3f8a5a][i % 3], r); st.position.set(SX + (i % 2 ? 3.6 : -3.6), 0.12, -42 - i * 7); st.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2; kit.add(st); for (let k = 0; k < 6; k++) kit.add(box([0xd23a2a, 0x2a6a9a, 0xe2b23a, 0x3f8a5a][k % 4], SX + (i % 2 ? 3.1 : -3.1), 1.1, -42 - i * 7 - 0.8 + k * 0.32, 0.5, 0.06, 0.26)); }
  for (let i = 0; i < 4; i++) { const b = bench(); b.position.set(SX + (i % 2 ? 2.6 : -2.6), 0.12, -66 - i * 4); b.rotation.y = Math.PI / 2; kit.add(b); }
  kit.live(label('Đường sách', SX, 7, -50, '#2f6f8f', 0.9));
  // ---- đại lộ Lê Duẩn: hàng cây dầu hai bên, đèn đường
  for (let x = 50; x > -150; x -= 12) { for (const z of [-71, -93]) { const t = tree(r, 1.5 + r() * 0.4, true); t.position.set(x + r() * 2, 0.12, z); kit.add(t); } kit.add(lampPost(x + 6, 0.12, -72.4, 5)); }
  // ---- Dinh Độc Lập: thân trắng, lam che nắng hình đốt tre, mái bằng có trực thăng, thảm cỏ, đài phun nước, xe tăng
  const DX = -170, DZ = -82;
  const dinh = grp(DX, 0, DZ, Math.PI / 2);
  dinh.add(box(0xe8e4da, 0, 1, 0, 70, 2, 26), box(WHITE, 0, 9, 0, 62, 14, 20), box(0xd8d4ca, 0, 16.4, 0, 66, 0.8, 24), box(WHITE, 0, 17.8, -4, 22, 2, 10));
  for (let i = 0; i < 30; i++) dinh.add(box(0xeae6dc, -29 + i * 2, 9, 10.4, 0.5, 13, 0.6), box(0xd8d4ca, -29 + i * 2, 5, 10.5, 0.6, 0.3, 0.7), box(0xd8d4ca, -29 + i * 2, 11, 10.5, 0.6, 0.3, 0.7));
  dinh.add(box(0x3a4a58, 0, 9, 10.1, 60, 12, 0.1), box(0x8a3a2a, 0, 2.3, 13.8, 20, 0.2, 4));
  dinh.add(box(0x4a6a4a, 6, 18.4, 4, 3, 1.2, 8), box(0x4a6a4a, 6, 18.6, -1, 0.3, 0.3, 6), box(0x2a2a2a, 6, 19.4, 4, 12, 0.08, 0.3)); // trực thăng
  kit.add(dinh, box(LAWN, DX + 40, 0.03, DZ, 40, 0.06, 60));
  kit.add(cyl(0xd8d2c4, DX + 28, 0.5, DZ, 9, 1), cyl(0x6ab4d8, DX + 28, 0.9, DZ, 8.4, 0.2));
  const fountain = cyl(0xbfe6ff, DX + 28, 1.6, DZ, 0.4, 2); kit.add(fountain);
  const flagP = flag(14); flagP.position.set(DX + 18, 0, DZ); kit.add(flagP);
  const tank = (x: number, z: number, n: string) => { kit.add(grp(x, 0, z, Math.PI / 2, box(0x4a5a3a, 0, 0.9, 0, 3.2, 1.2, 6.4), box(0x3a3a32, 0, 0.5, 0, 3.6, 0.9, 6.8), ball(0x4a5a3a, 0, 1.9, 0.3, 1.2, 0.6, 1.3), cyl(0x3a4a2a, 0, 2, -2.4, 0.13, 4.4).rotateX(Math.PI / 2))); kit.live(label(n, x, 4.2, z, '#4a5a3a', 0.6)); };
  tank(DX + 46, DZ - 16, 'Xe tăng 390'); tank(DX + 46, DZ + 16, 'Xe tăng 843');
  // cổng sắt và hàng rào
  railing(kit, V(DX + 64, 0, DZ - 30), V(DX + 64, 0, DZ - 4), 0x2f4a3a, 1.8); railing(kit, V(DX + 64, 0, DZ + 4), V(DX + 64, 0, DZ + 30), 0x2f4a3a, 1.8);
  kit.live(label('Dinh Độc Lập', DX, 26, DZ, '#8a3a2a', 1.4));
  // ---- Chợ Bến Thành: dãy nhà chợ thấp mái ngói, tháp đồng hồ ở cửa nam (mặt chợ quay về bắc trong cảnh này)
  const MX = -110, MZ = 92;
  const m = grp(MX, 0, MZ);
  m.add(box(CREAM, 0, 4, 10, 60, 8, 26), gable(0x8f4a36, 0, 8, 10, 27, 3.6, 61), box(CREAM, 0, 7, -4, 10, 14, 4), box(0xe8c070, 0, 15.6, -4, 6, 3, 4), gable(0x8f4a36, 0, 17.1, -4, 6.6, 2, 4.6, Math.PI / 2));
  m.add(cyl(0xffffff, 0, 12, -6.06, 1.6, 0.1).rotateX(Math.PI / 2), cyl(0x2a2a2a, 0, 12, -6.14, 1.4, 0.04).rotateX(Math.PI / 2), box(0x8f4a36, 0, 4, -6.1, 4.4, 6, 0.1), box(0xd23a2a, 0, 9.2, -6.1, 8, 1, 0.1));
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) m.add(box(0x4a6a5a, s * (8 + i * 2.6), 3, -2.9, 1.4, 3.6, 0.1));
  kit.add(m); kit.live(label('Chợ Bến Thành', MX, 22, MZ - 4, '#8f4a36', 1.3));
  // ---- xe máy, xích lô, người dạo phố
  for (let i = 0; i < 22; i++) { const p = person(i, i % 4 === 0 ? 1 : 0); const at = [V(-6 + r() * 12, 0, -20 + r() * 12), V(SX - 2 + r() * 4, 0.12, -40 - r() * 40), V(-104 + r() * 2, 0.12, -40 + r() * 100), V(30 + r() * 30, 0.12, -4)][i % 4]; p.position.copy(at); p.rotation.y = r() * 6.28; kit.add(p); }
  for (let i = 0; i < 14; i++) { const x = -130 + i * 20 + r() * 6, z = -1 + (i % 2) * 6; kit.add(grp(x, 0, z, i % 2 ? Math.PI / 2 : -Math.PI / 2, box(0x2a2a2a, 0, 0.45, 0, 0.3, 0.5, 1.6), cyl(0x1a1a1a, 0, 0.3, 0.7, 0.3, 0.12).rotateZ(Math.PI / 2), cyl(0x1a1a1a, 0, 0.3, -0.7, 0.3, 0.12).rotateZ(Math.PI / 2), box([0xd23a2a, 0x2a6a9a, 0xf2f0ea][i % 3], 0, 0.8, 0.2, 0.36, 0.4, 0.9))); }
  for (let i = 0; i < 10; i++) { const c = cone(0x2f6a3a, -100 + i * 22, 3, 22, 2.2, 6); kit.add(c, cyl(0x6a5a48, -100 + i * 22, 0.6, 22, 0.2, 1.2)); }
  void ball;

  const path = [V(0, 0, 6), V(0, 0, -8), V(14, 0, -6), V(46, 0, -8), V(SX, 0.12, -14), V(SX, 0.12, -40), V(SX, 0.12, -70), V(40, 0.12, -82), V(0, 0.12, -82), V(-60, 0.12, -82), V(-110, 0.12, -82), V(-122, 0, -82), V(-110, 0, -60), V(-110, 0, 20), V(-110, 0, 70)];
  return {
    path, half: 2.6, npcs: 4,
    stops: [
      { id: 'nha_tho', at: V(0, 0, -8), look: V(0, 20, -36), cam: V(8, 4, 14) },
      { id: 'buu_dien', at: V(46, 0, -8), look: V(PX, 9, PZ + 6), cam: V(34, 5, 6) },
      { id: 'duong_sach', at: V(SX, 0.12, -46), look: V(SX - 3.6, 1.2, -49) },
      { id: 'dinh_doc_lap', at: V(-122, 0, -82), look: V(DX + 10, 9, DZ), cam: V(-104, 6, -70) },
      { id: 'cho_ben_thanh', at: V(-110, 0, 70), look: V(MX, 10, MZ - 6), cam: V(-96, 6, 50) },
    ],
    sky: [0x6ab8ee, 0xf4ead6], fog: [0xf0e8d8, 140, 720],
    light: { ambient: 1.6, sun: 1.9, sunColor: 0xfff0d0, sunDir: [-0.4, 0.9, 0.5] },
    shopSpots: [V(10, 0.12, 9), V(SX + 3, 0.12, -76), V(-104, 0.12, 40)],
  };
}

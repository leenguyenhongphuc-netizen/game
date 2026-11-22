// Cù Lao Chàm (Hòn Lao, Bãi Làng). Trục x: tây → đông; trục z: bắc → nam. Biển và đất liền ở phía TÂY, núi đảo ở phía đông.
// Tàu cập cầu cảng Bãi Làng; vào làng gặp bảng "nói không với túi ni lông"; giếng cổ và chùa Hải Tạng nằm sâu trong xóm phía bắc;
// Bãi Chồng ở phía nam dọc bờ tây; chợ Tân Hiệp ngay cạnh cầu cảng.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, boat, box, cone, cyl, gable, glow, grp, label, mountain, palm, person, rock, signPost, stall, templeRoof, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';

const SAND = 0xf3e6b8, BRICK = 0xb4673e;
export function cuLaoCham(kit: Kit, _s: Sight): SightSet {
  const r = kit.r, shore = (z: number) => -6 + Math.sin(z * 0.03) * 7 + (z > 60 ? (z - 60) * 0.12 : 0); // mép nước theo z
  kit.add(box(0x2f8f8a, -350, -3.4, 0, 700, 1, 1200)); // đáy biển nông màu ngọc
  kit.water(0x35b6c9, -350, 0, 720, 1200, -0.3, 0.72);
  // đảo: bãi cát, dải làng, núi rừng phía đông
  for (let z = -200; z < 260; z += 8) { const sx = shore(z); kit.add(box(SAND, sx + 14, -0.7, z, 28, 1.6, 8.2), box(0xffffff, sx - 0.4, -0.22, z, 1.6, 0.06, 8.2)); }
  kit.add(box(0x86b060, 150, -0.5, 30, 290, 1.2, 520), mountain(0x3f7a4e, 330, 20, 200, 150, r), mountain(0x4a8556, 250, -230, 150, 90, r), mountain(0x4a8556, 270, 260, 160, 100, r), mountain(0x3f7a4e, 460, 60, 200, 170, r));
  // các hòn nhỏ: Hòn Dài, Hòn Mồ, Hòn Tai… và dải đất liền Hội An mờ xa phía tây
  for (const [x, z, s] of [[-170, -220, 40], [-240, -60, 26], [-120, 300, 30], [-300, 190, 22]] as const) kit.add(cone(0x4a8556, x, s * 0.3, z, s, s * 0.9), ball(0x8a8f88, x, 1, z, s * 1.05, 2.2, s * 1.05));
  kit.add(box(0xb9cfd6, -680, 3, 0, 40, 8, 1400));
  // san hô và cá dưới nước trong
  for (let i = 0; i < 90; i++) { const z = -60 + r() * 250, x = shore(z) - 4 - r() * 34; kit.add(bead([0xff7a6a, 0xffb347, 0xf29bc0, 0x9b7fd6, 0xfff0a0][i % 5], x, -2.6 + r() * 0.5, z, 0.7 + r() * 0.9, 0.5 + r() * 0.8, 0.7 + r() * 0.9)); }
  for (let i = 0; i < 30; i++) { const z = 60 + r() * 120, x = shore(z) - 6 - r() * 26; kit.add(cone([0xff7a6a, 0xffb347, 0xf29bc0][i % 3], x, -2.2, z, 0.3, 1.6)); }
  kit.motes(40, 0xffd23f, 0.5, () => { const z = -20 + r() * 200; return V(shore(z) - 4 - r() * 26, -1.2 - r(), z); }, (p, i, t, dt) => { p.z += Math.sin(t * 0.6 + i) * 0.9 * dt; p.x += Math.cos(t * 0.5 + i * 2) * 0.5 * dt; });
  // ---- cầu cảng Bãi Làng: cầu bê tông vươn ra phía tây, tàu gỗ và ca nô cập bến
  const PX0 = -62, PY = 1.3;
  kit.add(box(0xc9c4b8, (PX0 + 2) / 2, PY - 0.3, 0, 2 - PX0, 0.6, 6), box(0xc9c4b8, PX0 - 4, PY - 0.3, -6, 12, 0.6, 18));
  for (let x = PX0; x < 0; x += 7) for (const s of [-1, 1]) kit.add(cyl(0x9a958a, x, -1.2, s * 2.4, 0.4, 3.2));
  for (const s of [-1, 1]) for (let x = PX0 + 2; x < 0; x += 4) kit.add(box(0x3f7fbf, x, PY + 0.5, s * 2.9, 0.14, 1.0, 0.14), box(0xf4f1ea, x + 2, PY + 0.95, s * 2.9, 4, 0.12, 0.12));
  const ship = grp(PX0 - 4, -0.4, 9, Math.PI / 2); ship.add(ball(0x2a6f9a, 0, 0.5, 0, 2.8, 1.5, 9.5), box(0xf4f1ea, 0, 1.9, 0, 4.6, 0.3, 15), box(0xf4f1ea, 0, 3.2, -1.5, 3.6, 2.4, 7), box(0xbfe6ff, 0, 3.4, -1.5, 3.66, 1.0, 6), box(0xd2553a, 0, 4.6, -1.5, 4.2, 0.24, 8), cyl(0x3d3a36, 0, 6, -3, 0.08, 3), box(0xd2301e, 0.5, 7.0, -3, 1.0, 0.7, 0.04)); kit.add(ship);
  for (let i = 0; i < 6; i++) { const b = boat([0x2a6f9a, 0xd2553a, 0x3fa56a][i % 3], 6); b.scale.setScalar(1.3); b.position.set(shore(30 + i * 9) - 4 - (i % 2) * 5, -0.35, 22 + i * 9); b.rotation.y = 1.2 + r(); kit.add(b); }
  for (let i = 0; i < 5; i++) kit.add(cyl(0x8a6a48, shore(-30 - i * 6) + 4, 0.4, -30 - i * 6, 1.1, 0.5), cyl(0x3a3a3a, shore(-30 - i * 6) + 4, 0.66, -30 - i * 6, 0.9, 0.04));
  kit.live(label('Cầu cảng Bãi Làng', -30, 6.4, 0, '#2a6f9a', 1.0));
  // ---- cổng chào đảo và bảng "Nói không với túi ni lông"
  kit.add(box(0x2a6f9a, 6, 2.8, -3.6, 0.5, 5.6, 0.5), box(0x2a6f9a, 6, 2.8, 3.6, 0.5, 5.6, 0.5), box(0x2a6f9a, 6, 5.4, 0, 0.6, 1.2, 8.2));
  kit.live(label('Cù Lao Chàm', 6, 7.6, 0, '#2a6f9a', 1.1));
  const board = grp(17, 0, 7, -2.74); board.add(cyl(0x7a5a3c, -2, 1.6, 0, 0.12, 3.2), cyl(0x7a5a3c, 2, 1.6, 0, 0.12, 3.2), box(0x2f8a5a, 0, 2.6, 0, 5, 2.6, 0.16), box(0xf4f1ea, 0, 2.6, 0.1, 4.6, 2.2, 0.04), cyl(0xd2301e, -1.2, 2.5, 0.16, 0.8, 0.06).rotateX(Math.PI / 2), box(0xf4f1ea, -1.2, 2.5, 0.2, 1.3, 0.2, 0.04).rotateZ(0.8), box(0xe8e4d8, -1.2, 2.4, 0.14, 0.6, 0.7, 0.02), box(0x9a7150, 1.2, 2.2, 0.14, 0.9, 0.7, 0.3), cyl(0x9a7150, 1.2, 2.7, 0.14, 0.4, 0.06).rotateX(Math.PI / 2)); kit.add(board);
  kit.live(label('Nói không với túi ni lông', 17, 5.2, 7, '#2f8a5a', 0.8));
  const lady = person(4, 1, 0x9b7fd6); lady.position.set(14.4, 0, 9.4); lady.add(box(0x9a7150, 0.44, 0.9, 0, 0.4, 0.44, 0.5)); kit.add(lady);
  // ---- làng chài: nhà mái ngói thấp, lưới phơi, dừa
  const house = (x: number, z: number, ry: number) => { const w = 6 + r() * 2, c = [0xf1e3b8, 0xbfe0e6, 0xf3d9a0, 0xe9c9c0][Math.floor(r() * 4)]; const g = grp(x, 0, z, ry, box(c, 0, 1.8, 0, w, 3.6, 6), gable(0xa85a3a, 0, 3.6, 0, 7, 1.6, w + 0.8, Math.PI / 2), box(0x4a2c1c, 0, 1.2, 3.04, 1.4, 2.4, 0.1), box(0x3f6f8f, w / 3, 1.9, 3.04, 1.1, 1.1, 0.1), box(0xa85a3a, 0, 2.9, 3.9, w, 0.1, 1.8)); kit.add(g); };
  for (let i = 0; i < 9; i++) { house(30 + i * 9, -9, 0); if (i > 1) house(30 + i * 9, 9, Math.PI); }
  for (let i = 0; i < 8; i++) { house(22 - 12, -22 - i * 9, Math.PI / 2); house(22 + 12, -22 - i * 9, -Math.PI / 2); }
  for (let i = 0; i < 6; i++) { house(34, 20 + i * 10, -Math.PI / 2); }
  for (let i = 0; i < 40; i++) { const z = -190 + r() * 430, x = shore(z) + 16 + r() * 10; if (Math.abs(z) < 8 || (z > 96 && z < 130)) continue; const p = palm(r, 6 + r() * 3); p.position.set(x, 0, z); kit.add(p); }
  for (let i = 0; i < 4; i++) kit.add(cyl(0x7a5a3c, 14 + i * 0.2, 1, 24 + i * 5, 0.07, 2), box(0x6fa0a8, 14, 1.4, 26.5 + i * 5, 0.04, 1.0, 5));
  // ---- giếng cổ Chăm (xóm Cấm, chân núi): thành tròn gạch, nền vuông, trụ góc
  const WX = 22, WZ = -52;
  kit.add(box(0xa89a84, WX + 9, 0.12, WZ, 9, 0.24, 9), cyl(BRICK, WX + 9, 0.7, WZ, 1.9, 1.2), cyl(0x1f4a5a, WX + 9, 1.24, WZ, 1.5, 0.1), cyl(0x9c5632, WX + 9, 1.3, WZ, 2.0, 0.14));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(box(BRICK, WX + 9 + sx * 4, 0.8, WZ + sz * 4, 0.8, 1.6, 0.8), cone(0x9c5632, WX + 9 + sx * 4, 1.9, WZ + sz * 4, 0.6, 0.7));
  kit.add(cyl(0x8a6a48, WX + 6.4, 0.5, WZ + 2, 0.4, 0.6)); const t1 = tree(r, 1.8); t1.position.set(WX + 16, 0, WZ - 5); kit.add(t1);
  kit.live(label('Giếng cổ Chăm', WX + 9, 6.4, WZ - 3, '#9c5632', 0.6));
  // ---- chùa Hải Tạng: tam quan, sân, chính điện mái ngói âm dương, tựa núi nhìn ra cánh đồng nhỏ
  const HX = 30, HZ = -122, hz = grp(HX, 0, HZ);
  hz.add(box(0xe9dcc0, -3.6, 2, 16, 1.4, 4, 1.4), box(0xe9dcc0, 3.6, 2, 16, 1.4, 4, 1.4), templeRoof(0x8a4a36, 0, 4, 16, 11, 1.4, 3, 0x5a2a20), box(0xe9dcc0, -8, 1.2, 16, 8, 2.4, 0.6), box(0xe9dcc0, 8, 1.2, 16, 8, 2.4, 0.6));
  hz.add(box(0xb9b2a4, 0, 0.4, 0, 22, 0.8, 14), box(0xf1e3b8, 0, 3, 0, 18, 4.4, 10), templeRoof(0x8a4a36, 0, 5.2, 0, 22, 2.4, 14, 0x5a2a20), box(glow(0xffb347), 0, 2.6, 5.06, 3, 3, 0.1));
  for (let i = 0; i < 6; i++) hz.add(cyl(0xa8322a, -7.5 + i * 3, 3, 5.8, 0.28, 4.4));
  hz.add(cyl(0x7a7a72, 0, 0.9, 10, 1, 1.0), cyl(0x5a5a54, 0, 1.6, 10, 1.2, 0.3), box(0x8fd67c, -22, 0.05, 30, 20, 0.1, 20), box(0x79c96d, 22, 0.05, 32, 18, 0.1, 16));
  kit.add(hz); kit.live(label('Chùa Hải Tạng', HX, 10.4, HZ, '#8a4a36', 1.0));
  for (let i = 0; i < 12; i++) { const t = tree(r, 1.5 + r(), r() < 0.6); t.position.set(HX - 22 + r() * 44, 0, HZ - 12 - r() * 10); kit.add(t); }
  // ---- Bãi Chồng: những tảng đá tròn xếp chồng lên nhau trên bãi cát phía nam
  const BZ = 112, bx = shore(BZ) + 6;
  for (const [x, z, s] of [[0, 0, 2.8], [4, -4, 2.0], [-2, 5, 2.3], [6, 4, 1.7], [-6, -3, 1.8]] as const) { kit.add(rock(0xb9aa98, bx + x, s * 0.6, BZ + z, s, s * 0.8, s * 0.9, x), rock(0xa89a88, bx + x + 0.6, s * 1.75, BZ + z - 0.4, s * 0.74, s * 0.6, s * 0.7, z), rock(0xc4b6a4, bx + x - 0.3, s * 2.6, BZ + z + 0.2, s * 0.5, s * 0.4, s * 0.48, s)); }
  for (let i = 0; i < 14; i++) kit.add(rock(0xa89a88, bx - 10 + r() * 22, 0.3, BZ - 12 + r() * 26, 1 + r() * 1.4, 0.8 + r(), 1 + r(), r() * 3));
  for (let i = 0; i < 4; i++) { kit.add(cyl(0x7a5a3c, bx + 12 + i * 3.4, 1.1, BZ + 13, 0.06, 2.2), cone([0xe2573c, 0x4aa3d8, 0xffd23f, 0x7ccf4f][i], bx + 12 + i * 3.4, 2.3, BZ + 13, 1.4, 0.5), box(0x8a6a48, bx + 12 + i * 3.4, 0.3, BZ + 14, 0.7, 0.1, 1.8)); }
  kit.live(label('Bãi Chồng', bx, 13.6, BZ, '#8a7a5a', 1.0));
  // ---- chợ Tân Hiệp cạnh cầu cảng: nhà lồng nhỏ, sạp hải sản khô, bánh ít lá gai, rau rừng
  const MX = 16, MZ = 26;
  kit.add(box(0xa89a84, MX + 2, 0.03, MZ, 20, 0.08, 16), gable(0x6fb0cf, MX + 2, 4.2, MZ, 13, 2, 19, Math.PI / 2));
  for (const sx of [-1, 1]) for (const sz of [-1, 0, 1]) kit.add(cyl(0xd8d2c4, MX + 2 + sx * 8, 2.1, MZ + sz * 5.4, 0.24, 4.2));
  for (let i = 0; i < 6; i++) { const st = stall([0x4aa3d8, 0xe2573c, 0xffd23f][i % 3], r); st.scale.setScalar(0.85); st.position.set(MX - 4 + (i % 3) * 5.6, 0, MZ - 3 + Math.floor(i / 3) * 6); st.rotation.y = Math.PI * Math.floor(i / 3); kit.add(st); const p = person(i + 2, 1); p.position.set(MX - 4 + (i % 3) * 5.6, 0, MZ - 4.4 + Math.floor(i / 3) * 8.8); kit.add(p); }
  for (let i = 0; i < 8; i++) kit.add(box(0x9a7150, MX - 6 + i * 2.2, 0.7, MZ + 9.4, 1.8, 0.08, 1.2), bead([0xd9a06a, 0x3f6a3a, 0xc97a5a][i % 3], MX - 6 + i * 2.2, 0.86, MZ + 9.4, 0.6, 0.14, 0.4));
  kit.live(label('Chợ Tân Hiệp', MX + 2, 8, MZ, '#2a6f9a', 0.9));
  void ball; void signPost; void THREE;

  const path = [V(PX0, PY, 0), V(-4, PY, 0), V(4, 0, 0), V(16, 0, 0), V(22, 0, 0), V(22, 0, -52), V(22, 0, -100), V(HX, 0, HZ + 24), V(22.5, 0, -94), V(16.5, 0, -50), V(13, 0, 12), V(shore(60) + 12, 0, 60), V(shore(96) + 12, 0, 98), V(bx + 14, 0, BZ - 6), V(shore(70) + 22, 0, 72), V(26, 0, 46), V(MX + 3, 0, MZ + 13)];
  kit.pave(0xb9a98f, path, 3.6, 2, 10);
  return {
    path, half: 1.9, npcs: 10,
    stops: [
      { id: 'cau_cang', at: V(-46, PY, 0), look: V(60, 30, 10) },
      { id: 'bang_tui', at: V(14, 0, 0), look: V(17, 2.6, 7) },
      { id: 'gieng_co', at: V(22, 0, -50), look: V(WX + 9, 1, WZ) },
      { id: 'chua_hai_tang', at: V(HX - 0.4, 0, HZ + 25), look: V(HX, 5, HZ + 6) },
      { id: 'bai_chong', at: V(bx + 13.4, 0, BZ - 6.4), look: V(bx, 4, BZ) },
      { id: 'cho_dao', at: V(MX + 3.4, 0, MZ + 14), look: V(MX + 2, 3, MZ) },
    ],
    sky: [0x4fb0f0, 0xe6f6fb], fog: [0xd2ecf4, 120, 900],
    light: { ambient: 1.6, sun: 1.7, sunColor: 0xfff6dc, sunDir: [-0.4, 0.9, 0.3] },
  };
}

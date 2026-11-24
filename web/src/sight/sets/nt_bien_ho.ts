// Biển Hồ (hồ T’Nưng), Pleiku, Gia Lai. Trục x: tây → đông; z: bắc → nam.
// Hồ nằm trong miệng núi lửa đã tắt: mặt nước thấp hơn vành bờ ~8 m. Khách vào từ phía bắc theo con đường hai hàng thông,
// tới đài ngắm trên vành miệng, đi bậc thang xuống bến sát mặt nước, ra mỏm đất có tượng Đức Mẹ trắng, rồi lên đồi chè phía tây.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, box, cyl, grp, label, person, signPost, stairs, strip } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { forestMountain } from '../SightKit.ts';
import { pine, whiteStatue } from './nt_common.ts';

const RED = 0xa8553a, GRASS = 0x86ae5a, TEA = [0x3f7a3a, 0x4a8a42, 0x37703a];
export function bienHo(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  // vành miệng núi lửa: nền cao 0, lòng hồ là hố elip sâu, mặt nước ở −8
  const LX = 0, LZ = 60, RX = 110, RZ = 80;
  for (let i = 0; i < 36; i++) { const a = (i / 36) * 6.28, x = LX + Math.cos(a) * (RX + 30), z = LZ + Math.sin(a) * (RZ + 30); kit.add(box(GRASS, x, -0.5, z, 70, 1, 70, -a)); }
  kit.add(box(GRASS, 0, -0.5, -200, 600, 1, 240), box(GRASS, -260, -0.5, 60, 220, 1, 400), box(GRASS, 260, -0.5, 60, 220, 1, 400), box(GRASS, 0, -0.5, 290, 600, 1, 120));
  kit.add(cyl(0x5a6a5a, LX, -14, LZ, RX, 1, RZ)); kit.water(0x3f7f9a, LX, LZ, RX * 2, RZ * 2, -8, 0.95);
  for (let i = 0; i < 48; i++) { const a = (i / 48) * 6.28; kit.add(box(i % 2 ? 0x5f8a4a : 0x6f9a52, LX + Math.cos(a) * (RX + 3), -4, LZ + Math.sin(a) * (RZ + 3), 14, 8, 6, -a + Math.PI / 2).rotateZ(0.5)); }
  // con đường hai hàng thông dẫn vào từ phía bắc
  kit.add(box(RED, 0, 0.03, -120, 8, 0.06, 140));
  for (let z = -186; z < -46; z += 7) for (const sx of [-1, 1]) { const p = pine(r, 15 + r() * 4); p.position.set(sx * 7, 0, z); kit.add(p); }
  kit.add(signPost('Biển Hồ T’Nưng', 6, 0, -170, '#2d6f73', 1));
  // đài ngắm trên vành miệng, lan can
  kit.add(box(0xcfc8b8, 0, 0.2, -26, 22, 0.4, 10)); for (let i = 0; i < 12; i++) kit.add(cyl(0xf4f1ea, -10 + i * 1.8, 0.9, -21.4, 0.06, 1.2)); kit.add(box(0xf4f1ea, 0, 1.5, -21.4, 22, 0.12, 0.12));
  // bậc thang men sườn xuống bến (có chiếu nghỉ), bến gỗ sát mặt nước
  const s1 = V(-16, 0, -22), s2 = V(-26, -4, -12), s3 = V(-30, -4, -10), s4 = V(-38, -7.7, 0);
  kit.add(stairs(0xcfc8b8, s1, s2, 2.6, 14), box(0xcfc8b8, -28, -4.2, -11, 6, 0.4, 5), stairs(0xcfc8b8, s3, s4, 2.6, 13));
  kit.add(box(0x8a6a48, -40, -7.8, 4, 10, 0.3, 8), box(0x8a6a48, -40, -8.6, 4, 9, 1.4, 7));
  for (const [x, z] of [[-30, -16], [-34, -4]] as const) kit.add(box(0x8a8278, x, -3, z, 4, 6, 3));
  // mỏm đất nhô ra hồ có tượng Đức Mẹ
  kit.add(strip(0x8a6a48, V(-44, -7.7, 8), V(-46, -7.7, 30), 3, 0.4), cyl(GRASS, -48, -8.2, 38, 10, 1.2, 8));
  const st = whiteStatue(5.5); st.position.set(-48, -7.6, 40); st.rotation.y = Math.PI; kit.add(st);
  kit.live(label('Tượng Đức Mẹ', -48, 2, 40, '#2d6f73', 0.8), label('Biển Hồ', 20, 2, 70, '#2d6f73', 1.2));
  // thông và rừng trên vành hồ, núi Chư Đăng Ya xa phía đông bắc
  for (let i = 0; i < 70; i++) { const a = r() * 6.28, d = 1.18 + r() * 0.5, x = LX + Math.cos(a) * RX * d, z = LZ + Math.sin(a) * RZ * d; if (z < -10 && Math.abs(x) < 30) continue; if (x < -60 && z > 120) continue; const p = pine(r, 12 + r() * 6); p.position.set(x, 0, z); kit.add(p); }
  kit.add(forestMountain(0x5d8f6a, 300, -300, 120, 110, r), forestMountain(0x6a9c70, -320, -280, 140, 80, r), forestMountain(0x5d8f6a, 0, 420, 160, 70, r));
  // ---- đồi chè phía tây nam: luống chè tròn chạy theo đường đồng mức, vài cây thông cổ thụ đứng lẻ
  const TX = -130, TZ = 160;
  for (let row = 0; row < 14; row++) for (let k = 0; k < 18; k++) { const x = TX - 40 + k * 4.6, z = TZ - 30 + row * 4.4 + Math.sin(k * 0.4 + row) * 1.2; kit.add(ball(TEA[(row + k) % 3], x, 0.55, z, 1.9, 0.7, 1.5)); }
  for (const [x, z] of [[-130, 150], [-110, 176], [-150, 186]] as const) { const p = pine(r, 20); p.position.set(x, 0, z); kit.add(p); }
  for (let i = 0; i < 5; i++) { const p = person(i, 1, [0x4aa3d8, 0xe2573c, 0xffd23f][i % 3]); p.position.set(TX - 20 + i * 8, 0, TZ - 10 + (i % 2) * 8); p.add(cyl(0xc9a36a, 0, 1.2, -0.35, 0.3, 0.6)); kit.add(p); }
  kit.add(strip(RED, V(-40, 0, -30), V(-80, 0, 40), 3, 0.06), strip(RED, V(-80, 0, 40), V(-110, 0, 120), 3, 0.06), strip(RED, V(-110, 0, 120), V(-130, 0, 138), 3, 0.06));
  kit.live(label('Đồi chè Biển Hồ', TX, 9, TZ, '#2f5d3a', 0.9));
  for (let i = 0; i < 3; i++) kit.add(grp(-8 + i * 8, 0, -36, 0, cyl(0x8a6a48, 0, 1.2, 0, 0.08, 2.4), box(0xd9c27a, 0, 2.4, 0, 2.2, 0.1, 2.2)));

  const path = [V(0, 0, -186), V(0, 0, -120), V(0, 0, -50), V(0, 0.4, -26), V(-14, 0.4, -24), V(-16, 0, -22), V(-26, -4, -12), V(-30, -4, -10), V(-38, -7.7, 0), V(-40, -7.6, 4), V(-44, -7.7, 8), V(-46, -7.7, 30), V(-44, -7.7, 8), V(-38, -7.7, 0), V(-30, -4, -10), V(-26, -4, -12), V(-16, 0, -22), V(-40, 0, -30), V(-80, 0, 40), V(-110, 0, 120), V(-128, 0, 136)];
  return {
    path, half: 1.8, npcs: 8, startYaw: 0,
    stops: [
      { id: 'hang_thong', at: V(0, 0, -110), look: V(0, 8, -60) },
      { id: 'bac_thang', at: V(-6, 0.4, -24), look: V(20, -8, 60) },
      { id: 'mat_ho', at: V(-40, -7.6, 4), look: V(20, -8, 60) },
      { id: 'tuong_me', at: V(-46, -7.7, 28), look: V(-48, -3, 40) },
      { id: 'che_bien_ho', at: V(-128, 0, 136), look: V(-130, 1, 160) },
    ],
    sky: [0x7fbce8, 0xf2f0e0], fog: [0xe2eae0, 100, 560],
    light: { ambient: 1.6, sun: 1.6, sunColor: 0xfff0d0, sunDir: [0.4, 0.9, -0.5] },
    shopSpots: [V(-6, 0, -150), V(8, 0, -60), V(-120, 0, 128)],
  };
}

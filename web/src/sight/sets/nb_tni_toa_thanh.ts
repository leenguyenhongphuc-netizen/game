// Tòa Thánh Tây Ninh (đạo Cao Đài). Cửa chính phía nam → sân trước có hai tháp chuông – trống và Thiên Nhãn trên mặt tiền
// → hành lang bên hông nhìn vào chánh điện (cột rồng quấn, quả càn khôn). Trục z: bắc → nam; mặt tiền quay về +z.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, gable, grp, label, person, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { land } from './nb__kit.ts';

const WALL = 0xf2e6c0, YEL = 0xf2c84a, PINK = 0xe8a0b0, BLUE = 0x4a7ab8, ROOF = 0xc84a2a, GOLD = 0xffd24a, PAVE = 0xd8d0c0;

function tierTower(h: number, w: number, c = WALL): import('three').Group {
  const g = grp(0, 0, 0, 0);
  for (let i = 0; i < 4; i++) { const ww = w * (1 - i * 0.16), y = (h / 4) * i; g.add(box(i % 2 ? YEL : c, 0, y + h / 8, 0, ww, h / 4, ww), box(BLUE, 0, y + h / 4 - 0.25, 0, ww + 0.4, 0.3, ww + 0.4)); for (const s of [-1, 1]) g.add(box(0x5a8ac8, s * (ww / 2 + 0.03), y + h / 8, 0, 0.06, h / 8, ww * 0.3)); }
  g.add(cone(ROOF, 0, h + 1.8, 0, w * 0.4, 3.6), ball(GOLD, 0, h + 3.9, 0, 0.5));
  return g;
}

export function toaThanh(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  land(kit, -260, -260, 260, 260, 0x6aa04c, 0, false);
  kit.add(box(PAVE, 0, 0.04, 30, 70, 0.08, 70), box(PAVE, 0, 0.04, 90, 10, 0.08, 60));
  // thân Tòa Thánh: chánh điện dài, mái ngói đỏ nhiều cấp, lan can sơn hồng; mặt tiền ở z = 0
  const nave = grp(0, 0, -36);
  nave.add(box(WALL, 0, 0.6, 0, 26, 1.2, 74), box(WALL, 0, 5.2, 0, 22, 8, 72), gable(ROOF, 0, 9.2, 0, 23, 3.4, 73), box(PINK, 0, 9.4, 0, 23.4, 0.4, 73.4));
  for (let i = 0; i < 9; i++) for (const s of [-1, 1]) { const z = -30 + i * 7.5; nave.add(box(BLUE, s * 11.06, 5.4, z, 0.08, 3.6, 2.4), ball(0x9fd0f0, s * 11.1, 7.4, z, 1.2, 1.2, 0.06), box(PINK, s * 12.4, 1.8, z, 0.3, 1.2, 6)); }
  // tầng mái thứ hai và tháp hiệp thiên đài ở cuối (bát quái đài)
  nave.add(box(YEL, 0, 12.6, -24, 12, 4, 20), gable(ROOF, 0, 14.6, -24, 13, 2.6, 21), tierTower(10, 8).translateZ(-30).translateY(9.2));
  kit.add(nave);
  // mặt tiền: hai tháp (chuông bên trái, trống bên phải), khối giữa có Thiên Nhãn
  for (const s of [-1, 1]) { const t = tierTower(26, 7.6); t.position.set(s * 12, 0, 0); kit.add(t); }
  kit.add(box(WALL, 0, 6.6, 0.4, 16, 13.2, 4), box(YEL, 0, 14.4, 0.4, 14, 2.4, 3.4), cone(ROOF, 0, 17.4, 0.4, 6, 4));
  kit.add(cyl(0xffffff, 0, 10, 2.45, 2.6, 0.1).rotateX(Math.PI / 2), ball(0xffffff, 0, 10, 2.5, 1.9, 1.1, 0.1), ball(0x2a6ab8, 0, 10, 2.56, 0.8, 0.8, 0.06), ball(0x111111, 0, 10, 2.6, 0.38, 0.38, 0.05)); // Thiên Nhãn
  for (let i = 0; i < 9; i++) kit.add(box(GOLD, Math.cos((i / 9) * 3.14) * 3.4, 10 + Math.sin((i / 9) * 3.14) * 3.4, 2.5, 0.2, 1.4, 0.06, (i / 9) * 3.14 - 1.57)); // tia sáng
  kit.add(box(0x8a2a1a, 0, 2.4, 2.45, 4, 4.8, 0.1));
  for (let i = 0; i < 4; i++) kit.add(box(0xe8e0d0, 0, 0.15 + i * 0.3, 3.6 + (3 - i) * 0.6, 14, 0.3, 0.6)); // bậc tam cấp
  // cột rồng quấn thấy qua cửa hông (đặt ngay dưới hành lang để nhìn vào)
  for (let i = 0; i < 6; i++) { const z = -10 - i * 7.5; for (const s of [-1, 1]) { kit.add(cyl(PINK, s * 6, 4.6, z, 0.6, 8)); for (let k = 0; k < 6; k++) kit.add(bead(0x2a9a5a, s * 6 + Math.cos(k * 1.2) * 0.7, 1 + k * 1.2, z + Math.sin(k * 1.2) * 0.7, 0.35)); } }
  kit.add(ball(0x2a5ab0, 0, 3.6, -60, 2.6), ball(0xffffff, 0, 3.6, -57.5, 0.9, 0.5, 0.1), cyl(0xc8a040, 0, 1, -60, 1.8, 2)); // quả càn khôn
  // hành lang bên hông phía đông (lối đi có mái hiên cao)
  kit.add(box(PAVE, 19, 0.06, -40, 6, 0.12, 68)); for (let i = 0; i < 10; i++) kit.add(cyl(PINK, 21.6, 2.8, -72 + i * 7.2, 0.3, 5.6)); kit.add(box(ROOF, 19.8, 5.8, -40, 4.6, 0.2, 68));
  // cổng chính phía nam và hàng cây sao, tín đồ áo dài trắng
  kit.add(box(YEL, -8, 4, 110, 2, 8, 2), box(YEL, 8, 4, 110, 2, 8, 2), box(BLUE, 0, 8.6, 110, 20, 1.4, 2.4), gable(ROOF, 0, 9.3, 110, 3, 1.4, 22), ball(0xffffff, 0, 8.6, 111.3, 1.2, 0.7, 0.1));
  kit.live(label('Tòa Thánh Tây Ninh', 0, 32, 0, '#c84a2a', 1.4), label('Cửa Hòa Viện', 0, 13, 110, '#4a7ab8', 0.9));
  for (let z = 20; z < 106; z += 9) for (const x of [-9, 9]) { const t = tree(r, 1.4, true); t.position.set(x + (r() - 0.5), 0, z); kit.add(t); }
  for (let i = 0; i < 18; i++) { const p = person(i, 0, 0xf6f4ee); p.position.set(-26 + r() * 52, 0, 8 + r() * 46); p.rotation.y = r() * 6.28; kit.add(p); }
  const path = [V(0, 0, 118), V(0, 0, 100), V(0, 0, 60), V(0, 0, 26), V(22, 0, 14), V(19, 0, -8), V(19, 0, -30), V(19, 0, -60), V(26, 0, -78)];
  return {
    path, half: 2.4, npcs: 4,
    stops: [
      { id: 'cong', at: V(0, 0, 104), look: V(0, 7, 110), cam: V(6, 4, 96) },
      { id: 'san', at: V(0, 0, 26), look: V(0, 12, 0), cam: V(4, 5, 46) },
      { id: 'dien', at: V(19, 0, -30), look: V(0, 6, -40), cam: V(34, 7, -18) },
      { id: 'loi_ra', at: V(26, 0, -78), look: V(0, 10, -64), cam: V(32, 6, -72) },
    ],
    sky: [0x6ab4ea, 0xf2ead8], fog: [0xeee6d6, 140, 700],
    light: { ambient: 1.6, sun: 1.9, sunColor: 0xfff0d0, sunDir: [-0.4, 0.9, 0.6] },
    shopSpots: [V(6, 0, 90), V(22, 0, 18), V(22, 0, -66)],
  };
}

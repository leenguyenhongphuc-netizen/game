// Thác Dray Nur trên sông Sêrêpốk, Đắk Lắk. Trục x: tây → đông; z: bắc → nam.
// Sông chảy từ bắc xuống, đổ qua vách đá bazan rộng thành bức tường nước (mặt thác quay về NAM), xuống hồ dưới chân thác.
// Khách đi lối rừng từ phía tây nam xuống bãi đá chân thác, ngó vào hang sau màn nước, qua cầu treo sang phía đông (về Dray Sáp)
// và kết thúc ở nhà dài Ê Đê.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, label, person, rock, signPost, stairs, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { forestMountain } from '../SightKit.ts';
import { stiltHouse, suspensionBridge, waterfall } from './nt_common.ts';

const BASALT = [0x3d3a36, 0x4a4540, 0x524b44, 0x36332f], GRASS = 0x6f9a4a, FOREST = 0x2f6b45;
export function drayNur(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  // nền thấp (chân thác, y = 0) và cao nguyên phía bắc (đỉnh thác, y = 16)
  kit.add(box(GRASS, -205, -0.5, 115, 270, 1, 310), box(GRASS, 205, -0.5, 115, 270, 1, 310), box(GRASS, -47.5, -0.5, 147, 45, 1, 246), box(GRASS, 47.5, -0.5, 147, 45, 1, 246), box(GRASS, 0, 8, -170, 700, 16, 260));
  // vách thác bazan, lòng sông trên cao, hồ chân thác thấp
  kit.add(box(BASALT[0], 0, 7.5, -38, 140, 16, 6));
  for (let i = 0; i < 24; i++) { const x = (r() < 0.5 ? -1 : 1) * (58 + r() * 12); kit.add(box(BASALT[i % 4], x, 1 + r() * 14, -36 + r() * 2, 2 + r() * 4, 2 + r() * 4, 2 + r() * 2)); }
  for (let i = 0; i < 14; i++) kit.add(box(BASALT[i % 4], -56 + r() * 112, 15.6 + r() * 0.8, -38 + r() * 3, 2 + r() * 4, 1 + r(), 2 + r() * 2));
  kit.add(box(0x3a4a3a, 0, 15.2, -80, 120, 1, 80)); kit.water(0x6a8f7a, 0, -80, 120, 82, 16.1, 0.92);
  kit.add(box(0x2f3f3a, 0, -3.4, -6, 140, 1, 60)); kit.water(0x4f7f70, 0, -6, 140, 60, -0.45, 0.92);
  // dòng chảy tiếp xuống phía nam
  kit.add(box(0x2f3f3a, 0, -3.4, 80, 50, 1, 120)); kit.water(0x5a8a78, 0, 80, 50, 120, -0.45, 0.92);
  waterfall(kit, 0, 0, -35, 116, 16);
  // hang dơi sau màn nước: khoảng tối dưới chân vách phía tây
  kit.add(box(0x141210, -52, 3, -36.5, 10, 6, 1)); kit.add(box(BASALT[2], -60, 0.15, -28, 16, 0.3, 12));
  // bãi đá đen chân thác, lối rừng dốc xuống từ phía tây nam
  for (let i = 0; i < 40; i++) { const x = -64 + r() * 16, z = -30 + r() * 50; kit.add(rock(BASALT[i % 4], x, 0.2, z, 1 + r() * 2, 0.6 + r(), 1 + r() * 2, r() * 3)); }
  kit.add(stairs(0x7a6a52, V(-110, 16, -40), V(-100, 0, -6), 2.6));
  kit.add(box(BASALT[1], -72, 0.15, -18, 14, 0.3, 26)); // bãi đá phẳng để đứng ngắm
  // cầu treo qua sông phía nam
  suspensionBridge(kit, V(-30, 0.6, 60), V(30, 0.6, 60), 2.4, 8, 0x8a6a48, 0x7a5a3c);
  kit.live(label('Thác Dray Nur', 0, 26, -38, '#2d6f73', 1.2), label('Cầu treo', 0, 11, 60, '#7a4a22', 0.8));
  kit.add(signPost('Đường xuống thác', -100, 16, -60, '#2f6b45', 1));
  // nhà dài Ê Đê phía đông nam: nhà sàn dài, cầu thang tạc hình ngực mẹ, ché rượu cần
  const nd = stiltHouse(28, 6, 0x7a5a3a, 0xa8865a, 1.8); nd.position.set(60, 0, 88); kit.add(nd);
  kit.live(label('Nhà dài Ê Đê', 60, 9, 88, '#9c4a32', 0.9));
  for (let i = 0; i < 4; i++) { const p = person(i, 0, [0x2a1a12, 0xb8322a][i % 2]); p.position.set(48 + i * 6, 0, 96); kit.add(p); }
  // người tắm ngắm ở chân thác, rừng đại ngàn bao quanh
  for (let i = 0; i < 8; i++) { const p = person(i + 2, i % 3 === 0 ? 2 : 0); p.position.set(-74 + r() * 10, 0.5, -26 + r() * 20); kit.add(p); }
  for (let i = 0; i < 220; i++) {
    const x = -260 + r() * 520, z = -280 + r() * 480; const up = z < -42;
    if (Math.abs(x) < 72 && z > -130 && z < 30) continue; if (Math.abs(x) < 30 && z > 30) continue; if (x < -60 && x > -120 && z > -60 && z < 0) continue; if (Math.abs(x - 60) < 20 && Math.abs(z - 88) < 10) continue; if (Math.abs(z - 60) < 4 && Math.abs(x) < 40) continue;
    const t = tree(r, 1.4 + r() * 1.2, r() < 0.7); t.position.set(x, up ? 16 : 0, z); kit.add(t);
  }
  for (let i = 0; i < 10; i++) kit.add(forestMountain(i % 2 ? FOREST : 0x3d8253, -400 + i * 90, -400 - r() * 40, 90, 50 + r() * 40, r, 16));
  void box;

  const path = [V(-110, 16, -64), V(-110, 16, -40), V(-100, 0, -6), V(-78, 0.3, -14), V(-56, 0.3, -30), V(-78, 0.3, -10), V(-80, 0, 10), V(-50, 0, 40), V(-40, 0.6, 60), V(-30, 0.6, 60), V(30, 0.6, 60), V(40, 0, 66), V(52, 0, 80)];
  return {
    path, half: 1.8, npcs: 8, startYaw: 0.8,
    stops: [
      { id: 'loi_rung', at: V(-110, 16, -58), look: V(0, 14, -36) },
      { id: 'chan_thac', at: V(-74, 0.3, -12), look: V(0, 8, -36) },
      { id: 'hang_doi', at: V(-56, 0.3, -28), look: V(-52, 3, -37) },
      { id: 'cau_treo', at: V(0, 0.6, 60), look: V(0, 6, -36) },
      { id: 'nha_dai', at: V(52, 0, 80), look: V(60, 3, 88), cam: V(42, 6, 68) },
    ],
    sky: [0x7fbce8, 0xeef2e0], fog: [0xdde8dc, 90, 520],
    light: { ambient: 1.55, sun: 1.6, sunColor: 0xfff0d0, sunDir: [0.5, 0.8, 0.6] },
    shopSpots: [V(-114, 16, -70), V(-64, 0, 8), V(40, 0, 74)],
  };
}

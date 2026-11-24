// Gành Đá Đĩa, Tuy An, Phú Yên (nay thuộc Đắk Lắk). Trục x: tây → đông (biển ở phía ĐÔNG); z: bắc → nam.
// Từ cổng phía tây đi xuống bãi cát rồi bước lên mặt gành: hàng nghìn cột bazan lục giác xếp như tổ ong, cao dần về phía biển,
// mặt trên như chồng đĩa nghiêng. Sóng tung bọt ở mép gành; hai bên là bãi cát với thuyền thúng của làng chài.
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, grp, hill, label, palm, person, signPost } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { coracle, umbrella } from './_extra.ts';
import { basaltField, hexColumn } from './nt_common.ts';

const SAND = 0xead9b0, WET = 0xd8c294, SCRUB = [0x6f8f4a, 0x7f9a52, 0x5f7f42, 0x8aa25a];
export function ganhDaDia(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  kit.add(box(0x1c7fa0, 300, -3, 0, 600, 1, 800)); kit.water(0x2a96b8, 260, 0, 520, 800, -0.35, 0.9);
  kit.add(box(SAND, -40, -0.5, 0, 120, 1, 800), box(WET, 22, -0.48, 0, 8, 1, 800), box(0x9ab865, -220, -0.5, 0, 240, 1, 800));
  kit.add(hill(-120, -140, 80, 60, 30, r, SCRUB), hill(-140, 120, 90, 60, 26, r, SCRUB));
  // gành chính: bãi cột lục giác cao từ 0,3 m (sát bãi cát) tới ~3 m (mép biển), mặt gợn bậc để bước lên được
  const step = (x: number) => Math.max(0, Math.round(((x - 18) / 34) * 6) * 0.42 + 0.3);
  basaltField(kit, 40, 0, 26, 30, (x, z) => (Math.abs(z) > 26 - Math.max(0, x - 40) * 0.3 ? 0 : step(x) + Math.sin(z * 0.3) * 0.08), 1.5);
  // các khối cột cao đứng sát biển, nghiêng như chồng đĩa
  for (let i = 0; i < 40; i++) { const x = 62 + r() * 10, z = -26 + r() * 52, h = 3 + r() * 3; kit.add(hexColumn([0x3d3a3a, 0x4a4644, 0x34302f][i % 3], x, z, 0.5 + r() * 0.2, h, 0.15 + r() * 0.2)); }
  // gành phụ hai bên
  basaltField(kit, 30, -70, 14, 10, (x) => step(x) * 0.7, 1.6);
  basaltField(kit, 34, 70, 16, 10, (x) => step(x) * 0.7, 1.6);
  // sóng tung bọt ở mép gành
  const foam = [0, 1, 2, 3, 4, 5].map((i) => { const m = grp(70, 0, -24 + i * 9.6, 0, box(0xffffff, 0, 0, 0, 3, 0.6, 7)); kit.live(m); return m; });
  kit.onTick((t) => foam.forEach((f, i) => { const k = (Math.sin(t * 1.3 + i * 1.1) + 1) / 2; f.position.y = -0.4 + k * 1.6; f.scale.set(0.6 + k, 0.5 + k * 1.8, 1); f.position.x = 72 + k * 2; }));
  kit.motes(40, 0xffffff, 0.6, () => V(72 + r() * 4, r() * 3, -26 + r() * 52), (p, i, t) => { p.y = ((t * 0.8 + i * 0.37) % 3); });
  kit.live(label('Gành Đá Đĩa', 44, 11, 0, '#2d3a4a', 1.1));
  // cổng thắng cảnh, bãi xe, biển thông tin
  kit.add(box(0xd9c8b0, -64, 2.5, 0, 2, 5, 2), box(0xd9c8b0, -64, 2.5, 10, 2, 5, 2), box(0x3a4a5a, -64, 5.4, 5, 2.4, 1, 14));
  kit.live(label('Thắng cảnh Gành Đá Đĩa', -64, 8, 5, '#2d3a4a', 0.9));
  kit.add(signPost('Không đứng sát mép đá khi sóng lớn', 18, 0, -10, '#d2301e', 0.8));
  // bãi thuyền thúng và làng chài phía nam
  for (let i = 0; i < 10; i++) { const c = coracle(1.1 + r() * 0.3); c.position.set(6 + (i % 5) * 4, 0, 96 + Math.floor(i / 5) * 5); kit.add(c); }
  for (let i = 0; i < 9; i++) { const x = -40 - (i % 3) * 14, z = 100 + Math.floor(i / 3) * 14; kit.add(box([0xf1e3b8, 0xd9e6ee, 0xe9d2c0][i % 3], x, 2, z, 9, 4, 8), box([0x2a6fbf, 0xd2301e, 0x18a558][i % 3], x, 4.2, z, 10, 0.3, 9)); }
  for (let i = 0; i < 4; i++) { const p = person(i + 2, 1, [0x9b7fd6, 0x4aa3d8, 0xe2573c, 0xffd23f][i]); p.position.set(4 + i * 3, 0, 90); kit.add(p); }
  for (let i = 0; i < 6; i++) { const u = umbrella([0xe2573c, 0xffd23f][i % 2]); u.position.set(-10 + (i % 3) * 6, 0, -40 + Math.floor(i / 3) * 6); kit.add(u); }
  for (let i = 0; i < 30; i++) { const p = palm(r, 6 + r() * 3); const z = -160 + r() * 330, x = -30 - r() * 60; if (Math.abs(z) < 16) continue; p.position.set(x, 0, z); kit.add(p); }
  for (let i = 0; i < 10; i++) { const p = person(i, i % 2 ? 2 : 1, [0xe2573c, 0x4aa3d8, 0xffd23f, 0x7ccf4f][i % 4]); p.position.set(30 + r() * 26, 1.5, -18 + r() * 36); kit.add(p); }

  const path = [V(-80, 0, 5), V(-60, 0, 5), V(-20, 0, 4), V(10, 0, 2), V(18, 0.3, 0), V(30, 1.1, 0), V(44, 2, 2), V(56, 2.8, 4), V(44, 2, 2), V(30, 1.1, -10), V(18, 0.3, -20), V(12, 0, 40), V(10, 0, 80), V(8, 0, 90)];
  return {
    path, half: 1.6, npcs: 8, startYaw: Math.PI / 2,
    stops: [
      { id: 'cong', at: V(-58, 0, 5), look: V(-64, 4, 5), cam: V(-44, 5, 16) },
      { id: 'cot_da', at: V(30, 1.1, 0), look: V(48, 1, 6) },
      { id: 'mat_da', at: V(44, 2, 2), look: V(56, 0, 10), cam: V(36, 9, -8) },
      { id: 'mep_song', at: V(56, 2.8, 4), look: V(74, 1, 4) },
      { id: 'lang_chai', at: V(8, 0, 90), look: V(14, 0.5, 98), cam: V(0, 7, 78) },
    ],
    sky: [0x3a9eea, 0xe4f3fb], fog: [0xd8ecf6, 140, 760],
    light: { ambient: 1.6, sun: 1.9, sunColor: 0xfff2d6, sunDir: [0.4, 0.9, 0.5] },
    shopSpots: [V(-50, 0, -6), V(-8, 0, 10), V(-4, 0, 84)],
  };
}

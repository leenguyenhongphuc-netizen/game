// Tháp Po Klong Garai trên đồi Trầu, Phan Rang (nay thuộc Khánh Hòa). Trục x: tây → đông; z: bắc → nam.
// Đồi đá sỏi khô mọc xương rồng; bậc gạch đi lên từ phía đông: tháp Cổng ở sườn, tháp Lửa mái yên ngựa, tháp Chính trên đỉnh
// có tượng Shiva trên cửa; sân lễ phía nam đỉnh đồi bày trống Ginăng, kèn Saranai cho lễ Katê. Xa là đồng nho, cánh đồng điện gió.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, box, cyl, grp, label, person, stairs } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import { forestMountain } from '../SightKit.ts';
import { cactus, kalan, saddleTower } from './nt_common.ts';

const DUST = 0xc9b48a, DRY = 0xb8a870, VINE = 0x5f8a3a;
function windTurbine(): THREE.Group { const g = grp(0, 0, 0, 0, cyl(0xf4f1ea, 0, 20, 0, 0.6, 40), box(0xf4f1ea, 0, 40, 0.8, 1.4, 1.4, 3)); for (let i = 0; i < 3; i++) { const b = box(0xffffff, 0, 0, 0, 0.6, 16, 0.2); b.position.set(Math.sin((i * 2 * Math.PI) / 3) * 8, 40 + Math.cos((i * 2 * Math.PI) / 3) * 8, -0.9); b.rotation.z = -(i * 2 * Math.PI) / 3; g.add(b); } return g; }
export function poKlongGarai(kit: Kit, _s: Sight): SightSet {
  const r = kit.r;
  kit.ground(DUST, 900);
  // đồi Trầu: các tầng tròn (mỗi tầng 1,8 m), đỉnh y = 7,2
  const HX = 0, HZ = -30, tiers = [[56, 1.8], [42, 3.6], [30, 5.4], [18, 7.2]] as const;
  for (const [rad, h] of tiers) kit.add(cyl(h > 6 ? 0xd4c294 : DRY, HX, h / 2, HZ, rad, h, rad * 0.9));
  // lối bậc gạch từ phía đông lên đỉnh (mép các tầng ở x = 56, 42, 30, 18)
  for (const [x0, x1, y] of [[62, 56, 0], [48, 42, 1.8], [36, 30, 3.6], [24, 18, 5.4]] as const) kit.add(stairs(0xb4593c, V(x0, y, HZ), V(x1, y + 1.8, HZ), 3, 6));
  const cong = kalan(3.2, r, 1); cong.position.set(40, 1.8, HZ - 7); kit.add(cong);
  const lua = saddleTower(6, 4, 5); lua.position.set(10, 7.2, HZ - 10); kit.add(lua);
  const chinh = kalan(8.4, r); chinh.position.set(-4, 7.2, HZ); kit.add(chinh);
  // tượng Shiva sáu tay trên cửa tháp chính (mặt đông)
  kit.add(box(0xd9c8a0, 7.6, 7.2 + 9.2, HZ, 0.3, 2.2, 2), cyl(0xd9c8a0, 7.8, 7.2 + 10.6, HZ, 0.4, 0.6));
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) kit.add(box(0xd9c8a0, 7.8, 7.2 + 9.4 + i * 0.3, HZ + s * (0.7 + i * 0.25), 0.15, 0.12, 0.6));
  kit.live(label('Tháp Chính · Po Klong Garai', -4, 27, HZ, '#9c4a32', 1.0), label('Tháp Lửa', 10, 17, HZ - 10, '#9c4a32', 0.7), label('Tháp Cổng', 40, 10, HZ - 7, '#9c4a32', 0.7));
  // sân lễ Katê ở mép nam đỉnh đồi: trống Ginăng, người múa áo trắng khăn đỏ
  for (let i = 0; i < 2; i++) kit.add(grp(0 + i * 3, 7.2, HZ + 12, 0, cyl(0x8a5a32, 0, 0.6, 0, 0.5, 1.2).rotateZ(Math.PI / 2), cyl(0xe8dcc0, 0.62, 0.6, 0, 0.46, 0.05).rotateZ(Math.PI / 2)));
  for (let i = 0; i < 6; i++) { const p = person(i, 0, 0xf4f1ea); p.position.set(-8 + i * 3, 7.2, HZ + 14 + (i % 2)); p.add(box(0xd2301e, 0, 1.85, 0, 0.6, 0.12, 0.6)); kit.add(p); }
  // xương rồng, cỏ cháy trên sườn
  for (let i = 0; i < 80; i++) { const a = r() * 6.28, d = 20 + r() * 40, x = HX + Math.cos(a) * d, z = HZ + Math.sin(a) * d * 0.9; if (Math.abs(z - HZ) < 6 && x > 14) continue; const tier = [...tiers].reverse().find(([rad]) => Math.hypot(x - HX, (z - HZ) / 0.9) < rad); const c = cactus(0.8 + r() * 0.7); c.position.set(x, tier ? tier[1] : 0, z); kit.add(c); }
  // đồng nho giàn và cánh đồng điện gió ở xa
  for (let row = 0; row < 8; row++) { const z = 70 + row * 8; kit.add(box(VINE, 60, 1.8, z, 70, 0.4, 5)); for (let k = 0; k < 8; k++) kit.add(cyl(0x7a5a3c, 26 + k * 10, 0.9, z, 0.08, 1.8)); }
  const blades: THREE.Group[] = [];
  for (let i = 0; i < 7; i++) { const w = windTurbine(); w.position.set(-260 + i * 70, 0, -260 - (i % 2) * 40); kit.add(w); }
  void blades;
  for (let i = 0; i < 6; i++) kit.add(forestMountain(0xa89a6a, -400 + i * 160, -420, 140, 90 + r() * 60, r));
  for (let i = 0; i < 4; i++) { const p = person(i + 2, 2, [0x4aa3d8, 0xe2573c, 0xffd23f, 0x7ccf4f][i]); p.position.set(64 + i * 2.5, 0, HZ + 4); kit.add(p); }
  kit.add(box(0x5a5d62, 120, 0.03, 0, 14, 0.06, 900));

  const path = [V(90, 0, HZ), V(62, 0, HZ), V(56, 1.8, HZ), V(48, 1.8, HZ), V(42, 3.6, HZ), V(36, 3.6, HZ), V(30, 5.4, HZ), V(24, 5.4, HZ), V(18, 7.2, HZ), V(12, 7.2, HZ + 4), V(4, 7.2, HZ + 10), V(-2, 7.2, HZ + 10)];
  return {
    path, half: 1.6, npcs: 6, startYaw: -Math.PI / 2,
    stops: [
      { id: 'chan_doi', at: V(70, 0, HZ), look: V(-4, 14, HZ) },
      { id: 'thap_cong', at: V(46, 1.8, HZ), look: V(40, 4, HZ - 7) },
      { id: 'thap_lua', at: V(16, 7.2, HZ - 2), look: V(10, 10, HZ - 10) },
      { id: 'thap_chinh', at: V(14, 7.2, HZ + 4), look: V(-4, 14, HZ), cam: V(26, 10, HZ + 10) },
      { id: 'le_kate', at: V(-2, 7.2, HZ + 10), look: V(-2, 8, HZ + 14), cam: V(10, 11, HZ + 24) },
    ],
    sky: [0x3a9eea, 0xf6eed8], fog: [0xeee6d0, 140, 760],
    light: { ambient: 1.6, sun: 2.0, sunColor: 0xfff0cc, sunDir: [0.6, 1, 0.3] },
    shopSpots: [V(80, 0, HZ - 6), V(80, 0, HZ + 6)],
  };
}

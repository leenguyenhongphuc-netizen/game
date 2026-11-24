// Dinh Cậu, Phú Quốc. Chợ đêm Dương Đông dọc bờ sông → kè đá ra cửa sông → ghềnh đá có miếu Dinh Cậu và ngọn hải đăng
// → bãi cát ngắm hoàng hôn trên vịnh Thái Lan. Biển ở phía tây (x âm), sông Dương Đông chảy ra theo trục z ở phía bắc.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, box, cone, cyl, grp, label, person, rock, stairs, templeRoof } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { fishingBoat } from './_extra.ts';
import { coconut, land, redLantern } from './nb__kit.ts';

const SEA = 0x3a8ab0, SAND = 0xead8a8, ROCKC = [0x6a625a, 0x7a7268, 0x5a544e], PAVE = 0xcfc4ae;

export function dinhCau(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  // đất liền phía đông (thị trấn), bãi cát, biển phía tây, cửa sông phía bắc
  land(kit, 0, -40, 300, 300, 0x7aa85a, 0, false);
  kit.add(box(SAND, -20, -0.3, 120, 40, 0.6, 360));
  kit.add(box(0x2a5a70, -200, -3, 0, 400, 1, 800), box(0x2a5a70, 150, -3, -140, 300, 1, 200)); kit.water(SEA, -100, -60, 600, 800, -0.6, 0.9);
  // kè đá và đường dạo dọc bờ sông (chợ đêm), lan can
  kit.add(box(PAVE, 40, 0.04, -30, 120, 0.08, 10), box(0x8a8a86, 40, -0.6, -36, 120, 1.4, 2));
  // chợ đêm: dãy sạp mái bạt, đèn lồng, hải sản
  for (let i = 0; i < 14; i++) { const x = 0 + i * 8; kit.add(grp(x, 0, -22, 0, box(0x9a7150, 0, 0.5, 0, 3.6, 1, 2), box([0xc8322a, 0x2a6a9a, 0xf2c64a][i % 3], 0, 2.8, 0.2, 4.2, 0.1, 3), cyl(0x6a6a6a, -1.8, 1.4, 1.4, 0.05, 2.8), cyl(0x6a6a6a, 1.8, 1.4, 1.4, 0.05, 2.8))); for (let k = 0; k < 5; k++) kit.add(ball([0xd8382a, 0xe8a060, 0x9a6a4a, 0xf2e0c0][k % 4], x - 1.2 + k * 0.6, 1.1, -22, 0.24, 0.12, 0.3)); kit.add(redLantern(x, 3.2, -20.2, 0.6)); }
  kit.live(label('Chợ đêm Dương Đông', 50, 7, -22, '#c8322a', 1));
  // ghe đánh cá sơn xanh neo ở cửa sông
  for (let i = 0; i < 9; i++) { const b = fishingBoat([0x2a6f9a, 0x3a8ac0][i % 2], [0xd2553a, 0xf2c64a][i % 2], 10); b.position.set(10 + i * 14, -0.6, -60 - r() * 30); b.rotation.y = r() * 0.5; kit.add(b); }
  // ghềnh đá ở mũi phía tây bắc, bậc đá lên, miếu Dinh Cậu mái ngói đỏ, hải đăng trắng
  const DX = -40, DZ = -56, DY = 5;
  for (let i = 0; i < 26; i++) kit.add(rock(ROCKC[i % 3], DX + (r() - 0.5) * 30, -0.5 + r() * DY, DZ + (r() - 0.5) * 24, 3 + r() * 4, 2 + r() * 3, 3 + r() * 4, r() * 6));
  kit.add(box(ROCKC[1], DX, DY / 2, DZ, 26, DY, 20), box(PAVE, DX, DY + 0.03, DZ, 22, 0.06, 16));
  kit.add(box(PAVE, -10, 0.04, -40, 26, 0.08, 4), stairs(0xb8b0a2, V(-24, 0, -42), V(-30, DY, -48), 3, 18));
  kit.add(grp(DX - 2, DY, DZ - 2, 0, box(0xf2e2b0, 0, 1.8, 0, 7, 3.6, 5), templeRoof(0xc8432a, 0, 3.6, 0, 8.6, 1.8, 6.6, 0xffd24a), box(0x8a2a1a, 0, 1.4, 2.55, 1.6, 2.8, 0.1), box(0xffd24a, 0, 3.2, 2.62, 3, 0.5, 0.06)));
  for (let i = 0; i < 3; i++) kit.add(redLantern(DX - 4 + i * 2, DY + 3.2, DZ + 1, 0.7));
  kit.add(cyl(0xffffff, DX + 6, DY + 5, DZ - 4, 0.9, 10), cyl(0xd8382a, DX + 6, DY + 10.6, DZ - 4, 1.2, 1.2), cone(0xd8382a, DX + 6, DY + 12, DZ - 4, 1.3, 1.4), ball(0xfff2a0, DX + 6, DY + 10.6, DZ - 4, 0.7));
  kit.live(label('Dinh Cậu', DX, DY + 10, DZ, '#c8432a', 1.1));
  // bãi cát ngắm hoàng hôn, hàng dừa
  for (let i = 0; i < 30; i++) { const c = coconut(r, 8 + r() * 4); c.position.set(4 + r() * 12, 0, -10 + r() * 200); kit.add(c); }
  for (let i = 0; i < 14; i++) { const p = person(i, i % 3 === 0 ? 1 : 0); p.position.set(-30 + r() * 20, 0, 10 + r() * 60); p.rotation.y = -Math.PI / 2; kit.add(p); }
  // mặt trời lặn trên biển
  const sun = new THREE.Mesh(new THREE.CircleGeometry(30, 32), new THREE.MeshBasicMaterial({ color: 0xffb060, fog: false })); sun.position.set(-600, 50, 40); sun.lookAt(0, 50, 40); kit.live(sun);
  const path = [V(110, 0, -30), V(80, 0, -30), V(40, 0, -30), V(0, 0, -30), V(-10, 0, -40), V(-24, 0, -42), V(-30, DY, -48), V(-36, DY, -52), V(-30, DY, -48), V(-24, 0, -42), V(-20, 0, -20), V(-24, 0, 20), V(-26, 0, 40)];
  return {
    path, half: 2.2, npcs: 4,
    stops: [
      { id: 'cho_dem', at: V(40, 0, -30), look: V(40, 1.6, -22), cam: V(34, 4, -38) },
      { id: 'ghenh_da', at: V(-24, 0, -42), look: V(DX, 3, DZ), cam: V(-16, 4, -34) },
      { id: 'dinh', at: V(-36, DY, -52), look: V(DX - 2, DY + 2, DZ - 2), cam: V(-30, DY + 4, -44) },
      { id: 'hoang_hon', at: V(-26, 0, 40), look: V(-300, 20, 40), cam: V(-18, 4, 46) },
    ],
    sky: [0xf2a070, 0xfbd8a8], fog: [0xf6c898, 140, 700],
    light: { ambient: 1.4, sun: 1.8, sunColor: 0xffc890, sunDir: [-0.9, 0.35, 0.1] },
    shopSpots: [V(90, 0, -34), V(-16, 0, -24), V(-18, 0, 30)],
  };
}

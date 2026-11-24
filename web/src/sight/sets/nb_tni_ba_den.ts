// Núi Bà Đen (986 m). Cảnh đặt trên vùng đỉnh: ga cáp treo trên đỉnh → lối đá xuống chùa Bà ở mỏm phía tây →
// sân đỉnh có mây ngang tầm mắt → tượng Phật Bà Tây Bổ Đà Sơn bằng đồng trên đài sen. Sườn núi đổ xuống mọi phía,
// đồng bằng Tây Ninh và hồ Dầu Tiếng ở xa bên dưới. Trục x: tây → đông.
import * as THREE from 'three';
import type { Sight } from '../../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cone, cyl, grp, incenseUrn, label, person, rock, templeRoof, tree } from '../SightKit.ts';
import type { SightSet } from '../SightKit.ts';
import type { Spots } from './_extra.ts';
import { baked } from './_extra.ts';
import { cableway } from './nb__kit.ts';

const PLAZA = 0xd8d0c0, ROCKC = [0x6a6a62, 0x7a786e, 0x5a5a54], BRONZE = 0x8a6a3a, BRONZE2 = 0xa8823e;

export function baDen(kit: Kit, _s: Sight): SightSet & Spots {
  const r = kit.r;
  // đồng bằng xa bên dưới (thấp 240 m) và hồ Dầu Tiếng
  kit.add(box(0x7aa85a, 0, -241, 0, 2400, 2, 2400)); kit.add(box(0x6aa0b8, -600, -239.9, -300, 700, 0.2, 400));
  for (let i = 0; i < 40; i++) kit.add(box([0x8ab86a, 0x6a9a4a, 0xa8b870][i % 3], (r() - 0.5) * 2000, -239.95, (r() - 0.5) * 2000, 60 + r() * 120, 0.1, 40 + r() * 100));
  // khối núi: nón cụt nhiều tầng sườn đá phủ rừng, mặt đỉnh bằng rộng 70 m
  const mt = new THREE.Mesh(new THREE.CylinderGeometry(70, 420, 240, 40, 6), new THREE.MeshLambertMaterial({ color: 0x3f6a3a })); mt.position.set(0, -120.02, 0); kit.add(mt);
  for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = 72 + r() * 200, y = -240 * (d - 70) / 350; kit.add(ball([0x355e32, 0x467a3e, 0x2f5a2c][i % 3], Math.cos(a) * d, y, Math.sin(a) * d, 10 + r() * 12, 4, 10 + r() * 12)); }
  for (let i = 0; i < 30; i++) { const a = r() * 6.28, d = 50 + r() * 18; kit.add(rock(ROCKC[i % 3], Math.cos(a) * d, 0.4, Math.sin(a) * d, 2 + r() * 3, 1.4 + r() * 2, 2 + r() * 3, r() * 6)); }
  kit.add(cyl(PLAZA, 0, -0.1, 0, 46, 0.2));
  // ga cáp treo trên đỉnh (phía đông) và tuyến cáp đổ xuống chân núi
  const GX = 52, GZ = 10;
  kit.add(grp(GX, 0, GZ, 0, box(0xe8e4dc, 0, 4, 0, 16, 8, 12), box(0x3a6a9a, 0, 4.4, 6.05, 14, 5, 0.1), box(0xc83a2a, 0, 8.4, 0, 17, 0.8, 13)));
  cableway(kit, V(GX + 4, -2, GZ), V(GX + 320, -236, GZ + 120), 7, 12, 0xd8281e);
  kit.live(label('Ga cáp treo', GX, 12, GZ, '#c83a2a', 1));
  // chùa Bà: mái cong ngói đỏ trên mỏm đá phía tây, bậc đá dẫn xuống
  const CX = -32, CZ = 18, CY = 0;
  kit.add(box(0xc8bfae, CX, 0.25, CZ, 22, 0.5, 14));
  kit.add(grp(CX - 2, CY, CZ, 0, box(0xf2d08a, 0, 2.4, 0, 14, 4.8, 8), templeRoof(0xb83a1c, 0, 4.8, 0, 16, 2.4, 10, 0xffd24a), templeRoof(0xb83a1c, 0, 7.4, 0, 9, 1.8, 6, 0xffd24a), box(0x8a2a1a, 0, 1.8, 4.05, 3, 3.6, 0.1)));
  const urn = incenseUrn(); urn.position.set(CX + 6, CY, CZ); kit.add(urn);
  kit.live(label('Chùa Bà – Linh Sơn Tiên Thạch Tự', CX, CY + 13, CZ, '#b83a1c', 1));
  // tượng Phật Bà Tây Bổ Đà Sơn: đài sen, thân áo dài, tay trái bình nước, tay phải cành dương (cao 72 m ngoài đời, thu nhỏ còn 40 m)
  const BX = -6, BZ = -26;
  kit.add(cyl(0xc8bfae, BX, 1.2, BZ, 12, 2.4), cyl(0xb8b0a0, BX, 3.4, BZ, 9, 2));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.28; const p = ball(BRONZE2, BX + Math.cos(a) * 7.4, 5.6, BZ + Math.sin(a) * 7.4, 2.4, 1.6, 1.2); p.rotation.y = -a; kit.add(p); }
  const s = grp(BX, 5.4, BZ, 0);
  s.add(cyl(BRONZE, 0, 13, 0, 4.4, 26, 5.4), cone(BRONZE, 0, 3, 0, 6.6, 6), cyl(BRONZE, 0, 27, 0, 3.4, 3), ball(BRONZE2, 0, 31.6, 0, 3, 3.6, 3), cone(BRONZE2, 0, 35.6, 0, 1.6, 3), ball(0xffd24a, 0, 30, 0, 4.6, 4.6, 0.3).translateZ(-2.6));
  s.add(cyl(BRONZE, -4.6, 21, 1.2, 1.1, 11).rotateZ(0.25), cyl(BRONZE, 4.6, 21, 1.2, 1.1, 11).rotateZ(-0.25), ball(BRONZE2, -5.2, 15.4, 2.4, 1.4, 2, 1.4), cyl(BRONZE2, -5.2, 17.4, 2.4, 0.5, 1.2));
  for (let i = 0; i < 6; i++) s.add(box(0x7a5a2e, -3.6 + i * 1.44, 12, 4.7, 0.3, 22, 0.4)); // nếp áo
  kit.add(s); kit.live(label('Tượng Phật Bà Tây Bổ Đà Sơn', BX, 46, BZ, '#8a6a3a', 1.3));
  // mây trôi ngang tầm mắt quanh đỉnh
  const clouds: THREE.Object3D[] = [];
  for (let i = 0; i < 16; i++) { const c = baked(grp(0, -8 + r() * 14, 0, 0, bead(0xffffff, 0, 0, 0, 14 + r() * 10, 3.4, 8 + r() * 6), bead(0xf2f6fa, 9, 1, 3, 9, 2.6, 6))); kit.live(c); clouds.push(c); }
  kit.onTick((t) => clouds.forEach((c, i) => { const a = i * 0.39 + t * 0.012, d = 110 + (i % 4) * 30; c.position.x = Math.cos(a) * d; c.position.z = Math.sin(a) * d; }));
  for (let i = 0; i < 12; i++) { const t = tree(r, 1 + r() * 0.5, true); const a = r() * 6.28; t.position.set(Math.cos(a) * (36 + r() * 8), 0, Math.sin(a) * (36 + r() * 8)); kit.add(t); }
  for (let i = 0; i < 14; i++) { const p = person(i, i % 3 === 0 ? 1 : 0); p.position.set(-20 + r() * 50, 0, -10 + r() * 30); p.rotation.y = r() * 6.28; kit.add(p); }
  const path = [V(GX - 10, 0, GZ + 8), V(30, 0, 10), V(0, 0, 6), V(-16, 0, 8), V(-16, 0, 26), V(-32, 0, 32), V(-16, 0, 26), V(-16, 0, 8), V(-14, 0, -6), V(-6, 0, -12), V(10, 0, -14)];
  return {
    path, half: 2.4, npcs: 4,
    stops: [
      { id: 'ga_cap', at: V(GX - 10, 0, GZ + 8), look: V(GX + 6, 2, GZ + 2), cam: V(GX - 22, 6, GZ + 20) },
      { id: 'chua_ba', at: V(-32, 0, 32), look: V(CX - 2, 4, CZ), cam: V(-26, 4, 42) },
      { id: 'dinh_nui', at: V(0, 0, 6), look: V(-200, -120, 200), cam: V(6, 4, 12) },
      { id: 'tuong_phat', at: V(-6, 0, -12), look: V(BX, 24, BZ), cam: V(4, 3, 4) },
      { id: 'loi_ra', at: V(10, 0, -14), look: V(GX, 4, GZ), cam: V(4, 4, -20) },
    ],
    sky: [0x5aa0e0, 0xe8eef2], fog: [0xdfe6ec, 120, 900],
    light: { ambient: 1.6, sun: 1.8, sunColor: 0xfff4dc, sunDir: [-0.5, 0.9, 0.4] },
    shopSpots: [V(GX - 16, 0, GZ + 2), V(20, 0, 14), V(-10, 0, 30)],
  };
}

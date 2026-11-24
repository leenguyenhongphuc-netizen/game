// Khối dựng cho khu vui chơi: đu quay, tàu lượn, tháp rơi, nhà ma, sàn xe đụng, tháp máng trượt, hồ sóng, sông lười, cáp treo,
// cổng chào, nhà trò chơi. Phần đứng yên thêm bằng kit.add (gộp lưới); phần chuyển động gộp thành ít khối, vật lặp lại dùng InstancedMesh
// để cả khu chỉ thêm vài chục lần vẽ. Kiến trúc tự thiết kế theo thể loại, không chép công trình riêng của khu vui chơi có thật.
import * as THREE from 'three';
import { bakeColored } from '../scene/batch.ts';
import { Kit, ball, bead, box, cone, cyl, glow, grp, label, lampPost, palm, person } from '../sight/SightKit.ts';
import { baked, umbrella } from '../sight/sets/_extra.ts';

/** Dựng nhiều bản của một khối (cabin, xe, phao) chỉ bằng 1–2 lần vẽ. */
export function instanced(proto: THREE.Group, n: number): { meshes: THREE.InstancedMesh[]; set: (i: number, m: THREE.Matrix4) => void; done: () => void } {
  const b = bakeColored(proto, false), meshes: THREE.InstancedMesh[] = [];
  b.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { const im = new THREE.InstancedMesh(m.geometry, m.material as THREE.Material, n); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; meshes.push(im); } });
  return { meshes, set: (i, m) => { for (const im of meshes) im.setMatrixAt(i, m); }, done: () => { for (const im of meshes) im.instanceMatrix.needsUpdate = true; } };
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3(), E = new THREE.Euler();
const place = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) => M4.compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S1);

/** Ống/ray chạy theo đường cong (máng trượt, ray tàu lượn, dây cáp). */
export function tube(c: number | THREE.Material, curve: THREE.Curve<THREE.Vector3>, r: number, seg = 80, radial = 8, closed = false): THREE.Mesh {
  const m = typeof c === 'number' ? new THREE.MeshLambertMaterial({ color: c }) : c;
  return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, radial, closed), m);
}

// ---------------------------------------------------------------------------- đu quay
/** ctl.rot khác null thì vòng quay đứng theo góc đó (hoạt cảnh lên trò điều khiển: dừng cho khách lên, quay trọn một vòng). */
export function ferrisWheel(kit: Kit, x: number, z: number, ry: number, R: number, main: number, accent: number): { hub: THREE.Vector3; ctl: { rot: number | null } } {
  const ctl = { rot: null as number | null };
  const hubY = R + 3, g = grp(x, 0, z, ry);
  // chân chữ A hai bên, bệ, nhà ga lên cabin
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) { const leg = cyl(0xe8e8ee, sx * R * 0.32, hubY / 2, sz * 2.2, 0.35, hubY + 0.6); leg.rotation.z = sx * 0.33; g.add(leg); }
  g.add(cyl(0xcfd3dc, 0, hubY, 0, 0.7, 5.6).rotateX(Math.PI / 2), box(0xd9dde6, 0, 0.4, 0, R * 0.9, 0.8, 7), box(main, 0, 1.6, 4.6, 7, 2.4, 2.6), box(accent, 0, 3, 4.6, 7.6, 0.3, 3.2));
  kit.add(g);
  // vành, nan hoa: một khối xoay
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.28, 6, 56), new THREE.MeshLambertMaterial({ color: main })); wheel.add(rim, new THREE.Mesh(new THREE.TorusGeometry(R * 0.93, 0.16, 6, 56), new THREE.MeshLambertMaterial({ color: 0xf4f4f8 })));
  const n = 16;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, sp = cyl(0xf4f4f8, Math.cos(a) * R / 2, Math.sin(a) * R / 2, 0, 0.07, R); sp.rotation.z = a - Math.PI / 2; wheel.add(sp); }
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; wheel.add(bead(glow([0xffe066, 0xff8fc8, 0x7fe0c0][i % 3]), Math.cos(a) * R, Math.sin(a) * R, 0.4, 0.22)); }
  const wb = baked(wheel as THREE.Group); const holder = grp(x, hubY, z, ry); holder.add(wb); kit.live(holder);
  // cabin treo luôn thẳng đứng
  const cab = grp(0, 0, 0, 0, cyl(0xc0c6d0, 0, 0.4, 0, 0.05, 0.8), box(accent, 0, -0.7, 0, 1.7, 1.4, 1.5), box(0xbfe6ff, 0, -0.55, 0, 1.75, 0.7, 1.2), box(main, 0, 0.05, 0, 1.9, 0.18, 1.7));
  const inst = instanced(cab, n); for (const m of inst.meshes) kit.live(m);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  kit.onTick((t) => {
    const rot = ctl.rot ?? t * 0.12; wb.rotation.z = rot;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + rot, lx = Math.cos(a) * R, ly = Math.sin(a) * R; place(x + lx * cy, hubY + ly, z - lx * sy, ry); inst.set(i, M4); }
    inst.done();
  });
  return { hub: new THREE.Vector3(x, hubY, z), ctl };
}

// ---------------------------------------------------------------------------- tàu lượn
export function coasterCurve(x: number, z: number, ry: number, w: number, d: number, h: number): THREE.CatmullRomCurve3 {
  const pts: [number, number, number][] = [[-w / 2, 2, d / 2], [-w / 4, 2, d / 2], [0, h, d / 2], [w / 6, h * 0.95, d / 2], [w / 3, 3, d / 2 - 2], [w / 2, h * 0.55, d / 4], [w / 2 - 4, 4, 0],
    [w / 4, h * 0.7, -d / 3], [0, 3, -d / 2], [-w / 4, h * 0.45, -d / 2 + 2], [-w / 2, 2.5, -d / 4], [-w / 2 - 3, h * 0.35, d / 6]];
  const c = Math.cos(ry), s = Math.sin(ry);
  return new THREE.CatmullRomCurve3(pts.map(([px, py, pz]) => new THREE.Vector3(x + px * c + pz * s, py, z - px * s + pz * c)), true, 'catmullrom', 0.4);
}
/** Trả về đường ray và vị trí hiện tại của toa đầu (0..1 theo đường ray) để hoạt cảnh lên trò bám đúng đoàn tàu đang chạy. */
export function coaster(kit: Kit, x: number, z: number, ry: number, w: number, d: number, h: number, main: number, accent: number): { curve: THREE.CatmullRomCurve3; train: () => number; ctl: { u: number | null } } {
  const ctl = { u: null as number | null };
  const curve = coasterCurve(x, z, ry, w, d, h), railM = new THREE.MeshLambertMaterial({ color: main });
  // hai ray song song và các trụ đỡ
  const off = (k: number) => new THREE.CatmullRomCurve3(Array.from({ length: 160 }, (_, i) => { const u = i / 160, p = curve.getPointAt(u), tg = curve.getTangentAt(u); return new THREE.Vector3(p.x - tg.z * k, p.y, p.z + tg.x * k); }), true);
  kit.add(tube(railM, off(0.55), 0.12, 260, 5, true), tube(railM, off(-0.55), 0.12, 260, 5, true), tube(new THREE.MeshLambertMaterial({ color: 0x9aa3ad }), curve, 0.18, 260, 5, true));
  for (let i = 0; i < 46; i++) { const p = curve.getPointAt(i / 46); if (p.y > 2.6) kit.add(cyl(accent, p.x, p.y / 2 - 0.2, p.z, 0.16, p.y - 0.4)); }
  const st = curve.getPointAt(0.02); kit.add(box(0xd9dde6, st.x, 0.9, st.z, 6, 1.8, 6), box(accent, st.x, 4.2, st.z, 7, 0.3, 7), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cyl(0xf4f4f8, st.x + sx * 3, 2.6, st.z + sz * 3, 0.12, 3.4))));
  // đoàn tàu 4 toa
  const rider = person(3, 0, 0xff8a3d); rider.position.set(0, 0.25, 0.1); rider.scale.setScalar(0.55);
  const car = grp(0, 0, 0, 0, box(accent, 0, 0.45, 0, 1.6, 0.7, 2.1), box(main, 0, 0.9, -0.85, 1.6, 0.5, 0.3), rider);
  const inst = instanced(car, 4); for (const m of inst.meshes) kit.live(m);
  const look = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), mm = new THREE.Matrix4();
  let u = 0;
  kit.onTick((_t, dt) => {
    // nhanh khi xuống dốc, chậm khi lên dốc
    const p = curve.getPointAt(u), tg = curve.getTangentAt(u); u = ctl.u !== null ? ((ctl.u % 1) + 1) % 1 : (u + dt * (0.045 + Math.max(0, -tg.y) * 0.08)) % 1;
    for (let i = 0; i < 4; i++) { const uu = (u - i * 0.012 + 1) % 1, q = curve.getPointAt(uu); look.copy(q).add(curve.getTangentAt(uu)); mm.lookAt(look, q, up); M4.copy(mm).setPosition(q.x, q.y + 0.2, q.z); inst.set(i, M4); }
    inst.done(); void p;
  });
  return { curve, train: () => u, ctl };
}

// ---------------------------------------------------------------------------- tháp rơi
/** ctl.y/ctl.rot khác null thì vòng ghế đứng ở độ cao/góc đó (hoạt cảnh lên trò tự điều khiển kéo lên, rơi, hãm). */
export function dropTower(kit: Kit, x: number, z: number, H: number, main: number, accent: number, stripes = false): { ctl: { y: number | null; rot: number | null } } {
  const ctl = { y: null as number | null, rot: null as number | null };
  kit.add(cyl(0xd9dde6, x, 0.4, z, 4.2, 0.8), cyl(stripes ? 0xf4f4f8 : main, x, H / 2, z, 1.1, H));
  if (stripes) for (let y = 6; y < H; y += 10) kit.add(cyl(0xd2301e, x, y, z, 1.14, 4));
  kit.add(cone(accent, x, H + 1.4, z, 1.8, 2.8), bead(glow(0xff5a4a), x, H + 3, z, 0.4));
  const ring = baked(grp(0, 0, 0, 0, cyl(accent, 0, 0, 0, 2.6, 1.2), ...Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * 6.28; return grp(Math.cos(a) * 2.7, -0.3, Math.sin(a) * 2.7, -a, box(main, 0, 0, 0, 0.7, 1.1, 0.7), person(i, 0, [0xff8a3d, 0x4aa3d8, 0xffd23f][i % 3]).translateY(-1.3)); })));
  kit.live(ring); ring.position.set(x, 3, z);
  kit.onTick((t) => { const c = t % 14; ring.position.y = ctl.y ?? (c < 7 ? 3 + (H - 6) * (c / 7) : c < 9 ? H - 3 : c < 9.8 ? H - 3 - (H - 6) * ((c - 9) / 0.8) ** 2 : 3); ring.rotation.y = ctl.rot ?? (c < 7 ? t * 0.3 : ring.rotation.y); });
  kit.add(box(0xd9dde6, x + 5.2, 0.6, z, 3, 1.2, 6), box(accent, x + 5.2, 3, z, 3.6, 0.2, 6.6));
  return { ctl };
}

// ---------------------------------------------------------------------------- nhà ma / lâu đài tối
export function hauntedHouse(kit: Kit, x: number, z: number, ry: number, wall: number, roof: number, kind: 'lau_dai' | 'tau' | 'hang'): void {
  const g = grp(x, 0, z, ry);
  if (kind === 'tau') {
    g.add(ball(0x4a3524, 0, 2.6, 0, 6, 3, 15), box(0x3a2a1c, 0, 4.6, 0, 9, 0.4, 24), box(0x5a3d22, 0, 6.4, 8, 7, 3.4, 6), box(0x5a3d22, 0, 6, -9, 6, 2.6, 4));
    for (const mz of [-4, 3]) g.add(cyl(0x3a2a1c, 0, 13, mz, 0.3, 17), box(0xd9d2c0, 0.4, 14, mz, 0.1, 6, 5).rotateY(0.2), box(0xbfb59a, -0.3, 9, mz, 0.1, 3.6, 4).rotateY(-0.3));
    g.add(bead(glow(0x7fffb0), 3.3, 6.4, 8, 0.4), bead(glow(0x7fffb0), -3.3, 6.4, 6, 0.4));
  } else if (kind === 'hang') {
    for (let i = 0; i < 7; i++) g.add(ball([0x6f6a62, 0x7d776d, 0x5f5a53][i % 3], (i - 3) * 3.4, 4 + (i % 2) * 2, -2 + (i % 3), 4.4, 5 + (i % 2), 4));
    g.add(box(0x0d0d10, 0, 2, 3.4, 4.4, 4, 1), cone(0xd9e6ee, -1.2, 3.6, 3.6, 0.3, 1.4).rotateX(Math.PI), cone(0xd9e6ee, 1, 3.8, 3.6, 0.25, 1).rotateX(Math.PI), bead(glow(0x7fe0ff), 0, 1.2, 3.6, 0.5, 0.3, 0.1));
  } else {
    g.add(box(wall, 0, 5, 0, 16, 10, 10), box(roof, 0, 10.4, 0, 17, 0.8, 11));
    for (const sx of [-1, 1]) g.add(cyl(wall, sx * 8.5, 7, 4, 2.2, 14), cone(roof, sx * 8.5, 16, 4, 2.8, 5));
    g.add(cyl(wall, 0, 9, -3, 2.6, 18), cone(roof, 0, 20.5, -3, 3.2, 6), box(0x1a1012, 0, 2.2, 5.05, 3, 4.4, 0.2));
    for (let i = 0; i < 8; i++) g.add(box(glow(i % 3 ? 0xffd27a : 0x8fffb0), -6 + (i % 4) * 4, 4 + Math.floor(i / 4) * 3.4, 5.05, 1.1, 1.6, 0.1));
  }
  // hàng rào sắt và cây khô
  for (let i = -5; i <= 5; i++) if (Math.abs(i) > 1) g.add(cyl(0x2a2a30, i * 2, 0.9, 9, 0.06, 1.8), cone(0x2a2a30, i * 2, 1.9, 9, 0.1, 0.3));
  g.add(box(0x2a2a30, 0, 1.6, 9, 22, 0.08, 0.08), cyl(0x3a2e26, 9, 2.5, 7, 0.25, 5), cyl(0x3a2e26, 9.8, 4.6, 7, 0.1, 2.4).rotateZ(-0.7));
  kit.add(g);
  kit.live(label(kind === 'tau' ? 'Con tàu Ma' : kind === 'hang' ? 'Hang Ma' : 'Lâu đài Bóng Đêm', x, kind === 'lau_dai' ? 24 : 14, z, '#3a1f4a', 1));
}

// ---------------------------------------------------------------------------- sàn xe điện đụng
export function bumperArena(kit: Kit, x: number, z: number, ry: number, main: number, accent: number, name: string): void {
  const W = 18, D = 12, g = grp(x, 0, z, ry);
  g.add(box(0x5a6270, 0, 0.15, 0, W, 0.3, D), box(accent, 0, 0.45, D / 2, W, 0.5, 0.3), box(accent, 0, 0.45, -D / 2, W, 0.5, 0.3), box(accent, W / 2, 0.45, 0, 0.3, 0.5, D), box(accent, -W / 2, 0.45, 0, 0.3, 0.5, D));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0xf4f4f8, sx * (W / 2 - 0.3), 3, sz * (D / 2 - 0.3), 0.18, 6));
  g.add(box(main, 0, 6.1, 0, W + 1, 0.4, D + 1), box(0x3a3f48, 0, 5.85, 0, W - 1, 0.1, D - 1));
  for (let i = 0; i < 12; i++) g.add(bead(glow([0xffe066, 0xff8fc8, 0x7fe0c0][i % 3]), -W / 2 + 0.5 + (i * W) / 12, 6.4, D / 2 + 0.5, 0.18));
  kit.add(g); kit.live(label(name, x, 8.4, z, '#d2301e', 0.9));
  const car = grp(0, 0, 0, 0, box(0x2a2a30, 0, 0.35, 0, 1.7, 0.3, 2.2), box(0xffffff, 0, 0.7, 0, 1.5, 0.5, 1.9), cyl(0x9aa3ad, 0, 2.5, -0.6, 0.04, 3.2), person(2, 0, 0xffd23f));
  car.children[3].position.set(0, 0.35, 0.2); car.children[3].scale.setScalar(0.6);
  const colors = [main, accent, 0x7ccf4f, 0xffd23f, 0x4aa3d8, 0xff8fc8], n = 6, inst = instanced(car, n);
  // mỗi xe một màu: dùng màu thể hiện của InstancedMesh
  for (const m of inst.meshes) { for (let i = 0; i < n; i++) m.setColorAt(i, new THREE.Color(colors[i])); kit.live(m); }
  const c = Math.cos(ry), s = Math.sin(ry);
  kit.onTick((t) => {
    for (let i = 0; i < n; i++) { const a = t * (0.5 + i * 0.07) + i * 1.3, lx = Math.cos(a) * (W / 2 - 2.2) * (0.6 + 0.4 * Math.sin(t * 0.3 + i)), lz = Math.sin(a * 1.3) * (D / 2 - 1.8); place(x + lx * c + lz * s, 0.3, z - lx * s + lz * c, ry + a + i); inst.set(i, M4); }
    inst.done();
  });
}

// ---------------------------------------------------------------------------- tháp máng trượt nước
/** Trả về đường trượt của làn đầu (người trượt chạy theo làn này) và tâm bể đón. */
export function slideTower(kit: Kit, x: number, z: number, ry: number, colors: number[], lanes: number): { lane: THREE.CatmullRomCurve3; pool: THREE.Vector3 } {
  const H = 16, g = grp(x, 0, z, ry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0xe8dcc4, sx * 3, H / 2, sz * 3, 0.3, H));
  g.add(box(0xd9c8a8, 0, H, 0, 7.4, 0.4, 7.4), box(0x2ec4b6, 0, H + 2.6, 0, 7.8, 0.2, 7.8), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cyl(0xf4f4f8, sx * 3.6, H + 1.3, sz * 3.6, 0.1, 2.6))));
  // cầu thang lên tháp: bậc chiếu nghỉ so le hai bên
  for (let k = 0; k < 8; k++) g.add(box(0xd9c8a8, k % 2 ? 4.2 : -4.2, (k + 1) * 2, -3.6, 1.6, 0.2, 2));
  // bể đón
  g.add(box(0xe8e4d8, 0, 0.3, 22, 16, 0.6, 12), box(0x37b6e8, 0, 0.62, 22, 14.4, 0.05, 10.4));
  kit.add(g);
  const c = Math.cos(ry), s = Math.sin(ry), W = (lx: number, ly: number, lz: number) => new THREE.Vector3(x + lx * c + lz * s, ly, z - lx * s + lz * c);
  for (let i = 0; i < lanes; i++) {
    const sx = (i - (lanes - 1) / 2) * 1.6, spiral = i % 2 === 0;
    const pts = spiral ? [W(sx, H, 3.6), W(sx + 5, H - 3, 6), W(sx + 2, H - 6, 11), W(sx - 4, H - 9, 9), W(sx - 3, H - 12, 14), W(sx * 0.6, 2.5, 18), W(sx * 0.6, 1, 21)]
      : [W(sx, H, 3.6), W(sx, H - 4, 8), W(sx, H - 9, 12), W(sx, 4, 16), W(sx, 1, 19)];
    kit.add(tube(colors[i % colors.length], new THREE.CatmullRomCurve3(pts), 0.75, 70, 8));
  }
  // người trượt xuống: một khối nhỏ chạy theo làn đầu
  const rider = baked(grp(0, 0, 0, 0, ball(0xffd23f, 0, 0.3, 0, 0.5, 0.25, 0.9), ball(0xf2c69c, 0, 0.55, -0.5, 0.25))); kit.live(rider);
  const lane0 = new THREE.CatmullRomCurve3([W(-(lanes - 1) * 0.8, H + 0.6, 3.6), W(-(lanes - 1) * 0.8 + 5, H - 2.4, 6), W(-(lanes - 1) * 0.8 + 2, H - 5.4, 11), W(-(lanes - 1) * 0.8 - 4, H - 8.4, 9), W(-(lanes - 1) * 0.8 - 3, H - 11.4, 14), W(-(lanes - 1) * 0.5, 3.1, 18), W(-(lanes - 1) * 0.5, 1.4, 21)]);
  kit.onTick((t) => { const u = (t * 0.22) % 1.4; rider.visible = u < 1; if (u < 1) rider.position.copy(lane0.getPointAt(u)); });
  return { lane: lane0, pool: W(0, 0.62, 22) };
}

// ---------------------------------------------------------------------------- hồ tạo sóng
export function wavePool(kit: Kit, x: number, z: number, ry: number, W: number, D: number): void {
  const g = grp(x, 0, z, ry);
  g.add(box(0xf4e6c0, 0, 0.1, D / 2 + 3, W + 6, 0.3, 6), box(0xe8e4d8, 0, 0.2, 0, W + 2, 0.4, D + 2), box(0x37b6e8, 0, 0.42, 0, W, 0.05, D), box(0x2a8fc4, 0, 0.43, -D / 3, W, 0.05, D / 3), box(0xd9dde6, 0, 2.5, -D / 2 - 1, W + 2, 5, 1.2));
  for (let i = 0; i < 6; i++) { const u = umbrella([0xe2573c, 0x2ec4b6, 0xffd23f][i % 3]); u.position.set(-W / 2 + 2 + i * (W - 4) / 5, 0.2, D / 2 + 3.4); g.add(u); }
  kit.add(g);
  const c = Math.cos(ry), s = Math.sin(ry);
  const crest = baked(grp(0, 0, 0, 0, box(0xffffff, 0, 0, 0, W - 0.4, 0.14, 0.9), box(0x9fe0f8, 0, -0.04, 0.9, W - 0.4, 0.1, 1.4)));
  const crests = [0, 1, 2].map(() => { const o = crest.clone(); kit.live(o); return o; });
  const swimmers = instanced(grp(0, 0, 0, 0, ball(0xf2c69c, 0, 0.35, 0, 0.22), cyl([0xff8fc8][0], 0, 0.1, 0, 0.6, 0.15)), 10); for (const m of swimmers.meshes) kit.live(m);
  kit.onTick((t) => {
    crests.forEach((o, i) => { const k = ((t * 0.12 + i / 3) % 1), lz = -D / 2 + 1 + k * (D - 2); o.position.set(x + lz * s, 0.5 + Math.sin(k * Math.PI) * 0.25, z + lz * c); o.rotation.y = ry; o.scale.y = 1 + Math.sin(k * Math.PI); });
    for (let i = 0; i < 10; i++) { const lx = -W / 2 + 2 + ((i * 3.7) % (W - 4)), lz = -D / 3 + ((i * 2.3) % (D * 0.7)), y = 0.35 + Math.sin(t * 1.6 + lz * 0.6) * 0.18; place(x + lx * c + lz * s, y, z - lx * s + lz * c, i); swimmers.set(i, M4); }
    swimmers.done();
  });
}

// ---------------------------------------------------------------------------- sông lười
export function lazyRiver(kit: Kit, x: number, z: number, R: number): void {
  kit.add(cyl(0xe8e4d8, x, 0.2, z, R + 3, 0.4), cyl(0x37b6e8, x, 0.42, z, R + 2, 0.05), cyl(0x8bc97a, x, 0.5, z, R - 2, 0.6), cyl(0xe8e4d8, x, 0.45, z, R - 1.6, 0.5));
  // đảo giữa: đá, thác nhỏ, dừa
  kit.add(ball(0x8d8478, x, 2, z, 4, 3, 3.4), ball(0x7d776d, x + 3, 1.4, z - 2, 2.6, 2, 2.4), box(0xbfe6ff, x - 1.5, 2.4, z + 3.2, 2, 3.6, 0.2));
  for (let i = 0; i < 5; i++) { const p = palm(() => (i * 0.37) % 1, 6 + (i % 2)); p.position.set(x + Math.cos(i * 1.3) * (R - 4), 0.8, z + Math.sin(i * 1.3) * (R - 4)); kit.add(p); }
  const ring = instanced(grp(0, 0, 0, 0, new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.28, 6, 14).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff })), ball(0xf2c69c, 0, 0.6, 0, 0.25), cyl(0x4aa3d8, 0, 0.3, 0, 0.3, 0.5)), 9);
  for (const m of ring.meshes) { for (let i = 0; i < 9; i++) m.setColorAt(i, new THREE.Color([0xff8a3d, 0xffd23f, 0x2ec4b6][i % 3])); kit.live(m); }
  kit.onTick((t) => { for (let i = 0; i < 9; i++) { const a = t * 0.08 + (i / 9) * Math.PI * 2; place(x + Math.cos(a) * R, 0.5 + Math.sin(t * 2 + i) * 0.06, z + Math.sin(a) * R, -a + i); ring.set(i, M4); } ring.done(); });
}

// ---------------------------------------------------------------------------- cáp treo
/** Ga đi tại (x, z), dây cáp vươn về hướng `toward` (điểm ga đến xa). Trả về đường cáp để hoạt cảnh đi theo. */
export function cableCar(kit: Kit, x: number, z: number, to: THREE.Vector3, main: number, accent: number): { curve: THREE.CatmullRomCurve3; up: THREE.CatmullRomCurve3; ry: number } {
  const from = new THREE.Vector3(x, 9, z), dir = to.clone().sub(from), len = dir.length(), ry = Math.atan2(dir.x, dir.z);
  kit.add(grp(x, 0, z, ry, box(0xf4f4f8, 0, 1, 0, 11, 2, 13), ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => cyl(main, sx * 4.8, 5, sz * 5.6, 0.45, 8))), box(0xbfe6ff, 0, 5, 0, 9, 4, 11),
    box(main, 0, 8.4, 0, 12, 0.8, 14), box(accent, 0, 9.2, 0, 10, 0.8, 12), cone(accent, 0, 10.6, 0, 6, 2.2), box(0xd2301e, 0, 1.4, -6.6, 4, 2.4, 0.2), bead(glow(0xffe066), 0, 12, 0, 0.5)));
  // trụ cáp
  const towers = Math.max(2, Math.floor(len / 120)), pts: THREE.Vector3[] = [from.clone()];
  for (let i = 1; i <= towers; i++) { const f = i / (towers + 1), p = from.clone().lerp(to, f); const ground = Math.max(0, p.y - 26 - 8 * Math.sin(f * 3)); kit.add(cyl(0xd9dde6, p.x, ground + (p.y + 2 - ground) / 2, p.z, 0.8, p.y + 2 - ground), box(0xd9dde6, p.x, p.y + 2, p.z, 6, 0.6, 1).rotateY(ry + Math.PI / 2)); pts.push(new THREE.Vector3(p.x, p.y + 1.5, p.z)); }
  pts.push(to.clone());
  const curve = new THREE.CatmullRomCurve3(pts);
  const sideOff = (k: number) => new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p.x + Math.cos(ry) * k, p.y, p.z - Math.sin(ry) * k)));
  kit.add(tube(0x3a3f48, sideOff(1.8), 0.06, 60, 4), tube(0x3a3f48, sideOff(-1.8), 0.06, 60, 4));
  kit.add(grp(to.x, to.y - 9, to.z, ry, box(0xe8e8ee, 0, 4, 0, 10, 8, 12), box(main, 0, 8.4, 0, 11, 0.8, 13)));
  const cab = grp(0, 0, 0, 0, cyl(0x9aa3ad, 0, 1.2, 0, 0.05, 2.4), box(main, 0, -0.8, 0, 2.2, 2, 2.2), box(0xbfe6ff, 0, -0.6, 0, 2.26, 1, 1.8), box(accent, 0, 0.25, 0, 2.3, 0.2, 2.3));
  const n = 10, inst = instanced(cab, n); for (const m of inst.meshes) kit.live(m);
  const sa = sideOff(1.8), sb = sideOff(-1.8);
  kit.onTick((t) => { for (let i = 0; i < n; i++) { const up = i % 2 === 0, u = ((t * 0.02 + i / n) % 1), q = (up ? sa : sb).getPointAt(up ? u : 1 - u); place(q.x, q.y - 1.3, q.z, ry); inst.set(i, M4); } inst.done(); });
  return { curve, up: sa, ry };
}

// ---------------------------------------------------------------------------- cổng chào, nhà trò chơi, quầy, trang trí
export function gate(kit: Kit, x: number, z: number, ry: number, name: string, main: number, accent: number, roof: number, chain: 'moon_world' | 'bim_wonder'): void {
  const g = grp(x, 0, z, ry);
  for (const sx of [-1, 1]) g.add(cyl(main, sx * 9, 5, 0, 1.4, 10), cone(roof, sx * 9, 11.6, 0, 2, 3.4), bead(glow(accent), sx * 9, 13.6, 0, 0.5));
  g.add(box(main, 0, 10.6, 0, 18, 1.4, 1.2), box(accent, 0, 11.5, 0, 19, 0.4, 1.6));
  // biểu tượng riêng: trăng lưỡi liềm cho Moon World, ngôi sao năm cánh tròn cho Bim Wonder
  if (chain === 'moon_world') g.add(new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.55, 8, 24, Math.PI * 1.3).rotateZ(0.9), glow(0xffe680)).translateY(13.4));
  else g.add(ball(glow(0xff9ec4), 0, 13.6, 0, 1.8, 1.8, 0.5), ...[0, 1, 2, 3, 4].map((i) => { const a = (i / 5) * 6.28; return bead(glow(0xfff2a8), Math.cos(a) * 2.4, 13.6 + Math.sin(a) * 2.4, 0, 0.5); }));
  // quầy vé và cửa soát vé
  for (const sx of [-1, 1]) g.add(box(0xf4f4f8, sx * 5, 1.4, -3, 3.4, 2.8, 2.4), box(accent, sx * 5, 3, -3, 3.8, 0.3, 2.8), box(0xbfe6ff, sx * 5, 1.7, -1.78, 2.6, 1, 0.05));
  for (let i = -3; i <= 3; i++) g.add(box(0xc0c6d0, i * 1.2, 0.5, 0.6, 0.18, 1, 0.8));
  kit.add(g); kit.live(label(name, x, 16.4, z, chain === 'moon_world' ? '#2a3f99' : '#9c2a55', 1.2));
}
export function arcadeHall(kit: Kit, x: number, z: number, ry: number, main: number, accent: number): void {
  const g = grp(x, 0, z, ry);
  g.add(box(0x2a2340, 0, 3.5, 0, 16, 7, 10), box(main, 0, 7.4, 0, 17, 0.8, 11), box(0xbfe6ff, 0, 2.2, 5.05, 10, 3.6, 0.1));
  for (let i = 0; i < 14; i++) g.add(bead(glow([0xff5ac8, 0x5ae0ff, 0xffe066][i % 3]), -7.6 + i * 1.17, 6.6, 5.2, 0.22));
  // máy gắp thú, rổ bóng thấy qua kính
  for (let i = 0; i < 4; i++) g.add(box([0xff8fc8, 0x7fe0c0, 0xffd23f, 0x9b7fd6][i], -4.5 + i * 3, 1.3, 3.6, 1.6, 2.6, 1.4), box(0xbfe6ff, -4.5 + i * 3, 2, 4.32, 1.3, 1, 0.05));
  kit.add(g); kit.live(label('Khu trò chơi kỹ năng · đổi quà', x, 9.6, z, '#5a2a8a', 0.95));
}
export function kiosk(kit: Kit, x: number, z: number, ry: number, c: number, text?: string): void {
  kit.add(grp(x, 0, z, ry, box(0xf4f1ea, 0, 1.2, 0, 2.6, 2.4, 2), box(c, 0, 2.6, 0, 3.2, 0.3, 2.6), cone(c, 0, 3.4, 0, 1.6, 1), box(0xffd23f, 0, 1.4, 1.02, 2, 0.5, 0.05)));
  if (text) kit.live(label(text, x, 4.8, z, '#7a4a22', 0.55));
}
export function balloonCart(kit: Kit, x: number, z: number): void {
  kit.add(box(0xe2573c, x, 0.6, z, 1.2, 0.8, 0.8), cyl(0x9aa3ad, x, 1.6, z, 0.03, 2));
  const cols = [0xff5a4a, 0xffd23f, 0x7fe0c0, 0xff8fc8, 0x6ec8ff, 0xb59bff];
  for (let i = 0; i < 9; i++) kit.add(ball(cols[i % 6], x + Math.cos(i) * 0.6, 3 + (i % 3) * 0.4, z + Math.sin(i) * 0.6, 0.32, 0.4, 0.32));
}
export function flowerBed(kit: Kit, x: number, z: number, w: number, d: number): void {
  kit.add(box(0x8a6a4a, x, 0.2, z, w, 0.4, d));
  const cols = [0xe85aa0, 0xffd23f, 0xff8a3d, 0xf3ead2, 0xb59bff];
  for (let i = 0; i < Math.round(w * d / 2); i++) kit.add(bead(cols[i % 5], x - w / 2 + 0.3 + ((i * 1.37) % (w - 0.6)), 0.5, z - d / 2 + 0.3 + ((i * 0.83) % (d - 0.6)), 0.22));
}
export { lampPost };

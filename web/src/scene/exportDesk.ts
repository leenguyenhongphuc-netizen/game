// Quầy "Đại lý xuất khẩu" ở đầu xóm: mái che sọc xanh trắng, quầy gỗ, chồng thùng hàng xuất, một thùng container nhỏ
// và nhân viên đại lý đứng sau quầy vẫy tay. Người chơi tới trước quầy thì World báo ngữ cảnh 'export-desk'
// để giao diện mở hội thoại → đơn của công ty xuất nhập khẩu hoặc tạo lô xuất.
import * as THREE from 'three';
import { GEO, mat, mesh } from './plants.ts';

export interface DeskPerson { root: THREE.Group; armR: THREE.Group; armL: THREE.Group }
export interface ExportDesk {
  group: THREE.Group;
  /** Hình chữ nhật chặn đi xuyên [x0, x1, z0, z1] theo toạ độ thế giới. */
  collider: [number, number, number, number];
  /** Điểm người chơi đứng nói chuyện (trước quầy). */
  spot: { x: number; z: number };
  update(t: number): void;
}

/** Toạ độ thế giới của quầy: khe giữa vườn nhà và lô bên trái, sát mép đường làng, gần chỗ người chơi xuất hiện. */
export const EXPORT_DESK_POS = { x: -12, z: 9.9 };

/**
 * Dựng quầy. `makePerson`, `makeLabel`, `bake` truyền từ World để dùng chung đúng kiểu nhân vật, biển chữ và cách gộp lưới.
 * Toàn bộ phần tĩnh gộp thành một cụm (ít lần vẽ); chỉ người đứng quầy là động.
 */
export function buildExportDesk(
  makePerson: () => DeskPerson,
  makeLabel: (text: string) => THREE.Object3D,
  bake: (root: THREE.Object3D) => THREE.Group,
  night = false,
): ExportDesk {
  const { x, z } = EXPORT_DESK_POS;
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const st = new THREE.Group();
  const wood = mat(0xb9854f), woodDk = mat(0x7a5232), navy = mat(0x1f4e8c), white = mat(0xfdf6e6), steel = mat(0x8c96a3), crate = mat(0xd6a76a), strap = mat(0x6b4a2a);
  // nền lát gạch dưới quầy
  st.add(mesh(GEO.box, mat(0xd9cbb0), 0, 0.03, 0, 3.6, 0.06, 2.6));
  // quầy gỗ có mặt trước sơn xanh đại lý
  st.add(mesh(GEO.box, wood, 0, 0.55, 0.45, 2.6, 1.1, 0.6));
  st.add(mesh(GEO.box, navy, 0, 0.6, 0.76, 2.4, 0.7, 0.04));
  st.add(mesh(GEO.box, woodDk, 0, 1.13, 0.45, 2.8, 0.07, 0.75)); // mặt quầy
  // sổ sách, cân nhỏ và hộp mẫu hàng trên quầy
  st.add(mesh(GEO.box, white, -0.8, 1.2, 0.45, 0.42, 0.05, 0.3), mesh(GEO.box, mat(0xe8412f), -0.8, 1.235, 0.45, 0.4, 0.02, 0.06));
  st.add(mesh(GEO.cyl, steel, 0.75, 1.24, 0.42, 0.18, 0.1, 0.18), mesh(GEO.box, steel, 0.75, 1.32, 0.42, 0.34, 0.02, 0.34));
  st.add(mesh(GEO.box, crate, 0.2, 1.27, 0.5, 0.36, 0.22, 0.26));
  // bốn cột và mái che sọc xanh trắng
  for (const px of [-1.55, 1.55]) for (const pz of [-0.95, 1.0]) st.add(mesh(GEO.cyl, woodDk, px, 1.35, pz, 0.07, 2.7, 0.07));
  for (let i = 0; i < 8; i++) {
    const stripe = mesh(GEO.box, i % 2 ? white : navy, -1.6 + 0.2 + i * 0.4, 2.78 + (i % 2) * 0.001, 0.02, 0.4, 0.06, 2.4);
    stripe.rotation.x = -0.12; st.add(stripe);
  }
  for (let i = 0; i < 8; i++) st.add(mesh(GEO.cone, i % 2 ? white : navy, -1.4 + i * 0.4, 2.55, 1.3, 0.2, 0.3, 0.06).rotateX(Math.PI)); // diềm tam giác
  // chồng thùng hàng xuất có đai, kê pallet
  st.add(mesh(GEO.box, woodDk, -2.4, 0.07, -0.4, 1.3, 0.14, 1.1));
  for (const [cx, cy, cz] of [[-2.7, 0.44, -0.6], [-2.1, 0.44, -0.6], [-2.7, 0.44, -0.05], [-2.1, 0.44, -0.05], [-2.4, 0.98, -0.35]] as const) {
    st.add(mesh(GEO.box, crate, cx, cy, cz, 0.56, 0.54, 0.52), mesh(GEO.box, strap, cx, cy, cz, 0.58, 0.06, 0.54));
  }
  // thùng container 10 feet sơn đỏ phía sau, có gân sóng
  const cont = mat(0xc8452f), contDk = mat(0x9a3322);
  st.add(mesh(GEO.box, cont, 2.4, 0.75, -0.6, 1.4, 1.5, 2.2));
  for (let i = 0; i < 9; i++) st.add(mesh(GEO.box, contDk, 1.69, 0.75, -1.55 + i * 0.24, 0.03, 1.38, 0.08));
  st.add(mesh(GEO.box, mat(0xf2f2f2), 1.68, 1.22, -0.6, 0.02, 0.22, 1.5)); // dải chữ trắng
  // cột cờ nhỏ với cờ đuôi nheo các thị trường
  st.add(mesh(GEO.cyl, steel, 1.55, 3.3, 1.0, 0.03, 1.1, 0.03));
  const flagCols = [0xe8412f, 0xffd23f, 0x2f7bd8, 0x3fae5c];
  for (let i = 0; i < 4; i++) st.add(mesh(GEO.box, mat(flagCols[i]), 1.55 + 0.18, 3.75 - i * 0.12, 1.0, 0.36, 0.1, 0.02));
  const baked = bake(st);
  baked.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(baked);
  // biển tên
  const sign = makeLabel('Đại lý xuất khẩu');
  sign.position.set(0, 3.45, 0.6); group.add(sign);
  // đèn quầy buổi tối
  if (night) { const lamp = new THREE.PointLight(0xfff0c8, 14, 9, 1.6); lamp.position.set(0, 2.4, 0.4); group.add(lamp); }
  // nhân viên đại lý: áo xanh, đứng sau quầy nhìn ra đường
  const person = makePerson();
  person.root.position.set(0, 0, -0.25); group.add(person.root);
  // vòng sáng dưới chân chỗ người chơi đứng nói chuyện
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.55, depthWrite: false }));
  ring.position.set(0, 0.08, 1.7); ring.renderOrder = 2; group.add(ring);
  return {
    group,
    collider: [x - 1.8, x + 1.8, z - 1.3, z + 0.85],
    spot: { x, z: z + 1.7 },
    update(t: number) {
      // vẫy tay chào khách mỗi vài giây, còn lại đứng ghi sổ
      const wave = Math.sin(t * 0.7) > 0.6;
      person.armR.rotation.z = wave ? -2.4 + Math.sin(t * 7) * 0.35 : -0.15;
      person.armL.rotation.x = wave ? 0 : -0.9 + Math.sin(t * 3) * 0.08;
      ring.scale.setScalar(1 + Math.sin(t * 4) * 0.06);
    },
  };
}

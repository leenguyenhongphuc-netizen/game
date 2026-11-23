// Tám kiểu nhà mua ở trung tâm mua sắm và mười sáu món nội thất, sân vườn (shared/shop.ts).
// Nhà đặt tâm ở gốc toạ độ, mặt tiền quay về +z, nằm gọn trong nền 6,6 × 4,6 như ba kiểu nhà sẵn có.
import * as THREE from 'three';
import { GEO, mat, mesh } from './plants.ts';
import { buildHouse } from './custom3d.ts';

/** Lăng trụ tam giác đơn vị: đáy rộng 1 theo x, cao 1 theo y, dài 1 theo z (nóc chạy dọc z). */
const PRISM = (() => { const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); g.translate(0, 0, -0.5); return g; })();
/** Mái hai dốc: nóc chạy dọc trục x (alongX) hoặc dọc trục z. */
function gable(m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, alongX = true): THREE.Mesh {
  const o = alongX ? mesh(PRISM, m, x, y, z, d, h, w) : mesh(PRISM, m, x, y, z, w, h, d);
  if (alongX) o.rotation.y = Math.PI / 2;
  return o;
}
/** Mái bốn dốc (chóp cụt bốn cạnh) phủ nền w × d. */
function hip(m: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, top = 0.3): THREE.Mesh {
  const o = mesh(new THREE.CylinderGeometry(top * Math.SQRT1_2, Math.SQRT1_2, 1, 4, 1), m, x, y + h / 2, z, w, h, d); o.rotation.y = Math.PI / 4; return o;
}
const shade = (c: number, k: number) => new THREE.Color(c).multiplyScalar(k).getHex();

export const SHOP_HOUSES = ['nha_cap_bon', 'nha_ong', 'nha_ruong', 'nha_dai', 'nha_rong', 'nha_trinh_tuong', 'nha_noi', 'biet_thu_vuon'];

/** Nhà của thửa: kiểu mua ở cửa hàng (nếu đang dùng) hoặc ba kiểu sẵn có. */
export function buildHomeHouse(type: string, wall: number, roof: number, night: boolean): THREE.Group {
  if (!SHOP_HOUSES.includes(type)) return buildHouse(type, wall, roof, night);
  const h = new THREE.Group();
  const glass = night ? mat(0xffe08a, { emissive: 0xffc24a }) : mat(0x9fd8f0, { rough: 0.3 });
  const white = mat(0xfdf9ef), stone = mat(0xcfc6b4);
  const win = (x: number, y: number, z: number, w = 0.8, hh = 0.8, frame = white) => h.add(mesh(GEO.box, glass, x, y, z, w, hh, 0.06), mesh(GEO.box, frame, x, y, z + 0.035, w + 0.14, 0.07, 0.04), mesh(GEO.box, frame, x, y, z + 0.035, 0.07, hh + 0.1, 0.04), mesh(GEO.box, frame, x, y - hh / 2 - 0.05, z + 0.05, w + 0.2, 0.08, 0.1));
  const door = (x: number, z: number, w: number, hh: number, m: THREE.Material, y0 = 0) => h.add(mesh(GEO.box, m, x, y0 + hh / 2, z, w, hh, 0.08), mesh(GEO.ball, mat(0xffd23f), x + w * 0.32, y0 + hh * 0.5, z + 0.06, 0.05));
  switch (type) {
    case 'nha_cap_bon': { // nhà một tầng tường quét vôi, mái tôn xanh hai dốc lệch, hiên tôn trên cột sắt, bồn nước sau nhà
      const w = mat(0xe4ddd0), tin = mat(0x4f86c0), tinD = mat(0x3d6a9c);
      h.add(mesh(GEO.box, stone, 0, 0.12, 0.1, 6.4, 0.24, 4.4), mesh(GEO.box, w, 0, 1.45, -0.3, 5.6, 2.4, 3.2), mesh(GEO.box, mat(0x8fa9b8), 0, 0.5, 1.31, 5.62, 0.5, 0.03)); // chân tường sơn xanh
      h.add(gable(tin, 0, 2.65, -0.3, 6.1, 0.95, 3.7));
      for (let x = -2.9; x <= 2.9; x += 0.42) h.add(mesh(GEO.box, tinD, x, 3.02, 0.72, 0.05, 0.04, 1.95).rotateX(0.47), mesh(GEO.box, tinD, x, 3.02, -1.32, 0.05, 0.04, 1.95).rotateX(-0.47)); // sóng tôn
      h.add(mesh(GEO.box, tin, 0, 2.5, 2.0, 6.0, 0.06, 1.5).rotateX(0.12)); for (const x of [-2.8, 2.8]) h.add(mesh(GEO.cyl, mat(0x8f97a3), x, 1.25, 2.6, 0.05, 2.3, 0.05)); // hiên tôn
      door(0, 1.33, 1.1, 1.9, mat(0x3f6f8f), 0.24); win(-1.8, 1.55, 1.32, 1.0, 0.9, mat(0x3f6f8f)); win(1.8, 1.55, 1.32, 1.0, 0.9, mat(0x3f6f8f));
      for (const x of [-1.8, 1.8]) for (let k = -2; k <= 2; k++) h.add(mesh(GEO.box, mat(0x6b7480), x + k * 0.2, 1.55, 1.38, 0.025, 0.9, 0.025)); // song sắt
      h.add(mesh(GEO.cyl, mat(0xdfe6ee, { rough: 0.3 }), 2.2, 3.55, -1.2, 0.42, 0.9, 0.42), mesh(GEO.box, mat(0x8f97a3), 2.2, 3.05, -1.2, 0.9, 0.1, 0.9)); // bồn inox
      h.add(mesh(GEO.box, stone, 0, 0.06, 2.6, 6.2, 0.12, 1.2), mesh(GEO.box, mat(0xc0392b), -2.5, 0.42, 2.5, 0.5, 0.3, 0.9), mesh(GEO.cyl, mat(0x2b2f38), -2.5, 0.3, 2.9, 0.26, 0.1, 0.26).rotateZ(Math.PI / 2)); // xe máy dựng hiên (hình khối)
      break;
    }
    case 'nha_ong': { // nhà phố hẹp ba tầng: cửa cuốn tầng trệt, ban công từng tầng, sân thượng có tum và bồn nước
      const w = mat(0xf1e4c8), trim = mat(0xd9c49a), rail = mat(0x4a4f5a);
      h.add(mesh(GEO.box, stone, 0, 0.1, 0.2, 4.2, 0.2, 4.4), mesh(GEO.box, w, 0, 3.7, -0.2, 3.6, 7.0, 3.4));
      h.add(mesh(GEO.box, mat(0x8f97a3), -0.55, 1.2, 1.52, 2.0, 2.0, 0.06)); for (let y = 0.4; y < 2.2; y += 0.22) h.add(mesh(GEO.box, mat(0x7a828e), -0.55, y, 1.56, 2.0, 0.03, 0.02)); // cửa cuốn
      door(1.15, 1.52, 0.8, 1.9, mat(0x6b4a2f), 0.2);
      for (const fy of [2.5, 4.8]) { // hai tầng trên: ban công, cửa kính, lan can
        h.add(mesh(GEO.box, trim, 0, fy, 1.95, 3.7, 0.14, 1.0));
        h.add(mesh(GEO.box, rail, 0, fy + 0.86, 2.42, 3.7, 0.06, 0.06)); for (let x = -1.8; x <= 1.8; x += 0.3) h.add(mesh(GEO.box, rail, x, fy + 0.46, 2.42, 0.04, 0.8, 0.04));
        for (const sx of [-1, 1]) h.add(mesh(GEO.box, rail, sx * 1.83, fy + 0.86, 1.95, 0.06, 0.06, 1.0));
        h.add(mesh(GEO.box, glass, -0.6, fy + 1.1, 1.52, 1.5, 1.9, 0.06), mesh(GEO.box, white, -0.6, fy + 1.1, 1.56, 0.07, 1.9, 0.04)); win(1.05, fy + 1.3, 1.52, 0.8, 1.1);
        h.add(mesh(GEO.cyl, mat(0xc9774e), -1.5, fy + 0.27, 2.2, 0.16, 0.26, 0.16), mesh(GEO.ball, mat(0x5cb85f), -1.5, fy + 0.56, 2.2, 0.22));
      }
      h.add(mesh(GEO.box, trim, 0, 7.25, -0.2, 3.9, 0.16, 3.7), mesh(GEO.box, trim, 0, 7.62, 1.55, 3.8, 0.6, 0.12)); for (const sx of [-1, 1]) h.add(mesh(GEO.box, trim, sx * 1.86, 7.62, -0.2, 0.12, 0.6, 3.6)); // lan can sân thượng
      h.add(mesh(GEO.box, w, 0.7, 8.2, -1.1, 2.0, 1.8, 1.5), mesh(GEO.box, trim, 0.7, 9.16, -1.1, 2.3, 0.12, 1.8), mesh(GEO.cyl, mat(0xdfe6ee, { rough: 0.3 }), 0.7, 9.75, -1.1, 0.45, 1.0, 0.45));
      h.add(mesh(GEO.box, mat(0x2f7d4f), -0.6, 2.36, 1.56, 1.6, 0.36, 0.05), mesh(GEO.box, white, -0.6, 2.36, 1.59, 1.2, 0.1, 0.02)); // biển hiệu
      break;
    }
    case 'nha_ruong': { // nhà rường Huế: nền đá cao, hàng cột gỗ lim, vách ván chạm, mái ngói liệt thấp rộng, bờ nóc cong
      const wood = mat(0x6b3f24), woodD = mat(0x4a2a16), tile = mat(0x9a4a30), tileD = mat(0x7a3a26);
      h.add(mesh(GEO.box, mat(0xbdb39c), 0, 0.22, 0.1, 6.6, 0.44, 4.5), mesh(GEO.box, mat(0xd2c9b2), 0, 0.14, 2.55, 2.6, 0.28, 0.5), mesh(GEO.box, mat(0xd2c9b2), 0, 0.07, 2.95, 3.0, 0.14, 0.4)); // nền, tam cấp
      h.add(mesh(GEO.box, wood, 0, 1.4, -0.5, 5.9, 1.9, 2.6));
      for (const x of [-2.9, -1.75, -0.6, 0.6, 1.75, 2.9]) { h.add(mesh(GEO.cyl, woodD, x, 1.35, 1.75, 0.11, 1.9, 0.11), mesh(GEO.cyl, mat(0xcfc6b4), x, 0.5, 1.75, 0.17, 0.14, 0.17)); } // hàng cột hiên trên chân tảng
      for (const x of [-2.3, -1.2, 1.2, 2.3]) { h.add(mesh(GEO.box, woodD, x, 1.3, 0.82, 0.9, 1.6, 0.05)); for (const [dx, dy] of [[-0.2, 0.35], [0.2, 0.35], [-0.2, -0.3], [0.2, -0.3]]) h.add(mesh(GEO.box, mat(0x8a5a36), x + dx, 1.3 + dy, 0.86, 0.3, 0.45, 0.02)); } // cửa bức bàn chạm ô
      h.add(mesh(GEO.box, night ? glass : mat(0x2a1a10), 0, 1.3, 0.82, 1.1, 1.6, 0.05), mesh(GEO.box, mat(0xb8862e), 0, 2.28, 0.86, 1.5, 0.3, 0.04)); // cửa giữa, hoành phi
      h.add(hip(tile, 0, 2.35, 0.1, 7.4, 1.5, 5.2, 0.42));
      for (let x = -3.3; x <= 3.3; x += 0.33) h.add(mesh(GEO.box, tileD, x * (1 - 0.29), 3.12, 1.62, 0.06, 0.04, 2.3).rotateX(0.56)); // gờ ngói mái trước
      h.add(mesh(GEO.box, tileD, 0, 3.92, 0.1, 3.3, 0.16, 0.24)); for (const sx of [-1, 1]) h.add(mesh(GEO.box, tileD, sx * 1.75, 4.02, 0.1, 0.5, 0.14, 0.2).rotateZ(sx * 0.5)); // bờ nóc, đầu đao cong
      for (const sx of [-1, 1]) h.add(mesh(GEO.cyl, mat(0x3f6a8a), sx * 3.0, 0.75, 2.6, 0.26, 0.5, 0.26), mesh(GEO.ball, mat(0x5cb85f), sx * 3.0, 1.2, 2.6, 0.34)); // chậu sứ cây cảnh
      break;
    }
    case 'nha_dai': { // nhà dài Ê Đê: sàn thấp trên cột, thân dài vách phên, mái tranh, sàn hiên có cầu thang đẽo tay
      const wood = mat(0x8a6a3f), woodD = mat(0x5a4326), thatch = mat(0xb39a5a), weave = mat(0xa9884e);
      for (const x of [-3, -1.5, 0, 1.5, 3]) for (const z of [-0.9, 0.9]) h.add(mesh(GEO.cyl, woodD, x, 0.55, z, 0.12, 1.1, 0.12));
      h.add(mesh(GEO.box, wood, 0, 1.18, 0.2, 6.8, 0.16, 3.2), mesh(GEO.box, weave, -0.5, 2.0, -0.1, 5.6, 1.5, 2.2));
      for (let x = -3.1; x <= 2.1; x += 0.4) h.add(mesh(GEO.box, woodD, x, 2.0, 1.02, 0.03, 1.5, 0.02)); // nẹp phên
      h.add(gable(thatch, -0.5, 2.75, -0.1, 6.3, 1.6, 2.9)); h.add(mesh(GEO.box, mat(0x8f7a44), -0.5, 4.36, -0.1, 6.4, 0.1, 0.22));
      for (const sx of [-1, 1]) h.add(mesh(GEO.box, woodD, -0.5 + sx * 3.2, 4.5, -0.1, 0.1, 0.5, 0.1).rotateZ(sx * 0.4)); // đầu hồi vểnh
      h.add(mesh(GEO.box, night ? glass : mat(0x2a1a10), 2.34, 1.9, -0.1, 0.06, 1.2, 0.9)); win(-1.6, 2.1, 1.03, 0.7, 0.6, woodD); win(0.6, 2.1, 1.03, 0.7, 0.6, woodD);
      for (const z of [0.55, 0.95]) h.add(mesh(GEO.box, woodD, 3.35, 1.72, z, 0.08, 1.0, 0.08)); // cột hiên
      const stair = mesh(GEO.box, woodD, 3.3, 0.62, 1.75, 0.5, 0.16, 1.7); stair.rotation.x = 0.72; h.add(stair); for (let i = 0; i < 4; i++) h.add(mesh(GEO.box, wood, 3.3, 0.22 + i * 0.28, 2.32 - i * 0.32, 0.54, 0.07, 0.16)); // cầu thang đẽo bậc
      for (const sx of [-1, 1]) h.add(mesh(GEO.ball, wood, 3.3 + sx * 0.12, 1.22, 1.22, 0.07)); // đôi bầu sữa mẹ trên đầu cầu thang
      h.add(mesh(GEO.cyl, mat(0x5a3a22), -3.2, 1.6, 0.9, 0.2, 0.7, 0.2), mesh(GEO.cyl, mat(0x7a4a28), 2.6, 1.42, 1.3, 0.5, 0.2, 0.5)); // ché rượu cần, cồng chiêng
      break;
    }
    case 'nha_rong': { // nhà rông: sàn trên cột, thân thấp, mái tranh cao vút hình lưỡi rìu, nóc gắn hoa văn
      const wood = mat(0x7a5a33), woodD = mat(0x4f3a20), thatch = mat(0xb89a52), thatchD = mat(0x9a7a45);
      for (const x of [-2.2, 0, 2.2]) for (const z of [-1.2, 1.2]) h.add(mesh(GEO.cyl, woodD, x, 0.7, z, 0.15, 1.4, 0.15));
      h.add(mesh(GEO.box, wood, 0, 1.46, 0, 5.4, 0.16, 3.4), mesh(GEO.box, mat(0xa9884e), 0, 2.1, 0, 4.6, 1.2, 2.6));
      h.add(gable(thatch, 0, 2.6, 0, 5.6, 6.2, 3.6)); h.add(gable(thatchD, 0, 2.6, 0, 5.75, 1.3, 3.9)); // mái cao + diềm mái dày
      h.add(mesh(GEO.box, woodD, 0, 8.86, 0, 5.2, 0.14, 0.14)); for (let x = -2.4; x <= 2.4; x += 0.6) h.add(mesh(GEO.box, mat(0xe2573c), x, 9.06, 0, 0.12, 0.34, 0.06).rotateZ(x * 0.08)); // hoa văn sừng trên nóc
      for (const sx of [-1, 1]) h.add(mesh(GEO.box, woodD, sx * 2.75, 9.1, 0, 0.1, 0.9, 0.1).rotateZ(-sx * 0.5));
      for (const [y, c] of [[4.2, 0xe2573c], [5.4, 0x23232a], [6.4, 0xfdf9ef]] as const) h.add(mesh(GEO.box, mat(c), 0, y, 1.82 - (y - 2.6) * 0.29, 5.0, 0.07, 0.03)); // dải hoa văn trên mái
      h.add(mesh(GEO.box, night ? glass : mat(0x2a1a10), 0, 2.1, 1.31, 1.0, 1.1, 0.04));
      const stair = mesh(GEO.box, woodD, 0, 0.74, 2.3, 0.6, 0.16, 2.0); stair.rotation.x = 0.78; h.add(stair); for (let i = 0; i < 5; i++) h.add(mesh(GEO.box, wood, 0, 0.2 + i * 0.28, 2.9 - i * 0.28, 0.66, 0.07, 0.16));
      for (const sx of [-1, 1]) h.add(mesh(GEO.cyl, woodD, sx * 2.9, 1.5, 2.2, 0.08, 3.0, 0.08), mesh(GEO.box, mat(sx > 0 ? 0xe2573c : 0xffd23f), sx * 2.9 + 0.2, 2.7, 2.2, 0.4, 0.5, 0.02)); // cây nêu, cờ
      break;
    }
    case 'nha_trinh_tuong': { // nhà trình tường: tường đất nện dày màu vàng, cửa sổ nhỏ, mái ngói âm dương, hàng rào đá xếp, ngô treo hiên
      const earth = mat(0xc9a468), earthD = mat(0xb08c50), tile = mat(0x6f6a62), tileD = mat(0x56524c), wood = mat(0x5a3a22);
      h.add(mesh(GEO.box, mat(0x8f8a80), 0, 0.2, 0.1, 6.4, 0.4, 4.4), mesh(GEO.box, earth, 0, 1.6, -0.3, 5.8, 2.5, 3.2));
      for (const y of [0.95, 1.55, 2.15]) h.add(mesh(GEO.box, earthD, 0, y, 1.31, 5.82, 0.03, 0.02)); // vệt các lớp đất nện
      h.add(gable(tile, 0, 2.82, -0.3, 6.5, 1.25, 4.1)); for (let x = -3.1; x <= 3.1; x += 0.3) h.add(mesh(GEO.box, tileD, x, 3.34, 0.72, 0.1, 0.05, 2.3).rotateX(0.55)); // ngói âm dương
      h.add(mesh(GEO.box, tileD, 0, 4.1, -0.3, 6.5, 0.12, 0.2));
      door(0, 1.32, 1.0, 1.8, wood, 0.4); h.add(mesh(GEO.box, wood, 0, 2.38, 1.33, 1.3, 0.12, 0.08));
      for (const x of [-1.9, 1.9]) { h.add(mesh(GEO.box, night ? glass : mat(0x2a1a10), x, 1.9, 1.31, 0.5, 0.5, 0.04), mesh(GEO.box, wood, x, 1.9, 1.34, 0.6, 0.06, 0.03), mesh(GEO.box, wood, x, 1.9, 1.34, 0.06, 0.6, 0.03)); }
      for (let i = 0; i < 7; i++) h.add(mesh(GEO.ball, mat(0xf2c94a), -2.6 + i * 0.3, 2.5 - (i % 2) * 0.08, 1.5, 0.07, 0.18, 0.07)); h.add(mesh(GEO.box, wood, -1.7, 2.66, 1.5, 2.2, 0.04, 0.04)); // ngô treo
      for (let i = 0; i < 12; i++) h.add(mesh(GEO.ball, mat(i % 2 ? 0x8f8a80 : 0x7a766e), -3.0 + i * 0.55, 0.22 + (i % 3) * 0.03, 2.5, 0.3, 0.22, 0.26)); // bờ rào đá xếp
      h.add(mesh(GEO.box, mat(0x8f8a80), 0, 0.3, 1.9, 1.4, 0.2, 0.5));
      break;
    }
    case 'nha_noi': { // nhà nổi miền Tây: bè thùng phuy và tre, nhà gỗ sơn xanh mái tôn, hiên phơi cá, ghe đậu cạnh, nằm giữa vũng nước
      const wall = mat(0x7fa6b8), wood = mat(0x8a6a3f), tin = mat(0x9aa3ad), water = mat(0x5fb7d6, { rough: 0.25 });
      h.add(mesh(GEO.cyl, water, 0, 0.05, 0.3, 4.3, 0.06, 3.1), mesh(GEO.cyl, mat(0x8fd0e6, { rough: 0.25 }), 0.4, 0.07, 0.6, 3.2, 0.04, 2.2));
      for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) for (const z of [-0.8, 0.6]) h.add(mesh(GEO.cyl, mat(0x2f6fb0), x, 0.3, z, 0.3, 0.9, 0.3).rotateX(Math.PI / 2)); // thùng phuy nổi
      h.add(mesh(GEO.box, wood, 0, 0.66, 0, 5.6, 0.14, 3.0)); for (let x = -2.6; x <= 2.6; x += 0.4) h.add(mesh(GEO.box, mat(0x6f5330), x, 0.74, 0, 0.03, 0.02, 3.0));
      h.add(mesh(GEO.box, wall, -0.4, 1.7, -0.3, 4.0, 1.9, 2.0), gable(tin, -0.4, 2.65, -0.3, 4.5, 0.8, 2.5));
      door(-0.4, 0.72, 0.8, 1.6, mat(0x3f6f8f), 0.73); win(-1.6, 1.8, 0.72, 0.7, 0.7); win(0.8, 1.8, 0.72, 0.7, 0.7);
      h.add(mesh(GEO.box, tin, 2.2, 2.3, 0.2, 1.4, 0.05, 2.4).rotateZ(-0.15)); for (const z of [-0.8, 1.2]) h.add(mesh(GEO.cyl, wood, 2.75, 1.45, z, 0.05, 1.5, 0.05));
      for (let i = 0; i < 5; i++) h.add(mesh(GEO.ball, mat(0xc9c2b0), 2.0 + (i % 2) * 0.3, 1.6, -0.6 + i * 0.35, 0.05, 0.16, 0.08)); h.add(mesh(GEO.box, wood, 2.15, 1.82, 0.1, 0.03, 0.03, 2.0)); // cá khô phơi
      const boat = new THREE.Group(); boat.add(mesh(GEO.box, mat(0x7a4a28), 0, 0.2, 0, 0.8, 0.26, 2.6), mesh(GEO.box, mat(0x5a3a22), 0, 0.36, 0, 0.9, 0.06, 2.7), mesh(GEO.ball, mat(0x7a4a28), 0, 0.22, 1.4, 0.36, 0.16, 0.5), mesh(GEO.ball, mat(0x7a4a28), 0, 0.22, -1.4, 0.36, 0.16, 0.5), mesh(GEO.box, mat(0xc9a35a), 0.3, 0.5, 0.2, 0.04, 0.04, 2.2).rotateY(0.3));
      boat.position.set(0.6, 0.05, 2.25); boat.rotation.y = Math.PI / 2 - 0.12; h.add(boat);
      h.add(mesh(GEO.ball, mat(0x79c96d), -3.0, 0.1, 1.9, 0.5, 0.03, 0.42), mesh(GEO.ball, mat(0xf7a8c4), -3.0, 0.2, 1.9, 0.12)); // lục bình
      break;
    }
    default: { // biệt thự vườn: hai tầng tường kem, mái ngói bốn dốc, sảnh cột, ban công, cửa kính lớn, ga ra
      const w = mat(0xf5efe2), trim = mat(0xe2d6bd), tile = mat(0xb5543c), tileD = mat(0x944330), rail = mat(0x3a3f4a);
      h.add(mesh(GEO.box, stone, 0, 0.15, 0.1, 6.6, 0.3, 4.6), mesh(GEO.box, w, -0.6, 2.9, -0.4, 4.8, 5.2, 3.0), mesh(GEO.box, w, 2.5, 1.5, -0.2, 1.6, 2.4, 3.2));
      h.add(hip(tile, -0.6, 5.5, -0.4, 5.6, 1.5, 3.8, 0.3)); h.add(mesh(GEO.box, tileD, -0.6, 5.5, -0.4, 5.7, 0.1, 3.9)); h.add(hip(tile, 2.5, 2.7, -0.2, 2.1, 0.8, 3.6, 0.3));
      h.add(mesh(GEO.box, trim, -0.6, 2.95, 1.5, 3.2, 0.16, 1.2)); for (const x of [-2.1, 0.9]) h.add(mesh(GEO.cyl, white, x, 1.6, 2.0, 0.14, 2.7, 0.14), mesh(GEO.box, trim, x, 0.42, 2.0, 0.4, 0.24, 0.4)); // sảnh cột đỡ ban công
      h.add(mesh(GEO.box, rail, -0.6, 3.85, 2.08, 3.2, 0.06, 0.05)); for (let x = -2.1; x <= 0.9; x += 0.25) h.add(mesh(GEO.box, rail, x, 3.45, 2.08, 0.035, 0.8, 0.035));
      door(-0.6, 1.12, 1.3, 2.1, mat(0x6b3f24), 0.3); h.add(mesh(GEO.box, glass, -0.6, 2.55, 1.12, 1.3, 0.4, 0.05));
      win(-2.2, 1.6, 1.11, 0.9, 1.3); win(1.05, 1.6, 1.11, 0.9, 1.3);
      h.add(mesh(GEO.box, glass, -0.6, 4.25, 1.11, 1.8, 1.7, 0.06), mesh(GEO.box, white, -0.6, 4.25, 1.15, 0.07, 1.7, 0.04)); win(-2.3, 4.3, 1.11, 0.8, 1.2); win(1.1, 4.3, 1.11, 0.8, 1.2);
      h.add(mesh(GEO.box, mat(0xd9d2c5), 2.5, 1.25, 1.42, 1.3, 1.9, 0.06)); for (let y = 0.5; y < 2.2; y += 0.25) h.add(mesh(GEO.box, mat(0xbfb8aa), 2.5, y, 1.46, 1.3, 0.03, 0.02)); // cửa ga ra
      h.add(mesh(GEO.box, mat(0xb0a08a), 0.9, 6.5, -0.9, 0.5, 1.0, 0.5), mesh(GEO.box, stone, -0.6, 0.1, 2.6, 2.2, 0.2, 0.9));
      for (const x of [-3.0, 1.6]) h.add(mesh(GEO.cyl, mat(0xc9774e), x, 0.55, 2.3, 0.24, 0.4, 0.24), mesh(GEO.cone, mat(0x3f8f4a), x, 1.5, 2.3, 0.36, 1.5, 0.36)); // cây tùng chậu
    }
  }
  return h;
}

/** Vị trí bày đồ đã mua quanh nhà (toạ độ của thửa): nội thất ở dải hiên trước nhà, đồ sân vườn dọc hai bên và góc sân. */
export const GOODS_SPOTS: Record<string, [number, number, number]> = {
  // nội thất: bày ở sân trước hiên nhà (z ≈ -6,5), chừa lối cửa giữa; bếp củi sau nhà, võng bên hông
  bo_truong_ky: [-2.4, -6.3, 0], phan_go: [2.4, -6.5, 0], ban_tho: [-4.8, -6.6, 0], tu_che: [4.8, -6.6, 0],
  ti_vi: [-6.9, -6.6, 0.25], tu_lanh: [6.6, -6.6, -0.2], vong: [-8.2, -8.6, Math.PI / 2], bep_cui: [5.4, -12.0, 0],
  // sân vườn: dọc hai bên hàng rào và dải sân trước cổng
  gieng_nuoc: [8.3, -4.4, 0], lu_nuoc_mam: [8.5, -0.2, Math.PI / 2], chuong_ga: [8.3, 4.6, -Math.PI / 2],
  cay_rom: [-8.5, 3.0, 0], gian_bau: [-8.3, -1.0, Math.PI / 2],
  hon_non_bo: [-5.3, 7.2, 0], cay_si_bonsai: [2.1, 7.3, 0], cot_neu: [5.6, 7.4, 0],
};
export const GOODS_PROPS = Object.keys(GOODS_SPOTS);

/** Một món nội thất hoặc đồ sân vườn, gốc đặt tại chân món. */
export function buildGoodProp(id: string, night = false): THREE.Group | null {
  const g = new THREE.Group();
  const wood = mat(0x6b3f24), woodL = mat(0x8a5a36), green = mat(0x4f9a57), stone = mat(0x9a968c);
  switch (id) {
    case 'bo_truong_ky': // ghế dài tựa song, bàn trà, hai ghế đơn, bộ ấm chén
      g.add(mesh(GEO.box, wood, 0, 0.42, -0.5, 1.9, 0.1, 0.6), mesh(GEO.box, wood, 0, 0.9, -0.78, 1.9, 0.1, 0.06)); for (let x = -0.85; x <= 0.85; x += 0.17) g.add(mesh(GEO.box, woodL, x, 0.66, -0.78, 0.05, 0.42, 0.04));
      for (const [x, z] of [[-0.9, -0.74], [0.9, -0.74], [-0.9, -0.26], [0.9, -0.26]]) g.add(mesh(GEO.box, wood, x, 0.22, z, 0.09, 0.44, 0.09));
      for (const sx of [-1, 1]) g.add(mesh(GEO.box, wood, sx * 0.95, 0.66, -0.5, 0.06, 0.08, 0.6));
      g.add(mesh(GEO.box, wood, 0, 0.36, 0.3, 1.0, 0.08, 0.6)); for (const [x, z] of [[-0.42, 0.08], [0.42, 0.08], [-0.42, 0.52], [0.42, 0.52]]) g.add(mesh(GEO.box, wood, x, 0.17, z, 0.07, 0.34, 0.07));
      g.add(mesh(GEO.ball, mat(0xfdf9ef), 0, 0.5, 0.3, 0.12, 0.1, 0.12), mesh(GEO.cyl, mat(0x3f6a8a), 0, 0.42, 0.3, 0.13, 0.03, 0.13)); for (const [x, z] of [[-0.25, 0.4], [0.25, 0.2], [0.2, 0.45]]) g.add(mesh(GEO.cyl, mat(0xfdf9ef), x, 0.43, z, 0.04, 0.05, 0.04));
      break;
    case 'phan_go': // bộ ngựa gỗ dày kê trên hai mễ, có chiếu và gối
      g.add(mesh(GEO.box, woodL, 0, 0.5, 0, 2.0, 0.14, 1.3)); for (const x of [-0.7, 0.7]) g.add(mesh(GEO.box, wood, x, 0.22, 0, 0.12, 0.44, 1.2));
      for (const x of [-0.5, 0, 0.5]) g.add(mesh(GEO.box, wood, x, 0.575, 0, 0.02, 0.01, 1.3));
      g.add(mesh(GEO.box, mat(0xd9c27a), 0.2, 0.585, 0, 1.4, 0.02, 1.1), mesh(GEO.box, mat(0xe8457f), -0.75, 0.66, 0, 0.3, 0.14, 0.6));
      break;
    case 'ban_tho': // tủ thờ gỗ đỏ, lư hương, đôi chân nến, bát hương, hoành phi, đĩa quả
      g.add(mesh(GEO.box, mat(0x8a2d1c), 0, 0.6, 0, 1.6, 1.2, 0.7), mesh(GEO.box, mat(0x6b1f12), 0, 1.24, 0, 1.76, 0.08, 0.8)); for (const x of [-0.4, 0.4]) g.add(mesh(GEO.box, mat(0xd9a441), x, 0.6, 0.36, 0.6, 0.9, 0.02));
      g.add(mesh(GEO.cyl, mat(0xc9a35a, { rough: 0.4 }), 0, 1.38, 0.05, 0.16, 0.2, 0.16)); for (const dx of [-0.04, 0, 0.04]) g.add(mesh(GEO.box, mat(0xc0392b), dx, 1.62, 0.05, 0.012, 0.3, 0.012));
      for (const sx of [-1, 1]) g.add(mesh(GEO.cyl, mat(0xc9a35a, { rough: 0.4 }), sx * 0.55, 1.4, 0, 0.05, 0.24, 0.05), mesh(GEO.cyl, mat(0xc0392b), sx * 0.55, 1.62, 0, 0.03, 0.2, 0.03), mesh(GEO.ball, night ? mat(0xffe08a, { emissive: 0xffc24a }) : mat(0xffd23f), sx * 0.55, 1.76, 0, 0.04, 0.06, 0.04));
      g.add(mesh(GEO.cyl, mat(0xfdf9ef), -0.28, 1.31, 0.2, 0.14, 0.03, 0.14)); for (const [x, c] of [[-0.33, 0xffd23f], [-0.23, 0xe2573c], [-0.28, 0x7ccf4f]] as const) g.add(mesh(GEO.ball, mat(c), x, 1.39, 0.2 + (x === -0.28 ? 0.05 : 0), 0.06));
      g.add(mesh(GEO.box, mat(0x6b1f12), 0, 2.3, -0.3, 1.5, 0.4, 0.06), mesh(GEO.box, mat(0xd9a441), 0, 2.3, -0.26, 1.2, 0.2, 0.02)); for (const sx of [-1, 1]) g.add(mesh(GEO.box, mat(0x6b1f12), sx * 0.7, 1.9, -0.3, 0.06, 1.2, 0.06));
      break;
    case 'vong': // võng lưới mắc giữa hai cột, có gối
      for (const sx of [-1, 1]) g.add(mesh(GEO.cyl, woodL, sx * 1.3, 0.8, 0, 0.07, 1.6, 0.07), mesh(GEO.box, woodL, sx * 1.3, 0.05, 0, 0.5, 0.08, 0.5));
      for (let i = 0; i < 9; i++) { const t = i / 8 - 0.5, y = 0.62 + t * t * 2.4; g.add(mesh(GEO.box, mat(i % 2 ? 0x4f8f6a : 0x6fb08a), t * 2.4, y, 0, 0.3, 0.04, 0.7 - Math.abs(t) * 0.5).rotateZ(t * 0.9)); }
      g.add(mesh(GEO.ball, mat(0xfdf9ef), -0.6, 0.74, 0, 0.2, 0.08, 0.16));
      break;
    case 'tu_che': // tủ chè thấp hai tầng, cánh giữa khảm trai, kính hai bên, bình hoa trên nóc
      g.add(mesh(GEO.box, mat(0x5c3520), 0, 0.55, 0, 1.8, 0.9, 0.5), mesh(GEO.box, mat(0x5c3520), 0, 1.15, -0.05, 1.5, 0.3, 0.4), mesh(GEO.box, mat(0x452614), 0, 1.02, 0, 1.9, 0.06, 0.56));
      for (const x of [-0.6, 0.6]) g.add(mesh(GEO.box, mat(0xbfe2ee, { rough: 0.3 }), x, 0.6, 0.26, 0.45, 0.6, 0.02)); g.add(mesh(GEO.box, mat(0x3a2012), 0, 0.6, 0.26, 0.5, 0.62, 0.02));
      for (const [x, y] of [[-0.1, 0.72], [0.1, 0.7], [0, 0.55], [-0.12, 0.45], [0.12, 0.48]]) g.add(mesh(GEO.ball, mat(0xe8f2f0, { rough: 0.3 }), x, y, 0.275, 0.045, 0.045, 0.01));
      for (const x of [-0.8, 0.8]) g.add(mesh(GEO.box, mat(0x452614), x, 0.06, 0, 0.12, 0.12, 0.5)); g.add(mesh(GEO.cyl, mat(0x3f6a8a), 0.4, 1.46, -0.05, 0.1, 0.3, 0.1), mesh(GEO.ball, mat(0xe8457f), 0.4, 1.72, -0.05, 0.14));
      break;
    case 'bep_cui': // kiềng ba chân, nồi đất, củi cháy, gác bếp treo ngô, chồng củi
      for (const a of [0, 2.1, 4.2]) g.add(mesh(GEO.box, mat(0x3a3a3a), Math.cos(a) * 0.28, 0.2, Math.sin(a) * 0.28, 0.05, 0.4, 0.05)); g.add(mesh(GEO.cyl, mat(0x3a3a3a), 0, 0.4, 0, 0.32, 0.04, 0.32));
      g.add(mesh(GEO.ball, mat(0x7a4a2e), 0, 0.62, 0, 0.3, 0.24, 0.3), mesh(GEO.cyl, mat(0x5a3520), 0, 0.84, 0, 0.26, 0.05, 0.26), mesh(GEO.ball, mat(0x5a3520), 0, 0.9, 0, 0.06));
      for (const a of [0.5, 2.6, 4.7]) g.add(mesh(GEO.cyl, mat(0x7a5233), Math.cos(a) * 0.4, 0.07, Math.sin(a) * 0.4, 0.06, 0.8, 0.06).rotateZ(Math.PI / 2).rotateY(a));
      g.add(mesh(GEO.cone, mat(0xff8a2a, { emissive: 0xff5a1a }), 0, 0.18, 0, 0.16, 0.3, 0.16), mesh(GEO.cone, mat(0xffd23f, { emissive: 0xffa800 }), 0.06, 0.14, 0.05, 0.08, 0.2, 0.08));
      for (const [x, z] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]]) g.add(mesh(GEO.cyl, woodL, x, 0.95, z, 0.05, 1.9, 0.05)); g.add(mesh(GEO.box, woodL, 0, 1.9, 0, 1.6, 0.06, 1.4));
      for (let i = 0; i < 4; i++) g.add(mesh(GEO.ball, mat(0xf2c94a), -0.45 + i * 0.3, 1.7, 0.3, 0.06, 0.16, 0.06)); for (let i = 0; i < 5; i++) g.add(mesh(GEO.cyl, mat(0x8a6a3f), 1.1, 0.08 + (i % 2) * 0.14, -0.3 + Math.floor(i / 2) * 0.16, 0.07, 0.7, 0.07).rotateX(Math.PI / 2));
      break;
    case 'tu_lanh': // tủ lạnh hai cánh có tay nắm, nam châm dán cửa
      g.add(mesh(GEO.box, mat(0xdfe7ee, { rough: 0.4 }), 0, 0.95, 0, 0.8, 1.9, 0.7), mesh(GEO.box, mat(0xb8c2cc), 0, 1.3, 0.355, 0.8, 0.02, 0.01), mesh(GEO.box, mat(0x8f97a3), 0.3, 1.6, 0.37, 0.04, 0.4, 0.04), mesh(GEO.box, mat(0x8f97a3), 0.3, 0.9, 0.37, 0.04, 0.5, 0.04));
      g.add(mesh(GEO.box, mat(0xe2573c), -0.15, 1.65, 0.36, 0.1, 0.1, 0.01), mesh(GEO.box, mat(0xffd23f), 0, 1.5, 0.36, 0.08, 0.12, 0.01), mesh(GEO.box, mat(0x3a3f4a), 0, 0.03, 0, 0.8, 0.06, 0.7));
      break;
    case 'ti_vi': // ti vi màn hình phẳng trên kệ gỗ, loa và đầu thu
      g.add(mesh(GEO.box, woodL, 0, 0.3, 0, 1.6, 0.6, 0.45), mesh(GEO.box, wood, 0, 0.3, 0.23, 0.5, 0.4, 0.01)); for (const x of [-0.55, 0.55]) g.add(mesh(GEO.box, mat(0x2b2f36), x, 0.3, 0.23, 0.36, 0.36, 0.01), mesh(GEO.cyl, mat(0x4a4f5a), x, 0.3, 0.24, 0.1, 0.01, 0.1).rotateX(Math.PI / 2));
      g.add(mesh(GEO.box, mat(0x15171c), 0, 1.15, 0, 1.4, 0.82, 0.06), mesh(GEO.box, night ? mat(0x8fd3f2, { emissive: 0x4fa3d8 }) : mat(0x4a90c2, { rough: 0.3 }), 0, 1.15, 0.035, 1.3, 0.72, 0.01), mesh(GEO.box, mat(0x15171c), 0, 0.68, 0, 0.5, 0.04, 0.24), mesh(GEO.box, mat(0x15171c), 0, 0.72, 0, 0.08, 0.1, 0.06));
      break;
    case 'gieng_nuoc': // giếng tròn xây gạch, trục quay có mái che, gàu treo
      g.add(mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.8, 14, 1), mat(0xb5613c), 0, 0.4, 0), mesh(GEO.cyl, mat(0x8d8d86), 0, 0.82, 0, 0.82, 0.08, 0.82), mesh(GEO.cyl, mat(0x4fb3e0, { rough: 0.2 }), 0, 0.84, 0, 0.6, 0.03, 0.6));
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.add(mesh(GEO.box, mat(0x8a4028), Math.cos(a) * 0.78, 0.3 + (i % 2) * 0.24, Math.sin(a) * 0.78, 0.02, 0.2, 0.3).rotateY(-a)); }
      for (const sx of [-1, 1]) g.add(mesh(GEO.box, woodL, sx * 0.8, 1.25, 0, 0.1, 1.7, 0.1)); g.add(mesh(GEO.cyl, woodL, 0, 1.75, 0, 0.07, 1.8, 0.07).rotateZ(Math.PI / 2), mesh(GEO.box, woodL, 0.95, 1.75, 0.14, 0.04, 0.04, 0.3));
      g.add(gable(mat(0x9a4a30), 0, 2.05, 0, 2.1, 0.5, 1.3), mesh(GEO.box, mat(0x3a3a3a), 0.15, 1.4, 0, 0.015, 0.7, 0.015), mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.24, 10, 1), woodL, 0.15, 1.0, 0));
      break;
    case 'cay_rom': // đống rơm hình nấm quanh cọc tre
      g.add(mesh(new THREE.CylinderGeometry(0.75, 0.95, 1.2, 12, 1), mat(0xd9b44a), 0, 0.6, 0), mesh(new THREE.ConeGeometry(1.15, 1.3, 12), mat(0xe6c66a), 0, 1.85, 0), mesh(GEO.cyl, mat(0x8a6a3f), 0, 2.7, 0, 0.05, 0.5, 0.05));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; g.add(mesh(GEO.box, mat(0xc49f3a), Math.cos(a) * 1.1, 1.22, Math.sin(a) * 1.1, 0.04, 0.3, 0.14).rotateY(-a)); }
      g.add(mesh(GEO.ball, mat(0xd9b44a), 0.9, 0.12, 0.6, 0.4, 0.12, 0.3));
      break;
    case 'chuong_ga': // chuồng tre thấp mái lá, nan tre đứng, cửa nhỏ, máng ăn và hai con gà
      g.add(mesh(GEO.box, mat(0xa9783f), 0, 0.6, 0, 2.0, 0.08, 1.2), gable(mat(0xc9a84e), 0, 1.3, 0, 2.3, 0.7, 1.6));
      for (let x = -0.95; x <= 0.95; x += 0.19) g.add(mesh(GEO.cyl, mat(0xc9d77a), x, 0.95, 0.58, 0.025, 0.7, 0.025), mesh(GEO.cyl, mat(0xc9d77a), x, 0.95, -0.58, 0.025, 0.7, 0.025));
      for (const [x, z] of [[-0.95, 0.55], [0.95, 0.55], [-0.95, -0.55], [0.95, -0.55]]) g.add(mesh(GEO.cyl, mat(0x8a6a3f), x, 0.65, z, 0.05, 1.3, 0.05));
      g.add(mesh(GEO.box, mat(0x8a6a3f), 0.5, 0.2, 0.95, 0.5, 0.05, 0.9).rotateX(-0.45), mesh(GEO.box, mat(0x7a5233), -0.6, 0.08, 1.2, 0.7, 0.12, 0.2));
      for (const [x, z, c] of [[-0.2, 1.4, 0xfdf9ef], [0.9, 1.5, 0xc9774e]] as const) g.add(mesh(GEO.ball, mat(c), x, 0.26, z, 0.17, 0.16, 0.22), mesh(GEO.ball, mat(c), x, 0.46, z + 0.16, 0.1), mesh(GEO.cone, mat(0xf2a23a), x, 0.45, z + 0.27, 0.035, 0.08, 0.035).rotateX(Math.PI / 2), mesh(GEO.ball, mat(0xe2573c), x, 0.57, z + 0.14, 0.04, 0.05, 0.06));
      break;
    case 'gian_bau': // giàn tre bốn cọc, lá phủ kín, quả bầu và mướp thả xuống
      for (const [x, z] of [[-1.1, -0.8], [1.1, -0.8], [-1.1, 0.8], [1.1, 0.8]]) g.add(mesh(GEO.cyl, mat(0xc9d77a), x, 1.05, z, 0.05, 2.1, 0.05));
      for (let x = -1.1; x <= 1.1; x += 0.44) g.add(mesh(GEO.cyl, mat(0xb9c76a), x, 2.1, 0, 0.03, 1.8, 0.03).rotateX(Math.PI / 2)); for (const z of [-0.8, 0, 0.8]) g.add(mesh(GEO.cyl, mat(0xb9c76a), 0, 2.12, z, 0.03, 2.4, 0.03).rotateZ(Math.PI / 2));
      for (const [x, z, s] of [[-0.7, -0.4, 0.5], [0.2, -0.5, 0.55], [0.8, 0.3, 0.5], [-0.3, 0.5, 0.55], [-0.9, 0.5, 0.4], [0.7, -0.3, 0.4]]) g.add(mesh(GEO.ball, mat(s > 0.5 ? 0x5fa052 : 0x79c96d), x, 2.22, z, s, 0.12, s));
      for (const [x, z, len] of [[-0.5, 0.2, 0.5], [0.4, -0.3, 0.42]]) g.add(mesh(GEO.ball, mat(0xbfdc8a), x, 2.1 - len - 0.25, z, 0.16, 0.26, 0.16), mesh(GEO.ball, mat(0xbfdc8a), x, 2.1 - len + 0.02, z, 0.09, 0.14, 0.09), mesh(GEO.box, mat(0x5fa052), x, 2.1 - len / 2 + 0.1, z, 0.015, len, 0.015));
      g.add(mesh(GEO.cyl, mat(0x7fb85a), 0.8, 1.55, 0.5, 0.07, 0.6, 0.07), mesh(GEO.box, mat(0x5fa052), 0.8, 1.98, 0.5, 0.015, 0.26, 0.015), mesh(GEO.ball, mat(0xffd23f), 0, 2.32, 0, 0.08));
      break;
    case 'hon_non_bo': // bể xi măng chữ nhật, núi đá nhiều ngọn, cây si nhỏ, chùa và cầu tí hon
      g.add(mesh(GEO.box, mat(0xbdb5a6), 0, 0.25, 0, 2.2, 0.5, 1.4), mesh(GEO.box, mat(0x5fb7d6, { rough: 0.2 }), 0, 0.5, 0, 2.0, 0.03, 1.2));
      for (const [x, z, s, hh, c] of [[-0.3, -0.1, 0.42, 1.5, 0x7f8a7a], [0.3, 0.0, 0.36, 1.1, 0x6f7a6a], [-0.7, 0.1, 0.3, 0.8, 0x8a9484], [0.7, -0.2, 0.26, 0.6, 0x7f8a7a], [0, 0.3, 0.24, 0.5, 0x8a9484]] as const) g.add(mesh(GEO.cone, mat(c), x, 0.5 + hh / 2, z, s, hh, s * 0.9));
      for (const [x, y, z] of [[-0.3, 1.9, -0.1], [0.38, 1.5, 0.05], [-0.72, 1.2, 0.12]]) g.add(mesh(GEO.ball, green, x, y, z, 0.2, 0.14, 0.2));
      g.add(mesh(GEO.box, mat(0xc0392b), 0.35, 1.02, 0.18, 0.16, 0.12, 0.12), mesh(GEO.cone, mat(0x8a2d1c), 0.35, 1.13, 0.18, 0.16, 0.1, 0.16), mesh(GEO.box, mat(0xc0392b), 0, 0.62, 0.42, 0.5, 0.03, 0.08));
      break;
    case 'cay_si_bonsai': // chậu sứ men lam trên đôn, thân cây uốn thế, ba tầng tán
      g.add(mesh(GEO.cyl, stone, 0, 0.35, 0, 0.3, 0.7, 0.3), mesh(new THREE.CylinderGeometry(0.5, 0.36, 0.34, 10, 1), mat(0x3f6a8a), 0, 0.87, 0), mesh(GEO.cyl, mat(0xfdf9ef), 0, 1.04, 0, 0.51, 0.03, 0.51), mesh(GEO.cyl, mat(0x4a3a22), 0, 1.05, 0, 0.44, 0.02, 0.44));
      g.add(mesh(GEO.cyl, mat(0x6b4a2f), 0.05, 1.3, 0, 0.09, 0.5, 0.09).rotateZ(-0.35), mesh(GEO.cyl, mat(0x6b4a2f), 0.02, 1.7, 0, 0.07, 0.5, 0.07).rotateZ(0.5), mesh(GEO.cyl, mat(0x6b4a2f), 0.32, 1.52, 0.05, 0.05, 0.4, 0.05).rotateZ(-1.2));
      for (const [x, y, z, s] of [[-0.2, 2.02, 0, 0.36], [0.52, 1.62, 0.05, 0.28], [-0.28, 1.5, -0.1, 0.22]]) g.add(mesh(GEO.ball, mat(0x3f6f3a), x, y, z, s, s * 0.42, s));
      break;
    case 'lu_nuoc_mam': // hàng ba chum sành đậy nón lá, có cái gáo
      for (const x of [-0.95, 0, 0.95]) g.add(mesh(GEO.ball, mat(0x7a4b2e), x, 0.5, 0, 0.42, 0.52, 0.42), mesh(GEO.cyl, mat(0x5a3520), x, 0.98, 0, 0.26, 0.08, 0.26), mesh(new THREE.ConeGeometry(0.42, 0.24, 10), mat(0xf2dc9a), x, 1.14, 0));
      g.add(mesh(GEO.box, mat(0x8a6a3f), 0, 0.03, 0, 2.9, 0.06, 0.9), mesh(GEO.ball, mat(0x8a6a3f), 0.48, 0.2, 0.42, 0.1, 0.08, 0.1), mesh(GEO.box, mat(0x8a6a3f), 0.62, 0.24, 0.42, 0.3, 0.02, 0.02));
      break;
    case 'cot_neu': // cây tre cao còn ngọn lá, treo đèn lồng, khánh đất, câu đối đỏ
      g.add(mesh(GEO.cyl, mat(0x7fb85a), 0, 2.7, 0, 0.06, 5.4, 0.06)); for (let y = 0.6; y < 5.2; y += 0.6) g.add(mesh(GEO.cyl, mat(0x5f9a45), 0, y, 0, 0.07, 0.03, 0.07));
      for (const [a, y] of [[0, 5.3], [2, 5.2], [4, 5.4], [1, 5.0], [3, 5.1]]) g.add(mesh(GEO.ball, mat(0x4f9a57), Math.cos(a) * 0.4, y, Math.sin(a) * 0.4, 0.5, 0.06, 0.14).rotateY(-a).rotateZ(-0.4));
      g.add(mesh(GEO.cyl, mat(0x7fb85a), 0.4, 4.4, 0, 0.02, 0.8, 0.02).rotateZ(Math.PI / 2), mesh(GEO.ball, night ? mat(0xe8412f, { emissive: 0xff5a3a }) : mat(0xe8412f), 0.7, 4.05, 0, 0.22, 0.28, 0.22), mesh(GEO.cyl, mat(0xffd23f), 0.7, 3.72, 0, 0.06, 0.12, 0.06));
      g.add(mesh(GEO.box, mat(0xc0392b), -0.22, 3.4, 0, 0.3, 1.5, 0.02), mesh(GEO.box, mat(0xffd23f), -0.22, 3.4, 0.015, 0.08, 1.2, 0.01), mesh(GEO.box, mat(0xda251d), 0.4, 4.9, 0, 0.7, 0.45, 0.02), mesh(GEO.ball, mat(0xffdd00), 0.4, 4.9, 0.02, 0.1, 0.1, 0.01));
      g.add(mesh(GEO.cyl, stone, 0, 0.12, 0, 0.3, 0.24, 0.3));
      break;
    default: return null;
  }
  return g;
}
export const __shade = shade;

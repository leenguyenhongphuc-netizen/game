// Tủ đồ của nhân vật: quần áo, nón mũ, phụ kiện mua ở trung tâm mua sắm (shared/shop.ts).
// Mọi món dựng bằng khối màu trơn để cả nhân vật vẫn gộp được thành một lần vẽ.
// Hệ toạ độ của nhân vật (trước khi phóng 1,18): chân ở y = 0, thân quanh y ≈ 0,84, đầu ở y ≈ 1,52 bán kính 0,42, mặt hướng +z.
import * as THREE from 'three';
import { GEO, mat, mesh } from './plants.ts';
import { addHat } from './custom3d.ts';

/** Đồ đang mặc lấy từ `me.user.equipped`. */
export interface Outfit { ao?: string | null; non?: string | null; phu_kien?: string | null }

/** Màu các phần cơ thể theo bộ đồ; `body` thêm thân áo riêng, trả false nếu dùng thân áo mặc định. */
export interface OutfitLook { cloth: number; pants: number; shoe: number; custom: boolean }

const WHITE = 0xfdf9ef, BLACK = 0x23232a;
/** Khối nón cụt (trên hẹp dưới rộng) dùng làm váy, tà áo, áo mưa. */
const frustum = (top: number, bottom: number, h: number, seg = 10) => new THREE.CylinderGeometry(top, bottom, h, seg, 1);
const tilt = (m: THREE.Mesh, rx = 0, ry = 0, rz = 0) => { m.rotation.set(rx, ry, rz); return m; };
/** Đai tròn mảnh quanh thân ở độ cao y. */
const band = (color: number, y: number, r: number, h = 0.06, rz = r * 0.85) => mesh(GEO.cyl, mat(color), 0, y, 0, r, h, rz);

export function outfitLook(ao: string | null | undefined, shirt: number): OutfitLook {
  switch (ao) {
    case 'ao_ba_ba': return { cloth: 0x6b4f3a, pants: 0x1f1f24, shoe: 0x8a5a33, custom: true };
    case 'ao_dai_trang': return { cloth: 0xffffff, pants: 0xf6f3ea, shoe: 0xe9dcc0, custom: true };
    case 'ao_dai_tim_hue': return { cloth: 0x8e6bbf, pants: 0xf6f3ea, shoe: 0xe9dcc0, custom: true };
    case 'ao_tu_than': return { cloth: 0xb5462f, pants: 0x2b2b2b, shoe: 0x5a3a22, custom: true };
    case 'ao_tho_cam_tay_nguyen': return { cloth: 0x2b2b3a, pants: 0x23232a, shoe: 0x8a5a33, custom: true };
    case 'ao_tho_cam_tay_bac': return { cloth: 0x1f3b6e, pants: 0x1c2a4a, shoe: 0x3a2a1c, custom: true };
    case 'ao_toi': return { cloth: shirt, pants: 0x4f5f86, shoe: 0x6b4a2f, custom: true };
    case 'do_bao_ho': return { cloth: 0x3f7d5a, pants: 0x35523f, shoe: 0x22332a, custom: true };
    case 'ao_so_mi': return { cloth: 0xe9eef5, pants: 0x30343f, shoe: 0x1d1d22, custom: true };
    case 'ao_thun': return { cloth: 0x5aa9e6, pants: 0x3d6fb4, shoe: 0xf5f5f5, custom: true };
    case 'vest': return { cloth: 0x2d3142, pants: 0x2d3142, shoe: 0x141418, custom: true };
    case 'ao_mua': return { cloth: 0xf2c14e, pants: 0x4f5f86, shoe: 0x3a3f4a, custom: true };
    default: return { cloth: shirt, pants: 0x4f5f86, shoe: 0x6b4a2f, custom: false };
  }
}

/** Thân áo theo bộ đồ. Trả false nếu bộ này dùng thân áo mặc định của nhân vật. */
export function addOutfitBody(core: THREE.Group, ao: string | null | undefined, look: OutfitLook): boolean {
  if (!look.custom) return false;
  const cloth = mat(look.cloth), dark = mat(new THREE.Color(look.cloth).multiplyScalar(0.76).getHex());
  const torso = () => core.add(mesh(GEO.ball, cloth, 0, 0.84, 0, 0.4, 0.44, 0.34));
  const hem = (c = dark) => core.add(mesh(GEO.cyl, c, 0, 0.5, 0, 0.36, 0.1, 0.31));
  const buttons = (c: number, ys: number[]) => { for (const y of ys) core.add(mesh(GEO.ball, mat(c), 0, y, 0.335, 0.032)); };
  switch (ao) {
    case 'ao_ba_ba': { // cổ tròn, nẹp giữa, hàng khuy bấm, xẻ tà hai bên, quần lụa đen ống rộng
      torso(); core.add(mesh(GEO.cyl, dark, 0, 1.16, 0.02, 0.2, 0.05, 0.19));
      core.add(mesh(GEO.box, dark, 0, 0.84, 0.335, 0.05, 0.6, 0.02)); buttons(0xf3e9c9, [1.06, 0.94, 0.82, 0.7, 0.58]);
      for (const sx of [-1, 1]) core.add(tilt(mesh(GEO.box, cloth, sx * 0.3, 0.46, 0.06, 0.2, 0.2, 0.42), 0, 0, sx * 0.16)); // hai vạt xẻ tà
      core.add(mesh(GEO.box, dark, 0.2, 0.62, 0.3, 0.16, 0.14, 0.03), mesh(GEO.box, dark, -0.2, 0.62, 0.3, 0.16, 0.14, 0.03)); // hai túi
      core.add(mesh(frustum(0.3, 0.36, 0.3), mat(look.pants), 0, 0.38, 0)); // ống quần rộng
      break;
    }
    case 'ao_dai_trang': case 'ao_dai_tim_hue': { // cổ cao, thân ôm, hai tà dài trước sau, quần trắng
      core.add(mesh(GEO.ball, cloth, 0, 0.86, 0, 0.37, 0.44, 0.31)); core.add(mesh(GEO.cyl, cloth, 0, 1.19, 0.01, 0.17, 0.12, 0.16)); // cổ đứng
      core.add(tilt(mesh(GEO.box, cloth, 0, 0.36, 0.27, 0.5, 0.62, 0.035), -0.07), tilt(mesh(GEO.box, cloth, 0, 0.36, -0.27, 0.5, 0.62, 0.035), 0.07)); // tà trước, tà sau
      core.add(mesh(GEO.box, dark, 0, 0.07, 0.3, 0.5, 0.03, 0.03)); // gấu tà
      core.add(tilt(mesh(GEO.box, dark, 0.11, 1.02, 0.3, 0.03, 0.3, 0.02), 0, 0, -0.75)); buttons(ao === 'ao_dai_trang' ? 0xd9d2c5 : 0xf3e9c9, [1.12, 1.0]); // nẹp chéo cài vai
      core.add(mesh(frustum(0.28, 0.33, 0.34), mat(look.pants), 0, 0.36, 0));
      break;
    }
    case 'ao_tu_than': { // áo bốn vạt nâu non mở ngực, yếm đào, thắt lưng xanh thả dải, váy đen dài
      torso(); const yem = mat(0xe8457f), sash = mat(0x4f9a57);
      core.add(tilt(mesh(GEO.box, yem, 0, 0.98, 0.32, 0.3, 0.3, 0.03), 0, 0, Math.PI / 4)); core.add(mesh(GEO.box, yem, 0, 0.8, 0.325, 0.34, 0.26, 0.03)); // yếm
      core.add(band(0x4f9a57, 0.62, 0.39, 0.09, 0.33)); // thắt lưng
      core.add(tilt(mesh(GEO.box, sash, 0.1, 0.36, 0.36, 0.09, 0.5, 0.02), 0, 0, -0.06), tilt(mesh(GEO.box, mat(0xf2c94a), -0.08, 0.38, 0.365, 0.08, 0.46, 0.02), 0, 0, 0.08)); // dải thắt lưng
      core.add(mesh(frustum(0.36, 0.46, 0.56), mat(0x2b2b2b), 0, 0.3, 0)); // váy đụp
      for (const sx of [-1, 1]) { core.add(tilt(mesh(GEO.box, cloth, sx * 0.25, 0.4, 0.3, 0.16, 0.62, 0.03), -0.05, 0, sx * 0.05)); core.add(tilt(mesh(GEO.box, cloth, sx * 0.2, 0.4, -0.3, 0.26, 0.62, 0.03), 0.05)); } // bốn vạt áo
      break;
    }
    case 'ao_tho_cam_tay_nguyen': { // nền chàm, các dải dệt ngang đỏ vàng trắng ở ngực và gấu, váy quấn
      torso();
      for (const [y, c, r] of [[1.02, 0xe2573c, 0.345], [0.96, 0xffd23f, 0.375], [0.9, 0xfdf9ef, 0.39], [0.84, 0xe2573c, 0.4]] as const) core.add(band(c, y, r, 0.04, r * 0.86));
      core.add(mesh(frustum(0.36, 0.41, 0.5), mat(0x23232a), 0, 0.3, 0));
      for (const [y, c] of [[0.2, 0xe2573c], [0.14, 0xffd23f], [0.09, 0xfdf9ef]] as const) core.add(mesh(frustum(0.405, 0.412, 0.04), mat(c), 0, y, 0));
      core.add(mesh(GEO.box, mat(0xe2573c), 0, 0.84, 0.335, 0.07, 0.56, 0.02)); // nẹp giữa
      break;
    }
    case 'ao_tho_cam_tay_bac': { // áo chàm thêu, vòng bạc, thắt lưng, váy xoè nhiều tầng hoa văn
      torso(); core.add(mesh(GEO.cyl, mat(0xdfe6ee), 0, 1.13, 0.03, 0.24, 0.035, 0.22)); // vòng bạc
      for (const [y, c] of [[1.0, 0xe8457f], [0.92, 0x4fb36a]] as const) core.add(band(c, y, 0.385, 0.045, 0.33));
      core.add(band(0xe2573c, 0.62, 0.39, 0.1, 0.33));
      core.add(mesh(frustum(0.36, 0.64, 0.52, 12), mat(0x1c2a4a), 0, 0.33, 0));
      for (const [y, c, r] of [[0.3, 0xe8457f, 0.545], [0.2, 0xffd23f, 0.6], [0.12, 0x4fb36a, 0.635]] as const) core.add(mesh(frustum(r - 0.012, r + 0.012, 0.05, 12), mat(c), 0, y, 0));
      for (const sx of [-1, 1]) core.add(mesh(GEO.box, mat(0xe8457f), sx * 0.12, 0.86, 0.33, 0.07, 0.4, 0.02)); // hai dải thêu trước ngực
      break;
    }
    case 'ao_toi': { // áo tơi kết lá cọ nhiều lớp, buộc dây ở cổ
      core.add(mesh(GEO.ball, cloth, 0, 0.84, 0, 0.36, 0.42, 0.3));
      for (const [y, t, b, h, c] of [[1.02, 0.2, 0.5, 0.26, 0xb89a55], [0.8, 0.4, 0.58, 0.3, 0xa88b4a], [0.56, 0.5, 0.64, 0.3, 0x977b3e]] as const) core.add(mesh(frustum(t, b, h, 12), mat(c), 0, y, -0.02));
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; core.add(tilt(mesh(GEO.box, mat(0x8a6f36), Math.sin(a) * 0.62, 0.4, Math.cos(a) * 0.62 - 0.02, 0.07, 0.16, 0.02), 0, a)); } // tua lá ở gấu
      core.add(mesh(GEO.box, mat(0x6b4a2f), 0, 1.12, 0.26, 0.2, 0.03, 0.02));
      break;
    }
    case 'do_bao_ho': { // áo dài tay xanh lá, dải phản quang, túi ngực, ủng
      torso(); hem();
      core.add(band(0xd7ff4a, 0.9, 0.405, 0.07, 0.345), band(0xbfc6cc, 0.9, 0.41, 0.025, 0.35));
      for (const sx of [-1, 1]) core.add(mesh(GEO.box, mat(0xd7ff4a), sx * 0.2, 1.02, 0.3, 0.06, 0.26, 0.02));
      core.add(mesh(GEO.box, dark, 0.2, 0.72, 0.32, 0.17, 0.15, 0.03), mesh(GEO.cyl, dark, 0, 1.15, 0.03, 0.21, 0.07, 0.2));
      core.add(mesh(GEO.cyl, mat(look.shoe), -0.16, 0.2, 0, 0.16, 0.32, 0.17), mesh(GEO.cyl, mat(look.shoe), 0.16, 0.2, 0, 0.16, 0.32, 0.17)); // thân ủng (đứng yên, che ống chân)
      break;
    }
    case 'ao_so_mi': { // sơ mi sáng màu có cổ bẻ, nẹp khuy, túi ngực, thắt lưng, quần tây
      torso(); const w = mat(WHITE);
      for (const sx of [-1, 1]) core.add(tilt(mesh(GEO.box, w, sx * 0.1, 1.15, 0.2, 0.17, 0.05, 0.14), 0.4, 0, sx * -0.5)); // cổ bẻ
      core.add(mesh(GEO.box, mat(0xd5dbe4), 0, 0.84, 0.335, 0.05, 0.56, 0.02)); buttons(0x9aa6b5, [1.02, 0.9, 0.78, 0.66]);
      core.add(mesh(GEO.box, mat(0xd5dbe4), 0.2, 0.96, 0.31, 0.15, 0.14, 0.02));
      core.add(band(0x5a3a22, 0.54, 0.37, 0.07, 0.32), mesh(GEO.box, mat(0xd9b44a), 0, 0.54, 0.325, 0.09, 0.07, 0.02)); // thắt lưng, khoá
      break;
    }
    case 'ao_thun': { // áo thun cổ tròn có hình in, quần jean xắn gấu
      torso(); hem(mat(0x3d6fb4));
      core.add(mesh(GEO.cyl, mat(0xfdf9ef), 0, 1.16, 0.02, 0.2, 0.04, 0.19));
      core.add(mesh(GEO.cyl, mat(0xffd23f), 0, 0.9, 0.33, 0.13, 0.02, 0.13).rotateX(Math.PI / 2), mesh(GEO.box, mat(0xe2573c), 0, 0.9, 0.345, 0.14, 0.04, 0.01)); // hình in mặt trời
      core.add(mesh(GEO.box, mat(0x2f5a96), 0.2, 0.52, 0.29, 0.14, 0.1, 0.03));
      break;
    }
    case 'vest': { // áo vest sẫm hai ve, sơ mi trắng, cà vạt đỏ, khăn túi ngực
      torso(); hem();
      const w = mat(WHITE);
      core.add(tilt(mesh(GEO.box, w, 0, 0.98, 0.315, 0.22, 0.34, 0.03), 0, 0, 0)); // ngực sơ mi
      for (const sx of [-1, 1]) { core.add(tilt(mesh(GEO.box, dark, sx * 0.13, 0.98, 0.335, 0.11, 0.4, 0.03), 0, 0, sx * 0.32)); core.add(tilt(mesh(GEO.box, w, sx * 0.08, 1.16, 0.22, 0.13, 0.04, 0.1), 0.4, 0, sx * -0.5)); }
      core.add(mesh(GEO.box, mat(0xc0392b), 0, 0.95, 0.345, 0.06, 0.34, 0.02), mesh(GEO.box, mat(0xc0392b), 0, 1.12, 0.34, 0.08, 0.06, 0.03)); // cà vạt
      core.add(mesh(GEO.box, w, 0.22, 0.98, 0.31, 0.09, 0.04, 0.02)); buttons(0x11131a, [0.74, 0.64]);
      break;
    }
    case 'ao_mua': { // áo mưa cánh dơi trùm rộng tới gối, có mũ trùm
      core.add(mesh(frustum(0.22, 0.7, 0.86, 10), cloth, 0, 0.72, 0)); core.add(mesh(frustum(0.7, 0.7, 0.03, 10), dark, 0, 0.29, 0));
      core.add(mesh(GEO.ball, cloth, 0, 1.56, -0.08, 0.47, 0.46, 0.45)); // mũ trùm sau đầu
      core.add(mesh(GEO.box, dark, 0, 0.84, 0.48, 0.04, 0.5, 0.02));
      break;
    }
    default: return false;
  }
  return true;
}

/** Nón, mũ: món mua ở cửa hàng hoặc bốn kiểu mặc định. Áo mưa đã có mũ trùm nên bỏ nón rộng vành. */
export function addHeadwear(core: THREE.Group, id: string | null | undefined, fallback = 'non_la') {
  const Y = 1.52;
  switch (id) {
    case 'non_bai_tho': // nón lá mỏng rộng vành, quai lụa tím
      core.add(mesh(new THREE.ConeGeometry(0.72, 0.34, 14), mat(0xf7efd4), 0, 2.0, 0), mesh(GEO.cyl, mat(0xe6dab0), 0, 1.84, 0, 0.72, 0.015, 0.72));
      for (const sx of [-1, 1]) core.add(tilt(mesh(GEO.box, mat(0x8e6bbf), sx * 0.4, Y - 0.02, 0.12, 0.03, 0.62, 0.05), 0, 0, sx * 0.12));
      core.add(mesh(GEO.box, mat(0x8e6bbf), 0, Y - 0.36, 0.16, 0.5, 0.04, 0.05));
      break;
    case 'non_quai_thao': // nón phẳng rộng vành, thành nón cụp xuống, quai thao tua đỏ hai bên
      core.add(mesh(GEO.cyl, mat(0xe8d9a8), 0, 1.98, 0, 0.82, 0.05, 0.82), mesh(new THREE.CylinderGeometry(0.82, 0.8, 0.14, 14, 1, true), mat(0xd9c68e), 0, 1.9, 0), mesh(GEO.cyl, mat(0xcbb67a), 0, 2.02, 0, 0.3, 0.03, 0.3));
      for (const sx of [-1, 1]) { core.add(mesh(GEO.box, mat(0x2b2b2b), sx * 0.6, 1.5, 0.1, 0.03, 0.8, 0.03)); for (let k = 0; k < 3; k++) core.add(mesh(GEO.box, mat(k === 1 ? 0xffd23f : 0xc0392b), sx * 0.6 + (k - 1) * 0.05, 1.0, 0.1, 0.035, 0.26, 0.035)); }
      break;
    case 'non_ngua': // nón lá dày, chóp bạc chạm, vành nẹp
      core.add(mesh(new THREE.ConeGeometry(0.6, 0.46, 12), mat(0xd8c58e), 0, 2.04, 0), mesh(new THREE.ConeGeometry(0.14, 0.2, 8), mat(0xe6e9ee, { rough: 0.3 }), 0, 2.22, 0), mesh(GEO.ball, mat(0xe6e9ee, { rough: 0.3 }), 0, 2.33, 0, 0.04));
      core.add(mesh(GEO.cyl, mat(0xa8935a), 0, 1.83, 0, 0.6, 0.035, 0.6), mesh(new THREE.ConeGeometry(0.42, 0.03, 12), mat(0xa8935a), 0, 2.0, 0));
      core.add(mesh(GEO.box, mat(0xc0392b), 0, Y - 0.36, 0.16, 0.5, 0.04, 0.05));
      break;
    case 'mu_bao_hiem': // mũ nửa đầu có kính chắn gió và quai cài
      core.add(mesh(GEO.ball, mat(0xe2573c, { rough: 0.5 }), 0, 1.68, -0.02, 0.48, 0.4, 0.5), mesh(GEO.box, mat(0xffffff), 0, 1.76, -0.02, 0.1, 0.34, 0.9));
      core.add(tilt(mesh(GEO.box, mat(0xbfe9ff, { rough: 0.2 }), 0, 1.6, 0.44, 0.62, 0.2, 0.03), -0.25), mesh(GEO.box, mat(0x2b2b2b), 0, 1.66, 0.4, 0.74, 0.05, 0.14));
      for (const sx of [-1, 1]) core.add(tilt(mesh(GEO.box, mat(0x2b2b2b), sx * 0.36, 1.3, 0.12, 0.03, 0.42, 0.05), 0, 0, sx * 0.2));
      break;
    case 'mu_coi': // mũ cối xanh lá: chỏm tròn, vành cứng, núm trên đỉnh
      core.add(mesh(GEO.ball, mat(0x6f7f4f), 0, 1.78, 0, 0.45, 0.32, 0.47), mesh(GEO.cyl, mat(0x6f7f4f), 0, 1.76, 0.02, 0.62, 0.04, 0.68), mesh(GEO.cyl, mat(0x5a683f), 0, 1.8, 0, 0.46, 0.05, 0.48), mesh(GEO.ball, mat(0x5a683f), 0, 2.1, 0, 0.05));
      core.add(mesh(GEO.box, mat(0x4a3a22), 0, 1.82, 0.47, 0.34, 0.035, 0.02));
      break;
    case 'mu_len': // mũ len trùm tai có vành gấp, quả bông và hai tai che
      core.add(mesh(GEO.ball, mat(0xc0533e), 0, 1.72, -0.02, 0.46, 0.4, 0.46), mesh(GEO.cyl, mat(0xf3e9d8), 0, 1.72, 0, 0.47, 0.13, 0.47), mesh(GEO.ball, mat(0xf3e9d8), 0, 2.16, 0, 0.12));
      for (const sx of [-1, 1]) { core.add(mesh(GEO.ball, mat(0xc0533e), sx * 0.42, 1.48, 0, 0.1, 0.2, 0.16)); core.add(mesh(GEO.box, mat(0xf3e9d8), sx * 0.44, 1.2, 0, 0.03, 0.26, 0.03), mesh(GEO.ball, mat(0xf3e9d8), sx * 0.44, 1.05, 0, 0.05)); }
      for (let i = 0; i < 6; i++) core.add(mesh(GEO.box, mat(0x8e3a2a), Math.sin(i * 1.05) * 0.46, 1.86, Math.cos(i * 1.05) * 0.46, 0.06, 0.12, 0.06));
      break;
    default: { const h = id && id !== 'none' ? id : fallback; if (h !== 'none') addHat(core, h); } // 'none' = để đầu trần (ảnh xem trước bộ quần áo)
  }
}

/** Phụ kiện mang trên người. */
export function addAccessory(core: THREE.Group, id: string | null | undefined) {
  switch (id) {
    case 'khan_ran_do': { // khăn rằn ca rô đen trắng quàng cổ, hai đầu thả trước ngực
      for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; core.add(mesh(GEO.box, mat(i % 2 ? 0xf2f2f2 : 0x2b2b2b), Math.sin(a) * 0.27, 1.16, Math.cos(a) * 0.24 + 0.02, 0.17, 0.11, 0.08)); }
      for (const [sx, len] of [[-1, 0.42], [1, 0.3]] as const) for (let k = 0; k < 4; k++) core.add(mesh(GEO.box, mat((k + (sx > 0 ? 1 : 0)) % 2 ? 0xf2f2f2 : 0x2b2b2b), sx * 0.12, 1.08 - (k + 0.5) * (len / 4), 0.345, 0.13, len / 4, 0.03));
      break;
    }
    case 'gui': { // gùi mây đan đeo sau lưng, hai quai vải
      core.add(mesh(new THREE.CylinderGeometry(0.3, 0.2, 0.62, 10, 1), mat(0xa9783f), 0, 0.92, -0.5), mesh(GEO.cyl, mat(0x7a5428), 0, 1.24, -0.5, 0.31, 0.05, 0.31), mesh(GEO.cyl, mat(0x7a5428), 0, 0.62, -0.5, 0.21, 0.04, 0.21));
      for (const y of [0.78, 0.94, 1.1]) core.add(mesh(new THREE.CylinderGeometry(0.2 + (y - 0.62) * 0.16 + 0.012, 0.2 + (y - 0.62) * 0.16 + 0.004, 0.03, 10, 1), mat(0xc79a58), 0, y, -0.5));
      for (const [x, c] of [[-0.1, 0x7ccf4f], [0.1, 0xffd23f], [0, 0xe2573c]] as const) core.add(mesh(GEO.ball, mat(c), x, 1.3, -0.5 + (x === 0 ? 0.08 : -0.04), 0.11));
      for (const sx of [-1, 1]) core.add(tilt(mesh(GEO.box, mat(0x8e3a2a), sx * 0.22, 0.98, 0.0, 0.06, 0.5, 0.7), 0, 0, 0));
      break;
    }
    case 'quang_ganh': { // đòn gánh tre trên vai, hai thúng treo quang mây
      core.add(tilt(mesh(GEO.cyl, mat(0xc9a35a), 0, 1.25, -0.06, 0.035, 2.3, 0.035), 0, 0, Math.PI / 2));
      for (const sx of [-1, 1]) {
        const x = sx * 1.05;
        for (const dz of [-0.16, 0.16]) for (const dx of [-0.14, 0.14]) core.add(tilt(mesh(GEO.box, mat(0x8a6a3a), x + dx / 2, 0.86, -0.06 + dz / 2, 0.018, 0.78, 0.018), dz * 0.9, 0, -dx * 0.9));
        core.add(mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.2, 10, 1), mat(0xb98a4a), x, 0.42, -0.06), mesh(GEO.cyl, mat(0x8a6a3a), x, 0.52, -0.06, 0.31, 0.03, 0.31));
        for (const [dx, dz, c] of [[-0.1, 0.05, sx > 0 ? 0xf08a24 : 0x7ccf4f], [0.1, -0.03, sx > 0 ? 0xffd23f : 0xe2573c], [0, 0.1, sx > 0 ? 0xf08a24 : 0x9bd64a]] as const) core.add(mesh(GEO.ball, mat(c), x + dx, 0.6, -0.06 + dz, 0.11));
      }
      break;
    }
    case 'tui_coi': { // túi cói đeo chéo bên hông
      core.add(mesh(GEO.box, mat(0xcdb37a), 0.44, 0.62, 0.06, 0.12, 0.34, 0.4), mesh(GEO.box, mat(0xa98f55), 0.44, 0.8, 0.06, 0.13, 0.04, 0.42), mesh(GEO.box, mat(0xe2573c), 0.505, 0.62, 0.06, 0.01, 0.1, 0.4));
      core.add(tilt(mesh(GEO.box, mat(0xa98f55), 0.04, 0.98, 0.31, 0.9, 0.05, 0.02), 0, 0, 0.72), tilt(mesh(GEO.box, mat(0xa98f55), 0.04, 0.98, -0.31, 0.9, 0.05, 0.02), 0, 0, 0.72));
      break;
    }
    case 'ba_lo': { // ba lô vải sau lưng, túi phụ, bình nước bên hông, hai quai
      core.add(mesh(GEO.box, mat(0x3d6fb4), 0, 0.92, -0.44, 0.52, 0.62, 0.28), mesh(GEO.box, mat(0x2f5a96), 0, 0.78, -0.6, 0.38, 0.28, 0.08), mesh(GEO.ball, mat(0x3d6fb4), 0, 1.22, -0.44, 0.26, 0.1, 0.14));
      core.add(mesh(GEO.cyl, mat(0xdfe6ee, { rough: 0.3 }), 0.31, 0.82, -0.44, 0.07, 0.3, 0.07), mesh(GEO.cyl, mat(0xe2573c), 0.31, 0.99, -0.44, 0.05, 0.05, 0.05));
      for (const sx of [-1, 1]) core.add(mesh(GEO.box, mat(0x2f5a96), sx * 0.22, 0.98, 0.0, 0.07, 0.5, 0.68));
      break;
    }
    case 'kinh_ram': { // kính đen hai mắt, cầu kính và gọng
      for (const sx of [-1, 1]) core.add(mesh(GEO.box, mat(0x111114, { rough: 0.3 }), sx * 0.16, 1.55, 0.41, 0.2, 0.13, 0.03), mesh(GEO.box, mat(0x111114), sx * 0.34, 1.56, 0.22, 0.02, 0.03, 0.4));
      core.add(mesh(GEO.box, mat(0x111114), 0, 1.58, 0.42, 0.14, 0.03, 0.02));
      break;
    }
    default:
  }
}

export const WEAR_IDS = {
  ao: ['ao_ba_ba', 'ao_dai_trang', 'ao_dai_tim_hue', 'ao_tu_than', 'ao_tho_cam_tay_nguyen', 'ao_tho_cam_tay_bac', 'ao_toi', 'do_bao_ho', 'ao_so_mi', 'ao_thun', 'vest', 'ao_mua'],
  non: ['non_bai_tho', 'non_quai_thao', 'non_ngua', 'mu_bao_hiem', 'mu_coi', 'mu_len'],
  phu_kien: ['khan_ran_do', 'gui', 'quang_ganh', 'tui_coi', 'ba_lo', 'kinh_ram'],
} as const;
export { BLACK as WARDROBE_BLACK };

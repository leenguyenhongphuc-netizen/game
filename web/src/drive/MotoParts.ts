// Mô hình xe máy, mô tô và người lái đội mũ bảo hiểm (low-poly, cùng phong cách các xe khác). Đầu xe hướng -z, gốc ở mặt đất giữa hai bánh.
import * as THREE from 'three';
import { GEO, mat, mesh } from '../scene/plants.ts';
import { bakeColored } from '../scene/batch.ts';

export type MotoStyle = 'so' | 'ga' | 'con_tay' | 'adventure' | 'dien';
export interface MotoModel {
  /** Gốc đặt trên mặt đường; xoay quanh trục y theo hướng đi. */
  root: THREE.Group;
  /** Phần nghiêng khi vào cua (xe + người), xoay quanh trục z. */
  lean: THREE.Group;
  /** Hai bánh (quay quanh trục x khi chạy). */
  wheels: THREE.Object3D[];
  /** Đèn phanh (bật khi bóp phanh). */
  brake: THREE.Mesh;
}
export interface MotoLook { style: MotoStyle; color: number; shirt?: number; helmet?: number; cargo?: boolean }

const DARK = 0x2b2f38, CHROME = 0xc9ced6, SEAT = 0x1d1d22, TIRE = 0x23262c, SKIN = 0xf0c8a0;

function wheel(r: number, w: number, z: number): THREE.Group {
  const g = new THREE.Group();
  const t = mesh(GEO.cyl, mat(TIRE), 0, 0, 0, r, w, r); t.rotation.z = Math.PI / 2; g.add(t);
  const hub = mesh(GEO.cyl, mat(CHROME, { rough: 0.35 }), 0, 0, 0, r * 0.45, w * 1.15, r * 0.45); hub.rotation.z = Math.PI / 2; g.add(hub);
  // nan hoa / mâm: hai thanh chéo để thấy bánh quay
  g.add(mesh(GEO.box, mat(0x8d939c), 0, 0, 0, w * 0.9, r * 1.7, 0.05), mesh(GEO.box, mat(0x8d939c), 0, 0, 0, w * 0.9, 0.05, r * 1.7));
  g.position.set(0, r, z);
  return g;
}

/** Người lái: áo theo màu `shirt`, mũ bảo hiểm (cả đầu với xe côn tay/adventure, nửa đầu với xe số, xe ga). */
function rider(shirt: number, helmet: number, full: boolean, sitY: number, sitZ: number, barY: number, barZ: number, upright: boolean): THREE.Group {
  const g = new THREE.Group(), cloth = mat(shirt), pants = mat(0x2f3c5a);
  const lean = upright ? 0.12 : 0.42; // xe côn tay, adventure ngồi chồm hơn
  const torso = mesh(GEO.box, cloth, 0, sitY + 0.36, sitZ - 0.04, 0.42, 0.62, 0.26); torso.rotation.x = -lean; g.add(torso);
  const headY = sitY + 0.78, headZ = sitZ - 0.04 - Math.sin(lean) * 0.5;
  g.add(mesh(GEO.ball, mat(SKIN), 0, headY, headZ, 0.15, 0.17, 0.15));
  if (full) {
    g.add(mesh(GEO.ball, mat(helmet, { rough: 0.3 }), 0, headY + 0.03, headZ, 0.2, 0.2, 0.21), mesh(GEO.box, mat(0x223344, { rough: 0.2 }), 0, headY + 0.01, headZ - 0.18, 0.24, 0.1, 0.06));
  } else {
    g.add(mesh(GEO.ball, mat(helmet, { rough: 0.35 }), 0, headY + 0.07, headZ, 0.19, 0.14, 0.2), mesh(GEO.box, mat(helmet), 0, headY + 0.06, headZ - 0.17, 0.2, 0.03, 0.08));
  }
  // tay vươn tới ghi đông
  for (const s of [-1, 1]) {
    const sx = s * 0.22, sy = sitY + 0.55, sz = sitZ - 0.08 - Math.sin(lean) * 0.3, hx = s * 0.3, hy = barY, hz = barZ;
    const mid = new THREE.Vector3((sx + hx) / 2, (sy + hy) / 2, (sz + hz) / 2), len = Math.hypot(hx - sx, hy - sy, hz - sz);
    const arm = mesh(GEO.cyl, cloth, mid.x, mid.y, mid.z, 0.055, len, 0.055); arm.lookAt(hx, hy, hz); arm.rotateX(Math.PI / 2); g.add(arm);
    g.add(mesh(GEO.ball, mat(SKIN), hx, hy, hz, 0.05));
    // đùi + cẳng chân, chân đặt lên gác chân
    const thigh = mesh(GEO.box, pants, s * 0.16, sitY + 0.02, sitZ - 0.22, 0.13, 0.13, 0.46); g.add(thigh);
    g.add(mesh(GEO.box, pants, s * 0.18, sitY - 0.22, sitZ - 0.42, 0.11, 0.42, 0.12), mesh(GEO.box, mat(0x3a2a1c), s * 0.18, sitY - 0.44, sitZ - 0.48, 0.12, 0.08, 0.22));
  }
  return g;
}

/** Dựng xe máy theo dáng xe, có người lái (hoặc không, để đỗ bên đường). */
export function buildMoto(look: MotoLook, withRider = true): MotoModel {
  const { style, color } = look, root = new THREE.Group(), lean = new THREE.Group(), body = new THREE.Group();
  root.add(lean);
  const paint = mat(color, { rough: 0.35 }), dark = mat(DARK), seat = mat(SEAT);
  let rf = 0.3, rr = 0.3, wb = 1.25, tire = 0.1, sitY = 0.78, sitZ = 0.15, barY = 1.02, barZ = -0.45, full = false, upright = true;
  if (style === 'ga' || style === 'dien') {
    rf = 0.27; rr = 0.27; wb = 1.28; tire = 0.12; sitY = 0.76; sitZ = 0.2; barY = 1.0; barZ = -0.42;
    body.add(mesh(GEO.box, paint, 0, 0.5, 0.25, 0.4, 0.42, 0.9));           // thân sau ôm máy
    body.add(mesh(GEO.box, dark, 0, 0.3, -0.12, 0.34, 0.08, 0.55));         // sàn để chân
    body.add(mesh(GEO.box, paint, 0, 0.66, -0.5, 0.42, 0.78, 0.2));         // yếm trước
    body.add(mesh(GEO.box, seat, 0, 0.76, 0.28, 0.32, 0.1, 0.62));
    body.add(mesh(GEO.box, paint, 0, 1.0, -0.47, 0.5, 0.16, 0.18));         // đầu đèn + ghi đông
    body.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), 0, 0.98, -0.57, 0.08, 0.06, 0.04));
    if (style === 'dien') body.add(mesh(GEO.box, mat(0x35d07f, { emissive: 0x1e9a58 }), 0.205, 0.5, 0.25, 0.02, 0.06, 0.8), mesh(GEO.box, mat(0x35d07f, { emissive: 0x1e9a58 }), -0.205, 0.5, 0.25, 0.02, 0.06, 0.8));
    else body.add(mesh(GEO.cyl, mat(CHROME, { rough: 0.3 }), 0.2, 0.32, 0.5, 0.05, 0.5, 0.05).rotateX(Math.PI / 2));
  } else if (style === 'so') {
    rf = 0.31; rr = 0.31; wb = 1.24; tire = 0.08;
    body.add(mesh(GEO.box, dark, 0, 0.55, -0.1, 0.1, 0.1, 0.8).rotateX(-0.35));   // khung xương ống
    body.add(mesh(GEO.box, paint, 0, 0.62, -0.36, 0.34, 0.42, 0.22));             // yếm
    body.add(mesh(GEO.box, dark, 0, 0.42, 0.08, 0.26, 0.26, 0.34));                // lốc máy
    body.add(mesh(GEO.box, paint, 0, 0.66, 0.36, 0.3, 0.22, 0.56));               // ốp sườn sau
    body.add(mesh(GEO.box, seat, 0, 0.8, 0.22, 0.28, 0.09, 0.7));
    body.add(mesh(GEO.box, mat(0x8d939c), 0, 0.86, 0.66, 0.3, 0.03, 0.3));        // baga sau
    body.add(mesh(GEO.box, paint, 0, 1.02, -0.47, 0.44, 0.14, 0.16), mesh(GEO.box, mat(CHROME, { rough: 0.3 }), 0, 1.04, -0.42, 0.62, 0.03, 0.03));
    body.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), 0, 0.98, -0.57, 0.08, 0.07, 0.04));
    body.add(mesh(GEO.cyl, mat(CHROME, { rough: 0.3 }), 0.18, 0.3, 0.4, 0.04, 0.7, 0.04).rotateX(Math.PI / 2 - 0.08));
    body.add(mesh(GEO.box, dark, 0, 0.62, -0.55, 0.06, 0.6, 0.06).rotateX(0.32)); // phuộc trước
  } else if (style === 'con_tay') {
    rf = 0.31; rr = 0.32; wb = 1.3; tire = 0.11; sitY = 0.82; sitZ = 0.18; barY = 0.98; barZ = -0.38; full = true; upright = false;
    body.add(mesh(GEO.box, paint, 0, 0.82, -0.18, 0.4, 0.3, 0.52));               // bình xăng
    body.add(mesh(GEO.box, paint, 0, 0.78, -0.5, 0.36, 0.34, 0.16).rotateX(0.25)); // mặt nạ đầu
    body.add(mesh(GEO.box, dark, 0, 0.46, 0.0, 0.3, 0.3, 0.5));
    body.add(mesh(GEO.box, seat, 0, 0.85, 0.28, 0.26, 0.09, 0.5));
    body.add(mesh(GEO.box, paint, 0, 0.92, 0.6, 0.22, 0.1, 0.3).rotateX(-0.25));  // đuôi vuốt
    body.add(mesh(GEO.box, dark, 0, 0.62, -0.56, 0.07, 0.62, 0.07).rotateX(0.38));
    body.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), 0, 0.86, -0.6, 0.08, 0.06, 0.04));
    body.add(mesh(GEO.cyl, mat(0x5a5f69, { rough: 0.3 }), 0.2, 0.42, 0.42, 0.06, 0.6, 0.06).rotateX(Math.PI / 2 - 0.3));
  } else { // adventure
    rf = 0.4; rr = 0.38; wb = 1.48; tire = 0.13; sitY = 0.92; sitZ = 0.2; barY = 1.16; barZ = -0.4; full = true; upright = true;
    body.add(mesh(GEO.box, paint, 0, 0.98, -0.2, 0.5, 0.34, 0.6));                // bình xăng to
    body.add(mesh(GEO.box, paint, 0, 1.02, -0.58, 0.42, 0.36, 0.2).rotateX(0.35)); // mặt nạ
    body.add(mesh(GEO.box, mat(0xbfe6f7, { rough: 0.15, transparent: 0.7 }), 0, 1.32, -0.62, 0.36, 0.34, 0.03).rotateX(0.4)); // kính chắn gió
    body.add(mesh(GEO.box, paint, 0, 0.92, -0.78, 0.16, 0.06, 0.34).rotateX(0.15)); // mỏ chim
    body.add(mesh(GEO.box, dark, 0, 0.55, 0.0, 0.34, 0.36, 0.56));
    body.add(mesh(GEO.box, seat, 0, 0.95, 0.32, 0.3, 0.1, 0.62));
    for (const s of [-1, 1]) body.add(mesh(GEO.box, mat(0xa7adb5, { rough: 0.3 }), s * 0.36, 0.72, 0.58, 0.18, 0.34, 0.5)); // thùng nhôm hai bên
    body.add(mesh(GEO.box, mat(0xa7adb5, { rough: 0.3 }), 0, 1.1, 0.78, 0.4, 0.3, 0.34)); // thùng sau
    body.add(mesh(GEO.box, dark, 0, 0.72, -0.62, 0.08, 0.82, 0.08).rotateX(0.42));
    body.add(mesh(GEO.ball, mat(0xfff3b0, { emissive: 0xffe08a }), 0, 1.02, -0.69, 0.1, 0.08, 0.04));
  }
  // gương chiếu hậu: luật bắt buộc có gương bên trái
  body.add(mesh(GEO.cyl, dark, -0.27, barY + 0.12, barZ + 0.02, 0.012, 0.24, 0.012), mesh(GEO.box, mat(0x9fd8f0, { rough: 0.15 }), -0.3, barY + 0.24, barZ + 0.02, 0.12, 0.07, 0.02));
  body.add(mesh(GEO.cyl, dark, 0.27, barY + 0.12, barZ + 0.02, 0.012, 0.24, 0.012), mesh(GEO.box, mat(0x9fd8f0, { rough: 0.15 }), 0.3, barY + 0.24, barZ + 0.02, 0.12, 0.07, 0.02));
  // chắn bùn hai bánh
  body.add(mesh(GEO.box, style === 'adventure' ? paint : dark, 0, rf * 2 + 0.06, -wb / 2, 0.16, 0.04, 0.42), mesh(GEO.box, dark, 0, rr * 2 + 0.06, wb / 2 + 0.05, 0.16, 0.04, 0.42));
  if (look.cargo) { // bao hàng nông sản chằng trên baga
    body.add(mesh(GEO.box, mat(0xd8c08a), 0, (style === 'adventure' ? 1.3 : 1.0) + 0.14, 0.72, 0.5, 0.3, 0.4), mesh(GEO.box, mat(0x8a5a2e), 0, (style === 'adventure' ? 1.3 : 1.0) + 0.3, 0.72, 0.52, 0.02, 0.06));
  }
  if (withRider) body.add(rider(look.shirt ?? 0x2f7fd8, look.helmet ?? 0xf4c430, full, sitY, sitZ, barY, barZ, upright));
  const baked = bakeColored(body, true);
  lean.add(baked);
  const fw = wheel(rf, tire, -wb / 2), rw = wheel(rr, tire, wb / 2);
  lean.add(fw, rw);
  const brake = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ color: 0x5a1410 }));
  brake.scale.set(0.14, 0.06, 0.04); brake.position.set(0, (style === 'adventure' ? 1.0 : 0.8), wb / 2 + 0.24); lean.add(brake);
  return { root, lean, wheels: [fw, rw], brake };
}

/** Màu áo/mũ theo hạt giống tên để người chơi khác trông khác nhau. */
export const RIDER_SHIRTS = [0x2f7fd8, 0xe8457f, 0x2faa5a, 0xf08a24, 0x6a3d9a, 0xdc342b, 0x1f9d8f];
export const HELMETS = [0xf4c430, 0xffffff, 0xe0342b, 0x2b2f38, 0x3f8fd6];

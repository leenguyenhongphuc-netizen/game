// Lớp "dẫn đường và hoạt động" dùng chung cho mọi địa danh: trụ mốc thấp thay chùm sáng, dải mũi tên trên nền chỉ tới điểm kế,
// và các điểm tương tác phụ (ngắm cảnh, hỏi đáp, vật đặc trưng). Bọc quanh hàm dựng của từng set nên không set nào phải sửa.
import * as THREE from 'three';
import type { Sight } from '../../../shared/sights.ts';
import { Kit, V, ball, bead, box, cyl, dot, glow, grp, tameSign } from './SightKit.ts';
import type { SightExtra, SightSet } from './SightKit.ts';

/** Trạng thái chia sẻ giữa giao diện (SightWalk) và cảnh: giao diện ghi điểm kế và điểm đã xem, cảnh đọc để tô mốc và vẽ mũi tên. */
export const guide = {
  next: 0, seen: new Set<string>(), extras: [] as PlacedExtra[], done: new Set<number>(),
  /** Tắt mũi tên (khi đang mở thẻ, đang lia máy ngắm cảnh). */
  quiet: false,
  /** Đường dẫn hiện tại (cảnh tìm trên lưới đi bộ, điểm đầu là chân nhân vật); null = không dẫn. */
  route: null as THREE.Vector3[] | null,
};

export type PlacedExtra = SightExtra & { at: THREE.Vector3 };
const SEEN = new THREE.Color(0x4caf3f), TODO = new THREE.Color(0xffc62e), NEXT = new THREE.Color(0xff8a3d);
const ICON: Record<SightExtra['kind'], string> = { ngam_canh: '🔭', hoi_dap: '❓', thu_vat: '✨' };

function iconSprite(text: string): THREE.Sprite {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.fillStyle = '#fff8e4'; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fill(); g.lineWidth = 8; g.strokeStyle = '#7a4a22'; g.stroke();
  g.font = '64px "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#56310f'; g.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(1.5, 1.5, 1); return sp;
}
/** Mũi tên chữ V dẹt nằm trên nền, đầu nhọn hướng về -z. */
function chevron(): THREE.BufferGeometry {
  const w = 0.62, t = 0.3, l = 0.5;
  const p = [0, 0, -l, w, 0, l - t, w, 0, l, 0, 0, -l + t * 1.5, -w, 0, l, -w, 0, l - t];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setIndex([0, 3, 1, 1, 3, 2, 0, 5, 3, 5, 4, 3]); g.computeVertexNormals(); return g;
}

/** Câu hỏi nhanh tự sinh từ lời thuyết minh: "câu này nói về điểm dừng nào?". */
function autoQuiz(sight: Sight, at: THREE.Vector3): PlacedExtra | null {
  if (sight.stops.length < 3) return null;
  const k = Math.min(sight.stops.length - 1, 1 + (sight.id.length % (sight.stops.length - 1))), st = sight.stops[k];
  const others = sight.stops.filter((_, i) => i !== k), a = others[(k * 3) % others.length], b = others[(k * 3 + 1) % others.length === (k * 3) % others.length ? (k * 3 + 2) % others.length : (k * 3 + 1) % others.length];
  const answer = k % 3, options = [a.name, b.name]; options.splice(answer, 0, st.name);
  const clue = st.fact.split(/(?<=[.!?])\s/)[0].replace(new RegExp(st.name, 'gi'), '…');
  return { at, kind: 'hoi_dap', name: 'Hỏi nhanh có thưởng', fact: st.fact, q: `"${clue}" — câu này nói về điểm dừng nào?`, options, answer };
}

export function decorate(kit: Kit, sight: Sight, set: SightSet): SightSet {
  const path = set.path, cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + path[i].distanceTo(path[i - 1]));
  const total = cum[cum.length - 1];
  const at = (s: number, out: THREE.Vector3): number => { // điểm trên lối đi ở quãng s; trả về chỉ số đoạn
    s = Math.max(0, Math.min(total, s)); let i = 0; while (i < path.length - 2 && cum[i + 1] < s) i++;
    const len = cum[i + 1] - cum[i] || 1; out.copy(path[i]).lerp(path[i + 1], (s - cum[i]) / len); return i;
  };
  const side = (i: number, out: THREE.Vector3) => { const d = out.copy(path[i + 1]).sub(path[i]); const l = Math.hypot(d.x, d.z) || 1; return out.set(-d.z / l, 0, d.x / l); };
  // quãng đường của từng điểm dừng: chiếu lên đoạn gần nhất, giữ thứ tự tăng dần (lối đi có thể quay lại chỗ cũ)
  const stopS: number[] = []; let floor = 0; const tmp = V(0, 0, 0), ab = V(0, 0, 0);
  for (const st of set.stops) {
    let best = floor, bd = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      ab.copy(path[i + 1]).sub(path[i]); const l2 = ab.lengthSq() || 1, t = Math.max(0, Math.min(1, tmp.copy(st.at).sub(path[i]).dot(ab) / l2));
      const s = cum[i] + Math.sqrt(l2) * t; if (s < floor - 0.5) continue;
      const d = tmp.copy(path[i]).addScaledVector(ab, t).distanceToSquared(st.at); if (d < bd - 0.01) { bd = d; best = s; }
    }
    stopS.push(best); floor = best;
  }

  // ---- trụ mốc thấp có chóp màu + quầng sáng mềm trên nền (thay chùm sáng vàng)
  const n = set.stops.length, nrm = V(0, 0, 0), q = V(0, 0, 0);
  const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 10, 8), new THREE.MeshBasicMaterial(), n);
  const halo = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: dot(), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }), n);
  const posts: THREE.Vector3[] = [], m4 = new THREE.Matrix4();
  set.stops.forEach((st, i) => {
    const seg = at(stopS[i], q); side(seg, nrm); const p = st.at.clone().addScaledVector(nrm, Math.min(set.half * 0.82, 1.7)); posts.push(p);
    kit.add(cyl(0xf3ead2, p.x, p.y + 0.45, p.z, 0.16, 0.9), cyl(0x7a4a22, p.x, p.y + 0.06, p.z, 0.26, 0.12), cyl(0x7a4a22, p.x, p.y + 0.88, p.z, 0.2, 0.08));
    caps.setMatrixAt(i, m4.makeTranslation(p.x, p.y + 1.12, p.z)); caps.setColorAt(i, TODO);
    halo.setMatrixAt(i, m4.makeScale(4.2, 1, 4.2).setPosition(st.at.x, st.at.y + 0.1, st.at.z)); halo.setColorAt(i, TODO);
  });
  caps.frustumCulled = halo.frustumCulled = false; halo.renderOrder = 2; kit.live(caps, halo);

  // ---- dải mũi tên trên nền chỉ tới điểm kế
  const NA = 9, arrows = new THREE.InstancedMesh(chevron(), new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.9, depthWrite: false }), NA);
  arrows.frustumCulled = false; arrows.renderOrder = 3; kit.live(arrows);
  const e = new THREE.Euler(), qt = new THREE.Quaternion(), sc = V(1, 1, 1), ap = V(0, 0, 0), dir = V(0, 0, 0);

  // ---- điểm tương tác phụ
  const off = (frac: number) => { const seg = at(total * frac, q); side(seg, nrm); return q.clone().addScaledVector(nrm, -(set.half + 0.9)); };
  const extras: PlacedExtra[] = (set.extras ?? []).map((x) => ({ ...x, at: x.at ?? off(x.frac ?? 0.5) }));
  if (!set.extras) {
    extras.push({ at: off(0.42), kind: 'ngam_canh', name: `Ngắm toàn cảnh ${sight.name}`, fact: sight.blurb });
    const quiz = autoQuiz(sight, off(0.74)); if (quiz) extras.push(quiz);
  }
  const icons: THREE.Sprite[] = [];
  for (const x of extras) {
    const p = x.at;
    if (x.kind === 'ngam_canh') kit.add(grp(p.x, p.y, p.z, 0, cyl(0x55606e, 0, 0.6, 0, 0.09, 1.2), cyl(0x3a424e, 0, 0.05, 0, 0.36, 0.1), box(0x2f6f9a, 0, 1.32, 0, 0.5, 0.26, 0.34), cyl(0x1d2a36, -0.13, 1.32, -0.22, 0.09, 0.14).rotateX(Math.PI / 2), cyl(0x1d2a36, 0.13, 1.32, -0.22, 0.09, 0.14).rotateX(Math.PI / 2)));
    else if (x.kind === 'hoi_dap') kit.add(grp(p.x, p.y, p.z, 0, cyl(0x7a4a22, 0, 0.7, 0, 0.07, 1.4), box(0x7a4a22, 0, 1.5, 0, 1.0, 0.8, 0.08), box(0xfff1c9, 0, 1.5, 0.05, 0.86, 0.66, 0.02), box(0xfff1c9, 0, 1.5, -0.05, 0.86, 0.66, 0.02), ball(glow(0xffc62e), 0, 2.05, 0, 0.14)));
    else kit.add(cyl(0xffe9a8, p.x, p.y + 0.04, p.z, 0.9, 0.06), bead(glow(0xffd95e), p.x, p.y + 0.09, p.z, 0.5, 0.03, 0.5));
    const sp = iconSprite(x.emoji ?? ICON[x.kind]); sp.position.set(p.x, p.y + (x.kind === 'thu_vat' ? 2.6 : 2.7), p.z); icons.push(sp); kit.live(sp);
  }
  guide.extras = extras; guide.done = new Set(); guide.next = 0; guide.quiet = false; guide.route = null;

  let tamed = false;
  kit.onTick((t, _dt, pl) => {
    if (!tamed && kit.dyn.parent) { // tắt chùm sáng thô của cảnh, làm dịu vòng tròn dưới chân mốc
      tamed = true;
      for (const o of kit.dyn.parent.children) { const mm = o as THREE.Mesh; if (!mm.isMesh) continue; const g = mm.geometry as THREE.BufferGeometry & { type: string }, mt = mm.material as THREE.MeshBasicMaterial;
        if (g.type === 'CylinderGeometry' && mt.blending === THREE.AdditiveBlending) mt.opacity = 0; else if (g.type === 'RingGeometry') mt.opacity = 0.5; }
      for (const o of kit.dyn.parent.children) if ((o as THREE.Sprite).isSprite) tameSign(o as THREE.Sprite); // số thứ tự lơ lửng: không phóng to khi lại gần
    }
    set.stops.forEach((st, i) => {
      const c = guide.seen.has(st.id) ? SEEN : i === guide.next ? NEXT : TODO, k = guide.seen.has(st.id) ? 0.7 : i === guide.next ? 1.15 + Math.sin(t * 4) * 0.12 : 1;
      caps.setColorAt(i, c); caps.setMatrixAt(i, m4.makeScale(k, k, k).setPosition(posts[i].x, posts[i].y + 1.12, posts[i].z));
      const hk = guide.seen.has(st.id) ? 2.2 : i === guide.next ? 5 + Math.sin(t * 2.5) * 0.6 : 3.4; halo.setColorAt(i, c); halo.setMatrixAt(i, m4.makeScale(hk, 1, hk).setPosition(st.at.x, st.at.y + 0.1, st.at.z));
    });
    caps.instanceMatrix.needsUpdate = halo.instanceMatrix.needsUpdate = true; if (caps.instanceColor) caps.instanceColor.needsUpdate = true; if (halo.instanceColor) halo.instanceColor.needsUpdate = true;
    icons.forEach((sp, i) => { sp.position.y = extras[i].at.y + 2.7 + Math.sin(t * 2 + i) * 0.12; sp.material.opacity = guide.done.has(i) ? 0.35 : 1; });
    // mũi tên: chạy dọc đường dẫn tìm trên lưới đi bộ (vòng qua nhà, tường, mép nước) từ trước mặt người chơi tới đích
    const r = guide.route; let total = 0; if (r) for (let i = 0; i < r.length - 1; i++) total += Math.hypot(r[i + 1].x - r[i].x, r[i + 1].z - r[i].z);
    const show = !guide.quiet && pl.near === null && !!r && r.length > 1 && total > 4;
    arrows.visible = show;
    if (show && r) {
      const gap = 2.3, flow = (t * 2.2) % gap;
      for (let i = 0; i < NA; i++) {
        const off = 2.2 + i * gap + flow, left = total - off;
        if (left < 1.2) { arrows.setMatrixAt(i, m4.makeScale(0, 0, 0)); continue; }
        let d = off, k2 = 0; while (k2 < r.length - 2 && d > Math.hypot(r[k2 + 1].x - r[k2].x, r[k2 + 1].z - r[k2].z)) { d -= Math.hypot(r[k2 + 1].x - r[k2].x, r[k2 + 1].z - r[k2].z); k2++; }
        const a0 = r[k2], a1 = r[k2 + 1], len = Math.hypot(a1.x - a0.x, a1.z - a0.z) || 1; ap.copy(a0).lerp(a1, Math.min(1, d / len)); dir.copy(a1).sub(a0);
        e.set(0, Math.atan2(-dir.x, -dir.z), 0); qt.setFromEuler(e);
        const k = Math.min(1, left / 3) * (1 - i / (NA + 3)) * Math.min(1, off / 3.4); sc.set(k, 1, k); ap.y += 0.1;
        arrows.setMatrixAt(i, m4.compose(ap, qt, sc));
      }
      arrows.instanceMatrix.needsUpdate = true;
    }
  });
  return set;
}

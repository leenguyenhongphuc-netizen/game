// Chạm thẳng vào người chơi khác (thân người, bảng tên, xe) trong cảnh 3D → mở thẻ người chơi (ChatLayer nghe PLAYER_CARD_EVENT).
// Dùng chung cho làng (scene/others.ts), cao tốc (drive/OtherCars.ts); tham quan có bản riêng trong sight/SightOthers.ts.
// Chỉ tính là "chạm" khi ngón tay không kéo quá 10 px và nhả trong 400 ms, để kéo xoay/đi không mở nhầm thẻ.
import * as THREE from 'three';
import { openPlayerCard } from './events.ts';

export interface Pickable { id: number; pts: THREE.Vector3[] }

export function attachTapPick(el: HTMLElement, getCam: () => THREE.Camera | null, candidates: () => Pickable[], radiusPx = 42): () => void {
  let down: { x: number; y: number; t: number } | null = null;
  const v = new THREE.Vector3();
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
  const onUp = (e: PointerEvent) => {
    const d0 = down; down = null; const cam = getCam();
    if (!d0 || !cam || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 10 || performance.now() - d0.t > 400) return;
    const r = el.getBoundingClientRect(); let best: number | null = null, bd = radiusPx;
    for (const c of candidates()) for (const p of c.pts) {
      v.copy(p).project(cam); if (v.z > 1 || v.z < -1) continue;
      const d = Math.hypot((v.x * 0.5 + 0.5) * r.width + r.left - e.clientX, (-v.y * 0.5 + 0.5) * r.height + r.top - e.clientY);
      if (d < bd) { bd = d; best = c.id; }
    }
    if (best !== null) openPlayerCard(best);
  };
  el.addEventListener('pointerdown', onDown, true); el.addEventListener('pointerup', onUp, true);
  return () => { el.removeEventListener('pointerdown', onDown, true); el.removeEventListener('pointerup', onUp, true); };
}

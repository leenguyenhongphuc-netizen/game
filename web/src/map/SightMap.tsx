// Bản đồ kiểu "GTA" cho khu đang tham quan: ảnh chụp từ trên xuống của cả vùng đi được (bắc ở trên), chấm mình + hướng,
// người chơi khác, điểm dừng (đã xem tô xanh), quầy, điểm phụ, lối vào. Kéo để dời, chụm hai ngón / lăn chuột để phóng.
// Chạm một chỗ → đặt điểm đến: cảnh tìm đường trên lưới đi bộ và vẽ mũi tên dọc đường; "Tự đi tới" thì nhân vật tự đi;
// "Huỷ dẫn đường" để tự khám phá.
import { useEffect, useRef, useState } from 'react';
import type { JSX, PointerEvent as RPointerEvent } from 'react';
import type { MapMarks } from '../sight/SightScene.ts';
import './sightmap.css';

/** Phần cảnh mà bản đồ cần (SightScene đáp ứng). */
export interface MapSource {
  mapImage(): { url: string; x0: number; z0: number; w: number; d: number };
  mapMarks(): MapMarks;
  setWaypoint(x: number | null, z?: number): { x: number; z: number } | null;
  followWaypoint(): void;
}
export interface Other { x: number; z: number; name: string; bot: boolean }
const EX_ICON: Record<string, string> = { ngam_canh: '🔭', hoi_dap: '❓', thu_vat: '✨' };

/** Vẽ bản đồ lên canvas theo khung nhìn (tâm cx, cz; k điểm ảnh mỗi mét). Dùng chung cho bản đồ lớn và bản đồ nhỏ. */
export function drawMap(g: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement | null, meta: { x0: number; z0: number; w: number; d: number }, m: MapMarks, others: Other[], view: { cx: number; cz: number; k: number }, small = false): void {
  const X = (x: number) => w / 2 + (x - view.cx) * view.k, Y = (z: number) => h / 2 + (z - view.cz) * view.k;
  g.fillStyle = '#1d2a33'; g.fillRect(0, 0, w, h);
  if (img && img.complete) g.drawImage(img, X(meta.x0), Y(meta.z0), meta.w * view.k, meta.d * view.k);
  // đường dẫn
  if (m.route.length > 1) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = '#3b1d06'; g.lineWidth = small ? 5 : 8; g.beginPath(); m.route.forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.z)) : g.moveTo(X(p.x), Y(p.z)))); g.stroke();
    g.strokeStyle = '#ffb02e'; g.lineWidth = small ? 3 : 5; g.stroke();
  }
  const dot = (x: number, y: number, r: number, fill: string, stroke = '#3b2a17') => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = stroke; g.stroke(); };
  const text = (s: string, x: number, y: number, size: number, color = '#3b2a17') => { g.font = `800 ${size}px "Baloo 2", "Be Vietnam Pro", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color; g.fillText(s, x, y); };
  const emoji = (s: string, x: number, y: number, size: number) => { g.font = `${size}px "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  if (!small) { for (const e of m.extras) emoji(EX_ICON[e.kind] ?? '✨', X(e.x), Y(e.z), 16); for (const s of m.shops) emoji('🛒', X(s.x), Y(s.z), 16); }
  emoji('🚩', X(m.exit.x), Y(m.exit.z) - (small ? 6 : 10), small ? 13 : 20);
  m.stops.forEach((s, i) => { const r = small ? 7 : 12; dot(X(s.x), Y(s.z), r, s.seen ? '#7ccf4f' : '#ffd23f'); text(String(i + 1), X(s.x), Y(s.z) + 1, small ? 9 : 14); });
  for (const o of others) dot(X(o.x), Y(o.z), small ? 3 : 5, o.bot ? '#cfd8e3' : '#4aa3ff', '#123');
  if (m.wp) { emoji('📍', X(m.wp.x), Y(m.wp.z) - (small ? 7 : 12), small ? 15 : 26); }
  // mình: mũi tên theo hướng mặt (heading 0 = nhìn về bắc, -z)
  const mx = X(m.me.x), my = Y(m.me.z), a = m.me.heading, R = small ? 9 : 13;
  g.save(); g.translate(mx, my); g.rotate(a); g.beginPath(); g.moveTo(0, -R); g.lineTo(R * 0.72, R * 0.75); g.lineTo(0, R * 0.38); g.lineTo(-R * 0.72, R * 0.75); g.closePath();
  g.fillStyle = '#ff5a36'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke(); g.restore();
}

export function SightMap({ src, others, onClose }: { src: MapSource; others: () => Other[]; onClose: () => void }): JSX.Element {
  const cv = useRef<HTMLCanvasElement>(null), meta = useRef(src.mapImage()), img = useRef<HTMLImageElement | null>(null);
  const view = useRef({ cx: 0, cz: 0, k: 2 }), ptrs = useRef(new Map<number, { x: number; y: number; sx: number; sy: number }>()), pinch = useRef<number | null>(null);
  const [pick, setPick] = useState<{ x: number; z: number; name: string } | null>(() => { const wp = src.mapMarks().wp; return wp ? { ...wp, name: 'Điểm đã chọn' } : null; });
  useEffect(() => {
    const m = src.mapMarks(), c = cv.current!; const fit = Math.min(c.clientWidth / meta.current.w, c.clientHeight / meta.current.d);
    view.current = { cx: m.me.x, cz: m.me.z, k: Math.max(fit, Math.min(6, fit * 2.2)) };
    const im = new Image(); im.src = meta.current.url; img.current = im;
    let raf = 0, last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop); if (t - last < 50) return; last = t; // 20 hình/giây là đủ cho bản đồ
      const c2 = cv.current; if (!c2) return; const dpr = Math.min(2, window.devicePixelRatio || 1), w = c2.clientWidth, h = c2.clientHeight;
      if (c2.width !== Math.round(w * dpr)) { c2.width = Math.round(w * dpr); c2.height = Math.round(h * dpr); }
      const g = c2.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); drawMap(g, w, h, img.current, meta.current, src.mapMarks(), others(), view.current);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [src, others]);
  const toWorld = (cx: number, cy: number) => { const c = cv.current!.getBoundingClientRect(), v = view.current; return { x: v.cx + (cx - c.left - c.width / 2) / v.k, z: v.cz + (cy - c.top - c.height / 2) / v.k }; };
  const zoom = (f: number, ax?: number, ay?: number) => {
    const v = view.current, c = cv.current!.getBoundingClientRect(), fit = Math.min(c.width / meta.current.w, c.height / meta.current.d) * 0.8, nk = Math.max(fit, Math.min(14, v.k * f));
    if (ax !== undefined && ay !== undefined) { const p = toWorld(ax, ay); v.cx = p.x - (ax - c.left - c.width / 2) / nk; v.cz = p.z - (ay - c.top - c.height / 2) / nk; }
    v.k = nk;
  };
  const down = (e: RPointerEvent<HTMLCanvasElement>) => { e.currentTarget.setPointerCapture(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY }); if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y); } };
  const move = (e: RPointerEvent<HTMLCanvasElement>) => {
    const p = ptrs.current.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (ptrs.current.size === 2 && pinch.current) { const [a, b] = [...ptrs.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y); zoom(d / pinch.current, (a.x + b.x) / 2, (a.y + b.y) / 2); pinch.current = d; return; }
    view.current.cx -= dx / view.current.k; view.current.cz -= dy / view.current.k;
  };
  const up = (e: RPointerEvent<HTMLCanvasElement>) => {
    const p = ptrs.current.get(e.pointerId); ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinch.current = null;
    if (!p || Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 8 || ptrs.current.size) return;
    // chạm: trúng điểm dừng thì chọn điểm dừng, không thì chọn chỗ chạm
    const w = toWorld(e.clientX, e.clientY), m = src.mapMarks(), v = view.current;
    let best: { x: number; z: number; name: string } | null = null, bd = 22 / v.k;
    m.stops.forEach((s, i) => { const d = Math.hypot(s.x - w.x, s.z - w.z); if (d < bd) { bd = d; best = { x: s.x, z: s.z, name: `${i + 1}. ${s.name}` }; } });
    const t = best ?? { ...w, name: 'Điểm đã chọn' }, at = src.setWaypoint(t.x, t.z); setPick(at ? { ...at, name: t.name } : null);
  };
  const me = src.mapMarks().me, dist = pick ? Math.round(Math.hypot(pick.x - me.x, pick.z - me.z)) : 0;
  return (
    <div className="smap" role="dialog" aria-label="Bản đồ khu tham quan">
      <canvas ref={cv} className="smap-cv" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={(e) => zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY)} />
      <div className="smap-top">
        <b>🗺️ Bản đồ</b><small>Chạm một chỗ để đặt điểm đến · kéo để dời · chụm hai ngón để phóng to</small>
        <button className="smap-x" aria-label="Đóng bản đồ" onClick={onClose}>✕</button>
      </div>
      <div className="smap-tools">
        <button aria-label="Phóng to" onClick={() => zoom(1.4)}>＋</button>
        <button aria-label="Thu nhỏ" onClick={() => zoom(1 / 1.4)}>－</button>
        <button aria-label="Về chỗ tôi" onClick={() => { const m = src.mapMarks().me; view.current.cx = m.x; view.current.cz = m.z; }}>◎</button>
      </div>
      <ul className="smap-legend" aria-label="Chú thích"><li><i className="me" />Bạn</li><li><i className="st" />Điểm dừng</li><li><i className="ok" />Đã xem</li><li><i className="pl" />Người chơi</li><li>🚩 Lối vào</li></ul>
      {pick && (
        <div className="smap-pick">
          <div><b>📍 {pick.name}</b><small>cách khoảng {dist} m</small></div>
          <div className="smap-acts">
            <button className="go" onClick={() => { src.followWaypoint(); onClose(); }}>▶ Tự đi tới</button>
            <button onClick={onClose}>Dẫn đường</button>
            <button className="ghost" onClick={() => { src.setWaypoint(null); setPick(null); }}>Huỷ · tự khám phá</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Bản đồ nhỏ góc màn hình: bắc ở trên, theo chân nhân vật; chạm để mở bản đồ lớn. */
export function SightMiniMap({ src, others, onOpen }: { src: MapSource; others: () => Other[]; onOpen: () => void }): JSX.Element {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const meta = src.mapImage(), im = new Image(); im.src = meta.url; let raf = 0, last = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop); if (t - last < 120) return; last = t; // ~8 hình/giây: rẻ, không giành khung với cảnh 3D
      const c = cv.current; if (!c) return; const dpr = Math.min(2, window.devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
      if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
      const g = c.getContext('2d')!, m = src.mapMarks(); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMap(g, w, h, im, meta, m, others(), { cx: m.me.x, cz: m.me.z, k: 1.7 }, true);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [src, others]);
  return <button className="smini" aria-label="Mở bản đồ" onClick={onOpen}><canvas ref={cv} /><span aria-hidden="true">🗺️</span></button>;
}

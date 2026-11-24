// Bản đồ biển kiểu GTA: bản đồ nhỏ tròn ở góc (xoay theo hướng bắc, tâm là tàu mình) và bản đồ lớn chạm để mở:
// kéo để dời, chụm hai ngón/lăn chuột để phóng to, chạm một điểm trên mặt nước để đặt điểm đến (mũi tên dẫn hướng trên HUD).
import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent, WheelEvent as RWheelEvent } from 'react';
import type { Pt, SeaWorld } from './seaWorld.ts';
import type { SeaShip } from './SeaScene.ts';

export interface SeaMapData { me: { x: number; z: number; yaw: number }; ships: SeaShip[]; others: { x: number; z: number; name: string }[]; waypoint: Pt | null }
const pathOf = (r: Pt[]) => `M${r.map(([x, z]) => `${x.toFixed(0)} ${z.toFixed(0)}`).join('L')}Z`;
const SHIP_COLOR: Record<string, string> = { container: '#c0392b', hang_roi: '#7a5232', pha: '#2f4a6b', tau_khach: '#1f6fd1', tau_ca: '#2f6fb5', thung: '#8a6a3c', cano: '#e74c3c' };

function Layers({ w, d, scale }: { w: SeaWorld; d: SeaMapData; scale: number }) {
  const land = useMemo(() => w.rings.map(pathOf).join(' '), [w]);
  const route = useMemo(() => (w.path.length > 1 ? `M${w.path.map(([x, z]) => `${x.toFixed(0)} ${z.toFixed(0)}`).join('L')}` : ''), [w]);
  const k = scale, me = d.me;
  return (
    <>
      <rect x={w.bounds.x0 - 4000} y={w.bounds.z0 - 4000} width={w.bounds.x1 - w.bounds.x0 + 8000} height={w.bounds.z1 - w.bounds.z0 + 8000} fill="#7cc7e6" />
      <path d={land} fill="#cfe5a8" stroke="#8a6a3c" strokeWidth={1.6 * k} fillRule="nonzero" />
      {w.karsts.map((s, i) => <circle key={`k${i}`} cx={s.x} cy={s.z} r={Math.max(s.r, 2.5 * k)} fill="#9aa29a" />)}
      {w.zone && (() => { const Z = w.zone, ox = Z.az, oz = -Z.ax, c = (u: number, v: number) => `${Z.cx + Z.ax * u * Z.halfAlong + ox * v * Z.halfOut},${Z.cz + Z.az * u * Z.halfAlong + oz * v * Z.halfOut}`; return <polygon points={[c(-1, -1), c(1, -1), c(1, 1), c(-1, 1)].join(' ')} fill="rgba(255,210,63,0.12)" stroke="#f2b705" strokeWidth={2 * k} strokeDasharray={`${6 * k} ${4 * k}`} />; })()}
      {route && <path d={route} fill="none" stroke="#ffffff" strokeOpacity={0.75} strokeWidth={3 * k} strokeDasharray={`${10 * k} ${8 * k}`} />}
      {w.kind === 'ferry' && w.buoys.map((b, i) => <circle key={`b${i}`} cx={b.x} cy={b.z} r={2.6 * k} fill={b.red ? '#e0342b' : '#2faa5a'} />)}
      {w.piers.map((p, i) => <g key={`p${i}`}><circle cx={p.x} cy={p.z} r={6 * k} fill="#2f4a6b" stroke="#fff" strokeWidth={2 * k} /><text x={p.x + 9 * k} y={p.z - 8 * k} fontSize={13 * k} fontWeight={700} fill="#3d2a14" stroke="#fffbe6" strokeWidth={3 * k} paintOrder="stroke">{p.name}</text></g>)}
      {d.ships.map((s, i) => <g key={`s${i}`} transform={`translate(${s.x} ${s.z}) rotate(${(s.yaw * 180) / Math.PI})`}><path d={`M0 ${-7 * k}L${4 * k} ${5 * k}L${-4 * k} ${5 * k}Z`} fill={SHIP_COLOR[s.kind] ?? '#555'} stroke="#fff" strokeWidth={k} /></g>)}
      {d.others.map((o, i) => <g key={`o${i}`}><circle cx={o.x} cy={o.z} r={5 * k} fill="#ffd23f" stroke="#3d2a14" strokeWidth={1.5 * k} /><text x={o.x + 7 * k} y={o.z + 4 * k} fontSize={11 * k} fill="#3d2a14" stroke="#fffbe6" strokeWidth={2.5 * k} paintOrder="stroke">{o.name}</text></g>)}
      {d.waypoint && <g><line x1={me.x} y1={me.z} x2={d.waypoint[0]} y2={d.waypoint[1]} stroke="#a855f7" strokeWidth={2.5 * k} strokeDasharray={`${6 * k} ${5 * k}`} /><circle cx={d.waypoint[0]} cy={d.waypoint[1]} r={8 * k} fill="none" stroke="#a855f7" strokeWidth={3 * k} /><circle cx={d.waypoint[0]} cy={d.waypoint[1]} r={2.5 * k} fill="#a855f7" /></g>}
      <g transform={`translate(${me.x} ${me.z}) rotate(${(me.yaw * 180) / Math.PI})`}><path d={`M0 ${-11 * k}L${7 * k} ${8 * k}L0 ${4 * k}L${-7 * k} ${8 * k}Z`} fill="#ffffff" stroke="#e63946" strokeWidth={2.5 * k} strokeLinejoin="round" /></g>
    </>
  );
}

export function SeaMiniMap({ w, d, onOpen }: { w: SeaWorld; d: SeaMapData; onOpen: () => void }) {
  const R = w.kind === 'jetski' ? 260 : 520;
  return (
    <button className="sea-mini" onClick={onOpen} aria-label="Mở bản đồ biển">
      <svg viewBox={`${d.me.x - R} ${d.me.z - R} ${2 * R} ${2 * R}`} aria-hidden="true"><Layers w={w} d={d} scale={R / 130} /></svg>
      <span className="sea-north" aria-hidden="true">B</span>
    </button>
  );
}

export function SeaBigMap({ w, d, onPick, onClose }: { w: SeaWorld; d: SeaMapData; onPick: (p: Pt | null) => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const full = { x: w.bounds.x0, y: w.bounds.z0, w: w.bounds.x1 - w.bounds.x0, h: w.bounds.z1 - w.bounds.z0 };
  const [view, setView] = useState(() => { const s = Math.min(full.w, full.h) * 0.75; return { x: d.me.x - s / 2, y: d.me.z - s / 2, s }; });
  const ptrs = useRef(new Map<number, { x: number; y: number }>()); const moved = useRef(0); const pinch = useRef<number | null>(null);
  const toWorld = (cx: number, cy: number): Pt => { const r = box.current!.getBoundingClientRect(), k = view.s / Math.min(r.width, r.height); const ox = (r.width - view.s / k) / 2, oy = (r.height - view.s / k) / 2; return [view.x + (cx - r.left - ox) * k, view.y + (cy - r.top - oy) * k]; };
  const zoom = (f: number, cx?: number, cy?: number) => setView((v) => { const s = Math.min(Math.max(full.w, full.h) * 1.2, Math.max(120, v.s * f)); const c = cx === undefined ? [v.x + v.s / 2, v.y + v.s / 2] : toWorld(cx, cy!); return { s, x: c[0] - ((c[0] - v.x) * s) / v.s, y: c[1] - ((c[1] - v.y) * s) / v.s }; });
  const down = (e: RPointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved.current = 0; pinch.current = null; };
  const move = (e: RPointerEvent) => {
    const p = ptrs.current.get(e.pointerId); if (!p) return;
    const all = [...ptrs.current.values()];
    if (all.length >= 2) { const [a, b] = all, dist = Math.hypot(a.x - b.x, a.y - b.y); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); const [a2, b2] = [...ptrs.current.values()], d2 = Math.hypot(a2.x - b2.x, a2.y - b2.y); if (pinch.current !== null && dist > 0) zoom(dist / d2, (a2.x + b2.x) / 2, (a2.y + b2.y) / 2); pinch.current = d2; moved.current += 99; return; }
    const r = box.current!.getBoundingClientRect(), k = view.s / Math.min(r.width, r.height), dx = e.clientX - p.x, dy = e.clientY - p.y; moved.current += Math.abs(dx) + Math.abs(dy);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setView((v) => ({ ...v, x: v.x - dx * k, y: v.y - dy * k }));
  };
  const up = (e: RPointerEvent) => {
    const had = ptrs.current.delete(e.pointerId);
    if (had && ptrs.current.size === 0 && moved.current < 8) { const p = toWorld(e.clientX, e.clientY); if (!w.isLand(p[0], p[1])) onPick(p); }
  };
  const wheel = (e: RWheelEvent) => zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
  return (
    <div className="sea-map" role="dialog" aria-label="Bản đồ biển">
      <div className="sea-map-head"><b>🗺️ Bản đồ</b><span>Chạm mặt nước để đặt điểm đến</span><button onClick={onClose} aria-label="Đóng bản đồ">✕</button></div>
      <div className="sea-map-box" ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>
        <svg viewBox={`${view.x} ${view.y} ${view.s} ${view.s}`} preserveAspectRatio="xMidYMid meet"><Layers w={w} d={d} scale={view.s / 420} /></svg>
      </div>
      <div className="sea-map-foot">
        <button onClick={() => zoom(1 / 1.4)} aria-label="Phóng to">＋</button><button onClick={() => zoom(1.4)} aria-label="Thu nhỏ">－</button>
        <button onClick={() => setView((v) => ({ ...v, x: d.me.x - v.s / 2, y: d.me.z - v.s / 2 }))}>📍 Về tàu</button>
        {d.waypoint ? <button className="warn" onClick={() => onPick(null)}>Huỷ điểm đến</button> : <span className="muted">{w.kind === 'ferry' ? 'Mặc định: dẫn về bến đích' : 'Chạy tự do trong vùng phao vàng'}</span>}
      </div>
    </div>
  );
}

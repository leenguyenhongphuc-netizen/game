// Phép chiếu dùng chung cho bản đồ: kinh, vĩ độ → toạ độ SVG (equirectangular, co kinh độ theo cos vĩ độ giữa khung).
import { useEffect, useRef, useState } from 'react';
import type { Ring } from './vn-outline.ts';

export interface BBox { lat0: number; lat1: number; lng0: number; lng1: number }
export interface Proj { w: number; h: number; x: (lng: number) => number; y: (lat: number) => number; pt: (lng: number, lat: number) => [number, number] }

/** Tạo phép chiếu cho một khung; chiều rộng SVG luôn là 1000 đơn vị. */
export function makeProj(b: BBox): Proj {
  const k = Math.cos(((b.lat0 + b.lat1) / 2) * Math.PI / 180);
  const s = 1000 / ((b.lng1 - b.lng0) * k);
  const x = (lng: number) => (lng - b.lng0) * k * s, y = (lat: number) => (b.lat1 - lat) * s;
  return { w: 1000, h: (b.lat1 - b.lat0) * s, x, y, pt: (lng, lat) => [x(lng), y(lat)] };
}
export function ringPath(p: Proj, r: Ring, close = true): string {
  let d = '';
  for (let i = 0; i < r.length; i++) d += `${i ? 'L' : 'M'}${p.x(r[i][0]).toFixed(1)} ${p.y(r[i][1]).toFixed(1)}`;
  return close ? d + 'Z' : d;
}

export interface View { x: number; y: number; w: number; h: number }
/**
 * Kéo, chụm hai ngón, lăn chuột để xem bản đồ. Trả về khung nhìn (viewBox), tỉ lệ đơn vị SVG trên một điểm ảnh,
 * và hàm `tap` để phân biệt chạm với kéo.
 */
export function usePanZoom(full: { w: number; h: number }, maxZoom = 8) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, w: full.w, h: full.h });
  const [px, setPx] = useState(1); // số đơn vị SVG ứng với 1 điểm ảnh khi chưa phóng
  const st = useRef({ pts: new Map<number, { x: number; y: number }>(), moved: 0, dist: 0 });
  const clamp = (v: View): View => {
    const w = Math.min(full.w, Math.max(full.w / maxZoom, v.w)), h = w * full.h / full.w;
    return { w, h, x: Math.min(full.w - w, Math.max(0, v.x)), y: Math.min(full.h - h, Math.max(0, v.y)) };
  };
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width > 0) setPx(full.w / r.width); };
    measure();
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => ro.disconnect();
  }, [full.w]);
  const zoomAt = (f: number, cx?: number, cy?: number) => setView((v) => {
    const el = ref.current, r = el?.getBoundingClientRect();
    const ax = r && cx !== undefined ? (cx - r.left) / r.width : 0.5, ay = r && cy !== undefined ? (cy - r.top) / r.height : 0.5;
    const w = Math.min(full.w, Math.max(full.w / maxZoom, v.w / f)), h = w * full.h / full.w;
    return clamp({ w, h, x: v.x + (v.w - w) * ax, y: v.y + (v.h - h) * ay });
  });
  const focus = (sx: number, sy: number, zoom: number) => setView(() => { const w = full.w / zoom, h = full.h / zoom; return clamp({ w, h, x: sx - w / 2, y: sy - h / 2 }); });
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => { st.current.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (st.current.pts.size === 1) st.current.moved = 0; st.current.dist = 0; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); },
    onPointerMove: (e: React.PointerEvent) => {
      const s = st.current, prev = s.pts.get(e.pointerId); if (!prev) return;
      const r = ref.current!.getBoundingClientRect();
      if (s.pts.size === 1) {
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y; s.moved += Math.abs(dx) + Math.abs(dy);
        setView((v) => clamp({ ...v, x: v.x - dx * v.w / r.width, y: v.y - dy * v.h / r.height }));
      } else if (s.pts.size === 2) {
        s.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const [a, b] = [...s.pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (s.dist > 0 && d > 0) zoomAt(d / s.dist, (a.x + b.x) / 2, (a.y + b.y) / 2);
        s.dist = d; s.moved += 10;
      }
      s.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    },
    onPointerUp: (e: React.PointerEvent) => { st.current.pts.delete(e.pointerId); st.current.dist = 0; },
    onPointerCancel: (e: React.PointerEvent) => { st.current.pts.delete(e.pointerId); st.current.dist = 0; },
    onWheel: (e: React.WheelEvent) => zoomAt(e.deltaY < 0 ? 1.25 : 0.8, e.clientX, e.clientY),
  };
  /** Đổi điểm chạm trên màn hình ra toạ độ SVG; trả null nếu vừa kéo chứ không phải chạm. */
  const tap = (e: React.MouseEvent): [number, number] | null => {
    if (st.current.moved > 8) return null;
    const r = ref.current!.getBoundingClientRect();
    return [view.x + (e.clientX - r.left) * view.w / r.width, view.y + (e.clientY - r.top) * view.h / r.height];
  };
  const zoom = full.w / view.w;
  return { ref, view, zoom, unit: px / zoom, handlers, tap, zoomAt, focus, reset: () => setView({ x: 0, y: 0, w: full.w, h: full.h }) };
}

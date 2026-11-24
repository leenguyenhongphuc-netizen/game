// Cuộn ngang/dọc bằng kéo tay cho các thanh nằm đè lên cảnh 3D.
// Không dùng thanh cuộn gốc của trình duyệt (overflow: auto) vì lớp cuộn ghép chồng lên canvas WebGL
// bị vẽ lệch chỗ trên một số trình duyệt, để lộ một dải nền trống trên màn hình.
import { useCallback, useRef } from 'react';

export function useDragScroll<T extends HTMLElement>(vertical = false) {
  const box = useRef<T | null>(null);
  const st = useRef({ pos: 0, start: 0, base: 0, id: -1, moved: false });
  const max = () => { const b = box.current, t = b?.firstElementChild as HTMLElement | null; if (!b || !t) return 0; return Math.max(0, vertical ? t.scrollHeight - b.clientHeight : t.scrollWidth - b.clientWidth); };
  const apply = useCallback(() => { const t = box.current?.firstElementChild as HTMLElement | null; if (t) t.style.transform = vertical ? `translateY(${-st.current.pos}px)` : `translateX(${-st.current.pos}px)`; }, [vertical]);
  const off = useRef<(() => void) | null>(null);
  // ref dạng hàm: thanh có thể chỉ xuất hiện sau (render có điều kiện), nên gắn sự kiện đúng lúc phần tử được gắn vào trang
  const ref = useCallback((b: T | null) => {
    off.current?.(); off.current = null; box.current = b;
    if (!b) return;
    const s = st.current;
    const down = (e: PointerEvent) => { s.id = e.pointerId; s.start = vertical ? e.clientY : e.clientX; s.base = s.pos; s.moved = false; };
    const move = (e: PointerEvent) => { if (e.pointerId !== s.id) return; const d = (vertical ? e.clientY : e.clientX) - s.start; if (!s.moved && Math.abs(d) < 8) return; if (!s.moved) { s.moved = true; try { b.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ } } s.pos = Math.min(max(), Math.max(0, s.base - d)); apply(); };
    const up = (e: PointerEvent) => { if (e.pointerId === s.id) s.id = -1; };
    const click = (e: MouseEvent) => { if (s.moved) { e.stopPropagation(); e.preventDefault(); s.moved = false; } };
    const wheel = (e: WheelEvent) => { const d = vertical ? e.deltaY : (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY); if (!max()) return; s.pos = Math.min(max(), Math.max(0, s.pos + d)); apply(); e.preventDefault(); };
    const fit = () => { s.pos = Math.min(max(), s.pos); apply(); };
    b.addEventListener('pointerdown', down); b.addEventListener('pointermove', move); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    b.addEventListener('click', click, true); b.addEventListener('wheel', wheel, { passive: false });
    const ro = new ResizeObserver(fit); ro.observe(b); fit();
    off.current = () => { b.removeEventListener('pointerdown', down); b.removeEventListener('pointermove', move); b.removeEventListener('pointerup', up); b.removeEventListener('pointercancel', up); b.removeEventListener('click', click, true); b.removeEventListener('wheel', wheel); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vertical, apply]);
  /** Đưa phần tử con vào tầm nhìn (khi chọn bằng bàn phím). */
  const reveal = useCallback((el: HTMLElement | null) => { const b = box.current; if (!b || !el) return; const a = vertical ? el.offsetTop : el.offsetLeft, l = vertical ? el.offsetHeight : el.offsetWidth, v = vertical ? b.clientHeight : b.clientWidth; const s = st.current; if (a < s.pos) s.pos = a; else if (a + l > s.pos + v) s.pos = a + l - v; s.pos = Math.min(max(), Math.max(0, s.pos)); apply(); }, [vertical, apply]);
  return { ref, reveal };
}

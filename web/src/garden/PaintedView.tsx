// Khung chứa vườn kiểu tranh vẽ: cùng props với WorldView, gán PaintedWorld vào worldRef như thể đó là World.
import { useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { World, Context, WorldState } from '../scene/World.ts';
import type { Planting } from '../api.ts';
import { PaintedWorld } from './PaintedWorld.ts';
import { setPaintedPref } from './pref.ts';
import './garden.css';

export function PaintedView(props: {
  state: WorldState; paused?: boolean; worldRef?: MutableRefObject<World | null>;
  onContext?: (ctx: Context) => void; onReady?: (lot: number, planting: Planting) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<PaintedWorld | null>(null);
  const cb = useRef(props);
  cb.current = props;

  useEffect(() => {
    const hour = new URLSearchParams(location.search).get('gio');
    const w = new PaintedWorld(host.current!, { hour: hour ? Number(hour) : undefined, onContext: (c) => cb.current.onContext?.(c), onReady: (l, p) => cb.current.onReady?.(l, p) });
    world.current = w;
    if (props.worldRef) props.worldRef.current = w as unknown as World;
    (window as unknown as { __vuon?: unknown }).__vuon = w;
    return () => { w.dispose(); world.current = null; if (props.worldRef) props.worldRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(location.search), wk = q.get('thoitiet') as WorldState['weather'] | null;
    world.current?.setState(wk ? { ...props.state, weather: wk } : props.state);
  }, [props.state]);
  useEffect(() => { if (world.current) world.current.paused = !!props.paused; }, [props.paused]);

  return (
    <div className="scene painted">
      <div ref={host} style={{ position: 'absolute', inset: 0 }} />
      <div className="painted-tools">
        <button type="button" aria-label="Phóng to" onClick={() => world.current?.setZoom(world.current.getZoom() * 1.2)}>＋</button>
        <button type="button" aria-label="Thu nhỏ" onClick={() => world.current?.setZoom(world.current.getZoom() / 1.2)}>－</button>
        <button type="button" aria-label="Về chỗ nhân vật" onClick={() => world.current?.recentre()}>◎</button>
        <button type="button" className="mode" aria-label="Đổi sang hiển thị 3D" title="Kiểu hiển thị: Tranh vẽ. Bấm để đổi sang 3D" onClick={() => setPaintedPref(false)}>3D</button>
      </div>
    </div>
  );
}

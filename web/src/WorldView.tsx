import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { World } from './scene/World.ts';
import type { Context, WorldState } from './scene/World.ts';
import type { Planting } from './api.ts';
import { sampleFactory } from './scene/factory.ts';
import type { FactoryData } from './scene/factory.ts';
import { PaintedView } from './garden/PaintedView.tsx';
import { hasPaintedPref, isPainted, setPaintedPref } from './garden/pref.ts';
import './garden/garden.css';

type ViewProps = {
  state: WorldState; demo?: boolean; paused?: boolean; worldRef?: MutableRefObject<World | null>;
  onContext?: (ctx: Context) => void; onReady?: (lot: number, planting: Planting) => void;
};
/** Chọn trình hiển thị vườn: tranh vẽ nhìn chéo (?tranh=1 hoặc localStorage vv-tranh=1) hay 3D (mặc định). Màn chào luôn dùng 3D. */
export function WorldView(props: ViewProps) {
  const [painted, setPainted] = useState(() => !props.demo && isPainted());
  useEffect(() => { const on = (e: Event) => setPainted(!props.demo && !!(e as CustomEvent).detail); window.addEventListener('vv-tranh', on); return () => window.removeEventListener('vv-tranh', on); }, [props.demo]);
  if (painted) return <PaintedView state={props.state} paused={props.paused} worldRef={props.worldRef} onContext={props.onContext} onReady={props.onReady} />;
  return <World3DView {...props} />;
}

/** Khung chứa thế giới 3D phủ kín màn hình. Thêm ?gio=12 vào địa chỉ để ép giờ trong ngày khi thử. */
function World3DView(props: {
  state: WorldState; demo?: boolean; paused?: boolean; worldRef?: MutableRefObject<World | null>;
  onContext?: (ctx: Context) => void; onReady?: (lot: number, planting: Planting) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const cb = useRef(props);
  cb.current = props;
  const [failed, setFailed] = useState(false);
  const sample = useRef<FactoryData | null>(null);

  useEffect(() => {
    const hour = new URLSearchParams(location.search).get('gio');
    try {
      world.current = new World(host.current!, {
        demo: props.demo, hour: hour ? Number(hour) : undefined,
        onContext: (c) => cb.current.onContext?.(c), onReady: (l, p) => cb.current.onReady?.(l, p),
      });
    } catch {
      setFailed(true);
      return;
    }
    if (props.worldRef) props.worldRef.current = world.current;
    if (!props.demo) (window as unknown as { __vuon?: World }).__vuon = world.current;
    return () => { world.current?.dispose(); world.current = null; if (props.worldRef) props.worldRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Tham số thử hình: ?thoitiet=mua|bao|may|nang_gat, ?santhuong=1 và ?xuong=1 (ép vườn đang xem thành xưởng có 5 máy mẫu)
    const q = new URLSearchParams(location.search), w = q.get('thoitiet') as WorldState['weather'] | null, roof = q.get('santhuong'), fac = q.get('xuong');
    if (fac && !sample.current) sample.current = sampleFactory(Date.now() + props.state.clockOffset);
    const state = fac ? { ...props.state, weather: w ?? props.state.weather, lots: props.state.lots.map((l, i) => (l && i === 0 ? { ...l, ownerRole: 'xuong' as const, kind: 'ground' as const, factory: sample.current } : l)) } : w || roof ? { ...props.state, weather: w ?? props.state.weather, lots: props.state.lots.map((l, i) => (l && roof && i === 0 ? { ...l, kind: 'rooftop' as const } : l)) } : props.state;
    world.current?.setState(state);
  }, [props.state]);
  useEffect(() => { if (world.current) world.current.paused = !!props.paused; }, [props.paused]);

  return (
    <div ref={host} className="scene">
      {!props.demo && hasPaintedPref() && <div className="painted-tools"><button type="button" className="mode" aria-label="Đổi sang hiển thị tranh vẽ" title="Kiểu hiển thị: 3D. Bấm để đổi sang tranh vẽ" onClick={() => setPaintedPref(true)}>Tranh</button></div>}
      {failed && <p className="scene-fail">Thiết bị hoặc trình duyệt này chưa bật đồ hoạ 3D (WebGL) nên không hiện được vườn.</p>}
    </div>
  );
}

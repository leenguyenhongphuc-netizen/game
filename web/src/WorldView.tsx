import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { World } from './scene/World.ts';
import type { Context, WorldState } from './scene/World.ts';
import type { Planting } from './api.ts';

/** Khung chứa thế giới 3D phủ kín màn hình. Thêm ?gio=12 vào địa chỉ để ép giờ trong ngày khi thử. */
export function WorldView(props: {
  state: WorldState; demo?: boolean; paused?: boolean; worldRef?: MutableRefObject<World | null>;
  onContext?: (ctx: Context) => void; onReady?: (lot: number, planting: Planting) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const world = useRef<World | null>(null);
  const cb = useRef(props);
  cb.current = props;
  const [failed, setFailed] = useState(false);

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

  useEffect(() => { world.current?.setState(props.state); }, [props.state]);
  useEffect(() => { if (world.current) world.current.paused = !!props.paused; }, [props.paused]);

  return (
    <div ref={host} className="scene">
      {failed && <p className="scene-fail">Thiết bị hoặc trình duyệt này chưa bật đồ hoạ 3D (WebGL) nên không hiện được vườn.</p>}
    </div>
  );
}

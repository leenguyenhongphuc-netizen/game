import { useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { FarmScene } from './scene/FarmScene.ts';
import type { SceneState } from './scene/FarmScene.ts';

/** Khung chứa cảnh 3D phủ kín màn hình. Thêm ?gio=12 vào địa chỉ để ép giờ trong ngày khi thử. */
export function Scene3D(props: {
  state: SceneState; interactive?: boolean; autoRotate?: boolean;
  onSelect?: (tile: number | null) => void; sceneRef?: MutableRefObject<FarmScene | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<FarmScene | null>(null);
  const onSelect = useRef(props.onSelect);
  onSelect.current = props.onSelect;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const hourParam = new URLSearchParams(location.search).get('gio');
    try {
      scene.current = new FarmScene(host.current!, {
        interactive: !!props.interactive, hour: hourParam ? Number(hourParam) : undefined, onSelect: (t) => onSelect.current?.(t),
      });
    } catch {
      setFailed(true);
      return;
    }
    if (props.sceneRef) props.sceneRef.current = scene.current;
    if (props.interactive) (window as unknown as { __vuonScene?: FarmScene }).__vuonScene = scene.current;
    return () => { scene.current?.dispose(); scene.current = null; if (props.sceneRef) props.sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!scene.current) return;
    scene.current.autoRotate = !!props.autoRotate;
    scene.current.setState(props.state);
  }, [props.state, props.autoRotate]);

  return (
    <div ref={host} className="scene">
      {failed && <p className="scene-fail">Thiết bị hoặc trình duyệt này chưa bật đồ hoạ 3D (WebGL) nên không hiện được vườn.</p>}
    </div>
  );
}

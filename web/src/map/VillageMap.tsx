// Bản đồ làng: nút 🗺️ bên phải màn vườn mở bản đồ lớn kiểu GTA (dùng lại SightMap). World cung cấp ảnh chụp từ trên xuống,
// vị trí mình, các thửa (Vườn nhà, nhà hàng xóm), quầy Đại lý xuất khẩu, người chơi khác; chạm chỗ nào để đặt điểm đến rồi tự đi tới.
import { useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { SightMap } from './SightMap.tsx';
import type { MapSource, Other } from './SightMap.tsx';
import type { MapMarks } from '../sight/SightScene.ts';

export interface VillageMapWorld {
  mapImage(): { url: string; x0: number; z0: number; w: number; d: number };
  mapMarks(): MapMarks;
  setWaypoint(x: number | null, z?: number): { x: number; z: number } | null;
  followWaypoint(): void;
  mapOthers(): Other[];
}

export function VillageMap({ getWorld }: { getWorld: () => VillageMapWorld | null }): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const gw = useRef(getWorld); gw.current = getWorld;
  const src = useMemo<MapSource | null>(() => {
    if (!open) return null; const w = gw.current(); if (!w) return null;
    return { mapImage: () => w.mapImage(), mapMarks: () => w.mapMarks(), setWaypoint: (x, z) => w.setWaypoint(x, z), followWaypoint: () => w.followWaypoint() };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const others = useMemo(() => () => gw.current()?.mapOthers() ?? [], []);
  return (
    <>
      <button className="vmap-btn" aria-label="Mở bản đồ làng" onClick={() => setOpen(true)}>🗺️</button>
      {open && src && <SightMap src={src} others={others} onClose={() => setOpen(false)} />}
    </>
  );
}

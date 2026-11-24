// Lớp phủ hoạt cảnh khi lên trò: cảnh 3D riêng, thanh tiến độ, câu cảm thán theo trò, nút bỏ qua.
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import type { Park, ParkRide } from '../../../shared/parks.ts';
import { DEFAULT_VIEW, INSIDE_NAME, RideCutScene, VIEW_NAMES } from './RideCutScene.ts';
import type { ViewMode } from './RideCutScene.ts';
import type { ParkEnv } from './parkSet.ts';
import './park.css';

const LINES: Record<ParkRide['kind'], string[]> = {
  du_quay: ['Lên cao dần…', 'Nhìn kìa, thấy cả biển!', 'Từ từ xuống thôi'],
  tau_luon: ['Lên dốc… tách tách tách', 'AAAAA!', 'Thêm một vòng nữa!'],
  thap_roi: ['Đang kéo lên 50 mét…', 'Dừng… ba… hai…', 'RƠI!!!'],
  cap_treo: ['Cabin rời ga', 'Gió mát quá', 'Sắp tới ga trên'],
  mang_truot: ['Ngồi vào phao…', 'Xoáy xoáy xoáy!', 'Ùm!'],
  nha_ma: ['Tối quá…', 'Có gì đó vừa bay qua!', 'Thấy ánh sáng rồi'],
  xe_dung: ['Đạp ga!', 'Rầm!', 'Tránh ra nào!'],
  ho_song: ['Sóng tới rồi!', 'Nhấp nhô nhấp nhô', 'Thêm đợt nữa'],
  song_luoi: ['Thả trôi thôi', 'Qua màn nước mát lạnh', 'Thư giãn ghê'],
};
export const PARK_ENV: Record<string, ParkEnv> = { park_mw_da_nang: 'nui', park_bw_nha_trang: 'dao', park_mw_ha_long: 'vinh' };

export function RideCut({ park, ride, onDone }: { park: Park; ride: ParkRide; onDone: () => void }): JSX.Element {
  const host = useRef<HTMLDivElement>(null), bar = useRef<HTMLElement>(null), sc = useRef<RideCutScene | null>(null), done = useRef(false);
  const [lines, setLines] = useState<string[]>(LINES[ride.kind]);
  const [line, setLine] = useState(0), [view, setView] = useState<ViewMode>(DEFAULT_VIEW[ride.kind]);
  const finish = () => { if (done.current) return; done.current = true; sc.current?.dispose(); onDone(); };
  useEffect(() => {
    if (!host.current) return;
    const auto = (window as unknown as { __sightAuto?: boolean }).__sightAuto;
    let li = -1;
    // tiến độ đọc ngay trong vòng vẽ của cảnh: ghi thẳng độ rộng thanh, chỉ báo React khi đổi câu thoại
    const onProgress = (p: number, k: number) => { if (bar.current) bar.current.style.width = `${(p * 100).toFixed(1)}%`; if (k !== li) { li = k; setLine(k); } };
    sc.current = new RideCutScene(host.current, { kind: ride.kind, env: PARK_ENV[park.id] ?? 'nui', main: park.palette.main, accent: park.palette.accent, fast: !!auto, onProgress }, finish);
    setLines(sc.current.phaseNames);
    return () => { sc.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = (v: ViewMode) => { sc.current?.setView(v); setView(v); };
  return (
    <div className="pk-ride" role="dialog" aria-label={`Đang chơi ${ride.name}`}>
      <div className="pk-ride-scene" ref={host} />
      <div className="pk-ride-top"><b>{ride.emoji} {ride.name}</b><button className="pk-skip" onClick={finish}>Bỏ qua ›</button></div>
      <div className="pk-ride-line" key={line}>{lines[line]}</div>
      <div className="pk-ride-views" role="group" aria-label="Góc nhìn">
        {(['trong', 'theo', 'toan', 'dien_anh'] as ViewMode[]).map((v) => <button key={v} aria-pressed={view === v} onClick={() => pick(v)}>{v === 'trong' ? INSIDE_NAME[ride.kind] : VIEW_NAMES[v]}</button>)}
      </div>
      <p className="pk-ride-hint">Kéo để nhìn quanh</p>
      <div className="pk-ride-bar" aria-hidden="true"><i ref={bar} /></div>
    </div>
  );
}

// Lớp điều khiển trên cảnh khi ở ngoài đồng: nút lên/xuống máy, hạ/nâng giàn, tiến độ ô đã làm, tiến độ các lượt thuê người/robot/máy,
// phụ đề và nút bỏ qua khi xem tua nhanh, thẻ số sổ của thửa đang đứng. Gửi các ô vừa tự lái lên máy chủ theo lô mỗi ~2 giây.
// App nối: <FieldHud getWorld={() => worldRef.current} /> (chỉ khi người chơi là nhà nông và đang ở xóm nhà).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { JSX } from 'react';
import { FARM_MACHINES, WORK_NAMES, driveTileCap } from '../../shared/farm.ts';
import { api } from './api.ts';
import { fieldZone } from './fieldZone.ts';
import { METHOD_ICON } from './fields.tsx';
import type { FieldsData } from './fields.tsx';
import './fields.css';

type WorldLike = { setFields?: (f: FieldsData['fields'] | null) => void } | null;

function left(t: number): string {
  const s = Math.max(0, Math.round((t - Date.now()) / 1000));
  if (s < 60) return `${s} giây`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m} phút` : `${(m / 60).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ`;
}

export function FieldHud({ getWorld }: { getWorld: () => unknown }): JSX.Element | null {
  const z = useSyncExternalStore(fieldZone.subscribe, fieldZone.get);
  const [err, setErr] = useState<string | null>(null);
  const sending = useRef(false);

  const reload = useCallback(async () => {
    try {
      const d = await api<FieldsData>('GET', '/api/fields');
      fieldZone.setMachines(d.machines.map((m) => m.kind));
      (getWorld() as WorldLike)?.setFields?.(d.fields);
    } catch { /* mất mạng: lần sau thử lại */ }
  }, [getWorld]);

  // có ruộng trong cảnh: tải máy móc một lần, rồi làm mới định kỳ để thấy lượt làm xong, sang bước
  useEffect(() => {
    if (!z.present) return;
    void reload();
    const iv = setInterval(() => void reload(), z.inZone ? 12_000 : 30_000);
    return () => clearInterval(iv);
  }, [z.present, z.inZone, reload]);

  // đang tự lái: gửi các ô vừa làm theo lô
  useEffect(() => {
    if (!z.driving) return;
    const iv = setInterval(async () => {
      if (sending.current) return;
      const batches = fieldZone.takePending(); if (!batches.length) return;
      sending.current = true;
      let finished = false;
      for (const b of batches) {
        // không gửi quá bề rộng giàn trên quãng đường đã đi; phần dư để lô sau
        const cap = driveTileCap(b.meters), now = b.tiles.slice(0, Math.min(400, cap)), rest = b.tiles.slice(now.length);
        if (rest.length) fieldZone.addDriven(b.fieldId, rest, 0, 0.01);
        try {
          const r = await api<{ finished: boolean }>('POST', `/api/fields/${b.fieldId}/drive`, { tiles: now, meters: Math.round(b.meters * 10) / 10, seconds: Math.max(0.1, Math.round(b.seconds * 10) / 10) });
          fieldZone.request({ kind: 'synced', fieldId: b.fieldId, tiles: now, ok: true });
          if (r.finished) finished = true;
          setErr(null);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Không gửi được';
          fieldZone.request({ kind: 'synced', fieldId: b.fieldId, tiles: now, ok: false, note: msg });
          setErr(msg);
        }
      }
      sending.current = false;
      if (finished) void reload();
    }, 2000);
    return () => clearInterval(iv);
  }, [!!z.driving, reload]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!z.present) return null;
  const d = z.driving, sc = z.scene;
  return (
    <div className="fhud" aria-live="polite">
      {sc ? (
        <div className="fhud-scene">
          <strong>{sc.title}</strong>
          <small>{sc.sub}</small>
          <div className="fhud-bar"><i style={{ width: `${Math.round((sc.t / sc.dur) * 100)}%` }} /></div>
          <button onClick={() => fieldZone.request({ kind: 'skip' })}>Bỏ qua ⏭</button>
        </div>
      ) : null}
      {!sc && z.inZone && (z.here || z.jobs.length) ? (
        <div className="fhud-info">
          {z.here ? <span className="fhud-cert">📜 Khối {z.here.block}{z.here.cert ? ` · ${z.here.cert}` : ''}</span> : null}
          {z.jobs.slice(0, 3).map((j) => (
            <span key={j.fieldId} className="fhud-job">{METHOD_ICON[j.method]} {j.label}<i><b style={{ width: `${Math.round(j.progress * 100)}%` }} /></i><small>còn {left(j.endsAt)}</small></span>
          ))}
        </div>
      ) : null}
      {z.routing && !d && !sc ? <button className="fhud-chip" onClick={() => fieldZone.request({ kind: 'goto', fieldId: null })}>🚶 Đang ra đồng…</button> : null}
      {!d && z.canDrive && !sc ? (
        <button className="fhud-main" onClick={() => fieldZone.request({ kind: 'drive', on: true })}>🚜 {z.canDrive.label}</button>
      ) : null}
      {d ? (
        <div className="fhud-drive">
          <div className="fhud-drive-row">
            <strong>{FARM_MACHINES[d.machine].emoji} {FARM_MACHINES[d.machine].name}</strong>
            <small>{d.speed} km/h</small>
          </div>
          {d.fieldId && d.total ? (
            <div className="fhud-drive-row"><span>{d.kind ? WORK_NAMES[d.kind] : 'Ruộng'}: {d.done.toLocaleString('vi-VN')}/{d.total.toLocaleString('vi-VN')} ô</span>
              <div className="fhud-bar"><i style={{ width: `${Math.round((d.done / d.total) * 100)}%` }} /></div></div>
          ) : <small>Lái vào ruộng, hạ giàn rồi chạy dọc luống.</small>}
          {d.note || err ? <small className="fhud-warn">{d.note ?? err}</small> : null}
          <div className="fhud-drive-row">
            <button className={d.implementDown ? 'on' : ''} onClick={() => fieldZone.request({ kind: 'implement' })}>{d.implementDown ? '⬆️ Nâng giàn' : '⬇️ Hạ giàn'}</button>
            <button onClick={() => fieldZone.request({ kind: 'drive', on: false })}>🚪 Xuống máy</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

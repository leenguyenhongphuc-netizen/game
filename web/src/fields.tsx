// Nông trại quy mô lớn: cánh đồng theo khối 100 ô, máy nông nghiệp, drone, trực thăng tham quan (chỉ nhà nông).
// App nối: <FieldsPanel me={me} refresh={refresh} onTour={(t) => mở <HeliTour tour={t} />} onFields={(f) => world.setFields?.(f)} />
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { specialtiesOfRegion } from '../../shared/catalog.ts';
import { fmtMoney } from '../../shared/rules.ts';
import { METHOD_NAMES, WORK_NAMES, workPlan } from '../../shared/farm.ts';
import type { FarmMachineKind, WorkKind, WorkMethod } from '../../shared/farm.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { useAction } from './ui.ts';
import './fields.css';

export interface FieldJob { id: number; kind: WorkKind; method: WorkMethod; machine: FarmMachineKind | null; startedAt: number; endsAt: number; step: number }
export interface FieldRow {
  id: number; regionId: string; regionName: string; blocks: number; tiles: number; areaM2: number;
  specialtyId: string | null; name: string | null; cropId: string | null; emoji: string | null;
  stepIndex: number; stepCount: number; steps: { name: string; kind: WorkKind }[];
  step: { name: string; kind: WorkKind; work: string; methods: WorkMethod[]; harvest: boolean } | null;
  readyAt: number | null; ready: boolean; lateCount: number; expectKg: number; progress: number; color: string;
  job: FieldJob | null; pricePaid: number; resale: number;
}
export interface FarmMachineRow { kind: FarmMachineKind; name: string; emoji: string; price: number; minLevel: number; works: WorkKind[]; tilesPerHour: number; costPerTile: number; note: string; owned: boolean; busyUntil: number | null; canBuy: boolean; why: string | null }
export interface FieldsData {
  level: number; role: string; cash: number; canOwn: boolean; whyNot: string | null; usedBlocks: number; maxBlocks: number; maxPerField: number; blockTiles: number;
  regions: { id: string; name: string; province: string; blockPrice: number; home: boolean }[];
  fields: FieldRow[]; settled: { fieldId: number; harvested?: { kg: number; quality: string } }[];
  machines: { kind: FarmMachineKind; busyUntil: number | null }[]; heli: { own: boolean; fee: number; minLevel: number };
}
export interface HeliTourData { fee: number; own: boolean; fields: { id: number; regionName: string; blocks: number; cropId: string | null; emoji: string | null; name: string | null; progress: number; color: string; stepName: string | null; job: FieldJob | null }[] }

const num = (n: number) => n.toLocaleString('vi-VN');
const kg = (n: number) => (n >= 1000 ? `${(n / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tấn` : `${num(n)} kg`);
function until(t: number | null): string {
  if (!t) return '';
  const s = Math.max(0, Math.round((t - Date.now()) / 1000));
  if (s < 60) return `${s} giây`;
  const m = Math.round(s / 60);
  return m < 90 ? `${m} phút` : `${(m / 60).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ`;
}
const METHOD_ICON: Record<WorkMethod, string> = { tay: '🧑‍🌾', thue: '👥', may: '🚜', drone: '🛸' };

/** Bản đồ tổng quan: mỗi ô vuông nhỏ là một khối 100 ô, tô màu theo cây và độ chín; khối đang có máy chạy có viền nhấp nháy. */
export function FieldMap({ fields, selected, onPick }: { fields: FieldRow[]; selected?: number | null; onPick?: (id: number) => void }): JSX.Element {
  const cells = fields.flatMap((f) => Array.from({ length: f.blocks }, (_, i) => ({ f, i })));
  const cols = Math.max(4, Math.ceil(Math.sqrt(Math.max(1, cells.length))));
  const rows = Math.max(1, Math.ceil(cells.length / cols));
  const S = 22;
  return (
    <svg className="field-map" viewBox={`0 0 ${cols * S} ${rows * S}`} role="img" aria-label={`Bản đồ ${cells.length} khối ruộng`}>
      {cells.map(({ f, i }, k) => {
        const x = (k % cols) * S, y = Math.floor(k / cols) * S;
        return (
          <g key={`${f.id}-${i}`} onClick={() => onPick?.(f.id)} className={`${f.job ? 'busy' : ''} ${selected === f.id ? 'sel' : ''}`}>
            <rect x={x + 1} y={y + 1} width={S - 2} height={S - 2} rx={3} fill={f.color} />
            {i === 0 && f.emoji ? <text x={x + S / 2} y={y + S / 2 + 4} textAnchor="middle" fontSize={11}>{f.job ? METHOD_ICON[f.job.method] : f.emoji}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

export function FieldsPanel({ me: _me, refresh, onTour, onFields }: { me: Me; refresh: () => void; onTour?: (t: HeliTourData) => void; onFields?: (d: FieldsData) => void }): JSX.Element {
  const [data, setData] = useState<FieldsData | null>(null);
  const [machines, setMachines] = useState<FarmMachineRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [tab, setTab] = useState<'ruong' | 'may' | 'mua'>('ruong');
  const [buyRegion, setBuyRegion] = useState<string>('');
  const [buyBlocks, setBuyBlocks] = useState(1);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [d, m] = await Promise.all([api<FieldsData>('GET', '/api/fields'), api<{ catalog: FarmMachineRow[] }>('GET', '/api/farm/machines')]);
      setData(d); setMachines(m.catalog); setLoadError(null); onFields?.(d);
      const h = d.settled.find((s) => s.harvested);
      if (h?.harvested) setNote(`Đã thu hoạch ${kg(h.harvested.kg)} (loại ${h.harvested.quality}) vào kho.`);
    } catch (e) { setLoadError(e instanceof Error ? e.message : 'Không tải được nông trại.'); }
  }, [onFields]);
  useEffect(() => { void load(); const t = setInterval(() => void load(), 15_000); return () => clearInterval(t); }, [load]);
  const act = useAction(() => { void load(); refresh(); });
  const owned = useMemo(() => machines.filter((m) => m.owned).map((m) => m.kind), [machines]);
  const field = data?.fields.find((f) => f.id === sel) ?? data?.fields[0] ?? null;
  useEffect(() => { if (data && !buyRegion) setBuyRegion(data.regions.find((r) => r.home)?.id ?? data.regions[0]?.id ?? ''); }, [data, buyRegion]);

  if (loadError) return <div className="fields"><p className="veh-tip">{loadError}</p><button onClick={() => void load()}>Thử lại</button></div>;
  if (!data) return <div className="fields"><p className="veh-tip">Đang tải nông trại…</p></div>;
  if (!data.canOwn) return <div className="fields"><p className="veh-tip">{data.whyNot ?? 'Cánh đồng lớn dành cho nhà nông từ cấp 5.'}</p></div>;
  const region = data.regions.find((r) => r.id === buyRegion);
  const room = data.maxBlocks - data.usedBlocks;

  return (
    <div className="fields">
      <div className="fields-head">
        <div><strong>{num(data.usedBlocks * data.blockTiles)} ô</strong><small>{data.usedBlocks}/{data.maxBlocks} khối · {data.fields.length} cánh đồng</small></div>
        <button className="heli" disabled={act.busy || !data.fields.length || (!data.heli.own && data.level < data.heli.minLevel)}
          onClick={() => act.run(async () => { const t = await api<HeliTourData>('POST', '/api/farm/heli/tour', {}); onTour?.(t); })}>
          🚁 {data.heli.own ? 'Bay trực thăng' : `Thuê trực thăng ${fmtMoney(data.heli.fee)}`}
        </button>
      </div>
      {note ? <p className="veh-note">{note}</p> : null}
      {act.error ? <p className="veh-tip err">{act.error}</p> : null}
      <div className="veh-filter" role="tablist">
        {([['ruong', '🌾 Cánh đồng'], ['may', '🚜 Máy móc'], ['mua', '➕ Mua ruộng']] as const).map(([k, t]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{t}</button>
        ))}
      </div>

      {tab === 'ruong' && (
        <section>
          {data.fields.length ? <FieldMap fields={data.fields} selected={field?.id} onPick={setSel} /> : <p className="veh-tip">Chưa có cánh đồng nào. Mua khối đầu tiên ở thẻ "Mua ruộng".</p>}
          <div className="field-list">
            {data.fields.map((f) => (
              <button key={f.id} className={`field-chip ${field?.id === f.id ? 'on' : ''}`} onClick={() => setSel(f.id)}>
                <i style={{ background: f.color }} />{f.emoji ?? '🟫'} {f.blocks} khối · {f.regionName}
              </button>
            ))}
          </div>
          {field ? <FieldCard f={field} owned={owned} busy={act.busy} run={act.run} /> : null}
        </section>
      )}

      {tab === 'may' && (
        <section>
          {machines.map((m) => (
            <div key={m.kind} className={`veh-row ${m.owned ? 'owned' : ''}`}>
              <span className="big">{m.emoji}</span>
              <div className="grow">
                <strong>{m.name}</strong>
                <small>{m.works.length ? `${m.works.map((w) => WORK_NAMES[w]).join(', ')} · ${num(m.tilesPerHour)} ô/giờ · ${num(m.costPerTile)} đ/ô` : m.note}</small>
                <small>Cấp {m.minLevel} · {m.owned ? (m.busyUntil && m.busyUntil > Date.now() ? `đang chạy, rảnh sau ${until(m.busyUntil)}` : 'đang rảnh') : m.note}</small>
              </div>
              {m.owned ? <span className="tag">Đã có</span> : (
                <button className="go" disabled={act.busy || !m.canBuy} title={m.why ?? ''}
                  onClick={() => act.run(() => api('POST', '/api/farm/machines/buy', { kind: m.kind }))}>{fmtMoney(m.price)}</button>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === 'mua' && (
        <section>
          <label className="field-label">Vùng
            <select value={buyRegion} onChange={(e) => setBuyRegion(e.target.value)}>
              {data.regions.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.province}) · {fmtMoney(r.blockPrice)}/khối{r.home ? ' · vùng nhà' : ''}</option>)}
            </select>
          </label>
          <label className="field-label">Số khối (100 ô mỗi khối): <b>{buyBlocks}</b>
            <input type="range" min={1} max={Math.max(1, Math.min(data.maxPerField, room))} value={buyBlocks} onChange={(e) => setBuyBlocks(Number(e.target.value))} />
          </label>
          <p className="veh-tip">{num(buyBlocks * data.blockTiles)} ô ≈ {(buyBlocks * 0.25).toLocaleString('vi-VN')} ha · {region ? fmtMoney(region.blockPrice * buyBlocks) : '—'} (chưa gồm lệ phí sổ) · còn được mua {room} khối ở cấp {data.level}.</p>
          <button className="go wide" disabled={act.busy || room < 1 || !region}
            onClick={() => act.run(async () => { const r = await api<{ fieldId: number }>('POST', '/api/fields/buy', { regionId: buyRegion, blocks: buyBlocks }); setSel(r.fieldId); setTab('ruong'); })}>
            Mua {buyBlocks} khối ruộng
          </button>
        </section>
      )}
    </div>
  );
}

function FieldCard({ f, owned, busy, run }: { f: FieldRow; owned: FarmMachineKind[]; busy: boolean; run: (fn: () => Promise<unknown>) => Promise<void> }): JSX.Element {
  const [pick, setPick] = useState('');
  const options = specialtiesOfRegion(f.regionId);
  if (!f.specialtyId) {
    return (
      <div className="veh-card">
        <strong>Cánh đồng trống · {num(f.tiles)} ô · {f.regionName}</strong>
        <select value={pick || options[0]?.id} onChange={(e) => setPick(e.target.value)}>
          {options.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="veh-acts">
          <button className="go" disabled={busy} onClick={() => run(() => api('POST', `/api/fields/${f.id}/plant`, { specialtyId: pick || options[0]?.id }))}>Gieo trồng cả cánh đồng</button>
          <button disabled={busy} onClick={() => run(() => api('POST', `/api/fields/${f.id}/sell`, {}))}>Bán lại {fmtMoney(f.resale)}</button>
        </div>
      </div>
    );
  }
  const st = f.step!;
  return (
    <div className="veh-card on">
      <div className="veh-head"><span className="big">{f.emoji}</span><div>
        <strong>{f.name} · {num(f.tiles)} ô</strong>
        <small>Bước {f.stepIndex + 1}/{f.stepCount}: <b>{st.name}</b> ({st.work}) · dự kiến {kg(f.expectKg)}{f.lateCount ? ` · trễ ${f.lateCount} lần` : ''}</small>
      </div></div>
      <div className="field-bar"><i style={{ width: `${Math.round(f.progress * 100)}%`, background: f.color }} /></div>
      {f.job ? (
        <p className="veh-cmp">{METHOD_ICON[f.job.method]} Đang {METHOD_NAMES[f.job.method].toLowerCase()}: xong sau {until(f.job.endsAt)}.</p>
      ) : !f.ready ? (
        <p className="veh-tip">Cây đang lớn, tới bước sau còn {until(f.readyAt)}.</p>
      ) : (
        <div className="field-methods">
          {st.methods.map((m) => {
            const p = workPlan(st.kind, m, f.tiles, owned);
            return (
              <button key={m} className={p.ok ? 'go' : ''} disabled={busy || !p.ok} title={p.why ?? ''}
                onClick={() => run(() => api('POST', st.harvest ? `/api/fields/${f.id}/harvest` : `/api/fields/${f.id}/work`, { step: f.stepIndex, method: m }))}>
                <span>{METHOD_ICON[m]} {METHOD_NAMES[m]}</span>
                <small>{p.ok ? `${p.cost ? fmtMoney(p.cost) : 'miễn phí'} · ${p.hours < 1 ? `${Math.round(p.hours * 60)} phút` : `${p.hours.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ`}${p.energy ? ` · ${p.energy} sức` : ''}` : p.why}</small>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

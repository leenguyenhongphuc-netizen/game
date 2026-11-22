// Trung tâm mua sắm: quần áo, nón, phụ kiện, kiểu nhà, nội thất, đồ sân vườn, xe cá nhân.
// Đồ đặc trưng vùng miền chỉ bán ở tỉnh đó: phải tới nơi mới mua được.
import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { fmtMoney } from '../../shared/rules.ts';
import type { EquipSlot, Good, GoodCategory } from '../../shared/shop.ts';
import { api } from './api.ts';
import type { Me } from './api.ts';
import { useAction } from './ui.ts';
import './vehicles.css';

interface GoodRow extends Good { owned: boolean; available: boolean; canBuy: boolean; why: string | null; slot: string | null; ride?: { perKm: number; maxKm: number } }
export interface ShoppingData { where: string[]; here: string[]; level: number; cash: number; categories: Record<GoodCategory, { name: string; emoji: string; slot: string | null; note: string }>; equipped: Partial<Record<EquipSlot, string | null>>; items: GoodRow[] }

const O = '#56310f';
const S = { stroke: O, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const SKIN = '#f3c9a0';
const darker = (hex: string) => { const n = parseInt(hex.replace('#', ''), 16); const f = (v: number) => Math.max(0, Math.round(v * 0.72)); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; };

/** Hình xem trước tự vẽ theo loại món, màu chủ đạo và gợi ý hình. */
export function GoodArt({ g, size = 84 }: { g: Pick<Good, 'id' | 'category' | 'emoji' | 'preview' | 'name'>; size?: number }): JSX.Element {
  const c = g.preview.color, d = darker(c), id = g.id;
  let body: JSX.Element;
  if (g.category === 'ao') {
    const long = /ao_dai|ao_tu_than|tay_bac/.test(id), cape = /ao_toi|ao_mua/.test(id), suit = id === 'vest';
    body = (
      <>
        <circle cx="40" cy="16" r="9" fill={SKIN} {...S} />
        {!long && <path d="M32 50v20M48 50v20" stroke={id === 'ao_ba_ba' ? '#2b2b2b' : id === 'ao_thun' ? '#3d6fb4' : '#4a4a55'} strokeWidth="9" strokeLinecap="round" />}
        {long ? <path d="M30 27h20l6 8-5 5v30H29V40l-5-5z" fill={c} {...S} /> : cape ? <path d="M40 24l20 30H20z" fill={c} {...S} /> : <path d="M28 27h24l8 9-6 6-3-3v15H29V39l-3 3-6-6z" fill={c} {...S} />}
        {long && <path d="M40 44v26" stroke={d} strokeWidth="2" />}
        {suit && <path d="M36 27l4 9 4-9M40 36v18" fill="none" stroke="#fff" strokeWidth="2" />}
        {/tho_cam/.test(id) && <><path d="M29 44h22M29 50h22" stroke="#e2573c" strokeWidth="2.4" /><path d="M29 47h22" stroke="#ffd23f" strokeWidth="1.6" /></>}
        {id === 'ao_tu_than' && <path d="M36 28h8l-4 10z" fill="#e8457f" stroke={O} strokeWidth="1.4" />}
        {id === 'do_bao_ho' && <path d="M29 42h22" stroke="#ffd23f" strokeWidth="3" />}
      </>);
  } else if (g.category === 'non') {
    body = (
      <>
        <circle cx="40" cy="46" r="15" fill={SKIN} {...S} /><circle cx="34" cy="46" r="1.8" fill={O} /><circle cx="46" cy="46" r="1.8" fill={O} /><path d="M35 53q5 4 10 0" fill="none" {...S} strokeWidth={1.8} />
        {/mu_bao_hiem|mu_coi/.test(id) ? <path d="M22 40a18 16 0 0 1 36 0z" fill={c} {...S} /> : id === 'mu_len' ? <><path d="M24 40a16 15 0 0 1 32 0z" fill={c} {...S} /><circle cx="40" cy="22" r="4" fill="#fff" {...S} /><path d="M24 40h32" stroke={d} strokeWidth="4" /></>
          : id === 'non_quai_thao' ? <><ellipse cx="40" cy="30" rx="30" ry="6" fill={c} {...S} /><path d="M14 32q-2 22 6 30M66 32q2 22-6 30" fill="none" stroke="#c0392b" strokeWidth="2" /></>
          : <path d="M40 12l30 24H10z" fill={c} {...S} />}
        {id === 'non_ngua' && <circle cx="40" cy="12" r="3" fill="#d8d8d8" {...S} strokeWidth={1.4} />}
        {id === 'mu_bao_hiem' && <path d="M26 40h28" stroke="#bfe9ff" strokeWidth="4" />}
      </>);
  } else if (g.category === 'nha') {
    const stilt = /nha_dai|nha_rong/.test(id), tall = id === 'nha_ong', boat = id === 'nha_noi', villa = id === 'biet_thu_vuon', rong = id === 'nha_rong';
    body = boat ? (
      <>
        <path d="M6 60q34 10 68 0v8H6z" fill="#6fb7d9" {...S} /><rect x="14" y="48" width="52" height="10" rx="2" fill="#a9783f" {...S} /><rect x="22" y="30" width="36" height="18" fill={c} {...S} /><path d="M18 31l22-12 22 12z" fill="#b5543c" {...S} /><rect x="36" y="36" width="8" height="12" fill="#7a4a22" {...S} />
      </>) : tall ? (
      <>
        <rect x="24" y="12" width="32" height="58" fill={c} {...S} />{[20, 38].map((y) => <g key={y}><rect x="29" y={y} width="9" height="10" fill="#bfe9ff" {...S} strokeWidth={1.6} /><rect x="42" y={y} width="9" height="10" fill="#bfe9ff" {...S} strokeWidth={1.6} /><path d={`M24 ${y + 14}h32`} stroke={d} strokeWidth="3" /></g>)}<rect x="34" y="56" width="12" height="14" fill="#7a4a22" {...S} /><path d="M22 12h36" stroke="#b5543c" strokeWidth="5" />
      </>) : stilt ? (
      <>
        {[18, 34, 50, 62].map((x) => <path key={x} d={`M${x} 52v18`} {...S} strokeWidth={3} />)}
        <rect x="10" y="38" width="60" height="16" fill={c} {...S} />
        {rong ? <path d="M12 38q28-52 56 0z" fill="#c9a24a" {...S} /> : <path d="M6 39l34-18 34 18z" fill="#b08a4a" {...S} />}
        <path d="M30 54l-8 16M36 54l-8 16" {...S} strokeWidth={2} /><rect x="36" y="42" width="8" height="12" fill="#5a3a1c" {...S} />
      </>) : (
      <>
        <rect x={villa ? 10 : 14} y={villa ? 28 : 38} width={villa ? 60 : 52} height={villa ? 42 : 32} fill={c} {...S} />
        <path d={villa ? 'M4 30l36-20 36 20z' : 'M8 40l32-20 32 20z'} fill={id === 'nha_cap_bon' ? '#5c8fc0' : id === 'nha_trinh_tuong' ? '#8a5a3a' : '#b5543c'} {...S} />
        <rect x="35" y={villa ? 50 : 50} width="10" height="20" fill="#7a4a22" {...S} /><rect x="20" y={villa ? 40 : 46} width="9" height="9" fill="#bfe9ff" {...S} strokeWidth={1.6} /><rect x="51" y={villa ? 40 : 46} width="9" height="9" fill="#bfe9ff" {...S} strokeWidth={1.6} />
        {id === 'nha_ruong' && [22, 34, 46, 58].map((x) => <path key={x} d={`M${x} 40v30`} stroke="#3f2414" strokeWidth="3" />)}
      </>);
  } else if (g.category === 'xe') {
    const car = /o_to/.test(id), bike = id === 'xe_dap';
    body = car ? (
      <>
        <path d="M8 52q0-10 12-11l8-12h22l12 12q12 1 12 11v6H8z" fill={c} {...S} /><path d="M30 31h9v10H24zM43 31h7l8 10H43z" fill="#bfe9ff" stroke={O} strokeWidth="1.6" />
        <circle cx="24" cy="58" r="8" fill="#3b2a17" {...S} /><circle cx="58" cy="58" r="8" fill="#3b2a17" {...S} />{/dien/.test(id) && <path d="M44 44l-6 7h5l-2 6 7-8h-5z" fill="#ffe27a" stroke={O} strokeWidth="1" />}
      </>) : (
      <>
        <circle cx="18" cy="56" r="11" fill="none" {...S} strokeWidth={3} /><circle cx="62" cy="56" r="11" fill="none" {...S} strokeWidth={3} />
        {bike ? <path d="M18 56l12-22h22l10 22M30 34l12 22h-24M52 34l-10 22M26 30h10M50 28h8" fill="none" stroke={c} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          : <><path d="M22 52q4-16 20-16h10l8 12-8 6H26z" fill={c} {...S} /><path d="M52 36l4-10h6" fill="none" {...S} strokeWidth={3} /><rect x="26" y="30" width="18" height="6" rx="3" fill="#2b2f36" {...S} />{/dien/.test(id) && <path d="M38 40l-5 6h4l-2 5 6-7h-4z" fill="#ffe27a" stroke={O} strokeWidth="1" />}</>}
      </>);
  } else {
    body = (<><rect x="8" y="8" width="64" height="64" rx="18" fill={c} opacity="0.32" /><rect x="8" y="8" width="64" height="64" rx="18" fill="none" stroke={d} strokeWidth="2.4" strokeDasharray="5 5" /><text x="40" y="52" textAnchor="middle" fontSize="34">{g.emoji}</text></>);
  }
  return <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label={`Hình ${g.name}`}>{body}</svg>;
}

const SLOT_NAMES: Record<EquipSlot, string> = { ao: 'Quần áo', non: 'Nón', phu_kien: 'Phụ kiện', nha: 'Kiểu nhà', xe: 'Xe riêng' };
const CATS: GoodCategory[] = ['ao', 'non', 'phu_kien', 'nha', 'noi_that', 'san_vuon', 'xe'];

export function ShoppingPanel({ me, refresh, where }: { me: Me; refresh: () => void; where?: string }): JSX.Element {
  const [data, setData] = useState<ShoppingData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cat, setCat] = useState<GoodCategory>('ao');
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => api<ShoppingData>('GET', `/api/shopping${where ? `?where=${encodeURIComponent(where)}` : ''}`).then((d) => { setData(d); setLoadError(null); }).catch((e) => setLoadError(e instanceof Error ? e.message : 'Không mở được cửa hàng.')), [where]);
  useEffect(() => { void load(); }, [load]);
  const act = useAction(() => { void load(); refresh(); });
  if (!data) return <div className="shopping"><p className="hint">{loadError ?? 'Đang mở cửa hàng…'}</p></div>;
  const byId = Object.fromEntries(data.items.map((i) => [i.id, i])) as Record<string, GoodRow>;
  const list = data.items.filter((i) => i.category === cat).sort((a, b) => Number(b.owned) - Number(a.owned) || Number(b.available) - Number(a.available) || a.price - b.price);
  const info = data.categories[cat];
  const equip = (slot: string, itemId: string | null, name: string) => act.run(async () => { await api('POST', '/api/shopping/equip', { slot, itemId }); setNote(itemId ? `Đang dùng: ${name}.` : `Đã cất ${name}.`); });
  return (
    <div className="shopping">
      <p className="muted">Mua sắm bằng tiền làm vườn, buôn bán. Đồ phổ thông bán ở mọi nơi; đồ đặc trưng vùng miền chỉ bán ở đúng tỉnh đó, nên đi du lịch tới nơi mới mua được. {me.user.displayName} đang ở: {data.here.join(', ') || 'nhà'}.</p>
      {act.error && <p className="error" role="alert">{act.error}</p>}
      {note && <p className="veh-note" role="status">{note}</p>}
      <section>
        <h3>Đang mặc, đang dùng</h3>
        <div className="shop-worn">
          {(Object.keys(SLOT_NAMES) as EquipSlot[]).map((s) => { const it = data.equipped[s] ? byId[data.equipped[s]!] : null; return (
            <div key={s}>{it ? <GoodArt g={it} size={44} /> : <svg viewBox="0 0 80 80" aria-hidden="true"><rect x="12" y="12" width="56" height="56" rx="14" fill="none" stroke="#cdb67c" strokeWidth="3" strokeDasharray="6 6" /></svg>}{SLOT_NAMES[s]}<b>{it ? it.name : 'chưa có'}</b></div>); })}
        </div>
      </section>
      <div className="shop-cats" role="group" aria-label="Loại hàng">
        {CATS.map((k) => <button type="button" key={k} aria-pressed={cat === k} onClick={() => setCat(k)}>{data.categories[k].emoji} {data.categories[k].name}</button>)}
      </div>
      <p className="veh-tip">{info.note}{cat === 'nha' || cat === 'ao' || cat === 'non' || cat === 'phu_kien' ? ' Bản này mới lưu món bạn chọn; hình nhân vật và ngôi nhà trong vườn sẽ đổi theo ở bản sau.' : ''}</p>
      <div className="goods">
        {list.map((g) => { const worn = !!g.slot && data.equipped[g.slot as EquipSlot] === g.id; return (
          <div className={`good${g.owned ? ' owned' : ''}${worn ? ' worn' : ''}${!g.available ? ' far' : ''}`} key={g.id} data-good={g.id}>
            <GoodArt g={g} />
            <strong>{g.name}</strong>
            <small>{g.preview.hint}</small>
            {g.region && <span className="where">Đặc trưng {g.region}</span>}
            {g.ride && <small>Đi tham quan tới {g.ride.maxKm} km · {g.ride.perKm ? `${fmtMoney(g.ride.perKm)}/km` : 'không tốn tiền'}</small>}
            {!g.owned && <span className="price">{fmtMoney(g.price)}</span>}
            {g.owned
              ? g.slot ? <button type="button" className={worn ? '' : 'go'} disabled={act.busy} onClick={() => equip(g.slot!, worn ? null : g.id, g.name)}>{worn ? 'Đang dùng · cất đi' : 'Dùng'}</button> : <span className="tag">Đã có</span>
              : <button type="button" className="go" disabled={act.busy || !g.canBuy} onClick={() => act.run(async () => { await api('POST', '/api/shopping/buy', { itemId: g.id }); setNote(`Đã mua ${g.name}.`); })}>{g.canBuy ? 'Mua' : g.why}</button>}
          </div>); })}
      </div>
    </div>);
}

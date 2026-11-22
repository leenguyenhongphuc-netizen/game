// Cấp bậc và thể lực trên HUD, túi đồ ăn uống, tiệm tạp hoá, quầy hàng ở điểm tham quan, tấm nhắc khi hết sức.
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { fmtMoney } from '../../shared/rules.ts';
import { api, ApiError } from './api.ts';
import type { Me } from './api.ts';
import { fmtDuration } from './ui.ts';
import './passport.css';

/** Các trường tiến độ máy chủ trả kèm `GET /api/me` (và nhiều lệnh khác). */
export interface Vitals { xp?: number; level?: number; title?: string; nextXp?: number | null; prevXp?: number; energy?: number; energyMax?: number; energyFullAt?: number | null }
export type MeVital = Me & { user: Me['user'] & Vitals; items?: { itemId: string; qty: number }[] };
export interface ProgressResult extends Vitals { xpGained?: number; levelUp?: boolean; energyCost?: number; gained?: number }
export interface ShopItem { itemId: string; name: string; emoji: string; price: number; energy: number; kind: 'an' | 'uong'; regional?: string }
export interface Shop { id: string; kind: string; emoji: string; name: string; items: ShopItem[] }
interface BagItem { itemId: string; qty: number; name: string; emoji: string; price: number; energy: number; kind: 'an' | 'uong' }
interface EnergyOut { energy: number; energyMax: number; energyFullAt: number | null }

const Bolt = ({ size = 16 }: { size?: number }) => <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true"><path d="M13.5 2 4.5 13.5h6L9 22l10-12.5h-6.2z" fill="currentColor" stroke="#56310f" strokeWidth="1.6" strokeLinejoin="round" /></svg>;

/** Câu ngắn cho toast sau một lệnh: "+10 XP · Lên cấp 3: Người ham đi". Trả chuỗi rỗng nếu không có gì đáng báo. */
export function describeProgress(r: ProgressResult | null | undefined): string {
  if (!r) return '';
  const parts: string[] = [];
  if (r.xpGained && r.xpGained > 0) parts.push(`+${r.xpGained} XP`);
  if (r.levelUp && r.level) parts.push(`Lên cấp ${r.level}${r.title ? `: ${r.title}` : ''}`);
  if (r.gained && r.gained > 0) parts.push(`+${r.gained} thể lực`);
  return parts.join(' · ');
}
/** Lệnh vừa gọi có bị từ chối vì hết thể lực không. */
export function isHetSuc(e: unknown): e is ApiError { return e instanceof ApiError && e.code === 'het_suc'; }
function friendly(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'du_suc') return 'Bạn đang đầy thể lực rồi — bỏ vào túi để dành lúc mệt nhé.';
    if (e.code === 'day_tui') return 'Túi đã đầy món này, hãy dùng bớt rồi mua thêm.';
    if (e.code === 'khong_du_tien') return 'Chưa đủ tiền mua món này.';
    if (e.code === 'khong_co') return 'Trong túi không còn món này.';
    if (e.code === 'khac_tinh') return 'Bạn phải có mặt ở đó mới mua được.';
    return e.message;
  }
  return e instanceof Error ? e.message : 'Có lỗi xảy ra.';
}

/** Huy hiệu cấp cho HUD: số cấp trong khiên, vòng ngoài là tiến độ XP. Ẩn nếu máy chủ chưa trả cấp. */
export function LevelBadge({ me, onClick }: { me: Me; onClick?: () => void }) {
  const u = (me as MeVital).user;
  if (u.level === undefined) return null;
  const prev = u.prevXp ?? 0, next = u.nextXp ?? null, xp = u.xp ?? 0, p = next === null ? 1 : Math.max(0, Math.min(1, (xp - prev) / Math.max(1, next - prev)));
  const C = 2 * Math.PI * 16;
  return (
    <button type="button" className="lvl-badge" onClick={onClick} aria-label={`Cấp ${u.level}${u.title ? `, ${u.title}` : ''}. ${next === null ? 'Hạng cao nhất' : `${xp}/${next} điểm`}. Mở hộ chiếu`} title={`Cấp ${u.level}${u.title ? ` · ${u.title}` : ''}${next === null ? '' : ` · ${xp}/${next} điểm`}`}>
      <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
        <circle cx="20" cy="20" r="18.4" fill="#fff6dc" stroke="#56310f" strokeWidth="1.6" /><circle cx="20" cy="20" r="16" fill="none" stroke="#e3cf9a" strokeWidth="3.4" />
        <circle cx="20" cy="20" r="16" fill="none" stroke="#4caf3f" strokeWidth="3.4" strokeLinecap="round" strokeDasharray={`${(C * p).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 20 20)" />
        <path d="M20 8.5 29 11.5v8c0 6-4 9.6-9 12-5-2.4-9-6-9-12v-8z" fill="#ffcf3a" stroke="#56310f" strokeWidth="1.6" strokeLinejoin="round" />
        <text x="20" y="24.4" textAnchor="middle" className="lvl-n" fontSize={u.level >= 10 ? 10.5 : 13}>{u.level}</text>
      </svg>
    </button>
  );
}

/** Thanh thể lực gọn cho HUD. Ẩn nếu máy chủ chưa trả thể lực. */
export function EnergyBar({ me, onClick }: { me: Me; onClick?: () => void }) {
  const u = (me as MeVital).user;
  if (u.energy === undefined) return null;
  const max = u.energyMax ?? 100, v = Math.max(0, Math.min(max, u.energy)), p = max > 0 ? v / max : 0, low = p < 0.25;
  const fullIn = u.energyFullAt ? u.energyFullAt - (me.config?.now ?? Date.now()) : 0;
  const tip = u.energyFullAt && fullIn > 0 ? `Đầy sau ${fmtDuration(fullIn)}` : 'Đang đầy thể lực';
  return (
    <button type="button" className={`en-bar${low ? ' low' : ''}`} onClick={onClick} title={tip} aria-label={`Thể lực ${v}/${max}. ${tip}. Mở túi đồ ăn uống`}>
      <span className="en-ico"><Bolt /></span>
      <span className="en-track" aria-hidden="true"><i style={{ width: `${Math.round(p * 100)}%` }} /></span>
      <b>{v}<small>/{max}</small></b>
    </button>
  );
}

function EnergyLine({ e, before }: { e: EnergyOut | null; before?: number | null }) {
  if (!e) return null;
  const p = e.energyMax > 0 ? e.energy / e.energyMax : 0;
  return (
    <div className={`bag-energy${p < 0.25 ? ' low' : ''}`}>
      <span className="en-ico"><Bolt size={20} /></span>
      <div className="grow"><b>Thể lực {before != null && before !== e.energy ? <><s>{before}</s> → </> : null}{e.energy}/{e.energyMax}</b>
        <span className="en-track" aria-hidden="true"><i style={{ width: `${Math.round(p * 100)}%` }} /></span>
        <small>{e.energyFullAt ? `Tự hồi dần, đầy sau ${fmtDuration(e.energyFullAt - Date.now())}` : 'Đang đầy — làm việc, tham quan sẽ tốn dần'}</small></div>
    </div>
  );
}
function ItemRow({ it, sub, tag, children }: { it: { name: string; emoji: string; energy: number; kind: 'an' | 'uong' }; sub?: string | null; tag?: string | null; children: ReactNode }) {
  return (
    <li className="food">
      <span className="emoji" aria-hidden="true">{it.emoji}</span>
      <span className="grow"><b>{it.name}{tag && <span className="tag food-tag">{tag}</span>}</b><small><span className="food-en">+{it.energy} thể lực</span>{sub ? ` · ${sub}` : ''}</small></span>
      <span className="food-acts">{children}</span>
    </li>
  );
}

/** Túi đồ ăn uống và tiệm tạp hoá ở vùng nhà. */
export function BagPanel({ me, refresh }: { me: Me; refresh: () => void }) {
  const [bag, setBag] = useState<BagItem[] | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [bagMax, setBagMax] = useState(10);
  const [en, setEn] = useState<EnergyOut | null>(null);
  const [before, setBefore] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([api('GET', '/api/items'), api('GET', '/api/shops/home')]);
    setBag(a.items ?? []); setBagMax(a.bagMax ?? 10); setShop(b.shops?.[0] ?? null);
    if (a.energy !== undefined) setEn({ energy: a.energy, energyMax: a.energyMax, energyFullAt: a.energyFullAt ?? null });
  }, []);
  useEffect(() => { load().catch((e) => setMsg({ ok: false, text: friendly(e) })); }, [load, me.user.id]);
  const act = async (fn: () => Promise<any>, done: (r: any) => string) => {
    setBusy(true); setMsg(null);
    try { const prev = en?.energy ?? null, r = await fn(); if (r.energy !== undefined) { setBefore(prev); setEn({ energy: r.energy, energyMax: r.energyMax, energyFullAt: r.energyFullAt ?? null }); } setMsg({ ok: true, text: done(r) }); await load(); refresh(); }
    catch (e) { setMsg({ ok: false, text: friendly(e) }); } finally { setBusy(false); }
  };
  const use = (it: BagItem) => act(() => api('POST', '/api/items/use', { itemId: it.itemId }), (r) => `Đã dùng ${it.name}: +${r.gained ?? it.energy} thể lực.`);
  const buy = (it: ShopItem, eat: boolean) => act(() => api('POST', '/api/shop/buy', { shopId: shop?.id ?? 'home', itemId: it.itemId, qty: 1, use: eat }), (r) => eat ? `Đã ăn ${it.name}: thể lực ${r.energy}/${r.energyMax}.` : `Đã bỏ ${it.name} vào túi · còn ${fmtMoney(r.cash)}.`);
  const full = !!en && en.energy >= en.energyMax;
  return (
    <div className="bag">
      <EnergyLine e={en} before={before} />
      {msg && <p className={msg.ok ? 'bag-ok' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.text}</p>}
      <h3>Túi đồ ăn uống</h3>
      {bag === null ? <p className="muted">Đang mở túi…</p> : bag.length === 0 ? <p className="muted">Túi đang trống. Mua vài món ở tiệm bên dưới hoặc ở các quầy khi đi tham quan để dành lúc mệt.</p> : (
        <ul className="food-list">{bag.map((it) => (
          <ItemRow key={it.itemId} it={it} sub={`có ${it.qty}/${bagMax}`}><button type="button" className="go" disabled={busy || full} onClick={() => use(it)}>{it.kind === 'uong' ? 'Uống' : 'Ăn'}</button></ItemRow>
        ))}</ul>
      )}
      {full && bag && bag.length > 0 && <small className="muted">Đang đầy thể lực nên chưa dùng được.</small>}
      <h3>{shop ? `${shop.emoji} ${shop.name}` : 'Tiệm tạp hoá'}</h3>
      {!shop ? <p className="muted">Nhận lô đất đầu tiên rồi tiệm tạp hoá đầu xóm sẽ mở.</p> : (
        <ul className="food-list">{shop.items.map((it) => (
          <ItemRow key={it.itemId} it={it} sub={fmtMoney(it.price)}>
            <button type="button" className="go" disabled={busy || full || me.user.cash < it.price} onClick={() => buy(it, true)}>{it.kind === 'uong' ? 'Uống ngay' : 'Ăn ngay'}</button>
            <button type="button" disabled={busy || me.user.cash < it.price} onClick={() => buy(it, false)}>Bỏ túi</button>
          </ItemRow>
        ))}</ul>
      )}
      <p className="hint">Chăm cây, thu hoạch, chế biến, lái xe đường dài và mỗi điểm dừng khi tham quan đều tốn thể lực. Thể lực tự hồi theo thời gian; ăn uống thì hồi ngay. Mua bán, xem bảng và ngồi xe không tốn.</p>
    </div>
  );
}

/** Tấm trượt từ dưới lên khi tới một quầy trong lúc đi bộ tham quan. */
export function ShopSheet({ sightId, shopId, onClose, onChanged }: { sightId: string; shopId: string; onClose: () => void; onChanged?: (r: ProgressResult & { cash?: number }) => void }) {
  const [shop, setShop] = useState<Shop | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [en, setEn] = useState<EnergyOut | null>(null);
  useEffect(() => {
    let on = true;
    api('GET', `/api/sights/${sightId}/shops`).then((d) => { if (!on) return; const s = (d.shops as Shop[]).find((x) => x.id === shopId) ?? null; setShop(s); if (!s) setErr('Quầy này hôm nay đã dọn hàng.'); }).catch((e) => { if (on) setErr(friendly(e)); });
    return () => { on = false; };
  }, [sightId, shopId]);
  const buy = async (it: ShopItem, eat: boolean) => {
    setBusy(true); setErr(null); setNote(null);
    try {
      const r = await api('POST', '/api/shop/buy', { shopId, sightId, itemId: it.itemId, qty: 1, use: eat });
      if (r.energy !== undefined) setEn({ energy: r.energy, energyMax: r.energyMax, energyFullAt: r.energyFullAt ?? null });
      setNote(eat ? `Ngon quá! Thể lực ${r.energy}/${r.energyMax}.` : `Đã bỏ ${it.name} vào túi.`); onChanged?.(r);
    } catch (e) { setErr(friendly(e)); } finally { setBusy(false); }
  };
  const full = !!en && en.energy >= en.energyMax;
  return (
    <div className="shop-sheet-wrap" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="shop-sheet" role="dialog" aria-label={shop?.name ?? 'Quầy hàng'}>
        <header><span className="emoji" aria-hidden="true">{shop?.emoji ?? '🛒'}</span><b className="grow">{shop?.name ?? 'Quầy hàng'}</b>
          {en && <span className={`shop-en${en.energy / en.energyMax < 0.25 ? ' low' : ''}`}><Bolt size={14} /> {en.energy}/{en.energyMax}</span>}
          <button type="button" className="shop-close" onClick={onClose} aria-label="Đóng quầy hàng">✕</button></header>
        {err && <p className="error" role="alert">{err}</p>}
        {note && <p className="bag-ok" role="status">{note}</p>}
        {!shop && !err && <p className="muted">Đang hỏi chủ quầy…</p>}
        {shop && (
          <ul className="food-list">{shop.items.map((it) => (
            <ItemRow key={it.itemId} it={it} sub={fmtMoney(it.price)} tag={it.regional ? `Đặc sản ${it.regional}` : null}>
              <button type="button" className="go" disabled={busy || full} onClick={() => buy(it, true)}>{it.kind === 'uong' ? 'Uống ngay' : 'Ăn ngay'}</button>
              <button type="button" disabled={busy} onClick={() => buy(it, false)}>Bỏ túi</button>
            </ItemRow>
          ))}</ul>
        )}
      </div>
    </div>
  );
}

/** Tấm nhắc khi một lệnh bị từ chối vì hết thể lực. */
export function HetSucSheet({ message, onClose, onOpenBag }: { message?: string | null; onClose: () => void; onOpenBag: () => void }) {
  return (
    <div className="shop-sheet-wrap" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="shop-sheet hetsuc" role="alertdialog" aria-label="Hết thể lực">
        <header><span className="hetsuc-ico" aria-hidden="true"><Bolt size={26} /></span><b className="grow">Bạn đã thấm mệt</b><button type="button" className="shop-close" onClick={onClose} aria-label="Đóng">✕</button></header>
        <p>{message || 'Không đủ thể lực để làm việc này.'}</p>
        <p className="muted">Thể lực tự hồi dần theo thời gian. Muốn làm tiếp ngay thì ăn uống: mở túi đồ hoặc ghé tiệm tạp hoá đầu xóm. Mua bán, xem bảng và ngồi xe không tốn sức.</p>
        <div className="hetsuc-acts"><button type="button" className="go" onClick={onOpenBag}>🍱 Mở túi đồ / tiệm tạp hoá</button><button type="button" onClick={onClose}>Nghỉ một lát</button></div>
      </div>
    </div>
  );
}

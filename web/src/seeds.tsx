// Bộ chọn giống: thanh nhanh giữ vài giống ghim/gần đây; vùng nhiều giống (Đà Lạt) mở bảng lưới có nhóm, tìm kiếm, lọc chính vụ.
import { useMemo, useState } from 'react';
import { CROPS } from '../../shared/catalog.ts';
import type { Kind, Specialty } from '../../shared/catalog.ts';
import { fmtMoney } from '../../shared/rules.ts';
import './seeds.css';

export const QUICK_MAX = 5;
const KIND_NAMES: Record<Kind, string> = { ngan: 'Rau, dâu, cây ngắn ngày', cu: 'Củ', hoa: 'Hoa', trai: 'Cây ăn trái', leo: 'Dây leo, trái leo', cn: 'Cây công nghiệp', lua: 'Lúa gạo' };
const KIND_ORDER: Kind[] = ['ngan', 'cu', 'hoa', 'trai', 'leo', 'cn', 'lua'];

/** Bỏ dấu tiếng Việt để tìm "ca phe" ra "Cà phê". */
export function foldVi(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

const KEY = 'vv-seed-prefs';
interface Prefs { recent: string[]; pinned: string[] }
function load(): Prefs {
  try { const p = JSON.parse(localStorage.getItem(KEY) ?? '') as Prefs; if (Array.isArray(p.recent) && Array.isArray(p.pinned)) return p; } catch { /* bỏ qua */ }
  return { recent: [], pinned: [] };
}
function save(p: Prefs) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* bỏ qua */ } }

/** Giống ghim + dùng gần đây (lưu trên máy, không cần máy chủ). */
export function useSeedPrefs() {
  const [p, setP] = useState<Prefs>(load);
  const update = (f: (x: Prefs) => Prefs) => setP((old) => { const n = f(old); save(n); return n; });
  return {
    pinned: p.pinned, recent: p.recent,
    touch: (id: string) => update((x) => ({ ...x, recent: [id, ...x.recent.filter((r) => r !== id)].slice(0, 12) })),
    togglePin: (id: string) => update((x) => ({ ...x, pinned: x.pinned.includes(id) ? x.pinned.filter((r) => r !== id) : [id, ...x.pinned].slice(0, QUICK_MAX) })),
  };
}

/** Giống hiện trên thanh nhanh: ghim → gần đây → lời nhất; tối đa QUICK_MAX; luôn có giống đang cầm. */
export function quickSeeds(list: Specialty[], pinned: string[], recent: string[], profit: (sp: Specialty) => number, held: string | null): Specialty[] {
  if (list.length <= QUICK_MAX + 1) return list;
  const by = new Map(list.map((s) => [s.id, s]));
  const out: Specialty[] = [];
  const add = (id: string) => { const s = by.get(id); if (s && !out.includes(s) && out.length < QUICK_MAX) out.push(s); };
  if (held) add(held);
  pinned.forEach(add); recent.forEach(add);
  [...list].sort((a, b) => profit(b) - profit(a)).forEach((s) => add(s.id));
  return out;
}

type Sort = 'loi' | 're' | 'nhanh';
export function SeedPicker({ list, held, cash, costOf, profitOf, hoursOf, inSeason, pinned, onPick, onTogglePin, onInfo, onClose }: {
  list: Specialty[]; held: string | null; cash: number;
  costOf: (sp: Specialty) => number; profitOf: (sp: Specialty) => number; hoursOf: (sp: Specialty) => number; inSeason: (sp: Specialty) => boolean;
  pinned: string[]; onPick: (id: string) => void; onTogglePin: (id: string) => void; onInfo: (id: string) => void; onClose: () => void;
}) {
  const [q, setQ] = useState(''), [season, setSeason] = useState(false), [sort, setSort] = useState<Sort>('loi');
  const groups = useMemo(() => {
    const f = foldVi(q);
    const rows = list.filter((s) => (!f || foldVi(`${s.name} ${CROPS[s.crop].name} ${KIND_NAMES[CROPS[s.crop].kind]}`).includes(f)) && (!season || inSeason(s)));
    const key = (s: Specialty) => (sort === 'loi' ? -profitOf(s) : sort === 're' ? costOf(s) : hoursOf(s));
    rows.sort((a, b) => key(a) - key(b));
    return KIND_ORDER.map((k) => ({ k, rows: rows.filter((s) => CROPS[s.crop].kind === k) })).filter((g) => g.rows.length);
  }, [list, q, season, sort, profitOf, costOf, hoursOf, inSeason]);
  const count = groups.reduce((n, g) => n + g.rows.length, 0);
  return (
    <div className="seed-picker" role="dialog" aria-label="Chọn giống">
      <div className="sheet-head"><h3>🌱 Chọn giống ({list.length})</h3><button className="round" aria-label="Đóng" onClick={onClose}>✕</button></div>
      <div className="sp-tools">
        <input type="search" placeholder="Tìm giống, ví dụ: dau, hoa hong…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm giống" />
        <div className="sp-filters" role="group" aria-label="Lọc và sắp xếp">
          <button aria-pressed={season} onClick={() => setSeason(!season)}>🌤️ Chính vụ</button>
          <button aria-pressed={sort === 'loi'} onClick={() => setSort('loi')}>Lời nhất</button>
          <button aria-pressed={sort === 're'} onClick={() => setSort('re')}>Rẻ nhất</button>
          <button aria-pressed={sort === 'nhanh'} onClick={() => setSort('nhanh')}>Nhanh nhất</button>
        </div>
      </div>
      <div className="sp-body">
        {count === 0 && <p className="hint">Không có giống nào khớp. Thử bỏ lọc chính vụ hoặc gõ ít chữ hơn.</p>}
        {groups.map((g) => (
          <section key={g.k}>
            <h4>{KIND_NAMES[g.k]} <small>{g.rows.length}</small></h4>
            <div className="sp-grid">
              {g.rows.map((s) => {
                const c = CROPS[s.crop], cost = costOf(s), pin = pinned.includes(s.id);
                return (
                  <div key={s.id} className={`sp-card${held === s.id ? ' on' : ''}`}>
                    <button className="sp-pick" disabled={cash < cost} onClick={() => onPick(s.id)} aria-pressed={held === s.id}>
                      <span className="emoji" aria-hidden="true">{c.emoji}</span>
                      <strong>{s.name}</strong>
                      <small>Giống {fmtMoney(cost)}</small>
                      <small className="sp-profit">Lời ~{fmtMoney(profitOf(s))}/ô{inSeason(s) ? ' · chính vụ' : ''}</small>
                    </button>
                    <div className="sp-acts">
                      <button aria-pressed={pin} aria-label={pin ? `Bỏ ghim ${s.name}` : `Ghim ${s.name} lên thanh nhanh`} onClick={() => onTogglePin(s.id)}>{pin ? '📌' : '📍'}</button>
                      <button aria-label={`Thông tin ${s.name}`} onClick={() => onInfo(s.id)}>i</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

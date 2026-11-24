// Lớp trò chuyện phủ trên mọi màn: loa phát thanh chạy chữ, nút 💬 (chấm đỏ tin chưa đọc + lời mời kết bạn),
// ô chat chung khi đang ở cảnh có người khác (làng, tham quan, khu vui chơi, trạm dừng, cao tốc, khu hành chính),
// bảng "Quanh đây / Tin nhắn / Loa / Đã chặn" và thẻ người chơi (kết bạn, nhắn tin, chặn, báo cáo).
// Dữ liệu chat chung về theo nhịp hiện diện (web/src/presence.ts → chatStore); hộp thư và loa theo nhịp /api/chat/poll.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import './chat.css';
import { api, ApiError } from '../api.ts';
import { chatStore } from '../presence.ts';
import { BROADCAST_MAX, BROADCAST_MIN_LEVEL, BROADCAST_PRICE, BROADCAST_SHOW_MS, DM_MAX, INBOX_POLL_MS, PUBLIC_MAX, REPORT_REASONS } from '../../../shared/chat.ts';
import type { Broadcast, ChatPoll, ChatThread, DmMsg, PlayerCard, PublicMsg, ReportReason } from '../../../shared/chat.ts';
import { ROLE_INFO, fmtMoney } from '../../../shared/rules.ts';
import type { Role } from '../../../shared/rules.ts';

export interface ChatMe { id: number; level?: number; cash: number }
import { PLAYER_CARD_EVENT } from './events.ts';
export { PLAYER_CARD_EVENT, openPlayerCard } from './events.ts';

const SCENE_NAMES: Record<string, string> = { village: 'Xóm', highway: 'Trên đường', rest_stop: 'Trạm dừng', sight: 'Nơi tham quan', market: 'Chợ', admin: 'Trung tâm hành chính' };
const hhmm = (t: number) => new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const len = (s: string) => [...s].length;
const errText = (e: unknown) => (e instanceof ApiError ? e.message : 'Không kết nối được máy chủ.');

function useChatStore() {
  const sub = useCallback((f: () => void) => { chatStore.subs.add(f); return () => { chatStore.subs.delete(f); }; }, []);
  // phiên bản thay đổi mỗi lần emit → đọc lại toàn bộ
  const ver = useRef(0);
  const get = useCallback(() => `${chatStore.where?.scene}|${chatStore.where?.key}|${chatStore.log.length}|${chatStore.log.at(-1)?.id}|${chatStore.near.length}|${chatStore.seenAt}`, []);
  useSyncExternalStore(sub, get);
  ver.current++;
  return chatStore;
}

/** Nhịp hỏi hộp thư + loa; dừng khi ẩn tab. */
function usePoll(open: boolean) {
  const [poll, setPoll] = useState<ChatPoll>({ unread: 0, requests: 0, broadcasts: [], at: 0 });
  const [queue, setQueue] = useState<Broadcast[]>([]);
  const lastB = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null), fails = useRef(0);
  const beat = useCallback(async () => {
    if (document.hidden) return;
    try {
      const p = await api<ChatPoll>('GET', `/api/chat/poll?b=${lastB.current}`);
      fails.current = 0; setPoll(p);
      if (p.broadcasts.length) { lastB.current = Math.max(lastB.current, ...p.broadcasts.map((b) => b.id)); setQueue((q) => [...q, ...p.broadcasts.filter((b) => !q.some((x) => x.id === b.id))]); }
    } catch { fails.current++; }
  }, []);
  useEffect(() => {
    let dead = false;
    const loop = async () => { await beat(); if (!dead) timer.current = setTimeout(loop, fails.current ? Math.min(60_000, 5_000 * 2 ** fails.current) : open ? INBOX_POLL_MS.open : INBOX_POLL_MS.idle); };
    const onVis = () => { if (!document.hidden) { if (timer.current) clearTimeout(timer.current); void loop(); } };
    void loop(); document.addEventListener('visibilitychange', onVis);
    return () => { dead = true; if (timer.current) clearTimeout(timer.current); document.removeEventListener('visibilitychange', onVis); };
  }, [beat, open]);
  return { poll, refresh: beat, queue, setQueue };
}

/** Loa phát thanh: mỗi lượt chạy đủ BROADCAST_SHOW_MS trên máy này, nối đuôi nhau, bắt đầu không sớm hơn giờ máy chủ xếp
 *  (nhịp hỏi 9 giây nên không dựa vào giờ kết thúc của máy chủ — nếu không người nhận muộn chỉ thấy vài giây cuối). */
function Ticker({ queue, setQueue }: { queue: Broadcast[]; setQueue: (f: (q: Broadcast[]) => Broadcast[]) => void }) {
  const [now, setNow] = useState(Date.now());
  const shown = useRef<{ id: number; until: number } | null>(null);
  useEffect(() => { if (!queue.length) return; const t = setInterval(() => setNow(Date.now()), 400); return () => clearInterval(t); }, [queue.length]);
  // bỏ lượt quá cũ (nhận sau khi đã hết giờ hơn 1 phút, ví dụ mở lại tab)
  useEffect(() => { if (queue.some((b) => b.endsAt < now - 60_000)) setQueue((q) => q.filter((b) => b.endsAt >= now - 60_000)); }, [now, queue, setQueue]);
  let cur = shown.current && queue.find((b) => b.id === shown.current!.id) && now < shown.current.until ? queue.find((b) => b.id === shown.current!.id)! : null;
  if (!cur) {
    if (shown.current) { const done = shown.current.id; shown.current = null; setTimeout(() => setQueue((q) => q.filter((b) => b.id !== done)), 0); }
    const next = queue.find((b) => b.id !== shown.current?.id && b.startsAt <= now + 1500);
    if (next) { shown.current = { id: next.id, until: now + BROADCAST_SHOW_MS }; cur = next; }
  }
  if (!cur) return null;
  return (
    <div className={`chat-ticker${cur.admin ? ' admin' : ''}`} role="status" aria-live="polite" key={cur.id}>
      <span className="chat-ticker-icon" aria-hidden>📢</span>
      <div className="chat-ticker-track"><span className="chat-ticker-text"><b>{cur.from}:</b> {cur.text}</span></div>
    </div>
  );
}

/** Chiều cao phần màn hình bị bàn phím ảo che (iOS Safari/PWA không co layout viewport, chỉ co visualViewport). */
function useKeyboardInset(active: boolean): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport; if (!active || !vv) { setInset(0); return; }
    let raf = 0;
    const upd = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)))); };
    upd(); vv.addEventListener('resize', upd); vv.addEventListener('scroll', upd);
    return () => { cancelAnimationFrame(raf); vv.removeEventListener('resize', upd); vv.removeEventListener('scroll', upd); };
  }, [active]);
  return inset;
}

/** Thanh gõ chat chung: dính ngay trên bàn phím, kèm 3 dòng gần nhất và lối vào bảng trò chuyện. */
function ComposeBar({ store, badge, onClose, onPanel }: { store: typeof chatStore; badge: number; onClose: () => void; onPanel: () => void }) {
  const [text, setText] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const kb = useKeyboardInset(true);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => { const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 30); return () => clearTimeout(t); }, []);
  // iOS cuộn cả trang khi ô gõ nhận focus → kéo trang về 0 để thanh không trôi lệch
  useEffect(() => { const f = () => { if (window.scrollY) window.scrollTo(0, 0); }; window.addEventListener('scroll', f); return () => window.removeEventListener('scroll', f); }, []);
  const recent = store.log.slice(-3);
  const send = async () => {
    const t = text.trim(); if (!t || !store.where || busy) return;
    setBusy(true); setErr('');
    try {
      const r = await api<{ id: number; text: string; at: number }>('POST', '/api/chat/public', { ...store.where, text: t });
      store.push({ id: r.id, userId: -1, name: 'Bạn', text: r.text, at: r.at }); setText('');
      input.current?.focus({ preventScroll: true });
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="chat-compose" style={{ bottom: kb }} role="dialog" aria-label="Chat chung">
      <div className="chat-compose-log">
        {recent.length === 0 ? <p className="chat-line muted">Chưa ai nói gì ở {SCENE_NAMES[store.where?.scene ?? ''] ?? 'đây'}. Chào mọi người nhé!</p>
          : recent.map((m) => <p key={m.id} className="chat-line"><b>{m.name}</b> {m.text}</p>)}
      </div>
      <form className="chat-compose-form" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <button type="button" className="ghost chat-ico" onClick={onPanel} aria-label="Mở bảng trò chuyện">☰{badge > 0 && <span className="chat-dot">{badge > 9 ? '9+' : badge}</span>}</button>
        <span className="chat-in">
          <input ref={input} value={text} maxLength={PUBLIC_MAX} onChange={(e) => setText(e.target.value)} placeholder={`Nói ở ${SCENE_NAMES[store.where?.scene ?? ''] ?? 'đây'}…`} aria-label="Tin nhắn chat chung" enterKeyHint="send" autoComplete="off" />
          <span className="chat-count">{len(text)}/{PUBLIC_MAX}</span>
        </span>
        <button type="submit" disabled={busy || !text.trim()}>Gửi</button>
        <button type="button" className="ghost chat-ico" onClick={onClose} aria-label="Đóng ô chat">✕</button>
      </form>
      {err && <p className="chat-err" role="alert">{err}</p>}
    </div>
  );
}

/** Dòng chat mới nhất hiện thoáng 6 giây cạnh nút 💬 (bong bóng trên đầu chỉ thấy khi người nói trong khung hình). */
function LatestLine({ store, onOpen }: { store: typeof chatStore; onOpen: () => void }) {
  const last = store.log.at(-1);
  const [shownId, setShownId] = useState<number | null>(null);
  useEffect(() => {
    if (!last || Date.now() - last.at > 8000) return;
    setShownId(last.id); const t = setTimeout(() => setShownId(null), 6000); return () => clearTimeout(t);
  }, [last?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!last || shownId !== last.id) return null;
  return <button className="chat-recent" onClick={onOpen} aria-label="Mở chat chung"><span className="chat-line"><b>{last.name}</b> {last.text}</span></button>;
}

function PlayerCardView({ userId, me, onClose, onMessage, onChanged }: { userId: number; me: ChatMe; onClose: () => void; onMessage: (u: { userId: number; name: string }) => void; onChanged: () => void }) {
  const [c, setC] = useState<PlayerCard | null>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [report, setReport] = useState(false);
  const [reason, setReason] = useState<ReportReason>('tuc_tiu'), [note, setNote] = useState(''), [done, setDone] = useState('');
  const load = useCallback(async () => { try { setC(await api<PlayerCard>('GET', `/api/players/${userId}/card`)); } catch (e) { setErr(errText(e)); } }, [userId]);
  useEffect(() => { void load(); }, [load]);
  const act = async (fn: () => Promise<unknown>, msg?: string) => { setBusy(true); setErr(''); try { await fn(); if (msg) setDone(msg); await load(); onChanged(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); } };
  const role = c?.role ? ROLE_INFO[c.role as Role] : null;
  return (
    <div className="chat-card-wrap" role="dialog" aria-modal="true" aria-label="Thẻ người chơi" onClick={onClose}>
      <div className="chat-card" onClick={(e) => e.stopPropagation()}>
        <button className="chat-x ghost" onClick={onClose} aria-label="Đóng">✕</button>
        {!c ? <p>{err || 'Đang tải…'}</p> : (
          <>
            <div className="chat-card-head">
              <span className="chat-avatar" aria-hidden>{role?.icon ?? '🙂'}</span>
              <div><h3>{c.name}</h3><p>{role?.name ?? 'Người chơi'} · cấp {c.level}{c.bot ? ' · cư dân xóm' : ''}</p>{c.region && <p className="muted">🏡 {c.region}</p>}</div>
            </div>
            {c.userId === me.id ? <p className="muted">Đây là bạn.</p> : c.bot ? <p className="muted">Cư dân của xóm, không kết bạn hay nhắn riêng được.</p> : report ? (
              <div className="chat-report">
                <p><b>Báo cáo {c.name}</b> — ban quản trị xem lại tin nhắn gần đây của người này.</p>
                <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} aria-label="Lý do báo cáo">
                  {Object.entries(REPORT_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Mô tả thêm (không bắt buộc)" aria-label="Mô tả thêm" />
                <div className="chat-row">
                  <button disabled={busy} onClick={() => void act(() => api('POST', '/api/chat/report', { userId: c.userId, reason, note }), 'Đã gửi báo cáo. Cảm ơn bạn!').then(() => setReport(false))}>Gửi báo cáo</button>
                  <button className="ghost" onClick={() => setReport(false)}>Thôi</button>
                </div>
              </div>
            ) : (
              <div className="chat-card-actions">
                {c.blockedMe ? <p className="muted">Người này không nhận lời mời hay tin nhắn từ bạn.</p> : c.blocked ? null
                  : c.friend === 'friends' ? <button onClick={() => onMessage({ userId: c.userId, name: c.name })}>✉️ Nhắn tin</button>
                  : c.friend === 'incoming' ? <>
                      <button disabled={busy} onClick={() => void act(() => api('POST', `/api/friends/by-id/${c.userId}`, {}), 'Hai bạn đã là bạn bè!')}>✅ Chấp nhận kết bạn</button>
                      <button className="ghost" disabled={busy} onClick={() => void act(() => api('DELETE', `/api/friends/${c.userId}`))}>Từ chối</button>
                    </>
                  : c.friend === 'outgoing' ? <>
                      <span className="chat-pill">Đã gửi lời mời</span>
                      <button className="ghost" disabled={busy} onClick={() => void act(() => api('DELETE', `/api/friends/${c.userId}`))}>Huỷ lời mời</button>
                    </>
                  : <button disabled={busy} onClick={() => void act(() => api('POST', `/api/friends/by-id/${c.userId}`, {}), 'Đã gửi lời mời kết bạn.')}>🤝 Kết bạn</button>}
                {c.friend === 'friends' && <button className="ghost" disabled={busy} onClick={() => { if (confirm(`Huỷ kết bạn với ${c.name}?`)) void act(() => api('DELETE', `/api/friends/${c.userId}`)); }}>Huỷ kết bạn</button>}
                {c.blocked
                  ? <button className="ghost" disabled={busy} onClick={() => void act(() => api('DELETE', `/api/chat/block/${c.userId}`), 'Đã bỏ chặn.')}>Bỏ chặn</button>
                  : <button className="ghost danger" disabled={busy} onClick={() => { if (confirm(`Chặn ${c.name}? Hai bạn sẽ không thấy tin nhắn của nhau và mất kết bạn.`)) void act(() => api('POST', `/api/chat/block/${c.userId}`, {}), 'Đã chặn.'); }}>🚫 Chặn</button>}
                <button className="ghost danger" onClick={() => setReport(true)}>⚑ Báo cáo</button>
              </div>
            )}
            {done && <p className="chat-ok" role="status">{done}</p>}
            {err && <p className="chat-err" role="alert">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Conversation({ peer, me, onBack, onCard, refresh }: { peer: { userId: number; name: string }; me: ChatMe; onBack: () => void; onCard: () => void; refresh: () => void }) {
  const [msgs, setMsgs] = useState<DmMsg[]>([]), [can, setCan] = useState<{ ok: boolean; reason?: string }>({ ok: true }), [text, setText] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const last = useRef(0), list = useRef<HTMLDivElement | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await api<{ msgs: DmMsg[]; canSend: boolean; reason?: string }>('GET', `/api/chat/dm/${peer.userId}?after=${last.current}`);
      setCan({ ok: r.canSend, reason: r.reason });
      if (r.msgs.length) {
        last.current = Math.max(last.current, ...r.msgs.map((m) => m.id)); setMsgs((m) => [...m, ...r.msgs.filter((x) => !m.some((y) => y.id === x.id))]);
        if (r.msgs.some((m) => m.from === peer.userId && !m.read)) { await api('POST', `/api/chat/dm/${peer.userId}/read`, {}); refresh(); }
      }
    } catch (e) { setErr(errText(e)); }
  }, [peer.userId, refresh]);
  useEffect(() => { void load(); const t = setInterval(() => { if (!document.hidden) void load(); }, INBOX_POLL_MS.open); return () => clearInterval(t); }, [load]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [msgs.length]);
  const send = async () => {
    const t = text.trim(); if (!t || busy) return; setBusy(true); setErr('');
    try { await api('POST', `/api/chat/dm/${peer.userId}`, { text: t }); setText(''); await load(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="chat-convo">
      <div className="chat-convo-head">
        <button className="ghost" onClick={onBack} aria-label="Quay lại danh sách">‹</button>
        <button className="chat-convo-name" onClick={onCard}>{peer.name}</button>
      </div>
      <div className="chat-msgs" ref={list}>
        {msgs.length === 0 && <p className="muted">Chưa có tin nhắn. Gửi lời chào nhé!</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`chat-bub ${m.from === me.id ? 'mine' : ''}`}><span>{m.text}</span><small>{hhmm(m.at)}</small></div>
        ))}
      </div>
      {can.ok ? (
        <form className="chat-send" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <textarea value={text} maxLength={DM_MAX} rows={2} onChange={(e) => setText(e.target.value)} placeholder={`Nhắn cho ${peer.name}…`} aria-label="Tin nhắn riêng"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} />
          <button type="submit" disabled={busy || !text.trim()}>Gửi</button>
        </form>
      ) : <p className="chat-err">{can.reason}</p>}
      {err && <p className="chat-err" role="alert">{err}</p>}
    </div>
  );
}

type Tab = 'quanh' | 'tin' | 'loa' | 'chan';
function ChatPanel({ me, store, poll, refresh, initial, onClose, onCard, peer, setPeer }: {
  me: ChatMe; store: typeof chatStore; poll: ChatPoll; refresh: () => void; initial: Tab; onClose: () => void; onCard: (id: number) => void;
  peer: { userId: number; name: string } | null; setPeer: (p: { userId: number; name: string } | null) => void;
}) {
  const [tab, setTab] = useState<Tab>(initial);
  const [threads, setThreads] = useState<ChatThread[] | null>(null), [inc, setInc] = useState<{ userId: number; displayName: string }[]>([]);
  const [hist, setHist] = useState<Broadcast[]>([]), [blocks, setBlocks] = useState<{ userId: number; name: string }[]>([]);
  const [loa, setLoa] = useState(''), [msg, setMsg] = useState(''), [busy, setBusy] = useState(false);
  const loadThreads = useCallback(async () => {
    try { const [t, f] = await Promise.all([api<{ threads: ChatThread[] }>('GET', '/api/chat/threads'), api<{ incoming: { userId: number; displayName: string }[] }>('GET', '/api/friends')]); setThreads(t.threads); setInc(f.incoming); } catch { setThreads([]); }
  }, []);
  useEffect(() => { if (tab === 'tin') void loadThreads(); }, [tab, loadThreads, poll.unread, poll.requests]);
  useEffect(() => { if (tab === 'loa') void api<{ broadcasts: Broadcast[] }>('GET', '/api/chat/broadcasts').then((r) => setHist(r.broadcasts)).catch(() => {}); }, [tab]);
  useEffect(() => { if (tab === 'chan') void api<{ blocks: { userId: number; name: string }[] }>('GET', '/api/chat/blocks').then((r) => setBlocks(r.blocks)).catch(() => {}); }, [tab]);
  const near = store.near.filter((o) => !o.bot), bots = store.near.filter((o) => o.bot).length;
  const canLoa = (me.level ?? 1) >= BROADCAST_MIN_LEVEL;
  const kb = useKeyboardInset(true);
  return (
    <div className="chat-panel" role="dialog" aria-label="Trò chuyện" style={kb > 40 ? { bottom: kb + 6 } : undefined}>
      <div className="chat-panel-head">
        <h3>Trò chuyện</h3>
        <button className="ghost chat-x" onClick={onClose} aria-label="Đóng trò chuyện">✕</button>
      </div>
      {peer ? <Conversation peer={peer} me={me} onBack={() => { setPeer(null); void loadThreads(); }} onCard={() => onCard(peer.userId)} refresh={refresh} /> : (
        <>
          <div className="chat-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'quanh'} onClick={() => setTab('quanh')}>Quanh đây</button>
            <button role="tab" aria-selected={tab === 'tin'} onClick={() => setTab('tin')}>Tin nhắn{poll.unread + poll.requests > 0 ? ` (${poll.unread + poll.requests})` : ''}</button>
            <button role="tab" aria-selected={tab === 'loa'} onClick={() => setTab('loa')}>Loa</button>
            <button role="tab" aria-selected={tab === 'chan'} onClick={() => setTab('chan')}>Đã chặn</button>
          </div>
          <div className="chat-body">
            {tab === 'quanh' && (
              <>
                {!store.where ? <p className="muted">Ra xóm, đi tham quan, khu vui chơi hay trạm dừng để gặp người chơi khác và chat chung.</p> : (
                  <>
                    <p className="muted">Đang ở: <b>{SCENE_NAMES[store.where.scene] ?? store.where.scene}</b> · {near.length} người chơi{bots ? `, ${bots} cư dân` : ''}</p>
                    <div className="chat-near">
                      {near.length === 0 && <p className="muted">Chưa có người chơi nào khác ở đây.</p>}
                      {near.map((o) => <button key={o.id} className="chat-near-item" onClick={() => onCard(o.id)}><span aria-hidden>{o.role ? ROLE_INFO[o.role as Role]?.icon : '🙂'}</span> {o.name}</button>)}
                    </div>
                    <h4>Chat chung</h4>
                    <div className="chat-log">
                      {store.log.length === 0 && <p className="muted">Chưa ai nói gì. Bấm 💬 để chào mọi người.</p>}
                      {store.log.map((m: PublicMsg) => (
                        <p key={m.id} className="chat-line"><small>{hhmm(m.at)}</small> {m.userId > 0 && m.userId !== me.id ? <button className="chat-name" onClick={() => onCard(m.userId)}>{m.name}</button> : <b>{m.name}</b>} {m.text}</p>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
            {tab === 'tin' && (
              <>
                {inc.length > 0 && <div className="chat-req"><h4>Lời mời kết bạn</h4>{inc.map((r) => <button key={r.userId} className="chat-near-item" onClick={() => onCard(r.userId)}>🤝 {r.displayName}</button>)}</div>}
                {threads === null ? <p className="muted">Đang tải…</p> : threads.length === 0 ? <p className="muted">Chỉ nhắn riêng được với bạn bè. Gặp ai ở đâu thì bấm vào tên trong "Quanh đây" để kết bạn.</p>
                  : threads.map((t) => (
                    <button key={t.userId} className="chat-thread" onClick={() => setPeer({ userId: t.userId, name: t.name })}>
                      <b>{t.name}</b>{t.unread > 0 && <span className="chat-dot" aria-label={`${t.unread} tin chưa đọc`}>{t.unread}</span>}
                      <small>{t.last ? `${t.last.mine ? 'Bạn: ' : ''}${t.last.text.slice(0, 60)}` : 'Chưa có tin nhắn'}</small>
                    </button>
                  ))}
              </>
            )}
            {tab === 'loa' && (
              <>
                <p className="muted">Loa phát thanh chạy chữ trên màn hình của mọi người đang chơi. {fmtMoney(BROADCAST_PRICE)}/lượt, từ cấp {BROADCAST_MIN_LEVEL}, mỗi người 1 lượt mỗi giờ; không được có số điện thoại, đường dẫn hay từ tục.</p>
                <form className="chat-loa" onSubmit={async (e) => {
                  e.preventDefault(); if (!loa.trim()) return; setBusy(true); setMsg('');
                  try { const r = await api<{ waitMs: number }>('POST', '/api/chat/broadcast', { text: loa.trim() }); setLoa(''); setMsg(r.waitMs > 2000 ? `Đã xếp hàng, phát sau khoảng ${Math.ceil(r.waitMs / 1000)} giây.` : 'Đang phát!'); refresh(); }
                  catch (er) { setMsg(errText(er)); } finally { setBusy(false); }
                }}>
                  <textarea value={loa} maxLength={BROADCAST_MAX} rows={2} disabled={!canLoa} onChange={(e) => setLoa(e.target.value)} placeholder={canLoa ? 'Ví dụ: Chợ phiên Cái Bè sáng nay, ghé chơi nha!' : `Từ cấp ${BROADCAST_MIN_LEVEL} mới dùng loa`} aria-label="Nội dung loa" />
                  <div className="chat-row"><span className="chat-count">{len(loa)}/{BROADCAST_MAX}</span><button type="submit" disabled={!canLoa || busy || !loa.trim() || me.cash < BROADCAST_PRICE}>📢 Phát · {fmtMoney(BROADCAST_PRICE)}</button></div>
                  {msg && <p className="chat-ok" role="status">{msg}</p>}
                </form>
                <h4>Loa gần đây</h4>
                {hist.length === 0 ? <p className="muted">Chưa có ai phát loa.</p> : hist.map((b) => <p key={b.id} className="chat-line"><small>{hhmm(b.startsAt)}</small> <b>{b.admin ? '🛡️ ' : ''}{b.from}:</b> {b.text}</p>)}
              </>
            )}
            {tab === 'chan' && (
              blocks.length === 0 ? <p className="muted">Bạn chưa chặn ai. Người bị chặn không nhắn riêng, không kết bạn với bạn, và bạn không thấy chat chung của họ.</p>
                : blocks.map((b) => <div key={b.userId} className="chat-row"><span>{b.name}</span><button className="ghost" onClick={async () => { await api('DELETE', `/api/chat/block/${b.userId}`).catch(() => {}); setBlocks((x) => x.filter((y) => y.userId !== b.userId)); }}>Bỏ chặn</button></div>)
            )}
          </div>
          <p className="chat-safe">🛡️ Không chia sẻ số điện thoại, địa chỉ, mật khẩu. Ai làm phiền: bấm vào tên → Chặn hoặc Báo cáo.</p>
        </>
      )}
    </div>
  );
}

/** Gắn một lần trong App khi đã đăng nhập.
 *  dock: chỗ trong HUD (thanh thứ hai) để đặt nút 💬 khi đang ở màn làng — App truyền null khi đang ở cảnh toàn màn hình,
 *  lúc đó nút nổi nhỏ ở mép trái giữa màn. hidden: đang mở bảng (Kho, Hồ sơ…) — ẩn hẳn để không đè nội dung. */
export function ChatLayer({ me, onFriendsChanged, dock, hidden }: { me: ChatMe; onFriendsChanged?: () => void; dock?: HTMLElement | null; hidden?: boolean }) {
  const store = useChatStore();
  const [open, setOpen] = useState<Tab | null>(null), [compose, setCompose] = useState(false), [card, setCard] = useState<number | null>(null), [peer, setPeer] = useState<{ userId: number; name: string } | null>(null);
  const { poll, refresh, queue, setQueue } = usePoll(open !== null);
  useEffect(() => {
    const f = (e: Event) => { const id = Number((e as CustomEvent).detail); if (id > 0) setCard(id); };
    window.addEventListener(PLAYER_CARD_EVENT, f); return () => window.removeEventListener(PLAYER_CARD_EVENT, f);
  }, []);
  useEffect(() => { if (!store.where) setCompose(false); }, [store.where]);
  useEffect(() => { if (hidden) setCompose(false); }, [hidden]);
  const badge = poll.unread + poll.requests;
  const tap = () => { if (badge > 0 || !store.where) setOpen(badge > 0 ? 'tin' : 'quanh'); else setCompose(true); };
  const fab = (
    <button className={`chat-fab${dock ? ' docked' : ''}`} onClick={tap} aria-label={`Trò chuyện${badge ? `, ${badge} việc mới` : ''}`}>
      <span aria-hidden>💬</span>{badge > 0 && <span className="chat-dot">{badge > 9 ? '9+' : badge}</span>}
    </button>
  );
  const idle = open === null && !compose && !hidden;
  return (
    <>
      <Ticker queue={queue} setQueue={setQueue} />
      {idle && (dock ? createPortal(fab, dock) : <div className="chat-float">{fab}<LatestLine store={store} onOpen={() => setCompose(true)} /></div>)}
      {idle && dock && <div className="chat-latest-docked"><LatestLine store={store} onOpen={() => setCompose(true)} /></div>}
      {compose && open === null && !hidden && <ComposeBar store={store} badge={badge} onClose={() => setCompose(false)} onPanel={() => { setCompose(false); setOpen(badge > 0 ? 'tin' : 'quanh'); }} />}
      {open !== null && <ChatPanel me={me} store={store} poll={poll} refresh={() => void refresh()} initial={open} onClose={() => { setOpen(null); setPeer(null); }} onCard={setCard} peer={peer} setPeer={setPeer} />}
      {card !== null && <PlayerCardView userId={card} me={me} onClose={() => setCard(null)} onChanged={() => { void refresh(); onFriendsChanged?.(); }}
        onMessage={(u) => { setCard(null); setPeer(u); setOpen('tin'); }} />}
    </>
  );
}

// Trò chuyện trong Vườn Việt: chat công cộng (bong bóng trên đầu người cùng cảnh), chat riêng giữa bạn bè, loa phát thanh toàn máy chủ.
// Dùng chung cho máy chủ (server/src/chat.ts) và trình duyệt (web/src/chat/**). Bộ lọc chạy ở máy chủ là chính; trình duyệt chỉ báo trước.

/** Chat công cộng: ngắn để vừa bong bóng, chống spam theo nhịp. */
export const PUBLIC_MAX = 80, PUBLIC_MIN_GAP_MS = 3_000, PUBLIC_PER_MIN = 10;
/** Bong bóng hiện trên đầu bao lâu; nhật ký chat công cộng của một cảnh giữ bao lâu khi trả về. */
export const BUBBLE_MS = 8_000, PUBLIC_LOG_MS = 10 * 60_000, PUBLIC_LOG_MAX = 40;
/** Chat riêng: chỉ giữa bạn bè, trần an toàn mỗi tin, chống spam. */
export const DM_MAX = 2_000, DM_MIN_GAP_MS = 800, DM_PER_MIN = 30;
/** Loa phát thanh: giá, cấp tối thiểu, mỗi người 1 lượt/giờ, mỗi lượt chạy chữ chừng này giây, xếp hàng nối tiếp. */
export const BROADCAST_MAX = 120, BROADCAST_PRICE = 5_000_000, BROADCAST_MIN_LEVEL = 10, BROADCAST_COOLDOWN_MS = 3600_000, BROADCAST_SHOW_MS = 15_000;
/** Nhịp hỏi hộp thư khi không có WebSocket (Vercel): tab ẩn thì dừng. */
export const INBOX_POLL_MS = { open: 4_000, idle: 9_000 };
/** Nhật ký chat lưu để xử lý báo cáo (ngày). */
export const CHAT_KEEP_DAYS = 30;
export const REPORT_REASONS = { tuc_tiu: 'Nói tục, xúc phạm', quay_roi: 'Quấy rối, đe doạ', lua_dao: 'Lừa đảo, xin tiền', thong_tin_ca_nhan: 'Xin/đưa thông tin cá nhân', khac: 'Khác' } as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export interface PublicMsg { id: number; userId: number; name: string; text: string; at: number; bot?: boolean }
export interface DmMsg { id: number; from: number; to: number; text: string; at: number; read: boolean }
export interface Broadcast { id: number; text: string; from: string; admin: boolean; startsAt: number; endsAt: number }
export interface ChatThread { userId: number; name: string; last: { text: string; at: number; mine: boolean } | null; unread: number }
export interface ChatPoll { unread: number; requests: number; broadcasts: Broadcast[]; at: number }
export interface PlayerCard {
  userId: number; name: string; role: string | null; level: number; region: string | null; bot: boolean;
  friend: 'none' | 'friends' | 'outgoing' | 'incoming'; blocked: boolean; blockedMe: boolean;
}

/** Bỏ dấu tiếng Việt, đ → d, chữ thường. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
}
/** Chuẩn hoá một từ để so: bỏ dấu, thay chữ số giả chữ (0→o, 1→i, 3→e, 4→a, @→a, $→s), bỏ ký tự lặp (điiiit → dit). */
function norm(w: string): string {
  return fold(w).replace(/[0@]/g, (c) => (c === '0' ? 'o' : 'a')).replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/\$/g, 's')
    .replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
}
/** Từ tục viết KHÔNG dấu / teencode (đã chuẩn hoá: không dấu, không lặp chữ) — chỉ chặn khi người gõ không bỏ dấu,
 *  vì bản có dấu thường là chữ thường ("buổi", "đít"…). Bản có dấu thật sự tục ở BAD_EXACT. */
const BAD_WORDS = new Set([
  'dm', 'dmm', 'dcm', 'dkm', 'dcmm', 'dmml', 'vcl', 'vkl', 'vcc', 'clm', 'cmm', 'dit', 'djt', 'cak', 'loz', 'lozz',
  'fuck', 'fck', 'fuk', 'shit', 'bitch', 'dick', 'cunt', 'motherfucker', 'nigga', 'nigger',
]);
/** Từ tục viết có dấu (chữ thường, dựng sẵn NFC). */
const BAD_EXACT = new Set(['lồn', 'lìn', 'cặc', 'buồi', 'đụ', 'địt', 'đéo', 'dái', 'đĩ', 'cứt'].map((w) => w.normalize('NFC')));
const PHRASES = [
  'dit me', 'dit cu', 'du me', 'du ma', 'deo me', 'me may', 'cha may', 'bo may', 'thang cho', 'con cho', 'cho de', 'oc cho', 'suc vat', 'do ngu', 'thang ngu', 'con ngu',
  'cai lon', 'con cac', 'cai cac', 'an cac', 'vai lon', 'vai cac', 'dau buoi', 'mat lon', 'do khon', 'do cho', 'con di', 'thang di', 'cave', 'do de',
  'chet di', 'giet may', 'tu tu di',
];
const PHRASE_SET = new Set(PHRASES.map((p) => p.split(' ').map(norm).join(' ')));

const MASK = '***';
/** Số điện thoại (9–11 chữ số, có thể cách bằng dấu cách, chấm, gạch) — kể cả viết +84. */
const PHONE = /(?:\+?84|0)(?:[\s.\-]?\d){8,10}\b|\b\d(?:[\s.\-]?\d){8,10}\b/g;
/** Đường dẫn, tên miền, tài khoản mạng xã hội, email. */
const LINK = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+(?:\.|\s*(?:chấm|cham)\s*)(?:com|vn|net|org|io|me|ly|gg|xyz|info|top)\b\S*|\b(?:zalo|facebook|fb|tiktok|telegram|tele|insta|instagram|messenger|discord)\s*[:.]?\s*[\w.@/-]*|[\w.+-]+@[\w-]+\.[\w.]+|@[a-z0-9_.]{3,}/gi;

export interface FilterResult { text: string; masked: boolean; reasons: ('tuc_tiu' | 'so_dien_thoai' | 'lien_ket')[] }
/** Lọc một tin: che từ tục, số điện thoại, đường dẫn bằng ***; gộp khoảng trắng, cắt ký tự điều khiển. */
export function filterText(raw: string, max: number): FilterResult {
  const reasons = new Set<FilterResult['reasons'][number]>();
  let s = raw.replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  s = s.replace(LINK, () => { reasons.add('lien_ket'); return MASK; });
  s = s.replace(PHONE, () => { reasons.add('so_dien_thoai'); return MASK; });
  // tách thành từ (giữ khoảng trắng và dấu câu để ráp lại)
  const parts = s.split(/(\s+|[.,!?;:()"'“”‘’…\-]+)/);
  const words: number[] = []; parts.forEach((p, i) => { if (p && !/^(\s+|[.,!?;:()"'“”‘’…\-]+)$/.test(p)) words.push(i); });
  const n = words.map((i) => norm(parts[i]));
  const hit = new Array(words.length).fill(false);
  for (let k = 0; k < words.length; k++) {
    const w = n[k], raw1 = parts[words[k]];
    if (!w) continue;
    const low = raw1.normalize('NFC').toLowerCase().replace(/(.)\1+/gu, '$1'), toned = /[^\x00-\x7fđĐ]/.test(raw1); // chỉ có chữ đ thì vẫn coi như viết tắt không dấu (đm, đcm)
    if (BAD_EXACT.has(low) || (!toned && BAD_WORDS.has(w))) hit[k] = true;
    for (const len of [2, 3]) {
      if (k + len > words.length) continue;
      const ph = n.slice(k, k + len).join(' ');
      if (PHRASE_SET.has(ph)) for (let j = k; j < k + len; j++) hit[j] = true;
    }
    // viết dính liền ("dmmay", "ditme", "occho")
    if (w.length >= 4) for (const ph of PHRASE_SET) if (w === ph.replace(/ /g, '')) hit[k] = true;
  }
  if (hit.some(Boolean)) reasons.add('tuc_tiu');
  hit.forEach((h, k) => { if (h) parts[words[k]] = MASK; });
  s = parts.join('').replace(/(\*\*\*)(\s*\*\*\*)+/g, MASK);
  if ([...s].length > max) s = [...s].slice(0, max).join('');
  return { text: s.trim(), masked: reasons.size > 0, reasons: [...reasons] };
}

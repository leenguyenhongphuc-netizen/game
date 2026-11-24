// Album ảnh lưu niệm: ảnh chụp thật từ cảnh lúc đóng dấu, lưu trên máy (localStorage), tối đa 60 tấm (bỏ tấm cũ nhất).
export interface AlbumPhoto { sight: string; stop: string; url: string; at: number }
const KEY = 'vv-album-v1', MAX = 60;
function all(): AlbumPhoto[] { try { const v = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; } }
export function albumOf(sight: string): AlbumPhoto[] { return all().filter((p) => p.sight === sight); }
export function savePhoto(sight: string, stop: string, url: string): void {
  try {
    const list = all().filter((p) => !(p.sight === sight && p.stop === stop)); list.push({ sight, stop, url, at: Date.now() });
    while (list.length > MAX) list.shift();
    for (;;) { try { localStorage.setItem(KEY, JSON.stringify(list)); return; } catch { if (list.length <= 1) return; list.shift(); } }
  } catch { /* không có bộ nhớ: album chỉ sống trong phiên */ }
}

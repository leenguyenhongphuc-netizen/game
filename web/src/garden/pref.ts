// Lựa chọn kiểu hiển thị vườn: tranh vẽ nhìn chéo (2,5D) hay 3D. Điện thoại, máy tính bảng mặc định Tranh vẽ (nhẹ hơn); máy tính mặc định 3D.
// Ép bằng ?tranh=1 / ?tranh=0 hoặc localStorage vv-tranh. Bộ kiểm tự động (navigator.webdriver) luôn mặc định 3D.
const KEY = 'vv-tranh';
/** Máy cảm ứng chưa từng chọn thì dùng Tranh vẽ. */
function touchDefault(): boolean {
  try { if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return false; return navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
}
export function isPainted(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('tranh');
    if (q === '1') { localStorage.setItem(KEY, '1'); return true; }
    if (q === '0') { localStorage.setItem(KEY, '0'); return false; }
    const v = localStorage.getItem(KEY); return v === null ? touchDefault() : v === '1';
  } catch { return false; }
}
/** Đã từng chọn kiểu hiển thị (để hiện nút chuyển đổi cả khi đang ở 3D). */
export function hasPaintedPref(): boolean { try { return localStorage.getItem(KEY) !== null || touchDefault(); } catch { return false; } }
/** Lưu lựa chọn và báo cho màn vườn đổi ngay, không cần tải lại trang. */
export function setPaintedPref(on: boolean) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* bỏ qua */ }
  window.dispatchEvent(new CustomEvent('vv-tranh', { detail: on }));
}

// Luật soát bố cục dùng chung cho run.mjs và matrix.mjs. Hàm audit chạy TRONG trang (page.evaluate),
// nên phải tự chứa, không dùng biến bên ngoài.
//
// Quy tắc (lỗi = error, cảnh báo = warn):
//   tran-ngang            trang cuộn ngang được
//   cuon-ngang-trong-khung một khung (bảng, thẻ, cửa sổ) cuộn ngang được dù không phải thanh cuộn ngang có chủ đích
//   bi-cat-ngang          nội dung rộng hơn khung có overflow ẩn/clip → phần bên phải bị cắt mất
//   tran-khoi-khung       phần tử con lòi ra ngoài mép một khung có viền/nền (thẻ, viên, cửa sổ) quá 1 px
//   chu-bi-cat            chữ bị cắt mà không có dấu "…"
//   nut-ngoai-man-hinh, khoi-tran-man-hinh   nút/khối nổi nằm ngoài phần màn hình nhìn thấy
//   khoi-de-nhau          hai khối nổi (HUD, cửa sổ, thanh nút…) đè lên nhau
//   o-danh-dau-bi-gian    ô đánh dấu/nút chọn bị kéo to quá 32 px
//   nut-qua-nho           vùng bấm nhỏ hơn 44×44 trên máy cảm ứng (lỗi khi dưới 40, cảnh báo 40–43)
export function audit(touch) {
  const issues = [];
  const vv = window.visualViewport;
  const X0 = vv ? vv.offsetLeft : 0, Y0 = vv ? vv.offsetTop : 0, W = vv ? vv.width : window.innerWidth, H = vv ? vv.height : window.innerHeight;
  if (document.documentElement.scrollWidth > window.innerWidth + 1) issues.push({ level: 'error', rule: 'tran-ngang', detail: `scrollWidth ${document.documentElement.scrollWidth} > ${window.innerWidth}` });
  const box = (el) => { const q = el.getBoundingClientRect(); return { left: q.left - X0, top: q.top - Y0, right: q.right - X0, bottom: q.bottom - Y0, width: q.width, height: q.height }; };
  const visible = (el) => {
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) <= 0.05 || r.width <= 0 || r.height <= 0) return false;
    const d = el.closest('details'); // nội dung của khung "details" đang đóng vẫn có hộp nhưng không hiện
    return !(d && !d.open && !el.closest('summary') && el !== d);
  };
  /** Phần tử con lòi xa nhất về bên phải của el (để biết thủ phạm). */
  const culprit = (el) => { const q = el.getBoundingClientRect(); let best = null, over = 0; for (const c of el.querySelectorAll('*')) { const r = c.getBoundingClientRect(); if (r.width > 0 && r.right - q.right > over && getComputedStyle(c).position !== 'absolute') { over = r.right - q.right; best = c; } } return best ? ` · thủ phạm ${label(best)} (+${Math.round(over)})` : ''; };
  // Thanh cuộn ngang có chủ đích: dải tab, dải viên thời tiết, bảng số liệu, thanh hạt giống, dải ảnh…
  const HSCROLL = '.tabs, .chips, .table-wrap, .seed-bar, .seed-track, .seeds, .plot-switch, .track, .shop-cats, .veh-filter, .hscroll, [data-scroll-x]';
  // Khung toàn màn hình cố ý ẩn phần thừa
  const FRAMES = '.game, .center, .exam, .wheel-screen, .scene, .tr, .dg, .sw, .heli, .sa';
  const scrollParent = (el) => { for (let p = el.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll)/.test(o.overflowY + o.overflowX) || p.matches(HSCROLL)) return p; } return null; };
  const label = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''} "${(el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40)}"`;
  const skipTree = (el) => el.closest('canvas, svg, .vmap, .exam-scene, .world, [data-audit-skip]');
  // 1. Nút ngoài màn hình hoặc quá nhỏ
  for (const el of document.querySelectorAll('button, a, input, select, [role="button"]')) {
    if (!visible(el)) continue;
    const r = box(el), sp = scrollParent(el);
    if (!sp && (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1)) issues.push({ level: 'error', rule: 'nut-ngoai-man-hinh', detail: `${label(el)} tại [${Math.round(r.left)}, ${Math.round(r.top)}, ${Math.round(r.right)}, ${Math.round(r.bottom)}] ngoài ${Math.round(W)}×${Math.round(H)}` });
    if (!touch || el.closest('svg') || el.classList.contains('link')) continue;
    // ô đánh dấu nằm trong nhãn: vùng bấm là cả nhãn
    const hitEl = (el.matches('input[type="checkbox"], input[type="radio"]') && el.closest('label')) || el;
    const hr = hitEl.getBoundingClientRect();
    const m = Math.min(hr.width, hr.height);
    if (m < 40) issues.push({ level: 'error', rule: 'nut-qua-nho', detail: `${label(el)} ${Math.round(hr.width)}×${Math.round(hr.height)}` });
    else if (m < 44 - 0.5) issues.push({ level: 'warn', rule: 'nut-qua-nho', detail: `${label(el)} ${Math.round(hr.width)}×${Math.round(hr.height)}` });
  }
  // 1b. Ô đánh dấu/nút chọn bị luật "input { width: 100% }" kéo giãn (lỗi màn sân sát hạch 23/11)
  for (const el of document.querySelectorAll('input[type="checkbox"], input[type="radio"]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 32 || r.height > 32) issues.push({ level: 'error', rule: 'o-danh-dau-bi-gian', detail: `${label(el.closest('label') ?? el)} ${Math.round(r.width)}×${Math.round(r.height)}` });
  }
  // 2. Khối nổi tràn khỏi màn hình
  const blocks = ['.coin', '.en-bar', '.lvl-badge', '.dg-top', '.dg-hud', '.tr-cap', '.tr-hud', '.sw-top', '.sw-card', '.sw-guide', '.context', '.hud-top', '.chips', '.quest', '.plot-switch', '.hud-pop', '.farm-bar', '.toast', '.ctx-bar', '.ctx-detail', '.dock', '.modal', '.card', '.wheel-wrap', '.wheel-head', '.brand', '.exam-card', '.exam-top', '.exam-ctl', '.sa-hud', '.sa-panel'];
  const rects = {};
  for (const sel of blocks) for (const el of document.querySelectorAll(sel)) {
    if (!visible(el)) continue;
    const r = box(el); rects[sel] = r;
    if (!scrollParent(el) && (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1)) issues.push({ level: 'error', rule: 'khoi-tran-man-hinh', detail: `${sel} tại [${Math.round(r.left)}, ${Math.round(r.top)}, ${Math.round(r.right)}, ${Math.round(r.bottom)}] ngoài ${Math.round(W)}×${Math.round(H)}` });
  }
  // 3. Khối nổi đè nhau
  const hit = (a, b) => a && b && a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
  for (const [a, b] of [['.hud-top', '.chips'], ['.hud-top', '.quest'], ['.chips', '.quest'], ['.quest', '.plot-switch'], ['.hud-top', '.hud-row'], ['.farm-bar', '.dock'], ['.ctx-bar', '.farm-bar'], ['.ctx-bar', '.dock'], ['.ctx-detail', '.dock'], ['.modal', '.dock'], ['.modal', '.hud-top'], ['.toast', '.hud-top'], ['.toast', '.quest'], ['.toast', '.plot-switch'], ['.context', '.dock'], ['.wheel-wrap', '.wheel-head'], ['.exam-top', '.exam-ctl']]) {
    if (hit(rects[a], rects[b])) issues.push({ level: 'error', rule: 'khoi-de-nhau', detail: `${a} đè lên ${b}` });
  }
  // 4. Khung cuộn ngang ngoài ý muốn, hoặc nội dung bị cắt ngang
  const all = [...document.body.querySelectorAll('*')];
  for (const el of all) {
    if (el.matches(HSCROLL) || skipTree(el) || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') continue;
    const sw = el.scrollWidth, cw = el.clientWidth;
    if (cw === 0 || sw <= cw + 1) continue;
    const cs = getComputedStyle(el);
    if (cs.overflowX === 'visible' || !visible(el)) continue;
    if (el.matches(FRAMES)) continue; // khung toàn màn hình cố ý cắt (cảnh 3D, bánh xe quay); phần lòi ra màn hình đã có luật khoi-tran-man-hinh
    if (cs.textOverflow === 'ellipsis') continue;
    if (/(auto|scroll)/.test(cs.overflowX)) issues.push({ level: 'error', rule: 'cuon-ngang-trong-khung', detail: `${label(el)} rộng ${sw} > ${cw}${culprit(el)}` });
    else if (el.children.length > 0 || el.innerText.trim()) issues.push({ level: 'error', rule: 'bi-cat-ngang', detail: `${label(el)} rộng ${sw} > ${cw}${culprit(el)}` });
  }
  // 5. Phần tử con lòi khỏi khung có viền hoặc nền (thẻ, viên, cửa sổ)
  const framed = new Map();
  const isFrame = (p) => {
    if (framed.has(p)) return framed.get(p);
    const cs = getComputedStyle(p);
    const v = (parseFloat(cs.borderLeftWidth) > 0 && cs.borderLeftStyle !== 'none') || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') || cs.backgroundImage !== 'none';
    framed.set(p, v); return v;
  };
  const reported = new Set();
  for (const el of all) {
    if (skipTree(el) || !visible(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky') continue;
    if (el.matches('html, body, #root')) continue;
    const r = el.getBoundingClientRect();
    for (let p = el.parentElement, depth = 0; p && depth < 12 && p !== document.body; p = p.parentElement, depth++) {
      const pcs = getComputedStyle(p);
      if (p.matches(HSCROLL)) break; // trong thanh cuộn ngang có chủ đích
      const scrollY = /(auto|scroll)/.test(pcs.overflowY), scrollX = /(auto|scroll)/.test(pcs.overflowX) && !scrollY;
      if (isFrame(p) && p.getBoundingClientRect().width > 0) {
        const q = p.getBoundingClientRect();
        const dx = Math.max(q.left - r.left, r.right - q.right);
        const dy = scrollY ? 0 : Math.max(q.top - r.top, r.bottom - q.bottom);
        if ((dx > 1.5 || dy > 1.5) && !reported.has(p)) {
          reported.add(p);
          issues.push({ level: 'error', rule: 'tran-khoi-khung', detail: `${label(el)} lòi ${Math.round(Math.max(dx, dy))} px khỏi ${label(p)}` });
        }
      }
      if (scrollY || scrollX || pcs.position === 'absolute' || pcs.position === 'fixed') break;
    }
  }
  // 6b. Chữ nằm ngoài phần màn hình nhìn thấy (ví dụ số tiền bị đẩy lòi khỏi mép phải)
  for (const el of all) {
    if (skipTree(el) || el.closest('.scene') || !visible(el)) continue;
    if (![...el.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
    if (scrollParent(el)) continue;
    const r = box(el);
    if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1) issues.push({ level: 'error', rule: 'chu-ngoai-man-hinh', detail: `${label(el)} tại [${Math.round(r.left)}, ${Math.round(r.top)}, ${Math.round(r.right)}, ${Math.round(r.bottom)}] ngoài ${Math.round(W)}×${Math.round(H)}` });
  }
  // 6. Chữ bị cắt mà không có dấu ba chấm
  for (const el of document.querySelectorAll('h1, h2, h3, h4, p, strong, b, small, span, button, label, li, td, th')) {
    if (!visible(el) || el.children.length > 0 || skipTree(el)) continue;
    const cs = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'visible' && cs.textOverflow !== 'ellipsis') issues.push({ level: 'error', rule: 'chu-bi-cat', detail: label(el) });
  }
  // gộp lỗi trùng
  const seen = new Set();
  return issues.filter((i) => { const k = i.rule + i.detail; if (seen.has(k)) return false; seen.add(k); return true; });
}

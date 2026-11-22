// Giữ khung game bám đúng phần màn hình đang nhìn thấy.
// Safari trên iPhone bỏ qua user-scalable=no: trang vẫn có thể bị phóng to (chạm ô nhập, chụm tay, hoặc giữ mức phóng từ lần trước),
// khi đó khung "fixed; inset: 0" rộng hơn phần nhìn thấy và giao diện bị lệch, bị khuất. Ta đo visualViewport và đặt khung theo đó.
export function watchViewport() {
  const root = document.documentElement;
  const vv = window.visualViewport;
  const fit = () => {
    root.style.setProperty('--vx', `${vv?.offsetLeft ?? 0}px`);
    root.style.setProperty('--vy', `${vv?.offsetTop ?? 0}px`);
    root.style.setProperty('--vw', `${vv?.width ?? window.innerWidth}px`);
    root.style.setProperty('--vh', `${vv?.height ?? window.innerHeight}px`);
    root.classList.toggle('zoomed', (vv?.scale ?? 1) > 1.02);
  };
  fit();
  // Khung game không bao giờ được cuộn: scrollIntoView ở phần tử con có thể đẩy cả khung lệch lên, làm HUD trượt khỏi màn.
  document.addEventListener('scroll', (e) => {
    const t = e.target as (Element | Document);
    const el = t instanceof Document ? t.scrollingElement : t;
    if (el && (el === document.scrollingElement || el === document.body || (el instanceof HTMLElement && el.classList.contains('game'))) && (el.scrollTop !== 0 || el.scrollLeft !== 0)) { el.scrollTop = 0; el.scrollLeft = 0; }
  }, true);
  vv?.addEventListener('resize', fit);
  vv?.addEventListener('scroll', fit);
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  // Chặn chụm tay phóng to khi trang đang ở mức bình thường; nếu trang đã bị phóng to thì để yên cho người chơi chụm thu nhỏ lại.
  const normal = () => (vv?.scale ?? 1) <= 1.02;
  for (const type of ['gesturestart', 'gesturechange']) document.addEventListener(type, (e) => { if (normal()) e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1 && normal()) e.preventDefault(); }, { passive: false });
}

// 本文は初めからHTMLにあります。演出だけを追加するので、JSなしでも読めます。
const greeting = document.querySelector('[data-typewriter]');
const cursor = document.querySelector('.typing-cursor');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let typingTimer;
let cursorTimer;

function finishTyping() {
  clearTimeout(typingTimer);
  clearTimeout(cursorTimer);
  greeting?.classList.remove('is-typing');
  greeting?.removeAttribute('data-typed');
  cursor?.classList.remove('is-blinking');
}

if (greeting && !reducedMotion.matches) {
  // 日記からホームに戻るたびに再生しないよう、タブを開いている間は一度だけ。
  let alreadyPlayed = false;
  try {
    alreadyPlayed = sessionStorage.getItem('ten-greeting-played') === 'yes';
    sessionStorage.setItem('ten-greeting-played', 'yes');
  } catch (_) { /* 保存できないブラウザでも表示は続けます。 */ }
  if (!alreadyPlayed) {
    const letters = Array.from(greeting.textContent);
    let count = 0;
    greeting.classList.add('is-typing');
    greeting.dataset.typed = '';
    cursor?.classList.add('is-blinking');
    function typeNextLetter() {
      greeting.dataset.typed = letters.slice(0, ++count).join('');
      if (count < letters.length) {
        typingTimer = setTimeout(typeNextLetter, 85);
      } else {
        greeting.classList.remove('is-typing');
        greeting.removeAttribute('data-typed');
        cursorTimer = setTimeout(finishTyping, 1400);
      }
    }
    typingTimer = setTimeout(typeNextLetter, 100);
  }
}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) finishTyping();
});

// トップページのメニューだけ、現在読んでいるセクションに印を付けます。
if (document.body.dataset.page === 'home') {
  const links = [...document.querySelectorAll('.nav-items a[data-section]')];
  const sections = ['diary', 'now', 'works', 'links']
    .map(id => document.getElementById(id)).filter(Boolean);
  const nav = document.querySelector('.site-nav');
  let scheduled = false;
  function updateNavigation() {
    scheduled = false;
    const isTopBar = window.matchMedia('(max-width: 900px)').matches;
    const readingLine = isTopBar ? nav.getBoundingClientRect().bottom + 100 : 160;
    let current = 'top';
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= readingLine) current = section.id;
    }
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = 'links';
    for (const link of links) {
      const active = link.dataset.section === current;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  window.addEventListener('scroll', () => {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateNavigation); }
  }, { passive: true });
  window.addEventListener('resize', updateNavigation);
  window.addEventListener('pageshow', updateNavigation);
  updateNavigation();
}

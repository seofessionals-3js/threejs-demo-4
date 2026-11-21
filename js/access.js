// Access: the view options (reduce motion, larger labels, higher contrast), a Play button that scrolls the build
// for you, chapter jumps, keyboard shortcuts, and a spoken line for screen readers.
// A classic script with no dependencies; main.js reads SEQ.prefs, SEQ.playing and SEQ.jump every frame.
(function () {
  const SEQ = window.SEQ, KEY = 'steininger.view';
  const $ = (id) => document.getElementById(id);
  const mq = matchMedia('(prefers-reduced-motion: reduce)'), mc = matchMedia('(prefers-contrast: more)');
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { /* private window: defaults */ }
  // what the visitor chose wins; otherwise the system setting decides
  const P = SEQ.prefs = { calm: saved.calm ?? mq.matches, large: !!saved.large, contrast: saved.contrast ?? mc.matches };
  const boxes = { calm: $('optCalm'), large: $('optLarge'), contrast: $('optContrast') };
  const apply = () => {
    for (const k in boxes) { document.body.classList.toggle(k, !!P[k]); boxes[k].checked = !!P[k]; }
    if (SEQ.onPrefs) SEQ.onPrefs(P); // main.js re-measures the sheet, label sizes may have changed
  };
  for (const k in boxes) boxes[k].addEventListener('change', () => {
    P[k] = boxes[k].checked;
    try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* not stored, still applied */ }
    apply();
  });
  mq.addEventListener('change', () => { if (saved.calm == null) { P.calm = mq.matches; apply(); } });
  apply();

  // ---- chapters: where each part of the walk starts, in screen heights of scroll
  SEQ.CHAPTERS = [
    ['Das Blatt', 0], ['Spatenstich', 6.0], ['Rohbau am Hang', 7.3], ['Gerüsttreppe', 9.8], ['Unter den Stützen', 12.4],
    ['Obergeschoss', 16.6], ['Wohngeschoss', 20.6], ['Poolgeschoss', 26.5], ['Übergabe', 30.6], ['Zurück zum Blatt', 35.0],
  ];
  SEQ.jumpTo = (v) => { SEQ.setPlaying(false); SEQ.jump = true; scrollTo(0, Math.round(v * (SEQ.VH || innerHeight))); }; // SEQ.VH: one screen height of scroll (main.js)
  $('chapters').innerHTML = SEQ.CHAPTERS.map(([n], i) => `<li><button type="button" data-i="${i}"><kbd>${(i + 1) % 10}</kbd>${n}</button></li>`).join('');
  $('chapters').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) SEQ.jumpTo(SEQ.CHAPTERS[+b.dataset.i][1]); });

  // ---- play: the page scrolls itself at walking pace until you touch it
  const playBtn = $('playBtn');
  SEQ.speed = 0.3; // screen heights a second: the whole build in about two minutes
  SEQ.setPlaying = (on) => {
    SEQ.playing = !!on;
    playBtn.setAttribute('aria-pressed', SEQ.playing ? 'true' : 'false');
    playBtn.querySelector('span').textContent = SEQ.playing ? 'Pause' : 'Abspielen';
    document.body.classList.toggle('playing', SEQ.playing);
  };
  playBtn.addEventListener('click', () => {
    // from the last sheet, Play starts the build again
    if (!SEQ.playing && scrollY >= document.documentElement.scrollHeight - innerHeight - 2) { SEQ.jump = true; scrollTo(0, 0); }
    SEQ.setPlaying(!SEQ.playing);
  });
  const stop = () => { if (SEQ.playing) SEQ.setPlaying(false); };
  addEventListener('wheel', stop, { passive: true });
  addEventListener('touchmove', stop, { passive: true });

  // ---- the panel: a plain disclosure, closed by Escape or a click outside it
  const viewBtn = $('viewBtn'), panel = $('viewPanel');
  const open = (on) => {
    panel.hidden = !on; viewBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) boxes.calm.focus();
  };
  viewBtn.addEventListener('click', () => open(panel.hidden));
  addEventListener('pointerdown', (e) => { if (!panel.hidden && !panel.contains(e.target) && !viewBtn.contains(e.target)) open(false); });

  // ---- keys: P plays or pauses, 1 to 0 jump, Escape closes; scrolling keys stop the autoplay
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'Escape' && !panel.hidden) { open(false); viewBtn.focus(); return; }
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox';
    if (typing) return;
    if (e.key === 'p' || e.key === 'P') { playBtn.click(); e.preventDefault(); return; }
    if (/^[0-9]$/.test(e.key)) { const c = SEQ.CHAPTERS[(+e.key + 9) % 10]; if (c) SEQ.jumpTo(c[1]); return; } // 1 to 9, then 0 for the tenth
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) stop();
  });

  // ---- a spoken line: the week and what is being built, at most every two seconds
  const live = $('live');
  let said = '', due = 0, timer = 0;
  SEQ.say = (html) => {
    const text = html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, 'und').replace(/\s*\/\/\s*/g, ', ').replace(/\s+/g, ' ').trim();
    if (!text || text === said) return;
    said = text; clearTimeout(timer);
    timer = setTimeout(() => { live.textContent = said; due = performance.now() + 2000; }, Math.max(0, due - performance.now()));
  };
})();

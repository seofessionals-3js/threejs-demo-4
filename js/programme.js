// The programme: one list of weeks that the loader, the sheet, the schedule and the 3D site all read.
// A classic script, so the loader is on screen before three.js has arrived.
(function () {
  const WEEKS = 38;
  // [name, start, end] in weeks, continuous: 0 is the first morning on site, 38 is handover
  const PROG = [
    ['Aushub', 0, 3], ['Fundamente', 3, 6], ['Poolgeschoss', 6, 9], ['Wohndecke', 9, 11],
    ['Wände, Decken', 11, 16], ['Dächer', 16, 21], ['Glas, Travertin', 21, 25], ['Ausbau, Pool', 25, 38],
  ];
  // the six drawings of sheet A-901, each the house at the end of its weeks
  const TILES = [
    { n: '01', name: 'Aushub, Fundamente', w0: 0, w1: 6 },
    { n: '02', name: 'Poolgeschoss', w0: 6, w1: 9 },
    { n: '03', name: 'Wohndecke', w0: 9, w1: 11 },
    { n: '04', name: 'Wände, Decken', w0: 11, w1: 16 },
    { n: '05', name: 'Dächer', w0: 16, w1: 21 },
    { n: '06', name: 'Verglasung, Ausbau, Pool', w0: 21, w1: 38 },
  ];
  const pad = (n) => String(n).padStart(2, '0');
  const SEQ = window.SEQ = { WEEKS, PROG, TILES, pad, progress: 0, real: false };
  // one breakpoint for the page and the 3D: a narrow screen stacks the sheet and widens the lens
  SEQ.phone = () => innerWidth <= 700;

  // the programme block: rows, a now line, a foot line for the loader
  const prog = document.getElementById('prog');
  prog.innerHTML = '<div class="rows"><div class="rowsbg"></div>' + PROG.map(([n, a, b], i) =>
    `<div class="row"><span>${pad(i + 1)} ${n}</span><div class="trk"><i class="plan" style="left:${a / WEEKS * 100}%;width:${(b - a) / WEEKS * 100}%"><i class="done"></i></i></div></div>`).join('') +
    '<div class="now"><b>Wo. 00</b></div></div><div class="foot"><span>Projekt Steininger &nbsp;//&nbsp; Bauzeitenplan &nbsp;//&nbsp; 38 Wochen</span><span class="pct">000</span></div>';
  // the six tiles of the sheet
  document.getElementById('grid').innerHTML = TILES.map((t) =>
    `<figure class="tile"><div class="frame" data-num="${t.n}"></div><figcaption><span class="nm"><b>${t.n}</b>${t.name}</span><span class="wk">Wo. ${pad(t.w0 + 1)}–${pad(t.w1)}</span></figcaption></figure>`).join('');

  // place the programme in the middle of the screen, larger, until the page is ready
  SEQ.place = function (mode) {
    const phone = SEQ.phone();
    const large = document.body.classList.contains('large');
    prog.style.setProperty('--lab', phone ? (large ? '132px' : '112px') : (large ? '186px' : '150px'));
    const slot = document.getElementById('progSlot').getBoundingClientRect();
    prog.style.left = slot.left + 'px'; prog.style.top = slot.top + 6 + 'px'; prog.style.width = slot.width + 'px';
    if (mode === 'loader') {
      const k = Math.min(phone ? 1.0 : 1.32, (innerWidth - 32) / slot.width), w = slot.width * k, h = prog.offsetHeight * k;
      prog.style.transform = `translate(${(innerWidth - w) / 2 - slot.left}px, ${(innerHeight - h) / 2 - slot.top - 6}px) scale(${k})`;
    } else prog.style.transform = 'none';
  };
  SEQ.place('loader');

  // the loader: each row's planned bar draws in as the page gets ready
  const plans = prog.querySelectorAll('.plan'), pct = prog.querySelector('.pct');
  const t0 = performance.now();
  (function tick() {
    if (SEQ.docked) return;
    // until the page reports real progress, creep forward so the first bars draw while three.js downloads
    const shown = SEQ.real ? SEQ.progress : Math.min(0.3, (performance.now() - t0) / 4000);
    SEQ.shown = Math.max(SEQ.shown || 0, shown);
    plans.forEach((p, i) => p.classList.toggle('in', SEQ.shown >= (i + 0.5) / PROG.length));
    pct.textContent = String(Math.round(SEQ.shown * 100)).padStart(3, '0');
    requestAnimationFrame(tick);
  })();
})();

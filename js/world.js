// The world: one house as a list of parts, each carrying the week it is built, on a site that is dug,
// filled and planted by the same calendar. Everything that draws (the sheet) and everything that renders
// (the site) reads the weeks from here. A part shows when its week has come: one uniform, uNow, builds the house.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- level of detail
// One table for everything that costs triangles or texels. main.js picks the row from the device tier (js/quality.js)
// before anything is built: 'low' is a phone, 'mid' a tablet or a small laptop, 'high' a desktop.
const LEVELS = {
  low: { tex: 512, aniso: 2, bump: false, step: 0.4, far: 72, heap: 0.3, cyl: 0.6, lathe: 0.55, sph: 0.6, leaf: 0.42, leafS: 1.26, tree: 0.36, treeLow: true, rb: (r) => (r < 0.03 ? 1 : 2) },
  mid: { tex: 1024, aniso: 4, bump: true, step: 0.3, far: 120, heap: 0.2, cyl: 0.8, lathe: 0.75, sph: 0.8, leaf: 0.65, leafS: 1.12, tree: 0.6, treeLow: false, rb: (r) => (r < 0.03 ? 1 : r < 0.06 ? 2 : 3) },
  high: { tex: 1024, aniso: 8, bump: true, step: 0.2, far: 180, heap: 0.15, cyl: 1, lathe: 1, sph: 1, leaf: 1, leafS: 1, tree: 1, treeLow: false, rb: (r) => (r < 0.02 ? 2 : r < 0.05 ? 3 : 4) },
};
export const QL = Object.assign({}, LEVELS.high);
export const setLevel = (tier) => Object.assign(QL, LEVELS[tier] || LEVELS.high);
export const segs = (n, min = 6) => Math.max(min, Math.round(n * QL.cyl));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- the programme
export const { WEEKS, PROG, TILES } = window.SEQ;
const PHASE = { 1: [3, 6], 2: [6, 9], 3: [9, 11], 4: [11, 14.5], 5: [13.5, 16], 6: [16, 21], 7: [21, 25], 8: [25, 38] };
export const BACKFILL = 9.5; // the pit is filled against the lower level walls
export const BUILD = 0.36;   // weeks a new part spends as slices of itself before it is solid
// The fit-out was first scheduled for two floors (weeks 30 to 37.6). With the pool level furnished too, the upper and
// living levels are brought forward: FW maps a week of that first schedule to the week it happens now.
export const FW = (w) => (w <= 30 ? w : w <= 33.6 ? 30 + (w - 30) * (2.4 / 3.6) : w <= 34 ? 32.4 + (w - 33.6) * 0.75 : w <= 37.58 ? 32.7 + (w - 34) * (3.1 / 3.58) : w);
// the sliding door: the third of four panes in the living room glazing, and the aisle the camera walks in on
export const DOOR = { x: 15.6, z0: -4.725, z1: -3.2375, zc: -3.98125, w: 1.4875, h: 2.85, y: 0 };
// and its twin a floor below, from the pool level lounge out onto the terrace: the way the walk leaves the house
export const DOOR0 = { x: 18.24, z0: -4.65, z1: -3.125, zc: -3.8875, w: 1.525, h: 2.85, y: -3.2 };

// ---------------------------------------------------------------- random, noise
let seed = 11;
export const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

function vnoise(size, cells) {
  const L = new Float32Array(cells * cells); for (let i = 0; i < L.length; i++) L[i] = rnd();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const fy = y / size * cells, iy = Math.floor(fy); let ty = fy - iy; ty = ty * ty * (3 - 2 * ty);
    const y0 = (iy % cells) * cells, y1 = ((iy + 1) % cells) * cells;
    for (let x = 0; x < size; x++) {
      const fx = x / size * cells, ix = Math.floor(fx); let tx = fx - ix; tx = tx * tx * (3 - 2 * tx);
      const x0 = ix % cells, x1 = (ix + 1) % cells;
      const a = L[y0 + x0] + (L[y0 + x1] - L[y0 + x0]) * tx, b = L[y1 + x0] + (L[y1 + x1] - L[y1 + x0]) * tx;
      out[y * size + x] = a + (b - a) * ty;
    }
  }
  return out;
}
function fbm(size, cells, oct, gain = 0.5) {
  const out = new Float32Array(size * size); let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) { const n = vnoise(size, cells << o); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; tot += amp; amp *= gain; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}
function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise2(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z); let fx = x - ix, fz = z - iz; fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

// ---------------------------------------------------------------- textures & bump maps
let MAX_ANISO = 8;
function canvasTex(size, tile, draw, linear = false) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true }); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / tile, 1 / tile);
  t.colorSpace = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  return t;
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function ramp(g, s, field, c0, c1, c2, grain = 10) {
  const img = g.createImageData(s, s), d = img.data;
  for (let i = 0; i < s * s; i++) {
    const v = field(i);
    const c = v < 0.5 ? mixc(c0, c1, v * 2) : mixc(c1, c2, (v - 0.5) * 2);
    const k = (rnd() - 0.5) * grain;
    d[i * 4] = c[0] + k; d[i * 4 + 1] = c[1] + k; d[i * 4 + 2] = c[2] + k; d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
function stones(g, s, n, r0, r1, cols, shadow = 0.35) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * s, y = rnd() * s, r = r0 + Math.pow(rnd(), 2.5) * (r1 - r0), a = rnd() * Math.PI, e = 0.55 + rnd() * 0.4;
    const col = cols[Math.floor(rnd() * cols.length)];
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
      const X = x + dx, Y = y + dy; if (X < -r1 * 2 || X > s + r1 * 2 || Y < -r1 * 2 || Y > s + r1 * 2) continue;
      g.fillStyle = `rgba(30,22,15,${shadow})`; g.beginPath(); g.ellipse(X + r * 0.25, Y + r * 0.35, r, r * e, a, 0, 7); g.fill();
      g.fillStyle = col; g.beginPath(); g.ellipse(X, Y, r, r * e, a, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,250,240,0.18)'; g.beginPath(); g.ellipse(X - r * 0.25, Y - r * 0.3, r * 0.5, r * 0.5 * e, a, 0, 7); g.fill();
    }
  }
}

export function makeTextures(renderer) {
  MAX_ANISO = Math.min(QL.aniso, renderer.capabilities.getMaxAnisotropy());
  const S = QL.tex;
  const T = {};
  // site earth, compacted with aggregate and subtle track grooves
  T.soil = canvasTex(S, 3.0, (g, s) => {
    const a = fbm(s, 4, 5), b = fbm(s, 24, 3), c = fbm(s, 96, 2);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 1.5 + (b[i] - 0.5) * 0.75 + (c[i] - 0.5) * 0.55, 0, 1), [96, 76, 56], [138, 111, 85], [170, 144, 114], 15);
    stones(g, s, s * 2.6, s / 900, s / 170, ['#9d9384', '#b5ab9b', '#7f766a', '#c7bca8', '#685e52']);
  });
  T.soilBump = canvasTex(512, 3.0, (g, s) => {
    const a = fbm(s, 8, 4), b = fbm(s, 48, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 1.4 + (b[i] - 0.5) * 0.9, 0, 1), [40, 40, 40], [128, 128, 128], [220, 220, 220], 24);
  }, true);
  // cut subsoil clay: stratified warm earth
  T.clay = canvasTex(S, 2.8, (g, s) => {
    const a = fbm(s, 3, 5), b = fbm(s, 20, 3), c = fbm(s, 80, 2);
    ramp(g, s, (i) => {
      const y = Math.floor(i / s) / s;
      const strata = Math.sin(y * Math.PI * 16 + a[i] * 4) * 0.08;
      return clamp(0.5 + (a[i] - 0.5) * 1.3 + (b[i] - 0.5) * 0.85 + (c[i] - 0.5) * 0.5 + strata, 0, 1);
    }, [116, 90, 64], [150, 120, 88], [184, 156, 120], 12);
    stones(g, s, s * 1.1, s / 700, s / 130, ['#a8957c', '#8d7a63', '#c2ad8e'], 0.4);
  });
  // Mediterranean slope grass
  T.grass = canvasTex(S, 3.8, (g, s) => {
    const a = fbm(s, 4, 4), b = fbm(s, 28, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 1.35 + (b[i] - 0.5) * 0.75, 0, 1), [106, 130, 72], [134, 160, 94], [166, 186, 122], 10);
    const n = s * s / 60;
    for (let i = 0; i < n; i++) {
      const x = rnd() * s, y = rnd() * s, l = s / 320 + rnd() * s / 130, ang = -Math.PI / 2 + (rnd() - 0.5) * 1.1;
      g.strokeStyle = rnd() < 0.55 ? `rgba(72,92,46,${0.25 + rnd() * 0.3})` : `rgba(196,206,150,${0.2 + rnd() * 0.28})`;
      g.lineWidth = 0.6 + rnd() * 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l); g.stroke();
    }
  });
  // fair-faced architectural concrete, cast against 150 mm boards, tie holes on 600 mm grid + bump map
  T.conc = canvasTex(S, 2.4, (g, s) => {
    const a = fbm(s, 4, 4), b = fbm(s, 48, 2);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.65 + (b[i] - 0.5) * 0.4, 0, 1), [172, 168, 160], [189, 185, 176], [204, 200, 192], 8);
    const rows = 16, h = s / rows;
    for (let r = 0; r < rows; r++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '70,66,60' : '240,236,228'},${0.025 + rnd() * 0.045})`; g.fillRect(0, r * h, s, h);
      g.fillStyle = 'rgba(55,52,46,0.20)'; g.fillRect(0, r * h, s, 1.3);
      g.fillStyle = 'rgba(245,242,235,0.14)'; g.fillRect(0, r * h + 1.3, s, 1.0);
      for (let k = 0; k < 7; k++) { g.fillStyle = `rgba(60,56,50,${0.025 + rnd() * 0.035})`; g.fillRect(0, r * h + rnd() * h, s, 1); }
    }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const cx = (i + 0.5) * s / 4, cy = (j + 0.5) * s / 4;
      g.fillStyle = 'rgba(130,126,118,0.45)'; g.beginPath(); g.arc(cx, cy, s / 150, 0, 7); g.fill();
      g.fillStyle = 'rgba(42,39,35,0.65)'; g.beginPath(); g.arc(cx, cy, s / 240, 0, 7); g.fill();
    }
  });
  T.concBump = canvasTex(512, 2.4, (g, s) => {
    const a = fbm(s, 6, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.5, 0, 1), [110, 110, 110], [135, 135, 135], [160, 160, 160], 10);
    const rows = 16, h = s / rows;
    for (let r = 0; r < rows; r++) {
      g.fillStyle = '#404040'; g.fillRect(0, r * h, s, 1.5);
      g.fillStyle = '#b0b0b0'; g.fillRect(0, r * h + 1.5, s, 1.2);
      for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(80,80,80,0.35)'; g.fillRect(0, r * h + rnd() * h, s, 1); }
    }
    g.fillStyle = '#181818';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc((i + 0.5) * s / 4, (j + 0.5) * s / 4, s / 200, 0, 7); g.fill(); }
  }, true);

  // European wide-plank oak flooring: even warm honey tone, natural grain + bump map
  T.oak = canvasTex(S, 3.2, (g, s) => {
    const rows = 14, h = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * s * 0.4;
      while (x < s) {
        const L = s * (0.45 + rnd() * 0.45), v = (rnd() - 0.5) * 2;
        g.fillStyle = `hsl(${33 + v * 1.6}, ${38 + v * 3}%, ${50 + v * 3.2}%)`;
        g.fillRect(x, r * h, L, h);
        for (let k = 0; k < 14; k++) {
          const gy = r * h + (k + 0.5) / 14 * h;
          g.fillStyle = `rgba(95, 60, 28, ${0.03 + rnd() * 0.045})`;
          g.fillRect(x, gy, L, 1 + rnd() * 1.2);
        }
        g.fillStyle = 'rgba(65, 42, 20, 0.32)'; g.fillRect(x, r * h, 1.2, h);
        x += L;
      }
      g.fillStyle = 'rgba(65, 42, 20, 0.28)'; g.fillRect(0, r * h, s, 1.2);
      g.fillStyle = 'rgba(235, 210, 175, 0.12)'; g.fillRect(0, r * h + 1.2, s, 1.0);
    }
  });
  T.oakBump = canvasTex(512, 3.2, (g, s) => {
    g.fillStyle = '#888'; g.fillRect(0, 0, s, s);
    const rows = 14, h = s / rows;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < 12; k++) { g.fillStyle = 'rgba(60,60,60,0.35)'; g.fillRect(0, r * h + rnd() * h, s, 1); }
      g.fillStyle = '#222'; g.fillRect(0, r * h, s, 1.5);
    }
  }, true);

  // Honed Roman travertine stone
  T.travertine = canvasTex(512, 1.8, (g, s) => {
    const a = fbm(s, 6, 4), b = fbm(s, 32, 2);
    ramp(g, s, (i) => {
      const y = Math.floor(i / s) / s;
      const vein = Math.sin(y * Math.PI * 18 + a[i] * 5.5) * 0.14;
      return clamp(0.5 + (a[i] - 0.5) * 0.65 + (b[i] - 0.5) * 0.35 + vein, 0, 1);
    }, [208, 194, 166], [227, 213, 186], [241, 232, 210], 7);
    for (let i = 0; i < 180; i++) {
      g.fillStyle = `rgba(130, 114, 92, ${0.12 + rnd() * 0.18})`;
      g.fillRect(rnd() * s, rnd() * s, 3 + rnd() * 14, 1 + rnd() * 2);
    }
  });
  // Travertine cladding: vein-cut panels 1.2 x 0.6 m in a half bond, the stone of the concept renders
  T.clad = canvasTex(S, 2.4, (g, s) => {
    const a = fbm(s, 5, 4), b = fbm(s, 40, 2);
    ramp(g, s, (i) => {
      const y = Math.floor(i / s) / s;
      const vein = Math.sin(y * Math.PI * 44 + a[i] * 7.0) * 0.11;
      return clamp(0.5 + (a[i] - 0.5) * 0.5 + (b[i] - 0.5) * 0.3 + vein, 0, 1);
    }, [208, 194, 166], [227, 213, 186], [241, 232, 210], 6);
    for (let i = 0; i < s * 0.9; i++) {
      g.fillStyle = `rgba(128, 110, 86, ${0.10 + rnd() * 0.16})`;
      g.fillRect(rnd() * s, rnd() * s, 4 + rnd() * 22, 1 + rnd() * 1.6);
    }
    const rows = 4, h = s / rows, w = s / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c < 2; c++) {
        const x = c * w + (r % 2) * w / 2;
        g.fillStyle = `rgba(${rnd() < 0.5 ? '96,80,58' : '255,250,240'},${0.02 + rnd() * 0.05})`; g.fillRect(x, r * h, w, h);
        g.fillStyle = 'rgba(70,58,42,0.40)'; g.fillRect(x, r * h, 1.6, h);
      }
      g.fillStyle = 'rgba(70,58,42,0.40)'; g.fillRect(0, r * h, s, 1.6);
      g.fillStyle = 'rgba(255,250,240,0.16)'; g.fillRect(0, r * h + 1.6, s, 1);
    }
  });
  T.cladBump = canvasTex(512, 2.4, (g, s) => {
    const a = fbm(s, 8, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.4, 0, 1), [118, 118, 118], [136, 136, 136], [154, 154, 154], 8);
    for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(60,60,60,0.4)'; g.fillRect(rnd() * s, rnd() * s, 3 + rnd() * 14, 1); }
    const rows = 4, h = s / rows, w = s / 2;
    g.fillStyle = '#2a2a2a';
    for (let r = 0; r < rows; r++) {
      g.fillRect(0, r * h, s, 1.6);
      for (let c = -1; c < 2; c++) g.fillRect(c * w + (r % 2) * w / 2, r * h, 1.6, h);
    }
  }, true);
  // Architectural walnut veneer
  T.walnut = canvasTex(512, 1.6, (g, s) => {
    const a = fbm(s, 4, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.7, 0, 1), [96, 70, 46], [122, 90, 60], [146, 112, 78], 6);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(42, 24, 12, ${0.08 + rnd() * 0.12})`;
      g.fillRect(0, rnd() * s, s, 1 + rnd() * 2);
    }
  });
  // Woven bouclé / architectural linen textile
  T.linen = canvasTex(256, 0.45, (g, s) => {
    const a = fbm(s, 8, 2);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.35, 0, 1), [212, 203, 188], [224, 216, 202], [235, 228, 216], 12);
    for (let y = 0; y < s; y += 3) { g.fillStyle = 'rgba(120,108,92,0.08)'; g.fillRect(0, y, s, 1); }
    for (let x = 0; x < s; x += 3) { g.fillStyle = 'rgba(255,250,242,0.08)'; g.fillRect(x, 0, 1, s); }
  });
  T.linenBump = canvasTex(256, 0.45, (g, s) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) { g.fillStyle = y % 4 === 0 ? '#a8a8a8' : '#585858'; g.fillRect(0, y, s, 1); }
    for (let x = 0; x < s; x += 2) { g.fillStyle = x % 4 === 0 ? 'rgba(210,210,210,0.5)' : 'rgba(40,40,40,0.5)'; g.fillRect(x, 0, 1, s); }
  }, true);

  T.pave = canvasTex(512, 2.4, (g, s) => {
    const a = fbm(s, 6, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.85, 0, 1), [196, 186, 168], [214, 205, 189], [228, 221, 207], 8);
    g.fillStyle = 'rgba(85,74,58,0.38)';
    for (let r = 0; r < 4; r++) g.fillRect(0, r * s / 4, s, 1.5);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) g.fillRect(c * s / 2 + (r % 2) * s / 4, r * s / 4, 1.5, s / 4);
  });
  // Large architectural canvas painting
  T.canvas = (() => {
    const c = document.createElement('canvas'); c.width = 520; c.height = 700; const g = c.getContext('2d');
    g.fillStyle = '#ede6d8'; g.fillRect(0, 0, 520, 700);
    g.fillStyle = '#d43a2a'; g.fillRect(56, 310, 408, 330);
    g.fillStyle = '#e3b84a'; g.beginPath(); g.arc(300, 245, 148, 0, 7); g.fill();
    g.fillStyle = '#ede6d8'; g.beginPath(); g.arc(170, 310, 62, 0, Math.PI); g.fill();
    g.fillStyle = '#23211e'; g.fillRect(396, 68, 20, 572);
    g.strokeStyle = '#23211e'; g.lineWidth = 3; g.strokeRect(56, 68, 408, 572);
    g.globalAlpha = 0.14; for (let i = 0; i < 3000; i++) { g.fillStyle = rnd() < 0.5 ? '#000' : '#fff'; g.fillRect(rnd() * 520, rnd() * 700, 1, 1); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO; return t;
  })();
  T.rug = canvasTex(512, 1.1, (g, s) => {
    const a = fbm(s, 8, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.5, 0, 1), [196, 184, 164], [210, 199, 180], [222, 213, 196], 18);
    for (let y = 0; y < s; y += 3) { g.fillStyle = 'rgba(78,64,46,0.07)'; g.fillRect(0, y, s, 1.5); }
  });
  T.concFresh = canvasTex(512, 2.4, (g, s) => {
    const a = fbm(s, 4, 4), b = fbm(s, 40, 2);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.75 + (b[i] - 0.5) * 0.45, 0, 1), [176, 172, 164], [194, 190, 182], [208, 205, 198], 10);
    for (let y = 0; y < s; y += s / 8) { g.fillStyle = 'rgba(60,55,50,0.08)'; g.fillRect(0, y, s, 1); }
  });
  // Industrial heavy machinery finish: weathered ochre-yellow with panel seams & grime
  T.machine = canvasTex(512, 1.6, (g, s) => {
    const a = fbm(s, 6, 3);
    ramp(g, s, (i) => clamp(0.5 + (a[i] - 0.5) * 0.35, 0, 1), [214, 158, 24], [233, 178, 30], [243, 194, 48], 8);
    g.strokeStyle = 'rgba(40,32,18,0.28)'; g.lineWidth = 2;
    g.strokeRect(12, 12, s - 24, s - 24);
    g.beginPath(); g.moveTo(0, s * 0.5); g.lineTo(s, s * 0.5); g. moveTo(s * 0.5, 0); g.lineTo(s * 0.5, s); g.stroke();
  });
  // Fine high-density safety debris mesh (no giant LEGO holes)
  T.net = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#e8632a'; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
    for (let y = 10; y < 120; y += 8) {
      for (let x = (y % 16 === 10 ? 4 : 8); x < 128; x += 8) {
        g.beginPath(); g.rect(x - 2.2, y - 2.2, 4.4, 4.4); g.fill();
      }
    }
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#c9501c'; g.fillRect(0, 0, 128, 8); g.fillRect(0, 120, 128, 8);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO; return t;
  })();
  // Welded wire Heras fencing mesh
  T.wire = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
    g.clearRect(0, 0, 64, 128); g.fillStyle = '#c4c7c4';
    for (let x = 0; x < 64; x += 32) g.fillRect(x, 0, 2.5, 128);
    for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 64, 2.5);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = MAX_ANISO; return t;
  })();
  return T;
}

// ---------------------------------------------------------------- the land
export function natural(x, z) {
  let y = -3.2 * smooth(4.2, 18.5, x);        // the court at 0 down to the pool terrace at -3.20
  y += -1.5 * smooth(19.8, 25.5, x);           // the bank the pool stands on
  y += -2.5 * smooth(26, 46, x);               // on down to the olives
  y += -16 * smooth(46, 260, x);               // and the valley
  y += 22 * smooth(-30, -260, x);              // the hill behind the court
  y += 60 * smooth(420, 1300, x);              // the ridge across the valley
  y += 30 * smooth(300, 1400, -x) * (0.6 + 0.4 * Math.sin(z * 0.004));
  const far = smooth(34, 140, Math.hypot(x - 12, (z + 2) * 1.2));
  y += far * (2.6 * Math.sin(z * 0.021 + 1.3) + 1.6 * Math.sin(x * 0.017 + z * 0.011) + 0.8 * Math.sin(z * 0.07 - x * 0.03) + 1.2 * (noise2(x * 0.03, z * 0.03) - 0.5));
  return y;
}
const HEAP = [-6.5, 10.5, 3.6, 2.1];
export function heapH(x, z) {
  const d = Math.hypot((x - HEAP[0]) * 1.0, (z - HEAP[1]) * 1.25) / HEAP[2];
  if (d >= 1) return 0;
  const k = Math.cos(d * Math.PI / 2); return HEAP[3] * k * k * (1 + 0.12 * (noise2(x * 1.3, z * 1.3) - 0.5)) * Math.min(1, (1 - d) * 6);
}
export const PIT = { x0: 2.6, x1: 20.4, z0: -9.6, z1: 5.6, y: -4.3, k: 1.15 };
export function pitY(x, z) {
  const dx = Math.max(PIT.x0 - x, 0, x - PIT.x1), dz = Math.max(PIT.z0 - z, 0, z - PIT.z1);
  const y = PIT.y + Math.hypot(dx, dz) * PIT.k;
  const rz = Math.max(Math.abs(z) - 2.2, 0);
  const ramp = PIT.y + Math.max(0, x - PIT.x1) * 0.19 + Math.hypot(Math.max(PIT.x0 - x, 0), rz) * PIT.k + rz * (x > PIT.x1 ? PIT.k : 0);
  return Math.min(y, ramp);
}
// the scaffold stair: from the foot of the bank (x0) up to a landing (x1 to xl) at the edge of the balcony, on the door's axis
export const STAIR = { z: DOOR.zc, half: 0.52, x0: 26.4, x1: 20.2, xl: 19.22, y0: natural(26.4, DOOR.zc) };
const ruts = (x, z) => 0.03 * (noise2(x * 0.9, z * 0.9) - 0.5) + 0.018 * (noise2(x * 3.1, z * 3.1) - 0.5);

// ---------------------------------------------------------------- drawing materials (the sheet)
// The palette of the sheet: paper, black line, Neubau red (the accent) for what is new, a lighter red for light on dark; tints: red = Neubau, yellow = Aushub/Provisorium, grey = Bestand.
export const PAL = { paper: '#f5f4ef', ink: '#17191c', leaf: '#d43a2a', lime: '#ee5a48', deep: '#17191c', tint: '#f4cfc8', temp: '#f8e9a6', old: '#dddcd7' };
export const PAPER = new THREE.Color(PAL.paper);
export const INK = new THREE.Color(PAL.ink);
export const ACCENT = new THREE.Color(PAL.leaf);
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return new THREE.Vector3((n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255); };
export const U = {
  uNow: { value: 99 }, uFrom: { value: TILES.map((t) => t.w0) },
  uBlock: { value: new THREE.Vector4(-10, -20, 34, 14) },
  uPaper: { value: rgb(PAL.paper) },
  uInk: { value: rgb(PAL.ink) },
  uAccent: { value: rgb(PAL.leaf) }, uLime: { value: rgb(PAL.lime) }, uDeep: { value: rgb(PAL.deep) },
  // the fills of a drawing: what is new in its weeks, temporary works, earthworks, and what stood before
  uTintNew: { value: rgb(PAL.tint) }, uTintTemp: { value: rgb(PAL.temp) }, uTintEarth: { value: rgb(PAL.temp) }, uTintOld: { value: rgb(PAL.old) },
  real: { value: 6 }, fx: { value: 1 },
};
const DRAW_VS = `
  attribute float aWeek; attribute float aOut;
  varying float vWeek; varying float vOut; varying vec3 vW; varying vec3 vV;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.); vW = wp.xyz; vWeek = aWeek; vOut = aOut;
    vec4 mv = viewMatrix * wp; vV = mv.xyz; gl_Position = projectionMatrix * mv;
  }`;
const DRAW_HEAD = `
  uniform float uNow, uClip, uContour, uHatch, uWeight, uKind; uniform float uFrom[6]; uniform vec4 uBlock; uniform vec3 uPaper, uInk;
  varying float vWeek; varying float vOut; varying vec3 vW; varying vec3 vV;
  bool gone(){
    if (vWeek > uNow + 1e-4) return true;
    if (vOut > .5 && uNow >= vOut) return true;
    if (uClip > .5 && (vW.x < uBlock.x || vW.x > uBlock.z || vW.z < uBlock.y || vW.z > uBlock.w)) return true;
    return false;
  }`;
// The paper pass lays down paper, shade, contours and hatch, and the week in alpha. The line pass writes the normal,
// the line weight, and in alpha what the part is (o.kind: 0 land, 1 earthworks, 2 temporary works, 3 the building)
// together with the first drawing of the sheet that shows it. The display fills each drawing from that (js/pipe.js),
// so the passes themselves are the same for all six drawings and a cell can be shared between them.
function drawMat(kind, o = {}) {
  const uniforms = {
    uNow: U.uNow, uBlock: U.uBlock, uPaper: U.uPaper, uInk: U.uInk, uFrom: U.uFrom,
    uClip: { value: o.clip ? 1 : 0 }, uKind: { value: o.kind ?? 3 },
    uContour: { value: o.contour ? 1 : 0 }, uHatch: { value: o.hatch ? 1 : 0 }, uWeight: { value: o.weight ?? 1.0 },
  };
  const fs = kind === 'nd' ? `${DRAW_HEAD}
    void main(){
      if (gone()) discard;
      vec3 n = normalize(cross(dFdx(vV), dFdy(vV)));
      float ph = 0.; for (int i = 0; i < 6; i++) ph += step(uFrom[i] + 1e-3, vWeek);
      gl_FragColor = vec4(n.xy * .5 + .5, uWeight, (uKind * 8. + ph) / 31.);
    }` : `${DRAW_HEAD}
    float lines(float f, float wid){ float w = max(fwidth(f), 1e-5); float d = abs(fract(f + .5) - .5); return 1. - smoothstep(w * (wid - .5), w * (wid + .5), d); }
    void main(){
      if (gone()) discard;
      vec3 c = uPaper;
      if (uContour < .5 && uHatch < .5) {
        vec3 wn = normalize(cross(dFdx(vW), dFdy(vW)));
        float shade = clamp((wn.z * 0.5 - wn.x * 0.45) * 0.032, -0.02, 0.028);
        c -= shade;
      }
      if (uContour > .5) {
        float k = lines((vW.y - .25) / .5, .9) * .28 + lines((vW.y - .25) / 2.5, 1.45) * .34;
        c = mix(c, uInk, clamp(k, 0., .62));
      }
      if (uHatch > .5) c = mix(c, uInk, lines((vW.x + vW.y + vW.z) / 1.1, 1.0) * .45);
      gl_FragColor = vec4(c, clamp((vWeek + 2.) / 42., 0., 1.));
    }`;
  return new THREE.ShaderMaterial({ uniforms, vertexShader: DRAW_VS, fragmentShader: fs, side: THREE.DoubleSide });
}
export const DM = {
  paper: drawMat('paper'),
  nd: drawMat('nd', { weight: 1.0 }),
  ndFrame: drawMat('nd', { weight: 0.52 }),
  ndProp: drawMat('nd', { weight: 0.58, kind: 2 }),
  ndFurn: drawMat('nd', { weight: 0.34 }),
  land: drawMat('paper', { clip: true, contour: true }),
  ndLand: drawMat('nd', { clip: true, weight: 0.85, kind: 0 }),
  ndEarth: drawMat('nd', { clip: true, weight: 0.85, kind: 1 }),
  hatch: drawMat('paper', { hatch: true }),
};

// ---------------------------------------------------------------- real materials
let ENV = null;
// (a bump map costs three texture reads a pixel: a phone does without them)
const std = (o) => { if (!QL.bump) { delete o.bumpMap; delete o.bumpScale; } return new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.88, metalness: 0, envMap: ENV, envMapIntensity: 0.32 }, o)); };
// Every real material knows its week. A part does not pop in: for its first BUILD weeks it is made of slices of
// itself, thin at first with gaps you can see through, which widen until they meet. While it grows the part is
// washed in a touch of Neubau red and every slice carries a bright edge. U.fx at 0 (reduced motion) turns that off.
const WEEKLY = (s) => {
  s.uniforms.uNow = U.real; s.uniforms.uFx = U.fx;
  s.vertexShader = s.vertexShader.replace('void main() {', `uniform float uNow; attribute float aWeek; attribute float aOut; varying float vWk; varying float vOt; varying vec3 vBw;
void main() {
  vWk = aWeek; vOt = aOut; vBw = (modelMatrix * vec4(position, 1.)).xyz;`);
  s.fragmentShader = s.fragmentShader.replace('void main() {', `uniform float uNow, uFx; varying float vWk; varying float vOt; varying vec3 vBw;
void main() {
  if (vWk > uNow + 1e-4 || (vOt > .5 && uNow >= vOt)) discard;
  float bK = uFx > .5 ? clamp((uNow - vWk) / ${BUILD.toFixed(3)}, 0., 1.) : 1.;
  float bE = 0.;
  if (bK < 1.) {
    float bF = vBw.y * 10.5 + (vBw.x - vBw.z) * 1.9 + .12 * sin(vBw.x * 2.3 + vBw.z * 1.9 + uNow * 7.) + uNow * 2.6;
    float bL = abs(fract(bF) - .5) * 2.;
    float bN = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))); // a dither softens the edge of every slice
    float bS = bK * bK * (3. - 2. * bK);
    float bW = mix(.24, 1.16, bS * bS);              // the slices stay thin for most of the time, then close quickly
    if (bL + (bN - .5) * .3 > bW) discard;
    bE = smoothstep(bW - .4, bW, bL) * (1. - bS);
  }`).replace('#include <tonemapping_fragment>', `if (bK < 1.) gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(.93, .30, .22) * 1.2, (1. - bK) * .14 + bE * .7);
  #include <tonemapping_fragment>`);
};
export function weekly(m) { m.onBeforeCompile = WEEKLY; m.customProgramCacheKey = () => 'weekly'; return m; }
export const DEPTH_WEEKLY = weekly(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));

// Small flat coloured things (books, pots, cushions) share a material and carry their colour on the vertices,
// so a shelf of books in five colours is one draw call instead of five.
export const MATTE = { book0: 0x7a5a3c, book1: 0x6b6f73, book2: 0xe3d5ba, book3: 0x86a05e, book4: 0x17191c, terracotta: 0xb98c56, soilPot: 0x3b2f25 };
export const SOFT = { cushionA: 0x7a5a3c, cushionB: 0xe3d5ba, cushionC: 0xe9e8e1, sofaDark: 0x9b9d9f };

export function makeMaterials(T, env) {
  ENV = env;
  const R = {
    matte: std({ vertexColors: true, roughness: 0.7 }),
    soft: std({ vertexColors: true, bumpMap: T.linenBump, bumpScale: 0.005, roughness: 0.9 }),
    concFresh: std({ map: T.concFresh, bumpMap: T.concBump, bumpScale: 0.012, roughness: 0.82 }),
    conc: std({ map: T.conc, bumpMap: T.concBump, bumpScale: 0.015, roughness: 0.78 }),
    oak: std({ map: T.oak, bumpMap: T.oakBump, bumpScale: 0.008, roughness: 0.42, envMapIntensity: 0.52 }),
    floorL: std({ map: T.travertine, roughness: 0.5 }),
    plaster: std({ color: 0xece8de, roughness: 0.92 }),
    gravel: std({ color: 0xb3ab9c, roughness: 0.98 }),
    clad: std({ map: T.clad, bumpMap: T.cladBump, bumpScale: 0.012, roughness: 0.74, envMapIntensity: 0.3 }),
    soffit: std({ map: T.oak, color: 0xd6ad7c, bumpMap: T.oakBump, bumpScale: 0.006, roughness: 0.6, envMapIntensity: 0.3 }),
    water: std({ color: 0x7fb9c6, roughness: 0.05, metalness: 0.15, envMapIntensity: 1.7 }),
    cloth: std({ color: 0x6f8a52, bumpMap: T.linenBump, bumpScale: 0.002, roughness: 0.96, envMapIntensity: 0.08 }),
    lake: std({ color: 0x9fb8c2, roughness: 0.22, metalness: 0.1, envMapIntensity: 1.1 }),
    pave: std({ map: T.pave, bumpMap: T.concBump, bumpScale: 0.01, roughness: 0.8 }),
    sofa: std({ map: T.linen, bumpMap: T.linenBump, bumpScale: 0.006, roughness: 0.9, envMapIntensity: 0.18 }),
    rugM: std({ map: T.rug, bumpMap: T.linenBump, bumpScale: 0.012, roughness: 0.98, envMapIntensity: 0.1 }),
    travertine: std({ map: T.travertine, bumpMap: T.concBump, bumpScale: 0.006, roughness: 0.48, envMapIntensity: 0.4 }),
    brass: std({ color: 0xc29b61, metalness: 0.92, roughness: 0.26, envMapIntensity: 1.0 }),
    ceramic: std({ color: 0xefe9de, roughness: 0.28, envMapIntensity: 0.45 }),
    art: std({ map: T.canvas, roughness: 0.85, envMapIntensity: 0.12 }),
    sheer: std({ color: 0xf1ece0, roughness: 0.96, side: THREE.DoubleSide, envMapIntensity: 0.12 }),
    shade: std({ color: 0xfff5e0, emissive: 0xffc885, emissiveIntensity: 0, roughness: 0.5 }),
    ink: std({ color: 0x1f1e1c, roughness: 0.42, metalness: 0.2 }),
    steel: std({ color: 0x242422, metalness: 0.68, roughness: 0.38, envMapIntensity: 0.55 }),
    glass: new THREE.MeshBasicMaterial({ color: 0xc5dadf, envMap: env, combine: THREE.MixOperation, reflectivity: 0.26, transparent: true, opacity: 0.09, depthWrite: false }),
    walnut: std({ map: T.walnut, bumpMap: T.oakBump, bumpScale: 0.006, roughness: 0.48, envMapIntensity: 0.42 }),
    leather: std({ color: 0x7a5a3c, bumpMap: T.linenBump, bumpScale: 0.003, roughness: 0.46, envMapIntensity: 0.48 }),
    linen: std({ map: T.linen, bumpMap: T.linenBump, bumpScale: 0.005, roughness: 0.9 }),
    teak: std({ map: T.oak, color: 0xc29a72, roughness: 0.62 }),
    ply: std({ color: 0xc49866, bumpMap: T.oakBump, bumpScale: 0.005, roughness: 0.82 }),
    prop: std({ color: 0xe3b84a, roughness: 0.46, metalness: 0.35, envMapIntensity: 0.45 }),
    yellow: std({ map: T.machine, bumpMap: T.concBump, bumpScale: 0.004, roughness: 0.38, metalness: 0.22, envMapIntensity: 0.65 }),
    dark: std({ color: 0x383b3f, roughness: 0.46, metalness: 0.42, envMapIntensity: 0.65 }),
    rubber: std({ color: 0x2a2b2d, roughness: 0.65, metalness: 0.35, envMapIntensity: 0.45 }),
    chrome: std({ color: 0xe6e8ea, metalness: 0.98, roughness: 0.12, envMapIntensity: 1.2 }),
    cabGlass: new THREE.MeshBasicMaterial({ color: 0x9fbcc4, envMap: env, combine: THREE.MixOperation, reflectivity: 0.45, transparent: true, opacity: 0.34, depthWrite: false }),
    beacon: std({ color: 0xe8632a, emissive: 0xe8632a, emissiveIntensity: 0.6, roughness: 0.2 }),
    rebar: std({ color: 0x563826, roughness: 0.7, metalness: 0.38 }),
    cap: std({ color: 0xe8632a, roughness: 0.45 }),
    timber: std({ map: T.oak, color: 0xc8a276, roughness: 0.85 }),
    galv: std({ color: 0xc4c6c4, metalness: 0.62, roughness: 0.42, envMapIntensity: 0.45 }),
    wire: std({ map: T.wire, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.48 }),
    net: std({ map: T.net, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.65, envMapIntensity: 0.15 }),
    block: std({ map: T.conc, color: 0xb8b4ab, roughness: 0.9 }),
    blinding: std({ map: T.concFresh, color: 0x96938c, roughness: 0.92 }),
    cabin: std({ color: 0xe8e5de, roughness: 0.55 }),
    cabinTrim: std({ color: 0x2f363b, roughness: 0.55 }),
    leaf: std({ color: 0x86a05e, roughness: 0.85, flatShading: true }),
    leafDark: std({ color: 0x607a45, roughness: 0.85, flatShading: true }),
    olive: std({ color: 0x7d8c63, roughness: 0.85, flatShading: true }),
    bark: std({ color: 0x5a4f43, roughness: 0.96 }),
  };
  for (const k in R) weekly(R[k]);
  return R;
}

// ---------------------------------------------------------------- geometry helpers
export function stamp(geo, week, out = 0) {
  const p = geo.attributes.position, n = p.count, a = new Float32Array(n), o = new Float32Array(n);
  for (let i = 0; i < n; i++) { a[i] = typeof week === 'function' ? week(p.getX(i), p.getY(i), p.getZ(i)) : week; o[i] = typeof out === 'function' ? out(p.getX(i), p.getY(i), p.getZ(i)) : out; }
  geo.setAttribute('aWeek', new THREE.BufferAttribute(a, 1)); geo.setAttribute('aOut', new THREE.BufferAttribute(o, 1));
  return geo;
}
export function worldUV(g) {
  const p = g.attributes.position, n = g.attributes.normal, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ax >= ay && ax >= az) { uv[i * 2] = z; uv[i * 2 + 1] = y; } else if (ay >= az) { uv[i * 2] = x; uv[i * 2 + 1] = z; } else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
export const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));
// The weeks a whole mesh is there: from the first week any of its vertices arrives until the last of them has gone.
// The shaders still decide pixel by pixel; this only lets the renderer skip meshes that would discard everything.
export function tagWeeks(root) {
  const list = [];
  root.traverse((m) => {
    if (!m.isMesh) return;
    const a = m.geometry.attributes.aWeek, o = m.geometry.attributes.aOut;
    let w0 = -Infinity, w1 = Infinity;
    if (a) { w0 = Infinity; for (let i = 0; i < a.count; i++) if (a.array[i] < w0) w0 = a.array[i]; }
    if (o) { let all = true, mx = 0; for (let i = 0; i < o.count; i++) { const v = o.array[i]; if (v <= 0.5) { all = false; break; } if (v > mx) mx = v; } if (all) w1 = mx; }
    m.userData.w0 = w0; m.userData.w1 = w1; list.push(m);
  });
  return list;
}
export function addMesh(group, geo, sets, o = {}) {
  const m = new THREE.Mesh(geo, sets.main || sets.paper || sets.nd);
  m.userData.sets = sets; m.castShadow = o.shadow !== false && !!sets.main; m.receiveShadow = true;
  if (sets.main) m.customDepthMaterial = DEPTH_WEEKLY;
  if (o.glass) m.userData.glass = true;
  m.frustumCulled = o.cull ?? true;
  group.add(m); return m;
}

// ---------------------------------------------------------------- the house as a list of parts
// Projekt Steininger: three storeys of travertine frames stepping down a slope, glazed to the east.
// Levels: pool terrace -3.20, living 0.00, upper 3.20, roofs 6.80 and 7.60. The house runs x 3.7 (the court, uphill)
// to 20.4 (the nose of the cantilever), in two bays across the slope: A to the south (z -1.6 to 4), B to the north (z -8 to -1.6).
// Bay B carries the balcony at 0.00 and the tall box that hangs over it; a two storey hall with the stair sits at its back.
function houseParts() {
  const P = [];
  const box = (x0, y0, z0, x1, y1, z1, m, k = 'struct', ph = 2, wk = null) => P.push({ b: [x0, y0, z0, x1, y1, z1], m, k, ph, wk });
  const carve = (a0, a1, b0, b1, holes) => {
    const cuts = [...new Set([a0, a1, ...holes.flatMap((h) => [h[0], h[1]])].filter((v) => v >= a0 && v <= a1))].sort((p, q) => p - q);
    const out = [];
    for (let i = 0; i < cuts.length - 1; i++) {
      const p0 = cuts[i], p1 = cuts[i + 1], mid = (p0 + p1) / 2;
      const hs = holes.filter((h) => h[0] < mid && h[1] > mid).map((h) => [h[2], h[3]]).sort((p, q) => p[0] - q[0]);
      let y = b0;
      for (const [q0, q1] of hs) { if (q0 > y) out.push([p0, p1, y, q0]); y = Math.max(y, q1); }
      if (y < b1) out.push([p0, p1, y, b1]);
    }
    return out;
  };
  // a wall in the plane x = t ('x') or z = t ('z'); a hole is [a0, a1, y0, y1] and is glazed unless its fifth entry is 'open'
  const wall = (axis, t0, t1, a0, a1, b0, b1, holes, m, ph) => {
    for (const [p0, p1, q0, q1] of carve(a0, a1, b0, b1, holes)) axis === 'x' ? box(t0, q0, p0, t1, q1, p1, m, 'struct', ph) : box(p0, q0, t0, p1, q1, t1, m, 'struct', ph);
    for (const h of holes) {
      if (h[4] === 'open') continue;
      const tm = (t0 + t1) / 2, f = 0.04;
      const B = (ta, tb, aa, ab, ya, yb, mm, kk) => (axis === 'x' ? box(tm + ta, ya, aa, tm + tb, yb, ab, mm, kk, 7) : box(aa, ya, tm + ta, ab, yb, tm + tb, mm, kk, 7));
      B(-0.035, 0.035, h[0], h[1], h[2], h[2] + f, 'steel', 'frame'); B(-0.035, 0.035, h[0], h[1], h[3] - f, h[3], 'steel', 'frame');
      B(-0.035, 0.035, h[0], h[0] + f, h[2] + f, h[3] - f, 'steel', 'frame'); B(-0.035, 0.035, h[1] - f, h[1], h[2] + f, h[3] - f, 'steel', 'frame');
      if (h[1] - h[0] > 3) { const c = (h[0] + h[1]) / 2; B(-0.035, 0.035, c - 0.02, c + 0.02, h[2] + f, h[3] - f, 'steel', 'frame'); }
      B(-0.01, 0.01, h[0] + f, h[1] - f, h[2] + f, h[3] - f, 'glass', 'glass');
    }
  };
  // slim floor to ceiling glazing in n panes; pane `door` is left to the sliding leaf that stage.js hangs in it
  const glazing = (axis, t, a0, a1, y0, y1, n, door = -1) => {
    const step = (a1 - a0) / n;
    const B = (ta, tb, aa, ab, ya, yb, m, k) => (axis === 'x' ? box(t + ta, ya, aa, t + tb, yb, ab, m, k, 7) : box(aa, ya, t + ta, ab, yb, t + tb, m, k, 7));
    for (let i = 0; i < n; i++) if (i !== door) B(-0.015, 0.015, a0 + i * step + 0.02, a0 + (i + 1) * step - 0.02, y0 + 0.04, y1 - 0.04, 'glass', 'glass');
    for (let i = 0; i <= n; i++) { const a = a0 + i * step; B(-0.045, 0.045, Math.max(a0, a - 0.022), Math.min(a1, a + 0.022), y0, y1, 'steel', 'frame'); }
    B(-0.045, 0.045, a0, a1, y0, y0 + 0.045, 'steel', 'frame'); B(-0.045, 0.045, a0, a1, y1 - 0.045, y1, 'steel', 'frame');
  };
  // frameless glass balustrade, as in the concept: a slim steel shoe, the pane, a fine polished cap
  const rail = (axis, t, a0, a1, y, h = 1.05, wk = null) => {
    const B = (ta, tb, ya, yb, m, k) => (axis === 'x' ? box(t + ta, ya, a0, t + tb, yb, a1, m, k, 7, wk) : box(a0, ya, t + ta, a1, yb, t + tb, m, k, 7, wk));
    B(-0.025, 0.025, y, y + 0.05, 'steel', 'frame'); B(-0.01, 0.01, y + 0.05, y + h, 'glass', 'glass'); B(-0.013, 0.013, y + h, y + h + 0.012, 'galv', 'frame');
  };

  // what a face is made of: raw concrete first, then travertine outside, plaster and oak inside, timber under the overhangs
  const SL = { all: 'conc', top: 'floorL', bot: 'plaster' };                // lower level slab
  const SG = { all: 'conc', top: 'oak', bot: 'plaster' };                   // a floor inside
  const SP = { all: 'clad', top: 'pave', bot: 'plaster' };                  // a deck over a room
  const SO = { all: 'clad', top: 'pave', bot: 'soffit' };                   // a deck over open air
  const SI = { all: 'conc', top: 'oak', bot: 'soffit' };                    // a floor inside, over open air
  const WB = { all: 'clad', px: 'plaster' }, WN = { all: 'clad', pz: 'plaster' }, WS = { all: 'clad', nz: 'plaster' };

  // footings (non-overlapping corners)
  box(3.1, -4.3, -8.4, 4.6, -3.6, 4.4, 'conc', 'struct', 1);
  box(17.7, -4.3, -8.4, 18.9, -3.6, 4.4, 'conc', 'struct', 1);
  box(4.6, -4.3, -8.4, 17.7, -3.6, -7.4, 'conc', 'struct', 1);
  box(4.6, -4.3, 3.4, 17.7, -3.6, 4.4, 'conc', 'struct', 1);

  // ---- lower level, -3.20: the slab and the walls that hold the hill back
  box(4.0, -3.6, -7.7, 18.3, -3.2, 3.7, SL, 'struct', 2);
  wall('x', 3.7, 4.0, -8.0, 4.0, -3.6, 0, [], { all: 'conc', px: 'plaster' }, 2);
  wall('z', -8.0, -7.7, 4.0, 18.3, -3.6, -0.35, [], WN, 2);
  wall('z', 3.7, 4.0, 4.0, 18.0, -3.6, -0.35, [], WS, 2);

  // ---- living level, 0.00: the slab leaves a slot for the lower flight and runs out as the balcony over bay B
  box(4.0, -0.35, -7.7, 5.22, 0, -6.55, SG, 'struct', 3);
  box(4.0, -0.35, -1.75, 5.22, 0, 3.7, SG, 'struct', 3);
  box(5.22, -0.35, -7.7, 15.6, 0, 3.7, SG, 'struct', 3);
  box(15.6, -0.35, -1.6, 17.5, 0, 3.7, SG, 'struct', 3);
  box(17.5, -0.35, -1.6, 18.0, 0, 3.7, SP, 'struct', 3);
  box(15.6, -0.35, -7.7, 18.3, 0, -1.6, SP, 'struct', 3);
  box(18.3, -0.35, -8.0, 19.2, 0, -1.6, SO, 'struct', 3);
  // walls of the living level
  wall('x', 3.7, 4.0, -8.0, 4.0, 0, 3.2, [[0.6, 1.9, 0, 2.4, 'open'], [-7.3, -6.75, 0.3, 2.7]], WB, 4);
  wall('z', -8.0, -7.7, 4.0, 18.3, -0.35, 3.2, [], WN, 4);
  wall('z', 3.7, 4.0, 4.0, 18.0, -0.35, 3.2, [[12.4, 16.4, 0, 2.6]], WS, 4);
  wall('z', -1.75, -1.45, 15.6, 18.0, 0, 2.85, [], 'clad', 4);

  // ---- upper level, 3.20: open over the hall (x 4 to 7 in bay B), out over the balcony as the floor of the cantilever
  box(4.0, 2.85, -1.75, 16.2, 3.2, 3.7, SG, 'struct', 5);
  box(16.2, 2.85, -1.75, 18.0, 3.2, 3.7, SP, 'struct', 5);
  box(7.0, 2.85, -7.7, 15.6, 3.2, -1.75, SG, 'struct', 5);
  box(15.6, 2.85, -7.7, 17.4, 3.2, -1.75, SI, 'struct', 5);
  box(17.4, 2.85, -7.7, 18.3, 3.2, -1.75, SO, 'struct', 5);
  box(18.3, 2.85, -8.0, 20.4, 3.2, -1.45, SO, 'struct', 5);
  // walls of the upper level: bay B is the taller box
  wall('x', 3.7, 4.0, -8.0, -1.45, 3.2, 7.6, [[-4.75, -4.2, 3.6, 6.3]], WB, 5.5);
  wall('x', 3.7, 4.0, -1.45, 4.0, 3.2, 6.8, [[2.25, 2.8, 3.5, 5.9]], WB, 5.5);
  wall('z', -8.0, -7.7, 4.0, 17.4, 3.2, 7.2, [], WN, 5.5);
  wall('z', -8.0, -7.7, 17.4, 20.4, 3.2, 7.2, [], 'clad', 5.5);
  wall('z', 3.7, 4.0, 4.0, 16.6, 3.2, 6.4, [[9.0, 14.0, 4.0, 5.9]], WS, 5.5);
  wall('z', -1.75, -1.45, 4.0, 20.4, 3.2, 7.2, [[4.0, 15.4, 3.2, 5.9, 'open']], 'clad', 5.5);
  // the stone canopy over the door to the court
  box(2.75, 2.5, 0.3, 3.7, 2.68, 2.2, 'clad', 'struct', 5.5);

  // ---- roofs
  const RF = { all: 'clad', top: 'gravel', bot: 'plaster' };
  box(4.0, 6.4, -1.45, 16.6, 6.8, 4.0, RF, 'struct', 6);
  box(4.0, 7.2, -8.0, 17.4, 7.6, -1.45, RF, 'struct', 6);
  box(17.4, 7.2, -8.0, 20.4, 7.6, -1.45, { all: 'clad', top: 'gravel', bot: 'soffit' }, 'struct', 6);
  // deep edge beams close the frames of the two upper boxes
  box(16.1, 6.05, -1.45, 16.6, 6.4, 3.7, 'clad', 'struct', 6);
  box(20.1, 6.8, -7.7, 20.4, 7.2, -1.75, 'clad', 'struct', 6);

  // ---- glazing: dark slim frames, floor to ceiling
  glazing('x', DOOR0.x, -7.7, -1.6, -3.2, -0.35, 4, 2);
  glazing('x', 16.6, -1.6, 3.7, -3.2, -0.35, 4);
  glazing('z', -1.6, 16.6, 18.24, -3.2, -0.35, 1);
  glazing('x', DOOR.x, -7.7, -1.75, 0, 2.85, 4, 2);
  glazing('x', 17.5, -1.45, 3.7, 0, 2.85, 4);
  glazing('x', 16.2, -1.45, 3.7, 3.2, 6.05, 4);
  glazing('x', 17.4, -7.7, -1.75, 3.2, 7.2, 4);
  box(17.355, 5.9, -7.7, 17.445, 5.96, -1.75, 'steel', 'frame', 7);

  // ---- glass balustrades
  rail('x', 19.14, -8.0, DOOR.zc - 0.78, 0); rail('x', 19.14, DOOR.zc + 0.78, -1.6, 0);              // balcony, either side of the scaffold stair
  rail('x', 19.14, DOOR.zc - 0.78, DOOR.zc + 0.78, 0, 1.05, 30.1);                                    // its last pane, once the stair is struck
  rail('z', -7.96, 18.3, 19.1, 0); rail('z', -1.64, 18.0, 19.1, 0);
  rail('x', 20.33, -7.7, -1.75, 3.2);                                                                 // loggia of the cantilever
  rail('x', 17.94, -1.45, 3.96, 3.2); rail('z', 3.94, 16.6, 17.9, 3.2);                               // terrace on the roof of bay A's lower box
  rail('x', 7.05, -7.7, -1.75, 3.2); rail('z', -1.70, 5.24, 7.05, 3.2);                               // gallery over the hall
  rail('x', 5.26, -6.55, -1.75, 0, 1.0);                                                              // slot of the lower flight

  // ---- stairs: two straight flights stacked along the back wall of the hall, oak treads on a concrete carriage
  const n = 18, zs = -6.55, run = 4.8 / n, rise = 3.2 / n;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) * rise, z0 = zs + i * run, z1 = z0 + run;
    box(4.02, Math.max(0, t - 0.42), z0, 5.2, t, z1, { all: 'conc', top: 'oak' }, 'stair', 5);
    box(4.02, Math.max(-3.2, -3.2 + t - 0.42), z0, 5.2, -3.2 + t, z1, { all: 'conc', top: 'oak' }, 'stair', 5);
  }

  // ---- built-in joinery, each piece with the week it is fitted
  const F = (x0, y0, z0, x1, y1, z1, m, drawIt = true, wk = null) => P.push({ b: [x0, y0, z0, x1, y1, z1], m, k: drawIt ? 'furn' : 'furnReal', ph: 8, wk });
  // the timber door to the court
  F(3.8, 0, 0.6, 3.9, 2.4, 1.9, 'teak', true, 24.6);
  F(3.9, 0.95, 1.72, 3.93, 1.35, 1.75, 'brass', false, 24.7);

  // 1. Upper level: walnut and travertine library on the north wall of the studio (x 8.0 to 13.5, 0.53 deep), weeks 30.05 to 30.8
  const LX = 8.0, LZ = -7.7;
  const FL = (d0, y0, u0, d1, y1, u1, m, drawIt, wk) => F(LX + u0, y0, LZ + d0, LX + u1, y1, LZ + d1, m, drawIt, FW(wk));
  FL(0, 3.20, 0, 0.48, 3.26, 5.5, 'ink', false, 30.05);       // recessed shadow plinth
  FL(0, 3.26, 0, 0.50, 3.92, 5.5, 'walnut', true, 30.12);     // lower credenza cabinets
  FL(0, 3.92, 0, 0.53, 3.97, 5.5, 'travertine', true, 30.25); // honed travertine display ledge
  FL(0, 3.97, 0, 0.05, 5.86, 5.5, 'walnut', true, 30.35);     // thin walnut back panel
  FL(0, 5.82, 0, 0.42, 5.86, 5.5, 'walnut', true, 30.40);     // top cornice cap
  for (let u = 0.02; u <= 5.48; u += 1.08) FL(0.05, 3.97, u, 0.42, 5.82, u + 0.032, 'walnut', true, 30.45); // vertical bay dividers
  for (let s = 0; s < 4; s++) {
    const y = 3.97 + s * 0.45;
    if (s > 0) FL(0.05, y, 0, 0.41, y + 0.03, 5.5, 'walnut', true, 30.50 + s * 0.04);
    let u = 0.12;
    while (u < 5.32) {
      if (Math.abs((u - 0.02) % 1.08) < 0.06) { u += 0.08; continue; }
      const w = 0.035 + rnd() * 0.055, h = 0.20 + rnd() * 0.14;
      if (rnd() < 0.78) FL(0.08, y + 0.03, u, 0.36, y + 0.03 + h, u + w, 'book' + Math.floor(rnd() * 5), false, 30.66 + s * 0.03);
      u += w + 0.012 + (rnd() < 0.22 ? 0.16 : 0);
    }
  }
  // the bed in the cantilever, looking out through the loggia (week 31.6)
  F(14.0, 3.2, -7.7, 16.7, 4.25, -7.62, 'walnut', true, FW(31.60));
  F(14.25, 3.2, -7.62, 16.45, 3.46, -5.45, 'walnut', true, FW(31.63));
  F(14.3, 3.46, -7.6, 16.4, 3.68, -5.5, 'linen', true, FW(31.66));
  F(14.45, 3.68, -7.56, 15.25, 3.82, -7.12, 'linen', false, FW(31.69));
  F(15.45, 3.68, -7.56, 16.25, 3.82, -7.12, 'linen', false, FW(31.69));
  F(14.3, 3.68, -6.3, 16.4, 3.72, -5.5, 'sofaDark', false, FW(31.71));

  // 2. Living level: tall walnut kitchen run on the south wall (x 7.0 to 11.3, 0.68 deep), weeks 34.0 to 34.4
  const KX = 7.0, KZ = 3.7;
  const FK = (d0, y0, u0, d1, y1, u1, m, drawIt, wk) => F(KX + u0, y0, KZ - d1, KX + u1, y1, KZ - d0, m, drawIt, FW(wk));
  FK(0, 0, 0, 0.62, 0.08, 4.3, 'ink', false, 34.00);            // recessed plinth
  FK(0, 0.08, 0, 0.66, 2.68, 1.25, 'walnut', true, 34.05);      // tall fridge and pantry column
  FK(0.66, 0.75, 1.18, 0.69, 1.85, 1.21, 'brass', false, 34.12); // vertical brass pull
  FK(0, 0.08, 1.26, 0.66, 0.88, 2.15, 'walnut', true, 34.14);   // oven tower
  FK(0, 0.88, 1.26, 0.67, 1.52, 2.15, 'ink', true, 34.18);      // matte black oven and steam oven
  FK(0.67, 0.94, 1.32, 0.69, 1.46, 2.09, 'cabGlass', false, 34.20);
  FK(0, 1.52, 1.26, 0.66, 2.68, 2.15, 'walnut', true, 34.22);
  FK(0, 0.08, 2.16, 0.66, 0.88, 4.3, 'walnut', true, 34.26);    // lower cabinets
  FK(0, 0.88, 2.16, 0.69, 0.93, 4.3, 'travertine', true, 34.30); // travertine worktop
  FK(0, 0.93, 2.16, 0.06, 1.68, 4.3, 'travertine', false, 34.34); // travertine splashback
  FK(0.06, 1.38, 2.25, 0.34, 1.41, 4.2, 'walnut', false, 34.38); // open walnut shelf
  FK(0, 1.68, 2.16, 0.46, 2.68, 4.3, 'walnut', true, 34.40);    // upper wall cabinets
  FK(0, 2.68, 0, 0.68, 2.85, 4.3, 'plaster', false, 34.42);     // shadow-gap bulkhead to the soffit

  // 3. Waterfall travertine island in front of it (x 7.5 to 10.82, z 0.95 to 2.01), weeks 34.45 to 34.65
  const IX = 7.5 - 6.14, IZ = 0.95 + 4.68;
  const FI = (x0, y0, z0, x1, y1, z1, m, drawIt, wk) => F(x0 + IX, y0, z0 + IZ, x1 + IX, y1, z1 + IZ, m, drawIt, FW(wk));
  FI(6.22, 0, -4.58, 9.38, 0.08, -3.72, 'ink', false, 34.44);        // recessed plinth
  FI(6.2, 0.08, -4.62, 9.4, 0.88, -3.7, 'walnut', true, 34.48);      // fluted walnut core
  FI(6.14, 0, -4.68, 6.2, 0.94, -3.62, 'travertine', true, 34.52);   // left waterfall leg
  FI(9.4, 0, -4.68, 9.46, 0.94, -3.62, 'travertine', true, 34.54);   // right waterfall leg
  FI(6.14, 0.88, -4.68, 9.46, 0.94, -3.62, 'travertine', true, 34.58); // thick honed top with bar overhang
  FI(7.4, 0.94, -4.05, 8.1, 0.95, -3.75, 'ink', false, 34.62);       // induction hob

  // 4. Pool level (-3.20), the third floor of the walk and the last to be furnished (weeks 36.2 to 37.3)
  const Y0 = -3.2;
  // the media wall of the lounge, on the north wall: walnut panelling and the screen
  F(11.2, Y0, -7.7, 16.4, Y0 + 2.62, -7.62, 'walnut', true, 36.18);
  F(12.55, Y0 + 1.0, -7.62, 15.05, Y0 + 2.36, -7.575, 'ink', true, 36.32);
  // the sauna in the south-west corner: a timber box with a glass front, two benches and the stove inside
  const SA = [4.04, 1.05, 7.3, 3.66], SH = Y0 + 2.25;
  F(SA[0], Y0, SA[1], SA[2], Y0 + 0.06, SA[3], 'soffit', false, 36.80);
  F(SA[0], Y0 + 0.06, SA[1], SA[0] + 0.07, SH, SA[3], 'soffit', true, 36.84);
  F(SA[0], Y0 + 0.06, SA[3] - 0.07, SA[2], SH, SA[3], 'soffit', true, 36.86);
  F(SA[0], Y0 + 0.06, SA[1], SA[2] - 1.0, SH, SA[1] + 0.07, 'soffit', true, 36.88);
  F(SA[0], SH - 0.07, SA[1], SA[2], SH, SA[3], 'soffit', true, 36.92);
  F(SA[2] - 0.07, Y0 + 0.06, SA[1], SA[2], SH - 0.07, SA[1] + 0.07, 'ink', true, 36.94);          // corner post of the glass
  F(SA[2] - 1.0, Y0 + 0.06, SA[1] + 0.02, SA[2] - 0.07, SH - 0.07, SA[1] + 0.045, 'cabGlass', false, 36.97); // glass door to the room
  F(SA[2] - 0.05, Y0 + 0.06, SA[1] + 0.07, SA[2] - 0.025, SH - 0.07, SA[3] - 0.07, 'cabGlass', false, 36.98); // glass front to the pool
  F(SA[0] + 0.07, Y0 + 0.44, SA[3] - 0.72, SA[2] - 0.6, Y0 + 0.5, SA[3] - 0.07, 'soffit', false, 37.00);
  F(SA[0] + 0.07, Y0 + 0.9, SA[3] - 0.46, SA[2] - 0.6, Y0 + 0.96, SA[3] - 0.07, 'soffit', false, 37.02);
  F(SA[0] + 0.2, Y0 + 0.06, SA[1] + 0.22, SA[0] + 0.72, Y0 + 0.72, SA[1] + 0.74, 'ink', false, 37.03);
  F(SA[0] + 0.24, Y0 + 0.72, SA[1] + 0.26, SA[0] + 0.68, Y0 + 0.8, SA[1] + 0.7, 'travertine', false, 37.04);
  // the billiard table in bay A: walnut body on four legs, a green cloth inside the rails
  const BX = 12.4, BZ = 1.05, BH = Y0 + 0.8;
  for (const sx of [-1.2, 1.2]) for (const sz of [-0.58, 0.58]) F(BX + sx - 0.08, Y0, BZ + sz - 0.08, BX + sx + 0.08, Y0 + 0.6, BZ + sz + 0.08, 'walnut', false, 37.08);
  F(BX - 1.42, Y0 + 0.6, BZ - 0.785, BX + 1.42, BH, BZ + 0.785, 'walnut', true, 37.12);
  F(BX - 1.42, BH, BZ - 0.785, BX + 1.42, BH + 0.05, BZ - 0.635, 'walnut', false, 37.16);
  F(BX - 1.42, BH, BZ + 0.635, BX + 1.42, BH + 0.05, BZ + 0.785, 'walnut', false, 37.16);
  F(BX - 1.42, BH, BZ - 0.635, BX - 1.27, BH + 0.05, BZ + 0.635, 'walnut', false, 37.16);
  F(BX + 1.27, BH, BZ - 0.635, BX + 1.42, BH + 0.05, BZ + 0.635, 'walnut', false, 37.16);
  F(BX - 1.27, BH, BZ - 0.635, BX + 1.27, BH + 0.012, BZ + 0.635, 'cloth', false, 37.20);

  // ---- outside: the court, the pool terrace on its plinth, and the pool standing on the bank
  box(-7, -0.05, -6.5, 3.7, 0.03, 3.5, 'pave', 'land', 8);
  box(18.3, -4.5, -8.0, 21.3, -3.16, 4.0, { all: 'clad', top: 'pave' }, 'land', 8, 32.0);
  box(21.3, -4.7, -8.0, 21.9, -3.34, 4.0, { all: 'clad', top: 'pave' }, 'land', 8, 32.3);     // the long step down to the water
  box(21.9, -5.4, -8.0, 28.5, -3.34, -7.6, { all: 'clad', top: 'pave' }, 'land', 8, 32.6);    // pool walls
  box(21.9, -5.4, 3.6, 28.5, -3.34, 4.0, { all: 'clad', top: 'pave' }, 'land', 8, 32.6);
  box(28.2, -6.0, -7.6, 28.5, -3.47, 3.6, 'clad', 'land', 8, 33.4);                          // the infinity edge
  box(21.9, -5.0, -7.6, 28.2, -3.45, 3.6, 'water', 'land', 8, 34.6);                         // the water
  return P;
}

function partWeeks(p) {
  const cx = (p.b[0] + p.b[3]) / 2, u = clamp((cx - 3) / 20, 0, 1);
  const ext = [p.b[3] - p.b[0], p.b[4] - p.b[1], p.b[5] - p.b[2]];
  const ax = ext[1] > ext[0] && ext[1] > ext[2] ? 1 : ext[0] >= ext[2] ? 0 : 2;
  if (p.k === 'furn' || p.k === 'furnReal') {
    const w0 = p.wk ?? (31.5 + 4.8 * clamp(u * 0.7 + rnd() * 0.3, 0, 1)), w1 = w0 + 0.015;
    const lo = p.b[1], hi = Math.max(lo + 1e-6, p.b[4]);
    return (x, y) => w0 + (w1 - w0) * clamp((y - lo) / (hi - lo), 0, 1);
  }
  if (p.k === 'land') {
    const w0 = p.wk ?? (32.0 + 1.8 * u), w1 = w0 + 0.8, lo = p.b[ax], hi = Math.max(lo + 1e-6, p.b[ax + 3]);
    return (x, y, z) => w0 + (w1 - w0) * clamp(([x, y, z][ax] - lo) / (hi - lo), 0, 1);
  }
  if (p.k === 'stair') {
    return (x, y) => 13.85 + 1.95 * clamp((y - (-3.6)) / 6.8, 0, 1);
  }
  if (p.wk != null) { // a part that has to wait for something else on site carries its own week
    const lo = p.b[1], hi = Math.max(lo + 1e-6, p.b[4]);
    return (x, y) => p.wk + 0.12 * clamp((y - lo) / (hi - lo), 0, 1);
  }
  // Unified world-space affine wavefronts per structural phase so carved wall segments, slabs, and footings
  // share the exact same week value across every seam and build in one continuous, unbroken motion.
  if (p.ph === 1) {
    return (x, y) => 3.10 + 2.45 * clamp((x - 3.1) / 15.8, 0, 1) + 0.15 * clamp((y - (-4.3)) / 0.7, 0, 1);
  }
  if (p.ph === 2) {
    const isSlab = p.b[4] <= -3.15;
    if (isSlab) return (x, y) => 6.02 + 0.68 * clamp((x - 4.0) / 14.3, 0, 1) + 0.08 * clamp((y - (-3.6)) / 0.4, 0, 1);
    return (x, y) => 6.55 + 2.00 * clamp((x - 3.7) / 14.6, 0, 1) + 0.22 * clamp((y - (-3.6)) / 3.6, 0, 1);
  }
  if (p.ph === 3) { // the living level slab and the balcony
    return (x, y) => 9.08 + 1.58 * clamp((x - 4.0) / 15.2, 0, 1) + 0.10 * clamp((y - (-0.35)) / 0.35, 0, 1);
  }
  if (p.ph === 4) { // walls of the living level
    return (x, y) => 11.05 + 2.20 * clamp((x - 3.7) / 14.6, 0, 1) + 0.30 * clamp((y - (-0.35)) / 3.55, 0, 1);
  }
  if (p.ph === 5) { // the upper slab, out to the nose of the cantilever
    return (x, y) => 13.45 + 1.00 * clamp((x - 4.0) / 16.4, 0, 1) + 0.10 * clamp((y - 2.85) / 0.35, 0, 1);
  }
  if (p.ph === 5.5) { // walls of the upper level: complete before week 16, so drawing 04 shows them whole
    return (x, y) => 14.55 + 1.05 * clamp((x - 3.7) / 16.7, 0, 1) + 0.25 * clamp((y - 3.2) / 4.4, 0, 1);
  }
  if (p.ph === 6) {
    return (x, y) => 16.68 + 1.05 * clamp((x - 4.0) / 16.4, 0, 1) + 0.18 * clamp((y - 6.05) / 1.55, 0, 1);
  }
  if (p.ph === 7) {
    return (x, y) => 21.10 + 3.20 * clamp((x - 3.7) / 18.8, 0, 1) + 0.35 * clamp((y - (-3.2)) / 10.8, 0, 1);
  }
  const [a, b] = PHASE[p.ph], span = b - a;
  const w0 = a + span * 0.68 * u, w1 = w0 + span * 0.3, lo = p.b[ax], hi = Math.max(lo + 1e-6, p.b[ax + 3]);
  return (x, y, z) => w0 + (w1 - w0) * clamp(([x, y, z][ax] - lo) / (hi - lo), 0, 1);
}
// finishes arrive after the structure, each as its own wave from the court to the pool: [first week, weeks across the house]
const FINISH = { clad: [22.3, 2.5], soffit: [24.4, 1.4], plaster: [25.2, 2.2], gravel: [21.3, 1.2], floorL: [26.5, 2.0], oak: [27.8, 2.6], pave: [31.6, 1.4] };
const finishWeek = (k, x) => FINISH[k][0] + FINISH[k][1] * clamp((x - 3) / 20, 0, 1);

// a face takes its material from the part: by direction (px, nx, pz, nz), else top / bot, else all
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], s: 'all', d: 'px' },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], s: 'all', d: 'nx' },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 'top', d: 'top' },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 'bot', d: 'bot' },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], s: 'all', d: 'pz' },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], s: 'all', d: 'nz' },
];
function bucketsOf(parts, keyOf, finishes = false) {
  const B = {}, tint = new THREE.Color();
  const emit = (key, p, f, wk, out, nOff = 0, hex = null) => {
    const b = B[key] || (B[key] = { pos: [], nor: [], uv: [], wk: [], out: [], idx: [], col: [] });
    const base = b.pos.length / 3;
    if (hex != null) { tint.setHex(hex); for (let i = 0; i < 4; i++) b.col.push(tint.r, tint.g, tint.b); }
    for (const c of f.c) {
      const x = p.b[c[0] * 3] + f.n[0] * nOff;
      const y = p.b[1 + c[1] * 3] + f.n[1] * nOff;
      const z = p.b[2 + c[2] * 3] + f.n[2] * nOff;
      b.pos.push(x, y, z); b.nor.push(...f.n);
      if (f.n[0]) b.uv.push(z, y); else if (f.n[1]) b.uv.push(x, z); else b.uv.push(x, y);
      b.wk.push(wk(x, y, z)); b.out.push(out(x, y, z));
    }
    b.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  for (const p of parts) {
    const spec = typeof p.m === 'string' ? { all: p.m } : p.m;
    const wk = p.weeks;
    for (const f of FACES) {
      const k0 = spec[f.d] || spec[f.s] || spec.all, key = keyOf(k0, p); if (!key) continue;
      if (finishes && FINISH[k0] && (p.k === 'struct' || p.k === 'stair')) {
        emit(key, p, f, wk, (x) => finishWeek(k0, x) + BUILD + 0.02, 0); // the raw face stays until the finish has closed up over it
        emit(k0, p, f, (x) => finishWeek(k0, x), () => 0, 0.0025);
      } else emit(key, p, f, wk, () => p.out || 0, 0, key === 'matte' || key === 'soft' ? MATTE[k0] ?? SOFT[k0] : null);
    }
  }
  const out = {};
  for (const k in B) {
    const b = B[k], g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setAttribute('aWeek', new THREE.Float32BufferAttribute(b.wk, 1));
    g.setAttribute('aOut', new THREE.Float32BufferAttribute(b.out, 1)); g.setIndex(b.idx);
    if (b.col.length) g.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    out[k] = g;
  }
  return out;
}

// ---------------------------------------------------------------- temporary works: telescopic steel props & H20 formwork
// Z-coordinates of prop lines leave a 3.7 m clear aisle around the door at z = -3.98 so the camera never collides with a post
const PROP_ZS = [-7.15, -5.75, -2.05, -0.65, 0.75, 2.15, 3.3];

function propsGeo(x0, x1, z0, z1, yb, yt, wIn, out, stepX = 1.35) {
  const list = [], ply = [];
  const hTot = yt - yb - 0.22;
  const collarH = Math.min(1.65, hTot * 0.52);
  const zs = PROP_ZS.filter((z) => z >= z0 + 0.3 && z <= z1 - 0.3);

  for (let x = x0 + 0.45; x <= x1 - 0.35; x += stepX) {
    for (const z of zs) {
      // Base plate on floor slab
      const bp = new THREE.BoxGeometry(0.16, 0.014, 0.16); bp.translate(x, yb + 0.007, z); list.push(bp);
      // Outer lower telescopic tube
      const c1 = new THREE.CylinderGeometry(0.034, 0.034, collarH, segs(8, 5), 1, true); c1.translate(x, yb + 0.014 + collarH / 2, z); list.push(c1);
      // Threaded collar nut & pin
      const col = new THREE.CylinderGeometry(0.048, 0.048, 0.09, segs(8, 5)); col.translate(x, yb + 0.014 + collarH, z); list.push(col);
      // Inner upper telescopic tube reaching up to U-head
      const remH = Math.max(0.1, hTot - collarH - 0.014);
      const c2 = new THREE.CylinderGeometry(0.027, 0.027, remH, segs(8, 5), 1, true); c2.translate(x, yb + 0.014 + collarH + remH / 2, z); list.push(c2);
      // U-head fork plate cradling the H20 beam
      const uh = new THREE.BoxGeometry(0.16, 0.016, 0.14); uh.translate(x, yt - 0.228, z); list.push(uh);
    }
    // Primary H20 timber girder spanning continuously across Z right up to the plywood soffit
    const bm = new THREE.BoxGeometry(0.09, 0.20, z1 - z0 - 0.2);
    bm.translate(x, yt - 0.12, (z0 + z1) / 2);
    list.push(bm);
  }
  // Plywood formwork deck directly contacting underside of concrete slab (yt - 0.02 to yt)
  const p = new THREE.BoxGeometry(x1 - x0, 0.02, z1 - z0);
  p.translate((x0 + x1) / 2, yt - 0.01, (z0 + z1) / 2);
  worldUV(p); ply.push(p);

  const wk = (x, y) => wIn[0] + (wIn[1] - wIn[0]) * (0.75 * clamp((x - x0) / (x1 - x0), 0, 1) + 0.25 * clamp((y - yb) / (yt - yb), 0, 1));
  const outw = (x) => out + 0.9 * clamp((x - x0) / (x1 - x0), 0, 1);
  const g = merge(list); worldUV(g); stamp(g, wk, outw);
  const pg = merge(ply); stamp(pg, wk, outw);
  return { posts: g, deck: pg };
}

// Tower crane: lattice mast, triangular jib, counter-jib with ballast blocks, operator cab, and hook block
function craneGeo(h, L, Lc) {
  const Y = [], D = [], G = [];
  const bar = (list, a, b, r) => { const d = b.clone().sub(a), len = d.length(); const g = new THREE.BoxGeometry(r, len, r); g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z); list.push(g); };
  const s = 0.8;
  for (const [cx, cz] of [[-s, -s], [s, -s], [s, s], [-s, s]]) bar(Y, V(cx, 0, cz), V(cx, h, cz), 0.12);
  for (let y = 0; y < h - 0.1; y += 1.6) {
    const c = [V(-s, y, -s), V(s, y, -s), V(s, y, s), V(-s, y, s)];
    for (let i = 0; i < 4; i++) { bar(Y, c[i], c[(i + 1) % 4], 0.06); bar(Y, c[i], c[(i + 1) % 4].clone().add(V(0, 1.6, 0)), 0.045); }
  }
  const tt = new THREE.BoxGeometry(2.2, 0.7, 2.2); tt.translate(0, h + 0.35, 0); Y.push(tt);
  const cab = new THREE.BoxGeometry(1.7, 1.9, 1.5); cab.translate(1.5, h - 0.4, 1.3); Y.push(cab);
  const win = new THREE.BoxGeometry(0.05, 1.1, 1.3); win.translate(2.36, h - 0.2, 1.3); G.push(win);
  const jy = h + 0.7, th = 1.4;
  for (const z of [-0.55, 0.55]) bar(Y, V(0.9, jy, z), V(L, jy, z), 0.1);
  bar(Y, V(0.9, jy + th, 0), V(L - 1, jy + 0.25, 0), 0.09);
  for (let u = 0.9; u < L - 1.6; u += 1.8) {
    const t1 = th * (1 - (u - 0.9) / (L - 0.9)) + 0.25 * (u - 0.9) / (L - 0.9), u2 = u + 1.8, t2 = th * (1 - (u2 - 0.9) / (L - 0.9)) + 0.25 * (u2 - 0.9) / (L - 0.9);
    bar(Y, V(u, jy, -0.55), V(u, jy, 0.55), 0.05);
    bar(Y, V(u, jy, -0.55), V(u2, jy + t2, 0), 0.045); bar(Y, V(u, jy, 0.55), V(u2, jy + t2, 0), 0.045);
    bar(Y, V(u, jy + t1, 0), V(u2, jy, -0.55), 0.045); bar(Y, V(u, jy + t1, 0), V(u2, jy, 0.55), 0.045);
  }
  for (const z of [-0.55, 0.55]) bar(Y, V(-0.9, jy, z), V(-Lc, jy, z), 0.12);
  for (let u = -0.9; u > -Lc; u -= 1.5) bar(Y, V(u, jy, -0.55), V(u, jy, 0.55), 0.06);
  const blk = new THREE.BoxGeometry(2.6, 1.6, 1.6); blk.translate(-Lc + 1.6, jy - 0.5, 0); G.push(blk);
  bar(Y, V(-0.7, jy, -0.6), V(0, jy + 5, 0), 0.14); bar(Y, V(-0.7, jy, 0.6), V(0, jy + 5, 0), 0.14);
  bar(Y, V(0.7, jy, -0.6), V(0, jy + 5, 0), 0.14); bar(Y, V(0.7, jy, 0.6), V(0, jy + 5, 0), 0.14);
  bar(D, V(0, jy + 5, 0), V(L * 0.62, jy + th * 0.4, 0), 0.04); bar(D, V(0, jy + 5, 0), V(-Lc + 0.5, jy + 0.1, 0), 0.04);
  const tx = L * 0.42;
  const tr = new THREE.BoxGeometry(1.0, 0.3, 1.0); tr.translate(tx, jy - 0.2, 0); D.push(tr);
  bar(D, V(tx - 0.12, jy - 0.3, 0), V(tx - 0.12, jy - 9.5, 0), 0.025); bar(D, V(tx + 0.12, jy - 0.3, 0), V(tx + 0.12, jy - 9.5, 0), 0.025);
  const hk = new THREE.BoxGeometry(0.5, 0.7, 0.3); hk.translate(tx, jy - 9.8, 0); Y.push(hk);
  const pad = new THREE.BoxGeometry(5, 1.0, 5); pad.translate(0, -0.5, 0); G.push(pad);
  return { yellow: merge(Y), dark: merge(D), grey: merge(G), glass: win };
}

// High-detail 22-tonne Tracked Hydraulic Excavator (Volvo EC220 / CAT 320 architectural grade)
function excavatorGeo(pose) {
  const K = { yellow: [], dark: [], rubber: [], chrome: [], cabGlass: [], beacon: [] };
  const box = (k, w, h, d, x, y, z, rz = 0, ry = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    worldUV(g);
    K[k].push(g);
    return g;
  };
  const cylZ = (k, r, len, x, y, z, seg = 20) => {
    const g = new THREE.CylinderGeometry(r, r, len, segs(seg, 8));
    g.rotateX(Math.PI / 2); g.translate(x, y, z); K[k].push(g);
  };
  const cylY = (k, r0, r1, len, x, y, z, seg = 20) => {
    const g = new THREE.CylinderGeometry(r0, r1, len, segs(seg, 8));
    g.translate(x, y + len / 2, z); K[k].push(g);
  };
  const seg = (k, a, b, w, h0, h1 = h0, x0 = 0, x1 = 0) => {
    const d = b.clone().sub(a), len = d.length(), ang = Math.atan2(d.y, d.x);
    const L = len + x0 + x1;
    const g = new THREE.BoxGeometry(L, 1, w);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = (p.getX(i) + L / 2) / L;
      const h = h0 + (h1 - h0) * u;
      p.setY(i, p.getY(i) * h);
    }
    g.computeVertexNormals();
    g.translate((len + x1 - x0) / 2, 0, 0);
    g.rotateZ(ang);
    g.translate(a.x, a.y, a.z);
    worldUV(g);
    K[k].push(g);
  };
  const rod = (k, a, b, r, sg = 12) => {
    const d = b.clone().sub(a), len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, segs(sg, 5));
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
    g.translate(a.x, a.y, a.z);
    K[k].push(g);
  };

  // 1. Heavy-duty X-frame Undercarriage & Track Assemblies
  for (const s of [-1, 1]) {
    const z = s * 1.28;
    // Track belt core & rounded idler/sprocket ends
    box('rubber', 4.05, 0.84, 0.64, 0, 0.42, z);
    cylZ('rubber', 0.42, 0.64, -2.02, 0.42, z, 24);
    cylZ('rubber', 0.42, 0.64, 2.02, 0.42, z, 24);
    // Final drive planetary hub (rear) & idler hub (front)
    cylZ('dark', 0.30, 0.68, -2.02, 0.42, z, 18);
    cylZ('dark', 0.24, 0.66, 2.02, 0.42, z, 18);
    // Sculpted steel track roller frame & rock guard
    box('dark', 3.65, 0.38, 0.46, 0, 0.45, z);
    box('yellow', 3.3, 0.16, 0.50, 0, 0.62, z);
    box('dark', 3.1, 0.08, 0.54, 0, 0.32, z); // bottom rock guard
    // 7 Bottom track rollers + 2 top carrier rollers
    for (let i = -3; i <= 3; i++) cylZ('dark', 0.12, 0.68, i * 0.52, 0.15, z, 12);
    for (const x of [-0.85, 0.85]) cylZ('dark', 0.10, 0.58, x, 0.74, z, 12);
    // Triple-grouser steel track shoes around top, bottom, and ends
    for (let i = 0; i < 30; i++) {
      const tx = -2.0 + i * 0.138;
      box('dark', 0.09, 0.045, 0.66, tx, 0.85, z);
      box('dark', 0.03, 0.065, 0.66, tx - 0.02, 0.86, z);
      box('dark', 0.03, 0.065, 0.66, tx + 0.02, 0.86, z);
      box('dark', 0.09, 0.035, 0.66, tx, 0.02, z);
    }
    for (let a = 0; a < 8; a++) {
      const ang = -Math.PI / 2 + (a + 0.5) / 8 * Math.PI;
      for (const end of [-1, 1]) {
        const ex = end * 2.02 + end * Math.cos(ang) * 0.43;
        const ey = 0.42 + Math.sin(ang) * 0.43;
        box('dark', 0.04, 0.09, 0.66, ex, ey, z, end * ang);
      }
    }
    // Track tie-down lugs
    box('yellow', 0.14, 0.14, 0.08, 1.55, 0.58, z + s * 0.28);
    box('yellow', 0.14, 0.14, 0.08, -1.55, 0.58, z + s * 0.28);
  }
  // X-frame center carbody & heavy slewing ring
  box('dark', 2.1, 0.34, 2.05, 0, 0.72, 0);
  box('dark', 2.4, 0.24, 0.55, 0, 0.68, 0, 0, 0.62);
  box('dark', 2.4, 0.24, 0.55, 0, 0.68, 0, 0, -0.62);
  cylY('dark', 0.98, 1.02, 0.24, -0.1, 0.88, 0, 32);
  cylY('chrome', 0.94, 0.94, 0.05, -0.1, 1.08, 0, 32);

  // 2. Upper Structure (House), Counterweight, Engine Bay & Catwalks
  // Main chassis deck & anti-slip side catwalks
  box('dark', 3.15, 0.12, 2.58, -0.38, 1.18, 0);
  box('dark', 2.85, 0.05, 0.22, -0.25, 1.24, -1.32); // left catwalk step
  box('dark', 2.85, 0.05, 0.22, -0.25, 1.24, 1.32);  // right catwalk step
  // Sculpted rear counterweight in matte dark grey with lower amber trim
  box('dark', 0.88, 1.18, 2.54, -2.08, 1.82, 0);
  cylZ('dark', 0.59, 2.54, -2.32, 1.82, 0, 24);
  box('yellow', 0.92, 0.24, 2.56, -2.08, 1.36, 0);
  cylZ('yellow', 0.24, 2.56, -2.42, 1.36, 0, 16);
  // Counterweight recessed vents & tow cavity
  box('rubber', 0.15, 0.36, 0.42, -2.86, 1.68, 0);
  box('rubber', 0.12, 0.18, 1.6, -2.84, 2.18, 0);

  // Right-side hydraulic & fuel tanks + engine cowling
  box('yellow', 2.45, 0.98, 1.05, -0.35, 1.73, 0.74);
  box('yellow', 1.55, 0.36, 0.95, -0.05, 2.02, 0.74, -0.18); // sloped front right hood
  box('dark', 0.03, 0.72, 0.08, 0.35, 1.72, 1.27); // hydraulic oil sight glass
  cylY('dark', 0.06, 0.06, 0.08, 0.45, 2.22, 0.85, 12); // fuel cap
  // Center raised engine housing, cooling pack, louvers & exhaust stack
  box('yellow', 1.82, 0.48, 1.52, -0.95, 2.38, 0.22);
  box('dark', 0.75, 0.06, 1.05, -1.05, 2.63, 0.25); // top cooling grille
  for (let i = 0; i < 6; i++) {
    box('dark', 0.55, 0.04, 0.03, -0.95, 1.65 + i * 0.09, 1.27); // side intake louvers
    box('dark', 0.55, 0.04, 0.03, -1.25, 1.65 + i * 0.09, -1.25);
  }
  cylY('dark', 0.11, 0.11, 0.48, -1.15, 2.62, 0.68, 14); // muffler guard
  cylY('chrome', 0.055, 0.055, 0.68, -1.15, 2.62, 0.68, 12); // exhaust pipe
  box('chrome', 0.14, 0.02, 0.14, -1.15, 3.31, 0.68, 0.25); // exhaust rain cap
  // Left rear compartment behind cab
  box('yellow', 1.15, 1.02, 0.96, -1.12, 1.75, -0.76);

  // Safety handrails & mirrors on upper deck
  for (const x of [-1.55, -0.65, 0.25]) rod('dark', V(x, 2.22, 1.22), V(x, 2.72, 1.22), 0.018, 8);
  rod('dark', V(-1.55, 2.72, 1.22), V(0.55, 2.72, 1.22), 0.018, 8);
  rod('dark', V(0.55, 2.72, 1.22), V(0.75, 2.15, 1.22), 0.018, 8);
  rod('dark', V(0.82, 2.1, 1.22), V(0.82, 2.95, 1.22), 0.016, 8);
  box('dark', 0.06, 0.26, 0.16, 0.86, 2.82, 1.26); // right mirror

  // 3. Operator ROPS Cab (Left Side) with full interior detail
  const cx = 0.35, cz = -0.76;
  box('dark', 1.38, 0.14, 0.98, cx, 1.31, cz); // cab floor platform
  // Interior operator seat, armrests, joysticks & monitor
  box('dark', 0.42, 0.22, 0.44, cx - 0.08, 1.48, cz); // seat base
  box('rubber', 0.44, 0.10, 0.46, cx - 0.05, 1.64, cz); // seat cushion
  box('rubber', 0.10, 0.56, 0.44, cx - 0.24, 1.94, cz, 0.15); // seat backrest
  box('rubber', 0.08, 0.18, 0.28, cx - 0.29, 2.30, cz, 0.1); // headrest
  for (const sz of [-0.26, 0.26]) {
    box('dark', 0.34, 0.24, 0.10, cx + 0.06, 1.56, cz + sz); // joystick console
    rod('rubber', V(cx + 0.14, 1.68, cz + sz), V(cx + 0.20, 1.86, cz + sz), 0.018, 8);
  }
  rod('dark', V(cx + 0.44, 1.38, cz - 0.1), V(cx + 0.40, 1.88, cz - 0.1), 0.014, 8); // travel levers
  rod('dark', V(cx + 0.44, 1.38, cz + 0.1), V(cx + 0.40, 1.88, cz + 0.1), 0.014, 8);
  box('dark', 0.08, 0.22, 0.26, cx + 0.46, 1.96, cz - 0.28, -0.3, 0.35); // LCD monitor
  // Cab ROPS structural frame pillars (slender & angled front windshield)
  const pFL0 = V(cx + 0.66, 1.38, cz - 0.46), pFL1 = V(cx + 0.48, 3.08, cz - 0.45);
  const pFR0 = V(cx + 0.66, 1.38, cz + 0.46), pFR1 = V(cx + 0.48, 3.08, cz + 0.45);
  const pBL0 = V(cx - 0.64, 1.38, cz - 0.46), pBL1 = V(cx - 0.60, 3.08, cz - 0.45);
  const pBR0 = V(cx - 0.64, 1.38, cz + 0.46), pBR1 = V(cx - 0.60, 3.08, cz + 0.45);
  const pML0 = V(cx + 0.04, 1.38, cz - 0.46), pML1 = V(cx + 0.02, 3.08, cz - 0.45);
  for (const [a, b] of [[pFL0, pFL1], [pFR0, pFR1], [pBL0, pBL1], [pBR0, pBR1], [pML0, pML1]]) rod('dark', a, b, 0.036, 8);
  for (const [a, b] of [[pFL1, pBL1], [pFR1, pBR1], [pFL1, pFR1], [pBL1, pBR1]]) rod('dark', a, b, 0.038, 8);
  // Lower cab door kick-panel & roof cap
  box('yellow', 1.28, 0.42, 0.04, cx, 1.59, cz - 0.46);
  box('yellow', 1.14, 0.09, 0.94, cx - 0.06, 3.12, cz);
  cylY('beacon', 0.055, 0.065, 0.11, cx - 0.42, 3.16, cz - 0.28, 14); // amber strobe beacon
  // Tinted reflective safety glazing
  box('cabGlass', 0.02, 1.66, 0.88, cx + 0.57, 2.24, cz, -0.105); // angled front windshield
  box('cabGlass', 1.18, 1.24, 0.02, cx - 0.04, 2.42, cz - 0.46); // left door & rear window
  box('cabGlass', 1.18, 1.62, 0.02, cx - 0.04, 2.23, cz + 0.46); // right window
  box('cabGlass', 0.02, 1.62, 0.88, cx - 0.62, 2.23, cz); // back window
  // Cab grab handles & front work lights
  rod('chrome', V(cx + 0.62, 1.55, cz - 0.50), V(cx + 0.53, 2.35, cz - 0.50), 0.014, 8);
  box('chrome', 0.08, 0.08, 0.10, cx + 0.50, 3.06, cz - 0.34);
  box('chrome', 0.08, 0.08, 0.10, cx + 0.50, 3.06, cz + 0.34);

  // 4. Articulated Gooseneck Boom, Stick (Dipper Arm), Hydraulic Cylinders & 4-Bar Bucket Linkage
  const pv = V(0.95, 1.68, 0.12), knee = V(3.25, 4.45, 0.12), tip = pose.tip, wrist = pose.wrist;
  // Main boom lower & upper tapered box sections + side reinforcement baffle plates
  seg('yellow', pv, knee, 0.46, 0.52, 0.72, 0.28, 0.26);
  seg('yellow', knee, tip, 0.42, 0.68, 0.38, 0.22, 0.22);
  seg('dark', pv.clone().lerp(knee, 0.15), knee.clone().lerp(tip, 0.15), 0.50, 0.18, 0.18, 0, 0);
  // Hydraulic steel lines routed along top of boom
  for (const dz of [-0.24, 0.24]) {
    rod('dark', pv.clone().add(V(0, 0.28, dz)), knee.clone().add(V(0, 0.36, dz)), 0.016, 8);
    rod('dark', knee.clone().add(V(0, 0.36, dz)), tip.clone().add(V(0, 0.20, dz)), 0.016, 8);
  }
  // Stick (dipper arm) tapered section with ear brackets
  seg('yellow', tip, wrist, 0.34, 0.48, 0.30, 0.42, 0.18);
  // Heavy pivot pins with chrome end caps
  for (const [p, w] of [[pv, 0.72], [knee, 0.62], [tip, 0.58], [wrist, 0.52]]) {
    cylZ('dark', 0.13, w, p.x, p.y, p.z, 16);
    cylZ('chrome', 0.08, w + 0.04, p.x, p.y, p.z, 14);
  }
  // Twin boom lift hydraulic cylinders
  const bmAttach = pv.clone().lerp(knee, 0.56).add(V(0.08, -0.18, 0));
  for (const dz of [-0.28, 0.28]) {
    const c0 = V(1.32, 1.28, 0.12 + dz), c1 = bmAttach.clone().add(V(0, 0, dz));
    const mid = c0.clone().lerp(c1, 0.56);
    rod('dark', c0, mid, 0.095, 14);
    rod('chrome', mid, c1, 0.058, 14);
    cylZ('dark', 0.11, 0.18, c0.x, c0.y, c0.z, 12);
    cylZ('dark', 0.11, 0.18, c1.x, c1.y, c1.z, 12);
  }
  // Stick crowd cylinder above the boom
  const ac0 = knee.clone().add(V(-0.15, 0.48, 0)), ac1 = tip.clone().add(V(0.18, 0.48, 0));
  const acMid = ac0.clone().lerp(ac1, 0.58);
  rod('dark', ac0, acMid, 0.095, 14);
  rod('chrome', acMid, ac1, 0.058, 14);
  // Bucket curl cylinder & 4-bar linkage (power H-link + guide link)
  const along = wrist.clone().sub(tip).normalize(), side = V(-along.y, along.x, 0);
  const bc0 = tip.clone().addScaledVector(along, 0.32).addScaledVector(side, 0.34);
  const linkPin = wrist.clone().addScaledVector(along, -0.42).addScaledVector(side, 0.36);
  const stickPin = wrist.clone().addScaledVector(along, -0.38);
  const bcMid = bc0.clone().lerp(linkPin, 0.58);
  rod('dark', bc0, bcMid, 0.082, 14);
  rod('chrome', bcMid, linkPin, 0.048, 14);
  for (const dz of [-0.16, 0.16]) {
    rod('dark', stickPin.clone().add(V(0, 0, dz)), linkPin.clone().add(V(0, 0, dz)), 0.038, 10);
    rod('yellow', linkPin.clone().add(V(0, 0, dz)), wrist.clone().add(V(0.18, -0.15, dz)), 0.042, 10);
  }
  cylZ('chrome', 0.055, 0.44, linkPin.x, linkPin.y, linkPin.z, 12);

  // 5. Heavy-duty Rock & Earth Digging Bucket with Wear Plates & 5 Cast Teeth
  const bw = 1.12, ang = pose.bucket;
  for (let i = 0; i < 8; i++) {
    const a0 = ang + i * 0.34, a1 = a0 + 0.36, r = 0.64;
    const p0 = wrist.clone().add(V(Math.cos(a0) * r, Math.sin(a0) * r, 0.12));
    const p1 = wrist.clone().add(V(Math.cos(a1) * r, Math.sin(a1) * r, 0.12));
    seg('dark', p0, p1, bw, 0.055, 0.055);
    if (i >= 2 && i <= 5) seg('rubber', p0, p1, bw + 0.03, 0.025, 0.025); // outer wear strips
  }
  for (const z of [0.12 - bw / 2, 0.12 + bw / 2]) {
    const g = new THREE.CylinderGeometry(0.64, 0.64, 0.045, segs(20, 10), 1, false, 0, 8 * 0.34 + 0.36);
    g.rotateX(Math.PI / 2); g.rotateZ(ang + Math.PI / 2); g.translate(wrist.x, wrist.y, z); K.dark.push(g);
  }
  const lip = ang + 8 * 0.34 + 0.02, tp = wrist.clone().add(V(Math.cos(lip) * 0.64, Math.sin(lip) * 0.64, 0));
  box('dark', 0.10, 0.06, bw + 0.04, tp.x, tp.y, 0.12, lip + Math.PI / 2); // cutting edge lip
  for (let i = 0; i < 5; i++) {
    const tz = 0.12 - 0.44 + i * 0.22;
    box('yellow', 0.12, 0.07, 0.07, tp.x + Math.cos(lip + 1.4) * 0.04, tp.y + Math.sin(lip + 1.4) * 0.04, tz, lip + Math.PI / 2);
    box('chrome', 0.18, 0.045, 0.06, tp.x + Math.cos(lip + 1.4) * 0.14, tp.y + Math.sin(lip + 1.4) * 0.14, tz, lip + Math.PI / 2);
  }
  const out = {}; for (const k in K) if (K[k].length) out[k] = merge(K[k]);
  return out;
}

// ---------------------------------------------------------------- trees and foliage
// A canopy is a cloud of small faceted leaves. A lower level of detail takes fewer and larger ones (the same volume
// of green), and a tree out on the site (`tree`) takes fewer still, as octahedra on a phone.
export function canopy(clusters, s0, s1, tree = false) {
  const list = [], k0 = tree ? QL.tree : QL.leaf, sz = tree ? Math.pow(1 / QL.tree, 0.3) : QL.leafS, oct = tree && QL.treeLow;
  for (const [cx, cy, cz, rx, ry, rz, n0] of clusters) for (let i = 0, n = Math.max(5, Math.round(n0 * k0)); i < n; i++) {
    let x, y, z; do { x = rnd() * 2 - 1; y = rnd() * 2 - 1; z = rnd() * 2 - 1; } while (x * x + y * y + z * z > 1);
    const k = 0.6 + 0.4 * Math.sqrt(rnd()), r = (s0 + rnd() * (s1 - s0)) * sz;
    const g = oct ? new THREE.OctahedronGeometry(r * 1.12, 0) : new THREE.IcosahedronGeometry(r, 0); g.scale(1, 0.55, 1); g.rotateX(rnd() * 3); g.rotateZ(rnd() * 3);
    g.translate(cx + x * rx * k, cy + y * ry * k, cz + z * rz * k); list.push(g);
  }
  return merge(list);
}

// ---------------------------------------------------------------- build it
// Temporary works: matched to the exact underside of each slab & clerestory (zero floating beams!)
export const PROPS = [
  [4.2, 18.0, -1.6, 3.6, -3.2, -0.35, [8.2, 9.0], 12.5],      // lower level, bay A, under the living slab
  [5.3, 18.0, -7.6, -1.7, -3.2, -0.35, [8.2, 9.0], 12.5],     // lower level, bay B (clear of the stair slot)
  [4.2, 17.9, -1.6, 3.6, 0, 2.85, [13.05, 13.4], 19.2],       // living level, bay A, under the upper slab
  [7.1, 19.1, -7.6, -1.7, 0, 2.85, [13.1, 13.4], 19.2],       // living level, bay B and the balcony under the cantilever (the hall stays clear)
  [4.2, 16.4, -1.3, 3.6, 3.2, 6.4, [16.05, 16.45], 22.2],     // upper level, bay A, under its roof (y = 6.4); struck before the glass arrives
  [7.1, 20.2, -7.6, -1.7, 3.2, 7.2, [16.1, 16.6], 22.3],      // upper level, the tall box, under its roof (y = 7.2)
];
export function propsAt(week) {
  let n = 0;
  for (const [x0, x1, z0, z1, , , wIn, out] of PROPS) {
    const zs = PROP_ZS.filter((z) => z >= z0 + 0.3 && z <= z1 - 0.3);
    for (let x = x0 + 0.45; x <= x1 - 0.35; x += 1.35) for (let j = 0; j < zs.length; j++) {
      const u = (x - x0) / (x1 - x0);
      if (week >= wIn[0] + (wIn[1] - wIn[0]) * 0.75 * u && week < out + 0.9 * u) n++;
    }
  }
  return n;
}

export function buildWorld(o) {
  const { R } = o;
  const group = new THREE.Group();
  const realOnly = (main) => ({ main, paper: null, nd: null });

  // the house: one geometry per material for the site, hierarchical line classes for the drawing
  const parts = houseParts();
  for (const p of parts) p.weeks = partWeeks(p);
  const STRUCT = { conc: 'conc', floorL: 'conc', oak: 'conc', plaster: 'conc', gravel: 'conc', pave: 'conc', clad: 'conc', soffit: 'conc' };
  const shared = (k) => (k in MATTE ? 'matte' : k in SOFT ? 'soft' : k);
  const real = bucketsOf(parts, (k, p) => (p.k === 'land' ? k : (p.k === 'furn' || p.k === 'furnReal' ? shared(k) : (STRUCT[k] || k))), true);
  for (const k in real) addMesh(group, real[k], realOnly(R[k] || R.conc), { glass: k === 'glass' || k === 'cabGlass', shadow: k !== 'glass' && k !== 'cabGlass' && k !== 'steel' });

  // Separate drawing meshes by architectural hierarchy so Tile 06 is crisp and uncluttered
  const drawnStruct = bucketsOf(parts.filter((p) => p.k === 'struct' || p.k === 'stair'), () => 'paper');
  if (drawnStruct.paper) addMesh(group, drawnStruct.paper, { main: null, paper: DM.paper, nd: DM.nd });

  const drawnFrame = bucketsOf(parts.filter((p) => p.k === 'frame'), () => 'paper');
  if (drawnFrame.paper) addMesh(group, drawnFrame.paper, { main: null, paper: DM.paper, nd: DM.ndFrame });

  const drawnFurn = bucketsOf(parts.filter((p) => p.k === 'furn'), () => 'paper');
  if (drawnFurn.paper) addMesh(group, drawnFurn.paper, { main: null, paper: DM.paper, nd: DM.ndFurn });

  // the pool, its terrace and the court belong to the last drawing too
  const drawnLand = bucketsOf(parts.filter((p) => p.k === 'land'), () => 'paper');
  if (drawnLand.paper) addMesh(group, drawnLand.paper, { main: null, paper: DM.paper, nd: DM.ndFrame });

  // Temporary works (props & formwork decks)
  for (const [x0, x1, z0, z1, yb, yt, wIn, out] of PROPS) {
    const g = propsGeo(x0, x1, z0, z1, yb, yt, wIn, out);
    addMesh(group, g.posts, { main: R.prop, paper: DM.paper, nd: DM.ndProp });
    addMesh(group, g.deck, { main: R.ply, paper: DM.paper, nd: DM.ndProp });
  }

  // Footings detail, real only: blinding under them, starter bars with safety caps (encased at week 8.8 when lower walls finish)
  const bl = [];
  for (const b of [[3.1, -8.4, 4.6, 4.4], [17.7, -8.4, 18.9, 4.4], [4.6, -8.4, 17.7, -7.4], [4.6, 3.4, 17.7, 4.4]]) {
    const g = new THREE.BoxGeometry(b[2] - b[0] + 0.3, 0.04, b[3] - b[1] + 0.3); g.translate((b[0] + b[2]) / 2, -4.3 + 0.02, (b[1] + b[3]) / 2); bl.push(g);
  }
  const blg = merge(bl); worldUV(blg); stamp(blg, (x) => 2.9 + (x - 3) / 20 * 0.4, 9.30);
  addMesh(group, blg, realOnly(R.blinding), { shadow: false });
  const bars = [], caps = [];
  const bar = (x, z, w, outW) => {
    const c = new THREE.CylinderGeometry(0.009, 0.009, 0.92, segs(6, 4), 1, true); c.translate(x, -3.6 + 0.46, z); stamp(c, w, outW); bars.push(c);
    const k = new THREE.CylinderGeometry(0.024, 0.018, 0.045, segs(8, 5)); k.translate(x, -3.6 + 0.92, z); stamp(k, w, outW); caps.push(k);
  };
  const fw = (x) => 3.26 + 2.45 * clamp((x - 3.1) / 15.8, 0, 1);
  const fOut = (x) => x > 18.0 ? 8.85 : 6.62 + 2.00 * clamp((x - 3.7) / 14.6, 0, 1);
  for (let z = -7.9; z <= 3.9; z += 0.35) { bar(3.78, z, fw(3.78), fOut(3.78)); bar(3.92, z + 0.15, fw(3.92), fOut(3.92)); }
  for (let x = 4.3; x <= 17.9; x += 0.35) { for (const z of [-7.94, -7.78, 3.78, 3.94]) bar(x, z, fw(x), fOut(x)); }
  for (const z of [-7.85, -1.6, 3.85]) for (const dx of [-0.12, 0, 0.12]) for (const dz of [-0.12, 0.12]) bar(18.24 + dx, z + dz, fw(18.24 + dx), 8.85);
  addMesh(group, merge(bars), realOnly(R.rebar), { shadow: true });
  addMesh(group, merge(caps), realOnly(R.cap), { shadow: false });

  // the land
  const land = buildLand(o);
  for (const m of land) group.add(m);

  // the site: crane, high-detail excavator, guardrails, perimeter fence, site office cabin
  const SITE_IN = 0.3;
  const cg = craneGeo(19.5, 34, 10);
  const crane = new THREE.Group();
  for (const [k, g] of [['yellow', cg.yellow], ['dark', cg.dark], ['block', cg.grey], ['cabGlass', cg.glass]]) { stamp(g, 4.5, 23); addMesh(crane, g, realOnly(R[k]), { glass: k === 'cabGlass', shadow: k !== 'cabGlass' }); }
  crane.position.set(-5.8, natural(-5.8, -12.6), -12.6); crane.rotation.y = -0.62; group.add(crane);

  // Excavator positioned inside the open excavation platform (clear of the poured footings & rebar), trimming the bank
  const ex = excavatorGeo({ tip: V(5.35, 3.55, 0.12), wrist: V(5.85, 1.05, 0.12), bucket: -2.25 });
  const exg = new THREE.Group();
  for (const k in ex) { stamp(ex[k], SITE_IN, 6.2); addMesh(exg, ex[k], realOnly(R[k]), { glass: k === 'cabGlass', shadow: k !== 'cabGlass' }); }
  exg.position.set(11.6, PIT.y, -2.2); exg.rotation.y = Math.PI * 0.93; group.add(exg);

  group.add(...barrier(R), ...fence(R));
  // Galvanised access ladder into the pit
  {
    const L = [], top = V(15.8, natural(15.8, 6.95) + 1.0, 6.95), bot = V(15.8, PIT.y, 5.3), d = top.clone().sub(bot), len = d.length();
    for (const s of [-0.22, 0.22]) { const g = new THREE.BoxGeometry(0.045, len, 0.065); g.translate(0, len / 2, 0); g.rotateX(-Math.atan2(d.z, d.y)); g.translate(bot.x + s, bot.y, bot.z); L.push(g); }
    for (let t = 0.3; t < len - 0.2; t += 0.3) { const g = new THREE.CylinderGeometry(0.015, 0.015, 0.44, 8); g.rotateZ(Math.PI / 2); g.translate(0, t, 0); g.rotateX(-Math.atan2(d.z, d.y)); g.translate(bot.x, bot.y, bot.z); L.push(g); }
    const g = merge(L); stamp(g, 3.0, (x, y) => 8.85 + 0.28 * clamp((y - PIT.y) / 3.2, 0, 1)); addMesh(group, g, realOnly(R.galv));
  }

  // Site office cabin on the court
  {
    const L = [], W = [], G = [];
    const b = (list, w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); list.push(g); };
    b(L, 6.0, 2.5, 2.4, 0, 1.45, 0); b(W, 6.1, 0.15, 2.5, 0, 2.75, 0); b(W, 6.1, 0.2, 2.5, 0, 0.1, 0);
    for (const x of [-1.8, 0.2, 2.0]) {
      b(G, 1.0, 0.85, 0.04, x, 1.75, 1.21);
      b(W, 1.08, 0.05, 0.06, x, 2.20, 1.21); b(W, 1.08, 0.05, 0.06, x, 1.30, 1.21);
    }
    b(W, 0.95, 2.0, 0.04, -2.55, 1.2, 1.21);
    for (const x of [-2.6, 2.6]) for (const z of [-0.9, 0.9]) b(W, 0.3, 0.3, 0.3, x, 0.0, z);
    const cab = new THREE.Group();
    for (const [list, m] of [[L, R.cabin], [W, R.cabinTrim], [G, R.cabGlass]]) { const g = merge(list); stamp(g, 0.6, 33); addMesh(cab, g, realOnly(m), { glass: m === R.cabGlass, shadow: m !== R.cabGlass }); }
    cab.position.set(-8.5, natural(-8.5, -4) + 0.05, -4); cab.rotation.y = Math.PI / 2; group.add(cab);
  }

  // Trees around the site & garden
  const trees = [];
  for (let z = -22; z <= 15; z += 3.5) trees.push(['cypress', -15 + Math.sin(z) * 0.6, z + (rnd() - 0.5), 0]);
  for (const t of [
    ['olive', -6, -23, 0], ['olive', -24, 4, 0], ['olive', 30, -17, 0], ['olive', 33, -10.5, 0],
    ['olive', 34, 13, 0], ['olive', -2.5, 19, 0], ['olive', 40, 2, 0], ['round', -22, -12, 0],
    ['olive', 46, -24, 0], ['olive', 52, 10, 0],
    // Garden trees planted during fit-out (weeks 33 to 35), either side of the pool and below it
    ['olive', 24.6, -11.6, 33.2], ['olive', 25.4, 7.4, 33.6], ['round', 33.5, -3.0, 34.0], ['olive', 20.2, 7.2, 34.3],
  ]) trees.push(t);
  // Each tree is built where it stands and the trees are merged by material into two groves, west and east of the
  // house, so the whole planting is a handful of draw calls and the grove behind the camera is culled as one.
  const groves = { w: {}, e: {} };
  for (const [kind, x, z, wIn] of trees) {
    const y = natural(x, z) - 0.05, ry = rnd() * 6.28, B = groves[x < 2 ? 'w' : 'e'];
    const put = (key, g, dy = 0) => { g.translate(0, dy, 0); g.rotateY(ry); g.translate(x, y, z); stamp(g, wIn); (B[key] || (B[key] = [])).push(g); };
    if (kind === 'cypress') {
      const h = 0.85 + rnd() * 0.35;
      put('leafDark', canopy([[0, 0, 0, 0.72, 3.3 * h, 0.72, 420]], 0.11, 0.19, true), 3.5 * h + 0.45);
      put('bark', new THREE.CylinderGeometry(0.1, 0.15, 1.5, segs(8, 5)).translate(0, 0.75, 0).toNonIndexed());
    } else {
      const olive = kind === 'olive';
      const tr = new THREE.CylinderGeometry(0.11, 0.22, 2.4, segs(8, 5)); tr.rotateZ(olive ? 0.16 : 0.04); tr.translate(0, 1.2, 0);
      const br1 = new THREE.CylinderGeometry(0.05, 0.1, 1.6, segs(6, 4)); br1.rotateZ(-0.65); br1.translate(0.3, 2.35, 0);
      const br2 = new THREE.CylinderGeometry(0.04, 0.09, 1.4, segs(6, 4)); br2.rotateZ(0.55); br2.rotateY(1.2); br2.translate(-0.25, 2.25, 0.2);
      put('bark', merge([tr, br1, br2]));
      const cl = olive
        ? [[-0.4, 0, 0, 1.7, 0.9, 1.5, 380], [0.9, 0.4, 0.3, 1.2, 0.72, 1.1, 220], [-0.2, 0.82, -0.4, 1.1, 0.62, 1.1, 180]]
        : [[0, 0, 0, 1.8, 1.6, 1.7, 500], [0.5, 0.85, 0.3, 1.2, 0.95, 1.1, 220]];
      put(olive ? 'olive' : 'leaf', canopy(cl, olive ? 0.09 : 0.11, olive ? 0.17 : 0.20, true), olive ? 3.0 : 3.6);
    }
  }
  for (const side in groves) for (const k in groves[side]) addMesh(group, merge(groves[side][k]), realOnly(R[k]));
  return group;
}

// ---------------------------------------------------------------- the land, as meshes
function buildLand(o) {
  const { T } = o;
  const out = [];
  const step = QL.step;
  const X0 = -20, X1 = 40, Z0 = -26, Z1 = 20;
  const nx = Math.round((X1 - X0) / step), nz = Math.round((Z1 - Z0) / step);
  const terrainMat = makeTerrainMat(T);

  // Depress natural terrain slightly under paved areas so ground never clips through paving slabs
  const pavedDepress = (x, z) => {
    const inCourt = x >= -7.1 && x <= 4.0 && z >= -6.6 && z <= 3.6;
    const inGardenPave = x >= 18.1 && x <= 22.1 && z >= -8.2 && z <= 4.2;
    return (inCourt || inGardenPave) ? -0.09 : 0;
  };

  const W = nx + 1, NAT = new Float32Array(W * (nz + 1)), PITH = new Float32Array(W * (nz + 1)), VX = new Float32Array(W * (nz + 1)), VZ = new Float32Array(W * (nz + 1));
  const f = (x, z) => pitY(x, z) - natural(x, z), e = 0.004;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    let x = X0 + i * step, z = Z0 + j * step; const k = j * W + i;
    const f0 = f(x, z);
    if (Math.abs(f0) < step * 3) {
      const gx = (f(x + e, z) - f(x - e, z)) / (2 * e), gz = (f(x, z + e) - f(x, z - e)) / (2 * e), g2 = gx * gx + gz * gz;
      if (g2 > 1e-6) { const dx = -f0 * gx / g2, dz = -f0 * gz / g2; if (dx * dx + dz * dz < (0.5 * step) ** 2) { x += dx; z += dz; } }
    }
    VX[k] = x; VZ[k] = z; NAT[k] = natural(x, z) + pavedDepress(x, z); PITH[k] = pitY(x, z);
  }
  const inPit = (k) => PITH[k] < NAT[k] - 2e-3;
  const quadPit = (i, j) => inPit(j * W + i) || inPit(j * W + i + 1) || inPit((j + 1) * W + i) || inPit((j + 1) * W + i + 1);
  const surface = (take, hf, wf, mixf, out_ = 0, truth = null) => {
    const outf = typeof out_ === 'function' ? out_ : () => out_, outs = [];
    const map = new Int32Array(W * (nz + 1)).fill(-1), pos = [], wk = [], mix = [], idx = [];
    const vid = (i, j) => {
      const k = j * W + i; if (map[k] >= 0) return map[k];
      const x = VX[k], z = VZ[k], y = hf(k, x, z);
      map[k] = pos.length / 3; pos.push(x, y, z); wk.push(wf(x, y, z, k)); mix.push(...mixf(x, y, z, k)); outs.push(outf(x, y, z, k)); return map[k];
    };
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      if (!take(i, j)) continue;
      const a = vid(i, j), b = vid(i + 1, j), c = vid(i + 1, j + 1), d = vid(i, j + 1);
      if (truth) {
        const y = (v) => pos[v * 3 + 1], mid = truth(X0 + (i + 0.5) * step, Z0 + (j + 0.5) * step);
        if (Math.abs((y(a) + y(c)) / 2 - mid) < Math.abs((y(b) + y(d)) / 2 - mid)) { idx.push(a, d, c, a, c, b); continue; }
      }
      idx.push(a, d, b, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aWeek', new THREE.Float32BufferAttribute(wk, 1));
    g.setAttribute('aOut', new THREE.Float32BufferAttribute(outs, 1));
    g.setAttribute('aMix', new THREE.Float32BufferAttribute(mix, 4));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  };
  const FENCE = [-12, 31, -20, 14];
  const grassW = (x, z) => {
    const d = Math.min(x - FENCE[0], FENCE[1] - x, z - FENCE[2], FENCE[3] - z);
    const n = noise2(x * 0.35, z * 0.35);
    let g = 1 - smooth(-0.6, 2.5 + n * 3, d);
    const away = Math.max(PIT.x0 - 6 - x, x - PIT.x1 - 6, PIT.z0 - 6 - z, z - PIT.z1 - 6);
    g = Math.max(g, 0.7 * smooth(0.55, 0.8, noise2(x * 0.22 + 7, z * 0.22)) * smooth(0, 4, away));
    if (Math.abs(z) < 2.6 && x > PIT.x1) g *= 0.15;
    return clamp(g, 0, 1);
  };
  const xw = (x) => clamp((x - (-10)) / 44, 0, 1), landW = (x) => -1.3 + 0.9 * xw(x), digW = (x) => 0.6 + 2.4 * clamp(x / 22, 0, 1), backW = (x) => BACKFILL + 0.3 * xw(x);

  // Target grade after backfill: matches NAT[k] outside the house and stays below the lower-level floor slab (-3.65m)
  // inside the building footprint so dirt never enters the room.
  const backfillY = (k, x, z) => {
    let y = NAT[k];
    const inRoom = smooth(3.85, 4.15, x) * (1 - smooth(18.02, 18.28, x)) * smooth(-7.85, -7.55, z) * (1 - smooth(3.55, 3.85, z));
    if (inRoom > 0) y += (Math.min(y, -3.65) - y) * inRoom;
    return y;
  };

  // 2D sheet meshes (Tiles 01-06)
  const pitDraw = surface(quadPit, (k, x, z) => Math.min(PITH[k], NAT[k]) + (PITH[k] < NAT[k] - 0.05 ? ruts(x, z) * 0.6 : 0), (x, y, z, k) => (PITH[k] < NAT[k] - 2e-3 ? digW(x) : PITH[k] < NAT[k] + 2e-3 ? 0 : landW(x)),
    (x, y, z, k) => { const cut = NAT[k] - PITH[k]; const floor = y < PIT.y + 0.1 ? 1 : 0; return cut > 2e-3 ? [0, smooth(0.02, 0.3, cut), floor * 0.6, 0] : [grassW(x, z), 0, 0, 0]; }, (x) => backW(x), (x, z) => Math.min(pitY(x, z), natural(x, z)));
  const fillDraw = surface(quadPit, (k) => NAT[k], (x) => backW(x), (x, y, z) => [grassW(x, z), 0, 0, 0]);
  out.push(
    landMesh(pitDraw, null, true),
    landMesh(fillDraw, null, false)
  );

  // 3D pit & continuous bottom-up backfill mesh
  const pitReal = surface(quadPit, (k, x, z) => Math.min(PITH[k], NAT[k]) + (PITH[k] < NAT[k] - 0.05 ? ruts(x, z) * 0.6 : 0), (x, y, z, k) => (PITH[k] < NAT[k] - 2e-3 ? digW(x) : PITH[k] < NAT[k] + 2e-3 ? 0 : landW(x)),
    (x, y, z, k) => { const cut = NAT[k] - PITH[k]; const floor = y < PIT.y + 0.1 ? 1 : 0; return [grassW(x, z), cut > 2e-3 ? smooth(0.02, 0.3, cut) : 0, cut > 2e-3 ? floor * 0.6 : 0, 1]; }, 0, (x, z) => Math.min(pitY(x, z), natural(x, z)));
  const pitTarget = surface(quadPit, backfillY, () => 0, () => [0, 0, 0, 0], 0, (x, z) => Math.min(pitY(x, z), natural(x, z)));
  {
    const tp = pitTarget.attributes.position, tn = pitTarget.attributes.normal, nV = tp.count;
    const natY = new Float32Array(nV);
    for (let i = 0; i < nV; i++) natY[i] = tp.getY(i);
    pitReal.setAttribute('aNatY', new THREE.BufferAttribute(natY, 1));
    pitReal.setAttribute('aNatN', tn);
  }
  const nat = surface((i, j) => !quadPit(i, j), (k, x, z) => NAT[k] + ruts(x, z) * smooth(0.3, 1.5, PITH[k] - NAT[k]) * (1 - grassW(x, z)), landW,
    (x, y, z) => [grassW(x, z), 0, 0, 0]);
  const before = surface(quadPit, (k) => NAT[k], landW, (x, y, z) => [grassW(x, z), 0, 0, 0], (x) => digW(x));
  // the open slope only receives shadows: its own are too soft to see, and it is the largest mesh on site
  out.push(landMesh(pitReal, terrainMat, true, false), landMesh(nat, terrainMat, false, true, false), landMesh(before, terrainMat, false, true, false));

  // Spoil heap on the court (lowers smoothly into the court as its earth backfills the foundation hole)
  {
    const hs = QL.heap, n = Math.ceil(HEAP[2] * 2.2 / hs);
    const g = new THREE.PlaneGeometry(HEAP[2] * 2.2, HEAP[2] * 2.2 / 1.25, n, Math.round(n / 1.25)); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, mix = [], natY = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + HEAP[0], z = p.getZ(i) + HEAP[1], h = heapH(x, z), yn = natural(x, z);
      p.setXYZ(i, x, yn + (h > 0.01 ? h + 0.015 : -0.08), z);
      natY.push(yn - 0.08);
      mix.push(0, 1, 0, 2);
    }
    g.setAttribute('aMix', new THREE.Float32BufferAttribute(mix, 4));
    g.setAttribute('aNatY', new THREE.Float32BufferAttribute(natY, 1));
    g.computeVertexNormals();
    stamp(g, (x, y, z) => 1.2 + 1.8 * clamp(1 - Math.hypot(x - HEAP[0], z - HEAP[1]) / HEAP[2], 0, 1), 10.30);
    out.push(landMesh(g, terrainMat, true));
  }

  // Far land to the horizon
  {
    const N = QL.far, E = 1800, warp = (u) => Math.sign(u) * Math.pow(Math.abs(u), 2.3) * E;
    const xs = [], zs = [];
    for (let i = 0; i <= N; i++) { xs.push(12 + warp(i / N * 2 - 1)); zs.push(-3 + warp(i / N * 2 - 1)); }
    const pos = [], mix = [], idx = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const x = xs[i], z = zs[j]; pos.push(x, natural(x, z) - (x > X0 + 1 && x < X1 - 1 && z > Z0 + 1 && z < Z1 - 1 ? 0.6 : 0), z); mix.push(1, 0, 0, 0); }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (xs[i] >= X0 && xs[i + 1] <= X1 && zs[j] >= Z0 && zs[j + 1] <= Z1) continue;
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 2, d = a + N + 1; idx.push(a, d, b, b, d, c);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aMix', new THREE.Float32BufferAttribute(mix, 4));
    g.setIndex(idx); g.computeVertexNormals(); stamp(g, 0);
    const m = new THREE.Mesh(g, terrainMat); m.userData.sets = { main: terrainMat, paper: null, nd: null }; m.receiveShadow = true; m.frustumCulled = false; out.push(m);
  }

  // The lake in the valley, the long water the house looks out on
  {
    const g = new THREE.PlaneGeometry(4200, 4200, 1, 1); g.rotateX(-Math.PI / 2); g.translate(600, -19.5, 0); stamp(g, 0);
    const m = new THREE.Mesh(g, o.R.lake); m.userData.sets = { main: o.R.lake, paper: null, nd: null }; m.receiveShadow = false; m.frustumCulled = false; out.push(m);
  }

  // Block sides with architectural section hatch (drawing only)
  {
    const [bx0, bz0, bx1, bz1] = [U.uBlock.value.x, U.uBlock.value.y, U.uBlock.value.z, U.uBlock.value.w], yb = -10, s = 0.5, list = [];
    const side = (pts) => {
      const pos = [], idx = [];
      pts.forEach(([x, z], i) => { pos.push(x, natural(x, z), z, x, yb, z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      stamp(g, landW); list.push(g);
    };
    const run = (a, b, f) => { const p = []; for (let t = a; t <= b + 1e-6; t += s) p.push(f(t)); return p; };
    side(run(bx0, bx1, (x) => [x, bz0])); side(run(bx0, bx1, (x) => [x, bz1])); side(run(bz0, bz1, (z) => [bx0, z])); side(run(bz0, bz1, (z) => [bx1, z]));
    const m = new THREE.Mesh(merge(list), DM.hatch); m.userData.sets = { main: null, paper: DM.hatch, nd: DM.ndLand }; m.frustumCulled = false; out.push(m);
  }
  return out;
}
function landMesh(g, mat, tint = false, draw = true, cast = true) {
  const m = new THREE.Mesh(g, mat || DM.land);
  m.userData.sets = { main: mat, paper: draw ? DM.land : null, nd: draw ? (tint ? DM.ndEarth : DM.ndLand) : null };
  m.receiveShadow = !!mat; m.castShadow = !!mat && cast;
  if (mat) m.customDepthMaterial = mat.userData.depthMat || DEPTH_WEEKLY;
  m.frustumCulled = false; return m;
}
function makeTerrainMat(T) {
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMat.onBeforeCompile = (s) => {
    WEEKLY(s);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMix; attribute float aNatY;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float bf = smoothstep(9.05, 10.25, uNow);
        if (aMix.w > 0.5 && aMix.w < 1.5 && bf > 0.0) {
          float yLevel = bf < 0.52
            ? mix(-4.38, -3.12, smoothstep(0.0, 0.52, bf))
            : mix(-3.12, 0.12, smoothstep(0.52, 1.0, bf));
          float d = yLevel - transformed.y;
          float softRise = transformed.y + 0.5 * (d + sqrt(d * d + 0.012));
          transformed.y = mix(min(aNatY, softRise), aNatY, smoothstep(0.94, 1.0, bf));
        } else if (aMix.w > 1.5 && bf > 0.0) {
          transformed.y = mix(transformed.y, aNatY, smoothstep(0.0, 0.88, bf));
        }`);
  };
  depthMat.customProgramCacheKey = () => 'terrain-depth';

  const m = std({ map: T.soil, bumpMap: T.soilBump, bumpScale: 0.035, roughness: 0.95, metalness: 0, envMapIntensity: 0.14 });
  m.userData.depthMat = depthMat;
  m.onBeforeCompile = (s) => {
    WEEKLY(s);
    s.uniforms.tGrass = { value: T.grass }; s.uniforms.tClay = { value: T.clay };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aMix; attribute float aNatY; attribute vec3 aNatN; varying vec4 vMix; varying vec3 vWp; varying float vRisen;')
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float bfN = smoothstep(9.05, 10.25, uNow);
        if (aMix.w > 0.5 && aMix.w < 1.5 && bfN > 0.0) {
          float yLv = bfN < 0.52
            ? mix(-4.38, -3.12, smoothstep(0.0, 0.52, bfN))
            : mix(-3.12, 0.12, smoothstep(0.52, 1.0, bfN));
          float dN = yLv - position.y;
          float sRise = position.y + 0.5 * (dN + sqrt(dN * dN + 0.012));
          float yC = mix(min(aNatY, sRise), aNatY, smoothstep(0.94, 1.0, bfN));
          float onBed = smoothstep(-0.08, 0.08, dN) * (1.0 - smoothstep(aNatY - 0.14, aNatY, sRise));
          vec3 nCur = normalize(mix(objectNormal, vec3(0.0, 1.0, 0.0), onBed * 0.88));
          float atTop = smoothstep(aNatY - 0.16, aNatY - 0.005, yC);
          objectNormal = normalize(mix(nCur, aNatN, max(atTop, smoothstep(0.94, 1.0, bfN))));
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float bf = smoothstep(9.05, 10.25, uNow);
        float vPitY = transformed.y;
        vRisen = 0.0;
        if (aMix.w > 0.5 && aMix.w < 1.5 && bf > 0.0) {
          float yLevel = bf < 0.52
            ? mix(-4.38, -3.12, smoothstep(0.0, 0.52, bf))
            : mix(-3.12, 0.12, smoothstep(0.52, 1.0, bf));
          float d = yLevel - vPitY;
          float softRise = vPitY + 0.5 * (d + sqrt(d * d + 0.012));
          transformed.y = mix(min(aNatY, softRise), aNatY, smoothstep(0.94, 1.0, bf));
          vRisen = max(smoothstep(0.015, 0.10, transformed.y - vPitY), smoothstep(0.92, 1.0, bf));
        } else if (aMix.w > 1.5 && bf > 0.0) {
          transformed.y = mix(vPitY, aNatY, smoothstep(0.0, 0.88, bf));
        }
        vMix = aMix;
        vWp = (modelMatrix * vec4(transformed, 1.)).xyz;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tGrass, tClay; varying vec4 vMix; varying vec3 vWp; varying float vRisen;')
      .replace('#include <map_fragment>', `
        // once the pit is backfilled no ground shows inside the rooms of the pool level, however coarse the terrain grid
        if (uNow > 9. && vWp.x > 4.02 && vWp.x < 18.28 && vWp.z > -7.68 && vWp.z < 3.68 && vWp.y > -3.63) discard;
        vec2 q = vWp.xz;
        vec3 soil = texture2D(map, q / 3.0).rgb * mix(.84, 1.12, texture2D(map, q / 23.).r);
        vec3 grass = texture2D(tGrass, q / 3.8).rgb * mix(.86, 1.12, texture2D(tGrass, q / 29. + .37).g);
        vec3 clay = texture2D(tClay, q / 2.8).rgb * mix(.86, 1.1, texture2D(tClay, q / 19. + .5).r);
        float clayK = vMix.y * (1.0 - vRisen);
        float floorK = vMix.z * (1.0 - vRisen);
        float gard = smoothstep(32.5, 35.0, uNow - .03 * (vWp.x + 12.));
        vec3 base = mix(soil, grass, max(smoothstep(.15, .85, vMix.x), gard));
        base = mix(base, clay, clayK);
        base *= mix(vec3(1.), vec3(.90, 1.04, .82), gard * (1. - clayK));
        base *= 1. - floorK * .20;
        diffuseColor.rgb = base;`);
  };
  m.customProgramCacheKey = () => 'terrain';
  return m;
}

// ---------------------------------------------------------------- engineered edge-protection guardrail & safety mesh around the pit
function barrier(R) {
  const pts = [];
  const r0 = (x, z) => (natural(x, z) - PIT.y) / PIT.k + 1.1;
  const ring = [];
  for (let x = 19.6; x >= PIT.x0; x -= 0.5) ring.push([x, 1]);
  for (let a = 0; a <= Math.PI / 2 + 1e-6; a += Math.PI / 16) ring.push(['c1', a]);
  for (let z = PIT.z1; z >= PIT.z0; z -= 0.5) ring.push([z, 2]);
  for (let a = 0; a <= Math.PI / 2 + 1e-6; a += Math.PI / 16) ring.push(['c2', a]);
  for (let x = PIT.x0; x <= 19.6; x += 0.5) ring.push([x, 3]);
  for (const r of ring) {
    let x, z;
    for (let it = 0, rr = 3; it < 4; it++) {
      if (r[1] === 1) { x = r[0]; z = PIT.z1 + rr; } else if (r[1] === 3) { x = r[0]; z = PIT.z0 - rr; } else if (r[1] === 2) { x = PIT.x0 - rr; z = r[0]; }
      else if (r[0] === 'c1') { x = PIT.x0 - Math.sin(r[1]) * rr; z = PIT.z1 + Math.cos(r[1]) * rr; } else { x = PIT.x0 - Math.cos(r[1]) * rr; z = PIT.z0 - Math.sin(r[1]) * rr; }
      rr = r0(x, z);
    }
    const gap = r[1] === 1 && x > 11.0 && x < 16.6;
    pts.push([x, z, gap ? 0 : natural(x, z) - PIT.y]);
  }
  const runs = []; let cur = [];
  for (const p of pts) { if (p[2] > 1.25) cur.push(p); else if (cur.length) { runs.push(cur); cur = []; } }
  if (cur.length) runs.push(cur);
  const net = [], tubes = [], boards = [];
  const tubeSeg = (a, b, r) => {
    const d = b.clone().sub(a), len = d.length();
    const g = new THREE.CylinderGeometry(r, r, len, 6);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
    g.translate(a.x, a.y, a.z);
    tubes.push(g);
  };
  for (const run of runs) {
    const pos = [], uv = [], idx = []; let u = 0;
    run.forEach(([x, z], i) => {
      const y = natural(x, z);
      if (i) {
        const [px, pz] = run[i - 1], py = natural(px, pz);
        u += Math.hypot(x - px, z - pz);
        // Top & mid galvanised safety rails
        tubeSeg(V(px, py + 1.05, pz), V(x, y + 1.05, z), 0.022);
        tubeSeg(V(px, py + 0.54, pz), V(x, y + 0.54, z), 0.018);
      }
      pos.push(x, y + 0.16, z, x, y + 0.96, z); uv.push(u / 0.5, 0, u / 0.5, 1);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      if (i % 4 === 0 || i === run.length - 1) {
        const c = new THREE.CylinderGeometry(0.024, 0.024, 1.15, 8); c.translate(x, y + 0.56, z); tubes.push(c);
        const bp = new THREE.BoxGeometry(0.14, 0.02, 0.14); bp.translate(x, y + 0.01, z); boards.push(bp);
      }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); net.push(g.toNonIndexed());
  }
  const bOut = (x, y, z) => 8.70 + 0.42 * clamp((x - 2) / 18, 0, 1) + 0.15 * clamp((y - natural(x, z)) / 1.15, 0, 1);
  const ng = mergeGeometries(net); stamp(ng, 0.8, bOut);
  const tg = merge(tubes); stamp(tg, 0.8, bOut);
  const bg = merge(boards); stamp(bg, 0.8, bOut);
  const a = new THREE.Mesh(ng, R.net); a.userData.sets = { main: R.net, paper: null, nd: null }; a.castShadow = true; a.receiveShadow = true; a.customDepthMaterial = DEPTH_WEEKLY;
  const b = new THREE.Mesh(tg, R.galv); b.userData.sets = { main: R.galv, paper: null, nd: null }; b.castShadow = true; b.customDepthMaterial = DEPTH_WEEKLY;
  const c = new THREE.Mesh(bg, R.timber); c.userData.sets = { main: R.timber, paper: null, nd: null }; c.castShadow = true; c.customDepthMaterial = DEPTH_WEEKLY;
  return [a, b, c];
}

// the site fence: mesh panels on concrete feet, a gate where the track leaves
function fence(R) {
  const [x0, x1, z0, z1] = [-12, 31, -20, 14];
  const frame = [], wire = [], feet = [];
  const panel = (ax, az, bx, bz) => {
    const ya = natural(ax, az), yb = natural(bx, bz), len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
    const q = new THREE.PlaneGeometry(len - 0.08, 1.9); q.translate(len / 2, 1.05, 0); q.rotateY(-ang); q.translate(ax, (ya + yb) / 2, az);
    const p = q.attributes.position, uv = q.attributes.uv;
    for (let i = 0; i < p.count; i++) { const t = ((p.getX(i) - ax) * (bx - ax) + (p.getZ(i) - az) * (bz - az)) / (len * len); p.setY(i, p.getY(i) + (yb - ya) * (t - 0.5)); uv.setXY(i, uv.getX(i) * len / 0.5, uv.getY(i) * 1.9 / 1.0); }
    wire.push(q);
    for (const [t] of [[0.01], [0.99]]) {
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ya + (yb - ya) * t;
      const c = new THREE.CylinderGeometry(0.022, 0.022, 2.0, 6); c.translate(x, y + 1.05, z); frame.push(c);
      const f = new THREE.BoxGeometry(0.62, 0.14, 0.2); f.rotateY(-ang + Math.PI / 2); f.translate(x, y + 0.07, z); feet.push(f);
    }
    for (const h of [0.08, 2.0]) { const r = new THREE.CylinderGeometry(0.02, 0.02, len, 6); r.rotateZ(Math.PI / 2); r.translate(len / 2, 0, 0); r.rotateY(-ang); r.translate(ax, 0, az); const rp = r.attributes.position; for (let i = 0; i < rp.count; i++) { const t = ((rp.getX(i) - ax) * (bx - ax) + (rp.getZ(i) - az) * (bz - az)) / (len * len); rp.setY(i, rp.getY(i) + ya + (yb - ya) * t + h); } frame.push(r); }
  };
  const edge = (ax, az, bx, bz, gap) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 3.45);
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n, mx = ax + (bx - ax) * (t0 + t1) / 2, mz = az + (bz - az) * (t0 + t1) / 2;
      if (gap && gap(mx, mz)) continue;
      panel(ax + (bx - ax) * t0, az + (bz - az) * t0, ax + (bx - ax) * t1, az + (bz - az) * t1);
    }
  };
  edge(x0, z0, x1, z0); edge(x0, z1, x1, z1); edge(x0, z0, x0, z1); edge(x1, z0, x1, z1, (x, z) => Math.abs(z) < 3.2);
  const out = [];
  for (const [list, m, sh] of [[frame, R.galv, true], [wire, R.wire, true], [feet, R.block, true]]) {
    const g = merge(list); stamp(g, 0.2, 33);
    const mesh = new THREE.Mesh(g, m); mesh.userData.sets = { main: m, paper: null, nd: null }; mesh.castShadow = sh; mesh.receiveShadow = true; mesh.customDepthMaterial = DEPTH_WEEKLY; out.push(mesh);
  }
  return out;
}

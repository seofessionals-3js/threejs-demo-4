// What arrives on site besides the house: the engineered scaffold stair to the balcony, stacks of material,
// and in the final weeks the bespoke furniture, lighting and planting that stage the rooms for handover.
// Everything is stamped with the weeks it is there, like the house.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { V, stamp, merge, addMesh, worldUV, canopy, DM, rnd, natural, DOOR, DOOR0, STAIR, FW, QL, segs, MATTE, SOFT } from './world.js';

// Every round thing takes its number of segments from the level of detail (QL in world.js): a rounded corner of a few
// millimetres needs one bevel, a sofa cushion needs more, and a phone needs fewer of both than a desktop.
const rb = (w, h, d, r, x = 0, y = 0, z = 0, seg = 4) => {
  const g = new RoundedBoxGeometry(w, h, d, Math.min(seg, QL.rb(r)), Math.max(0.002, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)));
  g.translate(x, y, z);
  return g;
};
const bx = (w, h, d, x = 0, y = 0, z = 0) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const cyl = (r0, r1, h, x = 0, y = 0, z = 0, seg = 20) => { const g = new THREE.CylinderGeometry(r0, r1, h, segs(seg, Math.max(r0, r1) < 0.02 ? 4 : 8)); g.translate(x, y + h / 2, z); return g; };
const lathe = (pts, x, y, z, seg = 28) => { const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), Math.max(12, Math.round(seg * QL.lathe))); g.translate(x, y, z); return g; };
const sph = (r, w, h, ...rest) => new THREE.SphereGeometry(r, Math.max(8, Math.round(w * QL.sph)), Math.max(6, Math.round(h * QL.sph)), ...rest);
const tube = (a, b, r, seg = 10) => {
  const d = b.clone().sub(a), len = d.length();
  const g = new THREE.CylinderGeometry(r, r, len, segs(seg, r < 0.02 ? 4 : 5));
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
};

export function buildStage(R) {
  const group = new THREE.Group();
  const drawn = {}, real = {};
  // `piece` places geometries in world space, applies world-metre UVs so textures & bump maps show crisp grain,
  // and routes clean architectural forms to `drawn` (for Tile 06) and fine accessories to `real` (so Tile 06 stays uncluttered).
  let sched = FW; // the upper and living levels keep the weeks of the first schedule, brought forward (see FW in world.js)
  // The buckets are kept by floor as well as by material ('walnut@u' is the walnut of the upper level): a floor is
  // furnished in its own weeks, so until then its whole mesh is skipped (tagWeeks in world.js). Small flat coloured
  // things (books, pots, cushions) share one material and carry their colour on the vertices.
  const tint = new THREE.Color();
  const piece = (bucket, list, x, y, z, ry, week, out = 0) => {
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
    const zone = y >= 3 ? 'u' : y >= -0.5 ? 'l' : 'p';
    for (const [mat, g0, realOnlyItem] of list) {
      const g = g0.index ? g0.toNonIndexed() : g0;
      g.applyMatrix4(m);
      if (mat !== 'art') worldUV(g);
      stamp(g, sched(week), out);
      const target = realOnlyItem ? real : bucket;
      const shared = mat in MATTE ? 'matte' : mat in SOFT ? 'soft' : null;
      if (shared) {
        tint.setHex(MATTE[mat] ?? SOFT[mat]);
        const n = g.attributes.position.count, c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { c[i * 3] = tint.r; c[i * 3 + 1] = tint.g; c[i * 3 + 2] = tint.b; }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      }
      const key = (shared || mat) + '@' + zone;
      (target[key] || (target[key] = [])).push(g);
    }
  };
  const lights = [];

  // Reusable sculpted walnut & saddle-leather lounge chair builder (ordered bottom-up: frame -> arms -> seat -> back -> bolster)
  const loungeChair = () => {
    const L = [];
    for (const sx of [-0.41, 0.41]) {
      L.push(['walnut', tube(V(sx, 0.0, 0.34), V(sx, 0.55, 0.24), 0.024, 10)]);
      L.push(['walnut', tube(V(sx, 0.0, -0.36), V(sx, 0.55, -0.22), 0.024, 10)]);
      L.push(['walnut', tube(V(sx, 0.24, -0.29), V(sx, 0.24, 0.29), 0.018, 8), true]);
    }
    L.push(['walnut', tube(V(-0.41, 0.26, 0.18), V(0.41, 0.26, 0.18), 0.018, 8), true]);
    L.push(['walnut', tube(V(-0.41, 0.32, -0.24), V(0.41, 0.32, -0.24), 0.018, 8), true]);
    for (const sx of [-0.41, 0.41]) {
      const arm = rb(0.065, 0.038, 0.78, 0.016, 0, 0, 0);
      arm.rotateX(0.04); arm.translate(sx, 0.56, 0.0); L.push(['walnut', arm]);
    }
    const seat = rb(0.76, 0.13, 0.74, 0.055, 0, 0, 0);
    seat.rotateX(0.08); seat.translate(0, 0.36, 0.02); L.push(['leather', seat]);
    const back = rb(0.74, 0.56, 0.13, 0.055, 0, 0, 0);
    back.rotateX(-0.26); back.translate(0, 0.66, -0.31); L.push(['leather', back]);
    const bolster = new THREE.CylinderGeometry(0.065, 0.065, 0.62, segs(16, 8));
    bolster.rotateZ(Math.PI / 2); bolster.translate(0, 0.84, -0.32); L.push(['leather', bolster, true]);
    return L;
  };

  // ================================================================ UPPER LEVEL (y = 3.20): STUDIO, LOUNGE, LOGGIA (weeks 30.85 to 33.5)
  // The camera stands in the hall void at the back and looks east: the studio in front of the library to the left (bay B),
  // the lounge through the opening in the travertine spine to the right (bay A).
  const UP = 3.20, R90 = Math.PI / 2;
  {
    const DX = 10.75, DZ = -5.35; // the desk, turned so it runs along the library
    // M1. Woven wool studio rug under the desk (Wk 30.85)
    piece(real, [
      ['rugM', rb(3.2, 0.018, 2.4, 0.006, 0, 0.012, 0, 2), true],
    ], DX, UP + 0.003, DZ + 0.45, 0, 30.85);

    // M2. Cantilevered walnut and travertine studio desk (Wk 31.10)
    piece(drawn, [
      ['travertine', cyl(0.24, 0.26, 0.72, -0.18, 0, -0.68, 28)], // fluted travertine drum pedestal
      ['steel', bx(0.76, 0.71, 0.045, 0.0, 0.355, 0.74)],        // matte steel blade leg
      ['steel', bx(0.62, 0.04, 1.38, 0.0, 0.69, 0.04), true],     // under-desk spine
      ['walnut', rb(1.10, 0.052, 2.24, 0.02, 0, 0.74, 0)],        // cantilevered walnut desktop
    ], DX, UP, DZ, R90, 31.10);

    // M3. Saddle-leather studio chair, facing the library, a scale model and a brass task lamp (Wk 31.40)
    piece(drawn, loungeChair(), DX, UP, DZ + 1.0, Math.PI, 31.38);
    piece(real, [
      // scale model of the house on a timber plinth: three stacked blocks, the top one pushed out
      ['timber', rb(0.48, 0.032, 0.38, 0.006, 0.08, 0.782, 0.28), true],
      ['ceramic', bx(0.26, 0.05, 0.22, 0.08, 0.823, 0.28), true],
      ['ceramic', bx(0.24, 0.05, 0.20, 0.07, 0.873, 0.28), true],
      ['ceramic', bx(0.16, 0.06, 0.12, 0.13, 0.928, 0.24), true],
      // stacked monographs and a sketchpad
      ['book2', rb(0.34, 0.028, 0.25, 0.005, -0.12, 0.78, -0.22), true],
      ['book0', rb(0.28, 0.026, 0.21, 0.005, -0.10, 0.808, -0.22), true],
      // brushed brass task lamp
      ['brass', cyl(0.09, 0.10, 0.025, 0.18, 0.766, -0.68, 20), true],
      ['brass', tube(V(0.18, 0.78, -0.68), V(0.08, 1.22, -0.58), 0.010, 8), true],
      ['shade', lathe([[0.13, 0], [0.08, 0.16], [0.075, 0.16], [0.125, 0]], 0.08, 1.12, -0.58), true],
    ], DX, UP, DZ, R90, 31.56);
    lights.push({ p: V(DX - 0.58, UP + 1.10, DZ - 0.08), k: 0.75, g: 'up' });

    const LX = 10.6; // the lounge in bay A
    // M4. Large woven wool lounge rug (Wk 31.88)
    piece(drawn, [
      ['rugM', rb(3.5, 0.020, 2.8, 0.008, 0, 0.012, 0, 2)],
    ], LX, UP + 0.003, 0.95, 0, 31.88);

    // M5. Boucle lounge sofa under the south window, facing the room (Wk 32.05)
    {
      const L = [
        ['steel', bx(2.26, 0.05, 0.84, 0, 0.025, 0), true],
        ['sofa', rb(2.44, 0.17, 0.98, 0.055, 0, 0.135, 0)],
        ['sofa', rb(0.24, 0.52, 0.98, 0.085, -1.12, 0.30, 0)],
        ['sofa', rb(0.24, 0.52, 0.98, 0.085, 1.12, 0.30, 0)],
        ['sofa', rb(2.24, 0.50, 0.22, 0.085, 0, 0.46, -0.38)],
        ['sofa', rb(1.00, 0.19, 0.84, 0.08, -0.51, 0.30, 0.05)],
        ['sofa', rb(1.00, 0.19, 0.84, 0.08, 0.51, 0.30, 0.05)],
      ];
      for (const x of [-0.51, 0.51]) {
        const b = rb(0.96, 0.42, 0.20, 0.085, 0, 0, 0);
        b.rotateX(-0.15); b.translate(x, 0.58, -0.23); L.push(['sofa', b, true]);
      }
      for (const [mat, x, z, rx, rz] of [
        ['cushionA', -0.78, -0.06, -0.24, 0.12],
        ['cushionC', -0.44, -0.04, -0.26, -0.06],
        ['cushionB', 0.74, -0.06, -0.22, -0.14],
      ]) {
        const c = rb(0.42, 0.38, 0.14, 0.06, 0, 0, 0);
        c.rotateX(rx); c.rotateZ(rz); c.translate(x, 0.54, z); L.push([mat, c, true]);
      }
      piece(drawn, L, LX, UP, 2.25, Math.PI, 32.05);
    }

    // M6. Fluted travertine coffee table, ceramics and books (Wk 32.38)
    piece(drawn, [
      ['travertine', cyl(0.19, 0.19, 0.30, -0.30, 0, 0, 24)],
      ['travertine', cyl(0.15, 0.15, 0.30, 0.32, 0, 0.02, 24)],
      ['travertine', rb(1.24, 0.05, 0.72, 0.022, 0, 0.32, 0)],
      ['terracotta', lathe([[0, 0], [0.10, 0], [0.16, 0.05], [0.17, 0.08], [0, 0.02]], -0.22, 0.345, 0.04), true],
      ['ceramic', lathe([[0, 0], [0.07, 0], [0.10, 0.08], [0.06, 0.24], [0.07, 0.26], [0, 0.26]], 0.24, 0.345, -0.05), true],
      ['book1', rb(0.28, 0.035, 0.22, 0.005, 0.02, 0.362, 0.06), true],
    ], LX, UP, 0.88, 0, 32.38);

    // M7. Pair of walnut and saddle-leather lounge chairs turned to the table (Wk 32.65 & 32.78)
    piece(drawn, loungeChair(), LX - 1.7, UP, 0.62, Math.atan2(1.7, 0.26), 32.65);
    piece(drawn, loungeChair(), LX + 1.67, UP, 0.62, Math.atan2(-1.67, 0.26), 32.78);

    // M8. Floor lamp, a potted olive by the glass and a ficus by the stair (Wk 32.95 to 33.18)
    piece(drawn, [
      ['travertine', cyl(0.18, 0.19, 0.06, 0, 0, 0, 24), true],
      ['brass', cyl(0.012, 0.012, 1.48, 0, 0.06, 0, 10), true],
      ['shade', lathe([[0.20, 0], [0.14, 0.24], [0.135, 0.24], [0.195, 0]], 0, 1.42, 0), true],
    ], LX + 1.95, UP, 2.3, 0, 32.95);
    lights.push({ p: V(LX + 1.95, UP + 1.52, 2.3), k: 0.85, g: 'up' });

    piece(drawn, [
      ['terracotta', lathe([[0, 0], [0.22, 0], [0.28, 0.44], [0.29, 0.48], [0, 0.44]], 0, 0, 0)],
      ['soilPot', cyl(0.25, 0.25, 0.02, 0, 0.44, 0, 20), true],
      ['bark', merge([tube(V(0, 0.44, 0), V(0.06, 1.35, 0.04), 0.042, 7), tube(V(0.06, 1.35, 0.04), V(0.32, 1.82, 0.16), 0.026, 6), tube(V(0.06, 1.35, 0.04), V(-0.24, 1.86, -0.12), 0.026, 6)]), true],
      ['olive', canopy([[0, 1.95, 0, 0.68, 0.44, 0.64, 180], [0.32, 2.15, 0.15, 0.44, 0.32, 0.42, 90]], 0.045, 0.085), true],
    ], 15.3, UP, 2.85, 0.3, 33.10);

    piece(drawn, [
      ['ceramic', lathe([[0, 0], [0.18, 0], [0.22, 0.38], [0, 0.38]], 0, 0, 0)],
      ['bark', tube(V(0, 0.36, 0), V(0.04, 1.18, 0.02), 0.022, 6), true],
      ['leaf', canopy([[0.04, 1.32, 0, 0.40, 0.48, 0.40, 65]], 0.08, 0.14), true],
    ], 7.9, UP, 3.05, 0, 33.18);

    // M9. Alabaster and brass globes hung over the desk, the lounge and the bed (Wk 33.30); the tall box needs the longer cord
    for (const [x, z, cord] of [[DX, DZ, 1.72], [LX, 0.88, 0.92], [13.2, -3.6, 1.72]]) {
      piece(real, [
        ['ink', cyl(0.003, 0.003, cord, 0, 2.28, 0, 6), true],
        ['brass', cyl(0.026, 0.026, 0.06, 0, 2.24, 0, 12), true],
        ['shade', sph(0.15, 24, 16).translate(0, 2.10, 0), true],
      ], x, UP, z, 0, 33.30);
    }

    // M10. Two chairs and a drum table in the loggia of the cantilever, turned to the lake (Wk 31.74)
    piece(drawn, loungeChair(), 18.85, UP, -5.95, R90, 31.74);
    piece(drawn, loungeChair(), 18.85, UP, -4.15, R90, 31.77);
    piece(drawn, [['travertine', cyl(0.24, 0.24, 0.40, 0, 0, 0, 28)]], 19.0, UP, -5.05, 0, 31.80);
  }

  // ================================================================ LIVING LEVEL (y = 0.00): KITCHEN, DINING, LIVING (weeks 34.6 to 37.7)
  // Zone 1 & 2: island stools, tap, dining table, chairs and pendants in bay A (weeks 34.6 to 35.85)
  {
    const IX = 9.16, IZ = 1.48; // centre of the island
    // Brushed brass gooseneck tap and a ceramic vessel on the island (Wk 34.64)
    piece(real, [
      ['brass', cyl(0.014, 0.016, 0.28, 0, 0.94, 0, 12), true],
      ['brass', rb(0.025, 0.025, 0.22, 0.01, 0, 1.21, 0.09), true],
      ['ceramic', lathe([[0, 0], [0.11, 0], [0.14, 0.08], [0, 0.08]], -0.85, 0.94, 0.05), true],
    ], IX + 0.85, 0, IZ - 0.1, 0, 34.64);

    // Three walnut and leather barstools on the room side of the island (Wk 34.74 to 34.86)
    [-0.9, 0, 0.9].forEach((dx, idx) => {
      piece(real, [
        ['walnut', tube(V(-0.14, 0, -0.14), V(-0.10, 0.63, -0.10), 0.015, 8), true],
        ['walnut', tube(V(0.14, 0, -0.14), V(0.10, 0.63, -0.10), 0.015, 8), true],
        ['walnut', tube(V(-0.14, 0, 0.14), V(-0.10, 0.63, 0.10), 0.015, 8), true],
        ['walnut', tube(V(0.14, 0, 0.14), V(0.10, 0.63, 0.10), 0.015, 8), true],
        ['brass', cyl(0.13, 0.13, 0.012, 0, 0.24, 0, 20), true],
        ['walnut', cyl(0.185, 0.185, 0.025, 0, 0.625, 0, 24), true],
        ['leather', cyl(0.18, 0.19, 0.055, 0, 0.65, 0, 24), true],
      ], IX + dx, 0, 0.66, 0, 34.74 + idx * 0.06);
    });

    // Three brushed brass pendant cylinders over the island (Wk 34.96)
    for (const dx of [-0.9, 0, 0.9]) {
      piece(real, [
        ['ink', cyl(0.003, 0.003, 0.68, 0, 2.17, 0, 6), true],
        ['brass', cyl(0.035, 0.055, 0.22, 0, 1.96, 0, 16), true],
        ['shade', cyl(0.048, 0.048, 0.02, 0, 1.95, 0, 16), true],
      ], IX + dx, 0, IZ, 0, 34.96);
    }
    lights.push({ p: V(IX, 1.85, IZ), k: 0.85, g: 'kd' });

    const TX = 14.3, TZ = 1.05; // the dining table by the glass
    // Woven dining rug (Wk 35.10)
    piece(real, [['rugM', rb(3.4, 0.018, 2.2, 0.006, 0, 0.012, 0, 2), true]], TX, 0.002, TZ, 0, 35.10);

    // Solid oak dining table with bevelled top and tapered oak legs (Wk 35.28)
    const L = [
      ['oak', tube(V(-1.12, 0, -0.40), V(-1.04, 0.73, -0.36), 0.032, 12)],
      ['oak', tube(V(-1.12, 0, 0.40), V(-1.04, 0.73, 0.36), 0.032, 12)],
      ['oak', tube(V(1.12, 0, -0.40), V(1.04, 0.73, -0.36), 0.032, 12)],
      ['oak', tube(V(1.12, 0, 0.40), V(1.04, 0.73, 0.36), 0.032, 12)],
      ['oak', rb(2.65, 0.048, 1.04, 0.018, 0, 0.74, 0)],
      ['ceramic', lathe([[0, 0], [0.09, 0], [0.12, 0.14], [0.07, 0.30], [0.08, 0.32], [0, 0.32]], 0.2, 0.764, 0), true],
      ['terracotta', lathe([[0, 0], [0.12, 0], [0.16, 0.06], [0, 0.06]], -0.35, 0.764, 0.05), true],
    ];
    piece(drawn, L, TX, 0, TZ, 0, 35.28);

    // Six Danish oak and leather dining chairs (Wk 35.48 to 35.66)
    const dchair = () => {
      const L2 = [];
      for (const sx of [-0.20, 0.20]) {
        L2.push(['oak', tube(V(sx, 0, 0.20), V(sx, 0.44, 0.18), 0.017, 8), true]);
        L2.push(['oak', tube(V(sx, 0, -0.22), V(sx, 0.78, -0.21), 0.017, 8), true]);
      }
      L2.push(
        ['oak', rb(0.46, 0.035, 0.46, 0.015, 0, 0.44, 0)],
        ['oak', rb(0.46, 0.16, 0.032, 0.014, 0, 0.74, -0.21)],
        ['leather', rb(0.42, 0.038, 0.42, 0.015, 0, 0.475, 0.01), true],
      );
      return L2;
    };
    [-0.8, 0, 0.8].forEach((dx, idx) => {
      piece(drawn, dchair(), TX + dx, 0, TZ - 0.73, 0, 35.48 + idx * 0.05);
      piece(drawn, dchair(), TX + dx, 0, TZ + 0.73, Math.PI, 35.56 + idx * 0.05);
    });

    // Three alabaster pendant globes over the dining table (Wk 35.80)
    for (const dx of [-0.8, 0, 0.8]) {
      piece(real, [
        ['shade', sph(0.145, 24, 16).translate(0, 1.98, 0), true],
        ['brass', cyl(0.025, 0.025, 0.06, 0, 2.11, 0, 12), true],
        ['ink', cyl(0.003, 0.003, 0.70, 0, 2.15, 0, 6), true],
      ], TX + dx, 0, TZ, 0, 35.80);
    }
    lights.push({ p: V(TX, 1.82, TZ), k: 1.05, g: 'kd' });
  }

  // Zone 3: the living room in bay B, behind the sliding door to the balcony (weeks 36.0 to 37.7)
  const SX = 9.9, SZ = -5.2, CX = 12.2, CZ = -5.3;
  // 1. Large woven wool rug under the living group (Wk 36.00)
  piece(drawn, [
    ['rugM', rb(4.8, 0.022, 3.6, 0.008, 0, 0.014, 0, 2)],
    ['sofaDark', bx(4.84, 0.012, 0.04, 0, 0.009, -1.8), true],
    ['sofaDark', bx(4.84, 0.012, 0.04, 0, 0.009, 1.8), true],
  ], 12.0, 0.003, CZ, 0, 36.00);

  // 2. L-shaped modular boucle sofa, its back to the hall, looking out over the balcony to the lake (Wk 36.20)
  const bigSofa = () => {
    const L = [
      ['steel', bx(3.46, 0.055, 0.88, 0, 0.028, 0), true],
      ['steel', bx(0.92, 0.055, 0.56, -1.11, 0.028, 0.72), true],
      ['sofa', rb(3.68, 0.18, 1.06, 0.06, 0, 0.14, 0)],
      ['sofa', rb(1.10, 0.18, 0.70, 0.06, -1.11, 0.14, 0.77)],
      ['sofa', rb(0.26, 0.56, 1.06, 0.09, -1.74, 0.31, 0)],
      ['sofa', rb(0.26, 0.56, 1.06, 0.09, 1.74, 0.31, 0)],
      ['sofa', rb(3.48, 0.54, 0.24, 0.09, 0, 0.48, -0.41)],
    ];
    L.push(['sofa', rb(1.10, 0.20, 1.54, 0.085, -1.11, 0.31, 0.36)]);
    L.push(['sofa', rb(1.10, 0.20, 0.88, 0.085, 0.0, 0.31, 0.06)]);
    L.push(['sofa', rb(1.10, 0.20, 0.88, 0.085, 1.11, 0.31, 0.06)]);
    for (const x of [-1.11, 0, 1.11]) {
      const b = rb(1.06, 0.46, 0.22, 0.095, 0, 0, 0);
      b.rotateX(-0.16); b.translate(x, 0.62, -0.25);
      L.push(['sofa', b, true]);
    }
    for (const [mat, x, z, w, h, rx, rz] of [
      ['cushionA', -1.36, -0.10, 0.48, 0.42, -0.24, 0.14],
      ['cushionC', -0.96, -0.06, 0.44, 0.38, -0.28, -0.08],
      ['cushionB', -0.08, -0.08, 0.46, 0.40, -0.25, 0.06],
      ['cushionC', 1.02, -0.08, 0.45, 0.39, -0.26, -0.07],
      ['cushionA', 1.38, -0.06, 0.48, 0.42, -0.22, -0.15],
    ]) {
      const c = rb(w, h, 0.15, 0.065, 0, 0, 0);
      c.rotateX(rx); c.rotateZ(rz); c.translate(x, 0.56, z);
      L.push([mat, c, true]);
    }
    const bolsterG = new THREE.CylinderGeometry(0.085, 0.085, 0.64, segs(20, 8));
    bolsterG.rotateZ(Math.PI / 2); bolsterG.rotateY(0.18); bolsterG.translate(-1.12, 0.47, 0.38);
    L.push(['cushionB', bolsterG, true]);
    return L;
  };
  piece(drawn, bigSofa(), SX, 0, SZ, R90, 36.20);

  // 3. Twin-pedestal travertine coffee table and styled objects (Wk 36.48)
  const twinTable = () => {
    const topSlab = rb(1.66, 0.055, 0.88, 0.025, 0, 0.335, 0);
    const L = [
      ['travertine', cyl(0.22, 0.22, 0.31, -0.44, 0.0, -0.04, 28)],
      ['travertine', cyl(0.18, 0.18, 0.31, 0.46, 0.0, 0.05, 28)],
      ['travertine', topSlab],
      ['book1', rb(0.36, 0.042, 0.27, 0.006, -0.44, 0.383, 0.08), true],
      ['book2', rb(0.32, 0.036, 0.24, 0.006, -0.43, 0.422, 0.08), true],
      ['book0', rb(0.28, 0.032, 0.21, 0.006, -0.42, 0.456, 0.07), true],
      ['brass', sph(0.038, 16, 12).translate(-0.42, 0.51, 0.07), true],
      ['ceramic', lathe([[0, 0], [0.09, 0], [0.12, 0.07], [0.105, 0.22], [0.055, 0.32], [0.05, 0.38], [0.065, 0.40], [0, 0.40]], 0.38, 0.36, -0.10), true],
      ['terracotta', lathe([[0, 0], [0.11, 0], [0.18, 0.05], [0.19, 0.085], [0.175, 0.085], [0.10, 0.02], [0, 0.02]], 0.04, 0.36, 0.16), true],
    ];
    for (let i = 0; i < 6; i++) {
      const a = -0.6 + i * 0.25, l = 0.45 + rnd() * 0.25;
      L.push(['bark', tube(V(0.38, 0.68, -0.10), V(0.38 + Math.sin(a) * l * 0.5, 0.68 + l, -0.10 + Math.cos(a * 2) * 0.12), 0.005, 5), true]);
      const leaves = canopy([[0.38 + Math.sin(a) * l * 0.42, 0.68 + l * 0.82, -0.10, 0.09, 0.16, 0.07, 36]], 0.012, 0.022);
      L.push(['olive', leaves, true]);
    }
    return L;
  };
  piece(drawn, twinTable(), CX, 0, CZ, R90, 36.48);

  // 4. Pair of walnut and saddle-leather lounge chairs across the table (Wk 36.72 & 36.88)
  piece(drawn, loungeChair(), 14.1, 0, -6.3, Math.atan2(CX - 14.1, CZ + 6.3), 36.72);
  piece(drawn, loungeChair(), 14.2, 0, -5.0, Math.atan2(CX - 14.2, CZ + 5.0), 36.88);

  // 5. Fluted walnut and travertine credenza along the north wall (Wk 37.02)
  const credenza = () => {
    const L = [
      ['ink', bx(3.84, 0.07, 0.42, 0, 0.035, 0), true],
      ['walnut', rb(4.0, 0.48, 0.48, 0.02, 0, 0.31, 0)],
      ['travertine', rb(4.04, 0.035, 0.50, 0.01, 0, 0.565, 0)],
      ['ceramic', lathe([[0, 0], [0.12, 0], [0.15, 0.12], [0.10, 0.38], [0.06, 0.50], [0.07, 0.52], [0, 0.52]], -1.4, 0.58, 0), true],
      ['terracotta', lathe([[0, 0], [0.10, 0], [0.13, 0.10], [0.07, 0.28], [0.08, 0.30], [0, 0.30]], -1.08, 0.58, 0.04), true],
      ['book0', rb(0.32, 0.05, 0.24, 0.005, 0.18, 0.605, 0), true],
      ['book3', rb(0.28, 0.045, 0.22, 0.005, 0.18, 0.652, 0), true],
      ['ceramic', lathe([[0, 0], [0.085, 0], [0.105, 0.10], [0.065, 0.28], [0.025, 0.32], [0, 0.32]], 1.45, 0.58, 0), true],
      ['shade', lathe([[0.18, 0], [0.13, 0.24], [0.125, 0.24], [0.175, 0]], 1.45, 0.86, 0), true],
    ];
    return L;
  };
  piece(drawn, credenza(), 12.55, 0, -7.42, 0, 37.02);
  lights.push({ p: V(14.0, 1.05, -7.3), k: 0.75, g: 'lv' });

  // 6. Travertine and brass side table with a warm lamp between the lounge chairs (Wk 37.14)
  piece(drawn, [
    ['travertine', cyl(0.11, 0.14, 0.48, 0, 0, 0, 24)],
    ['travertine', cyl(0.24, 0.24, 0.045, 0, 0.48, 0, 28)],
    ['brass', cyl(0.08, 0.09, 0.22, 0, 0.525, 0, 20), true],
    ['shade', lathe([[0.16, 0], [0.12, 0.22], [0.115, 0.22], [0.155, 0]], 0, 0.72, 0), true],
  ], 14.8, 0, -5.68, 0, 37.14);
  lights.push({ p: V(14.8, 0.88, -5.68), k: 0.85, g: 'lv' });

  // 7. Brass and travertine arc floor lamp reaching over the sofa from behind (Wk 37.24)
  {
    const a = V(0, 0.05, 0), c = new THREE.QuadraticBezierCurve3(a, V(0.15, 2.55, 0.2), V(0.95, 2.02, 1.0));
    const t = new THREE.TubeGeometry(c, Math.round(40 * QL.cyl), 0.014, segs(10, 5), false);
    piece(drawn, [
      ['travertine', cyl(0.20, 0.21, 0.07, 0, 0, 0, 28), true],
      ['brass', t, true],
      ['shade', sph(0.24, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.1).scale(1, 0.7, 1).translate(0.95, 1.90, 1.0), true],
    ], 8.95, 0, -7.32, 0, 37.24);
    lights.push({ p: V(9.9, 1.75, -6.32), k: 1.15, g: 'lv' });
  }

  // 8. Large framed artwork on the north wall above the credenza (Wk 37.32)
  piece(drawn, [
    ['walnut', rb(1.36, 1.81, 0.045, 0.006, 0, 0, -0.005, 2)],
    ['art', bx(1.28, 1.73, 0.04, 0, 0, 0.005), true],
  ], 12.2, 1.72, -7.66, 0, 37.32);

  // 9. Olive tree in the corner of the glass, a ficus by the dining window, sheer linen at the ends of each glass front (Wk 37.42 to 37.54)
  {
    const L = [
      ['terracotta', lathe([[0, 0], [0.27, 0], [0.34, 0.52], [0.36, 0.58], [0.33, 0.58], [0.29, 0.52], [0, 0.52]], 0, 0, 0)],
      ['soilPot', cyl(0.30, 0.30, 0.02, 0, 0.52, 0, 24), true],
    ];
    const tr = []; let p = V(0, 0.52, 0);
    for (let i = 0; i < 5; i++) { const q = p.clone().add(V((rnd() - 0.5) * 0.18, 0.26, (rnd() - 0.5) * 0.18)); tr.push(tube(p, q, 0.058 - i * 0.008, 8)); p = q; }
    for (const [dx, dz] of [[-0.42, 0.2], [-0.3, 0.3], [0.1, 0.36]]) tr.push(tube(p, p.clone().add(V(dx, 0.36, dz)), 0.028, 6));
    L.push(['bark', merge(tr), true]);
    L.push(['olive', canopy([[-0.1, 2.12, 0.12, 0.62, 0.44, 0.6, 260], [-0.42, 2.3, 0.2, 0.42, 0.3, 0.4, 110], [0.05, 2.34, 0.36, 0.4, 0.3, 0.4, 100]], 0.045, 0.09), true]);
    piece(drawn, L, 15.02, 0, -7.12, 0.4, 37.42);
  }
  piece(drawn, [
    ['ceramic', lathe([[0, 0], [0.20, 0], [0.24, 0.42], [0, 0.42]], 0, 0, 0)],
    ['bark', tube(V(0, 0.40, 0), V(0.05, 1.32, 0.03), 0.025, 6), true],
    ['leaf', canopy([[0.05, 1.48, 0, 0.45, 0.55, 0.45, 70]], 0.09, 0.16), true],
  ], 16.95, 0, 3.12, 0, 37.48);

  for (const [x, z0, z1, y0, y1] of [[DOOR.x - 0.22, -7.62, -6.84, 0.02, 2.82], [17.28, 2.86, 3.62, 0.02, 2.82], [17.18, -7.62, -6.9, 3.22, 7.16], [15.98, 2.9, 3.62, 3.22, 6.02]]) {
    const g = new THREE.PlaneGeometry(z1 - z0, y1 - y0, 40, 1); g.rotateY(Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i) + (z0 + z1) / 2;
      p.setXYZ(i, x + 0.042 * Math.sin((z - z0) * 26), p.getY(i) + (y0 + y1) / 2, z);
    }
    g.computeVertexNormals(); stamp(g, FW(37.54)); (real['sheer@l'] || (real['sheer@l'] = [])).push(g.toNonIndexed());
  }

  // From here on the weeks are the real ones: the terrace, the planting and the pool level close the programme.
  sched = (w) => w;
  // 10. The pool terrace: teak and linen sunloungers, a drum table, an olive in a stone planter (Wk 37.42 to 37.48)
  const TY = -3.16;
  for (const z of [0.55, 1.95]) {
    const L = [
      ['teak', rb(1.96, 0.065, 0.74, 0.02, 0, 0.29, 0)],
      ['sofa', rb(1.32, 0.095, 0.68, 0.04, 0.2, 0.37, 0)],
    ];
    const back = rb(0.62, 0.095, 0.68, 0.04, 0, 0, 0);
    back.rotateZ(-0.72); back.translate(-0.72, 0.58, 0); L.push(['sofa', back]);
    for (const sx of [-0.84, 0.84]) for (const sz of [-0.31, 0.31]) L.push(['teak', cyl(0.024, 0.03, 0.27, sx, 0, sz, 10), true]);
    piece(drawn, L, 19.85, TY, z, 0, 37.42);
  }
  piece(drawn, [['travertine', cyl(0.24, 0.24, 0.36, 0, 0, 0, 28)]], 19.6, TY, 1.25, 0, 37.44);

  piece(drawn, [
    ['travertine', rb(0.92, 0.62, 0.92, 0.03, 0, 0.31, 0)],
    ['soilPot', bx(0.84, 0.02, 0.84, 0, 0.61, 0), true],
    ['bark', merge([tube(V(0, 0.6, 0), V(0.1, 1.6, 0.05), 0.07, 7), tube(V(0.1, 1.6, 0.05), V(0.45, 2.2, 0.2), 0.04, 6), tube(V(0.1, 1.6, 0.05), V(-0.3, 2.3, -0.1), 0.04, 6)]), true],
    ['olive', canopy([[0, 2.4, 0, 1.0, 0.6, 0.9, 340], [0.4, 2.7, 0.2, 0.6, 0.4, 0.6, 140]], 0.05, 0.1), true],
  ], 20.5, TY, -7.1, 0, 37.48);

  // 11. Planting, as in the concept: troughs on the balcony and the upper terrace, a green fringe on both roofs,
  // rosemary and lavender banks either side of the pool (Wk 37.46 to 37.54)
  const trough = (x, y, z, w, d, week, h = 0.42) => {
    const n = Math.max(1, Math.round(Math.max(w, d) / 0.9)), cl = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      cl.push([w > d ? t * (w - 0.5) : 0, h + 0.2, w > d ? 0 : t * (d - 0.5), w > d ? 0.5 : w * 0.5, 0.26, w > d ? d * 0.5 : 0.5, 70]);
    }
    piece(drawn, [
      ['travertine', rb(w, h, d, 0.02, 0, h / 2, 0)],
      ['soilPot', bx(w - 0.08, 0.02, d - 0.08, 0, h - 0.005, 0), true],
      ['olive', canopy(cl, 0.05, 0.1), true],
    ], x, y, z, 0, week);
  };
  trough(18.62, 0, -7.2, 0.8, 1.2, 37.46);              // balcony, by the north wall
  trough(17.25, UP, 1.15, 0.6, 4.6, 37.50);             // upper terrace, in front of the lounge glass
  piece(real, [
    ['leaf', canopy([[16.0, 6.98, 1.2, 0.5, 0.2, 2.6, 240], [19.75, 7.78, -4.7, 0.5, 0.2, 2.9, 260]], 0.06, 0.13), true],
    ['olive', canopy([[15.2, 6.95, 0.4, 0.7, 0.16, 2.2, 160], [18.9, 7.74, -5.4, 0.7, 0.16, 2.2, 160]], 0.05, 0.11), true],
  ], 0, 0, 0, 0, 37.54);
  {
    const banks = [];
    for (const [x, z, rx, rz, nn] of [[23.5, -9.4, 2.8, 0.8, 220], [26.8, -9.0, 2.0, 0.7, 160], [24.2, 5.4, 3.0, 0.8, 220], [27.6, 5.2, 1.6, 0.7, 130], [29.9, -2.0, 0.8, 4.6, 260]]) {
      banks.push([x, natural(x, z) + 0.3, z, rx, 0.36, rz, nn]);
    }
    piece(real, [['olive', canopy(banks, 0.06, 0.12), true]], 0, 0, 0, 0, 37.52);
  }

  // ================================================================ POOL LEVEL (y = -3.20): LOUNGE, SAUNA, BILLIARDS (weeks 36.2 to 37.4)
  // The third floor of the walk. The camera comes down the lower flight, finds the lounge in front of the media wall,
  // turns to the sauna and the billiard table in bay A, and leaves through the sliding door onto the pool terrace.
  {
    const Y0 = -3.2;
    // P1. Rug of the lounge (Wk 36.22), the sofa facing the media wall (Wk 36.36), the table (Wk 36.5)
    piece(drawn, [
      ['rugM', rb(4.8, 0.022, 3.4, 0.008, 0, 0.014, 0, 2)],
    ], 13.7, Y0 + 0.003, -5.35, 0, 36.22);
    piece(drawn, bigSofa(), 13.6, Y0, -3.95, Math.PI, 36.36);
    piece(drawn, twinTable(), 13.5, Y0, -5.55, 0, 36.50);
    // P2. Low credenza under the screen, with its lamp (Wk 36.6); two lounge chairs towards the glass (Wk 36.68 & 36.74)
    piece(drawn, credenza(), 13.8, Y0, -7.36, 0, 36.60);
    lights.push({ p: V(15.25, Y0 + 1.05, -7.2), k: 0.8, g: 'pl' });
    piece(drawn, loungeChair(), 16.7, Y0, -6.35, Math.atan2(13.5 - 16.7, -5.55 + 6.35), 36.68);
    piece(drawn, loungeChair(), 10.6, Y0, -6.2, Math.atan2(13.5 - 10.6, -5.55 + 6.2), 36.74);
    // P3. Olive in a pot by the corner of the glass (Wk 36.78)
    piece(drawn, [
      ['terracotta', lathe([[0, 0], [0.22, 0], [0.28, 0.44], [0.29, 0.48], [0, 0.44]], 0, 0, 0)],
      ['soilPot', cyl(0.25, 0.25, 0.02, 0, 0.44, 0, 20), true],
      ['bark', merge([tube(V(0, 0.44, 0), V(0.06, 1.35, 0.04), 0.042, 7), tube(V(0.06, 1.35, 0.04), V(0.32, 1.82, 0.16), 0.026, 6), tube(V(0.06, 1.35, 0.04), V(-0.24, 1.86, -0.12), 0.026, 6)]), true],
      ['olive', canopy([[0, 1.95, 0, 0.62, 0.4, 0.6, 170], [0.3, 2.12, 0.15, 0.4, 0.3, 0.4, 80]], 0.045, 0.085), true],
    ], 17.45, Y0, -2.25, 0.3, 36.78);
    // P4. The sauna (built in, world.js) is lit from inside once it stands (Wk 37.0)
    lights.push({ p: V(5.7, Y0 + 1.85, 2.4), k: 0.7, g: 'pl' });
    // P5. Billiards: the balls on the cloth (Wk 37.24) and three brass pendants over the table (Wk 37.3)
    {
      const BX = 12.4, BZ = 1.05, by = 0.8 + 0.012 + 0.029, B = [];
      const ball = (mat, x, z) => { const g = sph(0.029, 14, 10); g.translate(x, by, z); B.push([mat, g, true]); };
      ball('ceramic', -0.78, 0.04);
      let n = 0;
      for (let r = 0; r < 4; r++) for (let c = 0; c <= r; c++) ball(['terracotta', 'brass', 'ink', 'cushionA', 'cushionB'][n++ % 5], 0.52 + r * 0.052, (c - r / 2) * 0.06);
      piece(real, B, BX, Y0, BZ, 0, 37.24);
      for (const dx of [-0.8, 0, 0.8]) {
        piece(real, [
          ['ink', cyl(0.003, 0.003, 0.68, 0, 2.17, 0, 6), true],
          ['brass', cyl(0.035, 0.055, 0.22, 0, 1.96, 0, 16), true],
          ['shade', cyl(0.048, 0.048, 0.02, 0, 1.95, 0, 16), true],
        ], BX + dx, Y0, BZ, 0, 37.30);
      }
      lights.push({ p: V(BX, Y0 + 1.85, BZ), k: 1.0, g: 'pl' });
    }
    // P6. A bench of two lounge chairs by the glass of bay A, turned to the pool (Wk 37.36)
    piece(drawn, loungeChair(), 15.6, Y0, 0.3, Math.PI / 2, 37.36);
    piece(drawn, loungeChair(), 15.6, Y0, 1.8, Math.PI / 2, 37.38);
  }

  // ---------------------------------------------------------------- the two sliding doors: living room to balcony, pool level to terrace
  const slider = (D, week) => {
    const door = new THREE.Group();
    const hw = D.w / 2 - 0.025, H = D.h - 0.09;
    const F = [bx(0.05, H, 0.05, 0, 0.045 + H / 2, -hw), bx(0.05, H, 0.05, 0, 0.045 + H / 2, hw), bx(0.05, 0.05, D.w, 0, 0.07, 0), bx(0.05, 0.05, D.w, 0, D.h - 0.07, 0), bx(0.035, 0.045, 0.22, -0.045, 1.1, hw - 0.14)];
    const f = merge(F); stamp(f, week); addMesh(door, f, { main: R.steel, paper: null, nd: null });
    const g = bx(0.018, H - 0.1, D.w - 0.1, 0, 0.045 + H / 2, 0); stamp(g, week); addMesh(door, g, { main: R.glass, paper: null, nd: null }, { glass: true, shadow: false });
    door.position.set(D.x, D.y, D.zc); group.add(door);
    return door;
  };
  const door = slider(DOOR, 23.3), door0 = slider(DOOR0, 23.75);

  // ---------------------------------------------------------------- the sloped handrail of the upper flight, steel on slim posts
  {
    const H = [], zs = -6.55, ze = -1.75, x = 5.16;
    H.push(tube(V(x, 1.0, zs), V(x, 4.2, ze), 0.02, 8));
    for (let i = 0; i <= 6; i++) { const z = zs + (ze - zs) * (i / 6) + (i === 6 ? -0.04 : 0.04), y = 3.2 * (z - zs) / (ze - zs); H.push(tube(V(x, y, z), V(x, y + 1.0, z), 0.012, 6)); }
    const h = merge(H); stamp(h, 24.2); addMesh(group, h, { main: R.steel, paper: null, nd: null });
  }

  // ---------------------------------------------------------------- engineered scaffold stair from the bank up to the balcony
  // It stands in front of the door, climbs the 4.7 m from the ground to the edge of the living level slab,
  // and is struck in week 29 when the terrace and the pool are about to take its place.
  {
    const T = [], B = [];
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const stTube = (a, b, r, seg, w0, w1, o0 = 29.3, o1 = 29.9) => {
      const g = tube(a, b, r, seg);
      const ab = b.clone().sub(a), lenSq = Math.max(1e-6, ab.lengthSq());
      stamp(g, (x, y, z) => {
        const u = clamp01(((x - a.x) * ab.x + (y - a.y) * ab.y + (z - a.z) * ab.z) / lenSq);
        return w0 + (w1 - w0) * u;
      }, (x, y, z) => {
        const u = clamp01(((x - a.x) * ab.x + (y - a.y) * ab.y + (z - a.z) * ab.z) / lenSq);
        return o1 + (o0 - o1) * u;
      });
      T.push(g);
    };
    const stBox = (w, h, d, cx, cy, cz, w0, w1, ax = 0, o0 = 29.2) => {
      const g = bx(w, h, d, cx, cy, cz);
      const lo = [cx - w / 2, cy - h / 2, cz - d / 2][ax], span = Math.max(1e-5, [w, h, d][ax]);
      stamp(g, (x, y, z) => w0 + (w1 - w0) * clamp01(([x, y, z][ax] - lo) / span), o0);
      B.push(g);
    };

    const S = STAIR, zc = S.z, zA = zc - S.half, zB = zc + S.half, x0 = S.x0, x1 = S.x1, y0 = S.y0, y1 = 0, n = 26;
    const stepX = (x0 - x1) / n, stepY = (y1 - y0) / n;
    // 26 treads ripple from the bottom step up to the landing
    for (let i = 0; i < n; i++) {
      const u = i / n, wStep = 10.36 + u * 0.44;
      stBox(stepX + 0.02, 0.04, zB - zA - 0.02, x0 - (i + 0.5) * stepX, y0 + (i + 1) * stepY - 0.02, zc, wStep, wStep + 0.06, 0, 29.15 + (1 - u) * 0.35);
    }
    for (const z of [zA - 0.03, zB + 0.03]) {
      const zOff = z > zc ? 0.03 : 0;
      // inclined stringers shoot up from the sole pad to the landing, then the mid and top guardrails
      stTube(V(x0 + 0.1, y0 + 0.05, z), V(x1, y1 - 0.05, z), 0.032, 8, 10.06 + zOff, 10.42 + zOff);
      stTube(V(x0, y0 + 0.52, z), V(x1, y1 + 0.52, z), 0.02, 8, 10.54 + zOff, 10.86 + zOff);
      stTube(V(x0, y0 + 1.02, z), V(x1, y1 + 1.02, z), 0.024, 8, 10.60 + zOff, 10.94 + zOff);
      for (const t of [0, 1 / 3, 2 / 3, 1]) {
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, yn = natural(x, z);
        const wSole = 9.72 + (1 - t) * 0.2 + zOff;
        // the sole board lands on the compacted ground first, then the standard grows up from it
        stBox(0.22, 0.04, 0.22, x, yn + 0.02, z, wSole, wSole + 0.06, 1, 29.85);
        stTube(V(x, yn, z), V(x, y + 1.06, z), 0.024, 8, wSole + 0.05, wSole + 0.52);
      }
    }
    // cross transoms under the flight
    for (const t of [0, 1 / 3, 2 / 3, 1]) {
      const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      const wTr = 9.98 + (1 - t) * 0.22;
      stTube(V(x, y - 0.05, zA - 0.03), V(x, y - 0.05, zB + 0.03), 0.022, 8, wTr, wTr + 0.08);
    }
    // a short landing between the flight and the edge of the balcony: planks, standards, guardrails, braces, toe boards
    const lx0 = S.xl, lx1 = x1;
    for (let x = lx0; x < lx1 - 0.01; x += 0.2) stBox(0.19, 0.04, zB - zA + 0.1, x + 0.1, -0.02, zc, 10.20 + (x - lx0) * 0.1, 10.26 + (x - lx0) * 0.1, 2, 29.25);
    for (const z of [zA - 0.03, zB + 0.03]) {
      const zOff = z > zc ? 0.03 : 0, x = lx0 + 0.12, yn = natural(x, z);
      stBox(0.22, 0.04, 0.22, x, yn + 0.02, z, 9.80 + zOff, 9.86 + zOff, 1, 29.85);
      stTube(V(x, yn, z), V(x, 1.06, z), 0.024, 8, 9.84 + zOff, 10.36 + zOff);
      stTube(V(x, yn + 0.25, z), V(lx1, -0.12, z), 0.02, 8, 9.96 + zOff, 10.26 + zOff);
      for (const h of [0.52, 1.02]) stTube(V(lx0, h, z), V(lx1, h, z), 0.022, 8, 10.50 + zOff, 10.66 + zOff);
      stBox(lx1 - lx0, 0.15, 0.03, (lx0 + lx1) / 2, 0.075, z, 10.44, 10.60, 0, 29.20);
    }
    stTube(V(lx0 + 0.12, -0.06, zA - 0.03), V(lx0 + 0.12, -0.06, zB + 0.03), 0.022, 8, 10.14, 10.22);
    stTube(V(lx0 + 0.12, -1.7, zA - 0.03), V(lx0 + 0.12, -1.7, zB + 0.03), 0.022, 8, 10.04, 10.12);
    const t = merge(T); addMesh(group, t, { main: R.galv, paper: null, nd: null });
    const b = merge(B); worldUV(b); addMesh(group, b, { main: R.timber, paper: null, nd: null });
  }

  // ---------------------------------------------------------------- material stacks on site
  {
    // a bundle of reinforcing bars on timber bearers, on the flat below the bank
    const L = [], rx = 27.7, rz = 10.0, ry = natural(rx, rz);
    for (let i = 0; i < 40; i++) {
      const g = new THREE.CylinderGeometry(0.008, 0.008, 6, QL.treeLow ? 3 : 5);
      g.rotateX(Math.PI / 2);
      g.translate(rx + Math.floor(i / 5) * 0.022, ry + 0.12 + (i % 5) * 0.018, rz + (rnd() - 0.5) * 0.04);
      L.push(g);
    }
    const r = merge(L); stamp(r, 1.5, 8); addMesh(group, r, { main: R.rebar, paper: null, nd: null });
    const be = merge([bx(0.5, 0.1, 0.1, rx + 0.08, ry + 0.05, rz - 1.8), bx(0.5, 0.1, 0.1, rx + 0.08, ry + 0.05, rz + 1.8)]);
    stamp(be, 1.5, 8); addMesh(group, be, { main: R.timber, paper: null, nd: null });
    // pallets of masonry blocks beside the track (they arrive once the backfill is up to grade)
    const P = [], K = [];
    const pallets = [[26.9, -10.4], [28.2, -10.4], [26.9, -11.7]];
    for (let pi = 0; pi < pallets.length; pi++) {
      const [px, pz] = pallets[pi], wPal = 9.65 + pi * 0.14, py = natural(px, pz);
      const pg0 = bx(1.2, 0.14, 1.0, px, py + 0.07, pz);
      stamp(pg0, (x, y) => wPal + 0.06 * Math.max(0, Math.min(1, (y - py) / 0.14)), 21 - pi * 0.15);
      P.push(pg0);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 4; c++) {
        const bg0 = bx(0.42, 0.2, 0.2, px - 0.36 + a * 0.44 * 0.82, py + 0.14 + 0.1 + b * 0.205, pz - 0.36 + c * 0.24);
        const wBlk = wPal + 0.08 + b * 0.12 + (a * 4 + c) * 0.015;
        stamp(bg0, (x, y) => wBlk + 0.05 * Math.max(0, Math.min(1, (y - (py + 0.14 + b * 0.205)) / 0.2)), 20.8 - pi * 0.15);
        K.push(bg0);
      }
    }
    const pg = merge(P); worldUV(pg); addMesh(group, pg, { main: R.timber, paper: null, nd: null });
    const kg = merge(K); worldUV(kg); addMesh(group, kg, { main: R.block, paper: null, nd: null });
  }

  // Merge. On site every material of a floor is one mesh, whether the sheet draws the piece or not. For the sheet the
  // drawn pieces of a floor are one mesh of their own: the drawing uses the same two materials for all of them
  // (DM.ndFurn gives Tile 06 its delicate interior line weight).
  const keys = [...new Set([...Object.keys(drawn), ...Object.keys(real)])];
  for (const key of keys) {
    const k = key.split('@')[0];
    addMesh(group, merge([...(drawn[key] || []), ...(real[key] || [])]), { main: R[k], paper: null, nd: null }, { shadow: k !== 'sheer' && k !== 'rugM' });
  }
  for (const zone of ['u', 'l', 'p']) {
    const list = Object.keys(drawn).filter((key) => key.endsWith('@' + zone)).flatMap((key) => drawn[key]);
    if (!list.length) continue;
    const g = merge(list.map((q) => { const c = q.clone(); c.deleteAttribute('color'); c.deleteAttribute('uv'); return c; }));
    addMesh(group, g, { main: null, paper: DM.paper, nd: DM.ndFurn });
  }
  group.userData.door = door; group.userData.door0 = door0; group.userData.lights = lights;
  return group;
}

// Projekt Steininger: one scroll through thirty-eight weeks.
// The loader is the programme being written. The sheet draws itself week by week (all six drawings at once,
// each stopping at its own week). Scroll dives into drawing 01 down to the edge of the excavation, then walks
// the site while the house goes up, climbs the scaffold stair to the balcony, enters the forest of props at week 18,
// rises through the hall as the props are struck, and watches three floors being furnished from the top down:
// the upper level, the living level, then down the stair to the pool level. It leaves through the sliding door
// onto the pool terrace, turns to look back at the house at handover in week 38, and backs away over the pool
// until the house is drawing 06 again.
//   ?v=12.5  jump to a scroll position in screen heights      ?still   skip the loader and the drawing, for stills
//   ?offline  the page runs on a virtual clock that is stepped one frame at a time
//   ?q=low|mid|high  force the device tier      ?dpr=1.5  pin the resolution (js/quality.js)
//
// What a frame costs. Nothing is rendered unless something moved: the scroll, the drawing of the sheet, the slices
// of the site building itself. The resolution follows the frame time (the governor in js/quality.js), the shadow
// map is only redrawn when the week moves, and a phone or tablet renders the site straight to the canvas.
import * as THREE from 'three';
import { makeTextures, makeMaterials, buildWorld, setLevel, U, PROG, TILES, WEEKS, V, natural, propsAt, DOOR, DOOR0, STAIR, PAL, PAPER, FW } from './world.js';
import { buildStage } from './stage.js';
import { makePipe, aim } from './pipe.js';
import { tier, low, high, governor, visible, isTouch } from './quality.js';

const SEQ = window.SEQ, pad = SEQ.pad;
const Q = new URLSearchParams(location.search);
const STILL = Q.has('still'), OFFLINE = Q.has('offline');
const calm = () => SEQ.prefs.calm; // the view option, or the system's reduced motion setting (js/access.js)
// Desktop: the site goes through the composer (ambient occlusion, sun shafts) at up to 1.5 device pixels.
// Phone and tablet: no post processing, so the site is one pass straight to the canvas with the canvas's own multisampling.
const DIRECT = !high;
setLevel(tier);
document.documentElement.dataset.tier = tier;
let DPR = 1, DPR_REAL = 1;
const raf = () => new Promise((r) => requestAnimationFrame(r));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const setP = (p) => { SEQ.real = true; SEQ.progress = Math.max(SEQ.progress, p); };
const C = (h) => new THREE.Color(h);

// ---------------------------------------------------------------- boot
const canvas = document.getElementById('gl');
// The size of the picture is the size of the canvas on the page (100vw by 100lvh), not of the window: on a phone the
// window grows and shrinks as the URL bar slides, the canvas does not, so nothing is stretched or reallocated.
const boxSize = () => [canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight];
const renderer = new THREE.WebGLRenderer({ canvas, antialias: DIRECT, stencil: false, powerPreference: 'high-performance' });
renderer.setSize(...boxSize(), false);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.setClearColor(PAPER, 1);
setP(0.34); await raf();

// sky, sun, haze. Crisp morning while the house goes up, warm golden hour by handover.
// The glass looks east. Morning sun comes over the lake from the north-east, swings south for the weeks under the props,
// and ends low in the south-east so the rooms glow at handover.
const SUN_AM = V(0.62, 0.42, -0.66).normalize(), SUN_MID = V(0.50, 0.30, 0.81).normalize(), SUN_PM = V(0.74, 0.25, 0.62).normalize();
const SKY = { am: { zen: C('#b9d2e2'), hor: C('#dfe9ef'), glow: C('#ffe9c8') }, pm: { zen: C('#b0c3d3'), hor: C('#ecdfc9'), glow: C('#ffd3a0') } };
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { uSun: { value: SUN_AM.clone() }, uZen: { value: SKY.am.zen.clone() }, uHor: { value: SKY.am.hor.clone() }, uGlow: { value: SKY.am.glow.clone() }, uGround: { value: C('#8b8a82') }, uEnv: { value: 0 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform vec3 uSun, uZen, uHor, uGlow, uGround; uniform float uEnv; varying vec3 vD;
    void main(){ vec3 d = normalize(vD); float h = d.y;
      vec3 c = mix(uHor, uZen, pow(smoothstep(-.02, .55, h), .5));
      vec2 q = d.xz / max(d.y + .06, .02) * 1.6 + vec2(3.1, 7.4);
      float n = 0., a = .55; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 5; i++) { vec2 f = fract(q), ip = floor(q); f = f * f * (3. - 2. * f);
        float h00 = fract(sin(dot(ip, vec2(127.1, 311.7))) * 43758.5), h10 = fract(sin(dot(ip + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5);
        float h01 = fract(sin(dot(ip + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5), h11 = fract(sin(dot(ip + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5);
        n += a * mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y); q = m * q; a *= .5; }
      float cl = smoothstep(.56, .82, n) * smoothstep(.0, .06, h) * (1. - smoothstep(.25, .6, h)) * (1. - uEnv);
      c = mix(c, mix(uHor * 1.06, vec3(1.), .5) * (.92 + .1 * smoothstep(.6, .9, n)), cl * .85);
      float s = max(dot(d, uSun), 0.);
      c += uGlow * (pow(s, 5.) * .32 + pow(s, 64.) * .5) * smoothstep(-.1, .2, h);
      if (uEnv > .5) c = mix(uGround, c, smoothstep(-.06, .02, h));
      gl_FragColor = vec4(c, 1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), skyMat);
sky.scale.setScalar(2400); sky.renderOrder = -1; sky.frustumCulled = false;
sky.userData.sets = { main: skyMat, paper: null, nd: null }; sky.userData.sky = true;

// reflections come from the same sky, with the earth below the horizon
const envScene = new THREE.Scene(); envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 48, 24), skyMat));
skyMat.uniforms.uEnv.value = 1;
const ENV = new THREE.PMREMGenerator(renderer).fromScene(envScene, 0.02).texture;
skyMat.uniforms.uEnv.value = 0;
const T = makeTextures(renderer);
setP(0.48); await raf();
const R = makeMaterials(T, ENV);
const scene = new THREE.Scene();
scene.add(buildWorld({ R, T }));
const stage = buildStage(R);
scene.add(stage, sky);
setP(0.62); await raf();

scene.fog = new THREE.Fog(SKY.am.hor.clone(), 160, 1400);
const sun = new THREE.DirectionalLight(0xffe7cc, 3.2);
const sunAt = V(11, -2, -2);
sun.position.copy(sunAt).addScaledVector(SUN_AM, 140); sun.target.position.copy(sunAt);
// One shadow map, two frames for it: the whole site while the walk is outside, and only the house and its garden
// once it is inside, which makes the same map twice as sharp where it is looked at from a metre away.
const SHADOW_PX = high ? 4096 : 2048;
const SHADOW_BOX = { site: { at: V(11, -2, -2), r: 44 }, house: { at: V(16, 0, -2), r: 21.5 } };
sun.castShadow = true; sun.shadow.mapSize.set(SHADOW_PX, SHADOW_PX);
Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 40, far: 260 });
sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.04;
let shadowBox = 'site', shadowKey = '', shadowDirty = true, shadowAt = 0;
function setShadowBox(name) {
  if (name === shadowBox) return;
  shadowBox = name; const b = SHADOW_BOX[name], c = sun.shadow.camera;
  sunAt.copy(b.at); sun.target.position.copy(sunAt);
  c.left = -b.r; c.right = b.r; c.top = b.r; c.bottom = -b.r; c.updateProjectionMatrix();
  sun.shadow.normalBias = Math.max(0.022, Math.min(0.04, 1.9 * 2 * b.r / SHADOW_PX));
  shadowKey = '';
}
const hemi = new THREE.HemisphereLight(0xdce6ee, 0x756a5a, 0.88);
// light thrown back up off the floors and the terrace, so ceilings and soffits read as lit rooms, not as dark lids
const bounce = new THREE.DirectionalLight(0xffe9cf, 0.72);
bounce.position.set(2, -10, 1); bounce.target.position.set(0, 0, 0);
scene.add(sun, sun.target, hemi, bounce, bounce.target);
// The lamps of the rooms. Every light in the scene is paid for by every pixel, so a phone or a tablet keeps a pool of
// two or three and moves it to the rooms the walk is in (LAMP_AT: where the pool changes hands, in screen heights);
// a desktop lights all ten.
const LAMPS = stage.userData.lights, LAMP_G = ['up', 'kd', 'lv', 'pl'], LAMP_AT = [19.9, 22.4, 25.6];
const POOL = high ? LAMPS.length : low ? 2 : 3;
const lamps = Array.from({ length: POOL }, () => { const p = new THREE.PointLight(0xffc288, 0, 0, 2); scene.add(p); return p; });
const lampSets = LAMP_G.map((g) => LAMPS.filter((l) => l.g === g).sort((a, b) => b.k - a.k).slice(0, POOL));
U.real.value = 5.95;

// ---------------------------------------------------------------- cameras
const cam = new THREE.PerspectiveCamera(2, 1, 1, 2000);
let [W, H] = boxSize();
// the walking lens opens up on tall screens, so a phone held upright still sees the room
const eyeFov = () => (W / H < 0.8 ? 64 : W / H < 1.25 ? 56 : 50);
let EYE_FOV = eyeFov();
// the sheet's axonometric: centred on the whole house, from the pit at -4.3 to the roof of the tall box at +7.6,
// and from the court to the infinity edge of the pool, so no drawing ever clips its frame
const K0 = { T: V(13.85, 1.2, -0.16), az: 43.21, el: 33.52, h: 12.9, fov: 2 };
// inside drawing 01, the pit filling the screen (a narrow screen needs a taller frame to hold its width)
const K1 = { T: V(11.3, -3.2, -1.9), az: 43.21, el: 33.52, h: Math.max(8.9, 7.7 * H / W), fov: 2 };
const toK = (E, Tg, fov) => {
  const d = E.clone().sub(Tg), D = d.length();
  return { T: Tg.clone(), az: Math.atan2(d.z, d.x) * 180 / Math.PI, el: Math.asin(d.y / D) * 180 / Math.PI, h: D * Math.tan(fov * Math.PI / 360), fov };
};
const EDGE = [V(13.8, natural(13.8, 8.15) + 1.62, 8.15), V(10.6, -3.6, -2.8)];
let K3 = toK(EDGE[0], EDGE[1], EYE_FOV);
const lerpK = (a, b, t, o = {}) => {
  const tf = o.f ?? t, te = o.e ?? t, tt = o.T ?? t, th = o.h ?? t;
  return { T: a.T.clone().lerp(b.T, tt), az: lerp(a.az, b.az, te), el: lerp(a.el, b.el, te), h: lerp(a.h, b.h, th), fov: Math.exp(lerp(Math.log(a.fov), Math.log(b.fov), tf)) };
};

// ---------------------------------------------------------------- the walk: legs of keys [screen heights, eye x y z, look x y z]
const DIVE = 6; // the dive takes the first six screen heights
const EYE = 1.62, AZ = DOOR.zc; // eye height, and the axis of the sliding door: the scaffold stair, the aisle between the props
const onStair = (x) => STAIR.y0 * clamp((x - STAIR.x1) / (STAIR.x0 - STAIR.x1), 0, 1) + EYE; // eye height above the treads
const gnd = (x, z) => natural(x, z) + EYE;

// On the balcony, in the middle of the 3.7 m aisle the props leave free, then in through the door opening
const THRESHOLD = [19.05, EYE, AZ, 11.0, 1.9, AZ - 0.15];
const PROPS_MID = [16.4, 1.60, AZ, 8.6, 1.9, AZ - 0.4];
const PROPS_DEEP = [12.4, 1.60, AZ, 5.5, 2.2, -4.5];
// The hall at the back of bay B is open through both floors (x 4 to 7; the stair runs along the wall at x 4 to 5.2).
// The camera rises through it, between the stair and the edge of the upper floor, turning from the stair to the rooms.
const HALL_FOOT = [6.3, 1.64, -4.6, 5.2, 2.7, -1.2];
const HALL_RISE = [6.45, 4.78, -4.6, 12.0, 4.3, -3.9];

// Upper level (y = 3.20): from the hall, eye above the balustrade rail, the furniture arrives in the view it is turning to
const UP_NORTH = [6.45, 4.76, -3.5, 10.6, 4.15, -6.3];   // the library wall and the studio desk
const UP_MID = [6.45, 4.75, -3.0, 12.6, 4.1, -4.3];      // through the tall box to the bed, the loggia and the lake
const UP_LOUNGE = [6.45, 4.75, -2.65, 10.5, 3.95, 0.7];  // through the travertine spine into the lounge
const UP_SOUTH = [6.45, 4.74, -2.45, 10.2, 3.9, 1.2];

// Living level (y = 0.00): down through the hall, then kitchen, dining, living room, and out by the door
const HALL_EDGE = [6.0, 4.45, -3.0, 9.8, 3.5, 1.3];
const HALL_DOWN = [5.95, 1.95, -3.2, 9.0, 1.05, 1.5];
const L1_KITCHEN = [6.9, 1.56, -2.5, 9.3, 1.0, 1.9];
const L1_DINING = [9.4, 1.56, -1.7, 14.3, 0.9, 1.0];
const L1_PAN = [11.7, 1.56, 0.6, 12.9, 0.95, -5.3];      // across the living room, the door sliding open on the right
const L1_WIDE = [13.4, 1.6, -1.9, 10.2, 1.0, -5.6];

// Pool level (y = -3.20). The way down is the lower flight: along the back wall at x 4.02 to 5.2, from z -1.75 at 0.00
// down to z -6.55 at -3.20. The eye stays over the middle of the treads; the look runs ahead and swings into the room
// as the head comes under the living level slab.
const SXM = 4.61, flight = (z) => -3.2 * clamp((-1.75 - z) / 4.8, 0, 1) + 1.6;
const ST_APP = [6.2, 1.6, 0.1, 4.0, 1.0, -3.2];
const ST_PRE = [SXM, 1.6, -0.75, 4.9, 0.2, -5.0];
const ST_TOP = [SXM, flight(-1.75), -1.75, 5.2, -1.2, -6.4];
const ST_Q1 = [SXM, flight(-3.35), -3.35, 6.4, -2.2, -7.0];
const ST_Q2 = [SXM, flight(-4.95), -4.95, 8.0, -2.3, -6.9];
const ST_FOOT = [SXM, flight(-6.55), -6.55, 9.5, -2.2, -6.6];
const P0_LAND = [4.75, -1.6, -7.0, 10.5, -2.2, -6.2];
const P0_IN = [6.6, -1.62, -6.2, 12.5, -2.2, -5.9];        // the lounge in front of the media wall
const P0_LOUNGE = [8.9, -1.62, -5.4, 14.0, -2.35, -6.0];
const P0_SAUNA = [9.3, -1.62, -1.2, 5.6, -2.2, 2.3];       // the sauna in the south-west corner
const P0_BILL = [8.2, -1.62, -2.3, 12.6, -2.55, 1.0];      // the billiard table in bay A
const P0_PASS = [14.2, -1.62, -2.3, 19.5, -2.0, -3.7];     // between the sofa and the table, towards the door
const DOOR0_IN = [17.3, -1.62, -3.85, 24.0, -2.5, -3.6];   // on the axis of the open sliding door
const TERR = [19.9, -1.56, -3.5, 26.0, -2.6, -6.0];        // out on the terrace, the pool and the lake ahead
// the last frame: at the edge of the pool, turned round to the house. The pull back carries on away from it, over the water.
const HANDOVER_B = [21.0, -1.55, -0.6, 13.0, -2.0, -4.2];
const HAND = 30.6; // the scroll position of handover, in screen heights

const LEGS = [
  // Leg 0 (v = 6.0..12.2, Wk 06..18): from the pit edge down the long side, round below the bank to face the house,
  // then up the scaffold stair to the balcony while the upper walls and the roofs go on
  {
    keys: [
      [6.0, ...EDGE[0].toArray(), ...EDGE[1].toArray()],
      [6.5, 13.9, -0.71, 8.25, 10.4, -3.6, -3.0],
      [7.7, 24.2, gnd(24.2, 11.2), 11.2, 13.0, -1.2, -2.6],
      [8.9, 29.2, gnd(29.2, 5.4), 5.4, 15.5, 0.6, -2.6],
      [9.6, 28.6, gnd(28.6, AZ + 0.6), AZ + 0.6, 19.0, 1.0, AZ],
      [10.5, 27.0, gnd(27.0, AZ + 0.1), AZ + 0.1, 18.0, 2.4, AZ - 0.2],
      [11.3, 23.9, onStair(23.9), AZ, 16.5, 2.8, AZ - 0.3],
      [11.9, 20.5, onStair(20.5), AZ, 13.0, 2.2, AZ - 0.2],
      [12.2, ...THRESHOLD],
    ],
  },
  // Leg 1 (v = 12.2..15.5, Wk 18.0..19.0): in between the props, on into the hall, and up through it BEFORE the props are struck
  {
    keys: [
      [12.2, ...THRESHOLD],
      [13.2, ...PROPS_MID],
      [14.1, ...PROPS_DEEP],
      [14.8, ...HALL_FOOT],
      [15.5, ...HALL_RISE],
    ],
  },
  // Leg 2 (v = 15.5..19.4, Wk 19.0..33.6): the props are struck, glass, travertine and oak arrive, then the upper level is furnished
  {
    keys: [
      [15.5, ...HALL_RISE],
      [16.5, ...UP_NORTH],
      [17.6, ...UP_MID],
      [18.25, ...UP_LOUNGE],
      [19.4, ...UP_SOUTH],
    ],
  },
  // Leg 3 (v = 19.4..23.9): down through the hall and across the living level as it is furnished
  {
    keys: [
      [19.4, ...UP_SOUTH],
      [19.75, ...HALL_EDGE],
      [20.1, ...HALL_DOWN],
      [20.5, ...L1_KITCHEN],
      [21.65, ...L1_DINING],
      [22.8, ...L1_PAN],
      [23.9, ...L1_WIDE],
    ],
  },
  // Leg 4 (v = 23.9..26.35): back to the hall and down the lower flight to the pool level
  {
    keys: [
      [23.9, ...L1_WIDE],
      [24.6, ...ST_APP],
      [24.95, ...ST_PRE],
      [25.2, ...ST_TOP],
      [25.5, ...ST_Q1],
      [25.8, ...ST_Q2],
      [26.1, ...ST_FOOT],
      [26.35, ...P0_LAND],
    ],
  },
  // Leg 5 (v = 26.35..30.6, Wk 36.2..38.0): the pool level is furnished, the door slides open, out to the pool for handover
  {
    keys: [
      [26.35, ...P0_LAND],
      [26.85, ...P0_IN],
      [27.5, ...P0_LOUNGE],
      [28.2, ...P0_SAUNA],
      [28.75, ...P0_BILL],
      [29.3, ...P0_PASS],
      [29.7, ...DOOR0_IN],
      [30.0, ...TERR],
      [HAND, ...HANDOVER_B],
    ],
  },
];
for (const leg of LEGS) {
  const P = leg.keys.map((k) => V(k[1], k[2], k[3])), L = leg.keys.map((k) => V(k[4], k[5], k[6]));
  leg.pos = new THREE.CatmullRomCurve3(P, false, 'centripetal'); leg.look = new THREE.CatmullRomCurve3(L, false, 'centripetal');
  leg.v0 = leg.keys[0][0]; leg.v1 = leg.keys[leg.keys.length - 1][0];
}
function walkAt(v) {
  const leg = LEGS.find((l) => v <= l.v1) || LEGS[LEGS.length - 1];
  const t = clamp((v - leg.v0) / (leg.v1 - leg.v0), 0, 1), te = lerp(t, ease(t), 0.35), vv = lerp(leg.v0, leg.v1, te);
  const k = leg.keys; let i = 0; while (i < k.length - 2 && vv > k[i + 1][0]) i++;
  const u = (i + clamp((vv - k[i][0]) / (k[i + 1][0] - k[i][0]), 0, 1)) / (k.length - 1);
  return { P: leg.pos.getPoint(u), L: leg.look.getPoint(u) };
}
// the week at each point of the scroll
const WEEK_KEYS = [
  [6.0, 5.95],
  [6.5, 6.05],
  [10.5, 16.0],
  [12.2, 18.0],
  [14.5, 18.2],   // deep among the props, before any of them is struck
  [15.5, 19.0],   // risen through the hall, the upper level still a forest of props
  [16.5, 30.0],   // props struck, glazing, travertine, plaster and oak
  [17.6, 31.17],  // the library, the studio desk, the bed and the loggia
  [19.4, 32.4],   // the lounge in bay A, piece by piece
  [20.4, 32.7],   // down through the hall to the living level
  [21.65, 34.31], // kitchen run, island, stools, then the dining table
  [23.9, 35.95],  // the living room, its door sliding open
  [26.35, 36.15], // down the lower flight
  [28.0, 36.8],   // pool level: the lounge in front of the media wall
  [28.4, 37.06],  // the sauna
  [29.1, 37.42],  // the billiard table
  [29.6, 37.72],  // the door to the terrace slides open, the terrace and the planting arrive
  [HAND, 38.0],   // handover, at the pool
];
function weekAt(v) {
  if (v <= WEEK_KEYS[0][0]) return WEEK_KEYS[0][1];
  for (let i = 1; i < WEEK_KEYS.length; i++) if (v <= WEEK_KEYS[i][0]) {
    const [a, wa] = WEEK_KEYS[i - 1], [b, wb] = WEEK_KEYS[i];
    return lerp(wa, wb, sm(0, 1, (v - a) / (b - a)) * 0.35 + (v - a) / (b - a) * 0.65);
  }
  return 38;
}
const END = { out: [HAND, HAND + 1.7], unpour: [HAND + 1.7, HAND + 2.7], zoom: [HAND + 2.7, HAND + 3.8], total: HAND + 4.4 };
let KW = toK(V(HANDOVER_B[0], HANDOVER_B[1], HANDOVER_B[2]), V(HANDOVER_B[3], HANDOVER_B[4], HANDOVER_B[5]), EYE_FOV);

// ---------------------------------------------------------------- pipeline
const pipe = makePipe(renderer, scene, cam, { ao: high, samples: 4, direct: DIRECT, floatDepth: high });
pipe.onAim = (c) => {
  const D = c.userData.D; scene.fog.near = D + 110; scene.fog.far = D + 1450;
  sky.position.copy(c.position);
};
// The resolution: a pixel budget that follows the frame time. The drawing and the canvas take the governed ratio,
// the composer of the desktop site at most 1.5 device pixels.
let lastKey = '';
const gov = governor({
  apply: (dpr) => {
    DPR = dpr; DPR_REAL = DIRECT ? dpr : Math.min(dpr, 1.5);
    renderer.setPixelRatio(DPR); renderer.setSize(W, H, false); pipe.setSize(W, H, DPR, DPR_REAL);
    lastKey = '';
  },
});

// ---------------------------------------------------------------- the sheet's layout
const sheet = document.getElementById('sheet');
const frames = [...document.querySelectorAll('.frame')], caps = [...document.querySelectorAll('figcaption')];
const prog = document.getElementById('prog'), nowEl = prog.querySelector('.now'), nowTag = nowEl.querySelector('b');
const dones = [...prog.querySelectorAll('.done')];
const chip = document.getElementById('chip'), notes = document.getElementById('notes'), hint = document.getElementById('hint'), bar = document.querySelector('.bar');
let REST = [];
const K0_H = K0.h, K0_HALF_W = 17.3; // the drawing needs 12.9 m of half height (roof corner to pool wall) and 17.3 m of half width (court to infinity edge)
const measure = () => {
  sheet.style.transform = 'none';
  REST = frames.map((f) => { const r = f.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  // a tall tile (a tablet held upright) fits the drawing by its width instead, so the house is never cropped
  K0.h = Math.max(K0_H, K0_HALF_W * REST[0].h / REST[0].w);
  pipe.setRest(REST, K0);
};
measure();

let clockKey = '';
function clock(week, show) {
  const ck = (show ? 1 : 0) + ':' + week.toFixed(3);
  if (ck === clockKey) return; clockKey = ck; // the schedule only moves with the week
  prog.classList.toggle('clock', show);
  const f = clamp(week / WEEKS, 0, 1);
  nowEl.style.left = `calc(var(--lab) + (100% - var(--lab)) * ${f.toFixed(5)})`;
  const tag = 'Wo. ' + pad(clamp(Math.ceil(week - 1e-3), 0, WEEKS));
  if (nowTag.textContent !== tag) nowTag.textContent = tag;
  nowTag.style.transform = `translateX(${(-50 - 50 * sm(0.9, 1, f)).toFixed(2)}%)`; // the tag stays on the sheet in the last weeks
  PROG.forEach(([, a, b], i) => { const v = clamp((week - a) / (b - a), 0, 1).toFixed(4); if (dones[i]._v !== v) { dones[i]._v = v; dones[i].style.transform = `scaleX(${v})`; } });
}

// ---------------------------------------------------------------- light by the week
function lightFor(week, v) {
  const pm = sm(27, 36, week);
  const dir = SUN_AM.clone().lerp(SUN_MID, sm(15.4, 17.4, week)).normalize().lerp(SUN_PM, pm).normalize();
  sun.position.copy(sunAt).addScaledVector(dir, 140);
  sun.color.set(0xffe7cc).lerp(C('#ffc68c'), pm); sun.intensity = lerp(3.15, 3.55, pm);
  // inside the house the fill light steps back, so walls and ceilings get a gradient (lit by the window, darker in the
  // depth of the room) instead of one even beige; the floor still bounces light up under the soffits
  const inn = sm(19, 21, v) * (1 - sm(27.6, 28.4, v));
  hemi.intensity = lerp(0.88, 0.72, pm) * (1 - 0.42 * inn);
  bounce.intensity = 0.72 * (1 - 0.35 * inn);
  renderer.toneMappingExposure = 1.04 - 0.1 * inn;
  skyMat.uniforms.uSun.value.copy(dir);
  skyMat.uniforms.uZen.value.copy(SKY.am.zen).lerp(SKY.pm.zen, pm);
  skyMat.uniforms.uHor.value.copy(SKY.am.hor).lerp(SKY.pm.hor, pm);
  skyMat.uniforms.uGlow.value.copy(SKY.am.glow).lerp(SKY.pm.glow, pm);
  scene.fog.color.copy(skyMat.uniforms.uHor.value);
  const lampOn = (g) => (g === 'up' ? sm(31.6, 32.3, week) : g === 'kd' ? sm(33.4, 34.35, week) : g === 'lv' ? sm(35.3, 35.8, week) : sm(36.9, 37.5, week));
  if (high) lamps.forEach((p, i) => { p.position.copy(LAMPS[i].p); p.intensity = 7.5 * LAMPS[i].k * lampOn(LAMPS[i].g); });
  else {
    let gi = 0; while (gi < LAMP_AT.length && v >= LAMP_AT[gi]) gi++;
    // the pool fades out before it changes hands and in again after, so no room goes dark in view
    const f = (gi > 0 ? sm(LAMP_AT[gi - 1], LAMP_AT[gi - 1] + 0.3, v) : 1) * (gi < LAMP_AT.length ? 1 - sm(LAMP_AT[gi] - 0.3, LAMP_AT[gi], v) : 1);
    const set = lampSets[gi], on = lampOn(LAMP_G[gi]) * f;
    lamps.forEach((p, i) => { if (set[i]) { p.position.copy(set[i].p); p.intensity = 7.5 * set[i].k * on; } else p.intensity = 0; });
  }
  R.shade.emissiveIntensity = 2.6 * sm(31.6, 37.6, week);
  // each sliding door steps in off the line of the glass, then slides open behind its neighbour:
  // the living room's while the room is furnished, the pool level's just before the walk leaves through it
  const d1 = stage.userData.door, d0 = stage.userData.door0;
  d1.position.x = DOOR.x - 0.11 * sm(FW(36.3), FW(36.45), week);
  d1.position.z = DOOR.zc - (DOOR.w - 0.03) * sm(FW(36.45), FW(36.9), week);
  d0.position.x = DOOR0.x - 0.11 * sm(37.3, 37.38, week);
  d0.position.z = DOOR0.zc - (DOOR0.w - 0.03) * sm(37.38, 37.6, week);
  setShadowBox(v > 11.9 ? 'house' : 'site');
  const key = (Math.round(week * 25) / 25).toFixed(2);
  if (key !== shadowKey) { shadowKey = key; shadowDirty = true; }
}
// The shadow map is redrawn when the week has moved. While the scroll is moving a phone redraws it at most ten
// times a second (a part that is being built lags its shadow by a few frames), and always once more at rest.
const SHADOW_MS = high ? 0 : low ? 95 : 45;
function shadowTick(now, force) {
  if (!shadowDirty) return false;
  if (!force && now - shadowAt < SHADOW_MS) return true; // still owed: the caller asks for another frame
  shadowDirty = false; shadowAt = now; renderer.shadowMap.needsUpdate = true;
  return false;
}

// ---------------------------------------------------------------- warm up behind the loader
// every shader the scroll will need is compiled here, so no phase of the build starts with a hitch
const screenRect = () => ({ x: 0, y: 0, w: W, h: H });
const renderReal = (t, week) => (DIRECT ? pipe.realDirect(t, week) : pipe.real(t, week));
pipe.draw(TILES.map((t, i) => ({ rect: REST[i], cam: K0, now: t.w1 })), 6);
pipe.draw([{ rect: screenRect(), cam: K0, now: 6, live: true }]);
setP(0.78); await raf();
for (const [w, v] of [[38, 30.6], [18, 12.2], [5.95, 6]]) {
  U.real.value = w; lightFor(w, v); renderer.shadowMap.needsUpdate = true;
  renderReal({ cam: w === 38 ? KW : K3, rect: screenRect() }, w);
}
renderReal({ cam: K1, rect: screenRect() }, 5.95);
pipe.show({ rect0: screenRect(), now: 99, glow: 0, pour: 2, realOn: true, realOnly: false, mpp: 0.02, time: 0 });
gov.hold(2500);
setP(0.94); await raf();
await document.fonts.ready;
setP(1);

// ---------------------------------------------------------------- the hero: dock, land, draw
const S = { now: -1.6, drawT: -1, drawn: false };
const DRAW_S = 5.8;
const nowAt = (t) => -1.6 + (WEEKS + 1.6) * (t <= 0 ? 0 : t >= 1 ? 1 : (1 - Math.cos(Math.PI * Math.pow(t, 1.12))) / 2);
const LOADER_MS = 1900;
let heroT0 = OFFLINE ? LOADER_MS : Math.max(performance.now() + 300, LOADER_MS);
const HERO = [
  [0, () => {
    SEQ.docked = true;
    prog.querySelectorAll('.plan').forEach((p) => p.classList.add('in'));
    prog.classList.add('fly'); SEQ.place('dock'); prog.classList.add('docked');
    document.body.classList.add('ready');
  }],
  [350, () => document.body.classList.add('sheeton')],
  [520, () => document.body.classList.add('landed')],
  [1050, (t) => { prog.classList.remove('fly'); S.drawT = t; caps.forEach((c) => c.classList.add('go')); }],
];
let heroStep = 0;
function heroTick(t) {
  if (OFFLINE && t < LOADER_MS) { SEQ.progress = Math.min(1, t / (LOADER_MS - 300)); SEQ.shown = SEQ.progress; }
  while (heroStep < HERO.length && t >= heroT0 + HERO[heroStep][0]) HERO[heroStep++][1](heroT0 + HERO[heroStep - 1][0]);
}
if (STILL || calm()) {
  SEQ.docked = true; SEQ.place('dock'); prog.classList.add('docked'); prog.querySelectorAll('.plan').forEach((p) => p.classList.add('in'));
  document.body.classList.add('ready', 'landed', 'sheeton'); caps.forEach((c) => c.classList.add('go', 'done')); hint.classList.add('on');
  S.now = WEEKS; S.drawn = true; heroStep = HERO.length;
}
if (OFFLINE) { SEQ.real = true; SEQ.progress = 0; SEQ.shown = 0; }

// ---------------------------------------------------------------- scroll
// One screen height of scroll is the height of the canvas (VH), and the track is laid out in it, so the URL bar
// of a phone sliding in and out does not move the walk.
const track = document.getElementById('track');
let VH = H; SEQ.VH = VH;
track.style.height = (END.total + 1) * VH + 'px';
if (Q.has('v')) { history.scrollRestoration = 'manual'; scrollTo(0, +Q.get('v') * VH); }
let sv = scrollY / VH, last = OFFLINE ? 0 : performance.now();

// annotations inside drawing 01, positioned cleanly with a paper halo so lines never strike through text
const NOTES = [
  { p: V(-0.2, 0, -6.5), t: '±0.00 HOF', dx: -22, dy: -28 },
  { p: V(10.4, -4.3, -0.4), t: '-4.30 PLANUM', dx: 24, dy: -32 },
  { p: V(13.8, -2.3, 6.8), t: '-2.30 ZUFAHRTSBERME', dx: -24, dy: 28 },
  { p: V(19.6, -3.2, -9.6), t: '-3.20 POOLTERRASSE', dx: 20, dy: -26 },
  { p: V(14.8, -3.6, 4.4), t: 'STREIFENFUNDAMENT 1.0 × 0.7M', dx: 26, dy: 38, acc: true },
  { p: V(1.2, -2.3, -1.8), t: 'BÖSCHUNG 1 : 1.15', dx: -26, dy: 32 },
];
notes.innerHTML = NOTES.map((n) => `<g><circle r="2.2" fill="${PAL.ink}"/><line stroke="${PAL.ink}" stroke-width=".9"/><rect class="nbg" rx="1" height="14"/><text ${n.acc ? 'class="acc"' : ''}>${n.t}</text></g>`).join('');
const noteEls = [...notes.children];
NOTES.forEach((n, i) => { n.w = noteEls[i].children[3].getComputedTextLength() + 8; });
const noteV = new THREE.Vector3();
let noteA = -1;
function drawNotes(alpha) {
  const a = alpha <= 0.001 ? 0 : +alpha.toFixed(3);
  if (a !== noteA) { noteA = a; notes.style.opacity = a; notes.style.visibility = a ? 'visible' : 'hidden'; }
  if (!a) return;
  const v = noteV;
  NOTES.forEach((n, i) => {
    v.copy(n.p).project(cam);
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H, g = noteEls[i];
    let dx = n.dx; if (x + dx < 140 && dx < 0) dx = -dx; if (x + dx > W - 170 && dx > 0) dx = -dx;
    const tx = x + dx, ty = y + n.dy;
    g.children[0].setAttribute('cx', x); g.children[0].setAttribute('cy', y);
    const ln = g.children[1]; ln.setAttribute('x1', x); ln.setAttribute('y1', y); ln.setAttribute('x2', tx); ln.setAttribute('y2', ty);
    const tt = g.children[3], bg = g.children[2];
    const txText = tx + (dx < 0 ? -5 : 5), tyText = ty + (n.dy < 0 ? -4 : 9);
    tt.setAttribute('x', txText); tt.setAttribute('y', tyText); tt.setAttribute('text-anchor', dx < 0 ? 'end' : 'start');
    const bw = n.w;
    bg.setAttribute('x', dx < 0 ? txText - bw + 3 : txText - 3);
    bg.setAttribute('y', tyText - 10.5);
    bg.setAttribute('width', bw);
  });
}

// what the small print says at each point
const rowOf = (w) => { let n = PROG[0][0]; for (const [name, a] of PROG) if (w >= a) n = name; return n; };
function chipFor(v, week, pour, diving) {
  const wk = `Woche ${pad(clamp(Math.ceil(week - 1e-3), 1, WEEKS))} &nbsp;//&nbsp; `;
  if (v >= END.zoom[0] + 0.3) return '';
  if (v >= END.out[0] + 0.15) return 'Zeichnung 06 &nbsp;//&nbsp; Verglasung, Ausbau, Pool &nbsp;//&nbsp; <i>Wo. 22–38</i>';
  if (v >= HAND - 0.75) return 'Woche 38 &nbsp;//&nbsp; <i>Übergabe · Poolterrasse</i>';
  if (v >= LEGS[1].v0 - 0.4 && v <= LEGS[1].keys[2][0]) return wk + `<i>Dächer betoniert · ${propsAt(week)} Stützen unter den Decken</i>`;
  if (v > DIVE + 0.5) {
    if (week >= 9.05 && week < 10.15) return wk + '<i>Verfüllen &amp; Verdichten</i>';
    if (week >= 10.15 && week < 10.95) return wk + '<i>Gerüsttreppe &amp; Balkonplatte</i>';
    if (v > 14.0 && week < 19.6) return wk + `<i>Hinauf durch die Halle · ${propsAt(week)} Stützen</i>`;
    if (week >= 19.6 && week < 25.0) return wk + '<i>Stützen ausgebaut · Verglasung &amp; Travertin</i>';
    if (week >= 25.0 && week < 30.0) return wk + '<i>Putz &amp; Eichendielen</i>';
    if (week >= 30.0 && week < 31.2) return wk + '<i>Obergeschoss · Bibliothek, Studio &amp; Loggia</i>';
    if (week >= 31.2 && week < 32.4) return wk + '<i>Obergeschoss · Lounge</i>';
    if (week >= 32.4 && week < 32.7) return wk + '<i>Hinunter durch die Halle</i>';
    if (week >= 32.7 && week < 33.6) return wk + '<i>Wohngeschoss · Küche &amp; Insel</i>';
    if (week >= 33.6 && week < 34.4) return wk + '<i>Wohngeschoss · Essbereich</i>';
    if (week >= 34.4 && week < 35.95) return wk + '<i>Wohngeschoss · Wohnraum &amp; Balkon</i>';
    if (week >= 35.95 && week < 36.16) return wk + '<i>Die Treppe hinab ins Poolgeschoss</i>';
    if (week >= 36.16 && week < 36.8) return wk + '<i>Poolgeschoss · Lounge &amp; Medienwand</i>';
    if (week >= 36.8 && week < 37.06) return wk + '<i>Poolgeschoss · Sauna</i>';
    if (week >= 37.06 && week < 37.44) return wk + '<i>Poolgeschoss · Billard</i>';
    if (week >= 37.44) return wk + '<i>Poolgeschoss · Schiebetür zur Terrasse</i>';
    const n = propsAt(week);
    return wk + `<i>${rowOf(week)}${n ? ` · ${n} Stützen` : ''}</i>`;
  }
  if (v > DIVE * 0.93) return 'Woche 06 &nbsp;//&nbsp; <i>Aushubberme · -2.30m</i>';
  if (pour > 0) { const w = clamp(Math.ceil(pour), 1, 6); return `Woche ${pad(w)} &nbsp;//&nbsp; <i>${w <= 3 ? 'Aushub' : 'Fundamente'}</i>`; }
  if (diving) return 'Zeichnung 01 &nbsp;//&nbsp; Aushub, Fundamente &nbsp;//&nbsp; <i>Wo. 01–06</i>';
  return '';
}

// ---------------------------------------------------------------- the frame
// A frame has three parts. What always runs: the clock of the hero, the eased scroll, and the arithmetic that turns
// the scroll into a camera, a week and a layout. Then a key of everything the picture depends on: if it is the key
// of the last frame, nothing is written to the page and nothing is rendered. Only then the page and the picture.
let playY = 0, owed = false;
function frame(now) {
  if (!OFFLINE) requestAnimationFrame(frame);
  heroTick(now);
  if (now - last > 120 && S.drawT > 0) (window.__hitches || (window.__hitches = [])).push([Math.round(now - last), +sv.toFixed(2), +S.now.toFixed(1)]);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!visible()) { gov.frame(now, false); return; } // a hidden tab or frame draws nothing
  // Play: the page scrolls itself at a steady pace and stops on the last sheet
  if (SEQ.playing) {
    if (scrollY / VH >= END.total - 0.002 || scrollY >= (END.total + 1) * VH - innerHeight - 2) SEQ.setPlaying(false);
    else { playY = Math.max(playY, scrollY) + dt * SEQ.speed * VH; scrollTo(0, playY); }
  } else playY = 0;
  const target = clamp(scrollY / VH, 0, END.total);
  // a chapter jump is a cut, and with reduced motion the camera follows the scroll without easing
  const cut = STILL || calm() || SEQ.jump; SEQ.jump = false;
  sv = cut ? target : sv + (target - sv) * (1 - Math.exp(-dt * 5.5));
  U.fx.value = calm() ? 0 : 1;
  if (Math.abs(target - sv) < 1e-5) sv = target;
  const ps = clamp(sv / DIVE, 0, 1);

  if (calm() && !S.drawn) { S.drawn = true; S.now = WEEKS; S.drawT = Math.max(S.drawT, 1); caps.forEach((c) => c.classList.add('go', 'done')); window.__heroDone = true; }
  if (S.drawT > 0 && !S.drawn) {
    const t = (now - S.drawT) / 1000 / DRAW_S * (ps > 0.01 ? 3 : 1);
    if (ps > 0.01) S.drawT -= dt * 1000 * 2;
    S.now = nowAt(t);
    if (t >= 1) { S.drawn = true; S.now = WEEKS; window.__heroDone = true; }
    caps.forEach((c, i) => c.classList.toggle('done', S.now >= TILES[i].w1));
  }
  if (STILL) window.__heroDone = true;

  // ---- the scroll as a camera, a week and a layout (arithmetic only)
  const ending = sv >= END.out[0];
  const live = ending ? 5 : 0;
  let z, c, pour, l = 0, k, week, realOnly, rectL;
  const Rl = REST[live], sC = Math.max(W / Rl.w, H / Rl.h);
  const cL = { x: Rl.x + Rl.w / 2, y: Rl.y + Rl.h / 2 }, c1 = { x: W / 2, y: H / 2 };
  const F = { x: (c1.x - cL.x * sC) / (1 - sC), y: (c1.y - cL.y * sC) / (1 - sC) };
  const coverH = Rl.h * sC;
  if (!ending) {
    z = ease(sm(0.035, 0.20, ps)); c = sm(0.19, 0.33, ps);
    pour = lerp(-1.3, 8.4, clamp((ps - 0.33) / 0.29, 0, 1));
    l = clamp((ps - 0.62) / (0.975 - 0.62), 0, 1);
    week = sv > DIVE ? weekAt(sv) : 5.95;
    realOnly = pour >= 8.35;
    k = c > 0 ? lerpK(K0, K1, c) : K0;
    if (l > 0) k = lerpK(K1, K3, l, { f: sm(0, 0.62, l), e: sm(0.22, 1, l), T: sm(0.18, 1, l), h: sm(0.18, 1, l) });
    if (sv > DIVE) { const w = walkAt(sv); k = toK(w.P, w.L, EYE_FOV); }
  } else {
    week = 38;
    const lo = clamp((sv - END.out[0]) / (END.out[1] - END.out[0]), 0, 1);
    const lu = clamp((sv - END.unpour[0]) / (END.unpour[1] - END.unpour[0]), 0, 1);
    const lz = clamp((sv - END.zoom[0]) / (END.zoom[1] - END.zoom[0]), 0, 1);
    const K06s = { T: K0.T, az: K0.az, el: K0.el, h: K0.h * H / coverH, fov: 2 };
    k = lerpK(KW, K06s, lo, { f: sm(0, 0.78, lo), e: sm(0.3, 1, lo), T: sm(0.22, 1, lo), h: sm(0.22, 1, lo) });
    pour = lerp(40.0, -2.4, ease(lu));
    realOnly = lu <= 0;
    z = 1 - ease(lz); c = lz > 0 ? 1 : 0;
    if (lz > 0) k = K0;
  }
  const diving = z > 0.02 && !ending;
  // while the site is building itself the slices drift on their own, so those frames are always drawn
  const building = !calm() && !STILL && (ending ? sv > END.unpour[0] && sv < END.zoom[0] + 0.2 : pour > -1.3 && pour < 8.35 && c > 0);
  const key = [W, H, sv.toFixed(4), S.now.toFixed(3), U.fx.value, building ? now : 0].join(',');
  const active = key !== lastKey || owed;
  gov.frame(now, active);
  if (!active) return;
  lastKey = key;

  // ---- the page
  U.real.value = week; lightFor(week, sv);
  const s = Math.exp(Math.log(sC) * z);
  const zr = (r) => ({ x: F.x + (r.x - F.x) * s, y: F.y + (r.y - F.y) * s, w: r.w * s, h: r.h * s });
  set(sheet.style, 'transform', z > 0 ? `translate(${F.x * (1 - s)}px, ${F.y * (1 - s)}px) scale(${s})` : 'none');
  const side = sm(0.5, 0.92, z); // the sheet and the five other drawings go back into the paper as the page dives in
  set(sheet.style, 'opacity', 1 - side);
  if (sheet.inert !== z > 0.9) sheet.inert = z > 0.9; // off screen: out of the tab order and the reading order too
  const rects = REST.map(zr);
  const cover = rects[live];
  if (!ending) rectL = c > 0 ? { x: lerp(cover.x, 0, c), y: lerp(cover.y, 0, c), w: lerp(cover.w, W, c), h: lerp(cover.h, H, c) } : cover;
  else rectL = sv < END.zoom[0] ? screenRect() : cover;
  rects[live] = rectL;

  document.body.classList.toggle('closing', ending && sv > END.zoom[0] + 0.45);
  const onSite = (pour > -0.5 || sv > DIVE) && !(ending && sv > END.unpour[0] + 0.3);
  if (onSite) {
    if (!prog.classList.contains('hud')) { prog.classList.add('hud'); placeHud(); }
    set(prog.style, 'opacity', ending ? 1 - sm(END.unpour[0], END.unpour[0] + 0.3, sv) : clamp((pour + 0.5) / 0.8, 0, 1));
    clock(sv > DIVE ? week : clamp(pour, 0, 5.95), true);
  } else {
    if (prog.classList.contains('hud')) { prog.classList.remove('hud'); SEQ.place('dock'); }
    if (ending) { if (!placedEnd) { SEQ.place('dock'); placedEnd = true; } set(prog.style, 'opacity', sm(END.zoom[0] + 0.4, END.zoom[1], sv)); clock(WEEKS, true); }
    else { set(prog.style, 'opacity', !diving ? 1 : 1 - clamp(z * 3, 0, 1)); clock(S.now, S.drawT > 0 && !diving); }
  }
  if (!ending || onSite) placedEnd = false;
  const site = onSite && (!ending || sv < END.unpour[0] + 0.5);
  bar.classList.toggle('over', site); document.body.classList.toggle('site', site);
  const chipTxt = chipFor(sv, week, pour, diving);
  if (chip.dataset.t !== chipTxt) { chip.innerHTML = chipTxt; chip.dataset.t = chipTxt; SEQ.say(chipTxt || (ending ? 'Woche 38, Übergabe. Blatt A-901, alle acht Phasen abgeschlossen.' : '')); }
  chip.classList.toggle('on', !!chipTxt);
  hint.classList.toggle('on', S.drawn && sv < 0.3);

  // ---- the picture
  aim(cam, k, rectL, W, H);
  drawNotes(ending ? 0 : c * (1 - clamp((pour + 0.8) / 1.2, 0, 1)));
  const realOn = ending ? sv < END.zoom[0] : pour > -0.8;
  // the live drawing has left its place on the sheet (or its camera has): it is drawn fresh; at rest it is a cell like the others
  const moved = z > 1e-4 || c > 0 || (ending && sv < END.zoom[1] - 1e-4);
  owed = false;
  if (!realOnly) {
    const allTiles = !(ending ? sv < END.zoom[0] : c > 0.02);
    owed = pipe.draw(TILES.map((t, i) => ({
      rect: rects[i], cam: i === live ? k : K0, hidden: i !== live && !allTiles, live: i === live && moved,
      now: diving || ending ? t.w1 : Math.min(S.now, t.w1),
    })));
  }
  if (pipe.shafts) {
    const inHouse = sv > DIVE + 4 && !ending ? 1 : ending ? 1 - sm(END.out[0], END.out[0] + 0.6, sv) : 0;
    const dens = inHouse * (0.018 * sm(16.2, 17.2, week) * (1 - sm(20.5, 22.8, week)) + 0.006 * sm(34.5, 37.2, week));
    pipe.shafts.enabled = realOn && dens > 1e-4;
    if (pipe.shafts.enabled) {
      const u = pipe.shafts.uniforms;
      u.uDensity.value = dens; u.tShadow.value = sun.shadow.map ? sun.shadow.map.texture : null;
      u.uShadowMat.value.copy(sun.shadow.matrix); u.uSunCol.value.copy(sun.color).multiplyScalar(sun.intensity);
      u.uSunDir.value.copy(sun.position).sub(sun.target.position).normalize();
      if (!u.tShadow.value) pipe.shafts.enabled = false;
    }
  }
  if (realOn) {
    // at rest the shadow map catches up at once; while the scroll moves a phone lets it lag a few frames
    if (shadowTick(now, Math.abs(target - sv) < 2e-3 || cut)) owed = true;
    renderReal({ cam: k, rect: rectL }, week);
  }
  if (!(DIRECT && realOnly)) pipe.show({ rect0: rectL, now: diving || ending ? 99 : S.now, glow: diving || ending ? 0 : 1, pour, realOn, realOnly, side: moved ? side : 0, mpp: 2 * k.h / (rectL.h * DPR), time: building ? now / 1000 : 0 });
}
let placedEnd = false;
// write a style only when it changes
const styleMemo = new WeakMap();
const set = (st, prop, v) => { let m = styleMemo.get(st); if (!m) styleMemo.set(st, (m = {})); v = String(v); if (m[prop] !== v) { m[prop] = v; st[prop] = v; } };
function placeHud() {
  // the schedule sits at the bottom of the part of the screen that is always visible (the sheet is 100svh tall)
  const ph = SEQ.phone(), w = ph ? W - 28 : Math.min(560, W - 48);
  prog.style.transform = 'none'; prog.style.width = w + 'px';
  prog.style.left = (ph ? 14 : 24) + 'px';
  prog.style.top = (sheet.offsetHeight || H) - prog.querySelector('.rows').offsetHeight - (ph ? 20 : 26) + 'px';
}
if (!OFFLINE) requestAnimationFrame(frame);
const animStart = new WeakMap();
window.__frame = (vt) => {
  frame(vt);
  for (const a of document.getAnimations()) { if (!animStart.has(a)) animStart.set(a, vt); a.pause(); a.currentTime = Math.max(0, vt - animStart.get(a)); }
};

const noteWidths = () => NOTES.forEach((n, i) => { n.w = noteEls[i].children[3].getComputedTextLength() + 8; });
SEQ.onPrefs = () => { noteWidths(); measure(); clockKey = ''; if (prog.classList.contains('hud')) placeHud(); else SEQ.place(SEQ.docked ? 'dock' : 'loader'); lastKey = ''; };
// A real resize: the canvas box changed (a window resize, a turned phone), not just the URL bar of a phone.
let resizeT = 0;
function resized() {
  const [w, h] = boxSize();
  if (w === W && h === H) { if (prog.classList.contains('hud')) placeHud(); return; }
  W = w; H = h; VH = h; SEQ.VH = VH;
  const at = sv; track.style.height = (END.total + 1) * VH + 'px'; scrollTo(0, at * VH); // stay where the walk was
  EYE_FOV = eyeFov(); K1.h = Math.max(8.9, 7.7 * H / W);
  K3 = toK(EDGE[0], EDGE[1], EYE_FOV); KW = toK(V(HANDOVER_B[0], HANDOVER_B[1], HANDOVER_B[2]), V(HANDOVER_B[3], HANDOVER_B[4], HANDOVER_B[5]), EYE_FOV);
  gov.refit(); gov.hold(1200); // applies the new size to the canvas and the targets
  measure(); clockKey = ''; if (prog.classList.contains('hud')) placeHud(); else SEQ.place(SEQ.docked ? 'dock' : 'loader'); lastKey = '';
}
addEventListener('resize', () => { clearTimeout(resizeT); if (isTouch) resizeT = setTimeout(resized, 120); else resized(); }, { passive: true });
addEventListener('pageshow', () => { lastKey = ''; });
document.addEventListener('visibilitychange', () => { lastKey = ''; });
window.__seq = { pipe, cam, scene, U, S, renderer, END, K0, walkAt, weekAt, lightFor, gov, tier, get sv() { return sv; } };
window.__ready = true; window.__readyAt = performance.now();

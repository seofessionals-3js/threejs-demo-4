// The pipeline. Two passes make a drawing (paper colour with the week in alpha, then normals + line weight + what the
// part is + depth), one composer makes the site, and one full screen shader turns depth and normals into hierarchical
// architectural ink, reveals it by week, and builds the site in behind the same weeks: each part first as a field of
// scan lines and glowing points, cut through the real ground and walls, which then close up into the lit world.
//
// What is drawn when. The six drawings of the sheet are kept in one pair of targets, each in its own cell, and a cell
// is only drawn again when its week changes: while the sheet draws itself all drawings that are still growing show
// the same week, so one of them is drawn and the others read its cell. The drawing the page dives into is drawn
// fresh every frame into a second pair of targets; its neighbours are read from their cells, magnified.
// On a phone the lit site goes straight to the canvas once nothing of the drawing is left on screen.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { U, weekly, PAPER, tagWeeks } from './world.js';

const DEG = Math.PI / 180;

// A camera described by what it looks at: target T, azimuth and elevation of the view direction (degrees),
// h the half height of the frame at the target, fov the lens. The frame is mapped onto `rect` (css px) of
// a W by H screen, and the frustum is extended off centre to cover the whole screen.
export function aim(cam, s, rect, W, H) {
  const t = Math.tan(s.fov * DEG / 2), D = s.h / t;
  const az = s.az * DEG, el = s.el * DEG;
  cam.position.set(s.T.x + Math.cos(el) * Math.cos(az) * D, s.T.y + Math.sin(el) * D, s.T.z + Math.cos(el) * Math.sin(az) * D);
  cam.up.set(0, 1, 0); cam.lookAt(s.T); cam.updateMatrixWorld();
  const near = Math.max(0.1, D - 240), far = D + 3200;
  const wy = t, wx = t * rect.w / rect.h;
  const u = (x) => ((x - rect.x) / rect.w * 2 - 1) * wx, v = (y) => (1 - (y - rect.y) / rect.h * 2) * wy;
  cam.projectionMatrix.makePerspective(u(0) * near, u(W) * near, v(0) * near, v(H) * near, near, far);
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.near = near; cam.far = far; cam.userData.D = D;
  return cam;
}

// Switch the scene to one of its three sets of materials (the lit site, the paper pass, the line pass) at a week.
// A mesh none of whose parts exists in that week is switched off altogether, so its vertices cost nothing.
function useSet(meshes, set, week) {
  for (let i = 0; i < meshes.length; i++) {
    const o = meshes[i], s = o.userData.sets;
    if (!s) { o.visible = set === 'main'; continue; }
    const m = s[set];
    if (!m || week + 1e-4 < o.userData.w0 || week >= o.userData.w1) o.visible = false; else { o.visible = true; o.material = m; }
  }
}

const DISPLAY_FS = `
  uniform sampler2D tPaper, tND, tDepth, tPaperL, tNDL, tDepthL, tReal;
  uniform vec2 uRes; uniform vec4 uNF; uniform float uDK;
  uniform float uNow, uGlow, uPour, uRealOn, uRealOnly, uSide;
  uniform vec4 uRects[6]; uniform vec4 uSrc[6]; uniform vec4 uRect0; uniform vec3 uPaper, uInk, uAccent, uLime, uDeep, uTintNew, uTintTemp, uTintEarth, uTintOld;
  uniform mat4 uInvVP; uniform float uMpp, uFx, uTime;
  varying vec2 vUv;
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  // a tile reads its drawing from a rectangle SR of one of the two sets of targets: its own cell on the sheet, the
  // cell of a drawing that shows the same week, or the fresh drawing of the tile the page is diving into (LV)
  vec4 SR; bool LV;
  vec2 cl(vec2 q){ return clamp(q, SR.xy + .5, SR.zw - .5) / uRes; }
  float dAt(vec2 q){ if (LV) return texture2D(tDepthL, cl(q)).r; return texture2D(tDepth, cl(q)).r; }
  vec4 ndAt(vec2 q){ if (LV) return texture2D(tNDL, cl(q)); return texture2D(tND, cl(q)); }
  vec4 papAt(vec2 q){ if (LV) return texture2D(tPaperL, cl(q)); return texture2D(tPaper, cl(q)); }
  vec3 nAt(vec2 q){ vec2 t = ndAt(q).xy * 2. - 1.; return vec3(t, sqrt(max(0., 1. - dot(t, t)))); }
  float wgtAt(vec2 q){ return ndAt(q).z; }
  float wAt(vec2 q){ return papAt(q).a * 42. - 2.; }
  float lin(float d){ vec2 nf = LV ? uNF.zw : uNF.xy; float z = d * 2. - 1.; return 2. * nf.x * nf.y / (nf.y + nf.x - z * (nf.y - nf.x)); }
  bool inside(vec2 p, vec4 r){ return p.x >= r.x && p.y >= r.y && p.x < r.z && p.y < r.w; }
  void main(){
    vec2 p = gl_FragCoord.xy;
    bool in0 = inside(p, uRect0);
    #ifdef BLEND
      if (uRealOnly > .5 && in0) { gl_FragColor = vec4(0., 0., 0., 1.); return; }
    #else
      if (uRealOnly > .5 && in0) { gl_FragColor = vec4(texture2D(tReal, vUv).rgb, 1.); return; }
    #endif
    int ti = -1; vec4 R = vec4(0.), S = vec4(0.);
    for (int i = 0; i < 6; i++) if (inside(p, uRects[i])) { ti = i; R = uRects[i]; S = uSrc[i]; }
    if (ti < 0) { gl_FragColor = vec4(uPaper, 1.); return; }
    LV = S.w > .5;
    SR = vec4(S.xy, S.xy + (R.zw - R.xy) * S.z);
    vec2 q = S.xy + (p - R.xy) * S.z;                 // this pixel in the targets; the line kernel steps one texel there
    float tileScale = clamp((R.z - R.x) / (uRes.x * 0.65), 0.0, 1.0);
    float dc = dAt(q);
    bool bg = dc >= 1.;
    vec4 pap = papAt(q);
    float week = bg ? -2. : pap.a * 42. - 2.;
    vec3 base = bg ? uPaper : pap.rgb;
    // The plan code: the line pass says what a part is and in which drawing it was first built. A drawing fills what
    // is new in its own weeks, what stood before, temporary works and earthworks each in their own tone.
    vec3 lineCol = uInk;
    if (!bg) {
      float code = floor(ndAt(q).a * 31. + .5), kind = floor(code / 8. + .01), phase = code - kind * 8.;
      bool fresh = phase > float(ti) + .5;
      vec3 fill = uPaper;
      if (kind > 2.5) fill = fresh ? uTintNew : uTintOld;
      else if (kind > 1.5) fill = fresh ? uTintTemp : uPaper;
      else if (kind > .5) fill = fresh ? uTintEarth : uPaper;
      float k = clamp((uPaper.g - base.g) / max(uPaper.g - uInk.g, 1e-3), -.12, 1.);   // how much ink the paper pass laid down
      base = mix(fill, uInk, k);
      // the plan code in the lines too: this phase's own work in Neubau red, what stood before in Bestand grey
      if (kind > 2.5) lineCol = fresh ? vec3(.831, .227, .165) : vec3(.40, .41, .43);
    }
    float e = 0., wl = week;
    vec2 o = vec2(1., 0.), g = vec2(0., 1.);
    if (bg) {
      wl = -3.;
      for (int i = 0; i < 4; i++) {
        vec2 d = i == 0 ? o : i == 1 ? -o : i == 2 ? g : -g;
        if (dAt(q + d) < 1.) {
          float wg = wgtAt(q + d);
          e = max(e, 0.88 * wg);
          wl = max(wl, wAt(q + d));
        }
      }
      if (wl < -1.5) wl = -2.;
    } else {
      float lc = lin(dc);
      vec3 nc = nAt(q);
      float wc = wgtAt(q);
      // In overview tiles (tileScale < 0.6), attenuate fine interior detail so Tile 06 stays crisp and architectural
      float detailScale = wc < 0.45 ? mix(0.28, 0.72, tileScale) : (wc < 0.7 ? mix(0.55, 0.82, tileScale) : 0.86);
      for (int i = 0; i < 2; i++) {
        vec2 d = i == 0 ? o : g;
        float da = dAt(q + d), db = dAt(q - d);
        float ee = 0.;
        if (da >= 1. || db >= 1.) {
          ee = 0.92;
        } else {
          float d2 = abs(lin(da) + lin(db) - 2. * lc);
          float dn = max(1. - dot(nc, nAt(q + d)), 1. - dot(nc, nAt(q - d)));
          float eDepth = smoothstep(uDK * 1.15, uDK * 2.8, d2);
          float eNorm = smoothstep(.14, .34, dn) * 0.78;
          float wMax = max(wc, max(wgtAt(q + d), wgtAt(q - d)));
          float sScale = wMax < 0.45 ? mix(0.28, 0.72, tileScale) : (wMax < 0.7 ? mix(0.55, 0.82, tileScale) : 0.86);
          ee = max(eDepth, eNorm) * sScale;
        }
        if (ee > .01) wl = max(wl, max(da < 1. ? wAt(q + d) : 0., db < 1. ? wAt(q - d) : 0.));
        e = max(e, ee);
      }
    }
    vec3 col = mix(base, lineCol, clamp(e, 0., 0.92));
    // fresh ink: what was drawn in the last weeks glows in Neubau red, then cools to its line colour
    float wk = e > .01 ? wl : week;
    if (uGlow > 0. && (e > .01 || base != uPaper)) {
      float gl = 1. - clamp((uNow - wk) / .9, 0., 1.);
      if (wk <= uNow + .01) col = mix(col, uAccent, gl * gl * (e > .01 ? .92 : .32) * uGlow);
    }
    // the neighbours of the drawing the page dives into go back into the paper with their frames
    if (!LV && uSide > 0.) col = mix(col, uPaper, uSide);
    // The world builds itself behind the same weeks, and the drawing stays readable while it does. The site appears
    // as horizontal slices cut through the real ground and walls. They drift and breathe on their own, widen until
    // they meet, and carry a Neubau-red edge while they grow. Between them the paper sinks into a graphite shade in which
    // the ink glows; ahead of the front the ink turns red and points land on the paper.
    // (With BLEND the site is already on the canvas underneath: col then holds everything but the site, and tr how
    // much of the site shows through, which the blend function multiplies the canvas by.)
    float tr = 0.;
    if (uRealOn > .5 && in0) {
      float w2 = bg ? .4 : wk;
      float a = uPour - w2;
      #ifdef BLEND
        vec3 real = vec3(0.);
      #else
        vec3 real = texture2D(tReal, vUv).rgb;
      #endif
      if (uFx < .5) { float k = smoothstep(0., .42, a); col = mix(col, real, k); tr = k; }
      else {
        float sp = max(.16, uMpp * 7.), f;
        if (bg) f = p.y / 7. + .3 * sin(p.x * .013 + uPour * 2.4 + uTime * .8) + uTime * .25;
        else {
          vec4 w4 = uInvVP * vec4(vUv * 2. - 1., dc * 2. - 1., 1.); vec3 wp = w4.xyz / w4.w;
          // level ground has no height to slice, so there the slices lean a little and still read as lines
          float lev = 1. - smoothstep(.15, .6, (abs(dFdx(wp.y)) + abs(dFdy(wp.y))) / uMpp);
          f = (wp.y + lev * (wp.x * .34 - wp.z * .26)) / sp + .24 * sin(wp.x * .9 + wp.z * .7 + uPour * 2.4 + uTime * .9)
            + .1 * sin(wp.x * 3.1 - wp.z * 2.3 - uPour * 1.3 - uTime * .6) + uTime * .25;
        }
        float d = abs(fract(f) - .5) * 2.;                       // 0 on a slice, 1 half way to the next
        float t = smoothstep(0., 1.8, a);                        // how far this pixel is through its build
        float grow = t * 1.6 - d * .95;
        float m = smoothstep(0., .18, grow);
        float rim = (1. - smoothstep(0., .2, abs(grow - .05))) * (1. - t * t) * step(0., a);
        float ahead = smoothstep(-.9, 0., a) * (1. - smoothstep(0., .3, a));
        float veil = smoothstep(0., .25, a) * (1. - t) * (1. - m);
        float tick = floor(uTime * 5. + uPour * 6.);
        col = mix(col, uAccent, e * ahead * .75);
        col = mix(col, mix(uAccent, uLime, .5), step(.986, h21(floor(p / 2.) + tick * 3.7)) * ahead);
        col = mix(col, uDeep, veil * .36);
        col = mix(col, uLime, e * veil * .55);
        float spark = step(.993, h21(floor(p / 2.) + tick * 1.3 + 11.)) * (1. - t) * step(0., a) * .85;
        #ifdef BLEND
          col = mix(col, uLime * .05 * (1. - t) * .75, m);
          tr = m * (1. - rim * .82) * (1. - spark);
        #else
          col = mix(col, mix(real, real * vec3(.97, .95, .93) + uLime * .05, (1. - t) * .75), m);
        #endif
        col = mix(col, uLime, rim * .82);
        col = mix(col, vec3(1., .93, .9), spark);
      }
    }
    #ifdef BLEND
      gl_FragColor = vec4(col, tr);
    #else
      gl_FragColor = vec4(col, 1.);
    #endif
  }`;

export function makePipe(renderer, scene, cam, opt) {
  const P = { scene, cam };
  const meshes = P.meshes = tagWeeks(scene);
  const nearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.UnsignedByteType };
  // the sheet (six cells) and the live drawing; a phone takes a 24 bit depth texture instead of a float one
  const target = () => { const rt = new THREE.WebGLRenderTarget(4, 4, nearest); rt.scissorTest = true; return rt; };
  const depthTex = () => new THREE.DepthTexture(4, 4, opt.floatDepth === false ? THREE.UnsignedIntType : THREE.FloatType);
  P.paperRT = target(); P.ndRT = target(); P.ndRT.depthTexture = depthTex();
  P.paperL = target(); P.ndL = target(); P.ndL.depthTexture = depthTex();
  // The site. Without post processing (opt.direct) it needs no composer at all: it is rendered straight to the
  // canvas, and where the drawing still shows the display shader is blended over it.
  P.direct = !!opt.direct;
  if (!P.direct) {
  P.comp = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: opt.samples ?? 4 }));
  P.comp.renderToScreen = false;
  P.comp.addPass(new RenderPass(scene, cam));
  }
  if (opt.ao && !P.direct) {
    const ao = new GTAOPass(scene, cam, 4, 4);
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.6, thickness: 1.4, scale: 1.1, samples: 12 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    ao.blendIntensity = 0.82;
    weekly(ao.normalMaterial);
    const r0 = ao.render.bind(ao); // glass and the sky stay out of the occlusion
    ao.render = (...a) => { const hid = []; for (const m of meshes) if ((m.userData.glass || m.userData.sky) && m.visible) { m.visible = false; hid.push(m); } r0(...a); hid.forEach((m) => (m.visible = true)); };
    P.comp.addPass(ao); P.ao = ao;
    // sun in the air: each view ray is marched through the house and gathers light wherever the sun's
    // shadow map says the air is lit, so beams come in through the opening and are cut by the props
    P.shafts = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null }, tDepth: { value: null }, tShadow: { value: null },
        uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uShadowMat: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uBoxMin: { value: new THREE.Vector3(4.0, -3.2, -7.7) }, uBoxMax: { value: new THREE.Vector3(20.4, 7.2, 3.7) },
        uDensity: { value: 0 }, uSunDir: { value: new THREE.Vector3() }, uDebug: { value: new URLSearchParams(location.search).has('shaftsdebug') ? 1 : 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: `#include <packing>
        uniform sampler2D tDiffuse, tDepth, tShadow; uniform mat4 uProjInv, uCamWorld, uShadowMat;
        uniform vec3 uCamPos, uSunCol, uBoxMin, uBoxMax, uSunDir; uniform float uDensity, uDebug; varying vec2 vUv;
        void main(){
          vec4 col = texture2D(tDiffuse, vUv);
          float d = texture2D(tDepth, vUv).x;
          vec4 v = uProjInv * vec4(vUv * 2. - 1., d * 2. - 1., 1.); v /= v.w;
          vec3 wp = (uCamWorld * vec4(v.xyz, 1.)).xyz, ro = uCamPos, rd = wp - ro; float L = length(rd); rd /= L;
          vec3 t0 = (uBoxMin - ro) / rd, t1 = (uBoxMax - ro) / rd, tn = min(t0, t1), tf = max(t0, t1);
          float a = max(max(tn.x, tn.y), max(tn.z, 0.)), b = min(min(tf.x, tf.y), min(tf.z, min(L, 30.)));
          if (b <= a) { gl_FragColor = col; return; }
          float st = (b - a) / 36., j = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715)))), acc = 0.;
          for (int i = 0; i < 36; i++) {
            vec3 p = ro + rd * (a + (float(i) + j) * st);
            vec4 sc = uShadowMat * vec4(p, 1.);
            if (sc.x > 0. && sc.x < 1. && sc.y > 0. && sc.y < 1.) acc += step(sc.z - .002, unpackRGBAToDepth(texture2D(tShadow, sc.xy)));
          }
          if (uDebug > .5) { vec4 sc = uShadowMat * vec4(wp, 1.); float sd = unpackRGBAToDepth(texture2D(tShadow, sc.xy)); gl_FragColor = vec4(acc / 36., sd, sc.z, 1.); return; }
          float litFrac = acc / 36.;
          float contrast = smoothstep(0.12, 0.85, litFrac);
          float ph = .48 + .52 * pow(max(dot(rd, uSunDir), 0.), 4.);
          col.rgb += uSunCol * (contrast * 36.) * st * uDensity * ph;
          gl_FragColor = col;
        }`,
    });
    P.shafts.uniforms.tDepth.value = ao.depthTexture;
    P.shafts.enabled = false;
    P.comp.addPass(P.shafts);
  }
  if (P.comp) P.comp.addPass(new OutputPass());
  // the display
  const v4s = () => Array.from({ length: 6 }, () => new THREE.Vector4(-1, -1, -1, -1));
  P.mat = new THREE.ShaderMaterial({
    uniforms: {
      tPaper: { value: P.paperRT.texture }, tND: { value: P.ndRT.texture }, tDepth: { value: P.ndRT.depthTexture },
      tPaperL: { value: P.paperL.texture }, tNDL: { value: P.ndL.texture }, tDepthL: { value: P.ndL.depthTexture }, tReal: { value: null },
      uRes: { value: new THREE.Vector2() }, uNF: { value: new THREE.Vector4(1, 2, 1, 2) }, uDK: { value: 0.05 }, // near and far of the sheet's camera, then of the live drawing's
      uNow: { value: 0 }, uGlow: { value: 0 }, uPour: { value: -1 }, uRealOn: { value: 0 }, uRealOnly: { value: 0 }, uSide: { value: 0 },
      uRects: { value: v4s() }, uSrc: { value: v4s() }, uRect0: { value: new THREE.Vector4(-1, -1, -1, -1) },
      uPaper: U.uPaper, uInk: U.uInk, uAccent: U.uAccent, uLime: U.uLime, uDeep: U.uDeep,
      uTintNew: U.uTintNew, uTintTemp: U.uTintTemp, uTintEarth: U.uTintEarth, uTintOld: U.uTintOld,
      uInvVP: { value: new THREE.Matrix4() }, uMpp: { value: 0.02 }, uFx: U.fx, uTime: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: DISPLAY_FS, depthTest: false, depthWrite: false,
  });
  if (P.direct) {
    P.mat.defines = { BLEND: 1 }; P.mat.transparent = true; P.mat.blending = THREE.CustomBlending;
    P.mat.blendEquation = THREE.AddEquation; P.mat.blendSrc = THREE.OneFactor; P.mat.blendDst = THREE.SrcAlphaFactor;
    P.mat.blendSrcAlpha = THREE.ZeroFactor; P.mat.blendDstAlpha = THREE.OneFactor; // the canvas stays opaque
  }
  P.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), P.mat); P.quad.frustumCulled = false;
  P.quadScene = new THREE.Scene(); P.quadScene.add(P.quad);
  P.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // one cell of the sheet per drawing: where it lies at rest (device px, y up) and which week it holds
  const cells = Array.from({ length: 6 }, () => ({ r: new THREE.Vector4(), now: null }));
  P.setSize = (W, H, dpr, dprReal) => {
    P.W = W; P.H = H; P.dpr = dpr;
    const w = Math.round(W * dpr), h = Math.round(H * dpr);
    const wr = Math.round(W * dprReal), hr = Math.round(H * dprReal);
    for (const rt of [P.paperRT, P.ndRT, P.paperL, P.ndL]) rt.setSize(w, h);
    for (const c of cells) c.now = null;
    if (P.comp && (P.wr !== wr || P.hr !== hr)) {
      P.wr = wr; P.hr = hr;
      if (P.ao && P.ao.normalRenderTarget) {
        P.ao.normalRenderTarget.dispose();
        P.ao.setGBuffer();
        if (P.shafts) P.shafts.uniforms.tDepth.value = P.ao.depthTexture;
      }
      P.comp.setPixelRatio(1); P.comp.setSize(wr, hr);
    }
    P.mat.uniforms.uRes.value.set(w, h);
  };
  // css rect (x, y from top, w, h) to device pixels with y from the bottom, as x0 y0 x1 y1
  const dev = (r, out) => out.set(r.x * P.dpr, (P.H - r.y - r.h) * P.dpr, (r.x + r.w) * P.dpr, (P.H - r.y) * P.dpr);
  const onScreen = (r) => r.x < P.W && r.y < P.H && r.x + r.w > 0 && r.y + r.h > 0;
  // where the six drawings lie on the sheet at rest, and the camera they share there
  P.setRest = (rects, cam0) => { rects.forEach((r, i) => { dev(r, cells[i].r); cells[i].now = null; }); P.cam0 = cam0; P.rest = rects; };

  // draw one drawing into the scissor rectangle R (device px) of a pair of targets
  const tile = (paper, nd, R, rect, k, now) => {
    const x0 = Math.max(0, Math.floor(R.x)), y0 = Math.max(0, Math.floor(R.y)), x1 = Math.min(paper.width, Math.ceil(R.z)), y1 = Math.min(paper.height, Math.ceil(R.w));
    aim(cam, k, rect, P.W, P.H);
    const nf = P.mat.uniforms.uNF.value; if (paper === P.paperL) { nf.z = cam.near; nf.w = cam.far; } else { nf.x = cam.near; nf.y = cam.far; }
    if (x1 <= x0 || y1 <= y0) return;
    U.uNow.value = now;
    renderer.setClearColor(PAPER, 0);
    for (const [rt, set] of [[paper, 'paper'], [nd, 'nd']]) {
      rt.scissor.set(x0, y0, x1 - x0, y1 - y0);
      useSet(meshes, set, now); renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, cam);
    }
  };
  const same = (a, b) => Math.abs((a.z - a.x) - (b.z - b.x)) < 0.75 && Math.abs((a.w - a.y) - (b.w - b.y)) < 0.75;
  const nowKey = (n) => Math.round(n * 1000);

  // The drawing: every tile is the same camera aimed into its own rectangle, at its own week.
  //   tiles[i] = { rect, cam, now, live, hidden }   live: drawn fresh (it has left its place on the sheet)
  // `budget` is the number of cells that may be drawn again in this call; returns true if some are still stale.
  P.draw = (tiles, budget = 2) => {
    const keep = renderer.autoClear; renderer.autoClear = false;
    const R = P.mat.uniforms.uRects.value, S = P.mat.uniforms.uSrc.value;
    let stale = false;
    // which cell a week can be read from
    const holds = (n, like) => { for (let j = 0; j < 6; j++) if (cells[j].now === n && same(cells[j].r, like)) return j; return -1; };
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i];
      if (t.hidden || !onScreen(t.rect)) { R[i].set(-1, -1, -1, -1); continue; }
      dev(t.rect, R[i]);
      if (t.live) {
        tile(P.paperL, P.ndL, R[i], t.rect, t.cam, t.now);
        S[i].set(R[i].x, R[i].y, 1, 1);
        continue;
      }
      const n = nowKey(t.now), c = cells[i];
      let j = holds(n, c.r);
      if (j < 0) {
        // nobody holds this week yet: the last tile that wants it draws it, the others read that cell
        let last = i; for (let q = i + 1; q < tiles.length; q++) if (!tiles[q].live && !tiles[q].hidden && nowKey(tiles[q].now) === n && same(cells[q].r, c.r)) last = q;
        if (budget > 0) { budget--; tile(P.paperRT, P.ndRT, cells[last].r, P.rest[last], P.cam0, t.now); cells[last].now = n; j = last; }
        else { stale = true; j = i; }
      }
      const src = cells[j].r;
      const k = (src.z - src.x) / Math.max(1e-3, R[i].z - R[i].x);
      S[i].set(src.x, src.y, Math.abs(k - 1) < 1e-4 ? 1 : k, 0); // at rest in its own cell this is pixel for pixel
    }
    renderer.setRenderTarget(null); renderer.autoClear = keep; renderer.setClearColor(PAPER, 1);
    return stale;
  };
  // the site, through the camera of the live drawing
  P.aimReal = (t, week) => {
    aim(cam, t.cam, t.rect, P.W, P.H);
    if (P.onAim) P.onAim(cam);
    useSet(meshes, 'main', week);
  };
  P.real = (t, week) => {
    P.aimReal(t, week);
    if (P.shafts && P.shafts.enabled) { const u = P.shafts.uniforms; u.tDepth.value = P.ao.depthTexture; u.uProjInv.value.copy(cam.projectionMatrixInverse); u.uCamWorld.value.copy(cam.matrixWorld); u.uCamPos.value.copy(cam.position); }
    P.comp.render();
    P.mat.uniforms.tReal.value = P.comp.readBuffer.texture;
  };
  // the site straight to the canvas: one pass, the canvas's own multisampling, tone mapping in the materials
  P.realDirect = (t, week) => {
    P.aimReal(t, week);
    renderer.setRenderTarget(null); renderer.render(scene, cam);
  };
  P.show = (o) => {
    const u = P.mat.uniforms;
    dev(o.rect0, u.uRect0.value);
    u.uNow.value = o.now; u.uGlow.value = o.glow; u.uPour.value = o.pour; u.uRealOn.value = o.realOn ? 1 : 0; u.uRealOnly.value = o.realOnly ? 1 : 0; u.uSide.value = o.side || 0;
    if (o.realOnly) u.uRects.value.forEach((r) => r.set(-1, -1, -1, -1));
    if (o.realOn) { u.uInvVP.value.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse); u.uMpp.value = o.mpp || 0.02; u.uTime.value = (o.time || 0) % 1000; }
    // blended: the site already on the canvas stays under the quad; with no site there, the canvas is cleared first
    const keep = renderer.autoClear; renderer.setRenderTarget(null);
    if (P.direct) { renderer.autoClear = false; if (!o.realOn) renderer.clear(); }
    renderer.render(P.quadScene, P.quadCam);
    renderer.autoClear = keep;
  };
  return P; // the same object the closures above read, so pipe.onAim set by the page is the one P.real calls
}

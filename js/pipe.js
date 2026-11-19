// The pipeline. Two passes make the drawing (paper colour with the week in alpha, then normals + line weight class + depth),
// one composer makes the site, and one full screen shader turns depth and normals into hierarchical architectural ink,
// reveals it by week, and builds the site in behind the same weeks: each part first as a field of scan lines and
// glowing points, cut through the real ground and walls, which then close up into the lit world.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { U, weekly, PAPER } from './world.js';

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

function useSet(scene, set) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const s = o.userData.sets;
    if (!s) { o.visible = set === 'main'; return; }
    const m = s[set];
    if (!m) o.visible = false; else { o.visible = true; o.material = m; }
  });
}

const DISPLAY_FS = `
  uniform sampler2D tPaper, tND, tDepth, tReal;
  uniform vec2 uRes; uniform float uPx, uNear, uFar, uDK;
  uniform float uNow, uGlow, uPour, uRealOn, uRealOnly;
  uniform vec4 uRects[6]; uniform vec4 uRect0; uniform vec3 uPaper, uInk, uAccent, uLime, uDeep;
  uniform mat4 uInvVP; uniform float uMpp, uFx, uTime;
  varying vec2 vUv;
  float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  vec4 R;
  vec2 cl(vec2 p){ return clamp(p, R.xy + .5, R.zw - .5); }
  float dAt(vec2 p){ return texture2D(tDepth, cl(p) / uRes).r; }
  vec4 ndAt(vec2 p){ return texture2D(tND, cl(p) / uRes); }
  vec3 nAt(vec2 p){ vec2 t = ndAt(p).xy * 2. - 1.; return vec3(t, sqrt(max(0., 1. - dot(t, t)))); }
  float wgtAt(vec2 p){ return ndAt(p).z; }
  float wAt(vec2 p){ return texture2D(tPaper, cl(p) / uRes).a * 42. - 2.; }
  float lin(float d){ float z = d * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
  bool inside(vec2 p, vec4 r){ return p.x >= r.x && p.y >= r.y && p.x < r.z && p.y < r.w; }
  void main(){
    vec2 p = gl_FragCoord.xy;
    bool in0 = inside(p, uRect0);
    if (uRealOnly > .5 && in0) { gl_FragColor = vec4(texture2D(tReal, vUv).rgb, 1.); return; }
    int ti = -1;
    for (int i = 0; i < 6; i++) if (inside(p, uRects[i])) { ti = i; R = uRects[i]; }
    if (ti < 0) { gl_FragColor = vec4(uPaper, 1.); return; }
    float tileScale = clamp((R.z - R.x) / (uRes.x * 0.65), 0.0, 1.0);
    float dc = dAt(p);
    bool bg = dc >= 1.;
    vec4 pap = texture2D(tPaper, cl(p) / uRes);
    float week = bg ? -2. : pap.a * 42. - 2.;
    vec3 base = bg ? uPaper : pap.rgb;
    float e = 0., wl = week;
    vec2 o = vec2(uPx, 0.), q = vec2(0., uPx);
    if (bg) {
      wl = -3.;
      for (int i = 0; i < 4; i++) {
        vec2 d = i == 0 ? o : i == 1 ? -o : i == 2 ? q : -q;
        if (dAt(p + d) < 1.) {
          float wg = wgtAt(p + d);
          e = max(e, 0.88 * wg);
          wl = max(wl, wAt(p + d));
        }
      }
      if (wl < -1.5) wl = -2.;
    } else {
      float lc = lin(dc);
      vec3 nc = nAt(p);
      float wc = wgtAt(p);
      // In overview tiles (tileScale < 0.6), attenuate fine interior detail so Tile 06 stays crisp and architectural
      float detailScale = wc < 0.45 ? mix(0.28, 0.72, tileScale) : (wc < 0.7 ? mix(0.55, 0.82, tileScale) : 0.86);
      for (int i = 0; i < 2; i++) {
        vec2 d = i == 0 ? o : q;
        float da = dAt(p + d), db = dAt(p - d);
        float ee = 0.;
        if (da >= 1. || db >= 1.) {
          ee = 0.92;
        } else {
          float d2 = abs(lin(da) + lin(db) - 2. * lc);
          float dn = max(1. - dot(nc, nAt(p + d)), 1. - dot(nc, nAt(p - d)));
          float eDepth = smoothstep(uDK * 1.15, uDK * 2.8, d2);
          float eNorm = smoothstep(.14, .34, dn) * 0.78;
          float wMax = max(wc, max(wgtAt(p + d), wgtAt(p - d)));
          float sScale = wMax < 0.45 ? mix(0.28, 0.72, tileScale) : (wMax < 0.7 ? mix(0.55, 0.82, tileScale) : 0.86);
          ee = max(eDepth, eNorm) * sScale;
        }
        if (ee > .01) wl = max(wl, max(da < 1. ? wAt(p + d) : 0., db < 1. ? wAt(p - d) : 0.));
        e = max(e, ee);
      }
    }
    vec3 col = mix(base, uInk, clamp(e, 0., 0.92));
    // fresh ink: what was drawn in the last weeks glows green, then cools to ink
    float wk = e > .01 ? wl : week;
    if (uGlow > 0. && (e > .01 || base != uPaper)) {
      float g = 1. - clamp((uNow - wk) / .9, 0., 1.);
      if (wk <= uNow + .01) col = mix(col, uAccent, g * g * (e > .01 ? .92 : .32) * uGlow);
    }
    // The world builds itself behind the same weeks, and the drawing stays readable while it does. The site appears
    // as horizontal slices cut through the real ground and walls. They drift and breathe on their own, widen until
    // they meet, and carry a lime edge while they grow. Between them the paper sinks into a green shade in which
    // the ink glows; ahead of the front the ink turns green and points land on the paper.
    if (uRealOn > .5 && in0) {
      float w2 = bg ? .4 : wk;
      float a = uPour - w2;
      vec3 real = texture2D(tReal, vUv).rgb;
      if (uFx < .5) col = mix(col, real, smoothstep(0., .42, a));
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
        col = mix(col, mix(real, real * vec3(.93, 1.05, .86) + uLime * .05, (1. - t) * .75), m);
        col = mix(col, uLime, rim * .82);
        col = mix(col, vec3(.96, 1., .84), step(.993, h21(floor(p / 2.) + tick * 1.3 + 11.)) * (1. - t) * step(0., a) * .85);
      }
    }
    gl_FragColor = vec4(col, 1.);
  }`;

export function makePipe(renderer, scene, cam, opt) {
  const P = { scene, cam };
  const nearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, type: THREE.UnsignedByteType };
  P.paperRT = new THREE.WebGLRenderTarget(4, 4, nearest);
  P.ndRT = new THREE.WebGLRenderTarget(4, 4, nearest);
  P.ndRT.depthTexture = new THREE.DepthTexture(4, 4, THREE.FloatType);
  // the site
  P.comp = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: opt.samples ?? 4 }));
  P.comp.renderToScreen = false;
  P.comp.addPass(new RenderPass(scene, cam));
  if (opt.ao) {
    const ao = new GTAOPass(scene, cam, 4, 4);
    ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.6, thickness: 1.4, scale: 1.1, samples: 12 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 });
    ao.blendIntensity = 0.82;
    weekly(ao.normalMaterial);
    const r0 = ao.render.bind(ao); // glass and the sky stay out of the occlusion
    ao.render = (...a) => { const hid = []; scene.traverse((m) => { if ((m.userData.glass || m.userData.sky) && m.visible) { m.visible = false; hid.push(m); } }); r0(...a); hid.forEach((m) => (m.visible = true)); };
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
  P.comp.addPass(new OutputPass());
  // the display
  P.mat = new THREE.ShaderMaterial({
    uniforms: {
      tPaper: { value: P.paperRT.texture }, tND: { value: P.ndRT.texture }, tDepth: { value: P.ndRT.depthTexture }, tReal: { value: null },
      uRes: { value: new THREE.Vector2() }, uPx: { value: 1 }, uNear: { value: 1 }, uFar: { value: 2 }, uDK: { value: 0.05 },
      uNow: { value: 0 }, uGlow: { value: 0 }, uPour: { value: -1 }, uRealOn: { value: 0 }, uRealOnly: { value: 0 },
      uRects: { value: Array.from({ length: 6 }, () => new THREE.Vector4(-1, -1, -1, -1)) }, uRect0: { value: new THREE.Vector4(-1, -1, -1, -1) },
      uPaper: U.uPaper, uInk: U.uInk, uAccent: U.uAccent, uLime: U.uLime, uDeep: U.uDeep,
      uInvVP: { value: new THREE.Matrix4() }, uMpp: { value: 0.02 }, uFx: U.fx, uTime: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
    fragmentShader: DISPLAY_FS, depthTest: false, depthWrite: false,
  });
  P.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), P.mat); P.quad.frustumCulled = false;
  P.quadScene = new THREE.Scene(); P.quadScene.add(P.quad);
  P.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  P.setSize = (W, H, dpr, dprReal) => {
    P.W = W; P.H = H; P.dpr = dpr;
    const w = Math.round(W * dpr), h = Math.round(H * dpr);
    const wr = Math.round(W * dprReal), hr = Math.round(H * dprReal);
    P.paperRT.setSize(w, h); P.ndRT.setSize(w, h);
    if (P.wr !== wr || P.hr !== hr) {
      P.wr = wr; P.hr = hr;
      if (P.ao && P.ao.normalRenderTarget) {
        P.ao.normalRenderTarget.dispose();
        P.ao.setGBuffer();
        if (P.shafts) P.shafts.uniforms.tDepth.value = P.ao.depthTexture;
      }
      P.comp.setPixelRatio(1); P.comp.setSize(wr, hr);
    }
    P.mat.uniforms.uRes.value.set(w, h);
    // Keep line kernel strictly 1 device pixel so retina screens render razor-sharp 1px architectural lines
    P.mat.uniforms.uPx.value = 1.0;
  };
  // css rect (x, y from top, w, h) to device pixels with y from the bottom, as x0 y0 x1 y1
  const dev = (r, out) => out.set(r.x * P.dpr, (P.H - r.y - r.h) * P.dpr, (r.x + r.w) * P.dpr, (P.H - r.y) * P.dpr);
  const onScreen = (r) => r.x < P.W && r.y < P.H && r.x + r.w > 0 && r.y + r.h > 0;

  // the drawing: every tile is the same camera aimed into its own rectangle, at its own week
  P.draw = (tiles) => {
    const keep = renderer.autoClear; renderer.autoClear = false;
    for (const rt of [P.paperRT, P.ndRT]) { rt.scissorTest = false; renderer.setRenderTarget(rt); renderer.setClearColor(PAPER, 0); renderer.clear(); }
    const R = P.mat.uniforms.uRects.value;
    tiles.forEach((t, i) => {
      if (!onScreen(t.rect) || t.hidden) { R[i].set(-1, -1, -1, -1); return; }
      dev(t.rect, R[i]);
      aim(cam, t.cam, t.rect, P.W, P.H);
      U.uNow.value = t.now; U.uNewFrom.value = t.newFrom;
      const x0 = Math.max(0, Math.floor(R[i].x)), y0 = Math.max(0, Math.floor(R[i].y)), x1 = Math.min(P.paperRT.width, Math.ceil(R[i].z)), y1 = Math.min(P.paperRT.height, Math.ceil(R[i].w));
      for (const [rt, set] of [[P.paperRT, 'paper'], [P.ndRT, 'nd']]) {
        rt.scissor.set(x0, y0, x1 - x0, y1 - y0); rt.scissorTest = true;
        useSet(scene, set); renderer.setRenderTarget(rt); renderer.render(scene, cam);
      }
    });
    renderer.setRenderTarget(null); renderer.autoClear = keep;
    P.mat.uniforms.uNear.value = cam.near; P.mat.uniforms.uFar.value = cam.far;
  };
  // the site, through the camera of tile 01
  P.real = (t) => {
    aim(cam, t.cam, t.rect, P.W, P.H);
    if (P.onAim) P.onAim(cam);
    useSet(scene, 'main');
    if (P.shafts && P.shafts.enabled) { const u = P.shafts.uniforms; u.tDepth.value = P.ao.depthTexture; u.uProjInv.value.copy(cam.projectionMatrixInverse); u.uCamWorld.value.copy(cam.matrixWorld); u.uCamPos.value.copy(cam.position); }
    P.comp.render();
    P.mat.uniforms.tReal.value = P.comp.readBuffer.texture;
  };
  P.show = (o) => {
    const u = P.mat.uniforms;
    dev(o.rect0, u.uRect0.value);
    u.uNow.value = o.now; u.uGlow.value = o.glow; u.uPour.value = o.pour; u.uRealOn.value = o.realOn ? 1 : 0; u.uRealOnly.value = o.realOnly ? 1 : 0;
    if (o.realOnly) u.uRects.value.forEach((r) => r.set(-1, -1, -1, -1));
    if (o.realOn) { u.uInvVP.value.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse); u.uMpp.value = o.mpp || 0.02; u.uTime.value = (o.time || 0) % 1000; }
    renderer.setRenderTarget(null); renderer.render(P.quadScene, P.quadCam);
  };
  return P; // the same object the closures above read, so pipe.onAim set by the page is the one P.real calls
}

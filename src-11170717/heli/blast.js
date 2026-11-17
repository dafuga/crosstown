// blast.js: what a helicopter rocket does where it lands (heli lane, Nov 16), and the smoke and fire it is drawn with.
// Puffs: one pool of camera-facing quads drawn in two calls (smoke, then fire added on top); each puff lives on the card: its place, speed,
// birth and size are written once and the vertex shader moves, swells and fades it.
// boomAt(game, heli, puffs, x, y, z, { car }): the fireball, smoke column, sparks and sound at a point of the three.js world, and the harm:
// the game's own car explosion for cars in the middle of it, the game's own gun damage for people and cars further out, street things knocked
// over, the aircraft itself hurt and shaken if it is close, and a crime for the police.
import * as THREE from 'three';

const N = 640;
const VERT = /* glsl */`
  attribute vec3 aPos; attribute vec3 aVel; attribute vec4 aLife;      // aLife: birth, life (s), size at birth (m), growth (m/s)
  attribute float aSeed; uniform float uT; uniform float uRise; varying float vA; varying vec2 vUv; varying float vSeed; varying float vAge;
  void main() {
    float age = uT - aLife.x, u = clamp(age / max(aLife.y, 0.001), 0.0, 1.0);
    float drag = (1.0 - exp(-age * 2.2)) / 2.2;
    vec3 p = aPos + aVel * drag + vec3(0.0, uRise * age * age * 0.5 + uRise * age * 0.6, 0.0);
    float size = (aLife.z + aLife.w * (1.0 - exp(-age * 1.6)) / 1.6) * step(0.0, age) * step(age, aLife.y);
    float rot = aSeed * 6.283 + age * (aSeed - 0.5) * 1.4, c = cos(rot), s = sin(rot);
    vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c);
    vec4 mv = viewMatrix * vec4(p, 1.0); mv.xy += q * size;
    gl_Position = projectionMatrix * mv; vUv = uv; vA = u; vSeed = aSeed; vAge = age;
  }`;
// the billow: one read of a small repeating cloud picture (made once, below) instead of value noise worked out in every pixel
// (heli lane, Nov 17: sustained rocket fire cost 8 fps on an M2 Max, CHIEF 04:47; the puffs are big and lie over each other)
const NOISE = /* glsl */`
  uniform sampler2D uN;
  float fbm(vec2 p) { return texture2D(uN, p * 0.25).r; }`;
function cloudTex() {
  const n = 128, d = new Uint8Array(n * n * 4); let s = 12345; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const oct = [4, 8, 16, 32].map((k) => { const g = new Float32Array(k * k); for (let i = 0; i < g.length; i++) g[i] = r(); return { k, g }; });
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { let v = 0, w = 0.5, t = 0; for (const o of oct) { const fx = x / n * o.k, fy = y / n * o.k, x0 = Math.floor(fx), y0 = Math.floor(fy), ux = fx - x0, uy = fy - y0, sx = ux * ux * (3 - 2 * ux), sy = uy * uy * (3 - 2 * uy), at = (i, j) => o.g[((j % o.k) * o.k) + (i % o.k)];
      v += w * ((at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) + (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy); t += w; w *= 0.5; } const c = Math.round(v / t * 255); d.set([c, c, c, 255], (y * n + x) * 4); }
  const tex = new THREE.DataTexture(d, n, n, THREE.RGBAFormat); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true; return tex;
}
const FRAG_SMOKE = /* glsl */`
  varying float vA; varying vec2 vUv; varying float vSeed; varying float vAge; uniform vec3 uSun;
  ${NOISE}
  void main() {
    vec2 d = vUv - 0.5; float r = length(d) * 2.0; float n = fbm(vUv * 3.2 + vSeed * 40.0 + vec2(0.0, -vAge * 0.15));
    float a = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.9) * (1.0 - smoothstep(0.55, 1.0, vA)) * smoothstep(0.0, 0.06, vA) * 0.78;
    if (a < 0.01) discard;
    float lit = 0.55 + 0.45 * clamp(d.y * 2.0 + 0.4, 0.0, 1.0);
    vec3 col = mix(vec3(0.035), vec3(0.2, 0.19, 0.18), smoothstep(0.0, 0.5, vA) * (0.5 + vSeed * 0.5)) * lit * uSun;
    gl_FragColor = vec4(col, a);
  }`;
const FRAG_FIRE = /* glsl */`
  varying float vA; varying vec2 vUv; varying float vSeed; varying float vAge;
  ${NOISE}
  void main() {
    vec2 d = vUv - 0.5; float r = length(d) * 2.0; float n = fbm(vUv * 4.0 + vSeed * 30.0 + vec2(0.0, -vAge * 1.2));
    float core = smoothstep(1.0, 0.0, r + (n - 0.5) * 1.1); float k = 1.0 - vA;
    float a = core * k * k; if (a < 0.004) discard;
    vec3 col = mix(vec3(1.0, 0.16, 0.02), vec3(1.0, 0.72, 0.28), core * k) * (1.5 + 9.0 * k * k * core);
    gl_FragColor = vec4(col * a, 1.0);
  }`;

export class Puffs {
  constructor(scene) {
    this.t = 0; this.heads = [0, 0]; this.sets = []; const uN = { value: cloudTex() };
    for (let kind = 0; kind < 2; kind++) {
      const g = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(1, 1); g.index = q.index; g.setAttribute('position', q.getAttribute('position')); g.setAttribute('uv', q.getAttribute('uv'));
      const A = { pos: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3), vel: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3), life: new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4), seed: new THREE.InstancedBufferAttribute(new Float32Array(N), 1) };
      for (let i = 0; i < N; i++) A.life.array[i * 4] = -1e6;
      for (const a of Object.values(A)) a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('aPos', A.pos); g.setAttribute('aVel', A.vel); g.setAttribute('aLife', A.life); g.setAttribute('aSeed', A.seed); g.instanceCount = N;
      const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: kind ? FRAG_FIRE : FRAG_SMOKE, uniforms: { uN, uT: { value: 0 }, uRise: { value: kind ? 0.6 : 1.1 }, uSun: { value: new THREE.Vector3(1, 1, 1) } }, transparent: true, depthWrite: false,
        blending: kind ? THREE.CustomBlending : THREE.NormalBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
      const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = kind ? 9 : 8; mesh.name = kind ? 'heliFire' : 'heliSmoke'; mesh.visible = false; scene.add(mesh);
      this.sets.push({ A, m, mesh, dirty: false, last: -1e6 });
    }
    this.fl = [];
  }
  // one puff: place, speed (m/s, slowed by drag), size at birth, life, growth (m/s), kind 0 smoke / 1 fire
  add(x, y, z, vx, vy, vz, size, life, grow, kind) {
    const S = this.sets[kind], i = this.heads[kind]; this.heads[kind] = (i + 1) % N; const A = S.A;
    A.pos.array[i * 3] = x; A.pos.array[i * 3 + 1] = y; A.pos.array[i * 3 + 2] = z; A.vel.array[i * 3] = vx; A.vel.array[i * 3 + 1] = vy; A.vel.array[i * 3 + 2] = vz;
    A.life.array[i * 4] = this.t; A.life.array[i * 4 + 1] = life; A.life.array[i * 4 + 2] = size; A.life.array[i * 4 + 3] = grow; A.seed.array[i] = Math.random();
    S.dirty = true; S.last = Math.max(S.last, this.t + life);
  }
  flare(x, y, z) { this.add(x, y, z, 0, 0, 0, 0.55, 0.06, 0, 1); }      // the motor's glow, a frame long
  step(dt) { this.t += dt; }
  sync(cam, dt) {
    for (const S of this.sets) {
      S.mesh.visible = this.t < S.last + 0.1; if (!S.mesh.visible) continue; S.m.uniforms.uT.value = this.t;
      if (S.dirty) { S.A.pos.needsUpdate = S.A.vel.needsUpdate = S.A.life.needsUpdate = S.A.seed.needsUpdate = true; S.dirty = false; }
    }
  }
  sun(r, g, b) { this.sets[0].m.uniforms.uSun.value.set(r, g, b); }
}

// ---------------------------------------------------------------- sound: made here, from noise (no file)
let AC = null, noiseBuf = null;
function audio(g) {
  if (AC) return AC; const s = g.sound; AC = (s && (s.ctx || s.ac || s.audio || (s.core && s.core.ctx))) || null;
  if (!AC || !AC.createBufferSource) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } }
  if (AC) { noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return AC;
}
function noise(g, { f0, f1, dur, gain, q = 0.7, type = 'lowpass', delay = 0 }) {
  const ac = audio(g); if (!ac || ac.state !== 'running') return; const t = ac.currentTime + delay;
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true; const fl = ac.createBiquadFilter(); fl.type = type; fl.Q.value = q; fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const gn = ac.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.012); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(fl); fl.connect(gn); gn.connect(ac.destination); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}
function thump(g, gain, delay) {
  const ac = audio(g); if (!ac || ac.state !== 'running') return; const t = ac.currentTime + delay, o = ac.createOscillator(), gn = ac.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.5); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(gn); gn.connect(ac.destination); o.start(t); o.stop(t + 1);
}

const _v = new THREE.Vector3();
export function boomAt(g, heli, puffs, x, y, z, o = {}) {
  const DBG = g.P && g.P.get('hrkdbg') || '';      // measuring only: nopuff | nogame | noharm
  const cam = g.world.camera, dist = cam.position.distanceTo(_v.set(x, y, z)), R = () => Math.random() - 0.5;
  // ---- seen: a flash, a ball of fire that rolls up into smoke, a low ring of dust, sparks thrown out
  if (DBG !== 'nopuff') {
  puffs.add(x, y + 0.6, z, 0, 0, 0, 9, 0.11, 30, 1);
  for (let i = 0; i < 9; i++) { const a = Math.random() * 6.283, e = Math.random() * 1.3, s = 4 + Math.random() * 9; puffs.add(x + R() * 1.5, y + 0.5 + Math.random(), z + R() * 1.5, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 3, Math.sin(a) * Math.cos(e) * s, 2.0 + Math.random() * 1.8, 0.55 + Math.random() * 0.5, 3.4, 1); }
  for (let i = 0; i < 11; i++) { const a = Math.random() * 6.283, e = Math.random() * 1.2, s = 3 + Math.random() * 8; puffs.add(x + R() * 2, y + 0.6 + Math.random() * 1.5, z + R() * 2, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 2.5, Math.sin(a) * Math.cos(e) * s, 2.3 + Math.random() * 1.7, 2.6 + Math.random() * 1.8, 2.9, 0); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + Math.random() * 0.4, s = 11 + Math.random() * 6; puffs.add(x, y + 0.4, z, Math.cos(a) * s, 0.4, Math.sin(a) * s, 1.5, 1.3 + Math.random() * 0.8, 2.6, 0); }
  for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283, e = 0.2 + Math.random() * 1.2, s = 22 + Math.random() * 30; puffs.add(x, y + 0.5, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s, Math.sin(a) * Math.cos(e) * s, 0.22, 0.5 + Math.random() * 0.5, 0, 1); }
  }
  // ---- heard: the crack and the rumble, later and duller with distance (340 m/s)
  const dl = Math.min(2.5, dist / 340), near = Math.max(0.06, Math.min(1, 40 / Math.max(dist, 20)));
  if (g.combat && g.combat.snd && g.combat.audio) g.combat.snd('explosion', { dist }); else { noise(g, { f0: 5200 * near + 500, f1: 180, dur: 0.35, gain: 0.9 * near, delay: dl }); noise(g, { f0: 520, f1: 45, dur: 2.2, gain: 0.8 * Math.sqrt(near), delay: dl }); }
  thump(g, 0.6 * Math.sqrt(near), dl);
  // ---- felt: the camera, and the aircraft if it is close
  const f = heli.f, dh = f.pos.distanceTo(_v);
  if (heli.hasCamera) heli.cam.shake = Math.min(1, heli.cam.shake + Math.min(0.8, 14 / Math.max(dist, 6)));
  if (dh < 16 && !f.onGround) { const k = 1 - dh / 16; f.vel.addScaledVector(_v.subVectors(f.pos, _v.set(x, y, z)).normalize(), 7 * k); f.damage = Math.min(1, f.damage + 0.3 * k * k); }
  // ---- done to the street (only near street level: a burst on a roof or in the air harms nothing below)
  o.dbg = DBG; try { harm(g, x, -z, y, o); } catch (e) { if (!boomAt.err) { boomAt.err = 1; console.log('[hrk] harm threw: ' + (e && (e.stack || e.message))); } }
}
boomAt.whoosh = (g) => { noise(g, { f0: 900, f1: 3800, dur: 0.5, gain: 0.32, type: 'bandpass', q: 0.9 }); noise(g, { f0: 300, f1: 90, dur: 0.6, gain: 0.3 }); };

// The harm, by the game's own combat code (combat.js explode() is the model: it needs a car, so its rules are said again here for a point).
// x, y map metres; z metres above the street. Only a burst near street level harms what is in the street.
const _p = new THREE.Vector3();
function harm(g, x, y, z, o) {
  const C = g.combat, PR = g.__props;
  if (o.dbg !== 'nogame' && C && C.fx && C.fx.explosion) { try { C.fx.explosion(_p.set(x, z + 0.4, -y)); } catch (e) {} }      // the game's own flash, light, debris and scorch ring, under our fire and smoke
  if (z > 4.5 || o.dbg === 'noharm') return;
  if (o.dbg !== 'noprop' && PR && PR.blast) { try { PR.blast(_p.set(x, 0.5, -y), 2, 11); } catch (e) {} }
  if (!C) return;
  const NOW = 5.5, FAR = 12, CARS = 2, PEOPLE = 6;      // a car this near goes up at once (the CARS nearest, the one hit first; the others near are damaged like the far ones); out to FAR it is damaged (and may burn, and blow later); the PEOPLE nearest are thrown, the others run
  let blown = 0;
  const car = (v, kind) => { if (!v) return; const d = Math.hypot(v.x - x, v.y - y); if (d > FAR && v !== o.car) return; const S = C.carState(v, kind); if (!S || S.wrecked || S.dead) return;
    if ((d < NOW && blown < CARS) || v === o.car) { blown++; if (g.player.vehicle === v) { S.hp = 0; C.carHurt(v, S, null); } else C.explode(v, S); } else { S.hp -= 800 * (1 - Math.min(d, FAR) / (FAR + 2)); C.carHurt(v, S, null); } };
  if (o.dbg !== 'nocar') {
  if (o.car) car(o.car, g.traffic && g.traffic.cars && g.traffic.cars.includes(o.car) ? 'traffic' : (g.vehicles || []).includes(o.car) ? 'veh' : 'parked');
  const byD = (l) => l.filter((v) => v && v !== o.car).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y));
  for (const v of byD((g.traffic && g.traffic.cars || []).filter((v) => Math.abs(v.x - x) < FAR && Math.abs(v.y - y) < FAR))) car(v, 'traffic');
  for (const v of byD((g.vehicles || []).slice())) car(v, 'veh');
  if (g.parked && g.parked.near) for (const v of byD(g.parked.near(x, y, FAR, []).slice())) car(v, 'parked');
  }
  if (o.dbg === 'noped') return;
  const near = []; if (g.peds && g.peds.list) for (const p of g.peds.list) if (p.state !== 'down') { const d = Math.hypot(p.x - x, p.y - y); if (d < 9) near.push({ p, kind: 'ped', d }); }
  const ag = g.crowd && g.crowd.sim && g.crowd.sim.agents; if (ag) for (const a of ag) if (!a.gone && !a.down) { const d = Math.hypot(a.x - x, a.y - y); if (d < 9) near.push({ p: a, kind: 'crowd', d }); }
  near.sort((a, b) => a.d - b.d); for (const q of near.slice(0, PEOPLE)) { const p = q.p, d = q.d; C.kill(p, q.kind, { x: p.x, y: p.y, z: 1, dx: (p.x - x) / (d || 1), dy: (p.y - y) / (d || 1), dz: 0.7, part: 'body' }, 6); }
  const H = C.heat; if (H && H.cops && H.hitCop) for (const k of H.cops.slice()) { const d = Math.hypot(k.x - x, k.y - y); if (d < 8 && k.hp > 0) { try { H.hitCop({ kind: 'cop', obj: k, x: k.x, y: k.y, z: 1, nx: 0, ny: 0, nz: 1, dx: (k.x - x) / (d || 1), dy: (k.y - y) / (d || 1), dz: 0.5, part: 'body', t: d }, { dmg: 400, force: 6, name: 'ROCKET' }, true); } catch (e) {} } }
  if (C.scare) C.scare(x, y, 70, 2);
  if (H && H.crime) { try { H.crime('blast', x, y); } catch (e) {} }
  const pl = g.player, dp = Math.hypot(pl.x - x, pl.y - y); if (dp < 8 && !pl.vehicle && !(pl.alt > 3) && !(g.heli && g.heli.piloted)) C.hurt(90 * (1 - dp / 10));
}

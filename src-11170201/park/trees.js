// park/trees.js (park lane): the park's trees, where the lidar says they stand (chunk trees.bin: x, y, height, crown radius, species, leaf 0..1).
// The models are the street layer's generator (streets/trees_gen_next.js: makeTree, SPECIES), scaled to each tree's measured height. A park has
// thousands of trees in view, so three forms:
//   CROWN  every tree of every loaded chunk: a lumpy crown shell drawn as a dither of points of colour (leafed: November colours; bare: the grey-brown
//          haze of twigs). Far chunks have nothing else.
//   MID    trees of near chunks: + the model's low wood (trunk and main limbs), instanced per chunk.
//   NEAR   the nearest trees round the camera (a pool, refilled as the camera moves): the model's full wood and real leaves; their crown shell is hidden.
// November: leaf < 0.25 = bare; the rest turning (yellow, amber, rust, some green left), by a hash of the tree's place.
import * as THREE from 'three';
import { lit, breathe } from './mat.js';
import { BASE } from './ground.js';
import { makeCards } from './cards.js';
let CARDS = null;      // the painted tree cards (cards.js); null with ?parkcards=0 = the old dithered crown shells

const NEAR_R = 46, NEAR_N = 48, PER = 6;
const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
let KIT = null, KITP = null;

async function kit(game) {
  if (KIT) return KIT; if (KITP) return KITP;
  KITP = (async () => { const { makeTree, SPECIES } = await import('../streets/trees_gen_next.js'); const names = Object.keys(SPECIES), V = [];
    const bark = lit(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.93, metalness: 0 }), game.world.shared, { key: 'bark',
      body: `float ba = atan(vWN.z, vWN.x) * 6.0 + vWPos.x * 3.0, bn = fbm(vec2(ba, vWPos.y * 1.1) * 3.0), fur = smoothstep(0.35, 0.6, vnoise(vec2(ba * 5.0, vWPos.y * 2.2)));      // ridges running up the trunk, dark furrows between
             diffuseColor.rgb = mix(vec3(0.020, 0.017, 0.014), vec3(0.075, 0.066, 0.055), bn * (0.45 + 0.55 * fur)) * (0.75 + 0.5 * vnoise(vWPos.xz * 0.4));` });
    { const obc = bark.onBeforeCompile; bark.onBeforeCompile = (sh, r) => { obc(sh, r);      // the foot of the trunk flares into the ground in five uneven roots
        sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n { float fl = exp(-max(transformed.y, 0.0) / 0.5), an = atan(transformed.z, transformed.x); transformed.xz *= 1.0 + fl * (0.55 + 0.3 * sin(an * 5.0 + 1.3)); }'); }; }
    const leaf = lit(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, side: THREE.DoubleSide }), game.world.shared, { key: 'leaf',
      body: `float back = clamp(dot(uSunDir, bakeN) * (gl_FrontFacing ? 1.0 : -1.0), -1.0, 1.0); diffuseColor.rgb *= 0.8 + 0.5 * hash21(floor(vWPos.xz * 7.0) + floor(vWPos.y * 7.0)); diffuseColor.rgb *= back < 0.0 ? vec3(1.35, 1.25, 0.8) : vec3(1.0);` });
    for (let k = 0; k < Math.min(PER, names.length); k++) { const S = SPECIES[names[k]], t = makeTree(S, 11 + k * 7), w = t.wood, lf = t.leaves[Math.min(1, t.leaves.length - 1)];
      const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(w.pos, 3)); wg.setAttribute('normal', new THREE.BufferAttribute(w.nrm, 3)); wg.setIndex(new THREE.BufferAttribute(w.idx, 1)); wg.userData.shared = true;
      const full = wg.clone(); full.userData.shared = true; full.setDrawRange(0, w.cuts[1] || w.cuts[0] || w.idx.length);
      const low = wg; if (w.far && w.far[1] > 0) low.setDrawRange(w.far[0], w.far[1]); else low.setDrawRange(0, Math.min(w.idx.length, w.cuts[3] || w.idx.length));
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lf.pos, 3)); lg.setAttribute('normal', new THREE.BufferAttribute(lf.nrm, 4, true)); lg.setIndex(new THREE.BufferAttribute(lf.idx, 1)); lg.userData.shared = true;
      for (const g of [full, low, lg]) { g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, S.H * 0.55, 0), S.H * 0.8); }
      V.push({ name: names[k], H: t.info.hi ? t.info.hi[1] : S.H, R: t.info.radius || S.crownR, full, low, leaves: lg, tris: { full: full.drawRange.count / 3, low: low.drawRange.count / 3, leaves: lf.idx.length / 3 } });
      await breathe(); }
    // the crown shell: a lumpy unit sphere, centre at the origin, radius 1
    const cg = new THREE.IcosahedronGeometry(1, 3), p = cg.attributes.position, nn = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 0.80 + 0.16 * Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.7 - y * 2.1) + 0.12 * Math.sin(x * 11.0 - z * 9.0 + y * 13.0); nn[i * 3] = x; nn[i * 3 + 1] = y * 0.6 + 0.4; nn[i * 3 + 2] = z; p.setXYZ(i, x * n, y * n * (y < 0 ? 0.7 : 1), z * n); } cg.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); cg.userData.shared = true;      /* smooth normals leaning up: a mass of foliage lit from the sky, never facets */
    const crown = (dens, key, rim) => lit(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }), game.world.shared, { key,
      vpars: 'varying vec3 vLoc;', vbody: 'vLoc = position;', pars: 'varying vec3 vLoc;',
      body: `float dd = distance(cameraPosition, vWPos), cs = clamp(dd / 260.0, 0.07, 1.6);      // the dither's grain grows with distance so it does not shimmer
             vec3 cq = floor(vWPos / cs); float hv = fract(sin(dot(cq, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
             float inner = gl_FrontFacing ? 1.0 : 0.55, rim = abs(dot(normalize(vWN), normalize(cameraPosition - vWPos))), lump = vnoise(vLoc.xz * 4.0 + vLoc.y * 3.0);
             if (hv > ${dens} * inner * mix(1.0, 1.25, smoothstep(40.0, 300.0, dd)) * smoothstep(0.02, ${rim}, rim + (lump - 0.5) * 0.5)) discard;      // thin and ragged towards the outline: sky shows through the edge of a crown
             diffuseColor.rgb *= (0.7 + 0.45 * fract(hv * 7.31)) * (0.75 + 0.5 * lump) * mix(0.5, 1.05, smoothstep(-0.6, 0.8, vLoc.y)) * (gl_FrontFacing ? 1.0 : 0.6);` });
    if (typeof location === 'undefined' || new URLSearchParams(location.search).get('parkcards') !== '0') CARDS = await makeCards(game);
    KIT = { V, bark, leaf, crownGeo: cg, crownLeaf: crown('0.86', 'crownL', '0.55'), crownBare: crown('0.20', 'crownB', '0.9'), names };
    console.log('[game] park: tree kit: ' + V.map((v) => v.name + ' ' + v.tris.full + '/' + v.tris.low + '/' + v.tris.leaves).join(', '));
    return KIT; })();
  return KITP;
}
// November colour of a leafed tree (linear rgb), by place
let SPC = [];      // the data's species: [{ name, leaf, colour '#rrggbb' }] -> linear rgb of the November leaf
export function setSpecies(info) { SPC = (info || []).map((o) => (o && o.colour ? new THREE.Color(o.colour) : null)); }
const PAL = [[0.20, 0.115, 0.028], [0.16, 0.068, 0.022], [0.105, 0.06, 0.03], [0.085, 0.085, 0.03], [0.21, 0.14, 0.04], [0.13, 0.05, 0.02]];      // ochre, rust, brown, dull olive, straw, oxblood
const autumn = (t, out) => { const h = hash(t.x, t.y), g = hash(t.y * 1.7, t.x * 0.3), a = PAL[Math.floor(h * PAL.length) % PAL.length], k = 0.75 + 0.5 * g, c = SPC[t.sp];
  if (c) { const m = 0.55 + 0.25 * hash(t.x * 0.7, t.y * 1.3); return out.setRGB((c.r * 0.30 * (1 - m) + a[0] * m) * k, (c.g * 0.30 * (1 - m) + a[1] * m) * k, (c.b * 0.30 * (1 - m) + a[2] * m) * k); }      // the species' own colour (a leaf in the mass reads darker than the single leaf), a little of the place's mix
  return out.setRGB(a[0] * k, a[1] * k, a[2] * k); };
const BARE = new THREE.Color(0.034, 0.028, 0.024), LEAFED = 0.42;      // a tree whose `leaf` is under LEAFED stands bare (mid November: about half)

// read a chunk's trees; drop those standing in a path or drive (the lidar's crown top can lie over one)
export function parse(buf, paths, W = 8) {      // W floats per tree: 8 in the data (SCHEMA.md: x, y, height, crown radius, species, leaf, trunk diameter, src), 6 in the test park
  const f = new Float32Array(buf), n = Math.floor(f.length / W), out = [];
  const segs = []; for (const p of paths || []) { if (!p.pts || p.tunnel) continue; const hw = (p.w || 3) / 2 + 0.2; for (let k = 0; k + 1 < p.pts.length; k++) segs.push([p.pts[k][0], p.pts[k][1], p.pts[k + 1][0], p.pts[k + 1][1], hw]); }
  for (let k = 0; k < n; k++) { const x = f[k * W], y = f[k * W + 1]; let bad = false;
    for (const s of segs) { if (x < Math.min(s[0], s[2]) - s[4] || x > Math.max(s[0], s[2]) + s[4] || y < Math.min(s[1], s[3]) - s[4] || y > Math.max(s[1], s[3]) + s[4]) continue; const dx = s[2] - s[0], dy = s[3] - s[1], t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (y - s[1]) * dy) / (dx * dx + dy * dy || 1))); if (Math.hypot(x - s[0] - dx * t, y - s[1] - dy * t) < s[4]) { bad = true; break; } }
    if (!bad) out.push({ x, y, h: Math.max(3, f[k * W + 2]), r: Math.max(1.2, f[k * W + 3]), sp: f[k * W + 4] | 0, leaf: f[k * W + 5], dbh: W > 6 ? f[k * W + 6] : 0 }); }
  return out;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const variant = (K, t) => K.V[(t.sp + Math.floor(hash(t.x, t.y) * 3)) % K.V.length];
const woodM = (K, t, z) => { const v = variant(K, t), sy = t.h / v.H, sx = Math.min(sy * 1.35, Math.max(sy * 0.7, t.r / v.R)); _e.set(0, hash(t.y, t.x) * 6.283, 0); _q.setFromEuler(_e); _v.set(t.x, z, -t.y); _s.set(sx, sy, sx); return _m.compose(_v, _q, _s); };
const crownM = (t, z) => { if (CARDS) { _e.set(0, hash(t.x, t.y) * 6.283, 0); _q.setFromEuler(_e); _v.set(t.x, z, -t.y); const w = Math.max(t.r, t.h * 0.2) * CARDS.SX * 1.08; _s.set(w, t.h * CARDS.SY, w); return _m.compose(_v, _q, _s); } const ch = t.h * 0.62, cy = z + t.h - ch * 0.5; _e.set(0, hash(t.x, t.y) * 6.283, 0); _q.setFromEuler(_e); _v.set(t.x, cy, -t.y); _s.set(t.r * 1.05, ch * 0.5, t.r * 1.05); return _m.compose(_v, _q, _s); };

// crowns(game, trees) -> group with two instanced meshes (leafed, bare); each tree gets .ci = [mesh, index]
export async function crowns(game, trees) {
  const K = await kit(game), T = game.terrain, g = new THREE.Group(); g.name = 'park_crowns';
  const A = trees.filter((t) => t.leaf >= LEAFED), B = trees.filter((t) => t.leaf < LEAFED);
  for (const [L, mat, leafed] of [[A, K.crownLeaf, true], [B, K.crownBare, false]]) { if (!L.length) continue; const im = new THREE.InstancedMesh(CARDS ? (leafed ? CARDS.geoLeaf : CARDS.geoBare) : K.crownGeo, CARDS ? (leafed ? CARDS.matLeaf : CARDS.matBare) : mat, L.length); im.name = leafed ? 'park_crown_leaf' : 'park_crown_bare';
    L.forEach((t, k) => { t.z = BASE + T.ground(t.x, t.y) - 0.15; im.setMatrixAt(k, crownM(t, t.z)); im.setColorAt(k, leafed ? autumn(t, _c) : (CARDS ? _c.setRGB(0.36, 0.33, 0.30) : _c.copy(BARE)).multiplyScalar(0.8 + 0.4 * hash(t.x, t.y))); t.ci = [im, k]; });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = leafed || !!CARDS; g.add(im); }
  return g;
}
// mid(game, trees) -> group: low wood per variant; each tree gets .wi = [mesh, index]. The caller adds the trunk circles (this function yields).
export async function mid(game, trees) {
  const K = await kit(game), g = new THREE.Group(); g.name = 'park_wood'; const by = new Map();
  for (const t of trees) { const v = variant(K, t); let a = by.get(v); if (!a) by.set(v, (a = [])); a.push(t); }
  for (const [v, L] of by) { const im = new THREE.InstancedMesh(v.low, K.bark, L.length); im.name = 'park_wood_' + v.name; L.forEach((t, k) => { im.setMatrixAt(k, woodM(K, t, t.z)); t.wi = [im, k]; });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; g.add(im); await breathe(); }
  return g;
}

// the near pool: one per game. update(cx, cy, lists) with lists = the tree arrays of the near chunks
export function nearPool(game, parent) {
  const P = { on: new Set(), meshes: null, n: 0 };
  P.update = async (cx, cy, lists) => { const K = await kit(game);
    if (!P.meshes) { P.meshes = K.V.map((v) => { const w = new THREE.InstancedMesh(v.full, K.bark, NEAR_N), l = new THREE.InstancedMesh(v.leaves, K.leaf, NEAR_N); for (const m of [w, l]) { m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; parent.add(m); } w.name = 'park_near_wood'; l.name = 'park_near_leaves'; return { w, l }; }); }
    const cand = []; for (const L of lists) for (const t of L) { const d = (t.x - cx) * (t.x - cx) + (t.y - cy) * (t.y - cy); if (d < NEAR_R * NEAR_R && t.wi) cand.push([d, t]); }
    cand.sort((a, b) => a[0] - b[0]); const now = new Set(cand.slice(0, NEAR_N).map((c) => c[1]));
    let same = now.size === P.on.size; if (same) for (const t of now) if (!P.on.has(t)) { same = false; break; } if (same) return;
    for (const t of P.on) if (!now.has(t)) { if (t.ci && t.ci[0].parent) { t.ci[0].setMatrixAt(t.ci[1], crownM(t, t.z)); t.ci[0].instanceMatrix.needsUpdate = true; } if (t.wi && t.wi[0].parent) { t.wi[0].setMatrixAt(t.wi[1], woodM(K, t, t.z)); t.wi[0].instanceMatrix.needsUpdate = true; } }
    for (const m of P.meshes) { m.w.count = 0; m.l.count = 0; }
    for (const t of now) { const vi = K.V.indexOf(variant(K, t)), m = P.meshes[vi]; woodM(K, t, t.z); m.w.setMatrixAt(m.w.count++, _m);
      if (t.leaf >= LEAFED) { m.l.setMatrixAt(m.l.count, _m); m.l.setColorAt(m.l.count++, autumn(t, _c)); }
      if (!P.on.has(t)) { if ((CARDS || t.leaf >= LEAFED) && t.ci) { t.ci[0].setMatrixAt(t.ci[1], ZERO);      /* a near tree is its model: its card (or leafed shell) is not drawn */ t.ci[0].instanceMatrix.needsUpdate = true; } t.wi[0].setMatrixAt(t.wi[1], ZERO); t.wi[0].instanceMatrix.needsUpdate = true; } }
    for (const m of P.meshes) { m.w.instanceMatrix.needsUpdate = true; m.l.instanceMatrix.needsUpdate = true; if (m.l.instanceColor) m.l.instanceColor.needsUpdate = true; }
    P.on = now; P.n = now.size; };
  P.forget = (trees) => { for (const t of trees) P.on.delete(t); };
  return P;
}

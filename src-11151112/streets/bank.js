// bank.js (tiles lane, Nov 15): THE FAR BANK of a water the city lists: the land across the river and its buildings, as scenery. Nobody gets there (the
// shore wall of water.js stops the player) and nothing is simulated there. For every entry of city.water the file assets/bank/<name in lower case with
// dashes>.bin is asked for once ('East River' -> bank/east-river.bin); a water without the file draws as before (open water). A city without water asks for
// nothing. ?bank=0 = off (nothing fetched, nothing built).
// The file (lanes/tiles/tools/bank_build.py, from OpenStreetMap) holds outlines and heights only: 'BNK1', u32 JSON length, JSON { box, unit, level, cells, sec },
// sections. Here the walls and roofs are made in the facade material's vertex layout, the way lanes/facades ffar.py writes far.glb (style by height, a seed
// per building, light guessed from height: nothing is baked out there), and drawn with the SAME material object as far.glb, so they take the game's sun, sky,
// haze, night windows and rain exactly as Manhattan's own distant buildings do. The land is a flat mesh 0.3 m above the street level with a wall down into
// the water along its shore; it lies over the water surface (which writes no depth and is drawn last), so the river ends at the far shore.
// window.__bank = { files, buildings, walls, verts, tris, land, ms } for a look.
import * as THREE from 'three';

const LAND_H = 0.3;
const slug = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const hash01 = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7 + 0.5) * 43758.5453; return x - Math.floor(x); };
function read(buf) {
  const dv = new DataView(buf); if (dv.getUint32(0, true) !== 0x314b4e42) throw new Error('not a bank file');      // 'BNK1'
  const n = dv.getUint32(4, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, n))), base = 8 + n, S = {};
  for (const k in head.sec) { const [off, cnt, typ] = head.sec[k]; S[k] = typ === 'u8' ? new Uint8Array(buf, base + off, cnt) : typ === 'u16' ? new Uint16Array(buf, base + off, cnt) : new Uint32Array(buf, base + off, cnt); }
  return { head, S };
}
// the facade material far.glb is drawn with (world.js: farMat); without it the buildings are left out, the land is still made
function farMaterial(world) { let m = null; if (world.farRoot) world.farRoot.traverse((o) => { if (!m && o.isMesh) m = o.material; }); return m; }
let LANDMAT = null;
function landMaterials() {
  if (!LANDMAT) LANDMAT = { land: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }), wall: new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.36, 0.35, 0.33), roughness: 0.93, metalness: 0 }) };
  return LANDMAT;
}
const still = (m) => { m.castShadow = false; m.receiveShadow = false; m.matrixAutoUpdate = false; m.updateMatrix(); return m; };

function buildLand(group, head, S, rep) {
  const [x0, y0] = head.box, u = head.unit, xy = S.land_xy, kind = S.land_kind, nv = kind.length, P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), Cc = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) { const x = x0 + xy[i * 2] * u, y = y0 + xy[i * 2 + 1] * u; P[i * 3] = x; P[i * 3 + 1] = LAND_H; P[i * 3 + 2] = -y; N[i * 3 + 1] = 1;
    // no picture out there: a worn city grey that breaks up a little with place, park green where the map has a park
    const h = hash01(Math.floor(x / 90) * 57 + Math.floor(y / 90), 3) * 0.014; if (kind[i]) { Cc[i * 3] = 0.022 + h; Cc[i * 3 + 1] = 0.043 + h; Cc[i * 3 + 2] = 0.014; } else { Cc[i * 3] = 0.058 + h; Cc[i * 3 + 1] = 0.057 + h; Cc[i * 3 + 2] = 0.054 + h; } }      // (0.17 read as white snow under the game's exposure: runs/bank-shots first day set)
  const idx = new Uint32Array(S.land_idx.length); for (let i = 0; i + 2 < idx.length; i += 3) {      // facing up: counter-clockwise on the map
    const a = S.land_idx[i], b = S.land_idx[i + 1], c = S.land_idx[i + 2], cr = (xy[b * 2] - xy[a * 2]) * (xy[c * 2 + 1] - xy[a * 2 + 1]) - (xy[b * 2 + 1] - xy[a * 2 + 1]) * (xy[c * 2] - xy[a * 2]); idx[i] = a; idx[i + 1] = cr < 0 ? c : b; idx[i + 2] = cr < 0 ? b : c; }
  const M = landMaterials(), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(Cc, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere(); g.computeBoundingBox(); const m = still(new THREE.Mesh(g, M.land)); m.name = 'bank_land'; group.add(m);
  // the wall along the land's outline, from its top down under the water (the outline runs counter-clockwise: the water is on its right)
  const W = [], WN = [], bot = (head.level === undefined ? -1.6 : head.level) - 0.6; let o = 0;
  for (let r = 0; r < S.ring_n.length; r++) { const n = S.ring_n[r]; for (let i = 0; i < n; i++) { const a = (o + i) * 2, b = (o + (i + 1) % n) * 2, ax = x0 + S.ring_xy[a] * u, ay = y0 + S.ring_xy[a + 1] * u, bx = x0 + S.ring_xy[b] * u, by = y0 + S.ring_xy[b + 1] * u, l = Math.hypot(bx - ax, by - ay); if (l < 0.05) continue;
      const nx = (by - ay) / l, nz = (bx - ax) / l; W.push(ax, LAND_H, -ay, ax, bot, -ay, bx, bot, -by, ax, LAND_H, -ay, bx, bot, -by, bx, LAND_H, -by); for (let k = 0; k < 6; k++) WN.push(nx, 0, nz); } o += n; }
  if (W.length) { const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(W, 3)); wg.setAttribute('normal', new THREE.Float32BufferAttribute(WN, 3)); wg.computeBoundingSphere(); wg.computeBoundingBox(); const wm = still(new THREE.Mesh(wg, M.wall)); wm.name = 'bank_wall'; group.add(wm); }
  rep.land += idx.length / 3; rep.tris += idx.length / 3 + W.length / 9;
}

function buildCell(group, head, S, cell, mat, rep, tag) {
  const [x0, y0] = head.box, u = head.unit, [b0, nb, p0] = cell; let np = 0; for (let b = b0; b < b0 + nb; b++) np += S.b_n[b];
  const nv = np * 5, P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), UV = new Float32Array(nv * 2), U1 = new Float32Array(nv * 2), U2 = new Float32Array(nv * 2), U3 = new Float32Array(nv * 2), Cc = new Float32Array(nv * 4), I = [];
  let v = 0, po = p0; const put = (x, y, z, nx, ny, nz, a, b, c, d, e, f, g, h, sk, su, bo) => { const i = v++; P[i * 3] = x; P[i * 3 + 1] = z; P[i * 3 + 2] = -y; N[i * 3] = nx; N[i * 3 + 1] = nz; N[i * 3 + 2] = -ny;
    UV[i * 2] = a; UV[i * 2 + 1] = 1 - b; U1[i * 2] = c; U1[i * 2 + 1] = 1 - d; U2[i * 2] = e; U2[i * 2 + 1] = 1 - f; U3[i * 2] = g; U3[i * 2 + 1] = 1 - h; Cc[i * 4] = sk; Cc[i * 4 + 1] = su; Cc[i * 4 + 2] = bo; Cc[i * 4 + 3] = 1; return i; };
  const BW = [2.2, 3.0, 1.5, 1.55, 3.3], FH = [3.15, 3.7, 3.9, 3.05, 4.0], GH = [3.9, 5.2, 5.4, 4.2, 4.8];
  for (let b = b0; b < b0 + nb; b++) {
    const n = S.b_n[b], H = S.b_h[b] / 10, z0 = S.b_z[b] / 10, id = tag + b, r = hash01(id, 1), seed = (Math.floor(hash01(id, 2) * 511.99) + 0.5) / 512;
    // the style by height, as ffar.py picks it for far.glb: towers mostly glass, mid-rise mixed, low mostly brick
    const st = H > 110 ? (r < 0.5 ? 2 : r < 0.75 ? 3 : 1) : H > 38 ? (r < 0.35 ? 1 : r < 0.5 ? 2 : r < 0.75 ? 4 : 3) : (r < 0.4 ? 0 : r < 0.75 ? 4 : r < 0.9 ? 1 : 3);
    const X = (i) => x0 + S.b_xy[(po + i % n) * 2] * u, Y = (i) => y0 + S.b_xy[(po + i % n) * 2 + 1] * u, sky = (z) => 0.35 + 0.65 * Math.min(1, z / Math.max(H, 1)), sun0 = z0 < 12 ? 0.35 : 1;
    for (let i = 0; i < n; i++) { const ax = X(i), ay = Y(i), bx = X(i + 1), by = Y(i + 1), L = Math.hypot(bx - ax, by - ay); if (L < 0.3) continue; const nx = (by - ay) / L, ny = -(bx - ax) / L;
      const bw = L / Math.max(1, Math.round(L / BW[st])), k = L > 1.5 ? 1 : 4, q = v;
      put(ax, ay, z0, nx, ny, 0, 0, z0, st + seed, H, bw, FH[st], GH[st] + 64 * k, z0, sky(z0), sun0, 0.12); put(bx, by, z0, nx, ny, 0, L, z0, st + seed, H, bw, FH[st], GH[st] + 64 * k, z0, sky(z0), sun0, 0.12);
      put(bx, by, H, nx, ny, 0, L, H, st + seed, H, bw, FH[st], GH[st] + 64 * k, z0, 1, 1, 0.1); put(ax, ay, H, nx, ny, 0, 0, H, st + seed, H, bw, FH[st], GH[st] + 64 * k, z0, 1, 1, 0.1);
      I.push(q, q + 1, q + 2, q, q + 2, q + 3); rep.walls++; }
    const c = []; for (let i = 0; i < n; i++) c.push(new THREE.Vector2(X(i), Y(i))); const q = v; for (let i = 0; i < n; i++) put(c[i].x, c[i].y, H, 0, 0, 1, c[i].x, c[i].y, 9 + seed, H, 0, 0, 0, 0, 1, 1, 0.1);
    for (const t of THREE.ShapeUtils.triangulateShape(c, [])) { const A = c[t[0]], B = c[t[1]], D = c[t[2]], cr = (B.x - A.x) * (D.y - A.y) - (B.y - A.y) * (D.x - A.x); I.push(q + t[0], q + (cr < 0 ? t[2] : t[1]), q + (cr < 0 ? t[1] : t[2])); }
    po += n; rep.buildings++;
  }
  const cut = (a, k) => new THREE.BufferAttribute(a.subarray(0, v * k), k), g = new THREE.BufferGeometry();
  g.setAttribute('position', cut(P, 3)); g.setAttribute('normal', cut(N, 3)); g.setAttribute('uv', cut(UV, 2)); g.setAttribute('uv1', cut(U1, 2)); g.setAttribute('uv2', cut(U2, 2)); g.setAttribute('uv3', cut(U3, 2)); g.setAttribute('color', cut(Cc, 4));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(I), 1)); g.computeBoundingSphere(); g.computeBoundingBox();
  const m = still(new THREE.Mesh(g, mat)); m.name = 'bank_' + tag + '_' + b0; group.add(m); rep.verts += v; rep.tris += I.length / 3;
}

// once per map, from water.js waterInit. Not waited for: the ground's build goes on, the bank is in the scene when its file has come (a few hundred kB).
export function bankInit(game, waters) {
  const world = game.world, P = game.P; if (!world || world.__bank || !waters || !waters.length || (P && P.get && P.get('bank') === '0')) return null; world.__bank = 1;
  const A = (P && P.get && P.get('bankdir')) || 'assets/bank/', rep = { files: [], buildings: 0, walls: 0, verts: 0, tris: 0, land: 0, ms: 0 }; window.__bank = rep;
  const group = new THREE.Group(); group.name = 'streets_ground_bank'; world.scene.add(group);
  const one = async (w, k) => {
    const url = A + slug(w.name) + '.bin', r = await fetch(url); if (!r.ok) { rep.files.push(url + ' ' + r.status); return; }
    const buf = await r.arrayBuffer(), { head, S } = read(buf); let t0 = performance.now(); buildLand(group, head, S, rep); rep.ms += performance.now() - t0;
    let mat = farMaterial(world); for (let i = 0; !mat && i < 100; i++) { await new Promise((res) => setTimeout(res, 200)); mat = farMaterial(world); }      // far.glb may still be on its way
    if (!mat) console.log('[bank] no far city material: the far bank has land only');
    // one 700 m cell of buildings at a time, the page's turn between two: no long task from this at load or after it
    if (mat) for (const c of head.cells) { t0 = performance.now(); buildCell(group, head, S, c, mat, rep, k * 100000); rep.ms += performance.now() - t0; await new Promise((res) => setTimeout(res, 0)); }
    rep.files.push(url + ' ' + buf.byteLength); rep.ms = Math.round(rep.ms);
  };
  rep.done = Promise.all(waters.map((w, k) => one(w, k).catch((e) => { console.log('[bank] ' + w.name + ' not built: ' + (e && e.message)); }))).then(() => { rep.ready = 1; console.log('[water] far bank: ' + rep.buildings + ' buildings, ' + rep.verts + ' vertices, ' + Math.round(rep.tris) + ' triangles, built in ' + rep.ms + ' ms at ' + (performance.now() / 1000).toFixed(1) + ' s (' + rep.files.join(', ') + ')'); });
  return rep;
}

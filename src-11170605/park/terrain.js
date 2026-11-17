import * as THREE from 'three';      /* park lane, Nov 16: the instanced-mesh lift below */
// park/terrain.js (park lane, Nov 15): the ONE idea of ground height for the game.
//   game.terrain = { h(x, y), n(x, y, out) }   h = metres above the flat street level at map (x, y); 0 everywhere outside Central Park.
// Heights come from the park's data chunks (SCHEMA.md: Int16 cm, 129 x 129 samples every 2 m per 256 m chunk); a chunk whose heights are not
// loaded answers 0. Bridges register DECKS (bridge.js): on a deck the answer is the deck's own profile, not the ground under it.
// The sim stays flat (x, y; z = height above the ground where it stands). hook(game) lifts what is DRAWN: car batches (with pitch and roll from
// the slope), seated drivers, the player on foot, the lead's pedestrians, the chase camera. The crowd reads game.terrain in crowd/render.js.
export const CELL = 256, N = 129, STEP = 2;

export function makeTerrain(outline) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of outline) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const H = new Map(), decks = [], key = (i, j) => i * 4096 + j;
  const T = { box: [x0, y0, x1, y1], chunks: H, decks, base: 0.16 };
  T.inBox = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  // point in the park's outline (the whole park; a few hundred edges): used at load time, not per frame
  T.owns = (x, y) => { if (!T.inBox(x, y)) return false; let c = false; for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) { const a = outline[i], b = outline[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  T.set = (i, j, cm) => { H.set(key(i, j), cm); }; T.drop = (i, j) => { H.delete(key(i, j)); };
  T.get = (i, j) => H.get(key(i, j));
  // the ground alone (no decks)
  T.ground = (x, y) => { if (x < x0 || x > x1 || y < y0 || y > y1) return 0; const i = Math.floor(x / CELL), j = Math.floor(y / CELL), a = H.get(key(i, j)); if (!a) return 0;
    const u = (x - i * CELL) / STEP, v = (y - j * CELL) / STEP, iu = Math.min(N - 2, u | 0), iv = Math.min(N - 2, v | 0), fu = u - iu, fv = v - iv, o = iv * N + iu;
    return ((a[o] * (1 - fu) + a[o + 1] * fu) * (1 - fv) + (a[o + N] * (1 - fu) + a[o + N + 1] * fu) * fv) * 0.01; };
  // a deck: { pts: [[x, y, h] ...] (the way's line with the deck's height in the relief frame), hw (half width) }. On its corridor the answer is the
  // deck where that is higher than the ground (the data's height grid holds the LOWER way under a bridge or arch).
  T.addDeck = (d) => { let a = 1e9, b = 1e9, c = -1e9, e = -1e9; for (const p of d.pts) { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); e = Math.max(e, p[1]); } d.bb = [a - d.hw, b - d.hw, c + d.hw, e + d.hw]; decks.push(d); return d; };
  T.removeDeck = (d) => { const k = decks.indexOf(d); if (k >= 0) decks.splice(k, 1); };
  const deckAt = (x, y) => { let best = null, bo = 1e9; for (let q = 0; q < decks.length; q++) { const d = decks[q], bb = d.bb; if (x < bb[0] || y < bb[1] || x > bb[2] || y > bb[3]) continue; const P = d.pts;
      for (let k = 0; k + 1 < P.length; k++) { const ax = P[k][0], ay = P[k][1], dx = P[k + 1][0] - ax, dy = P[k + 1][1] - ay, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1))), o = Math.hypot(x - ax - dx * t, y - ay - dy * t);
        if (o <= d.hw && o < bo) { bo = o; best = P[k][2] + (P[k + 1][2] - P[k][2]) * t; } } } return best; };
  T.h = (x, y) => { if (x < x0 || x > x1 || y < y0 || y > y1) return 0; const g = T.ground(x, y); if (decks.length) { const z = deckAt(x, y); if (z !== null && z > g) return z; } return g; };
  // unit normal in MAP axes (east, north, up)
  T.n = (x, y, out = {}) => { const e = 1, gx = (T.h(x + e, y) - T.h(x - e, y)) / (2 * e), gy = (T.h(x, y + e) - T.h(x, y - e)) / (2 * e), l = Math.hypot(gx, gy, 1); out.x = -gx / l; out.y = -gy / l; out.z = 1 / l; return out; };
  return T;
}

// lift what is drawn. Every wrapper leaves the call exactly as it was outside the park's box.
export function hook(game) {
  const T = game.terrain, g = game; if (!T || T.hooked) return; T.hooked = true;
  const slope = (x, y, h, len, wid, out) => { const c = Math.cos(h), s = Math.sin(h), a = len * 0.36, b = wid * 0.4;
    const f = T.h(x + c * a, y + s * a), r = T.h(x - c * a, y - s * a), R = T.h(x + s * b, y - c * b), L = T.h(x - s * b, y + c * b);
    out.z = (f + r + R + L) * 0.25; out.pitch = Math.atan2(f - r, 2 * a); out.roll = Math.atan2(L - R, 2 * b); return out; };
  const _s = {};
  // 1. cars: every batch's add(x, y, z, h, roll, pitch, ...)
  const wrapAll = () => { for (const k in g.batches) { const B = g.batches[k]; if (!B || B.__park) continue; B.__park = true; const add0 = B.add.bind(B), len = (B.def && B.def.len) || 4.5, wid = (B.def && B.def.wid) || 1.8;
    B.add = function (x, y, z, h, roll, pitch, ...rest) { if (T.inBox(x, y)) { slope(x, y, h, len, wid, _s); const own = T.owns(x, y); if (own || _s.z !== 0 || _s.pitch !== 0 || _s.roll !== 0) return add0(x, y, (own ? Math.max(z || 0, T.base) : (z || 0)) + _s.z, h, (roll || 0) + _s.roll, (pitch || 0) + _s.pitch, ...rest); }      /* in the park a car stands on the park's ground, drawn T.base above the roadway */ return add0(x, y, z, h, roll, pitch, ...rest); }; }
  // 2. drivers seen through the glass of traffic cars: add(x, y, z, h)
  for (const d of g.drivers || []) { if (d.__park) continue; d.__park = true; const add0 = d.add.bind(d); d.add = (x, y, z, h) => add0(x, y, T.inBox(x, y) ? z + T.h(x, y) : z, h); } };
  // merge lane, batch 6: the same lift for the streets layer's car drawing (streets/vehicles_next.js draw(): it replaces game.batches with a stub, so wrapAll() above finds nothing to wrap
  // in the ordinary game and every car in the park was drawn at street level over or under the park's ground). ?parkcars=0: off, the hand-over as it came.
  const _c = {}; if (!(g.P && g.P.get('parkcars') === '0')) T.car = (x, y, h, len, wid, z) => { slope(x, y, h, len || 4.5, wid || 1.8, _c); _c.z = (T.owns(x, y) ? Math.max(z || 0, T.base) : (z || 0)) + _c.z; return _c; };
  if (!(g.P && g.P.get('parkcam') === '0')) T.camFloor = (x, y) => (T.inBox(x, y) ? T.h(x, y) : 0);      /* merge lane, batch 6: read by the guns' own camera (combat/combat.js placeCamera), which the wrappers below never see while a gun is in the hand */
  wrapAll();      /* and again before every sync: batches made or replaced after the park started (a car type loaded later) are wrapped too */
  // 3. the chase camera: its target rides the ground, and the camera itself never goes under it
  const ct0 = g.camTarget.bind(g); g.camTarget = function () { const t = ct0(); if (T.inBox(t.x, t.y)) t.z += T.h(t.x, t.y); return t; };
  const pc0 = g.placeCamera.bind(g); g.placeCamera = function (dt) { pc0(dt); const p = g.world.camera.position; if (T.inBox(p.x, -p.z)) { const f = T.h(p.x, -p.z) + 0.4; if (p.y < f) p.y = f; } };
  // 4. things drawn as objects set afresh each frame (the player, the lead's pedestrians): lifted after the game has placed them.
  // The object remembers what was added, so a frame in which nobody re-placed it is not lifted twice.
  const lift = (o, x, y, tilt) => { if (!o) return; const u = o.userData, base = (u.__py !== undefined && o.position.y === u.__py) ? u.__py - u.__ph : o.position.y, h = T.inBox(x, y) ? T.h(x, y) : 0; o.position.y = base + h; u.__py = o.position.y; u.__ph = h; };
  // 5. (Nov 16) things drawn as instanced meshes with a matrix per instance: the motorbike (g.moto.model: body, fork, wheels, stand), the riders on
  // traffic motorbikes ('moto_rider') and the delivery riders and their bikes ('rider'). Their setMatrixAt is wrapped: the matrix's height takes the
  // ground under it. No pitch from the slope. Meshes made later are picked up by the scan (every 120 syncs).
  const _m = new THREE.Matrix4(), liftIM = (im) => { if (!im || im.__park || !im.setMatrixAt) return; im.__park = true; const set0 = im.setMatrixAt.bind(im);
    im.setMatrixAt = (i, m) => { const e = m.elements, x = e[12], y = -e[14]; if (T.inBox(x, y)) { const h = T.h(x, y); if (h !== 0) { _m.copy(m); _m.elements[13] += h; return set0(i, _m); } } return set0(i, m); }; };
  let scanN = 0; const scanIM = () => { if (scanN++ % 120) return; const D = g.moto && g.moto.model; if (D) for (const k of ['body', 'fork', 'wheel', 'stand']) liftIM(D[k]); for (const o of g.world.scene.children) if (o.isInstancedMesh && (o.name === 'rider' || o.name === 'moto_rider')) liftIM(o); };
  const liftPlayer = () => { const pl = g.player; if (pl && pl.vis && pl.vis.object) { const v = pl.vehicle; if (v) { if (T.inBox(v.x, v.y) || pl.vis.object.userData.__ph) { const o = pl.vis.object; lift(o, o.position.x, -o.position.z); } } else lift(pl.vis.object, pl.x, pl.y); } };
  // (Nov 16) and once more as the frame is drawn: the motorbike places its rider in a sync hook of its own that runs after this one, so the rider sat
  // at street level over a bike that stood on the park's ground (pod still p2). lift() remembers what it added, so the second call adds nothing twice.
  { const w = g.world, r0 = w.render.bind(w); w.render = function (t, focus) { try { liftPlayer(); } catch (e) {} return r0(t, focus); }; }
  const sv0 = g.syncVisuals.bind(g);
  g.syncVisuals = function (dt) { wrapAll(); try { scanIM(); } catch (e) {} sv0(dt); const pl = g.player;
    liftPlayer();
    const L = g.peds && g.peds.list; if (L) for (let i = 0; i < L.length; i++) { const p = L[i]; if (p.vis && p.vis.object && (T.inBox(p.x, p.y) || p.vis.object.userData.__ph)) lift(p.vis.object, p.x, p.y); } };
}

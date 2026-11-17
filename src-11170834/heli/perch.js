// perch.js: the top of the Empire State Building as a place to land, and a rifle with a scope on any high roof (heli lane, Nov 16;
// Matt: "take a helicopter up to the top of the Empire State building and play sniper").
// 1. Landing marks on the Empire State Building as the game draws it: the 86th-floor terrace (about 323 m) and, where it is wide enough, the roof
//    above it (about 331 m). They are found in the helicopter's height picture of the city (the widest level patch at each level), so they sit on the
//    building as drawn. Both are ordinary pads: land, lower the collective, F to get out.
// 2. On foot on a roof more than 15 m up the guns work (before: none above 2 m, combat.js canCarry). Bullets are cast against the city as
//    it stands (the height picture: roofs have tops, the street is below) and then, for the last metres above the street, by the game's own
//    ray for people, cars and street things. A rifle reaches 900 m from a roof.
// 3. The scope: on such a roof, aiming a rifle (right mouse / left trigger) looks through a telescopic sight: 6x, the wheel changes it
//    (3x, 6x, 12x), the look slows with the power, one round at a time, heavy.
// 4. From up there the street is alive where you look: cars, walkers and the crowd are put round the place in the street the eye rests on.
// 5. Over the mark, the last 14 m down are helped onto it (?perchassist=0 = hands only).
// ?perch=0: this file is never fetched: no marks, no guns on roofs. heli.js calls step(dt), sync(dt), drawHud(hud).
import * as THREE from 'three';
import { WEAPONS } from '../combat/combat.js';

const HIGH = 15, REACH = 900, ZOOMS = [15, 7.5, 3.75], LONG = ['rifle', 'sniper'];      // ZOOMS: fields of view (degrees): 3x, 6x, 12x of the rifle's own 47
const SNIPE = { auto: false, rpm: 46, dmg: 600, spread: 0, hip: 0, bloom: 0, bloomMax: 0, force: 3 };
const _v = new THREE.Vector3(), _d = new THREE.Vector3();

export function addPerch(heli, ctx) {
  const g = heli.g, H = heli.heights, W = g.world, pl = g.player;
  const S = { pads: [], on: false, scoped: false, zoom: 1, u: 0, hintT: 99, wrapped: false, eye: new THREE.Vector3(), dir: new THREE.Vector3(), yaw0: 0, pitch0: 0, saved: null, tries: 0, shots: 0 };

  // ---------------------------------------------------------------- 1. the landing marks
  const esb = (g.city.buildings || []).filter((b) => b.name === 'Empire State Building' && b.poly);
  let ex = 0, ey = 0, en = 0; for (const b of esb) if (b.h > 300) for (const p of b.poly) { ex += p[0]; ey += p[1]; en++; }
  if (en) { ex /= en; ey /= en; S.esb = { x: ex, y: ey }; }
  const sq = (x, y) => (H.hf && x > H.hfX0 + 1 && x < H.hfX1 - 1 && y > H.hfY0 + 1 && y < H.hfY1 - 1 ? Math.floor((y - H.hfY0) / H.hfSq) * H.hfTX + Math.floor((x - H.hfX0) / H.hfSq) : -1);
  // the level most of the building's top stands at between two heights, then the roomiest level square at it
  function level(lo, hi) { const n = new Map(); for (let dy = -34; dy <= 34; dy += 2) for (let dx = -34; dx <= 34; dx += 2) { const t = H.top(ex + dx, ey + dy, 1e4); if (t > lo && t < hi) { const k = Math.round(t * 2) / 2; n.set(k, (n.get(k) || 0) + 1); } } let best = null, bn = 0; for (const [k, c] of n) if (c > bn) { bn = c; best = k; } return bn >= 12 ? best : null; }
  // the best place to put an aircraft down at level z: the mast 5.6 m or more from anything higher (the disc is 5.35 m) if the level allows,
  // the skids 2.2 m or more in from the drop; among equals, the one furthest along `want`. Its heading lies along the wall.
  function patch(z, want) {
    let best = null; const lv = (x, y) => { const t = H.top(x, y, 1e4); return t > z + 1 ? 1 : t < z - 1 ? -1 : 0; };
    for (let dy = -36; dy <= 36; dy += 1) for (let dx = -36; dx <= 36; dx += 1) { const cx = ex + dx, cy = ey + dy; if (lv(cx, cy) !== 0) continue; let wall = 12, edge = 12, wa = 0;
      for (let r = 0.5; r <= 11 && (r < wall || r < edge); r += 0.5) for (let i = 0, n = Math.max(12, Math.round(r * 6)); i < n; i++) { const a = i / n * 6.2832, q = lv(cx + Math.cos(a) * r, cy + Math.sin(a) * r); if (q > 0 && r < wall) { wall = r; wa = a; } if (q < 0 && r < edge) edge = r; }
      if (edge < 2.2 || wall < 3.5) continue; const sc = Math.min(Math.min(wall, 8) - 5.6, (Math.min(edge, 4) - 2.2) * 1.5) + (dx * want[0] + dy * want[1]) * 0.004;
      if (!best || sc > best.sc) best = { x: cx, y: cy, z: H.top(cx, cy, 1e4), sc, wall, edge, wa, size: Math.max(5, Math.min(13, 2 * Math.min(wall, edge + 1.5))) }; }
    return best;
  }
  function marks() {
    const zD = level(315, 327.5), zR = level(327.5, 345), gh = g.city.meta.grid_deg * Math.PI / 180 + Math.PI / 2, out = [];
    // the terrace mark on the side toward Madison Square (south-west on the map: where the player comes from), the roof mark wherever the roof is widest
    const d = zD !== null ? patch(zD, [-0.5, -0.87]) : null; if (d) out.push({ name: 'Empire State Building · 86th floor terrace', x: d.x, y: d.y, z: d.z, h: d.wall < 11 ? d.wa + Math.PI / 2 : gh, roof: true, esb: true, size: d.size, wall: d.wall, edge: d.edge });
    const r = zR !== null ? patch(zR, [0.5, 0.87]) : null; if (r) out.push({ name: 'Empire State Building · roof', x: r.x, y: r.y, z: r.z, h: r.wall < 11 ? r.wa + Math.PI / 2 : gh, roof: true, esb: true, size: r.size, wall: r.wall, edge: r.edge });
    if (!out.length) return false;
    const old = heli.padGroup && heli.padGroup.children[0];
    for (const p of out) { heli.pads.push(p); S.pads.push(p);
      if (old) { const s = p.size / 13, m = new THREE.Mesh(old.geometry, old.material); m.position.set(p.x, p.z + 0.04, -p.y); m.rotation.y = p.h; m.scale.set(s, 1, s); m.receiveShadow = true; m.renderOrder = 3; heli.padGroup.add(m); } }
    console.log('[perch] Empire State Building marks: ' + out.map((p) => p.name.split('· ')[1] + ' at ' + p.x.toFixed(0) + ', ' + p.y.toFixed(0) + ', ' + p.z.toFixed(1) + ' m (mark ' + p.size.toFixed(0) + ' m, wall ' + p.wall + ' m, drop ' + p.edge + ' m)').join('; '));
    return true;
  }
  function tryMarks() {
    if (S.pads.length || !S.esb || S.tries > 40) return; const k = sq(ex, ey); if (k < 0) { S.tries = 99; return; }
    if (!H.hfDone[k]) return;      // that square of the height picture is not taken yet (it comes from the queue a few seconds after the load)
    S.tries++; if (H.top(ex, ey, 1e4) < 300) return;      // the area's buildings are not drawn yet: the square is taken again when its set arrives
    if (!marks()) { S.tries += 9; console.log('[perch] no level place found on the Empire State Building yet (deck ' + level(315, 327.5) + ', roof ' + level(327.5, 345) + ')'); }
  }

  // ---------------------------------------------------------------- 2. guns on a roof
  const roofNow = () => !!pl.roof && pl.alt > HIGH && !pl.vehicle && !pl.busy && !heli.piloted && !heli.busy && !heli.hasCamera && !(g.fly && g.fly.on);
  function wrap(C) {
    S.wrapped = true; S.C = C;
    const carry0 = C.canCarry.bind(C); C.canCarry = function () { return S.on ? true : carry0(); };
    const cast0 = C.cast;
    C.cast = function (ox, oy, oz, dx, dy, dz, tmin, tmax) {
      if (!S.on || !(oz > HIGH - 4)) return cast0.call(this, ox, oy, oz, dx, dy, dz, tmin, tmax);
      let through = false; if (S.scoped) { const e = S.eye, q = S.dir; if (dx * q.x - dy * q.z + dz * q.y > 0.9986 && Math.abs(ox - e.x) + Math.abs(oy + e.z) + Math.abs(oz - e.y) < 12) { ox = e.x; oy = -e.z; oz = e.y; dx = q.x; dy = -q.z; dz = q.y; tmin = 6; through = true; } }      /* through the scope the round goes where the scope looks, whichever camera the frame left behind; and it starts 6 m out, where the picture starts (the renderer's near plane up there): he leans over the edge, and what the eye does not see of his own roof does not stop the round */
      const far = Math.max(tmax, LONG.includes(this.slot) ? REACH : 0);
      // the first solid on the way, by the height picture
      let t = Math.max(tmin, 0.3), st = 1.5, ts = -1;
      while (t < far) { const z = oz + dz * t; if (z < -2) { ts = t; break; } const inS = H.top(ox + dx * t, oy + dy * t, z + 0.5) > z; if (through) { if (inS) { t += st; continue; } through = false;     /* the scope's picture starts 6 m out, inside the roof he stands on when he looks down across it: the eye sees the street through it, and so does the round, until it is out in the air */ } if (inS) { let lo = Math.max(tmin, t - st), hi = t; for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2, zm = oz + dz * m; if (H.top(ox + dx * m, oy + dy * m, zm + 0.5) > zm) hi = m; else lo = m; } ts = hi; break; } t += st; st = Math.min(9, st * 1.07); }
      const none = { kind: 'none', t: far, x: ox + dx * far, y: oy + dy * far, z: oz + dz * far, nx: -dx, ny: -dy, nz: -dz };
      if (ts < 0) return none;
      const hz = oz + dz * ts, solid = { kind: hz < 0.6 ? 'ground' : 'wall', t: ts, x: ox + dx * ts, y: oy + dy * ts, z: Math.max(hz, 0), nx: hz < 0.6 || dz < -0.5 ? 0 : -dx, ny: hz < 0.6 || dz < -0.5 ? 0 : -dy, nz: hz < 0.6 || dz < -0.5 ? 1 : 0 };
      if (hz > 7 || dz > -0.02) return solid;      // it ends on a roof or a high wall: nobody there
      // the last metres above the street: the game's own ray (people, cars, street things, shop fronts), started where the round comes down to 9 m
      const tS = Math.max(tmin, ts - 9 / -dz), h = cast0.call(this, ox + dx * tS, oy + dy * tS, oz + dz * tS, dx, dy, dz, 0, ts - tS + 1.5);
      if (h && h.kind !== 'none') { h.t += tS; return h; }
      return solid;
    };
    console.log('[perch] guns work on roofs above ' + HIGH + ' m; a rifle reaches ' + REACH + ' m and has a scope there');
  }
  const longGun = () => S.C && LONG.includes(S.C.slot);
  function scope(on) {
    if (on === S.scoped) return; S.scoped = on; const R = WEAPONS.rifle;
    if (on) { if (S.C.slot === 'rifle' && R && !S.saved) { S.saved = {}; for (const k in SNIPE) { S.saved[k] = R[k]; R[k] = SNIPE[k]; } } }
    else { if (S.saved && R) { for (const k in S.saved) R[k] = S.saved[k]; S.saved = null; } pl.vis.object.visible = true; }
  }
  addEventListener('wheel', (e) => { if (!S.scoped) return; S.zoom = Math.max(0, Math.min(ZOOMS.length - 1, S.zoom + (e.deltaY < 0 ? 1 : -1))); e.stopImmediatePropagation(); e.preventDefault(); }, { capture: true, passive: false });

  // ---------------------------------------------------------------- 4. the street below is alive where you look
  // The game puts cars and people round the player's own spot (game.focus) and the crowd round the camera: from 320 m up that is the foot of
  // the tower, out of sight. On a high roof the street life is put round the WATCH POINT instead: the place in the street the eye rests on
  // (at most 235 m out, so the cars there are still inside the game's own drawing distance). It moves only when the look has moved well away
  // from it, and then the crowd there is run forward a few seconds so the street is already going about its day.
  const WP = { x: 0, y: 0, lx: 0, ly: 0, set: false, moves: 0 };
  { const F = g.focus; let fx = F.x, fy = F.y; Object.defineProperty(F, 'x', { get: () => (S.on && WP.set ? WP.x : fx), set: (v) => { fx = v; }, configurable: true }); Object.defineProperty(F, 'y', { get: () => (S.on && WP.set ? WP.y : fy), set: (v) => { fy = v; }, configurable: true }); }
  function crowdWrap() {
    const cr = g.crowd; if (S.crowd || !cr || !cr.on || !cr.sim || !cr.render) return; S.crowd = cr;
    const view0 = cr.sim.view; cr.sim.view = function () { view0.call(this); if (S.on && WP.set) { this.cx = WP.x; this.cy = WP.y; this.cosCone = -1; this.cosSee = -1; } };
    const upd0 = cr.render.update; cr.render.update = function () { if (!(S.on && WP.set)) return upd0.call(this);
      // drawn as from a wide eye standing in the street at the place looked at (the figures there get their near bodies), then the real camera is put back
      const cam = W.camera, px = cam.position.x, py = cam.position.y, pz = cam.position.z, fov = cam.fov; cam.position.set(WP.lx - S.hx * 8, 2.5, -(WP.ly - S.hy * 8)); cam.fov = 150; cam.updateMatrixWorld(true);
      try { upd0.call(this); } finally { cam.position.set(px, py, pz); cam.fov = fov; cam.updateMatrixWorld(true); } };
  }
  function watch(dt) {
    const c = g.cam, cp = Math.cos(c.pitch), dx = Math.cos(c.yaw) * cp, dy = Math.sin(c.yaw) * cp, dz = -Math.sin(c.pitch), hl = Math.hypot(dx, dy) || 1; S.hx = dx / hl; S.hy = dy / hl;
    const ox = pl.x, oy = pl.y, oz = pl.alt + 1.58; let gx = null, gy = null;
    if (dz < -0.08) { let t = 6, st = 3; while (t < 700) { const z = oz + dz * t; if (z < 0.3 || H.top(ox + dx * t, oy + dy * t, z + 0.5) > z) { if (z < 12) { gx = ox + dx * t; gy = oy + dy * t; break; } if (t > 30) break;     /* his own roof under the line, in the first metres: looked past */ } t += st; st = Math.min(10, st * 1.08); } }
    if (gx === null) { if (WP.set) return; gx = ox + S.hx * 180; gy = oy + S.hy * 180; }      // looking at the sky or a roof: the street life stays where it was
    const d = Math.hypot(gx - ox, gy - oy); if (d > 235) { gx = ox + (gx - ox) / d * 235; gy = oy + (gy - oy) / d * 235; }
    WP.lx = gx; WP.ly = gy;
    if (!WP.set || Math.hypot(gx - WP.x, gy - WP.y) > (S.scoped ? 70 : 130)) { WP.x = gx; WP.y = gy; WP.set = true; WP.moves++; crowdWrap(); S.extra = g.P.get('perchsettle') === '1' ? 0 : 60; if (S.crowd && S.crowd.settle && !S.extra) { try { S.crowd.settle(3); } catch (e) {} } }
    // the crowd at a new watch point is put there by the sim itself (its centre has jumped: it fills the streets at once); then it is run forward a second, two steps a frame,
    // so they are spread along their ways. Before (handoff-1, -2): three seconds run in one frame, a 0.24 s pause on each big swing of the look (?perchsettle=1 = that).
    if (S.extra > 0 && S.crowd && S.crowd.sim) { try { S.crowd.sim.step(1 / 60); S.crowd.sim.step(1 / 60); } catch (e) {} S.extra -= 2; }
  }

  // ---------------------------------------------------------------- 5. the last metres onto the mark
  // The terrace is 8 m wide: flown by keys from 14 m up, a start 1 m off the mark ended over the drop or against the tower (lanes/heli/gates/h3/land.out).
  // So within 10 m of the mark and less than 14 m above it the controls are helped: the cyclic leans toward the mark and brakes the drift, the pedals turn the
  // aircraft along the wall (the same rule the game's own hover holder uses), more firmly the nearer and lower it is, never more than 85 per cent: the hands still fly it.
  const ASSIST = g.P.get('perchassist') !== '0', cl = (v) => Math.max(-1, Math.min(1, v)), wp = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function assist(c, dt) {
    S.helping = 0; if (!ASSIST) return; const f = heli.f; if (f.onGround || f.engine !== 'run') return;
    for (const p of S.pads) { const ex = p.x - f.pos.x, ey = p.y + f.pos.z, d = Math.hypot(ex, ey), h = f.pos.y - 1.25 - p.z; if (d > 10 || h < -0.5 || h > 14) continue;
      const w = Math.max(0, 1 - d / 10) * Math.max(0.3, 1 - h / 14) * 0.85 + (d < 3 ? 0.15 * (1 - h / 14) : 0), cs = Math.cos(f.heading), sn = Math.sin(f.heading), vf = f.vel.x * cs - f.vel.z * sn, vr = f.vel.x * sn + f.vel.z * cs;
      const a0 = wp(p.h - f.heading), hh = Math.abs(a0) < Math.PI / 2 ? p.h : p.h + Math.PI, k = Math.min(0.85, w);
      c.pitch = c.pitch * (1 - k) + cl((ex * cs + ey * sn) * 0.25 - vf * 0.3) * k; c.roll = c.roll * (1 - k) + cl((ex * sn - ey * cs) * 0.25 - vr * 0.3) * k; c.yaw = c.yaw * (1 - k) + cl(-wp(hh - f.heading) * 2) * k;
      S.helping = k; if (k > 0.2 && !S.told && !heli.note) { S.told = true; heli.note = { t: 0, text: 'OVER THE MARK · EASE THE COLLECTIVE DOWN' }; } return; }
    S.told = false;
  }

  function step(dt) {
    tryMarks();
    { const f = heli.f; let free = false; if (!f.onGround || heli.piloted) for (const p of S.pads) if (Math.abs(f.pos.x - p.x) < 13 && Math.abs(f.pos.z + p.y) < 13 && f.pos.y < p.z + 12 && f.pos.y > p.z - 1) free = true; f.rotorFree = free || (f.onGround && S.pads.some((p) => Math.abs(f.pos.x - p.x) < 13 && Math.abs(f.pos.z + p.y) < 13 && Math.abs(f.pos.y - p.z) < 4)); }
    const C = g.combat; if (C && !S.wrapped && C.cast && C.canCarry) wrap(C);
    const on = roofNow();
    if (on !== S.on) {
      S.on = on;
      if (on) { S.hintT = 0; if (S.C && S.C.slot !== 'rifle' && WEAPONS.rifle && !LONG.includes(S.C.slot)) { try { S.C.equip('rifle'); } catch (e) {} } }
      else scope(false);
    }
    // the near plane: the renderer pushes it out to 6 m at this height (right for a camera in the air, but it cuts away the man, the roof under him and the aircraft he walks to):
    // pinned at 0.5 m while he is on foot on a high roof or climbing in or out up there; through the scope the renderer's own rule stands
    { const want = !S.scoped && !heli.piloted && !pl.vehicle && pl.alt > HIGH && !(g.fly && g.fly.on) ? 0.5 : 0; if (want !== S.near) { if (want || S.near) W.fixedNear = want; S.near = want; } }
    if (!on) { WP.set = false; return; } S.hintT += dt; watch(dt);
    const K = S.C && S.C.inp, aim = !!(S.C && K && K.aim && longGun() && S.C.armedFoot() && (S.C.zoomT || 0) > 0.5);
    const cam = g.cam;
    if (aim && !S.scoped) { scope(true); S.yaw0 = cam.yaw; S.pitch0 = cam.pitch; S.fov = 0; }
    else if (!aim && S.scoped) scope(false);
    if (S.scoped) {
      // the look slows with the power: what the game turned this step is cut to the scope's share of it
      const k = ZOOMS[S.zoom] / 47 / 0.55; let dy = cam.yaw - S.yaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      cam.yaw = S.yaw0 + dy * k; cam.pitch = Math.max(-1.2, Math.min(1.35, S.pitch0 + (cam.pitch - S.pitch0) * k)); S.yaw0 = cam.yaw; S.pitch0 = cam.pitch;
      if (S.C.shots !== S._shots) { if (S._shots !== undefined) { S.kick = 1; S.shots++; } S._shots = S.C.shots; }
    } else S._shots = S.C ? S.C.shots : undefined;
    S.u += ((S.scoped ? 1 : 0) - S.u) * Math.min(1, dt * 14); S.kick = Math.max(0, (S.kick || 0) - dt * 3.5);
  }
  // through the scope the camera is the eye at the rifle: set last, just before the frame is drawn
  function sync(dt) {
    if (!S.on || !S.scoped) return; const cam = W.camera, c = g.cam, cp = Math.cos(c.pitch), kick = (S.kick || 0) * (S.kick || 0) * 0.012;
    S.dir.set(Math.cos(c.yaw) * cp, -Math.sin(c.pitch) + kick, -Math.sin(c.yaw) * cp).normalize();
    S.eye.set(pl.x, pl.alt + 1.58, -pl.y).addScaledVector(_v.set(S.dir.x, 0, S.dir.z).normalize(), 0.35);
    cam.position.copy(S.eye); cam.up.set(0, 1, 0); cam.lookAt(_d.copy(S.eye).add(S.dir));
    S.fov = S.fov ? S.fov + (ZOOMS[S.zoom] - S.fov) * Math.min(1, (dt || 0.016) * 16) : 30; if (Math.abs(cam.fov - S.fov) > 0.005) { cam.fov = S.fov; cam.updateProjectionMatrix(); }      /* the game's own camera code sets its field of view every frame: ours is kept here and put on last */
    cam.updateMatrixWorld(); pl.vis.object.visible = false;
  }
  function drawHud(hud) {
    if (!S.on) return; const c = hud.ctx, Wd = hud.w / hud.k, Hh = 1080, cx = Wd / 2, cy = Hh / 2;
    if (S.scoped) {
      const R = Hh * 0.46; c.save();
      c.fillStyle = '#000'; c.beginPath(); c.rect(0, 0, Wd, Hh); c.arc(cx, cy, R, 0, Math.PI * 2, true); c.fill('evenodd');
      const gr = c.createRadialGradient(cx, cy, R * 0.72, cx, cy, R); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.85)'); c.fillStyle = gr; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.92)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx - 14, cy); c.moveTo(cx + 14, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy - 14); c.moveTo(cx, cy + 14); c.lineTo(cx, cy + R); c.stroke();
      c.lineWidth = 5; c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx - R * 0.42, cy); c.moveTo(cx + R * 0.42, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy + R * 0.42); c.lineTo(cx, cy + R); c.stroke();
      c.fillStyle = 'rgba(0,0,0,0.92)'; for (let i = 1; i <= 4; i++) for (const s of [-1, 1]) { c.beginPath(); c.arc(cx + s * i * R * 0.085, cy, 2.2, 0, 7); c.fill(); c.beginPath(); c.arc(cx, cy + s * i * R * 0.085, 2.2, 0, 7); c.fill(); }
      c.fillStyle = '#d8281e'; c.beginPath(); c.arc(cx, cy, 1.8, 0, 7); c.fill(); c.restore();
      const A = S.C && S.C.aim, am = S.C && S.C.ammo && S.C.ammo[S.C.slot];
      hud.text([3, 6, 12][S.zoom] + 'x', cx + R * 0.5, cy + R * 0.62, 20, '#fff', 'left', 700, 1);
      if (A && A.ok && A.kind !== 'none') hud.text(Math.round(A.t) + ' m', cx + R * 0.5, cy + R * 0.62 + 26, 16, A.ped ? '#ff5a45' : '#ffb82e', 'left', 700, 1);
      if (am) hud.text(am.mag + ' / ' + am.reserve, cx - R * 0.5, cy + R * 0.62, 20, am.mag ? '#fff' : '#ff5a45', 'right', 700, 1);
    } else if (S.hintT < 14 && !g.capture && S.C) {
      c.globalAlpha = Math.max(0, Math.min(1, 14 - S.hintT)); hud.panel(Wd / 2 - 470, 172, 940, 40, 6);
      hud.text('RIGHT MOUSE  scope     WHEEL  3x 6x 12x     LEFT MOUSE  fire     R  reload     F at the door  fly', Wd / 2, 199, 16, '#fff', 'center', 600, 1); c.globalAlpha = 1;
    }
  }
  S.step = step; S.sync = sync; S.drawHud = drawHud; S.marks = marks; S.assist = assist;
  return S;
}

// warmup.js (light lane, Nov 15): part of a first visit's shader cost taken off the first drawn frames. ?warmup=0 = the old way (this file is never fetched).
// MEASURED (lanes/light/firstload/STATE.md; M2 Max, shader programs the machine had never seen): the compile-ahead step in main.js links the main pass's
// programs as one batch, and the browser builds a batch about seven at once (172 programs in 3 s; one at a time they cost 20 s). But two more sets of
// programs were never in that batch, so each was linked alone, with the page frozen, at its first draw:
//   - the street mirror (world.updateStreet) draws the same materials through cameras on layer 3, where no lamp and no shadow is counted, so three makes
//     a second program for every material it shows: 48 programs, 5.8 s of the frozen fourth frame;
//   - the picture passes (ambient shade, bloom, history, camera pass, exposure meter) are not in the scene the compile-ahead is given: 19 programs
//     linked alone in the first frame.
// WHAT THIS DOES, around main.js's own compile-ahead step and before the first frame: links those programs too, in the same batch (renderer.compile with the
// mirror's own camera, group by group, and with each pass's own quad), and waits for the batch without freezing the page. Nothing is drawn here and no
// program is different: the same ones are built earlier and side by side. Programs for mirrored things not in view at the start are linked as well
// (about 37 more on Nov 15): they were going to be linked, alone, the first time the mirror saw them during play.
// NOT DONE HERE (measured, see STATE.md): building each program's pipeline at its first draw (6 to 7 s of the first frame on a first visit) stays where it
// is. Drawing unseen while game.init() runs did not work: a lamp that joins the scene late in init changes every lit program, so 200 programs linked
// early were thrown away, and the page stood still in the unseen draws instead.
import * as THREE from 'three';

export function startWarmup(world, renderer, P) {
  const r = renderer, S = { mirror: 0, quads: 0, errors: 0 }; let lastErr = '';
  const fail = (where, e) => { S.errors++; lastErr = where + ': ' + (e && e.message); if (S.errors <= 3) console.warn('[game] warm-up ahead, ' + lastErr); };
  // what the street mirror draws: the same test world.updateStreet uses to put groups on layer 3
  const mirrored = (top) => top === world.skyMesh || top.userData.streetCube || (P.get('scars') === '0' ? /^(streets_ground|streets_trees)/ : /^(streets_ground|streets_trees|streets_vehicles|st_furniture)/).test(top.name || '');
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  let t0 = 0, n0 = 0;
  // early (handoff15, ?warmearly=1 to try; off unless asked): while game.init() runs (9 s of page work on an M2 Max, and the downloads on a real visit) the
  // graphics process has nothing to do. Every 2.5 s or so, whatever is in the scene by then is LINKED (not drawn): the main pass's programs and the
  // mirror's. The one lamp that joins at the very end of init (combat/fx.js: the muzzle flash, a PointLight without shadow) is stood in for during each
  // call, because one more lamp changes every lit program; if the lamps ever change, the early programs are simply not the ones used, and the line
  // printed by finish() says how many the compile-ahead step still had to add.
  const E = (S.early = { passes: 0, added: 0, ms: 0, on: false }); let earlyT = 0;
  const earlyPass = () => { if (!E.on) return; const t = performance.now(), n = r.info.programs ? r.info.programs.length : 0, old = r.getRenderTarget(); let lamp = null;
    try { let has = false; world.scene.traverse((o) => { if (o.isPointLight) has = true; });
      if (!has) { lamp = new THREE.PointLight(0xffc27a, 0, 16, 2); lamp.castShadow = false; world.scene.add(lamp); }
      r.setRenderTarget(world.composer.readBuffer); r.compile(world.scene, world.camera);
      const fc = !world.streetOff && !world.streetFull && world.streetCam && world.streetRT ? world.streetCam.children[0] : null;
      if (fc) { const m0 = fc.layers.mask; fc.layers.set(3); r.setRenderTarget(world.streetRT, 0); for (const top of world.scene.children) if (mirrored(top)) { try { r.compile(top, fc, world.scene); } catch (e) { fail('early mirror', e); } } fc.layers.mask = m0; }
    } catch (e) { fail('early', e); } finally { if (lamp) world.scene.remove(lamp); r.setRenderTarget(old); }
    const dt = performance.now() - t; E.passes++; E.added += (r.info.programs ? r.info.programs.length : 0) - n; E.ms += dt; if (E.on) earlyT = setTimeout(earlyPass, Math.max(2500, dt * 10)); };
  if (P.get('warmearly') === '1' && world.composer) { E.on = true; earlyT = setTimeout(earlyPass, 2500); }
  // begin(): called just BEFORE main.js's compile-ahead step, so the two batches are one and are built side by side. Links only; waits for nothing.
  const begin = () => { if (E.on) { E.on = false; clearTimeout(earlyT); E.ms = Math.round(E.ms); } t0 = performance.now(); n0 = r.info.programs ? r.info.programs.length : 0; const old = r.getRenderTarget();
    try {
      // 1. the street mirror's variants
      const fc = !world.streetOff && !world.streetFull && world.streetCam && world.streetRT ? world.streetCam.children[0] : null;
      if (fc) { fc.layers.set(3); r.setRenderTarget(world.streetRT, 0);
        for (const top of world.scene.children) if (mirrored(top)) { try { r.compile(top, fc, world.scene); S.mirror++; } catch (e) { fail('mirror', e); } } }
      // 2. the picture passes' own quads (enabled passes only), and the exposure meter's two
      if (P.get('warmup') !== 'm' && world.composer) { const mats = new Set(), add = (m, mesh) => { if (m && m.isShaderMaterial && !mats.has(m)) { mats.add(m); try { r.compile(mesh || new THREE.Mesh(geo, m), cam); S.quads++; } catch (e) { fail('quad', e); } } };
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));
        const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1); r.setRenderTarget(world.composer.readBuffer);
        for (const p of world.composer.passes) { if (!p || p.enabled === false) continue;
          for (const k of Object.keys(p)) { const v = p[k]; if (!v || typeof v !== 'object') continue;
            if (v.isMaterial) add(v); else if (Array.isArray(v)) { for (const x of v) if (x && x.isMaterial) add(x); } else if (v._mesh && v._mesh.material) add(v._mesh.material, v._mesh); } }
        add(world.meterMat); add(world.expMat); geo.dispose(); }
    } catch (e) { fail('begin', e); } finally { r.setRenderTarget(old); }
    S.added = (r.info.programs ? r.info.programs.length : 0) - n0; S.linkMs = Math.round(performance.now() - t0); };
  // finish(): called just AFTER the compile-ahead step: waits for whatever of the batch is still building (the browser links it off the page's thread); never longer than a minute
  const finish = async () => { if (!t0) begin(); const t1 = performance.now();
    try { const ready = () => { for (const p of r.info.programs || []) if (!p.isReady()) return false; return true; };
      for (let i = 0; i < 6000 && !ready() && performance.now() - t1 < 60000; i++) await sleep(10); } catch (e) { fail('wait', e); }
    S.waitMs = Math.round(performance.now() - t1);
    S.perProg = E.passes ? 99 : (performance.now() - t0) / Math.max(1, (r.info.programs ? r.info.programs.length : 0) - n0);     /* ms per program of the whole batch: about 15 on an M2 Max that has never seen them, 2 to 3 when the machine's shader cache has them (ramp() reads it) */
    console.log('[game] warm-up ahead: ' + (E.passes ? 'linked early while the game was set up: ' + E.added + ' programs in ' + E.passes + ' passes (page time ' + E.ms + ' ms), ' + ((r.info.programs ? r.info.programs.length : 0) - E.added) + ' more by the end; ' : '') + S.added + ' more programs in the batch (page time ' + S.linkMs + ' ms, waited ' + S.waitMs + ' ms more after the compile-ahead; street mirror: ' + S.mirror + ' groups; picture passes: ' + S.quads + ' quads)' + (S.errors ? ', errors ' + S.errors + ' (' + lastErr + ')' : '')); };
  // a group that joins the scene later (the landmark buildings, hero.js): its mirror variants as one batch, before it is added
  const late = async (obj) => { const fc = !(S.ramping ? S.rampOff0 : world.streetOff) && !world.streetFull && world.streetCam && world.streetRT ? world.streetCam.children[0] : null; if (!fc || !obj) return; const old = r.getRenderTarget(), t0 = performance.now();
    try { fc.layers.set(3); r.setRenderTarget(world.streetRT, 0); r.compile(obj, fc, world.scene); S.late = (S.late || 0) + 1; } catch (e) { fail('late', e); } finally { r.setRenderTarget(old); }
    try { const ready = () => { for (const p of r.info.programs || []) if (!p.isReady()) return false; return true; }; for (let i = 0; i < 2000 && !ready() && performance.now() - t0 < 15000; i++) await sleep(10); } catch (e) { fail('late wait', e); } };
  // ramp(first): light lane handoff15, Nov 15. MEASURED (firstload/STATE.md, every draw fenced by a round trip): on a first visit the first drawn frame stood
  // 9.4 s, and 6.5 s of it was the FIRST DRAW of each of 141 programs that were already fully linked (COMPLETION_STATUS true on all of them): the graphics
  // process builds a program's pipeline when it is first drawn, a median 36 ms each, one after another; 1.4 s more was texture upload. The street mirror's
  // first face did the same for its 48 programs (2.8 s). That work cannot be linked away, but it need not be ONE frozen frame: for the first frames
  // behind the start screen the scene's drawn things are let into the picture a few programs at a time, and the next few only when the graphics process
  // has finished the last (a fence, polled, never waited for), so the page keeps running (the loading line moves, the landmark files are parsed
  // meanwhile). Then the same for the street mirror. Lamps are never touched, so every program is the one the full picture uses. main.js holds Play
  // until S.ramping is false. ?warmramp=0 = off (the first frame draws everything at once, as before). Never runs for tools that skip the start screen.
  const ramp = (first) => {
    if (P.get('warmramp') === '0' || S.ramping || world.nearObject) return false;
    // a repeat visit (the batch above came back from the machine's shader cache: under 5 ms a program, page time included) has nothing to spread, and a
    // slow run of frames would only hold the landmark buildings back (they load one texture a frame): everything is drawn at once, as before. ?warmramp=1 forces the ramp.
    if (P.get('warmramp') !== '1' && S.perProg !== undefined && S.perProg < 5) { S.rampSkipped = +S.perProg.toFixed(1); console.log('[game] warm-up ramp: not needed (the batch took ' + S.rampSkipped + ' ms a program: shader cache warm)'); return false; }
    const gl = r.getContext(), now = () => performance.now(), T0 = now(), R = (S.ramp = { log: [], tex: 0, frames: 0, idle: 0, steps: 0, objs: 0, progs: 0, mObjs: 0, mSteps: 0, maxStep: 0, hid: 0 });
    const isDrawn = (o) => o.isMesh || o.isLine || o.isPoints || o.isSprite;
    const unitsOf = (o) => { const out = []; for (const m of [].concat(o.material || [])) { const mp = m && r.properties.has(m) ? r.properties.get(m) : null; if (mp && mp.programs && mp.programs.size) { for (const p of mp.programs.values()) out.push(p); } else if (m) out.push(m); } return out; };
    // phase 1: every drawn thing is held (no camera sees it) and let go batch by batch.
    // HELD (Nov 15, after the first handoff15 undid budget.js's hiding): while a thing waits its turn its .layers is a stand-in that answers every camera
    // "not on your layers" (three asks only through layers.test) and passes every other question and every change through to the thing's OWN Layers
    // object, which is never altered here. So whoever takes a waiting thing off a layer or puts it back (budget.js: far small street things and far people
    // off layer 0, every 8th frame from the first frame on, and back again) changes the real layers, and when the thing's turn comes it is exactly as they
    // left it. (Before: the mask was saved and set to 0, so budget's disable(0) did nothing while budget counted the thing hidden, and the saved mask then
    // put layer 0 back: 7,492 things budget meant hidden were drawn after the ramp.) A thing that is on no layer when its turn comes is let go without
    // being counted into a batch: nothing draws it, as today, where budget hides it before the first frame.
    const HP = { test() { return false; }, isEnabled(c) { return this.real.isEnabled(c); }, enable(c) { this.real.enable(c); }, disable(c) { this.real.disable(c); }, toggle(c) { this.real.toggle(c); }, set(c) { this.real.set(c); }, enableAll() { this.real.enableAll(); }, disableAll() { this.real.disableAll(); } };
    Object.defineProperty(HP, 'mask', { get() { return this.real.mask; }, set(v) { this.real.mask = v; } });
    const main = { list: [], i: 0, seen: new Set(), size: 4, must: 0 }, mirror = { list: [], i: 0, seen: new Set(), size: 8, must: 0 };
    const firstSet = new Set(); for (const f of first || []) f.traverse((o) => { if (isDrawn(o)) firstSet.add(o); });     /* the struck-person figures: main.js hides them again after 0.9 s, so they go in with the first batch */
    for (const o of firstSet) main.list.push(o); main.must = main.list.length;
    world.scene.traverse((o) => { if (isDrawn(o) && !firstSet.has(o)) main.list.push(o); });
    for (const o of main.list) { const h = Object.create(HP); h.real = o.layers; o.layers = h; }
    const giveMain = (o) => { const h = o.layers; if (h && HP.isPrototypeOf(h)) o.layers = h.real; }, giveMirror = (o) => o.layers.enable(3);
    const off0 = (S.rampOff0 = world.streetOff), doMirror = !world.streetOff && !world.streetFull && !!world.streetCam; world.streetOff = true;
    const texSeen = new WeakSet(), tex = (t) => { if (texSeen.has(t)) return; texSeen.add(t); if (t.isRenderTargetTexture || t.isDepthTexture || t.isVideoTexture || !t.image || !(t.version > 0)) return; const tp = r.properties.has(t) ? r.properties.get(t) : null; if (tp && tp.__webglTexture && tp.__version === t.version) return; try { r.initTexture(t); R.tex++; } catch (e) {} };
    const release = (ph, give) => { let n = 0, k = 0; const fresh = [], mats = new Set(), tr = now();
      while (ph.i < ph.list.length) { const o = ph.list[ph.i]; if (ph === main && o.layers.mask === 0) { give(o); ph.i++; R.hid++; continue; }     /* on no layer (budget hid it while it waited): nothing draws it, so it costs no place in a batch */
        const u = unitsOf(o).filter((x) => !ph.seen.has(x)), nu = new Set(u).size; if (k && n + nu > ph.size && ph.i >= ph.must) break;
        for (const x of u) { if (!ph.seen.has(x)) { ph.seen.add(x); if (x.getUniforms) fresh.push(x); } } n += nu; k++; for (const m of [].concat(o.material || [])) if (m) mats.add(m); give(o); ph.i++; }
      // three's first-use questions for these programs are asked now, while the graphics process has nothing queued, so they do not wait behind the draws below
      for (const p of fresh) { try { p.getUniforms(); } catch (e) {} }
      // ... and their textures go up now for the same reason (an upload queued behind the draws waits for every pipeline before it)
      for (const m of mats) { for (const key in m) { const t = m[key]; if (t && t.isTexture) tex(t); } if (m.uniforms) for (const key in m.uniforms) { const u = m.uniforms[key], t = u && u.value; if (t && t.isTexture) tex(t); } }
      if (R.log.length < 80) R.log.push([Math.round(now() - T0), ph === main ? 'm' : 's', k, n, R.tex, Math.round(now() - tr)]);
      return [k, n]; };
    let fence = null, fenceT = 0, state = 'main', done = false; const render0 = world.render, own = Object.prototype.hasOwnProperty.call(world, 'render');
    const busy = () => { if (!fence) return false; let st = 0; try { st = gl.clientWaitSync(fence, 0, 0); } catch (e) {} if (st === gl.TIMEOUT_EXPIRED && now() - fenceT < 5000) return true; try { gl.deleteSync(fence); } catch (e) {} fence = null; return false; };
    const mark = () => { try { if (fence) gl.deleteSync(fence); fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); } catch (e) { fence = null; } fenceT = now(); };
    const end = (why) => { if (done) return; done = true;
      try { for (; main.i < main.list.length; main.i++) giveMain(main.list[main.i]); for (; mirror.i < mirror.list.length; mirror.i++) giveMirror(mirror.list[mirror.i]); } catch (e) { fail('ramp end', e); }
      world.streetOff = off0; if (world.render === wrap) { if (own) world.render = render0; else delete world.render; } else R.wrapped = 1;     /* someone wrapped the picture call after this: the wrapper stays, as a plain pass-through */
      try { if (fence) gl.deleteSync(fence); } catch (e) {} fence = null; S.ramping = false; R.ms = Math.round(now() - T0); R.why = why || 'done';
      console.log('[game] warm-up ramp: ' + R.objs + ' things (' + R.progs + ' programs) let in over ' + R.steps + ' steps' + (R.hid ? ' (' + R.hid + ' more were on no layer, hidden by the draw budget, and went back undrawn)' : '') + ', the street mirror ' + R.mObjs + ' over ' + R.mSteps + '; ' + R.frames + ' frames, ' + R.idle + ' of them waiting for the graphics process, ' + R.ms + ' ms, longest step ' + R.maxStep + ' ms' + (why ? ' (' + why + ')' : '')); };
    const wrap = function (t, focus) {
      if (done) return render0.call(world, t, focus);
      let drew = false, face = false;
      try { R.frames++;
        if (now() - T0 > 90000 || (r.getContext().isContextLost && gl.isContextLost())) end('stopped early');
        else if (busy()) R.idle++;
        else { const dt = fenceT ? now() - fenceT : 0; if (dt > R.maxStep) R.maxStep = Math.round(dt);
          if (state === 'main') {
            if (fenceT) main.size = dt < 100 ? main.size * 2 : dt > 350 ? Math.max(1, main.size >> 1) : main.size;
            if (main.i < main.list.length) { const [k, n] = release(main, giveMain); R.objs += k; R.progs += n; R.steps++; drew = true; }
            else if (!doMirror) end(); else { world.streetOff = off0; state = 'tag'; } }
          else if (state === 'mirror') { const n = world.streetN, ev = world.streetEvery || 3; face = n >= 2 && n % ev === 0;     /* the test updateStreet makes: this frame draws one face of the mirror */
            if (face) { if (mirror.i < mirror.list.length) { const [k] = release(mirror, giveMirror); R.mObjs += k; R.mSteps++; drew = true; } else end(); } } }
      } catch (e) { fail('ramp', e); end('error'); }
      const out = render0.call(world, t, focus);
      try { if (!done) { if (state === 'tag') {     /* the mirror has just tagged what it draws (layer 3): take the tags off again and give them back batch by batch, on the frames that draw a face */
            world.scene.traverse((o) => { if (isDrawn(o) && o.layers.isEnabled(3)) { o.layers.disable(3); mirror.list.push(o); } }); const all = new Set(); for (const o of mirror.list) for (const x of unitsOf(o)) all.add(x); mirror.size = Math.max(4, Math.ceil(all.size / 10)); state = 'mirror'; }
          if (drew) mark(); } } catch (e) { fail('ramp', e); end('error'); }
      return out; };
    world.render = wrap; S.ramping = true; return true; };
  return (world.warmup = { S, begin, finish, late, ramp });
}

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
  // begin(): called just BEFORE main.js's compile-ahead step, so the two batches are one and are built side by side. Links only; waits for nothing.
  const begin = () => { t0 = performance.now(); n0 = r.info.programs ? r.info.programs.length : 0; const old = r.getRenderTarget();
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
    console.log('[game] warm-up ahead: ' + S.added + ' more programs in the batch (page time ' + S.linkMs + ' ms, waited ' + S.waitMs + ' ms more after the compile-ahead; street mirror: ' + S.mirror + ' groups; picture passes: ' + S.quads + ' quads)' + (S.errors ? ', errors ' + S.errors + ' (' + lastErr + ')' : '')); };
  // a group that joins the scene later (the landmark buildings, hero.js): its mirror variants as one batch, before it is added
  const late = async (obj) => { const fc = !world.streetOff && !world.streetFull && world.streetCam && world.streetRT ? world.streetCam.children[0] : null; if (!fc || !obj) return; const old = r.getRenderTarget(), t0 = performance.now();
    try { fc.layers.set(3); r.setRenderTarget(world.streetRT, 0); r.compile(obj, fc, world.scene); S.late = (S.late || 0) + 1; } catch (e) { fail('late', e); } finally { r.setRenderTarget(old); }
    try { const ready = () => { for (const p of r.info.programs || []) if (!p.isReady()) return false; return true; }; for (let i = 0; i < 2000 && !ready() && performance.now() - t0 < 15000; i++) await sleep(10); } catch (e) { fail('late wait', e); } };
  return (world.warmup = { S, begin, finish, late });
}

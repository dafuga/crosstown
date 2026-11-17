// park/mat.js (park lane): what every park material shares with the rest of the game's light: the sun and its shadow map come from three.js
// (MeshStandardMaterial), the baked sky / far-shadow / bounce light from the ground lightmap by the formula of world.js (BAKE_LIGHT_GLSL).
import * as THREE from 'three';
import { BAKE_LIGHT_GLSL, NOISE_GLSL } from '../facade.js';

// lit(material, shared, { pars, body, key }): adds vWPos (instancing aware), the lightmap read and the bake formula.
// pars = extra fragment declarations, body = GLSL run after <map_fragment> (may write diffuseColor, pkRough), key = program cache key.
export function lit(m, shared, o = {}) {
  const extra = o.uniforms || {};
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared, extra);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec3 vWPos; varying vec3 vWN;' + (o.vpars || ''))
      .replace('#include <project_vertex>', `#include <project_vertex>
        { vec4 wp_ = vec4(transformed, 1.0); vec3 wn_ = objectNormal;
          #ifdef USE_INSTANCING
            wp_ = instanceMatrix * wp_; wn_ = mat3(instanceMatrix) * wn_;
          #endif
          vWPos = (modelMatrix * wp_).xyz; vWN = normalize(mat3(modelMatrix) * wn_); ${o.vbody || ''}
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWN; uniform sampler2D tLight; uniform vec2 uHalf;
        uniform vec3 uSunColor; uniform vec3 uSunDir; uniform float uShadowFar; uniform vec3 uShadowCenter;
        ${NOISE_GLSL}
        vec3 bakeV; vec3 bakeN; float pkRough = -1.0; ${o.pars || ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        { vec2 w = vWPos.xz;
          bakeV = texture2D(tLight, vec2(w.x / (2.0 * uHalf.x) + 0.5, -w.y / (2.0 * uHalf.y) + 0.5)).rgb; bakeN = normalize(vWN);
          ${o.body || ''}
        }`)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + (o.nbody || ''))
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n if (pkRough >= 0.0) roughnessFactor = pkRough;')
      .replace('#include <aomap_fragment>', BAKE_LIGHT_GLSL);
  };
  m.customProgramCacheKey = () => 'park:' + (o.key || 'plain');
  return m;
}

const TL = new THREE.TextureLoader();
export function tex(url, world, srgb = true, aniso = 8) {
  return new Promise((res) => TL.load(url, (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(aniso, world.renderer.capabilities.getMaxAnisotropy()); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; res(t); }, undefined, () => { console.log('[game] park: texture missing: ' + url); const d = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1); d.needsUpdate = true; d.wrapS = d.wrapT = THREE.RepeatWrapping; res(d); }));
}
export const breathe = () => new Promise((r) => { let d = false; const go = () => { if (!d) { d = true; r(); } }; requestAnimationFrame(go); setTimeout(go, 80); });
export function disposeGroup(g) { g.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); const m = o.material; if (m && m.userData && m.userData.own) { for (const k in m.userData.own) { const t = m.userData.own[k]; if (t && t.dispose) t.dispose(); } m.dispose(); } if (o.isInstancedMesh) o.dispose(); }); }
// merged([[geometry, [r, g, b], Matrix4?], ...]) -> one non-indexed geometry with position, normal, color (linear rgb per part)
export function merged(parts) {
  let n = 0; const gs = parts.map(([g, c, m]) => { let q = g.index ? g.toNonIndexed() : g.clone(); if (m) q.applyMatrix4(m); if (!q.attributes.normal) q.computeVertexNormals(); n += q.attributes.position.count; return [q, c]; });
  const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const [q, c] of gs) { pos.set(q.attributes.position.array, o * 3); nrm.set(q.attributes.normal.array, o * 3); for (let k = 0; k < q.attributes.position.count; k++) { col[(o + k) * 3] = c[0]; col[(o + k) * 3 + 1] = c[1]; col[(o + k) * 3 + 2] = c[2]; } o += q.attributes.position.count; q.dispose(); }
  const G = new THREE.BufferGeometry(); G.setAttribute('position', new THREE.BufferAttribute(pos, 3)); G.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); G.setAttribute('color', new THREE.BufferAttribute(col, 3)); return G;
}

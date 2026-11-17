// park/shore.js (park lane): the edge of a park water is not a line: stands of reed and dry sedge in the shallows and boulders half in the water,
// in runs along the outline (never under a bridge). Reeds are two crossed cards with a stand painted on a canvas here (nothing fetched); boulders
// are one lumpy stone, instanced, in the rock's texture (S.tRock), dark and wet at the foot.
import * as THREE from 'three';
import { lit } from './mat.js';
import { BASE } from './ground.js';

const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
let KIT = null;
function kit(game, S) {
  if (KIT) return KIT;
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'); let s = 7; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const COL = ['rgb(196,170,112)', 'rgb(176,146,86)', 'rgb(214,196,150)', 'rgb(122,122,66)', 'rgb(140,104,60)', 'rgb(160,150,96)']; g.lineCap = 'round';
  for (let k = 0; k < 90; k++) { const bx = 128 + (R() - 0.5) * 80, lean = (R() - 0.5), tx = bx + lean * 170, ty = 250 - (110 + R() * 138); g.strokeStyle = COL[(R() * COL.length) | 0]; g.lineWidth = 1.4 + R() * 1.8;
    g.beginPath(); g.moveTo(bx, 256); g.quadraticCurveTo(bx + lean * 30, 256 - (256 - ty) * 0.6, tx, ty); g.stroke();
    if (R() < 0.12) { g.strokeStyle = 'rgb(84,56,34)'; g.lineWidth = 5; g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx - lean * 4, ty + 13); g.stroke(); } }      // a seed head
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const P = [], N = [], UV = [], I = []; for (let k = 0; k < 2; k++) { const a = k * Math.PI / 2 + 0.4, ca = Math.cos(a), sa = Math.sin(a), b = P.length / 3;
    for (const [sx, sy] of [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]]) { P.push(sx * ca, sy, sx * sa); const l = Math.hypot(sx * ca * 0.8, 0.85, sx * sa * 0.8); N.push(sx * ca * 0.8 / l, 0.85 / l, sx * sa * 0.8 / l); UV.push(sx + 0.5, sy); } I.push(b, b + 1, b + 2, b, b + 2, b + 3); }
  const reedGeo = new THREE.BufferGeometry(); reedGeo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); reedGeo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); reedGeo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); reedGeo.setIndex(I); reedGeo.userData.shared = true;
  const reedMat = lit(new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.4 }), game.world.shared, { key: 'reed', nbody: 'normal = normalize((viewMatrix * vec4(bakeN, 0.0)).xyz);' });
  const sg = new THREE.IcosahedronGeometry(1, 2), p = sg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 0.82 + 0.2 * Math.sin(x * 3.1 + y * 2.3) * Math.cos(z * 2.7 - y * 1.9) + 0.1 * Math.sin(x * 7.0 - z * 6.0 + y * 5.0); p.setXYZ(i, x * n, y * n, z * n); }
  sg.computeVertexNormals(); sg.userData.shared = true;
  const stoneMat = lit(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94, metalness: 0 }), game.world.shared, { key: 'shorestone', uniforms: { tRock: S.tRock }, vpars: 'varying vec3 vLoc;', vbody: 'vLoc = position;', pars: 'uniform sampler2D tRock; varying vec3 vLoc;',
    body: `vec3 an = abs(bakeN); vec3 rk = an.y > 0.6 ? texture2D(tRock, vWPos.xz / 2.6).rgb : (an.x > an.z ? texture2D(tRock, vWPos.zy / 2.6).rgb : texture2D(tRock, vWPos.xy / 2.6).rgb);
           rk = mix(vec3(dot(rk, vec3(0.333))), rk, 0.4); diffuseColor.rgb *= rk * vec3(0.38, 0.37, 0.35) * (0.7 + 0.6 * vnoise(vWPos.xz * 1.7)) * mix(0.42, 1.0, smoothstep(-0.35, 0.05, vLoc.y));
           diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.6, 0.72, 0.4), smoothstep(0.55, 0.8, vnoise(vWPos.xz * 0.9 + 3.0)) * step(0.5, bakeN.y) * 0.6);` });
  const vertices = new Map();
  for (let i = 0; i < p.count; i++) {
    const xyz = [p.getX(i), p.getY(i), p.getZ(i)];
    vertices.set(xyz.join(','), xyz);
  }
  return (KIT = { reedGeo, reedMat, sg, stoneMat, stoneVertices: new Float32Array([...vertices.values()].flat()) });
}

// build(game, S, area, level, inCorridor(x, y)) -> group
export function build(game, S, a, level, skip) {
  const K = kit(game, S), T = game.terrain, group = new THREE.Group(); group.name = 'park_shore'; const reeds = [], stones = [];
  for (const r of [a.ring].concat(a.holes || [])) { let ar = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; ar += p[0] * q[1] - q[0] * p[1]; } const sg = ar > 0 ? 1 : -1; let run = 0;      // sg: left of the walk = inside for a counter-clockwise ring
    const inw = (r === a.ring ? 1 : -1) * sg;
    for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.01) continue; const ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L, nx = -uy * inw, ny = ux * inw;
      for (let d = 0; d < L; d += 0.85, run += 0.85) { const x = p[0] + ux * d, y = p[1] + uy * d; if (skip && skip(x, y)) continue; const h = hash(x, y), h2 = hash(y * 1.3, x * 0.7);
        const stand = 0.5 + 0.5 * Math.sin(run * 0.19 + 1.0) * Math.sin(run * 0.043 + 2.2) + 0.25 * Math.sin(run * 0.71);
        if (stand > 0.74 && h < 0.45) { const o = -0.2 + h2 * 1.3; reeds.push([x + nx * o, y + ny * o, o, h, h2]); }
        const rocky = 0.5 + 0.5 * Math.sin(run * 0.11 + 4.0) * Math.sin(run * 0.031 + 0.4);
        if (h2 < (rocky > 0.7 ? 0.35 : 0.05)) { const o = -0.7 + h * 1.4; stones.push([x + nx * o, y + ny * o, o, h, h2]); } } } }
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  const yAt = (x, y, o) => BASE + (o > 0 ? level : Math.max(level, T.ground(x, y)));
  if (reeds.length) { const im = new THREE.InstancedMesh(K.reedGeo, K.reedMat, reeds.length); im.name = 'park_reeds'; reeds.forEach((t, k) => { const hgt = 0.5 + t[3] * 0.55, wd = 0.6 + t[4] * 0.5; e.set(0, t[3] * 6.283, 0); q4.setFromEuler(e); v.set(t[0], yAt(t[0], t[1], t[2]) - 0.12, -t[1]); sc.set(wd, hgt, wd); im.setMatrixAt(k, m4.compose(v, q4, sc)); const g = 0.20 + 0.12 * t[4]; im.setColorAt(k, c.setRGB(g, g * (0.80 + 0.08 * t[3]), g * 0.62));      /* dull tan-brown: dry November sedge, knee to waist high */ });
    im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; group.add(im); }
  const colliders = game.P.get('parkcol') !== '0' ? (group.userData.stones = []) : null;
  if (stones.length) { const im = new THREE.InstancedMesh(K.sg, K.stoneMat, stones.length); im.name = 'park_shore_stones'; stones.forEach((t, k) => { const s = 0.25 + t[3] * t[3] * 0.95; e.set((t[4] - 0.5) * 0.5, t[3] * 6.283, (t[3] - 0.5) * 0.5); q4.setFromEuler(e); v.set(t[0], yAt(t[0], t[1], t[2]) + s * 0.08, -t[1]); sc.set(s * (1.1 + t[4] * 0.7), s * (0.45 + t[3] * 0.35), s * (0.9 + t[4] * 0.4)); im.setMatrixAt(k, m4.compose(v, q4, sc));
      if (colliders) {
        // Project the tilted, nonuniformly scaled mesh onto the ground once at load.
        const a = m4.elements;
        let maxSquared = 0;
        const vertices = K.stoneVertices;
        for (let i = 0; i < vertices.length; i += 3) {
          const x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
          const dx = a[0]*x + a[4]*y + a[8]*z, dz = a[2]*x + a[6]*y + a[10]*z;
          maxSquared = Math.max(maxSquared, dx*dx + dz*dz);
        }
        const radius = Math.sqrt(maxSquared);
        game.statics.addParkCircle(t[0], t[1], radius, 'rock');
        colliders.push([t[0], t[1], radius]);
      }
    });
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; group.add(im); }
  group.userData.counts = { reeds: reeds.length, stones: stones.length };
  return group;
}

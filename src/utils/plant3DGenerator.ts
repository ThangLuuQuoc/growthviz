import * as THREE from 'three';
import { PlantSpecies } from '../types/simulation';

export type LeafShapeType =
  | 'apple_ovate'
  | 'mango_lanceolate'
  | 'orange_winged'
  | 'rose_leaflet'
  | 'sunflower_cordate'
  | 'orchid_strap';

/**
 * Generates a species-specific high-resolution bump/normal heightmap
 * (pinnate herring-bone veins, cordate palmate veins, or parallel monocot strap veins).
 */
export function createSpeciesLeafBumpTexture(shape: LeafShapeType): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;

  for (let y = 0; y < 512; y++) {
    const v = 1 - y / 511; // 0 at base, 1 at tip
    for (let x = 0; x < 512; x++) {
      const u = (x / 511) * 2 - 1; // -1 to +1 across width
      const distCenter = Math.abs(u);

      let heightVal = 90;

      if (shape === 'orchid_strap') {
        // Deep central crease + fine parallel longitudinal veins
        const centralGroove = -Math.exp(-distCenter * 18) * 55;
        const parallelVeins = Math.sin(distCenter * Math.PI * 24) * 14;
        heightVal = 128 + centralGroove + parallelVeins;
      } else if (shape === 'sunflower_cordate') {
        // Prominent 3-ribbed palmate-pinnate rough texture
        const midrib = Math.exp(-distCenter * 24) * 90;
        const lateralVein = Math.sin((v * 9 - distCenter * 5.5) * Math.PI * 2) * 45;
        const hispidRoughness = ((x * 37 + y * 13) % 19) * 1.8;
        heightVal = 85 + midrib + lateralVein + hispidRoughness;
      } else if (shape === 'mango_lanceolate') {
        // Strong raised midrib + 22 pairs of fine parallel-pinnate lateral ribs
        const midrib = Math.exp(-distCenter * 34) * 110;
        const ribs = Math.sin((v * 22 - distCenter * 6) * Math.PI * 2) * 38;
        heightVal = 90 + midrib + ribs;
      } else {
        // Apple, Orange, Rose: classic dicot pinnate venation + reticulate net
        const midrib = Math.exp(-distCenter * 28) * 95;
        const secondaryVeins = Math.sin((v * 11 - distCenter * 6.5) * Math.PI * 2) * 42;
        const tertiaryNet = Math.sin(u * 45) * Math.cos(v * 45) * 14;
        heightVal = 90 + midrib + secondaryVeins + tertiaryNet;
      }

      const clamped = Math.min(255, Math.max(0, Math.round(heightVal)));
      const idx = (y * 512 + x) * 4;
      data[idx] = clamped;
      data[idx + 1] = clamped;
      data[idx + 2] = clamped;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates a species-authentic diffuse color texture for leaves, including
 * venation highlights, mango bronze flush, rose dark margins, and stress chlorosis.
 */
export function createSpeciesLeafColorTexture(
  speciesId: PlantSpecies['id'],
  baseHex: string,
  secondaryHex: string,
  yellowing: number,
  necrosis: number,
  isYoungFlush = false
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const cBase = new THREE.Color(baseHex);
  const cSec = new THREE.Color(secondaryHex);

  // Mango young leaves are famously coppery-bronze/wine-red in real life!
  if (speciesId === 'mango' && isYoungFlush) {
    cBase.lerp(new THREE.Color('#8f3f1e'), 0.68);
    cSec.lerp(new THREE.Color('#c26d2d'), 0.65);
  } else if (speciesId === 'rose' && isYoungFlush) {
    // Young rose foliage has a reddish-burgundy anthocyanin tint on edges
    cBase.lerp(new THREE.Color('#5c1d2e'), 0.35);
  }

  const cYellow = new THREE.Color('#c9a21b');
  const cBrown = new THREE.Color('#5c3818');

  if (yellowing > 0.02) {
    cBase.lerp(cYellow, Math.min(1, yellowing * 0.85));
    cSec.lerp(cYellow, Math.min(1, yellowing * 0.95));
  }
  if (necrosis > 0.02) {
    cBase.lerp(cBrown, Math.min(1, necrosis * 0.8));
    cSec.lerp(cBrown, Math.min(1, necrosis * 0.9));
  }

  const imgData = ctx.createImageData(256, 512);
  const data = imgData.data;
  const tempColor = new THREE.Color();

  for (let y = 0; y < 512; y++) {
    const v = 1 - y / 511; // 0 at base, 1 at tip
    for (let x = 0; x < 256; x++) {
      const u = (x / 255) * 2 - 1;
      const distCenter = Math.abs(u);

      const veinFreq = speciesId === 'mango' ? 22 : speciesId === 'orchid' ? 2 : 11;
      const veinWave =
        Math.sin((v * veinFreq - distCenter * 6) * Math.PI * 2) * 0.5 + 0.5;
      const midribHighlight = Math.exp(-distCenter * 25);

      tempColor.copy(cBase).lerp(cSec, veinWave * 0.5 + v * 0.25);

      // Distinct pale yellow-green midrib on Mango, Apple, Orange, Sunflower
      if (speciesId !== 'orchid' && midribHighlight > 0.08) {
        tempColor.lerp(new THREE.Color('#a3e635'), midribHighlight * 0.6);
      }

      // Rose serrated margin anthocyanin dark rim
      if (speciesId === 'rose' && distCenter > 0.84) {
        tempColor.lerp(new THREE.Color('#7f1d1d'), 0.55);
      }

      // Stress tip burn
      if (distCenter > 0.85 || v > 0.93) {
        const edgeStress = Math.max(yellowing, necrosis);
        if (edgeStress > 0.15) {
          tempColor.lerp(cBrown, edgeStress * 0.75);
        }
      }

      const idx = (y * 256 + x) * 4;
      data[idx] = Math.round(tempColor.r * 255);
      data[idx + 1] = Math.round(tempColor.g * 255);
      data[idx + 2] = Math.round(tempColor.b * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Creates a species-specific 3D leaf blade BufferGeometry with authentic outline:
 * - `apple_ovate`: Broad oval leaf with serrated teeth & gentle cup
 * - `mango_lanceolate`: Long, narrow pendulous spear leaf with wavy undulate edges & drip tip
 * - `orange_winged`: Glossy elliptical blade + winged petiole flare near base (`v < 0.22`)
 * - `rose_leaflet`: Ovate-pointed leaflet with sharp saw-toothed serrations
 * - `sunflower_cordate`: Broad heart-shaped blade with basal lobes & rough surface
 * - `orchid_strap`: Thick, fleshy, blunt-tipped oblong strap leaf with deep V-channel
 */
export function createSpeciesLeafGeometry(
  shape: LeafShapeType,
  length = 1.0,
  width = 0.5,
  arch = 0.35,
  wiltDroop = 0
): THREE.BufferGeometry {
  const segX = 28;
  const segY = 40;
  const geo = new THREE.PlaneGeometry(width, length, segX, segY);

  const pos = geo.attributes.position;
  const uvs = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = uvs.getX(i); // 0..1 across width
    const v = uvs.getY(i); // 0..1 from base (0) to tip (1)
    const symU = (u - 0.5) * 2; // -1..+1
    const absU = Math.abs(symU);

    let widthEnvelope = 1.0;
    let yOffset = 0;
    let zCup = 0;
    let edgeWave = 0;

    if (shape === 'mango_lanceolate') {
      // Narrow elongated lanceolate leaf tapering to a sharp drip-tip
      widthEnvelope = Math.pow(Math.sin(v * Math.PI), 0.65) * Math.pow(1 - v * 0.45, 0.7);
      // Characteristic wavy/undulate margins of Mango leaves
      edgeWave = Math.sin(v * Math.PI * 9) * 0.032 * length * Math.pow(absU, 1.4);
      zCup = -absU * width * 0.14;
    } else if (shape === 'orange_winged') {
      // Citrus leaf: narrow stem -> distinct winged petiole flare (v = 0.04..0.22) -> pinch -> oval blade
      if (v < 0.22) {
        const wingV = v / 0.22;
        widthEnvelope = Math.sin(wingV * Math.PI) * 0.42;
      } else {
        const bladeV = (v - 0.22) / 0.78;
        widthEnvelope = Math.pow(Math.sin(bladeV * Math.PI), 0.72);
      }
      zCup = -Math.pow(absU, 1.5) * width * 0.16;
    } else if (shape === 'sunflower_cordate') {
      // Heart-shaped (cordate) leaf: wide rounded basal lobes dipping inward at v=0
      const baseCordate = Math.pow(Math.sin(Math.min(1, v * 1.15) * Math.PI), 0.55) * (1 - v * 0.35);
      widthEnvelope = baseCordate;
      // Pull basal lobes downward around petiole attachment to create a heart notch
      if (v < 0.25) {
        const lobeFactor = Math.sin(absU * Math.PI * 0.85) * (1 - v / 0.25);
        yOffset = -lobeFactor * length * 0.14;
      }
      // Coarse teeth on margin
      if (absU > 0.75) {
        widthEnvelope += Math.sin(v * Math.PI * 16) * 0.035;
      }
      zCup = -absU * width * 0.08 + Math.sin((v * 8 - absU * 4) * Math.PI * 2) * 0.018 * length;
    } else if (shape === 'orchid_strap') {
      // Fleshy strap leaf: almost constant width from base to 85%, then bilobed rounded tip
      widthEnvelope =
        v < 0.85
          ? 0.65 + 0.35 * Math.sin((v / 0.85) * Math.PI * 0.7)
          : Math.cos(((v - 0.85) / 0.15) * Math.PI * 0.5);
      // Deep V-channel keel down the middle
      zCup = -absU * width * 0.26;
    } else {
      // `apple_ovate` or `rose_leaflet`: classic ovate leaf with saw-toothed serrations
      widthEnvelope = Math.pow(Math.sin(v * Math.PI), 0.7) * (1 - v * 0.12);
      const serrationFreq = shape === 'rose_leaflet' ? 22 : 16;
      const serrationAmp = shape === 'rose_leaflet' ? 0.065 : 0.045;
      if (v > 0.1 && v < 0.95) {
        // Sawtooth serration
        const tooth = ((v * serrationFreq) % 1) * serrationAmp;
        widthEnvelope += tooth;
      }
      const pleat = Math.sin((v * 10 - absU * 5) * Math.PI * 2) * 0.018 * length * absU;
      zCup = -absU * width * 0.18 + pleat;
    }

    const x = symU * (width * 0.5) * widthEnvelope;

    // Longitudinal arch + drought wilt droop
    const totalArch = arch + wiltDroop * 0.85;
    const bendAngle = Math.pow(v, 1.45) * totalArch;
    const rawY = v * length + yOffset;
    const y = rawY * Math.cos(bendAngle * 0.65);
    const z = rawY * Math.sin(bendAngle) + zCup + edgeWave;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * Generates an organic curved 3D stem/branch mesh using CatmullRomCurve3 + TubeGeometry
 * so stems and tree branches have natural botanical crookedness instead of rigid straight cylinders.
 */
export function createCurvedStemMesh(
  points: THREE.Vector3[],
  radiusBottom: number,
  radiusTop: number,
  material: THREE.Material,
  radialSegments = 12
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const tubularSegments = 20;
  const geo = new THREE.TubeGeometry(curve, tubularSegments, 1, radialSegments, false);

  // Taper radius smoothly from radiusBottom (t=0) to radiusTop (t=1)
  const pos = geo.attributes.position;
  const center = new THREE.Vector3();
  const vertex = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    const r = radiusBottom + (radiusTop - radiusBottom) * t;
    curve.getPointAt(t, center);

    for (let j = 0; j <= radialSegments; j++) {
      const idx = i * (radialSegments + 1) + j;
      vertex.fromBufferAttribute(pos, idx);
      vertex.sub(center).multiplyScalar(r).add(center);
      pos.setXYZ(idx, vertex.x, vertex.y, vertex.z);
    }
  }

  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Generates a realistic organic potting soil bump texture.
 */
export function createSoilBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(256, 256);
  const d = img.data;

  for (let i = 0; i < 256 * 256; i++) {
    const n = Math.floor(Math.random() * 180 + 40);
    d[i * 4] = n;
    d[i * 4 + 1] = n;
    d[i * 4 + 2] = n;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

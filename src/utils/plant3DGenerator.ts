import * as THREE from 'three';

/**
 * Generates a high-resolution procedural bump/normal heightmap and diffuse texture
 * for corrugated/ribbed botanical leaves (macro studio photography aesthetic).
 */
export function createLeafBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(512, 512);
  const data = imgData.data;

  for (let y = 0; y < 512; y++) {
    const v = y / 511; // 0 at base, 1 at tip
    for (let x = 0; x < 512; x++) {
      const u = (x / 511) * 2 - 1; // -1 to +1 across width
      const distFromMidrib = Math.abs(u);

      // Strong central midrib ridge
      const midrib = Math.exp(-distFromMidrib * 28) * 95;

      // Parallel/angled pleated secondary veins (like palm/fruit/monocot & dicot venation)
      const veinCoord = (v * 18 - distFromMidrib * 9) * Math.PI * 2;
      const majorPleats = (Math.sin(veinCoord) * 0.5 + 0.5) * 90;

      // Fine tertiary micro-striations
      const microVeins = (Math.sin((u * 65 + v * 30) * Math.PI) * 0.5 + 0.5) * 28;

      const heightVal = Math.min(255, Math.max(0, 70 + midrib + majorPleats + microVeins));
      const idx = (y * 512 + x) * 4;
      data[idx] = heightVal;
      data[idx + 1] = heightVal;
      data[idx + 2] = heightVal;
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
 * Generates a dynamic diffuse color texture for leaves that blends healthy chlorophyll,
 * vein highlights, and stress yellowing/necrosis.
 */
export function createLeafColorTexture(
  baseHex: string,
  secondaryHex: string,
  yellowing: number,
  necrosis: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  const cBase = new THREE.Color(baseHex);
  const cSec = new THREE.Color(secondaryHex);
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
    const v = y / 511; // 0 at tip, 1 at base in UV or vice versa
    for (let x = 0; x < 256; x++) {
      const u = (x / 255) * 2 - 1;
      const distCenter = Math.abs(u);

      // Pleat shading & lighter midrib/veins
      const pleatWave = Math.sin((v * 16 - distCenter * 8) * Math.PI * 2) * 0.5 + 0.5;
      const midribHighlight = Math.exp(-distCenter * 22);

      tempColor.copy(cBase).lerp(cSec, pleatWave * 0.65 + (1 - v) * 0.25);

      // Brighter yellow-green midrib
      if (midribHighlight > 0.1) {
        tempColor.lerp(new THREE.Color('#84cc16'), midribHighlight * 0.55);
      }

      // Edge & tip darkening or burn on stress
      if (distCenter > 0.82 || v < 0.08) {
        const edgeStress = Math.max(yellowing, necrosis);
        if (edgeStress > 0.15) {
          tempColor.lerp(cBrown, edgeStress * 0.7);
        } else {
          tempColor.multiplyScalar(0.88);
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
 * Builds a 3D sculpted, pleated/ribbed botanical leaf BufferGeometry.
 * Supports longitudinal arch, wilting droop, transverse V-fold, and corrugated ribs.
 */
export function createPleatedLeafGeometry(
  length = 1.6,
  width = 0.62,
  arch = 0.35,
  pleatDepth = 0.045,
  unfurlFactor = 1.0 // 0.1 = tightly folded vertical spear leaf, 1.0 = fully open blade
): THREE.BufferGeometry {
  const segX = 24;
  const segY = 36;
  const geo = new THREE.PlaneGeometry(width, length, segX, segY);

  const pos = geo.attributes.position;
  const uvs = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const u = uvs.getX(i); // 0..1 across width
    const v = uvs.getY(i); // 0..1 from base (0) to tip (1)

    const symU = (u - 0.5) * 2; // -1..+1
    const absU = Math.abs(symU);

    // Botanical lanceolate/ovate width envelope: narrow petiole base -> wide middle -> pointed apex
    const widthProfile = Math.pow(Math.sin(v * Math.PI), 0.72) * (1 - 0.15 * v);
    const effectiveUnfurl = 0.18 + 0.82 * unfurlFactor;

    const x = symU * (width * 0.5) * widthProfile * effectiveUnfurl;

    // Longitudinal curve (y height and z forward arch)
    const bendAngle = v * v * arch;
    const y = v * length * Math.cos(bendAngle * 0.55);
    let z = v * length * Math.sin(bendAngle);

    // V-shaped cup fold along midrib (tighter when young/unfurling)
    const vFold = absU * width * (0.28 * (1 - effectiveUnfurl * 0.65));

    // Corrugated diagonal pleats (like the ribbed leaves in the reference time-lapse)
    const pleatPhase = (v * 11 - absU * 4.5) * Math.PI * 2;
    const corrugation = Math.sin(pleatPhase) * pleatDepth * widthProfile * Math.min(1, v * 2.5);

    z += -vFold + corrugation;

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
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

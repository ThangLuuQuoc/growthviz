import React, { useEffect, useRef } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { PLANT_SPECIES } from '../data/species';
import { AlertTriangle, Sparkles, Sprout, Sun, Droplets, Thermometer } from 'lucide-react';

// Deterministic pseudo-random helper for stable procedural branching
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Hex color interpolation helper
function lerpColor(hexA: string, hexB: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const parse = (h: string) => {
    const clean = h.replace('#', '');
    return [
      parseInt(clean.substring(0, 2), 16),
      parseInt(clean.substring(2, 4), 16),
      parseInt(clean.substring(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(hexA);
  const [r2, g2, b2] = parse(hexB);
  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const b = Math.round(b1 + (b2 - b1) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

export const PlantCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const selectedSpeciesId = useSimulationStore((s) => s.selectedSpeciesId);
  const growthProgress = useSimulationStore((s) => s.growthProgress);
  const health = useSimulationStore((s) => s.health);
  const currentStage = useSimulationStore((s) => s.currentStage);
  const currentStageIndex = useSimulationStore((s) => s.currentStageIndex);
  const environment = useSimulationStore((s) => s.environment);
  const stress = useSimulationStore((s) => s.stress);
  const isPollinated = useSimulationStore((s) => s.isPollinated);
  const pruningLevel = useSimulationStore((s) => s.pruningLevel);
  const currentCropCount = useSimulationStore((s) => s.currentCropCount);
  const randomSeed = useSimulationStore((s) => s.randomSeed);
  const ageDays = useSimulationStore((s) => s.ageDays);

  const species = PLANT_SPECIES[selectedSpeciesId];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const width = rect.width;
      const height = rect.height;
      const soilSurfaceY = height * 0.76;
      const centerX = width * 0.5;

      // 1. DRAW SKY & ATMOSPHERE
      const sunNorm = environment.sunlight / 100;
      const tempNorm = Math.max(0, Math.min(1, (environment.temperature - 5) / 35));

      const skyTop = lerpColor('#0b132b', '#1d4ed8', sunNorm * 0.85);
      const skyMid = lerpColor('#1e293b', '#38bdf8', sunNorm * 0.9);
      const skyHorizon = lerpColor(
        '#334155',
        tempNorm > 0.7 ? '#fde68a' : '#bae6fd',
        0.35 + sunNorm * 0.65
      );

      const skyGrad = ctx.createLinearGradient(0, 0, 0, soilSurfaceY);
      skyGrad.addColorStop(0, skyTop);
      skyGrad.addColorStop(0.6, skyMid);
      skyGrad.addColorStop(1, skyHorizon);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, soilSurfaceY);

      // Subtle scientific grid overlay in sky
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.lineWidth = 1;
      const gridStep = 40;
      for (let gx = 0; gx < width; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, soilSurfaceY);
        ctx.stroke();
      }
      for (let gy = 0; gy < soilSurfaceY; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Draw Sun & Crepuscular Rays
      const sunX = width * 0.82;
      const sunY = height * (0.28 - sunNorm * 0.14);
      const sunRadius = 22 + sunNorm * 18;

      const sunGlow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, sunRadius * 4.2);
      sunGlow.addColorStop(0, `rgba(254, 240, 138, ${0.45 + sunNorm * 0.45})`);
      sunGlow.addColorStop(0.35, `rgba(250, 204, 21, ${0.15 + sunNorm * 0.25})`);
      sunGlow.addColorStop(1, 'rgba(250, 204, 21, 0)');
      ctx.fillStyle = sunGlow;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius * 4.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(254, 249, 195, ${0.5 + sunNorm * 0.5})`;
      ctx.beginPath();
      ctx.arc(sunX, sunY, sunRadius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Distant soft hills on horizon
      ctx.fillStyle = lerpColor('#0f172a', '#14532d', 0.25 + sunNorm * 0.5);
      ctx.beginPath();
      ctx.moveTo(0, soilSurfaceY);
      for (let x = 0; x <= width; x += 20) {
        const hillH = Math.sin(x * 0.006 + 1.2) * 16 + Math.cos(x * 0.015) * 8 + 18;
        ctx.lineTo(x, soilSurfaceY - hillH);
      }
      ctx.lineTo(width, soilSurfaceY);
      ctx.closePath();
      ctx.fill();

      // 2. DRAW SOIL CROSS-SECTION (Moisture & pH Reactive)
      const moistureNorm = environment.soilMoisture / 100;
      const soilTopColor = lerpColor('#855d3b', '#29190e', moistureNorm);
      const soilBottomColor = lerpColor('#4a321f', '#120b06', moistureNorm);

      const soilGrad = ctx.createLinearGradient(0, soilSurfaceY, 0, height);
      soilGrad.addColorStop(0, soilTopColor);
      soilGrad.addColorStop(0.35, lerpColor(soilTopColor, soilBottomColor, 0.5));
      soilGrad.addColorStop(1, soilBottomColor);
      ctx.fillStyle = soilGrad;
      ctx.fillRect(0, soilSurfaceY, width, height - soilSurfaceY);

      // Soil surface grass/moss rim
      const surfaceGrassColor = lerpColor(
        '#785937',
        '#15803d',
        Math.min(1, moistureNorm * 1.2) * (1 - stress.droughtWilting * 0.7)
      );
      ctx.fillStyle = surfaceGrassColor;
      ctx.fillRect(0, soilSurfaceY - 3, width, 6);

      // Soil mineral & moisture texture speckles
      for (let i = 0; i < 65; i++) {
        const sx = seededRandom(i * 17 + randomSeed) * width;
        const sy = soilSurfaceY + 10 + seededRandom(i * 31 + randomSeed) * (height - soilSurfaceY - 16);
        const sr = 1.2 + seededRandom(i * 43) * 2.5;
        ctx.fillStyle =
          moistureNorm > 0.65 && i % 3 === 0
            ? 'rgba(56, 189, 248, 0.22)'
            : 'rgba(255, 255, 255, 0.06)';
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. DRAW PROCEDURAL ROOT SYSTEM
      const rootScale = Math.min(1, (growthProgress + 4) / 65);
      const drawRootBranch = (
        x: number,
        y: number,
        len: number,
        angle: number,
        thickness: number,
        depth: number,
        branchId: number
      ) => {
        if (depth <= 0 || len < 3) return;
        const endX = x + Math.sin(angle) * len;
        const endY = y + Math.cos(angle) * len;

        ctx.strokeStyle =
          stress.overwaterYellowing > 0.5
            ? '#57412d'
            : lerpColor('#a68a64', '#d6c29f', depth / 5);
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(
          (x + endX) / 2 + (seededRandom(branchId) - 0.5) * 8,
          (y + endY) / 2,
          endX,
          endY
        );
        ctx.stroke();

        // Nutrient uptake ion pulse traveling up the roots
        if (growthProgress > 5 && depth <= 2) {
          const pulseT = (elapsed * 0.9 + seededRandom(branchId * 7)) % 1;
          const px = endX + (x - endX) * pulseT;
          const py = endY + (y - endY) * pulseT;
          ctx.fillStyle =
            stress.phLockoutChlorosis > 0.4
              ? 'rgba(245, 158, 11, 0.45)'
              : 'rgba(52, 211, 153, 0.65)';
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }

        const subBranches = depth === 4 ? 3 : 2;
        for (let i = 0; i < subBranches; i++) {
          const spread = (i - (subBranches - 1) / 2) * 0.55 + (seededRandom(branchId + i * 19) - 0.5) * 0.25;
          drawRootBranch(
            endX,
            endY,
            len * (0.68 + seededRandom(branchId + i) * 0.15),
            angle + spread,
            thickness * 0.65,
            depth - 1,
            branchId * 3 + i + 1
          );
        }
      };

      const maxRootDepth = growthProgress < 10 ? 2 : growthProgress < 35 ? 3 : 4;
      drawRootBranch(
        centerX,
        soilSurfaceY + 4,
        (24 + rootScale * 34) * (height / 600),
        0,
        2.5 + rootScale * 4.5,
        maxRootDepth,
        randomSeed + 101
      );

      // 4. COMPUTE LEAF COLOR & STRESS MORPHOLOGY
      const morph = species.morphology;
      const yellowingFactor = Math.min(
        1,
        Math.max(
          stress.overwaterYellowing * 0.9,
          stress.phLockoutChlorosis * 0.85,
          stress.nutrientDeficiency * 0.65
        )
      );
      const necrosisFactor = Math.max(0, (55 - health) / 55);

      let activeLeafColor = morph.leafColorHealthy;
      let activeLeafSecondary = morph.leafColorSecondary;

      if (yellowingFactor > 0.05) {
        activeLeafColor = lerpColor(activeLeafColor, '#ca8a04', yellowingFactor);
        activeLeafSecondary = lerpColor(activeLeafSecondary, '#eab308', yellowingFactor);
      }
      if (necrosisFactor > 0.05) {
        activeLeafColor = lerpColor(activeLeafColor, '#78350f', necrosisFactor);
        activeLeafSecondary = lerpColor(activeLeafSecondary, '#92400e', necrosisFactor);
      }

      const wiltDroopRad = stress.droughtWilting * 0.68;
      const windBreeze = Math.sin(elapsed * 1.6) * 0.035;

      // Helper to draw an individual botanical leaf
      const drawLeaf = (
        x: number,
        y: number,
        angle: number,
        size: number,
        isSecondary: boolean,
        serrated = false
      ) => {
        ctx.save();
        ctx.translate(x, y);
        // Apply drought wilting droop downward
        const effectiveAngle = angle + (angle >= 0 ? wiltDroopRad : -wiltDroopRad) + windBreeze;
        ctx.rotate(effectiveAngle);

        ctx.fillStyle = isSecondary ? activeLeafSecondary : activeLeafColor;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.lineWidth = 0.8;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        const leafWidth = size * (serrated ? 0.48 : 0.42);
        ctx.bezierCurveTo(leafWidth, -size * 0.3, leafWidth, -size * 0.75, 0, -size);
        ctx.bezierCurveTo(-leafWidth, -size * 0.75, -leafWidth, -size * 0.3, 0, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Central midrib vein
        ctx.strokeStyle =
          stress.phLockoutChlorosis > 0.3
            ? '#15803d' // Interveinal chlorosis keeps veins greener than lamina
            : 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, -1);
        ctx.lineTo(0, -size * 0.82);
        ctx.stroke();

        ctx.restore();
      };

      // Helper to draw a 5-petal blossom cluster (for Fruit Trees)
      const drawBlossom = (x: number, y: number, scale: number, seed: number) => {
        if (scale <= 0.05) return;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(elapsed * 2 + seed) * 0.08);
        const r = 6.5 * scale;

        for (let p = 0; p < 5; p++) {
          const pAngle = (p * Math.PI * 2) / 5;
          const px = Math.cos(pAngle) * r * 0.65;
          const py = Math.sin(pAngle) * r * 0.65;
          ctx.fillStyle = morph.flowerPetalColor;
          ctx.beginPath();
          ctx.arc(px, py, r * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }

        // Flower stamens & center
        ctx.fillStyle = morph.flowerCenterColor;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
        ctx.fill();

        if (isPollinated) {
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      };

      // Helper to draw developing & ripe fruit (Apple, Mango, Orange)
      const drawFruit = (x: number, y: number, maturity: number, seed: number) => {
        if (maturity <= 0.02) return;
        ctx.save();
        ctx.translate(x, y + 3);
        ctx.rotate(Math.sin(elapsed * 1.8 + seed) * 0.05);

        const ripeness = Math.max(0, Math.min(1, (growthProgress - 76) / 18));
        const fruitColor = lerpColor(morph.fruitColorUnripe, morph.fruitColorRipe, ripeness);
        const radius = (5 + maturity * 9.5) * (0.75 + (health / 100) * 0.3);

        // Short fruit pedicel stem
        ctx.strokeStyle = '#4a3525';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -radius * 0.8);
        ctx.lineTo(0, -radius * 1.25);
        ctx.stroke();

        ctx.fillStyle = fruitColor;
        ctx.beginPath();
        if (morph.fruitShape === 'mango') {
          // Elongated asymmetrical mango drupe shape
          ctx.ellipse(0, 0, radius * 0.78, radius * 1.12, 0.2, 0, Math.PI * 2);
        } else if (morph.fruitShape === 'apple') {
          // Indented apple pome
          ctx.arc(-radius * 0.22, 0, radius * 0.78, 0, Math.PI * 2);
          ctx.arc(radius * 0.22, 0, radius * 0.78, 0, Math.PI * 2);
        } else {
          // Spherical citrus orange
          ctx.arc(0, 0, radius * 0.92, 0, Math.PI * 2);
        }
        ctx.fill();

        // Specular shine highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.beginPath();
        ctx.arc(-radius * 0.28, -radius * 0.28, radius * 0.26, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      };

      // 5. STAGE 1: SEED GERMINATION (0% to 10%)
      if (growthProgress < 10) {
        const seedY = soilSurfaceY + 14;
        const swell = 1 + (growthProgress / 10) * 0.35;
        ctx.save();
        ctx.translate(centerX, seedY);
        ctx.fillStyle = '#5c3a21';
        ctx.strokeStyle = '#8c6239';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, 0, 7 * swell, 5 * swell, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Emerging plumule shoot pushing toward soil surface
        if (growthProgress > 2) {
          const shootH = ((growthProgress - 2) / 8) * 22;
          ctx.strokeStyle = '#84cc16';
          ctx.lineWidth = 2.8;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, -3);
          ctx.quadraticCurveTo(3, -3 - shootH * 0.5, 0, -3 - shootH);
          ctx.stroke();

          if (growthProgress > 6.5) {
            drawLeaf(0, -3 - shootH, -0.5, 8, false);
            drawLeaf(0, -3 - shootH, 0.5, 8, true);
          }
        }
        ctx.restore();
      } else if (species.category === 'fruit_tree') {
        // 6A. PROCEDURAL FRACTAL FRUIT TREE RENDERER (Apple, Mango, Orange)
        const treeMaturity = Math.min(1, (growthProgress - 8) / 55);
        const etiolationStretch = 1 + stress.lowLightEtiolation * 0.22;
        const baseTrunkLen =
          (28 + treeMaturity * 92) *
          morph.baseHeightScale *
          etiolationStretch *
          (height / 620);
        const baseThickness = 3.5 + treeMaturity * 15;

        const maxDepth =
          growthProgress < 18
            ? 1
            : growthProgress < 28
            ? 3
            : growthProgress < 42
            ? 4
            : growthProgress < 55
            ? 5
            : morph.maxBranchDepth;

        const leafDensityMultiplier =
          Math.max(0.25, (health / 100) * (1 - stress.lowLightEtiolation * 0.45));

        const drawTreeFractal = (
          x: number,
          y: number,
          len: number,
          angle: number,
          thickness: number,
          depth: number,
          branchId: number
        ) => {
          if (depth <= 0 || len < 4) return;

          const sway = windBreeze * (morph.maxBranchDepth - depth + 1) * 0.35;
          const curAngle = angle + sway;
          const endX = x + Math.sin(curAngle) * len;
          const endY = y - Math.cos(curAngle) * len;

          // Draw woody branch segment
          ctx.strokeStyle = depth > 2 ? morph.trunkColor : morph.trunkHighlight;
          ctx.lineWidth = thickness;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Terminal or sub-terminal foliage, blossoms, and fruits
          if (depth <= 3 || maxDepth <= 2) {
            const leafSize = (9 + treeMaturity * 8) * (0.75 + seededRandom(branchId) * 0.35);
            const numLeaves = Math.max(1, Math.round(3 * leafDensityMultiplier));
            for (let l = 0; l < numLeaves; l++) {
              const lAngle =
                curAngle + (l - (numLeaves - 1) / 2) * 0.85 + (seededRandom(branchId + l) - 0.5) * 0.4;
              drawLeaf(endX, endY, lAngle, leafSize, l % 2 === 0);
            }

            // Blossoms during Flowering (60% to 78%)
            if (growthProgress >= 60 && growthProgress <= 80 && depth === 1 && branchId % 2 === 0) {
              const bloomScale =
                growthProgress < 70
                  ? (growthProgress - 60) / 10
                  : Math.max(0, 1 - (growthProgress - 74) / 6);
              drawBlossom(endX, endY, bloomScale, branchId);
            }

            // Fruits during Fruiting & Harvest (74% to 100%)
            if (growthProgress >= 74 && depth === 1) {
              const fruitMod = isPollinated ? 3 : 5;
              if (branchId % fruitMod === 0) {
                const fruitMaturity = Math.min(1, (growthProgress - 74) / 20);
                drawFruit(endX, endY, fruitMaturity, branchId);
              }
            }
          }

          if (depth > 1) {
            // Pruned trees have cleaner, more open scaffold structure
            const hasCenterShoot =
              depth >= 3 && pruningLevel < 0.65 && seededRandom(branchId * 13) > 0.45;
            const spread = morph.branchSpreadAngle * (1 + pruningLevel * 0.12);

            const leftJitter = (seededRandom(branchId * 3 + 1) - 0.5) * 0.16;
            const rightJitter = (seededRandom(branchId * 3 + 2) - 0.5) * 0.16;

            drawTreeFractal(
              endX,
              endY,
              len * (0.72 + seededRandom(branchId + 5) * 0.1),
              curAngle - spread + leftJitter,
              thickness * morph.trunkTaper,
              depth - 1,
              branchId * 2 + 1
            );

            drawTreeFractal(
              endX,
              endY,
              len * (0.72 + seededRandom(branchId + 9) * 0.1),
              curAngle + spread + rightJitter,
              thickness * morph.trunkTaper,
              depth - 1,
              branchId * 2 + 2
            );

            if (hasCenterShoot) {
              drawTreeFractal(
                endX,
                endY,
                len * 0.64,
                curAngle + (seededRandom(branchId * 7) - 0.5) * 0.25,
                thickness * 0.62,
                depth - 1,
                branchId * 3 + 3
              );
            }
          }
        };

        drawTreeFractal(
          centerX,
          soilSurfaceY + 2,
          baseTrunkLen,
          0,
          baseThickness,
          maxDepth,
          randomSeed + 1
        );
      } else {
        // 6B. FLOWERING PLANTS RENDERER (Rose, Sunflower, Orchid)
        const plantScale = Math.min(1, (growthProgress - 8) / 55) * (height / 600);
        const isWiltingStage = growthProgress >= 92;
        const senescenceDroop = isWiltingStage ? ((growthProgress - 92) / 8) * 0.45 : 0;

        if (species.id === 'sunflower') {
          // GIANT SUNFLOWER (Helianthus annuus)
          const stalkHeight = (35 + plantScale * 235) * (1 + stress.lowLightEtiolation * 0.18);
          const stalkTopX =
            centerX + Math.sin(windBreeze * 1.5 + wiltDroopRad * 0.4 + senescenceDroop) * 28;
          const stalkTopY = soilSurfaceY - stalkHeight;

          // Thick fibrous main stem
          ctx.strokeStyle = activeLeafColor;
          ctx.lineWidth = 4 + plantScale * 9;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(centerX, soilSurfaceY + 2);
          ctx.quadraticCurveTo(
            centerX + (stalkTopX - centerX) * 0.4,
            soilSurfaceY - stalkHeight * 0.5,
            stalkTopX,
            stalkTopY
          );
          ctx.stroke();

          // Opposite pairs of large cordate sunflower leaves along the stalk
          const leafPairs = Math.min(6, Math.floor(growthProgress / 12));
          for (let i = 1; i <= leafPairs; i++) {
            const t = i / (leafPairs + 1);
            const lx = centerX + (stalkTopX - centerX) * t * 0.85;
            const ly = soilSurfaceY - stalkHeight * t;
            const lSize = (16 + plantScale * 22) * (1 - t * 0.25);
            drawLeaf(lx - 3, ly, -1.05 - wiltDroopRad, lSize, i % 2 === 0, true);
            drawLeaf(lx + 3, ly, 1.05 + wiltDroopRad, lSize, i % 2 !== 0, true);
          }

          // Budding & Full Bloom Capitulum (52% to 100%)
          if (growthProgress >= 50) {
            const bloomOpen = Math.min(1, Math.max(0.15, (growthProgress - 50) / 24));
            const headRadius = (12 + bloomOpen * 34) * (0.8 + (health / 100) * 0.25);

            ctx.save();
            ctx.translate(stalkTopX, stalkTopY);
            ctx.rotate(wiltDroopRad * 0.6 + senescenceDroop * 1.1 + windBreeze);

            // Outer green involucral bracts (sepals)
            const numBracts = 16;
            for (let b = 0; b < numBracts; b++) {
              const bAngle = (b * Math.PI * 2) / numBracts;
              ctx.save();
              ctx.rotate(bAngle);
              ctx.fillStyle = activeLeafColor;
              ctx.beginPath();
              ctx.moveTo(-4, 0);
              ctx.lineTo(0, -headRadius * 1.25);
              ctx.lineTo(4, 0);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
            }

            // Golden Ray Florets (unfold as growthProgress moves from 55% to 75%)
            if (growthProgress >= 54) {
              const rayScale = Math.min(1, (growthProgress - 54) / 20);
              const numRays = 24;
              const rayColor = isWiltingStage
                ? lerpColor('#facc15', '#a16207', (growthProgress - 92) / 8)
                : '#facc15';

              for (let r = 0; r < numRays; r++) {
                const rAngle = (r * Math.PI * 2) / numRays;
                ctx.save();
                ctx.rotate(rAngle);
                ctx.fillStyle = r % 2 === 0 ? rayColor : lerpColor(rayColor, '#f59e0b', 0.45);
                ctx.beginPath();
                const rayLen = headRadius * (0.65 + rayScale * 0.95);
                ctx.ellipse(0, -headRadius * 0.55 - rayLen * 0.35, 4.8 * rayScale, rayLen * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
              }
            }

            // Central Fibonacci Spiral Disc
            ctx.fillStyle = '#422006';
            ctx.beginPath();
            ctx.arc(0, 0, headRadius * 0.68, 0, Math.PI * 2);
            ctx.fill();

            const goldenAngle = 137.508 * (Math.PI / 180);
            const numSeeds = 85;
            for (let s = 1; s <= numSeeds; s++) {
              const r = headRadius * 0.62 * Math.sqrt(s / numSeeds);
              const theta = s * goldenAngle;
              const sx = r * Math.cos(theta);
              const sy = r * Math.sin(theta);
              ctx.fillStyle =
                s % 3 === 0 ? '#eab308' : isPollinated ? '#1c1917' : '#78350f';
              ctx.beginPath();
              ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();
          }
        } else if (species.id === 'rose') {
          // CRIMSON ROSE (Rosa hybrida) — Multi-cane thorny shrub with spiral blooms
          const numCanes = growthProgress < 25 ? 1 : growthProgress < 45 ? 3 : 5;
          const caneConfigs = [
            { spread: 0, hScale: 1.0 },
            { spread: -0.32, hScale: 0.86 },
            { spread: 0.3, hScale: 0.88 },
            { spread: -0.58, hScale: 0.72 },
            { spread: 0.55, hScale: 0.75 },
          ];

          for (let c = 0; c < numCanes; c++) {
            const cfg = caneConfigs[c];
            const caneLen = (32 + plantScale * 175) * cfg.hScale;
            const caneAngle = cfg.spread * (1 + pruningLevel * 0.15) + windBreeze;
            const tipX = centerX + Math.sin(caneAngle) * caneLen;
            const tipY = soilSurfaceY - Math.cos(caneAngle) * caneLen;

            // Woody rose cane
            ctx.strokeStyle = activeLeafColor;
            ctx.lineWidth = 3.2 + plantScale * 2.8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(centerX, soilSurfaceY + 2);
            ctx.quadraticCurveTo(
              centerX + Math.sin(caneAngle) * caneLen * 0.45,
              soilSurfaceY - caneLen * 0.55,
              tipX,
              tipY
            );
            ctx.stroke();

            // Recurved thorns & compound leaves along each cane
            const nodes = 4;
            for (let n = 1; n < nodes; n++) {
              const nt = n / nodes;
              const nx = centerX + (tipX - centerX) * nt;
              const ny = soilSurfaceY + (tipY - soilSurfaceY) * nt;

              // Thorn
              ctx.fillStyle = '#881337';
              ctx.beginPath();
              ctx.moveTo(nx, ny - 3);
              ctx.lineTo(nx + (n % 2 === 0 ? 6 : -6), ny);
              ctx.lineTo(nx, ny + 3);
              ctx.closePath();
              ctx.fill();

              // Pinnate leaflets
              const lSide = n % 2 === 0 ? 1 : -1;
              drawLeaf(nx, ny, caneAngle + lSide * 0.9, 13 + plantScale * 9, n % 2 === 0, true);
              drawLeaf(
                nx + lSide * 8,
                ny - 5,
                caneAngle + lSide * 1.1,
                10 + plantScale * 7,
                true,
                true
              );
            }

            // Rose Bud & Spiral Bloom at cane apex (52% to 100%)
            if (growthProgress >= 52) {
              const bloomProgress = Math.min(1, (growthProgress - 52) / 24);
              const rSize = (8 + bloomProgress * 15) * cfg.hScale * (0.8 + (health / 100) * 0.25);

              ctx.save();
              ctx.translate(tipX, tipY);
              ctx.rotate(caneAngle + wiltDroopRad * 0.5 + senescenceDroop);

              // Green calyx sepals
              ctx.fillStyle = activeLeafColor;
              for (let s = -1; s <= 1; s++) {
                ctx.beginPath();
                ctx.ellipse(s * 4, 2, 3, rSize * 0.7, s * 0.4, 0, Math.PI * 2);
                ctx.fill();
              }

              // Concentric spiral rose petals
              const petalBase = isWiltingStage
                ? lerpColor('#e11d48', '#881337', (growthProgress - 92) / 8)
                : '#e11d48';
              const layers = growthProgress < 72 ? 2 : 4;
              for (let layer = layers; layer >= 1; layer--) {
                const layerRad = rSize * (layer / layers);
                const petalsInLayer = 5;
                for (let p = 0; p < petalsInLayer; p++) {
                  const pAng = (p * Math.PI * 2) / petalsInLayer + layer * 0.6;
                  const px = Math.cos(pAng) * layerRad * 0.38 * bloomProgress;
                  const py = Math.sin(pAng) * layerRad * 0.32 * bloomProgress - rSize * 0.25;
                  ctx.fillStyle = lerpColor('#881337', petalBase, layer / layers);
                  ctx.beginPath();
                  ctx.arc(px, py, layerRad * 0.55, 0, Math.PI * 2);
                  ctx.fill();
                }
              }

              ctx.restore();
            }
          }
        } else {
          // MOTH ORCHID (Phalaenopsis aphrodite) — Basal strap leaves, aerial roots & arching spike
          // Silvery-green velamen aerial roots curling above soil surface
          const numAerial = growthProgress < 25 ? 2 : 4;
          for (let a = 0; a < numAerial; a++) {
            const side = a % 2 === 0 ? -1 : 1;
            const rootLen = (18 + plantScale * 42) * (0.7 + a * 0.15);
            ctx.strokeStyle = '#86efac';
            ctx.lineWidth = 3.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(centerX + side * 6, soilSurfaceY);
            ctx.quadraticCurveTo(
              centerX + side * rootLen * 0.7,
              soilSurfaceY - 14 - a * 4,
              centerX + side * rootLen,
              soilSurfaceY + 4
            );
            ctx.stroke();
          }

          // Basal rosette of glossy strap leaves
          const strapPairs = growthProgress < 25 ? 1 : growthProgress < 45 ? 2 : 3;
          for (let p = 0; p < strapPairs; p++) {
            const strapLen = (28 + plantScale * 58) * (1 - p * 0.15);
            for (const side of [-1, 1]) {
              ctx.save();
              ctx.translate(centerX, soilSurfaceY - p * 6);
              ctx.rotate(side * (0.95 - p * 0.18 + wiltDroopRad * 0.5));
              ctx.fillStyle = p % 2 === 0 ? activeLeafColor : activeLeafSecondary;
              ctx.beginPath();
              ctx.ellipse(0, -strapLen * 0.5, 11, strapLen * 0.5, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }
          }

          // Arching inflorescence spike (from Vegetative 30%+)
          if (growthProgress >= 28) {
            const spikeScale = Math.min(1, (growthProgress - 28) / 38);
            const spikeH = (55 + spikeScale * 155) * (height / 600);
            const archTipX = centerX + 68 * spikeScale + Math.sin(windBreeze * 2) * 10;
            const archTipY = soilSurfaceY - spikeH * 0.78 + wiltDroopRad * 25;
            const ctrlX = centerX - 18;
            const ctrlY = soilSurfaceY - spikeH * 1.15;

            ctx.strokeStyle = '#14532d';
            ctx.lineWidth = 3.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(centerX, soilSurfaceY - 8);
            ctx.quadraticCurveTo(ctrlX, ctrlY, archTipX, archTipY);
            ctx.stroke();

            // Orchid buds & bilateral Phalaenopsis flowers along the upper half of the arching spike
            if (growthProgress >= 52) {
              const numFlowers = growthProgress < 68 ? 3 : 5;
              for (let f = 0; f < numFlowers; f++) {
                const t = 0.48 + (f / numFlowers) * 0.48;
                // Quadratic Bezier point
                const fx =
                  (1 - t) * (1 - t) * centerX + 2 * (1 - t) * t * ctrlX + t * t * archTipX;
                const fy =
                  (1 - t) * (1 - t) * (soilSurfaceY - 8) +
                  2 * (1 - t) * t * ctrlY +
                  t * t * archTipY;

                const isOpen = growthProgress >= 70 || (growthProgress >= 58 && f < 2);
                ctx.save();
                ctx.translate(fx, fy);
                ctx.rotate(Math.sin(elapsed * 1.8 + f) * 0.08 + senescenceDroop);

                if (!isOpen) {
                  // Swelling magenta orchid bud
                  ctx.fillStyle = '#a21caf';
                  ctx.beginPath();
                  ctx.ellipse(0, 4, 5, 7, 0.3, 0, Math.PI * 2);
                  ctx.fill();
                } else {
                  const oSize = (11 + (1 - f * 0.1) * 5) * (0.8 + (health / 100) * 0.25);
                  const orchidColor = isWiltingStage
                    ? lerpColor('#d946ef', '#701a75', (growthProgress - 92) / 8)
                    : '#e879f9';

                  // Dorsal & lateral sepals
                  ctx.fillStyle = '#f5d0fe';
                  ctx.beginPath();
                  ctx.ellipse(0, -oSize * 0.55, oSize * 0.38, oSize * 0.55, 0, 0, Math.PI * 2);
                  ctx.ellipse(-oSize * 0.45, oSize * 0.35, oSize * 0.35, oSize * 0.5, 0.5, 0, Math.PI * 2);
                  ctx.ellipse(oSize * 0.45, oSize * 0.35, oSize * 0.35, oSize * 0.5, -0.5, 0, Math.PI * 2);
                  ctx.fill();

                  // Broad lateral butterfly petals
                  ctx.fillStyle = orchidColor;
                  ctx.beginPath();
                  ctx.ellipse(-oSize * 0.65, -oSize * 0.1, oSize * 0.62, oSize * 0.48, -0.2, 0, Math.PI * 2);
                  ctx.ellipse(oSize * 0.65, -oSize * 0.1, oSize * 0.62, oSize * 0.48, 0.2, 0, Math.PI * 2);
                  ctx.fill();

                  // Crimson-spotted Labellum lip
                  ctx.fillStyle = '#be123c';
                  ctx.beginPath();
                  ctx.ellipse(0, oSize * 0.25, oSize * 0.32, oSize * 0.42, 0, 0, Math.PI * 2);
                  ctx.fill();

                  ctx.fillStyle = '#fef08a';
                  ctx.beginPath();
                  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
                  ctx.fill();
                }
                ctx.restore();
              }
            }
          }
        }
      }

      // 7. AMBIENT POLLEN / BIO-PARTICLES
      if (isPollinated || currentStage === 'Flowering' || currentStage === 'Full Bloom') {
        for (let p = 0; p < 18; p++) {
          const px =
            centerX +
            Math.sin(elapsed * 0.7 + p * 1.7) * (width * 0.22) +
            Math.cos(p * 3.1) * 30;
          const py =
            soilSurfaceY * 0.45 +
            Math.cos(elapsed * 0.9 + p * 2.3) * (soilSurfaceY * 0.28);
          ctx.fillStyle = 'rgba(253, 224, 71, 0.65)';
          ctx.beginPath();
          ctx.arc(px, py, 2 + (p % 2), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Depth Labels in Soil
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillText('0 cm — TOPSOIL / RHIZOSPHERE', 14, soilSurfaceY + 18);
      ctx.fillText(`pH ${environment.soilPh.toFixed(1)} | H₂O ${environment.soilMoisture.toFixed(0)}%`, 14, soilSurfaceY + 34);
      ctx.fillText('-30 cm — SUBSOIL MINERAL HORIZON', 14, height - 12);

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [
    species,
    growthProgress,
    health,
    currentStage,
    environment,
    stress,
    isPollinated,
    pruningLevel,
    currentCropCount,
    randomSeed,
  ]);

  // Active Stress Badges for HUD overlay
  const activeStressAlerts: { label: string; severity: number; detail: string }[] = [];
  if (stress.droughtWilting >= 0.25) {
    activeStressAlerts.push({
      label: 'Drought Wilting',
      severity: stress.droughtWilting,
      detail: 'Low turgor — water plant',
    });
  }
  if (stress.overwaterYellowing >= 0.25) {
    activeStressAlerts.push({
      label: 'Root Hypoxia (Overwatered)',
      severity: stress.overwaterYellowing,
      detail: 'Leaf chlorosis active',
    });
  }
  if (stress.phLockoutChlorosis >= 0.25) {
    activeStressAlerts.push({
      label: 'pH Nutrient Lockout',
      severity: stress.phLockoutChlorosis,
      detail: `Soil pH ${environment.soilPh.toFixed(1)} out of range`,
    });
  }
  if (stress.lowLightEtiolation >= 0.25) {
    activeStressAlerts.push({
      label: 'Low-Light Etiolation',
      severity: stress.lowLightEtiolation,
      detail: 'Stunted photosynthesis',
    });
  }
  if (stress.thermalStress >= 0.25) {
    activeStressAlerts.push({
      label: 'Thermal / Light Stress',
      severity: stress.thermalStress,
      detail: `${environment.temperature}°C ambient`,
    });
  }

  return (
    <div className="relative flex-1 h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Main Procedural HTML5 Canvas */}
      <canvas ref={canvasRef} className="w-full flex-1 block" />

      {/* Top-Left Specimen HUD Badge */}
      <div className="absolute top-3 left-3 flex flex-col gap-2 pointer-events-none max-w-xs">
        <div className="bg-slate-900/85 backdrop-blur-md border border-slate-700/70 rounded-xl px-3.5 py-2.5 shadow-xl">
          <div className="flex items-center gap-2">
            <Sprout className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-sm text-white">{species.name}</span>
            <span className="text-[11px] font-mono italic text-slate-400">
              ({species.scientificName})
            </span>
          </div>
          <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
            {species.stages[currentStageIndex]?.description}
          </p>
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-800 text-[11px] font-mono text-slate-300">
            <span className="flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              {environment.sunlight}%
            </span>
            <span className="flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              {environment.temperature}°C
            </span>
            <span className="flex items-center gap-1">
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
              {environment.soilMoisture.toFixed(0)}%
            </span>
            <span className="text-emerald-400 font-semibold">Day {ageDays}</span>
          </div>
        </div>

        {/* Active Stress Indicators Overlay */}
        {activeStressAlerts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {activeStressAlerts.map((alert) => (
              <div
                key={alert.label}
                className="flex items-center gap-2 bg-amber-950/90 border border-amber-500/60 text-amber-200 px-3 py-1.5 rounded-lg text-xs shadow-lg backdrop-blur-md"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <div>
                  <div className="font-semibold leading-tight">
                    {alert.label} ({Math.round(alert.severity * 100)}%)
                  </div>
                  <div className="text-[10px] text-amber-300/80">{alert.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top-Right Pollination / Crop Status Pill */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 pointer-events-none">
        {isPollinated && (
          <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/50 text-amber-200 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Pollinated {currentCropCount > 0 ? `(${currentCropCount} Fruit Set)` : ''}
          </div>
        )}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] font-mono text-slate-400">
          Canopy Pruning: {Math.round(pruningLevel * 100)}%
        </div>
      </div>

      {/* Bottom Biological Stage Pipeline Bar */}
      <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-2.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <span className="font-semibold uppercase tracking-wider text-slate-300">
            Ontogenetic Life Cycle Pipeline —{' '}
            <span className="text-emerald-400">{currentStage}</span>
          </span>
          <span className="font-mono text-slate-300">
            {growthProgress.toFixed(1)}% Complete
          </span>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5">
          {species.stages.map((st, idx) => {
            const isPassed = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;
            return (
              <div
                key={st.name}
                className={`px-2 py-1.5 rounded-md border text-center transition-all ${
                  isCurrent
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-200 shadow-sm shadow-emerald-500/20'
                    : isPassed
                    ? 'bg-slate-800/90 border-emerald-800/50 text-emerald-400/80'
                    : 'bg-slate-900/60 border-slate-800 text-slate-500'
                }`}
              >
                <div className="text-[10px] font-mono opacity-75">
                  {st.minProgress}–{st.maxProgress}%
                </div>
                <div className="text-[11px] font-semibold truncate">{st.name}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

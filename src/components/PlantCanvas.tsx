import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useSimulationStore } from '../store/useSimulationStore';
import { PLANT_SPECIES, SPECIES_LIST } from '../data/species';
import {
  createLeafBumpTexture,
  createLeafColorTexture,
  createPleatedLeafGeometry,
  createSoilBumpTexture,
} from '../utils/plant3DGenerator';
import {
  Play,
  Pause,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
  Sparkles,
  Camera,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface PlantCanvasProps {
  cinemaMode?: boolean;
  onToggleCinemaMode?: () => void;
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export const PlantCanvas: React.FC<PlantCanvasProps> = ({
  cinemaMode = false,
  onToggleCinemaMode,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);

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
  const isRunning = useSimulationStore((s) => s.isRunning);
  const speed = useSimulationStore((s) => s.speed);

  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const selectSpecies = useSimulationStore((s) => s.selectSpecies);
  const scrubToProgress = useSimulationStore((s) => s.scrubToProgress);
  const resetSimulation = useSimulationStore((s) => s.resetSimulation);

  const species = PLANT_SPECIES[selectedSpeciesId];

  // Persistent Three.js scene references
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    plantGroup: THREE.Group;
    soilMesh: THREE.Mesh;
    soilMaterial: THREE.MeshStandardMaterial;
    keyLight: THREE.SpotLight;
    rimLight: THREE.DirectionalLight;
    fillLight: THREE.DirectionalLight;
    leafBumpTex: THREE.CanvasTexture;
    pollenPoints: THREE.Points;
  } | null>(null);

  // 1. INITIALIZE THREE.JS STUDIO SCENE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000'); // Pitch-black macro studio backdrop
    scene.fog = new THREE.FogExp2('#000000', 0.045);

    const camera = new THREE.PerspectiveCamera(
      36,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      100
    );
    camera.position.set(0, 1.85, 5.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 1.15, 0);
    controls.minDistance = 2.2;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI * 0.53;

    // STUDIO LIGHTING SETUP (Boxlapse macro lighting style)
    const ambientLight = new THREE.AmbientLight('#1e293b', 0.45);
    scene.add(ambientLight);

    // Overhead / Front-Right Studio Key Spotlight
    const keyLight = new THREE.SpotLight('#fffbeb', 42);
    keyLight.position.set(3.2, 7.5, 4.2);
    keyLight.angle = Math.PI / 3.2;
    keyLight.penumbra = 0.75;
    keyLight.decay = 1.4;
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Dramatic Back/Left Rim Light for translucent leaf veins & edges
    const rimLight = new THREE.DirectionalLight('#a7f3d0', 2.4);
    rimLight.position.set(-3.5, 4.2, -3.8);
    scene.add(rimLight);

    // Subtle front fill light
    const fillLight = new THREE.DirectionalLight('#93c5fd', 0.85);
    fillLight.position.set(-2.5, 1.8, 4.0);
    scene.add(fillLight);

    // 3D PLANTER POT & ORGANIC SOIL MOUND WITH PERLITE SPECKS
    const potGroup = new THREE.Group();
    scene.add(potGroup);

    // Matte Dark Nursery Pot Cylinder
    const potGeo = new THREE.CylinderGeometry(1.75, 1.38, 1.8, 48, 1, true);
    const potMat = new THREE.MeshStandardMaterial({
      color: '#141416',
      roughness: 0.42,
      metalness: 0.15,
      side: THREE.DoubleSide,
    });
    const potWall = new THREE.Mesh(potGeo, potMat);
    potWall.position.y = -0.92;
    potWall.receiveShadow = true;
    potGroup.add(potWall);

    // Glossy Pot Rim Torus (catches thin white studio rim highlight like in screenshots)
    const rimGeo = new THREE.TorusGeometry(1.75, 0.055, 20, 64);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: '#1f2024',
      roughness: 0.25,
      metalness: 0.3,
    });
    const potRim = new THREE.Mesh(rimGeo, rimMat);
    potRim.position.y = -0.02;
    potRim.receiveShadow = true;
    potGroup.add(potRim);

    // Domed Organic Potting Soil Surface
    const soilBump = createSoilBumpTexture();
    const soilGeo = new THREE.CylinderGeometry(1.71, 1.71, 0.28, 48, 8);
    const posAttr = soilGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      if (vy > 0) {
        const dist = Math.sqrt(vx * vx + vz * vz) / 1.71;
        const dome = Math.cos(dist * Math.PI * 0.5) * 0.16;
        const microNoise = (seededRandom(i * 13) - 0.5) * 0.045;
        posAttr.setY(i, vy + dome + microNoise);
      }
    }
    soilGeo.computeVertexNormals();

    const soilMaterial = new THREE.MeshStandardMaterial({
      color: '#1c120b',
      roughness: 0.85,
      metalness: 0.05,
      bumpMap: soilBump,
      bumpScale: 0.06,
    });
    const soilMesh = new THREE.Mesh(soilGeo, soilMaterial);
    soilMesh.position.y = -0.14;
    soilMesh.receiveShadow = true;
    potGroup.add(soilMesh);

    // Scattered 3D Perlite, Vermiculite & Organic Bark Specks on the soil
    const perliteGeo = new THREE.DodecahedronGeometry(0.032, 0);
    const perliteMat = new THREE.MeshStandardMaterial({
      color: '#e5dec9',
      roughness: 0.6,
    });
    const barkMat = new THREE.MeshStandardMaterial({
      color: '#5c3a1e',
      roughness: 0.85,
    });

    for (let i = 0; i < 110; i++) {
      const r = Math.sqrt(seededRandom(i * 19 + 7)) * 1.56;
      const theta = seededRandom(i * 31 + 3) * Math.PI * 2;
      const px = Math.cos(theta) * r;
      const pz = Math.sin(theta) * r;
      const distNorm = r / 1.71;
      const py = Math.cos(distNorm * Math.PI * 0.5) * 0.16 + 0.01;

      const isPerlite = i % 3 !== 0;
      const speck = new THREE.Mesh(perliteGeo, isPerlite ? perliteMat : barkMat);
      const s = isPerlite
        ? 0.5 + seededRandom(i * 41) * 1.1
        : 0.9 + seededRandom(i * 43) * 1.6;
      speck.scale.set(s, s * 0.6, s * 1.2);
      speck.position.set(px, py, pz);
      speck.rotation.set(
        seededRandom(i) * 3,
        seededRandom(i + 1) * 3,
        seededRandom(i + 2) * 3
      );
      speck.castShadow = true;
      speck.receiveShadow = true;
      potGroup.add(speck);
    }

    // Floating Pollen / Bio-Particles Group
    const pollenGeo = new THREE.BufferGeometry();
    const pollenPositions = new Float32Array(60 * 3);
    for (let i = 0; i < 60; i++) {
      pollenPositions[i * 3] = (Math.random() - 0.5) * 3.5;
      pollenPositions[i * 3 + 1] = 0.5 + Math.random() * 3.5;
      pollenPositions[i * 3 + 2] = (Math.random() - 0.5) * 3.5;
    }
    pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPositions, 3));
    const pollenMat = new THREE.PointsMaterial({
      color: '#fde047',
      size: 0.045,
      transparent: true,
      opacity: 0,
    });
    const pollenPoints = new THREE.Points(pollenGeo, pollenMat);
    scene.add(pollenPoints);

    // Plant Root Hierarchy Group
    const plantGroup = new THREE.Group();
    plantGroup.position.y = 0.12; // Crown of soil mound
    scene.add(plantGroup);

    const leafBumpTex = createLeafBumpTexture();

    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      plantGroup,
      soilMesh,
      soilMaterial,
      keyLight,
      rimLight,
      fillLight,
      leafBumpTex,
      pollenPoints,
    };

    // Animation Loop
    let reqId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Subtle organic time-lapse micro-breathing / breeze motion
      if (plantGroup) {
        plantGroup.rotation.z = Math.sin(t * 1.2) * 0.012;
        plantGroup.rotation.x = Math.cos(t * 0.9) * 0.008;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(reqId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Sync AutoRotate
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.controls.autoRotate = autoRotate;
      sceneRef.current.controls.autoRotateSpeed = 1.2;
    }
  }, [autoRotate]);

  // 2. REBUILD 3D PROCEDURAL PLANT MESH ON SIMULATION STATE UPDATES
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    const {
      plantGroup,
      soilMaterial,
      keyLight,
      rimLight,
      leafBumpTex,
      pollenPoints,
      camera,
      controls,
    } = ctx;

    // Clear previous plant meshes cleanly
    while (plantGroup.children.length > 0) {
      const child = plantGroup.children[0];
      plantGroup.remove(child);
    }

    // Update Soil Moisture Visuals (Dry dusty brown -> Dark wet rich peat)
    const moistureNorm = environment.soilMoisture / 100;
    const drySoil = new THREE.Color('#3d2817');
    const wetSoil = new THREE.Color('#110a06');
    soilMaterial.color.copy(drySoil).lerp(wetSoil, moistureNorm);
    soilMaterial.roughness = 0.95 - moistureNorm * 0.45;

    // Update Studio Lighting from Sunlight & Temperature
    const sunNorm = environment.sunlight / 100;
    keyLight.intensity = 14 + sunNorm * 38;
    rimLight.intensity = 1.0 + sunNorm * 2.2;

    // Update Pollen Particles visibility
    const pollenMat = pollenPoints.material as THREE.PointsMaterial;
    pollenMat.opacity =
      isPollinated || currentStage === 'Flowering' || currentStage === 'Full Bloom'
        ? 0.75
        : 0;

    // Compute Stress & Leaf Material PBR Properties
    const morph = species.morphology;
    const yellowing = Math.min(
      1,
      Math.max(
        stress.overwaterYellowing * 0.9,
        stress.phLockoutChlorosis * 0.85,
        stress.nutrientDeficiency * 0.65
      )
    );
    const necrosis = Math.max(0, (55 - health) / 55);
    const wiltDroop = stress.droughtWilting * 0.65;

    const leafColorTex = createLeafColorTexture(
      morph.leafColorHealthy,
      morph.leafColorSecondary,
      yellowing,
      necrosis
    );

    const leafMaterial = new THREE.MeshPhysicalMaterial({
      map: leafColorTex,
      bumpMap: leafBumpTex,
      bumpScale: 0.038,
      roughness: 0.36 + yellowing * 0.25,
      metalness: 0.02,
      clearcoat: 0.28 * (1 - yellowing * 0.5),
      clearcoatRoughness: 0.35,
      transmission: 0.18, // Translucent studio backlit effect!
      thickness: 0.1,
      side: THREE.DoubleSide,
    });

    const stemColor = new THREE.Color(morph.trunkColor).lerp(
      new THREE.Color('#4d7c2b'),
      Math.max(0, 1 - growthProgress / 45)
    );
    const stemMaterial = new THREE.MeshStandardMaterial({
      color: stemColor,
      roughness: 0.72,
      bumpMap: leafBumpTex,
      bumpScale: 0.015,
    });

    // Helper: Create a 3D Pleated Leaf with Petiole Stem
    const create3DLeafUnit = (
      len: number,
      width: number,
      arch: number,
      unfurl: number
    ): THREE.Group => {
      const unit = new THREE.Group();
      const petioleLen = len * 0.24;

      // Slender petiole stalk with tiny root/stem hairs
      const petioleGeo = new THREE.CylinderGeometry(
        0.018 * len,
        0.028 * len,
        petioleLen,
        10
      );
      petioleGeo.translate(0, petioleLen * 0.5, 0);
      const petioleMesh = new THREE.Mesh(petioleGeo, stemMaterial);
      petioleMesh.castShadow = true;
      petioleMesh.receiveShadow = true;
      unit.add(petioleMesh);

      // Sculpted 3D Pleated Leaf Blade attached to top of petiole
      const bladeGeo = createPleatedLeafGeometry(
        len * 0.85,
        width,
        arch + wiltDroop * 0.9,
        0.042,
        unfurl
      );
      const bladeMesh = new THREE.Mesh(bladeGeo, leafMaterial);
      bladeMesh.position.y = petioleLen * 0.95;
      bladeMesh.castShadow = true;
      bladeMesh.receiveShadow = true;
      unit.add(bladeMesh);

      return unit;
    };

    // Helper: Create 3D 5-Petal Blossom
    const create3DBlossom = (scale: number): THREE.Group => {
      const flower = new THREE.Group();
      const petalMat = new THREE.MeshPhysicalMaterial({
        color: morph.flowerPetalColor,
        roughness: 0.3,
        transmission: 0.25,
        side: THREE.DoubleSide,
      });
      const petalGeo = createPleatedLeafGeometry(0.24 * scale, 0.14 * scale, 0.4, 0.01, 1);

      for (let p = 0; p < 5; p++) {
        const pGroup = new THREE.Group();
        pGroup.rotation.y = (p * Math.PI * 2) / 5;
        const pMesh = new THREE.Mesh(petalGeo, petalMat);
        pMesh.rotation.x = 0.65;
        pGroup.add(pMesh);
        flower.add(pGroup);
      }

      const centerMat = new THREE.MeshStandardMaterial({
        color: morph.flowerCenterColor,
        emissive: isPollinated ? '#ca8a04' : '#000000',
        emissiveIntensity: isPollinated ? 0.4 : 0,
        roughness: 0.5,
      });
      const centerMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.055 * scale, 12, 12),
        centerMat
      );
      flower.add(centerMesh);
      return flower;
    };

    // Helper: Create 3D PBR Fruit (Apple, Mango, Orange)
    const create3DFruit = (maturity: number): THREE.Group => {
      const fruitGroup = new THREE.Group();
      const ripeness = Math.max(0, Math.min(1, (growthProgress - 76) / 18));
      const fruitColor = new THREE.Color(morph.fruitColorUnripe).lerp(
        new THREE.Color(morph.fruitColorRipe),
        ripeness
      );

      const radius = (0.09 + maturity * 0.15) * (0.75 + (health / 100) * 0.25);
      const fruitMat = new THREE.MeshPhysicalMaterial({
        color: fruitColor,
        roughness: morph.fruitShape === 'orange' ? 0.35 : 0.2,
        clearcoat: 0.65,
        clearcoatRoughness: 0.18,
        bumpMap: morph.fruitShape === 'orange' ? leafBumpTex : null,
        bumpScale: morph.fruitShape === 'orange' ? 0.008 : 0,
      });

      const sphereGeo = new THREE.SphereGeometry(radius, 24, 24);
      const fruitMesh = new THREE.Mesh(sphereGeo, fruitMat);
      if (morph.fruitShape === 'mango') {
        fruitMesh.scale.set(0.82, 1.28, 0.75);
        fruitMesh.rotation.z = 0.18;
      } else if (morph.fruitShape === 'apple') {
        fruitMesh.scale.set(1.05, 0.92, 1.05);
      }
      fruitMesh.position.y = -radius * 0.95;
      fruitMesh.castShadow = true;
      fruitGroup.add(fruitMesh);

      return fruitGroup;
    };

    // =========================================================================
    // STAGE-BY-STAGE 3D BOTANICAL MORPHOGENESIS
    // =========================================================================

    if (growthProgress < 6) {
      // SEED & EMERGING RADICLE/PLUMULE TIP (0% - 6%)
      const shootFactor = growthProgress / 6;
      const seedMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 16, 16),
        new THREE.MeshStandardMaterial({ color: '#4a2c11', roughness: 0.8 })
      );
      seedMesh.scale.set(1.3, 0.85, 0.95);
      seedMesh.position.y = 0.02;
      plantGroup.add(seedMesh);

      if (shootFactor > 0.15) {
        const spear = create3DLeafUnit(
          0.25 + shootFactor * 0.45,
          0.12 + shootFactor * 0.1,
          0.12,
          0.25
        );
        spear.position.y = 0.04;
        plantGroup.add(spear);
      }
    } else if (growthProgress <= 42) {
      // MACRO STUDIO SEEDLING & ROSETTE SPROUT (Matches Screenshot 1 "Day 127" & Screenshot 2 "Day 248"!)
      const stageNorm = (growthProgress - 6) / 36; // 0 to 1 across 6%..42%
      const stemH = 0.22 + stageNorm * 0.55;

      // Basal hypocotyl stem emerging from dark potting soil
      const mainStemGeo = new THREE.CylinderGeometry(
        0.032 + stageNorm * 0.025,
        0.048 + stageNorm * 0.035,
        stemH,
        16
      );
      mainStemGeo.translate(0, stemH * 0.5, 0);
      const mainStem = new THREE.Mesh(mainStemGeo, stemMaterial);
      mainStem.castShadow = true;
      plantGroup.add(mainStem);

      // Tiny fibrous root hairs around stem base (like Screenshot 1 & 2)
      const hairMat = new THREE.MeshBasicMaterial({
        color: '#a3b18a',
        transparent: true,
        opacity: 0.45,
      });
      for (let h = 0; h < 18; h++) {
        const hy = (h / 18) * stemH * 0.85;
        const hAng = h * 2.4;
        const hairGeo = new THREE.CylinderGeometry(0.002, 0.001, 0.06, 4);
        hairGeo.rotateZ(Math.PI * 0.4);
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.set(0, hy, 0);
        hair.rotation.y = hAng;
        plantGroup.add(hair);
      }

      if (growthProgress < 19) {
        // BIFID V-SHAPED PLEATED TWIN LEAVES (Exact match to "Day 127" screenshot!)
        const twinProgress = (growthProgress - 6) / 13; // 0..1
        const leafLen = 0.75 + twinProgress * 0.95;
        const leafWidth = 0.34 + twinProgress * 0.36;
        const vSpreadAngle = 0.24 + twinProgress * 0.28;

        // Left & Right V-split twin leaves
        for (const side of [-1, 1]) {
          const bladeGeo = createPleatedLeafGeometry(
            leafLen,
            leafWidth,
            0.22 + wiltDroop * 0.7,
            0.048,
            0.55 + twinProgress * 0.45
          );
          const blade = new THREE.Mesh(bladeGeo, leafMaterial);
          blade.position.y = stemH * 0.92;
          blade.rotation.z = side * vSpreadAngle;
          blade.rotation.y = side * 0.22;
          blade.rotation.x = 0.14 + wiltDroop * 0.4;
          blade.castShadow = true;
          blade.receiveShadow = true;
          plantGroup.add(blade);
        }
      } else {
        // MULTI-FROND ROSETTE WITH CENTRAL SPEAR LEAF (Exact match to "Day 248" screenshot!)
        const rosetteNorm = (growthProgress - 19) / 23; // 0..1
        const totalLeaves = Math.min(8, Math.floor(3 + rosetteNorm * 5.5));
        const goldenAngle = 137.5 * (Math.PI / 180);

        for (let i = 0; i < totalLeaves; i++) {
          const leafAge = (totalLeaves - i) / totalLeaves; // 1 = oldest outer leaf, ~0.15 = newest center spear
          const isCentralSpear = i === totalLeaves - 1;

          const lLen = (0.85 + leafAge * 0.95) * (0.8 + rosetteNorm * 0.35);
          const lWidth = (0.28 + leafAge * 0.28) * (isCentralSpear ? 0.65 : 1.0);
          const lArch = isCentralSpear ? 0.12 : 0.28 + leafAge * 0.55;
          const unfurl = isCentralSpear ? 0.38 : Math.min(1, 0.55 + leafAge * 0.5);

          const leafUnit = create3DLeafUnit(lLen, lWidth, lArch, unfurl);
          leafUnit.position.y = stemH * (0.65 + (1 - leafAge) * 0.32);

          // Phyllotaxis radial distribution + outward tilt for older fronds
          const azimuth = i * goldenAngle + (i % 2 === 0 ? 0.15 : -0.15);
          const tiltOutward = isCentralSpear ? 0.08 : 0.22 + leafAge * 0.58 + wiltDroop * 0.5;

          leafUnit.rotation.y = azimuth;
          leafUnit.rotation.x = tiltOutward;
          plantGroup.add(leafUnit);
        }
      }
    } else if (species.category === 'fruit_tree') {
      // MATURE 3D TREE CANOPY, BLOSSOMS & RIPENING FRUITS (42% - 100%)
      const treeMaturity = Math.min(1, (growthProgress - 35) / 45);
      const maxDepth = growthProgress < 52 ? 3 : 4;

      const buildBranch3D = (
        parent: THREE.Object3D,
        len: number,
        radiusBottom: number,
        depth: number,
        branchId: number
      ) => {
        const radiusTop = radiusBottom * 0.72;
        const cylGeo = new THREE.CylinderGeometry(radiusTop, radiusBottom, len, 12);
        cylGeo.translate(0, len * 0.5, 0);
        const branchMesh = new THREE.Mesh(cylGeo, stemMaterial);
        branchMesh.castShadow = true;
        branchMesh.receiveShadow = true;
        parent.add(branchMesh);

        // Tip node at top of this branch segment
        const tipNode = new THREE.Group();
        tipNode.position.y = len;
        branchMesh.add(tipNode);

        // Add 3D pleated leaves at outer branches
        if (depth <= 2) {
          const leafCount = depth === 1 ? 3 : 2;
          for (let l = 0; l < leafCount; l++) {
            const leaf = create3DLeafUnit(
              0.55 + treeMaturity * 0.3,
              0.24 + treeMaturity * 0.1,
              0.42,
              1.0
            );
            leaf.rotation.y = (l * Math.PI * 2) / leafCount + branchId;
            leaf.rotation.x = 0.55 + wiltDroop * 0.5;
            tipNode.add(leaf);
          }

          // 3D Blossoms during Flowering (60% - 78%)
          if (growthProgress >= 60 && growthProgress <= 80 && depth === 1) {
            const bloomScale =
              growthProgress < 72
                ? (growthProgress - 60) / 12
                : Math.max(0.1, 1 - (growthProgress - 74) / 6);
            const blossom = create3DBlossom(0.8 + bloomScale * 0.7);
            blossom.position.y = 0.08;
            tipNode.add(blossom);
          }

          // 3D Ripening Fruits during Fruiting & Harvest (74% - 100%)
          if (growthProgress >= 74 && depth === 1 && branchId % 2 === 0) {
            const fruitMaturity = Math.min(1, (growthProgress - 74) / 22);
            const fruit = create3DFruit(fruitMaturity);
            tipNode.add(fruit);
          }
        }

        if (depth > 1) {
          const numSub = depth === maxDepth ? 3 : 2;
          for (let i = 0; i < numSub; i++) {
            const childPivot = new THREE.Group();
            const azimuth =
              (i * Math.PI * 2) / numSub +
              (seededRandom(branchId * 7 + i) - 0.5) * 0.45;
            const spread =
              morph.branchSpreadAngle *
              (0.85 + pruningLevel * 0.25 + seededRandom(branchId + i) * 0.25);

            childPivot.rotation.y = azimuth;
            childPivot.rotation.z = spread;
            tipNode.add(childPivot);

            buildBranch3D(
              childPivot,
              len * (0.72 + seededRandom(branchId + i * 3) * 0.12),
              radiusTop,
              depth - 1,
              branchId * 3 + i + 1
            );
          }
        }
      };

      const trunkLen = 0.85 + treeMaturity * 0.65;
      const trunkRad = 0.075 + treeMaturity * 0.065;
      buildBranch3D(plantGroup, trunkLen, trunkRad, maxDepth, randomSeed + 1);
    } else {
      // MATURE 3D FLOWERING PLANTS (Rose, Sunflower, Orchid — 42% to 100%)
      const bloomMaturity = Math.max(0, Math.min(1, (growthProgress - 50) / 30));
      const isWilting = growthProgress >= 92;
      const senescence = isWilting ? ((growthProgress - 92) / 8) * 0.55 : 0;

      if (species.id === 'sunflower') {
        const stalkH = 1.75 + Math.min(1, (growthProgress - 35) / 35) * 0.75;
        const stalkGeo = new THREE.CylinderGeometry(0.055, 0.085, stalkH, 16);
        stalkGeo.translate(0, stalkH * 0.5, 0);
        const stalkMesh = new THREE.Mesh(stalkGeo, stemMaterial);
        stalkMesh.castShadow = true;
        plantGroup.add(stalkMesh);

        // Spiral cordate 3D leaves along stalk
        const numLeaves = 7;
        for (let i = 1; i <= numLeaves; i++) {
          const t = i / (numLeaves + 1);
          const leaf = create3DLeafUnit(0.85 * (1 - t * 0.25), 0.46, 0.48, 1.0);
          leaf.position.y = stalkH * t;
          leaf.rotation.y = i * 2.3;
          leaf.rotation.x = 0.62 + wiltDroop * 0.5;
          plantGroup.add(leaf);
        }

        // 3D Capitulum Sunflower Head at apex
        if (growthProgress >= 50) {
          const headGroup = new THREE.Group();
          headGroup.position.y = stalkH;
          headGroup.rotation.x = 0.35 + wiltDroop * 0.5 + senescence;
          plantGroup.add(headGroup);

          const discRad = 0.22 + bloomMaturity * 0.24;
          const discMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(discRad, discRad * 0.85, 0.09, 32),
            new THREE.MeshStandardMaterial({ color: '#2e1505', roughness: 0.9 })
          );
          discMesh.rotation.x = Math.PI * 0.5;
          headGroup.add(discMesh);

          // 24 Golden 3D Ray Petals
          const rayMat = new THREE.MeshPhysicalMaterial({
            color: isWilting ? '#ca8a04' : '#facc15',
            roughness: 0.35,
            side: THREE.DoubleSide,
          });
          const rayGeo = createPleatedLeafGeometry(
            0.38 * (0.4 + bloomMaturity * 0.6),
            0.12,
            0.25,
            0.015,
            1
          );
          for (let r = 0; r < 24; r++) {
            const rayPivot = new THREE.Group();
            rayPivot.rotation.z = (r * Math.PI * 2) / 24;
            const ray = new THREE.Mesh(rayGeo, rayMat);
            ray.position.y = discRad * 0.85;
            ray.rotation.x = -0.15;
            rayPivot.add(ray);
            headGroup.add(rayPivot);
          }
        }
      } else if (species.id === 'rose') {
        // 3D Multi-Cane Crimson Rose with Spiral 3D Petals
        const caneAngles = [0, -0.32, 0.32, -0.22, 0.25];
        for (let c = 0; c < 5; c++) {
          const caneGroup = new THREE.Group();
          caneGroup.rotation.y = (c * Math.PI * 2) / 5;
          caneGroup.rotation.z = caneAngles[c];
          plantGroup.add(caneGroup);

          const caneH = 1.35 + (c === 0 ? 0.35 : 0.1 * (c % 2));
          const caneGeo = new THREE.CylinderGeometry(0.025, 0.04, caneH, 12);
          caneGeo.translate(0, caneH * 0.5, 0);
          caneGroup.add(new THREE.Mesh(caneGeo, stemMaterial));

          for (let l = 1; l <= 3; l++) {
            const leaf = create3DLeafUnit(0.62, 0.28, 0.4, 1.0);
            leaf.position.y = caneH * (l / 4);
            leaf.rotation.y = l * 2.1;
            leaf.rotation.x = 0.55 + wiltDroop * 0.4;
            caneGroup.add(leaf);
          }

          if (growthProgress >= 52 && c < 3) {
            const roseHead = new THREE.Group();
            roseHead.position.y = caneH;
            roseHead.rotation.x = wiltDroop * 0.5 + senescence;
            caneGroup.add(roseHead);

            const roseMat = new THREE.MeshPhysicalMaterial({
              color: isWilting ? '#881337' : '#e11d48',
              roughness: 0.32,
              clearcoat: 0.2,
              side: THREE.DoubleSide,
            });
            const layers = growthProgress < 70 ? 2 : 4;
            for (let layer = 1; layer <= layers; layer++) {
              const pGeo = createPleatedLeafGeometry(
                0.18 + layer * 0.04,
                0.14 + layer * 0.03,
                0.55,
                0.01,
                1
              );
              for (let p = 0; p < 5; p++) {
                const pPivot = new THREE.Group();
                pPivot.rotation.y = (p * Math.PI * 2) / 5 + layer * 0.65;
                const petal = new THREE.Mesh(pGeo, roseMat);
                petal.rotation.x = 0.2 + layer * 0.22 * (0.4 + bloomMaturity * 0.6);
                pPivot.add(petal);
                roseHead.add(pPivot);
              }
            }
          }
        }
      } else {
        // 3D Moth Orchid with Basal Strap Rosette & Arching Flower Spike
        for (let i = 0; i < 6; i++) {
          const strap = create3DLeafUnit(1.05, 0.38, 0.45, 0.95);
          strap.position.y = 0.08 + (i >> 1) * 0.08;
          strap.rotation.y = (i % 2 === 0 ? 1 : -1) * (1.2 + i * 0.08);
          strap.rotation.x = 0.65 + wiltDroop * 0.4;
          plantGroup.add(strap);
        }

        // Arching 3D Inflorescence Spike
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.1, 0),
          new THREE.Vector3(-0.15, 1.1, 0),
          new THREE.Vector3(0.25, 1.85, 0.15),
          new THREE.Vector3(0.75, 1.65 - wiltDroop * 0.3, 0.25),
        ]);
        const spikeGeo = new THREE.TubeGeometry(curve, 24, 0.025, 10, false);
        plantGroup.add(new THREE.Mesh(spikeGeo, stemMaterial));

        if (growthProgress >= 52) {
          const numBlooms = growthProgress < 70 ? 2 : 4;
          for (let b = 0; b < numBlooms; b++) {
            const pt = curve.getPoint(0.52 + b * 0.15);
            const bloom = create3DBlossom(1.25);
            bloom.position.copy(pt);
            bloom.rotation.x = Math.PI * 0.45 + senescence;
            plantGroup.add(bloom);
          }
        }
      }
    }

    // Smoothly adjust camera target height based on plant height
    const targetY = growthProgress < 42 ? 0.85 + (growthProgress / 42) * 0.35 : 1.35;
    controls.target.set(0, targetY, 0);
    camera.updateProjectionMatrix();
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

  const handleResetCamera = () => {
    if (!sceneRef.current) return;
    sceneRef.current.camera.position.set(0, 1.85, 5.4);
    sceneRef.current.controls.target.set(0, 1.15, 0);
    sceneRef.current.controls.update();
  };

  // Next species cycle helper for bottom Boxlapse pill (`Snake Fruit >`)
  const handleCycleSpecies = () => {
    const idx = SPECIES_LIST.findIndex((s) => s.id === selectedSpeciesId);
    const next = SPECIES_LIST[(idx + 1) % SPECIES_LIST.length];
    selectSpecies(next.id);
  };

  // Active Stress Indicators
  const activeStressAlerts: { label: string; severity: number }[] = [];
  if (stress.droughtWilting >= 0.25) {
    activeStressAlerts.push({ label: 'Drought Wilting', severity: stress.droughtWilting });
  }
  if (stress.overwaterYellowing >= 0.25) {
    activeStressAlerts.push({
      label: 'Overwater Chlorosis',
      severity: stress.overwaterYellowing,
    });
  }
  if (stress.phLockoutChlorosis >= 0.25) {
    activeStressAlerts.push({
      label: `pH Lockout (${environment.soilPh.toFixed(1)})`,
      severity: stress.phLockoutChlorosis,
    });
  }

  return (
    <div className="relative flex-1 h-full flex flex-col bg-black overflow-hidden select-none">
      {/* Three.js WebGL Viewport */}
      <div ref={mountRef} className="w-full flex-1 cursor-grab active:cursor-grabbing" />

      {/* ===================================================================== */}
      {/* TOP-LEFT MINIMALIST STUDIO MACRO HUD (Exact Boxlapse Aesthetic)       */}
      {/* ===================================================================== */}
      <div className="absolute top-6 left-7 pointer-events-none flex flex-col gap-1.5 z-10">
        {/* Giant Thin "Day XXX" Counter */}
        <div
          className="text-5xl sm:text-6xl font-extralight tracking-tight text-white/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
          style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 200 }}
        >
          Day {ageDays}
        </div>

        {/* Droplet Moisture % */}
        <div className="flex items-center gap-2.5 text-2xl sm:text-3xl font-light text-white/90 mt-1">
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6 text-white/90 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            <text
              x="12"
              y="16"
              textAnchor="middle"
              fontSize="7.5"
              fill="currentColor"
              stroke="none"
              fontWeight="600"
            >
              %
            </text>
          </svg>
          <span className="tracking-wide">{environment.soilMoisture.toFixed(1)}%</span>
        </div>

        {/* Thermometer °C */}
        <div className="flex items-center gap-2.5 text-2xl sm:text-3xl font-light text-white/90">
          <svg
            viewBox="0 0 24 24"
            className="w-6 h-6 text-white/90 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
            <circle cx="11.5" cy="17.5" r="2" fill="currentColor" />
          </svg>
          <span className="tracking-wide">{environment.temperature.toFixed(1)} °C</span>
        </div>

        {/* Subtle Soil pH & Health Sub-Caption */}
        <div className="flex items-center gap-3 mt-2 text-xs font-mono text-white/55">
          <span>pH {environment.soilPh.toFixed(1)}</span>
          <span>•</span>
          <span>Light {environment.sunlight}%</span>
          <span>•</span>
          <span
            className={
              health >= 75
                ? 'text-emerald-400/90'
                : health >= 45
                ? 'text-amber-400/90'
                : 'text-rose-400/90'
            }
          >
            Health {health.toFixed(0)}%
          </span>
        </div>

        {/* Active Stress Badges */}
        {activeStressAlerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {activeStressAlerts.map((a) => (
              <div
                key={a.label}
                className="flex items-center gap-1.5 bg-amber-950/85 border border-amber-500/50 text-amber-200 px-2.5 py-1 rounded-md text-[11px] backdrop-blur-md"
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>
                  {a.label} ({Math.round(a.severity * 100)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top-Right Studio Camera Controls */}
      <div className="absolute top-5 right-5 flex items-center gap-2 z-10">
        {isPollinated && (
          <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40 text-amber-200 px-3 py-1.5 rounded-full text-xs backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Pollinated</span>
          </div>
        )}

        <button
          onClick={() => setAutoRotate((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border backdrop-blur-md transition-all cursor-pointer ${
            autoRotate
              ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200'
              : 'bg-white/5 hover:bg-white/10 border-white/15 text-white/75'
          }`}
          title="Toggle 360° Turntable Rotation"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>360° Spin</span>
        </button>

        <button
          onClick={handleResetCamera}
          className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/15 text-white/75 backdrop-blur-md transition-all cursor-pointer"
          title="Reset Macro Studio Camera Angle"
        >
          Reset View
        </button>

        {onToggleCinemaMode && (
          <button
            onClick={onToggleCinemaMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-md transition-all cursor-pointer"
            title={cinemaMode ? 'Show Inspector Panels' : 'Full-Screen Studio Cinema Mode'}
          >
            {cinemaMode ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Cinema Mode</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* ===================================================================== */}
      {/* BOTTOM TIMELAPSE CHAPTER SCRUBBER & PLAYER BAR (Boxlapse Style)       */}
      {/* ===================================================================== */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent pt-8 pb-3.5 px-5 z-10">
        {/* Segmented Chapter Timeline Scrubber */}
        <div className="relative group mb-3">
          {/* Interactive Range Input for Scrubbing */}
          <input
            type="range"
            min={0}
            max={100}
            step={0.2}
            value={growthProgress}
            onChange={(e) => scrubToProgress(parseFloat(e.target.value))}
            className="w-full h-4 absolute -top-1.5 left-0 z-20 opacity-0 cursor-pointer"
            title="Drag to scrub across plant life cycle stages"
          />

          {/* Segmented Chapter Bars */}
          <div className="flex items-center gap-1.5 w-full h-1.5">
            {species.stages.map((st, idx) => {
              const span = st.maxProgress - st.minProgress;
              const segFill = Math.max(
                0,
                Math.min(100, ((growthProgress - st.minProgress) / span) * 100)
              );
              return (
                <div
                  key={st.name}
                  style={{ width: `${span}%` }}
                  className="h-full bg-white/25 rounded-full overflow-hidden relative"
                >
                  <div
                    className="h-full bg-[#ff0033] transition-all duration-75"
                    style={{ width: `${segFill}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Red Scrubber Playhead Dot */}
          <div
            className="w-3.5 h-3.5 rounded-full bg-[#ff0033] shadow-[0_0_10px_#ff0033] pointer-events-none absolute -top-1 -translate-x-1/2 transition-transform group-hover:scale-125"
            style={{ left: `${growthProgress}%` }}
          />
        </div>

        {/* Bottom Player Transport Controls */}
        <div className="flex items-center justify-between text-white/90">
          <div className="flex items-center gap-4">
            {/* Play / Pause Button */}
            <button
              onClick={togglePlay}
              className="p-1.5 hover:text-white text-white/90 transition-transform active:scale-90 cursor-pointer"
              title={isRunning ? 'Pause Time-lapse' : 'Play Time-lapse'}
            >
              {isRunning ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </button>

            {/* Reset Button */}
            <button
              onClick={resetSimulation}
              className="p-1.5 hover:text-white text-white/75 transition-colors cursor-pointer"
              title="Reset to Day 0 Seed"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Progress / Maturity Readout */}
            <div className="text-xs sm:text-sm font-medium tracking-wide text-white/90 font-mono">
              {growthProgress.toFixed(1)}% <span className="text-white/40">/</span> 100%
            </div>

            {/* Species & Stage Chapter Pill (`Apple Tree · Sprout >`) */}
            <button
              onClick={handleCycleSpecies}
              className="flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 text-xs sm:text-sm font-medium text-white transition-colors cursor-pointer"
              title="Click to switch to next plant species"
            >
              <span>{species.name}</span>
              <span className="text-white/50 mx-1">•</span>
              <span className="text-emerald-300">{currentStage}</span>
              <ChevronRight className="w-4 h-4 text-white/70" />
            </button>
          </div>

          {/* Right Speed Pill Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-white/45 mr-1 hidden md:inline">
              Drag 3D to Rotate • Scroll to Zoom
            </span>
            {([1, 5, 10] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-all cursor-pointer ${
                  speed === s
                    ? 'bg-white text-black'
                    : 'bg-white/10 hover:bg-white/20 text-white/80'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useSimulationStore } from '../store/useSimulationStore';
import { PLANT_SPECIES, SPECIES_LIST } from '../data/species';
import {
  LeafShapeType,
  createCurvedStemMesh,
  createSoilBumpTexture,
  createSpeciesLeafBumpTexture,
  createSpeciesLeafColorTexture,
  createSpeciesLeafGeometry,
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

const SPECIES_LEAF_SHAPE: Record<string, LeafShapeType> = {
  apple: 'apple_ovate',
  mango: 'mango_lanceolate',
  orange: 'orange_winged',
  rose: 'rose_leaflet',
  sunflower: 'sunflower_cordate',
  orchid: 'orchid_strap',
};

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
    pollenPoints: THREE.Points;
  } | null>(null);

  // 1. INITIALIZE THREE.JS STUDIO SCENE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#000000');
    scene.fog = new THREE.FogExp2('#000000', 0.04);

    const camera = new THREE.PerspectiveCamera(
      35,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      100
    );
    camera.position.set(0, 1.85, 5.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.target.set(0, 1.05, 0);
    controls.minDistance = 2.0;
    controls.maxDistance = 11;
    controls.maxPolarAngle = Math.PI * 0.53;

    // STUDIO LIGHTING SETUP
    const ambientLight = new THREE.AmbientLight('#273549', 0.52);
    scene.add(ambientLight);

    const keyLight = new THREE.SpotLight('#fffbeb', 44);
    keyLight.position.set(3.2, 7.5, 4.2);
    keyLight.angle = Math.PI / 3.0;
    keyLight.penumbra = 0.78;
    keyLight.decay = 1.35;
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#a7f3d0', 2.6);
    rimLight.position.set(-3.5, 4.2, -3.8);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight('#93c5fd', 0.95);
    fillLight.position.set(-2.8, 1.9, 4.0);
    scene.add(fillLight);

    // 3D PLANTER POT & ORGANIC SOIL MOUND WITH PERLITE SPECKS
    const potGroup = new THREE.Group();
    scene.add(potGroup);

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

    const rimGeo = new THREE.TorusGeometry(1.75, 0.055, 20, 64);
    rimGeo.rotateX(Math.PI / 2);
    const rimMat = new THREE.MeshStandardMaterial({
      color: '#232429',
      roughness: 0.25,
      metalness: 0.3,
    });
    const potRim = new THREE.Mesh(rimGeo, rimMat);
    potRim.position.y = -0.02;
    potRim.receiveShadow = true;
    potGroup.add(potRim);

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

    // Floating Pollen Particles
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

    const plantGroup = new THREE.Group();
    plantGroup.position.y = 0.12;
    scene.add(plantGroup);

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
      pollenPoints,
    };

    let reqId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (plantGroup) {
        plantGroup.rotation.z = Math.sin(t * 1.15) * 0.011;
        plantGroup.rotation.x = Math.cos(t * 0.85) * 0.008;
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

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.controls.autoRotate = autoRotate;
      sceneRef.current.controls.autoRotateSpeed = 1.4;
    }
  }, [autoRotate]);

  // 2. SPECIES-SPECIFIC 3D PROCEDURAL MORPHOGENESIS
  useEffect(() => {
    const ctx = sceneRef.current;
    if (!ctx) return;

    const {
      plantGroup,
      soilMaterial,
      keyLight,
      rimLight,
      pollenPoints,
      camera,
      controls,
    } = ctx;

    while (plantGroup.children.length > 0) {
      plantGroup.remove(plantGroup.children[0]);
    }

    // Update Soil Moisture & Studio Lighting
    const moistureNorm = environment.soilMoisture / 100;
    soilMaterial.color
      .copy(new THREE.Color('#3d2817'))
      .lerp(new THREE.Color('#110a06'), moistureNorm);
    soilMaterial.roughness = 0.95 - moistureNorm * 0.45;

    const sunNorm = environment.sunlight / 100;
    keyLight.intensity = 16 + sunNorm * 38;
    rimLight.intensity = 1.2 + sunNorm * 2.2;

    const pollenMat = pollenPoints.material as THREE.PointsMaterial;
    pollenMat.opacity =
      isPollinated || currentStage === 'Flowering' || currentStage === 'Full Bloom'
        ? 0.75
        : 0;

    // Stress & Species Materials
    const morph = species.morphology;
    const leafShape = SPECIES_LEAF_SHAPE[species.id] || 'apple_ovate';
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

    const bumpTex = createSpeciesLeafBumpTexture(leafShape);
    const matureColorTex = createSpeciesLeafColorTexture(
      species.id,
      morph.leafColorHealthy,
      morph.leafColorSecondary,
      yellowing,
      necrosis,
      false
    );
    const flushColorTex = createSpeciesLeafColorTexture(
      species.id,
      morph.leafColorHealthy,
      morph.leafColorSecondary,
      yellowing,
      necrosis,
      true
    );

    const isGlossySpecies = species.id === 'orange' || species.id === 'orchid' || species.id === 'mango';

    const matureLeafMat = new THREE.MeshPhysicalMaterial({
      map: matureColorTex,
      bumpMap: bumpTex,
      bumpScale: species.id === 'sunflower' ? 0.048 : 0.032,
      roughness: isGlossySpecies ? 0.24 : 0.42,
      metalness: 0.02,
      clearcoat: isGlossySpecies ? 0.55 : 0.18,
      clearcoatRoughness: 0.25,
      transmission: 0.16,
      thickness: 0.1,
      side: THREE.DoubleSide,
    });

    const youngFlushLeafMat = new THREE.MeshPhysicalMaterial({
      map: flushColorTex,
      bumpMap: bumpTex,
      bumpScale: 0.028,
      roughness: 0.25,
      clearcoat: 0.45,
      transmission: 0.22,
      side: THREE.DoubleSide,
    });

    const barkMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(morph.trunkColor),
      roughness: 0.82,
      bumpMap: bumpTex,
      bumpScale: 0.025,
    });

    const greenStemMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(morph.trunkHighlight).lerp(new THREE.Color('#4d7c2b'), 0.55),
      roughness: 0.6,
    });

    // Helper: Build single petiole + species-shaped leaf blade
    const buildSimpleLeaf = (
      len: number,
      width: number,
      arch: number,
      isYoungFlush = false
    ): THREE.Group => {
      const g = new THREE.Group();
      const petioleLen = species.id === 'orchid' ? 0.02 : len * 0.22;
      if (petioleLen > 0.03) {
        const pGeo = new THREE.CylinderGeometry(0.012 * len, 0.02 * len, petioleLen, 8);
        pGeo.translate(0, petioleLen * 0.5, 0);
        const pMesh = new THREE.Mesh(pGeo, greenStemMat);
        pMesh.castShadow = true;
        g.add(pMesh);
      }

      const bladeGeo = createSpeciesLeafGeometry(leafShape, len, width, arch, wiltDroop);
      const bladeMesh = new THREE.Mesh(
        bladeGeo,
        isYoungFlush ? youngFlushLeafMat : matureLeafMat
      );
      bladeMesh.position.y = petioleLen * 0.92;
      bladeMesh.castShadow = true;
      bladeMesh.receiveShadow = true;
      g.add(bladeMesh);
      return g;
    };

    // Helper: Build Rose 5-Leaflet Compound Pinnate Leaf (Đặc trưng lá Hoa Hồng!)
    const buildRoseCompoundLeaf = (scale: number, isYoungFlush = false): THREE.Group => {
      const compound = new THREE.Group();
      const rachisLen = 0.65 * scale;
      const rachisGeo = new THREE.CylinderGeometry(0.01 * scale, 0.016 * scale, rachisLen, 8);
      rachisGeo.translate(0, rachisLen * 0.5, 0);
      compound.add(new THREE.Mesh(rachisGeo, greenStemMat));

      const mat = isYoungFlush ? youngFlushLeafMat : matureLeafMat;

      // Terminal leaflet at apex of rachis
      const termGeo = createSpeciesLeafGeometry(
        'rose_leaflet',
        0.48 * scale,
        0.28 * scale,
        0.3 + wiltDroop,
        wiltDroop
      );
      const termMesh = new THREE.Mesh(termGeo, mat);
      termMesh.position.y = rachisLen;
      termMesh.castShadow = true;
      compound.add(termMesh);

      // 2 Opposite pairs of lateral serrated leaflets along the rachis
      for (const pairIdx of [0.42, 0.76]) {
        const lSize = (pairIdx > 0.6 ? 0.36 : 0.28) * scale;
        const lGeo = createSpeciesLeafGeometry(
          'rose_leaflet',
          lSize,
          lSize * 0.62,
          0.25 + wiltDroop,
          wiltDroop
        );
        for (const side of [-1, 1]) {
          const lat = new THREE.Mesh(lGeo, mat);
          lat.position.y = rachisLen * pairIdx;
          lat.rotation.z = side * 1.15;
          lat.rotation.y = side * 0.2;
          lat.castShadow = true;
          compound.add(lat);
        }
      }
      return compound;
    };

    // Helper: Build Recurved Rose/Citrus Thorn
    const buildThorn = (scale = 1, color = '#7f1d1d'): THREE.Mesh => {
      const thornGeo = new THREE.ConeGeometry(0.018 * scale, 0.075 * scale, 8);
      thornGeo.rotateZ(-Math.PI * 0.38);
      const thorn = new THREE.Mesh(
        thornGeo,
        new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
      );
      return thorn;
    };

    // Helper: Build 3D Fruit (Indented Apple, Kidney Mango, Dimpled Orange)
    const build3DFruit = (maturity: number, idSeed: number): THREE.Group => {
      const fg = new THREE.Group();
      const ripeness = Math.max(0, Math.min(1, (growthProgress - 76) / 18));
      const fColor = new THREE.Color(morph.fruitColorUnripe).lerp(
        new THREE.Color(morph.fruitColorRipe),
        ripeness
      );
      const r = (0.09 + maturity * 0.14) * (0.8 + (health / 100) * 0.22);

      // Woody pedicel stalk
      const stalkLen = species.id === 'mango' ? 0.22 : 0.08;
      const stalkGeo = new THREE.CylinderGeometry(0.008, 0.006, stalkLen, 6);
      stalkGeo.translate(0, -stalkLen * 0.5, 0);
      fg.add(new THREE.Mesh(stalkGeo, barkMat));

      const fMat = new THREE.MeshPhysicalMaterial({
        color: fColor,
        roughness: species.id === 'orange' ? 0.38 : 0.2,
        clearcoat: 0.68,
        clearcoatRoughness: 0.16,
        bumpMap: species.id === 'orange' ? bumpTex : null,
        bumpScale: species.id === 'orange' ? 0.012 : 0,
      });

      if (species.id === 'mango') {
        // S-curved asymmetric Mango drupe
        const mGeo = new THREE.SphereGeometry(r, 24, 24);
        const pos = mGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          const x = pos.getX(i);
          const normY = y / r; // -1..1
          const beakCurve = normY < 0 ? Math.pow(-normY, 1.6) * r * 0.28 : 0;
          pos.setX(i, x * 0.78 + beakCurve);
          pos.setY(i, y * 1.35);
          pos.setZ(i, pos.getZ(i) * 0.68);
        }
        mGeo.computeVertexNormals();
        const mMesh = new THREE.Mesh(mGeo, fMat);
        mMesh.position.y = -stalkLen - r * 1.1;
        mMesh.castShadow = true;
        fg.add(mMesh);
      } else if (species.id === 'apple') {
        // Indented Apple pome with top & bottom dimple + dark calyx
        const aGeo = new THREE.SphereGeometry(r, 24, 24);
        const pos = aGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const vx = pos.getX(i);
          const vy = pos.getY(i);
          const vz = pos.getZ(i);
          const distXZ = Math.sqrt(vx * vx + vz * vz) / r;
          const dimple = Math.exp(-distXZ * 6) * r * 0.28;
          const newY = vy > 0 ? vy - dimple : vy + dimple * 0.7 + (vy / r) * distXZ * 0.08 * r;
          pos.setY(i, newY * 0.92);
        }
        aGeo.computeVertexNormals();
        const aMesh = new THREE.Mesh(aGeo, fMat);
        aMesh.position.y = -stalkLen - r * 0.75;
        aMesh.castShadow = true;
        fg.add(aMesh);
      } else {
        // Dimpled Orange hesperidium with green calyx star at top
        const oMesh = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), fMat);
        oMesh.position.y = -stalkLen - r * 0.88;
        oMesh.castShadow = true;
        fg.add(oMesh);

        const calyx = new THREE.Mesh(
          new THREE.CylinderGeometry(r * 0.28, r * 0.1, 0.015, 5),
          greenStemMat
        );
        calyx.position.y = -stalkLen - 0.01;
        fg.add(calyx);
      }

      fg.rotation.z = (seededRandom(idSeed) - 0.5) * 0.15;
      return fg;
    };

    // =========================================================================
    // STAGE 0: SEED GERMINATION (0% to 7%)
    // =========================================================================
    if (growthProgress < 7) {
      const f = growthProgress / 7;
      const seedGeo = new THREE.SphereGeometry(
        species.id === 'mango' ? 0.22 : 0.11,
        16,
        16
      );
      const seedMesh = new THREE.Mesh(
        seedGeo,
        new THREE.MeshStandardMaterial({
          color: species.id === 'mango' ? '#6b4c35' : '#4a2c11',
          roughness: 0.85,
        })
      );
      seedMesh.scale.set(species.id === 'mango' ? 1.6 : 1.2, 0.75, 0.9);
      seedMesh.position.y = 0.03;
      plantGroup.add(seedMesh);

      if (f > 0.2) {
        const plumule = createCurvedStemMesh(
          [
            new THREE.Vector3(0, 0.02, 0),
            new THREE.Vector3(0.02, 0.15 * f, 0),
            new THREE.Vector3(0, 0.32 * f, 0),
          ],
          0.025,
          0.014,
          greenStemMat
        );
        plantGroup.add(plumule);
      }
      return;
    }

    // =========================================================================
    // SPECIES 1: APPLE TREE (Malus domestica)
    // =========================================================================
    if (species.id === 'apple') {
      if (growthProgress <= 38) {
        // Apple Seedling/Sapling: Woody reddish-brown leader shoot + cotyledons + alternating serrated ovate leaves
        const norm = (growthProgress - 7) / 31;
        const h = 0.45 + norm * 1.15;
        const leader = createCurvedStemMesh(
          [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.03, h * 0.35, 0.02),
            new THREE.Vector3(-0.03, h * 0.7, -0.02),
            new THREE.Vector3(0.01, h, 0),
          ],
          0.035 + norm * 0.03,
          0.016 + norm * 0.012,
          barkMat
        );
        plantGroup.add(leader);

        // Basal rounded cotyledons (for young sprout < 24%)
        if (growthProgress < 25) {
          for (const side of [-1, 1]) {
            const cot = buildSimpleLeaf(0.28, 0.2, 0.5, false);
            cot.position.y = 0.18;
            cot.rotation.y = side * 1.5;
            cot.rotation.x = 0.75;
            plantGroup.add(cot);
          }
        }

        // Alternating serrated ovate Apple leaves spiraling up the leader stem
        const numLeaves = Math.floor(3 + norm * 9);
        for (let i = 0; i < numLeaves; i++) {
          const t = (i + 1) / (numLeaves + 0.5);
          const isTop = i >= numLeaves - 2;
          const leafSize = (0.48 + (1 - Math.abs(t - 0.65)) * 0.38) * (0.7 + norm * 0.35);
          const leaf = buildSimpleLeaf(leafSize, leafSize * 0.62, 0.38, isTop);
          leaf.position.set(0, h * t, 0);
          leaf.rotation.y = i * 2.35;
          leaf.rotation.x = isTop ? 0.28 : 0.55 + wiltDroop * 0.45;
          plantGroup.add(leaf);
        }
      } else {
        // Mature Orchard Apple Tree with Gnarled Curved Scaffold Limbs, Pink-White Blossoms & Red Apples
        const mat = Math.min(1, (growthProgress - 38) / 40);
        const trunkH = 0.95 + mat * 0.45;
        const trunk = createCurvedStemMesh(
          [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.06, trunkH * 0.45, -0.03),
            new THREE.Vector3(-0.04, trunkH, 0.02),
          ],
          0.11 + mat * 0.05,
          0.075 + mat * 0.03,
          barkMat
        );
        plantGroup.add(trunk);

        const numLimbs = 4;
        for (let b = 0; b < numLimbs; b++) {
          const angle = (b * Math.PI * 2) / numLimbs + 0.3;
          const spread = 0.65 + pruningLevel * 0.2;
          const limbLen = 0.85 + mat * 0.45;
          const midX = Math.cos(angle) * limbLen * 0.55;
          const midZ = Math.sin(angle) * limbLen * 0.55;
          const tipX = Math.cos(angle) * limbLen * spread;
          const tipZ = Math.sin(angle) * limbLen * spread;
          const tipY = trunkH + limbLen * 0.68;

          const limb = createCurvedStemMesh(
            [
              new THREE.Vector3(-0.04, trunkH * 0.95, 0.02),
              new THREE.Vector3(midX, trunkH + limbLen * 0.28, midZ),
              new THREE.Vector3(tipX, tipY, tipZ),
            ],
            0.058,
            0.022,
            barkMat
          );
          plantGroup.add(limb);

          // Secondary twigs & spurs along each scaffold limb
          for (let s = 0; s < 3; s++) {
            const spurAngle = angle + (s - 1) * 0.55;
            const spurPos = new THREE.Vector3(
              tipX * (0.55 + s * 0.22) + Math.cos(spurAngle) * 0.22,
              trunkH + limbLen * (0.35 + s * 0.18),
              tipZ * (0.55 + s * 0.22) + Math.sin(spurAngle) * 0.22
            );

            const spurGroup = new THREE.Group();
            spurGroup.position.copy(spurPos);
            plantGroup.add(spurGroup);

            for (let l = 0; l < 4; l++) {
              const lf = buildSimpleLeaf(0.52, 0.34, 0.42, false);
              lf.rotation.y = (l * Math.PI) / 2 + b + s;
              lf.rotation.x = 0.62 + wiltDroop * 0.4;
              spurGroup.add(lf);
            }

            // Blossoms (60% - 78%)
            if (growthProgress >= 60 && growthProgress <= 80) {
              const blMat = new THREE.MeshPhysicalMaterial({
                color: '#fce4ec',
                roughness: 0.3,
                side: THREE.DoubleSide,
              });
              const blGroup = new THREE.Group();
              blGroup.position.y = 0.1;
              for (let p = 0; p < 5; p++) {
                const pGeo = createSpeciesLeafGeometry('apple_ovate', 0.18, 0.13, 0.3, 0);
                const pm = new THREE.Mesh(pGeo, blMat);
                pm.rotation.y = (p * Math.PI * 2) / 5;
                pm.rotation.x = 0.75;
                blGroup.add(pm);
              }
              spurGroup.add(blGroup);
            }

            // Ripening Red Apples (74% - 100%)
            if (growthProgress >= 74 && (b + s) % 2 === 0) {
              const fruit = build3DFruit(Math.min(1, (growthProgress - 74) / 22), b * 10 + s);
              spurGroup.add(fruit);
            }
          }
        }
      }
    }

    // =========================================================================
    // SPECIES 2: MANGO TREE (Mangifera indica)
    // =========================================================================
    else if (species.id === 'mango') {
      // Exposed fibrous Mango Stone/Husk on Soil Surface (for young trees < 45%)
      if (growthProgress < 45) {
        const stoneGeo = new THREE.SphereGeometry(0.22, 16, 16);
        const stone = new THREE.Mesh(
          stoneGeo,
          new THREE.MeshStandardMaterial({ color: '#5c4028', roughness: 0.9 })
        );
        stone.scale.set(1.65, 0.65, 0.95);
        stone.position.set(-0.08, 0.04, 0.05);
        stone.rotation.z = 0.25;
        plantGroup.add(stone);
      }

      if (growthProgress <= 40) {
        // Mango Seedling/Sapling: Tall green-brown stem with tiered drooping umbrella whorls
        // and signature coppery-bronze young top flush leaves!
        const norm = (growthProgress - 7) / 33;
        const h = 0.55 + norm * 1.25;
        const stem = createCurvedStemMesh(
          [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(-0.02, h * 0.5, 0.02),
            new THREE.Vector3(0, h, 0),
          ],
          0.038 + norm * 0.025,
          0.02 + norm * 0.01,
          greenStemMat
        );
        plantGroup.add(stem);

        // Tiered umbrella whorls of long, narrow, wavy-margined lanceolate Mango leaves
        const whorls = growthProgress < 20 ? 1 : growthProgress < 30 ? 2 : 3;
        for (let w = 0; w < whorls; w++) {
          const isTopFlush = w === whorls - 1;
          const wy = h * (0.45 + (w / Math.max(1, whorls - 1)) * 0.52);
          const leavesInWhorl = isTopFlush ? 5 : 7;

          for (let l = 0; l < leavesInWhorl; l++) {
            const lLen = (isTopFlush ? 0.72 : 0.98) * (0.65 + norm * 0.4);
            // Mango leaves hang steeply downward (pendulous)!
            const leaf = buildSimpleLeaf(lLen, lLen * 0.21, 0.72, isTopFlush);
            leaf.position.y = wy;
            leaf.rotation.y = (l * Math.PI * 2) / leavesInWhorl + w * 0.5;
            leaf.rotation.x = isTopFlush ? 0.85 : 1.05 + wiltDroop * 0.35;
            plantGroup.add(leaf);
          }
        }
      } else {
        // Mature Tropical Mango Canopy + Upright Conical Flower Panicles + Hanging Golden Mangoes
        const mat = Math.min(1, (growthProgress - 40) / 40);
        const trunkH = 1.05 + mat * 0.45;
        const trunk = createCurvedStemMesh(
          [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.03, trunkH * 0.5, 0),
            new THREE.Vector3(0, trunkH, 0),
          ],
          0.12 + mat * 0.05,
          0.08 + mat * 0.03,
          barkMat
        );
        plantGroup.add(trunk);

        const numBranches = 5;
        for (let b = 0; b < numBranches; b++) {
          const ang = (b * Math.PI * 2) / numBranches;
          const bLen = 0.9 + mat * 0.45;
          const tip = new THREE.Vector3(
            Math.cos(ang) * bLen * 0.75,
            trunkH + bLen * 0.65,
            Math.sin(ang) * bLen * 0.75
          );
          const br = createCurvedStemMesh(
            [
              new THREE.Vector3(0, trunkH * 0.95, 0),
              new THREE.Vector3(tip.x * 0.5, trunkH + bLen * 0.35, tip.z * 0.5),
              tip,
            ],
            0.055,
            0.022,
            barkMat
          );
          plantGroup.add(br);

          const whorlNode = new THREE.Group();
          whorlNode.position.copy(tip);
          plantGroup.add(whorlNode);

          // Drooping umbrella whorl of 7 long lanceolate mango leaves at branch apex
          for (let l = 0; l < 7; l++) {
            const lf = buildSimpleLeaf(0.82, 0.18, 0.78, l === 0);
            lf.rotation.y = (l * Math.PI * 2) / 7 + b;
            lf.rotation.x = 0.95 + wiltDroop * 0.35;
            whorlNode.add(lf);
          }

          // Conical Mango Inflorescence Panicle during Flowering (60% - 78%)
          if (growthProgress >= 60 && growthProgress <= 80) {
            const panicleGeo = new THREE.ConeGeometry(0.14, 0.42, 12);
            panicleGeo.translate(0, 0.21, 0);
            const panicleMat = new THREE.MeshStandardMaterial({
              color: '#fde68a',
              roughness: 0.7,
            });
            const panicle = new THREE.Mesh(panicleGeo, panicleMat);
            whorlNode.add(panicle);
          }

          // Pendulous Golden-Crimson Mangoes (74% - 100%)
          if (growthProgress >= 74) {
            const mangoFruit = build3DFruit(
              Math.min(1, (growthProgress - 74) / 22),
              b * 17
            );
            whorlNode.add(mangoFruit);
          }
        }
      }
    }

    // =========================================================================
    // SPECIES 3: ORANGE TREE (Citrus × sinensis)
    // =========================================================================
    else if (species.id === 'orange') {
      if (growthProgress <= 40) {
        // Citrus Seedling/Sapling: Glossy emerald stem + winged-petiole leaves + axillary green spines!
        const norm = (growthProgress - 7) / 33;
        const h = 0.48 + norm * 1.1;
        const stem = createCurvedStemMesh(
          [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0.02, h * 0.45, -0.02),
            new THREE.Vector3(-0.02, h * 0.8, 0.02),
            new THREE.Vector3(0, h, 0),
          ],
          0.036 + norm * 0.025,
          0.018 + norm * 0.01,
          greenStemMat
        );
        plantGroup.add(stem);

        const numNodes = Math.floor(4 + norm * 10);
        for (let i = 0; i < numNodes; i++) {
          const t = (i + 1) / (numNodes + 0.5);
          const lSize = (0.48 + (1 - Math.abs(t - 0.6)) * 0.32) * (0.75 + norm * 0.3);
          const leaf = buildSimpleLeaf(lSize, lSize * 0.54, 0.32, i >= numNodes - 2);
          leaf.position.y = h * t;
          leaf.rotation.y = i * 2.4;
          leaf.rotation.x = 0.48 + wiltDroop * 0.45;
          plantGroup.add(leaf);

          // Citrus axillary spine at leaf base
          const spine = buildThorn(0.65, '#3f6212');
          spine.position.y = h * t;
          spine.rotation.y = i * 2.4 + 0.3;
          plantGroup.add(spine);
        }
      } else {
        // Mature Rounded Subtropical Citrus Canopy + Star White Blossoms + Bright Oranges
        const mat = Math.min(1, (growthProgress - 40) / 40);
        const trunkH = 0.85 + mat * 0.35;
        const trunk = createCurvedStemMesh(
          [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, trunkH, 0)],
          0.1 + mat * 0.04,
          0.07 + mat * 0.025,
          barkMat
        );
        plantGroup.add(trunk);

        const branches = 6;
        for (let b = 0; b < branches; b++) {
          const ang = (b * Math.PI * 2) / branches;
          const bLen = 0.78 + mat * 0.38;
          const tip = new THREE.Vector3(
            Math.cos(ang) * bLen * 0.78,
            trunkH + bLen * 0.62,
            Math.sin(ang) * bLen * 0.78
          );
          plantGroup.add(
            createCurvedStemMesh(
              [
                new THREE.Vector3(0, trunkH * 0.9, 0),
                new THREE.Vector3(tip.x * 0.55, trunkH + bLen * 0.35, tip.z * 0.55),
                tip,
              ],
              0.048,
              0.02,
              barkMat
            )
          );

          const node = new THREE.Group();
          node.position.copy(tip);
          plantGroup.add(node);

          for (let l = 0; l < 5; l++) {
            const lf = buildSimpleLeaf(0.55, 0.32, 0.35, false);
            lf.rotation.y = (l * Math.PI * 2) / 5 + b;
            lf.rotation.x = 0.55 + wiltDroop * 0.4;
            node.add(lf);
          }

          if (growthProgress >= 60 && growthProgress <= 80) {
            const starMat = new THREE.MeshStandardMaterial({
              color: '#ffffff',
              roughness: 0.25,
              side: THREE.DoubleSide,
            });
            for (let p = 0; p < 5; p++) {
              const pGeo = createSpeciesLeafGeometry('mango_lanceolate', 0.18, 0.06, 0.35, 0);
              const pm = new THREE.Mesh(pGeo, starMat);
              pm.rotation.y = (p * Math.PI * 2) / 5;
              pm.rotation.x = 0.8;
              node.add(pm);
            }
          }

          if (growthProgress >= 74) {
            node.add(build3DFruit(Math.min(1, (growthProgress - 74) / 22), b * 23));
          }
        }
      }
    }

    // =========================================================================
    // SPECIES 4: CRIMSON ROSE (Rosa hybrida)
    // =========================================================================
    else if (species.id === 'rose') {
      const mat = Math.min(1, (growthProgress - 7) / 55);
      const numCanes = growthProgress < 24 ? 1 : growthProgress < 45 ? 3 : 5;
      const isWilting = growthProgress >= 92;
      const senescence = isWilting ? ((growthProgress - 92) / 8) * 0.55 : 0;

      for (let c = 0; c < numCanes; c++) {
        const caneAng = (c * Math.PI * 2) / numCanes + 0.4;
        const spread = c === 0 ? 0.08 : 0.35 + (c % 2) * 0.15;
        const caneH = (0.55 + mat * 1.25) * (c === 0 ? 1.0 : 0.85);

        const tipX = Math.cos(caneAng) * caneH * spread;
        const tipZ = Math.sin(caneAng) * caneH * spread;

        const caneMesh = createCurvedStemMesh(
          [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(tipX * 0.45, caneH * 0.5, tipZ * 0.45),
            new THREE.Vector3(tipX, caneH, tipZ),
          ],
          0.032 + mat * 0.015,
          0.018 + mat * 0.008,
          greenStemMat
        );
        plantGroup.add(caneMesh);

        // Recurved Crimson Thorns & 5-Leaflet Compound Pinnate Rose Leaves along each cane!
        const leafNodes = growthProgress < 25 ? 3 : 4;
        for (let n = 1; n <= leafNodes; n++) {
          const nt = n / (leafNodes + 0.4);
          const nx = tipX * nt;
          const ny = caneH * nt;
          const nz = tipZ * nt;

          // Pair of thorns
          const thorn = buildThorn(1.1, '#881337');
          thorn.position.set(nx, ny - 0.04, nz);
          thorn.rotation.y = n * 2.2 + c;
          plantGroup.add(thorn);

          // 5-Leaflet Compound Rose Leaf
          const isTopFlush = n === leafNodes && growthProgress < 50;
          const compoundLeaf = buildRoseCompoundLeaf(
            (0.65 + mat * 0.45) * (1 - nt * 0.18),
            isTopFlush
          );
          compoundLeaf.position.set(nx, ny, nz);
          compoundLeaf.rotation.y = n * 2.3 + c * 1.5;
          compoundLeaf.rotation.x = 0.58 + wiltDroop * 0.45;
          plantGroup.add(compoundLeaf);
        }

        // Sculpted Spiral 3D Velvet Crimson Rose Bud / Bloom at Cane Apex (52% - 100%)
        if (growthProgress >= 52 && c < 3) {
          const bloomOpen = Math.min(1, (growthProgress - 52) / 24);
          const roseHead = new THREE.Group();
          roseHead.position.set(tipX, caneH, tipZ);
          roseHead.rotation.x = wiltDroop * 0.45 + senescence;
          plantGroup.add(roseHead);

          // Green Receptacle Hip & 5 Pointed Sepals
          const hip = new THREE.Mesh(
            new THREE.SphereGeometry(0.065, 12, 12),
            greenStemMat
          );
          roseHead.add(hip);

          const roseMat = new THREE.MeshPhysicalMaterial({
            color: isWilting ? '#6b0f24' : '#dc143c',
            roughness: 0.36,
            sheen: 0.8,
            clearcoat: 0.15,
            side: THREE.DoubleSide,
          });

          const totalPetals = growthProgress < 68 ? 12 : 26;
          const goldenAngle = 137.508 * (Math.PI / 180);

          for (let p = 0; p < totalPetals; p++) {
            const pNorm = p / totalPetals; // 0 = tight center cone, 1 = outer reflexed petals
            const pLen = 0.16 + pNorm * 0.18;
            const pWidth = 0.13 + pNorm * 0.16;
            const pGeo = createSpeciesLeafGeometry(
              'apple_ovate',
              pLen,
              pWidth,
              0.45 * (1 - pNorm * 0.5),
              0
            );
            const pPivot = new THREE.Group();
            pPivot.rotation.y = p * goldenAngle;
            const petal = new THREE.Mesh(pGeo, roseMat);
            const openAngle = 0.08 + Math.pow(pNorm, 1.3) * (0.35 + bloomOpen * 0.85);
            petal.rotation.x = openAngle;
            petal.position.z = 0.02 + pNorm * 0.05;
            petal.castShadow = true;
            pPivot.add(petal);
            roseHead.add(pPivot);
          }
        }
      }
    }

    // =========================================================================
    // SPECIES 5: GIANT SUNFLOWER (Helianthus annuus)
    // =========================================================================
    else if (species.id === 'sunflower') {
      const mat = Math.min(1, (growthProgress - 7) / 50);
      const stalkH = 0.45 + mat * 1.85;
      const isWilting = growthProgress >= 92;
      const senescence = isWilting ? ((growthProgress - 92) / 8) * 0.65 : 0;

      // Thick ridged fibrous Sunflower stalk
      const stalk = createCurvedStemMesh(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.02, stalkH * 0.5, 0.02),
          new THREE.Vector3(0, stalkH, 0.05 * senescence),
        ],
        0.055 + mat * 0.045,
        0.035 + mat * 0.028,
        greenStemMat,
        16
      );
      plantGroup.add(stalk);

      // Basal fleshy cotyledons for young seedling (< 26%)
      if (growthProgress < 26) {
        for (const side of [-1, 1]) {
          const cot = buildSimpleLeaf(0.32, 0.22, 0.4, false);
          cot.position.y = 0.16;
          cot.rotation.y = side * 1.57;
          cot.rotation.x = 0.7;
          plantGroup.add(cot);
        }
      }

      // Opposite/Decussate & Spiral Giant Heart-Shaped (Cordate) Leaves!
      const numLeaves = Math.floor(4 + mat * 8);
      for (let i = 0; i < numLeaves; i++) {
        const t = (i + 1) / (numLeaves + 0.8);
        const lSize = (0.58 + (1 - Math.abs(t - 0.55)) * 0.45) * (0.65 + mat * 0.4);
        const leaf = buildSimpleLeaf(lSize, lSize * 0.82, 0.45, false);
        leaf.position.y = stalkH * t;
        // Opposite pairs at bottom, spiral higher up
        leaf.rotation.y = i < 4 ? (i % 2) * Math.PI + Math.floor(i / 2) * 1.57 : i * 2.4;
        leaf.rotation.x = 0.58 + wiltDroop * 0.5;
        plantGroup.add(leaf);
      }

      // Giant Heliotropic Capitulum Head (50% - 100%)
      if (growthProgress >= 50) {
        const bloomOpen = Math.min(1, (growthProgress - 50) / 22);
        const headGroup = new THREE.Group();
        headGroup.position.set(0, stalkH, 0.05 * senescence);
        headGroup.rotation.x = 0.38 + wiltDroop * 0.45 + senescence;
        plantGroup.add(headGroup);

        const discRad = 0.18 + bloomOpen * 0.28;

        // Green Involucral Bracts on the back of the head
        for (let b = 0; b < 20; b++) {
          const bGeo = createSpeciesLeafGeometry('apple_ovate', discRad * 0.9, 0.1, 0.3, 0);
          const bract = new THREE.Mesh(bGeo, matureLeafMat);
          bract.rotation.z = (b * Math.PI * 2) / 20;
          bract.position.z = -0.04;
          headGroup.add(bract);
        }

        // Dark Brown Fibonacci Seed Disc Dome
        const discGeo = new THREE.SphereGeometry(discRad, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
        discGeo.rotateX(Math.PI * 0.5);
        discGeo.scale(1, 1, 0.35);
        const discMesh = new THREE.Mesh(
          discGeo,
          new THREE.MeshStandardMaterial({ color: '#2b1404', roughness: 0.92 })
        );
        headGroup.add(discMesh);

        // 32 Sculpted Golden Ray Florets (double ring)
        if (growthProgress >= 54) {
          const rayScale = Math.min(1, (growthProgress - 54) / 18);
          const rayMat = new THREE.MeshPhysicalMaterial({
            color: isWilting ? '#b45309' : '#facc15',
            roughness: 0.32,
            clearcoat: 0.2,
            side: THREE.DoubleSide,
          });
          const rayGeo = createSpeciesLeafGeometry(
            'mango_lanceolate',
            0.46 * rayScale,
            0.13 * rayScale,
            0.22,
            0
          );

          for (let r = 0; r < 32; r++) {
            const pivot = new THREE.Group();
            pivot.rotation.z = (r * Math.PI * 2) / 32;
            const ray = new THREE.Mesh(rayGeo, rayMat);
            ray.position.y = discRad * 0.85;
            ray.position.z = (r % 2) * 0.015;
            ray.rotation.x = -0.15;
            ray.castShadow = true;
            pivot.add(ray);
            headGroup.add(pivot);
          }
        }
      }
    }

    // =========================================================================
    // SPECIES 6: MOTH ORCHID (Phalaenopsis aphrodite)
    // =========================================================================
    else {
      const mat = Math.min(1, (growthProgress - 7) / 50);
      const isWilting = growthProgress >= 92;
      const senescence = isWilting ? ((growthProgress - 92) / 8) * 0.5 : 0;

      // 1. Silvery-Green Velamen Aerial Roots with Glowing Green Growing Tips!
      const numRoots = growthProgress < 22 ? 3 : 6;
      const velamenMat = new THREE.MeshStandardMaterial({
        color: '#a7f3d0',
        roughness: 0.55,
      });
      for (let r = 0; r < numRoots; r++) {
        const rAng = (r * Math.PI * 2) / numRoots + 0.4;
        const rLen = 0.55 + (r % 3) * 0.28 + mat * 0.45;
        const rootCurve = [
          new THREE.Vector3(0, 0.06, 0),
          new THREE.Vector3(Math.cos(rAng) * rLen * 0.55, 0.14, Math.sin(rAng) * rLen * 0.55),
          new THREE.Vector3(Math.cos(rAng) * rLen, -0.05, Math.sin(rAng) * rLen),
        ];
        plantGroup.add(createCurvedStemMesh(rootCurve, 0.032, 0.024, velamenMat, 10));
      }

      // 2. Distichous Two-Ranked Basal Fan of Thick Fleshy Strap Leaves (`orchid_strap`)!
      const totalLeaves = growthProgress < 20 ? 3 : growthProgress < 38 ? 4 : 6;
      for (let i = 0; i < totalLeaves; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const rank = Math.floor(i / 2);
        const lLen = (0.72 + mat * 0.42) * (1 - rank * 0.12);
        const strap = buildSimpleLeaf(lLen, lLen * 0.38, 0.48, false);
        strap.position.y = 0.06 + rank * 0.065;
        // Strict left-right distichous arrangement (180 degrees apart)
        strap.rotation.y = side * (Math.PI * 0.5) + (rank - 1) * 0.12;
        strap.rotation.x = 0.68 - rank * 0.08 + wiltDroop * 0.4;
        plantGroup.add(strap);
      }

      // 3. Arching Inflorescence Flower Spike + Bilateral Phalaenopsis Moth Orchid Blooms (30% - 100%)
      if (growthProgress >= 28) {
        const spikeNorm = Math.min(1, (growthProgress - 28) / 30);
        const spikeH = 0.55 + spikeNorm * 1.45;
        const spikePts = [
          new THREE.Vector3(0, 0.1, 0),
          new THREE.Vector3(-0.12, spikeH * 0.6, 0),
          new THREE.Vector3(0.22 * spikeNorm, spikeH, 0.1),
          new THREE.Vector3(0.75 * spikeNorm, spikeH * 0.85 - wiltDroop * 0.25, 0.25),
        ];
        const spikeCurve = new THREE.CatmullRomCurve3(spikePts);
        plantGroup.add(createCurvedStemMesh(spikePts, 0.026, 0.016, barkMat, 10));

        if (growthProgress >= 52) {
          const numBlooms = growthProgress < 68 ? 3 : 5;
          const orchidPetalMat = new THREE.MeshPhysicalMaterial({
            color: isWilting ? '#701a75' : '#e879f9',
            roughness: 0.28,
            clearcoat: 0.3,
            transmission: 0.2,
            side: THREE.DoubleSide,
          });
          const sepalMat = new THREE.MeshPhysicalMaterial({
            color: '#fae8ff',
            roughness: 0.3,
            side: THREE.DoubleSide,
          });
          const lipMat = new THREE.MeshStandardMaterial({
            color: '#be123c',
            roughness: 0.4,
          });

          for (let b = 0; b < numBlooms; b++) {
            const pt = spikeCurve.getPoint(0.48 + b * 0.12);
            const oFlower = new THREE.Group();
            oFlower.position.copy(pt);
            oFlower.rotation.y = (b % 2 === 0 ? 0.35 : -0.35) + 0.2;
            oFlower.rotation.x = 0.2 + senescence;
            plantGroup.add(oFlower);

            const s = 0.95 - b * 0.08;
            // Dorsal sepal (top) & 2 Lateral sepals (bottom left/right)
            for (const sAng of [0, 2.2, -2.2]) {
              const sepGeo = createSpeciesLeafGeometry('apple_ovate', 0.22 * s, 0.13 * s, 0.15, 0);
              const sep = new THREE.Mesh(sepGeo, sepalMat);
              sep.rotation.z = sAng;
              sep.rotation.x = 1.25;
              oFlower.add(sep);
            }

            // 2 Wide Butterfly Lateral Petals
            for (const side of [-1, 1]) {
              const wingGeo = createSpeciesLeafGeometry(
                'sunflower_cordate',
                0.26 * s,
                0.24 * s,
                0.2,
                0
              );
              const wing = new THREE.Mesh(wingGeo, orchidPetalMat);
              wing.rotation.z = side * 1.48;
              wing.rotation.x = 1.15;
              wing.position.z = 0.015;
              oFlower.add(wing);
            }

            // Trilobed Crimson Labellum Lip & White Column
            const lip = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 12, 12), lipMat);
            lip.scale.set(0.8, 1.3, 1.1);
            lip.position.set(0, -0.04 * s, 0.04);
            oFlower.add(lip);
          }
        }
      }
    }

    // Smoothly frame camera height
    const targetY =
      species.id === 'orchid' && growthProgress < 35
        ? 0.55
        : growthProgress < 38
        ? 0.78 + (growthProgress / 38) * 0.32
        : 1.25;
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
    sceneRef.current.camera.position.set(0, 1.85, 5.2);
    sceneRef.current.controls.target.set(0, 1.05, 0);
    sceneRef.current.controls.update();
  };

  const handleCycleSpecies = () => {
    const idx = SPECIES_LIST.findIndex((s) => s.id === selectedSpeciesId);
    const next = SPECIES_LIST[(idx + 1) % SPECIES_LIST.length];
    selectSpecies(next.id);
  };

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

      {/* TOP-LEFT MINIMALIST STUDIO MACRO HUD */}
      <div className="absolute top-6 left-7 pointer-events-none flex flex-col gap-1.5 z-10">
        <div
          className="text-5xl sm:text-6xl font-extralight tracking-tight text-white/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
          style={{ fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 200 }}
        >
          Day {ageDays}
        </div>

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

      {/* BOTTOM TIMELAPSE CHAPTER SCRUBBER & PLAYER BAR */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/90 to-transparent pt-8 pb-3.5 px-5 z-10">
        <div className="relative group mb-3">
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

          <div className="flex items-center gap-1.5 w-full h-1.5">
            {species.stages.map((st) => {
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

          <div
            className="w-3.5 h-3.5 rounded-full bg-[#ff0033] shadow-[0_0_10px_#ff0033] pointer-events-none absolute -top-1 -translate-x-1/2 transition-transform group-hover:scale-125"
            style={{ left: `${growthProgress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-white/90">
          <div className="flex items-center gap-4">
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

            <button
              onClick={resetSimulation}
              className="p-1.5 hover:text-white text-white/75 transition-colors cursor-pointer"
              title="Reset to Day 0 Seed"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="text-xs sm:text-sm font-medium tracking-wide text-white/90 font-mono">
              {growthProgress.toFixed(1)}% <span className="text-white/40">/</span> 100%
            </div>

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

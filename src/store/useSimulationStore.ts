import { create } from 'zustand';
import {
  EnvironmentConfig,
  FactorScores,
  GrowthStage,
  LogEntry,
  LogType,
  NPKLevels,
  OptimalRange,
  PlantSpecies,
  SimulationSpeed,
  SimulationState,
  StressIndicators,
} from '../types/simulation';
import { PLANT_SPECIES } from '../data/species';

interface SimulationActions {
  selectSpecies: (speciesId: PlantSpecies['id']) => void;
  togglePlay: () => void;
  setRunning: (isRunning: boolean) => void;
  setSpeed: (speed: SimulationSpeed) => void;
  stepDay: () => void;
  resetSimulation: () => void;
  applyOptimalEnvironment: () => void;

  // Environmental Sliders
  setSunlight: (value: number) => void;
  setTemperature: (value: number) => void;
  setSoilMoisture: (value: number) => void;
  setSoilPh: (value: number) => void;
  setNPK: (key: keyof NPKLevels, value: number) => void;

  // User Care Actions
  waterPlant: () => void;
  applyFertilizer: () => void;
  pruneBranches: () => void;
  pollinatePlant: () => void;
  adjustPh: (mode: 'acidify' | 'alkalize' | 'optimal') => void;
  harvestPlant: () => void;
}

export type SimulationStore = SimulationState & SimulationActions;

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

function scoreMetric(value: number, range: OptimalRange): number {
  if (value >= range.min && value <= range.max) {
    // Inside optimal band: 88 - 100 based on proximity to ideal
    const halfSpan = Math.max(0.001, (range.max - range.min) / 2);
    const distFromIdeal = Math.abs(value - range.ideal);
    return clamp(100 - (distFromIdeal / halfSpan) * 12, 88, 100);
  }
  const distanceOutside = value < range.min ? range.min - value : value - range.max;
  const penalty = (distanceOutside / Math.max(0.001, range.tolerance)) * 88;
  return clamp(88 - penalty, 0, 88);
}

export function evaluateEnvironment(
  env: EnvironmentConfig,
  species: PlantSpecies
): { factorScores: FactorScores; stress: StressIndicators } {
  const opt = species.optimalEnvironment;

  const waterScore = scoreMetric(env.soilMoisture, opt.soilMoisture);
  const sunlightScore = scoreMetric(env.sunlight, opt.sunlight);
  const temperatureScore = scoreMetric(env.temperature, opt.temperature);
  const phScore = scoreMetric(env.soilPh, opt.soilPh);

  const nScore = scoreMetric(env.npk.nitrogen, opt.npk.nitrogen);
  const pScore = scoreMetric(env.npk.phosphorus, opt.npk.phosphorus);
  const kScore = scoreMetric(env.npk.potassium, opt.npk.potassium);

  // Soil pH imbalance reduces root nutrient uptake efficiency (pH nutrient lockout)
  const phLockoutFactor = phScore < 65 ? clamp((65 - phScore) / 65, 0, 0.65) : 0;
  const rawNpkScore = (nScore + pScore + kScore) / 3;
  const npkScore = clamp(rawNpkScore * (1 - phLockoutFactor * 0.45), 0, 100);

  const overallMatch = Math.round(
    waterScore * 0.26 +
      sunlightScore * 0.22 +
      temperatureScore * 0.18 +
      phScore * 0.16 +
      npkScore * 0.18
  );

  // Stress Indicators (0 to 1)
  const droughtWilting =
    env.soilMoisture < opt.soilMoisture.min
      ? clamp((opt.soilMoisture.min - env.soilMoisture) / opt.soilMoisture.tolerance, 0, 1)
      : 0;

  const overwaterYellowing =
    env.soilMoisture > opt.soilMoisture.max
      ? clamp((env.soilMoisture - opt.soilMoisture.max) / opt.soilMoisture.tolerance, 0, 1)
      : 0;

  const phLockoutChlorosis =
    env.soilPh < opt.soilPh.min
      ? clamp((opt.soilPh.min - env.soilPh) / opt.soilPh.tolerance, 0, 1)
      : env.soilPh > opt.soilPh.max
      ? clamp((env.soilPh - opt.soilPh.max) / opt.soilPh.tolerance, 0, 1)
      : 0;

  const lowLightEtiolation =
    env.sunlight < opt.sunlight.min
      ? clamp((opt.sunlight.min - env.sunlight) / opt.sunlight.tolerance, 0, 1)
      : 0;

  const tempStress =
    env.temperature < opt.temperature.min
      ? clamp((opt.temperature.min - env.temperature) / opt.temperature.tolerance, 0, 1)
      : env.temperature > opt.temperature.max
      ? clamp((env.temperature - opt.temperature.max) / opt.temperature.tolerance, 0, 1)
      : 0;

  const lightScorch =
    env.sunlight > opt.sunlight.max
      ? clamp((env.sunlight - opt.sunlight.max) / opt.sunlight.tolerance, 0, 1)
      : 0;

  const thermalStress = clamp(Math.max(tempStress, lightScorch * 0.85), 0, 1);

  const nutrientDeficiency = clamp((75 - npkScore) / 75, 0, 1);

  return {
    factorScores: {
      waterScore: Math.round(waterScore),
      sunlightScore: Math.round(sunlightScore),
      temperatureScore: Math.round(temperatureScore),
      phScore: Math.round(phScore),
      npkScore: Math.round(npkScore),
      overallMatch,
    },
    stress: {
      droughtWilting: Number(droughtWilting.toFixed(2)),
      overwaterYellowing: Number(overwaterYellowing.toFixed(2)),
      phLockoutChlorosis: Number(phLockoutChlorosis.toFixed(2)),
      lowLightEtiolation: Number(lowLightEtiolation.toFixed(2)),
      thermalStress: Number(thermalStress.toFixed(2)),
      nutrientDeficiency: Number(nutrientDeficiency.toFixed(2)),
    },
  };
}

function resolveStage(
  progress: number,
  species: PlantSpecies
): { stage: GrowthStage; index: number } {
  for (let i = species.stages.length - 1; i >= 0; i--) {
    if (progress >= species.stages[i].minProgress) {
      return { stage: species.stages[i].name, index: i };
    }
  }
  return { stage: species.stages[0].name, index: 0 };
}

function createLog(day: number, type: LogType, title: string, message: string): LogEntry {
  return {
    id: `log-${day}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    day,
    type,
    title,
    message,
    timestamp: `Day ${day}`,
  };
}

function buildInitialState(speciesId: PlantSpecies['id']): SimulationState {
  const species = PLANT_SPECIES[speciesId];
  const opt = species.optimalEnvironment;

  const initialEnv: EnvironmentConfig = {
    sunlight: opt.sunlight.ideal,
    temperature: opt.temperature.ideal,
    soilMoisture: opt.soilMoisture.ideal,
    soilPh: opt.soilPh.ideal,
    npk: {
      nitrogen: opt.npk.nitrogen.ideal,
      phosphorus: opt.npk.phosphorus.ideal,
      potassium: opt.npk.potassium.ideal,
    },
  };

  const { factorScores, stress } = evaluateEnvironment(initialEnv, species);

  return {
    selectedSpeciesId: speciesId,
    isRunning: false,
    speed: 1,
    ageDays: 0,
    growthProgress: 0,
    health: 96,
    currentStage: species.stages[0].name,
    currentStageIndex: 0,
    environment: initialEnv,
    stress,
    factorScores,
    isPollinated: false,
    pollinationQuality: 0,
    pruningLevel: 0.25,
    harvestCount: 0,
    totalYieldKg: 0,
    currentCropCount: 0,
    dailyGrowthRate: 0,
    randomSeed: Math.floor(Math.random() * 10000),
    logs: [
      createLog(
        0,
        'system',
        `${species.name} Specimen Initialized`,
        `Planted ${species.scientificName} seed in substrate (pH ${initialEnv.soilPh.toFixed(
          1
        )}, moisture ${initialEnv.soilMoisture}%). Press Play or +1 Day to begin growth simulation.`
      ),
    ],
    history: [
      {
        day: 0,
        health: 96,
        growthProgress: 0,
        soilMoisture: initialEnv.soilMoisture,
        dailyGrowthDelta: 0,
      },
    ],
  };
}

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  ...buildInitialState('apple'),

  selectSpecies: (speciesId) => {
    set(buildInitialState(speciesId));
  },

  togglePlay: () => {
    set((state) => ({ isRunning: !state.isRunning }));
  },

  setRunning: (isRunning) => {
    set({ isRunning });
  },

  setSpeed: (speed) => {
    set({ speed });
  },

  resetSimulation: () => {
    const currentSpecies = get().selectedSpeciesId;
    set(buildInitialState(currentSpecies));
  },

  applyOptimalEnvironment: () => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];
    const opt = species.optimalEnvironment;
    const newEnv: EnvironmentConfig = {
      sunlight: opt.sunlight.ideal,
      temperature: opt.temperature.ideal,
      soilMoisture: opt.soilMoisture.ideal,
      soilPh: opt.soilPh.ideal,
      npk: {
        nitrogen: opt.npk.nitrogen.ideal,
        phosphorus: opt.npk.phosphorus.ideal,
        potassium: opt.npk.potassium.ideal,
      },
    };
    const { factorScores, stress } = evaluateEnvironment(newEnv, species);
    set({
      environment: newEnv,
      factorScores,
      stress,
      logs: [
        createLog(
          state.ageDays,
          'care',
          'Climate & Substrate Calibrated',
          `Environmental metrics synchronized to ${species.name} optimal thresholds.`
        ),
        ...state.logs,
      ].slice(0, 80),
    });
  },

  setSunlight: (value) => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];
    const environment = { ...state.environment, sunlight: clamp(value, 0, 100) };
    const { factorScores, stress } = evaluateEnvironment(environment, species);
    set({ environment, factorScores, stress });
  },

  setTemperature: (value) => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];
    const environment = { ...state.environment, temperature: clamp(value, 0, 45) };
    const { factorScores, stress } = evaluateEnvironment(environment, species);
    set({ environment, factorScores, stress });
  },

  setSoilMoisture: (value) => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];
    const environment = { ...state.environment, soilMoisture: clamp(value, 0, 100) };
    const { factorScores, stress } = evaluateEnvironment(environment, species);
    set({ environment, factorScores, stress });
  },

  setSoilPh: (value) => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];
    const environment = {
      ...state.environment,
      soilPh: Number(clamp(value, 4.0, 8.5).toFixed(1)),
    };
    const { factorScores, stress } = evaluateEnvironment(environment, species);
    set({ environment, factorScores, stress });
  },

  setNPK: (key, value) => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];
    const environment = {
      ...state.environment,
      npk: {
        ...state.environment.npk,
        [key]: clamp(value, 0, 100),
      },
    };
    const { factorScores, stress } = evaluateEnvironment(environment, species);
    set({ environment, factorScores, stress });
  },

  waterPlant: () => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];
    const newMoisture = clamp(Math.round(state.environment.soilMoisture + 24), 0, 100);
    const environment = { ...state.environment, soilMoisture: newMoisture };
    const { factorScores, stress } = evaluateEnvironment(environment, species);

    const overwaterMsg =
      newMoisture > species.optimalEnvironment.soilMoisture.max
        ? 'Warning: Substrate approaching saturation; root hypoxia risk.'
        : 'Root zone turgor pressure restored.';

    set({
      environment,
      factorScores,
      stress,
      logs: [
        createLog(
          state.ageDays,
          'care',
          'Irrigation Applied (+24% Moisture)',
          `Soil moisture raised to ${newMoisture}%. ${overwaterMsg}`
        ),
        ...state.logs,
      ].slice(0, 80),
    });
  },

  applyFertilizer: () => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];
    const newNpk: NPKLevels = {
      nitrogen: clamp(Math.round(state.environment.npk.nitrogen + 24), 0, 100),
      phosphorus: clamp(Math.round(state.environment.npk.phosphorus + 26), 0, 100),
      potassium: clamp(Math.round(state.environment.npk.potassium + 24), 0, 100),
    };
    const environment = { ...state.environment, npk: newNpk };
    const { factorScores, stress } = evaluateEnvironment(environment, species);

    set({
      environment,
      factorScores,
      stress,
      logs: [
        createLog(
          state.ageDays,
          'care',
          'NPK Bio-Fertilizer Applied',
          `Macronutrients replenished to N:${newNpk.nitrogen} P:${newNpk.phosphorus} K:${newNpk.potassium}.`
        ),
        ...state.logs,
      ].slice(0, 80),
    });
  },

  pruneBranches: () => {
    const state = get();
    if (state.growthProgress < 18) {
      set({
        logs: [
          createLog(
            state.ageDays,
            'care',
            'Pruning Skipped — Specimen Too Young',
            'Wait until Sapling or Vegetative stage (>18% growth) before structural pruning.'
          ),
          ...state.logs,
        ].slice(0, 80),
      });
      return;
    }

    const newPruning = clamp(Number((state.pruningLevel + 0.35).toFixed(2)), 0, 1);
    const newHealth = clamp(Math.round(state.health + 4), 0, 100);

    set({
      pruningLevel: newPruning,
      health: newHealth,
      logs: [
        createLog(
          state.ageDays,
          'care',
          'Canopy & Apical Pruning Completed',
          `Removed shaded interior shoots. Canopy airflow and light interception efficiency increased (+4% Health).`
        ),
        ...state.logs,
      ].slice(0, 80),
    });
  },

  pollinatePlant: () => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];
    const isFloralStage =
      state.currentStage === 'Flowering' ||
      state.currentStage === 'Budding' ||
      state.currentStage === 'Full Bloom';

    if (!isFloralStage) {
      set({
        logs: [
          createLog(
            state.ageDays,
            'care',
            'Pollination Attempted Early',
            `${species.name} has no receptive stigmas yet (Current stage: ${state.currentStage}). Pollinate during Flowering/Budding!`
          ),
          ...state.logs,
        ].slice(0, 80),
      });
      return;
    }

    const quality = clamp(Number((state.health / 100) * 0.95 + 0.05), 0.3, 1);
    const cropPotential =
      species.category === 'fruit_tree' ? Math.max(6, Math.round(quality * 18)) : 0;

    set({
      isPollinated: true,
      pollinationQuality: quality,
      currentCropCount: cropPotential,
      logs: [
        createLog(
          state.ageDays,
          'milestone',
          'Cross-Pollination Successful!',
          `Pollen tubes germinated across open blossoms (Viability ${(quality * 100).toFixed(
            0
          )}%). ${
            species.category === 'fruit_tree'
              ? `Projected fruit set: ${cropPotential} developing fruits.`
              : 'Seed set and vibrant full-bloom longevity enhanced.'
          }`
        ),
        ...state.logs,
      ].slice(0, 80),
    });
  },

  adjustPh: (mode) => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];
    let targetPh = state.environment.soilPh;
    let actionLabel = '';

    if (mode === 'acidify') {
      targetPh = clamp(Number((state.environment.soilPh - 0.4).toFixed(1)), 4.0, 8.5);
      actionLabel = 'Elemental Sulfur Amendment (-0.4 pH)';
    } else if (mode === 'alkalize') {
      targetPh = clamp(Number((state.environment.soilPh + 0.4).toFixed(1)), 4.0, 8.5);
      actionLabel = 'Dolomitic Lime Amendment (+0.4 pH)';
    } else {
      targetPh = species.optimalEnvironment.soilPh.ideal;
      actionLabel = 'Buffered Chelate pH Stabilizer';
    }

    const environment = { ...state.environment, soilPh: targetPh };
    const { factorScores, stress } = evaluateEnvironment(environment, species);

    set({
      environment,
      factorScores,
      stress,
      logs: [
        createLog(
          state.ageDays,
          'care',
          actionLabel,
          `Substrate pH adjusted to ${targetPh.toFixed(1)} (Optimal range: ${
            species.optimalEnvironment.soilPh.min
          }–${species.optimalEnvironment.soilPh.max}).`
        ),
        ...state.logs,
      ].slice(0, 80),
    });
  },

  harvestPlant: () => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];

    if (species.category === 'fruit_tree') {
      if (state.growthProgress < 80) {
        set({
          logs: [
            createLog(
              state.ageDays,
              'care',
              'Harvest Unavailable',
              `Fruits are not yet mature (Growth: ${state.growthProgress.toFixed(
                1
              )}%). Wait for late Fruiting or Harvest stage.`
            ),
            ...state.logs,
          ].slice(0, 80),
        });
        return;
      }

      const cropCount = Math.max(4, state.currentCropCount || 10);
      const ripenessFactor = clamp((state.growthProgress - 75) / 25, 0.4, 1.0);
      const yieldKg = Number(((cropCount * 0.24 * ripenessFactor * state.health) / 90).toFixed(2));
      const postHarvestProgress = 54; // Return to Mature Tree for next seasonal cycle
      const resolved = resolveStage(postHarvestProgress, species);

      set({
        harvestCount: state.harvestCount + 1,
        totalYieldKg: Number((state.totalYieldKg + yieldKg).toFixed(2)),
        growthProgress: postHarvestProgress,
        currentStage: resolved.stage,
        currentStageIndex: resolved.index,
        isPollinated: false,
        pollinationQuality: 0,
        currentCropCount: 0,
        logs: [
          createLog(
            state.ageDays,
            'harvest',
            `Harvest #${state.harvestCount + 1} Complete: +${yieldKg} kg`,
            `Collected ${cropCount} ripe ${species.name.toLowerCase()} fruits! Tree returned to Mature Tree stage for its next seasonal flowering cycle.`
          ),
          ...state.logs,
        ].slice(0, 80),
      });
    } else {
      // Flowering plant bloom harvest / deadheading rejuvenation
      if (state.growthProgress < 72) {
        set({
          logs: [
            createLog(
              state.ageDays,
              'care',
              'Bloom Harvest Unavailable',
              `${species.name} has not reached Full Bloom yet (${state.growthProgress.toFixed(
                1
              )}%).`
            ),
            ...state.logs,
          ].slice(0, 80),
        });
        return;
      }

      const yieldKg = Number(((0.35 * state.health) / 100).toFixed(2));
      const rejuvenatedProgress = 42; // Return to Vegetative stage to re-bud
      const resolved = resolveStage(rejuvenatedProgress, species);

      set({
        harvestCount: state.harvestCount + 1,
        totalYieldKg: Number((state.totalYieldKg + yieldKg).toFixed(2)),
        growthProgress: rejuvenatedProgress,
        currentStage: resolved.stage,
        currentStageIndex: resolved.index,
        isPollinated: false,
        logs: [
          createLog(
            state.ageDays,
            'harvest',
            `Cut Flower Harvest & Deadheading (#${state.harvestCount + 1})`,
            `Harvested prime ${species.name} blooms (+${yieldKg} kg biomass). Plant rejuvenated to Vegetative stage for secondary flush.`
          ),
          ...state.logs,
        ].slice(0, 80),
      });
    }
  },

  stepDay: () => {
    const state = get();
    const species = PLANT_SPECIES[state.selectedSpeciesId];
    const nextDay = state.ageDays + 1;
    const newLogs: LogEntry[] = [];

    // 1. Natural Daily Evapotranspiration & Nutrient Uptake
    const evapMultiplier =
      0.65 + (state.environment.temperature / 32) * 0.45 + (state.environment.sunlight / 100) * 0.35;
    const moistureLoss = species.waterConsumptionPerDay * evapMultiplier;
    const nextMoisture = clamp(
      Number((state.environment.soilMoisture - moistureLoss).toFixed(1)),
      0,
      100
    );

    const growthActivityFactor = state.growthProgress < 98 ? 1.0 : 0.4;
    const nLoss = species.nutrientConsumptionPerDay * 0.95 * growthActivityFactor;
    const pLoss =
      species.nutrientConsumptionPerDay *
      (state.growthProgress > 50 ? 1.15 : 0.75) *
      growthActivityFactor;
    const kLoss =
      species.nutrientConsumptionPerDay *
      (state.growthProgress > 65 ? 1.2 : 0.8) *
      growthActivityFactor;

    // Slight natural pH drift toward acidity as organic nutrients are metabolized
    const phDrift = nextDay % 9 === 0 ? -0.1 : 0;

    const nextEnv: EnvironmentConfig = {
      ...state.environment,
      soilMoisture: nextMoisture,
      soilPh: Number(clamp(state.environment.soilPh + phDrift, 4.0, 8.5).toFixed(1)),
      npk: {
        nitrogen: clamp(Number((state.environment.npk.nitrogen - nLoss).toFixed(1)), 0, 100),
        phosphorus: clamp(Number((state.environment.npk.phosphorus - pLoss).toFixed(1)), 0, 100),
        potassium: clamp(Number((state.environment.npk.potassium - kLoss).toFixed(1)), 0, 100),
      },
    };

    // 2. Evaluate Environmental Match & Stress Indicators
    const { factorScores, stress } = evaluateEnvironment(nextEnv, species);

    // 3. Calculate Health Change
    const maxStress = Math.max(
      stress.droughtWilting,
      stress.overwaterYellowing,
      stress.phLockoutChlorosis,
      stress.lowLightEtiolation,
      stress.thermalStress,
      stress.nutrientDeficiency * 0.8
    );

    let healthDelta = 0;
    if (factorScores.overallMatch >= 78 && maxStress < 0.25) {
      healthDelta = 1.6 + (factorScores.overallMatch - 78) * 0.1;
    } else if (factorScores.overallMatch >= 62 && maxStress < 0.45) {
      healthDelta = 0.3;
    } else {
      healthDelta = -(maxStress * 5.2 + (62 - Math.min(62, factorScores.overallMatch)) * 0.12);
    }

    const nextHealth = clamp(Number((state.health + healthDelta).toFixed(1)), 5, 100);

    // 4. Calculate Daily Growth Rate (%)
    const baseDailyStep = 100 / species.baseMaturityDays;
    const envEfficiency = Math.pow(clamp(factorScores.overallMatch / 100, 0.05, 1.15), 1.35);
    const healthEfficiency = clamp(nextHealth / 95, 0.15, 1.08);
    const pruningBonus = 1 + state.pruningLevel * 0.12;

    let stageGateMultiplier = 1.0;
    // Fruit tree pollination check near end of Flowering stage
    if (
      species.category === 'fruit_tree' &&
      state.growthProgress >= 73 &&
      state.growthProgress < 76.5 &&
      !state.isPollinated
    ) {
      // Slow down slightly while waiting for pollination, or self-pollinate with lower yield at 75.8%
      stageGateMultiplier = 0.45;
    }

    const rawDelta =
      baseDailyStep * envEfficiency * healthEfficiency * pruningBonus * stageGateMultiplier;
    const dailyGrowthRate =
      state.growthProgress >= 100 ? 0 : Number(clamp(rawDelta, 0.05, 3.5).toFixed(2));
    const nextProgress = clamp(Number((state.growthProgress + dailyGrowthRate).toFixed(2)), 0, 100);

    // Natural self-pollination fallback if tree crosses into Fruiting without manual pollination
    let isPollinated = state.isPollinated;
    let pollinationQuality = state.pollinationQuality;
    let currentCropCount = state.currentCropCount;

    if (
      species.category === 'fruit_tree' &&
      nextProgress >= 76 &&
      !isPollinated
    ) {
      isPollinated = true;
      pollinationQuality = 0.45;
      currentCropCount = Math.max(4, Math.round((nextHealth / 100) * 8));
      newLogs.push(
        createLog(
          nextDay,
          'milestone',
          'Ambient Wind Pollination Occurred',
          `Blossoms transitioned to Fruiting via wind pollination (${currentCropCount} fruits set). Manual pollination during Flowering yields higher fruit density!`
        )
      );
    }

    // 5. Check Stage Transition Milestones
    const prevStageInfo = resolveStage(state.growthProgress, species);
    const nextStageInfo = resolveStage(nextProgress, species);

    if (nextStageInfo.stage !== prevStageInfo.stage) {
      const stageDef = species.stages[nextStageInfo.index];
      newLogs.push(
        createLog(
          nextDay,
          'milestone',
          `Stage Reached: ${nextStageInfo.stage}`,
          stageDef.description
        )
      );
    }

    // Sub-stage biological milestones
    if (state.growthProgress < 14 && nextProgress >= 14) {
      newLogs.push(
        createLog(
          nextDay,
          'milestone',
          'First True Leaves Unfolded',
          `Photosynthetic lamina expanded; stomatal gas exchange and transpiration now active.`
        )
      );
    }
    if (state.growthProgress < 32 && nextProgress >= 32) {
      newLogs.push(
        createLog(
          nextDay,
          'milestone',
          'Secondary Vascular Cambium Active',
          `Lateral root architecture and woody stem vascular bundles thickening rapidly.`
        )
      );
    }
    if (state.growthProgress < 99.5 && nextProgress >= 99.5) {
      newLogs.push(
        createLog(
          nextDay,
          'milestone',
          species.category === 'fruit_tree'
            ? 'Peak Physiological Ripeness Reached!'
            : 'Cycle Complete — Dormancy / Seed Maturation',
          species.category === 'fruit_tree'
            ? `${species.name} crop is ready for harvest!`
            : `${species.name} has completed its full bloom cycle.`
        )
      );
    }

    // 6. Periodic Environmental Stress Diagnostics (every 4 days if stressed)
    if (nextDay % 4 === 0) {
      if (stress.droughtWilting >= 0.35) {
        newLogs.push(
          createLog(
            nextDay,
            'stress',
            'Drought Stress — Leaf Turgor Loss',
            `Soil moisture (${nextEnv.soilMoisture}%) is below ${species.name} minimum (${species.optimalEnvironment.soilMoisture.min}%). Stomata closing; leaves wilting.`
          )
        );
      } else if (stress.overwaterYellowing >= 0.35) {
        newLogs.push(
          createLog(
            nextDay,
            'stress',
            'Root Hypoxia — Overwatering Chlorosis',
            `Excess soil moisture (${nextEnv.soilMoisture}%) is displacing rhizosphere oxygen, causing lower leaf yellowing.`
          )
        );
      }

      if (stress.phLockoutChlorosis >= 0.35) {
        const isAcidic = nextEnv.soilPh < species.optimalEnvironment.soilPh.min;
        newLogs.push(
          createLog(
            nextDay,
            'stress',
            `Soil pH ${isAcidic ? 'Too Acidic' : 'Too Alkaline'} (${nextEnv.soilPh})`,
            `Root ion absorption reduced due to pH lockout (Optimal: ${species.optimalEnvironment.soilPh.min}–${species.optimalEnvironment.soilPh.max}). Interveinal leaf chlorosis detected.`
          )
        );
      }

      if (stress.lowLightEtiolation >= 0.35) {
        newLogs.push(
          createLog(
            nextDay,
            'stress',
            'Low Light Etiolation — Stunted Photosynthesis',
            `Sunlight intensity (${nextEnv.sunlight}%) is below optimal threshold (${species.optimalEnvironment.sunlight.min}%). Internodes stretching with reduced chlorophyll.`
          )
        );
      } else if (stress.thermalStress >= 0.4) {
        newLogs.push(
          createLog(
            nextDay,
            'stress',
            'Thermal / Radiation Stress Detected',
            `Ambient conditions (${nextEnv.temperature}°C, ${nextEnv.sunlight}% light) are outside ${species.name} comfort zone.`
          )
        );
      }
    }

    // Decay pruning bonus slightly over time as new wild shoots grow
    const nextPruning = clamp(Number((state.pruningLevel - 0.008).toFixed(3)), 0, 1);

    const nextSnapshot = {
      day: nextDay,
      health: nextHealth,
      growthProgress: nextProgress,
      soilMoisture: nextMoisture,
      dailyGrowthDelta: dailyGrowthRate,
    };

    set({
      ageDays: nextDay,
      growthProgress: nextProgress,
      health: nextHealth,
      currentStage: nextStageInfo.stage,
      currentStageIndex: nextStageInfo.index,
      environment: nextEnv,
      factorScores,
      stress,
      isPollinated,
      pollinationQuality,
      currentCropCount,
      pruningLevel: nextPruning,
      dailyGrowthRate,
      logs: [...newLogs, ...state.logs].slice(0, 80),
      history: [...state.history.slice(-59), nextSnapshot],
    });
  },
}));

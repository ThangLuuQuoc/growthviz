export type PlantCategory = 'fruit_tree' | 'flowering_plant';

export type FruitTreeStage =
  | 'Seed'
  | 'Sprout'
  | 'Sapling'
  | 'Mature Tree'
  | 'Flowering'
  | 'Fruiting'
  | 'Harvest';

export type FloweringPlantStage =
  | 'Seed'
  | 'Sprout'
  | 'Vegetative'
  | 'Budding'
  | 'Full Bloom'
  | 'Wilting/Dormancy';

export type GrowthStage = FruitTreeStage | FloweringPlantStage;

export interface OptimalRange {
  min: number;
  max: number;
  ideal: number;
  tolerance: number; // How far outside min/max before severe stress occurs
}

export interface NPKLevels {
  nitrogen: number;   // N: 0-100 (leaf & vegetative growth)
  phosphorus: number; // P: 0-100 (root development & flowering/budding)
  potassium: number;  // K: 0-100 (fruiting, stem strength & immunity)
}

export interface StageDefinition {
  name: GrowthStage;
  minProgress: number; // 0-100
  maxProgress: number; // 0-100
  description: string;
}

export interface PlantMorphologyConfig {
  trunkColor: string;
  trunkHighlight: string;
  leafColorHealthy: string;
  leafColorSecondary: string;
  flowerPetalColor: string;
  flowerCenterColor: string;
  fruitColorUnripe: string;
  fruitColorRipe: string;
  fruitShape: 'apple' | 'mango' | 'orange' | 'none';
  flowerArchType: 'blossom_cluster' | 'rose_spiral' | 'sunflower_head' | 'orchid_spike';
  maxBranchDepth: number;
  branchSpreadAngle: number; // radians
  trunkTaper: number;
  baseHeightScale: number;
}

export interface PlantSpecies {
  id: 'apple' | 'mango' | 'orange' | 'rose' | 'sunflower' | 'orchid';
  name: string;
  scientificName: string;
  category: PlantCategory;
  description: string;
  baseMaturityDays: number; // Nominal days from 0% to 100% under optimal conditions
  optimalEnvironment: {
    sunlight: OptimalRange;     // 0 - 100 %
    temperature: OptimalRange;  // -5 - 45 °C
    soilMoisture: OptimalRange; // 0 - 100 %
    soilPh: OptimalRange;       // 4.0 - 8.5 pH
    npk: {
      nitrogen: OptimalRange;
      phosphorus: OptimalRange;
      potassium: OptimalRange;
    };
  };
  stages: StageDefinition[];
  morphology: PlantMorphologyConfig;
  waterConsumptionPerDay: number;
  nutrientConsumptionPerDay: number;
}

export interface EnvironmentConfig {
  sunlight: number;     // 0 - 100 %
  temperature: number;  // 0 - 45 °C
  soilMoisture: number; // 0 - 100 %
  soilPh: number;       // 4.0 - 8.5 pH
  npk: NPKLevels;
}

export interface StressIndicators {
  droughtWilting: number;       // 0 - 1 (drooping leaves/stems from low soilMoisture)
  overwaterYellowing: number;   // 0 - 1 (root hypoxia & leaf chlorosis from excessive moisture)
  phLockoutChlorosis: number;   // 0 - 1 (interveinal yellowing from acidic/alkaline pH lockout)
  lowLightEtiolation: number;   // 0 - 1 (stunted growth, pale sparse foliage from low sunlight)
  thermalStress: number;        // 0 - 1 (heat scorch or cold dormancy from extreme temp)
  nutrientDeficiency: number;   // 0 - 1 (NPK shortage limiting growth/bloom/fruiting)
}

export interface FactorScores {
  waterScore: number;       // 0 - 100
  sunlightScore: number;    // 0 - 100
  temperatureScore: number; // 0 - 100
  phScore: number;          // 0 - 100
  npkScore: number;         // 0 - 100
  overallMatch: number;     // 0 - 100
}

export type LogType = 'milestone' | 'stress' | 'care' | 'harvest' | 'system';

export interface LogEntry {
  id: string;
  day: number;
  type: LogType;
  title: string;
  message: string;
  timestamp: string;
}

export interface DailyTelemetrySnapshot {
  day: number;
  health: number;
  growthProgress: number;
  soilMoisture: number;
  dailyGrowthDelta: number;
}

export type SimulationSpeed = 1 | 5 | 10;

export interface SimulationState {
  selectedSpeciesId: PlantSpecies['id'];
  isRunning: boolean;
  speed: SimulationSpeed;
  ageDays: number;
  growthProgress: number; // 0 - 100%
  health: number;         // 0 - 100%
  currentStage: GrowthStage;
  currentStageIndex: number;
  environment: EnvironmentConfig;
  stress: StressIndicators;
  factorScores: FactorScores;
  isPollinated: boolean;
  pollinationQuality: number; // 0 - 1 (affects fruit set density)
  pruningLevel: number;       // 0 - 1 (improves canopy light penetration & structural yield)
  harvestCount: number;
  totalYieldKg: number;
  currentCropCount: number;
  dailyGrowthRate: number;    // % growth gained on last tick
  randomSeed: number;
  logs: LogEntry[];
  history: DailyTelemetrySnapshot[];
}

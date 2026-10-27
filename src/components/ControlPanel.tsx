import React from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { PLANT_SPECIES, SPECIES_LIST } from '../data/species';
import { OptimalRange } from '../types/simulation';
import {
  Sun,
  Thermometer,
  Droplets,
  FlaskConical,
  Sprout,
  Trees,
  Flower2,
  Scissors,
  Sparkles,
  ShoppingBasket,
  Beaker,
} from 'lucide-react';

interface EnvSliderProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  optimal: OptimalRange;
  icon: React.ReactNode;
  onChange: (val: number) => void;
}

const EnvSlider: React.FC<EnvSliderProps> = ({
  label,
  unit,
  value,
  min,
  max,
  step = 1,
  optimal,
  icon,
  onChange,
}) => {
  const isOptimal = value >= optimal.min && value <= optimal.max;
  const optStartPct = ((optimal.min - min) / (max - min)) * 100;
  const optWidthPct = ((optimal.max - optimal.min) / (max - min)) * 100;

  return (
    <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-2.5">
      <div className="flex items-center justify-between text-xs mb-1">
        <div className="flex items-center gap-1.5 font-medium text-slate-200">
          {icon}
          <span>{label}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`font-mono font-semibold px-1.5 py-0.5 rounded text-[11px] ${
              isOptimal
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
            }`}
          >
            {step < 1 ? value.toFixed(1) : Math.round(value)}
            {unit}
          </span>
        </div>
      </div>

      {/* Slider with Optimal Threshold Band Indicator */}
      <div className="relative pt-1 pb-0.5">
        <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden relative border border-slate-800">
          {/* Optimal sweet-spot highlight bar */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/35 border-x border-emerald-400/70"
            style={{
              left: `${Math.max(0, optStartPct)}%`,
              width: `${Math.min(100, optWidthPct)}%`,
            }}
            title={`Optimal Range: ${optimal.min}–${optimal.max}${unit}`}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full absolute inset-0 top-0.5 h-3 opacity-95"
        />
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-1">
        <span>
          Min {min}
          {unit}
        </span>
        <span className="text-emerald-400/90">
          Optimal: {optimal.min}–{optimal.max}
          {unit}
        </span>
        <span>
          Max {max}
          {unit}
        </span>
      </div>
    </div>
  );
};

export const ControlPanel: React.FC = () => {
  const selectedSpeciesId = useSimulationStore((s) => s.selectedSpeciesId);
  const environment = useSimulationStore((s) => s.environment);
  const currentStage = useSimulationStore((s) => s.currentStage);
  const growthProgress = useSimulationStore((s) => s.growthProgress);
  const isPollinated = useSimulationStore((s) => s.isPollinated);

  const selectSpecies = useSimulationStore((s) => s.selectSpecies);
  const setSunlight = useSimulationStore((s) => s.setSunlight);
  const setTemperature = useSimulationStore((s) => s.setTemperature);
  const setSoilMoisture = useSimulationStore((s) => s.setSoilMoisture);
  const setSoilPh = useSimulationStore((s) => s.setSoilPh);
  const setNPK = useSimulationStore((s) => s.setNPK);

  const waterPlant = useSimulationStore((s) => s.waterPlant);
  const applyFertilizer = useSimulationStore((s) => s.applyFertilizer);
  const pruneBranches = useSimulationStore((s) => s.pruneBranches);
  const pollinatePlant = useSimulationStore((s) => s.pollinatePlant);
  const adjustPh = useSimulationStore((s) => s.adjustPh);
  const harvestPlant = useSimulationStore((s) => s.harvestPlant);

  const species = PLANT_SPECIES[selectedSpeciesId];
  const fruitTrees = SPECIES_LIST.filter((s) => s.category === 'fruit_tree');
  const floweringPlants = SPECIES_LIST.filter((s) => s.category === 'flowering_plant');

  const canPollinate =
    currentStage === 'Flowering' ||
    currentStage === 'Budding' ||
    currentStage === 'Full Bloom';

  const canHarvest =
    (species.category === 'fruit_tree' && growthProgress >= 80) ||
    (species.category === 'flowering_plant' && growthProgress >= 72);

  return (
    <aside className="w-80 xl:w-96 h-full bg-slate-900/65 border-r border-slate-800 flex flex-col overflow-y-auto shrink-0 select-none">
      <div className="p-3.5 space-y-4">
        {/* 1. SPECIES SELECTION */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sprout className="w-3.5 h-3.5 text-emerald-400" />
              <span>1. Plant Species Selection</span>
            </h2>
            <span className="text-[10px] font-mono text-slate-400">6 Specimens</span>
          </div>

          {/* Fruit Trees Group */}
          <div className="mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90 flex items-center gap-1 mb-1">
              <Trees className="w-3 h-3" />
              <span>Fruit Trees (Orchard Cycle)</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {fruitTrees.map((sp) => {
                const active = sp.id === selectedSpeciesId;
                return (
                  <button
                    key={sp.id}
                    onClick={() => selectSpecies(sp.id)}
                    className={`px-2 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{sp.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {sp.optimalEnvironment.temperature.ideal}°C | pH{' '}
                      {sp.optimalEnvironment.soilPh.ideal}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Flowering Plants Group */}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-pink-400/90 flex items-center gap-1 mb-1">
              <Flower2 className="w-3 h-3" />
              <span>Flowering Plants (Floriculture Cycle)</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {floweringPlants.map((sp) => {
                const active = sp.id === selectedSpeciesId;
                return (
                  <button
                    key={sp.id}
                    onClick={() => selectSpecies(sp.id)}
                    className={`px-2 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-sm shadow-emerald-500/20'
                        : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{sp.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 truncate">
                      {sp.optimalEnvironment.temperature.ideal}°C | pH{' '}
                      {sp.optimalEnvironment.soilPh.ideal}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 2. BOTANICAL CARE ACTIONS */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Horticultural Care Actions</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={waterPlant}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/35 text-sky-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <Droplets className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="text-left">
                <div className="font-semibold leading-tight">Water Plant</div>
                <div className="text-[10px] text-sky-300/80">+24% Soil H₂O</div>
              </div>
            </button>

            <button
              onClick={applyFertilizer}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <FlaskConical className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-left">
                <div className="font-semibold leading-tight">Feed NPK</div>
                <div className="text-[10px] text-emerald-300/80">+25 Macronutrients</div>
              </div>
            </button>

            <button
              onClick={pruneBranches}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-200 text-xs font-medium transition-colors cursor-pointer"
            >
              <Scissors className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-left">
                <div className="font-semibold leading-tight">Prune Canopy</div>
                <div className="text-[10px] text-amber-300/80">+Light & Airflow</div>
              </div>
            </button>

            <button
              onClick={pollinatePlant}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                canPollinate && !isPollinated
                  ? 'bg-pink-500/25 hover:bg-pink-500/35 border-pink-400 text-pink-100 animate-pulse'
                  : 'bg-pink-500/10 hover:bg-pink-500/20 border-pink-500/30 text-pink-200'
              }`}
            >
              <Sparkles className="w-4 h-4 text-pink-400 shrink-0" />
              <div className="text-left">
                <div className="font-semibold leading-tight">
                  {isPollinated ? 'Pollinated' : 'Pollinate'}
                </div>
                <div className="text-[10px] text-pink-300/80">
                  {canPollinate ? 'Blossoms Ready!' : 'For Flowering Stage'}
                </div>
              </div>
            </button>
          </div>

          {/* Soil pH Amendments & Harvest Row */}
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            <button
              onClick={() => adjustPh('acidify')}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-amber-300 transition-colors cursor-pointer"
              title="Apply Elemental Sulfur to lower soil pH (-0.4)"
            >
              <Beaker className="w-3 h-3" />
              <span>Sulfur (-pH)</span>
            </button>
            <button
              onClick={() => adjustPh('alkalize')}
              className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-medium text-indigo-300 transition-colors cursor-pointer"
              title="Apply Dolomitic Lime to raise soil pH (+0.4)"
            >
              <Beaker className="w-3 h-3" />
              <span>Lime (+pH)</span>
            </button>
            <button
              onClick={harvestPlant}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer ${
                canHarvest
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/25'
                  : 'bg-slate-800/70 hover:bg-slate-800 text-slate-400 border-slate-700/80'
              }`}
            >
              <ShoppingBasket className="w-3.5 h-3.5" />
              <span>Harvest</span>
            </button>
          </div>
        </section>

        {/* 3. ENVIRONMENTAL SLIDERS */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              3. Daily Environment Parameters
            </h2>
            <span className="text-[10px] text-emerald-400 font-mono">Green Band = Optimal</span>
          </div>

          <EnvSlider
            label="Sunlight Intensity"
            unit="%"
            value={environment.sunlight}
            min={0}
            max={100}
            optimal={species.optimalEnvironment.sunlight}
            icon={<Sun className="w-3.5 h-3.5 text-amber-400" />}
            onChange={setSunlight}
          />

          <EnvSlider
            label="Ambient Temperature"
            unit="°C"
            value={environment.temperature}
            min={0}
            max={45}
            optimal={species.optimalEnvironment.temperature}
            icon={<Thermometer className="w-3.5 h-3.5 text-rose-400" />}
            onChange={setTemperature}
          />

          <EnvSlider
            label="Soil Moisture"
            unit="%"
            value={environment.soilMoisture}
            min={0}
            max={100}
            optimal={species.optimalEnvironment.soilMoisture}
            icon={<Droplets className="w-3.5 h-3.5 text-sky-400" />}
            onChange={setSoilMoisture}
          />

          <EnvSlider
            label="Substrate Soil pH"
            unit=""
            value={environment.soilPh}
            min={4.0}
            max={8.5}
            step={0.1}
            optimal={species.optimalEnvironment.soilPh}
            icon={<FlaskConical className="w-3.5 h-3.5 text-purple-400" />}
            onChange={setSoilPh}
          />
        </section>

        {/* 4. SOIL NPK MACRONUTRIENT LEVELS */}
        <section className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              4. Rhizosphere NPK Levels
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              Depletes with daily uptake
            </span>
          </div>

          {(
            [
              {
                key: 'nitrogen',
                label: 'Nitrogen (N) — Foliage',
                color: 'text-emerald-400',
                opt: species.optimalEnvironment.npk.nitrogen,
              },
              {
                key: 'phosphorus',
                label: 'Phosphorus (P) — Roots & Bloom',
                color: 'text-amber-400',
                opt: species.optimalEnvironment.npk.phosphorus,
              },
              {
                key: 'potassium',
                label: 'Potassium (K) — Fruit & Vigor',
                color: 'text-sky-400',
                opt: species.optimalEnvironment.npk.potassium,
              },
            ] as const
          ).map((item) => {
            const val = environment.npk[item.key];
            return (
              <div key={item.key} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className={`font-medium ${item.color}`}>{item.label}</span>
                  <span className="font-mono text-slate-300">
                    {Math.round(val)}%{' '}
                    <span className="text-slate-500 text-[10px]">
                      (Opt {item.opt.min}–{item.opt.max})
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={val}
                  onChange={(e) => setNPK(item.key, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-950 rounded-lg"
                />
              </div>
            );
          })}
        </section>
      </div>
    </aside>
  );
};

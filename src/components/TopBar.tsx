import React, { useEffect } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { PLANT_SPECIES } from '../data/species';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Leaf,
  Gauge,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { SimulationSpeed } from '../types/simulation';

export const TopBar: React.FC = () => {
  const isRunning = useSimulationStore((s) => s.isRunning);
  const speed = useSimulationStore((s) => s.speed);
  const ageDays = useSimulationStore((s) => s.ageDays);
  const selectedSpeciesId = useSimulationStore((s) => s.selectedSpeciesId);
  const factorScores = useSimulationStore((s) => s.factorScores);

  const togglePlay = useSimulationStore((s) => s.togglePlay);
  const setSpeed = useSimulationStore((s) => s.setSpeed);
  const stepDay = useSimulationStore((s) => s.stepDay);
  const resetSimulation = useSimulationStore((s) => s.resetSimulation);
  const applyOptimalEnvironment = useSimulationStore((s) => s.applyOptimalEnvironment);

  const species = PLANT_SPECIES[selectedSpeciesId];

  // Tick-based simulation loop
  useEffect(() => {
    if (!isRunning) return;
    const intervalMs = speed === 1 ? 850 : speed === 5 ? 190 : 90;
    const timer = window.setInterval(() => {
      stepDay();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [isRunning, speed, stepDay]);

  const speeds: SimulationSpeed[] = [1, 5, 10];

  return (
    <header className="h-14 bg-slate-900/95 border-b border-slate-800 px-4 flex items-center justify-between gap-4 shrink-0 z-20">
      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-950/60 border border-emerald-400/30">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm sm:text-base tracking-tight text-white">
              BotanicaSim
            </h1>
            <span className="text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              v2.4 BioEngine
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Fruit Tree & Flowering Plant Ontogenetic Growth Simulator
          </p>
        </div>
      </div>

      {/* Center Simulation Engine Controls */}
      <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 px-2.5 py-1.5 rounded-xl shadow-inner">
        <button
          onClick={togglePlay}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            isRunning
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm shadow-amber-500/30'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm shadow-emerald-500/30'
          }`}
          title={isRunning ? 'Pause Simulation' : 'Start Simulation'}
        >
          {isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play</span>
            </>
          )}
        </button>

        <button
          onClick={stepDay}
          disabled={isRunning}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          title="Advance simulation by +1 Day"
        >
          <SkipForward className="w-3.5 h-3.5 text-emerald-400" />
          <span>+1 Day</span>
        </button>

        <div className="h-5 w-px bg-slate-800 mx-0.5" />

        {/* Speed Multiplier Selector */}
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
          <Gauge className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5 hidden md:block" />
          {speeds.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-1 rounded-md text-xs font-mono font-semibold transition-colors cursor-pointer ${
                speed === s
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-slate-800 mx-0.5" />

        <button
          onClick={resetSimulation}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-200 border border-slate-800 hover:border-rose-700/60 transition-colors cursor-pointer"
          title="Reset Specimen to Day 0 Seed"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>
      </div>

      {/* Right Quick Actions & Match Indicator */}
      <div className="flex items-center gap-3">
        <button
          onClick={applyOptimalEnvironment}
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-700/60 transition-colors cursor-pointer"
          title={`Set all sliders to ${species.name}'s optimal thresholds`}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Sync Optimal Climate</span>
        </button>

        <div className="flex items-center gap-2.5 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl">
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 leading-none">
              Env Match
            </div>
            <div
              className={`text-xs font-mono font-bold ${
                factorScores.overallMatch >= 80
                  ? 'text-emerald-400'
                  : factorScores.overallMatch >= 55
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {factorScores.overallMatch}%
            </div>
          </div>
          <div className="h-5 w-px bg-slate-800" />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 leading-none">
              Sim Clock
            </div>
            <div className="text-xs font-mono font-bold text-white">Day {ageDays}</div>
          </div>
        </div>
      </div>
    </header>
  );
};

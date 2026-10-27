import React, { useState } from 'react';
import { useSimulationStore } from '../store/useSimulationStore';
import { PLANT_SPECIES } from '../data/species';
import { LogType } from '../types/simulation';
import {
  Activity,
  Heart,
  TrendingUp,
  Calendar,
  Award,
  AlertCircle,
  Sparkles,
  Wrench,
  Terminal,
  CheckCircle2,
} from 'lucide-react';

export const TelemetryPanel: React.FC = () => {
  const [logFilter, setLogFilter] = useState<'all' | LogType>('all');

  const selectedSpeciesId = useSimulationStore((s) => s.selectedSpeciesId);
  const ageDays = useSimulationStore((s) => s.ageDays);
  const health = useSimulationStore((s) => s.health);
  const growthProgress = useSimulationStore((s) => s.growthProgress);
  const currentStage = useSimulationStore((s) => s.currentStage);
  const dailyGrowthRate = useSimulationStore((s) => s.dailyGrowthRate);
  const factorScores = useSimulationStore((s) => s.factorScores);
  const harvestCount = useSimulationStore((s) => s.harvestCount);
  const totalYieldKg = useSimulationStore((s) => s.totalYieldKg);
  const logs = useSimulationStore((s) => s.logs);
  const history = useSimulationStore((s) => s.history);

  const species = PLANT_SPECIES[selectedSpeciesId];

  const filteredLogs =
    logFilter === 'all' ? logs : logs.filter((entry) => entry.type === logFilter);

  // Build SVG polyline points for 60-day telemetry sparkline
  const chartW = 280;
  const chartH = 64;
  const ptsCount = Math.max(2, history.length);
  const healthPoints = history
    .map((h, i) => {
      const x = (i / (ptsCount - 1)) * chartW;
      const y = chartH - (h.health / 100) * (chartH - 10) - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const growthPoints = history
    .map((h, i) => {
      const x = (i / (ptsCount - 1)) * chartW;
      const y = chartH - (h.growthProgress / 100) * (chartH - 10) - 5;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const getLogBadgeStyle = (type: LogType) => {
    switch (type) {
      case 'milestone':
        return {
          bg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
          icon: <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
        };
      case 'stress':
        return {
          bg: 'bg-amber-500/15 border-amber-500/40 text-amber-200',
          icon: <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
        };
      case 'care':
        return {
          bg: 'bg-sky-500/15 border-sky-500/40 text-sky-200',
          icon: <Wrench className="w-3.5 h-3.5 text-sky-400 shrink-0" />,
        };
      case 'harvest':
        return {
          bg: 'bg-purple-500/20 border-purple-400/50 text-purple-200',
          icon: <Award className="w-3.5 h-3.5 text-purple-400 shrink-0" />,
        };
      default:
        return {
          bg: 'bg-slate-800/80 border-slate-700 text-slate-300',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
        };
    }
  };

  return (
    <aside className="w-80 xl:w-96 h-full bg-slate-900/65 border-l border-slate-800 flex flex-col overflow-hidden shrink-0 select-none">
      {/* Top Half: Vital Telemetry & Factor Breakdown */}
      <div className="p-3.5 space-y-3.5 border-b border-slate-800 overflow-y-auto max-h-[56%]">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Analytics & Bio-Telemetry</span>
          </h2>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded-full">
            LIVE STREAM
          </span>
        </div>

        {/* Vital Status Bars (Health & Growth Progress) */}
        <div className="space-y-2.5 bg-slate-900/90 border border-slate-800 rounded-xl p-3">
          {/* Plant Health Bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-medium text-slate-200">
                <Heart className="w-3.5 h-3.5 text-rose-400" />
                <span>Plant Health Score</span>
              </span>
              <span
                className={`font-mono font-bold ${
                  health >= 75
                    ? 'text-emerald-400'
                    : health >= 45
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {health.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  health >= 75
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                    : health >= 45
                    ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                    : 'bg-gradient-to-r from-rose-600 to-rose-400'
                }`}
                style={{ width: `${Math.max(2, health)}%` }}
              />
            </div>
          </div>

          {/* Growth Progress Bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 font-medium text-slate-200">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ontogenetic Growth</span>
              </span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-[10px] text-emerald-400/90">
                  +{dailyGrowthRate.toFixed(2)}%/d
                </span>
                <span className="font-bold text-white">{growthProgress.toFixed(1)}%</span>
              </div>
            </div>
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-teal-600 via-emerald-500 to-lime-400 transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(2, growthProgress)}%` }}
              />
            </div>
          </div>

          {/* Stage, Age & Harvest Yield KPI Grid */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <div className="bg-slate-950/90 border border-slate-800/80 rounded-lg p-2">
              <div className="text-[10px] text-slate-400 uppercase">Current Stage</div>
              <div className="text-xs font-bold text-emerald-300 truncate mt-0.5">
                {currentStage}
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800/80 rounded-lg p-2">
              <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <Calendar className="w-2.5 h-2.5" />
                <span>Age</span>
              </div>
              <div className="text-xs font-mono font-bold text-white mt-0.5">
                {ageDays} <span className="text-[10px] font-normal text-slate-400">days</span>
              </div>
            </div>
            <div className="bg-slate-950/90 border border-slate-800/80 rounded-lg p-2">
              <div className="text-[10px] text-slate-400 uppercase flex items-center gap-1">
                <Award className="w-2.5 h-2.5 text-amber-400" />
                <span>Yield</span>
              </div>
              <div className="text-xs font-mono font-bold text-amber-300 mt-0.5">
                {totalYieldKg} kg{' '}
                <span className="text-[10px] text-slate-500">({harvestCount}x)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Environmental Match Breakdown */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-300">
              Threshold Alignment vs {species.name}
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              {factorScores.overallMatch}% Match
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5 text-center">
            {[
              { label: 'H₂O', score: factorScores.waterScore },
              { label: 'Light', score: factorScores.sunlightScore },
              { label: 'Temp', score: factorScores.temperatureScore },
              { label: 'pH', score: factorScores.phScore },
              { label: 'NPK', score: factorScores.npkScore },
            ].map((f) => (
              <div
                key={f.label}
                className="bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-1"
              >
                <div className="text-[10px] text-slate-400">{f.label}</div>
                <div
                  className={`text-xs font-mono font-bold mt-0.5 ${
                    f.score >= 85
                      ? 'text-emerald-400'
                      : f.score >= 60
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {f.score}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 60-Day Telemetry Trend Sparkline */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span className="font-semibold uppercase tracking-wider">
              60-Day Trajectory
            </span>
            <div className="flex items-center gap-2.5 font-mono">
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-0.5 bg-rose-400 inline-block" /> Health
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-0.5 bg-emerald-400 inline-block" /> Growth
              </span>
            </div>
          </div>
          <svg
            viewBox={`0 0 ${chartW} ${chartH}`}
            className="w-full h-14 bg-slate-950/90 rounded-lg border border-slate-800/80 overflow-visible"
          >
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              points={growthPoints}
            />
            <polyline
              fill="none"
              stroke="#fb7185"
              strokeWidth="1.8"
              strokeDasharray="3 2"
              points={healthPoints}
            />
          </svg>
        </div>
      </div>

      {/* Bottom Half: Live Biological Event & Milestone Feed */}
      <div className="flex-1 flex flex-col min-h-0 p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Biological Event Feed</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">{logs.length} events</span>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 mb-2.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'milestone', label: 'Milestones' },
              { id: 'stress', label: 'Stress' },
              { id: 'care', label: 'Care' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setLogFilter(tab.id)}
              className={`flex-1 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                logFilter === tab.id
                  ? 'bg-slate-800 text-emerald-300 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Event Feed */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No events matching filter "{logFilter}".
            </div>
          ) : (
            filteredLogs.map((entry) => {
              const style = getLogBadgeStyle(entry.type);
              return (
                <div
                  key={entry.id}
                  className={`p-2.5 rounded-xl border text-xs transition-all ${style.bg}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <div className="flex items-center gap-1.5 font-semibold">
                      {style.icon}
                      <span>{entry.title}</span>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950/60 text-slate-300 shrink-0">
                      Day {entry.day}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed pl-5">
                    {entry.message}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};

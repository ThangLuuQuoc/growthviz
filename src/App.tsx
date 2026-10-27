import React from 'react';
import { TopBar } from './components/TopBar';
import { ControlPanel } from './components/ControlPanel';
import { PlantCanvas } from './components/PlantCanvas';
import { TelemetryPanel } from './components/TelemetryPanel';

export function App() {
  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      <TopBar />
      <main className="flex-1 flex min-h-0 overflow-hidden">
        <ControlPanel />
        <PlantCanvas />
        <TelemetryPanel />
      </main>
    </div>
  );
}

export default App;

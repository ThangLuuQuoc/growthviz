import React, { useState } from 'react';
import { TopBar } from './components/TopBar';
import { ControlPanel } from './components/ControlPanel';
import { PlantCanvas } from './components/PlantCanvas';
import { TelemetryPanel } from './components/TelemetryPanel';

export function App() {
  const [cinemaMode, setCinemaMode] = useState(false);

  return (
    <div className="h-screen w-screen flex flex-col bg-black text-slate-100 overflow-hidden">
      {!cinemaMode && <TopBar />}
      <main className="flex-1 flex min-h-0 overflow-hidden">
        {!cinemaMode && <ControlPanel />}
        <PlantCanvas
          cinemaMode={cinemaMode}
          onToggleCinemaMode={() => setCinemaMode((v) => !v)}
        />
        {!cinemaMode && <TelemetryPanel />}
      </main>
    </div>
  );
}

export default App;

import React, { useState, useEffect } from 'react';
import {
  X,
  Maximize,
  Minimize,
  Play,
  Square,
  Thermometer,
  Gauge,
  Fuel,
  Activity,
  Wind,
  Droplets,
  Sparkles,
} from 'lucide-react';
import { ObdTelemetry, ObdStreamPayload, LogSession } from '../types';
import { dataLoggingService } from '../services/dataLoggingService';

interface DrivingModeViewProps {
  telemetry: ObdTelemetry;
  currentPayload: ObdStreamPayload | null;
  unitSystem: 'metric' | 'imperial';
  onToggleUnit: () => void;
  onClose: () => void;
  isSimulated?: boolean;
  onOpenAnalysisModal?: (session?: LogSession | null) => void;
}

export const DrivingModeView: React.FC<DrivingModeViewProps> = ({
  telemetry,
  currentPayload,
  unitSystem,
  onToggleUnit,
  onClose,
  isSimulated = false,
  onOpenAnalysisModal,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoggingActive, setIsLoggingActive] = useState(dataLoggingService.isLogging());
  const [sampleCount, setSampleCount] = useState(dataLoggingService.getLiveSampleCount());
  const [loggingDuration, setLoggingDuration] = useState('00:00');
  const [density, setDensity] = useState<'fit' | 'compact' | 'normal'>('fit');
  const [lastStoppedSession, setLastStoppedSession] = useState<LogSession | null>(null);

  // Track logging status
  useEffect(() => {
    const unsub = dataLoggingService.subscribe((session, count) => {
      setIsLoggingActive(session !== null);
      setSampleCount(count);
    });
    return () => unsub();
  }, []);

  // Keyboard shortcut: Esc to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Update logging timer
  useEffect(() => {
    if (!isLoggingActive) return;
    const interval = setInterval(() => {
      const activeSession = dataLoggingService.getActiveSession();
      if (activeSession) {
        const elapsedSec = Math.floor((Date.now() - activeSession.startTime) / 1000);
        const mins = Math.floor(elapsedSec / 60).toString().padStart(2, '0');
        const secs = (elapsedSec % 60).toString().padStart(2, '0');
        setLoggingDuration(`${mins}:${secs}`);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isLoggingActive]);

  // Handle Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleToggleLogging = async () => {
    if (isLoggingActive) {
      const finished = await dataLoggingService.stopLogging();
      if (finished) {
        setLastStoppedSession(finished);
      }
    } else {
      await dataLoggingService.startLogging('Driving Mode Log', 'BMW B58 / OBD2');
    }
  };

  // Metric vs Imperial calculations
  const oilTempDisplay = unitSystem === 'metric' ? telemetry.b58OilTempC : telemetry.b58OilTempF;
  const coolantTempDisplay = unitSystem === 'metric' ? telemetry.coolantTempC : telemetry.coolantTempF;
  const iatDisplay = unitSystem === 'metric' ? telemetry.iatC : telemetry.iatF;
  const tempUnit = unitSystem === 'metric' ? '°C' : '°F';

  // Oil Pressure
  const oilPressDisplay = unitSystem === 'metric' ? telemetry.oilPressureBar.toFixed(2) : telemetry.oilPressurePsi.toFixed(1);
  const oilPressUnit = unitSystem === 'metric' ? 'BAR' : 'PSI';
  const oilPressSub = unitSystem === 'metric' ? `${telemetry.oilPressurePsi.toFixed(1)} PSI` : `${telemetry.oilPressureBar.toFixed(2)} Bar`;

  // MAP / Boost
  const mapMainVal = telemetry.boostPsi > 0.3 ? `+${telemetry.boostPsi.toFixed(1)}` : `${telemetry.mapPsi.toFixed(1)}`;
  const mapMainUnit = telemetry.boostPsi > 0.3 ? 'PSI BOOST' : 'PSI MAP';
  const mapSub = `${telemetry.mapKpa} kPa`;

  const hz = currentPayload?.metrics.loopHz ?? 0;

  return (
    <div
      id="driving-mode-container"
      className="fixed inset-0 z-50 bg-[#030406] text-white flex flex-col select-none overflow-hidden font-mono"
      style={{
        height: '100dvh', // Use dynamic viewport height for mobile browser URL bars
        width: '100vw',
      }}
    >
      {/* Top Ultra-Compact Driving Mode Toolbar */}
      <header className="h-10 sm:h-12 px-3 sm:px-5 bg-zinc-950/95 border-b border-zinc-800/80 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse" />
            <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-white font-sans truncate">
              DRIVING MODE
            </span>
          </div>

          <div className="hidden xs:flex sm:flex items-center gap-1.5 pl-2 border-l border-zinc-800 text-[10px] sm:text-xs">
            <span className="px-1.5 py-0.5 rounded-sm bg-zinc-900 border border-zinc-800 text-zinc-400 truncate max-w-[100px] sm:max-w-none">
              {isSimulated ? 'VIRTUAL DME' : (currentPayload?.device.name || 'BLE OBD2')}
            </span>
            <span className="px-1.5 py-0.5 rounded-sm bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 font-bold">
              {hz.toFixed(1)} Hz
            </span>
          </div>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Logging Button / Status */}
          <button
            id="driving-mode-log-toggle"
            onClick={handleToggleLogging}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-sm text-[10px] sm:text-xs font-bold uppercase transition-all cursor-pointer border ${
              isLoggingActive
                ? 'bg-rose-950/70 border-rose-500 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-pulse'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-750 text-zinc-300 hover:text-white'
            }`}
          >
            {isLoggingActive ? (
              <>
                <Square className="w-3 h-3 fill-rose-500 text-rose-500 shrink-0" />
                <span className="truncate">REC {loggingDuration} <span className="hidden md:inline">({sampleCount})</span></span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-emerald-500 text-emerald-500 shrink-0" />
                <span>START LOG</span>
              </>
            )}
          </button>

          {/* Analyze with AI Tuner Button (when log stopped or available) */}
          {lastStoppedSession && onOpenAnalysisModal && (
            <button
              id="driving-mode-ai-analyze-btn"
              onClick={() => onOpenAnalysisModal(lastStoppedSession)}
              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-sm bg-gradient-to-r from-cyan-950 to-indigo-950 hover:from-cyan-900 hover:to-indigo-900 border border-cyan-500/70 text-cyan-300 text-[10px] sm:text-xs font-bold uppercase transition-all cursor-pointer shadow-[0_0_8px_rgba(6,182,212,0.3)] animate-pulse"
              title="Analyze finished log with Gemini AI performance tuner"
            >
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>AI TUNER</span>
            </button>
          )}

          {/* Density toggle */}
          <button
            id="driving-mode-density-toggle"
            onClick={() => setDensity((d) => (d === 'fit' ? 'compact' : d === 'compact' ? 'normal' : 'fit'))}
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-400 hover:text-white transition-all cursor-pointer uppercase font-bold"
            title="Switch Size Mode (Auto Fit / Compact / Standard)"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>{density.toUpperCase()}</span>
          </button>

          {/* Unit Switcher */}
          <button
            id="driving-mode-unit-toggle"
            onClick={onToggleUnit}
            className="px-2 sm:px-2.5 py-1 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] sm:text-xs text-zinc-300 hover:text-white transition-all cursor-pointer font-bold uppercase"
            title="Toggle Metric / Imperial Units"
          >
            {unitSystem === 'metric' ? '°C' : '°F'}
          </button>

          {/* Fullscreen Button */}
          <button
            id="driving-mode-fullscreen-toggle"
            onClick={toggleFullscreen}
            className="p-1 sm:p-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>

          {/* Exit Driving Mode Button */}
          <button
            id="driving-mode-exit-btn"
            onClick={onClose}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-sm bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 text-[10px] sm:text-xs font-bold uppercase transition-all cursor-pointer"
            title="Exit Driving Mode (Esc)"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">EXIT</span>
          </button>
        </div>
      </header>

      {/* 6 Landscape Tiles Grid - Fluid Auto-Fitting Container */}
      <main className="flex-1 min-h-0 w-full p-1.5 sm:p-2.5 md:p-3.5 grid grid-cols-2 landscape:grid-cols-3 sm:grid-cols-2 md:landscape:grid-cols-3 grid-rows-3 landscape:grid-rows-2 sm:grid-rows-3 md:landscape:grid-rows-2 gap-1.5 sm:gap-2.5 md:gap-3 overflow-hidden">
        
        {/* Tile 1: Intake Pressure / MAP */}
        <div
          id="driving-tile-map"
          className="relative bg-zinc-950/90 border border-zinc-800/90 hover:border-cyan-500/40 rounded-sm p-1.5 sm:p-2.5 md:p-3 flex flex-col justify-between overflow-hidden shadow-md min-h-0"
        >
          <div className="flex items-center justify-between gap-1 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 text-cyan-400 truncate">
              <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-300 truncate">
                MAP / BOOST
              </span>
            </div>
            <span className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-500 shrink-0">
              010B
            </span>
          </div>

          <div className="my-auto flex flex-col items-center justify-center py-0.5 text-center min-h-0">
            <div className="text-[clamp(1.4rem,4.5vh+1.5vw,3.8rem)] font-black text-cyan-400 leading-none tracking-tight font-sans">
              {mapMainVal}
            </div>
            <div className="text-[9px] sm:text-[11px] md:text-xs font-bold text-cyan-500/90 uppercase tracking-wider mt-0.5 sm:mt-1">
              {mapMainUnit}
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-xs text-zinc-500 border-t border-zinc-900/90 pt-1 shrink-0">
            <span className="truncate">{mapSub}</span>
            <span className="text-cyan-400 font-medium truncate">
              {telemetry.boostPsi > 0.3 ? `${telemetry.boostPsi.toFixed(1)} PSI Boost` : 'Vacuum'}
            </span>
          </div>
        </div>

        {/* Tile 2: Oil Temperature */}
        <div
          id="driving-tile-oil-temp"
          className="relative bg-zinc-950/90 border border-zinc-800/90 hover:border-amber-500/40 rounded-sm p-1.5 sm:p-2.5 md:p-3 flex flex-col justify-between overflow-hidden shadow-md min-h-0"
        >
          <div className="flex items-center justify-between gap-1 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 text-amber-400 truncate">
              <Thermometer className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-300 truncate">
                OIL TEMP
              </span>
            </div>
            <span className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded bg-zinc-900/80 border border-zinc-800 text-amber-500/80 shrink-0">
              222020
            </span>
          </div>

          <div className="my-auto flex flex-col items-center justify-center py-0.5 text-center min-h-0">
            <div className={`text-[clamp(1.4rem,4.5vh+1.5vw,3.8rem)] font-black leading-none tracking-tight font-sans ${
              telemetry.b58OilTempC > 115 ? 'text-rose-400 animate-pulse' : 'text-amber-400'
            }`}>
              {oilTempDisplay}
              <span className="text-[clamp(0.9rem,2.2vh,1.8rem)] ml-0.5 text-zinc-500 font-normal">{tempUnit}</span>
            </div>
            <div className="text-[9px] sm:text-[11px] md:text-xs font-bold text-amber-500/90 uppercase tracking-wider mt-0.5 sm:mt-1">
              B58 OIL TEMP
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-xs text-zinc-500 border-t border-zinc-900/90 pt-1 shrink-0">
            <span className="truncate">95-105{tempUnit} Target</span>
            <span className={`font-medium truncate ${
              telemetry.b58OilTempC > 115 ? 'text-rose-400' : telemetry.b58OilTempC > 105 ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {telemetry.b58OilTempC > 115 ? 'HIGH' : telemetry.b58OilTempC < 80 ? 'WARMUP' : 'OPTIMAL'}
            </span>
          </div>
        </div>

        {/* Tile 3: Ethanol Content */}
        <div
          id="driving-tile-ethanol"
          className="relative bg-zinc-950/90 border border-zinc-800/90 hover:border-emerald-500/40 rounded-sm p-1.5 sm:p-2.5 md:p-3 flex flex-col justify-between overflow-hidden shadow-md min-h-0"
        >
          <div className="flex items-center justify-between gap-1 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 text-emerald-400 truncate">
              <Fuel className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-300 truncate">
                ETHANOL
              </span>
            </div>
            <span className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded bg-zinc-900/80 border border-zinc-800 text-emerald-500/80 shrink-0">
              22202B
            </span>
          </div>

          <div className="my-auto flex flex-col items-center justify-center py-0.5 text-center min-h-0">
            <div className="text-[clamp(1.4rem,4.5vh+1.5vw,3.8rem)] font-black text-emerald-400 leading-none tracking-tight font-sans">
              {telemetry.ethanolPct.toFixed(1)}
              <span className="text-[clamp(0.9rem,2.2vh,1.8rem)] ml-0.5 text-zinc-500 font-normal">%</span>
            </div>
            <div className="text-[9px] sm:text-[11px] md:text-xs font-bold text-emerald-500/90 uppercase tracking-wider mt-0.5 sm:mt-1">
              E{Math.round(telemetry.ethanolPct)} BLEND
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-xs text-zinc-500 border-t border-zinc-900/90 pt-1 shrink-0">
            <span className="truncate">Flex Fuel</span>
            <span className="text-emerald-400 font-medium truncate">DME Synced</span>
          </div>
        </div>

        {/* Tile 4: Intake Air Temp (IAT) */}
        <div
          id="driving-tile-iat"
          className="relative bg-zinc-950/90 border border-zinc-800/90 hover:border-blue-500/40 rounded-sm p-1.5 sm:p-2.5 md:p-3 flex flex-col justify-between overflow-hidden shadow-md min-h-0"
        >
          <div className="flex items-center justify-between gap-1 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 text-blue-400 truncate">
              <Wind className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-300 truncate">
                INTAKE AIR (IAT)
              </span>
            </div>
            <span className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-500 shrink-0">
              010F
            </span>
          </div>

          <div className="my-auto flex flex-col items-center justify-center py-0.5 text-center min-h-0">
            <div className="text-[clamp(1.4rem,4.5vh+1.5vw,3.8rem)] font-black text-blue-400 leading-none tracking-tight font-sans">
              {iatDisplay}
              <span className="text-[clamp(0.9rem,2.2vh,1.8rem)] ml-0.5 text-zinc-500 font-normal">{tempUnit}</span>
            </div>
            <div className="text-[9px] sm:text-[11px] md:text-xs font-bold text-blue-500/90 uppercase tracking-wider mt-0.5 sm:mt-1">
              CHARGE TEMP
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-xs text-zinc-500 border-t border-zinc-900/90 pt-1 shrink-0">
            <span className="truncate">Intercooler</span>
            <span className={`font-medium truncate ${telemetry.iatC > 50 ? 'text-rose-400' : telemetry.iatC > 40 ? 'text-amber-400' : 'text-blue-400'}`}>
              {telemetry.iatC > 50 ? 'HEAT SOAK' : 'NOMINAL'}
            </span>
          </div>
        </div>

        {/* Tile 5: Coolant Temp (ECT) */}
        <div
          id="driving-tile-coolant"
          className="relative bg-zinc-950/90 border border-zinc-800/90 hover:border-purple-500/40 rounded-sm p-1.5 sm:p-2.5 md:p-3 flex flex-col justify-between overflow-hidden shadow-md min-h-0"
        >
          <div className="flex items-center justify-between gap-1 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 text-purple-400 truncate">
              <Droplets className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-300 truncate">
                COOLANT (ECT)
              </span>
            </div>
            <span className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-500 shrink-0">
              0105
            </span>
          </div>

          <div className="my-auto flex flex-col items-center justify-center py-0.5 text-center min-h-0">
            <div className={`text-[clamp(1.4rem,4.5vh+1.5vw,3.8rem)] font-black leading-none tracking-tight font-sans ${
              telemetry.coolantTempC > 108 ? 'text-rose-400 animate-pulse' : 'text-purple-400'
            }`}>
              {coolantTempDisplay}
              <span className="text-[clamp(0.9rem,2.2vh,1.8rem)] ml-0.5 text-zinc-500 font-normal">{tempUnit}</span>
            </div>
            <div className="text-[9px] sm:text-[11px] md:text-xs font-bold text-purple-500/90 uppercase tracking-wider mt-0.5 sm:mt-1">
              ENGINE COOLANT
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-xs text-zinc-500 border-t border-zinc-900/90 pt-1 shrink-0">
            <span className="truncate">88-102{tempUnit}</span>
            <span className={`font-medium truncate ${telemetry.coolantTempC > 105 ? 'text-rose-400' : 'text-purple-400'}`}>
              {telemetry.coolantTempC > 105 ? 'HOT' : 'STABLE'}
            </span>
          </div>
        </div>

        {/* Tile 6: Oil Pressure */}
        <div
          id="driving-tile-oil-pressure"
          className="relative bg-zinc-950/90 border border-zinc-800/90 hover:border-rose-500/40 rounded-sm p-1.5 sm:p-2.5 md:p-3 flex flex-col justify-between overflow-hidden shadow-md min-h-0"
        >
          <div className="flex items-center justify-between gap-1 shrink-0">
            <div className="flex items-center gap-1 sm:gap-1.5 text-rose-400 truncate">
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wider text-zinc-300 truncate">
                OIL PRESSURE
              </span>
            </div>
            <span className="text-[8px] sm:text-[9px] px-1 py-0.2 rounded bg-zinc-900/80 border border-zinc-800 text-rose-500/80 shrink-0">
              222026
            </span>
          </div>

          <div className="my-auto flex flex-col items-center justify-center py-0.5 text-center min-h-0">
            <div className={`text-[clamp(1.4rem,4.5vh+1.5vw,3.8rem)] font-black leading-none tracking-tight font-sans ${
              telemetry.oilPressureBar < 1.2 && telemetry.rpm > 1000 ? 'text-rose-500 animate-pulse' : 'text-rose-400'
            }`}>
              {oilPressDisplay}
              <span className="text-[clamp(0.9rem,2.2vh,1.8rem)] ml-0.5 text-zinc-500 font-normal">{oilPressUnit}</span>
            </div>
            <div className="text-[9px] sm:text-[11px] md:text-xs font-bold text-rose-500/90 uppercase tracking-wider mt-0.5 sm:mt-1">
              MAIN GALLERY
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-[10px] md:text-xs text-zinc-500 border-t border-zinc-900/90 pt-1 shrink-0">
            <span className="truncate">{oilPressSub}</span>
            <span className={`font-medium truncate ${telemetry.oilPressureBar < 1.3 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {telemetry.oilPressureBar < 1.2 ? 'LOW' : 'HEALTHY'}
            </span>
          </div>
        </div>

      </main>

      {/* Bottom Ultra-Compact Status Strip with RPM & Speed */}
      <footer className="h-7 sm:h-8 px-3 sm:px-5 bg-zinc-950/95 border-t border-zinc-800/80 flex items-center justify-between text-[10px] sm:text-xs text-zinc-400 shrink-0 z-10">
        <div className="flex items-center gap-3 sm:gap-5">
          <span>RPM: <strong className="text-white font-mono">{telemetry.rpm.toLocaleString()}</strong></span>
          <span>SPEED: <strong className="text-white font-mono">{unitSystem === 'metric' ? `${telemetry.speedKmh} km/h` : `${telemetry.speedMph} mph`}</strong></span>
        </div>
        <div className="text-zinc-500 text-[10px] hidden md:block tracking-wider">
          PRESS <kbd className="px-1 py-0.2 bg-zinc-900 border border-zinc-800 rounded text-zinc-400 font-mono">ESC</kbd> OR TAP EXIT
        </div>
      </footer>
    </div>
  );
};

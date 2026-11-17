/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Gauge,
  Activity,
  Flame,
  Thermometer,
  Wind,
  Fuel,
  Zap,
  Sparkles,
  Terminal,
  Cpu,
  Layers,
  Settings2,
  Compass,
  AlertCircle,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  Car,
  Sliders,
  BatteryCharging,
  Timer,
  Droplets,
  BarChart3,
} from 'lucide-react';
import { ConnectionState, ObdStreamPayload, ObdTelemetry, LogEntry, LogSession, PidConfigItem } from './types';
import { obd2Service } from './services/obd2BleService';
import { simulationEngine } from './services/simulationEngine';
import { dataLoggingService } from './services/dataLoggingService';
import { pidConfigService } from './services/pidConfigService';
import { GaugeCard } from './components/GaugeCard';
import { ConnectionPanel } from './components/ConnectionPanel';
import { DataLoggerPanel } from './components/DataLoggerPanel';
import { TelemetryCharts } from './components/TelemetryCharts';
import { DtcScannerPanel } from './components/DtcScannerPanel';
import { TerminalConsole } from './components/TerminalConsole';
import { PidConfigModal } from './components/PidConfigModal';
import { SingleFileExportModal } from './components/SingleFileExportModal';
import { LogSessionsModal } from './components/LogSessionsModal';
import { DrivingModeView } from './components/DrivingModeView';
import { AiTuningConsoleModal } from './components/AiTuningConsoleModal';

const MAX_LOG_ENTRIES = 3000;

/** Append a log entry; when over the cap, drop the oldest TX/RX chatter first so errors/system messages survive. */
function appendLog(prev: LogEntry[], entry: LogEntry): LogEntry[] {
  const next = [...prev, entry];
  const over = next.length - MAX_LOG_ENTRIES;
  if (over <= 0) return next;
  let removed = 0;
  const trimmed = next.filter((e) => {
    if (removed < over && (e.type === 'tx' || e.type === 'rx')) {
      removed++;
      return false;
    }
    return true;
  });
  return trimmed.length > MAX_LOG_ENTRIES ? trimmed.slice(-MAX_LOG_ENTRIES) : trimmed;
}

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [telemetry, setTelemetry] = useState<ObdTelemetry>(obd2Service.getTelemetry());
  const [streamPayload, setStreamPayload] = useState<ObdStreamPayload | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSimulated, setIsSimulated] = useState(false);
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  const [uptimeSeconds, setUptimeSeconds] = useState(15);
  const [pidConfigs, setPidConfigs] = useState<PidConfigItem[]>(pidConfigService.getPids());
  const [gaugeCategoryFilter, setGaugeCategoryFilter] = useState<'all' | 'standard' | 'b58'>('all');
  
  // Navigation View Tabs: 'gauges' | 'graphs' | 'dtc'
  const [activeMainTab, setActiveMainTab] = useState<'gauges' | 'graphs' | 'dtc'>('gauges');
  const [isDrivingModeOpen, setIsDrivingModeOpen] = useState(false);

  // Modals
  const [isPidModalOpen, setIsPidModalOpen] = useState(false);
  const [editingPidId, setEditingPidId] = useState<string | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
  const [selectedAnalysisSession, setSelectedAnalysisSession] = useState<LogSession | null>(null);
  
  // Data Logging state
  const [activeLogSession, setActiveLogSession] = useState<LogSession | null>(null);
  const [liveSampleCount, setLiveSampleCount] = useState<number>(0);

  const handleOpenAnalysisModal = useCallback(async (sessionToAnalyze?: LogSession | null) => {
    if (sessionToAnalyze) {
      setSelectedAnalysisSession(sessionToAnalyze);
      setIsAnalysisModalOpen(true);
    } else {
      const latest = await dataLoggingService.getLatestSession();
      if (latest) {
        setSelectedAnalysisSession(latest);
        setIsAnalysisModalOpen(true);
      } else {
        setIsSessionsModalOpen(true);
      }
    }
  }, []);

  // Register service callbacks & logger listener
  useEffect(() => {
    const unsubPids = pidConfigService.subscribe((updated) => {
      setPidConfigs(updated);
    });

    const unsubLogger = dataLoggingService.subscribe((session, count) => {
      setActiveLogSession(session);
      setLiveSampleCount(count);
    });

    obd2Service.setCallbacks(
      (state) => setConnectionState(state),
      (currentTelemetry, payload) => {
        setTelemetry({ ...currentTelemetry });
        setStreamPayload(payload);
        // Record into data logging service if active
        dataLoggingService.recordPayload(payload);
      },
      (logEntry) => {
        setLogs((prev) => appendLog(prev, logEntry));
      }
    );

    const timer = setInterval(() => {
      setUptimeSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      unsubPids();
      unsubLogger();
      clearInterval(timer);
      simulationEngine.stop();
      obd2Service.destroy();
    };
  }, []);

  const formatUptime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `00:${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleToggleSimulation = useCallback(() => {
    if (isSimulated) {
      simulationEngine.stop();
      setIsSimulated(false);
      setConnectionState('disconnected');
    } else {
      if (connectionState === 'polling' || connectionState === 'connected') {
        obd2Service.disconnect();
      }
      setIsSimulated(true);
      setConnectionState('polling');
      simulationEngine.start();
    }
  }, [isSimulated, connectionState]);

  const handleClearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const handleAddLogEntry = useCallback((type: LogEntry['type'], text: string) => {
    setLogs((prev) =>
      appendLog(prev, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        type,
        text,
      })
    );
  }, []);

  const handleOpenPidEditor = useCallback((pidId: string | null = null) => {
    setEditingPidId(pidId);
    setIsPidModalOpen(true);
  }, []);

  const isLive = connectionState === 'polling' || connectionState === 'connected' || isSimulated;

  const renderPidGauge = (pid: PidConfigItem) => {
    const isMetric = unitSystem === 'metric';
    const openEdit = () => handleOpenPidEditor(pid.id);

    let value = telemetry.customValues[pid.id] ?? 0;
    let unit = pid.unit;
    let secondaryValue: number | string | undefined = undefined;
    let secondaryUnit: string | undefined = undefined;
    let min = pid.min;
    let max = pid.max;
    let warningThreshold = pid.warningThreshold;
    let dangerThreshold = pid.dangerThreshold;
    let decimals: number | undefined = undefined;
    let icon: React.ReactNode = <Gauge className="w-4 h-4" />;

    switch (pid.id) {
      case 'rpm':
        value = telemetry.rpm;
        icon = <Activity className="w-4 h-4" />;
        break;
      case 'speed':
        value = isMetric ? telemetry.speedKmh : telemetry.speedMph;
        unit = isMetric ? 'km/h' : 'MPH';
        secondaryValue = isMetric ? telemetry.speedMph : telemetry.speedKmh;
        secondaryUnit = isMetric ? 'mph' : 'km/h';
        min = isMetric ? (pid.min ?? 0) : (pid.imperialMin ?? 0);
        max = isMetric ? (pid.max ?? 260) : (pid.imperialMax ?? 160);
        icon = <Compass className="w-4 h-4" />;
        break;
      case 'map':
        value = telemetry.boostPsi;
        unit = 'PSI Boost';
        secondaryValue = telemetry.mapKpa;
        secondaryUnit = 'kPa MAP';
        icon = <Wind className="w-4 h-4" />;
        break;
      case 'coolant':
        value = isMetric ? telemetry.coolantTempC : telemetry.coolantTempF;
        unit = isMetric ? '°C' : '°F';
        secondaryValue = isMetric ? telemetry.coolantTempF : telemetry.coolantTempC;
        secondaryUnit = isMetric ? '°F' : '°C';
        min = isMetric ? pid.min : (pid.imperialMin ?? 32);
        max = isMetric ? pid.max : (pid.imperialMax ?? 260);
        warningThreshold = isMetric ? pid.warningThreshold : pid.imperialWarningThreshold;
        dangerThreshold = isMetric ? pid.dangerThreshold : pid.imperialDangerThreshold;
        icon = <Thermometer className="w-4 h-4" />;
        break;
      case 'iat':
        value = isMetric ? telemetry.iatC : telemetry.iatF;
        unit = isMetric ? '°C' : '°F';
        secondaryValue = isMetric ? telemetry.iatF : telemetry.iatC;
        secondaryUnit = isMetric ? '°F' : '°C';
        min = isMetric ? pid.min : (pid.imperialMin ?? 14);
        max = isMetric ? pid.max : (pid.imperialMax ?? 176);
        warningThreshold = isMetric ? pid.warningThreshold : pid.imperialWarningThreshold;
        dangerThreshold = isMetric ? pid.dangerThreshold : pid.imperialDangerThreshold;
        icon = <Wind className="w-4 h-4" />;
        break;
      case 'oil_temp':
        value = isMetric ? telemetry.b58OilTempC : telemetry.b58OilTempF;
        unit = isMetric ? '°C' : '°F';
        secondaryValue = isMetric ? telemetry.b58OilTempF : telemetry.b58OilTempC;
        secondaryUnit = isMetric ? '°F' : '°C';
        min = isMetric ? pid.min : (pid.imperialMin ?? 100);
        max = isMetric ? pid.max : (pid.imperialMax ?? 280);
        warningThreshold = isMetric ? pid.warningThreshold : pid.imperialWarningThreshold;
        dangerThreshold = isMetric ? pid.dangerThreshold : pid.imperialDangerThreshold;
        icon = <Flame className="w-4 h-4" />;
        break;
      case 'ethanol':
        value = telemetry.ethanolPct;
        secondaryValue = `E${Math.round(telemetry.ethanolPct)}`;
        secondaryUnit = 'Blend';
        icon = <Fuel className="w-4 h-4" />;
        break;
      case 'oil_pressure':
        value = isMetric ? telemetry.oilPressureBar : telemetry.oilPressurePsi;
        unit = isMetric ? 'Bar' : 'PSI';
        secondaryValue = isMetric ? `${telemetry.oilPressurePsi.toFixed(1)} PSI` : `${telemetry.oilPressureBar.toFixed(2)} Bar`;
        secondaryUnit = '';
        min = isMetric ? pid.min : (pid.imperialMin ?? 0);
        max = isMetric ? pid.max : (pid.imperialMax ?? 100);
        decimals = isMetric ? 2 : 1;
        icon = <Droplets className="w-4 h-4" />;
        break;
      case 'engine_load':
        value = telemetry.engineLoadPct;
        icon = <BarChart3 className="w-4 h-4" />;
        break;
      case 'throttle':
        value = telemetry.throttlePct;
        icon = <Gauge className="w-4 h-4" />;
        break;
      case 'timing_advance':
        value = telemetry.timingAdvanceDeg;
        secondaryUnit = 'BTDC';
        secondaryValue = '';
        icon = <Zap className="w-4 h-4" />;
        break;
      case 'maf':
        value = telemetry.mafGps;
        icon = <Wind className="w-4 h-4" />;
        break;
      case 'lambda_afr':
        value = telemetry.afr;
        unit = 'AFR';
        secondaryValue = `λ ${telemetry.lambda.toFixed(2)}`;
        secondaryUnit = '';
        decimals = 2;
        icon = <Flame className="w-4 h-4" />;
        break;
      case 'hpfp_pressure':
        value = isMetric ? telemetry.hpfpBar : telemetry.hpfpPsi;
        unit = isMetric ? 'Bar' : 'PSI';
        secondaryValue = isMetric ? `${telemetry.hpfpPsi} PSI` : `${telemetry.hpfpBar.toFixed(1)} Bar`;
        secondaryUnit = '';
        min = isMetric ? pid.min : (pid.imperialMin ?? 0);
        max = isMetric ? pid.max : (pid.imperialMax ?? 5000);
        icon = <Fuel className="w-4 h-4" />;
        break;
      case 'stft':
        value = telemetry.stftPct;
        secondaryValue = 'Bank 1';
        secondaryUnit = '';
        icon = <Activity className="w-4 h-4" />;
        break;
      case 'ltft':
        value = telemetry.ltftPct;
        secondaryValue = 'Bank 1';
        secondaryUnit = '';
        icon = <Activity className="w-4 h-4" />;
        break;
      case 'voltage':
        value = telemetry.controlModuleVoltage;
        decimals = 2;
        icon = <BatteryCharging className="w-4 h-4" />;
        break;
      case 'pedal_pos':
        value = telemetry.pedalPosPct;
        icon = <Gauge className="w-4 h-4" />;
        break;
      case 'abs_load':
        value = telemetry.absLoadPct;
        icon = <BarChart3 className="w-4 h-4" />;
        break;
      case 'fuel_level':
        value = telemetry.fuelLevelPct;
        icon = <Fuel className="w-4 h-4" />;
        break;
      case 'ambient_temp':
        value = isMetric ? telemetry.ambientTempC : telemetry.ambientTempF;
        unit = isMetric ? '°C' : '°F';
        secondaryValue = isMetric ? telemetry.ambientTempF : telemetry.ambientTempC;
        secondaryUnit = isMetric ? '°F' : '°C';
        min = isMetric ? pid.min : (pid.imperialMin ?? -4);
        max = isMetric ? pid.max : (pid.imperialMax ?? 130);
        icon = <Thermometer className="w-4 h-4" />;
        break;
      case 'baro_pressure':
        value = isMetric ? telemetry.baroKpa : telemetry.baroPsi;
        unit = isMetric ? 'kPa' : 'PSI';
        secondaryValue = isMetric ? `${telemetry.baroPsi.toFixed(1)} PSI` : `${telemetry.baroKpa} kPa`;
        secondaryUnit = '';
        min = isMetric ? pid.min : (pid.imperialMin ?? 10);
        max = isMetric ? pid.max : (pid.imperialMax ?? 16);
        icon = <Compass className="w-4 h-4" />;
        break;
      case 'cat_temp':
        value = isMetric ? telemetry.catTempC : telemetry.catTempF;
        unit = isMetric ? '°C' : '°F';
        secondaryValue = isMetric ? telemetry.catTempF : telemetry.catTempC;
        secondaryUnit = isMetric ? '°F' : '°C';
        min = isMetric ? pid.min : (pid.imperialMin ?? 212);
        max = isMetric ? pid.max : (pid.imperialMax ?? 1832);
        warningThreshold = isMetric ? pid.warningThreshold : pid.imperialWarningThreshold;
        dangerThreshold = isMetric ? pid.dangerThreshold : pid.imperialDangerThreshold;
        icon = <Flame className="w-4 h-4" />;
        break;
      case 'charge_air_temp':
        value = isMetric ? telemetry.chargeAirTempC : telemetry.chargeAirTempF;
        unit = isMetric ? '°C' : '°F';
        secondaryValue = isMetric ? telemetry.chargeAirTempF : telemetry.chargeAirTempC;
        secondaryUnit = isMetric ? '°F' : '°C';
        min = isMetric ? pid.min : (pid.imperialMin ?? 32);
        max = isMetric ? pid.max : (pid.imperialMax ?? 194);
        warningThreshold = isMetric ? pid.warningThreshold : pid.imperialWarningThreshold;
        dangerThreshold = isMetric ? pid.dangerThreshold : pid.imperialDangerThreshold;
        icon = <Wind className="w-4 h-4" />;
        break;
      case 'trans_temp':
        value = isMetric ? telemetry.transTempC : telemetry.transTempF;
        unit = isMetric ? '°C' : '°F';
        secondaryValue = isMetric ? telemetry.transTempF : telemetry.transTempC;
        secondaryUnit = isMetric ? '°F' : '°C';
        min = isMetric ? pid.min : (pid.imperialMin ?? 68);
        max = isMetric ? pid.max : (pid.imperialMax ?? 284);
        warningThreshold = isMetric ? pid.warningThreshold : pid.imperialWarningThreshold;
        dangerThreshold = isMetric ? pid.dangerThreshold : pid.imperialDangerThreshold;
        icon = <Thermometer className="w-4 h-4" />;
        break;
      case 'run_time':
        value = telemetry.runTimeSec;
        secondaryValue = `${Math.floor(telemetry.runTimeSec / 60)}m ${telemetry.runTimeSec % 60}s`;
        secondaryUnit = '';
        icon = <Timer className="w-4 h-4" />;
        break;
      default:
        value = telemetry.customValues[pid.id] ?? 0;
        break;
    }

    return (
      <GaugeCard
        key={pid.id}
        id={`gauge-${pid.id}`}
        title={pid.name}
        value={value}
        unit={unit}
        secondaryValue={secondaryValue}
        secondaryUnit={secondaryUnit}
        min={min}
        max={max}
        pid={pid.command}
        category={pid.category}
        warningThreshold={warningThreshold}
        dangerThreshold={dangerThreshold}
        accentColor={pid.accentColor || (pid.category === 'b58' ? 'amber' : 'cyan')}
        icon={icon}
        decimals={decimals}
        onEditPid={openEdit}
      />
    );
  };

  const enabledPids = pidConfigs.filter((p) => p.enabled);
  const visiblePids = enabledPids.filter((p) =>
    gaugeCategoryFilter === 'all' ? true : p.category === gaugeCategoryFilter
  );

  return (
    <div className="min-h-screen bg-[#050608] text-zinc-300 font-sans pb-12 flex flex-col">
      {/* Top Header Bar */}
      <header className="border-b border-zinc-800 bg-[#050608]/90 backdrop-blur-md px-4 sm:px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-widest text-white uppercase font-sans flex items-center">
                OBD2 Core Relay
                <span className="text-zinc-500 font-normal ml-2 text-xs sm:text-sm font-mono">v2.4.0</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 justify-between sm:justify-end">
            {/* Driving Mode Button */}
            <button
              id="open-driving-mode-btn"
              onClick={() => setIsDrivingModeOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-gradient-to-r from-cyan-950/80 to-emerald-950/80 hover:from-cyan-900 hover:to-emerald-900 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 hover:text-white font-mono text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)] cursor-pointer"
              title="Open uncluttered landscape Driving Mode for in-car display"
            >
              <Car className="w-3.5 h-3.5 text-cyan-400" />
              <span>Driving Mode</span>
            </button>

            <div className="text-left sm:text-right font-mono hidden md:block">
              <p className="text-[10px] uppercase tracking-tighter text-zinc-500 font-bold">Broadcast Channel</p>
              <p className="text-xs font-mono text-cyan-400 font-semibold">obd2_telemetry_stream</p>
            </div>

            <div className="h-6 w-[1px] bg-zinc-800 hidden sm:block"></div>

            {/* Metric / Imperial toggle */}
            <div className="flex bg-zinc-950 p-1 rounded-sm border border-zinc-800 text-xs font-mono">
              <button
                onClick={() => setUnitSystem('metric')}
                className={`px-2.5 py-1 rounded-sm transition-all cursor-pointer font-bold text-[10px] uppercase tracking-wider ${
                  unitSystem === 'metric'
                    ? 'bg-zinc-900 text-cyan-400 border border-zinc-700 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Metric (°C)
              </button>
              <button
                onClick={() => setUnitSystem('imperial')}
                className={`px-2.5 py-1 rounded-sm transition-all cursor-pointer font-bold text-[10px] uppercase tracking-wider ${
                  unitSystem === 'imperial'
                    ? 'bg-zinc-900 text-cyan-400 border border-zinc-700 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                US (°F)
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex-1 flex flex-col gap-6 w-full">
        {/* Connection Control Center */}
        <ConnectionPanel
          connectionState={connectionState}
          streamPayload={streamPayload}
          isSimulated={isSimulated}
          onToggleSimulation={handleToggleSimulation}
          onOpenPidConfig={() => handleOpenPidEditor(null)}
          onOpenExport={() => setIsExportModalOpen(true)}
        />

        {/* High-Frequency Data Logger Bar */}
        <DataLoggerPanel
          isLive={isLive}
          onOpenSessionsModal={() => setIsSessionsModalOpen(true)}
          onOpenAnalysisModal={handleOpenAnalysisModal}
        />

        {/* Primary View Navigation Tabs */}
        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-sm border border-zinc-800 font-mono">
          <button
            onClick={() => setActiveMainTab('gauges')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeMainTab === 'gauges'
                ? 'bg-zinc-900 text-cyan-400 border border-zinc-700 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Telemetry Gauges</span>
          </button>

          <button
            onClick={() => setActiveMainTab('graphs')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeMainTab === 'graphs'
                ? 'bg-zinc-900 text-cyan-400 border border-zinc-700 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            <span>Real-Time Graphs</span>
          </button>

          <button
            onClick={() => setActiveMainTab('dtc')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeMainTab === 'dtc'
                ? 'bg-zinc-900 text-amber-400 border border-zinc-700 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>DTC Diagnostics</span>
          </button>
        </div>

        {/* VIEW 1: Unified Live Gauges Dashboard Grid */}
        {activeMainTab === 'gauges' && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-150">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <h3 className="text-xs font-mono uppercase font-bold tracking-widest text-zinc-400">
                    Live Telemetry Cluster ({visiblePids.length} Active PIDs)
                  </h3>
                  {isSimulated && (
                    <span className="text-[11px] font-mono text-purple-400 flex items-center gap-1 ml-1">
                      <Sparkles className="w-3 h-3" /> Virtual B58 Active
                    </span>
                  )}
                </div>

                {/* Category Filters & Quick PID Editor Shortcut */}
                <div className="flex items-center gap-2 flex-wrap font-mono">
                  <div className="flex bg-zinc-950 p-0.5 rounded-sm border border-zinc-800 text-[10px]">
                    {(
                      [
                        { id: 'all', label: `All (${enabledPids.length})` },
                        { id: 'standard', label: `Standard (${enabledPids.filter((p) => p.category === 'standard').length})` },
                        { id: 'b58', label: `B58 Mode 22 (${enabledPids.filter((p) => p.category === 'b58').length})` },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setGaugeCategoryFilter(tab.id)}
                        className={`px-2 py-1 rounded-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          gaugeCategoryFilter === tab.id
                            ? 'bg-zinc-900 text-cyan-400 border border-zinc-700'
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleOpenPidEditor(null)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-zinc-300 hover:text-white transition-all cursor-pointer"
                  >
                    <Sliders className="w-3 h-3 text-cyan-400" />
                    <span>Edit / Add PIDs</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visiblePids.map((pid) => renderPidGauge(pid))}

                {/* Protocol & Bus Diagnostics */}
                <div
                  id="gauge-bus-health"
                  className="bg-zinc-900/30 border border-zinc-800 p-4 rounded-sm flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest font-mono flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Relay Diagnostics
                    </span>
                    <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-bold bg-zinc-950 text-zinc-400 border border-zinc-800">
                      HEALTH
                    </span>
                  </div>

                  <div className="space-y-2 font-mono text-xs my-1">
                    <div className="flex justify-between items-center text-zinc-500">
                      <span className="text-[11px]">Stream Status:</span>
                      <span className={connectionState === 'polling' ? 'text-cyan-400 font-bold' : 'text-zinc-400'}>
                        {connectionState.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-500">
                      <span className="text-[11px]">Loop Frequency:</span>
                      <span className="text-zinc-200 font-bold">
                        {streamPayload?.metrics.loopHz || 0} Hz
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-500">
                      <span className="text-[11px]">Disconnects:</span>
                      <span className={(streamPayload?.metrics.disconnectionCount || 0) > 0 ? 'text-amber-400 font-bold' : 'text-zinc-400'}>
                        {streamPayload?.metrics.disconnectionCount || 0}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                    <span>ISO 15765-4</span>
                    <span className="text-cyan-400">CAN 11/500</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: Real-Time Dynamic Waveform Graphs */}
        {activeMainTab === 'graphs' && (
          <div className="animate-in fade-in duration-150">
            <TelemetryCharts
              currentPayload={streamPayload}
              telemetry={telemetry}
              unitSystem={unitSystem}
            />
          </div>
        )}

        {/* VIEW 3: ECU Diagnostics & DTC Scanner */}
        {activeMainTab === 'dtc' && (
          <div className="animate-in fade-in duration-150">
            <DtcScannerPanel
              connectionState={connectionState}
              isSimulated={isSimulated}
              onLogEntry={handleAddLogEntry}
            />
          </div>
        )}

        {/* AT Terminal & Bus Inspector Console */}
        <div className="flex flex-col gap-3">
          <TerminalConsole logs={logs} onClearLogs={handleClearLogs} />
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 pt-6 border-t border-zinc-800 w-full flex flex-col sm:flex-row justify-between items-start sm:items-center text-[10px] uppercase tracking-widest text-zinc-500 font-mono gap-4">
        <div className="flex flex-wrap gap-6 sm:gap-8">
          <p>OBD: <span className="text-zinc-300">ISO 15765-4 (CAN 11/500)</span></p>
          <p>Interface: <span className="text-zinc-300">Bluetooth Low Energy (ELM327)</span></p>
          <p>Polling Frequency: <span className="text-zinc-300">20Hz</span></p>
          <p>Data Engine: <span className="text-zinc-300">IndexedDB Storage</span></p>
        </div>
        <div>
          System Up-Time: <span className="text-zinc-300 font-mono">{formatUptime(uptimeSeconds)}</span>
        </div>
      </footer>

      {/* Modals */}
      <PidConfigModal
        isOpen={isPidModalOpen}
        onClose={() => {
          setIsPidModalOpen(false);
          setEditingPidId(null);
        }}
        initialEditPidId={editingPidId}
      />

      <SingleFileExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {isSessionsModalOpen && (
        <LogSessionsModal
          onClose={() => setIsSessionsModalOpen(false)}
          activeSession={activeLogSession}
          liveSampleCount={liveSampleCount}
          onSelectAnalyzeSession={(session) => {
            setIsSessionsModalOpen(false);
            handleOpenAnalysisModal(session);
          }}
        />
      )}

      {/* Fullscreen Landscape Driving Mode View */}
      {isDrivingModeOpen && (
        <DrivingModeView
          telemetry={telemetry}
          currentPayload={streamPayload}
          unitSystem={unitSystem}
          onToggleUnit={() => setUnitSystem((prev) => (prev === 'metric' ? 'imperial' : 'metric'))}
          onClose={() => setIsDrivingModeOpen(false)}
          isSimulated={isSimulated}
          onOpenAnalysisModal={handleOpenAnalysisModal}
        />
      )}

      {/* Gemini AI Performance Tuner Console Modal */}
      {isAnalysisModalOpen && (
        <AiTuningConsoleModal
          isOpen={isAnalysisModalOpen}
          onClose={() => setIsAnalysisModalOpen(false)}
          session={selectedAnalysisSession}
        />
      )}
    </div>
  );
}

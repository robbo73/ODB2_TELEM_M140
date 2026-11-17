import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  RotateCcw,
  Pause,
  Play,
  Activity,
  Flame,
  Fuel,
  Gauge,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ObdTelemetry, ObdStreamPayload } from '../types';

interface TelemetryChartsProps {
  currentPayload: ObdStreamPayload | null;
  telemetry: ObdTelemetry;
  unitSystem: 'metric' | 'imperial';
}

interface ChartDataPoint {
  timeLabel: string;
  timeSec: number;
  rpm: number;
  speed: number;
  coolantTemp: number;
  oilTemp: number;
  oilPressure: number;
  iat: number;
  boost: number;
  ethanol: number;
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({
  currentPayload,
  telemetry,
  unitSystem,
}) => {
  const [dataPoints, setDataPoints] = useState<ChartDataPoint[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [timeWindowSec, setTimeWindowSec] = useState<number>(60); // 30s, 60s, 120s, 300s
  
  // Metric visibility toggles
  const [visibleSeries, setVisibleSeries] = useState<{
    rpm: boolean;
    speed: boolean;
    coolant: boolean;
    oil: boolean;
    oilPressure: boolean;
    iat: boolean;
    boost: boolean;
    ethanol: boolean;
  }>({
    rpm: true,
    speed: true,
    coolant: true,
    oil: true,
    oilPressure: true,
    iat: true,
    boost: true,
    ethanol: true,
  });

  const startTimeRef = useRef<number>(Date.now());
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Append new data points whenever telemetry updates
  useEffect(() => {
    if (!currentPayload || isPausedRef.current) return;

    const now = Date.now();
    const elapsedSec = Number(((now - startTimeRef.current) / 1000).toFixed(1));
    const d = new Date(now);
    const timeStr = `${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${Math.floor(d.getMilliseconds() / 100)}`;

    const speedVal = unitSystem === 'metric' ? telemetry.speedKmh : telemetry.speedMph;
    const coolantVal = unitSystem === 'metric' ? telemetry.coolantTempC : telemetry.coolantTempF;
    const oilVal = unitSystem === 'metric' ? telemetry.b58OilTempC : telemetry.b58OilTempF;
    const iatVal = unitSystem === 'metric' ? telemetry.iatC : telemetry.iatF;
    const oilPressVal = unitSystem === 'metric' ? telemetry.oilPressureBar : telemetry.oilPressurePsi;

    const newPoint: ChartDataPoint = {
      timeLabel: timeStr,
      timeSec: elapsedSec,
      rpm: telemetry.rpm,
      speed: speedVal,
      coolantTemp: coolantVal,
      oilTemp: oilVal,
      oilPressure: oilPressVal,
      iat: iatVal,
      boost: telemetry.boostPsi,
      ethanol: telemetry.ethanolPct,
    };

    setDataPoints((prev) => {
      const maxPts = timeWindowSec * 10; // ~10 pts per sec buffer limit
      const next = [...prev, newPoint];
      if (next.length > maxPts) {
        return next.slice(next.length - maxPts);
      }
      return next;
    });
  }, [currentPayload, telemetry, unitSystem, timeWindowSec]);

  const handleClear = () => {
    startTimeRef.current = Date.now();
    setDataPoints([]);
  };

  const toggleSeries = (key: keyof typeof visibleSeries) => {
    setVisibleSeries((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#090a0d] border border-zinc-700 p-3 rounded-sm shadow-2xl font-mono text-xs z-50">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider pb-1 border-b border-zinc-800 mb-2">
            Time: <span className="text-zinc-200">{label}</span>
          </p>
          <div className="space-y-1">
            {payload.map((entry: any) => (
              <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  {entry.name}:
                </span>
                <span className="font-bold text-white">
                  {entry.value} {entry.unit || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div id="telemetry-realtime-charts" className="bg-zinc-900/40 border border-zinc-800 rounded-sm p-5 sm:p-6 flex flex-col gap-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-zinc-950 border border-zinc-800 text-cyan-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest font-sans">
                Real-Time Telemetry Graphs
              </h3>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-sm bg-zinc-950 text-cyan-400 border border-zinc-800 uppercase">
                {dataPoints.length} Points
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">
              Live dynamic waveform analysis for RPM, Speed, Temperatures, Boost, and Ethanol
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto font-mono text-xs">
          {/* Time Window Buttons */}
          <div className="flex bg-zinc-950 p-1 rounded-sm border border-zinc-800">
            {[
              { sec: 30, label: '30s' },
              { sec: 60, label: '1m' },
              { sec: 120, label: '2m' },
              { sec: 300, label: '5m' },
            ].map((item) => (
              <button
                key={item.sec}
                onClick={() => setTimeWindowSec(item.sec)}
                className={`px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  timeWindowSec === item.sec
                    ? 'bg-zinc-900 text-cyan-400 border border-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Pause / Resume Button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm font-bold uppercase text-[10px] tracking-wider transition-all cursor-pointer ${
              isPaused
                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/80 hover:bg-amber-900'
                : 'bg-zinc-950 text-zinc-400 border border-zinc-800 hover:text-white'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3 text-amber-400" /> : <Pause className="w-3 h-3 text-zinc-400" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Reset / Clear Button */}
          <button
            onClick={handleClear}
            title="Clear Chart Buffer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm font-bold uppercase text-[10px] tracking-wider bg-zinc-950 hover:bg-zinc-900 text-zinc-500 hover:text-rose-400 border border-zinc-800 hover:border-rose-900 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Series Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-mono uppercase font-bold text-zinc-500 tracking-widest mr-1">
          Active Channels:
        </span>
        
        {/* RPM */}
        <button
          onClick={() => toggleSeries('rpm')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-bold transition-all cursor-pointer border ${
            visibleSeries.rpm
              ? 'bg-cyan-950/40 text-cyan-400 border-cyan-800/60 shadow-[0_0_8px_rgba(6,182,212,0.15)]'
              : 'bg-zinc-950 text-zinc-600 border-zinc-900 opacity-60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span>RPM ({telemetry.rpm})</span>
        </button>

        {/* Speed */}
        <button
          onClick={() => toggleSeries('speed')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-bold transition-all cursor-pointer border ${
            visibleSeries.speed
              ? 'bg-blue-950/40 text-blue-400 border-blue-800/60'
              : 'bg-zinc-950 text-zinc-600 border-zinc-900 opacity-60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          <span>Speed ({unitSystem === 'metric' ? `${telemetry.speedKmh} km/h` : `${telemetry.speedMph} mph`})</span>
        </button>

        {/* Coolant */}
        <button
          onClick={() => toggleSeries('coolant')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-bold transition-all cursor-pointer border ${
            visibleSeries.coolant
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
              : 'bg-zinc-950 text-zinc-600 border-zinc-900 opacity-60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Coolant ({unitSystem === 'metric' ? `${telemetry.coolantTempC}°C` : `${telemetry.coolantTempF}°F`})</span>
        </button>

        {/* BMW B58 Oil Temp */}
        <button
          onClick={() => toggleSeries('oil')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-bold transition-all cursor-pointer border ${
            visibleSeries.oil
              ? 'bg-amber-950/40 text-amber-400 border-amber-800/60 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
              : 'bg-zinc-950 text-zinc-600 border-zinc-900 opacity-60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>B58 Oil ({unitSystem === 'metric' ? `${telemetry.b58OilTempC}°C` : `${telemetry.b58OilTempF}°F`})</span>
        </button>

        {/* Boost */}
        <button
          onClick={() => toggleSeries('boost')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-bold transition-all cursor-pointer border ${
            visibleSeries.boost
              ? 'bg-purple-950/40 text-purple-400 border-purple-800/60'
              : 'bg-zinc-950 text-zinc-600 border-zinc-900 opacity-60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-purple-400"></span>
          <span>Boost ({telemetry.boostPsi} PSI)</span>
        </button>

        {/* Ethanol Content */}
        <button
          onClick={() => toggleSeries('ethanol')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-bold transition-all cursor-pointer border ${
            visibleSeries.ethanol
              ? 'bg-rose-950/40 text-rose-400 border-rose-800/60'
              : 'bg-zinc-950 text-zinc-600 border-zinc-900 opacity-60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-400"></span>
          <span>Ethanol ({telemetry.ethanolPct}%)</span>
        </button>

        {/* Oil Pressure */}
        <button
          onClick={() => toggleSeries('oilPressure')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[11px] font-mono font-bold transition-all cursor-pointer border ${
            visibleSeries.oilPressure
              ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
              : 'bg-zinc-950 text-zinc-600 border-zinc-900 opacity-60'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Oil Press ({unitSystem === 'metric' ? `${telemetry.oilPressureBar} Bar` : `${telemetry.oilPressurePsi} PSI`})</span>
        </button>
      </div>

      {/* Dual Real-Time Chart Views */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Engine Velocity & Powertrain (RPM + Speed + Boost) */}
        <div className="bg-zinc-950 border border-zinc-800/90 rounded-sm p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 tracking-widest flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Engine Dynamics &amp; Boost
            </span>
            <span className="text-[10px] font-mono text-zinc-600">Left: RPM / Right: {unitSystem === 'metric' ? 'km/h' : 'mph'} &amp; PSI</span>
          </div>

          <div className="h-64 w-full">
            {dataPoints.length === 0 ? (
              <div className="h-full flex items-center justify-center font-mono text-xs text-zinc-600 uppercase tracking-wider">
                Waiting for telemetry samples...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                    stroke="#3f3f46"
                    minTickGap={25}
                  />
                  <YAxis
                    yAxisId="rpm"
                    orientation="left"
                    domain={[0, 7000]}
                    tick={{ fill: '#06b6d4', fontSize: 10, fontFamily: 'monospace' }}
                    stroke="#0e7490"
                  />
                  <YAxis
                    yAxisId="speed"
                    orientation="right"
                    domain={[0, unitSystem === 'metric' ? 220 : 140]}
                    tick={{ fill: '#60a5fa', fontSize: 10, fontFamily: 'monospace' }}
                    stroke="#1d4ed8"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {visibleSeries.rpm && (
                    <Line
                      yAxisId="rpm"
                      type="monotone"
                      dataKey="rpm"
                      name="Engine RPM"
                      unit="RPM"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                  {visibleSeries.speed && (
                    <Line
                      yAxisId="speed"
                      type="monotone"
                      dataKey="speed"
                      name="Speed"
                      unit={unitSystem === 'metric' ? 'km/h' : 'mph'}
                      stroke="#60a5fa"
                      strokeWidth={1.75}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                  {visibleSeries.boost && (
                    <Line
                      yAxisId="speed"
                      type="monotone"
                      dataKey="boost"
                      name="Boost"
                      unit="PSI"
                      stroke="#c084fc"
                      strokeWidth={1.5}
                      strokeDasharray="4 2"
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Thermal Management & Ethanol (Coolant + B58 Oil + Ethanol) */}
        <div className="bg-zinc-950 border border-zinc-800/90 rounded-sm p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 tracking-widest flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Thermal Matrix &amp; Ethanol Content
            </span>
            <span className="text-[10px] font-mono text-zinc-600">Left: Temp ({unitSystem === 'metric' ? '°C' : '°F'}) / Right: %</span>
          </div>

          <div className="h-64 w-full">
            {dataPoints.length === 0 ? (
              <div className="h-full flex items-center justify-center font-mono text-xs text-zinc-600 uppercase tracking-wider">
                Waiting for telemetry samples...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dataPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="timeLabel"
                    tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'monospace' }}
                    stroke="#3f3f46"
                    minTickGap={25}
                  />
                  <YAxis
                    yAxisId="temp"
                    orientation="left"
                    domain={[unitSystem === 'metric' ? 0 : 32, unitSystem === 'metric' ? 140 : 280]}
                    tick={{ fill: '#f59e0b', fontSize: 10, fontFamily: 'monospace' }}
                    stroke="#b45309"
                  />
                  <YAxis
                    yAxisId="pct"
                    orientation="right"
                    domain={[0, 100]}
                    tick={{ fill: '#fb7185', fontSize: 10, fontFamily: 'monospace' }}
                    stroke="#be123c"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  {visibleSeries.oil && (
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="oilTemp"
                      name="B58 Oil Temp"
                      unit={unitSystem === 'metric' ? '°C' : '°F'}
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                  {visibleSeries.coolant && (
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="coolantTemp"
                      name="Coolant Temp"
                      unit={unitSystem === 'metric' ? '°C' : '°F'}
                      stroke="#34d399"
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                  {visibleSeries.iat && (
                    <Line
                      yAxisId="temp"
                      type="monotone"
                      dataKey="iat"
                      name="Intake Air (IAT)"
                      unit={unitSystem === 'metric' ? '°C' : '°F'}
                      stroke="#38bdf8"
                      strokeWidth={1.5}
                      strokeDasharray="3 3"
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                  {visibleSeries.ethanol && (
                    <Line
                      yAxisId="pct"
                      type="monotone"
                      dataKey="ethanol"
                      name="Ethanol Content"
                      unit="%"
                      stroke="#fb7185"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { 
  Bluetooth, 
  BluetoothConnected, 
  BluetoothOff, 
  RefreshCw, 
  Activity, 
  Gauge, 
  Sparkles, 
  Sliders, 
  AlertTriangle,
  Radio,
  Cpu,
} from 'lucide-react';
import { ConnectionState, ObdStreamPayload } from '../types';
import { obd2Service } from '../services/obd2BleService';
import { simulationEngine } from '../services/simulationEngine';

interface ConnectionPanelProps {
  connectionState: ConnectionState;
  streamPayload: ObdStreamPayload | null;
  isSimulated: boolean;
  onToggleSimulation: () => void;
  onOpenPidConfig: () => void;
  onOpenExport: () => void;
}

export const ConnectionPanel: React.FC<ConnectionPanelProps> = ({
  connectionState,
  streamPayload,
  isSimulated,
  onToggleSimulation,
  onOpenPidConfig,
  onOpenExport,
}) => {
  const [autoReconnect, setAutoReconnect] = useState(true);
  const [hasBluetoothSupport, setHasBluetoothSupport] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setHasBluetoothSupport('bluetooth' in navigator);
    }
  }, []);

  const handleConnectClick = async () => {
    if (isSimulated) {
      onToggleSimulation(); // Turn off simulator when real connect requested
    }
    try {
      setIsConnecting(true);
      await obd2Service.connect();
    } catch (err) {
      // Handled in service logs
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectClick = async () => {
    if (isSimulated) {
      onToggleSimulation();
    } else {
      await obd2Service.disconnect();
    }
  };

  const handleAutoReconnectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAutoReconnect(checked);
    obd2Service.setAutoReconnect(checked);
  };

  const getStatusBadge = () => {
    if (isSimulated) {
      return (
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[11px] font-mono font-bold tracking-wider bg-purple-950/60 text-purple-400 border border-purple-800/80 uppercase">
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_6px_#a855f7]" />
          SIMULATOR (BMW B58 DME)
        </span>
      );
    }

    switch (connectionState) {
      case 'polling':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[11px] font-mono font-bold tracking-wider bg-cyan-950/60 text-cyan-400 border border-cyan-800/80 uppercase">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#06b6d4]" />
            STREAMING ({streamPayload?.metrics.loopHz || 0} HZ)
          </span>
        );
      case 'connected':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[11px] font-mono font-bold tracking-wider bg-cyan-950/60 text-cyan-400 border border-cyan-800/80 uppercase">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
            CONNECTED (IDLE)
          </span>
        );
      case 'initializing':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[11px] font-mono font-bold tracking-wider bg-amber-950/60 text-amber-400 border border-amber-800/80 uppercase">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            ELM327 HANDSHAKE
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[11px] font-mono font-bold tracking-wider bg-blue-950/60 text-blue-400 border border-blue-800/80 uppercase">
            <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
            GATT CONNECTING
          </span>
        );
      case 'scanning':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[11px] font-mono font-bold tracking-wider bg-blue-950/60 text-blue-400 border border-blue-800/80 uppercase">
            <Radio className="w-3 h-3 animate-pulse text-blue-400" />
            SCANNING BLE
          </span>
        );
      case 'reconnecting':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[11px] font-mono font-bold tracking-wider bg-amber-950/60 text-amber-400 border border-amber-800/80 uppercase">
            <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
            AUTO-RECONNECTING
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[11px] font-mono font-bold tracking-wider bg-rose-950/60 text-rose-400 border border-rose-800/80 uppercase">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            CONNECTION ERROR
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-sm text-[11px] font-mono font-bold tracking-wider bg-zinc-900 text-zinc-500 border border-zinc-800 uppercase">
            <span className="w-2 h-2 rounded-full bg-zinc-600" />
            DISCONNECTED
          </span>
        );
    }
  };

  const isLive = connectionState === 'polling' || connectionState === 'connected' || isSimulated;

  return (
    <div id="connection-panel" className="bg-zinc-900/40 border border-zinc-800 p-5 sm:p-6 rounded-sm">
      {!hasBluetoothSupport && (
        <div className="mb-4 p-3.5 rounded-sm bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2.5 font-mono">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-semibold uppercase tracking-wider text-amber-200">iOS / Safari Web Bluetooth Notice:</span> Apple Safari and iOS Chrome block the Web Bluetooth API (<code className="font-mono bg-amber-900/40 px-1 py-0.5 rounded-sm border border-amber-800/50">navigator.bluetooth</code>) by default in standard browsers. 
            To connect to your OBD2 dongle on iPhone / iPad, open this URL in the free <strong className="text-white">Bluefy – Web BLE Browser</strong> or <strong className="text-white">WebBLE</strong> from the App Store. On Android, Google Chrome has native Web Bluetooth support.
          </div>
        </div>
      )}

      {/* Main Header & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-sm bg-zinc-900 border border-zinc-800 text-cyan-400 shadow-[0_0_8px_#06b6d420]">
            <Bluetooth className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold tracking-widest text-white uppercase font-sans">
                Web Bluetooth OBD2 Scanner &amp; Logger
              </h2>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest rounded-sm bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                ELM327 BLE
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">
              Direct BLE interface for standard Mode 01 &amp; BMW B58 Mode 22 enhanced telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {getStatusBadge()}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Connect / Disconnect button */}
        {!isLive ? (
          <button
            id="btn-connect-obd2"
            onClick={handleConnectClick}
            disabled={isConnecting}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-sm font-bold text-xs tracking-widest uppercase bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-white shadow-[0_0_12px_#06b6d415] active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Connecting BLE...</span>
              </>
            ) : (
              <>
                <BluetoothConnected className="w-3.5 h-3.5 text-cyan-400" />
                <span>Connect OBD2</span>
              </>
            )}
          </button>
        ) : (
          <button
            id="btn-disconnect-obd2"
            onClick={handleDisconnectClick}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-sm font-bold text-xs tracking-widest uppercase bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800 text-rose-300 active:scale-[0.99] transition-all cursor-pointer"
          >
            <BluetoothOff className="w-3.5 h-3.5" />
            <span>Disconnect</span>
          </button>
        )}

        {/* Demo Simulator Toggle */}
        <button
          id="btn-toggle-simulator"
          onClick={onToggleSimulation}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm font-bold text-xs tracking-widest uppercase border transition-all cursor-pointer ${
            isSimulated
              ? 'bg-purple-950/70 border-purple-600 text-purple-300 shadow-[0_0_10px_#a855f720]'
              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 hover:border-purple-500/80 text-zinc-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>{isSimulated ? 'Stop Simulator' : 'B58 Simulator'}</span>
        </button>

        {/* PID Config Button */}
        <button
          id="btn-open-pid-config"
          onClick={onOpenPidConfig}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm font-bold text-xs tracking-widest uppercase bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-300 transition-all cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-zinc-400" />
          <span>PID Settings</span>
        </button>

        {/* Single-File HTML Export */}
        <button
          id="btn-export-standalone"
          onClick={onOpenExport}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm font-bold text-xs tracking-widest uppercase bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-zinc-300 transition-all cursor-pointer"
        >
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export HTML</span>
        </button>
      </div>

      {/* Connection & Telemetry Stats Bar */}
      <div className="mt-5 pt-4 border-t border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-sm bg-zinc-950 border border-zinc-800">
          <div className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider">Device Target</div>
          <div className="text-zinc-300 font-semibold truncate mt-0.5">
            {streamPayload?.device.name || (isSimulated ? 'Virtual B58 DME' : 'ELM327 BLE')}
          </div>
        </div>

        <div className="p-3 rounded-sm bg-zinc-950 border border-zinc-800">
          <div className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider">Loop Rate &amp; Latency</div>
          <div className="text-cyan-400 font-semibold mt-0.5">
            {streamPayload?.metrics.loopHz || 0} Hz / {streamPayload?.metrics.latencyMs || 0} ms
          </div>
        </div>

        <div className="p-3 rounded-sm bg-zinc-950 border border-zinc-800">
          <div className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider">Telemetry Cycles</div>
          <div className="text-zinc-300 font-semibold mt-0.5">
            {streamPayload?.metrics.pollCount || 0} pkts
          </div>
        </div>

        <div className="p-3 rounded-sm bg-zinc-950 border border-zinc-800 flex items-center justify-between">
          <div>
            <div className="text-zinc-500 text-[9px] uppercase font-bold tracking-wider">Auto-Reconnect</div>
            <div className="text-zinc-300 font-semibold mt-0.5">
              {autoReconnect ? 'Active' : 'Disabled'}
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={autoReconnect}
              onChange={handleAutoReconnectChange}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-zinc-300 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-300 after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-cyan-500"></div>
          </label>
        </div>
      </div>
    </div>
  );
};

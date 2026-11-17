import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Trash2,
  ShieldAlert,
  HelpCircle,
  Cpu,
  Info,
  Wrench,
  Sparkles,
} from 'lucide-react';
import { ConnectionState, DtcCode, DtcScanResult } from '../types';
import { dtcService } from '../services/dtcService';

interface DtcScannerPanelProps {
  connectionState: ConnectionState;
  isSimulated: boolean;
  onLogEntry?: (type: 'tx' | 'rx' | 'info' | 'error', text: string) => void;
}

export const DtcScannerPanel: React.FC<DtcScannerPanelProps> = ({
  connectionState,
  isSimulated,
  onLogEntry,
}) => {
  const [scanResult, setScanResult] = useState<DtcScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearStatusMessage, setClearStatusMessage] = useState<string | null>(null);

  const isConnected = connectionState === 'connected' || connectionState === 'polling' || isSimulated;

  const handleScanDtc = async () => {
    if (!isConnected) {
      setErrorMessage('Please connect to an OBD2 Bluetooth adapter or activate the B58 Simulator to scan diagnostic trouble codes.');
      return;
    }

    setErrorMessage(null);
    setClearStatusMessage(null);
    setIsScanning(true);

    try {
      if (onLogEntry) {
        onLogEntry('tx', '0101 > Querying MIL status & DTC count...');
        onLogEntry('tx', '03 > Querying Stored DTCs...');
        onLogEntry('tx', '07 > Querying Pending DTCs...');
      }

      const result = await dtcService.scanVehicleDtc(isSimulated);
      setScanResult(result);

      if (onLogEntry) {
        onLogEntry(
          'rx',
          `DTC Scan Complete: ${result.dtcCount} codes identified. MIL Status: ${result.milActive ? 'ACTIVE (ON)' : 'OFF'}`
        );
      }
    } catch (err: any) {
      setErrorMessage(`DTC Scan Error: ${err.message || err}. Ensure ignition is in ON/RUN position.`);
      if (onLogEntry) {
        onLogEntry('error', `DTC Scan Error: ${err.message || err}`);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmClear = async () => {
    setShowClearConfirm(false);
    setErrorMessage(null);
    setClearStatusMessage(null);
    setIsClearing(true);

    try {
      if (onLogEntry) {
        onLogEntry('tx', '04 > Sending OBD Mode 04 Clear DTCs & Reset MIL...');
      }

      const res = await dtcService.clearVehicleDtc(isSimulated);
      setClearStatusMessage(res.message);

      // Re-scan after clear to update UI
      const updated = await dtcService.scanVehicleDtc(isSimulated);
      setScanResult(updated);

      if (onLogEntry) {
        onLogEntry('rx', res.message);
      }
    } catch (err: any) {
      setErrorMessage(`Clear DTC Failed: ${err.message || err}`);
      if (onLogEntry) {
        onLogEntry('error', `Mode 04 Error: ${err.message || err}`);
      }
    } finally {
      setIsClearing(false);
    }
  };

  const handleInjectSimulatedFault = () => {
    dtcService.injectSimulatedDtc('P0300');
    handleScanDtc();
  };

  return (
    <div id="dtc-scanner-panel" className="bg-zinc-900/40 border border-zinc-800 rounded-sm p-5 sm:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-zinc-950 border border-zinc-800 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest font-sans">
                ECU Diagnostics &amp; DTC Scanner
              </h3>
              <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-sm bg-zinc-950 text-amber-400 border border-zinc-800 uppercase">
                Mode 03 / Mode 04 / Mode 07
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">
              Scan generic SAE OBD-II fault codes, BMW B58 DME status, and clear Check Engine Lights (MIL)
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          {/* Scan DTCs */}
          <button
            onClick={handleScanDtc}
            disabled={isScanning || isClearing}
            className="flex items-center gap-2 px-4 py-2 rounded-sm font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-white disabled:opacity-50 transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning ECU...' : 'Scan DTCs'}</span>
          </button>

          {/* Clear DTCs (Mode 04) */}
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={isScanning || isClearing || !isConnected}
            className="flex items-center gap-2 px-4 py-2 rounded-sm font-bold uppercase tracking-wider bg-zinc-950 hover:bg-rose-950/40 border border-zinc-800 hover:border-rose-700 text-zinc-400 hover:text-rose-400 disabled:opacity-40 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>{isClearing ? 'Clearing...' : 'Clear DTCs (Mode 04)'}</span>
          </button>

          {/* Inject Test DTC (if Simulated) */}
          {isSimulated && (
            <button
              onClick={handleInjectSimulatedFault}
              title="Inject test misfire code P0300 into simulator"
              className="flex items-center gap-1.5 px-3 py-2 rounded-sm font-bold uppercase text-[10px] tracking-wider bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-amber-400 hover:border-amber-700 transition-all cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>Inject Test Fault</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert Box */}
      {errorMessage && (
        <div className="p-3.5 rounded-sm bg-rose-950/40 border border-rose-900/60 text-rose-300 text-xs font-mono flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="text-rose-200 uppercase">Scanner Alert:</strong> {errorMessage}
          </div>
        </div>
      )}

      {/* Clear Status Message */}
      {clearStatusMessage && (
        <div className="p-3.5 rounded-sm bg-emerald-950/40 border border-emerald-900/60 text-emerald-300 text-xs font-mono flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong className="text-emerald-200 uppercase">Reset Success:</strong> {clearStatusMessage}
          </div>
        </div>
      )}

      {/* Scan Results Display */}
      {scanResult ? (
        <div className="space-y-4">
          {/* Status Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* MIL Check Engine Status */}
            <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-sm font-mono flex items-center justify-between">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">MIL (Check Engine)</p>
                <p className={`text-base font-bold ${scanResult.milActive ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {scanResult.milActive ? 'ACTIVE (MIL ON)' : 'CLEAR (MIL OFF)'}
                </p>
              </div>
              <div className={`w-3 h-3 rounded-full ${scanResult.milActive ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-emerald-500 shadow-[0_0_8px_#10b981]'}`} />
            </div>

            {/* Total DTC Count */}
            <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-sm font-mono flex items-center justify-between">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Faults Identified</p>
                <p className="text-base font-bold text-white">
                  {scanResult.codes.length} Code{scanResult.codes.length === 1 ? '' : 's'}
                </p>
              </div>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>

            {/* Scan Timestamp */}
            <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-sm font-mono flex items-center justify-between">
              <div>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Scan Timestamp</p>
                <p className="text-xs font-bold text-zinc-300">
                  {new Date(scanResult.timestamp).toLocaleTimeString()}
                </p>
              </div>
              <span className="text-[10px] text-zinc-600 uppercase">{scanResult.isSimulated ? 'Simulated' : 'ISO 15765-4'}</span>
            </div>
          </div>

          {/* Fault Code Cards */}
          {scanResult.codes.length === 0 ? (
            <div className="bg-zinc-950/60 border border-zinc-800 p-8 rounded-sm text-center font-mono">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">No Fault Codes Logged (ECU Clean)</h4>
              <p className="text-xs text-zinc-500 mt-1">
                Zero stored, pending, or permanent Diagnostic Trouble Codes found in engine memory.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] font-mono uppercase font-bold text-zinc-500 tracking-widest">
                Identified Trouble Codes:
              </p>
              {scanResult.codes.map((dtc) => (
                <div
                  key={`${dtc.code}-${dtc.mode}`}
                  className="bg-zinc-950 border border-zinc-800 rounded-sm p-4 sm:p-5 flex flex-col gap-3 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/80">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-bold px-2.5 py-1 rounded-sm bg-rose-950/80 border border-rose-800 text-rose-300">
                        {dtc.code}
                      </span>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white font-sans">
                          {dtc.description}
                        </h4>
                        <span className="text-[10px] font-mono text-zinc-500">
                          System: <span className="text-zinc-300">{dtc.system}</span> | Mode: <span className="text-cyan-400">{dtc.mode}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-[10px]">
                      <span
                        className={`px-2 py-0.5 rounded-sm font-bold uppercase ${
                          dtc.severity === 'critical'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : dtc.severity === 'warning'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-blue-950 text-blue-300 border border-blue-800'
                        }`}
                      >
                        {dtc.severity}
                      </span>
                    </div>
                  </div>

                  {/* Explanation */}
                  <p className="text-xs text-zinc-300 font-mono leading-relaxed">
                    {dtc.explanation}
                  </p>

                  {/* Possible Causes Checklist */}
                  {dtc.possibleCauses && dtc.possibleCauses.length > 0 && (
                    <div className="mt-1 pt-2 border-t border-zinc-900">
                      <p className="text-[10px] font-mono font-bold uppercase text-zinc-500 tracking-wider mb-1.5 flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-cyan-400" />
                        Common Causes &amp; Diagnostic Hints:
                      </p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono text-xs text-zinc-400">
                        {dtc.possibleCauses.map((cause, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-cyan-500" />
                            <span>{cause}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Idle State */
        <div className="bg-zinc-950/40 border border-zinc-800/80 p-8 rounded-sm text-center font-mono flex flex-col items-center justify-center gap-3">
          <Info className="w-6 h-6 text-zinc-600" />
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Diagnostic Scanner Idle
            </p>
            <p className="text-[11px] text-zinc-600 mt-1 max-w-md">
              Click &quot;Scan DTCs&quot; to query Mode 01 (MIL Status), Mode 03 (Stored Codes), and Mode 07 (Pending Codes) across the vehicle CAN bus.
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clearing DTCs */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-mono">
          <div className="bg-[#090a0d] border border-rose-900/60 rounded-sm w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400 pb-2 border-b border-zinc-800">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-sans text-white">
                Confirm DTC Clear (Mode 04)
              </h3>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Executing <strong className="text-rose-300">OBD Mode 04</strong> will reset all stored diagnostic trouble codes, freeze frame records, and turn off the Check Engine Light (MIL).
            </p>

            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-sm text-[11px] text-amber-400 leading-relaxed">
              <strong>Notice:</strong> This will also reset ECU readiness monitors (Emissions I/M inspection tests) until drive cycles are completed.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClear}
                className="px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer shadow-[0_0_12px_rgba(225,29,72,0.3)]"
              >
                Clear All DTCs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

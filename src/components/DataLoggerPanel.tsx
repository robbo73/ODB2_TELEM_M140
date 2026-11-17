import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Disc,
  Square,
  Database,
  Clock,
  Activity,
  Sparkles,
} from 'lucide-react';
import { LogSession } from '../types';
import { dataLoggingService } from '../services/dataLoggingService';

interface DataLoggerPanelProps {
  isLive: boolean;
  onOpenSessionsModal: () => void;
  onOpenAnalysisModal?: (session?: LogSession | null) => void;
}

export const DataLoggerPanel: React.FC<DataLoggerPanelProps> = ({
  isLive,
  onOpenSessionsModal,
  onOpenAnalysisModal,
}) => {
  const [activeSession, setActiveSession] = useState<LogSession | null>(null);
  const [lastFinishedSession, setLastFinishedSession] = useState<LogSession | null>(null);
  const [sampleCount, setSampleCount] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(0);
  const [storedCount, setStoredCount] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = dataLoggingService.subscribe((session, count) => {
      setActiveSession(session);
      setSampleCount(count);
    });

    const checkStoredSessions = async () => {
      const list = await dataLoggingService.getSessions();
      setStoredCount(list.length);
      if (list.length > 0 && !lastFinishedSession) {
        setLastFinishedSession(list[0]);
      }
    };
    checkStoredSessions();

    return () => unsubscribe();
  }, []);

  // Duration timer for active session
  useEffect(() => {
    if (!activeSession) {
      setDurationSec(0);
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - activeSession.startTime) / 1000);
      setDurationSec(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const handleStartLogging = async () => {
    await dataLoggingService.startLogging();
  };

  const handleStopLogging = async () => {
    const finished = await dataLoggingService.stopLogging();
    if (finished) {
      setLastFinishedSession(finished);
    }
    const list = await dataLoggingService.getSessions();
    setStoredCount(list.length);
  };

  const handleAnalyzeClick = async () => {
    if (!onOpenAnalysisModal) return;
    if (lastFinishedSession) {
      onOpenAnalysisModal(lastFinishedSession);
    } else {
      const latest = await dataLoggingService.getLatestSession();
      if (latest) {
        onOpenAnalysisModal(latest);
      } else {
        onOpenSessionsModal();
      }
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div id="data-logger-panel" className="bg-zinc-900/40 border border-zinc-800 rounded-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono">
      {/* Left: Info / Status */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-sm bg-zinc-950 border border-zinc-800 text-cyan-400">
          <FileSpreadsheet className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-widest font-sans">
              High-Frequency Data Logger
            </h3>
            {activeSession ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 uppercase animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                REC ACTIVE
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[9px] text-zinc-500 font-bold bg-zinc-950 border border-zinc-800 uppercase">
                READY
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Record standard PIDs &amp; BMW B58 telemetry with instant Gemini AI Performance Tuner Analysis
          </p>
        </div>
      </div>

      {/* Middle/Right: Live Metrics or Controls */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        {activeSession ? (
          <>
            {/* Live Stats */}
            <div className="flex items-center gap-4 bg-zinc-950 px-3 py-1.5 rounded-sm border border-zinc-800 text-xs">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold">{formatTimer(durationSec)}</span>
              </div>
              <div className="h-3 w-[1px] bg-zinc-800" />
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-bold text-cyan-300">{sampleCount}</span>
                <span className="text-[10px] text-zinc-500 uppercase">pts</span>
              </div>
            </div>

            {/* Export Live CSV */}
            <button
              onClick={() => dataLoggingService.exportCurrentActiveAsCsv()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-cyan-500 text-white transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Live CSV</span>
            </button>

            {/* Stop Button */}
            <button
              onClick={handleStopLogging}
              className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_12px_rgba(225,29,72,0.3)] transition-all cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop &amp; Save</span>
            </button>
          </>
        ) : (
          <>
            {/* Start Recording Button */}
            <button
              onClick={handleStartLogging}
              className="flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-rose-500 text-white shadow-sm transition-all cursor-pointer"
            >
              <Disc className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              <span>Start Logging</span>
            </button>

            {/* Analyze Drive Log Button */}
            {storedCount > 0 && (
              <button
                id="analyze-drive-log-btn"
                onClick={handleAnalyzeClick}
                className="flex items-center gap-2 px-3.5 py-2 rounded-sm text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-cyan-950 to-indigo-950 hover:from-cyan-900 hover:to-indigo-900 border border-cyan-500/70 hover:border-cyan-400 text-cyan-300 hover:text-white shadow-[0_0_14px_rgba(6,182,212,0.25)] transition-all cursor-pointer"
                title="Convert drive log to structured prompt and analyze with Gemini performance tuner"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Analyze Drive Log</span>
              </button>
            )}

            {/* View Stored Sessions */}
            <button
              onClick={onOpenSessionsModal}
              className="flex items-center gap-2 px-3.5 py-2 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-600 text-zinc-300 transition-all cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-zinc-400" />
              <span>Logs ({storedCount})</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};


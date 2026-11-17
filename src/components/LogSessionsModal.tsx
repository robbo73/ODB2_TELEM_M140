import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Trash2,
  X,
  Database,
  Calendar,
  Clock,
  Activity,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Sparkles,
} from 'lucide-react';
import { LogSession } from '../types';
import { dataLoggingService } from '../services/dataLoggingService';

interface LogSessionsModalProps {
  onClose: () => void;
  activeSession: LogSession | null;
  liveSampleCount: number;
  onSelectAnalyzeSession?: (session: LogSession) => void;
}

export const LogSessionsModal: React.FC<LogSessionsModalProps> = ({
  onClose,
  activeSession,
  liveSampleCount,
  onSelectAnalyzeSession,
}) => {
  const [sessions, setSessions] = useState<LogSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const list = await dataLoggingService.getSessions();
      setSessions(list);
    } catch (err) {
      console.error('Error loading sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleExportCsv = async (sessionId: string) => {
    setDownloadingId(sessionId);
    try {
      await dataLoggingService.exportSessionAsCsv(sessionId);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleExportJson = async (sessionId: string) => {
    setDownloadingId(sessionId);
    try {
      await dataLoggingService.exportSessionAsJson(sessionId);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (confirm('Delete this logged telemetry session from local IndexedDB?')) {
      await dataLoggingService.deleteSession(sessionId);
      await fetchSessions();
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to delete ALL saved telemetry logs in IndexedDB?')) {
      await dataLoggingService.clearAllSessions();
      await fetchSessions();
    }
  };

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}m ${sec.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-mono">
      <div className="bg-[#090a0d] border border-zinc-800 rounded-sm w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-zinc-950 border border-zinc-800 text-cyan-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest font-sans">
                Telemetry Data Logs &amp; Sessions
              </h3>
              <p className="text-xs text-zinc-500">
                IndexedDB Persistent Storage &bull; AI Performance Tuner Analysis &bull; CSV &amp; JSON Exporter
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Active Session Notice */}
          {activeSession && (
            <div className="p-3.5 rounded-sm bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-ping" />
                <div>
                  <span className="font-bold text-white uppercase tracking-wide">Live Logging Active: </span>
                  <span>{activeSession.name} ({liveSampleCount} points logged)</span>
                </div>
              </div>
              <button
                onClick={() => dataLoggingService.exportCurrentActiveAsCsv()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-white transition-all cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export Live CSV</span>
              </button>
            </div>
          )}

          {/* Sessions List */}
          {loading ? (
            <div className="p-12 text-center text-zinc-500 text-xs uppercase tracking-wider">
              Querying IndexedDB session records...
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-xs flex flex-col items-center justify-center gap-2">
              <FileSpreadsheet className="w-8 h-8 text-zinc-600" />
              <p className="font-bold uppercase tracking-wider text-zinc-400">No Recorded Sessions Yet</p>
              <p className="text-[11px] text-zinc-600 max-w-sm">
                Click &quot;Start Logging&quot; on the telemetry dashboard to record standard and BMW B58 parameters into IndexedDB.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-zinc-800 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                <span>Stored Sessions ({sessions.length})</span>
                <button
                  onClick={handleClearAll}
                  className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear All History
                </button>
              </div>

              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="bg-zinc-950 border border-zinc-800 rounded-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white font-sans">
                        {session.name}
                      </span>
                      {session.isSimulated && (
                        <span className="px-1.5 py-0.2 rounded-sm text-[9px] bg-zinc-900 border border-zinc-700 text-zinc-400 uppercase">
                          Simulated
                        </span>
                      )}
                      {session.aiAnalysis && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-sm text-[9px] bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold uppercase">
                          <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                          AI Tuned
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-zinc-600" />
                        {new Date(session.startTime).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-zinc-600" />
                        {formatDuration(session.durationMs)}
                      </span>
                      <span className="flex items-center gap-1 text-cyan-400 font-bold">
                        <Activity className="w-3 h-3 text-cyan-500" />
                        {session.sampleCount} Samples
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                    {/* Analyze Drive Log Button */}
                    <button
                      onClick={() => onSelectAnalyzeSession && onSelectAnalyzeSession(session)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        session.aiAnalysis
                          ? 'bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                          : 'bg-gradient-to-r from-cyan-950 to-indigo-950 hover:from-cyan-900 hover:to-indigo-900 border border-cyan-600/70 text-cyan-300 hover:text-white'
                      }`}
                      title="Analyze this drive log with Gemini performance tuner"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{session.aiAnalysis ? 'View AI Tuner' : 'Analyze Log'}</span>
                    </button>

                    <button
                      onClick={() => handleExportCsv(session.id)}
                      disabled={downloadingId === session.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-white transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>CSV</span>
                    </button>
                    <button
                      onClick={() => handleExportJson(session.id)}
                      disabled={downloadingId === session.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-zinc-300 transition-all cursor-pointer"
                    >
                      <FileCode className="w-3.5 h-3.5 text-purple-400" />
                      <span>JSON</span>
                    </button>
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="p-1.5 rounded-sm bg-zinc-900 hover:bg-rose-950 text-zinc-500 hover:text-rose-400 border border-zinc-800 hover:border-rose-800 transition-all cursor-pointer"
                      title="Delete Session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            IndexedDB Engine: <span className="text-zinc-300">OBD2_Telemetry_Database</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-sm text-xs uppercase tracking-wider font-bold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};


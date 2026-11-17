import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Copy,
  Check,
  Download,
  Save,
  RefreshCw,
  Gauge,
  Thermometer,
  Wind,
  Droplets,
  Fuel,
  Activity,
  Zap,
  Cpu,
  Sliders,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import Markdown from 'react-markdown';
import { LogSession, TelemetryDataPoint, AiLogAnalysis, AiLogAnalysisSummary } from '../types';
import { dataLoggingService } from '../services/dataLoggingService';

interface AiTuningConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: LogSession | null;
  onAnalysisSaved?: (updatedSession: LogSession) => void;
}

export const AiTuningConsoleModal: React.FC<AiTuningConsoleModalProps> = ({
  isOpen,
  onClose,
  session,
  onAnalysisSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisText, setAnalysisText] = useState<string>('');
  const [analysisSummary, setAnalysisSummary] = useState<AiLogAnalysisSummary | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-3.7-flash' | 'gemini-3.6-flash' | 'gemini-3.1-pro-preview'>('gemini-3.7-flash');
  const [driverNotes, setDriverNotes] = useState<string>('');
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [activeTab, setActiveTab] = useState<'report' | 'metrics' | 'pulls'>('report');

  // Load existing analysis if already saved on the session
  useEffect(() => {
    if (!isOpen || !session) return;

    if (session.aiAnalysis) {
      setAnalysisText(session.aiAnalysis.report);
      setAnalysisSummary(session.aiAnalysis.summary || null);
      if (session.aiAnalysis.model === 'gemini-3.6-flash') {
        setSelectedModel('gemini-3.6-flash');
      } else if (session.aiAnalysis.model === 'gemini-3.1-pro-preview') {
        setSelectedModel('gemini-3.1-pro-preview');
      } else {
        setSelectedModel('gemini-3.7-flash');
      }
      setSavedSuccess(true);
      setLoading(false);
      setError(null);
    } else {
      // Auto-trigger analysis if new
      setAnalysisText('');
      setAnalysisSummary(null);
      setSavedSuccess(false);
      runAnalysis();
    }
  }, [isOpen, session?.id]);

  if (!isOpen || !session) return null;

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setSavedSuccess(false);

    try {
      // Fetch samples for the session
      const samples = await dataLoggingService.getSessionSamples(session.id);
      if (samples.length === 0) {
        throw new Error('This session contains 0 telemetry samples. Record a log with live data first.');
      }

      const response = await fetch('/api/analyze-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: {
            id: session.id,
            name: session.name,
            durationMs: session.durationMs,
            sampleCount: session.sampleCount || samples.length,
            isSimulated: session.isSimulated,
          },
          samples,
          vehicleProfile: session.vehicleProfile || 'BMW B58 / Turbocharged OBD-II',
          userNotes: driverNotes,
          modelName: selectedModel,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Server returned an error during telemetry analysis.');
      }

      setAnalysisText(data.report);
      setAnalysisSummary(data.summary);

      // Auto-save to session in IndexedDB
      const analysisObj: AiLogAnalysis = {
        timestamp: Date.now(),
        model: data.model || selectedModel,
        report: data.report,
        summary: data.summary,
      };

      await dataLoggingService.saveSessionAnalysis(session.id, analysisObj);
      setSavedSuccess(true);

      if (onAnalysisSaved) {
        onAnalysisSaved({
          ...session,
          aiAnalysis: analysisObj,
        });
      }
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      setError(err?.message || 'Failed to connect to AI performance tuner endpoint.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSave = async () => {
    if (!analysisText) return;
    const analysisObj: AiLogAnalysis = {
      timestamp: Date.now(),
      model: selectedModel,
      report: analysisText,
      summary: analysisSummary || undefined,
    };
    await dataLoggingService.saveSessionAnalysis(session.id, analysisObj);
    setSavedSuccess(true);
    if (onAnalysisSaved) {
      onAnalysisSaved({
        ...session,
        aiAnalysis: analysisObj,
      });
    }
  };

  const handleCopyReport = () => {
    if (!analysisText) return;
    navigator.clipboard.writeText(analysisText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadReport = () => {
    if (!analysisText) return;
    const filename = `AI_Tuning_Report_${session.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_${session.id}.md`;
    const fullContent = `# OBD2 Performance Tuner Calibration Report
**Session**: ${session.name}
**Date**: ${new Date().toLocaleString()}
**Model**: ${selectedModel}
**Samples Analyzed**: ${session.sampleCount || analysisSummary?.totalSamples || 'N/A'}

---

${analysisText}

---
*Generated by Google AI Studio Gemini Tuner Engine*`;

    const blob = new Blob([fullContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-mono">
      <div className="bg-[#08090d] border border-zinc-800 rounded-sm w-full max-w-4xl max-h-[92vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden text-zinc-200">
        {/* Top Header Bar */}
        <header className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-cyan-950/70 border border-cyan-700/60 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-widest font-sans">
                  AI Performance Tuner Console
                </h2>
                <span className="px-2 py-0.5 rounded-sm text-[10px] font-bold bg-cyan-950 border border-cyan-800 text-cyan-300 uppercase">
                  {selectedModel}
                </span>
                {session.isSimulated && (
                  <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-zinc-900 border border-zinc-700 text-zinc-400 uppercase">
                    SIMULATOR
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-md sm:max-w-xl">
                Target: <span className="text-zinc-300 font-semibold">{session.name}</span> &bull; {session.sampleCount} samples ({Math.round(session.durationMs / 1000)}s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Model Selector Dropdown */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-sm px-2 py-1 text-xs">
              <Cpu className="w-3.5 h-3.5 text-zinc-500 mr-1.5" />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value as any)}
                disabled={loading}
                className="bg-transparent text-xs text-zinc-300 font-mono outline-none cursor-pointer"
              >
                <option value="gemini-3.7-flash" className="bg-zinc-950 text-white">Gemini 3.7 Flash (Recommended)</option>
                <option value="gemini-3.6-flash" className="bg-zinc-950 text-white">Gemini 3.6 Flash (Fast)</option>
                <option value="gemini-3.1-pro-preview" className="bg-zinc-950 text-white">Gemini 3.1 Pro (Deep Tuner)</option>
              </select>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
              title="Close Console (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Telemetry Summary Stats Strip */}
        {analysisSummary && (
          <div className="px-4 py-3 bg-zinc-950/80 border-b border-zinc-800/80 grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
            <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase">
                <Gauge className="w-3 h-3 text-cyan-400" />
                <span>Peak Boost</span>
              </div>
              <div className="text-sm font-bold text-cyan-400 font-sans mt-0.5">
                {analysisSummary.peakBoostPsi} <span className="text-[10px] font-normal text-zinc-500">PSI</span>
              </div>
            </div>

            <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase">
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Peak RPM</span>
              </div>
              <div className="text-sm font-bold text-amber-400 font-sans mt-0.5">
                {analysisSummary.peakRpm.toLocaleString()} <span className="text-[10px] font-normal text-zinc-500">RPM</span>
              </div>
            </div>

            <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase">
                <Thermometer className="w-3 h-3 text-orange-400" />
                <span>Max Oil Temp</span>
              </div>
              <div className="text-sm font-bold text-orange-400 font-sans mt-0.5">
                {analysisSummary.maxOilTempC}°C <span className="text-[10px] font-normal text-zinc-500">B58</span>
              </div>
            </div>

            <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase">
                <Wind className="w-3 h-3 text-blue-400" />
                <span>Peak IAT</span>
              </div>
              <div className="text-sm font-bold text-blue-400 font-sans mt-0.5">
                {analysisSummary.maxIatC}°C <span className="text-[10px] font-normal text-zinc-500">IAT</span>
              </div>
            </div>

            <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase">
                <Fuel className="w-3 h-3 text-emerald-400" />
                <span>Ethanol %</span>
              </div>
              <div className="text-sm font-bold text-emerald-400 font-sans mt-0.5">
                E{Math.round(analysisSummary.ethanolPct)} <span className="text-[10px] font-normal text-zinc-500">{analysisSummary.ethanolPct}%</span>
              </div>
            </div>

            <div className="bg-zinc-900/60 p-2 rounded border border-zinc-800/60">
              <div className="flex items-center gap-1 text-[10px] text-zinc-500 uppercase">
                <Activity className="w-3 h-3 text-rose-400" />
                <span>WOT Pulls</span>
              </div>
              <div className="text-sm font-bold text-rose-400 font-sans mt-0.5">
                {analysisSummary.pullCount} <span className="text-[10px] font-normal text-zinc-500">detected</span>
              </div>
            </div>
          </div>
        )}

        {/* View Tabs & Prompt Modifier Bar */}
        <div className="px-4 py-2 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1 rounded-sm uppercase tracking-wider font-bold transition-all cursor-pointer ${
                activeTab === 'report'
                  ? 'bg-zinc-900 text-cyan-400 border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Tuner Report
            </button>
            <button
              onClick={() => setActiveTab('pulls')}
              className={`px-3 py-1 rounded-sm uppercase tracking-wider font-bold transition-all cursor-pointer ${
                activeTab === 'pulls'
                  ? 'bg-zinc-900 text-cyan-400 border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Boost Pulls ({analysisSummary?.pullCount ?? 0})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowNotesInput(!showNotesInput)}
              className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 text-xs cursor-pointer"
            >
              <Sliders className="w-3 h-3 text-cyan-400" />
              <span>{showNotesInput ? 'Hide Goals' : 'Add Driver Notes'}</span>
            </button>
          </div>
        </div>

        {/* Optional Driver Notes Prompt Customization */}
        {showNotesInput && (
          <div className="p-3 bg-zinc-950 border-b border-zinc-800 flex flex-col gap-2">
            <label className="text-[11px] text-zinc-400 font-bold uppercase">
              Tuning Goals / Modifications (Sent with prompt to Gemini):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={driverNotes}
                onChange={(e) => setDriverNotes(e.target.value)}
                placeholder="e.g. Stage 2+ downpipe, 93 Octane + E30 blend, check if IAT delta indicates heat soak..."
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-sm px-3 py-1.5 text-xs text-white placeholder-zinc-600 outline-none focus:border-cyan-500"
              />
              <button
                onClick={runAnalysis}
                disabled={loading}
                className="px-3 py-1.5 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-black font-bold uppercase text-xs transition-all cursor-pointer"
              >
                Re-Analyze
              </button>
            </div>
          </div>
        )}

        {/* Main Console Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#050608] space-y-4">
          {/* Loading State */}
          {loading && (
            <div className="p-12 text-center flex flex-col items-center justify-center gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
                <Sparkles className="w-5 h-5 text-cyan-400 absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-white uppercase tracking-wider">
                  Analyzing Telemetry with {selectedModel}...
                </p>
                <p className="text-xs text-zinc-500 max-w-sm">
                  Calculating thermal gradients, manifold spool rate, knock resistance margins, and extracting full-throttle pulls...
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="p-4 rounded-sm bg-rose-950/40 border border-rose-800 text-rose-300 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Analysis Failed</span>
              </div>
              <p className="font-mono text-rose-300/90">{error}</p>
              <div className="flex items-center gap-2 pt-2 border-t border-rose-900/50">
                <button
                  onClick={runAnalysis}
                  className="px-3 py-1.5 rounded-sm bg-rose-900/60 hover:bg-rose-800 text-white font-bold uppercase tracking-wider text-xs transition-all cursor-pointer"
                >
                  Retry Analysis
                </button>
              </div>
            </div>
          )}

          {/* Report Tab Output */}
          {!loading && !error && activeTab === 'report' && analysisText && (
            <div className="relative rounded-sm bg-zinc-950/90 border border-zinc-800/90 p-4 sm:p-6 shadow-inner">
              <div className="prose prose-invert prose-sm max-w-none text-zinc-300 text-xs sm:text-sm leading-relaxed space-y-4">
                <div className="markdown-body">
                  <Markdown>{analysisText}</Markdown>
                </div>
              </div>
            </div>
          )}

          {/* Pulls Tab Output */}
          {!loading && !error && activeTab === 'pulls' && (
            <div className="space-y-3">
              <div className="text-xs text-zinc-400 font-bold uppercase tracking-wider">
                Full-Throttle / Boost Pull Telemetry Slices ({analysisSummary?.pulls?.length || 0})
              </div>

              {!analysisSummary?.pulls || analysisSummary.pulls.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-xs border border-zinc-900 rounded bg-zinc-950">
                  No sustained full-throttle boost pulls detected (RPM &gt; 2400 &amp; Boost &gt; 3 PSI). The drive log appears to be cruising or idle data.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {analysisSummary.pulls.map((pull, idx) => (
                    <div
                      key={idx}
                      className="bg-zinc-950 border border-zinc-800 p-4 rounded-sm space-y-2 hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                        <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                          PULL #{idx + 1} &bull; {pull.durationSec}s DURATION
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-900 text-zinc-400">
                          {pull.startRpm} &rarr; {pull.peakRpm} RPM
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-zinc-400">
                        <div>
                          <span className="text-zinc-500">Peak Boost: </span>
                          <strong className="text-cyan-400">{pull.peakBoost} PSI</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500">IAT Rise: </span>
                          <strong className={pull.peakIat - pull.startIat > 12 ? 'text-rose-400' : 'text-zinc-200'}>
                            {pull.startIat}°C &rarr; {pull.peakIat}°C (+{pull.peakIat - pull.startIat}°C)
                          </strong>
                        </div>
                        <div>
                          <span className="text-zinc-500">Min Oil Press: </span>
                          <strong className="text-rose-400">{pull.minOilPress} Bar</strong>
                        </div>
                        <div>
                          <span className="text-zinc-500">Peak Oil Press: </span>
                          <strong className="text-emerald-400">{pull.peakOilPress} Bar</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions Strip */}
        <footer className="p-4 border-t border-zinc-800 bg-zinc-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            {savedSuccess ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Saved to Session Log</span>
              </span>
            ) : (
              <button
                onClick={handleManualSave}
                disabled={!analysisText || loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-emerald-500 text-white font-bold uppercase text-xs transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span>Save to Session</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 text-zinc-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
              title="Run a fresh analysis with Gemini"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Re-Analyze</span>
            </button>

            <button
              onClick={handleCopyReport}
              disabled={!analysisText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-cyan-500 text-zinc-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-cyan-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              onClick={handleDownloadReport}
              disabled={!analysisText}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-purple-500 text-zinc-300 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>Export .MD</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

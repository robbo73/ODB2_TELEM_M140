import React, { useState, useRef, useEffect } from 'react';
import { Terminal, Send, Trash2, ArrowDownCircle, Check, Search } from 'lucide-react';
import { LogEntry } from '../types';
import { obd2Service } from '../services/obd2BleService';

interface TerminalConsoleProps {
  logs: LogEntry[];
  onClearLogs: () => void;
}

export const TerminalConsole: React.FC<TerminalConsoleProps> = ({ logs, onClearLogs }) => {
  const [customCommand, setCustomCommand] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<'all' | 'tx_rx' | 'error'>('all');
  const [isSending, setIsSending] = useState(false);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const quickCommands = [
    { label: 'ATZ (Reset)', cmd: 'ATZ' },
    { label: 'ATRV (Battery Volts)', cmd: 'ATRV' },
    { label: 'ATDPN (Protocol)', cmd: 'ATDPN' },
    { label: '010C (RPM)', cmd: '010C' },
    { label: '010D (Speed)', cmd: '010D' },
    { label: '010B (MAP)', cmd: '010B' },
    { label: '222020 (B58 Oil)', cmd: '222020' },
    { label: '22202B (Ethanol)', cmd: '22202B' },
  ];

  // Keep scroll strictly INSIDE the terminal container - do NOT scroll the main window/page
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleSendCommand = async (cmdToSend?: string) => {
    const cmd = (cmdToSend || customCommand).trim();
    if (!cmd) return;

    try {
      setIsSending(true);
      const res = await obd2Service.sendCommand(cmd);
      // Service logs tx and rx
    } catch (err: any) {
      // Error handled in service
    } finally {
      setIsSending(false);
      if (!cmdToSend) setCustomCommand('');
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'tx_rx') return log.type === 'tx' || log.type === 'rx';
    if (filter === 'error') return log.type === 'error';
    return true;
  });

  return (
    <div id="terminal-console" className="bg-zinc-900/40 border border-zinc-800 rounded-sm p-5 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-zinc-950 border border-zinc-800 text-cyan-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest font-sans">
              ELM327 AT Console &amp; Bus Inspector
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">
              Raw TX / RX byte traffic and diagnostic command line
            </p>
          </div>
        </div>

        {/* Filter, Auto-Scroll and Clear Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded-sm text-[10px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer ${
              autoScroll
                ? 'bg-cyan-950/60 text-cyan-400 border-cyan-800/80'
                : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300'
            }`}
            title={autoScroll ? 'Auto-scroll is ON' : 'Auto-scroll is PAUSED'}
          >
            Auto-Scroll: {autoScroll ? 'ON' : 'PAUSED'}
          </button>

          <div className="flex bg-zinc-950 p-1 rounded-sm border border-zinc-800 text-xs font-mono">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-sm transition-all cursor-pointer uppercase font-bold text-[10px] tracking-wider ${
                filter === 'all' ? 'bg-zinc-900 text-cyan-400 border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('tx_rx')}
              className={`px-2.5 py-1 rounded-sm transition-all cursor-pointer uppercase font-bold text-[10px] tracking-wider ${
                filter === 'tx_rx' ? 'bg-zinc-900 text-cyan-400 border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              TX / RX
            </button>
            <button
              onClick={() => setFilter('error')}
              className={`px-2.5 py-1 rounded-sm transition-all cursor-pointer uppercase font-bold text-[10px] tracking-wider ${
                filter === 'error' ? 'bg-zinc-900 text-rose-400 border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Errors
            </button>
          </div>

          <button
            onClick={onClearLogs}
            title="Clear Console"
            className="p-1.5 rounded-sm bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Command Buttons */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500 self-center mr-1">
          Quick AT:
        </span>
        {quickCommands.map((item) => (
          <button
            key={item.cmd}
            onClick={() => handleSendCommand(item.cmd)}
            disabled={isSending}
            className="px-2.5 py-1 rounded-sm text-xs font-mono font-medium bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-cyan-300 hover:text-cyan-200 hover:border-cyan-500/60 transition-all cursor-pointer disabled:opacity-50"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Terminal Output Area */}
      <div 
        ref={logContainerRef}
        className="mt-4 h-64 overflow-y-auto rounded-sm bg-zinc-950 p-3.5 font-mono text-[11px] leading-relaxed border border-zinc-800 flex flex-col gap-1.5 relative"
      >
        <div className="absolute top-2 right-4 text-[9px] text-zinc-600 select-none">SYSTEM_LOG</div>
        {filteredLogs.length === 0 ? (
          <div className="text-center py-16 text-zinc-600 uppercase tracking-widest font-mono text-xs">
            Console idle. Send command or start polling.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const timeStr = new Date(log.timestamp).toLocaleTimeString([], {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const ms = String(log.timestamp % 1000).padStart(3, '0');

            return (
              <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                <span className="text-zinc-600 text-[10px] select-none pt-0.5 font-mono">
                  [{timeStr}.{ms}]
                </span>

                {log.type === 'tx' && (
                  <span className="text-cyan-400 font-bold shrink-0">TX &gt;</span>
                )}
                {log.type === 'rx' && (
                  <span className="text-emerald-400 font-bold shrink-0">&lt; RX</span>
                )}
                {log.type === 'error' && (
                  <span className="text-rose-400 font-bold shrink-0">[ERR]</span>
                )}
                {log.type === 'info' && (
                  <span className="text-amber-500/90 font-bold shrink-0">[SYS]</span>
                )}

                <span
                  className={
                    log.type === 'tx'
                      ? 'text-cyan-300'
                      : log.type === 'rx'
                      ? 'text-emerald-300'
                      : log.type === 'error'
                      ? 'text-rose-300'
                      : 'text-zinc-400'
                  }
                >
                  {log.text}
                </span>
              </div>
            );
          })
        )}
        <div className="mt-1 flex items-center">
          <div className="inline-block h-3.5 w-1 bg-cyan-500 animate-pulse" />
        </div>
      </div>

      {/* Command Input Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendCommand();
        }}
        className="mt-3 flex gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={customCommand}
            onChange={(e) => setCustomCommand(e.target.value)}
            placeholder="Type custom command (e.g. 222020, ATRV, 010C)..."
            className="w-full bg-zinc-950 border border-zinc-800 focus:border-cyan-500 rounded-sm px-4 py-2 text-xs font-mono text-white placeholder:text-zinc-600 outline-none transition-all uppercase"
          />
        </div>
        <button
          type="submit"
          disabled={!customCommand.trim() || isSending}
          className="flex items-center gap-1.5 px-5 py-2 rounded-sm text-xs font-mono font-bold uppercase tracking-widest bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <Send className="w-3 h-3 text-cyan-400" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};

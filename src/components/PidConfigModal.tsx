import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Info,
  Pencil,
  Plus,
  Trash2,
  RotateCcw,
  Search,
  Zap,
  Save,
} from 'lucide-react';
import { PidConfigItem, PidFormulaId } from '../types';
import {
  pidConfigService,
  FORMULA_OPTIONS,
  computeExpectedHeader,
  normalizeCommand,
} from '../services/pidConfigService';

interface PidConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEditPidId?: string | null;
}

interface EditDraft {
  name: string;
  command: string;
  header: string;
  category: 'standard' | 'b58';
  unit: string;
  description: string;
  formula: PidFormulaId;
  customExpression: string;
  min: string;
  max: string;
  warningThreshold: string;
  dangerThreshold: string;
  pollRate: 'fast' | 'slow';
  accentColor: 'cyan' | 'amber' | 'emerald' | 'rose' | 'purple' | 'blue';
}

const emptyNewDraft = (): EditDraft => ({
  name: '',
  command: '',
  header: '',
  category: 'b58',
  unit: '',
  description: 'Custom OBD2 / Mode 22 PID',
  formula: 'raw_byte',
  customExpression: 'A',
  min: '0',
  max: '100',
  warningThreshold: '',
  dangerThreshold: '',
  pollRate: 'slow',
  accentColor: 'cyan',
});

export const PidConfigModal: React.FC<PidConfigModalProps> = ({
  isOpen,
  onClose,
  initialEditPidId,
}) => {
  const [pids, setPids] = useState<PidConfigItem[]>(pidConfigService.getPids());
  const [filterTab, setFilterTab] = useState<'all' | 'standard' | 'b58' | 'enabled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newDraft, setNewDraft] = useState<EditDraft>(emptyNewDraft());
  const [newError, setNewError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = pidConfigService.subscribe((updated) => {
      setPids(updated);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen && initialEditPidId) {
      const target = pids.find((p) => p.id === initialEditPidId);
      if (target) {
        setFilterTab('all');
        setSearchQuery('');
        startEditing(target);
      }
    } else if (!isOpen) {
      setEditingId(null);
      setEditDraft(null);
      setEditError(null);
      setIsAddingCustom(false);
    }
  }, [isOpen, initialEditPidId]);

  const startEditing = (item: PidConfigItem) => {
    setIsAddingCustom(false);
    setEditingId(item.id);
    setEditError(null);
    setEditDraft({
      name: item.name,
      command: item.command,
      header: item.header || '',
      category: item.category,
      unit: item.unit,
      description: item.description,
      formula: item.formula,
      customExpression: item.customExpression || 'A',
      min: String(item.min),
      max: String(item.max),
      warningThreshold: item.warningThreshold !== undefined ? String(item.warningThreshold) : '',
      dangerThreshold: item.dangerThreshold !== undefined ? String(item.dangerThreshold) : '',
      pollRate: item.pollRate || 'fast',
      accentColor: item.accentColor || 'cyan',
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditDraft(null);
    setEditError(null);
  };

  const validateCommand = (cmdRaw: string): string | null => {
    const clean = normalizeCommand(cmdRaw);
    if (clean.length < 4 || clean.length > 8 || clean.length % 2 !== 0) {
      return 'PID must be 4, 6, or 8 hex characters (e.g. 010C, 015C, 222020).';
    }
    return null;
  };

  const handleEditCommandChange = (rawVal: string) => {
    if (!editDraft) return;
    const nextCmd = rawVal.toUpperCase();
    const clean = normalizeCommand(nextCmd);
    let nextFormula = editDraft.formula;
    let nextCategory = editDraft.category;

    if (clean === '015C') {
      nextFormula = 'temp_offset_40';
      nextCategory = 'standard';
    } else if (clean === '222020') {
      nextFormula = 'temp_offset_48';
      nextCategory = 'b58';
    } else if (clean === '0152') {
      nextFormula = 'percent_255';
      nextCategory = 'standard';
    } else if (clean === '22202B') {
      nextFormula = 'percent_255';
      nextCategory = 'b58';
    } else if (clean === '222026') {
      nextFormula = 'oil_pressure_b58';
      nextCategory = 'b58';
    } else if (clean.startsWith('01')) {
      nextCategory = 'standard';
    } else if (clean.startsWith('22')) {
      nextCategory = 'b58';
    }

    // Mode 22 (BMW DME) is normally addressed to 7E0; Mode 01 uses the broadcast default
    let nextHeader = editDraft.header;
    if (clean.startsWith('22') && !nextHeader) nextHeader = '7E0';
    if (clean.startsWith('01') && nextHeader === '7E0') nextHeader = '';

    setEditDraft({
      ...editDraft,
      command: nextCmd,
      header: nextHeader,
      formula: nextFormula,
      category: nextCategory,
    });
  };

  const handleSaveEdit = (id: string): boolean => {
    if (!editDraft) return true;
    const cmdErr = validateCommand(editDraft.command);
    if (cmdErr) {
      setEditError(cmdErr);
      return false;
    }
    if (!editDraft.name.trim()) {
      setEditError('Display name is required.');
      return false;
    }

    const minNum = Number(editDraft.min);
    const maxNum = Number(editDraft.max);
    const warnNum = editDraft.warningThreshold.trim() !== '' ? Number(editDraft.warningThreshold) : undefined;
    const dangerNum = editDraft.dangerThreshold.trim() !== '' ? Number(editDraft.dangerThreshold) : undefined;

    pidConfigService.updatePid(id, {
      name: editDraft.name.trim(),
      command: normalizeCommand(editDraft.command),
      header: editDraft.header.trim() === '' ? '' : editDraft.header,
      category: editDraft.category,
      unit: editDraft.unit.trim() || 'raw',
      description: editDraft.description.trim(),
      formula: editDraft.formula,
      customExpression: editDraft.formula === 'custom' ? editDraft.customExpression.trim() : undefined,
      min: isNaN(minNum) ? 0 : minNum,
      max: isNaN(maxNum) ? 100 : maxNum,
      warningThreshold: warnNum !== undefined && !isNaN(warnNum) ? warnNum : undefined,
      dangerThreshold: dangerNum !== undefined && !isNaN(dangerNum) ? dangerNum : undefined,
      pollRate: editDraft.pollRate,
      accentColor: editDraft.accentColor,
    });

    setEditingId(null);
    setEditDraft(null);
    setEditError(null);
    return true;
  };

  const handleDone = () => {
    if (editingId && editDraft) {
      const ok = handleSaveEdit(editingId);
      if (!ok) return;
    }
    onClose();
  };

  const handleAddCustomPid = () => {
    const cmdErr = validateCommand(newDraft.command);
    if (cmdErr) {
      setNewError(cmdErr);
      return;
    }
    if (!newDraft.name.trim()) {
      setNewError('Display name is required.');
      return;
    }

    const minNum = Number(newDraft.min);
    const maxNum = Number(newDraft.max);
    const warnNum = newDraft.warningThreshold.trim() !== '' ? Number(newDraft.warningThreshold) : undefined;
    const dangerNum = newDraft.dangerThreshold.trim() !== '' ? Number(newDraft.dangerThreshold) : undefined;

    pidConfigService.addCustomPid({
      name: newDraft.name.trim(),
      command: normalizeCommand(newDraft.command),
      header: newDraft.header.trim() || (normalizeCommand(newDraft.command).startsWith('22') ? '7E0' : undefined),
      enabled: true,
      category: newDraft.category,
      description: newDraft.description.trim() || 'Custom user-defined PID',
      unit: newDraft.unit.trim() || 'raw',
      formula: newDraft.formula,
      customExpression: newDraft.formula === 'custom' ? newDraft.customExpression.trim() : undefined,
      min: isNaN(minNum) ? 0 : minNum,
      max: isNaN(maxNum) ? 100 : maxNum,
      warningThreshold: warnNum !== undefined && !isNaN(warnNum) ? warnNum : undefined,
      dangerThreshold: dangerNum !== undefined && !isNaN(dangerNum) ? dangerNum : undefined,
      pollRate: newDraft.pollRate,
      accentColor: newDraft.accentColor,
    });

    setIsAddingCustom(false);
    setNewDraft(emptyNewDraft());
    setNewError(null);
  };

  const filteredPids = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pids.filter((p) => {
      if (filterTab === 'standard' && p.category !== 'standard') return false;
      if (filterTab === 'b58' && p.category !== 'b58') return false;
      if (filterTab === 'enabled' && !p.enabled) return false;
      if (q) {
        return (
          p.name.toLowerCase().includes(q) ||
          p.command.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [pids, filterTab, searchQuery]);

  if (!isOpen) return null;

  const enabledCount = pids.filter((p) => p.enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#090a0d] border border-zinc-800 rounded-sm w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4] shrink-0"></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest font-sans">
                  PID Polling &amp; Editor
                </h3>
                <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-cyan-950/60 text-cyan-400 border border-cyan-800/70">
                  {enabledCount} / {pids.length} ACTIVE
                </span>
              </div>
              <p className="text-xs text-zinc-500 font-mono truncate">
                Edit any PID hex number, formula, or add custom Mode 01 / Mode 22 PIDs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar: Search, Filter Tabs, Quick Actions */}
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-zinc-800/80 bg-zinc-950/60 space-y-3 font-mono">
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PID name or hex (e.g. 010C, 222020, oil)..."
                className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 focus:border-cyan-500 rounded-sm text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
            </div>

            {/* Add Custom PID + Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setIsAddingCustom(!isAddingCustom);
                  setNewError(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-[11px] font-bold uppercase tracking-wider bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-700 text-cyan-300 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom PID</span>
              </button>
              <button
                type="button"
                onClick={() => pidConfigService.setAllEnabled(true)}
                className="px-2.5 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-all cursor-pointer"
                title="Enable all PIDs on main screen"
              >
                Enable All
              </button>
              <button
                type="button"
                onClick={() => pidConfigService.enableCoreEightOnly()}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-all cursor-pointer"
                title="Enable only the 8 primary telemetry PIDs for maximum BLE polling speed"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>Core 8</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  pidConfigService.resetDefaults();
                  setEditingId(null);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-rose-800 text-zinc-400 hover:text-rose-300 transition-all cursor-pointer"
                title="Restore default PID numbers and settings"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {(
              [
                { id: 'all', label: `All (${pids.length})` },
                { id: 'standard', label: `Standard Mode 01 (${pids.filter((p) => p.category === 'standard').length})` },
                { id: 'b58', label: `BMW B58 Mode 22 (${pids.filter((p) => p.category === 'b58').length})` },
                { id: 'enabled', label: `Active Only (${enabledCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer whitespace-nowrap ${
                  filterTab === tab.id
                    ? 'bg-zinc-900 text-cyan-400 border-cyan-700/80'
                    : 'bg-zinc-950 text-zinc-500 border-zinc-800 hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 font-mono flex-1">
          {/* Info Banner */}
          <div className="p-3 rounded-sm bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] flex items-start gap-2.5 leading-relaxed">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              Click <strong className="text-white">Edit</strong> on any PID to change its hex number (e.g. switch BMW Oil Temp{' '}
              <code className="bg-zinc-900 border border-zinc-700 text-amber-300 px-1 rounded-sm">222020</code> to standard{' '}
              <code className="bg-zinc-900 border border-zinc-700 text-cyan-300 px-1 rounded-sm">015C</code>), adjust its formula, or toggle which gauges appear on the main screen.
            </div>
          </div>

          {/* New Custom PID Form */}
          {isAddingCustom && (
            <div className="p-4 rounded-sm bg-zinc-900/70 border border-cyan-700/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  New Custom PID
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                  className="text-zinc-500 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {newError && (
                <div className="p-2 rounded-sm bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                  {newError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase mb-1">PID Number (Hex)*</label>
                  <input
                    type="text"
                    value={newDraft.command}
                    onChange={(e) => setNewDraft({ ...newDraft, command: e.target.value.toUpperCase() })}
                    placeholder="e.g. 015C or 222020"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-sm text-xs text-white uppercase font-mono focus:outline-none"
                  />
                  {newDraft.command.trim().length >= 2 && (
                    <span className="text-[10px] text-zinc-500 mt-0.5 block">
                      Expects reply: <span className="text-cyan-400">{computeExpectedHeader(newDraft.command)}</span>
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase mb-1">Display Name*</label>
                  <input
                    type="text"
                    value={newDraft.name}
                    onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })}
                    placeholder="e.g. Wastegate Duty"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-sm text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase mb-1">Category</label>
                  <select
                    value={newDraft.category}
                    onChange={(e) => setNewDraft({ ...newDraft, category: e.target.value as 'standard' | 'b58' })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-sm text-xs text-white focus:outline-none"
                  >
                    <option value="standard">Standard (Mode 01)</option>
                    <option value="b58">BMW B58 (Mode 22)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] text-zinc-400 uppercase mb-1">Formula / Scaling</label>
                  <select
                    value={newDraft.formula}
                    onChange={(e) => setNewDraft({ ...newDraft, formula: e.target.value as PidFormulaId })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-sm text-xs text-white focus:outline-none"
                  >
                    {FORMULA_OPTIONS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase mb-1">Unit</label>
                  <input
                    type="text"
                    value={newDraft.unit}
                    onChange={(e) => setNewDraft({ ...newDraft, unit: e.target.value })}
                    placeholder="e.g. %, °C, Bar"
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-sm text-xs text-white focus:outline-none"
                  />
                </div>

                {newDraft.formula === 'custom' && (
                  <div className="sm:col-span-3">
                    <label className="block text-[10px] text-cyan-400 uppercase mb-1">
                      Custom Math Expression (bytes A, B, C, D)
                    </label>
                    <input
                      type="text"
                      value={newDraft.customExpression}
                      onChange={(e) => setNewDraft({ ...newDraft, customExpression: e.target.value })}
                      placeholder="e.g. ((A * 256) + B) / 100"
                      className="w-full px-2.5 py-1.5 bg-zinc-950 border border-cyan-800 rounded-sm text-xs text-cyan-300 font-mono focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase mb-1">Gauge Min</label>
                  <input
                    type="number"
                    value={newDraft.min}
                    onChange={(e) => setNewDraft({ ...newDraft, min: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-sm text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase mb-1">Gauge Max</label>
                  <input
                    type="number"
                    value={newDraft.max}
                    onChange={(e) => setNewDraft({ ...newDraft, max: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-sm text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-zinc-400 uppercase mb-1">Poll Rate</label>
                  <select
                    value={newDraft.pollRate}
                    onChange={(e) => setNewDraft({ ...newDraft, pollRate: e.target.value as 'fast' | 'slow' })}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-sm text-xs text-white focus:outline-none"
                  >
                    <option value="fast">Fast (Every Cycle)</option>
                    <option value="slow">Slow (Round-Robin)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingCustom(false)}
                  className="px-3 py-1.5 rounded-sm text-xs bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddCustomPid}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-sm text-xs font-bold uppercase bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create &amp; Enable PID</span>
                </button>
              </div>
            </div>
          )}

          {/* PID Rows */}
          <div className="divide-y divide-zinc-800/80 rounded-sm border border-zinc-800 bg-zinc-950/60 overflow-hidden">
            {filteredPids.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No PIDs match your current filter.
              </div>
            ) : (
              filteredPids.map((item) => {
                const isEditing = editingId === item.id && editDraft !== null;
                const formulaMeta = FORMULA_OPTIONS.find((f) => f.id === item.formula);

                return (
                  <div key={item.id} className="transition-colors">
                    {/* Summary Row */}
                    <div className="p-3.5 flex items-center justify-between gap-3 hover:bg-zinc-900/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`font-mono text-xs font-bold px-2 py-1 rounded-sm border shrink-0 ${
                            item.category === 'b58'
                              ? 'bg-zinc-900 text-amber-400 border-amber-800/60'
                              : 'bg-zinc-900 text-cyan-400 border-zinc-700'
                          }`}
                        >
                          {item.command}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-white font-sans uppercase tracking-wider">
                              {item.name}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              ({item.unit}{item.imperialUnit ? ` / ${item.imperialUnit}` : ''})
                            </span>
                            {item.isCustom && (
                              <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase bg-purple-950/60 text-purple-300 border border-purple-800/60 rounded-sm">
                                Custom
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5 font-mono truncate">
                            {item.description}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-600">
                            <span>Reply: <span className="text-zinc-400">{item.expectedHeader}</span></span>
                            <span>•</span>
                            <span>Formula: <span className="text-zinc-400">{item.formula === 'custom' ? item.customExpression : (formulaMeta?.label || item.formula)}</span></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => (isEditing ? cancelEditing() : startEditing(item))}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                            isEditing
                              ? 'bg-cyan-950/70 border-cyan-600 text-cyan-300'
                              : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 hover:border-cyan-500 text-zinc-300 hover:text-white'
                          }`}
                          title={`Edit PID ${item.command}`}
                        >
                          <Pencil className="w-3 h-3" />
                          <span>{isEditing ? 'Editing' : 'Edit'}</span>
                        </button>

                        {/* Delete Button (Custom PIDs only) */}
                        {item.isCustom && (
                          <button
                            type="button"
                            onClick={() => pidConfigService.deletePid(item.id)}
                            className="p-1.5 rounded-sm bg-zinc-900 hover:bg-rose-950/70 border border-zinc-800 hover:border-rose-700 text-zinc-500 hover:text-rose-300 transition-all cursor-pointer"
                            title="Delete Custom PID"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Enable/Disable Toggle */}
                        <label className="relative inline-flex items-center cursor-pointer ml-1" title={item.enabled ? 'Enabled (Visible on main screen & polled)' : 'Disabled'}>
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            onChange={() => pidConfigService.togglePid(item.id)}
                            className="sr-only peer"
                          />
                          <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                        </label>
                      </div>
                    </div>

                    {/* Expanded Inline Editor */}
                    {isEditing && editDraft && (
                      <div className="px-4 pb-4 pt-3 bg-zinc-900/60 border-t border-zinc-800/80 space-y-3">
                        {editError && (
                          <div className="p-2 rounded-sm bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                            {editError}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] text-cyan-400 uppercase font-bold mb-1">
                              PID Number / Command (Hex)
                            </label>
                            <input
                              type="text"
                              value={editDraft.command}
                              onChange={(e) => handleEditCommandChange(e.target.value)}
                              placeholder="e.g. 010C or 222020"
                              className="w-full px-2.5 py-1.5 bg-zinc-950 border border-cyan-700/80 focus:border-cyan-400 rounded-sm text-xs text-white font-bold uppercase font-mono focus:outline-none"
                            />
                            <span className="text-[10px] text-zinc-500 mt-0.5 block">
                              Expected Header: <span className="text-cyan-400">{computeExpectedHeader(editDraft.command)}</span>
                            </span>
                          </div>

                          <div>
                            <label className="block text-[10px] text-zinc-400 uppercase mb-1">Display Name</label>
                            <input
                              type="text"
                              value={editDraft.name}
                              onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                              className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-sm text-xs text-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] text-zinc-400 uppercase mb-1">Category</label>
                            <select
                              value={editDraft.category}
                              onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value as 'standard' | 'b58' })}
                              className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-sm text-xs text-white focus:outline-none"
                            >
                              <option value="standard">Standard (Mode 01)</option>
                              <option value="b58">BMW B58 (Mode 22)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-zinc-400 uppercase mb-1">CAN Header (optional)</label>
                            <input
                              type="text"
                              value={editDraft.header}
                              onChange={(e) => setEditDraft({ ...editDraft, header: e.target.value.toUpperCase() })}
                              placeholder="blank = 7DF, DME = 7E0"
                              className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-sm text-xs text-white font-mono focus:outline-none"
                            />
                            <span className="text-[10px] text-zinc-500 mt-0.5 block">Mode 22 usually needs 7E0</span>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[10px] text-zinc-400 uppercase mb-1">Data Formula / Scaling</label>
                            <select
                              value={editDraft.formula}
                              onChange={(e) => setEditDraft({ ...editDraft, formula: e.target.value as PidFormulaId })}
                              className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-sm text-xs text-white focus:outline-none"
                            >
                              {FORMULA_OPTIONS.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] text-zinc-400 uppercase mb-1">Unit</label>
                            <input
                              type="text"
                              value={editDraft.unit}
                              onChange={(e) => setEditDraft({ ...editDraft, unit: e.target.value })}
                              className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 focus:border-cyan-500 rounded-sm text-xs text-white focus:outline-none"
                            />
                          </div>

                          {editDraft.formula === 'custom' && (
                            <div className="sm:col-span-3">
                              <label className="block text-[10px] text-cyan-400 uppercase mb-1">
                                Custom Expression (Variables: A, B, C, D)
                              </label>
                              <input
                                type="text"
                                value={editDraft.customExpression}
                                onChange={(e) => setEditDraft({ ...editDraft, customExpression: e.target.value })}
                                placeholder="e.g. ((A * 256) + B) / 100"
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-cyan-800 rounded-sm text-xs text-cyan-300 font-mono focus:outline-none"
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-zinc-400 uppercase mb-1">Min</label>
                              <input
                                type="number"
                                value={editDraft.min}
                                onChange={(e) => setEditDraft({ ...editDraft, min: e.target.value })}
                                className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded-sm text-xs text-white focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-zinc-400 uppercase mb-1">Max</label>
                              <input
                                type="number"
                                value={editDraft.max}
                                onChange={(e) => setEditDraft({ ...editDraft, max: e.target.value })}
                                className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded-sm text-xs text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-zinc-400 uppercase mb-1">Warn At</label>
                              <input
                                type="number"
                                value={editDraft.warningThreshold}
                                onChange={(e) => setEditDraft({ ...editDraft, warningThreshold: e.target.value })}
                                placeholder="Optional"
                                className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded-sm text-xs text-white focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-zinc-400 uppercase mb-1">Danger At</label>
                              <input
                                type="number"
                                value={editDraft.dangerThreshold}
                                onChange={(e) => setEditDraft({ ...editDraft, dangerThreshold: e.target.value })}
                                placeholder="Optional"
                                className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-700 rounded-sm text-xs text-white focus:outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] text-zinc-400 uppercase mb-1">Poll Priority</label>
                            <select
                              value={editDraft.pollRate}
                              onChange={(e) => setEditDraft({ ...editDraft, pollRate: e.target.value as 'fast' | 'slow' })}
                              className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-sm text-xs text-white focus:outline-none"
                            >
                              <option value="fast">Fast (Every Cycle)</option>
                              <option value="slow">Slow (Round-Robin)</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-3 py-1.5 rounded-sm text-xs bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.id)}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save PID</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3">
          <span className="text-[11px] font-mono text-zinc-500">
            Changes save automatically to browser storage &amp; update live polling.
          </span>
          <button
            onClick={handleDone}
            className="flex items-center gap-1.5 px-5 py-2 rounded-sm font-bold text-xs uppercase tracking-widest font-mono bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyan-500 text-white transition-all cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 text-cyan-400" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};

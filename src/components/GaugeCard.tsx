import React from 'react';
import { motion } from 'motion/react';
import { Pencil } from 'lucide-react';

interface GaugeCardProps {
  id: string;
  title: string;
  value: number;
  unit: string;
  secondaryValue?: number | string;
  secondaryUnit?: string;
  min: number;
  max: number;
  pid: string;
  category?: 'standard' | 'b58';
  warningThreshold?: number;
  dangerThreshold?: number;
  accentColor?: 'cyan' | 'amber' | 'emerald' | 'rose' | 'purple' | 'blue';
  icon?: React.ReactNode;
  decimals?: number;
  onEditPid?: () => void;
}

export const GaugeCard: React.FC<GaugeCardProps> = ({
  id,
  title,
  value,
  unit,
  secondaryValue,
  secondaryUnit,
  min,
  max,
  pid,
  category = 'standard',
  warningThreshold,
  dangerThreshold,
  accentColor = 'cyan',
  icon,
  decimals,
  onEditPid,
}) => {
  // Clamp percentage between 0 and 100
  const span = max - min;
  const normalizedValue = Math.min(Math.max(value, min), max);
  const percentage = span > 0 ? Math.round(((normalizedValue - min) / span) * 100) : 0;

  const isDanger = dangerThreshold !== undefined && value >= dangerThreshold;
  const isWarning = !isDanger && warningThreshold !== undefined && value >= warningThreshold;

  const colorStyles = {
    cyan: {
      bar: 'bg-cyan-500 shadow-[0_0_8px_#06b6d4]',
      text: 'text-cyan-400',
      badge: 'bg-cyan-950/60 text-cyan-400 border-cyan-800/80',
    },
    amber: {
      bar: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]',
      text: 'text-amber-400',
      badge: 'bg-amber-950/60 text-amber-400 border-amber-800/80',
    },
    emerald: {
      bar: 'bg-emerald-500 shadow-[0_0_8px_#10b981]',
      text: 'text-emerald-400',
      badge: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80',
    },
    rose: {
      bar: 'bg-rose-500 shadow-[0_0_8px_#f43f5e]',
      text: 'text-rose-400',
      badge: 'bg-rose-950/60 text-rose-400 border-rose-800/80',
    },
    purple: {
      bar: 'bg-purple-500 shadow-[0_0_8px_#a855f7]',
      text: 'text-purple-400',
      badge: 'bg-purple-950/60 text-purple-400 border-purple-800/80',
    },
    blue: {
      bar: 'bg-blue-500 shadow-[0_0_8px_#3b82f6]',
      text: 'text-blue-400',
      badge: 'bg-blue-950/60 text-blue-400 border-blue-800/80',
    },
  }[accentColor];

  const activeColorStyle = isDanger
    ? {
        bar: 'bg-rose-500 shadow-[0_0_8px_#f43f5e] animate-pulse',
        text: 'text-rose-400 font-bold',
        badge: 'bg-rose-950/80 text-rose-300 border-rose-700',
      }
    : isWarning
    ? {
        bar: 'bg-amber-500 shadow-[0_0_8px_#f59e0b]',
        text: 'text-amber-400',
        badge: 'bg-amber-950/80 text-amber-300 border-amber-700',
      }
    : colorStyles;

  const formattedValue =
    typeof value === 'number'
      ? decimals !== undefined
        ? value.toFixed(decimals)
        : Number.isInteger(value)
        ? value
        : value.toFixed(1)
      : value;

  return (
    <div
      id={id}
      className="group relative bg-zinc-900/30 border border-zinc-800 p-4 rounded-sm flex flex-col justify-between hover:border-zinc-700 transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <span className="text-zinc-500 shrink-0">{icon}</span>}
          <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest font-mono truncate">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {category === 'b58' && (
            <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold font-mono tracking-widest uppercase bg-amber-900/30 text-amber-500 border border-amber-800/60">
              B58
            </span>
          )}
          {onEditPid ? (
            <button
              type="button"
              onClick={onEditPid}
              title={`Edit PID ${pid}`}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-semibold uppercase tracking-wider border cursor-pointer hover:brightness-125 transition-all ${activeColorStyle.badge}`}
            >
              <span>{pid}</span>
              <Pencil className="w-2.5 h-2.5 opacity-70 group-hover:opacity-100" />
            </button>
          ) : (
            <span
              className={`px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-semibold uppercase tracking-wider border ${activeColorStyle.badge}`}
            >
              {pid}
            </span>
          )}
        </div>
      </div>

      {/* Primary Value Display */}
      <div className="my-2 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl sm:text-4xl font-mono text-zinc-200 font-bold tracking-tight">
            {formattedValue}
          </span>
          <span className="text-xs font-mono text-zinc-500 uppercase">
            {unit}
          </span>
        </div>

        {secondaryValue !== undefined && secondaryValue !== '' && (
          <div className="text-right">
            <span className="text-xs font-mono text-zinc-500">
              {secondaryValue} {secondaryUnit}
            </span>
          </div>
        )}
      </div>

      {/* Metric Bar */}
      <div className="mt-2">
        <div className="flex justify-between items-center text-[9px] font-mono text-zinc-600 mb-1">
          <span>{min}</span>
          <span>{max}</span>
        </div>
        <div className="h-1 w-full bg-zinc-800/80 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${activeColorStyle.bar}`}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  );
};

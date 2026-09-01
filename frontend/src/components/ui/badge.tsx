import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'bronze' | 'cyan';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const base = 'inline-flex items-center rounded px-2 py-0.5 text-[10px] font-mono font-semibold tracking-wider transition-colors select-none';

  const variants = {
    default: 'bg-slate-900 text-slate-100',
    secondary: 'bg-slate-100 text-slate-800 border border-slate-200',
    destructive: 'bg-rose-500/15 text-rose-600 border border-rose-500/30',
    outline: 'border border-slate-300 text-slate-700',
    success: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-700 border border-amber-500/30',
    bronze: 'bg-[#C38B4B]/15 text-[#C38B4B] border border-[#C38B4B]/30',
    cyan: 'bg-cyan-500/15 text-cyan-600 border border-cyan-500/30',
  };

  return <div className={cn(base, variants[variant], className)} {...props} />;
}

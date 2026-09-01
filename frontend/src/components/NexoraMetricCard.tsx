import React from 'react';
import { Card } from './ui/card';
import { cn } from '../lib/utils';

interface NexoraMetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: React.ElementType;
  trend?: {
    label: string;
    positive?: boolean;
  };
  highlightColor?: string;
  className?: string;
  onClick?: () => void;
}

export const NexoraMetricCard: React.FC<NexoraMetricCardProps> = ({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  highlightColor,
  className,
  onClick,
}) => {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative overflow-hidden transition-all duration-150 p-5",
        onClick && "cursor-pointer hover:border-slate-300 hover:shadow-xs",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs font-sans font-medium text-slate-500 block">
            {label}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-sans tracking-tight text-slate-900">
              {value}
            </span>
            {subValue && (
              <span className="text-xs font-sans text-slate-500 font-medium">
                {subValue}
              </span>
            )}
          </div>
          {trend && (
            <div className="pt-1 flex items-center gap-1.5 text-[11px] font-sans">
              <span
                className={cn(
                  "font-semibold",
                  trend.positive ? "text-[#34C759]" : "text-[#FF3B30]"
                )}
              >
                {trend.label}
              </span>
            </div>
          )}
        </div>

        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/70 text-slate-600 shrink-0",
              highlightColor
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </Card>
  );
};

import React from 'react';

/**
 * Reusable animated skeleton placeholder for dashboard cards and widgets.
 */
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex justify-between items-end">
        <div className="space-y-2">
          <div className="h-3 w-32 bg-slate-200 rounded-sm" />
          <div className="h-8 w-64 bg-slate-300 rounded-sm" />
          <div className="h-4 w-96 bg-slate-200 rounded-sm" />
        </div>
        <div className="h-9 w-36 bg-slate-200 rounded-md" />
      </div>

      {/* KPI Cards Row Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-2.5 w-24 bg-slate-200 rounded-sm" />
              <div className="h-4 w-4 bg-slate-200 rounded-full" />
            </div>
            <div className="h-7 w-16 bg-slate-300 rounded-sm" />
            <div className="h-2 w-32 bg-slate-100 rounded-sm" />
          </div>
        ))}
      </div>

      {/* Chart & Telemetry Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6 space-y-4">
          <div className="flex justify-between">
            <div className="h-4 w-48 bg-slate-300 rounded-sm" />
            <div className="h-4 w-24 bg-slate-200 rounded-sm" />
          </div>
          <div className="h-64 w-full bg-slate-100 rounded-lg" />
        </div>

        <div className="glass-card p-6 space-y-4">
          <div className="h-4 w-40 bg-slate-300 rounded-sm" />
          <div className="space-y-3 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-lg space-y-2 border border-slate-100">
                <div className="flex justify-between">
                  <div className="h-3 w-20 bg-slate-200 rounded-sm" />
                  <div className="h-3 w-12 bg-slate-200 rounded-sm" />
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Reusable table skeleton for Review Queue, Activities, and Observations.
 */
export const TableSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="glass-card overflow-hidden animate-pulse">
      <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex justify-between items-center">
        <div className="h-4 w-40 bg-slate-300 rounded-sm" />
        <div className="h-8 w-60 bg-slate-200 rounded-md" />
      </div>
      <div className="divide-y divide-slate-100">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-1/3">
              <div className="h-8 w-8 bg-slate-200 rounded-md shrink-0" />
              <div className="space-y-1.5 w-full">
                <div className="h-3.5 w-3/4 bg-slate-300 rounded-sm" />
                <div className="h-2.5 w-1/2 bg-slate-200 rounded-sm" />
              </div>
            </div>
            <div className="h-3 w-24 bg-slate-200 rounded-sm" />
            <div className="h-3 w-20 bg-slate-200 rounded-sm" />
            <div className="h-6 w-16 bg-slate-200 rounded-full" />
            <div className="h-8 w-24 bg-slate-200 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Skeleton for the Cryptographic Audit Trail Ledger.
 */
export const LedgerSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass-card p-5 space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 bg-slate-300 rounded-full" />
              <div className="h-4 w-28 bg-slate-300 rounded-sm" />
            </div>
            <div className="h-3 w-32 bg-slate-200 rounded-sm" />
          </div>
          <div className="h-3.5 w-3/4 bg-slate-200 rounded-sm" />
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div className="h-2.5 w-44 bg-slate-100 rounded-sm font-mono" />
            <div className="h-2.5 w-44 bg-slate-100 rounded-sm font-mono" />
          </div>
        </div>
      ))}
    </div>
  );
};

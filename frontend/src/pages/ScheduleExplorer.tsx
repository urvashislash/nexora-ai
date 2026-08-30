import React, { useState } from 'react';
import { 
  Search
} from 'lucide-react';
import type { ActivityWithState } from '../types';

interface ScheduleExplorerProps {
  activities: ActivityWithState[];
}

export const ScheduleExplorer: React.FC<ScheduleExplorerProps> = ({ activities }) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = activities.filter(item => {
    const matchesDisc = selectedDiscipline === 'ALL' || item.activity.discipline === selectedDiscipline;
    const matchesSearch = item.activity.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.activity.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDisc && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            L5/L6 Schedule & Actual Progress Explorer
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Authoritative Work Breakdown Structure (WBS) with real-time actual progress reconciliation from the Event Ledger.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search code or activity..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg bg-slate-900 border border-slate-800 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
            />
          </div>

          {/* Discipline Filter */}
          <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs">
            {['ALL', 'PIPING', 'CIVIL', 'MECHANICAL', 'ELECTRICAL'].map((disc) => (
              <button
                key={disc}
                onClick={() => setSelectedDiscipline(disc)}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  selectedDiscipline === disc ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {disc}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Schedule Table View */}
      <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-400 font-semibold">
              <tr>
                <th className="py-3.5 px-4">Activity Code</th>
                <th className="py-3.5 px-4">Activity Description</th>
                <th className="py-3.5 px-4">Discipline</th>
                <th className="py-3.5 px-4">Planned Dates</th>
                <th className="py-3.5 px-4">Actual Dates</th>
                <th className="py-3.5 px-4">Execution Status</th>
                <th className="py-3.5 px-4 text-right">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map(({ activity, state }) => {
                const status = state?.execution_status || 'NOT_STARTED';
                const progress = state?.current_progress_pct || 0;
                
                const statusBadge = 
                  status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
                  status === 'IN_PROGRESS' ? 'bg-sky-950 text-sky-400 border-sky-800' :
                  status === 'DELAYED' ? 'bg-rose-950 text-rose-400 border-rose-800' :
                  'bg-slate-900 text-slate-400 border-slate-700';

                return (
                  <tr key={activity.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-sky-400">
                      <div className="flex items-center space-x-2">
                        {activity.critical_path && (
                          <span className="h-2 w-2 rounded-full bg-rose-500" title="Critical Path Activity" />
                        )}
                        <span>{activity.code}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{activity.name}</div>
                      <div className="text-xs text-slate-400">{activity.description}</div>
                      {activity.equipment_tag && (
                        <span className="mt-1 inline-block rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">
                          Tag: {activity.equipment_tag}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="rounded px-2 py-0.5 text-xs font-semibold bg-slate-800 text-slate-300">
                        {activity.discipline}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-slate-300">
                      {activity.planned_start_date} → {activity.planned_finish_date}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-emerald-400">
                      {state?.actual_start_date ? (
                        <span>
                          {state.actual_start_date} → {state.actual_finish_date || 'In Progress'}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${statusBadge}`}>
                        {status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="font-mono font-bold text-white text-xs w-10">
                          {progress.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

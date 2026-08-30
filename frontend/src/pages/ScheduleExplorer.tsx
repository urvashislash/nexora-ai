import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ArrowUpDown,
  Eye
} from 'lucide-react';
import type { ActivityWithState } from '../types';
import { ActivityDrawer } from '../components/ActivityDrawer';

interface ScheduleExplorerProps {
  activities: ActivityWithState[];
}

export const ScheduleExplorer: React.FC<ScheduleExplorerProps> = ({ activities }) => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithState | null>(null);
  const [sortField, setSortField] = useState<'code' | 'progress' | 'planned_start_date' | 'variance'>('code');
  const [sortAsc, setSortAsc] = useState(true);

  // Compute Summary Counters
  const summary = useMemo(() => {
    const total = activities.length;
    const completed = activities.filter(a => a.state?.execution_status === 'COMPLETED').length;
    const inProgress = activities.filter(a => a.state?.execution_status === 'IN_PROGRESS').length;
    const delayed = activities.filter(a => (a.state?.variance_days ?? 0) > 0 || a.state?.execution_status === 'DELAYED').length;
    const criticalPath = activities.filter(a => a.activity.critical_path).length;
    return { total, completed, inProgress, delayed, criticalPath };
  }, [activities]);

  const filtered = useMemo(() => {
    let result = activities.filter(item => {
      const matchesDisc = selectedDiscipline === 'ALL' || item.activity.discipline === selectedDiscipline;
      const status = item.state?.execution_status || 'NOT_STARTED';
      const matchesStatus = selectedStatus === 'ALL' || status === selectedStatus;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || 
        item.activity.name.toLowerCase().includes(q) ||
        item.activity.code.toLowerCase().includes(q) ||
        (item.activity.equipment_tag && item.activity.equipment_tag.toLowerCase().includes(q)) ||
        (item.activity.location && item.activity.location.toLowerCase().includes(q));

      return matchesDisc && matchesStatus && matchesSearch;
    });

    result.sort((a, b) => {
      let valA: any = a.activity.code;
      let valB: any = b.activity.code;

      if (sortField === 'progress') {
        valA = a.state?.current_progress_pct ?? 0;
        valB = b.state?.current_progress_pct ?? 0;
      } else if (sortField === 'planned_start_date') {
        valA = a.activity.planned_start_date;
        valB = b.activity.planned_start_date;
      } else if (sortField === 'variance') {
        valA = a.state?.variance_days ?? 0;
        valB = b.state?.variance_days ?? 0;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

    return result;
  }, [activities, selectedDiscipline, selectedStatus, searchQuery, sortField, sortAsc]);

  const toggleSort = (field: 'code' | 'progress' | 'planned_start_date' | 'variance') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="signal-tick bg-blue-500" />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
              Work Breakdown Structure (WBS)
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-none">
            Project Explorer & Schedule
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-[65ch]">
            Inspect L5/L6 engineering work packages with verified actual progress, baseline dates, critical path constraints, and direct linkage to evidence ledger events.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">Total Activities</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">{summary.total}</div>
          <p className="text-[10px] font-mono text-slate-400 mt-2">Baseline Package 04</p>
        </div>

        <div className="glass-card p-4">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 block">Completed</span>
          <div className="text-2xl font-bold font-mono text-emerald-700 mt-1">{summary.completed}</div>
          <p className="text-[10px] font-mono text-slate-400 mt-2">100% Signoff</p>
        </div>

        <div className="glass-card p-4">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-700 block">In Progress</span>
          <div className="text-2xl font-bold font-mono text-blue-700 mt-1">{summary.inProgress}</div>
          <p className="text-[10px] font-mono text-slate-400 mt-2">Active Field Execution</p>
        </div>

        <div className="glass-card p-4">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 block">Critical Path</span>
          <div className="text-2xl font-bold font-mono text-rose-700 mt-1">{summary.criticalPath}</div>
          <p className="text-[10px] font-mono text-slate-400 mt-2">Zero Float Items</p>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="glass-panel p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, name, tag, location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded border border-slate-200 text-xs font-mono bg-white placeholder-slate-400 focus:outline-none focus:border-[#C38B4B]"
            />
          </div>

          {/* Filters: Discipline & Status */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1 text-xs font-mono">
              {['ALL', 'PIPING', 'CIVIL', 'MECHANICAL', 'ELECTRICAL'].map((disc) => (
                <button
                  key={disc}
                  onClick={() => setSelectedDiscipline(disc)}
                  className={`px-2.5 py-1 rounded text-[10px] font-semibold transition ${
                    selectedDiscipline === disc 
                      ? 'bg-slate-900 text-white font-bold' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {disc}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 text-xs font-mono border-l border-slate-200 pl-3">
              {(['ALL', 'COMPLETED', 'IN_PROGRESS', 'NOT_STARTED'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                    selectedStatus === st
                      ? 'bg-[#C38B4B] text-white font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {st === 'IN_PROGRESS' ? 'In Progress' : st === 'NOT_STARTED' ? 'Pending' : st === 'COMPLETED' ? 'Done' : 'All States'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* WBS Schedule Data Table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
              <tr>
                <th 
                  onClick={() => toggleSort('code')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Activity Code</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Activity Name & Package</th>
                <th className="py-3 px-4">Discipline</th>
                <th 
                  onClick={() => toggleSort('planned_start_date')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center gap-1">
                    <span>Baseline Window</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4">Execution Status</th>
                <th 
                  onClick={() => toggleSort('progress')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-slate-800"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Progress</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No activities match the specified filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const { activity, state } = item;
                  const status = state?.execution_status || 'NOT_STARTED';
                  const progress = state?.current_progress_pct || 0;
                  
                  const statusBadge = 
                    status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    status === 'DELAYED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    'bg-slate-100 text-slate-600 border-slate-200';

                  return (
                    <tr 
                      key={activity.id} 
                      onClick={() => setSelectedActivity(item)}
                      className="hover:bg-slate-50 cursor-pointer transition"
                    >
                      {/* Code */}
                      <td className="py-3 px-4 font-bold text-slate-900">
                        <div className="flex items-center space-x-2">
                          {activity.critical_path && (
                            <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" title="Critical Path Activity" />
                          )}
                          <span>{activity.code}</span>
                        </div>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4 font-sans max-w-sm">
                        <div className="font-semibold text-slate-900 truncate">{activity.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 truncate">{activity.location || 'Pipe Rack B'} • {activity.equipment_tag || 'Standard Package'}</div>
                      </td>

                      {/* Discipline */}
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                          {activity.discipline}
                        </span>
                      </td>

                      {/* Dates */}
                      <td className="py-3 px-4 text-slate-600 text-[11px]">
                        <div>{activity.planned_start_date}</div>
                        <div className="text-slate-400">→ {activity.planned_finish_date}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${statusBadge}`}>
                          {status}
                        </span>
                      </td>

                      {/* Progress Bar */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-bold text-slate-900">{progress}%</span>
                          <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${progress === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Detail Button */}
                      <td className="py-3 px-4 text-right">
                        <button className="text-[#C38B4B] hover:text-[#a06d35] flex items-center gap-1 ml-auto font-medium">
                          <Eye className="h-3.5 w-3.5" />
                          <span>360°</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity 360 Drawer */}
      <ActivityDrawer
        item={selectedActivity}
        isOpen={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
      />

    </div>
  );
};

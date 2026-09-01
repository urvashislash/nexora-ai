import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ArrowUpDown,
  Eye,
  Calendar,
  List,
  Flame,
  CheckCircle2,
  Clock,
  AlertTriangle
} from 'lucide-react';
import type { ActivityWithState } from '../types';
import { ActivityDrawer } from '../components/ActivityDrawer';

interface ScheduleExplorerProps {
  activities: ActivityWithState[];
}

export const ScheduleExplorer: React.FC<ScheduleExplorerProps> = ({ activities }) => {
  const [viewMode, setViewMode] = useState<'gantt' | 'table'>('gantt');
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

  // Timeline Date calculations (August 1 to September 30, 2026 = 61 days)
  const timelineStart = new Date('2026-08-01T00:00:00Z').getTime();
  const timelineEnd = new Date('2026-09-30T00:00:00Z').getTime();
  const totalDays = (timelineEnd - timelineStart) / (1000 * 60 * 60 * 24);

  const getTimelineLeftPercent = (dateStr: string) => {
    const d = new Date(dateStr).getTime();
    const diff = Math.max(0, d - timelineStart) / (1000 * 60 * 60 * 24);
    return (diff / totalDays) * 100;
  };

  const getTimelineWidthPercent = (startStr: string, finishStr: string) => {
    const s = new Date(startStr).getTime();
    const f = new Date(finishStr).getTime();
    const durationDays = Math.max(1, (f - s) / (1000 * 60 * 60 * 24));
    return (durationDays / totalDays) * 100;
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="signal-tick bg-blue-500" />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-500">
              Work Breakdown Structure (WBS)
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-none">
            Project Explorer & Gantt
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-[65ch]">
            Inspect L5 engineering work packages with verified actual progress, baseline dates, critical path constraints, and direct evidence linkage.
          </p>
        </div>

        {/* View Mode Toggle Button */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-mono">
          <button
            onClick={() => setViewMode('gantt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
              viewMode === 'gantt' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-[#C38B4B]" />
            <span>Interactive Gantt</span>
          </button>

          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition cursor-pointer ${
              viewMode === 'table' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Table Ledger</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <div className="flex justify-between items-center text-[10px] font-mono uppercase text-slate-500">
            <span>Completed</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{summary.completed} / {summary.total}</div>
          <div className="text-[10px] font-mono text-emerald-600 mt-1">100% physically done</div>
        </div>

        <div className="glass-card p-4">
          <div className="flex justify-between items-center text-[10px] font-mono uppercase text-slate-500">
            <span>In Progress</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{summary.inProgress}</div>
          <div className="text-[10px] font-mono text-blue-600 mt-1">Active site execution</div>
        </div>

        <div className="glass-card p-4">
          <div className="flex justify-between items-center text-[10px] font-mono uppercase text-slate-500">
            <span>Critical Path</span>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{summary.criticalPath}</div>
          <div className="text-[10px] font-mono text-amber-600 mt-1">Zero float tolerance</div>
        </div>

        <div className="glass-card p-4">
          <div className="flex justify-between items-center text-[10px] font-mono uppercase text-slate-500">
            <span>Schedule Variance</span>
            <AlertTriangle className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{summary.delayed}</div>
          <div className="text-[10px] font-mono text-slate-500 mt-1">Activities with delay</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search code, title, tag (e.g. PIP-2401, P-101)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#C38B4B] font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Discipline Filters */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-mono">
            {['ALL', 'PIPING', 'CIVIL', 'ELECTRICAL'].map(d => (
              <button
                key={d}
                onClick={() => setSelectedDiscipline(d)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  selectedDiscipline === d ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Status Filters */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="NOT_STARTED">Not Started</option>
          </select>
        </div>
      </div>

      {/* GANTT TIMELINE VIEW */}
      {viewMode === 'gantt' && (
        <div className="glass-card overflow-hidden shadow-sm">
          {/* Timeline Header */}
          <div className="grid grid-cols-12 bg-slate-100 border-b border-slate-200 font-mono text-[11px] font-bold text-slate-700 py-2.5 px-4">
            <div className="col-span-4 border-r border-slate-200 pr-4">Activity Code & Work Package</div>
            <div className="col-span-8 pl-4 flex justify-between text-slate-500">
              <span>01-Aug</span>
              <span>15-Aug</span>
              <span className="text-emerald-700 font-bold">Today (01-Sep)</span>
              <span>15-Sep</span>
              <span>30-Sep</span>
            </div>
          </div>

          {/* Gantt Rows */}
          <div className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-slate-400">
                No activities match the current filters.
              </div>
            ) : (
              filtered.map((item) => {
                const { activity, state } = item;
                const progress = state?.current_progress_pct || 0;
                const left = getTimelineLeftPercent(activity.planned_start_date);
                const width = getTimelineWidthPercent(activity.planned_start_date, activity.planned_finish_date);

                return (
                  <div
                    key={activity.id}
                    onClick={() => setSelectedActivity(item)}
                    className="grid grid-cols-12 py-3 px-4 hover:bg-slate-50/80 transition cursor-pointer items-center group"
                  >
                    {/* Left Column: Code & Name */}
                    <div className="col-span-4 border-r border-slate-100 pr-4 truncate">
                      <div className="flex items-center gap-2">
                        {activity.critical_path && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" title="Critical Path" />
                        )}
                        <span className="font-mono text-xs font-bold text-slate-900">{activity.code}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {activity.discipline}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 truncate mt-0.5" title={activity.name}>
                        {activity.name}
                      </div>
                    </div>

                    {/* Right Column: Timeline Bar */}
                    <div className="col-span-8 pl-4 relative h-8 flex items-center">
                      {/* Timeline Background Grid Line for Today */}
                      <div className="absolute top-0 bottom-0 left-[50%] w-[1px] bg-emerald-300 z-0 pointer-events-none" />

                      {/* Baseline Planned Box */}
                      <div
                        className={`absolute h-5 rounded border ${
                          activity.critical_path 
                            ? 'border-amber-400 bg-amber-50/80 shadow-xs' 
                            : 'border-slate-300 bg-slate-100/90'
                        }`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        {/* Actual Progress Fill */}
                        {progress > 0 && (
                          <div
                            className={`h-full rounded-l ${
                              progress === 100 
                                ? 'bg-emerald-500 rounded-r' 
                                : 'bg-cyan-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        )}

                        {/* Progress label inside/beside bar */}
                        <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-mono font-bold text-slate-800 pointer-events-none">
                          {progress > 0 ? `${progress}%` : ''}
                        </span>
                      </div>

                      {/* Tooltip on hover */}
                      <span className="absolute right-0 text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition">
                        {activity.planned_start_date} → {activity.planned_finish_date}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TABLE LEDGER VIEW */}
      {viewMode === 'table' && (
        <div className="glass-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono whitespace-nowrap">
              <thead className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase text-slate-600">
                <tr>
                  <th onClick={() => toggleSort('code')} className="py-3 px-4 cursor-pointer hover:text-slate-900">
                    <div className="flex items-center gap-1">
                      <span>Code</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Activity Name</th>
                  <th className="py-3 px-4">Discipline</th>
                  <th onClick={() => toggleSort('planned_start_date')} className="py-3 px-4 cursor-pointer hover:text-slate-900">
                    <div className="flex items-center gap-1">
                      <span>Baseline Window</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-3 px-4">Status</th>
                  <th onClick={() => toggleSort('progress')} className="py-3 px-4 text-right cursor-pointer hover:text-slate-900">
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
      )}

      {/* Activity 360 Drawer */}
      <ActivityDrawer
        item={selectedActivity}
        isOpen={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
      />

    </div>
  );
};

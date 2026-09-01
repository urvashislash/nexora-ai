import React, { useState, useMemo, useEffect } from 'react';
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
import { Activity360Drawer } from '../components/Activity360Drawer';
import { animateStaggerEntrance } from '../lib/animations';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

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
    const result = activities.filter(item => {
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

  // Anime.js entrance animation on table / gantt rows
  useEffect(() => {
    if (filtered.length > 0) {
      animateStaggerEntrance('.schedule-row-item', { stagger: 25 });
    }
  }, [filtered.length, viewMode]);

  const toggleSort = (field: 'code' | 'progress' | 'planned_start_date' | 'variance') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Helper to map dates to Gantt timeline percentage (August 1 to September 30 = 60 days)
  const getTimelineLeftPercent = (dateStr: string) => {
    const baseDate = new Date('2026-08-01').getTime();
    const targetDate = new Date(dateStr).getTime();
    const totalSpan = 60 * 24 * 60 * 60 * 1000; // 60 days
    const diff = Math.max(0, targetDate - baseDate);
    return Math.min(100, Math.max(0, (diff / totalSpan) * 100));
  };

  const getTimelineWidthPercent = (startStr: string, finishStr: string) => {
    const start = new Date(startStr).getTime();
    const finish = new Date(finishStr).getTime();
    const totalSpan = 60 * 24 * 60 * 60 * 1000;
    const diff = Math.max(24 * 60 * 60 * 1000, finish - start);
    return Math.min(100, Math.max(3, (diff / totalSpan) * 100));
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="signal-tick bg-[#007AFF]" />
            <Badge variant="secondary">WBS Hierarchy & Timeline</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-none font-sans">
            Schedule & Activity Explorer
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-[65ch] font-sans">
            Interactive Critical Path Method (CPM) network visualizer and actualization ledger. Review physical progress against Oracle Primavera P6 baseline dates.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70 text-xs font-sans">
          <Button
            onClick={() => setViewMode('gantt')}
            variant={viewMode === 'gantt' ? 'default' : 'ghost'}
            size="sm"
            className="flex items-center gap-1.5 rounded-lg"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Gantt Chart</span>
          </Button>
          <Button
            onClick={() => setViewMode('table')}
            variant={viewMode === 'table' ? 'default' : 'ghost'}
            size="sm"
            className="flex items-center gap-1.5 rounded-lg"
          >
            <List className="h-3.5 w-3.5" />
            <span>Table Ledger</span>
          </Button>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-sans text-slate-400 uppercase block font-semibold">Total Scope</span>
          <span className="text-lg font-bold font-mono text-slate-900">{summary.total} Activities</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-sans text-emerald-600 uppercase block font-semibold flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
          <span className="text-lg font-bold font-mono text-emerald-700">{summary.completed} Items</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-sans text-blue-600 uppercase block font-semibold flex items-center gap-1">
            <Clock className="h-3 w-3" />
            In Progress
          </span>
          <span className="text-lg font-bold font-mono text-blue-700">{summary.inProgress} Items</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-sans text-amber-600 uppercase block font-semibold flex items-center gap-1">
            <Flame className="h-3 w-3" />
            Critical Path
          </span>
          <span className="text-lg font-bold font-mono text-amber-700">{summary.criticalPath} Items</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
          <span className="text-[10px] font-sans text-rose-600 uppercase block font-semibold flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Delay / Variance
          </span>
          <span className="text-lg font-bold font-mono text-rose-700">{summary.delayed} Items</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search activity code, name, tag, or area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200/80 text-xs font-sans bg-white placeholder-slate-400 focus:outline-hidden focus:border-[#C38B4B]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-sans">
            <span className="text-slate-500">Discipline:</span>
            <select
              value={selectedDiscipline}
              onChange={(e) => setSelectedDiscipline(e.target.value)}
              className="rounded-lg border border-slate-200/80 bg-white py-1 px-2.5 text-xs font-sans text-slate-700 focus:outline-hidden focus:border-[#C38B4B]"
            >
              <option value="ALL">All Disciplines</option>
              <option value="CIVIL">Civil</option>
              <option value="PIPING">Piping</option>
              <option value="ELECTRICAL">Electrical</option>
              <option value="MECHANICAL">Mechanical</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-sans">
            <span className="text-slate-500">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="rounded-lg border border-slate-200/80 bg-white py-1 px-2.5 text-xs font-sans text-slate-700 focus:outline-hidden focus:border-[#C38B4B]"
            >
              <option value="ALL">All Statuses</option>
              <option value="NOT_STARTED">Not Started</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* GANTT TIMELINE VIEW */}
      {viewMode === 'gantt' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          {/* Timeline Header Bar */}
          <div className="grid grid-cols-12 bg-slate-50/70 border-b border-slate-200/80 py-2.5 px-5 text-[11px] font-sans font-semibold uppercase tracking-tight text-slate-500">
            <div className="col-span-4 border-r border-slate-200/70 pr-2">WBS Activity Scope</div>
            <div className="col-span-8 pl-4 grid grid-cols-4 text-center font-mono text-[10px]">
              <span>01-Aug (Start)</span>
              <span>15-Aug</span>
              <span>01-Sep</span>
              <span>30-Sep (Target)</span>
            </div>
          </div>

          {/* Activity Rows */}
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs font-sans text-slate-500">
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
                    className="schedule-row-item grid grid-cols-12 py-3.5 px-5 hover:bg-slate-50/80 transition-all duration-150 cursor-pointer items-center group"
                  >
                    {/* Left Column: Code & Name */}
                    <div className="col-span-4 border-r border-slate-100 pr-4 truncate">
                      <div className="flex items-center gap-2">
                        {activity.critical_path && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500] shrink-0" title="Critical Path" />
                        )}
                        <span className="font-mono text-xs font-bold text-slate-900">{activity.code}</span>
                        <Badge variant="secondary">{activity.discipline}</Badge>
                      </div>
                      <div className="text-xs text-slate-600 truncate mt-0.5 font-sans" title={activity.name}>
                        {activity.name}
                      </div>
                    </div>

                    {/* Right Column: Timeline Bar */}
                    <div className="col-span-8 pl-4 relative h-8 flex items-center">
                      {/* Timeline Background Grid Line for Today */}
                      <div className="absolute top-0 bottom-0 left-[50%] w-[1px] bg-[#34C759]/60 z-0 pointer-events-none" />

                      {/* Baseline Planned Box */}
                      <div
                        className={`absolute h-5 rounded-lg border ${
                          activity.critical_path 
                            ? 'border-amber-300 bg-amber-50/70 shadow-2xs' 
                            : 'border-slate-200 bg-slate-100/80'
                        }`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        {/* Actual Progress Fill */}
                        {progress > 0 && (
                          <div
                            className={`h-full rounded-l-lg ${
                              progress === 100 
                                ? 'bg-[#34C759] rounded-r-lg' 
                                : 'bg-[#007AFF]'
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
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans whitespace-nowrap">
              <thead className="bg-slate-50/70 border-b border-slate-200/80 text-[11px] uppercase font-semibold text-slate-500">
                <tr>
                  <th onClick={() => toggleSort('code')} className="py-3 px-5 cursor-pointer hover:text-slate-900">
                    <div className="flex items-center gap-1 font-sans">
                      <span>Code</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-3 px-5">Activity Name</th>
                  <th className="py-3 px-5">Discipline</th>
                  <th onClick={() => toggleSort('planned_start_date')} className="py-3 px-5 cursor-pointer hover:text-slate-900">
                    <div className="flex items-center gap-1 font-sans">
                      <span>Baseline Window</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-3 px-5">Status</th>
                  <th onClick={() => toggleSort('progress')} className="py-3 px-5 text-right cursor-pointer hover:text-slate-900">
                    <div className="flex items-center justify-end gap-1 font-sans">
                      <span>Progress</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="py-3 px-5 text-center">Critical</th>
                  <th className="py-3 px-5 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const { activity, state } = item;
                  const progress = state?.current_progress_pct || 0;
                  const status = state?.execution_status || 'NOT_STARTED';

                  return (
                    <tr
                      key={activity.id}
                      onClick={() => setSelectedActivity(item)}
                      className="schedule-row-item hover:bg-slate-50/80 transition-all duration-150 cursor-pointer"
                    >
                      <td className="py-3 px-5 font-bold font-mono text-slate-900">{activity.code}</td>
                      <td className="py-3 px-5 max-w-xs truncate font-sans text-slate-800">{activity.name}</td>
                      <td className="py-3 px-5">
                        <Badge variant="secondary">{activity.discipline}</Badge>
                      </td>
                      <td className="py-3 px-5 text-slate-500 font-mono text-[11px]">
                        {activity.planned_start_date} → {activity.planned_finish_date}
                      </td>
                      <td className="py-3 px-5">
                        <Badge variant={status === 'COMPLETED' ? 'success' : status === 'IN_PROGRESS' ? 'warning' : 'outline'}>
                          {status}
                        </Badge>
                      </td>
                      <td className="py-3 px-5 text-right font-bold font-mono">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${progress === 100 ? 'bg-[#34C759]' : 'bg-[#007AFF]'}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span>{progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-center">
                        {activity.critical_path ? (
                          <Badge variant="warning">YES</Badge>
                        ) : (
                          <span className="text-slate-400 font-sans text-xs">No</span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-center">
                        <Button
                          onClick={(e) => { e.stopPropagation(); setSelectedActivity(item); }}
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-slate-800"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Activity 360° Details Drawer */}
      <Activity360Drawer
        item={selectedActivity}
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        allActivities={activities}
      />
    </div>
  );
};

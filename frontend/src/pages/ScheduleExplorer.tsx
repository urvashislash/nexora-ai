import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  Eye, 
  Calendar, 
  List, 
  Flame,
  Upload
} from 'lucide-react';
import type { ActivityWithState } from '../types';
import { Activity360Drawer } from '../components/Activity360Drawer';
import { ScheduleImportModal } from '../components/ScheduleImportModal';
import { useProject } from '../contexts/ProjectContext';
import { animateStaggerEntrance } from '../lib/animations';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { NexoraStatusBadge } from '../components/NexoraStatusBadge';

interface ScheduleExplorerProps {
  activities: ActivityWithState[];
}

export const ScheduleExplorer: React.FC<ScheduleExplorerProps> = ({ activities }) => {
  const { activeProject } = useProject();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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

  // Dynamically derive timeline boundaries from the imported schedule
  const timelineBounds = useMemo(() => {
    if (activities.length === 0) {
      const now = new Date();
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      return {
        minTime: start.getTime(),
        maxTime: end.getTime(),
        totalSpan: end.getTime() - start.getTime(),
      };
    }

    let min = Infinity;
    let max = -Infinity;

    activities.forEach((item) => {
      const s = new Date(item.activity.planned_start_date).getTime();
      const f = new Date(item.activity.planned_finish_date).getTime();
      if (!isNaN(s) && s < min) min = s;
      if (!isNaN(f) && f > max) max = f;
    });

    if (min === Infinity || max === -Infinity) {
      const now = Date.now();
      min = now - 7 * 24 * 60 * 60 * 1000;
      max = now + 30 * 24 * 60 * 60 * 1000;
    }

    // Add a 5% buffer on left and right for visual breathing room
    const span = Math.max(24 * 60 * 60 * 1000, max - min);
    const padding = Math.max(24 * 60 * 60 * 1000, Math.round(span * 0.05));
    const minTime = min - padding;
    const maxTime = max + padding;
    const totalSpan = maxTime - minTime;

    return { minTime, maxTime, totalSpan };
  }, [activities]);

  const getTimelineLeftPercent = (dateStr: string) => {
    const targetDate = new Date(dateStr).getTime();
    if (isNaN(targetDate)) return 0;
    const offset = Math.max(0, targetDate - timelineBounds.minTime);
    return Math.min(100, Math.max(0, (offset / timelineBounds.totalSpan) * 100));
  };

  const getTimelineWidthPercent = (startStr: string, finishStr: string) => {
    const start = new Date(startStr).getTime();
    const finish = new Date(finishStr).getTime();
    if (isNaN(start) || isNaN(finish)) return 5;
    const duration = Math.max(24 * 60 * 60 * 1000, finish - start);
    return Math.min(100, Math.max(1, (duration / timelineBounds.totalSpan) * 100));
  };

  const timelineTicks = useMemo(() => {
    const ticks: { label: string; percent: number }[] = [];
    const count = 5;
    const step = timelineBounds.totalSpan / (count - 1);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < count; i++) {
      const time = timelineBounds.minTime + i * step;
      const d = new Date(time);
      const label = `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}`;
      ticks.push({ label, percent: (i / (count - 1)) * 100 });
    }
    return ticks;
  }, [timelineBounds]);

  const todayPercent = useMemo(() => {
    const now = Date.now();
    if (now < timelineBounds.minTime || now > timelineBounds.maxTime) return null;
    return Math.min(100, Math.max(0, ((now - timelineBounds.minTime) / timelineBounds.totalSpan) * 100));
  }, [timelineBounds]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="signal-tick bg-blue-700" aria-hidden="true" />
            <Badge variant="secondary">Baseline Schedule & Actuals</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-none font-sans">
            Schedule Explorer
          </h1>
          <p className="mt-1 text-xs text-slate-600 max-w-[65ch] font-sans">
            Track activity progress, variance, and dependencies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
            className="bg-[#C38B4B] hover:bg-[#b07b3e] text-white flex items-center gap-1.5 font-sans"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Import Schedule</span>
          </Button>

          {/* View Mode Switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 text-xs font-sans">
            <button
              type="button"
              onClick={() => setViewMode('gantt')}
              aria-pressed={viewMode === 'gantt'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 ${
                viewMode === 'gantt' 
                  ? 'bg-white shadow-2xs text-slate-900 font-semibold' 
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Gantt Chart</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 ${
                viewMode === 'table' 
                  ? 'bg-white shadow-2xs text-slate-900 font-semibold' 
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Table Ledger</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] font-sans font-semibold uppercase text-slate-600">Total Activities</span>
          <p className="text-lg font-bold font-mono text-slate-900">{summary.total}</p>
        </Card>
        <Card className="p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] font-sans font-semibold uppercase text-emerald-800">Completed</span>
          <p className="text-lg font-bold font-mono text-emerald-800">{summary.completed}</p>
        </Card>
        <Card className="p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] font-sans font-semibold uppercase text-sky-800">In Progress</span>
          <p className="text-lg font-bold font-mono text-sky-800">{summary.inProgress}</p>
        </Card>
        <Card className="p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] font-sans font-semibold uppercase text-amber-900">Critical Path</span>
          <p className="text-lg font-bold font-mono text-amber-900">{summary.criticalPath}</p>
        </Card>
        <Card className="p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] font-sans font-semibold uppercase text-slate-700">Delayed</span>
          <p className="text-lg font-bold font-mono text-slate-900">{summary.delayed}</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <Input
                type="text"
                aria-label="Search schedule activities"
                placeholder="Search by code, activity name, equipment tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Discipline Filter */}
            <div className="flex items-center gap-1 text-xs font-sans">
              <span className="text-slate-600 text-[11px] mr-1 font-medium">Discipline:</span>
              {(['ALL', 'CIVIL', 'PIPING', 'ELECTRICAL', 'MECHANICAL'] as const).map(disc => (
                <button
                  key={disc}
                  type="button"
                  onClick={() => setSelectedDiscipline(disc)}
                  aria-pressed={selectedDiscipline === disc}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 ${
                    selectedDiscipline === disc 
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  {disc}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 text-xs font-sans">
              <span className="text-slate-600 text-[11px] mr-1 font-medium">Status:</span>
              {(['ALL', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  aria-pressed={selectedStatus === st}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 ${
                    selectedStatus === st 
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  {st === 'ALL' ? 'ALL' : st === 'NOT_STARTED' ? 'Not Started' : st === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs font-sans text-slate-600">
            Showing <strong className="text-slate-900 font-semibold">{filtered.length}</strong> activities
          </span>
        </div>
      </Card>

      {/* MAIN VIEW: EMPTY STATE OR GANTT CHART OR TABLE */}
      {activities.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 shadow-2xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900 font-sans">No schedule baseline imported</h3>
            <p className="text-xs text-slate-500 font-sans">
              Import your planned construction schedule from CSV, Excel (.xlsx), or Primavera P6 (.xer) to establish WBS activities, planned dates, and critical paths.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="bg-[#C38B4B] hover:bg-[#b07b3e] text-white"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            <span>Import Schedule Baseline</span>
          </Button>
        </Card>
      ) : viewMode === 'gantt' ? (
        <Card className="shadow-2xs overflow-hidden">
          {/* Gantt Header Timeline Bar */}
          <div className="bg-slate-50/70 border-b border-slate-200/80 p-3 flex items-center justify-between text-[11px] font-sans">
            <span className="w-72 font-semibold text-slate-700 uppercase tracking-wider pl-2">Activity & WBS Code</span>
            <div className="flex-1 flex justify-between px-4 text-slate-600 font-mono text-[10px] font-medium">
              {timelineTicks.map((tick, idx) => (
                <span key={idx}>{tick.label}</span>
              ))}
            </div>
          </div>

          {/* Gantt Rows */}
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const { activity, state } = item;
              const plannedLeft = getTimelineLeftPercent(activity.planned_start_date);
              const plannedWidth = getTimelineWidthPercent(activity.planned_start_date, activity.planned_finish_date);
              const progress = state?.current_progress_pct || 0;
              const isSelected = selectedActivity?.activity.id === activity.id;

              return (
                <button
                  key={activity.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedActivity(item)}
                  aria-label={`Open 360 detail for ${activity.code} ${activity.name}, progress ${progress}%`}
                  className={`schedule-row-item flex w-full items-center p-3 text-left transition-colors duration-150 hover:bg-slate-50/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500 ${
                    isSelected ? 'bg-slate-100/90' : ''
                  }`}
                >
                  {/* Left Metadata Info */}
                  <div className="w-72 pr-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{activity.code}</span>
                      <Badge variant="secondary">{activity.discipline}</Badge>
                      {activity.critical_path && (
                        <span title="Critical Path" aria-label="Critical Path Milestone">
                          <Flame className="h-3.5 w-3.5 text-amber-800 shrink-0" aria-hidden="true" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-800 truncate mt-0.5 font-sans font-medium">{activity.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-600 font-mono mt-0.5 font-medium">
                      <span>{activity.planned_start_date} &rarr; {activity.planned_finish_date}</span>
                      <span aria-hidden="true">&bull;</span>
                      <span className="font-sans font-semibold text-slate-900">{progress}%</span>
                    </div>
                  </div>

                  {/* Right Timeline Canvas with Gantt Bars */}
                  <div className="flex-1 relative h-8 bg-slate-50/50 rounded-lg overflow-hidden border border-slate-100">
                    {/* Today Vertical Reference Line */}
                    {todayPercent !== null && (
                      <div 
                        className="absolute top-0 bottom-0 w-px bg-[#34C759] border-r border-dashed border-[#34C759]/60 z-10"
                        style={{ left: `${todayPercent}%` }}
                        title="Today"
                      />
                    )}

                    {/* Planned Schedule Bar (Subtle outline) */}
                    <div
                      className="absolute top-1.5 h-5 rounded-md bg-slate-200/70 border border-slate-300"
                      style={{
                        left: `${plannedLeft}%`,
                        width: `${plannedWidth}%`,
                      }}
                    >
                      {/* Actual Progress Fill */}
                      <div
                        className={`h-full rounded-l-md transition-all duration-300 ${
                          activity.critical_path ? 'bg-[#FF9500]' : 'bg-[#34C759]'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      ) : (
        /* Table Ledger View */
        <Card className="shadow-2xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" onClick={() => toggleSort('code')} aria-label="Sort by WBS code" className="flex items-center gap-1 rounded text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500">
                    <span>WBS code</span>
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </TableHead>
                <TableHead>Activity Name</TableHead>
                <TableHead>Discipline</TableHead>
                <TableHead>
                  <button type="button" onClick={() => toggleSort('planned_start_date')} aria-label="Sort by planned dates" className="flex items-center gap-1 rounded text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500">
                    <span>Planned dates</span>
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" onClick={() => toggleSort('progress')} aria-label="Sort by progress percentage" className="flex items-center gap-1 rounded text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500">
                    <span>Progress</span>
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <button type="button" onClick={() => toggleSort('variance')} aria-label="Sort by variance" className="ml-auto flex items-center justify-end gap-1 rounded text-right focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500">
                    <span>Variance</span>
                    <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const { activity, state } = item;
                const progress = state?.current_progress_pct || 0;
                const status = state?.execution_status || 'NOT_STARTED';
                const variance = state?.variance_days || 0;

                return (
                  <TableRow
                    key={activity.id}
                    className="schedule-row-item"
                  >
                    <TableCell className="font-mono font-bold text-slate-900">{activity.code}</TableCell>
                    <TableCell className="font-medium text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-xs">{activity.name}</span>
                        {activity.critical_path && (
                          <Badge variant="warning">CRITICAL</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{activity.discipline}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-slate-700">
                      {activity.planned_start_date} &rarr; {activity.planned_finish_date}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-[#34C759] h-full" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="font-mono font-bold text-slate-900 text-[11px]">{progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <NexoraStatusBadge status={status} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px]">
                      <span className={variance > 0 ? 'text-rose-800 font-bold' : 'text-emerald-800 font-bold'}>
                        {variance > 0 ? `+${variance}d` : `${variance}d`}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedActivity(item);
                        }}
                        variant="ghost"
                        size="icon-sm"
                        className="text-slate-600 hover:text-slate-900"
                        aria-label={`Open details for ${activity.code}`}
                        title="Open activity details"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Activity 360° Detail Slide-over Drawer */}
      <Activity360Drawer
        item={selectedActivity}
        isOpen={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
        allActivities={activities}
      />

      {/* Schedule Import Modal */}
      <ScheduleImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        projectId={activeProject?.id || ''}
      />
    </div>
  );
};

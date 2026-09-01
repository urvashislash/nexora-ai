import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ArrowUpDown,
  Eye,
  Calendar,
  List,
  Flame
} from 'lucide-react';
import type { ActivityWithState } from '../types';
import { Activity360Drawer } from '../components/Activity360Drawer';
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
    const offset = Math.max(0, targetDate - baseDate);
    return Math.min(100, Math.max(0, (offset / totalSpan) * 100));
  };

  const getTimelineWidthPercent = (startStr: string, finishStr: string) => {
    const start = new Date(startStr).getTime();
    const finish = new Date(finishStr).getTime();
    const totalSpan = 60 * 24 * 60 * 60 * 1000;
    const duration = Math.max(24 * 60 * 60 * 1000, finish - start);
    return Math.min(100, (duration / totalSpan) * 100);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="signal-tick bg-[#007AFF]" />
            <Badge variant="secondary">Baseline Schedule & Actuals</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-none font-sans">
            Schedule Explorer
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-[65ch] font-sans">
            Gantt timeline and interactive WBS activity ledger tracking physical progress, baseline variance, and critical-path precedence.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/60 text-xs font-sans">
          <button
            onClick={() => setViewMode('gantt')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              viewMode === 'gantt' 
                ? 'bg-white shadow-2xs text-slate-900 font-semibold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Gantt Chart</span>
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              viewMode === 'table' 
                ? 'bg-white shadow-2xs text-slate-900 font-semibold' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Table Ledger</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] font-sans font-semibold uppercase text-slate-400">Total Activities</span>
          <p className="text-lg font-bold font-mono text-slate-900">{summary.total}</p>
        </Card>
        <Card className="p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] font-sans font-semibold uppercase text-emerald-700">Completed</span>
          <p className="text-lg font-bold font-mono text-emerald-700">{summary.completed}</p>
        </Card>
        <Card className="p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] font-sans font-semibold uppercase text-sky-700">In Progress</span>
          <p className="text-lg font-bold font-mono text-sky-700">{summary.inProgress}</p>
        </Card>
        <Card className="p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] font-sans font-semibold uppercase text-amber-700">Critical Path</span>
          <p className="text-lg font-bold font-mono text-amber-700">{summary.criticalPath}</p>
        </Card>
        <Card className="p-3.5 shadow-2xs space-y-1">
          <span className="text-[10px] font-sans font-semibold uppercase text-slate-500">Delayed</span>
          <p className="text-lg font-bold font-mono text-slate-700">{summary.delayed}</p>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by code, activity name, equipment tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>

            {/* Discipline Filter */}
            <div className="flex items-center gap-1 text-xs font-sans">
              <span className="text-slate-400 text-[11px] mr-1">Discipline:</span>
              {(['ALL', 'CIVIL', 'PIPING', 'ELECTRICAL', 'MECHANICAL'] as const).map(disc => (
                <button
                  key={disc}
                  onClick={() => setSelectedDiscipline(disc)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    selectedDiscipline === disc 
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {disc}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 text-xs font-sans">
              <span className="text-slate-400 text-[11px] mr-1">Status:</span>
              {(['ALL', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                    selectedStatus === st 
                      ? 'bg-slate-900 text-white font-semibold shadow-2xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                  }`}
                >
                  {st === 'ALL' ? 'ALL' : st === 'NOT_STARTED' ? 'Not Started' : st === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
                </button>
              ))}
            </div>
          </div>

          <span className="text-xs font-sans text-slate-500">
            Showing <strong className="text-slate-900 font-semibold">{filtered.length}</strong> activities
          </span>
        </div>
      </Card>

      {/* MAIN VIEW: GANTT CHART OR TABLE */}
      {viewMode === 'gantt' ? (
        <Card className="shadow-2xs overflow-hidden">
          {/* Gantt Header Timeline Bar */}
          <div className="bg-slate-50/70 border-b border-slate-200/80 p-3 flex items-center justify-between text-[11px] font-sans">
            <span className="w-72 font-semibold text-slate-600 uppercase tracking-wider pl-2">Activity & WBS Code</span>
            <div className="flex-1 flex justify-between px-4 text-slate-400 font-mono text-[10px]">
              <span>01-Aug</span>
              <span>15-Aug</span>
              <span className="text-[#34C759] font-bold">01-Sep (Today)</span>
              <span>15-Sep</span>
              <span>30-Sep</span>
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
                <div
                  key={activity.id}
                  onClick={() => setSelectedActivity(item)}
                  className={`schedule-row-item flex items-center p-3 hover:bg-slate-50/80 transition-colors duration-150 cursor-pointer ${
                    isSelected ? 'bg-slate-100/90' : ''
                  }`}
                >
                  {/* Left Metadata Info */}
                  <div className="w-72 pr-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{activity.code}</span>
                      <Badge variant="secondary">{activity.discipline}</Badge>
                      {activity.critical_path && (
                        <span title="Critical Path">
                          <Flame className="h-3.5 w-3.5 text-[#FF9500] shrink-0" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 truncate mt-0.5 font-sans font-medium">{activity.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                      <span>{activity.planned_start_date} &rarr; {activity.planned_finish_date}</span>
                      <span>&bull;</span>
                      <span className="font-sans font-semibold text-slate-700">{progress}%</span>
                    </div>
                  </div>

                  {/* Right Timeline Canvas with Gantt Bars */}
                  <div className="flex-1 relative h-8 bg-slate-50/50 rounded-lg overflow-hidden border border-slate-100">
                    {/* Today Vertical Reference Line */}
                    <div 
                      className="absolute top-0 bottom-0 w-px bg-[#34C759] border-r border-dashed border-[#34C759]/60 z-10"
                      style={{ left: `${getTimelineLeftPercent('2026-09-01')}%` }}
                    />

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
                </div>
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
                <TableHead onClick={() => toggleSort('code')} className="cursor-pointer">
                  <div className="flex items-center gap-1">
                    <span>WBS Code</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Activity Name</TableHead>
                <TableHead>Discipline</TableHead>
                <TableHead onClick={() => toggleSort('planned_start_date')} className="cursor-pointer">
                  <div className="flex items-center gap-1">
                    <span>Planned Dates</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => toggleSort('progress')} className="cursor-pointer">
                  <div className="flex items-center gap-1">
                    <span>Progress</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead onClick={() => toggleSort('variance')} className="cursor-pointer text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span>Variance</span>
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
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
                    onClick={() => setSelectedActivity(item)}
                    className="schedule-row-item cursor-pointer"
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
                    <TableCell className="font-mono text-[11px] text-slate-600">
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
                      <span className={variance > 0 ? 'text-[#FF3B30] font-bold' : 'text-[#34C759] font-bold'}>
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
                        className="text-slate-400 hover:text-slate-900"
                        title="Open 360° Activity Detail Drawer"
                      >
                        <Eye className="h-3.5 w-3.5" />
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
    </div>
  );
};

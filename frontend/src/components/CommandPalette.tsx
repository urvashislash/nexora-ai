import React, { useEffect } from 'react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  CheckCircle2, 
  CalendarClock, 
  Network, 
  ShieldCheck, 
  FileDown, 
  UserCheck, 
  Activity
} from 'lucide-react';
import type { ActivityWithState } from '../types';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from './ui/command';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
  activities: ActivityWithState[];
  currentRole: string;
  onSelectRole: (role: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
  activities,
  currentRole: _currentRole,
  onSelectRole
}) => {
  // Global keydown handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <CommandDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <CommandInput placeholder="Search activities, workflows, packages, or switch role..." />
      <CommandList>
        <CommandEmpty>No matching command, activity, or role found.</CommandEmpty>
        
        {/* Navigation Group */}
        <CommandGroup heading="Navigation & Workflows">
          <CommandItem
            onSelect={() => {
              onNavigateTab('dashboard');
              onClose();
            }}
          >
            <LayoutDashboard className="mr-2 h-4 w-4 text-[#C38B4B]" />
            <span>Overview & S-Curve Command Centre</span>
            <CommandShortcut>⌘1</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onNavigateTab('upload');
              onClose();
            }}
          >
            <UploadCloud className="mr-2 h-4 w-4 text-[#007AFF]" />
            <span>Evidence Inbox (DPR / Voice Notes)</span>
            <CommandShortcut>⌘2</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onNavigateTab('review');
              onClose();
            }}
          >
            <CheckCircle2 className="mr-2 h-4 w-4 text-[#34C759]" />
            <span>Planner Review Queue</span>
            <CommandShortcut>⌘3</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onNavigateTab('schedule');
              onClose();
            }}
          >
            <CalendarClock className="mr-2 h-4 w-4 text-purple-600" />
            <span>Schedule Explorer & Gantt Chart</span>
            <CommandShortcut>⌘4</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onNavigateTab('graph');
              onClose();
            }}
          >
            <Network className="mr-2 h-4 w-4 text-[#C38B4B]" />
            <span>Obsidian Dependencies Graph</span>
            <CommandShortcut>⌘5</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onNavigateTab('audit');
              onClose();
            }}
          >
            <ShieldCheck className="mr-2 h-4 w-4 text-emerald-600" />
            <span>Cryptographic Audit Ledger</span>
            <CommandShortcut>⌘6</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onNavigateTab('health');
              onClose();
            }}
          >
            <Activity className="mr-2 h-4 w-4 text-sky-600" />
            <span>System Telemetry & Health</span>
            <CommandShortcut>⌘7</CommandShortcut>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onNavigateTab('export');
              onClose();
            }}
          >
            <FileDown className="mr-2 h-4 w-4 text-slate-600" />
            <span>Exports (Primavera P6 / CSV / JSON)</span>
            <CommandShortcut>⌘8</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        {/* Roles */}
        <CommandGroup heading="Switch Enterprise Persona">
          <CommandItem
            onSelect={() => {
              onSelectRole('Lead Planner');
              onClose();
            }}
          >
            <UserCheck className="mr-2 h-4 w-4 text-[#C38B4B]" />
            <span>Switch Role: Lead Project Planner</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onSelectRole('Field Supervisor');
              onClose();
            }}
          >
            <UserCheck className="mr-2 h-4 w-4 text-sky-600" />
            <span>Switch Role: Field Supervisor</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onSelectRole('Quality Auditor');
              onClose();
            }}
          >
            <UserCheck className="mr-2 h-4 w-4 text-[#34C759]" />
            <span>Switch Role: Quality Auditor</span>
          </CommandItem>

          <CommandItem
            onSelect={() => {
              onSelectRole('Site Engineer');
              onClose();
            }}
          >
            <UserCheck className="mr-2 h-4 w-4 text-purple-600" />
            <span>Switch Role: Site Engineer</span>
          </CommandItem>
        </CommandGroup>

        {/* Activities Quick Jump */}
        {activities.length > 0 && (
          <CommandGroup heading="Schedule Activities Quick Jump">
            {activities.slice(0, 10).map((act) => (
              <CommandItem
                key={act.activity.id}
                onSelect={() => {
                  onNavigateTab('schedule');
                  onClose();
                }}
              >
                <span className="font-mono font-bold text-slate-900 mr-2 text-[11px]">
                  {act.activity.code}
                </span>
                <span className="truncate text-slate-700">{act.activity.name}</span>
                <span className="ml-auto text-[10px] text-slate-400 font-sans uppercase">
                  {act.activity.discipline}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
};

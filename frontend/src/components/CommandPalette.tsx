import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
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
  currentRole,
  onSelectRole
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Global keydown handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(); // parent handles toggle
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Build command items
  const items = React.useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      category: string;
      icon: React.ElementType;
      action: () => void;
    }> = [
      // Navigation
      { id: 'nav-dash', title: 'Go to Overview & S-Curve', category: 'Navigation', icon: LayoutDashboard, action: () => { onNavigateTab('dashboard'); onClose(); } },
      { id: 'nav-graph', title: 'Open Dependencies Graph', category: 'Navigation', icon: Network, action: () => { onNavigateTab('graph'); onClose(); } },
      { id: 'nav-upload', title: 'Open Evidence Inbox', category: 'Navigation', icon: UploadCloud, action: () => { onNavigateTab('upload'); onClose(); } },
      { id: 'nav-review', title: 'Open Planner Review Queue', category: 'Navigation', icon: CheckCircle2, action: () => { onNavigateTab('review'); onClose(); } },
      { id: 'nav-sched', title: 'Open Schedule & Gantt Explorer', category: 'Navigation', icon: CalendarClock, action: () => { onNavigateTab('schedule'); onClose(); } },
      { id: 'nav-audit', title: 'View Cryptographic Audit Ledger', category: 'Navigation', icon: ShieldCheck, action: () => { onNavigateTab('audit'); onClose(); } },
      { id: 'nav-health', title: 'View System Health & Telemetry', category: 'Navigation', icon: Activity, action: () => { onNavigateTab('health'); onClose(); } },
      { id: 'nav-export', title: 'Export Schedule & Observations', category: 'Navigation', icon: FileDown, action: () => { onNavigateTab('export'); onClose(); } },

      // Demo Roles
      { id: 'role-planner', title: 'Switch Role: Lead Planner', category: 'Role Switcher', icon: UserCheck, action: () => { onSelectRole('Lead Planner'); onClose(); } },
      { id: 'role-supervisor', title: 'Switch Role: Field Supervisor', category: 'Role Switcher', icon: UserCheck, action: () => { onSelectRole('Field Supervisor'); onClose(); } },
      { id: 'role-auditor', title: 'Switch Role: Quality Auditor', category: 'Role Switcher', icon: UserCheck, action: () => { onSelectRole('Quality Auditor'); onClose(); } },
      { id: 'role-engineer', title: 'Switch Role: Site Engineer', category: 'Role Switcher', icon: UserCheck, action: () => { onSelectRole('Site Engineer'); onClose(); } },
    ];

    // Activity Quick Jump
    activities.forEach(act => {
      list.push({
        id: `act-${act.activity.id}`,
        title: `${act.activity.code}: ${act.activity.name}`,
        category: `Activities (${act.activity.discipline})`,
        icon: Activity,
        action: () => {
          onNavigateTab('schedule');
          onClose();
        }
      });
    });

    if (!query.trim()) return list;

    const q = query.toLowerCase();
    return list.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q)
    );
  }, [activities, query, onNavigateTab, onSelectRole, onClose]);

  // Arrow key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Palette Dialog */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden z-10 font-sans">
        
        {/* Search Header */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100">
          <Search className="h-4 w-4 text-slate-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, jump to activity, or switch role..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-sm font-sans placeholder-slate-400 text-slate-900 focus:outline-hidden"
          />
          <kbd className="px-2 py-0.5 text-[10px] font-sans font-semibold text-slate-400 bg-slate-100 rounded-md border border-slate-200/60 shadow-2xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-50">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs font-sans text-slate-400">
              No matching commands or activities found.
            </div>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150 text-xs ${
                    isSelected ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center space-x-3 truncate">
                    <Icon className={`h-4 w-4 ${isSelected ? 'text-[#C38B4B]' : 'text-slate-400'} shrink-0`} />
                    <span className="truncate">{item.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 ml-2 shrink-0 font-sans">
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-[11px] font-sans text-slate-400">
          <div className="flex items-center gap-2">
            <span>Current Role:</span>
            <span className="font-semibold text-slate-700">{currentRole}</span>
          </div>
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
        </div>

      </div>
    </div>
  );
};

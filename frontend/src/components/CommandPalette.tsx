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
      { id: 'nav-dash', title: 'Go to Command Centre', category: 'Navigation', icon: LayoutDashboard, action: () => { onNavigateTab('dashboard'); onClose(); } },
      { id: 'nav-graph', title: 'Open Obsidian Network Graph', category: 'Navigation', icon: Network, action: () => { onNavigateTab('graph'); onClose(); } },
      { id: 'nav-upload', title: 'Open Evidence Inbox', category: 'Navigation', icon: UploadCloud, action: () => { onNavigateTab('upload'); onClose(); } },
      { id: 'nav-review', title: 'Open Planner Review Queue', category: 'Navigation', icon: CheckCircle2, action: () => { onNavigateTab('review'); onClose(); } },
      { id: 'nav-sched', title: 'Open Schedule Explorer', category: 'Navigation', icon: CalendarClock, action: () => { onNavigateTab('schedule'); onClose(); } },
      { id: 'nav-audit', title: 'View Cryptographic Audit Trail', category: 'Navigation', icon: ShieldCheck, action: () => { onNavigateTab('audit'); onClose(); } },
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

    const lower = query.toLowerCase();
    return list.filter(item => 
      item.title.toLowerCase().includes(lower) || 
      item.category.toLowerCase().includes(lower)
    );
  }, [activities, query, onNavigateTab, onSelectRole, onClose]);

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (items.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + items.length) % (items.length || 1));
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      e.preventDefault();
      items[selectedIndex].action();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3">
          <Search className="h-4 w-4 text-[#C38B4B] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, search activities, or switch roles..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDownList}
            className="w-full text-sm font-mono bg-transparent focus:outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
            <span>ESC to close</span>
          </div>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
          {items.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-400">
              No matching commands or activities found for "{query}".
            </div>
          ) : (
            items.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono transition cursor-pointer text-left ${
                    isSelected
                      ? 'bg-slate-900 text-white font-bold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-[#C38B4B]' : 'text-slate-400'}`} />
                    <span className="truncate">{item.title}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded shrink-0 ml-2 ${
                    isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Palette Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span>Current Role:</span>
            <span className="text-slate-900 font-bold">{currentRole}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Use ↑↓ to navigate • ↵ to select</span>
          </div>
        </div>
      </div>
    </div>
  );
};

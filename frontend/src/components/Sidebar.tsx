import React from 'react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  CheckCircle2, 
  CalendarClock, 
  ShieldCheck, 
  FileDown,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingReviewCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, pendingReviewCount }) => {
  const navItems = [
    { id: 'dashboard', label: 'Command Centre', icon: LayoutDashboard },
    { id: 'upload', label: 'Evidence Inbox', icon: UploadCloud },
    { 
      id: 'review', 
      label: 'Planner Review', 
      icon: CheckCircle2,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined 
    },
    { id: 'schedule', label: 'Project Explorer', icon: CalendarClock },
    { id: 'audit', label: 'Audit & Traceability', icon: ShieldCheck },
    { id: 'export', label: 'System Health', icon: FileDown },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
      {/* Brand & Project Info */}
      <div className="flex flex-col p-6 border-b border-slate-200">
        <div className="flex items-center space-x-3 mb-4">
          {/* N-shaped survey bracket logo */}
          <div className="relative flex h-8 w-8 items-center justify-center shrink-0">
            <div className="absolute left-1 top-1 bottom-1 w-1.5 bg-slate-800 rounded-sm" />
            <div className="absolute right-1 top-1 bottom-1 w-1.5 bg-slate-800 rounded-sm" />
            <div className="absolute inset-0 m-auto h-[2.5px] w-6 bg-[#C38B4B] rotate-[-45deg] origin-center z-10" />
            <div className="absolute right-0 bottom-0 h-2 w-2 bg-[#C38B4B] rounded-sm z-20" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight text-slate-900">NEXORA</span>
            </div>
          </div>
        </div>
        <div className="bg-slate-200/50 p-2.5 rounded border border-slate-200">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold font-mono mb-1">Active Project</p>
          <p className="text-xs text-slate-800 font-medium leading-tight">Paradip-Hyderabad Refinery Expansion</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase font-mono tracking-wider font-semibold text-slate-400 mb-3 px-2">
          [ Operations ]
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`group w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-white shadow-sm border border-slate-200 text-slate-900 font-medium'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`h-4 w-4 ${isActive ? 'text-[#C38B4B]' : 'text-slate-400 group-hover:text-slate-600'}`} />
                <span>{item.label}</span>
              </div>
              <div className="flex items-center space-x-2">
                {item.badge !== undefined && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded bg-amber-100 px-1.5 text-[11px] font-mono font-bold text-amber-800 border border-amber-200">
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="h-4 w-4 text-slate-300" />}
              </div>
            </button>
          );
        })}
      </nav>

      {/* User & Trust Level Indicator */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="flex items-center space-x-2 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-800 mb-3">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="font-semibold font-mono uppercase tracking-wider text-[10px]">Rust Trust Layer: Active</span>
        </div>
        <div className="flex items-center space-x-3 px-2 mb-3">
          <div className="h-8 w-8 rounded bg-slate-200 border border-slate-300 flex items-center justify-center text-xs font-bold text-slate-600 font-mono">
            RS
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-800">Rahul Sharma</span>
            <span className="text-[10px] text-slate-500 font-mono">Lead Planner</span>
          </div>
        </div>
        <a
          href="https://github.com/urvashislash/nexora-ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <svg className="h-4 w-4 fill-slate-700" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span className="font-mono text-[11px]">GitHub Repository</span>
          </div>
          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
        </a>
      </div>
    </aside>
  );
};

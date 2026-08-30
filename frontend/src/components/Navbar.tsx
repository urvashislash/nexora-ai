import React from 'react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  CheckCircle2, 
  CalendarClock, 
  ShieldCheck, 
  FileDown, 
  Activity as ActivityIcon
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingReviewCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, pendingReviewCount }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Ingestion & Upload', icon: UploadCloud },
    { 
      id: 'review', 
      label: 'Planner Review', 
      icon: CheckCircle2,
      badge: pendingReviewCount > 0 ? pendingReviewCount : undefined 
    },
    { id: 'schedule', label: 'WBS & Schedule', icon: CalendarClock },
    { id: 'audit', label: 'Audit Ledger', icon: ShieldCheck },
    { id: 'export', label: 'P6 / PMIS Export', icon: FileDown },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand & Project Info */}
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-lg shadow-sky-500/20">
            <ActivityIcon className="h-6 w-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-lg font-bold tracking-tight text-white">NEXORA<span className="text-sky-400">.AI</span></span>
              <span className="rounded bg-sky-950 px-1.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-800/50">SIH MVP</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Paradip-Hyderabad Refinery Expansion (Pkg 04)</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 rounded-xl bg-slate-900/60 p-1 border border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-slate-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User & Trust Level Indicator */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50 px-2.5 py-1 text-xs text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">Rust Trust Layer Active</span>
          </div>
          <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-sky-400">
            RS
          </div>
        </div>
      </div>
    </header>
  );
};

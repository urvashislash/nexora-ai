import React from 'react';
import { 
  LayoutDashboard, 
  Network, 
  UploadCloud, 
  CheckSquare, 
  Calendar, 
  FileText, 
  Activity, 
  Download,
  KeyRound,
  LogOut,
  User,
  Building2
} from 'lucide-react';
import type { Project, AuthUser } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingReviewCount: number;
  activeProject?: Project;
  user?: AuthUser | null;
  onOpenAuth?: () => void;
  onOpenJwt?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  pendingReviewCount,
  activeProject,
  user,
  onOpenAuth,
  onOpenJwt,
  onLogout
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, category: 'OPERATIONS' },
    { id: 'upload', label: 'Evidence', icon: UploadCloud, category: 'OPERATIONS' },
    { id: 'review', label: 'Planner Review', icon: CheckSquare, count: pendingReviewCount, category: 'OPERATIONS' },
    { id: 'schedule', label: 'Schedule', icon: Calendar, category: 'OPERATIONS' },
    { id: 'graph', label: 'Dependencies', icon: Network, category: 'OPERATIONS' },
    { id: 'audit', label: 'Audit Ledger', icon: FileText, category: 'OPERATIONS' },
    { id: 'health', label: 'System Health', icon: Activity, category: 'SYSTEM' },
    { id: 'export', label: 'Exports', icon: Download, category: 'SYSTEM' },
  ];

  const operationsItems = navItems.filter(i => i.category === 'OPERATIONS');
  const systemItems = navItems.filter(i => i.category === 'SYSTEM');

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-200 bg-white flex flex-col justify-between z-40 select-none">
      {/* Top Brand Header */}
      <div>
        <div className="flex h-14 items-center px-6 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-slate-900 text-[11px] font-bold text-white shadow-xs">
              N
            </span>
            <span className="font-bold tracking-tight text-slate-900 text-sm font-sans">
              NEXORA <span className="text-[#C38B4B] text-xs font-mono font-semibold">AI</span>
            </span>
          </div>
        </div>

        {/* Project Selector Eyebrow in Sidebar */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/60">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block font-semibold">
            Active Package
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Building2 className="h-3 w-3 text-[#C38B4B] shrink-0" />
            <span className="text-xs font-semibold text-slate-800 truncate" title={activeProject?.name}>
              {activeProject?.code || 'PRD-HYD-PKG04'}
            </span>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="px-3 py-4 space-y-6">
          {/* Operations Group */}
          <div>
            <span className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Operations
            </span>
            <nav className="space-y-0.5">
              {operationsItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-[#C38B4B]' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.count !== undefined && item.count > 0 && (
                      <span className={`rounded-full px-2 py-0.2 text-[10px] font-mono font-bold ${
                        isActive ? 'bg-[#C38B4B] text-slate-950' : 'bg-amber-100 text-amber-900'
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* System Group */}
          <div>
            <span className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              System
            </span>
            <nav className="space-y-0.5">
              {systemItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-[#C38B4B]' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom Area: Trust Status & User Persona */}
      <div className="border-t border-slate-100 p-4 space-y-3 bg-slate-50/50">
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center space-x-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-700 font-semibold">Trust Plane Online</span>
          </div>
          <span className="text-[10px] text-slate-400">PostgreSQL 15</span>
        </div>

        {/* User Identity Chip */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
          <div 
            onClick={onOpenJwt} 
            className="flex items-center space-x-2 truncate cursor-pointer hover:opacity-80 transition"
            title="Inspect Cryptographic JWT Claims"
          >
            <div className="h-6 w-6 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5 text-slate-600" />
            </div>
            <div className="truncate">
              <span className="text-xs font-bold text-slate-900 block truncate">
                {user?.full_name?.split(' (')[0] || 'Vikram Singh'}
              </span>
              <span className="text-[10px] font-mono text-slate-400 block">
                {user?.role || 'LEAD_PLANNER'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {onOpenJwt && (
              <button 
                onClick={onOpenJwt}
                className="p-1 text-slate-400 hover:text-[#C38B4B] transition"
                title="Inspect RFC 7519 JWT"
              >
                <KeyRound className="h-3.5 w-3.5" />
              </button>
            )}
            {user ? (
              <button 
                onClick={onLogout}
                className="p-1 text-slate-400 hover:text-rose-600 transition"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button 
                onClick={onOpenAuth}
                className="text-[11px] font-mono text-[#C38B4B] font-bold hover:underline"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};

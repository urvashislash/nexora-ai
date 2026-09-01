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
  Building2,
  ExternalLink
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
    <aside className="fixed left-0 top-0 h-screen w-64 border-r border-slate-200/80 bg-white flex flex-col justify-between z-40 select-none">
      {/* Top Brand & Package Section */}
      <div>
        <div className="flex h-14 items-center px-6 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#18181B] text-[11px] font-bold text-white shadow-xs">
              N
            </span>
            <span className="font-semibold tracking-tight text-slate-900 text-sm font-sans">
              NEXORA <span className="text-[#C38B4B] text-xs font-semibold ml-0.5">AI</span>
            </span>
          </div>
        </div>

        {/* Project Selector Eyebrow */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <span className="text-[10px] font-sans text-slate-400 uppercase tracking-wider block font-semibold">
            Active Package
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Building2 className="h-3.5 w-3.5 text-[#C38B4B] shrink-0" />
            <span className="text-xs font-medium text-slate-800 truncate font-sans" title={activeProject?.name}>
              {activeProject?.code || 'PRD-HYD-PKG04'}
            </span>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="px-3 py-4 space-y-6">
          {/* Operations Group */}
          <div>
            <span className="px-3 text-[10px] font-sans font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
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
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-sans tracking-tight transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-[#18181B] text-white shadow-2xs font-medium'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-[#C38B4B]' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.count !== undefined && item.count > 0 && (
                      <span className={`rounded-full px-2 py-0.2 text-[10px] font-sans font-semibold ${
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
            <span className="px-3 text-[10px] font-sans font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
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
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-sans tracking-tight transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-[#18181B] text-white shadow-2xs font-medium'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
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

      {/* Bottom Area: Trust Status, User Persona & GitHub Repo */}
      <div className="border-t border-slate-100 p-3.5 space-y-2.5 bg-slate-50/40">
        {/* Trust Plane Online Indicator */}
        <div className="flex items-center justify-between px-1 text-[11px] font-sans text-slate-500">
          <div className="flex items-center space-x-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#34C759] animate-pulse" />
            <span className="text-slate-700 font-medium">Trust Plane Online</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">PostgreSQL 15</span>
        </div>

        {/* User Profile Card */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <div 
            onClick={onOpenJwt} 
            className="flex items-center space-x-2.5 truncate cursor-pointer hover:opacity-80 transition"
            title="Inspect Cryptographic JWT Claims"
          >
            <div className="h-7 w-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
              <User className="h-3.5 w-3.5 text-slate-600" />
            </div>
            <div className="truncate">
              <span className="text-xs font-semibold text-slate-900 block truncate font-sans">
                {user?.full_name?.split(' (')[0] || 'Vikram Singh'}
              </span>
              <span className="text-[10px] text-slate-500 block font-sans">
                {user?.role ? user.role.replace(/_/g, ' ') : 'Lead Planner'}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-0.5">
            {onOpenJwt && (
              <button 
                onClick={onOpenJwt}
                className="p-1.5 rounded-md text-slate-400 hover:text-[#C38B4B] hover:bg-slate-50 transition cursor-pointer"
                title="Inspect RFC 7519 JWT"
              >
                <KeyRound className="h-3.5 w-3.5" />
              </button>
            )}
            {user ? (
              <button 
                onClick={onLogout}
                className="p-1.5 rounded-md text-slate-400 hover:text-[#FF3B30] hover:bg-slate-50 transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button 
                onClick={onOpenAuth}
                className="text-[11px] font-sans text-[#C38B4B] font-semibold hover:underline px-1.5 py-0.5 cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* 1. RESTORED GITHUB REPOSITORY LINK (Directly below profile card) */}
        <a
          href="https://github.com/urvashislash/nexora-ai"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-sans text-slate-500 hover:text-slate-900 hover:bg-slate-100/80 transition group cursor-pointer"
          title="Open NEXORA AI GitHub Repository"
        >
          <div className="flex items-center space-x-2">
            <svg className="h-3.5 w-3.5 fill-slate-500 group-hover:fill-slate-900 transition" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span className="font-normal text-[11px]">GitHub Repository</span>
          </div>
          <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-slate-600 transition" />
        </a>
      </div>
    </aside>
  );
};

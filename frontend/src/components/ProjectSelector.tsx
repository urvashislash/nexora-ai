import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  FolderPlus, 
  Check, 
  Building2, 
  Search
} from 'lucide-react';
import type { Project } from '../types';

interface ProjectSelectorProps {
  projects: Project[];
  activeProject: Project;
  onSelectProject: (project: Project) => void;
  onOpenCreateProject: () => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenCreateProject,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredProjects = projects.filter(
    (p) =>
      p.code.toLowerCase().includes(query.toLowerCase()) ||
      p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative font-sans" ref={dropdownRef}>
      {/* Project Selector Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white hover:bg-slate-50/80 px-3 py-1.5 text-xs font-sans text-slate-800 transition-all duration-150 shadow-2xs group cursor-pointer active:scale-[0.98]"
      >
        <Building2 className="h-3.5 w-3.5 text-[#C38B4B]" />
        <div className="flex items-center gap-1.5 text-left">
          <span className="font-semibold text-slate-900">{activeProject.code}</span>
          <span className="text-slate-300 font-normal">·</span>
          <span className="max-w-[140px] sm:max-w-[200px] truncate text-slate-600 font-normal">
            {activeProject.name}
          </span>
        </div>
        <ChevronDown className={`h-3 w-3 text-slate-400 group-hover:text-slate-700 transition duration-150 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 rounded-2xl border border-slate-200/80 bg-white shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="relative mb-2">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search packages by code or name..."
              className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs font-sans text-slate-900 placeholder:text-slate-400 focus:border-[#C38B4B] focus:outline-hidden"
              autoFocus
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
            {filteredProjects.map((p) => {
              const isSelected = p.id === activeProject.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-xl p-2.5 text-left transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-100 text-slate-900 font-medium'
                      : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-900 font-sans">
                        {p.code}
                      </span>
                      {isSelected && (
                        <span className="rounded-md bg-emerald-50 text-[#34C759] border border-emerald-200/80 px-1.5 py-0.2 text-[9px] font-sans font-semibold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate font-sans mt-0.5">
                      {p.name}
                    </p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-[#34C759] shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>

          <div className="mt-2 pt-2 border-t border-slate-100">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenCreateProject();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/70 py-2 text-xs font-sans font-semibold text-slate-800 transition cursor-pointer active:scale-[0.98]"
            >
              <FolderPlus className="h-3.5 w-3.5 text-[#C38B4B]" />
              <span>Create New Project Package</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

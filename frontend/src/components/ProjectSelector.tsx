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
    <div className="relative" ref={dropdownRef}>
      {/* Project Selector Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800/90 px-3 py-1.5 text-xs font-mono text-slate-200 transition shadow-xs group"
      >
        <Building2 className="h-3.5 w-3.5 text-[#C38B4B]" />
        <div className="flex items-center gap-1.5 text-left">
          <span className="font-bold text-[#C38B4B]">[{activeProject.code}]</span>
          <span className="max-w-[140px] sm:max-w-[200px] truncate text-slate-300">
            {activeProject.name}
          </span>
        </div>
        <ChevronDown className={`h-3 w-3 text-slate-400 group-hover:text-white transition ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects by code or name..."
              className="w-full rounded-md border border-slate-800 bg-slate-950 pl-8 pr-2.5 py-1.5 text-xs font-mono text-white placeholder:text-slate-600 focus:border-[#C38B4B] focus:outline-hidden"
              autoFocus
            />
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1">
            {filteredProjects.map((p) => {
              const isSelected = p.id === activeProject.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between rounded-lg p-2 text-left transition ${
                    isSelected
                      ? 'bg-[#C38B4B]/15 border border-[#C38B4B]/30 text-white'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#C38B4B]">
                        {p.code}
                      </span>
                      {isSelected && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-mono text-emerald-400">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] truncate text-slate-400">{p.name}</p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-[#C38B4B] shrink-0 ml-2" />}
                </button>
              );
            })}

            {filteredProjects.length === 0 && (
              <p className="py-3 text-center text-xs font-mono text-slate-500">
                No matching projects found
              </p>
            )}
          </div>

          {/* New Project Action */}
          <div className="border-t border-slate-800 pt-1.5 mt-1.5">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenCreateProject();
              }}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 hover:bg-[#C38B4B] hover:text-slate-950 py-2 text-xs font-mono font-semibold text-white transition group"
            >
              <FolderPlus className="h-3.5 w-3.5 group-hover:scale-110 transition" />
              <span>+ Create New Project</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { 
  ChevronDown, 
  FolderPlus, 
  Check, 
  Building2, 
  Search
} from 'lucide-react';
import type { Project } from '../types';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './ui/dropdown-menu';

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
  const [query, setQuery] = useState('');

  const filteredProjects = projects.filter(
    (p) =>
      p.code.toLowerCase().includes(query.toLowerCase()) ||
      p.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Switch project: ${activeProject.code}`}
          className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-xs font-sans text-slate-800 shadow-2xs transition-all duration-150 hover:bg-slate-50/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-500 sm:px-3"
        >
          <Building2 className="h-3.5 w-3.5 text-amber-800" aria-hidden="true" />
          <div className="flex min-w-0 items-center gap-1.5 text-left">
            <span className="shrink-0 font-semibold text-slate-900">{activeProject.code}</span>
            <span className="hidden text-slate-400 font-normal sm:inline">·</span>
            <span className="hidden max-w-[200px] truncate text-slate-600 font-normal sm:inline">
              {activeProject.name}
            </span>
          </div>
          <ChevronDown className="h-3 w-3 text-slate-500 group-hover:text-slate-800 transition duration-150" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-80 p-2.5 rounded-2xl font-sans">
        <DropdownMenuLabel>Projects</DropdownMenuLabel>
        
        {/* Search inside Dropdown */}
        <div className="relative mb-2 px-1">
          <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <input
            type="text"
            aria-label="Filter projects list"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter projects..."
            className="w-full rounded-xl border border-slate-200/80 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs font-sans text-slate-900 placeholder:text-slate-400 focus:border-[#C38B4B] focus:outline-hidden"
            autoFocus
          />
        </div>

        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {filteredProjects.map((p) => {
            const isSelected = p.id === activeProject.id;
            return (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => onSelectProject(p)}
                className={`flex items-center justify-between rounded-xl p-2.5 text-left cursor-pointer ${
                  isSelected ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-700'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900 font-sans">
                      {p.code}
                    </span>
                    {isSelected && (
                      <span className="rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200/80 px-1.5 py-0.2 text-[9px] font-sans font-semibold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 truncate font-sans mt-0.5 font-normal">
                    {p.name}
                  </p>
                </div>
                {isSelected && <Check className="h-4 w-4 text-emerald-800 shrink-0 ml-2" aria-hidden="true" />}
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="my-1.5" />

        <DropdownMenuItem
          onSelect={onOpenCreateProject}
          className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium text-amber-900 hover:text-amber-950 hover:bg-amber-50 cursor-pointer"
        >
          <FolderPlus className="h-4 w-4 text-amber-800" aria-hidden="true" />
          <span>Provision New Project...</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

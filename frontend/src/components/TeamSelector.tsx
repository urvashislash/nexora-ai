import React, { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, Check, Plus, Settings, Users } from 'lucide-react';
import { useTeam } from '../contexts/TeamContext';
import { Badge } from './ui/badge';

interface TeamSelectorProps {
  onOpenSettings?: () => void;
}

export const TeamSelector: React.FC<TeamSelectorProps> = ({ onOpenSettings }) => {
  const { teamsList, activeTeam, selectTeam, openCreateTeamModal, currentTeamRole } = useTeam();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/80 text-left transition-colors duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-slate-400"
      >
        <div className="p-1 rounded-md bg-white border border-slate-200/70 text-slate-700 shadow-2xs">
          <Building2 className="w-3.5 h-3.5 text-amber-800" aria-hidden="true" />
        </div>
        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-900 truncate max-w-[130px] font-sans">
              {activeTeam ? activeTeam.name : 'Select Team'}
            </span>
            {currentTeamRole && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 uppercase font-mono">
                {currentTeamRole}
              </Badge>
            )}
          </div>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Select active team"
          className="absolute left-0 mt-1.5 w-64 rounded-2xl bg-white border border-slate-200 shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            Your Teams
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
            {teamsList.map((team) => {
              const isSelected = activeTeam?.id === team.id;
              return (
                <button
                  key={team.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    selectTeam(team);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition hover:bg-slate-50 ${
                    isSelected ? 'bg-amber-50/60 font-semibold text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span className="truncate">{team.name}</span>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-amber-700 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="border-t border-slate-100 pt-1 mt-1 space-y-0.5 px-1">
            {activeTeam && onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition font-sans"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                <span>Team Settings</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openCreateTeamModal();
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-amber-900 hover:bg-amber-50 transition font-sans"
            >
              <Plus className="w-3.5 h-3.5 text-amber-800" aria-hidden="true" />
              <span>Create New Team</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

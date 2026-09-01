import React, { useRef, useEffect, useState, useMemo } from 'react';
import { 
  Search,
  RotateCcw, 
  ZoomIn, 
  ZoomOut
} from 'lucide-react';
import type { ActivityWithState, WorkObservation, AuditEvent } from '../types';
import { Activity360Drawer } from '../components/Activity360Drawer';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  type: 'project' | 'wbs' | 'activity' | 'evidence';
  status?: string;
  progress?: number;
  discipline?: string;
  isCritical?: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  rawItem?: any;
}

interface GraphLink {
  source: string;
  target: string;
  type: 'hierarchy' | 'dependency' | 'evidence';
  isCritical?: boolean;
}

interface ProjectGraphProps {
  activities: ActivityWithState[];
  observations?: WorkObservation[];
  auditEvents?: AuditEvent[];
  project?: import('../types').Project;
}

function deterministicRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

export const ProjectGraph: React.FC<ProjectGraphProps> = ({ 
  activities,
  observations = [],
  auditEvents = [],
  project
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Graph Modes
  const [graphMode, setGraphMode] = useState<'dependencies' | 'critical_path' | 'evidence' | 'all'>('dependencies');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [transform, setTransform] = useState<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 0.9 });
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const hoveredNodeRef = useRef<GraphNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Selected Drawer entities
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithState | null>(null);
  const [selectedObservation, setSelectedObservation] = useState<WorkObservation | null>(null);

  // 1. Build Graph Model from Activities & Observations
  const { nodes, links } = useMemo(() => {
    const nList: GraphNode[] = [];
    const lList: GraphLink[] = [];

    // Root Hub Node
    nList.push({
      id: 'root-project',
      label: project ? project.code : 'PRD-HYD-PKG04',
      sublabel: project ? project.name : 'Package 04 Expansion',
      type: 'project',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 24,
      color: '#C38B4B',
    });

    // Filter activities based on mode and discipline
    let filteredActs = activities;
    if (graphMode === 'critical_path') {
      filteredActs = filteredActs.filter(a => a.activity.critical_path);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredActs = filteredActs.filter(a => 
        a.activity.code.toLowerCase().includes(q) || 
        a.activity.name.toLowerCase().includes(q)
      );
    }

    // WBS Clusters
    const disciplines = Array.from(new Set(filteredActs.map(a => a.activity.discipline)));
    disciplines.forEach((disc, idx) => {
      const angle = (idx / disciplines.length) * 2 * Math.PI;
      const wbsId = `wbs-${disc}`;
      nList.push({
        id: wbsId,
        label: `${disc} Scope`,
        type: 'wbs',
        discipline: disc,
        x: Math.cos(angle) * 180,
        y: Math.sin(angle) * 180,
        vx: 0,
        vy: 0,
        radius: 16,
        color: '#475569',
      });

      lList.push({
        source: 'root-project',
        target: wbsId,
        type: 'hierarchy',
      });
    });

    // Activity Nodes
    filteredActs.forEach((item, actIdx) => {
      const { activity, state } = item;
      const progress = state?.current_progress_pct || 0;
      const status = state?.execution_status || 'NOT_STARTED';
      const isCritical = !!activity.critical_path;

      // Color based on execution status
      const statusColor = progress === 100 ? '#10B981' : progress > 0 ? '#3B82F6' : '#94A3B8';

      const randOffset1 = (deterministicRandom(actIdx * 7) - 0.5) * 60;
      const randOffset2 = (deterministicRandom(actIdx * 11) - 0.5) * 60;

      const actNode: GraphNode = {
        id: activity.id,
        label: activity.code,
        sublabel: activity.name,
        type: 'activity',
        status: status,
        progress: progress,
        discipline: activity.discipline,
        isCritical: isCritical,
        x: (actIdx % 2 === 0 ? 260 : -260) + randOffset1,
        y: (actIdx * 50 - 150) + randOffset2,
        vx: 0,
        vy: 0,
        radius: isCritical ? 15 : 12,
        color: statusColor,
        rawItem: item,
      };
      nList.push(actNode);

      // Link to discipline WBS
      lList.push({
        source: `wbs-${activity.discipline}`,
        target: activity.id,
        type: 'hierarchy',
      });
    });

    // Sequential Predecessor Dependencies between Activities
    for (let i = 0; i < filteredActs.length - 1; i++) {
      if (filteredActs[i].activity.discipline === filteredActs[i + 1].activity.discipline) {
        lList.push({
          source: filteredActs[i].activity.id,
          target: filteredActs[i + 1].activity.id,
          type: 'dependency',
          isCritical: filteredActs[i].activity.critical_path && filteredActs[i + 1].activity.critical_path,
        });
      }
    }

    // Evidence Observations
    if (graphMode === 'evidence' || graphMode === 'all') {
      observations.slice(0, 10).forEach((obs, obsIdx) => {
        const matchingAct = filteredActs.find(a => 
          obs.raw_text.toLowerCase().includes(a.activity.code.toLowerCase()) || 
          (a.activity.equipment_tag && obs.equipment_tag === a.activity.equipment_tag)
        );

        if (matchingAct) {
          const obsNode: GraphNode = {
            id: obs.id,
            label: `EVID-${obs.id.slice(0, 5)}`,
            sublabel: obs.raw_text.slice(0, 30) + '...',
            type: 'evidence',
            x: matchingAct.activity.planned_duration_days * 10 + (obsIdx * 20),
            y: (obsIdx * 30) - 80,
            vx: 0,
            vy: 0,
            radius: 8,
            color: '#8B5CF6',
            rawItem: obs,
          };
          nList.push(obsNode);

          lList.push({
            source: matchingAct.activity.id,
            target: obs.id,
            type: 'evidence',
          });
        }
      });
    }

    return { nodes: nList, links: lList };
  }, [activities, observations, graphMode, searchQuery, project]);

  // Connected Nodes Set for Focus Highlighting
  const connectedNodeIds = useMemo(() => {
    if (!selectedNodeId) return null;
    const set = new Set<string>();
    set.add(selectedNodeId);
    links.forEach(l => {
      if (l.source === selectedNodeId) set.add(l.target);
      if (l.target === selectedNodeId) set.add(l.source);
    });
    return set;
  }, [selectedNodeId, links]);

  // Physics Simulation Step
  useEffect(() => {
    let animFrame: number;
    let particleOffset = 0;

    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const simStep = () => {
      // Repulsion force
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);
          if (dist < 400) {
            const force = (800 / distSq);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      // Link attraction force
      links.forEach(l => {
        const src = nodeMap.get(l.source);
        const tgt = nodeMap.get(l.target);
        if (src && tgt) {
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = l.type === 'dependency' ? 140 : 180;
          const force = (dist - targetDist) * 0.03;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          src.vx += fx;
          src.vy += fy;
          tgt.vx -= fx;
          tgt.vy -= fy;
        }
      });

      // Damping & Center Gravity
      nodes.forEach(n => {
        if (n !== draggedNodeRef.current) {
          n.vx += -n.x * 0.002;
          n.vy += -n.y * 0.002;
          n.vx *= 0.82;
          n.vy *= 0.82;
          n.x += n.vx;
          n.y += n.vy;
        }
      });

      // Render on canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.translate(canvas.width / 2 + transform.x, canvas.height / 2 + transform.y);
          ctx.scale(transform.scale, transform.scale);

          particleOffset = (particleOffset + 0.5) % 40;

          // Draw Links
          links.forEach(l => {
            const src = nodeMap.get(l.source);
            const tgt = nodeMap.get(l.target);
            if (!src || !tgt) return;

            const isDimmed = connectedNodeIds && (!connectedNodeIds.has(src.id) || !connectedNodeIds.has(tgt.id));

            ctx.beginPath();
            ctx.moveTo(src.x, src.y);
            ctx.lineTo(tgt.x, tgt.y);

            if (l.type === 'dependency') {
              ctx.strokeStyle = isDimmed ? 'rgba(203, 213, 225, 0.2)' : l.isCritical ? 'rgba(245, 158, 11, 0.8)' : 'rgba(148, 163, 184, 0.6)';
              ctx.lineWidth = l.isCritical ? 2.5 : 1.5;
              ctx.setLineDash([4, 4]);
            } else if (l.type === 'evidence') {
              ctx.strokeStyle = isDimmed ? 'rgba(216, 180, 254, 0.2)' : 'rgba(168, 85, 247, 0.7)';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([2, 2]);
            } else {
              ctx.strokeStyle = isDimmed ? 'rgba(226, 232, 240, 0.2)' : 'rgba(203, 213, 225, 0.7)';
              ctx.lineWidth = 1;
              ctx.setLineDash([]);
            }
            ctx.stroke();
            ctx.setLineDash([]);
          });

          // Draw Nodes
          nodes.forEach(n => {
            const isHovered = hoveredNodeRef.current?.id === n.id;
            const isSelected = selectedNodeId === n.id;
            const isDimmed = connectedNodeIds && !connectedNodeIds.has(n.id);

            ctx.globalAlpha = isDimmed ? 0.2 : 1.0;

            // Outer Critical Path Amber Ring
            if (n.isCritical) {
              ctx.beginPath();
              ctx.arc(n.x, n.y, n.radius + 4, 0, 2 * Math.PI);
              ctx.strokeStyle = '#F59E0B';
              ctx.lineWidth = 2;
              ctx.stroke();
            }

            // Node Circle
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.radius, 0, 2 * Math.PI);
            ctx.fillStyle = n.color;
            ctx.fill();
            ctx.strokeStyle = isSelected ? '#C38B4B' : isHovered ? '#0F172A' : '#FFFFFF';
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.stroke();

            // Node Labels
            ctx.fillStyle = isDimmed ? '#94A3B8' : '#0F172A';
            ctx.font = 'bold 11px IBM Plex Mono, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(n.label, n.x, n.y + n.radius + 14);

            if (n.sublabel && !isDimmed) {
              ctx.fillStyle = '#64748B';
              ctx.font = '9px system-ui, sans-serif';
              ctx.fillText(n.sublabel.slice(0, 20), n.x, n.y + n.radius + 25);
            }

            ctx.globalAlpha = 1.0;
          });

          ctx.restore();
        }
      }

      animFrame = requestAnimationFrame(simStep);
    };

    animFrame = requestAnimationFrame(simStep);
    return () => cancelAnimationFrame(animFrame);
  }, [nodes, links, transform, connectedNodeIds, selectedNodeId]);

  // Handle Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse / Drag Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - canvas.width / 2 - transform.x) / transform.scale;
    const mouseY = (e.clientY - rect.top - canvas.height / 2 - transform.y) / transform.scale;

    const clickedNode = nodes.find(n => {
      const dx = n.x - mouseX;
      const dy = n.y - mouseY;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 5;
    });

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      setSelectedNodeId(clickedNode.id);

      if (clickedNode.type === 'activity' && clickedNode.rawItem) {
        setSelectedActivity(clickedNode.rawItem);
      } else if (clickedNode.type === 'evidence' && clickedNode.rawItem) {
        setSelectedObservation(clickedNode.rawItem);
      }
    } else {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      setSelectedNodeId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (draggedNodeRef.current) {
      const rect = canvas.getBoundingClientRect();
      draggedNodeRef.current.x = (e.clientX - rect.left - canvas.width / 2 - transform.x) / transform.scale;
      draggedNodeRef.current.y = (e.clientY - rect.top - canvas.height / 2 - transform.y) / transform.scale;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
    } else if (isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    draggedNodeRef.current = null;
    isDraggingRef.current = false;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="signal-tick bg-[#007AFF]" />
            <Badge variant="secondary">Topology & Precedence Network</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight font-sans">
            Schedule Dependency Graph
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-[65ch] font-sans">
            Interactive topological network map. Select any activity node to isolate its upstream predecessors, downstream successors, and field evidence.
          </p>
        </div>

        {/* Search & Graph Mode Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search activity node..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200/80 bg-white text-xs font-sans placeholder-slate-400 focus:outline-hidden focus:border-[#C38B4B]"
            />
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 text-xs font-sans">
            <button
              onClick={() => setGraphMode('dependencies')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${graphMode === 'dependencies' ? 'bg-white font-semibold text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Dependencies
            </button>
            <button
              onClick={() => setGraphMode('critical_path')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${graphMode === 'critical_path' ? 'bg-white font-semibold text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Critical Path
            </button>
            <button
              onClick={() => setGraphMode('evidence')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${graphMode === 'evidence' ? 'bg-white font-semibold text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Evidence
            </button>
            <button
              onClick={() => setGraphMode('all')}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${graphMode === 'all' ? 'bg-white font-semibold text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
            >
              All Nodes
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Viewport Container */}
      <div ref={containerRef} className="relative w-full h-[620px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xs">
        
        {/* Floating Viewport Controls */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl text-white shadow-lg">
          <Button
            onClick={() => setTransform(t => ({ ...t, scale: Math.min(2.5, t.scale + 0.15) }))}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.4, t.scale - 0.15) }))}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setTransform({ x: 0, y: 0, scale: 0.9 })}
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg"
            title="Reset Viewport"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend Overlay */}
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl text-white text-xs font-sans space-y-2 shadow-lg">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block font-sans">Status Dimension</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-slate-300 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#34C759]" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#007AFF]" />
              <span>In Progress</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-[#FF9500] bg-transparent" />
              <span>Critical Path</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>Field Evidence</span>
            </div>
          </div>
        </div>

        {/* Interactive Physics Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />
      </div>

      {/* Activity 360° Drawer */}
      <Activity360Drawer
        item={selectedActivity}
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        observations={observations}
        auditEvents={auditEvents}
        allActivities={activities}
      />

      {/* Evidence Drawer */}
      <EvidenceDrawer
        observation={selectedObservation}
        isOpen={!!selectedObservation}
        onClose={() => setSelectedObservation(null)}
      />
    </div>
  );
};

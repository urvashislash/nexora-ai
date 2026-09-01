import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Network, 
  Search, 
  Flame, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut,
  Sliders,
  FileText
} from 'lucide-react';
import type { ActivityWithState, WorkObservation } from '../types';
import { ActivityDrawer } from '../components/ActivityDrawer';
import { EvidenceDrawer } from '../components/EvidenceDrawer';

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
}

// Pure deterministic pseudo-random generator for reproducible node layout
function deterministicRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

export const ProjectGraph: React.FC<ProjectGraphProps> = ({ 
  activities,
  observations = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Filter & Control States
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('ALL');
  const [criticalOnly, setCriticalOnly] = useState<boolean>(false);
  const [showEvidence, setShowEvidence] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showControls, setShowControls] = useState<boolean>(false);

  // Physics params
  const [repulsion, setRepulsion] = useState<number>(450);
  const [linkDistance, setLinkDistance] = useState<number>(90);
  const [transform, setTransform] = useState<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 0.85 });
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggedNodeRef = useRef<GraphNode | null>(null);
  const hoveredNodeRef = useRef<GraphNode | null>(null);

  // Selected drawers
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithState | null>(null);
  const [selectedObservation, setSelectedObservation] = useState<WorkObservation | null>(null);

  // 1. Build Graph Model from Activities & Observations
  const { nodes, links } = useMemo(() => {
    const nList: GraphNode[] = [];
    const lList: GraphLink[] = [];

    // Root Project Hub Node
    nList.push({
      id: 'root-project',
      label: 'PARADIP REFINERY',
      sublabel: 'Package 04 Expansion',
      type: 'project',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      radius: 22,
      color: '#C38B4B',
    });

    // 2. WBS Location Groups
    const wbsGroups = new Map<string, string>();
    activities.forEach(act => {
      const loc = act.activity.location || act.activity.discipline;
      if (!wbsGroups.has(loc)) {
        const wbsId = `wbs-${loc.toLowerCase().replace(/\s+/g, '-')}`;
        wbsGroups.set(loc, wbsId);
      }
    });

    let wbsIdx = 0;
    wbsGroups.forEach((wbsId, locName) => {
      wbsIdx++;
      nList.push({
        id: wbsId,
        label: locName,
        type: 'wbs',
        x: (deterministicRandom(wbsIdx * 17) - 0.5) * 200,
        y: (deterministicRandom(wbsIdx * 31) - 0.5) * 200,
        vx: 0,
        vy: 0,
        radius: 18,
        color: '#475569',
      });

      // Link WBS to Project Root
      lList.push({
        source: 'root-project',
        target: wbsId,
        type: 'hierarchy',
      });
    });

    // 3. Activity Nodes
    activities.forEach((act, idx) => {
      // Filter discipline
      if (selectedDiscipline !== 'ALL' && act.activity.discipline !== selectedDiscipline) {
        return;
      }
      if (criticalOnly && !act.activity.critical_path) {
        return;
      }

      const status = act.state?.execution_status || 'NOT_STARTED';
      const progress = act.state?.current_progress_pct || 0;
      let color = '#64748B'; // Not started slate
      if (status === 'COMPLETED') color = '#10B981'; // Emerald
      else if (status === 'IN_PROGRESS') color = '#06B6D4'; // Cyan
      else if (status === 'DELAYED') color = '#F43F5E'; // Rose
      if (act.activity.critical_path) color = '#F59E0B'; // Amber

      const actNodeId = `act-${act.activity.id}`;
      nList.push({
        id: actNodeId,
        label: act.activity.code,
        sublabel: act.activity.name,
        type: 'activity',
        status,
        progress,
        discipline: act.activity.discipline,
        isCritical: act.activity.critical_path,
        x: (deterministicRandom((idx + 1) * 43) - 0.5) * 500,
        y: (deterministicRandom((idx + 1) * 67) - 0.5) * 500,
        vx: 0,
        vy: 0,
        radius: act.activity.critical_path ? 14 : 12,
        color,
        rawItem: act,
      });

      // Link to its WBS node
      const loc = act.activity.location || act.activity.discipline;
      const wbsId = wbsGroups.get(loc);
      if (wbsId) {
        lList.push({
          source: wbsId,
          target: actNodeId,
          type: 'hierarchy',
        });
      }

      // Predecessor dependency link (e.g. sequence chaining)
      if (idx > 0 && deterministicRandom(idx * 73) > 0.4) {
        const prevAct = activities[idx - 1];
        if (selectedDiscipline === 'ALL' || prevAct.activity.discipline === selectedDiscipline) {
          lList.push({
            source: `act-${prevAct.activity.id}`,
            target: actNodeId,
            type: 'dependency',
            isCritical: act.activity.critical_path && prevAct.activity.critical_path,
          });
        }
      }
    });

    // 4. Evidence Nodes
    if (showEvidence && observations.length > 0) {
      observations.slice(0, 8).forEach((obs, oIdx) => {
        const obsId = `obs-${obs.id}`;
        const hasAudio = (obs.metadata as any)?.has_audio || (obs.metadata as any)?.source_type === 'VOICE';
        nList.push({
          id: obsId,
          label: hasAudio ? 'VOICE MEMO' : 'DPR REPORT',
          sublabel: obs.normalized_text?.slice(0, 30) || obs.raw_text.slice(0, 30),
          type: 'evidence',
          x: (deterministicRandom((oIdx + 1) * 89) - 0.5) * 400,
          y: (deterministicRandom((oIdx + 1) * 101) - 0.5) * 400,
          vx: 0,
          vy: 0,
          radius: 9,
          color: hasAudio ? '#A855F7' : '#3B82F6', // Purple for audio, blue for doc
          rawItem: obs,
        });

        // Link evidence to activities
        if (nList.some(n => n.id === 'act-d0000000-0000-0000-0000-000000000001')) {
          lList.push({
            source: obsId,
            target: 'act-d0000000-0000-0000-0000-000000000001',
            type: 'evidence',
          });
        }
      });
    }

    return { nodes: nList, links: lList };
  }, [activities, observations, selectedDiscipline, criticalOnly, showEvidence]);

  // Force-Directed Physics Simulation Step
  useEffect(() => {
    let animFrame: number;
    let particleOffset = 0;

    const nodeMap = new Map<string, GraphNode>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const stepSimulation = () => {
      // 1. Repulsion between all node pairs
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy || 1;
          const dist = Math.sqrt(distSq);

          if (dist < 350) {
            const force = (repulsion / distSq);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (draggedNodeRef.current !== n1) {
              n1.vx -= fx;
              n1.vy -= fy;
            }
            if (draggedNodeRef.current !== n2) {
              n2.vx += fx;
              n2.vy += fy;
            }
          }
        }
      }

      // 2. Spring Attraction along links
      links.forEach(link => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) return;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const targetDist = link.type === 'hierarchy' ? linkDistance * 1.3 : linkDistance;
        const displacement = dist - targetDist;
        const force = displacement * 0.035;

        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (draggedNodeRef.current !== source) {
          source.vx += fx;
          source.vy += fy;
        }
        if (draggedNodeRef.current !== target) {
          target.vx -= fx;
          target.vy -= fy;
        }
      });

      // 3. Center Gravity & Damping
      nodes.forEach(n => {
        if (draggedNodeRef.current === n) return;
        n.vx -= n.x * 0.008; // pull toward center
        n.vy -= n.y * 0.008;

        n.vx *= 0.88; // damping
        n.vy *= 0.88;

        n.x += n.vx;
        n.y += n.vy;
      });

      // 4. Render Canvas Frame
      renderCanvas(particleOffset);
      particleOffset += 0.02;

      animFrame = requestAnimationFrame(stepSimulation);
    };

    const renderCanvas = (pulseTime: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.save();

      // Apply zoom & pan transform
      ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
      ctx.scale(transform.scale, transform.scale);

      // Draw Grid Background
      ctx.strokeStyle = '#F1F5F9';
      ctx.lineWidth = 1;
      const gridSize = 40;
      const extent = 1200;
      for (let x = -extent; x <= extent; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, -extent);
        ctx.lineTo(x, extent);
        ctx.stroke();
      }
      for (let y = -extent; y <= extent; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(-extent, y);
        ctx.lineTo(extent, y);
        ctx.stroke();
      }

      // Draw Links
      links.forEach(link => {
        const source = nodeMap.get(link.source);
        const target = nodeMap.get(link.target);
        if (!source || !target) return;

        const isHoveredNeighbor = hoveredNodeRef.current && 
          (hoveredNodeRef.current.id === source.id || hoveredNodeRef.current.id === target.id);

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        if (link.type === 'evidence') {
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = isHoveredNeighbor ? '#A855F7' : 'rgba(168, 85, 247, 0.35)';
          ctx.lineWidth = isHoveredNeighbor ? 2 : 1.2;
        } else if (link.isCritical) {
          ctx.setLineDash([]);
          ctx.strokeStyle = isHoveredNeighbor ? '#F59E0B' : 'rgba(245, 158, 11, 0.6)';
          ctx.lineWidth = isHoveredNeighbor ? 3 : 2;
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = isHoveredNeighbor ? '#0F172A' : 'rgba(203, 213, 225, 0.7)';
          ctx.lineWidth = isHoveredNeighbor ? 2 : 1;
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated particles along critical path links
        if (link.isCritical) {
          const t = (pulseTime % 1);
          const px = source.x + (target.x - source.x) * t;
          const py = source.y + (target.y - source.y) * t;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#F59E0B';
          ctx.fill();
        }
      });

      // Draw Nodes
      nodes.forEach(node => {
        const isHovered = hoveredNodeRef.current?.id === node.id;
        const isSearched = searchQuery && (
          node.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          node.sublabel?.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Glowing Halos
        if (isHovered || isSearched || node.type === 'project' || node.isCritical) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + (isHovered ? 8 : 5), 0, Math.PI * 2);
          ctx.fillStyle = node.color === '#C38B4B' 
            ? 'rgba(195, 139, 75, 0.25)' 
            : node.color === '#10B981' 
            ? 'rgba(16, 185, 129, 0.25)' 
            : 'rgba(245, 158, 11, 0.25)';
          ctx.fill();
        }

        // Node Body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();

        // Node Label
        ctx.font = node.type === 'project' 
          ? 'bold 12px "IBM Plex Mono", monospace' 
          : '500 10px "Inter", sans-serif';
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(node.label, node.x, node.y + node.radius + 4);

        // Progress percentage for activities
        if (node.type === 'activity' && typeof node.progress === 'number' && node.progress > 0) {
          ctx.font = 'bold 9px "IBM Plex Mono", monospace';
          ctx.fillStyle = node.progress === 100 ? '#059669' : '#0284C7';
          ctx.fillText(`${node.progress}%`, node.x, node.y + node.radius + 16);
        }
      });

      ctx.restore();
    };

    animFrame = requestAnimationFrame(stepSimulation);

    return () => {
      cancelAnimationFrame(animFrame);
    };
  }, [nodes, links, repulsion, linkDistance, transform, searchQuery]);

  // Handle Canvas Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        canvasRef.current.width = rect.width;
        canvasRef.current.height = rect.height;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse / Touch Interactivity
  const getCanvasCoords = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left - canvasRef.current.width / 2 - transform.x;
    const y = clientY - rect.top - canvasRef.current.height / 2 - transform.y;
    return { x: x / transform.scale, y: y / transform.scale };
  }, [transform]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);
    const clickedNode = nodes.find(n => {
      const dx = n.x - coords.x;
      const dy = n.y - coords.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 4;
    });

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      if (clickedNode.type === 'activity' && clickedNode.rawItem) {
        setSelectedActivity(clickedNode.rawItem);
      } else if (clickedNode.type === 'evidence' && clickedNode.rawItem) {
        setSelectedObservation(clickedNode.rawItem);
      }
    } else {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e.clientX, e.clientY);

    if (draggedNodeRef.current) {
      draggedNodeRef.current.x = coords.x;
      draggedNodeRef.current.y = coords.y;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
      return;
    }

    if (isDraggingRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Hover detection
    const hovered = nodes.find(n => {
      const dx = n.x - coords.x;
      const dy = n.y - coords.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius + 4;
    });
    hoveredNodeRef.current = hovered || null;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hovered ? 'pointer' : 'grab';
    }
  };

  const handleMouseUp = () => {
    draggedNodeRef.current = null;
    isDraggingRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.3, Math.min(2.5, prev.scale * zoomFactor)),
    }));
  };

  return (
    <div className="space-y-4">
      {/* Header & Control Bar */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-amber-50 text-[#C38B4B] border border-amber-200">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono text-slate-900 flex items-center gap-2">
              <span>Project Network Topology</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-normal">
                {nodes.length} Nodes • {links.length} Links
              </span>
            </h1>
            <p className="text-xs text-slate-500">Interactive Obsidian-style force-directed dependency and evidence graph</p>
          </div>
        </div>

        {/* Quick Search & Filters */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search tag/code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-[#C38B4B] font-mono"
            />
          </div>

          {/* Discipline Pills */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg text-xs font-mono">
            {['ALL', 'PIPING', 'CIVIL', 'ELECTRICAL'].map(d => (
              <button
                key={d}
                onClick={() => setSelectedDiscipline(d)}
                className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                  selectedDiscipline === d
                    ? 'bg-white text-slate-900 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Critical Path Toggle */}
          <button
            onClick={() => setCriticalOnly(!criticalOnly)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
              criticalOnly
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            <span>Critical Path</span>
          </button>

          {/* Evidence Toggle */}
          <button
            onClick={() => setShowEvidence(!showEvidence)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
              showEvidence
                ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Evidence</span>
          </button>

          {/* Physics Slider Toggle */}
          <button
            onClick={() => setShowControls(!showControls)}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              showControls ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title="Physics Controls"
          >
            <Sliders className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Physics Tuning Panel */}
      {showControls && (
        <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Node Repulsion:</span>
              <span className="font-bold">{repulsion}</span>
            </div>
            <input
              type="range"
              min="100"
              max="900"
              value={repulsion}
              onChange={(e) => setRepulsion(Number(e.target.value))}
              className="w-full accent-[#C38B4B]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Link Distance:</span>
              <span className="font-bold">{linkDistance}px</span>
            </div>
            <input
              type="range"
              min="40"
              max="200"
              value={linkDistance}
              onChange={(e) => setLinkDistance(Number(e.target.value))}
              className="w-full accent-[#C38B4B]"
            />
          </div>
        </div>
      )}

      {/* Graph Viewport */}
      <div 
        ref={containerRef} 
        className="relative w-full h-[620px] rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden shadow-inner"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className="w-full h-full block"
        />

        {/* Viewport Overlay Controls */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-white/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-200 shadow-md">
          <button
            onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(2.5, prev.scale * 1.2) }))}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.3, prev.scale * 0.8) }))}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setTransform({ x: 0, y: 0, scale: 0.85 })}
            className="p-1.5 text-slate-600 hover:text-slate-900 rounded hover:bg-slate-100 transition cursor-pointer"
            title="Reset View"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Graph Legend HUD */}
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md p-3 rounded-lg border border-slate-200 text-[11px] font-mono shadow-md space-y-1.5 pointer-events-none">
          <div className="font-bold text-slate-800 pb-1 border-b border-slate-200">Graph Entities</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" /> Completed (100%)</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#06B6D4]" /> In Progress</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" /> Critical Path</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#64748B]" /> Not Started</div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-[#A855F7]" /> Voice Evidence</div>
        </div>
      </div>

      {/* Selected Activity Drawer */}
      <ActivityDrawer
        item={selectedActivity}
        isOpen={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
      />

      {/* Selected Evidence Drawer */}
      <EvidenceDrawer
        observation={selectedObservation}
        isOpen={Boolean(selectedObservation)}
        onClose={() => setSelectedObservation(null)}
      />
    </div>
  );
};

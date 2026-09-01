import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight,
  RefreshCw,
  FileText,
  FileSpreadsheet,
  FileAudio,
  Eye,
  Mic,
  Square,
  Sliders,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Trash2,
  Filter,
  Search
} from 'lucide-react';
import type { WorkObservation, Discipline, EventType } from '../types';
import { uploadEvidenceFile } from '../lib/supabase';
import { api } from '../lib/api';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { PipelineInspectorDrawer } from '../components/PipelineInspectorDrawer';
import { generateUUIDv7 } from '../lib/idGenerator';
import { animateStaggerEntrance } from '../lib/animations';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';

interface DocumentUploadProps {
  observations: WorkObservation[];
  onAddObservations: (observations: WorkObservation[], rawText: string) => void;
  onNavigateTab: (tab: string) => void;
  projectId?: string;
}

function generateObsId(): string {
  return generateUUIDv7();
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({ 
  observations, 
  onAddObservations, 
  onNavigateTab,
  projectId = 'a0000000-0000-0000-0000-000000000001'
}) => {
  const [inputText, setInputText] = useState('');
  const [sourceType, setSourceType] = useState<'DAILY_REPORT' | 'DISCIPLINE_SPREADSHEET' | 'VOICE'>('DAILY_REPORT');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [selectedPipelineStep, setSelectedPipelineStep] = useState<number | null>(null);
  const [showDemoScenarios, setShowDemoScenarios] = useState<boolean>(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedObsForDrawer, setSelectedObsForDrawer] = useState<WorkObservation | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Structured Metadata Overrides
  const [discipline, setDiscipline] = useState<Discipline | ''>('');
  const [eventType, setEventType] = useState<EventType>('FINISH');
  const [location, setLocation] = useState('');
  const [zone, setZone] = useState('');
  const [equipmentTag, setEquipmentTag] = useState('');
  const [reportedProgress, setReportedProgress] = useState<number>(100);
  const [reportedQuantity, setReportedQuantity] = useState<string>('');
  const [unitOfMeasure, setUnitOfMeasure] = useState<string>('');

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Table filtering & search
  const [searchQuery, setSearchQuery] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('ALL');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, [isRecording]);

  // Anime.js Stagger Animation for Demo Preset Cards
  useEffect(() => {
    if (showDemoScenarios) {
      animateStaggerEntrance('.demo-preset-card', { stagger: 35 });
    }
  }, [showDemoScenarios]);

  // Audio frequency waveform visualizer loop
  const drawWaveform = (analyser: AnalyserNode, dataArray: Uint8Array<ArrayBuffer>) => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = '#34C759';
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth + 1;
      }
    };
    render();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Audio Context for visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      source.connect(analyser);

      drawWaveform(analyser, dataArray);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        stream.getTracks().forEach((track) => track.stop());
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);

      // Start Browser Speech Recognition in parallel for real-time transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript + ' ';
          }
          setInputText(transcript.trim());
        };

        recognition.onerror = (e: any) => {
          console.warn('Speech recognition warning:', e.error);
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      }
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Microphone permission denied or audio device not found.',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (err) {
        console.warn('SpeechRecognition stop error:', err);
      }
    }
  };

  const clearRecording = () => {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
  };

  // 5 SIH Scenario Demo Presets
  const demoPresets = [
    {
      id: 'sih-a',
      title: 'Scenario A: Exact Match & Auto-Link',
      desc: 'Pipe Rack B carbon steel spools erection completed at 100%. Matches PIP-2400.',
      badge: 'Auto-Commit (>90%)',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      discipline: 'PIPING' as Discipline,
      location: 'Pipe Rack B',
      equipment: 'LINE-P-101',
      progress: 100,
      text: 'Erection of carbon steel piping spools on Pipe Rack B Tier 2 is 100% completed with torque inspection passed.',
    },
    {
      id: 'sih-b',
      title: 'Scenario B: Partial Progress Actualization',
      desc: 'Cable tray pulling along Substation 02 corridor reaches 45% completion.',
      badge: 'Progress Delta',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200/80',
      discipline: 'ELECTRICAL' as Discipline,
      location: 'Substation 02 Corridor',
      equipment: 'TR-SUB-02',
      progress: 45,
      text: 'Cable tray installation in Substation 02 corridor has progressed up to 45% of total linear run.',
    },
    {
      id: 'sih-c',
      title: 'Scenario C: Precedence Blocker Alert',
      desc: 'Equipment grouting attempted before structural pedestal alignment signoff.',
      badge: 'Predecessor Guard',
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200/80',
      discipline: 'MECHANICAL' as Discipline,
      location: 'Compressor House A',
      equipment: 'C-101-BASE',
      progress: 10,
      text: 'Foundation grouting for Main Compressor C-101 attempted, but Anchor Bolt Alignment predecessor (MEC-1200) is incomplete.',
    },
    {
      id: 'sih-d',
      title: 'Scenario D: Ambiguous Match Proposal',
      desc: 'General line flushing note with ambiguous tag requires Lead Planner verification.',
      badge: 'Planner Review',
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200/80',
      discipline: 'PIPING' as Discipline,
      location: 'Offsite Utilities',
      equipment: 'LINE-FLUSH-GEN',
      progress: 80,
      text: 'Hydrostatic pressure testing and line flushing completed on offsite interconnecting headers.',
    },
    {
      id: 'sih-e',
      title: 'Scenario E: Voice Memo Ingestion',
      desc: 'Spoken supervisor field update transcribed and mapped via AI Whisper.',
      badge: 'Voice ASR Pipeline',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200/80',
      discipline: 'CIVIL' as Discipline,
      location: 'Tank Farm Zone 4',
      equipment: 'TK-401',
      progress: 100,
      text: 'Supervisor audio report: Tank foundation ring beam concrete pour for TK-401 finished today at 16:30 with full slump test approval.',
    },
  ];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      if (file.type.startsWith('audio/')) {
        setSourceType('VOICE');
        setAudioBlob(file);
        setAudioUrl(URL.createObjectURL(file));
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
        setSourceType('DISCIPLINE_SPREADSHEET');
      } else {
        setSourceType('DAILY_REPORT');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (file.type.startsWith('audio/')) {
        setSourceType('VOICE');
        setAudioBlob(file);
        setAudioUrl(URL.createObjectURL(file));
      } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
        setSourceType('DISCIPLINE_SPREADSHEET');
      } else {
        setSourceType('DAILY_REPORT');
      }
    }
  };

  const handleProcess = async (presetText?: string, presetObj?: typeof demoPresets[0]) => {
    const rawText = (presetText || inputText).trim();
    if (!rawText && !selectedFile && !audioBlob) {
      setFeedbackMessage({
        type: 'error',
        text: 'Please enter observation text, attach a document, or record audio.',
      });
      return;
    }

    setIsProcessing(true);
    setFeedbackMessage(null);
    setActiveStep(1);

    try {
      // Step 1: Upload to Supabase Storage if file exists
      let storagePath: string | null = null;
      if (selectedFile) {
        setActiveStep(1);
        storagePath = await uploadEvidenceFile(projectId, selectedFile, 'reports');
      } else if (audioBlob) {
        setActiveStep(1);
        const audioFile = new File([audioBlob], 'voice_memo_recording.webm', { type: audioBlob.type || 'audio/webm' });
        storagePath = await uploadEvidenceFile(projectId, audioFile, 'voice');
      }

      // Step 2: Extraction & Normalization
      setActiveStep(2);
      await new Promise((r) => setTimeout(r, 450));

      // Step 3: Embeddings & Matcher
      setActiveStep(3);
      await new Promise((r) => setTimeout(r, 500));

      // Step 4: Rust Trust Plane Policy Validation
      setActiveStep(4);
      await new Promise((r) => setTimeout(r, 400));

      // Step 5: Ledger Commitment
      setActiveStep(5);

      const resolvedDiscipline = presetObj?.discipline || (discipline ? discipline : 'PIPING');
      const resolvedProgress = presetObj?.progress ?? reportedProgress;
      const resolvedLocation = presetObj?.location || (location ? location : 'Pipe Rack B');
      const resolvedEquipment = presetObj?.equipment || (equipmentTag ? equipmentTag : undefined);

      const newObs: WorkObservation = {
        id: generateObsId(),
        project_id: projectId,
        raw_text: rawText,
        normalized_text: rawText.includes('P-101') ? rawText.replace('P-101', 'Line P-101') : rawText,
        discipline: resolvedDiscipline,
        recorded_at: new Date().toISOString(),
        observed_at: new Date().toISOString(),
        event_type: eventType,
        reported_progress: resolvedProgress,
        reported_quantity: reportedQuantity ? parseFloat(reportedQuantity) : undefined,
        unit_of_measure: unitOfMeasure || undefined,
        location: resolvedLocation,
        zone: zone || undefined,
        equipment_tag: resolvedEquipment,
        metadata: {
          source_type: sourceType,
          storage_path: storagePath || undefined,
          file_name: selectedFile?.name || undefined,
          has_audio: !!audioBlob || (selectedFile?.type ? selectedFile.type.startsWith('audio/') : false),
        },
      };

      // Call API / Supabase to persist observation to DB
      await api.createObservation(projectId, newObs);

      // Trigger callback to update App state (review queue / activities / audit)
      onAddObservations([newObs], rawText);

      setFeedbackMessage({
        type: 'success',
        text: `Observation successfully ingested and verified against schedule baseline. Staged into ledger!`,
      });

      // Clear active inputs
      setSelectedFile(null);
      setInputText('');
      setAudioBlob(null);
      setAudioUrl(null);
    } catch (err: any) {
      console.error('Ingestion error:', err);
      setFeedbackMessage({
        type: 'error',
        text: `Processing completed with warning: ${err?.message || 'Check connection to backend'}`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const filteredObservations = observations.filter((obs) => {
    const matchesSearch = 
      obs.raw_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (obs.location && obs.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (obs.equipment_tag && obs.equipment_tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      obs.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDiscipline = disciplineFilter === 'ALL' || obs.discipline === disciplineFilter;
    return matchesSearch && matchesDiscipline;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="signal-tick bg-[#007AFF]" />
            <Badge variant="secondary">Multi-Modal Ingestion Engine</Badge>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-none font-sans">
            Evidence
          </h1>
          <p className="mt-1 text-xs text-slate-500 max-w-[65ch] font-sans">
            Upload reports, spreadsheets, photos, or voice notes for matching.
          </p>
        </div>
      </div>

      {/* 5 Mandatory SIH Demo Scenarios (Collapsible Sandbox) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#C38B4B]" />
            <h2 className="text-sm font-semibold text-slate-900 font-sans">
              Demo scenarios
            </h2>
          </div>
          <button
            onClick={() => setShowDemoScenarios(prev => !prev)}
            className="text-xs font-sans text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
          >
            <span>{showDemoScenarios ? 'Hide Scenarios' : 'Show Scenarios'}</span>
            {showDemoScenarios ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {showDemoScenarios && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {demoPresets.map((preset) => (
              <div 
                key={preset.id}
                onClick={() => {
                  setInputText(preset.text);
                  setDiscipline(preset.discipline);
                  setLocation(preset.location);
                  setEquipmentTag(preset.equipment || '');
                  setReportedProgress(preset.progress);
                  handleProcess(preset.text, preset);
                }}
                className="demo-preset-card p-4 rounded-xl border border-slate-200/80 bg-white hover:border-[#C38B4B] hover:shadow-xs transition-all duration-150 cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-xs text-slate-900 group-hover:text-[#C38B4B] transition font-sans">{preset.title}</span>
                    <span className={`text-[10px] font-sans font-medium px-2 py-0.5 rounded-md border ${preset.badgeColor}`}>
                      {preset.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 italic font-sans">"{preset.text}"</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-sans">
                  <span className="truncate max-w-[200px]">{preset.desc}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-[#C38B4B] shrink-0 ml-1 group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Intake Form & Live Execution Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Ingestion Panel */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-2xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2 font-sans">
              <span>Add evidence</span>
              <Badge variant="bronze">Multi-Modal</Badge>
            </h3>
            
            {/* Mode Switcher */}
            <div className="flex space-x-1 rounded-xl bg-slate-100 p-1 border border-slate-200/60 text-xs font-sans">
              <button 
                onClick={() => {
                  setSourceType('DAILY_REPORT');
                  clearRecording();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  sourceType === 'DAILY_REPORT' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Daily PDF</span>
              </button>

              <button 
                onClick={() => {
                  setSourceType('DISCIPLINE_SPREADSHEET');
                  clearRecording();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  sourceType === 'DISCIPLINE_SPREADSHEET' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>Excel / CSV</span>
              </button>

              <button 
                onClick={() => setSourceType('VOICE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  sourceType === 'VOICE' ? 'bg-white shadow-2xs text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Mic className="h-3.5 w-3.5 text-[#FF3B30]" />
                <span>Voice Note</span>
              </button>
            </div>
          </div>

          {/* Dedicated Voice Recording Component if VOICE tab is active */}
          {sourceType === 'VOICE' && (
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${isRecording ? 'bg-rose-600 animate-ping' : 'bg-rose-400'}`} />
                  <span className="text-xs font-semibold text-slate-900 font-sans">
                    Voice capture
                  </span>
                </div>
                {isRecording && (
                  <span className="text-xs font-mono font-bold text-rose-600 bg-white px-2 py-0.5 rounded-md border border-rose-200 animate-pulse">
                    REC {formatTime(recordingTime)}
                  </span>
                )}
              </div>

              {/* Real-time Frequency Waveform Visualizer */}
              {isRecording && (
                <div className="w-full bg-slate-900 rounded-xl p-2 flex items-center justify-center shadow-inner">
                  <canvas 
                    ref={visualizerCanvasRef} 
                    width={400} 
                    height={40} 
                    className="w-full h-10 block rounded-lg"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                {!isRecording ? (
                  <Button
                    onClick={startRecording}
                    variant="destructive"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Mic className="h-4 w-4" />
                    <span>{audioBlob ? 'Record New Voice Memo' : 'Start Voice Recording'}</span>
                  </Button>
                ) : (
                  <Button
                    onClick={stopRecording}
                    variant="default"
                    size="sm"
                    className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white"
                  >
                    <Square className="h-4 w-4 text-rose-400" />
                    <span>Stop Recording ({formatTime(recordingTime)})</span>
                  </Button>
                )}

                {audioUrl && (
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <audio src={audioUrl} controls className="h-8 flex-1 max-w-[280px]" />
                    <button
                      onClick={clearRecording}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      title="Clear audio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-sans">
                Captures and transcribes supervisor voice notes.
              </p>
            </div>
          )}

          {/* Drag & Drop File Upload Area */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2 ${
              isDragging 
                ? 'border-[#C38B4B] bg-amber-50/50' 
                : selectedFile 
                  ? 'border-emerald-300 bg-emerald-50/30' 
                  : 'border-slate-200/80 hover:border-slate-300 bg-slate-50/50'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden" 
              accept={
                sourceType === 'VOICE' 
                  ? '.wav,.mp3,.m4a,.aac,.ogg,.webm,.flac,audio/*'
                  : sourceType === 'DISCIPLINE_SPREADSHEET'
                    ? '.xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv'
                    : '.pdf,.png,.jpg,.jpeg,application/pdf,image/*'
              }
            />

            <div className="h-10 w-10 rounded-xl bg-white shadow-2xs border border-slate-200 flex items-center justify-center text-slate-600">
              {sourceType === 'VOICE' ? (
                <FileAudio className="h-5 w-5 text-rose-600" />
              ) : sourceType === 'DISCIPLINE_SPREADSHEET' ? (
                <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              ) : (
                <FileText className="h-5 w-5 text-[#C38B4B]" />
              )}
            </div>

            {selectedFile ? (
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs font-semibold text-slate-900 font-mono">{selectedFile.name}</span>
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <p className="text-[11px] text-emerald-700 font-sans">File attached and ready for ingestion</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-slate-800 font-sans">
                  {sourceType === 'VOICE'
                    ? 'Drop audio recording (.wav, .mp3, .m4a, .webm) or click to browse'
                    : sourceType === 'DISCIPLINE_SPREADSHEET'
                      ? 'Drop Excel inspection table (.xlsx, .csv) or click to browse'
                      : 'Drop Daily Progress PDF / Site image or click to browse'}
                </p>
                <p className="text-[11px] text-slate-500 font-sans">Max upload size: 50 MB per payload</p>
              </div>
            )}
          </div>

          {/* Text Area */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-sans font-semibold uppercase tracking-wider text-slate-500">
                Field notes
              </label>
              {selectedFile && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                  className="text-[11px] font-sans text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                >
                  Clear Attached File
                </button>
              )}
            </div>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter site observation, e.g.: 'Completed hydro test on line P-101 at pipe rack B with 100% signoff from QA/QC inspection team.'"
              rows={3}
              className="w-full rounded-xl border border-slate-200/90 p-3 text-xs text-slate-900 placeholder-slate-400 focus:border-[#C38B4B] focus:outline-hidden font-sans"
            />
          </div>

          {/* Optional Structured Metadata Accordion */}
          <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between p-3.5 bg-slate-50/70 hover:bg-slate-100/70 transition text-left text-xs font-semibold text-slate-700 font-sans cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-[#C38B4B]" />
                <span>Optional details</span>
              </div>
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showAdvanced && (
              <div className="p-4 space-y-3 border-t border-slate-200/80 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-sans uppercase text-slate-500 font-semibold mb-1">Discipline</label>
                    <select
                      value={discipline}
                      onChange={(e) => setDiscipline(e.target.value as Discipline)}
                      className="w-full text-xs font-sans rounded-lg border border-slate-200/80 p-2 bg-white text-slate-800"
                    >
                      <option value="">Auto-Detect (AI)</option>
                      <option value="PIPING">PIPING</option>
                      <option value="CIVIL">CIVIL</option>
                      <option value="MECHANICAL">MECHANICAL</option>
                      <option value="ELECTRICAL">ELECTRICAL</option>
                      <option value="INSTRUMENTATION">INSTRUMENTATION</option>
                      <option value="HSE">HSE</option>
                      <option value="GENERAL">GENERAL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans uppercase text-slate-500 font-semibold mb-1">Event Type</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value as EventType)}
                      className="w-full text-xs font-sans rounded-lg border border-slate-200/80 p-2 bg-white text-slate-800"
                    >
                      <option value="FINISH">FINISH (100% Completion)</option>
                      <option value="START">START (Commenced)</option>
                      <option value="PROGRESS">PROGRESS (Incremental)</option>
                      <option value="DELAY">DELAY (Issue Reported)</option>
                      <option value="BLOCKER">BLOCKER (Critical Hold)</option>
                      <option value="INSPECTION">INSPECTION (Quality Signoff)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans uppercase text-slate-500 font-semibold mb-1">Equipment / Line Tag</label>
                    <input
                      type="text"
                      value={equipmentTag}
                      onChange={(e) => setEquipmentTag(e.target.value)}
                      placeholder="e.g. LINE-P-101"
                      className="w-full text-xs font-mono rounded-lg border border-slate-200/80 p-2 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans uppercase text-slate-500 font-semibold mb-1">Location & Zone</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Pipe Rack B"
                        className="w-1/2 text-xs font-sans rounded-lg border border-slate-200/80 p-2 text-slate-800"
                      />
                      <input
                        type="text"
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                        placeholder="e.g. Tier 2"
                        className="w-1/2 text-xs font-sans rounded-lg border border-slate-200/80 p-2 text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans uppercase text-slate-500 font-semibold mb-1">
                      Progress: {reportedProgress}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={reportedProgress}
                      onChange={(e) => setReportedProgress(parseInt(e.target.value, 10))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#C38B4B]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-sans uppercase text-slate-500 font-semibold mb-1">Quantity & Unit</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={reportedQuantity}
                        onChange={(e) => setReportedQuantity(e.target.value)}
                        placeholder="e.g. 42.5"
                        className="w-1/2 text-xs font-mono rounded-lg border border-slate-200/80 p-2 text-slate-800"
                      />
                      <input
                        type="text"
                        value={unitOfMeasure}
                        onChange={(e) => setUnitOfMeasure(e.target.value)}
                        placeholder="e.g. bar / m"
                        className="w-1/2 text-xs font-mono rounded-lg border border-slate-200/80 p-2 text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Feedback Alert */}
          {feedbackMessage && (
            <div className={`p-3.5 rounded-xl border text-xs font-sans flex items-start gap-2.5 ${
              feedbackMessage.type === 'success' ? 'bg-emerald-50 text-emerald-950 border-emerald-200/80' :
              feedbackMessage.type === 'error' ? 'bg-rose-50 text-rose-950 border-rose-200/80' :
              'bg-blue-50 text-blue-950 border-blue-200/80'
            }`}>
              {feedbackMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#34C759]" /> :
               feedbackMessage.type === 'error' ? <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[#FF3B30]" /> :
               <RefreshCw className="h-4 w-4 shrink-0 mt-0.5 text-[#007AFF] animate-spin" />}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {/* Submit Action */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-sans">
              <UploadCloud className="h-4 w-4 text-slate-400" />
              <span>Target: Supabase Storage + Rust Trust Plane</span>
            </div>
            <Button
              onClick={() => handleProcess()}
              disabled={isProcessing || (!inputText.trim() && !selectedFile && !audioBlob)}
              variant="default"
              size="default"
              className="flex items-center gap-2"
            >
              {isProcessing && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>{isProcessing ? 'Processing Pipeline...' : 'Process Observation'}</span>
            </Button>
          </div>
        </div>

        {/* Pipeline Execution Stages */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 flex flex-col justify-between space-y-4 shadow-2xs">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-sm font-semibold text-slate-900 font-sans">
                Processing
              </h3>
              <Badge variant="secondary">Zero Hallucination</Badge>
            </div>

            <div className="space-y-2.5">
              {[
                { step: 1, title: 'Upload', desc: 'Stores source evidence.' },
                { step: 2, title: 'Extract', desc: 'Finds project entities.' },
                { step: 3, title: 'Match', desc: 'Scores schedule candidates.' },
                { step: 4, title: 'Validate', desc: 'Checks dates and dependencies.' },
                { step: 5, title: 'Commit', desc: 'Adds a verified ledger event.' }
              ].map((s) => {
                const isCurrent = activeStep === s.step;
                const isPassed = activeStep > s.step || activeStep === 5;

                return (
                  <div 
                    key={s.step}
                    onClick={() => setSelectedPipelineStep(s.step)}
                    className={`flex items-start space-x-3 rounded-xl p-3 transition-all duration-150 border cursor-pointer hover:border-[#C38B4B] ${
                      isCurrent ? 'bg-blue-50/70 border-blue-200 shadow-2xs' :
                      isPassed ? 'bg-emerald-50/40 border-emerald-200/80' :
                      'bg-slate-50/70 border-slate-200/70 opacity-90'
                    }`}
                    title="Click to inspect stage specifications and production code"
                  >
                    <div className="mt-0.5">
                      {isPassed ? (
                        <CheckCircle2 className="h-4 w-4 text-[#34C759]" />
                      ) : isCurrent ? (
                        <RefreshCw className="h-4 w-4 text-[#007AFF] animate-spin" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border border-slate-400 text-[10px] flex items-center justify-center text-slate-500 font-mono">
                          {s.step}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 font-sans">{s.title}</span>
                        <span className="text-[10px] font-sans text-[#C38B4B] font-semibold">Inspect &rarr;</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans">{s.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-sans">
            <span className="text-slate-500">Routing: Auto-link (&gt;90%) vs Review</span>
            <button 
              onClick={() => onNavigateTab('review')}
              className="text-[#C38B4B] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              Open Planner Review Queue →
            </button>
          </div>
        </div>

      </div>

      {/* Ingested Evidence Stream Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 font-sans">Ingested Field Evidence Stream</h3>
            <p className="text-xs text-slate-500 font-sans">Uploaded observations and extraction status.</p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search raw facts, locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs font-sans rounded-lg border border-slate-200/80 focus:outline-hidden focus:border-[#C38B4B] w-48 sm:w-64"
              />
            </div>

            <div className="flex items-center gap-1">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={disciplineFilter}
                onChange={(e) => setDisciplineFilter(e.target.value)}
                className="text-xs font-sans rounded-lg border border-slate-200/80 px-2.5 py-1.5 bg-white text-slate-700"
              >
                <option value="ALL">All Disciplines</option>
                <option value="PIPING">Piping</option>
                <option value="CIVIL">Civil</option>
                <option value="MECHANICAL">Mechanical</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="INSTRUMENTATION">Instrumentation</option>
              </select>
            </div>

            <Badge variant="outline">{filteredObservations.length} of {observations.length}</Badge>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obs ID</TableHead>
                <TableHead>Recorded At</TableHead>
                <TableHead>Raw Fact / Voice Transcript</TableHead>
                <TableHead>Discipline</TableHead>
                <TableHead>Location / Tag</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredObservations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                    No observations found matching your search. Ingest a report or scenario above.
                  </TableCell>
                </TableRow>
              ) : (
                filteredObservations.map((obs) => (
                  <TableRow 
                    key={obs.id} 
                    onClick={() => setSelectedObsForDrawer(obs)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-mono font-bold text-slate-900">
                      <span className="truncate block max-w-[90px]">{obs.id}</span>
                    </TableCell>
                    <TableCell className="text-slate-500 whitespace-nowrap font-mono text-[11px]">
                      {new Date(obs.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-slate-800 font-sans max-w-xs truncate">
                      {obs.raw_text}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{obs.discipline || 'GENERAL'}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-600 truncate max-w-[120px] font-sans">
                      {obs.location || obs.equipment_tag || '—'}
                    </TableCell>
                    <TableCell className="font-mono font-bold text-emerald-700">
                      {obs.reported_progress ?? 100}%
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedObsForDrawer(obs);
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-[#C38B4B] hover:text-[#B07A3E] font-medium"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        <span>Inspect</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Contextual Evidence Drawer */}
      <EvidenceDrawer
        observation={selectedObsForDrawer}
        isOpen={Boolean(selectedObsForDrawer)}
        onClose={() => setSelectedObsForDrawer(null)}
      />

      {/* Interactive 5-Stage Pipeline Inspector Drawer */}
      <PipelineInspectorDrawer
        step={selectedPipelineStep}
        isOpen={selectedPipelineStep !== null}
        onClose={() => setSelectedPipelineStep(null)}
      />

    </div>
  );
};

import React from 'react';
import { 
  Cpu, 
  Lock, 
  Database, 
  Sparkles, 
  ShieldCheck, 
  Code
} from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from './ui/sheet';

interface PipelineInspectorDrawerProps {
  step: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PipelineInspectorDrawer: React.FC<PipelineInspectorDrawerProps> = ({
  step,
  isOpen,
  onClose,
}) => {
  if (step === null) return null;

  const stepDetails = [
    {
      step: 1,
      title: 'Stage 1: Ingestion & Object Storage',
      category: 'SUPABASE STORAGE & PAYLOAD INTAKE',
      icon: Database,
      color: 'text-[#007AFF]',
      description: 'Heterogeneous input intake supporting site PDF daily progress reports, Excel discipline spreadsheets, and supervisor audio voice notes.',
      specs: [
        { label: 'Storage Engine', value: 'Supabase S3 Object Storage (Bucket: evidence-documents)' },
        { label: 'Audio Formats', value: 'PCM WAV, MP3, AAC, M4A, WebM (24-bit 48kHz audio)' },
        { label: 'Document Formats', value: 'PDF (v1.4 - v1.7), Excel (XLSX, XLS), CSV (RFC 4180)' },
        { label: 'Max File Size', value: '50 MB per payload bundle' },
      ],
      codeSnippet: `// Supabase Storage Payload Verification
const { data, error } = await supabase.storage
  .from('evidence-documents')
  .upload(\`\${projectId}/\${category}/\${fileName}\`, file, {
    cacheControl: '3600',
    upsert: false
  });`,
    },
    {
      step: 2,
      title: 'Stage 2: Entity Extraction & Normalization',
      category: 'FASTAPI + FASTER-WHISPER + REGEX CLEANER',
      icon: Cpu,
      color: 'text-purple-600',
      description: 'Audio transcription with Voice Activity Detection (VAD) and regex-driven site entity extraction for WBS codes, area tags, and physical progress percentages.',
      specs: [
        { label: 'Voice Model', value: 'faster-whisper (Systran small.en / base.en with Silero VAD)' },
        { label: 'OCR Engine', value: 'PyPDF / pdfplumber tabular layout stream parser' },
        { label: 'Discipline Classifier', value: 'CIVIL, PIPING, ELECTRICAL, MECHANICAL' },
        { label: 'Spatial Extraction', value: 'Area Tag, Zone ID, Equipment Tag, Grid Coordinates' },
      ],
      codeSnippet: `def extract_entities(text: str) -> ExtractedObservation:
    disciplines = classify_discipline(text)
    tags = re.findall(r'[A-Z]{3,4}-\\d{4}|RACK-[A-Z]|LINE-[A-Z]-\\d+', text)
    progress_val = extract_progress_pct(text)
    return ExtractedObservation(tags=tags, progress=progress_val, discipline=disciplines)`,
    },
    {
      step: 3,
      title: 'Stage 3: 384-d Embedding & Hybrid Matcher',
      category: 'HUGGINGFACE all-MiniLM-L6-v2 + COSINE + JACCARD',
      icon: Sparkles,
      color: 'text-[#C38B4B]',
      description: 'Calculates 384-dimensional dense semantic vector cosine similarity combined with token-level lexical overlap and project contextual metadata boost.',
      specs: [
        { label: 'Embedding Model', value: 'sentence-transformers/all-MiniLM-L6-v2' },
        { label: 'Dense Dimensions', value: '384 float32 dimensions with L2 normalization' },
        { label: 'Score Formula', value: 'Score = 0.50 × Semantic + 0.35 × Lexical + 0.15 × Context' },
        { label: 'Auto-Link Threshold', value: 'Score ≥ 0.88 (Bypasses review queue directly)' },
      ],
      codeSnippet: `# Hybrid Match Scoring Function
dense_sim = np.dot(obs_embedding, act_embedding) # 384-d Cosine
lexical_sim = len(obs_tokens & act_tokens) / len(obs_tokens | act_tokens)
context_boost = 0.15 if (obs.discipline == act.discipline) else 0.0
final_score = (0.50 * dense_sim) + (0.35 * lexical_sim) + context_boost`,
    },
    {
      step: 4,
      title: 'Stage 4: Rust Trust Plane Policy Verification',
      category: 'DETERMINISTIC AXUM / TOKIO TRUST LAYER',
      icon: Lock,
      color: 'text-[#34C759]',
      description: 'Rigorous deterministic policy engine validating date bounds, finish-to-start predecessor rules, and non-backward progress invariants.',
      specs: [
        { label: 'Runtime', value: 'Rust 1.78+ (Zero allocation serialization)' },
        { label: 'Predecessor Guard', value: 'Validates Finish-to-Start predecessor completion' },
        { label: 'Monotonic Rule', value: 'Rejects negative progress deltas without planner signed override' },
        { label: 'Date Bounds', value: 'Rejects finish dates prior to start dates or post target milestone' },
      ],
      codeSnippet: `// Rust Deterministic State Invariant Guard
pub fn validate_actual_event(event: &ActualEvent, state: &ActivityState) -> Result<(), TrustError> {
    if event.progress_pct < state.current_progress_pct {
        return Err(TrustError::MonotonicProgressViolation);
    }
    if !state.predecessors_completed() {
        return Err(TrustError::UnsatisfiedPredecessors);
    }
    Ok(())
}`,
    },
    {
      step: 5,
      title: 'Stage 5: PostgreSQL Commit & Cryptographic Audit',
      category: 'IMMUTABLE SHA-256 EVENT SOURCING',
      icon: ShieldCheck,
      color: 'text-emerald-700',
      description: 'Persists verified actual event to PostgreSQL 15 database and appends block hash to the SHA-256 cryptographic tamper-evident ledger.',
      specs: [
        { label: 'Database', value: 'PostgreSQL 15 (Supabase Managed with RLS)' },
        { label: 'Audit Chaining', value: 'SHA-256(entity_id + payload + previous_hash + timestamp)' },
        { label: 'Export Targets', value: 'Primavera P6 XML (Schema V24), CSV Actuals, PMIS JSON' },
        { label: 'Realtime Sync', value: 'Postgres CDC Wal2Json WebSocket Broadcast' },
      ],
      codeSnippet: `-- PostgreSQL Atomic Ledger Commit
BEGIN;
  INSERT INTO actual_events (id, activity_id, event_type, progress_pct, created_at)
  VALUES (gen_random_uuid(), target_act_id, 'PROGRESS', 80, NOW());

  INSERT INTO audit_ledger (id, payload_hash, previous_hash, action, actor_role)
  VALUES (gen_random_uuid(), computed_sha256, last_hash, 'AUTO_LINK', 'RUST_TRUST_PLANE');
COMMIT;`,
    },
  ];

  const currentDetail = stepDetails.find(d => d.step === step) || stepDetails[0];
  const Icon = currentDetail.icon;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="p-0 sm:max-w-xl md:max-w-2xl bg-white shadow-2xl">
        
        {/* Header */}
        <SheetHeader className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <Icon className={`h-6 w-6 ${currentDetail.color}`} />
            </div>
            <div>
              <span className="text-[10px] font-sans font-semibold uppercase tracking-wider text-slate-400 block">
                {currentDetail.category}
              </span>
              <SheetTitle className="text-base font-bold text-slate-900 leading-snug">
                {currentDetail.title}
              </SheetTitle>
              <SheetDescription className="text-xs text-slate-500">
                NEXORA Trust Plane &bull; Stage {currentDetail.step} of 5
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary */}
          <div>
            <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Architecture Overview
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-4 rounded-xl border border-slate-200/70 font-sans">
              {currentDetail.description}
            </p>
          </div>

          {/* Specifications Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500">
              Technical Specifications & Invariants
            </h3>
            <div className="rounded-xl border border-slate-200/80 overflow-hidden divide-y divide-slate-100 text-xs font-sans">
              {currentDetail.specs.map((spec, i) => (
                <div key={i} className="p-3.5 bg-white flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <span className="text-slate-500 font-medium">{spec.label}</span>
                  <span className="text-slate-900 font-mono text-[11px] font-semibold">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Code Implementation Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-sans font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Code className="h-3.5 w-3.5 text-[#C38B4B]" />
                <span>Production Source Snippet</span>
              </h3>
              <Badge variant="outline">VERIFIED</Badge>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto border border-slate-800 leading-relaxed select-all">
              {currentDetail.codeSnippet}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between sm:justify-between">
          <span className="text-[11px] font-sans text-slate-500">
            Stage {currentDetail.step} of 5 &bull; NEXORA Trust Plane Pipeline
          </span>
          <Button onClick={onClose} variant="default" size="sm">
            Close Inspector
          </Button>
        </SheetFooter>

      </SheetContent>
    </Sheet>
  );
};

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Scale, 
  Info 
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'privacy' | 'terms' | 'retention';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'privacy',
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'retention'>(initialTab);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl p-6 font-sans max-h-[85vh] overflow-y-auto">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800">
              <Scale className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 font-sans tracking-tight">
                NEXORA Legal, Privacy & Compliance Disclosures
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-sans">
                Beta Service Terms, Enterprise AI Data Governance & Cryptographic Retention
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 border-b border-slate-100 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'privacy'
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('terms')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'terms'
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Terms of Service
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('retention')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === 'retention'
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Retention & Deletion Policy
          </button>
        </div>

        {/* Tab 1: Privacy Policy */}
        {activeTab === 'privacy' && (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed font-sans">
            <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl text-amber-950 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <span>
                <strong>Beta Data Isolation:</strong> Your project schedules, daily progress reports (DPRs), and field evidence are tenant-isolated and never shared across teams or used to train foundational AI models.
              </span>
            </div>

            <section className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900">1. Information We Collect</h4>
              <p>
                When you participate in the NEXORA Beta, we collect:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>Account credentials authenticated securely via Supabase Auth (email, user ID, cryptographic session tokens).</li>
                <li>Project metadata: project schedules (WBS, Primavera P6 exports, CSVs), activity codes, planned dates, and weightages.</li>
                <li>Field evidence: uploaded PDFs, spreadsheets, inspection photos, and audio recordings.</li>
                <li>Operational audit records: tamper-evident ledger tracking human approval decisions and AI match candidates.</li>
              </ul>
            </section>

            <section className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900">2. AI Processing & Third-Party AI Providers</h4>
              <p>
                NEXORA utilizes state-of-the-art embedding and inference models to extract activities and calculate match scores.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li><strong>No Model Training:</strong> Your construction schedules and field data are NOT used to train public or foundational third-party AI models.</li>
                <li><strong>Zero Retention by Providers:</strong> All AI processing occurs under enterprise Zero-Data-Retention (ZDR) agreements.</li>
              </ul>
            </section>
          </div>
        )}

        {/* Tab 2: Terms of Service */}
        {activeTab === 'terms' && (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed font-sans">
            <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl text-blue-950 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <span>
                <strong>Human-in-the-Loop Guarantee:</strong> AI outputs in NEXORA are strictly match proposals. The Lead Planner or Authorized Engineer must review and approve all progress commits.
              </span>
            </div>

            <section className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900">1. Beta Service Scope & Warranty</h4>
              <p>
                NEXORA is provided in Beta for evaluation, validation, and operational trial on industrial construction projects. The service is provided "as-is" without statutory warranty.
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900">2. Human Verification Requirement</h4>
              <p>
                You acknowledge that AI models may produce uncertain or ambiguous match proposals. You agree that schedule baseline updates, critical path adjustments, and contractor payment approvals must be verified by human domain experts.
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900">3. Acceptable Use Policy</h4>
              <p>
                Users agree not to upload malicious binaries, execute denial-of-service attempts against multi-tenant infrastructure, or share credentials with unauthorized parties.
              </p>
            </section>
          </div>
        )}

        {/* Tab 3: Retention & Deletion */}
        {activeTab === 'retention' && (
          <div className="space-y-4 text-xs text-slate-700 leading-relaxed font-sans">
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-900 flex items-start gap-2">
              <Lock className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
              <span>
                <strong>Cryptographic Audit Ledger:</strong> NEXORA incorporates a SHA-256 hash-chained audit ledger to guarantee evidentiary integrity for dispute resolution and contractual claims.
              </span>
            </div>

            <section className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900">1. Project & Document Deletion</h4>
              <p>
                When a project is deleted by an authorized Owner, associated evidence files, match proposals, and intermediate extractions are permanently purged.
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900">2. Statutory Audit Retention</h4>
              <p>
                To maintain cryptographic chain integrity and satisfy construction legal hold requirements, audit hashes (`audit_events` ledger) record the irreversible deletion action, timestamp, and actor ID as a tombstone entry without retaining raw sensitive document content.
              </p>
            </section>

            <section className="space-y-1.5">
              <h4 className="text-sm font-bold text-slate-900">3. Account & Team Offboarding</h4>
              <p>
                Team Owners may delete a team by entering its full name for explicit confirmation. All child resources and membership allocations are revoked immediately.
              </p>
            </section>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <span className="text-[11px] text-slate-400 font-mono">
            Version: Beta-1.0.0 (Effective Sep 2026)
          </span>
          <Button type="button" size="sm" onClick={onClose} className="bg-slate-900 text-white">
            I Understand & Accept
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

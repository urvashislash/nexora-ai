-- =============================================================================
-- NEXORA AI — PostgreSQL Seed Data: Demo Refinery Project (Full Lifecycle)
-- =============================================================================
-- This seed creates a complete, realistic demo project with:
--   - 1 project with 3 members
--   - 1 baseline schedule version
--   - 3 WBS areas (CDU, Pipe Rack B, Compressor House)
--   - 8 activities across 5 disciplines (PIPING, CIVIL, MECHANICAL, ELECTRICAL, INSTRUMENTATION)
--   - 3 activity dependencies (FS network logic)
--   - Activity current states (mixed: IN_PROGRESS, COMPLETED, NOT_STARTED, DELAYED)
--   - 3 documents (evidence files)
--   - 6 work observations (field reports)
--   - 6 match proposals (AI matching results)
--   - 4 actual events (committed progress entries)
--   - 3 approvals (planner review actions)
--   - 5 audit events (tamper-evident trail)
--   - 10 terminology entries (site colloquialism dictionary)
-- =============================================================================

-- ─────────────────────────────────────────────────
-- 1. Demo Project
-- ─────────────────────────────────────────────────
INSERT INTO projects (id, code, name, description, client_name, location, status, timezone, currency)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'PRD-HYD-PKG04',
    'Paradip-Hyderabad Refinery Expansion - Package 04',
    'EPC Package for Crude Distillation Unit (CDU), Pipe Rack B, and Compressor Station',
    'Indian Oil Corporation Ltd.',
    'Paradip, Odisha',
    'ACTIVE',
    'Asia/Kolkata',
    'INR'
) ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    client_name = EXCLUDED.client_name,
    location = EXCLUDED.location;

-- ─────────────────────────────────────────────────
-- 2. Project Members
-- ─────────────────────────────────────────────────
INSERT INTO project_members (id, project_id, user_id, email, full_name, role, discipline)
VALUES
(
    'a1000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'u0000000-0000-0000-0000-000000000001',
    'rajesh.sharma@nexora.infra',
    'Rajesh Sharma (Lead Planner)',
    'PLANNER',
    NULL
),
(
    'a1000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'u0000000-0000-0000-0000-000000000002',
    'amit.verma@nexora.infra',
    'Amit Verma (Site Supervisor - Piping)',
    'SUPERVISOR',
    'PIPING'
),
(
    'a1000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'u0000000-0000-0000-0000-000000000003',
    'priya.nair@nexora.infra',
    'Priya Nair (Project Manager)',
    'ADMIN',
    NULL
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────
-- 3. Schedule Version (Current Baseline)
-- ─────────────────────────────────────────────────
INSERT INTO schedule_versions (id, project_id, version_number, version_label, version_type, source_system, is_active)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    1,
    'Rev 0 — Master Approved Baseline',
    'BASELINE',
    'Primavera P6',
    true
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────
-- 4. WBS Nodes (L1 to L3)
-- ─────────────────────────────────────────────────
INSERT INTO wbs_nodes (id, project_id, schedule_version_id, parent_id, wbs_code, name, level, path)
VALUES
-- Level 1: Project Level
(
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    NULL,
    'WBS.04',
    'Package 04 Refinery Expansion',
    1,
    'WBS.04'
),
-- Level 2: Areas
(
    'c0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'WBS.04.100',
    'Area 100 — Crude Distillation Unit (CDU)',
    2,
    'WBS.04/WBS.04.100'
),
(
    'c0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'WBS.04.101',
    'Area 101 — Main Interconnecting Pipe Rack B',
    2,
    'WBS.04/WBS.04.101'
),
(
    'c0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'WBS.04.102',
    'Area 102 — Compressor House',
    2,
    'WBS.04/WBS.04.102'
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────
-- 5. L5/L6 Schedule Activities (8 activities, 5 disciplines)
-- ─────────────────────────────────────────────────
INSERT INTO activities (
    id, project_id, schedule_version_id, wbs_id, code, name, description, discipline,
    planned_start_date, planned_finish_date, planned_duration_days, planned_quantity, unit_of_measure,
    location, zone, equipment_tag, weightage, critical_path
) VALUES
(
    'd0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000003',
    'PIP-2400',
    'Spool Erection and Alignment - Pipe Rack B',
    'Prefabricated carbon steel piping spool erection, alignment and tack welding along Grid B1-B8',
    'PIPING',
    '2026-08-10', '2026-08-25', 15, 450.0, 'Inch-Dia',
    'Pipe Rack B', 'Zone 2', 'RACK-B-CS', 1.5, true
),
(
    'd0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000003',
    'PIP-2401',
    'Hydrostatic Testing - Line P-101 (Crude Feed Header)',
    'Pressure testing of 24 inch crude feed header Line P-101 at 42.5 bar with holding time 4 hours',
    'PIPING',
    '2026-08-26', '2026-08-28', 3, 1.0, 'Test-Pack',
    'Pipe Rack B', 'Zone 2', 'LINE-P-101', 2.0, true
),
(
    'd0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000003',
    'PIP-2402',
    'Hydrostatic Testing - Line P-102 (Naphtha Return Header)',
    'Pressure testing of 16 inch naphtha return header Line P-102 at 32.0 bar with holding time 4 hours',
    'PIPING',
    '2026-08-28', '2026-08-30', 3, 1.0, 'Test-Pack',
    'Pipe Rack B', 'Zone 2', 'LINE-P-102', 1.8, false
),
(
    'd0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000004',
    'CIV-1100',
    'Rebar Tying and Shuttering - Compressor Foundation',
    'Reinforcement steel bar cutting, bending, binding, and formwork for Main Gas Compressor C-101',
    'CIVIL',
    '2026-08-15', '2026-08-24', 10, 35.5, 'MT',
    'Compressor House', 'Zone 1', 'FND-C-101', 1.2, false
),
(
    'd0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    'CIV-1101',
    'Concrete Pour - Column Footings Area 100',
    'M35 grade ready-mix concrete pouring for heavy column footings C1 to C12 in CDU area',
    'CIVIL',
    '2026-08-25', '2026-08-29', 5, 180.0, 'Cu.M',
    'CDU Area 100', 'Zone 1', 'COL-FTG-100', 1.4, false
),
(
    'd0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    'MEC-3200',
    'Equipment Alignment - Crude Charge Pump P-101A',
    'Precision dial indicator shaft alignment and baseplate grouting for Crude Charge Pump P-101A',
    'MECHANICAL',
    '2026-08-28', '2026-09-02', 5, 1.0, 'Unit',
    'CDU Area 100', 'Zone 1', 'PUMP-P-101A', 2.0, true
),
(
    'd0000000-0000-0000-0000-000000000007',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000003',
    'ELE-4100',
    'Cable Tray Installation - Pipe Rack Tier 3',
    'Installation of galvanized steel ladder type cable trays along Rack B Tier 3 for HV power cables',
    'ELECTRICAL',
    '2026-08-20', '2026-08-31', 12, 620.0, 'Meters',
    'Pipe Rack B', 'Zone 2', 'TRAY-RACK-B3', 1.1, false
),
(
    'd0000000-0000-0000-0000-000000000008',
    'a0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000002',
    'INS-5100',
    'Transmitter Calibration and Hookup - PT-101',
    'Bench calibration, impulse tubing hookup and loop test for Pressure Transmitter PT-101 on CDU column inlet',
    'INSTRUMENTATION',
    '2026-08-29', '2026-09-03', 5, 1.0, 'Tag',
    'CDU Area 100', 'Zone 1', 'PT-101', 1.3, false
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────
-- 6. Activity Current State (mixed statuses for realistic demo)
-- ─────────────────────────────────────────────────
INSERT INTO activity_current_state (
    activity_id, project_id, execution_status, actual_start_date, actual_finish_date,
    current_progress_pct, cumulative_quantity, is_critical_path_delayed, variance_days
) VALUES
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'IN_PROGRESS',  '2026-08-10', NULL,          80.0,  360.0, false, 0),
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'NOT_STARTED',  NULL,          NULL,           0.0,    0.0, false, 0),
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'NOT_STARTED',  NULL,          NULL,           0.0,    0.0, false, 0),
('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'COMPLETED',    '2026-08-15', '2026-08-24', 100.0,   35.5, false, 0),
('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000001', 'IN_PROGRESS',  '2026-08-25', NULL,          45.0,   81.0, false, 0),
('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000001', 'NOT_STARTED',  NULL,          NULL,           0.0,    0.0, false, 0),
('d0000000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000001', 'DELAYED',      '2026-08-20', NULL,          30.0,  186.0, false, 3),
('d0000000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000001', 'NOT_STARTED',  NULL,          NULL,           0.0,    0.0, false, 0)
ON CONFLICT (activity_id) DO UPDATE SET
    execution_status = EXCLUDED.execution_status,
    actual_start_date = EXCLUDED.actual_start_date,
    actual_finish_date = EXCLUDED.actual_finish_date,
    current_progress_pct = EXCLUDED.current_progress_pct,
    cumulative_quantity = EXCLUDED.cumulative_quantity,
    is_critical_path_delayed = EXCLUDED.is_critical_path_delayed,
    variance_days = EXCLUDED.variance_days;

-- ─────────────────────────────────────────────────
-- 7. Activity Dependencies (Network Logic)
-- ─────────────────────────────────────────────────
INSERT INTO activity_dependencies (
    schedule_version_id, predecessor_id, successor_id, dependency_type, lag_days
) VALUES
('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'FS', 1),
('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000005', 'FS', 1),
('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000006', 'FS', 0)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────
-- 8. Documents (Evidence files — metadata only)
-- ─────────────────────────────────────────────────
INSERT INTO documents (
    id, project_id, filename, mime_type, size_bytes, storage_bucket, storage_key,
    checksum_sha256, source_type, document_type, classification, uploaded_by, processing_status
) VALUES
(
    'f0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'DPR_PipeRackB_2026-08-28.pdf',
    'application/pdf', 245760,
    'evidence-documents', 'PRD-HYD-PKG04/reports/DPR_PipeRackB_2026-08-28.pdf',
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6abcd',
    'DAILY_REPORT', 'Daily Progress Report', 'INTERNAL',
    'u0000000-0000-0000-0000-000000000002',
    'COMPLETED'
),
(
    'f0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'CompressorFoundation_Rebar_Completion.xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 89600,
    'evidence-documents', 'PRD-HYD-PKG04/spreadsheets/CompressorFoundation_Rebar_Completion.xlsx',
    'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6bcde',
    'DISCIPLINE_SPREADSHEET', 'Discipline Tracker', 'INTERNAL',
    'u0000000-0000-0000-0000-000000000002',
    'COMPLETED'
),
(
    'f0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'CableTray_Delay_SiteNote_2026-08-29.pdf',
    'application/pdf', 102400,
    'evidence-documents', 'PRD-HYD-PKG04/reports/CableTray_Delay_SiteNote_2026-08-29.pdf',
    'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6cdef',
    'SITE_DIARY', 'Site Diary / Delay Note', 'INTERNAL',
    'u0000000-0000-0000-0000-000000000002',
    'COMPLETED'
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────
-- 9. Work Observations (Field reports extracted from documents)
-- ─────────────────────────────────────────────────
INSERT INTO work_observations (
    id, project_id, document_id, reported_by, observed_at, discipline,
    location, zone, equipment_tag, raw_text, normalized_text, event_type,
    reported_progress, reported_quantity, unit_of_measure
) VALUES
-- Obs 1: Spool erection progress from DPR
(
    'g0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    'u0000000-0000-0000-0000-000000000002',
    '2026-08-28 17:00:00+05:30',
    'PIPING', 'Pipe Rack B', 'Zone 2', 'RACK-B-CS',
    'Spool erection on Rack B Grid B5-B8 completed today. 45 inch-dia erected. Total cumulative 360 inch-dia. Alignment checks passed for all spools up to B6.',
    'Spool Erection and Alignment - Pipe Rack B progress update: 360 inch-dia cumulative, 80% complete',
    'PROGRESS', 80.0, 360.0, 'Inch-Dia'
),
-- Obs 2: Rebar completion from spreadsheet
(
    'g0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    'u0000000-0000-0000-0000-000000000002',
    '2026-08-24 18:00:00+05:30',
    'CIVIL', 'Compressor House', 'Zone 1', 'FND-C-101',
    'Rebar tying for C-101 compressor foundation fully complete. All 35.5 MT placed. QC inspection passed. Shuttering removed.',
    'Rebar Tying and Shuttering - Compressor Foundation: 100% complete, 35.5 MT',
    'FINISH', 100.0, 35.5, 'MT'
),
-- Obs 3: Concrete pour started
(
    'g0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000002',
    'u0000000-0000-0000-0000-000000000002',
    '2026-08-25 09:00:00+05:30',
    'CIVIL', 'CDU Area 100', 'Zone 1', 'COL-FTG-100',
    'Concrete pouring started for column footings C1 to C4 in CDU area. 81 cu.m poured today using M35 grade RMC.',
    'Concrete Pour - Column Footings Area 100: started, 81 cu.m poured, 45% complete',
    'START', 45.0, 81.0, 'Cu.M'
),
-- Obs 4: Cable tray delay observation
(
    'g0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000003',
    'u0000000-0000-0000-0000-000000000002',
    '2026-08-29 16:30:00+05:30',
    'ELECTRICAL', 'Pipe Rack B', 'Zone 2', 'TRAY-RACK-B3',
    'Cable tray work on Tier 3 delayed by 3 days. Material shortage — galvanized brackets not delivered. Only 186 meters installed out of 620.',
    'Cable Tray Installation - Pipe Rack Tier 3: delayed 3 days, material shortage, 186 of 620 meters',
    'DELAY', 30.0, 186.0, 'Meters'
),
-- Obs 5: Ambiguous observation (needs planner review)
(
    'g0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    'u0000000-0000-0000-0000-000000000002',
    '2026-08-28 15:00:00+05:30',
    'PIPING', 'Pipe Rack B', 'Zone 2', NULL,
    'Hydrotest prep work started on Rack B area. Test manifold installed near P-101 location. Nitrogen purging completed.',
    'Hydrostatic Testing preparation for lines near P-101/P-102 area',
    'START', NULL, NULL, NULL
),
-- Obs 6: Equipment alignment not yet started observation
(
    'g0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    'u0000000-0000-0000-0000-000000000002',
    '2026-08-28 14:00:00+05:30',
    'MECHANICAL', 'CDU Area 100', 'Zone 1', 'PUMP-P-101A',
    'P-101A pump baseplate grouting material received on site. Alignment jig checked. Work to begin after hydrotest of P-101 line.',
    'Equipment Alignment - Crude Charge Pump P-101A: grouting material received, pending hydrotest completion',
    'PROGRESS', 0.0, 0.0, 'Unit'
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────
-- 10. Match Proposals (AI matching results)
-- ─────────────────────────────────────────────────
INSERT INTO match_proposals (
    id, project_id, observation_id, activity_id, candidate_rank,
    lexical_score, semantic_score, context_boost, confidence_score,
    match_tier, explanation, evidence_snippet, model_version, status
) VALUES
-- HIGH confidence: Obs 1 → PIP-2400 (exact match)
(
    'h0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'g0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    1, 0.92, 0.95, 0.05, 0.94,
    'HIGH',
    'Exact discipline, location, equipment tag, and activity name match. Quantity and UoM match perfectly.',
    'Spool erection on Rack B Grid B5-B8 completed today.',
    'all-MiniLM-L6-v2',
    'AUTO_LINKED'
),
-- HIGH confidence: Obs 2 → CIV-1100 (exact match)
(
    'h0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'g0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000004',
    1, 0.88, 0.93, 0.04, 0.91,
    'HIGH',
    'Discipline CIVIL, equipment tag FND-C-101, and quantity 35.5 MT all match exactly.',
    'Rebar tying for C-101 compressor foundation fully complete.',
    'all-MiniLM-L6-v2',
    'AUTO_LINKED'
),
-- HIGH confidence: Obs 3 → CIV-1101 (start event)
(
    'h0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'g0000000-0000-0000-0000-000000000003',
    'd0000000-0000-0000-0000-000000000005',
    1, 0.85, 0.90, 0.03, 0.88,
    'HIGH',
    'Discipline CIVIL, location CDU Area 100, and M35 concrete mention aligns with planned pour activity.',
    'Concrete pouring started for column footings C1 to C4.',
    'all-MiniLM-L6-v2',
    'AUTO_LINKED'
),
-- HIGH confidence: Obs 4 → ELE-4100 (delay event)
(
    'h0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'g0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000007',
    1, 0.80, 0.87, 0.06, 0.86,
    'HIGH',
    'Discipline ELECTRICAL, equipment tag TRAY-RACK-B3, Tier 3 reference, and delay days all match.',
    'Cable tray work on Tier 3 delayed by 3 days.',
    'all-MiniLM-L6-v2',
    'ACCEPTED'
),
-- MEDIUM confidence: Obs 5 → PIP-2401 (ambiguous — could be P-101 or P-102)
(
    'h0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000001',
    'g0000000-0000-0000-0000-000000000005',
    'd0000000-0000-0000-0000-000000000002',
    1, 0.60, 0.72, 0.08, 0.68,
    'MEDIUM',
    'Discipline PIPING and P-101 location match, but observation mentions both P-101 and P-102 areas. Needs planner review.',
    'Hydrotest prep work started on Rack B area.',
    'all-MiniLM-L6-v2',
    'PENDING_REVIEW'
),
-- LOW confidence: Obs 5 → PIP-2402 (second candidate for same observation)
(
    'h0000000-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000001',
    'g0000000-0000-0000-0000-000000000005',
    'd0000000-0000-0000-0000-000000000003',
    2, 0.55, 0.65, 0.05, 0.58,
    'LOW',
    'Also PIPING discipline and Rack B location, but observation primarily mentions P-101. P-102 is a weaker match.',
    'Hydrotest prep work started on Rack B area.',
    'all-MiniLM-L6-v2',
    'PENDING_REVIEW'
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────
-- 11. Actual Events (Committed progress — immutable ledger)
-- ─────────────────────────────────────────────────
INSERT INTO actual_events (
    id, project_id, activity_id, observation_id, match_proposal_id,
    event_type, actual_date, actual_progress_pct, actual_quantity,
    delay_reason, delay_days, lifecycle_status, verification_status,
    idempotency_key, created_by
) VALUES
-- Event 1: PIP-2400 progress (auto-linked, system verified)
(
    'i0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'g0000000-0000-0000-0000-000000000001',
    'h0000000-0000-0000-0000-000000000001',
    'PROGRESS', '2026-08-28', 80.0, 360.0,
    NULL, NULL, 'COMMITTED', 'SYSTEM_VERIFIED',
    'evt-pip2400-prog-20260828', 'u0000000-0000-0000-0000-000000000001'
),
-- Event 2: CIV-1100 finish (auto-linked, system verified)
(
    'i0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000004',
    'g0000000-0000-0000-0000-000000000002',
    'h0000000-0000-0000-0000-000000000002',
    'FINISH', '2026-08-24', 100.0, 35.5,
    NULL, NULL, 'COMMITTED', 'SYSTEM_VERIFIED',
    'evt-civ1100-fin-20260824', 'u0000000-0000-0000-0000-000000000001'
),
-- Event 3: CIV-1101 start (auto-linked, system verified)
(
    'i0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000005',
    'g0000000-0000-0000-0000-000000000003',
    'h0000000-0000-0000-0000-000000000003',
    'START', '2026-08-25', 45.0, 81.0,
    NULL, NULL, 'COMMITTED', 'SYSTEM_VERIFIED',
    'evt-civ1101-start-20260825', 'u0000000-0000-0000-0000-000000000001'
),
-- Event 4: ELE-4100 delay (human verified after planner approval)
(
    'i0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000007',
    'g0000000-0000-0000-0000-000000000004',
    'h0000000-0000-0000-0000-000000000004',
    'DELAY', '2026-08-29', 30.0, 186.0,
    'Material shortage — galvanized brackets not delivered by vendor', 3,
    'APPROVED', 'HUMAN_VERIFIED',
    'evt-ele4100-delay-20260829', 'u0000000-0000-0000-0000-000000000001'
) ON CONFLICT DO NOTHING;

-- Link last events to activity_current_state
UPDATE activity_current_state SET last_event_id = 'i0000000-0000-0000-0000-000000000001', last_event_date = '2026-08-28' WHERE activity_id = 'd0000000-0000-0000-0000-000000000001';
UPDATE activity_current_state SET last_event_id = 'i0000000-0000-0000-0000-000000000002', last_event_date = '2026-08-24' WHERE activity_id = 'd0000000-0000-0000-0000-000000000004';
UPDATE activity_current_state SET last_event_id = 'i0000000-0000-0000-0000-000000000003', last_event_date = '2026-08-25' WHERE activity_id = 'd0000000-0000-0000-0000-000000000005';
UPDATE activity_current_state SET last_event_id = 'i0000000-0000-0000-0000-000000000004', last_event_date = '2026-08-29' WHERE activity_id = 'd0000000-0000-0000-0000-000000000007';

-- ─────────────────────────────────────────────────
-- 12. Approvals (Planner review actions)
-- ─────────────────────────────────────────────────
INSERT INTO approvals (
    id, project_id, event_id, proposal_id, action,
    reviewed_by, comments, confidence_override
) VALUES
-- Approval 1: Planner approved cable tray delay event
(
    'j0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'i0000000-0000-0000-0000-000000000004',
    'h0000000-0000-0000-0000-000000000004',
    'APPROVE',
    'u0000000-0000-0000-0000-000000000001',
    'Confirmed with site — vendor delay is genuine. Material expected by Sep 1.',
    NULL
),
-- Approval 2: Planner approved auto-linked spool erection (manual confirmation)
(
    'j0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'i0000000-0000-0000-0000-000000000001',
    'h0000000-0000-0000-0000-000000000001',
    'APPROVE',
    'u0000000-0000-0000-0000-000000000001',
    'Verified quantity with DPR. All alignment checks passed.',
    0.96
),
-- Approval 3: Planner approved rebar completion
(
    'j0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'i0000000-0000-0000-0000-000000000002',
    'h0000000-0000-0000-0000-000000000002',
    'APPROVE',
    'u0000000-0000-0000-0000-000000000001',
    'QC clearance obtained. Foundation ready for concrete.',
    NULL
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────
-- 13. Audit Events (Tamper-evident trail with hash chain)
-- ─────────────────────────────────────────────────
INSERT INTO audit_events (
    id, project_id, entity_type, entity_id, action,
    actor_id, actor_role, before_state, after_state,
    payload_hash, previous_hash
) VALUES
-- Audit 1: Spool erection auto-linked
(
    'k0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'ACTUAL_EVENT', 'i0000000-0000-0000-0000-000000000001',
    'AUTO_LINK_COMMIT',
    NULL, 'SYSTEM',
    '{"lifecycle_status": "PROPOSED"}'::jsonb,
    '{"lifecycle_status": "COMMITTED", "verification_status": "SYSTEM_VERIFIED", "confidence": 0.94}'::jsonb,
    'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd',
    NULL
),
-- Audit 2: Rebar completion auto-linked
(
    'k0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'ACTUAL_EVENT', 'i0000000-0000-0000-0000-000000000002',
    'AUTO_LINK_COMMIT',
    NULL, 'SYSTEM',
    '{"lifecycle_status": "PROPOSED"}'::jsonb,
    '{"lifecycle_status": "COMMITTED", "verification_status": "SYSTEM_VERIFIED", "confidence": 0.91}'::jsonb,
    'b2c3d4e5f6789012345678901234567890123456789012345678901234bcde',
    'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd'
),
-- Audit 3: Concrete pour auto-linked
(
    'k0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'ACTUAL_EVENT', 'i0000000-0000-0000-0000-000000000003',
    'AUTO_LINK_COMMIT',
    NULL, 'SYSTEM',
    '{"lifecycle_status": "PROPOSED"}'::jsonb,
    '{"lifecycle_status": "COMMITTED", "verification_status": "SYSTEM_VERIFIED", "confidence": 0.88}'::jsonb,
    'c3d4e5f6789012345678901234567890123456789012345678901234cdef',
    'b2c3d4e5f6789012345678901234567890123456789012345678901234bcde'
),
-- Audit 4: Cable tray delay — planner approved
(
    'k0000000-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000001',
    'ACTUAL_EVENT', 'i0000000-0000-0000-0000-000000000004',
    'HUMAN_APPROVE',
    'u0000000-0000-0000-0000-000000000001', 'PLANNER',
    '{"lifecycle_status": "REVIEW_REQUIRED"}'::jsonb,
    '{"lifecycle_status": "APPROVED", "verification_status": "HUMAN_VERIFIED", "comments": "Vendor delay confirmed"}'::jsonb,
    'd4e5f6789012345678901234567890123456789012345678901234defg',
    'c3d4e5f6789012345678901234567890123456789012345678901234cdef'
),
-- Audit 5: Spool erection planner manual confirmation
(
    'k0000000-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000001',
    'APPROVAL', 'j0000000-0000-0000-0000-000000000002',
    'PLANNER_CONFIRMATION',
    'u0000000-0000-0000-0000-000000000001', 'PLANNER',
    '{"confidence": 0.94}'::jsonb,
    '{"confidence_override": 0.96, "comments": "Verified quantity with DPR"}'::jsonb,
    'e5f6789012345678901234567890123456789012345678901234efgh',
    'd4e5f6789012345678901234567890123456789012345678901234defg'
) ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────
-- 14. Terminology Dictionary (Normalizes site colloquialisms)
-- ─────────────────────────────────────────────────
INSERT INTO terminology (project_id, discipline, synonym_term, canonical_term, context_notes)
VALUES
('a0000000-0000-0000-0000-000000000001', 'PIPING', 'spool erection', 'Spool Erection and Alignment', 'Piping erection on pipe racks'),
('a0000000-0000-0000-0000-000000000001', 'PIPING', 'hydro test', 'Hydrostatic Testing', 'Water pressure test pack'),
('a0000000-0000-0000-0000-000000000001', 'PIPING', 'hydrotest done', 'Hydrostatic Testing', 'Hydrostatic test pack complete'),
('a0000000-0000-0000-0000-000000000001', 'PIPING', 'p-101', 'Line P-101', 'Header Line Tag P-101'),
('a0000000-0000-0000-0000-000000000001', 'CIVIL', 'pour done', 'Concrete Pour', 'Concrete batching and casting complete'),
('a0000000-0000-0000-0000-000000000001', 'CIVIL', 'concreting', 'Concrete Pour', 'Pouring RCC mix'),
('a0000000-0000-0000-0000-000000000001', 'CIVIL', 'rebar', 'Rebar Tying and Shuttering', 'Reinforcement steel bar'),
('a0000000-0000-0000-0000-000000000001', 'MECHANICAL', 'pump alignment', 'Equipment Alignment - Crude Charge Pump P-101A', 'Shaft alignment and grouting'),
('a0000000-0000-0000-0000-000000000001', 'ELECTRICAL', 'traying', 'Cable Tray Installation', 'Cable tray bracket and run'),
('a0000000-0000-0000-0000-000000000001', 'INSTRUMENTATION', 'pt calibration', 'Transmitter Calibration and Hookup - PT-101', 'Pressure transmitter loop test')
ON CONFLICT DO NOTHING;

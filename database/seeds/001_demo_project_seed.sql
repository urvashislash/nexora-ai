-- =============================================================================
-- NEXORA AI — PostgreSQL Seed Data: Demo Refinery Project
-- =============================================================================

-- 1. Demo Project
INSERT INTO projects (id, code, name, description, timezone, currency)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'PRD-HYD-PKG04',
    'Paradip-Hyderabad Refinery Expansion - Package 04',
    'EPC Package for Crude Distillation Unit (CDU), Pipe Rack B, and Compressor Station',
    'Asia/Kolkata',
    'INR'
) ON CONFLICT (code) DO NOTHING;

-- 2. Project Members
INSERT INTO project_members (id, project_id, user_id, email, full_name, role)
VALUES 
(
    'a1000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'u0000000-0000-0000-0000-000000000001',
    'rajesh.sharma@nexora.infra',
    'Rajesh Sharma (Lead Planner)',
    'PLANNER'
),
(
    'a1000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'u0000000-0000-0000-0000-000000000002',
    'amit.verma@nexora.infra',
    'Amit Verma (Site Supervisor - Piping)',
    'SUPERVISOR'
),
(
    'a1000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'u0000000-0000-0000-0000-000000000003',
    'priya.nair@nexora.infra',
    'Priya Nair (Project Manager)',
    'ADMIN'
) ON CONFLICT DO NOTHING;

-- 3. Schedule Version (Current Baseline)
INSERT INTO schedule_versions (id, project_id, version_number, version_label, version_type, is_active)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    1,
    'Rev 0 — Master Approved Baseline',
    'BASELINE',
    true
) ON CONFLICT DO NOTHING;

-- 4. WBS Nodes (L1 to L4)
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

-- 5. L5/L6 Schedule Activities
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
    '2026-08-10',
    '2026-08-25',
    15,
    450.0,
    'Inch-Dia',
    'Pipe Rack B',
    'Zone 2',
    'RACK-B-CS',
    1.5,
    true
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
    '2026-08-26',
    '2026-08-28',
    3,
    1.0,
    'Test-Pack',
    'Pipe Rack B',
    'Zone 2',
    'LINE-P-101',
    2.0,
    true
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
    '2026-08-28',
    '2026-08-30',
    3,
    1.0,
    'Test-Pack',
    'Pipe Rack B',
    'Zone 2',
    'LINE-P-102',
    1.8,
    false
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
    '2026-08-15',
    '2026-08-24',
    10,
    35.5,
    'MT',
    'Compressor House',
    'Zone 1',
    'FND-C-101',
    1.2,
    false
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
    '2026-08-25',
    '2026-08-29',
    5,
    180.0,
    'Cu.M',
    'CDU Area 100',
    'Zone 1',
    'COL-FTG-100',
    1.4,
    false
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
    '2026-08-28',
    '2026-09-02',
    5,
    1.0,
    'Unit',
    'CDU Area 100',
    'Zone 1',
    'PUMP-P-101A',
    2.0,
    true
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
    '2026-08-20',
    '2026-08-31',
    12,
    620.0,
    'Meters',
    'Pipe Rack B',
    'Zone 2',
    'TRAY-RACK-B3',
    1.1,
    false
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
    '2026-08-29',
    '2026-09-03',
    5,
    1.0,
    'Tag',
    'CDU Area 100',
    'Zone 1',
    'PT-101',
    1.3,
    false
) ON CONFLICT DO NOTHING;

-- Initialize Activity Current State for each activity
INSERT INTO activity_current_state (
    activity_id, project_id, execution_status, current_progress_pct, variance_days
)
SELECT id, project_id, 'NOT_STARTED', 0.0, 0
FROM activities
ON CONFLICT (activity_id) DO NOTHING;

-- 6. Activity Dependencies (Network Logic)
INSERT INTO activity_dependencies (
    schedule_version_id, predecessor_id, successor_id, dependency_type, lag_days
) VALUES
-- PIP-2400 (Spool Erection) -> PIP-2401 (Hydrotest Line P-101) [Finish-to-Start]
(
    'b0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'FS',
    1
),
-- CIV-1100 (Rebar) -> CIV-1101 (Concrete Pour) [Finish-to-Start]
(
    'b0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000004',
    'd0000000-0000-0000-0000-000000000005',
    'FS',
    1
),
-- PIP-2401 (Hydrotest Line P-101) -> MEC-3200 (Pump P-101A alignment) [Finish-to-Start]
(
    'b0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000006',
    'FS',
    0
) ON CONFLICT DO NOTHING;

-- 7. Terminology Dictionary (Normalizes site colloquialisms)
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

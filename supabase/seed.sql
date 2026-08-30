-- Demo seed data for NEXORA AI
-- Keeps a minimal but realistic sample project that can be used in local or Supabase dev.

insert into projects (id, code, name, description, timezone, currency)
values (
  'a0000000-0000-0000-0000-000000000001',
  'NEX-001',
  'Crude Distillation Unit Expansion',
  'Sample project for L5/L6 schedule linking and actual-progress tracking.',
  'Asia/Kolkata',
  'INR'
)
on conflict (code) do nothing;

insert into project_members (id, project_id, user_id, email, full_name, role, is_active)
values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid(), 'planner@nexora.local', 'Planner User', 'PLANNER', true),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid(), 'engineer@nexora.local', 'Discipline Engineer', 'ENGINEER', true),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', gen_random_uuid(), 'supervisor@nexora.local', 'Site Supervisor', 'SUPERVISOR', true)
on conflict do nothing;

insert into schedule_versions (id, project_id, version_number, version_label, version_type, source_file_id, is_active)
values (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  1,
  'Baseline V1',
  'BASELINE',
  null,
  true
)
on conflict do nothing;

insert into wbs_nodes (id, project_id, schedule_version_id, parent_id, wbs_code, name, level, path)
values
  ('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', null, '1', 'Project', 1, '1'),
  ('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '1.1', 'Mechanical Works', 2, '1.1'),
  ('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', '1.1.1', 'Piping Rack B', 3, '1.1.1')
on conflict do nothing;

insert into activities (
  id, project_id, schedule_version_id, wbs_id, code, name, description, discipline,
  planned_start_date, planned_finish_date, planned_duration_days, planned_quantity,
  unit_of_measure, location, zone, equipment_tag, weightage, critical_path, created_at, updated_at
)
values
  (
    'e0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000003',
    'PIP-2400',
    'Spool Erection and Alignment - Pipe Rack B',
    'Prefabricated carbon steel piping spool erection on Rack B.',
    'PIPING',
    '2026-08-10',
    '2026-08-25',
    15,
    450,
    'Inch-Dia',
    'Pipe Rack B',
    'Zone 2',
    'RACK-B-CS',
    1.5,
    true,
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000003',
    'PIP-2401',
    'Hydrostatic Testing - Line P-101',
    'Pressure testing of 24 inch crude feed header Line P-101.',
    'PIPING',
    '2026-08-26',
    '2026-08-28',
    3,
    1,
    'Test-Pack',
    'Pipe Rack B',
    'Zone 2',
    'LINE-P-101',
    2.0,
    true,
    now(),
    now()
  ),
  (
    'e0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    'd0000000-0000-0000-0000-000000000003',
    'CIV-1100',
    'Rebar Tying and Shuttering - Compressor Foundation',
    'Reinforcement steel bar cutting, bending, binding, and formwork for C-101.',
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
    false,
    now(),
    now()
  )
on conflict do nothing;

insert into activity_current_state (
  activity_id, project_id, execution_status, actual_start_date, actual_finish_date,
  current_progress_pct, cumulative_quantity, is_critical_path_delayed, variance_days, updated_at
)
values
  ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'IN_PROGRESS', '2026-08-10', null, 80, 360, false, 0, now()),
  ('e0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'NOT_STARTED', null, null, 0, 0, false, 0, now()),
  ('e0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'COMPLETED', '2026-08-15', '2026-08-24', 100, 35.5, false, 0, now())
on conflict do nothing;

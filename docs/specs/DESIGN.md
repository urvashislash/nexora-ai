# NEXORA AI — UI/UX Design System (Field Ledger)

## 1. Design Movement & Core Principles
The NEXORA AI frontend adopts the **Field Ledger** stylistic approach—a contemporary Swiss modernism fused with industrial control-room instrumentation and editorial information design. The experience feels calm, accountable, and built for decisions under pressure.

**Core Principles:**
1. **Evidence before abstraction:** Every high-level status is anchored to a source, timestamp, confidence, or validation state.
2. **Operational density with breathing room:** Compact, information-rich modules are separated by deliberate whitespace and hairline rules.
3. **Semantic restraint:** Green, amber, red, and muted blue are reserved for verified, review, conflict, and AI states respectively.
4. **Accountability as visual language:** IDs, source counts, sync markers, and audit metadata remain visible rather than hidden in decorative UI.

## 2. Color Philosophy
- **Base & Surface:** Warm off-white backgrounds with graphite text/elements, providing the seriousness and permanence of engineered systems while remaining readable and human.
- **Brand Signature:** **NEXORA Ochre (#C38B4B)**. A weathered brass tone used sparingly for the logo stroke, active rail indicator, and key trust progression markers.
- **Semantic Colors:**
  - **Muted Blue:** Machine intelligence and AI-extracted states.
  - **Green:** Verified, completed, or matched operations.
  - **Amber:** Pending review, warnings, or human intervention required.
  - **Red:** Conflicts, failed deliveries, or critical system errors.

## 3. Typography System
- **UI Copy & Headings:** **Inter** (weights 400, 500, 600, 700 with tight tracking).
- **Metadata & Technical Data:** **IBM Plex Mono** for project IDs, timestamps, evidence references, counts, technical metadata, and section labels.
- **Sizing:**
  - Headings: Compact declarative titles, never oversized marketing display type.
  - Body: 12–14px for a dense but readable console.
  - Labels: 10–11px uppercase mono with expanded letter spacing.

## 4. Layout Paradigm
A persistent left rail (sidebar) establishes orientation, while the main canvas behaves like a horizontally layered control board.
- **Rhythm:** Strict 8px compact spacing rhythm.
- **Structure:** Layout prefers rails, rows, and spanning bands over centered dashboard tiles. Cards are compact and square-ish.

## 5. Signature UI Elements
- **Ledger rules:** Fine horizontal dividers (hairlines), bracketed section headers.
- **Signal ticks:** Small vertical marks and status pips beside counts and flows to show state without relying on charts.
- **Evidence provenance strips:** Source chips and validation markers attached directly to events and review rows.

## 6. Interaction Philosophy
- Expose context rather than hide it.
- **Drawers:** Clicking items (review, activity, evidence) opens contextual detail drawers (e.g., Planner Review, Activity 360°, Evidence Detail) preserving the user's place in the command centre.
- **Filters:** Instantly change the visible operating set.

## 7. Animation
- **Transitions:** Restrained 160–220ms ease-out transitions for hover, focus, drawers, and filter changes.
- **Entries:** Panels enter with a small 4px translate and opacity transition. Drawer content appears as a firm operational sheet.
- **Accessibility:** Respect reduced motion preferences. No continuous pulsing.

## 8. Brand Voice
- **Tone:** Precise, accountable, field-aware. Declarative and operational headlines.
- **Microcopy:** Names the evidence or control boundary instead of generic reassurance. CTAs are explicit about the decision they trigger.

## 9. Implementation Guardrails
- **No decorative fluff:** No stock illustrations, decorative robots, glassmorphism, or oversized gradient surfaces.
- **Realistic affordances:** Navigation changes context, actions change local state, drawers expose details.

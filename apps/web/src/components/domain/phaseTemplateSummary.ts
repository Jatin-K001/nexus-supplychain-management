// Display-only summary of the fixed 10-phase template (§2) for PM·09's New
// Project Setup accordion — the actual template used at creation time lives
// server-side (apps/api/src/data/phaseTemplate.ts); this is just labels.
export const PHASE_TEMPLATE_SUMMARY = [
  { no: 1, name: 'Footings', subphaseCount: 10, unlockLabel: 'Sequential', badge: 'sequential' },
  { no: 2, name: 'Plinth Beam', subphaseCount: 4, unlockLabel: 'Sequential', badge: 'sequential' },
  { no: 3, name: 'Columns', subphaseCount: 10, unlockLabel: 'Sequential', badge: 'sequential' },
  { no: 4, name: 'Lift Wall', subphaseCount: 5, unlockLabel: 'Sequential', badge: 'sequential' },
  { no: 5, name: 'Staircase (Structural)', subphaseCount: 4, unlockLabel: 'Sequential', badge: 'sequential' },
  { no: 6, name: 'Slab', subphaseCount: 10, unlockLabel: 'Parallel + Merge', badge: 'merge' },
  { no: 7, name: 'Terrace RCC Activities', subphaseCount: 6, unlockLabel: 'Independent', badge: 'independent' },
  { no: 8, name: 'Flat Finishing', subphaseCount: 19, unlockLabel: 'Complex Parallel + Merge', badge: 'merge' },
  { no: 9, name: 'External Finishing', subphaseCount: 14, unlockLabel: 'Sequential + Parallel', badge: 'parallel' },
  { no: 10, name: 'Corridors Finishing', subphaseCount: 15, unlockLabel: 'Parallel + Sequential', badge: 'parallel' },
] as const;

// The fixed 10-phase / 97-subphase template — NEXUS_BUILD_SPEC.md §2.2 (structure)
// and §14.7 (material assignments). Shared by seed script (task 3) and the
// Phase/Subphase lifecycle API (task 4) so the two never drift apart.
//
// Each subphase: { name, unlockType, parallelGroup (or null), material: { name, qty } | null }
// unlockType per subphase defaults to the phase's unlockType unless it's inside
// a parallel/merge cluster, in which case it's called out explicitly.

const M = (name, qty) => ({ name, qty });

const PHASES = [
  {
    no: 1, name: 'Footings', unlockType: 'sequential',
    subphases: [
      { name: 'Footing PCC Pre-A', material: M('Aggregate (20mm)', 4) },
      { name: 'Footing PCC Pre-B', material: M('Sand (River, Fine)', 3) },
      { name: 'Footing PCC During', material: M('Cement (OPC 53)', 30) },
      { name: 'Footing PCC Post', material: null },
      { name: 'Footing RCC Pre-A', material: M('TMT Steel Bars (12mm)', 2) },
      { name: 'Footing RCC Pre-B', material: null },
      { name: 'Footing RCC Pre-C', material: null },
      { name: 'Footing RCC During', material: M('Cement (OPC 53)', 40) },
      { name: 'Footing RCC Post', material: null },
      { name: 'Footing Backfilling', material: M('Sand (River, Fine)', 5) },
    ],
  },
  {
    no: 2, name: 'Plinth Beam', unlockType: 'sequential',
    subphases: [
      { name: 'Plinth Beam PCC Pre-A', material: M('Cement (OPC 53)', 15) },
      { name: 'Plinth Beam Shuttering', material: M('Shuttering Plates (18mm ply)', 20) },
      { name: 'Plinth Beam RCC During', material: M('TMT Steel Bars (12mm)', 1.5) },
      { name: 'Plinth Beam RCC Post', material: null },
    ],
  },
  {
    no: 3, name: 'Columns', unlockType: 'sequential',
    subphases: [
      { name: 'Column Layout Marking', material: null },
      { name: 'Column Reinforcement (Steel) Pre-A', material: M('TMT Steel Bars (12mm)', 3.0) },
      { name: 'Column Reinforcement (Steel) Pre-B', material: M('TMT Steel Bars (12mm)', 3.0) },
      { name: 'Column Reinforcement During', material: M('TMT Steel Bars (12mm)', 3.0) },
      { name: 'Column Reinforcement Post', material: null },
      { name: 'Column Shuttering Pre-A', material: M('Shuttering Plates (18mm ply)', 40) },
      { name: 'Column Shuttering Pre-B', material: M('Shuttering Plates (18mm ply)', 20) },
      { name: 'Column Shuttering During', material: null },
      { name: 'Column Safety Clearance', material: null },
      { name: 'Column RCC Post (Casting Complete)', material: M('Cement (OPC 53)', 25) },
    ],
  },
  {
    no: 4, name: 'Lift Wall', unlockType: 'sequential',
    subphases: [
      { name: 'Lift Wall Starter Layout', material: null },
      { name: 'Lift Wall RCC Steel', material: M('TMT Steel Bars (12mm)', 2) },
      { name: 'Lift Wall Shuttering', material: M('Shuttering Plates (18mm ply)', 25) },
      { name: 'Lift Wall Safety Clearance', material: null },
      { name: 'Lift Wall RCC Post', material: M('Cement (OPC 53)', 20) },
    ],
  },
  {
    no: 5, name: 'Staircase (Structural)', unlockType: 'sequential',
    subphases: [
      { name: 'Staircase Shuttering', material: M('Shuttering Plates (18mm ply)', 15) },
      { name: 'Staircase RCC Steel', material: M('TMT Steel Bars (12mm)', 1) },
      { name: 'Staircase Electrical Works', material: M('Electrical Conduit', 30) },
      { name: 'Staircase Post Check', material: null },
    ],
  },
  {
    no: 6, name: 'Slab', unlockType: 'parallel',
    subphases: [
      { name: 'Slab Layout', material: null },
      { name: 'Slab Shuttering', material: M('Shuttering Plates (18mm ply)', 50) },
      { name: 'Beam Reinforcement', material: M('TMT Steel Bars (12mm)', 4) },
      { name: 'Slab Reinforcement', parallelGroup: 1, unlockType: 'parallel', material: M('TMT Steel Bars (12mm)', 5) },
      { name: 'Slab MEP Works', parallelGroup: 1, unlockType: 'parallel', material: M('Electrical Conduit', 100) },
      { name: 'Slab Safety Clearance', unlockType: 'merge', material: null },
      { name: 'Slab RCC During', material: M('Cement (OPC 53)', 80) },
      { name: 'Slab Curing', material: null },
      { name: 'Slab Deshuttering', material: null },
      { name: 'Slab RCC Post Check', material: null },
    ],
  },
  {
    no: 7, name: 'Terrace RCC Activities', unlockType: 'independent',
    subphases: [
      { name: 'Columns', material: M('TMT Steel Bars (12mm)', 1) },
      { name: 'Pergolas', material: M('TMT Steel Bars (12mm)', 0.5) },
      { name: 'Staircase Head Room', material: M('Cement (OPC 53)', 10) },
      { name: 'OHT (Overhead Tank)', material: M('Cement (OPC 53)', 25) },
      { name: 'Liftwalls & TopSlab/Head Room', material: M('TMT Steel Bars (12mm)', 1.5) },
      { name: 'MS Fabrication Works', material: null },
    ],
  },
  {
    no: 8, name: 'Flat Finishing', unlockType: 'merge',
    subphases: [
      { name: 'Brick Work', material: null },
      { name: 'Internal Plumbing Works', parallelGroup: 1, unlockType: 'parallel', material: M('Plumbing Fittings (PVC)', 1) },
      { name: 'Internal Electrical Works', parallelGroup: 1, unlockType: 'parallel', material: M('Electrical Fittings', 1) },
      { name: 'Balcony Railing Works', parallelGroup: 1, unlockType: 'parallel', material: null },
      { name: 'Internal Plaster', unlockType: 'merge', material: M('Cement (OPC 53)', 15) },
      { name: 'Waterproofing Balcony & Utility', parallelGroup: 2, unlockType: 'parallel', material: M('Waterproofing Compound', 2) },
      { name: 'Waterproofing Toilets', parallelGroup: 2, unlockType: 'parallel', material: M('Waterproofing Compound', 2) },
      { name: '1st Coat Putty Works', parallelGroup: 2, unlockType: 'parallel', material: null },
      { name: 'Flooring Works', parallelGroup: 2, unlockType: 'parallel', material: null },
      { name: '2nd Coat Putty Works', material: null },
      { name: 'Kitchen Platform & Granite', unlockType: 'merge', material: null },
      { name: 'Internal Primer Works', material: null },
      { name: 'Doors & Windows Fixing', material: null },
      { name: 'MEP Fixtures & Fittings', material: M('Electrical Fittings', 1) },
      { name: '1st Coat Paint Works', material: M('Paint (Exterior Emulsion)', 40) },
      { name: 'Sanitary & CP Fittings', material: null },
      { name: 'Final Painting & Floor Cleaning', material: M('Paint (Exterior Emulsion)', 25) },
      { name: 'Civil Post Check', parallelGroup: 3, unlockType: 'parallel', material: null },
      { name: 'MEP Post Check', parallelGroup: 3, unlockType: 'parallel', material: null },
    ],
  },
  {
    no: 9, name: 'External Finishing', unlockType: 'sequential',
    subphases: [
      { name: 'Safety Clearance for Z-Beams', material: null },
      { name: 'Elevation Brick Work / Z-Beams', material: M('TMT Steel Bars (12mm)', 0.5) },
      { name: 'Safety Clearance for External Plastering', material: null },
      { name: 'External Plastering', material: M('Cement (OPC 53)', 20) },
      { name: 'Safety Clearance for External Texture Coat', material: null },
      { name: 'External Texture Coat', material: null },
      { name: 'External MEP Works', unlockType: 'parallel', material: M('Electrical Conduit', 60) },
      { name: 'External Primer Works', material: M('Paint (Exterior Emulsion)', 15) },
      { name: 'Safety Clearance for Paint Works', material: null },
      { name: 'External 1st Coat Paint', material: M('Paint (Exterior Emulsion)', 30) },
      { name: 'External Elevation Elements/Louvers', parallelGroup: 1, unlockType: 'parallel', material: null },
      { name: 'External 2nd Coat Paint', parallelGroup: 1, unlockType: 'parallel', material: M('Paint (Exterior Emulsion)', 30) },
      { name: 'Civil Post Check', parallelGroup: 2, unlockType: 'parallel', material: null },
      { name: 'MEP Post Check', parallelGroup: 2, unlockType: 'parallel', material: null },
    ],
  },
  {
    no: 10, name: 'Corridors Finishing', unlockType: 'parallel',
    subphases: [
      { name: 'Brickwork', material: M('Cement (OPC 53)', 18) },
      { name: 'Electrical Conduit / JB Fixing', material: M('Electrical Conduit', 40) },
      { name: 'Internal Plastering', material: M('Cement (OPC 53)', 12) },
      { name: 'Fire Fighting Works', parallelGroup: 1, unlockType: 'parallel', material: null },
      { name: '1st Coat Putty', parallelGroup: 1, unlockType: 'parallel', material: null },
      { name: 'Flooring Works', parallelGroup: 1, unlockType: 'parallel', material: null },
      { name: 'False Ceiling', parallelGroup: 1, unlockType: 'parallel', material: null },
      { name: '2nd Coat Putty', material: null },
      { name: 'Primer', material: M('Paint (Exterior Emulsion)', 10) },
      { name: 'Doors & Windows Fixing', material: null },
      { name: '1st Coat Paint', material: M('Paint (Exterior Emulsion)', 20) },
      { name: 'MEP Final Fixtures', material: M('Electrical Fittings', 1) },
      { name: '2nd Coat Paint', material: M('Paint (Exterior Emulsion)', 20) },
      { name: 'Civil Post Check', parallelGroup: 2, unlockType: 'parallel', material: null },
      { name: 'MEP Post Check', parallelGroup: 2, unlockType: 'parallel', material: null },
    ],
  },
];

module.exports = { PHASES };

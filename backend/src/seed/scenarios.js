// Metadata for the four built-in levels. The playable map geometry lives in the frontend (src/data/levels.js);
// mapData stores a descriptor so custom scenarios can be stored through POST /api/scenarios as well.
export const BUILTIN_SCENARIOS = [
  { slug: 'training', name: 'TRAINING FACILITY', difficulty: 'EASY', peopleCount: 10, fireCount: 1, exitCount: 2, timeLimit: 120, mapData: { layout: 'rooms-corridor', grid: [48, 30], cell: 20 } },
  { slug: 'office', name: 'OFFICE BUILDING', difficulty: 'MEDIUM', peopleCount: 25, fireCount: 2, exitCount: 3, timeLimit: 100, mapData: { layout: 'office-hallway', grid: [48, 30], cell: 20 } },
  { slug: 'mall', name: 'SHOPPING MALL', difficulty: 'HARD', peopleCount: 50, fireCount: 3, exitCount: 4, timeLimit: 90, mapData: { layout: 'mall-hall', grid: [48, 30], cell: 20 } },
  { slug: 'campus', name: 'UNIVERSITY CAMPUS', difficulty: 'EXTREME', peopleCount: 75, fireCount: 4, exitCount: 4, timeLimit: 120, mapData: { layout: 'campus-quad', grid: [48, 30], cell: 20 } }
];

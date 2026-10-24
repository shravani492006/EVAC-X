export const ALGO_INFO = {
  astar: {
    name: 'A* Pathfinding',
    summary: 'Best-first graph search. Each node n is scored f(n) = g(n) + h(n): g is the real cost from the start, h is an admissible estimate to the goal. The node with the lowest f in the OPEN set is expanded next, so the search is pulled straight toward the goal but still guarantees a shortest path.',
    input: 'Grid (walkable / dangerous cells), start cell, goal cell(s), heuristic.',
    output: 'Shortest path + statistics (open / closed sets, nodes expanded, g, h, f).',
    flow: 'START → OPEN SET → CURRENT NODE → NEIGHBORS → F SCORE → PATH',
    game: 'Every person runs A* to the nearest open exit (multi-goal heuristic). Fire, blocked cells, closed exits and dense smoke are excluded or penalised, and the search re-runs when the route becomes invalid.'
  },
  flood: {
    name: 'Flood Fill', summary: 'Starting from a seed cell, repeatedly visit every connected, passable neighbour (4-connected). Implemented with a FIFO queue, so the region fills in rings (waves) around the seed. Cost is O(cells).',
    input: 'Grid with walls, seed cell.', output: 'Set of connected cells, wave number (distance) for each cell.', flow: 'SEED → QUEUE → VISIT NEIGHBORS → NEXT WAVE',
    game: 'Fire spreads wave by wave from the frontier; connected danger regions are labelled with flood fill; area statistics (cells processed / affected) come from it.'
  },
  bfs: {
    name: 'Breadth-First Search', summary: 'Flood fill with parent pointers. Because BFS explores in order of distance, the first time it reaches the goal it has found a shortest path in an unweighted grid.',
    input: 'Grid, start, goal.', output: 'Shortest path (fewest steps) and number of cells explored.', flow: 'START → QUEUE → LAYERS → GOAL → PARENT CHAIN',
    game: 'Smoke is a multi-source BFS from every burning cell: the BFS distance to the nearest fire decides how dense the smoke is.'
  },
  liang: {
    name: 'Liang–Barsky Line Clipping', summary: 'Parametric clipping of a line P(t) = P0 + t·(dx, dy) against a rectangle. For each of the 4 edges compute p and q; p<0 lines enter (raise t0 = max r), p>0 lines leave (lower t1 = min r), p=0 lines are parallel. If t0 > t1 the line is rejected, otherwise draw from P(t0) to P(t1).',
    input: 'Line endpoints, clip window (xmin, ymin, xmax, ymax).', output: 'Visible segment (or rejection) and parameters t0, t1.', flow: 'p,q → r = q/p → update t0 / t1 → accept or reject',
    game: 'Every A* path polyline is clipped to the visible viewport (or the optional clip window) before it is drawn. Zoom in to watch paths get cut.'
  },
  intersect: {
    name: 'Line-Segment Intersection', summary: 'Solve P1 + t·r = P3 + u·s with 2D cross products: t = ((P3−P1)×s)/(r×s), u = ((P3−P1)×r)/(r×s). The segments intersect when 0 ≤ t ≤ 1 and 0 ≤ u ≤ 1; r×s = 0 means parallel.',
    input: 'Two segments (four points).', output: 'Intersection flag, parameters t and u, intersection point.', flow: 'cross products → t,u → range test → point',
    game: 'Line-of-sight from a person to an exit is tested against every wall segment. Movement segments are tested against neighbouring hazard cells for collision.'
  },
  transform: {
    name: '2D Transformations', summary: 'Homogeneous 3×3 matrices: translation T(tx,ty), rotation R(θ), scaling S(sx,sy) and reflection. Matrices compose by multiplication — and order matters: T·R·S rotates/scales about the object origin then moves it; R·S·T moves first and then swings around the world origin.',
    input: 'Polygon vertices + T, R, S parameters.', output: 'Composite matrix M and transformed vertices P′ = M·P.', flow: 'P = [x y 1]ᵀ → M = T·R·S → P′ = M·P',
    game: 'People are positioned and oriented with M = T·R·S each frame, the camera (zoom/pan) is a scale·translate matrix, exit beacons rotate and flames are mirrored with a reflection matrix.'
  },
  collision: {
    name: 'Collision Detection', summary: 'Rect-vs-rect: overlap on both axes. Circle-vs-rect: clamp the circle centre to the rect and compare the distance to the radius. Point-vs-rect: bounds test. Segment-vs-rect: endpoint inside or intersects an edge.',
    input: 'Two shapes (rect, circle, point or segment).', output: 'Boolean collision result for each pair.', flow: 'broad phase (3×3 cells) → narrow phase (shape tests)',
    game: 'A person is a circle (r = 4.5). Before each move it is tested against walls, furniture, fire, debris and closed exits. A hit stops movement and triggers A* recalculation.'
  }
};

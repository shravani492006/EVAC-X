# EVAC-X — 2D Disaster Evacuation Simulator & Strategy Game

A playable emergency-evacuation game that doubles as a **Computer Graphics algorithm visualiser**. You are the emergency controller: fire and smoke spread through a building, corridors close, exits fail — and every person recomputes their escape route with a hand-written **A\*** in real time.

Everything on screen (building, people, fire, smoke, paths) is drawn with custom **HTML5 Canvas** code — no game engine, no Three.js, no pathfinding library.

---

## Problem statement
In a real emergency, the safest route changes from second to second: fire spreads, smoke reduces visibility, corridors are blocked and exits become unusable. Static evacuation maps cannot react. Responders need to understand how blockages, fire location and exit availability change the outcome *before* they happen.

## Objectives
- Simulate a dynamic disaster (fire + smoke propagation) on a grid-based floor plan.
- Let people choose and **re-plan** safe routes automatically (A\*) when the environment changes.
- Give the player tools to influence the disaster and be scored on the result.
- Demonstrate core Computer Graphics algorithms with a live inspector and an interactive lab.
- Compare scenarios with a **What-If** analysis.

## Features
- 4 fully playable levels with different maps (Training, Office, Mall, Campus), timers, scoring, stars
- Fire propagation (BFS frontier), smoke propagation (multi-source BFS), danger-region labelling
- A\* with multi-exit heuristic, dynamic re-routing, “ROUTE BLOCKED / RECALCULATING PATH…” notifications
- Collision detection (circle/rect, rect/rect, point/rect, segment/rect) driving *stop → re-route*
- Tools: Add/Clear fire, Block/Unblock corridor, Open/Close exit, Pan, Select, speed 1×/2×/4×, Start/Pause/Resume/Restart
- Zoom/pan camera built from 3×3 matrices; Liang–Barsky clipping of every path to the viewport (or an optional clip window)
- Algorithm Inspector (A\*, flood fill, smoke, clipping, collisions, line-of-sight intersection, transformation matrices)
- Algorithm Lab: A\*, Flood Fill, BFS, Liang–Barsky, Line Intersection, Transformations, Collision Detection (interactive, step-by-step)
- What-If analysis (exit blocked / extra fires / blocked corridors / delayed alarm) with comparison table + chart
- Results screen, leaderboard, stats, **Demo Mode** (works without MongoDB), optional synthesised sound with mute

## Technology stack
| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, JavaScript, plain CSS, lucide-react, Axios |
| Graphics | HTML5 Canvas 2D (custom renderer, `requestAnimationFrame`) |
| Backend | Node.js (ESM), Express 4 |
| Database | MongoDB + Mongoose |

## Computer Graphics concepts (where to find them)
| Concept | File | How it is used |
|---|---|---|
| 2D transformations (3×3 homogeneous matrices: T, R, S, reflection, inverse, decompose) | `frontend/src/algorithms/transform.js` | Person pose `M = T·R·S`, camera matrix, spinning exit beacons, mirrored flames, screen→world picking |
| A\* (f = g + h, Manhattan default, binary heap, multi-goal) | `algorithms/astar.js` | Person → best open exit; stats `g,h,f`, open/closed sets |
| Flood Fill / BFS | `algorithms/floodfill.js`, `engine/Simulation.js` | Fire frontier waves, smoke (multi-source BFS), danger-region labelling |
| Collision detection | `algorithms/geometry.js` | Person (circle r=4.5) vs walls/furniture/fire/debris/closed exits |
| Line-segment intersection | `algorithms/geometry.js` | Line-of-sight to exits, movement-segment tests |
| Liang–Barsky clipping | `algorithms/clipping.js` | Every drawn A\* path is clipped by the parametric clipper |
| Canvas rendering | `engine/Renderer.js` | Cached static layer, additive glow, sprite smoke, embers, layered flames |

**Transformation matrix** used for people:
```
[ cosθ·s  -sinθ·s  tx ]
[ sinθ·s   cosθ·s  ty ]
[   0        0      1 ]
```
**Liang–Barsky**: `p = [−dx, dx, −dy, dy]`, `q = [x0−xmin, xmax−x0, y0−ymin, ymax−y0]`; `p<0 → t0 = max(t0, q/p)`, `p>0 → t1 = min(t1, q/p)`; reject if `t0 > t1`.

## System architecture
```
┌────────────────────────── Browser (real-time, never touches the network per frame) ──────────────────────────┐
│  React UI ──► Simulation (game state) ──► Algorithms (A*, BFS, collision, intersection) ──► Canvas Renderer   │
│     │                  ▲ fixed 50 ms step                                      (Liang–Barsky clip, matrices) │
└─────┼──────────────────┼──────────────────────────────────────────────────────────────────────────────────────┘
      │ Axios (scores / leaderboard / stats only)
      ▼
 Express API ──► Mongoose ──► MongoDB          (unavailable? → DEMO MODE: localStorage)
```
The simulation runs entirely in the frontend. The backend stores only persistent data: players, scenarios, game results and the leaderboard.

## Game workflow
1. Pick a level → map, people, fires and exits are built from `data/levels.js`.
2. Before starting you may place fire, debris or close exits. Press **START** (or Space).
3. People react after a random delay, run A\* to the cheapest open exit and walk the path.
4. Every 0.8 s fire spreads; every 0.5 s smoke is recomputed by BFS. Dense smoke and fire damage health.
5. If a person’s remaining path is invalidated (fire, debris, closed exit, dense smoke) → **ROUTE BLOCKED** → A\* re-runs. If they touch a hazard the collision engine stops them first. No route → **TRAPPED**, retry every 1.5 s.
6. The mission ends when everyone is resolved or the timer hits zero. ≥ 60% saved = **MISSION COMPLETE**.

### Scoring
`+100` evacuated · `+10` exit used · `+25` safe re-route · `+50` fire contained · `−100` trapped/lost · `−200` entering a danger zone · `−50` exit lost to fire · time bonus `+5/s` on success.

## Installation
Requirements: Node.js ≥ 18.11. MongoDB is **optional**.

```bash
# frontend
cd frontend
npm install
npm run dev            # http://localhost:5173

# backend (second terminal)
cd backend
cp .env.example .env   # Windows: copy .env.example .env
npm install
npm run dev            # http://localhost:5000
```
Or from the repo root: `npm run install:all` then `npm run dev` (runs both with `concurrently`).

### MongoDB setup
- **Local:** install MongoDB Community, start `mongod`, keep `MONGODB_URI=mongodb://127.0.0.1:27017/evacx`.
- **Atlas:** create a free cluster, add your IP to the allow-list and paste the connection string into `MONGODB_URI`.
On connect the backend seeds the four built-in scenarios automatically.

### Environment variables
| Variable | Where | Default |
|---|---|---|
| `PORT` | backend | `5000` |
| `MONGODB_URI` | backend | *(unset → API runs without DB)* |
| `CORS_ORIGIN` | backend | `http://localhost:5173` (comma-separated list) |
| `VITE_API_URL` | frontend | empty → uses the Vite proxy `/api → localhost:5000` |

## Demo mode
If the backend is not running, MongoDB is not configured, or the DB connection fails, a **DEMO MODE** badge appears (click it to retry). The game is fully playable; scores are saved in `localStorage` and the leaderboard shows sample entries plus your local scores. The backend itself also stays up without MongoDB: `GET /api/health` reports `database: "disconnected"` and DB routes answer `503`.

## API
```
GET  /api/health
POST /api/scenarios      GET /api/scenarios      GET /api/scenarios/:id   (id or slug)
POST /api/games/start    POST /api/games/save
POST /api/scores         GET /api/leaderboard?level=&limit=      GET /api/stats
```
Models: `Player`, `Scenario`, `GameResult`, `Leaderboard` (best score per player × scenario).

## Project structure
```
EVAC-X/
├─ frontend/src/
│  ├─ algorithms/  transform, astar, floodfill, geometry (collision + intersection), clipping
│  ├─ engine/      Simulation (state + update), Renderer (canvas), audio, headless (What-If)
│  ├─ game/        constants, entities (Person/Fire/Exit), Building
│  ├─ data/        levels (4 maps), algoInfo (lab text)
│  ├─ components/  GameCanvas, ToolPanel, StatusPanel, Inspector, ResultsModal, WhatIf, lab/*
│  ├─ pages/       Landing, LevelSelect, GamePage, AlgorithmLab, LeaderboardPage, HowItWorks, AnalysisPage
│  ├─ services/    api.js (Axios + localStorage fallback)    hooks/  useApp.jsx   utils/
├─ backend/src/    config, models, controllers, routes, middleware, seed, server.js
└─ README.md
```

## Controls
`SELECT` inspect a person · `ADD FIRE` / `BLOCK` / `UNBLOCK` click or drag · `CLEAR FIRE` 3×3 suppression (limited charges that recharge) · `OPEN/CLOSE EXIT` click near an exit · `PAN` drag, mouse wheel zooms · `Space` start/pause · `1× 2× 4×` speed.

## Performance notes
A\* only runs when a person starts, their route is invalidated, an exit changes or the player edits the map (max 10 searches per step). Fire/smoke use fixed-interval ticks, the static building is cached to an offscreen canvas, smoke uses a pre-rendered sprite, and the React HUD updates ~6×/s rather than per frame.

## Future scope
3D version · real-time multiplayer simulation · IoT fire sensors · real building maps (CAD/BIM import) · AI-based evacuation prediction · VR evacuation training.

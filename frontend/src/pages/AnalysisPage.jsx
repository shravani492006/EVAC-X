import Nav from '../components/Nav.jsx';
import WhatIf from '../components/WhatIf.jsx';
import { useApp } from '../hooks/useApp.jsx';
import { pct } from '../utils/format.js';

export default function AnalysisPage() {
  const { lastResult: r, go, levelId } = useApp();
  const a = r && r.algo;
  const insights = r ? [
    r.exitsLost ? `${r.exitsLost} exit(s) were lost to fire — keep fire away from exits or suppress it early.` : 'No exits were lost to fire.',
    r.collisionCount ? `${r.collisionCount} collision stops forced people to stop and recalculate.` : 'Nobody had to stop for a collision.',
    `${r.safeRoutes} successful re-routes (+25 each) out of ${r.routeCalculations} A* searches.`,
    r.dangerEntries ? `${r.dangerEntries} entries into danger zones cost ${r.dangerEntries * 200} points.` : 'Nobody entered a danger zone.',
    `Exit usage: ${r.exitUsage.map((u, i) => `EXIT ${i + 1}: ${u}`).join(' · ')}.`
  ] : [];
  return (
    <div className="page-bg">
      <Nav />
      <main className="container">
        <h1 className="page-title">Algorithm analysis</h1>
        {!r ? <p className="page-sub">Finish a mission to see the algorithm statistics of your run here. You can still use the what-if tool below.</p> : (
          <>
            <p className="page-sub">{r.levelName} — {r.outcome === 'COMPLETE' ? 'mission complete' : 'mission failed'}, score {r.score.toLocaleString()}.</p>
            <div className="stat-tiles">
              <div className="tile"><div className="k">SAVED</div><div className="v">{r.peopleSaved}/{r.peopleTotal}</div></div>
              <div className="tile"><div className="k">SURVIVAL</div><div className="v">{pct(r.survivalRate)}</div></div>
              <div className="tile"><div className="k">A* SEARCHES</div><div className="v">{a.astar.calls}</div></div>
              <div className="tile"><div className="k">AVG NODES / SEARCH</div><div className="v">{Math.round(a.astar.avgExpanded)}</div></div>
              <div className="tile"><div className="k">A* TOTAL TIME</div><div className="v">{a.astar.ms.toFixed(0)}ms</div></div>
            </div>
            <div className="two-col">
              <div className="panel"><h3>A* pathfinding</h3><div className="rows"><span>Searches</span><span>{a.astar.calls}</span><span>Nodes expanded (total)</span><span>{a.astar.expanded}</span><span>Failed (no route)</span><span>{a.astar.failed}</span><span>Heuristic</span><span>Manhattan</span></div></div>
              <div className="panel"><h3>Flood fill / BFS</h3><div className="rows"><span>Cells processed</span><span>{a.flood.processed}</span><span>Fire cells ignited</span><span>{a.flood.affected}</span><span>Final danger regions</span><span>{a.flood.regions}</span></div></div>
              <div className="panel"><h3>Collision engine</h3><div className="rows"><span>Geometry checks</span><span>{a.collision.checks.toLocaleString()}</span><span>Collisions</span><span>{a.collision.collisions}</span><span>Blocked stops</span><span>{a.collision.blocked}</span></div></div>
              <div className="panel"><h3>Liang–Barsky clipping</h3><div className="rows"><span>Lines tested</span><span>{a.clip.tested.toLocaleString()}</span><span>Clipped</span><span>{a.clip.clipped.toLocaleString()}</span><span>Rejected</span><span>{a.clip.rejected.toLocaleString()}</span><span>Visible</span><span>{a.clip.visible.toLocaleString()}</span></div></div>
            </div>
            <div className="panel" style={{ margin: '16px 0' }}><h3>Insights</h3><ul style={{ margin: 0, paddingLeft: 18 }}>{insights.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
          </>
        )}
        <WhatIf defaultLevelId={r ? r.levelId : levelId} />
        <div className="controls" style={{ marginTop: 18 }}><button className="btn primary" onClick={() => go('levels')}>PLAY AGAIN</button><button className="btn" onClick={() => go('lab')}>ALGORITHM LAB</button></div>
      </main>
    </div>
  );
}

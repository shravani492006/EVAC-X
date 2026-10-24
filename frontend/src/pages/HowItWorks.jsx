import Nav from '../components/Nav.jsx';
import { useApp } from '../hooks/useApp.jsx';

const CG = [
  ['A* pathfinding', 'Every person routes to the cheapest open exit; re-runs when fire, debris or a closed exit invalidates the route.'],
  ['Flood fill / BFS', 'Fire spreads in waves from a frontier; smoke is a multi-source BFS; connected danger regions are labelled.'],
  ['2D transformations', '3×3 homogeneous matrices position/rotate people, drive the zoom/pan camera, spin exit beacons and mirror flames.'],
  ['Collision detection', 'Circle-vs-rect and segment-vs-rect tests stop people at walls, furniture, fire and debris.'],
  ['Line intersection', 'Line-of-sight from a person to an exit is tested against every wall segment.'],
  ['Liang–Barsky clipping', 'Every drawn path segment is clipped to the viewport / clip window by a manual parametric clipper.'],
  ['Canvas rendering', 'Cached static layer, additive glow, sprite-based smoke, particle embers, requestAnimationFrame loop.']
];

export default function HowItWorks() {
  const { go } = useApp();
  return (
    <div className="page-bg">
      <Nav />
      <main className="container">
        <h1 className="page-title">How it works</h1>
        <p className="page-sub">You are the emergency controller. Start the alarm, watch people escape, and use your tools to keep routes open and fire under control.</p>
        <div className="flow">
          {[['Game state', 'Grid, fire, smoke, people, exits, score, timer'], ['Game update', 'Fixed 50 ms steps; fire tick 0.8 s; smoke tick 0.5 s'], ['Algorithms', 'A*, BFS / flood fill, collisions, line intersection'], ['Canvas render', 'requestAnimationFrame, clipping, transforms']].map(([t, d], i) => <div className="step" key={t}><b>{i + 1}. {t}</b><p>{d}</p></div>)}
        </div>
        <div className="two-col">
          <div className="panel"><h3>Controls</h3>
            <div className="rows">
              <span>SELECT</span><span>click a person → inspector + path</span><span>ADD FIRE</span><span>click / drag</span><span>CLEAR FIRE</span><span>3×3 suppression (charges recharge)</span>
              <span>BLOCK / UNBLOCK</span><span>debris on cells</span><span>OPEN / CLOSE EXIT</span><span>click near an exit</span><span>PAN</span><span>drag · wheel zooms</span><span>Space</span><span>start / pause</span><span>1× 2× 4×</span><span>simulation speed</span>
            </div>
          </div>
          <div className="panel"><h3>Scoring</h3>
            <div className="rows">
              <span>Person evacuated</span><span className="good">+100</span><span>Exit successfully used</span><span className="good">+10</span><span>Safe route created (reroute)</span><span className="good">+25</span><span>Fire contained</span><span className="good">+50</span>
              <span>Person trapped / lost</span><span className="bad">−100</span><span>Person enters danger zone</span><span className="bad">−200</span><span>Exit becomes unavailable (fire)</span><span className="bad">−50</span><span>Time bonus (success)</span><span className="good">+5 / sec left</span>
            </div>
            <p className="muted" style={{ marginTop: 10, fontSize: 13 }}>Mission is complete when at least 60% are saved. Stars: 95% ★5 · 85% ★4 · 75% ★3 · 65% ★2 · 60% ★1.</p>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 16 }}><h3>Computer graphics concepts used</h3>
          <div className="rows" style={{ gridTemplateColumns: '220px 1fr' }}>{CG.map(([k, v]) => [<span key={k}>{k}</span>, <span key={k + 'v'} style={{ textAlign: 'left', fontFamily: 'var(--font)', color: 'var(--text)' }}>{v}</span>])}</div>
        </div>
        <div className="panel" style={{ marginTop: 16 }}><h3>Dynamic re-routing</h3>
          <p>When fire, debris or a closed exit blocks a person’s remaining path, the validator flags it: <b className="bad">ROUTE BLOCKED — RECALCULATING PATH…</b>. If a person physically touches a hazard, the collision engine stops them first. A new A* search runs (strictly avoiding dense smoke, then allowing it as a last resort). If no exit is reachable the person becomes <b>TRAPPED</b> and retries every 1.5 s, in case you reopen a route.</p>
        </div>
        <div className="controls" style={{ marginTop: 22 }}><button className="btn primary" onClick={() => go('levels')}>PLAY GAME</button><button className="btn cyan" onClick={() => go('lab')}>ALGORITHM LAB</button></div>
      </main>
    </div>
  );
}

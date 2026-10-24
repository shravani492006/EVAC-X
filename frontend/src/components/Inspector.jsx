import { X } from 'lucide-react';
import { radToDeg } from '../algorithms/transform.js';

const R = ({ rows }) => <div className="rows">{rows.map(([k, v], i) => [<span key={`k${i}`}>{k}</span>, <span key={`v${i}`}>{v}</span>])}</div>;
const Matrix = ({ rows }) => <div className="matrix">{rows.flat().map((v, i) => <span key={i}>{v}</span>)}</div>;
const f1 = (n) => (n == null ? '—' : Number(n).toFixed(1));

export default function Inspector({ snap, onClose }) {
  if (!snap) return null;
  const a = snap.astar, fl = snap.fire, sm = snap.smoke, c = snap.clip, co = snap.collision, t = snap.transform, los = snap.los;
  return (
    <aside className="inspector" aria-label="Algorithm inspector">
      <header><b style={{ letterSpacing: '0.12em', fontSize: 13 }}>ALGORITHM INSPECTOR</b><button className="btn sm" onClick={onClose} aria-label="Close inspector"><X size={14} /></button></header>
      <section>
        <h4>ALGORITHM: A*</h4>
        {a ? <R rows={[['Current Node', a.currentNode], ['Open Set', a.open], ['Closed Set', a.closed], ['Nodes Expanded', a.expanded], ['g(n)', a.g], ['h(n) Manhattan', a.h], ['f(n) = g + h', a.f], ['Path Length', a.pathLength], ['Search time', `${a.ms} ms`], ['Total searches', snap.astarTotals.calls]]} /> : <p className="muted">No search yet — press START.</p>}
      </section>
      <section>
        <h4>ALGORITHM: FLOOD FILL (FIRE · BFS)</h4>
        <R rows={[['Cells Processed', fl.processed], ['Cells Affected', fl.affected], ['Burning cells', fl.cells], ['Fire Radius', fl.radius], ['Spread chance / tick', fl.spreadRate]]} />
      </section>
      <section>
        <h4>ALGORITHM: SMOKE (MULTI-SOURCE BFS)</h4>
        <R rows={[['Smoke Radius', sm.radius], ['Smoky cells', sm.cells], ['BFS cells processed', sm.processed], ['Danger regions', snap.regions.count], ['Largest region', snap.regions.largest]]} />
      </section>
      <section>
        <h4>ALGORITHM: LIANG-BARSKY</h4>
        <R rows={[['Lines Tested', c.tested], ['Clipped', c.clipped], ['Rejected', c.rejected], ['Visible', c.visible]]} />
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Toggle “Clip window” under the canvas, then zoom to see segments cut at the window.</p>
      </section>
      <section>
        <h4>COLLISION ENGINE</h4>
        <R rows={[['Checks', co.checks], ['Collisions', co.collisions], ['Blocked', co.blocked]]} />
      </section>
      <section>
        <h4>LINE INTERSECTION (LINE OF SIGHT)</h4>
        {los ? <R rows={[['Segment A', `P${los.person} → EXIT ${los.exit + 1}`], ['A endpoints', `(${f1(los.a[0].x)},${f1(los.a[0].y)})→(${f1(los.a[1].x)},${f1(los.a[1].y)})`],
          ['Segment B', los.b ? `wall (${f1(los.b[0].x)},${f1(los.b[0].y)})→(${f1(los.b[1].x)},${f1(los.b[1].y)})` : 'none'], ['Intersection', los.hit ? 'YES — view blocked' : 'NO — clear line'], ['Coordinates', los.hit ? `(${f1(los.x)}, ${f1(los.y)})` : '—']]} /> : <p className="muted">Select a person.</p>}
      </section>
      <section>
        <h4>TRANSFORMATION INSPECTOR {t ? `· PERSON ${t.id}` : ''}</h4>
        {t && <>
          <R rows={[['Translation Tx', f1(t.tx)], ['Translation Ty', f1(t.ty)], ['Rotation θ', `${f1(radToDeg(t.theta))}°`], ['Scale X', t.sx.toFixed(2)], ['Scale Y', t.sy.toFixed(2)]]} />
          <Matrix rows={t.rows} />
          <p className="muted" style={{ fontSize: 12, margin: '6px 0' }}>M = T(x,y) · R(θ) · S(s)</p>
        </>}
        {snap.cam && <><p style={{ fontSize: 12, color: 'var(--cyan)', margin: '8px 0 2px' }}>CAMERA (world → screen) · zoom {snap.cam.zoom.toFixed(2)}×</p><Matrix rows={snap.cam.rows} /></>}
      </section>
    </aside>
  );
}

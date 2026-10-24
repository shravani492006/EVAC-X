import { STATUS_COLOR } from '../game/constants.js';

export default function StatusPanel({ snap, sim, onExitToggle }) {
  if (!snap) return null;
  const p = snap.people, saved = p.evacuated;
  return (
    <>
      <div className="panel">
        <h3>Status</h3>
        <div className="stat-big"><span className="k">PEOPLE SAVED</span><span className="v good">{saved}/{p.total}</span></div>
        <div className="bar"><i style={{ width: `${(saved / Math.max(1, p.total)) * 100}%` }} /></div>
        <div className="rows" style={{ marginTop: 10 }}>
          <span style={{ color: STATUS_COLOR.EVACUATING }}>Evacuating</span><span>{p.evacuating}</span>
          <span style={{ color: STATUS_COLOR.SAFE }}>Safe (reacting)</span><span>{p.safe}</span>
          <span style={{ color: STATUS_COLOR.AT_RISK }}>At risk</span><span>{p.atRisk}</span>
          <span style={{ color: STATUS_COLOR.TRAPPED }}>Trapped / lost</span><span>{p.trapped}</span>
        </div>
        <div className="stat-big" style={{ marginTop: 8 }}><span className="k">FIRE SOURCES</span><span className="v" style={{ color: 'var(--fire)' }}>{snap.fire.count}</span></div>
      </div>
      <div className="panel">
        <h3>Exits</h3>
        {snap.exits.map((e) => (
          <div className="exit-row" key={e.id}>
            <span>EXIT {e.id + 1} <span className="muted mono">· {e.used} used</span></span>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className={`pill ${e.burning ? 'burning' : e.isOpen ? 'open' : 'closed'}`}>{e.burning ? 'FIRE' : e.isOpen ? 'OPEN' : 'CLOSED'}</span>
              <button className="btn sm" disabled={snap.status === 'ENDED'} onClick={() => onExitToggle(e.id, !e.isOpen)}>{e.isOpen ? 'Close' : 'Open'}</button>
            </span>
          </div>
        ))}
      </div>
      <div className="panel">
        <h3>Event feed</h3>
        <div className="log">{snap.logs.length ? snap.logs.map((l, i) => <div key={`${l.t}-${i}`} className={l.kind}>{l.text}</div>) : <span className="muted">Press START to trigger the alarm.</span>}</div>
      </div>
    </>
  );
}

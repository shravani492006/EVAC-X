import { MousePointer2, Flame, Droplets, Construction, BrickWall, DoorOpen, DoorClosed, Hand, Play, Pause, RotateCcw, SkipForward } from 'lucide-react';
import { TOOLS } from '../game/constants.js';

const ICONS = { select: MousePointer2, fire: Flame, extinguish: Droplets, block: Construction, unblock: BrickWall, openExit: DoorOpen, closeExit: DoorClosed, pan: Hand };
const CLS = { fire: 'fire', block: 'amber', closeExit: 'fire' };

export function ToolPanel({ tool, setTool, snap }) {
  return (
    <div className="panel">
      <h3>Tools</h3>
      <div className="tool-grid">
        {TOOLS.map((t) => { const I = ICONS[t.id]; return (
          <button key={t.id} className={`btn ${tool === t.id ? `active ${CLS[t.id] || ''}` : ''}`} title={t.hint} onClick={() => setTool(t.id)}><I size={16} />{t.label}</button>
        ); })}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>{TOOLS.find((t) => t.id === tool)?.hint}</p>
      <div className="stat-big" style={{ marginTop: 8, borderTop: '1px solid var(--line)' }}>
        <span className="k">SUPPRESSION</span><span className="v" style={{ fontSize: 16 }}>{snap ? snap.suppression.toFixed(1) : '—'}/{snap ? snap.suppressionMax : '—'}</span>
      </div>
      <div className="bar"><i style={{ width: `${snap ? (snap.suppression / snap.suppressionMax) * 100 : 0}%` }} /></div>
    </div>
  );
}

export function ControlPanel({ status, onStart, onPause, onResume, onRestart, speed, setSpeed }) {
  return (
    <div className="panel">
      <h3>Simulation</h3>
      <div className="ctl-row">
        {status === 'READY' && <button className="btn primary" onClick={onStart}><Play size={14} />START</button>}
        {status === 'RUNNING' && <button className="btn" onClick={onPause}><Pause size={14} />PAUSE</button>}
        {status === 'PAUSED' && <button className="btn good" onClick={onResume}><SkipForward size={14} />RESUME</button>}
        {status === 'ENDED' && <button className="btn" disabled>ENDED</button>}
        <button className="btn" onClick={onRestart}><RotateCcw size={14} />RESTART</button>
      </div>
      <div className="ctl-row" style={{ marginTop: 8 }}>
        {[1, 2, 4].map((s) => <button key={s} className={`btn ${speed === s ? 'active' : ''}`} onClick={() => setSpeed(s)}>{s}×</button>)}
      </div>
    </div>
  );
}

import { Users, Flame, DoorOpen, Timer } from 'lucide-react';
import { useApp } from '../hooks/useApp.jsx';
import { LEVELS } from '../data/levels.js';
import { fmtTime } from '../utils/format.js';
import Nav from '../components/Nav.jsx';
import LevelThumb from '../components/LevelThumb.jsx';

export default function LevelSelect() {
  const { go, playerName, setPlayerName } = useApp();
  return (
    <div className="page-bg">
      <Nav />
      <main className="container">
        <h1 className="page-title">Select a mission</h1>
        <p className="page-sub">Each level has a different floor plan, fire pattern and exit layout. Complete a level by saving at least 60% of the people before the timer reaches zero.</p>
        <div className="controls" style={{ marginBottom: 22 }}>
          <label>Controller name
            <input className="text" value={playerName} maxLength={14} onChange={(e) => setPlayerName(e.target.value)} aria-label="Player name" />
          </label>
        </div>
        <div className="levels-grid">
          {LEVELS.map((l) => (
            <button key={l.id} className="level-card" onClick={() => go('game', { levelId: l.id })}>
              <LevelThumb level={l} />
              <div className="body">
                <span className={`diff ${l.difficulty}`}>{l.difficulty}</span>
                <h3>{l.name}</h3>
                <p className="muted" style={{ fontSize: 13 }}>{l.blurb}</p>
                <div className="kv-grid">
                  <span><Users size={12} /> People</span><span>{l.people}</span>
                  <span><Flame size={12} /> Fire</span><span>{l.fires}</span>
                  <span><DoorOpen size={12} /> Exits</span><span>{l.exits}</span>
                  <span><Timer size={12} /> Timer</span><span>{fmtTime(l.time)}</span>
                  <span>Obstacles</span><span>{l.obstacles}</span>
                  <span>Blocked corridors</span><span>{l.blockedCorridors || 'None'}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

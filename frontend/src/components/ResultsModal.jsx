import { RotateCcw, ArrowRight, BarChart3, Home } from 'lucide-react';
import { pct } from '../utils/format.js';

export default function ResultsModal({ result, saveInfo, hasNext, onReplay, onNext, onAnalysis, onMenu }) {
  const win = result.outcome === 'COMPLETE';
  return (
    <div className="modal-back" role="dialog" aria-modal="true" aria-label="Game results">
      <div className={`modal ${win ? 'win' : 'lose'}`}>
        <h2>{win ? 'MISSION COMPLETE' : 'MISSION FAILED'}</h2>
        <p className="muted" style={{ textAlign: 'center', fontSize: 13 }}>{result.levelName}</p>
        <div className="stars" aria-label={`${result.stars} of 5 stars`}>{[0, 1, 2, 3, 4].map((i) => <span key={i} className={i < result.stars ? '' : 'off'} style={{ animationDelay: `${0.25 + i * 0.12}s` }}>★</span>)}</div>
        <div className="score-big">{result.score.toLocaleString()}</div>
        <div className="rows">
          <span>People Saved</span><span>{result.peopleSaved} / {result.peopleTotal}</span>
          <span>Survival Rate</span><span>{pct(result.survivalRate)}</span>
          <span>Evacuation Time</span><span>{Math.round(result.evacuationTime)} sec</span>
          <span>Route Calculations</span><span>{result.routeCalculations}</span>
          <span>Collisions</span><span>{result.collisionCount}</span>
          <span>Fire Events</span><span>{result.fireEvents}</span>
          <span>Time Bonus</span><span>+{result.timeBonus}</span>
          <span>Overall Risk</span><span className={result.risk === 'HIGH' ? 'bad' : result.risk === 'MEDIUM' ? 'warn' : 'good'}>{result.risk}</span>
        </div>
        <p className="save-note">{saveInfo ? (saveInfo.mode === 'online' ? `Saved to the leaderboard${saveInfo.rank ? ` — rank #${saveInfo.rank}` : ''}.` : `DEMO MODE — saved in this browser${saveInfo.rank ? ` (rank #${saveInfo.rank})` : ''}.`) : 'Saving score…'}</p>
        <div className="modal-actions">
          <button className="btn" onClick={onReplay}><RotateCcw size={15} />REPLAY</button>
          <button className="btn primary" onClick={onNext} disabled={!hasNext || !win}><ArrowRight size={15} />NEXT LEVEL</button>
          <button className="btn cyan" onClick={onAnalysis}><BarChart3 size={15} />ALGORITHM ANALYSIS</button>
          <button className="btn" onClick={onMenu}><Home size={15} />MAIN MENU</button>
        </div>
      </div>
    </div>
  );
}

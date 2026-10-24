import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import Nav from '../components/Nav.jsx';
import { useApp } from '../hooks/useApp.jsx';
import { LEVELS } from '../data/levels.js';
import { fetchLeaderboard, fetchStats } from '../services/api.js';
import { pct } from '../utils/format.js';

export default function LeaderboardPage() {
  const { mode, playerName } = useApp();
  const [level, setLevel] = useState('all');
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (mode === 'checking') return;
    setRows(null);
    fetchLeaderboard(level, mode).then((r) => setRows(r.rows));
    fetchStats(mode).then(setStats);
  }, [level, mode]);

  return (
    <div className="page-bg">
      <Nav />
      <main className="container">
        <h1 className="page-title"><Trophy size={28} style={{ verticalAlign: -4, color: 'var(--amber)' }} /> Leaderboard</h1>
        <p className="page-sub">{mode === 'online' ? 'Scores are stored in MongoDB.' : 'DEMO MODE — showing sample entries plus scores saved in this browser.'}</p>
        {stats && <div className="stat-tiles">
          <div className="tile"><div className="k">GAMES PLAYED</div><div className="v">{stats.totalGames}</div></div>
          <div className="tile"><div className="k">PLAYERS</div><div className="v">{stats.totalPlayers}</div></div>
          <div className="tile"><div className="k">AVG SURVIVAL</div><div className="v">{pct(stats.avgSurvival || 0)}</div></div>
          <div className="tile"><div className="k">BEST SCORE</div><div className="v">{(stats.bestScore || 0).toLocaleString()}</div></div>
        </div>}
        <div className="tabs">
          {[['all', 'ALL LEVELS'], ...LEVELS.map((l) => [l.id, l.name])].map(([id, label]) => <button key={id} className={`tab ${level === id ? 'active' : ''}`} onClick={() => setLevel(id)}>{label}</button>)}
        </div>
        <div className="panel table-scroll">
          {!rows ? <div className="empty">Loading…</div> : rows.length === 0 ? <div className="empty">No scores yet — be the first to finish a mission.</div> : (
            <table className="tbl">
              <thead><tr><th>Rank</th><th>Player</th><th>Level</th><th className="num">Score</th><th className="num">Survival</th><th className="num">Time</th></tr></thead>
              <tbody>{rows.map((r, i) => (
                <tr key={r.id || i} style={r.player === playerName && !r.seed ? { background: 'rgba(34,211,238,0.06)' } : null}>
                  <td><span className={`rank r${i + 1}`}>{i + 1}</span></td><td>{r.player}</td><td className="muted">{r.levelName || r.level}</td>
                  <td className="num">{r.score.toLocaleString()}</td><td className="num">{pct(r.survivalRate)}</td><td className="num">{Math.round(r.time)}s</td>
                </tr>))}</tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

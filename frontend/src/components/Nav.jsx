import { Flame, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../hooks/useApp.jsx';

const LINKS = [['landing', 'Home'], ['levels', 'Play'], ['how', 'How it works'], ['lab', 'Algorithm lab'], ['analysis', 'What-if'], ['leaderboard', 'Leaderboard']];

export function ModeBadge() {
  const { mode, retryBackend } = useApp();
  if (mode === 'checking') return <span className="badge"><span className="dot" />CHECKING…</span>;
  if (mode === 'online') return <span className="badge online" title="Express + MongoDB connected"><span className="dot" />ONLINE</span>;
  return <button className="badge demo" onClick={retryBackend} title="MongoDB / backend unavailable — scores are stored in this browser. Click to retry."><span className="dot" />DEMO MODE</button>;
}

export default function Nav() {
  const { page, go, muted, toggleMute } = useApp();
  return (
    <nav className="nav">
      <button className="brand" onClick={() => go('landing')}><Flame size={22} />EVAC-X</button>
      <div className="nav-links">
        {LINKS.map(([id, label]) => <button key={id} className={`nav-link ${page === id ? 'active' : ''}`} onClick={() => go(id)}>{label}</button>)}
      </div>
      <ModeBadge />
      <button className="btn sm" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
    </nav>
  );
}

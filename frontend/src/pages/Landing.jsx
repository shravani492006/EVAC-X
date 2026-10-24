import { Play, BookOpen, Cpu, Trophy } from 'lucide-react';
import { useApp } from '../hooks/useApp.jsx';
import LiveBackdrop from '../components/LiveBackdrop.jsx';
import Nav from '../components/Nav.jsx';

export default function Landing() {
  const { go } = useApp();
  return (
    <div className="hero">
      <LiveBackdrop />
      <div style={{ position: 'relative', zIndex: 3 }}><Nav /></div>
      <div className="hero-inner">
        <h1>EVAC<span className="x">-X</span></h1>
        <p className="sub">2D DISASTER EVACUATION &amp; COMPUTER GRAPHICS SIMULATOR</p>
        <p className="lede">Take control of an emergency response. Fire and smoke spread through the building, routes close, and every person recalculates their escape with A* in real time. The map behind this text is a live simulation.</p>
        <div className="hero-actions">
          <button className="btn primary" onClick={() => go('levels')}><Play size={16} />PLAY GAME</button>
          <button className="btn" onClick={() => go('how')}><BookOpen size={16} />HOW IT WORKS</button>
          <button className="btn cyan" onClick={() => go('lab')}><Cpu size={16} />ALGORITHM LAB</button>
          <button className="btn" onClick={() => go('leaderboard')}><Trophy size={16} />LEADERBOARD</button>
        </div>
      </div>
      <div className="hero-foot"><span>A* PATHFINDING</span><span>FLOOD FILL / BFS</span><span>LIANG-BARSKY CLIPPING</span><span>LINE INTERSECTION</span><span>3×3 TRANSFORMS</span><span>COLLISION DETECTION</span></div>
    </div>
  );
}

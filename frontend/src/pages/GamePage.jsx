import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Activity, Eye } from 'lucide-react';
import { useApp } from '../hooks/useApp.jsx';
import { getLevel, LEVELS } from '../data/levels.js';
import { Simulation } from '../engine/Simulation.js';
import { sound } from '../engine/audio.js';
import { fmtTime } from '../utils/format.js';
import { startGame, submitScore, savePartial } from '../services/api.js';
import GameCanvas from '../components/GameCanvas.jsx';
import { ToolPanel, ControlPanel } from '../components/ToolPanel.jsx';
import StatusPanel from '../components/StatusPanel.jsx';
import Inspector from '../components/Inspector.jsx';
import ResultsModal from '../components/ResultsModal.jsx';
import { ModeBadge } from '../components/Nav.jsx';

export default function GamePage() {
  const { levelId, go, mode, playerName, setLastResult, setLevelId, muted, toggleMute } = useApp();
  const level = getLevel(levelId);
  const [runKey, setRunKey] = useState(0);
  const sim = useMemo(() => new Simulation(level), [level, runKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const [snap, setSnap] = useState(() => sim.snapshot());
  const [tool, setTool] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [speed, setSpeedState] = useState(1);
  const [view, setView] = useState({ showPaths: true, showClip: false, showHeat: true, showGrid: false });
  const [inspector, setInspector] = useState(false);
  const [result, setResult] = useState(null);
  const [saveInfo, setSaveInfo] = useState(null);
  const [toast, setToast] = useState(null);
  const rendererRef = useRef(null);
  const toastTimer = useRef(null);

  const refresh = useCallback(() => setSnap(sim.snapshot(selectedId)), [sim, selectedId]);

  useEffect(() => {
    setResult(null); setSaveInfo(null); setSpeedState(1); setSnap(sim.snapshot());
    sim.onEnd = (r) => {
      setLastResult(r);
      setTimeout(() => setResult(r), 900);
      submitScore(r, playerName, mode).then(setSaveInfo);
    };
    return () => { sim.onEnd = null; sound.stopAlarm(); };
  }, [sim]); // eslint-disable-line react-hooks/exhaustive-deps

  const message = useCallback((msg, ok) => {
    if (!msg) return; setToast({ msg, ok }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  const start = () => { sim.start(); if (mode === 'online') startGame(playerName, level.id); refresh(); };
  const pause = () => { sim.pause(); sound.stopAlarm(); refresh(); };
  const resume = () => { sim.resume(); refresh(); };
  const restart = () => { sound.stopAlarm(); setSelectedId(null); setRunKey((k) => k + 1); };
  const setSpeed = (s) => { sim.setSpeed(s); setSpeedState(s); };
  const exitToggle = (id, open) => { const r = sim.setExitOpen(id, open); message(r.msg, r.ok); refresh(); };
  const leave = (p) => {
    if (mode === 'online' && sim.status !== 'READY' && sim.status !== 'ENDED') savePartial({ playerName, levelId: level.id, score: Math.round(sim.score), peopleSaved: sim.evacuated, peopleLost: sim.deaths, completed: false });
    go(p);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); if (sim.status === 'READY') start(); else if (sim.status === 'RUNNING') pause(); else if (sim.status === 'PAUSED') resume(); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const idx = LEVELS.findIndex((l) => l.id === level.id), next = LEVELS[idx + 1];
  const ui = { tool, selectedId: snap?.selectedId ?? selectedId, ...view };
  const low = snap && snap.timeLeft <= 15 && snap.status === 'RUNNING';
  const statusLabel = { READY: 'STANDBY', RUNNING: 'ACTIVE', PAUSED: 'PAUSED', ENDED: 'ENDED' }[snap.status];

  return (
    <div className="game">
      <header className="topbar">
        <div className="left">
          <button className="btn sm" onClick={() => leave('levels')}><ArrowLeft size={14} />LEVELS</button>
          <b style={{ letterSpacing: '0.14em' }}>EVAC-X</b><ModeBadge />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="level-tag">LEVEL {String(level.index).padStart(2, '0')} · {level.name}</div>
          <div className={`timer ${low ? 'low' : ''}`}>{fmtTime(snap.timeLeft)}</div>
        </div>
        <div className="right">
          <button className={`btn sm ${inspector ? 'active' : ''}`} onClick={() => setInspector((v) => !v)}><Activity size={14} />INSPECTOR</button>
          <button className="btn sm" onClick={toggleMute}>{muted ? 'UNMUTE' : 'MUTE'}</button>
        </div>
      </header>

      <div className="game-main">
        <div className="side">
          <ToolPanel tool={tool} setTool={(t) => { sound.play('click'); setTool(t); }} snap={snap} />
          <ControlPanel status={snap.status} onStart={start} onPause={pause} onResume={resume} onRestart={restart} speed={speed} setSpeed={setSpeed} />
          <div className="panel">
            <h3><Eye size={12} style={{ verticalAlign: -1 }} /> View</h3>
            {[['showPaths', 'A* paths (all)'], ['showHeat', 'Danger halo'], ['showGrid', 'Grid'], ['showClip', 'Clip window']].map(([k, label]) => (
              <label key={k} className="controls" style={{ margin: '4px 0', gap: 8, fontSize: 13, color: 'var(--muted)' }}>
                <input type="checkbox" checked={view[k]} onChange={(e) => setView((v) => ({ ...v, [k]: e.target.checked }))} />{label}
              </label>
            ))}
          </div>
        </div>

        <GameCanvas key={`${level.id}-${runKey}`} sim={sim} uiState={ui} rendererRef={rendererRef} onSelect={(id) => { setSelectedId(id); }} onMessage={message} onFrame={setSnap}>
          {snap.banner && <div className="canvas-overlay banner" key={snap.banner.born}><b>{snap.banner.text}</b><span>{snap.banner.sub}</span></div>}
          {toast && <div className="canvas-overlay" style={{ left: 12, top: 12, padding: '4px 10px', borderRadius: 8, background: 'rgba(8,16,34,0.9)', border: '1px solid var(--line-strong)', fontSize: 12 }}>{toast.msg}</div>}
          {snap.status === 'READY' && (
            <div className="canvas-overlay start-overlay">
              <h2>{level.name}</h2><p>{level.blurb} Place fire, debris or close exits first, then start the alarm. Press Space to start or pause.</p>
              <button className="btn primary" onClick={start} style={{ padding: '14px 32px' }}>START EVACUATION</button>
            </div>
          )}
          {snap.status === 'PAUSED' && <div className="canvas-overlay pause-overlay">PAUSED</div>}
        </GameCanvas>

        <div className="side"><StatusPanel snap={snap} sim={sim} onExitToggle={exitToggle} /></div>
      </div>

      <footer className="bottombar">
        <div className="chip"><span className="k">A* PATH</span><span className="v">{snap.astar ? `${snap.astar.pathLength} cells · ${snap.astar.expanded} exp` : '—'}</span></div>
        <div className="chip"><span className="k">FIRE</span><span className="v">{snap.fire.cells} cells · r{snap.fire.radius}</span></div>
        <div className="chip"><span className="k">SMOKE</span><span className="v">r{snap.smoke.radius} · {snap.smoke.cells} cells</span></div>
        <div className="chip"><span className="k">COLLISION</span><span className="v">{snap.collisions} stops · {snap.routeCalculations} routes</span></div>
        <div className="chip score"><span className="k">SCORE</span><span className="v">{snap.score.toLocaleString()}</span></div>
        <div className="chip"><span className="k">STATUS</span><span className="v">{statusLabel} · {speed}×</span></div>
      </footer>

      {inspector && <Inspector snap={snap} onClose={() => setInspector(false)} />}
      {result && <ResultsModal result={result} saveInfo={saveInfo} hasNext={!!next}
        onReplay={() => { setResult(null); restart(); }} onNext={() => { setResult(null); setLevelId(next.id); setRunKey((k) => k + 1); }}
        onAnalysis={() => go('analysis')} onMenu={() => go('levels')} />}
    </div>
  );
}

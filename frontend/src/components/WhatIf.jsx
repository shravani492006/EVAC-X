import { useMemo, useState } from 'react';
import { LEVELS, getLevel } from '../data/levels.js';
import { runHeadless } from '../engine/headless.js';
import { pct } from '../utils/format.js';

const METRICS = [
  ['People saved', (r) => `${r.peopleSaved}/${r.peopleTotal}`, (r) => r.peopleSaved, true],
  ['Evacuation time', (r) => `${Math.round(r.evacuationTime)}s`, (r) => r.evacuationTime, false],
  ['Routes calculated', (r) => r.routeCalculations, (r) => r.routeCalculations, false],
  ['Risk level', (r) => r.risk, (r) => ({ LOW: 1, MEDIUM: 2, HIGH: 3 })[r.risk], false],
  ['Fire area (cells)', (r) => r.fireArea, (r) => r.fireArea, false],
  ['Score', (r) => r.score.toLocaleString(), (r) => r.score, true]
];

export default function WhatIf({ defaultLevelId = 'training' }) {
  const [levelId, setLevelId] = useState(defaultLevelId);
  const level = getLevel(levelId);
  const scenarios = useMemo(() => [
    ...(level.exits ? Array.from({ length: level.exits }, (_, i) => ({ id: `exit${i}`, label: `Exit ${i + 1} blocked`, mods: { closeExit: i } })) : []),
    { id: 'fires', label: '+2 extra fires', mods: { extraFires: 2 } },
    { id: 'blocks', label: '10 corridor cells blocked', mods: { blockCorridors: 10 } },
    { id: 'alarm', label: 'Alarm delayed 6 s', mods: { alarmDelay: 6 } }
  ], [level]);
  const [scId, setScId] = useState(() => (level.exits ? 'exit0' : 'fires'));
  const sc = scenarios.find((s) => s.id === scId) || scenarios[0];
  const [state, setState] = useState({ running: false, progress: 0, base: null, alt: null, error: null });

  const run = async () => {
    setState({ running: true, progress: 0, base: null, alt: null, error: null });
    try {
      const base = await runHeadless(level, {}, (p) => setState((s) => ({ ...s, progress: p * 0.5 })));
      const alt = await runHeadless(level, sc.mods, (p) => setState((s) => ({ ...s, progress: 0.5 + p * 0.5 })));
      setState({ running: false, progress: 1, base, alt, error: null });
    } catch (e) { setState({ running: false, progress: 0, base: null, alt: null, error: e.message }); }
  };
  const { base, alt } = state;
  return (
    <div className="panel">
      <h3>What-if analysis</h3>
      <p className="muted" style={{ fontSize: 14, marginBottom: 12 }}>Runs the selected level twice, headless and with the same random seed — once as-is, once with a change — and compares the outcomes. With no player input, results show how the building behaves on its own.</p>
      <div className="controls">
        <label>Level <select value={levelId} onChange={(e) => { const nextLvl = getLevel(e.target.value); setLevelId(e.target.value); setScId(nextLvl.exits ? 'exit0' : 'fires'); setState({ running: false, progress: 0, base: null, alt: null }); }}>{LEVELS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>Scenario <select value={sc ? sc.id : 'fires'} onChange={(e) => setScId(e.target.value)}>{scenarios.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <button className="btn primary" disabled={state.running} onClick={run}>{state.running ? `RUNNING ${Math.round(state.progress * 100)}%` : 'RUN COMPARISON'}</button>
      </div>
      {state.error && <p className="bad">Simulation error: {state.error}</p>}
      {base && alt && (
        <div style={{ marginTop: 18 }}>
          <div className="table-scroll"><table className="tbl">
            <thead><tr><th>Metric</th><th className="num">Normal</th><th className="num">{sc.label}</th></tr></thead>
            <tbody>{METRICS.map(([label, fmt]) => <tr key={label}><td>{label}</td><td className="num">{fmt(base)}</td><td className="num">{fmt(alt)}</td></tr>)}
              <tr><td>Survival rate</td><td className="num">{pct(base.survivalRate)}</td><td className="num">{pct(alt.survivalRate)}</td></tr></tbody>
          </table></div>
          <h3 style={{ marginTop: 18 }}>Visual comparison</h3>
          {METRICS.map(([label, , val]) => {
            const a = val(base), b = val(alt), m = Math.max(a, b, 1);
            return (
              <div className="chart-row" key={label}><span>{label}</span>
                <div className="chart-bars">
                  <div className="cbar" style={{ width: `${(a / m) * 100}%`, background: 'var(--cyan)' }}><span>{a}</span></div>
                  <div className="cbar" style={{ width: `${(b / m) * 100}%`, background: 'var(--fire)' }}><span>{b}</span></div>
                </div></div>
            );
          })}
          <div className="legend"><span><i style={{ background: 'var(--cyan)' }} />Normal</span><span><i style={{ background: 'var(--fire)' }} />{sc.label}</span></div>
        </div>
      )}
    </div>
  );
}

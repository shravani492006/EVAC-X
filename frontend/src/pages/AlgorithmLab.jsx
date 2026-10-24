import { useState } from 'react';
import Nav from '../components/Nav.jsx';
import { AStarLab, FloodLab } from '../components/lab/GridLabs.jsx';
import { LiangBarskyLab, LineIntersectLab, CollisionLab } from '../components/lab/GeometryLabs.jsx';
import TransformLab from '../components/lab/TransformLab.jsx';

const TABS = [['astar', 'A*'], ['flood', 'FLOOD FILL'], ['bfs', 'BFS'], ['liang', 'LIANG-BARSKY'], ['intersect', 'LINE INTERSECTION'], ['transform', 'TRANSFORMATIONS'], ['collision', 'COLLISION DETECTION']];

export default function AlgorithmLab() {
  const [tab, setTab] = useState('astar');
  return (
    <div className="page-bg">
      <Nav />
      <main className="container">
        <h1 className="page-title">Algorithm lab</h1>
        <p className="page-sub">Every demo below runs the same modules that power the game (src/algorithms). Edit the inputs, step through the algorithm and read the live statistics.</p>
        <div className="tabs" role="tablist">{TABS.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>)}</div>
        {tab === 'astar' && <AStarLab />}
        {tab === 'flood' && <FloodLab mode="flood" />}
        {tab === 'bfs' && <FloodLab mode="bfs" />}
        {tab === 'liang' && <LiangBarskyLab />}
        {tab === 'intersect' && <LineIntersectLab />}
        {tab === 'transform' && <TransformLab />}
        {tab === 'collision' && <CollisionLab />}
      </main>
    </div>
  );
}

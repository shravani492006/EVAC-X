import axios from 'axios';

/**
 * API layer. The simulation itself never talks to the backend (only persistent data does).
 * If the backend or MongoDB is unavailable every call falls back to localStorage → DEMO MODE.
 */
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 4000 });
const LS_KEY = 'evacx_scores_v1';
const LS_PLAYER = 'evacx_player';

const SEED_SCORES = [
  { player: 'SHARVANI', level: 'campus', levelName: 'UNIVERSITY CAMPUS', score: 9850, survivalRate: 0.98, time: 59 },
  { player: 'TANVI', level: 'mall', levelName: 'SHOPPING MALL', score: 9210, survivalRate: 0.94, time: 63 },
  { player: 'SRUSHTI', level: 'office', levelName: 'OFFICE BUILDING', score: 8840, survivalRate: 0.92, time: 68 },
  { player: 'AARAV', level: 'training', levelName: 'TRAINING FACILITY', score: 3120, survivalRate: 1, time: 24 },
  { player: 'MEERA', level: 'campus', levelName: 'UNIVERSITY CAMPUS', score: 7430, survivalRate: 0.88, time: 77 }
].map((s, i) => ({ ...s, id: `seed-${i}`, seed: true }));

export function getPlayerName() { try { return localStorage.getItem(LS_PLAYER) || 'PLAYER'; } catch { return 'PLAYER'; } }
export function setPlayerName(n) { try { localStorage.setItem(LS_PLAYER, n); } catch { /* ignore */ } }

const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch { return []; } };
const writeLocal = (rows) => { try { localStorage.setItem(LS_KEY, JSON.stringify(rows.slice(0, 200))); } catch { /* storage full / disabled */ } };

/** Returns 'online' when Express + MongoDB are reachable, otherwise 'demo'. */
export async function checkBackend() {
  try {
    const { data } = await api.get('/health');
    return data && data.database === 'connected' ? 'online' : 'demo';
  } catch { return 'demo'; }
}

export async function startGame(playerName, levelId) {
  try { const { data } = await api.post('/games/start', { playerName, levelId }); return data; } catch { return null; }
}

export async function savePartial(payload) {
  try { await api.post('/games/save', payload); return true; } catch { return false; }
}

/** Save a finished game. Returns { mode: 'online' | 'local', rank? }. */
export async function submitScore(result, playerName, mode) {
  let effectiveMode = mode;
  if (effectiveMode === 'checking') {
    effectiveMode = await checkBackend();
  }
  const body = {
    playerName, levelId: result.levelId, score: result.score, peopleSaved: result.peopleSaved, peopleLost: result.peopleLost,
    survivalRate: result.survivalRate, evacuationTime: result.evacuationTime, routeCalculations: result.routeCalculations,
    collisionCount: result.collisionCount, fireEvents: result.fireEvents
  };
  if (effectiveMode === 'online') {
    try { const { data } = await api.post('/scores', body); return { mode: 'online', rank: data.rank }; } catch { /* fall through to local */ }
  } else {
    try { const { data } = await api.post('/scores', body); return { mode: 'online', rank: data.rank }; } catch { /* fall through to local */ }
  }
  const rows = readLocal();
  rows.push({ id: `local-${Date.now()}`, player: playerName, level: result.levelId, levelName: result.levelName, score: result.score, survivalRate: result.survivalRate, time: Math.round(result.evacuationTime), at: Date.now() });
  rows.sort((a, b) => b.score - a.score); writeLocal(rows);
  const rank = [...SEED_SCORES, ...rows].sort((a, b) => b.score - a.score).findIndex((r) => r.score === result.score) + 1;
  return { mode: 'local', rank };
}

export async function fetchLeaderboard(level, mode) {
  const effectiveMode = mode === 'checking' ? await checkBackend() : mode;
  if (effectiveMode === 'online') {
    try {
      const { data } = await api.get('/leaderboard', { params: { level: level && level !== 'all' ? level : undefined, limit: 50 } });
      return { mode: 'online', rows: data.entries };
    } catch { /* fall back */ }
  }
  let rows = [...SEED_SCORES, ...readLocal()].sort((a, b) => b.score - a.score);
  if (level && level !== 'all') rows = rows.filter((r) => r.level === level);
  return { mode: 'local', rows: rows.slice(0, 50) };
}

export async function fetchStats(mode) {
  const effectiveMode = mode === 'checking' ? await checkBackend() : mode;
  if (effectiveMode === 'online') { try { const { data } = await api.get('/stats'); return data; } catch { /* fall back */ } }
  const rows = [...SEED_SCORES, ...readLocal()];
  return {
    totalGames: rows.length, totalPlayers: new Set(rows.map((r) => r.player)).size,
    avgSurvival: rows.reduce((s, r) => s + r.survivalRate, 0) / Math.max(1, rows.length), bestScore: rows.reduce((m, r) => Math.max(m, r.score), 0)
  };
}

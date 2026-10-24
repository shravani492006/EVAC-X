import GameResult from '../models/GameResult.js';
import Leaderboard from '../models/Leaderboard.js';
import { findOrCreatePlayer, resolveScenario } from './gameController.js';
import { httpError } from '../middleware/errorHandler.js';

const num = (v, name, { min = 0, max = Infinity } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw httpError(400, `${name} must be a number between ${min} and ${max}`);
  return n;
};

/** POST /api/scores — saves the GameResult and updates the player's best leaderboard entry. */
export async function submitScore(req, res) {
  const b = req.body || {};
  const player = await findOrCreatePlayer(b.playerName, b.email);
  const scenario = await resolveScenario(b.levelId || b.scenarioId);
  const score = num(b.score, 'score', { min: 0, max: 1e7 });
  const survivalRate = num(b.survivalRate, 'survivalRate', { min: 0, max: 1 });
  const time = num(b.evacuationTime ?? 0, 'evacuationTime', { max: 36000 });
  const result = await GameResult.create({
    playerId: player._id, scenarioId: scenario._id, score, survivalRate, evacuationTime: time,
    peopleSaved: num(b.peopleSaved ?? 0, 'peopleSaved'), peopleLost: num(b.peopleLost ?? 0, 'peopleLost'),
    routeCalculations: num(b.routeCalculations ?? 0, 'routeCalculations'), collisionCount: num(b.collisionCount ?? 0, 'collisionCount'), fireEvents: num(b.fireEvents ?? 0, 'fireEvents')
  });
  const existing = await Leaderboard.findOne({ playerId: player._id, scenarioId: scenario._id });
  if (!existing) await Leaderboard.create({ playerId: player._id, scenarioId: scenario._id, score, survivalRate, time });
  else if (score > existing.score) { existing.score = score; existing.survivalRate = survivalRate; existing.time = time; await existing.save(); }
  const best = existing ? Math.max(existing.score, score) : score;
  const rank = (await Leaderboard.countDocuments({ scenarioId: scenario._id, score: { $gt: best } })) + 1;
  res.status(201).json({ result, rank, best });
}

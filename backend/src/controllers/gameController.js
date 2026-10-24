import Player from '../models/Player.js';
import Scenario from '../models/Scenario.js';
import GameResult from '../models/GameResult.js';
import { httpError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

export async function findOrCreatePlayer(name, email) {
  const clean = String(name || '').trim().slice(0, 20);
  if (!clean) throw httpError(400, 'playerName is required');
  let player = await Player.findOne({ name: clean });
  if (!player) player = await Player.create({ name: clean, email });
  return player;
}
export async function resolveScenario(levelId) {
  const scenario = mongoose.isValidObjectId(levelId) ? await Scenario.findById(levelId) : await Scenario.findOne({ slug: levelId });
  if (!scenario) throw httpError(400, 'Invalid scenario');
  return scenario;
}

/** POST /api/games/start — registers the player and returns ids to attach to the result later. */
export async function startGame(req, res) {
  const { playerName, email, levelId } = req.body || {};
  const [player, scenario] = await Promise.all([findOrCreatePlayer(playerName, email), resolveScenario(levelId)]);
  res.status(201).json({ playerId: player._id, scenarioId: scenario._id, scenario, startedAt: new Date().toISOString() });
}

/** POST /api/games/save — stores a (possibly partial) run without touching the leaderboard. */
export async function saveGame(req, res) {
  const b = req.body || {};
  const player = b.playerId && mongoose.isValidObjectId(b.playerId) ? await Player.findById(b.playerId) : await findOrCreatePlayer(b.playerName, b.email);
  if (!player) throw httpError(404, 'Player not found');
  const scenario = await resolveScenario(b.scenarioId || b.levelId);
  const saved = b.peopleSaved ?? 0, lost = b.peopleLost ?? 0;
  const total = saved + lost || scenario.peopleCount;
  const result = await GameResult.create({
    playerId: player._id, scenarioId: scenario._id, score: b.score ?? 0, peopleSaved: saved, peopleLost: lost,
    survivalRate: b.survivalRate ?? saved / total, evacuationTime: b.evacuationTime ?? 0, routeCalculations: b.routeCalculations ?? 0,
    collisionCount: b.collisionCount ?? 0, fireEvents: b.fireEvents ?? 0, completed: b.completed !== false
  });
  res.status(201).json(result);
}

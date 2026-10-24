import Leaderboard from '../models/Leaderboard.js';
import GameResult from '../models/GameResult.js';
import Player from '../models/Player.js';
import Scenario from '../models/Scenario.js';

/** GET /api/leaderboard?level=slug&limit=50 */
export async function getLeaderboard(req, res) {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const filter = {};
  if (req.query.level) {
    const s = await Scenario.findOne({ slug: req.query.level }).select('_id');
    if (!s) return res.json({ entries: [] });
    filter.scenarioId = s._id;
  }
  const rows = await Leaderboard.find(filter).sort({ score: -1, time: 1 }).limit(limit).populate('playerId', 'name').populate('scenarioId', 'slug name').lean();
  res.json({
    entries: rows.map((r, i) => ({ id: r._id, rank: i + 1, player: r.playerId?.name || 'UNKNOWN', level: r.scenarioId?.slug, levelName: r.scenarioId?.name, score: r.score, survivalRate: r.survivalRate, time: r.time }))
  });
}

/** GET /api/stats */
export async function getStats(req, res) {
  const [totalPlayers, totalGames, agg, perLevel] = await Promise.all([
    Player.countDocuments(), GameResult.countDocuments(),
    GameResult.aggregate([{ $group: { _id: null, avgSurvival: { $avg: '$survivalRate' }, bestScore: { $max: '$score' }, avgTime: { $avg: '$evacuationTime' } } }]),
    GameResult.aggregate([{ $group: { _id: '$scenarioId', games: { $sum: 1 }, avgScore: { $avg: '$score' }, avgSurvival: { $avg: '$survivalRate' } } },
      { $lookup: { from: 'scenarios', localField: '_id', foreignField: '_id', as: 's' } }, { $unwind: '$s' }, { $project: { _id: 0, level: '$s.slug', name: '$s.name', games: 1, avgScore: { $round: ['$avgScore', 0] }, avgSurvival: 1 } }])
  ]);
  const a = agg[0] || {};
  res.json({ totalPlayers, totalGames, avgSurvival: a.avgSurvival || 0, bestScore: a.bestScore || 0, avgTime: a.avgTime || 0, perLevel });
}

import mongoose from 'mongoose';

// Best score per (player, scenario)
const leaderboardSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  scenarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scenario', required: true },
  score: { type: Number, required: true, index: -1 },
  survivalRate: { type: Number, required: true },
  time: { type: Number, required: true }
}, { timestamps: true });
leaderboardSchema.index({ playerId: 1, scenarioId: 1 }, { unique: true });
export default mongoose.models.Leaderboard || mongoose.model('Leaderboard', leaderboardSchema);

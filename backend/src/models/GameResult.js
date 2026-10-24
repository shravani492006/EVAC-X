import mongoose from 'mongoose';

const gameResultSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true, index: true },
  scenarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scenario', required: true, index: true },
  score: { type: Number, required: true },
  peopleSaved: { type: Number, required: true, min: 0 },
  peopleLost: { type: Number, default: 0, min: 0 },
  survivalRate: { type: Number, required: true, min: 0, max: 1 },
  evacuationTime: { type: Number, default: 0, min: 0 },
  routeCalculations: { type: Number, default: 0, min: 0 },
  collisionCount: { type: Number, default: 0, min: 0 },
  fireEvents: { type: Number, default: 0, min: 0 },
  completed: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});
export default mongoose.models.GameResult || mongoose.model('GameResult', gameResultSchema);

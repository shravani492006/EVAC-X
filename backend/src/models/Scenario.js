import mongoose from 'mongoose';

const scenarioSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  difficulty: { type: String, enum: ['EASY', 'MEDIUM', 'HARD', 'EXTREME'], required: true },
  peopleCount: { type: Number, required: true, min: 1, max: 500 },
  fireCount: { type: Number, required: true, min: 0, max: 50 },
  exitCount: { type: Number, required: true, min: 1, max: 20 },
  timeLimit: { type: Number, required: true, min: 10, max: 3600 },
  mapData: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });
export default mongoose.models.Scenario || mongoose.model('Scenario', scenarioSchema);

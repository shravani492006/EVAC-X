import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import routes from './routes/index.js';
import Scenario from './models/Scenario.js';
import { BUILTIN_SCENARIOS } from './seed/scenarios.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();
const corsOrigin = !process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*'
  ? true
  : process.env.CORS_ORIGIN.split(',').map(s => s.trim());
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

async function seedScenarios() {
  for (const s of BUILTIN_SCENARIOS) await Scenario.updateOne({ slug: s.slug }, { $setOnInsert: s }, { upsert: true });
  console.log(`[seed] ${BUILTIN_SCENARIOS.length} built-in scenarios ready`);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`[api] EVAC-X API listening on http://localhost:${PORT}`);
  connectDB(process.env.MONGODB_URI, seedScenarios);
});

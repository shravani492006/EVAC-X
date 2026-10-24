import Scenario from '../models/Scenario.js';
import { httpError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

export async function createScenario(req, res) {
  const { name, difficulty, peopleCount, fireCount, exitCount, timeLimit, mapData } = req.body || {};
  if (!name) throw httpError(400, 'name is required');
  const slug = (req.body.slug || name).toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (await Scenario.exists({ slug })) throw httpError(409, `Scenario "${slug}" already exists`);
  const scenario = await Scenario.create({ slug, name, difficulty, peopleCount, fireCount, exitCount, timeLimit, mapData });
  res.status(201).json(scenario);
}
export async function listScenarios(req, res) {
  res.json(await Scenario.find().sort({ peopleCount: 1 }).lean());
}
export async function getScenario(req, res) {
  const { id } = req.params;
  const scenario = mongoose.isValidObjectId(id) ? await Scenario.findById(id).lean() : await Scenario.findOne({ slug: id }).lean();
  if (!scenario) throw httpError(404, 'Scenario not found');
  res.json(scenario);
}

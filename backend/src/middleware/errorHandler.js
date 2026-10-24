import { dbState } from '../config/db.js';

export const notFound = (req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });

/** Routes that need MongoDB respond 503 (frontend then switches to DEMO MODE). */
export const requireDb = (req, res, next) => {
  if (!dbState.connected) return res.status(503).json({ error: 'Database unavailable', demo: true });
  next();
};

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError') return res.status(400).json({ error: 'Invalid data', details: Object.values(err.errors).map((e) => e.message) });
  if (err.name === 'CastError') return res.status(400).json({ error: `Invalid ${err.path}` });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
};

export const httpError = (status, message) => Object.assign(new Error(message), { status });

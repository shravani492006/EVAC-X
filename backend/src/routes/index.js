import { Router } from 'express';
import { dbState } from '../config/db.js';
import { asyncHandler, requireDb } from '../middleware/errorHandler.js';
import { createScenario, listScenarios, getScenario } from '../controllers/scenarioController.js';
import { startGame, saveGame } from '../controllers/gameController.js';
import { submitScore } from '../controllers/scoreController.js';
import { getLeaderboard, getStats } from '../controllers/leaderboardController.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok', database: dbState.connected ? 'connected' : 'disconnected', error: dbState.error }));

router.post('/scenarios', requireDb, asyncHandler(createScenario));
router.get('/scenarios', requireDb, asyncHandler(listScenarios));
router.get('/scenarios/:id', requireDb, asyncHandler(getScenario));

router.post('/games/start', requireDb, asyncHandler(startGame));
router.post('/games/save', requireDb, asyncHandler(saveGame));

router.post('/scores', requireDb, asyncHandler(submitScore));
router.get('/leaderboard', requireDb, asyncHandler(getLeaderboard));
router.get('/stats', requireDb, asyncHandler(getStats));

export default router;

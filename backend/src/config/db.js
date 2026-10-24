import mongoose from 'mongoose';

export const dbState = { connected: false, error: null };
mongoose.set('bufferCommands', false);   // fail fast instead of hanging when MongoDB is down

mongoose.connection.on('connected', () => { dbState.connected = true; dbState.error = null; });
mongoose.connection.on('disconnected', () => { dbState.connected = false; });

/** Connects once; on failure keeps the API alive and retries in the background. */
export async function connectDB(uri, onConnected) {
  if (!uri) { dbState.error = 'MONGODB_URI not set'; console.warn('[db] MONGODB_URI not set — running without database (DEMO MODE on the frontend).'); return; }
  const attempt = async () => {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
      console.log('[db] MongoDB connected');
      if (onConnected) await onConnected();
    } catch (err) {
      dbState.connected = false; dbState.error = err.message;
      console.warn(`[db] MongoDB unavailable (${err.message.split('\n')[0]}). Retrying in 15 s…`);
      setTimeout(attempt, 15000);
    }
  };
  await attempt();
}

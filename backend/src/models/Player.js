import mongoose from 'mongoose';

const playerSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 20, index: true },
  email: { type: String, trim: true, lowercase: true, maxlength: 120 },
  createdAt: { type: Date, default: Date.now }
});
export default mongoose.models.Player || mongoose.model('Player', playerSchema);

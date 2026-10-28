import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { processChatQuery } from '../services/aiService.js';
import { col } from '../db/mongo.js';
import crypto from 'node:crypto';

const router = express.Router();
router.use(authenticateToken);

/**
 * POST /api/ai/chat
 * Handles natural language chatbot interactions in English & Tamil
 */
router.post('/chat', async (req, res) => {
  try {
    const { query, language = 'en' } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query is required.' });
    }

    const response = await processChatQuery({
      query,
      user: req.user,
      language
    });

    // Log chat interaction to MongoDB
    const id = crypto.randomUUID();
    await col('chat_logs').insertOne({
      _id: id,
      id,
      user_id: req.user.id,
      role: req.user.role,
      query,
      response: response.text,
      language,
      timestamp: new Date().toISOString()
    });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

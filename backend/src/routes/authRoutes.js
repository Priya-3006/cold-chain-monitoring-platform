import express from 'express';
import bcrypt from 'bcryptjs';
import { col } from '../db/mongo.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';
import { logAuditEvent } from '../services/auditHashChain.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticates user by Employee ID or Email
 */
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Employee ID/Email and password are required.' });
    }

    const trimmed = identifier.trim();
    const user = await col('users').findOne({
      $or: [{ email: trimmed }, { employee_id: trimmed }],
      is_active: 1
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or account is inactive.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    const userId = user.id || user._id;
    const token = generateToken(user);

    await logAuditEvent({
      userId,
      userRole: user.role,
      action: 'USER_LOGIN',
      entityType: 'USER',
      entityId: userId,
      details: { email: user.email, role: user.role }
    });

    const { password_hash, ...safeUser } = user;
    res.json({
      message: 'Login successful',
      token,
      user: { ...safeUser, id: userId }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await col('users').findOne({
      $or: [{ _id: req.user.id }, { id: req.user.id }]
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });

    const { password_hash, ...safeUser } = user;
    res.json({ user: { ...safeUser, id: user.id || user._id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/auth/demo-users
 * Returns list of quick-login demo accounts for review/testing
 */
router.get('/demo-users', async (req, res) => {
  try {
    const users = await col('users')
      .find({ is_active: 1 })
      .sort({ role: 1 })
      .toArray();

    const safeUsers = users.map(u => {
      const { password_hash, ...safe } = u;
      return { ...safe, id: u.id || u._id };
    });

    res.json({ users: safeUsers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

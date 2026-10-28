import jwt from 'jsonwebtoken';
import { col } from '../db/mongo.js';

const JWT_SECRET = process.env.JWT_SECRET || 'coldchain-jwt-secure-secret-key-2026';

/**
 * Generates signed JWT for authenticated user
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id,
      employee_id: user.employee_id,
      name: user.name,
      email: user.email,
      role: user.role,
      warehouse_id: user.warehouse_id
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Authentication middleware to verify bearer token
 */
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please provide a valid Bearer token.'
    });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({
        error: 'Invalid or expired authentication token.'
      });
    }

    try {
      // Verify user is still active in MongoDB
      const user = await col('users').findOne({
        $or: [{ _id: decoded.id }, { id: decoded.id }],
        is_active: 1
      });

      if (!user) {
        return res.status(403).json({
          error: 'User account is inactive or not found.'
        });
      }

      req.user = {
        id: user.id || user._id,
        employee_id: user.employee_id,
        name: user.name,
        email: user.email,
        role: user.role,
        warehouse_id: user.warehouse_id
      };

      next();
    } catch (dbErr) {
      return res.status(500).json({ error: 'Database authentication verification failed: ' + dbErr.message });
    }
  });
}

/**
 * Role-Based Access Control (RBAC) middleware
 * Enforces permissions on EVERY protected route
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated user.' });
    }

    // Admin always has access to all operational routes
    if (req.user.role === 'Admin') {
      return next();
    }

    if (allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: `Access Denied. Role '${req.user.role}' lacks permission for this action. Required role(s): [${allowedRoles.join(', ')}]`,
      currentRole: req.user.role,
      requiredRoles: allowedRoles
    });
  };
}

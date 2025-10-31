// middleware/auth.js
// JWT-based authentication middleware for bot management

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Generate a secure secret if not provided
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// User roles
export const ROLES = {
  ADMIN: 'admin',
  LLM: 'llm',
  VIEWER: 'viewer'
};

// Default users (in production, use a database)
const USERS = {
  admin: {
    id: 'admin',
    username: 'admin',
    password: '$2b$10$XQmVZKZRqF0qXHqXqVHqVeH', // Change in production!
    role: ROLES.ADMIN,
    apiKey: process.env.ADMIN_API_KEY || 'admin-key-change-me'
  },
  llm: {
    id: 'llm',
    username: 'llm',
    password: null, // LLM uses API key only
    role: ROLES.LLM,
    apiKey: process.env.LLM_API_KEY || 'llm-key-change-me'
  }
};

// Role permissions
const PERMISSIONS = {
  [ROLES.ADMIN]: ['read', 'write', 'delete', 'spawn', 'command'],
  [ROLES.LLM]: ['read', 'write', 'spawn', 'command'],
  [ROLES.VIEWER]: ['read']
};

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
export function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify a JWT token
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token or null if invalid
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Verify API key
 * @param {string} apiKey - API key
 * @returns {Object|null} User object or null if invalid
 */
export function verifyApiKey(apiKey) {
  const user = Object.values(USERS).find(u => u.apiKey === apiKey);
  return user || null;
}

/**
 * Check if user has permission
 * @param {string} role - User role
 * @param {string} permission - Required permission
 * @returns {boolean} True if user has permission
 */
export function hasPermission(role, permission) {
  const rolePermissions = PERMISSIONS[role] || [];
  return rolePermissions.includes(permission);
}

/**
 * Express middleware for JWT authentication
 */
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No authorization header'
    });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authorization header format. Use: Bearer <token>'
    });
  }

  const token = parts[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }

  req.user = decoded;
  next();
}

/**
 * Express middleware for API key authentication
 */
export function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No API key provided'
    });
  }

  const user = verifyApiKey(apiKey);

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  req.user = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  next();
}

/**
 * Combined authentication middleware (JWT or API key)
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  if (authHeader) {
    return authenticateJWT(req, res, next);
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'No authentication provided'
  });
}

/**
 * Authorization middleware to check permissions
 * @param {string[]} requiredPermissions - Required permissions
 */
export function authorize(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User not authenticated'
      });
    }

    const userRole = req.user.role;
    const hasAllPermissions = requiredPermissions.every(
      permission => hasPermission(userRole, permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
      });
    }

    next();
  };
}

/**
 * WebSocket authentication middleware
 * @param {Object} socket - Socket.io socket
 * @param {Function} next - Next middleware
 */
export function authenticateSocket(socket, next) {
  const token = socket.handshake.auth.token;
  const apiKey = socket.handshake.auth.apiKey;

  let user = null;

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      user = decoded;
    }
  } else if (apiKey) {
    const userData = verifyApiKey(apiKey);
    if (userData) {
      user = {
        id: userData.id,
        username: userData.username,
        role: userData.role
      };
    }
  }

  if (!user) {
    return next(new Error('Authentication failed'));
  }

  socket.user = user;
  next();
}

/**
 * Login endpoint handler
 */
export function handleLogin(req, res) {
  const { username, password, apiKey } = req.body;

  let user = null;

  if (apiKey) {
    user = verifyApiKey(apiKey);
  } else if (username && password) {
    // In production, use bcrypt to compare hashed passwords
    const foundUser = USERS[username];
    if (foundUser && foundUser.password === password) {
      user = foundUser;
    }
  }

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid credentials'
    });
  }

  const token = generateToken(user);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
}

/**
 * Get current user info
 */
export function getCurrentUser(req, res) {
  res.json({
    success: true,
    user: req.user
  });
}

export default {
  ROLES,
  generateToken,
  verifyToken,
  verifyApiKey,
  hasPermission,
  authenticate,
  authenticateJWT,
  authenticateApiKey,
  authenticateSocket,
  authorize,
  handleLogin,
  getCurrentUser
};

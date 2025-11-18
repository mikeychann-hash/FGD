// middleware/auth.js
// JWT-based authentication middleware for bot management

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

// Generate a secure secret if not provided
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Refresh token storage (use Redis in production)
const refreshTokens = new Map();
const tokenBlacklist = new Set();

// Bcrypt configuration
const SALT_ROUNDS = 12;

// User roles
export const ROLES = {
  ADMIN: 'admin',
  LLM: 'llm',
  VIEWER: 'viewer',
};

/**
 * Validate password requirements
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with isValid and errors
 */
export function validatePassword(password) {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// API Keys - MUST be set via environment variables
// NO DEFAULT VALUES for security - validation enforced at startup
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
const LLM_API_KEY = process.env.LLM_API_KEY;

// Validate API keys are set (should be caught by startup validation)
if (!ADMIN_API_KEY || ADMIN_API_KEY.trim() === '') {
  throw new Error(
    'CRITICAL: ADMIN_API_KEY environment variable must be set. Cannot start without credentials.'
  );
}
if (!LLM_API_KEY || LLM_API_KEY.trim() === '') {
  throw new Error(
    'CRITICAL: LLM_API_KEY environment variable must be set. Cannot start without credentials.'
  );
}

// Hash passwords on initialization
// Default admin password: AdminPass123 (CHANGE IN PRODUCTION!)
const USERS = {
  admin: {
    id: 'admin',
    username: 'admin',
    passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'AdminPass123', SALT_ROUNDS),
    role: ROLES.ADMIN,
    apiKey: ADMIN_API_KEY,
  },
  llm: {
    id: 'llm',
    username: 'llm',
    passwordHash: null, // LLM uses API key only
    role: ROLES.LLM,
    apiKey: LLM_API_KEY,
  },
};

// Role permissions
const PERMISSIONS = {
  [ROLES.ADMIN]: ['admin', 'read', 'write', 'delete', 'spawn', 'command'],
  [ROLES.LLM]: ['read', 'write', 'spawn', 'command'],
  [ROLES.VIEWER]: ['read'],
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
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Generate both access and refresh tokens for a user
 * @param {Object} user - User object
 * @returns {Object} Object containing accessToken and refreshToken
 */
export function generateTokens(user) {
  const accessToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = uuidv4();
  refreshTokens.set(refreshToken, {
    userId: user.id,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000  // 7 days
  });

  return { accessToken, refreshToken };
}

/**
 * Refresh an access token using a refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {string|null} New access token or null if invalid
 */
export function refreshAccessToken(refreshToken) {
  const tokenData = refreshTokens.get(refreshToken);

  if (!tokenData) {
    return null;
  }

  // Check if refresh token is expired
  if (Date.now() > tokenData.expiresAt) {
    refreshTokens.delete(refreshToken);
    return null;
  }

  // Find user by ID
  const user = Object.values(USERS).find(u => u.id === tokenData.userId);

  if (!user) {
    return null;
  }

  // Generate new access token
  const newAccessToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  return newAccessToken;
}

/**
 * Logout user by blacklisting their access token
 * @param {string} token - Access token to blacklist
 */
export function logout(token) {
  if (token) {
    tokenBlacklist.add(token);

    // Set a timeout to remove from blacklist after token would expire anyway (1 hour)
    setTimeout(() => {
      tokenBlacklist.delete(token);
    }, 60 * 60 * 1000);
  }
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
  const user = Object.values(USERS).find((u) => u.apiKey === apiKey);
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
      message: 'No authorization header',
    });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid authorization header format. Use: Bearer <token>',
    });
  }

  const token = parts[1];

  // Check if token is blacklisted
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token has been revoked',
    });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
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
      message: 'No API key provided',
    });
  }

  const user = verifyApiKey(apiKey);

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
  }

  req.user = {
    id: user.id,
    username: user.username,
    role: user.role,
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
    message: 'No authentication provided',
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
        message: 'User not authenticated',
      });
    }

    const userRole = req.user.role;
    const hasAllPermissions = requiredPermissions.every((permission) =>
      hasPermission(userRole, permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      });
    }

    next();
  };
}

/**
 * Convenience middleware to require specific permission
 * Alias for authorize function
 * @param {string} permission - Required permission
 */
export function requirePermission(permission) {
  return authorize(permission);
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
        role: userData.role,
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
export async function handleLogin(req, res) {
  const { username, password, apiKey } = req.body;

  let user = null;

  if (apiKey) {
    user = verifyApiKey(apiKey);
  } else if (username && password) {
    // Validate password requirements
    const validation = validatePassword(password);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Password does not meet requirements',
        validationErrors: validation.errors,
      });
    }

    // Use bcrypt to compare hashed passwords
    const foundUser = USERS[username];
    if (foundUser && foundUser.passwordHash) {
      const isValid = await bcrypt.compare(password, foundUser.passwordHash);
      if (isValid) {
        user = foundUser;
      }
    }
  }

  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid credentials',
    });
  }

  // Generate both access and refresh tokens
  const { accessToken, refreshToken } = generateTokens(user);

  res.json({
    success: true,
    accessToken,
    refreshToken,
    // Keep 'token' for backward compatibility
    token: accessToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
}

/**
 * Get current user info
 */
export function getCurrentUser(req, res) {
  res.json({
    success: true,
    user: req.user,
  });
}

export default {
  ROLES,
  generateToken,
  generateTokens,
  refreshAccessToken,
  logout,
  verifyToken,
  verifyApiKey,
  hasPermission,
  validatePassword,
  authenticate,
  authenticateJWT,
  authenticateApiKey,
  authenticateSocket,
  authorize,
  requirePermission,
  handleLogin,
  getCurrentUser,
};

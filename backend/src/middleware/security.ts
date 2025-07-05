/**
 * Security Middleware
 * Comprehensive security hardening for production
 */

import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { logger } from '../utils/logger';

// Security configuration
const securityConfig = {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://wyoiwyget.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-API-Key',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: {
      general: 100,
      auth: 10,
      api: 1000,
      ai: 50,
      payment: 20,
    },
    message: {
      error: 'Too many requests from this IP, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
  slowDown: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Allow 50 requests per windowMs without delay
    delayMs: 500, // Add 500ms delay per request after delayAfter
    maxDelayMs: 20000, // Maximum delay of 20 seconds
  },
};

/**
 * Helmet security middleware
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://fonts.googleapis.com",
        "https://cdn.jsdelivr.net",
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdn.jsdelivr.net",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        "blob:",
        "https://*.azure.com",
        "https://*.stripe.com",
      ],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://js.stripe.com",
        "https://www.paypal.com",
        "https://www.googletagmanager.com",
      ],
      connectSrc: [
        "'self'",
        "https://api.stripe.com",
        "https://api.paypal.com",
        "https://*.azure.com",
        "https://api.openai.com",
        "wss://*.azure.com",
      ],
      frameSrc: [
        "'self'",
        "https://js.stripe.com",
        "https://www.paypal.com",
        "https://hooks.stripe.com",
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  ieNoOpen: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
});

/**
 * CORS middleware
 */
export const corsMiddleware = cors(securityConfig.cors);

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = rateLimit({
  windowMs: securityConfig.rateLimit.windowMs,
  max: securityConfig.rateLimit.max.general,
  message: securityConfig.rateLimit.message,
  standardHeaders: securityConfig.rateLimit.standardHeaders,
  legacyHeaders: securityConfig.rateLimit.legacyHeaders,
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
    });
    res.status(429).json(securityConfig.rateLimit.message);
  },
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise use IP
    return (req as any).user?.id || req.ip;
  },
});

/**
 * Authentication rate limiting
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: securityConfig.rateLimit.max.auth,
  message: {
    error: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn('Authentication rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
    });
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
    });
  },
});

/**
 * API rate limiting
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: securityConfig.rateLimit.max.api,
  message: {
    error: 'API rate limit exceeded, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
});

/**
 * AI service rate limiting
 */
export const aiServiceRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: securityConfig.rateLimit.max.ai,
  message: {
    error: 'AI service rate limit exceeded, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
});

/**
 * Payment rate limiting
 */
export const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: securityConfig.rateLimit.max.payment,
  message: {
    error: 'Payment rate limit exceeded, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return (req as any).user?.id || req.ip;
  },
});

/**
 * Speed limiting middleware
 */
export const speedLimitMiddleware = slowDown(securityConfig.slowDown);

/**
 * Request validation middleware
 */
export const requestValidation = (req: Request, res: Response, next: NextFunction) => {
  // Validate content type for POST/PUT requests
  if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') &&
      req.headers['content-type'] &&
      !req.headers['content-type'].includes('application/json')) {
    return res.status(400).json({
      error: 'Invalid content type. Expected application/json.',
    });
  }

  // Validate request size
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    return res.status(413).json({
      error: 'Request entity too large',
      maxSize: '10MB',
    });
  }

  // Sanitize request body
  if (req.body) {
    sanitizeObject(req.body);
  }

  next();
};

/**
 * SQL injection prevention middleware
 */
export const sqlInjectionPrevention = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i,
    /(--|\/\*|\*\/|xp_|sp_)/i,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  // Check query parameters
  if (checkValue(req.query)) {
    logger.warn('Potential SQL injection detected in query params', {
      ip: req.ip,
      path: req.path,
      query: req.query,
    });
    return res.status(400).json({
      error: 'Invalid request parameters',
    });
  }

  // Check request body
  if (checkValue(req.body)) {
    logger.warn('Potential SQL injection detected in request body', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(400).json({
      error: 'Invalid request data',
    });
  }

  next();
};

/**
 * XSS prevention middleware
 */
export const xssPrevention = (req: Request, res: Response, next: NextFunction) => {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  ];

  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return xssPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };

  // Check query parameters
  if (checkValue(req.query)) {
    logger.warn('Potential XSS detected in query params', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(400).json({
      error: 'Invalid request parameters',
    });
  }

  // Check request body
  if (checkValue(req.body)) {
    logger.warn('Potential XSS detected in request body', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(400).json({
      error: 'Invalid request data',
    });
  }

  next();
};

/**
 * CSRF protection middleware
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF check for GET requests
  if (req.method === 'GET') {
    return next();
  }

  // Check for CSRF token in headers
  const csrfToken = req.headers['x-csrf-token'] || req.headers['csrf-token'];
  const sessionToken = (req as any).session?.csrfToken;

  if (!csrfToken || !sessionToken || csrfToken !== sessionToken) {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    return res.status(403).json({
      error: 'CSRF token validation failed',
    });
  }

  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

/**
 * IP whitelist middleware
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      logger.warn('Access denied from unauthorized IP', {
        ip: clientIP,
        path: req.path,
      });
      return res.status(403).json({
        error: 'Access denied',
      });
    }

    next();
  };
};

/**
 * API key validation middleware
 */
export const apiKeyValidation = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'API key required',
    });
  }

  // Validate API key format
  if (typeof apiKey === 'string' && !apiKey.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Invalid API key format',
    });
  }

  // Extract token
  const token = typeof apiKey === 'string' ? apiKey.replace('Bearer ', '') : apiKey;

  // Validate token (implement your validation logic here)
  if (!isValidApiKey(token)) {
    logger.warn('Invalid API key used', {
      ip: req.ip,
      path: req.path,
    });
    return res.status(401).json({
      error: 'Invalid API key',
    });
  }

  next();
};

/**
 * Request logging middleware
 */
export const requestLogging = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // Add request ID to request object
  (req as any).requestId = requestId;

  // Log request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userId: (req as any).user?.id,
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Error handling middleware
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  const requestId = (req as any).requestId;

  // Log error
  logger.error('Request error', {
    requestId,
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: (req as any).user?.id,
  });

  // Don't expose internal errors in production
  const isProduction = process.env.NODE_ENV === 'production';
  const errorMessage = isProduction ? 'Internal server error' : err.message;

  res.status(err.status || 500).json({
    error: errorMessage,
    requestId,
  });
};

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: any): void {
  if (typeof obj !== 'object' || obj === null) {
    return;
  }

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (typeof obj[key] === 'string') {
        // Basic sanitization
        obj[key] = obj[key]
          .replace(/[<>]/g, '') // Remove < and >
          .trim();
      } else if (typeof obj[key] === 'object') {
        sanitizeObject(obj[key]);
      }
    }
  }
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate API key
 */
function isValidApiKey(token: string): boolean {
  // Implement your API key validation logic here
  // This is a placeholder - replace with actual validation
  return token.length > 0 && token.startsWith('sk_');
}

/**
 * Security monitoring middleware
 */
export const securityMonitoring = (req: Request, res: Response, next: NextFunction) => {
  // Monitor for suspicious patterns
  const suspiciousPatterns = [
    /\.\.\//, // Directory traversal
    /<script/i, // Script tags
    /javascript:/i, // JavaScript protocol
    /union\s+select/i, // SQL injection
    /exec\s*\(/i, // Command execution
  ];

  const checkSuspicious = (value: any): boolean => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkSuspicious);
    }
    return false;
  };

  if (checkSuspicious(req.query) || checkSuspicious(req.body)) {
    logger.warn('Suspicious activity detected', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
    });
  }

  next();
}; 
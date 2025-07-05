/**
 * Performance Middleware
 * Handles caching, compression, and performance monitoring
 */

import { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

// In-memory cache for simple caching
const memoryCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Performance metrics
const performanceMetrics = {
  requestCount: 0,
  totalResponseTime: 0,
  averageResponseTime: 0,
  slowRequests: [] as Array<{ path: string; duration: number; timestamp: Date }>,
  errorCount: 0,
};

/**
 * Compression middleware
 */
export const compressionMiddleware = compression({
  level: 6, // Balanced compression level
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req: Request, res: Response) => {
    // Don't compress if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for all other requests
    return compression.filter(req, res);
  },
});

/**
 * Rate limiting middleware
 */
export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req: Request, res: Response) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userAgent: req.get('User-Agent'),
    });
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
    });
  },
});

/**
 * API-specific rate limiting
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for API endpoints
  message: {
    error: 'API rate limit exceeded, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise use IP
    return (req as any).user?.id || req.ip;
  },
});

/**
 * AI service rate limiting (more restrictive)
 */
export const aiServiceRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Lower limit for AI services
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
 * Performance monitoring middleware
 */
export const performanceMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const startHrTime = process.hrtime();

  // Add response time header
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const [seconds, nanoseconds] = process.hrtime(startHrTime);
    const hrtimeDuration = seconds * 1000 + nanoseconds / 1000000;

    // Update metrics
    performanceMetrics.requestCount++;
    performanceMetrics.totalResponseTime += duration;
    performanceMetrics.averageResponseTime = performanceMetrics.totalResponseTime / performanceMetrics.requestCount;

    // Track slow requests (> 2 seconds)
    if (duration > 2000) {
      performanceMetrics.slowRequests.push({
        path: req.path,
        duration,
        timestamp: new Date(),
      });

      // Keep only last 100 slow requests
      if (performanceMetrics.slowRequests.length > 100) {
        performanceMetrics.slowRequests.shift();
      }

      logger.warn('Slow request detected', {
        path: req.path,
        method: req.method,
        duration,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });
    }

    // Track errors
    if (res.statusCode >= 400) {
      performanceMetrics.errorCount++;
    }

    // Add performance headers
    res.setHeader('X-Response-Time', `${duration}ms`);
    res.setHeader('X-Process-Time', `${hrtimeDuration.toFixed(2)}ms`);

    // Log performance metrics periodically
    if (performanceMetrics.requestCount % 100 === 0) {
      logger.info('Performance metrics', {
        requestCount: performanceMetrics.requestCount,
        averageResponseTime: performanceMetrics.averageResponseTime.toFixed(2),
        errorRate: ((performanceMetrics.errorCount / performanceMetrics.requestCount) * 100).toFixed(2) + '%',
        slowRequestCount: performanceMetrics.slowRequests.length,
      });
    }
  });

  next();
};

/**
 * Memory cache middleware
 */
export const memoryCacheMiddleware = (ttl: number = 300000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `${req.originalUrl}-${req.headers['authorization'] || 'anonymous'}`;
    const cached = memoryCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      // Return cached response
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    // Store original send method
    const originalSend = res.json;

    // Override send method to cache response
    res.json = function(data: any) {
      // Cache successful responses
      if (res.statusCode === 200) {
        memoryCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl,
        });

        // Clean up old cache entries
        cleanupCache();
      }

      res.setHeader('X-Cache', 'MISS');
      return originalSend.call(this, data);
    };

    next();
  };
};

/**
 * Clean up old cache entries
 */
const cleanupCache = () => {
  const now = Date.now();
  for (const [key, value] of memoryCache.entries()) {
    if (now - value.timestamp > value.ttl) {
      memoryCache.delete(key);
    }
  }
};

/**
 * Database query optimization middleware
 */
export const queryOptimization = (req: Request, res: Response, next: NextFunction) => {
  // Add query optimization headers
  res.setHeader('X-Query-Optimization', 'enabled');

  // Monitor database query performance
  const originalQuery = (req as any).db?.query;
  if (originalQuery) {
    (req as any).db.query = function(...args: any[]) {
      const startTime = process.hrtime();
      
      return originalQuery.apply(this, args).then((result: any) => {
        const [seconds, nanoseconds] = process.hrtime(startTime);
        const duration = seconds * 1000 + nanoseconds / 1000000;

        // Log slow queries
        if (duration > 100) {
          logger.warn('Slow database query', {
            query: args[0]?.substring(0, 100) + '...',
            duration: duration.toFixed(2),
            path: req.path,
          });
        }

        return result;
      });
    };
  }

  next();
};

/**
 * Response optimization middleware
 */
export const responseOptimization = (req: Request, res: Response, next: NextFunction) => {
  // Enable gzip compression for large responses
  if (req.headers['accept-encoding']?.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
  }

  // Add cache control headers for static assets
  if (req.path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
  } else if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
};

/**
 * Memory usage monitoring
 */
export const memoryMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const memUsage = process.memoryUsage();
  
  // Log high memory usage
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
    logger.warn('High memory usage detected', {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      external: Math.round(memUsage.external / 1024 / 1024) + 'MB',
    });
  }

  // Add memory usage header
  res.setHeader('X-Memory-Usage', Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB');

  next();
};

/**
 * Get performance metrics
 */
export const getPerformanceMetrics = () => {
  return {
    ...performanceMetrics,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    cacheSize: memoryCache.size,
  };
};

/**
 * Clear cache
 */
export const clearCache = () => {
  memoryCache.clear();
  logger.info('Memory cache cleared');
};

/**
 * Health check middleware
 */
export const healthCheck = (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    performance: {
      requestCount: performanceMetrics.requestCount,
      averageResponseTime: performanceMetrics.averageResponseTime,
      errorRate: performanceMetrics.requestCount > 0 
        ? (performanceMetrics.errorCount / performanceMetrics.requestCount) * 100 
        : 0,
    },
    cache: {
      size: memoryCache.size,
      hitRate: 0, // Would need to track cache hits/misses
    },
  };

  res.json(health);
};

/**
 * Performance profiling middleware
 */
export const performanceProfiling = (req: Request, res: Response, next: NextFunction) => {
  // Only profile in development
  if (process.env.NODE_ENV !== 'development') {
    return next();
  }

  const startTime = process.hrtime();
  const startMemory = process.memoryUsage();

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const duration = seconds * 1000 + nanoseconds / 1000000;
    const endMemory = process.memoryUsage();
    const memoryDiff = endMemory.heapUsed - startMemory.heapUsed;

    logger.info('Request profiling', {
      path: req.path,
      method: req.method,
      statusCode: res.statusCode,
      duration: duration.toFixed(2) + 'ms',
      memoryDiff: Math.round(memoryDiff / 1024) + 'KB',
      userAgent: req.get('User-Agent'),
    });
  });

  next();
};

/**
 * Request size limiting
 */
export const requestSizeLimit = (limit: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const limitBytes = parseSizeLimit(limit);

    if (contentLength > limitBytes) {
      logger.warn('Request too large', {
        contentLength,
        limit: limitBytes,
        path: req.path,
        ip: req.ip,
      });

      return res.status(413).json({
        error: 'Request entity too large',
        maxSize: limit,
      });
    }

    next();
  };
};

/**
 * Parse size limit string to bytes
 */
const parseSizeLimit = (limit: string): number => {
  const units: { [key: string]: number } = {
    'b': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024,
  };

  const match = limit.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)$/);
  if (!match) {
    return 10 * 1024 * 1024; // Default 10MB
  }

  const value = parseFloat(match[1]);
  const unit = match[2];
  return value * units[unit];
};

/**
 * Connection pooling optimization
 */
export const connectionPoolOptimization = (req: Request, res: Response, next: NextFunction) => {
  // Add connection pool headers
  res.setHeader('X-Connection-Pool', 'optimized');

  // Monitor connection pool usage
  if ((req as any).db?.pool) {
    const pool = (req as any).db.pool;
    const poolInfo = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };

    // Log pool exhaustion
    if (pool.waitingCount > 0) {
      logger.warn('Connection pool exhausted', poolInfo);
    }

    res.setHeader('X-Pool-Status', JSON.stringify(poolInfo));
  }

  next();
}; 
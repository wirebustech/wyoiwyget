/**
 * Monitoring and Metrics
 * Comprehensive observability for production monitoring
 */

import { Request, Response } from 'express';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { logger } from '../utils/logger';

// Initialize default metrics
collectDefaultMetrics({ register });

// Custom metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

export const httpRequestTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestErrors = new Counter({
  name: 'http_request_errors_total',
  help: 'Total number of HTTP request errors',
  labelNames: ['method', 'route', 'error_type'],
});

export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
});

export const databaseQueryDuration = new Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const databaseConnections = new Gauge({
  name: 'database_connections',
  help: 'Number of database connections',
  labelNames: ['state'],
});

export const cacheHitRatio = new Gauge({
  name: 'cache_hit_ratio',
  help: 'Cache hit ratio percentage',
});

export const memoryUsage = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
});

export const cpuUsage = new Gauge({
  name: 'cpu_usage_percentage',
  help: 'CPU usage percentage',
});

export const paymentTransactions = new Counter({
  name: 'payment_transactions_total',
  help: 'Total number of payment transactions',
  labelNames: ['provider', 'status'],
});

export const aiServiceRequests = new Counter({
  name: 'ai_service_requests_total',
  help: 'Total number of AI service requests',
  labelNames: ['service', 'status'],
});

export const userRegistrations = new Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['source'],
});

export const orderCreations = new Counter({
  name: 'order_creations_total',
  help: 'Total number of orders created',
  labelNames: ['status'],
});

export const notificationSends = new Counter({
  name: 'notification_sends_total',
  help: 'Total number of notifications sent',
  labelNames: ['type', 'status'],
});

export const fileUploads = new Counter({
  name: 'file_uploads_total',
  help: 'Total number of file uploads',
  labelNames: ['type', 'status'],
});

export const searchQueries = new Counter({
  name: 'search_queries_total',
  help: 'Total number of search queries',
  labelNames: ['type'],
});

export const wishlistOperations = new Counter({
  name: 'wishlist_operations_total',
  help: 'Total number of wishlist operations',
  labelNames: ['operation'],
});

// Business metrics
export const revenueTotal = new Counter({
  name: 'revenue_total',
  help: 'Total revenue in cents',
  labelNames: ['currency'],
});

export const averageOrderValue = new Gauge({
  name: 'average_order_value',
  help: 'Average order value in cents',
  labelNames: ['currency'],
});

export const conversionRate = new Gauge({
  name: 'conversion_rate',
  help: 'Conversion rate percentage',
});

export const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Number of active users',
  labelNames: ['period'],
});

export const productViews = new Counter({
  name: 'product_views_total',
  help: 'Total number of product views',
  labelNames: ['category'],
});

export const cartAbandonments = new Counter({
  name: 'cart_abandonments_total',
  help: 'Total number of cart abandonments',
});

/**
 * Metrics middleware
 */
export const metricsMiddleware = (req: Request, res: Response, next: Function) => {
  const start = Date.now();
  
  // Track request
  httpRequestTotal.inc({ method: req.method, route: req.route?.path || req.path });
  
  // Override res.end to track response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = (Date.now() - start) / 1000;
    const statusCode = res.statusCode;
    
    // Record duration
    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path, status_code: statusCode },
      duration
    );
    
    // Track errors
    if (statusCode >= 400) {
      const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
      httpRequestErrors.inc({
        method: req.method,
        route: req.route?.path || req.path,
        error_type: errorType,
      });
    }
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Database metrics middleware
 */
export const databaseMetrics = {
  trackQuery: (operation: string, table: string, duration: number) => {
    databaseQueryDuration.observe({ operation, table }, duration);
  },
  
  setConnections: (active: number, idle: number) => {
    databaseConnections.set({ state: 'active' }, active);
    databaseConnections.set({ state: 'idle' }, idle);
  },
};

/**
 * Cache metrics
 */
export const cacheMetrics = {
  setHitRatio: (ratio: number) => {
    cacheHitRatio.set(ratio);
  },
  
  trackHit: () => {
    // Implement cache hit tracking
  },
  
  trackMiss: () => {
    // Implement cache miss tracking
  },
};

/**
 * System metrics
 */
export const systemMetrics = {
  updateMemoryUsage: () => {
    const memUsage = process.memoryUsage();
    memoryUsage.set({ type: 'rss' }, memUsage.rss);
    memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
    memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
    memoryUsage.set({ type: 'external' }, memUsage.external);
  },
  
  updateCpuUsage: (usage: number) => {
    cpuUsage.set(usage);
  },
};

/**
 * Business metrics
 */
export const businessMetrics = {
  trackPayment: (provider: string, status: string, amount?: number) => {
    paymentTransactions.inc({ provider, status });
    if (amount) {
      revenueTotal.inc({ currency: 'usd' }, amount);
    }
  },
  
  trackAiRequest: (service: string, status: string) => {
    aiServiceRequests.inc({ service, status });
  },
  
  trackUserRegistration: (source: string) => {
    userRegistrations.inc({ source });
  },
  
  trackOrderCreation: (status: string, amount?: number) => {
    orderCreations.inc({ status });
    if (amount) {
      revenueTotal.inc({ currency: 'usd' }, amount);
    }
  },
  
  trackNotification: (type: string, status: string) => {
    notificationSends.inc({ type, status });
  },
  
  trackFileUpload: (type: string, status: string) => {
    fileUploads.inc({ type, status });
  },
  
  trackSearch: (type: string) => {
    searchQueries.inc({ type });
  },
  
  trackWishlistOperation: (operation: string) => {
    wishlistOperations.inc({ operation });
  },
  
  trackProductView: (category: string) => {
    productViews.inc({ category });
  },
  
  trackCartAbandonment: () => {
    cartAbandonments.inc();
  },
  
  updateAverageOrderValue: (value: number) => {
    averageOrderValue.set({ currency: 'usd' }, value);
  },
  
  updateConversionRate: (rate: number) => {
    conversionRate.set(rate);
  },
  
  updateActiveUsers: (count: number, period: string) => {
    activeUsers.set({ period }, count);
  },
};

/**
 * Health check metrics
 */
export const healthMetrics = {
  database: new Gauge({
    name: 'health_database',
    help: 'Database health status (1 = healthy, 0 = unhealthy)',
  }),
  
  redis: new Gauge({
    name: 'health_redis',
    help: 'Redis health status (1 = healthy, 0 = unhealthy)',
  }),
  
  externalApis: new Gauge({
    name: 'health_external_apis',
    help: 'External APIs health status (1 = healthy, 0 = unhealthy)',
    labelNames: ['api'],
  }),
  
  diskSpace: new Gauge({
    name: 'health_disk_space_percentage',
    help: 'Disk space usage percentage',
  }),
  
  memoryUsage: new Gauge({
    name: 'health_memory_usage_percentage',
    help: 'Memory usage percentage',
  }),
};

/**
 * Performance metrics
 */
export const performanceMetrics = {
  responseTime: new Histogram({
    name: 'response_time_seconds',
    help: 'Response time in seconds',
    labelNames: ['endpoint'],
    buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  }),
  
  throughput: new Counter({
    name: 'requests_per_second',
    help: 'Requests per second',
    labelNames: ['endpoint'],
  }),
  
  errorRate: new Gauge({
    name: 'error_rate_percentage',
    help: 'Error rate percentage',
    labelNames: ['endpoint'],
  }),
  
  availability: new Gauge({
    name: 'availability_percentage',
    help: 'Service availability percentage',
  }),
};

/**
 * Security metrics
 */
export const securityMetrics = {
  failedLogins: new Counter({
    name: 'failed_logins_total',
    help: 'Total number of failed login attempts',
    labelNames: ['ip'],
  }),
  
  blockedRequests: new Counter({
    name: 'blocked_requests_total',
    help: 'Total number of blocked requests',
    labelNames: ['reason'],
  }),
  
  suspiciousActivity: new Counter({
    name: 'suspicious_activity_total',
    help: 'Total number of suspicious activities detected',
    labelNames: ['type'],
  }),
  
  rateLimitExceeded: new Counter({
    name: 'rate_limit_exceeded_total',
    help: 'Total number of rate limit violations',
    labelNames: ['endpoint'],
  }),
};

/**
 * Metrics endpoint
 */
export const metricsEndpoint = async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    logger.error('Error generating metrics', { error: err });
    res.status(500).end();
  }
};

/**
 * Health check endpoint
 */
export const healthCheckEndpoint = async (req: Request, res: Response) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'healthy',
      redis: 'healthy',
      externalApis: 'healthy',
    },
    metrics: {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
  };

  // Check database health
  try {
    // Add your database health check here
    healthMetrics.database.set(1);
  } catch (error) {
    health.status = 'unhealthy';
    health.services.database = 'unhealthy';
    healthMetrics.database.set(0);
  }

  // Check Redis health
  try {
    // Add your Redis health check here
    healthMetrics.redis.set(1);
  } catch (error) {
    health.status = 'unhealthy';
    health.services.redis = 'unhealthy';
    healthMetrics.redis.set(0);
  }

  // Check external APIs
  try {
    // Add your external API health checks here
    healthMetrics.externalApis.set({ api: 'stripe' }, 1);
    healthMetrics.externalApis.set({ api: 'paypal' }, 1);
    healthMetrics.externalApis.set({ api: 'azure' }, 1);
  } catch (error) {
    health.status = 'unhealthy';
    health.services.externalApis = 'unhealthy';
    healthMetrics.externalApis.set({ api: 'stripe' }, 0);
  }

  // Check disk space
  try {
    const fs = require('fs');
    const stats = fs.statSync('/');
    const diskUsage = ((stats.blocks * 512) / stats.size) * 100;
    healthMetrics.diskSpace.set(diskUsage);
  } catch (error) {
    logger.error('Error checking disk space', { error });
  }

  // Check memory usage
  try {
    const memUsage = process.memoryUsage();
    const memoryUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    healthMetrics.memoryUsage.set(memoryUsagePercent);
  } catch (error) {
    logger.error('Error checking memory usage', { error });
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
};

/**
 * Initialize metrics collection
 */
export const initializeMetrics = () => {
  // Update system metrics every 30 seconds
  setInterval(() => {
    systemMetrics.updateMemoryUsage();
  }, 30000);

  // Update business metrics every minute
  setInterval(() => {
    // Add business metrics updates here
  }, 60000);

  logger.info('Metrics collection initialized');
};

/**
 * Custom metric decorator
 */
export const trackMetric = (metric: Counter | Histogram | Gauge, labels?: Record<string, string>) => {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      
      try {
        const result = await originalMethod.apply(this, args);
        
        if (metric instanceof Histogram) {
          const duration = (Date.now() - start) / 1000;
          metric.observe(labels || {}, duration);
        } else if (metric instanceof Counter) {
          metric.inc(labels || {});
        }
        
        return result;
      } catch (error) {
        if (metric instanceof Counter) {
          metric.inc({ ...labels, error: 'true' });
        }
        throw error;
      }
    };

    return descriptor;
  };
}; 
/**
 * Production Configuration
 * Production environment settings
 */

import { config } from 'dotenv';

// Load environment variables
config();

export const productionConfig = {
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    environment: 'production',
    trustProxy: true, // Trust proxy for rate limiting
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://wyoiwyget.com'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    },
  },

  // Database Configuration
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'wyoiwyget_prod',
    user: process.env.DB_USER || 'wyoiwyget_user',
    password: process.env.DB_PASSWORD || '',
    ssl: {
      rejectUnauthorized: false,
      ca: process.env.DB_SSL_CA,
      cert: process.env.DB_SSL_CERT,
      key: process.env.DB_SSL_KEY,
    },
    pool: {
      min: 5,
      max: 20,
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 30000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
    },
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  },

  // Authentication Configuration
  auth: {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    bcryptRounds: 12,
    sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
  },

  // Payment Configuration
  payment: {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      apiVersion: '2023-10-16',
    },
    paypal: {
      clientId: process.env.PAYPAL_CLIENT_ID || '',
      clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
      mode: 'live', // or 'sandbox' for testing
      webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
    },
  },

  // Email Configuration
  email: {
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
      },
    },
    from: process.env.SMTP_FROM || 'noreply@wyoiwyget.com',
    replyTo: process.env.SMTP_REPLY_TO || 'support@wyoiwyget.com',
    templates: {
      orderConfirmation: 'order-confirmation',
      passwordReset: 'password-reset',
      welcome: 'welcome',
      shippingUpdate: 'shipping-update',
    },
  },

  // SMS Configuration
  sms: {
    provider: process.env.SMS_PROVIDER || 'twilio',
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    },
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      region: process.env.AWS_REGION || 'us-east-1',
      sns: {
        topicArn: process.env.AWS_SNS_TOPIC_ARN || '',
      },
    },
  },

  // Azure Configuration
  azure: {
    storage: {
      accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
      accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY || '',
      connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
      containers: {
        avatars: 'avatars',
        products: 'products',
        tryon: 'tryon-results',
        measurements: 'measurement-images',
      },
    },
    openai: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
      apiKey: process.env.AZURE_OPENAI_API_KEY || '',
      deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || '',
      apiVersion: '2023-12-01-preview',
    },
    computerVision: {
      endpoint: process.env.AZURE_VISION_ENDPOINT || '',
      apiKey: process.env.AZURE_VISION_KEY || '',
    },
    ml: {
      endpoint: process.env.AZURE_ML_ENDPOINT || '',
      apiKey: process.env.AZURE_ML_API_KEY || '',
    },
  },

  // AI Services Configuration
  ai: {
    avatarGeneration: {
      maxConcurrent: 10,
      timeout: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelay: 5000,
    },
    virtualTryOn: {
      maxConcurrent: 5,
      timeout: 600000, // 10 minutes
      retryAttempts: 2,
      retryDelay: 10000,
    },
    bodyMeasurement: {
      maxConcurrent: 20,
      timeout: 120000, // 2 minutes
      retryAttempts: 3,
      retryDelay: 3000,
    },
    productMatching: {
      maxConcurrent: 50,
      timeout: 60000, // 1 minute
      retryAttempts: 2,
      retryDelay: 2000,
    },
  },

  // Rate Limiting Configuration
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: {
      general: 100,
      api: 1000,
      auth: 10,
      ai: 50,
      payment: 20,
    },
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },

  // Security Configuration
  security: {
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'", "https://api.stripe.com", "https://api.paypal.com"],
          frameSrc: ["'self'", "https://js.stripe.com", "https://www.paypal.com"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://wyoiwyget.com'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    },
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json',
    transports: ['console', 'file'],
    file: {
      filename: 'logs/app.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    },
    console: {
      colorize: false,
      timestamp: true,
    },
  },

  // Monitoring Configuration
  monitoring: {
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
    },
    metrics: {
      enabled: true,
      port: parseInt(process.env.METRICS_PORT || '9090'),
      path: '/metrics',
    },
    tracing: {
      enabled: true,
      serviceName: 'wyoiwyget-backend',
      sampler: {
        type: 'probabilistic',
        param: 0.1, // Sample 10% of requests
      },
    },
  },

  // Cache Configuration
  cache: {
    redis: {
      enabled: true,
      ttl: {
        session: 24 * 60 * 60, // 24 hours
        user: 60 * 60, // 1 hour
        product: 30 * 60, // 30 minutes
        avatar: 60 * 60, // 1 hour
        tryon: 15 * 60, // 15 minutes
      },
    },
    memory: {
      enabled: true,
      maxSize: 1000,
      ttl: 5 * 60 * 1000, // 5 minutes
    },
  },

  // Performance Configuration
  performance: {
    compression: {
      enabled: true,
      level: 6,
      threshold: 1024,
    },
    responseTime: {
      enabled: true,
      threshold: 2000, // 2 seconds
    },
    memory: {
      warningThreshold: 500 * 1024 * 1024, // 500MB
      criticalThreshold: 1 * 1024 * 1024 * 1024, // 1GB
    },
  },

  // External Services Configuration
  external: {
    stripe: {
      webhookTimeout: 10000, // 10 seconds
      retryAttempts: 3,
    },
    paypal: {
      webhookTimeout: 10000, // 10 seconds
      retryAttempts: 3,
    },
    azure: {
      timeout: 30000, // 30 seconds
      retryAttempts: 3,
      retryDelay: 1000,
    },
  },

  // Feature Flags
  features: {
    avatarGeneration: true,
    virtualTryOn: true,
    bodyMeasurement: true,
    productMatching: true,
    notifications: true,
    payments: true,
    analytics: true,
    socialFeatures: false, // Disabled for MVP
    arFeatures: false, // Disabled for MVP
  },

  // Backup Configuration
  backup: {
    database: {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      retention: 30, // 30 days
      compression: true,
    },
    files: {
      enabled: true,
      schedule: '0 3 * * *', // Daily at 3 AM
      retention: 90, // 90 days
      include: ['logs', 'uploads'],
    },
  },

  // Maintenance Configuration
  maintenance: {
    enabled: false,
    message: 'System is under maintenance. Please try again later.',
    allowedIPs: process.env.MAINTENANCE_ALLOWED_IPS?.split(',') || [],
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'JWT_SECRET',
  'DB_PASSWORD',
  'STRIPE_SECRET_KEY',
  'PAYPAL_CLIENT_SECRET',
  'AZURE_STORAGE_ACCOUNT_KEY',
  'AZURE_OPENAI_API_KEY',
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

export default productionConfig; 
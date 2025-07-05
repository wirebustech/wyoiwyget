/**
 * Job Queue System
 * Bull-based job queue for background task processing
 */

import Queue from 'bull';
import { logger } from './logger';
import { businessMetrics } from '../monitoring/metrics';

// Queue configuration
const queueConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '1'),
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  concurrency: {
    email: 5,
    payment: 3,
    ai: 2,
    notification: 10,
    avatar: 1,
    virtualTryon: 1,
    productSync: 5,
    analytics: 10,
  },
};

// Queue instances
const queues = {
  email: new Queue('email', { redis: queueConfig.redis }),
  payment: new Queue('payment', { redis: queueConfig.redis }),
  ai: new Queue('ai', { redis: queueConfig.redis }),
  notification: new Queue('notification', { redis: queueConfig.redis }),
  avatar: new Queue('avatar', { redis: queueConfig.redis }),
  virtualTryon: new Queue('virtual-tryon', { redis: queueConfig.redis }),
  productSync: new Queue('product-sync', { redis: queueConfig.redis }),
  analytics: new Queue('analytics', { redis: queueConfig.redis }),
};

// Job types
export enum JobType {
  SEND_EMAIL = 'send-email',
  SEND_SMS = 'send-sms',
  SEND_PUSH_NOTIFICATION = 'send-push-notification',
  PROCESS_PAYMENT = 'process-payment',
  REFUND_PAYMENT = 'refund-payment',
  GENERATE_AVATAR = 'generate-avatar',
  VIRTUAL_TRYON = 'virtual-tryon',
  SYNC_PRODUCTS = 'sync-products',
  UPDATE_ANALYTICS = 'update-analytics',
  CLEANUP_OLD_FILES = 'cleanup-old-files',
  SEND_WELCOME_EMAIL = 'send-welcome-email',
  SEND_ORDER_CONFIRMATION = 'send-order-confirmation',
  SEND_PAYMENT_FAILED = 'send-payment-failed',
  SEND_SHIPPING_UPDATE = 'send-shipping-update',
  PROCESS_WEBHOOK = 'process-webhook',
  UPDATE_INVENTORY = 'update-inventory',
  GENERATE_REPORTS = 'generate-reports',
  BACKUP_DATABASE = 'backup-database',
  SEND_MARKETING_EMAIL = 'send-marketing-email',
  PROCESS_RETURN = 'process-return',
}

// Job data interfaces
export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

export interface PaymentJobData {
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  customerId: string;
  metadata?: Record<string, any>;
}

export interface AvatarJobData {
  userId: string;
  bodyMeasurements: any;
  faceImageUrl?: string;
  bodyImageUrl?: string;
  preferences?: Record<string, any>;
}

export interface VirtualTryOnJobData {
  userId: string;
  avatarId: string;
  productId: string;
  productUrl?: string;
  settings?: Record<string, any>;
}

export interface NotificationJobData {
  userId: string;
  type: 'email' | 'sms' | 'push';
  title: string;
  message: string;
  data?: Record<string, any>;
}

export interface ProductSyncJobData {
  platform: string;
  category?: string;
  forceUpdate?: boolean;
}

export interface AnalyticsJobData {
  event: string;
  userId?: string;
  data: Record<string, any>;
  timestamp: Date;
}

/**
 * Queue manager
 */
export class QueueManager {
  private static instance: QueueManager;
  
  private constructor() {
    this.initializeQueues();
  }
  
  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }
  
  /**
   * Initialize all queues
   */
  private initializeQueues(): void {
    Object.entries(queues).forEach(([name, queue]) => {
      this.setupQueueHandlers(queue, name);
    });
    
    logger.info('Queue system initialized', { queues: Object.keys(queues) });
  }
  
  /**
   * Setup queue event handlers
   */
  private setupQueueHandlers(queue: Queue.Queue, name: string): void {
    queue.on('error', (error) => {
      logger.error(`Queue ${name} error`, { error: error.message });
    });
    
    queue.on('waiting', (job) => {
      logger.debug(`Job waiting in ${name} queue`, { jobId: job.id, jobType: job.name });
    });
    
    queue.on('active', (job) => {
      logger.debug(`Job started in ${name} queue`, { jobId: job.id, jobType: job.name });
    });
    
    queue.on('completed', (job) => {
      logger.debug(`Job completed in ${name} queue`, { jobId: job.id, jobType: job.name });
      businessMetrics.trackJobCompletion(name, 'completed');
    });
    
    queue.on('failed', (job, err) => {
      logger.error(`Job failed in ${name} queue`, {
        jobId: job.id,
        jobType: job.name,
        error: err.message,
        attempts: job.attemptsMade,
      });
      businessMetrics.trackJobCompletion(name, 'failed');
    });
    
    queue.on('stalled', (job) => {
      logger.warn(`Job stalled in ${name} queue`, { jobId: job.id, jobType: job.name });
    });
    
    queue.on('cleaned', (jobs, type) => {
      logger.info(`Cleaned ${jobs.length} jobs from ${name} queue`, { type });
    });
  }
  
  /**
   * Add job to queue
   */
  async addJob<T>(
    queueName: keyof typeof queues,
    jobType: JobType,
    data: T,
    options?: Queue.JobOptions
  ): Promise<Queue.Job<T>> {
    try {
      const queue = queues[queueName];
      const job = await queue.add(jobType, data, {
        ...queueConfig.defaultJobOptions,
        ...options,
      });
      
      logger.info(`Job added to ${queueName} queue`, {
        jobId: job.id,
        jobType,
        queueName,
      });
      
      return job;
    } catch (error) {
      logger.error(`Failed to add job to ${queueName} queue`, {
        jobType,
        error: error.message,
      });
      throw error;
    }
  }
  
  /**
   * Get job by ID
   */
  async getJob<T>(queueName: keyof typeof queues, jobId: string): Promise<Queue.Job<T> | null> {
    try {
      const queue = queues[queueName];
      return await queue.getJob(jobId);
    } catch (error) {
      logger.error(`Failed to get job from ${queueName} queue`, {
        jobId,
        error: error.message,
      });
      return null;
    }
  }
  
  /**
   * Get job status
   */
  async getJobStatus(queueName: keyof typeof queues, jobId: string): Promise<any> {
    try {
      const job = await this.getJob(queueName, jobId);
      if (!job) {
        return { status: 'not_found' };
      }
      
      const state = await job.getState();
      const progress = await job.progress();
      const attempts = job.attemptsMade;
      
      return {
        id: job.id,
        status: state,
        progress,
        attempts,
        data: job.data,
        createdAt: job.timestamp,
        processedAt: job.processedOn,
        finishedAt: job.finishedOn,
      };
    } catch (error) {
      logger.error(`Failed to get job status from ${queueName} queue`, {
        jobId,
        error: error.message,
      });
      return { status: 'error', error: error.message };
    }
  }
  
  /**
   * Remove job
   */
  async removeJob(queueName: keyof typeof queues, jobId: string): Promise<void> {
    try {
      const job = await this.getJob(queueName, jobId);
      if (job) {
        await job.remove();
        logger.info(`Job removed from ${queueName} queue`, { jobId });
      }
    } catch (error) {
      logger.error(`Failed to remove job from ${queueName} queue`, {
        jobId,
        error: error.message,
      });
      throw error;
    }
  }
  
  /**
   * Retry failed job
   */
  async retryJob(queueName: keyof typeof queues, jobId: string): Promise<void> {
    try {
      const job = await this.getJob(queueName, jobId);
      if (job) {
        await job.retry();
        logger.info(`Job retried in ${queueName} queue`, { jobId });
      }
    } catch (error) {
      logger.error(`Failed to retry job in ${queueName} queue`, {
        jobId,
        error: error.message,
      });
      throw error;
    }
  }
  
  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: keyof typeof queues): Promise<any> {
    try {
      const queue = queues[queueName];
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);
      
      return {
        name: queueName,
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length + delayed.length,
      };
    } catch (error) {
      logger.error(`Failed to get queue stats for ${queueName}`, {
        error: error.message,
      });
      return { name: queueName, error: error.message };
    }
  }
  
  /**
   * Get all queue statistics
   */
  async getAllQueueStats(): Promise<any[]> {
    const stats = await Promise.all(
      Object.keys(queues).map(queueName => this.getQueueStats(queueName as keyof typeof queues))
    );
    return stats;
  }
  
  /**
   * Clean completed jobs
   */
  async cleanCompletedJobs(queueName: keyof typeof queues, count: number = 100): Promise<void> {
    try {
      const queue = queues[queueName];
      await queue.clean('completed', count);
      logger.info(`Cleaned completed jobs from ${queueName} queue`, { count });
    } catch (error) {
      logger.error(`Failed to clean completed jobs from ${queueName} queue`, {
        error: error.message,
      });
      throw error;
    }
  }
  
  /**
   * Clean failed jobs
   */
  async cleanFailedJobs(queueName: keyof typeof queues, count: number = 50): Promise<void> {
    try {
      const queue = queues[queueName];
      await queue.clean('failed', count);
      logger.info(`Cleaned failed jobs from ${queueName} queue`, { count });
    } catch (error) {
      logger.error(`Failed to clean failed jobs from ${queueName} queue`, {
        error: error.message,
      });
      throw error;
    }
  }
  
  /**
   * Pause queue
   */
  async pauseQueue(queueName: keyof typeof queues): Promise<void> {
    try {
      const queue = queues[queueName];
      await queue.pause();
      logger.info(`Queue ${queueName} paused`);
    } catch (error) {
      logger.error(`Failed to pause queue ${queueName}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Resume queue
   */
  async resumeQueue(queueName: keyof typeof queues): Promise<void> {
    try {
      const queue = queues[queueName];
      await queue.resume();
      logger.info(`Queue ${queueName} resumed`);
    } catch (error) {
      logger.error(`Failed to resume queue ${queueName}`, { error: error.message });
      throw error;
    }
  }
  
  /**
   * Close all queues
   */
  async closeAll(): Promise<void> {
    try {
      await Promise.all(Object.values(queues).map(queue => queue.close()));
      logger.info('All queues closed');
    } catch (error) {
      logger.error('Failed to close queues', { error: error.message });
      throw error;
    }
  }
}

// Queue manager instance
export const queueManager = QueueManager.getInstance();

/**
 * Email queue operations
 */
export const emailQueue = {
  sendEmail: async (data: EmailJobData, options?: Queue.JobOptions): Promise<Queue.Job<EmailJobData>> => {
    return queueManager.addJob('email', JobType.SEND_EMAIL, data, options);
  },
  
  sendWelcomeEmail: async (userId: string, email: string, options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('email', JobType.SEND_WELCOME_EMAIL, { userId, email }, options);
  },
  
  sendOrderConfirmation: async (orderId: string, email: string, options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('email', JobType.SEND_ORDER_CONFIRMATION, { orderId, email }, options);
  },
  
  sendPaymentFailed: async (orderId: string, email: string, options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('email', JobType.SEND_PAYMENT_FAILED, { orderId, email }, options);
  },
  
  sendShippingUpdate: async (orderId: string, email: string, tracking: string, options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('email', JobType.SEND_SHIPPING_UPDATE, { orderId, email, tracking }, options);
  },
  
  sendMarketingEmail: async (userId: string, email: string, campaign: string, options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('email', JobType.SEND_MARKETING_EMAIL, { userId, email, campaign }, options);
  },
};

/**
 * Payment queue operations
 */
export const paymentQueue = {
  processPayment: async (data: PaymentJobData, options?: Queue.JobOptions): Promise<Queue.Job<PaymentJobData>> => {
    return queueManager.addJob('payment', JobType.PROCESS_PAYMENT, data, options);
  },
  
  refundPayment: async (orderId: string, amount: number, reason: string, options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('payment', JobType.REFUND_PAYMENT, { orderId, amount, reason }, options);
  },
  
  processReturn: async (orderId: string, items: any[], options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('payment', JobType.PROCESS_RETURN, { orderId, items }, options);
  },
};

/**
 * AI queue operations
 */
export const aiQueue = {
  generateAvatar: async (data: AvatarJobData, options?: Queue.JobOptions): Promise<Queue.Job<AvatarJobData>> => {
    return queueManager.addJob('avatar', JobType.GENERATE_AVATAR, data, options);
  },
  
  virtualTryOn: async (data: VirtualTryOnJobData, options?: Queue.JobOptions): Promise<Queue.Job<VirtualTryOnJobData>> => {
    return queueManager.addJob('virtualTryon', JobType.VIRTUAL_TRYON, data, options);
  },
};

/**
 * Notification queue operations
 */
export const notificationQueue = {
  sendNotification: async (data: NotificationJobData, options?: Queue.JobOptions): Promise<Queue.Job<NotificationJobData>> => {
    return queueManager.addJob('notification', JobType.SEND_PUSH_NOTIFICATION, data, options);
  },
  
  sendSMS: async (userId: string, phone: string, message: string, options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('notification', JobType.SEND_SMS, { userId, phone, message }, options);
  },
};

/**
 * Product sync queue operations
 */
export const productSyncQueue = {
  syncProducts: async (data: ProductSyncJobData, options?: Queue.JobOptions): Promise<Queue.Job<ProductSyncJobData>> => {
    return queueManager.addJob('productSync', JobType.SYNC_PRODUCTS, data, options);
  },
  
  updateInventory: async (productId: string, quantity: number, options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('productSync', JobType.UPDATE_INVENTORY, { productId, quantity }, options);
  },
};

/**
 * Analytics queue operations
 */
export const analyticsQueue = {
  trackEvent: async (data: AnalyticsJobData, options?: Queue.JobOptions): Promise<Queue.Job<AnalyticsJobData>> => {
    return queueManager.addJob('analytics', JobType.UPDATE_ANALYTICS, data, options);
  },
  
  generateReports: async (reportType: string, dateRange: any, options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('analytics', JobType.GENERATE_REPORTS, { reportType, dateRange }, options);
  },
};

/**
 * System maintenance queue operations
 */
export const maintenanceQueue = {
  cleanupOldFiles: async (daysOld: number = 30, options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('analytics', JobType.CLEANUP_OLD_FILES, { daysOld }, options);
  },
  
  backupDatabase: async (backupType: 'full' | 'incremental', options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('analytics', JobType.BACKUP_DATABASE, { backupType }, options);
  },
  
  processWebhook: async (webhookData: any, options?: Queue.JobOptions): Promise<Queue.Job<any>> => {
    return queueManager.addJob('payment', JobType.PROCESS_WEBHOOK, webhookData, options);
  },
};

/**
 * Queue processor setup
 */
export const setupQueueProcessors = () => {
  // Email queue processor
  queues.email.process(queueConfig.concurrency.email, async (job) => {
    logger.info('Processing email job', { jobId: job.id, jobType: job.name });
    
    try {
      switch (job.name) {
        case JobType.SEND_EMAIL:
          // Implement email sending logic
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing
          break;
        case JobType.SEND_WELCOME_EMAIL:
          // Implement welcome email logic
          break;
        case JobType.SEND_ORDER_CONFIRMATION:
          // Implement order confirmation logic
          break;
        default:
          throw new Error(`Unknown email job type: ${job.name}`);
      }
      
      logger.info('Email job completed', { jobId: job.id, jobType: job.name });
    } catch (error) {
      logger.error('Email job failed', { jobId: job.id, jobType: job.name, error: error.message });
      throw error;
    }
  });
  
  // Payment queue processor
  queues.payment.process(queueConfig.concurrency.payment, async (job) => {
    logger.info('Processing payment job', { jobId: job.id, jobType: job.name });
    
    try {
      switch (job.name) {
        case JobType.PROCESS_PAYMENT:
          // Implement payment processing logic
          break;
        case JobType.REFUND_PAYMENT:
          // Implement refund logic
          break;
        default:
          throw new Error(`Unknown payment job type: ${job.name}`);
      }
      
      logger.info('Payment job completed', { jobId: job.id, jobType: job.name });
    } catch (error) {
      logger.error('Payment job failed', { jobId: job.id, jobType: job.name, error: error.message });
      throw error;
    }
  });
  
  // AI queue processor
  queues.ai.process(queueConfig.concurrency.ai, async (job) => {
    logger.info('Processing AI job', { jobId: job.id, jobType: job.name });
    
    try {
      switch (job.name) {
        case JobType.GENERATE_AVATAR:
          // Implement avatar generation logic
          break;
        case JobType.VIRTUAL_TRYON:
          // Implement virtual try-on logic
          break;
        default:
          throw new Error(`Unknown AI job type: ${job.name}`);
      }
      
      logger.info('AI job completed', { jobId: job.id, jobType: job.name });
    } catch (error) {
      logger.error('AI job failed', { jobId: job.id, jobType: job.name, error: error.message });
      throw error;
    }
  });
  
  logger.info('Queue processors setup completed');
}; 
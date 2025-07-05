/**
 * Analytics Service
 * Comprehensive analytics and tracking system
 */

import { logger } from './logger';
import { businessMetrics } from '../monitoring/metrics';
import { cacheService } from './cache';
import { queueManager } from './queue';

// Analytics configuration
const analyticsConfig = {
  enabled: process.env.ANALYTICS_ENABLED === 'true',
  batchSize: parseInt(process.env.ANALYTICS_BATCH_SIZE || '100'),
  flushInterval: parseInt(process.env.ANALYTICS_FLUSH_INTERVAL || '30000'), // 30 seconds
  storage: {
    type: process.env.ANALYTICS_STORAGE || 'redis', // redis, postgres, elasticsearch
    retention: {
      events: 90, // days
      sessions: 30, // days
      metrics: 365, // days
    },
  },
  tracking: {
    pageViews: true,
    clicks: true,
    formSubmissions: true,
    purchases: true,
    errors: true,
    performance: true,
  },
};

// Event types
export enum EventType {
  PAGE_VIEW = 'page_view',
  CLICK = 'click',
  FORM_SUBMIT = 'form_submit',
  PURCHASE = 'purchase',
  ADD_TO_CART = 'add_to_cart',
  REMOVE_FROM_CART = 'remove_from_cart',
  SEARCH = 'search',
  LOGIN = 'login',
  REGISTER = 'register',
  LOGOUT = 'logout',
  ERROR = 'error',
  PERFORMANCE = 'performance',
  API_CALL = 'api_call',
  EMAIL_OPEN = 'email_open',
  EMAIL_CLICK = 'email_click',
  PUSH_NOTIFICATION = 'push_notification',
  PRODUCT_VIEW = 'product_view',
  WISHLIST_ADD = 'wishlist_add',
  WISHLIST_REMOVE = 'wishlist_remove',
  REVIEW_SUBMIT = 'review_submit',
  COUPON_APPLY = 'coupon_apply',
  PAYMENT_ATTEMPT = 'payment_attempt',
  REFUND_REQUEST = 'refund_request',
  RETURN_REQUEST = 'return_request',
  CUSTOMER_SUPPORT = 'customer_support',
}

// Event data interface
export interface AnalyticsEvent {
  id: string;
  type: EventType;
  userId?: string;
  sessionId?: string;
  timestamp: Date;
  data: Record<string, any>;
  metadata: {
    userAgent?: string;
    ip?: string;
    referrer?: string;
    url?: string;
    method?: string;
    statusCode?: number;
    duration?: number;
    platform?: string;
    version?: string;
  };
}

// Session data interface
export interface SessionData {
  id: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  events: string[];
  metadata: {
    userAgent: string;
    ip: string;
    platform: string;
    referrer?: string;
    landingPage: string;
    exitPage?: string;
    duration?: number;
    pageViews: number;
    uniquePages: number;
  };
}

// Metrics data interface
export interface MetricsData {
  timestamp: Date;
  metric: string;
  value: number;
  tags: Record<string, string>;
}

/**
 * Analytics service class
 */
export class AnalyticsService {
  private eventBuffer: AnalyticsEvent[] = [];
  private sessionCache: Map<string, SessionData> = new Map();
  private flushTimer: NodeJS.Timeout | null = null;
  
  constructor() {
    if (analyticsConfig.enabled) {
      this.startFlushTimer();
    }
  }
  
  /**
   * Track event
   */
  async trackEvent(
    type: EventType,
    data: Record<string, any> = {},
    userId?: string,
    sessionId?: string,
    metadata: Partial<AnalyticsEvent['metadata']> = {}
  ): Promise<void> {
    if (!analyticsConfig.enabled) {
      return;
    }
    
    try {
      const event: AnalyticsEvent = {
        id: this.generateEventId(),
        type,
        userId,
        sessionId,
        timestamp: new Date(),
        data,
        metadata: {
          ...metadata,
          platform: 'web',
          version: process.env.APP_VERSION || '1.0.0',
        },
      };
      
      // Add to buffer
      this.eventBuffer.push(event);
      
      // Update session if provided
      if (sessionId) {
        await this.updateSession(sessionId, event);
      }
      
      // Flush if buffer is full
      if (this.eventBuffer.length >= analyticsConfig.batchSize) {
        await this.flushEvents();
      }
      
      // Track business metrics
      this.trackBusinessMetrics(type, data);
      
      logger.debug('Event tracked', { type, userId, sessionId });
      
    } catch (error) {
      logger.error('Failed to track event', { type, error: error.message });
    }
  }
  
  /**
   * Track page view
   */
  async trackPageView(
    url: string,
    title: string,
    userId?: string,
    sessionId?: string,
    metadata: Partial<AnalyticsEvent['metadata']> = {}
  ): Promise<void> {
    await this.trackEvent(EventType.PAGE_VIEW, {
      url,
      title,
    }, userId, sessionId, metadata);
  }
  
  /**
   * Track click
   */
  async trackClick(
    element: string,
    text: string,
    url: string,
    userId?: string,
    sessionId?: string,
    metadata: Partial<AnalyticsEvent['metadata']> = {}
  ): Promise<void> {
    await this.trackEvent(EventType.CLICK, {
      element,
      text,
      url,
    }, userId, sessionId, metadata);
  }
  
  /**
   * Track purchase
   */
  async trackPurchase(
    orderId: string,
    amount: number,
    currency: string,
    items: any[],
    userId?: string,
    sessionId?: string,
    metadata: Partial<AnalyticsEvent['metadata']> = {}
  ): Promise<void> {
    await this.trackEvent(EventType.PURCHASE, {
      orderId,
      amount,
      currency,
      items,
      itemCount: items.length,
    }, userId, sessionId, metadata);
  }
  
  /**
   * Track search
   */
  async trackSearch(
    query: string,
    results: number,
    filters: Record<string, any> = {},
    userId?: string,
    sessionId?: string,
    metadata: Partial<AnalyticsEvent['metadata']> = {}
  ): Promise<void> {
    await this.trackEvent(EventType.SEARCH, {
      query,
      results,
      filters,
    }, userId, sessionId, metadata);
  }
  
  /**
   * Track error
   */
  async trackError(
    error: string,
    stack?: string,
    userId?: string,
    sessionId?: string,
    metadata: Partial<AnalyticsEvent['metadata']> = {}
  ): Promise<void> {
    await this.trackEvent(EventType.ERROR, {
      error,
      stack,
    }, userId, sessionId, metadata);
  }
  
  /**
   * Track performance
   */
  async trackPerformance(
    metric: string,
    value: number,
    userId?: string,
    sessionId?: string,
    metadata: Partial<AnalyticsEvent['metadata']> = {}
  ): Promise<void> {
    await this.trackEvent(EventType.PERFORMANCE, {
      metric,
      value,
    }, userId, sessionId, metadata);
  }
  
  /**
   * Start session
   */
  async startSession(
    sessionId: string,
    userId?: string,
    metadata: Partial<SessionData['metadata']> = {}
  ): Promise<void> {
    if (!analyticsConfig.enabled) {
      return;
    }
    
    try {
      const session: SessionData = {
        id: sessionId,
        userId,
        startTime: new Date(),
        events: [],
        metadata: {
          userAgent: metadata.userAgent || '',
          ip: metadata.ip || '',
          platform: metadata.platform || 'web',
          referrer: metadata.referrer,
          landingPage: metadata.landingPage || '',
          pageViews: 0,
          uniquePages: 0,
        },
      };
      
      this.sessionCache.set(sessionId, session);
      
      // Store session in cache
      await cacheService.set(`session:${sessionId}`, session, 3600); // 1 hour
      
      logger.debug('Session started', { sessionId, userId });
      
    } catch (error) {
      logger.error('Failed to start session', { sessionId, error: error.message });
    }
  }
  
  /**
   * End session
   */
  async endSession(sessionId: string, exitPage?: string): Promise<void> {
    if (!analyticsConfig.enabled) {
      return;
    }
    
    try {
      const session = this.sessionCache.get(sessionId);
      if (session) {
        session.endTime = new Date();
        session.metadata.exitPage = exitPage;
        session.metadata.duration = session.endTime.getTime() - session.startTime.getTime();
        
        // Store completed session
        await this.storeSession(session);
        
        // Remove from cache
        this.sessionCache.delete(sessionId);
        await cacheService.delete(`session:${sessionId}`);
        
        logger.debug('Session ended', { sessionId, duration: session.metadata.duration });
      }
      
    } catch (error) {
      logger.error('Failed to end session', { sessionId, error: error.message });
    }
  }
  
  /**
   * Update session with event
   */
  private async updateSession(sessionId: string, event: AnalyticsEvent): Promise<void> {
    try {
      let session = this.sessionCache.get(sessionId);
      
      if (!session) {
        // Try to load from cache
        session = await cacheService.get<SessionData>(`session:${sessionId}`);
        if (session) {
          this.sessionCache.set(sessionId, session);
        }
      }
      
      if (session) {
        session.events.push(event.id);
        
        if (event.type === EventType.PAGE_VIEW) {
          session.metadata.pageViews++;
          
          // Track unique pages
          const uniquePages = new Set(
            session.events
              .filter(e => e === EventType.PAGE_VIEW)
              .map(e => event.data.url)
          );
          session.metadata.uniquePages = uniquePages.size;
        }
        
        // Update cache
        await cacheService.set(`session:${sessionId}`, session, 3600);
      }
      
    } catch (error) {
      logger.error('Failed to update session', { sessionId, error: error.message });
    }
  }
  
  /**
   * Store session data
   */
  private async storeSession(session: SessionData): Promise<void> {
    try {
      // Store in database or analytics storage
      await this.storeData('sessions', session);
      
      // Track session metrics
      businessMetrics.updateActiveUsers(1, 'daily');
      
    } catch (error) {
      logger.error('Failed to store session', { sessionId: session.id, error: error.message });
    }
  }
  
  /**
   * Flush events to storage
   */
  async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }
    
    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];
      
      // Store events
      await this.storeData('events', events);
      
      // Send to queue for processing
      await queueManager.addJob('analytics', 'process-events', { events }, {
        delay: 1000, // 1 second delay
      });
      
      logger.debug('Events flushed', { count: events.length });
      
    } catch (error) {
      logger.error('Failed to flush events', { error: error.message });
      
      // Restore events to buffer
      this.eventBuffer.unshift(...this.eventBuffer);
    }
  }
  
  /**
   * Store data in analytics storage
   */
  private async storeData(type: string, data: any): Promise<void> {
    try {
      switch (analyticsConfig.storage.type) {
        case 'redis':
          await this.storeInRedis(type, data);
          break;
        case 'postgres':
          await this.storeInPostgres(type, data);
          break;
        case 'elasticsearch':
          await this.storeInElasticsearch(type, data);
          break;
        default:
          logger.warn(`Unknown analytics storage type: ${analyticsConfig.storage.type}`);
      }
    } catch (error) {
      logger.error('Failed to store analytics data', { type, error: error.message });
      throw error;
    }
  }
  
  /**
   * Store in Redis
   */
  private async storeInRedis(type: string, data: any): Promise<void> {
    const key = `analytics:${type}:${Date.now()}`;
    await cacheService.set(key, data, 86400 * analyticsConfig.storage.retention.events); // Store for retention period
  }
  
  /**
   * Store in PostgreSQL
   */
  private async storeInPostgres(type: string, data: any): Promise<void> {
    // Implement PostgreSQL storage
    logger.debug('Storing in PostgreSQL', { type, dataCount: Array.isArray(data) ? data.length : 1 });
  }
  
  /**
   * Store in Elasticsearch
   */
  private async storeInElasticsearch(type: string, data: any): Promise<void> {
    // Implement Elasticsearch storage
    logger.debug('Storing in Elasticsearch', { type, dataCount: Array.isArray(data) ? data.length : 1 });
  }
  
  /**
   * Track business metrics
   */
  private trackBusinessMetrics(type: EventType, data: Record<string, any>): void {
    try {
      switch (type) {
        case EventType.PURCHASE:
          businessMetrics.trackPurchase(data.amount, data.currency);
          businessMetrics.updateAverageOrderValue(data.amount);
          break;
          
        case EventType.ADD_TO_CART:
          businessMetrics.trackCartOperation('add');
          break;
          
        case EventType.REMOVE_FROM_CART:
          businessMetrics.trackCartOperation('remove');
          break;
          
        case EventType.SEARCH:
          businessMetrics.trackSearch(data.query);
          break;
          
        case EventType.PRODUCT_VIEW:
          businessMetrics.trackProductView(data.category || 'unknown');
          break;
          
        case EventType.WISHLIST_ADD:
          businessMetrics.trackWishlistOperation('add');
          break;
          
        case EventType.WISHLIST_REMOVE:
          businessMetrics.trackWishlistOperation('remove');
          break;
          
        case EventType.LOGIN:
          businessMetrics.trackUserActivity('login');
          break;
          
        case EventType.REGISTER:
          businessMetrics.trackUserRegistration(data.source || 'web');
          break;
      }
    } catch (error) {
      logger.error('Failed to track business metrics', { type, error: error.message });
    }
  }
  
  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      await this.flushEvents();
    }, analyticsConfig.flushInterval);
  }
  
  /**
   * Stop flush timer
   */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
  
  /**
   * Get analytics data
   */
  async getAnalytics(query: {
    type: 'events' | 'sessions' | 'metrics';
    startDate: Date;
    endDate: Date;
    filters?: Record<string, any>;
    groupBy?: string[];
    limit?: number;
  }): Promise<any[]> {
    try {
      // Implement analytics query based on storage type
      switch (analyticsConfig.storage.type) {
        case 'redis':
          return await this.queryRedis(query);
        case 'postgres':
          return await this.queryPostgres(query);
        case 'elasticsearch':
          return await this.queryElasticsearch(query);
        default:
          return [];
      }
    } catch (error) {
      logger.error('Failed to get analytics data', { query, error: error.message });
      return [];
    }
  }
  
  /**
   * Query Redis analytics
   */
  private async queryRedis(query: any): Promise<any[]> {
    // Implement Redis query
    return [];
  }
  
  /**
   * Query PostgreSQL analytics
   */
  private async queryPostgres(query: any): Promise<any[]> {
    // Implement PostgreSQL query
    return [];
  }
  
  /**
   * Query Elasticsearch analytics
   */
  private async queryElasticsearch(query: any): Promise<any[]> {
    // Implement Elasticsearch query
    return [];
  }
  
  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(): Promise<any> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const events = await this.getAnalytics({
        type: 'events',
        startDate: oneHourAgo,
        endDate: now,
        limit: 1000,
      });
      
      const sessions = await this.getAnalytics({
        type: 'sessions',
        startDate: oneHourAgo,
        endDate: now,
        limit: 1000,
      });
      
      return {
        activeUsers: this.sessionCache.size,
        eventsLastHour: events.length,
        sessionsLastHour: sessions.length,
        topPages: this.getTopPages(events),
        topEvents: this.getTopEvents(events),
      };
    } catch (error) {
      logger.error('Failed to get real-time metrics', { error: error.message });
      return {};
    }
  }
  
  /**
   * Get top pages
   */
  private getTopPages(events: any[]): any[] {
    const pageViews = events.filter(e => e.type === EventType.PAGE_VIEW);
    const pageCounts: Record<string, number> = {};
    
    pageViews.forEach(event => {
      const url = event.data.url;
      pageCounts[url] = (pageCounts[url] || 0) + 1;
    });
    
    return Object.entries(pageCounts)
      .map(([url, count]) => ({ url, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
  
  /**
   * Get top events
   */
  private getTopEvents(events: any[]): any[] {
    const eventCounts: Record<string, number> = {};
    
    events.forEach(event => {
      eventCounts[event.type] = (eventCounts[event.type] || 0) + 1;
    });
    
    return Object.entries(eventCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
  
  /**
   * Cleanup old data
   */
  async cleanupOldData(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - analyticsConfig.storage.retention.events);
      
      // Cleanup old events
      await this.cleanupData('events', cutoffDate);
      
      // Cleanup old sessions
      const sessionCutoff = new Date();
      sessionCutoff.setDate(sessionCutoff.getDate() - analyticsConfig.storage.retention.sessions);
      await this.cleanupData('sessions', sessionCutoff);
      
      logger.info('Analytics cleanup completed');
      
    } catch (error) {
      logger.error('Failed to cleanup analytics data', { error: error.message });
    }
  }
  
  /**
   * Cleanup data by date
   */
  private async cleanupData(type: string, cutoffDate: Date): Promise<void> {
    // Implement cleanup based on storage type
    logger.debug('Cleaning up old data', { type, cutoffDate });
  }
}

// Analytics service instance
export const analyticsService = new AnalyticsService();

/**
 * Analytics middleware
 */
export const analyticsMiddleware = (req: any, res: any, next: any) => {
  if (!analyticsConfig.enabled) {
    return next();
  }
  
  const startTime = Date.now();
  const sessionId = req.session?.id || req.headers['x-session-id'];
  const userId = req.user?.id;
  
  // Track page view
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    analyticsService.trackPageView(
      req.originalUrl,
      req.path,
      userId,
      sessionId,
      {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        referrer: req.get('Referrer'),
        method: req.method,
      }
    );
  }
  
  // Track API calls
  if (req.path.startsWith('/api')) {
    analyticsService.trackEvent(
      EventType.API_CALL,
      {
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
      },
      userId,
      sessionId,
      {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        method: req.method,
        statusCode: res.statusCode,
        duration: Date.now() - startTime,
      }
    );
  }
  
  // Track performance
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    analyticsService.trackPerformance('response_time', duration, userId, sessionId, {
      endpoint: req.path,
      method: req.method,
      statusCode: res.statusCode,
    });
  });
  
  next();
}; 
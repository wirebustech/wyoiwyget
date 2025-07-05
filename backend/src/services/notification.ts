/**
 * Notification Service
 * Handles email, SMS, and in-app notifications
 */

import nodemailer from 'nodemailer';
import { Pool } from 'pg';
import { logger } from '../utils/logger';

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface NotificationData {
  userId: string;
  type: 'email' | 'sms' | 'in_app';
  template: string;
  data: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  template: string;
  data: Record<string, any>;
  status: 'pending' | 'sent' | 'failed';
  priority: string;
  createdAt: Date;
  sentAt?: Date;
  error?: string;
}

export class NotificationService {
  private static emailTransporter: nodemailer.Transporter;
  private static dbPool: Pool;

  /**
   * Initialize notification service
   */
  static async initialize() {
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Initialize database pool
    this.dbPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    logger.info('Notification service initialized');
  }

  /**
   * Send notification
   */
  static async sendNotification(notificationData: NotificationData): Promise<string> {
    try {
      const notificationId = await this.createNotification(notificationData);

      // Send based on type
      switch (notificationData.type) {
        case 'email':
          await this.sendEmail(notificationId, notificationData);
          break;
        case 'sms':
          await this.sendSMS(notificationId, notificationData);
          break;
        case 'in_app':
          await this.sendInAppNotification(notificationId, notificationData);
          break;
        default:
          throw new Error(`Unsupported notification type: ${notificationData.type}`);
      }

      return notificationId;
    } catch (error) {
      logger.error('Failed to send notification', { error, notificationData });
      throw error;
    }
  }

  /**
   * Send order confirmation email
   */
  static async sendOrderConfirmation(
    userId: string,
    orderId: string,
    orderData: any
  ): Promise<string> {
    const template = this.getOrderConfirmationTemplate(orderData);
    
    return this.sendNotification({
      userId,
      type: 'email',
      template: 'order_confirmation',
      data: {
        orderId,
        ...orderData,
      },
      priority: 'high',
    });
  }

  /**
   * Send payment confirmation email
   */
  static async sendPaymentConfirmation(
    userId: string,
    orderId: string,
    paymentData: any
  ): Promise<string> {
    const template = this.getPaymentConfirmationTemplate(paymentData);
    
    return this.sendNotification({
      userId,
      type: 'email',
      template: 'payment_confirmation',
      data: {
        orderId,
        ...paymentData,
      },
      priority: 'high',
    });
  }

  /**
   * Send shipping update email
   */
  static async sendShippingUpdate(
    userId: string,
    orderId: string,
    shippingData: any
  ): Promise<string> {
    return this.sendNotification({
      userId,
      type: 'email',
      template: 'shipping_update',
      data: {
        orderId,
        ...shippingData,
      },
      priority: 'normal',
    });
  }

  /**
   * Send password reset email
   */
  static async sendPasswordReset(
    userId: string,
    resetToken: string,
    userEmail: string
  ): Promise<string> {
    return this.sendNotification({
      userId,
      type: 'email',
      template: 'password_reset',
      data: {
        resetToken,
        userEmail,
        resetUrl: `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`,
      },
      priority: 'high',
    });
  }

  /**
   * Send welcome email
   */
  static async sendWelcomeEmail(
    userId: string,
    userData: any
  ): Promise<string> {
    return this.sendNotification({
      userId,
      type: 'email',
      template: 'welcome',
      data: userData,
      priority: 'normal',
    });
  }

  /**
   * Send avatar generation completion notification
   */
  static async sendAvatarCompletion(
    userId: string,
    avatarId: string,
    avatarData: any
  ): Promise<string> {
    return this.sendNotification({
      userId,
      type: 'in_app',
      template: 'avatar_completion',
      data: {
        avatarId,
        ...avatarData,
      },
      priority: 'normal',
    });
  }

  /**
   * Send virtual try-on completion notification
   */
  static async sendTryOnCompletion(
    userId: string,
    tryOnId: string,
    tryOnData: any
  ): Promise<string> {
    return this.sendNotification({
      userId,
      type: 'in_app',
      template: 'tryon_completion',
      data: {
        tryOnId,
        ...tryOnData,
      },
      priority: 'normal',
    });
  }

  /**
   * Send price drop alert
   */
  static async sendPriceDropAlert(
    userId: string,
    productId: string,
    priceData: any
  ): Promise<string> {
    return this.sendNotification({
      userId,
      type: 'email',
      template: 'price_drop_alert',
      data: {
        productId,
        ...priceData,
      },
      priority: 'normal',
    });
  }

  /**
   * Send SMS notification
   */
  static async sendSMSNotification(
    userId: string,
    phoneNumber: string,
    message: string
  ): Promise<string> {
    return this.sendNotification({
      userId,
      type: 'sms',
      template: 'custom_sms',
      data: {
        phoneNumber,
        message,
      },
      priority: 'high',
    });
  }

  /**
   * Create notification record in database
   */
  private static async createNotification(notificationData: NotificationData): Promise<string> {
    const query = `
      INSERT INTO notifications (
        user_id, type, template, data, priority, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;

    const result = await this.dbPool.query(query, [
      notificationData.userId,
      notificationData.type,
      notificationData.template,
      JSON.stringify(notificationData.data),
      notificationData.priority || 'normal',
      'pending',
      new Date(),
    ]);

    return result.rows[0].id;
  }

  /**
   * Send email notification
   */
  private static async sendEmail(notificationId: string, notificationData: NotificationData): Promise<void> {
    try {
      const user = await this.getUserById(notificationData.userId);
      if (!user) {
        throw new Error('User not found');
      }

      const template = this.getEmailTemplate(notificationData.template, notificationData.data);
      
      const mailOptions = {
        from: process.env.SMTP_FROM,
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      };

      await this.emailTransporter.sendMail(mailOptions);

      // Update notification status
      await this.updateNotificationStatus(notificationId, 'sent');

      logger.info('Email sent successfully', {
        notification_id: notificationId,
        user_id: notificationData.userId,
        template: notificationData.template,
      });
    } catch (error) {
      await this.updateNotificationStatus(notificationId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Send SMS notification
   */
  private static async sendSMS(notificationId: string, notificationData: NotificationData): Promise<void> {
    try {
      const user = await this.getUserById(notificationData.userId);
      if (!user || !user.phone) {
        throw new Error('User phone number not found');
      }

      // Implementation would use SMS service (Twilio, AWS SNS, etc.)
      const message = this.getSMSTemplate(notificationData.template, notificationData.data);
      
      // For now, just log the SMS
      logger.info('SMS would be sent', {
        notification_id: notificationId,
        user_id: notificationData.userId,
        phone: user.phone,
        message,
      });

      await this.updateNotificationStatus(notificationId, 'sent');
    } catch (error) {
      await this.updateNotificationStatus(notificationId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Send in-app notification
   */
  private static async sendInAppNotification(
    notificationId: string,
    notificationData: NotificationData
  ): Promise<void> {
    try {
      // Store in-app notification in database
      const query = `
        INSERT INTO in_app_notifications (
          user_id, title, message, data, read, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;

      const template = this.getInAppTemplate(notificationData.template, notificationData.data);
      
      await this.dbPool.query(query, [
        notificationData.userId,
        template.title,
        template.message,
        JSON.stringify(notificationData.data),
        false,
        new Date(),
      ]);

      await this.updateNotificationStatus(notificationId, 'sent');

      logger.info('In-app notification sent', {
        notification_id: notificationId,
        user_id: notificationData.userId,
        template: notificationData.template,
      });
    } catch (error) {
      await this.updateNotificationStatus(notificationId, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Update notification status
   */
  private static async updateNotificationStatus(
    notificationId: string,
    status: string,
    error?: string
  ): Promise<void> {
    const query = `
      UPDATE notifications 
      SET status = $1, sent_at = $2, error = $3
      WHERE id = $4
    `;

    await this.dbPool.query(query, [
      status,
      status === 'sent' ? new Date() : null,
      error,
      notificationId,
    ]);
  }

  /**
   * Get user by ID
   */
  private static async getUserById(userId: string): Promise<any> {
    const query = `
      SELECT id, email, first_name, last_name, phone
      FROM users
      WHERE id = $1
    `;

    const result = await this.dbPool.query(query, [userId]);
    return result.rows[0];
  }

  /**
   * Get email template
   */
  private static getEmailTemplate(template: string, data: Record<string, any>): EmailTemplate {
    switch (template) {
      case 'order_confirmation':
        return {
          subject: `Order Confirmation - Order #${data.orderId}`,
          html: this.getOrderConfirmationHTML(data),
          text: this.getOrderConfirmationText(data),
        };
      case 'payment_confirmation':
        return {
          subject: `Payment Confirmed - Order #${data.orderId}`,
          html: this.getPaymentConfirmationHTML(data),
          text: this.getPaymentConfirmationText(data),
        };
      case 'shipping_update':
        return {
          subject: `Shipping Update - Order #${data.orderId}`,
          html: this.getShippingUpdateHTML(data),
          text: this.getShippingUpdateText(data),
        };
      case 'password_reset':
        return {
          subject: 'Password Reset Request',
          html: this.getPasswordResetHTML(data),
          text: this.getPasswordResetText(data),
        };
      case 'welcome':
        return {
          subject: 'Welcome to Wyoiwyget!',
          html: this.getWelcomeHTML(data),
          text: this.getWelcomeText(data),
        };
      case 'price_drop_alert':
        return {
          subject: `Price Drop Alert - ${data.productName}`,
          html: this.getPriceDropAlertHTML(data),
          text: this.getPriceDropAlertText(data),
        };
      default:
        throw new Error(`Unknown email template: ${template}`);
    }
  }

  /**
   * Get SMS template
   */
  private static getSMSTemplate(template: string, data: Record<string, any>): string {
    switch (template) {
      case 'custom_sms':
        return data.message;
      case 'order_confirmation':
        return `Your order #${data.orderId} has been confirmed. Total: $${data.total}. Track at ${process.env.FRONTEND_URL}/orders/${data.orderId}`;
      case 'shipping_update':
        return `Your order #${data.orderId} has been shipped! Track at ${process.env.FRONTEND_URL}/orders/${data.orderId}`;
      default:
        throw new Error(`Unknown SMS template: ${template}`);
    }
  }

  /**
   * Get in-app notification template
   */
  private static getInAppTemplate(template: string, data: Record<string, any>): { title: string; message: string } {
    switch (template) {
      case 'avatar_completion':
        return {
          title: 'Avatar Generation Complete',
          message: `Your avatar "${data.avatarName}" is ready! Click to view and try on clothes.`,
        };
      case 'tryon_completion':
        return {
          title: 'Virtual Try-On Complete',
          message: `Your virtual try-on for ${data.productName} is ready! Click to view the results.`,
        };
      default:
        throw new Error(`Unknown in-app template: ${template}`);
    }
  }

  // Email template methods
  private static getOrderConfirmationHTML(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Order Confirmation</title>
        </head>
        <body>
          <h1>Order Confirmation</h1>
          <p>Thank you for your order!</p>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Total:</strong> $${data.total}</p>
          <p><strong>Status:</strong> ${data.status}</p>
          <p>Track your order at: <a href="${process.env.FRONTEND_URL}/orders/${data.orderId}">View Order</a></p>
        </body>
      </html>
    `;
  }

  private static getOrderConfirmationText(data: any): string {
    return `
      Order Confirmation
      
      Thank you for your order!
      
      Order ID: ${data.orderId}
      Total: $${data.total}
      Status: ${data.status}
      
      Track your order at: ${process.env.FRONTEND_URL}/orders/${data.orderId}
    `;
  }

  private static getPaymentConfirmationHTML(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Payment Confirmed</title>
        </head>
        <body>
          <h1>Payment Confirmed</h1>
          <p>Your payment has been successfully processed!</p>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Amount:</strong> $${data.amount}</p>
          <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
          <p>Track your order at: <a href="${process.env.FRONTEND_URL}/orders/${data.orderId}">View Order</a></p>
        </body>
      </html>
    `;
  }

  private static getPaymentConfirmationText(data: any): string {
    return `
      Payment Confirmed
      
      Your payment has been successfully processed!
      
      Order ID: ${data.orderId}
      Amount: $${data.amount}
      Payment Method: ${data.paymentMethod}
      
      Track your order at: ${process.env.FRONTEND_URL}/orders/${data.orderId}
    `;
  }

  private static getShippingUpdateHTML(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Shipping Update</title>
        </head>
        <body>
          <h1>Shipping Update</h1>
          <p>Your order has been shipped!</p>
          <p><strong>Order ID:</strong> ${data.orderId}</p>
          <p><strong>Tracking Number:</strong> ${data.trackingNumber}</p>
          <p><strong>Carrier:</strong> ${data.carrier}</p>
          <p>Track your package at: <a href="${data.trackingUrl}">Track Package</a></p>
        </body>
      </html>
    `;
  }

  private static getShippingUpdateText(data: any): string {
    return `
      Shipping Update
      
      Your order has been shipped!
      
      Order ID: ${data.orderId}
      Tracking Number: ${data.trackingNumber}
      Carrier: ${data.carrier}
      
      Track your package at: ${data.trackingUrl}
    `;
  }

  private static getPasswordResetHTML(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Password Reset</title>
        </head>
        <body>
          <h1>Password Reset Request</h1>
          <p>You requested a password reset for your Wyoiwyget account.</p>
          <p>Click the link below to reset your password:</p>
          <p><a href="${data.resetUrl}">Reset Password</a></p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
        </body>
      </html>
    `;
  }

  private static getPasswordResetText(data: any): string {
    return `
      Password Reset Request
      
      You requested a password reset for your Wyoiwyget account.
      
      Click the link below to reset your password:
      ${data.resetUrl}
      
      If you didn't request this, please ignore this email.
      This link will expire in 1 hour.
    `;
  }

  private static getWelcomeHTML(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Wyoiwyget</title>
        </head>
        <body>
          <h1>Welcome to Wyoiwyget!</h1>
          <p>Hi ${data.firstName},</p>
          <p>Welcome to Wyoiwyget - your AI-powered e-commerce aggregator!</p>
          <p>Get started by:</p>
          <ul>
            <li>Creating your AI avatar</li>
            <li>Browsing products across multiple platforms</li>
            <li>Trying on clothes virtually</li>
            <li>Finding the best deals</li>
          </ul>
          <p><a href="${process.env.FRONTEND_URL}/dashboard">Go to Dashboard</a></p>
        </body>
      </html>
    `;
  }

  private static getWelcomeText(data: any): string {
    return `
      Welcome to Wyoiwyget!
      
      Hi ${data.firstName},
      
      Welcome to Wyoiwyget - your AI-powered e-commerce aggregator!
      
      Get started by:
      - Creating your AI avatar
      - Browsing products across multiple platforms
      - Trying on clothes virtually
      - Finding the best deals
      
      Go to Dashboard: ${process.env.FRONTEND_URL}/dashboard
    `;
  }

  private static getPriceDropAlertHTML(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Price Drop Alert</title>
        </head>
        <body>
          <h1>Price Drop Alert!</h1>
          <p>The price of ${data.productName} has dropped!</p>
          <p><strong>Old Price:</strong> $${data.oldPrice}</p>
          <p><strong>New Price:</strong> $${data.newPrice}</p>
          <p><strong>Savings:</strong> $${data.savings}</p>
          <p><a href="${data.productUrl}">View Product</a></p>
        </body>
      </html>
    `;
  }

  private static getPriceDropAlertText(data: any): string {
    return `
      Price Drop Alert!
      
      The price of ${data.productName} has dropped!
      
      Old Price: $${data.oldPrice}
      New Price: $${data.newPrice}
      Savings: $${data.savings}
      
      View Product: ${data.productUrl}
    `;
  }

  /**
   * Get user notifications
   */
  static async getUserNotifications(userId: string, limit: number = 20): Promise<Notification[]> {
    const query = `
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.dbPool.query(query, [userId, limit]);
    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      template: row.template,
      data: row.data,
      status: row.status,
      priority: row.priority,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      error: row.error,
    }));
  }

  /**
   * Get in-app notifications
   */
  static async getInAppNotifications(userId: string, limit: number = 20): Promise<any[]> {
    const query = `
      SELECT * FROM in_app_notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    const result = await this.dbPool.query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Mark in-app notification as read
   */
  static async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    const query = `
      UPDATE in_app_notifications
      SET read = true, read_at = $1
      WHERE id = $2 AND user_id = $3
    `;

    await this.dbPool.query(query, [new Date(), notificationId, userId]);
  }

  /**
   * Mark all notifications as read
   */
  static async markAllNotificationsAsRead(userId: string): Promise<void> {
    const query = `
      UPDATE in_app_notifications
      SET read = true, read_at = $1
      WHERE user_id = $2 AND read = false
    `;

    await this.dbPool.query(query, [new Date(), userId]);
  }

  /**
   * Delete old notifications
   */
  static async deleteOldNotifications(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const query = `
      DELETE FROM notifications
      WHERE created_at < $1 AND status IN ('sent', 'failed')
    `;

    await this.dbPool.query(query, [cutoffDate]);
  }
} 
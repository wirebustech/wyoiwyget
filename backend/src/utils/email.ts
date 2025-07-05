/**
 * Email Service
 * Multi-provider email service with templating and tracking
 */

import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import AWS from 'aws-sdk';
import { logger } from './logger';
import { businessMetrics } from '../monitoring/metrics';
import { cacheService } from './cache';

// Email configuration
const emailConfig = {
  providers: {
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@wyoiwyget.com',
      fromName: process.env.SENDGRID_FROM_NAME || 'Wyoiwyget',
    },
    ses: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_SES_REGION || 'us-east-1',
      fromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@wyoiwyget.com',
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
  },
  defaultProvider: process.env.EMAIL_PROVIDER || 'sendgrid',
  retryAttempts: 3,
  retryDelay: 1000,
  templates: {
    welcome: 'welcome-email',
    orderConfirmation: 'order-confirmation',
    paymentFailed: 'payment-failed',
    shippingUpdate: 'shipping-update',
    passwordReset: 'password-reset',
    emailVerification: 'email-verification',
    marketing: 'marketing-email',
    returnConfirmation: 'return-confirmation',
    refundProcessed: 'refund-processed',
    accountSuspended: 'account-suspended',
  },
};

// Email providers
let sendgridInitialized = false;
let sesInitialized = false;
let smtpTransporter: nodemailer.Transporter | null = null;

/**
 * Initialize email providers
 */
export const initializeEmailService = async (): Promise<void> => {
  try {
    // Initialize SendGrid
    if (emailConfig.providers.sendgrid.apiKey) {
      sgMail.setApiKey(emailConfig.providers.sendgrid.apiKey);
      sendgridInitialized = true;
      logger.info('SendGrid email provider initialized');
    }
    
    // Initialize AWS SES
    if (emailConfig.providers.ses.accessKeyId && emailConfig.providers.ses.secretAccessKey) {
      AWS.config.update({
        accessKeyId: emailConfig.providers.ses.accessKeyId,
        secretAccessKey: emailConfig.providers.ses.secretAccessKey,
        region: emailConfig.providers.ses.region,
      });
      sesInitialized = true;
      logger.info('AWS SES email provider initialized');
    }
    
    // Initialize SMTP
    if (emailConfig.providers.smtp.host && emailConfig.providers.smtp.auth.user) {
      smtpTransporter = nodemailer.createTransporter({
        host: emailConfig.providers.smtp.host,
        port: emailConfig.providers.smtp.port,
        secure: emailConfig.providers.smtp.secure,
        auth: emailConfig.providers.smtp.auth,
      });
      
      // Verify connection
      await smtpTransporter.verify();
      logger.info('SMTP email provider initialized');
    }
    
    logger.info('Email service initialized', {
      providers: {
        sendgrid: sendgridInitialized,
        ses: sesInitialized,
        smtp: !!smtpTransporter,
      },
      defaultProvider: emailConfig.defaultProvider,
    });
    
  } catch (error) {
    logger.error('Failed to initialize email service', { error: error.message });
    throw error;
  }
};

/**
 * Email data interface
 */
export interface EmailData {
  to: string | string[];
  subject: string;
  template: string;
  data: Record<string, any>;
  from?: string;
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
  priority?: 'low' | 'normal' | 'high';
  tracking?: boolean;
  unsubscribeUrl?: string;
}

/**
 * Email response interface
 */
export interface EmailResponse {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

/**
 * Email service class
 */
export class EmailService {
  private provider: string;
  
  constructor(provider: string = emailConfig.defaultProvider) {
    this.provider = provider;
  }
  
  /**
   * Send email
   */
  async sendEmail(emailData: EmailData): Promise<EmailResponse> {
    const startTime = Date.now();
    
    try {
      // Validate email data
      this.validateEmailData(emailData);
      
      // Get email template
      const template = await this.getTemplate(emailData.template);
      
      // Render email content
      const { html, text } = await this.renderTemplate(template, emailData.data);
      
      // Send email based on provider
      let response: EmailResponse;
      
      switch (this.provider) {
        case 'sendgrid':
          response = await this.sendViaSendGrid(emailData, html, text);
          break;
        case 'ses':
          response = await this.sendViaSES(emailData, html, text);
          break;
        case 'smtp':
          response = await this.sendViaSMTP(emailData, html, text);
          break;
        default:
          throw new Error(`Unsupported email provider: ${this.provider}`);
      }
      
      // Track metrics
      const duration = Date.now() - startTime;
      businessMetrics.trackEmailSend(this.provider, response.success ? 'success' : 'failed');
      
      logger.info('Email sent successfully', {
        to: emailData.to,
        subject: emailData.subject,
        provider: this.provider,
        duration,
        messageId: response.messageId,
      });
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      businessMetrics.trackEmailSend(this.provider, 'failed');
      
      logger.error('Failed to send email', {
        to: emailData.to,
        subject: emailData.subject,
        provider: this.provider,
        error: error.message,
        duration,
      });
      
      return {
        success: false,
        provider: this.provider,
        error: error.message,
      };
    }
  }
  
  /**
   * Send email via SendGrid
   */
  private async sendViaSendGrid(emailData: EmailData, html: string, text: string): Promise<EmailResponse> {
    if (!sendgridInitialized) {
      throw new Error('SendGrid not initialized');
    }
    
    const msg = {
      to: emailData.to,
      from: emailData.from || emailConfig.providers.sendgrid.fromEmail,
      subject: emailData.subject,
      text,
      html,
      replyTo: emailData.replyTo,
      cc: emailData.cc,
      bcc: emailData.bcc,
      attachments: emailData.attachments,
      trackingSettings: {
        clickTracking: {
          enable: emailData.tracking !== false,
        },
        openTracking: {
          enable: emailData.tracking !== false,
        },
        subscriptionTracking: {
          enable: !!emailData.unsubscribeUrl,
          text: 'Unsubscribe from this email',
          html: '<p>Unsubscribe from this email</p>',
          substitutionTag: '[Unsubscribe]',
        },
      },
    };
    
    const response = await sgMail.send(msg);
    
    return {
      success: true,
      messageId: response[0]?.headers['x-message-id'],
      provider: 'sendgrid',
    };
  }
  
  /**
   * Send email via AWS SES
   */
  private async sendViaSES(emailData: EmailData, html: string, text: string): Promise<EmailResponse> {
    if (!sesInitialized) {
      throw new Error('AWS SES not initialized');
    }
    
    const ses = new AWS.SES();
    
    const params = {
      Source: emailData.from || emailConfig.providers.ses.fromEmail,
      Destination: {
        ToAddresses: Array.isArray(emailData.to) ? emailData.to : [emailData.to],
        CcAddresses: emailData.cc,
        BccAddresses: emailData.bcc,
      },
      Message: {
        Subject: {
          Data: emailData.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: text,
            Charset: 'UTF-8',
          },
          Html: {
            Data: html,
            Charset: 'UTF-8',
          },
        },
      },
      ReplyToAddresses: emailData.replyTo ? [emailData.replyTo] : undefined,
    };
    
    const response = await ses.sendEmail(params).promise();
    
    return {
      success: true,
      messageId: response.MessageId,
      provider: 'ses',
    };
  }
  
  /**
   * Send email via SMTP
   */
  private async sendViaSMTP(emailData: EmailData, html: string, text: string): Promise<EmailResponse> {
    if (!smtpTransporter) {
      throw new Error('SMTP not initialized');
    }
    
    const mailOptions = {
      from: emailData.from || emailConfig.providers.smtp.auth.user,
      to: emailData.to,
      subject: emailData.subject,
      text,
      html,
      replyTo: emailData.replyTo,
      cc: emailData.cc,
      bcc: emailData.bcc,
      attachments: emailData.attachments,
      priority: emailData.priority,
    };
    
    const response = await smtpTransporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: response.messageId,
      provider: 'smtp',
    };
  }
  
  /**
   * Validate email data
   */
  private validateEmailData(emailData: EmailData): void {
    if (!emailData.to) {
      throw new Error('Recipient email is required');
    }
    
    if (!emailData.subject) {
      throw new Error('Email subject is required');
    }
    
    if (!emailData.template) {
      throw new Error('Email template is required');
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const recipients = Array.isArray(emailData.to) ? emailData.to : [emailData.to];
    
    for (const email of recipients) {
      if (!emailRegex.test(email)) {
        throw new Error(`Invalid email format: ${email}`);
      }
    }
  }
  
  /**
   * Get email template
   */
  private async getTemplate(templateName: string): Promise<string> {
    // Try to get from cache first
    const cachedTemplate = await cacheService.get<string>(`email_template:${templateName}`);
    if (cachedTemplate) {
      return cachedTemplate;
    }
    
    // Load template from file system or database
    const template = await this.loadTemplate(templateName);
    
    // Cache template for 1 hour
    await cacheService.set(`email_template:${templateName}`, template, 3600);
    
    return template;
  }
  
  /**
   * Load template from file system
   */
  private async loadTemplate(templateName: string): Promise<string> {
    // This is a simplified template loading
    // In production, you would load from a template engine or database
    const templates: Record<string, string> = {
      'welcome-email': `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Welcome to Wyoiwyget</title>
        </head>
        <body>
          <h1>Welcome {{name}}!</h1>
          <p>Thank you for joining Wyoiwyget. We're excited to have you on board!</p>
          <p>Your account has been successfully created.</p>
          <a href="{{verificationUrl}}">Verify your email</a>
        </body>
        </html>
      `,
      'order-confirmation': `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Order Confirmation</title>
        </head>
        <body>
          <h1>Order Confirmed</h1>
          <p>Thank you for your order!</p>
          <p>Order ID: {{orderId}}</p>
          <p>Total: {{total}}</p>
          <a href="{{orderUrl}}">View Order</a>
        </body>
        </html>
      `,
      'password-reset': `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Password Reset</title>
        </head>
        <body>
          <h1>Password Reset Request</h1>
          <p>You requested a password reset.</p>
          <a href="{{resetUrl}}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
        </body>
        </html>
      `,
    };
    
    const template = templates[templateName];
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }
    
    return template;
  }
  
  /**
   * Render template with data
   */
  private async renderTemplate(template: string, data: Record<string, any>): Promise<{ html: string; text: string }> {
    let html = template;
    let text = template;
    
    // Simple template rendering (replace {{variable}} with data)
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, String(value));
      text = text.replace(regex, String(value));
    }
    
    // Remove HTML tags for text version
    text = text.replace(/<[^>]*>/g, '');
    text = text.replace(/\s+/g, ' ').trim();
    
    return { html, text };
  }
  
  /**
   * Send welcome email
   */
  async sendWelcomeEmail(userId: string, email: string, name: string, verificationUrl?: string): Promise<EmailResponse> {
    return this.sendEmail({
      to: email,
      subject: 'Welcome to Wyoiwyget!',
      template: emailConfig.templates.welcome,
      data: {
        name,
        verificationUrl: verificationUrl || '#',
      },
      tracking: true,
    });
  }
  
  /**
   * Send order confirmation
   */
  async sendOrderConfirmation(email: string, orderId: string, total: string, orderUrl: string): Promise<EmailResponse> {
    return this.sendEmail({
      to: email,
      subject: `Order Confirmation - ${orderId}`,
      template: emailConfig.templates.orderConfirmation,
      data: {
        orderId,
        total,
        orderUrl,
      },
      tracking: true,
    });
  }
  
  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string, resetUrl: string): Promise<EmailResponse> {
    return this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      template: emailConfig.templates.passwordReset,
      data: {
        resetUrl,
      },
      tracking: false,
    });
  }
  
  /**
   * Send payment failed email
   */
  async sendPaymentFailed(email: string, orderId: string, amount: string): Promise<EmailResponse> {
    return this.sendEmail({
      to: email,
      subject: 'Payment Failed',
      template: 'payment-failed',
      data: {
        orderId,
        amount,
      },
      tracking: true,
    });
  }
  
  /**
   * Send shipping update
   */
  async sendShippingUpdate(email: string, orderId: string, trackingNumber: string, status: string): Promise<EmailResponse> {
    return this.sendEmail({
      to: email,
      subject: 'Shipping Update',
      template: 'shipping-update',
      data: {
        orderId,
        trackingNumber,
        status,
      },
      tracking: true,
    });
  }
  
  /**
   * Send marketing email
   */
  async sendMarketingEmail(email: string, campaign: string, data: Record<string, any>): Promise<EmailResponse> {
    return this.sendEmail({
      to: email,
      subject: data.subject || 'Special Offer from Wyoiwyget',
      template: emailConfig.templates.marketing,
      data: {
        ...data,
        campaign,
      },
      tracking: true,
      unsubscribeUrl: `${process.env.FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(email)}&campaign=${campaign}`,
    });
  }
  
  /**
   * Send bulk emails
   */
  async sendBulkEmails(emails: EmailData[]): Promise<EmailResponse[]> {
    const results: EmailResponse[] = [];
    
    for (const emailData of emails) {
      try {
        const result = await this.sendEmail(emailData);
        results.push(result);
        
        // Add delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        results.push({
          success: false,
          provider: this.provider,
          error: error.message,
        });
      }
    }
    
    return results;
  }
  
  /**
   * Get email statistics
   */
  async getEmailStats(): Promise<any> {
    // This would integrate with your email provider's API to get statistics
    return {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
    };
  }
}

// Email service instance
export const emailService = new EmailService();

/**
 * Email queue processor
 */
export const processEmailQueue = async (emailData: EmailData): Promise<void> => {
  try {
    await emailService.sendEmail(emailData);
  } catch (error) {
    logger.error('Email queue processing failed', { error: error.message });
    throw error;
  }
};

/**
 * Email template management
 */
export const emailTemplates = {
  createTemplate: async (name: string, html: string, variables: string[]): Promise<void> => {
    // Save template to database or file system
    logger.info('Email template created', { name, variables });
  },
  
  updateTemplate: async (name: string, html: string, variables: string[]): Promise<void> => {
    // Update template in database or file system
    logger.info('Email template updated', { name, variables });
  },
  
  deleteTemplate: async (name: string): Promise<void> => {
    // Delete template from database or file system
    logger.info('Email template deleted', { name });
  },
  
  listTemplates: async (): Promise<string[]> => {
    // List all available templates
    return Object.keys(emailConfig.templates);
  },
}; 
/**
 * Validation Utilities
 * Comprehensive input validation and sanitization
 */

import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Validation schemas
export const validationSchemas = {
  // User validation
  user: {
    register: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).max(128).required(),
      firstName: Joi.string().min(1).max(50).required(),
      lastName: Joi.string().min(1).max(50).required(),
      phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
      dateOfBirth: Joi.date().max('now').optional(),
      gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
      marketingConsent: Joi.boolean().default(false),
      termsAccepted: Joi.boolean().valid(true).required(),
    }),
    
    login: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
      rememberMe: Joi.boolean().default(false),
    }),
    
    update: Joi.object({
      firstName: Joi.string().min(1).max(50).optional(),
      lastName: Joi.string().min(1).max(50).optional(),
      phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).optional(),
      dateOfBirth: Joi.date().max('now').optional(),
      gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
      marketingConsent: Joi.boolean().optional(),
      avatar: Joi.string().uri().optional(),
    }),
    
    changePassword: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(8).max(128).required(),
      confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
    }),
    
    resetPassword: Joi.object({
      email: Joi.string().email().required(),
    }),
    
    resetPasswordConfirm: Joi.object({
      token: Joi.string().required(),
      newPassword: Joi.string().min(8).max(128).required(),
      confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required(),
    }),
  },
  
  // Product validation
  product: {
    create: Joi.object({
      name: Joi.string().min(1).max(200).required(),
      description: Joi.string().min(10).max(2000).required(),
      price: Joi.number().positive().precision(2).required(),
      comparePrice: Joi.number().positive().precision(2).optional(),
      category: Joi.string().required(),
      subcategory: Joi.string().optional(),
      brand: Joi.string().optional(),
      sku: Joi.string().alphanum().max(50).optional(),
      barcode: Joi.string().alphanum().max(50).optional(),
      weight: Joi.number().positive().optional(),
      dimensions: Joi.object({
        length: Joi.number().positive().optional(),
        width: Joi.number().positive().optional(),
        height: Joi.number().positive().optional(),
      }).optional(),
      images: Joi.array().items(Joi.string().uri()).min(1).max(10).required(),
      variants: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required(),
        price: Joi.number().positive().precision(2).optional(),
        sku: Joi.string().alphanum().max(50).optional(),
        stock: Joi.number().integer().min(0).optional(),
      })).optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
      isActive: Joi.boolean().default(true),
      isFeatured: Joi.boolean().default(false),
      metaTitle: Joi.string().max(60).optional(),
      metaDescription: Joi.string().max(160).optional(),
    }),
    
    update: Joi.object({
      name: Joi.string().min(1).max(200).optional(),
      description: Joi.string().min(10).max(2000).optional(),
      price: Joi.number().positive().precision(2).optional(),
      comparePrice: Joi.number().positive().precision(2).optional(),
      category: Joi.string().optional(),
      subcategory: Joi.string().optional(),
      brand: Joi.string().optional(),
      sku: Joi.string().alphanum().max(50).optional(),
      barcode: Joi.string().alphanum().max(50).optional(),
      weight: Joi.number().positive().optional(),
      dimensions: Joi.object({
        length: Joi.number().positive().optional(),
        width: Joi.number().positive().optional(),
        height: Joi.number().positive().optional(),
      }).optional(),
      images: Joi.array().items(Joi.string().uri()).min(1).max(10).optional(),
      variants: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        value: Joi.string().required(),
        price: Joi.number().positive().precision(2).optional(),
        sku: Joi.string().alphanum().max(50).optional(),
        stock: Joi.number().integer().min(0).optional(),
      })).optional(),
      tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
      isActive: Joi.boolean().optional(),
      isFeatured: Joi.boolean().optional(),
      metaTitle: Joi.string().max(60).optional(),
      metaDescription: Joi.string().max(160).optional(),
    }),
    
    search: Joi.object({
      query: Joi.string().min(1).max(100).optional(),
      category: Joi.string().optional(),
      brand: Joi.string().optional(),
      minPrice: Joi.number().positive().optional(),
      maxPrice: Joi.number().positive().optional(),
      sortBy: Joi.string().valid('name', 'price', 'createdAt', 'rating').optional(),
      sortOrder: Joi.string().valid('asc', 'desc').optional(),
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      filters: Joi.object().optional(),
    }),
  },
  
  // Order validation
  order: {
    create: Joi.object({
      items: Joi.array().items(Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
        variantId: Joi.string().optional(),
      })).min(1).required(),
      shippingAddress: Joi.object({
        firstName: Joi.string().min(1).max(50).required(),
        lastName: Joi.string().min(1).max(50).required(),
        address: Joi.string().min(5).max(200).required(),
        city: Joi.string().min(1).max(100).required(),
        state: Joi.string().min(1).max(100).required(),
        postalCode: Joi.string().min(3).max(20).required(),
        country: Joi.string().min(2).max(3).required(),
        phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).required(),
      }).required(),
      billingAddress: Joi.object({
        firstName: Joi.string().min(1).max(50).required(),
        lastName: Joi.string().min(1).max(50).required(),
        address: Joi.string().min(5).max(200).required(),
        city: Joi.string().min(1).max(100).required(),
        state: Joi.string().min(1).max(100).required(),
        postalCode: Joi.string().min(3).max(20).required(),
        country: Joi.string().min(2).max(3).required(),
        phone: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).required(),
      }).required(),
      paymentMethod: Joi.string().valid('stripe', 'paypal').required(),
      couponCode: Joi.string().optional(),
      notes: Joi.string().max(500).optional(),
    }),
    
    update: Joi.object({
      status: Joi.string().valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded').optional(),
      trackingNumber: Joi.string().optional(),
      shippingCarrier: Joi.string().optional(),
      notes: Joi.string().max(500).optional(),
    }),
  },
  
  // Payment validation
  payment: {
    process: Joi.object({
      orderId: Joi.string().required(),
      paymentMethod: Joi.string().valid('stripe', 'paypal').required(),
      paymentToken: Joi.string().required(),
      amount: Joi.number().positive().precision(2).required(),
      currency: Joi.string().length(3).default('USD'),
      metadata: Joi.object().optional(),
    }),
    
    refund: Joi.object({
      orderId: Joi.string().required(),
      amount: Joi.number().positive().precision(2).required(),
      reason: Joi.string().min(1).max(200).required(),
      metadata: Joi.object().optional(),
    }),
  },
  
  // Review validation
  review: {
    create: Joi.object({
      productId: Joi.string().required(),
      rating: Joi.number().integer().min(1).max(5).required(),
      title: Joi.string().min(1).max(100).required(),
      comment: Joi.string().min(10).max(1000).required(),
      images: Joi.array().items(Joi.string().uri()).max(5).optional(),
    }),
    
    update: Joi.object({
      rating: Joi.number().integer().min(1).max(5).optional(),
      title: Joi.string().min(1).max(100).optional(),
      comment: Joi.string().min(10).max(1000).optional(),
      images: Joi.array().items(Joi.string().uri()).max(5).optional(),
    }),
  },
  
  // Wishlist validation
  wishlist: {
    add: Joi.object({
      productId: Joi.string().required(),
      variantId: Joi.string().optional(),
    }),
  },
  
  // Avatar validation
  avatar: {
    generate: Joi.object({
      bodyMeasurements: Joi.object({
        height: Joi.number().positive().max(300).required(),
        weight: Joi.number().positive().max(500).required(),
        chest: Joi.number().positive().max(200).optional(),
        waist: Joi.number().positive().max(200).optional(),
        hips: Joi.number().positive().max(200).optional(),
        shoulderWidth: Joi.number().positive().max(100).optional(),
        armLength: Joi.number().positive().max(150).optional(),
        inseam: Joi.number().positive().max(150).optional(),
        shoeSize: Joi.number().positive().max(60).optional(),
        bodyType: Joi.string().valid('slim', 'athletic', 'average', 'curvy', 'plus_size').optional(),
        gender: Joi.string().valid('male', 'female', 'other').optional(),
      }).required(),
      faceImageUrl: Joi.string().uri().optional(),
      bodyImageUrl: Joi.string().uri().optional(),
      preferences: Joi.object().optional(),
    }),
  },
  
  // File upload validation
  file: {
    upload: Joi.object({
      type: Joi.string().valid('image', 'document', 'avatar').required(),
      maxSize: Joi.number().integer().min(1).max(10 * 1024 * 1024).default(5 * 1024 * 1024), // 5MB default
      allowedTypes: Joi.array().items(Joi.string()).default(['image/jpeg', 'image/png', 'image/webp']),
    }),
  },
  
  // Pagination validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),
};

/**
 * Validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      
      const { error, value } = schema.validate(data, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      
      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type,
        }));
        
        logger.warn('Validation failed', {
          path: req.path,
          method: req.method,
          errors,
          ip: req.ip,
        });
        
        return res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
      }
      
      // Replace request data with validated data
      if (source === 'body') {
        req.body = value;
      } else if (source === 'query') {
        req.query = value;
      } else {
        req.params = value;
      }
      
      next();
    } catch (error) {
      logger.error('Validation error', { error: error.message });
      return res.status(500).json({
        error: 'Internal validation error',
      });
    }
  };
};

/**
 * Sanitization utilities
 */
export const sanitize = {
  /**
   * Sanitize string input
   */
  string: (input: string): string => {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .substring(0, 1000); // Limit length
  },
  
  /**
   * Sanitize email
   */
  email: (input: string): string => {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input.trim().toLowerCase();
  },
  
  /**
   * Sanitize phone number
   */
  phone: (input: string): string => {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input.replace(/[^\d\s\-\(\)\+]/g, '').trim();
  },
  
  /**
   * Sanitize URL
   */
  url: (input: string): string => {
    if (typeof input !== 'string') {
      return '';
    }
    
    try {
      const url = new URL(input);
      return url.toString();
    } catch {
      return '';
    }
  },
  
  /**
   * Sanitize object recursively
   */
  object: (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => sanitize.object(item));
    }
    
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitize.string(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitize.object(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  },
  
  /**
   * Sanitize HTML content
   */
  html: (input: string): string => {
    if (typeof input !== 'string') {
      return '';
    }
    
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  },
};

/**
 * Security validation utilities
 */
export const security = {
  /**
   * Check for SQL injection patterns
   */
  checkSqlInjection: (input: string): boolean => {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\b\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i,
      /(--|\/\*|\*\/|xp_|sp_)/i,
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  },
  
  /**
   * Check for XSS patterns
   */
  checkXSS: (input: string): boolean => {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/i,
      /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/i,
      /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/i,
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  },
  
  /**
   * Check for command injection patterns
   */
  checkCommandInjection: (input: string): boolean => {
    const commandPatterns = [
      /[;&|`$(){}[\]]/,
      /(rm|del|format|mkfs|dd|cat|wget|curl|nc|telnet|ssh|ftp)/i,
    ];
    
    return commandPatterns.some(pattern => pattern.test(input));
  },
  
  /**
   * Check for path traversal patterns
   */
  checkPathTraversal: (input: string): boolean => {
    const pathPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /\/etc\/passwd/,
      /\/proc\/self/,
      /\/sys\/class/,
    ];
    
    return pathPatterns.some(pattern => pattern.test(input));
  },
  
  /**
   * Comprehensive security check
   */
  checkSecurity: (input: string): { safe: boolean; threats: string[] } => {
    const threats: string[] = [];
    
    if (security.checkSqlInjection(input)) {
      threats.push('sql_injection');
    }
    
    if (security.checkXSS(input)) {
      threats.push('xss');
    }
    
    if (security.checkCommandInjection(input)) {
      threats.push('command_injection');
    }
    
    if (security.checkPathTraversal(input)) {
      threats.push('path_traversal');
    }
    
    return {
      safe: threats.length === 0,
      threats,
    };
  },
};

/**
 * File validation utilities
 */
export const fileValidation = {
  /**
   * Validate file type
   */
  validateType: (file: Express.Multer.File, allowedTypes: string[]): boolean => {
    return allowedTypes.includes(file.mimetype);
  },
  
  /**
   * Validate file size
   */
  validateSize: (file: Express.Multer.File, maxSize: number): boolean => {
    return file.size <= maxSize;
  },
  
  /**
   * Validate image dimensions
   */
  validateImageDimensions: async (file: Express.Multer.File, maxWidth: number, maxHeight: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve(img.width <= maxWidth && img.height <= maxHeight);
      };
      img.onerror = () => {
        resolve(false);
      };
      img.src = URL.createObjectURL(file.buffer);
    });
  },
  
  /**
   * Validate file extension
   */
  validateExtension: (file: Express.Multer.File, allowedExtensions: string[]): boolean => {
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    return extension ? allowedExtensions.includes(extension) : false;
  },
};

/**
 * Rate limiting validation
 */
export const rateLimitValidation = {
  /**
   * Check if request is within rate limit
   */
  checkRateLimit: (key: string, limit: number, windowMs: number): Promise<boolean> => {
    // This would integrate with your rate limiting system
    return Promise.resolve(true);
  },
  
  /**
   * Get remaining requests
   */
  getRemainingRequests: (key: string): Promise<number> => {
    // This would return remaining requests for the key
    return Promise.resolve(100);
  },
};

/**
 * Custom validation functions
 */
export const customValidators = {
  /**
   * Validate password strength
   */
  passwordStrength: (password: string): { valid: boolean; score: number; feedback: string[] } => {
    const feedback: string[] = [];
    let score = 0;
    
    if (password.length >= 8) score += 1;
    else feedback.push('Password must be at least 8 characters long');
    
    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Password must contain at least one lowercase letter');
    
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Password must contain at least one uppercase letter');
    
    if (/[0-9]/.test(password)) score += 1;
    else feedback.push('Password must contain at least one number');
    
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    else feedback.push('Password must contain at least one special character');
    
    return {
      valid: score >= 4,
      score,
      feedback,
    };
  },
  
  /**
   * Validate credit card number
   */
  creditCard: (number: string): boolean => {
    // Luhn algorithm
    const digits = number.replace(/\D/g, '').split('').map(Number);
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = digits[i];
      
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      
      sum += digit;
      isEven = !isEven;
    }
    
    return sum % 10 === 0;
  },
  
  /**
   * Validate postal code
   */
  postalCode: (code: string, country: string = 'US'): boolean => {
    const patterns: Record<string, RegExp> = {
      US: /^\d{5}(-\d{4})?$/,
      CA: /^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$/,
      UK: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i,
    };
    
    const pattern = patterns[country.toUpperCase()];
    return pattern ? pattern.test(code) : true;
  },
  
  /**
   * Validate phone number
   */
  phoneNumber: (phone: string, country: string = 'US'): boolean => {
    const patterns: Record<string, RegExp> = {
      US: /^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/,
      CA: /^\+?1?[-.\s]?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/,
      UK: /^\+?44[-.\s]?[0-9]{4}[-.\s]?[0-9]{6}$/,
    };
    
    const pattern = patterns[country.toUpperCase()];
    return pattern ? pattern.test(phone) : true;
  },
};

/**
 * Validation error formatter
 */
export const formatValidationError = (error: Joi.ValidationError): any => {
  return {
    error: 'Validation failed',
    message: 'The provided data is invalid',
    details: error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
      value: detail.context?.value,
    })),
  };
};

/**
 * Validation middleware for file uploads
 */
export const validateFileUpload = (options: {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  maxFiles?: number;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({
          error: 'No files uploaded',
        });
      }
      
      if (options.maxFiles && files.length > options.maxFiles) {
        return res.status(400).json({
          error: `Maximum ${options.maxFiles} files allowed`,
        });
      }
      
      for (const file of files) {
        // Check file type
        if (options.allowedTypes && !fileValidation.validateType(file, options.allowedTypes)) {
          return res.status(400).json({
            error: `File type ${file.mimetype} not allowed`,
          });
        }
        
        // Check file extension
        if (options.allowedExtensions && !fileValidation.validateExtension(file, options.allowedExtensions)) {
          return res.status(400).json({
            error: `File extension not allowed`,
          });
        }
        
        // Check file size
        if (options.maxSize && !fileValidation.validateSize(file, options.maxSize)) {
          return res.status(400).json({
            error: `File size exceeds maximum allowed size`,
          });
        }
      }
      
      next();
    } catch (error) {
      logger.error('File validation error', { error: error.message });
      return res.status(500).json({
        error: 'File validation error',
      });
    }
  };
}; 
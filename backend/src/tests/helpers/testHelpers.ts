/**
 * Test Helpers
 * Utility functions for testing
 */

import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

// Test database configuration
const testDbConfig = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5432'),
  database: process.env.TEST_DB_NAME || 'wyoiwyget_test',
  user: process.env.TEST_DB_USER || 'test_user',
  password: process.env.TEST_DB_PASSWORD || 'test_password',
};

let testDbPool: Pool;

/**
 * Initialize test database connection
 */
export const initTestDatabase = async () => {
  testDbPool = new Pool(testDbConfig);
  
  try {
    await testDbPool.query('SELECT NOW()');
    console.log('Test database connected successfully');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
};

/**
 * Close test database connection
 */
export const closeTestDatabase = async () => {
  if (testDbPool) {
    await testDbPool.end();
  }
};

/**
 * Clean test database
 */
export const cleanTestDatabase = async () => {
  if (!testDbPool) return;

  const tables = [
    'notifications',
    'order_payments',
    'order_items',
    'orders',
    'cart_items',
    'wishlist_items',
    'wishlists',
    'product_reviews',
    'products',
    'user_sessions',
    'users',
  ];

  for (const table of tables) {
    try {
      await testDbPool.query(`DELETE FROM ${table}`);
    } catch (error) {
      // Table might not exist, continue
    }
  }
};

/**
 * Create a test user
 */
export const createTestUser = async (userData?: Partial<any>): Promise<any> => {
  const defaultUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
    phone: '+1234567890',
    isActive: true,
    emailVerified: true,
    ...userData,
  };

  const hashedPassword = await bcrypt.hash(defaultUser.password, 10);

  const query = `
    INSERT INTO users (
      email, password_hash, first_name, last_name, phone, is_active, email_verified, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, email, first_name, last_name, phone, is_active, email_verified, created_at
  `;

  const result = await testDbPool.query(query, [
    defaultUser.email,
    hashedPassword,
    defaultUser.firstName,
    defaultUser.lastName,
    defaultUser.phone,
    defaultUser.isActive,
    defaultUser.emailVerified,
    new Date(),
    new Date(),
  ]);

  return {
    ...result.rows[0],
    password: defaultUser.password, // Return plain password for testing
  };
};

/**
 * Generate test JWT token
 */
export const generateTestToken = (userId: string, expiresIn: string = '1h'): string => {
  return jwt.sign(
    { 
      id: userId, 
      email: 'test@example.com',
      role: 'user' 
    },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn }
  );
};

/**
 * Create test product
 */
export const createTestProduct = async (productData?: Partial<any>): Promise<any> => {
  const defaultProduct = {
    name: `Test Product ${Date.now()}`,
    description: 'Test product description',
    price: 99.99,
    originalPrice: 129.99,
    imageUrl: 'https://via.placeholder.com/300',
    category: 'Electronics',
    brand: 'TestBrand',
    platform: 'Amazon',
    url: 'https://example.com/product',
    inStock: true,
    rating: 4.5,
    reviewCount: 100,
    ...productData,
  };

  const query = `
    INSERT INTO products (
      name, description, price, original_price, image_url, category, brand, platform, url, in_stock, rating, review_count, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *
  `;

  const result = await testDbPool.query(query, [
    defaultProduct.name,
    defaultProduct.description,
    defaultProduct.price,
    defaultProduct.originalPrice,
    defaultProduct.imageUrl,
    defaultProduct.category,
    defaultProduct.brand,
    defaultProduct.platform,
    defaultProduct.url,
    defaultProduct.inStock,
    defaultProduct.rating,
    defaultProduct.reviewCount,
    new Date(),
    new Date(),
  ]);

  return result.rows[0];
};

/**
 * Create test order
 */
export const createTestOrder = async (userId: string, orderData?: Partial<any>): Promise<any> => {
  const defaultOrder = {
    status: 'pending',
    subtotal: 199.98,
    shipping: 5.99,
    tax: 16.00,
    total: 221.97,
    paymentStatus: 'pending',
    paymentMethod: 'credit_card',
    shippingAddress: {
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      phone: '+1234567890',
      address: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      country: 'United States',
    },
    ...orderData,
  };

  const query = `
    INSERT INTO orders (
      user_id, status, subtotal, shipping, tax, total, payment_status, payment_method, shipping_address, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;

  const result = await testDbPool.query(query, [
    userId,
    defaultOrder.status,
    defaultOrder.subtotal,
    defaultOrder.shipping,
    defaultOrder.tax,
    defaultOrder.total,
    defaultOrder.paymentStatus,
    defaultOrder.paymentMethod,
    JSON.stringify(defaultOrder.shippingAddress),
    new Date(),
    new Date(),
  ]);

  return result.rows[0];
};

/**
 * Create test order item
 */
export const createTestOrderItem = async (orderId: string, productId: string, itemData?: Partial<any>): Promise<any> => {
  const defaultItem = {
    quantity: 1,
    price: 99.99,
    subtotal: 99.99,
    ...itemData,
  };

  const query = `
    INSERT INTO order_items (
      order_id, product_id, quantity, price, subtotal, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const result = await testDbPool.query(query, [
    orderId,
    productId,
    defaultItem.quantity,
    defaultItem.price,
    defaultItem.subtotal,
    new Date(),
  ]);

  return result.rows[0];
};

/**
 * Create test wishlist
 */
export const createTestWishlist = async (userId: string, wishlistData?: Partial<any>): Promise<any> => {
  const defaultWishlist = {
    name: `Test Wishlist ${Date.now()}`,
    description: 'Test wishlist description',
    isPublic: false,
    ...wishlistData,
  };

  const query = `
    INSERT INTO wishlists (
      user_id, name, description, is_public, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const result = await testDbPool.query(query, [
    userId,
    defaultWishlist.name,
    defaultWishlist.description,
    defaultWishlist.isPublic,
    new Date(),
    new Date(),
  ]);

  return result.rows[0];
};

/**
 * Create test wishlist item
 */
export const createTestWishlistItem = async (wishlistId: string, productId: string, itemData?: Partial<any>): Promise<any> => {
  const defaultItem = {
    notes: 'Test notes',
    priceAlerts: false,
    targetPrice: null,
    ...itemData,
  };

  const query = `
    INSERT INTO wishlist_items (
      wishlist_id, product_id, notes, price_alerts, target_price, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;

  const result = await testDbPool.query(query, [
    wishlistId,
    productId,
    defaultItem.notes,
    defaultItem.priceAlerts,
    defaultItem.targetPrice,
    new Date(),
  ]);

  return result.rows[0];
};

/**
 * Create test notification
 */
export const createTestNotification = async (userId: string, notificationData?: Partial<any>): Promise<any> => {
  const defaultNotification = {
    type: 'email',
    template: 'order_confirmation',
    data: { orderId: 'test-order-123' },
    status: 'pending',
    priority: 'normal',
    ...notificationData,
  };

  const query = `
    INSERT INTO notifications (
      user_id, type, template, data, status, priority, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const result = await testDbPool.query(query, [
    userId,
    defaultNotification.type,
    defaultNotification.template,
    JSON.stringify(defaultNotification.data),
    defaultNotification.status,
    defaultNotification.priority,
    new Date(),
  ]);

  return result.rows[0];
};

/**
 * Mock Stripe payment intent
 */
export const mockStripePaymentIntent = (overrides?: Partial<any>) => {
  return {
    id: 'pi_test_payment_intent',
    amount: 1000,
    currency: 'usd',
    status: 'requires_payment_method',
    client_secret: 'pi_test_secret',
    payment_method_types: ['card'],
    metadata: {
      order_id: 'test-order-123',
      user_id: 'test-user-123',
    },
    ...overrides,
  };
};

/**
 * Mock PayPal order
 */
export const mockPayPalOrder = (overrides?: Partial<any>) => {
  return {
    id: 'test_paypal_order',
    status: 'CREATED',
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: 'test-order-123',
      amount: {
        currency_code: 'USD',
        value: '100.00',
      },
    }],
    links: [
      {
        href: 'https://www.sandbox.paypal.com/checkoutnow?token=test_token',
        rel: 'approve',
        method: 'GET',
      },
    ],
    ...overrides,
  };
};

/**
 * Mock user session
 */
export const createTestSession = async (userId: string, sessionData?: Partial<any>): Promise<any> => {
  const defaultSession = {
    token: `session-${Date.now()}`,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    userAgent: 'Test User Agent',
    ipAddress: '127.0.0.1',
    isActive: true,
    ...sessionData,
  };

  const query = `
    INSERT INTO user_sessions (
      user_id, token, expires_at, user_agent, ip_address, is_active, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const result = await testDbPool.query(query, [
    userId,
    defaultSession.token,
    defaultSession.expiresAt,
    defaultSession.userAgent,
    defaultSession.ipAddress,
    defaultSession.isActive,
    new Date(),
  ]);

  return result.rows[0];
};

/**
 * Mock email service
 */
export const mockEmailService = {
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  sendBulkEmail: jest.fn().mockResolvedValue({ success: true }),
};

/**
 * Mock SMS service
 */
export const mockSMSService = {
  sendSMS: jest.fn().mockResolvedValue({ messageId: 'test-sms-id' }),
  sendBulkSMS: jest.fn().mockResolvedValue({ success: true }),
};

/**
 * Mock Azure services
 */
export const mockAzureServices = {
  blobStorage: {
    uploadBlob: jest.fn().mockResolvedValue('https://test.blob.core.windows.net/test/upload.jpg'),
    downloadBlob: jest.fn().mockResolvedValue(Buffer.from('test image data')),
    deleteBlob: jest.fn().mockResolvedValue(true),
  },
  openAI: {
    generateImage: jest.fn().mockResolvedValue('https://test.openai.com/generated-image.jpg'),
    generateText: jest.fn().mockResolvedValue('Generated text response'),
  },
  computerVision: {
    analyzeImage: jest.fn().mockResolvedValue({
      objects: [],
      people: [],
      description: 'Test image description',
    }),
  },
};

/**
 * Setup test environment
 */
export const setupTestEnvironment = async () => {
  await initTestDatabase();
  await cleanTestDatabase();
};

/**
 * Teardown test environment
 */
export const teardownTestEnvironment = async () => {
  await cleanTestDatabase();
  await closeTestDatabase();
};

/**
 * Generate test data for performance testing
 */
export const generateTestData = async (count: number = 100) => {
  const users = [];
  const products = [];
  const orders = [];

  // Create test users
  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      email: `test-user-${i}@example.com`,
      firstName: `Test${i}`,
      lastName: `User${i}`,
    });
    users.push(user);
  }

  // Create test products
  for (let i = 0; i < count; i++) {
    const product = await createTestProduct({
      name: `Test Product ${i}`,
      price: Math.random() * 1000 + 10,
      category: ['Electronics', 'Clothing', 'Home', 'Sports'][Math.floor(Math.random() * 4)],
    });
    products.push(product);
  }

  // Create test orders
  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const order = await createTestOrder(user.id, {
      status: ['pending', 'processing', 'shipped', 'delivered'][Math.floor(Math.random() * 4)],
      total: Math.random() * 500 + 50,
    });
    orders.push(order);
  }

  return { users, products, orders };
};

/**
 * Wait for async operations
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry function for flaky tests
 */
export const retry = async (fn: () => Promise<any>, maxAttempts: number = 3, delay: number = 1000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }
      await wait(delay);
    }
  }
}; 
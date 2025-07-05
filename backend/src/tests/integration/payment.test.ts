/**
 * Payment Integration Tests
 * Tests payment processing functionality
 */

import request from 'supertest';
import { app } from '../../app';
import { PaymentService } from '../../services/payment';
import { createTestUser, generateTestToken } from '../helpers/testHelpers';

describe('Payment Integration Tests', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    testUser = await createTestUser();
    authToken = generateTestToken(testUser.id);
  });

  describe('POST /api/payments/stripe/create-intent', () => {
    it('should create a Stripe payment intent successfully', async () => {
      const paymentData = {
        amount: 100.00,
        currency: 'usd',
        orderId: 'test-order-123',
      };

      const response = await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.payment_intent).toBeDefined();
      expect(response.body.payment_intent.id).toBeDefined();
      expect(response.body.payment_intent.amount).toBe(100);
      expect(response.body.payment_intent.currency).toBe('usd');
      expect(response.body.payment_intent.client_secret).toBeDefined();
    });

    it('should reject invalid amount', async () => {
      const paymentData = {
        amount: -50.00,
        currency: 'usd',
        orderId: 'test-order-123',
      };

      await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);
    });

    it('should reject missing order ID', async () => {
      const paymentData = {
        amount: 100.00,
        currency: 'usd',
      };

      await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(400);
    });

    it('should reject unauthorized requests', async () => {
      const paymentData = {
        amount: 100.00,
        currency: 'usd',
        orderId: 'test-order-123',
      };

      await request(app)
        .post('/api/payments/stripe/create-intent')
        .send(paymentData)
        .expect(401);
    });
  });

  describe('POST /api/payments/stripe/confirm', () => {
    it('should confirm a Stripe payment successfully', async () => {
      // First create a payment intent
      const createResponse = await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50.00,
          currency: 'usd',
          orderId: 'test-order-confirm',
        });

      const paymentIntentId = createResponse.body.payment_intent.id;
      const paymentMethodId = 'pm_card_visa'; // Test payment method

      const response = await request(app)
        .post('/api/payments/stripe/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId,
          paymentMethodId,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.payment_intent).toBeDefined();
      expect(response.body.payment_intent.id).toBe(paymentIntentId);
    });

    it('should reject invalid payment intent ID', async () => {
      await request(app)
        .post('/api/payments/stripe/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'invalid-id',
          paymentMethodId: 'pm_card_visa',
        })
        .expect(500);
    });
  });

  describe('POST /api/payments/paypal/create-order', () => {
    it('should create a PayPal order successfully', async () => {
      const orderData = {
        amount: 75.00,
        currency: 'USD',
        orderId: 'test-paypal-order',
      };

      const response = await request(app)
        .post('/api/payments/paypal/create-order')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.paypal_order).toBeDefined();
      expect(response.body.paypal_order.orderId).toBeDefined();
      expect(response.body.paypal_order.approvalUrl).toBeDefined();
    });

    it('should reject invalid amount for PayPal', async () => {
      const orderData = {
        amount: 0,
        currency: 'USD',
        orderId: 'test-paypal-order',
      };

      await request(app)
        .post('/api/payments/paypal/create-order')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(400);
    });
  });

  describe('POST /api/payments/process', () => {
    it('should process order payment with Stripe', async () => {
      const paymentData = {
        orderId: 'test-process-order',
        amount: 125.00,
        paymentMethod: 'stripe',
        paymentData: {
          paymentMethodId: 'pm_card_visa',
        },
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.order_payment).toBeDefined();
      expect(response.body.order_payment.order_id).toBe('test-process-order');
      expect(response.body.order_payment.amount).toBe(125.00);
      expect(response.body.order_payment.payment_method).toBe('stripe');
    });

    it('should process order payment with PayPal', async () => {
      const paymentData = {
        orderId: 'test-process-paypal',
        amount: 200.00,
        paymentMethod: 'paypal',
        paymentData: {},
      };

      const response = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.order_payment).toBeDefined();
      expect(response.body.order_payment.order_id).toBe('test-process-paypal');
      expect(response.body.order_payment.amount).toBe(200.00);
      expect(response.body.order_payment.payment_method).toBe('paypal');
    });

    it('should reject invalid payment method', async () => {
      const paymentData = {
        orderId: 'test-invalid-method',
        amount: 100.00,
        paymentMethod: 'invalid',
        paymentData: {},
      };

      await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(500);
    });
  });

  describe('GET /api/payments/payment-methods', () => {
    it('should return user payment methods', async () => {
      const response = await request(app)
        .get('/api/payments/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.payment_methods)).toBe(true);
    });

    it('should reject unauthorized requests', async () => {
      await request(app)
        .get('/api/payments/payment-methods')
        .expect(401);
    });
  });

  describe('POST /api/payments/payment-methods', () => {
    it('should save a payment method', async () => {
      const paymentMethodData = {
        paymentMethodId: 'pm_card_visa',
      };

      const response = await request(app)
        .post('/api/payments/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentMethodData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.payment_method).toBeDefined();
      expect(response.body.payment_method.id).toBe('pm_card_visa');
    });

    it('should reject missing payment method ID', async () => {
      await request(app)
        .post('/api/payments/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('DELETE /api/payments/payment-methods/:paymentMethodId', () => {
    it('should delete a payment method', async () => {
      const paymentMethodId = 'pm_card_visa';

      const response = await request(app)
        .delete(`/api/payments/payment-methods/${paymentMethodId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Payment method deleted successfully');
    });
  });

  describe('GET /api/payments/order/:orderId/status', () => {
    it('should return payment status for order', async () => {
      const orderId = 'test-order-status';

      const response = await request(app)
        .get(`/api/payments/order/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.payment_status).toBeDefined();
    });

    it('should return 404 for non-existent order', async () => {
      await request(app)
        .get('/api/payments/order/non-existent/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('POST /api/payments/refund', () => {
    it('should process refund successfully', async () => {
      // First create and confirm a payment
      const createResponse = await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100.00,
          currency: 'usd',
          orderId: 'test-refund-order',
        });

      const paymentIntentId = createResponse.body.payment_intent.id;

      const response = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId,
          amount: 50.00,
          reason: 'requested_by_customer',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.refund).toBeDefined();
      expect(response.body.refund.amount).toBe(50.00);
    });

    it('should reject refund for invalid payment intent', async () => {
      await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'invalid-id',
          amount: 50.00,
        })
        .expect(500);
    });
  });

  describe('Webhook Tests', () => {
    it('should handle Stripe webhook events', async () => {
      const webhookEvent = {
        id: 'evt_test_webhook',
        object: 'event',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_payment_intent',
            amount: 1000,
            currency: 'usd',
            metadata: {
              order_id: 'test-webhook-order',
              user_id: testUser.id,
            },
          },
        },
      };

      const response = await request(app)
        .post('/api/payments/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(webhookEvent)
        .expect(200);

      expect(response.body.received).toBe(true);
    });

    it('should handle PayPal webhook events', async () => {
      const webhookEvent = {
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'test_paypal_capture',
          custom_id: 'test-paypal-order',
          status: 'COMPLETED',
        },
      };

      const response = await request(app)
        .post('/api/payments/webhooks/paypal')
        .send(webhookEvent)
        .expect(200);

      expect(response.body.received).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle payment service errors gracefully', async () => {
      // Mock payment service to throw error
      jest.spyOn(PaymentService, 'createStripePaymentIntent').mockRejectedValue(
        new Error('Payment service unavailable')
      );

      const paymentData = {
        amount: 100.00,
        currency: 'usd',
        orderId: 'test-error-order',
      };

      await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send(paymentData)
        .expect(500);

      jest.restoreAllMocks();
    });

    it('should handle database errors gracefully', async () => {
      // Mock database to throw error
      jest.spyOn(PaymentService, 'getOrderPaymentStatus').mockRejectedValue(
        new Error('Database connection failed')
      );

      await request(app)
        .get('/api/payments/order/test-order/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      jest.restoreAllMocks();
    });
  });

  describe('Security Tests', () => {
    it('should prevent unauthorized access to payment endpoints', async () => {
      const endpoints = [
        { method: 'POST', path: '/api/payments/stripe/create-intent' },
        { method: 'POST', path: '/api/payments/paypal/create-order' },
        { method: 'GET', path: '/api/payments/payment-methods' },
        { method: 'POST', path: '/api/payments/process' },
      ];

      for (const endpoint of endpoints) {
        await request(app)
          [endpoint.method.toLowerCase()](endpoint.path)
          .expect(401);
      }
    });

    it('should validate payment amounts', async () => {
      const invalidAmounts = [-100, 0, 999999999];

      for (const amount of invalidAmounts) {
        await request(app)
          .post('/api/payments/stripe/create-intent')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount,
            currency: 'usd',
            orderId: 'test-validation',
          })
          .expect(400);
      }
    });

    it('should prevent SQL injection in order ID', async () => {
      const maliciousOrderId = "'; DROP TABLE orders; --";

      await request(app)
        .get(`/api/payments/order/${encodeURIComponent(maliciousOrderId)}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404); // Should not cause SQL injection
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent payment requests', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app)
            .post('/api/payments/stripe/create-intent')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              amount: 100.00,
              currency: 'usd',
              orderId: `concurrent-order-${i}`,
            })
        );
      }

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should respond within acceptable time limits', async () => {
      const startTime = Date.now();

      await request(app)
        .post('/api/payments/stripe/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100.00,
          currency: 'usd',
          orderId: 'performance-test',
        })
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });
}); 
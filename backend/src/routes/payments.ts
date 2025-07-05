/**
 * Payment Routes
 * Handles payment processing endpoints
 */

import { Router, Request, Response } from 'express';
import { PaymentService } from '../services/payment';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import Stripe from 'stripe';

const router = Router();

// Initialize Stripe for webhook verification
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

/**
 * Create payment intent for Stripe
 */
router.post('/stripe/create-intent', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'usd', orderId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const paymentIntent = await PaymentService.createStripePaymentIntent(amount, currency, {
      order_id: orderId,
      user_id: req.user.id,
    });

    logger.info('Payment intent created', {
      user_id: req.user.id,
      order_id: orderId,
      payment_intent_id: paymentIntent.id,
    });

    res.json({
      success: true,
      payment_intent: paymentIntent,
    });
  } catch (error) {
    logger.error('Failed to create payment intent', { error, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

/**
 * Confirm Stripe payment
 */
router.post('/stripe/confirm', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { paymentIntentId, paymentMethodId } = req.body;

    if (!paymentIntentId || !paymentMethodId) {
      return res.status(400).json({ error: 'Payment intent ID and payment method ID are required' });
    }

    const paymentIntent = await PaymentService.confirmStripePayment(paymentIntentId, paymentMethodId);

    logger.info('Payment confirmed', {
      user_id: req.user.id,
      payment_intent_id: paymentIntentId,
      status: paymentIntent.status,
    });

    res.json({
      success: true,
      payment_intent: paymentIntent,
    });
  } catch (error) {
    logger.error('Failed to confirm payment', { error, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

/**
 * Create PayPal order
 */
router.post('/paypal/create-order', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { amount, currency = 'USD', orderId } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const paypalOrder = await PaymentService.createPayPalOrder(amount, currency, orderId);

    logger.info('PayPal order created', {
      user_id: req.user.id,
      order_id: orderId,
      paypal_order_id: paypalOrder.orderId,
    });

    res.json({
      success: true,
      paypal_order: paypalOrder,
    });
  } catch (error) {
    logger.error('Failed to create PayPal order', { error, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to create PayPal order' });
  }
});

/**
 * Capture PayPal payment
 */
router.post('/paypal/capture', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'PayPal order ID is required' });
    }

    const capture = await PaymentService.capturePayPalPayment(orderId);

    logger.info('PayPal payment captured', {
      user_id: req.user.id,
      paypal_order_id: orderId,
      transaction_id: capture.transactionId,
    });

    res.json({
      success: true,
      capture,
    });
  } catch (error) {
    logger.error('Failed to capture PayPal payment', { error, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to capture PayPal payment' });
  }
});

/**
 * Process order payment
 */
router.post('/process', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId, amount, paymentMethod, paymentData } = req.body;

    if (!orderId || !amount || !paymentMethod) {
      return res.status(400).json({ 
        error: 'Order ID, amount, and payment method are required' 
      });
    }

    const orderPayment = await PaymentService.processOrderPayment(
      orderId,
      amount,
      paymentMethod,
      paymentData
    );

    logger.info('Order payment processed', {
      user_id: req.user.id,
      order_id: orderId,
      payment_method: paymentMethod,
      amount,
    });

    res.json({
      success: true,
      order_payment: orderPayment,
    });
  } catch (error) {
    logger.error('Failed to process order payment', { error, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

/**
 * Get payment methods for customer
 */
router.get('/payment-methods', authenticateToken, async (req: Request, res: Response) => {
  try {
    const paymentMethods = await PaymentService.getCustomerPaymentMethods(req.user.id);

    res.json({
      success: true,
      payment_methods: paymentMethods,
    });
  } catch (error) {
    logger.error('Failed to get payment methods', { error, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to retrieve payment methods' });
  }
});

/**
 * Save payment method
 */
router.post('/payment-methods', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { paymentMethodId } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ error: 'Payment method ID is required' });
    }

    const paymentMethod = await PaymentService.savePaymentMethod(req.user.id, paymentMethodId);

    logger.info('Payment method saved', {
      user_id: req.user.id,
      payment_method_id: paymentMethod.id,
    });

    res.json({
      success: true,
      payment_method: paymentMethod,
    });
  } catch (error) {
    logger.error('Failed to save payment method', { error, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to save payment method' });
  }
});

/**
 * Delete payment method
 */
router.delete('/payment-methods/:paymentMethodId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { paymentMethodId } = req.params;

    await PaymentService.deletePaymentMethod(paymentMethodId);

    logger.info('Payment method deleted', {
      user_id: req.user.id,
      payment_method_id: paymentMethodId,
    });

    res.json({
      success: true,
      message: 'Payment method deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete payment method', { error, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

/**
 * Get payment status for order
 */
router.get('/order/:orderId/status', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const paymentStatus = await PaymentService.getOrderPaymentStatus(orderId);

    if (!paymentStatus) {
      return res.status(404).json({ error: 'Payment not found for this order' });
    }

    res.json({
      success: true,
      payment_status: paymentStatus,
    });
  } catch (error) {
    logger.error('Failed to get payment status', { error, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to retrieve payment status' });
  }
});

/**
 * Refund payment
 */
router.post('/refund', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { paymentIntentId, amount, reason = 'requested_by_customer' } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ error: 'Payment intent ID is required' });
    }

    const refund = await PaymentService.refundPayment(paymentIntentId, amount, reason);

    logger.info('Payment refunded', {
      user_id: req.user.id,
      payment_intent_id: paymentIntentId,
      refund_id: refund.id,
      amount: refund.amount,
    });

    res.json({
      success: true,
      refund,
    });
  } catch (error) {
    logger.error('Failed to refund payment', { error, user_id: req.user.id });
    res.status(500).json({ error: 'Failed to process refund' });
  }
});

/**
 * Stripe webhook handler
 */
router.post('/webhooks/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    logger.error('Webhook signature verification failed', { error: err });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error', { error, event_type: event.type });
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * PayPal webhook handler
 */
router.post('/webhooks/paypal', async (req: Request, res: Response) => {
  try {
    const event = req.body;

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePayPalPaymentCompleted(event.resource);
        break;
      case 'PAYMENT.CAPTURE.DENIED':
        await handlePayPalPaymentDenied(event.resource);
        break;
      case 'PAYMENT.CAPTURE.REFUNDED':
        await handlePayPalPaymentRefunded(event.resource);
        break;
      default:
        logger.info(`Unhandled PayPal event type: ${event.event_type}`);
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('PayPal webhook handler error', { error });
    res.status(500).json({ error: 'PayPal webhook handler failed' });
  }
});

/**
 * Handle successful Stripe payment
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  try {
    const orderId = paymentIntent.metadata.order_id;
    const userId = paymentIntent.metadata.user_id;

    if (orderId) {
      await PaymentService.updatePaymentStatus(orderId, 'succeeded', paymentIntent.id);
      
      // Update order status
      await updateOrderStatus(orderId, 'paid');
      
      // Send confirmation email
      await sendPaymentConfirmationEmail(userId, orderId, paymentIntent.amount / 100);
    }

    logger.info('Payment intent succeeded', {
      payment_intent_id: paymentIntent.id,
      order_id: orderId,
      user_id: userId,
    });
  } catch (error) {
    logger.error('Failed to handle payment intent succeeded', { error });
  }
}

/**
 * Handle failed Stripe payment
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    const orderId = paymentIntent.metadata.order_id;
    const userId = paymentIntent.metadata.user_id;

    if (orderId) {
      await PaymentService.updatePaymentStatus(orderId, 'failed');
      await updateOrderStatus(orderId, 'payment_failed');
      
      // Send failure notification
      await sendPaymentFailureEmail(userId, orderId);
    }

    logger.info('Payment intent failed', {
      payment_intent_id: paymentIntent.id,
      order_id: orderId,
      user_id: userId,
    });
  } catch (error) {
    logger.error('Failed to handle payment intent failed', { error });
  }
}

/**
 * Handle Stripe charge refund
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  try {
    const orderId = charge.metadata.order_id;
    const userId = charge.metadata.user_id;

    if (orderId) {
      await updateOrderStatus(orderId, 'refunded');
      await sendRefundConfirmationEmail(userId, orderId, charge.amount_refunded / 100);
    }

    logger.info('Charge refunded', {
      charge_id: charge.id,
      order_id: orderId,
      user_id: userId,
    });
  } catch (error) {
    logger.error('Failed to handle charge refunded', { error });
  }
}

/**
 * Handle successful PayPal payment
 */
async function handlePayPalPaymentCompleted(resource: any) {
  try {
    const orderId = resource.custom_id;
    const transactionId = resource.id;

    if (orderId) {
      await PaymentService.updatePaymentStatus(orderId, 'succeeded', transactionId);
      await updateOrderStatus(orderId, 'paid');
    }

    logger.info('PayPal payment completed', {
      transaction_id: transactionId,
      order_id: orderId,
    });
  } catch (error) {
    logger.error('Failed to handle PayPal payment completed', { error });
  }
}

/**
 * Handle denied PayPal payment
 */
async function handlePayPalPaymentDenied(resource: any) {
  try {
    const orderId = resource.custom_id;

    if (orderId) {
      await PaymentService.updatePaymentStatus(orderId, 'failed');
      await updateOrderStatus(orderId, 'payment_failed');
    }

    logger.info('PayPal payment denied', {
      transaction_id: resource.id,
      order_id: orderId,
    });
  } catch (error) {
    logger.error('Failed to handle PayPal payment denied', { error });
  }
}

/**
 * Handle PayPal payment refund
 */
async function handlePayPalPaymentRefunded(resource: any) {
  try {
    const orderId = resource.custom_id;

    if (orderId) {
      await updateOrderStatus(orderId, 'refunded');
    }

    logger.info('PayPal payment refunded', {
      transaction_id: resource.id,
      order_id: orderId,
    });
  } catch (error) {
    logger.error('Failed to handle PayPal payment refunded', { error });
  }
}

/**
 * Update order status in database
 */
async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    const query = `
      UPDATE orders 
      SET status = $1, updated_at = $2
      WHERE id = $3
    `;

    await pool.query(query, [status, new Date(), orderId]);
    await pool.end();
  } catch (error) {
    logger.error('Failed to update order status', { error, orderId });
  }
}

/**
 * Send payment confirmation email
 */
async function sendPaymentConfirmationEmail(userId: string, orderId: string, amount: number): Promise<void> {
  try {
    // Implementation would use email service
    logger.info('Payment confirmation email sent', {
      user_id: userId,
      order_id: orderId,
      amount,
    });
  } catch (error) {
    logger.error('Failed to send payment confirmation email', { error });
  }
}

/**
 * Send payment failure email
 */
async function sendPaymentFailureEmail(userId: string, orderId: string): Promise<void> {
  try {
    // Implementation would use email service
    logger.info('Payment failure email sent', {
      user_id: userId,
      order_id: orderId,
    });
  } catch (error) {
    logger.error('Failed to send payment failure email', { error });
  }
}

/**
 * Send refund confirmation email
 */
async function sendRefundConfirmationEmail(userId: string, orderId: string, amount: number): Promise<void> {
  try {
    // Implementation would use email service
    logger.info('Refund confirmation email sent', {
      user_id: userId,
      order_id: orderId,
      amount,
    });
  } catch (error) {
    logger.error('Failed to send refund confirmation email', { error });
  }
}

export default router; 
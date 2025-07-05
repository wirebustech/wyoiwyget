/**
 * Payment Service
 * Handles payment processing with Stripe and PayPal integration
 */

import Stripe from 'stripe';
import { PayPalClient } from '@paypal/checkout-server-sdk';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

// Initialize PayPal
const paypalClient = new PayPalClient(
  new PayPalClient.Environment(
    process.env.PAYPAL_CLIENT_ID!,
    process.env.PAYPAL_CLIENT_SECRET!,
    process.env.NODE_ENV === 'production' 
      ? 'https://www.paypal.com/sdk' 
      : 'https://www.sandbox.paypal.com/sdk'
  )
);

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: string;
  client_secret?: string;
  payment_method_types: string[];
}

export interface PaymentMethod {
  id: string;
  type: string;
  card?: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
  billing_details: {
    name: string;
    email: string;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
}

export interface OrderPayment {
  order_id: string;
  payment_intent_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  created_at: Date;
  updated_at: Date;
}

export class PaymentService {
  /**
   * Create a payment intent with Stripe
   */
  static async createStripePaymentIntent(
    amount: number,
    currency: string = 'usd',
    metadata: Record<string, string> = {}
  ): Promise<PaymentIntent> {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      logger.info('Stripe payment intent created', {
        payment_intent_id: paymentIntent.id,
        amount,
        currency,
      });

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        client_secret: paymentIntent.client_secret!,
        payment_method_types: paymentIntent.payment_method_types,
      };
    } catch (error) {
      logger.error('Failed to create Stripe payment intent', { error });
      throw new Error('Payment intent creation failed');
    }
  }

  /**
   * Confirm a Stripe payment intent
   */
  static async confirmStripePayment(
    paymentIntentId: string,
    paymentMethodId: string
  ): Promise<PaymentIntent> {
    try {
      const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });

      logger.info('Stripe payment confirmed', {
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
      });

      return {
        id: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        payment_method_types: paymentIntent.payment_method_types,
      };
    } catch (error) {
      logger.error('Failed to confirm Stripe payment', { error, paymentIntentId });
      throw new Error('Payment confirmation failed');
    }
  }

  /**
   * Create a PayPal order
   */
  static async createPayPalOrder(
    amount: number,
    currency: string = 'USD',
    orderId: string
  ): Promise<{ orderId: string; approvalUrl: string }> {
    try {
      const request = new PayPalClient.orders.OrdersCreateRequest();
      request.prefer("return=representation");
      request.requestBody({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderId,
          amount: {
            currency_code: currency,
            value: amount.toFixed(2),
          },
        }],
        application_context: {
          return_url: `${process.env.FRONTEND_URL}/checkout/success`,
          cancel_url: `${process.env.FRONTEND_URL}/checkout/cancel`,
        },
      });

      const order = await paypalClient.execute(request);

      logger.info('PayPal order created', {
        paypal_order_id: order.result.id,
        amount,
        currency,
      });

      return {
        orderId: order.result.id!,
        approvalUrl: order.result.links?.find(link => link.rel === 'approve')?.href!,
      };
    } catch (error) {
      logger.error('Failed to create PayPal order', { error });
      throw new Error('PayPal order creation failed');
    }
  }

  /**
   * Capture a PayPal payment
   */
  static async capturePayPalPayment(orderId: string): Promise<{ status: string; transactionId: string }> {
    try {
      const request = new PayPalClient.orders.OrdersCaptureRequest(orderId);
      request.requestBody({});

      const capture = await paypalClient.execute(request);

      logger.info('PayPal payment captured', {
        paypal_order_id: orderId,
        transaction_id: capture.result.purchase_units?.[0]?.payments?.captures?.[0]?.id,
      });

      return {
        status: capture.result.status!,
        transactionId: capture.result.purchase_units?.[0]?.payments?.captures?.[0]?.id!,
      };
    } catch (error) {
      logger.error('Failed to capture PayPal payment', { error, orderId });
      throw new Error('PayPal payment capture failed');
    }
  }

  /**
   * Process payment for an order
   */
  static async processOrderPayment(
    orderId: string,
    amount: number,
    paymentMethod: 'stripe' | 'paypal',
    paymentData: any
  ): Promise<OrderPayment> {
    try {
      let paymentIntentId: string;
      let status: string;

      if (paymentMethod === 'stripe') {
        const paymentIntent = await this.createStripePaymentIntent(amount, 'usd', {
          order_id: orderId,
        });
        paymentIntentId = paymentIntent.id;
        status = paymentIntent.status;
      } else {
        const paypalOrder = await this.createPayPalOrder(amount, 'USD', orderId);
        paymentIntentId = paypalOrder.orderId;
        status = 'pending';
      }

      const orderPayment: OrderPayment = {
        order_id: orderId,
        payment_intent_id: paymentIntentId,
        amount,
        currency: paymentMethod === 'stripe' ? 'usd' : 'USD',
        status,
        payment_method: paymentMethod,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Save to database
      await this.saveOrderPayment(orderPayment);

      logger.info('Order payment processed', {
        order_id: orderId,
        payment_intent_id: paymentIntentId,
        amount,
        payment_method: paymentMethod,
      });

      return orderPayment;
    } catch (error) {
      logger.error('Failed to process order payment', { error, orderId });
      throw new Error('Payment processing failed');
    }
  }

  /**
   * Refund a payment
   */
  static async refundPayment(
    paymentIntentId: string,
    amount?: number,
    reason: 'requested_by_customer' | 'duplicate' | 'fraudulent' = 'requested_by_customer'
  ): Promise<{ id: string; status: string; amount: number }> {
    try {
      const refundData: any = { reason };
      if (amount) {
        refundData.amount = Math.round(amount * 100);
      }

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        ...refundData,
      });

      logger.info('Payment refunded', {
        refund_id: refund.id,
        payment_intent_id: paymentIntentId,
        amount: refund.amount / 100,
      });

      return {
        id: refund.id,
        status: refund.status,
        amount: refund.amount / 100,
      };
    } catch (error) {
      logger.error('Failed to refund payment', { error, paymentIntentId });
      throw new Error('Payment refund failed');
    }
  }

  /**
   * Get payment methods for a customer
   */
  static async getCustomerPaymentMethods(customerId: string): Promise<PaymentMethod[]> {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          exp_month: pm.card.exp_month,
          exp_year: pm.card.exp_year,
        } : undefined,
        billing_details: {
          name: pm.billing_details.name || '',
          email: pm.billing_details.email || '',
          address: {
            line1: pm.billing_details.address?.line1 || '',
            line2: pm.billing_details.address?.line2 || '',
            city: pm.billing_details.address?.city || '',
            state: pm.billing_details.address?.state || '',
            postal_code: pm.billing_details.address?.postal_code || '',
            country: pm.billing_details.address?.country || '',
          },
        },
      }));
    } catch (error) {
      logger.error('Failed to get customer payment methods', { error, customerId });
      throw new Error('Failed to retrieve payment methods');
    }
  }

  /**
   * Save payment method for a customer
   */
  static async savePaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<PaymentMethod> {
    try {
      const paymentMethod = await stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId,
      });

      logger.info('Payment method saved', {
        customer_id: customerId,
        payment_method_id: paymentMethod.id,
      });

      return {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: paymentMethod.card ? {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          exp_month: paymentMethod.card.exp_month,
          exp_year: paymentMethod.card.exp_year,
        } : undefined,
        billing_details: {
          name: paymentMethod.billing_details.name || '',
          email: paymentMethod.billing_details.email || '',
          address: {
            line1: paymentMethod.billing_details.address?.line1 || '',
            line2: paymentMethod.billing_details.address?.line2 || '',
            city: paymentMethod.billing_details.address?.city || '',
            state: paymentMethod.billing_details.address?.state || '',
            postal_code: paymentMethod.billing_details.address?.postal_code || '',
            country: paymentMethod.billing_details.address?.country || '',
          },
        },
      };
    } catch (error) {
      logger.error('Failed to save payment method', { error, customerId });
      throw new Error('Failed to save payment method');
    }
  }

  /**
   * Delete a payment method
   */
  static async deletePaymentMethod(paymentMethodId: string): Promise<void> {
    try {
      await stripe.paymentMethods.detach(paymentMethodId);

      logger.info('Payment method deleted', {
        payment_method_id: paymentMethodId,
      });
    } catch (error) {
      logger.error('Failed to delete payment method', { error, paymentMethodId });
      throw new Error('Failed to delete payment method');
    }
  }

  /**
   * Save order payment to database
   */
  private static async saveOrderPayment(orderPayment: OrderPayment): Promise<void> {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });

      const query = `
        INSERT INTO order_payments (
          order_id, payment_intent_id, amount, currency, status, payment_method, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (order_id) DO UPDATE SET
          payment_intent_id = EXCLUDED.payment_intent_id,
          amount = EXCLUDED.amount,
          currency = EXCLUDED.currency,
          status = EXCLUDED.status,
          payment_method = EXCLUDED.payment_method,
          updated_at = EXCLUDED.updated_at
      `;

      await pool.query(query, [
        orderPayment.order_id,
        orderPayment.payment_intent_id,
        orderPayment.amount,
        orderPayment.currency,
        orderPayment.status,
        orderPayment.payment_method,
        orderPayment.created_at,
        orderPayment.updated_at,
      ]);

      await pool.end();
    } catch (error) {
      logger.error('Failed to save order payment to database', { error });
      throw new Error('Database operation failed');
    }
  }

  /**
   * Get payment status for an order
   */
  static async getOrderPaymentStatus(orderId: string): Promise<OrderPayment | null> {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });

      const query = `
        SELECT * FROM order_payments WHERE order_id = $1
      `;

      const result = await pool.query(query, [orderId]);
      await pool.end();

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        order_id: row.order_id,
        payment_intent_id: row.payment_intent_id,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        payment_method: row.payment_method,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } catch (error) {
      logger.error('Failed to get order payment status', { error, orderId });
      throw new Error('Failed to retrieve payment status');
    }
  }

  /**
   * Update payment status
   */
  static async updatePaymentStatus(
    orderId: string,
    status: string,
    transactionId?: string
  ): Promise<void> {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });

      const query = `
        UPDATE order_payments 
        SET status = $1, updated_at = $2
        WHERE order_id = $3
      `;

      await pool.query(query, [status, new Date(), orderId]);
      await pool.end();

      logger.info('Payment status updated', {
        order_id: orderId,
        status,
        transaction_id: transactionId,
      });
    } catch (error) {
      logger.error('Failed to update payment status', { error, orderId });
      throw new Error('Failed to update payment status');
    }
  }
} 
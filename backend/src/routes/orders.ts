import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const addToCartSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  variantId: z.string().uuid().optional(),
});

const updateCartItemSchema = z.object({
  quantity: z.number().min(1, 'Quantity must be at least 1'),
});

const checkoutSchema = z.object({
  shippingAddress: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().min(1, 'ZIP code is required'),
    country: z.string().min(1, 'Country is required'),
    phone: z.string().min(1, 'Phone number is required'),
  }),
  billingAddress: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    street: z.string().min(1, 'Street address is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().min(1, 'ZIP code is required'),
    country: z.string().min(1, 'Country is required'),
  }),
  paymentMethod: z.object({
    type: z.enum(['card', 'paypal', 'apple_pay']),
    token: z.string().optional(),
    cardLast4: z.string().optional(),
    cardBrand: z.string().optional(),
  }),
  useShippingForBilling: z.boolean().default(true),
  notes: z.string().optional(),
});

// Get user's cart
router.get('/cart', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const cart = await prisma.cart.findFirst({
    where: { userId: req.user.id },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                take: 1,
                orderBy: { isPrimary: 'desc' },
              },
              platform: true,
            },
          },
          variant: true,
        },
      },
    },
  });

  if (!cart) {
    // Create empty cart if it doesn't exist
    const newCart = await prisma.cart.create({
      data: { userId: req.user.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  take: 1,
                  orderBy: { isPrimary: 'desc' },
                },
                platform: true,
              },
            },
            variant: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      data: { cart: newCart },
    });
  }

  res.json({
    success: true,
    data: { cart },
  });
}));

// Add item to cart
router.post('/cart/items',
  validateRequest(addToCartSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { productId, quantity, variantId } = req.body;

    // Get or create cart
    let cart = await prisma.cart.findFirst({
      where: { userId: req.user.id },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: req.user.id },
      });
    }

    // Check if product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Check if variant exists (if provided)
    if (variantId) {
      const variant = await prisma.productVariant.findFirst({
        where: {
          id: variantId,
          productId,
        },
      });

      if (!variant) {
        return res.status(404).json({
          success: false,
          error: 'Product variant not found',
        });
      }
    }

    // Check if item already exists in cart
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
      },
    });

    if (existingItem) {
      // Update quantity
      const updatedItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
        include: {
          product: {
            include: {
              images: {
                take: 1,
                orderBy: { isPrimary: 'desc' },
              },
              platform: true,
            },
          },
          variant: true,
        },
      });

      logger.info('Cart item quantity updated', {
        userId: req.user.id,
        productId,
        quantity: updatedItem.quantity,
      });

      return res.json({
        success: true,
        data: { cartItem: updatedItem },
      });
    }

    // Add new item to cart
    const cartItem = await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        variantId: variantId || null,
        quantity,
        price: product.price,
      },
      include: {
        product: {
          include: {
            images: {
              take: 1,
              orderBy: { isPrimary: 'desc' },
            },
            platform: true,
          },
        },
        variant: true,
      },
    });

    logger.info('Item added to cart', {
      userId: req.user.id,
      productId,
      quantity,
    });

    res.status(201).json({
      success: true,
      data: { cartItem },
    });
  })
);

// Update cart item quantity
router.put('/cart/items/:itemId',
  validateRequest(updateCartItemSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { itemId } = req.params;
    const { quantity } = req.body;

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId: req.user.id },
      },
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        error: 'Cart item not found',
      });
    }

    if (quantity === 0) {
      // Remove item if quantity is 0
      await prisma.cartItem.delete({
        where: { id: itemId },
      });

      logger.info('Cart item removed', {
        userId: req.user.id,
        itemId,
      });

      return res.json({
        success: true,
        message: 'Item removed from cart',
      });
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
      include: {
        product: {
          include: {
            images: {
              take: 1,
              orderBy: { isPrimary: 'desc' },
            },
            platform: true,
          },
        },
        variant: true,
      },
    });

    logger.info('Cart item quantity updated', {
      userId: req.user.id,
      itemId,
      quantity,
    });

    res.json({
      success: true,
      data: { cartItem: updatedItem },
    });
  })
);

// Remove item from cart
router.delete('/cart/items/:itemId', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const { itemId } = req.params;

  const cartItem = await prisma.cartItem.findFirst({
    where: {
      id: itemId,
      cart: { userId: req.user.id },
    },
  });

  if (!cartItem) {
    return res.status(404).json({
      success: false,
      error: 'Cart item not found',
    });
  }

  await prisma.cartItem.delete({
    where: { id: itemId },
  });

  logger.info('Cart item removed', {
    userId: req.user.id,
    itemId,
  });

  res.json({
    success: true,
    message: 'Item removed from cart',
  });
}));

// Clear cart
router.delete('/cart', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const cart = await prisma.cart.findFirst({
    where: { userId: req.user.id },
  });

  if (cart) {
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });
  }

  logger.info('Cart cleared', {
    userId: req.user.id,
  });

  res.json({
    success: true,
    message: 'Cart cleared successfully',
  });
}));

// Checkout
router.post('/checkout',
  validateRequest(checkoutSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const {
      shippingAddress,
      billingAddress,
      paymentMethod,
      useShippingForBilling,
      notes,
    } = req.body;

    // Get user's cart
    const cart = await prisma.cart.findFirst({
      where: { userId: req.user.id },
      include: {
        items: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cart is empty',
      });
    }

    // Calculate totals
    const subtotal = cart.items.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);

    const shippingCost = 0; // TODO: Calculate based on address
    const tax = subtotal * 0.1; // TODO: Calculate based on location
    const total = subtotal + shippingCost + tax;

    // Create order
    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        status: 'pending',
        subtotal,
        shippingCost,
        tax,
        total,
        notes,
        shippingAddress: useShippingForBilling ? shippingAddress : shippingAddress,
        billingAddress: useShippingForBilling ? shippingAddress : billingAddress,
        paymentMethod,
        items: {
          create: cart.items.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
            productName: item.product.name,
            productImage: item.product.images?.[0]?.url,
          })),
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  take: 1,
                  orderBy: { isPrimary: 'desc' },
                },
              },
            },
          },
        },
      },
    });

    // Clear cart
    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    // TODO: Process payment
    // TODO: Send confirmation email
    // TODO: Update inventory

    logger.info('Order created', {
      userId: req.user.id,
      orderId: order.id,
      total: order.total,
    });

    res.status(201).json({
      success: true,
      data: { order },
    });
  })
);

// Get order by ID
router.get('/:orderId', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const { orderId } = req.params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user.id,
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { isPrimary: 'desc' },
              },
            },
          },
        },
      },
      shippingAddress: true,
      billingAddress: true,
    },
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found',
    });
  }

  res.json({
    success: true,
    data: { order },
  });
}));

// Cancel order
router.post('/:orderId/cancel', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const { orderId } = req.params;

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: req.user.id,
      status: { in: ['pending', 'confirmed'] },
    },
  });

  if (!order) {
    return res.status(404).json({
      success: false,
      error: 'Order not found or cannot be cancelled',
    });
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'cancelled' },
  });

  logger.info('Order cancelled', {
    userId: req.user.id,
    orderId,
  });

  res.json({
    success: true,
    data: { order: updatedOrder },
  });
}));

export default router; 
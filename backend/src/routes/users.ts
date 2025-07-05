import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
});

const updatePreferencesSchema = z.object({
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
    marketing: z.boolean().optional(),
  }).optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  language: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  privacy: z.object({
    profileVisibility: z.enum(['public', 'private', 'friends']).optional(),
    showEmail: z.boolean().optional(),
    showPhone: z.boolean().optional(),
  }).optional(),
});

const updateAvatarSchema = z.object({
  avatarId: z.string().uuid(),
  isActive: z.boolean().optional(),
  preferences: z.object({
    style: z.string().optional(),
    hairStyle: z.string().optional(),
    skinTone: z.string().optional(),
    eyeColor: z.string().optional(),
    hairColor: z.string().optional(),
  }).optional(),
});

// Get user profile
router.get('/profile', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      preferences: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  res.json({
    success: true,
    data: { user },
  });
}));

// Update user profile
router.put('/profile',
  validateRequest(updateProfileSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const updateData: any = {};
    
    if (req.body.firstName !== undefined) updateData.firstName = req.body.firstName;
    if (req.body.lastName !== undefined) updateData.lastName = req.body.lastName;
    if (req.body.phone !== undefined) updateData.phone = req.body.phone;
    if (req.body.dateOfBirth !== undefined) {
      updateData.dateOfBirth = req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null;
    }
    if (req.body.gender !== undefined) updateData.gender = req.body.gender;
    if (req.body.address !== undefined) updateData.address = req.body.address;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        preferences: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    logger.info('User profile updated', {
      userId: req.user.id,
      updatedFields: Object.keys(updateData),
    });

    res.json({
      success: true,
      data: { user },
    });
  })
);

// Update user preferences
router.put('/preferences',
  validateRequest(updatePreferencesSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { preferences: true },
    });

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const currentPreferences = currentUser.preferences || {};
    const updatedPreferences = {
      ...currentPreferences,
      ...req.body,
    };

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { preferences: updatedPreferences },
      select: {
        id: true,
        preferences: true,
        updatedAt: true,
      },
    });

    logger.info('User preferences updated', {
      userId: req.user.id,
      updatedPreferences: Object.keys(req.body),
    });

    res.json({
      success: true,
      data: { user },
    });
  })
);

// Get user avatars
router.get('/avatars', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const avatars = await prisma.avatar.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      images: {
        orderBy: { isPrimary: 'desc' },
      },
    },
  });

  res.json({
    success: true,
    data: { avatars },
  });
}));

// Update avatar
router.put('/avatars/:avatarId',
  validateRequest(updateAvatarSchema),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const { avatarId } = req.params;
    const updateData: any = {};

    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
    if (req.body.preferences !== undefined) updateData.preferences = req.body.preferences;

    const avatar = await prisma.avatar.update({
      where: {
        id: avatarId,
        userId: req.user.id, // Ensure user owns the avatar
      },
      data: updateData,
      include: {
        images: {
          orderBy: { isPrimary: 'desc' },
        },
      },
    });

    if (!avatar) {
      return res.status(404).json({
        success: false,
        error: 'Avatar not found',
      });
    }

    logger.info('Avatar updated', {
      userId: req.user.id,
      avatarId,
      updatedFields: Object.keys(updateData),
    });

    res.json({
      success: true,
      data: { avatar },
    });
  })
);

// Delete avatar
router.delete('/avatars/:avatarId', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const { avatarId } = req.params;

  const avatar = await prisma.avatar.findFirst({
    where: {
      id: avatarId,
      userId: req.user.id,
    },
  });

  if (!avatar) {
    return res.status(404).json({
      success: false,
      error: 'Avatar not found',
    });
  }

  await prisma.avatar.delete({
    where: { id: avatarId },
  });

  logger.info('Avatar deleted', {
    userId: req.user.id,
    avatarId,
  });

  res.json({
    success: true,
    message: 'Avatar deleted successfully',
  });
}));

// Get user orders
router.get('/orders', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
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
    }),
    prisma.order.count({
      where: { userId: req.user.id },
    }),
  ]);

  const totalPages = Math.ceil(total / Number(limit));

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    },
  });
}));

// Get user order by ID
router.get('/orders/:orderId', asyncHandler(async (req, res) => {
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

// Get user wishlist
router.get('/wishlist', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const { page = 1, limit = 20 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const [wishlistItems, total] = await Promise.all([
    prisma.wishlistItem.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
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
      },
    }),
    prisma.wishlistItem.count({
      where: { userId: req.user.id },
    }),
  ]);

  const totalPages = Math.ceil(total / Number(limit));

  res.json({
    success: true,
    data: {
      wishlistItems,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages,
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
    },
  });
}));

// Add item to wishlist
router.post('/wishlist', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const { productId } = req.body;

  if (!productId) {
    return res.status(400).json({
      success: false,
      error: 'Product ID is required',
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

  // Check if already in wishlist
  const existingItem = await prisma.wishlistItem.findFirst({
    where: {
      userId: req.user.id,
      productId,
    },
  });

  if (existingItem) {
    return res.status(400).json({
      success: false,
      error: 'Product already in wishlist',
    });
  }

  const wishlistItem = await prisma.wishlistItem.create({
    data: {
      userId: req.user.id,
      productId,
    },
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
  });

  logger.info('Item added to wishlist', {
    userId: req.user.id,
    productId,
  });

  res.status(201).json({
    success: true,
    data: { wishlistItem },
  });
}));

// Remove item from wishlist
router.delete('/wishlist/:productId', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const { productId } = req.params;

  const wishlistItem = await prisma.wishlistItem.findFirst({
    where: {
      userId: req.user.id,
      productId,
    },
  });

  if (!wishlistItem) {
    return res.status(404).json({
      success: false,
      error: 'Wishlist item not found',
    });
  }

  await prisma.wishlistItem.delete({
    where: { id: wishlistItem.id },
  });

  logger.info('Item removed from wishlist', {
    userId: req.user.id,
    productId,
  });

  res.json({
    success: true,
    message: 'Item removed from wishlist',
  });
}));

// Delete user account
router.delete('/account', asyncHandler(async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  // Soft delete - mark as inactive
  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  logger.info('User account deactivated', {
    userId: req.user.id,
  });

  res.json({
    success: true,
    message: 'Account deactivated successfully',
  });
}));

export default router; 
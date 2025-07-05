import { Router } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { validateRequest } from '../middleware/validation';
import { optionalAuth } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Validation schemas
const searchProductsSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  platform: z.string().optional(),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
  minRating: z.number().min(0).max(5).optional(),
  inStock: z.boolean().optional(),
  sortBy: z.enum(['price', 'rating', 'newest', 'popularity']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
});

const getProductSchema = z.object({
  id: z.string().uuid(),
});

const compareProductsSchema = z.object({
  productIds: z.array(z.string().uuid()).min(2).max(5),
});

// Search and filter products
router.get('/search',
  optionalAuth,
  validateRequest(searchProductsSchema),
  asyncHandler(async (req, res) => {
    const {
      query,
      category,
      brand,
      platform,
      minPrice,
      maxPrice,
      minRating,
      inStock,
      sortBy = 'newest',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    // Build where clause
    const where: any = {
      isActive: true,
    };

    if (query) {
      where.OR = [
        { name: { contains: query as string, mode: 'insensitive' } },
        { description: { contains: query as string, mode: 'insensitive' } },
        { brand: { contains: query as string, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (brand) {
      where.brand = brand;
    }

    if (platform) {
      where.platform = platform;
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = Number(minPrice);
      if (maxPrice !== undefined) where.price.lte = Number(maxPrice);
    }

    if (minRating !== undefined) {
      where.rating = { gte: Number(minRating) };
    }

    if (inStock !== undefined) {
      where.inStock = inStock === 'true';
    }

    // Build order by clause
    let orderBy: any = {};
    switch (sortBy) {
      case 'price':
        orderBy.price = sortOrder;
        break;
      case 'rating':
        orderBy.rating = sortOrder;
        break;
      case 'popularity':
        orderBy.viewCount = sortOrder;
        break;
      case 'newest':
      default:
        orderBy.createdAt = sortOrder;
        break;
    }

    // Execute query
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: Number(limit),
        include: {
          platform: true,
          images: {
            take: 1,
            orderBy: { isPrimary: 'desc' },
          },
          reviews: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Calculate pagination
    const totalPages = Math.ceil(total / Number(limit));
    const hasNextPage = Number(page) < totalPages;
    const hasPrevPage = Number(page) > 1;

    logger.info('Products searched', {
      query,
      filters: { category, brand, platform, minPrice, maxPrice, minRating, inStock },
      results: products.length,
      total,
      page: Number(page),
      userId: req.user?.id,
    });

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
      },
    });
  })
);

// Get product by ID
router.get('/:id',
  optionalAuth,
  validateRequest(getProductSchema),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        platform: true,
        images: {
          orderBy: { isPrimary: 'desc' },
        },
        reviews: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        specifications: true,
        variants: {
          include: {
            images: true,
          },
        },
        relatedProducts: {
          include: {
            images: {
              take: 1,
              orderBy: { isPrimary: 'desc' },
            },
          },
          take: 8,
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    // Increment view count
    await prisma.product.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    logger.info('Product viewed', {
      productId: id,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      data: { product },
    });
  })
);

// Compare products
router.post('/compare',
  optionalAuth,
  validateRequest(compareProductsSchema),
  asyncHandler(async (req, res) => {
    const { productIds } = req.body;

    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
      include: {
        platform: true,
        images: {
          take: 1,
          orderBy: { isPrimary: 'desc' },
        },
        specifications: true,
      },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        error: 'Some products not found',
      });
    }

    // Group specifications by category for comparison
    const specifications = products.reduce((acc, product) => {
      acc[product.id] = product.specifications.reduce((specs, spec) => {
        if (!specs[spec.category]) {
          specs[spec.category] = {};
        }
        specs[spec.category][spec.name] = spec.value;
        return specs;
      }, {} as any);
      return acc;
    }, {} as any);

    logger.info('Products compared', {
      productIds,
      userId: req.user?.id,
    });

    res.json({
      success: true,
      data: {
        products,
        specifications,
      },
    });
  })
);

// Get product categories
router.get('/categories', asyncHandler(async (req, res) => {
  const categories = await prisma.product.groupBy({
    by: ['category'],
    where: { isActive: true },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
  });

  res.json({
    success: true,
    data: { categories },
  });
}));

// Get product brands
router.get('/brands', asyncHandler(async (req, res) => {
  const brands = await prisma.product.groupBy({
    by: ['brand'],
    where: { isActive: true },
    _count: {
      id: true,
    },
    orderBy: {
      _count: {
        id: 'desc',
      },
    },
  });

  res.json({
    success: true,
    data: { brands },
  });
}));

// Get trending products
router.get('/trending', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const trendingProducts = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [
      { viewCount: 'desc' },
      { rating: 'desc' },
    ],
    take: Number(limit),
    include: {
      platform: true,
      images: {
        take: 1,
        orderBy: { isPrimary: 'desc' },
      },
    },
  });

  res.json({
    success: true,
    data: { products: trendingProducts },
  });
}));

// Get deals and discounts
router.get('/deals', asyncHandler(async (req, res) => {
  const { limit = 10 } = req.query;

  const deals = await prisma.product.findMany({
    where: {
      isActive: true,
      discount: { gt: 0 },
    },
    orderBy: [
      { discount: 'desc' },
      { viewCount: 'desc' },
    ],
    take: Number(limit),
    include: {
      platform: true,
      images: {
        take: 1,
        orderBy: { isPrimary: 'desc' },
      },
    },
  });

  res.json({
    success: true,
    data: { products: deals },
  });
}));

export default router; 
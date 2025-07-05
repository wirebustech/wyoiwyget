// Load test functions for Wyoiwyget
const faker = require('faker');

// Generate random product IDs for testing
function generateProductId() {
  const productIds = [
    '550e8400-e29b-41d4-a716-446655440000',
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440004'
  ];
  return productIds[Math.floor(Math.random() * productIds.length)];
}

// Generate random user data
function generateUserData() {
  return {
    email: faker.internet.email(),
    password: 'TestPassword123!',
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    phone: faker.phone.phoneNumber(),
    dateOfBirth: faker.date.past(30).toISOString().split('T')[0],
    gender: ['male', 'female', 'other'][Math.floor(Math.random() * 3)]
  };
}

// Generate random product search terms
function generateSearchTerm() {
  const searchTerms = [
    'nike', 'adidas', 'shoes', 'running', 'casual',
    'electronics', 'phone', 'laptop', 'accessories',
    'clothing', 'shirt', 'pants', 'dress', 'jacket'
  ];
  return searchTerms[Math.floor(Math.random() * searchTerms.length)];
}

// Generate random category
function generateCategory() {
  const categories = ['shoes', 'clothing', 'electronics', 'accessories', 'home-garden'];
  return categories[Math.floor(Math.random() * categories.length)];
}

// Generate random price range
function generatePriceRange() {
  const ranges = [
    { min: 0, max: 50 },
    { min: 50, max: 100 },
    { min: 100, max: 200 },
    { min: 200, max: 500 },
    { min: 500, max: 1000 }
  ];
  return ranges[Math.floor(Math.random() * ranges.length)];
}

// Generate random order data
function generateOrderData() {
  const range = generatePriceRange();
  return {
    items: [
      {
        productId: generateProductId(),
        quantity: Math.floor(Math.random() * 3) + 1
      }
    ],
    shippingAddress: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      address: faker.address.streetAddress(),
      city: faker.address.city(),
      state: faker.address.state(),
      postalCode: faker.address.zipCode(),
      country: 'US',
      phone: faker.phone.phoneNumber()
    },
    billingAddress: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      address: faker.address.streetAddress(),
      city: faker.address.city(),
      state: faker.address.state(),
      postalCode: faker.address.zipCode(),
      country: 'US',
      phone: faker.phone.phoneNumber()
    },
    paymentMethod: ['stripe', 'paypal'][Math.floor(Math.random() * 2)]
  };
}

// Generate random review data
function generateReviewData() {
  return {
    rating: Math.floor(Math.random() * 5) + 1,
    title: faker.lorem.sentence(),
    comment: faker.lorem.paragraph(),
    images: []
  };
}

// Generate random wishlist data
function generateWishlistData() {
  return {
    productId: generateProductId()
  };
}

// Generate random avatar generation data
function generateAvatarData() {
  return {
    bodyMeasurements: {
      height: Math.floor(Math.random() * 50) + 150, // 150-200 cm
      weight: Math.floor(Math.random() * 50) + 50,  // 50-100 kg
      chest: Math.floor(Math.random() * 30) + 80,   // 80-110 cm
      waist: Math.floor(Math.random() * 30) + 70,   // 70-100 cm
      hips: Math.floor(Math.random() * 30) + 80,    // 80-110 cm
      shoulderWidth: Math.floor(Math.random() * 20) + 40, // 40-60 cm
      armLength: Math.floor(Math.random() * 20) + 60,     // 60-80 cm
      inseam: Math.floor(Math.random() * 20) + 70,        // 70-90 cm
      shoeSize: Math.floor(Math.random() * 15) + 35,      // 35-50 EU
      bodyType: ['slim', 'athletic', 'average', 'curvy', 'plus_size'][Math.floor(Math.random() * 5)],
      gender: ['male', 'female', 'other'][Math.floor(Math.random() * 3)]
    },
    preferences: {
      style: ['casual', 'formal', 'sporty', 'elegant'][Math.floor(Math.random() * 4)],
      colors: ['black', 'white', 'blue', 'red', 'green'][Math.floor(Math.random() * 5)]
    }
  };
}

// Generate random virtual try-on data
function generateTryOnData() {
  return {
    avatarId: generateProductId(),
    productId: generateProductId(),
    settings: {
      lighting: ['natural', 'studio', 'outdoor'][Math.floor(Math.random() * 3)],
      angle: ['front', 'side', 'back'][Math.floor(Math.random() * 3)],
      background: ['white', 'gray', 'outdoor'][Math.floor(Math.random() * 3)]
    }
  };
}

// Generate random analytics event data
function generateAnalyticsData() {
  const eventTypes = [
    'page_view', 'product_view', 'add_to_cart', 'purchase',
    'search', 'filter', 'wishlist_add', 'review_submit'
  ];
  
  return {
    eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
    eventData: {
      pageUrl: faker.internet.url(),
      referrerUrl: faker.internet.url(),
      userAgent: faker.internet.userAgent(),
      timestamp: new Date().toISOString()
    }
  };
}

// Generate random notification data
function generateNotificationData() {
  const notificationTypes = [
    'order_confirmation', 'shipping_update', 'price_drop',
    'back_in_stock', 'welcome', 'promotional'
  ];
  
  return {
    type: notificationTypes[Math.floor(Math.random() * notificationTypes.length)],
    title: faker.lorem.sentence(),
    message: faker.lorem.paragraph(),
    data: {
      orderId: generateProductId(),
      productId: generateProductId(),
      amount: Math.floor(Math.random() * 1000) + 10
    }
  };
}

// Generate random coupon code
function generateCouponCode() {
  const codes = ['WELCOME10', 'SAVE20', 'FREESHIP', 'NEWUSER', 'LOYALTY15'];
  return codes[Math.floor(Math.random() * codes.length)];
}

// Generate random payment data
function generatePaymentData() {
  return {
    paymentMethod: ['stripe', 'paypal'][Math.floor(Math.random() * 2)],
    amount: Math.floor(Math.random() * 1000) + 10,
    currency: 'USD',
    metadata: {
      orderId: generateProductId(),
      customerId: generateProductId()
    }
  };
}

// Generate random file upload data
function generateFileUploadData() {
  const fileTypes = ['image/jpeg', 'image/png', 'image/webp'];
  return {
    fileType: fileTypes[Math.floor(Math.random() * fileTypes.length)],
    fileName: faker.system.fileName(),
    fileSize: Math.floor(Math.random() * 5000000) + 100000 // 100KB to 5MB
  };
}

// Generate random search filters
function generateSearchFilters() {
  return {
    category: generateCategory(),
    brand: ['nike', 'adidas', 'apple', 'samsung'][Math.floor(Math.random() * 4)],
    minPrice: Math.floor(Math.random() * 100),
    maxPrice: Math.floor(Math.random() * 500) + 100,
    sortBy: ['name', 'price', 'createdAt', 'rating'][Math.floor(Math.random() * 4)],
    sortOrder: ['asc', 'desc'][Math.floor(Math.random() * 2)]
  };
}

// Generate random pagination parameters
function generatePaginationParams() {
  return {
    page: Math.floor(Math.random() * 10) + 1,
    limit: [10, 20, 50][Math.floor(Math.random() * 3)]
  };
}

// Export functions for Artillery
module.exports = {
  generateProductId,
  generateUserData,
  generateSearchTerm,
  generateCategory,
  generatePriceRange,
  generateOrderData,
  generateReviewData,
  generateWishlistData,
  generateAvatarData,
  generateTryOnData,
  generateAnalyticsData,
  generateNotificationData,
  generateCouponCode,
  generatePaymentData,
  generateFileUploadData,
  generateSearchFilters,
  generatePaginationParams
}; 
# Local Development Guide - Wyoiwyget

## 🚀 Quick Start for Local Development

This guide will help you set up and test the Wyoiwyget platform locally on your machine.

## 📋 Prerequisites

Before starting, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **Python** (v3.9 or higher)
- **Docker** and **Docker Compose**
- **PostgreSQL** (v15 or higher)
- **Redis** (v7 or higher)
- **Git**

### Install Prerequisites

```bash
# Check Node.js version
node --version

# Check Python version
python3 --version

# Check Docker
docker --version
docker-compose --version

# Check Git
git --version
```

## 🛠️ Local Setup

### 1. Clone and Setup Project

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd wyoiwyget

# Install dependencies for all services
npm run install:all
```

### 2. Environment Configuration

```bash
# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp ai-services/.env.example ai-services/.env

# Edit environment files with your local settings
nano backend/.env
nano frontend/.env
nano ai-services/.env
```

### 3. Database Setup

```bash
# Start PostgreSQL and Redis with Docker
docker-compose up -d postgres redis

# Wait for services to be ready
sleep 10

# Run database migrations
cd backend
npm run migrate
npm run seed

# Verify database setup
npm run db:status
```

### 4. Start All Services

```bash
# Start all services in development mode
npm run dev:all

# Or start services individually:

# Terminal 1 - Backend API
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - AI Services
cd ai-services
python -m uvicorn main:app --reload --port 8001

# Terminal 4 - Queue Worker
cd backend
npm run worker
```

## 🧪 Testing the Application

### 1. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3000/api
- **AI Services**: http://localhost:8001
- **API Documentation**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health

### 2. Test User Flows

#### A. User Registration and Authentication

```bash
# 1. Visit http://localhost:3000
# 2. Click "Sign Up" or "Register"
# 3. Fill in registration form:
#    - Email: test@example.com
#    - Password: TestPassword123!
#    - First Name: John
#    - Last Name: Doe
# 4. Verify email (check console logs for verification link)
# 5. Login with credentials
```

#### B. Product Browsing and Search

```bash
# 1. Browse products at http://localhost:3000/products
# 2. Test search functionality
# 3. Filter by category, price, brand
# 4. View product details
# 5. Add products to cart
```

#### C. AI Avatar Generation

```bash
# 1. Go to http://localhost:3000/avatar
# 2. Upload a photo or use webcam
# 3. Enter body measurements
# 4. Generate AI avatar
# 5. View and download results
```

#### D. Virtual Try-On

```bash
# 1. Select a product
# 2. Click "Try On"
# 3. Upload or select avatar
# 4. View virtual try-on results
# 5. Save or share results
```

#### E. Shopping Cart and Checkout

```bash
# 1. Add products to cart
# 2. Review cart at http://localhost:3000/cart
# 3. Proceed to checkout
# 4. Fill shipping information
# 5. Test payment (use Stripe test cards)
# 6. Complete order
```

### 3. API Testing

#### Using the API Documentation

```bash
# 1. Visit http://localhost:3000/api/docs
# 2. Authenticate using the "Authorize" button
# 3. Test endpoints:
#    - GET /api/products
#    - POST /api/auth/login
#    - GET /api/user/profile
#    - POST /api/orders
```

#### Using cURL

```bash
# Test health check
curl http://localhost:3000/health

# Test product listing
curl http://localhost:3000/api/products

# Test user registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

### 4. Database Testing

```bash
# Connect to PostgreSQL
docker exec -it wyoiwyget_postgres_1 psql -U wyoiwyget_admin -d wyoiwyget

# Test queries
SELECT * FROM users LIMIT 5;
SELECT * FROM products LIMIT 5;
SELECT * FROM orders LIMIT 5;

# Exit PostgreSQL
\q
```

### 5. Redis Testing

```bash
# Connect to Redis
docker exec -it wyoiwyget_redis_1 redis-cli

# Test Redis commands
SET test "Hello Redis"
GET test
KEYS *
FLUSHALL

# Exit Redis
exit
```

## 🔧 Development Tools

### 1. Database Management

```bash
# View database logs
docker-compose logs postgres

# Reset database
npm run db:reset

# Run migrations
npm run migrate

# Seed data
npm run seed
```

### 2. Monitoring and Logs

```bash
# View all service logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f ai-services

# Monitor system resources
docker stats
```

### 3. Testing

```bash
# Run all tests
npm run test:all

# Run backend tests
cd backend && npm test

# Run frontend tests
cd frontend && npm test

# Run AI services tests
cd ai-services && python -m pytest

# Run integration tests
npm run test:integration

# Run performance tests
npm run test:performance
```

### 4. Code Quality

```bash
# Lint all code
npm run lint:all

# Format code
npm run format:all

# Type checking
npm run type-check:all
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Check what's using the port
lsof -i :3000
lsof -i :8001

# Kill the process
kill -9 <PID>
```

#### 2. Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart PostgreSQL
docker-compose restart postgres

# Check PostgreSQL logs
docker-compose logs postgres
```

#### 3. Redis Connection Issues

```bash
# Check if Redis is running
docker-compose ps

# Restart Redis
docker-compose restart redis

# Check Redis logs
docker-compose logs redis
```

#### 4. Node Modules Issues

```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### 5. Python Dependencies Issues

```bash
# Recreate virtual environment
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Debug Mode

```bash
# Enable debug logging
export DEBUG=*
export NODE_ENV=development

# Start services with debug
npm run dev:debug
```

## 📊 Performance Testing

### 1. Load Testing

```bash
# Install Artillery
npm install -g artillery

# Run load test
artillery run tests/load/load-test.yml

# View results
artillery report results.json
```

### 2. API Performance

```bash
# Test API endpoints
npm run test:api:performance

# Monitor response times
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3000/api/products
```

## 🔒 Security Testing

### 1. Security Scan

```bash
# Run security audit
npm audit

# Fix security issues
npm audit fix

# Run OWASP ZAP scan
docker run -v $(pwd):/zap/wrk/:rw -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:3000
```

### 2. Authentication Testing

```bash
# Test JWT tokens
npm run test:auth

# Test rate limiting
npm run test:rate-limit
```

## 📱 Mobile Testing

### 1. Responsive Design

```bash
# Test on different screen sizes
# Use browser dev tools to simulate mobile devices
# Test on actual mobile devices
```

### 2. PWA Testing

```bash
# Test service worker
# Test offline functionality
# Test push notifications
```

## 🎯 Next Steps

After successful local testing:

1. **Deploy to Staging**: Use the staging deployment scripts
2. **Performance Optimization**: Monitor and optimize based on local testing
3. **Security Hardening**: Implement additional security measures
4. **User Testing**: Conduct user acceptance testing
5. **Production Deployment**: Deploy to production environment

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs for error messages
3. Check the GitHub issues page
4. Contact the development team

## 🔄 Continuous Development

For ongoing development:

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm run update:all

# Run tests
npm run test:all

# Deploy updates
npm run deploy:local
```

---

**Happy Coding! 🚀** 
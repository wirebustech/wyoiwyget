# Local Development Guide

This guide will help you set up and run the Wyoiwyget platform locally for development.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js** 18.0.0 or higher
- **Python** 3.9 or higher
- **Docker** and Docker Compose
- **Git**
- **PostgreSQL** (optional, Docker will provide this)

### Optional Software
- **Redis** (optional, Docker will provide this)
- **VS Code** with recommended extensions
- **Postman** or **Insomnia** for API testing

### System Requirements
- **RAM**: Minimum 8GB, Recommended 16GB
- **Storage**: At least 10GB free space
- **CPU**: Multi-core processor recommended

## 🚀 Quick Setup (Recommended)

The fastest way to get started:

```bash
# Clone the repository
git clone <repository-url>
cd wyoiwyget

# Make the quick start script executable
chmod +x scripts/quick-start.sh

# Run the quick start script
./scripts/quick-start.sh
```

This script will:
1. Install all dependencies
2. Set up environment variables
3. Initialize the database
4. Start all services
5. Open the application in your browser

## 🛠️ Manual Setup

If you prefer to set up manually or the quick start script fails:

### 1. Install Dependencies

```bash
# Install all dependencies
npm run install:all

# Or install individually:
npm run install:frontend
npm run install:backend
npm run install:ai
```

### 2. Environment Setup

```bash
# Copy environment files
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cp ai-services/.env.example ai-services/.env

# Edit environment files with your configuration
# See Environment Variables section below
```

### 3. Database Setup

```bash
# Start PostgreSQL and Redis with Docker
docker-compose -f docker-compose.dev.yml up -d postgres redis

# Wait for services to be ready (about 30 seconds)
sleep 30

# Initialize database
npm run db:setup

# Run migrations
npm run db:migrate

# Seed with sample data
npm run db:seed
```

### 4. Start Services

```bash
# Start all services
npm run dev:all

# Or start individually:
npm run dev:frontend    # Frontend on http://localhost:3002
npm run dev:backend     # Backend on http://localhost:3000
npm run dev:ai          # AI Services on http://localhost:8001
```

## 🌐 Access Points

Once all services are running, you can access:

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3002 | Main web application |
| **Backend API** | http://localhost:3000 | REST API |
| **AI Services** | http://localhost:8001 | AI/ML services |
| **API Docs** | http://localhost:3000/api/docs | Swagger documentation |
| **Health Check** | http://localhost:3000/health | Service health status |
| **Database** | localhost:5432 | PostgreSQL (if running locally) |
| **Redis** | localhost:6379 | Redis cache (if running locally) |

## 🔧 Environment Variables

### Frontend (.env)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_AI_SERVICES_URL=http://localhost:8001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_PAYPAL_CLIENT_ID=test_...
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=GA_MEASUREMENT_ID
```

### Backend (.env)
```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://wyoiwyget:password@localhost:5432/wyoiwyget_dev
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# External Services
STRIPE_SECRET_KEY=sk_test_...
PAYPAL_CLIENT_ID=test_...
PAYPAL_CLIENT_SECRET=test_...
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# AI Services
AI_SERVICES_URL=http://localhost:8001
AI_SERVICES_API_KEY=your-ai-services-key

# Security
CORS_ORIGIN=http://localhost:3002
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### AI Services (.env)
```bash
# Server
PORT=8001
ENVIRONMENT=development

# Azure Services
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...
AZURE_STORAGE_CONTAINER_NAME=avatars
AZURE_COMPUTER_VISION_KEY=your-vision-key
AZURE_COMPUTER_VISION_ENDPOINT=https://your-resource.cognitiveservices.azure.com/

# Database
DATABASE_URL=postgresql://wyoiwyget:password@localhost:5432/wyoiwyget_dev
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your-super-secret-key
ALLOWED_ORIGINS=http://localhost:3002,http://localhost:3000
ALLOWED_HOSTS=localhost,127.0.0.1
```

## 🧪 Testing the Application

### 1. User Registration and Login

1. Open http://localhost:3002
2. Click "Sign Up" and create a new account
3. Verify email (check console logs for verification link)
4. Login with your credentials

### 2. Product Browsing

1. Navigate to the products page
2. Browse different categories
3. Use search and filters
4. View product details

### 3. Shopping Cart

1. Add products to cart
2. Update quantities
3. Remove items
4. Proceed to checkout

### 4. AI Features

1. Create an avatar:
   - Go to Avatar Creator
   - Upload body measurements
   - Generate AI avatar
2. Virtual Try-On:
   - Select a product
   - Use virtual try-on feature
   - View results

### 5. API Testing

Use the Swagger documentation at http://localhost:3000/api/docs to test API endpoints.

### 6. Database Testing

```bash
# Connect to database
docker exec -it wyoiwyget-postgres-1 psql -U wyoiwyget -d wyoiwyget_dev

# View tables
\dt

# Query data
SELECT * FROM users LIMIT 5;
SELECT * FROM products LIMIT 5;
```

## 🔍 Development Tools

### VS Code Extensions (Recommended)

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "bradlc.vscode-tailwindcss",
    "ms-python.python",
    "ms-python.black-formatter",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-azuretools.vscode-docker"
  ]
}
```

### Useful Commands

```bash
# View logs
npm run logs:all
npm run logs:frontend
npm run logs:backend
npm run logs:ai

# Database operations
npm run db:reset          # Reset database
npm run db:migrate        # Run migrations
npm run db:seed           # Seed data
npm run db:backup         # Backup database

# Code quality
npm run lint:all          # Lint all code
npm run format:all        # Format code
npm run type-check:all    # Type checking

# Testing
npm run test:all          # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

## 🐛 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Find process using port
lsof -i :3000
lsof -i :3002
lsof -i :8001

# Kill process
kill -9 <PID>
```

#### 2. Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart database
docker-compose -f docker-compose.dev.yml restart postgres

# Reset database
npm run db:reset
```

#### 3. Node Modules Issues
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear cache
npm cache clean --force
```

#### 4. Python Dependencies Issues
```bash
# Recreate virtual environment
cd ai-services
rm -rf venv
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

#### 5. Docker Issues
```bash
# Clean up Docker
docker system prune -a
docker volume prune

# Rebuild containers
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up --build
```

### Performance Issues

#### 1. Slow Startup
- Ensure you have sufficient RAM (8GB+)
- Close unnecessary applications
- Use SSD storage if possible

#### 2. Slow API Responses
- Check Redis connection
- Monitor database performance
- Review API logs for bottlenecks

#### 3. Frontend Performance
- Clear browser cache
- Check browser developer tools
- Monitor network requests

### Debug Mode

Enable debug logging:

```bash
# Backend
DEBUG=* npm run dev:backend

# Frontend
NEXT_PUBLIC_DEBUG=true npm run dev:frontend

# AI Services
LOG_LEVEL=DEBUG npm run dev:ai
```

## 📊 Monitoring

### Health Checks

```bash
# Check all services
npm run health:check

# Individual services
curl http://localhost:3000/health
curl http://localhost:8001/health
```

### Logs

```bash
# View all logs
npm run logs:all

# Follow logs in real-time
docker-compose -f docker-compose.dev.yml logs -f

# Service-specific logs
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f ai-services
```

### Metrics

- Application metrics: http://localhost:3000/metrics
- Database metrics: Check PostgreSQL logs
- Redis metrics: Check Redis logs

## 🔄 Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
# Test locally
npm run test:all

# Commit changes
git add .
git commit -m "feat: add your feature"

# Push and create PR
git push origin feature/your-feature-name
```

### 2. Code Review Process

1. Write tests for new features
2. Ensure all tests pass
3. Update documentation
4. Create pull request
5. Address review comments
6. Merge after approval

### 3. Hot Reloading

All services support hot reloading:
- Frontend: Changes reflect immediately
- Backend: Server restarts automatically
- AI Services: Server restarts automatically

## 🚀 Next Steps

After setting up local development:

1. **Explore the codebase** - Familiarize yourself with the project structure
2. **Read the documentation** - Check the docs/ directory
3. **Run the test suite** - Ensure everything works correctly
4. **Try the features** - Test all functionality
5. **Join the community** - Participate in discussions and contribute

## 📞 Support

If you encounter issues:

1. Check this troubleshooting guide
2. Search existing issues on GitHub
3. Create a new issue with detailed information
4. Join our Discord community
5. Contact the development team

---

**Happy coding! 🎉** 
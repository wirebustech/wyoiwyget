# Wyoiwyget Quick Start Guide

## 🚀 Get Started in 5 Minutes

This guide will help you set up the Wyoiwyget e-commerce aggregator platform locally for development.

## Prerequisites

### Required Software
- **Docker Desktop** (v20.10+) - [Download](https://www.docker.com/products/docker-desktop)
- **Node.js** (v18.0.0+) - [Download](https://nodejs.org/)
- **Python** (v3.11+) - [Download](https://www.python.org/downloads/)
- **Git** - [Download](https://git-scm.com/)

### Optional Tools
- **Azure CLI** (v2.45.0+) - [Download](https://docs.microsoft.com/cli/azure/install-azure-cli)
- **VS Code** with extensions:
  - Docker
  - Azure Tools
  - Python
  - TypeScript and JavaScript Language Features

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/wyoiwyget.git
cd wyoiwyget
```

### 2. Set Up Environment Variables
```bash
# Copy environment template
cp .env.example .env

# Edit the environment file with your local settings
nano .env
```

**Required Environment Variables:**
```env
# Development Settings
NODE_ENV=development
PORT=3000

# Database URLs (Docker Compose will handle these)
DATABASE_URL=postgresql://wyoiwyget:password@localhost:5432/wyoiwyget
REDIS_URL=redis://localhost:6379
MONGODB_URL=mongodb://localhost:27017/wyoiwyget

# Azure Services (use local emulators for development)
STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
SEARCH_KEY=dev-search-key

# Authentication (use test values for development)
JWT_SECRET=your-dev-jwt-secret
AZURE_CLIENT_ID=your-dev-client-id
AZURE_CLIENT_SECRET=your-dev-client-secret
AZURE_TENANT_ID=your-dev-tenant-id

# AI Services (optional for development)
OPENAI_API_KEY=your-dev-openai-key
```

### 3. Start the Development Environment
```bash
# Start all services
docker-compose --profile development up -d

# Or start specific services
docker-compose --profile development up frontend backend postgres redis
```

### 4. Initialize the Database
```bash
# Run database migrations
docker-compose exec backend npm run prisma:migrate

# Seed the database (if available)
docker-compose exec backend npm run prisma:db:seed
```

### 5. Access the Application

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Main application |
| **Backend API** | http://localhost:8000 | REST API |
| **AI Services** | http://localhost:8001 | AI/ML services |
| **API Docs** | http://localhost:8000/docs | Swagger documentation |
| **Redis UI** | http://localhost:8081 | Redis Commander |
| **MongoDB UI** | http://localhost:8082 | Mongo Express |
| **Storage** | http://localhost:10000 | Azure Storage Emulator |

## Development Workflow

### Frontend Development
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Backend Development
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Generate Prisma client
npm run prisma:generate
```

### AI Services Development
```bash
# Navigate to AI services directory
cd ai-services

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start development server
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

## Testing the Application

### 1. Health Checks
```bash
# Check if all services are running
curl http://localhost:3000/health
curl http://localhost:8000/health
curl http://localhost:8001/health
```

### 2. API Testing
```bash
# Test backend API
curl http://localhost:8000/api/v1/products

# Test AI services
curl http://localhost:8001/health
```

### 3. Database Connection
```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U wyoiwyget -d wyoiwyget

# Connect to Redis
docker-compose exec redis redis-cli

# Connect to MongoDB
docker-compose exec mongo mongosh wyoiwyget
```

## Monitoring and Debugging

### Start Monitoring Stack
```bash
# Start monitoring services
docker-compose --profile monitoring up -d

# Access monitoring tools
# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
# Jaeger: http://localhost:16686
```

### View Logs
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f frontend
docker-compose logs -f backend
docker-compose logs -f ai-services
```

### Debug Services
```bash
# Access service containers
docker-compose exec frontend sh
docker-compose exec backend sh
docker-compose exec ai-services bash

# Check service status
docker-compose ps
```

## Common Issues and Solutions

### Port Conflicts
If you get port conflicts, check what's running on the ports:
```bash
# Check what's using port 3000
lsof -i :3000

# Kill process using port
kill -9 <PID>
```

### Docker Issues
```bash
# Clean up Docker resources
docker system prune -a

# Rebuild containers
docker-compose build --no-cache

# Reset volumes
docker-compose down -v
```

### Database Issues
```bash
# Reset database
docker-compose down -v
docker-compose up postgres redis mongo -d
docker-compose exec backend npm run prisma:migrate
```

### Memory Issues
If you're running out of memory:
```bash
# Increase Docker memory limit in Docker Desktop
# Recommended: 8GB RAM, 4GB Swap

# Or use lighter images
docker-compose --profile development-light up -d
```

## Development Tips

### 1. Hot Reloading
- Frontend: Changes are automatically reflected
- Backend: Use `npm run dev` for auto-restart
- AI Services: Use `uvicorn --reload` for auto-restart

### 2. Database Management
```bash
# View database schema
docker-compose exec backend npx prisma studio

# Reset database
docker-compose exec backend npx prisma migrate reset

# Generate new migration
docker-compose exec backend npx prisma migrate dev --name add_new_table
```

### 3. Environment Management
```bash
# Switch between environments
cp .env.development .env
cp .env.production .env

# Use different compose files
docker-compose -f docker-compose.yml -f docker-compose.override.yml up
```

### 4. Performance Optimization
```bash
# Use volume mounts for faster development
# Already configured in docker-compose.yml

# Use multi-stage builds for production
docker build -f frontend/Dockerfile --target production .
```

## Next Steps

### 1. Explore the Codebase
- **Frontend**: `frontend/src/` - React/Next.js components
- **Backend**: `backend/src/` - Node.js/Express API
- **AI Services**: `ai-services/app/` - Python/FastAPI services
- **Infrastructure**: `infrastructure/` - Azure deployment files

### 2. Run Tests
```bash
# Frontend tests
cd frontend && npm test

# Backend tests
cd backend && npm test

# AI services tests
cd ai-services && pytest
```

### 3. Deploy to Azure
```bash
# Follow the Azure deployment guide
# docs/AZURE_DEPLOYMENT.md

# Or use the automated script
./scripts/deploy-azure.sh
```

### 4. Contribute
- Read the [Contributing Guidelines](CONTRIBUTING.md)
- Set up pre-commit hooks: `pre-commit install`
- Follow the coding standards

## Support

### Getting Help
- **Documentation**: Check the `docs/` directory
- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Wiki**: Check the project wiki

### Useful Commands
```bash
# Quick status check
docker-compose ps

# Restart services
docker-compose restart

# Update dependencies
docker-compose pull

# Clean up
docker-compose down --remove-orphans
```

### Development URLs
- **Application**: http://localhost:3000
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:3000/health
- **Database UI**: http://localhost:8082
- **Cache UI**: http://localhost:8081

---

**Happy coding! 🚀**

For more detailed information, check out the [full documentation](docs/). 
#!/bin/bash

# Wyoiwyget Quick Start Script
# This script sets up the complete local development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js 18 or higher."
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed. Please install npm."
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        error "Python 3 is not installed. Please install Python 3.9 or higher."
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install Docker."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed. Please install Docker Compose."
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        error "Git is not installed. Please install Git."
    fi
    
    log "Prerequisites check passed"
}

# Setup environment files
setup_environment() {
    log "Setting up environment files..."
    
    # Create .env files if they don't exist
    if [ ! -f "$PROJECT_ROOT/backend/.env" ]; then
        cp "$PROJECT_ROOT/backend/.env.example" "$PROJECT_ROOT/backend/.env"
        log "Created backend/.env"
    fi
    
    if [ ! -f "$PROJECT_ROOT/frontend/.env" ]; then
        cp "$PROJECT_ROOT/frontend/.env.example" "$PROJECT_ROOT/frontend/.env"
        log "Created frontend/.env"
    fi
    
    if [ ! -f "$PROJECT_ROOT/ai-services/.env" ]; then
        cp "$PROJECT_ROOT/ai-services/.env.example" "$PROJECT_ROOT/ai-services/.env"
        log "Created ai-services/.env"
    fi
    
    # Generate secure secrets for local development
    if ! grep -q "JWT_SECRET" "$PROJECT_ROOT/backend/.env"; then
        echo "JWT_SECRET=dev_jwt_secret_$(openssl rand -hex 32)" >> "$PROJECT_ROOT/backend/.env"
    fi
    
    if ! grep -q "SESSION_SECRET" "$PROJECT_ROOT/backend/.env"; then
        echo "SESSION_SECRET=dev_session_secret_$(openssl rand -hex 32)" >> "$PROJECT_ROOT/backend/.env"
    fi
    
    log "Environment files configured"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Install root dependencies
    cd "$PROJECT_ROOT"
    npm install
    
    # Install frontend dependencies
    cd "$PROJECT_ROOT/frontend"
    npm install
    
    # Install backend dependencies
    cd "$PROJECT_ROOT/backend"
    npm install
    
    # Install AI services dependencies
    cd "$PROJECT_ROOT/ai-services"
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install -r requirements.txt
    
    log "Dependencies installed successfully"
}

# Start Docker services
start_docker_services() {
    log "Starting Docker services..."
    
    cd "$PROJECT_ROOT"
    
    # Start only the required services (database, cache, etc.)
    docker-compose -f docker-compose.dev.yml up -d postgres redis minio mailhog elasticsearch kibana prometheus grafana jaeger adminer redis-commander
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check if services are healthy
    if ! docker-compose -f docker-compose.dev.yml ps | grep -q "healthy"; then
        warn "Some services may not be fully ready. Continuing anyway..."
    fi
    
    log "Docker services started"
}

# Setup database
setup_database() {
    log "Setting up database..."
    
    cd "$PROJECT_ROOT/backend"
    
    # Wait for PostgreSQL to be ready
    log "Waiting for PostgreSQL to be ready..."
    until docker-compose -f ../docker-compose.dev.yml exec -T postgres pg_isready -U wyoiwyget_admin -d wyoiwyget; do
        sleep 2
    done
    
    # Run migrations
    npm run migrate
    
    # Seed database
    npm run seed
    
    log "Database setup completed"
}

# Start application services
start_application() {
    log "Starting application services..."
    
    cd "$PROJECT_ROOT"
    
    # Start all application services
    npm run dev:all &
    
    # Wait for services to start
    log "Waiting for services to start..."
    sleep 10
    
    # Check if services are running
    if curl -f http://localhost:3000/health &> /dev/null; then
        log "Backend API is running"
    else
        warn "Backend API may not be ready yet"
    fi
    
    if curl -f http://localhost:3002 &> /dev/null; then
        log "Frontend is running"
    else
        warn "Frontend may not be ready yet"
    fi
    
    if curl -f http://localhost:8001/health &> /dev/null; then
        log "AI Services are running"
    else
        warn "AI Services may not be ready yet"
    fi
    
    log "Application services started"
}

# Display access information
display_access_info() {
    log "Setup completed successfully!"
    echo ""
    echo "🌐 Access URLs:"
    echo "   Frontend:          http://localhost:3002"
    echo "   Backend API:       http://localhost:3000"
    echo "   AI Services:       http://localhost:8001"
    echo "   API Documentation: http://localhost:3000/api/docs"
    echo ""
    echo "🔧 Development Tools:"
    echo "   Database Admin:    http://localhost:8080"
    echo "   Redis Commander:   http://localhost:8081"
    echo "   Mail Testing:      http://localhost:8025"
    echo "   Elasticsearch:     http://localhost:9200"
    echo "   Kibana:           http://localhost:5601"
    echo "   Prometheus:       http://localhost:9090"
    echo "   Grafana:          http://localhost:3001"
    echo "   Jaeger:           http://localhost:16686"
    echo ""
    echo "📝 Test Credentials:"
    echo "   Email: test@example.com"
    echo "   Password: TestPassword123!"
    echo ""
    echo "🛠️ Useful Commands:"
    echo "   View logs:         npm run dev:docker:logs"
    echo "   Stop services:     npm run dev:docker:down"
    echo "   Run tests:         npm run test:all"
    echo "   Health check:      npm run health:check"
    echo ""
    echo "📚 Documentation:"
    echo "   Local Development: LOCAL_DEVELOPMENT.md"
    echo "   API Reference:     http://localhost:3000/api/docs"
    echo ""
}

# Health check
health_check() {
    log "Running health checks..."
    
    # Check backend health
    if curl -f http://localhost:3000/health &> /dev/null; then
        log "✅ Backend API is healthy"
    else
        warn "❌ Backend API health check failed"
    fi
    
    # Check frontend
    if curl -f http://localhost:3002 &> /dev/null; then
        log "✅ Frontend is accessible"
    else
        warn "❌ Frontend health check failed"
    fi
    
    # Check AI services
    if curl -f http://localhost:8001/health &> /dev/null; then
        log "✅ AI Services are healthy"
    else
        warn "❌ AI Services health check failed"
    fi
    
    # Check database
    if docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U wyoiwyget_admin -d wyoiwyget &> /dev/null; then
        log "✅ Database is healthy"
    else
        warn "❌ Database health check failed"
    fi
    
    # Check Redis
    if docker-compose -f docker-compose.dev.yml exec -T redis redis-cli ping &> /dev/null; then
        log "✅ Redis is healthy"
    else
        warn "❌ Redis health check failed"
    fi
}

# Main execution
main() {
    echo ""
    echo "🚀 Wyoiwyget Quick Start"
    echo "========================"
    echo ""
    
    # Run setup steps
    check_prerequisites
    setup_environment
    install_dependencies
    start_docker_services
    setup_database
    start_application
    health_check
    display_access_info
    
    echo ""
    log "🎉 Wyoiwyget is ready for local development!"
    echo ""
    echo "💡 Tip: Open http://localhost:3002 in your browser to start exploring"
    echo ""
}

# Handle script interruption
trap 'echo ""; error "Setup interrupted. Run this script again to continue."' INT

# Run main function
main "$@" 
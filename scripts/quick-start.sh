#!/bin/bash

# Wyoiwyget Quick Start Script
# This script sets up the entire development environment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_deps=()
    
    if ! command_exists node; then
        missing_deps+=("Node.js")
    fi
    
    if ! command_exists python3; then
        missing_deps+=("Python 3")
    fi
    
    if ! command_exists docker; then
        missing_deps+=("Docker")
    fi
    
    if ! command_exists git; then
        missing_deps+=("Git")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing prerequisites: ${missing_deps[*]}"
        print_status "Please install the missing dependencies and run this script again."
        exit 1
    fi
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        print_error "Node.js version 18 or higher is required. Current version: $(node --version)"
        exit 1
    fi
    
    # Check Python version
    local python_version=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
    local python_major=$(echo $python_version | cut -d'.' -f1)
    local python_minor=$(echo $python_version | cut -d'.' -f2)
    
    if [ "$python_major" -lt 3 ] || ([ "$python_major" -eq 3 ] && [ "$python_minor" -lt 9 ]); then
        print_error "Python 3.9 or higher is required. Current version: $python_version"
        exit 1
    fi
    
    print_success "All prerequisites are satisfied"
}

# Function to setup environment files
setup_environment() {
    print_status "Setting up environment files..."
    
    # Frontend environment
    if [ ! -f frontend/.env ]; then
        cp frontend/.env.example frontend/.env
        print_success "Created frontend/.env"
    else
        print_warning "frontend/.env already exists, skipping..."
    fi
    
    # Backend environment
    if [ ! -f backend/.env ]; then
        cp backend/.env.example backend/.env
        print_success "Created backend/.env"
    else
        print_warning "backend/.env already exists, skipping..."
    fi
    
    # AI Services environment
    if [ ! -f ai-services/.env ]; then
        cp ai-services/.env.example ai-services/.env
        print_success "Created ai-services/.env"
    else
        print_warning "ai-services/.env already exists, skipping..."
    fi
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install root dependencies
    if [ -f package.json ]; then
        print_status "Installing root dependencies..."
        npm install
    fi
    
    # Install frontend dependencies
    if [ -d frontend ]; then
        print_status "Installing frontend dependencies..."
        cd frontend
        npm install
        cd ..
    fi
    
    # Install backend dependencies
    if [ -d backend ]; then
        print_status "Installing backend dependencies..."
        cd backend
        npm install
        cd ..
    fi
    
    # Install AI services dependencies
    if [ -d ai-services ]; then
        print_status "Installing AI services dependencies..."
        cd ai-services
        
        # Create virtual environment if it doesn't exist
        if [ ! -d venv ]; then
            python3 -m venv venv
            print_success "Created Python virtual environment"
        fi
        
        # Activate virtual environment and install dependencies
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
        deactivate
        
        cd ..
    fi
    
    print_success "All dependencies installed"
}

# Function to start infrastructure services
start_infrastructure() {
    print_status "Starting infrastructure services..."
    
    # Start PostgreSQL and Redis
    docker-compose -f docker-compose.dev.yml up -d postgres redis
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    sleep 30
    
    # Check if services are running
    if docker-compose -f docker-compose.dev.yml ps | grep -q "Up"; then
        print_success "Infrastructure services started"
    else
        print_error "Failed to start infrastructure services"
        exit 1
    fi
}

# Function to setup database
setup_database() {
    print_status "Setting up database..."
    
    # Wait a bit more for database to be fully ready
    sleep 10
    
    # Run database setup
    if command_exists npm; then
        npm run db:setup || {
            print_warning "Database setup failed, trying alternative method..."
            # Alternative: direct SQL execution
            docker exec -i wyoiwyget-postgres-1 psql -U wyoiwyget -d postgres < infrastructure/database/init.sql || {
                print_error "Database setup failed"
                exit 1
            }
        }
    else
        print_error "npm not found, cannot setup database"
        exit 1
    fi
    
    print_success "Database setup completed"
}

# Function to start application services
start_services() {
    print_status "Starting application services..."
    
    # Start all services in background
    npm run dev:all &
    local services_pid=$!
    
    # Wait for services to start
    print_status "Waiting for services to start..."
    sleep 30
    
    # Check if services are responding
    local frontend_ok=false
    local backend_ok=false
    local ai_ok=false
    
    # Check frontend
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        frontend_ok=true
        print_success "Frontend is running on http://localhost:3002"
    fi
    
    # Check backend
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        backend_ok=true
        print_success "Backend is running on http://localhost:3000"
    fi
    
    # Check AI services
    if curl -s http://localhost:8001/health > /dev/null 2>&1; then
        ai_ok=true
        print_success "AI Services are running on http://localhost:8001"
    fi
    
    if [ "$frontend_ok" = true ] && [ "$backend_ok" = true ] && [ "$ai_ok" = true ]; then
        print_success "All services are running successfully!"
    else
        print_warning "Some services may not be fully ready yet"
        print_status "You can check service status with: npm run health:check"
    fi
}

# Function to open browser
open_browser() {
    print_status "Opening application in browser..."
    
    # Wait a bit more for everything to be ready
    sleep 5
    
    # Try to open browser
    if command_exists xdg-open; then
        xdg-open http://localhost:3002
    elif command_exists open; then
        open http://localhost:3002
    elif command_exists start; then
        start http://localhost:3002
    else
        print_warning "Could not automatically open browser"
        print_status "Please open http://localhost:3002 in your browser"
    fi
}

# Function to show final information
show_final_info() {
    echo ""
    echo "🎉 Wyoiwyget is now running!"
    echo ""
    echo "📱 Access Points:"
    echo "   Frontend:     http://localhost:3002"
    echo "   Backend API:  http://localhost:3000"
    echo "   AI Services:  http://localhost:8001"
    echo "   API Docs:     http://localhost:3000/api/docs"
    echo ""
    echo "🧪 Test Credentials:"
    echo "   Email:    test@example.com"
    echo "   Password: TestPassword123!"
    echo ""
    echo "🔧 Useful Commands:"
    echo "   npm run dev:all          # Start all services"
    echo "   npm run test:all         # Run all tests"
    echo "   npm run logs:all         # View all logs"
    echo "   npm run health:check     # Check service health"
    echo "   docker-compose -f docker-compose.dev.yml down  # Stop services"
    echo ""
    echo "📚 Documentation:"
    echo "   Local Development: LOCAL_DEVELOPMENT.md"
    echo "   API Documentation: http://localhost:3000/api/docs"
    echo ""
    echo "🚀 Happy coding!"
    echo ""
}

# Function to cleanup on exit
cleanup() {
    print_status "Cleaning up..."
    # Kill background processes
    jobs -p | xargs -r kill
}

# Set trap for cleanup
trap cleanup EXIT

# Main execution
main() {
    echo "🚀 Wyoiwyget Quick Start Script"
    echo "================================"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Setup environment
    setup_environment
    
    # Install dependencies
    install_dependencies
    
    # Start infrastructure
    start_infrastructure
    
    # Setup database
    setup_database
    
    # Start services
    start_services
    
    # Open browser
    open_browser
    
    # Show final information
    show_final_info
    
    # Keep script running to maintain services
    print_status "Services are running. Press Ctrl+C to stop all services."
    wait
}

# Run main function
main "$@" 
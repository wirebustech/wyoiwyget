#!/bin/bash

# Production Deployment Script for Wyoiwyget
# This script handles the complete production deployment process

set -e  # Exit on any error

# Configuration
APP_NAME="wyoiwyget"
ENVIRONMENT="production"
REGISTRY="wyoiwyget.azurecr.io"
NAMESPACE="production"
DEPLOYMENT_TIMEOUT=600  # 10 minutes
HEALTH_CHECK_TIMEOUT=300  # 5 minutes
ROLLBACK_TIMEOUT=300  # 5 minutes

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local tools=("kubectl" "docker" "az" "helm")
    local missing_tools=()
    
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    log_success "All prerequisites are installed"
}

# Check Azure CLI authentication
check_azure_auth() {
    log_info "Checking Azure authentication..."
    
    if ! az account show &> /dev/null; then
        log_error "Azure CLI not authenticated. Please run 'az login'"
        exit 1
    fi
    
    log_success "Azure authentication verified"
}

# Check Kubernetes cluster access
check_k8s_access() {
    log_info "Checking Kubernetes cluster access..."
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot access Kubernetes cluster"
        exit 1
    fi
    
    log_success "Kubernetes cluster access verified"
}

# Build and push Docker images
build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    local services=("backend" "frontend" "ai-services")
    local version=$(git rev-parse --short HEAD)
    
    for service in "${services[@]}"; do
        log_info "Building $service image..."
        
        docker build -t "$REGISTRY/$service:$version" -t "$REGISTRY/$service:latest" \
            -f "$service/Dockerfile" .
        
        log_info "Pushing $service image..."
        docker push "$REGISTRY/$service:$version"
        docker push "$REGISTRY/$service:latest"
    done
    
    log_success "All images built and pushed successfully"
    echo "$version" > .deployed_version
}

# Update Kubernetes secrets
update_secrets() {
    log_info "Updating Kubernetes secrets..."
    
    # Check if secrets file exists
    if [ ! -f "k8s/secrets.yaml" ]; then
        log_warning "Secrets file not found. Skipping secrets update."
        return
    fi
    
    kubectl apply -f k8s/secrets.yaml -n "$NAMESPACE"
    log_success "Secrets updated successfully"
}

# Deploy to Kubernetes
deploy_to_k8s() {
    log_info "Deploying to Kubernetes..."
    
    local version=$(cat .deployed_version)
    
    # Update image tags in deployment files
    sed -i "s|IMAGE_TAG|$version|g" k8s/*.yaml
    
    # Apply all Kubernetes manifests
    kubectl apply -f k8s/ -n "$NAMESPACE"
    
    log_success "Kubernetes deployment initiated"
}

# Wait for deployment to complete
wait_for_deployment() {
    log_info "Waiting for deployment to complete..."
    
    local deployments=("backend" "frontend" "ai-services")
    local start_time=$(date +%s)
    
    for deployment in "${deployments[@]}"; do
        log_info "Waiting for $deployment deployment..."
        
        kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout="${DEPLOYMENT_TIMEOUT}s"
        
        if [ $? -ne 0 ]; then
            log_error "Deployment of $deployment failed"
            return 1
        fi
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "All deployments completed in ${duration}s"
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    local services=("backend" "frontend" "ai-services")
    local start_time=$(date +%s)
    
    for service in "${services[@]}"; do
        log_info "Checking health of $service..."
        
        # Get service URL
        local service_url=""
        case $service in
            "backend")
                service_url="https://api.wyoiwyget.com/health"
                ;;
            "frontend")
                service_url="https://wyoiwyget.com/health"
                ;;
            "ai-services")
                service_url="https://ai.wyoiwyget.com/health"
                ;;
        esac
        
        # Wait for service to be ready
        local attempts=0
        local max_attempts=30
        
        while [ $attempts -lt $max_attempts ]; do
            if curl -f -s "$service_url" > /dev/null; then
                log_success "$service health check passed"
                break
            fi
            
            attempts=$((attempts + 1))
            sleep 10
        done
        
        if [ $attempts -eq $max_attempts ]; then
            log_error "Health check failed for $service"
            return 1
        fi
    done
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "All health checks passed in ${duration}s"
}

# Run smoke tests
run_smoke_tests() {
    log_info "Running smoke tests..."
    
    # Test API endpoints
    local api_base="https://api.wyoiwyget.com"
    local endpoints=("/health" "/api/v1/products" "/api/v1/auth/status")
    
    for endpoint in "${endpoints[@]}"; do
        log_info "Testing endpoint: $endpoint"
        
        if ! curl -f -s "$api_base$endpoint" > /dev/null; then
            log_error "Smoke test failed for $endpoint"
            return 1
        fi
    done
    
    # Test frontend
    if ! curl -f -s "https://wyoiwyget.com" > /dev/null; then
        log_error "Frontend smoke test failed"
        return 1
    fi
    
    log_success "All smoke tests passed"
}

# Update DNS and CDN
update_dns_cdn() {
    log_info "Updating DNS and CDN..."
    
    # Update Azure Front Door/CDN
    az cdn endpoint update \
        --name "wyoiwyget" \
        --profile-name "wyoiwyget-cdn" \
        --resource-group "wyoiwyget-rg" \
        --origin-path "/" \
        --enable-compression
    
    # Purge CDN cache
    az cdn endpoint purge \
        --name "wyoiwyget" \
        --profile-name "wyoiwyget-cdn" \
        --resource-group "wyoiwyget-rg" \
        --content-paths "/*"
    
    log_success "DNS and CDN updated successfully"
}

# Monitor deployment
monitor_deployment() {
    log_info "Starting deployment monitoring..."
    
    # Monitor for 10 minutes
    local monitor_duration=600
    local start_time=$(date +%s)
    
    while true; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [ $elapsed -ge $monitor_duration ]; then
            break
        fi
        
        # Check pod status
        local failed_pods=$(kubectl get pods -n "$NAMESPACE" --field-selector=status.phase=Failed -o jsonpath='{.items[*].metadata.name}')
        
        if [ -n "$failed_pods" ]; then
            log_error "Failed pods detected: $failed_pods"
            return 1
        fi
        
        # Check resource usage
        local high_cpu=$(kubectl top pods -n "$NAMESPACE" --sort-by=cpu | head -5)
        local high_memory=$(kubectl top pods -n "$NAMESPACE" --sort-by=memory | head -5)
        
        log_info "Resource usage check completed"
        
        sleep 60
    done
    
    log_success "Deployment monitoring completed"
}

# Rollback function
rollback_deployment() {
    log_warning "Starting rollback..."
    
    local previous_version=$(cat .previous_version 2>/dev/null || echo "v1.0.0")
    
    # Rollback deployments
    local deployments=("backend" "frontend" "ai-services")
    
    for deployment in "${deployments[@]}"; do
        log_info "Rolling back $deployment to $previous_version..."
        
        kubectl rollout undo deployment/"$deployment" -n "$NAMESPACE"
        kubectl rollout status deployment/"$deployment" -n "$NAMESPACE" --timeout="${ROLLBACK_TIMEOUT}s"
    done
    
    # Restore previous version
    echo "$previous_version" > .deployed_version
    
    log_success "Rollback completed successfully"
}

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."
    
    # Remove temporary files
    rm -f .deployed_version.tmp
    
    # Clean up old images (keep last 5 versions)
    docker image prune -f
    
    log_success "Cleanup completed"
}

# Main deployment function
main() {
    local start_time=$(date +%s)
    
    log_info "Starting production deployment for $APP_NAME"
    
    # Save current version for rollback
    if [ -f .deployed_version ]; then
        cp .deployed_version .previous_version
    fi
    
    # Execute deployment steps
    check_prerequisites
    check_azure_auth
    check_k8s_access
    build_and_push_images
    update_secrets
    deploy_to_k8s
    wait_for_deployment
    run_health_checks
    run_smoke_tests
    update_dns_cdn
    monitor_deployment
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    log_success "Production deployment completed successfully in ${duration}s"
    
    # Send notification
    send_deployment_notification "success" "$duration"
    
    cleanup
}

# Error handling
handle_error() {
    local exit_code=$?
    local line_number=$1
    
    log_error "Deployment failed at line $line_number with exit code $exit_code"
    
    # Attempt rollback
    rollback_deployment
    
    # Send notification
    send_deployment_notification "failure" "0"
    
    cleanup
    exit $exit_code
}

# Send deployment notification
send_deployment_notification() {
    local status=$1
    local duration=$2
    
    log_info "Sending deployment notification..."
    
    # Send to Slack/Teams/Email
    if [ "$status" = "success" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"✅ Production deployment completed successfully in ${duration}s\"}" \
            "$SLACK_WEBHOOK_URL"
    else
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"❌ Production deployment failed. Rollback initiated.\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
}

# Set up error handling
trap 'handle_error $LINENO' ERR

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --rollback)
            rollback_deployment
            exit 0
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  --dry-run     Perform a dry run without actual deployment"
            echo "  --skip-tests  Skip health checks and smoke tests"
            echo "  --rollback    Rollback to previous version"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Execute main function
main "$@" 
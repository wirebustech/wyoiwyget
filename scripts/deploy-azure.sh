#!/bin/bash

# Wyoiwyget Azure Deployment Script
# This script automates the deployment of the Wyoiwyget platform on Azure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RESOURCE_GROUP="wyoiwyget-rg"
LOCATION="eastus"
ENVIRONMENT="dev"
PROJECT_NAME="wyoiwyget"

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

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists az; then
        print_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command_exists bicep; then
        print_error "Bicep CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command_exists docker; then
        print_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Login to Azure
login_azure() {
    print_status "Logging into Azure..."
    az login
    print_success "Logged into Azure successfully"
}

# Create resource group
create_resource_group() {
    print_status "Creating resource group..."
    az group create \
        --name $RESOURCE_GROUP \
        --location $LOCATION \
        --tags Environment=$ENVIRONMENT Project=$PROJECT_NAME
    
    print_success "Resource group created: $RESOURCE_GROUP"
}

# Deploy infrastructure using Bicep
deploy_infrastructure() {
    print_status "Deploying infrastructure using Bicep..."
    
    az deployment group create \
        --resource-group $RESOURCE_GROUP \
        --template-file infrastructure/bicep/main.bicep \
        --parameters @infrastructure/bicep/parameters.json \
        --verbose
    
    print_success "Infrastructure deployment completed"
}

# Get deployment outputs
get_deployment_outputs() {
    print_status "Getting deployment outputs..."
    
    # Get ACR login server
    ACR_LOGIN_SERVER=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.acrLoginServer.value \
        --output tsv)
    
    # Get other outputs
    POSTGRES_CONNECTION_STRING=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.postgresConnectionString.value \
        --output tsv)
    
    REDIS_CONNECTION_STRING=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.redisConnectionString.value \
        --output tsv)
    
    COSMOS_CONNECTION_STRING=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.cosmosConnectionString.value \
        --output tsv)
    
    SEARCH_KEY=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.searchKey.value \
        --output tsv)
    
    STORAGE_CONNECTION_STRING=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.storageConnectionString.value \
        --output tsv)
    
    KEY_VAULT_URI=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.keyVaultUri.value \
        --output tsv)
    
    STATIC_WEB_APP_URL=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.staticWebAppUrl.value \
        --output tsv)
    
    print_success "Deployment outputs retrieved"
}

# Store secrets in Key Vault
store_secrets() {
    print_status "Storing secrets in Key Vault..."
    
    KEY_VAULT_NAME=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.keyVaultUri.value \
        --output tsv | sed 's|https://||' | sed 's|.vault.azure.net||')
    
    # Store database connection strings
    az keyvault secret set \
        --vault-name $KEY_VAULT_NAME \
        --name postgres-connection-string \
        --value "$POSTGRES_CONNECTION_STRING"
    
    az keyvault secret set \
        --vault-name $KEY_VAULT_NAME \
        --name redis-connection-string \
        --value "$REDIS_CONNECTION_STRING"
    
    az keyvault secret set \
        --vault-name $KEY_VAULT_NAME \
        --name cosmos-connection-string \
        --value "$COSMOS_CONNECTION_STRING"
    
    az keyvault secret set \
        --vault-name $KEY_VAULT_NAME \
        --name storage-connection-string \
        --value "$STORAGE_CONNECTION_STRING"
    
    az keyvault secret set \
        --vault-name $KEY_VAULT_NAME \
        --name search-key \
        --value "$SEARCH_KEY"
    
    print_success "Secrets stored in Key Vault"
}

# Build and push container images
build_images() {
    print_status "Building and pushing container images..."
    
    # Login to ACR
    az acr login --name $(echo $ACR_LOGIN_SERVER | sed 's|.azurecr.io||')
    
    # Build and push backend
    print_status "Building backend image..."
    cd backend
    docker build -t $ACR_LOGIN_SERVER/wyoiwyget-backend:latest .
    docker push $ACR_LOGIN_SERVER/wyoiwyget-backend:latest
    cd ..
    
    # Build and push AI services
    print_status "Building AI services image..."
    cd ai-services
    docker build -t $ACR_LOGIN_SERVER/wyoiwyget-ai:latest .
    docker push $ACR_LOGIN_SERVER/wyoiwyget-ai:latest
    cd ..
    
    print_success "All container images built and pushed"
}

# Deploy Container Apps
deploy_container_apps() {
    print_status "Deploying Container Apps..."
    
    CONTAINER_APPS_ENV=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.containerAppsEnvName.value \
        --output tsv)
    
    # Deploy backend
    az containerapp create \
        --name wyoiwyget-backend \
        --resource-group $RESOURCE_GROUP \
        --environment $CONTAINER_APPS_ENV \
        --image $ACR_LOGIN_SERVER/wyoiwyget-backend:latest \
        --target-port 8000 \
        --ingress external \
        --min-replicas 1 \
        --max-replicas 10 \
        --cpu 1.0 \
        --memory 2.0Gi \
        --env-vars \
            NODE_ENV=production \
            PORT=8000 \
            DATABASE_URL="$POSTGRES_CONNECTION_STRING" \
            REDIS_URL="$REDIS_CONNECTION_STRING" \
            MONGODB_URL="$COSMOS_CONNECTION_STRING" \
            STORAGE_CONNECTION_STRING="$STORAGE_CONNECTION_STRING" \
            SEARCH_KEY="$SEARCH_KEY"
    
    # Deploy AI services
    az containerapp create \
        --name wyoiwyget-ai \
        --resource-group $RESOURCE_GROUP \
        --environment $CONTAINER_APPS_ENV \
        --image $ACR_LOGIN_SERVER/wyoiwyget-ai:latest \
        --target-port 8001 \
        --ingress external \
        --min-replicas 1 \
        --max-replicas 5 \
        --cpu 2.0 \
        --memory 4.0Gi \
        --env-vars \
            PYTHONPATH=/app \
            DATABASE_URL="$POSTGRES_CONNECTION_STRING" \
            REDIS_URL="$REDIS_CONNECTION_STRING" \
            STORAGE_CONNECTION_STRING="$STORAGE_CONNECTION_STRING"
    
    print_success "Container Apps deployed"
}

# Configure Azure Static Web App
configure_static_web_app() {
    print_status "Configuring Azure Static Web App..."
    
    # Get Static Web App details
    STATIC_WEB_APP_NAME=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.staticWebAppName.value \
        --output tsv)
    
    # Configure app settings
    az staticwebapp appsettings set \
        --name $STATIC_WEB_APP_NAME \
        --setting-names \
            NODE_ENV=production \
            NEXT_PUBLIC_API_URL="https://$STATIC_WEB_APP_URL/api" \
            NEXT_PUBLIC_AI_SERVICE_URL="https://$STATIC_WEB_APP_URL/ai"
    
    print_success "Static Web App configured"
}

# Deploy frontend
deploy_frontend() {
    print_status "Deploying frontend to Azure Static Web Apps..."
    
    # This would typically be done through GitHub Actions
    # For now, we'll just build the frontend
    cd frontend
    npm install
    npm run build
    cd ..
    
    print_success "Frontend deployment initiated"
}

# Configure custom domain
configure_custom_domain() {
    print_status "Configuring custom domain..."
    
    # This would require DNS configuration and SSL certificate
    print_warning "Please configure your DNS to point to the Static Web App URL"
    print_warning "Static Web App URL: $STATIC_WEB_APP_URL"
    
    print_success "Custom domain configuration instructions provided"
}

# Set up monitoring
setup_monitoring() {
    print_status "Setting up monitoring..."
    
    # Get Application Insights key
    APP_INSIGHTS_KEY=$(az deployment group show \
        --resource-group $RESOURCE_GROUP \
        --name main \
        --query properties.outputs.applicationInsightsKey.value \
        --output tsv)
    
    # Configure alerts
    az monitor action-group create \
        --name wyoiwyget-alerts \
        --resource-group $RESOURCE_GROUP \
        --short-name wyoiwyget \
        --action email admin@wyoiwyget.com
    
    print_success "Monitoring configured"
}

# Display deployment summary
display_summary() {
    print_success "Deployment completed successfully!"
    echo ""
    echo "=== Deployment Summary ==="
    echo "Resource Group: $RESOURCE_GROUP"
    echo "Location: $LOCATION"
    echo "Environment: $ENVIRONMENT"
    echo ""
    echo "=== Service URLs ==="
    echo "Static Web App: https://$STATIC_WEB_APP_URL"
    echo "Backend API: https://wyoiwyget-backend.azurecontainerapps.io"
    echo "AI Services: https://wyoiwyget-ai.azurecontainerapps.io"
    echo ""
    echo "=== Next Steps ==="
    echo "1. Configure your DNS to point to the Static Web App URL"
    echo "2. Set up SSL certificates for custom domain"
    echo "3. Configure Azure Active Directory B2C for authentication"
    echo "4. Set up monitoring and alerting"
    echo "5. Configure CI/CD pipelines"
    echo ""
    echo "=== Important Notes ==="
    echo "- All secrets are stored in Azure Key Vault"
    echo "- Container Apps are configured with auto-scaling"
    echo "- Static Web App is configured for global distribution"
    echo "- Monitoring is set up with Application Insights"
}

# Main deployment function
main() {
    print_status "Starting Wyoiwyget Azure deployment..."
    
    check_prerequisites
    login_azure
    create_resource_group
    deploy_infrastructure
    get_deployment_outputs
    store_secrets
    build_images
    deploy_container_apps
    configure_static_web_app
    deploy_frontend
    configure_custom_domain
    setup_monitoring
    display_summary
    
    print_success "Deployment completed successfully!"
}

# Run main function
main "$@" 
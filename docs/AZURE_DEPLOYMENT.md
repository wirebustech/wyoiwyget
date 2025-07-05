# Azure Deployment Guide for Wyoiwyget

## Overview

This guide provides comprehensive instructions for deploying the Wyoiwyget e-commerce aggregator platform on Microsoft Azure. The platform leverages Azure's cloud-native services for scalability, security, and performance.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Azure Front Door                        │
│                    (Global Load Balancer)                      │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                    Azure Static Web Apps                       │
│                    (Frontend - Next.js)                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                    Azure API Management                        │
│                    (API Gateway)                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        │                           │
┌───────▼────────┐        ┌────────▼────────┐
│ Azure Container│        │ Azure Container │
│ Apps (Backend) │        │ Apps (AI)       │
└───────┬────────┘        └────────┬────────┘
        │                          │
        └──────────┬───────────────┘
                   │
    ┌──────────────┴──────────────┐
    │                             │
┌───▼────────┐    ┌──────────────▼────────┐
│Azure DB for│    │   Azure Cosmos DB     │
│PostgreSQL  │    │   (Document Store)    │
└────────────┘    └───────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Azure AI Services                           │
│  (OpenAI, Custom Vision, Machine Learning, Cognitive Search)   │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

### Azure Account Setup
1. **Azure Subscription**: Active Azure subscription with billing enabled
2. **Azure CLI**: Install Azure CLI (v2.45.0+)
3. **Permissions**: Owner or Contributor role on the subscription
4. **Resource Providers**: Enable required resource providers

### Local Development Setup
1. **Node.js**: v18.0.0+
2. **Python**: v3.11+
3. **Docker**: v20.10+
4. **Git**: Latest version

### Required Azure Services
- Azure Container Registry
- Azure Container Apps
- Azure Static Web Apps
- Azure Database for PostgreSQL
- Azure Cosmos DB
- Azure Cache for Redis
- Azure Cognitive Search
- Azure Storage Account
- Azure Key Vault
- Azure API Management
- Azure Front Door
- Azure Active Directory B2C
- Azure OpenAI Service
- Azure Machine Learning

## Step 1: Azure Environment Setup

### 1.1 Login to Azure
```bash
az login
az account set --subscription "your-subscription-id"
```

### 1.2 Enable Required Resource Providers
```bash
# Enable resource providers
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.DBforPostgreSQL
az provider register --namespace Microsoft.DocumentDB
az provider register --namespace Microsoft.Cache
az provider register --namespace Microsoft.Search
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.KeyVault
az provider register --namespace Microsoft.ApiManagement
az provider register --namespace Microsoft.Network
az provider register --namespace Microsoft.AzureActiveDirectory
az provider register --namespace Microsoft.CognitiveServices
az provider register --namespace Microsoft.MachineLearningServices

# Wait for registration to complete
az provider show -n Microsoft.ContainerRegistry --query registrationState
```

### 1.3 Create Resource Group
```bash
az group create \
  --name wyoiwyget-rg \
  --location eastus \
  --tags Environment=production Project=wyoiwyget
```

## Step 2: Deploy Infrastructure

### 2.1 Deploy Using Bicep
```bash
# Deploy infrastructure
az deployment group create \
  --resource-group wyoiwyget-rg \
  --template-file infrastructure/bicep/main.bicep \
  --parameters @infrastructure/bicep/parameters.json \
  --verbose
```

### 2.2 Verify Deployment
```bash
# List all resources
az resource list --resource-group wyoiwyget-rg --output table

# Check deployment status
az deployment group show \
  --resource-group wyoiwyget-rg \
  --name main
```

## Step 3: Configure Azure Services

### 3.1 Azure Container Registry (ACR)
```bash
# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show \
  --name wyoiwygetacr \
  --resource-group wyoiwyget-rg \
  --query loginServer \
  --output tsv)

# Login to ACR
az acr login --name wyoiwygetacr

# Enable admin user (for development)
az acr update --name wyoiwygetacr --admin-enabled true
```

### 3.2 Azure Key Vault Configuration
```bash
# Get Key Vault name
KEY_VAULT_NAME=$(az deployment group show \
  --resource-group wyoiwyget-rg \
  --name main \
  --query properties.outputs.keyVaultName.value \
  --output tsv)

# Store secrets
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name postgres-connection-string \
  --value "your-postgres-connection-string"

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name redis-connection-string \
  --value "your-redis-connection-string"

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name cosmos-connection-string \
  --value "your-cosmos-connection-string"

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name openai-api-key \
  --value "your-openai-api-key"
```

### 3.3 Azure Active Directory B2C
```bash
# Create B2C tenant
az ad b2c tenant create \
  --location "United States" \
  --resource-name "wyoiwyget" \
  --display-name "Wyoiwyget B2C" \
  --sku-name "PremiumP1"

# Create user flow for sign-up/sign-in
az ad b2c user-flow create \
  --resource-name "wyoiwyget" \
  --flow-name "B2C_1_signupsignin" \
  --type "SignUpSignIn" \
  --location "United States"
```

## Step 4: Build and Deploy Applications

### 4.1 Build Container Images
```bash
# Build frontend
cd frontend
docker build -t $ACR_LOGIN_SERVER/wyoiwyget-frontend:latest .
docker push $ACR_LOGIN_SERVER/wyoiwyget-frontend:latest

# Build backend
cd ../backend
docker build -t $ACR_LOGIN_SERVER/wyoiwyget-backend:latest .
docker push $ACR_LOGIN_SERVER/wyoiwyget-backend:latest

# Build AI services
cd ../ai-services
docker build -t $ACR_LOGIN_SERVER/wyoiwyget-ai:latest .
docker push $ACR_LOGIN_SERVER/wyoiwyget-ai:latest
```

### 4.2 Deploy to Azure Container Apps
```bash
# Get Container Apps Environment
CONTAINER_APPS_ENV=$(az deployment group show \
  --resource-group wyoiwyget-rg \
  --name main \
  --query properties.outputs.containerAppsEnvName.value \
  --output tsv)

# Deploy backend
az containerapp create \
  --name wyoiwyget-backend \
  --resource-group wyoiwyget-rg \
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
    DATABASE_URL="$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name postgres-connection-string --query value -o tsv)" \
    REDIS_URL="$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name redis-connection-string --query value -o tsv)"

# Deploy AI services
az containerapp create \
  --name wyoiwyget-ai \
  --resource-group wyoiwyget-rg \
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
    OPENAI_API_KEY="$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name openai-api-key --query value -o tsv)"
```

### 4.3 Deploy Frontend to Azure Static Web Apps
```bash
# Get Static Web App details
STATIC_WEB_APP_NAME=$(az deployment group show \
  --resource-group wyoiwyget-rg \
  --name main \
  --query properties.outputs.staticWebAppName.value \
  --output tsv)

# Configure app settings
az staticwebapp appsettings set \
  --name $STATIC_WEB_APP_NAME \
  --setting-names \
    NEXT_PUBLIC_API_URL="https://wyoiwyget-backend.azurecontainerapps.io" \
    NEXT_PUBLIC_AI_SERVICE_URL="https://wyoiwyget-ai.azurecontainerapps.io" \
    NEXT_PUBLIC_AZURE_CLIENT_ID="your-b2c-client-id"
```

## Step 5: Configure Azure API Management

### 5.1 Import APIs
```bash
# Get API Management details
APIM_NAME=$(az deployment group show \
  --resource-group wyoiwyget-rg \
  --name main \
  --query properties.outputs.apiManagementName.value \
  --output tsv)

# Import backend API
az apim api import \
  --resource-group wyoiwyget-rg \
  --service-name $APIM_NAME \
  --api-id wyoiwyget-backend \
  --specification-url "https://wyoiwyget-backend.azurecontainerapps.io/openapi.json" \
  --specification-format OpenApiJson

# Import AI services API
az apim api import \
  --resource-group wyoiwyget-rg \
  --service-name $APIM_NAME \
  --api-id wyoiwyget-ai \
  --specification-url "https://wyoiwyget-ai.azurecontainerapps.io/openapi.json" \
  --specification-format OpenApiJson
```

### 5.2 Configure Policies
```bash
# Add rate limiting policy
az apim api policy create \
  --resource-group wyoiwyget-rg \
  --service-name $APIM_NAME \
  --api-id wyoiwyget-backend \
  --value '<policies><inbound><rate-limit calls="100" renewal-period="60" /><base /></inbound></policies>'
```

## Step 6: Configure Azure Front Door

### 6.1 Set up Custom Domain
```bash
# Get Front Door details
FRONT_DOOR_NAME=$(az deployment group show \
  --resource-group wyoiwyget-rg \
  --name main \
  --query properties.outputs.frontDoorName.value \
  --output tsv)

# Add custom domain
az network front-door frontend-endpoint create \
  --resource-group wyoiwyget-rg \
  --front-door-name $FRONT_DOOR_NAME \
  --name custom-domain \
  --host-name "wyoiwyget.yourdomain.com"
```

### 6.2 Configure SSL Certificate
```bash
# Add SSL certificate
az network front-door frontend-endpoint enable-https \
  --resource-group wyoiwyget-rg \
  --front-door-name $FRONT_DOOR_NAME \
  --name custom-domain \
  --certificate-source AzureKeyVault \
  --vault-id "/subscriptions/your-subscription-id/resourceGroups/wyoiwyget-rg/providers/Microsoft.KeyVault/vaults/wyoiwyget-kv" \
  --secret-name "ssl-certificate"
```

## Step 7: Database Setup

### 7.1 PostgreSQL Database
```bash
# Get PostgreSQL server details
POSTGRES_SERVER=$(az deployment group show \
  --resource-group wyoiwyget-rg \
  --name main \
  --query properties.outputs.postgresServerName.value \
  --output tsv)

# Run database migrations
cd backend
npm run prisma:migrate
```

### 7.2 Cosmos DB Setup
```bash
# Get Cosmos DB details
COSMOS_DB_NAME=$(az deployment group show \
  --resource-group wyoiwyget-rg \
  --name main \
  --query properties.outputs.cosmosDbName.value \
  --output tsv)

# Create collections (if needed)
az cosmosdb mongodb collection create \
  --resource-group wyoiwyget-rg \
  --account-name $COSMOS_DB_NAME \
  --database-name wyoiwyget \
  --name products \
  --shard "id"
```

## Step 8: Monitoring and Logging

### 8.1 Application Insights
```bash
# Get Application Insights key
APP_INSIGHTS_KEY=$(az deployment group show \
  --resource-group wyoiwyget-rg \
  --name main \
  --query properties.outputs.applicationInsightsKey.value \
  --output tsv)

# Configure monitoring
az monitor diagnostic-settings create \
  --resource-group wyoiwyget-rg \
  --resource-type Microsoft.ContainerApps/environments \
  --resource-name $CONTAINER_APPS_ENV \
  --name container-apps-monitoring \
  --workspace "/subscriptions/your-subscription-id/resourceGroups/wyoiwyget-rg/providers/Microsoft.OperationalInsights/workspaces/wyoiwyget-logs"
```

### 8.2 Set up Alerts
```bash
# Create action group
az monitor action-group create \
  --name wyoiwyget-alerts \
  --resource-group wyoiwyget-rg \
  --short-name wyoiwyget \
  --action email admin@wyoiwyget.com

# Create availability alert
az monitor metrics alert create \
  --name "availability-alert" \
  --resource-group wyoiwyget-rg \
  --scopes "/subscriptions/your-subscription-id/resourceGroups/wyoiwyget-rg/providers/Microsoft.Web/sites/$STATIC_WEB_APP_NAME" \
  --condition "avg availability percentage < 99.9" \
  --window-size "PT5M" \
  --evaluation-frequency "PT1M" \
  --action "/subscriptions/your-subscription-id/resourceGroups/wyoiwyget-rg/providers/Microsoft.Insights/actionGroups/wyoiwyget-alerts"
```

## Step 9: Security Configuration

### 9.1 Network Security
```bash
# Configure NSG rules
az network nsg rule create \
  --resource-group wyoiwyget-rg \
  --nsg-name wyoiwyget-nsg \
  --name allow-https \
  --protocol tcp \
  --priority 100 \
  --destination-port-range 443

# Configure Azure Firewall (if needed)
az network firewall application-rule create \
  --resource-group wyoiwyget-rg \
  --firewall-name wyoiwyget-firewall \
  --collection-name allow-web \
  --name allow-azure-services \
  --protocols http=80 https=443 \
  --target-fqdns "*.azurewebsites.net" "*.azurecontainerapps.io"
```

### 9.2 Identity and Access Management
```bash
# Create managed identity for Container Apps
az identity create \
  --name wyoiwyget-identity \
  --resource-group wyoiwyget-rg

# Assign Key Vault access
az keyvault set-policy \
  --name $KEY_VAULT_NAME \
  --object-id $(az identity show --name wyoiwyget-identity --resource-group wyoiwyget-rg --query principalId -o tsv) \
  --secret-permissions get list
```

## Step 10: CI/CD Pipeline Setup

### 10.1 Azure DevOps Pipeline
```yaml
# azure-pipelines.yml
trigger:
  - main

variables:
  acrName: 'wyoiwygetacr'
  resourceGroup: 'wyoiwyget-rg'
  location: 'eastus'

stages:
- stage: Build
  jobs:
  - job: BuildAndPush
    pool:
      vmImage: 'ubuntu-latest'
    steps:
    - task: Docker@2
      inputs:
        containerRegistry: 'Azure Container Registry'
        repository: 'wyoiwyget-frontend'
        command: 'buildAndPush'
        Dockerfile: 'frontend/Dockerfile'
        tags: '$(Build.BuildId)'
    
    - task: Docker@2
      inputs:
        containerRegistry: 'Azure Container Registry'
        repository: 'wyoiwyget-backend'
        command: 'buildAndPush'
        Dockerfile: 'backend/Dockerfile'
        tags: '$(Build.BuildId)'

- stage: Deploy
  jobs:
  - deployment: DeployToAzure
    environment: 'production'
    strategy:
      runOnce:
        deploy:
          steps:
          - task: AzureCLI@2
            inputs:
              azureSubscription: 'Azure Subscription'
              scriptType: 'bash'
              scriptLocation: 'inlineScript'
              inlineScript: |
                az containerapp update \
                  --name wyoiwyget-backend \
                  --resource-group $resourceGroup \
                  --image $acrName.azurecr.io/wyoiwyget-backend:$(Build.BuildId)
```

### 10.2 GitHub Actions (Alternative)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Azure

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Login to Azure
      uses: azure/login@v1
      with:
        creds: ${{ secrets.AZURE_CREDENTIALS }}
    
    - name: Build and push images
      run: |
        az acr build --registry wyoiwygetacr --image wyoiwyget-frontend:${{ github.sha }} ./frontend
        az acr build --registry wyoiwygetacr --image wyoiwyget-backend:${{ github.sha }} ./backend
    
    - name: Deploy to Container Apps
      run: |
        az containerapp update \
          --name wyoiwyget-backend \
          --resource-group wyoiwyget-rg \
          --image wyoiwygetacr.azurecr.io/wyoiwyget-backend:${{ github.sha }}
```

## Step 11: Performance Optimization

### 11.1 Azure CDN Configuration
```bash
# Enable CDN for Static Web App
az cdn profile create \
  --name wyoiwyget-cdn \
  --resource-group wyoiwyget-rg \
  --sku Standard_Microsoft

az cdn endpoint create \
  --name wyoiwyget-cdn-endpoint \
  --profile-name wyoiwyget-cdn \
  --resource-group wyoiwyget-rg \
  --origin "wyoiwyget-swa.azurestaticapps.net" \
  --origin-host-header "wyoiwyget-swa.azurestaticapps.net"
```

### 11.2 Redis Caching
```bash
# Configure Redis for session storage
az redis firewall-rules create \
  --resource-group wyoiwyget-rg \
  --name wyoiwyget-redis \
  --rule-name allow-all \
  --start-ip 0.0.0.0 \
  --end-ip 255.255.255.255
```

## Step 12: Testing and Validation

### 12.1 Health Checks
```bash
# Test endpoints
curl -f https://wyoiwyget-swa.azurestaticapps.net/health
curl -f https://wyoiwyget-backend.azurecontainerapps.io/health
curl -f https://wyoiwyget-ai.azurecontainerapps.io/health
```

### 12.2 Load Testing
```bash
# Install k6 for load testing
curl -L https://github.com/grafana/k6/releases/download/v0.45.0/k6-v0.45.0-linux-amd64.tar.gz | tar xz

# Run load test
./k6 run load-test.js
```

## Step 13: Cost Optimization

### 13.1 Reserved Instances
```bash
# Purchase reserved instances for predictable workloads
az vm reservation create \
  --resource-group wyoiwyget-rg \
  --reservation-order-name wyoiwyget-reservation \
  --sku Standard_B1ms \
  --location eastus \
  --quantity 1 \
  --term P1Y
```

### 13.2 Auto-scaling Configuration
```bash
# Configure auto-scaling for Container Apps
az containerapp revision set-mode \
  --name wyoiwyget-backend \
  --resource-group wyoiwyget-rg \
  --mode multiple

az containerapp update \
  --name wyoiwyget-backend \
  --resource-group wyoiwyget-rg \
  --min-replicas 1 \
  --max-replicas 10 \
  --scale-rule-name http-scaling \
  --scale-rule-type http \
  --scale-rule-http-concurrency 50
```

## Troubleshooting

### Common Issues

1. **Container Apps not starting**
   ```bash
   # Check logs
   az containerapp logs show \
     --name wyoiwyget-backend \
     --resource-group wyoiwyget-rg \
     --follow
   ```

2. **Database connection issues**
   ```bash
   # Check PostgreSQL firewall rules
   az postgres flexible-server firewall-rule list \
     --resource-group wyoiwyget-rg \
     --name wyoiwyget-postgres
   ```

3. **Key Vault access issues**
   ```bash
   # Check access policies
   az keyvault show \
     --name wyoiwyget-kv \
     --resource-group wyoiwyget-rg \
     --query properties.accessPolicies
   ```

### Monitoring Commands
```bash
# Check resource usage
az monitor metrics list \
  --resource "/subscriptions/your-subscription-id/resourceGroups/wyoiwyget-rg/providers/Microsoft.ContainerApps/environments/wyoiwyget-cae" \
  --metric "CpuPercentage" \
  --interval PT1M

# Check costs
az consumption usage list \
  --start-date 2024-01-01 \
  --end-date 2024-01-31
```

## Security Best Practices

1. **Use Managed Identities** for service-to-service authentication
2. **Enable Azure Security Center** for threat detection
3. **Implement least privilege access** with Azure RBAC
4. **Use Azure Key Vault** for all secrets and certificates
5. **Enable Azure DDoS Protection** for network security
6. **Regular security updates** and patch management
7. **Monitor and audit** all access and changes

## Performance Best Practices

1. **Use Azure Front Door** for global load balancing
2. **Implement caching** with Azure Cache for Redis
3. **Use CDN** for static content delivery
4. **Optimize container images** for faster startup
5. **Implement auto-scaling** based on demand
6. **Use Azure Monitor** for performance insights
7. **Optimize database queries** and indexes

## Next Steps

1. **Set up monitoring dashboards** in Azure Monitor
2. **Configure backup and disaster recovery** procedures
3. **Implement blue-green deployments** for zero-downtime updates
4. **Set up development and staging environments**
5. **Create runbooks** for common operational tasks
6. **Document runbooks** and operational procedures
7. **Train team** on Azure services and best practices

## Support and Resources

- [Azure Documentation](https://docs.microsoft.com/azure/)
- [Azure Container Apps Documentation](https://docs.microsoft.com/azure/container-apps/)
- [Azure Static Web Apps Documentation](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure Architecture Center](https://docs.microsoft.com/azure/architecture/)
- [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/)
- [Azure Support](https://azure.microsoft.com/support/)

---

**Note**: This deployment guide assumes you have the necessary permissions and resources in your Azure subscription. Adjust the resource names, locations, and configurations according to your specific requirements and Azure policies. 
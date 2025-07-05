#!/bin/bash

# Wyoiwyget Production Setup Script
# This script sets up the complete production environment

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
ENVIRONMENT="production"
APP_NAME="wyoiwyget"
DOMAIN_NAME="${DOMAIN_NAME:-wyoiwyget.com}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@wyoiwyget.com}"
LOCATION="${LOCATION:-eastus}"
RESOURCE_GROUP="${RESOURCE_GROUP:-wyoiwyget-prod-rg}"

# Logging
LOG_FILE="$PROJECT_ROOT/logs/setup-production-$(date +%Y%m%d-%H%M%S).log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        error "Azure CLI is not installed. Please install it first."
    fi
    
    # Check if kubectl is installed
    if ! command -v kubectl &> /dev/null; then
        error "kubectl is not installed. Please install it first."
    fi
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install it first."
    fi
    
    # Check if helm is installed
    if ! command -v helm &> /dev/null; then
        error "Helm is not installed. Please install it first."
    fi
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        error "jq is not installed. Please install it first."
    fi
    
    # Check Azure CLI login
    if ! az account show &> /dev/null; then
        error "Not logged into Azure CLI. Please run 'az login' first."
    fi
    
    log "Prerequisites check passed"
}

create_resource_group() {
    log "Creating resource group..."
    
    if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
        az group create \
            --name "$RESOURCE_GROUP" \
            --location "$LOCATION" \
            --tags Environment="$ENVIRONMENT" Application="$APP_NAME" ManagedBy="Script"
        log "Resource group created: $RESOURCE_GROUP"
    else
        log "Resource group already exists: $RESOURCE_GROUP"
    fi
}

generate_passwords() {
    log "Generating secure passwords..."
    
    # Generate database password
    if [ -z "$DB_ADMIN_PASSWORD" ]; then
        DB_ADMIN_PASSWORD=$(openssl rand -base64 32)
        echo "DB_ADMIN_PASSWORD=$DB_ADMIN_PASSWORD" >> .env.production
    fi
    
    # Generate Redis password
    if [ -z "$REDIS_PASSWORD" ]; then
        REDIS_PASSWORD=$(openssl rand -base64 32)
        echo "REDIS_PASSWORD=$REDIS_PASSWORD" >> .env.production
    fi
    
    # Generate JWT secret
    if [ -z "$JWT_SECRET" ]; then
        JWT_SECRET=$(openssl rand -base64 64)
        echo "JWT_SECRET=$JWT_SECRET" >> .env.production
    fi
    
    # Generate session secret
    if [ -z "$SESSION_SECRET" ]; then
        SESSION_SECRET=$(openssl rand -base64 32)
        echo "SESSION_SECRET=$SESSION_SECRET" >> .env.production
    fi
    
    log "Passwords generated and saved to .env.production"
}

deploy_infrastructure() {
    log "Deploying Azure infrastructure..."
    
    # Load environment variables
    if [ -f .env.production ]; then
        source .env.production
    fi
    
    # Deploy Bicep template
    az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --template-file "$PROJECT_ROOT/infrastructure/azure/main.bicep" \
        --parameters \
            environment="$ENVIRONMENT" \
            location="$LOCATION" \
            appName="$APP_NAME" \
            domainName="$DOMAIN_NAME" \
            adminEmail="$ADMIN_EMAIL" \
            dbAdminUsername="wyoiwyget_admin" \
            dbAdminPassword="$DB_ADMIN_PASSWORD" \
            redisPassword="$REDIS_PASSWORD" \
            appInsightsConnectionString="$APP_INSIGHTS_CONNECTION_STRING" \
            openAiEndpoint="$AZURE_OPENAI_ENDPOINT" \
            openAiApiKey="$AZURE_OPENAI_API_KEY" \
            stripeSecretKey="$STRIPE_SECRET_KEY" \
            paypalClientId="$PAYPAL_CLIENT_ID" \
            paypalClientSecret="$PAYPAL_CLIENT_SECRET" \
            sendGridApiKey="$SENDGRID_API_KEY" \
            awsSesAccessKeyId="$AWS_SES_ACCESS_KEY_ID" \
            awsSesSecretAccessKey="$AWS_SES_SECRET_ACCESS_KEY" \
            acrUsername="$ACR_USERNAME" \
            acrPassword="$ACR_PASSWORD" \
        --verbose
    
    log "Infrastructure deployment completed"
}

get_deployment_outputs() {
    log "Getting deployment outputs..."
    
    # Get outputs from the last deployment
    OUTPUTS=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name "main" \
        --query "properties.outputs" \
        --output json)
    
    # Extract values
    AKS_NAME=$(echo "$OUTPUTS" | jq -r '.aksName.value')
    ACR_NAME=$(echo "$OUTPUTS" | jq -r '.acrName.value')
    ACR_LOGIN_SERVER=$(echo "$OUTPUTS" | jq -r '.acrLoginServer.value')
    POSTGRESQL_SERVER_NAME=$(echo "$OUTPUTS" | jq -r '.postgresqlServerName.value')
    POSTGRESQL_SERVER_FQDN=$(echo "$OUTPUTS" | jq -r '.postgresqlServerFqdn.value')
    REDIS_CACHE_NAME=$(echo "$OUTPUTS" | jq -r '.redisCacheName.value')
    REDIS_CACHE_HOSTNAME=$(echo "$OUTPUTS" | jq -r '.redisCacheHostName.value')
    STORAGE_ACCOUNT_NAME=$(echo "$OUTPUTS" | jq -r '.storageAccountName.value')
    KEY_VAULT_NAME=$(echo "$OUTPUTS" | jq -r '.keyVaultName.value')
    KEY_VAULT_URI=$(echo "$OUTPUTS" | jq -r '.keyVaultUri.value')
    APP_INSIGHTS_NAME=$(echo "$OUTPUTS" | jq -r '.appInsightsName.value')
    APP_INSIGHTS_INSTRUMENTATION_KEY=$(echo "$OUTPUTS" | jq -r '.appInsightsInstrumentationKey.value')
    APP_INSIGHTS_CONNECTION_STRING=$(echo "$OUTPUTS" | jq -r '.appInsightsConnectionString.value')
    LOG_ANALYTICS_WORKSPACE_NAME=$(echo "$OUTPUTS" | jq -r '.logAnalyticsWorkspaceName.value')
    LOG_ANALYTICS_WORKSPACE_ID=$(echo "$OUTPUTS" | jq -r '.logAnalyticsWorkspaceId.value')
    PUBLIC_IP_ADDRESS=$(echo "$OUTPUTS" | jq -r '.publicIPAddress.value')
    PUBLIC_IP_FQDN=$(echo "$OUTPUTS" | jq -r '.publicIPFqdn.value')
    CDN_ENDPOINT_HOSTNAME=$(echo "$OUTPUTS" | jq -r '.cdnEndpointHostName.value')
    
    # Save to environment file
    cat >> .env.production << EOF
    
# Infrastructure Outputs
AKS_NAME=$AKS_NAME
ACR_NAME=$ACR_NAME
ACR_LOGIN_SERVER=$ACR_LOGIN_SERVER
POSTGRESQL_SERVER_NAME=$POSTGRESQL_SERVER_NAME
POSTGRESQL_SERVER_FQDN=$POSTGRESQL_SERVER_FQDN
REDIS_CACHE_NAME=$REDIS_CACHE_NAME
REDIS_CACHE_HOSTNAME=$REDIS_CACHE_HOSTNAME
STORAGE_ACCOUNT_NAME=$STORAGE_ACCOUNT_NAME
KEY_VAULT_NAME=$KEY_VAULT_NAME
KEY_VAULT_URI=$KEY_VAULT_URI
APP_INSIGHTS_NAME=$APP_INSIGHTS_NAME
APP_INSIGHTS_INSTRUMENTATION_KEY=$APP_INSIGHTS_INSTRUMENTATION_KEY
APP_INSIGHTS_CONNECTION_STRING=$APP_INSIGHTS_CONNECTION_STRING
LOG_ANALYTICS_WORKSPACE_NAME=$LOG_ANALYTICS_WORKSPACE_NAME
LOG_ANALYTICS_WORKSPACE_ID=$LOG_ANALYTICS_WORKSPACE_ID
PUBLIC_IP_ADDRESS=$PUBLIC_IP_ADDRESS
PUBLIC_IP_FQDN=$PUBLIC_IP_FQDN
CDN_ENDPOINT_HOSTNAME=$CDN_ENDPOINT_HOSTNAME
EOF
    
    log "Deployment outputs saved to .env.production"
}

configure_aks() {
    log "Configuring AKS cluster..."
    
    # Get AKS credentials
    az aks get-credentials \
        --resource-group "$RESOURCE_GROUP" \
        --name "$AKS_NAME" \
        --overwrite-existing
    
    # Create namespace
    kubectl create namespace wyoiwyget --dry-run=client -o yaml | kubectl apply -f -
    
    # Install Helm repositories
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo add jetstack https://charts.jetstack.io
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    # Install NGINX Ingress Controller
    helm install ingress-nginx ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.service.loadBalancerIP="$PUBLIC_IP_ADDRESS" \
        --set controller.ingressClassResource.name=nginx \
        --set controller.ingressClassResource.default=true
    
    # Install cert-manager
    helm install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --set installCRDs=true \
        --set global.leaderElection.namespace=cert-manager
    
    # Wait for cert-manager to be ready
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/instance=cert-manager -n cert-manager --timeout=300s
    
    # Create ClusterIssuer for Let's Encrypt
    cat << EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: $ADMIN_EMAIL
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
    
    log "AKS configuration completed"
}

build_and_push_images() {
    log "Building and pushing Docker images..."
    
    # Login to ACR
    az acr login --name "$ACR_NAME"
    
    # Build and push backend image
    docker build \
        -t "$ACR_LOGIN_SERVER/backend:latest" \
        -t "$ACR_LOGIN_SERVER/backend:$ENVIRONMENT" \
        -f "$PROJECT_ROOT/backend/Dockerfile" \
        "$PROJECT_ROOT/backend"
    
    docker push "$ACR_LOGIN_SERVER/backend:latest"
    docker push "$ACR_LOGIN_SERVER/backend:$ENVIRONMENT"
    
    # Build and push frontend image
    docker build \
        -t "$ACR_LOGIN_SERVER/frontend:latest" \
        -t "$ACR_LOGIN_SERVER/frontend:$ENVIRONMENT" \
        -f "$PROJECT_ROOT/frontend/Dockerfile" \
        "$PROJECT_ROOT/frontend"
    
    docker push "$ACR_LOGIN_SERVER/frontend:latest"
    docker push "$ACR_LOGIN_SERVER/frontend:$ENVIRONMENT"
    
    # Build and push AI services image
    docker build \
        -t "$ACR_LOGIN_SERVER/ai-services:latest" \
        -t "$ACR_LOGIN_SERVER/ai-services:$ENVIRONMENT" \
        -f "$PROJECT_ROOT/ai-services/Dockerfile" \
        "$PROJECT_ROOT/ai-services"
    
    docker push "$ACR_LOGIN_SERVER/ai-services:latest"
    docker push "$ACR_LOGIN_SERVER/ai-services:$ENVIRONMENT"
    
    log "Docker images built and pushed successfully"
}

deploy_kubernetes_resources() {
    log "Deploying Kubernetes resources..."
    
    # Create ConfigMap for environment variables
    kubectl create configmap wyoiwyget-config \
        --from-env-file=.env.production \
        --namespace wyoiwyget \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy PostgreSQL
    helm install postgresql bitnami/postgresql \
        --namespace wyoiwyget \
        --set auth.postgresPassword="$DB_ADMIN_PASSWORD" \
        --set auth.database=wyoiwyget \
        --set primary.persistence.size=10Gi \
        --set primary.resources.requests.memory=256Mi \
        --set primary.resources.requests.cpu=250m \
        --set primary.resources.limits.memory=512Mi \
        --set primary.resources.limits.cpu=500m
    
    # Deploy Redis
    helm install redis bitnami/redis \
        --namespace wyoiwyget \
        --set auth.password="$REDIS_PASSWORD" \
        --set master.persistence.size=5Gi \
        --set master.resources.requests.memory=256Mi \
        --set master.resources.requests.cpu=250m \
        --set master.resources.limits.memory=512Mi \
        --set master.resources.limits.cpu=500m
    
    # Deploy backend
    helm install backend "$PROJECT_ROOT/k8s/backend" \
        --namespace wyoiwyget \
        --set image.repository="$ACR_LOGIN_SERVER/backend" \
        --set image.tag="$ENVIRONMENT" \
        --set replicaCount=3 \
        --set resources.requests.memory=512Mi \
        --set resources.requests.cpu=500m \
        --set resources.limits.memory=1Gi \
        --set resources.limits.cpu=1000m
    
    # Deploy frontend
    helm install frontend "$PROJECT_ROOT/k8s/frontend" \
        --namespace wyoiwyget \
        --set image.repository="$ACR_LOGIN_SERVER/frontend" \
        --set image.tag="$ENVIRONMENT" \
        --set replicaCount=3 \
        --set resources.requests.memory=256Mi \
        --set resources.requests.cpu=250m \
        --set resources.limits.memory=512Mi \
        --set resources.limits.cpu=500m
    
    # Deploy AI services
    helm install ai-services "$PROJECT_ROOT/k8s/ai-services" \
        --namespace wyoiwyget \
        --set image.repository="$ACR_LOGIN_SERVER/ai-services" \
        --set image.tag="$ENVIRONMENT" \
        --set replicaCount=2 \
        --set resources.requests.memory=1Gi \
        --set resources.requests.cpu=1000m \
        --set resources.limits.memory=2Gi \
        --set resources.limits.cpu=2000m
    
    # Deploy monitoring stack
    helm install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set grafana.enabled=true \
        --set prometheus.prometheusSpec.retention=7d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=10Gi
    
    # Deploy logging stack
    helm install elasticsearch elastic/elasticsearch \
        --namespace logging \
        --create-namespace \
        --set replicas=1 \
        --set minimumMasterNodes=1 \
        --set resources.requests.memory=512Mi \
        --set resources.limits.memory=1Gi
    
    helm install kibana elastic/kibana \
        --namespace logging \
        --set replicas=1 \
        --set resources.requests.memory=256Mi \
        --set resources.limits.memory=512Mi
    
    helm install filebeat elastic/filebeat \
        --namespace logging \
        --set daemonset.enabled=true
    
    log "Kubernetes resources deployed successfully"
}

configure_ingress() {
    log "Configuring ingress..."
    
    # Create ingress resource
    cat << EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: wyoiwyget-ingress
  namespace: wyoiwyget
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
spec:
  tls:
  - hosts:
    - $DOMAIN_NAME
    - www.$DOMAIN_NAME
    secretName: wyoiwyget-tls
  rules:
  - host: $DOMAIN_NAME
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend-service
            port:
              number: 3000
      - path: /ai
        pathType: Prefix
        backend:
          service:
            name: ai-services-service
            port:
              number: 8001
  - host: www.$DOMAIN_NAME
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 80
EOF
    
    log "Ingress configured successfully"
}

setup_monitoring() {
    log "Setting up monitoring..."
    
    # Create monitoring dashboards
    kubectl apply -f "$PROJECT_ROOT/infrastructure/monitoring/grafana-dashboards.yaml"
    
    # Create alerting rules
    kubectl apply -f "$PROJECT_ROOT/infrastructure/monitoring/prometheus-rules.yaml"
    
    # Setup log aggregation
    kubectl apply -f "$PROJECT_ROOT/infrastructure/monitoring/fluentd-config.yaml"
    
    log "Monitoring setup completed"
}

run_database_migrations() {
    log "Running database migrations..."
    
    # Wait for PostgreSQL to be ready
    kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=postgresql -n wyoiwyget --timeout=300s
    
    # Run migrations
    kubectl run migrations \
        --image="$ACR_LOGIN_SERVER/backend:$ENVIRONMENT" \
        --namespace wyoiwyget \
        --env="DATABASE_URL=postgresql://wyoiwyget_admin:$DB_ADMIN_PASSWORD@postgresql:5432/wyoiwyget" \
        --command -- npm run migrate
    
    # Wait for migrations to complete
    kubectl wait --for=condition=complete job/migrations -n wyoiwyget --timeout=600s
    
    log "Database migrations completed"
}

setup_backup() {
    log "Setting up backup solutions..."
    
    # Create backup cronjob for database
    cat << EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
  namespace: wyoiwyget
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h postgresql -U wyoiwyget_admin -d wyoiwyget | gzip > /backup/backup-\$(date +%Y%m%d-%H%M%S).sql.gz
            env:
            - name: PGPASSWORD
              value: "$DB_ADMIN_PASSWORD"
            volumeMounts:
            - name: backup-volume
              mountPath: /backup
          volumes:
          - name: backup-volume
            persistentVolumeClaim:
              claimName: backup-pvc
          restartPolicy: OnFailure
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: backup-pvc
  namespace: wyoiwyget
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
EOF
    
    log "Backup setup completed"
}

configure_dns() {
    log "Configuring DNS..."
    
    # Get the ingress external IP
    INGRESS_IP=$(kubectl get service ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
    
    # Update DNS records
    az network dns record-set a add-record \
        --resource-group "$RESOURCE_GROUP" \
        --zone-name "$DOMAIN_NAME" \
        --record-set-name "@" \
        --ipv4-address "$INGRESS_IP"
    
    az network dns record-set a add-record \
        --resource-group "$RESOURCE_GROUP" \
        --zone-name "$DOMAIN_NAME" \
        --record-set-name "www" \
        --ipv4-address "$INGRESS_IP"
    
    log "DNS configured successfully"
}

run_health_checks() {
    log "Running health checks..."
    
    # Wait for all pods to be ready
    kubectl wait --for=condition=ready pod -l app=backend -n wyoiwyget --timeout=300s
    kubectl wait --for=condition=ready pod -l app=frontend -n wyoiwyget --timeout=300s
    kubectl wait --for=condition=ready pod -l app=ai-services -n wyoiwyget --timeout=300s
    
    # Test backend health
    BACKEND_POD=$(kubectl get pod -l app=backend -n wyoiwyget -o jsonpath='{.items[0].metadata.name}')
    kubectl exec "$BACKEND_POD" -n wyoiwyget -- curl -f http://localhost:3000/health || error "Backend health check failed"
    
    # Test frontend
    FRONTEND_POD=$(kubectl get pod -l app=frontend -n wyoiwyget -o jsonpath='{.items[0].metadata.name}')
    kubectl exec "$FRONTEND_POD" -n wyoiwyget -- curl -f http://localhost:3000/ || error "Frontend health check failed"
    
    # Test AI services
    AI_POD=$(kubectl get pod -l app=ai-services -n wyoiwyget -o jsonpath='{.items[0].metadata.name}')
    kubectl exec "$AI_POD" -n wyoiwyget -- curl -f http://localhost:8001/health || error "AI services health check failed"
    
    log "Health checks passed"
}

create_admin_user() {
    log "Creating admin user..."
    
    # Create admin user in the database
    kubectl run create-admin \
        --image="$ACR_LOGIN_SERVER/backend:$ENVIRONMENT" \
        --namespace wyoiwyget \
        --env="DATABASE_URL=postgresql://wyoiwyget_admin:$DB_ADMIN_PASSWORD@postgresql:5432/wyoiwyget" \
        --command -- npm run create-admin
    
    # Wait for admin creation to complete
    kubectl wait --for=condition=complete job/create-admin -n wyoiwyget --timeout=300s
    
    log "Admin user created successfully"
}

setup_ssl_certificates() {
    log "Setting up SSL certificates..."
    
    # Wait for cert-manager to be ready
    sleep 30
    
    # Check certificate status
    kubectl get certificate -n wyoiwyget
    
    log "SSL certificates setup completed"
}

finalize_setup() {
    log "Finalizing setup..."
    
    # Create setup completion file
    cat > setup-completed.txt << EOF
Wyoiwyget Production Setup Completed
====================================

Environment: $ENVIRONMENT
Domain: $DOMAIN_NAME
Resource Group: $RESOURCE_GROUP
Location: $LOCATION

Services:
- Backend: https://$DOMAIN_NAME/api
- Frontend: https://$DOMAIN_NAME
- AI Services: https://$DOMAIN_NAME/ai
- Monitoring: https://grafana.$DOMAIN_NAME
- Logs: https://kibana.$DOMAIN_NAME

Admin Dashboard: https://$DOMAIN_NAME/admin

Setup completed on: $(date)
EOF
    
    log "Production setup completed successfully!"
    log "Access your application at: https://$DOMAIN_NAME"
    log "Check setup-completed.txt for more details"
}

# Main execution
main() {
    log "Starting Wyoiwyget production setup..."
    
    # Create logs directory
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Run setup steps
    check_prerequisites
    create_resource_group
    generate_passwords
    deploy_infrastructure
    get_deployment_outputs
    configure_aks
    build_and_push_images
    deploy_kubernetes_resources
    configure_ingress
    setup_monitoring
    run_database_migrations
    setup_backup
    configure_dns
    run_health_checks
    create_admin_user
    setup_ssl_certificates
    finalize_setup
    
    log "Production setup completed successfully!"
}

# Run main function
main "$@" 
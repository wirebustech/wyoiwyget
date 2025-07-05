@description('The name of the resource group')
param resourceGroupName string = resourceGroup().name

@description('The location for all resources')
param location string = resourceGroup().location

@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Project name')
param projectName string = 'wyoiwyget'

@description('Domain name for the application')
param domainName string = 'wyoiwyget.yourdomain.com'

@description('Azure OpenAI Service name')
param openAiServiceName string = 'wyoiwyget-openai'

@description('Azure Container Registry name')
param acrName string = 'wyoiwygetacr'

@description('Azure Database for PostgreSQL server name')
param postgresServerName string = 'wyoiwyget-postgres'

@description('Azure Cosmos DB account name')
param cosmosDbName string = 'wyoiwyget-cosmos'

@description('Azure Cache for Redis name')
param redisName string = 'wyoiwyget-redis'

@description('Azure Cognitive Search name')
param searchName string = 'wyoiwyget-search'

@description('Azure Storage Account name')
param storageName string = 'wyoiwygetstorage'

@description('Azure Key Vault name')
param keyVaultName string = 'wyoiwyget-kv'

@description('Azure API Management name')
param apiManagementName string = 'wyoiwyget-apim'

@description('Azure Container Apps Environment name')
param containerAppsEnvName string = 'wyoiwyget-cae'

@description('Azure Static Web App name')
param staticWebAppName string = 'wyoiwyget-swa'

@description('Azure Front Door name')
param frontDoorName string = 'wyoiwyget-fd'

@description('Azure Active Directory B2C tenant name')
param b2cTenantName string = 'wyoiwyget.onmicrosoft.com'

// Variables
var tags = {
  Environment: environment
  Project: projectName
  ManagedBy: 'Bicep'
  Owner: 'Wyoiwyget Team'
}

var resourcePrefix = '${projectName}-${environment}'

// Azure Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: {
    name: 'Premium'
  }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
    networkRuleBypassOptions: 'AzureServices'
  }
  tags: tags
}

// Azure Database for PostgreSQL
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: postgresServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: 'wyoiwygetadmin'
    administratorLoginPassword: 'YourSecurePassword123!'
    version: '15'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 30
      geoRedundantBackup: 'Enabled'
    }
    network: {
      delegatedSubnetResourceId: ''
      privateDnsZoneArmResourceId: ''
    }
  }
  tags: tags
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: 'wyoiwyget'
  properties: {
    charset: 'utf8'
    collation: 'en_US.utf8'
  }
}

// Azure Cosmos DB
resource cosmosDb 'Microsoft.DocumentDB/databaseAccounts@2023-11-15' = {
  name: cosmosDbName
  location: location
  kind: 'MongoDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableMongo'
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
      maxStalenessPrefix: 100
      maxIntervalInSeconds: 5
    }
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 8
      }
    }
  }
  tags: tags
}

resource cosmosDatabase 'Microsoft.DocumentDB/databaseAccounts/mongodbDatabases@2023-11-15' = {
  parent: cosmosDb
  name: 'wyoiwyget'
  properties: {
    resource: {
      id: 'wyoiwyget'
    }
    options: {
      throughput: 400
    }
  }
}

// Azure Cache for Redis
resource redis 'Microsoft.Cache/redis@2023-08-01' = {
  name: redisName
  location: location
  properties: {
    sku: {
      name: 'Standard'
      family: 'C'
      capacity: 1
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisConfiguration: {
      maxmemoryPolicy: 'allkeys-lru'
    }
  }
  tags: tags
}

// Azure Cognitive Search
resource searchService 'Microsoft.Search/searchServices@2023-11-01' = {
  name: searchName
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    replicaCount: 1
    partitionCount: 1
    hostingMode: 'default'
    publicNetworkAccess: 'Enabled'
    networkRuleSet: {
      ipRules: []
    }
  }
  tags: tags
}

// Azure Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
  tags: tags
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    cors: {
      corsRules: [
        {
          allowedOrigins: ['https://${domainName}']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD']
          allowedHeaders: ['*']
          exposedHeaders: ['*']
          maxAgeInSeconds: 86400
        }
      ]
    }
  }
}

resource uploadsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'uploads'
  properties: {
    publicAccess: 'None'
  }
}

resource avatarsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'avatars'
  properties: {
    publicAccess: 'None'
  }
}

resource productsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'products'
  properties: {
    publicAccess: 'Blob'
  }
}

// Azure Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'Standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
  tags: tags
}

// Azure API Management
resource apiManagement 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: apiManagementName
  location: location
  sku: {
    name: 'Developer'
    capacity: 1
  }
  properties: {
    publisherName: 'Wyoiwyget Team'
    publisherEmail: 'admin@wyoiwyget.com'
    virtualNetworkType: 'None'
    publicNetworkAccess: 'Enabled'
  }
  tags: tags
}

// Azure Container Apps Environment
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: containerAppsEnvName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: logAnalyticsWorkspace.listKeys().primarySharedKey
      }
    }
  }
  tags: tags
}

// Azure Static Web App
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: location
  properties: {
    branch: 'main'
    repositoryUrl: 'https://github.com/your-org/wyoiwyget'
    repositoryToken: 'your-github-token'
    buildProperties: {
      apiLocation: '/api'
      appLocation: '/frontend'
      outputLocation: '/out'
    }
  }
  tags: tags
}

// Azure Front Door
resource frontDoor 'Microsoft.Network/frontDoors@2020-11-01' = {
  name: frontDoorName
  location: 'Global'
  properties: {
    routingRules: [
      {
        name: 'routingRule1'
        properties: {
          frontendEndpoints: [
            {
              name: 'frontendEndpoint1'
            }
          ]
          acceptedProtocols: ['Http', 'Https']
          patternsToMatch: ['/*']
          routeConfiguration: {
            '@odata.type': '#Microsoft.Azure.FrontDoor.Models.FrontdoorForwardingConfiguration'
            forwardingProtocol: 'HttpsOnly'
            backendPool: {
              id: '${frontDoor.id}/backendPools/backendPool1'
            }
          }
        }
      }
    ]
    backendPools: [
      {
        name: 'backendPool1'
        properties: {
          backends: [
            {
              address: staticWebApp.properties.defaultHostname
              httpPort: 80
              httpsPort: 443
            }
          ]
          loadBalancingSettings: {
            id: '${frontDoor.id}/loadBalancingSettings/loadBalancingSettings1'
          }
          healthProbeSettings: {
            id: '${frontDoor.id}/healthProbeSettings/healthProbeSettings1'
          }
        }
      }
    ]
    frontendEndpoints: [
      {
        name: 'frontendEndpoint1'
        properties: {
          hostName: domainName
          sessionAffinityEnabledState: 'Enabled'
          sessionAffinityTtlSeconds: 300
        }
      }
    ]
    loadBalancingSettings: [
      {
        name: 'loadBalancingSettings1'
        properties: {
          sampleSize: 4
          successfulSamplesRequired: 2
          additionalLatencyMilliseconds: 0
        }
      }
    ]
    healthProbeSettings: [
      {
        name: 'healthProbeSettings1'
        properties: {
          path: '/health'
          protocol: 'Https'
          intervalInSeconds: 30
        }
      }
    ]
  }
  tags: tags
}

// Azure Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${resourcePrefix}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
  tags: tags
}

// Application Insights
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${resourcePrefix}-appinsights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
  }
  tags: tags
}

// Azure OpenAI Service (if available in region)
resource openAiService 'Microsoft.CognitiveServices/accounts@2023-05-01' = {
  name: openAiServiceName
  location: location
  sku: {
    name: 'S0'
  }
  kind: 'OpenAI'
  properties: {
    customSubDomainName: openAiServiceName
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
  tags: tags
}

// Outputs
output acrLoginServer string = acr.properties.loginServer
output postgresConnectionString string = 'Server=${postgresServer.properties.fullyQualifiedDomainName};Database=wyoiwyget;Port=5432;User Id=wyoiwygetadmin;Password=YourSecurePassword123!;Ssl Mode=Require;'
output redisConnectionString string = '${redis.name}.redis.cache.windows.net:6380,password=${redis.listKeys().primaryKey},ssl=True,abortConnect=False'
output cosmosConnectionString string = cosmosDb.listConnectionStrings().connectionStrings[0].connectionString
output searchKey string = searchService.listAdminKeys().primaryKey
output storageConnectionString string = storageAccount.listKeys().keys[0].value
output keyVaultUri string = keyVault.properties.vaultUri
output apiManagementUrl string = apiManagement.properties.gatewayUrl
output staticWebAppUrl string = staticWebApp.properties.defaultHostname
output frontDoorUrl string = frontDoor.properties.frontendEndpoints[0].properties.hostName
output applicationInsightsKey string = applicationInsights.properties.InstrumentationKey
output openAiEndpoint string = openAiService.properties.endpoint 
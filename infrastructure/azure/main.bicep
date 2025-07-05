@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Application name')
param appName string = 'wyoiwyget'

@description('Domain name for the application')
param domainName string = 'wyoiwyget.com'

@description('Admin email for SSL certificates')
param adminEmail string = 'admin@wyoiwyget.com'

@description('Database admin username')
param dbAdminUsername string = 'wyoiwyget_admin'

@description('Database admin password')
@secure()
param dbAdminPassword string

@description('Redis password')
@secure()
param redisPassword string

@description('Application Insights connection string')
@secure()
param appInsightsConnectionString string

@description('Azure OpenAI endpoint')
param openAiEndpoint string

@description('Azure OpenAI API key')
@secure()
param openAiApiKey string

@description('Stripe secret key')
@secure()
param stripeSecretKey string

@description('PayPal client ID')
@secure()
param paypalClientId string

@description('PayPal client secret')
@secure()
param paypalClientSecret string

@description('SendGrid API key')
@secure()
param sendGridApiKey string

@description('AWS SES access key ID')
@secure()
param awsSesAccessKeyId string

@description('AWS SES secret access key')
@secure()
param awsSesSecretAccessKey string

@description('Container registry username')
param acrUsername string

@description('Container registry password')
@secure()
param acrPassword string

// Variables
var resourcePrefix = '${appName}-${environment}'
var tags = {
  Environment: environment
  Application: appName
  ManagedBy: 'Bicep'
  Owner: 'Wyoiwyget Team'
}

// Container Registry
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${resourcePrefix}acr'
  location: location
  sku: {
    name: 'Premium'
  }
  properties: {
    adminUserEnabled: true
    encryption: {
      status: 'enabled'
    }
    networkRuleBypassOptions: 'AzureServices'
    publicNetworkAccess: 'Enabled'
  }
  tags: tags
}

// Virtual Network
resource vnet 'Microsoft.Network/virtualNetworks@2023-09-01' = {
  name: '${resourcePrefix}-vnet'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: ['10.0.0.0/16']
    }
    subnets: [
      {
        name: 'default'
        properties: {
          addressPrefix: '10.0.0.0/24'
          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
      {
        name: 'aks'
        properties: {
          addressPrefix: '10.0.1.0/24'
          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
      {
        name: 'database'
        properties: {
          addressPrefix: '10.0.2.0/24'
          networkSecurityGroup: {
            id: nsg.id
          }
        }
      }
    ]
  }
  tags: tags
}

// Network Security Group
resource nsg 'Microsoft.Network/networkSecurityGroups@2023-09-01' = {
  name: '${resourcePrefix}-nsg'
  location: location
  properties: {
    securityRules: [
      {
        name: 'AllowHTTPS'
        properties: {
          priority: 100
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
      {
        name: 'AllowHTTP'
        properties: {
          priority: 110
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
      {
        name: 'AllowSSH'
        properties: {
          priority: 120
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
        }
      }
      {
        name: 'AllowDatabase'
        properties: {
          priority: 130
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '10.0.0.0/16'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '5432'
        }
      }
      {
        name: 'AllowRedis'
        properties: {
          priority: 140
          protocol: 'Tcp'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '10.0.0.0/16'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '6379'
        }
      }
    ]
  }
  tags: tags
}

// Application Gateway
resource appGateway 'Microsoft.Network/applicationGateways@2023-09-01' = {
  name: '${resourcePrefix}-agw'
  location: location
  properties: {
    sku: {
      name: 'Standard_v2'
      tier: 'Standard_v2'
      capacity: 2
    }
    gatewayIPConfigurations: [
      {
        name: 'gatewayIPConfig'
        properties: {
          subnet: {
            id: subnet.id
          }
        }
      }
    ]
    frontendIPConfigurations: [
      {
        name: 'frontendIPConfig'
        properties: {
          publicIPAddress: {
            id: publicIP.id
          }
        }
      }
    ]
    frontendPorts: [
      {
        name: 'httpPort'
        properties: {
          port: 80
        }
      }
      {
        name: 'httpsPort'
        properties: {
          port: 443
        }
      }
    ]
    backendAddressPools: [
      {
        name: 'backendPool'
        properties: {
          backendAddresses: []
        }
      }
    ]
    backendHttpSettingsCollection: [
      {
        name: 'httpSettings'
        properties: {
          port: 80
          protocol: 'Http'
          cookieBasedAffinity: 'Enabled'
          requestTimeout: 30
        }
      }
    ]
    httpListeners: [
      {
        name: 'httpListener'
        properties: {
          frontendIPConfiguration: {
            id: appGateway.properties.frontendIPConfigurations[0].id
          }
          frontendPort: {
            id: appGateway.properties.frontendPorts[0].id
          }
          protocol: 'Http'
        }
      }
    ]
    requestRoutingRules: [
      {
        name: 'routingRule'
        properties: {
          ruleType: 'Basic'
          httpListener: {
            id: appGateway.properties.httpListeners[0].id
          }
          backendAddressPool: {
            id: appGateway.properties.backendAddressPools[0].id
          }
          backendHttpSettings: {
            id: appGateway.properties.backendHttpSettingsCollection[0].id
          }
        }
      }
    ]
  }
  tags: tags
}

// Public IP for Application Gateway
resource publicIP 'Microsoft.Network/publicIPAddresses@2023-09-01' = {
  name: '${resourcePrefix}-agw-ip'
  location: location
  sku: {
    name: 'Standard'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: {
      domainNameLabel: '${resourcePrefix}-agw'
    }
  }
  tags: tags
}

// Subnet for Application Gateway
resource subnet 'Microsoft.Network/virtualNetworks/subnets@2023-09-01' = {
  parent: vnet
  name: 'appgateway'
  properties: {
    addressPrefix: '10.0.3.0/24'
  }
}

// AKS Cluster
resource aks 'Microsoft.ContainerService/managedClusters@2023-10-02-preview' = {
  name: '${resourcePrefix}-aks'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    kubernetesVersion: '1.28.0'
    dnsPrefix: '${resourcePrefix}-aks'
    agentPoolProfiles: [
      {
        name: 'nodepool1'
        count: 3
        vmSize: 'Standard_D4s_v3'
        osType: 'Linux'
        mode: 'System'
        enableAutoScaling: true
        minCount: 1
        maxCount: 10
        vnetSubnetID: vnet.properties.subnets[1].id
        nodeLabels: {
          Environment: environment
        }
        tags: tags
      }
    ]
    networkProfile: {
      networkPlugin: 'azure'
      networkPolicy: 'azure'
      serviceCidr: '10.1.0.0/16'
      dnsServiceIP: '10.1.0.10'
      dockerBridgeCidr: '172.17.0.1/16'
    }
    addonProfiles: {
      httpApplicationRouting: {
        enabled: true
      }
      monitoring: {
        enabled: true
        config: {
          'logAnalyticsWorkspaceResourceID': logAnalyticsWorkspace.id
        }
      }
    }
    autoScalerProfile: {
      scaleDownDelayAfterAdd: '15m'
      scaleDownUnneeded: '10m'
      scaleDownUtilizationThreshold: 0.5
    }
  }
  tags: tags
}

// Log Analytics Workspace
resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${resourcePrefix}-logs'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
  }
  tags: tags
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${resourcePrefix}-appinsights'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
  }
  tags: tags
}

// PostgreSQL Flexible Server
resource postgresql 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: '${resourcePrefix}-postgres'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: dbAdminUsername
    administratorLoginPassword: dbAdminPassword
    version: '15'
    storage: {
      storageSizeGB: 32
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: vnet.properties.subnets[2].id
      privateDnsZoneArmResourceId: privateDnsZone.id
    }
  }
  tags: tags
}

// Private DNS Zone for PostgreSQL
resource privateDnsZone 'Microsoft.Network/privateDnsZones@2023-09-01' = {
  name: 'privatelink.postgres.database.azure.com'
  location: 'global'
  properties: {
    privateDnsZoneGroup: {
      name: 'default'
    }
  }
  tags: tags
}

// Redis Cache
resource redis 'Microsoft.Cache/redis@2023-08-01' = {
  name: '${resourcePrefix}-redis'
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
      maxmemoryReserved: '50'
    }
    networkAcls: {
      defaultAction: 'Deny'
      ipRules: []
      virtualNetworkRules: [
        {
          id: vnet.id
        }
      ]
    }
  }
  tags: tags
}

// Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${resourcePrefix}storage'
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
      defaultAction: 'Deny'
      ipRules: []
      virtualNetworkRules: [
        {
          id: vnet.id
        }
      ]
    }
    encryption: {
      services: {
        blob: {
          enabled: true
        }
        file: {
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
  tags: tags
}

// Blob Container for uploads
resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: storageAccount
  name: 'default/avatars'
  properties: {
    publicAccess: 'None'
  }
}

// Key Vault
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${resourcePrefix}-kv'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: aks.identity.principalId
        permissions: {
          secrets: ['get', 'list']
          certificates: ['get', 'list']
        }
      }
    ]
    enabledForDeployment: true
    enabledForTemplateDeployment: true
    enabledForDiskEncryption: true
    enableRbacAuthorization: false
    networkAcls: {
      defaultAction: 'Deny'
      ipRules: []
      virtualNetworkRules: [
        {
          id: vnet.id
        }
      ]
    }
  }
  tags: tags
}

// Secrets in Key Vault
resource dbPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'db-admin-password'
  properties: {
    value: dbAdminPassword
  }
}

resource redisPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'redis-password'
  properties: {
    value: redisPassword
  }
}

resource stripeSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'stripe-secret-key'
  properties: {
    value: stripeSecretKey
  }
}

resource paypalClientIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'paypal-client-id'
  properties: {
    value: paypalClientId
  }
}

resource paypalClientSecretSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'paypal-client-secret'
  properties: {
    value: paypalClientSecret
  }
}

resource sendGridApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'sendgrid-api-key'
  properties: {
    value: sendGridApiKey
  }
}

resource awsSesAccessKeyIdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'aws-ses-access-key-id'
  properties: {
    value: awsSesAccessKeyId
  }
}

resource awsSesSecretAccessKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'aws-ses-secret-access-key'
  properties: {
    value: awsSesSecretAccessKey
  }
}

resource acrPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'acr-password'
  properties: {
    value: acrPassword
  }
}

resource openAiApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'openai-api-key'
  properties: {
    value: openAiApiKey
  }
}

// CDN Profile
resource cdnProfile 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: '${resourcePrefix}-cdn'
  location: location
  sku: {
    name: 'Standard_Microsoft'
  }
  tags: tags
}

// CDN Endpoint
resource cdnEndpoint 'Microsoft.Cdn/profiles/endpoints@2023-05-01' = {
  parent: cdnProfile
  name: '${resourcePrefix}-cdn-endpoint'
  location: location
  properties: {
    originHostHeader: appGateway.properties.frontendIPConfigurations[0].properties.publicIPAddress.properties.dnsSettings.fqdn
    origins: [
      {
        name: 'origin'
        properties: {
          hostName: appGateway.properties.frontendIPConfigurations[0].properties.publicIPAddress.properties.dnsSettings.fqdn
          httpPort: 80
          httpsPort: 443
        }
      }
    ]
    isHttpAllowed: false
    isHttpsAllowed: true
    queryStringCachingBehavior: 'IgnoreQueryString'
    optimizationType: 'GeneralWebDelivery'
    geoFilters: []
    deliveryPolicy: {
      description: 'Delivery policy for Wyoiwyget'
      rules: [
        {
          name: 'CacheControl'
          order: 1
          conditions: [
            {
              name: 'UrlFileExtension'
              parameters: {
                operator: 'GreaterThan'
                matchValues: ['0']
                extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'css', 'js']
              }
            }
          ]
          actions: [
            {
              name: 'CacheExpiration'
              parameters: {
                cacheBehavior: 'SetIfMissing'
                cacheType: 'All'
                cacheDuration: '365.00:00:00'
              }
            }
          ]
        }
      ]
    }
  }
  tags: tags
}

// DNS Zone
resource dnsZone 'Microsoft.Network/dnsZones@2018-05-01' = {
  name: domainName
  location: 'global'
  tags: tags
}

// DNS Records
resource wwwRecord 'Microsoft.Network/dnsZones/A@2018-05-01' = {
  parent: dnsZone
  name: 'www'
  properties: {
    TTL: 300
    ARecords: [
      {
        ipv4Address: publicIP.properties.ipAddress
      }
    ]
  }
}

resource rootRecord 'Microsoft.Network/dnsZones/A@2018-05-01' = {
  parent: dnsZone
  name: '@'
  properties: {
    TTL: 300
    ARecords: [
      {
        ipv4Address: publicIP.properties.ipAddress
      }
    ]
  }
}

resource cdnRecord 'Microsoft.Network/dnsZones/CNAME@2018-05-01' = {
  parent: dnsZone
  name: 'cdn'
  properties: {
    TTL: 300
    CNAMERecord: {
      cname: cdnEndpoint.properties.hostName
    }
  }
}

// Outputs
output resourceGroupName string = resourceGroup().name
output aksName string = aks.name
output aksResourceId string = aks.id
output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output postgresqlServerName string = postgresql.name
output postgresqlServerFqdn string = postgresql.properties.fullyQualifiedDomainName
output redisCacheName string = redis.name
output redisCacheHostName string = redis.properties.hostName
output storageAccountName string = storageAccount.name
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output appInsightsName string = appInsights.name
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output appInsightsConnectionString string = appInsights.properties.ConnectionString
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
output publicIPAddress string = publicIP.properties.ipAddress
output publicIPFqdn string = publicIP.properties.dnsSettings.fqdn
output cdnEndpointHostName string = cdnEndpoint.properties.hostName
output domainName string = domainName 
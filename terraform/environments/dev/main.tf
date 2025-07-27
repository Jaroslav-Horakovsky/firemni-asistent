# =============================================================================
# DEVELOPMENT ENVIRONMENT MAIN TERRAFORM CONFIGURATION
# =============================================================================
# Development environment deployment using shared modules with dev-specific settings

# Local values for development environment
locals {
  environment = "dev"
  region     = var.region
  project_id = var.project_id
  
  # Common tags for all resources
  common_tags = {
    environment = local.environment
    project     = "firemni-asistent"
    managed_by  = "terraform"
    cost_center = "development"
  }
  
  # Development-specific service configuration
  services = {
    user-service        = { port = 8080, path = "/api/users" }
    order-service       = { port = 8081, path = "/api/orders" }
    billing-service     = { port = 8082, path = "/api/billing" }
    inventory-service   = { port = 8083, path = "/api/inventory" }
    notification-service = { port = 8084, path = "/api/notifications" }
    analytics-service   = { port = 8085, path = "/api/analytics" }
    gateway-service     = { port = 8086, path = "/" }
  }
}

# =============================================================================
# SECRETS MANAGEMENT
# =============================================================================
module "secrets" {
  source = "../../modules/secrets"
  
  # Environment-specific settings
  project_id  = local.project_id
  environment = local.environment
  region      = local.region
  
  # Development secret configuration
  secrets_config = {
    database_password = {
      secret_id = "database-password-dev"
      data      = null  # Populated externally
    }
    jwt_secret = {
      secret_id = "jwt-secret-dev"
      data      = null  # Populated externally
    }
    api_keys = {
      secret_id = "api-keys-dev"
      data      = null  # Populated externally
    }
  }
  
  # Development IAM settings (minimal permissions)
  iam_bindings = {
    secret_accessor = [
      "serviceAccount:${module.iam.service_accounts["cloud-run"].email}"
    ]
  }
  
  tags = local.common_tags
}

# =============================================================================
# CONTAINER REGISTRY
# =============================================================================
module "registry" {
  source = "../../modules/registry"
  
  # Environment-specific settings
  project_id  = local.project_id
  environment = local.environment
  region      = local.region
  
  # Development registry configuration
  registry_config = {
    format          = "DOCKER"
    cleanup_enabled = true
    cleanup_policy = {
      keep_tag_revisions = 5      # Keep fewer revisions in dev
      cleanup_days      = 7       # Clean up after 7 days
    }
  }
  
  # Development access permissions
  iam_bindings = {
    registry_reader = [
      "serviceAccount:${module.iam.service_accounts["cloud-run"].email}"
    ]
    registry_writer = [
      "serviceAccount:${module.iam.service_accounts["ci-cd"].email}"
    ]
  }
  
  tags = local.common_tags
}

# =============================================================================
# IAM CONFIGURATION
# =============================================================================
module "iam" {
  source = "../../modules/iam"
  
  # Environment-specific settings
  project_id  = local.project_id
  environment = local.environment
  region      = local.region
  
  # Development service accounts
  service_accounts = {
    cloud-run = {
      account_id   = "cloud-run-dev"
      display_name = "Cloud Run Service Account - Development"
      description  = "Service account for Cloud Run services in development"
    }
    ci-cd = {
      account_id   = "ci-cd-dev"
      display_name = "CI/CD Service Account - Development"
      description  = "Service account for CI/CD operations in development"
    }
    monitoring = {
      account_id   = "monitoring-dev"
      display_name = "Monitoring Service Account - Development"
      description  = "Service account for monitoring services in development"
    }
  }
  
  tags = local.common_tags
}

# =============================================================================
# STORAGE
# =============================================================================
module "storage" {
  source = "../../modules/storage"
  
  # Environment-specific settings
  project_id  = local.project_id
  environment = local.environment
  region      = local.region
  
  # Development storage configuration
  storage_config = var.storage_config
  
  # Development IAM bindings
  iam_bindings = {
    storage_admin = [
      "serviceAccount:${module.iam.service_accounts["cloud-run"].email}"
    ]
  }
  
  tags = local.common_tags
}

# =============================================================================
# NETWORKING
# =============================================================================
module "networking" {
  source = "../../modules/networking"
  
  # Environment-specific settings
  project_id  = local.project_id
  environment = local.environment
  region      = local.region
  
  # Development network configuration
  network_config = {
    create_nat_gateway = false    # No NAT for dev (cost optimization)
    enable_flow_logs   = false    # Disable flow logs for dev
    enable_firewall    = true     # Basic firewall rules
  }
  
  tags = local.common_tags
}

# =============================================================================
# DATABASES
# =============================================================================
module "databases" {
  source = "../../modules/databases"
  
  # Environment-specific settings
  project_id  = local.project_id
  environment = local.environment
  region      = local.region
  
  # Development database configuration
  database_config = var.database_config
  
  # Database access
  iam_bindings = {
    database_user = [
      "serviceAccount:${module.iam.service_accounts["cloud-run"].email}"
    ]
  }
  
  # Use secrets from secrets module
  database_password_secret = module.secrets.secret_ids["database-password-dev"]
  
  tags = local.common_tags
}

# =============================================================================
# CLOUD RUN SERVICES
# =============================================================================
module "cloud_run" {
  source = "../../modules/cloud-run"
  
  # Environment-specific settings
  project_id  = local.project_id
  environment = local.environment
  region      = local.region
  
  # Development scaling configuration
  scaling_config = var.scaling_config
  
  # Services configuration
  services = local.services
  service_configs = var.service_configs
  
  # Environment-specific settings
  container_registry = module.registry.registry_url
  service_account    = module.iam.service_accounts["cloud-run"].email
  
  # Database connection
  database_connection_name = module.databases.connection_name
  
  # Secrets
  secrets = {
    database_password = module.secrets.secret_ids["database-password-dev"]
    jwt_secret       = module.secrets.secret_ids["jwt-secret-dev"]
    api_keys         = module.secrets.secret_ids["api-keys-dev"]
  }
  
  tags = local.common_tags
  
  depends_on = [
    module.iam,
    module.secrets,
    module.databases,
    module.registry
  ]
}

# =============================================================================
# LOAD BALANCER
# =============================================================================
module "load_balancer" {
  source = "../../modules/load-balancer"
  
  # Environment-specific settings
  project_id  = local.project_id
  environment = local.environment
  region      = local.region
  
  # Development load balancer configuration
  domain_name = var.domain_name
  ssl_policy  = "MODERN"  # Modern SSL for dev testing
  
  # Services from Cloud Run
  services = {
    for name, config in local.services : name => {
      url  = module.cloud_run.service_urls[name]
      path = config.path
    }
  }
  
  # Development security settings
  security_config = var.security_config
  
  tags = local.common_tags
  
  depends_on = [module.cloud_run]
}

# =============================================================================
# MONITORING
# =============================================================================
module "monitoring" {
  source = "../../modules/monitoring"
  
  # Environment-specific settings
  project_id  = local.project_id
  environment = local.environment
  region      = local.region
  
  # Development monitoring configuration
  monitoring_config = var.monitoring_config
  
  # Services to monitor
  services = local.services
  
  # Cloud Run service names for monitoring
  cloud_run_services = keys(module.cloud_run.service_urls)
  
  # Database monitoring
  database_instance = module.databases.instance_name
  
  # Load balancer monitoring
  load_balancer_name = module.load_balancer.load_balancer_name
  
  # Notification channels (minimal for dev)
  notification_channels = var.monitoring_config.notification_channels
  
  tags = local.common_tags
  
  depends_on = [
    module.cloud_run,
    module.databases,
    module.load_balancer
  ]
}
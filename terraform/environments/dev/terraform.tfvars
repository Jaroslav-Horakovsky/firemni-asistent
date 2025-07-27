# =============================================================================
# DEVELOPMENT ENVIRONMENT CONFIGURATION
# =============================================================================
# Environment isolation for development deployments with minimal resource usage
# and debug-friendly settings for optimal developer experience

# Core Environment Settings
environment = "dev"
region     = "europe-west1"
project_id = "firemni-asistent-dev"

# Development-Specific Resource Naming
resource_prefix = "fa-dev"
domain_name     = "dev.firemni-asistent.cz"

# ========================
# DEVELOPMENT SCALING POLICY
# ========================
# Minimal resource allocation for cost optimization and fast iteration
scaling_config = {
  min_instances     = 0     # Allow scaling to zero for cost savings
  max_instances     = 3     # Limited scaling for dev workloads
  cpu_limit        = "1"    # Single CPU sufficient for dev testing
  memory_limit     = "512Mi" # Minimal memory for faster cold starts
  concurrency      = 50     # Lower concurrency for predictable behavior
  timeout          = "300"  # 5min timeout for debugging
}

# Development Database Configuration
database_config = {
  tier             = "db-f1-micro"        # Smallest tier for cost optimization
  disk_size        = 10                   # Minimal storage
  backup_enabled   = false                # Skip backups in dev
  maintenance_window = "saturday:02:00"   # Weekend maintenance
  insights_enabled = true                 # Keep monitoring for debugging
  deletion_protection = false             # Allow easy teardown
}

# Storage Configuration for Development
storage_config = {
  storage_class    = "STANDARD"           # Standard storage for dev data
  versioning       = false                # Disable versioning to save costs
  lifecycle_days   = 7                    # Short retention for dev data
  cdn_enabled      = false                # Skip CDN for internal dev
  cors_enabled     = true                 # Enable CORS for frontend dev
}

# Development Security & Access
security_config = {
  allowed_origins = [
    "http://localhost:3000",     # React dev server
    "http://localhost:8080",     # Vue dev server
    "https://dev.firemni-asistent.cz"
  ]
  ssl_redirect_enabled = false   # Allow HTTP for easier dev testing
  cloud_armor_enabled  = false   # Skip security rules in dev
  ip_whitelist = [
    "0.0.0.0/0"                  # Open access for dev (use VPN in staging/prod)
  ]
}

# Development Monitoring & Logging
monitoring_config = {
  log_level           = "DEBUG"            # Verbose logging for development
  metrics_enabled     = true               # Keep metrics for performance tuning
  alerting_enabled    = false              # No alerts for dev environment
  trace_sampling      = 1.0                # 100% tracing for complete visibility
  notification_channels = []               # No notifications in dev
}

# Development Feature Flags
feature_flags = {
  circuit_breaker_enabled    = true        # Test resilience patterns
  rate_limiting_enabled      = false       # Disable for easier testing
  audit_logging_enabled      = false       # Skip audit logs in dev
  performance_monitoring     = true        # Monitor performance during dev
  experimental_features      = true        # Enable experimental code
}

# Development Service Configuration
# Resource allocation optimized for fast iteration and debugging
service_configs = {
  user-service = {
    min_instances = 0
    max_instances = 2
    cpu_limit     = "0.5"
    memory_limit  = "256Mi"
    env_vars = {
      LOG_LEVEL = "DEBUG"
      DEBUG_MODE = "true"
    }
  }
  
  order-service = {
    min_instances = 0
    max_instances = 2
    cpu_limit     = "0.5"
    memory_limit  = "512Mi"
    env_vars = {
      LOG_LEVEL = "DEBUG"
      CIRCUIT_BREAKER_FAILURE_THRESHOLD = "10"  # Higher threshold for dev
    }
  }
  
  billing-service = {
    min_instances = 0
    max_instances = 1
    cpu_limit     = "0.5"
    memory_limit  = "256Mi"
    env_vars = {
      LOG_LEVEL = "DEBUG"
      SANDBOX_MODE = "true"        # Use sandbox payment processors
    }
  }
  
  inventory-service = {
    min_instances = 0
    max_instances = 1
    cpu_limit     = "0.5"
    memory_limit  = "256Mi"
    env_vars = {
      LOG_LEVEL = "DEBUG"
      MOCK_EXTERNAL_APIS = "true"  # Mock external inventory APIs
    }
  }
  
  notification-service = {
    min_instances = 0
    max_instances = 1
    cpu_limit     = "0.5"
    memory_limit  = "256Mi"
    env_vars = {
      LOG_LEVEL = "DEBUG"
      EMAIL_PROVIDER = "mock"      # Use mock email provider
    }
  }
  
  analytics-service = {
    min_instances = 0
    max_instances = 1
    cpu_limit     = "0.5"
    memory_limit  = "512Mi"
    env_vars = {
      LOG_LEVEL = "DEBUG"
      BATCH_SIZE = "10"            # Smaller batches for faster processing
    }
  }
  
  gateway-service = {
    min_instances = 1            # Keep gateway always running
    max_instances = 2
    cpu_limit     = "1"
    memory_limit  = "512Mi"
    env_vars = {
      LOG_LEVEL = "DEBUG"
      RATE_LIMITING_ENABLED = "false"
    }
  }
}

# Development CI/CD Configuration
cicd_config = {
  auto_deploy_enabled    = true            # Auto-deploy on dev branch push
  rollback_enabled       = true            # Quick rollback for dev experiments
  canary_enabled         = false           # No canary in dev
  approval_required      = false           # No manual approval for dev
  test_coverage_required = 0.0             # No coverage requirement in dev
  security_scan_required = false           # Skip security scans for speed
}
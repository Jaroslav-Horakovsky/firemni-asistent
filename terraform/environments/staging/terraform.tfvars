# =============================================================================
# STAGING ENVIRONMENT CONFIGURATION
# =============================================================================
# Pre-production environment for integration testing and production validation
# Production-like configuration with safety nets and comprehensive testing

# Core Environment Settings
environment = "staging"
region     = "europe-west1"
project_id = "firemni-asistent-staging"

# Staging-Specific Resource Naming
resource_prefix = "fa-staging"
domain_name     = "staging.firemni-asistent.cz"

# ========================
# STAGING SCALING POLICY
# ========================
# Production-like scaling for realistic performance testing
scaling_config = {
  min_instances     = 1     # Always-on for consistent testing
  max_instances     = 8     # Production-scale testing capability
  cpu_limit        = "2"    # Production-like CPU allocation
  memory_limit     = "1Gi"  # Production-like memory allocation
  concurrency      = 100    # Production-like concurrency
  timeout          = "900"  # 15min timeout for long-running operations
}

# Staging Database Configuration
database_config = {
  tier             = "db-g1-small"        # Production-like tier
  disk_size        = 50                   # Moderate storage for staging data
  backup_enabled   = true                 # Enable backups for recovery testing
  maintenance_window = "saturday:03:00"   # Weekend maintenance
  insights_enabled = true                 # Full monitoring enabled
  deletion_protection = true              # Protect staging data
}

# Storage Configuration for Staging
storage_config = {
  storage_class    = "STANDARD"           # Standard storage
  versioning       = true                 # Test versioning functionality
  lifecycle_days   = 30                   # Moderate retention for testing
  cdn_enabled      = true                 # Test CDN integration
  cors_enabled     = true                 # CORS for frontend integration testing
}

# Staging Security & Access
security_config = {
  allowed_origins = [
    "https://staging.firemni-asistent.cz",
    "https://test.firemni-asistent.cz"     # Additional test domains
  ]
  ssl_redirect_enabled = true             # Enforce HTTPS like production
  cloud_armor_enabled  = true             # Test security rules
  ip_whitelist = [
    "10.0.0.0/8",                         # Internal network access
    "203.0.113.0/24"                      # Office IP range (example)
  ]
}

# Staging Monitoring & Logging
monitoring_config = {
  log_level           = "INFO"            # Production-like logging level
  metrics_enabled     = true              # Full metrics collection
  alerting_enabled    = true              # Test alerting system
  trace_sampling      = 0.1               # 10% sampling like production
  notification_channels = [
    "projects/firemni-asistent-staging/notificationChannels/staging-alerts"
  ]
}

# Staging Feature Flags
feature_flags = {
  circuit_breaker_enabled    = true       # Full resilience testing
  rate_limiting_enabled      = true       # Test rate limiting
  audit_logging_enabled      = true       # Test audit capabilities
  performance_monitoring     = true       # Performance validation
  experimental_features      = false      # Stable features only
}

# Staging Service Configuration
# Production-like resource allocation for realistic integration testing
service_configs = {
  user-service = {
    min_instances = 1
    max_instances = 3
    cpu_limit     = "1"
    memory_limit  = "512Mi"
    env_vars = {
      LOG_LEVEL = "INFO"
      CACHE_TTL = "300"
    }
  }
  
  order-service = {
    min_instances = 1
    max_instances = 4
    cpu_limit     = "2"
    memory_limit  = "1Gi"
    env_vars = {
      LOG_LEVEL = "INFO"
      CIRCUIT_BREAKER_FAILURE_THRESHOLD = "5"  # Production-like threshold
    }
  }
  
  billing-service = {
    min_instances = 1
    max_instances = 2
    cpu_limit     = "1"
    memory_limit  = "512Mi"
    env_vars = {
      LOG_LEVEL = "INFO"
      SANDBOX_MODE = "true"        # Still use sandbox in staging
    }
  }
  
  inventory-service = {
    min_instances = 1
    max_instances = 2
    cpu_limit     = "1"
    memory_limit  = "512Mi"
    env_vars = {
      LOG_LEVEL = "INFO"
      MOCK_EXTERNAL_APIS = "false" # Use real APIs for integration testing
    }
  }
  
  notification-service = {
    min_instances = 1
    max_instances = 2
    cpu_limit     = "1"
    memory_limit  = "512Mi"
    env_vars = {
      LOG_LEVEL = "INFO"
      EMAIL_PROVIDER = "staging"   # Use staging email provider
    }
  }
  
  analytics-service = {
    min_instances = 1
    max_instances = 2
    cpu_limit     = "1"
    memory_limit  = "1Gi"
    env_vars = {
      LOG_LEVEL = "INFO"
      BATCH_SIZE = "100"           # Production-like batch size
    }
  }
  
  gateway-service = {
    min_instances = 2            # Always available for testing
    max_instances = 4
    cpu_limit     = "2"
    memory_limit  = "1Gi"
    env_vars = {
      LOG_LEVEL = "INFO"
      RATE_LIMITING_ENABLED = "true"
    }
  }
}

# Staging CI/CD Configuration
cicd_config = {
  auto_deploy_enabled    = true            # Auto-deploy from staging branch
  rollback_enabled       = true            # Quick rollback capability
  canary_enabled         = true            # Test canary deployments
  approval_required      = false           # No manual approval for staging
  test_coverage_required = 0.8             # Require 80% test coverage
  security_scan_required = true            # Full security scanning
  
  # Integration Testing Configuration
  integration_tests = {
    load_testing_enabled     = true        # Performance validation
    e2e_testing_enabled      = true        # End-to-end testing
    api_testing_enabled      = true        # API contract testing
    security_testing_enabled = true        # Security penetration testing
  }
  
  # Performance Testing Thresholds
  performance_thresholds = {
    response_time_p95       = "500ms"     # 95th percentile response time
    throughput_rps          = 100         # Requests per second
    error_rate_threshold    = "1%"        # Maximum error rate
    availability_sla        = "99.5%"     # Staging SLA target
  }
}

# Staging-Specific Testing Configuration
testing_config = {
  synthetic_monitoring = {
    enabled           = true
    check_frequency   = "5m"              # Every 5 minutes
    timeout          = "30s"
    locations        = ["europe-west1"]
  }
  
  chaos_engineering = {
    enabled                = true         # Test resilience patterns
    failure_injection_rate = 0.01         # 1% failure injection
    max_chaos_duration     = "10m"        # Maximum chaos duration
  }
  
  data_validation = {
    pii_data_allowed      = false         # No real PII in staging
    synthetic_data_only   = true          # Use synthetic test data
    data_retention_days   = 30            # Clean up test data
  }
}
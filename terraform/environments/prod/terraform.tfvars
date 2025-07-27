# =============================================================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# =============================================================================
# Production deployment with maximum reliability, security, and performance
# Optimized for 99.9% SLA with comprehensive monitoring and disaster recovery

# Core Environment Settings
environment = "prod"
region     = "europe-west1"
project_id = "firemni-asistent-prod"

# Production-Specific Resource Naming
resource_prefix = "fa-prod"
domain_name     = "firemni-asistent.cz"

# ========================
# PRODUCTION SCALING POLICY
# ========================
# High-availability scaling for production workloads with SLA guarantees
scaling_config = {
  min_instances     = 3     # Always-on for high availability
  max_instances     = 20    # Scale for peak traffic
  cpu_limit        = "4"    # High-performance CPU allocation
  memory_limit     = "2Gi"  # Sufficient memory for peak loads
  concurrency      = 200    # High concurrency for efficiency
  timeout          = "300"  # 5min timeout for production reliability
}

# Production Database Configuration
database_config = {
  tier             = "db-n1-standard-2"   # High-performance tier
  disk_size        = 500                  # Large storage for production data
  backup_enabled   = true                 # Critical backup protection
  maintenance_window = "sunday:02:00"     # Weekend maintenance window
  insights_enabled = true                 # Full performance monitoring
  deletion_protection = true              # Protect production data
  
  # High Availability Configuration
  availability_type = "REGIONAL"          # Regional availability for HA
  backup_configuration = {
    enabled                     = true
    start_time                 = "02:00"
    location                   = "europe-west1"
    point_in_time_recovery     = true
    transaction_log_retention  = 7        # 7 days of transaction logs
  }
}

# Storage Configuration for Production
storage_config = {
  storage_class    = "STANDARD"           # Standard storage for performance
  versioning       = true                 # Enable versioning for data protection
  lifecycle_days   = 365                  # Long retention for compliance
  cdn_enabled      = true                 # Global CDN for performance
  cors_enabled     = true                 # CORS for web application
  
  # Multi-region replication for disaster recovery
  replication = {
    enabled     = true
    destination = "europe-west3"          # Secondary region
  }
}

# Production Security & Access
security_config = {
  allowed_origins = [
    "https://firemni-asistent.cz",
    "https://www.firemni-asistent.cz"
  ]
  ssl_redirect_enabled = true             # Enforce HTTPS
  cloud_armor_enabled  = true             # Full security protection
  ip_whitelist = [
    "203.0.113.0/24",                     # Office IP range (example)
    "198.51.100.0/24"                     # Secondary office (example)
  ]
  
  # Advanced Security Features
  waf_rules = {
    rate_limiting = {
      requests_per_minute = 1000          # Rate limiting per IP
      burst_capacity     = 100
    }
    
    security_rules = [
      "owasp-crs-v030301-id942100-sqli",  # SQL injection protection
      "owasp-crs-v030301-id931130-php",   # PHP injection protection
      "owasp-crs-v030301-id932160-rce"    # Remote code execution protection
    ]
  }
}

# Production Monitoring & Logging
monitoring_config = {
  log_level           = "WARN"            # Production-appropriate logging
  metrics_enabled     = true              # Comprehensive metrics
  alerting_enabled    = true              # Critical alerting
  trace_sampling      = 0.01              # 1% sampling for performance
  notification_channels = [
    "projects/firemni-asistent-prod/notificationChannels/critical-alerts",
    "projects/firemni-asistent-prod/notificationChannels/performance-alerts",
    "projects/firemni-asistent-prod/notificationChannels/security-alerts"
  ]
  
  # SLA Monitoring
  sla_config = {
    availability_target     = 99.9         # 99.9% uptime SLA
    latency_target_p95     = "200ms"       # 95th percentile latency target
    error_rate_target      = "0.1%"        # Maximum error rate
    throughput_target      = 1000          # Minimum RPS capacity
  }
}

# Production Feature Flags
feature_flags = {
  circuit_breaker_enabled    = true       # Critical resilience protection
  rate_limiting_enabled      = true       # DDoS protection
  audit_logging_enabled      = true       # Compliance requirement
  performance_monitoring     = true       # Performance optimization
  experimental_features      = false      # Stable features only
  
  # Production Safety Features
  gradual_rollout_enabled    = true       # Gradual feature rollout
  feature_flag_monitoring    = true       # Monitor feature usage
  emergency_disable_enabled  = true       # Emergency feature disable
}

# Production Service Configuration
# High-availability resource allocation for production SLA
service_configs = {
  user-service = {
    min_instances = 2
    max_instances = 8
    cpu_limit     = "2"
    memory_limit  = "1Gi"
    env_vars = {
      LOG_LEVEL = "WARN"
      CACHE_TTL = "3600"                  # Longer cache for performance
    }
  }
  
  order-service = {
    min_instances = 3                     # Critical service - high availability
    max_instances = 12
    cpu_limit     = "4"
    memory_limit  = "2Gi"
    env_vars = {
      LOG_LEVEL = "WARN"
      CIRCUIT_BREAKER_FAILURE_THRESHOLD = "3"  # Strict production threshold
    }
  }
  
  billing-service = {
    min_instances = 2                     # Critical financial service
    max_instances = 6
    cpu_limit     = "2"
    memory_limit  = "1Gi"
    env_vars = {
      LOG_LEVEL = "WARN"
      SANDBOX_MODE = "false"              # Real payment processing
    }
  }
  
  inventory-service = {
    min_instances = 2
    max_instances = 6
    cpu_limit     = "2"
    memory_limit  = "1Gi"
    env_vars = {
      LOG_LEVEL = "WARN"
      MOCK_EXTERNAL_APIS = "false"        # Real external APIs
    }
  }
  
  notification-service = {
    min_instances = 2
    max_instances = 4
    cpu_limit     = "1"
    memory_limit  = "1Gi"
    env_vars = {
      LOG_LEVEL = "WARN"
      EMAIL_PROVIDER = "production"       # Production email provider
    }
  }
  
  analytics-service = {
    min_instances = 2
    max_instances = 6
    cpu_limit     = "2"
    memory_limit  = "2Gi"
    env_vars = {
      LOG_LEVEL = "WARN"
      BATCH_SIZE = "1000"                 # Large batches for efficiency
    }
  }
  
  gateway-service = {
    min_instances = 3                     # Critical gateway - high availability
    max_instances = 10
    cpu_limit     = "4"
    memory_limit  = "2Gi"
    env_vars = {
      LOG_LEVEL = "WARN"
      RATE_LIMITING_ENABLED = "true"
    }
  }
}

# Production CI/CD Configuration
cicd_config = {
  auto_deploy_enabled    = false           # Manual production deployment
  rollback_enabled       = true            # Critical rollback capability
  canary_enabled         = true            # Safe canary deployments
  approval_required      = true            # Manual approval required
  test_coverage_required = 0.9             # Require 90% test coverage
  security_scan_required = true            # Mandatory security scanning
  
  # Production Deployment Gates
  deployment_gates = {
    staging_tests_required     = true      # Must pass staging tests
    load_testing_required      = true      # Performance validation
    security_scan_required     = true      # Security validation
    manual_approval_required   = true      # Human oversight
    canary_health_check       = "10m"      # 10min canary validation
  }
  
  # Production SLA Requirements
  sla_requirements = {
    max_deployment_downtime   = "30s"      # Maximum downtime per deployment
    rollback_time_target      = "2m"       # Maximum rollback time
    health_check_timeout      = "5m"       # Health check validation time
    canary_traffic_percentage = 5          # Start with 5% traffic
  }
}

# Production Disaster Recovery
disaster_recovery = {
  backup_schedule = {
    database_backup_frequency = "daily"    # Daily database backups
    database_backup_retention = 30         # 30 days retention
    storage_backup_enabled    = true       # Storage backup
    cross_region_replication  = true       # Cross-region backup
  }
  
  recovery_targets = {
    rpo_target = "1h"                      # Recovery Point Objective: 1 hour
    rto_target = "4h"                      # Recovery Time Objective: 4 hours
  }
  
  failover_config = {
    automatic_failover_enabled = false     # Manual failover control
    health_check_interval     = "30s"      # Frequent health checking
    failover_threshold        = 3          # 3 failed checks trigger alert
  }
}

# Production Compliance & Governance
compliance_config = {
  gdpr_compliance        = true            # GDPR compliance enabled
  audit_trail_enabled    = true            # Full audit trail
  data_retention_policy  = 2555           # 7 years data retention
  encryption_at_rest     = true            # Data encryption
  encryption_in_transit  = true            # Transit encryption
  
  # Access Control
  rbac_enabled          = true             # Role-based access control
  mfa_required          = true             # Multi-factor authentication
  session_timeout       = 3600            # 1 hour session timeout
}
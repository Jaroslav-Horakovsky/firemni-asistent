# =============================================================================
# DEVELOPMENT ENVIRONMENT VARIABLES
# =============================================================================
# Input variables for development environment configuration

# Core Environment Variables
variable "project_id" {
  description = "GCP project ID for development environment"
  type        = string
}

variable "region" {
  description = "GCP region for development resources"
  type        = string
  default     = "europe-west1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "resource_prefix" {
  description = "Prefix for all resource names"
  type        = string
  default     = "fa-dev"
}

variable "domain_name" {
  description = "Domain name for development environment"
  type        = string
}

# Development Scaling Configuration
variable "scaling_config" {
  description = "Cloud Run scaling configuration for development"
  type = object({
    min_instances = number
    max_instances = number
    cpu_limit     = string
    memory_limit  = string
    concurrency   = number
    timeout       = string
  })
  default = {
    min_instances = 0
    max_instances = 3
    cpu_limit     = "1"
    memory_limit  = "512Mi"
    concurrency   = 50
    timeout       = "300"
  }
}

# Development Database Configuration
variable "database_config" {
  description = "Database configuration for development"
  type = object({
    tier                = string
    disk_size          = number
    backup_enabled     = bool
    maintenance_window = string
    insights_enabled   = bool
    deletion_protection = bool
  })
  default = {
    tier                = "db-f1-micro"
    disk_size          = 10
    backup_enabled     = false
    maintenance_window = "saturday:02:00"
    insights_enabled   = true
    deletion_protection = false
  }
}

# Development Storage Configuration
variable "storage_config" {
  description = "Storage configuration for development"
  type = object({
    storage_class  = string
    versioning     = bool
    lifecycle_days = number
    cdn_enabled    = bool
    cors_enabled   = bool
  })
  default = {
    storage_class  = "STANDARD"
    versioning     = false
    lifecycle_days = 7
    cdn_enabled    = false
    cors_enabled   = true
  }
}

# Development Security Configuration
variable "security_config" {
  description = "Security configuration for development"
  type = object({
    allowed_origins      = list(string)
    ssl_redirect_enabled = bool
    cloud_armor_enabled  = bool
    ip_whitelist        = list(string)
  })
  default = {
    allowed_origins = [
      "http://localhost:3000",
      "http://localhost:8080"
    ]
    ssl_redirect_enabled = false
    cloud_armor_enabled  = false
    ip_whitelist        = ["0.0.0.0/0"]
  }
}

# Development Monitoring Configuration
variable "monitoring_config" {
  description = "Monitoring configuration for development"
  type = object({
    log_level             = string
    metrics_enabled       = bool
    alerting_enabled      = bool
    trace_sampling        = number
    notification_channels = list(string)
  })
  default = {
    log_level             = "DEBUG"
    metrics_enabled       = true
    alerting_enabled      = false
    trace_sampling        = 1.0
    notification_channels = []
  }
}

# Development Feature Flags
variable "feature_flags" {
  description = "Feature flags for development environment"
  type = object({
    circuit_breaker_enabled = bool
    rate_limiting_enabled   = bool
    audit_logging_enabled   = bool
    performance_monitoring  = bool
    experimental_features   = bool
  })
  default = {
    circuit_breaker_enabled = true
    rate_limiting_enabled   = false
    audit_logging_enabled   = false
    performance_monitoring  = true
    experimental_features   = true
  }
}

# Development Service Configurations
variable "service_configs" {
  description = "Service-specific configurations for development"
  type = map(object({
    min_instances = number
    max_instances = number
    cpu_limit     = string
    memory_limit  = string
    env_vars      = map(string)
  }))
  default = {
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
  }
}

# Development CI/CD Configuration
variable "cicd_config" {
  description = "CI/CD configuration for development"
  type = object({
    auto_deploy_enabled    = bool
    rollback_enabled       = bool
    canary_enabled         = bool
    approval_required      = bool
    test_coverage_required = number
    security_scan_required = bool
  })
  default = {
    auto_deploy_enabled    = true
    rollback_enabled       = true
    canary_enabled         = false
    approval_required      = false
    test_coverage_required = 0.0
    security_scan_required = false
  }
}
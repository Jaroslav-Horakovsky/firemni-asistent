# Terraform Variables for Firemní Asistent Infrastructure

variable "project_id" {
  description = "The GCP project ID"
  type        = string
  validation {
    condition     = length(var.project_id) > 0
    error_message = "Project ID must not be empty."
  }
}

variable "region" {
  description = "The GCP region for resources"
  type        = string
  default     = "europe-west1"
  validation {
    condition = contains([
      "europe-west1", "europe-west3", "europe-west4", 
      "europe-central2", "us-central1", "us-east1"
    ], var.region)
    error_message = "Region must be a valid GCP region."
  }
}

variable "zone" {
  description = "The GCP zone for zonal resources"
  type        = string
  default     = "europe-west1-b"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = "firemni-asistent.com"
}

# Database Configuration
variable "database_config" {
  description = "Database configuration settings"
  type = object({
    tier                = string
    disk_size          = number
    disk_type          = string
    backup_enabled     = bool
    backup_start_time  = string
    backup_retention   = number
    maintenance_window = object({
      day  = number
      hour = number
    })
  })
  default = {
    tier                = "db-f1-micro"
    disk_size          = 20
    disk_type          = "PD_SSD"
    backup_enabled     = true
    backup_start_time  = "03:00"
    backup_retention   = 7
    maintenance_window = {
      day  = 7  # Sunday
      hour = 4  # 4 AM
    }
  }
}

# Production overrides for database
variable "database_config_production" {
  description = "Production database configuration overrides"
  type = object({
    tier                = string
    disk_size          = number
    backup_retention   = number
    availability_type  = string
  })
  default = {
    tier                = "db-custom-2-4096"
    disk_size          = 100
    backup_retention   = 30
    availability_type  = "REGIONAL"
  }
}

# Notification Configuration
variable "notification_channels" {
  description = "Notification channels for monitoring alerts"
  type = object({
    email = list(string)
    slack = list(object({
      webhook_url = string
      channel     = string
    }))
  })
  default = {
    email = []
    slack = []
  }
}

# Security Configuration
variable "security_config" {
  description = "Security configuration settings"
  type = object({
    enable_binary_authorization = bool
    enable_pod_security_policy  = bool
    enable_network_policy       = bool
    allowed_source_ranges       = list(string)
  })
  default = {
    enable_binary_authorization = false
    enable_pod_security_policy  = false
    enable_network_policy       = true
    allowed_source_ranges       = ["0.0.0.0/0"]  # Restrict in production
  }
}

# Cloud Run Configuration
variable "cloud_run_config" {
  description = "Cloud Run service configuration"
  type = object({
    timeout_seconds                = number
    max_instance_request_concurrency = number
    execution_environment          = string
    ingress                       = string
  })
  default = {
    timeout_seconds                = 300
    max_instance_request_concurrency = 100
    execution_environment          = "gen2"
    ingress                       = "all"
  }
}

# Monitoring Configuration
variable "monitoring_config" {
  description = "Monitoring and alerting configuration"
  type = object({
    enable_uptime_checks    = bool
    enable_log_based_metrics = bool
    log_retention_days      = number
    enable_profiling        = bool
  })
  default = {
    enable_uptime_checks    = true
    enable_log_based_metrics = true
    log_retention_days      = 30
    enable_profiling        = false
  }
}

# RabbitMQ Configuration (CloudAMQP)
variable "rabbitmq_config" {
  description = "RabbitMQ configuration for message queuing"
  type = object({
    plan         = string
    region       = string
    vhost        = string
    max_connections = number
  })
  default = {
    plan         = "lemur"  # Free tier for dev
    region       = "google-compute-engine::europe-west1"
    vhost        = "firemni-asistent"
    max_connections = 100
  }
}

# Production RabbitMQ overrides
variable "rabbitmq_config_production" {
  description = "Production RabbitMQ configuration overrides"
  type = object({
    plan            = string
    max_connections = number
  })
  default = {
    plan            = "tiger"  # Production tier
    max_connections = 1000
  }
}

# Container Image Tags
variable "image_tags" {
  description = "Container image tags for each service"
  type = map(string)
  default = {
    user-service         = "latest"
    customer-service     = "latest"
    order-service        = "latest"
    inventory-service    = "latest"
    billing-service      = "latest"
    notification-service = "latest"
    api-gateway         = "latest"
  }
}

# Feature Flags
variable "feature_flags" {
  description = "Feature flags for enabling/disabling infrastructure components"
  type = object({
    enable_cdn              = bool
    enable_memorystore     = bool
    enable_cloud_scheduler = bool
    enable_pubsub          = bool
    enable_bigquery        = bool
  })
  default = {
    enable_cdn              = false
    enable_memorystore     = false
    enable_cloud_scheduler = true
    enable_pubsub          = true
    enable_bigquery        = true
  }
}

# Cost Optimization
variable "cost_optimization" {
  description = "Cost optimization settings"
  type = object({
    enable_preemptible_instances = bool
    enable_committed_use_discounts = bool
    enable_sustained_use_discounts = bool
    budget_alert_threshold_percent = number
  })
  default = {
    enable_preemptible_instances   = false
    enable_committed_use_discounts = false
    enable_sustained_use_discounts = true
    budget_alert_threshold_percent = 80
  }
}
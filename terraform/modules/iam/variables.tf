# IAM Module Variables
# Creates service accounts and manages identity lifecycle (Hybrid IAM Pattern)
# NOTE: Individual resource permissions are managed by respective modules

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "labels" {
  description = "Labels to be applied to resources"
  type        = map(string)
  default     = {}
}

# Service Configuration
variable "services" {
  description = "List of service names that need service accounts"
  type        = list(string)
  default = [
    "user-service",
    "customer-service", 
    "order-service",
    "inventory-service",
    "billing-service",
    "notification-service",
    "api-gateway"
  ]
}

# Service Account Configuration
variable "service_account_config" {
  description = "Configuration for service accounts"
  type = object({
    description_template = string
    enable_workload_identity = bool
    kubernetes_service_accounts = optional(map(object({
      namespace = string
      name      = string
    })), {})
  })
  default = {
    description_template = "Service account for %s in %s environment"
    enable_workload_identity = false
    kubernetes_service_accounts = {}
  }
}

# CI/CD Service Accounts
variable "cicd_accounts" {
  description = "CI/CD service accounts configuration"
  type = map(object({
    display_name = string
    description  = string
    roles        = list(string)
  }))
  default = {
    cloudbuild = {
      display_name = "Cloud Build Service Account"
      description  = "Service account for Cloud Build CI/CD operations"
      roles = [
        "roles/cloudbuild.builds.builder",
        "roles/artifactregistry.writer",
        "roles/run.developer",
        "roles/secretmanager.secretAccessor"
      ]
    }
    deployment = {
      display_name = "Deployment Service Account"
      description  = "Service account for application deployments"
      roles = [
        "roles/run.developer",
        "roles/cloudsql.client",
        "roles/secretmanager.secretAccessor"
      ]
    }
  }
}

# Cross-Project Access
variable "cross_project_access" {
  description = "Cross-project service account access configuration"
  type = map(object({
    project_id = string
    roles      = list(string)
  }))
  default = {}
}

# Service Account Keys
variable "enable_service_account_keys" {
  description = "Enable creation of service account keys (not recommended for production)"
  type        = bool
  default     = false
}

variable "key_algorithm" {
  description = "Algorithm for service account keys"
  type        = string
  default     = "KEY_ALG_RSA_2048"
}

# Monitoring and Auditing
variable "enable_access_monitoring" {
  description = "Enable monitoring of service account access patterns"
  type        = bool
  default     = true
}

# Lifecycle Management
variable "enable_automatic_rotation" {
  description = "Enable automatic rotation of service account keys"
  type        = bool
  default     = false
}

variable "rotation_period_days" {
  description = "Number of days for service account key rotation"
  type        = number
  default     = 90
}

# Security Configuration
variable "disable_service_account_creation" {
  description = "Disable automatic service account creation at project level"
  type        = bool
  default     = false
}

variable "enable_domain_restricted_sharing" {
  description = "Enable domain-restricted sharing policy"
  type        = bool
  default     = true
}

variable "allowed_domains" {
  description = "Allowed domains for service account sharing"
  type        = list(string)
  default     = []
}

# Workload Identity Configuration
variable "gke_cluster_config" {
  description = "GKE cluster configuration for Workload Identity"
  type = object({
    cluster_name = optional(string, "")
    location     = optional(string, "")
    node_pools   = optional(list(string), [])
  })
  default = {
    cluster_name = ""
    location     = ""
    node_pools   = []
  }
}

# Backup and Recovery
variable "enable_service_account_backup" {
  description = "Enable backup of service account configurations"
  type        = bool
  default     = false
}

variable "backup_storage_location" {
  description = "Storage location for service account backups"
  type        = string
  default     = "EU"
}
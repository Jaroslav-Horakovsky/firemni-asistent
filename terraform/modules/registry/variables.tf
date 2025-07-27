# Registry Module Variables
# Creates Google Artifact Registry for container images

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for the registry"
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

# Registry Configuration
variable "registry_config" {
  description = "Artifact Registry configuration"
  type = object({
    repository_id = string
    format        = string
    description   = string
    mode          = optional(string, "STANDARD_REPOSITORY")
  })
  default = {
    repository_id = "firemni-asistent-images"
    format        = "DOCKER"
    description   = "Container images for Firemní Asistent microservices"
    mode          = "STANDARD_REPOSITORY"
  }
}

# Service Account Emails for IAM bindings
variable "service_account_emails" {
  description = "Service account emails that need registry access"
  type = map(string)
  default = {}
}

# CI/CD Configuration
variable "cicd_service_accounts" {
  description = "CI/CD service accounts that need push/pull access"
  type = list(string)
  default = []
}

# Registry Security Configuration
variable "enable_vulnerability_scanning" {
  description = "Enable vulnerability scanning for container images"
  type        = bool
  default     = true
}

variable "immutable_tags" {
  description = "Enable immutable tags to prevent tag overwriting"
  type        = bool
  default     = true
}

# Image Cleanup Configuration
variable "cleanup_policies" {
  description = "Cleanup policies for managing registry storage"
  type = object({
    enable_cleanup     = bool
    keep_tagged_images = number
    keep_recent_images = number
    older_than_days    = number
  })
  default = {
    enable_cleanup     = true
    keep_tagged_images = 10
    keep_recent_images = 5
    older_than_days    = 30
  }
}

# Multi-region Replication
variable "enable_multi_region" {
  description = "Enable multi-region replication for high availability"
  type        = bool
  default     = false
}

variable "replication_regions" {
  description = "Additional regions for registry replication"
  type        = list(string)
  default     = []
}

# Access Control
variable "public_access" {
  description = "Allow public read access to registry"
  type        = bool
  default     = false
}

variable "allowed_external_ips" {
  description = "External IP ranges allowed to access registry"
  type        = list(string)
  default     = []
}

# Integration Configuration
variable "enable_build_triggers" {
  description = "Enable Cloud Build integration"
  type        = bool
  default     = true
}

variable "notification_config" {
  description = "Pub/Sub notification configuration for registry events"
  type = object({
    enable_notifications = bool
    topic_name          = optional(string, "")
  })
  default = {
    enable_notifications = false
    topic_name          = ""
  }
}

# Cost Optimization
variable "storage_class" {
  description = "Storage class for registry data"
  type        = string
  default     = "STANDARD"
  validation {
    condition = contains([
      "STANDARD", "NEARLINE", "COLDLINE", "ARCHIVE"
    ], var.storage_class)
    error_message = "Storage class must be STANDARD, NEARLINE, COLDLINE, or ARCHIVE."
  }
}

# Backup Configuration
variable "enable_backup" {
  description = "Enable automated backup of registry metadata"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of days to retain registry backups"
  type        = number
  default     = 90
}
# Storage Module Variables
# Creates Google Cloud Storage buckets for file uploads, backups, and application data

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for storage resources"
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

# Service Account Emails for IAM bindings
variable "service_account_emails" {
  description = "Service account emails that need storage access"
  type        = map(string)
  default     = {}
}

# Storage Bucket Configuration
variable "bucket_configs" {
  description = "Configuration for storage buckets"
  type = map(object({
    description           = string
    storage_class        = optional(string, "STANDARD")
    location             = optional(string, "")  # Uses region if empty
    uniform_bucket_level_access = optional(bool, true)
    versioning_enabled   = optional(bool, false)
    retention_policy = optional(object({
      retention_period = number  # in seconds
      is_locked       = optional(bool, false)
    }))
    lifecycle_rules = optional(list(object({
      condition = object({
        age                        = optional(number)
        created_before            = optional(string)
        with_state               = optional(string)
        matches_storage_class    = optional(list(string))
        num_newer_versions       = optional(number)
        custom_time_before       = optional(string)
        days_since_custom_time   = optional(number)
        days_since_noncurrent_time = optional(number)
        noncurrent_time_before   = optional(string)
      })
      action = object({
        type          = string
        storage_class = optional(string)
      })
    })), [])
    cors_config = optional(list(object({
      origin          = list(string)
      method          = list(string)
      response_header = optional(list(string), [])
      max_age_seconds = optional(number, 3600)
    })), [])
    encryption = optional(object({
      default_kms_key_name = optional(string, "")
    }))
    public_access = optional(bool, false)
    allowed_roles = optional(list(string), ["roles/storage.objectViewer"])
  }))
  default = {
    uploads = {
      description = "User file uploads and temporary storage"
      storage_class = "STANDARD"
      versioning_enabled = false
      cors_config = [{
        origin = ["*"]
        method = ["GET", "POST", "PUT", "DELETE"]
        response_header = ["Content-Type", "Access-Control-Allow-Origin"]
        max_age_seconds = 3600
      }]
      lifecycle_rules = [{
        condition = {
          age = 90
        }
        action = {
          type = "Delete"
        }
      }]
    }
    backups = {
      description = "Application and database backups"
      storage_class = "COLDLINE"
      versioning_enabled = true
      lifecycle_rules = [
        {
          condition = {
            age = 30
            matches_storage_class = ["STANDARD"]
          }
          action = {
            type = "SetStorageClass"
            storage_class = "NEARLINE"
          }
        },
        {
          condition = {
            age = 90
            matches_storage_class = ["NEARLINE"]
          }
          action = {
            type = "SetStorageClass"
            storage_class = "COLDLINE"
          }
        },
        {
          condition = {
            age = 365
          }
          action = {
            type = "Delete"
          }
        }
      ]
    }
    logs = {
      description = "Application logs and audit trails"
      storage_class = "NEARLINE"
      versioning_enabled = false
      lifecycle_rules = [{
        condition = {
          age = 180  # 6 months for logs
        }
        action = {
          type = "Delete"
        }
      }]
    }
    media = {
      description = "Static media files and assets"
      storage_class = "STANDARD"
      versioning_enabled = false
      public_access = true
      cors_config = [{
        origin = ["*"]
        method = ["GET", "HEAD"]
        response_header = ["Content-Type", "Cache-Control"]
        max_age_seconds = 86400  # 24 hours
      }]
    }
  }
}

# CDN Configuration
variable "enable_cdn" {
  description = "Enable Cloud CDN for public buckets"
  type        = bool
  default     = false
}

variable "cdn_config" {
  description = "Cloud CDN configuration"
  type = object({
    cache_mode                   = optional(string, "CACHE_ALL_STATIC")
    client_ttl                  = optional(number, 3600)
    default_ttl                 = optional(number, 3600)
    max_ttl                     = optional(number, 86400)
    negative_caching            = optional(bool, true)
    serve_while_stale          = optional(number, 86400)
    enable_negative_caching_policy = optional(bool, true)
  })
  default = {
    cache_mode     = "CACHE_ALL_STATIC"
    client_ttl     = 3600
    default_ttl    = 3600
    max_ttl        = 86400
    negative_caching = true
    serve_while_stale = 86400
    enable_negative_caching_policy = true
  }
}

# Cross-Region Replication
variable "enable_cross_region_replication" {
  description = "Enable cross-region replication for critical buckets"
  type        = bool
  default     = false
}

variable "replication_config" {
  description = "Cross-region replication configuration"
  type = object({
    destination_region = string
    replicate_buckets = list(string)  # List of bucket names to replicate
    storage_class     = optional(string, "COLDLINE")
  })
  default = {
    destination_region = "us-central1"
    replicate_buckets = ["backups"]
    storage_class     = "COLDLINE"
  }
}

# Security Configuration
variable "enable_bucket_notifications" {
  description = "Enable Pub/Sub notifications for bucket events"
  type        = bool
  default     = false
}

variable "notification_events" {
  description = "Events to send notifications for"
  type        = list(string)
  default     = [
    "OBJECT_FINALIZE",
    "OBJECT_DELETE"
  ]
}

variable "notification_topic_name" {
  description = "Pub/Sub topic name for bucket notifications"
  type        = string
  default     = ""
}

# Access Control
variable "bucket_iam_members" {
  description = "Additional IAM members for bucket access"
  type = map(object({
    bucket = string
    role   = string
    member = string
  }))
  default = {}
}

# Monitoring Configuration
variable "enable_storage_monitoring" {
  description = "Enable monitoring and alerting for storage usage"
  type        = bool
  default     = true
}

variable "storage_alert_thresholds" {
  description = "Storage usage alert thresholds (in GB)"
  type = object({
    uploads_gb = optional(number, 100)
    backups_gb = optional(number, 500)
    logs_gb    = optional(number, 50)
    media_gb   = optional(number, 200)
  })
  default = {
    uploads_gb = 100
    backups_gb = 500
    logs_gb    = 50
    media_gb   = 200
  }
}

# Data Loss Prevention
variable "enable_dlp_scanning" {
  description = "Enable Data Loss Prevention scanning for uploaded files"
  type        = bool
  default     = false
}

variable "dlp_info_types" {
  description = "DLP info types to scan for"
  type        = list(string)
  default     = [
    "CREDIT_CARD_NUMBER",
    "EMAIL_ADDRESS", 
    "PHONE_NUMBER",
    "PERSON_NAME"
  ]
}

# Backup and Recovery
variable "enable_automatic_backup" {
  description = "Enable automatic backup of critical data"
  type        = bool
  default     = false
}

variable "backup_schedule" {
  description = "Cron schedule for automatic backups"
  type        = string
  default     = "0 2 * * *"  # Daily at 2 AM
}
# Storage Module - Google Cloud Storage buckets with CDN, replication, and security
# Terraform module for managing storage infrastructure

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.84"
    }
  }
}

# Local values for bucket naming and configuration
locals {
  # Create bucket names with environment prefix
  bucket_names = {
    for name, config in var.bucket_configs : name => "${var.project_id}-${var.environment}-${name}"
  }
  
  # Filter buckets that need cross-region replication
  replicated_buckets = var.enable_cross_region_replication ? {
    for name, config in var.bucket_configs : name => config
    if contains(var.replication_config.replicate_buckets, name)
  } : {}
  
  # Common labels for all resources
  common_labels = merge(var.labels, {
    environment = var.environment
    project     = var.project_id
    module      = "storage"
    managed_by  = "terraform"
  })
}

# Create primary storage buckets
resource "google_storage_bucket" "main" {
  for_each = var.bucket_configs
  
  name          = local.bucket_names[each.key]
  location      = each.value.location != "" ? each.value.location : var.region
  project       = var.project_id
  storage_class = each.value.storage_class
  
  labels = merge(local.common_labels, {
    bucket_type = each.key
    public      = each.value.public_access ? "true" : "false"
  })
  
  # Uniform bucket-level access
  uniform_bucket_level_access = each.value.uniform_bucket_level_access
  
  # Versioning configuration
  dynamic "versioning" {
    for_each = each.value.versioning_enabled ? [1] : []
    content {
      enabled = true
    }
  }
  
  # Retention policy
  dynamic "retention_policy" {
    for_each = each.value.retention_policy != null ? [each.value.retention_policy] : []
    content {
      retention_period = retention_policy.value.retention_period
      is_locked       = retention_policy.value.is_locked
    }
  }
  
  # Lifecycle rules
  dynamic "lifecycle_rule" {
    for_each = each.value.lifecycle_rules
    content {
      condition {
        age                        = lookup(lifecycle_rule.value.condition, "age", null)
        created_before            = lookup(lifecycle_rule.value.condition, "created_before", null)
        with_state               = lookup(lifecycle_rule.value.condition, "with_state", null)
        matches_storage_class    = lookup(lifecycle_rule.value.condition, "matches_storage_class", null)
        num_newer_versions       = lookup(lifecycle_rule.value.condition, "num_newer_versions", null)
        custom_time_before       = lookup(lifecycle_rule.value.condition, "custom_time_before", null)
        days_since_custom_time   = lookup(lifecycle_rule.value.condition, "days_since_custom_time", null)
        days_since_noncurrent_time = lookup(lifecycle_rule.value.condition, "days_since_noncurrent_time", null)
        noncurrent_time_before   = lookup(lifecycle_rule.value.condition, "noncurrent_time_before", null)
      }
      
      action {
        type          = lifecycle_rule.value.action.type
        storage_class = lookup(lifecycle_rule.value.action, "storage_class", null)
      }
    }
  }
  
  # CORS configuration
  dynamic "cors" {
    for_each = each.value.cors_config
    content {
      origin          = cors.value.origin
      method          = cors.value.method
      response_header = cors.value.response_header
      max_age_seconds = cors.value.max_age_seconds
    }
  }
  
  # Encryption configuration
  dynamic "encryption" {
    for_each = each.value.encryption != null && each.value.encryption.default_kms_key_name != "" ? [each.value.encryption] : []
    content {
      default_kms_key_name = encryption.value.default_kms_key_name
    }
  }
  
  # Public access prevention (unless explicitly enabled)
  public_access_prevention = each.value.public_access ? "inherited" : "enforced"
  
  # Force destroy for non-production environments
  force_destroy = var.environment != "production"
}

# Cross-region replication buckets
resource "google_storage_bucket" "replica" {
  for_each = local.replicated_buckets
  
  name          = "${local.bucket_names[each.key]}-replica"
  location      = var.replication_config.destination_region
  project       = var.project_id
  storage_class = var.replication_config.storage_class
  
  labels = merge(local.common_labels, {
    bucket_type = "${each.key}-replica"
    replica_of  = local.bucket_names[each.key]
  })
  
  # Match primary bucket configuration
  uniform_bucket_level_access = each.value.uniform_bucket_level_access
  
  dynamic "versioning" {
    for_each = each.value.versioning_enabled ? [1] : []
    content {
      enabled = true
    }
  }
  
  # Simpler lifecycle for replica buckets
  lifecycle_rule {
    condition {
      age = 730  # 2 years for replica data
    }
    action {
      type = "Delete"
    }
  }
  
  public_access_prevention = "enforced"  # Replicas are never public
  force_destroy = var.environment != "production"
}

# IAM bindings for service accounts
resource "google_storage_bucket_iam_member" "service_account_access" {
  for_each = {
    for combination in flatten([
      for bucket_name, bucket_config in var.bucket_configs : [
        for sa_name, sa_email in var.service_account_emails : [
          for role in bucket_config.allowed_roles : {
            bucket = local.bucket_names[bucket_name]
            sa     = sa_email
            role   = role
            key    = "${bucket_name}-${sa_name}-${replace(role, "/", "-")}"
          }
        ]
      ]
    ]) : combination.key => combination
  }
  
  bucket = each.value.bucket
  role   = each.value.role
  member = "serviceAccount:${each.value.sa}"
  
  depends_on = [google_storage_bucket.main]
}

# Additional IAM members
resource "google_storage_bucket_iam_member" "additional" {
  for_each = var.bucket_iam_members
  
  bucket = local.bucket_names[each.value.bucket]
  role   = each.value.role
  member = each.value.member
  
  depends_on = [google_storage_bucket.main]
}

# Cloud CDN for public buckets
resource "google_compute_backend_bucket" "cdn" {
  for_each = var.enable_cdn ? {
    for name, config in var.bucket_configs : name => config
    if config.public_access
  } : {}
  
  name        = "${var.project_id}-${var.environment}-${each.key}-backend"
  bucket_name = google_storage_bucket.main[each.key].name
  project     = var.project_id
  
  cdn_policy {
    cache_mode                   = var.cdn_config.cache_mode
    client_ttl                  = var.cdn_config.client_ttl
    default_ttl                 = var.cdn_config.default_ttl
    max_ttl                     = var.cdn_config.max_ttl
    negative_caching            = var.cdn_config.negative_caching
    serve_while_stale          = var.cdn_config.serve_while_stale
    
    dynamic "negative_caching_policy" {
      for_each = var.cdn_config.enable_negative_caching_policy ? [1] : []
      content {
        code = 404
        ttl  = 60
      }
    }
  }
}

# Pub/Sub topic for bucket notifications
resource "google_pubsub_topic" "bucket_notifications" {
  count = var.enable_bucket_notifications ? 1 : 0
  
  name    = var.notification_topic_name != "" ? var.notification_topic_name : "${var.project_id}-${var.environment}-storage-events"
  project = var.project_id
  
  labels = local.common_labels
}

# Bucket notifications
resource "google_storage_notification" "bucket_events" {
  for_each = var.enable_bucket_notifications ? var.bucket_configs : {}
  
  bucket         = google_storage_bucket.main[each.key].name
  payload_format = "JSON_API_V1"
  topic          = google_pubsub_topic.bucket_notifications[0].id
  event_types    = var.notification_events
  
  depends_on = [google_pubsub_topic.bucket_notifications]
}

# DLP inspection template
resource "google_data_loss_prevention_inspect_template" "storage_dlp" {
  count = var.enable_dlp_scanning ? 1 : 0
  
  parent       = "projects/${var.project_id}"
  display_name = "${var.environment}-storage-dlp-template"
  description  = "DLP template for storage bucket scanning"
  
  inspect_config {
    info_types {
      name = "CREDIT_CARD_NUMBER"
    }
    info_types {
      name = "EMAIL_ADDRESS"
    }
    info_types {
      name = "PHONE_NUMBER"
    }
    info_types {
      name = "PERSON_NAME"
    }
    
    min_likelihood = "POSSIBLE"
    
    limits {
      max_findings_per_item    = 100
      max_findings_per_request = 1000
    }
  }
}

# DLP job trigger for automatic scanning
resource "google_data_loss_prevention_job_trigger" "storage_scan" {
  count = var.enable_dlp_scanning ? 1 : 0
  
  parent       = "projects/${var.project_id}"
  display_name = "${var.environment}-storage-dlp-scan"
  description  = "Automatic DLP scanning for uploaded files"
  
  triggers {
    schedule {
      recurrence_period_duration = "86400s"  # Daily
    }
  }
  
  inspect_job {
    inspect_template_name = google_data_loss_prevention_inspect_template.storage_dlp[0].id
    
    storage_config {
      cloud_storage_options {
        file_set {
          url = "gs://${google_storage_bucket.main["uploads"].name}/*"
        }
        bytes_limit_per_file = 1073741824  # 1GB
        file_types          = ["TEXT_FILE", "IMAGE", "PDF"]
      }
    }
    
    actions {
      pub_sub {
        topic = var.enable_bucket_notifications ? google_pubsub_topic.bucket_notifications[0].id : ""
      }
    }
  }
  
  status = "HEALTHY"
}

# Storage monitoring - Bucket size alerts
resource "google_monitoring_alert_policy" "bucket_size" {
  for_each = var.enable_storage_monitoring ? var.storage_alert_thresholds : {}
  
  display_name = "${var.environment}-${each.key}-storage-size-alert"
  project      = var.project_id
  
  conditions {
    display_name = "Bucket size threshold exceeded"
    
    condition_threshold {
      filter         = "resource.type=\"gcs_bucket\" AND resource.labels.bucket_name=\"${local.bucket_names[replace(each.key, "_gb", "")]}\""
      duration       = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = each.value * 1073741824  # Convert GB to bytes
      
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
  
  notification_channels = []  # Will be populated by monitoring module
  
  alert_strategy {
    auto_close = "86400s"  # 24 hours
  }
  
  combiner = "OR"
  enabled  = true
}

# Cloud Function for automatic backup (if enabled)
resource "google_cloudfunctions_function" "backup" {
  count = var.enable_automatic_backup ? 1 : 0
  
  name        = "${var.project_id}-${var.environment}-storage-backup"
  project     = var.project_id
  region      = var.region
  description = "Automatic backup function for critical storage data"
  
  source_archive_bucket = google_storage_bucket.main["backups"].name
  source_archive_object = "backup-function.zip"  # Must be uploaded separately
  
  entry_point = "backupHandler"
  runtime     = "nodejs18"
  
  event_trigger {
    event_type = "providers/cloud.pubsub/eventTypes/topic.publish"
    resource   = google_pubsub_topic.bucket_notifications[0].name
  }
  
  environment_variables = {
    PROJECT_ID        = var.project_id
    ENVIRONMENT      = var.environment
    BACKUP_BUCKET    = google_storage_bucket.main["backups"].name
    BACKUP_SCHEDULE  = var.backup_schedule
  }
  
  labels = local.common_labels
}

# Cloud Scheduler job for backup function
resource "google_cloud_scheduler_job" "backup_schedule" {
  count = var.enable_automatic_backup ? 1 : 0
  
  name        = "${var.project_id}-${var.environment}-backup-schedule"
  project     = var.project_id
  region      = var.region
  description = "Scheduled backup job"
  schedule    = var.backup_schedule
  time_zone   = "UTC"
  
  pubsub_target {
    topic_name = google_pubsub_topic.bucket_notifications[0].id
    data       = base64encode(jsonencode({
      action = "backup"
      timestamp = timestamp()
    }))
  }
}
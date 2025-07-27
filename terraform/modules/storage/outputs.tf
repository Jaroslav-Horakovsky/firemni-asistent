# Storage Module Outputs
# Export storage bucket information and access details

# Primary bucket outputs
output "bucket_names" {
  description = "Map of bucket logical names to actual bucket names"
  value = {
    for name, bucket in google_storage_bucket.main : name => bucket.name
  }
}

output "bucket_urls" {
  description = "Map of bucket logical names to bucket URLs"
  value = {
    for name, bucket in google_storage_bucket.main : name => bucket.url
  }
}

output "bucket_self_links" {
  description = "Map of bucket logical names to self links"
  value = {
    for name, bucket in google_storage_bucket.main : name => bucket.self_link
  }
}

output "bucket_locations" {
  description = "Map of bucket logical names to their locations"
  value = {
    for name, bucket in google_storage_bucket.main : name => bucket.location
  }
}

# Replica bucket outputs (if cross-region replication is enabled)
output "replica_bucket_names" {
  description = "Map of replicated bucket names"
  value = var.enable_cross_region_replication ? {
    for name, bucket in google_storage_bucket.replica : name => bucket.name
  } : {}
}

output "replica_bucket_urls" {
  description = "Map of replicated bucket URLs"
  value = var.enable_cross_region_replication ? {
    for name, bucket in google_storage_bucket.replica : name => bucket.url
  } : {}
}

# CDN backend bucket outputs (if CDN is enabled)
output "cdn_backend_buckets" {
  description = "Map of CDN backend bucket names"
  value = var.enable_cdn ? {
    for name, backend in google_compute_backend_bucket.cdn : name => {
      name         = backend.name
      bucket_name  = backend.bucket_name
      self_link    = backend.self_link
    }
  } : {}
}

# Bucket access information
output "bucket_access_info" {
  description = "Bucket access information for applications"
  value = {
    for name, config in var.bucket_configs : name => {
      bucket_name    = google_storage_bucket.main[name].name
      public_access  = config.public_access
      cors_enabled   = length(config.cors_config) > 0
      versioning     = config.versioning_enabled
      storage_class  = config.storage_class
      location       = google_storage_bucket.main[name].location
    }
  }
}

# Service account IAM bindings summary
output "iam_bindings" {
  description = "Summary of IAM bindings created"
  value = {
    for binding_key, binding in google_storage_bucket_iam_member.service_account_access : binding_key => {
      bucket = binding.bucket
      role   = binding.role
      member = binding.member
    }
  }
}

# Notification configuration (if enabled)
output "notification_topic" {
  description = "Pub/Sub topic for bucket notifications"
  value = var.enable_bucket_notifications ? {
    name      = google_pubsub_topic.bucket_notifications[0].name
    id        = google_pubsub_topic.bucket_notifications[0].id
    project   = google_pubsub_topic.bucket_notifications[0].project
  } : null
}

output "bucket_notifications" {
  description = "Bucket notification configurations"
  value = var.enable_bucket_notifications ? {
    for name, notification in google_storage_notification.bucket_events : name => {
      bucket         = notification.bucket
      topic          = notification.topic
      event_types    = notification.event_types
      payload_format = notification.payload_format
    }
  } : {}
}

# DLP configuration outputs (if enabled)
output "dlp_inspect_template" {
  description = "DLP inspection template information"
  value = var.enable_dlp_scanning ? {
    name         = google_data_loss_prevention_inspect_template.storage_dlp[0].name
    display_name = google_data_loss_prevention_inspect_template.storage_dlp[0].display_name
    id           = google_data_loss_prevention_inspect_template.storage_dlp[0].id
  } : null
}

output "dlp_job_trigger" {
  description = "DLP job trigger information"
  value = var.enable_dlp_scanning ? {
    name         = google_data_loss_prevention_job_trigger.storage_scan[0].name
    display_name = google_data_loss_prevention_job_trigger.storage_scan[0].display_name
    status       = google_data_loss_prevention_job_trigger.storage_scan[0].status
  } : null
}

# Monitoring outputs
output "storage_alert_policies" {
  description = "Storage monitoring alert policy IDs"
  value = var.enable_storage_monitoring ? {
    for threshold_name, policy in google_monitoring_alert_policy.bucket_size : threshold_name => {
      name         = policy.name
      display_name = policy.display_name
      enabled      = policy.enabled
    }
  } : {}
}

# Backup configuration outputs (if enabled)
output "backup_function" {
  description = "Backup Cloud Function information"
  value = var.enable_automatic_backup ? {
    name         = google_cloudfunctions_function.backup[0].name
    https_trigger_url = google_cloudfunctions_function.backup[0].https_trigger_url
    region       = google_cloudfunctions_function.backup[0].region
    runtime      = google_cloudfunctions_function.backup[0].runtime
  } : null
}

output "backup_scheduler" {
  description = "Backup scheduler job information"
  value = var.enable_automatic_backup ? {
    name     = google_cloud_scheduler_job.backup_schedule[0].name
    schedule = google_cloud_scheduler_job.backup_schedule[0].schedule
    region   = google_cloud_scheduler_job.backup_schedule[0].region
    time_zone = google_cloud_scheduler_job.backup_schedule[0].time_zone
  } : null
}

# Storage usage information for monitoring
output "storage_usage_info" {
  description = "Storage usage information for monitoring dashboards"
  value = {
    buckets = {
      for name, bucket in google_storage_bucket.main : name => {
        name          = bucket.name
        location      = bucket.location
        storage_class = bucket.storage_class
        versioning    = var.bucket_configs[name].versioning_enabled
        lifecycle_rules_count = length(var.bucket_configs[name].lifecycle_rules)
        alert_threshold = var.enable_storage_monitoring ? lookup(var.storage_alert_thresholds, "${name}_gb", null) : null
      }
    }
    replication_enabled = var.enable_cross_region_replication
    cdn_enabled        = var.enable_cdn
    dlp_enabled        = var.enable_dlp_scanning
    backup_enabled     = var.enable_automatic_backup
  }
}

# Environment-specific outputs for service integration
output "integration_config" {
  description = "Configuration for service integration"
  value = {
    uploads_bucket = google_storage_bucket.main["uploads"].name
    media_bucket   = google_storage_bucket.main["media"].name
    logs_bucket    = google_storage_bucket.main["logs"].name
    backups_bucket = google_storage_bucket.main["backups"].name
    
    # CDN information for frontend services
    cdn_backends = var.enable_cdn ? {
      for name, backend in google_compute_backend_bucket.cdn : name => backend.name
    } : {}
    
    # Notification topic for event-driven processing
    notification_topic = var.enable_bucket_notifications ? google_pubsub_topic.bucket_notifications[0].name : ""
    
    # Environment-specific settings
    environment    = var.environment
    region        = var.region
    project_id    = var.project_id
  }
}

# Security and compliance outputs
output "security_config" {
  description = "Security and compliance configuration"
  value = {
    uniform_bucket_access = {
      for name, config in var.bucket_configs : name => config.uniform_bucket_level_access
    }
    public_buckets = [
      for name, config in var.bucket_configs : name if config.public_access
    ]
    encrypted_buckets = [
      for name, config in var.bucket_configs : name 
      if config.encryption != null && config.encryption.default_kms_key_name != ""
    ]
    versioned_buckets = [
      for name, config in var.bucket_configs : name if config.versioning_enabled
    ]
    dlp_scanning = var.enable_dlp_scanning
    retention_policies = {
      for name, config in var.bucket_configs : name => config.retention_policy
      if config.retention_policy != null
    }
  }
}

# Performance and cost optimization outputs
output "optimization_info" {
  description = "Performance and cost optimization information"
  value = {
    storage_classes = {
      for name, config in var.bucket_configs : name => config.storage_class
    }
    lifecycle_policies = {
      for name, config in var.bucket_configs : name => length(config.lifecycle_rules) > 0
    }
    cross_region_replication = {
      enabled = var.enable_cross_region_replication
      replicated_buckets = var.enable_cross_region_replication ? var.replication_config.replicate_buckets : []
      destination_region = var.enable_cross_region_replication ? var.replication_config.destination_region : ""
    }
    cdn_configuration = {
      enabled = var.enable_cdn
      cache_mode = var.enable_cdn ? var.cdn_config.cache_mode : ""
      ttl_settings = var.enable_cdn ? {
        client_ttl  = var.cdn_config.client_ttl
        default_ttl = var.cdn_config.default_ttl
        max_ttl     = var.cdn_config.max_ttl
      } : {}
    }
  }
}
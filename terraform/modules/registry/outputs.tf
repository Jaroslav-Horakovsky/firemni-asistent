# Registry Module Outputs

# Primary Repository Information
output "registry_url" {
  description = "Full URL of the primary Artifact Registry repository"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}"
}

output "registry_hostname" {
  description = "Registry hostname for Docker commands"
  value       = "${var.region}-docker.pkg.dev"
}

output "repository_id" {
  description = "Repository ID"
  value       = local.repository_id
}

output "repository_name" {
  description = "Full repository name"
  value       = google_artifact_registry_repository.main.name
}

# Repository URLs for all regions
output "registry_urls_all_regions" {
  description = "Registry URLs for all regions (primary and replicas)"
  value = {
    for region in local.all_regions : region => "${region}-docker.pkg.dev/${var.project_id}/${local.repository_id}"
  }
}

# Replica Repository Information
output "replica_repositories" {
  description = "Information about replica repositories"
  value = var.enable_multi_region ? {
    for region, repo in google_artifact_registry_repository.replicas : region => {
      name     = repo.name
      location = repo.location
      url      = "${region}-docker.pkg.dev/${var.project_id}/${local.repository_id}"
    }
  } : {}
}

# Service Account Information
output "registry_operator_service_account_email" {
  description = "Email of the registry operator service account"
  value       = google_service_account.registry_operator.email
}

output "registry_operator_service_account_id" {
  description = "ID of the registry operator service account"
  value       = google_service_account.registry_operator.id
}

# Docker Commands
output "docker_commands" {
  description = "Example Docker commands for interacting with the registry"
  value = {
    configure_auth = "gcloud auth configure-docker ${var.region}-docker.pkg.dev"
    tag_image     = "docker tag IMAGE_NAME ${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}/IMAGE_NAME:TAG"
    push_image    = "docker push ${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}/IMAGE_NAME:TAG"
    pull_image    = "docker pull ${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}/IMAGE_NAME:TAG"
  }
}

# Service-specific Image URLs
output "service_image_templates" {
  description = "Template URLs for service container images"
  value = {
    user_service         = "${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}/user-service"
    customer_service     = "${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}/customer-service"
    order_service        = "${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}/order-service"
    inventory_service    = "${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}/inventory-service"
    billing_service      = "${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}/billing-service"
    notification_service = "${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}/notification-service"
    api_gateway         = "${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}/api-gateway"
  }
}

# Cleanup Policy Information
output "cleanup_policy_info" {
  description = "Information about cleanup policies"
  value = var.cleanup_policies.enable_cleanup ? {
    enabled              = true
    keep_tagged_images   = var.cleanup_policies.keep_tagged_images
    keep_recent_images   = var.cleanup_policies.keep_recent_images
    older_than_days      = var.cleanup_policies.older_than_days
    regions_configured   = local.all_regions
  } : {
    enabled = false
  }
}

# Notification Configuration
output "notification_topic_name" {
  description = "Pub/Sub topic name for registry notifications"
  value       = var.notification_config.enable_notifications ? google_pubsub_topic.registry_notifications[0].name : null
}

output "notification_topic_id" {
  description = "Pub/Sub topic ID for registry notifications"
  value       = var.notification_config.enable_notifications ? google_pubsub_topic.registry_notifications[0].id : null
}

# Backup Configuration
output "backup_bucket_name" {
  description = "Storage bucket name for registry backups"
  value       = var.enable_backup ? google_storage_bucket.registry_backup[0].name : null
}

output "backup_bucket_url" {
  description = "Storage bucket URL for registry backups"
  value       = var.enable_backup ? google_storage_bucket.registry_backup[0].url : null
}

# Registry Configuration Summary
output "registry_configuration_summary" {
  description = "Summary of registry configuration"
  value = {
    environment            = var.environment
    format                = var.registry_config.format
    immutable_tags        = var.immutable_tags
    vulnerability_scanning = var.enable_vulnerability_scanning
    multi_region          = var.enable_multi_region
    regions               = local.all_regions
    public_access         = var.public_access
    cleanup_enabled       = var.cleanup_policies.enable_cleanup
    notifications_enabled = var.notification_config.enable_notifications
    backup_enabled        = var.enable_backup
    build_triggers_enabled = var.enable_build_triggers
  }
}

# Access Summary
output "access_summary" {
  description = "Summary of access permissions configured"
  value = {
    service_account_readers = length(var.service_account_emails)
    cicd_writers           = length(var.cicd_service_accounts)
    regions_configured     = length(local.all_regions)
    total_iam_bindings     = (
      length(var.service_account_emails) * length(local.all_regions) +  # readers
      length(var.cicd_service_accounts) * length(local.all_regions) +   # writers
      (var.public_access ? length(local.all_regions) : 0) +             # public access
      length(local.all_regions)                                         # registry operator
    )
  }
}

# Monitoring Information
output "monitoring_alert_policy_name" {
  description = "Name of the storage usage monitoring alert policy"
  value       = google_monitoring_alert_policy.registry_storage_alert.name
}

# Security Information
output "security_configuration" {
  description = "Security configuration summary"
  value = {
    immutable_tags           = var.immutable_tags
    vulnerability_scanning   = var.enable_vulnerability_scanning
    public_access           = var.public_access
    allowed_external_ips    = var.allowed_external_ips
    storage_class          = var.storage_class
  }
}

# Cost Optimization Information
output "cost_optimization_summary" {
  description = "Cost optimization features configured"
  value = {
    storage_class           = var.storage_class
    cleanup_policies_enabled = var.cleanup_policies.enable_cleanup
    backup_lifecycle_rules  = var.enable_backup
    multi_region           = var.enable_multi_region
    estimated_monthly_cost = var.environment == "production" ? "High" : "Low"
  }
}
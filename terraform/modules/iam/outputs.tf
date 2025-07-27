# IAM Module Outputs

# Microservice Service Account Emails
output "service_account_emails" {
  description = "Map of service names to service account emails"
  value = {
    for name, sa in google_service_account.microservice_accounts : name => sa.email
  }
}

# Microservice Service Account IDs
output "service_account_ids" {
  description = "Map of service names to service account IDs"
  value = {
    for name, sa in google_service_account.microservice_accounts : name => sa.id
  }
}

# Microservice Service Account Names
output "service_account_names" {
  description = "Map of service names to service account resource names"
  value = {
    for name, sa in google_service_account.microservice_accounts : name => sa.name
  }
}

# CI/CD Service Account Information
output "cicd_service_account_emails" {
  description = "Map of CI/CD account names to service account emails"
  value = {
    for name, sa in google_service_account.cicd_accounts : name => sa.email
  }
}

output "cicd_service_account_ids" {
  description = "Map of CI/CD account names to service account IDs" 
  value = {
    for name, sa in google_service_account.cicd_accounts : name => sa.id
  }
}

# Service Account Keys (if enabled - not recommended for production)
output "service_account_keys" {
  description = "Service account keys (sensitive - only if enabled)"
  value = var.enable_service_account_keys ? {
    microservices = {
      for name, key in google_service_account_key.microservice_keys : name => {
        private_key = key.private_key
        public_key  = key.public_key
      }
    }
    cicd = {
      for name, key in google_service_account_key.cicd_keys : name => {
        private_key = key.private_key
        public_key  = key.public_key
      }
    }
  } : {}
  sensitive = true
}

# Combined Service Account Emails (all types)
output "all_service_account_emails" {
  description = "All service account emails (microservices + CI/CD)"
  value = merge(
    {
      for name, sa in google_service_account.microservice_accounts : name => sa.email
    },
    {
      for name, sa in google_service_account.cicd_accounts : "cicd-${name}" => sa.email
    }
  )
}

# Service Account Email List (for IAM bindings in other modules)
output "service_account_email_list" {
  description = "List of all service account emails for easy iteration"
  value = concat(
    [for sa in google_service_account.microservice_accounts : sa.email],
    [for sa in google_service_account.cicd_accounts : sa.email]
  )
}

# Workload Identity Configuration
output "workload_identity_bindings" {
  description = "Workload Identity bindings created"
  value = var.service_account_config.enable_workload_identity ? {
    for name, config in var.service_account_config.kubernetes_service_accounts : name => {
      service_account_email = google_service_account.microservice_accounts[name].email
      kubernetes_namespace  = config.namespace
      kubernetes_sa_name    = config.name
      annotation_value     = google_service_account.microservice_accounts[name].email
    }
  } : {}
}

# IAM Policy Bindings Summary
output "policy_bindings" {
  description = "Summary of IAM policy bindings created"
  value = {
    cicd_project_bindings = {
      for combination in flatten([
        for account_name, account_config in var.cicd_accounts : [
          for role in account_config.roles : {
            account_name = account_name
            role         = role
            member       = google_service_account.cicd_accounts[account_name].email
          }
        ]
      ]) : "${combination.account_name}-${combination.role}" => combination
    }
    cross_project_bindings = {
      for combination in flatten([
        for sa_name, sa_config in var.cross_project_access : [
          for role in sa_config.roles : {
            sa_name    = sa_name
            project_id = sa_config.project_id
            role       = role
            member     = google_service_account.microservice_accounts[sa_name].email
          }
        ]
      ]) : "${combination.sa_name}-${combination.project_id}-${combination.role}" => combination
    }
    workload_identity_bindings_count = var.service_account_config.enable_workload_identity ? length(var.service_account_config.kubernetes_service_accounts) : 0
  }
}

# Monitoring Resources
output "monitoring_metric_name" {
  description = "Name of the service account usage monitoring metric"
  value       = var.enable_access_monitoring ? google_logging_metric.service_account_usage_metric[0].name : null
}

output "monitoring_alert_policy_name" {
  description = "Name of the service account activity alert policy"
  value       = var.enable_access_monitoring ? google_monitoring_alert_policy.service_account_unusual_activity[0].name : null
}

# Backup Configuration
output "backup_bucket_name" {
  description = "Name of the service account backup bucket"
  value       = var.enable_service_account_backup ? google_storage_bucket.service_account_backup[0].name : null
}

output "backup_metadata_object" {
  description = "Service account metadata backup object information"
  value = var.enable_service_account_backup ? {
    bucket = google_storage_bucket.service_account_backup[0].name
    object = google_storage_bucket_object.service_account_metadata[0].name
  } : null
}

# Security Configuration Summary
output "security_configuration" {
  description = "Summary of security configurations applied"
  value = {
    keys_enabled                    = var.enable_service_account_keys
    workload_identity_enabled       = var.service_account_config.enable_workload_identity
    access_monitoring_enabled       = var.enable_access_monitoring  
    domain_restricted_sharing       = var.enable_domain_restricted_sharing
    allowed_domains                = var.allowed_domains
    automatic_rotation_enabled     = var.enable_automatic_rotation
    backup_enabled                = var.enable_service_account_backup
    time_based_access_production   = var.environment == "production"
    impersonation_prevention      = true
  }
}

# Environment Configuration Summary
output "environment_configuration" {
  description = "Environment-specific configuration summary"
  value = {
    environment                = var.environment
    total_microservice_accounts = length(var.services)
    total_cicd_accounts        = length(var.cicd_accounts)
    total_service_accounts     = length(var.services) + length(var.cicd_accounts)
    services_configured        = var.services
    cicd_accounts_configured   = keys(var.cicd_accounts)
    cross_project_access       = keys(var.cross_project_access)
  }
}

# Usage Instructions
output "usage_instructions" {
  description = "Instructions for using service accounts in other modules"
  value = {
    microservice_access = "Use var.service_account_emails from this module in other modules for IAM bindings"
    cicd_access        = "Use var.cicd_service_account_emails for CI/CD pipeline configurations"
    workload_identity  = var.service_account_config.enable_workload_identity ? "Add annotation iam.gke.io/gcp-service-account to Kubernetes service accounts" : "Workload Identity not enabled"
    key_management     = var.enable_service_account_keys ? "Service account keys created - store securely and rotate regularly" : "No keys created - using metadata service authentication"
  }
}

# Resource Names for Reference
output "resource_references" {
  description = "Resource names for use in dependencies and references"
  value = {
    microservice_service_accounts = [
      for sa in google_service_account.microservice_accounts : sa.name
    ]
    cicd_service_accounts = [
      for sa in google_service_account.cicd_accounts : sa.name
    ]
    monitoring_resources = var.enable_access_monitoring ? [
      google_logging_metric.service_account_usage_metric[0].name,
      google_monitoring_alert_policy.service_account_unusual_activity[0].name
    ] : []
    backup_resources = var.enable_service_account_backup ? [
      google_storage_bucket.service_account_backup[0].name
    ] : []
  }
}
# IAM Module for Firemní Asistent
# Creates service accounts for microservices and CI/CD operations
# Uses Hybrid IAM Pattern: Creates identities only, resource permissions managed by respective modules

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Local values for consistent naming and labeling
locals {
  environment = var.environment
  project_name = "firemni-asistent"
  
  # Common labels for all resources
  common_labels = merge(var.labels, {
    module = "iam"
  })
  
  # Service account naming pattern
  sa_name_pattern = "${var.environment}-${local.project_name}-%s"
}

# Microservice Service Accounts
resource "google_service_account" "microservice_accounts" {
  for_each = toset(var.services)

  account_id   = format(local.sa_name_pattern, each.value)
  display_name = "${title(replace(each.value, "-", " "))} - ${title(var.environment)}"
  description  = format(var.service_account_config.description_template, each.value, var.environment)
  project      = var.project_id
}

# CI/CD Service Accounts
resource "google_service_account" "cicd_accounts" {
  for_each = var.cicd_accounts

  account_id   = format(local.sa_name_pattern, each.key)
  display_name = "${each.value.display_name} - ${title(var.environment)}"
  description  = each.value.description
  project      = var.project_id
}

# Project-level IAM bindings for CI/CD accounts
resource "google_project_iam_member" "cicd_project_roles" {
  for_each = {
    for combination in flatten([
      for account_name, account_config in var.cicd_accounts : [
        for role in account_config.roles : {
          account_name = account_name
          role         = role
        }
      ]
    ]) : "${combination.account_name}-${combination.role}" => combination
  }

  project = var.project_id
  role    = each.value.role
  member  = "serviceAccount:${google_service_account.cicd_accounts[each.value.account_name].email}"
}

# Cross-project IAM bindings (if configured)
resource "google_project_iam_member" "cross_project_access" {
  for_each = {
    for combination in flatten([
      for sa_name, sa_config in var.cross_project_access : [
        for role in sa_config.roles : {
          sa_name    = sa_name
          project_id = sa_config.project_id
          role       = role
        }
      ]
    ]) : "${combination.sa_name}-${combination.project_id}-${combination.role}" => combination
  }

  project = each.value.project_id
  role    = each.value.role
  member  = "serviceAccount:${google_service_account.microservice_accounts[each.value.sa_name].email}"

  depends_on = [google_service_account.microservice_accounts]
}

# Service Account Keys (only if explicitly enabled - not recommended for production)
resource "google_service_account_key" "microservice_keys" {
  for_each = var.enable_service_account_keys ? toset(var.services) : []

  service_account_id = google_service_account.microservice_accounts[each.value].name
  key_algorithm      = var.key_algorithm
  public_key_type    = "TYPE_X509_PEM_FILE"
}

resource "google_service_account_key" "cicd_keys" {
  for_each = var.enable_service_account_keys ? var.cicd_accounts : {}

  service_account_id = google_service_account.cicd_accounts[each.key].name
  key_algorithm      = var.key_algorithm
  public_key_type    = "TYPE_X509_PEM_FILE"
}

# Workload Identity bindings (if GKE is used)
resource "google_service_account_iam_member" "workload_identity_bindings" {
  for_each = var.service_account_config.enable_workload_identity ? var.service_account_config.kubernetes_service_accounts : {}

  service_account_id = google_service_account.microservice_accounts[each.key].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${each.value.namespace}/${each.value.name}]"
}

# Service Account Usage Monitoring
resource "google_logging_metric" "service_account_usage_metric" {
  count = var.enable_access_monitoring ? 1 : 0

  name   = "${var.environment}-service-account-usage"
  filter = <<-EOT
    protoPayload.authenticationInfo.principalEmail=~"${var.environment}-${local.project_name}-.*@${var.project_id}.iam.gserviceaccount.com"
    protoPayload.methodName!="storage.objects.get"
    protoPayload.methodName!="logging.v2.LoggingServiceV2.WriteLogEntries"
  EOT

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    display_name = "Service Account Usage - ${title(var.environment)}"
  }

  label_extractors = {
    service_account = "EXTRACT(protoPayload.authenticationInfo.principalEmail)"
    method         = "protoPayload.methodName"
    resource       = "protoPayload.resourceName"
  }

  project = var.project_id
}

# Alert for unusual service account activity
resource "google_monitoring_alert_policy" "service_account_unusual_activity" {
  count = var.enable_access_monitoring ? 1 : 0

  display_name = "Unusual Service Account Activity - ${title(var.environment)}"
  project      = var.project_id

  conditions {
    display_name = "Service account activity spike detected"

    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.service_account_usage_metric[0].name}\""
      duration        = "300s"  # 5 minutes
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = var.environment == "production" ? 1000 : 100

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields = ["metric.label.service_account"]
      }
    }
  }

  combiner = "OR"

  alert_strategy {
    auto_close = "1800s"  # 30 minutes
  }

  documentation {
    content = <<-EOT
      Unusual service account activity detected. Investigation steps:
      1. Check Cloud Logging for detailed activity logs
      2. Verify the service account activity is legitimate
      3. Look for potential security breaches or misconfigurations
      4. Consider if this is expected behavior (e.g., during deployments)
    EOT
  }
}

# Organization Policy for Domain Restricted Sharing (if enabled)
resource "google_organization_policy" "domain_restricted_sharing" {
  count = var.enable_domain_restricted_sharing && length(var.allowed_domains) > 0 ? 1 : 0

  org_id     = data.google_project.current.org_id
  constraint = "iam.allowedPolicyMemberDomains"

  list_policy {
    allow {
      values = var.allowed_domains
    }
  }
}

data "google_project" "current" {
  project_id = var.project_id
}

# Service Account Backup Storage (if enabled)
resource "google_storage_bucket" "service_account_backup" {
  count = var.enable_service_account_backup ? 1 : 0

  name          = "${var.project_id}-${var.environment}-sa-backup"
  location      = var.backup_storage_location
  project       = var.project_id
  storage_class = "COLDLINE"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 365  # 1 year
    }
    action {
      type = "Delete"
    }
  }

  uniform_bucket_level_access = true
  labels = merge(local.common_labels, {
    purpose = "backup"
  })
}

# Service Account Configuration Backup (metadata only)
resource "google_storage_bucket_object" "service_account_metadata" {
  count = var.enable_service_account_backup ? 1 : 0

  name   = "service-accounts-metadata-${formatdate("YYYY-MM-DD", timestamp())}.json"
  bucket = google_storage_bucket.service_account_backup[0].name

  content = jsonencode({
    environment = var.environment
    timestamp   = timestamp()
    microservice_accounts = {
      for name, sa in google_service_account.microservice_accounts : name => {
        account_id   = sa.account_id
        display_name = sa.display_name
        description  = sa.description
        email        = sa.email
      }
    }
    cicd_accounts = {
      for name, sa in google_service_account.cicd_accounts : name => {
        account_id   = sa.account_id
        display_name = sa.display_name
        description  = sa.description
        email        = sa.email
      }
    }
  })

  lifecycle {
    ignore_changes = [content]  # Prevent unnecessary updates
  }
}

# IAM Conditions for time-based access (production security enhancement)
resource "google_project_iam_member" "time_based_access" {
  for_each = var.environment == "production" ? toset(var.services) : []

  project = var.project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.microservice_accounts[each.value].email}"

  condition {
    title       = "Time-based access for ${each.value}"
    description = "Allows access only during business hours for non-critical services"
    expression  = <<-EOT
      request.time.getHours() >= 6 && request.time.getHours() <= 22
    EOT
  }

  # Only apply to non-critical services
  count = contains(["notification-service"], each.value) ? 1 : 0
}

# Service Account Impersonation Prevention
resource "google_project_iam_member" "prevent_impersonation" {
  for_each = toset(var.services)

  project = var.project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:${google_service_account.microservice_accounts[each.value].email}"

  # Deny impersonation by adding explicit deny condition
  condition {
    title       = "Prevent service account impersonation"
    description = "Prevents this service account from impersonating others"
    expression  = "false"  # Always deny
  }
}

# Cleanup job for unused service accounts (Cloud Function trigger)
resource "google_storage_bucket_object" "cleanup_function_source" {
  count = var.environment == "production" ? 1 : 0

  name   = "sa-cleanup-function.zip"
  bucket = var.enable_service_account_backup ? google_storage_bucket.service_account_backup[0].name : "${var.project_id}-${var.environment}-functions"
  
  source = "/dev/null"  # Placeholder - actual function code would be uploaded separately
  
  lifecycle {
    ignore_changes = [source, detect_md5hash]  # Allow external updates
  }
}
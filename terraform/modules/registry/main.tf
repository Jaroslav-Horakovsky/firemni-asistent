# Registry Module for Firemní Asistent
# Creates Google Artifact Registry for container images with security and cleanup policies

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
    module = "registry"
  })
  
  # Repository ID with environment prefix
  repository_id = "${var.environment}-${var.registry_config.repository_id}"
  
  # All regions (primary + replicas)
  all_regions = var.enable_multi_region ? 
    concat([var.region], var.replication_regions) : 
    [var.region]
}

# Primary Artifact Registry Repository
resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = local.repository_id
  description   = "${var.registry_config.description} - ${title(var.environment)} Environment"
  format        = var.registry_config.format
  mode          = var.registry_config.mode
  project       = var.project_id

  # Enable vulnerability scanning
  dynamic "docker_config" {
    for_each = var.registry_config.format == "DOCKER" ? [1] : []
    content {
      immutable_tags = var.immutable_tags
    }
  }

  labels = merge(local.common_labels, {
    registry_type = "primary"
    format        = lower(var.registry_config.format)
  })
}

# Multi-region Repository Replicas (if enabled)
resource "google_artifact_registry_repository" "replicas" {
  for_each = var.enable_multi_region ? toset(var.replication_regions) : []

  location      = each.value
  repository_id = local.repository_id
  description   = "${var.registry_config.description} - ${title(var.environment)} Environment (Replica)"
  format        = var.registry_config.format
  mode          = var.registry_config.mode
  project       = var.project_id

  dynamic "docker_config" {
    for_each = var.registry_config.format == "DOCKER" ? [1] : []
    content {
      immutable_tags = var.immutable_tags
    }
  }

  labels = merge(local.common_labels, {
    registry_type = "replica"
    format        = lower(var.registry_config.format)
    primary_region = var.region
  })
}

# IAM Bindings for Service Accounts (Reader access)
resource "google_artifact_registry_repository_iam_member" "service_account_readers" {
  for_each = {
    for combination in flatten([
      for region in local.all_regions : [
        for sa_name, sa_email in var.service_account_emails : {
          region   = region
          sa_name  = sa_name
          sa_email = sa_email
        }
      ]
    ]) : "${combination.region}-${combination.sa_name}" => combination
  }

  project    = var.project_id
  location   = each.value.region
  repository = local.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${each.value.sa_email}"

  depends_on = [
    google_artifact_registry_repository.main,
    google_artifact_registry_repository.replicas
  ]
}

# IAM Bindings for CI/CD Service Accounts (Writer access)
resource "google_artifact_registry_repository_iam_member" "cicd_writers" {
  for_each = {
    for combination in flatten([
      for region in local.all_regions : [
        for sa_email in var.cicd_service_accounts : {
          region   = region
          sa_email = sa_email
        }
      ]
    ]) : "${combination.region}-${replace(combination.sa_email, "@", "-at-")}" => combination
  }

  project    = var.project_id
  location   = each.value.region
  repository = local.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${each.value.sa_email}"

  depends_on = [
    google_artifact_registry_repository.main,
    google_artifact_registry_repository.replicas
  ]
}

# Public Access IAM Binding (if enabled)
resource "google_artifact_registry_repository_iam_member" "public_access" {
  for_each = var.public_access ? toset(local.all_regions) : []

  project    = var.project_id
  location   = each.value
  repository = local.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "allUsers"

  depends_on = [
    google_artifact_registry_repository.main,
    google_artifact_registry_repository.replicas
  ]
}

# Cloud Build Service Account Access (if build triggers enabled)
resource "google_project_iam_member" "cloudbuild_artifactregistry_writer" {
  count = var.enable_build_triggers ? 1 : 0

  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${data.google_project.current.number}@cloudbuild.gserviceaccount.com"
}

data "google_project" "current" {
  project_id = var.project_id
}

# Cleanup Policy for Repository
resource "google_artifact_registry_repository_cleanup_policy" "cleanup_policy" {
  count = var.cleanup_policies.enable_cleanup ? 1 : 0

  location   = var.region
  repository = google_artifact_registry_repository.main.name
  policy_id  = "${local.repository_id}-cleanup"
  project    = var.project_id

  action = "DELETE"

  condition {
    # Keep recent images
    newer_than = "${var.cleanup_policies.older_than_days}d"
  }

  condition {
    # Keep tagged images
    tag_state = "TAGGED"
  }

  most_recent_versions {
    keep_count = var.cleanup_policies.keep_recent_images
  }
}

# Cleanup Policies for Replica Repositories
resource "google_artifact_registry_repository_cleanup_policy" "replica_cleanup_policies" {
  for_each = var.cleanup_policies.enable_cleanup && var.enable_multi_region ? toset(var.replication_regions) : []

  location   = each.value
  repository = google_artifact_registry_repository.replicas[each.value].name
  policy_id  = "${local.repository_id}-cleanup"
  project    = var.project_id

  action = "DELETE"

  condition {
    newer_than = "${var.cleanup_policies.older_than_days}d"
  }

  condition {
    tag_state = "TAGGED"
  }

  most_recent_versions {
    keep_count = var.cleanup_policies.keep_recent_images
  }
}

# Pub/Sub Topic for Registry Notifications (if enabled)
resource "google_pubsub_topic" "registry_notifications" {
  count = var.notification_config.enable_notifications ? 1 : 0

  name    = var.notification_config.topic_name != "" ? var.notification_config.topic_name : "${var.environment}-${local.project_name}-registry-events"
  project = var.project_id

  labels = local.common_labels
}

# Registry Event Notifications (if enabled)
resource "google_artifact_registry_repository_notification_config" "notifications" {
  count = var.notification_config.enable_notifications ? 1 : 0

  location   = var.region
  repository = google_artifact_registry_repository.main.name
  project    = var.project_id

  pubsub_topic = google_pubsub_topic.registry_notifications[0].id

  # Notify on image push/delete events
  event_filters {
    event_type = "PACKAGE_VERSION_CREATED"
  }

  event_filters {
    event_type = "PACKAGE_VERSION_DELETED"
  }
}

# Storage Bucket for Registry Backups (if enabled)
resource "google_storage_bucket" "registry_backup" {
  count = var.enable_backup ? 1 : 0

  name          = "${var.project_id}-${var.environment}-registry-backup"
  location      = "EU"
  project       = var.project_id
  storage_class = var.storage_class

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = var.backup_retention_days
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      age = 7
      matches_storage_class = ["STANDARD"]
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  uniform_bucket_level_access = true
  labels = merge(local.common_labels, {
    purpose = "backup"
  })
}

# Service Account for Registry Operations
resource "google_service_account" "registry_operator" {
  account_id   = "${var.environment}-${local.project_name}-registry-operator"
  display_name = "Registry Operator - ${title(var.environment)}"
  description  = "Service account for registry operations and maintenance"
  project      = var.project_id
}

# IAM Bindings for Registry Operator
resource "google_artifact_registry_repository_iam_member" "registry_operator" {
  for_each = toset(local.all_regions)

  project    = var.project_id
  location   = each.value
  repository = local.repository_id
  role       = "roles/artifactregistry.admin"
  member     = "serviceAccount:${google_service_account.registry_operator.email}"

  depends_on = [
    google_artifact_registry_repository.main,
    google_artifact_registry_repository.replicas
  ]
}

# Monitoring for Registry Usage
resource "google_monitoring_alert_policy" "registry_storage_alert" {
  display_name = "Registry Storage Usage High - ${title(var.environment)}"
  project      = var.project_id

  conditions {
    display_name = "Registry storage usage exceeds threshold"

    condition_threshold {
      filter          = "resource.type=\"artifact_registry_repository\" AND resource.labels.repository_name=\"${local.repository_id}\""
      duration        = "600s"  # 10 minutes
      comparison      = "COMPARISON_GREATER_THAN"
      threshold_value = var.environment == "production" ? 50 : 10  # GB

      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  combiner = "OR"

  alert_strategy {
    auto_close = "86400s"  # 24 hours
  }

  documentation {
    content = <<-EOT
      Registry storage usage is high. Consider:
      1. Reviewing cleanup policies
      2. Removing unused images
      3. Optimizing image sizes
      4. Checking for runaway CI/CD processes
    EOT
  }
}

# Security Scanning Configuration (if supported by format)
resource "google_container_analysis_occurrence" "vulnerability_scan_config" {
  count = var.enable_vulnerability_scanning && var.registry_config.format == "DOCKER" ? 1 : 0

  name        = "projects/${var.project_id}/occurrences/${local.repository_id}-vuln-scan-config"
  resource_uri = "https://${var.region}-docker.pkg.dev/${var.project_id}/${local.repository_id}"
  note_name   = "projects/goog-analysis/notes/PACKAGE_VULNERABILITY"

  vulnerability {
    severity = "HIGH"
    
    package_issue {
      affected_cpe_uri    = "cpe:/o:canonical:ubuntu_linux:20.04"
      affected_package    = "example-package"
      affected_version {
        epoch    = 0
        name     = "1.0.0"
        revision = "1"
      }
    }
  }
}
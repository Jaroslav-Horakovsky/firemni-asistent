# Databases Module for Firemní Asistent
# Creates Cloud SQL PostgreSQL instance and databases for all microservices

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Random password for database root user
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Cloud SQL PostgreSQL Instance
resource "google_sql_database_instance" "main" {
  name             = "${var.environment}-firemni-asistent-db"
  database_version = var.database_version
  region          = var.region
  project         = var.project_id

  deletion_protection = var.environment == "production"

  settings {
    tier                        = var.database_config.tier
    availability_type          = var.database_config.availability_type
    disk_size                  = var.database_config.disk_size
    disk_type                  = var.database_config.disk_type
    disk_autoresize           = true
    disk_autoresize_limit     = var.database_config.max_disk_size

    backup_configuration {
      enabled                        = var.database_config.backup_enabled
      start_time                     = var.database_config.backup_start_time
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = var.database_config.transaction_log_retention_days
      backup_retention_settings {
        retained_backups = var.database_config.backup_retention
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = var.database_config.maintenance_window.day
      hour         = var.database_config.maintenance_window.hour
      update_track = "stable"
    }

    database_flags {
      name  = "log_statement"
      value = var.environment == "production" ? "none" : "all"
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = var.environment == "production" ? "1000" : "100"
    }

    database_flags {
      name  = "max_connections"
      value = var.database_config.max_connections
    }

    database_flags {
      name  = "shared_preload_libraries"
      value = "pg_stat_statements"
    }

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.network_id
      enable_private_path_for_google_cloud_services = true
      
      dynamic "authorized_networks" {
        for_each = var.authorized_networks
        content {
          name  = authorized_networks.value.name
          value = authorized_networks.value.cidr
        }
      }
    }

    insights_config {
      query_insights_enabled  = var.environment == "production"
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    user_labels = var.labels
  }

  depends_on = [var.network_dependency]
}

# Database root user
resource "google_sql_user" "root" {
  name     = "postgres"
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
  project  = var.project_id
}

# Application user for microservices
resource "google_sql_user" "app_user" {
  name     = "${var.environment}_firemni_asistent_app"
  instance = google_sql_database_instance.main.name
  password = random_password.app_user_password.result
  project  = var.project_id
}

resource "random_password" "app_user_password" {
  length  = 32
  special = false
}

# Databases for each microservice
resource "google_sql_database" "service_databases" {
  for_each = var.service_databases

  name      = "${var.environment}_${each.key}_db"
  instance  = google_sql_database_instance.main.name
  charset   = "UTF8"
  collation = "en_US.UTF8"
  project   = var.project_id
}

# Read replica for production (if enabled)
resource "google_sql_database_instance" "read_replica" {
  count               = var.enable_read_replica ? 1 : 0
  name               = "${var.environment}-firemni-asistent-db-replica"
  master_instance_name = google_sql_database_instance.main.name
  region             = var.replica_region != "" ? var.replica_region : var.region
  database_version   = var.database_version
  project            = var.project_id

  replica_configuration {
    failover_target = false
  }

  settings {
    tier              = var.replica_tier != "" ? var.replica_tier : var.database_config.tier
    availability_type = "ZONAL"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.network_id
    }

    user_labels = merge(var.labels, {
      role = "replica"
    })
  }
}

# Database connection pooler using PgBouncer (if enabled)
resource "google_sql_database" "pgbouncer_db" {
  count     = var.enable_connection_pooling ? 1 : 0
  name      = "${var.environment}_pgbouncer"
  instance  = google_sql_database_instance.main.name
  charset   = "UTF8"
  collation = "en_US.UTF8"
  project   = var.project_id
}

# SSL certificates for secure connections
resource "google_sql_ssl_cert" "client_cert" {
  count       = var.enable_ssl_certs ? 1 : 0
  common_name = "${var.environment}-firemni-asistent-client"
  instance    = google_sql_database_instance.main.name
  project     = var.project_id
}

# Database monitoring user (read-only)
resource "google_sql_user" "monitoring_user" {
  count    = var.enable_monitoring_user ? 1 : 0
  name     = "${var.environment}_monitoring"
  instance = google_sql_database_instance.main.name
  password = random_password.monitoring_password[0].result
  project  = var.project_id
}

resource "random_password" "monitoring_password" {
  count   = var.enable_monitoring_user ? 1 : 0
  length  = 32
  special = false
}

# Database migration user (for CI/CD)
resource "google_sql_user" "migration_user" {
  count    = var.enable_migration_user ? 1 : 0
  name     = "${var.environment}_migration"
  instance = google_sql_database_instance.main.name
  password = random_password.migration_password[0].result
  project  = var.project_id
}

resource "random_password" "migration_password" {
  count   = var.enable_migration_user ? 1 : 0
  length  = 32
  special = false
}

# Backup bucket for manual database exports
resource "google_storage_bucket" "db_backups" {
  count    = var.enable_backup_bucket ? 1 : 0
  name     = "${var.project_id}-${var.environment}-db-backups"
  location = var.region
  project  = var.project_id

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }

  uniform_bucket_level_access = true
  
  labels = var.labels
}

# Service account for database operations
resource "google_service_account" "db_service_account" {
  account_id   = "${var.environment}-db-ops"
  display_name = "Database Operations Service Account"
  description  = "Service account for database operations and backups"
  project      = var.project_id
}

# IAM binding for database service account
resource "google_project_iam_member" "db_service_account_sql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.db_service_account.email}"
}

resource "google_project_iam_member" "db_service_account_sql_instance_user" {
  project = var.project_id
  role    = "roles/cloudsql.instanceUser"
  member  = "serviceAccount:${google_service_account.db_service_account.email}"
}

# Cloud SQL Proxy configuration for local development
resource "google_sql_user" "proxy_user" {
  count    = var.enable_proxy_user ? 1 : 0
  name     = "${var.environment}_proxy"
  instance = google_sql_database_instance.main.name
  password = random_password.proxy_password[0].result
  project  = var.project_id
}

resource "random_password" "proxy_password" {
  count   = var.enable_proxy_user ? 1 : 0
  length  = 32
  special = false
}
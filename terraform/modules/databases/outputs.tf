# Database Module Outputs

output "instance_name" {
  description = "The Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "connection_name" {
  description = "The Cloud SQL instance connection name"
  value       = google_sql_database_instance.main.connection_name
}

output "private_ip_address" {
  description = "The Cloud SQL instance private IP address"
  value       = google_sql_database_instance.main.private_ip_address
  sensitive   = true
}

output "public_ip_address" {
  description = "The Cloud SQL instance public IP address"
  value       = google_sql_database_instance.main.public_ip_address
}

output "self_link" {
  description = "The Cloud SQL instance self link"
  value       = google_sql_database_instance.main.self_link
}

# Database Names
output "database_names" {
  description = "Names of created databases"
  value = {
    for key, db in google_sql_database.service_databases : key => db.name
  }
}

# Connection Strings
output "connection_strings" {
  description = "Database connection strings for each service"
  value = {
    for key, db in google_sql_database.service_databases : key => 
    "postgresql://${google_sql_user.app_user.name}:${google_sql_user.app_user.password}@${google_sql_database_instance.main.private_ip_address}:5432/${db.name}"
  }
  sensitive = true
}

# Connection strings for different users
output "root_connection_string" {
  description = "Root user connection string"
  value       = "postgresql://${google_sql_user.root.name}:${google_sql_user.root.password}@${google_sql_database_instance.main.private_ip_address}:5432/postgres"
  sensitive   = true
}

output "monitoring_connection_string" {
  description = "Monitoring user connection string"
  value = var.enable_monitoring_user ? 
    "postgresql://${google_sql_user.monitoring_user[0].name}:${google_sql_user.monitoring_user[0].password}@${google_sql_database_instance.main.private_ip_address}:5432/postgres" : ""
  sensitive = true
}

output "migration_connection_string" {
  description = "Migration user connection string"
  value = var.enable_migration_user ? 
    "postgresql://${google_sql_user.migration_user[0].name}:${google_sql_user.migration_user[0].password}@${google_sql_database_instance.main.private_ip_address}:5432/postgres" : ""
  sensitive = true
}

# User Information
output "users" {
  description = "Database users information"
  value = {
    root = {
      name = google_sql_user.root.name
    }
    app = {
      name = google_sql_user.app_user.name
    }
    monitoring = var.enable_monitoring_user ? {
      name = google_sql_user.monitoring_user[0].name
    } : null
    migration = var.enable_migration_user ? {
      name = google_sql_user.migration_user[0].name
    } : null
    proxy = var.enable_proxy_user ? {
      name = google_sql_user.proxy_user[0].name
    } : null
  }
}

# Passwords (sensitive)
output "passwords" {
  description = "Database user passwords"
  value = {
    root       = google_sql_user.root.password
    app        = google_sql_user.app_user.password
    monitoring = var.enable_monitoring_user ? google_sql_user.monitoring_user[0].password : null
    migration  = var.enable_migration_user ? google_sql_user.migration_user[0].password : null
    proxy      = var.enable_proxy_user ? google_sql_user.proxy_user[0].password : null
  }
  sensitive = true
}

# Read Replica Information
output "read_replica_connection_name" {
  description = "Read replica connection name"
  value       = var.enable_read_replica ? google_sql_database_instance.read_replica[0].connection_name : null
}

output "read_replica_private_ip" {
  description = "Read replica private IP address"
  value       = var.enable_read_replica ? google_sql_database_instance.read_replica[0].private_ip_address : null
  sensitive   = true
}

# Service Account
output "service_account_email" {
  description = "Database operations service account email"
  value       = google_service_account.db_service_account.email
}

output "service_account_key" {
  description = "Database operations service account unique key"
  value       = google_service_account.db_service_account.unique_id
}

# Backup Bucket
output "backup_bucket_name" {
  description = "Database backup bucket name"
  value       = var.enable_backup_bucket ? google_storage_bucket.db_backups[0].name : null
}

output "backup_bucket_url" {
  description = "Database backup bucket URL"
  value       = var.enable_backup_bucket ? google_storage_bucket.db_backups[0].url : null
}

# SSL Certificate
output "ssl_cert" {
  description = "SSL certificate information"
  value = var.enable_ssl_certs ? {
    common_name = google_sql_ssl_cert.client_cert[0].common_name
    cert        = google_sql_ssl_cert.client_cert[0].cert
    private_key = google_sql_ssl_cert.client_cert[0].private_key
  } : null
  sensitive = true
}

# Cloud SQL Proxy Commands
output "proxy_commands" {
  description = "Cloud SQL Proxy connection commands"
  value = {
    main_instance = "cloud_sql_proxy -instances=${google_sql_database_instance.main.connection_name}=tcp:5432"
    read_replica  = var.enable_read_replica ? "cloud_sql_proxy -instances=${google_sql_database_instance.read_replica[0].connection_name}=tcp:5433" : null
  }
}

# Database Configuration Summary
output "database_summary" {
  description = "Summary of database configuration"
  value = {
    instance_name     = google_sql_database_instance.main.name
    database_version  = var.database_version
    tier             = var.database_config.tier
    availability_type = var.database_config.availability_type
    disk_size        = var.database_config.disk_size
    backup_enabled   = var.database_config.backup_enabled
    read_replica_enabled = var.enable_read_replica
    databases_count  = length(var.service_databases)
    users_count      = 2 + (var.enable_monitoring_user ? 1 : 0) + (var.enable_migration_user ? 1 : 0) + (var.enable_proxy_user ? 1 : 0)
  }
}
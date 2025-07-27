# Database Module Variables

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "labels" {
  description = "Labels to be applied to resources"
  type        = map(string)
  default     = {}
}

variable "network_id" {
  description = "The VPC network ID for private IP"
  type        = string
}

variable "network_dependency" {
  description = "Network dependency for proper resource ordering"
  type        = any
  default     = null
}

# Database Configuration
variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "database_config" {
  description = "Database configuration"
  type = object({
    tier                            = string
    availability_type               = string
    disk_size                      = number
    disk_type                      = string
    max_disk_size                  = number
    backup_enabled                 = bool
    backup_start_time              = string
    backup_retention               = number
    transaction_log_retention_days = number
    max_connections                = string
    maintenance_window = object({
      day  = number
      hour = number
    })
  })
  default = {
    tier                            = "db-f1-micro"
    availability_type               = "ZONAL"
    disk_size                      = 20
    disk_type                      = "PD_SSD"
    max_disk_size                  = 100
    backup_enabled                 = true
    backup_start_time              = "03:00"
    backup_retention               = 7
    transaction_log_retention_days = 7
    max_connections                = "100"
    maintenance_window = {
      day  = 7  # Sunday
      hour = 4  # 4 AM
    }
  }
}

# Service Databases
variable "service_databases" {
  description = "Map of service names to database configurations"
  type        = map(object({
    charset   = optional(string, "UTF8")
    collation = optional(string, "en_US.UTF8")
  }))
  default = {
    user_service         = {}
    customer_service     = {}
    order_service        = {}
    inventory_service    = {}
    billing_service      = {}
    notification_service = {}
  }
}

# Network Security
variable "authorized_networks" {
  description = "List of authorized networks for database access"
  type = list(object({
    name = string
    cidr = string
  }))
  default = []
}

# Read Replica Configuration
variable "enable_read_replica" {
  description = "Enable read replica for the database"
  type        = bool
  default     = false
}

variable "replica_region" {
  description = "Region for read replica (empty for same region)"
  type        = string
  default     = ""
}

variable "replica_tier" {
  description = "Tier for read replica (empty for same as master)"
  type        = string
  default     = ""
}

# Connection Pooling
variable "enable_connection_pooling" {
  description = "Enable PgBouncer connection pooling"
  type        = bool
  default     = false
}

# SSL Configuration
variable "enable_ssl_certs" {
  description = "Enable SSL certificates for secure connections"
  type        = bool
  default     = false
}

# User Management
variable "enable_monitoring_user" {
  description = "Create monitoring user for database observability"
  type        = bool
  default     = true
}

variable "enable_migration_user" {
  description = "Create migration user for CI/CD deployments"
  type        = bool
  default     = true
}

variable "enable_proxy_user" {
  description = "Create proxy user for local development"
  type        = bool
  default     = true
}

# Backup Configuration
variable "enable_backup_bucket" {
  description = "Create storage bucket for manual database backups"
  type        = bool
  default     = true
}
# Firemní Asistent - Main Terraform Configuration
# Infrastructure as Code for complete GCP deployment

terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
  
  backend "gcs" {
    bucket = "firemni-asistent-terraform-state"
    prefix = "terraform/state"
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Local values for resource naming and tagging
locals {
  environment = var.environment
  project_name = "firemni-asistent"
  
  # Common labels for all resources
  common_labels = {
    project     = local.project_name
    environment = local.environment
    managed_by  = "terraform"
    team        = "engineering"
  }
  
  # Service definitions
  services = {
    user = {
      name = "user-service"
      port = 8080
      cpu = "1000m"
      memory = "512Mi"
      min_instances = var.environment == "production" ? 2 : 1
      max_instances = var.environment == "production" ? 10 : 3
    }
    customer = {
      name = "customer-service"
      port = 8080
      cpu = "1000m"
      memory = "512Mi"
      min_instances = var.environment == "production" ? 2 : 1
      max_instances = var.environment == "production" ? 8 : 3
    }
    order = {
      name = "order-service"
      port = 8080
      cpu = "2000m"
      memory = "1Gi"
      min_instances = var.environment == "production" ? 3 : 1
      max_instances = var.environment == "production" ? 15 : 5
    }
    inventory = {
      name = "inventory-service"
      port = 8080
      cpu = "1000m"
      memory = "512Mi"
      min_instances = var.environment == "production" ? 2 : 1
      max_instances = var.environment == "production" ? 10 : 3
    }
    billing = {
      name = "billing-service"
      port = 8080
      cpu = "1000m"
      memory = "512Mi"
      min_instances = var.environment == "production" ? 2 : 1
      max_instances = var.environment == "production" ? 8 : 3
    }
    notification = {
      name = "notification-service"
      port = 8080
      cpu = "500m"
      memory = "256Mi"
      min_instances = var.environment == "production" ? 1 : 0
      max_instances = var.environment == "production" ? 5 : 2
    }
    gateway = {
      name = "api-gateway"
      port = 8080
      cpu = "2000m"
      memory = "1Gi"
      min_instances = var.environment == "production" ? 3 : 1
      max_instances = var.environment == "production" ? 20 : 5
    }
  }
}

# Enable required Google Cloud APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sql-component.googleapis.com", 
    "sqladmin.googleapis.com",
    "storage-component.googleapis.com",
    "cloudbuild.googleapis.com",
    "containerregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "secretmanager.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "artifactregistry.googleapis.com",
    "servicenetworking.googleapis.com",
    "vpcaccess.googleapis.com",
    "cloudscheduler.googleapis.com",
    "pubsub.googleapis.com"
  ])

  service = each.key
  project = var.project_id

  disable_dependent_services = false
  disable_on_destroy = false
}

# VPC Network for private communication
module "networking" {
  source = "./modules/networking"
  
  project_id   = var.project_id
  region       = var.region
  environment  = local.environment
  labels       = local.common_labels
  
  depends_on = [google_project_service.apis]
}

# Cloud SQL for databases
module "databases" {
  source = "./modules/databases"
  
  project_id   = var.project_id
  region       = var.region
  environment  = local.environment
  labels       = local.common_labels
  
  network_id = module.networking.vpc_network_id
  
  depends_on = [google_project_service.apis, module.networking]
}

# Secret Manager for configuration
module "secrets" {
  source = "./modules/secrets"
  
  project_id   = var.project_id
  environment  = local.environment
  labels       = local.common_labels
  
  database_connections = module.databases.connection_strings
  
  depends_on = [google_project_service.apis]
}

# Container Registry / Artifact Registry
module "registry" {
  source = "./modules/registry"
  
  project_id   = var.project_id
  region       = var.region
  environment  = local.environment
  labels       = local.common_labels
  
  depends_on = [google_project_service.apis]
}

# Cloud Run services for all microservices
module "microservices" {
  source = "./modules/cloud-run"
  
  for_each = local.services
  
  project_id   = var.project_id
  region       = var.region
  environment  = local.environment
  labels       = local.common_labels
  
  service_name = each.value.name
  service_config = each.value
  
  vpc_connector_id = module.networking.vpc_connector_id
  registry_url     = module.registry.registry_url
  
  database_secrets = module.secrets.database_secret_ids
  app_secrets      = module.secrets.app_secret_ids
  
  depends_on = [
    google_project_service.apis,
    module.networking,
    module.databases,
    module.secrets,
    module.registry
  ]
}

# Load Balancer for external access
module "load_balancer" {
  source = "./modules/load-balancer"
  
  project_id   = var.project_id
  region       = var.region
  environment  = local.environment
  labels       = local.common_labels
  
  services = {
    for name, config in local.services : name => {
      name = config.name
      url  = module.microservices[name].service_url
    }
  }
  
  domain_name = var.domain_name
  
  depends_on = [module.microservices]
}

# Monitoring and Alerting
module "monitoring" {
  source = "./modules/monitoring"
  
  project_id   = var.project_id
  environment  = local.environment
  labels       = local.common_labels
  
  services = local.services
  
  notification_channels = var.notification_channels
  
  depends_on = [module.microservices]
}

# IAM for service accounts and permissions
module "iam" {
  source = "./modules/iam"
  
  project_id   = var.project_id
  environment  = local.environment
  
  services = keys(local.services)
  
  depends_on = [google_project_service.apis]
}

# Storage buckets for file uploads, backups, etc.
module "storage" {
  source = "./modules/storage"
  
  project_id   = var.project_id
  region       = var.region
  environment  = local.environment
  labels       = local.common_labels
  
  depends_on = [google_project_service.apis]
}
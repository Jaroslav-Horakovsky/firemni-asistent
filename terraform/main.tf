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
  
  # Service definitions - Current active services
  services = {
    user-service = {
      image = "gcr.io/${var.project_id}/user-service:latest"
      port = 3001
      cpu = "1000m"
      memory = "512Mi"
      min_instances = var.environment == "production" ? 2 : 1
      max_instances = var.environment == "production" ? 10 : 3
      dependencies = []
      environment_variables = {
        SERVICE_NAME = "user-service"
        PORT = "3001"
        NODE_ENV = var.environment
      }
    }
    customer-service = {
      image = "gcr.io/${var.project_id}/customer-service:latest"
      port = 3002
      cpu = "1000m"
      memory = "512Mi"
      min_instances = var.environment == "production" ? 2 : 1
      max_instances = var.environment == "production" ? 8 : 3
      dependencies = []
      environment_variables = {
        SERVICE_NAME = "customer-service"
        PORT = "3002"
        NODE_ENV = var.environment
      }
    }
    order-service = {
      image = "gcr.io/${var.project_id}/order-service:latest"
      port = 3003
      cpu = "2000m"
      memory = "1Gi"
      min_instances = var.environment == "production" ? 3 : 1
      max_instances = var.environment == "production" ? 15 : 5
      dependencies = ["user-service", "customer-service"]
      environment_variables = {
        SERVICE_NAME = "order-service"
        PORT = "3003"
        NODE_ENV = var.environment
      }
    }
    inventory-service = {
      image = "gcr.io/${var.project_id}/inventory-service:latest"
      port = 3004
      cpu = "1000m"
      memory = "512Mi"
      min_instances = var.environment == "production" ? 2 : 1
      max_instances = var.environment == "production" ? 10 : 3
      dependencies = []
      environment_variables = {
        SERVICE_NAME = "inventory-service"
        PORT = "3004"
        NODE_ENV = var.environment
      }
    }
    billing-service = {
      image = "gcr.io/${var.project_id}/billing-service:latest"
      port = 3005
      cpu = "1000m"
      memory = "512Mi"
      min_instances = var.environment == "production" ? 2 : 1
      max_instances = var.environment == "production" ? 8 : 3
      dependencies = ["order-service"]
      environment_variables = {
        SERVICE_NAME = "billing-service"
        PORT = "3005"
        NODE_ENV = var.environment
      }
    }
    notification-service = {
      image = "gcr.io/${var.project_id}/notification-service:latest"
      port = 3006
      cpu = "500m"
      memory = "256Mi"
      min_instances = var.environment == "production" ? 1 : 0
      max_instances = var.environment == "production" ? 5 : 2
      dependencies = []
      environment_variables = {
        SERVICE_NAME = "notification-service"
        PORT = "3006"
        NODE_ENV = var.environment
      }
    }
    api-gateway = {
      image = "gcr.io/${var.project_id}/api-gateway:latest"
      port = 3000
      cpu = "2000m"
      memory = "1Gi"
      min_instances = var.environment == "production" ? 3 : 1
      max_instances = var.environment == "production" ? 20 : 5
      dependencies = ["user-service", "customer-service", "order-service", "inventory-service", "billing-service", "notification-service"]
      environment_variables = {
        SERVICE_NAME = "api-gateway"
        PORT = "3000"
        NODE_ENV = var.environment
      }
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
  
  project_id   = var.project_id
  region       = var.region
  environment  = local.environment
  labels       = local.common_labels
  
  services = local.services
  
  vpc_connector_name = module.networking.vpc_connector_name
  
  secret_manager_secrets = module.secrets.secret_manager_secrets
  database_config = {
    host = module.databases.postgres_private_ip
    port = "5432"
    database_name = "firemni_asistent"
    connection_secrets = module.secrets.database_secret_ids
  }
  
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
      name = name
      url  = module.microservices.service_urls[name]
    }
  }
  
  domain_name = var.domain_name
  
  depends_on = [module.microservices]
}

# Monitoring and Alerting
module "monitoring" {
  source = "./modules/monitoring"
  
  project_id   = var.project_id
  region       = var.region
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
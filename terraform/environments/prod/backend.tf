# =============================================================================
# PRODUCTION ENVIRONMENT BACKEND CONFIGURATION
# =============================================================================
# Remote state management for production environment with maximum security

terraform {
  backend "gcs" {
    bucket = "firemni-asistent-terraform-state-prod"
    prefix = "environments/prod"
    
    # Production-specific backend settings with encryption
    encryption_key = "projects/firemni-asistent-prod/locations/global/keyRings/terraform-state/cryptoKeys/state-encryption"
    
    # Workspace isolation
    workspace_key_prefix = "workspaces"
  }
  
  required_version = ">= 1.5"
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    
    random = {
      source  = "hashicorp/random"
      version = "~> 3.4"
    }
    
    null = {
      source  = "hashicorp/null"
      version = "~> 3.2"
    }
  }
}

# Production provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
  
  # Production-specific provider settings
  request_timeout = "300s"  # Longer timeout for complex operations
  
  # Default labels for all resources
  default_labels = {
    environment = "production"
    project     = "firemni-asistent"
    managed_by  = "terraform"
    cost_center = "production"
    compliance  = "required"
  }
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  
  # Default labels for all resources
  default_labels = {
    environment = "production"
    project     = "firemni-asistent"
    managed_by  = "terraform"
    cost_center = "production"
    compliance  = "required"
  }
}
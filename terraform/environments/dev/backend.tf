# =============================================================================
# DEVELOPMENT ENVIRONMENT BACKEND CONFIGURATION
# =============================================================================
# Remote state management for development environment with workspace isolation

terraform {
  backend "gcs" {
    bucket = "firemni-asistent-terraform-state-dev"
    prefix = "environments/dev"
    
    # Development-specific backend settings
    encryption_key = null  # No encryption for dev (cost optimization)
    
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

# Development provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
  
  # Development-specific provider settings
  request_timeout = "60s"
  
  # Default labels for all resources
  default_labels = {
    environment = "dev"
    project     = "firemni-asistent"
    managed_by  = "terraform"
    cost_center = "development"
  }
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  
  # Default labels for all resources
  default_labels = {
    environment = "dev"
    project     = "firemni-asistent"
    managed_by  = "terraform"
    cost_center = "development"
  }
}
# =============================================================================
# STAGING ENVIRONMENT BACKEND CONFIGURATION
# =============================================================================
# Remote state management for staging environment with enhanced security

terraform {
  backend "gcs" {
    bucket = "firemni-asistent-terraform-state-staging"
    prefix = "environments/staging"
    
    # Staging-specific backend settings with security
    encryption_key = null  # Use customer-managed key in production
    
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

# Staging provider configuration
provider "google" {
  project = var.project_id
  region  = var.region
  
  # Staging-specific provider settings
  request_timeout = "120s"
  
  # Default labels for all resources
  default_labels = {
    environment = "staging"
    project     = "firemni-asistent"
    managed_by  = "terraform"
    cost_center = "pre-production"
  }
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
  
  # Default labels for all resources
  default_labels = {
    environment = "staging"
    project     = "firemni-asistent"
    managed_by  = "terraform"
    cost_center = "pre-production"
  }
}
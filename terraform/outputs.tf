# Terraform Outputs for Firemní Asistent Infrastructure

# Core Infrastructure Outputs
output "project_id" {
  description = "The GCP project ID"
  value       = var.project_id
}

output "region" {
  description = "The GCP region where resources are deployed"
  value       = var.region
}

output "environment" {
  description = "The environment name"
  value       = var.environment
}

# Networking Outputs
output "vpc_network_id" {
  description = "The VPC network ID"
  value       = module.networking.vpc_network_id
}

output "vpc_network_name" {
  description = "The VPC network name"
  value       = module.networking.vpc_network_name
}

output "subnet_id" {
  description = "The subnet ID"
  value       = module.networking.subnet_id
}

output "vpc_connector_id" {
  description = "The VPC connector ID for Cloud Run services"
  value       = module.networking.vpc_connector_id
}

# Database Outputs
output "database_instance_name" {
  description = "The Cloud SQL instance name"
  value       = module.databases.instance_name
  sensitive   = false
}

output "database_connection_name" {
  description = "The Cloud SQL instance connection name"
  value       = module.databases.connection_name
  sensitive   = false
}

output "database_private_ip" {
  description = "The Cloud SQL instance private IP address"
  value       = module.databases.private_ip_address
  sensitive   = true
}

# Service URLs
output "service_urls" {
  description = "URLs of all deployed Cloud Run services"
  value = {
    for name, service in module.microservices : name => service.service_url
  }
}

output "api_gateway_url" {
  description = "The API Gateway service URL"
  value       = module.microservices["gateway"].service_url
}

# Load Balancer Outputs
output "load_balancer_ip" {
  description = "The external IP address of the load balancer"
  value       = module.load_balancer.external_ip
}

output "ssl_certificate_id" {
  description = "The SSL certificate ID"
  value       = module.load_balancer.ssl_certificate_id
}

output "domain_name" {
  description = "The configured domain name"
  value       = var.domain_name
}

# Registry Outputs
output "registry_url" {
  description = "The container registry URL"
  value       = module.registry.registry_url
}

output "registry_hostname" {
  description = "The container registry hostname"
  value       = module.registry.registry_hostname
}

# Secret Manager Outputs
output "secret_ids" {
  description = "Secret Manager secret IDs"
  value = {
    database_secrets = module.secrets.database_secret_ids
    app_secrets     = module.secrets.app_secret_ids
  }
  sensitive = true
}

# Service Account Outputs
output "service_account_emails" {
  description = "Service account email addresses"
  value       = module.iam.service_account_emails
}

# Storage Outputs
output "storage_buckets" {
  description = "Created storage bucket names"
  value       = module.storage.bucket_names
}

# Monitoring Outputs
output "monitoring_dashboard_url" {
  description = "URL to the monitoring dashboard"
  value       = module.monitoring.dashboard_url
}

output "notification_channels" {
  description = "Created notification channel IDs"
  value       = module.monitoring.notification_channel_ids
  sensitive   = true
}

# Environment-specific outputs
output "database_config_applied" {
  description = "Database configuration that was applied"
  value = var.environment == "production" ? merge(var.database_config, var.database_config_production) : var.database_config
}

output "rabbitmq_config_applied" {
  description = "RabbitMQ configuration that was applied"
  value = var.environment == "production" ? merge(var.rabbitmq_config, var.rabbitmq_config_production) : var.rabbitmq_config
}

# Security Outputs
output "iam_policy_bindings" {
  description = "IAM policy bindings that were created"
  value       = module.iam.policy_bindings
  sensitive   = true
}

# Cost Management Outputs
output "budget_alert_config" {
  description = "Budget alert configuration"
  value = {
    threshold_percent = var.cost_optimization.budget_alert_threshold_percent
    enabled          = var.cost_optimization.budget_alert_threshold_percent > 0
  }
}

# Feature Flags Status
output "enabled_features" {
  description = "Status of feature flags"
  value       = var.feature_flags
}

# Health Check Endpoints
output "health_check_endpoints" {
  description = "Health check endpoints for all services"
  value = {
    for name, service in module.microservices : name => {
      liveness  = "${service.service_url}/live"
      readiness = "${service.service_url}/ready"
      health    = "${service.service_url}/health"
    }
  }
}

# Deployment Information
output "deployment_info" {
  description = "Deployment information and metadata"
  value = {
    terraform_version = "~> 1.0"
    provider_versions = {
      google      = "~> 5.0"
      google-beta = "~> 5.0"
    }
    deployment_timestamp = timestamp()
    services_deployed = length(local.services)
    total_max_instances = sum([for service in local.services : service.max_instances])
    total_min_instances = sum([for service in local.services : service.min_instances])
  }
}

# Connection Strings for Development
output "connection_examples" {
  description = "Example connection strings for development (non-sensitive info)"
  value = {
    cloud_sql_proxy = "cloud_sql_proxy -instances=${module.databases.connection_name}=tcp:5432"
    kubectl_proxy  = "kubectl port-forward service/api-gateway 8080:80"
    gcloud_auth    = "gcloud auth application-default login"
  }
}

# Resource Summary
output "resource_summary" {
  description = "Summary of created resources"
  value = {
    cloud_run_services = length(local.services)
    databases         = length(module.databases.database_names)
    secrets          = length(module.secrets.all_secret_ids)
    storage_buckets  = length(module.storage.bucket_names)
    service_accounts = length(module.iam.service_account_emails)
    vpc_networks     = 1
    load_balancers   = 1
  }
}
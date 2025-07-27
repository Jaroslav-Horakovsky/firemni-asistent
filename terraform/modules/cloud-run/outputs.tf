# Cloud Run Module Outputs
# Export service information and monitoring configuration

# Service URLs and basic information
output "service_urls" {
  description = "Map of service names to their Cloud Run URLs"
  value = {
    for name, service in google_cloud_run_service.services : name => service.status[0].url
  }
}

output "service_names" {
  description = "Map of logical service names to actual Cloud Run service names"
  value = {
    for name, service in google_cloud_run_service.services : name => service.name
  }
}

output "service_locations" {
  description = "Map of service names to their deployment locations"
  value = {
    for name, service in google_cloud_run_service.services : name => service.location
  }
}

# Service configuration details
output "service_configs" {
  description = "Complete service configuration details"
  value = {
    for name, config in local.service_configs : name => {
      image            = config.image
      port             = config.port
      cpu              = config.actual_cpu
      memory           = config.actual_memory
      min_instances    = config.actual_min_instances
      max_instances    = config.actual_max_instances
      concurrency      = config.concurrency
      timeout          = config.timeout
      dependencies     = config.dependencies
      service_url      = google_cloud_run_service.services[name].status[0].url
    }
  }
}

# Health check endpoints
output "health_check_endpoints" {
  description = "Health check endpoints for each service"
  value = {
    for name, config in var.services : name => {
      service_url     = google_cloud_run_service.services[name].status[0].url
      startup_check   = "${google_cloud_run_service.services[name].status[0].url}${config.startup_probe.path}"
      liveness_check  = "${google_cloud_run_service.services[name].status[0].url}${config.liveness_probe.path}"
      readiness_check = "${google_cloud_run_service.services[name].status[0].url}${config.readiness_probe.path}"
    }
  }
}

# Service dependencies for circuit breaker configuration
output "service_dependencies" {
  description = "Service dependency mapping for circuit breaker setup"
  value = {
    for name, config in var.services : name => {
      dependencies = config.dependencies
      circuit_breaker_config = config.circuit_breaker_config
      internal_url = google_cloud_run_service.services[name].status[0].url
    }
  }
}

# Circuit breaker configuration
output "circuit_breaker_configs" {
  description = "Circuit breaker configuration for each service"
  value = {
    for name, config in var.services : name => merge(
      config.circuit_breaker_config,
      {
        service_name = google_cloud_run_service.services[name].name
        target_services = [
          for dep in config.dependencies : {
            name = dep
            url  = google_cloud_run_service.services[dep].status[0].url
          }
        ]
      }
    )
  }
}

# Monitoring configuration
output "monitoring_config" {
  description = "Monitoring and observability configuration"
  value = var.enable_monitoring ? {
    uptime_checks = {
      for name, check in google_monitoring_uptime_check_config.health_checks : name => {
        name         = check.name
        display_name = check.display_name
        url          = check.monitored_resource[0].labels.host
        path         = check.http_check[0].path
      }
    }
    health_alerts = {
      for name, alert in google_monitoring_alert_policy.service_health : name => {
        name         = alert.name
        display_name = alert.display_name
        enabled      = alert.enabled
      }
    }
    circuit_breaker_alerts = {
      for name, alert in google_monitoring_alert_policy.circuit_breaker_open : name => {
        name         = alert.name
        display_name = alert.display_name
        enabled      = alert.enabled
      }
    }
  } : {}
}

# IAM configuration summary
output "iam_configuration" {
  description = "IAM configuration summary"
  value = {
    public_services = [
      for name, config in var.services : name if config.allow_unauthenticated
    ]
    service_to_service_bindings = {
      for binding_key, binding in google_cloud_run_service_iam_member.service_to_service : binding_key => {
        caller_service = binding.member
        target_service = binding.service
        role          = binding.role
      }
    }
    service_accounts = var.service_account_emails
  }
}

# Environment-specific scaling configuration
output "scaling_configuration" {
  description = "Environment-specific scaling configuration"
  value = {
    environment = var.environment
    services = {
      for name, config in local.service_configs : name => {
        min_instances = config.actual_min_instances
        max_instances = config.actual_max_instances
        cpu          = config.actual_cpu
        memory       = config.actual_memory
        concurrency  = config.concurrency
      }
    }
    autoscaling_config = var.autoscaling_config
  }
}

# Networking configuration
output "networking_config" {
  description = "Networking and connectivity configuration"
  value = {
    vpc_connector = var.vpc_connector_name
    vpc_egress   = var.vpc_egress
    ingress_config = {
      for name, config in var.services : name => {
        ingress               = config.ingress
        allow_unauthenticated = config.allow_unauthenticated
        custom_domain        = lookup(config, "custom_domain", "")
      }
    }
  }
}

# Security configuration summary
output "security_configuration" {
  description = "Security configuration summary"
  value = {
    authentication_required = var.security_config.require_authentication
    binary_authorization   = var.security_config.binary_authorization
    cmek_encryption       = var.security_config.cmek_key != ""
    
    service_security = {
      for name, config in var.services : name => {
        allow_unauthenticated = config.allow_unauthenticated
        ingress_type         = config.ingress
        service_account      = lookup(var.service_account_emails, name, "")
      }
    }
  }
}

# Database and secrets configuration
output "database_integration" {
  description = "Database and secrets integration configuration"
  value = {
    database_config = var.database_config
    secret_manager_integration = {
      for name, config in var.services : name => {
        secrets_used = keys(merge(config.secrets, var.database_config.connection_secrets))
      }
    }
  }
}

# Load balancer integration data
output "load_balancer_backends" {
  description = "Backend configuration for load balancer module"
  value = {
    for name, service in google_cloud_run_service.services : name => {
      service_name    = service.name
      service_url     = service.status[0].url
      region         = service.location
      port           = var.services[name].port
      health_check_path = var.services[name].liveness_probe.path
      timeout        = var.services[name].timeout
      
      # Load balancer specific configuration
      enable_cdn              = var.load_balancer_config.enable_cdn
      timeout_sec            = var.load_balancer_config.timeout_sec
      connection_draining_timeout = var.load_balancer_config.connection_draining_timeout_sec
      
      # Service dependencies for intelligent routing
      dependencies = var.services[name].dependencies
    }
  }
}

# Service discovery information
output "service_discovery" {
  description = "Service discovery information for inter-service communication"
  value = {
    services = {
      for name, service in google_cloud_run_service.services : name => {
        name         = service.name
        url          = service.status[0].url
        port         = var.services[name].port
        region       = service.location
        dependencies = var.services[name].dependencies
        
        # Internal service endpoints
        health_endpoint   = "${service.status[0].url}${var.services[name].liveness_probe.path}"
        metrics_endpoint  = "${service.status[0].url}/metrics"
        ready_endpoint    = "${service.status[0].url}${var.services[name].readiness_probe.path}"
      }
    }
    
    # Service mesh configuration (for future use)
    service_mesh = {
      enabled = false  # Can be enabled later for advanced networking
      discovery_namespace = "${var.project_id}-${var.environment}"
    }
  }
}

# Deployment and revision information
output "deployment_info" {
  description = "Deployment and revision management information"
  value = {
    services = {
      for name, service in google_cloud_run_service.services : name => {
        latest_revision = service.status[0].latest_ready_revision_name
        serving_revisions = service.status[0].observed_generation
        traffic_allocation = service.traffic
        
        # Deployment configuration
        min_ready_seconds     = var.deployment_config.min_ready_seconds
        progress_deadline     = var.deployment_config.progress_deadline_seconds
        revision_history_limit = var.deployment_config.revision_history_limit
      }
    }
    
    # Environment metadata
    environment = var.environment
    deployed_at = timestamp()
    project_id  = var.project_id
    region      = var.region
  }
}

# Cost optimization information
output "cost_optimization" {
  description = "Cost optimization and resource utilization information"
  value = {
    services = {
      for name, config in local.service_configs : name => {
        resource_allocation = {
          cpu              = config.actual_cpu
          memory           = config.actual_memory
          min_instances    = config.actual_min_instances
          max_instances    = config.actual_max_instances
        }
        
        # Cost optimization features
        scale_to_zero = config.actual_min_instances == 0
        resource_efficiency = {
          cpu_request    = config.actual_cpu
          memory_request = config.actual_memory
          concurrency   = config.concurrency
        }
      }
    }
    
    # Environment-specific cost settings
    environment_optimization = {
      environment = var.environment
      scale_to_zero_enabled = var.environment == "dev"
      resource_limits = var.environment == "production" ? "strict" : "flexible"
    }
  }
}
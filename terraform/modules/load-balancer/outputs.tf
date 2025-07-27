# Load Balancer Module Outputs
# Export load balancer configuration and monitoring information

# IP addresses and basic configuration
output "load_balancer_ip" {
  description = "Load balancer IPv4 address"
  value = var.reserved_ip_config.create_ipv4_address ? 
    google_compute_global_address.lb_ipv4[0].address : null
}

output "load_balancer_ipv6" {
  description = "Load balancer IPv6 address" 
  value = var.reserved_ip_config.create_ipv6_address ? 
    google_compute_global_address.lb_ipv6[0].address : null
}

output "load_balancer_ip_name" {
  description = "Load balancer IPv4 address resource name"
  value = var.reserved_ip_config.create_ipv4_address ? 
    google_compute_global_address.lb_ipv4[0].name : null
}

# SSL certificate information
output "ssl_certificate" {
  description = "SSL certificate information"
  value = var.ssl_certificates.managed_certificate ? {
    name         = google_compute_managed_ssl_certificate.ssl_cert[0].name
    domains      = google_compute_managed_ssl_certificate.ssl_cert[0].managed[0].domains
    status       = google_compute_managed_ssl_certificate.ssl_cert[0].managed[0].status
    domain_status = google_compute_managed_ssl_certificate.ssl_cert[0].managed[0].domain_status
  } : null
}

# Backend services configuration
output "backend_services" {
  description = "Backend services configuration and status"
  value = {
    for name, service in google_compute_backend_service.service_backends : name => {
      name                = service.name
      id                  = service.id
      self_link          = service.self_link
      protocol           = service.protocol
      timeout_sec        = service.timeout_sec
      load_balancing_scheme = service.load_balancing_scheme
      
      # Health check information
      health_checks = service.health_checks
      
      # Backend configuration
      backend_config = {
        for backend in service.backend : backend.group => {
          max_rate_per_instance = backend.max_rate_per_instance
          max_utilization      = backend.max_utilization
          capacity_scaler      = backend.capacity_scaler
        }
      }
      
      # CDN configuration
      cdn_enabled = length(service.cdn_policy) > 0
      cdn_config = length(service.cdn_policy) > 0 ? {
        cache_mode    = service.cdn_policy[0].cache_mode
        client_ttl    = service.cdn_policy[0].client_ttl
        default_ttl   = service.cdn_policy[0].default_ttl
        max_ttl       = service.cdn_policy[0].max_ttl
      } : null
    }
  }
}

# Health checks status and configuration
output "health_checks" {
  description = "Health checks configuration and status"
  value = {
    for name, hc in google_compute_health_check.service_health_checks : name => {
      name                = hc.name
      id                  = hc.id
      self_link          = hc.self_link
      check_interval_sec = hc.check_interval_sec
      timeout_sec        = hc.timeout_sec
      healthy_threshold  = hc.healthy_threshold
      unhealthy_threshold = hc.unhealthy_threshold
      
      # HTTPS health check details
      request_path = hc.https_health_check[0].request_path
      port         = hc.https_health_check[0].port
      host         = hc.https_health_check[0].host
    }
  }
}

# Network Endpoint Groups information
output "network_endpoint_groups" {
  description = "Network Endpoint Groups configuration"
  value = {
    for name, neg in google_compute_region_network_endpoint_group.cloud_run_negs : name => {
      name                  = neg.name
      id                    = neg.id
      self_link            = neg.self_link
      region               = neg.region
      network_endpoint_type = neg.network_endpoint_type
      cloud_run_service    = neg.cloud_run[0].service
    }
  }
}

# URL mapping and routing configuration
output "url_map_config" {
  description = "URL mapping and routing configuration"
  value = {
    name            = google_compute_url_map.main.name
    id              = google_compute_url_map.main.id
    self_link       = google_compute_url_map.main.self_link
    default_service = google_compute_url_map.main.default_service
    
    # Path routing rules
    path_routing_rules = {
      for rule in local.path_routing_rules : rule.key => {
        paths          = rule.paths
        target_service = rule.target_service
        service_name   = rule.service_name
      }
    }
    
    # Host routing configuration
    host_routing_enabled = var.traffic_routing.enable_host_routing
    domains = local.ssl_domains
  }
}

# Forwarding rules configuration
output "forwarding_rules" {
  description = "Load balancer forwarding rules"
  value = {
    https = {
      name       = google_compute_global_forwarding_rule.https.name
      id         = google_compute_global_forwarding_rule.https.id
      ip_address = google_compute_global_forwarding_rule.https.ip_address
      port_range = google_compute_global_forwarding_rule.https.port_range
      target     = google_compute_global_forwarding_rule.https.target
    }
    
    http = var.load_balancer_config.enable_http_redirect ? {
      name       = google_compute_global_forwarding_rule.http[0].name
      id         = google_compute_global_forwarding_rule.http[0].id
      ip_address = google_compute_global_forwarding_rule.http[0].ip_address
      port_range = google_compute_global_forwarding_rule.http[0].port_range
      target     = google_compute_global_forwarding_rule.http[0].target
    } : null
    
    https_ipv6 = var.load_balancer_config.enable_ipv6 && var.reserved_ip_config.create_ipv6_address ? {
      name       = google_compute_global_forwarding_rule.https_ipv6[0].name
      id         = google_compute_global_forwarding_rule.https_ipv6[0].id
      ip_address = google_compute_global_forwarding_rule.https_ipv6[0].ip_address
      port_range = google_compute_global_forwarding_rule.https_ipv6[0].port_range
      target     = google_compute_global_forwarding_rule.https_ipv6[0].target
    } : null
  }
}

# Cloud Armor security policies
output "security_policies" {
  description = "Cloud Armor security policies configuration"
  value = {
    for name, policy in google_compute_security_policy.policies : name => {
      name        = policy.name
      id          = policy.id
      self_link   = policy.self_link
      description = policy.description
      
      rules_count = length(policy.rule)
      adaptive_protection_enabled = length(policy.adaptive_protection_config) > 0
    }
  }
}

# Monitoring configuration
output "monitoring_config" {
  description = "Load balancer monitoring configuration"
  value = var.monitoring_config.enable_uptime_checks ? {
    uptime_checks = {
      for name, check in google_monitoring_uptime_check_config.lb_uptime_checks : name => {
        name         = check.name
        display_name = check.display_name
        timeout      = check.timeout
        period       = check.period
        
        # Check configuration
        path = check.http_check[0].path
        port = check.http_check[0].port
        host = check.monitored_resource[0].labels.host
      }
    }
    
    latency_alerts = var.monitoring_config.enable_latency_alerts ? {
      for name, alert in google_monitoring_alert_policy.latency_alerts : name => {
        name         = alert.name
        display_name = alert.display_name
        enabled      = alert.enabled
        threshold    = var.monitoring_config.latency_threshold_ms
      }
    } : {}
    
    error_rate_alerts = var.monitoring_config.enable_error_rate_alerts ? {
      for name, alert in google_monitoring_alert_policy.error_rate_alerts : name => {
        name         = alert.name
        display_name = alert.display_name
        enabled      = alert.enabled
        threshold    = var.monitoring_config.error_rate_threshold
      }
    } : {}
  } : {}
}

# Service-specific configuration
output "services_configuration" {
  description = "Service-specific load balancer configuration"
  value = {
    for name, config in local.service_configs : name => {
      backend_service_name = config.backend_service_name
      health_check_name   = config.health_check_name
      cloud_run_service   = config.cloud_run_service_name
      cloud_run_region    = config.cloud_run_region
      cloud_run_url       = config.cloud_run_url
      
      # Load balancing configuration
      max_rate_per_instance = config.max_rate_per_instance
      timeout_sec          = config.timeout_sec
      connection_draining_timeout = config.connection_draining_timeout_sec
      
      # CDN configuration
      cdn_enabled = config.actual_enable_cdn
      
      # Security configuration
      cloud_armor_enabled = config.enable_cloud_armor
      
      # Health check configuration
      health_check_path   = config.health_check.request_path
      health_check_interval = config.health_check.check_interval_sec
      
      # Routing configuration
      path_rules = config.path_rules
    }
  }
}

# Performance and optimization information
output "performance_config" {
  description = "Performance and optimization configuration"
  value = {
    environment = var.environment
    
    # CDN configuration summary
    cdn_enabled_services = [
      for name, config in local.service_configs : name if config.actual_enable_cdn
    ]
    
    # Load balancing optimization
    session_affinity_enabled = [
      for name, config in var.services : name if config.session_affinity != "NONE"
    ]
    
    # Timeout configuration
    timeout_configuration = {
      for name, config in local.service_configs : name => {
        backend_timeout     = config.timeout_sec
        health_check_timeout = config.health_check.timeout_sec
        connection_draining = config.connection_draining_timeout_sec
      }
    }
    
    # Capacity and scaling configuration
    capacity_configuration = {
      for name, config in local.service_configs : name => {
        max_rate_per_instance = config.max_rate_per_instance
        max_utilization      = config.max_utilization
        capacity_scaler      = config.capacity_scaler
      }
    }
  }
}

# Integration endpoints for external services
output "integration_endpoints" {
  description = "Integration endpoints for external services and DNS configuration"
  value = {
    # Main load balancer endpoint
    load_balancer_endpoint = var.reserved_ip_config.create_ipv4_address ? 
      google_compute_global_address.lb_ipv4[0].address : null
    
    # Service-specific health check endpoints
    health_check_endpoints = {
      for name, config in local.service_configs : name => 
        "https://${var.reserved_ip_config.create_ipv4_address ? google_compute_global_address.lb_ipv4[0].address : "lb.example.com"}${config.health_check.request_path}"
    }
    
    # SSL certificate domains for DNS configuration
    ssl_domains = local.ssl_domains
    
    # IPv6 endpoint (if enabled)
    ipv6_endpoint = var.reserved_ip_config.create_ipv6_address ? 
      google_compute_global_address.lb_ipv6[0].address : null
    
    # Protocol and port configuration
    protocols = {
      https = "443"
      http  = var.load_balancer_config.enable_http_redirect ? "80" : null
    }
  }
}

# Cost optimization information
output "cost_optimization" {
  description = "Cost optimization information and resource usage"
  value = {
    # Environment-specific settings
    environment = var.environment
    
    # CDN usage for cost optimization
    cdn_usage = {
      enabled_services = length([
        for name, config in local.service_configs : name if config.actual_enable_cdn
      ])
      total_services = length(local.service_configs)
      cdn_optimization_ratio = length([
        for name, config in local.service_configs : name if config.actual_enable_cdn
      ]) / length(local.service_configs)
    }
    
    # Resource allocation efficiency
    resource_efficiency = {
      for name, config in local.service_configs : name => {
        backend_utilization_target = config.max_utilization
        capacity_scaler           = config.capacity_scaler
        health_check_frequency    = config.health_check.check_interval_sec
      }
    }
    
    # Regional vs global resource usage
    regional_resources = length(google_compute_region_network_endpoint_group.cloud_run_negs)
    global_resources = 1  # URL map, forwarding rules, etc.
    
    # SSL certificate optimization
    ssl_certificate_type = var.ssl_certificates.managed_certificate ? "managed" : "self-managed"
    managed_domains_count = length(local.ssl_domains)
  }
}
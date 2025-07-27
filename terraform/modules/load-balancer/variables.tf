# Load Balancer Module Variables
# Global HTTPS Load Balancer with data-driven for_each approach

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for regional resources"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
}

variable "labels" {
  description = "Labels to be applied to all resources"
  type        = map(string)
  default     = {}
}

# Data-driven service configuration - Expert recommended approach
variable "services" {
  description = "Service configuration map for load balancer backends (data-driven approach)"
  type = map(object({
    # Backend service configuration
    cloud_run_service_name = string
    cloud_run_region      = string
    cloud_run_url         = string
    port                  = optional(number, 443)
    protocol              = optional(string, "HTTPS")
    
    # Health check configuration
    health_check = object({
      path                = string
      port                = optional(number, 443)
      check_interval_sec  = optional(number, 10)
      timeout_sec         = optional(number, 5)
      healthy_threshold   = optional(number, 2)
      unhealthy_threshold = optional(number, 3)
      request_path        = optional(string, "/live")
      response            = optional(string, "")
    })
    
    # Load balancing and traffic configuration
    load_balancing_scheme = optional(string, "EXTERNAL_MANAGED")
    session_affinity     = optional(string, "NONE")
    timeout_sec          = optional(number, 30)
    connection_draining_timeout_sec = optional(number, 300)
    
    # Backend configuration
    max_rate_per_instance = optional(number, 100)
    max_utilization      = optional(number, 0.8)
    capacity_scaler      = optional(number, 1.0)
    
    # Path matching and routing
    path_rules = optional(list(object({
      paths   = list(string)
      service = string  # Reference to service key in this map
    })), [])
    
    # CDN configuration
    enable_cdn = optional(bool, false)
    cdn_config = optional(object({
      cache_mode                   = optional(string, "CACHE_ALL_STATIC")
      client_ttl                  = optional(number, 3600)
      default_ttl                 = optional(number, 3600)
      max_ttl                     = optional(number, 86400)
      negative_caching            = optional(bool, true)
      serve_while_stale          = optional(number, 86400)
      cache_key_policy = optional(object({
        include_host           = optional(bool, true)
        include_protocol       = optional(bool, true)
        include_query_string   = optional(bool, false)
        query_string_whitelist = optional(list(string), [])
        query_string_blacklist = optional(list(string), [])
      }), {})
    }), {})
    
    # Security configuration
    enable_cloud_armor = optional(bool, false)
    cloud_armor_policy = optional(string, "")
    
    # Environment-specific overrides
    environment_config = optional(object({
      dev = optional(object({
        max_rate_per_instance = optional(number, 50)
        timeout_sec          = optional(number, 60)
        enable_cdn           = optional(bool, false)
      }), {})
      staging = optional(object({
        max_rate_per_instance = optional(number, 75)
        timeout_sec          = optional(number, 45)
        enable_cdn           = optional(bool, true)
      }), {})
      production = optional(object({
        max_rate_per_instance = optional(number, 100)
        timeout_sec          = optional(number, 30)
        enable_cdn           = optional(bool, true)
      }), {})
    }), {})
  }))
  
  # Default service configuration for 7 microservices
  default = {
    user-service = {
      cloud_run_service_name = ""  # Will be populated from cloud-run module
      cloud_run_region      = ""
      cloud_run_url         = ""
      port                  = 443
      health_check = {
        path                = "/live"
        request_path        = "/live"
        check_interval_sec  = 10
        timeout_sec         = 5
        healthy_threshold   = 2
        unhealthy_threshold = 3
      }
      max_rate_per_instance = 100
      enable_cdn           = false
    }
    
    order-service = {
      cloud_run_service_name = ""
      cloud_run_region      = ""
      cloud_run_url         = ""
      port                  = 443
      health_check = {
        path                = "/live"
        request_path        = "/live"
        check_interval_sec  = 15
        timeout_sec         = 10
        healthy_threshold   = 2
        unhealthy_threshold = 5
      }
      max_rate_per_instance = 80
      timeout_sec          = 45
      enable_cdn           = false
    }
    
    billing-service = {
      cloud_run_service_name = ""
      cloud_run_region      = ""
      cloud_run_url         = ""
      port                  = 443
      health_check = {
        path                = "/live"
        request_path        = "/live"
        check_interval_sec  = 10
        timeout_sec         = 5
        healthy_threshold   = 3
        unhealthy_threshold = 2
      }
      max_rate_per_instance = 60
      timeout_sec          = 30
      enable_cdn           = false
    }
    
    inventory-service = {
      cloud_run_service_name = ""
      cloud_run_region      = ""
      cloud_run_url         = ""
      port                  = 443
      health_check = {
        path                = "/live"
        request_path        = "/live"
        check_interval_sec  = 10
        timeout_sec         = 5
        healthy_threshold   = 2
        unhealthy_threshold = 3
      }
      max_rate_per_instance = 90
      enable_cdn           = false
    }
    
    notification-service = {
      cloud_run_service_name = ""
      cloud_run_region      = ""
      cloud_run_url         = ""
      port                  = 443  
      health_check = {
        path                = "/live"
        request_path        = "/live"
        check_interval_sec  = 20
        timeout_sec         = 5
        healthy_threshold   = 2
        unhealthy_threshold = 3
      }
      max_rate_per_instance = 120
      enable_cdn           = false
    }
    
    graphql-gateway = {
      cloud_run_service_name = ""
      cloud_run_region      = ""
      cloud_run_url         = ""
      port                  = 443
      health_check = {
        path                = "/live"
        request_path        = "/live"
        check_interval_sec  = 5
        timeout_sec         = 5
        healthy_threshold   = 2
        unhealthy_threshold = 3
      }
      max_rate_per_instance = 200
      timeout_sec          = 60
      enable_cdn           = false
      path_rules = [{
        paths   = ["/graphql", "/graphql/*", "/api/*"]
        service = "graphql-gateway"
      }]
    }
    
    web-frontend = {
      cloud_run_service_name = ""
      cloud_run_region      = ""
      cloud_run_url         = ""
      port                  = 443
      health_check = {
        path                = "/live"
        request_path        = "/live"
        check_interval_sec  = 10
        timeout_sec         = 5
        healthy_threshold   = 2
        unhealthy_threshold = 3
      }
      max_rate_per_instance = 150
      enable_cdn           = true
      cdn_config = {
        cache_mode        = "CACHE_ALL_STATIC"
        client_ttl        = 3600
        default_ttl       = 3600
        max_ttl           = 86400
        negative_caching  = true
        serve_while_stale = 86400
        cache_key_policy = {
          include_host         = true
          include_protocol     = true
          include_query_string = false
        }
      }
      path_rules = [{
        paths   = ["/*"]
        service = "web-frontend"
      }]
    }
  }
}

# SSL Certificate Configuration
variable "ssl_certificates" {
  description = "SSL certificate configuration"
  type = object({
    domains                = list(string)
    managed_certificate   = optional(bool, true)
    certificate_map_name  = optional(string, "")
  })
  default = {
    domains               = []
    managed_certificate  = true
    certificate_map_name = ""
  }
}

# Global Load Balancer Configuration
variable "load_balancer_config" {
  description = "Global load balancer configuration"
  type = object({
    name_prefix                = optional(string, "lb")
    enable_http_redirect      = optional(bool, true)
    http_redirect_response_code = optional(string, "MOVED_PERMANENTLY_DEFAULT")
    enable_logging           = optional(bool, true)
    log_sample_rate         = optional(number, 1.0)
    
    # Default backend service (fallback)
    default_service         = optional(string, "web-frontend")
    
    # IP address configuration
    enable_ipv6            = optional(bool, true)
    ip_version            = optional(string, "IPV4_IPV6")
    
    # Security configuration
    enable_cloud_armor    = optional(bool, false)
    security_policy      = optional(string, "")
  })
  default = {
    name_prefix                = "lb"
    enable_http_redirect      = true
    http_redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    enable_logging           = true
    log_sample_rate         = 1.0
    default_service         = "web-frontend"
    enable_ipv6            = true
    ip_version            = "IPV4_IPV6"
    enable_cloud_armor    = false
  }
}

# Cloud Armor Security Policy Configuration
variable "cloud_armor_policies" {
  description = "Cloud Armor security policies configuration"
  type = map(object({
    description = string
    rules = list(object({
      action   = string
      priority = number
      match = object({
        versioned_expr = optional(string, "SRC_IPS_V1")
        config = object({
          src_ip_ranges = optional(list(string), [])
          src_region_codes = optional(list(string), [])
        })
      })
      description = string
      preview     = optional(bool, false)
    }))
    adaptive_protection_config = optional(object({
      layer_7_ddos_defense_config = optional(object({
        enable = optional(bool, false)
        rule_visibility = optional(string, "STANDARD")
      }), {})
    }), {})
  }))
  default = {}
}

# Monitoring and Alerting Configuration
variable "monitoring_config" {
  description = "Load balancer monitoring configuration"
  type = object({
    enable_uptime_checks     = optional(bool, true)
    enable_latency_alerts   = optional(bool, true)
    enable_error_rate_alerts = optional(bool, true)
    
    # Alert thresholds
    latency_threshold_ms    = optional(number, 1000)
    error_rate_threshold    = optional(number, 0.05)  # 5%
    uptime_threshold        = optional(number, 0.99)   # 99%
    
    # Check intervals
    uptime_check_period     = optional(string, "60s")
    alert_evaluation_period = optional(string, "300s")
  })
  default = {
    enable_uptime_checks     = true
    enable_latency_alerts   = true
    enable_error_rate_alerts = true
    latency_threshold_ms    = 1000
    error_rate_threshold    = 0.05
    uptime_threshold        = 0.99
    uptime_check_period     = "60s"
    alert_evaluation_period = "300s"
  }
}

# Reserved IP Configuration
variable "reserved_ip_config" {
  description = "Reserved IP address configuration"
  type = object({
    create_ipv4_address = optional(bool, true)
    create_ipv6_address = optional(bool, true)
    ipv4_address_name  = optional(string, "")
    ipv6_address_name  = optional(string, "")
  })
  default = {
    create_ipv4_address = true
    create_ipv6_address = true
    ipv4_address_name  = ""
    ipv6_address_name  = ""
  }
}

# Traffic routing configuration
variable "traffic_routing" {
  description = "Advanced traffic routing configuration"
  type = object({
    enable_path_routing    = optional(bool, true)
    enable_host_routing    = optional(bool, false)
    enable_header_routing  = optional(bool, false)
    
    # Default route timeout
    default_timeout_sec    = optional(number, 30)
    
    # Circuit breaker integration
    enable_circuit_breaker_routing = optional(bool, true)
    circuit_breaker_threshold     = optional(number, 50)  # Error percentage
  })
  default = {
    enable_path_routing    = true
    enable_host_routing    = false
    enable_header_routing  = false
    default_timeout_sec    = 30
    enable_circuit_breaker_routing = true
    circuit_breaker_threshold     = 50
  }
}
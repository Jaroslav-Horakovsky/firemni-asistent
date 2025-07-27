# Load Balancer Module - Global HTTPS Load Balancer with Data-Driven Approach
# Expert-recommended pattern using for_each for all 7 microservices

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.84"
    }
  }
}

# Local values for data-driven configuration
locals {
  # Common labels for all resources
  common_labels = merge(var.labels, {
    environment = var.environment
    project     = var.project_id
    module      = "load-balancer"
    managed_by  = "terraform"
  })
  
  # Environment-aware service configuration - Expert recommended data transformation
  service_configs = {
    for service_name, config in var.services : service_name => merge(
      config,
      lookup(config.environment_config, var.environment, {}),
      {
        # Generate consistent resource names
        backend_service_name = "${var.project_id}-${var.environment}-${service_name}-backend"
        health_check_name   = "${var.project_id}-${var.environment}-${service_name}-hc"
        url_map_name        = "${var.project_id}-${var.environment}-${service_name}-url-map"
        
        # Environment-specific CDN settings
        actual_enable_cdn = var.environment == "production" ? 
          config.enable_cdn : 
          lookup(lookup(config.environment_config, var.environment, {}), "enable_cdn", false)
      }
    )
  }
  
  # Path routing configuration - Data-driven URL map generation
  path_routing_rules = flatten([
    for service_name, config in local.service_configs : [
      for rule in config.path_rules : {
        service_name = service_name
        paths        = rule.paths
        target_service = rule.service
        key          = "${service_name}-${join("-", rule.paths)}"
      }
    ]
  ])
  
  # Default service for fallback routing
  default_service_name = var.load_balancer_config.default_service
  
  # SSL certificate domains
  ssl_domains = length(var.ssl_certificates.domains) > 0 ? 
    var.ssl_certificates.domains : 
    ["${var.project_id}-${var.environment}.example.com"]
}

# Reserved IP addresses
resource "google_compute_global_address" "lb_ipv4" {
  count = var.reserved_ip_config.create_ipv4_address ? 1 : 0
  
  name         = var.reserved_ip_config.ipv4_address_name != "" ? 
    var.reserved_ip_config.ipv4_address_name : 
    "${var.project_id}-${var.environment}-lb-ipv4"
  project      = var.project_id
  ip_version   = "IPV4"
  address_type = "EXTERNAL"
  
  labels = local.common_labels
}

resource "google_compute_global_address" "lb_ipv6" {
  count = var.reserved_ip_config.create_ipv6_address ? 1 : 0
  
  name         = var.reserved_ip_config.ipv6_address_name != "" ? 
    var.reserved_ip_config.ipv6_address_name : 
    "${var.project_id}-${var.environment}-lb-ipv6"
  project      = var.project_id
  ip_version   = "IPV6"
  address_type = "EXTERNAL"
  
  labels = local.common_labels
}

# SSL certificates - managed certificates for HTTPS
resource "google_compute_managed_ssl_certificate" "ssl_cert" {
  count = var.ssl_certificates.managed_certificate ? 1 : 0
  
  name    = "${var.project_id}-${var.environment}-ssl-cert"
  project = var.project_id
  
  managed {
    domains = local.ssl_domains
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Health checks for each service - Data-driven approach
resource "google_compute_health_check" "service_health_checks" {
  for_each = local.service_configs
  
  name               = each.value.health_check_name
  project            = var.project_id
  check_interval_sec = each.value.health_check.check_interval_sec
  timeout_sec        = each.value.health_check.timeout_sec
  healthy_threshold  = each.value.health_check.healthy_threshold
  unhealthy_threshold = each.value.health_check.unhealthy_threshold
  
  https_health_check {
    request_path = each.value.health_check.request_path
    port         = each.value.health_check.port
    host         = replace(each.value.cloud_run_url, "https://", "")
  }
  
  log_config {
    enable = var.load_balancer_config.enable_logging
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Backend services for each microservice - Expert recommended for_each pattern
resource "google_compute_backend_service" "service_backends" {
  for_each = local.service_configs
  
  name                     = each.value.backend_service_name
  project                  = var.project_id
  protocol                 = each.value.protocol
  port_name               = "http"
  load_balancing_scheme   = each.value.load_balancing_scheme
  timeout_sec             = each.value.timeout_sec
  connection_draining_timeout_sec = each.value.connection_draining_timeout_sec
  health_checks           = [google_compute_health_check.service_health_checks[each.key].id]
  
  # Backend configuration - Cloud Run NEG
  backend {
    group = google_compute_region_network_endpoint_group.cloud_run_negs[each.key].id
    
    # Load balancing parameters
    max_rate_per_instance = each.value.max_rate_per_instance
    max_utilization      = each.value.max_utilization
    capacity_scaler      = each.value.capacity_scaler
  }
  
  # Session affinity
  session_affinity = each.value.session_affinity
  
  # Enable CDN if configured
  dynamic "cdn_policy" {
    for_each = each.value.actual_enable_cdn ? [1] : []
    content {
      cache_mode                   = each.value.cdn_config.cache_mode
      client_ttl                  = each.value.cdn_config.client_ttl
      default_ttl                 = each.value.cdn_config.default_ttl
      max_ttl                     = each.value.cdn_config.max_ttl
      negative_caching            = each.value.cdn_config.negative_caching
      serve_while_stale          = each.value.cdn_config.serve_while_stale
      
      cache_key_policy {
        include_host           = each.value.cdn_config.cache_key_policy.include_host
        include_protocol       = each.value.cdn_config.cache_key_policy.include_protocol
        include_query_string   = each.value.cdn_config.cache_key_policy.include_query_string
        query_string_whitelist = each.value.cdn_config.cache_key_policy.query_string_whitelist
        query_string_blacklist = each.value.cdn_config.cache_key_policy.query_string_blacklist
      }
    }
  }
  
  # Cloud Armor integration
  dynamic "security_policy" {
    for_each = each.value.enable_cloud_armor && each.value.cloud_armor_policy != "" ? [1] : []
    content {
      policy = each.value.cloud_armor_policy
    }
  }
  
  # Logging configuration
  log_config {
    enable      = var.load_balancer_config.enable_logging
    sample_rate = var.load_balancer_config.log_sample_rate
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Network Endpoint Groups for Cloud Run services
resource "google_compute_region_network_endpoint_group" "cloud_run_negs" {
  for_each = local.service_configs
  
  name                  = "${var.project_id}-${var.environment}-${each.key}-neg"
  project               = var.project_id
  network_endpoint_type = "SERVERLESS"
  region               = each.value.cloud_run_region
  
  cloud_run {
    service = each.value.cloud_run_service_name
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# URL Map - Data-driven path routing configuration
resource "google_compute_url_map" "main" {
  name            = "${var.project_id}-${var.environment}-url-map"
  project         = var.project_id
  default_service = google_compute_backend_service.service_backends[local.default_service_name].id
  
  # Path-based routing rules - Generated from service configuration
  dynamic "path_matcher" {
    for_each = var.traffic_routing.enable_path_routing ? [1] : []
    content {
      name            = "path-matcher"
      default_service = google_compute_backend_service.service_backends[local.default_service_name].id
      
      # Dynamic path rules based on service configuration
      dynamic "path_rule" {
        for_each = {
          for rule in local.path_routing_rules : rule.key => rule
        }
        content {
          paths   = path_rule.value.paths
          service = google_compute_backend_service.service_backends[path_rule.value.target_service].id
        }
      }
    }
  }
  
  # Host-based routing (if enabled)
  dynamic "host_rule" {
    for_each = var.traffic_routing.enable_host_routing ? local.ssl_domains : []
    content {
      hosts        = [host_rule.value]
      path_matcher = "path-matcher"
    }
  }
}

# HTTPS Target Proxy
resource "google_compute_target_https_proxy" "main" {
  name    = "${var.project_id}-${var.environment}-https-proxy"
  project = var.project_id
  url_map = google_compute_url_map.main.id
  
  ssl_certificates = var.ssl_certificates.managed_certificate ? 
    [google_compute_managed_ssl_certificate.ssl_cert[0].id] : 
    []
  
  lifecycle {
    create_before_destroy = true
  }
}

# HTTP Target Proxy (for redirect)
resource "google_compute_target_http_proxy" "redirect" {
  count = var.load_balancer_config.enable_http_redirect ? 1 : 0
  
  name    = "${var.project_id}-${var.environment}-http-proxy"
  project = var.project_id
  url_map = google_compute_url_map.http_redirect[0].id
  
  lifecycle {
    create_before_destroy = true
  }
}

# HTTP to HTTPS redirect URL map
resource "google_compute_url_map" "http_redirect" {
  count = var.load_balancer_config.enable_http_redirect ? 1 : 0
  
  name    = "${var.project_id}-${var.environment}-http-redirect"
  project = var.project_id
  
  default_url_redirect {
    redirect_response_code = var.load_balancer_config.http_redirect_response_code
    https_redirect        = true
    strip_query           = false
  }
}

# Global Forwarding Rules
resource "google_compute_global_forwarding_rule" "https" {
  name                  = "${var.project_id}-${var.environment}-https-fw-rule"
  project               = var.project_id
  ip_protocol          = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range           = "443"
  target               = google_compute_target_https_proxy.main.id
  ip_address           = var.reserved_ip_config.create_ipv4_address ? 
    google_compute_global_address.lb_ipv4[0].id : null
  
  labels = local.common_labels
}

resource "google_compute_global_forwarding_rule" "http" {
  count = var.load_balancer_config.enable_http_redirect ? 1 : 0
  
  name                  = "${var.project_id}-${var.environment}-http-fw-rule" 
  project               = var.project_id
  ip_protocol          = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range           = "80"
  target               = google_compute_target_http_proxy.redirect[0].id
  ip_address           = var.reserved_ip_config.create_ipv4_address ? 
    google_compute_global_address.lb_ipv4[0].id : null
  
  labels = local.common_labels
}

# IPv6 Forwarding Rules (if enabled)
resource "google_compute_global_forwarding_rule" "https_ipv6" {
  count = var.load_balancer_config.enable_ipv6 && var.reserved_ip_config.create_ipv6_address ? 1 : 0
  
  name                  = "${var.project_id}-${var.environment}-https-ipv6-fw-rule"
  project               = var.project_id
  ip_protocol          = "TCP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range           = "443"
  target               = google_compute_target_https_proxy.main.id
  ip_address           = google_compute_global_address.lb_ipv6[0].id
  
  labels = local.common_labels
}

# Cloud Armor Security Policies
resource "google_compute_security_policy" "policies" {
  for_each = var.cloud_armor_policies
  
  name        = "${var.project_id}-${var.environment}-${each.key}-policy"
  project     = var.project_id
  description = each.value.description
  
  # Security rules
  dynamic "rule" {
    for_each = each.value.rules
    content {
      action   = rule.value.action
      priority = rule.value.priority
      
      match {
        versioned_expr = rule.value.match.versioned_expr
        config {
          src_ip_ranges    = rule.value.match.config.src_ip_ranges
          src_region_codes = rule.value.match.config.src_region_codes
        }
      }
      
      description = rule.value.description
      preview     = rule.value.preview
    }
  }
  
  # Adaptive protection
  dynamic "adaptive_protection_config" {
    for_each = each.value.adaptive_protection_config != null ? [each.value.adaptive_protection_config] : []
    content {
      layer_7_ddos_defense_config {
        enable          = adaptive_protection_config.value.layer_7_ddos_defense_config.enable
        rule_visibility = adaptive_protection_config.value.layer_7_ddos_defense_config.rule_visibility
      }
    }
  }
}

# Monitoring - Uptime checks for load balancer endpoints
resource "google_monitoring_uptime_check_config" "lb_uptime_checks" {
  for_each = var.monitoring_config.enable_uptime_checks ? local.service_configs : {}
  
  display_name = "${var.environment}-lb-${each.key}-uptime"
  project      = var.project_id
  timeout      = "10s"
  period       = var.monitoring_config.uptime_check_period
  
  http_check {
    path           = each.value.health_check.request_path
    port           = "443"
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
    
    headers = {
      "User-Agent" = "Google-HC/1.0"
    }
  }
  
  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.reserved_ip_config.create_ipv4_address ? 
        google_compute_global_address.lb_ipv4[0].address : 
        "example.com"  # Fallback for monitoring
    }
  }
  
  content_matchers {
    content = "OK"
    matcher = "CONTAINS_STRING"
  }
  
  checker_type = "STATIC_IP_CHECKERS"
}

# Alert policies for load balancer performance
resource "google_monitoring_alert_policy" "latency_alerts" {
  for_each = var.monitoring_config.enable_latency_alerts ? local.service_configs : {}
  
  display_name = "${var.environment}-lb-${each.key}-latency-alert"
  project      = var.project_id
  
  conditions {
    display_name = "HTTP load balancer latency"
    
    condition_threshold {
      filter         = "resource.type=\"https_lb_rule\" AND resource.label.backend_target_name=\"${each.value.backend_service_name}\""
      duration       = var.monitoring_config.alert_evaluation_period
      comparison     = "COMPARISON_GT" 
      threshold_value = var.monitoring_config.latency_threshold_ms
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_PERCENTILE_95"
        group_by_fields    = ["resource.label.backend_target_name"]
      }
    }
  }
  
  alert_strategy {
    auto_close = "1800s"  # 30 minutes
  }
  
  combiner = "OR"
  enabled  = true
}

# Error rate monitoring
resource "google_monitoring_alert_policy" "error_rate_alerts" {
  for_each = var.monitoring_config.enable_error_rate_alerts ? local.service_configs : {}
  
  display_name = "${var.environment}-lb-${each.key}-error-rate-alert"
  project      = var.project_id
  
  conditions {
    display_name = "HTTP load balancer error rate"
    
    condition_threshold {
      filter         = "resource.type=\"https_lb_rule\" AND resource.label.backend_target_name=\"${each.value.backend_service_name}\" AND metric.label.response_code_class!=\"2xx\""
      duration       = var.monitoring_config.alert_evaluation_period
      comparison     = "COMPARISON_GT"
      threshold_value = var.monitoring_config.error_rate_threshold
      
      aggregations {
        alignment_period     = "60s"
        per_series_aligner  = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
        group_by_fields     = ["resource.label.backend_target_name"]
      }
    }
  }
  
  alert_strategy {
    auto_close = "1800s"
  }
  
  combiner = "OR" 
  enabled  = true
}
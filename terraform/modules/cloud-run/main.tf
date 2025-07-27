# Cloud Run Module - Microservices with Resilience Patterns
# Terraform module for deploying Cloud Run services with circuit breakers and health checks

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.84"
    }
  }
}

# Local values for service configuration
locals {
  # Common labels for all resources
  common_labels = merge(var.labels, {
    environment = var.environment
    project     = var.project_id
    module      = "cloud-run"
    managed_by  = "terraform"
  })
  
  # Environment-specific service configuration
  service_configs = {
    for name, config in var.services : name => merge(
      config,
      lookup(config.scaling_config, var.environment, {}),
      {
        # Replace PROJECT_ID placeholder in image URLs
        image = replace(config.image, "PROJECT_ID", var.project_id)
        
        # Environment-specific resource allocation
        actual_cpu = lookup(
          lookup(config.scaling_config, var.environment, {}),
          "cpu",
          config.cpu
        )
        actual_memory = lookup(
          lookup(config.scaling_config, var.environment, {}),
          "memory", 
          config.memory
        )
        actual_min_instances = lookup(
          lookup(config.scaling_config, var.environment, {}),
          "min_instances",
          config.min_instances
        )
        actual_max_instances = lookup(
          lookup(config.scaling_config, var.environment, {}),
          "max_instances",
          config.max_instances
        )
      }
    )
  }
  
  # Service dependencies for circuit breaker configuration
  service_dependencies = {
    for service_name, config in var.services : service_name => config.dependencies
  }
  
  # Common environment variables for all services
  common_env_vars = {
    ENVIRONMENT           = var.environment
    PROJECT_ID           = var.project_id
    REGION              = var.region
    GOOGLE_CLOUD_PROJECT = var.project_id
    
    # Resilience pattern configuration
    CIRCUIT_BREAKER_TIMEOUT                    = "3000"
    CIRCUIT_BREAKER_ERROR_THRESHOLD_PERCENTAGE = "50"
    CIRCUIT_BREAKER_RESET_TIMEOUT             = "30000"
    CIRCUIT_BREAKER_CAPACITY                  = "20"
    CIRCUIT_BREAKER_ROLLING_COUNT_TIMEOUT     = "60000"
    CIRCUIT_BREAKER_ROLLING_COUNT_BUCKETS     = "10"
    
    # Health check endpoints
    HEALTH_CHECK_STARTUP_PATH  = "/health"
    HEALTH_CHECK_LIVENESS_PATH = "/live"
    HEALTH_CHECK_READINESS_PATH = "/ready"
    
    # Database connection
    DB_HOST = var.database_config.host
    DB_PORT = var.database_config.port
    DB_NAME = var.database_config.database_name
    
    # Monitoring configuration
    MONITORING_ENABLED     = var.enable_monitoring ? "true" : "false"
    TRACING_ENABLED       = var.monitoring_config.enable_tracing ? "true" : "false"
    PROFILING_ENABLED     = var.monitoring_config.enable_profiling ? "true" : "false"
    LOG_LEVEL            = var.monitoring_config.log_level
    METRICS_PORT         = tostring(var.monitoring_config.metrics_port)
  }
}

# Cloud Run services
resource "google_cloud_run_service" "services" {
  for_each = local.service_configs
  
  name     = "${var.project_id}-${var.environment}-${each.key}"
  location = var.region
  project  = var.project_id
  
  # Auto-generate revision names
  autogenerate_revision_name = true
  
  template {
    metadata {
      labels = merge(local.common_labels, {
        service = each.key
        version = "latest"
      })
      
      annotations = merge(
        {
          # Auto-scaling configuration
          "autoscaling.knative.dev/minScale" = tostring(each.value.actual_min_instances)
          "autoscaling.knative.dev/maxScale" = tostring(each.value.actual_max_instances)
          
          # CPU utilization target
          "autoscaling.knative.dev/target" = tostring(var.autoscaling_config.request_utilization_target)
          
          # CPU and memory allocation
          "run.googleapis.com/cpu-throttling" = "false"
          "run.googleapis.com/execution-environment" = "gen2"
          
          # Deployment configuration
          "run.googleapis.com/minReadySeconds" = tostring(var.deployment_config.min_ready_seconds)
        },
        # VPC connector configuration
        var.vpc_connector_name != "" ? {
          "run.googleapis.com/vpc-access-connector" = var.vpc_connector_name
          "run.googleapis.com/vpc-access-egress"    = var.vpc_egress
        } : {},
        # Binary Authorization
        var.security_config.binary_authorization ? {
          "run.googleapis.com/binary-authorization" = "default"
        } : {},
        # CMEK encryption
        var.security_config.cmek_key != "" ? {
          "run.googleapis.com/encryption-key" = var.security_config.cmek_key
        } : {}
      )
    }
    
    spec {
      # Service account
      service_account_name = lookup(var.service_account_emails, each.key, "")
      
      # Container concurrency
      container_concurrency = each.value.concurrency
      
      # Timeout
      timeout_seconds = each.value.timeout
      
      containers {
        image = each.value.image
        
        # Port configuration
        ports {
          name           = "http1"
          container_port = each.value.port
          protocol       = "TCP"
        }
        
        # Resource allocation
        resources {
          limits = {
            cpu    = each.value.actual_cpu
            memory = each.value.actual_memory
          }
          requests = {
            cpu    = each.value.actual_cpu
            memory = each.value.actual_memory
          }
        }
        
        # Environment variables
        dynamic "env" {
          for_each = merge(
            local.common_env_vars,
            each.value.environment_variables,
            # Service-specific circuit breaker config
            {
              SERVICE_DEPENDENCIES = join(",", each.value.dependencies)
              CIRCUIT_BREAKER_TIMEOUT = tostring(each.value.circuit_breaker_config.timeout)
              CIRCUIT_BREAKER_ERROR_THRESHOLD = tostring(each.value.circuit_breaker_config.error_threshold_percentage)
              CIRCUIT_BREAKER_RESET_TIMEOUT = tostring(each.value.circuit_breaker_config.reset_timeout)
            }
          )
          content {
            name  = env.key
            value = env.value
          }
        }
        
        # Secret Manager secrets
        dynamic "env" {
          for_each = merge(each.value.secrets, var.database_config.connection_secrets)
          content {
            name = env.key
            value_from {
              secret_key_ref {
                name = env.value
                key  = var.secret_manager_secrets[env.value].version
              }
            }
          }
        }
        
        # Startup Probe
        startup_probe {
          initial_delay_seconds = each.value.startup_probe.initial_delay_seconds
          timeout_seconds      = each.value.startup_probe.timeout_seconds
          period_seconds       = each.value.startup_probe.period_seconds
          failure_threshold    = each.value.startup_probe.failure_threshold
          
          http_get {
            path = each.value.startup_probe.path
            port = each.value.startup_probe.port != null ? each.value.startup_probe.port : each.value.port
            
            http_headers {
              name  = "Custom-Health-Check"
              value = "startup"
            }
          }
        }
        
        # Liveness Probe (/live endpoint)
        liveness_probe {
          initial_delay_seconds = each.value.liveness_probe.initial_delay_seconds
          timeout_seconds      = each.value.liveness_probe.timeout_seconds
          period_seconds       = each.value.liveness_probe.period_seconds
          failure_threshold    = each.value.liveness_probe.failure_threshold
          
          http_get {
            path = each.value.liveness_probe.path
            port = each.value.liveness_probe.port != null ? each.value.liveness_probe.port : each.value.port
            
            http_headers {
              name  = "Custom-Health-Check"
              value = "liveness"
            }
          }
        }
        
        # Readiness Probe (/ready endpoint)
        # Note: Cloud Run uses this for traffic routing decisions
        dynamic "startup_probe" {
          for_each = each.value.readiness_probe != null ? [each.value.readiness_probe] : []
          content {
            initial_delay_seconds = startup_probe.value.initial_delay_seconds
            timeout_seconds      = startup_probe.value.timeout_seconds
            period_seconds       = startup_probe.value.period_seconds
            failure_threshold    = startup_probe.value.failure_threshold
            
            http_get {
              path = startup_probe.value.path
              port = startup_probe.value.port != null ? startup_probe.value.port : each.value.port
              
              http_headers {
                name  = "Custom-Health-Check"
                value = "readiness"
              }
            }
          }
        }
      }
    }
  }
  
  traffic {
    percent         = 100
    latest_revision = true
  }
  
  # Lifecycle management
  lifecycle {
    ignore_changes = [
      template[0].metadata[0].annotations["client.knative.dev/user-image"],
      template[0].metadata[0].annotations["run.googleapis.com/client-name"],
      template[0].metadata[0].annotations["run.googleapis.com/client-version"]
    ]
  }
}

# IAM policy for unauthenticated access (if required)
resource "google_cloud_run_service_iam_member" "public_access" {
  for_each = {
    for name, config in var.services : name => config
    if config.allow_unauthenticated
  }
  
  location = google_cloud_run_service.services[each.key].location
  service  = google_cloud_run_service.services[each.key].name
  role     = "roles/run.invoker"
  member   = "allUsers"
  project  = var.project_id
}

# Domain mapping for custom domains (if configured)
resource "google_cloud_run_domain_mapping" "domain_mappings" {
  for_each = {
    for name, config in var.services : name => config
    if lookup(config, "custom_domain", "") != ""
  }
  
  location = var.region
  name     = each.value.custom_domain
  project  = var.project_id
  
  metadata {
    namespace = var.project_id
    labels    = local.common_labels
  }
  
  spec {
    route_name = google_cloud_run_service.services[each.key].name
  }
}

# Service-to-service authentication IAM bindings
resource "google_cloud_run_service_iam_member" "service_to_service" {
  for_each = {
    for combination in flatten([
      for service_name, dependencies in local.service_dependencies : [
        for dependency in dependencies : {
          caller     = service_name
          target     = dependency
          key        = "${service_name}-to-${dependency}"
        }
      ]
    ]) : combination.key => combination
  }
  
  location = google_cloud_run_service.services[each.value.target].location
  service  = google_cloud_run_service.services[each.value.target].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${lookup(var.service_account_emails, each.value.caller, "")}"
  project  = var.project_id
  
  depends_on = [google_cloud_run_service.services]
}

# Monitoring - Uptime checks for health endpoints
resource "google_monitoring_uptime_check_config" "health_checks" {
  for_each = var.enable_monitoring ? var.services : {}
  
  display_name = "${var.environment}-${each.key}-health-check"
  project      = var.project_id
  
  timeout = "10s"
  period  = "60s"
  
  http_check {
    path           = each.value.liveness_probe.path
    port           = "443"
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
    
    headers = {
      "Custom-Health-Check" = "monitoring"
    }
  }
  
  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = google_cloud_run_service.services[each.key].status[0].url
    }
  }
  
  content_matchers {
    content = "OK"
    matcher = "CONTAINS_STRING"
  }
  
  checker_type = "STATIC_IP_CHECKERS"
}

# Alert policies for service health
resource "google_monitoring_alert_policy" "service_health" {
  for_each = var.enable_monitoring ? var.services : {}
  
  display_name = "${var.environment}-${each.key}-health-alert"
  project      = var.project_id
  
  conditions {
    display_name = "Uptime check failure"
    
    condition_threshold {
      filter         = "resource.type=\"uptime_url\" AND metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\""
      duration       = "120s"
      comparison     = "COMPARISON_EQUAL"
      threshold_value = 0
      
      trigger {
        count = 1
      }
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields = ["resource.label.project_id"]
      }
    }
  }
  
  alert_strategy {
    auto_close = "86400s"  # 24 hours
  }
  
  combiner = "OR"
  enabled  = true
  
  notification_channels = []  # Will be populated by monitoring module
}

# Circuit breaker monitoring alerts
resource "google_monitoring_alert_policy" "circuit_breaker_open" {
  for_each = var.enable_monitoring ? {
    for name, config in var.services : name => config
    if length(config.dependencies) > 0
  } : {}
  
  display_name = "${var.environment}-${each.key}-circuit-breaker-alert"
  project      = var.project_id
  
  conditions {
    display_name = "Circuit breaker open"
    
    condition_threshold {
      filter         = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${google_cloud_run_service.services[each.key].name}\" AND metric.type=\"custom.googleapis.com/circuit_breaker/state\""
      duration       = "300s"
      comparison     = "COMPARISON_EQUAL"
      threshold_value = 1  # 1 = OPEN state
      
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MOST_RECENT"
      }
    }
  }
  
  alert_strategy {
    auto_close = "3600s"  # 1 hour
  }
  
  combiner = "OR"
  enabled  = true
}

# Auto-scaling configuration
resource "google_cloud_run_service" "services_with_annotations" {
  for_each = {}  # Placeholder for additional auto-scaling annotations if needed
  
  # This resource exists to demonstrate how additional auto-scaling
  # configurations could be applied using annotations
}

# Revision traffic allocation (for blue-green deployments)
resource "google_cloud_run_service_iam_policy" "traffic_allocation" {
  for_each = var.traffic_allocation
  
  location = google_cloud_run_service.services[each.key].location
  service  = google_cloud_run_service.services[each.key].name
  project  = var.project_id
  
  # This would be used for advanced traffic splitting scenarios
  # Implementation depends on specific blue-green deployment requirements
}
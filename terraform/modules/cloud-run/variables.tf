# Cloud Run Module Variables
# Manages Cloud Run services for microservices with resilience patterns

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region for Cloud Run services"
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

# Service Account Configuration
variable "service_account_emails" {
  description = "Service account emails for each microservice"
  type        = map(string)
  default     = {}
}

# Microservices Configuration
variable "services" {
  description = "Configuration for Cloud Run services"
  type = map(object({
    image             = string
    port              = optional(number, 8080)
    cpu               = optional(string, "1000m")
    memory            = optional(string, "2Gi")
    min_instances     = optional(number, 1)
    max_instances     = optional(number, 100)
    concurrency       = optional(number, 80)
    timeout           = optional(number, 300)
    
    # Resilience Configuration
    startup_probe = optional(object({
      initial_delay_seconds = optional(number, 10)
      timeout_seconds      = optional(number, 5)
      period_seconds       = optional(number, 10)
      failure_threshold    = optional(number, 3)
      path                 = optional(string, "/health")
      port                 = optional(number)
    }), {
      initial_delay_seconds = 10
      timeout_seconds      = 5
      period_seconds       = 10
      failure_threshold    = 3
      path                 = "/health"
    })
    
    liveness_probe = optional(object({
      initial_delay_seconds = optional(number, 30)
      timeout_seconds      = optional(number, 5)
      period_seconds       = optional(number, 30)
      failure_threshold    = optional(number, 3)
      path                 = optional(string, "/live")
      port                 = optional(number)
    }), {
      initial_delay_seconds = 30
      timeout_seconds      = 5
      period_seconds       = 30
      failure_threshold    = 3
      path                 = "/live"
    })
    
    readiness_probe = optional(object({
      initial_delay_seconds = optional(number, 5)
      timeout_seconds      = optional(number, 5)
      period_seconds       = optional(number, 10)
      failure_threshold    = optional(number, 3)
      path                 = optional(string, "/ready")
      port                 = optional(number)
    }), {
      initial_delay_seconds = 5
      timeout_seconds      = 5
      period_seconds       = 10
      failure_threshold    = 3
      path                 = "/ready"
    })
    
    # Environment-specific scaling
    scaling_config = optional(object({
      dev = optional(object({
        min_instances = optional(number, 0)
        max_instances = optional(number, 10)
        cpu          = optional(string, "500m")
        memory       = optional(string, "1Gi")
      }), {})
      staging = optional(object({
        min_instances = optional(number, 1)
        max_instances = optional(number, 50)
        cpu          = optional(string, "1000m")
        memory       = optional(string, "2Gi")
      }), {})
      production = optional(object({
        min_instances = optional(number, 2)
        max_instances = optional(number, 100)
        cpu          = optional(string, "1000m")
        memory       = optional(string, "2Gi")
      }), {})
    }), {})
    
    # Environment Variables
    environment_variables = optional(map(string), {})
    secrets              = optional(map(string), {})
    
    # Ingress and Networking
    ingress = optional(string, "INGRESS_TRAFFIC_ALL")
    allow_unauthenticated = optional(bool, false)
    
    # Service Dependencies (for resilience patterns)
    dependencies = optional(list(string), [])
    circuit_breaker_config = optional(object({
      timeout                    = optional(number, 3000)
      error_threshold_percentage = optional(number, 50)
      reset_timeout             = optional(number, 30000)
      capacity                  = optional(number, 20)
      rolling_count_timeout     = optional(number, 60000)
      rolling_count_buckets     = optional(number, 10)
    }), {
      timeout                    = 3000
      error_threshold_percentage = 50
      reset_timeout             = 30000
      capacity                  = 20
      rolling_count_timeout     = 60000
      rolling_count_buckets     = 10
    })
  }))
  default = {
    user-service = {
      image = "gcr.io/PROJECT_ID/user-service:latest"
      port = 8080
      dependencies = []
      environment_variables = {
        SERVICE_NAME = "user-service"
        PORT = "8080"
      }
    }
    order-service = {
      image = "gcr.io/PROJECT_ID/order-service:latest"
      port = 8081
      dependencies = ["billing-service", "inventory-service", "notification-service"]
      environment_variables = {
        SERVICE_NAME = "order-service"
        PORT = "8081"
      }
    }
    billing-service = {
      image = "gcr.io/PROJECT_ID/billing-service:latest"
      port = 8082
      dependencies = ["notification-service"]
      environment_variables = {
        SERVICE_NAME = "billing-service"
        PORT = "8082"
      }
    }
    inventory-service = {
      image = "gcr.io/PROJECT_ID/inventory-service:latest"
      port = 8083
      dependencies = ["notification-service"]
      environment_variables = {
        SERVICE_NAME = "inventory-service"
        PORT = "8083"
      }
    }
    notification-service = {
      image = "gcr.io/PROJECT_ID/notification-service:latest"
      port = 8084
      dependencies = []
      environment_variables = {
        SERVICE_NAME = "notification-service"
        PORT = "8084"
      }
    }
    graphql-gateway = {
      image = "gcr.io/PROJECT_ID/graphql-gateway:latest"
      port = 4000
      dependencies = ["user-service", "order-service", "billing-service", "inventory-service"]
      min_instances = 2
      max_instances = 200
      environment_variables = {
        SERVICE_NAME = "graphql-gateway"
        PORT = "4000"
      }
    }
    web-frontend = {
      image = "gcr.io/PROJECT_ID/web-frontend:latest"
      port = 3000
      dependencies = ["graphql-gateway"]
      min_instances = 1
      max_instances = 50
      environment_variables = {
        SERVICE_NAME = "web-frontend"
        PORT = "3000"
      }
    }
  }
}

# VPC Configuration
variable "vpc_connector_name" {
  description = "VPC connector name for private networking"
  type        = string
  default     = ""
}

variable "vpc_egress" {
  description = "VPC egress configuration"
  type        = string
  default     = "ALL_TRAFFIC"
  validation {
    condition     = contains(["ALL_TRAFFIC", "PRIVATE_RANGES_ONLY"], var.vpc_egress)
    error_message = "VPC egress must be either ALL_TRAFFIC or PRIVATE_RANGES_ONLY."
  }
}

# Secret Manager Integration
variable "secret_manager_secrets" {
  description = "Secret Manager secrets to mount in services"
  type = map(object({
    secret_name = string
    version     = optional(string, "latest")
    env_var     = string
  }))
  default = {}
}

# Database Configuration
variable "database_config" {
  description = "Database connection configuration"
  type = object({
    host                = string
    port                = optional(string, "5432")
    database_name       = string
    connection_secrets  = map(string)  # Secret Manager secret names
  })
  default = {
    host                = ""
    port                = "5432"
    database_name       = ""
    connection_secrets  = {}
  }
}

# Monitoring Configuration
variable "enable_monitoring" {
  description = "Enable Cloud Run monitoring and observability"
  type        = bool
  default     = true
}

variable "monitoring_config" {
  description = "Monitoring and observability configuration"
  type = object({
    enable_tracing     = optional(bool, true)
    enable_profiling   = optional(bool, false)
    log_level         = optional(string, "INFO")
    metrics_port      = optional(number, 9090)
  })
  default = {
    enable_tracing   = true
    enable_profiling = false
    log_level       = "INFO"
    metrics_port    = 9090
  }
}

# Security Configuration
variable "security_config" {
  description = "Security configuration for Cloud Run services"
  type = object({
    require_authentication = optional(bool, true)
    allowed_ingress       = optional(string, "INGRESS_TRAFFIC_ALL")
    binary_authorization  = optional(bool, false)
    cmek_key             = optional(string, "")
  })
  default = {
    require_authentication = true
    allowed_ingress       = "INGRESS_TRAFFIC_ALL"
    binary_authorization  = false
    cmek_key             = ""
  }
}

# Traffic Allocation
variable "traffic_allocation" {
  description = "Traffic allocation configuration for services"
  type = map(object({
    percent = number
    tag     = optional(string)
    latest_revision = optional(bool, true)
  }))
  default = {}
}

# Load Balancing Configuration
variable "load_balancer_config" {
  description = "Load balancer configuration"
  type = object({
    enable_cdn              = optional(bool, false)
    enable_ssl_redirect     = optional(bool, true)
    enable_compression      = optional(bool, true)
    timeout_sec            = optional(number, 30)
    connection_draining_timeout_sec = optional(number, 300)
  })
  default = {
    enable_cdn              = false
    enable_ssl_redirect     = true
    enable_compression      = true
    timeout_sec            = 30
    connection_draining_timeout_sec = 300
  }
}

# Auto-scaling Configuration
variable "autoscaling_config" {
  description = "Auto-scaling configuration"
  type = object({
    enable_cpu_utilization    = optional(bool, true)
    cpu_utilization_target    = optional(number, 70)
    enable_request_utilization = optional(bool, true)
    request_utilization_target = optional(number, 80)
    scale_down_delay         = optional(string, "5m")
    scale_up_delay           = optional(string, "1m")
  })
  default = {
    enable_cpu_utilization    = true
    cpu_utilization_target    = 70
    enable_request_utilization = true
    request_utilization_target = 80
    scale_down_delay         = "5m"
    scale_up_delay           = "1m"
  }
}

# Deployment Configuration
variable "deployment_config" {
  description = "Deployment configuration"
  type = object({
    min_ready_seconds        = optional(number, 30)
    progress_deadline_seconds = optional(number, 600)
    revision_history_limit   = optional(number, 5)
  })
  default = {
    min_ready_seconds        = 30
    progress_deadline_seconds = 600
    revision_history_limit   = 5
  }
}
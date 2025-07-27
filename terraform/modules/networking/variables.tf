# Networking Module Variables

variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "labels" {
  description = "Labels to be applied to resources"
  type        = map(string)
  default     = {}
}

# Network Configuration
variable "subnet_cidr" {
  description = "CIDR range for the main subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "services_cidr" {
  description = "CIDR range for services (secondary range)"
  type        = string
  default     = "10.1.0.0/16"
}

variable "pods_cidr" {
  description = "CIDR range for pods (secondary range)"
  type        = string
  default     = "10.2.0.0/16"
}

variable "connector_cidr" {
  description = "CIDR range for VPC connector"
  type        = string
  default     = "10.8.0.0/28"
}

# Security Configuration
variable "allowed_ssh_ranges" {
  description = "IP ranges allowed for SSH access"
  type        = list(string)
  default     = []
}

variable "allowed_ip_ranges" {
  description = "IP ranges allowed through security policy"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_security_policy" {
  description = "Enable Cloud Armor security policy"
  type        = bool
  default     = false
}

variable "enable_adaptive_protection" {
  description = "Enable Cloud Armor adaptive protection"
  type        = bool
  default     = false
}

# SSL Configuration
variable "enable_ssl" {
  description = "Enable SSL certificate"
  type        = bool
  default     = true
}

variable "ssl_domains" {
  description = "Domains for SSL certificate"
  type        = list(string)
  default     = []
}
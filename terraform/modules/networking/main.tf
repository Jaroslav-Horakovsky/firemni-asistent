# Networking Module for Firemní Asistent
# Creates VPC, subnets, and VPC connector for Cloud Run

terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# VPC Network
resource "google_compute_network" "vpc_network" {
  name                    = "${var.environment}-firemni-asistent-vpc"
  auto_create_subnetworks = false
  routing_mode           = "REGIONAL"
  
  project = var.project_id
}

# Subnet for Cloud Run services
resource "google_compute_subnetwork" "subnet" {
  name          = "${var.environment}-firemni-asistent-subnet"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc_network.id
  
  project = var.project_id
  
  # Enable private Google access for Cloud SQL
  private_ip_google_access = true
  
  # Secondary ranges for future use (GKE, etc.)
  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.services_cidr
  }
  
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.pods_cidr
  }
}

# Cloud Router for NAT
resource "google_compute_router" "router" {
  name    = "${var.environment}-firemni-asistent-router"
  region  = var.region
  network = google_compute_network.vpc_network.id
  project = var.project_id
}

# NAT Gateway for outbound internet access
resource "google_compute_router_nat" "nat" {
  name                               = "${var.environment}-firemni-asistent-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
  project                            = var.project_id

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Firewall rules
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.environment}-firemni-asistent-allow-internal"
  network = google_compute_network.vpc_network.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.subnet_cidr, var.services_cidr, var.pods_cidr]
}

resource "google_compute_firewall" "allow_health_checks" {
  name    = "${var.environment}-firemni-asistent-allow-health-checks"
  network = google_compute_network.vpc_network.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["8080", "80", "443"]
  }

  source_ranges = [
    "130.211.0.0/22",  # Google health check ranges
    "35.191.0.0/16"
  ]
  
  target_tags = ["firemni-asistent-service"]
}

resource "google_compute_firewall" "allow_ssh" {
  name    = "${var.environment}-firemni-asistent-allow-ssh"
  network = google_compute_network.vpc_network.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.allowed_ssh_ranges
  target_tags   = ["ssh-allowed"]
}

# Private Service Connection for Cloud SQL
resource "google_compute_global_address" "private_ip_address" {
  name          = "${var.environment}-firemni-asistent-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc_network.id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_service_connection" {
  network                 = google_compute_network.vpc_network.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# VPC Connector for Cloud Run
resource "google_vpc_access_connector" "connector" {
  name          = "${var.environment}-firemni-asistent-connector"
  region        = var.region
  project       = var.project_id
  network       = google_compute_network.vpc_network.name
  ip_cidr_range = var.connector_cidr
  
  min_instances = var.environment == "production" ? 2 : 1
  max_instances = var.environment == "production" ? 10 : 3
  
  machine_type = var.environment == "production" ? "e2-standard-4" : "e2-micro"
  
  depends_on = [google_compute_subnetwork.subnet]
}

# Global Static IP for Load Balancer
resource "google_compute_global_address" "lb_ip" {
  name         = "${var.environment}-firemni-asistent-lb-ip"
  project      = var.project_id
  address_type = "EXTERNAL"
}

# SSL Certificate (Let's Encrypt style managed certificate)
resource "google_compute_managed_ssl_certificate" "ssl_cert" {
  count   = var.enable_ssl ? 1 : 0
  name    = "${var.environment}-firemni-asistent-ssl-cert"
  project = var.project_id

  managed {
    domains = var.ssl_domains
  }
}

# Network Security Policy (if enabled)
resource "google_compute_security_policy" "security_policy" {
  count   = var.enable_security_policy ? 1 : 0
  name    = "${var.environment}-firemni-asistent-security-policy"
  project = var.project_id

  rule {
    action   = "allow"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = var.allowed_ip_ranges
      }
    }
    description = "Allow traffic from allowed IP ranges"
  }

  rule {
    action   = "deny(403)"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default deny rule"
  }
}

# Cloud Armor adaptive protection (production only)
resource "google_compute_security_policy" "adaptive_protection" {
  count   = var.environment == "production" && var.enable_adaptive_protection ? 1 : 0
  name    = "${var.environment}-firemni-asistent-adaptive-protection"
  project = var.project_id

  adaptive_protection_config {
    layer_7_ddos_defense_config {
      enable = true
    }
  }

  rule {
    action   = "allow"
    priority = "1000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule with adaptive protection"
  }
}
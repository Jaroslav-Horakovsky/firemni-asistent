# Networking Module Outputs

output "vpc_network_id" {
  description = "The VPC network ID"
  value       = google_compute_network.vpc_network.id
}

output "vpc_network_name" {
  description = "The VPC network name"
  value       = google_compute_network.vpc_network.name
}

output "subnet_id" {
  description = "The subnet ID"
  value       = google_compute_subnetwork.subnet.id
}

output "subnet_name" {
  description = "The subnet name"
  value       = google_compute_subnetwork.subnet.name
}

output "vpc_connector_id" {
  description = "The VPC connector ID"
  value       = google_vpc_access_connector.connector.id
}

output "vpc_connector_name" {
  description = "The VPC connector name"
  value       = google_vpc_access_connector.connector.name
}

output "private_service_connection_id" {
  description = "The private service connection ID"
  value       = google_service_networking_connection.private_service_connection.network
}

output "lb_external_ip" {
  description = "The load balancer external IP address"
  value       = google_compute_global_address.lb_ip.address
}

output "lb_ip_name" {
  description = "The load balancer IP address name"
  value       = google_compute_global_address.lb_ip.name
}

output "ssl_certificate_id" {
  description = "The SSL certificate ID"
  value       = var.enable_ssl ? google_compute_managed_ssl_certificate.ssl_cert[0].id : null
}

output "ssl_certificate_name" {
  description = "The SSL certificate name"
  value       = var.enable_ssl ? google_compute_managed_ssl_certificate.ssl_cert[0].name : null
}

output "security_policy_id" {
  description = "The security policy ID"
  value       = var.enable_security_policy ? google_compute_security_policy.security_policy[0].id : null
}

output "router_name" {
  description = "The Cloud Router name"
  value       = google_compute_router.router.name
}

output "nat_name" {
  description = "The NAT gateway name"
  value       = google_compute_router_nat.nat.name
}
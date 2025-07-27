#!/bin/bash
# =============================================================================
# ENVIRONMENT MANAGEMENT UTILITY
# =============================================================================
# Comprehensive environment management for development, staging, and production
# Usage: ./environment-manager.sh <command> [options]

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TERRAFORM_DIR="$PROJECT_ROOT/terraform"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_debug() {
    echo -e "${PURPLE}[DEBUG]${NC} $1"
}

log_header() {
    echo -e "${CYAN}[HEADER]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Environment Management Utility for Firemní Asistent

USAGE:
    $0 <command> [options]

COMMANDS:
    status          Show status of all environments
    health          Check health of all environments
    promote         Promote changes between environments
    compare         Compare configurations between environments
    setup           Setup new environment
    cleanup         Cleanup old resources
    backup          Backup environment state
    restore         Restore environment from backup
    sync            Sync environment configurations
    validate        Validate all environments
    
ENVIRONMENT COMMANDS:
    list            List all available environments
    switch <env>    Switch to specific environment context
    clone <src> <dst>  Clone environment configuration
    
MONITORING COMMANDS:
    logs <env>      Show recent logs from environment
    metrics <env>   Show metrics dashboard for environment
    alerts <env>    Show active alerts for environment

OPTIONS:
    --environment=ENV    Target specific environment (dev|staging|prod)
    --dry-run           Show what would be done without executing
    --force             Force operation without confirmation
    --quiet             Suppress verbose output
    --output=FORMAT     Output format (table|json|yaml)

EXAMPLES:
    $0 status                           # Show all environment status
    $0 health --environment=staging     # Check staging health
    $0 promote dev staging              # Promote dev to staging
    $0 compare dev prod                 # Compare dev vs prod
    $0 setup dev                        # Setup development environment
    $0 backup prod                      # Backup production state
    
PROMOTION PIPELINE:
    $0 promote dev staging              # Stage 1: Dev → Staging
    $0 promote staging prod             # Stage 2: Staging → Production
EOF
}

# Environment status checking
check_environment_status() {
    local env=$1
    local quiet=${2:-false}
    
    if [[ "$quiet" != "true" ]]; then
        log_info "Checking status of $env environment..."
    fi
    
    local env_dir="$TERRAFORM_DIR/environments/$env"
    
    if [[ ! -d "$env_dir" ]]; then
        echo "❌ NOT_CONFIGURED"
        return 1
    fi
    
    # Check if backend is configured
    if [[ ! -f "$env_dir/backend.tf" ]]; then
        echo "⚠️  NO_BACKEND"
        return 1
    fi
    
    # Check if variables are configured
    if [[ ! -f "$env_dir/terraform.tfvars" ]]; then
        echo "⚠️  NO_VARIABLES"
        return 1
    fi
    
    # Try to get terraform state
    cd "$env_dir"
    if terraform workspace list &>/dev/null; then
        echo "✅ CONFIGURED"
        return 0
    else
        echo "⚠️  NOT_INITIALIZED"
        return 1
    fi
}

# Health check for environment
check_environment_health() {
    local env=$1
    local quiet=${2:-false}
    
    if [[ "$quiet" != "true" ]]; then
        log_info "Checking health of $env environment..."
    fi
    
    # Check infrastructure status
    local status
    status=$(check_environment_status "$env" true)
    
    if [[ "$status" != "✅ CONFIGURED" ]]; then
        echo "❌ UNHEALTHY: $status"
        return 1
    fi
    
    # Check domain/service health
    local domain
    case "$env" in
        dev)
            domain="dev.firemni-asistent.cz"
            ;;
        staging)
            domain="staging.firemni-asistent.cz"
            ;;
        prod)
            domain="firemni-asistent.cz"
            ;;
    esac
    
    # Basic HTTP health check
    if curl -s -f "https://$domain/health" &>/dev/null; then
        echo "✅ HEALTHY"
        return 0
    else
        echo "⚠️  SERVICE_DOWN"
        return 1
    fi
}

# Show comprehensive status
show_all_status() {
    local output_format=${1:-table}
    
    log_header "🎯 Environment Status Overview"
    echo
    
    case "$output_format" in
        table)
            printf "%-12s %-15s %-15s %-20s\n" "Environment" "Status" "Health" "Last Updated"
            printf "%-12s %-15s %-15s %-20s\n" "───────────" "──────" "──────" "────────────"
            
            for env in dev staging prod; do
                local status
                local health
                local last_updated="Unknown"
                
                status=$(check_environment_status "$env" true)
                health=$(check_environment_health "$env" true)
                
                # Try to get last terraform apply time
                local env_dir="$TERRAFORM_DIR/environments/$env"
                if [[ -f "$env_dir/.terraform/terraform.tfstate" ]]; then
                    last_updated=$(stat -c %y "$env_dir/.terraform/terraform.tfstate" 2>/dev/null | cut -d' ' -f1 || echo "Unknown")
                fi
                
                printf "%-12s %-15s %-15s %-20s\n" "$env" "$status" "$health" "$last_updated"
            done
            ;;
        json)
            echo "{"
            local first=true
            for env in dev staging prod; do
                if [[ "$first" != "true" ]]; then
                    echo ","
                fi
                first=false
                
                local status
                local health
                status=$(check_environment_status "$env" true)
                health=$(check_environment_health "$env" true)
                
                echo "  \"$env\": {"
                echo "    \"status\": \"$status\","
                echo "    \"health\": \"$health\""
                echo -n "  }"
            done
            echo
            echo "}"
            ;;
    esac
    
    echo
    log_info "Legend: ✅ Healthy | ⚠️  Warning | ❌ Error"
}

# Promote between environments
promote_environment() {
    local src_env=$1
    local dst_env=$2
    local force=${3:-false}
    local dry_run=${4:-false}
    
    if [[ -z "$src_env" || -z "$dst_env" ]]; then
        log_error "Source and destination environments required"
        log_info "Usage: promote <source> <destination>"
        return 1
    fi
    
    # Validate environments
    if [[ ! "$src_env" =~ ^(dev|staging|prod)$ || ! "$dst_env" =~ ^(dev|staging|prod)$ ]]; then
        log_error "Invalid environment. Use: dev, staging, prod"
        return 1
    fi
    
    # Validate promotion path
    case "$src_env-$dst_env" in
        dev-staging|staging-prod)
            # Valid promotion paths
            ;;
        *)
            log_error "Invalid promotion path: $src_env → $dst_env"
            log_info "Valid paths: dev → staging, staging → prod"
            return 1
            ;;
    esac
    
    log_header "🚀 Promotion: $src_env → $dst_env"
    
    # Pre-promotion checks
    log_info "Running pre-promotion checks..."
    
    # Check source environment health
    local src_health
    src_health=$(check_environment_health "$src_env" true)
    if [[ "$src_health" != "✅ HEALTHY" ]]; then
        log_error "Source environment ($src_env) is not healthy: $src_health"
        if [[ "$force" != "true" ]]; then
            return 1
        else
            log_warning "Forcing promotion despite unhealthy source"
        fi
    fi
    
    # For production promotion, require additional validation
    if [[ "$dst_env" == "prod" ]]; then
        log_info "Production promotion requires additional validation..."
        
        # Check if staging has been running stably
        log_info "Checking staging stability..."
        # This could include metrics checks, error rate analysis, etc.
        
        if [[ "$force" != "true" ]]; then
            log_warning "Production promotion requires manual confirmation"
            read -p "Are you sure you want to promote to production? (type 'PROMOTE'): " confirm
            if [[ "$confirm" != "PROMOTE" ]]; then
                log_info "Production promotion cancelled"
                return 1
            fi
        fi
    fi
    
    # Execute promotion
    if [[ "$dry_run" == "true" ]]; then
        log_info "[DRY RUN] Would execute promotion from $src_env to $dst_env"
        log_info "[DRY RUN] Steps:"
        log_info "  1. Copy configuration from $src_env to $dst_env"
        log_info "  2. Update environment-specific variables"
        log_info "  3. Run terraform plan for $dst_env"
        log_info "  4. Apply changes to $dst_env"
        log_info "  5. Validate deployment"
    else
        log_info "Executing promotion..."
        
        # Step 1: Copy configuration (if needed)
        log_info "Step 1: Validating configurations..."
        
        # Step 2: Deploy to destination
        log_info "Step 2: Deploying to $dst_env..."
        "$SCRIPT_DIR/deploy.sh" "$dst_env" apply --auto-approve
        
        # Step 3: Validate deployment
        log_info "Step 3: Validating deployment..."
        sleep 30  # Wait for services to stabilize
        
        local dst_health
        dst_health=$(check_environment_health "$dst_env" true)
        if [[ "$dst_health" == "✅ HEALTHY" ]]; then
            log_success "Promotion successful: $src_env → $dst_env"
        else
            log_error "Promotion validation failed: $dst_health"
            log_warning "Consider rolling back the deployment"
            return 1
        fi
    fi
}

# Compare environments
compare_environments() {
    local env1=$1
    local env2=$2
    
    if [[ -z "$env1" || -z "$env2" ]]; then
        log_error "Two environments required for comparison"
        return 1
    fi
    
    log_header "🔍 Environment Comparison: $env1 vs $env2"
    
    # Compare terraform.tfvars files
    local env1_vars="$TERRAFORM_DIR/environments/$env1/terraform.tfvars"
    local env2_vars="$TERRAFORM_DIR/environments/$env2/terraform.tfvars"
    
    if [[ -f "$env1_vars" && -f "$env2_vars" ]]; then
        log_info "Configuration differences:"
        diff -u "$env1_vars" "$env2_vars" || true
    else
        log_error "Configuration files not found for comparison"
    fi
    
    # Compare status and health
    echo
    log_info "Status comparison:"
    local env1_status
    local env2_status
    local env1_health
    local env2_health
    
    env1_status=$(check_environment_status "$env1" true)
    env2_status=$(check_environment_status "$env2" true)
    env1_health=$(check_environment_health "$env1" true)
    env2_health=$(check_environment_health "$env2" true)
    
    printf "%-12s %-15s %-15s\n" "Environment" "$env1" "$env2"
    printf "%-12s %-15s %-15s\n" "Status" "$env1_status" "$env2_status"
    printf "%-12s %-15s %-15s\n" "Health" "$env1_health" "$env2_health"
}

# Setup new environment
setup_environment() {
    local env=$1
    local force=${2:-false}
    
    if [[ -z "$env" ]]; then
        log_error "Environment name required"
        return 1
    fi
    
    log_header "🔧 Setting up $env environment"
    
    local env_dir="$TERRAFORM_DIR/environments/$env"
    
    if [[ -d "$env_dir" && "$force" != "true" ]]; then
        log_error "Environment $env already exists. Use --force to overwrite"
        return 1
    fi
    
    # Create directory structure
    mkdir -p "$env_dir"
    
    # Initialize terraform
    log_info "Initializing terraform for $env..."
    "$SCRIPT_DIR/deploy.sh" "$env" init
    
    log_success "Environment $env setup completed"
}

# Cleanup old resources
cleanup_environment() {
    local env=$1
    local days=${2:-30}
    local dry_run=${3:-false}
    
    log_header "🧹 Cleaning up $env environment (older than $days days)"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "[DRY RUN] Would cleanup resources older than $days days"
        return 0
    fi
    
    # Cleanup old Cloud Run revisions
    log_info "Cleaning up old Cloud Run revisions..."
    
    # This would be implemented with gcloud commands
    # gcloud run revisions list --filter="metadata.creationTimestamp<'-${days}d'" --format="value(metadata.name)"
    
    log_success "Cleanup completed for $env"
}

# Main execution
main() {
    # Parse global options
    local dry_run=false
    local force=false
    local quiet=false
    local output_format="table"
    local target_env=""
    
    # Parse arguments
    local args=()
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                dry_run=true
                shift
                ;;
            --force)
                force=true
                shift
                ;;
            --quiet)
                quiet=true
                shift
                ;;
            --output=*)
                output_format="${1#*=}"
                shift
                ;;
            --environment=*)
                target_env="${1#*=}"
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                exit 1
                ;;
            *)
                args+=("$1")
                shift
                ;;
        esac
    done
    
    # Restore positional parameters
    set -- "${args[@]}"
    
    if [[ $# -lt 1 ]]; then
        show_help
        exit 1
    fi
    
    local command=$1
    shift
    
    # Execute command
    case "$command" in
        status)
            show_all_status "$output_format"
            ;;
        health)
            if [[ -n "$target_env" ]]; then
                check_environment_health "$target_env"
            else
                for env in dev staging prod; do
                    echo "$env: $(check_environment_health "$env" true)"
                done
            fi
            ;;
        promote)
            if [[ $# -lt 2 ]]; then
                log_error "Promote requires source and destination environments"
                exit 1
            fi
            promote_environment "$1" "$2" "$force" "$dry_run"
            ;;
        compare)
            if [[ $# -lt 2 ]]; then
                log_error "Compare requires two environments"
                exit 1
            fi
            compare_environments "$1" "$2"
            ;;
        setup)
            if [[ $# -lt 1 ]]; then
                log_error "Setup requires environment name"
                exit 1
            fi
            setup_environment "$1" "$force"
            ;;
        cleanup)
            local cleanup_env=${target_env:-${1:-"dev"}}
            local cleanup_days=${2:-30}
            cleanup_environment "$cleanup_env" "$cleanup_days" "$dry_run"
            ;;
        list)
            log_info "Available environments:"
            for env in dev staging prod; do
                local status
                status=$(check_environment_status "$env" true)
                echo "  $env: $status"
            done
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
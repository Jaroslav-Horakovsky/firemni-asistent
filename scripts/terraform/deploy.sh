#!/bin/bash
# =============================================================================
# TERRAFORM ENVIRONMENT DEPLOYMENT SCRIPT
# =============================================================================
# Simplified deployment script for managing multi-environment infrastructure
# Usage: ./deploy.sh <environment> <action> [options]

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

# Help function
show_help() {
    cat << EOF
Terraform Multi-Environment Deployment Script

USAGE:
    $0 <environment> <action> [options]

ENVIRONMENTS:
    dev         Development environment
    staging     Staging environment  
    prod        Production environment

ACTIONS:
    plan        Show what changes will be made
    apply       Apply changes to infrastructure
    destroy     Destroy infrastructure (WARNING: Irreversible)
    init        Initialize terraform backend
    validate    Validate terraform configuration
    output      Show terraform outputs
    workspace   Manage terraform workspaces

OPTIONS:
    --auto-approve    Skip interactive approval for apply/destroy
    --var-file=FILE   Use specific tfvars file
    --target=RESOURCE Target specific resource
    --dry-run         Show commands without executing (except for plan)

EXAMPLES:
    $0 dev plan                    # Plan development deployment
    $0 staging apply               # Deploy to staging
    $0 prod apply --auto-approve   # Deploy to production without prompts
    $0 dev destroy --target=module.monitoring
    
WORKSPACE MANAGEMENT:
    $0 dev workspace list          # List all workspaces
    $0 dev workspace select        # Select dev workspace
    $0 dev workspace new           # Create new workspace
    $0 dev workspace delete        # Delete workspace
EOF
}

# Validation functions
validate_environment() {
    case "$1" in
        dev|staging|prod)
            return 0
            ;;
        *)
            log_error "Invalid environment: $1"
            log_info "Valid environments: dev, staging, prod"
            return 1
            ;;
    esac
}

validate_action() {
    case "$1" in
        plan|apply|destroy|init|validate|output|workspace)
            return 0
            ;;
        *)
            log_error "Invalid action: $1"
            log_info "Valid actions: plan, apply, destroy, init, validate, output, workspace"
            return 1
            ;;
    esac
}

# Environment setup
setup_environment() {
    local env=$1
    
    # Set GCP project based on environment
    case "$env" in
        dev)
            export TF_VAR_project_id="${GCP_PROJECT_ID_DEV:-firemni-asistent-dev}"
            ;;
        staging)
            export TF_VAR_project_id="${GCP_PROJECT_ID_STAGING:-firemni-asistent-staging}"
            ;;
        prod)
            export TF_VAR_project_id="${GCP_PROJECT_ID_PROD:-firemni-asistent-prod}"
            ;;
    esac
    
    # Set working directory
    export TF_WORKING_DIR="$TERRAFORM_DIR/environments/$env"
    
    # Validate directory exists
    if [[ ! -d "$TF_WORKING_DIR" ]]; then
        log_error "Environment directory not found: $TF_WORKING_DIR"
        return 1
    fi
    
    log_info "Environment: $env"
    log_info "Project ID: $TF_VAR_project_id"
    log_info "Working Directory: $TF_WORKING_DIR"
    
    # Change to terraform directory
    cd "$TF_WORKING_DIR"
}

# Terraform workspace management
manage_workspace() {
    local env=$1
    local workspace_action=$2
    
    case "$workspace_action" in
        list)
            log_info "Listing terraform workspaces..."
            terraform workspace list
            ;;
        select)
            log_info "Selecting workspace: $env"
            terraform workspace select "$env" || terraform workspace new "$env"
            ;;
        new)
            log_info "Creating new workspace: $env"
            terraform workspace new "$env"
            ;;
        delete)
            log_warning "This will delete workspace: $env"
            read -p "Are you sure? (y/N): " confirm
            if [[ $confirm =~ ^[Yy]$ ]]; then
                terraform workspace delete "$env"
                log_success "Workspace $env deleted"
            else
                log_info "Workspace deletion cancelled"
            fi
            ;;
        *)
            log_error "Invalid workspace action: $workspace_action"
            log_info "Valid workspace actions: list, select, new, delete"
            return 1
            ;;
    esac
}

# Terraform operations
terraform_init() {
    log_info "Initializing terraform..."
    terraform init
    
    # Select or create workspace
    manage_workspace "$ENVIRONMENT" "select"
}

terraform_validate() {
    log_info "Validating terraform configuration..."
    terraform validate
    log_success "Terraform configuration is valid"
}

terraform_plan() {
    local var_file="terraform.tfvars"
    local target=""
    
    # Parse additional options
    for arg in "${ADDITIONAL_ARGS[@]}"; do
        case "$arg" in
            --var-file=*)
                var_file="${arg#*=}"
                ;;
            --target=*)
                target="-target=${arg#*=}"
                ;;
        esac
    done
    
    log_info "Planning terraform changes..."
    log_info "Using var file: $var_file"
    
    if [[ ! -f "$var_file" ]]; then
        log_error "Variable file not found: $var_file"
        return 1
    fi
    
    terraform plan -var-file="$var_file" $target -out=tfplan
    log_success "Terraform plan completed"
}

terraform_apply() {
    local auto_approve=""
    local var_file="terraform.tfvars"
    local target=""
    
    # Parse additional options
    for arg in "${ADDITIONAL_ARGS[@]}"; do
        case "$arg" in
            --auto-approve)
                auto_approve="-auto-approve"
                ;;
            --var-file=*)
                var_file="${arg#*=}"
                ;;
            --target=*)
                target="-target=${arg#*=}"
                ;;
        esac
    done
    
    # Environment-specific safety checks
    if [[ "$ENVIRONMENT" == "prod" && -z "$auto_approve" ]]; then
        log_warning "You are about to apply changes to PRODUCTION environment!"
        read -p "Are you absolutely sure? Type 'DEPLOY' to continue: " confirm
        if [[ "$confirm" != "DEPLOY" ]]; then
            log_info "Production deployment cancelled"
            return 1
        fi
    fi
    
    log_info "Applying terraform changes..."
    log_info "Using var file: $var_file"
    
    if [[ -f "tfplan" ]]; then
        # Use existing plan
        terraform apply $auto_approve tfplan
    else
        # Plan and apply in one step
        terraform apply -var-file="$var_file" $target $auto_approve
    fi
    
    log_success "Terraform apply completed"
}

terraform_destroy() {
    local auto_approve=""
    local var_file="terraform.tfvars"
    local target=""
    
    # Parse additional options
    for arg in "${ADDITIONAL_ARGS[@]}"; do
        case "$arg" in
            --auto-approve)
                auto_approve="-auto-approve"
                ;;
            --var-file=*)
                var_file="${arg#*=}"
                ;;
            --target=*)
                target="-target=${arg#*=}"
                ;;
        esac
    done
    
    # Safety check for production
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        log_error "Production destruction is disabled for safety"
        log_info "If you need to destroy production resources, do it manually"
        return 1
    fi
    
    log_warning "You are about to DESTROY infrastructure in $ENVIRONMENT environment!"
    if [[ -z "$auto_approve" ]]; then
        read -p "Are you sure? Type 'DESTROY' to continue: " confirm
        if [[ "$confirm" != "DESTROY" ]]; then
            log_info "Destruction cancelled"
            return 1
        fi
    fi
    
    log_info "Destroying terraform infrastructure..."
    terraform destroy -var-file="$var_file" $target $auto_approve
    log_success "Terraform destroy completed"
}

terraform_output() {
    log_info "Showing terraform outputs..."
    terraform output
}

# Main execution
main() {
    # Parse arguments
    if [[ $# -lt 2 ]]; then
        show_help
        exit 1
    fi
    
    ENVIRONMENT=$1
    ACTION=$2
    shift 2
    ADDITIONAL_ARGS=("$@")
    
    # Check for dry-run mode
    DRY_RUN=false
    for arg in "${ADDITIONAL_ARGS[@]}"; do
        if [[ "$arg" == "--dry-run" ]]; then
            DRY_RUN=true
            break
        fi
    done
    
    # Show help if requested
    if [[ "$ENVIRONMENT" == "-h" || "$ENVIRONMENT" == "--help" ]]; then
        show_help
        exit 0
    fi
    
    # Validate inputs
    validate_environment "$ENVIRONMENT" || exit 1
    validate_action "$ACTION" || exit 1
    
    # Setup environment
    setup_environment "$ENVIRONMENT" || exit 1
    
    # Check for required tools
    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed or not in PATH"
        exit 1
    fi
    
    # Execute action
    case "$ACTION" in
        init)
            if [[ "$DRY_RUN" == "true" ]]; then
                log_info "[DRY RUN] Would execute: terraform init"
            else
                terraform_init
            fi
            ;;
        validate)
            if [[ "$DRY_RUN" == "true" ]]; then
                log_info "[DRY RUN] Would execute: terraform validate"
            else
                terraform_validate
            fi
            ;;
        plan)
            # Always execute plan, even in dry-run mode
            terraform_plan
            ;;
        apply)
            if [[ "$DRY_RUN" == "true" ]]; then
                log_info "[DRY RUN] Would execute: terraform apply"
                terraform_plan  # Show plan in dry-run mode
            else
                terraform_apply
            fi
            ;;
        destroy)
            if [[ "$DRY_RUN" == "true" ]]; then
                log_info "[DRY RUN] Would execute: terraform destroy"
            else
                terraform_destroy
            fi
            ;;
        output)
            terraform_output
            ;;
        workspace)
            if [[ ${#ADDITIONAL_ARGS[@]} -eq 0 ]]; then
                log_error "Workspace action required"
                log_info "Available actions: list, select, new, delete"
                exit 1
            fi
            manage_workspace "$ENVIRONMENT" "${ADDITIONAL_ARGS[0]}"
            ;;
        *)
            log_error "Unknown action: $ACTION"
            show_help
            exit 1
            ;;
    esac
    
    log_success "Operation completed successfully"
}

# Run main function
main "$@"
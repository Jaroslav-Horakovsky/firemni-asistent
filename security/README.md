# Security Testing Suite

Comprehensive security testing implementation for Firemní Asistent using multiple scanning approaches:

- **SAST (Static Application Security Testing)**: CodeQL, Semgrep
- **DAST (Dynamic Application Security Testing)**: OWASP ZAP
- **Dependency Scanning**: npm audit, Snyk
- **Baseline Tracking**: Vulnerability trend analysis
- **Automated Reporting**: GitHub Actions integration

## Quick Start

```bash
# Install dependencies
npm install

# Create security baseline (first run)
npm run baseline:create

# Compare against baseline
npm run baseline:compare

# Generate security report
npm run report:generate
```

## Directory Structure

```
security/
├── package.json                 # Dependencies and scripts
├── README.md                   # This file
├── config/                     # Security scanning configurations
│   ├── codeql-config.yml      # CodeQL configuration
│   ├── semgrep-rules.yml      # Semgrep custom rules
│   ├── zap-config.json        # OWASP ZAP configuration
│   └── snyk-config.json       # Snyk configuration
├── scripts/                    # Analysis and reporting scripts
│   ├── create-baseline.js     # Create security baseline
│   ├── compare-baseline.js    # Compare against baseline
│   ├── generate-report.js     # Generate security reports
│   ├── consolidate-results.js # Consolidate scan results
│   ├── analyze-vulnerabilities.js # Vulnerability analysis
│   └── validate-security.js   # Security validation
├── results/                    # Security scan results
│   ├── sast/                  # Static analysis results
│   ├── dependencies/          # Dependency scan results
│   └── dast/                  # Dynamic analysis results
├── baselines/                  # Security baselines
│   ├── baseline-dev-*.json    # Development environment baselines
│   ├── baseline-staging-*.json # Staging environment baselines
│   └── latest-*.json          # Latest baseline symlinks
└── reports/                    # Generated reports
    ├── security-report.md     # Comprehensive security report
    ├── vulnerability-summary.json # Vulnerability summary
    └── baseline-comparison.json # Baseline comparison results
```

## GitHub Actions Integration

Security scanning is automatically triggered by:

1. **Staging Deployments**: Full security scan after deployment
2. **Manual Dispatch**: On-demand security validation
3. **Pull Requests**: Security validation for code changes

### Workflow Configuration

The security scanning pipeline (`.github/workflows/security-scan.yml`) supports:

- **Multiple Scan Types**: quick, full, sast-only, dast-only, dependencies-only
- **Environment Targeting**: dev, staging, prod
- **Severity Thresholds**: low, medium, high, critical
- **Baseline Management**: Create and compare security baselines
- **Automated Reporting**: GitHub issues and PR comments

### Manual Trigger

```bash
# Trigger security scan via GitHub CLI
gh workflow run security-scan.yml \
  --field environment=staging \
  --field scan_type=full \
  --field severity_threshold=medium \
  --field create_baseline=false
```

## Security Scan Types

### SAST (Static Application Security Testing)

- **CodeQL**: GitHub's semantic code analysis
- **Semgrep**: Fast, customizable static analysis

### DAST (Dynamic Application Security Testing)

- **OWASP ZAP**: Comprehensive web application security scanner
- **Spider & Active Scan**: Complete application crawling and testing

### Dependency Scanning

- **npm audit**: Built-in Node.js vulnerability scanner
- **Snyk**: Advanced dependency and code vulnerability detection

## Security Baselines

Security baselines track vulnerability trends over time:

```javascript
{
  "timestamp": "2024-01-15T10:30:00Z",
  "environment": "staging",
  "scanType": "full",
  "severityThreshold": "medium",
  "summary": {
    "totalVulnerabilities": 12,
    "bySeverity": {
      "critical": 0,
      "high": 2,
      "medium": 5,
      "low": 5
    },
    "byType": {
      "sast": 3,
      "dependency": 7,
      "dast": 2
    }
  }
}
```

## Configuration Files

### CodeQL Configuration (config/codeql-config.yml)

Custom CodeQL analysis configuration with security-focused queries.

### Semgrep Rules (config/semgrep-rules.yml)

Project-specific Semgrep rules for JavaScript/TypeScript security patterns.

### OWASP ZAP Configuration (config/zap-config.json)

ZAP scan policies and authentication configuration.

### Snyk Configuration (config/snyk-config.json)

Snyk scan settings and ignore policies.

## Security Scripts

### Baseline Management

- `create-baseline.js`: Creates new security baseline from current scan
- `compare-baseline.js`: Compares current results against baseline

### Analysis & Reporting

- `consolidate-results.js`: Merges results from all security scans
- `analyze-vulnerabilities.js`: Analyzes vulnerability patterns and trends
- `generate-report.js`: Creates comprehensive security reports
- `validate-security.js`: Validates security posture against thresholds

## Environment Variables

Required for security scanning:

```bash
# Snyk authentication
SNYK_TOKEN=your_snyk_token

# GitHub token for CodeQL
GITHUB_TOKEN=your_github_token

# Target application URLs
DEV_BASE_URL=https://dev.firemni-asistent.cz
STAGING_BASE_URL=https://staging.firemni-asistent.cz
PROD_BASE_URL=https://firemni-asistent.cz
```

## Security Thresholds

Default vulnerability thresholds:

- **Critical**: Block deployment, create immediate issue
- **High**: Require review, create tracking issue
- **Medium**: Track in reports, no blocking
- **Low**: Track in reports, no blocking

## Best Practices

1. **Regular Scanning**: Run full security scans on every staging deployment
2. **Baseline Management**: Update baselines monthly or after major changes
3. **Threshold Tuning**: Adjust severity thresholds based on risk tolerance
4. **Remediation Tracking**: Use GitHub issues for vulnerability tracking
5. **Continuous Monitoring**: Monitor trends, not just absolute numbers

## Troubleshooting

### Common Issues

1. **CodeQL Analysis Fails**: Ensure proper Node.js build configuration
2. **Semgrep Rules Issues**: Check custom rule syntax
3. **ZAP Scan Timeout**: Increase timeout for large applications
4. **Snyk Authentication**: Verify SNYK_TOKEN is valid
5. **Baseline Comparison**: Ensure baseline exists for environment

### Debug Commands

```bash
# Check security scan results
ls -la results/

# Validate configurations
npm run validate

# Test individual scanners
npm run sast:semgrep
npm run deps:npm-audit
```

## Security Compliance

This security testing suite supports compliance with:

- **OWASP Top 10**: Comprehensive web application security testing
- **NIST Cybersecurity Framework**: Continuous security monitoring
- **SOC 2**: Security control validation
- **PCI DSS**: Payment application security (if applicable)

## Contributing

When adding new security tests or configurations:

1. Update relevant configuration files
2. Add test coverage for new functionality  
3. Update documentation
4. Test in staging environment first
5. Update security baselines as needed
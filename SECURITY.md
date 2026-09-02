# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported |
|---------|-----------|
| `main` (latest release) | ✅ |
| `develop` (next release) | ✅ |
| Older releases | ❌ |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Email**: **security@sih26162.example.com**

Include the following information:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)
- Your contact information

### Response Timeline

| Severity | Acknowledgment | Fix Target |
|----------|----------------|------------|
| Critical (RCE, auth bypass, data breach) | 24 hours | 7 days |
| High (SQLi, XSS, privilege escalation) | 48 hours | 14 days |
| Medium (info disclosure, DoS) | 72 hours | 30 days |
| Low (minor issues) | 1 week | Next release |

## Security Practices

### Secrets Management
- **Never commit secrets** to Git (API keys, passwords, tokens, private keys)
- Use `.env` files (gitignored) for local development
- Use `.env.example` as template
- Production: Use secret managers (AWS Secrets Manager, HashiCorp Vault, GitHub Environments)
- Pre-commit hooks scan for secrets (`detect-secrets`, `truffleHog`)

### Dependencies
- Regular dependency updates via `dependabot` / `renovate`
- `pip-audit` / `npm audit` in CI
- Pin versions in `pyproject.toml` / `package.json`
- Review transitive dependencies

### Code Security
- **Input validation**: Pydantic models on all API inputs
- **SQL injection**: SQLAlchemy ORM + parameterized queries only
- **XSS**: React auto-escapes, `dangerouslySetInnerHTML` avoided
- **CORS**: Restricted to known frontend origin
- **Rate limiting**: 100 req/min default, configurable
- **Authentication**: JWT with short expiry (future)
- **Authorization**: Role-based access control (future)

### Infrastructure
- **Database**: PostgreSQL with SSL, least-privilege users
- **Redis**: Password protected, TLS in production
- **Containers**: Non-root user, read-only filesystem, minimal base images
- **Network**: Private subnets, security groups, WAF (production)
- **Logging**: No sensitive data in logs, structured JSON

### Data Protection
- **PII**: Minimize collection, encrypt at rest
- **Satellite data**: Public domain (NASA FIRMS, OSM)
- **Model artifacts**: No training data in model files
- **Backups**: Encrypted, access-controlled, tested restore

## Vulnerability Disclosure Process

1. **Report received** → Acknowledgment within SLA
2. **Triage** → Severity assessment, reproduction
3. **Fix development** → Private branch, tests
4. **Coordinated disclosure** → Fix released, advisory published
5. **Credit** → Reporter acknowledged (if desired)

## Security Contacts

- **Security Team**: security@sih26162.example.com
- **Tech Lead**: techlead@sih26162.example.com
- **Emergency**: +91-XXXXXXXXXX (team lead phone)

## Bug Bounty

Not currently offered. Responsible disclosure acknowledged in Hall of Fame.

---

*Last Updated: 2024-01-15 | For SIH26162 Team Internal Use*
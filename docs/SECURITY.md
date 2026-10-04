# Security Policy

## Supported Versions

Blazor-Server is pre-1.0 and releases a new `v0.0.x` version for every merged pull request.
Only the latest release is supported: security fixes land on `main` and ship in the next release, with no backports.

| Version            | Supported          |
| ------------------ | ------------------ |
| Latest `v0.0.x`    | :white_check_mark: |
| Any older release  | :x:                |

## Security Measures

Blazor-Server is a template for a server-rendered Blazor Web App; so far it holds the shared domain types (`src/Domain`).
The repository itself is protected as follows:

- **Secrets stay out of source control.** `.env` files are git-ignored at any depth, and the Claude Code settings deny
  reading or editing them. Local secrets belong in user secrets or `.env`.
- **CodeQL** analyzes the C# code and the GitHub Actions workflows whenever a pull request or push to `main` changes them.
- **Workflow hardening.** Actions are pinned to commit SHAs, and `zizmor` and `actionlint` check every workflow change.
- **Dependabot** proposes dependency updates after a seven-day cooldown, so a compromised release is usually caught
  upstream first.
- **Reviewed merges.** A pull request merges only after its checks pass and its review threads are resolved.

## Reporting a Vulnerability

If you discover a security vulnerability in Blazor-Server, please report it responsibly:

### How to Report

**Email:** <matthew.paulosky@outlook.com>  
**Subject:** [SECURITY] Blazor-Server Vulnerability Report

**Please do NOT open a public GitHub issue for security vulnerabilities.**

### What to Include

When reporting a security vulnerability, please include:

1. **Description** - Clear description of the vulnerability
2. **Impact** - Potential security impact and severity
3. **Steps to Reproduce** - Detailed steps to reproduce the vulnerability
4. **Affected Versions** - Which versions are affected
5. **Suggested Fix** - If you have ideas for mitigation (optional)
6. **Your Contact Info** - How we can reach you for follow-up

### Response Timeline

- **Initial Response:** Within 48 hours of report submission
- **Status Update:** Within 7 days with assessment and timeline
- **Fix Timeline:**
  - Critical vulnerabilities: Within 7 days
  - High severity: Within 14 days
  - Medium/Low severity: Within 30 days

### Disclosure Policy

- We will work with you to understand and validate the vulnerability
- We will develop and test a fix before public disclosure
- We will credit you in the security advisory (unless you prefer anonymity)
- We request that you do not publicly disclose the vulnerability until we have released a fix

### Security Advisories

Security updates will be published:

- In the [GitHub Security Advisories](https://github.com/mpaulosky/Blazor-Server/security/advisories)
- In the project [CHANGELOG.md](../CHANGELOG.md) (if one exists)
- In release notes for security-related releases

## Security Best Practices for Contributors

When contributing to Blazor-Server, please follow these security guidelines:

### Code Review

- All code changes require review before merging
- Security-sensitive changes require additional scrutiny
- Never commit secrets, API keys, or passwords

### Testing

- Add security-focused tests for authorization checks
- Test boundary conditions and edge cases
- Verify user isolation in integration tests

### Dependencies

- Keep NuGet packages up to date
- Review dependency security advisories
- Use `dotnet list package --vulnerable` to check for known vulnerabilities

### Secrets Management

- Use **User Secrets** for local development (`dotnet user-secrets`)
- Use **Environment Variables** for production
- Never commit `appsettings.Production.json` with secrets
- Add sensitive files to `.gitignore`

### Data Validation

- Validate all user input in CQRS handlers
- Use parameterized queries (Entity Framework Core does this automatically)
- Sanitize data before rendering in Blazor components (Blazor does this automatically)

## Known Security Considerations

### Current Limitations

- **OpenAI API calls** - Notes content is sent to OpenAI for AI features (embeddings, summaries, tags)
- **Local development** - Uses SQL Server Express with Trusted Connection
- **No rate limiting** - Consider implementing rate limiting for production
- **No audit logging** - User actions are not currently logged

### Recommendations for Production

1. **Use HTTPS** - Enable HTTPS and HSTS
2. **Secure connection strings** - Use Azure Key Vault or similar
3. **Enable logging** - Add security event logging
4. **Rate limiting** - Implement API rate limiting
5. **Regular updates** - Keep .NET and dependencies updated
6. **Security headers** - Add security headers (CSP, X-Frame-Options, etc.)
7. **Monitor dependencies** - Use GitHub Dependabot for security alerts

## Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [ASP.NET Core Security Best Practices](https://learn.microsoft.com/aspnet/core/security/)
- [Entity Framework Core Security](https://learn.microsoft.com/ef/core/miscellaneous/security)
- [Blazor Security](https://learn.microsoft.com/aspnet/core/blazor/security/)

---

Thank you for helping keep Blazor-Server secure!

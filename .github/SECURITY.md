# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.3.x   | Yes                |
| < 0.3   | No                 |

## Reporting a Vulnerability

We take the security of ToatCloud Terminal seriously. If you believe you have
found a security vulnerability in any part of this project, please report it
responsibly.

**Do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to zack.yt.7085@gmail.com with the subject
line "SECURITY: ToatCloud Terminal".

Please include as much of the following information as possible:

- Type of vulnerability (e.g. XSS, SSRF, information disclosure)
- Full paths of source file(s) related to the vulnerability
- The location of the affected code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability, including how an attacker might exploit it

### What to expect

- We will acknowledge your email within 3 business days.
- We will provide a more detailed response within 7 business days indicating
  the next steps.
- We will keep you informed of the progress towards a fix and full
  announcement.
- We will credit you in the security advisory unless you prefer to remain
  anonymous.

## Security Considerations for Users

ToatCloud Terminal runs code inside GitHub Actions runners. Please keep the
following in mind:

1. **Ephemeral runners**: GitHub Actions runners are ephemeral and shared. Do
   not store secrets, credentials, or sensitive data on a VM.
2. **Tunnel URLs**: The tunnel URL is the only protection. Anyone with the URL
   can access the shell (or desktop). Use the password feature (`-share`) to
   add HTTP basic auth.
3. **PAT scopes**: The Personal Access Token needs only `repo` and `workflow`
   scopes. Do not use a token with broader permissions.
4. **Public repos**: If your repo is public, the Actions logs (including
   credentials) are visible to anyone.
5. **Resource limits**: Set CPU, memory, and disk limits to prevent abuse.
6. **WebSocket protocol**: The ttyd WebSocket protocol is unencrypted inside
   the tunnel. The cloudflared tunnel provides TLS termination at the edge.

## Security Hardening Recommendations

For self-hosted deployments:

- Use a private GitHub repo for the backend workflows
- Restrict who can trigger workflow_dispatch events
- Use fine-grained PATs with minimal scopes
- Enable branch protection rules
- Monitor Actions usage for abuse
- Set up rate limiting on the site's API proxy (if self-hosted)

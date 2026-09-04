# Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability in FahOS, please do not open a public issue. Instead, report it privately to the repository maintainer.

---

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

---

## Security Architecture Highlights

- **PowerShell Parameter Sanitization**: All shell arguments are escaped using strict single-quote literal formatting (`sanitizePowerShellArg`).
- **Destructive Action Protection**: Deletions are sent to the Windows Recycle Bin using Microsoft VisualBasic FileIO APIs. Direct irreversible deletions require confirmation.
- **Content Security Policy (CSP)**: Applied to all Electron browser windows.
- **Localhost Microservice Isolation**: CORS regex restricted to local loopback addresses.

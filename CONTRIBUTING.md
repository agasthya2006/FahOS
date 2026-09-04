# Contributing to FahOS

Thank you for your interest in contributing to FahOS! This document outlines guidelines and development workflows.

---

## Code of Conduct

Be respectful, constructive, and maintain high standards of code hygiene and security.

---

## Development Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your `.env` file with test keys.
4. Run verification tests:
   ```bash
   npm test
   ```
5. Start in development mode:
   ```bash
   npm run dev
   ```

---

## Guidelines

- **Security First**: All OS command arguments must be sanitized using `sanitizePowerShellArg()`. Never interpolate unsanitized user strings into shell executions.
- **Local-First**: Do not introduce mandatory cloud services where native local capabilities suffice.
- **Preserve Fast-Paths**: Fast-path commands should resolve with 0ms LLM latency whenever deterministic regex matching is possible.
- **Pull Requests**: Ensure all syntax checks pass before submitting a PR.

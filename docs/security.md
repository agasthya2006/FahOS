# FahOS — Security Architecture & Threat Model

FahOS operates with deep access to the Windows operating system. This document specifies the security controls and validation boundaries implemented to ensure safe and predictable execution.

---

## 1. Threat Model & Boundaries

```
[ User Input (Text/Voice/Snip) ]
             │
             ▼
[ Input Sanitization (sanitize.js) ]
             │
             ▼
[ Deterministic Router (router.js) ] ──► [ Safe Action Dispatch ]
             │
             ▼
[ LLM Generation (Featherless / Gemini) ]
             │
             ▼
[ Output Validation & Destructive Guard ]
             │
             ▼
[ Execution Engine (systemActions.js) ]
             │
             ▼
[ Windows OS / PowerShell (Bypasses prevented) ]
```

---

## 2. Command Injection Prevention

In Windows PowerShell, string interpolation using double quotes (`"..."`) expands variables (`$env:VAR`), subexpressions (`$(command)`), and backticks (`` ` ``).

FahOS uses strict single-quote escaping:
1. All dynamic arguments passed into PowerShell commands are sanitized through `sanitizePowerShellArg()` in `src/core/sanitize.js`.
2. Inside single-quoted strings (`'...'`), PowerShell treats all characters literally.
3. Embedded single quotes are escaped by doubling them (`' -> ''`).
4. Null bytes and carriage returns are stripped.

```javascript
// src/core/sanitize.js
function sanitizePowerShellArg(input) {
  const cleaned = String(input || '').replace(/[\0\r]/g, '');
  return `'${cleaned.replace(/'/g, "''")}'`;
}
```

---

## 3. Destructive Command Guardrails

1. **Recycle Bin Deletion**: All file deletions use Microsoft VisualBasic FileIO APIs (`SendToRecycleBin`) rather than irreversible disk removals (`rmdir` or `Remove-Item`).
2. **Directory Traversal Protection**: Filenames are sanitized via `sanitizeFileName()` to strip path separators (`/`, `\`), null bytes, and Windows reserved characters (`<>:"/\\|?*`).
3. **Execution Guard on AI Output**: AI-generated code blocks cannot invoke format, partition, or recursive permanent deletion commands. Destructive patterns are detected and blocked automatically:
   `/\b(?:format|diskpart|rmdir\s+\/[sS]|Remove-Item\s+.*-(?:Recurse|Force)|Drop-Database|del\s+\/[fF]\s+\/[sS])\b/i`

---

## 4. Content Security Policy (CSP)

Every Electron HTML window applies a strict Content Security Policy meta header:
- Scripts are restricted to `'self'` (no remote scripts or eval).
- Styles are restricted to `'self' 'unsafe-inline'` for theme transitions.
- Images allow `'self' data: https:` (for screen captures and remote icons).
- Media allows `'self' blob:` (for AudioContext recording).
- Network connections are restricted to `'self' http://127.0.0.1:* http://localhost:*`.

---

## 5. Microservice Network Boundary

The Python browser service at `127.0.0.1:8484` enforces CORS origin validation matching:
```python
allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
```
External web origins cannot send cross-site requests to control the local browser service.

# Changelog

All notable changes to FahOS will be documented in this file.

## [1.1.0] - 2026-09-05

### Security & Hardening
- **PowerShell Sanitization**: Added `src/core/sanitize.js` with `sanitizePowerShellArg` and `sanitizeFileName` to prevent shell injection and path traversal attacks.
- **XSS Prevention**: Enhanced `escapeHTML` and sanitized error card rendering in `app.js`.
- **Content Security Policy**: Added strict CSP meta tags to `index.html`, `snip.html`, and `agentBrowser.html`.
- **CORS Hardening**: Restricted Python microservice CORS in `main.py` from wildcard `*` to loopback origins `127.0.0.1` and `localhost`.
- **Destructive Command Guard**: Added automatic detection and blocking of destructive disk commands from LLM outputs.

### Architecture & Engine
- **System Actions Consolidation**: Unified disparate system action implementations into `src/main/features/system/systemActions.js` as single source of truth.
- **Fastpath Error Handling**: Fixed missing return paths on file/folder creation and deletion.
- **Memory Optimization**: Added bounded task store pruning in `task_manager.py` to prevent memory leaks.
- **Design Tokens**: Linked shared `theme.css` into main `styles.css`.

### Documentation
- Completely revamped `README.md` with complete architecture diagrams and feature inventory.
- Created `docs/` technical documentation directory covering architecture, features, workflows, installation, security, and scaling.

---

## [1.0.0] - Initial Release
- Floating glassmorphism HUD overlay.
- Featherless AI multi-model reasoning and router.
- Google Gemini multimodal vision sensor and screen snipper.
- Groq Whisper and Gemini speech-to-text pipeline.
- Autonomous Playwright web browser microservice with 94% viewport.
- Local contacts directory with WhatsApp and Gmail deep links.

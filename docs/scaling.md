# FahOS — Scalability Analysis & Architecture Roadmap

This document outlines the scalability characteristics of the FahOS architecture, identifies engineering boundaries, and defines a realistic development roadmap.

---

## 1. Architectural Scalability Analysis

### 1.1. Code Scalability (Modular Capability Extensions)
- **Current State**: System actions are consolidated into `src/main/features/system/systemActions.js` and registered with the intent router. Adding a new capability requires a regex pattern in `router.js` and an action function in `systemActions.js`.
- **Target Scale**: Introduce a pluggable capability registry pattern:
  ```javascript
  // Future Capability Interface
  interface Capability {
    id: string;
    patterns: RegExp[];
    tier: 'SAFE' | 'CONFIRM' | 'DANGEROUS';
    execute(context: ExecutionContext): Promise<ActionResult>;
  }
  ```

### 1.2. AI Scalability (Provider Abstraction)
- **Current State**: Model routing is split between Featherless (text/code) and Google Gemini (vision/web).
- **Target Scale**: Unified provider interface supporting OpenAI-compatible local runtimes (Ollama, vLLM, LMStudio), Anthropic, and Google GenAI with automated fallback.

### 1.3. Execution & Task Scalability
- **Current State**: Single task concurrency in the Python browser service; Node.js handles single-threaded async event loops.
- **Target Scale**: Multi-step task graph execution with step-level rollback, checkpointing, and background queueing.

### 1.4. Context & Memory Scalability
- **Current State**: History stored in localStorage (max 100 items).
- **Target Scale**: Local SQLite / vector store (e.g. sqlite-vss) for semantic search over past conversations, snips, and notes.

---

## 2. Realistic Development Roadmap

```
Current Architecture (V2.0)
         │
         ▼
[Stage 1: Modularization & Hardening] (Immediate)
  • Pluggable capability registration
  • Complete streaming token support
  • Multi-monitor DPI calibration for Snipper
         │
         ▼
[Stage 2: Advanced Autonomous Agent]
  • Multi-tab browser session management
  • Semantic desktop search (local files & documents via SQLite vector embeddings)
  • Dynamic permission confirmation modal in HUD
         │
         ▼
[Stage 3: Cross-Platform Extension]
  • Abstract OS automation layer into Windows (PowerShell), macOS (AppleScript), and Linux (bash/dbus)
  • Headless daemon mode with Web UI
```

---

## 3. Status Classification of Scaling Initiatives

| Initiative | Current Status | Next Engineering Priority |
|------------|----------------|---------------------------|
| Consolidated System Actions | `IMPLEMENTED` | Add capability manifest schema |
| Security Sanitization & CSP | `IMPLEMENTED` | Add runtime command auditing log |
| Intent Fast-Paths (0ms LLM) | `IMPLEMENTED` | Add user-defined custom aliases |
| Streaming Responses in UI | `PARTIALLY_IMPLEMENTED` | Wire SSE chunks into chat speech bubble |
| Cross-Platform macOS/Linux | `PLANNED` | Decouple PowerShell dependencies into OS adapter |
| Local Offline Vector Memory | `PLANNED` | Integrate embedded SQLite database |

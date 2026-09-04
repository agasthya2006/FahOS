# FahOS V2 — AI Operating Layer for Windows

> **See → Understand → Act → Verify**

FahOS is a native Windows AI operating layer designed for the HackWave 3.0 Hackathon. It transforms your desktop into an intelligent, actionable surface capable of observing screen context, planning multi-step actions, executing system/browser tools, verifying outcomes, and recovering from failures.

## Core Features
- **Spatial Glass HUD**: Hotkey-summoned overlay (`Ctrl + Space`) & Screen Snipping tool (`Ctrl + Shift + M`).
- **100% Featherless AI Integration**: Driven by Featherless.ai serverless LLM, tool-calling, and vision endpoints.
- **Controlled Tool Sandbox**: 3-tier security model (`SAFE`, `CONFIRM`, `DANGEROUS`).
- **Empirical Verifier**: Automatic post-action verification and failure recovery loops.

## System Architecture
Built using **Python 3.11+**, `PyQt6` for hardware-accelerated translucent HUD overlays, and `PyWin32` / `UIAutomation` for deep Windows OS integration.

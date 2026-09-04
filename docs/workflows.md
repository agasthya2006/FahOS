# FahOS — Core Workflows & Execution Chains

This document outlines the operational workflows implemented across FahOS.

---

## 1. Primary Chat & Fast-Path Action Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Renderer as HUD Renderer (app.js)
    participant Main as Electron Main (main.js)
    participant Agent as Agent Engine (agent.js)
    participant Router as Model Router (router.js)
    participant Sys as System Actions (systemActions.js)
    participant LLM as Featherless / Gemini API

    User->>Renderer: Types or speaks command (e.g. "open notepad")
    Renderer->>Main: IPC 'user-send-message'
    Main->>Agent: processUserPrompt()
    Agent->>Router: classifyTask()
    
    alt Fast-Path (0ms LLM)
        Router-->>Agent: 'fastpath_app'
        Agent->>Sys: verifyAndOpenItem('notepad')
        Sys-->>Agent: { ok: true, description: 'Launched Notepad.' }
    else Deep LLM Reasoning
        Router-->>Agent: 'complex' / 'coding'
        Agent->>Router: executeTask()
        Router->>LLM: chatCompletion()
        LLM-->>Router: response
        Router-->>Agent: answerText
    end

    Agent-->>Main: { success: true, answerText }
    Main-->>Renderer: IPC 'agent-response'
    Renderer-->>User: Renders response & action tree
```

---

## 2. Screen Snip & Vision Analysis Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Main as Electron Main
    participant Snip as Snip Window (snip.js)
    participant HUD as HUD Window (app.js)
    participant Vision as Vision Sensor (Gemini)

    User->>HUD: Clicks Snip icon (or presses Ctrl+Shift+M)
    HUD->>Main: IPC 'trigger-snip-start'
    Main->>Main: Hide HUD, Open fullscreen Snip Window
    User->>Snip: Drags selection rectangle and hits Enter
    Snip->>Main: IPC 'snip-confirm' with bounds
    Main->>Main: desktopCapturer.getSources() & crop to JPEG
    Main->>HUD: IPC 'snip-captured' with base64 dataUrl
    User->>HUD: Enters question + sends prompt
    HUD->>Main: IPC 'user-send-message' with imageBase64
    Main->>Vision: analyzeImage() via Gemini 3.5 Flash
    Vision-->>Main: Contextual visual answer
    Main-->>HUD: IPC 'agent-response'
```

---

## 3. Autonomous Web Browser Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant HUD as HUD Window
    participant Main as Electron Main
    participant BrowserWin as Browser Window (agentBrowserWindow.js)
    participant Controller as Browser Controller (agentBrowserController.js)
    participant Webview as Chromium Webview Tag

    User->>HUD: "search youtube for lofi hip hop"
    HUD->>Main: IPC 'user-send-message'
    Main->>BrowserWin: runAgentTask()
    BrowserWin->>BrowserWin: Create 94% Display Window
    BrowserWin->>Controller: executeTask()
    Controller->>Webview: Load homepage & search URL
    Controller->>Webview: DOM injection & data extraction
    Webview-->>Controller: Extracted video title & URL
    Controller->>Controller: Gemini 3.1 Flash-Lite synthesis
    Controller-->>BrowserWin: Final summary & source URL
    BrowserWin-->>Main: Task result
    Main-->>HUD: Final response
```

---

## 4. WhatsApp & Directory Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Router as Model Router
    participant Agent as Agent Engine
    participant Contacts as Contacts Service
    participant OS as Windows Shell

    User->>Router: "open whatsapp and send hi to akhil"
    Router->>Router: extractWhatsAppMessage() -> { contact: 'akhil', message: 'hi' }
    Router-->>Agent: 'fastpath_whatsapp'
    Agent->>Contacts: getPhoneForContact('akhil')
    alt Contact Found with Phone (+919876543210)
        Contacts-->>Agent: Phone number
        Agent->>OS: shell.openExternal('whatsapp://send?phone=919876543210&text=hi')
    else Contact Not in Phonebook
        Agent->>OS: WScript UI Automation (search contact name in WhatsApp Desktop)
    end
```

---

## 5. Error Recovery & Failure Handling

```
Failure Detected
       │
       ├─► Network / API Error (Featherless 429/503)
       │       └─► Exponential backoff (1200ms-2500ms) up to 3 attempts
       │       └─► Fallback to fast model Qwen 2.5 7B
       │
       ├─► Vision Model Error (404/429)
       │       └─► Cascade: Gemini 3.5 Flash -> 3.6 Flash -> 3 Flash Preview -> Featherless VL
       │
       ├─► Voice Transcription Error
       │       └─► Cascade: Groq Whisper -> Gemini Audio -> Browser Web Speech fallback
       │
       └─► Command / Action Execution Failure
               └─► Safe return { ok: false, error: message } -> User error card with Retry button
```

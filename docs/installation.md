# FahOS — Clean Machine Installation & Setup Guide

This guide describes how to install, configure, and run **FahOS** on a clean Windows machine.

---

## 1. Prerequisites

- **Operating System**: Windows 10 or Windows 11 (64-bit)
- **Node.js**: Version 18.0.0 or higher (`node -v`)
- **Python**: Version 3.10 to 3.12 (`python --version`)
- **PowerShell**: Version 5.1+ (default on Windows 10/11)
- **Google Chrome**: Stable version installed (for browser automation)

---

## 2. Clone the Repository

```bash
git clone https://github.com/agasthya2006/FahOS.git
cd FahOS
```

---

## 3. Install Node.js Dependencies

```bash
npm install
```

---

## 4. Environment Configuration

Create a `.env` file in the project root based on `.env.example`:

```bash
copy .env.example .env
```

Edit `.env` and fill in your API keys:

```env
# Primary LLM API (Featherless AI)
# Obtain from https://featherless.ai
FEATHERLESS_API_KEY=your_featherless_api_key_here

# Google Gemini API (Vision & Autonomous Web Browser)
# Obtain from https://aistudio.google.com
GEMINI_API_KEY=your_gemini_api_key_here

# Groq API (High-speed Whisper Speech Transcription - Optional)
# Obtain from https://console.groq.com
GROQ_API_KEY=your_groq_api_key_here
```

---

## 5. Python Autonomous Browser Microservice Setup (Optional for Web Tasks)

If you intend to run autonomous Playwright tasks via the Python microservice:

```bash
cd browser-service

# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browser binaries
playwright install chromium

cd ..
```

---

## 6. Launch FahOS

### Development / Desktop Mode:
```bash
npm start
```

Or using npm dev shortcut:
```bash
npm run dev
```

---

## 7. Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Space` or `Alt+Space` | Toggle FahOS HUD Overlay (show / hide) |
| `Ctrl+Shift+M` | Open Screen Snipping Tool |
| `Esc` | Cancel current snip selection or close active modal |
| `Enter` | Confirm snip selection or send prompt |

---

## 8. Verification Checks

Run the automated verification suite to test core modules:
```bash
npm test
```

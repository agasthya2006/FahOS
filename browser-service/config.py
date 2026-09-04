"""
Configuration manager for FahOS Browser Service.
Reads secrets & model endpoints cleanly from environment or root .env.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Path to root .env
ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()

def get_gemini_api_key() -> str:
    return (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or ""
    )

def get_groq_api_key() -> str:
    return (
        os.getenv("GROQ_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or ""
    )

def get_groq_model() -> str:
    return os.getenv("BROWSER_LLM_MODEL") or "llama-3.3-70b-versatile"

def get_gemini_model() -> str:
    return os.getenv("GEMINI_MODEL") or "gemini-3.1-flash-lite"

PORT = int(os.getenv("PORT", "8484"))
HOST = os.getenv("HOST", "127.0.0.1")

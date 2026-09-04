@echo off
echo Starting FahOS Browser Control Service on port 8484...
cd /d "%~dp0"
if exist venv\Scripts\python.exe (
    venv\Scripts\python.exe main.py
) else (
    python main.py
)
pause

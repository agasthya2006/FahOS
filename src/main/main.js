const { app, BrowserWindow, globalShortcut, screen, ipcMain } = require('electron');
const path = require('path');
const AgentEngine = require('../agent/agent');

// 1. Disable hardware acceleration before ready to eliminate any black rectangular DWM backing artifacts
app.disableHardwareAcceleration();

let hudWindow = null;
let agentEngine = null;

const DEFAULT_WIDTH = 470;
const DEFAULT_HEIGHT = 265;

function createHUDWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight, y: workAreaY } = primaryDisplay.workArea;

  const marginX = 24;
  const marginY = 40;

  hudWindow = new BrowserWindow({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    minWidth: 470,
    maxWidth: 470,
    minHeight: 200,
    maxHeight: 920,
    x: screenWidth - DEFAULT_WIDTH - marginX,
    y: workAreaY + marginY,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  hudWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  hudWindow.on('closed', () => {
    hudWindow = null;
  });

  hudWindow.setAlwaysOnTop(true, 'floating', 1);
}

function registerGlobalShortcuts() {
  const toggleVisibility = () => {
    if (!hudWindow) return;
    if (hudWindow.isVisible()) {
      hudWindow.hide();
    } else {
      hudWindow.show();
      hudWindow.focus();
      hudWindow.webContents.send('focus-input');
    }
  };

  // Bind Ctrl + Space and Alt + Space
  globalShortcut.register('CommandOrControl+Space', toggleVisibility);
  globalShortcut.register('Alt+Space', toggleVisibility);

  // Ctrl + Shift + M for Screen Snipping
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (hudWindow) {
      hudWindow.show();
      hudWindow.webContents.send('trigger-snip');
    }
  });
}

function setupIPC() {
  agentEngine = new AgentEngine();

  ipcMain.on('close-hud', () => {
    if (hudWindow) hudWindow.hide();
  });

  ipcMain.on('minimize-hud', () => {
    if (hudWindow) hudWindow.minimize();
  });

  // Dynamic window resizing IPC (hard-locked 470px width)
  ipcMain.on('resize-hud-height', (event, targetHeight) => {
    if (!hudWindow) return;
    const clampedHeight = Math.min(920, Math.max(200, Math.round(targetHeight)));
    hudWindow.setBounds({ width: DEFAULT_WIDTH, height: clampedHeight });
  });

  // Reset to default 265px height
  ipcMain.on('reset-hud-size', () => {
    if (!hudWindow) return;
    hudWindow.setBounds({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  });

  ipcMain.on('user-send-message', async (event, message) => {
    console.log('[Backend Server] Received Command:', message);
    if (hudWindow) {
      hudWindow.webContents.send('agent-status-update', 'Analyzing context...');
    }

    const result = await agentEngine.processUserPrompt(message, (statusText) => {
      if (hudWindow) {
        hudWindow.webContents.send('agent-status-update', statusText);
      }
    });

    if (hudWindow) {
      hudWindow.webContents.send('agent-response', result);
    }
  });
}

app.whenReady().then(() => {
  createHUDWindow();
  registerGlobalShortcuts();
  setupIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createHUDWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

const { app, BrowserWindow, globalShortcut, screen, ipcMain, Tray, Menu } = require('electron');
const path = require('path');

let hudWindow = null;
let tray = null;

function createHUDWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight, y: workAreaY } = primaryDisplay.workArea;

  const windowWidth = 420;
  const windowHeight = 240;
  const marginX = 24;
  const marginY = 40;

  hudWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - marginX,
    y: workAreaY + marginY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: true,
    show: true,
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

  // Ensure always on top stays active even when clicking away
  hudWindow.setAlwaysOnTop(true, 'floating', 1);
}

function registerGlobalShortcuts() {
  // Ctrl + Space to toggle HUD visibility & focus
  const retSpace = globalShortcut.register('CommandOrControl+Space', () => {
    if (!hudWindow) return;

    if (hudWindow.isVisible()) {
      hudWindow.hide();
    } else {
      hudWindow.show();
      hudWindow.focus();
      hudWindow.webContents.send('focus-input');
    }
  });

  if (!retSpace) {
    console.warn('Global shortcut Ctrl+Space failed to register');
  } else {
    console.log('Global shortcut Ctrl+Space successfully registered!');
  }

  // Ctrl + Shift + M for Screen Snipping
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (hudWindow) {
      hudWindow.show();
      hudWindow.webContents.send('trigger-snip');
    }
  });
}

function setupIPC() {
  ipcMain.on('close-hud', () => {
    if (hudWindow) hudWindow.hide();
  });

  ipcMain.on('minimize-hud', () => {
    if (hudWindow) hudWindow.minimize();
  });

  ipcMain.on('user-send-message', (event, message) => {
    console.log('FahOS Command Received:', message);
    // Future: Route to Agent Loop & Featherless AI Core
    if (hudWindow) {
      hudWindow.webContents.send('agent-response', `Received command: "${message}"`);
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

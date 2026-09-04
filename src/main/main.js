const { app, BrowserWindow, globalShortcut, screen, ipcMain, desktopCapturer } = require('electron');
const path = require('path');
const AgentEngine = require('../agent/agent');

// 1. Disable hardware acceleration before ready to eliminate any black rectangular DWM backing artifacts
app.disableHardwareAcceleration();

let hudWindow = null;
let snipWindow = null;
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

function createSnipWindow() {
  if (snipWindow) {
    snipWindow.destroy();
    snipWindow = null;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  snipWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    fullscreen: true,
    skipTaskbar: true,
    resizable: false,
    enableLargerThanScreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  snipWindow.loadFile(path.join(__dirname, '../renderer/snip.html'));
  snipWindow.setAlwaysOnTop(true, 'screen-saver');

  snipWindow.on('closed', () => {
    snipWindow = null;
  });
}

function showOverlay() {
  if (!hudWindow) return;
  if (hudWindow.isMinimized()) hudWindow.restore();
  hudWindow.show();
  hudWindow.setAlwaysOnTop(true, 'floating', 1);
  hudWindow.moveTop();
  hudWindow.focus();

  // Send 'fahos:appear' to trigger a fresh new chat session on open
  hudWindow.webContents.send('fahos:appear');
  hudWindow.webContents.send('focus-input');
}

function hideOverlay() {
  if (!hudWindow || !hudWindow.isVisible()) return;
  hudWindow.webContents.send('fahos:prepareHide');
  setTimeout(() => {
    if (hudWindow && !hudWindow.isDestroyed()) {
      hudWindow.hide();
    }
  }, 100);
}

function toggleOverlay() {
  if (!hudWindow) return;
  if (hudWindow.isVisible() && !hudWindow.isMinimized()) {
    hideOverlay();
  } else {
    showOverlay();
  }
}

function registerGlobalShortcuts() {
  // Bind Ctrl + Space and Alt + Space
  globalShortcut.register('CommandOrControl+Space', toggleOverlay);
  globalShortcut.register('Alt+Space', toggleOverlay);

  // Ctrl + Shift + M for Screen Snipping
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (hudWindow) hudWindow.hide();
    setTimeout(() => {
      createSnipWindow();
    }, 100);
  });
}

function setupIPC() {
  agentEngine = new AgentEngine();

  ipcMain.on('close-hud', () => {
    hideOverlay();
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

  ipcMain.on('move-hud-by', (event, { deltaX, deltaY }) => {
    if (!hudWindow) return;
    const [currentX, currentY] = hudWindow.getPosition();
    hudWindow.setPosition(Math.round(currentX + deltaX), Math.round(currentY + deltaY));
  });

  // Reset to default 265px height
  ipcMain.on('reset-hud-size', () => {
    if (!hudWindow) return;
    hudWindow.setBounds({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  });

  // Screen Snipping Overlay Controls
  ipcMain.on('trigger-snip-start', () => {
    if (hudWindow) hudWindow.hide();
    setTimeout(() => {
      createSnipWindow();
    }, 100);
  });

  ipcMain.on('snip-cancel', () => {
    if (snipWindow) {
      snipWindow.close();
      snipWindow = null;
    }
    if (hudWindow) {
      hudWindow.show();
      hudWindow.focus();
    }
  });

  ipcMain.on('snip-confirm', async (event, bounds) => {
    try {
      const primaryDisplay = screen.getPrimaryDisplay();
      const scaleFactor = primaryDisplay.scaleFactor || 1;
      const { width, height } = primaryDisplay.bounds;

      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.round(width * scaleFactor),
          height: Math.round(height * scaleFactor)
        }
      });

      const primarySource = sources[0];
      if (primarySource && primarySource.thumbnail) {
        const croppedImage = primarySource.thumbnail.crop({
          x: Math.round(bounds.x * scaleFactor),
          y: Math.round(bounds.y * scaleFactor),
          width: Math.round(bounds.width * scaleFactor),
          height: Math.round(bounds.height * scaleFactor)
        });

        // Downscale to max 1280x720 for faster Gemini Vision processing
        const cropSize = croppedImage.getSize();
        let finalImage = croppedImage;
        const MAX_W = 1280, MAX_H = 720;
        if (cropSize.width > MAX_W || cropSize.height > MAX_H) {
          const scale = Math.min(MAX_W / cropSize.width, MAX_H / cropSize.height);
          finalImage = croppedImage.resize({
            width: Math.round(cropSize.width * scale),
            height: Math.round(cropSize.height * scale),
            quality: 'good'
          });
        }

        const jpegBuffer = finalImage.toJPEG(75);
        const dataUrl = `data:image/jpeg;base64,${jpegBuffer.toString('base64')}`;

        if (snipWindow) {
          snipWindow.close();
          snipWindow = null;
        }

        if (hudWindow) {
          hudWindow.show();
          hudWindow.focus();
          hudWindow.webContents.send('snip-captured', dataUrl);
        }
      }
    } catch (err) {
      console.error('[Snip Capture Error]:', err.message);
      if (snipWindow) {
        snipWindow.close();
        snipWindow = null;
      }
      if (hudWindow) {
        hudWindow.show();
        hudWindow.focus();
      }
    }
  });

  ipcMain.on('user-send-message', async (event, payload) => {
    const message = typeof payload === 'string' ? payload : payload.message;
    const imageBase64 = typeof payload === 'object' ? payload.imageBase64 : null;

    console.log('[Backend Server] Received Command:', message, imageBase64 ? '(with Image Attachment)' : '');
    if (hudWindow) {
      hudWindow.webContents.send('agent-status-update', 'Analyzing context...');
    }

    const result = await agentEngine.processUserPrompt(
      message,
      imageBase64,
      (statusText) => {
        if (hudWindow) {
          hudWindow.webContents.send('agent-status-update', statusText);
        }
      }
    );

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

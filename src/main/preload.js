const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fahosAPI', {
  closeHUD: () => ipcRenderer.send('close-hud'),
  minimizeHUD: () => ipcRenderer.send('minimize-hud'),
  resetHUDSize: () => ipcRenderer.send('reset-hud-size'),
  resizeHUDHeight: (targetHeight) => ipcRenderer.send('resize-hud-height', targetHeight),
  sendMessage: (msg) => ipcRenderer.send('user-send-message', msg),
  onFocusInput: (callback) => ipcRenderer.on('focus-input', callback),
  onTriggerSnip: (callback) => ipcRenderer.on('trigger-snip', callback),
  onAgentStatusUpdate: (callback) => ipcRenderer.on('agent-status-update', callback),
  onAgentResponse: (callback) => ipcRenderer.on('agent-response', callback)
});

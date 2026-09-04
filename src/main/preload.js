const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fahosAPI', {
  closeHUD: () => ipcRenderer.send('close-hud'),
  minimizeHUD: () => ipcRenderer.send('minimize-hud'),
  resetHUDSize: () => ipcRenderer.send('reset-hud-size'),
  resizeHUDHeight: (targetHeight) => ipcRenderer.send('resize-hud-height', targetHeight),
  moveHUDBy: (deltaX, deltaY) => ipcRenderer.send('move-hud-by', { deltaX, deltaY }),
  sendMessage: (msg, imageBase64 = null) => ipcRenderer.send('user-send-message', { message: msg, imageBase64 }),
  startSnip: () => ipcRenderer.send('trigger-snip-start'),
  cancelSnip: () => ipcRenderer.send('snip-cancel'),
  confirmSnip: (bounds) => ipcRenderer.send('snip-confirm', bounds),
  onFocusInput: (callback) => ipcRenderer.on('focus-input', callback),
  onAppear: (callback) => ipcRenderer.on('fahos:appear', () => callback()),
  onTriggerSnip: (callback) => ipcRenderer.on('trigger-snip', callback),
  onSnipCaptured: (callback) => ipcRenderer.on('snip-captured', callback),
  onAgentStatusUpdate: (callback) => ipcRenderer.on('agent-status-update', callback),
  onAgentResponse: (callback) => ipcRenderer.on('agent-response', callback)
});

contextBridge.exposeInMainWorld('fahos', {
  onAppear: (callback) => ipcRenderer.on('fahos:appear', () => callback()),
  setHeight: (height) => ipcRenderer.send('resize-hud-height', height),
  closeHUD: () => ipcRenderer.send('close-hud')
});

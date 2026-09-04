const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fahosAPI', {
  closeHUD: () => ipcRenderer.send('close-hud'),
  minimizeHUD: () => ipcRenderer.send('minimize-hud'),
  sendMessage: (msg) => ipcRenderer.send('user-send-message', msg),
  onFocusInput: (callback) => ipcRenderer.on('focus-input', callback),
  onTriggerSnip: (callback) => ipcRenderer.on('trigger-snip', callback),
  onAgentResponse: (callback) => ipcRenderer.on('agent-response', callback)
});

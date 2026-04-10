const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the React app to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
  isElectron: true
});

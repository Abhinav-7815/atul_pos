const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Legacy — purana code compatible rahe
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),

  // Printer management (Settings page se use karo)
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getConfig:   () => ipcRenderer.invoke('get-config'),
  setPrinter:  (name) => ipcRenderer.invoke('set-printer', name),
  rerunSetup:  () => ipcRenderer.invoke('rerun-setup'),

  // ESC/POS print via Node.js http (bypasses renderer fetch/CORS)
  printEscPos: (data, printerName, port) => ipcRenderer.invoke('print-escpos', data, printerName, port),
});

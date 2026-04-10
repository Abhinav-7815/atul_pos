const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: false, // Set to true for production kiosk mode
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'public/vite.svg') // Placeholder icon
  });

  // In production, we load the bundled file from 'dist'
  // In development, we load from the Vite dev server
  if (process.env.ELECTRON_START_URL) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  // Close dev tools in production
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Handle Silent Printing Request from React
ipcMain.handle('print-silent', async (event, options) => {
  if (!mainWindow) return { success: false, error: 'No window' };

  try {
    // This is the magic part that replaces the Python server
    mainWindow.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: options.deviceName || '', // e.g. 'EPSON TM-T81'
    }, (success, failureReason) => {
      if (!success) {
        console.error('Print failed:', failureReason);
      }
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

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
  const startUrl = process.env.ELECTRON_START_URL || 'https://atulicecream.com/pos/login';
  mainWindow.loadURL(startUrl);

  // Handle redirects — ensure /login always goes to /pos/login
  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (url === 'http://atulicecream.com/login' || url === 'https://atulicecream.com/login') {
      event.preventDefault();
      mainWindow.loadURL('https://atulicecream.com/pos/login');
    }
  });

  // Close dev tools in production
  // mainWindow.webContents.openDevTools();

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Handle Silent Printing Request from React
ipcMain.handle('print-silent', async (event, options) => {
  return new Promise((resolve) => {
    try {
      const printWin = new BrowserWindow({ show: false });

      const htmlContent = options.html || '<p>No content</p>';
      const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <style>
      @page { margin: 0; size: 80mm auto; }
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    </style>
  </head>
  <body>${htmlContent}</body>
</html>`;

      printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml));

      printWin.webContents.once('did-finish-load', () => {
        printWin.webContents.print({
          silent: true,
          printBackground: true,
          deviceName: options.deviceName || 'EPSON TM-T82 Receipt',
        }, (success, failureReason) => {
          printWin.close();
          if (success) {
            resolve({ success: true });
          } else {
            console.error('Print failed:', failureReason);
            resolve({ success: false, error: failureReason });
          }
        });
      });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

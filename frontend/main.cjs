const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;

// Local print server on port 9191 — React fetches this instead of IPC
function startPrintServer() {
  const server = http.createServer((req, res) => {
    // Allow CORS from atulicecream.com
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/print') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const { html, deviceName } = JSON.parse(body);
          silentPrint(html, deviceName);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true }));
        } catch (err) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(9191, '127.0.0.1', () => {
    console.log('[PrintServer] Listening on http://127.0.0.1:9191');
  });
}

function silentPrint(htmlContent, deviceName) {
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false }
  });

  const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <style>
      @page { margin: 0; size: 80mm auto; }
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
    </style>
  </head>
  <body>${htmlContent || '<p>No content</p>'}</body>
</html>`;

  printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml));

  printWin.webContents.once('did-finish-load', () => {
    printWin.webContents.print({
      silent: true,
      printBackground: true,
      deviceName: deviceName || '',
    }, (success, failureReason) => {
      printWin.close();
      if (!success) console.error('[PrintServer] Print failed:', failureReason);
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'public/vite.svg')
  });

  // Set custom userAgent so React can detect Electron environment
  mainWindow.webContents.setUserAgent(
    mainWindow.webContents.getUserAgent() + ' AtulPOS-Electron'
  );

  const startUrl = process.env.ELECTRON_START_URL || 'https://atulicecream.com/pos/login';
  mainWindow.loadURL(startUrl);

  mainWindow.webContents.on('will-redirect', (event, url) => {
    if (url === 'http://atulicecream.com/login' || url === 'https://atulicecream.com/login') {
      event.preventDefault();
      mainWindow.loadURL('https://atulicecream.com/pos/login');
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startPrintServer();
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

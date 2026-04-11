/**
 * Atul POS — Electron Main Process
 *
 * Features:
 *  - First-run printer setup wizard (GUI dialog)
 *  - ESC/POS raw bytes directly to thermal printer (no browser dialog)
 *  - Local HTTP server on port 9191 for React frontend
 *  - Config stored in userData/atul-pos-config.json
 */

const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path  = require('path');
const http  = require('http');
const fs    = require('fs');
const { execSync, exec } = require('child_process');
const os    = require('os');

// ─── CONFIG ────────────────────────────────────────────────────────────────
const CONFIG_FILE = path.join(app.getPath('userData'), 'atul-pos-config.json');
const LINE_WIDTH  = 42;

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

let config = loadConfig();

// ─── PRINTER UTILS ─────────────────────────────────────────────────────────

/** Windows pe installed printers ki list lao */
function getWindowsPrinters() {
  try {
    const out = execSync(
      'wmic printer get Name /format:list',
      { encoding: 'utf8', timeout: 5000 }
    );
    return out
      .split('\n')
      .map(l => l.replace('Name=', '').trim())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

/** ESC/POS raw bytes — aapki Python script ka Node.js port */
function buildEscPosReceipt(data) {
  const INIT       = Buffer.from([0x1b, 0x40]);
  const ALIGN_L    = Buffer.from([0x1b, 0x61, 0x00]);
  const ALIGN_C    = Buffer.from([0x1b, 0x61, 0x01]);
  const BOLD_ON    = Buffer.from([0x1b, 0x45, 0x01]);
  const BOLD_OFF   = Buffer.from([0x1b, 0x45, 0x00]);
  const DOUBLE_ON  = Buffer.from([0x1b, 0x21, 0x30]);
  const DOUBLE_OFF = Buffer.from([0x1b, 0x21, 0x00]);
  const CUT        = Buffer.from([0x1d, 0x56, 0x41, 0x05]);
  const LF         = Buffer.from([0x0a]);

  const enc = (str) => {
    // cp437 approximation via latin1 + replacements
    return Buffer.from(
      (str || '')
        .replace(/₹/g, '\x9c')   // rupee symbol
        .replace(/[^\x00-\x7f]/g, '?'),
      'latin1'
    );
  };

  const twoCol = (left, right, w = LINE_WIDTH) => {
    const gap = w - left.length - right.length;
    return left + ' '.repeat(Math.max(gap, 1)) + right;
  };

  const threeCol = (left, mid, right, w = LINE_WIDTH) => {
    const midW = 8, rightW = 8, leftW = w - midW - rightW;
    return (left.substring(0, leftW)).padEnd(leftW)
         + mid.substring(0, midW).padStart(midW)
         + right.substring(0, rightW).padStart(rightW);
  };

  const sep = (ch = '-') => ch.repeat(LINE_WIDTH);

  // ── Parse data ──────────────────────────────────────────────
  const outlet     = data.outlet || {};
  const shopName   = outlet.name   || 'ATUL ICE CREAM';
  const shopAddr   = outlet.address || '';
  const shopPhone  = outlet.phone   || '';
  const shopGstin  = outlet.gstin   || '';
  const orderNo    = data.order_number || '';
  const orderType  = (data.order_type || '').toUpperCase().replace(/_/g, ' ');
  const cashier    = data.cashier   || '';

  let dateStr = '', timeStr = '';
  try {
    const dt = new Date(data.date);
    dateStr = `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear()}`;
    let h = dt.getHours(), m = dt.getMinutes(), ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    timeStr = `${h}:${m.toString().padStart(2,'0')} ${ampm}`;
  } catch (_) {
    const now = new Date();
    dateStr = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;
    timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  const items   = data.items   || [];
  const totals  = data.totals  || {};
  const subtotal = parseFloat(totals.subtotal || 0);
  const cgst     = parseFloat(totals.cgst     || 0);
  const sgst     = parseFloat(totals.sgst     || 0);
  const discount = parseFloat(totals.discount || 0);
  const total    = parseFloat(totals.total    || 0);

  // ── Build buffer ────────────────────────────────────────────
  const parts = [];

  parts.push(INIT);

  // Header
  parts.push(ALIGN_C, DOUBLE_ON, BOLD_ON, enc(shopName + '\n'), DOUBLE_OFF, BOLD_OFF);
  parts.push(ALIGN_C);
  if (shopAddr)  parts.push(enc(shopAddr.substring(0, LINE_WIDTH).padStart(Math.ceil((shopAddr.length + LINE_WIDTH) / 2)).padEnd(LINE_WIDTH) + '\n'));
  if (shopPhone) parts.push(enc(('PH: ' + shopPhone).padStart(Math.ceil(('PH: ' + shopPhone).length / 2 + LINE_WIDTH / 2)).padEnd(LINE_WIDTH) + '\n'));
  if (shopGstin) parts.push(enc(('GSTIN: ' + shopGstin).padStart(Math.ceil(('GSTIN: ' + shopGstin).length / 2 + LINE_WIDTH / 2)).padEnd(LINE_WIDTH) + '\n'));
  parts.push(enc(sep('.') + '\n'));

  // Tax Invoice
  parts.push(ALIGN_C, BOLD_ON, enc('TAX INVOICE\n'), BOLD_OFF);
  parts.push(ALIGN_L);
  parts.push(enc(twoCol('Bill No: ' + orderNo, orderType) + '\n'));
  parts.push(enc(twoCol('Date: ' + dateStr, 'Time: ' + timeStr) + '\n'));
  if (cashier) parts.push(enc('Cashier: ' + cashier + '\n'));
  parts.push(enc(sep('.') + '\n'));

  // Items header
  parts.push(ALIGN_L, BOLD_ON, enc(threeCol('ITEM Description', 'QTY', 'Amt') + '\n'), BOLD_OFF);
  parts.push(enc(sep('.') + '\n'));

  // Items
  for (const item of items) {
    const name  = item.product_name || item.name || 'Item';
    const qty   = parseFloat(item.quantity || 1);
    const price = parseFloat(item.unit_price || item.price || 0);
    const amt   = parseFloat(item.item_total || qty * price);
    parts.push(ALIGN_L, enc(threeCol(name, qty.toFixed(0), '\x9c' + amt.toFixed(0)) + '\n'));
    parts.push(enc(threeCol('  @ ' + price.toFixed(2), '', '') + '\n'));
  }

  parts.push(enc(sep('.') + '\n'));

  // Totals
  parts.push(ALIGN_L);
  parts.push(enc(twoCol('Subtotal', '\x9c' + subtotal.toFixed(2)) + '\n'));
  if (discount > 0) parts.push(enc(twoCol('Discount', '-\x9c' + discount.toFixed(2)) + '\n'));
  if (cgst > 0)     parts.push(enc(twoCol('CGST (2.5%)', '\x9c' + cgst.toFixed(2)) + '\n'));
  if (sgst > 0)     parts.push(enc(twoCol('SGST (2.5%)', '\x9c' + sgst.toFixed(2)) + '\n'));
  parts.push(enc(sep('.') + '\n'));

  parts.push(BOLD_ON, enc(twoCol('NET PAYABLE', '\x9c' + total.toFixed(2)) + '\n'), BOLD_OFF);
  parts.push(enc(sep('.') + '\n'));

  // Footer
  parts.push(ALIGN_C);
  parts.push(enc('THANK YOU! VISIT AGAIN\n'));
  parts.push(enc('Powered by Atul POS\n'));
  parts.push(LF, LF, LF, CUT);

  return Buffer.concat(parts);
}

/**
 * Windows pe RAW bytes directly printer ko bhejo.
 * net use + copy command — koi driver, koi dialog nahi.
 */
function sendRawToPrinter(printerName, rawBuffer) {
  const tmpFile = path.join(os.tmpdir(), `atul_print_${Date.now()}.bin`);
  try {
    fs.writeFileSync(tmpFile, rawBuffer);
    // Escape printer name for shell
    const escaped = printerName.replace(/"/g, '\\"');
    execSync(`copy /b "${tmpFile}" "${escaped}"`, { shell: 'cmd.exe', timeout: 10000 });
    console.log(`[PrintServer] RAW sent to "${printerName}"`);
  } finally {
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  }
}

// ─── PRINTER SETUP WIZARD ──────────────────────────────────────────────────

/**
 * Pehli baar (ya agar config nahi hai) ek dialog dikhao:
 * User printer select kare → config mein save ho.
 * Returns selected printer name, ya null.
 */
async function runPrinterSetupWizard() {
  const printers = getWindowsPrinters();

  if (printers.length === 0) {
    await dialog.showMessageBox({
      type: 'warning',
      title: 'Atul POS — Printer Setup',
      message: 'Koi printer nahi mila!\n\nPehle Windows mein printer install karo, phir app dobara kholo.',
      buttons: ['OK']
    });
    return null;
  }

  const { response } = await dialog.showMessageBox({
    type: 'question',
    title: 'Atul POS — Printer Setup',
    message: 'Receipt printer select karo:',
    detail: 'Ye setting ek baar hoti hai. Baad mein Settings mein jakar badal sakte ho.',
    buttons: [...printers, 'Skip (baad mein set karunga)'],
    defaultId: printers.findIndex(p =>
      p.toLowerCase().includes('epson') || p.toLowerCase().includes('tm-t')
    ) > -1
      ? printers.findIndex(p => p.toLowerCase().includes('epson') || p.toLowerCase().includes('tm-t'))
      : 0,
    cancelId: printers.length,
  });

  if (response === printers.length) return null; // Skipped
  return printers[response];
}

// ─── HTTP PRINT SERVER ─────────────────────────────────────────────────────

function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function startPrintServer() {
  const server = http.createServer(async (req, res) => {
    // CORS — har response pe, OPTIONS se pehle
    addCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const jsonReply = (statusCode, obj) => {
      res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end(JSON.stringify(obj));
    };

    // ── GET /health ──────────────────────────────────────────
    if (req.method === 'GET' && req.url === '/health') {
      jsonReply(200, { status: 'ok', printer: config.printerName || null });
      return;
    }

    // ── GET /printers — list available printers ──────────────
    if (req.method === 'GET' && req.url === '/printers') {
      const list = getWindowsPrinters();
      jsonReply(200, { printers: list, selected: config.printerName || null });
      return;
    }

    // ── POST /set-printer — save printer choice ──────────────
    if (req.method === 'POST' && req.url === '/set-printer') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { printerName } = JSON.parse(body);
          config.printerName = printerName;
          saveConfig(config);
          jsonReply(200, { success: true, printerName });
        } catch (e) {
          jsonReply(400, { error: e.message });
        }
      });
      return;
    }

    // ── POST /print — main print endpoint ───────────────────
    if (req.method === 'POST' && req.url === '/print') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);

          const printerName = config.printerName;
          if (!printerName) {
            jsonReply(422, { error: 'Printer not configured. Go to Settings > Printer.' });
            return;
          }

          // html field aaya? — ESC/POS bytes bana ke print karo (silent, no dialog)
          if (data.html !== undefined) {
            silentHtmlPrint(data.html, printerName);
            jsonReply(200, { success: true, method: 'html', printer: printerName });
            return;
          }

          // Structured JSON — ESC/POS raw bytes
          const raw = buildEscPosReceipt(data);
          sendRawToPrinter(printerName, raw);
          jsonReply(200, { success: true, method: 'escpos', printer: printerName });

        } catch (err) {
          console.error('[PrintServer] Error:', err.message);
          jsonReply(500, { success: false, error: err.message });
        }
      });
      return;
    }

    jsonReply(404, { error: 'Not found' });
  });

  server.listen(9191, '127.0.0.1', () => {
    console.log('[PrintServer] Listening on http://127.0.0.1:9191');
  });
}

/** Legacy: HTML content ko silent Electron print se bhejo (no dialog). */
function silentHtmlPrint(htmlContent, deviceName) {
  const printWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });

  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>@page{margin:0;size:80mm auto;}body{margin:0;padding:0;font-family:Arial,sans-serif;}</style>
</head><body>${htmlContent || ''}</body></html>`;

  printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml));
  printWin.webContents.once('did-finish-load', () => {
    printWin.webContents.print(
      { silent: true, printBackground: true, deviceName: deviceName || '' },
      (ok, reason) => { printWin.close(); if (!ok) console.error('[Print] Failed:', reason); }
    );
  });
}

// ─── APP LIFECYCLE ─────────────────────────────────────────────────────────

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: path.join(__dirname, 'public/vite.svg'),
  });

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

  mainWindow.on('closed', () => { /* mainWindow = null */ });
}

app.on('ready', async () => {
  // ── First-time printer setup ─────────────────────────────
  if (!config.printerName) {
    const selected = await runPrinterSetupWizard();
    if (selected) {
      config.printerName = selected;
      saveConfig(config);
      console.log(`[Setup] Printer saved: "${selected}"`);
    }
  } else {
    console.log(`[Setup] Using saved printer: "${config.printerName}"`);
  }

  startPrintServer();
  createWindow();
});

// IPC: Settings page se printer change karne ke liye
ipcMain.handle('get-printers',   () => getWindowsPrinters());
ipcMain.handle('get-config',     () => config);
ipcMain.handle('set-printer',   (_, name) => {
  config.printerName = name;
  saveConfig(config);
  return { success: true };
});
ipcMain.handle('rerun-setup',   async () => {
  const selected = await runPrinterSetupWizard();
  if (selected) { config.printerName = selected; saveConfig(config); }
  return config;
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { createWindow(); });

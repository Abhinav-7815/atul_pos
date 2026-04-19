// FIRST LINE — file load check
require('fs').appendFileSync(require('os').tmpdir() + '/atul_pos_main.log',
  new Date().toISOString() + ' main.cjs START\n');

/**
 * Atul POS — Electron Main Process
 *
 * Print flow:
 *  1. Python print_server.py ko port 9192 pe spawn karta hai (win32print)
 *  2. Electron port 9191 pe apna HTTP server chalata hai (frontend yahan bhejta hai)
 *  3. /print request aayi → Python server pe forward karta hai
 *  4. Agar Python server available nahi → Node.js ESC/POS fallback (PowerShell)
 */

const { app, BrowserWindow, dialog, ipcMain } = require('electron');

if (!app.requestSingleInstanceLock()) {
  app.quit();
}
const path    = require('path');
const http    = require('http');
const fs      = require('fs');
const { execSync, spawn } = require('child_process');
const os      = require('os');

// ─── PYTHON PRINT SERVER SPAWN ─────────────────────────────────────────────

const PYTHON_PORT = 9192;
let pythonProcess  = null;
let lastPythonError = 'No error recorded yet';
let searchedPaths   = [];

function findPythonExe() {
  const isPackaged = app.isPackaged;
  const resourcesPath = process.resourcesPath;
  const execDir = path.dirname(process.execPath);

  const candidates = [
    // 1. Packaged: Default resources path
    path.join(resourcesPath, 'print_server.exe'),
    // 2. Packaged: Relative to EXE
    path.join(execDir, 'resources', 'print_server.exe'),
    // 3. Dev: Local folder
    path.join(__dirname, 'print_server.exe'),
    'python',
    'python3'
  ];

  searchedPaths = candidates;
  for (const c of candidates) {
    try {
      if (c.endsWith('.exe')) {
        if (fs.existsSync(c)) {
          console.log(`[PythonServer] Found EXE at: ${c}`);
          return { exe: c, args: [] };
        }
      } else {
        // Only try system python if not packaged
        if (!isPackaged) {
          execSync(`${c} --version`, { stdio: 'ignore', timeout: 1000 });
          const script = path.join(__dirname, 'print_server.py');
          if (fs.existsSync(script)) {
            console.log(`[PythonServer] Found Python with script: ${script}`);
            return { exe: c, args: [script] };
          }
        }
      }
    } catch (_) {}
  }
  return null;
}

function spawnPythonServer() {
  const found = findPythonExe();
  if (!found) {
    console.warn('[PythonServer] Python / print_server.exe nahi mila — Node.js fallback use hoga');
    return;
  }

  const { exe, args } = found;
  console.log(`[PythonServer] Spawning: ${exe} ${args.join(' ')}`);

  // Force-kill any orphaned print_server.exe to avoid EADDRINUSE (Port 9192)
  if (exe.endsWith('.exe')) {
    try { execSync('taskkill /F /IM print_server.exe /T', { stdio: 'ignore' }); } catch(_) {}
  }

  pythonProcess = spawn(exe, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  pythonProcess.stdout.on('data', d => process.stdout.write('[Python] ' + d));
  pythonProcess.stderr.on('data', d => {
    lastPythonError = d.toString();
    process.stderr.write('[Python] ' + d);
  });

  pythonProcess.on('exit', (code) => {
    console.log(`[PythonServer] Process exited with code ${code}`);
    pythonProcess = null;
    pythonReady = false;
    
    // Auto-restart if it crashed (code !== 0)
    if (code !== 0 && code !== null) {
      console.log('[PythonServer] Crushed! Restarting in 2 seconds...');
      setTimeout(spawnPythonServer, 2000);
    }
  });
}

async function waitForPythonServer(timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const ok = await new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${PYTHON_PORT}/health`, { timeout: 500 }, (res) => {
          resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });
      if (ok) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

async function forwardToPython(printerName, data, port) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: '127.0.0.1',
      port: port || PYTHON_PORT,
      path: '/print',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Printer-Name': printerName,
      },
    };
    const req = http.request(options, (res) => {
      let resp = '';
      res.on('data', c => resp += c);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode === 200, body: JSON.parse(resp) }); }
        catch { resolve({ ok: res.statusCode === 200, body: {} }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Python server timeout')); });
    req.write(body);
    req.end();
  });
}

// ─── ESC/POS BUILDER (Pure Node.js — no Python needed) ────────────────────

const INIT       = Buffer.from([0x1b, 0x40]);
const ALIGN_L    = Buffer.from([0x1b, 0x61, 0x00]);
const ALIGN_C    = Buffer.from([0x1b, 0x61, 0x01]);
const BOLD_ON    = Buffer.from([0x1b, 0x45, 0x01]);
const BOLD_OFF   = Buffer.from([0x1b, 0x45, 0x00]);
const DOUBLE_ON  = Buffer.from([0x1b, 0x21, 0x30]);
const DOUBLE_OFF = Buffer.from([0x1b, 0x21, 0x00]);
const CUT        = Buffer.from([0x1d, 0x56, 0x41, 0x05]);
const LF         = Buffer.from([0x0a]);

const LINE_WIDTH = 42;

function enc(text) {
  // Convert to cp437-safe ASCII — replace Rs with 'Rs', strip non-ASCII
  const safe = text.replace(/[^\x00-\x7e]/g, (ch) => {
    if (ch === '₹' || ch === '£') return 'Rs';
    return '?';
  });
  return Buffer.from(safe, 'ascii');
}

function twoCol(left, right, width = LINE_WIDTH) {
  const gap = width - left.length - right.length;
  return left + ' '.repeat(Math.max(gap, 1)) + right;
}

function threeCol(left, mid, right, width = LINE_WIDTH) {
  const midW = 8, rightW = 8;
  const leftW = width - midW - rightW;
  left  = String(left).slice(0, leftW).padEnd(leftW);
  mid   = String(mid).slice(0, midW).padStart(Math.floor((midW + String(mid).length) / 2)).padEnd(midW);
  right = String(right).slice(0, rightW).padStart(rightW);
  return left + mid + right;
}

function sep(char = '-') { return char.repeat(LINE_WIDTH); }

function buildEscPos(data) {
  const outlet    = data.outlet || {};
  const shopName  = outlet.name     || 'ATUL ICE CREAM';
  const shopSub   = outlet.sub_name || 'ATUL ICE CREAM - RAJKOT';
  const shopAddr  = outlet.address  || 'Opp. Bhaktinagar Police Station, Kothariya';
  const shopPhone = outlet.phone    || '9825758887';
  const shopGstin = outlet.gstin    || '24AAAAA0000A1Z5';

  const orderNo   = String(data.order_number || '');
  const orderType = (data.order_type || 'DINE').toUpperCase();
  const cashier   = data.cashier || '';

  let dt;
  try { dt = new Date(data.date); if (isNaN(dt)) throw 0; } catch { dt = new Date(); }
  const pad2 = n => String(n).padStart(2, '0');
  const dateStr = `${pad2(dt.getDate())}/${pad2(dt.getMonth()+1)}/${dt.getFullYear()}`;
  const h = dt.getHours(), ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h % 12) || 12);
  const timeStr = `${h12}:${pad2(dt.getMinutes())} ${ampm}`;

  const totals   = data.totals || {};
  const subtotal = parseFloat(totals.subtotal || 0);
  const cgstAmt  = parseFloat(totals.cgst || 0);
  const sgstAmt  = parseFloat(totals.sgst || 0);
  const netPay   = parseFloat(totals.total || 0);
  const items    = data.items || [];

  const parts = [];
  const add = (...bufs) => parts.push(...bufs);

  add(INIT);

  // Header
  add(ALIGN_C, DOUBLE_ON, BOLD_ON, enc(shopName + '\n'), DOUBLE_OFF, BOLD_OFF);
  add(ALIGN_C, enc(shopSub + '\n'));
  for (const line of shopAddr.split('\n')) add(enc(line.trim() + '\n'));
  add(enc(`PH: ${shopPhone}\n`));
  add(enc(`GSTIN: ${shopGstin}\n`));
  add(enc(sep('.') + '\n'));

  // Title
  add(ALIGN_C, BOLD_ON, enc('TAX INVOICE\n'), BOLD_OFF);

  // Order info
  add(ALIGN_L);
  add(enc(twoCol(`Bill No: ${orderNo}`, orderType) + '\n'));
  add(enc(twoCol(`Date: ${dateStr}`, `Time: ${timeStr}`) + '\n'));
  if (cashier) add(enc(`Cashier: ${cashier}\n`));
  add(enc(sep('.') + '\n'));

  // Items header
  add(ALIGN_L, BOLD_ON, enc(threeCol('ITEM Description', 'QTY', 'Amt') + '\n'), BOLD_OFF);
  add(enc(sep('.') + '\n'));

  // Items
  for (const item of items) {
    const name   = item.product_name || item.name || 'Item';
    const unit   = (item.unit_label || '').trim();
    const qty    = parseFloat(item.quantity || 1);
    const price  = parseFloat(item.unit_price || item.price || 0);
    const amount = parseFloat(item.item_total || item.item_subtotal || (qty * price));

    // Qty display logic:
    // "250 Gms", "500 Gms" (starts with digit) → just unit_label
    // "Cup", "Cone" (letters only) → qty + unit_label (e.g. "3 Cup")
    // "pc(s)" / empty → just qty number
    let qtyDisplay;
    if (!unit || unit === 'pc(s)' || unit.toLowerCase() === 'pcs' || unit.toLowerCase() === 'pc') {
      qtyDisplay = String(qty % 1 === 0 ? qty : qty.toFixed(2));
    } else if (/^\d/.test(unit)) {
      qtyDisplay = unit;
    } else {
      qtyDisplay = `${qty % 1 === 0 ? qty : qty.toFixed(2)} ${unit}`;
    }

    add(ALIGN_L);
    add(enc(threeCol(name, qtyDisplay, `Rs${amount.toFixed(0)}`) + '\n'));
    add(enc(threeCol(`  @ Rs${price.toFixed(2)}`, '', '') + '\n'));
  }

  add(enc(sep('.') + '\n'));

  // Totals
  add(ALIGN_L);
  add(enc(twoCol('Subtotal',     `Rs${subtotal.toFixed(2)}`) + '\n'));
  add(enc(twoCol('CGST (2.5%)', `Rs${cgstAmt.toFixed(2)}`)  + '\n'));
  add(enc(twoCol('SGST (2.5%)', `Rs${sgstAmt.toFixed(2)}`)  + '\n'));
  add(enc(sep('.') + '\n'));
  add(BOLD_ON, enc(twoCol('NET PAYABLE', `Rs${netPay.toFixed(2)}`) + '\n'), BOLD_OFF);
  add(enc(sep('.') + '\n'));

  // Footer
  add(ALIGN_C);
  add(enc('THANK YOU! VISIT AGAIN\n'));
  add(enc('Software by Atul Ice Cream\n'));
  add(enc('* Items price sold cannot be returned *\n'));
  add(LF, LF, LF, LF, LF, CUT);

  return Buffer.concat(parts);
}

function printRawEscPos(printerName, rawBuffer) {
  // Use PowerShell to send raw bytes to Windows printer
  const tmpFile = path.join(os.tmpdir(), `atul_pos_${Date.now()}.bin`);
  fs.writeFileSync(tmpFile, rawBuffer);
  const ps = `
$printerName = "${printerName.replace(/"/g, '')}";
$tmpFile = "${tmpFile.replace(/\\/g, '\\\\')}";
$bytes = [System.IO.File]::ReadAllBytes($tmpFile);
$printerDef = Get-Printer -Name $printerName -ErrorAction SilentlyContinue;
if (-not $printerDef) { Write-Error "Printer not found"; exit 1 }
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
  public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
  [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
  public static extern int StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFOA pDocInfo);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)] public struct DOCINFOA {
    [MarshalAs(UnmanagedType.LPTStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPTStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPTStr)] public string pDataType;
  }
}
'@
$hPrinter = [IntPtr]::Zero;
[RawPrinter]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero) | Out-Null;
$docInfo = New-Object RawPrinter+DOCINFOA; $docInfo.pDocName="POS Receipt"; $docInfo.pDataType="RAW";
[RawPrinter]::StartDocPrinter($hPrinter, 1, [ref]$docInfo) | Out-Null;
[RawPrinter]::StartPagePrinter($hPrinter) | Out-Null;
$written = 0;
[RawPrinter]::WritePrinter($hPrinter, $bytes, $bytes.Length, [ref]$written) | Out-Null;
[RawPrinter]::EndPagePrinter($hPrinter) | Out-Null;
[RawPrinter]::EndDocPrinter($hPrinter) | Out-Null;
[RawPrinter]::ClosePrinter($hPrinter) | Out-Null;
Remove-Item $tmpFile -ErrorAction SilentlyContinue;
Write-Output "OK";
`;
  const psTmpFile = path.join(os.tmpdir(), `atul_pos_print_${Date.now()}.ps1`);
  fs.writeFileSync(psTmpFile, ps, 'utf8');
  try {
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psTmpFile}"`, { encoding: 'utf8', timeout: 10000 });
    console.log('[RawPrint] PowerShell output:', out.trim());
  } catch (e) {
    console.error('[RawPrint] Error:', e.stderr || e.message);
  } finally {
    try { fs.unlinkSync(psTmpFile); } catch {}
  }
}

// ─── CONFIG ────────────────────────────────────────────────────────────────
// CONFIG_FILE lazily resolved after app is ready (app.getPath requires app to be initialized)
let CONFIG_FILE = null;
function getConfigFile() {
  if (!CONFIG_FILE) CONFIG_FILE = path.join(app.getPath('userData'), 'atul-pos-config.json');
  return CONFIG_FILE;
}

function loadConfig() {
  try {
    const f = getConfigFile();
    if (fs.existsSync(f)) {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function saveConfig(cfg) {
  fs.writeFileSync(getConfigFile(), JSON.stringify(cfg, null, 2), 'utf8');
}

let config = {};   // populated in app.on('ready') after app is initialized

// ─── PRINTER UTILS ─────────────────────────────────────────────────────────

function getWindowsPrinters() {
  try {
    const out = execSync('wmic printer get Name /format:list', { encoding: 'utf8', timeout: 5000 });
    return out.split('\n').map(l => l.replace('Name=', '').trim()).filter(Boolean);
  } catch (_) { return []; }
}

async function runPrinterSetupWizard() {
  const printers = getWindowsPrinters();
  if (printers.length === 0) {
    await dialog.showMessageBox({ type: 'warning', title: 'Atul POS', message: 'No printers found!' });
    return null;
  }
  const { response } = await dialog.showMessageBox({
    type: 'question',
    title: 'Atul POS — Printer Setup',
    message: 'Select Receipt Printer:',
    buttons: [...printers, 'Skip'],
    defaultId: 0
  });
  if (response === printers.length) return null;
  return printers[response];
}

// ─── HTTP PRINT SERVER (port 9191 — frontend yahan bhejta hai) ───────────────

let pythonReady = false;   // Python server 9192 pe ready hai ya nahi

function startPrintServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204); res.end(); return;
    }

    // Health check — printer.js isPrintServerAvailable() yahan check karta hai
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, pythonReady }));
      return;
    }

    if (req.method === 'GET' && req.url === '/debug') {
      res.writeHead(200);
      res.end(JSON.stringify({
        isPackaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        execPath: process.execPath,
        searchedPaths,
        pythonReady,
        lastPythonError,
        pythonProcessExists: !!pythonProcess
      }, null, 2));
      return;
    }

    if (req.method === 'POST' && req.url === '/print') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          // DEBUG — items ka unit_label dekho
          console.log('[PrintServer] Items received:', JSON.stringify(data.items, null, 2));
          // Header ya config se printer name lo
          const printerName = req.headers['x-printer-name'] || config.printerName;

          // HTML -> silent Electron print (dialog-free) — printer name optional
          if (data.html !== undefined) {
            silentHtmlPrint(data.html, printerName || '');
            res.writeHead(200); res.end(JSON.stringify({ success: true, method: 'html' }));
            return;
          }

          // Structured JSON → Python server (win32print) try karo
          if (pythonReady) {
            try {
              console.log('[PrintServer] Forwarding to Python server (win32print)...');
              const result = await forwardToPython(printerName, data);
              if (result.ok) {
                res.writeHead(200); res.end(JSON.stringify({ success: true, method: 'python-win32print' }));
                return;
              }
            } catch (e) {
              console.warn('[PrintServer] Python forward failed:', e.message, '— falling back to Node.js');
            }
          }

          // Fallback → Node.js ESC/POS + PowerShell
          console.log('[PrintServer] Node.js ESC/POS fallback...');
          const rawBuffer = buildEscPos(data);
          printRawEscPos(printerName, rawBuffer);
          res.writeHead(200); res.end(JSON.stringify({ success: true, method: 'nodejs-escpos' }));

        } catch (e) {
          console.error('[PrintServer] Error:', e.message);
          res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404); res.end();
  });

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error('[PrintServer] Port 9191 in use. Already running?');
      // Port in use — optional: try to kill the process or just ignore if we are single instance
    }
  });

  server.listen(9191, '127.0.0.1', () => {
    console.log('[PrintServer] Running on port 9191');
  });
}

function silentHtmlPrint(htmlContent, deviceName) {
  const printWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
  const fullHtml = `<html><body style="margin:0;padding:0;">${htmlContent}</body></html>`;
  printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fullHtml));
  printWin.webContents.once('did-finish-load', () => {
    printWin.webContents.print({ silent: true, deviceName: deviceName || '', margins: { marginType: 'none' } }, () => printWin.close());
  });
}

// ─── APP LIFECYCLE ─────────────────────────────────────────────────────────

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: { contextIsolation: true, preload: path.join(__dirname, 'preload.cjs'), allowRunningInsecureContent: true, webSecurity: false }
  });
  mainWindow.webContents.setUserAgent(mainWindow.webContents.getUserAgent() + ' AtulPOS-Electron');
const localIndex = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(localIndex)) {
    mainWindow.loadFile(localIndex);
  } else {
    mainWindow.loadURL('http://atulicecream.com/pos/login');
  }
}

app.on('ready', async () => {
  // 1. Config load
  config = loadConfig();

  // 2. Electron HTTP server start karo (port 9191) — HTML print ke liye
  startPrintServer();

  // 3. Python print_server.exe spawn karo (port 9192) — ESC/POS ke liye
  spawnPythonServer();
  waitForPythonServer(6000).then(ok => {
    pythonReady = ok;
    console.log(ok ? '[PythonServer] Ready on 9192' : '[PythonServer] Not available — Node.js fallback');
  });

  // 4. Browser window
  createWindow();

  // 4. Printer setup wizard (pehli baar)
  if (!config.printerName) {
    const selected = await runPrinterSetupWizard();
    if (selected) { config.printerName = selected; saveConfig(config); }
  }
});

app.on('window-all-closed', () => {
  if (pythonProcess) {
    console.log('[Main] Killing pythonProcess before exit');
    pythonProcess.kill();
    pythonProcess = null;
  }
  if (process.platform !== 'darwin') app.quit();
});


ipcMain.handle('get-config', () => config);
ipcMain.handle('get-printers', () => getWindowsPrinters());
ipcMain.handle('set-printer', (_, name) => { config.printerName = name; saveConfig(config); return { success: true }; });

// ESC/POS print via Node.js http — bypasses renderer fetch/CORS entirely
ipcMain.handle('print-escpos', async (_, data, printerName, port) => {
  const printer = printerName || config.printerName;
  if (!printer) return { success: false, error: 'No printer configured' };
  const printPort = parseInt(port) || PYTHON_PORT;
  console.log('[IPC] print-escpos called, printer:', printer, 'port:', printPort);
  try {
    const result = await forwardToPython(printer, data, printPort);
    console.log('[IPC] Python result:', result.ok, result.body);
    if (result.ok && result.body.success) return { success: true };
    return { success: false, error: result.body.error || 'Print failed' };
  } catch (e) {
    console.error('[IPC] print-escpos error:', e.message);
    return { success: false, error: e.message };
  }
});

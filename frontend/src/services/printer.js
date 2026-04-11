/**
 * Atul POS — Print Service
 *
 * Electron EXE mein:
 *   → Python print_server.exe port 9192 pe chal raha hota hai
 *   → Seedha 9192 pe JSON bhejo → win32print → EPSON TM-T82
 *
 * Browser mein:
 *   → QZ Tray try karo → fallback browser print dialog
 */

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('AtulPOS-Electron');

// Python print_server.exe (Electron EXE ke saath bundle hota hai)
const PYTHON_PRINT_SERVER = 'http://127.0.0.1:9192';

// Printer name — localStorage se lo, fallback EPSON default
function getPrinterName() {
  try {
    return localStorage.getItem('atul_printer_name') || 'EPSON TM-T82 Receipt';
  } catch {
    return 'EPSON TM-T82 Receipt';
  }
}

// ─── PYTHON PRINT SERVER ───────────────────────────────────────────────────

async function isPythonServerAvailable() {
  try {
    const res = await fetch(`${PYTHON_PRINT_SERVER}/health`, {
      signal: AbortSignal.timeout(1000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendToPythonServer(payload, printerName) {
  const res = await fetch(`${PYTHON_PRINT_SERVER}/print`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Printer-Name': printerName || '',
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ─── QZ TRAY (browser fallback) ────────────────────────────────────────────

const QZ_CERT = `-----BEGIN CERTIFICATE-----
MIIDrzCCApegAwIBAgIUTG3P1A4i9+RRqAGLTpFC4jQcUQMwDQYJKoZIhvcNAQEL
BQAwZzELMAkGA1UEBhMCSU4xEDAOBgNVBAgMB0d1amFyYXQxEjAQBgNVBAcMCUFo
bWVkYWJhZDEXMBUGA1UECgwOQXR1bCBJY2UgQ3JlYW0xGTAXBgNVBAMMEGF0dWxp
Y2VjcmVhbS5jb20wHhcNMjYwNDEwMjMyNDQ2WhcNMzYwNDA3MjMyNDQ2WjBnMQsw
CQYDVQQGEwJJTjEQMA4GA1UECAwHR3VqYXJhdDESMBAGA1UEBwwJQWhtZWRhYmFk
MRcwFQYDVQQKDA5BdHVsIEljZSBDcmVhbTEZMBcGA1UEAwwQYXR1bGljZWNyZWFt
LmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAM/WG87GE0CMXXya
N4vlmAiYI+TdzvJqHHe5uLJfi89x7XM7Cjw5om9U/bUcUlOhT3f6/YDYg5rD4fEG
iRZnwsgHIn2Ro7LEHhzX5ddl8h6NXizb8TDda9nrH+RYZASzqhyrKYHkVf/9OGjh
QmmwghulJC4O25zfvkncvC+o8mLOKZnexsnFbQFYH3R3iXtJ3b9gFUw3TxKgF5HL
pBoUqGyEMH5C58RsvUbNuV5SvtUwhTHnQoNCBF7UugoSWojZyi3EYppvPK/SyCgx
GK31mXN3l7gdDi7inN3kQ48M82JAvkEOuyIfRpUbXPkwXBM5xx1UR8APva8zs1qy
4tlpVqMCAwEAAaNTMFEwHQYDVR0OBBYEFCBp6gmR+AfFkYZEgO1kxUHdsGVcMB8G
A1UdIwQYMBaAFCBp6gmR+AfFkYZEgO1kxUHdsGVcMA8GA1UdEwEB/wQFMAMBAf8w
DQYJKoZIhvcNAQELBQADggEBAGQtPBWsOh1Jp+vXf1/EFalEbAivz0c0JEodExCP
myuT7zoz8op4IqB/2/03HhgFGqO124WKvv9v7boqlf2QAfti0ifUTftklEYcMSxa
J4wt6ckK/XPjhoc502m08g41Vti11JKah4R/bfn8OLWt1zk5QWp2XLrpeSyIGA14
/IJDkQpF67rGHFRu1SCHOLfqVeyEC5bSV20k9K0OsUf2yVNougzEb9e6QLtWeaYg
JmPZB4ftKeZ1s+359TrbE461++X+eXohvU37Tf5Tiv/FCWQLH0lHwaPVHGbZ90Ki
+PLetPMn4t+X78MAP2ZD8RmKVIKEgrW3XW+VmAWE91rrY44=
-----END CERTIFICATE-----`;

function loadQZScript() {
  return new Promise((resolve) => {
    if (window.qz) return resolve();
    const script = document.createElement('script');
    script.src = '/pos/qz-tray.js';
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

let isInitializing = false;
async function isQZAvailable() {
  if (window.qz?.websocket?.isActive()) return true;
  if (isInitializing) {
    let limit = 0;
    while (isInitializing && limit < 50) {
      await new Promise(r => setTimeout(r, 100));
      limit++;
    }
    return window.qz?.websocket?.isActive();
  }
  isInitializing = true;
  try {
    await loadQZScript();
    if (!window.qz) return false;
    window.qz.security.setCertificatePromise(() => Promise.resolve(QZ_CERT));
    window.qz.security.setSignatureAlgorithm('SHA512');
    window.qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
      fetch('/api/v1/auth/qz-sign/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: toSign }),
      })
        .then(r => r.json())
        .then(data => {
          const sig = data.signature || data?.data?.signature;
          if (sig) resolve(sig); else reject('Signing failed');
        })
        .catch(reject);
    });
    if (!window.qz.websocket.isActive()) {
      window.qz.websocket.connect({ retries: 2, delay: 1 });
      let wait = 0;
      while (!window.qz.websocket.isActive() && wait < 40) {
        await new Promise(r => setTimeout(r, 100));
        wait++;
      }
    }
    return window.qz.websocket.isActive();
  } catch {
    return false;
  } finally {
    isInitializing = false;
  }
}

async function printViaQZ(html) {
  const ok = await isQZAvailable();
  if (!ok) return false;
  try {
    const printers = await window.qz.printers.find('EPSON').catch(() => []);
    const printerName = (Array.isArray(printers) ? printers[0] : printers)
      || await window.qz.printers.getDefault();
    if (!printerName) return false;
    const config = window.qz.configs.create(printerName);
    config.setMargins(0);
    await window.qz.print(config, [{
      type: 'pixel', format: 'html', flavor: 'plain',
      options: { pageWidth: 58, pageHeight: 200, renderDensity: 203, centerImage: true },
      data: `<!DOCTYPE html><html><body style="margin:0;padding:0;">
        <style>@page{margin:0;size:58mm auto;}body{font-family:Arial,sans-serif;width:48mm;}</style>
        ${html}</body></html>`
    }]);
    return true;
  } catch {
    return false;
  }
}

// ─── PRINT QUEUE ───────────────────────────────────────────────────────────

let printQueue = Promise.resolve();

/**
 * ESC/POS structured print — Python print_server.exe ko bhejo.
 * Electron EXE mein seedha port 9192 pe jaata hai.
 */
export async function printOrderEscPos(orderData, printerName) {
  if (!orderData) return;

  const printer = printerName || getPrinterName();

  printQueue = printQueue.then(async () => {
    // 1. Python server (Electron EXE ke andar print_server.exe)
    try {
      const available = await isPythonServerAvailable();
      if (available) {
        const result = await sendToPythonServer(orderData, printer);
        if (result.success) {
          console.log('[Printer] OK via Python win32print:', result.method);
          return;
        }
        console.warn('[Printer] Python server error:', result.error);
      }
    } catch (e) {
      console.warn('[Printer] Python server error:', e.message);
    }

    console.warn('[Printer] Python server nahi mila — browser fallback');
  });

  return printQueue;
}

/**
 * HTML receipt print — browser/QZ fallback.
 */
export async function printReceipt({ receiptRef }) {
  const html = receiptRef?.current?.innerHTML;
  if (!html) return;

  printQueue = printQueue.then(async () => {
    // QZ Tray try karo
    const qzOk = await printViaQZ(html);
    if (qzOk) {
      console.log('[Printer] OK via QZ Tray');
      return;
    }

    // Browser dialog fallback
    console.log('[Printer] Fallback: browser print dialog');
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.visibility = 'hidden';
    iframe.srcdoc = `<html><body onload="window.print();">${html}</body></html>`;
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 3000);
  });

  return printQueue;
}

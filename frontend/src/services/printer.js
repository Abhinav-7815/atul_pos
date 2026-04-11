/**
 * Atul POS — Print Service
 * Priority: Electron → QZ Tray → iframe fallback
 */

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

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

// ── QZ Tray ──────────────────────────────────────────────────────────────────

function loadQZScript() {
  return new Promise((resolve, reject) => {
    if (window.qz) return resolve();
    const script = document.createElement('script');
    script.src = '/pos/qz-tray.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

let qzInitPromise = null;

async function isQZAvailable() {
  if (qzInitPromise) return qzInitPromise;
  qzInitPromise = (async () => {
    try {
      await loadQZScript();
      if (!window.qz) return false;

      window.qz.security.setCertificatePromise(function(resolve) {
        resolve(QZ_CERT);
      });

      window.qz.security.setSignatureAlgorithm('SHA512');
      window.qz.security.setSignaturePromise(function(toSign) {
        return function(resolve) { resolve(''); };
      });

      if (!window.qz.websocket.isActive()) {
        await window.qz.websocket.connect({ retries: 2, delay: 1 });
      }
      return window.qz.websocket.isActive();
    } catch (err) {
      console.warn('[Printer] QZ Tray not available:', err.message);
      qzInitPromise = null;
      return false;
    }
  })();
  return qzInitPromise;
}

async function printViaQZ(htmlContent) {
  const printers = await window.qz.printers.find('EPSON').catch(() => []);
  const printerName = (printers && printers.length > 0)
    ? (Array.isArray(printers) ? printers[0] : printers)
    : await window.qz.printers.getDefault();

  if (!printerName) throw new Error('No printer found');

  const config = window.qz.configs.create(printerName);
  const data = [{
    type: 'pixel',
    format: 'html',
    flavor: 'plain',
    data: `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>@page{margin:0;size:80mm auto;}body{margin:0;padding:0;font-family:Arial,sans-serif;width:80mm;}</style></head><body>${htmlContent}</body></html>`
  }];
  await window.qz.print(config, data);
  console.log('[Printer] QZ Tray print sent.');
}

// ── iframe fallback ───────────────────────────────────────────────────────────

function printViaIframe(htmlContent) {
  return new Promise((resolve) => {
    const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <style>
      @page { margin: 0; size: 80mm auto; }
      body { margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; width: 80mm; }
    </style>
  </head>
  <body>${htmlContent}</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '80mm';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.src = url;
    iframe.onload = () => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
        resolve();
      }, 1500);
    };
    document.body.appendChild(iframe);
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function doPrint(html) {
  if (!html) return;

  if (isElectron) {
    try {
      await fetch('http://127.0.0.1:9191/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, deviceName: 'EPSON TM-T82 Receipt' }),
      });
    } catch (e) {
      console.error('[Printer] Electron print failed:', e);
    }
    return;
  }

  const qzOk = await isQZAvailable();
  if (qzOk) {
    try {
      await printViaQZ(html);
      return;
    } catch (err) {
      console.warn('[Printer] QZ print failed, falling back to iframe:', err.message);
    }
  }

  await printViaIframe(html);
}

const getRefHtml = (ref) => ref?.current?.innerHTML || '';
export const printReceipt = ({ receiptRef }) => doPrint(getRefHtml(receiptRef));
export const printKOT = ({ kotRef }) => doPrint(getRefHtml(kotRef));

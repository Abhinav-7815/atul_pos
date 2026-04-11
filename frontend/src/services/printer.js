/**
 * Atul POS — Print Service (Brute Force Version)
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
     // Wait for existing initialization to finish
     let limit = 0;
     while (isInitializing && limit < 50) {
        await new Promise(r => setTimeout(r, 100));
        limit++;
     }
     return window.qz?.websocket?.isActive();
  }

  isInitializing = true;
  try {
    console.log('[Printer] Initializing...');
    await loadQZScript();
    if (!window.qz) return false;

    // 1. Set Security
    window.qz.security.setCertificatePromise(() => Promise.resolve(QZ_CERT));
    window.qz.security.setSignatureAlgorithm('SHA512');
    window.qz.security.setSignaturePromise(() => (resolve) => resolve(""));

    // 2. Connect (don't await the promise as it might hang)
    if (!window.qz.websocket.isActive()) {
       window.qz.websocket.connect({ retries: 2, delay: 1 });
       
       // Manually wait for connection
       let wait = 0;
       while (!window.qz.websocket.isActive() && wait < 40) {
          await new Promise(r => setTimeout(r, 100));
          wait++;
       }
    }

    console.log('[Printer] Status:', window.qz.websocket.isActive() ? 'Connected' : 'Failed');
    return window.qz.websocket.isActive();
  } catch (err) {
    console.warn('[Printer] Connection error');
    return false;
  } finally {
    isInitializing = false;
  }
}

let printQueue = Promise.resolve();

async function doPrint(html) {
  if (!html) return;
  
  // Add to queue to prevent concurrent attempts
  printQueue = printQueue.then(async () => {
    console.log('[Printer] Processing item...');
    
    if (isElectron) {
      try {
        await fetch('http://127.0.0.1:9191/print', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html, deviceName: 'EPSON TM-T82 Receipt' }),
        });
      } catch (e) {}
      return;
    }

    const ok = await isQZAvailable();
    if (ok) {
        try {
            const printers = await window.qz.printers.find('EPSON').catch(() => []);
            const printerName = (printers && (Array.isArray(printers) ? printers.length > 0 : printers))
                ? (Array.isArray(printers) ? printers[0] : printers)
                : await window.qz.printers.getDefault();
            
            if (printerName) {
                const config = window.qz.configs.create(printerName);
                const data = [{
                   type: 'pixel', format: 'html', flavor: 'plain',
                   data: `<!DOCTYPE html><html><body><style>@page { margin: 0; size: 80mm auto; } body { margin: 0; padding: 0; font-family: Arial; width: 80mm; font-size: 14px; }</style>${html}</body></html>`
                }];
                await window.qz.print(config, data);
                console.log('[Printer] Printed successfully');
                return;
            }
        } catch (e) { console.warn('[Printer] QZ Print failed'); }
    }

    // Iframe Fallback
    console.log('[Printer] Falling back to browser print');
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed'; iframe.style.visibility = 'hidden';
    iframe.srcdoc = `<html><body onload="window.print();">${html}</body></html>`;
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 2000);
  });
  
  return printQueue;
}

const getRefHtml = (ref) => ref?.current?.innerHTML || '';
export const printReceipt = ({ receiptRef }) => doPrint(getRefHtml(receiptRef));

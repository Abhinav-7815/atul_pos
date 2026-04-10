/**
 * Atul POS — Print Service
 *
 * Priority:
 * 1. Electron (.exe)  → local HTTP server on 127.0.0.1:9191 (silent, no dialog)
 * 2. Browser + QZ Tray running → QZ Tray (silent, no dialog)
 * 3. Browser fallback → hidden iframe (shows print dialog)
 */

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

// ── QZ Tray helpers ──────────────────────────────────────────────────────────

function loadQZScript() {
  return new Promise((resolve, reject) => {
    if (window.qz) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function isQZAvailable() {
  try {
    await loadQZScript();
    if (!window.qz) return false;
    if (!window.qz.websocket.isActive()) {
      await window.qz.websocket.connect({ retries: 1, delay: 0.5 });
    }
    return window.qz.websocket.isActive();
  } catch {
    return false;
  }
}

async function printViaQZ(htmlContent) {
  const config = window.qz.configs.create(null); // null = default printer
  const data = [{
    type: 'pixel',
    format: 'html',
    flavor: 'plain',
    data: `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"/>
    <style>
      @page { margin: 0; size: 80mm auto; }
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; width: 80mm; }
    </style>
  </head>
  <body>${htmlContent}</body>
</html>`,
  }];
  await window.qz.print(config, data);
}

// ── Electron local server ────────────────────────────────────────────────────

async function silentPrintViaLocalServer(html) {
  await fetch('http://127.0.0.1:9191/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, deviceName: 'EPSON TM-T82 Receipt' }),
  });
}

// ── Browser iframe fallback ──────────────────────────────────────────────────

function printViaIframe(htmlContent) {
  return new Promise((resolve) => {
    const fullHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 0; size: 80mm auto; }
      body { margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; }
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

// ── Ref HTML extractor ───────────────────────────────────────────────────────

function getRefHtml(ref) {
  if (!ref?.current) return null;
  const el = ref.current;
  const prevDisplay = el.style.display;
  el.style.display = 'block';
  const html = el.innerHTML;
  el.style.display = prevDisplay;
  return html;
}

// ── Main print functions ─────────────────────────────────────────────────────

async function doPrint(html) {
  if (!html) { window.print(); return; }

  if (isElectron) {
    console.log('[Printer] Electron: silent print via local server...');
    await silentPrintViaLocalServer(html);
    return;
  }

  // Try QZ Tray first
  const qzOk = await isQZAvailable();
  if (qzOk) {
    console.log('[Printer] QZ Tray: silent print...');
    await printViaQZ(html);
    return;
  }

  // Fallback: iframe
  console.log('[Printer] Browser: iframe print (dialog will show)...');
  await printViaIframe(html);
}

export async function printReceipt({ receiptRef }) {
  await doPrint(getRefHtml(receiptRef));
}

export async function printKOT({ kotRef }) {
  await doPrint(getRefHtml(kotRef));
}

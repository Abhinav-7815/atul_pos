/**
 * Atul POS — Desktop Hybrid Print Service
 *
 * Automatically detects if running in Electron (the .EXE) or a regular browser.
 * - In Electron: Uses native SILENT printing.
 * - In Browser: Prints via hidden iframe (only the receipt/KOT, not the full page).
 */

// navigator.userAgent contains "Electron" in all Electron windows, including remote URLs
const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

/**
 * Prints the innerHTML of a given DOM ref via a hidden iframe.
 * Uses a Blob URL to avoid the deprecated doc.write() API.
 * Only the receipt content is sent to the printer — not the full page.
 */
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

function getRefHtml(ref) {
  if (!ref?.current) return null;
  const el = ref.current;
  const prevDisplay = el.style.display;
  el.style.display = 'block';
  const html = el.innerHTML;
  el.style.display = prevDisplay;
  return html;
}

async function silentPrintViaLocalServer(html) {
  // Electron local print server runs on 127.0.0.1:9191
  await fetch('http://127.0.0.1:9191/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, deviceName: 'EPSON TM-T82 Receipt' }),
  });
}

export async function printReceipt({ receiptRef }) {
  const html = getRefHtml(receiptRef);
  if (isElectron) {
    console.log('[Printer] Electron: silent print via local server...');
    await silentPrintViaLocalServer(html || '');
  } else {
    console.log('[Printer] Browser: hidden iframe print for Bill...');
    if (html) {
      await printViaIframe(html);
    } else {
      window.print();
    }
  }
}

export async function printKOT({ kotRef }) {
  const html = getRefHtml(kotRef);
  if (isElectron) {
    console.log('[Printer] Electron: silent print via local server...');
    await silentPrintViaLocalServer(html || '');
  } else {
    console.log('[Printer] Browser: hidden iframe print for KOT...');
    if (html) {
      await printViaIframe(html);
    } else {
      window.print();
    }
  }
}

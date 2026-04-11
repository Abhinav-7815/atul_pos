/**
 * Atul POS — Print Service
 * Prints receipt/KOT via hidden iframe — shows browser print dialog with only the receipt content.
 */

const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.includes('Electron');

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

  await printViaIframe(html);
}

const getRefHtml = (ref) => ref?.current?.innerHTML || '';
export const printReceipt = ({ receiptRef }) => doPrint(getRefHtml(receiptRef));
export const printKOT = ({ kotRef }) => doPrint(getRefHtml(kotRef));

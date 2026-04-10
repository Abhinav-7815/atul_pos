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

const QZ_CERT = `-----BEGIN CERTIFICATE-----
MIIECzCCAvOgAwIBAgIGAZ15paZKMA0GCSqGSIb3DQEBCwUAMIGiMQswCQYDVQQG
EwJVUzELMAkGA1UECAwCTlkxEjAQBgNVBAcMCUNhbmFzdG90YTEbMBkGA1UECgwS
UVogSW5kdXN0cmllcywgTExDMRswGQYDVQQLDBJRWiBJbmR1c3RyaWVzLCBMTEMx
HDAaBgkqhkiG9w0BCQEWDXN1cHBvcnRAcXouaW8xGjAYBgNVBAMMEVFaIFRyYXkg
RGVtbyBDZXJ0MB4XDTI2MDQwOTIzMDYzMloXDTQ2MDQwOTIzMDYzMlowgaIxCzAJ
BgNVBAYTAlVTMQswCQYDVQQIDAJOWTESMBAGA1UEBwwJQ2FuYXN0b3RhMRswGQYD
VQQKDBJRWiBJbmR1c3RyaWVzLCBMTEMxGzAZBgNVBAsMElFaIEluZHVzdHJpZXMs
IExMQzEcMBoGCSqGSIb3DQEJARYNc3VwcG9ydEBxei5pbzEaMBgGA1UEAwwRUVog
VHJheSBEZW1vIENlcnQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDa
aGa4jGnEsi3XhuTCMSxLbD+N6+hp0mskkH06J749XCAGBG0Ha93t/SOFzNNP/Vp5
S1Pa4u92MXcuZWiIHl/a8veXB0DXxvnOKpNgaqImS07xuaepLtthrEmtwgpxB3eQ
pwzHSd+nfeyfvys2obI091kKn1UVYbNzeaxdTpgX8/+VWnDQxKngBDYjzxBt76ka
jl+rzyFAHK84KmCEg58KCpQcwsJx8GGTK4xWxqxQao7zxEMVRjrVtLFRtjsEw5Lr
suGNiI4DQgkGyHlb34mfye7Ywo2TIpLZOLk/xQEvQUFJoOVNAxwhmhWxNtCK3uHY
p5X1JmWOFwdwU/2661UNAgMBAAGjRTBDMBIGA1UdEwEB/wQIMAYBAf8CAQEwDgYD
VR0PAQH/BAQDAgEGMB0GA1UdDgQWBBTIR4RgsPx21CJhLiEcliNMEN3mpjANBgkq
hkiG9w0BAQsFAAOCAQEAMCvlX3CzObEGqbI9ZQm9Cc7mlcqHkp8u9FUMvkv2V/YS
5Ac1P3jNAS2WKjdyEC2yJooZY0qp4H5vTptsPoAO99XtvWY/71SHMQrC5xPO2Gas
/ggkr+jLGPMJsHGewlvk3K+b5fjbipNdPH8W2idJwvXJRZxfGDGJzVhG6NYDD+iE
yXvNdF1EARP2jj238mjSCmce6tiEf0kHihoX96iyQk0J/ApmWSM6BRTkNQnvOxre
cBjdXw00olnzTZRYc2Hph2ezwMfDG8czgSDIDpqeC3Ybc/Mx7+diYV++C7wfgUx/
n+U/5Ay1giZF8xi7hkuTCEgIWtbyH/mAw2GGPeLVpw==
-----END CERTIFICATE-----`;

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

    // Set certificate so QZ Tray trusts this site without popup
    window.qz.security.setCertificatePromise((resolve) => resolve(QZ_CERT));
    // No signing key available — use empty signature (works with demo cert + override.crt)
    window.qz.security.setSignatureAlgorithm('SHA512');
    window.qz.security.setSignaturePromise(() => (resolve) => resolve(''));

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

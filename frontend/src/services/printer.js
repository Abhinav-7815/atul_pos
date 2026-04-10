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

const QZ_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDP1hvOxhNAjF18
mjeL5ZgImCPk3c7yahx3ubiyX4vPce1zOwo8OaJvVP21HFJToU93+v2A2IOaw+Hx
BokWZ8LIByJ9kaOyxB4c1+XXZfIejV4s2/Ew3WvZ6x/kWGQEs6ocqymB5FX//Tho
4UJpsIIbpSQuDtuc375J3LwvqPJizimZ3sbJxW0BWB90d4l7Sd2/YBVMN08SoBeR
y6QaFKhshDB+QufEbL1GzbleUr7VMIUx50KDQgRe1LoKElqI2cotxGKabzyv0sgo
MRit9Zlzd5e4HQ4u4pzd5EOPDPNiQL5BDrsiH0aVG1z5MFwTOccdVEfAD72vM7Na
suLZaVajAgMBAAECggEAKHK4bbkB1S2cIhxXVBwmRwHo9mkuleIN0UUtS1Wp/YDk
H+ltGAR1dupZB+7PnOQHdce8n19D2ZJmvgQyGNCvyUMONNbrv2ZIn/9qhU2bXdPQ
cLWLTqHBFCOczNFhAcM/h53OEa/xBsVuvYadaLlH0P6GOIp+thybSX+yhioApja0
YRswTzhQRCBjXsXHVUgngtP7wu78iuSYOVLoQM0qf8KnDfiJHJdKTYzN40KfNGIw
LIokgmRoIG57s1uPTyCr5CwRzwmbAGkggIUTlBYKGcV/mbQt8ZQpQZtPe+OqQu/P
/Iojkro87e2xvgmPwmkfqrgK+u8I3e6PkNGqb0CB7QKBgQDyNElaLCJPltqEwtqi
KQ63eldS07bi5cS+l+IGgxobJWZ5FyleK5F0YMnErYRIgUwHnQMmdM2/lcjHH6Rx
NgHfESMUI/0UY49sVzt7PiIvz85S1g+MbiLHS4kQmp9wj2xWhuysdYH+TpAOoeiI
+iXUKokOWZ5roBCRPse1KwfI9wKBgQDbrK9g02Av8WrMKAp4kPluFdYoceIXGF8L
Gd0PNZ/QNQnuBkDyJ/9TMsQhU/nv/XUafBtLdttihjeH+pJOtdNfMpbE+Mfr5yQe
jjh7D7Y5pHjcC9sTGry02ZuyTbEttX5zgHxQ30xfH5pvtwZbHz3/NxUXwtStfqzX
wdV0xonAtQKBgQDQuZqVKP+QkzJRwxJjOPrDx5zFdkpfkx9QGNfiQM0Yo8yBgiJW
UzmQj3CSG+6qBTMeRINYesRs3Iogf/ZY0fAe6kfOrY0GKx6IgUxzUwJnLbBi1rKj
lK5IDaJbOsU4XYFBuBjyLnoOTGn9Ei6xDNHY26ctRLIvkct1QCMez6xv1QKBgQDH
1MnhGcfZNRLCzvXfgXn1g5XCSv6xpbDn50opyM0tWOJEjZnM70ebhoXWD49Aml9J
jXZC6sddU9z2LKGlSlASvHFckzdCSIyZ4yRMBhntS8nJ2lsagOsC1SWGSJiRjRWP
umTcKJVPvu79CxCUGdKK9K+SYuCXRrGyv5gO14B+NQKBgQCPSAFbpO8WwhRs77HE
HzJMVIJVgykKAWG0CulY2rrY2XZ+WlpZN7UkR3/i/ssUAZH+JU4TbCNEm+26A5/+
/IKaERp3j4zigTcoZDsBO5gG7z5jv7j1WMkNsPT96g63uA56b0tBWUZNe/NBeoXF
tzpNhygNDKCu4Q+A2aw+o3oK7Q==
-----END PRIVATE KEY-----`;

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

async function isQZAvailable() {
  try {
    await loadQZScript();
    if (!window.qz) return false;

    // Set certificate + sign requests with private key so QZ Tray trusts without popup
    window.qz.security.setCertificatePromise((resolve) => resolve(QZ_CERT));
    window.qz.security.setSignatureAlgorithm('SHA512');
    window.qz.security.setSignaturePromise((toSign) => {
      return new Promise((resolve, reject) => {
        try {
          const algo = { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-512' } };
          const pemBody = QZ_PRIVATE_KEY
            .replace('-----BEGIN PRIVATE KEY-----', '')
            .replace('-----END PRIVATE KEY-----', '')
            .replace(/\s+/g, '');
          const binaryDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
          crypto.subtle.importKey('pkcs8', binaryDer.buffer, algo, false, ['sign'])
            .then(key => crypto.subtle.sign(algo, key, new TextEncoder().encode(toSign)))
            .then(sig => resolve(btoa(String.fromCharCode(...new Uint8Array(sig)))))
            .catch(reject);
        } catch (err) { reject(err); }
      });
    });

    if (!window.qz.websocket.isActive()) {
      await window.qz.websocket.connect({ retries: 1, delay: 0.5 });
    }
    return window.qz.websocket.isActive();
  } catch {
    return false;
  }
}

async function printViaQZ(htmlContent) {
  const config = window.qz.configs.create('EPSON TM-T82 Receipt');
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

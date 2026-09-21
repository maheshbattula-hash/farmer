const fs = require('fs');
const path = require('path');
const { toQR } = require('toqr');

const url = 'exp://192.168.37.51:8081';
const raw = toQR(url);
const size = 29;
const quiet = 3;
const total = size + quiet * 2;

let rects = '';
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    if (raw[y * size + x]) {
      rects += `<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1" fill="#111827"/>\n`;
    }
  }
}

const svg = `<svg viewBox="0 0 ${total} ${total}" width="300" height="300" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">
  <rect width="${total}" height="${total}" fill="#ffffff" rx="2"/>
  ${rects}
</svg>`;

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Smart Farmer Mobile - Expo Tunnel QR</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 20px;
      padding: 36px;
      text-align: center;
      max-width: 480px;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
    }
    .badge {
      display: inline-block;
      background: #065f46;
      color: #34d399;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 0.05em;
      margin-bottom: 16px;
    }
    h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
      color: #38bdf8;
    }
    p {
      color: #94a3b8;
      font-size: 15px;
      line-height: 1.5;
      margin: 8px 0;
    }
    .qr-box {
      background: white;
      padding: 20px;
      border-radius: 16px;
      display: inline-block;
      margin: 20px 0;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
    }
    .url-title {
      font-size: 13px;
      color: #cbd5e1;
      margin-top: 16px;
      font-weight: 500;
    }
    .url-box {
      background: #0f172a;
      border: 1px solid #334155;
      padding: 14px;
      border-radius: 10px;
      font-family: Consolas, Monaco, monospace;
      font-size: 14px;
      color: #a7f3d0;
      word-break: break-all;
      user-select: all;
      margin-top: 6px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">● TUNNEL ACTIVE</div>
    <h2>Smart Farmer Mobile</h2>
    <p>Scan this QR code with <b>Expo Go</b> or your phone camera:</p>
    <div class="qr-box">
      ${svg}
    </div>
    <div class="url-title">Or in Expo Go, tap <b>"Enter URL manually"</b> and paste:</div>
    <div class="url-box">${url}</div>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, '..', 'qr.html'), html, 'utf8');
console.log('Successfully generated qr.html');

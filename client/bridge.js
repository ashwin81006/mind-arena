import http from 'http';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, 'dist');

const WS_PORT = parseInt(process.env.PORT || '5051', 10);
const TCP_PORT = parseInt(process.env.TCP_PORT || '5050', 10);
const TCP_HOST = process.env.TCP_HOST || 'localhost';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

const httpServer = http.createServer((req, res) => {
  if (!fs.existsSync(distPath)) {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Mind Arena WebSocket Bridge Active');
    return;
  }

  let filePath = path.join(distPath, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distPath, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server: httpServer });

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Bridge] Port ${WS_PORT} is already in use.`);
  } else {
    console.error('[Bridge] Server error:', err);
  }
});

httpServer.listen(WS_PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`  MIND ARENA - Web Server & WebSocket Bridge`);
  console.log(`  Listening on: http://0.0.0.0:${WS_PORT}`);
  console.log(`  Forwarding to TCP Server: ${TCP_HOST}:${TCP_PORT}`);
  console.log(`===============================================\n`);
});

wss.on('connection', (ws) => {
  console.log('[Bridge] Browser client connected via WebSocket');
  const tcpSocket = new net.Socket();

  tcpSocket.connect(TCP_PORT, TCP_HOST, () => {
    console.log(`[Bridge] Connected to Java TCP Server at ${TCP_HOST}:${TCP_PORT}`);
  });

  let buffer = '';
  tcpSocket.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // save incomplete line
    for (const line of lines) {
      const trimmed = line.replace('\r', '').trim();
      if (trimmed && ws.readyState === ws.OPEN) {
        ws.send(trimmed);
      }
    }
  });

  ws.on('message', (data) => {
    const msg = data.toString().trim();
    if (msg && tcpSocket.writable) {
      tcpSocket.write(msg + '\n');
    }
  });

  ws.on('close', () => {
    console.log('[Bridge] Browser client disconnected');
    try {
      tcpSocket.write('DISCONNECT\n');
      tcpSocket.end();
    } catch (e) {}
  });

  tcpSocket.on('close', () => {
    console.log('[Bridge] TCP connection closed');
    if (ws.readyState === ws.OPEN) {
      ws.close();
    }
  });

  tcpSocket.on('error', (err) => {
    console.error('[Bridge] TCP Socket error:', err.message);
    if (ws.readyState === ws.OPEN) {
      ws.send(`ERROR|Cannot connect to Mind Arena TCP server (port ${TCP_PORT}): ${err.message}`);
    }
  });
});

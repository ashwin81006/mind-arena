// Mind Arena - Standalone WebSocket to TCP Bridge
// Bridges web browser WebSockets (ws://localhost:5051) to Java TCP Server (localhost:5050)
import net from 'net';
import { WebSocketServer } from 'ws';

const WS_PORT = 5051;
const TCP_PORT = 5050;
const TCP_HOST = 'localhost';

const wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' });

console.log(`===============================================`);
console.log(`  MIND ARENA - WebSocket <-> TCP Bridge`);
console.log(`  Listening on WebSocket: ws://0.0.0.0:${WS_PORT}`);
console.log(`  Forwarding to TCP Server: ${TCP_HOST}:${TCP_PORT}`);
console.log(`===============================================\n`);

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

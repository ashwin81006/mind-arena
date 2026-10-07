import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import net from 'net';
import { WebSocketServer } from 'ws';

function tcpBridgePlugin() {
  let wss = null;
  return {
    name: 'tcp-bridge',
    configureServer(server) {
      if (wss) return;
      const BRIDGE_PORT = 5051;
      const TCP_PORT = 5050;

      try {
        wss = new WebSocketServer({ port: BRIDGE_PORT, host: '0.0.0.0' });
        wss.on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`\n[Bridge] Port ${BRIDGE_PORT} already in use. Reusing existing bridge.\n`);
          } else {
            console.error('[Bridge] WebSocketServer error:', err);
          }
        });
        console.log(`\n[Bridge] WebSocket-to-TCP bridge active on ws://0.0.0.0:${BRIDGE_PORT}`);
        console.log(`[Bridge] Connecting to Mind Arena TCP server on localhost:${TCP_PORT}\n`);
      } catch (err) {
        if (err.code === 'EADDRINUSE') {
          console.log(`\n[Bridge] Port ${BRIDGE_PORT} already in use. Reusing existing bridge.\n`);
          return;
        }
        throw err;
      }

      server.httpServer?.on('close', () => {
        if (wss) {
          try { wss.close(); } catch (e) {}
          wss = null;
        }
      });

      wss.on('connection', (ws) => {
        console.log('[Bridge] Web client connected via WebSocket');
        const tcpSocket = new net.Socket();

        tcpSocket.connect(TCP_PORT, 'localhost', () => {
          console.log('[Bridge] Connected to Mind Arena TCP server (5050)');
        });

        let buffer = '';
        tcpSocket.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep remainder
          for (const line of lines) {
            const trimmed = line.replace('\r', '').trim();
            if (trimmed && ws.readyState === ws.OPEN) {
              ws.send(trimmed);
            }
          }
        });

        ws.on('message', (msg) => {
          const text = msg.toString().trim();
          if (text && tcpSocket.writable) {
            tcpSocket.write(text + '\n');
          }
        });

        ws.on('close', () => {
          console.log('[Bridge] Web client disconnected');
          try {
            tcpSocket.write('DISCONNECT\n');
            tcpSocket.end();
          } catch (e) {}
        });

        tcpSocket.on('close', () => {
          if (ws.readyState === ws.OPEN) {
            ws.close();
          }
        });

        tcpSocket.on('error', (err) => {
          console.error('[Bridge] TCP error:', err.message);
          if (ws.readyState === ws.OPEN) {
            ws.send(`ERROR|TCP Server connection error: ${err.message}`);
          }
        });
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), tcpBridgePlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    open: false
  }
});

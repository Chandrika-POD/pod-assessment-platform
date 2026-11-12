import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { GeminiBridge } from './gemini-bridge.js';

export function attachConversationLive(
  server,
  {
    service,
    apiKey,
    model,
    origins,
    createBridge = (options) => new GeminiBridge(options),
  },
) {
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 32000,
    perMessageDeflate: false,
  });
  const active = new Map();
  server.on('upgrade', async (request, socket, head) => {
    // This app is a local prototype; origin validation protects the local key from arbitrary websites.
    let reservedId;
    const reject = (code) => {
      socket.end(`HTTP/1.1 ${code}\r\nConnection: close\r\n\r\n`);
    };
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      const match = path.match(/^\/api\/conversations\/([^/]+)\/live$/);
      if (!match || !origins.includes(request.headers.origin))
        return reject('403 Forbidden');
      const id = z.uuid().parse(match[1]);
      if (!apiKey) return reject('503 Service Unavailable');
      if (active.has(id) || active.size >= 8) return reject('409 Conflict');
      active.set(id, null);
      reservedId = id; // Reserve across the async DB read.
      let state;
      try {
        state = await service.get(id);
      } catch {
        active.delete(id);
        return reject('404 Not Found');
      }
      if (state.status !== 'draft' || socket.destroyed) {
        active.delete(id);
        return reject('409 Conflict');
      }
      sockets.handleUpgrade(request, socket, head, (ws) => {
        const send = (message) => {
          if (ws.readyState === 1) {
            if (ws.bufferedAmount > 1024 * 1024) {
              ws.close(1008, 'Connection too slow.');
              return;
            }
            ws.send(JSON.stringify(message));
          }
        };
        const bridge = createBridge({
          apiKey,
          model,
          state,
          send,
          getState: () => service.get(id),
        });
        active.set(id, bridge);
        let windowAt = Date.now(),
          bytes = 0,
          count = 0;
        const expiry = setTimeout(
          () => ws.close(1000, 'Reconnect to continue your saved draft.'),
          20 * 60 * 1000,
        );
        ws.on('error', () => {});
        ws.on('message', (payload, binary) => {
          if (Date.now() - windowAt > 1000) {
            windowAt = Date.now();
            bytes = 0;
            count = 0;
          }
          bytes += payload.length;
          count += 1;
          if (bytes > 128000 || count > 60) {
            ws.close(1008, 'Message limit exceeded.');
            return;
          }
          try {
            if (binary) bridge.sendAudio(payload);
            else {
              const data = JSON.parse(payload.toString());
              if (data.type === 'text') bridge.sendText(data.text);
              else if (data.type === 'audio_end') bridge.endAudio();
              else throw new Error('Unsupported message.');
            }
          } catch {
            send({
              type: 'error',
              message:
                'Message could not be sent. Check the connection and try again.',
            });
          }
        });
        ws.on('close', () => {
          clearTimeout(expiry);
          bridge.stop();
          if (active.get(id) === bridge) active.delete(id);
        });
        send({ type: 'state', state });
        bridge.start().catch(() => {
          send({ type: 'error', message: 'Unable to start Gemini.' });
          ws.close();
        });
      });
    } catch {
      if (reservedId && active.get(reservedId) === null)
        active.delete(reservedId);
      reject('400 Bad Request');
    }
  });
  return {
    changed(state) {
      try {
        active.get(state.id)?.update(state);
      } catch {
        active.get(state.id)?.fail();
      }
    },
    close() {
      for (const ws of sockets.clients) ws.terminate();
      sockets.close();
    },
  };
}

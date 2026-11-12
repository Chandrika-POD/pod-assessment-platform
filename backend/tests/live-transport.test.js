import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import { attachConversationLive } from '../src/modules/conversations/conversations.live.js';

async function serverFixture(apiKey = 'test-only-placeholder') {
  const server = http.createServer();
  let stopped = 0;
  const live = attachConversationLive(server, {
    apiKey,
    model: 'test',
    origins: ['http://localhost:5173'],
    service: { get: async (id) => ({ id, status: 'draft' }) },
    createBridge: ({ send, state }) => ({
      start: async () => send({ type: 'status', status: 'connected' }),
      stop() {
        stopped++;
      },
      update: (next) => send({ type: 'state', state: next }),
      sendText: (text) => send({ type: 'echo', text }),
      sendAudio() {},
      endAudio() {},
    }),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    live,
    url: `ws://127.0.0.1:${server.address().port}/api/conversations/${randomUUID()}/live`,
    get stopped() {
      return stopped;
    },
    close: async () => {
      live.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
function rejected(url, origin) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { origin });
    ws.on('unexpected-response', (_req, response) => {
      response.resume();
      ws.terminate();
      resolve(response.statusCode);
    });
    ws.on('error', () => {});
    ws.on('open', () => {
      ws.close();
      reject(new Error('Unexpected connection'));
    });
  });
}
test('Live transport rejects untrusted origins and missing API keys before starting the provider', async () => {
  const f = await serverFixture();
  try {
    assert.equal(await rejected(f.url, 'https://untrusted.example'), 403);
  } finally {
    await f.close();
  }
  const g = await serverFixture('');
  try {
    assert.equal(await rejected(g.url, 'http://localhost:5173'), 503);
  } finally {
    await g.close();
  }
});
test('One Live connection per draft; closing releases the provider and reservation', async () => {
  const f = await serverFixture();
  let ws;
  try {
    ws = new WebSocket(f.url, { origin: 'http://localhost:5173' });
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
    assert.equal(await rejected(f.url, 'http://localhost:5173'), 409);
    const closed = new Promise((resolve) => ws.once('close', resolve));
    ws.close();
    await closed;
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(f.stopped, 1);
    ws = new WebSocket(f.url, { origin: 'http://localhost:5173' });
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });
  } finally {
    ws?.terminate();
    await f.close();
  }
});

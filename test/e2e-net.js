'use strict';

const assert = require('assert');
const { openSite } = require('./lib/site');

(async () => {
  const serverGot = [];
  const site = await openSite({
    initial: { settings: {} },
    extra: (page) =>
      page.routeWebSocket(/api\.yapper\.website\/realtime/, (ws) => {
        ws.onMessage((m) => serverGot.push(String(m)));
        setTimeout(() => ws.send(JSON.stringify({ type: 'event', event: 'message_insert', payload: { id: 'm1', content: 'hello' } })), 50);
        setTimeout(() => ws.send('not json'), 80);
      }),
  });
  const { page } = site;

  const postBodies = [];
  await page.route('**/rest/v1/messages**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST' || req.method() === 'PATCH') postBodies.push({ method: req.method(), body: req.postData() });
    await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });

  await page.goto('https://www.yapper.website/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.YapperMod && window.YapperMod.Store && window.YapperMod.Store.isReady, null, { timeout: 15000 });

  const result = await page.evaluate(async () => {
    const YM = window.YapperMod;
    const out = {};
    const events = [];
    YM.Events.on('ws:event', (name, payload) => events.push([name, payload]));
    YM.net.onWsSend((data) => {
      if (data.includes('DROPME')) return false;
      return data.replace('lower', 'LOWER');
    });
    YM.messageEvents.addPreSendListener((m) => {
      m.content = m.content.toUpperCase();
    });
    YM.messageEvents.addPreEditListener((m) => {
      m.content = m.content + ' (edited)';
    });

    const ws = new WebSocket('wss://api.yapper.website/realtime');
    out.instanceOfWebSocket = ws instanceof WebSocket;
    out.constants = [WebSocket.CONNECTING, WebSocket.OPEN, WebSocket.CLOSING, WebSocket.CLOSED];
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = () => rej(new Error('ws error'));
    });
    ws.send('lower case frame');
    ws.send('please DROPME');
    ws.send(JSON.stringify({ type: 'sub', note: 'lower' }));
    await new Promise((r) => setTimeout(r, 400));
    out.events = events;
    out.wsCounters = { opened: YM.net.wsOpened, in: YM.net.wsIn, out: YM.net.wsOut };

    await fetch('https://api.yapper.website/rest/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ channel_id: 'c1', content: 'hello world' }),
    });
    await fetch('https://api.yapper.website/rest/v1/messages?id=eq.1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: 'fixed' }),
    });

    await fetch('https://api.yapper.website/rest/v1/other', { method: 'POST', body: JSON.stringify({ content: 'x' }) });
    return out;
  });

  assert.strictEqual(result.instanceOfWebSocket, true);
  assert.deepStrictEqual(result.constants, [0, 1, 2, 3]);
  assert.deepStrictEqual(result.events, [['message_insert', { id: 'm1', content: 'hello' }]]);
  assert.deepStrictEqual(serverGot, ['LOWER case frame', JSON.stringify({ type: 'sub', note: 'LOWER' })]);
  assert.strictEqual(postBodies.length, 2);
  assert.strictEqual(JSON.parse(postBodies[0].body).content, 'HELLO WORLD');
  assert.strictEqual(JSON.parse(postBodies[1].body).content, 'fixed (edited)');
  console.log('net hooks ok', JSON.stringify(result.wsCounters));
  await site.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

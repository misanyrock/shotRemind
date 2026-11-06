import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { shoppingServer } from '../server/shopping.mjs';

test('two clients share purchase state, reject duplicate items, and keep changes after restart', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'shot-shopping-'));
  const file = join(folder, 'test.sqlite');
  let server;
  let base;
  async function start() {
    server = shoppingServer(file).listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = 'http://127.0.0.1:' + server.address().port;
  }
  async function stop() {
    if (!server?.listening) return;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  async function request(path, method = 'GET', code, body) {
    const response = await fetch(base + path, {
      method,
      headers: {
        ...(code && { Authorization: 'Bearer ' + code }),
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  }

  try {
    await start();
    const { status, data: { code } } = await request('/lists', 'POST');
    assert.equal(status, 200);
    assert.equal((await request('/list')).status, 401);
    assert.equal((await request('/list', 'GET', 'x'.repeat(24))).status, 404);
    const writes = await Promise.all([
      request('/list', 'POST', code, { name: '牛奶' }),
      request('/list', 'POST', code, { name: '鸡蛋' }),
    ]);
    assert(writes.every(result => result.status === 200));
    assert.equal((await request('/list', 'POST', code, { name: ' 牛奶 ' })).status, 409);
    const { data: secondPhone } = await request('/list', 'GET', code);
    assert.deepEqual(new Set(secondPhone.items.map(item => item.name)), new Set(['牛奶', '鸡蛋']));
    const milk = secondPhone.items.find(item => item.name === '牛奶');
    assert.equal((await request('/list/' + milk.id, 'PATCH', code, { bought: 'yes' })).status, 400);
    const { data: checked } = await request('/list/' + milk.id, 'PATCH', code, { bought: true });
    assert.equal(checked.revision, secondPhone.revision + 1);
    assert.deepEqual(checked.items.filter(item => !item.bought).map(item => item.name), ['鸡蛋']);
    assert.deepEqual((await request('/list', 'GET', code)).data, checked);
    await stop();
    await start();
    assert.deepEqual((await request('/list', 'GET', code)).data, checked);
  } finally {
    await stop();
    await rm(folder, { recursive: true, force: true });
  }
});

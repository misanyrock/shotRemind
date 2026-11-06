import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2048) fail(413, '请求内容过长');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    fail(400, '请求格式不正确');
  }
}

export function shoppingServer(filename) {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA busy_timeout = 5000; CREATE TABLE IF NOT EXISTS lists (code TEXT PRIMARY KEY, data TEXT NOT NULL)');
  const find = db.prepare('SELECT data FROM lists WHERE code = ?');
  const insert = db.prepare('INSERT INTO lists VALUES (?, ?)');
  const update = db.prepare('UPDATE lists SET data = ? WHERE code = ?');

  function load(code) {
    const row = find.get(code);
    if (!row) fail(404, '找不到这张清单，请核对邀请码');
    return JSON.parse(row.data);
  }

  async function route(request) {
    const { pathname } = new URL(request.url, 'http://localhost');
    const { method } = request;
    if (pathname === '/lists' && method === 'POST') {
      const code = randomBytes(18).toString('base64url');
      const snapshot = { revision: 0, items: [] };
      insert.run(code, JSON.stringify(snapshot));
      return { code, snapshot };
    }

    const path = pathname.match(/^\/list(?:\/([0-9a-f-]{36}))?$/);
    if (!path) fail(404, '找不到该接口');
    const code = request.headers.authorization?.match(/^Bearer ([\w-]{24})$/)?.[1];
    if (!code) fail(401, '请输入有效的邀请码');
    const id = path[1];
    if (method === 'GET' && !id) return load(code);
    if (!(method === 'POST' && !id) && !(['PATCH', 'DELETE'].includes(method) && id)) fail(405, '不支持的操作');
    const body = method !== 'DELETE' ? await readBody(request) : null;

    db.exec('BEGIN IMMEDIATE');
    try {
      const snapshot = load(code);
      const { items } = snapshot;
      if (method === 'POST') {
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        if (!name || name.length > 80) fail(400, '请输入 1 到 80 个字符的商品名');
        const key = name.normalize('NFKC').toLowerCase();
        if (items.some(item => item.name.normalize('NFKC').toLowerCase() === key)) {
          fail(409, '该商品已在清单里。若已勾选，可以在「已买」中恢复。');
        }
        if (items.length >= 300) fail(409, '清单已满，请先删除一些商品');
        items.push({ id: randomUUID(), name, bought: false });
      } else {
        const index = items.findIndex(item => item.id === id);
        if (index === -1) fail(404, '这件商品已被移除');
        if (method === 'DELETE') items.splice(index, 1);
        else {
          if (typeof body?.bought !== 'boolean') fail(400, '需要明确的购买状态');
          items[index].bought = body.bought;
        }
      }
      snapshot.revision++;
      update.run(JSON.stringify(snapshot), code);
      db.exec('COMMIT');
      return snapshot;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  const server = createServer({ requestTimeout: 15_000 }, async (request, response) => {
    let data;
    try {
      data = await route(request);
    } catch (error) {
      response.statusCode = error.status ?? 500;
      if (response.statusCode === 500) console.error(error);
      data = { error: error.status ? error.message : '清单服务暂不可用' };
    }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify(data));
  });
  server.once('close', () => db.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 8787);
  shoppingServer(process.env.SHOPPING_DB ?? 'shopping.sqlite').listen(port, process.env.HOST ?? '127.0.0.1', () => {
    console.log(`Shopping list service listening on port ${port}`);
  });
}

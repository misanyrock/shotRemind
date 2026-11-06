export type ShoppingItem = { id: string; name: string; bought: boolean };
export type ShoppingSnapshot = { revision: number; items: ShoppingItem[] };
export type ShoppingSession = { code: string; snapshot: ShoppingSnapshot };

const address = process.env.EXPO_PUBLIC_SHOPPING_API_URL?.trim().replace(/\/+$/, '');
function isHttpsAddress(value?: string) {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}
export const shoppingConfigured = isHttpsAddress(address);
export const invitePattern = /^[\w-]{24}$/;

function isSnapshot(value: unknown): value is ShoppingSnapshot {
  const list = value as Partial<ShoppingSnapshot> | null;
  return !!list && typeof list.revision === 'number' && Number.isSafeInteger(list.revision) && list.revision >= 0
    && Array.isArray(list.items) && list.items.every(item => item
      && typeof item.id === 'string' && /^[0-9a-f-]{36}$/.test(item.id)
      && typeof item.name === 'string' && typeof item.bought === 'boolean');
}

export function isShoppingSession(value: unknown): value is ShoppingSession {
  const session = value as Partial<ShoppingSession> | null;
  return !!session && typeof session.code === 'string' && invitePattern.test(session.code) && isSnapshot(session.snapshot);
}

async function shoppingRequest(
  path: string, method = 'GET', code?: string, body?: object,
): Promise<unknown> {
  if (!shoppingConfigured) throw new Error('采购清单服务尚未配置。');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(address + path, {
      method,
      signal: controller.signal,
      headers: {
        ...(code && { Authorization: `Bearer ${code}` }),
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : '清单服务暂不可用。');
    return data;
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError || controller.signal.aborted) {
      throw new Error('无法连接清单服务，请检查网络后重试。');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function createShoppingSession() {
  const data = await shoppingRequest('/lists', 'POST');
  if (!isShoppingSession(data)) throw new Error('清单服务返回了无效的清单。');
  return data;
}

export async function requestShoppingList(code: string, path = '/list', method = 'GET', body?: object) {
  const data = await shoppingRequest(path, method, code, body);
  if (!isSnapshot(data)) throw new Error('清单服务返回了无效的清单。');
  return data;
}

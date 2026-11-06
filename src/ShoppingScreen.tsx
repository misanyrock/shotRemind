import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createShoppingSession, invitePattern, isShoppingSession, requestShoppingList, shoppingConfigured,
  type ShoppingItem, type ShoppingSession, type ShoppingSnapshot } from './shopping';
import { styles as s, ToolButton, ToolSheet } from './toolSheet';
import { colors, Icon } from './visuals';

const key = 'shot-remind/shopping-v1';

export function ShoppingScreen({ onClose }: { onClose: () => void }) {
  const [session, setSession] = useState<ShoppingSession>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState<'checking' | 'online' | 'offline'>('checking');
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');
  const [bought, setBought] = useState(false);
  const lock = useRef(false);
  const latest = useRef<ShoppingSession | undefined>(undefined);
  const writes = useRef(Promise.resolve());
  const code = session?.code;
  const inviteCode = invite.trim().split(/\s+/).pop() ?? '';

  function remember(next?: ShoppingSession) {
    const write = writes.current.catch(() => {}).then(() => next
      ? AsyncStorage.setItem(key, JSON.stringify(next))
      : AsyncStorage.removeItem(key));
    writes.current = write;
    return write;
  }

  function applySnapshot(code: string, snapshot: ShoppingSnapshot) {
    if (latest.current?.code !== code || latest.current.snapshot.revision >= snapshot.revision) return;
    const next = { code, snapshot };
    latest.current = next;
    setSession(next);
    void remember(next).catch(() => {});
  }

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(key).then(value => {
      if (mounted && value) {
        const saved: unknown = JSON.parse(value);
        if (!isShoppingSession(saved)) throw new Error('无效的缓存');
        latest.current = saved;
        setSession(saved);
      }
    }).catch(() => {
      if (mounted) Alert.alert('无法读取清单缓存');
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!code || !shoppingConfigured) return;
    let mounted = true;
    let refreshing = false;
    async function refresh() {
      if (!code || refreshing || AppState.currentState === 'background') return;
      refreshing = true;
      try {
        const snapshot = await requestShoppingList(code);
        if (mounted) {
          applySnapshot(code, snapshot);
          setSync('online');
        }
      } catch {
        if (mounted) setSync('offline');
      } finally {
        refreshing = false;
      }
    }
    void refresh();
    const timer = setInterval(refresh, 4_000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => {
      mounted = false;
      clearInterval(timer);
      listener.remove();
    };
  }, [code]);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try { await action(); }
    catch (error) { Alert.alert('操作未完成', error instanceof Error ? error.message : '请稍后重试。'); }
    finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function connect(join: boolean) {
    void run(async () => {
      const next = join
        ? { code: inviteCode, snapshot: await requestShoppingList(inviteCode) }
        : await createShoppingSession();
      await remember(next);
      latest.current = next;
      setSession(next);
      setSync('online');
      setBought(false);
      setInvite('');
    });
  }

  function change(path: string, method: string, body?: object) {
    if (!code || sync !== 'online') return;
    void run(async () => {
      const snapshot = await requestShoppingList(code, path, method, body);
      applySnapshot(code, snapshot);
      if (method === 'POST') setName('');
    });
  }

  function confirmRemove(item: ShoppingItem) {
    Alert.alert('移除商品？', item.name, [
      { text: '取消', style: 'cancel' },
      { text: '移除', style: 'destructive', onPress: () => change('/list/' + item.id, 'DELETE') },
    ]);
  }

  function leave() {
    Alert.alert('离开共享清单？', '当前设备将退出，其他成员仍可使用这张清单。', [
      { text: '取消', style: 'cancel' },
      { text: '离开', style: 'destructive', onPress: () => void run(async () => {
        const previous = latest.current;
        latest.current = undefined;
        try { await remember(); }
        catch (error) {
          latest.current = previous;
          throw error;
        }
        setSession(undefined);
        setSync('checking');
      }) },
    ]);
  }

  const items = session?.snapshot.items ?? [];
  const remaining = items.filter(item => !item.bought).length;
  const unavailable = busy || sync !== 'online' || !shoppingConfigured;
  return (
    <ToolSheet title="家庭采购清单" busy={busy} back={() => { if (!lock.current) onClose(); }}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {loading ? <ActivityIndicator color={colors.lime} /> : !session ? <>
          <Text style={s.caption}>{shoppingConfigured ? '创建清单后，把邀请码发给家人。你们的添加和勾选会同步。' : '共享服务尚未配置，连接服务后即可创建或加入清单。'}</Text>
          <ToolButton label="创建共享清单" disabled={busy || !shoppingConfigured} onPress={() => connect(false)} />
          <TextInput style={s.input} accessibilityLabel="邀请码" placeholder="粘贴邀请码或邀请消息" placeholderTextColor={colors.muted}
            value={invite} onChangeText={setInvite} autoCapitalize="none" autoCorrect={false} editable={!busy && shoppingConfigured} />
          <ToolButton label="加入清单" secondary disabled={busy || !shoppingConfigured || !invitePattern.test(inviteCode)} onPress={() => connect(true)} />
        </> : <>
          <Text accessibilityLiveRegion="polite" style={s.caption}>{sync === 'online' ? '已连接 · 自动同步'
            : sync === 'checking' && shoppingConfigured ? '正在同步 · 显示上次记录' : '暂时离线 · 显示上次记录'}</Text>
          <View style={s.row}>
            <Pressable style={s.card} accessibilityRole="tab" accessibilityState={{ selected: !bought }} onPress={() => setBought(false)}>
              <Text style={[s.text, !bought && { color: colors.lime }]}>未买 {remaining}</Text>
            </Pressable>
            <Pressable style={s.card} accessibilityRole="tab" accessibilityState={{ selected: bought }} onPress={() => setBought(true)}>
              <Text style={[s.text, bought && { color: colors.lime }]}>已买 {items.length - remaining}</Text>
            </Pressable>
          </View>
          {items.filter(item => item.bought === bought).map(item => (
            <View key={item.id} style={[s.card, s.row]}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: item.bought }} style={[s.row, { flex: 1, minHeight: 44 }]}
                disabled={unavailable} onPress={() => change('/list/' + item.id, 'PATCH', { bought: !item.bought })}>
                <Icon name={item.bought ? 'done' : 'unchecked'} size={21} color={item.bought ? colors.lime : colors.muted} />
                <Text style={[s.text, { flex: 1 }]}>{item.name}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`移除${item.name}`} style={s.iconButton} disabled={unavailable} onPress={() => confirmRemove(item)}>
                <Icon name="close" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))}
          {(bought ? items.length === remaining : remaining === 0) && <Text style={s.caption}>{bought ? '还没有勾选商品。' : '没有未买商品。'}</Text>}
          <ToolButton secondary label="邀请家人" disabled={busy} onPress={() => {
            void Share.share({ message: `打开「截个提醒」的家庭采购清单，输入邀请码加入：\n${session.code}` })
              .catch(() => Alert.alert('无法打开分享面板', session.code));
          }} />
          <ToolButton secondary label="离开清单" disabled={busy} onPress={leave} />
        </>}
      </ScrollView>
      {!!session && !bought && <View style={[s.footer, s.row]}>
        <TextInput style={[s.input, { flex: 1 }]} accessibilityLabel="商品名" placeholder="添加要买的东西" placeholderTextColor={colors.muted}
          value={name} onChangeText={setName} maxLength={80} editable={!unavailable}
          returnKeyType="done" onSubmitEditing={() => { if (name.trim()) change('/list', 'POST', { name }); }} />
        <ToolButton label="添加" disabled={unavailable || !name.trim()} onPress={() => change('/list', 'POST', { name })} />
      </View>}
    </ToolSheet>
  );
}

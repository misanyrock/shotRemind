import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { anniversaryDate, anniversaryDistance, calendarDay, dateForPicker, type Anniversary } from './anniversaries';
import { styles as s, ToolButton, ToolSheet } from './toolSheet';
import { colors, Icon } from './visuals';

const storageKey = 'shot-remind/anniversaries-v1';
type Draft = Pick<Anniversary, 'title' | 'day'> & { id?: string };

export function AnniversariesScreen({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<Anniversary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [draft, setDraft] = useState<Draft>();
  const [today, setToday] = useState(() => calendarDay(new Date()));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  async function load() {
    setStatus('loading');
    try {
      const saved = await AsyncStorage.getItem(storageKey);
      const data: unknown = saved === null ? [] : JSON.parse(saved);
      if (!Array.isArray(data) || !data.every(item => item && typeof item.id === 'string'
        && typeof item.title === 'string' && Number.isInteger(item.day) && Math.abs(item.day) <= 100_000_000)) {
        throw new Error('无效的纪念日记录');
      }
      setEvents(data);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function refresh() {
      clearTimeout(timer);
      const now = new Date();
      setToday(calendarDay(now));
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 100);
    }
    refresh();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, []);

  function back() {
    if (lock.current) return;
    if (picking) setPicking(false);
    else if (draft) setDraft(undefined);
    else onClose();
  }

  async function persist(next: Anniversary[], errorTitle: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(next));
      setEvents(next);
      setPicking(false);
      setDraft(undefined);
    } catch {
      Alert.alert(errorTitle, '请稍后重试。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function save() {
    const title = draft?.title.trim();
    if (!draft || !title || !Number.isInteger(draft.day)) return;
    const entry = { id: draft.id ?? Date.now() + '-' + Math.random().toString(36).slice(2, 9), title, day: draft.day };
    const next = draft.id ? events.map(event => event.id === draft.id ? entry : event) : [...events, entry];
    void persist(next, '纪念日未保存');
  }

  function remove(id: string) {
    Alert.alert('删除这个纪念日？', '这条记录会从当前设备移除。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void persist(events.filter(event => event.id !== id), '无法删除纪念日') },
    ]);
  }

  const sections = [
    { label: '今天及未来', items: events.filter(event => event.day >= today).sort((a, b) => a.day - b.day) },
    { label: '已经过去', items: events.filter(event => event.day < today).sort((a, b) => b.day - a.day) },
  ];

  return (
    <ToolSheet title={draft ? (draft.id ? '编辑纪念日' : '新建纪念日') : '纪念日'} back={back} busy={busy}>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {draft ? <>
          <Text style={s.caption}>事件名称</Text>
          <TextInput style={s.input} accessibilityLabel="事件名称" value={draft.title} maxLength={80}
            placeholder="例如：搬进新家、家庭旅行" placeholderTextColor={colors.muted} editable={!busy}
            onChangeText={title => setDraft(current => current && { ...current, title })} />
          <Text style={s.caption}>事件日期</Text>
          <Pressable style={[s.card, s.row]} accessibilityRole="button" accessibilityLabel={`选择事件日期，${anniversaryDate(draft.day)}`}
            disabled={busy} onPress={() => { Keyboard.dismiss(); setPicking(true); }}>
            <Icon name="calendar" size={20} color={colors.lime} />
            <Text style={s.text}>{anniversaryDate(draft.day)}</Text>
          </Pressable>
          {picking && <>
            <DateTimePicker value={dateForPicker(draft.day)} mode="date" themeVariant="dark"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'} disabled={busy}
              onValueChange={(_event, date) => {
                if (Platform.OS !== 'ios') setPicking(false);
                if (date) setDraft(current => current && { ...current, day: calendarDay(date) });
              }} onDismiss={() => setPicking(false)} />
            {Platform.OS === 'ios' && <ToolButton label="确定日期" secondary disabled={busy} onPress={() => setPicking(false)} />}
          </>}
          <Text style={s.caption}>{anniversaryDistance(draft.day, today)}</Text>
          {draft.id && <ToolButton label="删除纪念日" secondary disabled={busy} onPress={() => { if (draft.id) remove(draft.id); }} />}
        </> : status === 'loading' ? <ActivityIndicator color={colors.lime} />
          : status === 'error' ? <ToolButton label="读取失败，轻点重试" secondary onPress={load} />
          : events.length === 0 ? <View style={s.card}>
            <Text style={s.text}>还没有纪念日</Text>
            <Text style={s.caption}>记下一个重要日子，看看已经过去多久，或者还有多久到来。</Text>
          </View> : sections.map(({ label, items }) => items.length > 0 && (
            <View key={label} style={{ gap: 8 }}>
              <Text style={s.caption} accessibilityRole="header">{label}</Text>
              {items.map(event => (
                <Pressable key={event.id} style={[s.card, s.row]} accessibilityRole="button" onPress={() => setDraft(event)}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={s.text}>{event.title}</Text>
                    <Text style={s.caption}>{anniversaryDate(event.day)}</Text>
                    <Text style={[s.text, { color: colors.lime }]}>{anniversaryDistance(event.day, today)}</Text>
                  </View>
                  <Icon name="chevron" size={18} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          ))}
      </ScrollView>
      {status === 'ready' && <View style={s.footer}>
        <ToolButton label={draft ? '保存纪念日' : '新建纪念日'} disabled={busy || (!!draft && !draft.title.trim())}
          onPress={draft ? save : () => setDraft({ title: '', day: today })} />
      </View>}
    </ToolSheet>
  );
}

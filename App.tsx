import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, BackHandler, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import ShotOcr from './modules/shot-ocr';
import { AnniversariesScreen } from './src/AnniversariesScreen';
import { ItemsScreen } from './src/ItemsScreen';
import { ModalSafeAreaView } from './src/ModalSafeAreaView';
import { PacketsScreen } from './src/PacketsScreen';
import { PrivacyScreen } from './src/PrivacyScreen';
import { ShoppingScreen } from './src/ShoppingScreen';
import { singleSharedImage } from './src/incomingShare';
import { dateLabel, extractSuggestions, nextHour, timeLabel, type Suggestion } from './src/recognize';
import {
  createReminder, finishReminder, imageUri, loadReminders, ReminderPermissionError,
  sampleText, type Draft, type Reminder,
} from './src/reminders';
import { colors, Icon, ScannerIllustration } from './src/visuals';

type Page = { kind: 'home' } | { kind: 'edit' } | { kind: 'detail'; id: string };
type Filter = 'active' | 'completed';
type Screenshot = { imageUri: string; imageExtension?: string };

function removeSharedCopy(file: File) {
  try { if (file.exists) file.delete(); } catch {}
}

function SourcePreview({ uri, sample, onPress }: { uri?: string; sample?: boolean; onPress?: () => void }) {
  if (!uri && !sample) return null;
  return (
    <Pressable style={s.source} onPress={onPress} accessibilityRole="button" accessibilityLabel="查看原图">
      {uri ? <Image source={{ uri }} style={s.thumb} /> : <View style={[s.thumb, s.center]}><Icon name="image" color={colors.lime} /></View>}
      <View style={s.flex}>
        <Text style={s.cardTitle}>{sample ? '群通知示例' : '原始截图'}</Text>
        <Text style={s.caption}>轻点查看{sample ? '示例内容' : '完整图片'}</Text>
      </View>
      <Icon name="chevron" color={colors.muted} size={18} />
    </Pressable>
  );
}

function Button({ label, onPress, icon, disabled }: {
  label: string; onPress: () => void; icon: 'plus' | 'image' | 'check'; disabled?: boolean;
}) {
  return (
    <Pressable disabled={disabled} accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [s.primary, (disabled || pressed) && s.dim]}>
      {disabled ? <ActivityIndicator color={colors.ink} /> : <Icon name={icon} color={colors.ink} />}
      <Text style={s.primaryText}>{label}</Text>
    </Pressable>
  );
}

function ScreenHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <View style={s.screenHeader}>
      <Pressable style={s.iconButton} accessibilityRole="button" accessibilityLabel="返回提醒列表" onPress={onBack}>
        <Icon name="back" />
      </Pressable>
      <Text style={s.kicker}>{label}</Text>
    </View>
  );
}

export default function App() {
  return <SafeAreaProvider><StatusBar style="light" /><ReminderApp /></SafeAreaProvider>;
}

function ReminderApp() {
  const [page, setPage] = useState<Page>({ kind: 'home' });
  const [filter, setFilter] = useState<Filter>('active');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [draft, setDraft] = useState<Draft>({ title: '', date: nextHour(), text: '' });
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState('');
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [preview, setPreview] = useState<{ uri?: string; sample?: boolean } | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [tool, setTool] = useState<'privacy' | 'items' | 'shopping' | 'packets' | 'anniversaries'>();
  const [sharedImages, setSharedImages] = useState<File[]>([]);
  const [sharedDraft, setSharedDraft] = useState<File>();
  const draftCopy = page.kind === 'edit' && draft.imageUri === sharedDraft?.uri ? sharedDraft : undefined;

  useEffect(() => () => { if (draftCopy) removeSharedCopy(draftCopy); }, [draftCopy]);

  useEffect(() => {
    if (page.kind === 'home') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!lock.current) {
        setPicker(null);
        setPage({ kind: 'home' });
      }
      return true;
    });
    return () => subscription.remove();
  }, [page.kind]);

  async function load() {
    setLoading(true);
    setLoadError(false);
    try { setReminders(await loadReminders()); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    void load();
    function openNotification(response: Notifications.NotificationResponse) {
      const id = response.notification.request.content.data?.reminderId;
      if (typeof id === 'string') setOpenedId(id);
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(openNotification);
    const last = Notifications.getLastNotificationResponse();
    if (last) openNotification(last);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let mounted = true;
    async function readIncomingShare() {
      // Read only raw payloads so links never trigger remote resolution.
      const sharing = await import('expo-sharing').catch(() => null);
      if (!mounted || !sharing) return;
      let payloads;
      try {
        payloads = sharing.getSharedPayloads();
        if (!payloads.length) return;
        sharing.clearSharedPayloads();
      } catch {
        return;
      }

      let destination: File | undefined;
      try {
        const containers = Platform.OS === 'ios'
          ? Object.values(Paths.appleSharedContainers).map(directory => directory.uri) : [];
        const image = singleSharedImage(payloads, Platform.OS, containers);
        if (!image) {
          Alert.alert('请选择一张图片', '请从系统分享菜单分享一张截图。');
          return;
        }
        const source = new File(image.value);
        const extension = image.value.match(/\.([a-z0-9]{2,5})$/i)?.[1]
          ?? image.mimeType?.match(/^image\/([a-z0-9]{2,5})$/i)?.[1] ?? 'jpg';
        const copy = new File(Paths.cache, `shared-shot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${extension}`);
        destination = copy;
        if (Platform.OS === 'ios') await source.move(copy);
        else await source.copy(copy);
        await Image.getSize(copy.uri);
        if (mounted) setSharedImages(images => [...images, copy]);
        else removeSharedCopy(copy);
      } catch {
        if (destination) removeSharedCopy(destination);
        if (mounted) Alert.alert('无法读取分享的图片', '请尝试从相册重新分享这张截图。');
      }
    }
    const links = Linking.addEventListener('url', ({ url }) => {
      if (/^shotremind:\/\/expo-sharing\/?$/.test(url)) void readIncomingShare();
    });
    const state = AppState.addEventListener('change', next => {
      if (next === 'active') void readIncomingShare();
    });
    void readIncomingShare();
    return () => {
      mounted = false;
      links.remove();
      state.remove();
    };
  }, []);

  useEffect(() => {
    if (loading || loadError || busy || tool || preview || page.kind === 'edit' || lock.current) return;
    const [image] = sharedImages;
    if (!image) return;
    lock.current = true;
    setBusy(true);
    setSharedImages(images => images.slice(1));
    void recognizeScreenshot({ imageUri: image.uri, imageExtension: image.extension.slice(1) }).then(() => {
      setSharedDraft(image);
    }).catch(() => {
      removeSharedCopy(image);
      Alert.alert('无法打开截图', '请重新分享这张截图。');
    }).finally(() => {
      lock.current = false;
      setBusy(false);
    });
  }, [busy, loading, loadError, page.kind, preview, sharedImages, tool]);

  useEffect(() => {
    if (loading || loadError || !openedId || busy || tool || preview || page.kind === 'edit' || sharedImages.length || lock.current) return;
    if (reminders.some(item => item.id === openedId)) setPage({ kind: 'detail', id: openedId });
    else Alert.alert('找不到提醒', '这条提醒可能已被删除。');
    setOpenedId(null);
    Notifications.clearLastNotificationResponse();
  }, [busy, loading, loadError, openedId, page.kind, preview, tool, reminders, sharedImages.length]);

  function goHome() {
    setPicker(null);
    setPage({ kind: 'home' });
  }

  function startDraft(source: Partial<Draft>, message = '') {
    const candidates = source.text ? extractSuggestions(source.text) : [];
    const first = candidates[0];
    setSuggestions(candidates);
    setSelected(0);
    setNotice(message);
    setPicker(null);
    setDraft({ ...source, title: first?.title ?? '', date: first?.date ?? nextHour(), text: source.text ?? '' });
    setPage({ kind: 'edit' });
  }

  async function recognizeScreenshot(source: Screenshot) {
    try {
      const recognized = (await ShotOcr?.recognize(source.imageUri))?.trim();
      startDraft({ ...source, text: recognized ?? '' }, recognized ? '' : '没有识别到文字，你可以手动填写。');
    } catch {
      startDraft(source, '截图识别失败，你可以手动填写。');
    }
  }

  async function importScreenshot() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      await recognizeScreenshot({ imageUri: asset.uri, imageExtension: asset.fileName?.split('.').pop() ?? asset.uri.split('.').pop() });
    } catch {
      Alert.alert('无法打开相册', '请检查相册访问权限后重试。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      setReminders(await createReminder(draft, reminders));
      setFilter('active');
      goHome();
    } catch (error) {
      if (error instanceof ReminderPermissionError) {
        Alert.alert('需要系统权限', error.message, [
          { text: '稍后', style: 'cancel' },
          { text: '打开设置', onPress: () => {
            try {
              if (error.kind === 'alarm' && ShotOcr?.openExactAlarmSettings) {
                ShotOcr.openExactAlarmSettings();
                return;
              }
            } catch {}
            Linking.openSettings().catch(() => Alert.alert('无法打开设置'));
          } },
        ]);
      } else {
        Alert.alert('提醒未保存', error instanceof Error && /[\u4e00-\u9fff]/.test(error.message)
          ? error.message : '请检查时间与设备权限后重试。');
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function finish(reminder: Reminder, remove: boolean) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      setReminders(await finishReminder(reminder, reminders, remove));
      goHome();
    } catch {
      Alert.alert('操作失败', '请稍后重试。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const detail = page.kind === 'detail' ? reminders.find(item => item.id === page.id) : undefined;
  const detailUri = detail?.imageName ? imageUri(detail.imageName) : undefined;
  const visible = reminders.filter(item => item.completed === (filter === 'completed'))
    .sort((a, b) => filter === 'active' ? a.date - b.date : b.date - a.date);
  const candidate = suggestions[selected];
  const activeCount = reminders.filter(item => !item.completed).length;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.frame} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {page.kind === 'home' && <>
          <View style={s.top}>
            <View style={s.brand}>
              <View style={s.brandIcon}><Icon name="scan" size={20} color={colors.ink} /></View>
              <Text style={s.brandText}>截个提醒</Text>
            </View>
            <View style={s.privacy}><Icon name="shield" size={14} color={colors.muted} /><Text style={s.privacyText}>本地识别</Text></View>
          </View>
          <ScrollView contentContainerStyle={s.homeBody} showsVerticalScrollIndicator={false}>
            {filter === 'active' && <>
              <View style={s.hero}>
                <View style={s.heroArt}><ScannerIllustration /></View>
                <Text style={s.heroKicker}>SCREENSHOT → REMINDER</Text>
                <Text accessibilityRole="header" style={s.heroTitle}>截一下，{ '\n' }记得住。</Text>
                <Text style={s.heroCaption}>从截图里提取事项和时间</Text>
                <Pressable disabled={busy || loading || loadError} onPress={importScreenshot} accessibilityRole="button"
                  style={({ pressed }) => [s.heroAction, (pressed || busy || loading || loadError) && s.dim]}>
                  {busy ? <ActivityIndicator color={colors.lime} /> : <Icon name="image" size={20} color={colors.lime} />}
                  <Text style={s.heroActionText}>{busy ? '正在读取截图…' : '选择截图'}</Text>
                  <Icon name="arrow" size={18} color={colors.lime} />
                </Pressable>
              </View>
              <View style={s.quick}>
                <Pressable disabled={loading || loadError || busy} style={s.quickButton} accessibilityRole="button" onPress={() => startDraft({})}>
                  <Icon name="plus" color={colors.lime} size={18} /><Text style={s.quickText}>手动添加</Text>
                </Pressable>
                <Pressable disabled={loading || loadError || busy} style={s.quickButton} accessibilityRole="button" onPress={() => startDraft({ text: sampleText, sample: true })}>
                  <Icon name="play" color={colors.lime} size={17} /><Text style={s.quickText}>体验示例</Text>
                </Pressable>
              </View>
            </>}
            {([
              ['privacy', 'shield', '发图前遮隐私', '遮住手机号、地址和姓名再分享'],
              ['items', 'box', '家里东西放哪了', '拍照记下位置，下次按名字找'],
              ['shopping', 'cart', '家庭采购清单', '和家人共享，进超市先看未买'],
              ['packets', 'folder', '出门办事资料包', '把材料、地址和预约截图放在一起'],
              ['anniversaries', 'calendar', '纪念日', '记下重要日子，查看已过天数或倒计时'],
            ] as const).map(([key, icon, title, caption]) => (
              <Pressable key={key} style={[s.source, s.toolEntry]} accessibilityRole="button" disabled={busy}
                onPress={() => setTool(key)}>
                <View style={s.emptyIcon}><Icon name={icon} color={colors.lime} size={20} /></View>
                <View style={s.flex}>
                  <Text style={s.cardTitle}>{title}</Text>
                  <Text style={s.caption}>{caption}</Text>
                </View>
                <Icon name="chevron" color={colors.muted} size={18} />
              </Pressable>
            ))}
            <View style={s.sectionHeader}>
              <Text accessibilityRole="header" style={s.sectionTitle}>{filter === 'active' ? '待办提醒' : '已完成'}</Text>
              <Text style={s.count}>{String(visible.length).padStart(2, '0')}</Text>
            </View>
            {loading ? <ActivityIndicator color={colors.lime} /> : loadError ?
              <Pressable onPress={load} style={s.empty} accessibilityRole="button">
                <Text style={s.cardTitle}>读取失败，轻点重试</Text>
              </Pressable> : visible.length === 0 ?
              <View style={s.empty}>
                <View style={s.emptyIcon}><Icon name={filter === 'active' ? 'bell' : 'done'} color={colors.lime} size={21} /></View>
                <Text style={s.cardTitle}>{filter === 'active' ? '还没有待办提醒' : '还没有完成的提醒'}</Text>
                <Text style={s.caption}>{filter === 'active' ? '群通知、预约、缴费、取件，都可以截图记下。' : '标为完成的事项会出现在这里。'}</Text>
              </View> :
              visible.map(item => {
                const date = new Date(item.date);
                const overdue = !item.completed && item.date <= Date.now();
                return (
                  <Pressable key={item.id} onPress={() => setPage({ kind: 'detail', id: item.id })} accessibilityRole="button" style={s.reminder}>
                    <View style={s.emptyIcon}><Icon name={item.completed ? 'done' : item.imageName || item.sample ? 'image' : 'bell'} color={colors.lime} size={19} /></View>
                    <View style={s.flex}>
                      <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={[s.caption, overdue && s.warning]}>{dateLabel(date)} · {timeLabel(date)}{overdue ? ' · 已到期' : ''}</Text>
                    </View>
                    <Icon name="chevron" color={colors.muted} size={18} />
                  </Pressable>
                );
              })}
          </ScrollView>
          <View style={s.tabs}>
            {(['active', 'completed'] as const).map(tab => (
              <Pressable key={tab} style={s.tab} onPress={() => setFilter(tab)} accessibilityRole="tab" accessibilityState={{ selected: tab === filter }}>
                <Icon name={tab === 'active' ? 'bell' : 'done'} size={20} color={tab === filter ? colors.lime : colors.muted} />
                <Text style={[s.tabText, tab === filter && s.active]}>{tab === 'active' ? `待办${activeCount ? ' ' + activeCount : ''}` : '已完成'}</Text>
              </Pressable>
            ))}
          </View>
        </>}

        {page.kind === 'edit' && <>
          <ScreenHeader label="创建提醒" onBack={busy ? () => {} : goHome} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.inner}>
            <Text accessibilityRole="header" style={s.heading}>确认提醒</Text>
            {sharedImages.length > 0 && <Text style={s.caption}>收到新的分享截图，完成当前提醒后会打开。</Text>}
            <Text style={s.caption}>{notice || (candidate?.date
              ? '请核对识别结果。明天、下周等日期以导入当天为基准。'
              : draft.text ? '未识别到明确日期，请选择提醒时间。' : '填写事项和时间，到点会收到通知。')}</Text>
            <SourcePreview uri={draft.imageUri} sample={draft.sample} onPress={() => setPreview({ uri: draft.imageUri, sample: draft.sample })} />
            {suggestions.length > 1 && <View style={s.field}>
              <Text style={s.fieldLabel}>识别到多条时间</Text>
              {suggestions.map((item, index) => (
                <Pressable key={index} accessibilityRole="button" accessibilityState={{ selected: selected === index }} style={[s.choice, selected === index && s.choiceSelected]}
                  onPress={() => {
                    setSelected(index);
                    setDraft(value => ({ ...value, title: item.title, date: item.date ?? nextHour() }));
                  }}>
                  <Text style={s.cardTitle} numberOfLines={2}>{item.source}</Text>
                </Pressable>
              ))}
            </View>}
            <View style={s.field}>
              <Text style={s.fieldLabel}>提醒事项</Text>
              <TextInput accessibilityLabel="提醒事项" style={s.input} placeholder="例如：提交项目材料" placeholderTextColor={colors.muted}
                value={draft.title} onChangeText={title => setDraft(value => ({ ...value, title }))} maxLength={80} editable={!busy} />
            </View>
            <View style={s.field}>
              <Text style={s.fieldLabel}>提醒时间</Text>
              <View style={s.dateRow}>
                <Pressable style={s.dateButton} accessibilityRole="button" accessibilityLabel="选择日期" onPress={() => setPicker('date')}>
                  <Icon name="calendar" size={19} color={colors.lime} /><Text style={s.cardTitle}>{draft.date.getFullYear()}年{dateLabel(draft.date)}</Text>
                </Pressable>
                <Pressable style={s.dateButton} accessibilityRole="button" accessibilityLabel="选择时间" onPress={() => setPicker('time')}>
                  <Icon name="clock" size={19} color={colors.lime} /><Text style={s.cardTitle}>{timeLabel(draft.date)}</Text>
                </Pressable>
              </View>
              {candidate?.date && !candidate.hasTime && <Text style={s.caption}>原文仅识别到日期，已预填 09:00。</Text>}
              {draft.date.getTime() <= Date.now() && <Text style={[s.caption, s.warning]}>这个时间已过，请调整后保存。</Text>}
              {picker && <>
                <DateTimePicker value={draft.date} mode={picker} is24Hour themeVariant="dark"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onValueChange={(_event, value) => {
                    if (Platform.OS !== 'ios') setPicker(null);
                    if (!value) return;
                    setDraft(current => {
                      const date = new Date(current.date);
                      if (picker === 'date') date.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
                      else date.setHours(value.getHours(), value.getMinutes(), 0, 0);
                      return { ...current, date };
                    });
                  }}
                  onDismiss={() => setPicker(null)}
                />
                {Platform.OS === 'ios' && <Pressable style={s.quickButton} accessibilityRole="button" onPress={() => setPicker(null)}><Text style={s.active}>确定</Text></Pressable>}
              </>}
            </View>
            {!!draft.text && <View style={s.field}>
              <Text style={s.fieldLabel}>识别文字</Text>
              <Text selectable style={s.ocr}>{draft.text}</Text>
            </View>}
          </ScrollView>
          <View style={s.footer}><Button label="保存提醒" icon="check" onPress={save} disabled={busy} /></View>
        </>}

        {detail && <>
          <ScreenHeader label={detail.completed ? '已完成' : '提醒详情'} onBack={busy ? () => {} : goHome} />
          <ScrollView contentContainerStyle={s.inner}>
            <Text accessibilityRole="header" style={s.heading}>{detail.title}</Text>
            <View style={s.source}><Icon name="clock" color={colors.lime} /><Text style={s.cardTitle}>{new Date(detail.date).getFullYear()}年{dateLabel(new Date(detail.date))} · {timeLabel(new Date(detail.date))}</Text></View>
            <SourcePreview uri={detailUri} sample={detail.sample} onPress={() => setPreview({ uri: detailUri, sample: detail.sample })} />
            {!!detail.text && <View style={s.field}><Text style={s.fieldLabel}>识别文字</Text><Text selectable style={s.ocr}>{detail.text}</Text></View>}
          </ScrollView>
          <View style={s.footer}>
            {!detail.completed && <Button label="标为完成" icon="check" disabled={busy} onPress={() => finish(detail, false)} />}
            <Pressable style={s.deleteButton} accessibilityRole="button" disabled={busy} onPress={() => Alert.alert('删除提醒？', '此操作会移除这条提醒和保存在应用内的截图。', [
              { text: '取消', style: 'cancel' },
              { text: '删除', style: 'destructive', onPress: () => finish(detail, true) },
            ])}><Text style={s.deleteText}>删除提醒</Text></Pressable>
          </View>
        </>}
      </KeyboardAvoidingView>
      {tool === 'privacy' && <PrivacyScreen onClose={() => setTool(undefined)} />}
      {tool === 'items' && <ItemsScreen onClose={() => setTool(undefined)} />}
      {tool === 'shopping' && <ShoppingScreen onClose={() => setTool(undefined)} />}
      {tool === 'packets' && <PacketsScreen onClose={() => setTool(undefined)} />}
      {tool === 'anniversaries' && <AnniversariesScreen onClose={() => setTool(undefined)} />}
      <Modal visible={Boolean(preview)} animationType="fade" onRequestClose={() => setPreview(null)}>
        <ModalSafeAreaView style={s.safe}>
          <View style={s.screenHeader}>
            <Pressable style={s.iconButton} accessibilityRole="button" accessibilityLabel="关闭原图" onPress={() => setPreview(null)}><Icon name="close" /></Pressable>
            <Text style={s.kicker}>{preview?.sample ? '群通知示例' : '原始截图'}</Text>
          </View>
          {preview?.uri ? <Image style={s.fullImage} source={{ uri: preview.uri }} resizeMode="contain" accessibilityLabel="提醒来源截图" />
            : <View style={s.sample}><Text style={s.cardTitle}>项目群 · 周会通知</Text><Text style={s.ocr}>{sampleText.split('\n').slice(1).join('\n')}</Text></View>}
        </ModalSafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  frame: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  top: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  brandIcon: { width: 35, height: 35, borderRadius: 10, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: colors.text, fontSize: 19, fontWeight: '800' },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: colors.border },
  privacyText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  toolEntry: { marginTop: 10 },
  homeBody: { paddingHorizontal: 22, paddingBottom: 20 },
  hero: { padding: 19, borderRadius: 26, backgroundColor: colors.lime, overflow: 'hidden' },
  heroArt: { position: 'absolute', right: 4, top: 28, opacity: 0.88 },
  heroKicker: { color: '#354514', fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  heroTitle: { color: colors.ink, fontSize: 39, fontWeight: '900', letterSpacing: -1, marginTop: 13, marginBottom: 5, alignSelf: 'flex-start' },
  heroCaption: { color: '#354514', fontSize: 13, fontWeight: '600' },
  heroAction: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, minHeight: 52, borderRadius: 15, backgroundColor: colors.ink, marginTop: 18 },
  heroActionText: { flex: 1, color: colors.lime, fontSize: 16, fontWeight: '800' },
  quick: { flexDirection: 'row', gap: 10, marginTop: 10 },
  quickButton: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, minHeight: 47, borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 9, paddingVertical: 7 },
  quickText: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 22, fontWeight: '800' },
  count: { color: colors.lime, borderColor: colors.border, borderWidth: 1, fontVariant: ['tabular-nums'], borderRadius: 8, fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4 },
  empty: { alignItems: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 18 },
  emptyIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B3520' },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  reminder: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, marginBottom: 8, borderRadius: 15, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabs: { flexDirection: 'row', borderTopWidth: 1, borderColor: colors.border, paddingTop: 4, paddingHorizontal: 20 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 49, gap: 3 },
  tabText: { fontSize: 11, fontWeight: '700', color: colors.muted },
  active: { color: colors.lime, fontWeight: '700' },
  screenHeader: { paddingHorizontal: 22, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 13 },
  iconButton: { height: 46, width: 46, borderRadius: 13, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  inner: { padding: 22, gap: 15 },
  heading: { color: colors.text, fontSize: 32, fontWeight: '900' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
  thumb: { width: 50, height: 50, borderRadius: 9, backgroundColor: '#2B3520' },
  center: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  field: { gap: 9 },
  fieldLabel: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  input: { color: colors.text, backgroundColor: colors.card, borderRadius: 13, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 13, paddingVertical: 12, minHeight: 52, fontSize: 16 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateButton: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 8, borderRadius: 13, borderWidth: 1, borderColor: colors.border, padding: 10, backgroundColor: colors.card },
  choice: { borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10 },
  choiceSelected: { borderColor: colors.lime, backgroundColor: '#2B3520' },
  warning: { color: colors.warning },
  ocr: { color: colors.text, fontSize: 14, lineHeight: 23, backgroundColor: colors.card, padding: 13, borderRadius: 12 },
  footer: { gap: 5, borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 22, paddingVertical: 10 },
  primary: { minHeight: 52, borderRadius: 14, padding: 11, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  dim: { opacity: 0.65 },
  deleteButton: { alignItems: 'center', justifyContent: 'center', minHeight: 46 },
  deleteText: { color: '#F6AB9D', fontSize: 14, fontWeight: '700' },
  fullImage: { width: '100%', flex: 1 },
  sample: { padding: 18, gap: 10, margin: 22, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
});

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { ModalSafeAreaView } from './ModalSafeAreaView';
import * as ImagePicker from 'expo-image-picker';
import { deleteItem, findItems, itemPhotoUri, loadItems, saveItem, type ItemDraft, type StoredItem } from './items';
import { Icon } from './visuals';
import { useTheme } from './ThemeProvider';
import { themed } from './theme';

export function ItemsScreen({ onClose }: { onClose: () => void }) {
  const { colors, scheme } = useTheme();
  const s = styles[scheme];
  const [items, setItems] = useState<StoredItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<ItemDraft>();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const results = findItems(items, query);
  const editing = items.find(item => item.id === draft?.id);
  const photo = draft?.photoUri ?? (editing && itemPhotoUri(editing.photoName));

  async function load() {
    setStatus('loading');
    try {
      setItems(await loadItems());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => { void load(); }, []);

  function back() {
    if (lock.current) return;
    if (draft) setDraft(undefined);
    else onClose();
  }

  async function takePhoto() {
    if (lock.current || status !== 'ready') return;
    lock.current = true;
    setBusy(true);
    Keyboard.dismiss();
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('需要相机权限', '允许相机访问后，就可以给物品拍照。', permission.canAskAgain ? undefined : [
          { text: '取消', style: 'cancel' },
          { text: '打开设置', onPress: () => Linking.openSettings().catch(() => Alert.alert('无法打开设置')) },
        ]);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (!result.canceled) {
        const photoUri = result.assets[0].uri;
        setDraft(current => ({ ...(current ?? { name: '', location: '' }), photoUri }));
      }
    } catch {
      Alert.alert('无法打开相机', '请确认设备支持拍照后重试。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function save() {
    if (lock.current || !draft?.name.trim() || !draft.location.trim() || !photo) return;
    lock.current = true;
    setBusy(true);
    try {
      setItems(await saveItem(draft, items));
      if (!draft.id) setQuery('');
      setDraft(undefined);
    } catch {
      Alert.alert('物品未保存', '照片和填写内容还在，可以再次保存。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function remove(item: StoredItem) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      setItems(await deleteItem(item, items));
      setDraft(undefined);
    } catch {
      Alert.alert('删除失败', '请稍后重试。');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const actionDisabled = busy || (draft ? !draft.name.trim() || !draft.location.trim() || !photo : status !== 'ready');

  return (
    <Modal visible animationType="slide" onRequestClose={back}>
      <ModalSafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={s.frame} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.header}>
            <Pressable accessibilityRole="button" accessibilityLabel={draft ? '返回物品列表' : '返回首页'}
              style={s.back} disabled={busy} onPress={back}>
              <Icon name="back" />
            </Pressable>
            <Text accessibilityRole="header" style={s.heading}>{draft ? (editing ? '物品详情' : '记录物品位置') : '家里东西放哪了'}</Text>
          </View>
          {draft ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.form}>
              {photo && <Image source={{ uri: photo }} style={s.photo} resizeMode="contain" accessibilityLabel="物品照片" />}
              <Pressable accessibilityRole="button" style={s.secondary} disabled={busy} onPress={takePhoto}>
                <Icon name="camera" size={18} color={colors.accent} />
                <Text style={s.actionText}>重拍照片</Text>
              </Pressable>
              <View style={s.field}>
                <Text style={s.caption}>物品名</Text>
                <TextInput accessibilityLabel="物品名" value={draft.name} editable={!busy} maxLength={80}
                  style={s.input} placeholder="例如：护照" placeholderTextColor={colors.muted}
                  onChangeText={name => setDraft(current => current && { ...current, name })} />
              </View>
              <View style={s.field}>
                <Text style={s.caption}>放在哪儿</Text>
                <TextInput accessibilityLabel="存放位置" value={draft.location} editable={!busy} maxLength={160}
                  style={s.input} placeholder="例如：书房柜子第二层" placeholderTextColor={colors.muted}
                  onChangeText={location => setDraft(current => current && { ...current, location })} />
              </View>
              {editing && <Pressable accessibilityRole="button" style={s.secondary} disabled={busy}
                onPress={() => Alert.alert('删除这件物品？', '将移除这条位置记录和照片。', [
                  { text: '取消', style: 'cancel' },
                  { text: '删除', style: 'destructive', onPress: () => remove(editing) },
                ])}>
                <Text style={s.deleteText}>删除物品</Text>
              </Pressable>}
            </ScrollView>
          ) : <>
            <View style={s.searchArea}>
              <Text style={s.caption}>拍下物品，记一句位置。下次按名字找。</Text>
              <View style={s.search}>
                <Icon name="search" size={19} color={colors.muted} />
                <TextInput accessibilityLabel="搜索物品名" value={query} onChangeText={setQuery}
                  style={s.searchInput} placeholder="搜索物品名" placeholderTextColor={colors.muted}
                  autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
              </View>
            </View>
            <FlatList data={results} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.list}
              renderItem={({ item }) => (
                <Pressable accessibilityRole="button" disabled={busy} style={s.item} onPress={() => {
                  Keyboard.dismiss();
                  setDraft({ id: item.id, name: item.name, location: item.location });
                }}>
                  <Image source={{ uri: itemPhotoUri(item.photoName) }} style={s.thumb} resizeMethod="resize" />
                  <View style={s.itemText}>
                    <Text style={s.name}>{item.name}</Text>
                    <Text style={s.caption}>{item.location}</Text>
                  </View>
                  <Icon name="chevron" size={18} color={colors.muted} />
                </Pressable>
              )}
              ListEmptyComponent={status === 'loading' ? <ActivityIndicator color={colors.accent} /> : status === 'error' ?
                <Pressable accessibilityRole="button" style={s.secondary} onPress={load}>
                  <Text style={s.actionText}>读取失败，轻点重试</Text>
                </Pressable> :
                <View style={s.empty}>
                  <Icon name="box" color={colors.accent} size={26} />
                  <Text style={s.name}>{query.trim() ? '没有找到这个物品' : '还没有物品记录'}</Text>
                  <Text style={s.caption}>{query.trim() ? '试试搜索物品名的一部分。' : '从护照、钥匙或换季衣服开始。'}</Text>
                </View>}
            />
          </>}
          <View style={s.footer}>
            <Pressable accessibilityRole="button" disabled={actionDisabled} onPress={draft ? save : takePhoto}
              style={[s.primary, actionDisabled && s.dim]}>
              {busy ? <ActivityIndicator color={colors.ink} /> : <Icon name={draft ? 'check' : 'camera'} color={colors.ink} />}
              <Text style={s.primaryText}>{draft ? '保存位置' : '拍照记位置'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </ModalSafeAreaView>
    </Modal>
  );
}

const styles = themed(colors => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  frame: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  back: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.border },
  heading: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '800' },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  searchArea: { gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 13, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  searchInput: { flex: 1, color: colors.text, minHeight: 48, fontSize: 16 },
  list: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  thumb: { width: 58, height: 58, borderRadius: 8, backgroundColor: colors.bg },
  itemText: { flex: 1, gap: 4 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 8, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  form: { paddingHorizontal: 20, paddingVertical: 12, gap: 12 },
  photo: { width: '100%', height: 220, borderRadius: 16, backgroundColor: colors.card },
  field: { gap: 6 },
  input: { color: colors.text, backgroundColor: colors.card, borderRadius: 13, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, minHeight: 50, fontSize: 16 },
  secondary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  footer: { padding: 10, paddingHorizontal: 20, borderTopWidth: 1, borderColor: colors.border },
  primary: { minHeight: 52, borderRadius: 14, padding: 10, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  dim: { opacity: 0.55 },
}));

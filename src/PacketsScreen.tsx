import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { checkMaterial, deletePacket, loadPackets, packetImageUri, savePacket, type Packet, type PacketDraft } from './packets';
import { styles, ToolButton, ToolSheet } from './toolSheet';
import { Icon } from './visuals';
import { useTheme } from './ThemeProvider';
import { themed } from './theme';

export function PacketsScreen({ onClose }: { onClose: () => void }) {
  const { colors, scheme } = useTheme();
  const s = styles[scheme];
  const local = localStyles[scheme];
  const [packets, setPackets] = useState<Packet[]>([]);
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading');
  const [id, setId] = useState<string>();
  const [draft, setDraft] = useState<PacketDraft>();
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const selected = packets.find(packet => packet.id === id);
  const savedImage = selected?.imageName && packetImageUri(selected.imageName);
  const image = draft?.imageUri === undefined ? savedImage : draft.imageUri;

  async function load() {
    setStatus('loading');
    try {
      setPackets(await loadPackets());
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => { void load(); }, []);

  function back() {
    if (lock.current) return;
    if (preview) setPreview(false);
    else if (draft) setDraft(undefined);
    else if (selected) setId(undefined);
    else onClose();
  }

  async function run(errorTitle: string, action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try { await action(); }
    catch { Alert.alert(errorTitle, '请稍后重试。'); }
    finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function pickImage() {
    void run('无法导入截图', async () => {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      if (!result.canceled) {
        const imageUri = result.assets[0].uri;
        setDraft(current => current && { ...current, imageUri });
      }
    });
  }

  function save() {
    if (!draft?.title.trim()) return;
    void run('资料包未保存', async () => {
      const { next, id } = await savePacket(draft, packets, selected);
      setPackets(next);
      setId(id);
      setDraft(undefined);
    });
  }

  function edit(packet?: Packet) {
    setDraft({
      title: packet?.title ?? '',
      address: packet?.address ?? '',
      materialText: packet?.materials.map(material => material.name).join('\n') ?? '',
    });
  }

  function remove(packet: Packet) {
    Alert.alert('删除资料包？', '这张卡片及其中的截图副本会被删除。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void run('无法删除资料包', async () => {
        setPackets(await deletePacket(packets, packet));
        setId(undefined);
      }) },
    ]);
  }

  return (
    <ToolSheet title={preview ? '预约截图' : draft ? (selected ? '编辑资料包' : '新建资料包') : selected?.title ?? '出门办事资料包'}
      back={back} busy={busy}>
      {preview && image ? <Image style={local.fullImage} source={{ uri: image }} resizeMode="contain" accessibilityLabel="预约截图" />
        : <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
          {draft ? <>
            <Text style={s.caption}>办事名称</Text>
            <TextInput style={s.input} accessibilityLabel="办事名称" value={draft.title} placeholder="例如：周五医院复诊"
              placeholderTextColor={colors.muted} editable={!busy} maxLength={80}
              onChangeText={title => setDraft(current => current && { ...current, title })} />
            <Text style={s.caption}>办事地址</Text>
            <TextInput style={s.input} accessibilityLabel="办事地址" value={draft.address} placeholder="例如：市人民医院门诊楼 2 层"
              placeholderTextColor={colors.muted} editable={!busy} maxLength={200}
              onChangeText={address => setDraft(current => current && { ...current, address })} />
            <Text style={s.caption}>所需材料 · 每行一项</Text>
            <TextInput style={[s.input, local.multiline]} accessibilityLabel="所需材料，每行一项" value={draft.materialText}
              placeholder={'身份证\n医保卡\n上次检查报告'} placeholderTextColor={colors.muted} multiline editable={!busy} maxLength={2500}
              onChangeText={materialText => setDraft(current => current && { ...current, materialText })} />
            {image && <Image style={local.thumbnail} source={{ uri: image }} resizeMode="contain" accessibilityLabel="已选预约截图" />}
            <ToolButton label={image ? '更换预约截图' : '导入预约截图'} onPress={pickImage} secondary disabled={busy} />
            {image && <ToolButton label="移除截图" onPress={() => setDraft(current => current && { ...current, imageUri: null })}
              secondary disabled={busy} />}
          </> : selected ? <>
            {!!selected.address && <View style={s.card}>
              <Text style={s.caption}>办事地址</Text>
              <Text style={s.text} selectable>{selected.address}</Text>
            </View>}
            {image && <Pressable style={s.card} accessibilityRole="button" accessibilityLabel="全屏查看预约截图" onPress={() => setPreview(true)}>
              <View style={s.row}>
                <Icon name="image" color={colors.accent} size={20} />
                <Text style={[s.text, local.grow]}>预约截图</Text>
                <Icon name="chevron" color={colors.muted} size={18} />
              </View>
              <Image style={local.thumbnail} source={{ uri: image }} resizeMode="contain" />
            </Pressable>}
            <Text style={s.caption}>出门前确认 · {selected.materials.filter(material => material.checked).length}/{selected.materials.length}</Text>
            {selected.materials.length === 0 && <Text style={s.caption}>还没有添加材料。</Text>}
            {selected.materials.map(material => (
              <Pressable key={material.name} style={[s.card, s.row]} accessibilityRole="checkbox"
                accessibilityState={{ checked: material.checked }} disabled={busy}
                onPress={() => void run('无法保存确认状态', async () => {
                  setPackets(await checkMaterial(packets, selected.id, material.name, !material.checked));
                })}>
                <Icon name={material.checked ? 'done' : 'unchecked'} color={material.checked ? colors.accent : colors.muted} size={20} />
                <Text style={[s.text, local.grow]}>{material.name}</Text>
              </Pressable>
            ))}
            <ToolButton label="编辑资料包" secondary disabled={busy} onPress={() => edit(selected)} />
            <ToolButton label="删除资料包" secondary disabled={busy} onPress={() => remove(selected)} />
          </> : status === 'loading' ? <ActivityIndicator color={colors.accent} />
            : status === 'error' ? <ToolButton label="读取失败，轻点重试" secondary onPress={load} /> : <>
              {packets.length === 0 && <Text style={s.caption}>把材料、办事地址和预约截图放在一张卡片里。出门前勾选，到现场直接打开。</Text>}
              {packets.map(packet => (
                <Pressable key={packet.id} accessibilityRole="button" style={[s.card, s.row]} onPress={() => setId(packet.id)}>
                  <Icon name="folder" color={colors.accent} />
                  <View style={local.grow}>
                    <Text style={s.text}>{packet.title}</Text>
                    <Text style={s.caption}>{packet.materials.filter(material => material.checked).length}/{packet.materials.length} 项材料已确认{packet.imageName ? ' · 有预约截图' : ''}</Text>
                  </View>
                  <Icon name="chevron" color={colors.muted} size={18} />
                </Pressable>
              ))}
            </>}
        </ScrollView>}
      {!preview && (draft || (!selected && status === 'ready')) && <View style={s.footer}>
        <ToolButton label={draft ? '保存资料包' : '新建资料包'} onPress={draft ? save : () => edit()}
          disabled={busy || (!!draft && !draft.title.trim())} />
      </View>}
    </ToolSheet>
  );
}

const localStyles = themed(colors => StyleSheet.create({
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  thumbnail: { width: '100%', height: 170, backgroundColor: colors.bg, borderRadius: 10 },
  fullImage: { width: '100%', flex: 1 },
  grow: { flex: 1 },
}));

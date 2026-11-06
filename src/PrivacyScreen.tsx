import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View,
  type GestureResponderEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import ShotOcr, { type PrivacyImage } from '../modules/shot-ocr';
import { pixelBox, suggestMasks, type Mask } from './privacy';
import { colors, Icon } from './visuals';

export function PrivacyScreen({ onClose }: { onClose: () => void }) {
  const [image, setImage] = useState<PrivacyImage>();
  const [masks, setMasks] = useState<Mask[]>([]);
  const [busy, setBusy] = useState<'import' | 'share'>();
  const [previewWidth, setPreviewWidth] = useState(0);
  const [ready, setReady] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [corner, setCorner] = useState<{ x: number; y: number }>();
  const lock = useRef(false);
  const scale = image ? previewWidth / image.width : 0;
  const selected = masks.filter(mask => mask.selected);
  const primaryDisabled = !!busy || (!!image && (!ready || !selected.length || drawing));
  const source = image?.uri;

  useEffect(() => () => {
    if (source) {
      try { new File(source).delete(); } catch {}
    }
  }, [source]);

  function close() {
    if (!lock.current) onClose();
  }

  async function pickImage() {
    if (lock.current) return;
    if (!ShotOcr?.preparePrivacyImage) {
      Alert.alert('需要重新构建应用', '请安装包含图片遮挡功能的开发构建。');
      return;
    }
    lock.current = true;
    setBusy('import');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
      if (result.canceled) return;
      const next = await ShotOcr.preparePrivacyImage(result.assets[0].uri);
      setReady(false);
      setDrawing(false);
      setCorner(undefined);
      setMasks(suggestMasks(next));
      setImage(next);
    } catch {
      Alert.alert('无法读取图片', '请尝试重新选择图片。');
    } finally {
      lock.current = false;
      setBusy(undefined);
    }
  }

  function markCorner({ nativeEvent }: GestureResponderEvent) {
    if (!image || !scale || !ready || lock.current) return;
    const point = { x: nativeEvent.locationX / scale, y: nativeEvent.locationY / scale };
    if (!corner) {
      setCorner(point);
      return;
    }
    const box = pixelBox(corner.x, corner.y, point.x, point.y, image.width, image.height);
    if (box[2] < 2 || box[3] < 2) return;
    setMasks(current => [...current, { box, selected: true, label: '手动遮挡' }]);
    setCorner(undefined);
    setDrawing(false);
  }

  async function share() {
    if (lock.current || !ShotOcr || !image || !ready || !selected.length) return;
    lock.current = true;
    setBusy('share');
    try {
      const { shareAsync } = await import('expo-sharing');
      const uri = await ShotOcr.redactImage(image.uri, selected.map(mask => mask.box));
      await shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: '分享遮挡后的图片' });
    } catch {
      Alert.alert('无法分享图片', '请稍后重试。');
    } finally {
      lock.current = false;
      setBusy(undefined);
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={s.safe}>
        <View style={s.frame}>
          <View style={s.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="返回首页" onPress={close} disabled={!!busy} style={s.back}>
              <Icon name="back" />
            </Pressable>
            <Text accessibilityRole="header" style={s.heading}>发图前遮隐私</Text>
            {!!image && <Pressable accessibilityRole="button" onPress={pickImage} disabled={!!busy} style={s.back}>
              <Text style={s.actionText}>换图</Text>
            </Pressable>}
          </View>
          <View style={s.intro}>
            <Text style={s.caption}>{!image ? '从相册导入快递单、订单截图或聊天记录，在设备上识别疑似手机号、地址和姓名。'
              : image.lines === null ? '文字识别失败，可以手动框选。'
              : !masks.length ? '未标出疑似信息，可以手动框选。'
              : '点选疑似区域来遮挡，再检查整张图。'}</Text>
            {!!image && <Text accessibilityLiveRegion="polite" style={s.caption}>
              {drawing ? (corner ? '再点一下矩形的对角。' : '在图上点一下矩形的第一个角。')
                : `已遮挡 ${selected.length} 处 · 可手动补选`}
            </Text>}
          </View>
          <ScrollView contentContainerStyle={s.body} onLayout={event => setPreviewWidth(event.nativeEvent.layout.width - 40)}>
            {!!image && scale > 0 && <View style={{ width: previewWidth, height: image.height * scale, overflow: 'hidden' }}>
              <Image key={image.uri} source={{ uri: image.uri }} style={StyleSheet.absoluteFill}
                resizeMode="stretch" resizeMethod="resize" accessibilityLabel="待遮挡图片"
                onLoad={() => setReady(true)} onError={() => Alert.alert('无法显示图片', '请重新选择图片。')} />
              {ready && masks.map(({ box: [x, y, width, height], label, selected: covered }, index) => (
                <Pressable key={index} accessibilityRole="checkbox" accessibilityLabel={`区域 ${index + 1}，${label}`}
                  accessibilityState={{ checked: covered }} disabled={drawing || !!busy}
                  hitSlop={4}
                  onPress={() => setMasks(current => current.map((mask, i) => i === index ? { ...mask, selected: !mask.selected } : mask))}
                  style={[s.box, {
                    left: x * scale, top: y * scale, width: width * scale, height: height * scale,
                    backgroundColor: covered ? '#000' : 'transparent', borderWidth: covered ? 0 : 1.5,
                  }]} />
              ))}
              {drawing && <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={markCorner}>
                {corner && <View pointerEvents="none" style={[s.corner, { left: corner.x * scale - 4, top: corner.y * scale - 4 }]} />}
              </Pressable>}
            </View>}
          </ScrollView>
          <View style={s.footer}>
            {image && <View style={s.actions}>
              <Pressable accessibilityRole="button" disabled={!ready || !!busy} style={s.secondary} onPress={() => {
                setCorner(undefined);
                setDrawing(!drawing);
              }}>
                <Text style={s.actionText}>{drawing ? '取消框选' : '手动框选'}</Text>
              </Pressable>
              {!!masks.length && <Pressable accessibilityRole="button" disabled={!!busy || drawing || selected.length === masks.length}
                style={s.secondary} onPress={() => setMasks(current => current.map(mask => ({ ...mask, selected: true })))}>
                <Text style={s.actionText}>全部遮挡</Text>
              </Pressable>}
            </View>}
            <Pressable accessibilityRole="button" onPress={image ? share : pickImage}
              disabled={primaryDisabled}
              style={[s.primary, primaryDisabled && s.dim]}>
              {busy ? <ActivityIndicator color={colors.ink} /> : <Icon name={image ? 'arrow' : 'image'} color={colors.ink} />}
              <Text style={s.primaryText}>{busy === 'import' ? '正在读取图片…' : busy === 'share' ? '正在准备分享…'
                : image ? '分享遮挡后的图片' : '选择图片'}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  frame: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  back: { minWidth: 46, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.border },
  heading: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '800' },
  intro: { gap: 4, paddingHorizontal: 20, paddingBottom: 12 },
  caption: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  body: { paddingHorizontal: 20, paddingBottom: 12 },
  box: { position: 'absolute', borderColor: colors.lime },
  corner: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: colors.lime },
  footer: { gap: 8, padding: 10, paddingHorizontal: 20, borderTopWidth: 1, borderColor: colors.border },
  actions: { flexDirection: 'row', gap: 8 },
  secondary: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 13, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.lime, fontSize: 14, fontWeight: '700' },
  primary: { minHeight: 52, borderRadius: 14, padding: 10, backgroundColor: colors.lime, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  dim: { opacity: 0.55 },
});

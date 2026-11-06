import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, Icon } from './visuals';

export function ToolSheet({ title, back, busy, children }: {
  title: string; back: () => void; busy?: boolean; children: ReactNode;
}) {
  return (
    <Modal visible animationType="slide" onRequestClose={back}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.frame} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Pressable style={styles.back} accessibilityRole="button" accessibilityLabel="返回" disabled={busy} onPress={back}>
              <Icon name="back" />
            </Pressable>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
          </View>
          {children}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function ToolButton({ label, onPress, disabled, secondary }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={[styles.button, secondary && styles.secondary, disabled && styles.dim]}>
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  frame: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  back: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.border },
  title: { flex: 1, color: colors.text, fontSize: 22, fontWeight: '800' },
  text: { color: colors.text, fontSize: 16, fontWeight: '700' },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  input: { color: colors.text, minHeight: 48, fontSize: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 9 },
  body: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { padding: 14, gap: 7, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  footer: { paddingVertical: 10, paddingHorizontal: 20, gap: 8, borderTopWidth: 1, borderColor: colors.border },
  button: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.lime },
  secondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  secondaryText: { color: colors.lime },
  dim: { opacity: 0.5 },
});

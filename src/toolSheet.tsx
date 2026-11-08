import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ModalSafeAreaView } from './ModalSafeAreaView';
import { Icon } from './visuals';
import { useTheme } from './ThemeProvider';
import { themed } from './theme';

export function ToolSheet({ title, back, busy, children }: {
  title: string; back: () => void; busy?: boolean; children: ReactNode;
}) {
  const stylesForScheme = styles[useTheme().scheme];
  return (
    <Modal visible animationType="slide" onRequestClose={back}>
      <ModalSafeAreaView style={stylesForScheme.safe}>
        <KeyboardAvoidingView style={stylesForScheme.frame} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={stylesForScheme.header}>
            <Pressable style={stylesForScheme.back} accessibilityRole="button" accessibilityLabel="返回" disabled={busy} onPress={back}>
              <Icon name="back" />
            </Pressable>
            <Text style={stylesForScheme.title} accessibilityRole="header">{title}</Text>
          </View>
          {children}
        </KeyboardAvoidingView>
      </ModalSafeAreaView>
    </Modal>
  );
}

export function ToolButton({ label, onPress, disabled, secondary }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  const stylesForScheme = styles[useTheme().scheme];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={[stylesForScheme.button, secondary && stylesForScheme.secondary, disabled && stylesForScheme.dim]}>
      <Text style={[stylesForScheme.buttonText, secondary && stylesForScheme.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

export const styles = themed(colors => StyleSheet.create({
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
  button: { minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.brand },
  secondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  secondaryText: { color: colors.accent },
  dim: { opacity: 0.5 },
}));

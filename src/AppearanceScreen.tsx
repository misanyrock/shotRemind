import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from './ThemeProvider';
import { styles } from './toolSheet';
import { Icon } from './visuals';

const choices = [
  ['system', '跟随系统', '随设备的外观自动切换'],
  ['light', '浅色', '使用明亮的背景'],
  ['dark', '深色', '使用深色背景'],
] as const;

export function AppearanceScreen() {
  const { mode, scheme, busy, chooseMode, colors } = useTheme();
  const s = styles[scheme];
  return (
    <ScrollView contentContainerStyle={s.body}>
      {choices.map(([value, label, description]) => (
        <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value, disabled: busy }}
          disabled={busy} style={[s.card, s.row]} onPress={() => chooseMode(value)}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.text}>{label}</Text>
            <Text style={s.caption}>{description}</Text>
          </View>
          <Icon name={mode === value ? 'done' : 'unchecked'} color={mode === value ? colors.accent : colors.muted} size={22} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

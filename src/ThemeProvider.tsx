import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palettes, readThemeMode, resolveTheme, type ThemeMode, type ThemeScheme } from './theme';

const storageKey = 'shot-remind/appearance-v1';
const ThemeContext = createContext<{
  mode: ThemeMode;
  scheme: ThemeScheme;
  busy: boolean;
  chooseMode: (mode: ThemeMode) => void;
}>({ mode: 'system', scheme: 'light', busy: false, chooseMode: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPreference] = useState<ThemeMode>();
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const mode = preference ?? 'system';
  const scheme = resolveTheme(mode, system);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey).catch(() => null).then(saved => {
      if (mounted) setPreference(readThemeMode(saved));
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (preference) Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference]);

  async function chooseMode(next: ThemeMode) {
    if (!preference || next === preference || lock.current) return;
    lock.current = true;
    setSaving(true);
    try {
      await AsyncStorage.setItem(storageKey, next);
      setPreference(next);
    } catch {
      Alert.alert('无法保存外观设置', '请稍后重试。');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return <ThemeContext.Provider value={{ mode, scheme, busy: preference === undefined || saving, chooseMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const theme = useContext(ThemeContext);
  return { ...theme, colors: palettes[theme.scheme] };
}

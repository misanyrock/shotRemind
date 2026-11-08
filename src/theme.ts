export type ThemeScheme = 'light' | 'dark';
export type ThemeMode = 'system' | ThemeScheme;

const brand = { brand: '#DEFF66', ink: '#171D0C' };

const palettes = {
  dark: {
    ...brand,
    bg: '#131510', card: '#1C1F18', border: '#32362B', muted: '#A6AD99', text: '#F4F6ED',
    accent: brand.brand, soft: '#2B3520', warning: '#F7C57B', danger: '#F6AB9D',
  },
  light: {
    ...brand,
    bg: '#F5F7EF', card: '#FFFFFF', border: '#A0AA91', muted: '#505C46', text: '#202719',
    accent: '#3D570E', soft: '#E8EFCF', warning: '#865110', danger: '#9F372B',
  },
};

export function readThemeMode(value: string | null): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(mode: ThemeMode, system: string | null | undefined): ThemeScheme {
  return mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
}

export function themed<T>(create: (colors: typeof palettes.dark) => T) {
  return { light: create(palettes.light), dark: create(palettes.dark) };
}

export { palettes };

import assert from 'node:assert/strict';
import test from 'node:test';
import { palettes, readThemeMode, resolveTheme } from '../src/theme.ts';

test('follows system changes by default and keeps explicitly selected modes', () => {
  const defaultMode = readThemeMode(null);
  assert.equal(resolveTheme(defaultMode, 'light'), 'light');
  assert.equal(resolveTheme(defaultMode, 'dark'), 'dark');
  assert.equal(resolveTheme(readThemeMode('system'), 'light'), 'light');
  assert.equal(resolveTheme(readThemeMode('light'), 'dark'), 'light');
  assert.equal(resolveTheme(readThemeMode('dark'), 'light'), 'dark');
  assert.equal(resolveTheme(readThemeMode('invalid'), null), 'light');
});

function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map(channel => Number.parseInt(channel, 16) / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

test('main text, captions and buttons remain legible in both palettes', () => {
  for (const [scheme, colors] of Object.entries(palettes)) {
    const pairs = [
      ['text', 'bg'], ['text', 'card'], ['muted', 'bg'], ['muted', 'card'],
      ['accent', 'bg'], ['accent', 'soft'], ['ink', 'brand'], ['warning', 'card'], ['danger', 'bg'],
    ];
    for (const [foreground, background] of pairs) {
      const a = luminance(colors[foreground]);
      const b = luminance(colors[background]);
      assert((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5, `${scheme}: ${foreground} on ${background}`);
    }
  }
});

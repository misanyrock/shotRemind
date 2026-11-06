import assert from 'node:assert/strict';
import test from 'node:test';
import { pixelBox, suggestMasks } from '../src/privacy.ts';

test('suggests phone, address and name regions without selecting them', () => {
  const lines = [
    { text: '收货人：张三', box: [0, 3, 100, 20] },
    { text: '手机：＋８６ １３８-００１３-８０００', box: [3, 50, 230, 20] },
    { text: '广东省深圳市南山区科苑路15号', box: [5, 100, 311, 30] },
    { text: '联系人', box: [4, 155, 40, 16] },
    { text: 'Jane Smith', box: [55, 155, 85, 16] },
    { text: '订单号 12313800138000123', box: [4, 220, 220, 20] },
  ];
  const image = { uri: 'file:///example.png', width: 320, height: 300, lines };
  const masks = suggestMasks(image);
  assert.deepEqual(masks.map(mask => mask.label), ['姓名', '手机号', '地址', '姓名']);
  assert(masks.every(mask => !mask.selected));
  assert.deepEqual(masks[0].box, [0, 0, 103, 26]);
  assert.deepEqual(masks[2].box, [0, 95, 320, 40]);
  assert.deepEqual(masks[3].box, [52, 152, 91, 22]);
  assert.deepEqual(suggestMasks({ ...image, lines: null }), []);
});

test('rounds outward and clips a rectangle drawn from either corner', () => {
  assert.deepEqual(pixelBox(320.2, 180.3, 52.5, -4, 320, 300), [52, 0, 268, 181]);
});

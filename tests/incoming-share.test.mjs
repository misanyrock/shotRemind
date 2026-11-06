import assert from 'node:assert/strict';
import test from 'node:test';
import { singleSharedImage } from '../src/incomingShare.ts';

const image = value => ({ shareType: 'image', mimeType: 'image/png', value });

test('accepts one Android content-provider image and rejects multiple or nonlocal images', () => {
  const screenshot = image('content://media/external/images/media/42');
  const caption = { shareType: 'text', value: '医院预约' };
  assert.equal(singleSharedImage([screenshot, caption], 'android'), screenshot);
  assert.equal(singleSharedImage([screenshot, screenshot], 'android'), undefined);
  assert.equal(singleSharedImage([image('https://example.test/photo.png')], 'android'), undefined);
  assert.equal(singleSharedImage([image('file:///private/image.png')], 'android'), undefined);
});

test('only accepts an iOS file directly inside the share extension group', () => {
  const group = 'file:///var/mobile/Containers/Shared/AppGroup/abc/';
  const screenshot = image(group + '预约%20截图.png');
  assert.equal(singleSharedImage([screenshot], 'ios', [group]), screenshot);
  for (const suffix of ['%2e%2e', '%2e%2e%2foutside.png', '.?x', 'nested/image.png', '%00.png', '%']) {
    assert.equal(singleSharedImage([image(group + suffix)], 'ios', [group]), undefined);
  }
  assert.equal(singleSharedImage([screenshot], 'ios', ['file:///different/']), undefined);
});

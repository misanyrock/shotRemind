import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mock, test } from 'node:test';

// The mock loader asks Node to load the original Expo TypeScript entry before substituting it.
const fileSystemEntry = import.meta.resolve('expo-file-system');
const hook = registerHooks({
  load(url, context, nextLoad) {
    if (url.split('?')[0] === fileSystemEntry) return { format: 'module', source: '', shortCircuit: true };
    return nextLoad(url, context);
  },
});
const records = new Map();
const photos = new Map();
let failWrite = false;
mock.module('@react-native-async-storage/async-storage', {
  defaultExport: {
    getItem: async key => records.get(key) ?? null,
    setItem: async (key, value) => {
      if (failWrite) throw new Error('Storage unavailable');
      records.set(key, value);
    },
  },
});
mock.module('expo-file-system', {
  namedExports: {
    Paths: { document: 'file:///documents' },
    Directory: class {
      constructor(parent, name) { this.uri = `${parent}/${name}`; }
      create() {}
    },
    File: class {
      constructor(parent, name) { this.uri = name ? `${parent.uri}/${name}` : parent; }
      get exists() { return photos.has(this.uri); }
      copy(to) {
        assert(this.exists);
        photos.set(to.uri, photos.get(this.uri));
      }
      delete() { photos.delete(this.uri); }
    },
  },
});

const { deleteItem, findItems, itemPhotoUri, loadItems, saveItem } = await import('../src/items.ts');
const { checkMaterial, deletePacket, loadPackets, packetImageUri, savePacket } = await import('../src/packets.ts');
hook.deregister();

test('finds a saved item by part of its name across case and width differences', () => {
  const items = [{ id: '1', name: 'ＵＳＢ 备份盘', location: '书房柜子第二层', photoName: 'photo.jpg' }];
  assert.deepEqual(findItems(items, ' usb '), items);
  assert.deepEqual(findItems(items, '备份'), items);
  assert.deepEqual(findItems(items, '书房'), []);
});

test('persists photos and keeps the old record and photo when a write fails', async () => {
  photos.set('file:///camera/first.jpg', 'first');
  photos.set('file:///camera/second.jpg', 'second');
  await assert.rejects(saveItem({ name: '护照', location: ' ' }, []), /物品名/);

  const [item] = await saveItem({ name: ' 护照 ', location: ' 书房柜子第二层 ', photoUri: 'file:///camera/first.jpg' }, []);
  const original = itemPhotoUri(item.photoName);
  assert.equal(item.name, '护照');
  assert.equal(item.location, '书房柜子第二层');
  assert.deepEqual(await loadItems(), [item]);
  assert.equal(photos.get(original), 'first');

  const [moved] = await saveItem({ ...item, location: '行李箱夹层' }, [item]);
  assert.equal(moved.id, item.id);
  assert.equal(moved.photoName, item.photoName);

  const retake = { ...moved, photoUri: 'file:///camera/second.jpg' };
  failWrite = true;
  await assert.rejects(saveItem(retake, [moved]), /Storage unavailable/);
  await assert.rejects(deleteItem(moved, [moved]), /Storage unavailable/);
  assert.deepEqual(await loadItems(), [moved]);
  assert.equal(photos.size, 3);
  failWrite = false;

  const [updated] = await saveItem(retake, [moved]);
  const replacement = itemPhotoUri(updated.photoName);
  assert.equal(photos.has(original), false);
  assert.equal(photos.get(replacement), 'second');
  await deleteItem(updated, [updated]);
  assert.deepEqual(await loadItems(), []);
  assert.equal(photos.has(replacement), false);
});

test('keeps a packet and screenshot offline and preserves checks when editing its materials', async () => {
  const imageUri = 'file:///camera/appointment.png';
  photos.set(imageUri, 'appointment');
  const draft = { title: '医院复诊', address: '门诊楼二层', materialText: '身份证\n医保卡\n身份证', imageUri };
  const { next } = await savePacket(draft, []);
  const [saved] = next;
  const storedImage = packetImageUri(saved.imageName);
  assert.equal(photos.get(storedImage), 'appointment');
  assert.deepEqual(saved.materials.map(material => material.name), ['身份证', '医保卡']);
  const checked = await checkMaterial(next, saved.id, '身份证', true);
  const { next: edited } = await savePacket({ ...draft, imageUri: undefined, materialText: '身份证\n病历' }, checked, checked[0]);
  assert.deepEqual(await loadPackets(), edited);
  assert.deepEqual(edited[0].materials, [{ name: '身份证', checked: true }, { name: '病历', checked: false }]);
  assert.equal(edited[0].imageName, saved.imageName);

  failWrite = true;
  await assert.rejects(savePacket({ ...draft, imageUri: null }, edited, edited[0]), /Storage unavailable/);
  assert.equal(photos.get(storedImage), 'appointment');
  failWrite = false;
  await deletePacket(edited, edited[0]);
  assert.deepEqual(await loadPackets(), []);
  assert.equal(photos.has(storedImage), false);
});

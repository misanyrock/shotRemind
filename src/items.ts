import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

export type StoredItem = { id: string; name: string; location: string; photoName: string };
export type ItemDraft = Pick<StoredItem, 'name' | 'location'> & { id?: string; photoUri?: string };

const key = 'shot-remind/items-v1';
const directory = () => new Directory(Paths.document, 'item-photos');
const photoFile = (name: string) => new File(directory(), name);
const uniqueId = () => Date.now() + '-' + Math.random().toString(36).slice(2, 9);
const normalizeName = (name: string) => name.normalize('NFKC').trim().toLowerCase();

export const itemPhotoUri = (name: string) => photoFile(name).uri;

export function findItems(items: StoredItem[], query: string) {
  const name = normalizeName(query);
  return name ? items.filter(item => normalizeName(item.name).includes(name)) : items;
}

export async function loadItems(): Promise<StoredItem[]> {
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function removePhoto(file: File) {
  try {
    if (file.exists) file.delete();
  } catch (error) {
    console.warn('Unable to remove item photo', error);
  }
}

export async function saveItem(draft: ItemDraft, items: StoredItem[]) {
  const name = draft.name.trim();
  const location = draft.location.trim();
  const previous = items.find(item => item.id === draft.id);
  if (!name || !location || (!draft.photoUri && !previous)) throw new Error('物品名、位置和照片都需要填写。');

  const id = previous?.id ?? uniqueId();
  let photoName = previous?.photoName ?? '';
  let photo: File | undefined;
  let next: StoredItem[];
  try {
    if (draft.photoUri) {
      const folder = directory();
      folder.create({ idempotent: true, intermediates: true });
      const extension = draft.photoUri.match(/\.([a-z0-9]{2,5})(?:[?#].*)?$/i)?.[1] ?? 'jpg';
      photoName = uniqueId() + '.' + extension;
      photo = new File(folder, photoName);
      new File(draft.photoUri).copy(photo);
    }
    next = [{ id, name, location, photoName }, ...items.filter(item => item.id !== id)];
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch (error) {
    if (photo) removePhoto(photo);
    throw error;
  }
  if (photo && previous) removePhoto(photoFile(previous.photoName));
  return next;
}

export async function deleteItem(item: StoredItem, items: StoredItem[]) {
  const next = items.filter(entry => entry.id !== item.id);
  await AsyncStorage.setItem(key, JSON.stringify(next));
  removePhoto(photoFile(item.photoName));
  return next;
}

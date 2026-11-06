import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

export type Material = { name: string; checked: boolean };
export type Packet = { id: string; title: string; address: string; materials: Material[]; imageName?: string };
export type PacketDraft = { title: string; address: string; materialText: string; imageUri?: string | null };

const key = 'shot-remind/packets-v1';
const directory = () => new Directory(Paths.document, 'packet-images');
const photo = (name: string) => new File(directory(), name);
export const packetImageUri = (name: string) => photo(name).uri;

export async function loadPackets(): Promise<Packet[]> {
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function removePhoto(name: string) {
  try {
    const file = photo(name);
    if (file.exists) file.delete();
  }
  catch (error) { console.warn('Unable to remove packet image', error); }
}

export async function savePacket(draft: PacketDraft, packets: Packet[], previous?: Packet) {
  const title = draft.title.trim();
  if (!title) throw new Error('请输入办事名称。');
  const checks = new Map(previous?.materials.map(material => [material.name, material.checked]));
  const names = new Set(draft.materialText.split(/\r?\n/).map(line => line.trim()).filter(Boolean));
  const materials = [...names].map(name => ({ name, checked: checks.get(name) ?? false }));
  const id = previous?.id ?? Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  const oldImage = previous?.imageName;
  let imageName = draft.imageUri === null ? undefined : oldImage;
  let copied: string | undefined;
  try {
    if (draft.imageUri) {
      const folder = directory();
      folder.create({ idempotent: true, intermediates: true });
      const extension = draft.imageUri.match(/\.([a-z0-9]{2,5})(?:[?#].*)?$/i)?.[1] ?? 'jpg';
      imageName = id + '-' + Math.random().toString(36).slice(2, 9) + '.' + extension;
      copied = imageName;
      new File(draft.imageUri).copy(new File(folder, imageName));
    }
    const packet = { id, title, address: draft.address.trim(), materials, imageName };
    const next = previous ? packets.map(item => item.id === id ? packet : item) : [packet, ...packets];
    await AsyncStorage.setItem(key, JSON.stringify(next));
    if (oldImage && oldImage !== imageName) removePhoto(oldImage);
    return { next, id };
  } catch (error) {
    if (copied) removePhoto(copied);
    throw error;
  }
}

export async function checkMaterial(packets: Packet[], id: string, name: string, checked: boolean) {
  const next = packets.map(packet => packet.id !== id ? packet : {
    ...packet, materials: packet.materials.map(material => material.name === name ? { ...material, checked } : material),
  });
  await AsyncStorage.setItem(key, JSON.stringify(next));
  return next;
}

export async function deletePacket(packets: Packet[], packet: Packet) {
  const next = packets.filter(item => item.id !== packet.id);
  await AsyncStorage.setItem(key, JSON.stringify(next));
  if (packet.imageName) removePhoto(packet.imageName);
  return next;
}

import type { SharePayload } from 'expo-sharing';

export function singleSharedImage(payloads: SharePayload[], platform: string, containers: string[] = []) {
  const images = payloads.filter(payload => payload.shareType === 'image');
  if (images.length !== 1) return undefined;
  const image = images[0];
  if (platform === 'android' && /^content:\/\/[^/?#]+(?:[/?#]|$)/.test(image.value)) return image;
  if (platform !== 'ios' || !image.value.startsWith('file:///')) return undefined;

  return containers.some(container => {
    const prefix = container.endsWith('/') ? container : container + '/';
    if (!image.value.startsWith(prefix)) return false;
    try {
      const encodedName = image.value.slice(prefix.length);
      if (/[?#]/.test(encodedName)) return false;
      const name = decodeURIComponent(encodedName);
      return name.length > 0 && name !== '.' && name !== '..' && !/[/\\\0]/.test(name);
    } catch {
      return false;
    }
  }) ? image : undefined;
}

import type { PixelBox, PrivacyImage } from '../modules/shot-ocr';

export type Mask = { box: PixelBox; label: string; selected: boolean };

const phone = /(?<![\d*])(?:\+?86[\s-]*)?1[3-9]\d(?:[\s-]*[\d*]){8}(?![\d*])/;
const phoneField = /^(?:手机(?:号码?)?|联系电话|联系手机|电话(?:号码?)?|联系方式)\s*[:：]?\s*/;
const nameField = /^(?:收货人姓名|收件人姓名|寄件人姓名|收货姓名|真实姓名|收货人|收件人|寄件人|联系人|姓名)\s*[:：]?\s*/;
const addressField = /^(?:收货地址|收件地址|寄件地址|配送地址|详细地址|联系地址|地址)\s*[:：]?\s*/;
const address = /(?:[\u3400-\u9fff]{2,}(?:省|市|区|县|镇|街道).*(?:区|县|镇|街道|路|街|巷|号|小区|栋|室)|[\u3400-\u9fff]{2,}(?:路|街|巷)\s*\d+\s*(?:号|弄))/;
const name = /^(?:[\u3400-\u9fff·*]{2,8}(?=$|\s|[,，、:：\d])|[A-Za-z]+(?:\s+[A-Za-z]+){0,3}(?=$|[,，:\d]))/;

export function pixelBox(x1: number, y1: number, x2: number, y2: number, width: number, height: number): PixelBox {
  const x = Math.max(0, Math.min(width, Math.floor(Math.min(x1, x2))));
  const y = Math.max(0, Math.min(height, Math.floor(Math.min(y1, y2))));
  const right = Math.max(0, Math.min(width, Math.ceil(Math.max(x1, x2))));
  const bottom = Math.max(0, Math.min(height, Math.ceil(Math.max(y1, y2))));
  return [x, y, right - x, bottom - y];
}

export function suggestMasks({ lines, width, height }: PrivacyImage): Mask[] {
  const regions = (lines ?? []).map(line => ({ ...line, text: line.text.normalize('NFKC').trim() }));
  const fields = [
    { label: '手机号', field: phoneField, value: /[\d*][\d*\s-]{4,}/ },
    { label: '地址', field: addressField, value: /[\u3400-\u9fff\w]{2,}/ },
    { label: '姓名', field: nameField, value: name },
  ];
  const labels = regions.map(() => new Set<string>());
  for (const [i, { text, box: [x, y, w, h] }] of regions.entries()) {
    if (phone.test(text)) labels[i].add('手机号');
    if (address.test(text)) labels[i].add('地址');
    for (const { label, field, value } of fields) {
      if (!field.test(text)) continue;
      const remainder = text.replace(field, '');
      if (value.test(remainder)) labels[i].add(label);
      if (remainder) continue;

      let closest = -1;
      let distance = Infinity;
      for (const [j, { text: other, box: [left, top, , lineHeight] }] of regions.entries()) {
        if (j === i || !value.test(other) || fields.some(entry => entry.field.test(other))) continue;
        const gap = left - (x + w);
        const rowOffset = Math.abs(top + lineHeight / 2 - (y + h / 2));
        const row = rowOffset <= h / 2 && gap >= -2 && gap <= 8 * h;
        const below = top >= y + h - 2 && top <= y + 2 * h && Math.abs(left - x) <= 2 * h;
        const score = row ? Math.max(0, gap) + rowOffset : below ? 8 * h + top - y : Infinity;
        if (score < distance) {
          closest = j;
          distance = score;
        }
      }
      if (closest >= 0) labels[closest].add(label);
    }
  }

  // shortcut: cover the whole OCR line, use word-level boxes if users need to retain adjacent text.
  return regions.flatMap(({ box: [x, y, w, h] }, index) => {
    if (!labels[index].size || w <= 0 || h <= 0) return [];
    const padding = Math.max(2, Math.ceil(h * 0.15));
    const box = pixelBox(x - padding, y - padding, x + w + padding, y + h + padding, width, height);
    return box[2] > 0 && box[3] > 0
      ? [{ box, label: [...labels[index]].join(' / '), selected: false }]
      : [];
  });
}

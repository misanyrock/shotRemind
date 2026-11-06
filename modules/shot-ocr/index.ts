import { requireOptionalNativeModule } from 'expo';

export type PixelBox = [x: number, y: number, width: number, height: number];
export type TextRegion = { text: string; box: PixelBox };
export type PrivacyImage = { uri: string; width: number; height: number; lines: TextRegion[] | null };

export default requireOptionalNativeModule<{
  recognize(uri: string): Promise<string>;
  preparePrivacyImage(uri: string): Promise<PrivacyImage>;
  redactImage(uri: string, boxes: PixelBox[]): Promise<string>;
  canScheduleExactAlarms?(): boolean;
  openExactAlarmSettings?(): void;
}>('ShotOcr');

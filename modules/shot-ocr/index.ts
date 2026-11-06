import { requireOptionalNativeModule } from 'expo';

export default requireOptionalNativeModule<{
  recognize(uri: string): Promise<string>;
  canScheduleExactAlarms?(): boolean;
  openExactAlarmSettings?(): void;
}>('ShotOcr');

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import ShotOcr from '../modules/shot-ocr';

export type Reminder = {
  id: string;
  title: string;
  date: number;
  imageName?: string;
  sample?: boolean;
  text: string;
  completed: boolean;
};

export type Draft = {
  title: string;
  date: Date;
  imageUri?: string;
  imageExtension?: string;
  sample?: boolean;
  text: string;
};

export const sampleText = '项目群 · 周会通知\n请在明天下午3点前提交项目材料\n提交至群文件「本周汇总」';
const key = 'shot-remind/reminders-v1';
const channelId = 'reminders';
const directory = () => new Directory(Paths.document, 'reminder-images');

export const loadReminders = async (): Promise<Reminder[]> => {
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const writeReminders = (reminders: Reminder[]) => AsyncStorage.setItem(key, JSON.stringify(reminders));
export const imageUri = (name: string) => new File(directory(), name).uri;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class ReminderPermissionError extends Error {
  constructor(readonly kind: 'notification' | 'alarm') {
    super(kind === 'alarm' ? '请允许「闹钟和提醒」，开启后回来再次保存。' : '请允许通知，开启后回来再次保存。');
  }
}

async function checkPermissions() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: '截图提醒',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
  const allowsNotifications = (permissions: Notifications.NotificationPermissionsStatus) =>
    permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  const current = await Notifications.getPermissionsAsync();
  if (!allowsNotifications(current) && !allowsNotifications(await Notifications.requestPermissionsAsync())) {
    throw new ReminderPermissionError('notification');
  }
  if (Platform.OS === 'android' && ShotOcr?.canScheduleExactAlarms?.() === false) {
    throw new ReminderPermissionError('alarm');
  }
}

function schedule(reminder: Reminder) {
  return Notifications.scheduleNotificationAsync({
    identifier: reminder.id,
    content: {
      title: reminder.title,
      body: reminder.imageName || reminder.sample ? '点按查看事项和原图' : '点按查看事项详情',
      data: { reminderId: reminder.id },
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(reminder.date),
      channelId,
    },
  });
}

export async function createReminder(draft: Draft, reminders: Reminder[]) {
  const title = draft.title.trim();
  if (!title) throw new Error('请输入提醒事项。');
  if (!(draft.date.getTime() > Date.now())) throw new Error('请选择一个未来时间。');
  await checkPermissions();
  if (!(draft.date.getTime() > Date.now())) throw new Error('提醒时间已过，请重新选择。');

  const id = 'shot-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
  const reminder: Reminder = { id, title, date: draft.date.getTime(), text: draft.text, completed: false, sample: draft.sample };
  let file: File | undefined;
  let scheduledId: string | undefined;
  try {
    if (draft.imageUri) {
      const folder = directory();
      folder.create({ idempotent: true, intermediates: true });
      const extension = draft.imageExtension?.match(/^[a-z0-9]{2,5}$/i)?.[0] ?? 'jpg';
      reminder.imageName = id + '.' + extension;
      file = new File(folder, reminder.imageName);
      await new File(draft.imageUri).copy(file);
    }
    scheduledId = await schedule(reminder);
    const next = [...reminders, reminder];
    await writeReminders(next);
    return next;
  } catch (error) {
    if (scheduledId) await Notifications.cancelScheduledNotificationAsync(scheduledId).catch(() => {});
    if (file?.exists) file.delete();
    throw error;
  }
}

export async function finishReminder(reminder: Reminder, reminders: Reminder[], remove: boolean) {
  const next = remove ? reminders.filter(item => item.id !== reminder.id)
    : reminders.map(item => item.id === reminder.id ? { ...item, completed: true } : item);

  await writeReminders(next);
  try {
    await Notifications.cancelScheduledNotificationAsync(reminder.id);
  } catch (error) {
    await writeReminders(reminders);
    throw error;
  }
  if (remove && reminder.imageName) {
    try {
      const file = new File(directory(), reminder.imageName);
      if (file.exists) file.delete();
    } catch (error) {
      console.warn('Unable to remove reminder image', error);
    }
  }
  return next;
}

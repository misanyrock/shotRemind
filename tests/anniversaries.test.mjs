import assert from 'node:assert/strict';
import test from 'node:test';
import { anniversaryDate, anniversaryDistance, calendarDay, dateForPicker } from '../src/anniversaries.ts';

process.env.TZ = 'America/Los_Angeles';

test('shows elapsed days, days remaining, and the event day across a leap day', () => {
  const today = calendarDay(new Date(2024, 1, 29, 23, 59));
  assert.equal(anniversaryDistance(calendarDay(new Date(2024, 1, 28)), today), '已过去 1 天');
  assert.equal(anniversaryDistance(calendarDay(new Date(2024, 2, 1)), today), '还有 1 天');
  assert.equal(anniversaryDistance(calendarDay(new Date(2024, 1, 29)), today), '就是今天');
  assert.equal(anniversaryDate(today), '2024年2月29日');
});

test('date selection keeps the same calendar day through daylight saving and time zone changes', () => {
  const start = new Date(2026, 2, 8);
  const end = new Date(2026, 2, 9);
  assert.equal(end - start, 23 * 60 * 60 * 1000);
  const day = calendarDay(end);
  assert.equal(day - calendarDay(start), 1);
  assert.equal(calendarDay(dateForPicker(day)), day);

  process.env.TZ = 'Asia/Shanghai';
  assert.equal(calendarDay(dateForPicker(day)), day);
  assert.equal(dateForPicker(day).getDate(), 9);
});

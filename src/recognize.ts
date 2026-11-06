export type Suggestion = {
  title: string;
  source: string;
  date: Date | null;
  hasTime: boolean;
};

const weekdays = '日一二三四五六';
const datePattern = /(?<![\d./¥-])(?:((?:19|20)\d{2})\s*(?:年|[-/.])\s*)?(\d{1,2})\s*(?:月\s*|[-/.]\s*)(\d{1,2})(?:日|号)?(?!\d|[.,]\d|\s*(?:元|块钱|人民币|%))/;
const weekPattern = /(下下|下|本|这)?(?:周|星期|礼拜)([一二三四五六日天])/;
const relativePattern = /大后天|后天|明天|明早|明晚|今天|今晚|今早|昨晚|昨天/;
const timePattern = /(?:(凌晨|早上|上午|中午|下午|傍晚|晚上|晚间|夜里|早|晚)\s*)?(?:(\d{1,2})\s*:\s*(\d{2})(?!\d)|([\d一二两三四五六七八九十]{1,2})\s*[点时](?:\s*(半|\d{1,2}\s*分|[一二三四五六七八九十]{1,3}\s*分))?)/;

function numberOf(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  const digit = (s: string) => ({ 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 })[s] ?? NaN;
  if (value.includes('十')) {
    const [tens, ones] = value.split('十');
    return (tens ? digit(tens) : 1) * 10 + (ones ? digit(ones) : 0);
  }
  return digit(value);
}

function dateIn(line: string, now: Date): Date | null {
  const absolute = line.match(datePattern);
  if (absolute) {
    const [, year, month, day] = absolute;
    const date = new Date(year ? Number(year) : now.getFullYear(), Number(month) - 1, Number(day));
    if (date.getMonth() + 1 !== Number(month) || date.getDate() !== Number(day)) return null;
    return date;
  }
  const relative = line.match(relativePattern)?.[0];
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (relative) {
    const offset = relative.startsWith('昨') ? -1 : relative.startsWith('明') ? 1
      : relative === '后天' ? 2 : relative === '大后天' ? 3 : 0;
    date.setDate(date.getDate() + offset);
    return date;
  }
  const week = line.match(weekPattern);
  if (!week) return null;
  const day = week[2] === '天' ? 0 : weekdays.indexOf(week[2]);
  const currentDay = (now.getDay() + 6) % 7;
  const targetDay = (day + 6) % 7;
  let offset = targetDay - currentDay;
  if (week[1] === '下下') offset += 14;
  else if (week[1] === '下' || (!week[1] && offset < 0)) offset += 7;
  date.setDate(date.getDate() + offset);
  return date;
}

function timeIn(line: string): [number, number] | null {
  const match = line.match(timePattern);
  if (!match) return null;
  const [, period, digitalHour, digitalMinute, spokenHour, spokenMinute] = match;
  const hint = period ?? (line.includes('明晚') || line.includes('今晚') ? '晚' : '');
  let hour = numberOf(digitalHour ?? spokenHour);
  const minute = digitalMinute ? Number(digitalMinute) : spokenMinute === '半' ? 30
    : spokenMinute ? numberOf(spokenMinute.replace(/\s*分$/, '')) : 0;
  if (/下午|中午|傍晚|晚|夜里/.test(hint) && hour < 12) hour += 12;
  if (/凌晨|早|上午/.test(hint) && hour === 12) hour = 0;
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? [hour, minute] : null;
}

function titleIn(line: string) {
  return line
    .replace(datePattern, '').replace(weekPattern, '').replace(relativePattern, '').replace(timePattern, '')
    .trim()
    .replace(/^(?:提醒|预约时间|通知|截止时间|时间)\s*[:：]\s*/, '')
    .replace(/^(?:请于|请在|请|于)\s*/, '')
    .replace(/^前\s*(?=交|提交|完成|缴|支付|领取|到|去|参加|确认|回复|办理)/, '')
    .replace(/^[\s，。:：、\-]+|[\s，。:：、\-]+$/g, '')
    .trim();
}

export function extractSuggestions(text: string, now = new Date()): Suggestion[] {
  const lines = text.normalize('NFKC').split(/\r?\n/).flatMap(line => line.split(/[。；;]/))
    .map(line => line.trim()).filter(Boolean);
  const suggestions: Suggestion[] = [];
  const fallback = lines.map(titleIn).find(line => line.length >= 4) ?? '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const date = dateIn(line, now);
    let time = timeIn(line);
    if (!date) continue;
    let source = line;
    if (!time && lines[i + 1] && !dateIn(lines[i + 1], now) && /^(?:时间\s*[:：]\s*|凌晨|早上|上午|中午|下午|晚上|\d)/.test(lines[i + 1])) {
      const nextTime = timeIn(lines[i + 1]);
      if (nextTime) {
        time = nextTime;
        source += '\n' + lines[i + 1];
      }
    }
    date.setHours(...(time ?? [9, 0]), 0, 0);
    const title = titleIn(line);
    const nearbyTitle = i > 0 && !dateIn(lines[i - 1], now) ? titleIn(lines[i - 1]) : '';
    suggestions.push({ title: (title.length >= 2 ? title : nearbyTitle || fallback).slice(0, 80), source, date, hasTime: Boolean(time) });
    if (suggestions.length === 6) break;
  }
  return suggestions.length ? suggestions : [{ title: fallback.slice(0, 80), source: '', date: null, hasTime: false }];
}

export function dateLabel(date: Date) {
  return `${date.getMonth() + 1}月${date.getDate()}日 周${weekdays[date.getDay()]}`;
}

export function timeLabel(date: Date) {
  return [date.getHours(), date.getMinutes()].map(value => String(value).padStart(2, '0')).join(':');
}

export function nextHour() {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date;
}

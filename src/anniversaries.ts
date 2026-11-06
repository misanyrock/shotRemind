export type Anniversary = { id: string; title: string; day: number };

const dayMilliseconds = 86_400_000;

// Put the local calendar fields on a UTC day grid so DST never changes the count.
export function calendarDay(date: Date) {
  const utc = new Date(0);
  return utc.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate()) / dayMilliseconds;
}

export function dateForPicker(day: number) {
  const utc = new Date(day * dayMilliseconds);
  const local = new Date(2000, 0, 1, 12);
  local.setFullYear(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
  return local;
}

export function anniversaryDate(day: number) {
  const utc = new Date(day * dayMilliseconds);
  return `${utc.getUTCFullYear()}年${utc.getUTCMonth() + 1}月${utc.getUTCDate()}日`;
}

export function anniversaryDistance(day: number, today: number) {
  const difference = day - today;
  if (difference === 0) return '就是今天';
  return difference > 0 ? `还有 ${difference} 天` : `已过去 ${-difference} 天`;
}

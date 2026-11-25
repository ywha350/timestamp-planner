export const clock = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const duration = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60}m` : `${m}m`;
export const blank = (start = 0) => ({start, minutes: 0, task: ''});
export function parseRange(value) {
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [h, m, eh, em] = match.slice(1).map(Number);
  if (h > 23 || eh > 23 || m > 59 || em > 59) return null;
  const start = h * 60 + m;
  return {start, minutes: (eh * 60 + em - start + 1440) % 1440};
}
export function shift(rows, index, delta) {
  rows[index].minutes = Math.max(0, Math.min(1440, rows[index].minutes + delta));
  for (let i = index + 1; i < rows.length; i++) rows[i].start = (rows[i - 1].start + rows[i - 1].minutes) % 1440;
}

export function formatDuration(ms: number, withSeconds = true): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return withSeconds ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${h}h ${pad(m)}m`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function formatDay(ts: number, now: number): string {
  const today = dayKey(now);
  const yesterday = dayKey(startOfDay(now) - 1);
  const key = dayKey(ts);
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Date(ts).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

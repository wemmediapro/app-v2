/** Formate un pourcentage de tendance analytics (+/-). */
export function formatTrend(value) {
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  if (num === 0) return '0%';
  return num > 0 ? `+${num}%` : `${num}%`;
}

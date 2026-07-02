export function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function formatTime(timestamp) {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function formatPoints(value) {
  return new Intl.NumberFormat("de-DE").format(Math.round(value));
}

export function formatScore(value) {
  const number = Number(value);
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(number) ? number : 0);
}

export function formatMultiplier(value) {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 6,
  }).format(value);
}

export function formatNumberInput(value) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
}

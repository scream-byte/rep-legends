// Small localStorage wrapper. Telegram webviews can block or wipe storage,
// so every access is guarded and the game works without it.

const PREFIX = 'rl.';

export function load(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function save(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value);
  } catch {
    /* storage unavailable — ignore */
  }
}

export const keys = {
  warmupAck: 'warmupAck',
  bestPushups: 'best.pushup',
  settings: 'settings',
} as const;

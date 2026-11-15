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
  /** LEGACY (before progress.ts): personal record per exercise. Read only for migration. */
  best: (exercise: string) => `best.${exercise}`,
  /** player progress (XP, records) as JSON — see src/progress */
  progress: 'progress',
  /** the previous saved progress, kept as a backup */
  progressBackup: 'progress.bak',
  /** this device's random id (for per-device XP counters) */
  deviceId: 'deviceId',
  /** last chosen pull-up difficulty + band toggle, JSON */
  pullupOptions: 'pullup.options',
  settings: 'settings',
} as const;

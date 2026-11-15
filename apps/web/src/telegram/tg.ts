// Small typed wrapper around window.Telegram.WebApp.
// Outside Telegram (e.g. in a desktop browser) it returns safe fallbacks,
// so the app can still be opened for development.

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

interface TgWebApp {
  initData: string;
  initDataUnsafe: { user?: TgUser; start_param?: string };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  ready(): void;
  expand(): void;
  isVersionAtLeast(version: string): boolean;
  disableVerticalSwipes?: () => void;
  HapticFeedback?: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
  };
  /** Telegram's per-user cloud key-value storage (Bot API 6.9+), synced across devices */
  CloudStorage?: {
    setItem(key: string, value: string, cb?: (err: string | null, ok?: boolean) => void): void;
    getItem(key: string, cb: (err: string | null, value?: string) => void): void;
  };
  BackButton?: {
    show(): void;
    hide(): void;
    onClick(cb: () => void): void;
    offClick(cb: () => void): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

const webApp: TgWebApp | undefined = window.Telegram?.WebApp;

/** True only when the page was opened inside Telegram (initData is present). */
export const insideTelegram = Boolean(webApp && webApp.initData);

/** Tell Telegram the app is ready and let it use the full screen height. */
export function initTelegram(): void {
  if (!webApp) return;
  webApp.ready();
  webApp.expand();
  // Stops the "swipe down to close" gesture from fighting with exercises.
  if (webApp.isVersionAtLeast('7.7')) webApp.disableVerticalSwipes?.();
}

export function getUser(): TgUser | undefined {
  return webApp?.initDataUnsafe.user;
}

export function getPlatform(): string {
  return insideTelegram ? webApp!.platform : 'browser';
}

export function getTgVersion(): string {
  return webApp?.version ?? '—';
}

// Haptics exist since Bot API 6.1; skip them in a plain browser or older clients,
// and when the player switched vibration off in Settings.
let hapticsEnabled = true;
export function setHapticsEnabled(on: boolean): void {
  hapticsEnabled = on;
}
const canVibrate = () => hapticsEnabled && insideTelegram && webApp!.isVersionAtLeast('6.1');

export function haptic(style: 'light' | 'medium' | 'heavy' = 'medium'): void {
  if (canVibrate()) webApp?.HapticFeedback?.impactOccurred(style);
}

export function hapticNotify(type: 'error' | 'success' | 'warning'): void {
  if (canVibrate()) webApp?.HapticFeedback?.notificationOccurred(type);
}

// ---------- Telegram CloudStorage (survives app data wipes and device changes) ----------

export const cloudAvailable = (): boolean => insideTelegram && webApp!.isVersionAtLeast('6.9') && !!webApp!.CloudStorage;

/** Reads a cloud key. Resolves null if missing; rejects on error or timeout. */
export function cloudGet(key: string, timeoutMs = 5000): Promise<string | null> {
  return new Promise((resolve, reject) => {
    if (!cloudAvailable()) return reject(new Error('cloud unavailable'));
    const timer = setTimeout(() => reject(new Error('cloud timeout')), timeoutMs);
    webApp!.CloudStorage!.getItem(key, (err, value) => {
      clearTimeout(timer);
      if (err) reject(new Error(err));
      else resolve(value ? value : null);
    });
  });
}

/** Writes a cloud key (max 4096 chars). Resolves true when Telegram confirms. */
export function cloudSet(key: string, value: string, timeoutMs = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    if (!cloudAvailable() || value.length > 4096) return resolve(false);
    const timer = setTimeout(() => resolve(false), timeoutMs);
    webApp!.CloudStorage!.setItem(key, value, (err, ok) => {
      clearTimeout(timer);
      resolve(!err && ok !== false);
    });
  });
}

/**
 * Shows Telegram's native "back" arrow in the header while a screen is open.
 * Returns a cleanup function that hides it again.
 */
export function showBackButton(onBack: () => void): () => void {
  const bb = webApp?.BackButton;
  if (!bb || !webApp!.isVersionAtLeast('6.1')) return () => {};
  bb.onClick(onBack);
  bb.show();
  return () => {
    bb.offClick(onBack);
    bb.hide();
  };
}

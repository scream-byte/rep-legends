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

export function haptic(style: 'light' | 'medium' | 'heavy' = 'medium'): void {
  webApp?.HapticFeedback?.impactOccurred(style);
}

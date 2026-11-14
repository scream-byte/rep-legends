import type { ru } from './ru';

export const en: typeof ru = {
  hello: (name: string) => `Hi, ${name}!`,
  guest: 'Hero',
  tagline: 'Your reps are your power',
  stageNote: 'Stage 0: the app works. A push-up counter is coming soon.',
  play: 'Fight!',
  comingSoon: 'Coming soon!',
  notInTelegram: 'Opened outside Telegram — name and haptics are unavailable.',
  info: 'Technical info',
  language: 'Language',
  platform: 'Platform',
  version: 'Telegram version',
  switchLang: 'Русский',
};

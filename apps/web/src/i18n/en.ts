import type { ru } from './ru';

export const en: typeof ru = {
  hello: (name: string) => `Hi, ${name}!`,
  guest: 'Hero',
  readyLine: 'Ready for your first workout?',
  play: 'Fight!',
  arenas: 'Arenas',
  comingSoon: 'Soon!',
  rank: 'Rank',
  stats: {
    attack: 'Attack',
    strength: 'Strength',
    endurance: 'Stamina',
    defense: 'Defense',
  },
  friends: 'Friends',
  settings: 'Settings',
  nav: {
    hero: 'Hero',
    arenas: 'Arenas',
    home: 'Home',
    tasks: 'Quests',
    ranking: 'Ranking',
  },
  language: 'Language',
  close: 'Close',
  notInTelegram: 'Opened outside Telegram — name and haptics are unavailable.',
  info: 'Technical info',
  platform: 'Platform',
  version: 'Telegram version',
};

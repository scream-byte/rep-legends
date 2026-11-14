import { getUser } from '../telegram/tg';
import { en } from './en';
import { ru } from './ru';

export type Lang = 'ru' | 'en';
export type Dict = typeof ru;

const dicts: Record<Lang, Dict> = { ru, en };

// Languages close to Russian get the Russian UI; everyone else gets English.
const RU_LIKE = ['ru', 'uk', 'be', 'kk', 'uz', 'ky', 'tg', 'hy', 'az', 'ka'];

export function detectLang(): Lang {
  const code = (getUser()?.language_code ?? navigator.language ?? 'en').slice(0, 2).toLowerCase();
  return RU_LIKE.includes(code) ? 'ru' : 'en';
}

export function getDict(lang: Lang): Dict {
  return dicts[lang];
}

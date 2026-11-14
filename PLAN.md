# Rep Legends — технический план

> Документ для агента-разработчика. Обновляется после каждого этапа.
> Инструкция для человека — в [GUIDE.md](GUIDE.md).

**Текущий статус:** этап 0 ✅ принят. Этап 1 (счётчик отжиманий) реализован и выложен — ждёт проверки пользователем на iPhone и Android.
**Окружение (проверено 2026-11-14):** Windows 11, Git 2.56, Node v26.13.1 / npm 11.20. Сайт: https://silindanniil-byte.github.io/rep-legends/ (GitHub Pages, деплой по push в `main`). Push из сессии агента работает (GCM сохранил вход).

## 0. Решения, принятые с пользователем
- Название: **Rep Legends**.
- Устройства для тестов: iPhone + Android (оба есть у пользователя).
- Бюджет на сервер: до ~500 ₽/мес (оплата в рублях).
- Характеристики: отжимания → Атака, подтягивания → Сила, приседания → Выносливость, пресс → Защита.
- Пресс = **подъёмы корпуса** (sit-ups, камера сбоку), а не скручивания.
- Языки: ru/en, по умолчанию `Telegram.WebApp.initDataUnsafe.user.language_code`.
- **Визуальный стиль (изменён 2026-11-14 по просьбе пользователя):** вместо комикс-шутера — яркий «казуальный мультяшный» UI мобильной игры: синий фон с лучами, объёмные кнопки с тёмной обводкой и 3D-краем, белый текст с обводкой, герой-маскот в центре, большая жёлтая кнопка «В бой!», нижнее меню из 5 вкладок. Референс — скриншот чужой игры: берём только общий жанровый стиль, весь арт, герой, иконки и раскладка — оригинальные (не копировать). Шрифт Rubik 700–900 (OFL, кириллица, `@fontsource/rubik`, лежит в бандле). Маскот — оранжевый круглый герой с повязкой и гантелью (`ui/Hero.tsx`). Вариант по макету пользователя (пустыня + яблоко-супергерой, коммит `4dcd811`) пользователю **не понравился** и откатан (`f3fbdc4`) — остаёмся на синем фоне. **Маскот (с 2026-11-14):** картинка пользователя — яблоко-супергерой в маске и плаще (`apps/web/src/assets/hero-apple.png`, прозрачный PNG 442×564, ~231 КБ), выводится через `ui/Hero.tsx` как `<img>`. Нарисованный SVG-герой остался в истории git.
- Пользователь — новичок: объяснять по-русски и простыми словами, код и имена файлов на английском, один этап за раз, после каждого этапа ждать «ок».

## 1. Результаты проверки документации (2026-11-14)
- **Telegram Bot API 10.1.** Для Mini Apps доступны:
  - полноэкранный режим `requestFullscreen()`, `lockOrientation()`, `safeAreaInset` (8.0);
  - `DeviceStorage` (5 МБ) и `SecureStorage` (9.0);
  - `HapticFeedback`;
  - `openInvoice` для оплаты Stars;
  - Accelerometer и Gyroscope (8.0);
  - ссылки вида `t.me/<bot>/<app>?startapp=` с полями `start_param`, `chat_type`, `chat_instance`;
  - проверка `initData`: HMAC-SHA-256, ключ = HMAC("WebAppData", bot_token).

  Inline- и direct-link Mini Apps не могут читать или писать сообщения в чате, поэтому в группах пишет бот.
- **Камера.** В официальной документации Telegram о ней ничего нет. По отзывам сообщества, `getUserMedia({video:true})` в Mini App работает на Android и iOS, но на iOS (WKWebView) разрешение может запрашиваться повторно. Это **главный риск**, его закрывает этап 1.
- **MediaPipe.** Пакет `@mediapipe/tasks-vision`, PoseLandmarker:
  - режим `runningMode: "VIDEO"` + `detectForVideo(video, performance.now())` в цикле `requestAnimationFrame`;
  - модели lite, full и heavy (float16); `baseOptions.delegate: "GPU"`, при ошибке — `"CPU"`;
  - версию фиксировать через `npm view @mediapipe/tasks-vision version` (по найденным данным встречаются 0.10.3x и 1.0.x);
  - `wasm/` и `pose_landmarker_lite.task` **хостить у себя** в `apps/web/public/mediapipe/`, без внешних CDN.

## 2. Стек
| Часть | Выбор |
|---|---|
| Язык | TypeScript везде |
| Клиент | React + Vite, `telegram-web-app.js` (официальный скрипт, подключается в `index.html`) |
| Поза | `@mediapipe/tasks-vision` PoseLandmarker lite |
| UI/анимации | CSS-модули + SVG; позже `motion` |
| i18n | свой словарь `ru.ts`/`en.ts` + хук `useT()` |
| Сервер (этап 2+) | Node.js LTS + Fastify + Socket.IO |
| Бот | grammY (webhook на том же сервере) |
| БД | PostgreSQL + Drizzle ORM |
| Хостинг этапов 0–1 | GitHub Pages (публичный репозиторий; сборку выкладывает GitHub Actions) |
| Хостинг этапа 2+ | Timeweb Cloud (App Platform + managed PostgreSQL), ~500 ₽/мес. Перед этапом 2 перепроверить цены и тарифы |

## 3. Архитектура
```
Телефон (Telegram) → Mini App (React)
   ├─ камера → MediaPipe → RepCounter (на устройстве, видео не покидает телефон)
   ├─ экраны: Home, Warmup, Counter, Duel, Hero, Arenas, Ratings, Boss, Group
   └─ Socket.IO / HTTPS ⇄ сервер (Node)
                              ├─ auth: проверка initData → JWT сессии
                              ├─ duel: очередь, комнаты, авторитетный таймер
                              ├─ anticheat: правдоподобие событий
                              ├─ rating: Elo по упражнению + общий
                              ├─ bot: grammY (/start, /challenge, итоги в группах, позже Stars)
                              └─ PostgreSQL
```
**Решения принимает сервер.** Клиент шлёт `rep` с `{tMs, durationMs, minAngle, maxAngle, quality}`. Сервер решает, засчитать ли повторение и сколько урона оно наносит, и рассылает состояние обоим игрокам.

## 4. Структура папок (npm workspaces)
```
project/
  PLAN.md  GUIDE.md  package.json  .gitignore  .github/workflows/deploy-web.yml
  apps/web/
    index.html  vite.config.ts
    public/mediapipe/          # wasm + .task
    src/
      main.tsx  App.tsx
      telegram/tg.ts           # типобезопасная обёртка над window.Telegram.WebApp
      pose/camera.ts           # getUserMedia, выбор камеры, 480p
      pose/landmarker.ts       # загрузка MediaPipe, GPU→CPU fallback
      pose/geometry.ts         # angle(a,b,c), visibility helpers
      exercises/RepCounter.ts  # общая машина состояний
      exercises/{pushup,squat,situp,pullup}.ts
      anticheat/clientChecks.ts
      screens/*.tsx  ui/*.tsx  i18n/{ru,en,index}.ts  net/socket.ts
  apps/server/src/
      index.ts  auth/  duel/  anticheat/  rating/  bot/  db/schema.ts
  packages/shared/src/
      exercises.ts   # пороги и правила (используют и клиент, и сервер)
      protocol.ts    # типы сообщений Socket.IO
```

## 5. Подсчёт повторений
- `RepCounter`: состояния `UP → DOWN → UP` с гистерезисом.
  - Метрика (угол) сглаживается EMA (α≈0,4).
  - Переход в DOWN: метрика < `downThreshold`; переход в UP: метрика > `upThreshold`.
  - Повторение засчитывается при возврате в UP, если пройдены проверки: амплитуда, длительность ≥ `minRepMs`, видимость, форма.
- Калибровка: обязательные точки упражнения видны с visibility > 0,6 непрерывно ≥ 1 с, затем отсчёт «3-2-1».
- Правила (стартовые значения, подбирать на реальных людях):

| Упражнение | Ракурс | Метрика | DOWN | UP | Форма | minRepMs |
|---|---|---|---|---|---|---|
| pushup | сбоку, телефон на полу | угол локтя | < 90° | > 155° | плечо–таз–лодыжка > 150°, корпус горизонтален (dx > 1.3·dy) | 400 (от момента, когда руки перестали быть прямыми) |
| squat | сбоку/спереди | угол колена | < 100° | > 160° | — | 700 |
| situp | сбоку | угол корпуса к полу | < 20° (лёжа) | > 70° | колени согнуты | 800 |
| pullup | спереди снизу | нос выше линии кистей / угол локтя | локоть > 150° (вис) | нос выше кистей | — | 900 |

- Используем ту сторону тела, у которой выше суммарная visibility (левая или правая).
- Отладочный режим `?debug=1`: скелет поверх видео, FPS, текущие углы.
- `HapticFeedback.impactOccurred('medium')` на каждое повторение.

## 6. Античит
**Клиент:**
1. Пауза счёта, если обязательные точки не видны.
2. Повторение без полной амплитуды не засчитывается, игрок видит подсказку.
3. `minRepMs` и максимальный темп.
4. Резкие скачки точек между кадрами (смена человека, подмена картинки) → пауза.
5. «Живость»: если траектории нескольких повторений совпадают почти идеально, ставим флаг.
6. Во время рейтинговой дуэли камеру нельзя переключить.

**Сервер:**

7. Проверка подписи `initData` при каждом подключении.
8. Повторная проверка порогов и темпа по сводке каждого повторения.
9. Жёсткие потолки за раунд (например, pushup ≤ 70 за 60 с; выше — флаг).
10. Резкий рост личного рекорда → флаг, рейтинг заморожен до проверки.
11. Жалоба на соперника.

**Ограничение:** абсолютной защиты в браузере нет. Цель — сделать жульничество хлопотным и заметным.

## 7. Модели данных
```
users(id, telegram_id UNIQUE, first_name, username, language, warmup_ack_at, created_at)
heroes(user_id PK, level, xp, rank ENUM(E,D,C,B,A,S), attack, strength, endurance, defense, skin_id)
exercise_ratings(user_id, exercise ENUM(pushup,pullup,squat,situp), elo DEFAULT 1000, wins, losses, best_reps, PK(user_id, exercise))
matches(id, exercise, mode ENUM(duel,boss,group), status, started_at, ended_at, duration_s, group_id NULL)
match_players(match_id, user_id, reps, damage_dealt, result ENUM(win,loss,draw,tech_loss), flags JSONB)
rep_events(match_id, user_id, t_ms, duration_ms, min_angle, max_angle)   -- TTL 30 дней
bosses(id, rank, name_key, hp, exercise, art_id) ; boss_progress(user_id, boss_id, best_reps, defeated_at)
groups(id, telegram_chat_id, title) ; group_members(group_id, user_id) ; group_challenges(id, group_id, exercise, starts_at, ends_at)
cosmetics(id, kind, price_stars) ; inventory(user_id, cosmetic_id) ; purchases(id, user_id, stars_amount, telegram_payment_charge_id, created_at)
```
- Общий рейтинг = среднее Elo по упражнениям, в которых сыграно не меньше 5 матчей. Считается запросом, отдельно не хранится.
- Влияние характеристик на урон в дуэли ограничено ±15%.

## 8. Этапы и критерии готовности
| # | Этап | Критерий готовности |
|---|---|---|
| 0 | Окружение + пустое приложение на GitHub Pages, бот с кнопкой Mini App | Открывается в Telegram на iPhone и Android, показывает имя пользователя и язык ru/en |
| 1 | Предупреждение о разминке (при первом запуске, хранится в DeviceStorage/localStorage) + камера + калибровка + счётчик отжиманий + debug + античит 1–3 | 20 честных отжиманий → 19–20 на обоих телефонах; «полуотжимания» → 0; FPS ≥ 15 |
| 2 | Сервер (Timeweb), БД, auth, очередь, приглашение `startapp=duel_<id>`, дуэль 60 с, полоски HP, результат, Elo | Дуэль между двумя телефонами, задержка показа счёта соперника < 1 с, матч сохранён, обрыв связи обработан |
| 3 | squat, situp, pullup + инструкции по установке телефона | Точность ≥ 90% на 20 повторениях каждого упражнения; для pullup решено, остаётся камера или включается запасной вариант |
| 4 | Герой, характеристики, 4 арены, 4 рейтинга + общий, лидерборды | Характеристики растут после тренировок; топ-100 и «моё место» |
| 5 | Ранги E–S, боссы (оригинальный дизайн) | Путь E→D, победа над двумя боссами, прогресс сохраняется |
| 6 | Группы: `/challenge`, таблица группы, недельные итоги от бота | Тест в группе из трёх человек |
| 7 | Полировка в мультяшном стиле (см. раздел 0): анимации, звук, полный перевод ru/en, переключатель языка | Нет непереведённых строк, анимации плавные на среднем Android |

После каждого этапа: краткий отчёт простыми словами, инструкция для проверки на телефоне, обновление PLAN.md и GUIDE.md, ожидание «ок».

## 9. Риски
| Риск | Митигация |
|---|---|
| Камера в Telegram на iOS не работает или постоянно спрашивает разрешение | Проверить на этапе 1. Запасной вариант: `openLink` в Safari для тренировки + возврат результата. Крайний вариант: PWA |
| Подтягивания трудно снимать | Инструкция «телефон на полу у стены, фронтальная камера вверх, 2–3 м». Запасной вариант: Accelerometer Telegram (телефон в кармане или на руке), без рейтинга до подтверждения надёжности |
| Низкий FPS на слабых Android | lite-модель, 480p, обработка через кадр, CPU fallback |
| Ложные или пропущенные повторения | Гистерезис, EMA, калибровка, debug-режим, подбор порогов |
| Жульничество | Раздел 6 |
| Доступность сервисов в РФ | Хостинг с оплатой в рублях, MediaPipe лежит у нас |
| Травмы | Предупреждение при первом запуске, лимит длительности |
| Конфликт названия или бренда | Перед публичным запуском проверить название; весь арт оригинальный, без чужих IP |
| Пользователь-новичок | Маленькие шаги, каждый проверяется на телефоне |

## 10. Монетизация (на будущее)
Таблицы `cosmetics`, `inventory`, `purchases` заложены в схему. Сценарий оплаты Stars: бот создаёт ссылку на счёт (`createInvoiceLink`, валюта XTR) → в Mini App `openInvoice(url)` → бот получает `pre_checkout_query` и `successful_payment` → запись в `purchases`. Пока не реализуем.

## Журнал этапов
- 2026-11-14: план одобрен, созданы PLAN.md и GUIDE.md.
- 2026-11-14: **этап 1 реализован** (ждёт проверки на телефонах).
  - `@mediapipe/tasks-vision` **1.2.3** (exact). API как в 0.10.x: `FilesetResolver.forVisionTasks(base)`, `PoseLandmarker.createFromOptions`, `detectForVideo(video, ts)`. В пакете только `vision_wasm_internal.{js,wasm}` (14 МБ, без nosimd).
  - `apps/web/scripts/copy-mediapipe.mjs` (predev/prebuild) копирует wasm в `public/mediapipe/wasm/` (в .gitignore); модель `public/mediapipe/pose_landmarker_lite.task` (5,6 МБ) лежит в репозитории.
  - `pose/landmarker.ts` (GPU → CPU fallback, в т.ч. при ошибке во время работы), `pose/camera.ts` (getUserMedia 640×480, wake lock), `pose/geometry.ts`.
  - `exercises/pushup.ts`: `measurePushup` (выбор стороны по visibility, углы в пикселях), `calibrationHint`, `PushupCounter` (EMA α=0.4, гистерезис 90/155, подсказки lower/back/fast/plank/lost, журнал `RepRecord` для сервера на этапе 2).
  - `exercises/pushup.test.ts` — 16 синтетических тестов (`npm test`), все проходят. Тест нашёл баг: длительность считалась от 140°, а не от начала спуска → честные быстрые отжимания отбраковывались; исправлено (`lastTopAt`, minRepMs 400).
  - Экраны: `screens/Home.tsx` (вынесен из App), `Warmup.tsx` (разминка/врач, один раз, `localStorage rl.warmupAck`), `Pushups.tsx` (setup → loading → calibrating (1 с в позе) → 3-2-1 → active → result; рекорд в `rl.best.pushup`; Telegram BackButton; отладка: скелет + FPS/делегат/углы).
  - Smoke-тест в Edge с виртуальной камерой (CDP): калибровка достигнута за 5 с, GPU, ~75 FPS на ПК, без исключений. Реальный подсчёт на человеке и камера в Telegram iOS/Android — проверяет пользователь.
  - ✅ 2026-11-14: **iPhone, Telegram — камера работает, движения распознаются, отжимания засчитываются** (подтвердил пользователь). Главный риск проекта снят для iOS.
  - 2026-11-14 (вне этапов, по просьбе пользователя): **настройки + звук**. `settings.ts` (useSettings, localStorage `rl.settings`), `ui/SettingsModal.tsx`, `audio/engine.ts` (шины master/music/sfx, разблокировка по касанию, пауза в фоне), `audio/music.ts` (синтезированная тема меню, 112 BPM), `audio/sfx.ts`. Яркость = CSS `filter: brightness()` на `#root` (только когда ≠100%). Музыка выключается на экране тренировки. Это забегает вперёд этапа 7 (звук/полировка) — в этапе 7 останется только доводка.
  - ✅ iPhone: 20/20 честных отжиманий, полуотжимания не засчитываются («Ниже!»), **FPS 60, GPU**. Критерий готовности этапа 1 выполнен на iOS. ⏳ Android ещё не проверен (у пользователя пока не было возможности) — проверить при первой возможности; пороги не меняем.
- 2026-11-14: этап 0 (в работе). Node v26.13.1 установлен. Создан каркас: npm workspaces (`apps/web`), React 19.3 + Vite 8.3 + TS 7.0, `tg.ts`, i18n ru/en (автоопределение + переключатель), временная комикс-заглушка, workflow GitHub Pages (`.github/workflows/deploy-web.yml`, base `/rep-legends/`). `npm run build` проходит. Git: локальный репозиторий, ветка `main`, автор `silindanniil-byte` (noreply email). Обновление: репозиторий создан, push выполнен пользователем (GCM), Actions success, сайт отдаёт 200. Затем по просьбе пользователя главный экран переделан в мультяшный стиль: topbar (уровень/XP, ранг), 4 характеристики, боковые кнопки «Рейтинг»/«Настройки» (модалка с выбором языка), маскот с репликой, «В бой!» + «Арены», нижнее меню; неготовые разделы показывают всплывающее «Скоро!». Осталось (исходный список): пользователь создаёт репозиторий `rep-legends` + Pages Source = GitHub Actions → `git push` → BotFather Mini App URL `https://silindanniil-byte.github.io/rep-legends/` → проверка на iPhone и Android.

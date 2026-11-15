import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initAudio } from './audio/engine';
import { initProgress } from './progress/store';
import { initTelegram } from './telegram/tg';
import '@fontsource/rubik/cyrillic-700.css';
import '@fontsource/rubik/cyrillic-800.css';
import '@fontsource/rubik/cyrillic-900.css';
import '@fontsource/rubik/latin-700.css';
import '@fontsource/rubik/latin-800.css';
import '@fontsource/rubik/latin-900.css';
import './styles.css';

initTelegram();
initAudio();
initProgress();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

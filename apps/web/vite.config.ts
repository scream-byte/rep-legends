import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site is served from https://<user>.github.io/rep-legends/,
// so every file path must start with /rep-legends/.
export default defineConfig({
  base: '/rep-legends/',
  plugins: [react()],
  define: {
    // Build time (UTC), shown in Settings → Technical info: lets the player check that
    // Telegram loaded the newest version and not a cached old one.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
});

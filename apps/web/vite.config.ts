import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site is served from https://<user>.github.io/rep-legends/,
// so every file path must start with /rep-legends/.
export default defineConfig({
  base: '/rep-legends/',
  plugins: [react()],
});

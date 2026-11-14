// Copies MediaPipe's WebAssembly runtime from node_modules into public/,
// so the game serves it from its own site (no third-party CDN needed).
// Runs automatically before `npm run dev` and `npm run build`.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');
const FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];

// npm workspaces may hoist the package to the repo root, so walk upwards.
function findPackageDir() {
  let dir = webRoot;
  for (;;) {
    const candidate = join(dir, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) throw new Error('@mediapipe/tasks-vision not found — run `npm install` first');
    dir = parent;
  }
}

const src = findPackageDir();
const dest = join(webRoot, 'public', 'mediapipe', 'wasm');
mkdirSync(dest, { recursive: true });
for (const file of FILES) copyFileSync(join(src, file), join(dest, file));
console.log(`[copy-mediapipe] copied ${FILES.length} files to public/mediapipe/wasm`);

// Copies MapLibre's web worker into /public so the browser can load it from a stable URL.
// Next.js bundling breaks MapLibre's default worker URL ("Worker failed to load").
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const src = path.join(path.dirname(require.resolve('maplibre-gl/package.json')), 'dist', 'maplibre-gl-worker.mjs');
const dst = path.resolve('public', 'maplibre-gl-worker.mjs');
fs.copyFileSync(src, dst);
console.log(`maplibre worker → ${path.relative(process.cwd(), dst)}`);

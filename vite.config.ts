import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

// Emits sw.js with every built file listed for precaching, so the game works offline after the first visit
function serviceWorker(): Plugin {
  return {
    name: 'polybound-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const publicFiles = readdirSync('public');
      const files = [...Object.keys(bundle), ...publicFiles].filter(f => !f.endsWith('.map')).sort();
      const hash = createHash('sha256');
      for (const name of Object.keys(bundle).sort()) {
        const item = bundle[name];
        hash.update(name).update(item.type === 'chunk' ? item.code : item.source);
      }
      for (const name of publicFiles) hash.update(name).update(readFileSync(`public/${name}`));
      const source = readFileSync('pwa/sw.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__FILES__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  // Relative asset paths so the build works from any subfolder (e.g. /polybound/)
  base: './',
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  },
  worker: {
    format: 'es',
  },
});

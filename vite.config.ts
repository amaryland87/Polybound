import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works from any subfolder (e.g. /polybound/)
  base: './',
  server: {
    port: 3000,
  },
  build: {
    outDir: 'dist',
  }
});
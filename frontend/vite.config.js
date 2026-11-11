import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '');
  return {
    plugins: [react()],
    envDir: projectRoot,
    server: {
      port: 5173,
      strictPort: true,
      fs: { allow: [projectRoot] },
      proxy: { '/api': `http://127.0.0.1:${env.PORT || 4100}` },
    },
  };
});
